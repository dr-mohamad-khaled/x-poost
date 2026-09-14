import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import {
  DEFAULT_ARABIC_TRANSLATIONS,
  DEFAULT_ENGLISH_TRANSLATIONS,
  DASHBOARD_I18N,
  getMergedTranslations,
  sanitizeText,
  type FeatureTranslations,
} from "../utils/translations.server";

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
        translationsJson: JSON.stringify(DEFAULT_ARABIC_TRANSLATIONS),
      },
    });
  }

  const activeDashboardLocale = (config.dashboardLocale === "ar" ? "ar" : "en") as "en" | "ar";
  const activeStorefrontLocale = config.storefrontLocale || "ar";
  const mergedTranslations = getMergedTranslations(config.translationsJson, "ar");

  return {
    shopDomain: session.shop,
    dashboardLocale: activeDashboardLocale,
    storefrontLocale: activeStorefrontLocale,
    translations: mergedTranslations,
    defaultsAr: DEFAULT_ARABIC_TRANSLATIONS,
    defaultsEn: DEFAULT_ENGLISH_TRANSLATIONS,
    i18n: DASHBOARD_I18N[activeDashboardLocale],
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const actionType = String(formData.get("actionType") || "save");

  const dashboardLocale = String(formData.get("dashboardLocale") || "en");
  const storefrontLocale = String(formData.get("storefrontLocale") || "ar");

  let updatedTranslations: FeatureTranslations = DEFAULT_ARABIC_TRANSLATIONS;

  if (actionType === "apply_arabic") {
    updatedTranslations = DEFAULT_ARABIC_TRANSLATIONS;
  } else if (actionType === "reset_english") {
    updatedTranslations = DEFAULT_ENGLISH_TRANSLATIONS;
  } else {
    // Read granular inputs from form and sanitize
    updatedTranslations = {
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

  await prisma.translationConfig.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      dashboardLocale,
      storefrontLocale,
      translationsJson: JSON.stringify(updatedTranslations),
    },
    update: {
      dashboardLocale,
      storefrontLocale,
      translationsJson: JSON.stringify(updatedTranslations),
    },
  });

  return {
    ok: true,
    message: dashboardLocale === "ar" ? "تم حفظ الترجمات بنجاح" : "Translations saved successfully.",
  };
};

export default function TranslationsPage() {
  const {
    dashboardLocale: initialDashLocale,
    storefrontLocale: initialSfLocale,
    translations: initialTranslations,
    defaultsAr,
    defaultsEn,
    i18n,
  } = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [dashboardLocale, setDashboardLocale] = useState<"en" | "ar">(initialDashLocale);
  const [storefrontLocale, setStorefrontLocale] = useState(initialSfLocale);
  const [trans, setTrans] = useState<FeatureTranslations>(initialTranslations);
  const [activeTab, setActiveTab] = useState<string>("productScarcity");

  const isRtl = dashboardLocale === "ar";

  const applyArabicDefaults = () => {
    setTrans(defaultsAr);
  };

  const applyEnglishDefaults = () => {
    setTrans(defaultsEn);
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
      `}</style>

      <div className="xpp-trans-container" dir={isRtl ? "rtl" : "ltr"}>
        {actionData?.message && (
          <div style={{ background: "#143d1a", borderLeft: isRtl ? "none" : "4px solid #4ade80", borderRight: isRtl ? "4px solid #4ade80" : "none", padding: "14px 18px", borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, color: "#4ade80" }}>{isRtl ? "تم التحديث" : "Success"}</div>
            <p style={{ margin: "4px 0 0", color: "#ffffff", fontSize: 13 }}>{actionData.message}</p>
          </div>
        )}

        <Form method="post">
          <input type="hidden" name="actionType" value="save" />
          <input type="hidden" name="dashboardLocale" value={dashboardLocale} />
          <input type="hidden" name="storefrontLocale" value={storefrontLocale} />

          {/* 1. Language & Direction Control Card */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">{isRtl ? "إعدادات اللغة والاتجاه" : "Language & Locale Settings"}</h2>
            <p className="xpp-card-desc">
              {isRtl
                ? "اختر لغة لوحة تحكم التاجر ولغة واجهة المتجر المعروضة للعملاء."
                : "Choose your preferred merchant dashboard language and the active customer storefront language."}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Dashboard Language */}
              <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
                <label className="xpp-label">{isRtl ? "لغة لوحة التحكم" : "Dashboard Language"}</label>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className={`xpp-btn ${dashboardLocale === "ar" ? "xpp-btn--primary" : "xpp-btn--secondary"}`}
                    onClick={() => setDashboardLocale("ar")}
                    style={{ flex: 1 }}
                  >
                    العربية (RTL)
                  </button>
                  <button
                    type="button"
                    className={`xpp-btn ${dashboardLocale === "en" ? "xpp-btn--primary" : "xpp-btn--secondary"}`}
                    onClick={() => setDashboardLocale("en")}
                    style={{ flex: 1 }}
                  >
                    English (LTR)
                  </button>
                </div>
              </div>

              {/* Storefront Language */}
              <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
                <label className="xpp-label">{isRtl ? "لغة واجهة المتجر للعملاء" : "Storefront Language"}</label>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className={`xpp-btn ${storefrontLocale === "ar" ? "xpp-btn--primary" : "xpp-btn--secondary"}`}
                    onClick={() => setStorefrontLocale("ar")}
                    style={{ flex: 1 }}
                  >
                    العربية
                  </button>
                  <button
                    type="button"
                    className={`xpp-btn ${storefrontLocale === "en" ? "xpp-btn--primary" : "xpp-btn--secondary"}`}
                    onClick={() => setStorefrontLocale("en")}
                    style={{ flex: 1 }}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Quick Automated Translations Card */}
          <div className="xpp-card" style={{ background: "linear-gradient(135deg, #18150f 0%, #141414 100%)", border: "1px solid rgba(212, 175, 55, 0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 className="xpp-card-title">{isRtl ? "الترجمة التلقائية المباشرة" : "Automated Modern Translations"}</h2>
                <p className="xpp-card-desc" style={{ margin: 0 }}>
                  {isRtl
                    ? "تطبيق نصوص عربية فصحى معاصرة ومباشرة على كافة الميزات بنقرة واحدة."
                    : "Apply clean, direct Modern Standard Arabic copy across all conversion features with one click."}
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="xpp-btn xpp-btn--primary"
                  onClick={applyArabicDefaults}
                >
                  {isRtl ? "تطبيق الفصحى المعاصرة على الكل" : "Apply Modern Arabic to All"}
                </button>
                <button
                  type="button"
                  className="xpp-btn xpp-btn--secondary"
                  onClick={applyEnglishDefaults}
                >
                  {isRtl ? "استعادة النصوص الإنجليزية" : "Reset All to English"}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Granular Feature Tabs */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">{isRtl ? "تخصيص نصوص الميزات" : "Feature Translation Editor"}</h2>
            <p className="xpp-card-desc">
              {isRtl
                ? "حدد الميزة التي ترغب بتعديل نصوصها. يمكنك تعديل أي عبارة وحفظها مباشرة."
                : "Select a conversion feature below to customize its customer-facing messages and button labels."}
            </p>

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

            {/* Feature 1: Product Scarcity */}
            {activeTab === "productScarcity" && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{isRtl ? "المتغيرات المتاحة:" : "Available Placeholders:"}</span>
                  <span className="xpp-chip" onClick={() => setTrans(p => ({ ...p, productScarcity: { ...p.productScarcity, headlineText: p.productScarcity.headlineText + " {stock}" } }))}>+ &#123;stock&#125;</span>
                  <span className="xpp-chip" onClick={() => setTrans(p => ({ ...p, productScarcity: { ...p.productScarcity, headlineText: p.productScarcity.headlineText + " {viewers}" } }))}>+ &#123;viewers&#125;</span>
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "عنوان ندرة المخزون" : "Headline Template"}</label>
                  <input
                    type="text"
                    name="ps_headline"
                    className="xpp-input"
                    value={trans.productScarcity.headlineText}
                    onChange={(e) => setTrans(p => ({ ...p, productScarcity: { ...p.productScarcity, headlineText: e.target.value } }))}
                  />
                  <div className="xpp-hint">{isRtl ? "مثال: كمية محدودة: متبقي {stock} قطع فقط في المخزون" : "Default: Hurry! Only {stock} items left in stock"}</div>
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "النص الفرعي / إشعار الإقبال" : "Subtitle / Reassurance Note"}</label>
                  <input
                    type="text"
                    name="ps_subtext"
                    className="xpp-input"
                    value={trans.productScarcity.subText}
                    onChange={(e) => setTrans(p => ({ ...p, productScarcity: { ...p.productScarcity, subText: e.target.value } }))}
                  />
                  <div className="xpp-hint">{isRtl ? "مثال: طلب مرتفع: ينفد سريعاً" : "Default: High demand: selling fast"}</div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "شارة التنبيه" : "Badge Tag Label"}</label>
                    <input
                      type="text"
                      name="ps_badge"
                      className="xpp-input"
                      value={trans.productScarcity.badgeText}
                      onChange={(e) => setTrans(p => ({ ...p, productScarcity: { ...p.productScarcity, badgeText: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "نص المشاهدين المباشر" : "Live Viewers Suffix"}</label>
                    <input
                      type="text"
                      name="ps_suffix"
                      className="xpp-input"
                      value={trans.productScarcity.viewingSuffix}
                      onChange={(e) => setTrans(p => ({ ...p, productScarcity: { ...p.productScarcity, viewingSuffix: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Feature 2: Pre-Purchase */}
            {activeTab === "prePurchase" && (
              <div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "شارة العرض العلوية" : "Modal Top Tag"}</label>
                    <input
                      type="text"
                      name="pp_tag"
                      className="xpp-input"
                      value={trans.prePurchase.offerTag}
                      onChange={(e) => setTrans(p => ({ ...p, prePurchase: { ...p.prePurchase, offerTag: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "عنوان نافذة العرض" : "Offer Headline"}</label>
                    <input
                      type="text"
                      name="pp_headline"
                      className="xpp-input"
                      value={trans.prePurchase.headline}
                      onChange={(e) => setTrans(p => ({ ...p, prePurchase: { ...p.prePurchase, headline: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "وصف العرض" : "Offer Description"}</label>
                  <input
                    type="text"
                    name="pp_desc"
                    className="xpp-input"
                    value={trans.prePurchase.description}
                    onChange={(e) => setTrans(p => ({ ...p, prePurchase: { ...p.prePurchase, description: e.target.value } }))}
                  />
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "زر قبول العرض والإضافة" : "Accept Button Label"}</label>
                    <input
                      type="text"
                      name="pp_accept"
                      className="xpp-input"
                      value={trans.prePurchase.acceptButton}
                      onChange={(e) => setTrans(p => ({ ...p, prePurchase: { ...p.prePurchase, acceptButton: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "زر تخطي العرض" : "Decline Button Label"}</label>
                    <input
                      type="text"
                      name="pp_decline"
                      className="xpp-input"
                      value={trans.prePurchase.declineButton}
                      onChange={(e) => setTrans(p => ({ ...p, prePurchase: { ...p.prePurchase, declineButton: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "نص عداد الحجز الزمني" : "Urgency Timer Label"}</label>
                    <input
                      type="text"
                      name="pp_urgency"
                      className="xpp-input"
                      value={trans.prePurchase.urgencyLabel}
                      onChange={(e) => setTrans(p => ({ ...p, prePurchase: { ...p.prePurchase, urgencyLabel: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "ملاحظة حجز الكمية" : "Scarcity Allocation Note"}</label>
                    <input
                      type="text"
                      name="pp_scarcity"
                      className="xpp-input"
                      value={trans.prePurchase.scarcityNotice}
                      onChange={(e) => setTrans(p => ({ ...p, prePurchase: { ...p.prePurchase, scarcityNotice: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Feature 3: In-Cart */}
            {activeTab === "inCart" && (
              <div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "عنوان قسم المنتجات المقترحة" : "In-Cart Drawer Section Title"}</label>
                  <input
                    type="text"
                    name="ic_title"
                    className="xpp-input"
                    value={trans.inCart.sectionTitle}
                    onChange={(e) => setTrans(p => ({ ...p, inCart: { ...p.inCart, sectionTitle: e.target.value } }))}
                  />
                  <div className="xpp-hint">{isRtl ? "مثال: منتجات يشتريها العملاء أيضاً" : "Default: Frequently Bought Together"}</div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "نص زر الإضافة السريعة" : "Add to Cart Button Label"}</label>
                    <input
                      type="text"
                      name="ic_btn"
                      className="xpp-input"
                      value={trans.inCart.addButton}
                      onChange={(e) => setTrans(p => ({ ...p, inCart: { ...p.inCart, addButton: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "شارة التوفير / الخصم" : "Savings Badge Template"}</label>
                    <input
                      type="text"
                      name="ic_save"
                      className="xpp-input"
                      value={trans.inCart.saveBadge}
                      onChange={(e) => setTrans(p => ({ ...p, inCart: { ...p.inCart, saveBadge: e.target.value } }))}
                    />
                    <div className="xpp-hint">{isRtl ? "استخدم {discount} لنسبة الخصم" : "Use {discount} for percentage"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Feature 4: Shipping Bar */}
            {activeTab === "shippingBar" && (
              <div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "رسالة البداية (قبل إضافة منتجات كافية)" : "Initial Progress Message"}</label>
                  <input
                    type="text"
                    name="sb_initial"
                    className="xpp-input"
                    value={trans.shippingBar.initialMessage}
                    onChange={(e) => setTrans(p => ({ ...p, shippingBar: { ...p.shippingBar, initialMessage: e.target.value } }))}
                  />
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "رسالة التقدم نحو المكافأة التالية" : "Progress Toward Reward Message"}</label>
                  <input
                    type="text"
                    name="sb_progress"
                    className="xpp-input"
                    value={trans.shippingBar.progressMessage}
                    onChange={(e) => setTrans(p => ({ ...p, shippingBar: { ...p.shippingBar, progressMessage: e.target.value } }))}
                  />
                  <div className="xpp-hint">{isRtl ? "استخدم {amount} للمبلغ المتبقي، و {reward} لاسم المكافأة" : "Use {amount} and {reward} placeholders"}</div>
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "رسالة اكتمال كافة المكافآت" : "All Rewards Unlocked Message"}</label>
                  <input
                    type="text"
                    name="sb_unlocked"
                    className="xpp-input"
                    value={trans.shippingBar.allUnlockedMessage}
                    onChange={(e) => setTrans(p => ({ ...p, shippingBar: { ...p.shippingBar, allUnlockedMessage: e.target.value } }))}
                  />
                </div>
              </div>
            )}

            {/* Feature 5: Exit Intent */}
            {activeTab === "exitIntent" && (
              <div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "عنوان نافذة الاستعادة" : "Modal Headline"}</label>
                  <input
                    type="text"
                    name="ei_headline"
                    className="xpp-input"
                    value={trans.exitIntent.headline}
                    onChange={(e) => setTrans(p => ({ ...p, exitIntent: { ...p.exitIntent, headline: e.target.value } }))}
                  />
                </div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "نص الرسالة والخصم" : "Body Text"}</label>
                  <input
                    type="text"
                    name="ei_body"
                    className="xpp-input"
                    value={trans.exitIntent.bodyText}
                    onChange={(e) => setTrans(p => ({ ...p, exitIntent: { ...p.exitIntent, bodyText: e.target.value } }))}
                  />
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "زر تفعيل الخصم وإتمام الطلب" : "Claim Discount Button Label"}</label>
                    <input
                      type="text"
                      name="ei_btn"
                      className="xpp-input"
                      value={trans.exitIntent.buttonText}
                      onChange={(e) => setTrans(p => ({ ...p, exitIntent: { ...p.exitIntent, buttonText: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "رابط رفض الخصم والإغلاق" : "Dismiss / Decline Text"}</label>
                    <input
                      type="text"
                      name="ei_dismiss"
                      className="xpp-input"
                      value={trans.exitIntent.dismissText}
                      onChange={(e) => setTrans(p => ({ ...p, exitIntent: { ...p.exitIntent, dismissText: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Feature 6: Social Bar */}
            {activeTab === "socialBar" && (
              <div>
                <div className="xpp-field-group">
                  <label className="xpp-label">{isRtl ? "نص شارة المساعدة السريعة" : "Badge Help Text"}</label>
                  <input
                    type="text"
                    name="sb_badge"
                    className="xpp-input"
                    value={trans.socialBar.badgeText}
                    onChange={(e) => setTrans(p => ({ ...p, socialBar: { ...p.socialBar, badgeText: e.target.value } }))}
                  />
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "اسم مجتمع الـ VIP" : "VIP Community Label"}</label>
                    <input
                      type="text"
                      name="sb_vip"
                      className="xpp-input"
                      value={trans.socialBar.vipCommunityLabel}
                      onChange={(e) => setTrans(p => ({ ...p, socialBar: { ...p.socialBar, vipCommunityLabel: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "رسالة الواتساب التلقائية" : "Default WhatsApp Message"}</label>
                    <input
                      type="text"
                      name="sb_wa"
                      className="xpp-input"
                      value={trans.socialBar.whatsappMessage}
                      onChange={(e) => setTrans(p => ({ ...p, socialBar: { ...p.socialBar, whatsappMessage: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Feature 7: Urgency Toast */}
            {activeTab === "scarcityToast" && (
              <div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "شارة كود الخصم" : "Discount Badge"}</label>
                    <input
                      type="text"
                      name="st_disc_b"
                      className="xpp-input"
                      value={trans.scarcityToast.discountBadge}
                      onChange={(e) => setTrans(p => ({ ...p, scarcityToast: { ...p.scarcityToast, discountBadge: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 2 }}>
                    <label className="xpp-label">{isRtl ? "نص إشعار الخصم" : "Discount Toast Text"}</label>
                    <input
                      type="text"
                      name="st_disc_t"
                      className="xpp-input"
                      value={trans.scarcityToast.discountText}
                      onChange={(e) => setTrans(p => ({ ...p, scarcityToast: { ...p.scarcityToast, discountText: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "شارة كمية المخزون" : "Stock Badge"}</label>
                    <input
                      type="text"
                      name="st_stock_b"
                      className="xpp-input"
                      value={trans.scarcityToast.stockBadge}
                      onChange={(e) => setTrans(p => ({ ...p, scarcityToast: { ...p.scarcityToast, stockBadge: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 2 }}>
                    <label className="xpp-label">{isRtl ? "نص إشعار ندرة المخزون" : "Stock Toast Text"}</label>
                    <input
                      type="text"
                      name="st_stock_t"
                      className="xpp-input"
                      value={trans.scarcityToast.stockText}
                      onChange={(e) => setTrans(p => ({ ...p, scarcityToast: { ...p.scarcityToast, stockText: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "شارة الشراء المباشر" : "Trending Badge"}</label>
                    <input
                      type="text"
                      name="st_trend_b"
                      className="xpp-input"
                      value={trans.scarcityToast.trendingBadge}
                      onChange={(e) => setTrans(p => ({ ...p, scarcityToast: { ...p.scarcityToast, trendingBadge: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 2 }}>
                    <label className="xpp-label">{isRtl ? "نص إشعار الشراء الحديث" : "Trending Toast Text"}</label>
                    <input
                      type="text"
                      name="st_trend_t"
                      className="xpp-input"
                      value={trans.scarcityToast.trendingText}
                      onChange={(e) => setTrans(p => ({ ...p, scarcityToast: { ...p.scarcityToast, trendingText: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="xpp-row">
                  <div className="xpp-field-group" style={{ flex: 1 }}>
                    <label className="xpp-label">{isRtl ? "شارة الشحن السريع" : "Shipping Badge"}</label>
                    <input
                      type="text"
                      name="st_ship_b"
                      className="xpp-input"
                      value={trans.scarcityToast.shippingBadge}
                      onChange={(e) => setTrans(p => ({ ...p, scarcityToast: { ...p.scarcityToast, shippingBadge: e.target.value } }))}
                    />
                  </div>
                  <div className="xpp-field-group" style={{ flex: 2 }}>
                    <label className="xpp-label">{isRtl ? "نص إشعار الشحن المجاني" : "Shipping Toast Text"}</label>
                    <input
                      type="text"
                      name="st_ship_t"
                      className="xpp-input"
                      value={trans.scarcityToast.shippingText}
                      onChange={(e) => setTrans(p => ({ ...p, scarcityToast: { ...p.scarcityToast, shippingText: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Save Action Bar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
            <button
              type="submit"
              disabled={isSaving}
              className="xpp-btn xpp-btn--primary"
              style={{ padding: "14px 32px", fontSize: 15 }}
            >
              {isSaving
                ? (isRtl ? "جارٍ الحفظ..." : "Saving...")
                : (isRtl ? "حفظ التغييرات" : "Save Translations")}
            </button>
          </div>
        </Form>
      </div>
    </s-page>
  );
}
