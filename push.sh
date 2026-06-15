#!/bin/bash
set -e
cd "$(dirname "$0")"
find .git -name "*.lock" -delete 2>/dev/null || true
git add app.js features.js i18n.js index.html
git commit -m "fix: rename przekaz.* i18n keys to handover.* and add missing translations v0.17.1"
git push origin main
echo "Pushed v0.17.1"
