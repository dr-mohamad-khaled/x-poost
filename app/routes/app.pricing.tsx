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
        /* ── Reset & Base ── */
        .xpp-container {
          max-width: 1080px;
          margin: 0 auto;
          padding: 24px 20px 80px;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #0a0a0a;
          border-radius: 16px;
        }
        .xpp-container * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Highlight Badges & Accents ── */
        .xpp-hl-gold {
          color: #FFD700 !important;
          font-weight: 800;
        }
        .xpp-hl-green {
          color: #4ade80 !important;
          font-weight: 800;
        }
        .xpp-badge-gold {
          display: inline-block;
          background: rgba(255, 215, 0, 0.16);
          border: 1px solid #D4AF37;
          color: #FFD700 !important;
          padding: 2px 9px;
          border-radius: 6px;
          font-weight: 800;
          font-size: 0.92em;
          letter-spacing: 0.2px;
          vertical-align: middle;
        }
        .xpp-badge-green {
          display: inline-block;
          background: rgba(74, 222, 128, 0.16);
          border: 1px solid #4ade80;
          color: #4ade80 !important;
          padding: 2px 9px;
          border-radius: 6px;
          font-weight: 800;
          font-size: 0.92em;
          letter-spacing: 0.2px;
          vertical-align: middle;
        }
        .xpp-badge-red {
          display: inline-block;
          background: rgba(255, 82, 82, 0.16);
          border: 1px solid #ff5252;
          color: #ff5252 !important;
          padding: 2px 9px;
          border-radius: 6px;
          font-weight: 800;
          font-size: 0.92em;
          letter-spacing: 0.2px;
          vertical-align: middle;
        }

        /* ── Hero ── */
        .xpp-hero {
          background: linear-gradient(145deg, #111111 0%, #1e1910 50%, #111111 100%);
          border: 1.5px solid rgba(212, 175, 55, 0.4);
          border-radius: 16px;
          padding: 48px 36px 44px;
          margin-bottom: 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .xpp-hero-badge {
          display: inline-block;
          background: rgba(212, 175, 55, 0.2);
          color: #FFD700;
          border: 1px solid #D4AF37;
          padding: 6px 18px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
        .xpp-hero-title {
          font-size: 34px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 16px;
          letter-spacing: -0.5px;
          line-height: 1.25;
        }
        .xpp-hero-title em {
          font-style: normal;
          color: #FFD700;
        }
        .xpp-hero-subtitle {
          font-size: 16px;
          color: #ffffff;
          max-width: 760px;
          margin: 0 auto;
          line-height: 1.7;
          font-weight: 400;
        }

        /* ── Stat Proof Bar ── */
        .xpp-proof-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .xpp-proof-stat {
          background: #141414;
          border: 1.5px solid #2d2d2d;
          border-radius: 12px;
          padding: 24px 18px;
          text-align: center;
        }
        .xpp-proof-num {
          font-size: 32px;
          font-weight: 900;
          color: #FFD700;
          line-height: 1;
          margin-bottom: 8px;
        }
        .xpp-proof-label {
          font-size: 13px;
          color: #ffffff;
          line-height: 1.5;
          font-weight: 600;
        }

        /* ── Unlimited Banner ── */
        .xpp-unlimited-banner {
          background: #18150f;
          border: 2px solid #D4AF37;
          border-radius: 14px;
          padding: 26px 30px;
          margin-bottom: 26px;
          display: flex;
          align-items: center;
          gap: 22px;
          box-shadow: 0 4px 20px rgba(212, 175, 55, 0.15);
        }
        .xpp-unlimited-icon {
          flex-shrink: 0;
          width: 54px;
          height: 54px;
          background: rgba(212, 175, 55, 0.25);
          border: 1.5px solid #FFD700;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .xpp-unlimited-content h3 {
          font-size: 19px;
          font-weight: 900;
          margin: 0 0 8px;
          color: #ffffff;
        }
        .xpp-unlimited-content p {
          font-size: 14.5px;
          color: #ffffff;
          margin: 0;
          line-height: 1.7;
        }

        /* ── Status Banner ── */
        .xpp-status-banner {
          background: #141414;
          border-left: 5px solid #D4AF37;
          border: 1px solid #2d2d2d;
          border-left-width: 5px;
          border-radius: 10px;
          padding: 18px 22px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
        }
        .xpp-status-title {
          font-weight: 800;
          font-size: 15px;
          color: #ffffff;
          margin-bottom: 4px;
        }
        .xpp-status-desc {
          font-size: 14px;
          color: #ffffff;
          margin: 0;
          line-height: 1.5;
        }

        /* ── Plans Grid ── */
        .xpp-plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 24px;
          margin-bottom: 34px;
        }
        .xpp-plan-card {
          background: #121212;
          border: 1.5px solid #333333;
          border-radius: 16px;
          padding: 38px 32px;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .xpp-plan-card:hover {
          transform: translateY(-2px);
        }
        .xpp-plan-card--featured {
          border: 2.5px solid #D4AF37;
          background: linear-gradient(180deg, #1a1710 0%, #121212 100%);
          box-shadow: 0 16px 48px rgba(212, 175, 55, 0.18);
        }
        .xpp-plan-tag {
          position: absolute;
          top: -14px;
          right: 24px;
          background: linear-gradient(135deg, #FFD700 0%, #D4AF37 100%);
          color: #000000;
          font-size: 12px;
          font-weight: 900;
          padding: 6px 16px;
          border-radius: 14px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          box-shadow: 0 2px 10px rgba(212, 175, 55, 0.35);
        }
        .xpp-plan-name {
          font-size: 24px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 8px;
        }
        .xpp-plan-desc {
          font-size: 14px;
          color: #ffffff;
          margin: 0 0 18px;
          line-height: 1.55;
        }
        .xpp-plan-price-box {
          margin-bottom: 22px;
          padding-bottom: 22px;
          border-bottom: 1.5px solid #282828;
        }
        .xpp-plan-price {
          font-size: 46px;
          font-weight: 900;
          color: #ffffff;
          line-height: 1;
        }
        .xpp-plan-period {
          font-size: 15px;
          color: #ffffff;
          margin-left: 8px;
          font-weight: 600;
        }
        .xpp-plan-note {
          font-size: 13.5px;
          color: #ffffff;
          margin-top: 10px;
          font-weight: 600;
        }
        .xpp-plan-divider-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #FFD700;
          font-weight: 800;
          margin-bottom: 14px;
        }
        .xpp-features-list {
          list-style: none;
          padding: 0;
          margin: 0 0 30px;
          flex: 1;
        }
        .xpp-feature-item {
          font-size: 14px;
          color: #ffffff;
          padding: 10px 0;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          line-height: 1.5;
        }
        .xpp-feature-item:last-child {
          border-bottom: none;
        }
        .xpp-feature-item strong {
          color: #ffffff;
          font-weight: 800;
        }
        .xpp-check-icon {
          color: #FFD700;
          font-weight: 900;
          font-size: 16px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .xpp-infinity-icon {
          color: #FFD700;
          font-size: 19px;
          font-weight: 900;
          flex-shrink: 0;
          margin-top: -1px;
        }

        /* ── CTAs ── */
        .xpp-btn {
          display: block;
          width: 100%;
          text-align: center;
          padding: 16px 22px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
          text-decoration: none;
        }
        .xpp-btn--primary {
          background: linear-gradient(135deg, #FFD700 0%, #D4AF37 100%);
          color: #000000;
          box-shadow: 0 4px 18px rgba(212, 175, 55, 0.35);
        }
        .xpp-btn--primary:hover {
          background: linear-gradient(135deg, #ffe033 0%, #e5bd38 100%);
          box-shadow: 0 6px 26px rgba(212, 175, 55, 0.45);
          transform: translateY(-1px);
        }
        .xpp-btn--secondary {
          background: #1f1f1f;
          color: #ffffff;
          border: 1.5px solid #444444;
        }
        .xpp-btn--secondary:hover {
          background: #2a2a2a;
          border-color: #666666;
        }
        .xpp-btn--disabled {
          background: #1c1c1c;
          color: #ffffff;
          opacity: 0.55;
          cursor: not-allowed;
          border: 1px solid #333333;
        }
        .xpp-btn-sub {
          display: block;
          text-align: center;
          font-size: 12px;
          color: #ffffff;
          opacity: 0.9;
          margin-top: 10px;
          font-weight: 500;
        }

        /* ── Competitor vs XPoost Grid ── */
        .xpp-vs-section {
          margin-bottom: 34px;
        }
        .xpp-vs-title {
          font-size: 24px;
          font-weight: 900;
          color: #ffffff;
          text-align: center;
          margin: 0 0 8px;
        }
        .xpp-vs-subtitle {
          font-size: 14px;
          color: #ffffff;
          text-align: center;
          margin: 0 0 24px;
        }
        .xpp-vs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        .xpp-vs-card {
          border-radius: 14px;
          padding: 26px;
        }
        .xpp-vs-card--them {
          background: #141414;
          border: 1.5px solid #333333;
        }
        .xpp-vs-card--us {
          background: linear-gradient(180deg, #1a1710 0%, #121212 100%);
          border: 2px solid #D4AF37;
        }
        .xpp-vs-card-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 800;
          margin-bottom: 16px;
        }
        .xpp-vs-card-label--them {
          color: #ff5252;
        }
        .xpp-vs-card-label--us {
          color: #FFD700;
        }
        .xpp-vs-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          font-size: 14px;
        }
        .xpp-vs-row:last-child {
          border-bottom: none;
        }
        .xpp-vs-row-label {
          color: #ffffff;
          font-weight: 500;
        }

        /* ── Cost Breakdown Table ── */
        .xpp-compare-card {
          background: #141414;
          border: 1.5px solid #2d2d2d;
          border-radius: 16px;
          padding: 30px;
          margin-bottom: 34px;
        }
        .xpp-compare-title {
          font-size: 20px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 8px;
        }
        .xpp-compare-desc {
          font-size: 14px;
          color: #ffffff;
          margin: 0 0 24px;
          line-height: 1.6;
        }
        .xpp-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .xpp-table th, .xpp-table td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid #282828;
        }
        .xpp-table th {
          color: #FFD700;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.8px;
        }
        .xpp-table td {
          color: #ffffff;
        }
        .xpp-table tr:last-child td {
          border-bottom: none;
          font-weight: 900;
          font-size: 15px;
          padding-top: 20px;
          color: #ffffff;
        }

        /* ── FAQ Section ── */
        .xpp-faq-section {
          margin-bottom: 34px;
        }
        .xpp-faq-title {
          font-size: 22px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 22px;
          text-align: center;
        }
        .xpp-faq-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .xpp-faq-item {
          background: #141414;
          border: 1.5px solid #2d2d2d;
          border-radius: 12px;
          padding: 20px 22px;
        }
        .xpp-faq-q {
          font-size: 14.5px;
          font-weight: 800;
          color: #FFD700;
          margin: 0 0 8px;
        }
        .xpp-faq-a {
          font-size: 13.5px;
          color: #ffffff;
          margin: 0;
          line-height: 1.65;
        }

        /* ── Final CTA ── */
        .xpp-final-cta {
          background: linear-gradient(135deg, #141414 0%, #1e1910 100%);
          border: 2px solid rgba(212, 175, 55, 0.4);
          border-radius: 16px;
          padding: 44px 38px;
          text-align: center;
        }
        .xpp-final-cta h2 {
          font-size: 28px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 12px;
        }
        .xpp-final-cta p {
          font-size: 15px;
          color: #ffffff;
          margin: 0 0 26px;
          max-width: 620px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.65;
        }
        .xpp-final-cta-btns {
          display: flex;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .xpp-final-cta-btns .xpp-btn {
          width: auto;
          min-width: 220px;
        }

        @media (max-width: 720px) {
          .xpp-proof-bar {
            grid-template-columns: 1fr;
          }
          .xpp-vs-grid {
            grid-template-columns: 1fr;
          }
          .xpp-faq-grid {
            grid-template-columns: 1fr;
          }
          .xpp-plans-grid {
            grid-template-columns: 1fr;
          }
          .xpp-hero-title {
            font-size: 26px;
          }
        }
      `}</style>

      <div className="xpp-container">
        {actionData?.error && (
          <div className="xpp-status-banner" style={{ borderLeftColor: "#ff4d4d", borderColor: "#ff4d4d" }}>
            <div>
              <div className="xpp-status-title" style={{ color: "#ff4d4d" }}>Billing Notice</div>
              <p className="xpp-status-desc">{actionData.error}</p>
            </div>
          </div>
        )}

        {actionData?.message && (
          <div className="xpp-status-banner" style={{ borderLeftColor: "#4ade80", borderColor: "#4ade80" }}>
            <div>
              <div className="xpp-status-title" style={{ color: "#4ade80" }}>Status Updated</div>
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
                ? `Currently on ${activePlanName || (isLifetime ? LIFETIME_PLAN : MONTHLY_PLAN)}${isLifetime ? " (Lifetime Pass -- No recurring charges ever)" : ""}${!isLifetime && trialDaysRemaining !== null && trialDaysRemaining > 0 ? ` with ${trialDaysRemaining} days remaining in trial` : ""}`
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
                style={{ padding: "8px 16px", fontSize: "12px", color: "#ff5252", borderColor: "#ff5252" }}
                disabled={isSubmitting}
              >
                Cancel Subscription
              </button>
            </Form>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────────
            HERO SECTION
            ──────────────────────────────────────────────────────────────── */}
        <div className="xpp-hero">
          <span className="xpp-hero-badge">The Conversion Engine Built for Scale</span>
          <h1 className="xpp-hero-title">
            One App to Replace Them All.<br />
            <em>Unlimited Impressions. Zero Quotas. Ever.</em>
          </h1>
          <p className="xpp-hero-subtitle">
            Other apps charge you more as you grow. XPoost gives you <span className="xpp-hl-gold">6 revenue-driving engines</span> with <span className="xpp-badge-green">zero impression caps</span>, <span className="xpp-badge-green">no order limits</span>, and <span className="xpp-badge-green">no hidden fees</span>. Your growth should never come with a penalty.
          </p>
        </div>

        {/* ────────────────────────────────────────────────────────────────
            SOCIAL PROOF STATS
            ──────────────────────────────────────────────────────────────── */}
        <div className="xpp-proof-bar">
          <div className="xpp-proof-stat">
            <div className="xpp-proof-num">1.8x</div>
            <div className="xpp-proof-label">Average <span className="xpp-hl-gold">Revenue Lift</span><br />for Active Stores</div>
          </div>
          <div className="xpp-proof-stat">
            <div className="xpp-proof-num" style={{ fontSize: "28px" }}>UNLIMITED</div>
            <div className="xpp-proof-label">Impressions, Orders &<br /><span className="xpp-badge-green">Zero Quotas</span> Guaranteed</div>
          </div>
          <div className="xpp-proof-stat">
            <div className="xpp-proof-num">6-in-1</div>
            <div className="xpp-proof-label">Conversion Tools<br /><span className="xpp-hl-gold">Replaces 5+ Separate Apps</span></div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────
            UNLIMITED IMPRESSIONS CALLOUT
            ──────────────────────────────────────────────────────────────── */}
        <div className="xpp-unlimited-banner">
          <div className="xpp-unlimited-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/>
            </svg>
          </div>
          <div className="xpp-unlimited-content">
            <h3>Truly Unlimited. Not "Up To 1,000 Views."</h3>
            <p>
              Competitor apps gate their features behind aggressive quotas:{" "}
              <span className="xpp-badge-red">500 views for $10</span>,{" "}
              <span className="xpp-badge-red">5,000 views for $30</span>,{" "}
              <span className="xpp-badge-red">"unlimited" for $100+/mo</span>.{" "}
              XPoost gives you <span className="xpp-hl-gold">no quotas</span>,{" "}
              <span className="xpp-hl-gold">no throttling</span>, and{" "}
              <span className="xpp-hl-gold">no impression meters</span>. Every plan is{" "}
              <span className="xpp-badge-green">100% unlimited from Day 1</span> -- whether you get 100 visitors or 100,000.
            </p>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────
            PLANS GRID
            ──────────────────────────────────────────────────────────────── */}
        <div className="xpp-plans-grid">
          {/* Plan 1: Monthly Suite */}
          <div className="xpp-plan-card">
            <h2 className="xpp-plan-name">Monthly Conversion Suite</h2>
            <p className="xpp-plan-desc">
              The full 6-in-1 engine. <span className="xpp-hl-gold">No feature locks</span>. <span className="xpp-hl-gold">No usage caps</span>. Start free for 7 days.
            </p>
            <div className="xpp-plan-price-box">
              <span className="xpp-plan-price">$15</span>
              <span className="xpp-plan-period">/ month</span>
              <div className="xpp-plan-note">
                First 7 Days <span className="xpp-badge-green">100% Free</span> -- Cancel in <span className="xpp-hl-gold">1 Click</span>
              </div>
            </div>
            <div className="xpp-plan-divider-label">Everything Included:</div>
            <ul className="xpp-features-list">
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-badge-green">Unlimited Impressions</span> -- no caps, no tiers, no throttling</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-badge-green">Unlimited Products & Orders</span> -- scale without penalties</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Pre-Purchase</strong> One-Click Upsell Modal</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>In-Cart Drawer</strong> Smart Recommendations</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Tiered Free Shipping</strong> & Milestone Progress Bar</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Social Proof & Scarcity</strong> Urgency Corner Toasts</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Exit-Intent Countdown</strong> Cart Recovery Modal</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Customer Support</strong> & VIP WhatsApp Floating Bar</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Native Shopify Functions</strong> Automatic Discounts</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Full Color & Style Customizer</strong> per Feature</span>
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
            <span className="xpp-btn-sub"><span className="xpp-hl-gold">Zero charge</span> until trial ends -- 1-click cancellation</span>
          </div>

          {/* Plan 2: Founder's Lifetime Pass */}
          <div className="xpp-plan-card xpp-plan-card--featured">
            <span className="xpp-plan-tag">Best Value -- Limited Offer</span>
            <h2 className="xpp-plan-name">Founder's Lifetime Pass</h2>
            <p className="xpp-plan-desc">
              Pay once. <span className="xpp-hl-gold">Own XPoost forever</span>. Every future feature and update included at no extra cost.
            </p>
            <div className="xpp-plan-price-box">
              <span className="xpp-plan-price">$249</span>
              <span className="xpp-plan-period">one-time investment</span>
              <div className="xpp-plan-note">
                <span className="xpp-badge-gold">Pays for itself</span> after just <span className="xpp-hl-gold">1 extra order</span> per month
              </div>
            </div>
            <div className="xpp-plan-divider-label">Everything in Monthly, Plus:</div>
            <ul className="xpp-features-list">
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-badge-gold">Lifetime Access</span> -- <span className="xpp-hl-gold">Zero Recurring Charges Forever</span></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-hl-gold">All Future Updates & New Features</span> Included for Life</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><span className="xpp-badge-green">Saves $720+</span> in subscription fees over 4 years</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Never worry</strong> about another monthly bill or price increase</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-badge-green">Unlimited</span> impressions, products, orders & revenue</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong>Priority VIP Developer Support</strong> directly from the team</span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span>Hosted on Shopify Global CDN -- <span className="xpp-hl-gold">zero speed penalty</span></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span>Founder pricing locked -- <span className="xpp-hl-gold">rate will increase soon</span></span>
              </li>
            </ul>

            <Form method="post">
              <input type="hidden" name="plan" value={LIFETIME_PLAN} />
              <button
                type="submit"
                className={`xpp-btn ${isLifetime ? "xpp-btn--disabled" : "xpp-btn--primary"}`}
                disabled={Boolean(isLifetime) || isSubmitting}
              >
                {isLifetime ? "Lifetime Access Active" : "Claim Lifetime Access Now"}
              </button>
            </Form>
            <span className="xpp-btn-sub">One payment. <span className="xpp-hl-gold">Yours forever</span>. No recurring charges.</span>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────
            COMPETITORS vs XPOOST
            ──────────────────────────────────────────────────────────────── */}
        <div className="xpp-vs-section">
          <h2 className="xpp-vs-title">Why Merchants Switch to XPoost</h2>
          <p className="xpp-vs-subtitle">
            The real cost of competitor apps is not on the pricing page. It is on the invoice after you scale.
          </p>
          <div className="xpp-vs-grid">
            <div className="xpp-vs-card xpp-vs-card--them">
              <div className="xpp-vs-card-label xpp-vs-card-label--them">TYPICAL UPSELL APPS</div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Free Plan Impressions</span>
                <span className="xpp-badge-red">100 - 500 views</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Mid-Tier Plan</span>
                <span className="xpp-badge-red">$30/mo for 5,000 views</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">"Unlimited" Plan</span>
                <span className="xpp-badge-red">$100 - $200/mo</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Features Included</span>
                <span className="xpp-badge-red">1 - 2 tools only</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Apps Needed for Full Stack</span>
                <span className="xpp-badge-red">4 - 6 separate apps</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Store Speed Impact</span>
                <span className="xpp-badge-red">Heavy (slows site)</span>
              </div>
            </div>
            <div className="xpp-vs-card xpp-vs-card--us">
              <div className="xpp-vs-card-label xpp-vs-card-label--us">XPOOST</div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Impressions on All Plans</span>
                <span className="xpp-badge-green">UNLIMITED</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Monthly Plan</span>
                <span className="xpp-badge-green">$15/mo -- everything included</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Lifetime Option</span>
                <span className="xpp-badge-gold">$249 once -- own it forever</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Features Included</span>
                <span className="xpp-badge-green">All 6 tools</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Apps Needed</span>
                <span className="xpp-badge-green">Just 1 single app</span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label">Store Speed Impact</span>
                <span className="xpp-badge-green">Ultra-light (&lt;15KB script)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────
            COST BREAKDOWN TABLE
            ──────────────────────────────────────────────────────────────── */}
        <div className="xpp-compare-card">
          <h3 className="xpp-compare-title">The Real Cost of App Bloat</h3>
          <p className="xpp-compare-desc">
            Most merchants install 5 to 6 separate apps that conflict with each other, slow down their store,
            and charge escalating fees as traffic grows. This is exactly what that looks like:
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
                <td>Pre-Purchase & In-Cart Upsells</td>
                <td><span className="xpp-badge-red">~$30/mo</span> (with impression caps)</td>
                <td><span className="xpp-badge-green">Included -- Unlimited</span></td>
              </tr>
              <tr>
                <td>Urgency & Scarcity Proof Notifications</td>
                <td><span className="xpp-badge-red">~$15/mo</span> (capped at 1,000 views)</td>
                <td><span className="xpp-badge-green">Included -- Unlimited</span></td>
              </tr>
              <tr>
                <td>Tiered Free Shipping Goal Bar</td>
                <td><span className="xpp-badge-red">~$10/mo</span></td>
                <td><span className="xpp-badge-green">Included -- Unlimited</span></td>
              </tr>
              <tr>
                <td>WhatsApp & Social Support Widget</td>
                <td><span className="xpp-badge-red">~$10/mo</span></td>
                <td><span className="xpp-badge-green">Included -- Unlimited</span></td>
              </tr>
              <tr>
                <td>Exit-Intent Cart Saver Popup</td>
                <td><span className="xpp-badge-red">~$15/mo</span> (often capped)</td>
                <td><span className="xpp-badge-green">Included -- Unlimited</span></td>
              </tr>
              <tr>
                <td>Total Annual Cost</td>
                <td><span className="xpp-badge-red">$960+ / year</span> (and rising with traffic)</td>
                <td><span className="xpp-badge-green">$180/yr</span> or <span className="xpp-badge-gold">$249 lifetime</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ────────────────────────────────────────────────────────────────
            FAQ
            ──────────────────────────────────────────────────────────────── */}
        <div className="xpp-faq-section">
          <h2 className="xpp-faq-title">Common Questions</h2>
          <div className="xpp-faq-grid">
            <div className="xpp-faq-item">
              <div className="xpp-faq-q">What does "unlimited impressions" really mean?</div>
              <p className="xpp-faq-a">
                It means exactly what it says. There is <span className="xpp-hl-gold">no impression counter</span>, <span className="xpp-hl-gold">no view quota</span>, and <span className="xpp-hl-gold">no throttling</span>.
                Whether your store gets 50 visitors a day or 50,000, every upsell modal, every scarcity toast,
                and every shipping bar fires on every visit. <span className="xpp-badge-green">No exceptions</span>.
              </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q">Will XPoost slow down my store?</div>
              <p className="xpp-faq-a">
                No. XPoost loads a single ultra-lightweight script hosted on Shopify's global CDN.
                It adds <span className="xpp-hl-gold">less than 15KB</span> to your page weight -- lighter than a single product thumbnail.
                Replacing 5 separate apps with XPoost will actually <span className="xpp-badge-green">make your store faster</span>.
              </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q">What happens after my 7-day trial?</div>
              <p className="xpp-faq-a">
                If you love it, you continue at $15/month or upgrade to lifetime. If not, cancel
                with <span className="xpp-hl-gold">1 click</span> before the trial ends and you pay <span className="xpp-badge-green">$0.00</span>. No hoops, no support emails required.
              </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q">Does the Lifetime Pass include future features?</div>
              <p className="xpp-faq-a">
                Yes. <span className="xpp-hl-gold">Every new feature and update</span> we ship is automatically included
                in your Lifetime Pass at <span className="xpp-badge-gold">no additional cost</span>. You are locked in at today's price forever.
              </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q">Can I use XPoost with my existing theme?</div>
              <p className="xpp-faq-a">
                Absolutely. XPoost works with <span className="xpp-hl-gold">every Shopify theme</span> (Dawn, Debut, Prestige, custom themes, and everything in between). <span className="xpp-badge-green">Zero code changes</span> required.
              </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q">Why is XPoost so much cheaper than alternatives?</div>
              <p className="xpp-faq-a">
                Because we built <span className="xpp-hl-gold">one unified modern codebase</span> instead of 6 separate bloated apps.
                Lower infrastructure overhead means we pass the savings directly to you.
              </p>
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────
            FINAL CTA
            ──────────────────────────────────────────────────────────────── */}
        <div className="xpp-final-cta">
          <h2>Stop Paying Per Impression. Start Growing.</h2>
          <p>
            Every day without XPoost is revenue left on the table. <span className="xpp-hl-gold">Replace your app stack</span>, <span className="xpp-badge-green">eliminate impression quotas</span>, and keep more of what you earn.
          </p>
          <div className="xpp-final-cta-btns">
            {!hasActivePayment && (
              <Form method="post">
                <input type="hidden" name="plan" value={MONTHLY_PLAN} />
                <button
                  type="submit"
                  className="xpp-btn xpp-btn--secondary"
                  disabled={isSubmitting}
                >
                  Start Free 7-Day Trial
                </button>
              </Form>
            )}
            {!isLifetime && (
              <Form method="post">
                <input type="hidden" name="plan" value={LIFETIME_PLAN} />
                <button
                  type="submit"
                  className="xpp-btn xpp-btn--primary"
                  disabled={isSubmitting}
                >
                  Claim Lifetime Access -- $249
                </button>
              </Form>
            )}
          </div>
        </div>

      </div>
    </s-page>
  );
}
