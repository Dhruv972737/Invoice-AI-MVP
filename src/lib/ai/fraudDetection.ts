export interface FraudAnalysis {
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  flags: string[];
  reasons: string[];
}

export class FraudDetectionService {
  static analyzeInvoice(invoiceData: {
    amount: number;
    vendor: string;
    date: string;
    taxId?: string;
    ocrConfidence: number;
  }, historicalData: Array<{
    amount: number;
    vendor: string;
    date: string;
  }>): FraudAnalysis {
    const flags: string[] = [];
    const reasons: string[] = [];
    let riskScore = 0;

    // 1. Amount Analysis
    if (invoiceData.amount > 10000) {
      riskScore += 0.3;
      flags.push('HIGH_AMOUNT');
      reasons.push('Invoice amount exceeds $10,000');
    }

    // 2. Vendor Analysis
    const vendorHistory = historicalData.filter(h => h.vendor === invoiceData.vendor);
    if (vendorHistory.length === 0) {
      riskScore += 0.2;
      flags.push('NEW_VENDOR');
      reasons.push('First time vendor');
    } else {
      // Check for unusual amounts from known vendor
      const avgAmount = vendorHistory.reduce((sum, h) => sum + h.amount, 0) / vendorHistory.length;
      const deviation = Math.abs(invoiceData.amount - avgAmount) / avgAmount;
      
      if (deviation > 2) {
        riskScore += 0.4;
        flags.push('AMOUNT_ANOMALY');
        reasons.push(`Amount deviates significantly from vendor average ($${avgAmount.toFixed(2)})`);
      }
    }

    // 3. Date Analysis
    const invoiceDate = new Date(invoiceData.date);
    const now = new Date();
    const daysDiff = Math.abs((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 90) {
      riskScore += 0.2;
      flags.push('OLD_INVOICE');
      reasons.push('Invoice date is more than 90 days old');
    }

    // 4. Weekend/Holiday Check
    const dayOfWeek = invoiceDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      riskScore += 0.1;
      flags.push('WEEKEND_INVOICE');
      reasons.push('Invoice dated on weekend');
    }

    // 5. OCR Confidence
    if (invoiceData.ocrConfidence < 0.7) {
      riskScore += 0.3;
      flags.push('LOW_OCR_CONFIDENCE');
      reasons.push('Low OCR confidence in text extraction');
    }

    // 6. Tax ID Validation
    if (!invoiceData.taxId || invoiceData.taxId.length < 5) {
      riskScore += 0.1;
      flags.push('MISSING_TAX_ID');
      reasons.push('Missing or invalid tax ID');
    }

    // 7. Duplicate Detection
    const duplicates = historicalData.filter(h => 
      h.amount === invoiceData.amount && 
      h.vendor === invoiceData.vendor &&
      Math.abs(new Date(h.date).getTime() - invoiceDate.getTime()) < (7 * 24 * 60 * 60 * 1000)
    );

    if (duplicates.length > 0) {
      riskScore += 0.5;
      flags.push('POTENTIAL_DUPLICATE');
      reasons.push('Similar invoice found within 7 days');
    }

    // 8. Round Number Analysis
    if (invoiceData.amount % 100 === 0 && invoiceData.amount > 1000) {
      riskScore += 0.1;
      flags.push('ROUND_AMOUNT');
      reasons.push('Suspiciously round amount');
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
      reasons
    };
  }

  static calculateVAT(amount: number, region: string): number {
    const vatRates: { [key: string]: number } = {
      'EU': 0.20,      // Standard EU VAT rate
      'UK': 0.20,      // UK VAT rate
      'US': 0.0875,    // Average US sales tax
      'UAE': 0.05,     // UAE VAT rate
      'SA': 0.15,      // Saudi Arabia VAT rate
      'default': 0.10  // Default rate
    };

    const rate = vatRates[region] || vatRates['default'];
    return amount * rate;
  }

  static detectLanguage(text: string): string {
    // Simple language detection based on common words
    const patterns = {
      'en': /\b(invoice|bill|total|amount|date|vendor|company)\b/i,
      'es': /\b(factura|total|cantidad|fecha|empresa)\b/i,
      'fr': /\b(facture|total|montant|date|entreprise)\b/i,
      'de': /\b(rechnung|gesamt|betrag|datum|unternehmen)\b/i,
      'ar': /[\u0600-\u06FF]/,
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return lang;
      }
    }

    return 'en'; // Default to English
  }

  static classifyInvoice(text: string, vendor: string): 'service' | 'product' | 'recurring' {
    const serviceKeywords = /\b(consulting|service|support|maintenance|subscription|license|software)\b/i;
    const productKeywords = /\b(product|goods|equipment|hardware|materials|supplies)\b/i;
    const recurringKeywords = /\b(monthly|quarterly|annual|subscription|recurring|renewal)\b/i;

    if (recurringKeywords.test(text) || recurringKeywords.test(vendor)) {
      return 'recurring';
    } else if (serviceKeywords.test(text) || serviceKeywords.test(vendor)) {
      return 'service';
    } else {
      return 'product';
    }
  }
}