-- ============================================================
-- SEG-11 MOAT FEATURES - DB MIGRATION
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/vkafktcrhrmehruiqjni/sql
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- ─── 11.1: Edit history on cards (tamper-evident audit trail) ─────────────────
-- Stores a JSON array of {ts, by, action} entries appended on every card save.
-- This makes the legal export credible - courts can see who changed what and when.
ALTER TABLE public.unified_cards
  ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;

-- ─── 11.4: Link cards to custody schedule templates ───────────────────────────
-- Allows schedule cascade: shift a whole custody week and all its cards move too.
ALTER TABLE public.unified_cards
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL;

ALTER TABLE public.unified_cards
  ADD COLUMN IF NOT EXISTS schedule_day_offset INT;
-- schedule_day_offset = which day within the schedule week this card belongs to (0=Mon, 6=Sun)

-- ─── 11.3: Mediator referral tracking ────────────────────────────────────────
-- referred_by: set on the profile when a user signs up via a mediator link (?ref=MED-xxx)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- mediator_code: set on the pair when the first partner joins via a mediator link
ALTER TABLE public.pairs
  ADD COLUMN IF NOT EXISTS mediator_code TEXT;

-- ─── VERIFY: Check all columns were added ─────────────────────────────────────
-- Run this block after the above to confirm:
SELECT
  column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'unified_cards'
  AND column_name IN ('edit_history', 'schedule_id', 'schedule_day_offset')
ORDER BY column_name;

SELECT
  column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'pairs')
  AND column_name IN ('referred_by', 'mediator_code')
ORDER BY table_name, column_name;
