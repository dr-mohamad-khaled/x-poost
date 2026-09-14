import { useState, useEffect, useMemo } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import FeatureLanguageSwitcher from "../components/FeatureLanguageSwitcher";
import {
  DEFAULT_TRANSLATIONS_BY_LANG,
  getAllTranslations,
  sanitizeText,
  type SupportedLanguage,
} from "../utils/translations";


export type InCartOfferLangCopy = {
  headline: string;
  addButton: string;
  saveBadge: string;
};

export type InCartOfferI18n = Record<SupportedLanguage, InCartOfferLangCopy>;

export function getDefaultInCartI18n(): InCartOfferI18n {
  const res: any = {};
  (Object.keys(DEFAULT_TRANSLATIONS_BY_LANG) as SupportedLanguage[]).forEach((lang) => {
    const def = DEFAULT_TRANSLATIONS_BY_LANG[lang].inCart;
    res[lang] = {
      headline: def.sectionTitle || "Frequently Bought Together",
      addButton: def.addButton || "+ Add",
      saveBadge: def.saveBadge || "SAVE {discount}%",
    };
  });
  return res;
}

type CatalogProduct = {
  id: string;
  title: string;
  handle?: string;
  imageUrl?: string;
  price?: string;
  variantId?: string;
};

let inCartCatalogCache: { shop: string; timestamp: number; products: CatalogProduct[] } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  const rules = await prisma.upsellRule.findMany({
    where: { shopId: shop.id, type: "IN_CART" },
    orderBy: { createdAt: "desc" },
  });

  // Fast-path: use in-memory catalog cache if fresh (< 2 min)
  let products: CatalogProduct[] = [];
  if (
    inCartCatalogCache &&
    inCartCatalogCache.shop === session.shop &&
    Date.now() - inCartCatalogCache.timestamp < CACHE_TTL_MS &&
    inCartCatalogCache.products.length > 0
  ) {
    products = inCartCatalogCache.products;
  } else {
    try {
      const response = await admin.graphql(
        `#graphql
        query getProductsForInCart {
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
        console.error("[XPoost] GraphQL errors querying products for in-cart:", json.errors);
      }
      products = (json.data?.products?.edges || []).map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        handle: e.node.handle,
        imageUrl: e.node.featuredImage?.url,
        price: e.node.variants?.edges[0]?.node?.price || "19.99",
        variantId: e.node.variants?.edges[0]?.node?.id,
      }));
      if (products.length > 0) {
        inCartCatalogCache = { shop: session.shop, timestamp: Date.now(), products };
      }
    } catch (err) {
      console.error("[XPoost] Failed to query products for in-cart:", err);
      if (inCartCatalogCache?.shop === session.shop) products = inCartCatalogCache.products;
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

  const translationConfig = await prisma.translationConfig.findUnique({
    where: { shopId: shop.id },
  });
  const allTranslations = getAllTranslations(translationConfig?.translationsJson);
  const dashboardLocale = (translationConfig?.dashboardLocale || "en") as SupportedLanguage;

  return {
    shop,
    enabled: shop.inCartUpsellEnabled,
    rules,
    products,
    styleConfig,
    allTranslations,
    dashboardLocale,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save_rule");

  if (intent === "save_translations") {
    const translationsJsonRaw = String(formData.get("translationsJson") || "");
    if (translationsJsonRaw) {
      try {
        const parsedAll = getAllTranslations(translationsJsonRaw);
        await prisma.translationConfig.upsert({
          where: { shopId: shop.id },
          update: { translationsJson: JSON.stringify(parsedAll) },
          create: {
            shopId: shop.id,
            dashboardLocale: "en",
            storefrontLocale: "ar",
            translationsJson: JSON.stringify(parsedAll),
          },
        });
        return { ok: true, message: "Multi-language in-cart copy saved successfully." };
      } catch (tErr) {
        console.error("[InCart Action] Error saving translationConfig:", tErr);
      }
    }
    return { ok: true };
  }

  if (intent === "save_styles") {
    const inCartBg = String(formData.get("inCartBg") || "#0B0B0B");
    const inCartAccent = String(formData.get("inCartAccent") || "#D4AF37");
    const inCartText = String(formData.get("inCartText") || "#FFFFFF");

    try {
      if ((prisma as any).upsellStyleConfig) {
        await (prisma as any).upsellStyleConfig.upsert({
          where: { shopId: shop.id },
          update: {
            inCartBg,
            inCartAccent,
            inCartText,
          },
          create: {
            shopId: shop.id,
            prePurchaseBg: "#0B0B0B",
            prePurchaseAccent: "#D4AF37",
            prePurchaseText: "#FFFFFF",
            inCartBg,
            inCartAccent,
            inCartText,
          },
        });
      }
    } catch (e) {
      console.warn("[XPoost] Error saving in-cart styles:", e);
    }
    return { ok: true, message: "In-cart styling preferences saved successfully." };
  }

  if (intent === "toggle_global") {
    const enabled = formData.get("enabled") === "true";
    await prisma.shop.update({
      where: { id: shop.id },
      data: { inCartUpsellEnabled: enabled },
    });
    return { ok: true, message: `In-cart drawer upsells ${enabled ? "enabled" : "disabled"}.` };
  }

  if (intent === "delete_rule" || intent === "delete_offer") {
    const ruleId = String(formData.get("ruleId"));
    await prisma.upsellRule.deleteMany({
      where: { id: ruleId, shopId: shop.id },
    });
    return { ok: true, message: "In-cart upsell rule deleted." };
  }

  if (intent === "toggle_rule" || intent === "toggle_offer") {
    const ruleId = String(formData.get("ruleId"));
    const active = formData.get("active") === "true";
    await prisma.upsellRule.updateMany({
      where: { id: ruleId, shopId: shop.id },
      data: { active },
    });
    return { ok: true, message: `Rule status updated: ${active ? "active" : "paused"}.` };
  }

  if (intent === "create_rule" || intent === "edit_rule") {
    const isEdit = intent === "edit_rule";
    const editRuleId = String(formData.get("ruleId") || "");
    const triggerType = String(formData.get("triggerType") || "ALL");
    const triggerProductId = String(formData.get("triggerProductId") || "ALL");
    const triggerProductTitle = String(formData.get("triggerProductTitle") || "All Products");

    if (triggerType === "SPECIFIC" && (!triggerProductId || triggerProductId === "ALL" || triggerProductId.trim() === "")) {
      return { error: "Please select at least one trigger product." };
    }

    const targetProductId = String(formData.get("targetProductId") || "");
    const targetProductTitle = String(formData.get("targetProductTitle") || "Add-on Deal");
    const targetProductHandle = String(formData.get("targetProductHandle") || "").trim();
    const targetVariantId = String(formData.get("targetVariantId") || "");
    const targetProductPrice = String(formData.get("targetProductPrice") || "19.99");
    const targetProductImage = String(formData.get("targetProductImage") || "");
    const offerI18nJsonRaw = String(formData.get("offerI18nJson") || "");
    let offerI18n: any = null;
    if (offerI18nJsonRaw) {
      try {
        offerI18n = JSON.parse(offerI18nJsonRaw);
      } catch (e) {}
    }

    const offerHeadline = offerI18n?.ar?.headline || offerI18n?.en?.headline || String(formData.get("offerHeadline") || "Frequently Bought Together");
    const hasDiscount = formData.get("hasDiscount") === "true";
    const discountPercent = hasDiscount
      ? parseFloat(String(formData.get("discountPercent") || "0")) || null
      : null;
    let discountCode = hasDiscount
      ? String(formData.get("discountCode") || "").trim()
      : "";

    if (!targetProductId) {
      return { error: "Please select an add-on product." };
    }

    let offerDescription = targetProductHandle ? `<!--xp:h:${encodeURIComponent(targetProductHandle)}-->` : "";
    if (offerI18n) {
      offerDescription += `<!--xp:i18n:${encodeURIComponent(JSON.stringify(offerI18n))}-->`;
    }

    // Register Shopify Automatic Discount and Code Discount if discount percentage is configured
    if (hasDiscount && discountPercent && discountPercent > 0) {
      if (!discountCode) {
        discountCode = `XPOOST_CART_${Math.round(discountPercent)}OFF_${Date.now().toString().slice(-4)}`;
      }
      try {
        const itemsPayload = targetProductId.startsWith("gid://shopify/Product/")
          ? { products: { productsToAdd: [targetProductId] } }
          : { all: true };

        const discountTitle = `${offerHeadline} (${discountPercent}% OFF - ${discountCode})`;

        // 1. Create Automatic Discount
        await admin.graphql(
          `#graphql
          mutation createInCartAutomaticDiscount($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
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
          mutation createInCartCodeDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
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
        console.warn("[XPoost] In-cart discount creation warning:", graphErr);
      }
    }

    if (isEdit && editRuleId) {
      await prisma.upsellRule.update({
        where: { id: editRuleId },
        data: {
          triggerProductId,
          triggerProductTitle,
          targetProductId,
          targetProductTitle,
          targetVariantId,
          targetProductPrice,
          targetProductImage,
          offerHeadline,
          offerDescription,
          discountPercent,
          discountCode,
          active: true,
        },
      });
      return { ok: true, message: `In-cart upsell "${offerHeadline}" updated successfully!` };
    } else {
      await prisma.upsellRule.create({
        data: {
          shopId: shop.id,
          type: "IN_CART",
          triggerProductId,
          triggerProductTitle,
          targetProductId,
          targetProductTitle,
          targetVariantId,
          targetProductPrice,
          targetProductImage,
          offerHeadline,
          offerDescription,
          discountPercent,
          discountCode,
          active: true,
        },
      });

      await prisma.shop.update({
        where: { id: shop.id },
        data: { inCartUpsellEnabled: true },
      });

      return { ok: true, message: "In-cart drawer upsell rule created successfully!" };
    }
  }

  return { error: "Unknown request" };
};

export default function InCartUpsellSettings() {
  const { enabled, rules, products, styleConfig, allTranslations, dashboardLocale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(dashboardLocale || "ar");
  const [offerI18n, setOfferI18n] = useState<InCartOfferI18n>(getDefaultInCartI18n);

  const activeOfferCopy = offerI18n[selectedLang] || offerI18n.en || {
    headline: "Frequently Bought Together",
    addButton: "+ Add",
    saveBadge: "SAVE {discount}%",
  };

  const updateOfferCopy = (field: keyof InCartOfferLangCopy, val: string) => {
    const clean = sanitizeText(val);
    setOfferI18n((prev) => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        [field]: clean,
      },
    }));
  };

  const handleLoadPredefined = () => {
    const def = DEFAULT_TRANSLATIONS_BY_LANG[selectedLang].inCart;
    setOfferI18n((prev) => ({
      ...prev,
      [selectedLang]: {
        headline: def.sectionTitle || "Frequently Bought Together",
        addButton: def.addButton || "+ Add",
        saveBadge: def.saveBadge || "SAVE {discount}%",
      },
    }));
  };

  const [inCartBg, setInCartBg] = useState(styleConfig?.inCartBg || "#0B0B0B");
  const [inCartAccent, setInCartAccent] = useState(styleConfig?.inCartAccent || "#D4AF37");
  const [inCartText, setInCartText] = useState(styleConfig?.inCartText || "#FFFFFF");

  // Navigation state: "index" | "create" | "edit"
  const [viewMode, setViewMode] = useState<"index" | "create" | "edit">("index");
  const [editingRule, setEditingRule] = useState<any>(null);

  // Table Filters & Pagination state
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (statusFilter === "active" && !rule.active) return false;
      if (statusFilter === "paused" && rule.active) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchesHeadline = (rule.offerHeadline || "").toLowerCase().includes(q);
        const matchesTrigger = (rule.triggerProductTitle || "").toLowerCase().includes(q);
        const matchesTarget = (rule.targetProductTitle || "").toLowerCase().includes(q);
        if (!matchesHeadline && !matchesTrigger && !matchesTarget) return false;
      }
      return true;
    });
  }, [rules, statusFilter, tableSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredRules.length / itemsPerPage));
  const paginatedRules = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRules.slice(start, start + itemsPerPage);
  }, [filteredRules, currentPage]);

  // Form State
  const [headline, setHeadline] = useState("Frequently Bought Together");
  const [triggerType, setTriggerType] = useState<"ALL" | "SPECIFIC">("ALL");
  const [selectedTriggerProductIds, setSelectedTriggerProductIds] = useState<string[]>([]);
  const [triggerSearch, setTriggerSearch] = useState("");

  const [selectedTargetId, setSelectedTargetId] = useState(products[0]?.id || "");
  const [targetSearch, setTargetSearch] = useState("");
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);

  const [hasDiscount, setHasDiscount] = useState(true);
  const [discountPercent, setDiscountPercent] = useState("10");
  const [discountCode, setDiscountCode] = useState("SAVE10");

  // Dynamic catalog state combining initial products and live search results
  const [catalog, setCatalog] = useState<CatalogProduct[]>(products);
  const [isSearchingTrigger, setIsSearchingTrigger] = useState(false);
  const [isSearchingTarget, setIsSearchingTarget] = useState(false);

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
        console.warn("[InCart] Trigger product search error:", err);
      } finally {
        setIsSearchingTrigger(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [triggerSearch]);

  // Live search for target upsell products across entire store catalog
  useEffect(() => {
    const q = targetSearch.trim();
    if (q.length < 2) return;

    const timer = setTimeout(async () => {
      setIsSearchingTarget(true);
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
        console.warn("[InCart] Target product search error:", err);
      } finally {
        setIsSearchingTarget(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [targetSearch]);

  // Reset to index on action success
  useEffect(() => {
    if (actionData && "ok" in actionData) {
      setViewMode("index");
      setEditingRule(null);
    }
  }, [actionData]);

  const selectedProduct = useMemo(() => {
    return catalog.find((p) => p.id === selectedTargetId) || catalog[0] || products[0];
  }, [catalog, selectedTargetId, products]);

  const openCreateMode = () => {
    setEditingRule(null);
    setHeadline("Frequently Bought Together");
    setOfferI18n(getDefaultInCartI18n());
    setSelectedLang(dashboardLocale || "ar");
    setTriggerType("ALL");
    setSelectedTriggerProductIds([]);
    setTriggerSearch("");
    setSelectedTargetId(catalog[0]?.id || products[0]?.id || "");
    setTargetSearch("");
    setIsTargetDropdownOpen(false);
    setHasDiscount(true);
    setDiscountPercent("10");
    setDiscountCode("SAVE10");
    setViewMode("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEditMode = (rule: any) => {
    setEditingRule(rule);
    setHeadline(rule.offerHeadline || "Frequently Bought Together");

    // Decode in-offer translations
    const i18nMatch = (rule.offerDescription || "").match(/<!--xp:i18n:([^>]+)-->/);
    let parsedI18n: any = null;
    if (i18nMatch) {
      try {
        parsedI18n = JSON.parse(decodeURIComponent(i18nMatch[1].trim()));
      } catch (e) {}
    }
    const base = getDefaultInCartI18n();
    if (parsedI18n) {
      (Object.keys(base) as SupportedLanguage[]).forEach((lang) => {
        if (parsedI18n[lang]) {
          base[lang] = { ...base[lang], ...parsedI18n[lang] };
        }
      });
    }
    if (rule.offerHeadline) {
      base[selectedLang].headline = rule.offerHeadline;
    }
    setOfferI18n(base);
    setSelectedLang(dashboardLocale || "ar");

    if (rule.triggerProductId && rule.triggerProductId !== "ALL") {
      setTriggerType("SPECIFIC");
      const ids = rule.triggerProductId.split(",").map((s: string) => s.trim()).filter(Boolean);
      setSelectedTriggerProductIds(ids);
    } else {
      setTriggerType("ALL");
      setSelectedTriggerProductIds([]);
    }
    if (rule.targetProductId && !catalog.some((p) => p.id === rule.targetProductId)) {
      setCatalog((prev) => [
        ...prev,
        {
          id: rule.targetProductId,
          title: rule.targetProductTitle || "Product",
          imageUrl: rule.targetProductImage || "",
          price: rule.targetProductPrice || "19.99",
          variantId: rule.targetVariantId || "",
        },
      ]);
    }
    setTriggerSearch("");
    setSelectedTargetId(rule.targetProductId);
    setTargetSearch("");
    setIsTargetDropdownOpen(false);
    setHasDiscount(rule.discountPercent !== null && rule.discountPercent > 0);
    setDiscountPercent(rule.discountPercent ? String(rule.discountPercent) : "10");
    setDiscountCode(rule.discountCode || "");
    setViewMode("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filtered trigger products
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

  // Filtered target products
  const filteredTargetProducts = useMemo(() => {
    if (!targetSearch.trim()) return catalog;
    const terms = targetSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.filter((p) => {
      const target = `${p.title} ${p.handle || ""}`.toLowerCase();
      return terms.every((term) => target.includes(term));
    });
  }, [catalog, targetSearch]);

  const originalPrice = parseFloat(selectedProduct?.price || "25.00");
  const isDiscounted = hasDiscount && parseFloat(discountPercent) > 0;
  const discountedPrice = (originalPrice * (1 - (parseFloat(discountPercent) || 0) / 100)).toFixed(2);
  const displayPrice = isDiscounted ? discountedPrice : originalPrice.toFixed(2);

  const toggleSelectAllOffers = () => {
    if (selectedOfferIds.length === paginatedRules.length) {
      setSelectedOfferIds([]);
    } else {
      setSelectedOfferIds(paginatedRules.map((o) => o.id));
    }
  };

  const toggleSelectOffer = (id: string) => {
    setSelectedOfferIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <s-page heading="In-Cart Drawer Upsells">
      <style>{IN_CART_STYLES}</style>

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
            <strong>In-Cart Drawer Add-Ons: {enabled ? "Active" : "Disabled"}</strong>
          </div>
          <p className="xp-sub">
            Injects high-converting add-on products directly inside customer slide-out cart drawers.
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
              <span>+</span> Create In-Cart Offer
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VIEW 1: IN-CART OFFERS INDEX TABLE
          ───────────────────────────────────────────────────────────── */}
      {viewMode === "index" ? (
        <>
          <div className="xp-index-card" style={{ marginBottom: "20px", padding: "18px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#FFFFFF", margin: "0 0 4px 0" }}>
                  In-Cart Drawer Appearance & Colors
                </h3>
                <p style={{ fontSize: "12px", color: "#8C9196", margin: 0 }}>
                  Customize the background, accent, and text colors of in-cart drawer recommendations.
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
                      name="inCartBg"
                      value={inCartBg}
                      onChange={(e) => setInCartBg(e.target.value)}
                      style={{ width: "40px", height: "36px", padding: "2px", border: "1px solid #333", borderRadius: "6px", background: "#111", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#fff" }}>{inCartBg}</span>
                  </div>
                </div>

                <div className="xp-color-control">
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#bbb", marginBottom: "6px" }}>
                    Accent Highlight Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="color"
                      name="inCartAccent"
                      value={inCartAccent}
                      onChange={(e) => setInCartAccent(e.target.value)}
                      style={{ width: "40px", height: "36px", padding: "2px", border: "1px solid #333", borderRadius: "6px", background: "#111", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#fff" }}>{inCartAccent}</span>
                  </div>
                </div>

                <div className="xp-color-control">
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#bbb", marginBottom: "6px" }}>
                    Text Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="color"
                      name="inCartText"
                      value={inCartText}
                      onChange={(e) => setInCartText(e.target.value)}
                      style={{ width: "40px", height: "36px", padding: "2px", border: "1px solid #333", borderRadius: "6px", background: "#111", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#fff" }}>{inCartText}</span>
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
          <div className="xp-index-header">
            <div className="xp-search-box">
              <span className="xp-search-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input
                type="text"
                className="xp-search-input"
                placeholder="Filter in-cart offers by title, trigger, or product..."
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
                All ({rules.length})
              </button>
              <button
                type="button"
                className={`xp-filter-tab ${statusFilter === "active" ? "is-selected" : ""}`}
                onClick={() => {
                  setStatusFilter("active");
                  setCurrentPage(1);
                }}
              >
                Active ({rules.filter((r) => r.active).length})
              </button>
              <button
                type="button"
                className={`xp-filter-tab ${statusFilter === "paused" ? "is-selected" : ""}`}
                onClick={() => {
                  setStatusFilter("paused");
                  setCurrentPage(1);
                }}
              >
                Paused ({rules.filter((r) => !r.active).length})
              </button>
            </div>
          </div>

          {filteredRules.length === 0 ? (
            <div className="xp-empty-state">
              <div className="xp-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="21" r="1"/>
                  <circle cx="19" cy="21" r="1"/>
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
                </svg>
              </div>
              <h3>No in-cart drawer offers found</h3>
              <p className="xp-sub">
                {tableSearch || statusFilter !== "all"
                  ? "Try clearing your search query or filters."
                  : "Create your first in-cart upsell to recommend complementary items right inside the cart drawer."}
              </p>
              <button
                type="button"
                className="xp-btn-gold-primary xp-empty-btn"
                onClick={openCreateMode}
              >
                + Create In-Cart Offer
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
                          paginatedRules.length > 0 &&
                          selectedOfferIds.length === paginatedRules.length
                        }
                        onChange={toggleSelectAllOffers}
                      />
                    </th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Cart Trigger</th>
                    <th>Add-On Product</th>
                    <th>Discount</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRules.map((rule) => {
                    const isSelected = selectedOfferIds.includes(rule.id);
                    return (
                      <tr
                        key={rule.id}
                        className={`xp-table-row ${isSelected ? "is-row-selected" : ""}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="xp-table-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOffer(rule.id)}
                          />
                        </td>
                        <td>
                          <div className="xp-table-title-cell">
                            {rule.targetProductImage ? (
                              <img src={rule.targetProductImage} alt="" className="xp-table-thumb" />
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
                              onClick={() => openEditMode(rule)}
                            >
                              <strong>{rule.offerHeadline || "In-Cart Add-on"}</strong>
                              <span className="xp-table-sub">
                                {rule.targetProductTitle}
                              </span>
                            </button>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`xp-badge-status ${
                              rule.active ? "xp-badge-active" : "xp-badge-paused"
                            }`}
                          >
                            {rule.active ? "Active" : "Paused"}
                          </span>
                        </td>
                        <td>
                          <span className="xp-trigger-badge" title={rule.triggerProductTitle || "All Carts"}>
                            {rule.triggerProductId === "ALL"
                              ? "All Carts"
                              : (rule.triggerProductTitle && rule.triggerProductTitle.length > 32)
                              ? rule.triggerProductTitle.slice(0, 32) + "..."
                              : (rule.triggerProductTitle || "Specific Items")}
                          </span>
                        </td>
                        <td>
                          <div className="xp-promoted-cell">
                            <span className="xp-promoted-count">{rule.targetProductTitle}</span>
                            <span className="xp-promoted-names">${rule.targetProductPrice || "19.99"}</span>
                          </div>
                        </td>
                        <td>
                          {rule.discountPercent ? (
                            <span className="xp-discount-tag">
                              {rule.discountPercent}% OFF
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
                              onClick={() => openEditMode(rule)}
                            >
                              Edit
                            </button>
                            <Form method="post" className="xp-inline">
                              <input type="hidden" name="intent" value="toggle_rule" />
                              <input type="hidden" name="ruleId" value={rule.id} />
                              <input
                                type="hidden"
                                name="active"
                                value={rule.active ? "false" : "true"}
                              />
                              <button
                                type="submit"
                                className="xp-action-btn xp-action-toggle"
                                disabled={isSubmitting}
                              >
                                {rule.active ? "Pause" : "Activate"}
                              </button>
                            </Form>
                            <Form method="post" className="xp-inline">
                              <input type="hidden" name="intent" value="delete_rule" />
                              <input type="hidden" name="ruleId" value={rule.id} />
                              <button
                                type="submit"
                                className="xp-action-btn xp-action-delete"
                                disabled={isSubmitting}
                                onClick={(e) => {
                                  if (
                                    !window.confirm(
                                      `Are you sure you want to delete "${rule.offerHeadline || "this offer"}"?`
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

              <div className="xp-pagination-bar">
                <div className="xp-pagination-info">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, filteredRules.length)} of{" "}
                  {filteredRules.length} offers
                </div>
                <div className="xp-pagination-controls">
                  <button
                    type="button"
                    className="xp-page-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous Page"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span className="xp-page-indicator">
                    Page {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    className="xp-page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next Page"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </>
      ) : (
        /* ─────────────────────────────────────────────────────────────
           VIEW 2: IN-CART OFFER EDITOR (Create or Edit Mode)
           ───────────────────────────────────────────────────────────── */
        <div className="xp-editor-card">
          <div className="xp-editor-breadcrumb">
            <button
              type="button"
              className="xp-btn-back"
              onClick={() => setViewMode("index")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "4px" }}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to All Offers
            </button>
            <h2>{viewMode === "edit" ? `Edit In-Cart Offer: ${headline}` : "Create In-Cart Drawer Offer"}</h2>
          </div>

          <div className="xp-cart-layout">
            <div className="xp-cart-config">
              <Form method="post" className="xp-form">
                <input
                  type="hidden"
                  name="intent"
                  value={viewMode === "edit" ? "edit_rule" : "create_rule"}
                />
                {viewMode === "edit" && editingRule && (
                  <input type="hidden" name="ruleId" value={editingRule.id} />
                )}

                {/* Multi-Language In-Offer Configuration */}
                <div className="xp-editor-section" style={{ borderLeft: "3px solid #D4AF37", paddingLeft: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700" }}>
                        Offer Language &amp; Localized Content
                      </h3>
                      <p className="xp-sub" style={{ margin: 0, fontSize: "12px" }}>
                        Select a language to customize this specific offer's headline, button, and badge for international buyers.
                      </p>
                    </div>
                  </div>

                  <FeatureLanguageSwitcher
                    selectedLang={selectedLang}
                    onSelectLang={setSelectedLang}
                    onLoadPredefined={handleLoadPredefined}
                    dashboardLocale={dashboardLocale}
                  />
                </div>

                {/* Section 1: Localized Headline & Text */}
                <div className="xp-editor-section">
                  <h3>1. Offer Headline &amp; Button Copy ({selectedLang.toUpperCase()})</h3>
                  
                  <div className="xp-field" style={{ marginBottom: "14px" }}>
                    <label>Header / Section Title ({selectedLang.toUpperCase()})</label>
                    <input
                      type="text"
                      className="xp-input"
                      dir={selectedLang === "ar" ? "rtl" : "ltr"}
                      value={activeOfferCopy.headline}
                      placeholder="e.g. Frequently Bought Together or Complete Your Routine"
                      onChange={(e) => {
                        updateOfferCopy("headline", e.target.value);
                        setHeadline(e.target.value);
                      }}
                      required
                    />
                    <small>Appears above the add-on card inside the cart drawer.</small>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div className="xp-field">
                      <label>Quick-Add Button Label ({selectedLang.toUpperCase()})</label>
                      <input
                        type="text"
                        className="xp-input"
                        dir={selectedLang === "ar" ? "rtl" : "ltr"}
                        value={activeOfferCopy.addButton}
                        placeholder="e.g. + Add to Cart"
                        onChange={(e) => updateOfferCopy("addButton", e.target.value)}
                      />
                    </div>

                    <div className="xp-field">
                      <label>Discount Badge Format ({selectedLang.toUpperCase()})</label>
                      <input
                        type="text"
                        className="xp-input"
                        dir={selectedLang === "ar" ? "rtl" : "ltr"}
                        value={activeOfferCopy.saveBadge}
                        placeholder="e.g. SAVE {discount}%"
                        onChange={(e) => updateOfferCopy("saveBadge", e.target.value)}
                      />
                      <small>Use {"{discount}"} as placeholder for percentage</small>
                    </div>
                  </div>

                  <input type="hidden" name="offerHeadline" value={activeOfferCopy.headline || headline} />
                  <input type="hidden" name="offerI18nJson" value={JSON.stringify(offerI18n)} />
                </div>

                {/* Trigger Condition */}
                <div className="xp-editor-section">
                  <h3>2. Cart Trigger Condition</h3>
                  <p className="xp-sub" style={{ marginBottom: "12px" }}>
                    Choose whether this add-on shows on any cart or only when specific products are in the cart.
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
                        <strong>Always Show (Any Cart Items)</strong>
                        <p className="xp-sub">Renders whenever the customer's cart contains any product.</p>
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
                        <strong>When Cart Contains Specific Products (Multi-select)</strong>
                        <p className="xp-sub">Only renders when any of these products are in the customer's cart.</p>
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
                          <strong>No trigger products selected.</strong> Please check one or more products below to trigger this in-cart add-on.
                        </div>
                      ) : (
                        <div className="xp-trigger-selected-wrap">
                          <div className="xp-trigger-count-bar">
                            <span>{selectedTriggerProductsList.length} Trigger Product{selectedTriggerProductsList.length > 1 ? "s" : ""} Selected:</span>
                            <span style={{ fontSize: "11px", color: "#6d7175" }}>Shows when ANY of these are in the cart</span>
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

                {/* Add-On Product Picker */}
                <div className="xp-editor-section">
                  <h3>3. Promoted Add-on Product</h3>
                  <p className="xp-sub" style={{ marginBottom: "10px" }}>
                    Select the product that appears as a one-click add-on inside the drawer.
                  </p>

                  <div className="xp-selected-trigger-card" style={{ background: "#fff", padding: "10px", border: "1px solid #c9cccf", borderRadius: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {selectedProduct?.imageUrl ? (
                        <img src={selectedProduct.imageUrl} alt="" className="xp-picker-thumb" />
                      ) : (
                        <div className="xp-picker-thumb-placeholder">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            <polyline points="3.29 7 12 12 20.71 7"/>
                            <line x1="12" y1="22" x2="12" y2="12"/>
                          </svg>
                        </div>
                      )}
                      <div>
                        <strong>{selectedProduct?.title}</strong>
                        <div className="xp-sub">${selectedProduct?.price}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="xp-btn-text"
                      onClick={() => setIsTargetDropdownOpen(!isTargetDropdownOpen)}
                    >
                      {isTargetDropdownOpen ? "Close Search" : "Change Product"}
                    </button>
                  </div>

                  {isTargetDropdownOpen && (
                    <div style={{ marginTop: "10px" }}>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          className="xp-input xp-picker-search"
                          placeholder="Search all 900+ products to promote (e.g. Anua)..."
                          value={targetSearch}
                          onChange={(e) => setTargetSearch(e.target.value)}
                          autoFocus
                        />
                        {isSearchingTarget && (
                          <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#8c9196" }}>
                            Searching store...
                          </span>
                        )}
                      </div>
                      <div className="xp-picker-list">
                        {filteredTargetProducts.length === 0 ? (
                          <div style={{ padding: "20px", textAlign: "center", color: "#8c9196", fontSize: "12px" }}>
                            {isSearchingTarget ? "Searching store catalog..." : `No products found matching "${targetSearch}"`}
                          </div>
                        ) : (
                          filteredTargetProducts.map((p) => (
                          <div
                            key={p.id}
                            className={`xp-picker-item ${
                              selectedTargetId === p.id ? "is-selected" : ""
                            }`}
                            onClick={() => {
                              setSelectedTargetId(p.id);
                              setIsTargetDropdownOpen(false);
                            }}
                          >
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
                            {selectedTargetId === p.id && (
                              <span className="xp-check-mark">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              </span>
                            )}
                          </div>
                        )))}
                      </div>
                    </div>
                  )}

                  <input type="hidden" name="targetProductId" value={selectedProduct?.id || ""} />
                  <input type="hidden" name="targetProductTitle" value={selectedProduct?.title || ""} />
                  <input type="hidden" name="targetProductHandle" value={selectedProduct?.handle || ""} />
                  <input type="hidden" name="targetProductPrice" value={selectedProduct?.price || "19.99"} />
                  <input type="hidden" name="targetVariantId" value={selectedProduct?.variantId || ""} />
                  <input type="hidden" name="targetProductImage" value={selectedProduct?.imageUrl || ""} />
                </div>

                {/* Promotional Discount */}
                <div className="xp-editor-section">
                  <h3>4. Promotional Discount</h3>
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
                            max="80"
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
                            placeholder="e.g. SAVE10"
                            onChange={(e) => setDiscountCode(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="xp-discount-hint">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4AF37" style={{ verticalAlign: "middle", marginRight: "6px" }}>
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
                    disabled={isSubmitting || !selectedTargetId}
                  >
                    {isSubmitting
                      ? "Saving In-Cart Offer..."
                      : viewMode === "edit"
                      ? "Save Changes"
                      : "Create In-Cart Offer"}
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

            {/* Cart Drawer Live Preview */}
            <div className="xp-cart-preview-wrap">
              <div className="xp-preview-sticky">
                <h3>Cart Drawer Preview</h3>
                <p className="xp-sub">Embedded add-on card rendered inside cart drawers.</p>

                <div className="xp-drawer-mock" dir={selectedLang === "ar" ? "rtl" : "ltr"}>
                  <div className="xp-drawer-title">{activeOfferCopy.headline || headline || "Frequently Bought Together"}</div>

                  <div className="xp-addon-card">
                    {selectedProduct?.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.title}
                        className="xp-addon-img"
                      />
                    ) : (
                      <div className="xp-addon-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8c9196" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                          <path d="M3 6h18"/>
                          <path d="M16 10a4 4 0 0 1-8 0"/>
                        </svg>
                      </div>
                    )}
                    <div className="xp-addon-body">
                      <div className="xp-addon-name">
                        <a
                          href={selectedProduct?.handle ? `/products/${selectedProduct.handle}` : "#"}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "inherit", textDecoration: "none" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {selectedProduct?.title || (selectedLang === "ar" ? "منتج مميز إضافي" : "Exclusive Add-on")}
                        </a>
                      </div>
                      <div className="xp-addon-pricing">
                        <span className="xp-addon-sale">${displayPrice}</span>
                        {isDiscounted && (
                          <span className="xp-addon-orig">${originalPrice.toFixed(2)}</span>
                        )}
                        {isDiscounted && (
                          <span className="xp-addon-badge">{(activeOfferCopy.saveBadge || (selectedLang === "ar" ? "وفر {discount}%" : "SAVE {discount}%")).replace("{discount}", discountPercent)}</span>
                        )}
                      </div>
                      <button type="button" className="xp-addon-quickadd">
                        {activeOfferCopy.addButton || (selectedLang === "ar" ? "+ أضف للسلة" : "+ Add to Cart")}
                      </button>
                    </div>
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

const IN_CART_STYLES = `
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
  .xp-cart-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 24px;
    margin-top: 12px;
  }
  @media (max-width: 992px) {
    .xp-cart-layout {
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

  /* Picker items */
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

  /* Cart Drawer Preview */
  .xp-preview-sticky {
    position: sticky;
    top: 20px;
  }
  .xp-drawer-mock {
    background: #0B0B0B;
    border: 1px solid rgba(212, 175, 55, 0.4);
    border-radius: 12px;
    padding: 18px;
    color: #ffffff;
    box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    margin-top: 12px;
  }
  .xp-drawer-title {
    font-size: 12px;
    font-weight: 700;
    color: #D4AF37;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 12px;
  }
  .xp-addon-card {
    display: flex;
    gap: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-radius: 8px;
    padding: 10px;
    align-items: center;
  }
  .xp-addon-img {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
  }
  .xp-addon-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    background: #222;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  .xp-addon-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .xp-addon-name {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 170px;
  }
  .xp-addon-pricing {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .xp-addon-sale {
    color: #D4AF37;
    font-weight: 700;
    font-size: 13px;
  }
  .xp-addon-orig {
    color: #888;
    font-size: 11px;
    text-decoration: line-through;
  }
  .xp-addon-quickadd {
    background: #D4AF37;
    color: #0B0B0B;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    align-self: flex-start;
    margin-top: 4px;
  }
  .xp-addon-badge {
    background: #D4AF37;
    color: #0B0B0B;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
  }
`;

