#!/bin/bash
cd "$(dirname "$0")"

rm -f .git/index.lock .git/HEAD.lock .git/refs/remotes/origin/main.lock 2>/dev/null

git add \
  seg07-realtime-sync.sql \
  features.js \
  app.js \
  supabase-data.js \
  styles.css \
  CHANGELOG.md

git commit -m "SEG-07 + SEG-08: Shopping delete/clear, invite children names, parent name edit, Supabase sync

SEG-07 - Real-time sync:
- features.js: shopping delete button (x) per item + Clear bought (N) button per group
  Wired to deleteShoppingItem (Supabase) or localStorage fallback
- styles.css: .shopping-row-wrap, .shopping-delete-btn, .shopping-clear-btn
- seg07-realtime-sync.sql: messages_v2 table + RLS, shopping_items (idempotent),
  enables Realtime publication on both tables

SEG-08 - Onboarding polish:
- supabase-data.js: lookupInviteToken joins children table -> returns childrenNames[]
- supabase-data.js: updateProfile(displayName) updates profiles.display_name + first_name
- app.js: invite screen shows children names 'Bart invited you to coordinate for Ava and Leo'
- features.js: 'Your profile' section in Settings with editable display name
  Saves to Supabase profiles via updateProfile + localStorage
  Co-parent local name editing
  promptEditChild + confirmDeleteChild now sync to Supabase via saveChildrenToSupabase
  renderInvitePanel recovers invite link from pairs table when sessionStorage is empty"

git push origin main

echo ""
echo "Done. Vercel deploys in ~30s."
echo ""
echo "Manual step:"
echo "Run seg07-realtime-sync.sql in Supabase SQL editor to create shopping_items + messages_v2 tables."
