import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  BillingInterval,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { MONTHLY_PLAN, LIFETIME_PLAN } from "./billing.constants";

import { LogSeverity } from "@shopify/shopify-api";

console.log("[SHOPIFY_BOOT_CONFIG]", {
  hasApiKey: Boolean(process.env.SHOPIFY_API_KEY),
  apiKey: (process.env.SHOPIFY_API_KEY || "872f7f6415d1c243c11ccdfe9426b07f"),
  hasApiSecret: Boolean(process.env.SHOPIFY_API_SECRET),
  apiSecretPrefix: process.env.SHOPIFY_API_SECRET ? process.env.SHOPIFY_API_SECRET.slice(0, 10) + "..." : "MISSING",
  apiSecretLength: process.env.SHOPIFY_API_SECRET ? process.env.SHOPIFY_API_SECRET.length : 0,
  appUrl: process.env.SHOPIFY_APP_URL || "https://x-poost.onrender.com",
});

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "872f7f6415d1c243c11ccdfe9426b07f",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(",") || [
    "write_products",
    "write_discounts",
    "write_metaobjects",
    "write_metaobject_definitions",
  ],
  appUrl: process.env.SHOPIFY_APP_URL || "https://x-poost.onrender.com",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  logger: {
    level: LogSeverity.Debug,
  },
  billing: {
    [MONTHLY_PLAN]: {
      lineItems: [
        {
          amount: 15,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      trialDays: 7,
    },
    [LIFETIME_PLAN]: {
      amount: 249,
      currencyCode: "USD",
      interval: BillingInterval.OneTime,
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
