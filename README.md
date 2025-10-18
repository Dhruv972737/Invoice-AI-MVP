<!-- Invoice-AI-MVP - Run locally guide -->
# Invoice AI MVP — Run locally

This repository contains a full-stack AI-powered invoice processing demo built with a TypeScript React frontend (Vite), Supabase (auth, database, storage), and two backend options in the `backend/` folder (a Node helpers server and a Python FastAPI scaffold). This README explains how to run the entire stack locally on macOS (bash).

Quick summary — what you'll bring:
- Node.js 18/20+ and npm/yarn
- Python 3.10+ and virtualenv (for the FastAPI backend)
- A Supabase project (free tier is fine) or a local Postgres if you prefer
- (Optional for payments) a Stripe account and the Stripe CLI for local webhook testing

Table of contents
- Prerequisites
- Environment files and important variables
- Supabase: project setup and migrations
- Running the frontend (Vite)
- Running the Node helper server (optional)
- Running the FastAPI backend (recommended for local development)
- Testing Stripe webhooks locally
- Troubleshooting & notes (auth triggers, destructive migrations)
- Quick commands summary

---

## Prerequisites

Install Node and Python if you don't already have them.

macOS (bash) example using Homebrew:

```bash
# install Node (LTS / 18+ or 20+ recommended)
brew install node

# Python 3.10+ (macOS may already have python; use pyenv if needed)
brew install python

# Optional: Stripe CLI for webhook testing
brew install stripe/stripe-cli/stripe
```

Verify versions:

```bash
node --version
npm --version
python3 --version
```

---

## Environment variables

The project reads environment variables both in the frontend (Vite uses VITE_ prefixed vars) and the backend(s). Create a `.env` file at the project root with the values you want for local development. A minimal `.env` for local dev (replace placeholders):

```env
# Supabase (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # REQUIRED for background jobs/admin endpoints

# OAuth / Google
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Backend
VITE_BACKEND_URL=http://localhost:10000

# Stripe (optional for payments & tokens)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# AI provider keys (if you have them — otherwise the frontend will disable providers gracefully)
VITE_GEMINI_API_KEY=
VITE_OPENAI_API_KEY=
VITE_CLAUDE_API_KEY=
VITE_OCR_SPACE_API_KEY=

# Development flags
NODE_ENV=development

```

Notes:
- The frontend only reads variables prefixed with `VITE_`.
- The FastAPI / Node servers read `SUPABASE_SERVICE_ROLE_KEY` (service role) to run admin RPCs and to power the simulated worker. If you don't set the service role key the worker and admin endpoints will be disabled and the server will start but log a notice.
- Never commit your service role key to source control.

---

## Supabase project setup (recommended)

1. Create a Supabase project at https://app.supabase.com.
2. Open the SQL editor and run the base migrations in `supabase/migrations/` in chronological order. IMPORTANT: Some migration files in this repository contain DROP statements that are destructive. If you're working with an existing database, review migrations before executing.

Suggested safe approach for local testing:

- Create a fresh Supabase project and run migrations there.
- If you only want to enable the Google-only auth trigger, run the dedicated migration `supabase/migrations/20251017000000_enforce_google_only.sql` as the project owner (service_role) from the SQL editor. See "Auth triggers & privileges" below.

Storage bucket:

- Create a bucket named `invoices` (used by the frontend to upload files). You can make it public for local testing.

Auth providers:

- Configure Google OAuth credentials in Supabase auth settings. Use the client id in the `.env` above.

---

## Auth triggers & privileges (very important)

This repo contains migrations that attempt to create triggers on the `auth.users` table. Those operations require a privileged role (the Supabase SQL editor runs as the DB owner or a role that has permission). If you run migrations from a non-privileged connection you'll see `permission denied for schema auth`. The migration files now guard these DDL operations, but they will not create the triggers unless you run the `auth`-schema blocks as the project owner.

Two options:

1. Run the `20251017000000_enforce_google_only.sql` migration in the Supabase SQL editor (signed-in as project owner) — this will create the BEFORE INSERT trigger enforcing Google provider only.
2. If you don't want to create triggers, the backend and frontend are defensive and will work without them (the migration will skip the auth DDL with a NOTICE). You should still configure Google OAuth in Supabase to ensure users sign in with Google.

---

## Run the frontend (Vite)

Install dependencies and start the dev server:

```bash
cd /path/to/Invoice-AI-MVP-main
npm install
npm run dev
```

This will start the Vite dev server (default: http://localhost:5173). The app reads runtime config from `import.meta.env` so ensure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_BACKEND_URL` are set.

Build for production:

```bash
npm run build
npm run preview  # serve build locally
```

---

## Run the Node helper server (optional)

The repository includes a small `server.js` that hosts a couple of helpers (Stripe checkout helpers, a simulated worker, and admin endpoints). This server is optional — the preferred local backend for development is the FastAPI scaffold in `backend/fastapi`.

Start the Node helper server (if you want to run it):

```bash
# from project root
node server.js
```

The Node server listens on port 10000 by default (see `server.js`). It will only execute admin RPCs if `SUPABASE_SERVICE_ROLE_KEY` is present in the environment.

---

## Run the FastAPI backend (recommended)

The repository includes `backend/fastapi/` with a FastAPI scaffold. It implements endpoints for payments, enqueueing invoice processing, and admin RPCs. Follow these steps to run locally.

1) Create and activate a virtual environment (macOS bash):

```bash
cd backend/fastapi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2) Create a `.env` file in `backend/fastapi` or export the same variables from the repo root. Minimal variables:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export STRIPE_SECRET_KEY=sk_test_xxx
export STRIPE_WEBHOOK_SECRET=whsec_xxx
export VITE_BACKEND_URL=http://localhost:10000
```

3) Run the app:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 10000
```

The FastAPI app will log a warning and disable the worker/daily-reset loops if the `SUPABASE_SERVICE_ROLE_KEY` is not configured or appears to be a placeholder. When provided, the worker will call public RPCs such as `consume_tokens` and `increment_purchased_tokens`.

---

## Test Stripe webhooks locally (optional)

If you want to test Stripe checkout flow locally you'll need Stripe CLI and the `STRIPE_WEBHOOK_SECRET` configured in `.env`.

Start the FastAPI server, then in another terminal run:

```bash
stripe listen --forward-to localhost:10000/api/stripe/webhook
```

This sets up a tunnel to forward Stripe events to your local webhook endpoint. Use the Stripe CLI to trigger test events, or complete a checkout session to see the webhook delivered.

---

## Running migrations (careful)

Files are in `supabase/migrations/`. Some files in this repo are full-schema dumps that include `DROP TABLE` statements and auth-schema DDL. Do NOT run the full set of migrations against a production database unless you know what they do.

Safe approach for local dev:

1. Create a fresh Supabase project.
2. Run only the additive migrations you need (or inspect and apply SQL from migration files selectively).
3. To enable the Google-only auth trigger run `supabase/migrations/20251017000000_enforce_google_only.sql` from the Supabase SQL editor (project owner role).

If you want, I can generate a small psql snippet you can run with the service_role key to create only the auth trigger without running the full dump — ask and I'll produce it.

---

## Troubleshooting & notes

- If the frontend complains about missing `import.meta.env` properties, ensure your `VITE_` variables are defined when running `npm run dev`.
- If the FastAPI logs show "Worker disabled — supabase admin not configured", set `SUPABASE_SERVICE_ROLE_KEY` to a valid service role key in the `.env` used by the FastAPI server.
- Auth trigger creation requires project-owner privileges. Running the migration in the Supabase SQL editor (with your project owner account) is the easiest path.
- The project contains experimental client-side AI/agents. For production you should move heavy OCR/AI workloads server-side and secure provider API keys (don't expose them in the frontend).

---

## Quick commands summary

```bash
# project root
npm install
npm run dev          # frontend

# FastAPI (in backend/fastapi)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 10000

# Optional: Node helper
node server.js

# Stripe CLI
stripe listen --forward-to localhost:10000/api/stripe/webhook
```

---

If you'd like, I can also:
- Provide a small non-destructive migration that only creates the `auth` trigger and supporting function (safe to run as project owner).
- Create a sample `.env.example` with all the keys and placeholders.

If you want me to apply either of those, tell me which and I'll add them.

---

Thank you — you're ready to run the project locally. Open an issue if anything fails and include logs/command output.
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

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Dhruv972737/Invoice-AI-MVP)# Invoice-AI-MVP-main
