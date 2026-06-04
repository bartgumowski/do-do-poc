-- ============================================================
-- SEGMENT 1.1 - RLS AUDIT + HARDENING
-- Run each block in Supabase SQL editor:
-- https://supabase.com/dashboard/project/vkafktcrhrmehruiqjni/sql
-- ============================================================

-- ─── STEP 0: Confirm my_family_id() helper exists ────────────────────────────
-- This function is the cornerstone of all family-scoped RLS policies.
-- It returns the family_id of the currently authenticated user.

CREATE OR REPLACE FUNCTION public.my_family_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─── STEP 1: unified_cards ────────────────────────────────────────────────────
-- Cards belong to a pair. The pair belongs to a family.
-- Isolation: a user can only see cards where pair_id resolves to their family.

ALTER TABLE public.unified_cards ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies before recreating
DROP POLICY IF EXISTS "Cards: pair members select" ON public.unified_cards;
DROP POLICY IF EXISTS "Cards: pair members insert" ON public.unified_cards;
DROP POLICY IF EXISTS "Cards: pair members update" ON public.unified_cards;
DROP POLICY IF EXISTS "Cards: pair members delete" ON public.unified_cards;

-- Helper: does this pair_id belong to the current user's family?
-- We join through pairs -> family_id to enforce family-level isolation.
CREATE POLICY "Cards: pair members select"
  ON public.unified_cards FOR SELECT TO authenticated
  USING (
    pair_id IN (
      SELECT id FROM public.pairs
      WHERE family_id = public.my_family_id()
    )
  );

CREATE POLICY "Cards: pair members insert"
  ON public.unified_cards FOR INSERT TO authenticated
  WITH CHECK (
    pair_id IN (
      SELECT id FROM public.pairs
      WHERE family_id = public.my_family_id()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Cards: pair members update"
  ON public.unified_cards FOR UPDATE TO authenticated
  USING (
    pair_id IN (
      SELECT id FROM public.pairs
      WHERE family_id = public.my_family_id()
    )
  );

CREATE POLICY "Cards: pair members delete"
  ON public.unified_cards FOR DELETE TO authenticated
  USING (
    pair_id IN (
      SELECT id FROM public.pairs
      WHERE family_id = public.my_family_id()
    )
  );

-- ─── STEP 2: families ────────────────────────────────────────────────────────

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Families: members select" ON public.families;
DROP POLICY IF EXISTS "Families: members insert" ON public.families;

CREATE POLICY "Families: members select"
  ON public.families FOR SELECT TO authenticated
  USING (id = public.my_family_id());

-- Allow insert during onboarding (user creates their own family)
CREATE POLICY "Families: members insert"
  ON public.families FOR INSERT TO authenticated
  WITH CHECK (true); -- constrained by app logic; family_id is a UUID the client generates

-- ─── STEP 3: profiles ────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles: own row select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: family members select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: own row upsert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: own row update" ON public.profiles;

-- Users can always read their own profile (needed for my_family_id() bootstrap)
CREATE POLICY "Profiles: own row select"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can also read co-parent profiles in the same family
CREATE POLICY "Profiles: family members select"
  ON public.profiles FOR SELECT TO authenticated
  USING (family_id = public.my_family_id());

CREATE POLICY "Profiles: own row insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles: own row update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ─── STEP 4: pairs ───────────────────────────────────────────────────────────

ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pairs: family members select" ON public.pairs;
DROP POLICY IF EXISTS "Pairs: parent_a insert" ON public.pairs;
DROP POLICY IF EXISTS "Pairs: family members update" ON public.pairs;

CREATE POLICY "Pairs: family members select"
  ON public.pairs FOR SELECT TO authenticated
  USING (family_id = public.my_family_id());

CREATE POLICY "Pairs: parent_a insert"
  ON public.pairs FOR INSERT TO authenticated
  WITH CHECK (parent_a = auth.uid());

CREATE POLICY "Pairs: family members update"
  ON public.pairs FOR UPDATE TO authenticated
  USING (family_id = public.my_family_id() OR parent_b = auth.uid());

-- ─── STEP 5: shopping_items ──────────────────────────────────────────────────
-- Already defined in supabase-shopping.sql - included here for completeness.

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shopping: family members read" ON public.shopping_items;
DROP POLICY IF EXISTS "Shopping: family members insert" ON public.shopping_items;
DROP POLICY IF EXISTS "Shopping: family members update" ON public.shopping_items;
DROP POLICY IF EXISTS "Shopping: family members delete" ON public.shopping_items;

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

-- ─── STEP 6: messages_v2 (if it exists) ──────────────────────────────────────

ALTER TABLE public.messages_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages: pair members select" ON public.messages_v2;
DROP POLICY IF EXISTS "Messages: pair members insert" ON public.messages_v2;
DROP POLICY IF EXISTS "Messages: pair members delete" ON public.messages_v2;

CREATE POLICY "Messages: pair members select"
  ON public.messages_v2 FOR SELECT TO authenticated
  USING (
    pair_id IN (
      SELECT id FROM public.pairs WHERE family_id = public.my_family_id()
    )
  );

CREATE POLICY "Messages: pair members insert"
  ON public.messages_v2 FOR INSERT TO authenticated
  WITH CHECK (
    pair_id IN (
      SELECT id FROM public.pairs WHERE family_id = public.my_family_id()
    )
    AND sender_id = auth.uid()
  );

CREATE POLICY "Messages: own messages delete"
  ON public.messages_v2 FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- ─── STEP 7: children ────────────────────────────────────────────────────────

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Children: family members select" ON public.children;
DROP POLICY IF EXISTS "Children: family members insert" ON public.children;
DROP POLICY IF EXISTS "Children: family members update" ON public.children;
DROP POLICY IF EXISTS "Children: family members delete" ON public.children;

CREATE POLICY "Children: family members select"
  ON public.children FOR SELECT TO authenticated
  USING (family_id = public.my_family_id());

CREATE POLICY "Children: family members insert"
  ON public.children FOR INSERT TO authenticated
  WITH CHECK (family_id = public.my_family_id());

CREATE POLICY "Children: family members update"
  ON public.children FOR UPDATE TO authenticated
  USING (family_id = public.my_family_id());

CREATE POLICY "Children: family members delete"
  ON public.children FOR DELETE TO authenticated
  USING (family_id = public.my_family_id());

-- ─── STEP 8: Store provider_refresh_token on sign-in ──────────────────────────
-- Add column to profiles if not already present.
-- The /api/refresh-token Vercel function reads this to get fresh access tokens.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provider_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- ─── STEP 9: Verification query - run after applying policies ────────────────
-- This should return a row per table with rls_enabled = true and policy_count > 0.

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (
    SELECT COUNT(*) FROM pg_policies p
    WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename
  ) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('unified_cards','families','profiles','pairs','shopping_items','messages_v2','children')
ORDER BY tablename;
