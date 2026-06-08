before commiting always check if the change has been done and if it works

## REQUIRED: Bump version on every push

In `app.js` lines 1-2, update BOTH constants before every single commit:

```js
const APP_VERSION = "0.6.x";          // increment patch or minor
const APP_VERSION_DATE = "YYYY-MM-DD"; // today's date
```

The version is shown prominently in Settings (dark pill badge + date) so Bart can always identify which build he is reviewing. This must not be skipped.

Version format: MAJOR.MINOR.PATCH
- Increment MINOR for each completed release segment (SEG-xx)
- Increment PATCH for hotfixes, small additions, and polish pushes

Current: v0.6.2 (2026-06-08)

## CRITICAL: Curly quote bug - check before every commit

**This has happened repeatedly and breaks the entire app silently.**

When Claude edits `index.html` using the Edit tool, curly/smart quotes (`"` `"`, U+201C/U+201D) can get inserted in place of straight double quotes in HTML attribute values. This breaks `document.querySelector('#someId')` because the browser parses the attribute value as `"someId"` (with literal quote characters) instead of `someId`.

**Symptom:** Card popup won't open, clicking cards does nothing, console shows `Cannot set properties of null`.

**After every edit to `index.html`, run this check before committing:**
```bash
python3 -c "
with open('index.html', 'rb') as f: c = f.read()
n = c.count('“'.encode('utf-8')) + c.count('”'.encode('utf-8'))
print(f'Curly quotes found: {n} - ', 'PROBLEM - fix before committing!' if n else 'OK')
"
```

**Fix if found:**
```bash
python3 -c "
with open('index.html', 'rb') as f: c = f.read()
c = c.replace('“'.encode('utf-8'), b'\"').replace('”'.encode('utf-8'), b'\"')
with open('index.html', 'wb') as f: f.write(c)
print('Fixed')
"
```

## Deployment setup

**Live app:** https://do-do.app
**Vercel project:** `do-do` (under dzwiad-1164s account)
**GitHub repo that auto-deploys:** `bartgumowski/do-do-poc` (NOT `bartgumowski/do-do`)

The local git remote must point to `do-do-poc` for Vercel to pick up changes:
```
git remote set-url origin https://TOKEN@github.com/bartgumowski/do-do-poc.git
```

**To deploy:** commit changes then `git push`. Vercel auto-deploys from `do-do-poc/main` branch.

**GitHub token:** stored in `.env.local` (gitignored). Bart generates classic tokens at
github.com -> Settings -> Developer settings -> Personal access tokens -> Tokens (classic).
Scope needed: `repo` only. Token goes in the remote URL as shown above.

**Warning:** `bartgumowski/do-do` is a separate repo NOT connected to Vercel - pushing there does nothing.

## Tech stack

- Vanilla JS single-page app (no framework, no build step)
- `i18n.js` - translation engine (EN/DE/PL), loaded first - `window.t()`, `window.setLanguage()`
- `index.html` - app shell, all dialogs, data-i18n attributes
- `app.js` - all app logic, state, card dialog, auth, board render
- `features.js` - calendar, shopping, expenses, messages, settings modules
- `styles.css` - all styles
- `supabase-data.js` - Supabase data layer (cards, shopping, messages, auth, presence)
- `sw.js` - service worker (PWA cache, push, background sync)
- `api/*.js` - Vercel serverless functions (Node 18, CommonJS)
- Cache-busting via version query strings: `i18n.js?v=...`, `app.js?v=...`, `features.js?v=...`
- Bump `APP_VERSION` + `APP_VERSION_DATE` in `app.js` on EVERY push (shown in Settings)

## Supabase

Backend is Supabase. Environment variables are set in Vercel dashboard (not in the repo).