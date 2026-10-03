/**
 * Thank-you page upsell — server side.
 * - picks the offer for an order (conditions, priority)
 * - creates unique, expiring, single-use discount codes (and gift cards when enabled)
 * - builds the payload the checkout extension renders
 *
 * Safety: the order is looked up through the Admin API before anything is created, and one claim is stored per order,
 * so a forged request cannot mint codes for orders that don't exist or mint a second set for the same order.
 */
import crypto from "node:crypto";
import prisma from "./db.server";
import { unauthenticated } from "./shopify.server";
import { recordEvents } from "./analytics.server";
import {
  buildPayload,
  buildSample,
  type IssuedCode,
} from "./utils/thankyou-payload";
import {
  type TyConfig,
  type TyConditions,
  type TyContext,
  type TyKind,
  type TyDesign,
  type TyLang,
  type TyProduct,
  type TyRenderPayload,
  type TyTextsByLang,
  TY_LANG_META,
  TY_DESIGN_META,
  buildAddLink,
  buildCode,
  conditionNeedsCatalog,
  describeTier,
  discountPhrase,
  evaluateConditions,
  fillTemplate,
  formatMoney,
  gidTail,
  pickLang,
  resolveTexts,
  sanitizeConditions,
  sanitizeConfig,
  sanitizeTexts,
  DEFAULT_CONFIG,
} from "./utils/thankyou";
import type { ParsedBatch } from "./utils/analytics";

type AdminGraphql = { graphql: (query: string, options?: any) => Promise<Response> };

const GIFT_CARDS_ENABLED = (process.env.XPOOST_GIFT_CARDS || "").trim() === "1";

export async function gql(admin: AdminGraphql, query: string, variables?: Record<string, unknown>) {
  const res = await admin.graphql(query, { variables });
  const json: any = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors).slice(0, 400)}`);
  return json.data;
}

// ─────────────────────────────────────────────────────────────
// Offers (parsed rows)
// ─────────────────────────────────────────────────────────────

export type ParsedOffer = {
  id: string;
  name: string;
  kind: TyKind;
  design: TyDesign;
  enabled: boolean;
  priority: number;
  config: TyConfig;
  conditions: TyConditions;
  texts: TyTextsByLang;
};

function safeJson(s: string | null | undefined): any {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

export function parseOffer(row: {
  id: string;
  name: string;
  kind: string;
  design: string;
  enabled: boolean;
  priority: number;
  configJson: string;
  conditionsJson: string;
  textsJson: string;
}): ParsedOffer {
  const kind = (["reward", "addon", "shiptogether"].includes(row.kind) ? row.kind : "reward") as TyKind;
  const design = (row.design in TY_DESIGN_META ? row.design : "minimal") as TyDesign;
  return {
    id: row.id,
    name: row.name,
    kind,
    design,
    enabled: row.enabled,
    priority: row.priority,
    config: sanitizeConfig(safeJson(row.configJson)),
    conditions: sanitizeConditions(safeJson(row.conditionsJson)),
    texts: sanitizeTexts(safeJson(row.textsJson)),
  };
}

// ─────────────────────────────────────────────────────────────
// Shop info (cached)
// ─────────────────────────────────────────────────────────────

type ShopInfo = { name: string; currency: string; url: string };
const shopInfoCache = new Map<string, { at: number; v: ShopInfo }>();

export async function getShopInfo(admin: AdminGraphql, domain: string): Promise<ShopInfo> {
  const hit = shopInfoCache.get(domain);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.v;
  const d = await gql(admin, `#graphql\nquery XpTyShop { shop { name currencyCode primaryDomain { url } } }`);
  const v: ShopInfo = {
    name: String(d?.shop?.name || domain),
    currency: String(d?.shop?.currencyCode || "USD"),
    url: String(d?.shop?.primaryDomain?.url || `https://${domain}`).replace(/\/$/, ""),
  };
  shopInfoCache.set(domain, { at: Date.now(), v });
  return v;
}

// ─────────────────────────────────────────────────────────────
// Order lookup (server-verified)
// ─────────────────────────────────────────────────────────────

type VerifiedOrder = {
  id: string;
  name: string;
  subtotal: number; // shop currency
  presentmentCurrency: string;
  discountCodes: string[];
  itemCount: number;
  variantIds: string[];
  productIds: string[];
  tags: string[];
  collectionIds: string[];
};

async function fetchOrder(admin: AdminGraphql, orderId: string, catalog: boolean): Promise<VerifiedOrder | null> {
  const d = await gql(
    admin,
    `#graphql
    query XpTyOrder($id: ID!, $catalog: Boolean!) {
      order(id: $id) {
        id
        name
        presentmentCurrencyCode
        discountCodes
        subtotalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 40) {
          nodes {
            quantity
            variant {
              id
              product {
                id
                tags @include(if: $catalog)
                collections(first: 10) @include(if: $catalog) { nodes { id } }
              }
            }
          }
        }
      }
    }`,
    { id: orderId, catalog },
  );
  const o = d?.order;
  if (!o) return null;
  const lines: any[] = o.lineItems?.nodes || [];
  const tags = new Set<string>();
  const cols = new Set<string>();
  const prods = new Set<string>();
  const variants: string[] = [];
  let count = 0;
  for (const l of lines) {
    count += Number(l.quantity) || 0;
    if (l.variant?.id) variants.push(String(l.variant.id));
    const p = l.variant?.product;
    if (p?.id) prods.add(String(p.id));
    for (const t of p?.tags || []) tags.add(String(t));
    for (const c of p?.collections?.nodes || []) cols.add(String(c.id));
  }
  return {
    id: String(o.id),
    name: String(o.name || ""),
    subtotal: Number(o.subtotalPriceSet?.shopMoney?.amount) || 0,
    presentmentCurrency: String(o.presentmentCurrencyCode || o.subtotalPriceSet?.shopMoney?.currencyCode || "USD"),
    discountCodes: (o.discountCodes || []).map(String),
    itemCount: count,
    variantIds: variants,
    productIds: [...prods],
    tags: [...tags],
    collectionIds: [...cols],
  };
}

// ─────────────────────────────────────────────────────────────
// Live product data for the add-on offers
// ─────────────────────────────────────────────────────────────

export async function fetchLiveProducts(admin: AdminGraphql, products: TyProduct[]): Promise<TyProduct[]> {
  if (!products.length) return [];
  const d = await gql(
    admin,
    `#graphql
    query XpTyProducts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          title
          price
          availableForSale
          image { url }
          product { id title status handle featuredImage { url } }
        }
      }
    }`,
    { ids: products.map((p) => p.variantId) },
  );
  const byId = new Map<string, any>();
  for (const n of d?.nodes || []) if (n?.id) byId.set(String(n.id), n);
  const out: TyProduct[] = [];
  for (const p of products) {
    const n = byId.get(p.variantId);
    if (!n || !n.availableForSale || n.product?.status !== "ACTIVE") continue; // sold out or unpublished: skip
    const variantPart = n.title && n.title !== "Default Title" ? ` – ${n.title}` : "";
    out.push({
      productId: String(n.product?.id || p.productId),
      variantId: p.variantId,
      title: `${n.product?.title || p.title}${variantPart}`.slice(0, 150),
      imageUrl: n.image?.url || n.product?.featuredImage?.url || p.imageUrl,
      price: String(n.price ?? p.price),
      handle: n.product?.handle || p.handle,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Code creation
// ─────────────────────────────────────────────────────────────

function randomCodePart(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

const COMBINES_REWARD = { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true };
const COMBINES_ADDON = { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true };

type CreateBasic = {
  prefix: string;
  startsAt: Date;
  endsAt: Date;
  valueType: "percent" | "fixed";
  value: number;
  minSpend: number;
  variantIds?: string[]; // limit to these items
  title: string;
  combines: typeof COMBINES_REWARD;
};

async function createBasicCode(admin: AdminGraphql, o: CreateBasic): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = buildCode(o.prefix, randomCodePart());
    const data = await gql(
      admin,
      `#graphql
      mutation XpTyBasic($d: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $d) {
          codeDiscountNode { id }
          userErrors { field message code }
        }
      }`,
      {
        d: {
          title: `${o.title} ${code}`.slice(0, 255),
          code,
          startsAt: o.startsAt.toISOString(),
          endsAt: o.endsAt.toISOString(),
          usageLimit: 1,
          appliesOncePerCustomer: true,
          combinesWith: o.combines,
          customerSelection: { all: true },
          customerGets: {
            value:
              o.valueType === "percent"
                ? { percentage: Math.min(1, Math.max(0.01, o.value / 100)) }
                : { discountAmount: { amount: o.value.toFixed(2), appliesOnEachItem: false } },
            items: o.variantIds?.length ? { products: { productVariantsToAdd: o.variantIds } } : { all: true },
          },
          ...(o.minSpend > 0 ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: o.minSpend.toFixed(2) } } } : {}),
        },
      },
    );
    const errs: any[] = data?.discountCodeBasicCreate?.userErrors || [];
    if (!errs.length) return code;
    if (!errs.some((e) => /taken|unique|already/i.test(`${e.code} ${e.message}`))) {
      throw new Error(`discountCodeBasicCreate: ${errs.map((e) => e.message).join("; ")}`);
    }
  }
  throw new Error("Could not find a free discount code");
}

async function createFreeShippingCode(admin: AdminGraphql, o: { prefix: string; startsAt: Date; endsAt: Date; title: string }): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = buildCode(o.prefix, randomCodePart());
    const data = await gql(
      admin,
      `#graphql
      mutation XpTyShip($d: DiscountCodeFreeShippingInput!) {
        discountCodeFreeShippingCreate(freeShippingCodeDiscount: $d) {
          codeDiscountNode { id }
          userErrors { field message code }
        }
      }`,
      {
        d: {
          title: `${o.title} ${code}`.slice(0, 255),
          code,
          startsAt: o.startsAt.toISOString(),
          endsAt: o.endsAt.toISOString(),
          usageLimit: 1,
          appliesOncePerCustomer: true,
          appliesOnOneTimePurchase: true,
          customerSelection: { all: true },
          destination: { all: true },
          combinesWith: { productDiscounts: true, orderDiscounts: true },
        },
      },
    );
    const errs: any[] = data?.discountCodeFreeShippingCreate?.userErrors || [];
    if (!errs.length) return code;
    if (!errs.some((e) => /taken|unique|already/i.test(`${e.code} ${e.message}`))) {
      throw new Error(`discountCodeFreeShippingCreate: ${errs.map((e) => e.message).join("; ")}`);
    }
  }
  throw new Error("Could not find a free shipping code");
}

/** Gift card (needs the write_gift_cards scope — only used when XPOOST_GIFT_CARDS=1). Throws on any problem. */
async function createGiftCard(admin: AdminGraphql, amount: number, expiresOn: Date, note: string): Promise<string> {
  const data = await gql(
    admin,
    `#graphql
    mutation XpTyGift($input: GiftCardCreateInput!) {
      giftCardCreate(input: $input) {
        giftCardCode
        userErrors { field message code }
      }
    }`,
    { input: { initialValue: amount.toFixed(2), expiresOn: expiresOn.toISOString().slice(0, 10), note: note.slice(0, 250) } },
  );
  const errs: any[] = data?.giftCardCreate?.userErrors || [];
  const code = data?.giftCardCreate?.giftCardCode;
  if (errs.length || !code) throw new Error(`giftCardCreate: ${errs.map((e) => e.message).join("; ") || "no code"}`);
  return String(code).toUpperCase();
}


async function issueCodes(
  admin: AdminGraphql,
  offer: ParsedOffer,
  products: TyProduct[],
  orderSubtotal: number,
  now: Date,
): Promise<{ codes: IssuedCode[]; expiresAt: Date }> {
  const startsAt = new Date(now.getTime() - 60_000);
  const codes: IssuedCode[] = [];

  if (offer.kind === "reward") {
    const r = offer.config.reward;
    const expiresAt = new Date(now.getTime() + r.expiryDays * 86_400_000);
    const tiers = offer.design === "vip_ladder" ? r.tiers : r.tiers.slice(0, 1);
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      let made: IssuedCode | null = null;
      if (r.kind === "giftcard" && GIFT_CARDS_ENABLED) {
        const amount = t.valueType === "fixed" ? t.value : Math.round(orderSubtotal * (t.value / 100) * 100) / 100;
        try {
          const code = await createGiftCard(admin, amount, expiresAt, `XPoost thank-you gift`);
          made = { code, type: "reward", tierIndex: i, minSpend: 0, discountText: amount.toFixed(2), valueType: "fixed", value: amount, giftCard: true };
        } catch (e) {
          console.warn("[XPoost thank-you] gift card failed, falling back to a discount code:", (e as Error).message);
        }
      }
      if (!made) {
        const code = await createBasicCode(admin, {
          prefix: r.codePrefix,
          startsAt,
          endsAt: expiresAt,
          valueType: t.valueType,
          value: t.value,
          minSpend: t.minSpend,
          title: "XPoost thank-you reward",
          combines: COMBINES_REWARD,
        });
        made = { code, type: "reward", tierIndex: i, minSpend: t.minSpend, discountText: String(t.value), valueType: t.valueType, value: t.value };
      }
      codes.push(made);
    }
    return { codes, expiresAt };
  }

  // add-on / ship-together: one code limited to the offered items, expiring with the window
  const a = offer.config.addon;
  const expiresAt = new Date(now.getTime() + a.windowMinutes * 60_000);
  if (a.benefit === "free_shipping") {
    const code = await createFreeShippingCode(admin, { prefix: "SHIP", startsAt, endsAt: expiresAt, title: "XPoost ship-together" });
    codes.push({ code, type: "addon_shipping", tierIndex: 0, minSpend: 0, discountText: "", valueType: "ship", value: 0 });
  } else {
    const code = await createBasicCode(admin, {
      prefix: "ADD",
      startsAt,
      endsAt: expiresAt,
      valueType: "percent",
      value: a.percent,
      minSpend: 0,
      variantIds: products.map((p) => p.variantId),
      title: "XPoost add-on",
      combines: COMBINES_ADDON,
    });
    codes.push({ code, type: "addon_percent", tierIndex: 0, minSpend: 0, discountText: String(a.percent), valueType: "percent", value: a.percent });
  }
  return { codes, expiresAt };
}

// ─────────────────────────────────────────────────────────────
// Payload
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// Resolve (called by the checkout extension)
// ─────────────────────────────────────────────────────────────

export async function resolveThankYou(input: {
  shopDomain: string;
  orderId: string;
  locale?: string;
  firstName?: string;
  country?: string;
  isFirstOrder?: boolean | null;
}): Promise<TyRenderPayload> {
  const none: TyRenderPayload = { show: false };
  if (!/^gid:\/\/shopify\/Order\/\d+$/.test(input.orderId)) return none;

  const shop = await prisma.shop.findUnique({ where: { shopDomain: input.shopDomain }, select: { id: true, thankYouEnabled: true, analyticsTimezone: true } });
  if (!shop || !shop.thankYouEnabled) return none;

  const rows = await prisma.tyOffer.findMany({ where: { shopId: shop.id, enabled: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  const existing = await prisma.tyClaim.findUnique({ where: { shopId_orderId: { shopId: shop.id, orderId: input.orderId } } });
  if (!rows.length && !existing) return none;

  const { admin } = await unauthenticated.admin(input.shopDomain);
  const info = await getShopInfo(admin, input.shopDomain);
  const shopInfo = { ...info, domain: input.shopDomain };
  const lang = pickLang(input.locale);

  // ── A claim already exists for this order: show the same offer again (refresh-safe) ──
  if (existing) {
    const parsedCodes: IssuedCode[] = safeJson(existing.codesJson) as IssuedCode[];
    if (!Array.isArray(parsedCodes) || parsedCodes.length === 0) {
      // another request is creating it right now
      if (Date.now() - existing.createdAt.getTime() < 30_000) return { show: false, retry: true };
      await prisma.tyClaim.delete({ where: { id: existing.id } }).catch(() => {});
      return resolveThankYou(input);
    }
    const offerRow = await prisma.tyOffer.findUnique({ where: { id: existing.offerId } });
    if (!offerRow) return none;
    const offer = parseOffer(offerRow);
    const live = offer.kind === "reward" ? [] : await fetchLiveProducts(admin, offer.config.addon.products);
    return buildPayload({
      offer,
      codes: parsedCodes,
      expiresAt: existing.expiresAt,
      lang,
      shop: shopInfo,
      firstName: input.firstName,
      orderNumber: existing.orderNumber,
      orderId: existing.orderId,
      products: live,
      showPrices: true,
    });
  }

  // ── First visit: verify the order, choose an offer ──
  const offers = rows.map(parseOffer);
  const needCatalog = offers.some((o) => conditionNeedsCatalog(o.conditions));
  const order = await fetchOrder(admin, input.orderId, needCatalog);
  if (!order) return { show: false, retry: true }; // not visible to the API yet

  const ctx: TyContext = {
    subtotal: order.subtotal,
    currency: order.presentmentCurrency,
    country: String(input.country || "").toUpperCase(),
    itemCount: order.itemCount,
    isFirstOrder: typeof input.isFirstOrder === "boolean" ? input.isFirstOrder : null,
    discountCodes: order.discountCodes,
    productIds: order.productIds,
    tags: order.tags,
    collectionIds: order.collectionIds,
  };

  const purchasedVariants = new Set(order.variantIds);
  let chosen: ParsedOffer | null = null;
  let chosenProducts: TyProduct[] = [];
  for (const offer of offers) {
    if (!evaluateConditions(offer.conditions, ctx)) continue;
    if (offer.kind !== "reward") {
      const fresh = await fetchLiveProducts(
        admin,
        offer.config.addon.products.filter((p) => !purchasedVariants.has(p.variantId)),
      );
      if (!fresh.length) continue; // nothing left to offer → try the next offer
      chosenProducts = fresh;
    }
    chosen = offer;
    break;
  }
  if (!chosen) return none;

  // Reserve the claim first (unique per order) so concurrent requests can't both mint codes
  let claimId: string;
  try {
    const placeholder = await prisma.tyClaim.create({
      data: {
        shopId: shop.id,
        offerId: chosen.id,
        orderId: order.id,
        orderNumber: order.name || null,
        kind: chosen.kind,
        expiresAt: new Date(),
        codesJson: "[]",
      },
    });
    claimId = placeholder.id;
  } catch (e: any) {
    if (e?.code === "P2002") return { show: false, retry: true };
    throw e;
  }

  try {
    const now = new Date();
    const issued = await issueCodes(admin, chosen, chosenProducts, order.subtotal, now);
    await prisma.$transaction([
      prisma.tyClaim.update({ where: { id: claimId }, data: { expiresAt: issued.expiresAt, codesJson: JSON.stringify(issued.codes) } }),
      prisma.tyCode.createMany({
        data: issued.codes.map((c) => ({ shopId: shop.id, claimId, code: c.code.toUpperCase(), type: c.type })),
        skipDuplicates: true,
      }),
    ]);
    return buildPayload({
      offer: chosen,
      codes: issued.codes,
      expiresAt: issued.expiresAt,
      lang,
      shop: shopInfo,
      firstName: input.firstName,
      orderNumber: order.name,
      orderId: order.id,
      products: chosenProducts,
      showPrices: order.presentmentCurrency === info.currency,
      now,
    });
  } catch (err) {
    await prisma.tyClaim.delete({ where: { id: claimId } }).catch(() => {});
    console.error("[XPoost thank-you] could not issue codes:", err);
    return none;
  }
}

// ─────────────────────────────────────────────────────────────
// Sample payload (checkout editor + admin preview)
// ─────────────────────────────────────────────────────────────

export async function sampleThankYou(shopDomain: string, locale?: string): Promise<TyRenderPayload> {
  const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });
  if (!shop) return { show: false };
  const row = await prisma.tyOffer.findFirst({ where: { shopId: shop.id }, orderBy: [{ enabled: "desc" }, { priority: "asc" }] });
  if (!row) return { show: false };
  const offer = parseOffer(row);
  const { admin } = await unauthenticated.admin(shopDomain);
  const info = await getShopInfo(admin, shopDomain);
  const products =
    offer.kind === "reward" ? [] : await fetchLiveProducts(admin, offer.config.addon.products).catch(() => offer.config.addon.products);
  return buildSample(offer, { ...info, domain: shopDomain }, pickLang(locale), products);
}


// ─────────────────────────────────────────────────────────────
// Analytics events (feature "ty")
// ─────────────────────────────────────────────────────────────

export async function recordThankYouEvent(
  shop: { id: string; analyticsTimezone?: string | null },
  offerId: string,
  event: "view" | "click" | "action" | "dismiss",
  dim = "",
) {
  const inc = { feature: "thankYou", offerId: offerId.slice(0, 40), dim: dim.slice(0, 40), device: "d" as const, impressions: 0, clicks: 0, actions: 0, dismissals: 0, value: 0 };
  if (event === "view") inc.impressions = 1;
  if (event === "click") inc.clicks = 1;
  if (event === "action") inc.actions = 1;
  if (event === "dismiss") inc.dismissals = 1;
  const batch: ParsedBatch = { visitorId: null, increments: [inc], exposedFeatures: [] };
  await recordEvents(shop.id, shop.analyticsTimezone, batch);
}

export { DEFAULT_CONFIG };
