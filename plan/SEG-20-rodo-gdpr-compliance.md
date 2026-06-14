# SEG-20 - RODO / GDPR Compliance

**Priority:** HIGH - Required before commercial launch with EU/Swiss/Polish users
**Status:** In progress (consent checkbox done in v0.21.x)
**Estimated effort:** 3-5 days total across all items

Audit date: 2026-06-14
Based on: legal.html, prywatnosc.html, app.js, api/delete-account.js, api/export-data.js

---

## HIGH PRIORITY (legal risk - must do before first paid user)

---

### 20.1 Consent checkbox at registration

**Status:** DONE in v0.21.x

**What was missing:**
The signUp() function created accounts with no explicit Terms + Privacy Policy acceptance.
GDPR requires provable informed consent at the point of data collection.

**What was added:**
- Checkbox in the auth form, visible only in "Create account" mode
- Unchecked by default, required field
- Links to legal.html and prywatnosc.html (Polish)
- signUp() in app.js blocks if checkbox is unchecked
- i18n keys: auth.consent_label, auth.consent_required

**Acceptance criteria:**
- [x] Checkbox appears only on "Create account" tab, not "Sign in"
- [x] Unchecked by default
- [x] Submit blocked if unchecked (HTML required + JS guard)
- [x] Links to Terms and Privacy Policy
- [x] Error message shown if user tries to bypass

---

### 20.2 Sign actual DPAs with processors

**Status:** Pending - manual action required by Bart

**What is needed:**
The privacy policy says DPAs are in place ("umowy powierzenia"). They must actually be executed.

**Steps:**
1. **Supabase** - Dashboard > Settings > Legal > Data Processing Agreement - click "Sign DPA"
   URL: https://supabase.com/dashboard/project/vkafktcrhrmehruiqjni/settings/legal
2. **Vercel** - Settings > Legal > DPA - available for Pro/Team plan
   URL: https://vercel.com/account/legal
3. **Anthropic** - Review API Terms of Service at anthropic.com/legal/api
   Their standard API ToS includes data processing commitments. Check if separate DPA is available.
4. **Resend** - Check resend.com/legal for DPA availability
5. **Stripe** - Stripe's standard terms include DPA commitments for EU. No extra action needed.
6. **Google** - Google Workspace/API ToS already includes SCCs. No extra action.

**Acceptance criteria:**
- [ ] Supabase DPA signed and PDF saved to /legal/dpa-supabase.pdf
- [ ] Vercel DPA signed and PDF saved to /legal/dpa-vercel.pdf
- [ ] Anthropic: confirm API terms cover GDPR / save confirmation
- [ ] Resend DPA signed or confirmed via their ToS
- [ ] All DPAs stored in a /legal/ folder in this repo for audit trail

---

### 20.3 Confirm Supabase data region is EU

**Status:** Pending - must be verified

**Why it matters:**
legal.html and prywatnosc.html both state data is stored in "Supabase EU-West-1 (Ireland)".
If the Supabase project is on a US region, this is a false statement in the privacy policy.

**Steps:**
1. Go to: https://supabase.com/dashboard/project/vkafktcrhrmehruiqjni/settings/general
2. Look for "Region" field
3. If it says eu-west-1 (Ireland) - done. Screenshot it for records.
4. If it says anything else (us-east-1, etc.) - two options:
   a. Migrate to a new Supabase project in eu-west-1 (preferred)
   b. Update privacy policy to state the actual region and add SCC basis

**Acceptance criteria:**
- [ ] Region confirmed as eu-west-1 (Ireland)
- [ ] Screenshot saved to /legal/supabase-region-screenshot.png

---

### 20.4 Add SCCs to English privacy policy

**Status:** Pending - small edit to legal.html

**What is missing:**
prywatnosc.html correctly names Standard Contractual Clauses (SCCs) as the legal basis
for US transfers (Vercel, Anthropic, Resend). legal.html (English) only lists processors
without naming the transfer mechanism.

**Fix:**
In legal.html under "Sharing and processors", add after the processor list:
"Transfers of personal data to US-based processors (Vercel, Anthropic, Resend) are
covered by Standard Contractual Clauses (SCCs) adopted by the European Commission."

**Acceptance criteria:**
- [ ] SCCs mentioned in legal.html processor section
- [ ] Wording matches prywatnosc.html level of detail

---

### 20.5 Record of Processing Activities (RoPA)

**Status:** Pending - internal document, not public

**Legal basis:**
Art. 30 GDPR - controllers must maintain records of processing.
Exemption for <250 employees exists BUT NOT when processing data that may result in
a risk to the rights of data subjects OR includes special categories (health data).
Do-Do processes children's health info (allergies, medications) - exemption does NOT apply.

**Format:** Create /legal/ropa.xlsx or ropa.md with columns:
- Processing purpose
- Categories of data subjects
- Categories of personal data
- Legal basis (Art. 6 reference)
- Recipients / processors
- Third country transfers
- Retention period
- Security measures

**Example rows to include:**
- Family board coordination (schedules, reminders, tasks)
- Child profile data (name, age, school, allergies, medications)
- Expense tracking
- Push notifications
- Google Calendar sync
- AI card processing (Anthropic)
- Payment processing (Stripe)
- Email delivery (Resend)
- Authentication (Supabase Auth)

**Acceptance criteria:**
- [ ] RoPA created with all processing activities
- [ ] Saved to /legal/ropa.md or /legal/ropa.xlsx
- [ ] Reviewed before any regulatory contact

---

## MEDIUM PRIORITY (fix within 30 days of launch)

---

### 20.6 AI processing in-context notice

**Status:** Pending

**What is missing:**
When a user creates a card and AI extraction runs, card text is sent to Anthropic (US).
The privacy policy discloses this, but GDPR best practice requires notice at the point
of processing (not just in a policy document).

**Fix:**
In the AI card creation UI, add a small footnote or tooltip:
"AI suggestions use Claude (Anthropic, US). No data is used for training."
Link to legal.html#privacy.

**Acceptance criteria:**
- [ ] Notice visible in AI card creation flow
- [ ] Links to privacy policy
- [ ] Dismissable / non-intrusive

---

### 20.7 Verify Delete Account and Download Data buttons are in UI

**Status:** Pending - needs verification

**What the policy promises:**
- Settings > Account > Delete account
- Settings > Account > Download my data

The APIs exist (/api/delete-account.js and /api/export-data.js) but the Settings UI
in index.html must actually have these buttons wired up.

**Steps:**
1. Sign in to the app
2. Go to Settings > Account section
3. Confirm "Delete account" button is visible and functional
4. Confirm "Download my data" button is visible and functional
5. Test both flows end to end

**Acceptance criteria:**
- [ ] Delete account button visible in Settings
- [ ] Download my data button visible in Settings
- [ ] Both call their respective API endpoints
- [ ] Delete account shows a confirmation dialog before proceeding

---

### 20.8 Fix Polish diacritics in prywatnosc.html

**Status:** Pending

**What is wrong:**
The Polish privacy policy is missing Polish characters throughout, making it look
unprofessional for a legal document.

**Examples to fix:**
- "prywatnosci" -> "prywatnosci" (file is served to Polish users as their legal document)
- "uzytkownikow" -> "uzytkownikow"
- These are transcription artifacts from the original draft

**Steps:**
Run a full pass through prywatnosc.html correcting all Polish diacritics.
Key characters: a, c, e, l, n, o, s, z, z (with accents).

**Acceptance criteria:**
- [ ] All Polish words use correct characters
- [ ] File validated with a Polish spell checker or native speaker review

---

## LOW PRIORITY (before scaling / marketing)

---

### 20.9 Data retention enforcement

**Status:** Pending

**What the policy commits to:**
- Logs: retained 90 days max
- Backups: deleted within 30 days
- These are stated in prywatnosc.html section 6

**Current state:**
No scheduled job enforces these retention limits.

**Options:**
a. Supabase scheduled functions (Edge Functions with pg_cron) to delete old log rows
b. Document that Supabase manages backup retention natively (verify this is 30 days)
c. Manual quarterly cleanup with a logged procedure

**Acceptance criteria:**
- [ ] Retention limits either enforced by code/config or documented as manual procedure
- [ ] Whatever approach chosen is noted in RoPA (SEG-20.5)

---

### 20.10 Unsubscribe / privacy footer in transactional emails

**Status:** Pending

**What is needed:**
All emails sent via Resend (invites, reminders, payment requests) should include
a footer with:
- Privacy policy link
- "You received this because you have a Do-Do account" explanation
- Way to manage notification settings

**Where to add:**
In /api/remind.js and /api/invite-email.js, add a footer to the HTML template.
In /api/delete-account.js co-parent notification email - already has privacy info.

**Acceptance criteria:**
- [ ] All Resend email templates include privacy footer
- [ ] Footer links to do-do.app/legal and do-do.app/prywatnosc

---

### 20.11 Lawyer review of legal.html and prywatnosc.html

**Status:** Pending - external action

**Why needed:**
The documents are well-structured but were drafted without legal counsel.
Before commercial launch with paying EU/Polish/Swiss users, have a lawyer review:
- legal.html (Terms + Privacy Policy EN)
- prywatnosc.html (Polityka prywatnosci PL)

**Recommended approach:**
Swiss startup lawyer familiar with GDPR and Swiss revDSG.
Estimated cost: CHF 300-500 for a review with redlines.
Timeline: allow 2 weeks before launch.

**Acceptance criteria:**
- [ ] Lawyer review completed
- [ ] Any required changes applied to both documents
- [ ] Effective date updated after final revision

---

## Summary

| Item | Priority | Status | Owner |
|---|---|---|---|
| 20.1 Consent checkbox at signup | HIGH | Done v0.21.x | Code |
| 20.2 Sign DPAs with processors | HIGH | Pending | Bart |
| 20.3 Confirm Supabase EU region | HIGH | Pending | Bart |
| 20.4 SCCs in English legal.html | HIGH | Pending | Code |
| 20.5 Record of Processing (RoPA) | HIGH | Pending | Bart |
| 20.6 AI in-context notice | MEDIUM | Pending | Code |
| 20.7 Verify delete/export UI | MEDIUM | Pending | Code+Test |
| 20.8 Fix Polish diacritics | MEDIUM | Pending | Code |
| 20.9 Data retention enforcement | LOW | Pending | Code/Config |
| 20.10 Email privacy footers | LOW | Pending | Code |
| 20.11 Lawyer review | LOW | Pending | Bart |
