import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Critical for all hosting platforms!

console.log('🚀 Starting ES Module server...');
console.log('📍 Port:', PORT);
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('🎯 Assigned PORT:', process.env.PORT || 'NOT SET');

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Environment Variables Check:');
console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');

if (!supabaseUrl) {
  console.warn('⚠️ SUPABASE_URL not found - some features may not work');
}

if (!supabaseServiceKey) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not found - some features may not work');
}

// Basic middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - ${req.ip} - ${req.get('User-Agent')?.substring(0, 50) || 'Unknown'}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('📄 Root endpoint hit');
  res.json({
    message: 'Invoice AI Backend is running!',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    railway_port: process.env.PORT,
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version,
    host: HOST,
    supabase_configured: !!supabaseUrl,
    service_key_configured: !!supabaseServiceKey
  });
});

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    assigned_port: process.env.PORT,
    supabase_url: supabaseUrl ? 'configured' : 'missing',
    service_key: supabaseServiceKey ? 'configured' : 'missing'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint hit');
  res.json({ 
    message: 'API is working perfectly!',
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: {
      'user-agent': req.get('User-Agent'),
      'host': req.get('Host'),
      'x-forwarded-for': req.get('X-Forwarded-For')
    },
    query: req.query,
    hosting_info: {
      port: process.env.PORT,
      environment: process.env.NODE_ENV,
      platform: 'render'
    }
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  console.log('ℹ️ API info requested');
  res.json({
    name: 'Invoice AI API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      root: '/'
    },
    status: 'operational',
    railway_configured: !!process.env.PORT
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      '/',
      '/api/health',
      '/api/test',
      '/api'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server with better error handling
const startServer = () => {
  try {
    const server = app.listen(PORT, HOST, () => {
      console.log(`✅ ES Module Server running on ${HOST}:${PORT}`);
      console.log(`🌐 Platform assigned port: ${process.env.PORT || 'NOT ASSIGNED'}`);
      console.log(`🎯 Server started successfully with Node.js ${process.version}!`);
      console.log(`🏥 Health Check: http://${HOST}:${PORT}/api/health`);
      console.log(`📁 Working Directory: ${process.cwd()}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🎯 Platform: Render`);
    });

    server.on('error', (err) => {
      console.error('❌ Server startup error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else if (err.code === 'EACCES') {
        console.error(`❌ Permission denied to bind to port ${PORT}`);
      }
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`🛑 ${signal} received`);
      server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
      });
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
console.log('🔧 ES Module server setup complete, starting...');
startServer();