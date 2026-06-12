#!/bin/bash
set -e
cd "$(dirname "$0")"
find .git -name "*.lock" -delete 2>/dev/null || true
git add app.js features.js styles.css i18n.js index.html \
        supabase-data.js api/export-data.js api/stripe-webhook.js \
        seg16-expense-ledger.sql CLAUDE.md
git commit -m "feat: SEG-16 expense court records - append-only ledger, payment history panel, PDF + CSV export v0.11.3"
git push origin main
echo "Pushed v0.11.3 (SEG-16)"
