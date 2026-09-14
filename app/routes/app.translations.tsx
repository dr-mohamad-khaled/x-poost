import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_TRANSLATIONS_BY_LANG,
  DEFAULT_ARABIC_TRANSLATIONS,
  DASHBOARD_I18N,
  getAllTranslations,
  sanitizeText,
  isRtlLang,
  type SupportedLanguage,
  type FeatureTranslations,
} from "../utils/translations";
import { FeatureLanguageSwitcher } from "../components/FeatureLanguageSwitcher";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  let config = await prisma.translationConfig.findUnique({
    where: { shopId: shop.id },
  });

  if (!config) {
    config = await prisma.translationConfig.create({
      data: {
        shopId: shop.id,
        dashboardLocale: "en",
        storefrontLocale: "ar",
        translationsJson: JSON.stringify(DEFAULT_TRANSLATIONS_BY_LANG),
      },
    });
  }

  const validLangs: SupportedLanguage[] = ["ar", "en", "fr", "de", "es", "it", "pt"];
  const activeDashboardLocale: SupportedLanguage = validLangs.includes(
    config.dashboardLocale as SupportedLanguage
  )
    ? (config.dashboardLocale as SupportedLanguage)
    : "en";

  const activeStorefrontLocale: SupportedLanguage = validLangs.includes(
    config.storefrontLocale as SupportedLanguage
  )
    ? (config.storefrontLocale as SupportedLanguage)
    : "ar";

  const allTranslations = getAllTranslations(config.translationsJson);

  return {
    shopDomain: session.shop,
    dashboardLocale: activeDashboardLocale,
    storefrontLocale: activeStorefrontLocale,
    allTranslations,
    defaultsByLang: DEFAULT_TRANSLATIONS_BY_LANG,
    supportedLanguages: SUPPORTED_LANGUAGES,
    i18n: DASHBOARD_I18N[activeDashboardLocale] || DASHBOARD_I18N.en,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const actionType = String(formData.get("actionType") || "save");

  const validLangs: SupportedLanguage[] = ["ar", "en", "fr", "de", "es", "it", "pt"];
  const rawDash = String(formData.get("dashboardLocale") || "en");
  const rawSf = String(formData.get("storefrontLocale") || "ar");
  const rawEdit = String(formData.get("editLang") || "ar");

  const dashboardLocale: SupportedLanguage = validLangs.includes(rawDash as SupportedLanguage)
    ? (rawDash as SupportedLanguage)
    : "en";
  const storefrontLocale: SupportedLanguage = validLangs.includes(rawSf as SupportedLanguage)
    ? (rawSf as SupportedLanguage)
    : "ar";
  const editLang: SupportedLanguage = validLangs.includes(rawEdit as SupportedLanguage)
    ? (rawEdit as SupportedLanguage)
    : "ar";

  let config = await prisma.translationConfig.findUnique({
    where: { shopId: shop.id },
  });

  let allTranslations = getAllTranslations(config?.translationsJson);

  if (actionType === "apply_predefined") {
    allTranslations[editLang] = { ...DEFAULT_TRANSLATIONS_BY_LANG[editLang] };
  } else if (actionType === "apply_all_defaults") {
    allTranslations = { ...DEFAULT_TRANSLATIONS_BY_LANG };
  } else {
    // Save granular inputs for the current editLang
    allTranslations[editLang] = {
      productScarcity: {
        headlineText: sanitizeText(String(formData.get("ps_headline") || "")),
        subText: sanitizeText(String(formData.get("ps_subtext") || "")),
        badgeText: sanitizeText(String(formData.get("ps_badge") || "")),
        viewersText: sanitizeText(String(formData.get("ps_viewers") || "")),
        viewingSuffix: sanitizeText(String(formData.get("ps_suffix") || "")),
      },
      prePurchase: {
        offerTag: sanitizeText(String(formData.get("pp_tag") || "")),
        headline: sanitizeText(String(formData.get("pp_headline") || "")),
        description: sanitizeText(String(formData.get("pp_desc") || "")),
        acceptButton: sanitizeText(String(formData.get("pp_accept") || "")),
        declineButton: sanitizeText(String(formData.get("pp_decline") || "")),
        urgencyLabel: sanitizeText(String(formData.get("pp_urgency") || "")),
        scarcityNotice: sanitizeText(String(formData.get("pp_scarcity") || "")),
      },
      inCart: {
        sectionTitle: sanitizeText(String(formData.get("ic_title") || "")),
        addButton: sanitizeText(String(formData.get("ic_btn") || "")),
        saveBadge: sanitizeText(String(formData.get("ic_save") || "")),
      },
      shippingBar: {
        initialMessage: sanitizeText(String(formData.get("sb_initial") || "")),
        progressMessage: sanitizeText(String(formData.get("sb_progress") || "")),
        allUnlockedMessage: sanitizeText(String(formData.get("sb_unlocked") || "")),
      },
      exitIntent: {
        headline: sanitizeText(String(formData.get("ei_headline") || "")),
        bodyText: sanitizeText(String(formData.get("ei_body") || "")),
        buttonText: sanitizeText(String(formData.get("ei_btn") || "")),
        dismissText: sanitizeText(String(formData.get("ei_dismiss") || "")),
      },
      socialBar: {
        badgeText: sanitizeText(String(formData.get("sb_badge") || "")),
        vipCommunityLabel: sanitizeText(String(formData.get("sb_vip") || "")),
        whatsappMessage: sanitizeText(String(formData.get("sb_wa") || "")),
      },
      scarcityToast: {
        discountBadge: sanitizeText(String(formData.get("st_disc_b") || "")),
        discountText: sanitizeText(String(formData.get("st_disc_t") || "")),
        stockBadge: sanitizeText(String(formData.get("st_stock_b") || "")),
        stockText: sanitizeText(String(formData.get("st_stock_t") || "")),
        trendingBadge: sanitizeText(String(formData.get("st_trend_b") || "")),
        trendingText: sanitizeText(String(formData.get("st_trend_t") || "")),
        shippingBadge: sanitizeText(String(formData.get("st_ship_b") || "")),
        shippingText: sanitizeText(String(formData.get("st_ship_t") || "")),
      },
    };
  }

  const updatedJson = JSON.stringify(allTranslations);

  await prisma.translationConfig.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      dashboardLocale,
      storefrontLocale,
      translationsJson: updatedJson,
    },
    update: {
      dashboardLocale,
      storefrontLocale,
      translationsJson: updatedJson,
    },
  });

  const i18n = DASHBOARD_I18N[dashboardLocale] || DASHBOARD_I18N.en;

  return {
    ok: true,
    savedLang: editLang,
    allTranslations,
    message: i18n.savedSuccess || "Translations saved successfully.",
  };
};

export default function TranslationsPage() {
  const {
    dashboardLocale: initialDashLocale,
    storefrontLocale: initialSfLocale,
    allTranslations: initialAllTranslations,
    defaultsByLang,
    supportedLanguages,
    i18n,
  } = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [dashboardLocale, setDashboardLocale] = useState<SupportedLanguage>(initialDashLocale);
  const [storefrontLocale, setStorefrontLocale] = useState<SupportedLanguage>(initialSfLocale);
  const [editLang, setEditLang] = useState<SupportedLanguage>(initialSfLocale || "ar");
  const [allTranslations, setAllTranslations] = useState<Record<SupportedLanguage, FeatureTranslations>>(
    initialAllTranslations
  );
  const [activeTab, setActiveTab] = useState<string>("productScarcity");
  const [feedbackNotice, setFeedbackNotice] = useState<string>("");

  useEffect(() => {
    if (actionData?.allTranslations) {
      setAllTranslations(actionData.allTranslations);
    }
  }, [actionData]);

  const isRtl = isRtlLang(dashboardLocale);
  const isEditRtl = isRtlLang(editLang);
  const currentTrans = allTranslations[editLang] || defaultsByLang[editLang] || DEFAULT_ARABIC_TRANSLATIONS;

  const handleLoadPredefined = () => {
    const defaultCopy = defaultsByLang[editLang];
    if (defaultCopy) {
      setAllTranslations((prev) => ({
        ...prev,
        [editLang]: { ...defaultCopy },
      }));
      setFeedbackNotice(
        isRtl
          ? "تم تحميل النصوص النموذجية الجاهزة لهذه اللغة. انقر على حفظ التغييرات لتأكيدها."
          : "Predefined copy loaded for this language. Click Save to persist."
      );
      setTimeout(() => setFeedbackNotice(""), 5000);
    }
  };

  const handleResetAllLanguages = () => {
    setAllTranslations({ ...defaultsByLang });
    setFeedbackNotice(
      isRtl
        ? "تم تحميل النصوص النموذجية لكافة اللغات الـ 7. انقر على حفظ التغييرات لتأكيدها."
        : "Predefined copy loaded for all 7 languages. Click Save to persist."
    );
    setTimeout(() => setFeedbackNotice(""), 5000);
  };

  const updateField = (
    featureKey: keyof FeatureTranslations,
    field: string,
    val: string
  ) => {
    setAllTranslations((prev) => ({
      ...prev,
      [editLang]: {
        ...prev[editLang],
        [featureKey]: {
          ...(prev[editLang]?.[featureKey] || {}),
          [field]: val,
        },
      },
    }));
  };

  return (
    <s-page heading={isRtl ? "إدارة اللغات والترجمة" : "Translations & Language Settings"}>
      <style>{`
        .xpp-trans-container {
          max-width: 1060px;
          margin: 0 auto;
          padding: 20px 0 80px;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .xpp-card {
          background: #141414;
          border: 1px solid #282828;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 22px;
        }
        .xpp-card-title {
          font-size: 17px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 6px;
        }
        .xpp-card-desc {
          font-size: 13px;
          color: #b0b0b0;
          margin: 0 0 16px;
          line-height: 1.5;
        }
        .xpp-field-group {
          margin-bottom: 16px;
        }
        .xpp-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 6px;
        }
        .xpp-hint {
          font-size: 12px;
          color: #888888;
          margin-top: 4px;
        }
        .xpp-input {
          width: 100%;
          background: #1f1f1f;
          border: 1px solid #383838;
          border-radius: 8px;
          padding: 10px 14px;
          color: #ffffff;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .xpp-input:focus {
          border-color: #D4AF37;
          outline: none;
        }
        .xpp-row {
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .xpp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          text-decoration: none;
        }
        .xpp-btn--primary {
          background: linear-gradient(135deg, #FFD700 0%, #D4AF37 100%);
          color: #000000;
        }
        .xpp-btn--primary:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
        .xpp-btn--secondary {
          background: #242424;
          color: #ffffff;
          border: 1px solid #3d3d3d;
        }
        .xpp-btn--secondary:hover {
          background: #2e2e2e;
        }
        .xpp-tabs-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 1px solid #282828;
          padding-bottom: 12px;
        }
        .xpp-tab-btn {
          background: #1c1c1c;
          border: 1px solid #333333;
          color: #cccccc;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .xpp-tab-btn.is-active {
          background: #D4AF37;
          color: #000000;
          border-color: #D4AF37;
        }
        .xpp-chip {
          display: inline-block;
          background: rgba(212, 175, 55, 0.15);
          border: 1px solid rgba(212, 175, 55, 0.4);
          color: #FFD700;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          margin: 0 4px;
          user-select: none;
        }
        .xpp-pill-btn {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid #383838;
          background: #1e1e1e;
          color: #d4d4d8;
          transition: all 0.15s ease;
        }
        .xpp-pill-btn.active {
          background: #D4AF37;
          color: #000000;
          border-color: #D4AF37;
        }
      `}</style>

      <div className="xpp-trans-container" dir={isRtl ? "rtl" : "ltr"}>
        {actionData?.message && (
          <div
            style={{
              background: "#143d1a",
              borderLeft: isRtl ? "none" : "4px solid #4ade80",
              borderRight: isRtl ? "4px solid #4ade80" : "none",
              padding: "14px 18px",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: 800, color: "#4ade80" }}>
              {isRtl ? "تم التحديث" : "Success"}
            </div>
            <p style={{ margin: "4px 0 0", color: "#ffffff", fontSize: 13 }}>
              {actionData.message}
            </p>
          </div>
        )}

        {feedbackNotice && (
          <div
            style={{
              background: "#262312",
              borderLeft: isRtl ? "none" : "4px solid #D4AF37",
              borderRight: isRtl ? "4px solid #D4AF37" : "none",
              padding: "12px 16px",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <p style={{ margin: 0, color: "#fef08a", fontSize: 13, fontWeight: 600 }}>
              {feedbackNotice}
            </p>
          </div>
        )}

        <Form method="post">
          <input type="hidden" name="actionType" value="save" />
          <input type="hidden" name="dashboardLocale" value={dashboardLocale} />
          <input type="hidden" name="storefrontLocale" value={storefrontLocale} />
          <input type="hidden" name="editLang" value={editLang} />

          {/* 1. Global Language Settings Card */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">
              {isRtl ? "إعدادات اللغة والاتجاه العامة" : "Global Language & Locale Settings"}
            </h2>
            <p className="xpp-card-desc">
              {isRtl
                ? "اختر لغة لوحة تحكم التاجر ولغة واجهة المتجر الافتراضية للعملاء من بين 7 لغات عالمية."
                : "Choose your preferred merchant dashboard language and the default customer storefront language from 7 global e-commerce languages."}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {/* Dashboard Language */}
              <div
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <label className="xpp-label" htmlFor="dash-locale-select">
                  {isRtl ? "لغة لوحة التحكم" : "Dashboard Language"}
                </label>
                <div style={{ marginTop: 10 }}>
                  <select
                    id="dash-locale-select"
                    className="xpp-input"
                    value={dashboardLocale}
                    onChange={(e) => setDashboardLocale(e.target.value as SupportedLanguage)}
                    style={{ cursor: "pointer", fontWeight: 600, color: "#F3E5AB" }}
                  >
                    {supportedLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code} style={{ background: "#1a1a1a", color: "#f4f4f5" }}>
                        {lang.nativeName} ({lang.label}) {lang.dir === "rtl" ? "[RTL]" : "[LTR]"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Default Storefront Language */}
              <div
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <label className="xpp-label" htmlFor="sf-locale-select">
                  {isRtl ? "لغة واجهة المتجر الافتراضية للعملاء" : "Default Storefront Language"}
                </label>
                <div style={{ marginTop: 10 }}>
                  <select
                    id="sf-locale-select"
                    className="xpp-input"
                    value={storefrontLocale}
                    onChange={(e) => setStorefrontLocale(e.target.value as SupportedLanguage)}
                    style={{ cursor: "pointer", fontWeight: 600, color: "#F3E5AB" }}
                  >
                    {supportedLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code} style={{ background: "#1a1a1a", color: "#f4f4f5" }}>
                        {lang.nativeName} ({lang.label}) {lang.dir === "rtl" ? "[RTL]" : "[LTR]"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>


          {/* 2. Feature Translation Editor Card with 7-Language Switcher */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">
              {isRtl ? "تخصيص نصوص ميزات المتجر" : "Feature Translation Editor"}
            </h2>
            <p className="xpp-card-desc">
              {isRtl
                ? "حدد اللغة التي ترغب بتعديل نصوصها ثم اختر الميزة لتعديل رسائلها وشاراتها بحرية."
                : "Select the language you want to edit, then switch between conversion features to customize labels, badges, and notices."}
            </p>

            {/* In-Feature Language Switcher for all 7 languages */}
            <FeatureLanguageSwitcher
              selectedLang={editLang}
              onSelectLang={(lang) => setEditLang(lang)}
              onLoadPredefined={handleLoadPredefined}
              dashboardLocale={dashboardLocale}
            />

            {/* Feature Tabs */}
            <div className="xpp-tabs-bar">
              <button
                type="button"
                className={`xpp-tab-btn ${activeTab === "productScarcity" ? "is-active" : ""}`}
                onClick={() => setActiveTab("productScarcity")}
              >
                {isRtl ? "ندرة مخزون المنتج" : "Product Stock Scarcity"}
              </button>
              <button
                type="button"
                className={`xpp-tab-btn ${activeTab === "prePurchase" ? "is-active" : ""}`}
                onClick={() => setActiveTab("prePurchase")}
              >
                {isRtl ? "عروض ما قبل الدفع" : "Pre-Purchase Upsell"}
              </button>
              <button
                type="button"
                className={`xpp-tab-btn ${activeTab === "inCart" ? "is-active" : ""}`}
                onClick={() => setActiveTab("inCart")}
              >
                {isRtl ? "عروض سلة الشراء" : "Cart Drawer Upsells"}
              </button>
              <button
                type="button"
                className={`xpp-tab-btn ${activeTab === "shippingBar" ? "is-active" : ""}`}
                onClick={() => setActiveTab("shippingBar")}
              >
                {isRtl ? "شريط الشحن المجاني" : "Free Shipping Bar"}
              </button>
              <button
                type="button"
                className={`xpp-tab-btn ${activeTab === "exitIntent" ? "is-active" : ""}`}
                onClick={() => setActiveTab("exitIntent")}
              >
                {isRtl ? "استعادة الزوار" : "Exit-Intent Recovery"}
              </button>
              <button
                type="button"
                className={`xpp-tab-btn ${activeTab === "socialBar" ? "is-active" : ""}`}
                onClick={() => setActiveTab("socialBar")}
              >
                {isRtl ? "شريط الدعم والتواصل" : "Support & Social Bar"}
              </button>
              <button
                type="button"
                className={`xpp-tab-btn ${activeTab === "scarcityToast" ? "is-active" : ""}`}
                onClick={() => setActiveTab("scarcityToast")}
              >
                {isRtl ? "إشعارات الشراء العاجلة" : "Urgency Toasts"}
              </button>
            </div>

            {/* Tab 1: Product Scarcity */}
            {activeTab === "productScarcity" && (
              <div dir={isEditRtl ? "rtl" : "ltr"}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>
                    {isRtl ? "المتغيرات المتاحة:" : "Available Placeholders:"}
                  </span>
                  <span
                    className="xpp-chip"
                    onClick={() =>
                      updateField(
                        "productScarcity",
                        "headlineText",
                        (currentTrans.productScarcity?.headlineText || "") + " {stock}"
                      )
                    }
                  >
                    + &#123;stock&#125;
                  </span>
                  <span
                    className="xpp-chip"
                    onClick={() =>
                      updateField(
                        "productScarcity",
                        "headlineText",
                        (currentTrans.productScarcity?.headlineText || "") + " {viewers}"
                      )
                    }
                  >
                    + &#123;viewers&#125;
                  </span>
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "عنوان ندرة المخزون" : "Headline Template"}
                  </label>
                  <input
                    type="text"
                    name="ps_headline"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.productScarcity?.headlineText || ""}
                    onChange={(e) =>
                      updateField("productScarcity", "headlineText", e.target.value)
                    }
                  />
                  <div className="xpp-hint">
                    {isRtl
                      ? "مثال: كمية محدودة: متبقي {stock} قطع فقط في المخزون"
                      : "Default: Hurry! Only {stock} items left in stock"}
                  </div>
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "النص الفرعي / إشعار الإقبال" : "Subtitle / Reassurance Note"}
                  </label>
                  <input
                    type="text"
                    name="ps_subtext"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.productScarcity?.subText || ""}
                    onChange={(e) =>
                      updateField("productScarcity", "subText", e.target.value)
                    }
                  />
                  <div className="xpp-hint">
                    {isRtl ? "مثال: طلب مرتفع: ينفد سريعاً" : "Default: High demand: selling fast"}
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "شارة التنبيه" : "Badge Tag Label"}</label>
                    <input
                      type="text"
                      name="ps_badge"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.productScarcity?.badgeText || ""}
                      onChange={(e) =>
                        updateField("productScarcity", "badgeText", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "نص المشاهدين المباشر" : "Live Viewers Suffix"}
                    </label>
                    <input
                      type="text"
                      name="ps_suffix"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.productScarcity?.viewingSuffix || ""}
                      onChange={(e) =>
                        updateField("productScarcity", "viewingSuffix", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Pre-Purchase */}
            {activeTab === "prePurchase" && (
              <div dir={isEditRtl ? "rtl" : "ltr"}>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "شارة العرض العلوية" : "Modal Top Tag"}
                    </label>
                    <input
                      type="text"
                      name="pp_tag"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.prePurchase?.offerTag || ""}
                      onChange={(e) =>
                        updateField("prePurchase", "offerTag", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "عنوان نافذة العرض" : "Offer Headline"}
                    </label>
                    <input
                      type="text"
                      name="pp_headline"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.prePurchase?.headline || ""}
                      onChange={(e) =>
                        updateField("prePurchase", "headline", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "وصف العرض" : "Offer Description"}
                  </label>
                  <input
                    type="text"
                    name="pp_desc"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.prePurchase?.description || ""}
                    onChange={(e) =>
                      updateField("prePurchase", "description", e.target.value)
                    }
                  />
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "زر قبول العرض والإضافة" : "Accept Button Label"}
                    </label>
                    <input
                      type="text"
                      name="pp_accept"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.prePurchase?.acceptButton || ""}
                      onChange={(e) =>
                        updateField("prePurchase", "acceptButton", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "زر تخطي العرض" : "Decline Button Label"}
                    </label>
                    <input
                      type="text"
                      name="pp_decline"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.prePurchase?.declineButton || ""}
                      onChange={(e) =>
                        updateField("prePurchase", "declineButton", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "نص عداد الحجز الزمني" : "Urgency Timer Label"}
                    </label>
                    <input
                      type="text"
                      name="pp_urgency"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.prePurchase?.urgencyLabel || ""}
                      onChange={(e) =>
                        updateField("prePurchase", "urgencyLabel", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "ملاحظة حجز الكمية" : "Scarcity Allocation Note"}
                    </label>
                    <input
                      type="text"
                      name="pp_scarcity"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.prePurchase?.scarcityNotice || ""}
                      onChange={(e) =>
                        updateField("prePurchase", "scarcityNotice", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: In-Cart */}
            {activeTab === "inCart" && (
              <div dir={isEditRtl ? "rtl" : "ltr"}>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "عنوان قسم المنتجات المقترحة" : "In-Cart Drawer Section Title"}
                  </label>
                  <input
                    type="text"
                    name="ic_title"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.inCart?.sectionTitle || ""}
                    onChange={(e) =>
                      updateField("inCart", "sectionTitle", e.target.value)
                    }
                  />
                  <div className="xpp-hint">
                    {isRtl ? "مثال: منتجات يشتريها العملاء أيضاً" : "Default: Frequently Bought Together"}
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "نص زر الإضافة السريعة" : "Add to Cart Button Label"}
                    </label>
                    <input
                      type="text"
                      name="ic_btn"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.inCart?.addButton || ""}
                      onChange={(e) =>
                        updateField("inCart", "addButton", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "شارة التوفير / الخصم" : "Savings Badge Template"}
                    </label>
                    <input
                      type="text"
                      name="ic_save"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.inCart?.saveBadge || ""}
                      onChange={(e) =>
                        updateField("inCart", "saveBadge", e.target.value)
                      }
                    />
                    <div className="xpp-hint">
                      {isRtl ? "استخدم {discount} لنسبة الخصم" : "Use {discount} for percentage"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Shipping Bar */}
            {activeTab === "shippingBar" && (
              <div dir={isEditRtl ? "rtl" : "ltr"}>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "رسالة البداية (قبل إضافة منتجات كافية)" : "Initial Progress Message"}
                  </label>
                  <input
                    type="text"
                    name="sb_initial"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.shippingBar?.initialMessage || ""}
                    onChange={(e) =>
                      updateField("shippingBar", "initialMessage", e.target.value)
                    }
                  />
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "رسالة التقدم نحو المكافأة التالية" : "Progress Toward Reward Message"}
                  </label>
                  <input
                    type="text"
                    name="sb_progress"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.shippingBar?.progressMessage || ""}
                    onChange={(e) =>
                      updateField("shippingBar", "progressMessage", e.target.value)
                    }
                  />
                  <div className="xpp-hint">
                    {isRtl
                      ? "استخدم {amount} للمبلغ المتبقي، و {reward} لاسم المكافأة"
                      : "Use {amount} and {reward} placeholders"}
                  </div>
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "رسالة اكتمال كافة المكافآت" : "All Rewards Unlocked Message"}
                  </label>
                  <input
                    type="text"
                    name="sb_unlocked"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.shippingBar?.allUnlockedMessage || ""}
                    onChange={(e) =>
                      updateField("shippingBar", "allUnlockedMessage", e.target.value)
                    }
                  />
                </div>
              </div>
            )}

            {/* Tab 5: Exit Intent */}
            {activeTab === "exitIntent" && (
              <div dir={isEditRtl ? "rtl" : "ltr"}>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "عنوان نافذة الاستعادة" : "Modal Headline"}
                  </label>
                  <input
                    type="text"
                    name="ei_headline"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.exitIntent?.headline || ""}
                    onChange={(e) =>
                      updateField("exitIntent", "headline", e.target.value)
                    }
                  />
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "نص الرسالة والخصم" : "Body Text"}
                  </label>
                  <input
                    type="text"
                    name="ei_body"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.exitIntent?.bodyText || ""}
                    onChange={(e) =>
                      updateField("exitIntent", "bodyText", e.target.value)
                    }
                  />
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "زر تفعيل الخصم وإتمام الطلب" : "Claim Discount Button Label"}
                    </label>
                    <input
                      type="text"
                      name="ei_btn"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.exitIntent?.buttonText || ""}
                      onChange={(e) =>
                        updateField("exitIntent", "buttonText", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "رابط رفض الخصم والإغلاق" : "Dismiss / Decline Text"}
                    </label>
                    <input
                      type="text"
                      name="ei_dismiss"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.exitIntent?.dismissText || ""}
                      onChange={(e) =>
                        updateField("exitIntent", "dismissText", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 6: Social Bar */}
            {activeTab === "socialBar" && (
              <div dir={isEditRtl ? "rtl" : "ltr"}>
                <div className="xpp-field-group">
                  <label className="xpp-label">
                    {isRtl ? "نص شارة المساعدة السريعة" : "Badge Help Text"}
                  </label>
                  <input
                    type="text"
                    name="sb_badge"
                    className="xpp-input"
                    dir={isEditRtl ? "rtl" : "ltr"}
                    value={currentTrans.socialBar?.badgeText || ""}
                    onChange={(e) =>
                      updateField("socialBar", "badgeText", e.target.value)
                    }
                  />
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "اسم مجتمع الـ VIP" : "VIP Community Label"}
                    </label>
                    <input
                      type="text"
                      name="sb_vip"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.socialBar?.vipCommunityLabel || ""}
                      onChange={(e) =>
                        updateField("socialBar", "vipCommunityLabel", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "رسالة الواتساب التلقائية" : "Default WhatsApp Message"}
                    </label>
                    <input
                      type="text"
                      name="sb_wa"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.socialBar?.whatsappMessage || ""}
                      onChange={(e) =>
                        updateField("socialBar", "whatsappMessage", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 7: Urgency Toast */}
            {activeTab === "scarcityToast" && (
              <div dir={isEditRtl ? "rtl" : "ltr"}>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "شارة كود الخصم" : "Discount Badge"}
                    </label>
                    <input
                      type="text"
                      name="st_disc_b"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.scarcityToast?.discountBadge || ""}
                      onChange={(e) =>
                        updateField("scarcityToast", "discountBadge", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 2 }}>
                    <label className="xpp-label">
                      {isRtl ? "نص إشعار الخصم" : "Discount Toast Text"}
                    </label>
                    <input
                      type="text"
                      name="st_disc_t"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.scarcityToast?.discountText || ""}
                      onChange={(e) =>
                        updateField("scarcityToast", "discountText", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "شارة كمية المخزون" : "Stock Badge"}
                    </label>
                    <input
                      type="text"
                      name="st_stock_b"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.scarcityToast?.stockBadge || ""}
                      onChange={(e) =>
                        updateField("scarcityToast", "stockBadge", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 2 }}>
                    <label className="xpp-label">
                      {isRtl ? "نص إشعار ندرة المخزون" : "Stock Toast Text"}
                    </label>
                    <input
                      type="text"
                      name="st_stock_t"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.scarcityToast?.stockText || ""}
                      onChange={(e) =>
                        updateField("scarcityToast", "stockText", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "شارة الشراء المباشر" : "Trending Badge"}
                    </label>
                    <input
                      type="text"
                      name="st_trend_b"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.scarcityToast?.trendingBadge || ""}
                      onChange={(e) =>
                        updateField("scarcityToast", "trendingBadge", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 2 }}>
                    <label className="xpp-label">
                      {isRtl ? "نص إشعار الشراء الحديث" : "Trending Toast Text"}
                    </label>
                    <input
                      type="text"
                      name="st_trend_t"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.scarcityToast?.trendingText || ""}
                      onChange={(e) =>
                        updateField("scarcityToast", "trendingText", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">
                      {isRtl ? "شارة الشحن السريع" : "Shipping Badge"}
                    </label>
                    <input
                      type="text"
                      name="st_ship_b"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.scarcityToast?.shippingBadge || ""}
                      onChange={(e) =>
                        updateField("scarcityToast", "shippingBadge", e.target.value)
                      }
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 2 }}>
                    <label className="xpp-label">
                      {isRtl ? "نص إشعار الشحن المجاني" : "Shipping Toast Text"}
                    </label>
                    <input
                      type="text"
                      name="st_ship_t"
                      className="xpp-input"
                      dir={isEditRtl ? "rtl" : "ltr"}
                      value={currentTrans.scarcityToast?.shippingText || ""}
                      onChange={(e) =>
                        updateField("scarcityToast", "shippingText", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Bulk Quick Actions Card */}
          <div
            className="xpp-card"
            style={{
              background: "linear-gradient(135deg, #18150f 0%, #141414 100%)",
              border: "1px solid rgba(212, 175, 55, 0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div>
                <h2 className="xpp-card-title">
                  {isRtl ? "إعادة تعيين النصوص النموذجية" : "Reset to Predefined Defaults"}
                </h2>
                <p className="xpp-card-desc" style={{ margin: 0 }}>
                  {isRtl
                    ? "تحميل النصوص النموذجية لكافة اللغات الـ 7 دفعة واحدة بنقرة واحدة."
                    : "Load high-converting predefined copy across all 7 supported languages simultaneously."}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  className="xpp-btn xpp-btn--secondary"
                  onClick={handleResetAllLanguages}
                >
                  {isRtl
                    ? "تحميل النصوص النموذجية للـ 7 لغات"
                    : "Reset All 7 Languages to Predefined Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Save Action Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 24,
            }}
          >
            <button
              type="submit"
              disabled={isSaving}
              className="xpp-btn xpp-btn--primary"
              style={{ padding: "14px 36px", fontSize: 15 }}
            >
              {isSaving
                ? (isRtl ? "جارٍ الحفظ..." : "Saving...")
                : (isRtl ? "حفظ كافة التغييرات" : "Save All Translations")}
            </button>
          </div>
        </Form>
      </div>
    </s-page>
  );
}
