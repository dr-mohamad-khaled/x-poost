import type { Config } from "@react-router/dev/config";

export default {
  // Allow Shopify Admin iframe origins to submit form actions to the embedded app
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.admin.shopify.com",
    "*.myshopify.com",
    "**.myshopify.com",
    "*.shopify.com",
    "**.shopify.com",
    "*.shopifypreview.com",
    "**.shopifypreview.com",
    "*.spin.dev",
    "**.spin.dev",
    "*.trycloudflare.com",
    "**.trycloudflare.com",
  ],
} satisfies Config;
