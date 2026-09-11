import type {
  RunInput,
  FunctionRunResult,
  Discount
} from "../generated/api";
import {
  DiscountApplicationStrategy,
} from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

export function run(input: RunInput): FunctionRunResult {
  const lines = input?.cart?.lines ?? [];
  const discounts: Discount[] = [];

  for (const line of lines) {
    const rawVal = line.attribute?.value;
    if (!rawVal) continue;

    const discountPercent = parseFloat(rawVal);
    if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) continue;

    discounts.push({
      targets: [
        {
          cartLine: {
            id: line.id
          }
        }
      ],
      value: {
        percentage: {
          value: discountPercent.toFixed(1)
        }
      },
      message: "Special Offer (-" + discountPercent + "%)"
    });
  }

  if (discounts.length === 0) {
    return EMPTY_DISCOUNT;
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts
  };
}