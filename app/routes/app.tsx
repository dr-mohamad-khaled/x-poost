import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
    return { apiKey: process.env.SHOPIFY_API_KEY || "872f7f6415d1c243c11ccdfe9426b07f" };
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
        const installUrl = `https://admin.shopify.com/store/${cleanShop}/oauth/install?client_id=${process.env.SHOPIFY_API_KEY || "872f7f6415d1c243c11ccdfe9426b07f"}`;
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

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">Overview</a>
        <a href="/app/pricing">Plans & Pricing</a>
        <a href="/app/scarcity">Urgency Notifications</a>
        <a href="/app/pre-purchase">Pre-Purchase Upsell</a>
        <a href="/app/in-cart">Cart Drawer Upsell</a>
        <a href="/app/social-bar">Support & Social Bar</a>
        <a href="/app/shipping-bar">Free Shipping Bar</a>
        <a href="/app/exit-intent">Exit-Intent Recovery</a>
      </NavMenu>
      <Outlet />
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
