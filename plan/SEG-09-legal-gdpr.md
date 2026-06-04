# SEG-09 - Legal, Privacy & GDPR

**Priority:** Required for EU/CH users (both parents are in Switzerland/Poland)
**Status:** Not started (legal.html exists but is placeholder)
**Estimated effort:** 1-2 days (content) + legal review recommended

---

## 9.1 Account Deletion

### What GDPR requires
User must be able to delete their account and all associated data.
For co-parenting apps: this is complex because cards involve two people.

### Flow
Settings → "Delete account" → Confirmation dialog → Deletion

### What deletion does
1. Auth user deleted from Supabase Auth
2. Profile row deleted (cascades to pair linkage)
3. Cards authored by this user: anonymise author field (`author = 'Deleted user'`)
4. Cards authored by this user and not yet seen by co-parent: delete entirely
5. Co-parent notified: "Bart has deleted their Do-Do account. Your cards are preserved."
6. Family pair becomes single-parent mode (co-parent keeps their cards)

### New Vercel function: /api/delete-account.js
```js
// Requires SUPABASE_SERVICE_ROLE_KEY (admin operations)
// Steps: anonymise cards, remove profile, delete auth user
// Must be server-side - client cannot delete own auth user safely
```

### Acceptance criteria
- [ ] User can delete account from settings
- [ ] All personal data removed from Supabase within 30 days (GDPR requirement)
- [ ] Co-parent's cards preserved after deletion
- [ ] Co-parent receives email notification

---

## 9.2 Data Export

### What GDPR requires
User can request all their data in a portable format.

### Implementation
New `/api/export-data.js`:
```js
// Fetches all cards, comments, profile data for the requesting user
// Returns JSON download
// Also generates CSV of expense history
```

Add "Download my data" button in Settings → Account section.

### Export contents
- Profile data (name, email, settings)
- All cards (title, details, dates, amounts, comments)
- Shopping list history
- Expense history with amounts

---

## 9.3 Privacy Policy & Terms of Service

### Files to update
`legal.html` - replace placeholder with actual content covering:

**Privacy Policy must include:**
- What data is collected (email, names, card content, calendar events)
- How it's used (family coordination, reminders, AI processing)
- Who can see it (only your co-parent, Supabase staff, Anthropic for AI)
- Data retention (kept until account deletion)
- Your rights (access, correction, deletion, export)
- Contact: bart@do-do.app (or legal@do-do.app)
- Jurisdiction: Switzerland (Swiss DSG + GDPR for EU users)

**Terms of Service must include:**
- Service description
- Payment terms and refund policy
- Acceptable use (no harassment, accurate information)
- Limitation of liability (this is not legal advice)
- Governing law: Switzerland

**Recommendation:** Have a lawyer review before launch. Cost ~CHF 300-500.
Use LegalZoom or a Swiss startup lawyer for a fast turnaround.

---

## 9.4 Cookie Consent Banner

### What's needed
- Supabase uses no tracking cookies (only session cookies)
- Fonts loaded from Google Fonts (legitimate interest basis in most EU jurisdictions)
- No analytics currently (no GA, no Mixpanel)

### Simple implementation
Show one-time banner on first visit from EU/CH IP:
"We use cookies only for authentication. No tracking. [Got it]"

Store consent in localStorage. No complex cookie management needed
since there are no advertising or analytics cookies.

### If analytics are added later
Use a GDPR-compliant analytics tool (Plausible, Fathom, or PostHog EU)
that doesn't require consent under ePrivacy Directive.

---

## 9.5 Data Residency

### Current state
Supabase project region: unknown (likely US East or EU West by default)

### Check
Go to supabase.com/dashboard/project/vkafktcrhrmehruiqjni/settings/general
→ Look for "Region"

### If not EU
For Swiss and EU users, EU region (Frankfurt: eu-central-1) is preferred.
Migration is possible but requires creating a new Supabase project and migrating data.
Not strictly required but recommended for GDPR compliance and latency.

### Document the region in Privacy Policy
Whatever region is used, state it explicitly in the privacy policy.
