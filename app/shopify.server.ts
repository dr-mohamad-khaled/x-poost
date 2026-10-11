import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  BillingInterval,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { MONTHLY_PLAN, YEARLY_PLAN, LIFETIME_PLAN } from "./billing.constants";

import { LogSeverity } from "@shopify/shopify-api";

// Credentials come from the environment ONLY. Never put a secret in this file: it is committed to git.
const apiSecretKey = (
  process.env.SHOPIFY_API_SECRET ||
  process.env.SHOPIFY_SECRET ||
  process.env.SHOPIFY_APP_SECRET ||
  process.env.CLIENT_SECRET ||
  ""
).trim();

if (!apiSecretKey) {
  throw new Error(
    "SHOPIFY_API_SECRET is not set. Add it to the server environment (DigitalOcean > App > Settings > Environment variables) before starting XPoost.",
  );
}

// The API key (client_id) is public: it is also in shopify.app.toml and in every storefront URL.
const apiKey = (process.env.SHOPIFY_API_KEY || "872f7f6415d1c243c11ccdfe9426b07f").trim();
const appUrl = (process.env.SHOPIFY_APP_URL || "https://sea-turtle-app-a4uct.ondigitalocean.app").trim().replace(/\/$/, "");
const rawScopes = (process.env.SCOPES || "write_discounts,read_products,read_orders,write_checkout_extensions_apis").trim();
const scopes = rawScopes.split(",").map((s) => s.trim()).filter(Boolean);

const shopify = shopifyApp({
  apiKey,
  apiSecretKey,
  apiVersion: ApiVersion.July26,
  scopes,
  appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  logger: {
    level: process.env.NODE_ENV === "production" ? LogSeverity.Warning : LogSeverity.Info,
  },
  billing: {
    [MONTHLY_PLAN]: {
      lineItems: [
        {
          amount: 20,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      trialDays: 7,
    },
    [YEARLY_PLAN]: {
      lineItems: [
        {
          amount: 170,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
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

/** Used to sign post-purchase changesets (same credentials the app already authenticates with). */
export const appCredentials = { apiKey, apiSecretKey };

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
