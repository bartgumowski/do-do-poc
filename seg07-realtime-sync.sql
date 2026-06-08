-- SEG-07: Real-time Sync
-- Run in Supabase SQL editor: supabase.com/dashboard/project/vkafktcrhrmehruiqjni/sql

-- ─── 1. Shopping items (also in supabase-shopping.sql - idempotent) ────────────

CREATE TABLE IF NOT EXISTS public.shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list TEXT NOT NULL DEFAULT 'groceries' CHECK (list IN ('groceries', 'other')),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_family ON public.shopping_items(family_id);
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopping_items' AND policyname='Shopping: family members read') THEN
    CREATE POLICY "Shopping: family members read" ON public.shopping_items FOR SELECT TO authenticated USING (family_id = public.my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopping_items' AND policyname='Shopping: family members insert') THEN
    CREATE POLICY "Shopping: family members insert" ON public.shopping_items FOR INSERT TO authenticated WITH CHECK (family_id = public.my_family_id() AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopping_items' AND policyname='Shopping: family members update') THEN
    CREATE POLICY "Shopping: family members update" ON public.shopping_items FOR UPDATE TO authenticated USING (family_id = public.my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopping_items' AND policyname='Shopping: family members delete') THEN
    CREATE POLICY "Shopping: family members delete" ON public.shopping_items FOR DELETE TO authenticated USING (family_id = public.my_family_id());
  END IF;
END $$;

-- ─── 2. Messages (messages_v2) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.messages_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  topic TEXT NOT NULL DEFAULT 'schedule'
    CHECK (topic IN ('schedule', 'school', 'medical', 'expenses', 'general')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.unified_cards(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_v2_pair_topic ON public.messages_v2(pair_id, topic, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_v2_sender ON public.messages_v2(sender_id);
ALTER TABLE public.messages_v2 ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of this pair?
CREATE OR REPLACE FUNCTION public.my_pair_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.pairs
  WHERE parent_a = auth.uid() OR parent_b = auth.uid()
  LIMIT 1;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages_v2' AND policyname='Messages: pair members read') THEN
    CREATE POLICY "Messages: pair members read" ON public.messages_v2 FOR SELECT TO authenticated
      USING (pair_id = public.my_pair_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages_v2' AND policyname='Messages: pair members insert') THEN
    CREATE POLICY "Messages: pair members insert" ON public.messages_v2 FOR INSERT TO authenticated
      WITH CHECK (pair_id = public.my_pair_id() AND sender_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages_v2' AND policyname='Messages: pair members soft-delete') THEN
    CREATE POLICY "Messages: pair members soft-delete" ON public.messages_v2 FOR UPDATE TO authenticated
      USING (pair_id = public.my_pair_id() AND sender_id = auth.uid());
  END IF;
END $$;

-- Enable Realtime on both tables (run once)
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages_v2;
