import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import App from './App.tsx';
import './index.css';

// Set up PDF.js worker - use bundled worker for reliable loading
GlobalWorkerOptions.workerSrc = pdfjsWorker;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
