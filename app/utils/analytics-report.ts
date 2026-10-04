/**
 * Builds the Analytics dashboard report from daily counters and attributed orders.
 * Pure (no DB / server imports) so it can be unit-tested with fixtures.
 */
import { FEATURE_KEYS, FEATURE_LABELS } from "./analytics";

export const MIN_VIEWS_FOR_RATE = 200;

export type StatRow = {
  day: string; // YYYY-MM-DD
  feature: string;
  offerId: string;
  dim: string;
  device: string;
  impressions: number;
  clicks: number;
  actions: number;
  dismissals: number;
  value: number;
};

export type OrderRow = {
  day: string;
  subtotal: number;
  directRevenue: number;
  discountCost: number;
  sourcesJson: string;
  influencedJson: string;
};

export type ReportInput = {
  rangeDays: number;
  today: string;
  stats: StatRow[]; // current + previous period
  orders: OrderRow[]; // current + previous period, not cancelled
  enabled: Record<string, boolean>;
  offerNames: Record<string, string>;
  messageNames?: Record<string, string>;
  shippingTiers?: number[];
  selectedFeature?: string | null;
};

export type FeatureRow = {
  key: string;
  label: string;
  enabled: boolean;
  actionLabel: string;
  views: number;
  clicks: number;
  actions: number;
  dismissals: number;
  directRevenue: number;
  influencedRevenue: number;
  directOrders: number;
  discountCost: number;
};

export type BreakdownRow = {
  id: string;
  name: string;
  views: number;
  clicks: number;
  actions: number;
  dismissals: number;
  revenue: number;
  orders: number;
};

export type DimRow = { label: string; value: number; sub?: string };

export type FeatureDetail = FeatureRow & {
  prev: { views: number; actions: number; directRevenue: number };
  dailyMetric: "revenue" | "views";
  daily: number[];
  offers: BreakdownRow[];
  offerTitle: string;
  dims: { title: string; valueLabel: string; rows: DimRow[] } | null;
  devices: { m: { views: number; actions: number }; d: { views: number; actions: number } };
  shipping: null | {
    aov: number;
    threshold: number;
    reachedPct: number;
    nearMissPct: number;
    suggested: number;
    ordersCounted: number;
  };
  exitIntent: null | { redemptions: number; recovered: number };
};

export type Report = {
  rangeDays: number;
  days: string[];
  overview: {
    directRevenue: number;
    prevDirectRevenue: number;
    influencedRevenue: number;
    storeRevenue: number;
    orders: number;
    ordersWithXp: number;
    prevOrdersWithXp: number;
    aovWith: number;
    aovWithout: number;
    discountCost: number;
    sessions: number;
    views: number;
    prevViews: number;
    clicks: number;
    actions: number;
    daily: number[];
    features: FeatureRow[];
    hasStorefrontData: boolean;
    hasOrders: boolean;
  };
  feature: FeatureDetail | null;
};

const ACTION_LABELS: Record<string, string> = {
  prePurchase: "Accepted",
  inCart: "Added",
  quantityBreaks: "Added to cart",
  shippingBar: "Reached 1st reward",
  exitIntent: "Went to checkout",
  scarcity: "Clicked",
  productScarcity: "Added to cart",
  socialBar: "Contacted",
  thankYou: "Revealed reward",
};

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type Source = { f: string; o?: string; d?: string; qty?: number; rev?: number; disc?: number };

function parseJson<T>(s: string, fallback: T): T {
  try {
    const v = JSON.parse(s);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Headline counters for one feature, using that feature's own definition of a view / action. */
function summarize(feature: string, rows: StatRow[]) {
  let pick = rows;
  if (feature === "prePurchase") pick = rows.filter((r) => r.dim === "modal");
  const views = sum(pick.map((r) => r.impressions));
  const clicks = sum(pick.map((r) => r.clicks));
  const dismissals = sum(pick.map((r) => r.dismissals));
  let actions = sum(pick.map((r) => r.actions));

  if (feature === "shippingBar") actions = sum(rows.filter((r) => r.dim === "tier1").map((r) => r.actions));
  if (feature === "exitIntent") actions = sum(rows.filter((r) => r.dim === "checkout").map((r) => r.clicks));
  if (feature === "scarcity") actions = clicks;
  return { views, clicks, actions, dismissals };
}

export function buildReport(input: ReportInput): Report {
  const { rangeDays, today } = input;
  const start = addDays(today, -(rangeDays - 1));
  const prevStart = addDays(start, -rangeDays);
  const days: string[] = [];
  for (let i = 0; i < rangeDays; i++) days.push(addDays(start, i));
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  const cur = input.stats.filter((s) => s.day >= start && s.day <= today);
  const prev = input.stats.filter((s) => s.day >= prevStart && s.day < start);
  const curOrders = input.orders.filter((o) => o.day >= start && o.day <= today);
  const prevOrders = input.orders.filter((o) => o.day >= prevStart && o.day < start);

  // ── Orders → revenue per feature / offer
  type Agg = { rev: number; orders: number; disc: number; influenced: number; byOffer: Map<string, { rev: number; orders: number }>; byDim: Map<string, number> };
  const newAgg = (): Agg => ({ rev: 0, orders: 0, disc: 0, influenced: 0, byOffer: new Map(), byDim: new Map() });
  const agg = new Map<string, Agg>();
  const getAgg = (f: string) => {
    let a = agg.get(f);
    if (!a) {
      a = newAgg();
      agg.set(f, a);
    }
    return a;
  };

  const dailyRevenue = days.map(() => 0);
  const dailyRevenueByFeature = new Map<string, number[]>();
  let influencedRevenue = 0;
  let ordersWithXp = 0;
  let revWith = 0;
  let revWithout = 0;

  for (const o of curOrders) {
    const sources = parseJson<Source[]>(o.sourcesJson, []);
    const influenced = parseJson<string[]>(o.influencedJson, []);
    const idx = dayIndex.get(o.day);
    if (o.directRevenue > 0) {
      ordersWithXp += 1;
      revWith += o.subtotal;
    } else {
      revWithout += o.subtotal;
    }
    if (idx !== undefined) dailyRevenue[idx] += o.directRevenue;
    if (influenced.length > 0) influencedRevenue += o.subtotal;

    const seenInOrder = new Set<string>();
    for (const s of sources) {
      const a = getAgg(s.f);
      a.rev += s.rev || 0;
      a.disc += s.disc || 0;
      if (!seenInOrder.has(s.f)) {
        a.orders += 1;
        seenInOrder.add(s.f);
      }
      const ok = s.o || "";
      const off = a.byOffer.get(ok) || { rev: 0, orders: 0 };
      off.rev += s.rev || 0;
      off.orders += 1;
      a.byOffer.set(ok, off);
      if (s.d) a.byDim.set(s.d, (a.byDim.get(s.d) || 0) + (s.rev || 0));
      if (idx !== undefined) {
        const arr = dailyRevenueByFeature.get(s.f) || days.map(() => 0);
        arr[idx] += s.rev || 0;
        dailyRevenueByFeature.set(s.f, arr);
      }
    }
    for (const f of influenced) getAgg(f).influenced += o.subtotal;
  }

  const prevDirect = sum(prevOrders.map((o) => o.directRevenue));
  const prevOrdersWithXp = prevOrders.filter((o) => o.directRevenue > 0).length;
  const ordersWithout = curOrders.length - ordersWithXp;

  // ── Feature leaderboard
  const features: FeatureRow[] = FEATURE_KEYS.map((key) => {
    const s = summarize(key, cur.filter((r) => r.feature === key));
    const a = agg.get(key) || newAgg();
    return {
      key,
      label: FEATURE_LABELS[key] || key,
      enabled: Boolean(input.enabled[key]),
      actionLabel: ACTION_LABELS[key] || "Actions",
      ...s,
      directRevenue: r2(a.rev),
      influencedRevenue: r2(a.influenced),
      directOrders: a.orders,
      discountCost: r2(a.disc),
    };
  });
  const legacy = agg.get("upsellLegacy");
  if (legacy && legacy.rev > 0) {
    features.push({
      key: "upsellLegacy",
      label: FEATURE_LABELS.upsellLegacy,
      enabled: true,
      actionLabel: "",
      views: 0,
      clicks: 0,
      actions: 0,
      dismissals: 0,
      directRevenue: r2(legacy.rev),
      influencedRevenue: 0,
      directOrders: legacy.orders,
      discountCost: r2(legacy.disc),
    });
  }

  const featureStats = cur.filter((r) => r.feature !== "_store");
  const overview = {
    directRevenue: r2(sum(curOrders.map((o) => o.directRevenue))),
    prevDirectRevenue: r2(prevDirect),
    influencedRevenue: r2(influencedRevenue),
    storeRevenue: r2(sum(curOrders.map((o) => o.subtotal))),
    orders: curOrders.length,
    ordersWithXp,
    prevOrdersWithXp,
    aovWith: ordersWithXp ? r2(revWith / ordersWithXp) : 0,
    aovWithout: ordersWithout ? r2(revWithout / ordersWithout) : 0,
    discountCost: r2(sum(curOrders.map((o) => o.discountCost))),
    sessions: sum(cur.filter((r) => r.feature === "_store").map((r) => r.impressions)),
    views: sum(features.map((f) => f.views)),
    prevViews: sum(FEATURE_KEYS.map((k) => summarize(k, prev.filter((r) => r.feature === k)).views)),
    clicks: sum(features.map((f) => f.clicks)),
    actions: sum(features.map((f) => f.actions)),
    daily: dailyRevenue.map(r2),
    features: features.sort((a, b) => b.directRevenue - a.directRevenue || b.views - a.views),
    hasStorefrontData: featureStats.length > 0 || cur.some((r) => r.feature === "_store"),
    hasOrders: curOrders.length > 0,
  };

  // ── Selected feature detail
  let feature: FeatureDetail | null = null;
  const fk = input.selectedFeature;
  if (fk && (FEATURE_KEYS as string[]).includes(fk)) {
    const rows = cur.filter((r) => r.feature === fk);
    const base = features.find((f) => f.key === fk)!;
    const prevS = summarize(fk, prev.filter((r) => r.feature === fk));
    const prevRev = sum(
      prevOrders.flatMap((o) => parseJson<Source[]>(o.sourcesJson, []).filter((s) => s.f === fk).map((s) => s.rev || 0)),
    );
    const a = agg.get(fk) || newAgg();
    const earnsRevenue = ["prePurchase", "inCart", "quantityBreaks", "exitIntent", "thankYou"].includes(fk);

    // Daily series
    let daily: number[];
    if (earnsRevenue) {
      daily = (dailyRevenueByFeature.get(fk) || days.map(() => 0)).map(r2);
    } else {
      daily = days.map(() => 0);
      const viewRows = fk === "prePurchase" ? rows.filter((r) => r.dim === "modal") : rows;
      for (const r of viewRows) {
        const i = dayIndex.get(r.day);
        if (i !== undefined) daily[i] += r.impressions;
      }
    }

    // Per-offer breakdown
    const offers: BreakdownRow[] = [];
    let offerTitle = "";
    if (["prePurchase", "inCart", "quantityBreaks", "scarcity"].includes(fk)) {
      offerTitle = fk === "prePurchase" ? "By product" : fk === "scarcity" ? "By message" : "By offer";
      const offerRows = fk === "prePurchase" ? rows.filter((r) => r.dim === "item") : rows;
      const map = new Map<string, BreakdownRow>();
      const get = (id: string) => {
        let b = map.get(id);
        if (!b) {
          const name =
            fk === "scarcity"
              ? input.messageNames?.[id] || `Message ${Number(id) + 1}`
              : input.offerNames[id] || (id ? "Deleted offer" : "Untagged");
          b = { id, name, views: 0, clicks: 0, actions: 0, dismissals: 0, revenue: 0, orders: 0 };
          map.set(id, b);
        }
        return b;
      };
      for (const r of offerRows) {
        const b = get(r.offerId);
        b.views += r.impressions;
        b.clicks += r.clicks;
        b.actions += r.actions;
        b.dismissals += r.dismissals;
      }
      for (const [id, v] of a.byOffer) {
        const b = get(id);
        b.revenue = r2(b.revenue + v.rev);
        b.orders += v.orders;
      }
      offers.push(...[...map.values()].sort((x, y) => y.revenue - x.revenue || y.actions - x.actions || y.views - x.views));
    }

    // Dimension breakdown
    let dims: FeatureDetail["dims"] = null;
    const byDim = (metric: "impressions" | "clicks" | "actions", filter: (r: StatRow) => boolean = () => true) => {
      const m = new Map<string, number>();
      for (const r of rows.filter(filter)) m.set(r.dim, (m.get(r.dim) || 0) + r[metric]);
      return m;
    };
    if (fk === "quantityBreaks") {
      const m = byDim("actions");
      const total = sum([...m.values()]);
      dims = {
        title: "Tier mix: units chosen at add to cart",
        valueLabel: "adds",
        rows: [...m.entries()]
          .filter(([d]) => d)
          .sort((x, y) => Number(x[0]) - Number(y[0]))
          .map(([d, v]) => ({
            label: `${d} unit${d === "1" ? "" : "s"}`,
            value: v,
            sub: total ? `${Math.round((v / total) * 100)}%` : undefined,
          })),
      };
    } else if (fk === "shippingBar") {
      const m = byDim("actions");
      dims = {
        title: "Sessions reaching each reward",
        valueLabel: "sessions",
        rows: [...m.entries()]
          .filter(([d]) => d.startsWith("tier"))
          .sort((x, y) => x[0].localeCompare(y[0], undefined, { numeric: true }))
          .map(([d, v]) => ({ label: `Reward ${d.replace("tier", "")}`, value: v })),
      };
    } else if (fk === "socialBar") {
      const m = byDim("actions");
      const names: Record<string, string> = {
        whatsapp: "WhatsApp chat",
        whatsapp_quick: "WhatsApp quick question",
        instagram: "Instagram",
        tiktok: "TikTok",
        facebook: "Facebook",
        x: "X (Twitter)",
        pinterest: "Pinterest",
        youtube: "YouTube",
        linkedin: "LinkedIn",
        snapchat: "Snapchat",
        telegram: "Telegram",
        threads: "Threads",
        discord: "Discord",
        reddit: "Reddit",
        twitch: "Twitch",
        vip: "VIP community",
        other: "Other link",
      };
      dims = {
        title: "Channels shoppers picked",
        valueLabel: "clicks",
        rows: [...m.entries()].filter(([d]) => d).sort((x, y) => y[1] - x[1]).map(([d, v]) => ({ label: names[d] || d, value: v })),
      };
    } else if (fk === "productScarcity") {
      const views = byDim("impressions");
      const acts = byDim("actions");
      dims = {
        title: "Design presets: views and adds to cart",
        valueLabel: "views",
        rows: [...views.entries()].sort((x, y) => y[1] - x[1]).map(([d, v]) => ({
          label: (d || "unknown").replace(/_/g, " "),
          value: v,
          sub: `${acts.get(d) || 0} added`,
        })),
      };
    } else if (fk === "exitIntent") {
      const m = byDim("clicks");
      dims = {
        title: "What shoppers clicked",
        valueLabel: "clicks",
        rows: [...m.entries()].filter(([d]) => d).map(([d, v]) => ({ label: d === "checkout" ? "Claim & checkout" : "Copied code", value: v })),
      };
    }

    // Device split
    const devices = { m: { views: 0, actions: 0 }, d: { views: 0, actions: 0 } };
    for (const dev of ["m", "d"] as const) {
      const s = summarize(fk, rows.filter((r) => r.device === dev));
      devices[dev] = { views: s.views, actions: s.actions };
    }

    // Shipping threshold analysis (from real orders)
    let shipping: FeatureDetail["shipping"] = null;
    if (fk === "shippingBar" && input.shippingTiers && input.shippingTiers.length > 0 && curOrders.length > 0) {
      const threshold = Math.min(...input.shippingTiers.filter((t) => t > 0));
      const subs = curOrders.map((o) => o.subtotal);
      const aov = sum(subs) / subs.length;
      shipping = {
        aov: r2(aov),
        threshold,
        reachedPct: Math.round((subs.filter((s) => s >= threshold).length / subs.length) * 100),
        nearMissPct: Math.round((subs.filter((s) => s < threshold && s >= threshold * 0.8).length / subs.length) * 100),
        suggested: Math.round((aov * 1.3) / 5) * 5,
        ordersCounted: subs.length,
      };
    }

    let exitIntent: FeatureDetail["exitIntent"] = null;
    if (fk === "exitIntent") exitIntent = { redemptions: a.orders, recovered: r2(a.rev) };

    feature = {
      ...base,
      prev: { views: prevS.views, actions: prevS.actions, directRevenue: r2(prevRev) },
      dailyMetric: earnsRevenue ? "revenue" : "views",
      daily,
      offers,
      offerTitle,
      dims,
      devices,
      shipping,
      exitIntent,
    };
  }

  return { rangeDays, days, overview, feature };
}
