import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, Link, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop, getShopWithConfigs } from "../shop.server";
import { ensureUpsellDiscountRegistered } from "../discount.server";
import { EXIT_INTENT_AVAILABLE } from "../utils/features";

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
      scarcity: {
        id: "scarcity",
        title: "Urgency & Social Proof Notifications",
        description: "Display recent purchase activity, stock scarcity alerts, and limited-time countdown offers in the corner of your store.",
        route: "/app/scarcity",
        enabled: shopData?.scarcityEnabled ?? false,
        badge: shopData?.scarcityConfig?.active ? "Active" : "Disabled",
      },
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
      socialBar: {
        id: "socialBar",
        title: "Customer Support & Social Bar",
        description: "Provide floating 1-click WhatsApp customer support, links to your official social channels, and VIP community access.",
        route: "/app/social-bar",
        enabled: shopData?.socialBarEnabled ?? false,
        badge: shopData?.socialConfig?.active ? "Active" : "Disabled",
      },
      shippingBar: {
        id: "shippingBar",
        title: "Tiered Free Shipping Progress Bar",
        description: "Motivate shoppers to increase cart totals with an interactive milestone bar showing progress toward free shipping and perks.",
        route: "/app/shipping-bar",
        enabled: shopData?.shippingBarEnabled ?? false,
        badge: shopData?.shippingConfig?.active ? "Active" : "Disabled",
      },
      productScarcity: {
        id: "productScarcity",
        title: "Product Stock Scarcity Block",
        description: "Display live low-stock meters, flash demand bars, and urgency badges directly on your product pages with 4 high-converting designs.",
        route: "/app/product-scarcity",
        enabled: shopData?.productScarcityEnabled ?? false,
        badge: shopData?.productScarcityConfig?.active ? "Active" : "Disabled",
      },
      thankYou: {
        id: "thankYou",
        title: "Thank-You Page Upsell & Rewards",
        description: "Turn the order confirmation page into extra revenue: a unique next-order code, matching products, or a ship-together countdown, with conditions and translations.",
        route: "/app/thank-you",
        enabled: shopData?.thankYouEnabled ?? false,
        badge: tyActive > 0 ? `${tyActive} Active` : "No active offers",
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

  return (
    <s-page heading="XPoost — Conversion Suite">
      <style>{DASHBOARD_STYLES}</style>

      {actionData && "ok" in actionData ? (
        <s-banner tone="success">Feature status updated successfully.</s-banner>
      ) : null}

      <div className="xp-hero">
        <div className="xp-hero-main">
          <div className="xp-hero-content">
            <div className="xp-hero-tag">Storefront Conversion Suite</div>
            <h1 className="xp-hero-title">Boost Sales &amp; Average Order Value</h1>
            <p className="xp-hero-subtitle">
              {featureList.length} coordinated conversion features designed to increase revenue, engage shoppers, and recover lost carts.
            </p>
            <FeatureSlider features={featureList} />
          </div>

          <div className="xp-hero-stats">
            <div className="xp-stat-box">
              <span className="xp-stat-number">
                {activeCount} / {featureList.length}
              </span>
              <span className="xp-stat-label">Features Active</span>
            </div>
            <Link to="/app/analytics" className="xp-stat-box xp-stat-box--link xp-stat-box--analytics">
              <span className="xp-stat-new">New</span>
              <span className="xp-stat-icon" aria-hidden="true">
                <FeatureIcon id="analytics" />
              </span>
              <span className="xp-stat-number xp-stat-number--sm">Analytics</span>
              <span className="xp-stat-label">View Insights &rarr;</span>
            </Link>
            <Link to="/app/pricing" className="xp-stat-box xp-stat-box--link">
              <span className="xp-stat-number xp-stat-number--sm">Plans</span>
              <span className="xp-stat-label">Manage Billing &rarr;</span>
            </Link>
          </div>
        </div>

        <CaseStudyStrip />
      </div>

      <section className="xp-panel">
        <h2 className="xp-panel-title">Conversion Features</h2>
        <div className="xp-grid">
          {featureList.map((f) => (
            <div key={f.id} className={`xp-card ${f.enabled ? "is-enabled" : ""}`}>
              <div className="xp-card-header">
                <div className="xp-card-meta">
                  <h3 className="xp-card-title">{f.title}</h3>
                  <span className={`xp-pill ${f.enabled ? "xp-pill--active" : "xp-pill--inactive"}`}>
                    {f.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>
              <p className="xp-card-desc">{f.description}</p>
              <div className="xp-card-actions">
                <button className={`xp-toggle-btn ${f.enabled ? "xp-toggle-btn--off" : "xp-toggle-btn--on"}`} disabled={isSubmitting} onClick={async (e) => { const btn = e.currentTarget; btn.disabled = true; btn.innerText = "Saving..."; try { const token = await shopify.idToken(); const res = await fetch("/api/toggle", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Bearer ${token}` }, body: new URLSearchParams({ featureKey: f.id, enable: f.enabled ? "false" : "true" }) }); if (!res.ok) { shopify.toast.show("Network Error: " + res.status); btn.disabled = false; btn.innerText = f.enabled ? "Disable" : "Enable"; return; } const json = await res.json(); if (!json.ok) { shopify.toast.show("Action Error: " + (json.error || "Unknown error")); btn.disabled = false; btn.innerText = f.enabled ? "Disable" : "Enable"; return; } window.location.reload(); } catch (err) { shopify.toast.show("Error: " + err.message); btn.disabled = false; btn.innerText = f.enabled ? "Disable" : "Enable"; } }}>{f.enabled ? "Disable" : "Enable"}</button>
                <Link to={f.route} className="xp-config-link">
                  Configure Settings &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="xp-panel">
        <h2 className="xp-panel-title">Theme App Extension Setup</h2>
        <div className="xp-setup-guide">
          <div className="xp-step">
            <div className="xp-step-num">1</div>
            <div>
              <strong>Open Theme Editor</strong>
              <p>In your Shopify Admin, navigate to <em>Online Store &gt; Themes &gt; Customize</em>.</p>
            </div>
          </div>
          <div className="xp-step">
            <div className="xp-step-num">2</div>
            <div>
              <strong>Turn on App Embeds</strong>
              <p>Click the <strong>App embeds</strong> tab on the left sidebar and toggle on the XPoost blocks (Scarcity Toast, Social Bar, Cart Engine, Retention Triggers).</p>
            </div>
          </div>
          <div className="xp-step">
            <div className="xp-step-num">3</div>
            <div>
              <strong>Zero Theme Edits Required</strong>
              <p>XPoost never modifies theme liquid files directly. Everything renders cleanly inside sandboxed containers with deferred loading.</p>
            </div>
          </div>
        </div>
      </section>
    </s-page>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hero: auto-rotating feature slider
   ───────────────────────────────────────────────────────────── */

const SLIDE_MS = 5000;

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

type SliderFeature = {
  id: string;
  title: string;
  description: string;
  route: string;
  enabled: boolean;
};

function FeatureSlider({ features }: { features: SliderFeature[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = features.length;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // One timer per slide: restarts on manual navigation and on resume
  useEffect(() => {
    if (paused || reducedMotion || count < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, reducedMotion, count]);

  if (count === 0) return null;
  const autoplay = !paused && !reducedMotion && count > 1;

  return (
    <div
      className="xp-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label="XPoost features"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="xp-slider-stage">
        {features.map((f, i) => {
          const meta = FEATURE_PITCH[f.id] || { name: f.title, pitch: f.description };
          const isActive = i === index;
          return (
            <div
              key={f.id}
              className={`xp-slide ${isActive ? "is-active" : ""}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${meta.name}`}
              aria-hidden={!isActive}
            >
              <span className="xp-slide-icon" aria-hidden="true">
                <FeatureIcon id={f.id} />
              </span>
              <div className="xp-slide-body">
                <div className="xp-slide-top">
                  <span className="xp-slide-name">{meta.name}</span>
                  <span className={`xp-slide-status ${f.enabled ? "is-on" : ""}`}>
                    {f.enabled ? "Active" : "Off"}
                  </span>
                </div>
                <p className="xp-slide-pitch">{meta.pitch}</p>
              </div>
              <Link to={f.route} className="xp-slide-link" tabIndex={isActive ? 0 : -1}>
                {f.enabled ? "Configure" : "Set up"} &rarr;
              </Link>
            </div>
          );
        })}
      </div>

      <div className="xp-slider-foot">
        <div className="xp-slider-dots" role="tablist" aria-label="Choose feature">
          {features.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={FEATURE_PITCH[f.id]?.name || f.title}
              className={`xp-dot ${i === index ? "is-active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <span className="xp-slider-count">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
      </div>
      <div className="xp-slider-progress" aria-hidden="true">
        {autoplay ? (
          <span
            key={`${index}-${paused}`}
            className="xp-slider-progress-fill"
            style={{ animationDuration: `${SLIDE_MS}ms` }}
          />
        ) : null}
      </div>
    </div>
  );
}

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
        <span className="xp-case-tag">Case Study</span>
        <span className="xp-case-feature">{study.feature}</span>
        <span className="xp-case-count">
          {shown + 1} / {total}
        </span>
        <button
          type="button"
          className="xp-case-next"
          onClick={() => setIndex((i) => ((i ?? 0) + 1) % total)}
          aria-label="Next case study"
        >
          Next &rarr;
        </button>
      </div>
      <div key={shown} className="xp-case-body">
        <p className="xp-case-headline">{study.headline}</p>
        <p className="xp-case-detail">
          {study.detail}{" "}
          <Link to={study.route} className="xp-case-apply">
            Apply to my store &rarr;
          </Link>
        </p>
        <p className="xp-case-source">
          Source:{" "}
          <a href={study.url} target="_blank" rel="noreferrer">
            {study.source}
          </a>
        </p>
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
    background: linear-gradient(135deg, #0B0B0B 0%, #141414 100%);
    border: 1px solid rgba(212, 175, 55, 0.25);
    border-radius: 12px;
    padding: 24px 28px 28px;
    color: #FFFFFF;
    margin-bottom: 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  }
  .xp-panel-title {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #D4AF37;
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
    background: linear-gradient(135deg, #0B0B0B 0%, #171717 60%, #201b10 100%);
    border: 1px solid rgba(212, 175, 55, 0.25);
    border-radius: 12px;
    padding: 28px;
    color: #FFFFFF;
    margin-bottom: 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .xp-hero-main {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 24px;
    flex-wrap: wrap;
  }
  .xp-hero-content {
    flex: 1 1 420px;
    min-width: 0;
  }
  .xp-hero-tag {
    display: inline-block;
    color: #D4AF37;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .xp-hero-title {
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 8px;
    letter-spacing: -0.5px;
  }
  .xp-hero-subtitle {
    font-size: 14px;
    color: #b0b0b0;
    margin: 0 0 18px;
    line-height: 1.5;
  }

  /* Stat tiles */
  .xp-hero-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(110px, 1fr));
    gap: 12px;
    align-content: center;
    flex: 0 1 460px;
  }
  .xp-stat-box {
    position: relative;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-radius: 10px;
    padding: 16px 14px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: inherit;
    text-decoration: none;
    min-height: 96px;
  }
  .xp-stat-box--link {
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  }
  .xp-stat-box--link:hover,
  .xp-stat-box--link:focus-visible {
    border-color: rgba(212, 175, 55, 0.6);
    background: rgba(212, 175, 55, 0.08);
    transform: translateY(-2px);
    outline: none;
  }
  .xp-stat-box--analytics {
    background: linear-gradient(160deg, rgba(212,175,55,0.14), rgba(255,255,255,0.04));
    border-color: rgba(212, 175, 55, 0.45);
  }
  .xp-stat-new {
    position: absolute;
    top: 8px;
    inset-inline-end: 8px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    background: #D4AF37;
    color: #0B0B0B;
    padding: 2px 6px;
    border-radius: 999px;
  }
  .xp-stat-icon {
    color: #D4AF37;
    display: inline-flex;
  }
  .xp-stat-number {
    display: block;
    font-size: 22px;
    font-weight: 800;
    color: #D4AF37;
  }
  .xp-stat-number--sm {
    font-size: 18px;
  }
  .xp-stat-label {
    font-size: 11px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Feature slider */
  .xp-slider {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(212, 175, 55, 0.18);
    border-radius: 12px;
    padding: 14px 16px 0;
    overflow: hidden;
  }
  .xp-slider-stage {
    position: relative;
    min-height: 64px;
  }
  .xp-slide {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    opacity: 0;
    transform: translateY(8px);
    visibility: hidden;
    transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s linear 0.45s;
  }
  .xp-slide.is-active {
    position: relative;
    opacity: 1;
    transform: translateY(0);
    visibility: visible;
    transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s;
  }
  .xp-slide-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #D4AF37;
    background: rgba(212, 175, 55, 0.1);
    border: 1px solid rgba(212, 175, 55, 0.3);
  }
  .xp-slide-body {
    flex: 1;
    min-width: 0;
  }
  .xp-slide-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .xp-slide-name {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
  }
  .xp-slide-status {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #222;
    color: #888;
    border: 1px solid #333;
  }
  .xp-slide-status.is-on {
    background: rgba(16, 128, 67, 0.2);
    color: #4ade80;
    border-color: rgba(74, 222, 128, 0.3);
  }
  .xp-slide-pitch {
    margin: 4px 0 0;
    font-size: 13px;
    color: #b0b0b0;
    line-height: 1.45;
  }
  .xp-slide-link {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 700;
    color: #D4AF37;
    text-decoration: none;
    border: 1px solid rgba(212, 175, 55, 0.45);
    padding: 7px 12px;
    border-radius: 8px;
    white-space: nowrap;
    transition: background 0.15s ease;
  }
  .xp-slide-link:hover,
  .xp-slide-link:focus-visible {
    background: rgba(212, 175, 55, 0.12);
    outline: none;
  }
  .xp-slider-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    padding-bottom: 10px;
  }
  .xp-slider-dots {
    display: flex;
    gap: 6px;
  }
  .xp-dot {
    width: 7px;
    height: 7px;
    padding: 0;
    border-radius: 999px;
    border: none;
    background: #3a3a3a;
    cursor: pointer;
    transition: width 0.3s ease, background 0.3s ease;
  }
  .xp-dot.is-active {
    width: 22px;
    background: #D4AF37;
  }
  .xp-dot:focus-visible {
    outline: 2px solid #D4AF37;
    outline-offset: 2px;
  }
  .xp-slider-count {
    font-size: 11px;
    color: #777;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
  }
  .xp-slider-progress {
    height: 2px;
    margin: 0 -16px;
    background: rgba(255, 255, 255, 0.05);
  }
  .xp-slider-progress-fill {
    display: block;
    height: 100%;
    width: 100%;
    background: linear-gradient(90deg, #8a6d1f, #D4AF37);
    transform-origin: left center;
    animation-name: xp-progress;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }
  [dir="rtl"] .xp-slider-progress-fill {
    transform-origin: right center;
  }
  @keyframes xp-progress {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }

  /* Case study strip */
  .xp-case {
    border-top: 1px solid rgba(212, 175, 55, 0.15);
    padding-top: 16px;
    transition: opacity 0.3s ease;
  }
  .xp-case.is-pending {
    opacity: 0;
  }
  .xp-case-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .xp-case-tag {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #0B0B0B;
    background: #D4AF37;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .xp-case-feature {
    font-size: 11px;
    font-weight: 700;
    color: #D4AF37;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .xp-case-count {
    margin-inline-start: auto;
    font-size: 11px;
    color: #666;
    font-variant-numeric: tabular-nums;
  }
  .xp-case-next {
    background: none;
    border: 1px solid #333;
    color: #aaa;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 6px;
    cursor: pointer;
  }
  .xp-case-next:hover,
  .xp-case-next:focus-visible {
    color: #D4AF37;
    border-color: rgba(212, 175, 55, 0.5);
    outline: none;
  }
  .xp-case-body {
    animation: xp-case-in 0.5s ease both;
  }
  @keyframes xp-case-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .xp-case-headline {
    margin: 0 0 3px;
    font-size: 13px;
    font-weight: 600;
    color: #e8e8e8;
    line-height: 1.45;
  }
  .xp-case-detail {
    margin: 0 0 4px;
    font-size: 12px;
    color: #9a9a9a;
    line-height: 1.45;
  }
  .xp-case-apply {
    color: #D4AF37;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
  .xp-case-apply:hover {
    text-decoration: underline;
  }
  .xp-case-source {
    margin: 0;
    font-size: 10.5px;
    color: #666;
  }
  .xp-case-source a {
    color: #7d7d7d;
    text-decoration: underline;
    text-decoration-color: #444;
    text-underline-offset: 2px;
  }
  .xp-case-source a:hover {
    color: #b0b0b0;
  }

  @media (max-width: 720px) {
    .xp-hero { padding: 20px 16px; }
    .xp-hero-title { font-size: 22px; }
    .xp-hero-stats { grid-template-columns: repeat(3, 1fr); flex-basis: 100%; }
    .xp-stat-box { padding: 12px 8px; min-height: 84px; }
    .xp-stat-number { font-size: 18px; }
    .xp-stat-number--sm { font-size: 15px; }
    .xp-slide { flex-wrap: wrap; row-gap: 10px; }
    .xp-slide-body { flex: 1 1 calc(100% - 58px); }
    .xp-slide-link { margin-inline-start: 0; }
    .xp-case-feature { flex-basis: 100%; order: 3; }
  }
  @media (prefers-reduced-motion: reduce) {
    .xp-slide, .xp-slide.is-active, .xp-case-body, .xp-dot, .xp-stat-box--link {
      transition: none;
      animation: none;
    }
  }
  .xp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-top: 12px;
  }
  .xp-card {
    background: #141414;
    border: 1px solid #282828;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
  }
  .xp-card.is-enabled {
    border-color: #D4AF37;
    box-shadow: 0 4px 14px rgba(212, 175, 55, 0.15);
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
    background: #222222;
    color: #888888;
    border: 1px solid #333333;
  }
  .xp-card-desc {
    font-size: 13px;
    color: #b0b0b0;
    line-height: 1.5;
    margin: 0 0 16px;
    flex: 1;
  }
  .xp-card-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #222222;
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
    background: #0B0B0B;
    color: #D4AF37;
    border: 1px solid #D4AF37;
  }
  .xp-toggle-btn--on:hover {
    background: #1f1f1f;
  }
  .xp-toggle-btn--off {
    background: #1f1f1f;
    color: #888888;
    border: 1px solid #333333;
  }
  .xp-toggle-btn--off:hover {
    background: #2a2a2a;
    color: #ffffff;
  }
  .xp-config-link {
    font-size: 13px;
    font-weight: 600;
    color: #D4AF37;
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
    background: #141414;
    border: 1px solid #282828;
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
    background: #0B0B0B;
    color: #D4AF37;
    font-weight: 700;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 13px;
    border: 1px solid #D4AF37;
  }
  .xp-step p {
    font-size: 12px;
    color: #b0b0b0;
    margin: 4px 0 0;
    line-height: 1.4;
  }
  s-section {
    color: #ffffff;
  }
`;
