import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
      root: '/'
    }
  });
});

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
      root: '/'
    },
    status: 'operational',
    render_configured: !!process.env.PORT,
    documentation: 'https://github.com/your-repo/invoice-ai-platform'
  });
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
      '/api'
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