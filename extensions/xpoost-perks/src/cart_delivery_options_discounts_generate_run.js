import { resolveRewards } from "./perks.js";

const EMPTY = { operations: [] };

export function cartDeliveryOptionsDiscountsGenerateRun(input) {
  const classes = (input.discount && input.discount.discountClasses) || [];
  if (classes.indexOf("SHIPPING") === -1) return EMPTY;

  const rewards = resolveRewards(input);
  if (!rewards || rewards.shipping.length === 0) return EMPTY;

  const groups = (input.cart && input.cart.deliveryGroups) || [];
  const candidates = [];

  for (const r of rewards.shipping) {
    for (const g of groups) {
      if (r.type === "shipping_fixed") {
        // Fixed amount off shipping: convert to a percentage of each option's price.
        for (const o of g.deliveryOptions || []) {
          const cost = parseFloat(o.cost && o.cost.amount);
          if (!Number.isFinite(cost) || cost <= 0) continue;
          const pct = Math.min(100, (r.amount / cost) * 100);
          candidates.push({
            message: r.label,
            targets: [{ deliveryOption: { handle: o.handle } }],
            value: { percentage: { value: Math.round(pct * 100) / 100 } },
          });
        }
      } else {
        candidates.push({
          message: r.label,
          targets: [{ deliveryGroup: { id: g.id } }],
          value: { percentage: { value: r.pct } },
        });
      }
    }
  }

  if (candidates.length === 0) return EMPTY;
  return {
    operations: [{ deliveryDiscountsAdd: { candidates, selectionStrategy: "ALL" } }],
  };
}
