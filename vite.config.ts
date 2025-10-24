import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    host: true,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2015',
    minify: 'esbuild',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          ai: ['@google/generative-ai', 'tesseract.js'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['pdfjs-dist']
        }
      },
      external: (id) => {
        // Don't externalize PDF.js worker - let Vite handle it
        if (id.includes('pdf.worker')) {
          return false;
        }
        return false;
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@google/generative-ai', 'tesseract.js', '@supabase/supabase-js', 'pdfjs-dist']
  },
  define: {
    global: 'globalThis'
  },
  assetsInclude: ['**/*.wasm', '**/*.worker.js'],
  worker: {
    format: 'es'
  }
});
