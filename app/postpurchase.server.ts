/**
 * Post-purchase (one-click, same order) offers.
 * The post-purchase page appears between payment and the thank-you page and can add items to the SAME order.
 * It is a Shopify beta: live stores must be approved, and it does not run with wallets / buy-now-pay-later.
 */
import crypto from "node:crypto";
import prisma from "./db.server";
import { appCredentials, unauthenticated } from "./shopify.server";
import { fetchLiveProducts, getShopInfo, gql, parseOffer, type ParsedOffer } from "./thankyou.server";
import { buildPayload } from "./utils/thankyou-payload";
import {
  conditionNeedsCatalog,
  evaluateConditions,
  gidTail,
  pickLang,
  type TyContext,
  type TyProduct,
  type TyRenderPayload,
} from "./utils/thankyou";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** HS256 JWT, the format Shopify expects for post-purchase changesets. */
export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export type PostPurchaseInput = {
  shopDomain: string;
  referenceId: string;
  locale?: string;
  /** From inputData.initialPurchase */
  subtotal: number;
  currency: string;
  itemCount: number;
  productIds: string[]; // numeric or GID
  variantIds: string[];
  country?: string;
  discountCodes?: string[];
};

const toProductGid = (id: string) => (id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`);
const toVariantGid = (id: string) => (id.startsWith("gid://") ? id : `gid://shopify/ProductVariant/${id}`);

async function catalogContext(admin: any, productIds: string[]) {
  const tags = new Set<string>();
  const cols = new Set<string>();
  if (!productIds.length) return { tags: [] as string[], collectionIds: [] as string[] };
  const d = await gql(
    admin,
    `#graphql
    query XpPpCatalog($ids: [ID!]!) {
      nodes(ids: $ids) { ... on Product { id tags collections(first: 10) { nodes { id } } } }
    }`,
    { ids: productIds.slice(0, 40) },
  );
  for (const n of d?.nodes || []) {
    for (const t of n?.tags || []) tags.add(String(t));
    for (const c of n?.collections?.nodes || []) cols.add(String(c.id));
  }
  return { tags: [...tags], collectionIds: [...cols] };
}

/** Picks the first matching add-on / ship-together offer and returns what the post-purchase page needs. */
export async function selectPostPurchaseOffer(input: PostPurchaseInput): Promise<{ payload: TyRenderPayload; offer: ParsedOffer; products: TyProduct[] } | null> {
  const shop = await prisma.shop.findUnique({ where: { shopDomain: input.shopDomain }, select: { id: true, thankYouEnabled: true } });
  if (!shop || !shop.thankYouEnabled) return null;
  const rows = await prisma.tyOffer.findMany({
    where: { shopId: shop.id, enabled: true, kind: { in: ["addon", "shiptogether"] } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  if (!rows.length) return null;
  const offers = rows.map(parseOffer);

  const { admin } = await unauthenticated.admin(input.shopDomain);
  const info = await getShopInfo(admin, input.shopDomain);
  const productGids = input.productIds.map(toProductGid);
  const cat = offers.some((o) => conditionNeedsCatalog(o.conditions)) ? await catalogContext(admin, productGids) : { tags: [], collectionIds: [] };

  const ctx: TyContext = {
    subtotal: input.subtotal,
    currency: input.currency,
    country: String(input.country || "").toUpperCase(),
    itemCount: input.itemCount,
    isFirstOrder: null,
    discountCodes: input.discountCodes || [],
    productIds: productGids,
    tags: cat.tags,
    collectionIds: cat.collectionIds,
  };

  const bought = new Set(input.variantIds.map(toVariantGid));
  for (const offer of offers) {
    if (!evaluateConditions(offer.conditions, ctx)) continue;
    const live = await fetchLiveProducts(admin, offer.config.addon.products.filter((p) => !bought.has(p.variantId)));
    if (!live.length) continue;
    const expiresAt = new Date(Date.now() + offer.config.addon.windowMinutes * 60_000);
    const payload = buildPayload({
      offer,
      codes: [],
      expiresAt,
      lang: pickLang(input.locale),
      shop: { ...info, domain: input.shopDomain },
      products: live,
      showPrices: input.currency === info.currency,
    });
    return { payload, offer, products: live };
  }
  return null;
}

/** Changes for Shopify's applyChangeset. Percent benefit → discounted add_variant; free-shipping benefit → plain add (no shipping line is added, so shipping stays as paid). */
export function buildChanges(offer: ParsedOffer, picked: TyProduct[], discountTitle: string) {
  const a = offer.config.addon;
  return picked.map((p) => ({
    type: "add_variant",
    variantID: Number(gidTail(p.variantId)),
    quantity: 1,
    ...(a.benefit === "percent" ? { discount: { value: a.percent, valueType: "percentage", title: discountTitle.slice(0, 60) } } : {}),
  }));
}

export async function signPostPurchaseChangeset(opts: {
  shopDomain: string;
  referenceId: string;
  offerId: string;
  variantIds: string[];
  discountTitle: string;
}): Promise<string | null> {
  const shop = await prisma.shop.findUnique({ where: { shopDomain: opts.shopDomain }, select: { id: true } });
  if (!shop) return null;
  const row = await prisma.tyOffer.findFirst({ where: { id: opts.offerId, shopId: shop.id, enabled: true } });
  if (!row) return null;
  const offer = parseOffer(row);
  if (offer.kind === "reward") return null;
  const wanted = new Set(opts.variantIds.map(toVariantGid));
  const picked = offer.config.addon.products.filter((p) => wanted.has(p.variantId));
  if (!picked.length || !opts.referenceId) return null;
  const { admin } = await unauthenticated.admin(opts.shopDomain);
  const live = await fetchLiveProducts(admin, picked); // never sell something that went out of stock
  if (!live.length) return null;
  const changes = buildChanges(offer, live, opts.discountTitle);
  return signJwt(
    {
      iss: appCredentials.apiKey,
      jti: crypto.randomUUID(),
      iat: Date.now(), // Shopify's documented example uses milliseconds
      sub: opts.referenceId,
      changes,
    },
    appCredentials.apiSecretKey,
  );
}
