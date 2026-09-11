import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop, getShopWithConfigs } from "../shop.server";
import { ensureUpsellDiscountRegistered } from "../discount.server";

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
      exitIntent: {
        id: "exitIntent",
        title: "Exit-Intent Cart Recovery Modal",
        description: "Engage shoppers intending to leave your store with a targeted discount offer to save the sale before they bounce.",
        route: "/app/exit-intent",
        enabled: shopData?.exitIntentEnabled ?? false,
        badge: shopData?.exitIntentConfig?.active ? "Active" : "Disabled",
      },
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
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
};

export default function XPoostDashboard() {
  const { shopDomain, features } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const featureList = Object.values(features);
  const activeCount = featureList.filter((f) => f.enabled).length;

  return (
    <s-page heading="XPoost — Conversion Suite">
      <style>{DASHBOARD_STYLES}</style>

      {actionData && "ok" in actionData ? (
        <s-banner tone="success">Feature status updated successfully.</s-banner>
      ) : null}

      <div className="xp-hero">
        <div className="xp-hero-content">
          <div className="xp-hero-tag">Storefront Conversion Suite</div>
          <h1 className="xp-hero-title">Boost Sales &amp; Average Order Value</h1>
          <p className="xp-hero-subtitle">
            6 coordinated conversion features designed to increase revenue, engage shoppers, and recover lost carts.
          </p>
        </div>
        <div className="xp-hero-stats">
          <div className="xp-stat-box">
            <span className="xp-stat-number">{activeCount} / 6</span>
            <span className="xp-stat-label">Features Active</span>
          </div>
          <div className="xp-stat-box">
            <span className="xp-stat-number">&lt; 15 KB</span>
            <span className="xp-stat-label">Lightweight Assets</span>
          </div>
          <div className="xp-stat-box">
            <Link to="/app/pricing" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="xp-stat-number" style={{ color: "#D4AF37" }}>Plans</span>
              <span className="xp-stat-label">Manage Billing &rarr;</span>
            </Link>
          </div>
        </div>
      </div>

      <s-section heading="Conversion Features">
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
                <Form method="post" className="xp-inline-form">
                  <input type="hidden" name="featureKey" value={f.id} />
                  <input type="hidden" name="enable" value={f.enabled ? "false" : "true"} />
                  <button
                    type="submit"
                    className={`xp-toggle-btn ${f.enabled ? "xp-toggle-btn--off" : "xp-toggle-btn--on"}`}
                    disabled={isSubmitting}
                  >
                    {f.enabled ? "Disable" : "Enable"}
                  </button>
                </Form>
                <Link to={f.route} className="xp-config-link">
                  Configure Settings &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </s-section>

      <s-section heading="Theme App Extension Setup">
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
      </s-section>
    </s-page>
  );
}

const DASHBOARD_STYLES = `
  .xp-hero {
    background: linear-gradient(135deg, #0B0B0B 0%, #171717 60%, #201b10 100%);
    border: 1px solid rgba(212, 175, 55, 0.25);
    border-radius: 12px;
    padding: 32px 28px;
    color: #FFFFFF;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  }
  .xp-hero-content {
    flex: 1 1 380px;
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
    margin: 0;
    line-height: 1.5;
  }
  .xp-hero-stats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .xp-stat-box {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-radius: 8px;
    padding: 16px 20px;
    text-align: center;
    min-width: 110px;
  }
  .xp-stat-number {
    display: block;
    font-size: 22px;
    font-weight: 800;
    color: #D4AF37;
    margin-bottom: 4px;
  }
  .xp-stat-label {
    font-size: 11px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .xp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-top: 12px;
  }
  .xp-card {
    background: #ffffff;
    border: 1px solid #e1e3e5;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
  }
  .xp-card.is-enabled {
    border-color: #D4AF37;
    box-shadow: 0 4px 14px rgba(212, 175, 55, 0.12);
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
    font-weight: 600;
    color: #202223;
    margin: 0;
  }
  .xp-pill {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 12px;
    white-space: nowrap;
  }
  .xp-pill--active {
    background: #e4f7e6;
    color: #108043;
  }
  .xp-pill--inactive {
    background: #f1f2f3;
    color: #6d7175;
  }
  .xp-card-desc {
    font-size: 13px;
    color: #6d7175;
    line-height: 1.5;
    margin: 0 0 16px;
    flex: 1;
  }
  .xp-card-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #f1f2f3;
    padding-top: 14px;
    gap: 12px;
  }
  .xp-inline-form {
    margin: 0;
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
    background: #f1f2f3;
    color: #6d7175;
  }
  .xp-toggle-btn--off:hover {
    background: #e4e5e7;
  }
  .xp-config-link {
    font-size: 13px;
    font-weight: 600;
    color: #2c6ecb;
    text-decoration: none;
  }
  .xp-setup-guide {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 18px;
    margin-top: 12px;
  }
  .xp-step {
    background: #f9fafb;
    border: 1px solid #e1e3e5;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
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
  }
  .xp-step p {
    font-size: 12px;
    color: #6d7175;
    margin: 4px 0 0;
    line-height: 1.4;
  }
`;
