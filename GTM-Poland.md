# Do-Do.app - Go-to-Market Strategy: Poland
*Prepared 2026-06-09, v2 - reconciled with Dokument Inwestorski (June 2026). All currency in PLN unless noted.*

---

## 1. Executive summary

Poland is arguably the best first market in Europe for a co-parenting app, and it is currently unowned. ~61,000 divorces in 2025 (rising ~5% YoY), ~51,000 minor children affected annually, and shared parental custody rulings have exploded from 29% (2000) to ~77% (2024). Add unmarried separating parents (no court statistics, realistically 1.5-2x the divorce number) and the annual inflow of new co-parenting households is 100-150k pairs. The stock of existing co-parenting households is several hundred thousand.

The global incumbents (OurFamilyWizard, TalkingParents, AppClose) are English-first, US-priced, and US-hosted - and AppClose plus TalkingParents removed their free plans in 2026, leaving displaced users searching for alternatives. Local and localized competition exists but is partial: Splitday (Israeli, Polish-localized, single-parent tracker without bilateral sync), 2domy.pl (web-only custody calendar), Domownik (organizer for cohabiting households). None offers a bilateral platform with an AI assistant holding family context. Do-Do with Polish UI, PLN billing, family-level pricing, and EU data residency wins on language, completeness, and RODO trust before spending a single złoty on ads.

The core GTM insight: **this product is not discovered, it is prescribed.** Nobody browses the App Store for co-parenting tools on a good day. They adopt one when a mediator, lawyer, or judge-approved parenting plan tells them to, or when a peer in a support group swears by it. Therefore the highest-ROI motion at every budget level is the B2B2C "prescriber channel" (mediators, family lawyers, NGOs), with paid acquisition layered on only at higher budgets.

**How this combines with the product's Viral Invite Loop (Dokument Inwestorski, sec. 4):** the two motions are complementary, not competing. Prescribers and content ACQUIRE Parent A at the trigger moment; the magic-link invite loop ACTIVATES the pair by recruiting Parent B at zero cost. The loop is an activation mechanism, not an acquisition engine - each family invites exactly one person (the ex), so K-factor is structurally below 1 and the loop cannot replace top-of-funnel. Measure them separately: prescriber/content CAC per *family*, then invite-acceptance rate as the activation multiplier.

---

## 2. Market sizing

| Layer | Estimate | Basis |
|---|---|---|
| TAM (PL co-parenting households, stock) | 600k-900k pairs | divorces with children accumulated over ~10 yrs + unmarried separations |
| SAM (smartphone-active, conflict level requiring a tool, willing to pay) | 150-250k pairs | urban skew (divorce 3x more frequent in cities), shared-custody cases |
| SOM year 1 | 2,000-5,000 paying pairs | realistic with prescriber channel |
| Annual new inflow | 100-150k pairs | ~61k divorces (57% with kids) + unmarried separations |

Revenue check: 3,000 paying pairs x PLN 169/yr = PLN ~507k ARR. 10,000 pairs = PLN ~1.7M ARR. Poland alone can carry the company to seed-stage metrics.

**Willingness to pay context:** Polish parents already pay ~35 PLN/mo for Librus (school communication, 75% of schools) - direct proof of paying for child-related digital tools. Anchor messaging to that and to lawyer time ("one month of Do-Do costs less than 5 minutes of your divorce lawyer's time"; lawyers: 300-800 zł/hr; mediators: 200-500 zł/hr) - never to "another subscription." Pricing model decision (per family vs per parent) is treated in section 8.

---

## 3. Positioning

**Brand umbrella vs launch wedge - the key decision.** Do-Do's long-term identity is a tool for ALL parents juggling work and children's schedules ("rodzinny zarząd w jednym miejscu"). But the launch wedge is separated/co-parenting households, because that segment has acute pain, a forcing moment (mediation, parenting plan), prescribers who recommend tools, and a structural reason to pay. Launching broad means competing with free tools (Google Calendar, Cozi, FamilyWall, WhatsApp) where urgency and willingness to pay are weak. So: brand and product surface stay family-neutral (nothing divorce-coded on the homepage or in the app), acquisition targets the wedge, and "every family is a logistics company" becomes the Phase 2 expansion campaign once reviews and word of mouth exist. The neutral framing also widens the wedge itself: never-married separated parents and living-apart-together couples fit "parents juggling schedules" but are invisible in divorce statistics.

**Why NOT "all parents" at launch (decision record):**

1. **No urgency, no forcing moment.** Intact families feel mild pain; nothing pushes them to adopt a paid tool this week. Separated parents are handed a parenting plan they must execute starting Monday.
2. **Free and good-enough competition.** Google Calendar, Cozi, FamilyWall, WhatsApp groups all solve 80% of the intact-family problem at zero cost. Competing there is a feature war against free.
3. **No prescriber channel.** Nobody professionally recommends scheduling tools to happy families. Mediators, lawyers, and NGOs actively prescribe tools to separating ones - the cheapest acquisition channel available, and it only exists for the wedge.
4. **Willingness to pay.** PLN 19/mo is trivial against a 10,000 zł divorce but a hard sell against a free calendar. Conversion economics only close in the wedge.
5. **Message dilution.** "For everyone" marketing converts no one; budget at every tier is too small to build a broad consumer brand in Poland.
6. **The broad-first alternative costs more.** Honest version of all-parents-first: much larger free tier, ASO + broad influencer CAC, and a 3-5x longer runway to revenue. Rejected for launch; revisit only with significant funding.

This is a sequencing decision, not an identity decision - the brand stays for all parents, Phase 2 (below) executes the expansion.

**Launch category (acquisition messaging only):** "Aplikacja dla rodziców po rozstaniu" - deliberately broader than divorce (includes never-married parents, who are ignored by the legal system's statistics and by competitors' marketing).

**Primary promise:** *Mniej rozmów, mniej konfliktów, wszystko w jednym miejscu.* (Fewer conversations, less conflict, everything in one place.)

**Four message pillars, mapped to personas:**

1. **The exhausted coordinator** (usually the primary-custody parent, 30-45, urban): "Stop being the family secretary. Schedule, expenses, school, medical - one board, both parents see it."
2. **The parent fighting for access** (often fathers, opieka naprzemienna movement): "Document everything. A clean, timestamped record of requests, agreements, and expenses." This audience is organized (Dzielny Tata and allied associations), vocal, and underserved.
3. **The professional prescriber** (mediator, adwokat, psycholog): "Give your clients a tool that makes the parenting plan (plan wychowawczy) actually work after they leave your office - and reduces the 9pm crisis calls to you."
4. **The AI assistant with family context** (cross-persona differentiator, from Dokument Inwestorski sec. 6): "An assistant that actually knows your family - Tomek's allergy, Wednesdays at dad's, the dentist's number, the unsettled shoe expense. ChatGPT knows none of this; Do-Do learns it in weeks." Context is the moat, AI is the interface. In marketing: demo-first content (15-second clips of voice commands like "Zapłaciłam 380 zł za buty Tomka" → expense logged, split, partner notified) - this is the shareable, press-worthy surface of the product.

**Trust differentiators vs US apps:** Polish language, PLN pricing via Stripe, EU/RODO data residency, PPP-adjusted price (PLN 169/yr vs 2houses at ~PLN 700/yr equivalent for the pair).

**Naming note:** "Do-Do" is friendly and neutral - good. Avoid divorce-coded branding; many users are never-married or pre-decree. Neutral framing also matters for the second parent, who must accept the invite for the product to work at all (the activation moment that decides everything - see section 7).

**Phase 2 - all-parents expansion (month 9-18, triggered by >=2,000 paying pairs and >=4.5 store rating):** reposition campaigns around "dwoje pracujących rodziców, jeden kalendarz" (two working parents, one calendar). Channels shift to broad parenting media, benefit platforms (already opened in Tier 2), and school-adjacent integrations. The co-parenting feature set (expense splitting, neutral records) remains a premium differentiator no family-calendar competitor offers.

---

## 4. Competitive landscape

*(Corrected v2: the original draft claimed no Polish-language competitor exists. The Dokument Inwestorski competitive audit is right - there are three, all partial.)*

| App | Price | Polish UI | Bilateral sync | AI agent | Weakness in PL |
|---|---|---|---|---|---|
| OurFamilyWizard | ~$200/yr per parent | No | Yes | ToneMeter only | Price, language, US-centric |
| TalkingParents | $77-360/yr (free plan removed 2026) | No | Yes | No | No calendar/lists, language |
| AppClose | ~$216/yr (free plan removed 2026) | No | Yes | No | Price shock for ex-free users |
| Splitday | ~$24.99/yr | **Yes** | **No** (solo tracker) | No | Single-parent by design; Israeli company holding children's data outside EU |
| 2domy.pl | Free | **Yes** | Partial | No | Web-only custody calendar, nothing else |
| Domownik | ~15 PLN/mo | **Yes** | n/a | No | Built for cohabiting households, not two homes |
| **Do-Do** | **family-level PLN pricing** | **Yes** | **Yes** | **Yes, with family context** | New, unknown brand |

**Channel implications:**

- **The real competitor remains the free "sklejka"** - Messenger + Google Calendar + Splitwise. Counter with shared context, immutable record, and one-place convenience - not feature lists.
- **Splitday is the most serious named threat** (Polish-localized, cheap, funded). Counters: (a) positioning - "Splitday solves one parent's problem; Do-Do gives both parents one shared reality"; (b) RODO/data sovereignty - children's data held by a non-EU company is a legitimate trust wedge, use it; (c) their offline, single-user architecture means copying bilateral sync is a 12-18 month rebuild - the window to win the category. Splitday users who want the other parent in are warm leads: target "splitday alternatywa" in SEO.
- **2domy.pl is an acquisition channel, not a threat:** its users have already self-identified as custody-calendar seekers. SEO on "2domy.pl alternatywa" + comparison content = cheapest high-intent traffic available.
- **AppClose/TalkingParents free-plan removals (2026)** created a displaced-user moment. Time-limited "switcher" content and an import path are cheap wins this year.
- **Librus (35 PLN/mo, 75% of Polish schools) is not a competitor but the willingness-to-pay proof** - anchor all price communication to it: "kosztuje tyle co Librus."

---

## 5. GTM scenarios by investment level

### Tier 0 - Bootstrap (< PLN 5,000 total, founder time only)

Goal: 500 activated pairs, 50-100 paying, in 6 months. Prove the prescriber motion works.

1. **The Mediator-First Play (the single highest-leverage action at zero budget).** There are roughly 35-42k court family mediations per year and a directory of registered mediators at every sąd okręgowy (public lists). Hand-pick 100 family mediators in Warsaw, Kraków, Wrocław, Poznań, Gdańsk. Offer: free lifetime "Mediator" account, their clients get 3 months free via their personal code, and Do-Do exports a schedule/expense summary they can attach to the porozumienie. Cost: email + 15-min demo calls. Even 10 active mediators prescribing to ~50 client pairs/yr each = 500 warm pairs/yr.
2. **Polska Mediatorka and similar blogs.** The blog that reviewed co-parenting apps and found no Polish option is a ready-made PR target. Offer an exclusive first review / interview. Same for parenting blogs and podcasts (Mamopracuj, single-parent communities).
3. **Community seeding.** Fundacja Sama Mama (portals sama-mama.pl, misja-ja.pl), Stowarzyszenie Dzielny Tata and allied fathers' organizations, Facebook groups for parents after divorce. Do not spam - offer the NGO a free partner deal: their members get 6 months free, the NGO gets a named "supported by" mention. Both sides of the gender divide must be covered (Sama Mama AND Dzielny Tata) - the product only works when both parents join.
4. **SEO content in Polish.** 15-20 cornerstone articles: "plan wychowawczy wzór", "opieka naprzemienna jak zorganizować", "podział kosztów dziecka po rozwodzie", "aplikacja dla rodziców po rozwodzie", plus competitor-intercept pages: "splitday alternatywa", "2domy.pl alternatywa", "appclose po polsku" (AppClose and TalkingParents dropped free plans in 2026 - displaced users are searching now). Divorce-adjacent keywords have commercial intent and weak Polish-language competition outside law firm blogs. Each article ends with a downloadable template (parenting plan, expense table) gated by email.
5. **Template Trojan horse.** Publish the best free "porozumienie rodzicielskie / plan wychowawczy" Word+PDF template in Poland. Lawyers and mediators will circulate it; the template references Do-Do as the tool to execute it.

Spend: domain/hosting already covered; PLN 2-3k for a freelance translator/proofreader and template design; PLN 1-2k buffer.

### Tier 1 - Seed-lite (PLN 50,000, 6-9 months)

Everything in Tier 0, plus:

1. **Part-time partnership manager (PLN 20-25k).** A junior person (or a mediator moonlighting) who onboards 300+ mediators and 100+ family law firms. This is sales, not marketing - the channel needs follow-up calls, not newsletters.
2. **Micro-influencer program (PLN 10k).** 10-15 Polish creators in the "życie po rozwodzie" / single-parent niche on Instagram and TikTok, PLN 500-1,000 each for authentic story content. Avoid big parenting influencers - too broad, wrong moment.
3. **Paid search only on high-intent terms (PLN 8-10k).** Google Ads on "aplikacja dla rozwiedzionych rodziców", "opieka naprzemienna aplikacja", "plan wychowawczy". Skip Meta prospecting at this tier - the audience is defined by a life event, not interests, and Meta targeting for it is inefficient. Use Meta only for retargeting site visitors.
4. **Webinar circuit (PLN 2-3k).** Monthly free webinar for mediators/psychologists: "Technologia w pracy z rodzicami po rozstaniu" - positions Do-Do as the category educator. Record, clip, repost.
5. **PR push (PLN 5k or DIY).** The story writes itself: "77% of Polish divorce rulings now grant shared custody - but parents have no Polish tool to manage it. A Swiss-Polish app fills the gap." Pitch to Wysokie Obcasy, Gazeta.pl, Spider's Web, Mamadu, business dailies (PPP pricing angle).

Target: 5,000 activated pairs, 500-800 paying by month 9. CAC through prescribers should land under PLN 40/pair; blended under PLN 80.

### Tier 2 - Funded (PLN 250,000, 12 months)

Everything above, plus:

1. **Full-time Head of Partnerships + part-time performance marketer (PLN 120k).**
2. **Employee benefits channel (PLN 20k integration/sales effort).** Get Do-Do listed on cafeteria/benefit platforms (Worksmile, Nais, MyBenefit, Motivizer). Pitch to HR: divorce is a top-3 productivity killer; a PLN 19/mo benefit is the cheapest EAP supplement on the market. One mid-size employer = hundreds of potential users with zero CAC. Unconventional and nobody competes there.
3. **Legal-tech bundling (PLN 10k).** Partnerships with online divorce services and lawyer marketplaces - Do-Do bundled into their post-decree package, revenue share. Also white-label "powered by Do-Do" client portals for the 5-10 largest family law firms.
4. **Court-adjacent legitimacy (mostly effort, PLN 10k for events).** Sponsor/present at mediator congresses (Międzynarodowy Tydzień Mediacji in October is a national, ministry-backed event - perfect timing for a campaign). Seek a written opinion from a respected family psychologist or the mediator associations. The goal: judges and court-appointed guardians (kuratorzy) hearing the name. In the US, court orders made OurFamilyWizard; the Polish equivalent is the mediator's settlement recommending a coordination tool by name.
5. **Performance marketing at scale (PLN 60k).** Google Search expanded, YouTube pre-roll on divorce/parenting content, Meta retargeting + lookalikes built from paying users. Hard CAC ceiling: PLN 150 per paying pair (LTV at 18-month median lifetime ~PLN 250-340).
6. **Brand campaign experiment (PLN 30k).** One emotional video asset ("Dwa domy, jedno dzieciństwo" - two homes, one childhood) for organic + paid distribution. Test before scaling.

Target: 25,000+ activated pairs, 3,000-5,000 paying by month 12 (PLN 0.5-0.85M ARR run rate).

---

## 6. Unconventional approaches

1. **"Prescribed, not downloaded" certificate.** Create a free 2-hour online course + certificate: "Certyfikowany specjalista koordynacji rodzicielskiej Do-Do" for mediators and psychologists. People list certificates on LinkedIn; every certificate is a walking referral channel. Cost: near zero.
2. **The second-parent problem as a growth hack.** The hardest moment is parent A inviting hostile parent B. Make the invite maximally low-friction and face-saving: invite lands as a neutral SMS/email "X added the school schedule and September expenses for [child]. View them here - no account needed." Read-only access first, account creation later. This is product work that doubles as the most important marketing asset, because every activated pair contains one user who was *recruited by the product itself*.
3. **Alimony calculator as lead magnet.** A free, genuinely good "kalkulator kosztów utrzymania dziecka" (child cost calculator aligned with how Polish courts assess alimenty). High search volume, zero good tools, natural bridge into expense tracking. Lawyers will link to it - free backlinks and authority.
4. **Mediation settlement clause library.** Free copy-paste clauses for mediators: "Rodzice zobowiązują się prowadzić wspólny kalendarz i ewidencję wydatków w aplikacji do koordynacji rodzicielskiej." Once tool usage is written into settlements, churn approaches zero - the settlement is quasi-binding.
5. **School bridge.** Polish schools run Librus/Vulcan e-dziennik systems and separated parents constantly fight over who saw which announcement. Even a manual "forward school emails to your Do-Do board" feature is a wedge; a future integration is a moat. No competitor can do this - they are not Polish.
6. **"Rozwód bez wojny" media coalition.** Co-found a soft PR initiative with 2-3 NGOs and a mediator association promoting low-conflict separation. Do-Do as founding tech partner. Earned media + halo + access to ministry-adjacent mediation week events.
7. **Anti-churn insurance framing.** Annual plan marketed as "Spokój na rok szkolny" (peace of mind for the school year), sold in August-September when custody logistics peak. Divorce filings and app need both spike after summer holidays and after Christmas - time every campaign burst to early September and mid-January.

---

## 7. Partnership playbook (priority order)

| Partner type | Count in PL | Offer to them | What Do-Do gets | Effort |
|---|---|---|---|---|
| Family mediators | thousands (court lists per sąd okręgowy) | Free pro account, client codes, settlement export | Prescriptions at the perfect moment | Low |
| Family law firms | hundreds active in divorce | Client voucher packs, white-label portal | High-intent referrals | Medium |
| NGOs (Sama Mama, Dzielny Tata, etc.) | dozens | Free memberships, co-branded content | Community trust, both genders | Low |
| Psychologists/therapists (rodzinni) | thousands | Certificate course, client codes | Prescriptions, retention | Medium |
| Benefit platforms (Worksmile, Nais, MyBenefit) | 4-5 majors | Ready-made wellbeing benefit | Zero-CAC B2B2C distribution | Medium |
| Online divorce/legal-tech services | a handful | Bundle + rev share | Pipeline of fresh separations | Medium |
| Mediator associations + Tydzień Mediacji | 1 national event/yr (Oct) | Sponsorship, education | Legitimacy, court-adjacent reach | High |

Rule of thumb: each prescriber is worth 20-50 client pairs over a year, at near-zero marginal cost. 300 active prescribers is functionally market leadership in Poland.

---

## 8. Pricing and monetization

**Open decision - two models on the table** (full calculations in Review-Dokument-Inwestorski.md, sec. 4). The app currently charges 19 PLN/mo; the Dokument Inwestorski proposes 27/47 PLN per parent. Both modeled on the same funnel (60,000 registered families at M24, doc's cost base):

| | Model A: per parent (27/47 PLN) | Model B: per family (35 PLN / 299 PLN/yr) |
|---|---|---|
| Pair on Standard pays | 54 PLN/mo | 35 PLN/mo |
| Anchor integrity | breaks Librus (35) and Netflix (43) comparisons | = Librus exactly, 19% under Netflix |
| Invite loop impact | Parent B paywalled at day 30-60 - friction at the lock-in moment | invited parent never pays - loop intact |
| Paying conversion assumption | 20% of families, 40% dual-payer | 28% of families (single decision-maker) |
| MRR at M24 (gross) | ~420k PLN | ~520-590k PLN |
| Break-even (118k/mo costs) | ~M13-15 | ~M12-14 |

Model A only wins if >55% of paying families end up with both parents paying - unlikely given that per-parent pricing is OurFamilyWizard's most-cited weakness. **Recommendation: Model B**, with Premium per family at 59 PLN/mo / 499 PLN/yr. Pricing becomes positioning: "one price, both parents - because the product only works when both are in."

Other monetization rules:

- Do not discount publicly; discount through partners (3-6 months free via prescriber codes) so the list price stays anchored.
- Free tier: generous enough that the *invited* parent never hits a paywall. Monetize the coordinator parent (AI agent limits, exports, reminders, calendar sync, court-ready expense reports).
- Bill via Stripe on the web (as today) and say so to investors - no 15-30% app-store cut; state VAT treatment explicitly (35 PLN gross = 28.5 net).
- B2B SKU confirmed in Dokument Inwestorski: Kancelaria panel at 299 PLN/mo - sell through the same partnership channel this GTM builds; add a "Mediator dashboard" tier at 49-99 PLN/mo once 50+ mediators are active.

## 9. KPIs and first 90 days

North-star metric: **activated pairs** (both parents joined + 1 card created), not downloads.

Weeks 1-2: Polish localization audit, invite-flow friction pass, prescriber landing page (do-do.app/dla-mediatorow), parenting plan template live.
Weeks 3-6: 100 mediator outreach emails + 20 calls; Polska Mediatorka and 3 blogs pitched; Sama Mama + Dzielny Tata partnership conversations; first 5 SEO articles.
Weeks 7-12: first webinar; alimony calculator MVP; PR pitch wave; measure prescriber-code activations weekly. Decision gate at day 90: if >=10 prescribers have produced >=100 activated pairs, the channel works - pour any new budget there first.

Funnel guardrails: invite acceptance rate >50% (if lower, fix the invite, not marketing), week-4 pair retention >40%, free-to-paid >10% at month 3.

## 10. Risks

- **Two-sided activation failure** - the second parent refuses. Mitigation: read-only no-account invite (magic link with pre-built family profile, per Dokument Inwestorski sec. 4.1), neutral tone, prescriber framing ("the mediator asked us to use it"), family-level pricing so Parent B never pays.
- **Free rider (sklejka: Messenger + GCal + Splitwise).** Mitigation: shared context, immutable record, RODO, court-friendly exports, prescriber endorsement.
- **Splitday response risk** - they are Polish-localized and funded. Mitigation: win the prescriber channel first (they have no B2B motion), exploit the bilateral-sync architecture gap within the 12-18 month window, press the EU data-residency advantage for children's data.
- **Seasonality** - dead summer months. Mitigation: align spend with Sept/Jan peaks.
- **Sensitive-data trust.** Publish a plain-Polish privacy page early; RODO + EU hosting is a weapon, use it loudly.
- **Gender-war positioning trap.** Father-rights groups are a strong channel but polarizing; balance every fathers' partnership with a mothers' one and keep brand voice strictly child-centric.

---

*Sources: GUS/MS statistics via twpr.pl, interia.pl, ssgk.stat.gov.pl; mediation stats gov.pl/web/sprawiedliwosc and ubiconcordia.pl; competitor pricing ourfamilywizard.com, talkingparents.com, wealthysinglemommy.com; Polish app-gap evidence polskamediatorka.com; communities fundacja.sama-mama.pl, Dzielny Tata coverage.*
