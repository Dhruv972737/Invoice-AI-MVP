import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting Invoice AI Platform Server...');
console.log('📁 Working Directory:', __dirname);
console.log('🌍 Environment:', process.env.NODE_ENV);
console.log('🔧 Node.js Version:', process.version);
console.log('🚪 Port:', PORT);

// Environment variables check
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const frontendUrl = process.env.FRONTEND_URL;
const nodeEnv = process.env.NODE_ENV;

console.log('🔧 Environment Variables Check:');
console.log('- SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
console.log('- FRONTEND_URL:', frontendUrl ? '✅ Set' : '❌ Missing');
console.log('- NODE_ENV:', nodeEnv || 'development');

// Initialize Supabase (optional for basic server functionality)
let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase client initialized');
  } catch (error) {
    console.error('❌ Supabase initialization failed:', error.message);
  }
} else {
  console.warn('⚠️ Supabase not configured - some features will be limited');
}

// Basic middleware
console.log('🔧 Setting up middleware...');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://invoice-ai-mvp.netlify.app',
        'https://*.netlify.app',
        frontendUrl
      ].filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

console.log('🛣️ Setting up routes...');

// Health check endpoint - MUST be first
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    server: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    },
    database: {
      supabase: supabase ? 'connected' : 'not configured'
    },
    environment_variables: {
      SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey,
      FRONTEND_URL: !!frontendUrl,
      NODE_ENV: nodeEnv || 'development'
    }
  };
  
  console.log('✅ Health check response:', JSON.stringify(healthData, null, 2));
  res.json(healthData);
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('📄 Root endpoint accessed');
  res.json({
    message: 'Invoice AI Backend API',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      docs: '/api-docs'
    },
    frontend: frontendUrl || 'https://invoice-ai-mvp.netlify.app'
  });
});

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Invoice AI Platform API',
      version: '1.0.0',
      description: 'API for the Invoice AI Platform'
    },
    servers: [
      {
        url: 'https://invoice-ai-mvp-production.up.railway.app/api',
        description: 'Production API Server'
      }
    ]
  },
  apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }
    
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// API Routes
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint accessed');
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Protected routes (require authentication)
app.get('/api/invoices', authenticateUser, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    
    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: invoices, error, count } = await query;

    if (error) throw error;

    res.json({
      invoices,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

app.get('/api/analytics/dashboard', authenticateUser, async (req, res) => {
  try {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', req.user.id);

    if (error) throw error;

    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;
    const highRiskCount = invoices.filter(inv => inv.fraud_risk === 'high').length;

    res.json({
      totalInvoices,
      totalAmount,
      averageAmount,
      highRiskCount
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Catch-all for undefined API routes
app.use('/api/*', (req, res) => {
  console.log('❌ API 404:', req.method, req.path);
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    available_endpoints: ['/api/health', '/api/test', '/api-docs']
  });
});

// Catch-all for non-API routes
app.get('*', (req, res) => {
  console.log('📄 Catch-all route:', req.method, req.path);
  res.json({
    message: 'Invoice AI Backend API',
    status: 'running',
    path: req.path,
    frontend: frontendUrl || 'https://invoice-ai-mvp.netlify.app',
    api_endpoints: {
      health: '/api/health',
      test: '/api/test',
      docs: '/api-docs'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  console.error('Request:', req.method, req.path);
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Start server
const HOST = '0.0.0.0';

console.log('🚀 Starting server...');

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🏥 Health Check: http://${HOST}:${PORT}/api/health`);
  console.log(`🧪 Test Endpoint: http://${HOST}:${PORT}/api/test`);
  console.log(`📚 API Docs: http://${HOST}:${PORT}/api-docs`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Node.js Version: ${process.version}`);
  console.log(`📊 Supabase: ${supabase ? '✅ Connected' : '⚠️ Not configured'}`);
  console.log('✅ Server startup complete!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;