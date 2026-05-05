import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * GET /app/setup-bin-metafield
 *
 * Creates the custom.bin_locations metafield definition on Product if it
 * doesn't already exist. Called by the SetupMetafieldModal in app.fabric.jsx.
 */
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    // 1. Check if the definition already exists
    const checkResponse = await admin.graphql(
      `#graphql
      query checkMetafieldDefinition {
        metafieldDefinitions(
          first: 1
          ownerType: PRODUCT
          namespace: "custom"
          key: "bin_locations"
        ) {
          edges {
            node {
              id
              name
              namespace
              key
            }
          }
        }
      }`
    );

    const checkData = await checkResponse.json();
    const existing = checkData.data?.metafieldDefinitions?.edges?.[0]?.node;

    if (existing) {
      console.log("[SETUP METAFIELD] Already exists:", existing.id);
      return json({ success: true, alreadyExists: true, id: existing.id });
    }

    // 2. Create the definition
    const createResponse = await admin.graphql(
      `#graphql
      mutation createMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            name
            namespace
            key
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      {
        variables: {
          definition: {
            name: "Bin Locations",
            namespace: "custom",
            key: "bin_locations",
            type: "single_line_text_field",
            ownerType: "PRODUCT",
            description: "Warehouse bin location for this product (e.g. A1:2)",
            access: {
              admin: "MERCHANT_READ_WRITE",
              storefront: "PUBLIC_READ",
            },
          },
        },
      }
    );

    const createData = await createResponse.json();
    const userErrors = createData.data?.metafieldDefinitionCreate?.userErrors || [];

    if (userErrors.length > 0) {
      // If it already exists (race condition), treat as success
      if (userErrors.some(e => e.code === "TAKEN" || e.message?.toLowerCase().includes("taken"))) {
        console.log("[SETUP METAFIELD] Already exists (race condition)");
        return json({ success: true, alreadyExists: true });
      }
      console.error("[SETUP METAFIELD] User errors:", userErrors);
      return json({ success: false, error: userErrors[0].message });
    }

    const created = createData.data?.metafieldDefinitionCreate?.createdDefinition;
    console.log("[SETUP METAFIELD] Created:", created?.id);
    return json({ success: true, alreadyExists: false, id: created?.id });

  } catch (error) {
    console.error("[SETUP METAFIELD] Error:", error);
    return json({ success: false, error: error.message });
  }
};
