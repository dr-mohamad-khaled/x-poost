import { useState, useMemo, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  let config = await prisma.productScarcityConfig.findUnique({
    where: { shopId: shop.id },
  });

  if (!config) {
    config = await prisma.productScarcityConfig.create({
      data: {
        shopId: shop.id,
        active: true,
        designPreset: "pulse_meter",
        stockSource: "shopify",
        minStock: 3,
        maxStock: 12,
        lowStockThreshold: 20,
        headlineText: "Hurry! Only {stock} items left in stock",
        subText: "High demand: selling fast",
        accentColor: "#D4AF37",
        backgroundColor: "#141414",
        textColor: "#FFFFFF",
        borderColor: "#2d2d2d",
        targetMode: "ALL",
        productIdsJson: "[]",
      },
    });
  }

  // Fetch store products for picker
  let products: any[] = [];
  try {
    const res = await admin.graphql(`
      #graphql
      query GetProductsForScarcity {
        products(first: 250) {
          nodes {
            id
            title
            handle
            featuredImage {
              url
              altText
            }
          }
        }
      }
    `);
    const data = await res.json();
    products = data?.data?.products?.nodes || [];
  } catch (err) {
    console.error("[Product Scarcity Loader] Error fetching products:", err);
  }

  if (config) {
    config.headlineText = (config.headlineText || "").replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, "").trim();
    config.subText = (config.subText || "").replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, "").trim();
  }

  return {
    shopDomain: session.shop,
    config,
    products,
    productScarcityEnabled: shop.productScarcityEnabled,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();

  const active = formData.get("active") === "on";
  const designPreset = String(formData.get("designPreset") || "pulse_meter");
  const stockSource = String(formData.get("stockSource") || "shopify");
  const minStock = Number(formData.get("minStock") || 3);
  const maxStock = Number(formData.get("maxStock") || 12);
  const lowStockThreshold = Number(formData.get("lowStockThreshold") || 20);
  const headlineText = String(formData.get("headlineText") || "Hurry! Only {stock} items left in stock")
    .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, "")
    .trim();
  const subText = String(formData.get("subText") || "")
    .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, "")
    .trim();
  const accentColor = String(formData.get("accentColor") || "#D4AF37");
  const backgroundColor = String(formData.get("backgroundColor") || "#141414");
  const textColor = String(formData.get("textColor") || "#FFFFFF");
  const borderColor = String(formData.get("borderColor") || "#2d2d2d");
  const targetMode = String(formData.get("targetMode") || "ALL");
  const productIdsJson = String(formData.get("productIdsJson") || "[]");

  try {
    await prisma.productScarcityConfig.upsert({
      where: { shopId: shop.id },
      update: {
        active,
        designPreset,
        stockSource,
        minStock,
        maxStock,
        lowStockThreshold,
        headlineText,
        subText,
        accentColor,
        backgroundColor,
        textColor,
        borderColor,
        targetMode,
        productIdsJson,
      },
      create: {
        shopId: shop.id,
        active,
        designPreset,
        stockSource,
        minStock,
        maxStock,
        lowStockThreshold,
        headlineText,
        subText,
        accentColor,
        backgroundColor,
        textColor,
        borderColor,
        targetMode,
        productIdsJson,
      },
    });

    await prisma.shop.update({
      where: { id: shop.id },
      data: { productScarcityEnabled: active },
    });

    return { success: true, message: "Settings saved successfully." };
  } catch (err: any) {
    console.error("[Product Scarcity Action] Error saving config:", err);
    return { error: err?.message || "Failed to save settings." };
  }
};

export default function ProductScarcityPage() {
  const { shopDomain, config, products: initialProducts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";

  // Form State
  const [active, setActive] = useState(config.active);
  const [designPreset, setDesignPreset] = useState(config.designPreset);
  const [stockSource, setStockSource] = useState(config.stockSource);
  const [minStock, setMinStock] = useState(config.minStock);
  const [maxStock, setMaxStock] = useState(config.maxStock);
  const [lowStockThreshold, setLowStockThreshold] = useState(config.lowStockThreshold);
  const [headlineText, setHeadlineText] = useState(config.headlineText);
  const [subText, setSubText] = useState(config.subText || "");
  const [accentColor, setAccentColor] = useState(config.accentColor);
  const [backgroundColor, setBackgroundColor] = useState(config.backgroundColor);
  const [textColor, setTextColor] = useState(config.textColor);
  const [borderColor, setBorderColor] = useState(config.borderColor);
  const [targetMode, setTargetMode] = useState(config.targetMode);

  // Selected Target Products
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    try {
      return JSON.parse(config.productIdsJson || "[]");
    } catch {
      return [];
    }
  });

  // Live Catalog Search
  const [catalog, setCatalog] = useState<any[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

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
        console.error("Live search failed:", err);
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
    const idSet = new Set(selectedProductIds);
    return catalog.filter((p) => idSet.has(p.id));
  }, [catalog, selectedProductIds]);

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  // Preview Calculations & Continuous Live Viewers Simulation
  const previewStock = 6;
  const [previewViewers, setPreviewViewers] = useState(18);
  const [viewerPulse, setViewerPulse] = useState(false);

  useEffect(() => {
    let timeoutId: any;
    const tick = () => {
      const delay = Math.floor(Math.random() * 2400) + 3200;
      timeoutId = setTimeout(() => {
        setPreviewViewers((prev) => {
          const rand = Math.random();
          let delta = 1;
          if (prev <= 12) {
            delta = Math.floor(Math.random() * 2) + 1;
          } else if (prev >= 32) {
            delta = -(Math.floor(Math.random() * 2) + 1);
          } else {
            delta = rand > 0.45 ? (rand > 0.78 ? 2 : 1) : (rand < 0.22 ? -2 : -1);
          }
          return Math.max(10, Math.min(36, prev + delta));
        });
        setViewerPulse(true);
        setTimeout(() => setViewerPulse(false), 450);
        tick();
      }, delay);
    };
    tick();
    return () => clearTimeout(timeoutId);
  }, []);

  const previewHeadline = headlineText
    .replace(/{stock}/g, String(previewStock))
    .replace(/{viewers}/g, String(previewViewers));
  const previewSubtext = subText
    .replace(/{stock}/g, String(previewStock))
    .replace(/{viewers}/g, String(previewViewers));
  const previewPercent = Math.min(100, Math.max(10, Math.round((previewStock / maxStock) * 100)));

  return (
    <s-page heading="Product Stock & Scarcity Block">
      <style>{`
        .xpp-ps-admin {
          max-width: 1040px;
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
          font-size: 18px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 6px;
        }
        .xpp-card-desc {
          font-size: 13px;
          color: #d0d0d0;
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .xpp-live-preview-box {
          background: #0a0a0a;
          border: 2px dashed rgba(212, 175, 55, 0.35);
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 24px;
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
        .xpp-preset-name {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 4px;
        }
        .xpp-preset-desc {
          font-size: 12px;
          color: #d0d0d0;
          margin: 0;
        }
        .xpp-field-group {
          margin-bottom: 18px;
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
          color: #d0d0d0;
          margin-top: 4px;
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
        .xpp-row {
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .xpp-color-picker {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .xpp-color-picker input[type="color"] {
          width: 42px;
          height: 42px;
          border: 1px solid #444;
          border-radius: 8px;
          background: none;
          cursor: pointer;
          padding: 0;
        }
        .xpp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 800;
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
        .xpp-var-chip {
          display: inline-block;
          background: rgba(255, 215, 0, 0.15);
          border: 1px solid #D4AF37;
          color: #FFD700;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          margin-right: 8px;
          user-select: none;
        }
        .xpp-product-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
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
          margin-left: 4px;
        }
        .xpp-preview-num-pulse {
          animation: xpp-preview-pop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes xpp-preview-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.3); color: #FFD700; text-shadow: 0 0 8px rgba(255, 215, 0, 0.6); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div className="xpp-ps-admin">
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

        {/* Live Preview Box */}
        <div className="xpp-live-preview-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#FFD700", textTransform: "uppercase", letterSpacing: 1 }}>
              Real-Time Storefront Preview
            </span>
            <span style={{ fontSize: 12, color: "#888888" }}>
              Preset: {designPreset}
            </span>
          </div>

          <div
            style={{
              maxWidth: 520,
              margin: "0 auto",
              padding: 16,
              background: "#101010",
              borderRadius: 14,
              border: "1px solid #222",
            }}
          >
            {designPreset === "urgency_badge" && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: backgroundColor,
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 24,
                  padding: "8px 16px",
                  color: textColor,
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor }}></div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{previewHeadline}</span>
              </div>
            )}

            {designPreset === "luxury_card" && (
              <div
                style={{
                  background: backgroundColor,
                  border: `1px solid ${accentColor}`,
                  borderLeft: `4px solid ${accentColor}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: textColor,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{previewHeadline}</div>
                  {previewSubtext && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{previewSubtext}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", padding: "4px 12px", borderRadius: 16, fontSize: 12, fontWeight: 700, color: accentColor }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#22c55e",
                      display: "inline-block",
                      boxShadow: "0 0 6px #22c55e",
                      flexShrink: 0,
                    }}
                  />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>
                    <span
                      className={viewerPulse ? "xpp-preview-num-pulse" : ""}
                      style={{ display: "inline-block", fontVariantNumeric: "tabular-nums", transition: "transform 0.2s ease" }}
                    >
                      {previewViewers}
                    </span>{" "}
                    viewing
                  </span>
                </div>
              </div>
            )}

            {designPreset === "flash_demand" && (
              <div
                style={{
                  background: backgroundColor,
                  border: `1.5px solid ${borderColor}`,
                  borderLeft: `4px solid ${accentColor}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  color: textColor,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ background: accentColor, color: "#000", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 4 }}>
                    HIGH DEMAND
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{previewHeadline}</span>
                </div>
                {previewSubtext && <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>{previewSubtext}</div>}
                <div style={{ width: "100%", height: 7, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${previewPercent}%`, height: "100%", background: accentColor, borderRadius: 4 }}></div>
                </div>
              </div>
            )}

            {designPreset === "pulse_meter" && (
              <div
                style={{
                  background: backgroundColor,
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 12,
                  padding: "14px 18px",
                  color: textColor,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: accentColor, display: "inline-flex", alignItems: "center" }}>
                    <svg viewBox="0 0 1200 1200" width="18" height="18" fill="currentColor">
                      <path d="M 381.63997,1200 C 135.77919,1061.434 71.049038,930.27865 108.05732,751.14866 135.37841,618.87726 224.83888,511.26304 233.417,379.24524 271.63184,448.78945 287.59935,498.9368 291.87036,571.60898 413.41348,422.69507 493.73121,216.54632 498.48692,0 c 0,0 316.57523,186.01008 337.34836,466.98023 27.25312,-57.91289 40.97132,-149.89172 13.7182,-209.5043 C 931.31098,317.09086 1409.8464,846.31428 784.73519,1200 902.263,971.16186 815.05535,662.38827 610.99652,519.78234 624.62426,581.10164 600.73114,809.80288 510.45434,910.29655 535.46754,742.38092 486.6538,671.37843 486.6538,671.37843 c 0,0 -16.75337,94.05444 -81.7575,189.06609 C 345.53708,947.20639 304.40709,1039.2914 381.64021,1200 z" />
                    </svg>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{previewHeadline}</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${previewPercent}%`, height: "100%", background: `linear-gradient(90deg, #ff5252 0%, ${accentColor} 100%)`, borderRadius: 4 }}></div>
                </div>
                {previewSubtext && <div style={{ fontSize: 12, opacity: 0.85 }}>{previewSubtext}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Theme Customizer Quick Link Card */}
        <div className="xpp-card" style={{ border: "1.5px solid rgba(212, 175, 55, 0.4)", background: "linear-gradient(135deg, #18150f 0%, #141414 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 className="xpp-card-title">How to Place this Block on Your Store</h2>
              <p className="xpp-card-desc" style={{ margin: 0 }}>
                This is a native Shopify <strong>Product Information Block</strong>. Open your Theme Editor, go to any Product template, click <strong>"Add block"</strong> under Product information, and select <strong>"XPoost: Product Scarcity"</strong>.
              </p>
            </div>
            <a
              href={`https://${shopDomain}/admin/themes/current/editor?template=product`}
              target="_blank"
              rel="noreferrer"
              className="xpp-btn xpp-btn--primary"
            >
              Open Theme Editor &rarr;
            </a>
          </div>
        </div>

        <Form method="post">
          <input type="hidden" name="designPreset" value={designPreset} />
          <input type="hidden" name="stockSource" value={stockSource} />
          <input type="hidden" name="targetMode" value={targetMode} />
          <input type="hidden" name="productIdsJson" value={JSON.stringify(selectedProductIds)} />

          {/* Master Enable Card */}
          <div className="xpp-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="xpp-card-title">Feature Activation</h2>
                <p className="xpp-card-desc" style={{ margin: 0 }}>
                  Enable or disable the Product Scarcity block globally across your store.
                </p>
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  name="active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: "pointer" }}
                />
                {active ? "Active" : "Disabled"}
              </label>
            </div>
          </div>

          {/* 1. Design Presets */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">1. Choose a Design Layout</h2>
            <p className="xpp-card-desc">
              Select the visual style that matches your brand and conversion strategy.
            </p>

            <div className="xpp-preset-grid">
              <div
                className={`xpp-preset-card ${designPreset === "pulse_meter" ? "xpp-preset-card--active" : ""}`}
                onClick={() => setDesignPreset("pulse_meter")}
              >
                <div className="xpp-preset-name">Fire Pulse & Meter</div>
                <p className="xpp-preset-desc">Animated gradient progress bar with flickering flame icon.</p>
              </div>

              <div
                className={`xpp-preset-card ${designPreset === "urgency_badge" ? "xpp-preset-card--active" : ""}`}
                onClick={() => setDesignPreset("urgency_badge")}
              >
                <div className="xpp-preset-name">Live Radar Pill</div>
                <p className="xpp-preset-desc">Compact badge with a pulsing radar beacon dot.</p>
              </div>

              <div
                className={`xpp-preset-card ${designPreset === "luxury_card" ? "xpp-preset-card--active" : ""}`}
                onClick={() => setDesignPreset("luxury_card")}
              >
                <div className="xpp-preset-name">Luxury Minimalist Box</div>
                <p className="xpp-preset-desc">Framed gold accent card showing stock and live viewers.</p>
              </div>

              <div
                className={`xpp-preset-card ${designPreset === "flash_demand" ? "xpp-preset-card--active" : ""}`}
                onClick={() => setDesignPreset("flash_demand")}
              >
                <div className="xpp-preset-name">Flash Warehouse Banner</div>
                <p className="xpp-preset-desc">High-urgency warehouse stock level bar with demand tag.</p>
              </div>
            </div>
          </div>

          {/* 2. Stock Source & Quantity Logic */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">2. Stock & Quantity Logic</h2>
            <p className="xpp-card-desc">
              Choose whether to display actual Shopify inventory or a simulated low-stock range.
            </p>

            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <label
                style={{
                  flex: 1,
                  background: stockSource === "shopify" ? "#1e1b12" : "#1a1a1a",
                  border: `2px solid ${stockSource === "shopify" ? "#D4AF37" : "#333"}`,
                  borderRadius: 10,
                  padding: 14,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="_stockSourceRadio"
                  checked={stockSource === "shopify"}
                  onChange={() => setStockSource("shopify")}
                  style={{ marginRight: 8 }}
                />
                <span style={{ fontWeight: 800, color: "#fff" }}>Real Shopify Inventory</span>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#aaa" }}>
                  Reads the actual inventory quantity of the product or selected variant.
                </p>
              </label>

              <label
                style={{
                  flex: 1,
                  background: stockSource === "manual_range" ? "#1e1b12" : "#1a1a1a",
                  border: `2px solid ${stockSource === "manual_range" ? "#D4AF37" : "#333"}`,
                  borderRadius: 10,
                  padding: 14,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="_stockSourceRadio"
                  checked={stockSource === "manual_range"}
                  onChange={() => setStockSource("manual_range")}
                  style={{ marginRight: 8 }}
                />
                <span style={{ fontWeight: 800, color: "#fff" }}>Simulated Stock Range</span>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#aaa" }}>
                  Generates an enticing low quantity (e.g. between 3 and 12) per product.
                </p>
              </label>
            </div>

            {stockSource === "shopify" ? (
              <div className="xpp-field-group">
                <label className="xpp-label">Low Stock Cutoff Threshold</label>
                <input
                  type="number"
                  name="lowStockThreshold"
                  className="xpp-input"
                  style={{ maxWidth: 200 }}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                />
                <div className="xpp-hint">
                  Only show the scarcity block when Shopify inventory is at or below this number. Set to 0 to show for all inventory quantities.
                </div>
              </div>
            ) : (
              <div className="xpp-row">
                <div className="xpp-field-group" style={{ flex: 1 }}>
                  <label className="xpp-label">Minimum Stock (Min)</label>
                  <input
                    type="number"
                    name="minStock"
                    className="xpp-input"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                  />
                </div>
                <div className="xpp-field-group" style={{ flex: 1 }}>
                  <label className="xpp-label">Maximum Stock (Max)</label>
                  <input
                    type="number"
                    name="maxStock"
                    className="xpp-input"
                    value={maxStock}
                    onChange={(e) => setMaxStock(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Text & Copy */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">3. Copy & Translations</h2>
            <p className="xpp-card-desc">
              Customize the message shown to visitors. Click any variable chip to insert dynamic placeholders.
            </p>

            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: "#888888", marginRight: 8 }}>Available Variables:</span>
              <span
                className="xpp-var-chip"
                onClick={() => setHeadlineText((prev) => `${prev} {stock}`)}
              >
                + &#123;stock&#125;
              </span>
              <span
                className="xpp-var-chip"
                onClick={() => setHeadlineText((prev) => `${prev} {viewers}`)}
              >
                + &#123;viewers&#125;
              </span>
            </div>

            <div className="xpp-field-group">
              <label className="xpp-label">Headline Template</label>
              <input
                type="text"
                name="headlineText"
                className="xpp-input"
                value={headlineText}
                onChange={(e) => setHeadlineText(e.target.value)}
              />
            </div>

            <div className="xpp-field-group">
              <label className="xpp-label">Subtitle / Reassurance Note</label>
              <input
                type="text"
                name="subText"
                className="xpp-input"
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
              />
            </div>
          </div>

          {/* 4. Product Targeting */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">4. Product Inclusion & Exclusion Filters</h2>
            <p className="xpp-card-desc">
              Control exactly which products display this scarcity block.
            </p>

            <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
              {[
                { key: "ALL", label: "All Products", desc: "Show on every product page" },
                { key: "SPECIFIC", label: "Specific Products Only", desc: "Only show on chosen items" },
                { key: "EXCLUDE", label: "Exclude Specific Products", desc: "Show on all except chosen items" },
              ].map((m) => (
                <label
                  key={m.key}
                  style={{
                    flex: 1,
                    background: targetMode === m.key ? "#1e1b12" : "#1a1a1a",
                    border: `2px solid ${targetMode === m.key ? "#D4AF37" : "#333"}`,
                    borderRadius: 8,
                    padding: 12,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="_targetModeRadio"
                    checked={targetMode === m.key}
                    onChange={() => setTargetMode(m.key)}
                    style={{ marginRight: 6 }}
                  />
                  <strong style={{ color: "#fff", fontSize: 13 }}>{m.label}</strong>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{m.desc}</div>
                </label>
              ))}
            </div>

            {targetMode !== "ALL" && (
              <div>
                <label className="xpp-label">
                  Search & Select Products {targetMode === "EXCLUDE" ? "to Exclude" : "to Target"}
                </label>
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <input
                    type="text"
                    className="xpp-input"
                    placeholder="Search by title or keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {isSearching && (
                    <span style={{ position: "absolute", right: 12, top: 10, fontSize: 12, color: "#D4AF37" }}>
                      Searching store...
                    </span>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {filteredSearchResults.length > 0 && (
                  <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, maxHeight: 180, overflowY: "auto", marginBottom: 14 }}>
                    {filteredSearchResults.map((prod) => {
                      const isSelected = selectedProductIds.includes(prod.id);
                      return (
                        <div
                          key={prod.id}
                          onClick={() => toggleProductSelection(prod.id)}
                          style={{
                            padding: "8px 12px",
                            borderBottom: "1px solid #282828",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            background: isSelected ? "rgba(212, 175, 55, 0.12)" : "transparent",
                          }}
                        >
                          <span style={{ fontSize: 13, color: "#fff" }}>{prod.title}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "#4ade80" : "#D4AF37" }}>
                            {isSelected ? "Selected ✓" : "+ Add"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Products Badges */}
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: "#888888", display: "block", marginBottom: 6 }}>
                    Currently Selected ({selectedProductIds.length}):
                  </span>
                  {selectedProductsList.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap" }}>
                      {selectedProductsList.map((p) => (
                        <div key={p.id} className="xpp-product-chip">
                          <span>{p.title}</span>
                          <button type="button" onClick={() => toggleProductSelection(p.id)}>
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "#666" }}>No products selected yet. Search above to add products.</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 5. Colors & Styling */}
          <div className="xpp-card">
            <h2 className="xpp-card-title">5. Colors & Appearance</h2>
            <p className="xpp-card-desc">
              Match the scarcity badge colors to your theme.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <div className="xpp-field-group">
                <label className="xpp-label">Accent / Highlight</label>
                <div className="xpp-color-picker">
                  <input
                    type="color"
                    name="accentColor"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                  <span style={{ fontSize: 13, fontFamily: "monospace" }}>{accentColor}</span>
                </div>
              </div>

              <div className="xpp-field-group">
                <label className="xpp-label">Card Background</label>
                <div className="xpp-color-picker">
                  <input
                    type="color"
                    name="backgroundColor"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                  />
                  <span style={{ fontSize: 13, fontFamily: "monospace" }}>{backgroundColor}</span>
                </div>
              </div>

              <div className="xpp-field-group">
                <label className="xpp-label">Text Color</label>
                <div className="xpp-color-picker">
                  <input
                    type="color"
                    name="textColor"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                  />
                  <span style={{ fontSize: 13, fontFamily: "monospace" }}>{textColor}</span>
                </div>
              </div>

              <div className="xpp-field-group">
                <label className="xpp-label">Border Color</label>
                <div className="xpp-color-picker">
                  <input
                    type="color"
                    name="borderColor"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                  />
                  <span style={{ fontSize: 13, fontFamily: "monospace" }}>{borderColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div style={{ position: "sticky", bottom: 16, zIndex: 10, background: "rgba(10,10,10,0.85)", backdropFilter: "blur(10px)", padding: 14, borderRadius: 10, border: "1px solid #333", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="xpp-btn xpp-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving Changes..." : "Save Configuration"}
            </button>
          </div>
        </Form>
      </div>
    </s-page>
  );
}
