import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) {
    return Response.json({ products: [] });
  }

  try {
    const cleanQuery = q.replace(/["*\\/]/g, " ").trim();
    if (!cleanQuery) {
      return Response.json({ products: [] });
    }

    const searchExpression = cleanQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `*${w}*`)
      .join(" ");

    const response = await admin.graphql(
      `#graphql
      query searchProducts($query: String!) {
        products(first: 50, query: $query) {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }`,
      {
        variables: {
          query: searchExpression,
        },
      }
    );

    const json = await response.json();
    const products = (json.data?.products?.edges || []).map((e: any) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
      imageUrl: e.node.featuredImage?.url || "",
      price: e.node.variants?.edges[0]?.node?.price || "19.99",
      variantId: e.node.variants?.edges[0]?.node?.id || "",
    }));

    return Response.json({ products });
  } catch (err: any) {
    console.error("[SearchProducts] Error:", err);
    return Response.json({ products: [] });
  }
};
