# Do-Do Changelog

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
