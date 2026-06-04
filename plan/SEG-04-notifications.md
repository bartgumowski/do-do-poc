# SEG-04 - Notifications

**Priority:** High - reminders are a core promise of the app
**Status:** Partial (email works if env vars set; cron never fires; no push)
**Estimated effort:** 2-3 days
**Depends on:** SEG-01 (Supabase access)

---

## 4.1 Enable Vercel Cron (5-minute fix)

### Problem
`/api/remind.js` is fully built but never called automatically.
`vercel.json` has no crons configuration. Reminder emails never fire.

### Fix
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/remind",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Requires Vercel Pro plan** (~$20/month). Hobby plan does not support crons.
Upgrade at: vercel.com/account/billing

### Also verify these env vars are set in Vercel dashboard
- `SUPABASE_SERVICE_ROLE_KEY` - needed to query cards across all users
- `RESEND_API_KEY` - needed to send emails
- `RESEND_FROM_EMAIL` - set to `reminders@do-do.app`

### Acceptance criteria
- [ ] Create a card with reminder 5 minutes from now
- [ ] Wait 15 minutes
- [ ] Email received with correct card title and details
- [ ] Card marked as `reminder_notified_at` in Supabase (no duplicate emails)

---

## 4.2 Web Push - VAPID Setup

### Problem
Service worker has push handler. Nothing sends pushes to it.
Users get no in-browser/phone notifications - only emails.

### Implementation

**Step 1: Generate VAPID keys** (one-time, store in Vercel env vars)
```bash
npx web-push generate-vapid-keys
```
Add to Vercel:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT=mailto:bart@do-do.app`

**Step 2: Database - store push subscriptions**
```sql
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own subscriptions only"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Step 3: Subscribe in app.js** (after user grants notification permission)
```js
async function subscribeToPush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  await window.supabaseClient.from('push_subscriptions').upsert({
    user_id: currentAuthSession.user.id,
    endpoint: sub.endpoint,
    p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
    auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
  }, { onConflict: 'endpoint' });
}
```

**Step 4: Send push from /api/remind.js**
```js
import webpush from 'web-push';
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);
// For each user with a push subscription:
await webpush.sendNotification(subscription, JSON.stringify({
  title: card.title,
  body: `Due: ${dueText}`,
  tag: `card-${card.id}`,
  data: { cardId: card.id, url: `https://do-do.app/#board` },
}));
```

**Step 5: Handle notification click in sw.js**
```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://do-do.app';
  event.waitUntil(clients.openWindow(url));
});
```

### Acceptance criteria
- [ ] User grants notification permission → subscription saved to Supabase
- [ ] Reminder fires → push received on desktop Chrome
- [ ] Push received on Android Chrome
- [ ] Tapping notification opens Do-Do to the relevant card
- [ ] iOS Safari (installed as PWA) receives push notification

---

## 4.3 Notification Permission UI

### Problem
Currently there's no in-app prompt to grant notification permission.
Browser default prompt is confusing and often dismissed.

### Implementation
After first successful login, show a contextual prompt:
```
"Get reminded before pickups, appointments and deadlines.
Allow notifications to never miss a Do."
[Enable notifications]  [Not now]
```

Show this once. Store `notif-asked` in localStorage.
Don't show if user already granted or denied.

Files to change: `app.js`, `index.html`, `styles.css`

---

## 4.4 Notification Preferences Per User

### Database
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB
DEFAULT '{"email": true, "push": true, "quiet_from": "22:00", "quiet_to": "07:00"}';
```

### UI in Settings
- Toggle: Email reminders on/off
- Toggle: Push notifications on/off
- Quiet hours: from/to time picker
- "Send a test notification" button

### Logic in /api/remind.js
Check user's `notification_prefs` before sending.
Respect quiet hours by comparing UTC time of reminder to user's local quiet window
(store timezone in profiles too).

### Acceptance criteria
- [ ] User can disable email but keep push (or vice versa)
- [ ] Reminder at 23:00 suppressed if quiet hours are 22:00-07:00
- [ ] Test notification button works from settings
