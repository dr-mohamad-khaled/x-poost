/**
 * XPoost — Multi-Language Translation System & Dictionary
 * Modern Standard Arabic (Clean, direct, professional e-commerce tone)
 * Strict Zero Emojis Policy
 */

export interface FeatureTranslations {
  productScarcity: {
    headlineText: string;
    subText: string;
    badgeText: string;
    viewersText: string;
    viewingSuffix: string;
  };
  prePurchase: {
    offerTag: string;
    headline: string;
    description: string;
    acceptButton: string;
    declineButton: string;
    urgencyLabel: string;
    scarcityNotice: string;
  };
  inCart: {
    sectionTitle: string;
    addButton: string;
    saveBadge: string;
  };
  shippingBar: {
    initialMessage: string;
    progressMessage: string;
    allUnlockedMessage: string;
  };
  exitIntent: {
    headline: string;
    bodyText: string;
    buttonText: string;
    dismissText: string;
  };
  socialBar: {
    badgeText: string;
    vipCommunityLabel: string;
    whatsappMessage: string;
  };
  scarcityToast: {
    discountBadge: string;
    discountText: string;
    stockBadge: string;
    stockText: string;
    trendingBadge: string;
    trendingText: string;
    shippingBadge: string;
    shippingText: string;
  };
}

export const DEFAULT_ENGLISH_TRANSLATIONS: FeatureTranslations = {
  productScarcity: {
    headlineText: "Hurry! Only {stock} items left in stock",
    subText: "High demand: selling fast",
    badgeText: "HIGH DEMAND",
    viewersText: "{viewers} viewing this right now",
    viewingSuffix: "viewing",
  },
  prePurchase: {
    offerTag: "SPECIAL UPGRADE OFFER",
    headline: "Special Upgrade Offer",
    description: "Add these complementary items to your order!",
    acceptButton: "Add Selected & Continue \u2192",
    declineButton: "No thanks, continue to cart",
    urgencyLabel: "Special Offer Reserved For:",
    scarcityNotice: "Limited Allocation: Reserved exclusively for your cart session",
  },
  inCart: {
    sectionTitle: "Frequently Bought Together",
    addButton: "+ Add",
    saveBadge: "SAVE {discount}%",
  },
  shippingBar: {
    initialMessage: "Add items to unlock Free Shipping!",
    progressMessage: "You are only {amount} away from Free Shipping",
    allUnlockedMessage: "Congratulations! You unlocked all rewards!",
  },
  exitIntent: {
    headline: "Wait! Don't leave empty handed",
    bodyText: "Take an extra 10% off your entire order right now.",
    buttonText: "Claim 10% Off & Checkout",
    dismissText: "No thanks, I'll pay full price",
  },
  socialBar: {
    badgeText: "Need help? Chat with us",
    vipCommunityLabel: "Join our VIP Deals Group",
    whatsappMessage: "Hi, I have a question about my order",
  },
  scarcityToast: {
    discountBadge: "Exclusive code:",
    discountText: "Use code SAVE15 for 15% off — next 15 minutes only",
    stockBadge: "Almost gone:",
    stockText: "Low stock — only a few units left",
    trendingBadge: "Trending now:",
    trendingText: "Someone just ordered this product",
    shippingBadge: "Free delivery:",
    shippingText: "Spend $50 more to unlock free priority shipping",
  },
};

export const DEFAULT_ARABIC_TRANSLATIONS: FeatureTranslations = {
  productScarcity: {
    headlineText: "كمية محدودة: متبقي {stock} قطع فقط في المخزون",
    subText: "طلب مرتفع: ينفد سريعاً",
    badgeText: "طلب مرتفع",
    viewersText: "{viewers} يتصفحون هذا المنتج الآن",
    viewingSuffix: "مشاهدة",
  },
  prePurchase: {
    offerTag: "عرض ترقية خاص",
    headline: "عرض ترقية خاص لطلبك",
    description: "أضف هذه المنتجات المميزة إلى طلبك بسعر مخفض",
    acceptButton: "إضافة للطلب والمتابعة \u2190",
    declineButton: "تخطي العرض ومتابعة الشراء",
    urgencyLabel: "العرض متاح لطلبك لمدة:",
    scarcityNotice: "كمية محدودة: محجوزة حصرياً لجلستك الحالية",
  },
  inCart: {
    sectionTitle: "منتجات يشتريها العملاء أيضاً",
    addButton: "+ إضافة",
    saveBadge: "خصم {discount}%",
  },
  shippingBar: {
    initialMessage: "أضف منتجات بقيمة {amount} للحصول على شحن مجاني",
    progressMessage: "متبقي {amount} فقط للوصول إلى الشحن المجاني!",
    allUnlockedMessage: "تهانينا! حصلت على الشحن المجاني لطلبك!",
  },
  exitIntent: {
    headline: "انتظر! لديك خصم خاص قبل المغادرة",
    bodyText: "احصل على خصم إضافي بقيمة 10% على كامل طلبك الآن.",
    buttonText: "تفعيل الخصم وإتمام الطلب",
    dismissText: "لا شكراً، لا أريد الخصم",
  },
  socialBar: {
    badgeText: "تحتاج مساعدة؟ تحدث معنا",
    vipCommunityLabel: "انضم لمجموعة العروض الحصرية",
    whatsappMessage: "مرحباً، لدي استفسار بخصوص الطلب",
  },
  scarcityToast: {
    discountBadge: "كود خصم:",
    discountText: "استخدم كود SAVE15 للحصول على 15% خصم إضافي",
    stockBadge: "كمية محدودة:",
    stockText: "متبقي قطع قليلة فقط من هذا المنتج",
    trendingBadge: "طلب حديث:",
    trendingText: "تم شراء هذا المنتج للتو",
    shippingBadge: "شحن مجاني:",
    shippingText: "أضف المزيد لتفعيل الشحن السريع المجاني",
  },
};

export const DASHBOARD_I18N: Record<"en" | "ar", Record<string, string>> = {
  en: {
    navOverview: "Overview",
    navPricing: "Plans & Pricing",
    navProductScarcity: "Product Stock Scarcity",
    navUrgency: "Urgency Notifications",
    navPrePurchase: "Pre-Purchase Upsell",
    navInCart: "Cart Drawer Upsell",
    navSocialBar: "Support & Social Bar",
    navShippingBar: "Free Shipping Bar",
    navExitIntent: "Exit-Intent Recovery",
    navTranslations: "Translations & Languages",
    pageTitle: "Translations & Language Settings",
    pageSubtitle: "Configure multi-language storefront copy and manage dashboard display language.",
    langSectionTitle: "Language & Locale Settings",
    langSectionDesc: "Select active languages for your store and merchant dashboard.",
    dashboardLangLabel: "Dashboard Language",
    storefrontLangLabel: "Storefront Language",
    autoTranslateTitle: "Automated Translations",
    autoTranslateDesc: "Apply clean, direct Modern Standard Arabic to all features with one click.",
    btnApplyAllArabic: "Apply Modern Arabic to All Features",
    btnResetEnglish: "Reset All to English",
    btnSave: "Save Translations",
    savedSuccess: "Translations saved successfully.",
    featureProductScarcity: "Product Stock Scarcity Block",
    featurePrePurchase: "Pre-Purchase Upsell Modal",
    featureInCart: "Cart Drawer Upsells",
    featureShippingBar: "Free Shipping Progress Bar",
    featureExitIntent: "Exit-Intent Recovery Modal",
    featureSocialBar: "Support & Social Action Bar",
    featureScarcityToast: "Urgency & Social Proof Corner Toasts",
  },
  ar: {
    navOverview: "نظرة عامة",
    navPricing: "الخطط والأسعار",
    navProductScarcity: "ندرة مخزون المنتج",
    navUrgency: "إشعارات الشراء المباشرة",
    navPrePurchase: "عروض ما قبل الدفع",
    navInCart: "عروض سلة الشراء",
    navSocialBar: "شريط الدعم والتواصل",
    navShippingBar: "شريط الشحن المجاني",
    navExitIntent: "نافذة استعادة الزوار",
    navTranslations: "إدارة اللغات والترجمة",
    pageTitle: "إدارة اللغات والترجمة",
    pageSubtitle: "تخصيص نصوص المتجر بمختلف اللغات واختيار لغة لوحة التحكم.",
    langSectionTitle: "إعدادات اللغة والاتجاه",
    langSectionDesc: "اختر اللغة المفضلة لواجهة المتجر ولوحة تحكم التاجر.",
    dashboardLangLabel: "لغة لوحة التحكم",
    storefrontLangLabel: "لغة واجهة المتجر للعملاء",
    autoTranslateTitle: "الترجمة التلقائية المباشرة",
    autoTranslateDesc: "تطبيق لغة عربية فصحى معاصرة ومباشرة على كافة الميزات بنقرة واحدة.",
    btnApplyAllArabic: "تطبيق الفصحى المعاصرة على كافة الميزات",
    btnResetEnglish: "استعادة النصوص الإنجليزية الأصلية",
    btnSave: "حفظ التغييرات",
    savedSuccess: "تم حفظ الترجمات بنجاح.",
    featureProductScarcity: "بلوك ندرة مخزون المنتج",
    featurePrePurchase: "نافذة عروض ما قبل الدفع",
    featureInCart: "عروض داخل سلة الشراء",
    featureShippingBar: "شريط تقدم الشحن المجاني",
    featureExitIntent: "نافذة استعادة الزوار المغادرين",
    featureSocialBar: "شريط الدعم والتواصل السريع",
    featureScarcityToast: "إشعارات الشراء العاجلة الجانبية",
  },
};

/**
 * Clean helper to strip any unintended emojis from user input
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, "").trim();
}

/**
 * Merge saved custom translations with defaults based on active locale
 */
export function getMergedTranslations(
  customJson: string | null | undefined,
  locale: "ar" | "en" = "ar"
): FeatureTranslations {
  const baseDefaults = locale === "ar" ? DEFAULT_ARABIC_TRANSLATIONS : DEFAULT_ENGLISH_TRANSLATIONS;

  if (!customJson) return baseDefaults;

  try {
    const parsed = JSON.parse(customJson);
    if (!parsed || typeof parsed !== "object") return baseDefaults;

    return {
      productScarcity: {
        ...baseDefaults.productScarcity,
        ...(parsed.productScarcity || {}),
      },
      prePurchase: {
        ...baseDefaults.prePurchase,
        ...(parsed.prePurchase || {}),
      },
      inCart: {
        ...baseDefaults.inCart,
        ...(parsed.inCart || {}),
      },
      shippingBar: {
        ...baseDefaults.shippingBar,
        ...(parsed.shippingBar || {}),
      },
      exitIntent: {
        ...baseDefaults.exitIntent,
        ...(parsed.exitIntent || {}),
      },
      socialBar: {
        ...baseDefaults.socialBar,
        ...(parsed.socialBar || {}),
      },
      scarcityToast: {
        ...baseDefaults.scarcityToast,
        ...(parsed.scarcityToast || {}),
      },
    };
  } catch {
    return baseDefaults;
  }
}
