import { BillingReplacementBehavior } from "@shopify/shopify-app-react-router/server";
import { authenticate, appCredentials } from "./shopify.server";
import prisma from "./db.server";
import { MONTHLY_PLAN, YEARLY_PLAN, LIFETIME_PLAN, LIFETIME_LIMIT } from "./billing.constants";

const DAY_MS = 24 * 60 * 60 * 1000;

function isTestBilling() {
  return process.env.NODE_ENV !== "production" || process.env.SHOPIFY_BILLING_TEST === "true";
}

/** How many Lifetime Passes are still available (never throws: if the count fails the offer stays open). */
async function lifetimeSpotsLeft(): Promise<number> {
  try {
    const claimed = await prisma.shop.count({ where: { lifetimePurchasedAt: { not: null } } });
    return Math.max(0, LIFETIME_LIMIT - claimed);
  } catch (err) {
    console.warn("[XPoost Billing] lifetime count unavailable:", err);
    return LIFETIME_LIMIT;
  }
}

/** Trial days left on a subscription, or null when it has no trial. */
function trialDaysLeft(sub: { trialDays?: number | null; createdAt?: string | null }): number | null {
  if (!sub.trialDays || !sub.createdAt) return null;
  const trialEnd = new Date(sub.createdAt).getTime() + sub.trialDays * DAY_MS;
  return Math.max(0, Math.ceil((trialEnd - Date.now()) / DAY_MS));
}

export async function getBillingData(request: Request) {
  const { billing, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const isTest = isTestBilling();

  let hasActivePayment = false;
  let activePlanName: string | null = null;
  let activeSubscriptionId: string | null = null;
  let isLifetime = false;
  let trialDaysRemaining: number | null = null;

  try {
    const billingCheck = await billing.check({ isTest });
    const activeOneTime = (billingCheck.oneTimePurchases || []).find((p) => p.status === "ACTIVE");
    const activeSub = (billingCheck.appSubscriptions || []).find((s) => s.status === "ACTIVE");

    if (activeOneTime) {
      hasActivePayment = true;
      isLifetime = true;
      activePlanName = activeOneTime.name;

      // The Lifetime Pass replaces any recurring plan: stop the old subscription so the
      // merchant is never charged twice. Prorated, so unused time is credited back.
      if (activeSub) {
        try {
          await billing.cancel({ subscriptionId: activeSub.id, isTest, prorate: true });
        } catch (err) {
          console.warn("[XPoost Billing] could not cancel subscription after lifetime purchase:", err);
        }
      }
    } else if (activeSub) {
      hasActivePayment = true;
      activePlanName = activeSub.name;
      activeSubscriptionId = activeSub.id;
      trialDaysRemaining = trialDaysLeft(activeSub);
    }
  } catch (error) {
    console.warn("[XPoost Billing] Check error:", error);
  }

  if (isLifetime) {
    // Remember who owns the Lifetime Pass so the 100-store cap is counted correctly.
    try {
      await prisma.shop.updateMany({ where: { shopDomain: session.shop, lifetimePurchasedAt: null }, data: { lifetimePurchasedAt: new Date() } });
    } catch (err) {
      console.warn("[XPoost Billing] could not record lifetime purchase:", err);
    }
  }
  const lifetimeLeft = await lifetimeSpotsLeft();

  return {
    shop: session.shop,
    lifetimeLeft,
    lifetimeLimit: LIFETIME_LIMIT,
    hasActivePayment,
    activePlanName,
    activeSubscriptionId,
    isLifetime,
    trialDaysRemaining,
    // Shopify adds charge_id when the merchant comes back from approving a charge.
    justApproved: url.searchParams.has("charge_id") && hasActivePayment,
    appUrl: url.origin,
  };
}

/** Pulls Shopify's approval URL out of the Response that billing.request throws. */
function confirmationUrlFrom(response: Response): string | null {
  const reauthorize = response.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url");
  if (reauthorize) return reauthorize;
  const location = response.headers.get("Location");
  if (!location) return null;
  // For document requests the library redirects to its exit-iframe page with the real URL as a param.
  try {
    const parsed = new URL(location, "https://placeholder.invalid");
    const exitIframe = parsed.searchParams.get("exitIframe");
    if (exitIframe) return exitIframe;
  } catch {}
  return /^https:\/\//i.test(location) ? location : null;
}

export async function processBillingAction(request: Request) {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan") as string;
  const actionType = formData.get("actionType") as string;
  const isTest = isTestBilling();

  if (actionType === "cancel") {
    const subscriptionId = formData.get("subscriptionId") as string;
    if (!subscriptionId) return { success: false, error: "Missing subscription ID." };
    try {
      const current = await billing.check({ isTest });
      const owned = (current.appSubscriptions || []).some((s) => s.id === subscriptionId);
      if (!owned) return { success: false, error: "Subscription not found." };
      await billing.cancel({ subscriptionId, isTest, prorate: true });
      return { success: true, message: "Subscription cancelled. You can pick a plan again at any time." };
    } catch (error) {
      if (error instanceof Response) throw error;
      console.error("[XPoost Billing] cancel failed:", error);
      return { success: false, error: "We could not cancel the subscription. Please reload the page and try again." };
    }
  }

  if (plan !== MONTHLY_PLAN && plan !== YEARLY_PLAN && plan !== LIFETIME_PLAN) {
    return { success: false, error: "Invalid plan selected." };
  }

  try {
    const current = await billing.check({ isTest });
    const ownsLifetime = (current.oneTimePurchases || []).some((p) => p.status === "ACTIVE");
    const activeSub = (current.appSubscriptions || []).find((s) => s.status === "ACTIVE");

    if (plan === LIFETIME_PLAN) {
      if (ownsLifetime) return { success: false, error: "You already own the Lifetime Pass." };
      // Only offered to the first LIFETIME_LIMIT stores.
      if ((await lifetimeSpotsLeft()) <= 0) {
        return { success: false, error: `The Founder's Lifetime Pass was limited to the first ${LIFETIME_LIMIT} stores and is no longer available. Please choose the Monthly or Yearly plan.` };
      }
    } else {
      if (ownsLifetime) return { success: false, error: "Your Lifetime Pass already includes every feature. No subscription is needed." };
      if (activeSub && activeSub.name === plan) return { success: false, error: "You are already on this plan." };
    }

    // After approval Shopify sends the whole browser tab to returnUrl. It must be the embedded
    // admin URL: on the bare app host there is no shop/host param, so the app cannot authenticate
    // and the merchant lands on an empty page instead of the pricing page.
    const storeHandle = session.shop.replace(/\.myshopify\.com$/i, "");
    const returnUrl = `https://admin.shopify.com/store/${storeHandle}/apps/${appCredentials.apiKey}/app/pricing`;

    // Switching between Monthly and Yearly: apply the new plan right away (Shopify credits the
    // unused part of the old one) and carry over only the trial days that are left, so a plan
    // change never restarts the free trial.
    const switchOverrides =
      plan !== LIFETIME_PLAN && activeSub
        ? { replacementBehavior: BillingReplacementBehavior.ApplyImmediately, trialDays: trialDaysLeft(activeSub) ?? 0 }
        : {};

    return await billing.request({
      plan,
      isTest,
      returnUrl,
      ...switchOverrides,
    });
  } catch (error) {
    // billing.request signals "go to Shopify's approval page" by throwing a Response
    // (401 + reauthorize header for fetch requests, or a 3xx redirect for documents).
    // A plain fetch from the iframe can't follow that, so hand the URL to the client
    // and let it open the approval page at the top level.
    if (error instanceof Response) {
      const confirmationUrl = confirmationUrlFrom(error);
      if (confirmationUrl) return { success: true, confirmationUrl };
      throw error;
    }
    console.error("[XPoost Billing] request failed:", error);
    return { success: false, error: "We could not start the plan change. Please reload the page and try again." };
  }
}
