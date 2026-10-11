import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  // Do not log the payload: it contains customer personal data.
  console.log(`[XPoost GDPR] Received ${topic} for ${shop}`);

  // XPoost does not store customer records. Nothing to redact.
  return new Response(JSON.stringify({ message: "Customer data redact acknowledged." }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
