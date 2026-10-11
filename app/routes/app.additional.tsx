import { redirect } from "react-router";

// Leftover page from the Shopify app template. It has no content, so it just returns to the dashboard.
export const loader = async () => redirect("/app");

export default function AdditionalPage() {
  return null;
}
