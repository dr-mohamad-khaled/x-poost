// Product Recommendations — server side: storefront payload and product ratings.

import prisma from "./db.server";
import { collectionProducts } from "./bundles.server";
import { numericId } from "./utils/bundles";
import { parseRecs, resolveRcTexts, type ParsedRecs } from "./utils/recs";

type Admin = { graphql: Function };

export async function loadRecs(shopId: string): Promise<ParsedRecs> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { recsEnabled: true, recsJson: true } });
  return parseRecs(shop?.recsJson, !!shop?.recsEnabled);
}

/** What the storefront block needs. Shopify recommendations are fetched in the browser. */
export async function storefrontRecs(admin: Admin | undefined, shop: string, r: ParsedRecs, lang: string) {
  const c = r.config;
  let handles: string[] = c.products.map((p) => p.handle);
  if (c.source === "collection" && c.collection) handles = (await collectionProducts(admin, shop, c.collection.id, 40)).map((p) => p.handle);
  return {
    source: c.source,
    handles: handles.slice(0, 40),
    count: c.count,
    shuffle: c.shuffle,
    hideInCart: c.hideInCart,
    hideSoldOut: c.hideSoldOut,
    showRating: c.showRating,
    showCompare: c.showCompare,
    showVariants: c.showVariants,
    showQty: c.showQty,
    design: c.design,
    offer: c.offer,
    afterAdd: c.afterAdd,
    device: c.placement.device,
    placement: {
      mode: c.placement.mode,
      products: c.placement.products.map((p) => numericId(p.id)),
      collections: c.placement.collections.map((x) => numericId(x.id)),
    },
    style: r.style,
    texts: resolveRcTexts(r.texts, lang),
  };
}

// ─────────────────────────────────────────────────────────────
// Ratings (standard reviews.rating metafields, written by most review apps)
// ─────────────────────────────────────────────────────────────

const ratingCache = new Map<string, { at: number; v: { r: number; n: number } | null }>();
const RATING_TTL = 30 * 60_000;

function readRating(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const j = JSON.parse(raw);
    const v = Number(j?.value);
    const max = Number(j?.scale_max) || 5;
    return Number.isFinite(v) && v > 0 ? Math.round((v / max) * 5 * 10) / 10 : 0;
  } catch {
    const v = Number(raw);
    return Number.isFinite(v) ? v : 0;
  }
}

export async function productRatings(admin: Admin | undefined, shop: string, ids: string[]) {
  const out: Record<string, { r: number; n: number }> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const hit = ratingCache.get(`${shop}:${id}`);
    if (hit && Date.now() - hit.at < RATING_TTL) {
      if (hit.v) out[id] = hit.v;
    } else missing.push(id);
  }
  if (missing.length && admin) {
    try {
      const res = await admin.graphql(
        `#graphql
        query XpRecRatings($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              rating: metafield(namespace: "reviews", key: "rating") { value }
              count: metafield(namespace: "reviews", key: "rating_count") { value }
            }
          }
        }`,
        { variables: { ids: missing.map((id) => `gid://shopify/Product/${id}`) } },
      );
      const j: any = await res.json();
      const seen = new Set<string>();
      for (const n of j?.data?.nodes || []) {
        if (!n?.id) continue;
        const id = numericId(n.id);
        seen.add(id);
        const r = readRating(n.rating?.value);
        const v = r > 0 ? { r, n: Math.max(0, Math.round(Number(n.count?.value) || 0)) } : null;
        ratingCache.set(`${shop}:${id}`, { at: Date.now(), v });
        if (v) out[id] = v;
      }
      for (const id of missing) if (!seen.has(id)) ratingCache.set(`${shop}:${id}`, { at: Date.now(), v: null });
      while (ratingCache.size > 20000) ratingCache.delete(ratingCache.keys().next().value as string);
    } catch (err) {
      console.warn("[xpoost-recs] ratings lookup failed:", err);
    }
  }
  return out;
}
