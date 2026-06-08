# Do-Do

Family coordination app. Live at **https://do-do.app**

## Deploy

```bash
git add -A
git commit -m "your message"
git push origin main
```

Vercel auto-deploys from `main`. No build step required.

If push fails with auth error, update the remote token:
```bash
git remote set-url origin https://YOUR_TOKEN@github.com/bartgumowski/do-do-poc.git
```

Generate tokens at: GitHub → Settings → Developer settings → Personal access tokens (classic) → scope: `repo`

## File overview

| File | Purpose |
|---|---|
| `index.html` | App shell and dialog HTML |
| `app.js` | All app logic, state, card dialog, auth, Supabase |
| `features.js` | Calendar, shopping, expenses, messages, settings modules |
| `styles.css` | All styles |
| `supabase-data.js` | Supabase data layer |
| `sw.js` | Service worker (PWA offline cache) |
| `legal.html` | Public legal page |

## URL routes

| URL | View |
|---|---|
| `/#board` | Coordination board |
| `/#calendar` | Shared family calendar |
| `/#messages` | Topic threads |
| `/#shopping` | Shopping list |
| `/#expenses` | Expenses tracker |
| `/#settings` | Settings and integrations |

## Tech stack

- Vanilla JS, no framework, no build step
- Supabase for auth and data (env vars set in Vercel dashboard)
- Google Calendar integration via automation settings
- PWA with offline read cache

## Security

Only the public Supabase anonymous key is in frontend code. Never commit service-role keys, `.env.local`, or GitHub tokens to the repo.
