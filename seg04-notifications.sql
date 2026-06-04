-- SEG-04 Notifications migration
-- Run in Supabase SQL editor

-- 4.2 Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own subscriptions only" ON public.push_subscriptions;
CREATE POLICY "Own subscriptions only"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Allow service role to read all subscriptions (needed by remind.js cron)
-- Service role bypasses RLS by default - no extra policy needed.

-- 4.4 Notification preferences column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB
  DEFAULT '{"email": true, "push": true, "quiet_from": "22:00", "quiet_to": "07:00"}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Zurich';
