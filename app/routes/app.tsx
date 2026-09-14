import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
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
  const isAr = dashboardLocale === "ar";

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    fetcher.submit(
      { actionType: "setDashboardLocale", locale: newLang },
      { method: "post" }
    );
  };

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">{i18n.navOverview || "Overview"}</a>
        <a href="/app/pricing">{i18n.navPricing || "Plans & Pricing"}</a>
        <a href="/app/translations">{i18n.navTranslations || "Translations & Languages"}</a>
        <a href="/app/product-scarcity">{i18n.navProductScarcity || "Product Stock Scarcity"}</a>
        <a href="/app/scarcity">{i18n.navUrgency || "Urgency Notifications"}</a>
        <a href="/app/pre-purchase">{i18n.navPrePurchase || "Pre-Purchase Upsell"}</a>
        <a href="/app/in-cart">{i18n.navInCart || "Cart Drawer Upsell"}</a>
        <a href="/app/social-bar">{i18n.navSocialBar || "Support & Social Bar"}</a>
        <a href="/app/shipping-bar">{i18n.navShippingBar || "Free Shipping Bar"}</a>
        <a href="/app/exit-intent">{i18n.navExitIntent || "Exit-Intent Recovery"}</a>
      </NavMenu>

      <div dir={isAr ? "rtl" : "ltr"} style={{ width: "100%", minHeight: "100vh", background: "#0a0a0c" }}>
        {/* Global Dashboard Top Bar with 7-Language Switcher */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "10px 20px",
            background: "#111114",
            borderBottom: "1px solid #222226",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: "#D4AF37",
                textTransform: "uppercase",
              }}
            >
              XPoost
            </span>
            <span style={{ fontSize: "12px", color: "#71717a" }}>|</span>
            <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: 500 }}>
              {i18n.dashboardLangTitle || "Dashboard Language"}:
            </span>
          </div>

          {/* Quick Language Switcher Dropdown / Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = lang.code === dashboardLocale;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  style={{
                    background: active ? "rgba(212, 175, 55, 0.18)" : "#18181b",
                    color: active ? "#F3E5AB" : "#a1a1aa",
                    border: active ? "1px solid #D4AF37" : "1px solid #27272a",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title={lang.label}
                >
                  {lang.nativeName}
                </button>
              );
            })}
          </div>
        </header>

        <main style={{ padding: "0 4px" }}>
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
