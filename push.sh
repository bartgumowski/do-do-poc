#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock .git/HEAD.lock
git add -A
git commit -m "Reminders via Google Calendar alerts, not browser Notification API

- pushCardToFamilyCalendar now accepts reminderMinutes and sets reminders.overrides on the GCal event
- Alert timing comes from defaultReminderPreset in automation settings (e.g. 60 min before)
- Removed browser Notification polling (checkDueReminders / fireNotification / interval)
- presetToMinutes() helper added to app.js
- initNotifications / requestNotificationPermission are now no-ops"
git push origin main
rm -f push.sh
