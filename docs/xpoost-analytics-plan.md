# XPoost Analytics — Product & Technical Plan

*Prepared 28 Sep 2026, based on the current `x-poost` codebase (8 live features, Postgres, Shopify Function discount `xpoost-discount`, Monthly + Lifetime billing).*

---

## 0. The one idea that matters most

Merchants don't uninstall apps that visibly make them money. Every CRO app claims "boosts conversions"; almost none *prove* it. The Analytics tab is therefore not a reporting page — it is XPoost's **retention engine and sales pitch**. The first thing a merchant sees should be:

> **"XPoost generated EGP 48,300 this month — 19× your plan cost."**
> *31,200 direct · 17,100 influenced · 214 orders touched* (illustrative figures)

Everything below serves three goals, in order:

1. **Prove value** (revenue, ROI) — reduces churn, justifies the subscription.
2. **Diagnose** (which feature/offer/product works, which is annoying) — makes the merchant better.
3. **Prescribe** (ranked "do this next" opportunities with a money estimate and a one-click fix) — the part competitors don't have.

A fourth, hidden goal: **honesty**. Numbers must be defensible. We separate *direct* revenue (provable, line-item tagged) from *influenced* revenue (saw the feature, then bought) from *incremental* revenue (holdout-measured true lift) and label each clearly. We also refuse to show conclusions on tiny samples. Being the app that doesn't inflate numbers is a brand advantage, and it avoids the "your app says $5k but my sales didn't change" review.

---

## 1. Measurement architecture (the foundation)

Nothing in the dashboard is worth building until the data is trustworthy. Four pipes:

### 1.1 Storefront events → `/apps/xpoost/t` (app proxy)
A shared tracker, `xp-track.js` (target < 2 KB gzipped), loaded once by `cart-engine.liquid` and exposed as `window.XP.track(feature, event, props)`.

- **Batching:** queue events, flush every 5 s or on `pagehide` / `visibilitychange` using `navigator.sendBeacon` (survives navigation to checkout). Zero impact on LCP/INP.
- **Viewable impressions:** an impression counts only when the widget is ≥ 50% visible for ≥ 1 s (IntersectionObserver). A shipping bar hidden in a closed drawer is *not* an impression. This alone makes XPoost's CTR more honest than most apps.
- **Client-side dedupe:** "unique impression" = once per session per feature per offer (sessionStorage flag). Server just increments counters.
- **Identity:** `xp_vid` (visitor, localStorage, 90 days) + `xp_sid` (session, 30-min inactivity). Random IDs, no PII.
- **Context on every event:** device (mobile/desktop), page type (home/PDP/collection/cart), locale, currency, new vs returning, traffic source (UTM + referrer bucket: Meta / TikTok / Google / direct / other), and `variant` (for A/B + holdout, see §5).
- **Consent:** check `Shopify.customerPrivacy.analyticsProcessingAllowed()`. If not allowed, send aggregate counters only (no visitor/session IDs). Counts stay complete; nothing personal is stored. Verify this approach for EU stores before launch.

### 1.2 Cart → order stitching (the key to revenue attribution)
- On first cart creation, write cart attributes `_xp_sid` and `_xp_vid` (`/cart/update.js {attributes}`). They travel to the order as `note_attributes`, so every order can be joined to the session that produced it.
- Every item XPoost adds already carries `_xpoost_discount` / `_xpoost_upsell`. Extend this to a **source tag on every XPoost-added line**:
  `_xpoost_src = "pre_purchase:<offerId>"`, `"in_cart:<ruleId>"`, `"qty_break:<offerId>:<tier>"`.
  Underscore-prefixed properties are hidden from shoppers but survive onto the order line.
- Exit-intent: switch from one shared `SAVE10` code to **unique per-session codes** (see §4.6). That makes redemptions attributable and stops the code leaking to coupon sites.

### 1.3 Orders → `orders/create` webhook (source of truth for money)
- Add the `read_orders` scope and subscribe to `orders/create` (plus `orders/cancelled` and `refunds/create` so revenue is net of refunds).
- Orders count as protected customer data. Request **Level 1 access only** in the Partner Dashboard (no name/email/phone/address fields are needed) — this is the lightest approval tier.
- Per order, store: total, currency, `_xp_sid`, the XPoost-tagged lines (qty, price, discount allocations), and the discount codes used.
- **Bonus:** `read_orders` returns the last 60 days of orders. At install, backfill them to compute a **pre-XPoost baseline** (AOV, units per order, conversion if available). This powers a "Before vs After XPoost" card from day one.
- Server-side webhooks are unaffected by ad-blockers and consent banners, so revenue numbers stay complete even when storefront tracking doesn't.

### 1.4 Health signals
The tracker also reports `render_error` and a heartbeat (`feature enabled in config but never rendered`). This feeds the Health Monitor (§5.4). Past bugs on this project — broken app proxy, disabled embeds, theme drawer mismatches — would all have been caught automatically.

### 1.5 Storage (Postgres)
```prisma
model XpEvent {            // raw, append-only, 30-day retention (debugging, re-aggregation)
  id        BigInt   @id @default(autoincrement())
  shopId    String
  ts        DateTime @default(now())
  feature   String   // scarcity | productScarcity | prePurchase | inCart | quantityBreaks | shippingBar | exitIntent | socialBar
  event     String   // impression | click | action | dismiss | error | ...
  offerId   String?
  variant   String?  // "A" | "B" | "holdout"
  sid       String?
  device    String?
  pageType  String?
  source    String?
  locale    String?
  value     Decimal? // money in shop currency, when relevant
  props     Json?
  @@index([shopId, ts])
}

model XpDailyStat {        // what the dashboard reads — fast, small
  shopId      String
  day         DateTime @db.Date
  feature     String
  offerId     String   @default("")
  variant     String   @default("")
  device      String   @default("all")
  impressions Int @default(0)
  uniqueImpr  Int @default(0)
  clicks      Int @default(0)
  actions     Int @default(0)
  dismissals  Int @default(0)
  orders      Int @default(0)
  directRev   Decimal @default(0)
  influencedRev Decimal @default(0)
  discountCost  Decimal @default(0)
  @@id([shopId, day, feature, offerId, variant, device])
}

model XpOrder {            // one row per order with XPoost involvement or a known session
  id           String @id   // Shopify order GID
  shopId       String
  createdAt    DateTime
  sid          String?
  total        Decimal
  currency     String
  directRev    Decimal     // sum of _xpoost_src lines, net of discount
  discountCost Decimal
  sourcesJson  Json        // [{feature, offerId, qty, revenue}]
  exposedJson  Json        // features seen in the session (for influenced revenue)
  refunded     Decimal @default(0)
  @@index([shopId, createdAt])
}
```
Ingest writes increment `XpDailyStat` counters directly (upsert increments), so the dashboard never scans raw events. Raw events are trimmed nightly.

### 1.6 Guardrails on ingest
- Resolve shop **only** from the verified app-proxy signature (`authenticate.public.appProxy`). Reject if no shop. **Never fall back to `prisma.shop.findFirst()`** the way `proxy.config.tsx` does today (line 47) — for analytics that would put one store's events on another store's dashboard. The same fallback should be removed from `proxy.config.tsx` too.
- Rate-limit per shop and per session. Drop obvious bots (headless UA, zero-dwell floods). Remember that custom storefront events can be forged from the browser console, so events only change counters and money comes only from webhooks.

---

## 2. Metric dictionary (shown as tooltips in the UI)

| Metric | Definition | Why a manager cares |
|---|---|---|
| **Impressions** | Viewable renders (≥ 50% visible, ≥ 1 s). Unique = once per session per offer. | Reach. Low reach = placement/trigger problem, not offer problem. |
| **CTR** | Clicks on the widget's call to action ÷ viewable impressions. Closing it doesn't count. | Is the message interesting? |
| **Action rate (take rate)** | Goal completions ÷ impressions (added upsell, claimed code, picked a tier, opened WhatsApp…). | Is the offer compelling? |
| **Direct revenue** | Revenue of order lines tagged `_xpoost_src`, net of discounts and refunds. | Provable money. |
| **Influenced revenue** | Revenue of orders whose session had a viewable impression of the feature (same session / 24 h). Not exclusive between features. | Broader contribution. Clearly labelled as "influenced". |
| **Incremental revenue** | (Revenue per visitor, exposed − revenue per visitor, holdout) × exposed visitors. | The *true* lift. The gold standard. |
| **Discount cost** | Discount given through XPoost (Function allocations + exit codes). | Shows whether you're buying revenue at a loss. |
| **Net contribution** | Direct revenue − discount cost (− COGS when available). | What the CFO asks for. |
| **RPM** | Direct revenue per 1,000 impressions. | Compares very different features on one scale. |
| **AOV lift** | AOV of orders with XPoost lines vs without (and vs the pre-install baseline). | The headline CRO metric. |
| **Annoyance index** | Dismiss rate + share of sessions exiting within 5 s after a popup. | Protects the brand; catches over-aggressive popups. |
| **ROI multiple** | Direct (or incremental) revenue ÷ XPoost plan cost for the period. | The retention number. |

**Statistical honesty rule:** under 200 unique impressions (or under 30 actions), show "Collecting data — N more views needed" instead of a rate. A/B winners are declared only at ≥ 95% confidence. Detecting a 5% AOV lift needs roughly 3,500–4,000 orders per group; a 10% lift needs about 900 ([Oxify](https://oxify.app/blog/measure-cart-upsell-performance)). The UI should say this plainly so small stores don't chase noise.

---

## 3. The Analytics tab — layout

New nav item `/app/analytics`, placed second after Overview. Translated through the existing `DASHBOARD_I18N`, RTL-ready.

**Top bar:** date range (Today · 7D · 30D · 90D · Custom) · Compare to previous period · Device (All / Mobile / Desktop) · Traffic source · Export CSV.

### 3.1 Overview (all features)
1. **Hero ROI card:** "XPoost generated **X** this period · **N×** your plan cost", with direct / influenced / incremental split and a trend arrow against the previous period.
2. **KPI tiles (6):** Direct revenue · Orders touched (% of all orders) · AOV with XPoost vs without · Viewable impressions · Blended CTR · Discount cost (and % of direct revenue).
3. **Revenue over time:** stacked area by feature, daily. Hover shows the per-feature split.
4. **XPoost funnel:** Store sessions → saw any XPoost widget → engaged → added XPoost item → checkout → purchased. The biggest drop-off gets highlighted.
5. **Feature leaderboard table:** Feature · Status · Impressions · CTR · Action rate · Direct revenue · RPM · 30-day sparkline · Health dot. Sortable; clicking a row opens that feature's view.
6. **Opportunities feed (§5.1):** the top 3 ranked, money-estimated recommendations, each with a "Fix it" button that deep-links to the right settings screen with values prefilled.
7. **Before vs After XPoost:** AOV, units per order and conversion against the 60-day pre-install baseline (with a caveat about seasonality).
8. **Segments strip:** Mobile vs Desktop, New vs Returning, and source (Meta / TikTok / Google / Direct). For example, "TikTok traffic ignores upsells but converts 2× on quantity breaks" is the kind of insight that changes ad strategy.

### 3.2 Feature view (selector: segmented control or dropdown)
Each feature page uses the same skeleton:
- KPI row (that feature's 4–5 core metrics)
- Trend chart
- Breakdown table (per offer / rule / tier / channel)
- Feature-specific chart (below)
- **Benchmarks & Tips panel:** where the store sits against published benchmarks, 3–4 tips each with a source, and an "Experiment to run next" card.

---

## 4. Per-feature analytics & tips

### 4.1 Pre-Purchase Upsell Modal
**Events:** `impression` (modal shown) · `item_toggle` · `accept` (items added, value) · `skip` · `close` · `time_to_decision`.
**KPIs:** Modal views · Take rate (accepts ÷ views) · Items per accept · Direct revenue · Discount cost · RPM.
**Breakdowns:** per offer; **trigger product → upsell product matrix** (which pairings convert); preselected vs manual selection; with vs without discount; device.
**Special chart:** "Pairing heatmap": trigger products (rows) × promoted products (columns), coloured by take rate.
**Tips (with sources):**
- Benchmark: post-add-to-cart pop-ups on Shopify have a median take rate around **1.9–2.4%**, with the middle half of stores between roughly 1% and 5% ([Digismoothie, 218.6M offer views, 3,199 stores, Jan–Aug 2026](https://www.digismoothie.com/blog/upsell-benchmarks)). Above 5% puts you in the top quartile.
- **Show 3–4 products, not 1.** In the same dataset, offers with 1 product had a 1.5% take rate, 3 products 2.9%, and 4–5 products 3.1%.
- **Relevance beats discount.** Median take rate with no discount was 2.3%, versus 1.5% at 21–50% off. Test removing the discount: you may keep the conversions *and* the margin. XPoost should show "discount cost vs extra conversions" side by side so this is visible.
- Experiment: preselected vs unselected items (the setting already exists), measured on revenue per view, not just take rate.

### 4.2 In-Cart Drawer Upsell
**Events:** `impression` (card visible in the open drawer) · `click` · `add` · later `removed_before_checkout` (from cart polling).
**KPIs:** Drawer views with offer · CTR · Attach rate (orders containing the add-on ÷ orders from sessions that saw it) · Direct revenue · **Removal rate** (added, then removed; a strong signal the price feels like a trick).
**Breakdowns:** per rule; by cart value bucket (does the add-on work on EGP 300 carts but not EGP 1,500 ones?).
**Tips:**
- Benchmark: slide-cart offers have a median take rate of about **1.4%** (middle half 0.6–2.7%) ([Digismoothie](https://www.digismoothie.com/blog/upsell-benchmarks)). They're lower than pop-ups because they're passive, but they also cost nothing in annoyance.
- Add-ons that are cheap relative to the cart and obviously complementary (the "impulse zone") tend to attach best. XPoost should show attach rate by *add-on price as % of cart value* so the merchant finds their own sweet spot instead of guessing.
- Combine with the shipping bar: an add-on that exactly closes the free-shipping gap is the highest-intent offer you can make (§5.1 "gap closer").

### 4.3 Quantity Breaks
**Events:** `impression` · `tier_select` (tier, qty) · `add` (tier, qty, value).
**KPIs:** Selection rate · **Tier mix** (% choosing 1 / 2 / 3+) · Units per order (QB vs non-QB products) · Direct revenue · **Incremental units** (units above 1) · Discount cost.
**Special chart:** tier-mix stacked bar over time, with an "effective price per unit vs units sold" curve.
**Tips:**
- The goal is tier migration: moving buyers from 1 to 2 units is worth more than any other lever here. Track "% of buyers at tier ≥ 2" as the north-star metric for this feature.
- Label a middle tier "Most popular". Anchoring and centre-stage effects push choices toward the middle option. Verify with an A/B test on the badge position (built into §5.2).
- For consumables (skincare, haircare), frame tier 2–3 as "a 2–3 month supply" rather than only "save X%". Replenishment-cycle framing fits how people actually use the product.
- Watch the discount cost: if tier 3 is chosen mostly by people who would have bought 3 anyway, the discount is a giveaway. The holdout (§5.2) answers that.

### 4.4 Free Shipping Bar
**Events:** `impression` (with cart value and distance to the next tier) · `tier_unlocked` · checkout started (value).
**KPIs:** % of carts reaching the threshold · **Near-miss carts** (within 20% of the threshold but didn't reach it) · AOV of exposed carts · Average distance to threshold.
**Special chart:** a histogram of cart values with the threshold line drawn on it. This single picture tells a merchant whether the threshold is right.
**Tips:**
- Extra costs (shipping, taxes, fees) are the #1 reason for checkout abandonment, cited by **40%** of shoppers who abandon. Average documented cart abandonment is **70.22%** ([Baymard](https://baymard.com/lists/cart-abandonment-rate)). The shipping bar attacks the biggest leak directly.
- Rule of thumb: set the threshold at about **AOV + 30%** ([Growth Suite](https://www.growthsuite.net/resources/shopify-upsell-cross-sell/increase-average-order-value/free-shipping-threshold)). XPoost can compute this live from the store's real AOV and show "your threshold is X% above AOV: too high / right / too low".
- If fewer than about 15% of carts ever reach the threshold, it's probably too far. If more than about 60% reach it without effort, you're giving shipping away. (These are XPoost heuristics to validate with network data, not published figures.)

### 4.5 Scarcity / Social-Proof Toast
**Events:** `impression` (message type) · `click` (to product) · `close`.
**KPIs:** Views · CTR · Close rate · Product views from toasts · **Add-to-cart rate of exposed vs holdout sessions** (the only honest way to measure it).
**Breakdown:** by message type (recent purchase / stock / countdown) and by page type.
**Tips:**
- Toasts are *influence* tools, not click tools, so a low CTR is normal. Judge them on the holdout ATC difference.
- The close rate is the annoyance meter. If it rises above your CTR, the interval is too short or there are too many messages.
- **Use real data.** Recent-purchase messages built from real orders (which XPoost will now have via the webhook) are more persuasive and safe. Fabricated purchases or stock claims are a legal risk under EU and US consumer-protection rules and a trust risk if a customer notices.

### 4.6 Exit-Intent Saver
**Events:** `trigger` (desktop mouse-out / mobile back) · `impression` · `claim` · `close` · `code_redeemed` (from order webhook).
**KPIs:** Trigger rate · Claim rate · Redemption rate · **Recovered revenue** (orders using the code) · Discount cost · Net recovered.
**Breakdown:** desktop vs mobile; trigger type; countdown on/off.
**Tips:**
- Benchmark: exit-intent popups average about **3.94%** conversion. Campaigns *with countdown timers* averaged **12.84%** vs **4.73%** without, and mobile out-converted desktop (4.98% vs 3.67%) ([Wisepops, 1B popup displays](https://wisepops.com/blog/popup-stats)). Note: those figures are mostly email-capture popups, so treat them as directional for discount popups.
- **"Recovered" revenue is inflated by default.** Some of those shoppers would have bought anyway, and a known code trains customers to fake-exit. The holdout mode tells you the real number. XPoost's dashboard should label recovered revenue "before holdout" until one has run.
- Switch to unique, single-use, short-expiry codes per session (created via the Admin API or applied through the XPoost Function). This makes attribution exact and kills coupon-site leakage.

### 4.7 Product Stock Scarcity Block
**Events:** `impression` (design preset, stock shown) · add to cart on the same PDP.
**KPIs:** PDP views with block · **PDP ATC rate with vs without** (holdout) · by design preset.
**Tips:**
- Compare the four design presets with a real A/B test. Personal preference is a poor predictor of what converts.
- Prefer the `shopify` stock source. The `manual_range` option shows invented stock numbers, which carries the same legal and trust risk as fake toasts. XPoost could show a small warning badge in the dashboard when it's enabled.

### 4.8 Support & Social Bar
**Events:** `open` · `channel_click` (WhatsApp / Instagram / Facebook / TikTok / VIP / track order) with page type.
**KPIs:** Opens · Clicks per channel · **Chat-assisted orders** (sessions that clicked WhatsApp and ordered within 7 days on the same device) · Clicks from the cart page.
**Tips:**
- WhatsApp clicks *from the cart or checkout-intent pages* are a hesitation signal. Show the top pages that generate chats; the questions behind them usually belong in the PDP copy or FAQ.
- In MENA markets, chat-assisted selling is often a major channel. Measuring chat-assisted orders lets the merchant decide how much support staffing it deserves.
- "Track my order" clicks measure post-purchase anxiety. A high volume suggests adding proactive shipping updates.

### 4.9 Translations (supporting insight)
Not a conversion feature on its own, but every event carries `locale`, so the overview can show **conversion and AOV by storefront language**. For bilingual stores, "Arabic visitors convert 1.6× English visitors" is a genuinely useful finding.

---

## 5. The visionary layer (what competitors don't offer)

### 5.1 Opportunity Engine — "Do this next"
A rules engine runs nightly over the stats and produces ranked cards, each with an **estimated monthly value** and a **"Fix it"** deep link with prefilled values. Starting rules (figures in the cards are illustrative):

| Rule | Trigger | Card |
|---|---|---|
| Threshold mismatch | Threshold > AOV × 1.5 or < AOV × 1.1 | "Move free shipping from 1,200 to 950 EGP. About 38 more carts/month would qualify. Est. +EGP 6,400." |
| Gap closer | Many near-miss carts + an in-cart add-on priced near the typical gap | "Offer *Hair Serum Mini (EGP 180)* in the cart when a shopper is within 200 EGP of free shipping." |
| Discount leak | Take rate with discount ≈ take rate without | "Your 15% upsell discount isn't raising acceptance. Test 0%: keep ~EGP 2,100/month in margin." |
| Winning pair | Pair take rate in the top 10% | "*Serum → Toner* converts at 7.4%. Add it to your storewide offer." |
| Missing pair | Order co-occurrence shows A+B bought together often but no offer exists | "34% of *Shampoo* buyers also buy *Mask*. Create an upsell offer." (one click) |
| Annoyance | Popup close rate > 85% or 5-second exits increase | "Exit-intent is shown to 60% of sessions. Tighten suppression." |
| Dead feature | Enabled but 0 impressions for 24 h | "Your Cart Drawer Upsell isn't rendering. The app embed may be off after a theme change." |
| Tier migration | < 10% choose tier ≥ 2 | "Add a 'Most popular' badge to tier 2, or narrow the price gap between tiers." |

Phase 2: an LLM writes a plain-language weekly narrative on top of these facts ("This week, your best lever was…").

### 5.2 Holdout & A/B testing (built on the same `variant` field)
- **Holdout mode (per feature):** 10% of visitors never see the feature (a 90/10 random split at session start is the most reliable design). This produces the **incremental revenue** number, which is XPoost's credibility weapon.
- **A/B tests:** design preset, headline, discount %, preselect on/off, tier badge position. Automatic stop and winner at 95% confidence, with a clear "not enough traffic yet" state.
- Premium-tier material (see §6).

### 5.3 Profit view, not just revenue
Pull `InventoryItem.unitCost` (needs the `read_inventory` scope) where merchants have set it. Then show **net contribution = revenue − discount − COGS** per feature and per offer. An upsell with a 30% discount on a 35%-margin product is barely profitable, and most apps hide that. An e-commerce manager needs it.

### 5.4 Health Monitor & alerts
A status strip on the Overview (green / amber / red per feature): rendering, JS errors, app proxy latency, discount Function active (it's auto-registered in `app._index.tsx`, but nothing currently checks that it stays active). Email or push alerts on red. This directly addresses the class of silent breakage this project has already experienced.

### 5.5 Weekly revenue digest
An email every Monday: "XPoost made you X last week, your best offer, one opportunity." It keeps the app top-of-mind and makes renewal decisions easy. Later, optionally, WhatsApp.

### 5.6 Network benchmarks (the moat)
Once enough stores are installed (e.g. ≥ 50 per feature), show anonymous percentiles: "Your pre-purchase take rate is in the **top 20%** of XPoost stores in Beauty." Each new install makes the product smarter for everyone else, which is hard for competitors to copy.

### 5.7 Frequency governor
With 8 features, a single visitor can get a toast, a pre-purchase modal and an exit popup in one session. A global cap (for example, at most 2 interruptive popups per session, never within 20 seconds of each other), with its effect shown in the annoyance index, protects conversion and the brand.

---

## 6. Packaging & pricing suggestion
- **All plans:** Overview (ROI hero, KPIs, leaderboard), per-feature basics, tips, Health Monitor.
- **Premium / Lifetime:** Holdouts, A/B testing, Opportunity Engine "Fix it" automation, profit view, network benchmarks, CSV export, weekly digest.
- Use the ROI hero on the Pricing page too: "Stores like yours earn ~N× their plan cost" (once network data exists).

---

## 7. Roadmap

| Phase | Scope | Est. effort |
|---|---|---|
| **A — Data foundation** | `xp-track.js`; `proxy.t.tsx` ingest route; Prisma models + migration; session/cart attributes; `_xpoost_src` line tags in cart-engine & quantity-breaks; `read_orders` + `orders/create` / `cancelled` / `refunds` webhooks; Level 1 protected-data request; 60-day baseline backfill; instrument all 8 features. | 1–1.5 weeks |
| **B — Analytics tab v1** | `/app/analytics` Overview + 8 feature views, metric tooltips, sample-size guards, curated tips with sources, i18n (EN/AR). Lightweight charts (inline SVG or a small chart library; avoid heavy bundles in the embedded admin). | 1–1.5 weeks |
| **C — Prescriptive** | Opportunity Engine (rules above), Health Monitor + alerts, weekly digest, unique exit codes. | 1 week |
| **D — Proof & scale** | Holdouts, A/B testing, profit view (COGS), frequency governor, network benchmarks, LLM narrative. | 2 weeks+ |

Phase A should ship *before* any UI, and ideally soon: every day without tracking is baseline data the merchant will never get back.

---

## 8. Decisions needed from Ahmed
1. **Orders access:** OK to add `read_orders` and file the Level 1 protected-customer-data request? (Required for revenue. Without it, only storefront-side estimates are possible.)
2. **Holdout default:** off by default (merchant opts in), or on at 10% for new installs? On gives better proof but sacrifices a small slice of revenue.
3. **Plan gating:** does the split in §6 match how you want to sell Monthly vs Lifetime?
4. **Retention:** 30 days of raw events + unlimited daily rollups. Acceptable on the current Postgres plan?
5. **Currency:** report in shop currency only (simplest) or also presentment currency for multi-market stores?

---

## 9. Housekeeping found while reviewing (fix before public launch)
- `app/routes/api.status.tsx` is **unauthenticated** and returns every stored session (all installed shop domains and scopes), the API key and the secret's length. It should be deleted or protected.
- `proxy.config.tsx` falls back to `prisma.shop.findFirst()` when the shop can't be resolved, which can serve one store's config to another. The analytics ingest must not copy this pattern, and it should be removed here too.

---

### Sources
- [Baymard Institute: Cart abandonment rate statistics](https://baymard.com/lists/cart-abandonment-rate)
- [Wisepops: Popup statistics (1B displays)](https://wisepops.com/blog/popup-stats)
- [Digismoothie: Shopify upsell benchmarks 2026](https://www.digismoothie.com/blog/upsell-benchmarks)
- [Oxify: Cart upsell analytics (attach rate, CTR, holdouts)](https://oxify.app/blog/measure-cart-upsell-performance)
- [Growth Suite: Free shipping threshold strategy](https://www.growthsuite.net/resources/shopify-upsell-cross-sell/increase-average-order-value/free-shipping-threshold)
- [Shopify.dev: Web Pixels API, emitting custom events](https://shopify.dev/docs/api/web-pixels-api/emitting-data)
