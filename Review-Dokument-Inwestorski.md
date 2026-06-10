# Critical Review: Do-Do Dokument Inwestorski (FINAL, June 2026)
*Reviewed 2026-06-09 from the perspective of a skeptical seed investor and GTM operator. Verdict up front: strong narrative and unusually honest competitive analysis, but four issues would get flagged in the first partner meeting - the Splitwise analogy, the CAC table, the marketing budget vs growth curve mismatch, and per-parent pricing that fights your own viral loop. All fixable before pitching.*

---

## 1. What is genuinely strong (keep, do not dilute)

1. **Context-as-moat thesis (sec. 6).** "AI is the interface, context is the moat" is the best line in the document. It preempts the most common AI-startup objection and it happens to be true. Lead with it.
2. **Honest competition section (sec. 10).** Naming Splitday, 2domy.pl, Domownik and refusing the "zero competition" claim builds enormous credibility. The Splitday sovereignty-of-data angle (Israeli company, children's data, RODO) is a sharp, legitimate wedge.
3. **Librus willingness-to-pay proof (sec. 10.4).** Best evidence in the doc. Polish parents already pay ~35 PLN/mo for a child-related digital tool. This single comparison does more work than the entire global market section.
4. **Objection-handling section (sec. 14).** Rare in seed docs. Objections 6 and 10 (pre-product, empty team section) being self-flagged is disarming and smart.
5. **Positioning discipline (sec. 3).** "Not an app for divorcees" and "low-conflict 60% of the market" matches the GTM analysis independently - convergence is a good sign.
6. **Handover Mode + Ważne Telefony + Children's Mode.** Differentiated, user-pain-derived features no competitor has. The kieszonkowe (pocket money) request as a generational engagement loop is a genuinely novel idea.

## 2. Critical issues (an investor will find these)

### 2.1 The Splitwise analogy is wrong - and it props up the CAC table

The doc claims (sec. 4.1, 12.2, Obj. 8): "Splitwise gets 70% of users from invites; our model is identical." It is not. A Splitwise user invites *many friends* over time, each invite is to a *positive* relationship, and every invitee is a potential *new inviter*. K-factor can exceed 1. A Do-Do user invites exactly **one person, ever - their ex**, in a strained relationship. K-factor is structurally capped below 1. The invite loop is an **activation mechanism** (it completes a pair), not an **acquisition engine** (it does not bring new families).

Consequence: the CAC table assigning 50% of volume at 0-5 PLN CAC double-counts. Parent B is not an acquisition - the pair is the unit. Counting both sides halves apparent CAC and inflates LTV/CAC to 15-24x. Recompute with the family as the unit: true blended CAC is realistically 60-120 PLN per *family*, LTV/CAC lands at 5-10x. **That is still an excellent number.** Present the defensible version before someone derives it for you on a whiteboard.

### 2.2 Marketing budget contradicts the growth curve

Sec. 12.1 allocates 35,000 PLN total marketing to reach 35,000 registrations by M12 (sec. 12.3). But the doc's own CAC table prices the SEO channel at 50-80 PLN and assigns it 25% of volume: 8,750 users x 50-80 PLN = 437k-700k PLN for that channel alone. Either the CAC table is wrong, or the budget is ~10-15x understated, or the growth curve is fantasy. Fix by: (a) restating volumes in families not individuals, (b) leaning the model on the prescriber/B2B channel (cheap, scalable with one partnerships person - see GTM doc), (c) cutting M12 registrations to a defensible 12-18k individuals.

### 2.3 Per-parent pricing fights the viral loop (and your own comparisons)

At Standard 27 PLN **per parent**, an aligned couple pays 54 PLN/mo. Three self-inflicted wounds:

- The doc's Netflix comparison ("37% cheaper") inverts for a pair: 54 > 43 PLN. The Librus anchor (35 PLN) breaks too. Investors do this arithmetic.
- Viral loop step 5 requires hesitant Parent B to pull out a card after 30-60 days. The category's known failure mode (the doc itself cites OFW's per-parent pricing as a weakness) is reproduced exactly at the moment the network effect should lock in.
- The restrictive FREE tier (10 messages/mo, 3 expenses/mo) means Parent B hits walls during the trial-of-trust window. GTM principle: *the invited parent must never hit a paywall.*

See section 4 below for the two pricing models, calculated.

### 2.4 Timeline and cost realism

- **Break-even M8-9** with MVP launching Q3 2026 means break-even ~5-6 months post-launch, pre-product today. No seed investor believes this; it reads as naivete rather than ambition. Move to M14-18 and you lose nothing.
- **Dev cost:** 2 seniors x 20k PLN/mo net is below the Polish B2B market (25-32k for seniors who can ship an AI agent + payments). Budget 25-30% more or plan mid+senior.
- **MVP scope** (6 features + AI agent acting across modules + BLIK flow + GCal/Apple sync) for 2 devs in one quarter is aggressive. Sync alone is a swamp. Recommendation: cut GCal/Apple sync from MVP (one-way export .ics is enough), ship the agent with 3 commands not 5.
- **Compliance line (15k PLN)** is light for an app holding children's health data (allergies, medications, documents). This is special-category data under RODO art. 9 - DPIA required, and "dane dzieci" is a UODO enforcement priority. Budget 25-40k and make compliance a marketing asset (you already use it against Splitday - it must be bulletproof).

### 2.5 Numbers hygiene

- **Divorce stat:** doc uses 57,400 (2024, GUS); 2025 figure is ~61k. Use the newer number - it strengthens the case.
- **ARPU 25 PLN flat across 24 months** ignores annual-plan discounting (219/12 = 18.25) and Premium mix. State the mix assumption.
- **VAT:** is 27 PLN gross or net? At 23% VAT, gross 27 = net 21.95. The whole revenue model shifts ~19% on this one word. Also missing: app-store commission (15-30%) if billed via IAP - if you bill via Stripe web (as the PWA does), say so explicitly; it is an advantage.
- **"Paying users" unit ambiguity:** registrations are individuals, revenue is per-parent, market is sized in pairs. Pick one unit (families) and carry it through every table.
- **Penetration scenarios:** 5% of the addressable market in 24 months from zero brand is a top-decile outcome. Keep it as the optimistic case, not "bazowy".

### 2.6 Quality and gaps

- **Systematic typos.** "Dłączego" (for "Dlaczego") appears ~8 times - a find-replace accident - plus "skanzow", "uczciowej", "naglosci", "zaplecic", "Domonik", missing diacritics throughout. For a document stamped FINAL and "Poufne" this is the first credibility signal an investor sees. Full proofread required.
- **Team section is empty.** Self-acknowledged, but at pre-seed this IS the pitch. The two questions in sec. 15 are the right ones - answer them before anything else in this review.
- **No competitive-response risk.** What happens when Splitday (already Polish-localized, funded, $24.99/yr) ships bilateral sync? Answer to prepare: their architecture is local/offline-first, single-user by design - bilateral real-time sync is a rebuild, an 12-18 month moat. Say this in the doc instead of leaving the question open.
- **AI agent cost at scale** is priced (25k/yr at 5k DAU) but unlimited-AI Premium at 47 PLN invites abuse; add a fair-use note internally.
- **App vs doc mismatch:** the live PWA sells at 19 PLN/mo today. Any investor who installs the app sees a different price than the deck. Sync before sending the doc to anyone.

## 3. The GTM-investor doc reconciliation (summary)

| Topic | Investor doc | GTM doc | Resolution |
|---|---|---|---|
| Positioning | Co-parenting wedge → Family OS | Same (independently derived) | Aligned - no change |
| Primary channel | Viral loop (50% of volume) | Prescribers (mediators/lawyers) | Loop activates pairs; prescribers acquire them. Both, explicitly sequenced |
| Competitors | Splitday, 2domy, Domownik named | Claimed "no Polish app" | GTM updated to match doc (doc is right) |
| AI/context moat | Core thesis | Absent | Added to GTM as messaging pillar |
| Pricing | 27/47 per parent | Per family, anti-OFW stance | Two models below - decision needed |
| M12 paying | 7,500 | 3,000-5,000 pairs (funded tier) | Doc = upside case; GTM = base case for diligence |
| Break-even | M8-9 | n/a | Restate M14-18 |

## 4. Two pricing models, calculated

Common assumptions for both: registrations counted in **families** (pairs), same acquisition funnel, M24 horizon, monthly cost base from the doc (118k PLN at M24), ARPU net of 23% VAT shown in parentheses, Stripe web billing (no app-store cut).

### Model A - per parent: Standard 27 / Premium 47 PLN (doc as written)

| Assumption | Value | Note |
|---|---|---|
| Families registered M24 | 60,000 | doc's 120k individuals / 2 |
| Families with >=1 payer | 20% = 12,000 | B-paywall suppresses pair conversion |
| Both parents pay | in 40% of paying families | the doc's optimistic loop outcome |
| Paying individuals | 12,000 x 1.4 = 16,800 | vs doc's 28,000 - doc assumes near-universal dual payment |
| Blended ARPU/payer | 25 PLN gross (20.3 net) | Standard-heavy, some annual |
| **MRR M24 (gross)** | **~420,000 PLN** | doc claims 700k |
| Break-even (118k costs) | ~5,800 paying individuals → **~M13-15** | doc claims M8-9 |

### Model B - per family: 35 PLN/mo or 299 PLN/yr covers both parents

| Assumption | Value | Note |
|---|---|---|
| Families registered M24 | 60,000 | same funnel |
| Paying families | 28% = 16,800 | one decision-maker, invited parent never paywalled, conversion up ~40% vs A (category evidence: 2houses and Splitwise both price per group) |
| ARPU/family | 35 PLN gross (28.5 net) | annual mix pulls it to ~31 effective |
| **MRR M24 (gross)** | **~520,000-590,000 PLN** | beats Model A by 25-40% |
| Break-even (118k costs) | ~3,800 paying families → **~M12-14** | earlier than A |
| Premium per family | 59 PLN/mo / 499 PLN/yr | preserves the upsell ladder |

**Crossover math:** Model A only wins if >55% of paying families end up with BOTH parents paying. Category history (OFW's per-parent pricing is its most-cited weakness; the doc says so itself) makes that unlikely. **Recommendation: Model B.** It also repairs every broken comparison: 35 PLN = Librus exactly, 19% under Netflix, and the pitch line becomes "one price, both parents, because the product only works when both are in" - pricing as positioning.

Sensitivity to note for Magda: if family-level conversion comes in at only 22% (pessimistic), Model B MRR ≈ 410-460k, still ≈ Model A's realistic case - i.e. B's downside ≈ A's base case, and B's upside is higher. Asymmetric bet.

## 5. Priority fix list before any investor sees this

1. Write the team section (the two questions in sec. 15).
2. Decide pricing (recommend Model B) and sync doc + app + GTM.
3. Reframe Splitwise analogy: loop = activation, prescribers = acquisition; restate CAC per family.
4. Fix the 35k marketing budget vs 35k registrations contradiction.
5. Move break-even to M14-18; cut M12 targets to 12-18k individuals (6-9k families).
6. Full Polish proofread (systematic "Dłączego" error et al.).
7. Update divorce stat to ~61k (2025), define VAT treatment, state Stripe-web billing advantage.
8. Add the Splitday-response paragraph (their single-user offline architecture = 12-18 mo rebuild to copy you).
9. Raise compliance budget to 25-40k; mention DPIA for children's data - then weaponize it in marketing.
10. Attach the GTM document as the execution annex - the doc currently has channels but no operational plan; the GTM is that plan.
