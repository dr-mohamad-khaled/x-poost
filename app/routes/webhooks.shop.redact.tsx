import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[XPoost GDPR] Received ${topic} for ${shop}`);

  try {
    const existingShop = await prisma.shop.findUnique({
      where: { shopDomain: shop },
    });

    if (existingShop) {
      await prisma.shop.delete({
        where: { id: existingShop.id },
      });
      console.log(`[XPoost GDPR] Deleted store configs for ${shop}`);
    }
  } catch (err) {
    console.error(`[XPoost GDPR] Error deleting store data for ${shop}:`, err);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
