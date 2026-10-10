import { Translate } from "../components/Translate";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect } from "react";
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

  // The billing action returns Shopify's approval URL; open it at the top level
  // (a plain redirect can't leave the embedded iframe).
  const confirmationUrl =
    actionData && "confirmationUrl" in actionData ? (actionData as { confirmationUrl?: string }).confirmationUrl : undefined;
  useEffect(() => {
    if (!confirmationUrl) return;
    try {
      window.open(confirmationUrl, "_top");
    } catch {
      window.location.href = confirmationUrl;
    }
  }, [confirmationUrl]);

  return (
    <s-page heading="Plans & Pricing">
      <style>{`
        /* â”€â”€ Reset & Base â”€â”€ */
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

        /* â”€â”€ Highlight Badges & Accents â”€â”€ */
        .xpp-hl-gold {
          color: #FFB000 !important;
          font-weight: 800;
        }
        .xpp-hl-green {
          color: #4ade80 !important;
          font-weight: 800;
        }
        .xpp-badge-gold {
          display: inline-block;
          background: rgba(255, 215, 0, 0.16);
          border: 1px solid #FFB000;
          color: #FFB000 !important;
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

        /* â”€â”€ Hero â”€â”€ */
        .xpp-hero {
          background: #111111;
          border: 1.5px solid rgba(255,176,0, 0.4);
          border-radius: 16px;
          padding: 48px 36px 44px;
          margin-bottom: 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .xpp-hero-badge {
          display: inline-block;
          background: rgba(255,176,0, 0.2);
          color: #FFB000;
          border: 1px solid #FFB000;
          padding: 6px 18px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
          
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
          color: #FFB000;
        }
        .xpp-hero-subtitle {
          font-size: 16px;
          color: #ffffff;
          max-width: 760px;
          margin: 0 auto;
          line-height: 1.7;
          font-weight: 400;
        }

        /* â”€â”€ Stat Proof Bar â”€â”€ */
        .xpp-proof-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .xpp-proof-stat {
          background: #0F0E0C;
          border: 1.5px solid #2a2a2a;
          border-radius: 12px;
          padding: 24px 18px;
          text-align: center;
        }
        .xpp-proof-num {
          font-size: 32px;
          font-weight: 900;
          color: #FFB000;
          line-height: 1;
          margin-bottom: 8px;
        }
        .xpp-proof-label {
          font-size: 13px;
          color: #ffffff;
          line-height: 1.5;
          font-weight: 600;
        }

        /* â”€â”€ Unlimited Banner â”€â”€ */
        .xpp-unlimited-banner {
          background: #0f0e0c;
          border: 2px solid #FFB000;
          border-radius: 14px;
          padding: 26px 30px;
          margin-bottom: 26px;
          display: flex;
          align-items: center;
          gap: 22px;
        }
        .xpp-unlimited-icon {
          flex-shrink: 0;
          width: 54px;
          height: 54px;
          background: rgba(255,176,0, 0.25);
          border: 1.5px solid #FFB000;
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

        /* â”€â”€ Status Banner â”€â”€ */
        .xpp-status-banner {
          background: #0F0E0C;
          border-left: 5px solid #FFB000;
          border: 1px solid #2a2a2a;
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

        /* â”€â”€ Plans Grid â”€â”€ */
        .xpp-plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 24px;
          margin-bottom: 34px;
        }
        .xpp-plan-card {
          background: #121212;
          border: 1.5px solid #353535;
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
          border: 2.5px solid #FFB000;
          background: #171717;
        }
        .xpp-plan-tag {
          position: absolute;
          top: -14px;
          right: 24px;
          background: #FFB000;
          color: #000000;
          font-size: 12px;
          font-weight: 900;
          padding: 6px 16px;
          border-radius: 14px;
          
          letter-spacing: 0.6px;
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
          border-bottom: 1.5px solid #2A2A2A;
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
          
          letter-spacing: 1.5px;
          color: #FFB000;
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
          color: #FFB000;
          font-weight: 900;
          font-size: 16px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .xpp-infinity-icon {
          color: #FFB000;
          font-size: 19px;
          font-weight: 900;
          flex-shrink: 0;
          margin-top: -1px;
        }

        /* â”€â”€ CTAs â”€â”€ */
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
          background: #FFB000;
          color: #000000;
        }
        .xpp-btn--primary:hover {
          background: #FFB000;
          transform: translateY(-1px);
        }
        .xpp-btn--secondary {
          background: #171614;
          color: #ffffff;
          border: 1.5px solid #444444;
        }
        .xpp-btn--secondary:hover {
          background: #262626;
          border-color: #666666;
        }
        .xpp-btn--disabled {
          background: #171614;
          color: #ffffff;
          opacity: 0.55;
          cursor: not-allowed;
          border: 1px solid #353535;
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

        /* â”€â”€ Competitor vs XPoost Grid â”€â”€ */
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
          background: #0F0E0C;
          border: 1.5px solid #353535;
        }
        .xpp-vs-card--us {
          background: #171717;
          border: 2px solid #FFB000;
        }
        .xpp-vs-card-label {
          font-size: 12px;
          
          letter-spacing: 1px;
          font-weight: 800;
          margin-bottom: 16px;
        }
        .xpp-vs-card-label--them {
          color: #ff5252;
        }
        .xpp-vs-card-label--us {
          color: #FFB000;
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

        /* â”€â”€ Cost Breakdown Table â”€â”€ */
        .xpp-compare-card {
          background: #0F0E0C;
          border: 1.5px solid #2a2a2a;
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
          border-bottom: 1px solid #2A2A2A;
        }
        .xpp-table th {
          color: #FFB000;
          font-weight: 800;
          
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

        /* â”€â”€ FAQ Section â”€â”€ */
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
          background: #0F0E0C;
          border: 1.5px solid #2a2a2a;
          border-radius: 12px;
          padding: 20px 22px;
        }
        .xpp-faq-q {
          font-size: 14.5px;
          font-weight: 800;
          color: #FFB000;
          margin: 0 0 8px;
        }
        .xpp-faq-a {
          font-size: 13.5px;
          color: #ffffff;
          margin: 0;
          line-height: 1.65;
        }

        /* â”€â”€ Final CTA â”€â”€ */
        .xpp-final-cta {
          background: #0F0E0C;
          border: 2px solid rgba(255,176,0, 0.4);
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
              <div className="xpp-status-title" style={{ color: "#ff4d4d" }}><Translate text='Billing Notice' /></div>
              <p className="xpp-status-desc">{actionData.error}</p>
            </div>
          </div>
        )}

        {actionData?.message && (
          <div className="xpp-status-banner" style={{ borderLeftColor: "#4ade80", borderColor: "#4ade80" }}>
            <div>
              <div className="xpp-status-title" style={{ color: "#4ade80" }}><Translate text='Status Updated' /></div>
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
                
                                              <Translate text='Cancel Subscription' />
                                            </button>
            </Form>
          )}
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            HERO SECTION
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="xpp-hero">
          <span className="xpp-hero-badge"><Translate text='The Conversion Engine Built for Scale' /></span>
          <h1 className="xpp-hero-title">
            
                                  <Translate text='One App to Replace Them All.' /><br />
            <em><Translate text='Unlimited Impressions. Zero Quotas. Ever.' /></em>
          </h1>
          <p className="xpp-hero-subtitle">
            
                                  <Translate text='Other apps charge you more as you grow. XPoost gives you' /> <span className="xpp-hl-gold"><Translate text='8 revenue-driving engines' /></span>  <Translate text='with' /> <span className="xpp-badge-green"><Translate text='zero impression caps' /></span>, <span className="xpp-badge-green"><Translate text='no order limits' /></span><Translate text=', and' /> <span className="xpp-badge-green"><Translate text='no hidden fees' /></span><Translate text='. Your growth should never come with a penalty.' />
                                </p>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            SOCIAL PROOF STATS
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="xpp-proof-bar">
          <div className="xpp-proof-stat">
            <div className="xpp-proof-num"><Translate text='1.8x' /></div>
            <div className="xpp-proof-label"><Translate text='Average' /> <span className="xpp-hl-gold"><Translate text='Revenue Lift' /></span><br /><Translate text='for Active Stores' /></div>
          </div>
          <div className="xpp-proof-stat">
            <div className="xpp-proof-num" style={{ fontSize: "28px" }}><Translate text='UNLIMITED' /></div>
            <div className="xpp-proof-label"><Translate text='Impressions, Orders &' /><br /><span className="xpp-badge-green"><Translate text='Zero Quotas' /></span>  <Translate text='Guaranteed' /></div>
          </div>
          <div className="xpp-proof-stat">
            <div className="xpp-proof-num"><Translate text='8-in-1' /></div>
            <div className="xpp-proof-label"><Translate text='Conversion Tools' /><br /><span className="xpp-hl-gold"><Translate text='Replaces 5+ Separate Apps' /></span></div>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            UNLIMITED IMPRESSIONS CALLOUT
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="xpp-unlimited-banner">
          <div className="xpp-unlimited-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFB000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/>
            </svg>
          </div>
          <div className="xpp-unlimited-content">
            <h3><Translate text='Truly Unlimited. Not "Up To 1,000 Views."' /></h3>
            <p>
              
                                        <Translate text='Competitor apps gate their features behind aggressive quotas:' />{" "}
              <span className="xpp-badge-red"><Translate text='500 views for $10' /></span>,{" "}
              <span className="xpp-badge-red"><Translate text='5,000 views for $30' /></span>,{" "}
              <span className="xpp-badge-red"><Translate text='"unlimited" for $100+/mo' /></span>.{" "}
              
                                        <Translate text='XPoost gives you' /> <span className="xpp-hl-gold"><Translate text='no quotas' /></span>,{" "}
              <span className="xpp-hl-gold"><Translate text='no throttling' /></span><Translate text=', and' />{" "}
              <span className="xpp-hl-gold"><Translate text='no impression meters' /></span><Translate text='. Every plan is' />{" "}
              <span className="xpp-badge-green"><Translate text='100% unlimited from Day 1' /></span>  <Translate text='-- whether you get 100 visitors or 100,000.' />
                                      </p>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            PLANS GRID
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="xpp-plans-grid">
          {/* Plan 1: Monthly Suite */}
          <div className="xpp-plan-card">
            <h2 className="xpp-plan-name"><Translate text='Monthly Conversion Suite' /></h2>
            <p className="xpp-plan-desc">
              
                                        <Translate text='The full 8-in-1 engine.' /> <span className="xpp-hl-gold"><Translate text='No feature locks' /></span>. <span className="xpp-hl-gold"><Translate text='No usage caps' /></span><Translate text='. Start free for 7 days.' />
                                      </p>
            <div className="xpp-plan-price-box">
              <span className="xpp-plan-price">$20</span>
              <span className="xpp-plan-period"><Translate text='/ month' /></span>
              <div className="xpp-plan-note">
                
                                              <Translate text='First 7 Days' /> <span className="xpp-badge-green"><Translate text='100% Free' /></span>  <Translate text='-- Cancel in' /> <span className="xpp-hl-gold"><Translate text='1 Click' /></span>
              </div>
            </div>
            <div className="xpp-plan-divider-label"><Translate text='Everything Included:' /></div>
            <ul className="xpp-features-list">
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-badge-green"><Translate text='Unlimited Impressions' /></span>  <Translate text='-- no caps, no tiers, no throttling' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-badge-green"><Translate text='Unlimited Products & Orders' /></span>  <Translate text='-- scale without penalties' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Pre-Purchase' /></strong>  <Translate text='One-Click Upsell Modal' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='In-Cart Drawer' /></strong>  <Translate text='Smart Recommendations' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Tiered Free Shipping' /></strong>  <Translate text='& Milestone Progress Bar' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Social Proof & Scarcity' /></strong>  <Translate text='Urgency Corner Toasts' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Exit-Intent Countdown' /></strong>  <Translate text='Cart Recovery Modal' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Customer Support' /></strong>  <Translate text='& VIP WhatsApp Floating Bar' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Native Shopify Functions' /></strong>  <Translate text='Automatic Discounts' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Full Color & Style Customizer' /></strong>  <Translate text='per Feature' /></span>
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
            <span className="xpp-btn-sub"><span className="xpp-hl-gold"><Translate text='Zero charge' /></span>  <Translate text='until trial ends -- 1-click cancellation' /></span>
          </div>

          {/* Plan 2: Founder's Lifetime Pass */}
          <div className="xpp-plan-card xpp-plan-card--featured">
            <span className="xpp-plan-tag"><Translate text='Best Value -- Limited Offer' /></span>
            <h2 className="xpp-plan-name"><Translate text='Founder&apos;s Lifetime Pass' /></h2>
            <p className="xpp-plan-desc">
              
                                        <Translate text='Pay once.' /> <span className="xpp-hl-gold"><Translate text='Own XPoost forever' /></span><Translate text='. Every future feature and update included at no extra cost.' />
                                      </p>
            <div className="xpp-plan-price-box">
              <span className="xpp-plan-price">$249</span>
              <span className="xpp-plan-period"><Translate text='one-time investment' /></span>
              <div className="xpp-plan-note">
                <span className="xpp-badge-gold"><Translate text='Pays for itself' /></span>  <Translate text='after just' /> <span className="xpp-hl-gold"><Translate text='1 extra order' /></span>  <Translate text='per month' />
                                            </div>
            </div>
            <div className="xpp-plan-divider-label"><Translate text='Everything in Monthly, Plus:' /></div>
            <ul className="xpp-features-list">
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-badge-gold"><Translate text='Lifetime Access' /></span> -- <span className="xpp-hl-gold"><Translate text='Zero Recurring Charges Forever' /></span></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-hl-gold"><Translate text='All Future Updates & New Features' /></span>  <Translate text='Included for Life' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><span className="xpp-badge-green"><Translate text='Saves $960+' /></span>  <Translate text='in subscription fees over 4 years' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Never worry' /></strong>  <Translate text='about another monthly bill or price increase' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-infinity-icon">&#8734;</span>
                <span><span className="xpp-badge-green"><Translate text='Unlimited' /></span>  <Translate text='impressions, products, orders & revenue' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><strong><Translate text='Priority VIP Developer Support' /></strong>  <Translate text='directly from the team' /></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><Translate text='Hosted on Shopify Global CDN --' /> <span className="xpp-hl-gold"><Translate text='zero speed penalty' /></span></span>
              </li>
              <li className="xpp-feature-item">
                <span className="xpp-check-icon">&#10003;</span>
                <span><Translate text='Founder pricing locked --' /> <span className="xpp-hl-gold"><Translate text='rate will increase soon' /></span></span>
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
            <span className="xpp-btn-sub"><Translate text='One payment.' /> <span className="xpp-hl-gold"><Translate text='Yours forever' /></span><Translate text='. No recurring charges.' /></span>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            COMPETITORS vs XPOOST
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="xpp-vs-section">
          <h2 className="xpp-vs-title"><Translate text='Why Merchants Switch to XPoost' /></h2>
          <p className="xpp-vs-subtitle">
            
                                  <Translate text='The real cost of competitor apps is not on the pricing page. It is on the invoice after you scale.' />
                                </p>
          <div className="xpp-vs-grid">
            <div className="xpp-vs-card xpp-vs-card--them">
              <div className="xpp-vs-card-label xpp-vs-card-label--them"><Translate text='TYPICAL UPSELL APPS' /></div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Free Plan Impressions' /></span>
                <span className="xpp-badge-red"><Translate text='100 - 500 views' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Mid-Tier Plan' /></span>
                <span className="xpp-badge-red"><Translate text='$30/mo for 5,000 views' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='"Unlimited" Plan' /></span>
                <span className="xpp-badge-red"><Translate text='$100 - $200/mo' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Features Included' /></span>
                <span className="xpp-badge-red"><Translate text='1 - 2 tools only' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Apps Needed for Full Stack' /></span>
                <span className="xpp-badge-red"><Translate text='6 - 8 separate apps' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Store Speed Impact' /></span>
                <span className="xpp-badge-red"><Translate text='Heavy (slows site)' /></span>
              </div>
            </div>
            <div className="xpp-vs-card xpp-vs-card--us">
              <div className="xpp-vs-card-label xpp-vs-card-label--us"><Translate text='XPOOST' /></div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Impressions on All Plans' /></span>
                <span className="xpp-badge-green"><Translate text='UNLIMITED' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Monthly Plan' /></span>
                <span className="xpp-badge-green"><Translate text='$20/mo -- everything included' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Lifetime Option' /></span>
                <span className="xpp-badge-gold"><Translate text='$249 once -- own it forever' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Features Included' /></span>
                <span className="xpp-badge-green"><Translate text='All 8 tools' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Apps Needed' /></span>
                <span className="xpp-badge-green"><Translate text='Just 1 single app' /></span>
              </div>
              <div className="xpp-vs-row">
                <span className="xpp-vs-row-label"><Translate text='Store Speed Impact' /></span>
                <span className="xpp-badge-green"><Translate text='Ultra-light (&lt;15KB script)' /></span>
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            COST BREAKDOWN TABLE
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="xpp-compare-card">
          <h3 className="xpp-compare-title"><Translate text='The Real Cost of App Bloat' /></h3>
          <p className="xpp-compare-desc">
            
                                  <Translate text='Most merchants install 6 to 8 separate apps that conflict with each other, slow down their store,
                                  and charge escalating fees as traffic grows. This is exactly what that looks like:' />
                                </p>
          <table className="xpp-table">
            <thead>
              <tr>
                <th><Translate text='Feature / App Needed' /></th>
                <th><Translate text='Typical Standalone Cost' /></th>
                <th><Translate text='With XPoost' /></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><Translate text='Pre-Purchase & In-Cart Upsells' /></td>
                <td><span className="xpp-badge-red"><Translate text='~$30/mo' /></span>  <Translate text='(with impression caps)' /></td>
                <td><span className="xpp-badge-green"><Translate text='Included -- Unlimited' /></span></td>
              </tr>
              <tr>
                <td><Translate text='Urgency & Scarcity Proof Notifications' /></td>
                <td><span className="xpp-badge-red"><Translate text='~$15/mo' /></span>  <Translate text='(capped at 1,000 views)' /></td>
                <td><span className="xpp-badge-green"><Translate text='Included -- Unlimited' /></span></td>
              </tr>
              <tr>
                <td><Translate text='Tiered Free Shipping Goal Bar' /></td>
                <td><span className="xpp-badge-red"><Translate text='~$10/mo' /></span></td>
                <td><span className="xpp-badge-green"><Translate text='Included -- Unlimited' /></span></td>
              </tr>
              <tr>
                <td><Translate text='WhatsApp & Social Support Widget' /></td>
                <td><span className="xpp-badge-red"><Translate text='~$10/mo' /></span></td>
                <td><span className="xpp-badge-green"><Translate text='Included -- Unlimited' /></span></td>
              </tr>
              <tr>
                <td><Translate text='Exit-Intent Cart Saver Popup' /></td>
                <td><span className="xpp-badge-red"><Translate text='~$15/mo' /></span>  <Translate text='(often capped)' /></td>
                <td><span className="xpp-badge-green"><Translate text='Included -- Unlimited' /></span></td>
              </tr>
              <tr>
                <td><Translate text='Total Annual Cost' /></td>
                <td><span className="xpp-badge-red"><Translate text='$960+ / year' /></span>  <Translate text='(and rising with traffic)' /></td>
                <td><span className="xpp-badge-green"><Translate text='$240/yr' /></span>  <Translate text='or' /> <span className="xpp-badge-gold"><Translate text='$249 lifetime' /></span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            FAQ
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="xpp-faq-section">
          <h2 className="xpp-faq-title"><Translate text='Common Questions' /></h2>
          <div className="xpp-faq-grid">
            <div className="xpp-faq-item">
              <div className="xpp-faq-q"><Translate text='What does "unlimited impressions" really mean?' /></div>
              <p className="xpp-faq-a">
                
                                              <Translate text='It means exactly what it says. There is' /> <span className="xpp-hl-gold"><Translate text='no impression counter' /></span>, <span className="xpp-hl-gold"><Translate text='no view quota' /></span><Translate text=', and' /> <span className="xpp-hl-gold"><Translate text='no throttling' /></span><Translate text='.
                                              Whether your store gets 50 visitors a day or 50,000, every upsell modal, every scarcity toast,
                                              and every shipping bar fires on every visit.' /> <span className="xpp-badge-green"><Translate text='No exceptions' /></span>.
              </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q"><Translate text='Will XPoost slow down my store?' /></div>
              <p className="xpp-faq-a">
                
                                              <Translate text='No. XPoost loads a single ultra-lightweight script hosted on Shopify&apos;s global CDN.
                                              It adds' /> <span className="xpp-hl-gold"><Translate text='less than 15KB' /></span>  <Translate text='to your page weight -- lighter than a single product thumbnail.
                                              Replacing 8 separate apps with XPoost will actually' /> <span className="xpp-badge-green"><Translate text='make your store faster' /></span>.
              </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q"><Translate text='What happens after my 7-day trial?' /></div>
              <p className="xpp-faq-a">
                
                                              <Translate text='If you love it, you continue at $20/month or upgrade to lifetime. If not, cancel
                                              with' /> <span className="xpp-hl-gold"><Translate text='1 click' /></span>  <Translate text='before the trial ends and you pay' /> <span className="xpp-badge-green">$0.00</span><Translate text='. No hoops, no support emails required.' />
                                            </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q"><Translate text='Does the Lifetime Pass include future features?' /></div>
              <p className="xpp-faq-a">
                
                                              <Translate text='Yes.' /> <span className="xpp-hl-gold"><Translate text='Every new feature and update' /></span>  <Translate text='we ship is automatically included
                                              in your Lifetime Pass at' /> <span className="xpp-badge-gold"><Translate text='no additional cost' /></span><Translate text='. You are locked in at today&apos;s price forever.' />
                                            </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q"><Translate text='Can I use XPoost with my existing theme?' /></div>
              <p className="xpp-faq-a">
                
                                              <Translate text='Absolutely. XPoost works with' /> <span className="xpp-hl-gold"><Translate text='every Shopify theme' /></span>  <Translate text='(Dawn, Debut, Prestige, custom themes, and everything in between).' /> <span className="xpp-badge-green"><Translate text='Zero code changes' /></span>  <Translate text='required.' />
                                            </p>
            </div>
            <div className="xpp-faq-item">
              <div className="xpp-faq-q"><Translate text='Why is XPoost so much cheaper than alternatives?' /></div>
              <p className="xpp-faq-a">
                
                                              <Translate text='Because we built' /> <span className="xpp-hl-gold"><Translate text='one unified modern codebase' /></span>  <Translate text='instead of 8 separate bloated apps.
                                              Lower infrastructure overhead means we pass the savings directly to you.' />
                                            </p>
            </div>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            FINAL CTA
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="xpp-final-cta">
          <h2><Translate text='Stop Paying Per Impression. Start Growing.' /></h2>
          <p>
            
                                  <Translate text='Every day without XPoost is revenue left on the table.' /> <span className="xpp-hl-gold"><Translate text='Replace your app stack' /></span>, <span className="xpp-badge-green"><Translate text='eliminate impression quotas' /></span><Translate text=', and keep more of what you earn.' />
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
                  
                                                    <Translate text='Start Free 7-Day Trial' />
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
                  
                                                    <Translate text='Claim Lifetime Access -- $249' />
                                                  </button>
              </Form>
            )}
          </div>
        </div>

      </div>
    </s-page>
  );
}

