/**
 * OCR Performance Analytics and Tracking System
 */

export interface OCRMetrics {
  sessionId: string;
  timestamp: Date;
  filename: string;
  fileSize: number;
  fileType: string;
  
  // Input quality metrics
  inputQuality: 'low' | 'medium' | 'high';
  estimatedDPI: number;
  imageResolution: { width: number; height: number };
  
  // Processing metrics
  processingTimeMs: number;
  ocrMethod: 'tesseract' | 'ocr_space' | 'mock';
  processingSteps: string[];
  
  // Output quality metrics
  confidence: number;
  textLength: number;
  detectedLanguage?: string;
  
  // Validation metrics
  hasAmount: boolean;
  hasDate: boolean;
  hasVendor: boolean;
  artifactCount: number;
  
  // User feedback (if available)
  userRating?: 1 | 2 | 3 | 4 | 5;
  userCorrections?: number;
}

export class OCRAnalytics {
  private static metrics: OCRMetrics[] = [];
  private static readonly MAX_STORED_METRICS = 100;

  /**
   * Record OCR processing metrics
   */
  static recordMetrics(metrics: OCRMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only recent metrics to prevent memory issues
    if (this.metrics.length > this.MAX_STORED_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_STORED_METRICS);
    }
    
    // Log for development
    if (import.meta.env.DEV) {
      console.log('📊 [OCR Analytics] Recorded metrics:', {
        method: metrics.ocrMethod,
        confidence: metrics.confidence,
        processingTime: metrics.processingTimeMs,
        quality: metrics.inputQuality
      });
    }
    
    // Send to analytics service in production
    if (import.meta.env.PROD) {
      this.sendToAnalyticsService(metrics);
    }
  }

  /**
   * Generate performance report
   */
  static generatePerformanceReport(): {
    totalProcessed: number;
    averageConfidence: number;
    averageProcessingTime: number;
    methodDistribution: Record<string, number>;
    qualityDistribution: Record<string, number>;
    successRate: number;
    commonIssues: string[];
    recommendations: string[];
  } {
    if (this.metrics.length === 0) {
      return {
        totalProcessed: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        methodDistribution: {},
        qualityDistribution: {},
        successRate: 0,
        commonIssues: [],
        recommendations: ['No data available yet']
      };
    }

    const totalProcessed = this.metrics.length;
    const successfulOCR = this.metrics.filter(m => m.confidence > 0.5);
    const successRate = successfulOCR.length / totalProcessed;
    
    const averageConfidence = this.metrics.reduce((sum, m) => sum + m.confidence, 0) / totalProcessed;
    const averageProcessingTime = this.metrics.reduce((sum, m) => sum + m.processingTimeMs, 0) / totalProcessed;

    // Method distribution
    const methodDistribution: Record<string, number> = {};
    this.metrics.forEach(m => {
      methodDistribution[m.ocrMethod] = (methodDistribution[m.ocrMethod] || 0) + 1;
    });

    // Quality distribution
    const qualityDistribution: Record<string, number> = {};
    this.metrics.forEach(m => {
      qualityDistribution[m.inputQuality] = (qualityDistribution[m.inputQuality] || 0) + 1;
    });

    // Identify common issues
    const commonIssues: string[] = [];
    
    const lowConfidenceRate = this.metrics.filter(m => m.confidence < 0.5).length / totalProcessed;
    if (lowConfidenceRate > 0.3) {
      commonIssues.push(`High low-confidence rate: ${(lowConfidenceRate * 100).toFixed(1)}%`);
    }

    const highArtifactRate = this.metrics.filter(m => m.artifactCount > m.textLength * 0.05).length / totalProcessed;
    if (highArtifactRate > 0.2) {
      commonIssues.push(`High OCR artifact rate: ${(highArtifactRate * 100).toFixed(1)}%`);
    }

    const slowProcessingRate = this.metrics.filter(m => m.processingTimeMs > 20000).length / totalProcessed;
    if (slowProcessingRate > 0.2) {
      commonIssues.push(`Slow processing rate: ${(slowProcessingRate * 100).toFixed(1)}%`);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(methodDistribution, qualityDistribution, successRate);

    return {
      totalProcessed,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime),
      methodDistribution,
      qualityDistribution,
      successRate: Math.round(successRate * 100) / 100,
      commonIssues,
      recommendations
    };
  }

  /**
   * Generate optimization recommendations based on analytics
   */
  private static generateRecommendations(
    methodDistribution: Record<string, number>,
    qualityDistribution: Record<string, number>,
    successRate: number
  ): string[] {
    const recommendations: string[] = [];

    // Success rate recommendations
    if (successRate < 0.7) {
      recommendations.push('📉 Low success rate detected. Consider implementing additional preprocessing steps.');
    }

    // Method distribution analysis
    const mockUsage = methodDistribution.mock || 0;
    const totalProcessed = Object.values(methodDistribution).reduce((sum, count) => sum + count, 0);
    
    if (mockUsage / totalProcessed > 0.3) {
      recommendations.push('⚠️ High mock data usage. Check OCR service configuration and API keys.');
    }

    // Quality distribution analysis
    const lowQualityRate = (qualityDistribution.low || 0) / totalProcessed;
    if (lowQualityRate > 0.4) {
      recommendations.push('📸 Many low-quality inputs detected. Educate users on optimal scanning practices.');
    }

    // Performance recommendations
    if (successRate > 0.9) {
      recommendations.push('✅ Excellent OCR performance! Consider fine-tuning for even better results.');
    } else if (successRate > 0.7) {
      recommendations.push('👍 Good OCR performance. Focus on handling edge cases.');
    }

    return recommendations;
  }

  /**
   * Send metrics to analytics service (placeholder)
   */
  private static async sendToAnalyticsService(metrics: OCRMetrics): Promise<void> {
    try {
      // Replace with your actual analytics service
      // Example: Google Analytics, Mixpanel, custom backend
      
      // For now, just log aggregated metrics
      console.log('📊 [Analytics] OCR metrics:', {
        confidence: metrics.confidence,
        method: metrics.ocrMethod,
        processingTime: metrics.processingTimeMs,
        success: metrics.confidence > 0.5
      });
      
      // Example implementation:
      // await fetch('/api/analytics/ocr', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(metrics)
      // });
      
    } catch (error) {
      console.error('Failed to send OCR analytics:', error);
    }
  }

  /**
   * Get recent processing trends
   */
  static getRecentTrends(hours = 24): {
    processingVolume: number;
    averageConfidence: number;
    successRate: number;
    trendDirection: 'up' | 'down' | 'stable';
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        processingVolume: 0,
        averageConfidence: 0,
        successRate: 0,
        trendDirection: 'stable'
      };
    }

    const processingVolume = recentMetrics.length;
    const averageConfidence = recentMetrics.reduce((sum, m) => sum + m.confidence, 0) / recentMetrics.length;
    const successRate = recentMetrics.filter(m => m.confidence > 0.5).length / recentMetrics.length;

    // Simple trend analysis (compare first half vs second half)
    const midpoint = Math.floor(recentMetrics.length / 2);
    const firstHalf = recentMetrics.slice(0, midpoint);
    const secondHalf = recentMetrics.slice(midpoint);

    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, m) => sum + m.confidence, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, m) => sum + m.confidence, 0) / secondHalf.length : 0;

    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (secondHalfAvg > firstHalfAvg + 0.05) trendDirection = 'up';
    else if (secondHalfAvg < firstHalfAvg - 0.05) trendDirection = 'down';

    return {
      processingVolume,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      trendDirection
    };
  }

  /**
   * Export metrics for analysis
   */
  static exportMetrics(): string {
    const headers = [
      'sessionId', 'timestamp', 'filename', 'fileSize', 'fileType',
      'inputQuality', 'estimatedDPI', 'imageWidth', 'imageHeight',
      'processingTimeMs', 'ocrMethod', 'confidence', 'textLength',
      'hasAmount', 'hasDate', 'hasVendor', 'artifactCount'
    ];

    const rows = this.metrics.map(m => [
      m.sessionId,
      m.timestamp.toISOString(),
      m.filename,
      m.fileSize,
      m.fileType,
      m.inputQuality,
      m.estimatedDPI,
      m.imageResolution.width,
      m.imageResolution.height,
      m.processingTimeMs,
      m.ocrMethod,
      m.confidence,
      m.textLength,
      m.hasAmount,
      m.hasDate,
      m.hasVendor,
      m.artifactCount
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    return csv;
  }

  /**
   * Clear stored metrics
   */
  static clearMetrics(): void {
    this.metrics = [];
    console.log('📊 [OCR Analytics] Metrics cleared');
  }
}

/**
 * Helper function to create OCR metrics from processing results
 */
export function createOCRMetrics(
  file: File,
  startTime: number,
  result: any,
  quality: any
): OCRMetrics {
  const processingTimeMs = Date.now() - startTime;
  
  // Analyze result for validation metrics
  const hasAmount = /\$|€|£|¥|₹|\d+[\.,]\d{2}/.test(result.text || '');
  const hasDate = /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(result.text || '');
  const hasVendor = /\b[A-Z][a-z]+ (?:Corp|Inc|Ltd|LLC|GmbH|SA|SRL)\b/i.test(result.text || '');
  
  const ocrArtifacts = /[^\w\s\-.,;:()$€£¥₹@#%&*+=<>[\]{}|\\\/'"!?]/g;
  const artifactCount = (result.text?.match(ocrArtifacts) || []).length;

  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    filename: file.name,
    fileSize: file.size,
    fileType: file.type,
    
    inputQuality: quality?.estimatedQuality || 'medium',
    estimatedDPI: quality?.dpi || 150,
    imageResolution: quality?.resolution || { width: 0, height: 0 },
    
    processingTimeMs,
    ocrMethod: result.method || 'unknown',
    processingSteps: result.processingSteps || [],
    
    confidence: result.confidence || 0,
    textLength: (result.text || '').length,
    detectedLanguage: 'en', // Could be enhanced with language detection
    
    hasAmount,
    hasDate,
    hasVendor,
    artifactCount
  };
}