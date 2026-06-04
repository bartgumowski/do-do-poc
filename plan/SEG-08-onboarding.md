# SEG-08 - Co-parent Onboarding & Invite

**Priority:** Medium - second parent joining is fragile today
**Status:** Partial (invite email works; landing page missing; family management locked)
**Estimated effort:** 1-2 days

---

## 8.1 Invite Landing Page

### Problem
`/invite/:token` redirects to `index.html` via vercel.json rewrite.
The app detects the token in the URL but the experience is generic - no context
about who invited them or for which family.

### Fix
When `invite/:token` is detected in `app.js`:
1. Fetch invite details from Supabase using the token
   (pair record has `invite_token`, `family_id`, linked to primary parent's profile)
2. Show personalized invite screen:

```html
"Bart invited you to coordinate for Ava and Leo on Do-Do.

[Continue with Google]
[Continue with email]"
```

### In app.js
```js
async function loadInviteDetails(token) {
  const { data: pair } = await window.supabaseClient
    .from('pairs')
    .select('*, profiles!inner(display_name), families!inner(id)')
    .eq('invite_token', token)
    .single();
  if (pair) {
    document.querySelector('#inviteHero h1').textContent =
      `${pair.profiles.display_name} invited you to coordinate together.`;
    // Show child names if available
  }
}
```

### Acceptance criteria
- [ ] Invite link shows inviting parent's name
- [ ] Shows children's names ("for Ava and Leo")
- [ ] After signing in, second parent is automatically linked to the family
- [ ] Invite token is one-time use (invalidated after successful join)

---

## 8.2 Invite Status in Settings

### Problem
Primary parent has no way to know if co-parent has joined, or re-send the invite.

### Add to Settings (features.js)
"Co-parent" section showing:
```
Co-parent: Art
Status: Joined ✓ (or "Invite pending - opened 2 days ago" or "Not yet opened")
Calendar: Connected ✓ (or "Not connected")
[Re-send invite]  [Copy invite link]
```

### Logic
- Check if `pairs` record has a second `profile_id` filled in
- If yes: joined. Show their name and calendar connection status.
- If no: check if invite email was sent (from invite log)

### Acceptance criteria
- [ ] Primary parent sees real-time co-parent join status
- [ ] Re-send invite button works
- [ ] Copy invite link button copies to clipboard

---

## 8.3 Family Member Management

### Problem
Children and pets added during onboarding cannot be changed.
Parent display names are locked. Real families change - new babies, pets, etc.

### Add to Settings (features.js)
"Family members" section:
- Edit parent A name
- Edit parent B name
- Add/edit/remove children (name, age optional)
- Add/edit/remove pets

### Files to change
- `features.js` - add family management UI to settings
- `supabase-data.js` - add `updateFamilyMember()`, `addChild()`, `removeChild()`
- `app.js` - refresh `getFamilyPeople()` cache after changes

### Acceptance criteria
- [ ] Parent can rename themselves in settings (reflects throughout app)
- [ ] Parent can add a new child
- [ ] Parent can remove a child (with confirmation)
- [ ] Changes sync to co-parent's app in real-time
