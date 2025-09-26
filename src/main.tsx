import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import App from './App.tsx';
import './index.css';

// Set up PDF.js worker - use CDN for production builds
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
