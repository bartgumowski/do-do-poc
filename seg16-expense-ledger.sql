-- SEG-16: Expense Ledger (append-only court record)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.expense_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id          UUID NOT NULL REFERENCES public.pairs(id),
  card_id          UUID NOT NULL REFERENCES public.unified_cards(id),
  event_type       TEXT NOT NULL CHECK (event_type IN (
                     'created',
                     'amount_set',
                     'payment_requested',
                     'payment_sent',
                     'payment_confirmed',
                     'marked_paid_manual',
                     'receipt_uploaded'
                   )),
  actor_id         UUID REFERENCES auth.users(id),
  actor_name       TEXT,
  amount           NUMERIC(10,2),
  currency         TEXT,
  stripe_intent_id TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-card and per-pair queries
CREATE INDEX IF NOT EXISTS expense_ledger_card_id_idx  ON public.expense_ledger(card_id);
CREATE INDEX IF NOT EXISTS expense_ledger_pair_id_idx  ON public.expense_ledger(pair_id);
CREATE INDEX IF NOT EXISTS expense_ledger_created_idx  ON public.expense_ledger(created_at DESC);

-- Append-only: enable RLS (no UPDATE / DELETE policy = locked)
ALTER TABLE public.expense_ledger ENABLE ROW LEVEL SECURITY;

-- Pair members can read their own ledger
CREATE POLICY "Pair members can read ledger"
  ON public.expense_ledger FOR SELECT
  USING (pair_id = (
    SELECT pair_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Pair members can append events
CREATE POLICY "Pair members can insert ledger"
  ON public.expense_ledger FOR INSERT
  WITH CHECK (pair_id = (
    SELECT pair_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Service role (used by API / Stripe webhook) can also insert
-- No UPDATE or DELETE policy exists - rows are immutable.
