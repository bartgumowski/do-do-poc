# Do-Do

Family coordination app for co-parents. Live at **https://do-do.app**

Current version: **v0.6.2**

---

## Deploy

```bash
cd ~/Documents/Claude/Projects/Do-DoPOCv04
git add -A
git commit -m "your message"
git push origin main
```

Vercel auto-deploys from `main`. No build step. If `git add` fails with a lock error, remove `.git/index.lock` in Finder.

---

## File overview

| File | Purpose |
|---|---|
| `index.html` | App shell, all dialogs, cookie banner |
| `app.js` | App logic, state, card dialog, auth, Supabase realtime, presence, background sync |
| `features.js` | Calendar, shopping, expenses, messages, settings modules |
| `styles.css` | All styles |
| `supabase-data.js` | Supabase data layer - cards, shopping, messages, auth, invite, profile |
| `sw.js` | Service worker - PWA offline cache, push notifications, background sync |
| `legal.html` | Public privacy policy and terms of service |
| `manifest.webmanifest` | PWA manifest |

### API functions (`/api/`)

| Function | Purpose |
|---|---|
| `interpret.js` | Claude Haiku field extraction from natural language |
| `suggest-resolution.js` | AI conflict resolution suggestion |
| `summary.js` | Card summary |
| `invite-email.js` | Co-parent invite email via Resend |
| `remind.js` | Cron reminder sender (email + push) |
| `push-subscribe.js` | Save/remove VAPID push subscriptions |
| `apple-calendar.js` | Apple CalDAV proxy |
| `refresh-token.js` | Google OAuth token refresh |
| `stripe-create-checkout.js` | Stripe Checkout session for subscription |
| `stripe-webhook.js` | Stripe webhook handler (subscription + expense payments) |
| `stripe-portal.js` | Stripe Customer Portal session |
| `stripe-expense-payment.js` | Stripe PaymentIntent for co-parent expense reimbursement |
| `expense-pay.js` | Hosted payment page (Apple Pay, Google Pay, card) at `/pay/:id` |
| `delete-account.js` | GDPR account deletion (anonymise cards, delete profile + auth user) |
| `export-data.js` | GDPR data portability - JSON download of all user data |

---

## URL routes

| URL | View |
|---|---|
| `/#board` | Coordination board (kanban: To decide / Mine / Done) |
| `/#calendar` | Shared family calendar with Google Calendar and Apple CalDAV |
| `/#messages` | Topic threads (Schedule, School, Medical, Expenses, General) |
| `/#shopping` | Shared shopping list (Groceries / Other) with real-time sync |
| `/#expenses` | Expense tracker with payment requests and balance |
| `/#settings` | Settings, integrations, notifications, subscription, profile |
| `/pay/:intentId` | Hosted Stripe payment page for expense reimbursement |
| `/invite/:token` | Co-parent invite acceptance |
| `/legal.html` | Privacy policy and terms of service |

---

## Tech stack

- **Frontend:** Vanilla JS, no framework, no build step
- **Backend:** Vercel serverless functions (Node 18, CommonJS)
- **Database:** Supabase PostgreSQL (EU-West-1, Ireland) with Row Level Security
- **Auth:** Supabase Auth - Google OAuth + email/password + Apple
- **Real-time:** Supabase Realtime (cards, shopping, messages, presence)
- **Storage:** Supabase Storage (`receipts` bucket)
- **AI:** Anthropic Claude Haiku via API
- **Email:** Resend (reminders, invites, notifications)
- **Payments:** Stripe (subscriptions + one-time expense payments)
- **Push:** Web Push / VAPID
- **PWA:** Service worker with offline cache and background sync
- **Calendar:** Google Calendar API v3, Apple CalDAV

---

## Feature summary

| Feature | Status |
|---|---|
| Board (kanban cards, comments, assignee, due date) | Live |
| Google Calendar sync (2-way, recurring, reminders) | Live |
| Apple CalDAV sync | Live |
| AI field extraction (Claude Haiku on natural language input) | Live |
| Conflict detection and AI suggestions | Live |
| Co-parent invite flow | Live |
| Web push notifications + quiet hours | Live |
| Email reminders (cron, 15 min - needs Vercel Pro) | Live |
| App subscription (Stripe, 14-day trial, CHF 9.90/mo) | Live |
| Expense payment requests (Stripe PaymentIntent) | Live |
| Expense payment page (Apple Pay / Google Pay / card) | Live |
| Receipt photo upload | Live |
| Expense balance summary | Live |
| Shopping list (real-time sync, delete, clear bought) | Live |
| Direct messages by topic (real-time) | Live |
| Presence indicators (co-parent viewing same card) | Live |
| Offline background sync | Live |
| Parent name editing | Live |
| Children / pets management with Supabase sync | Live |
| GDPR account deletion | Live |
| GDPR data export (JSON) | Live |
| Cookie consent banner | Live |
| Privacy policy and terms (legal.html) | Live |
| PWA install banner | Planned (SEG-10) |
| Native iOS / Android (Capacitor) | Planned (SEG-10) |

---

## Security

- Only the Supabase anonymous key is in frontend code
- Never commit service-role keys, `.env.local`, or GitHub tokens
- All admin operations (account deletion, data export) are server-side with JWT verification
- Supabase RLS enforces family-level data isolation
