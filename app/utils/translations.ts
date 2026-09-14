/**
 * XPoost — Multi-Language Translation System & High-Converting Dictionaries
 * Supports 7 Global Languages: Arabic (ar - RTL), English (en), French (fr),
 * German (de), Spanish (es), Italian (it), and Portuguese (pt).
 *
 * Rules:
 * - Modern Standard Arabic: clean, direct, professional e-commerce tone.
 * - Zero Emojis Policy: strictly no emojis anywhere.
 */

export type SupportedLanguage = "ar" | "en" | "fr" | "de" | "es" | "it" | "pt";

export interface LanguageMeta {
  code: SupportedLanguage;
  label: string;
  nativeName: string;
  dir: "rtl" | "ltr";
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: "ar", label: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "en", label: "English", nativeName: "English", dir: "ltr" },
  { code: "fr", label: "French", nativeName: "Français", dir: "ltr" },
  { code: "de", label: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "es", label: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "it", label: "Italian", nativeName: "Italiano", dir: "ltr" },
  { code: "pt", label: "Portuguese", nativeName: "Português", dir: "ltr" },
];

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
    viewingSuffix: "مشاهدة الآن",
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
    progressMessage: "متبقي {amount} فقط للوصول إلى الشحن المجاني",
    allUnlockedMessage: "تهانينا! حصلت على الشحن المجاني لطلبك",
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

export const DEFAULT_FRENCH_TRANSLATIONS: FeatureTranslations = {
  productScarcity: {
    headlineText: "Vite ! Plus que {stock} articles en stock",
    subText: "Forte demande : vente rapide",
    badgeText: "FORTE DEMANDE",
    viewersText: "{viewers} personnes consultent cet article",
    viewingSuffix: "en consultation",
  },
  prePurchase: {
    offerTag: "OFFRE SPÉCIALE DE SURCLASSEMENT",
    headline: "Offre spéciale de surclassement pour votre commande",
    description: "Ajoutez ces articles complémentaires à votre commande à prix réduit !",
    acceptButton: "Ajouter la sélection et continuer \u2192",
    declineButton: "Non merci, continuer vers le panier",
    urgencyLabel: "Offre spéciale réservée pendant :",
    scarcityNotice: "Quantité limitée : Réservée exclusivement pour votre session d'achat",
  },
  inCart: {
    sectionTitle: "Fréquemment achetés ensemble",
    addButton: "+ Ajouter",
    saveBadge: "ÉCONOMISEZ {discount}%",
  },
  shippingBar: {
    initialMessage: "Ajoutez des articles pour débloquer la livraison gratuite !",
    progressMessage: "Plus que {amount} pour la livraison gratuite !",
    allUnlockedMessage: "Félicitations ! Vous avez débloqué toutes les récompenses !",
  },
  exitIntent: {
    headline: "Attendez ! Ne partez pas les mains vides",
    bodyText: "Profitez d'une remise supplémentaire de 10% sur toute votre commande maintenant.",
    buttonText: "Activer les 10% et commander",
    dismissText: "Non merci, je préfère payer le prix fort",
  },
  socialBar: {
    badgeText: "Besoin d'aide ? Écrivez-nous",
    vipCommunityLabel: "Rejoignez notre groupe d'offres VIP",
    whatsappMessage: "Bonjour, j'ai une question concernant ma commande",
  },
  scarcityToast: {
    discountBadge: "Code exclusif :",
    discountText: "Utilisez le code SAVE15 pour 15% de réduction immédiate",
    stockBadge: "Bientôt épuisé :",
    stockText: "Stock limité — seulement quelques pièces restantes",
    trendingBadge: "Tendance actuelle :",
    trendingText: "Un client vient de commander cet article",
    shippingBadge: "Livraison gratuite :",
    shippingText: "Ajoutez des articles pour débloquer la livraison rapide",
  },
};

export const DEFAULT_GERMAN_TRANSLATIONS: FeatureTranslations = {
  productScarcity: {
    headlineText: "Beeilung! Nur noch {stock} Artikel auf Lager",
    subText: "Hohe Nachfrage: Schnell zugreifen",
    badgeText: "HOHE NACHFRAGE",
    viewersText: "{viewers} Personen sehen sich diesen Artikel an",
    viewingSuffix: "sehen gerade zu",
  },
  prePurchase: {
    offerTag: "EXKLUSIVES UPGRADE-ANGEBOT",
    headline: "Exklusives Upgrade-Angebot für Ihre Bestellung",
    description: "Fügen Sie diese passenden Artikel zu Ihrer Bestellung hinzu !",
    acceptButton: "Ausgewähltes hinzufügen & weiter \u2192",
    declineButton: "Nein danke, weiter zum Warenkorb",
    urgencyLabel: "Sonderangebot reserviert für:",
    scarcityNotice: "Begrenzte Menge: Exklusiv für Ihren Einkauf reserviert",
  },
  inCart: {
    sectionTitle: "Wird oft zusammen gekauft",
    addButton: "+ Hinzufügen",
    saveBadge: "{discount}% SPAREN",
  },
  shippingBar: {
    initialMessage: "Artikel hinzufügen, um kostenlosen Versand freizuschalten!",
    progressMessage: "Nur noch {amount} bis zum kostenlosen Versand",
    allUnlockedMessage: "Herzlichen Glückwunsch! Sie haben alle Vorteile freigeschaltet!",
  },
  exitIntent: {
    headline: "Warten Sie! Nicht mit leeren Händen gehen",
    bodyText: "Sichern Sie sich jetzt zusätzliche 10% Rabatt auf Ihre gesamte Bestellung.",
    buttonText: "10% Rabatt sichern & zur Kasse",
    dismissText: "Nein danke, ich zahle den vollen Preis",
  },
  socialBar: {
    badgeText: "Brauchen Sie Hilfe? Schreiben Sie uns",
    vipCommunityLabel: "Treten Sie unserer VIP-Angebotsgruppe bei",
    whatsappMessage: "Hallo, ich habe eine Frage zu meiner Bestellung",
  },
  scarcityToast: {
    discountBadge: "Exklusiver Rabattcode:",
    discountText: "Verwenden Sie SAVE15 für 15% Rabatt in den nächsten 15 Minuten",
    stockBadge: "Fast ausverkauft:",
    stockText: "Geringer Bestand — nur noch wenige Einheiten",
    trendingBadge: "Aktuell beliebt:",
    trendingText: "Jemand hat diesen Artikel gerade bestellt",
    shippingBadge: "Kostenlose Lieferung:",
    shippingText: "Bestellwert erhöhen für kostenlosen Expressversand",
  },
};

export const DEFAULT_SPANISH_TRANSLATIONS: FeatureTranslations = {
  productScarcity: {
    headlineText: "¡Date prisa! Solo quedan {stock} unidades en stock",
    subText: "Gran demanda: se agota rápido",
    badgeText: "ALTA DEMANDA",
    viewersText: "{viewers} personas están viendo este producto",
    viewingSuffix: "mirando ahora",
  },
  prePurchase: {
    offerTag: "OFERTA ESPECIAL DE MEJORA",
    headline: "Oferta especial de mejora para tu pedido",
    description: "¡Añade estos artículos complementarios a tu pedido con descuento!",
    acceptButton: "Añadir seleccionados y continuar \u2192",
    declineButton: "No gracias, continuar al carrito",
    urgencyLabel: "Oferta especial reservada durante:",
    scarcityNotice: "Cantidad limitada: Reservada exclusivamente para tu sesión de compra",
  },
  inCart: {
    sectionTitle: "Comprados frecuentemente juntos",
    addButton: "+ Añadir",
    saveBadge: "AHORRA {discount}%",
  },
  shippingBar: {
    initialMessage: "¡Añade productos para obtener envío gratis!",
    progressMessage: "Te faltan solo {amount} para el envío gratis",
    allUnlockedMessage: "¡Enhorabuena! Has desbloqueado todas las recompensas",
  },
  exitIntent: {
    headline: "¡Espera! No te vayas con las manos vacías",
    bodyText: "Aprovecha un 10% de descuento adicional en todo tu pedido ahora mismo.",
    buttonText: "Obtener 10% de descuento y pagar",
    dismissText: "No gracias, prefiero pagar el precio completo",
  },
  socialBar: {
    badgeText: "¿Necesitas ayuda? Chatea con nosotros",
    vipCommunityLabel: "Únete a nuestro grupo de ofertas VIP",
    whatsappMessage: "Hola, tengo una consulta sobre mi pedido",
  },
  scarcityToast: {
    discountBadge: "Código exclusivo:",
    discountText: "Usa el código SAVE15 para un 15% de descuento en los próximos 15 minutos",
    stockBadge: "Casi agotado:",
    stockText: "Stock bajo — quedan muy pocas unidades",
    trendingBadge: "Tendencia ahora:",
    trendingText: "Alguien acaba de comprar este producto",
    shippingBadge: "Envío gratis:",
    shippingText: "Añade más para desbloquear envío prioritario gratis",
  },
};

export const DEFAULT_ITALIAN_TRANSLATIONS: FeatureTranslations = {
  productScarcity: {
    headlineText: "Affrettati! Solo {stock} articoli rimasti in magazzino",
    subText: "Alta richiesta: esaurimento rapido",
    badgeText: "ALTA RICHIESTA",
    viewersText: "{viewers} persone stanno guardando questo prodotto",
    viewingSuffix: "visitatori attivi",
  },
  prePurchase: {
    offerTag: "OFFERTA SPECIALE DI UPGRADE",
    headline: "Offerta speciale di upgrade per il tuo ordine",
    description: "Aggiungi questi articoli complementari al tuo ordine a prezzo scontato!",
    acceptButton: "Aggiungi selezionati e continua \u2192",
    declineButton: "No grazie, continua al carrello",
    urgencyLabel: "Offerta speciale riservata per:",
    scarcityNotice: "Quantità limitata: Riservata esclusivamente per la tua sessione",
  },
  inCart: {
    sectionTitle: "Spesso acquistati insieme",
    addButton: "+ Aggiungi",
    saveBadge: "RISPARMIA IL {discount}%",
  },
  shippingBar: {
    initialMessage: "Aggiungi articoli per ottenere la spedizione gratuita!",
    progressMessage: "Ti mancano solo {amount} per la spedizione gratuita",
    allUnlockedMessage: "Congratulazioni! Hai sbloccato tutti i vantaggi!",
  },
  exitIntent: {
    headline: "Aspetta! Non andartene a mani vuote",
    bodyText: "Approfitta subito di uno sconto extra del 10% sull'intero ordine.",
    buttonText: "Ottieni il 10% di sconto e acquista",
    dismissText: "No grazie, pago il prezzo pieno",
  },
  socialBar: {
    badgeText: "Hai bisogno di aiuto? Scrivici in chat",
    vipCommunityLabel: "Unisciti al gruppo offerte VIP",
    whatsappMessage: "Ciao, ho una domanda sul mio ordine",
  },
  scarcityToast: {
    discountBadge: "Codice esclusivo:",
    discountText: "Usa il codice SAVE15 per il 15% di sconto immediato",
    stockBadge: "Quasi esaurito:",
    stockText: "Scorte limitate — solo pochi pezzi rimasti",
    trendingBadge: "Molto richiesto:",
    trendingText: "Un cliente ha appena acquistato questo articolo",
    shippingBadge: "Spedizione gratuita:",
    shippingText: "Aggiungi altri articoli per sbloccare la spedizione gratuita",
  },
};

export const DEFAULT_PORTUGUESE_TRANSLATIONS: FeatureTranslations = {
  productScarcity: {
    headlineText: "Apresse-se! Apenas {stock} itens restantes em estoque",
    subText: "Alta demanda: esgotando rápido",
    badgeText: "ALTA DEMANDA",
    viewersText: "{viewers} pessoas estão vendo este produto agora",
    viewingSuffix: "visualizando agora",
  },
  prePurchase: {
    offerTag: "OFERTA ESPECIAL DE UPGRADE",
    headline: "Oferta especial de upgrade para seu pedido",
    description: "Adicione estes itens complementares ao seu pedido com desconto!",
    acceptButton: "Adicionar selecionados e continuar \u2192",
    declineButton: "Não obrigado, continuar para o carrinho",
    urgencyLabel: "Oferta especial reservada por:",
    scarcityNotice: "Quantidade limitada: Reservada exclusivamente para sua sessão de compra",
  },
  inCart: {
    sectionTitle: "Frequentemente comprados juntos",
    addButton: "+ Adicionar",
    saveBadge: "ECONOMIZE {discount}%",
  },
  shippingBar: {
    initialMessage: "Adicione itens para desbloquear frete grátis!",
    progressMessage: "Faltam apenas {amount} para o frete grátis",
    allUnlockedMessage: "Parabéns! Você desbloqueou todas as recompensas!",
  },
  exitIntent: {
    headline: "Espere! Não saia de mãos vazias",
    bodyText: "Aproveite um desconto extra de 10% em todo o seu pedido agora mesmo.",
    buttonText: "Garantir 10% de desconto e finalizar",
    dismissText: "Não obrigado, pagarei o preço normal",
  },
  socialBar: {
    badgeText: "Precisa de ajuda? Fale conosco",
    vipCommunityLabel: "Participe do nosso grupo de ofertas VIP",
    whatsappMessage: "Olá, tenho uma dúvida sobre meu pedido",
  },
  scarcityToast: {
    discountBadge: "Código exclusivo:",
    discountText: "Use o código SAVE15 para 15% de desconto nos próximos 15 minutos",
    stockBadge: "Quase esgotado:",
    stockText: "Estoque baixo — restam poucas unidades",
    trendingBadge: "Em alta agora:",
    trendingText: "Alguém acabou de comprar este produto",
    shippingBadge: "Frete grátis:",
    shippingText: "Adicione mais itens para desbloquear frete grátis prioritário",
  },
};

export const DEFAULT_TRANSLATIONS_BY_LANG: Record<SupportedLanguage, FeatureTranslations> = {
  ar: DEFAULT_ARABIC_TRANSLATIONS,
  en: DEFAULT_ENGLISH_TRANSLATIONS,
  fr: DEFAULT_FRENCH_TRANSLATIONS,
  de: DEFAULT_GERMAN_TRANSLATIONS,
  es: DEFAULT_SPANISH_TRANSLATIONS,
  it: DEFAULT_ITALIAN_TRANSLATIONS,
  pt: DEFAULT_PORTUGUESE_TRANSLATIONS,
};

export const DASHBOARD_I18N: Record<SupportedLanguage, Record<string, string>> = {
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
    dashboardLangTitle: "لغة لوحة التحكم",
    storefrontLangTitle: "لغة المتجر للعملاء",
    pageTitle: "إدارة اللغات والترجمة",
    pageSubtitle: "تخصيص نصوص المتجر بمختلف اللغات واختيار لغة لوحة التحكم.",
    langSectionTitle: "إعدادات اللغة والاتجاه",
    langSectionDesc: "اختر اللغة المفضلة لواجهة المتجر ولوحة تحكم التاجر.",
    dashboardLangLabel: "لغة لوحة التحكم",
    storefrontLangLabel: "لغة واجهة المتجر للعملاء",
    autoTranslateTitle: "الترجمة التلقائية المباشرة",
    autoTranslateDesc: "تطبيق لغة معتمدة ومباشرة على كافة الميزات بنقرة واحدة.",
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
    featureLangTitle: "لغة نصوص هذه الميزة",
    featureLangSubtitle: "اختر لغة لتعديل نصوصها أو تحميل النصوص النموذجية الجاهزة:",
    btnLoadPredefined: "تحميل النصوص النموذجية لهذه اللغة",
    loadedNotice: "تم تحميل النصوص النموذجية بنجاح.",
  },
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
    dashboardLangTitle: "Dashboard Language",
    storefrontLangTitle: "Storefront Language",
    pageTitle: "Translations & Language Settings",
    pageSubtitle: "Configure multi-language storefront copy and manage dashboard display language.",
    langSectionTitle: "Language & Locale Settings",
    langSectionDesc: "Select active languages for your store and merchant dashboard.",
    dashboardLangLabel: "Dashboard Language",
    storefrontLangLabel: "Storefront Language",
    autoTranslateTitle: "Automated Translations",
    autoTranslateDesc: "Apply clean, high-converting copy across all features with one click.",
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
    featureLangTitle: "Feature Copy Language",
    featureLangSubtitle: "Select a language to edit its text or load high-converting predefined copy:",
    btnLoadPredefined: "Load Predefined Values for this Language",
    loadedNotice: "Predefined copy loaded successfully.",
  },
  fr: {
    navOverview: "Vue d'ensemble",
    navPricing: "Forfaits et Tarifs",
    navProductScarcity: "Rareté du stock produit",
    navUrgency: "Notifications d'urgence",
    navPrePurchase: "Vente incitative pré-achat",
    navInCart: "Vente incitative panier",
    navSocialBar: "Barre de support et réseaux",
    navShippingBar: "Barre de livraison gratuite",
    navExitIntent: "Récupération à la sortie",
    navTranslations: "Traductions et Langues",
    dashboardLangTitle: "Langue du tableau de bord",
    storefrontLangTitle: "Langue de la boutique",
    pageTitle: "Paramètres de traduction et langues",
    pageSubtitle: "Personnalisez les textes de la boutique et la langue de votre tableau de bord.",
    langSectionTitle: "Paramètres de langue et région",
    langSectionDesc: "Sélectionnez les langues actives pour votre boutique et tableau de bord.",
    dashboardLangLabel: "Langue du tableau de bord",
    storefrontLangLabel: "Langue de la boutique",
    autoTranslateTitle: "Traductions automatiques",
    autoTranslateDesc: "Appliquez des textes à fort taux de conversion en un clic.",
    btnApplyAllArabic: "Appliquer l'arabe moderne à tout",
    btnResetEnglish: "Réinitialiser en anglais",
    btnSave: "Enregistrer les modifications",
    savedSuccess: "Traductions enregistrées avec succès.",
    featureProductScarcity: "Bloc de rareté du stock",
    featurePrePurchase: "Fenêtre d'offre pré-achat",
    featureInCart: "Offres dans le tiroir du panier",
    featureShippingBar: "Barre de progression livraison",
    featureExitIntent: "Fenêtre de rétention de sortie",
    featureSocialBar: "Barre de support et action sociale",
    featureScarcityToast: "Notifications de preuve sociale",
    featureLangTitle: "Langue des textes de la fonctionnalité",
    featureLangSubtitle: "Sélectionnez une langue pour modifier les textes ou charger les modèles :",
    btnLoadPredefined: "Charger les textes par défaut pour cette langue",
    loadedNotice: "Textes modèles chargés avec succès.",
  },
  de: {
    navOverview: "Übersicht",
    navPricing: "Preise & Tarife",
    navProductScarcity: "Produkt-Bestandsknappheit",
    navUrgency: "Dringlichkeits-Hinweise",
    navPrePurchase: "Pre-Purchase Upsell",
    navInCart: "Warenkorb-Upsell",
    navSocialBar: "Support- & Social-Leiste",
    navShippingBar: "Gratisversand-Leiste",
    navExitIntent: "Exit-Intent-Rettung",
    navTranslations: "Übersetzungen & Sprachen",
    dashboardLangTitle: "Dashboard-Sprache",
    storefrontLangTitle: "Shop-Sprache",
    pageTitle: "Übersetzungen & Spracheinstellungen",
    pageSubtitle: "Passen Sie die Texte Ihres Onlineshops und das Dashboard an.",
    langSectionTitle: "Sprach- und Ländereinstellungen",
    langSectionDesc: "Wählen Sie die aktiven Sprachen für Ihren Shop und das Dashboard.",
    dashboardLangLabel: "Dashboard-Sprache",
    storefrontLangLabel: "Shop-Sprache für Kunden",
    autoTranslateTitle: "Automatische Übersetzungen",
    autoTranslateDesc: "Konversionsstarke Texte mit einem Klick anwenden.",
    btnApplyAllArabic: "Modernes Arabisch auf alles anwenden",
    btnResetEnglish: "Alles auf Englisch zurücksetzen",
    btnSave: "Änderungen speichern",
    savedSuccess: "Übersetzungen erfolgreich gespeichert.",
    featureProductScarcity: "Produktknappheits-Block",
    featurePrePurchase: "Pre-Purchase-Modal",
    featureInCart: "Warenkorb-Zusatzangebote",
    featureShippingBar: "Gratisversand-Fortschrittsleiste",
    featureExitIntent: "Exit-Intent-Pop-up",
    featureSocialBar: "Support- & Social-Dock",
    featureScarcityToast: "Social-Proof-Eckbenachrichtigungen",
    featureLangTitle: "Sprache dieser Funktion",
    featureLangSubtitle: "Wählen Sie eine Sprache zur Bearbeitung oder laden Sie Vorlagen:",
    btnLoadPredefined: "Vorlagentexte für diese Sprache laden",
    loadedNotice: "Vorlagentexte erfolgreich geladen.",
  },
  es: {
    navOverview: "Resumen",
    navPricing: "Planes y Precios",
    navProductScarcity: "Escasez de stock del producto",
    navUrgency: "Notificaciones de urgencia",
    navPrePurchase: "Venta adicional previa a la compra",
    navInCart: "Venta adicional en el carrito",
    navSocialBar: "Barra de soporte y redes",
    navShippingBar: "Barra de envío gratis",
    navExitIntent: "Recuperación de salida",
    navTranslations: "Traducciones e Idiomas",
    dashboardLangTitle: "Idioma del panel de control",
    storefrontLangTitle: "Idioma de la tienda",
    pageTitle: "Configuración de traducciones e idiomas",
    pageSubtitle: "Personaliza los textos de la tienda y el idioma de tu panel.",
    langSectionTitle: "Ajustes de idioma y región",
    langSectionDesc: "Elige los idiomas activos para tu tienda y el panel de administración.",
    dashboardLangLabel: "Idioma del panel de control",
    storefrontLangLabel: "Idioma de la tienda para clientes",
    autoTranslateTitle: "Traducciones automáticas",
    autoTranslateDesc: "Aplica textos de alta conversión con un solo clic.",
    btnApplyAllArabic: "Aplicar árabe moderno a todo",
    btnResetEnglish: "Restablecer todo a inglés",
    btnSave: "Guardar cambios",
    savedSuccess: "Traducciones guardadas correctamente.",
    featureProductScarcity: "Bloque de escasez de inventario",
    featurePrePurchase: "Ventana de oferta previa al pago",
    featureInCart: "Ofertas en cajón del carrito",
    featureShippingBar: "Barra de progreso de envío gratis",
    featureExitIntent: "Ventana de recuperación al salir",
    featureSocialBar: "Barra de soporte y canales sociales",
    featureScarcityToast: "Notificaciones emergentes de urgencia",
    featureLangTitle: "Idioma de los textos de esta función",
    featureLangSubtitle: "Selecciona un idioma para editar sus textos o cargar plantillas:",
    btnLoadPredefined: "Cargar textos predefinidos para este idioma",
    loadedNotice: "Textos predefinidos cargados con éxito.",
  },
  it: {
    navOverview: "Panoramica",
    navPricing: "Piani e Prezzi",
    navProductScarcity: "Scarsità scorte prodotto",
    navUrgency: "Notifiche di urgenza",
    navPrePurchase: "Upsell pre-acquisto",
    navInCart: "Upsell nel carrello",
    navSocialBar: "Barra di supporto e social",
    navShippingBar: "Barra spedizione gratuita",
    navExitIntent: "Recupero intenti di uscita",
    navTranslations: "Traduzioni e Lingue",
    dashboardLangTitle: "Lingua del pannello",
    storefrontLangTitle: "Lingua del negozio",
    pageTitle: "Impostazioni di traduzione e lingua",
    pageSubtitle: "Personalizza i testi del negozio e la lingua del tuo pannello.",
    langSectionTitle: "Impostazioni lingua e formattazione",
    langSectionDesc: "Seleziona le lingue attive per la vetrina e il pannello di controllo.",
    dashboardLangLabel: "Lingua del pannello di controllo",
    storefrontLangLabel: "Lingua della vetrina per i clienti",
    autoTranslateTitle: "Traduzioni automatiche",
    autoTranslateDesc: "Applica testi ad alta conversione con un solo clic.",
    btnApplyAllArabic: "Applica arabo moderno a tutto",
    btnResetEnglish: "Ripristina tutto in inglese",
    btnSave: "Salva modifiche",
    savedSuccess: "Traduzioni salvate con successo.",
    featureProductScarcity: "Blocco scarsità disponibilità",
    featurePrePurchase: "Finestra di upsell pre-acquisto",
    featureInCart: "Offerte nel cassetto del carrello",
    featureShippingBar: "Barra di avanzamento spedizione",
    featureExitIntent: "Finestra di recupero all'uscita",
    featureSocialBar: "Barra di supporto e contatti",
    featureScarcityToast: "Notifiche di riprova sociale",
    featureLangTitle: "Lingua dei testi di questa funzione",
    featureLangSubtitle: "Seleziona una lingua per modificare i testi o caricare modelli:",
    btnLoadPredefined: "Carica testi predefiniti per questa lingua",
    loadedNotice: "Testi predefiniti caricati con successo.",
  },
  pt: {
    navOverview: "Visão Geral",
    navPricing: "Planos e Preços",
    navProductScarcity: "Escassez de estoque do produto",
    navUrgency: "Notificações de urgência",
    navPrePurchase: "Oferta pré-compra",
    navInCart: "Ofertas na gaveta do carrinho",
    navSocialBar: "Barra de suporte e redes",
    navShippingBar: "Barra de frete grátis",
    navExitIntent: "Recuperação de saída",
    navTranslations: "Traduções e Idiomas",
    dashboardLangTitle: "Idioma do painel",
    storefrontLangTitle: "Idioma da loja",
    pageTitle: "Configurações de tradução e idiomas",
    pageSubtitle: "Personalize os textos da loja e o idioma do seu painel de controle.",
    langSectionTitle: "Configurações de idioma e região",
    langSectionDesc: "Escolha os idiomas ativos para a loja e para o painel de administração.",
    dashboardLangLabel: "Idioma do painel de controle",
    storefrontLangLabel: "Idioma da loja para clientes",
    autoTranslateTitle: "Traduções automáticas",
    autoTranslateDesc: "Aplique textos de alta conversão com um único clique.",
    btnApplyAllArabic: "Aplicar árabe moderno a tudo",
    btnResetEnglish: "Redefinir tudo para inglês",
    btnSave: "Salvar alterações",
    savedSuccess: "Traduções salvas com sucesso.",
    featureProductScarcity: "Bloco de escassez de estoque",
    featurePrePurchase: "Janela de oferta pré-compra",
    featureInCart: "Ofertas na gaveta do carrinho",
    featureShippingBar: "Barra de progresso do frete grátis",
    featureExitIntent: "Janela de recuperação de saída",
    featureSocialBar: "Barra de suporte e redes sociais",
    featureScarcityToast: "Notificações de prova social",
    featureLangTitle: "Idioma dos textos desta funcionalidade",
    featureLangSubtitle: "Selecione um idioma para editar os textos ou carregar modelos prontos:",
    btnLoadPredefined: "Carregar textos predefinidos para este idioma",
    loadedNotice: "Textos predefinidos carregados com sucesso.",
  },
};

/**
 * Clean helper to strip any emojis from user input
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, "").trim();
}

/**
 * Check if language is RTL
 */
export function isRtlLang(lang: string): boolean {
  return lang === "ar";
}

/**
 * Parse custom translations JSON and return full dictionary for all 7 languages.
 */
export function getAllTranslations(
  customJson: string | null | undefined
): Record<SupportedLanguage, FeatureTranslations> {
  const result: Record<SupportedLanguage, FeatureTranslations> = {
    ar: { ...DEFAULT_ARABIC_TRANSLATIONS },
    en: { ...DEFAULT_ENGLISH_TRANSLATIONS },
    fr: { ...DEFAULT_FRENCH_TRANSLATIONS },
    de: { ...DEFAULT_GERMAN_TRANSLATIONS },
    es: { ...DEFAULT_SPANISH_TRANSLATIONS },
    it: { ...DEFAULT_ITALIAN_TRANSLATIONS },
    pt: { ...DEFAULT_PORTUGUESE_TRANSLATIONS },
  };

  if (!customJson) return result;

  try {
    const parsed = JSON.parse(customJson);
    if (!parsed || typeof parsed !== "object") return result;

    const langs: SupportedLanguage[] = ["ar", "en", "fr", "de", "es", "it", "pt"];
    const hasLangKeys = langs.some((l) => parsed[l] && typeof parsed[l] === "object");

    if (hasLangKeys) {
      for (const lang of langs) {
        if (parsed[lang] && typeof parsed[lang] === "object") {
          result[lang] = mergeSingleLang(result[lang], parsed[lang]);
        }
      }
    } else {
      result.ar = mergeSingleLang(result.ar, parsed);
      result.en = mergeSingleLang(result.en, parsed);
    }
  } catch (e) {
    console.warn("[XPoost] Error parsing translations JSON:", e);
  }

  return result;
}

function mergeSingleLang(base: FeatureTranslations, override: any): FeatureTranslations {
  if (!override || typeof override !== "object") return base;
  return {
    productScarcity: {
      ...base.productScarcity,
      ...(override.productScarcity || {}),
    },
    prePurchase: {
      ...base.prePurchase,
      ...(override.prePurchase || {}),
    },
    inCart: {
      ...base.inCart,
      ...(override.inCart || {}),
    },
    shippingBar: {
      ...base.shippingBar,
      ...(override.shippingBar || {}),
    },
    exitIntent: {
      ...base.exitIntent,
      ...(override.exitIntent || {}),
    },
    socialBar: {
      ...base.socialBar,
      ...(override.socialBar || {}),
    },
    scarcityToast: {
      ...base.scarcityToast,
      ...(override.scarcityToast || {}),
    },
  };
}

/**
 * Get merged translations for a specific locale
 */
export function getMergedTranslations(
  customJson: string | null | undefined,
  locale: string = "ar"
): FeatureTranslations {
  const langKey: SupportedLanguage = (
    ["ar", "en", "fr", "de", "es", "it", "pt"].includes(locale)
      ? locale
      : "en"
  ) as SupportedLanguage;

  const all = getAllTranslations(customJson);
  return all[langKey] || DEFAULT_TRANSLATIONS_BY_LANG[langKey] || DEFAULT_ENGLISH_TRANSLATIONS;
}

/**
 * Save / update translations for a specific feature and language into the existing JSON string.
 */
export function updateFeatureTranslations(
  existingJson: string | null | undefined,
  lang: SupportedLanguage,
  featureKey: keyof FeatureTranslations,
  featureData: Partial<FeatureTranslations[keyof FeatureTranslations]>
): string {
  const all = getAllTranslations(existingJson);
  all[lang] = {
    ...all[lang],
    [featureKey]: {
      ...all[lang][featureKey],
      ...featureData,
    },
  };
  return JSON.stringify(all);
}
