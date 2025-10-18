import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { TokenProvider } from './contexts/TokenContext'; // NEW
import { LanguageProvider } from './contexts/LanguageContext';
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
    
    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          if (error.message.includes('Refresh Token Not Found') || 
              error.message.includes('Invalid Refresh Token')) {
            await supabase.auth.signOut();
            setUser(null);
          }
        } else {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Failed to connect to Supabase:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
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
      <LanguageProvider>
        <ThemeProvider>
          <ToastProvider>
            <TokenProvider> {/* NEW: Wrap with TokenProvider */}
              <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                {user ? <Dashboard /> : <AuthPage />}
              </div>
            </TokenProvider>
          </ToastProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;