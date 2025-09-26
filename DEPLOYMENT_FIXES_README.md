# Railway Deployment Fixes - Implementation Guide

This document provides step-by-step instructions for implementing the fixes needed to resolve Railway deployment issues and refresh token errors.

## Overview of Issues Fixed

1. **Railway Health Check Failures** - Server not starting properly
2. **Environment Variable Validation** - Missing Supabase configuration checks
3. **Static File Serving** - Frontend files not served correctly in production
4. **Refresh Token Errors** - Invalid authentication tokens causing crashes
5. **Debugging** - Added comprehensive logging for troubleshooting

---

## File Changes Required

### 1. **server.js** - Server Configuration Fixes

#### Location: Root directory (`./server.js`)

**Changes to make:**

#### A. Add Environment Variable Validation (Lines 15-25)
Replace the existing Supabase configuration section with:

```javascript
// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}
```

#### B. Enhanced Static File Serving (Around line 60)
Replace the existing static file serving section with:

```javascript
// Serve static files from dist directory
if (process.env.NODE_ENV === 'production') {
  console.log('Production mode: serving static files from dist directory');
  console.log('Dist directory exists:', require('fs').existsSync(path.join(__dirname, 'dist')));
  app.use(express.static(path.join(__dirname, 'dist')));
}
```

#### C. Improved Catch-All Route (Near the end, before error handling)
Replace the existing catch-all route with:

```javascript
// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Serving index.html from:', indexPath);
    console.log('Index.html exists:', require('fs').existsSync(indexPath));
    res.sendFile(indexPath);
  });
}
```

#### D. Enhanced Startup Logging (Replace the final app.listen section)
Replace the existing `app.listen` with:

```javascript
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🏥 Health Check: http://${HOST}:${PORT}/api/health`);
  console.log(`📁 Working Directory: ${__dirname}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📊 Supabase URL: ${supabaseUrl ? 'Configured' : 'Missing'}`);
});
```

---

### 2. **package.json** - Start Script Fix

#### Location: Root directory (`./package.json`)

**Change to make:**

In the `scripts` section, update the start command:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "start": "NODE_ENV=production node server.js"
  }
}
```

**What changed:** Added `NODE_ENV=production` before `node server.js`

---

### 3. **src/App.tsx** - Refresh Token Error Handling

#### Location: `./src/App.tsx`

**Changes to make:**

#### A. Replace the useEffect hook (around lines 10-40)
Find the existing `useEffect` and replace it with:

```javascript
useEffect(() => {
  // Check Supabase configuration
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.error('Supabase environment variables are missing!');
    setLoading(false);
    return;
  }
  
  // Get initial session with refresh token error handling
  const initializeSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        // Handle refresh token errors by clearing invalid session
        if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
          await supabase.auth.signOut();
          setUser(null);
        } else {
          console.error('Supabase connection error:', error);
        }
      } else {
        setUser(session?.user ?? null);
      }
    } catch (error) {
      console.error('Failed to connect to Supabase:', error);
      // Clear any potentially corrupted session data
      await supabase.auth.signOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  
  initializeSession();

  // Listen for auth changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null);
    
    // Handle OAuth success
    if (event === 'SIGNED_IN' && session?.user) {
      console.log('User signed in:', session.user.email);
    }
    
    // Handle OAuth errors
    if (event === 'SIGNED_OUT') {
      console.log('User signed out');
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

---

### 4. **src/contexts/AuthContext.tsx** - Auth Context Error Handling

#### Location: `./src/contexts/AuthContext.tsx`

**Changes to make:**

#### A. Replace the useEffect hook in AuthProvider (around lines 15-45)
Find the existing `useEffect` and replace it with:

```javascript
useEffect(() => {
  // Get initial session with refresh token error handling
  const initializeSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        // Handle refresh token errors by clearing invalid session
        if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
          await supabase.auth.signOut();
          setUser(null);
        } else {
          console.error('Auth context error:', error);
        }
      } else {
        setUser(session?.user ?? null);
      }
    } catch (error) {
      console.error('Failed to initialize auth session:', error);
      // Clear any potentially corrupted session data
      await supabase.auth.signOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  
  initializeSession();

  // Listen for auth changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    setUser(session?.user ?? null);
    
    // Track login history
    if (event === 'SIGNED_IN' && session?.user) {
      await supabase.from('login_history').insert({
        user_id: session.user.id,
        login_method: session.user.app_metadata.provider || 'email',
        ip_address: null, // Would need server-side implementation for real IP
        user_agent: navigator.userAgent
      });
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

---

## Implementation Steps

### Step 1: Backup Your Current Code
```bash
git add .
git commit -m "Backup before deployment fixes"
```

### Step 2: Apply Changes
1. Open each file mentioned above
2. Make the exact changes as described
3. Save all files

### Step 3: Test Locally
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Test production server locally
npm start
```

### Step 4: Verify Health Check
Open your browser and go to: `http://localhost:3001/api/health`
You should see: `{"status":"healthy","timestamp":"...","version":"1.0.0"}`

### Step 5: Deploy to Railway
```bash
git add .
git commit -m "Fix Railway deployment and refresh token errors"
git push origin main
```

---

## Expected Results

After implementing these changes:

✅ **Railway Health Check** - Should pass successfully  
✅ **Server Startup** - Comprehensive logging will show configuration status  
✅ **Frontend Serving** - React app will load correctly in production  
✅ **Authentication** - No more refresh token errors  
✅ **Error Handling** - Graceful handling of invalid sessions  

---

## Troubleshooting

### If Health Check Still Fails:
1. Check Railway logs for the startup messages
2. Verify all environment variables are set in Railway dashboard
3. Ensure the build completed successfully

### If Authentication Issues Persist:
1. Clear browser localStorage and cookies
2. Check Supabase dashboard for authentication settings
3. Verify environment variables match your Supabase project

### If Static Files Don't Load:
1. Verify `npm run build` creates a `dist` folder
2. Check that `dist/index.html` exists after build
3. Review server logs for file serving messages

---

## Environment Variables Checklist

Ensure these are set in Railway:
- ✅ `NODE_ENV=production`
- ✅ `VITE_SUPABASE_URL=https://amopwxxreyvshvfzzvsd.supabase.co`
- ✅ `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- ✅ `VITE_GEMINI_API_KEY=AIzaSyCffgO5rRv23JUBDevS4YLPiljvUn0zrdk`
- ✅ `SUPABASE_URL=https://amopwxxreyvshvfzzvsd.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- ✅ `FRONTEND_URL=https://invoice-ai-mvp-production.up.railway.app`

---

## Support

If you encounter any issues during implementation:
1. Check the exact line numbers in your files (they might differ slightly)
2. Ensure proper indentation and syntax
3. Test each change incrementally
4. Review Railway deployment logs for specific error messages

Good luck with your deployment! 🚀