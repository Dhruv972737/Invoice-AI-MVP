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
      setLoading(false);
      return;
    }
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Supabase connection error:', error);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to connect to Supabase:', error);
      setLoading(false);
    });

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