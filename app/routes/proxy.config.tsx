import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  const emptyResponse = () =>
    new Response(
      JSON.stringify({
        active: false,
        features: {},
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
      }
    );

  const url = new URL(request.url);
  const shopDomain =
    session?.shop ||
    url.searchParams.get("shop") ||
    request.headers.get("x-shop-domain");

  let shop = null;
  const include = {
    scarcityConfig: true,
    upsellRules: { where: { active: true } },
    socialConfig: true,
    shippingConfig: true,
    exitIntentConfig: true,
    upsellStyleConfig: true,
  };

  if (shopDomain) {
    shop = await prisma.shop.findUnique({
      where: { shopDomain },
      include,
    });
  }
  if (!shop) {
    shop = await prisma.shop.findFirst({ include });
  }

  if (!shop) return emptyResponse();

  // Scarcity Config
  let scarcity = null;
  if (shop.scarcityEnabled && shop.scarcityConfig?.active) {
    let messages = [];
    try {
      messages = JSON.parse(shop.scarcityConfig.messagesJson);
    } catch {
      messages = [];
    }
    scarcity = {
      active: true,
      showOn: shop.scarcityConfig.showOn,
      position: shop.scarcityConfig.position,
      onsetDelayMs: shop.scarcityConfig.onsetDelayMs,
      displayDurationMs: shop.scarcityConfig.displayDurationMs,
      intervalDelayMs: shop.scarcityConfig.intervalDelayMs,
      desktopBottomOffsetPx: shop.scarcityConfig.desktopBottomOffsetPx,
      mobileBottomOffsetPx: shop.scarcityConfig.mobileBottomOffsetPx,
      backgroundColor: shop.scarcityConfig.backgroundColor,
      accentColor: shop.scarcityConfig.accentColor,
      textColor: shop.scarcityConfig.textColor,
      borderRadiusPx: shop.scarcityConfig.borderRadiusPx,
      showCloseButton: shop.scarcityConfig.showCloseButton,
      showProgressBar: shop.scarcityConfig.showProgressBar,
      pauseOnHover: shop.scarcityConfig.pauseOnHover,
      messages,
    };
  }

  // Pre-Purchase Upsell Rules
  let prePurchase = null;
  if (shop.prePurchaseEnabled) {
    const preRules = shop.upsellRules.filter((r) => r.type === "PRE_PURCHASE");
    if (preRules.length > 0) {
      prePurchase = {
        active: true,
        backgroundColor: shop.upsellStyleConfig?.prePurchaseBg || "#0B0B0B",
        accentColor: shop.upsellStyleConfig?.prePurchaseAccent || "#D4AF37",
        textColor: shop.upsellStyleConfig?.prePurchaseText || "#FFFFFF",
        rules: preRules.map((r) => {
          const preselected = !r.offerDescription?.includes("<!--xp:preselect:false-->");
          const layoutMatch = (r.offerDescription || "").match(/<!--xp:layout:([a-z_]+)-->/);
          const layoutStyle = layoutMatch ? layoutMatch[1] : "spotlight_hero";

          const f1Match = (r.offerDescription || "").match(/<!--xp:f1:([^>]+)-->/);
          const f2Match = (r.offerDescription || "").match(/<!--xp:f2:([^>]+)-->/);
          const f3Match = (r.offerDescription || "").match(/<!--xp:f3:([^>]+)-->/);
          const f1 = f1Match ? decodeURIComponent(f1Match[1].trim()) : "Recommended addition to your selection";
          const f2 = f2Match ? decodeURIComponent(f2Match[1].trim()) : "Premium dermatologically evaluated formula";
          const f3 = f3Match ? decodeURIComponent(f3Match[1].trim()) : "Exclusive single-order promotion price";

          const hMatch = (r.offerDescription || "").match(/<!--xp:h:([^>]+)-->/);
          const targetProductHandle = hMatch ? decodeURIComponent(hMatch[1].trim()) : "";

          const cleanDesc = (r.offerDescription || "")
            .replace(/<!--xp:layout:[a-z_]+-->/g, "")
            .replace(/<!--xp:preselect:false-->/g, "")
            .replace(/<!--xp:f1:[^>]+-->/g, "")
            .replace(/<!--xp:f2:[^>]+-->/g, "")
            .replace(/<!--xp:f3:[^>]+-->/g, "")
            .replace(/<!--xp:h:[^>]+-->/g, "")
            .trim();
          return {
            id: r.id,
            triggerProductId: r.triggerProductId,
            targetProductId: r.targetProductId,
            targetProductTitle: r.targetProductTitle,
            targetProductHandle: targetProductHandle,
            targetVariantId: r.targetVariantId,
            targetProductPrice: r.targetProductPrice,
            targetProductImage: r.targetProductImage,
            offerHeadline: r.offerHeadline,
            offerDescription: cleanDesc,
            discountPercent: r.discountPercent,
            discountCode: r.discountCode,
            preselected: preselected,
            layoutStyle: layoutStyle,
            features: [f1, f2, f3],
          };
        }),
      };
    }
  }

  // In-Cart Drawer Rules
  let inCart = null;
  if (shop.inCartUpsellEnabled) {
    const inCartRules = shop.upsellRules.filter((r) => r.type === "IN_CART");
    if (inCartRules.length > 0) {
      inCart = {
        active: true,
        backgroundColor: shop.upsellStyleConfig?.inCartBg || "#0B0B0B",
        accentColor: shop.upsellStyleConfig?.inCartAccent || "#D4AF37",
        textColor: shop.upsellStyleConfig?.inCartText || "#FFFFFF",
        rules: inCartRules.map((r) => {
          const hMatch = (r.offerDescription || "").match(/<!--xp:h:([^>]+)-->/);
          const targetProductHandle = hMatch ? decodeURIComponent(hMatch[1].trim()) : "";
          const cleanDesc = (r.offerDescription || "")
            .replace(/<!--xp:h:[^>]+-->/g, "")
            .trim();
          return {
            id: r.id,
            triggerProductId: r.triggerProductId,
            targetProductId: r.targetProductId,
            targetProductTitle: r.targetProductTitle,
            targetProductHandle: targetProductHandle,
            targetVariantId: r.targetVariantId,
            targetProductPrice: r.targetProductPrice,
            targetProductImage: r.targetProductImage,
            offerHeadline: r.offerHeadline,
            offerDescription: cleanDesc,
            discountPercent: r.discountPercent,
            discountCode: r.discountCode,
          };
        }),
      };
    }
  }

function parseSocialPosition(rawPos: string | null | undefined) {
  let side = "bottom-right";
  let bottomOffsetPx = 24;
  let mobileBottomOffsetPx = 24;
  let designTheme = "gold_luxury";
  let layoutStyle = "action_stack";

  if (rawPos) {
    if (rawPos.startsWith("{")) {
      try {
        const parsed = JSON.parse(rawPos);
        if (parsed.side) side = parsed.side;
        if (typeof parsed.bottomOffsetPx === "number" || typeof parsed.bottomOffsetPx === "string") {
          const b = parseInt(String(parsed.bottomOffsetPx), 10);
          if (!isNaN(b)) bottomOffsetPx = b;
        }
        if (typeof parsed.mobileBottomOffsetPx === "number" || typeof parsed.mobileBottomOffsetPx === "string") {
          const m = parseInt(String(parsed.mobileBottomOffsetPx), 10);
          if (!isNaN(m)) mobileBottomOffsetPx = m;
        }
        if (parsed.designTheme) designTheme = parsed.designTheme;
        if (parsed.layoutStyle) layoutStyle = parsed.layoutStyle;
      } catch {
        side = rawPos;
      }
    } else {
      side = rawPos;
    }
  }

  return { side, bottomOffsetPx, mobileBottomOffsetPx, designTheme, layoutStyle };
}

  // Social & Support Bar
  let social = null;
  if (shop.socialBarEnabled && shop.socialConfig?.active) {
    const posDetails = parseSocialPosition(shop.socialConfig.position);
    social = {
      active: true,
      position: posDetails.side,
      bottomOffsetPx: posDetails.bottomOffsetPx,
      mobileBottomOffsetPx: posDetails.mobileBottomOffsetPx,
      designTheme: posDetails.designTheme,
      layoutStyle: posDetails.layoutStyle,
      badgeText: shop.socialConfig.badgeText,
      whatsappNumber: shop.socialConfig.whatsappNumber,
      whatsappMessage: shop.socialConfig.whatsappMessage,
      instagramUrl: shop.socialConfig.instagramUrl,
      facebookUrl: shop.socialConfig.facebookUrl,
      tiktokUrl: shop.socialConfig.tiktokUrl,
      vipCommunityLabel: shop.socialConfig.vipCommunityLabel,
      vipCommunityUrl: shop.socialConfig.vipCommunityUrl,
      backgroundColor: shop.socialConfig.backgroundColor,
      accentColor: shop.socialConfig.accentColor,
      textColor: shop.socialConfig.textColor,
    };
  }

  // Smart Tiered Shipping Bar
  let shipping = null;
  if (shop.shippingBarEnabled && shop.shippingConfig?.active) {
    let tiers = [];
    let layoutStyle = "milestone_stepper";
    try {
      const parsed = JSON.parse(shop.shippingConfig.tiersJson);
      if (Array.isArray(parsed)) {
        tiers = parsed;
      } else if (parsed && Array.isArray(parsed.tiers)) {
        tiers = parsed.tiers;
        if (parsed.layoutStyle) layoutStyle = parsed.layoutStyle;
      }
    } catch {
      tiers = [];
    }
    shipping = {
      active: true,
      layoutStyle,
      currency: shop.shippingConfig.currency,
      currencySymbol: shop.shippingConfig.currencySymbol,
      tiers,
      progressColor: shop.shippingConfig.progressColor,
      trackColor: shop.shippingConfig.trackColor,
      backgroundColor: shop.shippingConfig.backgroundColor,
      textColor: shop.shippingConfig.textColor,
      initialMessage: shop.shippingConfig.initialMessage,
      allUnlockedMessage: shop.shippingConfig.allUnlockedMessage,
    };
  }

  // Exit-Intent Saver Modal
  let exitIntent = null;
  if (shop.exitIntentEnabled && shop.exitIntentConfig?.active) {
    exitIntent = {
      active: true,
      countdownSeconds: shop.exitIntentConfig.countdownSeconds,
      discountCode: shop.exitIntentConfig.discountCode,
      headline: shop.exitIntentConfig.headline,
      bodyText: shop.exitIntentConfig.bodyText,
      buttonText: shop.exitIntentConfig.buttonText,
      suppressionDays: shop.exitIntentConfig.suppressionDays,
      backgroundColor: shop.exitIntentConfig.backgroundColor,
      accentColor: shop.exitIntentConfig.accentColor,
      textColor: shop.exitIntentConfig.textColor,
    };
  }

  return new Response(
    JSON.stringify({
      active: true,
      shop: session?.shop || shop.shopDomain,
      features: {
        scarcity,
        prePurchase,
        inCart,
        social,
        shipping,
        exitIntent,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
    }
  );
};
