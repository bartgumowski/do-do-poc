before commiting always check if the change has been done and if it works and does not break anything else 

## REQUIRED: Bump version on every push

In `app.js` lines 1-2, update both constants before every commit:

```js
const APP_VERSION = "0.6.x";      // increment patch or minor
const APP_VERSION_DATE = "YYYY-MM-DD";  // today's date
```

Version is displayed prominently in Settings so Bart can always identify what build he is reviewing.
Version format: MAJOR.MINOR.PATCH - increment MINOR for each completed segment, PATCH for fixes/small additions.

Current: v0.7.1 (2026-06-10)
