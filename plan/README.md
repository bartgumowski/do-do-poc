# Do-Do Release Plan

## How to use this folder

Each segment has its own file: `SEG-01-security.md`, `SEG-02-calendar.md`, etc.

Every file contains the problem, implementation approach, acceptance criteria, and deployment notes.

**Execution order:** 01 - 02 - 03 - 04 - 05 - 06 - 07 - 08 - 09 - 10

---

## Stack reference

| Layer | Service | Notes |
|---|---|---|
| Frontend | Vanilla JS, no framework | `app.js`, `features.js`, `index.html`, `styles.css` |
| Backend | Vercel serverless | `/api/*.js` - Node 18, CommonJS |
| Database | Supabase (PostgreSQL, EU-West-1 Ireland) | Project: `vkafktcrhrmehruiqjni` |
| Auth | Supabase Auth | Google OAuth + email/password + Apple |
| Calendar | Google Calendar API v3 | OAuth token from Supabase session |
| AI | Anthropic Claude Haiku | `/api/interpret.js`, `/api/suggest-resolution.js` |
| Email | Resend | Reminders, invites, payment requests, account deletion notices |
| Payments | Stripe | Subscriptions (SEG-05) + expense payments (SEG-06) |
| Push | Web Push / VAPID | `/api/push-subscribe.js`, `/api/remind.js` |
| Storage | Supabase Storage | `receipts` bucket for expense receipt photos |
| PWA | Service worker | `sw.js` - offline cache + background sync |

---

## Environment variables (Vercel dashboard)

| Variable | Used by | Status |
|---|---|---|
| `SUPABASE_URL` | All server functions | Set |
| `SUPABASE_ANON_KEY` | Client-side auth | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Server functions (admin ops) | Set |
| `RESEND_API_KEY` | Remind, invite, expense payment, account deletion | Set |
| `RESEND_FROM_EMAIL` | All email senders | Optional - falls back to `onboarding@resend.dev` |
| `ANTHROPIC_API_KEY` | `/api/interpret`, `/api/suggest-resolution`, `/api/summary` | Set |
| `VAPID_PUBLIC_KEY` | Push notifications | Set |
| `VAPID_PRIVATE_KEY` | Push notifications | Set |
| `VAPID_SUBJECT` | Push notifications | Set |
| `STRIPE_SECRET_KEY` | `/api/stripe-*` | Needs live key verified in Vercel |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe-webhook` | Needs verification |
| `STRIPE_MONTHLY_PRICE_ID` | `index.html` (client-side) | Set `window.STRIPE_MONTHLY_PRICE_ID` in index.html |
| `STRIPE_ANNUAL_PRICE_ID` | `index.html` (client-side) | Set `window.STRIPE_ANNUAL_PRICE_ID` in index.html |
| `APP_BASE_URL` | `/api/stripe-expense-payment` | Set to `https://do-do.app` |
| `SIRI_TOKEN_SECRET` | `/api/siri-token`, `/api/siri-add`, `/api/siri-shortcut` | Random 32+ char secret - generate with `openssl rand -hex 32`. Set in Vercel Production. |

---

## Deploy

```bash
cd ~/Documents/Claude/Projects/Do-DoPOCv04
git add -A
git commit -m "your message"
git push origin main
```

Vercel auto-deploys from `main` branch of `bartgumowski/do-do-poc`. Live at **https://do-do.app**

Note: if `git add` fails with a lock error, remove `.git/index.lock` in Finder first.

---

## Segment status

| # | Segment | Status | Version |
|---|---|---|---|
| 01 | Security & Data Foundation | Partial - RLS policies exist; verify all tables enabled in Supabase dashboard | - |
| 02 | Calendar - Real Integration | Done - Google OAuth token refresh, co-parent busy slots, Apple CalDAV, recurring events, conflict detection | v0.2.x |
| 03 | AI - Field extraction and NLP | Done - Claude Haiku field extraction, NLP reminders, recurrence detection, conflict AI suggestions | v0.3.0 |
| 04 | Notifications | Done - web push, VAPID, cron reminders, quiet hours, notification prefs panel | v0.4.0 |
| 05 | Payments - App Subscription | Done - Stripe Checkout, 14-day trial, paywall (10 card free limit), Customer Portal, webhook | v0.5.0 |
| 06 | Expense Payment Flow | Done - Stripe PaymentIntent, /pay/:id page, Apple/Google Pay, receipt upload, balance summary | v0.6.0 |
| 07 | Real-time and Sync | Done - shopping Supabase real-time, messages_v2 real-time, presence indicators, background sync, delete/clear bought | v0.6.1 |
| 08 | Co-parent Onboarding | Done - invite screen with children names, parent name editing, children Supabase sync, invite link recovery | v0.6.1 |
| 09 | Legal, Privacy and GDPR | Done - account deletion API, data export API, legal.html finalized, cookie banner | v0.6.2 |
| 10 | App Store and Distribution | Not started | - |
| 11 | Siri / Voice Shortcuts (PWA) | Done - per-user HMAC tokens, personalised .shortcut file download, Settings UI | v0.6.10 |
| 12 | Native iOS Wrapper (SiriKit + App Store) | Not started - see SEG-12-ios-native-wrapper.md | - |

---

## Pending manual steps

### Supabase SQL - run once in SQL editor

```
seg04-notifications.sql  - push_subscriptions table + notification_prefs on profiles
seg05-payments.sql       - stripe_customer_id, subscription_status, subscription_period_end on pairs
seg06-expense-payments.sql - payment columns on unified_cards + receipts storage bucket
seg07-realtime-sync.sql  - shopping_items + messages_v2 tables + Realtime publication
```

### Stripe dashboard

- Register webhook at `https://do-do.app/api/stripe-webhook`
- Required events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `payment_intent.succeeded`
- Set `window.STRIPE_MONTHLY_PRICE_ID` and `window.STRIPE_ANNUAL_PRICE_ID` in index.html once price IDs are confirmed

### Vercel

- Upgrade to Vercel Pro ($20/mo) to enable cron jobs (15-minute reminder checks at `/api/remind`)

### Next: SEG-10 - App Store and Distribution

See `SEG-10-distribution.md` - PWA install banner, Capacitor iOS/Android builds, TestFlight, App Store listing.
