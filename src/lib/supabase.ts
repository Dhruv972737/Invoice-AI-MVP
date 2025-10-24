import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
  
  // In development, show helpful message
  if (import.meta.env.DEV) {
    console.error('Please check your .env file and ensure all Supabase variables are set');
  }
  
  // Throw error to prevent client creation with invalid config
  throw new Error('Supabase configuration is missing. Please check your environment variables.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: import.meta.env.DEV,
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined
  }
});

// Auth helpers
/**
 * NOTE: This project enforces Google-only authentication. The email/password
 * sign-up and sign-in flows were intentionally removed to prevent accidental
 * usage. If you need to re-enable them for testing, restore the functions
 * below, but keep in mind a matching DB-side enforcement exists which will
 * reject non-Google signups.
 */

// export const signUp = async (email: string, password: string, fullName?: string) => {
//   // Deprecated - Google-only auth enforced
// };

// export const signIn = async (email: string, password: string) => {
//   // Deprecated - Google-only auth enforced
// };

export const signInWithGoogle = async () => {
  try {
    console.log('Attempting Google OAuth sign in...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'email profile'
      }
    });
    
    if (error) {
      console.error('Google OAuth error:', error);
    } else {
      console.log('Google OAuth initiated successfully');
    }
    
    return { data, error };
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return { data: null, error: error as any };
  }
};

export const signOut = async () => {
  console.log('Signing out user...');
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
  } else {
    console.log('User signed out successfully');
  }
  return { error };
};