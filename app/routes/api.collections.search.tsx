import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/** Collection search for the thank-you page condition builder. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const q = (new URL(request.url).searchParams.get("q") || "").replace(/["*\\/]/g, " ").trim();
  try {
    const query = q ? q.split(/\s+/).filter(Boolean).map((w) => `title:*${w}*`).join(" ") : "";
    const res = await admin.graphql(
      `#graphql
      query XpCollections($query: String) {
        collections(first: 30, query: $query) { nodes { id title } }
      }`,
      { variables: { query } },
    );
    const json: any = await res.json();
    return Response.json({ collections: (json.data?.collections?.nodes || []).map((c: any) => ({ id: c.id, title: c.title })) });
  } catch (err) {
    console.error("[SearchCollections] Error:", err);
    return Response.json({ collections: [] });
  }
};
