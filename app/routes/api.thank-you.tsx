import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { recordThankYouEvent, resolveThankYou, sampleThankYou } from "../thankyou.server";

/**
 * API used by the XPoost thank-you checkout extension.
 * Authenticated with the checkout session token (JWT signed by Shopify), so only a real checkout can call it.
 *
 *   POST { intent: "resolve", orderId, locale, firstName, country, isFirstOrder }  → render payload
 *   POST { intent: "sample", locale }                                              → sample payload (checkout editor)
 *   POST { intent: "event", offerId, event: "view"|"click"|"action"|"dismiss", dim } → analytics
 */

// Tiny per-process limiter: a refresh storm on one order shouldn't hammer the Admin API
const hits = new Map<string, { n: number; reset: number }>();
function limited(key: string, max = 40, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  h.n += 1;
  return h.n > max;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Answers the CORS preflight; there is nothing to GET.
  const { cors } = await authenticate.public.checkout(request);
  return cors(new Response(null, { status: 204 }));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);
  const reply = (body: unknown, status = 200) => cors(Response.json(body, { status, headers: { "Cache-Control": "no-store" } }));

  let shopDomain = "";
  try {
    shopDomain = new URL(sessionToken.dest).host;
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

    if (intent === "resolve") {
      if (limited(`${shopDomain}|${body?.orderId}`)) return reply({ show: false }, 429);
      const payload = await resolveThankYou({
        shopDomain,
        orderId: String(body?.orderId || ""),
        locale: typeof body?.locale === "string" ? body.locale.slice(0, 12) : undefined,
        firstName: typeof body?.firstName === "string" ? body.firstName.slice(0, 40) : undefined,
        country: typeof body?.country === "string" ? body.country.slice(0, 2) : undefined,
        isFirstOrder: typeof body?.isFirstOrder === "boolean" ? body.isFirstOrder : null,
      });
      return reply(payload);
    }

    if (intent === "sample") {
      if (limited(`${shopDomain}|sample`, 20)) return reply({ show: false }, 429);
      return reply(await sampleThankYou(shopDomain, typeof body?.locale === "string" ? body.locale.slice(0, 12) : undefined));
    }

    if (intent === "event") {
      const event = String(body?.event || "");
      if (!["view", "click", "action", "dismiss"].includes(event)) return reply({ ok: false }, 400);
      const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true, analyticsTimezone: true } });
      if (!shop) return reply({ ok: false });
      const offerId = String(body?.offerId || "").slice(0, 40);
      const offer = await prisma.tyOffer.findFirst({ where: { id: offerId, shopId: shop.id }, select: { id: true } });
      if (!offer) return reply({ ok: false });
      await recordThankYouEvent(shop, offer.id, event as any, String(body?.dim || ""));
      return reply({ ok: true });
    }
  } catch (err: any) {
    console.error("[XPoost thank-you api] failed:", err?.stack || err);
    // The message is only used by the checkout editor preview, so the merchant can see what is wrong.
    return reply({ show: false, error: String(err?.message || err).slice(0, 240) });
  }
  return reply({ show: false });
};
