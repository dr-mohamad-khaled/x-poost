import { Translate } from "../components/Translate";
import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { dayToDate, localDay } from "../utils/analytics";
import { parseOffer, type ParsedOffer } from "../thankyou.server";
import {
  TY_DESIGN_META,
  TY_KINDS,
  TY_KIND_META,
  TY_LANG_META,
  describeConditions,
  designsForKind,
  formatMoney,
  sanitizeConditions,
  sanitizeConfig,
  sanitizeTexts,
  type TyConditions,
  type TyConfig,
  type TyDesign,
  type TyKind,
  type TyLang,
  type TyRewardTier,
  type TyTextsByLang,
  DEFAULT_CONFIG,
} from "../utils/thankyou";
import { buildSample } from "../utils/thankyou-payload";
import { TEMPLATES, coach } from "../utils/thankyou-templates";
import { ConditionBuilder, DesignPicker, ProductPicker, TextsEditor } from "../components/ty/parts";
import { PREVIEW_CSS, ThankYouPreview } from "../components/ty/ThankYouPreview";

const MAX_OFFERS = 20;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Loader
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  let shop = await getOrCreateShop(session.shop);

  if (!shop.analyticsCurrency || !shop.analyticsTimezone) {
    try {
      const res = await admin.graphql(`#graphql\nquery XpTyMeta { shop { currencyCode ianaTimezone } }`);
      const j: any = await res.json();
      shop = await prisma.shop.update({
        where: { id: shop.id },
        data: { analyticsCurrency: j?.data?.shop?.currencyCode || "USD", analyticsTimezone: j?.data?.shop?.ianaTimezone || "UTC" },
      });
    } catch {
      /* fall back to defaults below */
    }
  }
  const currency = shop.analyticsCurrency || "USD";
  const tz = shop.analyticsTimezone || "UTC";

  const rows = await prisma.tyOffer.findMany({ where: { shopId: shop.id }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  const offers = rows.map(parseOffer);

  const since = dayToDate(localDay(Date.now() - 30 * 86_400_000, tz));
  const [stat, claims, redeemed, orders, aovAgg] = await Promise.all([
    prisma.xpDailyStat.groupBy({
      by: ["offerId"],
      where: { shopId: shop.id, feature: "thankYou", day: { gte: since } },
      _sum: { impressions: true, clicks: true, actions: true },
    }),
    prisma.tyClaim.groupBy({ by: ["offerId"], where: { shopId: shop.id, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.tyCode.findMany({ where: { shopId: shop.id, redeemedAt: { gte: since } }, select: { claim: { select: { offerId: true } } } }),
    prisma.xpOrder.findMany({
      where: { shopId: shop.id, day: { gte: since }, cancelled: false, sourcesJson: { contains: '"thankYou"' } },
      select: { sourcesJson: true },
      take: 2000,
    }),
    prisma.xpOrder.aggregate({
      where: { shopId: shop.id, cancelled: false, createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
      _avg: { subtotal: true },
      _count: { _all: true },
    }),
  ]);

  const stats: Record<string, { views: number; clicks: number; actions: number; issued: number; redeemed: number; revenue: number }> = {};
  const get = (id: string) => (stats[id] ||= { views: 0, clicks: 0, actions: 0, issued: 0, redeemed: 0, revenue: 0 });
  for (const s of stat) {
    const e = get(s.offerId);
    e.views = s._sum.impressions || 0;
    e.clicks = s._sum.clicks || 0;
    e.actions = s._sum.actions || 0;
  }
  for (const c of claims) get(c.offerId).issued = c._count._all;
  for (const r of redeemed) get(r.claim.offerId).redeemed += 1;
  for (const o of orders) {
    try {
      for (const src of JSON.parse(o.sourcesJson || "[]")) if (src.f === "thankYou" && src.o) get(String(src.o)).revenue += Number(src.rev) || 0;
    } catch {
      /* ignore bad rows */
    }
  }

  const handle = session.shop.replace(".myshopify.com", "");
  return {
    shopDomain: session.shop,
    shopName: session.shop,
    enabled: shop.thankYouEnabled,
    currency,
    offers,
    stats,
    aov: (aovAgg._count._all >= 10 && aovAgg._avg.subtotal) || null,
    giftCardsEnabled: (process.env.XPOOST_GIFT_CARDS || "").trim() === "1",
    checkoutEditorUrl: `https://admin.shopify.com/store/${handle}/settings/checkout/editor?page=thank-you&context=apps`,
    maxOffers: MAX_OFFERS,
  };
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Action
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "toggleFeature") {
    const enable = form.get("enable") === "true";
    await prisma.shop.update({ where: { id: shop.id }, data: { thankYouEnabled: enable } });
    return { ok: true, message: enable ? "Thank-you page upsell is on." : "Thank-you page upsell is off." };
  }

  if (intent === "toggleOffer" || intent === "deleteOffer" || intent === "duplicateOffer" || intent === "moveOffer") {
    const id = String(form.get("id") || "");
    const offer = await prisma.tyOffer.findFirst({ where: { id, shopId: shop.id } });
    if (!offer) return { ok: false, message: "Offer not found." };

    if (intent === "toggleOffer") {
      const enable = form.get("enable") === "true";
      if (enable) {
        const p = parseOffer(offer);
        if (p.kind !== "reward" && p.config.addon.products.length === 0) return { ok: false, message: "Add at least one product before turning this offer on." };
      }
      await prisma.tyOffer.update({ where: { id }, data: { enabled: enable } });
      return { ok: true, message: enable ? "Offer is on." : "Offer paused." };
    }
    if (intent === "deleteOffer") {
      await prisma.tyOffer.delete({ where: { id } });
      return { ok: true, message: "Offer deleted." };
    }
    if (intent === "duplicateOffer") {
      const count = await prisma.tyOffer.count({ where: { shopId: shop.id } });
      if (count >= MAX_OFFERS) return { ok: false, message: `You can have up to ${MAX_OFFERS} offers.` };
      const copy = await prisma.tyOffer.create({
        data: {
          shopId: shop.id,
          name: `${offer.name} (copy)`.slice(0, 80),
          kind: offer.kind,
          design: offer.design,
          enabled: false,
          priority: offer.priority + 1,
          configJson: offer.configJson,
          conditionsJson: offer.conditionsJson,
          textsJson: offer.textsJson,
        },
      });
      return { ok: true, message: "Duplicated (paused).", offerId: copy.id };
    }
    if (intent === "moveOffer") {
      const dir = form.get("dir") === "up" ? -1 : 1;
      const all = await prisma.tyOffer.findMany({ where: { shopId: shop.id }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }], select: { id: true } });
      const idx = all.findIndex((o) => o.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= all.length) return { ok: true };
      [all[idx], all[j]] = [all[j], all[idx]];
      await prisma.$transaction(all.map((o, i) => prisma.tyOffer.update({ where: { id: o.id }, data: { priority: (i + 1) * 10 } })));
      return { ok: true, message: "Order updated." };
    }
  }

  if (intent === "saveOffer") {
    let raw: any;
    try {
      raw = JSON.parse(String(form.get("offer") || "{}"));
    } catch {
      return { ok: false, message: "Could not read the offer." };
    }
    const kind: TyKind = (TY_KINDS as readonly string[]).includes(raw?.kind) ? raw.kind : "reward";
    let design: TyDesign = raw?.design in TY_DESIGN_META ? raw.design : designsForKind(kind)[0];
    if (!TY_DESIGN_META[design].kinds.includes(kind)) design = designsForKind(kind)[0];
    const config = sanitizeConfig(raw?.config);
    const conditions = sanitizeConditions(raw?.conditions);
    const texts = sanitizeTexts(raw?.texts);
    const name = String(raw?.name || "").trim().slice(0, 80) || "Untitled offer";

    let enabled = raw?.enabled !== false;
    let note = "";
    if (enabled && kind !== "reward" && config.addon.products.length === 0) {
      enabled = false;
      note = " It is paused until you add a product.";
    }
    const max = TY_DESIGN_META[design].maxProducts;
    if (max > 0 && config.addon.products.length > max) config.addon.products = config.addon.products.slice(0, max);

    const data = {
      name,
      kind,
      design,
      enabled,
      configJson: JSON.stringify(config),
      conditionsJson: JSON.stringify(conditions),
      textsJson: JSON.stringify(texts),
    };

    if (raw?.id) {
      const found = await prisma.tyOffer.findFirst({ where: { id: String(raw.id), shopId: shop.id }, select: { id: true } });
      if (!found) return { ok: false, message: "Offer not found." };
      await prisma.tyOffer.update({ where: { id: found.id }, data });
      return { ok: true, message: `Saved.${note}`, offerId: found.id };
    }
    const count = await prisma.tyOffer.count({ where: { shopId: shop.id } });
    if (count >= MAX_OFFERS) return { ok: false, message: `You can have up to ${MAX_OFFERS} offers.` };
    const last = await prisma.tyOffer.findFirst({ where: { shopId: shop.id }, orderBy: { priority: "desc" }, select: { priority: true } });
    const created = await prisma.tyOffer.create({ data: { shopId: shop.id, priority: (last?.priority || 0) + 10, ...data } });
    return { ok: true, message: `Created.${note}`, offerId: created.id, created: true };
  }

  return { ok: false, message: "Unknown action." };
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Page
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type LoaderData = ReturnType<typeof useLoaderData<typeof loader>>;

export default function ThankYouPage() {
  const data = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const editing = params.get("offer");
  return (
    <s-page heading="Thank-you Page Upsell">
      <style>{TY_CSS}</style>
      <style>{PREVIEW_CSS}</style>
      {editing ? <Editor key={`${editing}:${params.get("tpl") || ""}`} data={data} offerParam={editing} tpl={params.get("tpl")} /> : <ListView data={data} />}
    </s-page>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// List view
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "â€“");

function ListView({ data }: { data: LoaderData }) {
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";
  const money = (n: number) => formatMoney(n, data.currency);
  const offers = data.offers as unknown as ParsedOffer[];

  useEffect(() => {
    const d = fetcher.data as any;
    if (d?.offerId && d.message === "Duplicated (paused).") navigate(`/app/thank-you?offer=${d.offerId}`);
  }, [fetcher.data, navigate]);

  const send = (fields: Record<string, string>) => fetcher.submit(fields, { method: "post" });
  const msg = (fetcher.data as any)?.message as string | undefined;
  const ok = (fetcher.data as any)?.ok !== false;

  return (
    <div className="ty-wrap">
      {msg ? <div className={`ty-banner ${ok ? "ok" : "bad"}`}>{msg}</div> : null}

      <div className="ty-card ty-hero">
        <div>
          <h2><Translate text='Turn the thank-you page into your best extra sales page' /></h2>
          <p>
            
                                  <Translate text='Customers are most open to your brand right after they pay. Give them a unique code for next time, offer matching products, or open a short window where anything they add ships in the same box.' />
                                </p>
        </div>
        <label className="ty-switch" title="Turn the whole feature on or off">
          <input type="checkbox" checked={data.enabled} disabled={busy} onChange={(e) => send({ intent: "toggleFeature", enable: String(e.target.checked) })} />
          <span className="knob" />
          <b>{data.enabled ? "On" : "Off"}</b>
        </label>
      </div>

      <div className="ty-card">
        <h3 className="ty-title"><Translate text='Set up in 2 steps' /></h3>
        <ol className="ty-steps">
          <li>
            <b><Translate text='Add the block to your Thank-you page.' /></b>{" "}
            <a href={data.checkoutEditorUrl} target="_blank" rel="noreferrer">
              
                                        <Translate text='Open the checkout editor â†’ Thank-you page â†’ Add app block â†’ â€œXPoost Thank-you Upsellâ€' />
                                      </a>
            
                                  <Translate text='. Drag it where you like (under the order summary works well), then save.' />
                                </li>
          <li>
            <b><Translate text='Create an offer below and switch it on.' /></b>  <Translate text='Place a test order to see it live.' />
                                </li>
        </ol>
      </div>

      <div className="ty-card">
        <div className="ty-row-between">
          <h3 className="ty-title"><Translate text='Your offers' /></h3>
          <Link to="/app/thank-you?offer=new" className="ty-btn gold">
            
                                  <Translate text='+ New offer' />
                                </Link>
        </div>
        {offers.length === 0 ? (
          <div className="ty-empty">
            
                                  <Translate text='No offers yet. Start from a proven template below, or' />{" "}
            <Link to="/app/thank-you?offer=new"><Translate text='build one from scratch' /></Link>.
          </div>
        ) : (
          <>
            <p className="ty-muted">
              
                                            <Translate text='For each order, XPoost shows the' /> <b><Translate text='first offer from the top whose conditions match' /></b><Translate text='. Put specific offers first and a catch-all last.' />
                                          </p>
            <div className="ty-table-wrap">
              <table className="ty-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th><Translate text='Offer' /></th>
                    <th><Translate text='Shown when' /></th>
                    <th className="r"><Translate text='Views' /></th>
                    <th className="r"><Translate text='Click rate' /></th>
                    <th className="r"><Translate text='Codes' /></th>
                    <th className="r"><Translate text='Revenue' /></th>
                    <th><Translate text='Status' /></th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o, i) => {
                    const s = data.stats[o.id] || { views: 0, clicks: 0, actions: 0, issued: 0, redeemed: 0, revenue: 0 };
                    return (
                      <tr key={o.id}>
                        <td className="mv">
                          <button className="ty-icon" disabled={i === 0 || busy} onClick={() => send({ intent: "moveOffer", id: o.id, dir: "up" })} aria-label="Move up">â†‘</button>
                          <button className="ty-icon" disabled={i === offers.length - 1 || busy} onClick={() => send({ intent: "moveOffer", id: o.id, dir: "down" })} aria-label="Move down">â†“</button>
                        </td>
                        <td>
                          <Link to={`/app/thank-you?offer=${o.id}`} className="ty-name">{o.name}</Link>
                          <div className="ty-muted sm">
                            {TY_KIND_META[o.kind].name} Â· {TY_DESIGN_META[o.design].name}
                          </div>
                        </td>
                        <td className="ty-muted sm">{describeConditions(o.conditions, money)}</td>
                        <td className="r">{s.views.toLocaleString()}</td>
                        <td className="r">{s.views >= 50 ? pct(s.clicks, s.views) : "â€“"}</td>
                        <td className="r">
                          {s.issued ? `${s.redeemed}/${s.issued}` : "â€“"}
                          {s.issued ? <div className="ty-muted sm"><Translate text='used' /></div> : null}
                        </td>
                        <td className="r">{s.revenue ? money(s.revenue) : "â€“"}</td>
                        <td>
                          <label className="ty-switch sm">
                            <input type="checkbox" checked={o.enabled} disabled={busy} onChange={(e) => send({ intent: "toggleOffer", id: o.id, enable: String(e.target.checked) })} />
                            <span className="knob" />
                          </label>
                        </td>
                        <td className="act">
                          <Link to={`/app/thank-you?offer=${o.id}`} className="ty-btn ghost sm"><Translate text='Edit' /></Link>
                          <button className="ty-btn ghost sm" disabled={busy} onClick={() => send({ intent: "duplicateOffer", id: o.id })}><Translate text='Duplicate' /></button>
                          <button
                            className="ty-btn ghost sm danger"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Delete â€œ${o.name}â€? Codes already issued keep working until they expire.`)) send({ intent: "deleteOffer", id: o.id });
                            }}
                          >
                            
                                                                <Translate text='Delete' />
                                                              </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="ty-muted sm"><Translate text='Last 30 days. â€œCodesâ€ shows issued codes and how many were used. Full revenue breakdown is in the Analytics tab.' /></p>
          </>
        )}
      </div>

      <div className="ty-card">
        <h3 className="ty-title"><Translate text='Start from a proven template' /></h3>
        <div className="ty-tpl-grid">
          {TEMPLATES.map((t) => (
            <Link key={t.key} to={`/app/thank-you?offer=new&tpl=${t.key}`} className="ty-tpl">
              <div className="ty-tpl-kind"><Translate text={TY_KIND_META[t.kind].name} /></div>
              <div className="ty-tpl-name"><Translate text={t.name} /></div>
              <div className="ty-tpl-tag"><Translate text={t.tagline} /></div>
              <div className="ty-tpl-why"><Translate text={t.why} /></div>
            </Link>
          ))}
        </div>
      </div>

      <div className="ty-card">
        <h3 className="ty-title"><Translate text='What works best (from real store data)' /></h3>
        <ul className="ty-insights">
          <li>
            <b><Translate text='Treat this page as a bonus channel.' /></b>  <Translate text='Across 218.6 million offer views in 3,199 Shopify stores, thank-you page offers were taken about 0.7% of the time, compared with 2.4% for product-page pop-ups. The' /> <b><Translate text='next-order reward' /></b>  <Translate text='is where this page earns most, because it brings the customer back.' />
                                </li>
          <li>
            <b><Translate text='Show 3 products, not 1.' /></b>  <Translate text='The same study found offers with 3 products were taken about 2.9% of the time versus 1.5% for a single product.' />
                                </li>
          <li>
            <b><Translate text='Keep the timer honest and short.' /></b>  <Translate text='XPoost makes the code really expire when the timer ends. 15â€“30 minutes is enough to feel urgent while your team can still pack one box.' />
                                </li>
          <li>
            <b><Translate text='Use conditions.' /></b>  <Translate text='Different offers for first-time and returning customers, and a product-specific add-on for what was just bought, are the two highest-value splits.' />
                                </li>
          <li>
            <b><Translate text='Small add-ons win after checkout.' /></b>  <Translate text='Refills, minis and accessories at 10â€“20% off sell better than another full-price item.' />
                                </li>
          <li>
            <b><Translate text='Make codes single-use and unique.' /></b>  <Translate text='XPoost creates a one-time code per order, so codes can&apos;t leak to coupon sites.' />
                                </li>
        </ul>
        <p className="ty-muted sm">
          
                            <Translate text='Source: Digismoothie Upsell Benchmarks 2026. Results vary by store; use the Analytics tab to see yours.' />
                          </p>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Editor
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Draft = {
  id?: string;
  name: string;
  kind: TyKind;
  design: TyDesign;
  enabled: boolean;
  config: TyConfig;
  conditions: TyConditions;
  texts: TyTextsByLang;
};

function blankDraft(): Draft {
  return {
    name: "New offer",
    kind: "reward",
    design: "gift_reveal",
    enabled: false,
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    conditions: { match: "all", rules: [] },
    texts: {},
  };
}

function Editor({ data, offerParam, tpl }: { data: LoaderData; offerParam: string; tpl: string | null }) {
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();
  const money = (n: number) => formatMoney(n, data.currency);
  const offers = data.offers as unknown as ParsedOffer[];

  const initial = useMemo<Draft>(() => {
    if (offerParam !== "new") {
      const o = offers.find((x) => x.id === offerParam);
      if (o) return { id: o.id, name: o.name, kind: o.kind, design: o.design, enabled: o.enabled, config: o.config, conditions: o.conditions, texts: o.texts };
    }
    const d = blankDraft();
    const t = TEMPLATES.find((x) => x.key === tpl);
    if (t) {
      const built = t.build(data.aov);
      d.name = t.name;
      d.kind = t.kind;
      d.design = t.design;
      d.config = built.config;
      d.conditions = built.conditions;
      d.texts = built.texts || {};
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerParam, tpl]);

  const [draft, setDraft] = useState<Draft>(initial);
  const [lang, setLang] = useState<TyLang>("en");
  const [mobile, setMobile] = useState(false);
  const [dirty, setDirty] = useState(false);
  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };
  const setConfig = (fn: (c: TyConfig) => TyConfig) => {
    setDraft((d) => ({ ...d, config: fn(d.config) }));
    setDirty(true);
  };

  const saving = fetcher.state !== "idle";
  const result = fetcher.data as any;

  useEffect(() => {
    if (!result?.ok) return;
    setDirty(false);
    if (result.created && result.offerId) navigate(`/app/thank-you?offer=${result.offerId}`, { replace: true });
  }, [result, navigate]);

  const save = () => fetcher.submit({ intent: "saveOffer", offer: JSON.stringify(draft) }, { method: "post" });

  const isReward = draft.kind === "reward";
  const designMeta = TY_DESIGN_META[draft.design];
  const rewardTiers = draft.config.reward.tiers;
  const tierCount = draft.design === "vip_ladder" ? 3 : 1;

  const changeKind = (kind: TyKind) => {
    let design = draft.design;
    if (!TY_DESIGN_META[design].kinds.includes(kind)) design = designsForKind(kind)[0];
    patch({ kind, design });
  };

  const setTier = (i: number, p: Partial<TyRewardTier>) =>
    setConfig((c) => {
      const tiers = c.reward.tiers.map((t, idx) => (idx === i ? { ...t, ...p } : t));
      return { ...c, reward: { ...c.reward, tiers } };
    });

  // Ladder needs exactly 3 steps, other designs use the first one
  useEffect(() => {
    if (draft.design === "vip_ladder" && rewardTiers.length < 3) {
      const base = data.aov || 50;
      const defaults: TyRewardTier[] = [
        { valueType: "percent", value: 10, minSpend: Math.round(base * 0.9) },
        { valueType: "percent", value: 15, minSpend: Math.round(base * 1.5) },
        { valueType: "percent", value: 20, minSpend: Math.round(base * 2.4) },
      ];
      setConfig((c) => ({ ...c, reward: { ...c.reward, tiers: [...c.reward.tiers, ...defaults.slice(c.reward.tiers.length)] } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.design]);

  const previewPayload = useMemo(
    () =>
      buildSample(
        { id: draft.id || "draft", kind: draft.kind, design: draft.design, config: draft.config, texts: draft.texts },
        { name: data.shopName, currency: data.currency, url: `https://${data.shopDomain}`, domain: data.shopDomain },
        lang,
        draft.config.addon.products,
      ),
    [draft, lang, data],
  );

  const tips = coach({ kind: draft.kind, design: draft.design, config: draft.config, conditions: draft.conditions, enabled: draft.enabled }, data.aov, money);

  return (
    <div className="ty-wrap">
      <div className="ty-topbar">
        <Link to="/app/thank-you" className="ty-btn ghost" onClick={(e) => { if (dirty && !window.confirm("Discard unsaved changes?")) e.preventDefault(); }}>
          
                            <Translate text='â† All offers' />
                          </Link>
        <div className="ty-topbar-r">
          {result?.message ? <span className={`ty-flash ${result.ok ? "ok" : "bad"}`}>{result.message}</span> : dirty ? <span className="ty-flash"><Translate text='Unsaved changes' /></span> : null}
          <label className="ty-switch" title="Offer on/off">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            <span className="knob" />
            <b>{draft.enabled ? "On" : "Paused"}</b>
          </label>
          <button type="button" className="ty-btn gold" onClick={save} disabled={saving}>
            {saving ? "Savingâ€¦" : "Save offer"}
          </button>
        </div>
      </div>

      <div className="ty-layout">
        <div className="ty-main">
          <div className="ty-card">
            <h3 className="ty-title"><Translate text='1 Â· Name & type' /></h3>
            <div className="ty-field">
              <label><Translate text='Offer name (only you see this)' /></label>
              <input className="ty-input" value={draft.name} maxLength={80} onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div className="ty-kinds">
              {TY_KINDS.map((k) => (
                <button key={k} type="button" className={`ty-kind ${draft.kind === k ? "on" : ""}`} onClick={() => changeKind(k)}>
                  <b><Translate text={TY_KIND_META[k].name} /></b>
                  <span><Translate text={TY_KIND_META[k].blurb} /></span>
                </button>
              ))}
            </div>
          </div>

          <div className="ty-card">
            <h3 className="ty-title"><Translate text='2 Â· Design' /></h3>
            <DesignPicker kind={draft.kind} value={draft.design} onChange={(design) => patch({ design })} />
            <p className="ty-muted sm"><Translate text='Colors, fonts and corners come from your checkout branding (Shopify&apos;s rule for checkout extensions), so every design matches your store.' /></p>
          </div>

          {isReward ? (
            <div className="ty-card">
              <h3 className="ty-title"><Translate text='3 Â· The reward' /></h3>
              <div className="ty-field">
                <label><Translate text='Reward type' /></label>
                <div className="ty-seg">
                  <button type="button" className={draft.config.reward.kind === "code" ? "on" : ""} onClick={() => setConfig((c) => ({ ...c, reward: { ...c.reward, kind: "code" } }))}>
                    
                                                          <Translate text='Discount code' />
                                                        </button>
                  <button
                    type="button"
                    className={draft.config.reward.kind === "giftcard" ? "on" : ""}
                    onClick={() => setConfig((c) => ({ ...c, reward: { ...c.reward, kind: "giftcard" } }))}
                  >
                    
                                                          <Translate text='Gift card' />
                                                        </button>
                </div>
                {draft.config.reward.kind === "code" ? (
                  <small><Translate text='Costs you nothing until the customer comes back and uses it, and then only the discount on that order.' /></small>
                ) : data.giftCardsEnabled ? (
                  <small><Translate text='A gift card is stored value you owe the customer. It uses a fixed amount (a percentage is converted using the order subtotal).' /></small>
                ) : (
                  <small className="warn"><Translate text='Gift cards need Shopify&apos;s gift card permission, which isn&apos;t enabled for this app yet. Until it is, XPoost automatically issues an equivalent discount code instead.' /></small>
                )}
              </div>

              {rewardTiers.slice(0, tierCount).map((t, i) => (
                <div key={i} className="ty-tier">
                  {tierCount > 1 ? <div className="ty-tier-n"><Translate text='Step' /> {i + 1}</div> : null}
                  <div className="ty-grid3">
                    <div className="ty-field">
                      <label><Translate text='Discount' /></label>
                      <select className="ty-input" value={t.valueType} onChange={(e) => setTier(i, { valueType: e.target.value === "fixed" ? "fixed" : "percent" })}>
                        <option value="percent"><Translate text='Percentage off' /></option>
                        <option value="fixed"><Translate text='Fixed amount off' /></option>
                      </select>
                    </div>
                    <div className="ty-field">
                      <label>{t.valueType === "percent" ? "Percent" : `Amount (${data.currency})`}</label>
                      <input className="ty-input" type="number" min={1} max={t.valueType === "percent" ? 100 : 100000} value={t.value} onChange={(e) => setTier(i, { value: Number(e.target.value) })} />
                    </div>
                    <div className="ty-field">
                      <label><Translate text='Minimum spend (' />{data.currency})</label>
                      <input className="ty-input" type="number" min={0} value={t.minSpend} onChange={(e) => setTier(i, { minSpend: Number(e.target.value) })} />
                      <small><Translate text='0 = no minimum' /></small>
                    </div>
                  </div>
                </div>
              ))}

              <div className="ty-grid2">
                <div className="ty-field">
                  <label><Translate text='Valid for (days)' /></label>
                  <input className="ty-input" type="number" min={1} max={365} value={draft.config.reward.expiryDays} onChange={(e) => setConfig((c) => ({ ...c, reward: { ...c.reward, expiryDays: Number(e.target.value) } }))} />
                </div>
                <div className="ty-field">
                  <label><Translate text='Code prefix' /></label>
                  <input className="ty-input" maxLength={12} value={draft.config.reward.codePrefix} onChange={(e) => setConfig((c) => ({ ...c, reward: { ...c.reward, codePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") } }))} />
                  <small><Translate text='Codes look like' /> {draft.config.reward.codePrefix || "THANKS"}<Translate text='-7K4Q-9XMD. Each is unique and single-use.' /></small>
                </div>
              </div>
            </div>
          ) : (
            <div className="ty-card">
              <h3 className="ty-title"><Translate text='3 Â· Products & benefit' /></h3>
              <div className="ty-field">
                <label>
                  
                                                        <Translate text='Products to offer (' />{draft.config.addon.products.length}/{Math.max(1, designMeta.maxProducts)})
                </label>
                <ProductPicker
                  value={draft.config.addon.products}
                  max={Math.max(1, designMeta.maxProducts)}
                  onChange={(products) => setConfig((c) => ({ ...c, addon: { ...c.addon, products } }))}
                />
                <small><Translate text='Items the customer just bought are skipped automatically, and sold-out products are hidden.' /></small>
              </div>

              <div className="ty-field">
                <label><Translate text='What does the customer get for the added items?' /></label>
                <div className="ty-seg">
                  <button type="button" className={draft.config.addon.benefit === "percent" ? "on" : ""} onClick={() => setConfig((c) => ({ ...c, addon: { ...c.addon, benefit: "percent" } }))}>
                    
                                                              <Translate text='Discount on added items' />
                                                            </button>
                  <button type="button" className={draft.config.addon.benefit === "free_shipping" ? "on" : ""} onClick={() => setConfig((c) => ({ ...c, addon: { ...c.addon, benefit: "free_shipping" } }))}>
                    
                                                              <Translate text='Free shipping on added items' />
                                                            </button>
                </div>
              </div>

              <div className="ty-grid3">
                {draft.config.addon.benefit === "percent" ? (
                  <div className="ty-field">
                    <label><Translate text='Discount (%)' /></label>
                    <input className="ty-input" type="number" min={1} max={100} value={draft.config.addon.percent} onChange={(e) => setConfig((c) => ({ ...c, addon: { ...c.addon, percent: Number(e.target.value) } }))} />
                  </div>
                ) : null}
                <div className="ty-field">
                  <label><Translate text='Time limit (minutes)' /></label>
                  <input className="ty-input" type="number" min={2} max={1440} value={draft.config.addon.windowMinutes} onChange={(e) => setConfig((c) => ({ ...c, addon: { ...c.addon, windowMinutes: Number(e.target.value) } }))} />
                  <small><Translate text='The code really expires after this long.' /></small>
                </div>
                {draft.kind === "addon" ? (
                  <div className="ty-field">
                    <label><Translate text='Countdown' /></label>
                    <label className="ty-check">
                      <input type="checkbox" checked={draft.config.addon.showTimer} onChange={(e) => setConfig((c) => ({ ...c, addon: { ...c.addon, showTimer: e.target.checked } }))} />
                      
                                                                    <Translate text='Show the timer to the customer' />
                                                                  </label>
                  </div>
                ) : null}
              </div>
              {draft.kind === "shiptogether" ? (
                <div className="ty-note">
                  
                                                        <Translate text='How it works: added items open a new checkout with the code applied. XPoost links that order to the original (an additional-details line â€œShip together with #1042â€), so you can pack both in one box and the customer pays no extra shipping.' />
                                                      </div>
              ) : null}
            </div>
          )}

          <div className="ty-card">
            <h3 className="ty-title"><Translate text='4 Â· Who sees it' /></h3>
            <p className="ty-muted sm"><Translate text='Leave empty to show to every order. Example: subtotal at least' /> {money(Math.round((data.aov || 60) * 1.3))}  <Translate text='AND customer is a first-time customer.' /></p>
            <ConditionBuilder value={draft.conditions} onChange={(conditions) => patch({ conditions })} currency={data.currency} />
            <p className="ty-muted sm"><Translate text='Shown to:' /> <b>{describeConditions(draft.conditions, money)}</b></p>
          </div>

          <div className="ty-card">
            <h3 className="ty-title"><Translate text='5 Â· Text & translations' /></h3>
            <TextsEditor kind={draft.kind} texts={draft.texts} onChange={(texts) => patch({ texts })} lang={lang} onLang={setLang} />
          </div>

          <div className="ty-card">
            <h3 className="ty-title"><Translate text='Suggestions for this offer' /></h3>
            <ul className="ty-tips">
              {tips.map((t, i) => (
                <li key={i} className={t.level}>
                  <span className="ico">{t.level === "good" ? "âœ“" : t.level === "warn" ? "!" : "â†’"}</span>
                  {t.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="ty-side">
          <div className="ty-sticky">
            <div className="ty-card">
              <div className="ty-row-between">
                <h3 className="ty-title nb"><Translate text='Live preview' /></h3>
                <div className="ty-seg sm">
                  <button type="button" className={!mobile ? "on" : ""} onClick={() => setMobile(false)}><Translate text='Desktop' /></button>
                  <button type="button" className={mobile ? "on" : ""} onClick={() => setMobile(true)}><Translate text='Mobile' /></button>
                </div>
              </div>
              <div className="ty-langbar">
                {(Object.keys(TY_LANG_META) as TyLang[]).map((l) => (
                  <button key={l} type="button" className={l === lang ? "on" : ""} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
                ))}
              </div>
              <div className="ty-stage" style={{ maxWidth: mobile ? 340 : 520 }}>
                <ThankYouPreview payload={previewPayload} mobile={mobile} />
              </div>
              <p className="ty-muted sm">
                
                                              <Translate text='An approximation: on your real thank-you page the layout uses your checkout&apos;s fonts and colors. The code, dates and links shown are samples.' />
                                            </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Styles
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TY_CSS = `
.ty-wrap{display:flex;flex-direction:column;gap:16px;padding:16px 8px 48px;color:#fff}
.ty-card{background:#16140F;border:1px solid #2E2A22;border-radius:12px;padding:20px;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.25)}
.ty-title{font-size:16px;font-weight:800;color:#C9B78F;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #2E2A22}
.ty-title.nb{border:0;margin:0;padding:0}
.ty-hero{display:flex;justify-content:space-between;gap:20px;align-items:center;background:#171512;border-color:#4a412e}
.ty-hero h2{margin:0 0 6px;font-size:20px;color:#E9DFC8}
.ty-hero p{margin:0;color:#b9b6ae;max-width:760px;line-height:1.55}
.ty-muted{color:#8f8a7e}.ty-muted.sm,.sm.ty-muted{font-size:12px}
.sm{font-size:12px}
.ty-banner{padding:10px 14px;border-radius:8px;font-size:13px}.ty-banner.ok{background:#12301c;border:1px solid #1e5a31;color:#bff0cd}.ty-banner.bad{background:#35171a;border:1px solid #6d2a31;color:#ffc5c9}
.ty-btn{display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none;border:1px solid #C9B78F;background:#0E0D0B;color:#C9B78F}
.ty-btn.gold{background:#C9B78F;color:#111}.ty-btn.ghost{background:transparent;border-color:#3e3b32;color:#ebe8df}.ty-btn.sm{padding:5px 10px;font-size:12px}.ty-btn.danger{color:#ff9aa2;border-color:#4a2a2e}
.ty-btn:disabled{opacity:.45;cursor:not-allowed}
.ty-icon{background:transparent;border:1px solid #3A352B;color:#ddd;border-radius:6px;width:26px;height:26px;cursor:pointer;line-height:1}
.ty-icon:disabled{opacity:.3}.ty-icon.danger{color:#ff9aa2}
.ty-row-between{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.ty-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;position:relative}
.ty-switch input{position:absolute;opacity:0;width:0;height:0}
.ty-switch .knob{width:42px;height:24px;border-radius:999px;background:#3e3b32;position:relative;transition:.15s}
.ty-switch .knob:after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.15s}
.ty-switch input:checked + .knob{background:#C9B78F}.ty-switch input:checked + .knob:after{left:21px;background:#111}
.ty-switch.sm .knob{width:34px;height:20px}.ty-switch.sm .knob:after{width:14px;height:14px}.ty-switch.sm input:checked + .knob:after{left:17px}
.ty-switch input:focus-visible + .knob{outline:2px solid #E9DFC8}
.ty-steps{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px;color:#c9c4b6;line-height:1.55}
.ty-steps a{color:#E9DFC8}.ty-steps code{background:#232017;padding:1px 6px;border-radius:4px}
.ty-empty{padding:14px;border:1px dashed #3A352B;border-radius:8px;color:#a39e91;font-size:13px}.ty-empty a{color:#E9DFC8}
.ty-table-wrap{overflow-x:auto}
.ty-table{width:100%;border-collapse:collapse;font-size:13px;min-width:860px}
.ty-table th{text-align:left;color:#8f8a7e;font-weight:600;font-size:12px;padding:8px 8px;border-bottom:1px solid #2E2A22}
.ty-table td{padding:10px 8px;border-bottom:1px solid #232017;vertical-align:middle}
.ty-table .r{text-align:right}.ty-table .mv{white-space:nowrap}.ty-table .act{white-space:nowrap;display:flex;gap:6px;align-items:center}
.ty-name{color:#fff;font-weight:700;text-decoration:none}.ty-name:hover{color:#E9DFC8}
.ty-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.ty-tpl{display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid #2a261e;border-radius:10px;background:#13110D;text-decoration:none;color:#fff}
.ty-tpl:hover{border-color:#C9B78F}
.ty-tpl-kind{font-size:11px;letter-spacing:.08em;color:#C9B78F}.ty-tpl-name{font-weight:800}.ty-tpl-tag{color:#c9c4b6;font-size:13px}.ty-tpl-why{color:#8f8a7e;font-size:12px;line-height:1.5}
.ty-insights{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:10px;color:#c9c4b6;line-height:1.55;font-size:13px}
.ty-topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;top:48px;z-index:20;background:#0e0d0b;padding:8px 0}
.ty-topbar-r{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.ty-flash{font-size:12px;color:#a39e91}.ty-flash.ok{color:#8fe3a6}.ty-flash.bad{color:#ff9aa2}
.ty-layout{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:16px;align-items:start}
@media(max-width:1100px){.ty-layout{grid-template-columns:1fr}.ty-sticky{position:static!important}}
.ty-main{display:flex;flex-direction:column;gap:16px}
.ty-sticky{position:sticky;top:112px}
.ty-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.ty-field label{font-size:13px;font-weight:600;color:#fff;display:flex;justify-content:space-between;gap:8px}
.ty-field small{font-size:11px;color:#8f8a7e}.ty-field small.warn{color:#f0c36b}
.ty-input{box-sizing:border-box;padding:8px 12px;border:1px solid #3A352B;border-radius:6px;font-size:13px;background:#110e05;color:#fff;width:100%;font-family:inherit}
.ty-input.sm{width:auto;min-width:120px}.ty-input:focus{outline:2px solid #C9B78F88;border-color:#C9B78F}
textarea.ty-input{resize:vertical}
.ty-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ty-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:700px){.ty-grid2,.ty-grid3{grid-template-columns:1fr}}
.ty-check{display:flex!important;align-items:center;gap:8px;font-weight:500!important;font-size:13px!important}
.ty-seg{display:inline-flex;border:1px solid #3A352B;border-radius:8px;overflow:hidden;align-self:flex-start;flex-wrap:wrap}
.ty-seg button{background:#110e05;color:#c9c4b6;border:0;padding:8px 14px;font-size:13px;cursor:pointer;font-weight:600}
.ty-seg button.on{background:#C9B78F;color:#111}.ty-seg.sm button{padding:5px 10px;font-size:12px}
.ty-kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media(max-width:800px){.ty-kinds{grid-template-columns:1fr}}
.ty-kind{display:flex;flex-direction:column;gap:6px;text-align:left;padding:14px;border:1px solid #2a261e;border-radius:10px;background:#13110D;color:#fff;cursor:pointer}
.ty-kind span{font-size:12px;color:#a39e91;line-height:1.5}.ty-kind.on{border-color:#C9B78F;background:#17140c}
.ty-design-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.ty-design{display:flex;flex-direction:column;gap:6px;text-align:left;padding:10px;border:1px solid #2a261e;border-radius:10px;background:#13110D;color:#fff;cursor:pointer}
.ty-design.on{border-color:#C9B78F;background:#17140c;box-shadow:0 0 0 1px #C9B78F}.ty-design:disabled{opacity:.35;cursor:not-allowed}
.ty-design-name{font-weight:800;font-size:13px}.ty-design-blurb{font-size:11px;color:#8f8a7e;line-height:1.45}.ty-design-lock{font-size:10px;color:#f0c36b}
.ty-tier{border:1px solid #2a261e;border-radius:10px;padding:12px;margin-bottom:12px;background:#13110D}.ty-tier-n{font-size:12px;color:#C9B78F;font-weight:800;margin-bottom:6px}
.ty-note{padding:12px;border-radius:8px;background:#17140c;border:1px solid #4a412e;color:#e6dcc0;font-size:13px;line-height:1.55}
.ty-conds{display:flex;flex-direction:column;gap:10px}
.ty-match{display:flex;align-items:center;gap:10px;font-size:13px;flex-wrap:wrap}
.ty-rule{border:1px solid #2a261e;border-radius:10px;background:#13110D;padding:10px;display:flex;flex-direction:column;gap:8px}
.ty-rule-head{display:flex;gap:8px;align-items:center}.ty-rule-n{width:22px;height:22px;border-radius:50%;background:#C9B78F;color:#111;font-weight:800;font-size:12px;display:grid;place-items:center;flex-shrink:0}
.ty-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ty-picker{display:flex;flex-direction:column;gap:8px}
.ty-chosen{display:flex;flex-direction:column;gap:6px}
.ty-chosen-row{display:flex;gap:10px;align-items:center;border:1px solid #2a261e;border-radius:8px;padding:6px 8px;background:#13110D}
.ty-chosen-row img,.ty-chosen-row .ph,.ty-result img,.ty-result .ph{width:36px;height:36px;border-radius:6px;object-fit:cover;background:#2a271e;flex-shrink:0}
.ty-chosen-row .ttl{flex:1;min-width:0;font-size:13px}.ty-chosen-row small{color:#8f8a7e}
.ty-results{border:1px solid #2a261e;border-radius:8px;overflow:hidden;max-height:260px;overflow-y:auto}
.ty-result{display:flex;gap:10px;align-items:center;width:100%;padding:6px 10px;background:#13110D;border:0;border-bottom:1px solid #232017;color:#fff;cursor:pointer;text-align:left;font-size:13px}
.ty-result:hover:not(:disabled){background:#1e1b12}.ty-result:disabled{opacity:.4}.ty-result span{flex:1}.ty-result small{color:#8f8a7e}
.pad{padding:10px}
.ty-chips{display:flex;flex-wrap:wrap;gap:6px}.ty-chip{display:inline-flex;gap:6px;align-items:center;background:#221e16;border:1px solid #4a412e;color:#E9DFC8;border-radius:999px;padding:3px 6px 3px 10px;font-size:12px}
.ty-chip button{background:transparent;border:0;color:#E9DFC8;cursor:pointer}
.ty-langs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.ty-lang{background:#13110D;border:1px solid #2a261e;color:#c9c4b6;border-radius:999px;padding:6px 14px;cursor:pointer;font-size:13px;position:relative}
.ty-lang.on{background:#C9B78F;color:#111;border-color:#C9B78F;font-weight:700}.ty-lang .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#7bd88f;margin-inline-start:6px}
.ty-hint{font-size:12px;color:#8f8a7e;margin-bottom:10px;line-height:1.5}
.ty-ph{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.ty-ph-chip{background:#13110D;border:1px solid #2a261e;color:#E9DFC8;border-radius:6px;padding:3px 8px;font-size:12px;cursor:pointer;font-family:ui-monospace,monospace}
.ty-ph-chip:hover{border-color:#C9B78F}
.ty-fields{display:flex;flex-direction:column}
.ty-link{background:none;border:0;color:#C9B78F;cursor:pointer;font-size:12px;text-decoration:underline}
.ty-tips{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ty-tips li{display:flex;gap:10px;font-size:13px;line-height:1.5;color:#c9c4b6}
.ty-tips .ico{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;flex-shrink:0;background:#2a271e;color:#C9B78F}
.ty-tips .good .ico{background:#12301c;color:#8fe3a6}.ty-tips .warn .ico{background:#3b2a0e;color:#f0c36b}
.ty-langbar{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.ty-langbar button{background:#13110D;border:1px solid #2a261e;color:#c9c4b6;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer}
.ty-langbar button.on{background:#C9B78F;color:#111;border-color:#C9B78F;font-weight:800}
.ty-stage{margin:0 auto 10px;background:#edeae1;border-radius:14px;padding:14px;transition:max-width .2s}
`;

