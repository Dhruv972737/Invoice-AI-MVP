import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

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
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: import.meta.env.DEV
  }
});

// Auth helpers
export const signUp = async (email: string, password: string, fullName?: string) => {
  try {
    console.log('Attempting signup with:', { email, fullName });
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}`,
        data: {
          full_name: fullName || email.split('@')[0]
        }
      }
    });
    
    console.log('Signup response:', { data, error });
    return { data, error };
  } catch (error) {
    console.error('Signup error:', error);
    return { data: null, error: error as any };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    console.log('Attempting sign in for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    console.log('Sign in response:', { data: data?.user ? 'User found' : 'No user', error });
    
    // If sign in failed, return the error
    if (error) {
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (error: any) {
    console.error('Sign in catch error:', error);
    return { 
      data: null, 
      error: { message: error.message || 'Sign in failed' } 
    };
  }
};

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