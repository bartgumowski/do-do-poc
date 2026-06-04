# SEG-07 - Real-time & Sync

**Priority:** Medium-high - broken sync causes trust issues between co-parents
**Status:** Partial (cards sync in real-time; shopping list, messages don't)
**Estimated effort:** 2-3 days

---

## 7.1 Shopping List to Supabase

### Problem
Shopping list uses localStorage only. When one parent checks off "Milk",
the other parent has no idea and may buy it again.

The database table and RLS policies already exist in `supabase-shopping.sql`.
The SQL just needs to be run, and the frontend needs to be wired up.

### Step 1: Run the SQL
```
supabase.com/dashboard/project/vkafktcrhrmehruiqjni/sql
→ paste contents of supabase-shopping.sql
→ Run
```

### Step 2: Wire up features.js shopping module

**Load from Supabase on mount:**
```js
async function loadShoppingItems() {
  const { data } = await window.supabaseClient
    .from('shopping_items')
    .select('*')
    .order('created_at');
  // Replace localStorage data with Supabase data
  shoppingLists = groupByList(data);
  renderShoppingFeature();
}
```

**Subscribe to real-time changes:**
```js
window.supabaseClient
  .channel('shopping')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'shopping_items',
    filter: `family_id=eq.${currentFamilyId}`
  }, () => loadShoppingItems())
  .subscribe();
```

**Write changes back:**
```js
async function addShoppingItem(list, name) {
  await window.supabaseClient.from('shopping_items').insert({
    family_id: currentFamilyId,
    created_by: currentAuthSession.user.id,
    list, name,
  });
  // Real-time subscription will trigger re-render
}

async function toggleShoppingItem(id, checked) {
  await window.supabaseClient.from('shopping_items').update({
    checked,
    checked_by: checked ? currentAuthSession.user.id : null,
    checked_at: checked ? new Date().toISOString() : null,
  }).eq('id', id);
}
```

### Acceptance criteria
- [ ] Parent A adds "Oat milk" → Parent B sees it within 2 seconds
- [ ] Parent B checks off "Dishwasher tabs" → Parent A sees it checked immediately
- [ ] List persists across app restarts (loaded from Supabase, not localStorage)
- [ ] Items show who checked them off and when

---

## 7.2 Messages Module - Real Threads

### Problem
The Messages module (`features.js` `renderMessagesFeature()`) renders static mockup
HTML with fake hardcoded threads. Real card comments exist in Supabase but
are only accessible from individual card dialogs, not from the Messages view.

### What it should do
Each topic channel (Schedule, School, Medical, Expenses, General) shows:
- All cards in that topic, sorted by last comment
- Latest comment preview per card
- Unread indicator if co-parent added a comment since you last viewed

### Implementation in features.js
```js
function renderMessagesFeature(data) {
  const cards = state.cards.filter(c => c.comments?.length > 0);
  const byTopic = {};
  cards.forEach(card => {
    if (!byTopic[card.topic]) byTopic[card.topic] = [];
    byTopic[card.topic].push(card);
  });
  // Render topic tabs and card thread list
  // Clicking a card opens the card dialog at the comments section
}
```

### Unread tracking
Add `last_viewed_at` per card per user in localStorage (or Supabase).
Comment is "unread" if `comment.time > last_viewed_at` and author != me.

---

## 7.3 Presence Indicators

### Problem
No way to know if the co-parent is currently looking at the same card.
Leads to duplicate edits and "I already changed that" moments.

### Implementation
Supabase Realtime Presence (built into the existing channel).

```js
// In app.js, when card dialog opens:
function broadcastCardPresence(cardId) {
  if (!realtimeChannel) return;
  realtimeChannel.track({
    user_id: currentAuthSession.user.id,
    display_name: getMyName(),
    viewing_card: cardId,
  });
}

// Subscribe to presence state:
realtimeChannel.on('presence', { event: 'sync' }, () => {
  const state = realtimeChannel.presenceState();
  updatePresenceIndicators(state);
});
```

In card dialog header, show:
"Art is also viewing this" when co-parent has same card open.

### Acceptance criteria
- [ ] Opening a card that co-parent already has open shows their name
- [ ] Indicator disappears when co-parent closes the card
- [ ] No impact on performance (presence is lightweight)

---

## 7.4 Background Sync (Offline Cards)

### Problem
If user creates a card while offline, the Supabase save silently fails
and the card is lost when the page reloads.

### Current state
Cards are saved to localStorage first, then Supabase.
If Supabase save fails, card stays in localStorage but is not synced.

### Fix: Service Worker Background Sync
Register a sync event when Supabase save fails:

```js
// In app.js saveCard(), if Supabase save fails:
async function syncCardWithRetry(card) {
  try {
    await window.saveCardToSupabase(card);
  } catch {
    // Queue for background sync
    const queue = JSON.parse(localStorage.getItem('sync-queue') || '[]');
    queue.push(card);
    localStorage.setItem('sync-queue', JSON.stringify(queue));
    // Register background sync
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('sync-cards');
  }
}
```

In `sw.js`:
```js
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cards') {
    event.waitUntil(syncQueuedCards());
  }
});
```

### Acceptance criteria
- [ ] Create card offline → card saved to localStorage with "pending sync" marker
- [ ] When connection returns → card syncs to Supabase automatically
- [ ] No duplicate cards created during sync
