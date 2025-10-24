import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InvoiceContext {
  totalInvoices: number;
  totalAmount: number;
  vendors: string[];
  highRiskCount: number;
  monthlyData: Array<{ month: string; amount: number; count: number }>;
  recentInvoices: Array<{
    vendor: string;
    amount: number;
    date: string;
    risk: string;
  }>;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private availableModels: string[] = [];
  private selectedModel: string | null = null;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    console.log('🤖 Gemini AI service initialized');
  }

  private async getAvailableModels(): Promise<string[]> {
    if (this.availableModels.length > 0) {
      return this.availableModels;
    }

    // Use hardcoded list of common models since listModels() is not available
    this.availableModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];
    console.log('🤖 Using hardcoded Gemini models:', this.availableModels);
    return this.availableModels;
  }

  private async selectBestModel(): Promise<string> {
    if (this.selectedModel) {
      return this.selectedModel;
    }

    const available = await this.getAvailableModels();
    
    // Priority order: prefer more widely available models first
    const priorities = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-flash-latest',
      'gemini-pro-latest'
    ];

    for (const preferred of priorities) {
      if (available.includes(preferred)) {
        this.selectedModel = preferred;
        console.log('🤖 Selected Gemini model:', this.selectedModel);
        return this.selectedModel;
      }
    }

    // If no preferred models found, use the first available
    if (available.length > 0) {
      this.selectedModel = available[0];
      console.log('🤖 Using first available model:', this.selectedModel);
      return this.selectedModel;
    }

    throw new Error('No compatible models available');
  }

  private async generateWithModel(modelName: string, prompt: string): Promise<string> {
    console.log(`🤖 Generating response with model: ${modelName}`);
    const model = this.genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  async generateResponse(
    message: string, 
    context: InvoiceContext,
    chatHistory: ChatMessage[] = []
  ): Promise<string> {
    try {
      console.log('🤖 Generating AI response for message:', message.substring(0, 100) + '...');
      const systemPrompt = this.buildSystemPrompt(context);
      const conversationHistory = this.buildConversationHistory(chatHistory);
      
      const prompt = `${systemPrompt}\n\n${conversationHistory}\n\nUser: ${message}\n\nAssistant:`;
      
      // Try with selected model first
      try {
        const modelName = await this.selectBestModel();
        return await this.generateWithModel(modelName, prompt);
      } catch (error) {
        console.warn('🤖 Primary model failed, trying fallback:', error);
        
        // If primary model fails with 404, try another available model
        if (error instanceof Error && error.message.includes('404')) {
          const available = await this.getAvailableModels();
          const fallbackModels = available.filter(m => m !== this.selectedModel);
          
          for (const fallbackModel of fallbackModels.slice(0, 2)) { // Try up to 2 fallbacks
            try {
              console.log('🤖 Trying fallback model:', fallbackModel);
              return await this.generateWithModel(fallbackModel, prompt);
            } catch (fallbackError) {
              console.warn(`🤖 Fallback model ${fallbackModel} failed:`, fallbackError);
              continue;
            }
          }
        }
        
        throw error; // Re-throw if all models failed
      }
    } catch (error) {
      console.error('🤖 Gemini API error:', error);
      
      // Check if it's a quota/rate limit error
      if (error instanceof Error && 
          (error.message.includes('quota') || 
           error.message.includes('429') ||
           error.message.includes('rate limit') ||
           error.message.includes('exceeded your current quota'))) {
        console.warn('🤖 Gemini API quota exceeded - this is expected with free tier limits');
        throw new Error('QUOTA_EXCEEDED');
      }
      
      // If all models failed with 404 or access issues, treat as quota exceeded for graceful fallback
      if (error instanceof Error && error.message.includes('404')) {
        console.warn('🤖 All Gemini models inaccessible - treating as quota exceeded');
        throw new Error('QUOTA_EXCEEDED');
      }
      
      // For other errors, return graceful fallback
      return 'AI response failed (fallback). Please try again or check your API key/quota.';
    }
  }

  private buildSystemPrompt(context: InvoiceContext): string {
    return `You are an AI assistant specialized in invoice analysis and financial data insights. You have access to the user's invoice data with the following context:

INVOICE SUMMARY:
- Total Invoices: ${context.totalInvoices}
- Total Amount: $${context.totalAmount.toFixed(2)}
- High Risk Invoices: ${context.highRiskCount}
- Unique Vendors: ${context.vendors.length}
- Top Vendors: ${context.vendors.slice(0, 5).join(', ')}

RECENT INVOICES:
${context.recentInvoices.map(inv => 
  `- ${inv.vendor}: $${inv.amount} (${inv.date}) - Risk: ${inv.risk}`
).join('\n')}

MONTHLY TRENDS:
${context.monthlyData.map(data => 
  `- ${data.month}: $${data.amount.toFixed(2)} (${data.count} invoices)`
).join('\n')}

Please provide helpful, accurate responses about the user's invoice data. Be concise but informative. When discussing financial data, always include relevant numbers and context.`;
  }

  private buildConversationHistory(history: ChatMessage[]): string {
    return history.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');
  }

  async analyzeInvoiceText(ocrText: string): Promise<{
    vendor: string | null;
    amount: number | null;
    date: string | null;
    taxId: string | null;
    currency: string;
    confidence: number;
  }> {
    try {
      console.log('🤖 Analyzing invoice text with Gemini AI...');
      const prompt = `Analyze this invoice OCR text and extract key information. Return a JSON object with the following fields:
- vendor: company/vendor name
- amount: total amount (number only)
- date: invoice date in YYYY-MM-DD format
- taxId: tax ID or VAT number if found
- currency: currency code (USD, EUR, etc.)
- confidence: confidence score 0-1

OCR Text:
${ocrText}

Return only valid JSON:`;

      // Try with selected model first
      let responseText: string;
      try {
        const modelName = await this.selectBestModel();
        responseText = await this.generateWithModel(modelName, prompt);
      } catch (error) {
        console.warn('🤖 Primary model failed for invoice analysis, trying fallback:', error);
        
        // If primary model fails with 404, try another available model
        if (error instanceof Error && error.message.includes('404')) {
          const available = await this.getAvailableModels();
          const fallbackModels = available.filter(m => m !== this.selectedModel);
          
          let fallbackSuccess = false;
          for (const fallbackModel of fallbackModels.slice(0, 2)) { // Try up to 2 fallbacks
            try {
              console.log('🤖 Trying fallback model for invoice analysis:', fallbackModel);
              responseText = await this.generateWithModel(fallbackModel, prompt);
              fallbackSuccess = true;
              break;
            } catch (fallbackError) {
              console.warn(`🤖 Fallback model ${fallbackModel} failed:`, fallbackError);
              continue;
            }
          }
          
          if (!fallbackSuccess) {
            throw error; // Re-throw if all models failed
          }
        } else {
          throw error;
        }
      }
      
      // Try to parse JSON response
      try {
        const parsed = JSON.parse(responseText!);
        console.log('🤖 Successfully parsed Gemini response');
        return {
          vendor: parsed.vendor || null,
          amount: parsed.amount ? parseFloat(parsed.amount) : null,
          date: parsed.date || null,
          taxId: parsed.taxId || null,
          currency: parsed.currency || 'USD',
          confidence: parsed.confidence || 0.7
        };
      } catch (parseError) {
        console.error('🤖 Failed to parse Gemini JSON response:', parseError);
        return {
          vendor: null,
          amount: null,
          date: null,
          taxId: null,
          currency: 'USD',
          confidence: 0.5
        };
      }
    } catch (error) {
      console.error('🤖 Gemini analysis error:', error);
      
      // Check if it's a quota/rate limit error
      if (error instanceof Error && 
          (error.message.includes('quota') || 
           error.message.includes('429') ||
           error.message.includes('rate limit') ||
           error.message.includes('exceeded your current quota'))) {
        console.warn('🤖 Gemini API quota exceeded - this is expected with free tier limits');
        // Re-throw quota errors to trigger specific UI handling
        throw new Error('QUOTA_EXCEEDED');
      }
      
      // If all models failed with 404 or access issues, treat as quota exceeded
      if (error instanceof Error && error.message.includes('404')) {
        console.warn('🤖 All Gemini models inaccessible for invoice analysis - treating as quota exceeded');
        throw new Error('QUOTA_EXCEEDED');
      }
      
      // For other errors, return default fallback object
      return {
        vendor: null,
        amount: null,
        date: null,
        taxId: null,
        currency: 'USD',
        confidence: 0.0
      };
    }
  }
}

// Helper functions for easy integration
export async function generateResponse(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('🤖 VITE_GEMINI_API_KEY not found in environment variables');
    return 'AI service unavailable (missing API key)';
  }

  try {
    const service = new GeminiService(apiKey);
    const emptyContext: InvoiceContext = {
      totalInvoices: 0,
      totalAmount: 0,
      vendors: [],
      highRiskCount: 0,
      monthlyData: [],
      recentInvoices: []
    };
    
    return await service.generateResponse(prompt, emptyContext);
  } catch (error) {
    console.error('🤖 Helper generateResponse error:', error);
    return 'AI extraction failed (fallback)';
  }
}

export async function analyzeInvoiceText(invoiceText: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('🤖 VITE_GEMINI_API_KEY not found in environment variables');
    return 'AI extraction failed (fallback)';
  }

  try {
    const service = new GeminiService(apiKey);
    const result = await service.analyzeInvoiceText(invoiceText);
    
    // Return a formatted string representation
    return `Vendor: ${result.vendor || 'Unknown'}, Amount: ${result.amount || 'N/A'}, Date: ${result.date || 'N/A'}`;
  } catch (error) {
    console.error('🤖 Helper analyzeInvoiceText error:', error);
    return 'AI extraction failed (fallback)';
  }
}