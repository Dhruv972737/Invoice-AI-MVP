<<<<<<< HEAD
# Invoice AI Platform

A comprehensive AI-powered invoice processing platform built with React, TypeScript, Supabase, and Google Gemini AI. Features real OCR extraction with Tesseract.js, advanced fraud detection, tax compliance, and intelligent chatbot assistance.

## 🚀 Features

- **Real AI Processing**: Tesseract.js OCR + Google Gemini AI field extraction
- **Smart Analytics**: Real-time dashboard with insights and trends
- **Fraud Detection**: Advanced algorithms for risk assessment
- **Tax Compliance**: Multi-region support (EU VAT, ZATCA, UAE FTA)
- **AI Chatbot**: Google Gemini-powered assistant for invoice queries
- **Secure Authentication**: Supabase Auth with Google OAuth
- **Responsive Design**: Mobile-first UI with dark/light theme

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express.js, Supabase
- **Database**: PostgreSQL (Supabase)
- **AI/ML**: Google Gemini AI, Tesseract.js OCR
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Deployment**: Railway

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Google Gemini API key

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd invoice-ai-platform
npm install
```

### 2. Environment Setup
Create `.env` file:
```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key

# For production deployment
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://your-app.railway.app
NODE_ENV=production
```

### 3. Database Setup
1. Go to Supabase SQL Editor
2. Run the migration: `supabase/migrations/create_invoice_tables.sql`
3. Create storage bucket named "invoices" (make it public)

### 4. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Configure in Supabase Auth settings

### 5. Get API Keys

**Supabase Keys** (Project Settings → API):
- Project URL
- Anon public key
- Service role key (for backend)

**Google Gemini API Key**:
- Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
- Create API key

### 6. Development
```bash
# Frontend development
npm run dev

# Production build
npm run build
npm start
```

## 🚂 Railway Deployment

### Step 1: Prepare Repository
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### Step 2: Deploy to Railway
1. Go to [Railway](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect and deploy

### Step 3: Environment Variables
Add these in Railway dashboard:
```bash
NODE_ENV=production
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://your-app.railway.app
```

### Step 4: Update URLs
After deployment, update:
- Google OAuth redirect URLs
- Supabase Auth site URL
- CORS origins in your app

## 📁 Project Structure

```
invoice-ai-platform/
├── src/
│   ├── components/          # React components
│   ├── contexts/           # React contexts
│   ├── lib/               # Utilities and services
│   └── types/             # TypeScript types
├── supabase/
│   └── migrations/        # Database migrations
├── server.js              # Express.js backend
├── railway.json           # Railway configuration
└── package.json           # Dependencies
```

## 🔧 Configuration

### Frontend Environment Variables
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
```

### Backend Environment Variables
```bash
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://your-app.railway.app
```

## 🧪 Testing

### Test Invoice Processing
1. Upload a PDF or image invoice
2. Watch real-time AI processing
3. Check extracted data in dashboard
4. Test AI chatbot queries

### API Testing
- Health check: `https://your-app.railway.app/api/health`
- API docs: `https://your-app.railway.app/api-docs`

## 🚨 Troubleshooting

### Common Issues

**Build Failures**
- Check Node.js version (18+)
- Verify environment variables
- Check for missing dependencies

**Authentication Issues**
- Verify OAuth redirect URLs
- Check Supabase Auth configuration
- Ensure environment variables are correct

**AI Processing Issues**
- Verify Gemini API key
- Check API quotas and billing
- Monitor browser console for errors

## 📞 Support

- Check browser console for errors
- Verify all environment variables
- Test API endpoints directly
- Check Railway deployment logs

## 🔗 Links

- **Railway**: [railway.app](https://railway.app)
- **Supabase**: [supabase.com](https://supabase.com)
- **Google AI Studio**: [makersuite.google.com](https://makersuite.google.com)

---

Built with ❤️ using React, TypeScript, Supabase, Google Gemini AI, and Tesseract.js
=======
# Invoice-AI-MVP
AI-powered invoice processing platform with OCR, fraud detection and chatbot.
>>>>>>> 6b40315181b5eb9c68b209df2207d723cf3e1afa
