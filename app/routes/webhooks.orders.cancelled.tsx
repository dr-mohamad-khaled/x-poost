import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { markOrderCancelled } from "../analytics.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop: shopDomain, payload } = await authenticate.webhook(request);

  try {
    const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });
    const gid = (payload as any)?.admin_graphql_api_id || `gid://shopify/Order/${(payload as any)?.id}`;
    if (shop) await markOrderCancelled(shop.id, String(gid));
  } catch (err) {
    console.error(`[XPoost analytics] orders/cancelled failed for ${shopDomain}:`, err);
  }

  return new Response();
};
