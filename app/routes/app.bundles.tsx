import { Translate, useTranslations } from "../components/Translate";
import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { appCredentials, authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { dayToDate, localDay } from "../utils/analytics";
import { BUNDLES_DISCOUNT_TITLE, loadBundles, readSettings, syncAllDiscounts, type BundlesSyncResult } from "../bundles.server";
import {
  BB_DEFAULT_STYLE,
  BB_DESIGN_META,
  BB_LANGS,
  BB_LANG_META,
  BB_MAIN_TEXTS,
  BB_PLACEMENTS,
  BB_PLACEMENT_META,
  BB_PRICE_META,
  BB_PRICE_MODES,
  BB_TEMPLATES,
  BB_TEXT_KEYS,
  BB_TEXT_META,
  BB_TYPES,
  BB_TYPE_META,
  BB_DEFAULT_TEXTS,
  MAX_BUNDLES,
  MAX_ITEMS,
  MAX_POOL_COLLECTIONS,
  MAX_POOL_PRODUCTS,
  MAX_STEPS,
  bundleSize,
  defaultConfig,
  defaultPlacement,
  describeConditions,
  describePricing,
  formatMoney,
  newId,
  numericId,
  sanitizeConditions,
  sanitizeConfig,
  sanitizePlacement,
  sanitizeSettings,
  sanitizeStyle,
  sanitizeTexts,
  validateBundle,
  type BbConditions,
  type BbConfig,
  type BbDesign,
  type BbLang,
  type BbPlacement,
  type BbPriceMode,
  type BbStyle,
  type BbTextKey,
  type BbTextsByLang,
  type BbType,
  type ParsedBundle,
} from "../utils/bundles";
import { BB_CSS } from "../components/bb/styles";
import { BundlePreview, CollectionPicker, ColorField, ConditionBuilder, DesignSchematic, ProductPicker, RefPicker, previewPayload, type PreviewProduct } from "../components/bb/BundleParts";
import { ColorPresets } from "../components/ColorPresets";

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  let currency = shop.analyticsCurrency || "USD";
  let tz = shop.analyticsTimezone || "UTC";
  let moneyFormat = "";
  let discountStatus: "active" | "inactive" | "missing" = "missing";
  try {
    const res = await admin.graphql(`#graphql
      query XpBundlesMeta {
        shop { currencyCode ianaTimezone currencyFormats { moneyFormat } }
        discountNodes(first: 100, query: "type:app") { nodes { discount { __typename ... on DiscountAutomaticApp { title status } } } }
      }`);
    const j: any = await res.json();
    currency = j?.data?.shop?.currencyCode || currency;
    tz = j?.data?.shop?.ianaTimezone || tz;
    moneyFormat = j?.data?.shop?.currencyFormats?.moneyFormat || "";
    const d = (j?.data?.discountNodes?.nodes || []).find((n: any) => n?.discount?.title === BUNDLES_DISCOUNT_TITLE);
    discountStatus = !d ? "missing" : d.discount.status === "ACTIVE" ? "active" : "inactive";
  } catch {
    /* defaults */
  }

  const bundles = await loadBundles(shop.id);
  const since = dayToDate(localDay(Date.now() - 30 * 86_400_000, tz));
  const [stat, orders] = await Promise.all([
    prisma.xpDailyStat.groupBy({
      by: ["offerId"],
      where: { shopId: shop.id, feature: "bundles", day: { gte: since } },
      _sum: { impressions: true, clicks: true, actions: true },
    }),
    prisma.xpOrder.findMany({
      where: { shopId: shop.id, day: { gte: since }, cancelled: false, sourcesJson: { contains: '"bundles"' } },
      select: { sourcesJson: true },
      take: 3000,
    }),
  ]);
  const stats: Record<string, { views: number; clicks: number; adds: number; orders: number; revenue: number }> = {};
  const get = (id: string) => (stats[id] ||= { views: 0, clicks: 0, adds: 0, orders: 0, revenue: 0 });
  for (const s of stat) {
    const e = get(s.offerId);
    e.views = s._sum.impressions || 0;
    e.clicks = s._sum.clicks || 0;
    e.adds = s._sum.actions || 0;
  }
  for (const o of orders) {
    try {
      const seen = new Set<string>();
      for (const src of JSON.parse(o.sourcesJson || "[]")) {
        if (src.f !== "bundles" || !src.o) continue;
        get(String(src.o)).revenue += Number(src.rev) || 0;
        seen.add(String(src.o));
      }
      for (const id of seen) get(id).orders += 1;
    } catch {
      /* skip bad rows */
    }
  }

  const handle = session.shop.replace(".myshopify.com", "");
  const apiKey = String(appCredentials?.apiKey || "").trim();
  return {
    enabled: shop.bundlesEnabled,
    currency,
    moneyFormat,
    bundles,
    stats,
    settings: readSettings(shop.bundlesSettingsJson),
    discountStatus,
    hasCustomerScope: String(session.scope || "").split(",").includes("read_customers"),
    themeEditorUrl: `https://admin.shopify.com/store/${handle}/themes/current/editor?template=product${apiKey ? `&addAppBlockId=${apiKey}/bundle-builder&target=mainSection` : ""}`,
    pageEditorUrl: `https://admin.shopify.com/store/${handle}/themes/current/editor?template=page${apiKey ? `&addAppBlockId=${apiKey}/bundle-builder&target=newAppsSection` : ""}`,
    maxBundles: MAX_BUNDLES,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sync = async (_featureOn?: boolean): Promise<BundlesSyncResult> => syncAllDiscounts(admin, shop.id);

  if (intent === "toggleFeature") {
    const enable = form.get("enable") === "true";
    await prisma.shop.update({ where: { id: shop.id }, data: { bundlesEnabled: enable } });
    const s = await sync(enable);
    return { ok: s.state !== "error", message: (enable ? "Bundle Builder is on. " : "Bundle Builder is off. ") + s.message };
  }

  if (intent === "saveSettings") {
    let raw: any = {};
    try {
      raw = JSON.parse(String(form.get("settings") || "{}"));
    } catch {
      /* ignore */
    }
    await prisma.shop.update({ where: { id: shop.id }, data: { bundlesSettingsJson: JSON.stringify(sanitizeSettings(raw)) } });
    const s = await sync();
    return { ok: s.state !== "error", message: "Settings saved. " + s.message };
  }

  if (["toggleBundle", "deleteBundle", "duplicateBundle", "moveBundle"].includes(intent)) {
    const id = String(form.get("id") || "");
    const row = await prisma.bundle.findFirst({ where: { id, shopId: shop.id } });
    if (!row) return { ok: false, message: "Bundle not found." };

    if (intent === "toggleBundle") {
      const enable = form.get("enable") === "true";
      if (enable) {
        const p = (await loadBundles(shop.id)).find((b) => b.id === id)!;
        const errs = validateBundle(p.type, p.config);
        if (errs.length) return { ok: false, message: "Fix this bundle before turning it on: " + errs.join(" ") };
      }
      await prisma.bundle.update({ where: { id }, data: { enabled: enable } });
    } else if (intent === "deleteBundle") {
      await prisma.bundle.delete({ where: { id } });
    } else if (intent === "duplicateBundle") {
      const count = await prisma.bundle.count({ where: { shopId: shop.id } });
      if (count >= MAX_BUNDLES) return { ok: false, message: `You can have up to ${MAX_BUNDLES} bundles.` };
      const copy = await prisma.bundle.create({
        data: { ...row, id: undefined, name: `${row.name} (copy)`.slice(0, 120), enabled: false, priority: row.priority + 1, createdAt: undefined, updatedAt: undefined } as any,
      });
      const s = await sync();
      return { ok: true, message: "Duplicated (paused). " + s.message, bundleId: copy.id };
    } else if (intent === "moveBundle") {
      const list = await prisma.bundle.findMany({ where: { shopId: shop.id }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }], select: { id: true } });
      const i = list.findIndex((b) => b.id === id);
      const j = form.get("dir") === "up" ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < list.length) {
        [list[i], list[j]] = [list[j], list[i]];
        await prisma.$transaction(list.map((b, k) => prisma.bundle.update({ where: { id: b.id }, data: { priority: (k + 1) * 10 } })));
      }
    }
    const s = await sync();
    return { ok: s.state !== "error", message: s.message };
  }

  if (intent === "saveBundle") {
    let raw: any = {};
    try {
      raw = JSON.parse(String(form.get("payload") || "{}"));
    } catch {
      return { ok: false, message: "Couldn't read the form. Please try again." };
    }
    const type = (BB_TYPES as readonly string[]).includes(raw.type) ? (raw.type as BbType) : "mix";
    const designs = BB_TYPE_META[type].designs;
    const design = designs.includes(raw.design) ? (raw.design as BbDesign) : designs[0];
    const config = sanitizeConfig(raw.config, type);
    const name = String(raw.name || "").trim().slice(0, 120) || "Untitled bundle";
    let enabled = !!raw.enabled;
    const errors = validateBundle(type, config);
    let note = "";
    if (errors.length && enabled) {
      enabled = false;
      note = " Saved as paused until these are fixed.";
    }
    const data = {
      name,
      type,
      design,
      enabled,
      configJson: JSON.stringify(config),
      placementJson: JSON.stringify(sanitizePlacement(raw.placement)),
      conditionsJson: JSON.stringify(sanitizeConditions(raw.conditions)),
      styleJson: JSON.stringify(sanitizeStyle(raw.style)),
      textsJson: JSON.stringify(sanitizeTexts(raw.texts)),
    };
    let id = String(raw.id || "");
    if (id && id !== "new") {
      const row = await prisma.bundle.findFirst({ where: { id, shopId: shop.id }, select: { id: true } });
      if (!row) return { ok: false, message: "Bundle not found." };
      await prisma.bundle.update({ where: { id }, data });
    } else {
      const count = await prisma.bundle.count({ where: { shopId: shop.id } });
      if (count >= MAX_BUNDLES) return { ok: false, message: `You can have up to ${MAX_BUNDLES} bundles.` };
      const last = await prisma.bundle.findFirst({ where: { shopId: shop.id }, orderBy: { priority: "desc" }, select: { priority: true } });
      const created = await prisma.bundle.create({ data: { ...data, shopId: shop.id, priority: (last?.priority || 0) + 10 } });
      id = created.id;
    }
    const s = await sync();
    return { ok: !errors.length || !raw.enabled, errors, message: (errors.length ? "Saved." + note : "Saved. ") + (s.message ? " " + s.message : ""), bundleId: id, sync: s.state };
  }

  return { ok: false, message: "Unknown action." };
};

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function BundlesPage() {
  const data = useLoaderData<typeof loader>();
  const { t } = useTranslations();
  const [params] = useSearchParams();
  const editing = params.get("bundle");
  return (
    <s-page heading={t("Bundle Builder")}>
      <style>{BB_CSS}</style>
      {editing ? <Editor key={`${editing}:${params.get("tpl") || ""}`} data={data} bundleParam={editing} tpl={params.get("tpl")} /> : <ListView data={data} />}
    </s-page>
  );
}

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "–");

function ListView({ data }: { data: LoaderData }) {
  const { t } = useTranslations();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";
  const money = (n: number) => formatMoney(n, data.currency);
  const bundles = data.bundles as unknown as ParsedBundle[];
  const [settings, setSettings] = useState(data.settings);
  const send = (fields: Record<string, string>) => fetcher.submit(fields, { method: "post" });
  const res = fetcher.data as any;

  useEffect(() => {
    if (res?.bundleId && String(res.message || "").startsWith("Duplicated")) navigate(`/app/bundles?bundle=${res.bundleId}`);
  }, [res, navigate]);

  return (
    <div className="bb-wrap">
      {res?.message ? <div className={`bb-banner ${res.ok === false ? "bad" : "ok"}`}>{t(res.message)}</div> : null}

      <div className="bb-card bb-hero">
        <div>
          <h2><Translate text="Let shoppers build their own bundle" /></h2>
          <p>
            <Translate text="Mix & match, build-a-box, fixed bundles and multipacks, with tiered prices, free gifts and customer rules. The price is checked again at checkout, so it can't be changed from the browser." />
          </p>
        </div>
        <label className="bb-switch" title={t("Turn the whole feature on or off")}>
          <input type="checkbox" checked={data.enabled} disabled={busy} onChange={(e) => send({ intent: "toggleFeature", enable: String(e.target.checked) })} />
          <span className="knob" />
          <b>{data.enabled ? t("On") : t("Off")}</b>
        </label>
      </div>

      {data.enabled && data.discountStatus !== "active" && bundles.some((b) => b.enabled) ? (
        <div className="bb-banner warn">
          <Translate text="The checkout discount “XPoost Bundles” isn't active yet. Save any bundle to create it. If it still doesn't activate, run npm run deploy so the pricing engine is installed." />
        </div>
      ) : null}

      <div className="bb-card">
        <h3 className="bb-title"><Translate text="Set up in 3 steps" /></h3>
        <ol className="bb-steps">
          <li>
            <b><Translate text="Add the block to your product page." /></b>{" "}
            <a href={data.themeEditorUrl} target="_top">
              <Translate text="Open the theme editor (product template) →" />
            </a>{" "}
            <Translate text="The block “XPoost: Bundle Builder” is added under the buy button. Move it where you like and save." />
          </li>
          <li>
            <b><Translate text="Optional: a bundle landing page." /></b>{" "}
            <a href={data.pageEditorUrl} target="_top">
              <Translate text="Add the block to a page template →" />
            </a>{" "}
            <Translate text="Then paste the bundle ID into the block's “Bundle ID” setting." />
          </li>
          <li>
            <b><Translate text="Create a bundle below, switch it on, and test it." /></b> <Translate text="Add a bundle to the cart and go to checkout: you'll see the bundle discount there." />
          </li>
        </ol>
      </div>

      <div className="bb-card">
        <div className="bb-row" style={{ marginBottom: 12 }}>
          <h3 className="bb-title nb"><Translate text="Your bundles" /></h3>
          <Link to="/app/bundles?bundle=new" className="bb-btn gold">
            <Translate text="+ New bundle" />
          </Link>
        </div>
        {bundles.length === 0 ? (
          <div className="bb-empty">
            <Translate text="No bundles yet. Start from a template below, or" /> <Link to="/app/bundles?bundle=new"><Translate text="build one from scratch" /></Link>.
          </div>
        ) : (
          <>
            <p className="bb-muted bb-sm" style={{ marginTop: 0 }}>
              <Translate text="On a product page, the first live bundle from the top that matches the product and the shopper is shown." />
            </p>
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th><Translate text="Bundle" /></th>
                    <th><Translate text="Price" /></th>
                    <th><Translate text="Who" /></th>
                    <th className="r"><Translate text="Views" /></th>
                    <th className="r"><Translate text="Add-to-cart rate" /></th>
                    <th className="r"><Translate text="Orders" /></th>
                    <th className="r"><Translate text="Revenue" /></th>
                    <th><Translate text="Live" /></th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bundles.map((b, i) => {
                    const s = data.stats[b.id] || { views: 0, clicks: 0, adds: 0, orders: 0, revenue: 0 };
                    return (
                      <tr key={b.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="bb-icon" disabled={i === 0 || busy} onClick={() => send({ intent: "moveBundle", id: b.id, dir: "up" })} aria-label={t("Move up")}>↑</button>{" "}
                          <button className="bb-icon" disabled={i === bundles.length - 1 || busy} onClick={() => send({ intent: "moveBundle", id: b.id, dir: "down" })} aria-label={t("Move down")}>↓</button>
                        </td>
                        <td>
                          <Link to={`/app/bundles?bundle=${b.id}`} className="bb-name">{b.name}</Link>
                          <div className="bb-muted bb-sm" style={{ marginTop: 3 }}>
                            <span className="bb-pill">{t(BB_TYPE_META[b.type].name)}</span>
                            {t(BB_DESIGN_META[b.design].name)} · {t(BB_PLACEMENT_META[b.placement.mode].name)}
                          </div>
                        </td>
                        <td className="bb-muted bb-sm">{describePricing(b.config.pricing, money)}{b.config.gift.enabled ? " + Gift" : ""}</td>
                        <td className="bb-muted bb-sm">{describeConditions(b.conditions, money)}</td>
                        <td className="r bb-stat">{s.views.toLocaleString()}</td>
                        <td className="r bb-stat">{s.views >= 50 ? pct(s.adds, s.views) : "–"}</td>
                        <td className="r bb-stat">{s.orders || "–"}</td>
                        <td className="r bb-stat">{s.revenue ? money(s.revenue) : "–"}</td>
                        <td>
                          <label className="bb-switch sm">
                            <input type="checkbox" checked={b.enabled} disabled={busy} onChange={(e) => send({ intent: "toggleBundle", id: b.id, enable: String(e.target.checked) })} />
                            <span className="knob" />
                          </label>
                        </td>
                        <td>
                          <div className="act" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <Link to={`/app/bundles?bundle=${b.id}`} className="bb-btn ghost sm"><Translate text="Edit" /></Link>
                            <button className="bb-btn ghost sm" disabled={busy} onClick={() => send({ intent: "duplicateBundle", id: b.id })}><Translate text="Duplicate" /></button>
                            <button
                              className="bb-btn ghost sm danger"
                              disabled={busy}
                              onClick={() => {
                                if (window.confirm(t("Delete “{name}”? Bundles already in carts stop getting the bundle price.", { name: b.name }))) send({ intent: "deleteBundle", id: b.id });
                              }}
                            >
                              <Translate text="Delete" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="bb-muted bb-sm"><Translate text="Last 30 days. Revenue is what shoppers paid for bundle items after the bundle discount." /></p>
          </>
        )}
      </div>

      <div className="bb-card">
        <h3 className="bb-title"><Translate text="Start from a template" /></h3>
        <div className="bb-tpl-grid">
          {BB_TEMPLATES.map((tp) => (
            <Link key={tp.key} to={`/app/bundles?bundle=new&tpl=${tp.key}`} className="bb-tpl">
              <div className="bb-tpl-kind">{t(BB_TYPE_META[tp.type].name)} · {t(BB_DESIGN_META[tp.design].name)}</div>
              <div className="bb-tpl-name">{t(tp.name)}</div>
              <div className="bb-tpl-tag">{t(tp.tagline)}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="bb-card">
        <h3 className="bb-title"><Translate text="Checkout discount settings" /></h3>
        <p className="bb-desc"><Translate text="All bundles share one automatic discount in Shopify called “XPoost Bundles”. Choose which other discounts it can combine with." /></p>
        <label className="bb-check">
          <input type="checkbox" checked={settings.combineOrder} onChange={(e) => setSettings({ ...settings, combineOrder: e.target.checked })} />
          <span><Translate text="Combine with order discounts" /><small><Translate text="e.g. a 10% welcome code on the whole order" /></small></span>
        </label>
        <label className="bb-check">
          <input type="checkbox" checked={settings.combineShipping} onChange={(e) => setSettings({ ...settings, combineShipping: e.target.checked })} />
          <span><Translate text="Combine with shipping discounts" /><small><Translate text="e.g. free shipping over a threshold" /></small></span>
        </label>
        <label className="bb-check">
          <input type="checkbox" checked={settings.combineProduct} onChange={(e) => setSettings({ ...settings, combineProduct: e.target.checked })} />
          <span><Translate text="Combine with other product discounts" /><small><Translate text="Off by default, so a bundle item never gets two product discounts at once" /></small></span>
        </label>
        <button className="bb-btn" disabled={busy} onClick={() => send({ intent: "saveSettings", settings: JSON.stringify(settings) })}>
          <Translate text="Save settings" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Editor
// ─────────────────────────────────────────────────────────────

type Draft = {
  id: string;
  name: string;
  type: BbType;
  design: BbDesign;
  enabled: boolean;
  config: BbConfig;
  placement: BbPlacement;
  conditions: BbConditions;
  style: BbStyle;
  texts: BbTextsByLang;
};

function newDraft(tplKey: string | null): Draft {
  const tpl = BB_TEMPLATES.find((x) => x.key === tplKey);
  const type: BbType = tpl ? tpl.type : "mix";
  let config = defaultConfig(type);
  if (tpl) config = tpl.patch(config);
  return {
    id: "new",
    name: tpl ? tpl.name : "New bundle",
    type,
    design: tpl ? tpl.design : BB_TYPE_META[type].designs[0],
    enabled: true,
    config,
    placement: defaultPlacement(),
    conditions: { match: "all", rules: [] },
    style: { ...BB_DEFAULT_STYLE },
    texts: tpl ? { en: { ...tpl.texts } } : {},
  };
}

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

function Editor({ data, bundleParam, tpl }: { data: LoaderData; bundleParam: string; tpl: string | null }) {
  const { t, locale } = useTranslations();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const existing = (data.bundles as unknown as ParsedBundle[]).find((b) => b.id === bundleParam);
  const [d, setD] = useState<Draft>(() =>
    existing
      ? { id: existing.id, name: existing.name, type: existing.type, design: existing.design, enabled: existing.enabled, config: existing.config, placement: existing.placement, conditions: existing.conditions, style: existing.style, texts: existing.texts }
      : newDraft(tpl),
  );
  const [lang, setLang] = useState<BbLang>(() => ((BB_LANGS as readonly string[]).includes(locale) ? (locale as BbLang) : "en"));
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [dirty, setDirty] = useState(false);
  const [catalog, setCatalog] = useState<{ products: Record<string, PreviewProduct>; collections: Record<string, string[]> }>({ products: {}, collections: {} });
  const busy = fetcher.state !== "idle";
  const res = fetcher.data as any;
  const money = (n: number) => formatMoney(n, data.currency);

  const set = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const setC = (patch: Partial<BbConfig>) => set({ config: { ...d.config, ...patch } });
  const setP = (patch: Partial<BbConfig["pricing"]>) => setC({ pricing: { ...d.config.pricing, ...patch } });

  // After the first save of a new bundle, move to its URL
  useEffect(() => {
    if (res?.bundleId && d.id === "new") {
      setD((x) => ({ ...x, id: res.bundleId }));
      navigate(`/app/bundles?bundle=${res.bundleId}`, { replace: true });
    }
    if (res && fetcher.state === "idle") setDirty(false);
  }, [res, fetcher.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real product data for the preview
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    d.config.steps.forEach((s) => s.products.forEach((p) => ids.add(numericId(p.id))));
    d.config.fixed.forEach((p) => ids.add(numericId(p.id)));
    if (d.config.multipack.product) ids.add(numericId(d.config.multipack.product.id));
    if (d.config.gift.product) ids.add(numericId(d.config.gift.product.id));
    return [...ids].sort().join(",");
  }, [d.config]);
  const collectionIds = useMemo(() => [...new Set(d.config.steps.flatMap((s) => s.collections.map((c) => numericId(c.id))))].sort().join(","), [d.config.steps]);
  useEffect(() => {
    if (!productIds && !collectionIds) return;
    let alive = true;
    const id = setTimeout(() => {
      fetch(`/api/bundles/preview?products=${productIds}&collections=${collectionIds}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => alive && j && setCatalog({ products: j.products || {}, collections: j.collections || {} }))
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [productIds, collectionIds]);

  const payload = useMemo(() => previewPayload(d, lang, catalog), [d, lang, catalog]);
  const errors = validateBundle(d.type, d.config);
  const size = bundleSize(d.type, d.config);

  const save = (enabled = d.enabled) => {
    fetcher.submit({ intent: "saveBundle", payload: JSON.stringify({ ...d, enabled }) }, { method: "post" });
  };

  const changeType = (type: BbType) => {
    if (type === d.type) return;
    const fresh = defaultConfig(type);
    // keep the products the merchant already picked where it makes sense
    const picked = d.config.steps.flatMap((s) => s.products);
    if (type === "mix" || type === "box") fresh.steps[0].products = picked.length ? picked.slice(0, MAX_POOL_PRODUCTS) : d.config.fixed.map(({ qty: _q, ...p }) => p);
    if (type === "fixed") fresh.fixed = picked.slice(0, 4).map((p) => ({ ...p, qty: 1 }));
    set({ type, design: BB_TYPE_META[type].designs[0], config: { ...fresh, pricing: d.config.pricing, gift: d.config.gift, display: d.config.display, afterAdd: d.config.afterAdd } });
  };

  const texts = d.texts[lang] || {};
  const setText = (k: BbTextKey, v: string) => set({ texts: { ...d.texts, [lang]: { ...texts, [k]: v } } });
  const setStepText = (id: string, v: string) => set({ texts: { ...d.texts, [lang]: { ...texts, steps: { ...(texts.steps || {}), [id]: v } } } });
  const defaults = BB_DEFAULT_TEXTS[lang];

  return (
    <div className="bb-wrap">
      <div className="bb-topbar">
        <Link to="/app/bundles" className="bb-btn ghost sm">← <Translate text="All bundles" /></Link>
        <div className="bb-topbar-r">
          {res?.message && !busy ? <span className={`bb-flash ${res.ok === false ? "bad" : "ok"}`}>{t(res.message)}</span> : dirty ? <span className="bb-flash"><Translate text="Unsaved changes" /></span> : null}
          <label className="bb-switch sm">
            <input type="checkbox" checked={d.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            <span className="knob" />
            {d.enabled ? t("Live") : t("Paused")}
          </label>
          <button className="bb-btn gold" disabled={busy} onClick={() => save()}>
            {busy ? t("Saving…") : t("Save")}
          </button>
        </div>
      </div>

      {res?.errors?.length ? (
        <div className="bb-banner bad">
          <Translate text="Please fix:" />
          <ul>{res.errors.map((e: string) => <li key={e}>{t(e)}</li>)}</ul>
        </div>
      ) : null}

      <div className="bb-layout">
        <div className="bb-main">
          {/* 1. Basics */}
          <Section n={1} title="Bundle type">
            <div className="bb-field">
              <label htmlFor="bb-name"><Translate text="Internal name" /></label>
              <input id="bb-name" className="bb-input" value={d.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} />
              <small><Translate text="Only you see this. Shoppers see the heading you set under Texts." /></small>
            </div>
            <div className="bb-cards">
              {BB_TYPES.map((ty) => (
                <button key={ty} type="button" className={`bb-choice${d.type === ty ? " on" : ""}`} onClick={() => changeType(ty)}>
                  <b>{t(BB_TYPE_META[ty].name)}</b>
                  <span>{t(BB_TYPE_META[ty].blurb)}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* 2. Products */}
          <Section n={2} title="Products" desc={d.type === "box" ? "Each step has its own products. Shoppers go through the steps in order." : d.type === "fixed" ? "Pick the products in this bundle and how many of each." : d.type === "multipack" ? "Pick one product. Shoppers choose which variants fill the pack." : "Pick the products shoppers can choose from. Add collections to keep the list up to date automatically."}>
            {d.type === "mix" || d.type === "box" ? (
              <>
                {d.config.steps.map((s, i) => (
                  <div key={s.id} className="bb-box">
                    <div className="bb-box-h">
                      {d.type === "box" ? <span className="n">{i + 1}</span> : null}
                      {d.type === "box" ? (
                        <input className="bb-input" value={s.title} placeholder={t("Step title, e.g. Choose your cleanser")} maxLength={80} onChange={(e) => setC({ steps: d.config.steps.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })} />
                      ) : (
                        <b><Translate text="Products to choose from" /></b>
                      )}
                      {d.type === "box" ? (
                        <>
                          <button type="button" className="bb-icon" disabled={i === 0} onClick={() => { const st = [...d.config.steps]; [st[i - 1], st[i]] = [st[i], st[i - 1]]; setC({ steps: st }); }} aria-label={t("Move up")}>↑</button>
                          <button type="button" className="bb-icon" disabled={i === d.config.steps.length - 1} onClick={() => { const st = [...d.config.steps]; [st[i + 1], st[i]] = [st[i], st[i + 1]]; setC({ steps: st }); }} aria-label={t("Move down")}>↓</button>
                          <button type="button" className="bb-icon danger" disabled={d.config.steps.length <= 1} onClick={() => setC({ steps: d.config.steps.filter((x) => x.id !== s.id) })} aria-label={t("Remove step")}>✕</button>
                        </>
                      ) : null}
                    </div>
                    <div className="bb-inline" style={{ marginBottom: 10 }}>
                      <span className="bb-label"><Translate text="Shopper picks" /></span>
                      <input className="bb-input xs" type="number" min={d.type === "box" ? 0 : 1} max={s.max} value={s.min} onChange={(e) => setC({ steps: d.config.steps.map((x) => (x.id === s.id ? { ...x, min: Math.max(d.type === "box" ? 0 : 1, Math.min(x.max, Number(e.target.value) || 0)) } : x)) })} aria-label={t("Minimum")} />
                      <span className="bb-muted"><Translate text="to" /></span>
                      <input className="bb-input xs" type="number" min={1} max={MAX_ITEMS} value={s.max} onChange={(e) => { const max = Math.max(1, Math.min(MAX_ITEMS, Number(e.target.value) || 1)); setC({ steps: d.config.steps.map((x) => (x.id === s.id ? { ...x, max, min: Math.min(x.min, max) } : x)) }); }} aria-label={t("Maximum")} />
                      <span className="bb-muted"><Translate text="items" /></span>
                      {s.min === 0 ? <span className="bb-pill"><Translate text="Optional step" /></span> : null}
                    </div>
                    <div className="bb-grid2">
                      <div>
                        <div className="bb-label" style={{ marginBottom: 6 }}><Translate text="Products" /></div>
                        <ProductPicker value={s.products} max={MAX_POOL_PRODUCTS} onChange={(products) => setC({ steps: d.config.steps.map((x) => (x.id === s.id ? { ...x, products } : x)) })} />
                      </div>
                      <div>
                        <div className="bb-label" style={{ marginBottom: 6 }}><Translate text="Collections" /></div>
                        <CollectionPicker value={s.collections} max={MAX_POOL_COLLECTIONS} onChange={(collections) => setC({ steps: d.config.steps.map((x) => (x.id === s.id ? { ...x, collections } : x)) })} />
                        <small className="bb-hint"><Translate text="Shows up to 60 active products per collection, in the collection's order." /></small>
                      </div>
                    </div>
                  </div>
                ))}
                {d.type === "box" ? (
                  <button type="button" className="bb-btn ghost sm" disabled={d.config.steps.length >= MAX_STEPS} onClick={() => setC({ steps: [...d.config.steps, { id: newId(), title: `Step ${d.config.steps.length + 1}`, min: 1, max: 1, products: [], collections: [] }] })}>
                    <Translate text="+ Add step" />
                  </button>
                ) : null}
                <div style={{ marginTop: 14 }}>
                  <label className="bb-check">
                    <input type="checkbox" checked={d.config.allowDuplicates} onChange={(e) => setC({ allowDuplicates: e.target.checked })} />
                    <span><Translate text="Allow the same product more than once" /><small><Translate text="e.g. 3 of the same flavour in one bundle" /></small></span>
                  </label>
                </div>
              </>
            ) : null}

            {d.type === "fixed" ? (
              <ProductPicker
                value={d.config.fixed}
                max={8}
                qty={Object.fromEntries(d.config.fixed.map((f) => [f.id, f.qty]))}
                onQty={(id, q) => setC({ fixed: d.config.fixed.map((f) => (f.id === id ? { ...f, qty: q } : f)) })}
                onChange={(list) => setC({ fixed: list.map((p) => ({ ...p, qty: d.config.fixed.find((f) => f.id === p.id)?.qty || 1 })) })}
              />
            ) : null}

            {d.type === "multipack" ? (
              <>
                <ProductPicker value={d.config.multipack.product ? [d.config.multipack.product] : []} max={1} onChange={(list) => setC({ multipack: { ...d.config.multipack, product: list[0] || null } })} placeholder={t("Search the product, e.g. Protein bar")} />
                <div className="bb-inline" style={{ marginTop: 12 }}>
                  <span className="bb-label"><Translate text="Pack size" /></span>
                  <input className="bb-input xs" type="number" min={1} max={d.config.multipack.max} value={d.config.multipack.min} onChange={(e) => setC({ multipack: { ...d.config.multipack, min: Math.max(1, Math.min(d.config.multipack.max, Number(e.target.value) || 1)) } })} aria-label={t("Minimum")} />
                  <span className="bb-muted"><Translate text="to" /></span>
                  <input className="bb-input xs" type="number" min={1} max={24} value={d.config.multipack.max} onChange={(e) => { const max = Math.max(1, Math.min(24, Number(e.target.value) || 1)); setC({ multipack: { ...d.config.multipack, max, min: Math.min(d.config.multipack.min, max) } }); }} aria-label={t("Maximum")} />
                  <span className="bb-muted"><Translate text="items" /></span>
                </div>
              </>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <label className="bb-check">
                <input type="checkbox" checked={d.config.allowMultiples} onChange={(e) => setC({ allowMultiples: e.target.checked })} />
                <span><Translate text="Keep the bundle price when the shopper raises quantities in the cart" /><small><Translate text="e.g. 2 complete bundles get the bundle price twice" /></small></span>
              </label>
              <label className="bb-check">
                <input type="checkbox" checked={d.config.hideSoldOut} onChange={(e) => setC({ hideSoldOut: e.target.checked })} />
                <span><Translate text="Hide sold-out products and variants" /><small><Translate text="Otherwise they show as “Sold out” and can't be picked" /></small></span>
              </label>
            </div>
          </Section>

          {/* 3. Pricing */}
          <Section n={3} title="Price" desc="The bundle price applies once the bundle is complete. It's checked again at checkout.">
            <div className="bb-cards" style={{ marginBottom: 14 }}>
              {BB_PRICE_MODES.map((m) => (
                <button key={m} type="button" className={`bb-choice${d.config.pricing.mode === m ? " on" : ""}`} onClick={() => setP({ mode: m as BbPriceMode, tiers: m === "tiers" && !d.config.pricing.tiers.length ? [{ min: Math.max(1, size.min), mode: "percent", value: 10 }, { min: Math.max(2, size.min + 1), mode: "percent", value: 15 }] : d.config.pricing.tiers })}>
                  <b>{t(BB_PRICE_META[m].name)}</b>
                  <span>{t(BB_PRICE_META[m].blurb)}</span>
                </button>
              ))}
            </div>
            {d.config.pricing.mode === "percent" || d.config.pricing.mode === "amount" || d.config.pricing.mode === "price" ? (
              <div className="bb-inline">
                <span className="bb-label">{d.config.pricing.mode === "percent" ? t("Percentage off") : d.config.pricing.mode === "amount" ? t("Amount off the bundle") : t("Bundle price")}</span>
                <input className="bb-input sm" type="number" min={0} max={d.config.pricing.mode === "percent" ? 100 : undefined} step="0.01" value={d.config.pricing.value} onChange={(e) => setP({ value: Number(e.target.value) || 0 })} />
                <span className="bb-muted">{d.config.pricing.mode === "percent" ? "%" : data.currency}</span>
              </div>
            ) : null}
            {d.config.pricing.mode !== "percent" && d.config.pricing.mode !== "none" && d.config.pricing.mode !== "cheapest" ? (
              <p className="bb-hint" style={{ marginTop: 8 }}><Translate text="Amounts are in your store currency. In other currencies they're converted at Shopify's rate." /></p>
            ) : null}
            {d.config.pricing.mode === "tiers" ? (
              <div className="bb-tiers">
                {d.config.pricing.tiers.map((tr, i) => (
                  <div key={i} className="bb-tier">
                    <input className="bb-input xs" type="number" min={1} max={99} value={tr.min} onChange={(e) => setP({ tiers: d.config.pricing.tiers.map((x, k) => (k === i ? { ...x, min: Math.max(1, Number(e.target.value) || 1) } : x)) })} aria-label={t("Items")} />
                    <span><Translate text="or more items:" /></span>
                    <select className="bb-input sm" value={tr.mode} onChange={(e) => setP({ tiers: d.config.pricing.tiers.map((x, k) => (k === i ? { ...x, mode: e.target.value as any } : x)) })}>
                      <option value="percent">{t("% off")}</option>
                      <option value="amount">{t("amount off")}</option>
                      <option value="price">{t("bundle price")}</option>
                    </select>
                    <input className="bb-input xs" type="number" min={0} step="0.01" value={tr.value} onChange={(e) => setP({ tiers: d.config.pricing.tiers.map((x, k) => (k === i ? { ...x, value: Number(e.target.value) || 0 } : x)) })} aria-label={t("Value")} />
                    <span className="bb-muted">{tr.mode === "percent" ? "%" : data.currency}</span>
                    <button type="button" className="bb-icon danger" onClick={() => setP({ tiers: d.config.pricing.tiers.filter((_, k) => k !== i) })} aria-label={t("Remove tier")}>✕</button>
                  </div>
                ))}
                <div>
                  <button type="button" className="bb-btn ghost sm" disabled={d.config.pricing.tiers.length >= 6} onClick={() => setP({ tiers: [...d.config.pricing.tiers, { min: (d.config.pricing.tiers.at(-1)?.min || 1) + 1, mode: "percent", value: 20 }] })}>
                    <Translate text="+ Add tier" />
                  </button>
                </div>
                {size.max > 1 && d.config.pricing.tiers.some((x) => x.min > size.max) ? <div className="bb-banner warn"><Translate text="A tier needs more items than the bundle allows, so shoppers can never reach it." /></div> : null}
                {d.config.pricing.tiers.some((x) => x.min < size.min) ? <p className="bb-hint"><Translate text="Tiers below the minimum bundle size never apply on their own; the bundle must be complete first." /></p> : null}
              </div>
            ) : null}
            {d.config.pricing.mode === "cheapest" ? (
              <div className="bb-inline">
                <span className="bb-label"><Translate text="The cheapest" /></span>
                <input className="bb-input xs" type="number" min={1} max={10} value={d.config.pricing.cheapestCount} onChange={(e) => setP({ cheapestCount: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} aria-label={t("Items")} />
                <span className="bb-label"><Translate text="item(s) get" /></span>
                <input className="bb-input xs" type="number" min={1} max={100} value={d.config.pricing.cheapestPercent} onChange={(e) => setP({ cheapestPercent: Math.max(1, Math.min(100, Number(e.target.value) || 100)) })} aria-label={t("Percent")} />
                <span className="bb-muted"><Translate text="% off (100 = free)" /></span>
              </div>
            ) : null}

            <div className="bb-box" style={{ marginTop: 16 }}>
              <label className="bb-check" style={{ marginBottom: d.config.gift.enabled ? 10 : 0 }}>
                <input type="checkbox" checked={d.config.gift.enabled} onChange={(e) => setC({ gift: { ...d.config.gift, enabled: e.target.checked } })} />
                <span><b><Translate text="Add a free gift" /></b><small><Translate text="Added automatically with the bundle and made free at checkout (one per bundle)." /></small></span>
              </label>
              {d.config.gift.enabled ? (
                <>
                  <ProductPicker value={d.config.gift.product ? [d.config.gift.product] : []} max={1} onChange={(list) => setC({ gift: { ...d.config.gift, product: list[0] || null } })} placeholder={t("Search the gift product")} />
                  <div className="bb-inline" style={{ marginTop: 10 }}>
                    <span className="bb-label"><Translate text="When the bundle has at least" /></span>
                    <input className="bb-input xs" type="number" min={1} max={24} value={d.config.gift.minItems} onChange={(e) => setC({ gift: { ...d.config.gift, minItems: Math.max(1, Math.min(24, Number(e.target.value) || 1)) } })} aria-label={t("Items")} />
                    <span className="bb-muted"><Translate text="items" /></span>
                  </div>
                  <p className="bb-hint"><Translate text="The gift's first variant is used. Keep it in stock; a sold-out gift is skipped." /></p>
                </>
              ) : null}
            </div>
          </Section>

          {/* 4. Design */}
          <Section n={4} title="Design" desc="Every design uses your colors and the shopper's language. Check it in the preview.">
            <div className="bb-design-grid" style={{ marginBottom: 16 }}>
              {BB_TYPE_META[d.type].designs.map((ds) => (
                <button key={ds} type="button" className={`bb-design${d.design === ds ? " on" : ""}`} onClick={() => set({ design: ds })}>
                  <DesignSchematic design={ds} />
                  <span className="bb-design-name">{t(BB_DESIGN_META[ds].name)}</span>
                  <span className="bb-design-blurb">{t(BB_DESIGN_META[ds].blurb)}</span>
                </button>
              ))}
            </div>
            <div className="bb-grid2">
              <div className="bb-field">
                <label><Translate text="How it opens" /></label>
                <div className="bb-seg">
                  {(["inline", "drawer", "modal"] as const).map((m) => (
                    <button key={m} type="button" className={d.config.display === m ? "on" : ""} onClick={() => setC({ display: m })}>
                      {m === "inline" ? t("On the page") : m === "drawer" ? t("Side drawer") : t("Pop-up")}
                    </button>
                  ))}
                </div>
                <small><Translate text="Drawer and pop-up show a compact card with a button, so the product page stays short." /></small>
              </div>
              <div className="bb-field">
                <label htmlFor="bb-after"><Translate text="After “Add to cart”" /></label>
                <select id="bb-after" className="bb-input" value={d.config.afterAdd} onChange={(e) => setC({ afterAdd: e.target.value as any })}>
                  <option value="drawer">{t("Open the cart drawer")}</option>
                  <option value="cart">{t("Go to the cart page")}</option>
                  <option value="checkout">{t("Go straight to checkout")}</option>
                  <option value="stay">{t("Stay on the page and show a message")}</option>
                </select>
              </div>
            </div>
          </Section>

          {/* 5. Where */}
          <Section n={5} title="Where it shows" desc="The block must be on the page (see the setup steps). This decides which pages show this bundle.">
            <div className="bb-cards" style={{ marginBottom: 12 }}>
              {BB_PLACEMENTS.map((m) => (
                <button key={m} type="button" className={`bb-choice${d.placement.mode === m ? " on" : ""}`} onClick={() => set({ placement: { ...d.placement, mode: m } })}>
                  <b>{t(BB_PLACEMENT_META[m].name)}</b>
                  <span>{t(BB_PLACEMENT_META[m].blurb)}</span>
                </button>
              ))}
            </div>
            {d.placement.mode === "products" || d.placement.mode === "exclude" ? (
              <div className="bb-field">
                <label>{d.placement.mode === "exclude" ? t("Don't show on these products") : t("Products")}</label>
                <RefPicker kind="products" value={d.placement.products} onChange={(products) => set({ placement: { ...d.placement, products } })} />
              </div>
            ) : null}
            {d.placement.mode === "collections" || d.placement.mode === "exclude" ? (
              <div className="bb-field">
                <label>{d.placement.mode === "exclude" ? t("Don't show on products in these collections") : t("Collections")}</label>
                <RefPicker kind="collections" value={d.placement.collections} onChange={(collections) => set({ placement: { ...d.placement, collections } })} />
              </div>
            ) : null}
            {d.id !== "new" ? (
              <div className="bb-idbox">
                <span><Translate text="Bundle ID" /></span>
                <code>{d.id}</code>
                <button type="button" className="bb-btn ghost sm" onClick={() => navigator.clipboard?.writeText(d.id)}><Translate text="Copy" /></button>
              </div>
            ) : (
              <p className="bb-hint"><Translate text="The bundle ID appears here after the first save." /></p>
            )}
            <div className="bb-field" style={{ marginTop: 12 }}>
              <label><Translate text="Devices" /></label>
              <div className="bb-seg sm">
                {(["all", "desktop", "mobile"] as const).map((m) => (
                  <button key={m} type="button" className={d.placement.device === m ? "on" : ""} onClick={() => set({ placement: { ...d.placement, device: m } })}>
                    {m === "all" ? t("All devices") : m === "desktop" ? t("Desktop only") : t("Mobile only")}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* 6. Who */}
          <Section n={6} title="Who gets it" desc="Target customers by tag, order history, spend, country or market. The same rules decide the price at checkout.">
            <ConditionBuilder value={d.conditions} onChange={(conditions) => set({ conditions })} currency={data.currency} hasScope={data.hasCustomerScope} />
            <div className="bb-grid2" style={{ marginTop: 16 }}>
              <div className="bb-field">
                <label htmlFor="bb-start"><Translate text="Starts on (optional)" /></label>
                <input id="bb-start" className="bb-input" type="date" value={d.config.startsAt} onChange={(e) => setC({ startsAt: e.target.value })} />
              </div>
              <div className="bb-field">
                <label htmlFor="bb-end"><Translate text="Ends after (optional)" /></label>
                <input id="bb-end" className="bb-input" type="date" value={d.config.endsAt} onChange={(e) => setC({ endsAt: e.target.value })} />
              </div>
            </div>
            <p className="bb-hint" style={{ marginTop: -4 }}><Translate text="Dates use your store's time zone." /></p>
          </Section>

          {/* 7. Style */}
          <Section n={7} title="Colors & style" desc="Defaults are neutral so the bundle fits any theme. Match them to your brand.">
            <ColorPresets onApply={(p) => set({ style: { ...d.style, bg: p.bg, text: p.text, border: p.border, accent: p.accent, btnBg: p.accent, btnText: p.onAccent, muted: p.text === "#FFFFFF" ? "#BDBDBD" : "#5C5C5C" } })} />
            <div className="bb-colors">
              <ColorField label={t("Background")} value={d.style.bg} onChange={(v) => set({ style: { ...d.style, bg: v } })} />
              <ColorField label={t("Text")} value={d.style.text} onChange={(v) => set({ style: { ...d.style, text: v } })} />
              <ColorField label={t("Secondary text")} value={d.style.muted} onChange={(v) => set({ style: { ...d.style, muted: v } })} />
              <ColorField label={t("Borders")} value={d.style.border} onChange={(v) => set({ style: { ...d.style, border: v } })} />
              <ColorField label={t("Highlight")} value={d.style.accent} onChange={(v) => set({ style: { ...d.style, accent: v } })} />
              <ColorField label={t("Button")} value={d.style.btnBg} onChange={(v) => set({ style: { ...d.style, btnBg: v } })} />
              <ColorField label={t("Button text")} value={d.style.btnText} onChange={(v) => set({ style: { ...d.style, btnText: v } })} />
              <ColorField label={t("Savings badge")} value={d.style.badgeBg} onChange={(v) => set({ style: { ...d.style, badgeBg: v } })} />
              <ColorField label={t("Savings badge text")} value={d.style.badgeText} onChange={(v) => set({ style: { ...d.style, badgeText: v } })} />
            </div>
            <div className="bb-grid3" style={{ marginTop: 14 }}>
              <div className="bb-field">
                <label htmlFor="bb-rad"><Translate text="Corner radius" /> ({d.style.radius}px)</label>
                <input id="bb-rad" type="range" min={0} max={28} value={d.style.radius} onChange={(e) => set({ style: { ...d.style, radius: Number(e.target.value) } })} />
              </div>
              <div className="bb-field">
                <label htmlFor="bb-cols"><Translate text="Columns on desktop" /></label>
                <select id="bb-cols" className="bb-input" value={d.style.columns} onChange={(e) => set({ style: { ...d.style, columns: Number(e.target.value) } })}>
                  {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="bb-field">
                <label htmlFor="bb-ratio"><Translate text="Image shape" /></label>
                <select id="bb-ratio" className="bb-input" value={d.style.imageRatio} onChange={(e) => set({ style: { ...d.style, imageRatio: e.target.value as any } })}>
                  <option value="square">{t("Square")}</option>
                  <option value="portrait">{t("Portrait (4:5)")}</option>
                  <option value="natural">{t("Original")}</option>
                </select>
              </div>
            </div>
            <label className="bb-check">
              <input type="checkbox" checked={d.style.font === "system"} onChange={(e) => set({ style: { ...d.style, font: e.target.checked ? "system" : "theme" } })} />
              <span><Translate text="Use a system font instead of the theme font" /></span>
            </label>
            <details className="bb-details">
              <summary><Translate text="Custom CSS" /></summary>
              <textarea className="bb-input" rows={6} value={d.style.customCss} placeholder={".xpb-title { letter-spacing: .02em; }"} onChange={(e) => set({ style: { ...d.style, customCss: e.target.value } })} />
              <small className="bb-hint"><Translate text="Applies only to this bundle. Classes start with .xpb-" /></small>
            </details>
            <button type="button" className="bb-btn ghost sm" onClick={() => set({ style: { ...BB_DEFAULT_STYLE, customCss: d.style.customCss } })}><Translate text="Reset to neutral" /></button>
          </Section>

          {/* 8. Texts */}
          <Section n={8} title="Texts & languages" desc="Shoppers see the language of your store. Empty fields use the built-in translation.">
            <div className="bb-langs">
              {BB_LANGS.map((l) => (
                <button key={l} type="button" className={`bb-lang${lang === l ? " on" : ""}`} onClick={() => setLang(l)}>
                  {BB_LANG_META[l].name}
                  {d.texts[l] && Object.keys(d.texts[l] || {}).length ? <span className="dot" aria-label={t("Edited")} /> : null}
                </button>
              ))}
            </div>
            <div dir={BB_LANG_META[lang].dir}>
              {BB_MAIN_TEXTS.map((k) => (
                <div key={k} className="bb-field">
                  <label htmlFor={`bb-t-${k}`}>
                    {t(BB_TEXT_META[k].label)}
                    {BB_TEXT_META[k].vars ? <span className="bb-muted bb-sm">{BB_TEXT_META[k].vars}</span> : null}
                  </label>
                  <input id={`bb-t-${k}`} className="bb-input" value={texts[k] || ""} placeholder={defaults[k]} maxLength={200} onChange={(e) => setText(k, e.target.value)} />
                </div>
              ))}
              {d.type === "box" ? (
                <div className="bb-field">
                  <label><Translate text="Step titles in this language" /></label>
                  {d.config.steps.map((s, i) => (
                    <input key={s.id} className="bb-input" style={{ marginBottom: 6 }} value={texts.steps?.[s.id] || ""} placeholder={s.title || `${t("Step")} ${i + 1}`} maxLength={80} onChange={(e) => setStepText(s.id, e.target.value)} />
                  ))}
                </div>
              ) : null}
              <details className="bb-details">
                <summary><Translate text="All texts (buttons, messages, steps)" /></summary>
                <div className="bb-grid2">
                  {BB_TEXT_KEYS.filter((k) => !BB_MAIN_TEXTS.includes(k)).map((k) => (
                    <div key={k} className="bb-field">
                      <label htmlFor={`bb-t-${k}`}>
                        {t(BB_TEXT_META[k].label)}
                        {BB_TEXT_META[k].vars ? <span className="bb-muted bb-sm">{BB_TEXT_META[k].vars}</span> : null}
                      </label>
                      <input id={`bb-t-${k}`} className="bb-input" value={texts[k] || ""} placeholder={defaults[k]} maxLength={200} onChange={(e) => setText(k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </Section>
        </div>

        {/* Preview */}
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
            <BundlePreview payload={payload} rtl={BB_LANG_META[lang].dir === "rtl"} moneyFormat={data.moneyFormat} currency={data.currency} device={device} />
            <p className="bb-hint" style={{ margin: "10px 0 0" }}><Translate text="This runs the same code as your store. Sample products fill empty steps; prices use your store currency." /></p>
          </div>
          {errors.length ? (
            <div className="bb-banner warn">
              <Translate text="Before this bundle can go live:" />
              <ul>{errors.map((e) => <li key={e}>{t(e)}</li>)}</ul>
            </div>
          ) : (
            <div className="bb-card" style={{ padding: 14 }}>
              <p className="bb-tip"><i>✓</i><span>{t("One complete bundle: {min}–{max} items · {price}", { min: size.min, max: size.max, price: describePricing(d.config.pricing, money) })}</span></p>
              <p className="bb-tip" style={{ margin: 0 }}><i>✓</i><span>{t("Shown to: {who}", { who: describeConditions(d.conditions, money) })}</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
