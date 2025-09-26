import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    strictPort: true
  },
  resolve: {
    alias: {}
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2015',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          ai: ['@google/generative-ai', 'tesseract.js'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['pdfjs-dist']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@google/generative-ai', 'tesseract.js', '@supabase/supabase-js', 'pdfjs-dist']
  },
  define: {
    global: 'globalThis',
  }
});
