-- Idempotent SQL to ensure a user's profile and user_tokens rows exist
-- Replace the user_id value with the target user's uuid

-- Upsert profile (uses auth.users if available)
WITH u AS (
  SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) AS full_name
  FROM auth.users
  WHERE id = '216453f4-21cd-4b3e-b69f-76481307b2fa'
)
INSERT INTO public.profiles (id, email, full_name, provider, subscription_plan, created_at, updated_at)
SELECT id, email, full_name, 'google', 'free', NOW(), NOW()
FROM u
ON CONFLICT (id) DO NOTHING;

-- Insert minimal user_tokens row if missing
INSERT INTO public.user_tokens (
  user_id,
  daily_free_tokens,
  daily_free_tokens_used,
  purchased_tokens,
  purchased_tokens_used,
  total_lifetime_tokens_used,
  last_daily_reset,
  created_at,
  updated_at
)
VALUES (
  '216453f4-21cd-4b3e-b69f-76481307b2fa',
  100, 0, 0, 0, 0,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;
