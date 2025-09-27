/**
 * OCR Input Validation and Optimization Utilities
 */

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ImageQualityMetrics {
  resolution: { width: number; height: number };
  dpi: number;
  fileSize: number;
  estimatedQuality: 'low' | 'medium' | 'high';
  isRotated: boolean;
  hasText: boolean;
}

export class OCRValidationUtils {
  
  /**
   * Validate file before OCR processing
   */
  static validateFile(file: File): FileValidationResult {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: []
    };

    // Check file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      result.errors.push(`Unsupported file type: ${file.type}. Use PDF, JPEG, or PNG.`);
      result.isValid = false;
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      result.errors.push(`File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed: 10MB.`);
      result.isValid = false;
    }

    // Check minimum file size (avoid empty files)
    const minSize = 1024; // 1KB
    if (file.size < minSize) {
      result.errors.push(`File too small: ${file.size} bytes. Minimum required: 1KB.`);
      result.isValid = false;
    }

    // File size recommendations
    if (file.size < 100 * 1024) { // < 100KB
      result.warnings.push('Small file size detected. Consider using higher resolution images for better OCR accuracy.');
    }

    if (file.size > 5 * 1024 * 1024) { // > 5MB
      result.warnings.push('Large file detected. Processing may take longer.');
    }

    // File name recommendations
    if (file.name.includes('screenshot') || file.name.includes('photo')) {
      result.recommendations.push('For best results, use scanned documents instead of photos or screenshots.');
    }

    return result;
  }

  /**
   * Analyze image quality for OCR optimization
   */
  static async analyzeImageQuality(file: File): Promise<ImageQualityMetrics> {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        // For PDFs, return estimated metrics
        resolve({
          resolution: { width: 2100, height: 2970 }, // A4 at 300 DPI
          dpi: 300,
          fileSize: file.size,
          estimatedQuality: file.size > 1024 * 1024 ? 'high' : 'medium',
          isRotated: false,
          hasText: true
        });
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        const metrics: ImageQualityMetrics = {
          resolution: { width: img.width, height: img.height },
          dpi: this.estimateDPI(img.width, img.height, file.size),
          fileSize: file.size,
          estimatedQuality: this.estimateQuality(img.width, img.height, file.size),
          isRotated: this.detectRotation(img.width, img.height),
          hasText: true // Assume true, could be enhanced with ML
        };

        resolve(metrics);
      };

      img.onerror = () => reject(new Error('Failed to analyze image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Estimate DPI based on image dimensions and file size
   */
  private static estimateDPI(width: number, height: number, fileSize: number): number {
    // Estimate DPI based on typical document sizes
    const aspectRatio = width / height;
    
    // Standard A4 ratio
    if (Math.abs(aspectRatio - (210 / 297)) < 0.1) {
      if (width >= 2480) return 300; // High DPI
      if (width >= 1754) return 210; // Medium DPI
      return 150; // Low DPI
    }
    
    // Letter size ratio
    if (Math.abs(aspectRatio - (8.5 / 11)) < 0.1) {
      if (width >= 2550) return 300;
      if (width >= 1700) return 200;
      return 150;
    }
    
    // General estimation
    const pixelCount = width * height;
    if (pixelCount > 6000000) return 300;
    if (pixelCount > 3000000) return 200;
    return 150;
  }

  /**
   * Estimate overall image quality
   */
  private static estimateQuality(width: number, height: number, fileSize: number): 'low' | 'medium' | 'high' {
    const pixelCount = width * height;
    const bytesPerPixel = fileSize / pixelCount;

    // High quality: Good resolution and file size
    if (pixelCount > 6000000 && bytesPerPixel > 1.5) {
      return 'high';
    }

    // Medium quality: Decent resolution
    if (pixelCount > 2000000 && bytesPerPixel > 0.8) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Detect if image might be rotated
   */
  private static detectRotation(width: number, height: number): boolean {
    const aspectRatio = width / height;
    
    // Standard document ratios (portrait)
    const standardRatios = [
      210 / 297,  // A4
      8.5 / 11,   // Letter
      8.5 / 14,   // Legal
    ];

    // Check if image is in landscape when it should be portrait
    for (const ratio of standardRatios) {
      if (Math.abs(aspectRatio - (1 / ratio)) < 0.1) {
        return true; // Likely rotated 90 degrees
      }
    }

    return false;
  }

  /**
   * Generate optimization recommendations
   */
  static generateOptimizationRecommendations(
    validation: FileValidationResult,
    quality: ImageQualityMetrics
  ): string[] {
    const recommendations: string[] = [];

    // DPI recommendations
    if (quality.dpi < 200) {
      recommendations.push('⚠️ Low resolution detected. Scan at 300 DPI or higher for best OCR results.');
    }

    // Quality recommendations
    if (quality.estimatedQuality === 'low') {
      recommendations.push('📸 Image quality appears low. Use better lighting or higher resolution.');
    }

    // Rotation recommendations
    if (quality.isRotated) {
      recommendations.push('🔄 Image appears rotated. Correct orientation before uploading.');
    }

    // Size recommendations
    if (quality.resolution.width < 1200 || quality.resolution.height < 1200) {
      recommendations.push('📏 Small image dimensions. Consider using larger images for better text recognition.');
    }

    // File format recommendations
    if (validation.warnings.length > 0) {
      recommendations.push('💡 For best results, use high-contrast scanned PDFs or PNG images.');
    }

    return recommendations;
  }

  /**
   * Get pre-processing recommendations based on file analysis
   */
  static getPreprocessingRecommendations(quality: ImageQualityMetrics): {
    needsUpscaling: boolean;
    needsRotation: boolean;
    needsContrast: boolean;
    needsDenoising: boolean;
    suggestedScale: number;
  } {
    return {
      needsUpscaling: quality.resolution.width < 1500 || quality.resolution.height < 1500,
      needsRotation: quality.isRotated,
      needsContrast: quality.estimatedQuality === 'low',
      needsDenoising: quality.dpi < 200,
      suggestedScale: quality.resolution.width < 1200 ? 2.5 : quality.resolution.width < 1800 ? 2.0 : 1.5
    };
  }
}

/**
 * Enhanced file processor with validation
 */
export class EnhancedFileProcessor {
  
  /**
   * Process file with comprehensive validation and optimization
   */
  static async processFileForOCR(file: File): Promise<{
    isReady: boolean;
    validation: FileValidationResult;
    quality: ImageQualityMetrics;
    recommendations: string[];
    preprocessingNeeded: boolean;
  }> {
    console.log(`🔍 [Validation] Analyzing file: ${file.name}`);

    // Step 1: Basic validation
    const validation = OCRValidationUtils.validateFile(file);
    
    if (!validation.isValid) {
      return {
        isReady: false,
        validation,
        quality: {
          resolution: { width: 0, height: 0 },
          dpi: 0,
          fileSize: file.size,
          estimatedQuality: 'low',
          isRotated: false,
          hasText: false
        },
        recommendations: [],
        preprocessingNeeded: false
      };
    }

    // Step 2: Quality analysis
    const quality = await OCRValidationUtils.analyzeImageQuality(file);
    
    // Step 3: Generate recommendations
    const recommendations = OCRValidationUtils.generateOptimizationRecommendations(validation, quality);
    
    // Step 4: Determine preprocessing needs
    const preprocessingRecs = OCRValidationUtils.getPreprocessingRecommendations(quality);
    const preprocessingNeeded = preprocessingRecs.needsUpscaling || 
                                preprocessingRecs.needsContrast || 
                                preprocessingRecs.needsDenoising;

    console.log(`🔍 [Validation] File analysis complete - Quality: ${quality.estimatedQuality}, DPI: ${quality.dpi}, Preprocessing needed: ${preprocessingNeeded}`);

    return {
      isReady: true,
      validation,
      quality,
      recommendations,
      preprocessingNeeded
    };
  }
}