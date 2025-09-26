export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_url: string;
          status: 'processing' | 'completed' | 'failed';
          vendor_name: string | null;
          invoice_date: string | null;
          amount: number | null;
          currency: string | null;
          tax_id: string | null;
          language: string | null;
          classification: 'service' | 'product' | 'recurring' | null;
          fraud_risk: 'low' | 'medium' | 'high' | null;
          tax_region: string | null;
          vat_amount: number | null;
          processed_data: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_url: string;
          status?: 'processing' | 'completed' | 'failed';
          vendor_name?: string | null;
          invoice_date?: string | null;
          amount?: number | null;
          currency?: string | null;
          tax_id?: string | null;
          language?: string | null;
          classification?: 'service' | 'product' | 'recurring' | null;
          fraud_risk?: 'low' | 'medium' | 'high' | null;
          tax_region?: string | null;
          vat_amount?: number | null;
          processed_data?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          file_url?: string;
          status?: 'processing' | 'completed' | 'failed';
          vendor_name?: string | null;
          invoice_date?: string | null;
          amount?: number | null;
          currency?: string | null;
          tax_id?: string | null;
          language?: string | null;
          classification?: 'service' | 'product' | 'recurring' | null;
          fraud_risk?: 'low' | 'medium' | 'high' | null;
          tax_region?: string | null;
          vat_amount?: number | null;
          processed_data?: any;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          login_method: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          login_method?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

export interface Invoice {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  status: 'processing' | 'completed' | 'failed';
  vendor_name: string | null;
  invoice_date: string | null;
  amount: number | null;
  currency: string | null;
  tax_id: string | null;
  language: string | null;
  classification: 'service' | 'product' | 'recurring' | null;
  fraud_risk: 'low' | 'medium' | 'high' | null;
  tax_region: string | null;
  vat_amount: number | null;
  processed_data: any;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}