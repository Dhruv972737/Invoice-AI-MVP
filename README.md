# Invoice AI MVP

AI-powered invoice processing platform with OCR extraction, fraud detection, and intelligent chatbot assistance.

## Features

- **Multi-AI Provider System**: Free daily tokens from Gemini, OpenAI, and DeepSeek with intelligent routing
- **AI-Powered OCR**: Extract invoice data using multiple AI providers
- **Fraud Detection**: Automated risk assessment for invoices
- **Multi-language Support**: English, Arabic, German with automatic detection
- **Smart Analytics**: Real-time dashboard with spending insights
- **AI Chatbot**: Natural language queries powered by multi-provider routing
- **Secure Authentication**: Google OAuth integration via Supabase
- **Stripe Payments**: Membership plans when free tokens run low
- **File Management**: Upload PDF/Image invoices with secure storage

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Supabase Client

**Backend:**
- FastAPI (Python)
- Supabase (PostgreSQL + Auth + Storage)
- Google Gemini AI API
- Tesseract OCR

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Supabase account (free tier)
- Google Gemini API key

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd Invoice-AI-MVP-main
```

### 2. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd backend/fastapi
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Setup

Create `.env` in project root:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Gemini AI
VITE_GEMINI_API_KEY=your-gemini-api-key

# Backend URL
VITE_BACKEND_URL=http://localhost:10000
```

Create `.env` in `backend/fastapi/`:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI
GEMINI_API_KEY=your-gemini-api-key

# Server
FRONTEND_URL=http://localhost:5173
PORT=10000
```

### 4. Database Setup

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run `supabase/migrations/00_complete_database_setup.sql`
4. Create storage bucket named "invoices" (make it public)
5. Enable Google OAuth in Authentication → Providers

### 5. Run Application

**Terminal 1 - Frontend:**
```bash
npm run dev
```
Open http://localhost:5173

**Terminal 2 - Backend:**
```bash
cd backend/fastapi
source .venv/bin/activate
./start_backend_properly.sh
```
Or manually:
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 10000
```

## Project Structure

```
Invoice-AI-MVP-main/
├── src/
│   ├── components/          # React components
│   │   ├── auth/           # Authentication
│   │   ├── chat/           # AI Chatbot
│   │   ├── dashboard/      # Dashboard & Admin
│   │   ├── invoice/        # Invoice management
│   │   ├── analytics/      # Analytics
│   │   └── settings/       # User settings
│   ├── contexts/           # React contexts (Auth, Theme, Toast, Tokens)
│   ├── lib/                # Utilities
│   │   ├── ai/             # AI services (OCR, Gemini, fraud detection)
│   │   └── supabase.ts     # Supabase client
│   └── types/              # TypeScript types
├── backend/fastapi/        # Python FastAPI backend
│   ├── main.py            # Main server
│   ├── invoice_processor.py # OCR processing
│   └── requirements.txt   # Python dependencies
├── supabase/
│   └── migrations/        # Database migrations
│       └── 00_complete_database_setup.sql  # Complete DB setup
└── README.md              # This file
```

## Configuration

### Required API Keys

1. **Supabase**:
   - Go to Project Settings → API
   - Copy Project URL and Anon Key (for frontend)
   - Copy Service Role Key (for backend)

2. **Google Gemini AI**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create API key
   - Add to environment variables

3. **Google OAuth** (for login):
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Configure in Supabase → Authentication → Providers → Google

### Optional API Keys

**Additional AI Providers** (for more free daily tokens):
- OpenAI ChatGPT: Add `VITE_OPENAI_API_KEY`
- DeepSeek: Add `VITE_DEEPSEEK_API_KEY`

**Stripe** (for paid memberships after 10% free token usage):
- Add `VITE_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`

See `SETUP.md` for:
- Multi-AI provider setup
- Stripe payment integration
- Google Drive integration
- Email ingestion (IMAP)
- Tax compliance APIs (ZATCA, UAE FTA)
- Monitoring (Prometheus, Grafana)

## Usage

### Upload Invoice

1. Sign in with Google
2. Go to "Invoice Upload"
3. Drag & drop or select PDF/Image files
4. Wait for AI processing
5. View extracted data in "Invoice List"

### AI Chatbot

Ask natural language questions:
- "Show me high-risk invoices"
- "What's my total spending this month?"
- "Who are my top vendors?"

### Analytics

- View monthly spending trends
- Vendor breakdown
- Risk assessment
- Export data as CSV/JSON

## Troubleshooting

### Frontend won't load / Infinite spinner

**Fix:** Check browser console for errors. Common causes:
- Missing environment variables
- Supabase connection issues
- Run both SQL fixes if you see profile errors

### Invoice upload fails with 500 error

**Fix:** Database setup incomplete
1. Run `supabase/migrations/00_complete_database_setup.sql` in Supabase SQL Editor
2. Refresh browser
3. Try uploading again

### OCR not extracting data

**Fix:** Check backend logs
- Verify Gemini API key is correct
- Check API quota at [Google AI Studio](https://makersuite.google.com/)
- Ensure backend is running on port 10000

### "Google Drive Not Configured" error

This is optional. See `SETUP.md` for Google Drive integration guide.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: See `SETUP.md` for detailed setup guides
- **Supabase**: [Supabase Docs](https://supabase.com/docs)
- **Gemini AI**: [Google AI Docs](https://ai.google.dev/)

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Google Gemini AI for intelligent processing
- Supabase for backend infrastructure
- Tesseract.js for OCR capabilities
- React and Vite communities

---

**Built with React, TypeScript, FastAPI, Supabase, and Google Gemini AI**
