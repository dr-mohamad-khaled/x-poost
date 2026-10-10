import { Translate } from "../components/Translate";
import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { ensureAnalyticsMeta, isBackfillRunning, startBackfill } from "../analytics.server";
import { FEATURE_KEYS, FEATURE_LABELS, localDay } from "../utils/analytics";
import {
  addDays,
  buildReport,
  MIN_VIEWS_FOR_RATE,
  type FeatureDetail,
  type FeatureRow,
  type Report,
} from "../utils/analytics-report";

const RANGES = [7, 30, 90];

const FEATURE_ROUTES: Record<string, string> = {
  prePurchase: "/app/pre-purchase",
  inCart: "/app/in-cart",
  quantityBreaks: "/app/quantity-breaks",
  shippingBar: "/app/shipping-bar",
  exitIntent: "/app/exit-intent",
  scarcity: "/app/scarcity",
  productScarcity: "/app/product-scarcity",
  socialBar: "/app/social-bar",
  thankYou: "/app/thank-you",
};

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const baseShop = await getOrCreateShop(session.shop);
  const meta = await ensureAnalyticsMeta(admin, baseShop);
  const shop = { ...baseShop, analyticsTimezone: meta.analyticsTimezone, analyticsCurrency: meta.analyticsCurrency };

  const hasOrdersScope = (session.scope || "").split(",").map((s) => s.trim()).includes("read_orders");
  if (hasOrdersScope) startBackfill(admin, shop);
  const importing = isBackfillRunning(shop.id);

  const url = new URL(request.url);
  const rangeParam = parseInt(url.searchParams.get("range") || "30", 10);
  const rangeDays = RANGES.includes(rangeParam) ? rangeParam : 30;
  const fParam = url.searchParams.get("f");
  const selectedFeature = fParam && (FEATURE_KEYS as string[]).includes(fParam) ? fParam : null;

  const today = localDay(Date.now(), shop.analyticsTimezone);
  const from = new Date(`${addDays(today, -(2 * rangeDays - 1))}T00:00:00.000Z`);

  const [stats, orders, rules, qbOffers, scarcityCfg, shippingCfg, tyOffers] = await Promise.all([
    prisma.xpDailyStat.findMany({ where: { shopId: shop.id, day: { gte: from } } }),
    prisma.xpOrder.findMany({
      where: { shopId: shop.id, day: { gte: from }, cancelled: false },
      select: { day: true, subtotal: true, directRevenue: true, discountCost: true, sourcesJson: true, influencedJson: true },
    }),
    prisma.upsellRule.findMany({ where: { shopId: shop.id }, select: { id: true, targetProductTitle: true, offerHeadline: true } }),
    prisma.quantityBreaksOffer.findMany({ where: { shopId: shop.id }, select: { id: true, title: true } }),
    prisma.scarcityWidgetConfig.findUnique({ where: { shopId: shop.id }, select: { messagesJson: true } }),
    prisma.shippingBarConfig.findUnique({ where: { shopId: shop.id }, select: { tiersJson: true } }),
    prisma.tyOffer.findMany({ where: { shopId: shop.id }, select: { id: true, name: true } }),
  ]);

  const offerNames: Record<string, string> = {};
  for (const r of rules) offerNames[r.id] = r.targetProductTitle || r.offerHeadline || "Offer";
  for (const o of qbOffers) offerNames[o.id] = o.title;
  for (const o of tyOffers) offerNames[o.id] = o.name;

  const messageNames: Record<string, string> = {};
  try {
    const msgs = JSON.parse(scarcityCfg?.messagesJson || "[]");
    if (Array.isArray(msgs)) msgs.forEach((m: any, i: number) => (messageNames[String(i)] = String(m?.text || `Message ${i + 1}`).slice(0, 70)));
  } catch {}

  let shippingTiers: number[] = [];
  try {
    const parsed = JSON.parse(shippingCfg?.tiersJson || "[]");
    const tiers = Array.isArray(parsed) ? parsed : parsed?.tiers || [];
    shippingTiers = tiers.map((t: any) => Number(t?.targetAmount)).filter((n: number) => Number.isFinite(n) && n > 0);
  } catch {}

  const report = buildReport({
    rangeDays,
    today,
    stats: stats.map((s) => ({ ...s, day: dayStr(s.day) })),
    orders: orders.map((o) => ({ ...o, day: dayStr(o.day) })),
    enabled: {
      prePurchase: shop.prePurchaseEnabled,
      inCart: shop.inCartUpsellEnabled,
      quantityBreaks: shop.quantityBreaksEnabled,
      shippingBar: shop.shippingBarEnabled,
      exitIntent: shop.exitIntentEnabled,
      scarcity: shop.scarcityEnabled,
      productScarcity: shop.productScarcityEnabled,
      socialBar: shop.socialBarEnabled,
      thankYou: shop.thankYouEnabled,
    },
    offerNames,
    messageNames,
    shippingTiers,
    selectedFeature,
  });

  return {
    report,
    currency: shop.analyticsCurrency || "USD",
    hasOrdersScope,
    importing,
  };
};

// ─────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────

function makeMoney(currency: string) {
  const make = (digits: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits });
    } catch {
      return new Intl.NumberFormat("en", { maximumFractionDigits: digits });
    }
  };
  const full = make(2);
  const whole = make(0);
  return (n: number) => (Math.abs(n) >= 1000 ? whole.format(n) : full.format(n));
}

const intFmt = new Intl.NumberFormat("en");
const fmtInt = (n: number) => intFmt.format(Math.round(n));
const fmtPct = (n: number) => `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}%`;

function rate(num: number, den: number): number | null {
  if (!den || den < MIN_VIEWS_FOR_RATE) return null;
  return (num / den) * 100;
}

type DeltaT = { text: string; dir: "up" | "down" | "flat" } | null;

function delta(cur: number, prev: number): DeltaT {
  if (!prev && !cur) return null;
  if (!prev) return { text: "new", dir: "up" };
  const d = ((cur - prev) / prev) * 100;
  if (Math.abs(d) < 0.5) return { text: "0%", dir: "flat" };
  return { text: `${d > 0 ? "+" : ""}${d.toFixed(0)}%`, dir: d > 0 ? "up" : "down" };
}

function shortDay(day: string) {
  const d = new Date(`${day}T00:00:00.000Z`);
  return d.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

// ─────────────────────────────────────────────────────────────
// Tips (published benchmarks + practical advice)
// ─────────────────────────────────────────────────────────────

type Tip = { text: string; source?: string; url?: string };
type Benchmark = { label: string; low: number; high: number; note: string; source: string; url: string };

const DIGI = { source: "Digismoothie Upsell Benchmarks 2026 (218.6M offer views, 3,199 Shopify stores)", url: "https://www.digismoothie.com/blog/upsell-benchmarks" };
const WISE = { source: "Wisepops Popup Statistics 2026 (1B popup displays)", url: "https://wisepops.com/blog/popup-stats" };
const BAYMARD = { source: "Baymard Institute, cart abandonment research", url: "https://baymard.com/lists/cart-abandonment-rate" };
const GROWTH = { source: "Growth Suite, free shipping threshold guide", url: "https://www.growthsuite.net/resources/shopify-upsell-cross-sell/increase-average-order-value/free-shipping-threshold" };

const BENCHMARKS: Record<string, Benchmark> = {
  prePurchase: { label: "Typical Shopify post-add-to-cart pop-up", low: 1.9, high: 2.4, note: "median take rate; the top quarter of stores reach about 4–5% or more", ...DIGI },
  inCart: { label: "Typical Shopify slide-cart offer", low: 1.4, high: 1.4, note: "median take rate; the middle half of stores sit between 0.6% and 2.7%", ...DIGI },
  exitIntent: { label: "Average exit-intent popup", low: 3.94, high: 3.94, note: "conversion; mostly email sign-up popups, so treat it as directional", ...WISE },
};

const TIPS: Record<string, Tip[]> = {
  prePurchase: [
    { text: "Offers with 3 products were accepted about twice as often as single-product offers (2.9% vs 1.5%). Offers with 4–5 products reached 3.1%.", ...DIGI },
    { text: "Relevance beats discounts: offers with no discount were accepted at 2.3% vs 1.5% at 21–50% off. Compare the discount cost above with the accepts it buys before raising it.", ...DIGI },
    { text: "Use the product table: remove products with many views and no accepts, and lead with your best performer." },
  ],
  inCart: [
    { text: "Slide-cart offers are passive, so their take rate runs lower than pop-ups, but they cost nothing in annoyance.", ...DIGI },
    { text: "Add-ons that are cheap next to the cart total and obviously complementary usually attach best. Many clicks but few adds usually means the price or image isn't convincing." },
    { text: "Pair it with the Free Shipping Bar: an add-on priced close to the remaining gap gives shoppers two reasons to add it." },
  ],
  quantityBreaks: [
    { text: "The number that matters most is the share of buyers choosing 2 or more units. If most still pick 1, make the 2-unit saving easier to see or narrow the price gap between tiers." },
    { text: "XPoost preselects your badge tier (or tier 2) by default. If almost everyone keeps it, test a stronger badge on tier 3." },
    { text: "For products people use up, such as skincare and haircare, describe tiers as a supply (\"2-month supply\") rather than only a % saving." },
  ],
  shippingBar: [
    { text: "Extra costs are the #1 reason shoppers abandon checkout, cited by 40% of those who leave.", ...BAYMARD },
    { text: "A common starting point is a free-shipping threshold about 30% above your average order value. XPoost calculates this from your real orders above.", ...GROWTH },
    { text: "If very few orders reach the threshold, it's probably too far away. If most orders pass it without trying, you may be giving shipping away." },
  ],
  exitIntent: [
    { text: "Popups with a countdown timer converted at 12.84% vs 4.73% without one.", ...WISE },
    { text: "Recovered revenue counts every order that used your exit code. Some of those shoppers would have bought anyway, and a shared code can leak to coupon sites, so treat it as an upper bound." },
    { text: "Mobile popups out-converted desktop in the same study (4.98% vs 3.67%). Check the device split above.", ...WISE },
  ],
  scarcity: [
    { text: "Notifications work by building trust rather than getting clicks, so a low click rate is normal. Watch closes: if more shoppers close them than click them, show them less often." },
    { text: "Messages built from real store activity are more convincing and safe. Invented purchases or stock claims are a legal risk under EU and US consumer-protection rules." },
    { text: "Compare messages in the table and keep the ones with the fewest closes." },
  ],
  productScarcity: [
    { text: "Choose design presets by their add-to-cart numbers, not by looks alone." },
    { text: "Use real Shopify inventory where you can. Invented stock counts (the manual range option) carry legal and trust risk." },
  ],
  thankYou: [
    { text: "Thank-you page offers are taken about 0.7% of the time on average, versus 2.4% for product-page pop-ups. Judge this feature by returning-customer orders (code redemptions) as much as by add-on clicks.", ...DIGI },
    { text: "Offers with 3 products were taken about twice as often as 1 (2.9% vs 1.5%). If your add-on offer shows one product, try three.", ...DIGI },
    { text: "Compare offers in the table: a reward that is redeemed rarely may have a minimum spend that is too high, or an expiry that is too short or too long." },
    { text: "Use conditions to give first-time and returning customers different offers, then compare their numbers here." },
  ],
  socialBar: [
    { text: "WhatsApp questions usually point to missing information. Put answers to the most common questions on your product pages." },
    { text: "Many \"Track my order\" questions suggest sending proactive shipping updates." },
    { text: "The channel mix shows where your community is. Put your effort into the channel shoppers actually choose." },
  ],
};

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function Analytics() {
  const { report, currency, hasOrdersScope, importing } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const money = makeMoney(currency);
  const f = report.feature;
  const qs = (range: number, feat?: string | null) => `?range=${range}${feat ? `&f=${feat}` : ""}`;

  return (
    <s-page heading="Analytics">
      <style>{STYLES}</style>
      <div className={`xpa ${navigation.state === "loading" ? "is-loading" : ""}`}>
        {/* Filters: one row above everything they scope */}
        <div className="xpa-filters">
          <div className="xpa-seg" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <Link key={r} to={qs(r, f?.key)} className={`xpa-seg-btn ${report.rangeDays === r ? "is-active" : ""}`} preventScrollReset>
                {`Last ${r} days`}
              </Link>
            ))}
          </div>
          <div className="xpa-chips" role="group" aria-label="Feature">
            <Link to={qs(report.rangeDays)} className={`xpa-chip ${!f ? "is-active" : ""}`} preventScrollReset>
              
                                        <Translate text='All features' />
                                      </Link>
            {FEATURE_KEYS.map((k) => {
              const row = report.overview.features.find((x) => x.key === k);
              return (
                <Link key={k} to={qs(report.rangeDays, k)} className={`xpa-chip ${f?.key === k ? "is-active" : ""}`} preventScrollReset>
                  <span className={`xpa-dot ${row?.enabled ? "is-on" : ""}`} aria-hidden="true" />
                  {FEATURE_LABELS[k]}
                </Link>
              );
            })}
          </div>
        </div>

        <Notices report={report} hasOrdersScope={hasOrdersScope} importing={importing} />

        {f ? <FeatureView report={report} f={f} money={money} /> : <Overview report={report} money={money} />}
      </div>
    </s-page>
  );
}

function Notices({ report, hasOrdersScope, importing }: { report: Report; hasOrdersScope: boolean; importing: boolean }) {
  const items: { tone: "info" | "warn"; title: string; body: string }[] = [];
  if (!hasOrdersScope) {
    items.push({
      tone: "warn",
      title: "Revenue tracking needs one more permission",
      body: "XPoost needs access to read orders to calculate revenue. Reopen the app and approve the updated permissions when Shopify asks.",
    });
  } else if (importing) {
    items.push({ tone: "info", title: "Importing your last 60 days of orders", body: "This runs in the background. Refresh in a minute to see your order history." });
  }
  if (!report.overview.hasStorefrontData) {
    items.push({
      tone: "info",
      title: "Waiting for storefront data",
      body: "Views and clicks appear as shoppers visit your store. Make sure the XPoost app embeds are turned on in your theme editor.",
    });
  }
  if (items.length === 0) return null;
  return (
    <div className="xpa-notices">
      {items.map((n) => (
        <div key={n.title} className={`xpa-notice xpa-notice--${n.tone}`} role="status">
          <span className="xpa-notice-icon" aria-hidden="true">{n.tone === "warn" ? "!" : "i"}</span>
          <div>
            <strong>{n.title}</strong>
            <p>{n.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────

function Overview({ report, money }: { report: Report; money: (n: number) => string }) {
  const o = report.overview;
  const share = o.storeRevenue > 0 ? (o.directRevenue / o.storeRevenue) * 100 : 0;
  const aovLift = o.aovWithout > 0 && o.aovWith > 0 ? ((o.aovWith - o.aovWithout) / o.aovWithout) * 100 : null;
  const ctr = rate(o.clicks, o.views);
  const highlights = buildHighlights(report, money);

  return (
    <>
      <section className="xpa-hero" aria-label="XPoost revenue">
        <div>
          <div className="xpa-eyebrow"><Translate text='XPoost direct revenue · last' /> {report.rangeDays}  <Translate text='days' /></div>
          <div className="xpa-hero-row">
            <span className="xpa-hero-num">{money(o.directRevenue)}</span>
            <Delta d={delta(o.directRevenue, o.prevDirectRevenue)} suffix="vs previous period" />
          </div>
          <p className="xpa-hero-sub">
            {o.storeRevenue > 0
              ? `${fmtPct(share)} of your store's revenue · ${fmtInt(o.ordersWithXp)} order${o.ordersWithXp === 1 ? "" : "s"} included an XPoost item`
              : "Revenue from items XPoost added to carts appears here as orders come in."}
          </p>
        </div>
        <div className="xpa-hero-side">
          <div className="xpa-hero-side-label"><Translate text='Influenced revenue' /></div>
          <div className="xpa-hero-side-num">{money(o.influencedRevenue)}</div>
          <p><Translate text='Orders from shoppers who saw an XPoost feature in the 7 days before buying.' /></p>
        </div>
      </section>

      <div className="xpa-tiles">
        <Tile label="Orders with XPoost items" value={fmtInt(o.ordersWithXp)} d={delta(o.ordersWithXp, o.prevOrdersWithXp)} hint={o.orders ? `of ${fmtInt(o.orders)} orders` : undefined} />
        <Tile
          label="Average order with XPoost items"
          value={o.aovWith ? money(o.aovWith) : "—"}
          hint={aovLift !== null ? `${aovLift >= 0 ? "+" : ""}${aovLift.toFixed(0)}% vs orders without (${money(o.aovWithout)})` : "Needs orders with and without XPoost items"}
        />
        <Tile label="Views" value={fmtInt(o.views)} d={delta(o.views, o.prevViews)} hint={o.sessions ? `${fmtInt(o.sessions)} store sessions` : undefined} />
        <Tile label="Click rate" value={ctr === null ? "—" : fmtPct(ctr)} hint={ctr === null ? `Shown after ${MIN_VIEWS_FOR_RATE} views` : `${fmtInt(o.clicks)} clicks`} />
        <Tile
          label="Discount cost"
          value={money(o.discountCost)}
          hint={o.directRevenue > 0 ? `${fmtPct((o.discountCost / (o.directRevenue + o.discountCost)) * 100)} of XPoost item value` : "Discounts on XPoost items"}
        />
      </div>

      <section className="xpa-card">
        <div className="xpa-card-head">
          <h2><Translate text='Direct revenue per day' /></h2>
        </div>
        <ColumnChart days={report.days} values={o.daily} format={money} seriesLabel="Direct revenue" />
      </section>

      {highlights.length > 0 && (
        <section className="xpa-card">
          <div className="xpa-card-head">
            <h2><Translate text='Highlights' /></h2>
          </div>
          <ul className="xpa-highlights">
            {highlights.map((h, i) => (
              <li key={i} className={`xpa-hl xpa-hl--${h.tone}`}>
                <span className="xpa-hl-icon" aria-hidden="true">{h.tone === "warn" ? "!" : h.tone === "good" ? "↑" : "•"}</span>
                <span>
                  {h.text}{" "}
                  {h.link ? (
                    <Link to={h.link} className="xpa-link">
                      {h.linkText}  <Translate text='&rarr;' />
                                                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="xpa-card">
        <div className="xpa-card-head">
          <h2><Translate text='Feature performance' /></h2>
          <span className="xpa-muted"><Translate text='Rates appear after' /> {MIN_VIEWS_FOR_RATE}  <Translate text='views' /></span>
        </div>
        <div className="xpa-table-wrap">
          <table className="xpa-table">
            <thead>
              <tr>
                <th scope="col"><Translate text='Feature' /></th>
                <th scope="col" className="num"><Translate text='Views' /></th>
                <th scope="col" className="num"><Translate text='Actions' /></th>
                <th scope="col" className="num"><Translate text='Action rate' /></th>
                <th scope="col" className="num"><Translate text='Direct revenue' /></th>
                <th scope="col" className="num"><Translate text='Influenced' /></th>
              </tr>
            </thead>
            <tbody>
              {o.features.map((row) => (
                <FeatureTableRow key={row.key} row={row} range={report.rangeDays} money={money} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="xpa-footnote">
          
                            <Translate text='Direct revenue counts items XPoost added (tagged on the order line) after discounts, plus orders that used your exit-intent code.
                            Influenced revenue can count one order under several features.' />
                          </p>
      </section>
    </>
  );
}

function FeatureTableRow({ row, range, money }: { row: FeatureRow; range: number; money: (n: number) => string }) {
  const r = rate(row.actions, row.views);
  const isLegacy = row.key === "upsellLegacy";
  return (
    <tr>
      <th scope="row">
        {isLegacy ? (
          <span className="xpa-feature-cell">{row.label}</span>
        ) : (
          <Link to={`?range=${range}&f=${row.key}`} className="xpa-feature-cell xpa-link-plain">
            <span className={`xpa-dot ${row.enabled ? "is-on" : ""}`} aria-hidden="true" />
            {row.label}
            {!row.enabled && <span className="xpa-off"><Translate text='Off' /></span>}
          </Link>
        )}
      </th>
      <td className="num">{isLegacy ? "—" : fmtInt(row.views)}</td>
      <td className="num">
        {isLegacy ? "—" : fmtInt(row.actions)}
        {!isLegacy && <span className="xpa-cell-sub">{row.actionLabel.toLowerCase()}</span>}
      </td>
      <td className="num">{r === null ? <span className="xpa-muted">—</span> : fmtPct(r)}</td>
      <td className="num strong">{row.directRevenue ? money(row.directRevenue) : <span className="xpa-muted">—</span>}</td>
      <td className="num">{row.influencedRevenue ? money(row.influencedRevenue) : <span className="xpa-muted">—</span>}</td>
    </tr>
  );
}

type Highlight = { tone: "good" | "warn" | "info"; text: string; link?: string; linkText?: string };

function buildHighlights(report: Report, money: (n: number) => string): Highlight[] {
  const o = report.overview;
  const out: Highlight[] = [];
  const top = o.features.find((f) => f.directRevenue > 0 && f.key !== "upsellLegacy");
  if (top) {
    out.push({ tone: "good", text: `${top.label} is your top earner with ${money(top.directRevenue)} in direct revenue.`, link: `?range=${report.rangeDays}&f=${top.key}`, linkText: "See details" });
  }
  if (o.aovWith > 0 && o.aovWithout > 0 && o.aovWith > o.aovWithout) {
    const lift = ((o.aovWith - o.aovWithout) / o.aovWithout) * 100;
    out.push({ tone: "good", text: `Orders that include an XPoost item are ${lift.toFixed(0)}% larger on average (${money(o.aovWith)} vs ${money(o.aovWithout)}).` });
  }
  if (o.hasStorefrontData) {
    for (const f of o.features) {
      if (f.enabled && f.views === 0 && FEATURE_ROUTES[f.key]) {
        out.push({
          tone: "warn",
          text: `${f.label} is turned on but had no views in this period. Check that its app embed or theme block is added in the theme editor.`,
          link: FEATURE_ROUTES[f.key],
          linkText: "Open settings",
        });
      }
    }
  }
  for (const f of o.features) {
    if (f.views >= MIN_VIEWS_FOR_RATE && f.dismissals > f.actions * 3 && f.dismissals / f.views > 0.5) {
      out.push({
        tone: "warn",
        text: `${f.label} is closed by more than half of the shoppers who see it. Consider showing it less often or later.`,
        link: FEATURE_ROUTES[f.key],
        linkText: "Adjust",
      });
    }
  }
  return out.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────
// Feature view
// ─────────────────────────────────────────────────────────────

function FeatureView({ report, f, money }: { report: Report; f: FeatureDetail; money: (n: number) => string }) {
  const actionRate = rate(f.actions, f.views);
  const bench = BENCHMARKS[f.key];
  const earns = f.dailyMetric === "revenue";
  const showClosed = f.dismissals > 0 || ["prePurchase", "exitIntent", "scarcity"].includes(f.key);
  const [showTable, setShowTable] = useState(false);

  return (
    <>
      <div className="xpa-feature-head">
        <div>
          <Link to={`?range=${report.rangeDays}`} className="xpa-link" preventScrollReset>
            
                                  <Translate text='&larr; All features' />
                                </Link>
          <h2 className="xpa-feature-title">
            {f.label}
            <span className={`xpa-status ${f.enabled ? "is-on" : ""}`}>{f.enabled ? "Active" : "Off"}</span>
          </h2>
        </div>
        <Link to={FEATURE_ROUTES[f.key]} className="xpa-btn">
          
                            <Translate text='Feature settings' />
                          </Link>
      </div>

      <div className="xpa-tiles">
        <Tile label="Views" value={fmtInt(f.views)} d={delta(f.views, f.prev.views)} />
        <Tile label={f.actionLabel} value={fmtInt(f.actions)} d={delta(f.actions, f.prev.actions)} />
        <Tile
          label="Action rate"
          value={actionRate === null ? "—" : fmtPct(actionRate)}
          hint={actionRate === null ? `Needs ${fmtInt(Math.max(0, MIN_VIEWS_FOR_RATE - f.views))} more views` : `${f.actionLabel.toLowerCase()} ÷ views`}
        />
        {earns && <Tile label="Direct revenue" value={money(f.directRevenue)} d={delta(f.directRevenue, f.prev.directRevenue)} hint={f.directOrders ? `${fmtInt(f.directOrders)} orders` : undefined} />}
        <Tile label="Influenced revenue" value={money(f.influencedRevenue)} hint="Orders from shoppers who saw it" />
        {showClosed && <Tile label="Closed" value={fmtInt(f.dismissals)} hint={f.views ? `${fmtPct((f.dismissals / f.views) * 100)} of views` : undefined} />}
        {earns && f.discountCost > 0 && <Tile label="Discount cost" value={money(f.discountCost)} hint="Discounts on these items" />}
      </div>

      {bench && (
        <section className="xpa-bench">
          <div>
            <div className="xpa-eyebrow"><Translate text='Benchmark' /></div>
            <p>
              <strong>{bench.label}:</strong> {bench.low === bench.high ? `${bench.low}%` : `${bench.low}–${bench.high}%`} {bench.note}.
            </p>
            <p className="xpa-source">
              
                                        <Translate text='Source:' />{" "}
              <a href={bench.url} target="_blank" rel="noreferrer">
                {bench.source}
              </a>
            </p>
          </div>
          <div className="xpa-bench-you">
            <span className="xpa-bench-you-label"><Translate text='Your rate' /></span>
            <span className="xpa-bench-you-num">{actionRate === null ? "—" : fmtPct(actionRate)}</span>
            <span className="xpa-bench-you-note">
              {actionRate === null
                ? "Not enough views yet"
                : actionRate >= bench.high
                  ? "At or above typical"
                  : actionRate >= bench.low * 0.6
                    ? "Close to typical"
                    : "Below typical"}
            </span>
          </div>
        </section>
      )}

      <section className="xpa-card">
        <div className="xpa-card-head">
          <h2>{earns ? "Direct revenue per day" : "Views per day"}</h2>
          <button type="button" className="xpa-text-btn" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
            {showTable ? "Hide table" : "View as table"}
          </button>
        </div>
        <ColumnChart days={report.days} values={f.daily} format={earns ? money : fmtInt} seriesLabel={earns ? "Direct revenue" : "Views"} />
        {showTable && (
          <div className="xpa-table-wrap xpa-mini-table">
            <table className="xpa-table">
              <thead>
                <tr>
                  <th scope="col"><Translate text='Day' /></th>
                  <th scope="col" className="num">{earns ? "Direct revenue" : "Views"}</th>
                </tr>
              </thead>
              <tbody>
                {report.days.map((d, i) => (
                  <tr key={d}>
                    <th scope="row">{shortDay(d)}</th>
                    <td className="num">{earns ? money(f.daily[i]) : fmtInt(f.daily[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {f.shipping && <ShippingCard s={f.shipping} money={money} />}
      {f.exitIntent && (
        <section className="xpa-card">
          <div className="xpa-card-head">
            <h2><Translate text='Recovered orders' /></h2>
          </div>
          <div className="xpa-tiles xpa-tiles--inline">
            <Tile label="Orders that used your exit code" value={fmtInt(f.exitIntent.redemptions)} />
            <Tile label="Their revenue" value={money(f.exitIntent.recovered)} hint="Upper bound: some would have bought anyway" />
          </div>
        </section>
      )}

      <div className="xpa-grid-2">
        {f.offers.length > 0 && (
          <section className="xpa-card">
            <div className="xpa-card-head">
              <h2>{f.offerTitle}</h2>
            </div>
            <div className="xpa-table-wrap">
              <table className="xpa-table">
                <thead>
                  <tr>
                    <th scope="col">{f.key === "scarcity" ? "Message" : f.key === "prePurchase" ? "Product" : "Offer"}</th>
                    <th scope="col" className="num"><Translate text='Views' /></th>
                    <th scope="col" className="num">{f.key === "scarcity" ? "Clicks" : "Adds"}</th>
                    <th scope="col" className="num"><Translate text='Rate' /></th>
                    <th scope="col" className="num">{f.key === "scarcity" ? "Closed" : "Revenue"}</th>
                  </tr>
                </thead>
                <tbody>
                  {f.offers.map((b) => {
                    const act = f.key === "scarcity" ? b.clicks : b.actions;
                    const r = rate(act, b.views);
                    return (
                      <tr key={b.id || "untagged"}>
                        <th scope="row" className="xpa-name-cell">{b.name}</th>
                        <td className="num">{fmtInt(b.views)}</td>
                        <td className="num">{fmtInt(act)}</td>
                        <td className="num">{r === null ? <span className="xpa-muted">—</span> : fmtPct(r)}</td>
                        <td className="num">{f.key === "scarcity" ? fmtInt(b.dismissals) : b.revenue ? money(b.revenue) : <span className="xpa-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {f.dims && (
          <section className="xpa-card">
            <div className="xpa-card-head">
              <h2>{f.dims.title}</h2>
            </div>
            {f.dims.rows.length === 0 ? <p className="xpa-muted"><Translate text='No data in this period yet.' /></p> : <BarList rows={f.dims.rows} unit={f.dims.valueLabel} />}
          </section>
        )}

        <section className="xpa-card">
          <div className="xpa-card-head">
            <h2><Translate text='Mobile vs desktop' /></h2>
          </div>
          <DeviceSplit f={f} />
        </section>
      </div>

      <section className="xpa-card xpa-tips">
        <div className="xpa-card-head">
          <h2><Translate text='Tips to improve' /> {f.label}</h2>
        </div>
        <ol>
          {(TIPS[f.key] || []).map((t, i) => (
            <li key={i}>
              <p>{t.text}</p>
              {t.source && (
                <p className="xpa-source">
                  
                                            <Translate text='Source:' />{" "}
                  <a href={t.url} target="_blank" rel="noreferrer">
                    {t.source}
                  </a>
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function ShippingCard({ s, money }: { s: NonNullable<FeatureDetail["shipping"]>; money: (n: number) => string }) {
  const ratio = s.aov > 0 ? (s.threshold / s.aov - 1) * 100 : 0;
  let verdict = "Your threshold is in a sensible range for your order sizes.";
  if (ratio > 60) verdict = `Your threshold is ${ratio.toFixed(0)}% above your average order, which may feel out of reach. Consider testing about ${money(s.suggested)}.`;
  else if (ratio < 10) verdict = `Your threshold is close to (or below) your average order, so many orders qualify without adding anything. Consider testing about ${money(s.suggested)}.`;
  return (
    <section className="xpa-card">
      <div className="xpa-card-head">
        <h2><Translate text='Is your free-shipping threshold right?' /></h2>
        <span className="xpa-muted"><Translate text='Based on' /> {fmtInt(s.ordersCounted)}  <Translate text='orders' /></span>
      </div>
      <div className="xpa-tiles xpa-tiles--inline">
        <Tile label="Average order" value={money(s.aov)} />
        <Tile label="First reward at" value={money(s.threshold)} hint={`${ratio >= 0 ? "+" : ""}${ratio.toFixed(0)}% vs average order`} />
        <Tile label="Orders reaching it" value={`${s.reachedPct}%`} />
        <Tile label="Just missed (within 20%)" value={`${s.nearMissPct}%`} />
      </div>
      <p className="xpa-verdict">{verdict}</p>
    </section>
  );
}

function DeviceSplit({ f }: { f: FeatureDetail }) {
  const rows = [
    { key: "m", label: "Mobile", ...f.devices.m },
    { key: "d", label: "Desktop", ...f.devices.d },
  ];
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <ul className="xpa-devices">
      {rows.map((r) => {
        const rt = rate(r.actions, r.views);
        return (
          <li key={r.key}>
            <div className="xpa-device-top">
              <span>{r.label}</span>
              <span className="xpa-device-val">
                {fmtInt(r.views)}  <Translate text='views ·' /> {rt === null ? `rate after ${MIN_VIEWS_FOR_RATE} views` : `${fmtPct(rt)} ${f.actionLabel.toLowerCase()}`}
              </span>
            </div>
            <div className="xpa-bar-track" aria-hidden="true">
              <div className="xpa-bar-fill" style={{ width: `${(r.views / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────
// Charts and small components
// ─────────────────────────────────────────────────────────────

function Delta({ d, suffix }: { d: DeltaT; suffix?: string }) {
  if (!d) return null;
  return (
    <span className={`xpa-delta xpa-delta--${d.dir}`}>
      <span aria-hidden="true">{d.dir === "up" ? "▲" : d.dir === "down" ? "▼" : "■"}</span> {d.text}
      {suffix ? <span className="xpa-delta-suffix"> {suffix}</span> : null}
    </span>
  );
}

function Tile({ label, value, hint, d }: { label: string; value: string; hint?: string; d?: DeltaT }) {
  return (
    <div className="xpa-tile">
      <span className="xpa-tile-label">{label}</span>
      <span className="xpa-tile-value">{value}</span>
      {d ? <Delta d={d} /> : null}
      {hint ? <span className="xpa-tile-hint">{hint}</span> : null}
    </div>
  );
}

function BarList({ rows, unit }: { rows: { label: string; value: number; sub?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="xpa-barlist">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="xpa-device-top">
            <span className="xpa-barlist-label">{r.label}</span>
            <span className="xpa-device-val">
              {fmtInt(r.value)} {unit}
              {r.sub ? ` · ${r.sub}` : ""}
            </span>
          </div>
          <div className="xpa-bar-track" aria-hidden="true">
            <div className="xpa-bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

function ColumnChart({ days, values, format, seriesLabel }: { days: string[]; values: number[]; format: (n: number) => string; seriesLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the container's real pixel width so text and bars never scale
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 200;
  const pad = { l: 64, r: 8, t: 12, b: 26 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const n = Math.max(1, values.length);
  const max = niceMax(Math.max(0, ...values));
  const slot = plotW / n;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelIdx = n <= 7 && W >= 420 ? values.map((_, i) => i) : n <= 7 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
  const total = values.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div ref={boxRef} className="xpa-empty-chart">
        
                    <Translate text='No' /> {seriesLabel.toLowerCase()}  <Translate text='in this period yet.' />
                  </div>
    );
  }

  return (
    <div ref={boxRef} className="xpa-chart">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${seriesLabel} per day, ${shortDay(days[0])} to ${shortDay(days[days.length - 1])}. Total ${format(total)}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? "xpa-axis" : "xpa-grid"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="xpa-tick">
              {format(t)}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const x = pad.l + i * slot + (slot - barW) / 2;
          const top = y(v);
          const h = pad.t + plotH - top;
          const r = Math.min(4, h, barW / 2);
          const d =
            h <= 0
              ? ""
              : `M${x},${pad.t + plotH} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${pad.t + plotH} Z`;
          return (
            <g key={days[i]}>
              {d && <path d={d} className={`xpa-col ${hover === i ? "is-hover" : ""}`} />}
              <rect
                x={pad.l + i * slot}
                y={pad.t}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${shortDay(days[i])}: ${format(v)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text
            key={`l${i}`}
            x={pad.l + i * slot + slot / 2}
            y={H - 6}
            textAnchor={labelIdx.length <= 3 && i === 0 ? "start" : labelIdx.length <= 3 && i === n - 1 ? "end" : "middle"}
            className="xpa-tick"
          >
            {shortDay(days[i])}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="xpa-tooltip"
          style={{ left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%`, top: `${(Math.max(pad.t + 30, y(values[hover])) / H) * 100}%` }}
          role="status"
        >
          <strong>{format(values[hover])}</strong>
          <span>
            <i className="xpa-key" aria-hidden="true" />
            {seriesLabel} · {shortDay(days[hover])}
          </span>
        </div>
      )}
    </div>
  );
}

const STYLES = `
  .xpa {
    --xpa-surface: #16140F;
    --xpa-surface-2: #0f0f0f;
    --xpa-border: #2E2A22;
    --xpa-ink: #ffffff;
    --xpa-ink-2: #c3c2b7;
    --xpa-muted: #898781;
    --xpa-grid: #2e2b22;
    --xpa-axis: #383835;
    --xpa-gold: #C9B78F;
    --xpa-series: #B08D2C;
    --xpa-good: #0ca30c;
    --xpa-bad: #e66767;
    color: var(--xpa-ink);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: opacity 0.2s ease;
  }
  .xpa.is-loading { opacity: 0.55; }
  .xpa h2 { margin: 0; font-size: 15px; font-weight: 700; color: var(--xpa-ink); }

  .xpa-filters { display: flex; flex-direction: column; gap: 10px; }
  .xpa-seg { display: inline-flex; background: var(--xpa-surface); border: 1px solid var(--xpa-border); border-radius: 10px; padding: 3px; align-self: flex-start; flex-wrap: wrap; }
  .xpa-seg-btn { padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; color: var(--xpa-ink-2); text-decoration: none; }
  .xpa-seg-btn:hover { color: var(--xpa-ink); background: rgba(255,255,255,0.04); }
  .xpa-seg-btn.is-active { background: #0E0D0B; color: var(--xpa-gold);}
  .xpa-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .xpa-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--xpa-border); background: var(--xpa-surface); color: var(--xpa-ink-2); font-size: 12px; font-weight: 600; text-decoration: none; }
  .xpa-chip:hover { color: var(--xpa-ink); border-color: rgba(201,183,143,0.45); }
  .xpa-chip.is-active { color: var(--xpa-gold); border-color: var(--xpa-gold); background: #0E0D0B; }
  .xpa-seg-btn:focus-visible, .xpa-chip:focus-visible, .xpa-link:focus-visible, .xpa-btn:focus-visible, .xpa-text-btn:focus-visible, .xpa-link-plain:focus-visible { outline: 2px solid var(--xpa-gold); outline-offset: 2px; }
  .xpa-dot { width: 7px; height: 7px; border-radius: 50%; background: #4A443A; flex-shrink: 0; }
  .xpa-dot.is-on { background: #4ade80; }

  .xpa-notices { display: flex; flex-direction: column; gap: 8px; }
  .xpa-notice { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; background: var(--xpa-surface); border: 1px solid var(--xpa-border); }
  .xpa-notice--warn { border-color: rgba(250,178,25,0.45); }
  .xpa-notice strong { font-size: 13px; }
  .xpa-notice p { margin: 2px 0 0; font-size: 12px; color: var(--xpa-ink-2); line-height: 1.5; }
  .xpa-notice-icon { width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: #2A261E; color: var(--xpa-ink-2); }
  .xpa-notice--warn .xpa-notice-icon { background: #fab219; color: #0E0D0B; }

  .xpa-hero { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding: 22px 24px; border-radius: 14px; background: #0E0D0B; border: 1px solid rgba(201,183,143,0.3); }
  .xpa-eyebrow { font-size: 11px; font-weight: 700; color: var(--xpa-gold); margin-bottom: 6px; }
  .xpa-hero-row { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .xpa-hero-num { font-size: 48px; font-weight: 700; line-height: 1.05; letter-spacing: -1px; }
  .xpa-hero-sub { margin: 8px 0 0; font-size: 13px; color: var(--xpa-ink-2); }
  .xpa-hero-side { min-width: 220px; max-width: 300px; padding-inline-start: 20px; border-inline-start: 1px solid rgba(201,183,143,0.2); }
  .xpa-hero-side-label { font-size: 12px; color: var(--xpa-ink-2); font-weight: 600; }
  .xpa-hero-side-num { font-size: 24px; font-weight: 700; margin: 4px 0; }
  .xpa-hero-side p { margin: 0; font-size: 11.5px; color: var(--xpa-muted); line-height: 1.45; }

  .xpa-delta { font-size: 12px; font-weight: 700; white-space: nowrap; }
  .xpa-delta--up { color: var(--xpa-good); }
  .xpa-delta--down { color: var(--xpa-bad); }
  .xpa-delta--flat { color: var(--xpa-muted); }
  .xpa-delta-suffix { color: var(--xpa-muted); font-weight: 500; }

  .xpa-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .xpa-tiles--inline { margin-top: 4px; }
  .xpa-tile { background: var(--xpa-surface); border: 1px solid var(--xpa-border); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .xpa-tiles--inline .xpa-tile { background: var(--xpa-surface-2); }
  .xpa-tile-label { font-size: 12px; color: var(--xpa-ink-2); font-weight: 600; }
  .xpa-tile-value { font-size: 22px; font-weight: 700; }
  .xpa-tile-hint { font-size: 11.5px; color: var(--xpa-muted); line-height: 1.4; }

  .xpa-card { background: var(--xpa-surface); border: 1px solid var(--xpa-border); border-radius: 14px; padding: 18px 20px; min-width: 0; }
  .xpa-card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .xpa-muted { color: var(--xpa-muted); font-size: 12px; }
  .xpa-footnote { margin: 12px 0 0; font-size: 11.5px; color: var(--xpa-muted); line-height: 1.5; }
  .xpa-link { color: var(--xpa-gold); font-size: 12.5px; font-weight: 600; text-decoration: none; }
  .xpa-link:hover { text-decoration: underline; }
  .xpa-link-plain { color: inherit; text-decoration: none; }
  .xpa-link-plain:hover { color: var(--xpa-gold); }
  .xpa-btn { font-size: 12.5px; font-weight: 700; color: var(--xpa-gold); border: 1px solid rgba(201,183,143,0.5); padding: 8px 14px; border-radius: 8px; text-decoration: none; white-space: nowrap; }
  .xpa-btn:hover { background: rgba(201,183,143,0.1); }
  .xpa-text-btn { background: none; border: none; color: var(--xpa-gold); font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0; }

  .xpa-chart { position: relative; }
  .xpa-chart svg { display: block; max-width: 100%; overflow: visible; }
  .xpa-grid { stroke: var(--xpa-grid); stroke-width: 1; }
  .xpa-axis { stroke: var(--xpa-axis); stroke-width: 1; }
  .xpa-tick { fill: var(--xpa-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .xpa-col { fill: var(--xpa-series); transition: fill 0.12s ease; }
  .xpa-col.is-hover { fill: var(--xpa-gold); }
  .xpa-chart rect:focus { outline: none; }
  .xpa-tooltip { position: absolute; transform: translate(-50%, calc(-100% - 10px)); background: #0E0D0B; border: 1px solid #3A352B; border-radius: 8px; padding: 7px 10px; pointer-events: none; display: flex; flex-direction: column; gap: 2px; white-space: nowrap; box-shadow: 0 6px 18px rgba(0,0,0,0.45); z-index: 2; }
  .xpa-tooltip strong { font-size: 13px; }
  .xpa-tooltip span { font-size: 11px; color: var(--xpa-ink-2); display: inline-flex; align-items: center; gap: 6px; }
  .xpa-key { display: inline-block; width: 12px; height: 3px; border-radius: 2px; background: var(--xpa-series); }
  .xpa-empty-chart { padding: 36px 12px; text-align: center; color: var(--xpa-muted); font-size: 13px; border: 1px solid var(--xpa-border); border-radius: 10px; background: var(--xpa-surface-2); }

  .xpa-table-wrap { overflow-x: auto; }
  .xpa-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .xpa-table th, .xpa-table td { padding: 10px; border-bottom: 1px solid #1d1a14; text-align: start; vertical-align: middle; }
  .xpa-table thead th { font-size: 11.5px; font-weight: 600; color: var(--xpa-muted); border-bottom-color: var(--xpa-border); white-space: nowrap; }
  .xpa-table tbody th { font-weight: 600; min-width: 150px; }
  .xpa-table .num { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .xpa-table .strong { font-weight: 700; }
  .xpa-cell-sub { display: block; font-size: 10.5px; color: var(--xpa-muted); font-weight: 500; }
  .xpa-feature-cell { display: inline-flex; align-items: center; gap: 8px; }
  .xpa-off { font-size: 10px; font-weight: 700; color: var(--xpa-muted); border: 1px solid #3A352B; border-radius: 999px; padding: 1px 6px; }
  .xpa-name-cell { max-width: 260px; overflow-wrap: anywhere; }
  .xpa-mini-table { margin-top: 12px; max-height: 280px; overflow-y: auto; }

  .xpa-highlights { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .xpa-hl { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 1.5; color: var(--xpa-ink-2); }
  .xpa-hl-icon { width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: #2A261E; color: var(--xpa-ink-2); }
  .xpa-hl--good .xpa-hl-icon { background: rgba(12,163,12,0.18); color: var(--xpa-good); }
  .xpa-hl--warn .xpa-hl-icon { background: #fab219; color: #0E0D0B; }

  .xpa-feature-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .xpa .xpa-feature-title { font-size: 22px; margin-top: 6px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .xpa-status { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: #2A261E; color: var(--xpa-muted); border: 1px solid #3A352B; }
  .xpa-status.is-on { background: rgba(16,128,67,0.2); color: #4ade80; border-color: rgba(74,222,128,0.3); }

  .xpa-bench { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; align-items: center; padding: 16px 20px; border-radius: 14px; background: var(--xpa-surface); border: 1px solid rgba(201,183,143,0.3); }
  .xpa-bench p { margin: 0; font-size: 13px; color: var(--xpa-ink-2); line-height: 1.5; }
  .xpa-bench strong { color: var(--xpa-ink); }
  .xpa-bench > div:first-child { flex: 1 1 320px; }
  .xpa-bench-you { display: flex; flex-direction: column; align-items: flex-end; min-width: 140px; }
  .xpa-bench-you-label { font-size: 11px; color: var(--xpa-muted); font-weight: 600; }
  .xpa-bench-you-num { font-size: 26px; font-weight: 700; }
  .xpa-bench-you-note { font-size: 12px; color: var(--xpa-ink-2); }
  .xpa .xpa-source { margin: 4px 0 0; font-size: 11px; color: var(--xpa-muted); }
  .xpa-source a { color: #9a9890; text-underline-offset: 2px; }

  .xpa-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
  .xpa-devices, .xpa-barlist { display: flex; flex-direction: column; gap: 14px; list-style: none; margin: 0; padding: 0; }
  .xpa-device-top { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; margin-bottom: 6px; }
  .xpa-device-val { color: var(--xpa-ink-2); font-size: 12px; font-variant-numeric: tabular-nums; text-align: end; }
  .xpa-barlist-label::first-letter { text-transform: uppercase; }
  .xpa-bar-track { height: 8px; border-radius: 4px; background: #1d1a14; overflow: hidden; }
  .xpa-bar-fill { height: 100%; border-start-end-radius: 4px; border-end-end-radius: 4px; background: var(--xpa-series); min-width: 2px; }
  .xpa-verdict { margin: 14px 0 0; font-size: 13px; color: var(--xpa-ink); line-height: 1.5; }

  .xpa-tips ol { margin: 0; padding-inline-start: 20px; display: flex; flex-direction: column; gap: 12px; }
  .xpa-tips li { color: var(--xpa-ink-2); font-size: 13px; line-height: 1.55; }
  .xpa-tips li p { margin: 0; }

  @media (max-width: 640px) {
    .xpa-hero { padding: 18px 16px; }
    .xpa-hero-num { font-size: 36px; }
    .xpa-hero-side { padding-inline-start: 0; border-inline-start: none; border-top: 1px solid rgba(201,183,143,0.2); padding-top: 12px; max-width: none; }
    .xpa-card { padding: 16px 14px; }
    .xpa-bench-you { align-items: flex-start; }
    .xpa-grid-2 { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    .xpa, .xpa-col { transition: none; }
  }
`;
