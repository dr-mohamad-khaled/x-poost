// Bundle Builder — server side: storefront payload (app proxy) and the checkout discount sync.

import prisma from "./db.server";
import { parseKit, resolveKbTexts, stepUnion, type ParsedKit } from "./utils/kits";
import { parseRecs, resolveRcTexts, type ParsedRecs } from "./utils/recs";
import {
  BB_COND_META,
  numericId,
  parseBundle,
  resolveTexts,
  sanitizeSettings,
  type BbConditions,
  type BbSettings,
  type ParsedBundle,
} from "./utils/bundles";

export const BUNDLES_DISCOUNT_TITLE = "XPoost Bundles";
const NAMESPACE = "$app:bundles";

type Admin = { graphql: Function };

export async function loadBundles(shopId: string): Promise<ParsedBundle[]> {
  const rows = await prisma.bundle.findMany({ where: { shopId }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  return rows.map(parseBundle);
}

// ─────────────────────────────────────────────────────────────
// Who is shopping (from the signed app-proxy request)
// ─────────────────────────────────────────────────────────────

export type ShopperContext = {
  loggedIn: boolean;
  orders: number;
  spent: number;
  tags: Set<string>;
  country: string;
  market: string;
  today: string; // YYYY-MM-DD in the shop's timezone
};

const customerCache = new Map<string, { at: number; v: { tags: string[]; orders: number; spent: number } | null }>();
const CUSTOMER_TTL = 5 * 60_000;

/** Tags and order history of the logged-in customer. Only called when a bundle has a customer rule. */
export async function lookupCustomer(admin: Admin | undefined, shop: string, customerId: string) {
  if (!admin || !/^\d+$/.test(customerId)) return null;
  const key = `${shop}:${customerId}`;
  const hit = customerCache.get(key);
  if (hit && Date.now() - hit.at < CUSTOMER_TTL) return hit.v;
  let v: { tags: string[]; orders: number; spent: number } | null = null;
  try {
    const res = await admin.graphql(
      `#graphql
      query XpBundleCustomer($id: ID!) { customer(id: $id) { tags numberOfOrders amountSpent { amount } } }`,
      { variables: { id: `gid://shopify/Customer/${customerId}` } },
    );
    const j: any = await res.json();
    const c = j?.data?.customer;
    if (c) v = { tags: (c.tags || []).map((t: string) => String(t)), orders: Number(c.numberOfOrders) || 0, spent: Number(c.amountSpent?.amount) || 0 };
  } catch (err) {
    console.warn("[xpoost-bundles] customer lookup failed:", err);
  }
  customerCache.set(key, { at: Date.now(), v });
  if (customerCache.size > 5000) customerCache.delete(customerCache.keys().next().value as string);
  return v;
}

export function needsCustomer(c: BbConditions) {
  return c.rules.some((r) => ["tag_any", "tag_none", "orders_gte", "orders_lte", "spent_gte"].includes(r.type));
}

/** Same rules as the checkout function. A rule with no value yet is ignored. */
export function conditionsPass(c: BbConditions, ctx: ShopperContext): boolean {
  const results: boolean[] = [];
  for (const r of c.rules) {
    const vals = r.values || [];
    let v: boolean | null = null;
    switch (r.type) {
      case "tag_any":
        v = vals.length ? vals.some((t) => ctx.tags.has(t.toLowerCase())) : null;
        break;
      case "tag_none":
        v = vals.length ? !vals.some((t) => ctx.tags.has(t.toLowerCase())) : null;
        break;
      case "logged_in":
        v = ctx.loggedIn;
        break;
      case "guest":
        v = !ctx.loggedIn;
        break;
      case "orders_gte":
        v = r.num === undefined ? null : ctx.orders >= r.num;
        break;
      case "orders_lte":
        v = r.num === undefined ? null : ctx.orders <= r.num;
        break;
      case "spent_gte":
        v = r.num === undefined ? null : ctx.spent >= r.num;
        break;
      case "country_in":
        v = vals.length && ctx.country ? vals.includes(ctx.country) : vals.length ? false : null;
        break;
      case "country_not_in":
        v = vals.length ? !vals.includes(ctx.country) : null;
        break;
      case "market_in":
        v = vals.length ? vals.includes(ctx.market) : null;
        break;
    }
    if (v !== null) results.push(v);
  }
  if (!results.length) return true;
  return c.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

export function scheduleOk(b: ParsedBundle, today: string) {
  if (b.config.startsAt && today < b.config.startsAt) return false;
  if (b.config.endsAt && today > b.config.endsAt) return false;
  return true;
}

export function localDate(tz: string | null | undefined, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

// ─────────────────────────────────────────────────────────────
// Collections → product handles (cached)
// ─────────────────────────────────────────────────────────────

const collectionCache = new Map<string, { at: number; handles: { id: string; handle: string }[] }>();
const COLLECTION_TTL = 10 * 60_000;

export async function collectionProducts(admin: Admin | undefined, shop: string, collectionId: string, limit: number) {
  const key = `${shop}:${collectionId}`;
  const hit = collectionCache.get(key);
  if (hit && Date.now() - hit.at < COLLECTION_TTL) return hit.handles.slice(0, limit);
  if (!admin) return hit ? hit.handles.slice(0, limit) : [];
  let handles: { id: string; handle: string }[] = [];
  try {
    const res = await admin.graphql(
      `#graphql
      query XpBundleCollection($id: ID!) {
        collection(id: $id) {
          products(first: 60, sortKey: COLLECTION_DEFAULT) { nodes { id handle status } }
        }
      }`,
      { variables: { id: collectionId } },
    );
    const j: any = await res.json();
    handles = (j?.data?.collection?.products?.nodes || []).filter((p: any) => p?.status === "ACTIVE").map((p: any) => ({ id: p.id, handle: p.handle }));
  } catch (err) {
    console.warn("[xpoost-bundles] collection lookup failed:", err);
    if (hit) return hit.handles.slice(0, limit);
  }
  collectionCache.set(key, { at: Date.now(), handles });
  if (collectionCache.size > 2000) collectionCache.delete(collectionCache.keys().next().value as string);
  return handles.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Storefront payload
// ─────────────────────────────────────────────────────────────

export async function storefrontBundles(
  admin: Admin | undefined,
  shop: string,
  bundles: ParsedBundle[],
  ctx: ShopperContext,
  lang: string,
) {
  const out: any[] = [];
  for (const b of bundles) {
    if (!b.enabled || !scheduleOk(b, ctx.today) || !conditionsPass(b.conditions, ctx)) continue;
    const c = b.config;
    const texts = resolveTexts(b.texts, lang);
    const productIds = new Set<string>();
    const collectionIds = new Set<string>();

    const steps =
      b.type === "mix" || b.type === "box"
        ? await Promise.all(
            c.steps.map(async (s) => {
              const handles: string[] = [];
              for (const p of s.products) {
                handles.push(p.handle);
                productIds.add(numericId(p.id));
              }
              for (const col of s.collections) {
                collectionIds.add(numericId(col.id));
                for (const p of await collectionProducts(admin, shop, col.id, 60)) if (!handles.includes(p.handle)) handles.push(p.handle);
              }
              return { id: s.id, title: texts.steps[s.id] || s.title, min: s.min, max: s.max, handles: handles.slice(0, 60) };
            }),
          )
        : [];
    if (b.type === "fixed") for (const f of c.fixed) productIds.add(numericId(f.id));
    if (b.type === "multipack" && c.multipack.product) productIds.add(numericId(c.multipack.product.id));
    if ((b.type === "mix" || b.type === "box") && steps.every((s) => !s.handles.length)) continue;

    const { steps: _ignored, ...plainTexts } = texts;
    out.push({
      id: b.id,
      name: b.name,
      type: b.type,
      design: b.design,
      display: c.display,
      afterAdd: c.afterAdd,
      hideSoldOut: c.hideSoldOut,
      allowDuplicates: c.allowDuplicates,
      device: b.placement.device,
      placement: {
        mode: b.placement.mode,
        products: b.placement.products.map((p) => numericId(p.id)),
        collections: b.placement.collections.map((x) => numericId(x.id)),
      },
      productIds: [...productIds],
      collectionIds: [...collectionIds],
      steps,
      fixed: b.type === "fixed" ? c.fixed.map((f) => ({ handle: f.handle, qty: f.qty })) : [],
      multipack: b.type === "multipack" && c.multipack.product ? { handle: c.multipack.product.handle, min: c.multipack.min, max: c.multipack.max } : null,
      pricing: c.pricing,
      gift: c.gift.enabled && c.gift.product?.variantId ? { handle: c.gift.product.handle, variantId: numericId(c.gift.product.variantId), minItems: c.gift.minItems } : null,
      style: b.style,
      texts: plainTexts,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Checkout discount (Shopify Function config)
// ─────────────────────────────────────────────────────────────

/** Compact config read by the "XPoost Bundles" function. Kits are checked like step-by-step bundles. */
export function functionConfig(bundles: ParsedBundle[], extra: { kits?: ParsedKit[]; recs?: ParsedRecs | null } = {}) {
  const collectionIds = new Set<string>();
  const customerTags = new Set<string>();
  const b = bundles
    .filter((x) => x.enabled)
    .map((x) => {
      const c = x.config;
      const en = resolveTexts(x.texts, "en");
      for (const s of c.steps) for (const col of s.collections) collectionIds.add(col.id);
      for (const r of x.conditions.rules) if (BB_COND_META[r.type].input === "tags") for (const t of r.values || []) customerTags.add(t);
      const out: any = {
        id: x.id,
        t: (en.title || x.name).slice(0, 80),
        ty: x.type,
        dup: c.allowDuplicates ? 1 : 0,
        mul: c.allowMultiples ? 1 : 0,
        pr:
          c.pricing.mode === "tiers"
            ? { m: "tiers", t: c.pricing.tiers.map((t) => [t.min, t.mode, t.value]) }
            : c.pricing.mode === "cheapest"
              ? { m: "cheapest", cc: c.pricing.cheapestCount, cp: c.pricing.cheapestPercent }
              : { m: c.pricing.mode, v: c.pricing.value },
        c: { m: x.conditions.match, r: x.conditions.rules.map((r) => ({ t: r.type, v: r.values, n: r.num })) },
      };
      if (x.type === "mix" || x.type === "box") out.st = c.steps.map((s) => ({ p: s.products.map((p) => numericId(p.id)), c: s.collections.map((col) => col.id), mn: s.min, mx: s.max }));
      if (x.type === "fixed") out.f = c.fixed.map((f) => ({ p: numericId(f.id), q: f.qty }));
      if (x.type === "multipack" && c.multipack.product) out.m = { p: numericId(c.multipack.product.id), mn: c.multipack.min, mx: c.multipack.max };
      if (c.gift.enabled && c.gift.product) out.g = { p: numericId(c.gift.product.id), mn: c.gift.minItems };
      if (c.startsAt) out.s = c.startsAt;
      if (c.endsAt) out.e = c.endsAt;
      return out;
    });
  for (const k of (extra.kits || []).filter((x) => x.enabled)) {
    const c = k.config;
    const en = resolveKbTexts(k.texts, "en");
    for (const r of k.conditions.rules) if (BB_COND_META[r.type].input === "tags") for (const t of r.values || []) customerTags.add(t);
    const st = c.steps.map((s) => {
      const u = stepUnion(s);
      for (const col of u.collections) collectionIds.add(col.id);
      // A step that only shows for some quiz answers may be left out of the kit
      return { p: u.products.map((p) => numericId(p.id)), c: u.collections.map((col) => col.id), mn: s.showIf ? 0 : s.min, mx: s.max };
    });
    const out: any = {
      id: k.id,
      t: (en.title || k.name).slice(0, 80),
      ty: "box",
      dup: c.allowDuplicates ? 1 : 0,
      mul: c.allowMultiples ? 1 : 0,
      pr:
        c.pricing.mode === "tiers"
          ? { m: "tiers", t: c.pricing.tiers.map((t) => [t.min, t.mode, t.value]) }
          : c.pricing.mode === "cheapest"
            ? { m: "cheapest", cc: c.pricing.cheapestCount, cp: c.pricing.cheapestPercent }
            : { m: c.pricing.mode, v: c.pricing.value },
      c: { m: k.conditions.match, r: k.conditions.rules.map((r) => ({ t: r.type, v: r.values, n: r.num })) },
      st,
    };
    if (c.gift.enabled && c.gift.product) out.g = { p: numericId(c.gift.product.id), mn: c.gift.minItems };
    if (c.startsAt) out.s = c.startsAt;
    if (c.endsAt) out.e = c.endsAt;
    b.push(out);
  }
  let r: any = undefined;
  const rc = extra.recs;
  if (rc && rc.enabled && rc.config.offer.mode !== "none" && rc.config.offer.value > 0) {
    const en = resolveRcTexts(rc.texts, "en");
    r = { m: rc.config.offer.mode, v: rc.config.offer.value, t: (en.offerLabel || "Special offer").slice(0, 80) };
    if (rc.config.source === "manual") r.p = rc.config.products.map((p) => numericId(p.id));
    if (rc.config.source === "collection" && rc.config.collection) {
      r.c = [rc.config.collection.id];
      collectionIds.add(rc.config.collection.id);
    }
  }
  return {
    config: r ? { v: 1, b, r } : { v: 1, b },
    vars: { collectionIds: [...collectionIds].slice(0, 50), customerTags: [...customerTags].slice(0, 100) },
  };
}

export type BundlesSyncResult = { state: "active" | "inactive" | "not_deployed" | "error"; message: string };

export function readSettings(json: string | null | undefined): BbSettings {
  try {
    return sanitizeSettings(JSON.parse(json || "{}"));
  } catch {
    return sanitizeSettings({});
  }
}

/** Keeps the automatic "XPoost Bundles" discount in step with the saved bundles. */
export async function syncBundlesDiscount(
  admin: Admin,
  input: { bundles: ParsedBundle[]; featureOn: boolean; settings: BbSettings; kits?: ParsedKit[]; kitsOn?: boolean; recs?: ParsedRecs | null },
): Promise<BundlesSyncResult> {
  try {
    const live = input.featureOn ? input.bundles.filter((b) => b.enabled && (b.config.pricing.mode !== "none" || b.config.gift.enabled)) : [];
    const liveKits = input.kitsOn ? (input.kits || []).filter((k) => k.enabled && (k.config.pricing.mode !== "none" || k.config.gift.enabled)) : [];
    const liveRecs = input.recs && input.recs.enabled && input.recs.config.offer.mode !== "none" && input.recs.config.offer.value > 0 ? input.recs : null;
    const listRes = await admin.graphql(
      `#graphql
      query XpBundleDiscounts {
        discountNodes(first: 100, query: "type:app") {
          nodes { id discount { __typename ... on DiscountAutomaticApp { title status } } }
        }
      }`,
    );
    const listJson: any = await listRes.json();
    const existing = (listJson?.data?.discountNodes?.nodes || []).find((n: any) => n?.discount?.title === BUNDLES_DISCOUNT_TITLE);

    if (!live.length && !liveKits.length && !liveRecs) {
      if (existing && existing.discount?.status === "ACTIVE") {
        await admin.graphql(
          `#graphql
          mutation XpBundlesOff($id: ID!) { discountAutomaticDeactivate(id: $id) { userErrors { message } } }`,
          { variables: { id: existing.id } },
        );
      }
      return { state: "inactive", message: "No live bundle, kit or recommendation offer has a discount, so the checkout discount is paused." };
    }

    const { config, vars } = functionConfig(live, { kits: liveKits, recs: liveRecs });
    const metafields = [
      { namespace: NAMESPACE, key: "config", type: "json", value: JSON.stringify(config) },
      { namespace: NAMESPACE, key: "vars", type: "json", value: JSON.stringify(vars) },
    ];
    const combinesWith = {
      orderDiscounts: input.settings.combineOrder,
      productDiscounts: input.settings.combineProduct,
      shippingDiscounts: input.settings.combineShipping,
    };

    if (existing) {
      const upd = await admin.graphql(
        `#graphql
        mutation XpBundlesUpdate($id: ID!, $d: DiscountAutomaticAppInput!) {
          discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $d) { automaticAppDiscount { discountId status } userErrors { field message } }
        }`,
        { variables: { id: existing.id, d: { title: BUNDLES_DISCOUNT_TITLE, combinesWith, metafields } } },
      );
      const updJson: any = await upd.json();
      const errs = updJson?.data?.discountAutomaticAppUpdate?.userErrors || [];
      if (errs.length) return { state: "error", message: errs.map((e: any) => e.message).join("; ") };
      if (existing.discount?.status !== "ACTIVE") {
        await admin.graphql(
          `#graphql
          mutation XpBundlesOn($id: ID!) { discountAutomaticActivate(id: $id) { userErrors { message } } }`,
          { variables: { id: existing.id } },
        );
      }
      return { state: "active", message: "Prices are live at checkout." };
    }

    const funcRes = await admin.graphql(
      `#graphql
      query XpBundleFunctions { shopifyFunctions(first: 50) { nodes { id title apiType } } }`,
    );
    const funcJson: any = await funcRes.json();
    const fn = (funcJson?.data?.shopifyFunctions?.nodes || []).find((f: any) => String(f?.title || "").toLowerCase() === "xpoost bundles");
    if (!fn) {
      return { state: "not_deployed", message: "The bundle pricing engine isn't deployed yet. Run `npm run deploy`, then save a bundle again." };
    }
    const created = await admin.graphql(
      `#graphql
      mutation XpBundlesCreate($d: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $d) { automaticAppDiscount { discountId status } userErrors { field message } }
      }`,
      {
        variables: {
          d: { title: BUNDLES_DISCOUNT_TITLE, functionId: fn.id, startsAt: new Date().toISOString(), discountClasses: ["PRODUCT"], combinesWith, metafields },
        },
      },
    );
    const cJson: any = await created.json();
    const cErrs = cJson?.data?.discountAutomaticAppCreate?.userErrors || [];
    if (cErrs.length) return { state: "error", message: cErrs.map((e: any) => e.message).join("; ") };
    return { state: "active", message: "Prices are live at checkout: an automatic discount “XPoost Bundles” was created." };
  } catch (err) {
    console.error("[xpoost-bundles] sync failed:", err);
    return { state: "error", message: "Couldn't update the checkout discount. Your bundle was saved; try saving again." };
  }
}

/**
 * One sync for everything that uses the "XPoost Bundles" discount: bundles, kits and
 * recommendation offers. Call it after any change to one of them.
 */
export async function syncAllDiscounts(admin: Admin, shopId: string): Promise<BundlesSyncResult> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { bundlesEnabled: true, bundlesSettingsJson: true, kitsEnabled: true, recsEnabled: true, recsJson: true },
  });
  if (!shop) return { state: "error", message: "Shop not found." };
  const [bundles, kitRows] = await Promise.all([loadBundles(shopId), prisma.kit.findMany({ where: { shopId }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] })]);
  return syncBundlesDiscount(admin, {
    bundles,
    featureOn: shop.bundlesEnabled,
    settings: readSettings(shop.bundlesSettingsJson),
    kits: kitRows.map(parseKit),
    kitsOn: shop.kitsEnabled,
    recs: parseRecs(shop.recsJson, shop.recsEnabled),
  });
}
