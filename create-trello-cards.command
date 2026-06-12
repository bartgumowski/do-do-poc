#!/bin/bash
# Do-Do - Create Trello cards for remaining segments
# Double-click this file to run

KEY="79765235f54c08c16ae992a8a4db5eef"
TOKEN="ATTAbd35a79ff22028f5f2b76c552045afc5da107644a5465b4bb9ac223927d74b73BFBB0E88"
BOARD="YdhiiQCS"

echo "Fetching Trello lists..."
LISTS=$(curl -s "https://api.trello.com/1/boards/$BOARD/lists?key=$KEY&token=$TOKEN&fields=id,name")
echo "Lists found: $LISTS"
echo ""

# Find the "To Do" list ID
TODO_ID=$(echo "$LISTS" | python3 -c "
import json, sys
lists = json.load(sys.stdin)
for l in lists:
    print(l['name'], '->', l['id'])
    if 'do' in l['name'].lower() or 'todo' in l['name'].lower().replace(' ','') or 'to do' in l['name'].lower():
        print('MATCH:', l['id'])
" 2>/dev/null)

echo "List lookup result: $TODO_ID"
echo ""

# Extract just the ID of the first matching "to do" list
LIST_ID=$(curl -s "https://api.trello.com/1/boards/$BOARD/lists?key=$KEY&token=$TOKEN&fields=id,name" | python3 -c "
import json, sys
lists = json.load(sys.stdin)
for l in lists:
    name = l['name'].lower().replace(' ','')
    if 'todo' in name or 'to-do' in name or 'backlog' in name:
        print(l['id'])
        break
else:
    # fallback: print all so user can choose
    for l in lists:
        print(l['id'], '|', l['name'])
")

echo "Using list ID: $LIST_ID"
echo ""

if [ -z "$LIST_ID" ]; then
  echo "Could not find a To Do list. Here are all lists:"
  curl -s "https://api.trello.com/1/boards/$BOARD/lists?key=$KEY&token=$TOKEN&fields=id,name" | python3 -m json.tool
  echo ""
  echo "Please edit this script and set LIST_ID manually."
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
echo "Creating Phase 0 - Security"
echo "=============================="
create_card "P0-1 - RLS audit" "Verify all Supabase tables have correct row-level security policies. Go to supabase dashboard -> Auth -> Policies. Every table (unified_cards, families, profiles, pairs, shopping_items, children, pets, messages_v2, push_subscriptions) must have SELECT/INSERT/UPDATE/DELETE policies using auth.uid()."
create_card "P0-2 - Google Calendar token refresh" "Store refresh token on sign-in. Build /api/refresh-google-token.js. Add calendar status chip in Settings. Push alert if token refresh fails. Acceptance: sign in with Google, close browser, reopen next day - calendar still works."
create_card "SEG-14 - Security hardening" "Fix Critical + High issues from 2026-06-10 audit. CSP headers, CORS config, input validation, rate limiting. Must be done before any real users or marketing push."

echo ""
echo "=============================="
echo "Creating Phase 1 - Poland Setup"
echo "=============================="
create_card "P1-1 - PLN pricing" "Add Stripe PLN products: PLN 39/mo, PLN 349/yr. Add STRIPE_MONTHLY_PRICE_ID_PLN and STRIPE_ANNUAL_PRICE_ID_PLN to Vercel env vars. Add LOCALE_CONFIG object to app.js. Detect locale from navigator.language or Vercel geolocation header."
create_card "P1-2 - Przelewy24 / BLIK payment" "Enable Przelewy24 and BLIK in Stripe dashboard. Settings -> Payment methods. Verify by creating a test Checkout session in PLN and confirming Przelewy24 appears."
create_card "P1-3 - Stripe Tax Poland" "Enable Stripe Tax in dashboard. Add Poland (PL) at 23% VAT. Set product tax code txcd_10402000 (SaaS/digital services). Verify test invoice includes VAT line."
create_card "P1-4 - i18n foundation" "Remove hardcoded CHF/Switzerland strings from index.html, app.js, features.js. Route all currency strings through LOCALE_CONFIG. Use Intl.DateTimeFormat not hardcoded date format strings."
create_card "P1-5 - Landing page reposition" "Remove all co-parenting/separation/divorce/custody language from homepage, invite email, upgrade prompt. Replace with: shared board, stay aligned, coordinate together. New tagline: Your shared life, organized."
create_card "P1-6 - Fix push notification opt-in timing" "Move push permission prompt to fire AFTER first card is saved, not on login. Add plain-language explanation before browser dialog: Get reminded on this device when something is due."
create_card "P1-7 - Vercel Pro upgrade" "Upgrade at vercel.com/account/billing (\$20/mo). Required for cron jobs to run. Verify /api/remind fires every 15 min in Vercel logs. Set budget alert at \$50/mo."
create_card "P1-8 - Supabase Pro upgrade" "Upgrade to Supabase Pro (\$25/mo). Set DB size alert in dashboard. Add monthly cleanup: DELETE FROM push_subscriptions WHERE created_at < NOW() - INTERVAL 6 months."
create_card "SEG-13 - Guest preview + trust page" "Read-only invite link that works without account creation (two-sided activation fix). Polish-language legal/privacy page (not English legalese). Status: In progress."

echo ""
echo "=============================="
echo "Creating Phase 2 - Retention"
echo "=============================="
create_card "P2-1 - Upgrade prompt timing" "Add soft warning at 8/10 cards. After 60-day pilot: if >60% stay under 8 cards, switch to 14-day time-based trial instead of card gating."
create_card "P2-2 - Share Do-Do referral link" "Add Share Do-Do section in Settings. Generate do-do.app/?ref=USERID link. Copy-to-clipboard + WhatsApp/email share intent. Track referred_by in Supabase profiles."
create_card "P2-3 - Partner activation tracking" "Track invites not accepted after 7 days. Send nudge email at day 3 via Resend: Still waiting for [name] to join? Consider read-only view for second partner."
create_card "P2-4 - Version bump automation" "Add to deploy script: auto-update cache-busting strings for app.js and styles.css in index.html. Bump APP_VERSION constant to match."
create_card "P2-5 - Pilot user interviews" "Interview first 20 Polish users (30 min each). Key questions: What problem were you solving? Which feature daily? Which feature missing? Did partner join? What would make you recommend?"

echo ""
echo "=============================="
echo "Creating Phase 3 - Distribution"
echo "=============================="
create_card "P3-1 / SEG-10 - PWA install prompt" "Custom install banner on second visit after 30s. iOS: Add to Home Screen instructions with screenshot. Android: native beforeinstallprompt dialog. Track install rate in Supabase."
create_card "P3-2 / SEG-12 - App Store (Capacitor)" "iOS + Android wrapper via Capacitor. Do NOT submit until Stripe subscription working and retention proven. Avoids Apple 30% IAP cut. PWA-first, App Store in v2."

echo ""
echo "=============================="
echo "Creating Phase 4 - Moat (SEG-11)"
echo "=============================="
create_card "SEG-11.1 - Legal export (evidence layer)" "Add edit_history JSONB column to unified_cards. Build /api/legal-export.js - timestamped PDF of all expenses, cards, messages. Add Download legal record button in Settings. Have one Polish family lawyer review format (PLN 500). Build before pilot ends."
create_card "SEG-11.2 - Shared history view" "New Settings section Your shared record after 30 days. Show card count, expense total, days coordinating, receipts stored. Tamper-evidence note. Milestone toasts at card 10/50/100. 1 day of work."
create_card "SEG-11.3 - Mediator dashboard" "Share with a mediator link in Settings. Mediator gets bookmarkable stats page (no login): referred count, both-active count. No PII - aggregate only. Build before first mediator meeting."
create_card "SEG-11.4 - Schedule cascade" "Named schedule templates (e.g. Week A - Bart week, repeating every 2 weeks). One action moves entire custody week with prompt: just this / all future. Push to both partners + GCal sync. 3-4 days."
create_card "SEG-15 - Immutable message log" "Court-safe communication - messages that cannot be edited or deleted after sending. Closes Do-Dos biggest legal trust gap vs OurFamilyWizard. 2-3 days."
create_card "SEG-16 - Expense court records" "Who paid what, when - immutable audit trail for expense disputes. Complements SEG-15 immutable messages. Closes legal trust gap. 1-2 days."
create_card "SEG-17 - Practitioner access + certified PDF records" "Opens B2B referral channel - lawyers and mediators recommend Do-Do. Certified PDF export that practitioners can use in proceedings. 3-4 days."

echo ""
echo "=============================="
echo "Creating Phase 5 - Google OAuth"
echo "=============================="
create_card "P5-1 - GCP OAuth consent screen prerequisites" "Fill out GCP consent screen: app name, logo, privacy policy URL, homepage, support email. Verify domain in Google Search Console for do-do.app. Confirm privacy policy has Google API Limited Use disclosure at /legal#google."
create_card "P5-2 - Submit Google verification request" "Go to GCP Console -> APIs & Services -> OAuth consent screen -> Prepare for verification. Record 2-5 min demo video: sign in with Google, grant calendar access, event appears in GCal, revoke flow in Settings. Submit."
create_card "P5-3 - CASA Tier 2 security assessment" "Google will likely assign CASA Tier 2 for calendar.events scope. Engage Bishop Fox, Schellman, or Tevora. Cost ~USD 1500-3500. Timeline 4-8 weeks. Provide: privacy policy URL, demo credentials, architecture overview, RLS audit evidence."
create_card "P5-4 - Upload CASA certificate to Google" "After passing CASA Tier 2, upload certificate in GCP Console. Google removes verification warning within 1-2 weeks. Status changes to Verified."

echo ""
echo "=============================="
echo "All done! Check your Trello board."
echo "=============================="
read -p "Press Enter to close..."
