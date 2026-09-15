import { useState, useMemo, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import FeatureLanguageSwitcher from "../components/FeatureLanguageSwitcher";
import {
  type SupportedLanguage,
  DEFAULT_TRANSLATIONS_BY_LANG,
  getAllTranslations,
  sanitizeText,
} from "../utils/translations";

export type QuantityBreakTier = {
  quantity: number;
  discountValue: number;
  title: string;
  subtitle: string;
  badge: string;
};

export type QuantityBreakTranslations = {
  sectionTitle: string;
  subtitle: string;
  eachLabel: string;
  totalLabel: string;
  saveLabel: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  const offers = await prisma.quantityBreaksOffer.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  // Fetch store catalog products for picker
  let products: any[] = [];
  try {
    const res = await admin.graphql(`
      #graphql
      query GetProductsForQuantityBreaks {
        products(first: 250) {
          nodes {
            id
            title
            handle
            featuredImage {
              url
              altText
            }
            variants(first: 1) {
              nodes {
                id
                price
              }
            }
          }
        }
      }
    `);
    const data = await res.json();
    products = data?.data?.products?.nodes || [];
  } catch (err) {
    console.error("[Quantity Breaks Loader] Error fetching products:", err);
  }

  let translationConfig = await prisma.translationConfig.findUnique({
    where: { shopId: shop.id },
  });
  if (!translationConfig) {
    translationConfig = await prisma.translationConfig.create({
      data: {
        shopId: shop.id,
        dashboardLocale: "en",
        storefrontLocale: "ar",
        translationsJson: "{}",
      },
    });
  }

  const allTranslations = getAllTranslations(translationConfig?.translationsJson);
  const dashboardLocale = (translationConfig?.dashboardLocale || "en") as SupportedLanguage;

  return {
    shopDomain: session.shop,
    offers,
    products,
    quantityBreaksEnabled: shop.quantityBreaksEnabled,
    allTranslations,
    dashboardLocale,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const actionType = String(formData.get("actionType") || "saveOffer");

  try {
    if (actionType === "toggleMasterEnabled") {
      const enabled = formData.get("enabled") === "true";
      await prisma.shop.update({
        where: { id: shop.id },
        data: { quantityBreaksEnabled: enabled },
      });
      return { success: true, message: "Quantity Breaks status updated." };
    }

    if (actionType === "toggleOfferStatus") {
      const offerId = String(formData.get("offerId") || "");
      const currentStatus = String(formData.get("currentStatus") || "DRAFT");
      const nextStatus = currentStatus === "ACTIVE" ? "DRAFT" : "ACTIVE";
      await prisma.quantityBreaksOffer.update({
        where: { id: offerId },
        data: { status: nextStatus },
      });
      return { success: true, message: `Offer status set to ${nextStatus}.` };
    }

    if (actionType === "deleteOffer") {
      const offerId = String(formData.get("offerId") || "");
      await prisma.quantityBreaksOffer.delete({
        where: { id: offerId },
      });
      return { success: true, message: "Offer deleted successfully." };
    }

    if (actionType === "duplicateOffer") {
      const offerId = String(formData.get("offerId") || "");
      const existing = await prisma.quantityBreaksOffer.findUnique({
        where: { id: offerId },
      });
      if (existing) {
        await prisma.quantityBreaksOffer.create({
          data: {
            shopId: shop.id,
            title: `${existing.title} (Copy)`,
            status: "DRAFT",
            targetMode: existing.targetMode,
            productIdsJson: existing.productIdsJson,
            discountType: existing.discountType,
            tiersJson: existing.tiersJson,
            designPreset: existing.designPreset,
            animationStyle: existing.animationStyle,
            accentColor: existing.accentColor,
            backgroundColor: existing.backgroundColor,
            borderColor: existing.borderColor,
            textColor: existing.textColor,
            badgeBgColor: existing.badgeBgColor,
            badgeTextColor: existing.badgeTextColor,
            translationsJson: existing.translationsJson,
          },
        });
        return { success: true, message: "Offer duplicated successfully." };
      }
    }

    if (actionType === "saveOffer") {
      const offerId = String(formData.get("offerId") || "");
      const title = String(formData.get("title") || "Volume Discount Offer").trim();
      const status = String(formData.get("status") || "ACTIVE");
      const targetMode = String(formData.get("targetMode") || "SPECIFIC");
      const productIdsJson = String(formData.get("productIdsJson") || "[]");
      const discountType = String(formData.get("discountType") || "PERCENTAGE");
      const tiersJson = String(formData.get("tiersJson") || "[]");
      const designPreset = String(formData.get("designPreset") || "modern_cards");
      const animationStyle = String(formData.get("animationStyle") || "shimmer");

      const accentColor = String(formData.get("accentColor") || "#D4AF37");
      const backgroundColor = String(formData.get("backgroundColor") || "#141414");
      const borderColor = String(formData.get("borderColor") || "#282828");
      const textColor = String(formData.get("textColor") || "#FFFFFF");
      const badgeBgColor = String(formData.get("badgeBgColor") || "#D4AF37");
      const badgeTextColor = String(formData.get("badgeTextColor") || "#000000");
      const translationsJson = String(formData.get("translationsJson") || "{}");

      if (offerId) {
        await prisma.quantityBreaksOffer.update({
          where: { id: offerId },
          data: {
            title,
            status,
            targetMode,
            productIdsJson,
            discountType,
            tiersJson,
            designPreset,
            animationStyle,
            accentColor,
            backgroundColor,
            borderColor,
            textColor,
            badgeBgColor,
            badgeTextColor,
            translationsJson,
          },
        });
        return { success: true, message: "Offer updated successfully.", returnToList: true };
      } else {
        await prisma.quantityBreaksOffer.create({
          data: {
            shopId: shop.id,
            title,
            status,
            targetMode,
            productIdsJson,
            discountType,
            tiersJson,
            designPreset,
            animationStyle,
            accentColor,
            backgroundColor,
            borderColor,
            textColor,
            badgeBgColor,
            badgeTextColor,
            translationsJson,
          },
        });
        return { success: true, message: "New offer created successfully.", returnToList: true };
      }
    }

    return { error: "Unknown action" };
  } catch (err: any) {
    console.error("[Quantity Breaks Action Error]:", err);
    return { error: err?.message || "Failed to process request." };
  }
};

const DEFAULT_TIERS: QuantityBreakTier[] = [
  {
    quantity: 1,
    discountValue: 0,
    title: "Buy 1 Item",
    subtitle: "Standard Pack",
    badge: "",
  },
  {
    quantity: 2,
    discountValue: 10,
    title: "Buy 2 Items",
    subtitle: "Save 10% on your order",
    badge: "Most Popular",
  },
  {
    quantity: 3,
    discountValue: 20,
    title: "Buy 3+ Items",
    subtitle: "Maximum value bundle",
    badge: "Best Value",
  },
];

export default function QuantityBreaksPage() {
  const {
    shopDomain,
    offers,
    products: initialProducts,
    quantityBreaksEnabled,
    dashboardLocale,
  } = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";

  // Views: "list" | "create" | "edit"
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit">("list");
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("Volume Discount Offer");
  const [status, setStatus] = useState("ACTIVE");
  const [targetMode, setTargetMode] = useState<"SPECIFIC" | "ALL">("SPECIFIC");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED_PER_ITEM">("PERCENTAGE");
  const [tiers, setTiers] = useState<QuantityBreakTier[]>(DEFAULT_TIERS);
  const [designPreset, setDesignPreset] = useState("modern_cards");
  const [animationStyle, setAnimationStyle] = useState("shimmer");

  const [accentColor, setAccentColor] = useState("#D4AF37");
  const [backgroundColor, setBackgroundColor] = useState("#141414");
  const [borderColor, setBorderColor] = useState("#282828");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [badgeBgColor, setBadgeBgColor] = useState("#D4AF37");
  const [badgeTextColor, setBadgeTextColor] = useState("#000000");

  // Multi-Language State
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(dashboardLocale || "en");
  const [translationsMap, setTranslationsMap] = useState<Record<string, QuantityBreakTranslations>>(() => {
    const map: Record<string, QuantityBreakTranslations> = {};
    const langs: SupportedLanguage[] = ["ar", "en", "fr", "de", "es", "it", "pt"];
    langs.forEach((l) => {
      const qb = DEFAULT_TRANSLATIONS_BY_LANG[l]?.quantityBreaks || DEFAULT_TRANSLATIONS_BY_LANG.en.quantityBreaks;
      map[l] = {
        sectionTitle: qb.sectionTitle || "Buy More, Save More",
        subtitle: qb.subtitle || "Select your bundle below to unlock exclusive discounts",
        eachLabel: qb.eachLabel || "each",
        totalLabel: qb.totalLabel || "Total",
        saveLabel: qb.saveLabel || "Save",
      };
    });
    return map;
  });

  // Catalog search
  const [catalog, setCatalog] = useState<any[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // When action completes with returnToList, switch back to list
  useEffect(() => {
    if (actionData?.success && (actionData as any)?.returnToList) {
      setViewMode("list");
      setEditingOfferId(null);
    }
  }, [actionData]);

  // Open Create Mode
  const handleOpenCreate = () => {
    setEditingOfferId(null);
    setTitle("Volume Discount Offer");
    setStatus("ACTIVE");
    setTargetMode("SPECIFIC");
    setSelectedProductIds([]);
    setDiscountType("PERCENTAGE");
    setTiers(DEFAULT_TIERS);
    setDesignPreset("modern_cards");
    setAnimationStyle("shimmer");
    setAccentColor("#D4AF37");
    setBackgroundColor("#141414");
    setBorderColor("#282828");
    setTextColor("#FFFFFF");
    setBadgeBgColor("#D4AF37");
    setBadgeTextColor("#000000");
    setViewMode("create");
  };

  // Open Edit Mode
  const handleOpenEdit = (offer: any) => {
    setEditingOfferId(offer.id);
    setTitle(offer.title);
    setStatus(offer.status);
    setTargetMode(offer.targetMode === "ALL" ? "ALL" : "SPECIFIC");
    try {
      setSelectedProductIds(JSON.parse(offer.productIdsJson || "[]"));
    } catch {
      setSelectedProductIds([]);
    }
    setDiscountType(offer.discountType || "PERCENTAGE");
    try {
      const parsedTiers = JSON.parse(offer.tiersJson || "[]");
      setTiers(parsedTiers.length ? parsedTiers : DEFAULT_TIERS);
    } catch {
      setTiers(DEFAULT_TIERS);
    }
    setDesignPreset(offer.designPreset || "modern_cards");
    setAnimationStyle(offer.animationStyle || "shimmer");
    setAccentColor(offer.accentColor || "#D4AF37");
    setBackgroundColor(offer.backgroundColor || "#141414");
    setBorderColor(offer.borderColor || "#282828");
    setTextColor(offer.textColor || "#FFFFFF");
    setBadgeBgColor(offer.badgeBgColor || "#D4AF37");
    setBadgeTextColor(offer.badgeTextColor || "#000000");

    try {
      const parsedTranslations = JSON.parse(offer.translationsJson || "{}");
      if (parsedTranslations && typeof parsedTranslations === "object") {
        setTranslationsMap((prev) => ({ ...prev, ...parsedTranslations }));
      }
    } catch {}

    setViewMode("edit");
  };

  // Live Catalog Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.products) && data.products.length > 0) {
            setCatalog((prev) => {
              const map = new Map(prev.map((p) => [p.id, p]));
              data.products.forEach((p: any) => map.set(p.id, p));
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.error("Catalog search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((p) => p.title.toLowerCase().includes(q));
  }, [catalog, searchQuery]);

  const selectedProductsList = useMemo(() => {
    const idSet = new Set(selectedProductIds.map((id) => String(id).replace(/\D/g, "")));
    return catalog.filter((p) => idSet.has(String(p.id).replace(/\D/g, "")));
  }, [catalog, selectedProductIds]);

  const toggleProductSelection = (productId: string) => {
    const cleanId = String(productId);
    setSelectedProductIds((prev) =>
      prev.includes(cleanId) ? prev.filter((id) => id !== cleanId) : [...prev, cleanId]
    );
  };

  // Tier manipulation
  const handleAddTier = () => {
    const nextQty = (tiers[tiers.length - 1]?.quantity || 1) + 1;
    const nextDisc = (tiers[tiers.length - 1]?.discountValue || 0) + 5;
    setTiers([
      ...tiers,
      {
        quantity: nextQty,
        discountValue: nextDisc,
        title: `Buy ${nextQty}+ Items`,
        subtitle: discountType === "PERCENTAGE" ? `Save ${nextDisc}% each` : `Save $${nextDisc} each`,
        badge: "",
      },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleUpdateTier = (index: number, field: keyof QuantityBreakTier, val: any) => {
    setTiers(
      tiers.map((t, i) => {
        if (i !== index) return t;
        return { ...t, [field]: val };
      })
    );
  };

  // Translation helpers
  const currentTranslations =
    translationsMap[selectedLang] ||
    translationsMap.en || {
      sectionTitle: "Buy More, Save More",
      subtitle: "Select your bundle below to unlock exclusive discounts",
      eachLabel: "each",
      totalLabel: "Total",
      saveLabel: "Save",
    };

  const handleUpdateTranslation = (field: keyof QuantityBreakTranslations, val: string) => {
    const clean = sanitizeText(val);
    setTranslationsMap((prev) => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        [field]: clean,
      },
    }));
  };

  const handleLoadPredefined = () => {
    const def = DEFAULT_TRANSLATIONS_BY_LANG[selectedLang]?.quantityBreaks || DEFAULT_TRANSLATIONS_BY_LANG.en.quantityBreaks;
    setTranslationsMap((prev) => ({
      ...prev,
      [selectedLang]: {
        sectionTitle: def.sectionTitle || "Buy More, Save More",
        subtitle: def.subtitle || "Select your bundle below",
        eachLabel: def.eachLabel || "each",
        totalLabel: def.totalLabel || "Total",
        saveLabel: def.saveLabel || "Save",
      },
    }));
  };

  // Live Interactive Preview State
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(1);
  const samplePrice = 50.0;
  const isPreviewRtl = selectedLang === "ar";

  return (
    <s-page heading="Quantity Breaks & Volume Discounts">
      <style>{`
        .xpp-qb-admin {
          max-width: 1100px;
          margin: 0 auto;
          padding: 20px 0 80px;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .xpp-card {
          background: #141414;
          border: 1px solid #282828;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .xpp-card-title {
          font-size: 17px;
          font-weight: 800;
          color: #D4AF37;
          margin: 0 0 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .xpp-card-desc {
          font-size: 13px;
          color: #a1a1aa;
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .xpp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .xpp-btn--primary {
          background: linear-gradient(135deg, #FFD700 0%, #D4AF37 100%);
          color: #000000;
        }
        .xpp-btn--secondary {
          background: #242424;
          color: #ffffff;
          border: 1px solid #3d3d3d;
        }
        .xpp-btn--danger {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .xpp-btn--sm {
          padding: 6px 12px;
          font-size: 12px;
        }
        .xpp-input {
          width: 100%;
          background: #1f1f1f;
          border: 1px solid #383838;
          border-radius: 8px;
          padding: 10px 14px;
          color: #ffffff;
          font-size: 14px;
          box-sizing: border-box;
        }
        .xpp-input:focus {
          border-color: #D4AF37;
          outline: none;
        }
        .xpp-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 6px;
        }
        .xpp-hint {
          font-size: 12px;
          color: #888888;
          margin-top: 4px;
        }
        .xpp-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        .xpp-table th {
          text-align: left;
          padding: 12px;
          border-bottom: 2px solid #282828;
          font-size: 12px;
          font-weight: 800;
          color: #D4AF37;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .xpp-table td {
          padding: 14px 12px;
          border-bottom: 1px solid #222222;
          font-size: 13px;
          color: #e4e4e7;
          vertical-align: middle;
        }
        .xpp-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .xpp-badge--active {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .xpp-badge--draft {
          background: rgba(161, 161, 170, 0.15);
          color: #a1a1aa;
          border: 1px solid rgba(161, 161, 170, 0.3);
        }
        .xpp-preset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }
        .xpp-preset-card {
          background: #1a1a1a;
          border: 2px solid #333333;
          border-radius: 10px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .xpp-preset-card:hover {
          border-color: #555555;
        }
        .xpp-preset-card--active {
          border-color: #D4AF37;
          background: #1e1b12;
        }
        .xpp-tier-item {
          background: #1c1c1c;
          border: 1px solid #333333;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 14px;
        }
        .xpp-product-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #242424;
          border: 1px solid #3d3d3d;
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 12px;
          margin: 4px;
          color: #ffffff;
        }
        .xpp-product-chip button {
          background: none;
          border: none;
          color: #ff5252;
          font-weight: bold;
          cursor: pointer;
          padding: 0;
        }
        .xpp-color-picker {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .xpp-color-picker input[type="color"] {
          width: 40px;
          height: 40px;
          border: 1px solid #444;
          border-radius: 8px;
          background: none;
          cursor: pointer;
          padding: 0;
        }

        /* ANIMATIONS FOR PREVIEWS */
        .xpp-anim-shimmer {
          position: relative;
          overflow: hidden;
        }
        .xpp-anim-shimmer::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            60deg,
            transparent 0%,
            transparent 40%,
            rgba(255, 255, 255, 0.25) 50%,
            transparent 60%,
            transparent 100%
          );
          transform: rotate(25deg);
          animation: xpp-shimmer-pass 3.2s infinite ease-in-out;
          pointer-events: none;
        }
        @keyframes xpp-shimmer-pass {
          0% { transform: translateX(-100%) rotate(25deg); }
          50%, 100% { transform: translateX(100%) rotate(25deg); }
        }
        .xpp-anim-pulse {
          animation: xpp-pulse-glow 2.2s infinite ease-in-out;
        }
        @keyframes xpp-pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4); }
          50% { box-shadow: 0 0 14px 2px rgba(212, 175, 55, 0.7); }
        }
        .xpp-anim-float {
          animation: xpp-badge-float 2.4s infinite ease-in-out;
        }
        @keyframes xpp-badge-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>

      <div className="xpp-qb-admin">
        {actionData?.error && (
          <div style={{ background: "#3d1414", borderLeft: "4px solid #ff5252", padding: "14px 18px", borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, color: "#ff5252" }}>Notice</div>
            <p style={{ margin: "4px 0 0", color: "#ffffff", fontSize: 13 }}>{actionData.error}</p>
          </div>
        )}

        {actionData?.message && (
          <div style={{ background: "#143d1a", borderLeft: "4px solid #4ade80", padding: "14px 18px", borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, color: "#4ade80" }}>Updated</div>
            <p style={{ margin: "4px 0 0", color: "#ffffff", fontSize: 13 }}>{actionData.message}</p>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 1: OFFERS LIST */}
        {/* ============================================================== */}
        {viewMode === "list" && (
          <>
            {/* Top Overview & Master Switch Card */}
            <div className="xpp-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 className="xpp-card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                  </svg>
                  Quantity Breaks & Volume Discounts
                </h2>
                <p className="xpp-card-desc" style={{ margin: 0 }}>
                  Incentivize shoppers to purchase multiple items with attractive tiered pricing and volume discounts.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Form method="post">
                  <input type="hidden" name="actionType" value="toggleMasterEnabled" />
                  <input type="hidden" name="enabled" value={String(!quantityBreaksEnabled)} />
                  <button type="submit" className={`xpp-btn ${quantityBreaksEnabled ? "xpp-btn--primary" : "xpp-btn--secondary"}`}>
                    {quantityBreaksEnabled ? "Feature: Active" : "Feature: Disabled"}
                  </button>
                </Form>

                <button onClick={handleOpenCreate} className="xpp-btn xpp-btn--primary">
                  + Create New Offer
                </button>
              </div>
            </div>

            {/* Theme Placement Notice Card */}
            <div className="xpp-card" style={{ background: "linear-gradient(135deg, #18150f 0%, #141414 100%)", border: "1.5px solid rgba(212, 175, 55, 0.35)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#D4AF37", margin: "0 0 6px" }}>
                    How to Display this Block on Your Product Page
                  </h3>
                  <p style={{ fontSize: 13, color: "#d4d4d8", margin: 0, lineHeight: 1.5 }}>
                    Open your <strong>Shopify Theme Editor</strong>, navigate to any Product template, click <strong>"Add block"</strong> under Product information, and select <strong>"XPoost: Quantity Breaks"</strong>.
                  </p>
                </div>
                <a
                  href={`https://${shopDomain}/admin/themes/current/editor?template=product`}
                  target="_blank"
                  rel="noreferrer"
                  className="xpp-btn xpp-btn--secondary"
                >
                  Open Theme Editor &rarr;
                </a>
              </div>
            </div>

            {/* Offers Table Card */}
            <div className="xpp-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 className="xpp-card-title" style={{ margin: 0 }}>
                  Configured Offers ({offers.length})
                </h3>
              </div>

              {offers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px" }}>
                  <div style={{ fontSize: 36, marginBottom: 12, color: "#D4AF37" }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    </svg>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "#fff" }}>No quantity break offers yet</h4>
                  <p style={{ fontSize: 13, color: "#a1a1aa", maxWidth: 420, margin: "0 auto 20px" }}>
                    Create your first volume discount offer to reward customers who buy 2, 3, or more items together.
                  </p>
                  <button onClick={handleOpenCreate} className="xpp-btn xpp-btn--primary">
                    + Create First Offer
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="xpp-table">
                    <thead>
                      <tr>
                        <th>Offer Title</th>
                        <th>Targeting</th>
                        <th>Discount Type</th>
                        <th>Tiers</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offers.map((offer: any) => {
                        let parsedTiers: any[] = [];
                        try {
                          parsedTiers = JSON.parse(offer.tiersJson || "[]");
                        } catch {}
                        let productIds: any[] = [];
                        try {
                          productIds = JSON.parse(offer.productIdsJson || "[]");
                        } catch {}

                        return (
                          <tr key={offer.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: "#ffffff" }}>{offer.title}</div>
                              <div style={{ fontSize: 11, color: "#71717a" }}>Preset: {offer.designPreset}</div>
                            </td>
                            <td>
                              {offer.targetMode === "ALL" ? (
                                <span style={{ color: "#D4AF37", fontWeight: 700 }}>All Products</span>
                              ) : (
                                <span>{productIds.length} Targeted Product{productIds.length === 1 ? "" : "s"}</span>
                              )}
                            </td>
                            <td>
                              <span style={{ background: "rgba(212, 175, 55, 0.15)", color: "#FFD700", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                                {offer.discountType === "FIXED_PER_ITEM" ? "Fixed Per Item ($)" : "Percentage (%)"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {parsedTiers.map((t: any, idx: number) => (
                                  <span key={idx} style={{ background: "#222", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>
                                    {t.quantity}x ({t.discountValue}{offer.discountType === "FIXED_PER_ITEM" ? "$" : "%"})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <Form method="post" style={{ display: "inline" }}>
                                <input type="hidden" name="actionType" value="toggleOfferStatus" />
                                <input type="hidden" name="offerId" value={offer.id} />
                                <input type="hidden" name="currentStatus" value={offer.status} />
                                <button
                                  type="submit"
                                  className={`xpp-badge ${offer.status === "ACTIVE" ? "xpp-badge--active" : "xpp-badge--draft"}`}
                                  style={{ cursor: "pointer", border: "none" }}
                                  title="Click to toggle status"
                                >
                                  {offer.status}
                                </button>
                              </Form>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 8 }}>
                                <button onClick={() => handleOpenEdit(offer)} className="xpp-btn xpp-btn--secondary xpp-btn--sm">
                                  Edit
                                </button>
                                <Form method="post" style={{ display: "inline" }}>
                                  <input type="hidden" name="actionType" value="duplicateOffer" />
                                  <input type="hidden" name="offerId" value={offer.id} />
                                  <button type="submit" className="xpp-btn xpp-btn--secondary xpp-btn--sm">
                                    Copy
                                  </button>
                                </Form>
                                <Form method="post" style={{ display: "inline" }} onSubmit={(e) => { if (!confirm("Delete this offer?")) e.preventDefault(); }}>
                                  <input type="hidden" name="actionType" value="deleteOffer" />
                                  <input type="hidden" name="offerId" value={offer.id} />
                                  <button type="submit" className="xpp-btn xpp-btn--danger xpp-btn--sm">
                                    Delete
                                  </button>
                                </Form>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: CREATE / EDIT OFFER */}
        {/* ============================================================== */}
        {(viewMode === "create" || viewMode === "edit") && (
          <Form method="post">
            <input type="hidden" name="actionType" value="saveOffer" />
            <input type="hidden" name="offerId" value={editingOfferId || ""} />
            <input type="hidden" name="targetMode" value={targetMode} />
            <input type="hidden" name="productIdsJson" value={JSON.stringify(selectedProductIds)} />
            <input type="hidden" name="discountType" value={discountType} />
            <input type="hidden" name="tiersJson" value={JSON.stringify(tiers)} />
            <input type="hidden" name="designPreset" value={designPreset} />
            <input type="hidden" name="animationStyle" value={animationStyle} />
            <input type="hidden" name="translationsJson" value={JSON.stringify(translationsMap)} />

            {/* Top Navigation & Save Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="xpp-btn xpp-btn--secondary"
              >
                &larr; Back to Offers List
              </button>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="xpp-btn xpp-btn--primary"
                >
                  {isSubmitting ? "Saving..." : "Save Offer"}
                </button>
              </div>
            </div>

            {/* Language Switcher for Copy Editing */}
            <div className="xpp-card" style={{ border: "1px solid rgba(212, 175, 55, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "#D4AF37", margin: "0 0 4px" }}>
                    Multi-Language Translation Customization
                  </h3>
                  <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>
                    Customize the widget's copy for each storefront language.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FeatureLanguageSwitcher
                    currentLanguage={selectedLang}
                    onLanguageChange={(lang) => setSelectedLang(lang)}
                  />
                  <button
                    type="button"
                    onClick={handleLoadPredefined}
                    className="xpp-btn xpp-btn--secondary xpp-btn--sm"
                  >
                    Load Predefined ({selectedLang.toUpperCase()})
                  </button>
                </div>
              </div>
            </div>

            {/* Section 1: Offer Basics */}
            <div className="xpp-card">
              <h3 className="xpp-card-title">1. Offer Basics</h3>
              <p className="xpp-card-desc">Set an internal name and define whether this offer is active on your store.</p>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                <div>
                  <label className="xpp-label">Internal Offer Name</label>
                  <input
                    type="text"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="xpp-input"
                    placeholder="e.g. Summer T-Shirt Tiered Savings"
                    required
                  />
                  <div className="xpp-hint">For your reference in the admin dashboard.</div>
                </div>

                <div>
                  <label className="xpp-label">Status</label>
                  <select
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="xpp-input"
                  >
                    <option value="ACTIVE">Active (Live on store)</option>
                    <option value="DRAFT">Draft (Hidden)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Product Targeting */}
            <div className="xpp-card">
              <h3 className="xpp-card-title">2. Product Targeting</h3>
              <p className="xpp-card-desc">Select whether this quantity break offer applies to specific products or all products.</p>

              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <label
                  style={{
                    flex: 1,
                    background: targetMode === "SPECIFIC" ? "#1e1b12" : "#1a1a1a",
                    border: `2px solid ${targetMode === "SPECIFIC" ? "#D4AF37" : "#333"}`,
                    borderRadius: 10,
                    padding: 14,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="_targetRadio"
                    checked={targetMode === "SPECIFIC"}
                    onChange={() => setTargetMode("SPECIFIC")}
                    style={{ marginRight: 8 }}
                  />
                  <span style={{ fontWeight: 800, color: "#fff" }}>Specific Products</span>
                  <p style={{ margin: "4px 0 0 22px", fontSize: 12, color: "#a1a1aa" }}>
                    Apply terms only to chosen products (single product or multiple).
                  </p>
                </label>

                <label
                  style={{
                    flex: 1,
                    background: targetMode === "ALL" ? "#1e1b12" : "#1a1a1a",
                    border: `2px solid ${targetMode === "ALL" ? "#D4AF37" : "#333"}`,
                    borderRadius: 10,
                    padding: 14,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="_targetRadio"
                    checked={targetMode === "ALL"}
                    onChange={() => setTargetMode("ALL")}
                    style={{ marginRight: 8 }}
                  />
                  <span style={{ fontWeight: 800, color: "#fff" }}>All Store Products</span>
                  <p style={{ margin: "4px 0 0 22px", fontSize: 12, color: "#a1a1aa" }}>
                    Enable this volume tier structure across your entire catalog.
                  </p>
                </label>
              </div>

              {targetMode === "SPECIFIC" && (
                <div style={{ background: "#181818", padding: 16, borderRadius: 10, border: "1px solid #333" }}>
                  <label className="xpp-label">Search & Select Products</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type product title to search..."
                    className="xpp-input"
                    style={{ marginBottom: 10 }}
                  />
                  {isSearching && <div style={{ fontSize: 12, color: "#D4AF37" }}>Searching store catalog...</div>}

                  {/* Search Results Dropdown */}
                  {filteredSearchResults.length > 0 && (
                    <div style={{ maxHeight: 200, overflowY: "auto", background: "#222", borderRadius: 8, padding: 8, marginBottom: 12 }}>
                      {filteredSearchResults.map((prod) => {
                        const isSelected = selectedProductIds.includes(String(prod.id));
                        return (
                          <div
                            key={prod.id}
                            onClick={() => toggleProductSelection(prod.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              cursor: "pointer",
                              background: isSelected ? "#2d2a1d" : "transparent",
                              borderRadius: 6,
                            }}
                          >
                            <span style={{ fontSize: 13, color: isSelected ? "#FFD700" : "#fff" }}>{prod.title}</span>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{isSelected ? "Selected ✓" : "+ Add"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected Products Chips */}
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#a1a1aa" }}>
                      Selected Products ({selectedProductIds.length}):
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", marginTop: 6 }}>
                      {selectedProductsList.map((prod) => (
                        <div key={prod.id} className="xpp-product-chip">
                          <span>{prod.title}</span>
                          <button type="button" onClick={() => toggleProductSelection(prod.id)}>
                            &times;
                          </button>
                        </div>
                      ))}
                      {selectedProductIds.length === 0 && (
                        <span style={{ fontSize: 12, color: "#888", fontStyle: "italic", marginLeft: 4 }}>
                          No products selected yet. Search above to add items.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Discount Type */}
            <div className="xpp-card">
              <h3 className="xpp-card-title">3. Discount Calculation Mode</h3>
              <p className="xpp-card-desc">Choose whether volume savings are calculated as a percentage discount or a fixed deduction per item.</p>

              <div style={{ display: "flex", gap: 16 }}>
                <label
                  style={{
                    flex: 1,
                    background: discountType === "PERCENTAGE" ? "#1e1b12" : "#1a1a1a",
                    border: `2px solid ${discountType === "PERCENTAGE" ? "#D4AF37" : "#333"}`,
                    borderRadius: 10,
                    padding: 14,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="_discountTypeRadio"
                    checked={discountType === "PERCENTAGE"}
                    onChange={() => setDiscountType("PERCENTAGE")}
                    style={{ marginRight: 8 }}
                  />
                  <span style={{ fontWeight: 800, color: "#fff" }}>Percentage Discount (%)</span>
                  <p style={{ margin: "4px 0 0 22px", fontSize: 12, color: "#a1a1aa" }}>
                    e.g. Buy 2 get 10% off each, Buy 3 get 20% off each.
                  </p>
                </label>

                <label
                  style={{
                    flex: 1,
                    background: discountType === "FIXED_PER_ITEM" ? "#1e1b12" : "#1a1a1a",
                    border: `2px solid ${discountType === "FIXED_PER_ITEM" ? "#D4AF37" : "#333"}`,
                    borderRadius: 10,
                    padding: 14,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="_discountTypeRadio"
                    checked={discountType === "FIXED_PER_ITEM"}
                    onChange={() => setDiscountType("FIXED_PER_ITEM")}
                    style={{ marginRight: 8 }}
                  />
                  <span style={{ fontWeight: 800, color: "#fff" }}>Fixed Amount Deducted Per Item ($)</span>
                  <p style={{ margin: "4px 0 0 22px", fontSize: 12, color: "#a1a1aa" }}>
                    e.g. Buy 2 save $5.00 each, Buy 3 save $10.00 each.
                  </p>
                </label>
              </div>
            </div>

            {/* Section 4: Tiers Builder */}
            <div className="xpp-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 className="xpp-card-title" style={{ margin: 0 }}>4. Quantity Tiers Configuration</h3>
                  <p className="xpp-card-desc" style={{ margin: 0 }}>Define the quantities, discount amounts, titles, and highlight badges for each tier.</p>
                </div>
                <button type="button" onClick={handleAddTier} className="xpp-btn xpp-btn--secondary xpp-btn--sm">
                  + Add Another Tier
                </button>
              </div>

              {tiers.map((tier, idx) => (
                <div key={idx} className="xpp-tier-item">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#D4AF37" }}>
                      Tier #{idx + 1}
                    </span>
                    {tiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(idx)}
                        style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
                      >
                        Remove Tier &times;
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 2fr 2fr", gap: 12 }}>
                    <div>
                      <label className="xpp-label">Min Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={tier.quantity}
                        onChange={(e) => handleUpdateTier(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                        className="xpp-input"
                        required
                      />
                    </div>

                    <div>
                      <label className="xpp-label">
                        {discountType === "PERCENTAGE" ? "Discount %" : "Deduction ($)"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step={discountType === "PERCENTAGE" ? "1" : "0.5"}
                        value={tier.discountValue}
                        onChange={(e) => handleUpdateTier(idx, "discountValue", parseFloat(e.target.value) || 0)}
                        className="xpp-input"
                        required
                      />
                    </div>

                    <div>
                      <label className="xpp-label">Tier Title</label>
                      <input
                        type="text"
                        value={tier.title}
                        onChange={(e) => handleUpdateTier(idx, "title", e.target.value)}
                        className="xpp-input"
                        placeholder="e.g. Buy 2 Items"
                      />
                    </div>

                    <div>
                      <label className="xpp-label">Subtitle Note</label>
                      <input
                        type="text"
                        value={tier.subtitle}
                        onChange={(e) => handleUpdateTier(idx, "subtitle", e.target.value)}
                        className="xpp-input"
                        placeholder="e.g. Save 10% each"
                      />
                    </div>

                    <div>
                      <label className="xpp-label">Pill Badge (Optional)</label>
                      <input
                        type="text"
                        value={tier.badge}
                        onChange={(e) => handleUpdateTier(idx, "badge", e.target.value)}
                        className="xpp-input"
                        placeholder="e.g. Most Popular"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Section 5: Design Presets & Unique Animations */}
            <div className="xpp-card">
              <h3 className="xpp-card-title">5. Design Layout & Animations</h3>
              <p className="xpp-card-desc">Choose from 4 creative visual layouts and eye-catching animations.</p>

              <div className="xpp-preset-grid">
                <div
                  className={`xpp-preset-card ${designPreset === "modern_cards" ? "xpp-preset-card--active" : ""}`}
                  onClick={() => setDesignPreset("modern_cards")}
                >
                  <div style={{ fontWeight: 800, color: "#fff", marginBottom: 4 }}>Modern Stacked Cards</div>
                  <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>
                    Vertical stacked tiles with custom radio selectors, subtle gradient borders, and highlight badge.
                  </p>
                </div>

                <div
                  className={`xpp-preset-card ${designPreset === "grid_boxes" ? "xpp-preset-card--active" : ""}`}
                  onClick={() => setDesignPreset("grid_boxes")}
                >
                  <div style={{ fontWeight: 800, color: "#fff", marginBottom: 4 }}>Compact Grid Boxes</div>
                  <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>
                    Horizontal side-by-side cards with prominent quantity count and top banner discount tags.
                  </p>
                </div>

                <div
                  className={`xpp-preset-card ${designPreset === "minimal_table" ? "xpp-preset-card--active" : ""}`}
                  onClick={() => setDesignPreset("minimal_table")}
                >
                  <div style={{ fontWeight: 800, color: "#fff", marginBottom: 4 }}>Minimalist Sleek Rows</div>
                  <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>
                    Clean compact rows with circular indicator, aligned pricing, and subtle outline hover.
                  </p>
                </div>

                <div
                  className={`xpp-preset-card ${designPreset === "luxury_gold" ? "xpp-preset-card--active" : ""}`}
                  onClick={() => setDesignPreset("luxury_gold")}
                >
                  <div style={{ fontWeight: 800, color: "#fff", marginBottom: 4 }}>Luxury Gold Vault</div>
                  <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>
                    Deep obsidian card framing with gleaming gold accents, metallic badges, and live savings indicator.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <label className="xpp-label">Creative Animation Effect</label>
                <div style={{ display: "flex", gap: 14 }}>
                  <label
                    style={{
                      flex: 1,
                      background: animationStyle === "shimmer" ? "#1e1b12" : "#1a1a1a",
                      border: `1.5px solid ${animationStyle === "shimmer" ? "#D4AF37" : "#333"}`,
                      borderRadius: 8,
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="_animRadio"
                      checked={animationStyle === "shimmer"}
                      onChange={() => setAnimationStyle("shimmer")}
                      style={{ marginRight: 6 }}
                    />
                    <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>Shimmer Light Sweep</span>
                    <p style={{ margin: "2px 0 0 20px", fontSize: 11, color: "#a1a1aa" }}>
                      A continuous smooth light reflection gliding across the popular tier.
                    </p>
                  </label>

                  <label
                    style={{
                      flex: 1,
                      background: animationStyle === "shine_glow" ? "#1e1b12" : "#1a1a1a",
                      border: `1.5px solid ${animationStyle === "shine_glow" ? "#D4AF37" : "#333"}`,
                      borderRadius: 8,
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="_animRadio"
                      checked={animationStyle === "shine_glow"}
                      onChange={() => setAnimationStyle("shine_glow")}
                      style={{ marginRight: 6 }}
                    />
                    <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>Glowing Pulse</span>
                    <p style={{ margin: "2px 0 0 20px", fontSize: 11, color: "#a1a1aa" }}>
                      A soft breathing neon ambient glow around the selected tier.
                    </p>
                  </label>

                  <label
                    style={{
                      flex: 1,
                      background: animationStyle === "floating_badge" ? "#1e1b12" : "#1a1a1a",
                      border: `1.5px solid ${animationStyle === "floating_badge" ? "#D4AF37" : "#333"}`,
                      borderRadius: 8,
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="_animRadio"
                      checked={animationStyle === "floating_badge"}
                      onChange={() => setAnimationStyle("floating_badge")}
                      style={{ marginRight: 6 }}
                    />
                    <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>Floating Badge</span>
                    <p style={{ margin: "2px 0 0 20px", fontSize: 11, color: "#a1a1aa" }}>
                      An animated floating bob effect on highlight badges.
                    </p>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 6: Custom Appearance Colors */}
            <div className="xpp-card">
              <h3 className="xpp-card-title">6. Custom Appearance Colors</h3>
              <p className="xpp-card-desc">Fine-tune the palette to match your store's brand guidelines.</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                <div>
                  <label className="xpp-label">Accent / Highlight</label>
                  <div className="xpp-color-picker">
                    <input type="color" name="accentColor" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{accentColor}</span>
                  </div>
                </div>

                <div>
                  <label className="xpp-label">Card Background</label>
                  <div className="xpp-color-picker">
                    <input type="color" name="backgroundColor" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{backgroundColor}</span>
                  </div>
                </div>

                <div>
                  <label className="xpp-label">Border Outline</label>
                  <div className="xpp-color-picker">
                    <input type="color" name="borderColor" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{borderColor}</span>
                  </div>
                </div>

                <div>
                  <label className="xpp-label">Primary Text</label>
                  <div className="xpp-color-picker">
                    <input type="color" name="textColor" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{textColor}</span>
                  </div>
                </div>

                <div>
                  <label className="xpp-label">Badge Background</label>
                  <div className="xpp-color-picker">
                    <input type="color" name="badgeBgColor" value={badgeBgColor} onChange={(e) => setBadgeBgColor(e.target.value)} />
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{badgeBgColor}</span>
                  </div>
                </div>

                <div>
                  <label className="xpp-label">Badge Text</label>
                  <div className="xpp-color-picker">
                    <input type="color" name="badgeTextColor" value={badgeTextColor} onChange={(e) => setBadgeTextColor(e.target.value)} />
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{badgeTextColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 7: Translations Copy */}
            <div className="xpp-card">
              <h3 className="xpp-card-title">7. Copy & Translation ({selectedLang.toUpperCase()})</h3>
              <p className="xpp-card-desc">Texts shown on the storefront for this offer in {selectedLang.toUpperCase()}.</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
                <div>
                  <label className="xpp-label">Section Header Title</label>
                  <input
                    type="text"
                    value={currentTranslations.sectionTitle}
                    onChange={(e) => handleUpdateTranslation("sectionTitle", e.target.value)}
                    className="xpp-input"
                  />
                </div>

                <div>
                  <label className="xpp-label">Section Subtitle Note</label>
                  <input
                    type="text"
                    value={currentTranslations.subtitle}
                    onChange={(e) => handleUpdateTranslation("subtitle", e.target.value)}
                    className="xpp-input"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label className="xpp-label">"each" Label</label>
                  <input
                    type="text"
                    value={currentTranslations.eachLabel}
                    onChange={(e) => handleUpdateTranslation("eachLabel", e.target.value)}
                    className="xpp-input"
                  />
                </div>

                <div>
                  <label className="xpp-label">"Total" Label</label>
                  <input
                    type="text"
                    value={currentTranslations.totalLabel}
                    onChange={(e) => handleUpdateTranslation("totalLabel", e.target.value)}
                    className="xpp-input"
                  />
                </div>

                <div>
                  <label className="xpp-label">"Save" Label</label>
                  <input
                    type="text"
                    value={currentTranslations.saveLabel}
                    onChange={(e) => handleUpdateTranslation("saveLabel", e.target.value)}
                    className="xpp-input"
                  />
                </div>
              </div>
            </div>

            {/* Section 8: Interactive Live Storefront Preview */}
            <div className="xpp-card" style={{ background: "#0a0a0c", border: "2px dashed rgba(212, 175, 55, 0.4)" }} dir={isPreviewRtl ? "rtl" : "ltr"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#FFD700", textTransform: "uppercase", letterSpacing: 1 }}>
                  Real-Time Storefront Interactive Preview ({selectedLang.toUpperCase()})
                </span>
                <span style={{ fontSize: 12, color: "#888" }}>
                  Layout: {designPreset} | Effect: {animationStyle}
                </span>
              </div>

              <div style={{ maxWidth: 540, margin: "0 auto", padding: 16 }}>
                {/* Header */}
                <div style={{ marginBottom: 14 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: textColor, margin: "0 0 4px" }}>
                    {currentTranslations.sectionTitle}
                  </h4>
                  {currentTranslations.subtitle && (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                      {currentTranslations.subtitle}
                    </p>
                  )}
                </div>

                {/* Design 1: Modern Stacked Cards */}
                {designPreset === "modern_cards" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {tiers.map((tier, idx) => {
                      const isSelected = selectedPreviewIndex === idx;
                      const unitDiscount = discountType === "PERCENTAGE" ? (samplePrice * tier.discountValue) / 100 : tier.discountValue;
                      const discountedUnit = Math.max(0, samplePrice - unitDiscount);
                      const totalPrice = discountedUnit * tier.quantity;
                      const totalSavings = unitDiscount * tier.quantity;

                      const isShimmer = tier.badge && animationStyle === "shimmer";
                      const isPulse = isSelected && animationStyle === "shine_glow";
                      const isFloat = tier.badge && animationStyle === "floating_badge";

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedPreviewIndex(idx)}
                          className={`${isShimmer ? "xpp-anim-shimmer" : ""} ${isPulse ? "xpp-anim-pulse" : ""}`}
                          style={{
                            background: backgroundColor,
                            border: `2px solid ${isSelected ? accentColor : borderColor}`,
                            borderRadius: 12,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            position: "relative",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {tier.badge && (
                            <div
                              className={isFloat ? "xpp-anim-float" : ""}
                              style={{
                                position: "absolute",
                                top: -10,
                                [isPreviewRtl ? "left" : "right"]: 16,
                                background: badgeBgColor,
                                color: badgeTextColor,
                                fontSize: 10,
                                fontWeight: 900,
                                padding: "2px 8px",
                                borderRadius: 12,
                                letterSpacing: 0.5,
                                textTransform: "uppercase",
                              }}
                            >
                              {tier.badge}
                            </div>
                          )}

                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                border: `2px solid ${isSelected ? accentColor : "#555"}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {isSelected && (
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor }} />
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: textColor }}>{tier.title}</div>
                              {tier.subtitle && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{tier.subtitle}</div>}
                            </div>
                          </div>

                          <div style={{ textAlign: isPreviewRtl ? "left" : "right" }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: accentColor }}>
                              ${totalPrice.toFixed(2)}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                              ${discountedUnit.toFixed(2)} {currentTranslations.eachLabel}
                            </div>
                            {totalSavings > 0 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", marginTop: 2 }}>
                                {currentTranslations.saveLabel} ${totalSavings.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Design 2: Compact Grid Boxes */}
                {designPreset === "grid_boxes" && (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${tiers.length}, 1fr)`, gap: 10 }}>
                    {tiers.map((tier, idx) => {
                      const isSelected = selectedPreviewIndex === idx;
                      const unitDiscount = discountType === "PERCENTAGE" ? (samplePrice * tier.discountValue) / 100 : tier.discountValue;
                      const discountedUnit = Math.max(0, samplePrice - unitDiscount);
                      const totalPrice = discountedUnit * tier.quantity;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedPreviewIndex(idx)}
                          className={tier.badge && animationStyle === "shimmer" ? "xpp-anim-shimmer" : ""}
                          style={{
                            background: backgroundColor,
                            border: `2px solid ${isSelected ? accentColor : borderColor}`,
                            borderRadius: 12,
                            padding: "16px 10px",
                            textAlign: "center",
                            cursor: "pointer",
                            position: "relative",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {tier.badge && (
                            <div
                              style={{
                                position: "absolute",
                                top: -10,
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: badgeBgColor,
                                color: badgeTextColor,
                                fontSize: 9,
                                fontWeight: 900,
                                padding: "2px 6px",
                                borderRadius: 10,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {tier.badge}
                            </div>
                          )}
                          <div style={{ fontSize: 24, fontWeight: 900, color: accentColor, margin: "4px 0" }}>
                            {tier.quantity}x
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: textColor, marginBottom: 4 }}>
                            {tier.title}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#ffffff" }}>
                            ${totalPrice.toFixed(2)}
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                            ${discountedUnit.toFixed(2)}/ea
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Design 3: Minimalist Sleek Rows */}
                {designPreset === "minimal_table" && (
                  <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: 10, overflow: "hidden" }}>
                    {tiers.map((tier, idx) => {
                      const isSelected = selectedPreviewIndex === idx;
                      const unitDiscount = discountType === "PERCENTAGE" ? (samplePrice * tier.discountValue) / 100 : tier.discountValue;
                      const discountedUnit = Math.max(0, samplePrice - unitDiscount);
                      const totalPrice = discountedUnit * tier.quantity;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedPreviewIndex(idx)}
                          style={{
                            background: isSelected ? "rgba(212, 175, 55, 0.08)" : backgroundColor,
                            borderBottom: idx === tiers.length - 1 ? "none" : `1px solid ${borderColor}`,
                            padding: "12px 16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                border: `2px solid ${isSelected ? accentColor : "#555"}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor }} />}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{tier.title}</span>
                            {tier.badge && (
                              <span style={{ background: badgeBgColor, color: badgeTextColor, fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>
                                {tier.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: accentColor }}>
                            ${totalPrice.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Design 4: Luxury Gold Vault */}
                {designPreset === "luxury_gold" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {tiers.map((tier, idx) => {
                      const isSelected = selectedPreviewIndex === idx;
                      const unitDiscount = discountType === "PERCENTAGE" ? (samplePrice * tier.discountValue) / 100 : tier.discountValue;
                      const discountedUnit = Math.max(0, samplePrice - unitDiscount);
                      const totalPrice = discountedUnit * tier.quantity;
                      const totalSavings = unitDiscount * tier.quantity;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedPreviewIndex(idx)}
                          className={tier.badge && animationStyle === "shimmer" ? "xpp-anim-shimmer" : ""}
                          style={{
                            background: backgroundColor,
                            border: `1px solid ${isSelected ? accentColor : borderColor}`,
                            borderLeft: isPreviewRtl ? undefined : `4px solid ${isSelected ? accentColor : borderColor}`,
                            borderRight: isPreviewRtl ? `4px solid ${isSelected ? accentColor : borderColor}` : undefined,
                            borderRadius: 8,
                            padding: "16px 20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            boxShadow: isSelected ? "0 4px 20px rgba(212, 175, 55, 0.2)" : "none",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 15, fontWeight: 900, color: textColor }}>{tier.title}</span>
                              {tier.badge && (
                                <span style={{ background: badgeBgColor, color: badgeTextColor, fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 4 }}>
                                  {tier.badge}
                                </span>
                              )}
                            </div>
                            {tier.subtitle && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{tier.subtitle}</div>}
                          </div>

                          <div style={{ textAlign: isPreviewRtl ? "left" : "right" }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: accentColor }}>
                              ${totalPrice.toFixed(2)}
                            </div>
                            {totalSavings > 0 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>
                                {currentTranslations.saveLabel} ${totalSavings.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Save Button */}
            <div style={{ marginTop: 24, textAlign: "right" }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="xpp-btn xpp-btn--primary"
                style={{ padding: "12px 32px", fontSize: 15 }}
              >
                {isSubmitting ? "Saving..." : "Save Quantity Breaks Offer"}
              </button>
            </div>
          </Form>
        )}
      </div>
    </s-page>
  );
}
