import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { popupOn } from "../utils/product-popup";
import { parseRecs } from "../utils/recs";
import { productRatings, storefrontRecs } from "../recs.server";

/**
 * Storefront Product Recommendations — reached through the app proxy at /apps/xpoost/recs.
 *   ?locale=…            → block settings for this store
 *   ?ratings=<id,id,…>   → star ratings from the standard reviews.rating metafields
 */

const json = (body: unknown, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" },
  });

const LANGS = ["en", "ar", "fr", "de", "es", "it", "pt"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const shopDomain = session?.shop || url.searchParams.get("shop");
    if (!shopDomain) return json({ rec: null });

    const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { recsEnabled: true, recsJson: true, productPopupJson: true } });
    if (!shop || !shop.recsEnabled) return json({ rec: null });

    const ratingIds = (url.searchParams.get("ratings") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{1,20}$/.test(s))
      .slice(0, 20);
    if (ratingIds.length) return json({ ratings: await productRatings(admin as any, shopDomain, ratingIds) }, 600);

    const rawLang = (url.searchParams.get("locale") || "en").split("-")[0].toLowerCase();
    const lang = LANGS.includes(rawLang) ? rawLang : "en";
    const rec = await storefrontRecs(admin as any, shopDomain, parseRecs(shop.recsJson, true), lang);
    return json({ rec, productPopup: popupOn(shop.productPopupJson, "recs") }, 60);
  } catch (err) {
    if (err instanceof Response) return json({ rec: null });
    console.warn("[xpoost-recs] proxy failed:", err);
    return json({ rec: null });
  }
};
