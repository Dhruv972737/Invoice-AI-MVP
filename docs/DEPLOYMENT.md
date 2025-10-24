# 🚀 Deployment Guide - Invoice AI Platform

Complete deployment guide for the Invoice AI Platform with step-by-step instructions for both frontend and backend deployment.

## 🏗️ **Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Netlify)     │◄──►│   (Render)      │◄──►│   (Supabase)    │
│                 │    │                 │    │                 │
│ React + Vite    │    │ Node.js + API   │    │ PostgreSQL      │
│ Tailwind CSS    │    │ Health Checks   │    │ Auth + Storage  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 **Prerequisites**

### **Required Accounts**
- [GitHub](https://github.com) - Code repository
- [Netlify](https://netlify.com) - Frontend hosting
- [Render](https://render.com) - Backend hosting
- [Supabase](https://supabase.com) - Database and authentication
- [Google Cloud Console](https://console.cloud.google.com) - Gemini AI API

### **Required Tools**
- Node.js 20.0.0+ (specified in `.nvmrc`)
- Git for version control
- Code editor (VS Code recommended)

## 🗄️ **Database Setup (Supabase)**

### **1. Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and set project details:
   - **Name**: `invoice-ai-platform`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your users

### **2. Database Schema Setup**
1. Go to **SQL Editor** in Supabase dashboard
2. Create new query and paste content from:
   ```
   supabase/migrations/20250925235744_wandering_hill.sql
   ```
3. Click **Run** to execute the migration
4. Verify tables are created in **Table Editor**

### **3. Storage Setup**
1. Go to **Storage** in Supabase dashboard
2. Create new bucket:
   - **Name**: `invoices`
   - **Public**: ✅ Enabled
   - **File size limit**: 10MB
   - **Allowed MIME types**: `image/*,application/pdf`

### **4. Authentication Setup**
1. Go to **Authentication** → **Settings**
2. Configure **Site URL**: `https://your-app.netlify.app`
3. Add **Redirect URLs**:
   ```
   https://your-app.netlify.app
   https://your-app.netlify.app/**
   ```

### **5. Google OAuth Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen
6. Add authorized redirect URIs:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
7. Copy **Client ID** and **Client Secret**
8. In Supabase: **Authentication** → **Providers** → **Google**
   - Enable Google provider
   - Add Client ID and Client Secret

### **6. Get API Keys**
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (VITE_SUPABASE_URL)
   - **Anon public key** (VITE_SUPABASE_ANON_KEY)
   - **Service role key** (SUPABASE_SERVICE_ROLE_KEY)

## 🤖 **AI Setup (Google Gemini)**

### **1. Get Gemini API Key**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **Create API Key**
3. Select your Google Cloud project
4. Copy the generated API key (VITE_GEMINI_API_KEY)

### **2. Configure API Quotas**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Quotas**
3. Search for "Generative Language API"
4. Review and adjust quotas if needed

## 🖥️ **Backend Deployment (Render)**

### **1. Prepare Repository**
Ensure your code is pushed to GitHub:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### **2. Create Render Service**
1. Go to [render.com](https://render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure service:
   - **Name**: `invoice-ai-backend`
   - **Environment**: `Node`
   - **Region**: `Oregon (US West)` (recommended)
   - **Branch**: `main`
   - **Build Command**: `npm install --production`
   - **Start Command**: `npm start`

### **3. Configure Environment Variables**
Add these in Render dashboard:
```bash
NODE_ENV=production
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://your-app.netlify.app
```

### **4. Configure Health Check**
- **Health Check Path**: `/api/health`
- **Health Check Grace Period**: `300` seconds

### **5. Deploy and Verify**
1. Click **Create Web Service**
2. Wait for deployment (2-5 minutes)
3. Check logs for success messages:
   ```
   ✅ Render Server running on 0.0.0.0:10000
   🎯 Server started successfully with Node.js v20.17.0!
   ```
4. Test endpoints:
   - Health: `https://your-service.onrender.com/api/health`
   - API Docs: `https://your-service.onrender.com/api-docs`

## 🌐 **Frontend Deployment (Netlify)**

### **1. Prepare for Deployment**
Update `netlify.toml` with your backend URL:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-backend.onrender.com/api/:splat"
  status = 200
  force = true
```

### **2. Deploy to Netlify**
1. Go to [netlify.com](https://netlify.com)
2. Click **New site from Git**
3. Choose **GitHub** and select your repository
4. Configure build settings:
   - **Build command**: `npm run build` (auto-detected)
   - **Publish directory**: `dist` (auto-detected)
   - **Production branch**: `main`

### **3. Configure Environment Variables**
In Netlify dashboard → **Site settings** → **Environment variables**:
```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### **4. Configure Domain**
1. **Site settings** → **Domain management**
2. **Add custom domain** (optional)
3. Configure DNS settings if using custom domain

### **5. Deploy and Verify**
1. Trigger deployment or wait for auto-deploy
2. Check build logs for success
3. Test the deployed application
4. Verify all features work correctly

## 🔧 **Post-Deployment Configuration**

### **1. Update Supabase Settings**
Update redirect URLs in Supabase with your actual Netlify URL:
```
https://your-actual-app.netlify.app
https://your-actual-app.netlify.app/**
```

### **2. Update Environment Variables**
Update `FRONTEND_URL` in Render with your actual Netlify URL:
```bash
FRONTEND_URL=https://your-actual-app.netlify.app
```

### **3. Test Complete Flow**
1. **Authentication**: Test login/signup
2. **File Upload**: Upload sample invoice
3. **AI Processing**: Verify OCR and extraction
4. **Chatbot**: Test AI responses
5. **Analytics**: Check dashboard data

## 📊 **Monitoring Setup**

### **1. Render Monitoring**
- **Metrics**: CPU, memory, response time
- **Logs**: Real-time application logs
- **Alerts**: Set up downtime notifications

### **2. Netlify Monitoring**
- **Analytics**: Page views, performance
- **Forms**: Contact form submissions
- **Functions**: Serverless function metrics

### **3. Supabase Monitoring**
- **Database**: Query performance, storage usage
- **Auth**: User registrations, login attempts
- **Storage**: File uploads, bandwidth usage

## 🚨 **Troubleshooting**

### **Common Deployment Issues**

#### **Backend (Render)**
```bash
# Build failures
Error: Module not found
Solution: Check package.json dependencies

# Environment variables
Error: SUPABASE_URL not defined
Solution: Add environment variables in Render dashboard

# Health check failures
Error: Health check timeout
Solution: Verify /api/health endpoint responds quickly
```

#### **Frontend (Netlify)**
```bash
# Build failures
Error: Command failed with exit code 1
Solution: Check build logs, verify Node.js version

# Environment variables
Error: VITE_SUPABASE_URL is not defined
Solution: Add environment variables in Netlify dashboard

# Routing issues
Error: Page not found on refresh
Solution: Verify netlify.toml redirects configuration
```

#### **Database (Supabase)**
```bash
# Connection issues
Error: Invalid API key
Solution: Verify environment variables match Supabase dashboard

# RLS policy errors
Error: Row level security policy violation
Solution: Check RLS policies in Supabase dashboard

# Storage issues
Error: Storage bucket not found
Solution: Create "invoices" bucket and make it public
```

### **Performance Optimization**

#### **Frontend**
- Enable Netlify's asset optimization
- Configure proper caching headers
- Optimize images and assets
- Use code splitting for large bundles

#### **Backend**
- Monitor memory usage in Render
- Optimize database queries
- Implement proper error handling
- Use connection pooling for database

#### **Database**
- Monitor query performance
- Add indexes for frequently queried columns
- Optimize RLS policies
- Regular database maintenance

## 🔄 **CI/CD Pipeline**

### **Automatic Deployments**
Both Netlify and Render support automatic deployments:

1. **Push to main branch** → **Auto-deploy to production**
2. **Pull request** → **Deploy preview** (Netlify only)
3. **Environment-specific branches** → **Deploy to staging**

### **Deployment Workflow**
```bash
# Development
git checkout -b feature/new-feature
# Make changes
git commit -m "Add new feature"
git push origin feature/new-feature

# Create pull request → Netlify deploy preview

# Merge to main → Auto-deploy to production
git checkout main
git merge feature/new-feature
git push origin main
```

## 📈 **Scaling Considerations**

### **Traffic Growth**
- **Render**: Upgrade to paid plan for better performance
- **Netlify**: Automatic CDN scaling included
- **Supabase**: Monitor database connections and upgrade if needed

### **Storage Growth**
- **Supabase Storage**: Monitor file storage usage
- **Database**: Regular cleanup of old data
- **Logs**: Implement log rotation

### **API Limits**
- **Google Gemini**: Monitor API usage and quotas
- **Supabase**: Track database and auth usage
- **Render**: Monitor bandwidth and compute usage

## 📞 **Support Resources**

### **Documentation**
- [Render Docs](https://render.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [Supabase Docs](https://supabase.com/docs)

### **Community Support**
- [Render Community](https://community.render.com)
- [Netlify Community](https://community.netlify.com)
- [Supabase Discord](https://discord.supabase.com)

### **Status Pages**
- [Render Status](https://status.render.com)
- [Netlify Status](https://www.netlifystatus.com)
- [Supabase Status](https://status.supabase.com)

---

## ✅ **Deployment Checklist**

### **Pre-Deployment**
- [ ] Code pushed to GitHub
- [ ] Environment variables documented
- [ ] Database migration tested
- [ ] API keys obtained
- [ ] Domain name ready (optional)

### **Database Setup**
- [ ] Supabase project created
- [ ] Database schema deployed
- [ ] Storage bucket configured
- [ ] Authentication providers enabled
- [ ] RLS policies tested

### **Backend Deployment**
- [ ] Render service created
- [ ] Environment variables configured
- [ ] Health check endpoint working
- [ ] API documentation accessible
- [ ] Logs showing successful startup

### **Frontend Deployment**
- [ ] Netlify site created
- [ ] Build configuration correct
- [ ] Environment variables set
- [ ] Custom domain configured (optional)
- [ ] All pages loading correctly

### **Post-Deployment Testing**
- [ ] User registration/login working
- [ ] File upload and processing working
- [ ] AI features functioning
- [ ] Database operations successful
- [ ] Error handling working
- [ ] Performance acceptable

### **Monitoring Setup**
- [ ] Health check monitoring enabled
- [ ] Error tracking configured
- [ ] Performance monitoring active
- [ ] Backup strategy implemented
- [ ] Alert notifications configured

---

**Deployment completed successfully! 🎉**

Your Invoice AI Platform is now live and ready for users.