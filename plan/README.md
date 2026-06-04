# Do-Do Release Plan

## How to use this folder

Each segment has its own file: `SEG-01-security.md`, `SEG-02-calendar.md`, etc.

Every file contains:
- What to build and why
- Exact files to change
- Acceptance criteria
- How to test
- How to deploy

**Execution order:** 01 → 02 (tasks 1-2) → 03 (tasks 1-2) → 04 (task 1) → 05 (tasks 1-3) → 02 (tasks 3-5) → 04 (tasks 2-4) → 07 → 06 → 08 → 09 → 10 → 03 (tasks 3-4) + 05 (task 4)

## Stack reference

| Layer | Service | Notes |
|---|---|---|
| Frontend | Vanilla JS, no framework | `app.js`, `features.js`, `index.html`, `styles.css` |
| Backend | Vercel serverless | `/api/*.js` - Node 18, ES modules |
| Database | Supabase (PostgreSQL) | Project: `vkafktcrhrmehruiqjni` |
| Auth | Supabase Auth | Google OAuth + email/password |
| Calendar | Google Calendar API v3 | OAuth token from Supabase session |
| AI | Anthropic Claude Haiku | `/api/interpret.js` |
| Email | Resend | `/api/remind.js`, `/api/invite-email.js` |
| Payments | Stripe (planned) | Not yet implemented |
| PWA | Service worker | `sw.js` |

## Environment variables (Vercel dashboard)

| Variable | Used by | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/remind`, `/api/invite-email` | Set |
| `RESEND_API_KEY` | `/api/remind`, `/api/invite-email` | Set |
| `ANTHROPIC_API_KEY` | `/api/interpret`, `/api/summary` | Set |
| `STRIPE_SECRET_KEY` | `/api/stripe-*` | Not set - needed for Seg 5 |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe-webhook` | Not set - needed for Seg 5 |
| `VAPID_PUBLIC_KEY` | Push notifications | Not set - needed for Seg 4 |
| `VAPID_PRIVATE_KEY` | Push notifications | Not set - needed for Seg 4 |

## Deploy

```bash
cd ~/Documents/Claude/Projects/Do-DoPOCv04
rm .git/index.lock .git/HEAD.lock 2>/dev/null; true
git add -A
git commit -m "your message"
git push origin main
```

Vercel auto-deploys from `main` branch of `bartgumowski/do-do-poc`.
Live at: https://do-do.app

## Segment status

| # | Segment | Status |
|---|---|---|
| 01 | Security & Data Foundation | Pending |
| 02 | Calendar - Real Integration | Partial (GCal write works, token refresh missing) |
| 03 | AI - Replace Regex with Claude | Partial (interpret endpoint exists, not wired to form) |
| 04 | Notifications | Partial (email works, push missing, cron not configured) |
| 05 | Payments - App Subscription | Not started |
| 06 | Expense Payment Flow | Not started |
| 07 | Real-time & Sync | Partial (cards sync, shopping/messages don't) |
| 08 | Co-parent Onboarding | Partial (invite email works, landing page missing) |
| 09 | Legal, Privacy & GDPR | Not started |
| 10 | App Store & Distribution | Not started |
