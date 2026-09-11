-- AlterTable
ALTER TABLE "UpsellRule" ADD COLUMN "discountCode" TEXT;
ALTER TABLE "UpsellRule" ADD COLUMN "offerDescription" TEXT;
ALTER TABLE "UpsellRule" ADD COLUMN "offerHeadline" TEXT DEFAULT 'Special Upgrade Offer';
ALTER TABLE "UpsellRule" ADD COLUMN "targetProductImage" TEXT;
ALTER TABLE "UpsellRule" ADD COLUMN "targetProductPrice" TEXT;
ALTER TABLE "UpsellRule" ADD COLUMN "targetProductTitle" TEXT;
ALTER TABLE "UpsellRule" ADD COLUMN "targetVariantId" TEXT;
ALTER TABLE "UpsellRule" ADD COLUMN "triggerProductTitle" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExitIntentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "countdownSeconds" INTEGER NOT NULL DEFAULT 600,
    "discountCode" TEXT DEFAULT 'SAVE10',
    "headline" TEXT DEFAULT 'Wait! Don''t leave empty handed',
    "bodyText" TEXT DEFAULT 'Take an extra 10% off your entire order right now.',
    "buttonText" TEXT DEFAULT 'Claim 10% Off & Checkout',
    "suppressionDays" INTEGER NOT NULL DEFAULT 1,
    "backgroundColor" TEXT NOT NULL DEFAULT '#0B0B0B',
    "accentColor" TEXT NOT NULL DEFAULT '#D4AF37',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExitIntentConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExitIntentConfig" ("active", "bodyText", "countdownSeconds", "createdAt", "discountCode", "headline", "id", "shopId", "suppressionDays", "updatedAt") SELECT "active", "bodyText", "countdownSeconds", "createdAt", "discountCode", "headline", "id", "shopId", "suppressionDays", "updatedAt" FROM "ExitIntentConfig";
DROP TABLE "ExitIntentConfig";
ALTER TABLE "new_ExitIntentConfig" RENAME TO "ExitIntentConfig";
CREATE UNIQUE INDEX "ExitIntentConfig_shopId_key" ON "ExitIntentConfig"("shopId");
CREATE TABLE "new_ScarcityWidgetConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "showOn" TEXT NOT NULL DEFAULT 'all',
    "position" TEXT NOT NULL DEFAULT 'bottom-left',
    "onsetDelayMs" INTEGER NOT NULL DEFAULT 3000,
    "displayDurationMs" INTEGER NOT NULL DEFAULT 6000,
    "intervalDelayMs" INTEGER NOT NULL DEFAULT 8000,
    "desktopBottomOffsetPx" INTEGER NOT NULL DEFAULT 24,
    "mobileBottomOffsetPx" INTEGER NOT NULL DEFAULT 24,
    "backgroundColor" TEXT NOT NULL DEFAULT '#0B0B0B',
    "accentColor" TEXT NOT NULL DEFAULT '#D4AF37',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "borderRadiusPx" INTEGER NOT NULL DEFAULT 12,
    "showCloseButton" BOOLEAN NOT NULL DEFAULT true,
    "showProgressBar" BOOLEAN NOT NULL DEFAULT true,
    "pauseOnHover" BOOLEAN NOT NULL DEFAULT true,
    "messagesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScarcityWidgetConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ScarcityWidgetConfig" ("accentColor", "active", "backgroundColor", "createdAt", "displayDurationMs", "id", "intervalDelayMs", "messagesJson", "onsetDelayMs", "position", "shopId", "updatedAt") SELECT "accentColor", "active", "backgroundColor", "createdAt", "displayDurationMs", "id", "intervalDelayMs", "messagesJson", "onsetDelayMs", "position", "shopId", "updatedAt" FROM "ScarcityWidgetConfig";
DROP TABLE "ScarcityWidgetConfig";
ALTER TABLE "new_ScarcityWidgetConfig" RENAME TO "ScarcityWidgetConfig";
CREATE UNIQUE INDEX "ScarcityWidgetConfig_shopId_key" ON "ScarcityWidgetConfig"("shopId");
CREATE TABLE "new_ShippingBarConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "tiersJson" TEXT NOT NULL DEFAULT '[]',
    "progressColor" TEXT NOT NULL DEFAULT '#D4AF37',
    "trackColor" TEXT NOT NULL DEFAULT '#222222',
    "backgroundColor" TEXT NOT NULL DEFAULT '#0B0B0B',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "initialMessage" TEXT DEFAULT 'Add items to unlock Free Shipping!',
    "allUnlockedMessage" TEXT DEFAULT 'Congratulations! You unlocked all rewards!',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShippingBarConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ShippingBarConfig" ("active", "createdAt", "currency", "id", "progressColor", "shopId", "tiersJson", "trackColor", "updatedAt") SELECT "active", "createdAt", "currency", "id", "progressColor", "shopId", "tiersJson", "trackColor", "updatedAt" FROM "ShippingBarConfig";
DROP TABLE "ShippingBarConfig";
ALTER TABLE "new_ShippingBarConfig" RENAME TO "ShippingBarConfig";
CREATE UNIQUE INDEX "ShippingBarConfig_shopId_key" ON "ShippingBarConfig"("shopId");
CREATE TABLE "new_SocialWidgetConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT NOT NULL DEFAULT 'bottom-right',
    "badgeText" TEXT NOT NULL DEFAULT 'Need help? Chat with us',
    "whatsappNumber" TEXT,
    "whatsappMessage" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "tiktokUrl" TEXT,
    "vipCommunityLabel" TEXT DEFAULT 'Join our VIP Deals Group',
    "vipCommunityUrl" TEXT,
    "backgroundColor" TEXT NOT NULL DEFAULT '#0B0B0B',
    "accentColor" TEXT NOT NULL DEFAULT '#D4AF37',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialWidgetConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SocialWidgetConfig" ("active", "createdAt", "facebookUrl", "id", "instagramUrl", "shopId", "tiktokUrl", "updatedAt", "vipCommunityLabel", "vipCommunityUrl", "whatsappMessage", "whatsappNumber") SELECT "active", "createdAt", "facebookUrl", "id", "instagramUrl", "shopId", "tiktokUrl", "updatedAt", "vipCommunityLabel", "vipCommunityUrl", "whatsappMessage", "whatsappNumber" FROM "SocialWidgetConfig";
DROP TABLE "SocialWidgetConfig";
ALTER TABLE "new_SocialWidgetConfig" RENAME TO "SocialWidgetConfig";
CREATE UNIQUE INDEX "SocialWidgetConfig_shopId_key" ON "SocialWidgetConfig"("shopId");
CREATE TABLE "new_StickyBarConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mobileOnly" BOOLEAN NOT NULL DEFAULT true,
    "showPrice" BOOLEAN NOT NULL DEFAULT true,
    "showCompareAtPrice" BOOLEAN NOT NULL DEFAULT true,
    "buttonStyle" TEXT NOT NULL DEFAULT 'solid',
    "buttonLabel" TEXT NOT NULL DEFAULT 'Add to Cart',
    "backgroundColor" TEXT NOT NULL DEFAULT '#0B0B0B',
    "accentColor" TEXT NOT NULL DEFAULT '#D4AF37',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StickyBarConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StickyBarConfig" ("active", "buttonLabel", "buttonStyle", "createdAt", "id", "mobileOnly", "shopId", "showPrice", "updatedAt") SELECT "active", "buttonLabel", "buttonStyle", "createdAt", "id", "mobileOnly", "shopId", "showPrice", "updatedAt" FROM "StickyBarConfig";
DROP TABLE "StickyBarConfig";
ALTER TABLE "new_StickyBarConfig" RENAME TO "StickyBarConfig";
CREATE UNIQUE INDEX "StickyBarConfig_shopId_key" ON "StickyBarConfig"("shopId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
