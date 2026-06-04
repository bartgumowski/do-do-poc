# SEG-06 - Expense Payment Flow

**Priority:** Important differentiator - reduces friction of expense reimbursement
**Status:** Not started (expenses tracked as cards, no money movement)
**Estimated effort:** 3-4 days
**Depends on:** SEG-05 (Stripe already integrated)

---

## 6.1 Expense Payment Request

### Problem
Expense cards track amounts but there's no way to actually request or send money.
Co-parents currently have to use Venmo/Twint/bank transfer separately.

### Flow
1. Parent A adds expense card: "Dentist CHF 85.00"
2. A clicks "Request CHF 42.50 from Art" (half by default, adjustable)
3. Stripe Payment Intent created for CHF 42.50
4. Payment link sent to Art via email + shown in app
5. Art pays via card / Apple Pay / Google Pay in browser
6. Card status updated to "Paid", comment added "Art paid CHF 42.50"

### New Vercel function: /api/stripe-expense-payment.js
```js
// Input: { cardId, amount, currency, fromUserId, toUserId, description }
// Creates Stripe Payment Intent
// Returns: { paymentUrl, intentId }
// currency: 'chf' | 'eur' | 'pln' | 'usd'
```

### Database
```sql
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_status TEXT
  CHECK (payment_status IN ('none', 'pending', 'paid', 'disputed'));
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2);
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_paid_by UUID
  REFERENCES auth.users(id);
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ;
```

### UI in card dialog (app.js / index.html)
For expense cards with an amount set:
```
[Request payment] button in card dialog
→ Opens payment panel:
  Amount: CHF [42.50] (pre-filled with half)
  Split: [50/50 ▼] (50/50, 60/40, 100% them, 100% me)
  [Send payment request]
```

After request sent:
- Button changes to "CHF 42.50 requested - awaiting payment"
- Co-parent sees "Art owes you CHF 42.50" chip on the card

---

## 6.2 Apple Pay / Google Pay on Expense Payment

Stripe Payment Element (not Checkout) embedded inline for expense payment.

### Approach
Payment link from 6.1 opens a minimal Vercel-served page (`/pay/:intentId`)
with Stripe Payment Element that shows:
- Apple Pay button (Safari)
- Google Pay button (Chrome)
- Card form fallback

No app login required for the payment page - just the payment.

### New page: /pay/[intentId] (or /api/expense-pay.js returning HTML)
Simple HTML page with Stripe.js embedded.
On success → redirect to `do-do.app/#board` with success param.

---

## 6.3 Receipt Upload

### Problem
No way to attach a receipt photo to an expense card.

### Implementation
Supabase Storage bucket: `receipts` (private, RLS by family_id)

```js
// In app.js, expense card dialog:
async function uploadReceipt(file, cardId) {
  const path = `${currentFamilyId}/${cardId}/${file.name}`;
  const { data, error } = await window.supabaseClient.storage
    .from('receipts')
    .upload(path, file, { upsert: true });
  if (data) {
    // Save URL to card
    updateCardField(cardId, 'receipt_url', data.path);
  }
}
```

Add to `unified_cards`:
```sql
ALTER TABLE public.unified_cards ADD COLUMN IF NOT EXISTS receipt_url TEXT;
```

UI: Camera/upload icon on expense cards. Thumbnail preview in card dialog.

### Optional: Claude Vision OCR
When receipt is uploaded, call Claude Vision via `/api/interpret`:
- Extract amount automatically
- Extract merchant name
- Pre-fill card title if empty

---

## 6.4 Expense Split Tracking

### Problem
No running balance - parents lose track of who owes what over time.

### Implementation
Add "Balance" view to Expenses module in features.js:
- Compute running total from all expense cards with amounts and payment_status
- Show "Art owes you CHF 120.50" or "You owe Art CHF 45.00"
- List of settled and unsettled expenses

```js
function computeBalance(cards) {
  const myName = getMyName();
  let balance = 0; // positive = other owes me, negative = I owe other
  cards.filter(c => c.type === 'Expense' && c.amount).forEach(card => {
    const amt = parseFloat(card.amount) || 0;
    if (card.assignee === myName) balance += amt / 2; // they owe half
    if (card.payment_status === 'paid') balance = 0; // settled
  });
  return balance;
}
```

### Acceptance criteria for all of 6.x
- [ ] Expense card shows "Request payment" button
- [ ] Co-parent receives payment link via email
- [ ] Payment completes via Apple Pay or card
- [ ] Card status updates to Paid automatically via Stripe webhook
- [ ] Receipt photo uploads and is visible to both parents
- [ ] Balance summary shows correct running total
