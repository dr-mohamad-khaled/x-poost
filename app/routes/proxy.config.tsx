import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getMergedTranslations } from "../utils/translations.server";

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
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store, must-revalidate" },
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
    productScarcityConfig: true,
    translationConfig: true,
    quantityBreaksOffers: { where: { status: "ACTIVE" } },
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

  const rawLocale = (
    url.searchParams.get("locale") ||
    request.headers.get("x-storefront-locale") ||
    shop.translationConfig?.storefrontLocale ||
    "en"
  ).split("-")[0].toLowerCase();
  const validLocales = ["ar", "en", "fr", "de", "es", "it", "pt"];
  const storefrontLocale = validLocales.includes(rawLocale) ? rawLocale : "en";
  const translations = getMergedTranslations(shop.translationConfig?.translationsJson, storefrontLocale);
  const isRtl = storefrontLocale === "ar";

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
          const rawF1 = f1Match ? decodeURIComponent(f1Match[1].trim()) : "Recommended addition to your selection";
          const rawF2 = f2Match ? decodeURIComponent(f2Match[1].trim()) : "Premium dermatologically evaluated formula";
          const rawF3 = f3Match ? decodeURIComponent(f3Match[1].trim()) : "Exclusive single-order promotion price";

          const hMatch = (r.offerDescription || "").match(/<!--xp:h:([^>]+)-->/);
          const targetProductHandle = hMatch ? decodeURIComponent(hMatch[1].trim()) : "";

          const i18nMatch = (r.offerDescription || "").match(/<!--xp:i18n:([^>]+)-->/);
          let ruleI18n: any = null;
          if (i18nMatch) {
            try {
              ruleI18n = JSON.parse(decodeURIComponent(i18nMatch[1].trim()));
            } catch (e) {}
          }
          const localized = ruleI18n && ruleI18n[storefrontLocale] ? ruleI18n[storefrontLocale] : null;

          const cleanDesc = (r.offerDescription || "")
            .replace(/<!--xp:layout:[a-z_]+-->/g, "")
            .replace(/<!--xp:preselect:false-->/g, "")
            .replace(/<!--xp:f1:[^>]+-->/g, "")
            .replace(/<!--xp:f2:[^>]+-->/g, "")
            .replace(/<!--xp:f3:[^>]+-->/g, "")
            .replace(/<!--xp:h:[^>]+-->/g, "")
            .replace(/<!--xp:i18n:[^>]+-->/g, "")
            .trim();

          const offerHeadline = localized?.headline || r.offerHeadline;
          const offerDescription = localized?.description || cleanDesc;
          const f1 = localized?.feature1 || rawF1;
          const f2 = localized?.feature2 || rawF2;
          const f3 = localized?.feature3 || rawF3;

          return {
            id: r.id,
            triggerProductId: r.triggerProductId,
            targetProductId: r.targetProductId,
            targetProductTitle: r.targetProductTitle,
            targetProductHandle: targetProductHandle,
            targetVariantId: r.targetVariantId,
            targetProductPrice: r.targetProductPrice,
            targetProductImage: r.targetProductImage,
            offerHeadline: offerHeadline,
            offerDescription: offerDescription,
            discountPercent: r.discountPercent,
            discountCode: r.discountCode,
            preselected: preselected,
            layoutStyle: layoutStyle,
            features: [f1, f2, f3],
            offerTag: localized?.offerTag,
            acceptButton: localized?.acceptButton,
            declineButton: localized?.declineButton,
            urgencyLabel: localized?.urgencyLabel,
            scarcityNotice: localized?.scarcityNotice,
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

          const i18nMatch = (r.offerDescription || "").match(/<!--xp:i18n:([^>]+)-->/);
          let ruleI18n: any = null;
          if (i18nMatch) {
            try {
              ruleI18n = JSON.parse(decodeURIComponent(i18nMatch[1].trim()));
            } catch (e) {}
          }
          const localized = ruleI18n && ruleI18n[storefrontLocale] ? ruleI18n[storefrontLocale] : null;

          const cleanDesc = (r.offerDescription || "")
            .replace(/<!--xp:h:[^>]+-->/g, "")
            .replace(/<!--xp:i18n:[^>]+-->/g, "")
            .trim();

          const offerHeadline = localized?.headline || r.offerHeadline;
          const addButton = localized?.addButton;
          const saveBadge = localized?.saveBadge;

          return {
            id: r.id,
            triggerProductId: r.triggerProductId,
            targetProductId: r.targetProductId,
            targetProductTitle: r.targetProductTitle,
            targetProductHandle: targetProductHandle,
            targetVariantId: r.targetVariantId,
            targetProductPrice: r.targetProductPrice,
            targetProductImage: r.targetProductImage,
            offerHeadline: offerHeadline,
            offerDescription: cleanDesc,
            discountPercent: r.discountPercent,
            discountCode: r.discountCode,
            addButton: addButton,
            saveBadge: saveBadge,
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

  // Product Information Scarcity Block
  let productScarcity = null;
  if (shop.productScarcityEnabled && shop.productScarcityConfig?.active) {
    let productIds: string[] = [];
    try {
      productIds = JSON.parse(shop.productScarcityConfig.productIdsJson || "[]");
    } catch {
      productIds = [];
    }
    productScarcity = {
      active: true,
      designPreset: shop.productScarcityConfig.designPreset,
      stockSource: shop.productScarcityConfig.stockSource,
      minStock: shop.productScarcityConfig.minStock,
      maxStock: shop.productScarcityConfig.maxStock,
      lowStockThreshold: shop.productScarcityConfig.lowStockThreshold,
      headlineText: shop.productScarcityConfig.headlineText,
      subText: shop.productScarcityConfig.subText,
      accentColor: shop.productScarcityConfig.accentColor,
      backgroundColor: shop.productScarcityConfig.backgroundColor,
      textColor: shop.productScarcityConfig.textColor,
      borderColor: shop.productScarcityConfig.borderColor,
      targetMode: shop.productScarcityConfig.targetMode,
      productIds,
    };
  }


  if (productScarcity && translations?.productScarcity) {
    if (translations.productScarcity.headlineText) productScarcity.headlineText = translations.productScarcity.headlineText;
    if (translations.productScarcity.subText) productScarcity.subText = translations.productScarcity.subText;
  }
  if (exitIntent && translations?.exitIntent) {
    if (translations.exitIntent.headline) exitIntent.headline = translations.exitIntent.headline;
    if (translations.exitIntent.bodyText) exitIntent.bodyText = translations.exitIntent.bodyText;
    if (translations.exitIntent.buttonText) exitIntent.buttonText = translations.exitIntent.buttonText;
  }
  if (shipping && translations?.shippingBar) {
    if (translations.shippingBar.initialMessage) shipping.initialMessage = translations.shippingBar.initialMessage;
    if (translations.shippingBar.allUnlockedMessage) shipping.allUnlockedMessage = translations.shippingBar.allUnlockedMessage;
  }
  if (social && translations?.socialBar) {
    if (translations.socialBar.badgeText) social.badgeText = translations.socialBar.badgeText;
    if (translations.socialBar.vipCommunityLabel) social.vipCommunityLabel = translations.socialBar.vipCommunityLabel;
    if (translations.socialBar.whatsappMessage) social.whatsappMessage = translations.socialBar.whatsappMessage;
  }

  // Quantity Breaks Offers
  let quantityBreaks = null;
  if (shop.quantityBreaksEnabled && shop.quantityBreaksOffers && shop.quantityBreaksOffers.length > 0) {
    const globalQbTranslations = translations?.quantityBreaks || {};
    const offers = shop.quantityBreaksOffers.map((offer: any) => {
      let productIds: string[] = [];
      let tiers: any[] = [];
      let customTranslations: any = {};
      try {
        productIds = JSON.parse(offer.productIdsJson || "[]");
      } catch {
        productIds = [];
      }
      try {
        tiers = JSON.parse(offer.tiersJson || "[]");
      } catch {
        tiers = [];
      }
      try {
        customTranslations = JSON.parse(offer.translationsJson || "{}");
      } catch {
        customTranslations = {};
      }

      const offerLangTranslations = customTranslations[storefrontLocale] || customTranslations["en"] || {};

      return {
        id: offer.id,
        title: offer.title,
        status: offer.status,
        targetMode: offer.targetMode,
        productIds: productIds,
        discountType: offer.discountType,
        designPreset: offer.designPreset,
        animationStyle: offer.animationStyle,
        accentColor: offer.accentColor,
        backgroundColor: offer.backgroundColor,
        borderColor: offer.borderColor,
        textColor: offer.textColor,
        badgeBgColor: offer.badgeBgColor,
        badgeTextColor: offer.badgeTextColor,
        showAddToCartBtn: offer.showAddToCartBtn !== false,
        addToCartBtnText: offer.addToCartBtnText || "Add to Cart",
        btnBgColor: offer.btnBgColor || "#D4AF37",
        btnTextColor: offer.btnTextColor || "#000000",
        tiers: tiers,
        translations: {
          offerTitle: offerLangTranslations.offerTitle || globalQbTranslations.sectionTitle || globalQbTranslations.offerTitle || "Select Quantity & Save",
          subtitle: offerLangTranslations.subtitle || globalQbTranslations.subtitle || "",
          buyPrefix: offerLangTranslations.buyPrefix || globalQbTranslations.buyPrefix || "Buy",
          itemsSuffix: offerLangTranslations.itemsSuffix || globalQbTranslations.itemsSuffix || "items",
          eachSuffix: offerLangTranslations.eachSuffix || globalQbTranslations.eachLabel || globalQbTranslations.eachSuffix || "each",
          savePrefix: offerLangTranslations.savePrefix || globalQbTranslations.saveLabel || globalQbTranslations.savePrefix || "Save",
          mostPopularBadge: offerLangTranslations.mostPopularBadge || globalQbTranslations.tier2Badge || globalQbTranslations.mostPopularBadge || "Most Popular",
          bestValueBadge: offerLangTranslations.bestValueBadge || globalQbTranslations.tier3Badge || globalQbTranslations.bestValueBadge || "Best Value",
          totalLabel: offerLangTranslations.totalLabel || globalQbTranslations.totalLabel || "Total",
          youSaveLabel: offerLangTranslations.youSaveLabel || globalQbTranslations.saveLabel || globalQbTranslations.youSaveLabel || "You Save",
          addToCartBtn: offerLangTranslations.addToCartBtn || globalQbTranslations.addToCartBtn || offer.addToCartBtnText || "Add to Cart",
        },
      };
    });

    quantityBreaks = {
      active: true,
      offers,
    };
  }

  return new Response(
    JSON.stringify({
      active: true,
      shop: session?.shop || shop.shopDomain,
      locale: storefrontLocale,
      storefrontLocale: storefrontLocale,
      isRtl: isRtl,
      translations: translations,
      features: {
        scarcity,
        prePurchase,
        inCart,
        social,
        shipping,
        exitIntent,
        productScarcity,
        quantityBreaks,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store, must-revalidate" },
    }
  );
};
