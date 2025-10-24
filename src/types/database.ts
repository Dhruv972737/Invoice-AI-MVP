export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          provider: string;
          provider_id: string | null;
          subscription_plan: string;
          subscription_status: string;
          subscription_start_date: string | null;
          subscription_end_date: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          is_admin: boolean;
          settings: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          provider?: string;
          provider_id?: string | null;
          subscription_plan?: string;
          subscription_status?: string;
          subscription_start_date?: string | null;
          subscription_end_date?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          is_admin?: boolean;
          settings?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          provider?: string;
          provider_id?: string | null;
          subscription_plan?: string;
          subscription_status?: string;
          subscription_start_date?: string | null;
          subscription_end_date?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          is_admin?: boolean;
          settings?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_url: string;
          file_size: number | null;
          status: 'processing' | 'completed' | 'failed';

          // Extracted fields
          vendor_name: string | null;
          vendor_address: string | null;
          invoice_number: string | null;
          invoice_date: string | null;
          due_date: string | null;
          total_amount: number | null;
          subtotal: number | null;
          tax_amount: number | null;
          vat_amount: number | null;
          currency: string | null;

          // Customer info
          customer_name: string | null;
          customer_address: string | null;

          // Payment info
          payment_terms: string | null;
          payment_method: string | null;
          po_number: string | null;

          // Tax/VAT info
          tax_id: string | null;
          vat_number: string | null;
          trn: string | null;
          tax_region: string | null;

          // Line items and notes
          line_items: any;
          notes: string | null;

          // Metadata
          language: string | null;
          classification: 'service' | 'product' | 'recurring' | 'medical' | 'other' | null;
          fraud_risk: 'low' | 'medium' | 'high' | null;
          fraud_score: number | null;
          fraud_reasons: string[] | null;
          tax_compliance_status: 'compliant' | 'non_compliant' | 'needs_review' | null;
          processing_pipeline: any;
          processed_data: any;
          tokens_used: number | null;
          error_message: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_url: string;
          file_size?: number | null;
          status?: 'processing' | 'completed' | 'failed';
          vendor_name?: string | null;
          invoice_date?: string | null;
          amount?: number | null;
          currency?: string | null;
          tax_id?: string | null;
          language?: string | null;
          classification?: 'service' | 'product' | 'recurring' | 'medical' | 'other' | null;
          fraud_risk?: 'low' | 'medium' | 'high' | null;
          fraud_score?: number | null;
          fraud_reasons?: string[] | null;
          tax_region?: string | null;
          vat_amount?: number | null;
          tax_compliance_status?: 'compliant' | 'non_compliant' | 'needs_review' | null;
          processing_pipeline?: any;
          processed_data?: any;
          tokens_used?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          file_url?: string;
          file_size?: number | null;
          status?: 'processing' | 'completed' | 'failed';
          vendor_name?: string | null;
          invoice_date?: string | null;
          amount?: number | null;
          currency?: string | null;
          tax_id?: string | null;
          language?: string | null;
          classification?: 'service' | 'product' | 'recurring' | 'medical' | 'other' | null;
          fraud_risk?: 'low' | 'medium' | 'high' | null;
          fraud_score?: number | null;
          fraud_reasons?: string[] | null;
          tax_region?: string | null;
          vat_amount?: number | null;
          tax_compliance_status?: 'compliant' | 'non_compliant' | 'needs_review' | null;
          processing_pipeline?: any;
          processed_data?: any;
          tokens_used?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      login_history: {
        Row: {
          id: string;
          user_id: string;
          login_method: string;
          ip_address: string | null;
          user_agent: string | null;
          location: string | null;
          success: boolean;
          failure_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          login_method: string;
          ip_address?: string | null;
          user_agent?: string | null;
          location?: string | null;
          success?: boolean;
          failure_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          login_method?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          location?: string | null;
          success?: boolean;
          failure_reason?: string | null;
          created_at?: string;
        };
      };
      user_tokens: {
        Row: {
          id: string;
          user_id: string;
          daily_free_tokens: number;
          daily_free_tokens_used: number;
          purchased_tokens: number;
          purchased_tokens_used: number;
          total_lifetime_tokens_used: number;
          last_daily_reset: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          daily_free_tokens?: number;
          daily_free_tokens_used?: number;
          purchased_tokens?: number;
          purchased_tokens_used?: number;
          total_lifetime_tokens_used?: number;
          last_daily_reset?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          daily_free_tokens?: number;
          daily_free_tokens_used?: number;
          purchased_tokens?: number;
          purchased_tokens_used?: number;
          total_lifetime_tokens_used?: number;
          last_daily_reset?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      token_usage_logs: {
        Row: {
          id: string;
          user_id: string;
          agent_name: string;
          operation_type: string;
          tokens_used: number;
          token_source: 'daily_free' | 'purchased';
          ai_provider: string | null;
          invoice_id: string | null;
          metadata: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          agent_name: string;
          operation_type: string;
          tokens_used?: number;
          token_source: 'daily_free' | 'purchased';
          ai_provider?: string | null;
          invoice_id?: string | null;
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          agent_name?: string;
          operation_type?: string;
          tokens_used?: number;
          token_source?: 'daily_free' | 'purchased';
          ai_provider?: string | null;
          invoice_id?: string | null;
          metadata?: any;
          created_at?: string;
        };
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string;
          daily_token_quota: number;
          price_monthly: number;
          price_yearly: number;
          features: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string;
          daily_token_quota: number;
          price_monthly?: number;
          price_yearly?: number;
          features?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          description?: string;
          daily_token_quota?: number;
          price_monthly?: number;
          price_yearly?: number;
          features?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_transactions: {
        Row: {
          id: string;
          user_id: string;
          transaction_type: 'token_purchase' | 'subscription' | 'refund';
          amount: number;
          currency: string;
          tokens_purchased: number | null;
          payment_provider: 'stripe';
          payment_provider_transaction_id: string | null;
          status: 'pending' | 'completed' | 'failed' | 'refunded';
          metadata: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          transaction_type: 'token_purchase' | 'subscription' | 'refund';
          amount: number;
          currency?: string;
          tokens_purchased?: number | null;
          payment_provider: 'stripe';
          payment_provider_transaction_id?: string | null;
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_type?: 'token_purchase' | 'subscription' | 'refund';
          amount?: number;
          currency?: string;
          tokens_purchased?: number | null;
          payment_provider?: 'stripe';
          payment_provider_transaction_id?: string | null;
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
          metadata?: any;
          created_at?: string;
        };
      };
      ai_provider_usage: {
        Row: {
          id: string;
          user_id: string;
          provider_name: 'gemini' | 'deepseek' | 'chatgpt' | 'local';
          operation_type: string;
          tokens_consumed: number;
          cost: number;
          response_time_ms: number;
          success: boolean;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider_name: 'gemini' | 'deepseek' | 'chatgpt' | 'local';
          operation_type: string;
          tokens_consumed?: number;
          cost?: number;
          response_time_ms?: number;
          success?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider_name?: 'gemini' | 'deepseek' | 'chatgpt' | 'local';
          operation_type?: string;
          tokens_consumed?: number;
          cost?: number;
          response_time_ms?: number;
          success?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
      };
      agent_execution_logs: {
        Row: {
          id: string;
          user_id: string;
          invoice_id: string | null;
          agent_name: string;
          status: 'started' | 'completed' | 'failed';
          execution_time_ms: number;
          input_data: any;
          output_data: any;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          invoice_id?: string | null;
          agent_name: string;
          status: 'started' | 'completed' | 'failed';
          execution_time_ms?: number;
          input_data?: any;
          output_data?: any;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          invoice_id?: string | null;
          agent_name?: string;
          status?: 'started' | 'completed' | 'failed';
          execution_time_ms?: number;
          input_data?: any;
          output_data?: any;
          error_message?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

// Standalone Interfaces (for easier use in components)

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string;
  provider_id: string | null;
  subscription_plan: string;
  subscription_status: string;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_admin: boolean;
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  file_name: string;
  file_path?: string;
  file_url: string;
  file_size: number | null;
  status: 'processing' | 'completed' | 'failed';

  // Extracted fields from OCR/AI
  vendor_name: string | null;
  vendor_address?: string | null;
  invoice_number?: string | null;
  invoice_date: string | null;
  due_date?: string | null;
  total_amount?: number | null;  // Main amount field from backend
  amount?: number | null;  // Alias for total_amount (for backward compatibility)
  subtotal?: number | null;
  tax_amount?: number | null;
  vat_amount: number | null;
  currency: string | null;

  // Customer info
  customer_name?: string | null;
  customer_address?: string | null;

  // Payment info
  payment_terms?: string | null;
  payment_method?: string | null;
  po_number?: string | null;

  // Tax/VAT info
  tax_id: string | null;
  vat_number?: string | null;
  trn?: string | null;  // Tax Registration Number
  tax_region: string | null;

  // Line items
  line_items?: any[] | null;
  notes?: string | null;

  // Metadata
  language: string | null;
  classification: 'service' | 'product' | 'recurring' | 'medical' | 'other' | null;
  fraud_risk: 'low' | 'medium' | 'high' | null;
  fraud_score: number | null;
  fraud_reasons: string[] | null;
  tax_compliance_status: 'compliant' | 'non_compliant' | 'needs_review' | null;
  processing_pipeline: any;
  processed_data: any;
  tokens_used: number | null;
  error_message?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserTokens {
  id: string;
  user_id: string;
  daily_free_tokens: number;
  daily_free_tokens_used: number;
  purchased_tokens: number;
  purchased_tokens_used: number;
  total_lifetime_tokens_used: number;
  last_daily_reset: string;
  created_at: string;
  updated_at: string;
}

export interface TokenUsageLog {
  id: string;
  user_id: string;
  agent_name: string;
  operation_type: string;
  tokens_used: number;
  token_source: 'daily_free' | 'purchased';
  ai_provider: string | null;
  invoice_id: string | null;
  metadata: any;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  daily_token_quota: number;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  user_id: string;
  transaction_type: 'token_purchase' | 'subscription' | 'refund';
  amount: number;
  currency: string;
  tokens_purchased: number | null;
  payment_provider: 'stripe';
  payment_provider_transaction_id: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata: any;
  created_at: string;
}

export interface AIProviderUsage {
  id: string;
  user_id: string;
  provider_name: 'gemini' | 'deepseek' | 'chatgpt' | 'local';
  operation_type: string;
  tokens_consumed: number;
  cost: number;
  response_time_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface AgentExecutionLog {
  id: string;
  user_id: string;
  invoice_id: string | null;
  agent_name: string;
  status: 'started' | 'completed' | 'failed';
  execution_time_ms: number;
  input_data: any;
  output_data: any;
  error_message: string | null;
  created_at: string;
}