/// <reference types="vite/client" />

// Custom environment typings for Vite + project-specific VITE_ variables
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;

  // AI Providers (Free Daily Tokens)
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_DEEPSEEK_API_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OCR_SPACE_API_KEY?: string;

  readonly VITE_BACKEND_URL?: string;

  // Standard Vite flags
  readonly MODE?: string;
  readonly DEV?: boolean;
  readonly PROD?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
