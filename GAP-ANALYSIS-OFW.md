# Gap Analysis: Do-Do vs OurFamilyWizard (OFW)
*Generated 2026-06-10*

---

## Summary

Do-Do and OFW overlap significantly on calendar, expenses, and messaging. OFW's moat is legal defensibility - immutable records, court-admissible exports, practitioner access. Do-Do's edge is UX speed (kanban + AI NLP), price, and everyday utility (shopping list, task coordination). The two products are targeting slightly different pain levels: OFW serves high-conflict/legal-risk co-parents, Do-Do targets everyday coordination for any two people sharing responsibilities.

---

## Pricing Comparison

| | Do-Do | OurFamilyWizard |
|---|---|---|
| Billing unit | Per pair | Per parent (x2) |
| Entry price | CHF 9.90/mo (pair) | ~$18.34/mo (both parents on Basic) |
| Mid tier | CHF 89/yr (pair) | $29.99/mo (both on Essentials) |
| Top tier | - | $49.98/mo (both on Max) |
| Trial | 14 days free | 30-day money-back |
| Free plan | 10 cards | None |

**Do-Do is ~3-5x cheaper for equivalent functionality.** OFW charges each parent separately - a key friction point.

---

## Feature Matrix

### Communication

| Feature | Do-Do | OFW |
|---|---|---|
| Threaded messages by topic | Yes (5 fixed topics) | Yes (free-form) |
| Message immutability / audit trail | No - messages can be deleted | Yes - messages cannot be edited or deleted, first-viewed timestamps |
| AI tone moderation (ToneMeter equivalent) | No | Yes - flags aggressive language |
| AI writing assistant (rewrite calmly) | No | Yes - suggests neutral rewrites |
| AI conflict resolution suggestion | Yes - suggests resolution on conflicting cards | No equivalent |
| Real-time sync | Yes | Yes |
| Documented video/audio calls | No | Yes (45 min/mo on Essentials, unlimited on Premium) |
| Call recordings + transcriptions | No | Yes (Max plan only) |

### Calendar & Scheduling

| Feature | Do-Do | OFW |
|---|---|---|
| Shared calendar | Yes | Yes |
| Custody schedule (7-7, 2-2-3, 5-2 etc.) | Yes - with per-day overrides and handover times | Yes |
| Parenting time change requests (formal) | No | Yes - one-click request workflow |
| Google Calendar sync (2-way) | Yes | No |
| Apple CalDAV sync | Yes | No |
| Week overview strip | Yes | No |
| Split day / handover time display | Yes | No |

### Expenses

| Feature | Do-Do | OFW |
|---|---|---|
| Expense tracking | Yes | Yes |
| Receipt upload | Yes | Yes |
| Electronic payment requests | Yes (Stripe, Apple Pay, Google Pay) | Yes (OFWpay) |
| Balance summary (who owes what) | Yes | Yes |
| Custom split ratios | Yes (50/50, 60/40, 100%) | Yes (based on child support agreement) |

### Task / Decision Management

| Feature | Do-Do | OFW |
|---|---|---|
| Kanban board (To decide / Mine / Done) | Yes | No |
| Card types (task, event, appointment, expense, medical, vaccine) | Yes | No |
| AI NLP input (natural language -> structured card) | Yes (Claude Haiku) | No |
| Assignee / "who's responsible" | Yes | No |
| Due dates + reminders | Yes | Yes (calendar events) |
| Recurring events | Yes | Yes |

### Documentation & Legal

| Feature | Do-Do | OFW |
|---|---|---|
| Immutable message log (court-admissible) | No | Yes |
| PDF record downloads (certified) | No | Yes (unlimited on Premium+) |
| Business records affidavit support | No | Yes |
| Subpoena response process | No | Yes |
| GPS-verified check-ins (at exchanges) | No | Yes (Journal feature) |
| Practitioner / lawyer / mediator access | No | Yes (free accounts for professionals) |
| Child accounts (read access) | No | Yes (free) |
| Third-party accounts (caregivers, grandparents) | No | Yes (free) |

### Information Storage

| Feature | Do-Do | OFW |
|---|---|---|
| Info Bank (medical, school, insurance, contacts) | Partial - cards with Medical type, no structured DB | Yes - full Info Bank with organized sections |
| File/photo storage | Receipt photos only | 1-5 GB general file storage |
| Vaccine tracker | Yes (vaccine card type) | No explicit feature |

### Journal / Observations

| Feature | Do-Do | OFW |
|---|---|---|
| Journal / Moments (diary-style entries) | No | Yes |
| GPS check-ins at exchanges | No | Yes |

### Platform & UX

| Feature | Do-Do | OFW |
|---|---|---|
| Shopping list | Yes (real-time sync) | No |
| Real-time presence indicators | Yes | No |
| PWA / offline support | Yes | No |
| Native iOS / Android | Planned (SEG-12) | Yes |
| Dark mode | Yes | Unknown |
| Languages | EN / DE / PL | EN, ES, FR + more |
| GDPR data export (JSON) | Yes | No (PDF records only) |
| GDPR account deletion | Yes | Unknown |

---

## Where Do-Do Wins

1. **Price** - 3-5x cheaper, pair-based billing is fairer and simpler
2. **Kanban board** - unique task/decision management layer OFW doesn't have
3. **AI NLP input** - type anything in natural language, AI extracts all fields
4. **External calendar sync** - Google + Apple integration, not a walled garden
5. **Shopping list** - everyday utility OFW ignores
6. **Custody calendar detail** - per-day overrides, handover times, split-day display
7. **Real-time presence** - see if co-parent is in the same card
8. **GDPR / data portability** - JSON export, full account deletion
9. **Cheaper onboarding** - one partner invites the other, no double billing on first contact

---

## Where OFW Wins (Gaps to Address)

### Critical gaps (OFW's core moat)

1. **Immutable message log** - messages in Do-Do can be deleted; OFW records cannot. This is the #1 reason high-conflict co-parents pay for OFW. Without it, Do-Do is not court-safe.
   - *Mitigation path: add "lock" mode per message thread, or use Supabase RLS to prevent deletes after first-view timestamp is set*

2. **Certified PDF exports / court-admissible records** - OFW can produce certified records for court. Do-Do only exports JSON.
   - *Mitigation path: add PDF export with timestamp signatures and hash verification (SEG-09 partial)*

3. **Practitioner / court access** - lawyers and mediators can connect to their client's OFW account. Major referral channel for OFW.
   - *Mitigation path: read-only observer account type, scoped to specific modules*

### High-value gaps

4. **Video/audio calls** - documented calling between parent and child. Useful for virtual visitation and creates an additional record trail.
   - *Mitigation path: integrate a third-party call SDK (Daily.co, Twilio) with logging*

5. **GPS check-ins at exchanges** - prove you were at the pickup location on time. Legal protection.
   - *Mitigation path: a simple "Check in" button that logs GPS coordinates + timestamp to Supabase*

6. **AI tone assistant on messages** - OFW's ToneMeter/Writing Assistant is now a marketing differentiator. Do-Do has AI for card creation but not message tone.
   - *Mitigation path: run Claude Haiku on outgoing message text, show tone warning + suggested rewrite*

7. **Info Bank** - structured family data store (medical history, insurance numbers, school contacts, emergency numbers). High everyday utility.
   - *Mitigation path: add an "Info" module with key-value sections per child; lower effort than it sounds*

8. **Parenting time change requests** - formal workflow (request -> confirm/deny -> log). OFW has this; Do-Do just has the calendar.
   - *Mitigation path: card type "Schedule change request" with accept/decline actions*

### Lower priority gaps

9. **Child / third-party accounts** - OFW lets children and caregivers have limited read access. Useful but complex to build safely.

10. **Call recordings + transcriptions** - OFW Max tier. Niche but valuable for high-conflict situations.

11. **Military/financial hardship discounts** - OFW has formal programs. Do-Do should consider a similar access program for Poland GTM.

---

## Strategic Takeaway

Do-Do should not try to be OFW for high-conflict legal cases right now - that requires immutable records, certified exports, and court integrations that take time to build trust around.

The winning position is: **OFW for conflict, Do-Do for coordination.** OFW is where you go after a lawyer tells you to. Do-Do is what you use every day because it's faster, cheaper, and actually pleasant.

The most impactful gap to close for the Poland GTM is the **AI tone assistant on messages** - it's a quick Claude Haiku integration and directly competes with OFW's headline feature. Second priority is the **Info Bank** (low build effort, high everyday value). Third is **read-only parenting plan card type** with accept/decline (moves Do-Do slightly up the trust ladder without requiring full legal infrastructure).

---

*Sources: [OFW Product Features](https://www.ourfamilywizard.com/product-features) · [OFW Plans & Pricing](https://www.ourfamilywizard.com/plans-and-pricing) · Do-Do README + CHANGELOG (v0.8.7)*
