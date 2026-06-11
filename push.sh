#!/bin/bash
set -e
cd "$(dirname "$0")"
find .git -name "*.lock" -delete 2>/dev/null || true
git add app.js features.js styles.css i18n.js
git commit -m "fix: sync strip uses system button style, Polish 'Nowe zadanie' -> 'Dodaj Do' everywhere v0.10.2"
git push origin main
echo "Pushed v0.10.2"
