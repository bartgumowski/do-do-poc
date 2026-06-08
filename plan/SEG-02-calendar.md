# SEG-02 - Calendar - Real Integration

**Priority:** Core feature - blocking for launch
**Status:** Done - token refresh, co-parent busy slots, Apple CalDAV, recurring events, conflict detection all implemented
**Estimated effort:** 4-6 days
**Depends on:** SEG-01 task 1.2 (token refresh)

---

## 2.1 Token Refresh Wired Into All GCal Calls

### Problem
All GCal functions assume `googleAccessToken` is valid. It isn't after first session.
(See SEG-01 task 1.2 for the refresh implementation.)

### Files to change
- `supabase-data.js`

### What to add
Wrapper function that refreshes token if needed before any API call:

```js
async function getValidGoogleToken() {
  if (googleAccessToken) return googleAccessToken;
  // Fetch refresh token from profiles
  const { data: profile } = await window.supabaseClient
    .from('profiles')
    .select('google_refresh_token')
    .eq('id', currentAuthSession.user.id)
    .single();
  if (!profile?.google_refresh_token) return null;
  // Call refresh endpoint
  const res = await fetch('/api/refresh-google-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: profile.google_refresh_token }),
  });
  const data = await res.json();
  if (data.access_token) {
    googleAccessToken = data.access_token;
    return googleAccessToken;
  }
  return null;
}
```

Replace every `googleAccessToken` usage in GCal functions with `await getValidGoogleToken()`.

### Acceptance criteria
- [ ] Calendar syncs on every app load, not just after fresh sign-in
- [ ] Expired token triggers silent refresh, not a broken state

---

## 2.2 Co-parent Calendar Connection

### Problem
Only the signed-in user connects their Google Calendar.
The co-parent's busy blocks are never fetched - their calendar is invisible.

### How it should work
Each parent connects their own Google Calendar independently.
Both parents' busy blocks appear on the shared family calendar view,
each in their own color.

### Database change
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
-- already added in SEG-01
-- busy slots stored per user, not per family
```

### Files to change
- `supabase-data.js` - fetch busy slots for both parents
- `features.js` - render co-parent busy blocks in their color
- `index.html` / `features.js` settings - show co-parent calendar connection status

### Logic change
`_fetchWorkBusy()` currently fetches only `primary` calendar.
After co-parent connects, fetch their busy slots server-side
(their refresh token is in their own profile row, RLS-protected).

Add to Settings: "Co-parent's calendar: Connected / Not connected yet"
Show invite nudge: "Ask Art to connect their calendar in their Do-Do settings."

### Acceptance criteria
- [ ] Bart's busy blocks show in dark color on shared calendar
- [ ] Art's busy blocks show in amber color
- [ ] Each parent sees the other's availability without seeing event details
- [ ] Settings shows connection status for each parent independently

---

## 2.3 Apple Calendar / CalDAV

### Problem
Users with iCloud Calendar (most iPhone users who don't use Google) have zero integration.

### Implementation
CalDAV protocol. Apple exposes it at `caldav.icloud.com`.

**Requires app-specific password** (Apple doesn't allow regular passwords for CalDAV):
- User goes to appleid.apple.com → Security → App-Specific Passwords → generate one
- User enters iCloud email + app-specific password in Do-Do settings

**Server-side only** - CalDAV calls must be proxied through a Vercel function
(browser can't call caldav.icloud.com directly due to CORS).

### New Vercel function: `/api/apple-calendar.js`
- POST with `{ email, appPassword, action: 'fetchBusy' | 'createEvent' | 'updateEvent' }`
- Fetches VCALENDAR data via HTTP REPORT request
- Parses VEVENT blocks for busy times
- Creates/updates events via PUT

### Files to change
- `/api/apple-calendar.js` - new file
- `supabase-data.js` - add `initAppleCalendar()` parallel to `initGoogleCalendar()`
- `features.js` settings - add Apple Calendar connection section
- `index.html` - settings fields for iCloud email and app password

### Storage
Store app-specific password encrypted in Supabase `profiles` column.
Use Supabase Vault or encrypt client-side with user's session key before storing.

### Acceptance criteria
- [ ] User enters iCloud credentials in settings
- [ ] Their busy blocks appear on the family calendar
- [ ] New Do-Do cards with due dates create events in iCloud Calendar
- [ ] App-specific password is never exposed in client-side code

---

## 2.4 Recurring Events

### Problem
All cards are one-off. "Every Friday pickup", "alternate weekends", "weekly football practice"
must be re-entered manually every week.

### Database change
```sql
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS recurrence JSONB;
-- Example value:
-- { "freq": "WEEKLY", "days": ["FR"], "until": null, "interval": 1 }
-- { "freq": "CUSTOM", "pattern": "2-2-3" }  -- custody patterns
```

### Recurrence patterns to support
- Daily
- Weekly (specific days: Mon, Wed, Fri)
- Biweekly (every other week)
- Monthly (1st Monday, last Friday, etc.)
- Custody patterns: 2-2-3, week-on/week-off, alternating weekends

### Files to change
- `app.js` - add recurrence field to card dialog
- `index.html` - add recurrence picker UI in card dialog
- `supabase-data.js` - when pushing to GCal, add RRULE to event body
- `features.js` - show recurring indicator (↻) on calendar dots and cards

### GCal RRULE generation
```js
function buildRRule(recurrence) {
  if (recurrence.freq === 'WEEKLY') {
    const days = recurrence.days.map(d => d.slice(0,2).toUpperCase()).join(',');
    return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
  }
  if (recurrence.freq === 'BIWEEKLY') return 'RRULE:FREQ=WEEKLY;INTERVAL=2';
  // etc.
}
```

### Edit behaviour
When editing a recurring card: show options
- "Edit this event only" → creates exception, original recurrence unchanged
- "Edit this and future events" → modifies RRULE from this date forward
- "Edit all events" → updates master card and all GCal instances

### Acceptance criteria
- [ ] Card created with "every Friday" generates weekly GCal events
- [ ] Custody 2-2-3 pattern generates correct alternating blocks
- [ ] Recurring cards show ↻ indicator on calendar
- [ ] Editing one instance doesn't affect others unless explicitly chosen

---

## 2.5 Conflict Detection

### Problem
When two cards/events overlap in time and involve the same child or both parents,
there is no warning. Parents find out by accident.

### Definition of a conflict
Two events conflict if:
- They overlap in time (start/end ranges intersect)
- AND they share at least one participant (same child, or both involve same parent)

### Files to change
- `app.js` - add `detectConflicts()` function
- `features.js` - show conflict indicators on calendar, conflict banner in card dialog
- `styles.css` - conflict styles

### Logic
```js
function detectConflicts(cards) {
  const events = cards.filter(c => c.due && c.status !== 'Done');
  const conflicts = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i], b = events[j];
      const aStart = new Date(a.due), bStart = new Date(b.due);
      const aEnd = new Date(aStart.getTime() + 60*60*1000); // assume 1h
      const bEnd = new Date(bStart.getTime() + 60*60*1000);
      const overlaps = aStart < bEnd && bStart < aEnd;
      const sharedChild = a.child && b.child && a.child === b.child;
      const sharedParent = a.assignee === b.assignee && a.assignee;
      if (overlaps && (sharedChild || sharedParent)) {
        conflicts.push({ a: a.id, b: b.id, reason: sharedChild ? 'child' : 'parent' });
      }
    }
  }
  return conflicts;
}
```

### UI
- Orange ⚠ dot on conflicting calendar days
- Banner in card dialog: "Conflicts with [other card title] at [time]"
- Conflict count in daily summary strip

### Acceptance criteria
- [ ] Two overlapping events for same child show conflict indicator
- [ ] Card dialog shows which other card conflicts and why
- [ ] Resolved conflicts (one moved or cancelled) clear automatically
- [ ] No false positives for events on same day but different times
