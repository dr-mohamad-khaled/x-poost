import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { getBillingData, processBillingAction } from "../pricing.server";
import { MONTHLY_PLAN, LIFETIME_PLAN } from "../billing.constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return await getBillingData(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return await processBillingAction(request);
};

export default function Pricing() {
  const {
    hasActivePayment,
    activePlanName,
    activeSubscriptionId,
    isLifetime,
    trialDaysRemaining,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";

  return (
    <s-page heading="Plans & Pricing">
      <style>{`
        .xpp-container {
          max-width: 1040px;
          margin: 0 auto;
          padding: 20px 0 60px;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .xpp-hero {
          background: linear-gradient(135deg, #111111 0%, #1a1813 100%);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 12px;
          padding: 32px;
          margin-bottom: 24px;
          text-align: center;
        }
        .xpp-hero-badge {
          display: inline-block;
          background: rgba(212, 175, 55, 0.15);
          color: #D4AF37;
          border: 1px solid rgba(212, 175, 55, 0.4);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .xpp-hero-title {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 10px;
          letter-spacing: -0.5px;
        }
        .xpp-hero-subtitle {
          font-size: 15px;
          color: #b8b8b8;
          max-width: 680px;
          margin: 0 auto;
          line-height: 1.6;
        }
        .xpp-status-banner {
          background: #141414;
          border-left: 4px solid #D4AF37;
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .xpp-status-title {
          font-weight: 700;
          font-size: 14px;
          color: #ffffff;
          margin-bottom: 4px;
        }
        .xpp-status-desc {
          font-size: 13px;
          color: #9e9e9e;
          margin: 0;
        }
        .xpp-plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }
        .xpp-plan-card {
          background: #121212;
          border: 1px solid #282828;
          border-radius: 12px;
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .xpp-plan-card--featured {
          border: 2px solid #D4AF37;
          background: linear-gradient(180deg, #181611 0%, #121212 100%);
          box-shadow: 0 12px 36px rgba(212, 175, 55, 0.12);
        }
        .xpp-plan-tag {
          position: absolute;
          top: -12px;
          right: 24px;
          background: #D4AF37;
          color: #000000;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .xpp-plan-name {
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 12px;
        }
        .xpp-plan-price-box {
          margin-bottom: 16px;
          padding-bottom: 20px;
          border-bottom: 1px solid #222222;
        }
        .xpp-plan-price {
          font-size: 38px;
          font-weight: 800;
          color: #ffffff;
          line-height: 1;
        }
        .xpp-plan-period {
          font-size: 14px;
          color: #888888;
          margin-left: 6px;
        }
        .xpp-plan-note {
          font-size: 12px;
          color: #D4AF37;
          margin-top: 6px;
          font-weight: 600;
        }
        .xpp-features-list {
          list-style: none;
          padding: 0;
          margin: 0 0 28px;
          flex: 1;
        }
        .xpp-feature-item {
          font-size: 13px;
          color: #cccccc;
          padding: 8px 0;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .xpp-check-icon {
          color: #D4AF37;
          font-weight: bold;
          flex-shrink: 0;
        }
        .xpp-btn {
          display: block;
          width: 100%;
          text-align: center;
          padding: 14px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
          text-decoration: none;
        }
        .xpp-btn--primary {
          background: #D4AF37;
          color: #000000;
        }
        .xpp-btn--primary:hover {
          background: #e2c04d;
        }
        .xpp-btn--secondary {
          background: #242424;
          color: #ffffff;
          border: 1px solid #3a3a3a;
        }
        .xpp-btn--secondary:hover {
          background: #2e2e2e;
        }
        .xpp-btn--disabled {
          background: #1c1c1c;
          color: #666666;
          cursor: not-allowed;
          border: 1px solid #282828;
        }
        .xpp-compare-card {
          background: #111111;
          border: 1px solid #242424;
          border-radius: 12px;
          padding: 28px;
        }
        .xpp-compare-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 8px;
        }
        .xpp-compare-desc {
          font-size: 13px;
          color: #999999;
          margin: 0 0 20px;
        }
        .xpp-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .xpp-table th, .xpp-table td {
          padding: 12px 14px;
          text-align: left;
          border-bottom: 1px solid #222222;
        }
        .xpp-table th {
          color: #888888;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
        }
        .xpp-table tr:last-child td {
          border-bottom: none;
          font-weight: 700;
          font-size: 14px;
        }
        .xpp-cost-bad {
          color: #ff6b6b;
          font-weight: 600;
        }
        .xpp-cost-good {
          color: #51cf66;
          font-weight: 700;
        }
      `}</style>

      <div className="xpp-container">
        {actionData?.error && (
          <div className="xpp-status-banner" style={{ borderLeftColor: "#ff4d4d" }}>
            <div>
              <div className="xpp-status-title" style={{ color: "#ff4d4d" }}>Billing Notice</div>
              <p className="xpp-status-desc">{actionData.error}</p>
            </div>
          </div>
        )}

        {actionData?.message && (
          <div className="xpp-status-banner" style={{ borderLeftColor: "#51cf66" }}>
            <div>
              <div className="xpp-status-title" style={{ color: "#51cf66" }}>Status Updated</div>
              <p className="xpp-status-desc">{actionData.message}</p>
            </div>
          </div>
        )}

        {/* Current Account Status */}
        <div className="xpp-status-banner">
          <div>
            <div className="xpp-status-title">
              {hasActivePayment ? "Account Status: Active" : "7-Day Free Trial Available"}
            </div>
            <p className="xpp-status-desc">
              {hasActivePayment
                ? `Currently on ${activePlanName || (isLifetime ? LIFETIME_PLAN : MONTHLY_PLAN)}${isLifetime ? " (Lifetime Pass — No recurring charges)" : ""}${!isLifetime && trialDaysRemaining !== null && trialDaysRemaining > 0 ? ` with ${trialDaysRemaining} days remaining in trial` : ""}`
                : "Select either plan below to get started. Cancel anytime during your 7-day trial with 1 click."}
            </p>
          </div>
          {hasActivePayment && !isLifetime && activeSubscriptionId && (
            <Form method="post">
              <input type="hidden" name="actionType" value="cancel" />
              <input type="hidden" name="subscriptionId" value={activeSubscriptionId} />
              <button
                type="submit"
                className="xpp-btn xpp-btn--secondary"
                style={{ padding: "8px 16px", fontSize: "12px", color: "#ff6b6b" }}
                disabled={isSubmitting}
              >
                Cancel Subscription
              </button>
            </Form>
          )}
        </div>

        {/* Hero Section */}
        <div className="xpp-hero">
          <span className="xpp-hero-badge">All-in-One Conversion Engine</span>
          <h1 className="xpp-hero-title">
            Replace 5 Expensive Apps. Boost Orders. Save $700+ Every Year.
          </h1>
          <p className="xpp-hero-subtitle">
            Everything your store needs to maximize Average Order Value and recover lost sales in one ultra-lightweight suite. Zero code conflicts, zero storefront slowdown.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="xpp-plans-grid">
          {/* Plan 1: Monthly Suite */}
          <div className="xpp-plan-card">
            <h2 className="xpp-plan-name">Monthly Suite</h2>
            <div className="xpp-plan-price-box">
              <span className="xpp-plan-price">$15</span>
              <span className="xpp-plan-period">/ month</span>
              <div className="xpp-plan-note">First 7 Days 100% Free</div>
            </div>
            <ul className="xpp-features-list">
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Pre-Purchase One-Click Upsell Modal</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>In-Cart Drawer Smart Recommendations</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Tiered Free Shipping & Milestone Progress Bar</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Social Proof & Scarcity Urgency Corner Toasts</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Customer Support & VIP WhatsApp Floating Bar</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Exit-Intent Countdown Cart Recovery Modal</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Native Shopify Functions Automatic Discounts</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Unlimited Impressions, Products & Orders</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Cancel anytime in 1 click</span>
              </li>
            </ul>

            <Form method="post">
              <input type="hidden" name="plan" value={MONTHLY_PLAN} />
              <button
                type="submit"
                className={`xpp-btn ${hasActivePayment && !isLifetime ? "xpp-btn--disabled" : "xpp-btn--secondary"}`}
                disabled={Boolean(hasActivePayment && !isLifetime) || isSubmitting}
              >
                {hasActivePayment && !isLifetime ? "Current Active Plan" : "Start 7-Day Free Trial"}
              </button>
            </Form>
          </div>

          {/* Plan 2: Founder's Lifetime Pass */}
          <div className="xpp-plan-card xpp-plan-card--featured">
            <span className="xpp-plan-tag">Best Value</span>
            <h2 className="xpp-plan-name">Founder's Lifetime Pass</h2>
            <div className="xpp-plan-price-box">
              <span className="xpp-plan-price">$249</span>
              <span className="xpp-plan-period">one-time investment</span>
              <div className="xpp-plan-note">Pay Once, Profit Forever</div>
            </div>
            <ul className="xpp-features-list">
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span><strong>All 6 Conversion Engines Included for Life</strong></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span><strong>All future updates & new features included</strong></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Saves $720+ in subscription fees over 2 years</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Never pay another monthly bill or unexpected charge</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Unlimited usage, impressions, and revenue</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Priority VIP Developer Support</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">✓</span>
                <span>Hosted on Shopify Global CDN with WebAssembly</span>
              </li>
            </ul>

            <Form method="post">
              <input type="hidden" name="plan" value={LIFETIME_PLAN} />
              <button
                type="submit"
                className={`xpp-btn ${isLifetime ? "xpp-btn--disabled" : "xpp-btn--primary"}`}
                disabled={Boolean(isLifetime) || isSubmitting}
              >
                {isLifetime ? "Lifetime Access Active" : "Claim Lifetime Access"}
              </button>
            </Form>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="xpp-compare-card">
          <h3 className="xpp-compare-title">The Cost of App Bloat vs. XPoost</h3>
          <p className="xpp-compare-desc">
            Most merchants install 5 to 6 separate apps that conflict with each other and slow down their store. Here is how buying standalone apps compares to XPoost:
          </p>

          <table className="xpp-table">
            <thead>
              <tr>
                <th>Feature / App Needed</th>
                <th>Typical Standalone Cost</th>
                <th>With XPoost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pre-Purchase & In-Cart Upsells (ReConvert / Honeycomb)</td>
                <td className="xpp-cost-bad">~$25 / month</td>
                <td className="xpp-cost-good">Included</td>
              </tr>
              <tr>
                <td>Urgency & Scarcity Proof Toasts (Nudgify / Fera)</td>
                <td className="xpp-cost-bad">~$15 / month</td>
                <td className="xpp-cost-good">Included</td>
              </tr>
              <tr>
                <td>Tiered Free Shipping Goal Bar</td>
                <td className="xpp-cost-bad">~$10 / month</td>
                <td className="xpp-cost-good">Included</td>
              </tr>
              <tr>
                <td>WhatsApp Customer Support & Social Action Bar</td>
                <td className="xpp-cost-bad">~$10 / month</td>
                <td className="xpp-cost-good">Included</td>
              </tr>
              <tr>
                <td>Exit-Intent Cart Abandonment Saver Modal</td>
                <td className="xpp-cost-bad">~$15 / month</td>
                <td className="xpp-cost-good">Included</td>
              </tr>
              <tr>
                <td>Total Monthly Cost</td>
                <td className="xpp-cost-bad">$75+ / month ($900 / year)</td>
                <td className="xpp-cost-good">$15 / month (or $249 Lifetime)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </s-page>
  );
}
