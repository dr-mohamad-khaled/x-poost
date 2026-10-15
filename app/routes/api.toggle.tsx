import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { syncAllDiscounts } from "../bundles.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.admin(request);
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
      bundles: "bundlesEnabled",
      recommendations: "recsEnabled",
      kits: "kitsEnabled",
    };

    const field = featureFieldMap[featureKey];
    if (!field) {
      return Response.json({ ok: false, error: "Unknown feature" });
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: { [field]: enable },
    });
    if (["bundles", "kits", "recommendations"].includes(featureKey)) await syncAllDiscounts(admin, shop.id);

    return Response.json({ ok: true, featureKey, enable });
  } catch (err: any) {
    console.error("[ACTION_ERROR api.toggle]", err?.stack || err?.message || err);
    if (err instanceof Response) throw err;
    return Response.json({ ok: false, error: "Failed to update feature" });
  }
};
