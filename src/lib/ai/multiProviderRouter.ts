// ============================================
// MULTI-PROVIDER AI ROUTING SYSTEM
// Intelligent routing across multiple AI providers
// ============================================

import { supabase } from '../supabase';

// ============================================
// PROVIDER INTERFACES
// ============================================

export interface AIProvider {
  name: 'gemini' | 'deepseek' | 'chatgpt';
  enabled: boolean;
  priority: number;
  dailyQuota: number;
  usedQuota: number;
  costPerToken: number;
  apiKey: string | null;
}

export interface AIRequest {
  operation: 'extract' | 'analyze' | 'chat';
  prompt: string;
  context?: any;
  userId: string;
  preferredProvider?: string;
}

export interface AIResponse {
  success: boolean;
  provider: string;
  data: any;
  tokensUsed: number;
  cost: number;
  responseTime: number;
  error?: string;
}

// ============================================
// PROVIDER CONFIGURATIONS
// ============================================

const PROVIDER_CONFIGS: Record<string, {
  apiEndpoint: string;
  quotaPerDay: number;
  costPerToken: number;
}> = {
  gemini: {
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
    quotaPerDay: 60,
    costPerToken: 0
  },
  deepseek: {
    apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    quotaPerDay: 50,
    costPerToken: 0
  },
  chatgpt: {
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    quotaPerDay: 50,
    costPerToken: 0
  }
};

// ============================================
// AI ROUTER CLASS
// ============================================

export class MultiProviderAIRouter {
  private userId: string;
  private providers: Map<string, AIProvider> = new Map();

  constructor(userId: string) {
    this.userId = userId;
    this.initializeProviders();
  }

  private async initializeProviders() {
    // Initialize providers with configuration
    this.providers.set('gemini', {
      name: 'gemini',
      enabled: !!import.meta.env.VITE_GEMINI_API_KEY,
      priority: 1,
      dailyQuota: PROVIDER_CONFIGS.gemini.quotaPerDay,
      usedQuota: await this.getProviderUsage('gemini'),
      costPerToken: PROVIDER_CONFIGS.gemini.costPerToken,
      apiKey: import.meta.env.VITE_GEMINI_API_KEY || null
    });

    this.providers.set('deepseek', {
      name: 'deepseek',
      enabled: !!import.meta.env.VITE_DEEPSEEK_API_KEY,
      priority: 2,
      dailyQuota: PROVIDER_CONFIGS.deepseek.quotaPerDay,
      usedQuota: await this.getProviderUsage('deepseek'),
      costPerToken: PROVIDER_CONFIGS.deepseek.costPerToken,
      apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || null
    });

    this.providers.set('chatgpt', {
      name: 'chatgpt',
      enabled: !!import.meta.env.VITE_OPENAI_API_KEY,
      priority: 3,
      dailyQuota: PROVIDER_CONFIGS.chatgpt.quotaPerDay,
      usedQuota: await this.getProviderUsage('chatgpt'),
      costPerToken: PROVIDER_CONFIGS.chatgpt.costPerToken,
      apiKey: import.meta.env.VITE_OPENAI_API_KEY || null
    });
  }

  private async getProviderUsage(providerName: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('ai_provider_usage')
      .select('tokens_consumed')
      .eq('user_id', this.userId)
      .eq('provider_name', providerName)
      .gte('created_at', startOfDay.toISOString());

    if (error) {
      console.error('Error fetching provider usage:', error);
      return 0;
    }

    return (data || []).reduce((sum, record) => sum + (record.tokens_consumed || 0), 0);
  }

  private selectProvider(preferredProvider?: string): AIProvider | null {
    // If preferred provider is specified and available, use it
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const provider = this.providers.get(preferredProvider)!;
      if (provider.enabled && provider.usedQuota < provider.dailyQuota) {
        return provider;
      }
    }

    // Find available provider with highest priority
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.enabled && p.usedQuota < p.dailyQuota)
      .sort((a, b) => a.priority - b.priority);

    return availableProviders.length > 0 ? availableProviders[0] : null;
  }

  private async logProviderUsage(
    provider: AIProvider,
    operation: string,
    tokensUsed: number,
    cost: number,
    responseTime: number,
    success: boolean,
    error?: string
  ) {
    try {
      await supabase.from('ai_provider_usage').insert({
        user_id: this.userId,
        provider_name: provider.name,
        operation_type: operation,
        tokens_consumed: tokensUsed,
        cost,
        response_time_ms: responseTime,
        success,
        error_message: error
      });
    } catch (err) {
      console.error('Failed to log provider usage:', err);
    }
  }

  async executeRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    // Refresh provider usage
    await this.initializeProviders();

    // Select best provider
    const provider = this.selectProvider(request.preferredProvider);

    if (!provider) {
      return {
        success: false,
        provider: 'none',
        data: null,
        tokensUsed: 0,
        cost: 0,
        responseTime: Date.now() - startTime,
        error: 'No available AI providers. All quotas exceeded or no API keys configured.'
      };
    }

    try {
      let response: any;

      switch (provider.name) {
        case 'gemini':
          response = await this.callGemini(request, provider);
          break;
        case 'deepseek':
          response = await this.callDeepSeek(request, provider);
          break;
        case 'chatgpt':
          response = await this.callChatGPT(request, provider);
          break;
        default:
          throw new Error(`Unknown provider: ${provider.name}`);
      }

      const responseTime = Date.now() - startTime;
      const tokensUsed = response.tokensUsed || 1;
      const cost = tokensUsed * provider.costPerToken;

      // Update provider usage
      provider.usedQuota += tokensUsed;

      // Log usage
      await this.logProviderUsage(provider, request.operation, tokensUsed, cost, responseTime, true);

      return {
        success: true,
        provider: provider.name,
        data: response.data,
        tokensUsed,
        cost,
        responseTime
      };

    } catch (error: any) {
      console.error(`Provider ${provider.name} failed:`, error);
      const responseTime = Date.now() - startTime;
      
      // Log failure
      await this.logProviderUsage(provider, request.operation, 0, 0, responseTime, false, error.message);

      // Try next provider
      if (provider.priority < 4) {
        console.log('Trying next available provider...');
        return this.executeRequest({
          ...request,
          preferredProvider: undefined // Remove preference to try others
        });
      }

      return {
        success: false,
        provider: provider.name,
        data: null,
        tokensUsed: 0,
        cost: 0,
        responseTime,
        error: error.message
      };
    }
  }

  // ============================================
  // PROVIDER-SPECIFIC IMPLEMENTATIONS
  // ============================================

  private async callGemini(request: AIRequest, provider: AIProvider): Promise<{data: any; tokensUsed: number}> {
    if (!provider.apiKey) throw new Error('Gemini API key not configured');

    const response = await fetch(
      `${PROVIDER_CONFIGS.gemini.apiEndpoint}?key=${provider.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: request.prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      data: { text, raw: data },
      tokensUsed: 1
    };
  }

  private async callDeepSeek(request: AIRequest, provider: AIProvider): Promise<{data: any; tokensUsed: number}> {
    if (!provider.apiKey) throw new Error('DeepSeek API key not configured');

    const response = await fetch(PROVIDER_CONFIGS.deepseek.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: request.prompt
        }],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'DeepSeek API error');
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return {
      data: { text, raw: data },
      tokensUsed: data.usage?.total_tokens || 1
    };
  }

  private async callChatGPT(request: AIRequest, provider: AIProvider): Promise<{data: any; tokensUsed: number}> {
    if (!provider.apiKey) throw new Error('OpenAI API key not configured');

    const response = await fetch(PROVIDER_CONFIGS.chatgpt.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: request.prompt
        }],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return {
      data: { text, raw: data },
      tokensUsed: data.usage?.total_tokens || 1
    };
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  async extractInvoiceFields(ocrText: string): Promise<any> {
    const prompt = `Extract invoice fields from this OCR text. Return JSON with: vendor_name, invoice_date, amount, currency, vat_number.

OCR Text:
${ocrText}

Return only valid JSON, no additional text.`;

    const response = await this.executeRequest({
      operation: 'extract',
      prompt,
      userId: this.userId
    });

    if (response.success) {
      try {
        return JSON.parse(response.data.text);
      } catch {
        return null;
      }
    }

    return null;
  }

  async chatResponse(query: string, context: any): Promise<string> {
    const prompt = `You are an AI assistant for invoice management. Answer the user's question based on their invoice data.

Context: ${JSON.stringify(context)}

User Question: ${query}

Provide a helpful, concise answer.`;

    const response = await this.executeRequest({
      operation: 'chat',
      prompt,
      userId: this.userId
    });

    return response.success ? response.data.text : 'Sorry, I could not process your request at the moment.';
  }

  async getProviderStatus(): Promise<Array<{
    name: string;
    enabled: boolean;
    quota: number;
    used: number;
    remaining: number;
  }>> {
    await this.initializeProviders();

    return Array.from(this.providers.values()).map(p => ({
      name: p.name,
      enabled: p.enabled,
      quota: p.dailyQuota,
      used: p.usedQuota,
      remaining: p.dailyQuota - p.usedQuota
    }));
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

let routerInstance: MultiProviderAIRouter | null = null;

export function getAIRouter(userId: string): MultiProviderAIRouter {
  if (!routerInstance || routerInstance['userId'] !== userId) {
    routerInstance = new MultiProviderAIRouter(userId);
  }
  return routerInstance;
}