# SEG-05 - Payments - App Subscription

**Priority:** Required before any public launch
**Status:** Not started
**Estimated effort:** 3-4 days
**Depends on:** SEG-01 (Supabase user data)

---

## Pricing model recommendation
- **Free:** 1 parent only, 10 cards max, no calendar sync, no AI
- **Family:** CHF 9.90/month or CHF 89/year - both parents, unlimited, full features

---

## 5.1 Stripe Integration

### Setup
1. Create Stripe account at stripe.com
2. Create product "Do-Do Family" with monthly and annual prices
3. Add to Vercel env vars:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_MONTHLY_PRICE_ID`
   - `STRIPE_ANNUAL_PRICE_ID`

### Database
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.pairs ADD COLUMN IF NOT EXISTS subscription_status TEXT
  DEFAULT 'free' CHECK (subscription_status IN ('free', 'trialing', 'active', 'past_due', 'canceled'));
ALTER TABLE public.pairs ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;
```

### New Vercel functions

**`/api/stripe-create-checkout.js`**
```js
// Creates Stripe Checkout session
// Input: { priceId, userId, pairId, successUrl, cancelUrl }
// Output: { url } - redirect user to this URL
```

**`/api/stripe-webhook.js`**
```js
// Handles Stripe events:
// checkout.session.completed → set subscription_status = 'active'
// customer.subscription.deleted → set subscription_status = 'canceled'
// invoice.payment_failed → set subscription_status = 'past_due'
// Always verify webhook signature with STRIPE_WEBHOOK_SECRET
```

**`/api/stripe-portal.js`**
```js
// Creates Stripe Customer Portal session
// Output: { url } - redirect user to manage their subscription
```

---

## 5.2 Paywall & Feature Gating

### Files to change
- `app.js` - add `isPaidUser()` check
- `supabase-data.js` - load subscription status from `pairs` table
- `features.js` - gate calendar sync behind paid check
- `index.html` - add paywall/upgrade screen

### isPaidUser() logic
```js
function isPaidUser() {
  const status = state.subscriptionStatus; // loaded from pairs table
  return ['active', 'trialing'].includes(status);
}
```

### Gated features
- Google Calendar sync (settings toggle disabled with upgrade prompt)
- AI field extraction (fallback to regex on free)
- Co-parent invite (free = single user only)
- Cards: free limited to 10, show counter "8/10 Dos used - Upgrade for unlimited"

### Upgrade prompt UI
Shown when free user hits limit or tries a paid feature:
```
"Upgrade to Do-Do Family
Both parents. Unlimited Dos. Calendar sync. AI reminders.
CHF 9.90/month"
[Start free trial]  [Maybe later]
```

---

## 5.3 Billing Portal in Settings

### In features.js settings module
Add "Subscription" section:
- Show current plan (Free / Family)
- Show renewal date if active
- "Manage subscription" button → calls `/api/stripe-portal` → redirects to Stripe portal
- "Upgrade" button for free users → calls `/api/stripe-create-checkout`

---

## 5.4 Apple Pay & Google Pay on Checkout

No extra code required. Stripe Checkout hosted page automatically shows:
- Apple Pay button on Safari (macOS and iOS)
- Google Pay button on Chrome (Android and desktop)

When user clicks "Upgrade" and is redirected to Stripe Checkout,
they see their wallet option automatically.

### Acceptance criteria for all of 5.x
- [ ] Free user can create account and use up to 10 cards
- [ ] Free user sees upgrade prompt when hitting limit
- [ ] Paid user completes checkout with Apple Pay or card
- [ ] After payment, `subscription_status = 'active'` in Supabase
- [ ] Calendar sync becomes available immediately after upgrade
- [ ] Manage subscription link opens Stripe portal
- [ ] Cancellation sets status to 'canceled', features locked at period end
- [ ] Failed payment sets status to 'past_due', user notified by email
