import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useFetcher, useLoaderData, useLocation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { FeatureDemoBanner, demoIdFromPath } from "../components/FeatureDemo";
import { EXIT_INTENT_AVAILABLE } from "../utils/features";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  DASHBOARD_I18N,
} from "../utils/translations";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentApiKey = (process.env.SHOPIFY_API_KEY || "872f7f6415d1c243c11ccdfe9426b07f").trim();
  try {
    const { session } = await authenticate.admin(request);
    const shop = await getOrCreateShop(session.shop);
    const translationConfig = await prisma.translationConfig.findUnique({
      where: { shopId: shop.id },
    });

    const rawLocale = translationConfig?.dashboardLocale || "en";
    const validLocales: SupportedLanguage[] = ["ar", "en", "fr", "de", "es", "it", "pt"];
    const dashboardLocale: SupportedLanguage = validLocales.includes(rawLocale as any)
      ? (rawLocale as SupportedLanguage)
      : "en";

    const i18n = DASHBOARD_I18N[dashboardLocale] || DASHBOARD_I18N.en;

    return { apiKey: currentApiKey, dashboardLocale, i18n };
  } catch (error: any) {
    if (error instanceof Response) {
      const isXhr = Boolean(request.headers.get("authorization"));
      console.error("[AUTH_FAIL_RESPONSE]", {
        url: request.url,
        status: error.status,
        statusText: error.statusText,
        isXhr,
        headers: Object.fromEntries(error.headers.entries()),
      });

      const url = new URL(request.url);
      const shop = url.searchParams.get("shop");
      if (error.status === 401 && shop && !isXhr) {
        const cleanShop = shop.replace(".myshopify.com", "");
        const installUrl = `https://admin.shopify.com/store/${cleanShop}/oauth/install?client_id=${currentApiKey}`;
        console.log("[AUTH_RECOVERY] Breaking out of iframe to install URL:", installUrl);
        throw new Response(
          `<!DOCTYPE html><html><head><script>window.top.location.href = ${JSON.stringify(installUrl)};</script></head><body>Redirecting to Shopify authorization...</body></html>`,
          {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
          }
        );
      }
    } else {
      console.error("[AUTH_FAIL_ERROR]", error?.message || error);
    }
    throw error;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = await getOrCreateShop(session.shop);
    const formData = await request.formData();
    const actionType = String(formData.get("actionType") || "");

    if (actionType === "setDashboardLocale") {
      const locale = String(formData.get("locale") || "en");
      const validLocales = ["ar", "en", "fr", "de", "es", "it", "pt"];
      const targetLocale = validLocales.includes(locale) ? locale : "en";

      await prisma.translationConfig.upsert({
        where: { shopId: shop.id },
        update: { dashboardLocale: targetLocale },
        create: {
          shopId: shop.id,
          dashboardLocale: targetLocale,
          storefrontLocale: "ar",
          translationsJson: "{}",
        },
      });

      return { ok: true, dashboardLocale: targetLocale };
    }

    const featureKey = String(formData.get("featureKey") || "");
    const enable = formData.get("enable") === "true";

    const featureFieldMap: Record<string, string> = {
      scarcity: "scarcityEnabled",
      prePurchase: "prePurchaseEnabled",
      inCart: "inCartUpsellEnabled",
      socialBar: "socialBarEnabled",
      shippingBar: "shippingBarEnabled",
      exitIntent: "exitIntentEnabled",
      productScarcity: "productScarcityEnabled",
      quantityBreaks: "quantityBreaksEnabled",
      thankYou: "thankYouEnabled",
    };

    const field = featureFieldMap[featureKey];
    if (!field) {
      return { ok: false, error: "Unknown feature" };
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: { [field]: enable },
    });

    return { ok: true, featureKey, enable };
  } catch (err: any) {
    console.error("[ACTION_ERROR in app.tsx]", err?.stack || err?.message || err);
    if (err instanceof Response) throw err;
    return { ok: false, error: err?.message || "Failed to update feature" };
  }
};

export default function App() {
  const { apiKey, dashboardLocale, i18n } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const { pathname } = useLocation();
  const demoId = demoIdFromPath(pathname);
  const isAr = dashboardLocale === "ar";

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    fetcher.submit(
      { actionType: "setDashboardLocale", locale: newLang },
      { method: "post", action: "/app" }
    );
  };

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">{i18n.navOverview || "Overview"}</a>
        <a href="/app/analytics">{(i18n as any).navAnalytics || "Analytics"}</a>
        <a href="/app/pricing">{i18n.navPricing || "Plans & Pricing"}</a>
        <a href="/app/translations">{i18n.navTranslations || "Translations & Languages"}</a>
        <a href="/app/pre-purchase">{i18n.navPrePurchase || "Pre-Purchase Upsell"}</a>
        <a href="/app/in-cart">{i18n.navInCart || "Cart Drawer Upsell"}</a>
        <a href="/app/thank-you">{(i18n as any).navThankYou || "Thank-you Page Upsell"}</a>
        <a href="/app/shipping-bar">{i18n.navShippingBar || "Free Shipping Bar"}</a>
        <a href="/app/quantity-breaks">{i18n.navQuantityBreaks || "Quantity Breaks"}</a>
        <a href="/app/product-scarcity">{i18n.navProductScarcity || "Product Stock Scarcity"}</a>
        <a href="/app/social-bar">{i18n.navSocialBar || "Support & Social Bar"}</a>
        <a href="/app/scarcity">{i18n.navUrgency || "Urgency Notifications"}</a>
        <a href="/app/help">{i18n.navHelp || "Help & Guide"}</a>
        {EXIT_INTENT_AVAILABLE ? <a href="/app/exit-intent">{i18n.navExitIntent || "Exit-Intent Recovery"}</a> : null}
      </NavMenu>

      <div dir={isAr ? "rtl" : "ltr"} style={{ width: "100%", minHeight: "100vh", background: "radial-gradient(900px 520px at 8% -6%, rgba(255,235,151,0.085), transparent 62%), radial-gradient(820px 620px at 100% 0%, rgba(88,55,20,0.42), transparent 62%), linear-gradient(180deg, #120B05 0%, #0C0803 480px)" }}>
        <style>{`
          /* GLOBAL DARK THEME RESETS */
          
          /* High-Contrast Gold Section Titles with Dividers */
          .xp-section-title {
            font-size: 16px !important;
            font-weight: 700 !important;
            color: #E8C872 !important;
            margin: 0 0 16px 0 !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
                        border-bottom: 1px solid #3A2B17 !important;
            padding-bottom: 12px !important;
          }

          .xp-help-link {
            display: inline-flex; align-items: center; gap: 7px;
            padding: 6px 14px; border-radius: 999px;
            border: 1px solid rgba(232,200,114,0.4);
            background: transparent;
            color: #FFEB97 !important; font-size: 12px; font-weight: 700;
            text-decoration: none !important; cursor: pointer;
            transition: background .2s, border-color .2s;
          }
          .xp-help-link:hover, .xp-help-link.is-active {
            background: rgba(232,200,114,0.14); border-color: rgba(232,200,114,0.7);
          }
          .xp-help-q {
            display: inline-grid; place-items: center; width: 18px; height: 18px;
            border-radius: 50%; background: linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%); color: #0C0803;
            font-size: 11px; font-weight: 900;
          }

          :root {
            --p-color-bg-surface: #150E07;
            --p-color-bg-surface-secondary: #1D150C;
            --p-color-text: #ffffff;
            --p-color-text-secondary: #9E957B;
            --p-color-border: #3A2B17;
            color-scheme: dark;
          }
          body, html {
            background-color: #0C0803 !important;
            color: #ffffff !important;
          }
          s-page, s-section, s-card {
            --p-color-bg-surface: #150E07 !important;
            --p-color-bg-surface-secondary: #1D150C !important;
            --p-color-text: #ffffff !important;
            --p-color-text-secondary: #9E957B !important;
            --p-color-border: #3A2B17 !important;
            color: #ffffff !important;
          }
          s-section, s-card {
            background: #150E07 !important;
            border: 1px solid #3A2B17 !important;
            border-radius: 12px !important;
          }
        `}</style>
        {/* Global Dashboard Top Bar with 7-Language Switcher */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "10px 20px",
            background: "linear-gradient(180deg, rgba(40,26,12,0.92), rgba(14,9,4,0.92))", backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(255,235,151,0.14)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
                fontSize: "16px",
                fontWeight: 600,
                background: "linear-gradient(90deg, #FFEB97, #D6AE5B 60%, #B8863B)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              }}
            >
              XPoost
            </span>
            <span style={{ fontSize: "12px", color: "#7F7863" }}>|</span>
            <span style={{ fontSize: "12px", color: "#9E957B", fontWeight: 500 }}>
              {i18n.dashboardLangTitle || "Dashboard Language"}:
            </span>
          </div>

          {/* Quick Language Switcher Dropdown + Help & Guide */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link
              to="/app/help"
              className={`xp-help-link${pathname.startsWith("/app/help") ? " is-active" : ""}`}
              aria-label={i18n.navHelp || "Help & Guide"}
            >
              <span className="xp-help-q">?</span>
              {i18n.navHelp || "Help & Guide"}
            </Link>
            <select
              id="top-dashboard-lang-select"
              value={dashboardLocale}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              style={{
                background: "#1D150C",
                color: "#FFEB97",
                border: "1px solid #4D3B22",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
                appearance: "auto",
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option
                  key={lang.code}
                  value={lang.code}
                  style={{ background: "#1D150C", color: "#f4f4f5" }}
                >
                  {lang.nativeName} ({lang.label}) {lang.dir === "rtl" ? "[RTL]" : ""}
                </option>
              ))}
            </select>
          </div>

        </header>

        <main style={{ padding: "0 4px" }}>
          <FeatureDemoBanner id={demoId} />
          <Outlet context={{ dashboardLocale, isAr, i18n }} />
        </main>
      </div>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
