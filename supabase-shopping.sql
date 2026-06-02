-- Run this once in Supabase SQL editor: supabase.com/dashboard/project/vkafktcrhrmehruiqjni/sql

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

CREATE POLICY "Shopping: family members read"
  ON public.shopping_items FOR SELECT TO authenticated
  USING (family_id = public.my_family_id());

CREATE POLICY "Shopping: family members insert"
  ON public.shopping_items FOR INSERT TO authenticated
  WITH CHECK (family_id = public.my_family_id() AND created_by = auth.uid());

CREATE POLICY "Shopping: family members update"
  ON public.shopping_items FOR UPDATE TO authenticated
  USING (family_id = public.my_family_id());

CREATE POLICY "Shopping: family members delete"
  ON public.shopping_items FOR DELETE TO authenticated
  USING (family_id = public.my_family_id());
