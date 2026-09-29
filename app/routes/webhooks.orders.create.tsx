import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { saveOrder } from "../analytics.server";
import { normalizeWebhookOrder } from "../utils/analytics";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop: shopDomain, payload } = await authenticate.webhook(request);

  try {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { id: true, analyticsTimezone: true },
    });
    if (shop) {
      await saveOrder(shop, normalizeWebhookOrder(payload), "webhook");
    }
  } catch (err) {
    // Log and acknowledge: a retry storm won't fix a parsing problem
    console.error(`[XPoost analytics] orders/create failed for ${shopDomain}:`, err);
  }

  return new Response();
};
