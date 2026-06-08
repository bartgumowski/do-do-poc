# SEG-03 - AI - Replace Regex with Claude

**Priority:** High - regex breaks on real-world input constantly
**Status:** Done
**Estimated effort:** 2-3 days
**Depends on:** Nothing (interpret endpoint is already deployed)

---

## 3.1 Wire /api/interpret into the main card form

### Problem
`deriveFieldsFromShortInfo()` in `app.js` uses regex for all field extraction.
The `/api/interpret` Claude endpoint already handles all these fields better,
but it was only called from the old LLM two-step flow that was removed.

### Current regex weaknesses
- Date parsing: fails on "the Friday after next", "in two weeks", Polish/Swiss date formats
- Reminder: fails on "morning of", "the night before", "two and a half hours before"
- Assignee: misses "can you handle this" (→ co-parent), "I'll sort it" (→ current user)
- Amount: misses "costs about fifty francs", "reimbursement of 45.–"

### Implementation

**In `app.js` `deriveFieldsFromShortInfo()`:**
1. Keep regex as instant local preview (fires immediately as user types)
2. After 800ms debounce, call `/api/interpret` with the text
3. Merge AI result over the regex result - AI wins on any field it provides

```js
let _interpretTimer = null;
function deriveFieldsFromShortInfo(rawText, options = {}) {
  // ... existing regex logic as before (instant preview) ...

  // After regex, schedule AI interpretation
  if (!options.noAI && rawText.trim().length > 8) {
    clearTimeout(_interpretTimer);
    _interpretTimer = setTimeout(() => callAiInterpret(rawText), 800);
  }
}
```

**`callAiInterpret()` already exists in `app.js`** - just needs to be called from here.

### /api/interpret response fields to use
The endpoint already returns: `title`, `topic`, `type`, `status`, `due`, `amount`,
`assignee`, `child`, `details`. Wire all of these into the form fields.

Add `reminderMinutes` to the prompt and response:
```
"reminderMinutes": integer or null - if text mentions a reminder time, minutes before due date
```

### Acceptance criteria
- [ ] "Pick up Leo from school tomorrow at 15:30, remind me 2 hours before" → all fields correct
- [ ] "Filip flight Friday 16:00 3h before" → due=Friday 16:00, reminder=180min
- [ ] "Dentist invoice 85 CHF, Art to reimburse" → amount=85, assignee=Parent B, topic=Expenses
- [ ] Regex still fires instantly for visual feedback; AI result applies within ~1s
- [ ] No API call made for very short text (< 8 chars)

---

## 3.2 AI Reminder Extraction

### Problem
`inferReminderFromText()` regex handles "2h before", "1 day before" but misses:
- "morning of the appointment"
- "remind us both"
- "night before"
- "two and a half hours early"
- Reminders relative to a specific time ("30 min before the 15:00")

### Fix
Add `reminderMinutes` and `reminderAbsolute` to the `/api/interpret` prompt:

```
"reminderMinutes": if text mentions reminder relative to due time, return minutes as integer.
  Examples: "2 hours before" → 120, "morning of" → 480 (8am same day), "night before" → 720 (12h before)
"reminderAbsolute": ISO datetime string if reminder is at a specific time ("remind me at 9am Thursday")
```

In `app.js`, after AI result arrives, apply reminder:
```js
if (fields.reminderMinutes != null) {
  setSelectValue(elements.cardReminderPresetInput, String(fields.reminderMinutes));
  if (due) elements.cardReminderTimeInput.value =
    buildReminderTime({ due }, String(fields.reminderMinutes));
  updateReminderCustomVisibility();
}
if (fields.reminderAbsolute) {
  elements.cardReminderPresetInput.value = 'custom';
  elements.cardReminderTimeInput.value = toDateTimeInputValue(new Date(fields.reminderAbsolute));
  updateReminderCustomVisibility();
}
```

### Acceptance criteria
- [ ] "Remind us both the night before" → reminder=720min (12h before)
- [ ] "Morning of the appointment" → reminder=~480min (8am day-of)
- [ ] "Remind me at 14:00 on Thursday" → custom reminder set to Thursday 14:00
- [ ] "Remind Art 30 minutes before" → reminder=30min, assignee=Parent B

---

## 3.3 AI Recurring Event Detection

### Problem
Text like "every Friday", "alternate weekends", "weekly football practice"
should auto-populate the recurrence picker (see SEG-02 task 2.4).

### Add to /api/interpret prompt
```
"recurrence": object or null. If text implies recurring event:
  { "freq": "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
    "days": ["MO","TU","WE","TH","FR","SA","SU"] or null,
    "interval": integer (1=every, 2=every other),
    "pattern": "2-2-3" | "week-on-off" | null }
```

### Acceptance criteria
- [ ] "Every Friday pickup" → recurrence={freq:WEEKLY, days:[FR]}
- [ ] "Alternate weekends with Ava" → recurrence={freq:BIWEEKLY, days:[SA,SU]}
- [ ] "Football practice every Tuesday and Thursday" → recurrence={freq:WEEKLY, days:[TU,TH]}
- [ ] One-off events return recurrence=null

---

## 3.4 AI Conflict Suggestion

### Problem
When a conflict is detected (SEG-02 task 2.5), show a Claude-generated
plain-language resolution suggestion, not just a raw flag.

### New Vercel function: /api/suggest-resolution.js
```js
// Input: two conflicting card objects
// Output: { suggestion: "Consider moving the dentist to Thursday - Leo has football Tuesday at 16:00." }
```

Prompt to Claude:
```
Two family events conflict. Suggest a one-sentence practical resolution.
Event A: [title, time, child, assignee]
Event B: [title, time, child, assignee]
Be specific. Suggest moving one of them. Max 20 words.
```

### In app.js
Call after conflict is detected, show suggestion in conflict banner.
Cache the suggestion per conflict pair (don't re-call on every render).

### Acceptance criteria
- [ ] Conflict banner shows AI suggestion, not just "these overlap"
- [ ] Suggestion references actual event titles and times
- [ ] No API call if conflict pair suggestion already cached
