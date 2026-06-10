# Do-Do - Senior Engineering & Architecture Audit

Date: 2026-06-10
Reviewer: Acting senior engineer / architect
Scope: code only, no changes made. Reviewed `app.js`, `features.js`, `supabase-data.js`, `i18n.js`, `index.html`, `sw.js`, all `api/*.js`, SQL migrations, git history, config.
Build reviewed: v0.7.0 (2026-06-09)

---

## Executive summary

Do-Do is a vanilla-JS PWA on Vercel serverless + Supabase, coordinating shared life for two people. The product surface is large and impressively complete for a POC (board, calendar, messages, shopping, expenses, Stripe, push, GDPR flows, i18n). The data-isolation foundation in Postgres (RLS keyed on `my_family_id()`) is well thought out.

The serious problems are concentrated in the serverless API layer, where several endpoints that use the Supabase **service role key** (which bypasses all RLS) either do no authentication or trust an ID supplied in the request body. Combined with an absent webhook signature fallback and stored-XSS sinks in the message/expense rendering, this is **not safe to run as a real production app handling family data and payments** until the High-severity items are fixed. None of the fixes are large.

Risk posture: **Architecture - solid. Security - not production-ready. Optimisation - fine for current scale. Strategy - reduce surface area, add a test/CI safety net.**

Severity counts: Critical 3, High 4, Medium 7, Low / strategic several.

---

## CRITICAL

### C1. Unauthenticated endpoints using the service-role key (IDOR / abuse)

Several functions create a Supabase admin client with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) and then act on an identifier taken straight from the request, with no verification that the caller owns it.

- **`api/push-subscribe.js`** - takes `user_id` from the POST body and writes a push subscription row for that user. No JWT check. Anyone can write/delete push subscriptions for any user id, and the `DELETE` path lets an attacker unsubscribe arbitrary endpoints.
- **`api/stripe-portal.js`** - takes `userId` from the body, looks up that user's `stripe_customer_id`, and returns a Stripe Customer Portal URL. No auth. Given (or guessing) a user id, a third party can open another user's billing portal (view invoices, cancel subscription, change card). This is a direct IDOR on billing.
- **`api/stripe-checkout.js`** (`action:"create"`) - accepts `userId` + `pairId` from the body and creates/looks up a Stripe customer for that user. No auth.

Contrast with `api/delete-account.js` and `api/export-data.js`, which do it correctly: they read the `Authorization: Bearer` JWT and call `supabaseAdmin.auth.getUser(token)` before acting. **Apply that same pattern to every service-role endpoint** and derive the user id from the verified token, never from the body.

### C2. Stripe webhook accepts unsigned events when the secret is unset

`api/stripe-webhook.js`:

```js
if (!webhookSecret) console.warn("...skipping signature verification");
event = webhookSecret
  ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  : JSON.parse(rawBody.toString());   // <-- forged events accepted
```

If `STRIPE_WEBHOOK_SECRET` is ever missing/misconfigured, the handler parses **any** unsigned POST as a real Stripe event. An attacker can then forge `checkout.session.completed` (flip any `pairId` to `active` subscription - free Premium) or `payment_intent.succeeded` (mark any expense `cardId` as `paid`). Fail closed instead: if the secret is absent, return 500 and process nothing. Never `JSON.parse` an unverified webhook body.

### C3. Stored XSS in message and expense rendering

User-controlled text is interpolated into `innerHTML` without escaping. The app already has an `escapeHtml()` helper and uses it correctly for cards in `renderUnifiedCard`, but several sinks bypass it:

- `features.js:1554` `renderRealMessage()` - `<p>${msg.body}</p>`, where `msg.body` is the raw message a co-parent typed (rendered via `list.innerHTML = ...` at 1525 and `insertAdjacentHTML` at 1536). A message like `<img src=x onerror=...>` executes in the partner's session.
- `features.js:1359` - `expense-card-title` and `expense-card-detail` interpolate `card.title` / `card.details` unescaped.
- `features.js:1973` - the `renderUniversalFeatureCard` fallback path interpolates `card.title` and `card.details` unescaped.

Because everything runs same-origin with the Supabase session in the page, an XSS here can read the session and act as the victim. Route every interpolated user value through `escapeHtml()` (or set values via `textContent`). There is no Content-Security-Policy header to blunt this (see M5).

---

## HIGH

### H1. AI endpoint is open, unauthenticated, and uncapped (cost/DoS)

`api/ai.js` sets `Access-Control-Allow-Origin: *`, requires no auth, and proxies straight to the Anthropic API on your key for `interpret` / `suggest-resolution` / `summary`. Anyone can POST in a loop and bill your Anthropic account, or use it as a free Claude proxy. Add auth (verify the Supabase JWT), restrict CORS to the app origin, and add basic rate limiting / per-user quota. The same `*` CORS + no-auth pattern appears in `invite-email.js` (open email-send relay - spam/abuse vector) and `apple-calendar.js`.

### H2. iCloud app-specific password handled in plaintext, stored in localStorage

`api/apple-calendar.js` receives the user's iCloud email + app-specific password in every request body and builds a Basic auth header; the client keeps those credentials in `localStorage` (the code comment acknowledges this is "acceptable for a POC"). localStorage is readable by any XSS (see C3) and persists in plaintext. For real users this is a credential-theft hazard. Move to a server-side encrypted store (Supabase Vault) and treat the C3 XSS as a prerequisite fix.

### H3. `api/siri-add.js` writes to the wrong table (functional + integrity bug)

Siri inserts into `/rest/v1/cards`, but the entire rest of the app reads/writes `unified_cards` (confirmed: `supabase-data.js` uses `unified_cards` everywhere; nothing else references a `cards` table). Cards created by Siri will not appear in the app. If a legacy `cards` table still exists it is silently accumulating orphan rows; if it does not, every Siri add returns 500. Either way this path is broken. Also note `siri-add.js` builds the card with `topic:"schedule"`, `status:"todo"` (DB enum form) while writing via service role - it bypasses the field-mapping layer, so even pointed at `unified_cards` it risks enum/shape drift.

### H4. Custom HMAC Siri token instead of the existing auth system

`siri-token.js` / `siri-add.js` mint a `userId.hmac` token (`SIRI_TOKEN_SECRET`). The token is derived only from the user id with no expiry and no revocation - it is effectively a permanent bearer credential. The `userId` is also the public-ish profile id, so the whole secret of the scheme is the shared `SIRI_TOKEN_SECRET`; if it leaks, every user's token is forgeable. Prefer a stored, revocable token (random, hashed at rest, per-device, expiring) rather than a derived HMAC.

---

## MEDIUM

- **M1. Secret hygiene.** `.env.local` is correctly gitignored, but it sits in the working tree containing a **live** `SUPABASE_SERVICE_ROLE_KEY`, anon key, and a Vercel OIDC token. The git remote URL embeds a live GitHub PAT (`ghp_...`) - visible to anything that can read `.git/config` and easy to leak via screen-share or backups. Recommend: rotate the service-role key and the GitHub PAT, switch the remote to SSH or a credential helper, and keep `Git token.md.rtf` out of the tree (it is gitignored but present). Treat the keys in this repo as compromised and rotate.
- **M2. `.DS_Store` is committed.** Tracked in git (`git ls-files` shows it). Noise + minor path disclosure. Add to `.gitignore` and `git rm --cached`.
- **M3. `guest-view.js` returns a 410 only after `accepted_at`.** Good that it limits fields, but the invite token in `pairs.invite_token` is a long-lived secret in a URL; anyone with the link sees inviter name, children's first names, and 50 recent card titles/amounts before acceptance. Consider short expiry and rotating tokens. (The validation regex and length floor are a nice touch.)
- **M4. `refresh-token.js` passes the service-role key as `apikey` while authenticating the user with their JWT** - functionally fine, but it then reads `provider_refresh_token` via service role and exchanges it. Ensure that column is never selectable under RLS by clients (it should only ever be touched server-side). Worth an explicit RLS deny on `profiles.provider_refresh_token`.
- **M5. No security headers.** No Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or HSTS anywhere (`vercel.json` has none). A CSP would materially reduce the blast radius of C3 and is a few lines in `vercel.json` `headers`.
- **M6. Service worker caches authenticated API responses.** `sw.js` `fetch` handler caches every successful `GET` (`cache.put(event.request, ...)`), including same-origin `/api/*` GETs like `export-data` and `siri-token`. Sensitive responses can land in the Cache Storage of a shared device. Scope the cache to static assets only and never cache `/api/`.
- **M7. CORS `*` across most endpoints.** `ai.js`, `invite-email.js`, `apple-calendar.js`, `push-subscribe.js`, `siri-*` all send `Access-Control-Allow-Origin: *`. Lock to the known app origin(s).

---

## LOW / correctness

- `i18n.js` loads before everything and exposes `window.t()` - fine, but several render paths interpolate untranslated literals; consistency only.
- `delete-account.js` selects `profiles_a:profiles!...email:id` (aliasing `email` to `id`) - looks like a copy/paste artifact; the email is actually fetched via `auth.admin.getUserById`. Dead/confusing select; clean up.
- `remind.js` fetches `auth/v1/admin/users?per_page=50` and maps emails - will silently miss users beyond 50 once you grow. Paginate or look up by id.
- `stripe-checkout.js` `baseUrl()` ignores its `req` arg and reads env only - harmless but misleading.
- No input length validation on AI `text` (the DB enforces message length, but the AI prompt does not), so a large body inflates token cost.

---

## Architecture assessment

The separation is reasonable for a no-build app: `i18n.js` (engine) -> `supabase-data.js` (data/mapping layer) -> `app.js` (state, board, dialogs) -> `features.js` (per-feature modules). The DB field-mapping layer (`TOPIC_TO_DB` etc.) is a clean seam between the friendly client vocabulary and the DB enums.

Concerns:

1. **File size / single-file modules.** `app.js` is 4,339 lines, `features.js` 3,451, `styles.css` 7,823. There is no module system, so everything is global (`window.renderUnifiedCard`, `window.getCurrentUserId`, etc.) and load order is load-bearing. This is the main long-term maintainability risk. It works, but it is one curly-quote away from a silent break - the team already documented exactly that failure mode in `AGENTS.md`, which is a strong signal the toolchain (no bundler, hand-edited HTML) is fighting you.
2. **Service-role endpoints as the security boundary.** Because RLS is strong, the temptation is to "just use the service role" in serverless and skip auth. That inverts the model - every service-role endpoint must re-implement authz by hand, and C1 shows that several forgot. Standardise a single `requireUser(req)` helper that verifies the JWT and returns the user, and forbid using `pairId`/`userId` from the body.
3. **Dual write paths.** Cards can be created from the client (mapped) and from `siri-add` (raw, wrong table). Funnel all writes through one server-validated path to avoid drift (H3).
4. **No tests, no CI, no linter.** No `.eslintrc`, no test files, manual version bumping, and a documented recurring curly-quote corruption bug. For an app touching payments and family data this is the highest-leverage gap after the security fixes.

---

## Optimisation

Performance is fine at current scale and not where the risk is.

- Bundle is hand-served, uncompressed-source but gzip is small (app.js ~40KB gz, features.js ~35KB, styles.css ~24KB, i18n ~12KB). No urgent need for a bundler purely for size, though one would solve the global-namespace and curly-quote problems.
- `renderBoard()` rebuilds the board via `innerHTML` on each render rather than diffing. With two users and a modest card count this is irrelevant; only revisit if a single family ever holds thousands of cards.
- No `debounce`/`throttle` anywhere - realtime channel callbacks (`cards:`, `messages:`, `shopping:`) re-render on every event. Fine for two-person pairs; add debouncing only if you see render thrash.
- Realtime subscriptions are correctly scoped per pair/family in the channel name, which keeps fan-out small.

Net: do **not** spend optimisation effort now. Spend it on security and a test harness.

---

## Strategy / recommendations (priority order)

1. **Lock down service-role endpoints (C1)** - add JWT verification, derive identity from the token. Highest risk, low effort.
2. **Fail closed on the Stripe webhook (C2)** and confirm `STRIPE_WEBHOOK_SECRET` is set in Vercel.
3. **Escape all user content in HTML sinks (C3)** and add a CSP header (M5) as defence in depth.
4. **Rotate the service-role key and GitHub PAT now (M1)**; move the remote off an embedded token.
5. **Authenticate + rate-limit the AI and email relays (H1)**; restrict CORS (M7).
6. **Fix or remove the Siri path (H3/H4)** - it is currently broken and adds a weak auth scheme.
7. **Add a minimal CI**: ESLint + the existing curly-quote check + a smoke test that the app boots. This directly attacks the documented recurring breakage.
8. Medium term, introduce a light build step (esbuild) to get module scoping and kill the global/load-order fragility without changing the stack philosophy.

---

## What is already good

Worth keeping: the RLS design with `my_family_id()` / `my_pair_id()` helpers and `WITH CHECK (created_by = auth.uid())`; correct JWT verification in the GDPR endpoints; field length CHECK constraints in SQL; `guest-view` deliberately projecting a minimal field set with token validation; `escapeHtml` already existing and used for the main card renderer; idempotent SQL migrations; and genuinely thorough product/GDPR coverage for a POC.
