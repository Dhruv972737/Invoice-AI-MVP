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
- Node.js 20.0.0+
- NPM 10.0.0+
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
# Check Node.js version (must be 20+)
node --version
npm --version

# Frontend development
npm run dev

# Production build
npm run build
npm start
```

## 🚀 Deployment

### Deployment (Netlify)

1. **Push to GitHub:**
```bash
git add .
git commit -m "Ready for Netlify deployment"
git push origin main
```

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Select your GitHub repository
   - Build settings are configured in `netlify.toml`

3. **Add Environment Variables in Netlify:**
```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
```


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
├── netlify.toml           # Netlify configuration
└── package.json           # Dependencies
```

## 🔧 Configuration

### Environment Variables
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
```


## 🧪 Testing

### URLs


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

- **Netlify**: [netlify.com](https://netlify.com)
- **Supabase**: [supabase.com](https://supabase.com)
- **Google AI Studio**: [makersuite.google.com](https://makersuite.google.com)

---

=======
# Invoice-AI-MVP
AI-powered invoice processing platform with OCR, fraud detection and chatbot.
>>>>>>> 6b40315181b5eb9c68b209df2207d723cf3e1afa
