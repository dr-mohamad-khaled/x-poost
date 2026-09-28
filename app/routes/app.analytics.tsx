import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "../shop.server";

/**
 * Analytics tab — shell.
 * Tracking (impressions, clicks, actions, revenue) is being built per
 * docs/xpoost-analytics-plan.md. Until data exists, this page shows the
 * layout with empty states so the nav link and dashboard tile work.
 */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  return {
    enabled: {
      scarcity: shop?.scarcityEnabled ?? false,
      productScarcity: shop?.productScarcityEnabled ?? false,
      quantityBreaks: shop?.quantityBreaksEnabled ?? false,
      prePurchase: shop?.prePurchaseEnabled ?? false,
      inCart: shop?.inCartUpsellEnabled ?? false,
      shippingBar: shop?.shippingBarEnabled ?? false,
      exitIntent: shop?.exitIntentEnabled ?? false,
      socialBar: shop?.socialBarEnabled ?? false,
    } as Record<string, boolean>,
  };
};

const KPIS = [
  { label: "Direct Revenue", hint: "Revenue from items XPoost added, net of discounts" },
  { label: "Orders Touched", hint: "Orders containing at least one XPoost item" },
  { label: "AOV Lift", hint: "Average order value with XPoost vs without" },
  { label: "Viewable Impressions", hint: "Widgets at least 50% on screen for 1 second" },
  { label: "CTR", hint: "Clicks on a widget's call to action ÷ impressions" },
  { label: "Discount Cost", hint: "Discounts given through XPoost offers" },
];

const FEATURES: Array<{ id: string; name: string; route: string; metrics: string[] }> = [
  { id: "prePurchase", name: "Pre-Purchase Upsell", route: "/app/pre-purchase", metrics: ["Modal views", "Take rate", "Items per accept", "Revenue per offer", "Best trigger → upsell pairs"] },
  { id: "inCart", name: "Cart Drawer Upsell", route: "/app/in-cart", metrics: ["Drawer views with offer", "CTR", "Attach rate", "Removal rate", "Revenue per rule"] },
  { id: "quantityBreaks", name: "Quantity Breaks", route: "/app/quantity-breaks", metrics: ["Tier mix (1 / 2 / 3+)", "Units per order", "Incremental units", "Discount cost"] },
  { id: "shippingBar", name: "Free Shipping Bar", route: "/app/shipping-bar", metrics: ["% of carts reaching threshold", "Near-miss carts", "Cart value histogram", "AOV of exposed carts"] },
  { id: "exitIntent", name: "Exit-Intent Saver", route: "/app/exit-intent", metrics: ["Triggers", "Claim rate", "Code redemptions", "Recovered revenue", "Mobile vs desktop"] },
  { id: "scarcity", name: "Urgency Notifications", route: "/app/scarcity", metrics: ["Views", "CTR", "Close rate", "Add-to-cart rate vs holdout"] },
  { id: "productScarcity", name: "Stock Scarcity Block", route: "/app/product-scarcity", metrics: ["PDP views with block", "Add-to-cart rate vs holdout", "Performance by design preset"] },
  { id: "socialBar", name: "Support & Social Bar", route: "/app/social-bar", metrics: ["Opens", "Clicks per channel", "Chat-assisted orders", "Top pages starting chats"] },
];

export default function Analytics() {
  const { enabled } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState<string>("overview");
  const feature = FEATURES.find((f) => f.id === selected);

  return (
    <s-page heading="Analytics">
      <style>{ANALYTICS_STYLES}</style>

      <div className="xpa-notice">
        <span className="xpa-notice-dot" aria-hidden="true" />
        <div>
          <strong>Collecting data soon</strong>
          <p>
            XPoost is getting ready to track impressions, clicks, actions and revenue for every feature. Numbers will
            appear here automatically once tracking goes live.
          </p>
        </div>
      </div>

      <div className="xpa-selector" role="tablist" aria-label="Choose what to analyse">
        <button
          type="button"
          role="tab"
          aria-selected={selected === "overview"}
          className={`xpa-chip ${selected === "overview" ? "is-active" : ""}`}
          onClick={() => setSelected("overview")}
        >
          All Features
        </button>
        {FEATURES.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={selected === f.id}
            className={`xpa-chip ${selected === f.id ? "is-active" : ""}`}
            onClick={() => setSelected(f.id)}
          >
            <span className={`xpa-chip-dot ${enabled[f.id] ? "is-on" : ""}`} aria-hidden="true" />
            {f.name}
          </button>
        ))}
      </div>

      {feature ? (
        <div className="xpa-panel">
          <div className="xpa-panel-head">
            <h2>{feature.name}</h2>
            <Link to={feature.route} className="xpa-link">
              Feature settings &rarr;
            </Link>
          </div>
          {!enabled[feature.id] ? (
            <p className="xpa-muted">This feature is currently off, so it won't collect data until you enable it.</p>
          ) : null}
          <div className="xpa-kpis">
            {feature.metrics.map((m) => (
              <div key={m} className="xpa-kpi">
                <span className="xpa-kpi-value">—</span>
                <span className="xpa-kpi-label">{m}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="xpa-panel">
          <div className="xpa-panel-head">
            <h2>All Features</h2>
          </div>
          <div className="xpa-kpis">
            {KPIS.map((k) => (
              <div key={k.label} className="xpa-kpi" title={k.hint}>
                <span className="xpa-kpi-value">—</span>
                <span className="xpa-kpi-label">{k.label}</span>
                <span className="xpa-kpi-hint">{k.hint}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </s-page>
  );
}

const ANALYTICS_STYLES = `
  .xpa-notice {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    background: linear-gradient(135deg, #0B0B0B 0%, #171717 60%, #201b10 100%);
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 12px;
    padding: 18px 20px;
    color: #fff;
    margin-bottom: 18px;
  }
  .xpa-notice strong { font-size: 15px; }
  .xpa-notice p { margin: 4px 0 0; font-size: 13px; color: #b0b0b0; line-height: 1.5; }
  .xpa-notice-dot {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    margin-top: 5px;
    border-radius: 50%;
    background: #D4AF37;
    box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.18);
    animation: xpa-pulse 1.8s ease-in-out infinite;
  }
  @keyframes xpa-pulse { 50% { box-shadow: 0 0 0 8px rgba(212, 175, 55, 0.05); } }
  .xpa-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .xpa-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid #2a2a2a;
    background: #141414;
    color: #b0b0b0;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .xpa-chip:hover { border-color: rgba(212, 175, 55, 0.5); color: #fff; }
  .xpa-chip.is-active { background: #0B0B0B; color: #D4AF37; border-color: #D4AF37; }
  .xpa-chip:focus-visible { outline: 2px solid #D4AF37; outline-offset: 2px; }
  .xpa-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: #444; }
  .xpa-chip-dot.is-on { background: #4ade80; }
  .xpa-panel {
    background: #141414;
    border: 1px solid #282828;
    border-radius: 12px;
    padding: 20px;
    color: #fff;
  }
  .xpa-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .xpa-panel-head h2 { margin: 0; font-size: 16px; color: #D4AF37; }
  .xpa-link { font-size: 13px; font-weight: 600; color: #D4AF37; text-decoration: none; }
  .xpa-link:hover { text-decoration: underline; }
  .xpa-muted { font-size: 12px; color: #888; margin: -6px 0 14px; }
  .xpa-kpis {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
  }
  .xpa-kpi {
    background: #0f0f0f;
    border: 1px solid #242424;
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .xpa-kpi-value { font-size: 22px; font-weight: 800; color: #555; }
  .xpa-kpi-label { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
  .xpa-kpi-hint { font-size: 11px; color: #666; line-height: 1.4; }
  @media (prefers-reduced-motion: reduce) { .xpa-notice-dot { animation: none; } }
`;
