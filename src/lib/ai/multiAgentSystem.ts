// ============================================
// MULTI-AGENT SYSTEM ARCHITECTURE
// Core agent implementations for Invoice AI
// ============================================

import { supabase } from '../supabase';

// ============================================
// BASE AGENT CLASS
// ============================================

export abstract class BaseAgent {
  protected agentName: string;
  protected userId: string;

  constructor(agentName: string, userId: string) {
    this.agentName = agentName;
    this.userId = userId;
  }

  protected async logExecution(
    invoiceId: string | null,
    status: 'started' | 'completed' | 'failed',
    executionTimeMs: number,
    inputData: any,
    outputData: any,
    errorMessage: string | null = null
  ) {
    try {
      await supabase.from('agent_execution_logs').insert({
        user_id: this.userId,
        invoice_id: invoiceId,
        agent_name: this.agentName,
        status,
        execution_time_ms: executionTimeMs,
        input_data: inputData,
        output_data: outputData,
        error_message: errorMessage
      });
    } catch (error) {
      console.error(`Failed to log ${this.agentName} execution:`, error);
    }
  }

  protected async consumeTokens(
    operationType: string,
    tokensToConsume: number = 1,
    aiProvider: string | null = null,
    invoiceId: string | null = null
  ): Promise<{success: boolean; error?: string}> {
    try {
      const { data, error } = await supabase.rpc('consume_tokens', {
        p_user_id: this.userId,
        p_tokens_to_consume: tokensToConsume,
        p_agent_name: this.agentName,
        p_operation_type: operationType,
        p_ai_provider: aiProvider,
        p_invoice_id: invoiceId
      });

      if (error) throw error;
      return data as any;
    } catch (error) {
      console.error('Token consumption error:', error);
      return { success: false, error: 'Failed to consume tokens' };
    }
  }

  abstract execute(input: any): Promise<any>;
}

// ============================================
// 1. INGESTION AGENT
// ============================================

export interface IngestionInput {
  file: File;
  source: 'upload' | 'email' | 'drive' | 'api';
}

export interface IngestionOutput {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  invoiceId: string;
  valid: boolean;
  errors: string[];
}

export class IngestionAgent extends BaseAgent {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

  constructor(userId: string) {
    super('ingestion', userId);
  }

  async execute(input: IngestionInput): Promise<IngestionOutput> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      await this.logExecution(null, 'started', 0, { fileName: input.file.name }, null);

      // Validation
      if (input.file.size > this.MAX_FILE_SIZE) {
        errors.push('File size exceeds 10MB limit');
      }

      if (!this.ALLOWED_TYPES.includes(input.file.type)) {
        errors.push('Invalid file type. Only JPEG, PNG, and PDF allowed');
      }

      if (errors.length > 0) {
        await this.logExecution(null, 'failed', Date.now() - startTime, input, { errors }, errors.join(', '));
        return {
          fileUrl: '',
          fileName: input.file.name,
          fileSize: input.file.size,
          fileType: input.file.type,
          invoiceId: '',
          valid: false,
          errors
        };
      }

      // Upload to storage
      const fileName = `${this.userId}/${Date.now()}_${input.file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, input.file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('invoices')
        .getPublicUrl(fileName);

      // Create invoice record
      const { data: invoice, error: dbError } = await supabase
        .from('invoices')
        .insert({
          user_id: this.userId,
          file_name: input.file.name,
          file_url: publicUrl,
          file_size: input.file.size,
          status: 'processing',
          processing_pipeline: {
            ingestion: { completed: true, timestamp: new Date().toISOString() }
          }
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const output: IngestionOutput = {
        fileUrl: publicUrl,
        fileName: input.file.name,
        fileSize: input.file.size,
        fileType: input.file.type,
        invoiceId: invoice.id,
        valid: true,
        errors: []
      };

      await this.logExecution(invoice.id, 'completed', Date.now() - startTime, input, output);
      return output;

    } catch (error: any) {
      await this.logExecution(null, 'failed', Date.now() - startTime, input, null, error.message);
      throw error;
    }
  }
}

// ============================================
// 2. OCR AGENT
// ============================================

export interface OCRInput {
  invoiceId: string;
  fileUrl: string;
  fileType: string;
}

export interface OCROutput {
  invoiceId: string;
  text: string;
  confidence: number;
  method: string;
  processingSteps: string[];
}

export class OCRAgent extends BaseAgent {
  constructor(userId: string) {
    super('ocr', userId);
  }

  async execute(input: OCRInput): Promise<OCROutput> {
    const startTime = Date.now();

    try {
      await this.logExecution(input.invoiceId, 'started', 0, input, null);

      // Consume tokens
      const tokenResult = await this.consumeTokens('ocr', 2, 'tesseract', input.invoiceId);
      if (!tokenResult.success) {
        throw new Error(tokenResult.error || 'Insufficient tokens');
      }

      // Use existing OCR service (Tesseract.js)
      const { EnhancedOCRService } = await import('./enhancedOCRService');
      
      // Fetch file
      const response = await fetch(input.fileUrl);
      const blob = await response.blob();
      const file = new File([blob], 'invoice', { type: input.fileType });

      const result = await EnhancedOCRService.extractTextWithMetadata(file);

      // Update invoice
      await supabase
        .from('invoices')
        .update({
          processing_pipeline: {
            ingestion: { completed: true },
            ocr: { completed: true, timestamp: new Date().toISOString() }
          },
          tokens_used: 2
        })
        .eq('id', input.invoiceId);

      const output: OCROutput = {
        invoiceId: input.invoiceId,
        text: result.text,
        confidence: result.confidence,
        method: result.method,
        processingSteps: result.processingSteps || []
      };

      await this.logExecution(input.invoiceId, 'completed', Date.now() - startTime, input, output);
      return output;

    } catch (error: any) {
      await this.logExecution(input.invoiceId, 'failed', Date.now() - startTime, input, null, error.message);
      throw error;
    }
  }
}

// ============================================
// 3. CLASSIFICATION AGENT
// ============================================

export interface ClassificationInput {
  invoiceId: string;
  ocrText: string;
  vendor: string;
}

export interface ClassificationOutput {
  invoiceId: string;
  classification: 'service' | 'product' | 'recurring' | 'medical' | 'other';
  language: string;
  confidence: number;
}

export class ClassificationAgent extends BaseAgent {
  constructor(userId: string) {
    super('classification', userId);
  }

  async execute(input: ClassificationInput): Promise<ClassificationOutput> {
    const startTime = Date.now();

    try {
      await this.logExecution(input.invoiceId, 'started', 0, input, null);

      // Consume tokens
      const tokenResult = await this.consumeTokens('classification', 1, 'local', input.invoiceId);
      if (!tokenResult.success) {
        throw new Error(tokenResult.error || 'Insufficient tokens');
      }

      // Language detection
      const language = this.detectLanguage(input.ocrText);

      // Classification logic
      const classification = this.classifyInvoice(input.ocrText, input.vendor);

      // Calculate confidence
      const confidence = this.calculateConfidence(input.ocrText, classification);

      // Update invoice
      await supabase
        .from('invoices')
        .update({
          classification,
          language,
          processing_pipeline: {
            ingestion: { completed: true },
            ocr: { completed: true },
            classification: { completed: true, timestamp: new Date().toISOString() }
          }
        })
        .eq('id', input.invoiceId);

      const output: ClassificationOutput = {
        invoiceId: input.invoiceId,
        classification,
        language,
        confidence
      };

      await this.logExecution(input.invoiceId, 'completed', Date.now() - startTime, input, output);
      return output;

    } catch (error: any) {
      await this.logExecution(input.invoiceId, 'failed', Date.now() - startTime, input, null, error.message);
      throw error;
    }
  }

  private detectLanguage(text: string): string {
    const patterns: Record<string, RegExp> = {
      'en': /\b(invoice|bill|total|amount|date|vendor|company)\b/i,
      'es': /\b(factura|total|cantidad|fecha|empresa)\b/i,
      'fr': /\b(facture|total|montant|date|entreprise)\b/i,
      'de': /\b(rechnung|gesamt|betrag|datum|unternehmen)\b/i,
      'ar': /[\u0600-\u06FF]/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }
    return 'en';
  }

  private classifyInvoice(text: string, vendor: string): 'service' | 'product' | 'recurring' | 'medical' | 'other' {
    const lowerText = text.toLowerCase();
    const lowerVendor = vendor.toLowerCase();

    if (/\b(monthly|quarterly|annual|subscription|recurring|renewal)\b/i.test(lowerText + lowerVendor)) {
      return 'recurring';
    }
    if (/\b(medical|hospital|clinic|pharmacy|doctor|health|medication)\b/i.test(lowerText + lowerVendor)) {
      return 'medical';
    }
    if (/\b(consulting|service|support|maintenance|license|software)\b/i.test(lowerText + lowerVendor)) {
      return 'service';
    }
    if (/\b(product|goods|equipment|hardware|materials|supplies)\b/i.test(lowerText + lowerVendor)) {
      return 'product';
    }
    return 'other';
  }

  private calculateConfidence(text: string, classification: string): number {
    const keywords = {
      service: ['consulting', 'service', 'support'],
      product: ['product', 'goods', 'equipment'],
      recurring: ['monthly', 'subscription', 'recurring'],
      medical: ['medical', 'hospital', 'clinic'],
      other: []
    };

    const classKeywords = keywords[classification as keyof typeof keywords] || [];
    const matches = classKeywords.filter(kw => text.toLowerCase().includes(kw)).length;
    return Math.min(0.5 + (matches * 0.15), 0.95);
  }
}

// ============================================
// 4. FRAUD DETECTION AGENT
// ============================================

export interface FraudDetectionInput {
  invoiceId: string;
  amount: number;
  vendor: string;
  date: string;
  taxId: string | null;
  ocrConfidence: number;
}

export interface FraudDetectionOutput {
  invoiceId: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  flags: string[];
  reasons: string[];
  recommendations: string[];
}

export class FraudDetectionAgent extends BaseAgent {
  constructor(userId: string) {
    super('fraud_detection', userId);
  }

  async execute(input: FraudDetectionInput): Promise<FraudDetectionOutput> {
    const startTime = Date.now();

    try {
      await this.logExecution(input.invoiceId, 'started', 0, input, null);

      // Consume tokens
      const tokenResult = await this.consumeTokens('fraud_detection', 2, 'local', input.invoiceId);
      if (!tokenResult.success) {
        throw new Error(tokenResult.error || 'Insufficient tokens');
      }

      // Get historical data
      const { data: historicalInvoices } = await supabase
        .from('invoices')
        .select('amount, vendor_name, invoice_date')
        .eq('user_id', this.userId)
        .eq('status', 'completed');

      const history = (historicalInvoices || []).map(inv => ({
        amount: inv.amount || 0,
        vendor: inv.vendor_name || '',
        date: inv.invoice_date || ''
      }));

      // Analyze fraud
      const analysis = this.analyzeInvoice(input, history);

      // Update invoice
      await supabase
        .from('invoices')
        .update({
          fraud_risk: analysis.riskLevel,
          fraud_score: analysis.riskScore,
          fraud_reasons: analysis.reasons,
          processing_pipeline: {
            ingestion: { completed: true },
            ocr: { completed: true },
            classification: { completed: true },
            fraud_detection: { completed: true, timestamp: new Date().toISOString() }
          }
        })
        .eq('id', input.invoiceId);

      const output: FraudDetectionOutput = {
        invoiceId: input.invoiceId,
        ...analysis
      };

      await this.logExecution(input.invoiceId, 'completed', Date.now() - startTime, input, output);
      return output;

    } catch (error: any) {
      await this.logExecution(input.invoiceId, 'failed', Date.now() - startTime, input, null, error.message);
      throw error;
    }
  }

  private analyzeInvoice(invoice: FraudDetectionInput, history: any[]): Omit<FraudDetectionOutput, 'invoiceId'> {
    const flags: string[] = [];
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Amount analysis
    if (invoice.amount > 10000) {
      riskScore += 0.3;
      flags.push('HIGH_AMOUNT');
      reasons.push('Invoice amount exceeds $10,000');
      recommendations.push('Verify invoice with vendor');
    }

    // Vendor analysis
    const vendorHistory = history.filter(h => h.vendor === invoice.vendor);
    if (vendorHistory.length === 0) {
      riskScore += 0.2;
      flags.push('NEW_VENDOR');
      reasons.push('First time vendor');
      recommendations.push('Verify vendor legitimacy');
    } else {
      const avgAmount = vendorHistory.reduce((sum, h) => sum + h.amount, 0) / vendorHistory.length;
      const deviation = Math.abs(invoice.amount - avgAmount) / avgAmount;
      if (deviation > 2) {
        riskScore += 0.4;
        flags.push('AMOUNT_ANOMALY');
        reasons.push(`Amount deviates significantly from vendor average ($${avgAmount.toFixed(2)})`);
        recommendations.push('Confirm amount with vendor');
      }
    }

    // Date analysis
    const invoiceDate = new Date(invoice.date);
    const now = new Date();
    const daysDiff = Math.abs((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      riskScore += 0.2;
      flags.push('OLD_INVOICE');
      reasons.push('Invoice date is more than 90 days old');
    }

    // OCR confidence
    if (invoice.ocrConfidence < 0.7) {
      riskScore += 0.3;
      flags.push('LOW_OCR_CONFIDENCE');
      reasons.push('Low OCR confidence in text extraction');
      recommendations.push('Review invoice manually');
    }

    // Tax ID validation
    if (!invoice.taxId || invoice.taxId.length < 5) {
      riskScore += 0.1;
      flags.push('MISSING_TAX_ID');
      reasons.push('Missing or invalid tax ID');
    }

    // Duplicate detection
    const duplicates = history.filter(h =>
      h.amount === invoice.amount &&
      h.vendor === invoice.vendor &&
      Math.abs(new Date(h.date).getTime() - invoiceDate.getTime()) < (7 * 24 * 60 * 60 * 1000)
    );
    if (duplicates.length > 0) {
      riskScore += 0.5;
      flags.push('POTENTIAL_DUPLICATE');
      reasons.push('Similar invoice found within 7 days');
      recommendations.push('Check for duplicate payment');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore >= 0.7) {
      riskLevel = 'high';
    } else if (riskScore >= 0.4) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      riskLevel,
      riskScore: Math.min(riskScore, 1.0),
      flags,
      reasons,
      recommendations
    };
  }
}

// ============================================
// 5. TAX COMPLIANCE AGENT
// ============================================

export interface TaxComplianceInput {
  invoiceId: string;
  amount: number;
  taxId: string | null;
  taxRegion: string;
  vendor: string;
}

export interface TaxComplianceOutput {
  invoiceId: string;
  vatAmount: number;
  vatRate: number;
  taxRegion: string;
  complianceStatus: 'compliant' | 'non_compliant' | 'needs_review';
  issues: string[];
  recommendations: string[];
}

export class TaxComplianceAgent extends BaseAgent {
  private readonly VAT_RATES: Record<string, number> = {
    'EU': 0.20,
    'UK': 0.20,
    'US': 0.0875,
    'UAE': 0.05,
    'SA': 0.15,
    'default': 0.10
  };

  constructor(userId: string) {
    super('tax_compliance', userId);
  }

  async execute(input: TaxComplianceInput): Promise<TaxComplianceOutput> {
    const startTime = Date.now();

    try {
      await this.logExecution(input.invoiceId, 'started', 0, input, null);

      // Consume tokens
      const tokenResult = await this.consumeTokens('tax_compliance', 1, 'local', input.invoiceId);
      if (!tokenResult.success) {
        throw new Error(tokenResult.error || 'Insufficient tokens');
      }

      const vatRate = this.VAT_RATES[input.taxRegion] || this.VAT_RATES['default'];
      const vatAmount = input.amount * vatRate;

      const issues: string[] = [];
      const recommendations: string[] = [];

      // Validation
      if (!input.taxId) {
        issues.push('Missing tax ID');
        recommendations.push('Request tax ID from vendor');
      }

      if (input.taxId && !this.validateTaxId(input.taxId, input.taxRegion)) {
        issues.push('Invalid tax ID format');
        recommendations.push('Verify tax ID with vendor');
      }

      const complianceStatus = issues.length === 0 ? 'compliant' : 
                             issues.length > 2 ? 'non_compliant' : 'needs_review';

      // Update invoice
      await supabase
        .from('invoices')
        .update({
          tax_region: input.taxRegion,
          vat_amount: vatAmount,
          tax_compliance_status: complianceStatus,
          processing_pipeline: {
            ingestion: { completed: true },
            ocr: { completed: true },
            classification: { completed: true },
            fraud_detection: { completed: true },
            tax_compliance: { completed: true, timestamp: new Date().toISOString() }
          }
        })
        .eq('id', input.invoiceId);

      const output: TaxComplianceOutput = {
        invoiceId: input.invoiceId,
        vatAmount,
        vatRate,
        taxRegion: input.taxRegion,
        complianceStatus,
        issues,
        recommendations
      };

      await this.logExecution(input.invoiceId, 'completed', Date.now() - startTime, input, output);
      return output;

    } catch (error: any) {
      await this.logExecution(input.invoiceId, 'failed', Date.now() - startTime, input, null, error.message);
      throw error;
    }
  }

  private validateTaxId(taxId: string, region: string): boolean {
    const patterns: Record<string, RegExp> = {
      'US': /^\d{2}-\d{7}$/,
      'EU': /^[A-Z]{2}\d{8,12}$/,
      'UK': /^GB\d{9}$/,
      'UAE': /^\d{15}$/,
      'SA': /^\d{15}$/
    };

    const pattern = patterns[region];
    return pattern ? pattern.test(taxId) : taxId.length >= 5;
  }
}

// ============================================
// 6. REPORTING AGENT
// ============================================

export interface ReportingInput {
  invoiceId: string;
  format: 'json' | 'csv' | 'pdf';
}

export interface ReportingOutput {
  invoiceId: string;
  reportUrl: string | null;
  reportData: any;
  format: string;
}

export class ReportingAgent extends BaseAgent {
  constructor(userId: string) {
    super('reporting', userId);
  }

  async execute(input: ReportingInput): Promise<ReportingOutput> {
    const startTime = Date.now();

    try {
      await this.logExecution(input.invoiceId, 'started', 0, input, null);

      // Consume tokens
      const tokenResult = await this.consumeTokens('reporting', 1, 'local', input.invoiceId);
      if (!tokenResult.success) {
        throw new Error(tokenResult.error || 'Insufficient tokens');
      }

      // Get invoice data
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', input.invoiceId)
        .single();

      if (!invoice) throw new Error('Invoice not found');

      let reportData: any;
      let reportUrl: string | null = null;

      switch (input.format) {
        case 'json':
          reportData = this.generateJsonReport(invoice);
          break;
        case 'csv':
          reportData = this.generateCsvReport(invoice);
          break;
        case 'pdf':
          reportData = { message: 'PDF generation not yet implemented' };
          break;
        default:
          reportData = invoice;
      }

      // Update invoice
      await supabase
        .from('invoices')
        .update({
          status: 'completed',
          processing_pipeline: {
            ingestion: { completed: true },
            ocr: { completed: true },
            classification: { completed: true },
            fraud_detection: { completed: true },
            tax_compliance: { completed: true },
            reporting: { completed: true, timestamp: new Date().toISOString() }
          }
        })
        .eq('id', input.invoiceId);

      const output: ReportingOutput = {
        invoiceId: input.invoiceId,
        reportUrl,
        reportData,
        format: input.format
      };

      await this.logExecution(input.invoiceId, 'completed', Date.now() - startTime, input, output);
      return output;

    } catch (error: any) {
      await this.logExecution(input.invoiceId, 'failed', Date.now() - startTime, input, null, error.message);
      throw error;
    }
  }

  private generateJsonReport(invoice: any) {
    return {
      invoice_id: invoice.id,
      vendor: invoice.vendor_name,
      amount: invoice.amount,
      currency: invoice.currency,
      date: invoice.invoice_date,
      tax_id: invoice.tax_id,
      classification: invoice.classification,
      fraud_risk: invoice.fraud_risk,
      fraud_score: invoice.fraud_score,
      tax_compliance: invoice.tax_compliance_status,
      vat_amount: invoice.vat_amount,
      processed_at: invoice.updated_at
    };
  }

  private generateCsvReport(invoice: any) {
    const headers = ['Invoice ID', 'Vendor', 'Amount', 'Currency', 'Date', 'Tax ID', 'Classification', 'Fraud Risk', 'VAT Amount'];
    const values = [
      invoice.id,
      invoice.vendor_name,
      invoice.amount,
      invoice.currency,
      invoice.invoice_date,
      invoice.tax_id,
      invoice.classification,
      invoice.fraud_risk,
      invoice.vat_amount
    ];
    return `${headers.join(',')}\n${values.join(',')}`;
  }
}

// ============================================
// ORCHESTRATOR
// ============================================

export class InvoiceProcessingOrchestrator {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async processInvoice(file: File): Promise<any> {
    console.log('🎯 Starting invoice processing orchestration');

    try {
      // Step 1: Ingestion
      const ingestionAgent = new IngestionAgent(this.userId);
      const ingestionResult = await ingestionAgent.execute({ file, source: 'upload' });
      console.log('✅ Ingestion completed:', ingestionResult.invoiceId);

      // Step 2: OCR
      const ocrAgent = new OCRAgent(this.userId);
      const ocrResult = await ocrAgent.execute({
        invoiceId: ingestionResult.invoiceId,
        fileUrl: ingestionResult.fileUrl,
        fileType: ingestionResult.fileType
      });
      console.log('✅ OCR completed:', ocrResult.confidence);

      // Step 3: Classification
      const classificationAgent = new ClassificationAgent(this.userId);
      const classificationResult = await classificationAgent.execute({
        invoiceId: ingestionResult.invoiceId,
        ocrText: ocrResult.text,
        vendor: 'Unknown' // Will be extracted by AI
      });
      console.log('✅ Classification completed:', classificationResult.classification);

      // Step 4: Fraud Detection
      const fraudAgent = new FraudDetectionAgent(this.userId);
      const fraudResult = await fraudAgent.execute({
        invoiceId: ingestionResult.invoiceId,
        amount: 0, // Will be extracted by AI
        vendor: 'Unknown',
        date: new Date().toISOString(),
        taxId: null,
        ocrConfidence: ocrResult.confidence
      });
      console.log('✅ Fraud Detection completed:', fraudResult.riskLevel);

      // Step 5: Tax Compliance
      const taxAgent = new TaxComplianceAgent(this.userId);
      const taxResult = await taxAgent.execute({
        invoiceId: ingestionResult.invoiceId,
        amount: 0,
        taxId: null,
        taxRegion: 'US',
        vendor: 'Unknown'
      });
      console.log('✅ Tax Compliance completed:', taxResult.complianceStatus);

      // Step 6: Reporting
      const reportingAgent = new ReportingAgent(this.userId);
      const reportResult = await reportingAgent.execute({
        invoiceId: ingestionResult.invoiceId,
        format: 'json'
      });
      console.log('✅ Reporting completed');

      return {
        invoiceId: ingestionResult.invoiceId,
        status: 'completed',
        results: {
          ingestion: ingestionResult,
          ocr: ocrResult,
          classification: classificationResult,
          fraud: fraudResult,
          tax: taxResult,
          report: reportResult
        }
      };

    } catch (error: any) {
      console.error('❌ Orchestration failed:', error);
      throw error;
    }
  }
}