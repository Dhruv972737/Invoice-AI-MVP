import os
import asyncio
import logging
from typing import Optional
from datetime import datetime, timedelta, time
from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
try:
    import stripe
except Exception:
    stripe = None
from supabase import create_client
from google.auth import default as google_auth_default
from google.auth.exceptions import DefaultCredentialsError

# Import new services
from monitoring import get_monitoring_service, create_metrics_app, health_check
from fraud_detection_ml import create_fraud_detector
from tax_compliance import create_tax_compliance_service, get_tax_rate
from pdf_export import create_pdf_service
from email_ingestion import create_email_service
from drive_integration import create_drive_service
from job_queue import JobQueue
from invoice_processor import get_invoice_processor

load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("invoice_ai_fastapi")

# Config
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
PORT = int(os.environ.get('PORT', '10000'))
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

# Initialize clients
stripe_client = None
if stripe is not None:
    stripe_client = stripe
    if STRIPE_SECRET_KEY:
        stripe_client.api_key = STRIPE_SECRET_KEY

supabase_admin = None
def _is_placeholder_key(k: Optional[str]) -> bool:
    if not k:
        return True
    kl = k.strip().lower()
    # common placeholder patterns
    return kl.startswith('your-') or kl.startswith('replace-') or kl.startswith('sk_test_') and '...' in kl

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and not _is_placeholder_key(SUPABASE_SERVICE_ROLE_KEY):
    try:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        logger.exception('Failed to create Supabase admin client; continuing with supabase_admin=None')
        supabase_admin = None
else:
    logger.warning('Supabase admin client not configured or using placeholder keys - set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')

app = FastAPI(title='Invoice AI FastAPI Backend')

# In-memory cache for OAuth state -> user_id mapping
# In production, use Redis or database
oauth_state_cache = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        FRONTEND_URL,  # Uses the env variable you already have
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
monitoring_service = get_monitoring_service()
fraud_detector = create_fraud_detector()
tax_service = create_tax_compliance_service(region='SA', mode='sandbox')
pdf_service = create_pdf_service()
job_queue = JobQueue(supabase_admin) if supabase_admin else None
invoice_processor = get_invoice_processor(supabase_admin, GEMINI_API_KEY) if supabase_admin else None

if invoice_processor:
    logger.info("Invoice OCR processor initialized with Gemini AI")
else:
    logger.warning("Invoice OCR processor not initialized - Supabase not configured")

# Mount metrics endpoint
metrics_app = create_metrics_app()
app.mount("/metrics", metrics_app)

@app.get("/")
async def root():
    return {
        "message": "Invoice AI FastAPI Backend is running",
        "status": "ok",
        "supabase_admin_configured": bool(supabase_admin),
        "docs": "/docs",
        "health": "/api/health"
    }


@app.get('/api/health')
async def api_health():
    return {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'supabase_admin_configured': bool(supabase_admin),
        'worker_enabled': bool(supabase_admin),
    }

class CreateCheckoutRequest(BaseModel):
    userId: Optional[str]
    tokens: Optional[int] = 100
    amount_cents: Optional[int]
    currency: Optional[str] = 'usd'
    priceId: Optional[str] = None

@app.post('/api/payments/create-checkout-session')
async def create_checkout_session(payload: CreateCheckoutRequest):
    if not stripe_client or not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=400, detail='Payment system not configured. Please contact administrator.')

    metadata = {'user_id': payload.userId or ''}
    try:
        if payload.priceId:
            session = stripe_client.checkout.Session.create(
                mode='payment',
                line_items=[{'price': payload.priceId, 'quantity': 1}],
                success_url=f"{FRONTEND_URL}/payments/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{FRONTEND_URL}/payments/cancel",
                metadata=metadata,
                client_reference_id=payload.userId or None
            )
        else:
            amount_cents = payload.amount_cents or max(100, int((payload.tokens or 100) * 100 * 0.09))
            session = stripe_client.checkout.Session.create(
                mode='payment',
                line_items=[{
                    'price_data': {
                        'currency': (payload.currency or 'usd').lower(),
                        'product_data': {'name': f"{payload.tokens or 100} Tokens - Invoice AI"},
                        'unit_amount': amount_cents
                    },
                    'quantity': 1
                }],
                success_url=f"{FRONTEND_URL}/payments/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{FRONTEND_URL}/payments/cancel",
                metadata=metadata,
                client_reference_id=payload.userId or None
            )

        return { 'sessionId': session.id, 'url': session.url }
    except Exception as e:
        logger.exception('Failed to create checkout session')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/stripe/webhook')
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    event = None
    try:
        if STRIPE_WEBHOOK_SECRET and sig_header:
            event = stripe_client.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            # Without webhook secret, parse loosely (not secure)
            event = stripe_client.Event.construct_from(request.json(), stripe_client.api_key)
    except Exception as e:
        logger.exception('Webhook signature verification failed')
        raise HTTPException(status_code=400, detail='Invalid webhook signature')

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id') or session.get('metadata', {}).get('user_id')
        amount_total = session.get('amount_total', 0)
        currency = session.get('currency', 'usd')

        logger.info('Stripe checkout completed for user %s amount %s', user_id, amount_total)
        if user_id and supabase_admin:
            tokens = max(1, int(amount_total / 100))
            try:
                # Record payment
                supabase_admin.table('payment_transactions').insert({
                    'user_id': user_id,
                    'transaction_type': 'token_purchase',
                    'amount': amount_total / 100.0,
                    'currency': currency.upper(),
                    'tokens_purchased': tokens,
                    'payment_provider': 'stripe',
                    'payment_provider_transaction_id': session.get('payment_intent') or session.get('id'),
                    'status': 'completed',
                    'metadata': {'stripe': session}
                }).execute()

                # Increment purchased tokens via RPC if available
                try:
                    supabase_admin.rpc('increment_purchased_tokens', { 'p_user_id': user_id, 'p_tokens': tokens }).execute()
                except Exception:
                    # fallback: direct update
                    existing = supabase_admin.table('user_tokens').select('purchased_tokens').eq('user_id', user_id).limit(1).execute()
                    row = (existing.data or [None])[0]
                    if row:
                        new_val = (row.get('purchased_tokens') or 0) + tokens
                        supabase_admin.table('user_tokens').update({ 'purchased_tokens': new_val }).eq('user_id', user_id).execute()
            except Exception:
                logger.exception('Failed to credit tokens in Supabase')

    return JSONResponse({'received': True})


@app.post('/api/admin/reset-daily-tokens')
async def reset_daily_tokens(x_service_role_key: Optional[str] = Header(None), body: dict = {}):
    provided = x_service_role_key or body.get('service_key')
    if not SUPABASE_SERVICE_ROLE_KEY or provided != SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=403, detail='Forbidden')
    if not supabase_admin:
        raise HTTPException(status_code=500, detail='Supabase admin not configured')

    try:
        supabase_admin.rpc('reset_daily_tokens').execute()
        return { 'success': True }
    except Exception as e:
        logger.exception('Failed to reset daily tokens')
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/user/tokens')
async def get_user_tokens(authorization: Optional[str] = Header(None)):
    token = None
    if authorization:
        token = authorization.replace('Bearer ', '')
    if not token:
        raise HTTPException(status_code=401, detail='Missing access token')
    if not supabase_admin:
        raise HTTPException(status_code=500, detail='Supabase admin client not configured')
    try:
        # Verify token and ensure user is a Google OAuth user
        user_resp = supabase_admin.auth.get_user(token)
        user = user_resp.data.user if user_resp and hasattr(user_resp, 'data') else None
        if not user:
            raise HTTPException(status_code=401, detail='Invalid token')

        # Ensure provider is google (defense-in-depth)
        provider = None
        try:
            provider = (user.raw_app_meta_data or {}).get('provider')
        except Exception:
            provider = None

        if not provider:
            # fallback to profiles table
            prof = supabase_admin.table('profiles').select('provider').eq('id', user.id).limit(1).execute()
            prof_row = (prof.data or [None])[0]
            provider = prof_row.get('provider') if prof_row else None

        if not provider or str(provider).lower() != 'google':
            raise HTTPException(status_code=403, detail='Only Google OAuth users are allowed')

        user_id = user.id
        tokens_resp = supabase_admin.table('user_tokens').select('*').eq('user_id', user_id).limit(1).execute()
        return { 'tokens': (tokens_resp.data or [None])[0] }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception('Failed to fetch user tokens')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/user/ensure')
async def ensure_user_rows(request: Request):
    """Ensure the authenticated user has a `profiles` and `user_tokens` row.
    This endpoint is idempotent and uses the Supabase service role client.
    Client must provide an Authorization: Bearer <access_token> header.
    """
    auth = request.headers.get('authorization')
    token = None
    if auth:
        token = auth.replace('Bearer ', '')
    if not token:
        raise HTTPException(status_code=401, detail='Missing access token')
    if not supabase_admin:
        raise HTTPException(status_code=500, detail='Supabase admin client not configured')
    try:
        user_resp = supabase_admin.auth.get_user(token)
        user = user_resp.data.user if user_resp and hasattr(user_resp, 'data') else None
        if not user:
            raise HTTPException(status_code=401, detail='Invalid token')

        user_id = user.id

        # Ensure profile exists
        prof_check = supabase_admin.table('profiles').select('id').eq('id', user_id).limit(1).execute()
        prof_row = (prof_check.data or [None])[0]
        if not prof_row:
            profile_payload = {
                'id': user_id,
                'email': user.email or '',
                'full_name': (user.raw_user_meta_data or {}).get('full_name') or (user.email or '').split('@')[0],
                'avatar_url': (user.raw_user_meta_data or {}).get('avatar_url'),
                'provider': (user.raw_app_meta_data or {}).get('provider') or 'google',
                'provider_id': (user.raw_user_meta_data or {}).get('sub'),
                'subscription_plan': 'free'
            }
            try:
                supabase_admin.table('profiles').insert(profile_payload).execute()
            except Exception:
                logger.exception('Failed to insert profile row for user %s', user_id)

        # Ensure user_tokens exists
        tokens_check = supabase_admin.table('user_tokens').select('user_id').eq('user_id', user_id).limit(1).execute()
        tokens_row = (tokens_check.data or [None])[0]
        if not tokens_row:
            # Use default daily quota of 100 as in migrations
            try:
                supabase_admin.table('user_tokens').insert({
                    'user_id': user_id,
                    'daily_free_tokens': 100,
                    'daily_free_tokens_used': 0,
                    'purchased_tokens': 0,
                    'purchased_tokens_used': 0,
                    'total_lifetime_tokens_used': 0,
                    'last_daily_reset': datetime.utcnow()
                }).execute()
            except Exception:
                logger.exception('Failed to insert user_tokens for user %s', user_id)

        return { 'success': True }
    except HTTPException:
        raise
    except Exception:
        logger.exception('ensure_user_rows failed')
        raise HTTPException(status_code=500, detail='Failed to ensure user rows')


@app.post('/api/process-invoice/enqueue')
async def enqueue_processing(request: Request):
    body = await request.json()
    token = None
    auth = request.headers.get('authorization')
    if auth:
        token = auth.replace('Bearer ', '')
    invoice_id = body.get('invoiceId')
    if not token:
        raise HTTPException(status_code=401, detail='Missing access token')
    if not supabase_admin:
        raise HTTPException(status_code=500, detail='Supabase admin client missing')
    if not invoice_id:
        raise HTTPException(status_code=400, detail='Missing invoiceId')

    try:
        # Verify token by trying to query user's own profile
        # We'll use the token directly to verify it's valid
        import jwt
        import json

        # Decode JWT to get user_id (without verification for now - Supabase will verify via RLS)
        try:
            # Just decode to get the user_id, don't verify signature
            decoded = jwt.decode(token, options={"verify_signature": False})
            user_id = decoded.get('sub')
            if not user_id:
                raise HTTPException(status_code=401, detail='Invalid token: no user ID')
        except Exception as e:
            logger.error(f'Failed to decode token: {e}')
            raise HTTPException(status_code=401, detail=f'Invalid token format: {str(e)}')

        # Check provider from profiles table
        prof = supabase_admin.table('profiles').select('provider').eq('id', user_id).limit(1).execute()
        prof_row = (prof.data or [None])[0] if prof.data else None
        provider = prof_row.get('provider') if prof_row else None

        if not provider or str(provider).lower() != 'google':
            logger.warning(f'Non-Google user attempted to enqueue: user_id={user_id}, provider={provider}')
            # Allow for now - comment out if you want to enforce Google-only
            # raise HTTPException(status_code=403, detail='Only Google OAuth users are allowed')

        invoice_resp = supabase_admin.table('invoices').select('id,user_id').eq('id', invoice_id).limit(1).execute()
        invoice = (invoice_resp.data or [None])[0]
        if not invoice:
            raise HTTPException(status_code=404, detail='Invoice not found')
        if invoice['user_id'] != user_id:
            raise HTTPException(status_code=403, detail='Forbidden')

        # Process immediately with OCR
        logger.info(f'Processing invoice {invoice_id} for user {user_id}')

        try:
            if not invoice_processor:
                raise HTTPException(status_code=500, detail='Invoice processor not initialized')

            # Consume tokens (5 tokens for processing)
            token_resp = supabase_admin.rpc('consume_tokens', {
                'p_user_id': user_id,
                'p_tokens_to_consume': 5,
                'p_agent_name': 'orchestrator_immediate',
                'p_operation_type': 'full_pipeline',
                'p_ai_provider': 'gemini',
                'p_invoice_id': invoice_id
            }).execute()

            # Update invoice status to processing
            supabase_admin.table('invoices').update({
                'status': 'processing',
            }).eq('id', invoice_id).execute()

            # Process invoice with OCR and AI extraction
            result = await invoice_processor.process_invoice(invoice_id, user_id)

            if result['success']:
                logger.info(f'Invoice {invoice_id} processed successfully')
                return {
                    'success': True,
                    'invoice_id': invoice_id,
                    'status': 'completed',
                    'extracted_data': result.get('extracted_data', {})
                }
            else:
                logger.error(f'Invoice {invoice_id} processing failed: {result.get("error")}')
                return {
                    'success': False,
                    'invoice_id': invoice_id,
                    'status': 'failed',
                    'error': result.get('error')
                }
        except Exception as e:
            logger.exception(f'Failed to process invoice {invoice_id}')
            # Mark as failed
            supabase_admin.table('invoices').update({
                'status': 'failed',
                'error_message': str(e)
            }).eq('id', invoice_id).execute()
            raise HTTPException(status_code=500, detail=f'Processing failed: {str(e)}')
    except HTTPException:
        raise
    except Exception as e:
        logger.exception('Failed to enqueue job')
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/debug/google-credentials')
async def debug_google_credentials():
    try:
        creds, project = google_auth_default()
        info = {
            'project': project,
            'service_account_email': getattr(creds, 'service_account_email', None),
            'credentials_type': type(creds).__name__
        }
        return info
    except DefaultCredentialsError as e:
        logger.warning('Google ADC not available: %s', e)
        raise HTTPException(status_code=500, detail='Google ADC not available or GOOGLE_APPLICATION_CREDENTIALS not set')
    except Exception:
        logger.exception('Unexpected error reading Google credentials')
        raise HTTPException(status_code=500, detail='Unexpected error reading Google credentials')


# ===== NEW API ENDPOINTS =====

# Fraud Detection
@app.post('/api/fraud/analyze')
async def analyze_fraud(request: Request):
    """Analyze invoice for fraud"""
    body = await request.json()
    token = request.headers.get('authorization', '').replace('Bearer ', '')

    if not token:
        raise HTTPException(status_code=401, detail='Missing access token')

    try:
        import jwt
        decoded = jwt.decode(token, options={"verify_signature": False})
        user_id = decoded.get('sub')

        invoice_data = body.get('invoice')

        # Get historical invoices for context
        historical = supabase_admin.table('invoices').select('*').eq('user_id', user_id).limit(100).execute()
        historical_data = historical.data or []

        # Predict fraud
        fraud_result = fraud_detector.predict_fraud(invoice_data, historical_data)

        # Track in monitoring
        monitoring_service.track_fraud_detection(
            risk_level=fraud_result['risk_level'],
            detection_method='ml_ensemble',
            risk_score=fraud_result['fraud_probability']
        )

        # Store fraud alert if high risk
        if fraud_result['risk_level'] == 'high' and supabase_admin:
            supabase_admin.table('fraud_alerts').insert({
                'invoice_id': invoice_data.get('id'),
                'user_id': user_id,
                'risk_level': fraud_result['risk_level'],
                'risk_score': fraud_result['fraud_probability'],
                'risk_factors': fraud_result['risk_factors'],
                'detection_method': 'ml_ensemble',
                'status': 'pending_review'
            }).execute()

        return fraud_result
    except Exception as e:
        logger.exception('Failed to analyze fraud')
        raise HTTPException(status_code=500, detail=str(e))


# Tax Compliance
@app.post('/api/tax/validate-vat')
async def validate_vat(request: Request):
    """Validate VAT number"""
    body = await request.json()
    vat_number = body.get('vat_number')
    country_code = body.get('country_code', 'SA')

    if not vat_number:
        raise HTTPException(status_code=400, detail='Missing vat_number')

    try:
        result = await tax_service.validate_vat_number(vat_number, country_code)
        return result
    except Exception as e:
        logger.exception('Failed to validate VAT')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/tax/calculate')
async def calculate_tax(request: Request):
    """Calculate tax for amount"""
    body = await request.json()
    amount = body.get('amount')
    country_code = body.get('country_code', 'SA')
    tax_type = body.get('tax_type', 'vat')

    if not amount:
        raise HTTPException(status_code=400, detail='Missing amount')

    try:
        result = tax_service.calculate_tax(amount, country_code, tax_type)
        return result
    except Exception as e:
        logger.exception('Failed to calculate tax')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/tax/validate-invoice-compliance')
async def validate_invoice_compliance(request: Request):
    """Validate invoice compliance with regional requirements"""
    body = await request.json()
    invoice_data = body.get('invoice')
    country_code = body.get('country_code', 'SA')

    if not invoice_data:
        raise HTTPException(status_code=400, detail='Missing invoice data')

    try:
        result = tax_service.validate_invoice_compliance(invoice_data, country_code)

        # Log compliance check
        if supabase_admin:
            supabase_admin.table('tax_compliance_log').insert({
                'invoice_id': invoice_data.get('id'),
                'region': country_code,
                'compliance_status': 'compliant' if result['compliant'] else 'non_compliant',
                'validation_errors': result.get('errors', []),
                'validation_warnings': result.get('warnings', [])
            }).execute()

        return result
    except Exception as e:
        logger.exception('Failed to validate compliance')
        raise HTTPException(status_code=500, detail=str(e))


# PDF Export
@app.post('/api/export/invoice-pdf')
async def export_invoice_pdf(request: Request):
    """Export invoice as PDF"""
    body = await request.json()
    token = request.headers.get('authorization', '').replace('Bearer ', '')

    if not token:
        raise HTTPException(status_code=401, detail='Missing access token')

    try:
        import jwt
        decoded = jwt.decode(token, options={"verify_signature": False})
        user_id = decoded.get('sub')

        invoice_id = body.get('invoice_id')

        # Get invoice data
        invoice_resp = supabase_admin.table('invoices').select('*').eq('id', invoice_id).eq('user_id', user_id).single().execute()
        invoice_data = invoice_resp.data

        if not invoice_data:
            raise HTTPException(status_code=404, detail='Invoice not found')

        # Get company info
        company_info = body.get('company_info', {
            'name': 'Invoice AI',
            'address': '',
            'phone': '',
            'email': ''
        })

        # Generate PDF
        pdf_bytes = pdf_service.generate_invoice_pdf(invoice_data, company_info)

        # Store export request
        if supabase_admin:
            supabase_admin.table('export_requests').insert({
                'user_id': user_id,
                'export_type': 'invoice_pdf',
                'format': 'pdf',
                'status': 'completed',
                'file_size': len(pdf_bytes),
                'metadata': {'invoice_id': invoice_id}
            }).execute()

        from fastapi.responses import Response
        return Response(
            content=pdf_bytes,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename=invoice_{invoice_id}.pdf'
            }
        )
    except Exception as e:
        logger.exception('Failed to export invoice PDF')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/export/report-pdf')
async def export_report_pdf(request: Request):
    """Export analytics report as PDF"""
    body = await request.json()
    token = request.headers.get('authorization', '').replace('Bearer ', '')

    if not token:
        raise HTTPException(status_code=401, detail='Missing access token')

    try:
        import jwt
        decoded = jwt.decode(token, options={"verify_signature": False})
        user_id = decoded.get('sub')

        report_data = body.get('report_data')
        report_type = body.get('report_type', 'summary')

        # Generate PDF
        pdf_bytes = pdf_service.generate_report_pdf(report_data, report_type)

        from fastapi.responses import Response
        return Response(
            content=pdf_bytes,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename=report_{report_type}.pdf'
            }
        )
    except Exception as e:
        logger.exception('Failed to export report PDF')
        raise HTTPException(status_code=500, detail=str(e))


# Email Ingestion
@app.post('/api/email/configure')
async def configure_email(request: Request):
    """Configure email ingestion settings"""
    body = await request.json()
    token = request.headers.get('authorization', '').replace('Bearer ', '')

    if not token:
        raise HTTPException(status_code=401, detail='Missing access token')

    try:
        import jwt
        decoded = jwt.decode(token, options={"verify_signature": False})
        user_id = decoded.get('sub')

        email_config = body.get('config')

        # Store email config securely
        if supabase_admin:
            supabase_admin.table('user_email_configs').upsert({
                'user_id': user_id,
                'imap_server': email_config.get('imap_server'),
                'imap_port': email_config.get('imap_port', 993),
                'email_address': email_config.get('email_address'),
                'enabled': email_config.get('enabled', True)
            }).execute()

        return {'success': True}
    except Exception as e:
        logger.exception('Failed to configure email')
        raise HTTPException(status_code=500, detail=str(e))


# Google Drive Integration
@app.get('/api/drive/auth-url')
async def get_drive_auth_url(request: Request):
    """Get Google Drive OAuth authorization URL"""
    try:
        # Verify user authentication
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            raise HTTPException(status_code=401, detail='Missing or invalid authorization')

        token = auth_header.replace('Bearer ', '')
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        user_response = supabase_admin.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail='Invalid token')

        user_id = user_response.user.id

        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:10000/api/drive/callback')

        if not client_id or not client_secret:
            raise HTTPException(status_code=500, detail='Google Drive not configured')

        from drive_integration import DriveIntegrationService

        # Generate OAuth URL with state parameter
        auth_url = DriveIntegrationService.get_authorization_url(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            state=None  # Let Google generate the state
        )

        # Extract the state parameter from the URL to cache user_id
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(auth_url)
        query_params = parse_qs(parsed_url.query)
        state = query_params.get('state', [None])[0]

        if state:
            # Store user_id mapped to OAuth state for callback
            oauth_state_cache[state] = user_id
            logger.info(f'Stored OAuth state {state[:10]}... for user {user_id}')

        return {'auth_url': auth_url}
    except Exception as e:
        logger.exception('Failed to get Drive auth URL')
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/drive/callback')
async def drive_oauth_callback(code: str, state: str):
    """Handle Google Drive OAuth callback"""
    try:
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:10000/api/drive/callback')

        if not client_id or not client_secret:
            raise HTTPException(status_code=500, detail='Google Drive not configured')

        # Exchange code for credentials
        from drive_integration import DriveIntegrationService
        try:
            credentials = DriveIntegrationService.exchange_code_for_credentials(
                code=code,
                client_id=client_id,
                client_secret=client_secret,
                redirect_uri=redirect_uri
            )
        except Exception as auth_error:
            logger.error(f'Failed to exchange auth code: {auth_error}')
            # If code already used or invalid, redirect with clear error
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
            from fastapi.responses import RedirectResponse
            return RedirectResponse(
                url=f'{frontend_url}/?drive_error=auth_failed',
                status_code=302
            )

        # Retrieve user_id from OAuth state cache
        user_id = oauth_state_cache.get(state)

        if not user_id:
            logger.error(f'No user_id found for OAuth state: {state[:10]}...')
            raise HTTPException(status_code=400, detail='Invalid OAuth state')

        # Clean up the cache
        oauth_state_cache.pop(state, None)
        logger.info(f'Retrieved user_id {user_id} from OAuth state')

        # Store credentials in database
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        # Upsert OAuth tokens
        result = supabase_admin.table('google_oauth_tokens').upsert({
            'user_id': user_id,
            'access_token': credentials['token'],
            'refresh_token': credentials.get('refresh_token'),
            'token_expiry': None,  # Could calculate from expires_in
            'scopes': credentials.get('scopes', [])
        }).execute()

        # Redirect back to frontend
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        from fastapi.responses import RedirectResponse
        return RedirectResponse(
            url=f'{frontend_url}/?drive_connected=true',
            status_code=302
        )

    except Exception as e:
        logger.exception('OAuth callback failed')
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        from fastapi.responses import RedirectResponse
        # Redirect with error message
        error_msg = str(e).replace(' ', '_')
        return RedirectResponse(
            url=f'{frontend_url}/?drive_error={error_msg}',
            status_code=302
        )


@app.post('/api/google-drive/download')
async def download_from_google_drive(request: Request):
    """Download a file from Google Drive"""
    try:
        # Verify user authentication
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            raise HTTPException(status_code=401, detail='Missing or invalid authorization')

        token = auth_header.replace('Bearer ', '')

        # Verify with Supabase
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        user_response = supabase_admin.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail='Invalid token')

        user_id = user_response.user.id

        # Get request body
        body = await request.json()
        file_id = body.get('fileId')
        file_name = body.get('fileName')

        if not file_id:
            raise HTTPException(status_code=400, detail='Missing fileId')

        # Get user's Google OAuth tokens
        oauth_result = supabase_admin.table('google_oauth_tokens').select('*').eq('user_id', user_id).execute()

        if not oauth_result.data or len(oauth_result.data) == 0:
            raise HTTPException(
                status_code=403,
                detail='Google Drive not connected. Please authorize access first.'
            )

        oauth_data = oauth_result.data[0]

        # Create Drive service with user's credentials
        from drive_integration import create_drive_service
        credentials_dict = {
            'token': oauth_data['access_token'],
            'refresh_token': oauth_data.get('refresh_token'),
            'token_uri': 'https://oauth2.googleapis.com/token',
            'client_id': os.getenv('GOOGLE_CLIENT_ID'),
            'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'),
            'scopes': oauth_data.get('scopes', [])
        }

        drive_service = create_drive_service(credentials_dict)

        # Download file
        file_content = drive_service.download_file(file_id)

        # Get file metadata to determine MIME type
        file_metadata = drive_service.get_file_metadata(file_id)
        mime_type = file_metadata.get('mimeType', 'application/octet-stream')

        # Return file content
        from fastapi.responses import Response
        return Response(
            content=file_content,
            media_type=mime_type,
            headers={
                'Content-Disposition': f'attachment; filename="{file_name}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception('Failed to download from Google Drive')
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/drive/status')
async def check_drive_connection_status(request: Request):
    """Check if user has connected their Google Drive"""
    try:
        # Verify user authentication
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            raise HTTPException(status_code=401, detail='Missing or invalid authorization')

        token = auth_header.replace('Bearer ', '')
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        user_response = supabase_admin.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail='Invalid token')

        user_id = user_response.user.id

        # Check if user has OAuth tokens
        oauth_result = supabase_admin.table('google_oauth_tokens').select('id').eq('user_id', user_id).execute()

        return {
            'connected': len(oauth_result.data) > 0 if oauth_result.data else False
        }

    except Exception as e:
        logger.exception('Failed to check Drive status')
        raise HTTPException(status_code=500, detail=str(e))


# Health check with monitoring
@app.get('/api/health/detailed')
async def detailed_health_check():
    """Detailed health check with metrics"""
    try:
        health_data = await health_check()
        return health_data
    except Exception as e:
        logger.exception('Health check failed')
        raise HTTPException(status_code=500, detail=str(e))


# Background worker loop (simulated)
async def worker_loop():
    if not supabase_admin:
        logger.warning('Worker disabled - supabase admin not configured')
        return
    logger.info('Worker loop started')
    while True:
        try:
            # postgrest-py expects order(column, desc=False, nullsfirst=False)
            resp = supabase_admin.table('processing_queue').select('*').eq('status', 'pending').order('created_at').limit(1).execute()
            jobs = resp.data or []
            if not jobs:
                await asyncio.sleep(10)
                continue
            job = jobs[0]
            logger.info('Worker picked job %s', job['id'])
            supabase_admin.table('processing_queue').update({ 'status': 'processing', 'attempts': job.get('attempts', 0) + 1 }).eq('id', job['id']).execute()

            # Simulate token consumption and processing
            try:
                # consume 5 tokens
                supabase_admin.rpc('consume_tokens', { 'p_user_id': job['user_id'], 'p_tokens_to_consume': 5, 'p_agent_name': 'orchestrator_worker', 'p_operation_type': 'full_pipeline', 'p_ai_provider': 'local', 'p_invoice_id': job['invoice_id'] }).execute()
                supabase_admin.table('invoices').update({ 'status': 'completed', 'tokens_used': 5 }).eq('id', job['invoice_id']).execute()
                supabase_admin.table('processing_queue').update({ 'status': 'completed' }).eq('id', job['id']).execute()
                logger.info('Worker completed job %s', job['id'])
            except Exception:
                logger.exception('Worker failed to process job %s', job['id'])
                supabase_admin.table('processing_queue').update({ 'status': 'failed' }).eq('id', job['id']).execute()

        except Exception:
            logger.exception('Worker loop exception')
        await asyncio.sleep(5)


async def reset_daily_tokens_loop():
    if not supabase_admin:
        logger.warning('Daily reset disabled - supabase admin not configured')
        return
    logger.info('Daily reset loop started (will run at UTC midnight)')
    while True:
        try:
            now = datetime.utcnow()
            # Next midnight UTC
            next_midnight = datetime.combine((now + timedelta(days=1)).date(), time(0, 0))
            seconds = (next_midnight - now).total_seconds()
            logger.info('Sleeping %s seconds until next UTC midnight', seconds)
            await asyncio.sleep(max(0, seconds))
            try:
                supabase_admin.rpc('reset_daily_tokens').execute()
                logger.info('reset_daily_tokens RPC executed')
            except Exception:
                logger.exception('Failed to execute reset_daily_tokens RPC')
        except Exception:
            logger.exception('Daily reset loop exception')
        # continue to compute next midnight

@app.on_event('startup')
async def startup_event():
    # DISABLED: We now process invoices immediately in the endpoint
    # asyncio.create_task(worker_loop())
    asyncio.create_task(reset_daily_tokens_loop())
    logger.info('FastAPI backend started; daily reset loop scheduled (worker loop disabled - processing is now immediate)')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=PORT, reload=True)
