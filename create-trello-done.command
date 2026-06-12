#!/bin/bash
# Do-Do - Create Trello cards for DONE column
# Double-click this file to run

KEY="79765235f54c08c16ae992a8a4db5eef"
TOKEN="ATTAbd35a79ff22028f5f2b76c552045afc5da107644a5465b4bb9ac223927d74b73BFBB0E88"
BOARD="YdhiiQCS"

echo "Fetching Trello lists..."
LISTS_JSON=$(curl -s "https://api.trello.com/1/boards/$BOARD/lists?key=$KEY&token=$TOKEN&fields=id,name")
echo "Lists: $LISTS_JSON"
echo ""

LIST_ID=$(echo "$LISTS_JSON" | python3 -c "
import json, sys
lists = json.load(sys.stdin)
for l in lists:
    print(l['name'], '->', l['id'])
    name = l['name'].lower().replace(' ','')
    if 'done' in name or 'completed' in name or 'finished' in name:
        import sys; print('MATCH:', l['id'], file=sys.stderr)
        print(l['id'])
        break
" 2>/dev/null | tail -1)

echo "Using Done list ID: $LIST_ID"
echo ""

if [ -z "$LIST_ID" ]; then
  echo "Could not auto-detect Done list. All lists:"
  echo "$LISTS_JSON" | python3 -m json.tool
  echo ""
  echo "Edit this script and set LIST_ID manually, then re-run."
  read -p "Press Enter to exit..."
  exit 1
fi

create_card() {
  local NAME="$1"
  local DESC="$2"
  echo "Creating: $NAME"
  curl -s -X POST "https://api.trello.com/1/cards" \
    --data-urlencode "name=$NAME" \
    --data-urlencode "desc=$DESC" \
    --data-urlencode "idList=$LIST_ID" \
    --data-urlencode "key=$KEY" \
    --data-urlencode "token=$TOKEN" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('  OK -', d.get('url','error'))" 2>/dev/null
}

echo "=============================="
echo "Foundation"
echo "=============================="
create_card "Buy domain do-do.app" "Domain purchased and live at do-do.app."
create_card "UI Design" "Full app UI designed and implemented - board layout, card dialogs, settings, modals, mobile-responsive."

echo ""
echo "=============================="
echo "SEG-02 - Calendar"
echo "=============================="
create_card "SEG-02 - Calendar - Full segment done" "Google Calendar token refresh, co-parent busy slots, Apple CalDAV, recurring events (RRULE + GCal sync), conflict detection between co-parents. All sub-tasks 2.1-2.5 complete."

echo ""
echo "=============================="
echo "SEG-03 - AI Card Capture"
echo "=============================="
create_card "SEG-03 - AI Card Capture - Full segment done" "/api/interpret wired into card form (replaced regex). AI reminder extraction, recurring event detection, conflict suggestion (/api/suggest-resolution.js). All sub-tasks 3.1-3.4 complete."

echo ""
echo "=============================="
echo "SEG-04 - Notifications"
echo "=============================="
create_card "SEG-04 - Notifications - Full segment done (v0.4.0)" "Vercel cron reminders enabled. Web Push / VAPID setup. Push notification permission UI. Notification preferences per user in Settings. All sub-tasks 4.1-4.4 complete."

echo ""
echo "=============================="
echo "SEG-05 - Payments & Subscription"
echo "=============================="
create_card "SEG-05 - Payments & Subscription - Full segment done (v0.5.0)" "Stripe integration with checkout, webhooks, 14-day free trial. Paywall + feature gating (10-card free limit). Upgrade prompt UI. Billing portal in Settings. Apple Pay + Google Pay on checkout. All sub-tasks 5.1-5.4 complete."

echo ""
echo "=============================="
echo "SEG-06 - Expense Payment Flow"
echo "=============================="
create_card "SEG-06 - Expense Payment Flow - Full segment done (v0.6.0)" "Stripe payment requests between co-parents. Apple Pay + Google Pay expense payment page (/pay/:intentId). Webhook auto-marks card as paid on Stripe confirmation. Receipt upload. Running balance summary. All sub-tasks 6.1-6.4 complete."

echo ""
echo "=============================="
echo "SEG-07 - Real-time Sync"
echo "=============================="
create_card "SEG-07 - Real-time Sync - Full segment done (v0.6.1)" "Shopping list synced to Supabase in real-time. Messages as real threads. Delete + clear bought buttons on shopping items. Presence indicators. All sub-tasks 7.1-7.4 complete."

echo ""
echo "=============================="
echo "SEG-08 - Co-parent Onboarding"
echo "=============================="
create_card "SEG-08 - Co-parent Onboarding - Full segment done (v0.6.1)" "Invite landing page. Invite status visible in Settings. Co-parent local name editing. Family member management. All sub-tasks 8.1-8.3 complete."

echo ""
echo "=============================="
echo "SEG-09 - Legal, Privacy & GDPR"
echo "=============================="
create_card "SEG-09 - Legal / Privacy / GDPR - Full segment done (v0.6.2)" "Account deletion (/api/delete-account.js). GDPR data export. Privacy policy + Terms of Service pages. Cookie consent banner. Data residency documented. All sub-tasks 9.1-9.5 complete."

echo ""
echo "=============================="
echo "SEG-13 - Guest Preview + Trust Page"
echo "=============================="
create_card "SEG-13 - Guest Preview + Trust Page - Full segment done (v0.7.0)" "Read-only invite preview with no account needed (fixes two-sided activation). Plain-Polish privacy page. i18n strings in EN/DE/PL for full guest flow. All sub-tasks 13.1-13.2 complete."

echo ""
echo "=============================="
echo "SEG-14 - Security Hardening"
echo "=============================="
create_card "SEG-14 - Security Hardening - Full segment done (v0.8.0)" "Auth on all service-role endpoints - IDOR fix (C1). Stripe webhook fails closed (C2). Stored XSS fixes + security headers in vercel.json (C3). AI + email relay endpoints locked down (H1). CORS hardened. Siri parked safely (H3/H4). All critical + high audit findings resolved."

echo ""
echo "=============================="
echo "Bonus - shipped outside SEG plan"
echo "=============================="
create_card "i18n - English, German, Polish (v0.6.3)" "Full internationalisation foundation. All key strings translated in EN/DE/PL. Language selector in Settings. Version number visible in Settings."
create_card "Custody calendar - schedule dialog + day overrides (v0.6.6-v0.6.7)" "Parenting schedule dialog. Per-day overrides with handover time. Week overview strip in agenda panel. Desktop calendar improvements. Palette-matched custody colours."
create_card "Vacation schedule + calendar change requests (v0.9.1-v0.9.2)" "Vacation schedule feature. Calendar change requests between co-parents."
create_card "Shopping UX polish + PWA improvements (v0.9.3-v0.9.7)" "Instant uncheck visual feedback. Mobile zoom disabled. Remember last visited module. Paste multi-line text as multiple shopping items. Shopping capture form redesigned."

echo ""
echo "=============================="
echo "All done! Check your Trello Done column."
echo "=============================="
read -p "Press Enter to close..."
