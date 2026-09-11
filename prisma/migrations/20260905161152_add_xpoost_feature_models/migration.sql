-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "scarcityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prePurchaseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inCartUpsellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "socialBarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingBarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "exitIntentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stickyBarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScarcityWidgetConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT NOT NULL DEFAULT 'bottom-left',
    "onsetDelayMs" INTEGER NOT NULL DEFAULT 3000,
    "displayDurationMs" INTEGER NOT NULL DEFAULT 6000,
    "intervalDelayMs" INTEGER NOT NULL DEFAULT 8000,
    "backgroundColor" TEXT NOT NULL DEFAULT '#0B0B0B',
    "accentColor" TEXT NOT NULL DEFAULT '#D4AF37',
    "messagesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScarcityWidgetConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UpsellRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "triggerProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "discountPercent" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UpsellRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialWidgetConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNumber" TEXT,
    "whatsappMessage" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "tiktokUrl" TEXT,
    "vipCommunityLabel" TEXT DEFAULT 'Join our VIP Deals Group',
    "vipCommunityUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialWidgetConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShippingBarConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "tiersJson" TEXT NOT NULL DEFAULT '[]',
    "progressColor" TEXT NOT NULL DEFAULT '#D4AF37',
    "trackColor" TEXT NOT NULL DEFAULT '#0B0B0B',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShippingBarConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExitIntentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "countdownSeconds" INTEGER NOT NULL DEFAULT 600,
    "discountCode" TEXT,
    "headline" TEXT DEFAULT 'Wait! Don''t leave yet',
    "bodyText" TEXT,
    "suppressionDays" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExitIntentConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StickyBarConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mobileOnly" BOOLEAN NOT NULL DEFAULT true,
    "showPrice" BOOLEAN NOT NULL DEFAULT true,
    "buttonStyle" TEXT NOT NULL DEFAULT 'solid',
    "buttonLabel" TEXT NOT NULL DEFAULT 'Add to Cart',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StickyBarConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE INDEX "Shop_shopDomain_idx" ON "Shop"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ScarcityWidgetConfig_shopId_key" ON "ScarcityWidgetConfig"("shopId");

-- CreateIndex
CREATE INDEX "UpsellRule_shopId_idx" ON "UpsellRule"("shopId");

-- CreateIndex
CREATE INDEX "UpsellRule_shopId_triggerProductId_idx" ON "UpsellRule"("shopId", "triggerProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialWidgetConfig_shopId_key" ON "SocialWidgetConfig"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingBarConfig_shopId_key" ON "ShippingBarConfig"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ExitIntentConfig_shopId_key" ON "ExitIntentConfig"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "StickyBarConfig_shopId_key" ON "StickyBarConfig"("shopId");
