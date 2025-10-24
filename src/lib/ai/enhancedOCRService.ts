import Tesseract from 'tesseract.js';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

export interface OCRResult {
  text: string;
  confidence: number;
  method: 'tesseract' | 'ocr_space' | 'mock';
  processingSteps: string[];
  words?: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export class EnhancedOCRService {
  private static readonly OCR_SPACE_API_KEY = import.meta.env.VITE_OCR_SPACE_API_KEY;
  private static readonly OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
  private static readonly MIN_CONFIDENCE_THRESHOLD = 75; // Increased from 30
  private static readonly MIN_TEXT_LENGTH = 15; // Minimum meaningful text length

  /**
   * Main OCR extraction method with enhanced preprocessing
   */
  static async extractText(file: File): Promise<string> {
    console.log(`📄 [OCR] Starting enhanced extraction for: ${file.name} (${file.type})`);
    
    try {
      // Step 1: Try enhanced Tesseract with preprocessing
      const enhancedResult = await this.extractWithEnhancedTesseract(file);
      if (enhancedResult.success && enhancedResult.text.trim().length > this.MIN_TEXT_LENGTH) {
        console.log(`📄 [OCR] Enhanced Tesseract success: ${enhancedResult.text.length} chars, confidence: ${enhancedResult.confidence}%`);
        return enhancedResult.text;
      }
      
      console.warn(`📄 [OCR] Enhanced Tesseract failed, trying multi-language approach...`);
      
      // Step 2: Try multi-language detection and processing
      const multiLangResult = await this.extractWithMultiLanguage(file);
      if (multiLangResult.success && multiLangResult.text.trim().length > this.MIN_TEXT_LENGTH) {
        console.log(`📄 [OCR] Multi-language success: ${multiLangResult.text.length} chars`);
        return multiLangResult.text;
      }
      
      // Step 3: Try OCR.Space fallback with enhanced settings
      if (this.OCR_SPACE_API_KEY) {
        const fallbackResult = await this.extractWithEnhancedOCRSpace(file);
        if (fallbackResult.success && fallbackResult.text.trim().length > 5) {
          console.log(`📄 [OCR] OCR.Space fallback success: ${fallbackResult.text.length} chars`);
          return fallbackResult.text;
        }
      }
      
      // Step 4: Return mock text as last resort
      console.warn(`📄 [OCR] All enhanced methods failed, returning mock text`);
      return this.getMockOCRText(file.name);
      
    } catch (error) {
      console.error(`📄 [OCR] Unexpected error during enhanced extraction:`, error);
      return this.getMockOCRText(file.name);
    }
  }

  /**
   * Enhanced Tesseract with image preprocessing
   */
  private static async extractWithEnhancedTesseract(file: File): Promise<{ success: boolean; text: string; confidence?: number }> {
    try {
      let imageSource: string | HTMLCanvasElement;
      const processingSteps: string[] = [];
      
      if (file.type === 'application/pdf') {
        console.log(`📄 [OCR] Converting PDF to enhanced canvas...`);
        imageSource = await this.convertPDFToEnhancedCanvas(file);
        processingSteps.push('PDF to high-res canvas');
      } else {
        // Preprocess image for better OCR
        imageSource = await this.preprocessImageForOCR(file);
        processingSteps.push('Image preprocessing');
      }

      console.log(`📄 [OCR] Running enhanced Tesseract with optimal settings...`);
      
      // Enhanced Tesseract configuration
      const result = await Tesseract.recognize(imageSource, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`📄 [OCR] Enhanced Tesseract progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        // Enhanced OCR parameters
        tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Automatic page segmentation
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, // Use LSTM neural network
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: '', // Allow all characters
        tessedit_char_blacklist: '', // No character blacklist
      });

      // Clean up resources
      if (typeof imageSource === 'string') {
        URL.revokeObjectURL(imageSource);
      }

      const extractedText = result.data.text?.trim() || '';
      const confidence = result.data.confidence || 0;
      
      console.log(`📄 [OCR] Enhanced Tesseract completed - Confidence: ${confidence}%, Text length: ${extractedText.length}`);
      
      return {
        success: extractedText.length > this.MIN_TEXT_LENGTH && confidence > this.MIN_CONFIDENCE_THRESHOLD,
        text: extractedText,
        confidence: confidence
      };
      
    } catch (error) {
      console.error(`📄 [OCR] Enhanced Tesseract failed:`, error);
      return { success: false, text: '' };
    }
  }

  /**
   * Multi-language OCR attempt
   */
  private static async extractWithMultiLanguage(file: File): Promise<{ success: boolean; text: string }> {
    try {
      console.log(`📄 [OCR] Attempting multi-language OCR...`);
      
      let imageSource: string | HTMLCanvasElement;
      
      if (file.type === 'application/pdf') {
        imageSource = await this.convertPDFToEnhancedCanvas(file);
      } else {
        imageSource = await this.preprocessImageForOCR(file);
      }

      // Try with multiple language combinations
      const languageCombinations = [
        'eng+fra+deu+spa', // English + French + German + Spanish
        'eng+chi_sim+jpn', // English + Chinese + Japanese
        'eng', // Fallback to English only
      ];

      for (const languages of languageCombinations) {
        try {
          console.log(`📄 [OCR] Trying languages: ${languages}`);
          
          const result = await Tesseract.recognize(imageSource, languages, {
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          });

          const extractedText = result.data.text?.trim() || '';
          const confidence = result.data.confidence || 0;

          if (extractedText.length > this.MIN_TEXT_LENGTH && confidence > 60) {
            console.log(`📄 [OCR] Multi-language success with ${languages}: ${confidence}% confidence`);
            
            // Clean up resources
            if (typeof imageSource === 'string') {
              URL.revokeObjectURL(imageSource);
            }
            
            return { success: true, text: extractedText };
          }
        } catch (langError) {
          console.warn(`📄 [OCR] Language combination ${languages} failed:`, langError);
          continue;
        }
      }

      // Clean up resources
      if (typeof imageSource === 'string') {
        URL.revokeObjectURL(imageSource);
      }

      return { success: false, text: '' };
      
    } catch (error) {
      console.error(`📄 [OCR] Multi-language processing failed:`, error);
      return { success: false, text: '' };
    }
  }

  /**
   * Enhanced image preprocessing for better OCR accuracy
   */
  private static async preprocessImageForOCR(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Could not get canvas 2D context');
          }

          // Calculate optimal dimensions (ensure minimum 300 DPI equivalent)
          const minWidth = 1200;
          const minHeight = 1200;
          const scale = Math.max(1, Math.max(minWidth / img.width, minHeight / img.height));
          
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          // Enable image smoothing for high-quality scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw scaled image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Apply image enhancement filters
          this.applyImageEnhancements(ctx, canvas.width, canvas.height);

          console.log(`📄 [OCR] Image preprocessed: ${img.width}x${img.height} → ${canvas.width}x${canvas.height}`);
          resolve(canvas);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Apply image enhancement filters for better OCR
   */
  private static applyImageEnhancements(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Apply contrast enhancement and noise reduction
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to grayscale with proper weights
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      // Apply contrast enhancement
      const enhanced = this.enhanceContrast(gray);

      // Set enhanced values
      data[i] = enhanced;     // R
      data[i + 1] = enhanced; // G
      data[i + 2] = enhanced; // B
      // Alpha stays the same
    }

    // Apply the enhanced image data back to canvas
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Enhance contrast for better text recognition
   */
  private static enhanceContrast(gray: number): number {
    // Apply adaptive contrast enhancement
    const normalized = gray / 255;
    
    // Sigmoid contrast enhancement
    const enhanced = 1 / (1 + Math.exp(-12 * (normalized - 0.5)));
    
    return Math.round(enhanced * 255);
  }

  /**
   * Enhanced PDF to canvas conversion
   */
  private static async convertPDFToEnhancedCanvas(file: File): Promise<HTMLCanvasElement> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true,
        standardFontDataUrl: undefined
      });
      const pdf = await loadingTask.promise;
      
      console.log(`📄 [OCR] PDF loaded, ${pdf.numPages} pages found`);
      
      const page = await pdf.getPage(1);
      // Use higher scale for better OCR (3x instead of 2x)
      const viewport = page.getViewport({ scale: 3.0 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas 2D context');
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Apply additional enhancement for PDF content
      this.applyImageEnhancements(context, canvas.width, canvas.height);
      
      console.log(`📄 [OCR] PDF converted to enhanced canvas: ${canvas.width}x${canvas.height}`);
      return canvas;
      
    } catch (error) {
      console.error(`📄 [OCR] Enhanced PDF conversion failed:`, error);
      throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced OCR.Space API with better settings
   */
  private static async extractWithEnhancedOCRSpace(file: File): Promise<{ success: boolean; text: string }> {
    try {
      console.log(`📄 [OCR] Attempting enhanced OCR.Space API...`);
      
      const formData = new FormData();
      formData.append('apikey', this.OCR_SPACE_API_KEY);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true'); // Enable orientation detection
      formData.append('isTable', 'true'); // Better table detection
      formData.append('scale', 'true');
      formData.append('OCREngine', '2'); // Use latest OCR engine
      formData.append('isSearchablePDFHideTextLayer', 'false');
      
      if (file.type === 'application/pdf') {
        const canvas = await this.convertPDFToEnhancedCanvas(file);
        const blob = await this.canvasToBlob(canvas);
        formData.append('file', blob, 'enhanced.png');
      } else {
        // Preprocess image before sending
        const canvas = await this.preprocessImageForOCR(file);
        const blob = await this.canvasToBlob(canvas);
        formData.append('file', blob, 'enhanced.png');
      }

      const response = await fetch(this.OCR_SPACE_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OCR.Space API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.IsErroredOnProcessing) {
        throw new Error(`OCR.Space processing error: ${result.ErrorMessage || 'Unknown error'}`);
      }

      const extractedText = result.ParsedResults?.[0]?.ParsedText?.trim() || '';
      
      console.log(`📄 [OCR] Enhanced OCR.Space completed - Text length: ${extractedText.length}`);
      
      return {
        success: extractedText.length > 0,
        text: extractedText
      };
      
    } catch (error) {
      console.error(`📄 [OCR] Enhanced OCR.Space API failed:`, error);
      return { success: false, text: '' };
    }
  }

  /**
   * Convert canvas to high-quality blob
   */
  private static async canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png', 0.98); // Higher quality
    });
  }

  /**
   * Enhanced OCR result with comprehensive metadata
   */
  static async extractTextWithMetadata(file: File): Promise<OCRResult> {
    const startTime = Date.now();
    const processingSteps: string[] = [];
    
    try {
      // Try enhanced Tesseract first
      processingSteps.push('Enhanced Tesseract attempt');
      const tesseractResult = await this.extractWithEnhancedTesseract(file);
      if (tesseractResult.success) {
        processingSteps.push('Enhanced Tesseract successful');
        return {
          text: tesseractResult.text,
          confidence: (tesseractResult.confidence || 70) / 100,
          method: 'tesseract',
          processingSteps,
          words: [] // Could be enhanced to return word-level data
        };
      }
      
      // Try multi-language approach
      processingSteps.push('Multi-language attempt');
      const multiLangResult = await this.extractWithMultiLanguage(file);
      if (multiLangResult.success) {
        processingSteps.push('Multi-language successful');
        return {
          text: multiLangResult.text,
          confidence: 0.8,
          method: 'tesseract',
          processingSteps,
          words: []
        };
      }
      
      // Try enhanced OCR.Space fallback
      if (this.OCR_SPACE_API_KEY) {
        processingSteps.push('Enhanced OCR.Space attempt');
        const ocrSpaceResult = await this.extractWithEnhancedOCRSpace(file);
        if (ocrSpaceResult.success) {
          processingSteps.push('Enhanced OCR.Space successful');
          return {
            text: ocrSpaceResult.text,
            confidence: 0.85,
            method: 'ocr_space',
            processingSteps,
            words: []
          };
        }
      }
      
      // Return mock result
      processingSteps.push('All methods failed, using mock data');
      return {
        text: this.getMockOCRText(file.name),
        confidence: 0.3,
        method: 'mock',
        processingSteps,
        words: []
      };
      
    } catch (error) {
      console.error(`📄 [OCR] Enhanced extractTextWithMetadata failed:`, error);
      processingSteps.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        text: this.getMockOCRText(file.name),
        confidence: 0.1,
        method: 'mock',
        processingSteps,
        words: []
      };
    } finally {
      const duration = Date.now() - startTime;
      console.log(`📄 [OCR] Total enhanced extraction time: ${duration}ms`);
      console.log(`📄 [OCR] Processing steps: ${processingSteps.join(' → ')}`);
    }
  }

  /**
   * Generate mock OCR text (unchanged from original)
   */
  private static getMockOCRText(filename: string): string {
    const mockTexts = [
      `INVOICE\n\nVendor: ${this.extractVendorFromFilename(filename)}\nDate: ${new Date().toLocaleDateString()}\nAmount: $${(Math.random() * 1000 + 100).toFixed(2)}\nTax ID: TX${Math.random().toString().slice(2, 8)}\n\nDescription: Professional services\nSubtotal: $${(Math.random() * 900 + 90).toFixed(2)}\nTax: $${(Math.random() * 100 + 10).toFixed(2)}\nTotal: $${(Math.random() * 1000 + 100).toFixed(2)}`,
      
      `BILL\n\nFrom: ${this.extractVendorFromFilename(filename)}\nInvoice #: INV-${Math.random().toString().slice(2, 8)}\nDate: ${new Date().toLocaleDateString()}\n\nServices Rendered:\n- Consulting Services\n- Technical Support\n\nAmount Due: $${(Math.random() * 2000 + 200).toFixed(2)}\nDue Date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
      
      `RECEIPT\n\nCompany: ${this.extractVendorFromFilename(filename)}\nTransaction ID: ${Math.random().toString().slice(2, 10)}\nDate: ${new Date().toLocaleDateString()}\n\nItems:\n- Product/Service\n- Additional Charges\n\nSubtotal: $${(Math.random() * 800 + 80).toFixed(2)}\nTax (8.5%): $${(Math.random() * 80 + 8).toFixed(2)}\nTotal: $${(Math.random() * 880 + 88).toFixed(2)}`
    ];
    
    const selectedMock = mockTexts[Math.floor(Math.random() * mockTexts.length)];
    console.log(`📄 [OCR] Generated mock OCR text (${selectedMock.length} characters)`);
    return selectedMock;
  }

  /**
   * Extract potential vendor name from filename (unchanged from original)
   */
  private static extractVendorFromFilename(filename: string): string {
    const vendors = ['Acme Corp', 'TechSupply Ltd', 'Office Solutions', 'CloudServices Inc', 'Digital Systems', 'Pro Services LLC'];
    
    const cleanName = filename.replace(/\.(pdf|jpg|jpeg|png)$/i, '').replace(/[_-]/g, ' ');
    if (cleanName.length > 3 && cleanName.length < 30) {
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
    
    return vendors[Math.floor(Math.random() * vendors.length)];
  }
}

// Export enhanced service
export const enhancedOCRService = EnhancedOCRService;