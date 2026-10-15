import { Translate, useTranslations } from "../components/Translate";
import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { appCredentials, authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { dayToDate, localDay } from "../utils/analytics";
import { BUNDLES_DISCOUNT_TITLE, syncAllDiscounts, type BundlesSyncResult } from "../bundles.server";
import { loadKits } from "../kits.server";
import { BB_CSS } from "../components/bb/styles";
import { CollectionPicker, ColorField, ConditionBuilder, ProductPicker, RefPicker, placeholderProducts, type PreviewProduct } from "../components/bb/BundleParts";
import { ColorPresets } from "../components/ColorPresets";
import { KbSchematic, KitPreview } from "../components/rk/RkParts";
import {
  BB_LANGS,
  BB_LANG_META,
  BB_PLACEMENTS,
  BB_PRICE_META,
  BB_PRICE_MODES,
  describeConditions,
  describePricing,
  formatMoney,
  numericId,
  sanitizeConditions,
  sanitizePlacement,
  sanitizeStyle,
  type BbConditions,
  type BbLang,
  type BbPlacement,
  type BbPlacementMode,
  type BbPriceMode,
  type BbStyle,
} from "../utils/bundles";
import {
  KB_DEFAULT_STYLE,
  KB_DEFAULT_TEXTS,
  KB_DESIGNS,
  KB_DESIGN_META,
  KB_DISPLAYS,
  KB_DISPLAY_META,
  KB_MAIN_TEXTS,
  KB_MAX_FILTERS,
  KB_MAX_ITEMS,
  KB_MAX_KITS,
  KB_MAX_OPTIONS,
  KB_MAX_POOL_COLLECTIONS,
  KB_MAX_POOL_PRODUCTS,
  KB_MAX_QUESTIONS,
  KB_MAX_STEPS,
  KB_TEMPLATES,
  KB_TEXT_KEYS,
  KB_TEXT_META,
  defaultKbConfig,
  defaultPlacement,
  kitSize,
  newKbId,
  newStep,
  resolveKbTexts,
  sanitizeKbConfig,
  sanitizeKbTexts,
  validateKit,
  type KbConfig,
  type KbDesign,
  type KbPool,
  type KbQuestion,
  type KbStep,
  type KbTextKey,
  type KbTextsByLang,
  type ParsedKit,
} from "../utils/kits";

const PLACEMENT_META: Record<BbPlacementMode, { name: string; blurb: string }> = {
  in_bundle: { name: "Pages of products in this kit", blurb: "Shows on the product page of every product the kit uses." },
  all: { name: "All product pages", blurb: "Shows on every product page that has the block." },
  products: { name: "Specific product pages", blurb: "Only on the products you pick." },
  collections: { name: "Products in specific collections", blurb: "Product pages of products in the collections you pick." },
  exclude: { name: "All product pages except…", blurb: "Every product page except the products and collections you pick." },
  landing: { name: "Only its landing page or where I place it by ID", blurb: "Use the kit's landing page link, or put the block on any page and enter this kit's ID." },
};

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  let currency = shop.analyticsCurrency || "USD";
  let tz = shop.analyticsTimezone || "UTC";
  let moneyFormat = "";
  let domain = session.shop;
  let discountStatus: "active" | "inactive" | "missing" = "missing";
  try {
    const res = await admin.graphql(`#graphql
      query XpKitsMeta {
        shop { currencyCode ianaTimezone currencyFormats { moneyFormat } primaryDomain { host } }
        discountNodes(first: 100, query: "type:app") { nodes { discount { __typename ... on DiscountAutomaticApp { title status } } } }
      }`);
    const j: any = await res.json();
    currency = j?.data?.shop?.currencyCode || currency;
    tz = j?.data?.shop?.ianaTimezone || tz;
    moneyFormat = j?.data?.shop?.currencyFormats?.moneyFormat || "";
    domain = j?.data?.shop?.primaryDomain?.host || domain;
    const d = (j?.data?.discountNodes?.nodes || []).find((n: any) => n?.discount?.title === BUNDLES_DISCOUNT_TITLE);
    discountStatus = !d ? "missing" : d.discount.status === "ACTIVE" ? "active" : "inactive";
  } catch {
    /* defaults */
  }

  const kits = await loadKits(shop.id);
  const since = dayToDate(localDay(Date.now() - 30 * 86_400_000, tz));
  const [stat, orders] = await Promise.all([
    prisma.xpDailyStat.groupBy({
      by: ["offerId"],
      where: { shopId: shop.id, feature: "kits", day: { gte: since } },
      _sum: { impressions: true, clicks: true, actions: true },
    }),
    prisma.xpOrder.findMany({
      where: { shopId: shop.id, day: { gte: since }, cancelled: false, sourcesJson: { contains: '"kits"' } },
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
        if (src.f !== "kits" || !src.o) continue;
        get(String(src.o)).revenue += Number(src.rev) || 0;
        seen.add(String(src.o));
      }
      for (const id of seen) get(id).orders += 1;
    } catch {
      /* skip */
    }
  }

  const handle = session.shop.replace(".myshopify.com", "");
  const apiKey = String(appCredentials?.apiKey || "").trim();
  return {
    enabled: shop.kitsEnabled,
    currency,
    moneyFormat,
    kits,
    stats,
    discountStatus,
    storeUrl: `https://${domain}`,
    hasCustomerScope: String(session.scope || "").split(",").includes("read_customers"),
    themeEditorUrl: `https://admin.shopify.com/store/${handle}/themes/current/editor?template=product${apiKey ? `&addAppBlockId=${apiKey}/kit-builder&target=mainSection` : ""}`,
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
  const sync = (): Promise<BundlesSyncResult> => syncAllDiscounts(admin, shop.id);

  if (intent === "toggleFeature") {
    const enable = form.get("enable") === "true";
    await prisma.shop.update({ where: { id: shop.id }, data: { kitsEnabled: enable } });
    const s = await sync();
    return { ok: s.state !== "error", message: (enable ? "Kit Builder is on. " : "Kit Builder is off. ") + s.message };
  }

  if (["toggleKit", "deleteKit", "duplicateKit", "moveKit"].includes(intent)) {
    const id = String(form.get("id") || "");
    const row = await prisma.kit.findFirst({ where: { id, shopId: shop.id } });
    if (!row) return { ok: false, message: "Kit not found." };
    if (intent === "toggleKit") {
      const enable = form.get("enable") === "true";
      if (enable) {
        const p = (await loadKits(shop.id)).find((k) => k.id === id)!;
        const errs = validateKit(p.config);
        if (errs.length) return { ok: false, message: "Fix this kit before turning it on: " + errs.join(" ") };
      }
      await prisma.kit.update({ where: { id }, data: { enabled: enable } });
    } else if (intent === "deleteKit") {
      await prisma.kit.delete({ where: { id } });
    } else if (intent === "duplicateKit") {
      const count = await prisma.kit.count({ where: { shopId: shop.id } });
      if (count >= KB_MAX_KITS) return { ok: false, message: `You can have up to ${KB_MAX_KITS} kits.` };
      const copy = await prisma.kit.create({
        data: { ...row, id: undefined, name: `${row.name} (copy)`.slice(0, 120), enabled: false, priority: row.priority + 1, createdAt: undefined, updatedAt: undefined } as any,
      });
      const s = await sync();
      return { ok: true, message: "Duplicated (paused). " + s.message, kitId: copy.id };
    } else if (intent === "moveKit") {
      const list = await prisma.kit.findMany({ where: { shopId: shop.id }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }], select: { id: true } });
      const i = list.findIndex((k) => k.id === id);
      const j = form.get("dir") === "up" ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < list.length) {
        [list[i], list[j]] = [list[j], list[i]];
        await prisma.$transaction(list.map((k, n) => prisma.kit.update({ where: { id: k.id }, data: { priority: (n + 1) * 10 } })));
      }
    }
    const s = await sync();
    return { ok: s.state !== "error", message: s.message };
  }

  if (intent === "saveKit") {
    let raw: any = {};
    try {
      raw = JSON.parse(String(form.get("payload") || "{}"));
    } catch {
      return { ok: false, message: "Couldn't read the form. Please try again." };
    }
    const config = sanitizeKbConfig(raw.config);
    const design: KbDesign = (KB_DESIGNS as readonly string[]).includes(raw.design) ? raw.design : "journey";
    const name = String(raw.name || "").trim().slice(0, 120) || "Untitled kit";
    let enabled = !!raw.enabled;
    const errors = validateKit(config);
    let note = "";
    if (errors.length && enabled) {
      enabled = false;
      note = " Saved as paused until these are fixed.";
    }
    const data = {
      name,
      design,
      enabled,
      configJson: JSON.stringify(config),
      placementJson: JSON.stringify(sanitizePlacement(raw.placement)),
      conditionsJson: JSON.stringify(sanitizeConditions(raw.conditions)),
      styleJson: JSON.stringify(sanitizeStyle(raw.style)),
      textsJson: JSON.stringify(sanitizeKbTexts(raw.texts)),
    };
    let id = String(raw.id || "");
    if (id && id !== "new") {
      const row = await prisma.kit.findFirst({ where: { id, shopId: shop.id }, select: { id: true } });
      if (!row) return { ok: false, message: "Kit not found." };
      await prisma.kit.update({ where: { id }, data });
    } else {
      const count = await prisma.kit.count({ where: { shopId: shop.id } });
      if (count >= KB_MAX_KITS) return { ok: false, message: `You can have up to ${KB_MAX_KITS} kits.` };
      const last = await prisma.kit.findFirst({ where: { shopId: shop.id }, orderBy: { priority: "desc" }, select: { priority: true } });
      const created = await prisma.kit.create({ data: { ...data, shopId: shop.id, priority: (last?.priority || 0) + 10 } });
      id = created.id;
    }
    const s = await sync();
    return { ok: !errors.length || !raw.enabled, errors, message: (errors.length ? "Saved." + note : "Saved.") + (s.message ? " " + s.message : ""), kitId: id };
  }
  return { ok: false, message: "Unknown action." };
};

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function KitsPage() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const { t } = useTranslations();
  const [params] = useSearchParams();
  const editing = params.get("kit");
  return (
    <s-page heading={t("Kit Builder")}>
      <style>{BB_CSS}</style>
      {editing ? <Editor key={`${editing}:${params.get("tpl") || ""}`} data={data} kitParam={editing} tpl={params.get("tpl")} /> : <ListView data={data} />}
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
  const kits = data.kits as unknown as ParsedKit[];
  const send = (fields: Record<string, string>) => fetcher.submit(fields, { method: "post" });
  const res = fetcher.data as any;

  useEffect(() => {
    if (res?.kitId && String(res.message || "").startsWith("Duplicated")) navigate(`/app/kits?kit=${res.kitId}`);
  }, [res, navigate]);

  return (
    <div className="bb-wrap">
      {res?.message ? <div className={`bb-banner ${res.ok === false ? "bad" : "ok"}`}>{t(res.message)}</div> : null}
      <div className="bb-card bb-hero">
        <div>
          <h2><Translate text="Let shoppers build a kit step by step" /></h2>
          <p><Translate text="One product (or several) in each step: a skincare routine, an outfit, a gift box, a setup. Add an optional quiz and sub-filters, show it on the page, in a drawer, in a pop-up or on its own landing page. The kit price is checked again at checkout." /></p>
        </div>
        <label className="bb-switch" title={t("Turn the whole feature on or off")}>
          <input type="checkbox" checked={data.enabled} disabled={busy} onChange={(e) => send({ intent: "toggleFeature", enable: String(e.target.checked) })} />
          <span className="knob" />
          <b>{data.enabled ? t("On") : t("Off")}</b>
        </label>
      </div>

      {data.enabled && data.discountStatus !== "active" && kits.some((k) => k.enabled && k.config.pricing.mode !== "none") ? (
        <div className="bb-banner warn">
          <Translate text="The checkout discount “XPoost Bundles” isn't active yet. Save any kit to create it. If it still doesn't activate, run npm run deploy so the pricing engine is installed." />
        </div>
      ) : null}

      <div className="bb-card">
        <h3 className="bb-title"><Translate text="Set up in 3 steps" /></h3>
        <ol className="bb-steps">
          <li>
            <b><Translate text="Create a kit below, add products to each step, and switch it on." /></b>
          </li>
          <li>
            <b><Translate text="Share its landing page, or add the block to a page." /></b>{" "}
            <Translate text="Every kit has its own landing page link inside your theme." />{" "}
            <a href={data.themeEditorUrl} target="_top"><Translate text="Or add “XPoost: Kit Builder” in the theme editor →" /></a>
          </li>
          <li>
            <b><Translate text="Build a kit in your store and go to checkout" /></b> <Translate text="to see the kit price there." />
          </li>
        </ol>
      </div>

      <div className="bb-card">
        <div className="bb-row" style={{ marginBottom: 12 }}>
          <h3 className="bb-title nb"><Translate text="Your kits" /></h3>
          <Link to="/app/kits?kit=new" className="bb-btn gold"><Translate text="+ New kit" /></Link>
        </div>
        {kits.length === 0 ? (
          <div className="bb-empty">
            <Translate text="No kits yet. Start from a template below, or" /> <Link to="/app/kits?kit=new"><Translate text="build one from scratch" /></Link>.
          </div>
        ) : (
          <div className="bb-table-wrap">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th><Translate text="Kit" /></th>
                  <th><Translate text="Price" /></th>
                  <th className="r"><Translate text="Views" /></th>
                  <th className="r"><Translate text="Add-to-cart rate" /></th>
                  <th className="r"><Translate text="Orders" /></th>
                  <th className="r"><Translate text="Revenue" /></th>
                  <th><Translate text="Live" /></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {kits.map((k, i) => {
                  const s = data.stats[k.id] || { views: 0, clicks: 0, adds: 0, orders: 0, revenue: 0 };
                  return (
                    <tr key={k.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="bb-icon" disabled={i === 0 || busy} onClick={() => send({ intent: "moveKit", id: k.id, dir: "up" })} aria-label={t("Move up")}>↑</button>{" "}
                        <button className="bb-icon" disabled={i === kits.length - 1 || busy} onClick={() => send({ intent: "moveKit", id: k.id, dir: "down" })} aria-label={t("Move down")}>↓</button>
                      </td>
                      <td>
                        <Link to={`/app/kits?kit=${k.id}`} className="bb-name">{k.name}</Link>
                        <div className="bb-muted bb-sm" style={{ marginTop: 3 }}>
                          <span className="bb-pill">{k.config.steps.length} {t("steps")}</span>
                          {t(KB_DESIGN_META[k.design].name)} · {t(KB_DISPLAY_META[k.config.display].name)}
                          {k.config.quiz.enabled ? ` · ${t("Quiz")}` : ""}
                        </div>
                      </td>
                      <td className="bb-muted bb-sm">{describePricing(k.config.pricing, money)}</td>
                      <td className="r bb-stat">{s.views.toLocaleString()}</td>
                      <td className="r bb-stat">{s.views >= 50 ? pct(s.adds, s.views) : "–"}</td>
                      <td className="r bb-stat">{s.orders || "–"}</td>
                      <td className="r bb-stat">{s.revenue ? money(s.revenue) : "–"}</td>
                      <td>
                        <label className="bb-switch sm">
                          <input type="checkbox" checked={k.enabled} disabled={busy} onChange={(e) => send({ intent: "toggleKit", id: k.id, enable: String(e.target.checked) })} />
                          <span className="knob" />
                        </label>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <a className="bb-btn ghost sm" href={`${data.storeUrl}/apps/xpoost/kit/${k.id}`} target="_blank" rel="noreferrer"><Translate text="Landing page" /></a>
                          <Link to={`/app/kits?kit=${k.id}`} className="bb-btn ghost sm"><Translate text="Edit" /></Link>
                          <button className="bb-btn ghost sm" disabled={busy} onClick={() => send({ intent: "duplicateKit", id: k.id })}><Translate text="Duplicate" /></button>
                          <button className="bb-btn ghost sm danger" disabled={busy} onClick={() => { if (window.confirm(t("Delete “{name}”? Kits already in carts stop getting the kit price.", { name: k.name }))) send({ intent: "deleteKit", id: k.id }); }}>
                            <Translate text="Delete" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="bb-muted bb-sm"><Translate text="Last 30 days. Revenue is what shoppers paid for kit items after the kit discount." /></p>
          </div>
        )}
      </div>

      <div className="bb-card">
        <h3 className="bb-title"><Translate text="Start from a template" /></h3>
        <div className="bb-tpl-grid">
          {KB_TEMPLATES.map((tp) => (
            <Link key={tp.key} to={`/app/kits?kit=new&tpl=${tp.key}`} className="bb-tpl">
              <div className="bb-tpl-name">{t(tp.name)}</div>
              <div className="bb-tpl-tag">{t(tp.tagline)}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Editor
// ─────────────────────────────────────────────────────────────

type Draft = { id: string; name: string; design: KbDesign; enabled: boolean; config: KbConfig; placement: BbPlacement; conditions: BbConditions; style: BbStyle; texts: KbTextsByLang };

function newDraft(tplKey: string | null): Draft {
  const tpl = KB_TEMPLATES.find((x) => x.key === tplKey);
  const config = defaultKbConfig();
  let design: KbDesign = "journey";
  let texts: KbTextsByLang = {};
  let name = "New kit";
  if (tpl) {
    const b = tpl.build();
    Object.assign(config, { steps: b.steps, quiz: b.quiz, pricing: b.pricing });
    design = b.design;
    texts = { en: { title: b.title, subtitle: b.subtitle } };
    name = tpl.name;
  }
  return { id: "new", name, design, enabled: true, config, placement: { ...defaultPlacement(), mode: "landing" }, conditions: { match: "all", rules: [] }, style: { ...KB_DEFAULT_STYLE }, texts };
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

function PoolPicker({ value, onChange }: { value: KbPool; onChange: (p: KbPool) => void }) {
  const { t } = useTranslations();
  return (
    <div className="bb-grid2">
      <div>
        <div className="bb-label" style={{ marginBottom: 6 }}>{t("Products")}</div>
        <ProductPicker value={value.products} max={KB_MAX_POOL_PRODUCTS} onChange={(products) => onChange({ ...value, products })} />
      </div>
      <div>
        <div className="bb-label" style={{ marginBottom: 6 }}>{t("Collections")}</div>
        <CollectionPicker value={value.collections} max={KB_MAX_POOL_COLLECTIONS} onChange={(collections) => onChange({ ...value, collections })} />
      </div>
    </div>
  );
}

/** Same payload the storefront receives from the app proxy, built from the draft. */
function previewPayload(d: Draft, lang: BbLang, catalog: { products: Record<string, PreviewProduct>; collections: Record<string, string[]> }) {
  const products: Record<string, any> = {};
  const use = (p: { id: string; handle: string; title: string; imageUrl: string; price: string; variantId?: string }) => {
    const real = catalog.products[numericId(p.id)];
    if (real) {
      products[real.handle] = real;
      return real.handle;
    }
    products[p.handle] = { id: numericId(p.id), handle: p.handle, title: p.title, image: p.imageUrl, available: true, variants: [{ id: numericId(p.variantId || p.id), title: "", price: Math.round(Number(p.price || 0) * 100), compare: 0, available: true, image: "" }] };
    return p.handle;
  };
  const handlesOf = (pool: KbPool, seed: string, fillEmpty: boolean) => {
    const out = pool.products.map(use);
    for (const col of pool.collections) {
      const list = catalog.collections[numericId(col.id)];
      if (list && list.length) {
        for (const h of list) {
          const real = Object.values(catalog.products).find((x) => x.handle === h);
          if (real && !out.includes(h)) {
            products[h] = real;
            out.push(h);
          }
        }
      } else {
        for (const p of placeholderProducts(`${seed}c`, 3)) {
          products[p.handle] = p;
          out.push(p.handle);
        }
      }
    }
    if (!out.length && fillEmpty) {
      for (const p of placeholderProducts(seed, 4)) {
        products[p.handle] = p;
        out.push(p.handle);
      }
    }
    return out;
  };
  const texts = resolveKbTexts(d.texts, lang);
  const c = d.config;
  const steps = c.steps.map((s, i) => {
    const pools: Record<string, string[]> = {};
    if (s.byAnswer) for (const [opt, p] of Object.entries(s.byAnswer.pools)) pools[opt] = handlesOf(p, `a${i}${opt}`, false);
    const anyAnswer = Object.values(pools).some((h) => h.length);
    return {
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      pick: s.pick,
      min: s.min,
      max: s.max,
      handles: handlesOf(s, `s${i}`, !anyAnswer),
      filters: s.filters.map((f, k) => ({ id: f.id, label: f.label, handles: handlesOf(f, `f${i}${k}`, false) })),
      byAnswer: s.byAnswer ? { q: s.byAnswer.q, pools } : null,
      showIf: s.showIf,
    };
  });
  let gift = null as null | { handle: string; variantId: string; minItems: number };
  if (c.gift.enabled && c.gift.product) {
    const h = use(c.gift.product);
    gift = { handle: h, variantId: products[h]?.variants?.[0]?.id || numericId(c.gift.product.variantId || ""), minItems: c.gift.minItems };
  }
  return {
    kit: {
      id: d.id,
      name: d.name,
      design: d.design,
      display: c.display,
      afterAdd: "stay",
      hideSoldOut: c.hideSoldOut,
      allowDuplicates: c.allowDuplicates,
      heroImage: c.heroImage,
      quiz: c.quiz.enabled ? c.quiz : { enabled: false, questions: [] },
      steps,
      pricing: c.pricing,
      gift,
      style: d.style,
      texts,
    },
    products,
  };
}

function Editor({ data, kitParam, tpl }: { data: LoaderData; kitParam: string; tpl: string | null }) {
  const { t, locale } = useTranslations();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const existing = (data.kits as unknown as ParsedKit[]).find((k) => k.id === kitParam);
  const [d, setD] = useState<Draft>(() =>
    existing ? { id: existing.id, name: existing.name, design: existing.design, enabled: existing.enabled, config: existing.config, placement: existing.placement, conditions: existing.conditions, style: existing.style, texts: existing.texts } : newDraft(tpl),
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
  const c = d.config;
  const setC = (patch: Partial<KbConfig>) => set({ config: { ...c, ...patch } });
  const setP = (patch: Partial<KbConfig["pricing"]>) => setC({ pricing: { ...c.pricing, ...patch } });
  const setStep = (id: string, patch: Partial<KbStep>) => setC({ steps: c.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const setQuestions = (questions: KbQuestion[]) => setC({ quiz: { ...c.quiz, questions } });

  useEffect(() => {
    if (res?.kitId && d.id === "new") {
      setD((x) => ({ ...x, id: res.kitId }));
      navigate(`/app/kits?kit=${res.kitId}`, { replace: true });
    }
    if (res && fetcher.state === "idle") setDirty(false);
  }, [res, fetcher.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real product data for the preview
  const allPools = useMemo(() => {
    const pools: KbPool[] = [];
    c.steps.forEach((s) => {
      pools.push(s);
      s.filters.forEach((f) => pools.push(f));
      Object.values(s.byAnswer?.pools || {}).forEach((p) => pools.push(p));
    });
    return pools;
  }, [c.steps]);
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    allPools.forEach((p) => p.products.forEach((x) => ids.add(numericId(x.id))));
    if (c.gift.product) ids.add(numericId(c.gift.product.id));
    return [...ids].sort().slice(0, 60).join(",");
  }, [allPools, c.gift.product]);
  const collectionIds = useMemo(() => [...new Set(allPools.flatMap((p) => p.collections.map((x) => numericId(x.id))))].sort().slice(0, 6).join(","), [allPools]);
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
  const errors = validateKit(c);
  const size = kitSize(c);
  const save = () => fetcher.submit({ intent: "saveKit", payload: JSON.stringify(d) }, { method: "post" });

  const texts = d.texts[lang] || {};
  const setText = (k: KbTextKey, v: string) => set({ texts: { ...d.texts, [lang]: { ...texts, [k]: v } } });
  const setLabel = (id: string, v: string) => set({ texts: { ...d.texts, [lang]: { ...texts, labels: { ...(texts.labels || {}), [id]: v } } } });
  const defaults = KB_DEFAULT_TEXTS[lang];
  const landingUrl = d.id !== "new" ? `${data.storeUrl}/apps/xpoost/kit/${d.id}` : "";
  const questions = c.quiz.enabled ? c.quiz.questions : [];

  return (
    <div className="bb-wrap">
      <div className="bb-topbar">
        <Link to="/app/kits" className="bb-btn ghost sm">← <Translate text="All kits" /></Link>
        <div className="bb-topbar-r">
          {res?.message && !busy ? <span className={`bb-flash ${res.ok === false ? "bad" : "ok"}`}>{t(res.message)}</span> : dirty ? <span className="bb-flash"><Translate text="Unsaved changes" /></span> : null}
          <label className="bb-switch sm">
            <input type="checkbox" checked={d.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            <span className="knob" />
            {d.enabled ? t("Live") : t("Paused")}
          </label>
          <button className="bb-btn gold" disabled={busy} onClick={save}>{busy ? t("Saving…") : t("Save")}</button>
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
          {/* 1. Name */}
          <Section n={1} title="Kit">
            <div className="bb-field">
              <label htmlFor="kb-name"><Translate text="Internal name" /></label>
              <input id="kb-name" className="bb-input" value={d.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} />
              <small><Translate text="Only you see this. Shoppers see the heading you set under Texts." /></small>
            </div>
          </Section>

          {/* 2. Quiz */}
          <Section n={2} title="Quiz (optional)" desc="Ask 1 to 4 short questions first. Answers can change the products in each step, or hide a step.">
            <label className="bb-check">
              <input
                type="checkbox"
                checked={c.quiz.enabled}
                onChange={(e) => setC({ quiz: { enabled: e.target.checked, questions: c.quiz.questions.length ? c.quiz.questions : [{ id: newKbId(), title: "", options: [{ id: newKbId(), label: "" }, { id: newKbId(), label: "" }] }] } })}
              />
              <span><b><Translate text="Start with a quiz" /></b><small><Translate text="Shoppers can always skip it and see every product." /></small></span>
            </label>
            {c.quiz.enabled ? (
              <>
                {c.quiz.questions.map((q, qi) => (
                  <div key={q.id} className="bb-box">
                    <div className="bb-box-h">
                      <span className="n">{qi + 1}</span>
                      <input className="bb-input" value={q.title} placeholder={t("Question, e.g. What is your skin type?")} maxLength={140} onChange={(e) => setQuestions(c.quiz.questions.map((x) => (x.id === q.id ? { ...x, title: e.target.value } : x)))} />
                      <button type="button" className="bb-icon danger" disabled={c.quiz.questions.length <= 1} onClick={() => setQuestions(c.quiz.questions.filter((x) => x.id !== q.id))} aria-label={t("Remove question")}>✕</button>
                    </div>
                    {q.options.map((o, oi) => (
                      <div key={o.id} className="bb-opt">
                        <span className="bb-muted bb-sm" style={{ width: 18 }}>{String.fromCharCode(65 + oi)}</span>
                        <input className="bb-input" value={o.label} placeholder={t("Answer")} maxLength={60} onChange={(e) => setQuestions(c.quiz.questions.map((x) => (x.id === q.id ? { ...x, options: x.options.map((y) => (y.id === o.id ? { ...y, label: e.target.value } : y)) } : x)))} />
                        <button type="button" className="bb-icon danger" disabled={q.options.length <= 2} onClick={() => setQuestions(c.quiz.questions.map((x) => (x.id === q.id ? { ...x, options: x.options.filter((y) => y.id !== o.id) } : x)))} aria-label={t("Remove answer")}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="bb-btn ghost sm" disabled={q.options.length >= KB_MAX_OPTIONS} onClick={() => setQuestions(c.quiz.questions.map((x) => (x.id === q.id ? { ...x, options: [...x.options, { id: newKbId(), label: "" }] } : x)))}>
                      <Translate text="+ Add answer" />
                    </button>
                  </div>
                ))}
                <button type="button" className="bb-btn ghost sm" disabled={c.quiz.questions.length >= KB_MAX_QUESTIONS} onClick={() => setQuestions([...c.quiz.questions, { id: newKbId(), title: "", options: [{ id: newKbId(), label: "" }, { id: newKbId(), label: "" }] }])}>
                  <Translate text="+ Add question" />
                </button>
              </>
            ) : null}
          </Section>

          {/* 3. Steps */}
          <Section n={3} title="Steps" desc="Each step has its own products. Shoppers go through the steps in order.">
            {c.steps.map((s, i) => (
              <div key={s.id} className="bb-box">
                <div className="bb-box-h">
                  <span className="n">{i + 1}</span>
                  <input className="bb-input" value={s.title} placeholder={t("Step title, e.g. Choose your cleanser")} maxLength={80} onChange={(e) => setStep(s.id, { title: e.target.value })} />
                  <button type="button" className="bb-icon" disabled={i === 0} onClick={() => { const st = [...c.steps]; [st[i - 1], st[i]] = [st[i], st[i - 1]]; setC({ steps: st }); }} aria-label={t("Move up")}>↑</button>
                  <button type="button" className="bb-icon" disabled={i === c.steps.length - 1} onClick={() => { const st = [...c.steps]; [st[i + 1], st[i]] = [st[i], st[i + 1]]; setC({ steps: st }); }} aria-label={t("Move down")}>↓</button>
                  <button type="button" className="bb-icon danger" disabled={c.steps.length <= 1} onClick={() => setC({ steps: c.steps.filter((x) => x.id !== s.id) })} aria-label={t("Remove step")}>✕</button>
                </div>
                <input className="bb-input" style={{ marginBottom: 10 }} value={s.subtitle} placeholder={t("Short line under the title (optional)")} maxLength={140} onChange={(e) => setStep(s.id, { subtitle: e.target.value })} />
                <div className="bb-seg sm" style={{ marginBottom: 10 }}>
                  <button type="button" className={s.pick === "one" ? "on" : ""} onClick={() => setStep(s.id, { pick: "one", max: 1, min: Math.min(1, s.min) })}>{t("One pick, then the next step")}</button>
                  <button type="button" className={s.pick === "many" ? "on" : ""} onClick={() => setStep(s.id, { pick: "many", max: Math.max(2, s.max), min: Math.max(s.min, 1) })}>{t("Several picks with a Next button")}</button>
                </div>
                {s.pick === "many" ? (
                  <div className="bb-inline" style={{ marginBottom: 10 }}>
                    <span className="bb-label"><Translate text="Shopper picks" /></span>
                    <input className="bb-input xs" type="number" min={0} max={s.max} value={s.min} onChange={(e) => setStep(s.id, { min: Math.max(0, Math.min(s.max, Number(e.target.value) || 0)) })} aria-label={t("Minimum")} />
                    <span className="bb-muted"><Translate text="to" /></span>
                    <input className="bb-input xs" type="number" min={1} max={KB_MAX_ITEMS} value={s.max} onChange={(e) => { const max = Math.max(1, Math.min(KB_MAX_ITEMS, Number(e.target.value) || 1)); setStep(s.id, { max, min: Math.min(s.min, max) }); }} aria-label={t("Maximum")} />
                    <span className="bb-muted"><Translate text="items" /></span>
                  </div>
                ) : null}
                <label className="bb-check">
                  <input type="checkbox" checked={s.min === 0} onChange={(e) => setStep(s.id, { min: e.target.checked ? 0 : 1 })} />
                  <span><Translate text="Optional step" /><small><Translate text="Shoppers can skip it." /></small></span>
                </label>
                <PoolPicker value={s} onChange={(p) => setStep(s.id, p)} />

                {/* Sub-filters */}
                <details className="bb-sub" open={s.filters.length > 0}>
                  <summary className="bb-sub-h"><b><Translate text="Sub-filters (optional)" /></b><span className="bb-muted bb-sm"><Translate text="Small buttons above the products, e.g. Oily skin, Sensitive skin. Each one shows only its products." /></span></summary>
                  {s.filters.map((f) => (
                    <div key={f.id} className="bb-box" style={{ marginTop: 8 }}>
                      <div className="bb-box-h">
                        <input className="bb-input" value={f.label} placeholder={t("Filter name, e.g. Oily skin")} maxLength={40} onChange={(e) => setStep(s.id, { filters: s.filters.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)) })} />
                        <button type="button" className="bb-icon danger" onClick={() => setStep(s.id, { filters: s.filters.filter((x) => x.id !== f.id) })} aria-label={t("Remove filter")}>✕</button>
                      </div>
                      <PoolPicker value={f} onChange={(p) => setStep(s.id, { filters: s.filters.map((x) => (x.id === f.id ? { ...x, ...p } : x)) })} />
                    </div>
                  ))}
                  <button type="button" className="bb-btn ghost sm" style={{ marginTop: 8 }} disabled={s.filters.length >= KB_MAX_FILTERS} onClick={() => setStep(s.id, { filters: [...s.filters, { id: newKbId(), label: "", products: [], collections: [] }] })}>
                    <Translate text="+ Add sub-filter" />
                  </button>
                </details>

                {/* Quiz-driven products */}
                {questions.length ? (
                  <details className="bb-sub" open={!!s.byAnswer || !!s.showIf}>
                    <summary className="bb-sub-h"><b><Translate text="Products by quiz answer (optional)" /></b></summary>
                    <select className="bb-input" value={s.byAnswer?.q || ""} onChange={(e) => setStep(s.id, { byAnswer: e.target.value ? { q: e.target.value, pools: s.byAnswer && s.byAnswer.q === e.target.value ? s.byAnswer.pools : {} } : null })}>
                      <option value="">{t("Same products for every answer")}</option>
                      {questions.map((q, qi) => <option key={q.id} value={q.id}>{t("Change with the answer to:")} {q.title || `${t("Question")} ${qi + 1}`}</option>)}
                    </select>
                    {s.byAnswer
                      ? (questions.find((q) => q.id === s.byAnswer!.q)?.options || []).map((o, oi) => (
                          <div key={o.id} className="bb-box" style={{ marginTop: 8 }}>
                            <div className="bb-box-h"><b>{t("If the answer is")} “{o.label || String.fromCharCode(65 + oi)}”</b></div>
                            <PoolPicker value={s.byAnswer!.pools[o.id] || { products: [], collections: [] }} onChange={(p) => setStep(s.id, { byAnswer: { q: s.byAnswer!.q, pools: { ...s.byAnswer!.pools, [o.id]: p } } })} />
                          </div>
                        ))
                      : null}
                    {s.byAnswer ? <small className="bb-hint"><Translate text="Answers without products here show the step's main products." /></small> : null}

                    <div className="bb-sub-h" style={{ marginTop: 12 }}><b><Translate text="Show this step only for some answers (optional)" /></b></div>
                    <select className="bb-input" value={s.showIf?.q || ""} onChange={(e) => setStep(s.id, { showIf: e.target.value ? { q: e.target.value, options: [] } : null })}>
                      <option value="">{t("Always show this step")}</option>
                      {questions.map((q, qi) => <option key={q.id} value={q.id}>{t("Depends on the answer to:")} {q.title || `${t("Question")} ${qi + 1}`}</option>)}
                    </select>
                    {s.showIf ? (
                      <div className="bb-chips" style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(questions.find((q) => q.id === s.showIf!.q)?.options || []).map((o, oi) => {
                          const on = s.showIf!.options.includes(o.id);
                          return (
                            <button key={o.id} type="button" className={`bb-tag${on ? " on" : ""}`} onClick={() => setStep(s.id, { showIf: { q: s.showIf!.q, options: on ? s.showIf!.options.filter((x) => x !== o.id) : [...s.showIf!.options, o.id] } })}>
                              {on ? "✓ " : ""}{o.label || String.fromCharCode(65 + oi)}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </details>
                ) : null}
              </div>
            ))}
            <button type="button" className="bb-btn ghost sm" disabled={c.steps.length >= KB_MAX_STEPS} onClick={() => setC({ steps: [...c.steps, newStep(`Step ${c.steps.length + 1}`)] })}>
              <Translate text="+ Add step" />
            </button>
            <div style={{ marginTop: 14 }}>
              <label className="bb-check">
                <input type="checkbox" checked={c.allowDuplicates} onChange={(e) => setC({ allowDuplicates: e.target.checked })} />
                <span><Translate text="Allow the same product more than once in a step" /><small><Translate text="Only for steps with several picks." /></small></span>
              </label>
              <label className="bb-check">
                <input type="checkbox" checked={c.allowMultiples} onChange={(e) => setC({ allowMultiples: e.target.checked })} />
                <span><Translate text="Keep the kit price when the shopper raises quantities in the cart" /><small><Translate text="e.g. 2 complete kits get the kit price twice" /></small></span>
              </label>
              <label className="bb-check">
                <input type="checkbox" checked={c.hideSoldOut} onChange={(e) => setC({ hideSoldOut: e.target.checked })} />
                <span><Translate text="Hide sold-out products and variants" /></span>
              </label>
            </div>
          </Section>

          {/* 4. Price */}
          <Section n={4} title="Price" desc="The kit price applies once the kit is complete. It's checked again at checkout.">
            <div className="bb-cards" style={{ marginBottom: 14 }}>
              {BB_PRICE_MODES.map((m) => (
                <button key={m} type="button" className={`bb-choice${c.pricing.mode === m ? " on" : ""}`} onClick={() => setP({ mode: m as BbPriceMode, tiers: m === "tiers" && !c.pricing.tiers.length ? [{ min: Math.max(2, size.min), mode: "percent", value: 10 }, { min: Math.max(3, size.min + 1), mode: "percent", value: 15 }] : c.pricing.tiers })}>
                  <b>{t(BB_PRICE_META[m].name)}</b>
                  <span>{t(BB_PRICE_META[m].blurb)}</span>
                </button>
              ))}
            </div>
            {c.pricing.mode === "percent" || c.pricing.mode === "amount" || c.pricing.mode === "price" ? (
              <div className="bb-inline">
                <span className="bb-label">{c.pricing.mode === "percent" ? t("Percentage off") : c.pricing.mode === "amount" ? t("Amount off the kit") : t("Kit price")}</span>
                <input className="bb-input sm" type="number" min={0} max={c.pricing.mode === "percent" ? 100 : undefined} step="0.01" value={c.pricing.value} onChange={(e) => setP({ value: Number(e.target.value) || 0 })} />
                <span className="bb-muted">{c.pricing.mode === "percent" ? "%" : data.currency}</span>
              </div>
            ) : null}
            {c.pricing.mode === "tiers" ? (
              <div className="bb-tiers">
                {c.pricing.tiers.map((tr, i) => (
                  <div key={i} className="bb-tier">
                    <input className="bb-input xs" type="number" min={1} max={99} value={tr.min} onChange={(e) => setP({ tiers: c.pricing.tiers.map((x, k) => (k === i ? { ...x, min: Math.max(1, Number(e.target.value) || 1) } : x)) })} aria-label={t("Items")} />
                    <span><Translate text="or more items:" /></span>
                    <select className="bb-input sm" value={tr.mode} onChange={(e) => setP({ tiers: c.pricing.tiers.map((x, k) => (k === i ? { ...x, mode: e.target.value as any } : x)) })}>
                      <option value="percent">{t("% off")}</option>
                      <option value="amount">{t("amount off")}</option>
                      <option value="price">{t("kit price")}</option>
                    </select>
                    <input className="bb-input xs" type="number" min={0} step="0.01" value={tr.value} onChange={(e) => setP({ tiers: c.pricing.tiers.map((x, k) => (k === i ? { ...x, value: Number(e.target.value) || 0 } : x)) })} aria-label={t("Value")} />
                    <span className="bb-muted">{tr.mode === "percent" ? "%" : data.currency}</span>
                    <button type="button" className="bb-icon danger" onClick={() => setP({ tiers: c.pricing.tiers.filter((_, k) => k !== i) })} aria-label={t("Remove tier")}>✕</button>
                  </div>
                ))}
                <div>
                  <button type="button" className="bb-btn ghost sm" disabled={c.pricing.tiers.length >= 6} onClick={() => setP({ tiers: [...c.pricing.tiers, { min: (c.pricing.tiers.at(-1)?.min || 1) + 1, mode: "percent", value: 20 }] })}>
                    <Translate text="+ Add tier" />
                  </button>
                </div>
              </div>
            ) : null}
            {c.pricing.mode === "cheapest" ? (
              <div className="bb-inline">
                <span className="bb-label"><Translate text="The cheapest" /></span>
                <input className="bb-input xs" type="number" min={1} max={10} value={c.pricing.cheapestCount} onChange={(e) => setP({ cheapestCount: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} aria-label={t("Items")} />
                <span className="bb-label"><Translate text="item(s) get" /></span>
                <input className="bb-input xs" type="number" min={1} max={100} value={c.pricing.cheapestPercent} onChange={(e) => setP({ cheapestPercent: Math.max(1, Math.min(100, Number(e.target.value) || 100)) })} aria-label={t("Percent")} />
                <span className="bb-muted"><Translate text="% off (100 = free)" /></span>
              </div>
            ) : null}
            <div className="bb-box" style={{ marginTop: 16 }}>
              <label className="bb-check" style={{ marginBottom: c.gift.enabled ? 10 : 0 }}>
                <input type="checkbox" checked={c.gift.enabled} onChange={(e) => setC({ gift: { ...c.gift, enabled: e.target.checked } })} />
                <span><b><Translate text="Add a free gift" /></b><small><Translate text="Added automatically with the kit and made free at checkout (one per kit)." /></small></span>
              </label>
              {c.gift.enabled ? (
                <>
                  <ProductPicker value={c.gift.product ? [c.gift.product] : []} max={1} onChange={(list) => setC({ gift: { ...c.gift, product: list[0] || null } })} placeholder={t("Search the gift product")} />
                  <div className="bb-inline" style={{ marginTop: 10 }}>
                    <span className="bb-label"><Translate text="When the kit has at least" /></span>
                    <input className="bb-input xs" type="number" min={1} max={24} value={c.gift.minItems} onChange={(e) => setC({ gift: { ...c.gift, minItems: Math.max(1, Math.min(24, Number(e.target.value) || 1)) } })} aria-label={t("Items")} />
                    <span className="bb-muted"><Translate text="items" /></span>
                  </div>
                </>
              ) : null}
            </div>
          </Section>

          {/* 5. Design & display */}
          <Section n={5} title="Design" desc="Every design uses your colors and the shopper's language. Check it in the preview.">
            <div className="bb-design-grid" style={{ marginBottom: 16 }}>
              {KB_DESIGNS.map((ds) => (
                <button key={ds} type="button" className={`bb-design${d.design === ds ? " on" : ""}`} onClick={() => set({ design: ds })}>
                  <KbSchematic design={ds} />
                  <span className="bb-design-name">{t(KB_DESIGN_META[ds].name)}</span>
                  <span className="bb-design-blurb">{t(KB_DESIGN_META[ds].blurb)}</span>
                </button>
              ))}
            </div>
            <div className="bb-field">
              <label><Translate text="How it opens" /></label>
              <div className="bb-cards">
                {KB_DISPLAYS.map((m) => (
                  <button key={m} type="button" className={`bb-choice${c.display === m ? " on" : ""}`} onClick={() => setC({ display: m })}>
                    <b>{t(KB_DISPLAY_META[m].name)}</b>
                    <span>{t(KB_DISPLAY_META[m].blurb)}</span>
                  </button>
                ))}
              </div>
            </div>
            {c.display === "page" ? (
              <div className="bb-field">
                <label htmlFor="kb-hero"><Translate text="Banner image link (optional)" /></label>
                <input id="kb-hero" className="bb-input" value={c.heroImage} placeholder="https://cdn.shopify.com/…" maxLength={1000} onChange={(e) => setC({ heroImage: e.target.value.trim() })} />
                <small><Translate text="Upload an image in Shopify → Content → Files and paste its link. It sits behind the heading." /></small>
              </div>
            ) : null}
            <div className="bb-idbox" style={{ marginTop: 6 }}>
              <span><Translate text="Landing page" /></span>
              {landingUrl ? (
                <>
                  <code>{landingUrl}</code>
                  <button type="button" className="bb-btn ghost sm" onClick={() => navigator.clipboard?.writeText(landingUrl)}><Translate text="Copy" /></button>
                  <a className="bb-btn ghost sm" href={landingUrl} target="_blank" rel="noreferrer"><Translate text="Open" /></a>
                </>
              ) : (
                <span className="bb-muted bb-sm"><Translate text="The link appears here after the first save." /></span>
              )}
            </div>
            <p className="bb-hint"><Translate text="The landing page always shows the full-page layout, whatever you pick above. Add it to your menu or use it in ads." /></p>
            <div className="bb-field" style={{ marginTop: 10 }}>
              <label htmlFor="kb-after"><Translate text="After “Add to cart”" /></label>
              <select id="kb-after" className="bb-input" value={c.afterAdd} onChange={(e) => setC({ afterAdd: e.target.value as any })}>
                <option value="drawer">{t("Open the cart drawer")}</option>
                <option value="cart">{t("Go to the cart page")}</option>
                <option value="checkout">{t("Go straight to checkout")}</option>
                <option value="stay">{t("Stay on the page and show a message")}</option>
              </select>
            </div>
          </Section>

          {/* 6. Where */}
          <Section n={6} title="Where it shows" desc="Besides its landing page, a kit can show on product pages that have the Kit Builder block.">
            <div className="bb-cards" style={{ marginBottom: 12 }}>
              {BB_PLACEMENTS.map((m) => (
                <button key={m} type="button" className={`bb-choice${d.placement.mode === m ? " on" : ""}`} onClick={() => set({ placement: { ...d.placement, mode: m } })}>
                  <b>{t(PLACEMENT_META[m].name)}</b>
                  <span>{t(PLACEMENT_META[m].blurb)}</span>
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
                <span><Translate text="Kit ID" /></span>
                <code>{d.id}</code>
                <button type="button" className="bb-btn ghost sm" onClick={() => navigator.clipboard?.writeText(d.id)}><Translate text="Copy" /></button>
              </div>
            ) : null}
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

          {/* 7. Who */}
          <Section n={7} title="Who gets it" desc="Target customers by tag, order history, spend, country or market. The same rules decide the price at checkout.">
            <ConditionBuilder value={d.conditions} onChange={(conditions) => set({ conditions })} currency={data.currency} hasScope={data.hasCustomerScope} />
            <div className="bb-grid2" style={{ marginTop: 16 }}>
              <div className="bb-field">
                <label htmlFor="kb-start"><Translate text="Starts on (optional)" /></label>
                <input id="kb-start" className="bb-input" type="date" value={c.startsAt} onChange={(e) => setC({ startsAt: e.target.value })} />
              </div>
              <div className="bb-field">
                <label htmlFor="kb-end"><Translate text="Ends after (optional)" /></label>
                <input id="kb-end" className="bb-input" type="date" value={c.endsAt} onChange={(e) => setC({ endsAt: e.target.value })} />
              </div>
            </div>
          </Section>

          {/* 8. Style */}
          <Section n={8} title="Colors & style" desc="Defaults are neutral so the kit fits any theme. Match them to your brand.">
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
                <label htmlFor="kb-rad"><Translate text="Corner radius" /> ({d.style.radius}px)</label>
                <input id="kb-rad" type="range" min={0} max={28} value={d.style.radius} onChange={(e) => set({ style: { ...d.style, radius: Number(e.target.value) } })} />
              </div>
              <div className="bb-field">
                <label htmlFor="kb-cols"><Translate text="Columns on desktop" /></label>
                <select id="kb-cols" className="bb-input" value={d.style.columns} onChange={(e) => set({ style: { ...d.style, columns: Number(e.target.value) } })}>
                  {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="bb-field">
                <label htmlFor="kb-ratio"><Translate text="Image shape" /></label>
                <select id="kb-ratio" className="bb-input" value={d.style.imageRatio} onChange={(e) => set({ style: { ...d.style, imageRatio: e.target.value as any } })}>
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
              <textarea className="bb-input" rows={6} value={d.style.customCss} placeholder={".xpk-title { letter-spacing: .02em; }"} onChange={(e) => set({ style: { ...d.style, customCss: e.target.value } })} />
              <small className="bb-hint"><Translate text="Classes start with .xpk-" /></small>
            </details>
            <button type="button" className="bb-btn ghost sm" onClick={() => set({ style: { ...KB_DEFAULT_STYLE, customCss: d.style.customCss } })}><Translate text="Reset to neutral" /></button>
          </Section>

          {/* 9. Texts */}
          <Section n={9} title="Texts & languages" desc="Shoppers see the language of your store. Empty fields use the built-in translation.">
            <div className="bb-langs">
              {BB_LANGS.map((l) => (
                <button key={l} type="button" className={`bb-lang${lang === l ? " on" : ""}`} onClick={() => setLang(l)}>
                  {BB_LANG_META[l].name}
                  {d.texts[l] && Object.keys(d.texts[l] || {}).length ? <span className="dot" aria-label={t("Edited")} /> : null}
                </button>
              ))}
            </div>
            <div dir={BB_LANG_META[lang].dir}>
              {KB_MAIN_TEXTS.map((k) => (
                <div key={k} className="bb-field">
                  <label htmlFor={`kb-t-${k}`}>{t(KB_TEXT_META[k].label)}{KB_TEXT_META[k].vars ? <span className="bb-muted bb-sm"> {KB_TEXT_META[k].vars}</span> : null}</label>
                  <input id={`kb-t-${k}`} className="bb-input" value={texts[k] || ""} placeholder={defaults[k]} maxLength={200} onChange={(e) => setText(k, e.target.value)} />
                </div>
              ))}
              {lang !== "en" ? (
                <div className="bb-field">
                  <label><Translate text="Steps, questions and filters in this language" /></label>
                  {c.steps.map((s, i) => (
                    <div key={s.id}>
                      <input className="bb-input" style={{ marginBottom: 6 }} value={texts.labels?.[s.id] || ""} placeholder={s.title || `${t("Step")} ${i + 1}`} maxLength={80} onChange={(e) => setLabel(s.id, e.target.value)} />
                      {s.subtitle ? <input className="bb-input" style={{ marginBottom: 6 }} value={texts.labels?.[`${s.id}:s`] || ""} placeholder={s.subtitle} maxLength={140} onChange={(e) => setLabel(`${s.id}:s`, e.target.value)} /> : null}
                      {s.filters.map((f) => <input key={f.id} className="bb-input" style={{ marginBottom: 6 }} value={texts.labels?.[f.id] || ""} placeholder={f.label} maxLength={40} onChange={(e) => setLabel(f.id, e.target.value)} />)}
                    </div>
                  ))}
                  {questions.map((q) => (
                    <div key={q.id}>
                      <input className="bb-input" style={{ marginBottom: 6 }} value={texts.labels?.[q.id] || ""} placeholder={q.title} maxLength={140} onChange={(e) => setLabel(q.id, e.target.value)} />
                      {q.options.map((o) => <input key={o.id} className="bb-input" style={{ marginBottom: 6 }} value={texts.labels?.[o.id] || ""} placeholder={o.label} maxLength={60} onChange={(e) => setLabel(o.id, e.target.value)} />)}
                    </div>
                  ))}
                </div>
              ) : null}
              <details className="bb-details">
                <summary><Translate text="All texts (buttons, messages, steps)" /></summary>
                <div className="bb-grid2">
                  {KB_TEXT_KEYS.filter((k) => !KB_MAIN_TEXTS.includes(k)).map((k) => (
                    <div key={k} className="bb-field">
                      <label htmlFor={`kb-t-${k}`}>{t(KB_TEXT_META[k].label)}{KB_TEXT_META[k].vars ? <span className="bb-muted bb-sm"> {KB_TEXT_META[k].vars}</span> : null}</label>
                      <input id={`kb-t-${k}`} className="bb-input" value={texts[k] || ""} placeholder={defaults[k]} maxLength={200} onChange={(e) => setText(k, e.target.value)} />
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
            <KitPreview payload={payload} rtl={BB_LANG_META[lang].dir === "rtl"} moneyFormat={data.moneyFormat} currency={data.currency} device={device} />
            <p className="bb-hint" style={{ margin: "10px 0 0" }}><Translate text="This runs the same code as your store. Sample products fill empty steps; prices use your store currency." /></p>
          </div>
          {errors.length ? (
            <div className="bb-banner warn">
              <Translate text="Before this kit can go live:" />
              <ul>{errors.map((e) => <li key={e}>{t(e)}</li>)}</ul>
            </div>
          ) : (
            <div className="bb-card" style={{ padding: 14 }}>
              <p className="bb-tip"><i>✓</i><span>{t("One complete kit: {min}–{max} items · {price}", { min: size.min, max: size.max, price: describePricing(c.pricing, money) })}</span></p>
              <p className="bb-tip" style={{ margin: 0 }}><i>✓</i><span>{t("Shown to: {who}", { who: describeConditions(d.conditions, money) })}</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
