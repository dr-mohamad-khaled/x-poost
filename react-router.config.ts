import type { Config } from "@react-router/dev/config";

export default {
  // Allow Shopify Admin iframe origins to submit form actions to the embedded app
  allowedActionOrigins: [
    "null",
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
    "x-poost.onrender.com",
    "*.onrender.com",
    "localhost",
  ],
} satisfies Config;
