-- Migration: Enforce Google-only signups
-- Prevent creation of auth.users rows where the provider is not Google

DO $$
BEGIN
  IF has_schema_privilege(current_user, 'auth', 'USAGE') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS enforce_google_provider ON auth.users';
    EXECUTE 'DROP FUNCTION IF EXISTS auth.enforce_google_provider()';
  ELSE
    RAISE NOTICE 'Skipping DROP TRIGGER/FUNCTION on auth schema - current_user lacks auth schema privileges';
  END IF;
END$$;

-- Create a function that prevents non-Google provider inserts
CREATE OR REPLACE FUNCTION auth.enforce_google_provider()
RETURNS TRIGGER AS $$
DECLARE
  v_provider TEXT;
BEGIN
  -- Try to read provider from raw_app_meta_data (set by Supabase on OAuth)
  v_provider := COALESCE(NEW.raw_app_meta_data->> 'provider', NEW.raw_user_meta_data->> 'provider', NULL);

  -- If provider is null, attempt to infer from identities or email
  IF v_provider IS NULL THEN
    -- If identities array exists, look for provider key
    IF NEW.identities IS NOT NULL THEN
      -- identities is expected to be JSON array; try to extract first identity provider
      BEGIN
        v_provider := (NEW.identities->0->>'provider')::text;
      EXCEPTION WHEN OTHERS THEN
        v_provider := NULL;
      END;
    END IF;
  END IF;

  -- Normalize to lowercase
  IF v_provider IS NOT NULL THEN
    v_provider := lower(v_provider);
  END IF;

  -- If provider is not google, reject the insert
  IF v_provider IS NULL OR v_provider <> 'google' THEN
    RAISE EXCEPTION 'Only Google OAuth signups are allowed on this instance. Provider: %', v_provider;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce provider on insert
DO $$
BEGIN
  IF has_schema_privilege(current_user, 'auth', 'USAGE') THEN
    EXECUTE 'CREATE TRIGGER enforce_google_provider BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION auth.enforce_google_provider();';
  ELSE
    RAISE NOTICE 'Skipping CREATE TRIGGER enforce_google_provider on auth.users - missing auth schema privileges';
  END IF;
END$$;

-- Optional: Ensure handle_new_user sets profile.provider correctly when provider is google
-- (handle_new_user already uses raw_app_meta_data->>'provider' and defaults to 'email')

-- NOTE: This migration will cause non-google signups to fail. Apply carefully and
-- ensure existing non-google users are migrated or allowed before enabling in production.
