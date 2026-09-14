import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Served to the storefront via Shopify App Proxy at:
//   https://{shop}/apps/xpoost/scarcity-config
// (see the [app_proxy] block in shopify.app.toml)
//
// authenticate.public.appProxy verifies Shopify's HMAC signature on the
// request and resolves which shop it came from — no admin session needed.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  const inactive = () =>
    new Response(JSON.stringify({ active: false }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
    });

  const url = new URL(request.url);
  const shopDomain =
    session?.shop ||
    url.searchParams.get("shop") ||
    request.headers.get("x-shop-domain");

  let shop = null;
  if (shopDomain) {
    shop = await prisma.shop.findUnique({ where: { shopDomain } });
  }
  if (!shop) {
    shop = await prisma.shop.findFirst();
  }
  if (!shop) return inactive();

  const config = await prisma.scarcityWidgetConfig.findUnique({ where: { shopId: shop.id } });
  if (!config || !config.active) return inactive();

  let messages: unknown = [];
  try {
    messages = JSON.parse(config.messagesJson);
  } catch {
    messages = [];
  }

  const translationConfig = await prisma.translationConfig.findUnique({ where: { shopId: shop.id } });
  const rawLocale = (url.searchParams.get("locale") || request.headers.get("x-storefront-locale") || translationConfig?.storefrontLocale || "en").split("-")[0].toLowerCase();
  const validLocales = ["ar", "en", "fr", "de", "es", "it", "pt"];
  const storefrontLocale = validLocales.includes(rawLocale) ? rawLocale : "en";
  const isRtl = storefrontLocale === "ar";

  return new Response(
    JSON.stringify({
      active: true,
      locale: storefrontLocale,
      isRtl,
      showOn: config.showOn,
      position: config.position,
      onsetDelayMs: config.onsetDelayMs,
      displayDurationMs: config.displayDurationMs,
      intervalDelayMs: config.intervalDelayMs,
      desktopBottomOffsetPx: config.desktopBottomOffsetPx,
      mobileBottomOffsetPx: config.mobileBottomOffsetPx,
      backgroundColor: config.backgroundColor,
      accentColor: config.accentColor,
      textColor: config.textColor,
      borderRadiusPx: config.borderRadiusPx,
      showCloseButton: config.showCloseButton,
      showProgressBar: config.showProgressBar,
      pauseOnHover: config.pauseOnHover,
      messages,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
    },
  );
};
