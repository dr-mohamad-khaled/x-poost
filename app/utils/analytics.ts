/**
 * XPoost analytics — shared, dependency-free helpers.
 * Used by the storefront ingest route, the order webhooks/backfill and the dashboard.
 */

export const FEATURE_CODES = {
  _s: "_store",
  pp: "prePurchase",
  ic: "inCart",
  qb: "quantityBreaks",
  sb: "shippingBar",
  ei: "exitIntent",
  st: "scarcity",
  ps: "productScarcity",
  so: "socialBar",
} as const;

export type FeatureCode = keyof typeof FEATURE_CODES;
export type FeatureKey = (typeof FEATURE_CODES)[FeatureCode];

export const FEATURE_KEYS: Exclude<FeatureKey, "_store">[] = [
  "prePurchase",
  "inCart",
  "quantityBreaks",
  "shippingBar",
  "exitIntent",
  "scarcity",
  "productScarcity",
  "socialBar",
];

export const FEATURE_LABELS: Record<string, string> = {
  prePurchase: "Pre-Purchase Upsell",
  inCart: "Cart Drawer Upsell",
  quantityBreaks: "Quantity Breaks",
  shippingBar: "Free Shipping Bar",
  exitIntent: "Exit-Intent Saver",
  scarcity: "Urgency Notifications",
  productScarcity: "Stock Scarcity Block",
  socialBar: "Support & Social Bar",
  upsellLegacy: "Upsells (untagged)",
};

/** Event codes sent by the storefront tracker → counter column. */
export const EVENT_COLUMNS = {
  s: "impressions", // session start (feature "_store")
  i: "impressions",
  c: "clicks",
  a: "actions",
  x: "dismissals",
} as const;
export type EventCode = keyof typeof EVENT_COLUMNS;

/** Local calendar day (YYYY-MM-DD) for a timestamp in an IANA timezone. */
export function localDay(ts: Date | number, timeZone?: string | null): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Date object for a YYYY-MM-DD string (midnight UTC — how Postgres DATE round-trips through Prisma). */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function clampStr(v: unknown, max = 64): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[\u0000-\u001f]/g, "").slice(0, max);
}

// ─────────────────────────────────────────────────────────────
// Storefront event batches
// ─────────────────────────────────────────────────────────────

export type RawBatch = {
  vid?: unknown;
  dev?: unknown;
  ev?: unknown;
};

export type StatIncrement = {
  feature: string;
  offerId: string;
  dim: string;
  device: "m" | "d";
  impressions: number;
  clicks: number;
  actions: number;
  dismissals: number;
  value: number;
};

export type ParsedBatch = {
  visitorId: string | null;
  increments: StatIncrement[];
  exposedFeatures: string[];
};

const MAX_EVENTS = 60;

/** Validate and aggregate a tracker batch into counter increments. Unknown/invalid events are dropped. */
export function parseEventBatch(raw: RawBatch): ParsedBatch {
  const device: "m" | "d" = raw?.dev === "m" ? "m" : "d";
  const vidRaw = clampStr(raw?.vid, 40);
  const visitorId = /^[a-z0-9]{8,40}$/i.test(vidRaw) ? vidRaw : null;
  const events = Array.isArray(raw?.ev) ? (raw.ev as unknown[]).slice(0, MAX_EVENTS) : [];

  const map = new Map<string, StatIncrement>();
  const exposed = new Set<string>();

  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    const ev = e as Record<string, unknown>;
    const code = clampStr(ev.f, 4) as FeatureCode;
    const eventCode = clampStr(ev.e, 2) as EventCode;
    const feature = FEATURE_CODES[code];
    const column = EVENT_COLUMNS[eventCode];
    if (!feature || !column) continue;
    if ((eventCode === "s") !== (code === "_s")) continue; // sessions only on _store

    const offerId = clampStr(ev.o, 40);
    const dim = clampStr(ev.d, 40);
    let value = Number(ev.v);
    if (!Number.isFinite(value) || value < 0) value = 0;
    value = Math.min(value, 1_000_000);

    const key = `${feature}|${offerId}|${dim}`;
    let inc = map.get(key);
    if (!inc) {
      inc = { feature, offerId, dim, device, impressions: 0, clicks: 0, actions: 0, dismissals: 0, value: 0 };
      map.set(key, inc);
    }
    inc[column] += 1;
    if (eventCode === "a") inc.value += value;
    if (eventCode === "i" && feature !== "_store") exposed.add(feature);
  }

  return { visitorId, increments: [...map.values()], exposedFeatures: [...exposed] };
}

// ─────────────────────────────────────────────────────────────
// Orders → revenue attribution
// ─────────────────────────────────────────────────────────────

export type KV = { key: string; value: string };

export type NormalizedLine = {
  title: string;
  quantity: number;
  unitPrice: number;
  discount: number; // all discount allocations on this line
  props: KV[];
};

export type NormalizedOrder = {
  id: string; // GID
  name: string | null;
  createdAt: Date;
  cancelled: boolean;
  currency: string;
  subtotal: number;
  total: number;
  attributes: KV[];
  discountCodes: string[];
  lines: NormalizedLine[];
};

export type OrderSource = {
  f: string; // feature key
  o: string; // offer / rule id
  d: string; // detail (tier etc.)
  qty: number;
  rev: number;
  disc: number;
  title: string;
};

export type AttributedOrder = {
  directRevenue: number;
  discountCost: number;
  sources: OrderSource[];
  visitorId: string | null;
};

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Normalize an orders/create (REST-shaped) webhook payload. */
export function normalizeWebhookOrder(p: any): NormalizedOrder {
  const shopMoney = (set: any, fallback: unknown) => num(set?.shop_money?.amount ?? fallback);
  return {
    id: String(p?.admin_graphql_api_id || `gid://shopify/Order/${p?.id}`),
    name: p?.name ?? null,
    createdAt: new Date(p?.created_at || Date.now()),
    cancelled: Boolean(p?.cancelled_at),
    currency: String(p?.subtotal_price_set?.shop_money?.currency_code || p?.currency || "USD"),
    subtotal: shopMoney(p?.subtotal_price_set, p?.subtotal_price),
    total: shopMoney(p?.total_price_set, p?.total_price),
    attributes: (p?.note_attributes || []).map((a: any) => ({ key: String(a?.name ?? ""), value: String(a?.value ?? "") })),
    discountCodes: (p?.discount_codes || []).map((d: any) => String(d?.code ?? "")).filter(Boolean),
    lines: (p?.line_items || []).map((l: any) => ({
      title: String(l?.title ?? ""),
      quantity: num(l?.quantity),
      unitPrice: shopMoney(l?.price_set, l?.price),
      discount: (l?.discount_allocations || []).reduce(
        (acc: number, a: any) => acc + shopMoney(a?.amount_set, a?.amount),
        0,
      ),
      props: (l?.properties || []).map((pr: any) => ({ key: String(pr?.name ?? ""), value: String(pr?.value ?? "") })),
    })),
  };
}

/** Normalize an Order node from the Admin GraphQL API (see ORDER_FIELDS in analytics.server.ts). */
export function normalizeGraphqlOrder(n: any): NormalizedOrder {
  const money = (set: any) => num(set?.shopMoney?.amount);
  return {
    id: String(n?.id),
    name: n?.name ?? null,
    createdAt: new Date(n?.createdAt || Date.now()),
    cancelled: Boolean(n?.cancelledAt),
    currency: String(n?.subtotalPriceSet?.shopMoney?.currencyCode || n?.currencyCode || "USD"),
    subtotal: money(n?.subtotalPriceSet),
    total: money(n?.totalPriceSet),
    attributes: (n?.customAttributes || []).map((a: any) => ({ key: String(a?.key ?? ""), value: String(a?.value ?? "") })),
    discountCodes: (n?.discountCodes || []).map(String).filter(Boolean),
    lines: (n?.lineItems?.nodes || []).map((l: any) => ({
      title: String(l?.title ?? ""),
      quantity: num(l?.quantity),
      unitPrice: money(l?.originalUnitPriceSet),
      discount: (l?.discountAllocations || []).reduce(
        (acc: number, a: any) => acc + money(a?.allocatedAmountSet),
        0,
      ),
      props: (l?.customAttributes || []).map((a: any) => ({ key: String(a?.key ?? ""), value: String(a?.value ?? "") })),
    })),
  };
}

const SRC_FEATURES: Record<string, string> = { pp: "prePurchase", ic: "inCart", qb: "quantityBreaks" };

/**
 * Work out which order revenue XPoost produced.
 * - Lines tagged `_xpoost_src` (pp:<ruleId> | ic:<ruleId> | qb:<offerId>:<qty>) → that feature.
 * - Older lines: `_xpoost_qb_tier` → Quantity Breaks; `_xpoost_upsell` → untagged upsell.
 * - Exit-intent: the order used the exit-intent discount code → the order subtotal.
 */
export function attributeOrder(order: NormalizedOrder, opts: { exitIntentCode?: string | null } = {}): AttributedOrder {
  const sources: OrderSource[] = [];
  let direct = 0;
  let discountCost = 0;

  for (const line of order.lines) {
    const prop = (k: string) => line.props.find((p) => p.key === k)?.value ?? "";
    const src = prop("_xpoost_src");
    let f = "";
    let o = "";
    let d = "";

    if (src) {
      const [code, id = "", detail = ""] = src.split(":");
      f = SRC_FEATURES[code] || "";
      o = id;
      d = detail;
    } else if (prop("_xpoost_qb_tier")) {
      f = "quantityBreaks";
      d = prop("_xpoost_qb_tier");
    } else if (prop("_xpoost_upsell") === "true") {
      f = "upsellLegacy";
    }
    if (!f) continue;

    const gross = line.unitPrice * line.quantity;
    const rev = Math.max(0, gross - line.discount);
    direct += rev;
    discountCost += line.discount;
    sources.push({ f, o, d, qty: line.quantity, rev: round2(rev), disc: round2(line.discount), title: line.title.slice(0, 120) });
  }

  const exitCode = (opts.exitIntentCode || "").trim().toLowerCase();
  if (exitCode && order.discountCodes.some((c) => c.trim().toLowerCase() === exitCode)) {
    // Recovered order: count its subtotal (not already-counted XPoost lines, to avoid double counting)
    const rev = Math.max(0, order.subtotal - direct);
    sources.push({ f: "exitIntent", o: "", d: exitCode.toUpperCase(), qty: 1, rev: round2(rev), disc: 0, title: order.name || "" });
    direct += rev;
  }

  const vid = order.attributes.find((a) => a.key === "_xp_vid")?.value || "";
  return {
    directRevenue: round2(direct),
    discountCost: round2(discountCost),
    sources,
    visitorId: /^[a-z0-9]{8,40}$/i.test(vid) ? vid : null,
  };
}
