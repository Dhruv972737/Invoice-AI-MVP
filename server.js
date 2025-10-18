import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import Stripe from 'stripe';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000; // Render uses port 10000 by default
const HOST = '0.0.0.0';

console.log('🚀 Starting Render-optimized server...');
console.log('📍 Port:', PORT);
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('🎯 Render PORT:', process.env.PORT || 'NOT SET');

// Environment validation for Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const frontendUrl = process.env.FRONTEND_URL || 'https://invoice-ai-mvp.netlify.app';
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Stripe if secret provided
let stripe = null;
if (stripeSecret) {
  stripe = new Stripe(stripeSecret, { apiVersion: '2022-11-15' });
}

// Supabase admin client for server-side operations
let supabaseAdmin = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

console.log('🔍 Environment Variables Check:');
console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
console.log('FRONTEND_URL:', frontendUrl);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables for Render deployment');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render dashboard');
  // Don't exit in production, let it run with warnings
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
}

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Invoice AI Platform API',
      version: '1.0.0',
      description: 'AI-powered invoice processing platform API',
      contact: {
        name: 'Invoice AI Support',
        email: 'support@invoiceai.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://invoice-ai-backend.onrender.com'
          : `http://localhost:${PORT}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string', example: '1.0.0' },
            platform: { type: 'string', example: 'Render' },
            uptime: { type: 'number', example: 3600 },
            memory: {
              type: 'object',
              properties: {
                used: { type: 'number', example: 45 },
                total: { type: 'number', example: 512 }
              }
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            platform: { type: 'string', example: 'Render' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            platform: { type: 'string', example: 'Render' }
          }
        }
      }
    }
  },
  apis: ['./server.js'] // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// CORS configuration for Render
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://invoice-ai-mvp.netlify.app',
    frontendUrl
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent')?.substring(0, 50) || 'Unknown';
  console.log(`📝 [${timestamp}] ${req.method} ${req.path} - ${ip} - ${userAgent}`);
  next();
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Invoice AI Platform API',
  swaggerOptions: {
    persistAuthorization: true,
  }
}));

/**
 * @swagger
 * /:
 *   get:
 *     summary: Root endpoint
 *     description: Returns basic information about the Invoice AI Platform API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:

// -------------------------
// Background worker (lightweight simulation)
// -------------------------
 *                   type: string
 *                   example: "Invoice AI Backend is running on Render! 🚀"

 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 platform:
 *                   type: string
 *                   example: "Render"
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     health:
 *                       type: string
 *                       example: "/api/health"
 *                     test:
 *                       type: string
 *                       example: "/api/test"
 */
// Root endpoint
app.get('/', (req, res) => {
  console.log('📄 Root endpoint accessed');
  res.json({
    message: 'Invoice AI Backend is running on Render! 🚀',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    platform: 'Render',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version,
    host: HOST,
    supabase_configured: !!supabaseUrl,
    service_key_configured: !!supabaseServiceKey,
    frontend_url: frontendUrl,
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      root: '/',
      docs: '/api-docs'
    }
  });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server health information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested by Render');
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    platform: 'Render',
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    render_service: process.env.RENDER_SERVICE_NAME || 'invoice-ai-backend',
    supabase_status: supabaseUrl ? 'configured' : 'missing',
    service_key_status: supabaseServiceKey ? 'configured' : 'missing'
  };
  
  res.json(healthData);
});

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: API test endpoint
 *     description: Tests API functionality and returns system information
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Render API is working perfectly! ✅"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 method:
 *                   type: string
 *                   example: "GET"
 *                 platform:
 *                   type: string
 *                   example: "Render"
 *                 headers:
 *                   type: object
 *                 query:
 *                   type: object
 *                 render_info:
 *                   type: object
 */
// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint accessed');
  res.json({ 
    message: 'Render API is working perfectly! ✅',
    timestamp: new Date().toISOString(),
    method: req.method,
    platform: 'Render',
    headers: {
      'user-agent': req.get('User-Agent'),
      'host': req.get('Host'),
      'x-forwarded-for': req.get('X-Forwarded-For'),
      'x-render-origin-name': req.get('X-Render-Origin-Name')
    },
    query: req.query,
    render_info: {
      port: process.env.PORT,
      environment: process.env.NODE_ENV,
      service: process.env.RENDER_SERVICE_NAME,
      region: process.env.RENDER_REGION
    }
  });
});

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API information
 *     description: Returns general information about the Invoice AI Platform API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: "Invoice AI API"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 platform:
 *                   type: string
 *                   example: "Render"
 *                 endpoints:
 *                   type: object
 *                 status:
 *                   type: string
 *                   example: "operational"
 */
// API info endpoint
app.get('/api', (req, res) => {
  console.log('ℹ️ API info requested');
  res.json({
    name: 'Invoice AI API',
    version: '1.0.0',
    platform: 'Render',
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      root: '/',
      docs: '/api-docs'
    },
    status: 'operational',
    render_configured: !!process.env.PORT,
    documentation: 'https://github.com/Dhruv972737/Invoice-AI-MVP'
  });
});

/**
 * Create Stripe Checkout session for purchasing tokens
 * Expects: { userId, priceId (optional), tokens, currency }
 */
app.post('/api/payments/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const { userId, tokens = 100, priceId, successUrl, cancelUrl } = req.body || {};

  try {
    // Build metadata to identify user in webhook
    const metadata = { user_id: userId || '' };

    // If priceId provided (Stripe Products/Prices), use it. Otherwise create a one-time line item.
    let sessionParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: successUrl || `${frontendUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${frontendUrl}/payments/cancel`,
      metadata,
      client_reference_id: userId || undefined
    };

    if (priceId) {
      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
    } else {
      // Default token package amount mapping (frontend should pass amount in cents)
      const amountCents = Math.max(1, Math.floor((req.body.amount_cents || (tokens * 100))));
      sessionParams.line_items = [{
        price_data: {
          currency: (req.body.currency || 'usd').toLowerCase(),
          product_data: { name: `${tokens} Tokens - Invoice AI` },
          unit_amount: amountCents
        },
        quantity: 1
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe create session error:', err);
    return res.status(500).json({ error: 'Failed to create Stripe session', details: err.message });
  }
});

/**
 * Stripe webhook endpoint to handle checkout.session.completed events
 * This will record the payment in Supabase and credit tokens
 */
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).send('Stripe not configured');
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    if (stripeWebhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } else {
      // If webhook secret not configured, parse body directly (not recommended in prod)
      event = req.body;
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event type
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.user_id || null;
      const amountTotal = session.amount_total || 0;
      const currency = session.currency || 'usd';

      console.log('Stripe checkout completed for user:', userId, 'amount:', amountTotal);

      if (userId && supabaseAdmin) {
        // Record transaction and credit tokens (simple credit: tokens = amount in dollars)
        const tokensCredited = Math.max(1, Math.floor((amountTotal / 100))); // 1 token per $1 by default

        // Insert payment record
        await supabaseAdmin.from('payment_transactions').insert([{ 
          user_id: userId,
          transaction_type: 'token_purchase',
          amount: (amountTotal / 100.0),
          currency: currency.toUpperCase(),
          tokens_purchased: tokensCredited,
          payment_provider: 'stripe',
          payment_provider_transaction_id: session.payment_intent || session.id,
          status: 'completed',
          metadata: { stripe: session }
        }]);

        // Update user_tokens table atomically: increment purchased_tokens
        await supabaseAdmin.rpc('increment_purchased_tokens', {
          p_user_id: userId,
          p_tokens: tokensCredited
        }).catch(async (e) => {
          // Fallback: update directly
          console.warn('RPC increment_purchased_tokens failed, trying direct update', e.message);
          const { data: existing } = await supabaseAdmin.from('user_tokens').select('purchased_tokens').eq('user_id', userId).limit(1).maybeSingle();
          if (existing) {
            await supabaseAdmin.from('user_tokens').update({ purchased_tokens: (existing.purchased_tokens || 0) + tokensCredited }).eq('user_id', userId);
          }
        });
      }
    }
    // Return a 200 response to Stripe
    res.json({ received: true });
  } catch (err) {
    console.error('Error handling stripe webhook:', err);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});

/**
 * Protected endpoint to reset daily tokens (calls the Supabase function)
 * Accepts a header 'x-service-role-key' matching SUPABASE_SERVICE_ROLE_KEY
 */
app.post('/api/admin/reset-daily-tokens', async (req, res) => {
  const provided = req.headers['x-service-role-key'] || req.body?.service_key;
  if (!supabaseServiceKey || provided !== supabaseServiceKey) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not configured' });

  try {
    await supabaseAdmin.rpc('reset_daily_tokens');
    res.json({ success: true, message: 'Daily tokens reset triggered' });
  } catch (err) {
    console.error('Failed to reset daily tokens:', err);
    res.status(500).json({ error: 'Failed to reset tokens' });
  }
});

/**
 * Get current user's token balances (server verifies user via access token)
 * Send Authorization: Bearer <access_token>
 */
app.get('/api/user/tokens', express.json(), async (req, res) => {
  const authHeader = req.headers['authorization'] || req.query?.access_token;
  const token = authHeader?.toString().replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Missing access token' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not configured' });

  try {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });
    const userId = userData.user.id;

    const { data: tokens, error } = await supabaseAdmin.from('user_tokens').select('*').eq('user_id', userId).limit(1).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to fetch tokens' });

    res.json({ tokens });
  } catch (err) {
    console.error('Error fetching user tokens:', err);
    res.status(500).json({ error: 'Failed to fetch user tokens' });
  }
});

/**
 * Enqueue invoice for processing. Client posts { invoiceId } with Authorization: Bearer <access_token>
 */
app.post('/api/process-invoice/enqueue', express.json(), async (req, res) => {
  const authHeader = req.headers['authorization'] || req.body?.access_token;
  const token = authHeader?.toString().replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Missing access token' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not configured' });

  const { invoiceId } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'Missing invoiceId' });

  try {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });
    const userId = userData.user.id;

    // Ensure invoice belongs to user
    const { data: invoice, error: invoiceErr } = await supabaseAdmin.from('invoices').select('id, user_id').eq('id', invoiceId).single();
    if (invoiceErr || !invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    // Insert into processing_queue
    const { data, error } = await supabaseAdmin.from('processing_queue').insert([{ user_id: userId, invoice_id: invoiceId, payload: {} }]).select().single();
    if (error) throw error;

    res.json({ success: true, job: data });
  } catch (err) {
    console.error('Failed to enqueue processing job:', err);
    res.status(500).json({ error: 'Failed to enqueue job' });
  }
});

// Serve static files in production (if needed)
if (process.env.NODE_ENV === 'production') {
  console.log('📁 Production mode: checking for static files');
  const distPath = path.join(process.cwd(), 'dist');
  
  // Check if dist directory exists
  try {
    const fs = await import('fs');
    if (fs.existsSync(distPath)) {
      console.log('📂 Serving static files from dist directory');
      app.use(express.static(distPath));
      
      // Catch-all handler for SPA routing
      app.get('*', (req, res) => {
        const indexPath = path.join(distPath, 'index.html');
        console.log('🔄 SPA routing - serving index.html for:', req.path);
        res.sendFile(indexPath);
      });
    } else {
      console.log('📂 No dist directory found - API only mode');
    }
  } catch (error) {
    console.log('📂 Static file serving disabled:', error.message);
  }
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log(`❌ 404 - API route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'API route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      '/',
      '/api/health',
      '/api/test',
      '/api',
      '/api-docs'
    ],
    platform: 'Render'
  });
});

// Global 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    platform: 'Render',
    message: 'This is the Invoice AI API backend. Frontend is hosted separately on Netlify.'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    platform: 'Render'
  });
});

// Start server with Render-optimized configuration
const startServer = () => {
  try {
    const server = app.listen(PORT, HOST, () => {
      console.log(`✅ Render Server running on ${HOST}:${PORT}`);
      console.log(`🌐 Render assigned port: ${process.env.PORT || 'NOT ASSIGNED'}`);
      console.log(`🎯 Server started successfully with Node.js ${process.version}!`);
      console.log(`🏥 Health Check: http://${HOST}:${PORT}/api/health`);
      console.log(`📚 API Docs: http://${HOST}:${PORT}/api-docs`);
      console.log(`📁 Working Directory: ${process.cwd()}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🎯 Platform: Render`);
      console.log(`🔗 Service: ${process.env.RENDER_SERVICE_NAME || 'invoice-ai-backend'}`);
      console.log(`🌍 Region: ${process.env.RENDER_REGION || 'unknown'}`);
    });

    // Handle server errors
    server.on('error', (err) => {
      console.error('❌ Server startup error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else if (err.code === 'EACCES') {
        console.error(`❌ Permission denied to bind to port ${PORT}`);
      }
      process.exit(1);
    });

    // Graceful shutdown for Render
    const gracefulShutdown = (signal) => {
      console.log(`🛑 ${signal} received - shutting down gracefully`);
      server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.log('⚠️ Forcing server shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
console.log('🔧 Render server setup complete, starting...');
startServer();