import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from "../generated/api";

const DISCOUNT_PERCENT = 10;
const MIN_QUANTITY_FOR_DISCOUNT = 2;

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.cart.lines.length) {
    return { operations: [] };
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  // Total quantity across all cart lines
  const totalQuantity = input.cart.lines.reduce(
    (sum, line) => sum + (line.quantity ?? 0),
    0,
  );

  // Core rule: Buy 2 (or more) items, get X% off
  if (totalQuantity < MIN_QUANTITY_FOR_DISCOUNT) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `Buy ${MIN_QUANTITY_FOR_DISCOUNT}, get ${DISCOUNT_PERCENT}% off`,
              targets: input.cart.lines.map((line) => ({
                cartLine: {
                  id: line.id,
                },
              })),
              value: {
                percentage: {
                  value: DISCOUNT_PERCENT,
                },
              },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}