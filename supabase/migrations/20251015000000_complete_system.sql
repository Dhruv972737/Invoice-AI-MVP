-- ============================================
-- INVOICE AI - COMPLETE DATABASE SCHEMA
-- Multi-Agent System with Token & Billing
-- ============================================

-- Drop existing objects if they exist
DO $$
BEGIN
  IF has_schema_privilege(current_user, 'auth', 'USAGE') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
  ELSE
    RAISE NOTICE 'Skipping DROP TRIGGER on auth.users - current_user lacks auth schema privileges';
  END IF;
END$$;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
DROP TRIGGER IF EXISTS update_user_tokens_updated_at ON user_tokens;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.reset_daily_tokens();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in correct order (reverse of dependencies)
DROP TABLE IF EXISTS ai_provider_usage CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS token_usage_logs CASCADE;
DROP TABLE IF EXISTS user_tokens CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS agent_execution_logs CASCADE;
DROP TABLE IF EXISTS login_history CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- 1. UTILITY FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. SUBSCRIPTION PLANS TABLE
-- ============================================

CREATE TABLE subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (name IN ('free', 'pro', 'business', 'enterprise')),
  display_name TEXT NOT NULL,
  description TEXT,
  daily_token_quota INTEGER NOT NULL,
  price_monthly NUMERIC(10,2) DEFAULT 0,
  price_yearly NUMERIC(10,2) DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, daily_token_quota, price_monthly, price_yearly, features) VALUES
('free', 'Free', 'Basic invoice processing with daily limits', 100, 0, 0, 
 '["100 daily tokens", "Basic OCR", "Email support", "Single AI provider"]'::jsonb),
('pro', 'Professional', 'Advanced features for professionals', 500, 29.99, 299.99,
 '["500 daily tokens", "Priority OCR", "Advanced fraud detection", "Multi-provider AI", "Priority support"]'::jsonb),
('business', 'Business', 'Complete solution for businesses', 2000, 99.99, 999.99,
 '["2000 daily tokens", "Premium OCR", "Advanced analytics", "API access", "White-label", "24/7 support"]'::jsonb),
('enterprise', 'Enterprise', 'Custom solution for large organizations', 10000, 0, 0,
 '["Unlimited tokens", "Custom AI models", "Dedicated support", "SLA guarantee", "On-premise option"]'::jsonb);

-- ============================================
-- 3. PROFILES TABLE (Enhanced)
-- ============================================

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  provider TEXT DEFAULT 'email',
  provider_id TEXT,
  subscription_plan TEXT DEFAULT 'free' REFERENCES subscription_plans(name),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'trialing')),
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  is_admin BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. USER TOKENS TABLE
-- ============================================

CREATE TABLE user_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  daily_free_tokens INTEGER DEFAULT 100,
  daily_free_tokens_used INTEGER DEFAULT 0,
  purchased_tokens INTEGER DEFAULT 0,
  purchased_tokens_used INTEGER DEFAULT 0,
  total_lifetime_tokens_used INTEGER DEFAULT 0,
  last_daily_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- 5. TOKEN USAGE LOGS TABLE
-- ============================================

CREATE TABLE token_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_name TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('ocr', 'classification', 'fraud_detection', 'tax_compliance', 'chatbot', 'reporting')),
  tokens_used INTEGER NOT NULL DEFAULT 1,
  token_source TEXT NOT NULL CHECK (token_source IN ('daily_free', 'purchased')),
  ai_provider TEXT,
  invoice_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_usage_user ON token_usage_logs(user_id);
CREATE INDEX idx_token_usage_created ON token_usage_logs(created_at);

-- ============================================
-- 6. PAYMENT TRANSACTIONS TABLE
-- ============================================

CREATE TABLE payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('token_purchase', 'subscription', 'refund')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  tokens_purchased INTEGER,
  payment_provider TEXT NOT NULL CHECK (payment_provider IN ('stripe', 'paypal')),
  payment_provider_transaction_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_user ON payment_transactions(user_id);
CREATE INDEX idx_payment_status ON payment_transactions(status);

-- ============================================
-- 7. AI PROVIDER USAGE TABLE
-- ============================================

CREATE TABLE ai_provider_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider_name TEXT NOT NULL CHECK (provider_name IN ('gemini', 'claude', 'deepseek', 'chatgpt', 'local')),
  operation_type TEXT NOT NULL,
  tokens_consumed INTEGER DEFAULT 0,
  cost NUMERIC(10,6) DEFAULT 0,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_provider_user ON ai_provider_usage(user_id);
CREATE INDEX idx_ai_provider_name ON ai_provider_usage(provider_name);
CREATE INDEX idx_ai_provider_created ON ai_provider_usage(created_at);

-- ============================================
-- 8. AGENT EXECUTION LOGS TABLE
-- ============================================

CREATE TABLE agent_execution_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID,
  agent_name TEXT NOT NULL CHECK (agent_name IN ('ingestion', 'ocr', 'classification', 'fraud_detection', 'tax_compliance', 'reporting', 'chatbot')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  execution_time_ms INTEGER,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_user ON agent_execution_logs(user_id);
CREATE INDEX idx_agent_logs_invoice ON agent_execution_logs(invoice_id);
CREATE INDEX idx_agent_logs_agent ON agent_execution_logs(agent_name);

-- ============================================
-- 9. INVOICES TABLE (Enhanced)
-- ============================================

CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  vendor_name TEXT,
  invoice_date DATE,
  amount NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  tax_id TEXT,
  language TEXT,
  classification TEXT CHECK (classification IN ('service', 'product', 'recurring', 'medical', 'other')),
  fraud_risk TEXT CHECK (fraud_risk IN ('low', 'medium', 'high')),
  fraud_score NUMERIC(3,2),
  fraud_reasons TEXT[],
  tax_region TEXT,
  vat_amount NUMERIC(10,2),
  tax_compliance_status TEXT CHECK (tax_compliance_status IN ('compliant', 'non_compliant', 'needs_review')),
  processing_pipeline JSONB DEFAULT '{}'::jsonb,
  processed_data JSONB,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_fraud_risk ON invoices(fraud_risk);
CREATE INDEX idx_invoices_created ON invoices(created_at);

-- ============================================
-- 10. LOGIN HISTORY TABLE
-- ============================================

CREATE TABLE login_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  login_method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  success BOOLEAN DEFAULT true,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_history_user ON login_history(user_id);
CREATE INDEX idx_login_history_created ON login_history(created_at);

-- ============================================
-- 11. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 12. RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- User tokens policies
CREATE POLICY "Users can view own tokens" ON user_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON user_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all tokens" ON user_tokens FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Token usage logs policies
CREATE POLICY "Users can view own token logs" ON token_usage_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert token logs" ON token_usage_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Payment transactions policies
CREATE POLICY "Users can view own payments" ON payment_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON payment_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all payments" ON payment_transactions FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- AI provider usage policies
CREATE POLICY "Users can view own AI usage" ON ai_provider_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can log AI usage" ON ai_provider_usage FOR INSERT TO authenticated WITH CHECK (true);

-- Agent execution logs policies
CREATE POLICY "Users can view own agent logs" ON agent_execution_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert agent logs" ON agent_execution_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Invoices policies
CREATE POLICY "Users can manage own invoices" ON invoices FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Login history policies
CREATE POLICY "Users can view own login history" ON login_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert login history" ON login_history FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- 13. TRIGGERS
-- ============================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tokens_updated_at BEFORE UPDATE ON user_tokens 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 14. USER CREATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_plan subscription_plans%ROWTYPE;
BEGIN
  -- Get default plan
  SELECT * INTO default_plan FROM subscription_plans WHERE name = 'free' LIMIT 1;
  
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, provider, provider_id, subscription_plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NEW.raw_user_meta_data->>'sub',
    'free'
  );
  
  -- Initialize user tokens
  INSERT INTO public.user_tokens (user_id, daily_free_tokens, daily_free_tokens_used, purchased_tokens, purchased_tokens_used)
  VALUES (NEW.id, default_plan.daily_token_quota, 0, 0, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DO $$
BEGIN
  IF has_schema_privilege(current_user, 'auth', 'USAGE') THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
  ELSE
    RAISE NOTICE 'Skipping CREATE TRIGGER on auth.users - current_user lacks auth schema privileges';
  END IF;
END$$;

-- ============================================
-- 15. TOKEN RESET FUNCTION (Called daily via cron)
-- ============================================

CREATE OR REPLACE FUNCTION public.reset_daily_tokens()
RETURNS void AS $$
BEGIN
  UPDATE user_tokens SET
    daily_free_tokens_used = 0,
    last_daily_reset = NOW()
  WHERE last_daily_reset < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 16. HELPER FUNCTIONS FOR TOKEN MANAGEMENT
-- ============================================

CREATE OR REPLACE FUNCTION public.consume_tokens(
  p_user_id UUID,
  p_tokens_to_consume INTEGER,
  p_agent_name TEXT,
  p_operation_type TEXT,
  p_ai_provider TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_tokens user_tokens%ROWTYPE;
  v_tokens_from_daily INTEGER := 0;
  v_tokens_from_purchased INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Get user tokens
  SELECT * INTO v_user_tokens FROM user_tokens WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User tokens not found');
  END IF;
  
  -- Check if daily reset needed
  IF v_user_tokens.last_daily_reset < NOW() - INTERVAL '24 hours' THEN
    UPDATE user_tokens SET
      daily_free_tokens_used = 0,
      last_daily_reset = NOW()
    WHERE user_id = p_user_id;
    v_user_tokens.daily_free_tokens_used := 0;
  END IF;
  
  -- Calculate available tokens
  DECLARE
    available_daily INTEGER := v_user_tokens.daily_free_tokens - v_user_tokens.daily_free_tokens_used;
    available_purchased INTEGER := v_user_tokens.purchased_tokens - v_user_tokens.purchased_tokens_used;
  BEGIN
    -- Check if enough tokens
    IF (available_daily + available_purchased) < p_tokens_to_consume THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient tokens',
        'available_daily', available_daily,
        'available_purchased', available_purchased,
        'required', p_tokens_to_consume
      );
    END IF;
    
    -- Consume from daily first
    IF available_daily >= p_tokens_to_consume THEN
      v_tokens_from_daily := p_tokens_to_consume;
      UPDATE user_tokens SET
        daily_free_tokens_used = daily_free_tokens_used + p_tokens_to_consume,
        total_lifetime_tokens_used = total_lifetime_tokens_used + p_tokens_to_consume
      WHERE user_id = p_user_id;
    ELSE
      v_tokens_from_daily := available_daily;
      v_tokens_from_purchased := p_tokens_to_consume - available_daily;
      UPDATE user_tokens SET
        daily_free_tokens_used = daily_free_tokens,
        purchased_tokens_used = purchased_tokens_used + v_tokens_from_purchased,
        total_lifetime_tokens_used = total_lifetime_tokens_used + p_tokens_to_consume
      WHERE user_id = p_user_id;
    END IF;
    
    -- Log usage
    INSERT INTO token_usage_logs (user_id, agent_name, operation_type, tokens_used, token_source, ai_provider, invoice_id)
    VALUES (
      p_user_id,
      p_agent_name,
      p_operation_type,
      p_tokens_to_consume,
      CASE WHEN v_tokens_from_daily > 0 THEN 'daily_free' ELSE 'purchased' END,
      p_ai_provider,
      p_invoice_id
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'tokens_consumed', p_tokens_to_consume,
      'from_daily', v_tokens_from_daily,
      'from_purchased', v_tokens_from_purchased
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 16b. RPC: increment_purchased_tokens
-- Atomically add purchased tokens to a user's account
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_purchased_tokens(
  p_user_id UUID,
  p_tokens INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE user_tokens
  SET purchased_tokens = COALESCE(purchased_tokens, 0) + p_tokens,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- If row doesn't exist, create one
  IF NOT FOUND THEN
    INSERT INTO user_tokens (user_id, purchased_tokens, purchased_tokens_used, daily_free_tokens, daily_free_tokens_used, total_lifetime_tokens_used)
    VALUES (p_user_id, p_tokens, 0, 100, 0, 0);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 17. GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- 18. PROCESSING QUEUE
-- Table to enqueue invoices for backend processing by worker
-- ============================================

CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 10,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_user ON processing_queue(user_id);

-- END OF SCHEMA
-- ============================================