import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from "../generated/api";

type VolumeDiscountRules = {
  products: string[];
  minQty: number;
  percentOff: number;
};

function parseRules(rawValue: string | null | undefined): VolumeDiscountRules | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<VolumeDiscountRules>;
    if (
      !parsed ||
      !Array.isArray(parsed.products) ||
      typeof parsed.minQty !== "number" ||
      typeof parsed.percentOff !== "number"
    ) {
      return null;
    }

    return {
      products: parsed.products,
      minQty: parsed.minQty,
      percentOff: parsed.percentOff,
    };
  } catch {
    return null;
  }
}

export function cartLinesDiscountsGenerateRun(
  input: CartInput & {
    shop?: {
      metafield?: {
        value?: string | null;
      } | null;
    };
  },
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

  const rules = parseRules(input.shop?.metafield?.value ?? null);

  if (!rules) {
    return { operations: [] };
  }

  const configuredProductIds = new Set(rules.products);

  // Filter cart lines that match configured products
  const qualifyingLines = input.cart.lines.filter((line) => {
    const merchandise: any = line.merchandise;
    const productId: string | undefined = merchandise?.product?.id;

    if (!productId) {
      return false;
    }

    return configuredProductIds.has(productId);
  });

  // Total quantity across just the configured products
  const totalConfiguredQuantity = qualifyingLines.reduce(
    (sum, line) => sum + (line.quantity ?? 0),
    0,
  );

  // Core rule: If cart contains ≥ minQty units of any configured product,
  // apply percentOff to those qualifying lines.
  if (totalConfiguredQuantity < rules.minQty) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `Buy ${rules.minQty}, get ${rules.percentOff}% off`,
              targets: qualifyingLines.map((line) => ({
                cartLine: {
                  id: line.id,
                },
              })),
              value: {
                percentage: {
                  value: rules.percentOff,
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