import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import App from './App.tsx';
import './index.css';
import './i18n'; // Initialize i18n

// Set up PDF.js worker - use bundled worker for reliable loading
GlobalWorkerOptions.workerSrc = pdfjsWorker;

// DEV: expose a small subset of Vite env vars for quick inspection in browser console
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // keep a minimal set to avoid leaking secrets in production
  (window as any).__APP_ENV = {
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY_PRESENT: !!import.meta.env.VITE_SUPABASE_ANON_KEY
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
