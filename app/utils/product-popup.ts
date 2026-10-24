/**
 * Product Popup — one shop-wide setting used by every XPoost feature that shows products.
 * When it's on, tapping a product's photo or name opens its details in a popup instead of leaving the page.
 * Stored as JSON in Shop.productPopupJson. Missing values mean "on" (the popup is the default).
 */

export const PP_FEATURES = ["kits", "bundles", "recs", "prePurchase", "inCart"] as const;
export type PpFeature = (typeof PP_FEATURES)[number];

export type PpSettings = { enabled: boolean; features: Record<PpFeature, boolean> };

export const PP_FEATURE_META: Record<PpFeature, { name: string; blurb: string }> = {
  kits: { name: "Kit Builder", blurb: "Shoppers check a product's details, then pick it for the step from the popup." },
  bundles: { name: "Bundle Builder", blurb: "Shoppers check a product's details, then add it to the bundle from the popup." },
  recs: { name: "Product Recommendations", blurb: "Recommended products open in a popup instead of taking shoppers away from the product they're viewing." },
  prePurchase: { name: "Pre-Purchase Upsell", blurb: "Offered products open in a popup instead of a new tab, so the offer stays on screen." },
  inCart: { name: "Cart Upsell", blurb: "Products offered in the cart open in a popup instead of a new tab." },
};

export const PP_DEFAULT: PpSettings = {
  enabled: true,
  features: { kits: true, bundles: true, recs: true, prePurchase: true, inCart: true },
};

export function parsePp(json: string | null | undefined): PpSettings {
  let raw: any = {};
  try {
    raw = JSON.parse(json || "{}") || {};
  } catch {
    raw = {};
  }
  return sanitizePp(raw);
}

export function sanitizePp(raw: any): PpSettings {
  const f = raw && typeof raw.features === "object" && raw.features ? raw.features : {};
  const features = {} as Record<PpFeature, boolean>;
  for (const k of PP_FEATURES) features[k] = f[k] === undefined ? PP_DEFAULT.features[k] : !!f[k];
  return { enabled: raw?.enabled === undefined ? PP_DEFAULT.enabled : !!raw.enabled, features };
}

/** Whether the popup is on for one feature (what the storefront receives). */
export function popupOn(json: string | null | undefined, feature: PpFeature): boolean {
  const s = parsePp(json);
  return s.enabled && s.features[feature];
}
