# SEG-01 - Security & Data Foundation

**Priority:** Must be done before any paid users.
**Status:** Done - QA verified 2026-06-15
**Estimated effort:** 1-2 days

---

## 1.1 Supabase RLS Audit

### Problem
If RLS policies are missing or incomplete on any table, any authenticated user can
read or write any other family's data via direct Supabase API calls.

### Tables to audit
- `unified_cards` - must be scoped to `pair_id = current_pair_id()`
- `families` - must be scoped to members only
- `profiles` - user can only read/write own row + co-parent's name
- `pairs` - read only for members of that pair
- `shopping_items` - scoped to `family_id = my_family_id()`
- `children`, `pets` - scoped to family

### What to check in Supabase dashboard
1. Go to supabase.com/dashboard/project/vkafktcrhrmehruiqjni/auth/policies
2. Every table must show RLS = ENABLED
3. Every table must have SELECT, INSERT, UPDATE, DELETE policies
4. Policies must use `auth.uid()` or a helper function, never `true`

### Helper functions to verify exist
```sql
-- Should exist already:
CREATE OR REPLACE FUNCTION public.my_family_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_pair_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT pair_id FROM public.profiles WHERE id = auth.uid()
$$;
```

### unified_cards RLS to add if missing
```sql
ALTER TABLE public.unified_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cards: family members only"
  ON public.unified_cards FOR ALL TO authenticated
  USING (pair_id = public.current_pair_id())
  WITH CHECK (pair_id = public.current_pair_id());
```

### Acceptance criteria
- [ ] All tables have RLS enabled
- [ ] Logged in as User A, direct `supabase.from('unified_cards').select()` returns only family A's cards
- [ ] User A cannot read, update or delete family B's cards even via Supabase JS client

---

## 1.2 Google OAuth Token Refresh

### Problem
`provider_token` (Google OAuth access token) is only present in the Supabase session
immediately after OAuth sign-in. On every subsequent page load it is `null`.
This means Google Calendar stops working after the user's first session.

**File:** `supabase-data.js` lines 410-428

### Current broken flow
```
User signs in → provider_token present → calendar works
User reopens app next day → provider_token = null → calendar silently broken
```

### Fix required

**Step 1:** On sign-in, store the refresh token in Supabase profiles table.
Add column to profiles: `google_refresh_token TEXT`.

```sql
-- Run in Supabase SQL editor
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
```

**Step 2:** In `supabase-data.js` `initGoogleCalendar()`, save refresh token on sign-in:
```js
// After line 427 (googleAccessToken = token)
if (session.provider_refresh_token) {
  await window.supabaseClient
    .from('profiles')
    .update({ google_refresh_token: session.provider_refresh_token })
    .eq('id', session.user.id);
}
```

**Step 3:** Create `/api/refresh-google-token.js`:
```js
// Calls Google token endpoint with refresh_token
// Returns new access_token
// Requires: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel env vars
```

**Step 4:** In `supabase-data.js`, if `provider_token` is null on load:
- Fetch `google_refresh_token` from profiles
- Call `/api/refresh-google-token`
- Use returned access token for all GCal calls

### Env vars to add to Vercel
- `GOOGLE_CLIENT_ID` - from Google Cloud Console OAuth credentials
- `GOOGLE_CLIENT_SECRET` - from Google Cloud Console OAuth credentials

These are the same credentials Supabase uses for Google OAuth.
Find them at: console.cloud.google.com → APIs & Services → Credentials

### Acceptance criteria
- [ ] Sign in with Google, close app, reopen next day → calendar still shows events
- [ ] No "calendar sync lost" silent failures in console
- [ ] Token refresh happens transparently without prompting user to re-sign-in

---

## 1.3 Email Verification Enforcement

### Problem
Users can create email/password accounts and access family data without
verifying their email. This allows junk accounts and potential abuse.

### Fix
In `app.js`, in the auth state change handler, check `session.user.email_confirmed_at`:

```js
// In supabase-data.js auth state handler, after getting session:
if (session && !session.user.email_confirmed_at && session.user.app_metadata?.provider === 'email') {
  // Show "Check your email" screen, don't load board
  showEmailVerificationScreen();
  return;
}
```

Add a simple screen in `index.html`:
```html
<section class="auth-screen" id="verifyEmailScreen" hidden>
  <p>Check your email and click the verification link to continue.</p>
  <button id="resendVerificationButton">Resend email</button>
</section>
```

### Acceptance criteria
- [ ] Email/password signup requires email click before board is accessible
- [ ] Google OAuth users (already verified) are unaffected
- [ ] Resend button works
