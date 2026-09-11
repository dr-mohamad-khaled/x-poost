export async function ensureUpsellDiscountRegistered(admin: { graphql: Function }) {
  try {
    // 1. Query registered shopify functions
    const funcRes = await admin.graphql(
      `#graphql
      query GetShopifyFunctions {
        shopifyFunctions(first: 25) {
          nodes {
            id
            title
            apiType
          }
        }
      }`
    );
    const funcData = await funcRes.json();
    const functions = funcData?.data?.shopifyFunctions?.nodes || [];
    const discountFunc = functions.find(
      (f: { apiType?: string; title?: string }) =>
        f.apiType === "product_discount" ||
        f.title?.toLowerCase().includes("xpoost") ||
        f.title?.toLowerCase().includes("discount")
    );

    if (!discountFunc) {
      return null;
    }

    // 2. Check if automatic discount already exists
    const discountNodesRes = await admin.graphql(
      `#graphql
      query GetDiscounts {
        discountNodes(first: 50) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticApp {
                title
                status
              }
            }
          }
        }
      }`
    );
    const discountsData = await discountNodesRes.json();
    const nodes = discountsData?.data?.discountNodes?.nodes || [];
    const existing = nodes.find((n: any) => {
      const title = n?.discount?.title || "";
      return (
        title === "Xpoost Dynamic Upsell Discount" ||
        title.toLowerCase().includes("xpoost")
      );
    });

    if (existing) {
      return existing;
    }

    // 3. Create the automatic discount
    const createRes = await admin.graphql(
      `#graphql
      mutation CreateAutomaticDiscount($discount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $discount) {
          automaticAppDiscount {
            discountId
            title
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          discount: {
            title: "Xpoost Dynamic Upsell Discount",
            functionId: discountFunc.id,
            startsAt: new Date().toISOString(),
            combinesWith: {
              orderDiscounts: true,
              productDiscounts: true,
              shippingDiscounts: true,
            },
          },
        },
      }
    );
    const createData = await createRes.json();
    return createData?.data?.discountAutomaticAppCreate?.automaticAppDiscount;
  } catch (err) {
    console.error("[xpoost-discount] Error ensuring discount registered:", err);
    return null;
  }
}
