import { useState, useEffect } from "react";
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
import { TranslationProvider, translateText } from "../components/Translate";
import { SupportChat } from "../components/SupportChat";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentApiKey = (process.env.SHOPIFY_API_KEY || "872f7f6415d1c243c11ccdfe9426b07f").trim().replace(/^["']|["']$/g, "").trim();
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

    // Merchant support chat (tawk.to). Public widget IDs, kept in the environment like every other setting.
    const supportChat = {
      propertyId: (process.env.TAWK_PROPERTY_ID || "").trim(),
      widgetId: (process.env.TAWK_WIDGET_ID || "").trim(),
      shop: session.shop,
    };

    return { apiKey: currentApiKey, dashboardLocale, i18n, supportChat };
  } catch (error: any) {
    if (error instanceof Response) {
      const isXhr = Boolean(request.headers.get("authorization"));
      console.error("[AUTH_FAIL_RESPONSE]", {
        path: new URL(request.url).pathname,
        status: error.status,
        statusText: error.statusText,
        isXhr,
      });

      const url = new URL(request.url);
      const rawShop = url.searchParams.get("shop") || "";
      let shop = /^[a-z0-9][a-z0-9-]*(\.myshopify\.com)?$/i.test(rawShop) ? rawShop : null;

      if (!shop) {
        const host = url.searchParams.get("host");
        if (host) {
          try {
            const decoded = Buffer.from(host, "base64").toString("utf-8");
            const match = decoded.match(/admin\.shopify\.com\/store\/([a-z0-9-]+)/i) || decoded.match(/([a-z0-9-]+)\.myshopify\.com/i);
            if (match && match[1]) {
              shop = `${match[1]}.myshopify.com`;
            }
          } catch {}
        }
      }

      if (!shop) {
        const idToken = url.searchParams.get("id_token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (idToken && idToken.includes(".")) {
          try {
            const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString("utf-8"));
            if (payload?.dest) {
              shop = new URL(payload.dest).hostname;
            }
          } catch {}
        }
      }

      if (error.status === 401 && shop && !isXhr) {
        const cleanShop = shop.replace(".myshopify.com", "");
        const installUrl = `https://admin.shopify.com/store/${cleanShop}/oauth/install?client_id=${currentApiKey}`;
        
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
      bundles: "bundlesEnabled",
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
  const { apiKey, dashboardLocale, i18n, supportChat } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const { pathname } = useLocation();
  const demoId = demoIdFromPath(pathname);

  const [currentLocale, setCurrentLocale] = useState<SupportedLanguage>(dashboardLocale || "en");

  useEffect(() => {
    if (dashboardLocale) {
      setCurrentLocale(dashboardLocale);
    }
  }, [dashboardLocale]);

  const currentIsAr = currentLocale === "ar";
  const currentI18n = DASHBOARD_I18N[currentLocale] || DASHBOARD_I18N.en;
  const t = (text: string) => translateText(text, currentLocale);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setCurrentLocale(newLang);
    fetcher.submit(
      { actionType: "setDashboardLocale", locale: newLang },
      { method: "post", action: "/app" }
    );
  };

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">{t("Overview")}</a>
        <a href="/app/analytics">{t("Analytics")}</a>
        <a href="/app/pricing">{t("Plans & Pricing")}</a>
        <a href="/app/translations">{t("Translations & Languages")}</a>
        <a href="/app/pre-purchase">{t("Pre-Purchase Upsell")}</a>
        <a href="/app/in-cart">{t("Cart Upsell")}</a>
        <a href="/app/bundles">{t("Bundle Builder")}</a>
        <a href="/app/thank-you">{t("Thank-You Page Offers")}</a>
        <a href="/app/shipping-bar">{t("Free Shipping & Rewards Bar")}</a>
        <a href="/app/quantity-breaks">{t("Volume Discounts")}</a>
        <a href="/app/product-scarcity">{t("Low Stock Meter")}</a>
        <a href="/app/social-bar">{t("Chat & Social Bar")}</a>
        <a href="/app/scarcity">{t("Social Proof Popups")}</a>
        <a href="/app/help">{t("Help & Guide")}</a>
        {EXIT_INTENT_AVAILABLE ? <a href="/app/exit-intent">{t("Exit-Intent Recovery")}</a> : null}
      </NavMenu>

      <TranslationProvider locale={currentLocale}>
        <div dir={currentIsAr ? "rtl" : "ltr"} style={{ width: "100%", minHeight: "100vh", background: "radial-gradient(900px 520px at 8% -6%, rgba(255,235,151,0.085), transparent 62%), radial-gradient(820px 620px at 100% 0%, rgba(88,55,20,0.42), transparent 62%), linear-gradient(180deg, #120B05 0%, #0C0803 480px)" }}>
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
              {t("Dashboard Language")}:
            </span>
          </div>

          {/* Quick Language Switcher Dropdown + Help & Guide */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link
              to="/app/help"
              className={`xp-help-link${pathname.startsWith("/app/help") ? " is-active" : ""}`}
              aria-label={t("Help & Guide")}
            >
              <span className="xp-help-q">?</span>
              {t("Help & Guide")}
            </Link>
            <select
              id="top-dashboard-lang-select"
              value={currentLocale}
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
          <Outlet context={{ dashboardLocale: currentLocale, isAr: currentIsAr, i18n: currentI18n }} />
        </main>
        {supportChat ? <SupportChat propertyId={supportChat.propertyId} widgetId={supportChat.widgetId} shop={supportChat.shop} /> : null}
      </div>
      </TranslationProvider>
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
