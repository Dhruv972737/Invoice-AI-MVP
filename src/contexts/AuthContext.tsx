import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
        try {
          const { data, error } = await supabase.from('login_history').insert({
            user_id: session.user.id,
            login_method: (session.user.app_metadata && session.user.app_metadata.provider) || 'email',
            ip_address: null, // Would need server-side implementation for real IP
            user_agent: navigator.userAgent
          }).select();
          if (error) {
            console.error('Failed to insert login_history:', error);
          } else {
            // optional debug
            console.debug('Inserted login_history row:', data);
          }
        } catch (err) {
          console.error('Unexpected error inserting login_history:', err);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    loading,
    signOut: handleSignOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}