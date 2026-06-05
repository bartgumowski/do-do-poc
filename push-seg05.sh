#!/bin/bash
cd "$(dirname "$0")"

# Remove stale git lock
rm -f .git/index.lock

# Stage SEG-05 QA fixes
git add api/stripe-create-checkout.js api/stripe-webhook.js features.js seg05-payments.sql

# Commit
git commit -m "SEG-05 QA fixes: webhook ESM/CJS bug, pairId lookup, co-parent paywall, SQL migration

- api/stripe-webhook.js: remove invalid 'export const config' (ESM in CJS file - crashes Vercel)
- api/stripe-webhook.js: fix checkout.session.completed pairId lookup - retrieve subscription
  first, then read pairId from sub.metadata (not from session.subscription_data which isn't
  in the webhook payload)
- api/stripe-create-checkout.js: add metadata: { pairId } directly on the session as a
  fallback for the webhook handler
- features.js: gate co-parent invite behind isPaidUser() check (free = single user only, per plan)
- seg05-payments.sql: DB migration for stripe_customer_id, subscription_status, subscription_period_end"

# Push to prod
git push origin main

echo ""
echo "Done. Vercel will deploy in ~30s."
echo ""
echo "Manual steps still needed:"
echo "1. Run seg05-payments.sql in Supabase SQL editor"
echo "2. Add to Vercel env vars:"
echo "   STRIPE_SECRET_KEY         = sk_live_... (from Stripe dashboard)"
echo "   STRIPE_PUBLISHABLE_KEY    = pk_live_... (not used server-side, for reference)"
echo "   STRIPE_WEBHOOK_SECRET     = whsec_... (from Stripe webhook endpoint config)"
echo "   STRIPE_MONTHLY_PRICE_ID   = price_... (CHF 9.90/month product)"
echo "   STRIPE_ANNUAL_PRICE_ID    = price_... (CHF 89/year product)"
echo "3. Set window.STRIPE_MONTHLY_PRICE_ID in index.html once you have the price IDs"
echo "4. Register webhook in Stripe dashboard -> Developers -> Webhooks:"
echo "   URL: https://do-do.app/api/stripe-webhook"
echo "   Events: checkout.session.completed, customer.subscription.updated,"
echo "           customer.subscription.deleted, invoice.payment_failed"
