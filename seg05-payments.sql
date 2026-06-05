-- SEG-05: Payments & Subscription
-- Run in Supabase SQL editor (Settings -> SQL Editor)
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards)

-- 1. Add Stripe customer ID to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Add subscription columns to pairs
ALTER TABLE public.pairs
  ADD COLUMN IF NOT EXISTS subscription_status TEXT
    NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'trialing', 'active', 'past_due', 'canceled'));

ALTER TABLE public.pairs
  ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- 3. Index for quick subscription lookups
CREATE INDEX IF NOT EXISTS pairs_subscription_status_idx
  ON public.pairs (subscription_status);

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'pairs')
  AND column_name IN ('stripe_customer_id', 'subscription_status', 'subscription_period_end')
ORDER BY table_name, column_name;
