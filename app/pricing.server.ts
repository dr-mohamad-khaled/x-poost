import { authenticate } from "./shopify.server";
import prisma from "./db.server";
import { MONTHLY_PLAN, YEARLY_PLAN, LIFETIME_PLAN, LIFETIME_LIMIT } from "./billing.constants";

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

export async function getBillingData(request: Request) {
  const { billing, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const isTest = process.env.NODE_ENV !== "production" || process.env.SHOPIFY_BILLING_TEST === "true";

  let hasActivePayment = false;
  let activePlanName: string | null = null;
  let activeSubscriptionId: string | null = null;
  let isLifetime = false;
  let trialDaysRemaining: number | null = null;

  try {
    const billingCheck = await billing.check({
      isTest,
    });

    hasActivePayment = Boolean(billingCheck.hasActivePayment);

    if (billingCheck.oneTimePurchases && billingCheck.oneTimePurchases.length > 0) {
      const activeOneTime = billingCheck.oneTimePurchases.find((p) => p.status === "ACTIVE");
      if (activeOneTime) {
        hasActivePayment = true;
        isLifetime = true;
        activePlanName = activeOneTime.name;
      }
    }

    if (!isLifetime && billingCheck.appSubscriptions && billingCheck.appSubscriptions.length > 0) {
      const activeSub = billingCheck.appSubscriptions.find((s) => s.status === "ACTIVE");
      if (activeSub) {
        hasActivePayment = true;
        activePlanName = activeSub.name;
        activeSubscriptionId = activeSub.id;
        if (activeSub.trialDays && activeSub.createdAt) {
          const created = new Date(activeSub.createdAt).getTime();
          const trialEnd = created + activeSub.trialDays * 24 * 60 * 60 * 1000;
          const diffDays = Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24));
          trialDaysRemaining = Math.max(0, diffDays);
        }
      }
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
    appUrl: url.origin,
  };
}

export async function processBillingAction(request: Request) {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan") as string;
  const actionType = formData.get("actionType") as string;
  const isTest = process.env.NODE_ENV !== "production" || process.env.SHOPIFY_BILLING_TEST === "true";

  if (actionType === "cancel") {
    const subscriptionId = formData.get("subscriptionId") as string;
    if (subscriptionId) {
      const current = await billing.check({ isTest });
      const owned = (current.appSubscriptions || []).some((s) => s.id === subscriptionId);
      if (!owned) return { success: false, error: "Subscription not found." };
      await billing.cancel({
        subscriptionId,
        isTest,
        prorate: true,
      });
      return { success: true, message: "Subscription cancelled successfully." };
    }
    return { success: false, error: "Missing subscription ID." };
  }

  if (plan === MONTHLY_PLAN || plan === YEARLY_PLAN || plan === LIFETIME_PLAN) {
    if (plan === LIFETIME_PLAN) {
      // Only offered to the first LIFETIME_LIMIT stores (a store that already owns it is never blocked).
      const current = await billing.check({ isTest });
      const ownsIt = (current.oneTimePurchases || []).some((p) => p.status === "ACTIVE");
      if (!ownsIt && (await lifetimeSpotsLeft()) <= 0) {
        return { success: false, error: `The Founder's Lifetime Pass was limited to the first ${LIFETIME_LIMIT} stores and is no longer available. Please choose the Monthly or Yearly plan.` };
      }
    }
    // Behind DigitalOcean's proxy request.url is http://, so build an https return URL.
    const origin = (process.env.SHOPIFY_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const secureOrigin = /localhost|127\.0\.0\.1/.test(origin) ? origin : origin.replace(/^http:\/\//i, "https://");
    try {
      return await billing.request({
        plan,
        isTest,
        returnUrl: `${secureOrigin}/app/pricing`,
      });
    } catch (error) {
      // billing.request signals "go to Shopify's approval page" by throwing a Response
      // (401 + reauthorize header for fetch requests, or a 3xx Location for documents).
      // A plain fetch from the iframe can't follow that, so hand the URL to the client
      // and let it open the approval page at the top level.
      if (error instanceof Response) {
        const confirmationUrl =
          error.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url") ||
          error.headers.get("Location");
        if (confirmationUrl) {
          return { success: true, confirmationUrl };
        }
      }
      throw error;
    }
  }

  return { success: false, error: "Invalid plan selected." };
}
