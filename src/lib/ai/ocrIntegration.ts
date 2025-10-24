// Enhanced integration for your InvoiceUpload component

import { useState } from 'react';
import { EnhancedOCRService } from './enhancedOCRService';
import { EnhancedFileProcessor } from './ocrValidationUtils';
import { OCRAnalytics, createOCRMetrics } from './ocrAnalytics';

// Add this to your existing InvoiceUpload component

export function useEnhancedOCRProcessing() {
  const [ocrProgress, setOCRProgress] = useState<{
    stage: string;
    progress: number;
    quality?: string;
    recommendations?: string[];
  }>({
    stage: 'ready',
    progress: 0
  });

  const processFileWithEnhancedOCR = async (file: File) => {
    const startTime = Date.now();
    
    try {
      // Stage 1: File Validation
      setOCRProgress({
        stage: 'Validating file...',
        progress: 10
      });

      const fileAnalysis = await EnhancedFileProcessor.processFileForOCR(file);
      
      if (!fileAnalysis.isReady) {
        throw new Error(`File validation failed: ${fileAnalysis.validation.errors.join(', ')}`);
      }

      // Stage 2: Quality Assessment
      setOCRProgress({
        stage: 'Analyzing image quality...',
        progress: 20,
        quality: fileAnalysis.quality.estimatedQuality,
        recommendations: fileAnalysis.recommendations
      });

      // Log quality metrics for debugging
      console.log('📊 File Quality Metrics:', {
        resolution: fileAnalysis.quality.resolution,
        dpi: fileAnalysis.quality.dpi,
        quality: fileAnalysis.quality.estimatedQuality,
        preprocessingNeeded: fileAnalysis.preprocessingNeeded
      });

      // Stage 3: OCR Processing
      setOCRProgress({
        stage: 'Extracting text with enhanced OCR...',
        progress: 30
      });

      // Use enhanced OCR service
      const ocrResult = await EnhancedOCRService.extractTextWithMetadata(file);

      // Stage 4: Quality Check
      setOCRProgress({
        stage: 'Validating OCR results...',
        progress: 80
      });

      // Enhanced result validation
      const validationResult = validateOCRResult(ocrResult);
      
      // Record analytics
      const metrics = createOCRMetrics(file, startTime, ocrResult, fileAnalysis.quality);
      OCRAnalytics.recordMetrics(metrics);
      
      setOCRProgress({
        stage: 'Processing complete',
        progress: 100
      });

      return {
        success: true,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        method: ocrResult.method,
        processingSteps: ocrResult.processingSteps,
        quality: fileAnalysis.quality,
        validation: validationResult,
        recommendations: fileAnalysis.recommendations
      };

    } catch (error) {
      console.error('Enhanced OCR processing failed:', error);
      
      setOCRProgress({
        stage: 'Error occurred',
        progress: 0
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        text: '',
        confidence: 0
      };
    }
  };

  return {
    processFileWithEnhancedOCR,
    ocrProgress
  };
}

/**
 * Validate OCR result quality and completeness
 */
function validateOCRResult(result: any): {
  isValid: boolean;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check confidence level
  if (result.confidence < 0.5) {
    issues.push('Low OCR confidence detected');
    suggestions.push('Try uploading a higher quality image');
  }

  // Check text length
  if (result.text.length < 50) {
    issues.push('Very little text extracted');
    suggestions.push('Ensure the document contains visible text');
  }

  // Check for common OCR artifacts
  const ocrArtifacts = /[^\w\s\-.,;:()$€£¥₹@#%&*+=<>[\]{}|\\\/'"!?]/g;
  const artifactCount = (result.text.match(ocrArtifacts) || []).length;
  
  if (artifactCount > result.text.length * 0.05) {
    issues.push('Many unrecognized characters detected');
    suggestions.push('Use a clearer image with better contrast');
  }

  // Check for essential invoice elements
  const hasAmount = /\$|€|£|¥|₹|\d+[\.,]\d{2}/.test(result.text);
  const hasDate = /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(result.text);
  const hasCompany = /\b[A-Z][a-z]+ (?:Corp|Inc|Ltd|LLC|GmbH|SA|SRL)\b/i.test(result.text);

  if (!hasAmount) {
    suggestions.push('No currency amounts detected - ensure invoice amounts are clearly visible');
  }
  if (!hasDate) {
    suggestions.push('No dates detected - ensure invoice date is clear');
  }
  if (!hasCompany) {
    suggestions.push('No company names detected - ensure vendor information is visible');
  }

  // Determine overall quality
  let quality: 'excellent' | 'good' | 'fair' | 'poor';
  
  if (result.confidence > 0.9 && issues.length === 0) {
    quality = 'excellent';
  } else if (result.confidence > 0.75 && issues.length <= 1) {
    quality = 'good';
  } else if (result.confidence > 0.5 && issues.length <= 2) {
    quality = 'fair';
  } else {
    quality = 'poor';
  }

  return {
    isValid: result.confidence > 0.3 && result.text.length > 10,
    quality,
    issues,
    suggestions
  };
}