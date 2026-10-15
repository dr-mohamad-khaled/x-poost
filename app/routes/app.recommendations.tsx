import { Translate, useTranslations } from "../components/Translate";
import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { appCredentials, authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { dayToDate, localDay } from "../utils/analytics";
import { BUNDLES_DISCOUNT_TITLE, syncAllDiscounts } from "../bundles.server";
import { BB_CSS } from "../components/bb/styles";
import { CollectionPicker, ColorField, ProductPicker, RefPicker } from "../components/bb/BundleParts";
import { ColorPresets } from "../components/ColorPresets";
import { RcSchematic, RecsPreview } from "../components/rk/RkParts";
import { BB_LANGS, BB_LANG_META, formatMoney, numericId, type BbLang } from "../utils/bundles";
import {
  RC_DEFAULT_STYLE,
  RC_DEFAULT_TEXTS,
  RC_DESIGNS,
  RC_DESIGN_META,
  RC_MAIN_TEXTS,
  RC_MAX_COUNT,
  RC_MAX_PRODUCTS,
  RC_OFFER_MODES,
  RC_PLACEMENTS,
  RC_PLACEMENT_META,
  RC_SOURCES,
  RC_SOURCE_META,
  RC_TEXT_KEYS,
  RC_TEXT_META,
  describeOffer,
  parseRecs,
  resolveRcTexts,
  sanitizeRcConfig,
  sanitizeRcStyle,
  sanitizeRcTexts,
  validateRc,
  type RcConfig,
  type RcStyle,
  type RcTextKey,
  type RcTextsByLang,
} from "../utils/recs";

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────

const tail = (g: string) => String(g || "").split("/").pop() || "";
const cents = (v: unknown) => Math.round((Number(v) || 0) * 100);
const PRODUCT_FIELDS = `
  id handle title status
  featuredImage { url }
  variants(first: 30) { nodes { id title price compareAtPrice availableForSale image { url } } }
  rating: metafield(namespace: "reviews", key: "rating") { value }
  ratingCount: metafield(namespace: "reviews", key: "rating_count") { value }
`;
function shape(p: any) {
  const variants = (p?.variants?.nodes || []).map((v: any) => ({
    id: tail(v.id),
    title: v.title === "Default Title" ? "" : v.title,
    price: cents(v.price),
    compare: cents(v.compareAtPrice),
    available: !!v.availableForSale,
    image: v.image?.url || "",
  }));
  let rating = 0;
  try {
    const j = JSON.parse(p?.rating?.value || "null");
    rating = j ? Math.round((Number(j.value) / (Number(j.scale_max) || 5)) * 50) / 10 : 0;
  } catch {
    rating = 0;
  }
  return {
    __n: 1,
    id: tail(p.id),
    handle: p.handle,
    title: p.title,
    url: "#",
    image: p.featuredImage?.url || "",
    available: variants.some((v: any) => v.available),
    variants,
    rating: rating > 0 ? { r: rating, n: Number(p?.ratingCount?.value) || 0 } : null,
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const recs = parseRecs(shop.recsJson, shop.recsEnabled);

  let currency = shop.analyticsCurrency || "USD";
  let tz = shop.analyticsTimezone || "UTC";
  let moneyFormat = "";
  let discountStatus: "active" | "inactive" | "missing" = "missing";
  let samples: any[] = [];
  try {
    const res = await admin.graphql(`#graphql
      query XpRecsMeta {
        shop { currencyCode ianaTimezone currencyFormats { moneyFormat } }
        discountNodes(first: 100, query: "type:app") { nodes { discount { __typename ... on DiscountAutomaticApp { title status } } } }
        products(first: 8, query: "status:active", sortKey: UPDATED_AT, reverse: true) { nodes { ${PRODUCT_FIELDS} } }
      }`);
    const j: any = await res.json();
    currency = j?.data?.shop?.currencyCode || currency;
    tz = j?.data?.shop?.ianaTimezone || tz;
    moneyFormat = j?.data?.shop?.currencyFormats?.moneyFormat || "";
    const d = (j?.data?.discountNodes?.nodes || []).find((n: any) => n?.discount?.title === BUNDLES_DISCOUNT_TITLE);
    discountStatus = !d ? "missing" : d.discount.status === "ACTIVE" ? "active" : "inactive";
    samples = (j?.data?.products?.nodes || []).map(shape);
  } catch {
    /* defaults */
  }

  const since = dayToDate(localDay(Date.now() - 30 * 86_400_000, tz));
  const [stat, orders] = await Promise.all([
    prisma.xpDailyStat.aggregate({
      where: { shopId: shop.id, feature: "recommendations", day: { gte: since } },
      _sum: { impressions: true, clicks: true, actions: true },
    }),
    prisma.xpOrder.findMany({
      where: { shopId: shop.id, day: { gte: since }, cancelled: false, sourcesJson: { contains: '"recommendations"' } },
      select: { sourcesJson: true },
      take: 3000,
    }),
  ]);
  let revenue = 0;
  let orderCount = 0;
  for (const o of orders) {
    try {
      let hit = false;
      for (const src of JSON.parse(o.sourcesJson || "[]")) {
        if (src.f !== "recommendations") continue;
        revenue += Number(src.rev) || 0;
        hit = true;
      }
      if (hit) orderCount += 1;
    } catch {
      /* skip */
    }
  }

  const handle = session.shop.replace(".myshopify.com", "");
  const apiKey = String(appCredentials?.apiKey || "").trim();
  return {
    enabled: shop.recsEnabled,
    recs,
    currency,
    moneyFormat,
    discountStatus,
    samples,
    stats: { views: stat._sum.impressions || 0, clicks: stat._sum.clicks || 0, adds: stat._sum.actions || 0, orders: orderCount, revenue },
    themeEditorUrl: `https://admin.shopify.com/store/${handle}/themes/current/editor?template=product${apiKey ? `&addAppBlockId=${apiKey}/product-recommendations&target=mainSection` : ""}`,
  };
};

type LoaderData = Awaited<ReturnType<typeof loader>>;

// ─────────────────────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "toggleFeature") {
    const enable = form.get("enable") === "true";
    if (enable) {
      const errs = validateRc(parseRecs(shop.recsJson, true).config);
      if (errs.length) return { ok: false, message: "Fix these before turning it on: " + errs.join(" ") };
    }
    await prisma.shop.update({ where: { id: shop.id }, data: { recsEnabled: enable } });
    const s = await syncAllDiscounts(admin, shop.id);
    return { ok: s.state !== "error", message: (enable ? "Product Recommendations is on." : "Product Recommendations is off.") + " " + s.message };
  }

  if (intent === "save") {
    let raw: any = {};
    try {
      raw = JSON.parse(String(form.get("payload") || "{}"));
    } catch {
      return { ok: false, message: "Couldn't read the form. Please try again." };
    }
    const config = sanitizeRcConfig(raw.config);
    const errors = validateRc(config);
    let enabled = !!raw.enabled;
    let note = "";
    if (errors.length && enabled) {
      enabled = false;
      note = " Saved as off until these are fixed.";
    }
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        recsEnabled: enabled,
        recsJson: JSON.stringify({ config, style: sanitizeRcStyle(raw.style), texts: sanitizeRcTexts(raw.texts) }),
      },
    });
    const s = await syncAllDiscounts(admin, shop.id);
    return { ok: !errors.length, errors, message: "Saved." + note + (s.message ? " " + s.message : "") };
  }
  return { ok: false, message: "Unknown action." };
};

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

type Draft = { enabled: boolean; config: RcConfig; style: RcStyle; texts: RcTextsByLang };

function Section({ n, title, desc, children }: { n: number; title: string; desc?: string; children: React.ReactNode }) {
  const { t } = useTranslations();
  return (
    <div className="bb-card">
      <h3 className="bb-title"><span className="n">{n}</span>{t(title)}</h3>
      {desc ? <p className="bb-desc">{t(desc)}</p> : null}
      {children}
    </div>
  );
}

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "–");

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const { t, locale } = useTranslations();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const res = fetcher.data as any;
  const money = (n: number) => formatMoney(n, data.currency);

  const [d, setD] = useState<Draft>(() => ({ enabled: data.enabled, config: data.recs.config, style: data.recs.style, texts: data.recs.texts }));
  const [dirty, setDirty] = useState(false);
  const [lang, setLang] = useState<BbLang>(() => ((BB_LANGS as readonly string[]).includes(locale) ? (locale as BbLang) : "en"));
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [picked, setPicked] = useState<Record<string, any>>({});

  useEffect(() => {
    if (res && fetcher.state === "idle") setDirty(false);
  }, [res, fetcher.state]);
  useEffect(() => {
    setD((x) => ({ ...x, enabled: data.enabled }));
  }, [data.enabled]);

  const set = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const c = d.config;
  const setC = (patch: Partial<RcConfig>) => set({ config: { ...c, ...patch } });
  const setS = (patch: Partial<RcStyle>) => set({ style: { ...d.style, ...patch } });
  const texts = d.texts[lang] || {};
  const setText = (k: RcTextKey, v: string) => set({ texts: { ...d.texts, [lang]: { ...texts, [k]: v } } });
  const defaults = RC_DEFAULT_TEXTS[lang];

  // Real data for picked products in the preview
  const ids = useMemo(() => c.products.map((p) => numericId(p.id)).sort().join(","), [c.products]);
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    const id = setTimeout(() => {
      fetch(`/api/bundles/preview?products=${ids}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => alive && j && setPicked(j.products || {}))
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [ids]);

  const payload = useMemo(() => {
    let list: any[] = [];
    if (c.source === "manual") {
      list = c.products.map((p) => {
        const real = picked[numericId(p.id)];
        if (real) return { ...real, __n: 1, url: "#" };
        const pc = Math.round(Number(p.price || 0) * 100);
        return { __n: 1, id: numericId(p.id), handle: p.handle, title: p.title, url: "#", image: p.imageUrl, available: true, variants: [{ id: numericId(p.variantId || p.id), title: "", price: pc, compare: 0, available: true, image: "" }] };
      });
    } else list = data.samples.slice(1);
    if (!list.length) list = data.samples;
    list = list.slice(0, c.count);
    const ratings: Record<string, any> = {};
    for (const s of data.samples) if (s.rating) ratings[s.id] = s.rating;
    return {
      rec: { ...c, texts: resolveRcTexts(d.texts, lang), style: d.style },
      products: list,
      ratings,
    };
  }, [c, d.texts, d.style, lang, picked, data.samples]);

  const errors = validateRc(c);
  const save = () => fetcher.submit({ intent: "save", payload: JSON.stringify(d) }, { method: "post" });
  const s = data.stats;

  return (
    <s-page heading={t("Product Recommendations")}>
      <style>{BB_CSS}</style>
      <div className="bb-wrap">
        <div className="bb-topbar">
          <div className="bb-inline">
            <label className="bb-switch">
              <input type="checkbox" checked={d.enabled} disabled={busy} onChange={(e) => (dirty ? set({ enabled: e.target.checked }) : fetcher.submit({ intent: "toggleFeature", enable: String(e.target.checked) }, { method: "post" }))} />
              <span className="knob" />
              <b>{d.enabled ? t("On") : t("Off")}</b>
            </label>
          </div>
          <div className="bb-topbar-r">
            {res?.message && !busy ? <span className={`bb-flash ${res.ok === false ? "bad" : "ok"}`}>{t(res.message)}</span> : dirty ? <span className="bb-flash"><Translate text="Unsaved changes" /></span> : null}
            <button className="bb-btn gold" disabled={busy} onClick={save}>{busy ? t("Saving…") : t("Save")}</button>
          </div>
        </div>

        {res?.errors?.length ? (
          <div className="bb-banner bad">
            <Translate text="Please fix:" />
            <ul>{res.errors.map((e: string) => <li key={e}>{t(e)}</li>)}</ul>
          </div>
        ) : null}

        <div className="bb-card bb-hero">
          <div>
            <h2><Translate text="Show the right products next to the one they're viewing" /></h2>
            <p><Translate text="Use Shopify's own recommendations, your picks or a collection. Shoppers add them with one click, and an optional offer price is checked again at checkout." /></p>
          </div>
        </div>

        {data.enabled && c.offer.mode !== "none" && data.discountStatus !== "active" ? (
          <div className="bb-banner warn">
            <Translate text="The checkout discount “XPoost Bundles” isn't active yet. Save this page to create it. If it still doesn't activate, run npm run deploy so the pricing engine is installed." />
          </div>
        ) : null}

        <div className="bb-card">
          <h3 className="bb-title"><Translate text="Set up in 2 steps" /></h3>
          <ol className="bb-steps">
            <li>
              <b><Translate text="Add the block to your product page." /></b>{" "}
              <a href={data.themeEditorUrl} target="_top"><Translate text="Open the theme editor (product template) →" /></a>{" "}
              <Translate text="Drag “XPoost: Recommendations” above the product description and save." />
            </li>
            <li>
              <b><Translate text="Choose the products and design below, switch it on, and save." /></b>
            </li>
          </ol>
          <div className="bb-grid4" style={{ marginTop: 12 }}>
            <div className="bb-stat-box"><span><Translate text="Views" /></span><b>{s.views.toLocaleString()}</b></div>
            <div className="bb-stat-box"><span><Translate text="Add-to-cart rate" /></span><b>{s.views >= 50 ? pct(s.adds, s.views) : "–"}</b></div>
            <div className="bb-stat-box"><span><Translate text="Orders" /></span><b>{s.orders || "–"}</b></div>
            <div className="bb-stat-box"><span><Translate text="Revenue" /></span><b>{s.revenue ? money(s.revenue) : "–"}</b></div>
          </div>
          <p className="bb-hint"><Translate text="Last 30 days. Revenue is what shoppers paid for products they added from this block." /></p>
        </div>

        <div className="bb-layout">
          <div className="bb-main">
            <Section n={1} title="Products to recommend">
              <div className="bb-cards" style={{ marginBottom: 14 }}>
                {RC_SOURCES.map((src) => (
                  <button key={src} type="button" className={`bb-choice${c.source === src ? " on" : ""}`} onClick={() => setC({ source: src })}>
                    <b>{t(RC_SOURCE_META[src].name)}</b>
                    <span>{t(RC_SOURCE_META[src].blurb)}</span>
                  </button>
                ))}
              </div>
              {c.source === "collection" ? (
                <div className="bb-field">
                  <label><Translate text="Collection" /></label>
                  <CollectionPicker value={c.collection ? [c.collection] : []} max={1} onChange={(list) => setC({ collection: list[0] || null })} />
                </div>
              ) : (
                <div className="bb-field">
                  <label>{c.source === "manual" ? t("Products") : t("Backup products (optional)")}</label>
                  <ProductPicker value={c.products} max={RC_MAX_PRODUCTS} onChange={(products) => setC({ products })} />
                  {c.source !== "manual" ? <small><Translate text="Shown when Shopify has no recommendations for a product yet, for example a new product." /></small> : null}
                </div>
              )}
              <div className="bb-inline" style={{ margin: "6px 0 12px" }}>
                <span className="bb-label"><Translate text="Products to show" /></span>
                <input className="bb-input xs" type="number" min={1} max={RC_MAX_COUNT} value={c.count} onChange={(e) => setC({ count: Math.max(1, Math.min(RC_MAX_COUNT, Number(e.target.value) || 1)) })} aria-label={t("Products to show")} />
                <span className="bb-muted bb-sm"><Translate text="We recommend 3. You can show up to 8." /></span>
              </div>
              <label className="bb-check">
                <input type="checkbox" checked={c.shuffle} onChange={(e) => setC({ shuffle: e.target.checked })} />
                <span><Translate text="Show them in a random order on every page load" /><small><Translate text="Picks a different mix from the available products each time." /></small></span>
              </label>
              <label className="bb-check">
                <input type="checkbox" checked={c.hideInCart} onChange={(e) => setC({ hideInCart: e.target.checked })} />
                <span><Translate text="Skip products that are already in the cart" /></span>
              </label>
              <label className="bb-check">
                <input type="checkbox" checked={c.hideSoldOut} onChange={(e) => setC({ hideSoldOut: e.target.checked })} />
                <span><Translate text="Skip sold-out products" /></span>
              </label>
            </Section>

            <Section n={2} title="Offer (optional)" desc="Give a price on each recommended product. It applies at checkout when the product on the page is in the cart too.">
              <div className="bb-seg" style={{ marginBottom: 12 }}>
                {RC_OFFER_MODES.map((m) => (
                  <button key={m} type="button" className={c.offer.mode === m ? "on" : ""} onClick={() => setC({ offer: { ...c.offer, mode: m, value: m === "percent" ? Math.min(100, c.offer.value || 10) : c.offer.value } })}>
                    {m === "none" ? t("No offer") : m === "percent" ? t("Percentage off") : t("Amount off")}
                  </button>
                ))}
              </div>
              {c.offer.mode !== "none" ? (
                <div className="bb-inline">
                  <span className="bb-label">{c.offer.mode === "percent" ? t("Percentage off each product") : t("Amount off each product")}</span>
                  <input className="bb-input sm" type="number" min={0} max={c.offer.mode === "percent" ? 100 : undefined} step="0.01" value={c.offer.value} onChange={(e) => setC({ offer: { ...c.offer, value: Number(e.target.value) || 0 } })} />
                  <span className="bb-muted">{c.offer.mode === "percent" ? "%" : data.currency}</span>
                </div>
              ) : null}
              {c.offer.mode === "amount" ? <p className="bb-hint"><Translate text="Amounts are in your store currency. In other currencies they're converted at Shopify's rate." /></p> : null}
            </Section>

            <Section n={3} title="Design" desc="Six compact designs. Every design uses your colors and the shopper's language.">
              <div className="bb-design-grid" style={{ marginBottom: 16 }}>
                {RC_DESIGNS.map((ds) => (
                  <button key={ds} type="button" className={`bb-design${c.design === ds ? " on" : ""}`} onClick={() => setC({ design: ds })}>
                    <RcSchematic design={ds} />
                    <span className="bb-design-name">{t(RC_DESIGN_META[ds].name)}</span>
                    <span className="bb-design-blurb">{t(RC_DESIGN_META[ds].blurb)}</span>
                  </button>
                ))}
              </div>
              <div className="bb-grid2">
                <div>
                  <label className="bb-check">
                    <input type="checkbox" checked={c.showRating} onChange={(e) => setC({ showRating: e.target.checked })} />
                    <span><Translate text="Show star ratings" /><small><Translate text="Read from your reviews app (the standard product rating field). Products without reviews show no stars." /></small></span>
                  </label>
                  <label className="bb-check">
                    <input type="checkbox" checked={c.showCompare} onChange={(e) => setC({ showCompare: e.target.checked })} />
                    <span><Translate text="Show compare-at prices" /></span>
                  </label>
                  <label className="bb-check">
                    <input type="checkbox" checked={c.showVariants} onChange={(e) => setC({ showVariants: e.target.checked })} />
                    <span><Translate text="Let shoppers choose the variant" /></span>
                  </label>
                  <label className="bb-check">
                    <input type="checkbox" checked={c.showQty} onChange={(e) => setC({ showQty: e.target.checked })} />
                    <span><Translate text="Show a quantity selector" /><small><Translate text="Used by Product cards and Compact rows." /></small></span>
                  </label>
                </div>
                <div className="bb-field">
                  <label htmlFor="rc-after"><Translate text="After “Add”" /></label>
                  <select id="rc-after" className="bb-input" value={c.afterAdd} onChange={(e) => setC({ afterAdd: e.target.value as any })}>
                    <option value="drawer">{t("Open the cart drawer")}</option>
                    <option value="stay">{t("Stay on the page and show “Added”")}</option>
                    <option value="cart">{t("Go to the cart page")}</option>
                  </select>
                </div>
              </div>
            </Section>

            <Section n={4} title="Where it shows" desc="The block must be on the product page (see the setup steps). This decides which product pages show it.">
              <div className="bb-cards" style={{ marginBottom: 12 }}>
                {RC_PLACEMENTS.map((m) => (
                  <button key={m} type="button" className={`bb-choice${c.placement.mode === m ? " on" : ""}`} onClick={() => setC({ placement: { ...c.placement, mode: m } })}>
                    <b>{t(RC_PLACEMENT_META[m].name)}</b>
                    <span>{t(RC_PLACEMENT_META[m].blurb)}</span>
                  </button>
                ))}
              </div>
              {c.placement.mode === "products" || c.placement.mode === "exclude" ? (
                <div className="bb-field">
                  <label>{c.placement.mode === "exclude" ? t("Don't show on these products") : t("Products")}</label>
                  <RefPicker kind="products" value={c.placement.products} onChange={(products) => setC({ placement: { ...c.placement, products } })} />
                </div>
              ) : null}
              {c.placement.mode === "collections" || c.placement.mode === "exclude" ? (
                <div className="bb-field">
                  <label>{c.placement.mode === "exclude" ? t("Don't show on products in these collections") : t("Collections")}</label>
                  <RefPicker kind="collections" value={c.placement.collections} onChange={(collections) => setC({ placement: { ...c.placement, collections } })} />
                </div>
              ) : null}
              <div className="bb-field" style={{ marginTop: 12 }}>
                <label><Translate text="Devices" /></label>
                <div className="bb-seg sm">
                  {(["all", "desktop", "mobile"] as const).map((m) => (
                    <button key={m} type="button" className={c.placement.device === m ? "on" : ""} onClick={() => setC({ placement: { ...c.placement, device: m } })}>
                      {m === "all" ? t("All devices") : m === "desktop" ? t("Desktop only") : t("Mobile only")}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            <Section n={5} title="Colors & style" desc="Defaults are neutral so the block fits any theme. Match them to your brand.">
              <ColorPresets onApply={(p) => setS({ bg: p.bg, text: p.text, border: p.border, accent: p.accent, btnBg: p.accent, btnText: p.onAccent, muted: p.text === "#FFFFFF" ? "#BDBDBD" : "#5C5C5C" })} />
              <div className="bb-colors">
                <ColorField label={t("Background")} value={d.style.bg} onChange={(v) => setS({ bg: v })} />
                <ColorField label={t("Text")} value={d.style.text} onChange={(v) => setS({ text: v })} />
                <ColorField label={t("Secondary text")} value={d.style.muted} onChange={(v) => setS({ muted: v })} />
                <ColorField label={t("Borders")} value={d.style.border} onChange={(v) => setS({ border: v })} />
                <ColorField label={t("Highlight")} value={d.style.accent} onChange={(v) => setS({ accent: v })} />
                <ColorField label={t("Button")} value={d.style.btnBg} onChange={(v) => setS({ btnBg: v })} />
                <ColorField label={t("Button text")} value={d.style.btnText} onChange={(v) => setS({ btnText: v })} />
                <ColorField label={t("Offer badge")} value={d.style.badgeBg} onChange={(v) => setS({ badgeBg: v })} />
                <ColorField label={t("Offer badge text")} value={d.style.badgeText} onChange={(v) => setS({ badgeText: v })} />
                <ColorField label={t("Stars")} value={d.style.star} onChange={(v) => setS({ star: v })} />
              </div>
              <div className="bb-grid2" style={{ marginTop: 14 }}>
                <div className="bb-field">
                  <label htmlFor="rc-rad"><Translate text="Corner radius" /> ({d.style.radius}px)</label>
                  <input id="rc-rad" type="range" min={0} max={28} value={d.style.radius} onChange={(e) => setS({ radius: Number(e.target.value) })} />
                </div>
                <div className="bb-field">
                  <label htmlFor="rc-ratio"><Translate text="Image shape" /></label>
                  <select id="rc-ratio" className="bb-input" value={d.style.imageRatio} onChange={(e) => setS({ imageRatio: e.target.value as any })}>
                    <option value="square">{t("Square")}</option>
                    <option value="portrait">{t("Portrait (4:5)")}</option>
                    <option value="natural">{t("Original")}</option>
                  </select>
                </div>
              </div>
              <label className="bb-check">
                <input type="checkbox" checked={d.style.font === "system"} onChange={(e) => setS({ font: e.target.checked ? "system" : "theme" })} />
                <span><Translate text="Use a system font instead of the theme font" /></span>
              </label>
              <details className="bb-details">
                <summary><Translate text="Custom CSS" /></summary>
                <textarea className="bb-input" rows={6} value={d.style.customCss} placeholder={".xpr-title { letter-spacing: .02em; }"} onChange={(e) => setS({ customCss: e.target.value })} />
                <small className="bb-hint"><Translate text="Classes start with .xpr-" /></small>
              </details>
              <button type="button" className="bb-btn ghost sm" onClick={() => set({ style: { ...RC_DEFAULT_STYLE, customCss: d.style.customCss } })}><Translate text="Reset to neutral" /></button>
            </Section>

            <Section n={6} title="Texts & languages" desc="Shoppers see the language of your store. Empty fields use the built-in translation.">
              <div className="bb-langs">
                {BB_LANGS.map((l) => (
                  <button key={l} type="button" className={`bb-lang${lang === l ? " on" : ""}`} onClick={() => setLang(l)}>
                    {BB_LANG_META[l].name}
                    {d.texts[l] && Object.keys(d.texts[l] || {}).length ? <span className="dot" aria-label={t("Edited")} /> : null}
                  </button>
                ))}
              </div>
              <div dir={BB_LANG_META[lang].dir}>
                {RC_MAIN_TEXTS.map((k) => (
                  <div key={k} className="bb-field">
                    <label htmlFor={`rc-t-${k}`}>{t(RC_TEXT_META[k].label)}{RC_TEXT_META[k].vars ? <span className="bb-muted bb-sm"> {RC_TEXT_META[k].vars}</span> : null}</label>
                    <input id={`rc-t-${k}`} className="bb-input" value={texts[k] || ""} placeholder={defaults[k]} maxLength={200} onChange={(e) => setText(k, e.target.value)} />
                  </div>
                ))}
                <details className="bb-details">
                  <summary><Translate text="All texts (buttons and messages)" /></summary>
                  <div className="bb-grid2">
                    {RC_TEXT_KEYS.filter((k) => !RC_MAIN_TEXTS.includes(k)).map((k) => (
                      <div key={k} className="bb-field">
                        <label htmlFor={`rc-t-${k}`}>{t(RC_TEXT_META[k].label)}{RC_TEXT_META[k].vars ? <span className="bb-muted bb-sm"> {RC_TEXT_META[k].vars}</span> : null}</label>
                        <input id={`rc-t-${k}`} className="bb-input" value={texts[k] || ""} placeholder={defaults[k]} maxLength={200} onChange={(e) => setText(k, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </Section>
          </div>

          <div className="bb-sticky">
            <div className="bb-prev">
              <div className="bb-prev-bar">
                <b style={{ color: "#FFEB97", fontSize: 14 }}><Translate text="Live preview" /></b>
                <div className="bb-inline">
                  <div className="bb-seg sm">
                    <button type="button" className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")}>{t("Desktop")}</button>
                    <button type="button" className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>{t("Mobile")}</button>
                  </div>
                  <select className="bb-input sm" value={lang} onChange={(e) => setLang(e.target.value as BbLang)} aria-label={t("Preview language")}>
                    {BB_LANGS.map((l) => <option key={l} value={l}>{BB_LANG_META[l].name}</option>)}
                  </select>
                </div>
              </div>
              <RecsPreview payload={payload} rtl={BB_LANG_META[lang].dir === "rtl"} moneyFormat={data.moneyFormat} currency={data.currency} device={device} />
              <p className="bb-hint" style={{ margin: "10px 0 0" }}>
                {c.source === "manual" ? <Translate text="This runs the same code as your store." /> : <Translate text="This runs the same code as your store. Shopify picks the real products on each product page; the preview uses products from your store." />}
              </p>
            </div>
            {errors.length ? (
              <div className="bb-banner warn">
                <Translate text="Before this can go live:" />
                <ul>{errors.map((e) => <li key={e}>{t(e)}</li>)}</ul>
              </div>
            ) : (
              <div className="bb-card" style={{ padding: 14 }}>
                <p className="bb-tip"><i>✓</i><span>{t(RC_SOURCE_META[c.source].name)} · {c.count} · {t(RC_DESIGN_META[c.design].name)}</span></p>
                <p className="bb-tip" style={{ margin: 0 }}><i>✓</i><span>{t(describeOffer(c.offer, money))}</span></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </s-page>
  );
}
