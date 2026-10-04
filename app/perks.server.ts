// Keeps the "Tier Perks Rewards" automatic discount (Shopify Function) in sync with
// the shipping-bar milestones, so rewards shown on the bar are really applied at checkout.

export const REWARD_TYPES = [
  "display",
  "free_shipping",
  "shipping_percent",
  "shipping_fixed",
  "order_percent",
  "order_fixed",
] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export type PerkTier = {
  targetAmount: number;
  rewardTitle: string;
  unlockedMessage: string;
  rewardType?: RewardType;
  rewardValue?: number;
  rewardCap?: number;
  rewardLabel?: string;
};

export type PerkSettings = {
  stacking: "best" | "all";
  combineOrder: boolean;
  combineProduct: boolean;
  combineShipping: boolean;
  startsAt: string; // ISO date or ""
  endsAt: string; // ISO date or ""
};

export const DEFAULT_PERK_SETTINGS: PerkSettings = {
  stacking: "best",
  combineOrder: true,
  combineProduct: true,
  combineShipping: true,
  startsAt: "",
  endsAt: "",
};

export const PERKS_DISCOUNT_TITLE = "Tier Perks Rewards";
const NAMESPACE = "$app:tier-perks";

export function sanitizeTier(t: Partial<PerkTier> | null | undefined): PerkTier | null {
  const targetAmount = Number(t?.targetAmount);
  const rewardTitle = String(t?.rewardTitle || "").slice(0, 80);
  if (!Number.isFinite(targetAmount) || targetAmount <= 0 || !rewardTitle) return null;
  const type = REWARD_TYPES.includes(t?.rewardType as RewardType) ? (t?.rewardType as RewardType) : "display";
  const out: PerkTier = {
    targetAmount,
    rewardTitle,
    unlockedMessage: String(t?.unlockedMessage || "").slice(0, 120),
    rewardType: type,
  };
  if (type !== "display" && type !== "free_shipping") {
    const v = Number(t?.rewardValue);
    out.rewardValue = Number.isFinite(v) && v > 0 ? (type.endsWith("percent") ? Math.min(100, v) : v) : 0;
  }
  if (type === "order_percent") {
    const c = Number(t?.rewardCap);
    if (Number.isFinite(c) && c > 0) out.rewardCap = c;
  }
  const label = String(t?.rewardLabel || "").trim().slice(0, 80);
  if (label) out.rewardLabel = label;
  return out;
}

export function sanitizePerkSettings(raw: any): PerkSettings {
  const d = DEFAULT_PERK_SETTINGS;
  const date = (v: unknown) => {
    const s = String(v || "").trim();
    return s && !Number.isNaN(Date.parse(s)) ? s : "";
  };
  return {
    stacking: raw?.stacking === "all" ? "all" : "best",
    combineOrder: raw?.combineOrder === undefined ? d.combineOrder : !!raw.combineOrder,
    combineProduct: raw?.combineProduct === undefined ? d.combineProduct : !!raw.combineProduct,
    combineShipping: raw?.combineShipping === undefined ? d.combineShipping : !!raw.combineShipping,
    startsAt: date(raw?.startsAt),
    endsAt: date(raw?.endsAt),
  };
}

export function tierIsFunctional(t: PerkTier): boolean {
  if (!t.rewardType || t.rewardType === "display") return false;
  if (t.rewardType === "free_shipping") return true;
  return (t.rewardValue || 0) > 0;
}

export type PerksSyncResult = {
  state: "active" | "inactive" | "not_deployed" | "error";
  message: string;
};

export async function syncPerksDiscount(
  admin: { graphql: Function },
  input: {
    tiers: PerkTier[];
    targeting: { mode: string; countries: string[]; overrides: { countries: string[]; tiers: PerkTier[] }[] };
    perks: PerkSettings;
  },
): Promise<PerksSyncResult> {
  try {
    const { tiers, targeting, perks } = input;
    const hasRewards =
      tiers.some(tierIsFunctional) || targeting.overrides.some((o) => o.tiers.some(tierIsFunctional));

    // Find the existing automatic discount (if any)
    const listRes = await admin.graphql(
      `#graphql
      query PerksDiscounts {
        discountNodes(first: 100, query: "type:app") {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticApp { title status }
            }
          }
        }
      }`,
    );
    const listJson = await listRes.json();
    const nodes = listJson?.data?.discountNodes?.nodes || [];
    const existing = nodes.find((n: any) => n?.discount?.title === PERKS_DISCOUNT_TITLE);

    if (!hasRewards) {
      if (existing && existing.discount?.status === "ACTIVE") {
        await admin.graphql(
          `#graphql
          mutation PerksOff($id: ID!) {
            discountAutomaticDeactivate(id: $id) { userErrors { message } }
          }`,
          { variables: { id: existing.id } },
        );
      }
      return {
        state: "inactive",
        message: "No milestone uses a checkout reward, so no discount is active (milestones are display-only).",
      };
    }

    const config = {
      stacking: perks.stacking,
      mode: targeting.mode,
      countries: targeting.countries,
      tiers: tiers.filter(tierIsFunctional),
      overrides: targeting.overrides
        .map((o) => ({ countries: o.countries, tiers: o.tiers.filter(tierIsFunctional) }))
        .filter((o) => o.countries.length > 0 && o.tiers.length > 0),
    };
    const metafields = [
      { namespace: NAMESPACE, key: "config", type: "json", value: JSON.stringify(config) },
    ];
    const combinesWith = {
      orderDiscounts: perks.combineOrder,
      productDiscounts: perks.combineProduct,
      shippingDiscounts: perks.combineShipping,
    };
    const startsAt = perks.startsAt ? new Date(perks.startsAt).toISOString() : new Date().toISOString();
    const endsAt = perks.endsAt ? new Date(perks.endsAt).toISOString() : null;

    if (existing) {
      const upd = await admin.graphql(
        `#graphql
        mutation PerksUpdate($id: ID!, $d: DiscountAutomaticAppInput!) {
          discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $d) {
            automaticAppDiscount { discountId status }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            id: existing.id,
            d: { title: PERKS_DISCOUNT_TITLE, startsAt, endsAt, combinesWith, metafields },
          },
        },
      );
      const updJson = await upd.json();
      const errs = updJson?.data?.discountAutomaticAppUpdate?.userErrors || [];
      if (errs.length) return { state: "error", message: errs.map((e: any) => e.message).join("; ") };
      if (existing.discount?.status !== "ACTIVE") {
        await admin.graphql(
          `#graphql
          mutation PerksOn($id: ID!) {
            discountAutomaticActivate(id: $id) { userErrors { message } }
          }`,
          { variables: { id: existing.id } },
        );
      }
      return { state: "active", message: "Checkout rewards are live and synced with your milestones." };
    }

    // Create it for the first time
    const funcRes = await admin.graphql(
      `#graphql
      query PerksFunctions {
        shopifyFunctions(first: 50) { nodes { id title apiType } }
      }`,
    );
    const funcJson = await funcRes.json();
    const fn = (funcJson?.data?.shopifyFunctions?.nodes || []).find((f: any) =>
      String(f?.title || "").toLowerCase().includes("tier perks"),
    );
    if (!fn) {
      return {
        state: "not_deployed",
        message:
          "The rewards engine is not deployed to this app yet. Run `shopify app deploy`, then save this page again to activate checkout rewards.",
      };
    }

    const created = await admin.graphql(
      `#graphql
      mutation PerksCreate($d: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $d) {
          automaticAppDiscount { discountId status }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          d: {
            title: PERKS_DISCOUNT_TITLE,
            functionId: fn.id,
            startsAt,
            endsAt,
            discountClasses: ["ORDER", "SHIPPING"],
            combinesWith,
            metafields,
          },
        },
      },
    );
    const createdJson = await created.json();
    const cErrs = createdJson?.data?.discountAutomaticAppCreate?.userErrors || [];
    if (cErrs.length) return { state: "error", message: cErrs.map((e: any) => e.message).join("; ") };
    return { state: "active", message: "Checkout rewards activated: an automatic discount was created in your Shopify admin." };
  } catch (err) {
    console.error("[xpoost-perks] sync failed:", err);
    return { state: "error", message: "Could not sync checkout rewards. Your milestones were saved; try saving again." };
  }
}
