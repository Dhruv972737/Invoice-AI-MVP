import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import AuthPage from './components/auth/AuthPage';
import Dashboard from './components/Dashboard';
import LoadingSpinner from './components/ui/LoadingSpinner';
import type { User } from '@supabase/supabase-js';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check Supabase configuration
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.error('Supabase environment variables are missing!');
      console.error('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing');
      console.error('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing');
      setLoading(false);
      return;
    }
    
    // Get initial session with refresh token error handling
    const initializeSession = async () => {
      try {
        console.log('Initializing Supabase session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Handle refresh token errors by clearing invalid session
          if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
            console.log('Clearing invalid refresh token...');
            await supabase.auth.signOut();
            setUser(null);
          } else {
            console.error('Supabase connection error:', error);
          }
        } else {
          console.log('Session initialized successfully');
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Failed to connect to Supabase:', error);
        // Clear any potentially corrupted session data
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error('Failed to sign out:', signOutError);
        }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {user ? <Dashboard /> : <AuthPage />}
          </div>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;