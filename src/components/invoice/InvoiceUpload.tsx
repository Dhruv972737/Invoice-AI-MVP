import React, { useState, useCallback } from 'react';
import { Upload, FileText, Image, X, CheckCircle, AlertCircle, Cloud } from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { EnhancedOCRService } from '../../lib/ai/enhancedOCRService';
import { useEnhancedOCRProcessing } from '../../lib/ai/ocrIntegration';
import { GeminiService } from '../../lib/ai/geminiService';
import { FraudDetectionService } from '../../lib/ai/fraudDetection';
import LoadingSpinner from '../ui/LoadingSpinner';
import { InvoiceProcessingOrchestrator } from '../../lib/ai/multiAgentSystem';
import { useTokens } from '../../contexts/TokenContext';

// Helper function to normalize date strings to YYYY-MM-DD format
const normalizeDateString = (dateStr: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  try {
    // Handle YYYY-MM format (default to first day of month)
    if (/^\d{4}-\d{1,2}$/.test(dateStr)) {
      const [year, month] = dateStr.split('-');
      return `${year}-${month.padStart(2, '0')}-01`;
    }
    
    // Handle "15 Jan 2024" format
    if (dateStr.includes(' ')) {
      const monthMap: { [key: string]: string } = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const parts = dateStr.toLowerCase().split(/\s+/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = monthMap[parts[1].substring(0, 3)] || '01';
        let year = parts[2];
        
        // Handle two-digit years
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum <= 30 ? `20${year}` : `19${year}`;
        }
        
        return `${year}-${month}-${day}`;
      }
    }
    
    // Handle DD/MM/YY, DD-MM-YY, DD.MM.YY formats
    const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
    const match = dateStr.match(datePattern);
    
    if (match) {
      let [, day, month, year] = match;
      
      // Handle two-digit years
      if (year.length === 2) {
        const yearNum = parseInt(year);
        year = yearNum <= 30 ? `20${year}` : `19${year}`;
      }
      
      // Pad day and month with leading zeros
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      
      // Validate month range
      if (parseInt(month) > 12) {
        [day, month] = [month, day];
      }
      
      return `${year}-${month}-${day}`;
    }
    
    // Try to parse as a standard date
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
    
    return new Date().toISOString().split('T')[0];
    
  } catch (error) {
    console.warn('Date parsing failed for:', dateStr, error);
    return new Date().toISOString().split('T')[0];
  }
};

// Enhanced invoice field extraction with regex and entity recognition
const extractInvoiceFields = (text: string): {
  vendor_name: string | null;
  invoice_date: string | null;
  vat_number: string | null;
  amount: string | null;
  tax_region: string | null;
  language: string | null;
  currency: string;
} => {
  const result = {
    vendor_name: null as string | null,
    invoice_date: null as string | null,
    vat_number: null as string | null,
    amount: null as string | null,
    tax_region: null as string | null,
    language: null as string | null,
    currency: 'USD'
  };

  const patterns = {
    date: /(?:date|invoice\s+date|bill\s+date|dated|issued|created)[\s:]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/i,
    vatId: /(?:vat|tax\s+id|gst|tin|ein)[\s#:]*([a-zA-Z]{0,3}\d{6,12}|[a-zA-Z0-9\-]{8,15})/i,
    amount: /(?:total|amount|sum|due|balance|pay|invoice|bill|grand\s+total|net\s+total|final\s+total)[\s:]*(?:[$€£¥]|USD|EUR|GBP|JPY)?\s*(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/i,
    currency: /(USD|EUR|GBP|JPY|CAD|AUD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|BGN|HRK|RSD|BAM|MKD|ALL|TRY|RUB|UAH|BYN|MDL|GEL|AMD|AZN|KZT|UZS|KGS|TJS|TMT|AFN|PKR|INR|LKR|NPR|BTN|BDT|MVR|MYR|SGD|BND|THB|LAK|KHR|VND|MMK|IDR|PHP|CNY|HKD|MOP|TWD|KRW|JPY|MNT)/i,
    language: /(?:language|lang)[\s:]*([a-zA-Z]{2,}|en|es|fr|de|it|pt|ru|zh|ja|ko|ar|hi|th|vi|id|ms|tl|nl|sv|no|da|fi|pl|cs|sk|hu|ro|bg|hr|sr|sl|et|lv|lt|mt|cy|ga|gd|br|eu|ca|gl|ast|an|oc|co|sc|rm|fur|lld|vec|lmo|pms|lij|nap|scn|srd|mwl)/i
  };

  const dateMatch = text.match(patterns.date);
  const vatMatch = text.match(patterns.vatId);
  const amountMatch = text.match(patterns.amount);
  const currencyMatch = text.match(patterns.currency);
  const languageMatch = text.match(patterns.language);

  if (dateMatch) {
    result.invoice_date = normalizeDateString(dateMatch[1]);
  }

  if (vatMatch) {
    result.vat_number = vatMatch[1].trim();
  }

  if (amountMatch) {
    let amountStr = amountMatch[1];
    if (amountStr.includes(',') && amountStr.includes('.')) {
      if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) {
        amountStr = amountStr.replace(/\./g, '').replace(',', '.');
      } else {
        amountStr = amountStr.replace(/,/g, '');
      }
    } else if (amountStr.includes(',')) {
      const parts = amountStr.split(',');
      if (parts.length === 2 && parts[1].length === 2) {
        amountStr = amountStr.replace(',', '.');
      } else {
        amountStr = amountStr.replace(/,/g, '');
      }
    }
    result.amount = parseFloat(amountStr).toString();
  }

  if (currencyMatch) {
    result.currency = currencyMatch[1].toUpperCase();
  } else {
    if (text.includes('$')) result.currency = 'USD';
    else if (text.includes('€')) result.currency = 'EUR';
    else if (text.includes('£')) result.currency = 'GBP';
    else if (text.includes('¥')) result.currency = 'JPY';
  }

  if (languageMatch) {
    const lang = languageMatch[1].toLowerCase();
    const langMap: { [key: string]: string } = {
      'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
      'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'zh': 'Chinese',
      'ja': 'Japanese', 'ko': 'Korean', 'ar': 'Arabic', 'hi': 'Hindi'
    };
    result.language = langMap[lang] || languageMatch[1];
  }

  if (!result.vendor_name) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const vendorPatterns = [
      /(?:vendor|from|company|bill\s+to|sold\s+by|invoice\s+from|billed\s+by)[\s:]*([a-zA-Z0-9\s&.,\-']{3,50}?)(?:\n|address|phone|email|$)/i,
      /^([A-Z][a-zA-Z0-9\s&.,\-']{2,40})(?:\s+(?:inc|ltd|llc|corp|corporation|company|co|gmbh|sa|srl|bv|ab|as|oy|spa|sas|sarl|kft|zrt|doo|d\.o\.o\.|a\.s\.|s\.r\.o\.|sp\.\s*z\s*o\.o\.))?$/im
    ];
    
    for (const pattern of vendorPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let vendor = match[1].trim();
        vendor = vendor.replace(/[^\w\s&.,\-']/g, '').trim();
        if (vendor.length >= 3 && vendor.length <= 50 && 
            !/^(from|to|bill|invoice|company|vendor|date|amount|total|tax|vat)$/i.test(vendor)) {
          result.vendor_name = vendor;
          break;
        }
      }
    }
    
    if (!result.vendor_name) {
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i].trim();
        if (line.length >= 3 && line.length <= 50 && 
            /^[A-Z]/.test(line) && 
            !/\d{2,}/.test(line) &&
            !/^(invoice|bill|receipt|date|amount|total|tax|vat|from|to)$/i.test(line)) {
          result.vendor_name = line.replace(/[^\w\s&.,\-']/g, '').trim();
          break;
        }
      }
    }
  }

  const regionPatterns = [
    /(?:tax\s+region|region|state|country|location)[\s:]*([a-zA-Z\s]{2,30})/i,
    /\b(california|texas|florida|new\s+york|illinois|pennsylvania|ohio|georgia|north\s+carolina|michigan|united\s+states|usa|uk|united\s+kingdom|germany|france|italy|spain|canada|australia|japan|china|india|brazil|mexico)\b/i
  ];
  
  for (const pattern of regionPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.tax_region = match[1].trim();
      break;
    }
  }

  return result;
};

interface UploadedFile {
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface InvoiceUploadProps {
  onUploadComplete: () => void;
}

export default function InvoiceUpload({ onUploadComplete }: InvoiceUploadProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { processFileWithEnhancedOCR, ocrProgress } = useEnhancedOCRProcessing();
  const { getRemainingTokens } = useTokens();
  const [showGoogleDriveInfo, setShowGoogleDriveInfo] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isCheckingDriveStatus, setIsCheckingDriveStatus] = useState(true);

  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const geminiService = null;

  // Check Google Drive connection status on mount
  React.useEffect(() => {
    checkDriveConnectionStatus();

    // Check for OAuth callback query parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('drive_connected')) {
      showToast('success', 'Google Drive Connected', 'Your Google Drive has been connected successfully!');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.has('drive_error')) {
      const error = urlParams.get('drive_error') || 'unknown';
      showToast('error', 'Connection Failed', `Failed to connect Google Drive: ${error}`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  const checkDriveConnectionStatus = async () => {
    if (!user) {
      setIsCheckingDriveStatus(false);
      return;
    }

    try {
      const backend = (
        (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
        'http://localhost:10000'
      ).replace(/\/+$/, '');

      const token = await supabase.auth.getSession();
      const accessToken = token?.data?.session?.access_token;

      if (!accessToken) {
        setIsCheckingDriveStatus(false);
        return;
      }

      const response = await fetch(`${backend}/api/drive/status`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsDriveConnected(data.connected);
      }
    } catch (error) {
      console.error('Failed to check Drive status:', error);
    } finally {
      setIsCheckingDriveStatus(false);
    }
  };

  const convertPdfToImage = async (file: File): Promise<File> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true,
        standardFontDataUrl: undefined
      });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const imageFile = new File([blob], file.name.replace('.pdf', '.png'), {
              type: 'image/png'
            });
            resolve(imageFile);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        }, 'image/png', 0.95);
      });
    } catch (error) {
      console.error('PDF conversion failed:', error);
      throw new Error(`Failed to convert PDF to image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && user) {
      handleFileUpload(files);
    }
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFileUpload(files);
  };

  const handleFileUpload = async (files: File[]) => {
    if (!user) {
      showToast('error', 'Not signed in', 'Please sign in with Google to upload invoices.');
      return;
    }

    const validFiles = files.filter(file => {
      if (!acceptedTypes.includes(file.type)) {
        showToast('error', 'Invalid file type', `${file.name} is not a supported file type`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('error', 'File too large', `${file.name} is larger than 10MB`);
        return false;
      }
      return true;
    });

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      status: 'uploading',
      progress: 0
    }));

    const startIndex = uploadedFiles.length;
    setUploadedFiles(prev => [...prev, ...newFiles]);

    for (let i = 0; i < validFiles.length; i++) {
      await processFile(validFiles[i], startIndex + i);
    }
  };

  const uploadWithRetry = async (
    bucket: string, 
    path: string, 
    file: File, 
    maxRetries = 2
  ): Promise<any> => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Upload attempt ${attempt + 1}/${maxRetries + 1}`);
        
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (error) throw error;
        if (!data) throw new Error('No data returned from upload');
        
        return { data, error: null };
      } catch (error: any) {
        console.warn(`Upload attempt ${attempt + 1} failed:`, error.message);
        lastError = error;
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    return { data: null, error: lastError };
  };

  const processFile = async (file: File, index: number) => {
    try {
      setUploadedFiles(prev => 
        prev.map((f, i) => i === index ? { ...f, progress: 25 } : f)
      );

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
      const filePath = `${user!.id}/${fileName}`;

      console.log('Uploading file to Supabase storage', { 
        fileName, 
        filePath,
        type: file.type, 
        size: file.size 
      });

      const { data: uploadData, error: uploadError } = await uploadWithRetry('invoices', filePath, file);

      console.log('Supabase storage.upload result', { uploadData, uploadError });

      if (uploadError) {
        console.error('Supabase storage upload error:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          name: uploadError.name
        });
        throw new Error(uploadError.message || 'Upload failed');
      }

      if (!uploadData || !uploadData.path) {
        console.error('Upload completed but no path returned:', uploadData);
        throw new Error('Upload completed but file path is missing');
      }

      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(uploadData.path);

      console.log('Supabase getPublicUrl result', { urlData });

      if (!urlData || !urlData.publicUrl) {
        console.error('Failed to get public URL:', { uploadData, urlData });
        throw new Error('Failed to generate public URL');
      }

      setUploadedFiles(prev => 
        prev.map((f, i) => i === index ? { ...f, progress: 50, status: 'processing' } : f)
      );

      const invoiceData = {
        user_id: user!.id,
        file_name: file.name,
        file_path: uploadData.path,  // Storage path for backend to download
        file_url: urlData.publicUrl,
        status: 'processing' as const
      };

      const { data: invoiceRecord, error: dbError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (dbError) {
        console.error('Supabase insert(invoices) error:', {
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          code: dbError.code,
          fullError: dbError
        });
        throw dbError;
      }

      await simulateAIProcessing(invoiceRecord.id, index, file);

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadedFiles(prev => 
        prev.map((f, i) => i === index ? { 
          ...f, 
          status: 'error', 
          error: error.message 
        } : f)
      );
      showToast('error', 'Upload failed', `Failed to upload ${file.name}`);
    }
  };

  const simulateAIProcessing = async (invoiceId: string, index: number, file: File) => {
    try {
      const remainingTokens = getRemainingTokens();
      
      if (remainingTokens < 10) {
        showToast('error', 'Insufficient Tokens', 
          'You need at least 10 tokens to process an invoice. Please purchase more tokens or wait for daily reset.');
        
        setUploadedFiles(prev => 
          prev.map((f, i) => i === index ? { ...f, status: 'error', error: 'Insufficient tokens' } : f)
        );
        return;
      }

      setUploadedFiles(prev => 
        prev.map((f, i) => i === index ? { ...f, progress: 10 } : f)
      );

      console.log('🎯 Enqueuing invoice for backend processing...');

      const backend = (
        (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
        (typeof window !== 'undefined' ? (window as any).__APP_ENV?.VITE_BACKEND_URL : undefined) ||
        'http://localhost:10000'
      ).replace(/\/+$/, '');
      
      const token = await supabase.auth.getSession();
      const accessToken = token?.data?.session?.access_token || null;

      if (!accessToken) {
        throw new Error('Missing access token for enqueuing job');
      }

      console.log('Enqueueing invoice to backend', { backend, invoiceId, accessTokenPresent: !!accessToken });

      const resp = await Promise.race([
        fetch(`${backend}/api/process-invoice/enqueue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ invoiceId })
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Enqueue request timed out')), 15000))
      ]).catch(err => {
        console.error('Network error when calling enqueue endpoint', err);
        throw new Error('Network error when contacting backend');
      });

      if (!resp) {
        throw new Error('No response from backend when enqueueing job');
      }

      let data: any = null;
      try {
        data = await (resp as Response).json();
      } catch (err) {
        console.error('Failed to parse enqueue response as JSON', err);
        throw new Error('Invalid response from backend');
      }

      console.log('Enqueue response', { status: (resp as Response).status, ok: (resp as Response).ok, data });

      if (!(resp as Response).ok || !data?.success) {
        console.error('Failed to enqueue job:', { status: (resp as Response).status, data });
        throw new Error(data?.error || data?.detail || `Failed to enqueue job (status ${(resp as Response).status})`);
      }

      // Backend now processes immediately, so mark as completed
      setUploadedFiles(prev =>
        prev.map((f, i) => i === index ? {
          ...f,
          status: 'completed',
          progress: 100
        } : f)
      );

      showToast('success', 'Processing Complete', 'Invoice has been processed successfully!');

    } catch (error: any) {
      console.error('❌ Processing failed:', error);
      
      setUploadedFiles(prev => 
        prev.map((f, i) => i === index ? { 
          ...f, 
          status: 'error', 
          error: error.message 
        } : f)
      );

      showToast('error', 'Processing Failed', 
        error.message || 'Failed to process invoice. Please try again.');
    }
  };

  const handleChooseFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fileInputRef.current?.click();
  };

  const handleGoogleDriveUpload = async (e: React.MouseEvent) => {
    // Prevent event from bubbling to file input
    e.stopPropagation();
    e.preventDefault();

    const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!googleApiKey || !googleClientId) {
      showToast('error', 'Configuration Error', 'Google Drive API credentials are not configured.');
      return;
    }

    // Check if user has connected Google Drive
    if (!isDriveConnected) {
      // User needs to authorize Google Drive access
      const confirm = window.confirm(
        'You need to authorize access to your Google Drive. You will be redirected to Google to grant permission. Continue?'
      );

      if (!confirm) return;

      try {
        const backend = (
          (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
          'http://localhost:10000'
        ).replace(/\/+$/, '');

        const token = await supabase.auth.getSession();
        const accessToken = token?.data?.session?.access_token;

        if (!accessToken) {
          throw new Error('Not authenticated');
        }

        // Get OAuth URL from backend
        const response = await fetch(`${backend}/api/drive/auth-url`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to get authorization URL');
        }

        const data = await response.json();

        // Redirect to Google OAuth
        window.location.href = data.auth_url;

      } catch (error: any) {
        console.error('OAuth initialization failed:', error);
        showToast('error', 'Authorization Failed', error.message || 'Failed to start Google Drive authorization');
      }

      return;
    }

    // User is connected, show Google Picker
    loadGooglePicker(googleApiKey, googleClientId);
  };

  const loadGooglePicker = (apiKey: string, clientId: string) => {
    // Check if gapi is already loaded
    if ((window as any).gapi) {
      initializePicker(apiKey, clientId);
      return;
    }

    // Load Google API script
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      (window as any).gapi.load('picker', () => {
        initializePicker(apiKey, clientId);
      });
    };
    document.body.appendChild(script);
  };

  const initializePicker = async (apiKey: string, clientId: string) => {
    const google = (window as any).google;

    if (!google || !google.picker) {
      showToast('error', 'Picker Error', 'Failed to load Google Picker');
      return;
    }

    // We don't need OAuth token for the picker since we're downloading via backend
    // The backend will use the stored OAuth tokens
    const picker = new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView()
        .setIncludeFolders(true)
        .setMimeTypes('application/pdf,image/jpeg,image/png,image/jpg'))
      .setDeveloperKey(apiKey)
      .setAppId(clientId.split('-')[0])
      .setCallback(pickerCallback)
      .build();

    picker.setVisible(true);
  };

  const pickerCallback = (data: any) => {
    const google = (window as any).google;

    if (data.action === google.picker.Action.PICKED) {
      const files = data.docs;

      // Download each selected file
      files.forEach((file: any) => {
        downloadFromGoogleDrive(file.id, file.name);
      });
    }
  };

  const downloadFromGoogleDrive = async (fileId: string, fileName: string) => {
    try {
      showToast('info', 'Downloading', `Downloading ${fileName} from Google Drive...`);

      const backend = (
        (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
        'http://localhost:10000'
      ).replace(/\/+$/, '');

      const token = await supabase.auth.getSession();
      const accessToken = token?.data?.session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Call backend to download from Google Drive
      const response = await fetch(`${backend}/api/google-drive/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ fileId, fileName })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to download file from Google Drive');
      }

      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });

      // Process the downloaded file
      handleFileUpload([file]);

    } catch (error: any) {
      console.error('Google Drive download error:', error);
      showToast('error', 'Download Failed', error.message || 'Failed to download file from Google Drive');
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <LoadingSpinner size="sm" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('upload.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('upload.subtitle')}
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
        `}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {t('upload.dropzone')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('upload.formats')}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <button
            type="button"
            onClick={handleChooseFiles}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t('upload.chooseFiles')}
          </button>

          <button
            type="button"
            onClick={handleGoogleDriveUpload}
            disabled={isCheckingDriveStatus}
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors border ${
              isDriveConnected
                ? 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                : 'bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Cloud className="w-4 h-4 mr-2" />
            {isCheckingDriveStatus ? 'Checking...' : isDriveConnected ? 'Google Drive (Connected)' : 'Connect Google Drive'}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center space-x-6 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center">
            <FileText className="w-4 h-4 mr-1" />
            PDF
          </div>
          <div className="flex items-center">
            <Image className="w-4 h-4 mr-1" />
            JPEG, PNG
          </div>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('upload.processing')} ({uploadedFiles.length})
            </h3>
          </div>
          
          <div className="p-6 space-y-4">
            {uploadedFiles.map((uploadFile, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="p-2 bg-white dark:bg-gray-600 rounded-lg">
                    {uploadFile.file.type === 'application/pdf' 
                      ? <FileText className="w-5 h-5 text-red-500" />
                      : <Image className="w-5 h-5 text-blue-500" />
                    }
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(uploadFile.status)}
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {t(`upload.status.${uploadFile.status}`)}
                    </span>
                  </div>

                  {uploadFile.status === 'processing' && (
                    <div className="w-24">
                      <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {uploadFile.status !== 'processing' && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {uploadedFiles.some(f => f.status === 'completed') && (
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onUploadComplete}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {t('upload.viewProcessed')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            {t('upload.aiPipeline')}
          </h3>
          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
            {t('upload.accuracy')}
          </span>
        </div>
        {!geminiApiKey && (
          <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-300 dark:border-yellow-700">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> Gemini API key not configured. Using fallback processing.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 dark:text-blue-200">{t('upload.feature1')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 dark:text-blue-200">{t('upload.feature2')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 dark:text-blue-200">{t('upload.feature3')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 dark:text-blue-200">{t('upload.feature4')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 dark:text-blue-200">{t('upload.feature5')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 dark:text-blue-200">{t('upload.feature6')}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">{t('upload.enhancements')}</h4>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <li>• {t('upload.enhancement1')}</li>
            <li>• {t('upload.enhancement2')}</li>
            <li>• {t('upload.enhancement3')}</li>
            <li>• {t('upload.enhancement4')}</li>
            <li>• {t('upload.enhancement5')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}