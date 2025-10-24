-- RECREATE TABLES - Drops existing tables and creates fresh ones
-- Run this in Supabase SQL Editor

-- Drop existing tables (this will delete any existing data!)
DROP TABLE IF EXISTS public.login_history CASCADE;
DROP TABLE IF EXISTS public.agent_execution_logs CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

-- Create login_history table
CREATE TABLE public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    login_method TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create agent_execution_logs table
CREATE TABLE public.agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    invoice_id UUID,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL,
    execution_time_ms INTEGER DEFAULT 0,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
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

-- Insert subscription plans
INSERT INTO public.subscription_plans (name, display_name, description, daily_token_quota, price_monthly, price_yearly, features)
VALUES
    ('free', 'Free Plan', 'Perfect for trying out Invoice AI', 50, 0.00, 0.00,
     ARRAY['50 free tokens daily', 'Basic invoice processing', 'PDF & image support', 'Email support']),
    ('starter', 'Starter Plan', 'Great for small businesses', 500, 19.99, 199.90,
     ARRAY['500 tokens daily', 'Advanced invoice processing', 'Google Drive integration', 'Priority email support']),
    ('professional', 'Professional Plan', 'For growing businesses', 2000, 49.99, 499.90,
     ARRAY['2000 tokens daily', 'Multi-language support', 'Analytics dashboard', 'Fraud detection']),
    ('enterprise', 'Enterprise Plan', 'For large organizations', 10000, 199.99, 1999.90,
     ARRAY['10000 tokens daily', 'Custom AI training', 'SLA guarantee', '24/7 support']);

-- Grant basic permissions
GRANT ALL ON public.login_history TO authenticated;
GRANT ALL ON public.agent_execution_logs TO authenticated;
GRANT ALL ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon;

-- Success message
SELECT 'Tables created successfully!' as message,
       (SELECT COUNT(*) FROM public.subscription_plans) as subscription_plans_count;
