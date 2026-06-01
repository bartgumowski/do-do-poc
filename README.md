# Do-Do Production Export

Static production bundle for the Do-Do web app.

## Publish with Git

```bash
git init
git add .
git commit -m "Publish Do-Do static app"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

## Publish with Vercel

From this folder:

```bash
npx vercel --prod
```

The app is static. No build command or output directory is required.

## Public Files

- `index.html`: app entry point
- `styles.css`: application styles
- `app.js`: application and Supabase authentication logic
- `features.js`: prototype feature logic
- `legal.html`: public legal clauses
- `manifest.webmanifest`, `sw.js`: PWA files
- `assets/`: public app artwork

Only the public Supabase anonymous key is included in frontend code. Do not add service-role keys, private environment files, internal reviews, or roadmap documents to this folder.
