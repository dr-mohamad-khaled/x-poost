import { useLoaderData } from "@react-router/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    include: { checkoutUpsellFunnels: true },
  });

  return { funnels: shop?.checkoutUpsellFunnels || [], shopDomain: session.shop };
};

export default function PostPurchaseDashboard() {
  const { funnels } = useLoaderData<typeof loader>();

  return (
    <div className="xp-container">
      <div className="xp-header-row">
        <div>
          <h1 className="xp-title">Post-Purchase & Thank You Funnels</h1>
          <p className="xp-subtitle">One-click upsells and post-purchase offers to maximize AOV.</p>
        </div>
        <button className="xp-btn xp-btn--primary">Create Funnel</button>
      </div>

      <div className="xp-card">
        {funnels.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <h3 className="xp-card-title">Supercharge your checkout revenue</h3>
            <p className="xp-card-desc" style={{ maxWidth: "500px", margin: "16px auto" }}>
              Create highly converting post-purchase and thank-you page upsells. Offer discounts, trigger impulse buys, and increase retention.
            </p>
            <button className="xp-btn xp-btn--primary">Create your first funnel</button>
          </div>
        ) : (
          <div className="xp-grid">
            {funnels.map((funnel) => (
              <div key={funnel.id} className="xp-card">
                <div className="xp-card-header">
                  <h3 className="xp-card-title">{funnel.title}</h3>
                  <span className={`xp-pill ${funnel.status === "ACTIVE" ? "xp-pill--active" : "xp-pill--inactive"}`}>
                    {funnel.status}
                  </span>
                </div>
                <p className="xp-card-desc">
                  Target: {funnel.pageTarget === "POST_PURCHASE" ? "Post-Purchase One-Click Upsell" : "Thank You Page"}
                </p>
                <div className="xp-card-actions" style={{ marginTop: "16px" }}>
                  <button className="xp-btn">Edit Funnel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
