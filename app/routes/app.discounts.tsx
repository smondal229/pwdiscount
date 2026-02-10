import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { DiscountConfig } from "../db.mongo.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Parse submitted form data
  const formData = await request.formData();
  const productIdsRaw = formData.get("productIds")?.toString() ?? "";
  const discountPercentRaw = formData.get("discountPercent")?.toString() ?? "";

  let discountPercent = Number.parseFloat(discountPercentRaw);
  if (Number.isNaN(discountPercent)) {
    discountPercent = 0;
  }
  discountPercent = Math.round(discountPercent);
  // Clamp to 1–80 as required.
  if (discountPercent < 1) discountPercent = 1;
  if (discountPercent > 80) discountPercent = 80;
  const productIds = productIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  // Persist the configuration in MongoDB keyed by shop domain.
  // This demonstrates the Mongoose/MongoDB layer in a real request path.
  const shopDomain = session.shop;

  await DiscountConfig.findOneAndUpdate(
    { shopDomain },
    { productIds, discountPercent },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  // Also persist the configuration to a shop-level metafield that the Function and theme widget can read.
  // namespace: "volume_discount", key: "rules"
  const shopResponse = await admin.graphql(
    `#graphql
      query VolumeDiscountShopId {
        shop {
          id
        }
      }
    `,
  );
  const shopJson = await shopResponse.json();
  const shopId: string | undefined = shopJson.data?.shop?.id;

  if (!shopId) {
    throw new Error("Unable to load shop id for metafield persistence.");
  }

  const metafieldPayload = {
    products: productIds,
    minQty: 2,
    percentOff: discountPercent,
  };

  const metafieldResponse = await admin.graphql(
    `#graphql
      mutation VolumeDiscountSaveRules($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "volume_discount",
            key: "rules",
            type: "json",
            value: JSON.stringify(metafieldPayload),
          },
        ],
      },
    },
  );

  const metafieldJson = await metafieldResponse.json();
  const userErrors = metafieldJson.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(
      `Failed to save volume discount metafield: ${userErrors
        .map((e: { message: string }) => e.message)
        .join(", ")}`,
    );
  }

  // Still return the values so the UI can echo them back.
  return {
    productIds,
    discountPercent,
    shopDomain,
  };
};

export default function DiscountConfigurationPage() {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [selectedProducts, setSelectedProducts] = useState<
    { id: string; title?: string }[]
  >([]);

  const isSubmitting =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const openProductPicker = async () => {
    const picker = (shopify as unknown as {
      resourcePicker?: {
        open?: (options: {
          resourceType: "product";
          selectionMode: "multiple";
        }) => Promise<{ selection?: { id: string; title?: string }[] } | undefined>;
      };
    }).resourcePicker;

    if (!picker?.open) return;

    const result = await picker.open({
      resourceType: "product",
      selectionMode: "multiple",
    });

    const selection = result?.selection ?? [];
    setSelectedProducts(selection);
  };

  useEffect(() => {
    if (fetcher.data && !isSubmitting) {
      shopify.toast.show("Discount settings saved.");
    }
  }, [fetcher.data, isSubmitting, shopify]);

  return (
    <s-page heading="Volume discount configuration">
      <s-section heading="Buy 2, get X% off">
        <s-paragraph>
          Configure which products should participate in the{" "}
          <s-text>Buy 2, get X% off</s-text> discount, and the
          percentage to apply. The minimum quantity is fixed at 2 for this
          task, and the discount percentage can be set between 1% and 80%.
        </s-paragraph>

        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
            <s-button onClick={openProductPicker}>
              Select products
            </s-button>

            {selectedProducts.length > 0 && (
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-heading>Selected products</s-heading>
                <s-unordered-list>
                  {selectedProducts.map((product) => (
                    <s-list-item key={product.id}>
                      {product.title ?? product.id}
                    </s-list-item>
                  ))}
                </s-unordered-list>
              </s-box>
            )}

            {/* Hidden field that the action reads; populated from the picker selection */}
            <input
              type="hidden"
              name="productIds"
              value={selectedProducts.map((p) => p.id).join(",")}
            />

            <s-text-field name="discountPercent" label="Discount percentage" />

            <s-button
              variant="primary"
              onClick={() => {
                // Submit the enclosing form
                const form = document.querySelector<HTMLFormElement>(
                  "form[method='post']",
                );
                form?.requestSubmit();
              }}
              {...(isSubmitting ? { loading: true } : {})}
            >
              Save configuration
            </s-button>

            {fetcher.data && (
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-heading>Last submitted values</s-heading>
                <pre style={{ margin: 0 }}>
                  <code>{JSON.stringify(fetcher.data, null, 2)}</code>
                </pre>
              </s-box>
            )}
          </s-stack>
        </fetcher.Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

