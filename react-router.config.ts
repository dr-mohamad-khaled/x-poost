import type { Config } from "@react-router/dev/config";

// Development-only tunnels/hosts are added outside production.
const devOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : ["*.spin.dev", "**.spin.dev", "*.trycloudflare.com", "**.trycloudflare.com", "localhost"];

export default {
  // Allow Shopify Admin iframe origins (and only our own host) to submit form actions to the embedded app
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
    "sea-turtle-app-a4uct.ondigitalocean.app",
    ...devOrigins,
  ],
} satisfies Config;
