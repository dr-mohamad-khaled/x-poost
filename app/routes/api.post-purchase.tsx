import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { recordThankYouEvent } from "../thankyou.server";
import { selectPostPurchaseOffer, signPostPurchaseChangeset } from "../postpurchase.server";

/**
 * API for the XPoost post-purchase extension (optional, needs Shopify's post-purchase beta access).
 *   POST { intent: "offer", referenceId, locale, subtotal, currency, itemCount, productIds, variantIds, country } → offer payload
 *   POST { intent: "sign",  referenceId, offerId, variantIds, discountTitle }                                    → { token }
 *   POST { intent: "event", offerId, event, dim }
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { cors } = await authenticate.public.checkout(request);
  return cors(new Response(null, { status: 204 }));
};

const strArr = (v: unknown, max = 60) => (Array.isArray(v) ? v.slice(0, max).map((x) => String(x).slice(0, 80)) : []);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const action = async ({ request }: ActionFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);
  const reply = (body: unknown, status = 200) => cors(Response.json(body, { status, headers: { "Cache-Control": "no-store" } }));
  let shopDomain = "";
  try {
    const dest = String(sessionToken.dest || "");
    shopDomain = (/^https?:\/\//i.test(dest) ? new URL(dest).host : dest.replace(/\/.*$/, "")).toLowerCase();
    if (!shopDomain) throw new Error("empty dest");
  } catch {
    return reply({ show: false }, 400);
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return reply({ show: false }, 400);
  }

  try {
    const intent = String(body?.intent || "");
    if (intent === "offer") {
      const found = await selectPostPurchaseOffer({
        shopDomain,
        referenceId: String(body?.referenceId || ""),
        locale: typeof body?.locale === "string" ? body.locale.slice(0, 12) : undefined,
        subtotal: num(body?.subtotal),
        currency: String(body?.currency || "USD").slice(0, 3),
        itemCount: Math.round(num(body?.itemCount)),
        productIds: strArr(body?.productIds),
        variantIds: strArr(body?.variantIds),
        country: typeof body?.country === "string" ? body.country.slice(0, 2) : undefined,
      });
      return reply(found ? found.payload : { show: false });
    }
    if (intent === "sign") {
      const token = await signPostPurchaseChangeset({
        shopDomain,
        referenceId: String(body?.referenceId || ""),
        offerId: String(body?.offerId || "").slice(0, 40),
        variantIds: strArr(body?.variantIds, 4),
        discountTitle: String(body?.discountTitle || "Special offer"),
      });
      return token ? reply({ token }) : reply({ token: null }, 400);
    }
    if (intent === "event") {
      const event = String(body?.event || "");
      if (!["view", "click", "action", "dismiss"].includes(event)) return reply({ ok: false }, 400);
      const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true, analyticsTimezone: true } });
      const offer = shop && (await prisma.tyOffer.findFirst({ where: { id: String(body?.offerId || ""), shopId: shop.id }, select: { id: true } }));
      if (!shop || !offer) return reply({ ok: false });
      await recordThankYouEvent(shop, offer.id, event as any, `pp:${String(body?.dim || "")}`.slice(0, 40));
      return reply({ ok: true });
    }
  } catch (err) {
    console.error("[XPoost post-purchase api] failed:", err);
  }
  return reply({ show: false });
};
