import { Translate, useTranslations } from "../components/Translate";
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { BB_CSS } from "../components/bb/styles";
import { PP_FEATURES, PP_FEATURE_META, parsePp, sanitizePp, type PpFeature, type PpSettings } from "../utils/product-popup";

/**
 * Product Popup — one switch for every XPoost feature that shows products.
 * Tapping a product's photo or name opens its details (photos, price, description) in a popup
 * instead of leaving the page; the popup's button does what the card's button does.
 */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  return { settings: parsePp(shop.productPopupJson) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const form = await request.formData();
  let raw: any = {};
  try {
    raw = JSON.parse(String(form.get("payload") || "{}"));
  } catch {
    return { ok: false, message: "Couldn't read the form. Please try again." };
  }
  const settings = sanitizePp(raw);
  await prisma.shop.update({ where: { id: shop.id }, data: { productPopupJson: JSON.stringify(settings) } });
  return { ok: true, message: "Saved." };
};

const CSS = `
.pp-feat{display:grid;gap:10px}
.pp-mock{position:relative;width:250px;max-width:100%;margin:0 auto;border-radius:30px;padding:10px;background:#1a140c;border:1px solid rgba(232,200,114,.28);box-shadow:0 20px 40px -20px rgba(0,0,0,.8)}
.pp-screen{position:relative;height:430px;border-radius:22px;overflow:hidden;background:#efefef}
.pp-page{padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;filter:blur(1px);opacity:.75}
.pp-page i{display:block;height:110px;border-radius:12px;background:#d8d8d8}
.pp-dim{position:absolute;inset:0;background:rgba(0,0,0,.45)}
.pp-sheet{position:absolute;left:0;right:0;bottom:0;height:78%;border-radius:20px 20px 0 0;background:#fff;color:#111;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.pp-x{align-self:flex-end;font-size:11px;font-weight:700;border:1px solid rgba(0,0,0,.14);border-radius:99px;padding:3px 10px}
.pp-photo{height:120px;border-radius:12px;background:linear-gradient(135deg,#f5f5f5,#e2e2e2);display:flex;align-items:center;justify-content:center}
.pp-photo b{width:44px;height:82px;border-radius:10px 10px 6px 6px;background:#c9c9c9}
.pp-dots{display:flex;justify-content:center;gap:4px}
.pp-dots s{width:5px;height:5px;border-radius:9px;background:#bbb}
.pp-dots s:first-child{width:14px;background:#111}
.pp-t{height:11px;width:80%;border-radius:4px;background:#222}
.pp-p{height:10px;width:35%;border-radius:4px;background:#555}
.pp-btn{margin-top:4px;height:30px;border-radius:9px;background:#111;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}
.pp-ghost{height:24px;border-radius:9px;border:1px solid rgba(0,0,0,.14);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#111}
.pp-l{height:7px;border-radius:4px;background:#ddd}
.pp-how{margin:0;padding-inline-start:18px;display:grid;gap:8px;color:#EDE6D6;font-size:14px;line-height:1.6}
.pp-off{opacity:.5;pointer-events:none}
`;

export default function ProductPopupPage() {
  const { settings } = useLoaderData<typeof loader>() as { settings: PpSettings };
  const { t } = useTranslations();
  const fetcher = useFetcher<{ ok: boolean; message: string }>();
  const [d, setD] = useState<PpSettings>(settings);
  const [dirty, setDirty] = useState(false);
  const busy = fetcher.state !== "idle";
  const res = fetcher.data;

  useEffect(() => {
    if (fetcher.state === "idle" && res?.ok) setDirty(false);
  }, [fetcher.state, res]);

  const set = (patch: Partial<PpSettings>) => {
    setD((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };
  const setFeature = (k: PpFeature, on: boolean) => set({ features: { ...d.features, [k]: on } });
  const save = () => fetcher.submit({ payload: JSON.stringify(d) }, { method: "post" });

  return (
    <s-page heading={t("Product Popup")}>
      <style>{BB_CSS + CSS}</style>
      <div className="bb-wrap">
        <div className="bb-topbar">
          <div className="bb-inline">
            <label className="bb-switch">
              <input type="checkbox" checked={d.enabled} disabled={busy} onChange={(e) => set({ enabled: e.target.checked })} />
              <span className="knob" />
              <b>{d.enabled ? t("On") : t("Off")}</b>
            </label>
          </div>
          <div className="bb-topbar-r">
            {res?.message && !busy && !dirty ? <span className={`bb-flash ${res.ok === false ? "bad" : "ok"}`}>{t(res.message)}</span> : dirty ? <span className="bb-flash"><Translate text="Unsaved changes" /></span> : null}
            <button className="bb-btn gold" disabled={busy || !dirty} onClick={save}>{busy ? t("Saving…") : t("Save")}</button>
          </div>
        </div>

        <div className="bb-card bb-hero">
          <div>
            <h2><Translate text="Keep shoppers on the page while they look at a product" /></h2>
            <p><Translate text="When a shopper taps a product's photo or name in an XPoost feature, its photos, price and description open in a popup. The popup's button picks or adds the product exactly like the card's button, so offers and kit steps keep working." /></p>
          </div>
        </div>

        <div className="bb-layout">
          <div className="bb-main">
            <div className={`bb-card${d.enabled ? "" : " pp-off"}`}>
              <h3 className="bb-title"><span className="n">1</span>{t("Where products open in a popup")}</h3>
              <p className="bb-desc"><Translate text="Switch off a feature to send shoppers to the product page from it instead." /></p>
              <div className="pp-feat">
                {PP_FEATURES.map((k) => (
                  <label key={k} className="bb-check">
                    <input type="checkbox" checked={d.features[k]} onChange={(e) => setFeature(k, e.target.checked)} />
                    <span>
                      {t(PP_FEATURE_META[k].name)}
                      <small>{t(PP_FEATURE_META[k].blurb)}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bb-card">
              <h3 className="bb-title"><span className="n">2</span>{t("How it works")}</h3>
              <ul className="pp-how">
                <li><Translate text="The popup uses each feature's own colors and the shopper's language." /></li>
                <li><Translate text="The product photo from the card is reused, so it appears instantly. More photos load in a swipeable gallery." /></li>
                <li><Translate text="“View full product page” is always in the popup. Ctrl or Cmd + click still opens the product page." /></li>
                <li><Translate text="Shoppers close it with the Close button, the back button, Esc or by swiping down." /></li>
                <li><Translate text="Nothing to add to your theme: it works wherever the features are already shown." /></li>
              </ul>
            </div>
          </div>

          <div className="bb-sticky">
            <div className="bb-card">
              <h3 className="bb-title">{t("Preview")}</h3>
              <div className="pp-mock" aria-hidden="true">
                <div className="pp-screen">
                  <div className="pp-page"><i /><i /><i /><i /></div>
                  <div className="pp-dim" />
                  <div className="pp-sheet">
                    <span className="pp-x">✕ {t("Close")}</span>
                    <div className="pp-photo"><b /></div>
                    <div className="pp-dots"><s /><s /><s /></div>
                    <div className="pp-t" />
                    <div className="pp-p" />
                    <div className="pp-btn">{t("Add")}</div>
                    <div className="pp-ghost">{t("View full product page")}</div>
                    <div className="pp-l" />
                    <div className="pp-l" style={{ width: "80%" }} />
                  </div>
                </div>
              </div>
              <p className="bb-hint" style={{ textAlign: "center" }}><Translate text="Shown in white here. On your store it takes each feature's colors." /></p>
            </div>
          </div>
        </div>
      </div>
    </s-page>
  );
}
