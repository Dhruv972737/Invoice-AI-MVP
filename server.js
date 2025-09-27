import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting ES Module server...');
console.log('📍 Port:', PORT);
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('🚂 Railway PORT:', process.env.PORT || 'NOT SET');

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
  console.log(`📝 ${req.method} ${req.path} - ${req.ip}`);
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
    node_version: process.version
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint hit');
  res.json({ 
    message: 'API is working perfectly!',
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
    query: req.query
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
    status: 'operational'
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
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
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ ES Module Server running on 0.0.0.0:${PORT}`);
      console.log(`🌐 Railway assigned port: ${process.env.PORT || 'NOT ASSIGNED'}`);
      console.log(`🎯 Server started successfully with Node.js ${process.version}!`);
      console.log(`🔗 Health check: http://0.0.0.0:${PORT}/api/health`);
    });

    server.on('error', (err) => {
      console.error('❌ Server startup error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
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