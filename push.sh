#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock .git/HEAD.lock
git add -A
git commit -m "Expense status persistence + reminder email cron

Expenses (#5):
- Fix STATUS_TO_DB: Disputed -> disputed (was wrongly mapping to waiting)
- Fix STATUS_FROM_DB: paid -> Paid, disputed -> Disputed (survived round-trips)
- renderExpenseCard() with Approve/Dispute/Mark paid quick actions
- expense-action-btn CSS with color-coded hover states
- expose quickCompleteCard/quickRespondCard/openCardDialog on window

Reminder cron (#4):
- api/remind.js: queries unified_cards for reminder_time in 15-min window
- Sends per-recipient email via Resend, marks reminder_notified_at
- vercel.json: crons every 15 minutes at /api/remind
- Requires SUPABASE_URL + SUPABASE_SERVICE_KEY env vars in Vercel"
git push origin main
rm -f push.sh
