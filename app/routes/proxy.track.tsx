import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { recordEvents } from "../analytics.server";
import { parseEventBatch } from "../utils/analytics";

/**
 * Storefront analytics ingest — reached through the app proxy at /apps/xpoost/track.
 * The storefront tracker (xpoost-track.js) posts small batches with navigator.sendBeacon.
 * Always answers 204 so tracking can never break the storefront.
 */

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
const MAX_BODY_BYTES = 16_000;

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Verifies Shopify's app-proxy signature; throws on a forged request.
    const { session } = await authenticate.public.appProxy(request);
    // The signed `shop` param is trustworthy once the signature checks out.
    const shopDomain = session?.shop || new URL(request.url).searchParams.get("shop");
    if (!shopDomain) return noContent();

    const text = await request.text();
    if (!text || text.length > MAX_BODY_BYTES) return noContent();

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return noContent();
    }

    const batch = parseEventBatch(raw as any);
    if (batch.increments.length === 0) return noContent();

    // Resolve the shop strictly by domain — never fall back to another store.
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { id: true, analyticsTimezone: true },
    });
    if (!shop) return noContent();

    await recordEvents(shop.id, shop.analyticsTimezone, batch);
  } catch (err) {
    if (err instanceof Response) return noContent();
    console.warn("[XPoost analytics] track ingest failed:", err);
  }
  return noContent();
};

export const loader = async (_args: LoaderFunctionArgs) => noContent();
