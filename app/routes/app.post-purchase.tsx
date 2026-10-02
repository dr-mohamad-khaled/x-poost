import {
  Box,
  Card,
  Layout,
  Page,
  Text,
  Button,
  InlineStack,
  BlockStack,
  Badge,
  EmptyState,
} from "@shopify/polaris";
import { useLoaderData } from "@react-router/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    include: { checkoutUpsellFunnels: true },
  });

  return { funnels: shop?.checkoutUpsellFunnels || [], shopDomain: session.shop };
};

export default function PostPurchaseDashboard() {
  const { funnels } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Post-Purchase & Thank You Funnels"
      subtitle="One-click upsells and post-purchase offers to maximize AOV."
      primaryAction={{ content: "Create Funnel", onAction: () => {} }}
    >
      <Layout>
        <Layout.Section>
          {funnels.length === 0 ? (
            <Card>
              <EmptyState
                heading="Supercharge your checkout revenue"
                action={{ content: "Create your first funnel" }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Create highly converting post-purchase and thank-you page
                  upsells. Offer discounts, trigger impulse buys, and increase
                  retention.
                </p>
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="400">
              {funnels.map((funnel) => (
                <Card key={funnel.id}>
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="200">
                      <InlineStack gap="300" blockAlign="center">
                        <Text variant="headingMd" as="h3">
                          {funnel.title}
                        </Text>
                        <Badge tone={funnel.status === "ACTIVE" ? "success" : "info"}>
                          {funnel.status}
                        </Badge>
                      </InlineStack>
                      <Text variant="bodySm" as="p" tone="subdued">
                        Target: {funnel.pageTarget === "POST_PURCHASE" ? "Post-Purchase One-Click Upsell" : "Thank You Page"}
                      </Text>
                    </BlockStack>
                    <Button variant="secondary">Edit Funnel</Button>
                  </InlineStack>
                </Card>
              ))}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
