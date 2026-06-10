#!/bin/bash
cd "$(dirname "$0")"

# Remove stale git lock
rm -f .git/index.lock

# Stage all SEG-04 changes
git add api/push-subscribe.js seg04-notifications.sql api/remind.js app.js features.js index.html styles.css vercel.json

# Commit
git commit -m "SEG-04: notifications - cron, web push, permission UI, quiet hours prefs

- vercel.json: add /api/remind cron every 15 min (requires Vercel Pro)
- api/push-subscribe.js: new endpoint to save/remove VAPID push subscriptions
- api/remind.js: web push via web-push lib, notification_prefs, quiet hours
- app.js: subscribeToPush(), unsubscribeFromPush(), initNotifications(), contextual permission prompt
- features.js: renderNotifPrefsPanel() - email/push toggles, quiet hours, test button
- index.html: notif-prompt banner, VAPID public key config, script version bump
- styles.css: notif-prompt styles, toggle-switch component
- seg04-notifications.sql: push_subscriptions table + profiles.notification_prefs column"

# Push to prod
git push origin main

echo ""
echo "Done. Vercel will deploy in ~30s."
echo ""
echo "Manual steps still needed:"
echo "1. Run seg04-notifications.sql in Supabase SQL editor"
echo "2. Add to Vercel env vars:"
echo "   VAPID_PUBLIC_KEY  = BI9wJDPhoEc2sBl39VZ-VFJMJz-EpmwmVI7Y3Zgkk1ECwE3dQQb5O6y_BK0Lr0egl_X17c_l3W6S0EksSubbj2M"
echo "   VAPID_PRIVATE_KEY = SEpkzqlDK5fCULi9Fv11kS9nzdfcqH_4hywgsIKojOU"
echo "   VAPID_SUBJECT     = mailto:bart@do-do.app"
echo "   (RESEND_FROM_EMAIL = reminders@do-do.app  - if not already set)"
echo "3. Upgrade Vercel to Pro for cron support (vercel.com/account/billing)"
