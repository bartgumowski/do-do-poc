# SEG-14 - Security Hardening (Critical + High fixes from 2026-06-10 audit)

**Priority:** Must be done before any real users / marketing push. Blocks launch.
**Status:** Pending
**Estimated effort:** 1-2 days
**Source:** `CODE-AUDIT-2026-06-10.md` (Critical C1-C3, High H1-H4)

Work top to bottom. Each task = one commit. Bump PATCH version per push as usual.

---

## 14.0b RLS public-role policy audit (found during SEG-01 QA, 2026-06-15)

Several tables have policies applied to the `public` role instead of `authenticated`.
This means unauthenticated (anon) users can theoretically reach those endpoints.
Tables affected: `schedules`, `expense_ledger`, `card_activity`, `notifications`, `invite_tokens`, `families` (some policies), `profiles` (some policies).

### What to check
For each policy on `public` role: verify it uses `auth.uid()` in its USING/WITH CHECK expression.
If `auth.uid()` is present, the policy is safe (anon users have no uid, so it returns no rows).
If there is no `auth.uid()` check, the policy is a real exposure and must be tightened.

### Fix pattern
Change any unsafe `public`-role policy to require `authenticated` role:
```sql
-- Example: fix schedules read policy
DROP POLICY IF EXISTS "Users can read own pair schedules" ON public.schedules;
CREATE POLICY "Users can read own pair schedules"
  ON public.schedules FOR SELECT TO authenticated
  USING (pair_id IN (SELECT id FROM public.pairs WHERE family_id = public.my_family_id()));
```

- [ ] Audit each public-role policy for auth.uid() presence
- [ ] Rewrite any that lack it to use `authenticated` role with proper scoping
- [ ] Acceptance: anon Supabase client returns 0 rows from schedules, expense_ledger, card_activity

---

## 14.0 Rotate leaked credentials (do first, 15 min)

- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase dashboard -> Settings -> API, update in Vercel env vars
- [ ] Revoke the GitHub PAT embedded in the git remote URL; create a new one
- [ ] Re-point remote without the token in the URL (use macOS keychain credential helper):
  ```bash
  git remote set-url origin https://github.com/bartgumowski/do-do-poc.git
  git config credential.helper osxkeychain
  ```
- [ ] Delete `Git token.md.rtf` from the working folder
- [ ] Acceptance: `git config --get remote.origin.url` contains no `ghp_`; old keys rejected by Supabase/GitHub

---

## 14.1 Shared auth helper (enabler for 14.2-14.5)

**New file:** `api/_auth.js`

```js
// api/_auth.js - verify Supabase JWT, return user or null.
// Usage: const user = await requireUser(req, res); if (!user) return;
const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireUser(req, res) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) { res.status(401).json({ error: "Invalid token" }); return null; }
  return user;
}

module.exports = { requireUser, supabaseAdmin };
```

Note: Vercel does not deploy `api/_auth.js` as an endpoint (underscore prefix = helper), so this does NOT consume one of the 12 Hobby function slots.

Client-side: every call to a protected endpoint must attach the JWT. Pattern already exists at `features.js:2907-2913` (export-data). Reuse it.

- [ ] Create `api/_auth.js`
- [ ] Acceptance: `delete-account.js` and `export-data.js` refactored to use it (no behavior change)

---

## 14.2 C1 - Authenticate service-role endpoints (IDOR)

### a) `api/stripe-portal.js`

Line 19 takes `userId` from body. Replace with verified identity.

```js
// BEFORE (line ~19)
const { userId } = req.body || {};
if (!userId) return res.status(400).json({ error: "userId required" });

// AFTER
const { requireUser } = require("./_auth");
const user = await requireUser(req, res);
if (!user) return;
const userId = user.id;
```

Client: `features.js:3053` - add auth header, drop `userId` from body:

```js
const session = (await window.supabaseClient?.auth?.getSession())?.data?.session;
const res = await fetch("/api/stripe-portal", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
  body: JSON.stringify({}),
});
```

### b) `api/stripe-checkout.js` (`action:"create"`, line ~28)

Same pattern. `userId` from token; `pairId` must be looked up server-side from the user's own profile, never from the body:

```js
const user = await requireUser(req, res);
if (!user) return;
const userId = user.id;
const { data: profile } = await supabase
  .from("profiles").select("pair_id, stripe_customer_id, display_name")
  .eq("id", userId).maybeSingle();
const pairId = profile?.pair_id;
if (!pairId) return res.status(400).json({ error: "No active pair" });
```

For `action:"expense"` (line ~78): after `requireUser`, verify the card belongs to the caller's pair before creating the PaymentIntent:

```js
if (card.pair_id !== pairId) return res.status(403).json({ error: "Forbidden" });
```

Client callers: `app.js:302` and `app.js:1989` - add `Authorization` header, remove `userId`/`pairId` from body.

### c) `api/push-subscribe.js`

Lines 29-31 take `user_id` from body with no auth. Fix:

```js
// POST: derive user from JWT
const user = await requireUser(req, res);
if (!user) return;
const { endpoint, p256dh, auth } = req.body || {};
// ...upsert with user_id: user.id

// DELETE: also requireUser, and scope deletion:
// .../push_subscriptions?endpoint=eq.{endpoint}&user_id=eq.{user.id}
```

Client callers: `app.js:4230` and `app.js:4253` - add `Authorization` header, drop `user_id` from body.

- [ ] stripe-portal.js + features.js caller
- [ ] stripe-checkout.js (both actions) + app.js callers
- [ ] push-subscribe.js (POST + DELETE) + app.js callers
- [ ] Acceptance: curl each endpoint without `Authorization` -> 401; with valid JWT but foreign cardId -> 403

---

## 14.3 C2 - Stripe webhook fails closed

`api/stripe-webhook.js` lines 43-54:

```js
// BEFORE
if (!webhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET not set - skipping signature verification");
}
event = webhookSecret
  ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  : JSON.parse(rawBody.toString());

// AFTER
if (!webhookSecret) {
  console.error("STRIPE_WEBHOOK_SECRET not set - rejecting webhook");
  return res.status(500).json({ error: "Webhook not configured" });
}
event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
```

- [ ] Apply patch
- [ ] Verify `STRIPE_WEBHOOK_SECRET` is set in Vercel (Production env)
- [ ] Acceptance: unsigned POST to `/api/stripe-webhook` -> 400/500, never processed; Stripe test event from dashboard -> 200

---

## 14.4 C3 - Stored XSS in message/expense rendering

All in `features.js`. `escapeHtml()` already exists at `features.js:3015`.

### a) `renderRealMessage` - line 1554

```js
// BEFORE
<p>${msg.body}</p>
// AFTER
<p>${escapeHtml(msg.body)}</p>
```

Also escape `name` on line 1553 (`<strong>${name}</strong>` -> `${escapeHtml(name)}`) - parent names are user input.

### b) Expense preview card - lines 1359-1361

```js
// BEFORE
<strong class="expense-card-title">${card.title || "Expense"}</strong>
${card.details ? `<span class="expense-card-detail">${card.details}</span>` : ""}
// AFTER
<strong class="expense-card-title">${escapeHtml(card.title || "Expense")}</strong>
${card.details ? `<span class="expense-card-detail">${escapeHtml(card.details)}</span>` : ""}
```

### c) `renderUniversalFeatureCard` fallback - lines ~1971-1977

```js
// AFTER
<h3 class="card-title">${escapeHtml(card.title)}</h3>
<p class="card-details">${escapeHtml(card.details)}</p>
```

### d) Defence in depth: security headers in `vercel.json`

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://js.stripe.com https://api.stripe.com https://oauth2.googleapis.com https://www.googleapis.com; frame-src https://js.stripe.com; font-src 'self' data:" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" }
    ]
  }
]
```

Test the CSP on preview deploy first - Supabase realtime (wss), Google OAuth redirect, and Stripe Elements must all still work. Adjust `connect-src` if console shows blocked origins.

- [ ] a, b, c escaping patches
- [ ] Manual test: send message `<img src=x onerror=alert(1)>` -> renders as text, no alert
- [ ] d headers, verified on preview before production
- [ ] Acceptance: securityheaders.com scan of do-do.app shows CSP + the four headers

---

## 14.5 H1 - Lock down AI and email relay endpoints

### a) `api/ai.js`

- Line 5: CORS `*` -> not needed at all (same-origin calls); delete the three `Access-Control-Allow-*` lines and the OPTIONS branch, or set origin to `https://do-do.app`
- After line 15: add `requireUser` (convert file to CommonJS or inline the JWT check with `fetch` to `auth/v1/user` since this file is ESM)
- Cap input: `if (text.length > 2000) return res.status(400).json({ error: "Text too long" });`

Client callers to add auth header: `app.js:1430`, `app.js:2275`, `features.js:127`.

### b) `api/invite-email.js`

- Add `requireUser`; reject if no session (closes the open mail relay)
- Validate `inviteLink` starts with `https://do-do.app/invite/` before sending - prevents phishing links through your Resend domain:
  ```js
  if (!/^https:\/\/do-do\.app\/invite\//.test(inviteLink)) return res.status(400).json({ error: "Invalid link" });
  ```
- Client callers: `features.js:3192`, `supabase-data.js:380` - add auth header

### c) CORS sweep (M7, same commit)

Remove or pin `Access-Control-Allow-Origin: *` in: `ai.js:5`, `apple-calendar.js:22`, `invite-email.js:5`, `push-subscribe.js:6`, `refresh-token.js:17`, `remind.js:43`, `siri-add.js:13`, `siri-token.js:13`. Keep `*` ONLY on `siri-add.js` (called by Apple Shortcuts, not a browser - actually Shortcuts ignores CORS, so it can be removed there too).

- [ ] ai.js auth + length cap + CORS
- [ ] invite-email.js auth + link allowlist
- [ ] CORS sweep all 8 files
- [ ] Acceptance: POST /api/ai without JWT -> 401; invite-email with foreign link -> 400

---

## 14.6 H3 + H4 - Fix or park the Siri path

Decision needed: Siri adds are broken today (`siri-add.js:94` inserts into `rest/v1/cards`; the app uses `unified_cards` everywhere - see `supabase-data.js:177,238,252,274`).

**Option A (recommended for now): park it.** Delete `api/siri-add.js` + `api/siri-token.js`, hide the Siri section in Settings (`features.js:~990`). Frees 2 of the 12 Hobby function slots. Re-introduce properly in SEG-12 (iOS wrapper).

**Option B: fix it.**
- [ ] `siri-add.js:94`: `rest/v1/cards` -> `rest/v1/unified_cards`
- [ ] Card payload: align fields with `unified_cards` schema (`body`, `card_type`, `due_at`, `child_label` - compare with `supabase-data.js` mapping layer)
- [ ] Replace derived HMAC token with stored revocable token: new table `siri_tokens (token_hash, user_id, created_at, revoked_at)`, generate 32 random bytes, store SHA-256 hash, look up on use
- [ ] Use `crypto.timingSafeEqual` for comparison
- [ ] Token visible/revocable in Settings

- [ ] Decision logged (A or B) + implemented
- [ ] Acceptance (A): endpoints gone, Settings shows no Siri section. (B): Siri add appears on board in realtime; revoked token -> 401

---

## 14.7 H2 - iCloud credential handling (can trail the rest)

Today: app-specific password sent per-request from `localStorage` (`features.js:919`, `api/apple-calendar.js`). After 14.4 (XSS fixed) the immediate risk drops, but:

- [ ] Short term: move storage from `localStorage` to `sessionStorage` (cleared on browser close) and add a Settings warning that the password is stored on this device
- [ ] Medium term (separate segment): store encrypted server-side (Supabase Vault), proxy with `requireUser`, never return the password to the client
- [ ] Add `requireUser` to `api/apple-calendar.js` now (one line, stops it being an open CalDAV proxy for arbitrary iCloud accounts)

---

## Deployment notes

- 14.2 client+server changes must ship in the SAME deploy (old clients sending no auth header will get 401s) - acceptable: SW network-first means clients pick up new JS on next load; cache-busting query strings already in `index.html:813-816`
- Bump `APP_VERSION` minor -> 0.8.0 when segment completes (per AGENTS.md convention)
- After deploy, run through: login, create card, send message, invite flow, checkout test mode, push subscribe, data export
- Re-run curly-quote check after any `index.html` edit (per AGENTS.md)

## Out of scope (tracked in audit, later segments)

Medium findings M2-M6 (`.DS_Store`, guest token expiry, refresh-token RLS column deny, SW caching `/api/` responses), CI/ESLint setup, esbuild module step.
