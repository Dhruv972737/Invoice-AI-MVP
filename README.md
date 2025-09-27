# 🤖 Invoice AI Platform - Complete AI-Powered Invoice Processing

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Netlify-00C7B7?style=for-the-badge&logo=netlify)](https://invoice-ai-mvp.netlify.app)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-46E3B7?style=for-the-badge&logo=render)](https://invoice-ai-backend.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/Dhruv972737/Invoice-AI-MVP)

A comprehensive AI-powered invoice processing platform built with React, TypeScript, Supabase, and Google Gemini AI. Features real OCR extraction with Tesseract.js, advanced fraud detection, tax compliance, and intelligent chatbot assistance.

## 🌟 **Live Demo & Test Credentials**

### 🔗 **Live Application**
- **Frontend**: [https://invoice-ai-mvp.netlify.app](https://invoice-ai-mvp.netlify.app)
- **Backend API**: [https://invoice-ai-backend.onrender.com](https://invoice-ai-backend.onrender.com)
- **API Documentation**: [https://invoice-ai-backend.onrender.com/api-docs](https://invoice-ai-backend.onrender.com/api-docs)

### 🔐 **Test Credentials**
```
Email: dhruvsvpatel@gmail.com
Password: 12345678

```

### 📋 **Sample Test Data**
- Upload sample invoices from `/sample-invoices/` folder
- Test different file formats: PDF, JPEG, PNG
- Try various invoice types: service, product, recurring

## 🚀 **Key Features**

### 🤖 **Real AI Processing Pipeline**
- **Tesseract.js OCR**: Client-side text extraction from images/PDFs
- **Google Gemini AI**: Advanced field extraction and data validation
- **Smart Fraud Detection**: Multi-factor risk analysis algorithms
- **Tax Compliance**: Multi-region support (EU VAT, ZATCA, UAE FTA)
- **Language Detection**: Automatic invoice language identification

### 💬 **AI-Powered Chatbot**
- **Google Gemini Integration**: Natural language query processing
- **Smart Data Analysis**: Query invoices, spending patterns, risk factors
- **Contextual Responses**: Understands your invoice data for accurate answers
- **Fallback System**: Pattern-based responses when AI is unavailable

### 📊 **Advanced Analytics**
- **Real-time Dashboard**: Invoice statistics and trends
- **Risk Assessment**: Fraud detection with detailed scoring
- **Tax Summaries**: VAT calculations by region
- **Export Capabilities**: CSV, JSON data export

### 🔒 **Enterprise Security**
- **Supabase Authentication**: Secure user management with Google OAuth
- **Row-Level Security**: Database-level access control
- **File Storage**: Secure invoice storage with Supabase Storage
- **GDPR Compliant**: Data export and deletion capabilities

## 🛠 **Tech Stack**

### **Frontend**
- **React 18** with TypeScript
- **Tailwind CSS** for responsive design
- **Vite** for fast development and building
- **Lucide React** for consistent iconography

### **Backend & Database**
- **Node.js** with Express.js
- **Supabase** (PostgreSQL) for database and authentication
- **Supabase Storage** for secure file handling

### **AI & Processing**
- **Google Gemini AI** for intelligent field extraction
- **Tesseract.js** for OCR text recognition
- **PDF.js** for PDF processing and conversion
- **Custom Algorithms** for fraud detection and classification

### **Deployment**
- **Frontend**: Netlify with automatic deployments
- **Backend**: Render with health monitoring
- **Database**: Supabase cloud hosting
- **CDN**: Automatic asset optimization

## 📦 **Quick Start**

### **Prerequisites**
- Node.js 20.0.0+ (specified in `.nvmrc`)
- NPM 10.0.0+
- Supabase account
- Google Gemini API key

### **1. Clone Repository**
```bash
git clone https://github.com/Dhruv972737/Invoice-AI-MVP.git
cd Invoice-AI-MVP
npm install
```

### **2. Environment Setup**
Create `.env` file in root directory:
```bash
# Frontend Environment Variables
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key

# Backend Environment Variables (for production)
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production
FRONTEND_URL=https://invoice-ai-mvp.netlify.app
```

### **3. Database Setup**
1. Create new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run: `supabase/migrations/20250925235744_wandering_hill.sql`
3. Create storage bucket named "invoices" (make it public)
4. Configure Google OAuth in Authentication settings

### **4. API Keys Setup**

#### **Supabase Configuration**
1. Go to Project Settings → API
2. Copy Project URL and Anon Key
3. Copy Service Role Key (for backend)

#### **Google Gemini API Key**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Add to environment variables

#### **Google OAuth Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Configure in Supabase Auth settings

### **5. Development**
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🚀 **Deployment Guide**

### **Frontend Deployment (Netlify)**

1. **Connect GitHub Repository**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Select your repository

2. **Build Settings** (configured in `netlify.toml`)
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `20`

3. **Environment Variables**
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GEMINI_API_KEY=your-gemini-key
   ```

### **Backend Deployment (Render)**

1. **Create Web Service**
   - Go to [render.com](https://render.com)
   - Connect GitHub repository
   - Select "Web Service"

2. **Configuration**
   - Build Command: `npm install --production`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`

3. **Environment Variables**
   ```
   NODE_ENV=production
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   FRONTEND_URL=https://invoice-ai-mvp.netlify.app
   ```

## 📚 **API Documentation**

### **Base URL**
```
Production: https://invoice-ai-backend.onrender.com
Local: http://localhost:10000
```

### **Health Check Endpoints**

#### **GET /** - Root endpoint
```json
{
  "message": "Invoice AI Backend is running on Render! 🚀",
  "status": "healthy",
  "platform": "Render",
  "endpoints": {
    "health": "/api/health",
    "test": "/api/test"
  }
}
```

#### **GET /api/health** - Health monitoring
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "version": "1.0.0",
  "platform": "Render",
  "uptime": 3600,
  "memory": {
    "used": 45,
    "total": 512
  }
}
```

#### **GET /api/test** - API functionality test
```json
{
  "message": "Render API is working perfectly! ✅",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "platform": "Render"
}
```

### **Swagger Documentation**
Visit [https://invoice-ai-backend.onrender.com/api-docs](https://invoice-ai-backend.onrender.com/api-docs) for interactive API documentation.

## 🧪 **Testing**

### **Manual Testing Checklist**

#### **Authentication**
- [ ] Email/password registration
- [ ] Email/password login
- [ ] Google OAuth login
- [ ] Session persistence
- [ ] Logout functionality

#### **Invoice Processing**
- [ ] PDF upload and processing
- [ ] Image upload (JPEG, PNG)
- [ ] OCR text extraction
- [ ] AI field extraction
- [ ] Fraud risk assessment
- [ ] Tax calculations

#### **Dashboard Features**
- [ ] Invoice statistics display
- [ ] Recent invoices list
- [ ] Risk level indicators
- [ ] Export functionality

#### **AI Chatbot**
- [ ] Natural language queries
- [ ] Invoice data analysis
- [ ] Fallback responses
- [ ] Context awareness

### **Sample Test Scenarios**

1. **Upload Test Invoice**
   - Use sample invoices from `/sample-invoices/`
   - Verify OCR accuracy
   - Check extracted fields
   - Validate fraud scoring

2. **Chatbot Queries**
   ```
   "Show me high-risk invoices"
   "What's my total spending this month?"
   "Export my tax summary"
   "Who are my top vendors?"
   ```

3. **Analytics Testing**
   - View monthly trends
   - Check vendor breakdown
   - Verify risk distribution
   - Test export features

## 📁 **Project Structure**

```
invoice-ai-platform/
├── src/
│   ├── components/          # React components
│   │   ├── auth/           # Authentication components
│   │   ├── chat/           # AI chatbot interface
│   │   ├── dashboard/      # Dashboard components
│   │   ├── invoice/        # Invoice management
│   │   ├── analytics/      # Analytics and reporting
│   │   ├── settings/       # User settings
│   │   ├── layout/         # Layout components
│   │   └── ui/             # Reusable UI components
│   ├── contexts/           # React contexts
│   │   ├── AuthContext.tsx # Authentication state
│   │   ├── ThemeContext.tsx# Theme management
│   │   └── ToastContext.tsx# Notification system
│   ├── lib/                # Utilities and services
│   │   ├── ai/             # AI processing services
│   │   │   ├── ocrService.ts      # OCR processing
│   │   │   ├── geminiService.ts   # Gemini AI integration
│   │   │   └── fraudDetection.ts  # Fraud analysis
│   │   └── supabase.ts     # Database client
│   ├── types/              # TypeScript definitions
│   └── main.tsx            # Application entry point
├── supabase/
│   └── migrations/         # Database schema
├── sample-invoices/        # Test invoice files
├── docs/                   # Additional documentation
├── server.js               # Backend server
├── netlify.toml           # Netlify configuration
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## 🔧 **Configuration Files**

### **Environment Variables**
- `.env` - Local development environment
- `.env.example` - Template for environment setup

### **Build Configuration**
- `vite.config.ts` - Frontend build configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS setup
- `postcss.config.js` - PostCSS configuration

### **Deployment Configuration**
- `netlify.toml` - Netlify deployment settings
- `.nvmrc` - Node.js version specification
- `package.json` - Build scripts and dependencies

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Build Failures**
```bash
# Check Node.js version
node --version  # Should be 20.x

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### **Authentication Issues**
- Verify Supabase URL and keys
- Check OAuth redirect URLs
- Ensure RLS policies are enabled

#### **AI Processing Issues**
- Verify Gemini API key and quotas
- Check browser console for errors
- Test with different image qualities

#### **Database Connection**
- Verify Supabase project is active
- Check environment variables
- Test database connection in Supabase dashboard

### **Performance Optimization**

#### **Frontend**
- Images are optimized automatically
- Code splitting implemented
- CDN delivery via Netlify

#### **Backend**
- Health check monitoring
- Graceful error handling
- Memory usage optimization

## 📊 **Monitoring & Analytics**

### **Application Monitoring**
- **Render Dashboard**: Server metrics and logs
- **Netlify Analytics**: Frontend performance
- **Supabase Dashboard**: Database usage and auth

### **Error Tracking**
- Console logging for development
- Structured error handling
- User-friendly error messages

## 🤝 **Contributing**

### **Development Workflow**
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### **Code Standards**
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Conventional commits

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **Google Gemini AI** for intelligent processing
- **Supabase** for backend infrastructure
- **Tesseract.js** for OCR capabilities
- **React Community** for excellent tooling
- **Tailwind CSS** for design system

## 📞 **Support**

### **Documentation**
- [Supabase Docs](https://supabase.com/docs)
- [Google Gemini AI](https://ai.google.dev/)
- [React Documentation](https://react.dev/)

### **Deployment Platforms**
- [Netlify Docs](https://docs.netlify.com/)
- [Render Docs](https://render.com/docs)

### **Contact**
- **GitHub Issues**: [Report bugs or request features](https://github.com/Dhruv972737/Invoice-AI-MVP/issues)
- **Email**: support@invoiceai.com

---

## 🎯 **Demo Video**

📹 **[Watch Demo Video](https://youtu.be/your-demo-video)** - Complete walkthrough of features and functionality

---

**Built with ❤️ using React, TypeScript, Supabase, and Google Gemini AI**

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Dhruv972737/Invoice-AI-MVP)