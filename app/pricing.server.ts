import { authenticate } from "./shopify.server";
import { MONTHLY_PLAN, LIFETIME_PLAN } from "./billing.constants";

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

  return {
    shop: session.shop,
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
      await billing.cancel({
        subscriptionId,
        isTest,
        prorate: true,
      });
      return { success: true, message: "Subscription cancelled successfully." };
    }
    return { success: false, error: "Missing subscription ID." };
  }

  if (plan === MONTHLY_PLAN || plan === LIFETIME_PLAN) {
    return await billing.request({
      plan,
      isTest,
      returnUrl: `${new URL(request.url).origin}/app/pricing`,
    });
  }

  return { success: false, error: "Invalid plan selected." };
}
