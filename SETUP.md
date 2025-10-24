# Invoice AI MVP - Setup Guide

Complete setup guide for all features including optional integrations.

---

## Table of Contents

1. [Quick Setup (Required)](#quick-setup-required)
2. [Google Drive Integration (Optional)](#google-drive-integration-optional)
3. [Optional Environment Variables](#optional-environment-variables)
4. [Deployment Guide](#deployment-guide)
5. [Troubleshooting](#troubleshooting)

---

## Quick Setup (Required)

### 1. Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Supabase account (free tier)
- Google Gemini API key

### 2. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd backend/fastapi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Get API Keys

#### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API:
   - Copy **Project URL** (`https://xxx.supabase.co`)
   - Copy **anon public** key (for frontend)
   - Copy **service_role** key (for backend)

3. Go to SQL Editor:
   - Run `supabase/migrations/00_complete_database_setup.sql`

4. Go to Storage:
   - Create bucket named **invoices**
   - Make it public

5. Go to Authentication → Providers:
   - Enable Google provider
   - Add Client ID and Secret (see below)

#### Google Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the key

#### Google OAuth (for Login)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Go to APIs & Services → Credentials
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add authorized redirect URI:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
7. Copy Client ID and Client Secret
8. Add them to Supabase Authentication → Providers → Google

### 4. Environment Variables

Create `.env` in project root:

```bash
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# AI (Required)
VITE_GEMINI_API_KEY=your-gemini-api-key

# Backend (Required)
VITE_BACKEND_URL=http://localhost:10000
```

Create `.env` in `backend/fastapi/`:

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI (Required)
GEMINI_API_KEY=your-gemini-api-key

# Server (Required)
FRONTEND_URL=http://localhost:5173
PORT=10000
```

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

---

## Google Drive Integration (Optional)

Enable users to import invoices directly from Google Drive.

### Prerequisites

- Google Cloud project (same one you used for Gemini API is fine)

### Step 1: Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your existing project
3. Go to APIs & Services → Library
4. Search and enable:
   - **Google Drive API**
   - **Google Picker API**

### Step 2: Configure OAuth Consent Screen

1. Go to APIs & Services → OAuth consent screen
2. Choose **External**
3. Fill in:
   - App name: **Invoice AI**
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. Add scopes:
   - Click **Add or Remove Scopes**
   - Select: `https://www.googleapis.com/auth/drive.readonly`
   - Click **Update**
6. Add test users: Your email addresses
7. Click **Save and Continue**

### Step 3: Create OAuth Credentials

1. Go to APIs & Services → Credentials
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Name: **Invoice AI Web Client**
5. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `http://localhost:10000`
6. Authorized redirect URIs:
   - `http://localhost:5173`
   - `http://localhost:10000/auth/google/callback`
7. Click **Create**
8. **Copy Client ID and Client Secret**

### Step 4: Create API Key

1. Still in Credentials page
2. Click **Create Credentials** → **API key**
3. Copy the API key
4. Click **Edit** (pencil icon)
5. Under **API restrictions**:
   - Select **Restrict key**
   - Check: Google Drive API, Google Picker API
6. Under **Website restrictions**:
   - Select **HTTP referrers**
   - Add: `http://localhost:5173/*`
7. Click **Save**

### Step 5: Add to Environment Variables

**Frontend `.env`:**
```bash
# Add these lines
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
```

**Backend `backend/fastapi/.env`:**
```bash
# Add these lines
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_API_KEY=your-api-key
GOOGLE_REDIRECT_URI=http://localhost:10000/auth/google/callback
```

### Step 6: Install Frontend Dependency

```bash
npm install gapi-script
```

### Step 7: Restart Services

```bash
# Restart frontend
npm run dev

# Restart backend
cd backend/fastapi
./start_backend_properly.sh
```

### Step 8: Test

1. Go to http://localhost:5173
2. Navigate to Invoice Upload
3. Click **Google Drive** button
4. Sign in with Google
5. Grant permissions (you'll see "App not verified" - this is normal for development)
6. Select invoice files from Drive
7. Watch them import and process!

---

## Optional Environment Variables

These features are optional. The app works perfectly without them.

### Tax Compliance APIs

For automatic tax authority validation in Saudi Arabia or UAE.

**When to use:**
- You have customers in Saudi Arabia or UAE
- Need automatic tax compliance validation

**Setup:**
1. Register business with [ZATCA](https://zatca.gov.sa/) (Saudi) or [UAE FTA](https://www.tax.gov.ae/)
2. Apply for API access
3. Get API credentials

**Add to `backend/fastapi/.env`:**
```bash
ZATCA_API_KEY=your-zatca-api-key
ZATCA_SECRET=your-zatca-secret
UAE_FTA_API_KEY=your-uae-fta-api-key
UAE_FTA_SECRET=your-uae-fta-secret
```

### Email Ingestion (IMAP)

Auto-import invoices from email inbox.

**When to use:**
- Receive many invoices by email
- Want fully automated import

**Setup:**
1. Enable Gmail App Password: https://myaccount.google.com/apppasswords
2. Generate app password

**Add to `backend/fastapi/.env`:**
```bash
IMAP_SERVER=imap.gmail.com
IMAP_PORT=993
IMAP_USE_SSL=true
IMAP_EMAIL=your-email@gmail.com
IMAP_PASSWORD=your-16-char-app-password
```

### PayPal Integration

Allow users to pay invoices through your app.

**When to use:**
- Want payment processing
- Need invoice payment tracking

**Setup:**
1. Create PayPal Developer account: https://developer.paypal.com/
2. Create app in dashboard
3. Get Client ID and Secret

**Add to `backend/fastapi/.env`:**
```bash
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox  # Use 'live' for production
```

### Additional AI Providers

Add alternatives to Gemini AI.

**When to use:**
- Want fallback if Gemini is down
- Need cost optimization
- Compare accuracy

**Setup:**

**OpenAI:**
1. Go to https://platform.openai.com/api-keys
2. Create API key

**DeepSeek:**
1. Go to https://www.deepseek.com/
2. Sign up for API access
3. Get API key

**Add to `.env`:**
```bash
VITE_OPENAI_API_KEY=sk-...
VITE_DEEPSEEK_API_KEY=...
```

### Monitoring (Prometheus/Grafana)

Advanced performance monitoring.

**When to use:**
- Production deployment
- High traffic
- Need detailed metrics

**Setup:**
```bash
# macOS
brew install prometheus grafana

# Start services
prometheus --config.file=prometheus.yml
grafana-server
```

**Add to `backend/fastapi/.env`:**
```bash
PROMETHEUS_ENABLED=true
GRAFANA_URL=http://localhost:3000
```

---

## Deployment Guide

### Frontend Deployment (Netlify)

1. **Connect Repository:**
   - Go to [netlify.com](https://netlify.com)
   - New site from Git
   - Select repository

2. **Build Settings** (already in `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `20`

3. **Environment Variables:**
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GEMINI_API_KEY=your-gemini-key
   VITE_BACKEND_URL=https://your-backend.onrender.com
   ```

4. **Deploy!**

### Backend Deployment (Render)

1. **Create Web Service:**
   - Go to [render.com](https://render.com)
   - New → Web Service
   - Connect repository

2. **Settings:**
   - Build Command: `cd backend/fastapi && pip install -r requirements.txt`
   - Start Command: `cd backend/fastapi && python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/api/health`

3. **Environment Variables:**
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   GEMINI_API_KEY=your-gemini-key
   FRONTEND_URL=https://your-frontend.netlify.app
   PORT=10000
   ```

4. **Deploy!**

### Update OAuth Redirect URIs

After deployment, update redirect URIs:

1. **Google OAuth:**
   - Add: `https://your-project.supabase.co/auth/v1/callback`
   - Add: `https://your-frontend.netlify.app`

2. **Supabase Auth:**
   - Go to Authentication → URL Configuration
   - Add Site URL: `https://your-frontend.netlify.app`
   - Add Redirect URLs: `https://your-frontend.netlify.app/**`

---

## Troubleshooting

### "Google Drive Not Configured"

**Cause:** Missing Google Drive API credentials

**Fix:**
1. Complete [Google Drive Integration](#google-drive-integration-optional) steps
2. Add `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` to `.env`
3. Restart frontend: `npm run dev`

### "Infinite recursion in policy for relation 'profiles'"

**Cause:** RLS policies issue

**Fix:**
1. Go to Supabase SQL Editor
2. Run `supabase/migrations/00_complete_database_setup.sql`
3. This drops old policies and creates new non-recursive ones
4. Refresh browser

### Invoice upload returns 500 error

**Cause:** Missing `subscription_status` column

**Fix:**
1. Run `supabase/migrations/00_complete_database_setup.sql` in Supabase SQL Editor
2. Refresh browser
3. Try upload again

### OCR not extracting text

**Cause:** Gemini API issue

**Fix:**
1. Check API key is correct in `.env`
2. Verify quota at [Google AI Studio](https://makersuite.google.com/)
3. Check backend logs for errors
4. Ensure Gemini model is `gemini-2.5-flash` (not deprecated `gemini-pro`)

### Frontend infinite loading

**Cause:** Token context errors

**Fix:**
1. Check browser console for errors
2. Verify database tables exist (run migration)
3. Check Supabase connection
4. Clear browser cache: Cmd+Shift+R

### Backend won't start

**Cause:** Missing Python dependencies or environment variables

**Fix:**
```bash
cd backend/fastapi
source .venv/bin/activate
pip install -r requirements.txt

# Check environment variables
cat .env | grep SUPABASE_URL
cat .env | grep GEMINI_API_KEY

# Start manually to see errors
python -m uvicorn main:app --host 0.0.0.0 --port 10000
```

### "App not verified" warning (Google Drive)

**This is normal for development!**

**What to do:**
- Click "Advanced"
- Click "Go to Invoice AI (unsafe)" - It's your app, it's safe
- For production, submit app for Google verification

---

## Database Schema

The complete database schema is in `supabase/migrations/00_complete_database_setup.sql`.

**Tables:**
- `profiles` - User profiles and subscription info
- `subscription_plans` - Available subscription tiers
- `user_tokens` - Token usage tracking
- `invoices` - Invoice data and extracted fields
- `ai_provider_usage` - AI API usage tracking

**Functions:**
- `is_user_admin()` - Check admin status (avoids RLS recursion)
- `handle_new_user()` - Auto-create profile for new users
- `protect_profile_fields()` - Prevent non-admins from changing sensitive fields

**Triggers:**
- Auto-create profiles when users sign up
- Protect sensitive fields from unauthorized changes
- Update `updated_at` timestamps

---

## Support

- **GitHub Issues:** Report bugs or request features
- **Supabase Docs:** https://supabase.com/docs
- **Gemini AI Docs:** https://ai.google.dev/
- **FastAPI Docs:** https://fastapi.tiangolo.com/

---

## Security Notes

### Development

✅ **OK to:**
- Use localhost URLs
- See "App not verified" warnings
- Add yourself as test user

❌ **Don't:**
- Commit `.env` files to git
- Share service role keys
- Use development keys in production

### Production

When deploying:
1. Update all OAuth redirect URIs to production URLs
2. Use production API keys (not test keys)
3. Enable HTTPS only
4. Submit Google OAuth app for verification
5. Set up monitoring and logging

---

**Need help?** Check the main [README.md](README.md) or open an issue on GitHub.
