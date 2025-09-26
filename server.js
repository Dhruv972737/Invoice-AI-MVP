const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://your-app.railway.app'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from dist directory
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Invoice AI Platform API',
      version: '1.0.0',
      description: 'API for the Invoice AI Platform - handles invoice processing, AI analysis, and data management',
      contact: {
        name: 'API Support',
        email: 'support@invoiceai.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-backend.railway.app' 
          : 'http://localhost:3001',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./server.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  }
});

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
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
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: Get user's invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of invoices to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of invoices to skip
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [processing, completed, failed]
 *         description: Filter by invoice status
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invoices:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
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

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get a specific invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       404:
 *         description: Invoice not found
 *       401:
 *         description: Unauthorized
 */
app.get('/api/invoices/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      throw error;
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * @swagger
 * /api/invoices/{id}:
 *   delete:
 *     summary: Delete an invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice deleted successfully
 *       404:
 *         description: Invoice not found
 *       401:
 *         description: Unauthorized
 */
app.delete('/api/invoices/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if invoice exists and belongs to user
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('file_url')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      throw fetchError;
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (deleteError) throw deleteError;

    // Delete file from storage if exists
    if (invoice.file_url) {
      try {
        const filePath = invoice.file_url.split('/').pop();
        await supabase.storage
          .from('invoices')
          .remove([`${req.user.id}/${filePath}`]);
      } catch (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Don't fail the request if storage deletion fails
      }
    }

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalInvoices:
 *                   type: integer
 *                 totalAmount:
 *                   type: number
 *                 averageAmount:
 *                   type: number
 *                 highRiskCount:
 *                   type: integer
 *                 monthlyTrends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       count:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 */
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

    // Calculate monthly trends
    const monthlyData = {};
    invoices.forEach(inv => {
      const month = new Date(inv.created_at).toISOString().slice(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { amount: 0, count: 0 };
      }
      monthlyData[month].amount += inv.amount || 0;
      monthlyData[month].count++;
    });

    const monthlyTrends = Object.entries(monthlyData)
      .sort()
      .slice(-12)
      .map(([month, data]) => ({ month, ...data }));

    res.json({
      totalInvoices,
      totalAmount,
      averageAmount,
      highRiskCount,
      monthlyTrends
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Unauthorized
 */
app.get('/api/user/profile', authenticateUser, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Invoice:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         file_name:
 *           type: string
 *         file_url:
 *           type: string
 *         status:
 *           type: string
 *           enum: [processing, completed, failed]
 *         vendor_name:
 *           type: string
 *         invoice_date:
 *           type: string
 *           format: date
 *         amount:
 *           type: number
 *         currency:
 *           type: string
 *         tax_id:
 *           type: string
 *         language:
 *           type: string
 *         classification:
 *           type: string
 *           enum: [service, product, recurring]
 *         fraud_risk:
 *           type: string
 *           enum: [low, medium, high]
 *         tax_region:
 *           type: string
 *         vat_amount:
 *           type: number
 *         processed_data:
 *           type: object
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     Profile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         full_name:
 *           type: string
 *         avatar_url:
 *           type: string
 *         provider:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const HOST = '0.0.0.0';
const PORT = process.env.PORT || 3001;

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🏥 Health Check: http://${HOST}:${PORT}/api/health`);
});

module.exports = app;