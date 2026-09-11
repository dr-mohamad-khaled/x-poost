import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  console.log(`[XPoost GDPR] Received ${topic} for ${shop}:`, payload);

  // XPoost does not store personal customer records or PII in SQLite.
  // We only store shop configuration settings and aggregate product IDs.
  return new Response(JSON.stringify({ message: "No customer PII stored by XPoost." }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
