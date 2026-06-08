#!/bin/bash
# deploy.sh - Universal deploy script for Do-Do
# Usage: ./deploy.sh "your commit message" [file1 file2 ...]
# If no files given, stages all tracked changes (git add -A).
# Always bumps ?v= cache strings in index.html and APP_VERSION in app.js.

set -e
cd "$(dirname "$0")"

MSG="${1:-"Deploy $(date +%Y-%m-%d)"}"
shift || true   # remaining args are optional extra files to stage

# ─── Clean stale git locks ────────────────────────────────────────────────────
rm -f .git/index.lock .git/HEAD.lock .git/refs/remotes/origin/main.lock 2>/dev/null || true

# ─── Bump cache-busting version string ───────────────────────────────────────
DATE=$(date +%Y%m%d)
DATETIME=$(date +%Y%m%d-%H%M)

# Bump ?v= strings in index.html for app.js, features.js, styles.css, supabase-data.js
sed -i '' \
  -e "s/app\.js?v=[0-9A-Za-z_-]*/app.js?v=${DATETIME}/g" \
  -e "s/features\.js?v=[0-9A-Za-z_-]*/features.js?v=${DATETIME}/g" \
  -e "s/styles\.css?v=[0-9A-Za-z_-]*/styles.css?v=${DATETIME}/g" \
  -e "s/supabase-data\.js?v=[0-9A-Za-z_-]*/supabase-data.js?v=${DATETIME}/g" \
  index.html

# Bump APP_VERSION_DATE in app.js
sed -i '' "s/const APP_VERSION_DATE = \"[^\"]*\"/const APP_VERSION_DATE = \"${DATE}\"/" app.js

echo "Version bumped to ${DATETIME}"

# ─── Curly quote check ────────────────────────────────────────────────────────
python3 -c "
files = ['index.html', 'app.js', 'features.js', 'styles.css', 'supabase-data.js']
fail = False
for f in files:
    try:
        with open(f, 'rb') as fh: c = fh.read()
        n = c.count('"'.encode('utf-8')) + c.count('"'.encode('utf-8'))
        if n:
            print(f'CURLY QUOTES in {f}: {n} found - fix before committing!')
            fail = True
    except FileNotFoundError:
        pass
if fail:
    exit(1)
print('Curly quote check: OK')
"

# ─── Stage files ──────────────────────────────────────────────────────────────
if [ $# -gt 0 ]; then
  git add index.html app.js "$@"
else
  git add -A
fi

# ─── Commit and push ──────────────────────────────────────────────────────────
git commit -m "$MSG"
git push origin main

echo ""
echo "Done. Vercel deploys in ~30s - https://do-do.app"
