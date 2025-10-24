-- Migration: Create missing database tables
-- Created: 2025-10-24
-- Description: Creates login_history, agent_execution_logs, and subscription_plans tables

-- ============================================
-- 1. LOGIN_HISTORY TABLE
-- ============================================
-- Tracks user login attempts for analytics and security

CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    login_method TEXT NOT NULL, -- 'google', 'email', etc.
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON public.login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user_created ON public.login_history(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for login_history
-- Users can only see their own login history
CREATE POLICY "Users can view own login history"
    ON public.login_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own login history
CREATE POLICY "Users can insert own login history"
    ON public.login_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own login history
CREATE POLICY "Users can delete own login history"
    ON public.login_history
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 2. AGENT_EXECUTION_LOGS TABLE
-- ============================================
-- Logs AI agent execution for monitoring and debugging

CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id UUID, -- Will add foreign key constraint separately if invoices table exists
    agent_name TEXT NOT NULL, -- 'DataExtractor', 'Validator', 'Categorizer', etc.
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    execution_time_ms INTEGER DEFAULT 0,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraint to invoices table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'invoices'
    ) THEN
        ALTER TABLE public.agent_execution_logs
        ADD CONSTRAINT fk_agent_logs_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES public.invoices(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_logs_user_id ON public.agent_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_invoice_id ON public.agent_execution_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status ON public.agent_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON public.agent_execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_name ON public.agent_execution_logs(agent_name);

-- Enable Row Level Security
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_execution_logs
-- Users can view their own agent logs
CREATE POLICY "Users can view own agent logs"
    ON public.agent_execution_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own agent logs
CREATE POLICY "Users can insert own agent logs"
    ON public.agent_execution_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. SUBSCRIPTION_PLANS TABLE
-- ============================================
-- Defines available subscription tiers

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'free', 'starter', 'professional', 'enterprise'
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    daily_token_quota INTEGER NOT NULL DEFAULT 0,
    price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    features TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON public.subscription_plans(name);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active);

-- Enable Row Level Security
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
-- Everyone can read active subscription plans
CREATE POLICY "Anyone can view active subscription plans"
    ON public.subscription_plans
    FOR SELECT
    USING (is_active = true);

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, display_name, description, daily_token_quota, price_monthly, price_yearly, features, is_active)
VALUES
    (
        'free',
        'Free Plan',
        'Perfect for trying out Invoice AI',
        50,
        0.00,
        0.00,
        ARRAY['50 free tokens daily', 'Basic invoice processing', 'PDF & image support', 'Email support'],
        true
    ),
    (
        'starter',
        'Starter Plan',
        'Great for small businesses',
        500,
        19.99,
        199.90,
        ARRAY['500 tokens daily', 'Advanced invoice processing', 'Google Drive integration', 'Priority email support', 'Export to Excel/PDF', 'API access'],
        true
    ),
    (
        'professional',
        'Professional Plan',
        'For growing businesses',
        2000,
        49.99,
        499.90,
        ARRAY['2000 tokens daily', 'All Starter features', 'Multi-language support', 'Custom categories', 'Analytics dashboard', 'Fraud detection', 'Priority support'],
        true
    ),
    (
        'enterprise',
        'Enterprise Plan',
        'For large organizations',
        10000,
        199.99,
        1999.90,
        ARRAY['10000 tokens daily', 'All Professional features', 'Dedicated account manager', 'Custom AI training', 'SLA guarantee', '24/7 phone support', 'On-premise deployment option'],
        true
    )
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    daily_token_quota = EXCLUDED.daily_token_quota,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- ============================================
-- GRANTS
-- ============================================
-- Grant necessary permissions

-- Authenticated users can access these tables via RLS policies
GRANT SELECT, INSERT, DELETE ON public.login_history TO authenticated;
GRANT SELECT, INSERT ON public.agent_execution_logs TO authenticated;
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon; -- Allow public to view plans

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.login_history IS 'Tracks user login attempts for analytics and security monitoring';
COMMENT ON TABLE public.agent_execution_logs IS 'Logs AI agent execution for performance monitoring and debugging';
COMMENT ON TABLE public.subscription_plans IS 'Defines available subscription tiers and their features';

COMMENT ON COLUMN public.login_history.login_method IS 'Authentication method used: google, email, etc.';
COMMENT ON COLUMN public.login_history.success IS 'Whether the login attempt was successful';

COMMENT ON COLUMN public.agent_execution_logs.agent_name IS 'Name of the AI agent that executed';
COMMENT ON COLUMN public.agent_execution_logs.status IS 'Execution status: started, completed, or failed';
COMMENT ON COLUMN public.agent_execution_logs.execution_time_ms IS 'Time taken to execute in milliseconds';

COMMENT ON COLUMN public.subscription_plans.daily_token_quota IS 'Number of free tokens allocated daily for this plan';
COMMENT ON COLUMN public.subscription_plans.features IS 'Array of feature descriptions for this plan';
