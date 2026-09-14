import prisma from "./db.server";

export async function getOrCreateShop(shopDomain: string) {
  return prisma.shop.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain },
  });
}

export async function getShopWithConfigs(shopDomain: string) {
  const shop = await getOrCreateShop(shopDomain);
  return prisma.shop.findUnique({
    where: { id: shop.id },
    include: {
      scarcityConfig: true,
      upsellRules: true,
      socialConfig: true,
      shippingConfig: true,
      exitIntentConfig: true,
      stickyBarConfig: true,
      productScarcityConfig: true,
    },
  });
}
