-- ============================================
-- COMPLETE DATABASE SETUP FOR INVOICE AI MVP
-- ============================================
-- This file contains all database setup needed for the Invoice AI application
-- Run this file once in Supabase SQL Editor to set up the complete database
-- ============================================

-- ============================================
-- PART 1: CREATE TABLES
-- ============================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    provider TEXT DEFAULT 'google',
    provider_id TEXT,
    subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing', 'incomplete')),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Subscription Plans Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    daily_tokens INTEGER DEFAULT 100,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Tokens Table
CREATE TABLE IF NOT EXISTS public.user_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    daily_free_tokens INTEGER DEFAULT 100,
    daily_free_tokens_used INTEGER DEFAULT 0,
    purchased_tokens INTEGER DEFAULT 0,
    purchased_tokens_used INTEGER DEFAULT 0,
    total_lifetime_tokens_used INTEGER DEFAULT 0,
    last_daily_reset TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- File information
    file_name TEXT NOT NULL,
    file_path TEXT,
    file_url TEXT NOT NULL,
    file_size BIGINT,

    -- Processing status
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),

    -- Extracted invoice data
    vendor_name TEXT,
    vendor_address TEXT,
    invoice_number TEXT,
    invoice_date DATE,
    due_date DATE,

    -- Financial information
    total_amount NUMERIC(10,2),
    amount NUMERIC(10,2),
    subtotal NUMERIC(10,2),
    tax_amount NUMERIC(10,2),
    vat_amount NUMERIC(10,2),
    currency TEXT DEFAULT 'USD',

    -- Customer information
    customer_name TEXT,
    customer_address TEXT,

    -- Additional data
    line_items JSONB,
    notes TEXT,
    payment_terms TEXT,
    payment_method TEXT,

    -- Metadata
    tax_region TEXT,
    language TEXT,
    vat_number TEXT,
    confidence_score NUMERIC(3,2),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AI Provider Usage Table
CREATE TABLE IF NOT EXISTS public.ai_provider_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider_name TEXT NOT NULL CHECK (provider_name IN ('gemini', 'claude', 'deepseek', 'chatgpt', 'local')),
    operation_type TEXT NOT NULL,
    tokens_consumed INTEGER DEFAULT 0,
    cost NUMERIC(10,4) DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 2: CREATE INDEXES
-- ============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON public.profiles(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- User tokens indexes
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON public.user_tokens(user_id);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);

-- AI provider usage indexes
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_user_id ON public.ai_provider_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_provider ON public.ai_provider_usage(provider_name);
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_created_at ON public.ai_provider_usage(created_at);

-- ============================================
-- PART 3: INSERT DEFAULT DATA
-- ============================================

-- Insert subscription plans
INSERT INTO public.subscription_plans (name, display_name, description, price, daily_tokens, features) VALUES
('free', 'Free Plan', 'Basic plan with daily token limit', 0.00, 100, '["100 daily tokens", "Basic OCR", "Email support"]'::jsonb),
('basic', 'Basic Plan', 'Enhanced features for regular users', 9.99, 500, '["500 daily tokens", "Enhanced OCR", "Priority support", "Export to PDF"]'::jsonb),
('pro', 'Pro Plan', 'Professional plan with advanced features', 29.99, 2000, '["2000 daily tokens", "Advanced AI extraction", "Priority support", "Export to multiple formats", "API access"]'::jsonb),
('enterprise', 'Enterprise Plan', 'Unlimited access for businesses', 99.99, 10000, '["10000 daily tokens", "Unlimited OCR", "24/7 support", "Custom integrations", "API access", "White label"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PART 4: CREATE FUNCTIONS
-- ============================================

-- Function to check if user is admin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_status BOOLEAN;
BEGIN
  SELECT is_admin INTO admin_status
  FROM public.profiles
  WHERE id = user_id;

  RETURN COALESCE(admin_status, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to auto-create profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name, provider, provider_id, subscription_plan, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'google',
    NEW.id,
    'free',
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

  -- Insert into user_tokens
  INSERT INTO public.user_tokens (user_id, daily_free_tokens, daily_free_tokens_used, purchased_tokens, purchased_tokens_used, total_lifetime_tokens_used)
  VALUES (NEW.id, 100, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to protect sensitive profile fields from non-admins
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service role to do anything
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Check if user is admin using SECURITY DEFINER function
  IF NOT public.is_user_admin(auth.uid()) THEN
    -- Non-admins cannot change these fields
    NEW.is_admin := OLD.is_admin;
    NEW.subscription_plan := OLD.subscription_plan;
    NEW.subscription_status := OLD.subscription_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 5: CREATE TRIGGERS
-- ============================================

-- Trigger to create profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger to protect profile fields
DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- Triggers to update updated_at columns
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_tokens_updated_at ON public.user_tokens;
CREATE TRIGGER update_user_tokens_updated_at
    BEFORE UPDATE ON public.user_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 6: DROP OLD POLICIES (CLEAN SLATE)
-- ============================================

-- Drop all existing policies to avoid conflicts
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'subscription_plans', 'user_tokens', 'invoices', 'ai_provider_usage')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ============================================
-- PART 7: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_usage ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 8: CREATE RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_user_admin(auth.uid()));

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- Subscription plans policies
CREATE POLICY "Anyone can view subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = TRUE);

-- User tokens policies
CREATE POLICY "Users can view own tokens"
  ON public.user_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON public.user_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON public.user_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Invoices policies
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);

-- AI provider usage policies
CREATE POLICY "Users can view own AI usage"
  ON public.ai_provider_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI usage"
  ON public.ai_provider_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PART 9: GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

GRANT SELECT ON public.profiles TO authenticated, anon;
GRANT INSERT, UPDATE ON public.profiles TO authenticated, service_role;

GRANT SELECT ON public.subscription_plans TO authenticated, anon;
GRANT ALL ON public.subscription_plans TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.user_tokens TO authenticated;
GRANT ALL ON public.user_tokens TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

GRANT SELECT, INSERT ON public.ai_provider_usage TO authenticated;
GRANT ALL ON public.ai_provider_usage TO service_role;

GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_fields() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated, service_role;

-- ============================================
-- PART 10: BACKFILL EXISTING USERS
-- ============================================

-- Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, email, full_name, provider, subscription_plan, is_admin)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  'google',
  'free',
  FALSE
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Create tokens for existing users who don't have them
INSERT INTO public.user_tokens (user_id, daily_free_tokens, daily_free_tokens_used, purchased_tokens, purchased_tokens_used, total_lifetime_tokens_used)
SELECT
  u.id,
  100,
  0,
  0,
  0,
  0
FROM auth.users u
LEFT JOIN public.user_tokens t ON t.user_id = u.id
WHERE t.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- PART 11: VERIFICATION
-- ============================================

-- Show table counts
DO $$
DECLARE
  profiles_count INTEGER;
  plans_count INTEGER;
  tokens_count INTEGER;
  invoices_count INTEGER;
  usage_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profiles_count FROM public.profiles;
  SELECT COUNT(*) INTO plans_count FROM public.subscription_plans;
  SELECT COUNT(*) INTO tokens_count FROM public.user_tokens;
  SELECT COUNT(*) INTO invoices_count FROM public.invoices;
  SELECT COUNT(*) INTO usage_count FROM public.ai_provider_usage;

  RAISE NOTICE '✅ DATABASE SETUP COMPLETE!';
  RAISE NOTICE '';
  RAISE NOTICE 'Table Counts:';
  RAISE NOTICE '  - Profiles: %', profiles_count;
  RAISE NOTICE '  - Subscription Plans: %', plans_count;
  RAISE NOTICE '  - User Tokens: %', tokens_count;
  RAISE NOTICE '  - Invoices: %', invoices_count;
  RAISE NOTICE '  - AI Provider Usage: %', usage_count;
  RAISE NOTICE '';
  RAISE NOTICE 'All tables, indexes, functions, triggers, and RLS policies created successfully!';
END $$;

-- Show active policies
SELECT
  'Active RLS Policies:' as info,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
