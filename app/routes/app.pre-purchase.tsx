import { useState, useEffect, useMemo, Fragment } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";

type CatalogProduct = {
  id: string;
  title: string;
  handle?: string;
  imageUrl?: string;
  price?: string;
  variantId?: string;
};

let catalogCache: { shop: string; timestamp: number; products: CatalogProduct[] } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  const rules = await prisma.upsellRule.findMany({
    where: { shopId: shop.id, type: "PRE_PURCHASE" },
    orderBy: { createdAt: "desc" },
  });

  // Fast-path: use in-memory catalog cache if fresh (< 2 min)
  let products: CatalogProduct[] = [];
  if (
    catalogCache &&
    catalogCache.shop === session.shop &&
    Date.now() - catalogCache.timestamp < CACHE_TTL_MS &&
    catalogCache.products.length > 0
  ) {
    products = catalogCache.products;
  } else {
    try {
      const response = await admin.graphql(
        `#graphql
        query getProductsForUpsell {
          products(first: 250) {
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
        }`
      );
      const json = await response.json();
      if (json.errors) {
        console.error("[XPoost] GraphQL errors querying products for pre-purchase:", json.errors);
      }
      products = (json.data?.products?.edges || []).map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        handle: e.node.handle,
        imageUrl: e.node.featuredImage?.url,
        price: e.node.variants?.edges[0]?.node?.price || "29.99",
        variantId: e.node.variants?.edges[0]?.node?.id,
      }));
      if (products.length > 0) {
        catalogCache = { shop: session.shop, timestamp: Date.now(), products };
      }
    } catch (err) {
      console.error("[XPoost] Failed to query products:", err);
      if (catalogCache?.shop === session.shop) products = catalogCache.products;
    }
  }

  let styleConfig: any = null;
  try {
    if ((prisma as any).upsellStyleConfig) {
      styleConfig = await (prisma as any).upsellStyleConfig.findUnique({
        where: { shopId: shop.id },
      });
      if (!styleConfig) {
        styleConfig = await (prisma as any).upsellStyleConfig.create({
          data: {
            shopId: shop.id,
            prePurchaseBg: "#0B0B0B",
            prePurchaseAccent: "#D4AF37",
            prePurchaseText: "#FFFFFF",
            inCartBg: "#0B0B0B",
            inCartAccent: "#D4AF37",
            inCartText: "#FFFFFF",
          },
        });
      }
    }
  } catch (styleErr) {
    console.warn("[XPoost] UpsellStyleConfig access warning:", styleErr);
  }

  if (!styleConfig) {
    styleConfig = {
      prePurchaseBg: "#0B0B0B",
      prePurchaseAccent: "#D4AF37",
      prePurchaseText: "#FFFFFF",
      inCartBg: "#0B0B0B",
      inCartAccent: "#D4AF37",
      inCartText: "#FFFFFF",
    };
  }

  return {
    shop,
    enabled: shop.prePurchaseEnabled,
    rules,
    products,
    styleConfig,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save_rule");

  if (intent === "save_styles") {
    const prePurchaseBg = String(formData.get("prePurchaseBg") || "#0B0B0B");
    const prePurchaseAccent = String(formData.get("prePurchaseAccent") || "#D4AF37");
    const prePurchaseText = String(formData.get("prePurchaseText") || "#FFFFFF");

    try {
      if ((prisma as any).upsellStyleConfig) {
        await (prisma as any).upsellStyleConfig.upsert({
          where: { shopId: shop.id },
          update: {
            prePurchaseBg,
            prePurchaseAccent,
            prePurchaseText,
          },
          create: {
            shopId: shop.id,
            prePurchaseBg,
            prePurchaseAccent,
            prePurchaseText,
            inCartBg: "#0B0B0B",
            inCartAccent: "#D4AF37",
            inCartText: "#FFFFFF",
          },
        });
      }
    } catch (e) {
      console.warn("[XPoost] Error saving pre-purchase styles:", e);
    }
    return { ok: true, message: "Modal styling preferences saved successfully." };
  }

  if (intent === "toggle_global") {
    const enabled = formData.get("enabled") === "true";
    await prisma.shop.update({
      where: { id: shop.id },
      data: { prePurchaseEnabled: enabled },
    });
    return { ok: true, message: `Pre-purchase upsells ${enabled ? "enabled" : "disabled"}.` };
  }

  if (intent === "delete_offer" || intent === "delete_rule") {
    const ruleIdsRaw = String(formData.get("ruleIds") || "");
    const singleRuleId = String(formData.get("ruleId") || "");
    const idsToDelete = ruleIdsRaw ? ruleIdsRaw.split(",").filter(Boolean) : (singleRuleId ? [singleRuleId] : []);

    if (idsToDelete.length > 0) {
      await prisma.upsellRule.deleteMany({
        where: { id: { in: idsToDelete }, shopId: shop.id },
      });
    }
    return { ok: true, message: "Upsell offer deleted." };
  }

  if (intent === "toggle_offer" || intent === "toggle_rule") {
    const ruleIdsRaw = String(formData.get("ruleIds") || "");
    const singleRuleId = String(formData.get("ruleId") || "");
    const idsToUpdate = ruleIdsRaw ? ruleIdsRaw.split(",").filter(Boolean) : (singleRuleId ? [singleRuleId] : []);
    const active = formData.get("active") === "true";

    if (idsToUpdate.length > 0) {
      await prisma.upsellRule.updateMany({
        where: { id: { in: idsToUpdate }, shopId: shop.id },
        data: { active },
      });
    }
    return { ok: true, message: `Offer ${active ? "activated" : "paused"}.` };
  }

  if (intent === "create_rule" || intent === "edit_rule") {
    const isEdit = intent === "edit_rule";
    const editRuleIdsRaw = String(formData.get("originalRuleIds") || "");
    const editRuleIds = editRuleIdsRaw ? editRuleIdsRaw.split(",").filter(Boolean) : [];

    const triggerType = String(formData.get("triggerType") || "ALL");
    const triggerProductId = String(formData.get("triggerProductId") || "ALL");
    const triggerProductTitle = String(formData.get("triggerProductTitle") || "All Products");

    if (triggerType === "SPECIFIC" && (!triggerProductId || triggerProductId === "ALL" || triggerProductId.trim() === "")) {
      return { error: "Please select at least one trigger product." };
    }

    const offerHeadline = String(formData.get("offerHeadline") || "Exclusive Add-On Deal").trim();
    const rawDescription = String(formData.get("offerDescription") || "Add these complementary items to your order!").trim();
    const layoutStyle = String(formData.get("layoutStyle") || "spotlight_hero").trim();
    const preselectItems = formData.get("preselectItems") !== "false";
    const feature1 = String(formData.get("feature1") || "").trim();
    const feature2 = String(formData.get("feature2") || "").trim();
    const feature3 = String(formData.get("feature3") || "").trim();

    let offerDescription = rawDescription;
    if (!preselectItems) offerDescription += " <!--xp:preselect:false-->";
    if (layoutStyle) offerDescription += ` <!--xp:layout:${layoutStyle}-->`;
    if (feature1) offerDescription += ` <!--xp:f1:${encodeURIComponent(feature1)}-->`;
    if (feature2) offerDescription += ` <!--xp:f2:${encodeURIComponent(feature2)}-->`;
    if (feature3) offerDescription += ` <!--xp:f3:${encodeURIComponent(feature3)}-->`;

    const hasDiscount = formData.get("hasDiscount") === "true";
    const discountPercent = hasDiscount
      ? (parseFloat(String(formData.get("discountPercent") || "0")) || null)
      : null;
    let discountCode = hasDiscount
      ? String(formData.get("discountCode") || "").trim()
      : "";

    // Parse multi-product bundle
    const selectedProductsRaw = formData.get("selectedProductsJson");
    let selectedProducts: Array<{
      id: string;
      title: string;
      handle?: string;
      variantId?: string;
      price?: string;
      imageUrl?: string;
    }> = [];

    if (selectedProductsRaw) {
      try {
        selectedProducts = JSON.parse(String(selectedProductsRaw));
      } catch (e) {}
    }

    // Fallback to single product fields if submitted legacy style
    if (selectedProducts.length === 0) {
      const targetProductId = String(formData.get("targetProductId") || "");
      if (targetProductId) {
        selectedProducts.push({
          id: targetProductId,
          title: String(formData.get("targetProductTitle") || "Complementary Upgrade"),
          variantId: String(formData.get("targetVariantId") || ""),
          price: String(formData.get("targetProductPrice") || "29.99"),
          imageUrl: String(formData.get("targetProductImage") || ""),
        });
      }
    }

    if (selectedProducts.length === 0) {
      return { error: "Please select at least one product for the upsell offer." };
    }

    // Register Shopify Automatic Discount and Code Discount if discount percentage is configured
    if (hasDiscount && discountPercent && discountPercent > 0) {
      if (!discountCode) {
        discountCode = `XPOOST_${Math.round(discountPercent)}OFF_${Date.now().toString().slice(-4)}`;
      }
      try {
        const targetProductGids = selectedProducts
          .map((p) => p.id)
          .filter((id) => id.startsWith("gid://shopify/Product/"));

        const itemsPayload =
          targetProductGids.length > 0
            ? { products: { productsToAdd: targetProductGids } }
            : { all: true };

        const discountTitle = `${offerHeadline} (${discountPercent}% OFF - ${discountCode})`;

        // 1. Create Automatic Discount
        await admin.graphql(
          `#graphql
          mutation createUpsellAutomaticDiscount($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
            discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
              automaticDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              automaticBasicDiscount: {
                title: discountTitle,
                startsAt: new Date().toISOString(),
                customerGets: {
                  value: {
                    percentage: discountPercent / 100,
                  },
                  items: itemsPayload,
                },
                combinesWith: {
                  orderDiscounts: true,
                  productDiscounts: true,
                  shippingDiscounts: true,
                },
              },
            },
          }
        );

        // 2. Also create Code Discount so /cart/update.js and /discount/ endpoints work reliably
        await admin.graphql(
          `#graphql
          mutation createUpsellCodeDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              basicCodeDiscount: {
                title: discountTitle,
                code: discountCode,
                startsAt: new Date().toISOString(),
                customerGets: {
                  value: {
                    percentage: discountPercent / 100,
                  },
                  items: itemsPayload,
                },
                customerSelection: {
                  all: true,
                },
                combinesWith: {
                  orderDiscounts: true,
                  productDiscounts: true,
                  shippingDiscounts: true,
                },
              },
            },
          }
        );
      } catch (graphErr) {
        console.warn("[XPoost] Discount creation warning:", graphErr);
      }
    }

    // If editing, remove previous rules for this offer bundle before re-inserting
    if (isEdit && editRuleIds.length > 0) {
      await prisma.upsellRule.deleteMany({
        where: { id: { in: editRuleIds }, shopId: shop.id },
      });
    }

    // Create a rule for each product in the bundle
    for (const p of selectedProducts) {
      let prodDesc = offerDescription;
      if (p.handle) prodDesc += ` <!--xp:h:${encodeURIComponent(p.handle)}-->`;

      await prisma.upsellRule.create({
        data: {
          shopId: shop.id,
          type: "PRE_PURCHASE",
          triggerProductId,
          triggerProductTitle,
          targetProductId: p.id,
          targetProductTitle: p.title,
          targetVariantId: p.variantId || "",
          targetProductPrice: p.price || "29.99",
          targetProductImage: p.imageUrl || "",
          offerHeadline,
          offerDescription: prodDesc,
          discountPercent,
          discountCode,
          active: true,
        },
      });
    }

    // Auto-enable feature flag on Shop
    await prisma.shop.update({
      where: { id: shop.id },
      data: { prePurchaseEnabled: true },
    });

    return {
      ok: true,
      message: isEdit
        ? `Offer "${offerHeadline}" updated successfully!`
        : `Offer "${offerHeadline}" with ${selectedProducts.length} product(s) created successfully!`,
    };
  }

  return { error: "Unknown request" };
};

type OfferGroup = {
  id: string;
  ruleIds: string[];
  headline: string;
  description: string;
  layoutStyle: string;
  feature1: string;
  feature2: string;
  feature3: string;
  triggerProductId: string;
  triggerProductTitle: string;
  products: Array<{
    id: string;
    title: string;
    handle?: string;
    variantId?: string;
    price?: string;
    imageUrl?: string;
  }>;
  discountPercent: number | null;
  discountCode: string | null;
  preselectItems: boolean;
  active: boolean;
  createdAt: Date;
};

const PRE_PURCHASE_LAYOUTS = [
  {
    id: "spotlight_hero",
    name: "Spotlight Hero & Value Showcase",
    badge: "Recommended",
    desc: "Highlights the primary offer product with an elevated showcase hero card and stacked complementary secondary add-ons.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    id: "bundle_grid",
    name: "Bundle & Save Grid Deck",
    badge: "High Conversion",
    desc: "Clean side-by-side product cards with instant discount badges, checkmark toggles, and unified bundle add CTA.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="7" x="3" y="3" rx="1"/>
        <rect width="7" height="7" x="14" y="3" rx="1"/>
        <rect width="7" height="7" x="14" y="14" rx="1"/>
        <rect width="7" height="7" x="3" y="14" rx="1"/>
      </svg>
    ),
  },
  {
    id: "bottom_sheet",
    name: "Sleek Slide-Up Bottom Sheet",
    badge: "Mobile Native",
    desc: "Modern drawer bottom sheet with pull-handle indicator, streamlined product chips, and thumb-friendly checkout trigger.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <line x1="9" y1="7" x2="15" y2="7"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
      </svg>
    ),
  },
  {
    id: "flash_urgency",
    name: "Urgent Flash Deal with Live Timer",
    badge: "Scarcity Driver",
    desc: "High-urgency design with an active ticking countdown timer banner, gold highlight glow, and reserving cart prompt.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
];

export default function PrePurchaseSettings() {
  const { enabled, rules, products, styleConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalBg, setModalBg] = useState(styleConfig?.prePurchaseBg || "#0B0B0B");
  const [modalAccent, setModalAccent] = useState(styleConfig?.prePurchaseAccent || "#D4AF37");
  const [modalText, setModalText] = useState(styleConfig?.prePurchaseText || "#FFFFFF");

  // Navigation state: "index" (Offers List) | "create" (New Offer) | "edit" (Edit Offer)
  const [viewMode, setViewMode] = useState<"index" | "create" | "edit">("index");
  const [editingOffer, setEditingOffer] = useState<OfferGroup | null>(null);

  // Group database rules into coherent Offer bundles
  const offerGroups = useMemo<OfferGroup[]>(() => {
    const map = new Map<string, OfferGroup>();
    for (const r of rules) {
      const headline = (r.offerHeadline || "Special Upgrade Offer").trim();
      const triggerKey = r.triggerProductId || "ALL";
      const key = `${triggerKey}:::${headline}`;

      const preselected = !r.offerDescription?.includes("<!--xp:preselect:false-->");
      const layoutMatch = (r.offerDescription || "").match(/<!--xp:layout:([a-z_]+)-->/);
      const layoutStyle = layoutMatch ? layoutMatch[1] : "spotlight_hero";

      const f1Match = (r.offerDescription || "").match(/<!--xp:f1:([^>]+)-->/);
      const f2Match = (r.offerDescription || "").match(/<!--xp:f2:([^>]+)-->/);
      const f3Match = (r.offerDescription || "").match(/<!--xp:f3:([^>]+)-->/);
      const feature1 = f1Match ? decodeURIComponent(f1Match[1].trim()) : "Recommended addition to your selection";
      const feature2 = f2Match ? decodeURIComponent(f2Match[1].trim()) : "Premium dermatologically evaluated formula";
      const feature3 = f3Match ? decodeURIComponent(f3Match[1].trim()) : "Exclusive single-order promotion price";

      const hMatch = (r.offerDescription || "").match(/<!--xp:h:([^>]+)-->/);
      const prodHandle = hMatch ? decodeURIComponent(hMatch[1].trim()) : undefined;

      const cleanDesc = (r.offerDescription || "")
        .replace(/<!--xp:layout:[a-z_]+-->/g, "")
        .replace(/<!--xp:preselect:false-->/g, "")
        .replace(/<!--xp:f1:[^>]+-->/g, "")
        .replace(/<!--xp:f2:[^>]+-->/g, "")
        .replace(/<!--xp:f3:[^>]+-->/g, "")
        .replace(/<!--xp:h:[^>]+-->/g, "")
        .trim();

      if (!map.has(key)) {
        map.set(key, {
          id: r.id,
          ruleIds: [r.id],
          headline,
          description: cleanDesc,
          layoutStyle,
          feature1,
          feature2,
          feature3,
          triggerProductId: r.triggerProductId,
          triggerProductTitle: r.triggerProductTitle || (r.triggerProductId === "ALL" ? "All Products" : "Specific Product"),
          products: [
            {
              id: r.targetProductId,
              title: r.targetProductTitle || "Product",
              handle: prodHandle,
              variantId: r.targetVariantId || "",
              price: r.targetProductPrice || "29.99",
              imageUrl: r.targetProductImage || "",
            },
          ],
          discountPercent: r.discountPercent,
          discountCode: r.discountCode,
          preselectItems: preselected,
          active: r.active,
          createdAt: new Date(r.createdAt),
        });
      } else {
        const group = map.get(key)!;
        group.ruleIds.push(r.id);
        if (r.active) group.active = true;
        if (!group.products.some((p) => p.id === r.targetProductId)) {
          group.products.push({
            id: r.targetProductId,
            title: r.targetProductTitle || "Product",
            handle: prodHandle,
            variantId: r.targetVariantId || "",
            price: r.targetProductPrice || "29.99",
            imageUrl: r.targetProductImage || "",
          });
        }
      }
    }
    return Array.from(map.values());
  }, [rules]);

  // Index Table Filters & Pagination state
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered offers in table
  const filteredOffers = useMemo(() => {
    return offerGroups.filter((offer) => {
      if (statusFilter === "active" && !offer.active) return false;
      if (statusFilter === "paused" && offer.active) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchesHeadline = offer.headline.toLowerCase().includes(q);
        const matchesTrigger = offer.triggerProductTitle.toLowerCase().includes(q);
        const matchesProduct = offer.products.some((p) => p.title.toLowerCase().includes(q));
        if (!matchesHeadline && !matchesTrigger && !matchesProduct) return false;
      }
      return true;
    });
  }, [offerGroups, statusFilter, tableSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredOffers.length / itemsPerPage));
  const paginatedOffers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOffers.slice(start, start + itemsPerPage);
  }, [filteredOffers, currentPage]);

  // Form Editor State
  const [headline, setHeadline] = useState("Exclusive Add-On Deal");
  const [description, setDescription] = useState("Add these complementary items to your order right now!");
  const [triggerType, setTriggerType] = useState<"ALL" | "SPECIFIC">("ALL");
  const [selectedTriggerProductIds, setSelectedTriggerProductIds] = useState<string[]>([]);
  const [triggerSearch, setTriggerSearch] = useState("");

  const [promotedSearch, setPromotedSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [modalLayout, setModalLayout] = useState<string>("spotlight_hero");
  const [feature1, setFeature1] = useState("Recommended addition to your selection");
  const [feature2, setFeature2] = useState("Premium dermatologically evaluated formula");
  const [feature3, setFeature3] = useState("Exclusive single-order promotion price");
  const [hasDiscount, setHasDiscount] = useState(true);
  const [discountPercent, setDiscountPercent] = useState("15");
  const [discountCode, setDiscountCode] = useState("SAVE15");
  const [preselectItems, setPreselectItems] = useState(true);

  // Dynamic catalog state combining initial products and live search results
  const [catalog, setCatalog] = useState<CatalogProduct[]>(products);
  const [isSearchingTrigger, setIsSearchingTrigger] = useState(false);
  const [isSearchingPromoted, setIsSearchingPromoted] = useState(false);

  useEffect(() => {
    setCatalog((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      for (const p of products) {
        if (!map.has(p.id)) map.set(p.id, p);
      }
      return Array.from(map.values());
    });
  }, [products]);

  // Live search for trigger products across entire store catalog
  useEffect(() => {
    const q = triggerSearch.trim();
    if (q.length < 2) return;

    const timer = setTimeout(async () => {
      setIsSearchingTrigger(true);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.products && Array.isArray(data.products)) {
            setCatalog((prev) => {
              const map = new Map(prev.map((p) => [p.id, p]));
              for (const item of data.products) {
                map.set(item.id, item);
              }
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.warn("[PrePurchase] Trigger product search error:", err);
      } finally {
        setIsSearchingTrigger(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [triggerSearch]);

  // Live search for promoted upsell products across entire store catalog
  useEffect(() => {
    const q = promotedSearch.trim();
    if (q.length < 2) return;

    const timer = setTimeout(async () => {
      setIsSearchingPromoted(true);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.products && Array.isArray(data.products)) {
            setCatalog((prev) => {
              const map = new Map(prev.map((p) => [p.id, p]));
              for (const item of data.products) {
                map.set(item.id, item);
              }
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.warn("[PrePurchase] Promoted product search error:", err);
      } finally {
        setIsSearchingPromoted(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [promotedSearch]);

  // Live preview checkbox state
  const [previewCheckedIds, setPreviewCheckedIds] = useState<string[]>([]);

  // Automatically reset to Index view upon successful action
  useEffect(() => {
    if (actionData && "ok" in actionData) {
      setViewMode("index");
      setEditingOffer(null);
    }
  }, [actionData]);

  // Sync preview checkboxes when selected products or preselect toggle changes
  useEffect(() => {
    if (preselectItems) {
      setPreviewCheckedIds(selectedProductIds);
    } else {
      setPreviewCheckedIds([]);
    }
  }, [preselectItems, selectedProductIds]);

  // Open Create Mode
  const openCreateMode = () => {
    setEditingOffer(null);
    setHeadline("Exclusive Add-On Deal");
    setDescription("Add these complementary items to your order right now!");
    setModalLayout("spotlight_hero");
    setFeature1("Recommended addition to your selection");
    setFeature2("Premium dermatologically evaluated formula");
    setFeature3("Exclusive single-order promotion price");
    setTriggerType("ALL");
    setSelectedTriggerProductIds([]);
    setTriggerSearch("");
    const sourceList = catalog.length > 0 ? catalog : products;
    setSelectedProductIds(sourceList.slice(0, 2).map((p) => p.id));
    setHasDiscount(true);
    setDiscountPercent("15");
    setDiscountCode("SAVE15");
    setPreselectItems(true);
    setViewMode("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Open Edit Mode with populated offer data
  const openEditMode = (offer: OfferGroup) => {
    setEditingOffer(offer);
    setHeadline(offer.headline);
    setDescription(offer.description);
    setModalLayout(offer.layoutStyle || "spotlight_hero");
    setFeature1(offer.feature1 || "Recommended addition to your selection");
    setFeature2(offer.feature2 || "Premium dermatologically evaluated formula");
    setFeature3(offer.feature3 || "Exclusive single-order promotion price");
    if (offer.triggerProductId && offer.triggerProductId !== "ALL") {
      setTriggerType("SPECIFIC");
      const ids = offer.triggerProductId.split(",").map((s) => s.trim()).filter(Boolean);
      setSelectedTriggerProductIds(ids);
    } else {
      setTriggerType("ALL");
      setSelectedTriggerProductIds([]);
    }
    if (offer.products && offer.products.length > 0) {
      setCatalog((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const p of offer.products) {
          if (!map.has(p.id)) {
            map.set(p.id, {
              id: p.id,
              title: p.title,
              handle: p.handle,
              imageUrl: p.imageUrl,
              price: p.price,
              variantId: p.variantId,
            });
          }
        }
        return Array.from(map.values());
      });
    }
    setTriggerSearch("");
    setSelectedProductIds(offer.products.map((p) => p.id));
    setHasDiscount(offer.discountPercent !== null && offer.discountPercent > 0);
    setDiscountPercent(offer.discountPercent ? String(offer.discountPercent) : "15");
    setDiscountCode(offer.discountCode || "");
    setPreselectItems(offer.preselectItems);
    setViewMode("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filter products for promoted product picker
  const filteredCatalogProducts = useMemo(() => {
    if (!promotedSearch.trim()) return catalog;
    const terms = promotedSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.filter((p) => {
      const target = `${p.title} ${p.handle || ""}`.toLowerCase();
      return terms.every((term) => target.includes(term));
    });
  }, [catalog, promotedSearch]);

  // Filter products for trigger product picker
  const filteredTriggerProducts = useMemo(() => {
    if (!triggerSearch.trim()) return catalog;
    const terms = triggerSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.filter((p) => {
      const target = `${p.title} ${p.handle || ""}`.toLowerCase();
      return terms.every((term) => target.includes(term));
    });
  }, [catalog, triggerSearch]);

  const selectedTriggerProductsList = useMemo(() => {
    return catalog.filter((p) => selectedTriggerProductIds.includes(p.id));
  }, [catalog, selectedTriggerProductIds]);

  const toggleTriggerProduct = (id: string) => {
    setSelectedTriggerProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllFilteredTriggers = () => {
    const newIds = new Set([...selectedTriggerProductIds, ...filteredTriggerProducts.map((p) => p.id)]);
    setSelectedTriggerProductIds(Array.from(newIds));
  };

  const clearTriggerSelection = () => {
    setSelectedTriggerProductIds([]);
  };

  const computedTriggerProductId =
    triggerType === "ALL"
      ? "ALL"
      : selectedTriggerProductIds.join(",");

  const computedTriggerProductTitle =
    triggerType === "ALL"
      ? "All Products"
      : selectedTriggerProductsList.length === 1
      ? selectedTriggerProductsList[0].title
      : selectedTriggerProductsList.length > 1
      ? `${selectedTriggerProductsList.length} Products (${selectedTriggerProductsList.map((p) => p.title).join(", ")})`
      : "No Products Selected";

  const selectedProductsList = useMemo(() => {
    return catalog.filter((p) => selectedProductIds.includes(p.id));
  }, [catalog, selectedProductIds]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const newIds = new Set([...selectedProductIds, ...filteredCatalogProducts.map((p) => p.id)]);
    setSelectedProductIds(Array.from(newIds));
  };

  const clearSelection = () => {
    setSelectedProductIds([]);
  };

  const togglePreviewCheck = (id: string) => {
    setPreviewCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isDiscounted = hasDiscount && (parseFloat(discountPercent) || 0) > 0;
  const discRate = isDiscounted ? (parseFloat(discountPercent) || 0) / 100 : 0;

  const checkedProductsInPreview = selectedProductsList.filter((p) =>
    previewCheckedIds.includes(p.id)
  );
  const checkedCount = checkedProductsInPreview.length;
  const checkedOrig = checkedProductsInPreview.reduce(
    (acc, p) => acc + parseFloat(p.price || "0"),
    0
  );
  const checkedDisc = isDiscounted ? checkedOrig * (1 - discRate) : checkedOrig;

  const buttonText =
    checkedCount === 0
      ? "Continue to Cart \u2192"
      : checkedCount === 1
      ? `Add 1 Item ($${checkedDisc.toFixed(2)})${isDiscounted ? " & Save" : ""} \u2192`
      : `Add All ${checkedCount} Items ($${checkedDisc.toFixed(2)})${isDiscounted ? " & Save" : ""} \u2192`;

  const toggleSelectAllOffers = () => {
    if (selectedOfferIds.length === paginatedOffers.length) {
      setSelectedOfferIds([]);
    } else {
      setSelectedOfferIds(paginatedOffers.map((o) => o.id));
    }
  };

  const toggleSelectOffer = (id: string) => {
    setSelectedOfferIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <s-page heading="Pre-Purchase Upsell Offers">
      <style>{PRE_PURCHASE_STYLES}</style>

      {actionData && "error" in actionData ? (
        <s-banner tone="critical">{actionData.error}</s-banner>
      ) : null}
      {actionData && "ok" in actionData ? (
        <s-banner tone="success">{actionData.message}</s-banner>
      ) : null}

      {/* Global Status Bar */}
      <div className="xp-global-bar">
        <div className="xp-global-info">
          <div className="xp-status-indicator">
            <span className={`xp-status-dot ${enabled ? "is-active" : "is-disabled"}`} />
            <strong>Pre-Purchase Interceptor: {enabled ? "Active" : "Disabled"}</strong>
          </div>
          <p className="xp-sub">
            Intercepts Add-to-Cart clicks and presents high-converting complementary bundles in a slide-out cart drawer.
          </p>
        </div>
        <div className="xp-global-actions">
          <Form method="post" className="xp-inline">
            <input type="hidden" name="intent" value="toggle_global" />
            <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
            <button
              type="submit"
              className={`xp-btn-status-toggle ${enabled ? "is-enabled" : "is-disabled"}`}
              disabled={isSubmitting}
            >
              {enabled ? "Pause Feature" : "Enable Feature"}
            </button>
          </Form>
          {viewMode === "index" && (
            <button
              type="button"
              className="xp-btn-gold-primary"
              onClick={openCreateMode}
            >
              <span>+</span> Create New Offer
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VIEW 1: OFFERS INDEX LIST (Matches user screenshot)
          ───────────────────────────────────────────────────────────── */}
      {viewMode === "index" ? (
        <>
          <div className="xp-index-card" style={{ marginBottom: "20px", padding: "18px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#FFFFFF", margin: "0 0 4px 0" }}>
                  Popup Appearance & Colors
                </h3>
                <p style={{ fontSize: "12px", color: "#8C9196", margin: 0 }}>
                  Customize the background, accent highlight, and text colors of your pre-purchase upsell modal.
                </p>
              </div>
            </div>
            <Form method="post">
              <input type="hidden" name="intent" value="save_styles" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div className="xp-color-control">
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#bbb", marginBottom: "6px" }}>
                    Background Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="color"
                      name="prePurchaseBg"
                      value={modalBg}
                      onChange={(e) => setModalBg(e.target.value)}
                      style={{ width: "40px", height: "36px", padding: "2px", border: "1px solid #333", borderRadius: "6px", background: "#111", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#fff" }}>{modalBg}</span>
                  </div>
                </div>

                <div className="xp-color-control">
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#bbb", marginBottom: "6px" }}>
                    Accent Highlight Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="color"
                      name="prePurchaseAccent"
                      value={modalAccent}
                      onChange={(e) => setModalAccent(e.target.value)}
                      style={{ width: "40px", height: "36px", padding: "2px", border: "1px solid #333", borderRadius: "6px", background: "#111", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#fff" }}>{modalAccent}</span>
                  </div>
                </div>

                <div className="xp-color-control">
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#bbb", marginBottom: "6px" }}>
                    Text Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="color"
                      name="prePurchaseText"
                      value={modalText}
                      onChange={(e) => setModalText(e.target.value)}
                      style={{ width: "40px", height: "36px", padding: "2px", border: "1px solid #333", borderRadius: "6px", background: "#111", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#fff" }}>{modalText}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="xp-btn-gold-primary"
                  style={{ padding: "8px 18px", fontSize: "13px" }}
                >
                  Save Colors
                </button>
              </div>
            </Form>
          </div>

          <div className="xp-index-card">
          {/* Search & Filter Header */}
          <div className="xp-index-header">
            <div className="xp-search-box">
              <span className="xp-search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
              </span>
              <input
                type="text"
                className="xp-search-input"
                placeholder="Filter offers by title, trigger, or product..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {tableSearch && (
                <button
                  type="button"
                  className="xp-search-clear"
                  onClick={() => setTableSearch("")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            <div className="xp-filter-tabs">
              <button
                type="button"
                className={`xp-filter-tab ${statusFilter === "all" ? "is-selected" : ""}`}
                onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
              >
                All ({offerGroups.length})
              </button>
              <button
                type="button"
                className={`xp-filter-tab ${statusFilter === "active" ? "is-selected" : ""}`}
                onClick={() => {
                  setStatusFilter("active");
                  setCurrentPage(1);
                }}
              >
                Active ({offerGroups.filter((o) => o.active).length})
              </button>
              <button
                type="button"
                className={`xp-filter-tab ${statusFilter === "paused" ? "is-selected" : ""}`}
                onClick={() => {
                  setStatusFilter("paused");
                  setCurrentPage(1);
                }}
              >
                Paused ({offerGroups.filter((o) => !o.active).length})
              </button>
            </div>
          </div>

          {/* Table */}
          {filteredOffers.length === 0 ? (
            <div className="xp-empty-state">
              <div className="xp-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                  <path d="M3 6h18"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <h3>No upsell offers found</h3>
              <p className="xp-sub">
                {tableSearch || statusFilter !== "all"
                  ? "Try clearing your search query or filters."
                  : "Create your first pre-purchase upsell offer to start boosting average order value."}
              </p>
              <button
                type="button"
                className="xp-btn-gold-primary xp-empty-btn"
                onClick={openCreateMode}
              >
                + Create Your First Offer
              </button>
            </div>
          ) : (
            <div className="xp-table-wrapper">
              <table className="xp-table">
                <thead>
                  <tr>
                    <th style={{ width: "36px" }}>
                      <input
                        type="checkbox"
                        className="xp-table-checkbox"
                        checked={
                          paginatedOffers.length > 0 &&
                          selectedOfferIds.length === paginatedOffers.length
                        }
                        onChange={toggleSelectAllOffers}
                      />
                    </th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Trigger</th>
                    <th>Promoted Products</th>
                    <th>Discount</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOffers.map((offer) => {
                    const isSelected = selectedOfferIds.includes(offer.id);
                    const firstImg = offer.products[0]?.imageUrl;
                    return (
                      <tr
                        key={offer.id}
                        className={`xp-table-row ${isSelected ? "is-row-selected" : ""}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="xp-table-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOffer(offer.id)}
                          />
                        </td>
                        <td>
                          <div className="xp-table-title-cell">
                            {firstImg ? (
                              <img src={firstImg} alt="" className="xp-table-thumb" />
                            ) : (
                              <div className="xp-table-thumb-placeholder">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                  <polyline points="3.29 7 12 12 20.71 7"/>
                                  <line x1="12" y1="22" x2="12" y2="12"/>
                                </svg>
                              </div>
                            )}
                            <button
                              type="button"
                              className="xp-table-title-link"
                              onClick={() => openEditMode(offer)}
                            >
                              <strong>{offer.headline}</strong>
                              <span className="xp-table-sub">
                                {offer.products.length} product{offer.products.length > 1 ? "s" : ""}
                              </span>
                            </button>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`xp-badge-status ${
                              offer.active ? "xp-badge-active" : "xp-badge-paused"
                            }`}
                          >
                            {offer.active ? "Active" : "Paused"}
                          </span>
                        </td>
                        <td>
                          <span className="xp-trigger-badge" title={offer.triggerProductTitle}>
                            {offer.triggerProductId === "ALL"
                              ? "All Products"
                              : offer.triggerProductTitle.length > 32
                              ? offer.triggerProductTitle.slice(0, 32) + "..."
                              : offer.triggerProductTitle}
                          </span>
                        </td>
                        <td>
                          <div className="xp-promoted-cell">
                            <span className="xp-promoted-count">
                              {offer.products.length} items
                            </span>
                            <span className="xp-promoted-names">
                              {offer.products.map((p) => p.title).join(", ")}
                            </span>
                          </div>
                        </td>
                        <td>
                          {offer.discountPercent ? (
                            <span className="xp-discount-tag">
                              {offer.discountPercent}% OFF
                            </span>
                          ) : (
                            <span className="xp-text-muted">Regular Price</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="xp-actions-cell">
                            <button
                              type="button"
                              className="xp-action-btn xp-action-edit"
                              onClick={() => openEditMode(offer)}
                            >
                              Edit
                            </button>
                            <Form method="post" className="xp-inline">
                              <input type="hidden" name="intent" value="toggle_offer" />
                              <input
                                type="hidden"
                                name="ruleIds"
                                value={offer.ruleIds.join(",")}
                              />
                              <input
                                type="hidden"
                                name="active"
                                value={offer.active ? "false" : "true"}
                              />
                              <button
                                type="submit"
                                className="xp-action-btn xp-action-toggle"
                                disabled={isSubmitting}
                              >
                                {offer.active ? "Pause" : "Activate"}
                              </button>
                            </Form>
                            <Form method="post" className="xp-inline">
                              <input type="hidden" name="intent" value="delete_offer" />
                              <input
                                type="hidden"
                                name="ruleIds"
                                value={offer.ruleIds.join(",")}
                              />
                              <button
                                type="submit"
                                className="xp-action-btn xp-action-delete"
                                disabled={isSubmitting}
                                onClick={(e) => {
                                  if (
                                    !window.confirm(
                                      `Are you sure you want to delete the offer "${offer.headline}"?`
                                    )
                                  ) {
                                    e.preventDefault();
                                  }
                                }}
                              >
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

              {/* Table Footer & Pagination */}
              <div className="xp-pagination-bar">
                <div className="xp-pagination-info">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, filteredOffers.length)} of{" "}
                  {filteredOffers.length} offers
                </div>
                <div className="xp-pagination-controls">
                  <button
                    type="button"
                    className="xp-page-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <span className="xp-page-indicator">
                    Page {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    className="xp-page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </>
      ) : (
        /* ─────────────────────────────────────────────────────────────
           VIEW 2: OFFER EDITOR (Create or Edit Mode)
           ───────────────────────────────────────────────────────────── */
        <div className="xp-editor-card">
          {/* Breadcrumb Navigation */}
          <div className="xp-editor-breadcrumb">
            <button
              type="button"
              className="xp-btn-back"
              onClick={() => setViewMode("index")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to All Offers
            </button>
            <h2>{viewMode === "edit" ? `Edit Offer: ${headline}` : "Create New Upsell Offer"}</h2>
          </div>

          <div className="xp-pre-layout">
            <div className="xp-pre-config">
              <Form method="post" className="xp-form">
                <input
                  type="hidden"
                  name="intent"
                  value={viewMode === "edit" ? "edit_rule" : "create_rule"}
                />
                {viewMode === "edit" && editingOffer && (
                  <input
                    type="hidden"
                    name="originalRuleIds"
                    value={editingOffer.ruleIds.join(",")}
                  />
                )}

                {/* Offer Details */}
                <div className="xp-editor-section">
                  <h3>1. Offer Information</h3>
                  <div className="xp-field">
                    <label>Offer Name / Headline</label>
                    <input
                      type="text"
                      name="offerHeadline"
                      className="xp-input"
                      value={headline}
                      placeholder="e.g. Exclusive Add-On Deal or MEDICUBE Glow Bundle"
                      onChange={(e) => setHeadline(e.target.value)}
                      required
                    />
                    <small>Displayed prominently in the header of the pre-purchase modal.</small>
                  </div>

                  <div className="xp-field" style={{ marginTop: "12px" }}>
                    <label>Offer Subtitle / Description</label>
                    <textarea
                      name="offerDescription"
                      className="xp-input"
                      rows={2}
                      value={description}
                      placeholder="Add these complementary items to your order!"
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* Trigger Product Selection */}
                <div className="xp-editor-section">
                  <h3>2. Trigger Condition</h3>
                  <p className="xp-sub" style={{ marginBottom: "12px" }}>
                    Choose which product triggers this upsell when a customer clicks "Add to Cart".
                  </p>

                  <div className="xp-radio-card-group">
                    <label
                      className={`xp-radio-card ${triggerType === "ALL" ? "is-selected" : ""}`}
                      onClick={() => setTriggerType("ALL")}
                    >
                      <input
                        type="radio"
                        checked={triggerType === "ALL"}
                        onChange={() => {}}
                      />
                      <div className="xp-radio-card-content">
                        <strong>Storewide (All Products)</strong>
                        <p className="xp-sub">Triggers when a customer adds any product from your store.</p>
                      </div>
                    </label>

                    <label
                      className={`xp-radio-card ${triggerType === "SPECIFIC" ? "is-selected" : ""}`}
                      onClick={() => setTriggerType("SPECIFIC")}
                    >
                      <input
                        type="radio"
                        checked={triggerType === "SPECIFIC"}
                        onChange={() => {}}
                      />
                      <div className="xp-radio-card-content">
                        <strong>Specific Trigger Products (Multi-select)</strong>
                        <p className="xp-sub">Triggers only when any of the chosen products are added to the cart.</p>
                      </div>
                    </label>
                  </div>

                  {triggerType === "SPECIFIC" && (
                    <div className="xp-trigger-picker-wrap">
                      <div className="xp-trigger-toolbar">
                        <div style={{ position: "relative", flex: 1 }}>
                          <input
                            type="text"
                            className="xp-input xp-picker-search"
                            style={{ width: "100%" }}
                            placeholder="Search all 900+ products by title (e.g. Anua)..."
                            value={triggerSearch}
                            onChange={(e) => setTriggerSearch(e.target.value)}
                          />
                          {isSearchingTrigger && (
                            <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#8c9196" }}>
                              Searching store...
                            </span>
                          )}
                        </div>
                        <div className="xp-trigger-actions">
                          <button
                            type="button"
                            className="xp-btn-secondary"
                            style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "4px" }}
                            onClick={selectAllFilteredTriggers}
                          >
                            Select All Filtered
                          </button>
                          <button
                            type="button"
                            className="xp-btn-text"
                            style={{ fontSize: "11px", color: "#6d7175" }}
                            onClick={clearTriggerSelection}
                          >
                            Clear Selection
                          </button>
                        </div>
                      </div>

                      {/* Selected Products Chips Area */}
                      {selectedTriggerProductsList.length === 0 ? (
                        <div className="xp-trigger-empty-notice">
                          <strong>No trigger products selected.</strong> Please check one or more products below to trigger this upsell.
                        </div>
                      ) : (
                        <div className="xp-trigger-selected-wrap">
                          <div className="xp-trigger-count-bar">
                            <span>{selectedTriggerProductsList.length} Trigger Product{selectedTriggerProductsList.length > 1 ? "s" : ""} Selected:</span>
                            <span style={{ fontSize: "11px", color: "#6d7175" }}>Triggers when customer adds ANY of these</span>
                          </div>
                          <div className="xp-trigger-chips-list">
                            {selectedTriggerProductsList.map((p) => (
                              <div key={p.id} className="xp-trigger-chip">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt="" className="xp-trigger-chip-thumb" />
                                ) : (
                                  <span style={{ width: "20px", height: "20px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#e1e3e5", borderRadius: "50%", fontSize: "10px" }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
                                  </span>
                                )}
                                <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {p.title}
                                </span>
                                <button
                                  type="button"
                                  className="xp-trigger-chip-remove"
                                  onClick={() => toggleTriggerProduct(p.id)}
                                  title="Remove trigger"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Catalog Checklist */}
                      <div className="xp-picker-list" style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid #e1e3e5", borderRadius: "6px" }}>
                        {filteredTriggerProducts.length === 0 ? (
                          <div style={{ padding: "20px", textAlign: "center", color: "#8c9196", fontSize: "12px" }}>
                            {isSearchingTrigger ? "Searching store catalog..." : `No products found matching "${triggerSearch}"`}
                          </div>
                        ) : (
                          filteredTriggerProducts.map((p) => {
                          const isSelected = selectedTriggerProductIds.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              className={`xp-picker-item ${isSelected ? "is-selected" : ""}`}
                              onClick={() => toggleTriggerProduct(p.id)}
                              style={{ cursor: "pointer" }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ width: "16px", height: "16px", accentColor: "#0B0B0B", marginRight: "8px", pointerEvents: "none" }}
                              />
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt="" className="xp-picker-thumb" />
                              ) : (
                                <div className="xp-picker-thumb-placeholder">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                    <polyline points="3.29 7 12 12 20.71 7"/>
                                    <line x1="12" y1="22" x2="12" y2="12"/>
                                  </svg>
                                </div>
                              )}
                              <div className="xp-picker-item-info">
                                <div className="xp-picker-item-title">{p.title}</div>
                                <div className="xp-picker-item-price">${p.price}</div>
                              </div>
                              {isSelected && (
                                <span className="xp-check-mark">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                </span>
                              )}
                            </div>
                          );
                        }))}
                      </div>
                    </div>
                  )}

                  <input type="hidden" name="triggerType" value={triggerType} />
                  <input type="hidden" name="triggerProductId" value={computedTriggerProductId} />
                  <input type="hidden" name="triggerProductTitle" value={computedTriggerProductTitle} />
                </div>

                {/* 3. Modal Presentation Layout */}
                <div className="xp-editor-section">
                  <h3>3. Modal Presentation Layout</h3>
                  <p className="xp-sub" style={{ marginBottom: "14px" }}>
                    Select the visual architecture and style of the pre-purchase modal displayed to shoppers.
                  </p>
                  <div className="xp-layout-cards-grid">
                    {PRE_PURCHASE_LAYOUTS.map((layout) => {
                      const isSelected = modalLayout === layout.id;
                      return (
                        <div
                          key={layout.id}
                          className={`xp-layout-card ${isSelected ? "is-selected" : ""}`}
                          onClick={() => setModalLayout(layout.id)}
                        >
                          <div className="xp-layout-card-top">
                            <div className="xp-layout-card-icon">{layout.icon}</div>
                            <span className="xp-layout-card-badge">{layout.badge}</span>
                          </div>
                          <strong className="xp-layout-card-title">{layout.name}</strong>
                          <p className="xp-sub xp-layout-card-desc">{layout.desc}</p>
                          <div className="xp-layout-card-footer">
                            <span className={`xp-layout-radio ${isSelected ? "is-checked" : ""}`}>
                              {isSelected ? "Selected" : "Select"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <input type="hidden" name="layoutStyle" value={modalLayout} />

                  {modalLayout === "spotlight_hero" ? (
                    <div style={{ marginTop: "16px", padding: "16px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <strong style={{ fontSize: "13px", color: "#111827" }}>Spotlight Hero Value Highlights (3 Bullets)</strong>
                      </div>
                      <p className="xp-sub" style={{ marginBottom: "12px", fontSize: "12px" }}>
                        Customize the 3 feature highlight bullet points shown inside the primary spotlight hero card.
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div>
                          <label className="xp-label" style={{ fontSize: "12px", marginBottom: "4px" }}>Highlight 1</label>
                          <input
                            type="text"
                            name="feature1"
                            className="xp-input"
                            value={feature1}
                            onChange={(e) => setFeature1(e.target.value)}
                            placeholder="Recommended addition to your selection"
                          />
                        </div>
                        <div>
                          <label className="xp-label" style={{ fontSize: "12px", marginBottom: "4px" }}>Highlight 2</label>
                          <input
                            type="text"
                            name="feature2"
                            className="xp-input"
                            value={feature2}
                            onChange={(e) => setFeature2(e.target.value)}
                            placeholder="Premium dermatologically evaluated formula"
                          />
                        </div>
                        <div>
                          <label className="xp-label" style={{ fontSize: "12px", marginBottom: "4px" }}>Highlight 3</label>
                          <input
                            type="text"
                            name="feature3"
                            className="xp-input"
                            value={feature3}
                            onChange={(e) => setFeature3(e.target.value)}
                            placeholder="Exclusive single-order promotion price"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input type="hidden" name="feature1" value={feature1} />
                      <input type="hidden" name="feature2" value={feature2} />
                      <input type="hidden" name="feature3" value={feature3} />
                    </>
                  )}
                </div>

                {/* Promoted Products Multi-Picker */}
                <div className="xp-editor-section">
                  <div className="xp-picker-header">
                    <h3>4. Promoted Upsell Products ({selectedProductIds.length} Selected)</h3>
                    <div className="xp-picker-quickactions">
                      <button
                        type="button"
                        onClick={selectAllFiltered}
                        className="xp-btn-text"
                      >
                        Select All Filtered
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="xp-btn-text"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <p className="xp-sub" style={{ marginBottom: "10px" }}>
                    Select the products you want to offer in this bundle. Customers can check or uncheck individual items.
                  </p>

                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      className="xp-input xp-picker-search"
                      placeholder="Search all 900+ products to promote (e.g. Anua)..."
                      value={promotedSearch}
                      onChange={(e) => setPromotedSearch(e.target.value)}
                    />
                    {isSearchingPromoted && (
                      <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#8c9196" }}>
                        Searching store...
                      </span>
                    )}
                  </div>

                  <div className="xp-picker-list">
                    {filteredCatalogProducts.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "#8c9196", fontSize: "12px" }}>
                        {isSearchingPromoted ? "Searching store catalog..." : `No products found matching "${promotedSearch}"`}
                      </div>
                    ) : (
                      filteredCatalogProducts.map((p) => {
                        const isSelected = selectedProductIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            className={`xp-picker-item ${isSelected ? "is-selected" : ""}`}
                            onClick={() => toggleProduct(p.id)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="xp-picker-checkbox"
                            />
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="xp-picker-thumb" />
                            ) : (
                              <div className="xp-picker-thumb-placeholder">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                  <polyline points="3.29 7 12 12 20.71 7"/>
                                  <line x1="12" y1="22" x2="12" y2="12"/>
                                </svg>
                              </div>
                            )}
                            <div className="xp-picker-item-info">
                              <div className="xp-picker-item-title">{p.title}</div>
                              <div className="xp-picker-item-price">${p.price}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <input
                    type="hidden"
                    name="selectedProductsJson"
                    value={JSON.stringify(selectedProductsList)}
                  />
                </div>

                {/* Item Selection Option */}
                <div className="xp-editor-section">
                  <h3>5. Modal Selection Behavior</h3>
                  <div className="xp-radio-card-group">
                    <label className={`xp-radio-card ${preselectItems ? "is-selected" : ""}`}>
                      <input
                        type="radio"
                        name="preselectItems"
                        value="true"
                        checked={preselectItems}
                        onChange={() => setPreselectItems(true)}
                      />
                      <div className="xp-radio-card-content">
                        <strong>Pre-select all items (Recommended)</strong>
                        <p className="xp-sub">
                          Items start checked when the modal opens. Maximizes bundle conversion.
                        </p>
                      </div>
                    </label>
                    <label className={`xp-radio-card ${!preselectItems ? "is-selected" : ""}`}>
                      <input
                        type="radio"
                        name="preselectItems"
                        value="false"
                        checked={!preselectItems}
                        onChange={() => setPreselectItems(false)}
                      />
                      <div className="xp-radio-card-content">
                        <strong>Let customer select items manually</strong>
                        <p className="xp-sub">
                          Items start unchecked. Customer taps checkboxes to choose items.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Promotional Discount */}
                <div className="xp-editor-section">
                  <h3>6. Promotional Discount</h3>
                  <label className="xp-check-label" style={{ marginBottom: "12px" }}>
                    <input
                      type="checkbox"
                      name="hasDiscount"
                      value="true"
                      checked={hasDiscount}
                      onChange={(e) => setHasDiscount(e.target.checked)}
                    />
                    <span>Apply promotional discount to this offer</span>
                  </label>

                  {hasDiscount && (
                    <div className="xp-discount-box">
                      <div className="xp-grid-2">
                        <div className="xp-field">
                          <label>Discount Percentage (%)</label>
                          <input
                            type="number"
                            name="discountPercent"
                            className="xp-input"
                            value={discountPercent}
                            onChange={(e) => setDiscountPercent(e.target.value)}
                            min="1"
                            max="90"
                            required
                          />
                        </div>
                        <div className="xp-field">
                          <label>Discount Title / Coupon Code</label>
                          <input
                            type="text"
                            name="discountCode"
                            className="xp-input"
                            value={discountCode}
                            placeholder="e.g. SAVE15"
                            onChange={(e) => setDiscountCode(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="xp-discount-hint">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#108043" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", marginRight: 5 }}>
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        A Shopify Automatic Discount will be generated and applied directly to customer cart drawer and checkout.
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="xp-form-actions">
                  <button
                    type="submit"
                    className="xp-btn-gold"
                    disabled={isSubmitting || selectedProductIds.length === 0}
                  >
                    {isSubmitting
                      ? "Saving Offer..."
                      : viewMode === "edit"
                      ? "Save Changes"
                      : `Create Offer (${selectedProductIds.length} Items)`}
                  </button>
                  <button
                    type="button"
                    className="xp-btn-cancel"
                    onClick={() => setViewMode("index")}
                  >
                    Cancel
                  </button>
                </div>
              </Form>
            </div>

            {/* Live Storefront Preview */}
            <div className="xp-pre-preview-wrap">
              <div className="xp-preview-sticky">
                <div className="xp-preview-meta-bar">
                  <div>
                    <h3>Storefront Live Preview</h3>
                    <p className="xp-sub">Interactive preview of the selected pre-purchase modal architecture.</p>
                  </div>
                  <span className="xp-preview-layout-badge">
                    {PRE_PURCHASE_LAYOUTS.find((l) => l.id === modalLayout)?.name || "Spotlight Hero"}
                  </span>
                </div>

                <div className={`xp-modal-mock xp-modal-mock--${modalLayout}`}>
                  {/* Layout 3: Bottom Sheet handle bar */}
                  {modalLayout === "bottom_sheet" && <div className="xp-sheet-handle-bar" />}

                  {/* Layout 4: Urgent live countdown timer banner */}
                  {modalLayout === "flash_urgency" && (
                    <div className="xp-flash-urgency-banner">
                      <div className="xp-flash-urgency-left">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>LIMITED TIME ADD-ON DEAL</span>
                      </div>
                      <span className="xp-urgency-timer-text">04:59</span>
                    </div>
                  )}

                  <div className="xp-modal-header">
                    <span className="xp-gold-badge">
                      {modalLayout === "spotlight_hero" && "SPOTLIGHT SHOWCASE"}
                      {modalLayout === "bundle_grid" && "BUNDLE & SAVE DECK"}
                      {modalLayout === "bottom_sheet" && "ADD-ON DRAWER"}
                      {modalLayout === "flash_urgency" && "FLASH UPSELL DEAL"}
                    </span>
                    <span className="xp-modal-close">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </span>
                  </div>
                  <h4 className="xp-modal-headline">{headline}</h4>
                  <p className="xp-modal-desc">{description}</p>

                  {/* Empty state */}
                  {selectedProductsList.length === 0 ? (
                    <div className="xp-preview-none">Select promoted products in step 4 to preview the modal.</div>
                  ) : (
                    <>
                      {/* LAYOUT 1: Spotlight Hero */}
                      {modalLayout === "spotlight_hero" && (
                        <div className="xp-spotlight-flow">
                          {selectedProductsList[0] && (
                            <div
                              className={`xp-spotlight-hero-card ${previewCheckedIds.includes(selectedProductsList[0].id) ? "is-selected" : ""}`}
                              onClick={() => togglePreviewCheck(selectedProductsList[0].id)}
                            >
                              <div className={`xp-spotlight-check-pill ${previewCheckedIds.includes(selectedProductsList[0].id) ? "is-checked" : ""}`}>
                                {previewCheckedIds.includes(selectedProductsList[0].id) ? (
                                  <>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                    <span>Selected</span>
                                  </>
                                ) : (
                                  <span>+ Add</span>
                                )}
                              </div>

                              <div className="xp-spotlight-img-wrap">
                                {selectedProductsList[0].imageUrl ? (
                                  <img src={selectedProductsList[0].imageUrl} alt="" className="xp-spotlight-hero-img" />
                                ) : (
                                  <div className="xp-spotlight-img-placeholder">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                      <polyline points="3.29 7 12 12 20.71 7"/>
                                      <line x1="12" y1="22" x2="12" y2="12"/>
                                    </svg>
                                  </div>
                                )}
                                {isDiscounted && (
                                  <span className="xp-spotlight-save-badge">SAVE {discountPercent}%</span>
                                )}
                              </div>

                              <div className="xp-spotlight-content">
                                <div className="xp-spotlight-stars">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <svg key={s} width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                    </svg>
                                  ))}
                                  <span className="xp-spotlight-rating-text">4.9 / 5.0 Rating</span>
                                </div>
                                <h4 className="xp-spotlight-title">
                                  <a
                                    href={selectedProductsList[0].handle ? `/products/${selectedProductsList[0].handle}` : "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="xp-product-link"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {selectedProductsList[0].title}
                                  </a>
                                </h4>
                                <div className="xp-spotlight-pricing">
                                  <span className="xp-price-sale">
                                    ${isDiscounted ? (parseFloat(selectedProductsList[0].price || "30") * (1 - discRate)).toFixed(2) : parseFloat(selectedProductsList[0].price || "30").toFixed(2)}
                                  </span>
                                  {isDiscounted && (
                                    <span className="xp-price-orig">${parseFloat(selectedProductsList[0].price || "30").toFixed(2)}</span>
                                  )}
                                </div>

                                <ul className="xp-spotlight-checklist">
                                  <li>
                                    <span className="xp-check-bullet">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    </span>
                                    {feature1 || "Recommended addition to your selection"}
                                  </li>
                                  <li>
                                    <span className="xp-check-bullet">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    </span>
                                    {feature2 || "Premium dermatologically evaluated formula"}
                                  </li>
                                  <li>
                                    <span className="xp-check-bullet">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    </span>
                                    {feature3 || "Exclusive single-order promotion price"}
                                  </li>
                                </ul>
                              </div>
                            </div>
                          )}

                          {selectedProductsList.length > 1 && (
                            <div className="xp-spotlight-secondary-wrap">
                              <div className="xp-spotlight-secondary-title">Complementary Upgrades:</div>
                              <div className="xp-modal-scroll-list" style={{ maxHeight: "150px" }}>
                                {selectedProductsList.slice(1).map((p) => {
                                  const isChecked = previewCheckedIds.includes(p.id);
                                  const orig = parseFloat(p.price || "30.00");
                                  const sale = (orig * (1 - discRate)).toFixed(2);
                                  return (
                                    <div
                                      key={p.id}
                                      className={`xp-modal-product ${isChecked ? "is-selected" : ""}`}
                                      onClick={() => togglePreviewCheck(p.id)}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="xp-modal-check"
                                      />
                                      {p.imageUrl ? (
                                        <img src={p.imageUrl} alt="" className="xp-modal-img" />
                                      ) : (
                                        <div className="xp-modal-img-placeholder">
                                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                            <polyline points="3.29 7 12 12 20.71 7"/>
                                            <line x1="12" y1="22" x2="12" y2="12"/>
                                          </svg>
                                        </div>
                                      )}
                                      <div className="xp-modal-details">
                                        <strong>
                                          <a
                                            href={p.handle ? `/products/${p.handle}` : "#"}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="xp-product-link"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {p.title}
                                          </a>
                                        </strong>
                                        <div className="xp-modal-pricing">
                                          <span className="xp-price-sale">${isDiscounted ? sale : orig.toFixed(2)}</span>
                                          {isDiscounted && <span className="xp-price-orig">${orig.toFixed(2)}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* LAYOUT 2: Bundle & Save Routine Set */}
                      {modalLayout === "bundle_grid" && (
                        <div className="xp-bundle-deck-wrap">
                          <div className="xp-bundle-routine-deck">
                            {selectedProductsList.map((p, idx) => {
                              const isChecked = previewCheckedIds.includes(p.id);
                              const orig = parseFloat(p.price || "30.00");
                              const sale = (orig * (1 - discRate)).toFixed(2);
                              const stepLabel = idx === 0 ? "PRIMARY ESSENTIAL" : `COMPLEMENTARY STEP ${idx + 1}`;
                              return (
                                <Fragment key={p.id}>
                                  {idx > 0 && (
                                    <div className="xp-bundle-connector-row">
                                      <div className="xp-bundle-line" />
                                      <div className="xp-bundle-plus-badge">+</div>
                                      <div className="xp-bundle-line" />
                                    </div>
                                  )}
                                  <div
                                    className={`xp-bundle-item-card ${isChecked ? "is-selected" : ""}`}
                                    onClick={() => togglePreviewCheck(p.id)}
                                  >
                                    <div className="xp-bundle-card-thumb-wrap">
                                      {p.imageUrl ? (
                                        <img src={p.imageUrl} alt="" className="xp-bundle-card-img" />
                                      ) : (
                                        <div className="xp-bundle-img-placeholder">
                                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                            <polyline points="3.29 7 12 12 20.71 7"/>
                                            <line x1="12" y1="22" x2="12" y2="12"/>
                                          </svg>
                                        </div>
                                      )}
                                      {isDiscounted && (
                                        <span className="xp-bundle-thumb-save">-{discountPercent}%</span>
                                      )}
                                    </div>
                                    <div className="xp-bundle-card-info">
                                      <span className="xp-bundle-step-tag">{stepLabel}</span>
                                      <div className="xp-bundle-card-title">
                                        <a
                                          href={p.handle ? `/products/${p.handle}` : "#"}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="xp-product-link"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {p.title}
                                        </a>
                                      </div>
                                      <div className="xp-modal-pricing">
                                        <span className="xp-price-sale">${isDiscounted ? sale : orig.toFixed(2)}</span>
                                        {isDiscounted && <span className="xp-price-orig">${orig.toFixed(2)}</span>}
                                        {isDiscounted && <span className="xp-discount-pill">SAVE {discountPercent}%</span>}
                                      </div>
                                    </div>
                                    <div className="xp-bundle-action-cell">
                                      <button
                                        type="button"
                                        className={`xp-bundle-toggle-pill ${isChecked ? "is-checked" : ""}`}
                                      >
                                        {isChecked ? (
                                          <>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                              <polyline points="20 6 9 17 4 12"/>
                                            </svg>
                                            <span>Added</span>
                                          </>
                                        ) : (
                                          <span>+ Add</span>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </Fragment>
                              );
                            })}
                          </div>

                          {/* Bundle Value & Savings Summary Box */}
                          <div className="xp-bundle-summary-card">
                            <div className="xp-bundle-summary-row">
                              <span className="xp-bundle-summary-label">
                                Bundle Routine Total ({checkedCount} {checkedCount === 1 ? "item" : "items"}):
                              </span>
                              <div className="xp-bundle-summary-prices">
                                {isDiscounted && checkedOrig > 0 && (
                                  <span className="xp-bundle-sum-orig">${checkedOrig.toFixed(2)}</span>
                                )}
                                <span className="xp-bundle-sum-sale">${checkedDisc.toFixed(2)}</span>
                              </div>
                            </div>
                            {isDiscounted && checkedCount > 0 && (
                              <div className="xp-bundle-savings-highlight">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>You save ${(checkedOrig - checkedDisc).toFixed(2)} ({discountPercent}% Bundle Discount Applied)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* LAYOUT 3: Sleek Slide-Up Bottom Sheet */}
                      {modalLayout === "bottom_sheet" && (
                        <div className="xp-preview-sheet-wrap">
                          <div className="xp-modal-scroll-list">
                            {selectedProductsList.map((p) => {
                              const isChecked = previewCheckedIds.includes(p.id);
                              const orig = parseFloat(p.price || "30.00");
                              const sale = (orig * (1 - discRate)).toFixed(2);
                              return (
                                <div
                                  key={p.id}
                                  className={`xp-modal-product xp-sheet-row ${isChecked ? "is-selected" : ""}`}
                                  onClick={() => togglePreviewCheck(p.id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="xp-modal-check"
                                  />
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt="" className="xp-modal-img" />
                                  ) : (
                                    <div className="xp-modal-img-placeholder">
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                        <polyline points="3.29 7 12 12 20.71 7"/>
                                        <line x1="12" y1="22" x2="12" y2="12"/>
                                      </svg>
                                    </div>
                                  )}
                                  <div className="xp-modal-details">
                                    <strong>
                                      <a
                                        href={p.handle ? `/products/${p.handle}` : "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="xp-product-link"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {p.title}
                                      </a>
                                    </strong>
                                    <div className="xp-modal-pricing">
                                      <span className="xp-price-sale">${isDiscounted ? sale : orig.toFixed(2)}</span>
                                      {isDiscounted && <span className="xp-price-orig">${orig.toFixed(2)}</span>}
                                      {isDiscounted && <span className="xp-discount-pill">SAVE {discountPercent}%</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* LAYOUT 4: Urgent Flash Deal */}
                      {modalLayout === "flash_urgency" && (
                        <div className="xp-preview-flash-wrap">
                          <div className="xp-modal-scroll-list">
                            {selectedProductsList.map((p) => {
                              const isChecked = previewCheckedIds.includes(p.id);
                              const orig = parseFloat(p.price || "30.00");
                              const sale = (orig * (1 - discRate)).toFixed(2);
                              return (
                                <div
                                  key={p.id}
                                  className={`xp-modal-product xp-flash-product-row ${isChecked ? "is-selected" : ""}`}
                                  onClick={() => togglePreviewCheck(p.id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="xp-modal-check"
                                  />
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt="" className="xp-modal-img" />
                                  ) : (
                                    <div className="xp-modal-img-placeholder">
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                        <polyline points="3.29 7 12 12 20.71 7"/>
                                        <line x1="12" y1="22" x2="12" y2="12"/>
                                      </svg>
                                    </div>
                                  )}
                                  <div className="xp-modal-details">
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                                      <strong>
                                        <a
                                          href={p.handle ? `/products/${p.handle}` : "#"}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="xp-product-link"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {p.title}
                                        </a>
                                      </strong>
                                      <span className="xp-flash-item-badge">LIMITED</span>
                                    </div>
                                    <div className="xp-modal-pricing">
                                      <span className="xp-price-sale">${isDiscounted ? sale : orig.toFixed(2)}</span>
                                      {isDiscounted && <span className="xp-price-orig">${orig.toFixed(2)}</span>}
                                      {isDiscounted && <span className="xp-discount-pill">SAVE {discountPercent}%</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="xp-modal-actions">
                    <button type="button" className={`xp-btn-add-both ${modalLayout === "flash_urgency" ? "xp-btn-urgency-glow" : ""}`}>
                      {buttonText}
                    </button>
                    <button type="button" className="xp-btn-skip">
                      No thanks, continue to cart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </s-page>
  );
}

const PRE_PURCHASE_STYLES = `
  /* Global Bar */
  .xp-global-bar {
    background: #ffffff;
    border: 1px solid #e1e3e5;
    border-radius: 10px;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  @media (max-width: 768px) {
    .xp-global-bar {
      flex-direction: column;
      align-items: flex-start;
    }
  }
  .xp-global-info {
    flex: 1;
  }
  .xp-status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #202223;
  }
  .xp-status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
  .xp-status-dot.is-active {
    background: #108043;
    box-shadow: 0 0 0 3px #cbf4c9;
  }
  .xp-status-dot.is-disabled {
    background: #8c9196;
    box-shadow: 0 0 0 3px #e4e5e7;
  }
  .xp-global-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .xp-btn-status-toggle {
    font-size: 12px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid #c9cccf;
    background: #fff;
    color: #202223;
    transition: all 0.15s ease;
  }
  .xp-btn-status-toggle.is-disabled {
    background: #0B0B0B;
    color: #D4AF37;
    border-color: #D4AF37;
  }
  .xp-btn-gold-primary {
    background: #0B0B0B;
    color: #D4AF37;
    border: 1px solid #D4AF37;
    padding: 8px 18px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    transition: all 0.15s ease;
  }
  .xp-btn-gold-primary:hover {
    background: #1c1c1c;
    transform: translateY(-1px);
  }

  /* Index Table View */
  .xp-index-card {
    background: #ffffff;
    border: 1px solid #e1e3e5;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  .xp-index-header {
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    border-bottom: 1px solid #f1f2f3;
    flex-wrap: wrap;
  }
  .xp-search-box {
    display: flex;
    align-items: center;
    position: relative;
    flex: 1;
    min-width: 260px;
    max-width: 480px;
  }
  .xp-search-icon {
    position: absolute;
    left: 10px;
    font-size: 13px;
    color: #8c9196;
  }
  .xp-search-input {
    width: 100%;
    padding: 8px 30px 8px 32px;
    border: 1px solid #c9cccf;
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
    outline: none;
  }
  .xp-search-input:focus {
    border-color: #0B0B0B;
    box-shadow: 0 0 0 1px #0B0B0B;
  }
  .xp-search-clear {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    font-size: 16px;
    color: #8c9196;
    cursor: pointer;
  }
  .xp-filter-tabs {
    display: flex;
    gap: 6px;
  }
  .xp-filter-tab {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 20px;
    border: 1px solid transparent;
    background: #f1f2f3;
    color: #6d7175;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .xp-filter-tab.is-selected {
    background: #0B0B0B;
    color: #D4AF37;
    border-color: #D4AF37;
  }
  .xp-table-wrapper {
    overflow-x: auto;
  }
  .xp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
  }
  .xp-table th {
    background: #fafbfb;
    padding: 12px 16px;
    color: #5c5f62;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid #e1e3e5;
  }
  .xp-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f2f3;
    color: #202223;
    vertical-align: middle;
  }
  .xp-table-row:hover {
    background: #fafbfb;
  }
  .xp-table-row.is-row-selected {
    background: #fefaf0;
  }
  .xp-table-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #0B0B0B;
  }
  .xp-table-title-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .xp-table-thumb {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    object-fit: cover;
    border: 1px solid #e1e3e5;
    flex-shrink: 0;
  }
  .xp-table-thumb-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: #f1f2f3;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .xp-table-title-link {
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    color: #202223;
  }
  .xp-table-title-link strong {
    font-size: 13px;
    color: #008060;
  }
  .xp-table-title-link:hover strong {
    text-decoration: underline;
  }
  .xp-table-sub {
    font-size: 11px;
    color: #6d7175;
  }
  .xp-badge-status {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
  }
  .xp-badge-active {
    background: #e3f1df;
    color: #108043;
  }
  .xp-badge-paused {
    background: #f6f6f7;
    color: #6d7175;
  }
  .xp-trigger-badge {
    background: #f1f2f3;
    color: #202223;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    max-width: 160px;
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .xp-promoted-cell {
    display: flex;
    flex-direction: column;
    max-width: 220px;
  }
  .xp-promoted-count {
    font-size: 12px;
    font-weight: 600;
    color: #202223;
  }
  .xp-promoted-names {
    font-size: 11px;
    color: #6d7175;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .xp-discount-tag {
    background: #0B0B0B;
    color: #D4AF37;
    font-size: 11px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 10px;
    display: inline-block;
  }
  .xp-text-muted {
    font-size: 12px;
    color: #8c9196;
  }
  .xp-actions-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .xp-action-btn {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid #c9cccf;
    background: #fff;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .xp-action-btn:hover {
    background: #f1f2f3;
  }
  .xp-action-edit {
    color: #008060;
    border-color: #008060;
  }
  .xp-action-toggle {
    color: #202223;
  }
  .xp-action-delete {
    color: #d72c0d;
    border-color: #fed3d1;
  }
  .xp-action-delete:hover {
    background: #fff4f4;
  }
  .xp-pagination-bar {
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #f1f2f3;
    font-size: 12px;
    color: #6d7175;
  }
  .xp-pagination-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .xp-page-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: 1px solid #c9cccf;
    background: #fff;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .xp-page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .xp-page-indicator {
    font-size: 12px;
    font-weight: 600;
    color: #202223;
  }

  /* Empty State */
  .xp-empty-state {
    text-align: center;
    padding: 48px 24px;
  }
  .xp-empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }
  .xp-empty-btn {
    margin-top: 16px;
  }

  /* Editor View */
  .xp-editor-card {
    background: #ffffff;
    border: 1px solid #e1e3e5;
    border-radius: 10px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .xp-editor-breadcrumb {
    margin-bottom: 20px;
    border-bottom: 1px solid #f1f2f3;
    padding-bottom: 12px;
  }
  .xp-btn-back {
    background: none;
    border: none;
    color: #008060;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    margin-bottom: 8px;
    display: inline-block;
  }
  .xp-btn-back:hover {
    text-decoration: underline;
  }
  .xp-editor-breadcrumb h2 {
    margin: 0;
    font-size: 18px;
    color: #202223;
  }
  .xp-editor-section {
    background: #f9fafb;
    border: 1px solid #e1e3e5;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .xp-editor-section h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 700;
    color: #202223;
  }
  .xp-pre-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 24px;
    margin-top: 12px;
  }
  @media (max-width: 992px) {
    .xp-pre-layout {
      grid-template-columns: 1fr;
    }
  }
  .xp-sub {
    font-size: 12px;
    color: #6d7175;
    margin: 4px 0 0;
  }
  .xp-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .xp-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .xp-field label {
    font-size: 13px;
    font-weight: 600;
    color: #202223;
  }
  .xp-field small {
    font-size: 11px;
    color: #6d7175;
  }
  .xp-input {
    padding: 8px 12px;
    border: 1px solid #c9cccf;
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
    color: #202223;
  }
  .xp-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .xp-btn-gold {
    background: #0B0B0B;
    color: #D4AF37;
    border: 1px solid #D4AF37;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 700;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s ease;
  }
  .xp-btn-gold:hover {
    background: #1c1c1c;
  }
  .xp-btn-cancel {
    background: #fff;
    border: 1px solid #c9cccf;
    color: #5c5f62;
    padding: 10px 18px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .xp-form-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
  .xp-inline {
    margin: 0;
  }

  /* Trigger Picker */
  .xp-trigger-picker-wrap {
    margin-top: 10px;
    padding: 10px;
    background: #fff;
    border: 1px solid #e1e3e5;
    border-radius: 6px;
  }
  .xp-selected-trigger-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }
  .xp-trigger-card-info strong {
    font-size: 13px;
    color: #202223;
    display: block;
  }
  .xp-trigger-search-dropdown {
    margin-top: 8px;
    border-top: 1px solid #f1f2f3;
    padding-top: 8px;
  }
  .xp-trigger-dropdown-list {
    max-height: 180px;
  }
  .xp-check-mark {
    color: #D4AF37;
    font-weight: 800;
    font-size: 16px;
    margin-left: auto;
  }

  /* Multi-Product Picker UI */
  .xp-picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-picker-quickactions {
    display: flex;
    gap: 8px;
  }
  .xp-btn-text {
    background: none;
    border: none;
    color: #008060;
    font-size: 12px;
    cursor: pointer;
    font-weight: 600;
    padding: 0;
  }
  .xp-btn-text:hover {
    text-decoration: underline;
  }
  .xp-picker-search {
    margin-bottom: 6px;
  }
  .xp-picker-list {
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid #c9cccf;
    border-radius: 6px;
    background: #fff;
  }
  .xp-picker-list::-webkit-scrollbar {
    width: 5px;
  }
  .xp-picker-list::-webkit-scrollbar-thumb {
    background: #c9cccf;
    border-radius: 4px;
  }
  .xp-picker-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid #f1f2f3;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .xp-picker-item:last-child {
    border-bottom: none;
  }
  .xp-picker-item:hover {
    background: #f9fafb;
  }
  .xp-picker-item.is-selected {
    background: #fefaf0;
  }
  .xp-picker-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #0B0B0B;
    cursor: pointer;
  }
  .xp-picker-thumb {
    width: 36px;
    height: 36px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #e1e3e5;
    flex-shrink: 0;
  }
  .xp-picker-thumb-placeholder {
    width: 36px;
    height: 36px;
    background: #eee;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .xp-picker-item-info {
    flex: 1;
    min-width: 0;
  }
  .xp-picker-item-title {
    font-size: 13px;
    font-weight: 500;
    color: #202223;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .xp-picker-item-price {
    font-size: 12px;
    color: #6d7175;
  }
  .xp-picker-empty {
    padding: 16px;
    font-size: 13px;
    color: #6d7175;
    text-align: center;
    font-style: italic;
  }
  .xp-check-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #202223;
    cursor: pointer;
  }
  .xp-check-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #0B0B0B;
    cursor: pointer;
  }
  .xp-radio-card-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }
  .xp-radio-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid #c9cccf;
    border-radius: 8px;
    cursor: pointer;
    background: #fff;
    transition: all 0.15s ease;
  }
  .xp-radio-card.is-selected {
    border-color: #D4AF37;
    background: #fefaf0;
  }
  .xp-radio-card input[type="radio"] {
    margin-top: 3px;
    accent-color: #0B0B0B;
    cursor: pointer;
  }
  .xp-radio-card-content strong {
    font-size: 13px;
    color: #202223;
    display: block;
  }

  /* Multi-Product Trigger Selector */
  .xp-trigger-picker-wrap {
    margin-top: 12px;
    padding: 14px;
    background: #f8f9fa;
    border: 1px solid #e1e3e5;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .xp-trigger-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .xp-trigger-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .xp-trigger-selected-wrap {
    background: #fff;
    border: 1px solid #d2d5d8;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .xp-trigger-count-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    color: #202223;
    margin-bottom: 8px;
  }
  .xp-trigger-chips-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 120px;
    overflow-y: auto;
  }
  .xp-trigger-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f1f2f3;
    border: 1px solid #c9cccf;
    border-radius: 16px;
    padding: 3px 8px 3px 4px;
    font-size: 11px;
    font-weight: 500;
    color: #202223;
  }
  .xp-trigger-chip-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
  }
  .xp-trigger-chip-remove {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    color: #6d7175;
    padding: 0 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .xp-trigger-chip-remove:hover {
    color: #d72c0d;
  }
  .xp-trigger-empty-notice {
    font-size: 12px;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 10px 14px;
  }

  /* Discount Box */
  .xp-discount-box {
    background: #fff;
    border: 1px solid #e1e3e5;
    border-radius: 8px;
    padding: 12px;
    margin-top: 8px;
  }
  .xp-discount-hint {
    margin-top: 8px;
    font-size: 11px;
    color: #108043;
    font-weight: 500;
    background: #e3f1df;
    padding: 6px 10px;
    border-radius: 4px;
  }

  /* Storefront Live Preview */
  .xp-preview-sticky {
    position: sticky;
    top: 20px;
  }
  .xp-modal-mock {
    background: #0B0B0B;
    border: 1px solid rgba(212, 175, 55, 0.4);
    border-radius: 14px;
    padding: 22px;
    color: #ffffff;
    box-shadow: 0 12px 35px rgba(0,0,0,0.5);
    margin-top: 12px;
  }
  .xp-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-gold-badge {
    color: #D4AF37;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
  }
  .xp-modal-close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: radial-gradient(circle, rgba(30, 26, 18, 0.95) 0%, rgba(15, 15, 17, 0.98) 100%);
    border: 1.5px solid rgba(212, 175, 55, 0.85);
    color: #FFE58F;
    box-shadow: 0 0 8px rgba(212, 175, 55, 0.7), 0 0 16px rgba(212, 175, 55, 0.4), inset 0 0 5px rgba(212, 175, 55, 0.35);
    transition: all 0.2s ease;
  }
  .xp-modal-close:hover {
    transform: scale(1.08) rotate(90deg);
    border-color: #FFF;
    color: #FFF;
    box-shadow: 0 0 14px rgba(255, 230, 140, 1), 0 0 24px rgba(212, 175, 55, 0.8);
  }
  .xp-modal-headline {
    font-size: 16px;
    font-weight: 700;
    margin: 10px 0 6px;
    color: #fff;
  }
  .xp-modal-desc {
    font-size: 12px;
    color: #b0b0b0;
    margin: 0 0 16px;
    line-height: 1.4;
  }
  .xp-modal-scroll-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
    margin-bottom: 16px;
    padding-right: 4px;
  }
  .xp-modal-scroll-list::-webkit-scrollbar {
    width: 4px;
  }
  .xp-modal-scroll-list::-webkit-scrollbar-thumb {
    background: #D4AF37;
    border-radius: 4px;
  }
  .xp-modal-product {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .xp-modal-check {
    width: 16px;
    height: 16px;
    accent-color: #D4AF37;
    cursor: pointer;
  }
  .xp-modal-img {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #333;
    flex-shrink: 0;
  }
  .xp-modal-img-placeholder {
    width: 44px;
    height: 44px;
    background: #222;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }
  .xp-modal-details {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .xp-modal-details strong {
    font-size: 12px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.35;
    white-space: normal;
    word-break: break-word;
  }
  .xp-modal-pricing {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .xp-price-sale {
    font-size: 13px;
    font-weight: 800;
    color: #D4AF37;
  }
  .xp-price-orig {
    font-size: 11px;
    color: #777;
    text-decoration: line-through;
  }
  .xp-discount-pill {
    background: #D4AF37;
    color: #0B0B0B;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
  }
  .xp-modal-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .xp-btn-add-both {
    background: #D4AF37;
    color: #0B0B0B;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
    width: 100%;
    box-sizing: border-box;
  }
  .xp-btn-skip {
    display: block;
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #D4D4D4;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    padding: 10px 14px;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }
  .xp-btn-skip:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.35);
    color: #FFFFFF;
  }
  .xp-product-link {
    color: inherit;
    text-decoration: none;
    transition: opacity 0.15s ease;
  }
  .xp-product-link:hover {
    opacity: 0.82;
    text-decoration: underline;
  }
  .xp-preview-none {
    font-size: 12px;
    color: #888;
    font-style: italic;
    padding: 16px 0;
    text-align: center;
  }

  /* Layout Selector Cards Grid */
  .xp-layout-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  .xp-layout-card {
    border: 1px solid #c9cccf;
    border-radius: 8px;
    padding: 14px;
    background: #fff;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
  }
  .xp-layout-card:hover {
    border-color: #0B0B0B;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
  }
  .xp-layout-card.is-selected {
    border-color: #D4AF37;
    background: #fefaf0;
    box-shadow: 0 0 0 1px #D4AF37;
  }
  .xp-layout-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .xp-layout-card-icon {
    color: #D4AF37;
    display: flex;
    align-items: center;
  }
  .xp-layout-card-badge {
    font-size: 10px;
    font-weight: 700;
    background: #0B0B0B;
    color: #D4AF37;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .xp-layout-card-title {
    font-size: 13px;
    color: #202223;
    display: block;
    margin-bottom: 4px;
  }
  .xp-layout-card-desc {
    font-size: 11px;
    line-height: 1.35;
    color: #6d7175;
    margin-bottom: 12px;
    flex: 1;
  }
  .xp-layout-card-footer {
    display: flex;
    justify-content: flex-end;
  }
  .xp-layout-radio {
    font-size: 11px;
    font-weight: 600;
    border-radius: 12px;
    border: 1px solid #c9cccf;
    color: #6d7175;
    background: #fff;
    transition: all 0.12s ease;
  }
  .xp-layout-radio.is-checked {
    background: #0B0B0B;
    color: #D4AF37;
    border-color: #0B0B0B;
  }

  /* Live Preview Architecture Styles */
  .xp-preview-meta-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 6px;
  }
  .xp-preview-layout-badge {
    font-size: 10px;
    font-weight: 800;
    background: #0B0B0B;
    color: #D4AF37;
    border: 1px solid #D4AF37;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .xp-sheet-handle-bar {
    width: 42px;
    height: 4px;
    background: rgba(255,255,255,0.3);
    border-radius: 2px;
    margin: 0 auto 12px;
  }
  .xp-flash-urgency-banner {
    background: rgba(212,175,55,0.12);
    border: 1px solid rgba(212,175,55,0.35);
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .xp-flash-urgency-left {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #D4AF37;
  }
  .xp-urgency-timer-text {
    font-family: monospace;
    font-size: 13px;
    font-weight: 900;
    color: #fff;
    background: #0B0B0B;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(212,175,55,0.4);
  }
  .xp-spotlight-hero-card {
    background: rgba(212,175,55,0.06);
    border: 1px solid rgba(212,175,55,0.35);
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 12px;
    display: grid;
    grid-template-columns: 84px 1fr;
    gap: 12px;
    position: relative;
    align-items: center;
    cursor: pointer;
    transition: all 0.18s ease;
  }
  .xp-spotlight-hero-card.is-selected {
    background: rgba(212,175,55,0.12);
    border-color: #D4AF37;
    box-shadow: 0 0 16px rgba(212,175,55,0.15);
  }
  .xp-spotlight-check-pill {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 6px 13px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: #bbb;
    user-select: none;
    z-index: 3;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    white-space: nowrap;
  }
  .xp-spotlight-check-pill.is-checked {
    background: rgba(212, 175, 55, 0.22);
    border-color: #D4AF37;
    color: #D4AF37;
    box-shadow: 0 0 12px rgba(212, 175, 55, 0.4);
  }
  .xp-spotlight-img-wrap {
    position: relative;
    width: 84px;
    height: 84px;
    border-radius: 6px;
    overflow: hidden;
  }
  .xp-spotlight-hero-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: rgba(255, 255, 255, 0.06);
  }
  .xp-spotlight-img-placeholder {
    width: 84px;
    height: 84px;
    background: #222;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .xp-spotlight-save-badge {
    position: absolute;
    top: 3px;
    left: 3px;
    background: #bf0711;
    color: #fff;
    font-size: 8px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .xp-spotlight-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    padding-right: 78px;
  }
  .xp-spotlight-stars {
    display: flex;
    align-items: center;
    gap: 2px;
    color: #D4AF37;
  }
  .xp-spotlight-stars svg {
    width: 11px;
    height: 11px;
  }
  .xp-spotlight-rating-text {
    font-size: 10px;
    color: #aaa;
    margin-left: 3px;
  }
  .xp-spotlight-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.35;
    white-space: normal;
    word-break: break-word;
  }
  .xp-spotlight-pricing {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .xp-spotlight-checklist {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
    color: #ccc;
  }
  .xp-check-bullet {
    display: inline-flex;
    width: 11px;
    height: 11px;
    color: #D4AF37;
    margin-right: 4px;
    vertical-align: -1px;
  }
  .xp-spotlight-secondary-title {
    font-size: 11px;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  /* Layout 2: Curated Bundle Routine Set */
  .xp-bundle-deck-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
    min-width: 0;
    box-sizing: border-box;
  }
  .xp-bundle-routine-deck {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 270px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 4px;
    min-width: 0;
    box-sizing: border-box;
  }
  .xp-bundle-routine-deck::-webkit-scrollbar {
    width: 4px;
  }
  .xp-bundle-routine-deck::-webkit-scrollbar-thumb {
    background: #D4AF37;
    border-radius: 4px;
  }
  .xp-bundle-connector-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 2px 0;
  }
  .xp-bundle-line {
    flex: 1;
    height: 1px;
    background: rgba(212, 175, 55, 0.25);
  }
  .xp-bundle-plus-badge {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #0B0B0B;
    border: 1px solid #D4AF37;
    color: #D4AF37;
    font-size: 11px;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .xp-bundle-item-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(212, 175, 55, 0.25);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    min-width: 0;
    box-sizing: border-box;
  }
  .xp-bundle-item-card:hover {
    border-color: rgba(212, 175, 55, 0.6);
    background: rgba(255, 255, 255, 0.07);
    transform: translateY(-1px);
  }
  .xp-bundle-item-card.is-selected {
    border-color: #D4AF37;
    background: rgba(212, 175, 55, 0.1);
    box-shadow: 0 4px 14px rgba(212, 175, 55, 0.15), inset 0 0 0 1px rgba(212, 175, 55, 0.3);
  }
  .xp-bundle-card-thumb-wrap {
    position: relative;
    width: 54px;
    height: 54px;
    flex-shrink: 0;
  }
  .xp-bundle-card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid rgba(212, 175, 55, 0.35);
    background: #181818;
  }
  .xp-bundle-img-placeholder {
    width: 100%;
    height: 100%;
    background: #1c1c1c;
    border-radius: 8px;
    border: 1px solid rgba(212, 175, 55, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .xp-bundle-thumb-save {
    position: absolute;
    top: -5px;
    left: -5px;
    background: #D4AF37;
    color: #0B0B0B;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
    line-height: 1.2;
    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
  }
  .xp-bundle-card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .xp-bundle-step-tag {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #D4AF37;
  }
  .xp-bundle-card-title {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.35;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
  }
  .xp-bundle-action-cell {
    flex-shrink: 0;
  }
  .xp-bundle-toggle-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 6px 10px;
    border-radius: 20px;
    border: 1px solid rgba(212, 175, 55, 0.4);
    background: rgba(255, 255, 255, 0.05);
    color: #bbb;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .xp-bundle-toggle-pill.is-checked {
    background: #D4AF37;
    border-color: #D4AF37;
    color: #0B0B0B;
    box-shadow: 0 2px 8px rgba(212, 175, 55, 0.4);
  }
  .xp-bundle-summary-card {
    background: rgba(212, 175, 55, 0.06);
    border: 1px solid rgba(212, 175, 55, 0.35);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-sizing: border-box;
  }
  .xp-bundle-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-bundle-summary-label {
    font-size: 12px;
    color: #e0e0e0;
    font-weight: 600;
  }
  .xp-bundle-summary-prices {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .xp-bundle-sum-orig {
    font-size: 11px;
    color: #888;
    text-decoration: line-through;
  }
  .xp-bundle-sum-sale {
    font-size: 14px;
    font-weight: 800;
    color: #D4AF37;
  }
  .xp-bundle-savings-highlight {
    display: flex;
    align-items: center;
    font-size: 11px;
    font-weight: 700;
    color: #25D366;
    margin-top: 2px;
  }
  .xp-flash-item-badge {
    font-size: 9px;
    font-weight: 800;
    background: rgba(212,175,55,0.2);
    color: #D4AF37;
    padding: 1px 5px;
    border-radius: 3px;
  }
  .xp-btn-urgency-glow {
    animation: xp-pulse-gold 2s infinite ease-in-out;
  }
  @keyframes xp-pulse-gold {
    0% { box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3); }
    50% { box-shadow: 0 4px 20px rgba(212, 175, 55, 0.7); }
    100% { box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3); }
  }
`;

