#!/bin/bash
cd "$(dirname "$0")"

# Remove stale git lock
rm -f .git/index.lock

# Stage all SEG-06 changes
git add \
  api/stripe-expense-payment.js \
  api/expense-pay.js \
  api/stripe-webhook.js \
  seg06-expense-payments.sql \
  supabase-data.js \
  features.js \
  app.js \
  index.html \
  styles.css \
  vercel.json \
  CHANGELOG.md

# Commit
git commit -m "SEG-06: Expense payment flow - Stripe requests, payment page, receipt upload, balance

6.1 Payment requests
- api/stripe-expense-payment.js: new endpoint - creates Stripe PaymentIntent, emails co-parent
  a payment link via Resend, updates card payment_status=pending in Supabase
- app.js: updatePaymentPanel() shown in card dialog side column for Expense cards with amount
  Split select (50/50, 60/40, 100%), requestExpensePayment() posts to API and updates local state
- index.html: #cardPaymentPanel and #cardReceiptPanel sections added to dialog-side-col

6.2 Apple Pay / Google Pay payment page
- api/expense-pay.js: self-contained HTML page with Stripe Payment Element (no app login needed)
  Apple Pay + Google Pay + card fallback. Shows success/error pages for terminal states.
- vercel.json: /pay/:intent rewrite -> /api/expense-pay?intent=:intent
- api/stripe-webhook.js: payment_intent.succeeded handler marks card payment_status=paid

6.3 Receipt upload
- app.js: uploadReceipt() - uploads file to Supabase Storage bucket 'receipts', saves URL to card
  Receipt panel in card dialog with thumbnail preview for images, link for PDFs
- supabase-data.js: receipt_url added to cardToDbRow and dbRowToCard

6.4 Balance summary
- features.js: computeBalance() - running total of unsettled expenses (uses payment_amount or half)
  Balance row added to expense summary panel (They owe you / You owe / Settled up)
  renderExpenseCard(): payment status chips, receipt chip, Request payment button

Data: supabase-data.js adds payment_intent_id, payment_status, payment_amount,
payment_paid_at, receipt_url to card DB mapping. seg06-expense-payments.sql adds columns."

# Push to prod
git push origin main

echo ""
echo "Done. Vercel will deploy in ~30s."
echo ""
echo "Manual steps still needed:"
echo "1. Run seg06-expense-payments.sql in Supabase SQL editor"
echo "2. Ensure 'receipts' storage bucket exists in Supabase"
echo "   (SQL file creates it, but bucket may need RLS policies reviewed)"
echo "3. Add 'payment_intent.succeeded' to Stripe webhook endpoint:"
echo "   Stripe dashboard -> Developers -> Webhooks -> do-do.app/api/stripe-webhook -> Add event"
echo "4. Optional: set APP_BASE_URL=https://do-do.app in Vercel env vars"
echo "   (used for payment link URLs; falls back to VERCEL_URL)"
