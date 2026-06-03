before commiting always check if the change has been done and if it works

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
- `index.html` - main HTML shell
- `app.js` - all app logic
- `styles.css` - all styles
- `features.js` - shopping and extra features
- `supabase-data.js` - Supabase data layer
- Cache-busting via version query strings on script/link tags (e.g. `app.js?v=20260603-fix`)
- Always bump the version string in `index.html` when changing `app.js` or `styles.css`

## Supabase

Backend is Supabase. Environment variables are set in Vercel dashboard (not in the repo).