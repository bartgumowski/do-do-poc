#!/bin/bash
set -e
cd "$(dirname "$0")"
find .git -name "*.lock" -delete
git stash
git pull origin main
git stash pop
git add -A
git commit -m "feat: two-column calendar layout on desktop (day panel left, grid right) v0.9.8"
git push origin main
rm -- "$0"
echo "Done!"
