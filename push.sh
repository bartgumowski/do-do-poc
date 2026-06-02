#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock .git/HEAD.lock
git add -A
git commit -m "Expense status, reminder cron, env var fixes

Expenses:
- STATUS_TO_DB: Disputed -> disputed (was losing state on reload)
- STATUS_FROM_DB: paid -> Paid, disputed -> Disputed
- renderExpenseCard() with Approve/Dispute/Mark paid buttons
- Expose quickCompleteCard/quickRespondCard/openCardDialog on window
- Expense card CSS: status badges, action buttons

Reminder cron:
- api/remind.js: queries unified_cards for reminder_time in 15-min window, sends via Resend
- Uses existing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars
- vercel.json: crons every 15 min at /api/remind"
git push origin main
rm -f push.sh
