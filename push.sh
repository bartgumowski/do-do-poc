#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock .git/HEAD.lock
git add -A
git commit -m "Push notifications: browser Notification API + SW handler + reminder checker

- app.js: requestNotificationPermission(), startReminderChecker(), checkDueReminders(), fireNotification()
- Checker runs every 60s, fires within 90s window of reminder time, deduped by card id
- Permission requested on app load and when user enables reminders
- sw.js: push + notificationclick handlers, cache v7"
git push origin main
rm -f push.sh
