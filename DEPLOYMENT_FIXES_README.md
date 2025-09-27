# Render Deployment Guide - Invoice AI Platform

This document provides step-by-step instructions for deploying the Invoice AI platform backend to Render.

## Overview

We've migrated from Railway to Render for better reliability and easier deployment process.

---

## 🚀 Render Deployment Steps

### Step 1: Prepare Repository

```bash
# Make sure all changes are committed
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (recommended)
3. Authorize Render to access your repositories

### Step 3: Create Web Service

1. **Click "New +" → "Web Service"**
2. **Connect Repository**: Select your `invoice-ai-platform` repository
3. **Configure Service**:
   - **Name**: `invoice-ai-backend`
   - **Environment**: `Node`
   - **Region**: `Oregon (US West)` (recommended)
   - **Branch**: `main`
   - **Build Command**: `npm install --production`
   - **Start Command**: `npm start`

### Step 4: Configure Health Check

- **Health Check Path**: `/api/health`
- **Health Check Grace Period**: `300` seconds

### Step 5: Set Environment Variables

Add these environment variables in Render dashboard:

```bash
NODE_ENV=production
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://invoice-ai-mvp.netlify.app
```

**Where to find these values:**
- `SUPABASE_URL`: Supabase Project Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Project Settings → API → Service Role Key
- `FRONTEND_URL`: Your Netlify app URL

### Step 6: Deploy

1. **Click "Create Web Service"**
2. **Wait for deployment** (usually 2-5 minutes)
3. **Check logs** for successful startup messages

---

## ✅ Verification Steps

### 1. Check Deployment Logs

Look for these success messages:
```
✅ Render Server running on 0.0.0.0:10000
🎯 Server started successfully with Node.js v20.17.0!
🏥 Health Check: http://0.0.0.0:10000/api/health
```

### 2. Test API Endpoints

Once deployed, test these URLs (replace with your actual service URL):

```bash
# Health Check
https://invoice-ai-backend.onrender.com/api/health

# Test Endpoint
https://invoice-ai-backend.onrender.com/api/test

# Root Endpoint
https://invoice-ai-backend.onrender.com/
```

### 3. Expected Responses

**Health Check Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "version": "1.0.0",
  "platform": "Render",
  "environment": "production"
}
```

---

## 🔧 Configuration Files

### render.yaml
```yaml
services:
  - type: web
    name: invoice-ai-backend
    env: node
    plan: free
    buildCommand: npm install --production
    startCommand: npm start
    healthCheckPath: /api/health
```

### Updated netlify.toml
```toml
# API proxy to Render backend
[[redirects]]
  from = "/api/*"
  to = "https://invoice-ai-backend.onrender.com/api/:splat"
  status = 200
  force = true
```

---

## 🚨 Troubleshooting

### Common Issues

**1. Build Failures**
- Check Node.js version in logs (should be 18+)
- Verify `package.json` has correct dependencies
- Check build command: `npm install --production`

**2. Health Check Failures**
- Ensure `/api/health` endpoint is accessible
- Check server is binding to `0.0.0.0:PORT`
- Verify environment variables are set

**3. Environment Variable Issues**
- Double-check all required variables are set
- Ensure no typos in variable names
- Verify Supabase keys are correct

**4. CORS Issues**
- Frontend URL should match exactly
- Check CORS configuration in server.js
- Verify Netlify redirects are working

### Debug Commands

```bash
# Check if service is responding
curl https://your-service.onrender.com/api/health

# Check specific endpoint
curl https://your-service.onrender.com/api/test
```

---

## 🔄 Auto-Deploy Setup

Render automatically deploys when you push to the `main` branch. To trigger a new deployment:

```bash
git add .
git commit -m "Update backend"
git push origin main
```

---

## 📊 Monitoring

### Render Dashboard Features:
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, and request metrics
- **Events**: Deployment history and events
- **Settings**: Environment variables and configuration

### Key Metrics to Monitor:
- **Response Time**: Should be < 1000ms
- **Error Rate**: Should be < 1%
- **Memory Usage**: Should stay under 512MB
- **CPU Usage**: Should stay under 50%

---

## 🎯 Next Steps

1. **Update Frontend**: Make sure Netlify redirects point to your new Render URL
2. **Test Integration**: Verify frontend can communicate with backend
3. **Monitor Performance**: Check Render dashboard for any issues
4. **Set Up Alerts**: Configure notifications for downtime

---

## 📞 Support

If you encounter issues:

1. **Check Render Logs**: Most issues show up in the deployment logs
2. **Verify Environment Variables**: Ensure all required variables are set
3. **Test Endpoints**: Use curl or browser to test API directly
4. **Check Supabase**: Verify database connection and permissions

**Render Documentation**: [render.com/docs](https://render.com/docs)

---

Good luck with your Render deployment! 🚀