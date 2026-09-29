import { Prisma } from "@prisma/client";
import prisma from "./db.server";
import {
  attributeOrder,
  localDay,
  dayToDate,
  normalizeGraphqlOrder,
  type NormalizedOrder,
  type ParsedBatch,
} from "./utils/analytics";

type AdminGraphql = { graphql: (query: string, options?: any) => Promise<Response> };

const INFLUENCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// Storefront events
// ─────────────────────────────────────────────────────────────

export async function recordEvents(shopId: string, timeZone: string | null | undefined, batch: ParsedBatch) {
  if (batch.increments.length === 0) return;
  const day = localDay(Date.now(), timeZone);

  const rows = batch.increments.map(
    (r) =>
      Prisma.sql`(${shopId}, ${day}::date, ${r.feature}, ${r.offerId}, ${r.dim}, ${r.device}, ${r.impressions}, ${r.clicks}, ${r.actions}, ${r.dismissals}, ${r.value})`,
  );

  await prisma.$executeRaw`
    INSERT INTO "XpDailyStat" ("shopId", "day", "feature", "offerId", "dim", "device", "impressions", "clicks", "actions", "dismissals", "value")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("shopId", "day", "feature", "offerId", "dim", "device") DO UPDATE SET
      "impressions" = "XpDailyStat"."impressions" + EXCLUDED."impressions",
      "clicks"      = "XpDailyStat"."clicks" + EXCLUDED."clicks",
      "actions"     = "XpDailyStat"."actions" + EXCLUDED."actions",
      "dismissals"  = "XpDailyStat"."dismissals" + EXCLUDED."dismissals",
      "value"       = "XpDailyStat"."value" + EXCLUDED."value"
  `;

  if (batch.visitorId && batch.exposedFeatures.length > 0) {
    const exp = batch.exposedFeatures.map(
      (f) => Prisma.sql`(${shopId}, ${batch.visitorId}, ${f}, NOW(), NOW())`,
    );
    await prisma.$executeRaw`
      INSERT INTO "XpExposure" ("shopId", "visitorId", "feature", "firstSeen", "lastSeen")
      VALUES ${Prisma.join(exp)}
      ON CONFLICT ("shopId", "visitorId", "feature") DO UPDATE SET "lastSeen" = NOW()
    `;
  }

  // Light housekeeping: roughly 1 in 500 batches trims exposures older than 30 days
  if (Math.random() < 0.002) {
    prisma.xpExposure
      .deleteMany({ where: { shopId, lastSeen: { lt: new Date(Date.now() - 30 * 86400000) } } })
      .catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────

export async function saveOrder(
  shop: { id: string; analyticsTimezone?: string | null },
  order: NormalizedOrder,
  source: "webhook" | "backfill",
) {
  const exitCfg = await prisma.exitIntentConfig.findUnique({
    where: { shopId: shop.id },
    select: { discountCode: true },
  });
  const attributed = attributeOrder(order, { exitIntentCode: exitCfg?.discountCode });

  let influenced: string[] = [];
  if (attributed.visitorId) {
    const exposures = await prisma.xpExposure.findMany({
      where: {
        shopId: shop.id,
        visitorId: attributed.visitorId,
        lastSeen: { gte: new Date(order.createdAt.getTime() - INFLUENCE_WINDOW_MS) },
        firstSeen: { lte: order.createdAt },
      },
      select: { feature: true },
    });
    influenced = exposures.map((e) => e.feature);
  }
  // A feature that directly produced revenue also influenced the order
  for (const s of attributed.sources) {
    if (s.f !== "upsellLegacy" && !influenced.includes(s.f)) influenced.push(s.f);
  }

  const data = {
    shopId: shop.id,
    orderName: order.name,
    createdAt: order.createdAt,
    day: dayToDate(localDay(order.createdAt, shop.analyticsTimezone)),
    currency: order.currency,
    subtotal: order.subtotal,
    total: order.total,
    directRevenue: attributed.directRevenue,
    discountCost: attributed.discountCost,
    sourcesJson: JSON.stringify(attributed.sources),
    influencedJson: JSON.stringify(influenced),
    visitorId: attributed.visitorId,
    cancelled: order.cancelled,
    source,
  };

  await prisma.xpOrder.upsert({
    where: { id: order.id },
    create: { id: order.id, ...data },
    // A backfill never overwrites a row the webhook already wrote (the webhook knows the visitor)
    update: source === "backfill" ? { cancelled: order.cancelled } : data,
  });
}

export async function markOrderCancelled(shopId: string, orderGid: string) {
  await prisma.xpOrder.updateMany({ where: { id: orderGid, shopId }, data: { cancelled: true } });
}

// ─────────────────────────────────────────────────────────────
// Shop metadata + 60-day backfill
// ─────────────────────────────────────────────────────────────

export async function ensureAnalyticsMeta(admin: AdminGraphql, shop: { id: string; analyticsTimezone: string | null; analyticsCurrency: string | null }) {
  if (shop.analyticsTimezone && shop.analyticsCurrency) return shop;
  try {
    const res = await admin.graphql(`#graphql
      query XpShopMeta { shop { ianaTimezone currencyCode } }`);
    const json: any = await res.json();
    const tz = json?.data?.shop?.ianaTimezone || "UTC";
    const cur = json?.data?.shop?.currencyCode || "USD";
    await prisma.shop.update({ where: { id: shop.id }, data: { analyticsTimezone: tz, analyticsCurrency: cur } });
    return { ...shop, analyticsTimezone: tz, analyticsCurrency: cur };
  } catch (err) {
    console.warn("[XPoost analytics] shop meta lookup failed:", err);
    return shop;
  }
}

const ORDER_FIELDS = `
  id
  name
  createdAt
  cancelledAt
  currencyCode
  subtotalPriceSet { shopMoney { amount currencyCode } }
  totalPriceSet { shopMoney { amount currencyCode } }
  customAttributes { key value }
  discountCodes
  lineItems(first: 50) {
    nodes {
      title
      quantity
      originalUnitPriceSet { shopMoney { amount } }
      discountAllocations { allocatedAmountSet { shopMoney { amount } } }
      customAttributes { key value }
    }
  }
`;

const runningBackfills = new Set<string>();

/**
 * Import the last 60 days of orders (the window read_orders allows) so the dashboard
 * has history and a before-XPoost baseline. Runs once per shop, in the background.
 */
export function startBackfill(
  admin: AdminGraphql,
  shop: { id: string; shopDomain: string; analyticsTimezone: string | null; analyticsBackfilledAt: Date | null },
) {
  if (shop.analyticsBackfilledAt || runningBackfills.has(shop.id)) return false;
  runningBackfills.add(shop.id);

  (async () => {
    const since = new Date(Date.now() - 60 * 86400000).toISOString();
    let cursor: string | null = null;
    let pages = 0;
    try {
      do {
        const res = await admin.graphql(
          `#graphql
          query XpBackfillOrders($cursor: String, $query: String) {
            orders(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT) {
              pageInfo { hasNextPage endCursor }
              nodes { ${ORDER_FIELDS} }
            }
          }`,
          { variables: { cursor, query: `created_at:>=${since}` } },
        );
        const json: any = await res.json();
        if (json?.errors?.length) throw new Error(JSON.stringify(json.errors).slice(0, 400));
        const conn = json?.data?.orders;
        for (const node of conn?.nodes || []) {
          await saveOrder(shop, normalizeGraphqlOrder(node), "backfill");
        }
        cursor = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
        pages += 1;
      } while (cursor && pages < 50);

      await prisma.shop.update({ where: { id: shop.id }, data: { analyticsBackfilledAt: new Date() } });
      console.log(`[XPoost analytics] backfill done for ${shop.shopDomain} (${pages} page(s))`);
    } catch (err) {
      console.error(`[XPoost analytics] backfill failed for ${shop.shopDomain}:`, err);
    } finally {
      runningBackfills.delete(shop.id);
    }
  })();

  return true;
}

export function isBackfillRunning(shopId: string) {
  return runningBackfills.has(shopId);
}
