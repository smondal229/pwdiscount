import { useEffect } from "react";
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

  const discountPercent = Number.parseFloat(discountPercentRaw) || 0;
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

  const isSubmitting =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data && !isSubmitting) {
      shopify.toast.show("Discount settings saved to MongoDB.");
    }
  }, [fetcher.data, isSubmitting, shopify]);

  return (
    <s-page heading="Volume discount configuration">
      <s-section heading="Buy 2, get X% off">
        <s-paragraph>
          Configure which products should participate in the{" "}
          <s-text as="span">Buy 2, get X% off</s-text> discount, and the
          percentage to apply. For Milestone A this page only collects input;
          in Milestone C the settings will be saved to metafields.
        </s-paragraph>

        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
            <s-text-field
              name="productIds"
              label="Product IDs or handles"
              helpText="Comma-separated list (for example: gid://shopify/Product/123, my-product-handle)."
            />

            <s-text-field
              name="discountPercent"
              type="number"
              min="0"
              max="100"
              label="Discount percentage"
              helpText="For example, enter 10 for 10% off when the quantity condition is met."
            />

            <s-button variant="primary" submit {...(isSubmitting ? { loading: true } : {})}>
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

