import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentApiKey = (process.env.SHOPIFY_API_KEY || "872f7f6415d1c243c11ccdfe9426b07f").trim();
  try {
    const { session } = await authenticate.admin(request);
    const shop = await getOrCreateShop(session.shop);
    const translationConfig = await prisma.translationConfig.findUnique({
      where: { shopId: shop.id },
    });
    const dashboardLocale = translationConfig?.dashboardLocale === "ar" ? "ar" : "en";
    return { apiKey: currentApiKey, dashboardLocale };
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
  const { apiKey, dashboardLocale } = useLoaderData<typeof loader>();
  const isAr = dashboardLocale === "ar";

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">{isAr ? "نظرة عامة" : "Overview"}</a>
        <a href="/app/pricing">{isAr ? "الخطط والأسعار" : "Plans & Pricing"}</a>
        <a href="/app/translations">{isAr ? "إدارة اللغات والترجمة" : "Translations & Languages"}</a>
        <a href="/app/product-scarcity">{isAr ? "ندرة مخزون المنتج" : "Product Stock Scarcity"}</a>
        <a href="/app/scarcity">{isAr ? "إشعارات الشراء المباشرة" : "Urgency Notifications"}</a>
        <a href="/app/pre-purchase">{isAr ? "عروض ما قبل الدفع" : "Pre-Purchase Upsell"}</a>
        <a href="/app/in-cart">{isAr ? "عروض سلة الشراء" : "Cart Drawer Upsell"}</a>
        <a href="/app/social-bar">{isAr ? "شريط الدعم والتواصل" : "Support & Social Bar"}</a>
        <a href="/app/shipping-bar">{isAr ? "شريط الشحن المجاني" : "Free Shipping Bar"}</a>
        <a href="/app/exit-intent">{isAr ? "نافذة استعادة الزوار" : "Exit-Intent Recovery"}</a>
      </NavMenu>
      <div dir={isAr ? "rtl" : "ltr"} style={{ width: "100%", minHeight: "100vh" }}>
        <Outlet />
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
