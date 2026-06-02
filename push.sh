#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock .git/HEAD.lock
git add -A
git commit -m "Settings: real children/pets with add, edit, delete

- renderSettingsFeature() replaces static placeholder data
- Children and pets pulled live from onboarding state
- Edit (pencil) and delete (trash) buttons per row
- Add child saves to Supabase + local state
- Edit/delete update local state and re-render
- icon-button + feature-item-editable CSS added
- feature-empty state for empty lists"
git push origin main
rm -f push.sh
