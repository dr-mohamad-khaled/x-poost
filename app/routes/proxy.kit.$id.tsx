import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import KIT_JS from "../../extensions/xpoost-storefront/assets/xpoost-kit.js?raw";
import KIT_CSS from "../../extensions/xpoost-storefront/assets/xpoost-kit.css?raw";
import TRACK_JS from "../../extensions/xpoost-storefront/assets/xpoost-track.js?raw";

/**
 * Kit landing page — /apps/xpoost/kit/<kitId> on the merchant's store.
 * Answers with Liquid, so Shopify renders it inside the store's own theme (header, footer, fonts).
 */

const liquid = (body: string) => new Response(body, { status: 200, headers: { "Content-Type": "application/liquid", "Cache-Control": "no-store" } });
const raw = (s: string) => "{% raw %}" + s.replace(/\{%-?\s*endraw\s*-?%\}/g, "") + "{% endraw %}";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const id = String(params.id || "").trim();
  try {
    const { session } = await authenticate.public.appProxy(request);
    const shopDomain = session?.shop || new URL(request.url).searchParams.get("shop");
    if (!shopDomain || !/^[A-Za-z0-9_-]{4,40}$/.test(id)) return liquid("<p style=\"text-align:center;padding:60px 16px\">Not found</p>");
    const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true, kitsEnabled: true } });
    const kit = shop ? await prisma.kit.findFirst({ where: { id, shopId: shop.id }, select: { id: true } }) : null;
    if (!shop || !shop.kitsEnabled || !kit) return liquid("<p style=\"text-align:center;padding:60px 16px\">This page isn't available right now.</p>");
    return liquid(`
<style>${raw(KIT_CSS)}</style>
<div class="page-width" style="padding-top:28px;padding-bottom:40px">
  <div
    data-xpk-root
    data-landing="1"
    data-kit-id="${id}"
    data-proxy="/apps/xpoost/kits"
    data-locale="{{ request.locale.iso_code }}"
    data-country="{{ localization.country.iso_code }}"
    data-market="{{ localization.market.handle }}"
    data-currency="{{ cart.currency.iso_code }}"
    data-money-format="{{ shop.money_format | escape }}"
    hidden
  ></div>
</div>
<script>${raw(TRACK_JS.replace(/<\/script/gi, "<\\/script"))}</script>
<script>${raw(KIT_JS.replace(/<\/script/gi, "<\\/script"))}</script>
`);
  } catch (err) {
    if (err instanceof Response) return liquid("");
    console.warn("[xpoost-kits] landing failed:", err);
    return liquid("");
  }
};
