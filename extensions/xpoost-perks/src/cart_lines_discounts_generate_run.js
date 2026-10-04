import { resolveRewards, money } from "./perks.js";

const EMPTY = { operations: [] };

export function cartLinesDiscountsGenerateRun(input) {
  const classes = (input.discount && input.discount.discountClasses) || [];
  if (classes.indexOf("ORDER") === -1) return EMPTY;

  const rewards = resolveRewards(input);
  if (!rewards || rewards.order.length === 0) return EMPTY;

  const candidates = rewards.order.map((r) => {
    let value;
    if (r.type === "order_percent") {
      value = r.capped
        ? { fixedAmount: { amount: money(r.cap) } }
        : { percentage: { value: r.pct } };
    } else {
      value = { fixedAmount: { amount: money(r.amount) } };
    }
    return {
      message: r.label,
      targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
      value,
    };
  });

  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates,
          selectionStrategy: rewards.stacking === "all" ? "ALL" : "FIRST",
        },
      },
    ],
  };
}
