-- Migration: Ensure handle_new_user() function and trigger exist
-- Date: 2025-10-18
-- This migration is idempotent: it will create or replace the function and create the
-- trigger on auth.users only if the trigger doesn't already exist. The trigger
-- creation will only run when the current user has USAGE on the auth schema; if
-- not, a NOTICE is raised. Run this using the Supabase SQL editor or with the
-- service role (recommended) so the trigger can be created.

BEGIN;

-- 1) Create or replace the function that initializes profiles and user_tokens
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_plan subscription_plans%ROWTYPE;
BEGIN
  -- Get default plan (if subscription_plans exists)
  BEGIN
    SELECT * INTO default_plan FROM subscription_plans WHERE name = 'free' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- ignore if subscription_plans doesn't exist; use fallback
    default_plan.daily_token_quota := 100;
  END;

  -- Create profile (use available raw_user_meta_data fields)
  INSERT INTO public.profiles (id, email, full_name, avatar_url, provider, provider_id, subscription_plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NEW.raw_user_meta_data->>'sub',
    COALESCE(default_plan.daily_token_quota::text, 'free')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Initialize user_tokens
  INSERT INTO public.user_tokens (user_id, daily_free_tokens, daily_free_tokens_used, purchased_tokens, purchased_tokens_used, total_lifetime_tokens_used)
  VALUES (NEW.id, COALESCE(default_plan.daily_token_quota, 100), 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Create trigger on auth.users if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    IF has_schema_privilege(current_user, 'auth', 'USAGE') THEN
      EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
    ELSE
      RAISE NOTICE 'Skipping CREATE TRIGGER on auth.users - current_user lacks auth schema privileges';
    END IF;
  ELSE
    RAISE NOTICE 'Trigger on_auth_user_created already exists, skipping';
  END IF;
END$$;

COMMIT;
