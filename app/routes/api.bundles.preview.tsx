import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Real product data for the Bundle Builder live preview (variants, prices, stock).
 * GET /api/bundles/preview?products=<id,id>&collections=<id,id>
 */
const tail = (g: string) => String(g || "").split("/").pop() || "";
const cents = (v: unknown) => Math.round((Number(v) || 0) * 100);

const FIELDS = `
  id handle title status
  featuredImage { url }
  variants(first: 30) { nodes { id title price compareAtPrice availableForSale image { url } } }
`;

function shape(p: any) {
  const variants = (p?.variants?.nodes || []).map((v: any) => ({
    id: tail(v.id),
    title: v.title === "Default Title" ? "" : v.title,
    price: cents(v.price),
    compare: cents(v.compareAtPrice),
    available: !!v.availableForSale,
    image: v.image?.url || "",
  }));
  return { id: tail(p.id), handle: p.handle, title: p.title, image: p.featuredImage?.url || "", available: variants.some((v: any) => v.available), variants };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const ids = (url.searchParams.get("products") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .slice(0, 60)
    .map((s) => `gid://shopify/Product/${s}`);
  const cols = (url.searchParams.get("collections") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .slice(0, 6);

  const products: Record<string, any> = {};
  const collections: Record<string, string[]> = {};
  try {
    if (ids.length) {
      const res = await admin.graphql(`#graphql\nquery XpBbPreview($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { ${FIELDS} } } }`, { variables: { ids } });
      const j: any = await res.json();
      for (const p of j?.data?.nodes || []) if (p?.id) products[tail(p.id)] = shape(p);
    }
    await Promise.all(
      cols.map(async (c) => {
        const res = await admin.graphql(`#graphql\nquery XpBbPreviewCol($id: ID!) { collection(id: $id) { products(first: 8) { nodes { ${FIELDS} } } } }`, {
          variables: { id: `gid://shopify/Collection/${c}` },
        });
        const j: any = await res.json();
        const list = (j?.data?.collection?.products?.nodes || []).filter((p: any) => p?.status === "ACTIVE");
        collections[c] = list.map((p: any) => {
          const s = shape(p);
          products[s.id] = s;
          return s.handle;
        });
      }),
    );
  } catch (err) {
    console.error("[xpoost-bundles] preview data failed:", err);
  }
  return Response.json({ products, collections });
};
