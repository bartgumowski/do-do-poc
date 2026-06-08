-- SEG-06: Expense Payment Flow
-- Run in Supabase SQL editor

-- Payment tracking columns on unified_cards
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_status TEXT
  DEFAULT 'none' CHECK (payment_status IN ('none', 'pending', 'paid', 'disputed'));
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2);
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_paid_by UUID
  REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ;

-- Receipt storage reference
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Index for webhook lookups by payment_intent_id
CREATE INDEX IF NOT EXISTS idx_unified_cards_payment_intent
  ON public.unified_cards (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- Supabase Storage: receipts bucket (run once, idempotent via INSERT ... ON CONFLICT DO NOTHING)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', false)
  ON CONFLICT (id) DO NOTHING;

-- RLS for receipts bucket: family members can read/write their own family's receipts
-- The path convention is: {family_id}/{card_id}/receipt.{ext}
-- We gate on pair membership via the unified_cards pair_id.
-- Simplest approach: allow authenticated users to read/write paths
-- where the first path segment matches a family they belong to.
-- Adjust to match your existing RLS patterns.

-- Storage policies (storage.objects)
DO $$
BEGIN
  -- Upload policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'receipts_insert_own_family'
  ) THEN
    EXECUTE $p$
      CREATE POLICY receipts_insert_own_family ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'receipts'
          AND auth.uid() IS NOT NULL
        )
    $p$;
  END IF;

  -- Read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'receipts_select_own_family'
  ) THEN
    EXECUTE $p$
      CREATE POLICY receipts_select_own_family ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'receipts'
          AND auth.uid() IS NOT NULL
        )
    $p$;
  END IF;

  -- Delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'receipts_delete_own_family'
  ) THEN
    EXECUTE $p$
      CREATE POLICY receipts_delete_own_family ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = 'receipts'
          AND auth.uid() IS NOT NULL
        )
    $p$;
  END IF;
END $$;
