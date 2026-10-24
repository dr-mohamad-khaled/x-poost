import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { popupOn } from "../utils/product-popup";
import { loadBundles, localDate, lookupCustomer, needsCustomer, storefrontBundles } from "../bundles.server";

/**
 * Storefront Bundle Builder config — reached through the app proxy at /apps/xpoost/bundles.
 * Only bundles this shopper may see are returned (customer rules are checked here with the
 * signed logged_in_customer_id, and again at checkout by the Shopify Function).
 */

const json = (body: unknown, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Personal results (customer rules) must never be shared between shoppers by a cache
      "Cache-Control": maxAge ? `private, max-age=${maxAge}` : "no-store",
    },
  });

const LANGS = ["en", "ar", "fr", "de", "es", "it", "pt"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const shopDomain = session?.shop || url.searchParams.get("shop");
    if (!shopDomain) return json({ bundles: [] });

    const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true, bundlesEnabled: true, analyticsTimezone: true, productPopupJson: true } });
    if (!shop || !shop.bundlesEnabled) return json({ bundles: [] });

    let bundles = await loadBundles(shop.id);
    const only = (url.searchParams.get("bundle") || "").trim();
    bundles = bundles.filter((b) => b.enabled && (!only || b.id === only));
    if (!bundles.length) return json({ bundles: [] });

    // Signed by Shopify on app-proxy requests; empty for guests
    const customerId = url.searchParams.get("logged_in_customer_id") || "";
    const wantsCustomer = !!customerId && bundles.some((b) => needsCustomer(b.conditions));
    const customer = wantsCustomer ? await lookupCustomer(admin as any, shopDomain, customerId) : null;

    const country = (url.searchParams.get("country") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    const market = (url.searchParams.get("market") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
    const rawLang = (url.searchParams.get("locale") || "en").split("-")[0].toLowerCase();
    const lang = LANGS.includes(rawLang) ? rawLang : "en";

    const list = await storefrontBundles(
      admin as any,
      shopDomain,
      bundles,
      {
        loggedIn: !!customerId,
        orders: customer?.orders || 0,
        spent: customer?.spent || 0,
        tags: new Set((customer?.tags || []).map((t) => t.toLowerCase())),
        country,
        market,
        today: localDate(shop.analyticsTimezone),
      },
      lang,
    );
    return json({ bundles: list, productPopup: popupOn(shop.productPopupJson, "bundles") });
  } catch (err) {
    if (err instanceof Response) return json({ bundles: [] });
    console.warn("[xpoost-bundles] proxy failed:", err);
    return json({ bundles: [] });
  }
};
