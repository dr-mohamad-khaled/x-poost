import { Translate } from "../components/Translate";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, Link, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop, getShopWithConfigs } from "../shop.server";
import { ensureUpsellDiscountRegistered } from "../discount.server";
import { EXIT_INTENT_AVAILABLE } from "../utils/features";
import { FeatureDemo, type DemoId } from "../components/FeatureDemo";
import { HeroBanner } from "../components/HeroBanner";

let discountRegisteredShops = new Set<string>();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopData = await getShopWithConfigs(session.shop);

  // Auto-register the Shopify Functions product discount once per shop session
  if (!discountRegisteredShops.has(session.shop)) {
    ensureUpsellDiscountRegistered(admin)
      .then(() => discountRegisteredShops.add(session.shop))
      .catch((err) => console.error("[xpoost] Error registering upsell discount:", err));
  }

  const tyActive = await prisma.tyOffer.count({ where: { shopId: shopData?.id ?? "", enabled: true } });

  return {
    shopDomain: session.shop,
    features: {
      prePurchase: {
        id: "prePurchase",
        title: "Pre-Purchase Upsell Modal",
        description: "Present high-value complementary upgrades immediately after shoppers click Add to Cart, before they proceed to checkout.",
        route: "/app/pre-purchase",
        enabled: shopData?.prePurchaseEnabled ?? false,
        badge: (shopData?.upsellRules?.filter((r) => r.type === "PRE_PURCHASE" && r.active).length ?? 0) > 0 ? "Active" : "No rules active",
      },
      inCart: {
        id: "inCart",
        title: "Cart Drawer Upsell & Cross-Sell",
        description: "Recommend personalized add-ons directly inside your theme's slide-out cart drawer with seamless 1-click addition.",
        route: "/app/in-cart",
        enabled: shopData?.inCartUpsellEnabled ?? false,
        badge: (shopData?.upsellRules?.filter((r) => r.type === "IN_CART" && r.active).length ?? 0) > 0 ? "Active" : "No rules active",
      },
      thankYou: {
        id: "thankYou",
        title: "Thank-You Page Upsell & Rewards",
        description: "Turn the order confirmation page into extra revenue: a unique next-order code, matching products, or a ship-together countdown, with conditions and translations.",
        route: "/app/thank-you",
        enabled: shopData?.thankYouEnabled ?? false,
        badge: tyActive > 0 ? `${tyActive} Active` : "No active offers",
      },
      shippingBar: {
        id: "shippingBar",
        title: "Tiered Free Shipping Progress Bar",
        description: "Motivate shoppers to increase cart totals with an interactive milestone bar showing progress toward free shipping and perks.",
        route: "/app/shipping-bar",
        enabled: shopData?.shippingBarEnabled ?? false,
        badge: shopData?.shippingConfig?.active ? "Active" : "Disabled",
      },
      quantityBreaks: {
        id: "quantityBreaks",
        title: "Quantity Breaks & Tiered Pricing",
        description: "Incentivize larger orders by offering volume discounts with custom animated tier cards on product pages.",
        route: "/app/quantity-breaks",
        enabled: shopData?.quantityBreaksEnabled ?? false,
        badge: (shopData?.quantityBreaksOffers?.filter((o: any) => o.status === "ACTIVE").length ?? 0) > 0
          ? `${shopData?.quantityBreaksOffers?.filter((o: any) => o.status === "ACTIVE").length} Active`
          : "No active offers",
      },
      productScarcity: {
        id: "productScarcity",
        title: "Product Stock Scarcity Block",
        description: "Display live low-stock meters, flash demand bars, and urgency badges directly on your product pages with 4 high-converting designs.",
        route: "/app/product-scarcity",
        enabled: shopData?.productScarcityEnabled ?? false,
        badge: shopData?.productScarcityConfig?.active ? "Active" : "Disabled",
      },
      socialBar: {
        id: "socialBar",
        title: "Customer Support & Social Bar",
        description: "Provide floating 1-click WhatsApp customer support, links to your official social channels, and VIP community access.",
        route: "/app/social-bar",
        enabled: shopData?.socialBarEnabled ?? false,
        badge: shopData?.socialConfig?.active ? "Active" : "Disabled",
      },
      scarcity: {
        id: "scarcity",
        title: "Urgency & Social Proof Notifications",
        description: "Display recent purchase activity, stock scarcity alerts, and limited-time countdown offers in the corner of your store.",
        route: "/app/scarcity",
        enabled: shopData?.scarcityEnabled ?? false,
        badge: shopData?.scarcityConfig?.active ? "Active" : "Disabled",
      },
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = await getOrCreateShop(session.shop);
    const formData = await request.formData();
    const featureKey = String(formData.get("featureKey") || "");
    const enable = formData.get("enable") === "true";

    const featureFieldMap: Record<string, string> = {
      scarcity: "scarcityEnabled",
      prePurchase: "prePurchaseEnabled",
      inCart: "inCartUpsellEnabled",
      socialBar: "socialBarEnabled",
      shippingBar: "shippingBarEnabled",
      exitIntent: "exitIntentEnabled",
      productScarcity: "productScarcityEnabled",
      quantityBreaks: "quantityBreaksEnabled",
      thankYou: "thankYouEnabled",
    };

    const field = featureFieldMap[featureKey];
    if (!field) {
      return { error: "Unknown feature" };
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: { [field]: enable },
    });

    return { ok: true, featureKey, enable };
  } catch (err: any) {
    console.error("[ACTION_ERROR in app._index.tsx]", err?.stack || err?.message || err);
    if (err instanceof Response) throw err;
    return { ok: false, error: err?.message || "Failed to update feature" };
  }
};

export default function XPoostDashboard() {
  const { shopDomain, features } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const toggleFetcher = useFetcher();
  const shopify = useAppBridge();
  const isSubmitting = toggleFetcher.state !== "idle";

  const featureList = Object.values(features);
  const activeCount = featureList.filter((f) => f.enabled).length;
  const nextOff = featureList.find((f) => !f.enabled);
  const scrollToFeatures = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    document.getElementById("xp-features")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <s-page heading="XPoost — Conversion Suite">
      <style>{DASHBOARD_STYLES}</style>

      {actionData && "ok" in actionData ? (
        <s-banner tone="success"><Translate text='Feature status updated successfully.' /></s-banner>
      ) : null}

      <div className="xp-hero">
        <HeroBanner onBrowse={scrollToFeatures} />

        <div className="xp-spot-grid">
          <div className="xp-spot">
            <span className="xp-spot-badge xp-spot-badge--amber" aria-hidden="true"><FeatureIcon id="quantityBreaks" /></span>
            <h3 className="xp-spot-title"><Translate text='Your toolkit' /></h3>
            <div className="xp-spot-metric">
              <span className="xp-spot-num">{activeCount}</span>
              <span className="xp-spot-of"><Translate text='of' /> {featureList.length} <Translate text='features live' /></span>
            </div>
            <div
              className="xp-meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={featureList.length}
              aria-valuenow={activeCount}
            >
              <span style={{ width: `${featureList.length ? Math.round((activeCount / featureList.length) * 100) : 0}%` }} />
            </div>
            <p className="xp-spot-note">
              {nextOff ? (
                <>
                  <Translate text='Next up:' />{" "}
                  <Link to={nextOff.route}>{FEATURE_PITCH[nextOff.id]?.name ?? nextOff.title}</Link>
                </>
              ) : (
                <Translate text='Everything is live. Check Analytics to see what is paying off.' />
              )}
            </p>
            <a href="#xp-features" className="xp-btn xp-btn--soft xp-btn--block" onClick={scrollToFeatures}>
              <Translate text='Manage features' />
            </a>
          </div>

          <div className="xp-spot">
            <span className="xp-spot-badge xp-spot-badge--orange" aria-hidden="true"><FeatureIcon id="analytics" /></span>
            <h3 className="xp-spot-title">
              <Translate text="See what's paying off" />
              <span className="xp-spot-new"><Translate text='New' /></span>
            </h3>
            <ul className="xp-spot-list">
              <li><span className="xp-check" aria-hidden="true"><FeatureIcon id="check" /></span><Translate text='Revenue XPoost added, day by day' /></li>
              <li><span className="xp-check" aria-hidden="true"><FeatureIcon id="check" /></span><Translate text='Views, actions and rate for every feature' /></li>
            </ul>
            <Link to="/app/analytics" className="xp-btn xp-btn--soft xp-btn--block">
              <Translate text='Open analytics &rarr;' />
            </Link>
          </div>

          <div className="xp-spot">
            <span className="xp-spot-badge xp-spot-badge--light" aria-hidden="true"><FeatureIcon id="plan" /></span>
            <h3 className="xp-spot-title"><Translate text='Every feature, every plan' /></h3>
            <ul className="xp-spot-list">
              <li><span className="xp-check" aria-hidden="true"><FeatureIcon id="check" /></span><Translate text='No caps on views or orders' /></li>
              <li><span className="xp-check" aria-hidden="true"><FeatureIcon id="check" /></span><Translate text='Nothing locked behind a tier' /></li>
            </ul>
            <Link to="/app/pricing" className="xp-btn xp-btn--soft xp-btn--block">
              <Translate text='Manage plan &rarr;' />
            </Link>
          </div>
        </div>

        <CaseStudyStrip />
      </div>

      <section className="xp-panel" id="xp-features">
        <h2 className="xp-panel-title"><Translate text='Conversion Features' /></h2>
        <div className="xp-grid">
          {featureList.map((f) => (
            <div key={f.id} className={`xp-card ${f.enabled ? "is-enabled" : ""}`}>
              <div className="xp-card-header">
                <div className="xp-card-meta">
                  <h3 className="xp-card-title"><Translate text={f.title} /></h3>
                  <span className={`xp-pill ${f.enabled ? "xp-pill--active" : "xp-pill--inactive"}`}>
                    {f.enabled ? <Translate text="Active" /> : <Translate text={f.badge} />}
                  </span>
                </div>
              </div>
              <FeatureDemo id={f.id as DemoId} size="sm" />
              <p className="xp-card-desc"><Translate text={f.description} /></p>
              <div className="xp-card-actions">
                <button className={`xp-toggle-btn ${f.enabled ? "xp-toggle-btn--off" : "xp-toggle-btn--on"}`} disabled={isSubmitting} onClick={async (e) => { const btn = e.currentTarget; btn.disabled = true; btn.innerText = "Saving..."; try { const token = await shopify.idToken(); const res = await fetch("/api/toggle", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Bearer ${token}` }, body: new URLSearchParams({ featureKey: f.id, enable: f.enabled ? "false" : "true" }) }); if (!res.ok) { shopify.toast.show("Network Error: " + res.status); btn.disabled = false; btn.innerText = f.enabled ? "Disable" : "Enable"; return; } const json = await res.json(); if (!json.ok) { shopify.toast.show("Action Error: " + (json.error || "Unknown error")); btn.disabled = false; btn.innerText = f.enabled ? "Disable" : "Enable"; return; } window.location.reload(); } catch (err) { shopify.toast.show("Error: " + err.message); btn.disabled = false; btn.innerText = f.enabled ? "Disable" : "Enable"; } }}>{f.enabled ? "Disable" : "Enable"}</button>
                <Link to={f.route} className="xp-config-link">
                  
                                            <Translate text='Configure Settings &rarr;' />
                                          </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="xp-panel">
        <h2 className="xp-panel-title"><Translate text='Theme App Extension Setup' /></h2>
        <div className="xp-setup-guide">
          <div className="xp-step">
            <div className="xp-step-num">1</div>
            <div>
              <strong><Translate text='Open Theme Editor' /></strong>
              <p><Translate text='In your Shopify Admin, navigate to' /> <em><Translate text='Online Store &gt; Themes &gt; Customize' /></em>.</p>
            </div>
          </div>
          <div className="xp-step">
            <div className="xp-step-num">2</div>
            <div>
              <strong><Translate text='Turn on App Embeds' /></strong>
              <p><Translate text='Click the' /> <strong><Translate text='App embeds' /></strong>  <Translate text='tab on the left sidebar and toggle on the XPoost blocks (Scarcity Toast, Social Bar, Cart Engine, Retention Triggers).' /></p>
            </div>
          </div>
          <div className="xp-step">
            <div className="xp-step-num">3</div>
            <div>
              <strong><Translate text='Zero Theme Edits Required' /></strong>
              <p><Translate text='XPoost never modifies theme liquid files directly. Everything renders cleanly inside sandboxed containers with deferred loading.' /></p>
            </div>
          </div>
        </div>
      </section>
    </s-page>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hero: short pitch per feature (used for the "Next up" hint)
   ───────────────────────────────────────────────────────────── */

const FEATURE_PITCH: Record<string, { name: string; pitch: string }> = {
  scarcity: { name: "Urgency & Social Proof", pitch: "Live purchase and stock alerts that build trust while shoppers browse." },
  productScarcity: { name: "Stock Scarcity Block", pitch: "Low-stock meters on product pages that nudge hesitant buyers to act." },
  quantityBreaks: { name: "Quantity Breaks", pitch: "Tiered volume pricing that moves buyers from 1 unit to 2 or 3." },
  prePurchase: { name: "Pre-Purchase Upsell", pitch: "A complementary bundle offer right after Add to Cart, without blocking the cart." },
  inCart: { name: "Cart Drawer Upsell", pitch: "One-click add-ons inside the slide-out cart, where intent is highest." },
  shippingBar: { name: "Free Shipping Bar", pitch: "A milestone bar that pulls cart totals up toward free shipping." },
  exitIntent: { name: "Exit-Intent Saver", pitch: "A last-chance offer that catches shoppers before they leave." },
  thankYou: { name: "Thank-You Page Upsell", pitch: "A reward for the next order or a ship-together offer, right after checkout." },
  socialBar: { name: "Support & Social Bar", pitch: "WhatsApp support and your social channels, one tap away." },
};

/* ─────────────────────────────────────────────────────────────
   Hero: rotating case studies (changes every page view + every minute)
   Research-backed results from published studies. When XPoost has
   enough anonymised merchant data, add real XPoost results here with
   the same shape.
   ───────────────────────────────────────────────────────────── */

const CASE_STUDY_MS = 60_000;
const CASE_STUDY_KEY = "xpoost_case_study_idx";

type CaseStudy = {
  feature: string;
  route: string;
  headline: string;
  detail: string;
  source: string;
  url: string;
};

const ALL_CASE_STUDIES: CaseStudy[] = [
  {
    feature: "Pre-Purchase Upsell",
    route: "/app/pre-purchase",
    headline: "Offers with 3 products won almost twice as many takers as single-product offers.",
    detail: "2.9% take rate for 3-product offers vs 1.5% for 1 product. Offers with 4–5 products reached 3.1%.",
    source: "Digismoothie Upsell Benchmarks 2026 · 218.6M offer views across 3,199 Shopify stores",
    url: "https://www.digismoothie.com/blog/upsell-benchmarks",
  },
  {
    feature: "Cart Drawer Upsell",
    route: "/app/in-cart",
    headline: "Relevance beat discounts: upsells without a discount were accepted more often.",
    detail: "2.3% median take rate with no discount vs 1.5% at 21–50% off. Pick the right product before cutting the price.",
    source: "Digismoothie Upsell Benchmarks 2026 · 39,007 offers analysed",
    url: "https://www.digismoothie.com/blog/upsell-benchmarks",
  },
  {
    feature: "Upsells",
    route: "/app/pre-purchase",
    headline: "The top 10% of stores earned 8.9% of total sales from upsells.",
    detail: "The median store earned 2.4%. The gap comes from offer relevance, placement and number of products shown.",
    source: "Digismoothie Upsell Benchmarks 2026 · 3,199 Shopify stores, Jan–Aug 2026",
    url: "https://www.digismoothie.com/blog/upsell-benchmarks",
  },
  {
    feature: "Free Shipping Bar",
    route: "/app/shipping-bar",
    headline: "Extra costs are the #1 reason shoppers abandon checkout.",
    detail: "Cited by 40% of shoppers who abandoned. Average documented cart abandonment is 70.22%.",
    source: "Baymard Institute · average of 50 cart-abandonment studies",
    url: "https://baymard.com/lists/cart-abandonment-rate",
  },
  {
    feature: "Exit-Intent Saver",
    route: "/app/exit-intent",
    headline: "Popups with a countdown timer converted 2.7× better.",
    detail: "12.84% conversion with a timer vs 4.73% without.",
    source: "Wisepops Popup Statistics 2026 · 1 billion popup displays",
    url: "https://wisepops.com/blog/popup-stats",
  },
  {
    feature: "Popup Timing",
    route: "/app/exit-intent",
    headline: "Waiting 11–15 seconds before showing a popup beat showing it instantly.",
    detail: "6.45% conversion at an 11–15 second delay vs 4.16% when shown immediately.",
    source: "Wisepops Popup Statistics 2026 · 1 billion popup displays",
    url: "https://wisepops.com/blog/popup-stats",
  },
  {
    feature: "Mobile Shoppers",
    route: "/app/pre-purchase",
    headline: "Mobile popups out-converted desktop by 36%.",
    detail: "4.98% conversion on mobile vs 3.67% on desktop. Design every offer mobile-first.",
    source: "Wisepops Popup Statistics 2026 · 1 billion popup displays",
    url: "https://wisepops.com/blog/popup-stats",
  },
  {
    feature: "Thank-You Page Upsell",
    route: "/app/thank-you",
    headline: "Offers with 3 products were taken twice as often as offers with 1.",
    detail: "2.9% vs 1.5%. On the thank-you page the bigger win is the next-order reward, which brings the customer back.",
    source: "Digismoothie Upsell Benchmarks 2026 · 3,199 Shopify stores, Jan–Aug 2026",
    url: "https://www.digismoothie.com/blog/upsell-benchmarks",
  },
];
const CASE_STUDIES: CaseStudy[] = ALL_CASE_STUDIES.filter((c) => EXIT_INTENT_AVAILABLE || c.route !== "/app/exit-intent");

function CaseStudyStrip() {
  const total = CASE_STUDIES.length;
  // null until mounted: the starting study comes from localStorage (client only)
  const [index, setIndex] = useState<number | null>(null);

  // Each page view starts on the study after the one shown last time
  useEffect(() => {
    let start = 0;
    try {
      const raw = window.localStorage.getItem(CASE_STUDY_KEY);
      const last = raw === null ? -1 : parseInt(raw, 10);
      start = Number.isFinite(last) ? (last + 1) % total : 0;
    } catch {
      start = Math.floor(Math.random() * total);
    }
    setIndex(start);
  }, [total]);

  // Remember the current study and rotate every minute
  useEffect(() => {
    if (index === null) return;
    try {
      window.localStorage.setItem(CASE_STUDY_KEY, String(index));
    } catch {
      /* storage unavailable: rotation still works for this view */
    }
    const t = window.setTimeout(() => setIndex((i) => ((i ?? 0) + 1) % total), CASE_STUDY_MS);
    return () => window.clearTimeout(t);
  }, [index, total]);

  const shown = index ?? 0;
  const study = CASE_STUDIES[shown];

  return (
    <div className={`xp-case ${index === null ? "is-pending" : ""}`} aria-live="polite">
      <div className="xp-case-head">
        <span className="xp-case-tag"><Translate text='Benchmark' /></span>
        <span className="xp-case-feature"><Translate text={study.feature} /></span>
        <span className="xp-case-count">
          {shown + 1} / {total}
        </span>
        <button
          type="button"
          className="xp-case-next"
          onClick={() => setIndex((i) => ((i ?? 0) + 1) % total)}
          aria-label="Next benchmark"
        >
          <Translate text='Next &rarr;' />
        </button>
      </div>
      <div key={shown} className="xp-case-body">
        <p className="xp-case-headline">{study.headline}</p>
        <p className="xp-case-detail"><Translate text={study.detail} /></p>
        <div className="xp-case-foot">
          <Link to={study.route} className="xp-btn xp-btn--soft xp-btn--sm">
            <Translate text='Try it on my store &rarr;' />
          </Link>
          <p className="xp-case-source">
            <Translate text='Source:' />{" "}
            <a href={study.url} target="_blank" rel="noreferrer">
              {study.source}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/* Minimal stroke icons (Feather-style, MIT) */
function FeatureIcon({ id }: { id: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "scarcity":
      return (
        <svg {...common}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      );
    case "productScarcity":
      return (
        <svg {...common}>
          <path d="M12 2c1 3 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3.5 2.5 3.5 0-3-1.5-5.5 0-8.5z" />
        </svg>
      );
    case "quantityBreaks":
      return (
        <svg {...common}>
          <path d="M12 2 2 7l10 5 10-5-10-5z" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
      );
    case "prePurchase":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13" />
          <path d="M19 12v9H5v-9" />
          <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
        </svg>
      );
    case "inCart":
      return (
        <svg {...common}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      );
    case "shippingBar":
      return (
        <svg {...common}>
          <path d="M1 3h15v13H1z" />
          <path d="M16 8h4l3 3v5h-7z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "exitIntent":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    case "thankYou":
      return (
        <svg {...common}>
          <path d="M20 12v10H4V12" />
          <path d="M2 7h20v5H2z" />
          <path d="M12 22V7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      );
    case "socialBar":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "plan":
      return (
        <svg {...common}>
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <path d="M1 10h22" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M7 15v3" />
          <path d="M12 10v8" />
          <path d="M17 6v12" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

const DASHBOARD_STYLES = `
  /* Section panels below the hero: same dark surface, border and radius as the hero */
  .xp-panel {
    background: #150E07;
    border: 1px solid #3A2B17;
    border-radius: 12px;
    padding: 24px 28px 28px;
    color: #FFFFFF;
    margin-bottom: 24px;
  }
  .xp-panel-title {
    margin: 0 0 6px;
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 18px;
    font-weight: 600;
    color: #E8C872;
  }
  .xp-panel .xp-grid,
  .xp-panel .xp-setup-guide {
    margin-top: 14px;
  }
  @media (max-width: 640px) {
    .xp-panel {
      padding: 18px 16px 20px;
    }
  }
  .xp-hero {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
    color: #FFFFFF;
  }

  .xp-spot-list li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .xp-check {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(232,200,114, 0.14);
    color: #E8C872;
  }
  .xp-check svg { width: 11px; height: 11px; stroke-width: 2.6; }

  /* Buttons */
  .xp-btn {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    padding: 11px 18px;
    border-radius: 9px;
    border: 1px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .xp-btn:focus-visible { outline: 2px solid #E8C872; outline-offset: 2px; }
  .xp-btn--primary { background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%); color: #0C0803; }
  .xp-btn--primary:hover { background: #FFC233; }
  .xp-btn--ghost { background: transparent; color: #FFFFFF; border-color: #443A22; }
  .xp-btn--ghost:hover { border-color: #E8C872; color: #FFEB97; }
  .xp-btn--soft {
    background: rgba(232,200,114, 0.12);
    color: #FFEB97;
    border-color: rgba(232,200,114, 0.28);
  }
  .xp-btn--soft:hover { background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%); color: #0C0803; border-color: #E8C872; }
  .xp-btn--block { width: 100%; }
  .xp-btn--sm { padding: 8px 14px; font-size: 12px; }

  /* Spotlight cards */
  .xp-spot-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .xp-spot {
    background: #150E07;
    border: 1px solid #3A2B17;
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: border-color 0.2s ease;
  }
  .xp-spot:hover { border-color: #5A4A1F; }
  .xp-spot-badge {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #0C0803;
  }
  .xp-spot-badge--amber { background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%); }
  .xp-spot-badge--orange { background: #B8863B; }
  .xp-spot-badge--light { background: #FFEB97; }
  .xp-spot-title {
    margin: 2px 0 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 17px;
    line-height: 1.25;
    font-weight: 600;
    color: #FFFFFF;
  }
  .xp-spot-new {
    font-family: inherit;
    font-size: 9px;
    font-weight: 800;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%);
    color: #0C0803;
    padding: 2px 7px;
    border-radius: 999px;
  }
  .xp-spot-metric {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .xp-spot-num {
    font-size: 30px;
    font-weight: 800;
    line-height: 1;
    color: #E8C872;
    font-variant-numeric: tabular-nums;
  }
  .xp-spot-of { font-size: 13px; color: #B2A88B; }
  .xp-meter {
    height: 6px;
    border-radius: 999px;
    background: #2F2314;
    overflow: hidden;
  }
  .xp-meter span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%);
    transition: width 0.4s ease;
  }
  .xp-spot-note {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: #B2A88B;
    flex: 1;
  }
  .xp-spot-note a { color: #E8C872; font-weight: 700; text-decoration: none; }
  .xp-spot-note a:hover { text-decoration: underline; }
  .xp-spot-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 9px;
    font-size: 13px;
    line-height: 1.4;
    color: #B2A88B;
    flex: 1;
  }
  .xp-spot-list li { align-items: flex-start; }

  /* Benchmark card */
  .xp-case {
    background: #150E07;
    border: 1px solid #3A2B17;
    border-radius: 14px;
    padding: 20px 24px 22px;
    transition: opacity 0.3s ease;
  }
  .xp-case.is-pending { opacity: 0; }
  .xp-case-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .xp-case-tag {
    font-size: 10px;
    font-weight: 800;
    color: #0C0803;
    background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%);
    padding: 3px 9px;
    border-radius: 5px;
  }
  .xp-case-feature { font-size: 12px; font-weight: 700; color: #FFEB97; }
  .xp-case-count {
    margin-inline-start: auto;
    font-size: 11px;
    color: #6A6453;
    font-variant-numeric: tabular-nums;
  }
  .xp-case-next {
    background: none;
    border: 1px solid #43331D;
    color: #9E957B;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 7px;
    cursor: pointer;
  }
  .xp-case-next:hover,
  .xp-case-next:focus-visible { color: #E8C872; border-color: rgba(232,200,114,0.5); outline: none; }
  .xp-case-body { animation: xp-case-in 0.5s ease both; }
  @keyframes xp-case-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .xp-case-headline {
    margin: 0 0 6px;
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.35;
    font-weight: 600;
    color: #FFFFFF;
    max-width: 760px;
  }
  .xp-case-detail {
    margin: 0 0 16px;
    font-size: 13.5px;
    color: #B2A88B;
    line-height: 1.55;
    max-width: 760px;
  }
  .xp-case-foot {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .xp-case-source { margin: 0; font-size: 11px; color: #6A6453; }
  .xp-case-source a {
    color: #8A826C;
    text-decoration: underline;
    text-decoration-color: #4E4427;
    text-underline-offset: 2px;
  }
  .xp-case-source a:hover { color: #B2A88B; }

  @media (max-width: 900px) {
    .xp-spot-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .xp-case { padding: 16px; }
    .xp-case-feature { flex-basis: 100%; order: 3; }
  }
  @media (prefers-reduced-motion: reduce) {
    .xp-case-body, .xp-btn, .xp-spot, .xp-meter span { transition: none; animation: none; }
  }
  .xp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-top: 12px;
  }
  .xp-card {
    background: #150E07;
    border: 1px solid #3A2B17;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
  }
  .xp-card.is-enabled {
    border-color: #4E4427;
  }
  .xp-card-header {
    margin-bottom: 12px;
  }
  .xp-card-meta {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .xp-card-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }
  .xp-pill {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 12px;
    white-space: nowrap;
  }
  .xp-pill--active {
    background: rgba(16, 128, 67, 0.2);
    color: #4ade80;
    border: 1px solid rgba(74, 222, 128, 0.3);
  }
  .xp-pill--inactive {
    background: #2F2314;
    color: #8A826C;
    border: 1px solid #43331D;
  }
  .xp-card-desc {
    font-size: 13px;
    color: #B2A88B;
    line-height: 1.5;
    margin: 0 0 16px;
    flex: 1;
  }
  .xp-card-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #2F2314;
    padding-top: 14px;
    gap: 12px;
  }
  .xp-toggle-btn {
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    transition: background 0.15s ease;
  }
  .xp-toggle-btn--on {
    background: #0C0803;
    color: #E8C872;
    border: 1px solid #E8C872;
  }
  .xp-toggle-btn--on:hover {
    background: #1D150C;
  }
  .xp-toggle-btn--off {
    background: #1D150C;
    color: #8A826C;
    border: 1px solid #43331D;
  }
  .xp-toggle-btn--off:hover {
    background: #2F2314;
    color: #ffffff;
  }
  .xp-config-link {
    font-size: 13px;
    font-weight: 600;
    color: #E8C872;
    text-decoration: none;
  }
  .xp-config-link:hover {
    text-decoration: underline;
  }
  .xp-setup-guide {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 18px;
    margin-top: 12px;
  }
  .xp-step {
    background: #150E07;
    border: 1px solid #3A2B17;
    border-radius: 10px;
    padding: 16px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    color: #ffffff;
  }
  .xp-step strong {
    color: #ffffff;
  }
  .xp-step-num {
    background: #0C0803;
    color: #E8C872;
    font-weight: 700;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 13px;
    border: 1px solid #E8C872;
  }
  .xp-step p {
    font-size: 12px;
    color: #B2A88B;
    margin: 4px 0 0;
    line-height: 1.4;
  }
  s-section {
    color: #ffffff;
  }

  /* ───────── Gold gradient layer ───────── */
  .xp-panel, .xp-spot, .xp-case, .xp-card, .xp-step {
    border: 1px solid transparent;
    background:
      linear-gradient(180deg, #1D140A 0%, #130C06 100%) padding-box,
      linear-gradient(145deg, rgba(255,235,151,0.30) 0%, rgba(184,134,59,0.12) 38%, rgba(88,55,20,0.34) 100%) border-box;
  }
  .xp-spot, .xp-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
  .xp-spot:hover, .xp-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px -18px rgba(232,200,114,0.35);
  }
  .xp-card.is-enabled {
    border-color: transparent;
    background:
      linear-gradient(180deg, #221609 0%, #140D06 100%) padding-box,
      linear-gradient(145deg, rgba(255,235,151,0.65) 0%, rgba(184,134,59,0.25) 40%, rgba(255,235,151,0.35) 100%) border-box;
  }
  .xp-panel-title {
    background: linear-gradient(90deg, #FFEB97 0%, #D9B363 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .xp-btn--primary {
    background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%);
    color: #2A1805;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 20px -10px rgba(232,200,114,0.6);
  }
  .xp-btn--primary:hover { background: linear-gradient(135deg, #FFF3B2 0%, #EFD283 48%, #C4903F 100%); }
  .xp-btn--ghost { border-color: rgba(255,235,151,0.28); color: #FFF3C4; }
  .xp-btn--ghost:hover { border-color: #FFEB97; color: #FFEB97; background: rgba(255,235,151,0.06); }
  .xp-btn--soft {
    background: linear-gradient(135deg, rgba(255,235,151,0.12), rgba(184,134,59,0.10));
    border-color: rgba(232,200,114,0.30);
    color: #FFEB97;
  }
  .xp-btn--soft:hover {
    background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%);
    color: #2A1805;
    border-color: transparent;
  }
  .xp-spot-badge { box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 10px 22px -12px rgba(232,200,114,0.55); }
  .xp-spot-badge--amber { background: linear-gradient(160deg, #FFEB97 0%, #D6AE5B 55%, #8E5E24 100%); color: #2A1805; }
  .xp-spot-badge--orange { background: linear-gradient(160deg, #E7BC73 0%, #A8742A 55%, #583714 100%); color: #FFF3C4; }
  .xp-spot-badge--light { background: linear-gradient(160deg, #FFF8D6 0%, #FFEB97 50%, #C9A152 100%); color: #2A1805; }
  .xp-spot-num {
    background: linear-gradient(180deg, #FFF3B2, #D9B363);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .xp-meter { background: rgba(255,235,151,0.10); }
  .xp-meter span { background: linear-gradient(90deg, #8E5E24, #E8C872 60%, #FFF3B2); }
  .xp-spot-new, .xp-case-tag { background: linear-gradient(135deg, #FFEB97, #C9A152); color: #2A1805; }
  .xp-spot-note a, .xp-config-link { color: #FFEB97; }
  .xp-toggle-btn--on { background: linear-gradient(135deg, rgba(255,235,151,0.14), rgba(184,134,59,0.12)); color: #FFEB97; border: 1px solid rgba(232,200,114,0.55); }
  .xp-toggle-btn--on:hover { background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%); color: #2A1805; }
  .xp-step-num { background: linear-gradient(160deg, #FFEB97, #B8863B); color: #2A1805; border: none; }
  .xp-case-headline { color: #FFF3C4; }
`;
