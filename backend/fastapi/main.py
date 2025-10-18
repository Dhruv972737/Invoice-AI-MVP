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
    if not stripe_client.api_key:
        raise HTTPException(status_code=500, detail='Stripe not configured')

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
        # Verify token and ensure user is Google OAuth
        user_resp = supabase_admin.auth.get_user(token)
        user = user_resp.data.user if user_resp and hasattr(user_resp, 'data') else None
        if not user:
            raise HTTPException(status_code=401, detail='Invalid token')

        provider = None
        try:
            provider = (user.raw_app_meta_data or {}).get('provider')
        except Exception:
            provider = None

        if not provider:
            prof = supabase_admin.table('profiles').select('provider').eq('id', user.id).limit(1).execute()
            prof_row = (prof.data or [None])[0]
            provider = prof_row.get('provider') if prof_row else None

        if not provider or str(provider).lower() != 'google':
            raise HTTPException(status_code=403, detail='Only Google OAuth users are allowed')

        user_id = user.id

        invoice_resp = supabase_admin.table('invoices').select('id,user_id').eq('id', invoice_id).limit(1).execute()
        invoice = (invoice_resp.data or [None])[0]
        if not invoice:
            raise HTTPException(status_code=404, detail='Invoice not found')
        if invoice['user_id'] != user_id:
            raise HTTPException(status_code=403, detail='Forbidden')

        enqueue_resp = supabase_admin.table('processing_queue').insert({ 'user_id': user_id, 'invoice_id': invoice_id, 'payload': {} }).execute()
        job = (enqueue_resp.data or [None])[0]
        return { 'success': True, 'job': job }
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
    asyncio.create_task(worker_loop())
    asyncio.create_task(reset_daily_tokens_loop())
    logger.info('FastAPI backend started; worker and daily reset loops scheduled')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=PORT, reload=True)
