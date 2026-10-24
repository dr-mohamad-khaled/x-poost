import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { popupOn } from "../utils/product-popup";
import { localDate, lookupCustomer, needsCustomer } from "../bundles.server";
import { loadKits, storefrontKits } from "../kits.server";

/**
 * Storefront Kit Builder config — reached through the app proxy at /apps/xpoost/kits.
 * Only kits this shopper may see are returned (customer rules are checked here with the
 * signed logged_in_customer_id, and again at checkout by the Shopify Function).
 */

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const LANGS = ["en", "ar", "fr", "de", "es", "it", "pt"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const shopDomain = session?.shop || url.searchParams.get("shop");
    if (!shopDomain) return json({ kits: [] });

    const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true, kitsEnabled: true, analyticsTimezone: true, productPopupJson: true } });
    if (!shop || !shop.kitsEnabled) return json({ kits: [] });

    const only = (url.searchParams.get("kit") || "").trim();
    const kits = (await loadKits(shop.id)).filter((k) => k.enabled && (!only || k.id === only));
    if (!kits.length) return json({ kits: [] });

    const customerId = url.searchParams.get("logged_in_customer_id") || "";
    const customer = customerId && kits.some((k) => needsCustomer(k.conditions)) ? await lookupCustomer(admin as any, shopDomain, customerId) : null;
    const rawLang = (url.searchParams.get("locale") || "en").split("-")[0].toLowerCase();
    const lang = LANGS.includes(rawLang) ? rawLang : "en";

    const list = await storefrontKits(
      admin as any,
      shopDomain,
      kits,
      {
        loggedIn: !!customerId,
        orders: customer?.orders || 0,
        spent: customer?.spent || 0,
        tags: new Set((customer?.tags || []).map((t) => t.toLowerCase())),
        country: (url.searchParams.get("country") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
        market: (url.searchParams.get("market") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80),
        today: localDate(shop.analyticsTimezone),
      },
      lang,
    );
    return json({ kits: list, productPopup: popupOn(shop.productPopupJson, "kits") });
  } catch (err) {
    if (err instanceof Response) return json({ kits: [] });
    console.warn("[xpoost-kits] proxy failed:", err);
    return json({ kits: [] });
  }
};
