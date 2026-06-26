# Do-Do Changelog

---

## v0.30.1 - 2026-06-26 - Bug fixes

- **Settings crash now visible** - wrapped `renderSettingsFeature()` in a try-catch so any crash shows an error message instead of a blank white screen.
- **Cards no longer disappear after save** - saving a card now clears any active board filter (Needs response, Waiting, etc.) so the saved card is always visible immediately after saving.
- **Reminders button now shows reminders view** - the "Reminders (N)" counter in the toolbar no longer opens Settings. It now filters the board to show only cards that have an in-app reminder set.

---

## v0.30.0 - 2026-06-26 - Kid Access

- **Kid Access feature** - each child gets a private link + 4-digit PIN. Child opens the link in any browser, enters the PIN, and sees their upcoming cards and a note from parents.
- **"I need something" card** - child can submit a request card that appears on the parent board, tagged "From [child name]".
- **PIN security** - PBKDF2 (100k iterations, SHA-256) on the server side. 5 wrong attempts locks access for 10 minutes. Session token is HMAC-signed, valid 30 days.
- **Settings panel** - new "Kid Access" section in Settings, before Pets. Shows setup status per child, "Set up" / "Copy link" / "Reset PIN" controls.
- **Parent board badge** - cards created by a child show a yellow "From [name]" badge.
- **No new serverless functions** - all server logic added to the existing `api/guest-view.js` (POST routes for kid-auth and kid-card, GET route for kid data).
- **CSP-compatible** - kid.html uses a single inline theme script (hashed in CSP). All app logic is in external `kid.js`.
- **Requires SQL migration** - run `ALTER TABLE children ADD COLUMN IF NOT EXISTS kid_token...` in Supabase before deploying.
- Files changed: `api/guest-view.js`, `kid.html` (new), `kid.js` (new), `supabase-data.js`, `features.js`, `app.js`, `styles.css`, `vercel.json`.

---

## v0.29.2 - 2026-06-26 - Architecture fixes (no new features)

- **CSP hardened** - removed `unsafe-inline` from `script-src`. VAPID key and Stripe price IDs moved from inline `<script>` blocks in `index.html` to a new `config.js` file. Remaining theme-flash-prevention script covered by SHA-256 hash in CSP.
- **AI rate limiting** - `/api/ai.js` now enforces a max of 20 calls per user per hour (in-memory, resets on cold start). Returns HTTP 429 when exceeded.
- **ESM/CJS fix in remind.js** - `export default` changed to `module.exports =`, matching all other API functions. Previous mismatch could cause silent handler failures.
- **localStorage abstraction** - all direct `localStorage.` calls in `app.js` (sync queue, tips, notifications, cookie banner) now go through the `storage` abstraction that falls back to an in-memory Map if localStorage is blocked (iOS private mode, enterprise security). Same fix in `features.js` via `_ls` helper (25 call sites).
- **Cache busters unified** - `styles.css` and all JS files now use `?v=20260626-fixes`.
- **Supabase bundle documented** - `supabase.js` now has a version comment explaining it is manually vendored and how to update it.

---

## v0.29.1 - 2026-06-26 - Fix crash: DAILY_TIPS Temporal Dead Zone

- **Root cause of v0.29.0 crash fixed** - `render()` is called synchronously at line 649 during script init. `DAILY_TIPS` was declared with `const` at line 1599, after that call, causing a JavaScript Temporal Dead Zone ReferenceError that crashed the entire app (cards, settings, calendar all broken). Fix: moved `DAILY_TIPS` and `renderDailyTip()` to before the first `render()` call.
- **Cache busters updated** - all JS files now load with `?v=20260623-tips` to force browsers to discard any cached old files.

---

## v0.29.0 - 2026-06-23 - Daily Parenting Tip

- **Daily tip card** - small strip shown between the Daily Summary and the board. One tip per day, same tip for both parents (deterministic by day-of-year, no sync needed).
- **Dismiss** - tap "Got it" to hide for the rest of the day. Auto-resets next day via localStorage key `do-do-tip-dismissed-YYYY-MM-DD`.
- **Settings toggle** - "Daily parenting tips" on/off switch added to the Appearance section in Settings. Defaults to on.
- **17 tips in EN + PL** across 5 themes: Praise, Connection, Emotion, Routine, Co-parent, Fun. DE content uses EN as fallback pending Bart review.
- **i18n** - added `tip.card.label`, `tip.dismiss`, `tip.settings.label`, `tip.settings.desc` in EN/PL/DE.
- Changes isolated to: `index.html` (1 new section), `app.js` (DAILY_TIPS array + renderDailyTip function), `features.js` (toggle + event listener), `styles.css` (tip card styles), `i18n.js` (4 new keys x 3 languages). No existing functionality touched.

---

## v0.28.4 - 2026-06-23 - Fix Google sign-in (PKCE code_verifier)

- **Google sign-in root cause fixed** - The Supabase client was configured with `flowType: 'implicit'` (the default), so `signInWithOAuth` never generated a `code_verifier`. When Google redirected back with `?code=`, the manual `exchangeCodeForSession` call sent an empty `code_verifier` to GoTrue. GoTrue rejected it. Fix: set `flowType: "pkce"` so a proper `code_verifier` is generated and stored before the redirect, and set `detectSessionInUrl: false` so Supabase does not try to consume the code automatically (which would conflict with the manual exchange).

---

## v0.28.3 - 2026-06-23 - Guide overlay + auth fixes

- **Guide overlay no longer blocks all buttons** - clicking anywhere on the dark guide background now dismisses the guide. Previously the overlay had `pointer-events: all` with no click handler, so if the tooltip was off-screen or not visible, there was no way to dismiss and all buttons appeared to stop working. This was the root cause of the "settings button and other buttons not working" report.
- **Settings no longer flashes on token refresh** - `showApp`'s module restoration setTimeout now only runs on the first app load, not on every background token refresh. Token refreshes were interrupting active navigation.
- **Google login no longer redirects to login page** - `onAuthStateChange` now only calls `showAuthScreen()` on an explicit `SIGNED_OUT` event. Previously it also fired on `INITIAL_SESSION`/`TOKEN_REFRESHED` with null session (which can happen during the PKCE code exchange), sending users back to the login screen after signing in with Google.
- **Cache busters updated** - all JS files now load with `?v=20260623-guidefix`.

---

## v0.28.0 - 2026-06-19 - Data continuity: no more lost cards or data wipes

**Bug fixes - data loss:**
- Fixed silent save failure: when Supabase cannot save a card (network error, timeout), the card is now automatically added to the offline retry queue instead of being silently dropped. On next online/load it syncs automatically.
- Fixed load-overwrite bug: before loading cards from Supabase, the app now flushes any locally-queued cards first. Previously a card saved only to localStorage would be wiped the moment Supabase data arrived.
- Exposed `window._queueOfflineCard` so both app.js and supabase-data.js share the same retry mechanism.

**Data protection:**
- Shopping items now save to a 30-day rolling trash buffer in localStorage before hard-delete. Protects against accidental bulk wipes.

**Backup:**
- Added daily backup job inside the existing cron (remind.js, runs at 08:00 UTC). Exports all cards, messages, shopping items and pair metadata as JSON to Supabase Storage (`receipts/daily-backups/backup-YYYY-MM-DD.json`). Keeps last 7 days; older backups are pruned automatically. Backup runs even on days with no reminders due.

**GDPR - 6-month retention on account deletion:**
- Account deletion no longer immediately deletes the Supabase Auth user. Instead, a deletion record is written to `receipts/deletion-queue/{userId}.json` with a `deleteAt` date 6 months from the request. The daily cron processes the queue and permanently removes the auth record once the 6-month window passes. All PII (cards, messages, profile) is still anonymised immediately on deletion as before. Falls back to immediate deletion if Storage is unavailable.

---

## v0.27.5 - 2026-06-18 - Full i18n: Google Calendar import + Custody week templates

**Localization fixes:**
- Google Calendar import section in Settings fully localized (heading, badges, labels, options, button) for EN/DE/PL
- Custody week templates section heading and "+ New template" button now use i18n keys
- `renderScheduleTemplates()` - "Every N weeks" and "Move week" button now localized
- `openScheduleTemplateDialog()` - all dialog strings (title, labels, options, buttons, toasts) now localized for EN/DE/PL

---

## v0.27.4 - 2026-06-18 - SEG-21: Guide loop fix + Settings panel redesign

**Bug fixes:**
- Fixed guide loop on mobile and in calendar/shopping modules: when the guide internally called `switchModule()` to navigate, the module-switch hooks were firing `G.show()` again and resetting the guide to step 0. Fixed by adding `isActive()` to GuideEngine and guarding all trigger points.
- Same fix applied to the `setup-children` trigger inside `renderSettingsFeature` (was overriding setup-parents mid-flow).

**UI improvements:**
- Settings panel renamed from "Help & Tours" to "Guides"
- Added subtitle text and "Documentation" link
- Each guide now shows a short description below its name
- "Run again" buttons replaced with standard `secondary-button` style

---

## v0.27.4 - 2026-06-18 - Expense split chips in card dialog

**Fix / rework:** "Add Expense" now opens the standard Do card dialog (full functionality: recurrence, reminder, assignee, comments, receipt upload, etc.) pre-set to type=Expense.
- Split chips added to the Payment panel side column: **50/50**, **Mine only** (no reimbursement), **Custom** (enter their exact share)
- Split panel appears immediately when type=Expense, even on new cards before saving
- Changing type to/from Expense in the dialog live-shows/hides the split chips
- On save, `payment_amount` is set automatically based on chosen split
- "Send payment request" button hidden when "Mine only" is selected
- i18n keys added for all 3 languages (EN/DE/PL): `expense.split_heading`, `expense.mine_only`, `expense.split_custom`
- Removed the earlier separate quick-expense dialog (was showing i18n key names instead of translated text)

---

## v0.27.3 - 2026-06-18 - Quick Add Expense dialog

**New feature:** Expenses section now has a dedicated quick-add expense dialog.
- Clicking "Add Expense" opens a lightweight card-style dialog (no need to navigate the full Do editor)
- Title + amount fields
- Split selector chips: **50/50** (default), **Mine only** (no reimbursement), **Custom** (enter exact co-parent share)
- Recurring toggle - pick Weekly / Every 2 weeks / Monthly
- Optional due date
- Saves directly as an Expense Do card with correct `payment_amount` so balance calculation reflects chosen split

---

## v0.27.2 - 2026-06-18 - SEG-21: Guide step targets corrected

**Fixes:**
- Schedule guide step 2 now spotlights the "Schedule" tab in the Calendar right panel (was incorrectly targeting the calendar grid)
- Vacation guide step 2 now spotlights the "Vacations" tab in the Calendar right panel (was targeting a non-existent `.mini-cal-picker` element)
- Calendar-connect guide scroll bug fixed: spotlight now positions AFTER `scrollIntoView` settles (was landing on wrong element because `block:"nearest"` didn't scroll and spotlight coords were wrong)
- All guide targets confirmed against live DOM - asked Bart for each navigating step

---

## v0.27.1 - 2026-06-18 - Secret access code

**New feature:** Settings > Access code panel. Enter a secret code to unlock full paid access for free. Stored in localStorage - persists across sessions. The code input also works with Enter key. Once activated, the panel shows a green confirmation and the subscription panel reflects paid status immediately.

---

## v0.27.0 - 2026-06-18 - SEG-21: In-app guide system (Pendo-like onboarding tours)

**New feature:** Step-by-step spotlight guides that walk new users through the app's key features. No external library - pure JS/CSS.

**7 guides built:**
- Welcome tour (auto-fires on first login, chains to setup-parents)
- Set up parents (names + invite co-parent)
- Set up children (first visit to Settings)
- Custody schedule & handovers (first visit to Calendar)
- Vacations (first time adding a vacation block)
- Calendar connection (first visit to calendar settings)
- Shopping list (first visit to Shopping)

**How it works:**
- Dark overlay with a spotlight cutout highlights the relevant UI element
- Floating tooltip shows title, body text, progress dots, Skip and Next/Done buttons
- Each guide fires once automatically; never re-fires unless reset
- Progress saved to localStorage
- Mobile: tooltip anchors to bottom of screen full-width
- All text translated in English, Polish and German

**Settings > Help & Tours:** new section lists all 7 guides with a "Run again" button each.

**Files changed:** `guide.js` (new), `i18n.js` (+50 translation keys), `index.html` (overlay elements + script tag), `styles.css` (guide CSS), `app.js` (welcome trigger post-login), `features.js` (module switch triggers + Settings panel), `plan/SEG-21-in-app-guides.md` (spec)

---

## v0.26.5 - 2026-06-18 - Fix: Export PDF and Download History no longer require sign-in

**Bug fix:** "Export PDF" (legal record) and "Download History" in Settings showed "Sign in required" even when the user was already signed in.

Root cause: `features.js` was calling `window.supabaseClient` which was never assigned - `app.js` created the Supabase client as a local `const` but did not expose it on `window`. The result was `undefined`, so the session check always failed.

Fixes:
- `app.js`: added `window.supabaseClient = supabaseClient` immediately after client creation so `features.js` and `supabase-data.js` can access it
- `features.js`: switched "Download my data", "Download legal record (PDF)", and `renderSharedHistoryPanel` to use `window.getAuthHeader()` - the same pattern used by `exportExpensesPdf` and all API calls in `app.js`

---

## v0.25.1 - 2026-06-17 - Calendar right panel: tabbed sections

The calendar's right panel now has four tabs replacing the old "Selected day" label. All schedule management is inline - no more separate dialogs.

- **Agenda tab** - unchanged day view: events, custody strip, week overview
- **Schedule tab** - full parenting schedule editor embedded directly in the panel. Includes the mini-calendar with color-coded days, owner chips (Mine / Co-parent / Split / Auto), split-day handover time, propagate controls, and Save/Request button. No dialog needed.
- **Changes tab** - all change requests in one place (local + Supabase SCR cards), grouped into Pending and Resolved. Approve, decline, and remove from here. Badge shows the count of active requests.
- **Vacations tab** - full vacation manager inline: existing vacation list, range-picker calendar, add/edit form with owner and alternating-week options. Badge shows vacation count.
- Schedule and vacation panel state persists across calendar re-renders so you do not lose work mid-edit
- After saving a vacation or schedule change in divorced mode, the app switches automatically to the Changes tab to confirm the request was sent
- The old "Parenting schedule" and "Vacations" buttons in the toolbar row are removed - replaced by the tabs
- The "Manage" link in the vacation banner (agenda tab) now switches to the Vacations tab instead of opening a dialog

**Docs updated:**
- `UX-AUDIT-feature-map-journeys.html` - Journey 8 steps rewritten to reflect tab-based flow; old friction items (no visible edit button, vacation UI not prominent) marked resolved
- `UX-AUDIT-user-flows.html` - Flows F24 (set up custody schedule) and F26 (add vacation) updated to describe inline panel instead of dialogs
- `do-do-user-guide.html` - Parenting schedule section rewritten to describe the 4-tab panel
- `UX-AUDIT-2026-06-13.md` - v0.25.1 audit notes appended
- `README.md` - version bumped to v0.25.1, feature table updated

---

## v0.24.1 - 2026-06-17 - Caregivers section in Settings

- Settings now has a unified "Caregivers" section replacing the separate "Your profile", "Co-parent", and "Caregivers" panels
- Both parents shown with their colored avatar, name, and inline color swatches - clicking a swatch updates the color immediately across the whole app
- "Edit schedule" button now lives in the Caregivers section
- Additional caregivers (grandma, nanny, etc.) listed below with existing add/edit/delete controls
- Co-parent invite/status panel embedded in the co-parent row

## v0.23.5 - 2026-06-17 - Parent icon colors follow schedule colors

- Parent A and parent B avatar icons (mini initials circles) now use the same colors the user picks for their custody schedule
- Calendar busy cards for each parent also update to match
- Previously the icons had hardcoded colors that never changed regardless of schedule color settings
- Technical: `.parent-a-mini`, `.parent-b-mini`, `.both-mini`, and `.calendar-busy-card.busy-parent-*` now use CSS variables `--custody-mine-color` and `--custody-co-color` set by `applyCustodyColors()`

---

## v0.23.0 - 2026-06-15 - SEG-11 Moat Features

### Legal export (11.1)
- "Legal record" and "Export my data" buttons now visible to ALL users in Settings, not just divorced mode
- PDF generation includes all cards with edit history, messages, and receipts

### Shared history view (11.2)
- Settings shows "Your shared record" panel after 30 days of activity with card count, expenses, and receipt count
- Milestone toasts at 10, 50, and 100 shared items

### Mediator dashboard (11.3)
- Mediator link generator in Settings - share with a mediator to get a bookmarkable stats page
- Mediator stats page at /mediator/[code] shows referred families, both-active count, avg days active (no login required)
- Referral code captured from ?ref=MED-xxx URL and stored on profile and pair

### Schedule cascade (11.4)
- Custody week templates in Settings with named recurring patterns
- Cascade update: shift a custody week and all linked cards move automatically
- "Just this week" or "all future" cascade options

### DB migration required
- Run seg11-moat.sql in Supabase SQL editor to add: edit_history, schedule_id, schedule_day_offset on unified_cards; referred_by on profiles; mediator_code on pairs

---

## v0.22.0 - 2026-06-15 - SEG-01 and SEG-02 QA complete

### SEG-01 - Security and Data Foundation (QA verified)
- RLS enabled and policies confirmed on all tables: unified_cards, families, profiles, pairs, shopping_items, children, pets, and all supporting tables
- Google OAuth token refresh fully wired: provider_refresh_token stored on sign-in, /api/refresh-token exchanges it silently on every subsequent load - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET confirmed in Vercel env vars
- Email verification enforcement active: email/password signups must click confirmation link before accessing the board; Google OAuth users unaffected; resend button works

### SEG-02 - Calendar Real Integration (QA verified, previously implemented)
- Token refresh wired into all Google Calendar calls via getValidGoogleToken() wrapper
- Co-parent busy slots fetched and rendered in their own color on the shared calendar
- Apple CalDAV integration via /api/apple-calendar.js - iCloud credentials stored in settings, busy blocks appear on calendar
- Recurring events with ↻ indicator on calendar (daily, weekly, biweekly, monthly, custody patterns)
- Conflict detection: overlapping events for same child or parent show orange warning dot on calendar and banner in card dialog

---

## v0.19.0 - 2026-06-14 - Schedule dialog UX - multi-day select, unified vacation calendar, simplified settings

### Multi-day selection in schedule calendar
- Tap any number of days to select them all at once - they highlight with the selection style.
- A counter below the calendar shows how many days are selected and hints "tap chip to set all".
- Mine / Co-parent / Split / Auto chips apply to every selected day in one tap.
- "Clear selection" button appears next to the day count when more than one day is selected.
- Clicking a previously selected day deselects it (toggle behaviour).
- Navigating to a different month clears the selection automatically.

### Schedule pattern moved to top
- Enabled toggle, schedule pattern (7-7 / 2-2-3 / 5-2 / Manual), reference start date, and colour swatches now appear above the calendar.
- This lets you set the base pattern first and then override individual days below it.

### Propagate saves before spreading
- The propagate buttons (This week - all weeks / Next 3 months / 6 months / Full year) now save the schedule first, then spread it.
- This prevents accidentally propagating unsaved changes.
- Toast message updated to "Saved and applied to next N months".

### Clear schedule button
- New "Clear entire schedule" button at the bottom of the dialog removes all custom day overrides.
- In divorced mode it sends a "clear schedule" change request to the co-parent for approval instead of applying immediately.
- The co-parent approves it in the same change-request card as any other schedule change.

### Vacation calendar unified with schedule calendar
- The vacation date-range picker now uses the same month calendar grid and CSS as the schedule dialog.
- Days are colour-coded with custody colours (mine / co-parent / split) even while picking vacation dates.
- Selected range: start and end dates get a solid accent outline; days in between get a dashed accent outline.
- A short hint below the calendar guides the user: "Tap the first day", "Now tap the end date", or shows the current range.

### Settings custody section simplified
- The custody settings panel now shows only the enabled toggle, divorced toggle, and the two "Edit schedule" / "Manage vacations" buttons.
- Pattern type, reference date, and colour swatches have been removed from settings - they live in the schedule popup.
- The enabled toggle still auto-saves immediately when flipped.

### Colour swatches labelled as personal
- My days colour and Co-parent days colour swatches in the schedule dialog are now labelled "(your view only)" to make clear they don't affect what the co-parent sees on their device.

---

## v0.18.0 - 2026-06-14 - Parenting schedule: full month calendar, handovers, divorced mode, vacation approvals

### Month calendar in schedule dialog
- The parenting schedule dialog now shows a full month calendar (not just a week strip).
- Every day is colour-coded using the existing custody CSS variables (mine / co-parent / split).
- Split days show a diagonal two-colour gradient and a ↔ indicator dot.
- Overridden days get a bold style; pending (not yet approved) days in divorced mode get a dashed amber outline.
- Navigate between months with prev / next arrows.
- Tap a day to select it; the day panel below shows who has the children that day.

### Day assignment
- After selecting a day, tap Mine / Co-parent / Split / Auto chips to set that day.
- Auto removes any override and reverts to the base schedule pattern.
- Selecting Split expands a handover panel with a time picker and a "Morning with" selector.

### Propagate schedule
- "This week - all weeks" applies the current week's pattern to every week across a 6-year window.
- "Next 3 months / 6 months / Full year" copies the current month's per-day overrides to the next N months (same day-of-month).

### Divorced / separated mode
- New "Separated / divorced" toggle in Settings > Parenting schedule.
- In divorced mode, changes to the schedule are not applied immediately - they become change requests.
- Changed days are marked with a dashed amber outline in the dialog ("pending" state).
- A "Proposed changes (N)" section lists all pending changes with a "Clear all" option.
- On save, a change request record is created per changed day and shown in the calendar as a Do card for the co-parent to approve or decline.
- All change requests are stored persistently for court or mediator reporting.

### Vacation change requests (divorced mode)
- In divorced mode, adding, editing, or removing a vacation period creates a change request instead of saving directly.
- The save button label changes to "Request vacation" / "Request update".
- The co-parent approves or declines via the same change-request card in the calendar.
- The approve handler supports vacation add / update / delete actions.

### Clear schedule with approval
- Change request type "schedule-clear" added.
- Approving it wipes all overrides from the schedule.

### Schedule and vacation accessible from both calendar and settings
- "Edit schedule" and "Manage vacations" buttons added to Settings > Parenting schedule.
- Both dialogs remain accessible from the calendar header as before.

### Colour swatches in schedule dialog
- My days and Co-parent days colour pickers moved into the schedule dialog.
- 6 palette options per parent. Changes live-preview in the calendar and save with the schedule.

---

## v0.15.5 - 2026-06-13 - Recurring cards now appear on all their days in the bottom calendar

### Bug fix: recurring cards not showing on repeat days
- Recurring cards (daily, weekly, bi-weekly, monthly, custom dates) now appear on every matching day in the bottom time grid - not just the original due date.
- Each instance shows a small ↻ badge in the corner so you know it's a recurring occurrence.
- Clicking or dragging any recurring instance opens/edits the original card (not a copy) - your data stays in one place.
- Fallback: if a weekly card has no days array saved, it repeats on the same day of week as the original due date.

---

## v0.15.4 - 2026-06-13 - Date+time row in card popup + mini-cal theme fix

### Date and time form in the full Do card popup
- A visible date + time row now appears in the card popup above the mini-calendar.
- Date field: type or pick a date directly - updates the mini-calendar selection immediately.
- Time field: pick any time in 15-minute steps - no need to open the full mini-cal.
- The X button clears both date and time at once.
- All three inputs stay in sync: clicking a date in the mini-calendar updates the row, and typing in the row updates the mini-calendar highlight.
- Changing the date via the row respects custody auto-assign (same as clicking the mini-cal).

### Mini-calendar now matches app color scheme
- Replaced all old CSS variables (`--card-bg`, `--text-primary`, `--text-secondary`, `--border-color`, `--bg-hover`) with the app's design-system tokens: `--surface-raised`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-weak`.
- Mini-calendar now looks correct in both light and dark mode - no more light-gray box in dark theme.
- Day-name column headers are now uppercase and slightly smaller (consistent with the bottom calendar).
- Today + Selected combination now gets a double-ring focus style so it's clear which day is both today and the selected due date.
- Prev/next month nav buttons get an accent background on hover.

---

## v0.15.3 - 2026-06-13 - System comments hidden from card thread

### System messages never shown in card thread or messages feed
- Reminder confirmations ("Reminder set for...", "Recurring reminder...") no longer appear in the card message thread.
- Button actions (Acknowledged, Please do it, Can't do this, I'll do it, Done, Paid) no longer appear in the card message thread.
- Same filter applies to the Messages page feed - only real, user-typed messages are shown.
- Filter works on both the `system: true` flag (new comments) and text pattern matching (existing data).
- `renderComments()` now uses a shared `isSystemComment()` helper to decide what to display.

---

## v0.15.2 - 2026-06-13 - Messages page + dark mode button fix

### Messages page - card message feed
- Replaced Slack-style topic channels with a feed of Do cards that have real messages in their thread.
- Cards sorted latest-first (most recently messaged at top).
- Each entry shows: card title, topic/type/child tags, last message preview with author, time, and total message count.
- Clicking a card opens its dialog directly to the message thread.
- System/button-generated messages are excluded: "Acknowledged", "Please do it", "Can't do this", "I'll do it", "Marked done", "Marked paid".
- Auto-generated comments now carry a `system: true` flag - excluded regardless of text content.
- No delete option on messages (non-destructive by design).

### Dark mode - card button styling
- Quick-response buttons (I'll do it, Please do it, Can't) are now transparent with border only in dark mode - no more filled grey chip background.
- Reminder and Message footer buttons use transparent background + border in both dark and light mode.

---

## v0.15.0 - 2026-06-13 - Time-grid calendar redesign

Full redesign of the bottom calendar component into an MS Teams-style time grid. This is the largest calendar change since the initial board view.

### Time grid layout
- Calendar now shows a full vertical hour grid from 6 AM to 10 PM (configurable in Settings).
- Each Do card is positioned at its exact time using absolute layout - cards at 9 AM appear at the 9 AM row, not just stacked in a day column.
- Hour lines (solid) and half-hour lines (faint) run across every day column.
- A red now-line with dot indicator shows the current time across all columns.
- Calendar auto-scrolls to the current time on load.
- Day header row is sticky - stays visible while scrolling through the time grid.

### Hour-snap drag and drop
- Dragging a card between day columns snaps the time to the nearest full hour at drop position.
- Reminders recalculate automatically on every drag: preset reminders (e.g. "1 hour before") recalculate from the new due time; custom reminder offsets shift by the same delta as the card.
- External calendars (Google, Apple, Microsoft) sync on every successful drag - same as manually editing the due date.
- Drag handle (dots icon) in the card corner initiates the drag; card action buttons still work normally.

### Kanban to calendar drag
- Board (kanban) cards can be dragged directly into the calendar time grid.
- The card stays on the board - it does not disappear. The calendar entry is added alongside the existing board card.
- Dropping on a day+time sets the card's due date to that slot.

### Mini-cal time picker
- The date popup (mini-calendar) now has a time field below the date grid.
- Changing the time immediately updates the card's due time without re-opening the full card dialog.
- Time defaults to the existing value when editing, or 12:00 for new cards.

### Calendar hours - Settings
- New "Calendar hours" section in Settings.
- Choose start hour (4 AM - 4 PM range) and end hour (4 PM - midnight range).
- Changes apply to the calendar immediately; hour grid adjusts to the selected window.

### Bug fix - "I'll do it" cards disappearing from calendar
- Cards marked "I'll do it" (accepted but not Done) were disappearing from the calendar view because the calendar was using the board's active filter. Fixed - the calendar now reads directly from all cards with a due date, ignoring board filters.

### Mobile - 2-day view
- On screens narrower than 640px the calendar defaults to a 2-day view (today + tomorrow).
- The 2-day window always starts on today; prev/next navigation shifts by 2 days.
- The time grid scrolls horizontally if needed to fit both columns.

---

## v0.11.2 - 2026-06-12 - Smart notification routing + app-only reminders

### 19.1 Smart notification routing
- `remind.js` now sends reminders only to the assigned person - Parent A gets Parent A's cards, Parent B gets Parent B's
- "Both parents" or no assignee sends to both (previous behaviour preserved)
- Added `assignee` to cards query and `role` to profiles query in remind.js
- Quiet hours still respected per recipient
- Fixes notification spam that caused users to turn off all alerts

### Reminder delivery: new "App only" option
- Settings > Automation now has 3 delivery choices: **App only**, **Family calendar only**, **Calendar + Do-Do**
- "App only" - Do-Do sends push/email alerts; Google Calendar not involved
- "Family calendar only" - GCal event alert handles delivery; no in-app reminder
- "Calendar + Do-Do" - both (unchanged from before)
- Updated hint text and all 3 languages (EN, DE, PL)

---

## v0.11.1 - 2026-06-12 - Google Calendar import

### Import any Google Calendar as Do-Do cards
- New **Import from Google Calendar** panel in Settings (under Calendar connections).
- Pick any calendar from your Google account - your personal calendar, a family calendar, a school calendar, anything you have access to.
- Choose how many days ahead to import (7 to 365, default 30).
- Two sync modes:
  - **Import only** - events are pulled in as read-only cards. Great for a family or school calendar you just want to see on the board.
  - **Two-way sync** - editing a card (title, notes, date) also updates the original Google Calendar event.
- Imported cards appear on the board mixed with your regular cards. They show a teal globe badge with the calendar name so you can tell them apart at a glance.
- Auto-syncs silently on every app load if a calendar is configured - no manual refresh needed.
- No new API endpoints needed - all Google calls go through the existing OAuth token infrastructure.

### Onboarding
- New "Import from Google Calendar" toggle in the onboarding Calendar step.
- If turned on, a prompt after setup sends you straight to Settings to pick which calendar.

---

## v0.9.7 - 2026-06-11 - Shopping UX polish + PWA improvements

### Instant uncheck visual feedback
- Unchecking a shopping item now removes the strikethrough and muted style immediately, without waiting for the Supabase round-trip to complete.
- Applied to both Supabase-backed items and custom list items.

### Disable mobile zoom
- `user-scalable=no, maximum-scale=1.0` added to viewport meta in `index.html` - prevents Safari from zooming in on form fields.
- CSS fallback via `@supports (-webkit-touch-callout: none)` ensures input font size is at least 16px (the threshold below which iOS auto-zooms).

### Remember last visited module
- Do-Do now remembers which module was open when the app is killed and restarted as a PWA on iOS.
- Uses both hash routing (for in-session back/forward) and `localStorage("do-do-last-module")` (for cold restarts).
- On auth resolve, hash takes priority over localStorage; both fall back to the default module.

### Paste multi-line text as multiple shopping items
- Pasting text containing line breaks into the shopping input adds each line as a separate item.
- Works for both Supabase-backed lists and custom localStorage lists.
- Shows a toast: "N items added" after the batch insert.

---

## v0.9.3-v0.9.6 - 2026-06-11 - Shopping add form: single pill layout

### Shopping capture form redesigned
- Mic button, text input, and + button are now fused into a single pill: `[ mic  type here... + ]`
- All three elements live inside one `.shopping-input-wrap` flex container with `border-radius: 999px`.
- Input height is driven by its own `padding: 9px 8px` (not inherited height) - required for Safari compatibility.
- Dark mode pill background uses `rgba(244, 247, 246, 0.075)`.

### i18n fix - "Add new list" button
- "Add new list" button was showing the raw translation key `shopping.add_list` instead of the translated label.
- Fixed by adding the key to all three language dictionaries (EN, DE, PL) in `i18n.js`.
- Same fix applied to the new-list prompt dialog title (`shopping.new_list_prompt`).

---

## v0.9.1-v0.9.2 - 2026-06-10 - SEG-16: Vacation schedule + calendar change requests

### Vacation schedule (v0.9.1)
- New **Vacation** override type in the custody calendar. Vacation days show a ✈ indicator in the month grid.
- Vacations dialog: add/remove vacation periods per parent without destroying the underlying custody schedule.
- Vacation periods stored as date ranges inside `custody-schedule-v1` localStorage under `vacations[]`.

### Calendar change requests (v0.9.2)
- Co-parent can request a custody day swap: **Change** chip appears on overridden days.
- Change request dialog: describe the swap, set proposed date, submit.
- Other parent sees pending request chip; can **Approve**, **Decline**, or **Delete**.
- Requests stored in Supabase `custody_change_requests` table (or localStorage fallback).

---

## v0.8.0 - 2026-06-10 - SEG-14: Security hardening (Critical + High audit fixes)

Implements the Critical/High findings from CODE-AUDIT-2026-06-10.md.

### Authentication on service-role endpoints (C1)

- **New `api/_auth.js`** shared `requireUser()` helper - verifies the Supabase JWT from the `Authorization` header. Underscore prefix means Vercel does not deploy it as a function (count stays at 12).
- **`/api/stripe-checkout`** (create + expense + portal): requires a signed-in user. `userId`/`pairId` are derived server-side from the verified token, never from the request body. Expense payment requests are rejected (403) if the card does not belong to the caller's pair.
- **`/api/stripe-portal` removed** - merged into `/api/stripe-checkout` as `action: "portal"` to free a function slot for `guest-view.js` (Hobby 12-function limit unchanged).
- **`/api/push-subscribe`**: requires auth; `user_id` from token; DELETE scoped to the caller's own subscriptions.
- **`/api/apple-calendar`**: requires a signed-in user (no longer an open CalDAV proxy).
- Client: new `getAuthHeader()` helper in `app.js`; all callers send the JWT.

### Stripe webhook fails closed (C2)

- `/api/stripe-webhook` now rejects all events if `STRIPE_WEBHOOK_SECRET` is unset. Unsigned payloads are never parsed.

### Stored XSS fixes + security headers (C3)

- `escapeHtml()` applied to message bodies and sender names (`renderRealMessage`), expense card title/details, and the universal card fallback renderer in `features.js`.
- Payment-request and invite emails escape user-supplied names/titles.
- `vercel.json`: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Strict-Transport-Security, Permissions-Policy on all routes.

### AI + email relay locked down (H1)

- `/api/ai`: requires auth, 2000-char input cap, CORS removed (same-origin only).
- `/api/invite-email`: requires auth (closes open mail relay); `inviteLink` must match our own `/invite/<token>` URL shape; sender name escaped and length-capped.
- CORS `*` removed across all API functions.

### Siri parked (H3/H4)

- Siri Settings section hidden; `/api/siri-*` endpoints remain undeployed. The shortcut wrote to a legacy `cards` table and used a non-revocable HMAC token - will be redone properly with SEG-12 (iOS wrapper).

### iCloud credentials (H2, partial)

- Apple Calendar credentials moved from localStorage to sessionStorage (cleared when the browser closes), with one-time migration. Server-side encrypted storage tracked for a later segment.

### Also ships (previously local-only)

- v0.7.0 guest preview (`/api/guest-view`), `prywatnosc.html`, custody calendar, cookie banner fix, and v0.7.1 card dialog buttons now reach production in this push.

---

## v0.7.0 - 2026-06-09 - SEG-13: Guest preview + plain-Polish privacy page (GTM risk mitigation)

Mitigates GTM-Poland risks #1 (two-sided activation) and #4 (trust in sensitive data).

### Read-only guest preview (no account)

- **"Preview without an account"** button on the invite screen. The second parent can see the real shared board read-only before deciding to join - no signup, no password, no Supabase session. Neutral, no-pressure copy: "Nothing is shared back until you decide to join."
- **New API `/api/guest-view.js`** - GET with invite token. Validates token (must exist, not yet accepted), returns sanitized snapshot only: inviter name, children names, up to 50 recent cards with limited fields (title, type, status, child, due date, amount). Card bodies, messages, receipts, metadata, and row IDs are never exposed. `Cache-Control: no-store`.
- **Guest preview screen** - read-only banner, child-centric hero ("Shared board for Ava"), card list reusing app styling, "Join the board" CTA back to invite, privacy line linking /prywatnosc.
- **i18n** - all guest strings added in en / de / pl (`invite.preview_*`, `guest.*`).

### Plain-Polish privacy page

- **New page `prywatnosc.html`** (served at `/prywatnosc` via cleanUrls). Plain Polish, no legalese. Answers a sceptical co-parent's actual questions: what the other parent sees, tamper-proof history, EU servers + RODO, who never sees the data (no ads, no sale), export/delete rights, court-friendly exports. Linked from guest preview and legal.html nav.

### Fixes

- **package.json dependencies** - api routes required `@supabase/supabase-js`, `stripe`, and `resend` but none were declared (only `vercel`). Added all three so serverless functions resolve on deploy.
- **Plan doc** - `plan/SEG-13-risk-mitigation.md` added.

---

## v0.6.7 - 2026-06-09 - Custody calendar: schedule dialog, day overrides, desktop view

### Parenting schedule dialog
- "Parenting schedule" / "Set up parenting schedule" button added to the calendar header - opens a `<dialog>` (same modal pattern as card editing) with all schedule settings in one place
- Dialog fields: enable/disable toggle, schedule type selector, reference start date, colour pickers for each parent (6 palette options each), live colour preview
- Accessible from the calendar at any time without going into Settings

### Per-day overrides with handover time
- Agenda panel now shows a **custody strip** for the selected day: who has the kids, colour dot, and three action chips - **Mine / [Co-parent name] / Split**
- Clicking Mine or Co-parent overrides that specific day immediately, stored as an exception on top of the base schedule
- Clicking **Split** expands an inline time picker - enter the handover time (e.g. 15:00) and confirm; the day shows a diagonal two-colour gradient in the month grid and "Handover HH:MM" label in the agenda
- An **overridden** badge appears on days that differ from the base schedule; a **Reset** chip reverts to the automatic schedule
- Override storage uses an `overrides` map inside `custody-schedule-v1` localStorage key, keyed by `YYYY-MM-DD`

### Week overview strip (agenda panel)
- 7-tile week strip in the agenda panel shows the whole selected week at a glance: custody colour bar, weekday label, day number, event count badge
- Click any tile to jump to that day without navigating the month grid

### Desktop calendar improvements
- Day cells are taller (60px min-height, was 48px) and slightly less rounded on desktop
- Cell gap tightened to 6px for a denser grid

### Palette-matched custody colours
- My days: teal tint `rgba(101, 214, 198, 0.2)` - matches the app accent, event dots, privacy note
- Co-parent days: warm slate `rgba(118, 128, 138, 0.14)` - matches the muted/busy colour used for work calendar blocks
- Split days render as a diagonal gradient of both colours in the month grid

---

## v0.6.6 - 2026-06-09 - Bug fixes: cookie banner, card dialog buttons, custody calendar foundation

### Cookie banner - two bugs fixed
- **"Got it" not closing the banner** - root cause: `.cookie-banner { display: flex }` in CSS overrides the `[hidden]` HTML attribute (author styles beat browser UA defaults). Fixed with `.cookie-banner[hidden] { display: none !important; }`.
- **Unreadable in dark mode** - banner used `background: var(--ink)` which flips to near-white in dark mode while text was hardcoded white. Fixed with a hardcoded `#171918` background that stays dark in all themes.

### Card dialog buttons
- `.card-dialog .primary-button` now uses `#171918`/white - matches the black Complete button on board cards, not teal
- `.card-dialog .secondary-button` uses transparent/wireframe style matching board card ghost buttons
- Dark mode: primary inverts to `var(--ink)` on dark surface
- Applies to `card-dialog` and `reminder-dialog`

### Custody / parenting schedule (foundation)
- New **Parenting schedule** section in Settings: enable toggle, schedule type (7-7, 2-2-3, 5-2), reference start date, colour pickers per parent
- Calendar month and week views tint each day cell based on the active schedule
- Month view shows a My days / Co-parent days legend above the grid when enabled
- `getCustodyOwner()`, `getCustodyClass()`, `getCustodySchedule()`, `saveCustodySchedule()`, `applyCustodyColors()` helpers added to `features.js`
- Colours set as CSS custom properties (`--custody-mine-bg`, `--custody-co-bg`, etc.) driven by saved schedule

---

## v0.6.3 - 2026-06-08 - i18n: English, German, Polish + visible version in Settings

### Internationalisation (i18n)

**New file: `i18n.js`** - standalone translation engine loaded before all other scripts.
- `window.t(key, { param: value })` - translates a key with `{{var}}` interpolation, falls back English -> key
- `window.setLanguage('en'|'de'|'pl')` - switches language, saves to `localStorage('do-do-lang')`, updates DOM, re-renders current module
- `window.getCurrentLang()` / `getSupportedLangs()` exposed globally
- Auto-detection: `localStorage` saved preference -> `navigator.language` -> default `en`
- Immediately sets `document.documentElement.lang` on load (before any JS runs)

**~200 translated keys** across EN / DE / PL covering:
- Navigation: all 6 module labels (mobile tab bar + desktop sidebar)
- Board: column headers (To decide / Mine / Done), Archived label
- Card dialog: details placeholder, message placeholder, Reminder/Payment/Receipt headings, reminder preset options, Save / Cancel / Delete / Done / Got it / I'll do it / Please do it / Can't
- Shopping: group titles, "N left", add placeholder, Clear bought, all action toasts
- Expenses: all summary rows, balance (they owe / you owe / settled up), action buttons, payment panel split options, Open payment link
- Messages: heading, loading state, send button, input placeholder
- Settings: all section headers, account buttons, co-parent panel copy/resend, theme options, language selector options
- Key toasts: joined, signed out, marked done/paid, payment sent/created, receipt uploaded, name updated, language changed

**`index.html` changes:**
- `<script src="i18n.js">` loaded first
- `data-i18n` spans on mobile tab labels
- `data-i18n` on desktop nav buttons
- `data-i18n` + `data-i18n-attr="placeholder"` on details and message inputs
- `data-i18n` on Reminder/Payment/Receipt section headings, all reminder preset options, Save/Cancel/Delete/Done/I'll do it/Please do it/Can't/Got it

**`features.js` changes:**
- Shopping group titles, items-left count, add placeholder, clear-bought button all use `t()`
- Expense module: all headings, summary labels, balance, action buttons use `t()`
- Messages: heading, loading, send button, placeholder use `t()`
- Settings: all section headers, account buttons, co-parent panel, theme labels use `t()`
- Language selector added to Appearance section - onChange calls `window.setLanguage()`

**`app.js` changes:**
- `getKanbanColumns()` function - board column labels computed via `t()` on every render
- Board archived label uses `t('board.archived')`
- Card dialog title/mode label uses `t('board.new_do')` / `t('card.info_thread')`
- Done/Paid/Completed button text uses `t('card.done_btn')` etc.
- Payment panel split options, send button, awaiting chip use `t('pay.*')` / `t('expense.*')`
- Key toasts: joined, signed out, marked done/paid, payment sent/created, receipt uploaded use `t('toast.*')`

### Versioning - visible in Settings

- `APP_VERSION` bumped to **v0.6.2** (was 0.4.0 since June 4), `APP_VERSION_DATE` updated to 2026-06-08
- Version display in Settings replaced with a prominent panel: app name + dark pill badge with version number + date - always readable at a glance
- **Rule added to `AGENTS.md` and `CLAUDE.md`:** `APP_VERSION` and `APP_VERSION_DATE` in `app.js` must be bumped on every push, no exceptions

---

## v0.6.2 - 2026-06-08 - SEG-09: Legal, Privacy & GDPR

### Account deletion (9.1)
- **New `api/delete-account.js`** - server-side GDPR account deletion. Requires `Authorization: Bearer <jwt>`. Steps: anonymises cards (author -> "Deleted user"), soft-deletes messages, removes user from pair, deletes profile, emails co-parent notification, then deletes Supabase Auth user. Pair and co-parent data are preserved.
- **Settings → Account → Delete account** - three-step confirmation: confirm dialog, second confirm, type "DELETE". Calls the API and signs out on success.

### Data export (9.2)
- **New `api/export-data.js`** - GDPR data portability. Returns a JSON file download containing profile, all cards (with comments), messages, shopping items, and children. Authenticated via Bearer token.
- **Settings → Account → Download my data** - fetches the export and triggers a browser download.

### Privacy policy & terms (9.3)
- **`legal.html`** - all placeholders replaced with real content:
  - Operator: Bart Gumowski, Switzerland
  - Processor list: Supabase (EU-West-1 Ireland), Vercel, Anthropic, Stripe, Resend
  - Data residency: primary storage in EU (Ireland)
  - Retention & deletion: 30-day anonymisation, export link, backup window
  - Swiss DSG / GDPR section with FDPIC complaint rights
  - Contact: hello@do-do.app
- **Settings → Account** - "Privacy & Terms" link added.

### Cookie consent banner (9.4)
- One-time banner shown to new visitors: "We use cookies only for authentication - no tracking, no ads."
- Stored in `localStorage('cookie-consent-v1')`. Appears 1.5s after load, above the tab bar on mobile. `#cookieBanner` in index.html, `initCookieBanner()` in app.js, CSS in styles.css.

### Data residency (9.5)
- Documented in Privacy Notice: Supabase EU-West-1 (Ireland). No action required (Supabase project was already in EU region).

---

## v0.6.1 - 2026-06-08 - SEG-07 + SEG-08: Real-time sync + Onboarding polish

### SEG-07: Real-time sync

**Shopping list (7.1)**
- Already wired to Supabase (`loadShoppingItems`, `addShoppingItem`, `toggleShoppingItem`, `subscribeToShopping` all live).
- Added **delete button** (×) per shopping item - appears on hover, calls `deleteShoppingItem` for Supabase items or removes from localStorage for offline items.
- Added **Clear bought (N)** button per group - removes all checked items in one tap.
- New CSS: `.shopping-row-wrap`, `.shopping-delete-btn`, `.shopping-clear-btn`, `.shopping-group-header-actions`.

**Messages (7.2)** - already live via `messages_v2` table queries. `seg07-realtime-sync.sql` adds the table definition + RLS policies.

**Presence indicators (7.3)** - already live: `broadcastCardPresence` in supabase-data.js, `onPresenceSync` in app.js, `#presenceIndicator` in card dialog header.

**Background sync (7.4)** - already live: `sync-cards` service worker event, `_flushSyncQueue` in app.js.

**New SQL: `seg07-realtime-sync.sql`**
- `shopping_items` table + RLS (idempotent, also in supabase-shopping.sql).
- `messages_v2` table + RLS + `my_pair_id()` helper function.
- Enables Realtime on both tables via `supabase_realtime` publication.

### SEG-08: Co-parent onboarding polish

**Invite landing page (8.1)**
- Invite screen now shows children names: "Bart invited you to coordinate for Ava and Leo."
- `lookupInviteToken` in supabase-data.js extended to join `children` table and return `childrenNames[]`.

**Invite status in Settings (8.2)** - already live via `renderInvitePanel()` (shows joined/pending, copy link, re-send email).
- **Invite link recovery**: `renderInvitePanel` now fetches `invite_token` from Supabase if sessionStorage is empty (survives page reloads).

**Family member management (8.3)**
- New **Your profile** section in Settings with editable display name - calls `updateProfile(displayName)` to update Supabase `profiles` table + localStorage.
- Co-parent local name editing added.
- `promptEditChild` and `confirmDeleteChild` now also call `saveChildrenToSupabase` so edits sync across devices.
- New `updateProfile(displayName)` function in supabase-data.js, exported as `window.updateProfile`.

### Manual steps required
1. Run `seg07-realtime-sync.sql` in Supabase SQL editor to create `shopping_items` and `messages_v2` tables.

---

## v0.6.0 - 2026-06-08 - SEG-06: Expense Payment Flow

### Payment requests (6.1)
- **New API `/api/stripe-expense-payment.js`** - creates a Stripe PaymentIntent for a shared expense. Input: `{ cardId, amount, currency, description, requestedByName }`. Returns `{ paymentUrl, intentId, emailSent }`.
- **Payment panel in card dialog** - shown for any Expense card with an amount set. Displays a request form (amount pre-filled to 50%, adjustable split select: 50/50, 60/40, 100% them, I'll cover it). After sending, shows "awaiting payment" chip and a direct payment link.
- **Email notification** - co-parent receives a branded email with a "Pay CHF X" button. Falls back gracefully if `RESEND_API_KEY` is not configured.
- **Card state update** - `payment_status`, `payment_amount`, and `payment_intent_id` written to Supabase immediately on request creation.

### Apple Pay / Google Pay payment page (6.2)
- **New API `/api/expense-pay.js`** - serves a self-contained HTML payment page using Stripe Payment Element (Apple Pay, Google Pay, card fallback). No app login required.
- **Route `/pay/:intentId`** added to `vercel.json` rewrites, mapping to `/api/expense-pay?intent=:intentId`.
- Shows success page if already paid; error page for invalid/expired links.

### Webhook - auto-mark paid (6.2)
- **`payment_intent.succeeded`** event added to `api/stripe-webhook.js`. Sets `payment_status = paid` and `payment_paid_at` on the card in Supabase when Stripe confirms payment.
- New event must be added to the Stripe webhook endpoint config (see manual steps below).

### Receipt upload (6.3)
- **Receipt panel in card dialog** - shown for all Expense cards. Camera/file upload button uploads to Supabase Storage bucket `receipts`.
- Path convention: `{familyId}/{cardId}/receipt.{ext}` with upsert - replacing a receipt overwrites the old one.
- Image receipts show as a thumbnail preview in the dialog. PDF/other files show as a link.
- `receipt_url` column stored on `unified_cards` and synced to Supabase on upload.

### Balance summary (6.4)
- **Running balance row** added to the Expenses summary panel: "They owe you CHF X", "You owe CHF X", or "Settled up".
- `computeBalance()` in `features.js` - sums unsettled expense cards using `payment_amount` (actual requested share) when available, otherwise half the card amount.

### Data layer
- **`supabase-data.js`** - `cardToDbRow` and `dbRowToCard` now include `payment_intent_id`, `payment_status`, `payment_amount`, `payment_paid_at`, `receipt_url`.
- **Expense card list** - updated `renderExpenseCard()` to show payment status pill (Paid / Awaiting payment), receipt chip, and "Request payment" button replacing "Mark paid" for unpaid cards with an amount.

### DB migration required
Run `seg06-expense-payments.sql` in Supabase SQL editor:
```sql
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none'
  CHECK (payment_status IN ('none', 'pending', 'paid', 'disputed'));
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2);
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_paid_by UUID REFERENCES auth.users(id);
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ;
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS receipt_url TEXT;
```

### Manual steps required
1. Run `seg06-expense-payments.sql` in Supabase SQL editor
2. Create `receipts` storage bucket in Supabase (or let the SQL do it)
3. Add `payment_intent.succeeded` to the Stripe webhook endpoint at `https://do-do.app/api/stripe-webhook`
4. Optional: set `APP_BASE_URL=https://do-do.app` in Vercel env vars (used for payment link generation; falls back to `VERCEL_URL`)

---

## v0.5.0 - 2026-06-05 - SEG-05: Payments and Subscription

### Stripe integration
- **3 new API functions**: `/api/stripe-create-checkout.js` (Checkout session), `/api/stripe-webhook.js` (event handler), `/api/stripe-portal.js` (Customer Portal).
- **Webhook events handled**: `checkout.session.completed` -> active/trialing, `customer.subscription.updated` -> status sync, `customer.subscription.deleted` -> canceled, `invoice.payment_failed` -> past_due.
- **14-day free trial** added to checkout sessions automatically.
- **Apple Pay / Google Pay** available automatically via Stripe Checkout hosted page.

### Subscription state
- `pairs` table columns `subscription_status` and `subscription_period_end` read on login via `loadSubscriptionStatus()` in supabase-data.js.
- `subscriptionLoaded` custom event syncs status into `state.subscriptionStatus` in app.js.

### Paywall and feature gating
- **Free plan**: 10-card limit (non-Done cards). Upgrade prompt shown on 11th create attempt, in both card dialog and inline capture.
- **isPaidUser()** helper: returns true for `active` and `trialing` statuses.
- **AI interpret** (`/api/interpret`) gated - free users see upgrade prompt instead.
- **Calendar sync toggle** gated - checking the toggle when free reverts it and shows upgrade prompt.

### Upgrade prompt
- `showUpgradePrompt(reason)` creates a `<dialog>` dynamically with feature list, pricing (CHF 9.90/mo, CHF 89/yr), and "Start free trial" CTA.
- CTA calls `/api/stripe-create-checkout` and redirects to Stripe Checkout.

### Subscription panel in Settings
- New "Subscription" section renders above "Account".
- Paid users: shows current plan, renewal date, "Manage" button -> Stripe Customer Portal.
- Free users: shows Dos used (n/10), feature pitch, and "Upgrade" CTA.

### Env vars required

| Variable | Where | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Vercel | Server-side Stripe API calls |
| `STRIPE_PUBLISHABLE_KEY` | (future) | Client-side Stripe.js if needed |
| `STRIPE_WEBHOOK_SECRET` | Vercel | Webhook signature verification |
| `STRIPE_MONTHLY_PRICE_ID` | index.html | Monthly price ID (price_...) |
| `STRIPE_ANNUAL_PRICE_ID` | index.html | Annual price ID (price_...) |

### Supabase migration required
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.pairs ADD COLUMN IF NOT EXISTS subscription_status TEXT
  DEFAULT 'free' CHECK (subscription_status IN ('free', 'trialing', 'active', 'past_due', 'canceled'));
ALTER TABLE public.pairs ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;
```

---

## v0.4.1 - 2026-06-04 - Vaccine cards, bug fixes, versioning

### Vaccine cards
- **Real vaccine cards** - "Vaccine" added as a card type. Vaccine cards appear on the board with a 💉 badge and teal color chip.
- **Live vaccine panel in Settings** - replaces hardcoded demo. Shows all active vaccine cards sorted by due date. "Add vaccine" button opens the card dialog prefilled with type=Vaccine, topic=Medical.
- **Click to open** - any row in the vaccine panel opens the card dialog for that card.

### Bug fixes
- **GCal/Apple delete on card removal** - `deleteCurrentCard` now calls `deleteCardFromFamilyCalendar` / `deleteCardFromAppleCalendar` when the card has a linked event id.
- **Reminder panel always visible** - removed logic that hid the reminder panel when Google Calendar sync was on. Manual reminders now stay accessible in all cases.
- **Duplicate cards on autosave fixed** - `saveCard` now writes the generated id back to `cardId.value` immediately so repeated autosaves and the manual Save button all update the same card instead of creating duplicates.
- **Dark pill background on board cards removed** - features demo CSS (`.card-state-row span { background }`) was leaking onto board cards. Scoped out with `.unified-card .card-state-row span { background: transparent }`.

### Versioning
- **`APP_VERSION` constant** in `app.js` (currently `0.4.0`). Bump this with every push.
- **Version badge in sidebar** (desktop) and **bottom of Settings** (mobile). Shows version number and date.

---

## v0.4.0 - 2026-06-04 - SEG-04 Notifications

### Cron reminders (4.1)
- `vercel.json` cron: `/api/remind` fires every 15 minutes (requires Vercel Pro).

### Web push (4.2)
- `api/push-subscribe.js` - new endpoint to save/remove VAPID push subscriptions in Supabase.
- `api/remind.js` - sends web push via `web-push` lib alongside email. Respects `notification_prefs` and quiet hours.
- VAPID keys generated and set in Vercel env vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).

### Notification permission UI (4.3)
- Contextual "Enable notifications" prompt shown once 3s after login (stored in localStorage `notif-asked`).
- `subscribeToPush()` / `unsubscribeFromPush()` in `app.js`. Returning users with permission granted re-subscribe silently.

### Notification preferences (4.4)
- Settings panel: email/push toggles, quiet hours from/to, "Send test push" button.
- `profiles.notification_prefs` JSONB column + `profiles.timezone` - see `seg04-notifications.sql`.
- `push_subscriptions` table with RLS - see `seg04-notifications.sql`.

---

## 2026-06-04 - Session: SEG-03 - AI field extraction, NLP reminders, conflict suggestions

### AI replaces regex in card form (SEG-03)
- **AI wired into card form** - `deriveFieldsFromShortInfo()` now schedules a Claude Haiku call 800ms after typing stops. Regex still fires instantly as a preview; AI result overrides all fields when it arrives.
- **Full field extraction** - AI returns title, topic, type, status, due date, amount, assignee, child, details, reminderMinutes, reminderAbsolute, and recurrence. All applied directly to the card dialog fields.
- **NLP reminder extraction** - `/api/interpret` now detects "night before" (720min), "morning of" (480min), "30 minutes before" (30min), "remind me at 9am Thursday" (absolute time). Applied to reminder panel automatically.
- **Recurring event detection** - AI detects "every Friday", "alternate weekends", "every Tuesday and Thursday" and populates the recurrence picker (freq + day checkboxes).
- **Conflict AI suggestion** - new `/api/suggest-resolution.js` endpoint. When two cards conflict, calls Claude Haiku for a specific one-sentence resolution ("Move the dentist to Thursday - Leo has football Tuesday at 16:00"). Shown in the conflict banner, fetched async, cached per conflict pair.

### Bug fixes
- **Autosave no longer closes dialog** - `saveCardSilent()` uses a `_silent` flag so autosave persists without closing the card.
- **Reminder preset from card text applied on save** - `saveCard()` reads from the reminder panel fields (set by AI or user) instead of always using the global default. GCal event alert gets the card-specific preset.
- **Open existing card overrides stored reminder** - `openCardDialog()` runs `inferReminderFromText()` on title+details; if a reminder is mentioned in the text it overrides the stored preset so re-saving corrects the GCal alert.

---

## 2026-06-03 - Session: Parent names, NLP reminders, card dialog overhaul

### Parent names and tagging
- **Real names everywhere** - `getMyName()` helper reads from onboarding/auth and replaces all hardcoded "Parent A" strings in comment authors, acknowledgements, reminders, and activity entries.
- **Comment display** - stored "Parent A"/"Parent B" in comment author field now shown as real names via `displayPersonName()`.
- **Auto-tagging from text** - `peopleForCard()` scans title, details, and all comments for parent name mentions; matching parents show as people icons automatically without needing an explicit assignee field.
- **Tagging from comments** - sending a message that mentions a parent name sets them as assignee and refreshes people icons live.
- **"for me" detection** - phrases like "for me", "I'll do it" in text auto-assign the current user.
- **Avatar initials fixed** - `personInitial` and `personClass` now use real name initials (B/A from Bart/Art) instead of broken `.includes("B")` check.

### NLP reminder extraction
- **Text-to-reminder** - typing "remind me 2 hours before", "reminder at 3pm", "alert 30 minutes before", "1 day before" etc. in the card text auto-sets the reminder preset and time field.
- **2 hours before** option added to all reminder dropdowns (onboarding, card dialog, settings, reminder dialog).

### Card dialog overhaul
- **Unified New Do popup** - both `+` button and Calendar "Add Do" open the same direct edit form. LLM two-step removed entirely. Calendar pre-fills the selected date.
- **Custom reminder** - datetime-local input only appears when "Custom time" is selected in the reminder dropdown.
- **Autosave** - 1.5s debounce fires on any field change while the dialog is open.
- **Button layout** - Save is primary on the right. Cancel + Delete are secondary on the left. Delete hidden for new cards.
- **Last edited** - cards store `lastEditedAt` and `lastEditedBy` on every save; shown in the dialog meta bar next to "Added on".
- **Assignee from explicit mention only** - auto-derive no longer defaults to Parent A; only sets assignee when a name is explicitly mentioned in the text.

### Calendar
- **Parent color on busy blocks** - work/personal calendar busy blocks render in the parent's color (dark for Parent A, amber for Parent B).
- **Cards clickable from calendar** - day/agenda view cards open the card dialog via `data-card-id`.

### URL routing
- **Hash-based routes** - every module navigation updates the URL hash. Back/forward works. Deep-linking supported.
- Routes: `/#board` `/#calendar` `/#messages` `/#shopping` `/#expenses` `/#settings`

### Repo / deployment
- **Repo made private** on GitHub.
- **Token removed from history** - `Git token.md.rtf` stripped from commit and added to `.gitignore`.
- **`.gitignore`** updated to exclude token files.

---

## 2026-06-03 - Session: Calendar, New Do dialog, URL routing

### Calendar

- **Parent color on busy blocks** - work/personal calendar busy blocks now render in the parent's color (dark for Parent A, amber for Parent B) instead of generic grey. GCal events with a `person` field and private work blocks both use the correct color.
- **No-person fallback** - busy blocks with no attributed parent show plain grey to avoid misleading attribution.
- **Cards clickable from calendar** - `window.bindUnifiedCardInteractions` already called on the calendar container; `data-card-id` elements in the day/agenda view open the card dialog correctly.

### New Do dialog

- **Removed duplicate form** - the dialog was showing two text inputs simultaneously for new Dos: the LLM "What happened?" textarea (with Preview Do) and the direct "What needs to be done?" textarea. Root cause: `.llm-new-card-mode .dialog-info-column > .card-info-section` used a direct-child selector that didn't match the actual DOM depth (`.card-info-section` is inside `.dialog-two-col > .dialog-main-col`). Fixed to a descendant selector and hidden `.dialog-two-col` entirely in new-card mode.

### URL routing

- **Hash-based routes** - every module navigation updates the URL hash. Back/forward works. Deep-linking supported: a URL with a valid hash loads directly into that view on open.
- **Available routes:**
  - `/#board` - coordination board
  - `/#calendar` - shared family calendar
  - `/#messages` - topic threads
  - `/#shopping` - shopping list
  - `/#expenses` - expenses tracker
  - `/#settings` - settings and integrations

---

## 2026-06-02 - Session: UX, design system, auth, board

### Board

- **Kanban columns** - replaced status-based columns (Important / Waiting / To Do / Done) with three kanban columns: **To decide** (Important, Waiting, Disputed), **Mine** (To Do, Info Only, Request), **Done**. Board grid changed from 4 to 3 columns.
- **Archived cards** - any card with a past due date that is not Done is automatically moved to a collapsible Archived section below the board. Badge shows count. Click to expand.
- **Empty state** - new users see a welcome message with a "New Do" button instead of a blank board.
- **No mock cards for real users** - `loadCards()` no longer falls back to seed/demo cards. New users start empty. Supabase is the source of truth; localStorage is a fast-load cache only. Each family's cards are scoped to their familyId key.

### Cards

- **Author field** - new cards record the author (from onboarding name, Google display name, or email prefix). Stored permanently on the card.
- **Created date** - `createdAt` was already stored; now shown in the card dialog meta bar alongside the author.
- **Card meta bar** - card dialog now shows "Added by [name] · Added on [date]" and, when Google Calendar is synced, a green "In calendar / Alert X before" chip linking directly to the GCal event.
- **GCal-first reminders** - when Google Calendar sync is enabled, the in-app reminder is skipped. The GCal event alert (set to the default reminder offset from app settings) handles delivery. The standalone reminder picker in the card dialog is hidden when GCal is connected.
- **Reminder panel** - hidden automatically when `syncFamilyCalendar` is on in settings.

### Authentication

- **Apple Sign-In** wired up via `supabaseClient.auth.signInWithOAuth({ provider: 'apple' })`. Requires Apple provider configured in Supabase dashboard (Service ID, Team ID, Key ID, private key).
- **Email auth UX** - replaced the ambiguous "Sign in" + "Create account" side-by-side buttons with a segmented toggle at the top of the email form. Mode selection switches the submit button label and routes to the correct function.
- **Auth confirm text** - removed hardcoded "Ava's family board" from the OAuth confirm step.

### Co-parent invite

- **Email delivery** - `saveOnboardingToSupabase` now awaits the `/api/invite-email` call and returns `emailSent: true/false`. App shows a proper result instead of a silent fire-and-forget.
- **Invite link fallback** - when email can't be sent (no `RESEND_API_KEY` configured), a persistent banner appears with the invite link and a copy button. Link is stored in `sessionStorage` so Settings can re-surface it.
- **Re-send invite in Settings** - new "Co-parent" panel in Settings shows connection status. If co-parent hasn't joined: shows the invite link with copy button and a re-send email button.
- **Sender address** - `/api/invite-email.js` falls back to `onboarding@resend.dev` when no custom domain is configured, so emails work immediately on the free Resend plan. Set `RESEND_FROM_EMAIL` env var in Vercel for a branded sender.

### Navigation

- **Mini-stat buttons** - Messages and Reminders shortcut buttons in the toolbar stat bar now navigate to the correct module (Messages and Settings respectively).
- **Nav dead zone fixed** - tabbar is now visible at all widths below 1081px. Desktop sidebar appears above 1081px. Previously there was a 760-1080px range with no navigation.

### Onboarding

- **Placeholder vs value** - Parent A, Parent B, Ava, Milo removed as pre-filled `.value` attributes. They are placeholder-only now. Child is not force-created if the name field is left blank.

### Design system

- **Surface tokens** - added `--surface-page`, `--surface-card`, `--surface-input`, `--surface-raised`, `--surface-nav` to `:root` with dark mode variants. The 130-line `html[data-theme="dark"]` override block now uses these tokens instead of hardcoded hex values. New components only need to use the right token - no manual dark override needed.
- **Border radius tokens** - `--radius-sm` (8px), `--radius-md` (16px), `--radius-lg` (28px), `--radius-full` (999px) defined in `:root`.
- **Spacing scale** - `--space-1` through `--space-8` (4px to 32px) defined in `:root`.
- **Button hover states** - `primary-button`, `secondary-button`, `ghost-button`, `icon-button` all have `:hover:not(:disabled)` rules. Previously none existed.
- **Hardcoded colors replaced** - `#374151` → `var(--muted)`, `#f3f4f6` / `#f9fafb` → `var(--soft)`, `#111827` → `var(--ink)`, `#ffffff` → `var(--paper)`, `#fafafa` / `#fdfdfb` → `var(--surface-page)`.
- **Focus ring** - fixed from blue (`rgba(37, 99, 235, 0.14)`) to `var(--accent-weak)` to match the app accent.
- **Font weights** - `font-weight: 850` (invalid CSS, was snapping to 800) replaced with `800`. `font-weight: 600` replaced with `700`. Standardized to 400 / 700 / 800 / 900.
- **icon-button duplicate** - two separate `.icon-button` rule blocks merged. The small variant used in Settings list items is now `.icon-button-sm`. `features.js` updated to use both classes.

### Toast

- **Position** - moved from bottom (above tabbar, near navigation) to top of screen (`top: calc(16px + env(safe-area-inset-top))`). Slides down from above. Uses `var(--ink)` / `var(--paper)` tokens. No longer obscured by or confused with the navigation bar.

### Card dialog

- **View-only indicator** - "Read only - tap Edit to make changes" hint shown below the dialog header when viewing an existing card in read-only mode. Disappears when edit mode activates. The "Edit" link in the hint also triggers edit mode.
- **Voice panel** - voice card, transcript textarea, and autofill button moved into a `#voicePanel` that is collapsed by default. A mic icon button above the details textarea toggles it open. Does not appear in new-card (LLM) mode or view mode.
- **Apple button** - removed from invite screen (was showing a dead "not available yet" error).

### Settings

- **Appearance / Theme** - moved to the bottom of the Settings layout, below Account.
- **Column heights** - Settings panels no longer stretch to equal heights. `align-items: start` on the grid lets each panel be only as tall as its content. Layout uses `auto-fill` columns with 300px minimum.

---

## Environment variables required

| Variable | Where | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Vercel env | Invite emails via Resend (free: 3000/month) |
| `RESEND_FROM_EMAIL` | Vercel env (optional) | Custom sender e.g. `Do-Do <invite@yourdomain.com>`. Defaults to `onboarding@resend.dev` |

## Supabase dashboard setup required

- **Apple provider** - Authentication → Providers → Apple → enable, enter Service ID, Team ID, Key ID, private key from Apple Developer console.
- **Google provider** - already configured.
- **Redirect URLs** - ensure your production domain is in the allowed redirect list.
