import { resolveCandidates } from "./bundles.js";

const EMPTY = { operations: [] };

export function cartLinesDiscountsGenerateRun(input) {
  const classes = (input.discount && input.discount.discountClasses) || [];
  if (classes.indexOf("PRODUCT") === -1) return EMPTY;

  const candidates = resolveCandidates(input);
  if (!candidates.length) return EMPTY;

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}
