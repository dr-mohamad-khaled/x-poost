import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "../Translate";
import {
  BB_COND_META,
  BB_COND_TYPES,
  BB_DESIGN_META,
  newId,
  resolveTexts,
  type BbCollection,
  type BbCondType,
  type BbCondition,
  type BbConditions,
  type BbConfig,
  type BbDesign,
  type BbLang,
  type BbPlacement,
  type BbProduct,
  type BbStyle,
  type BbTextsByLang,
  type BbType,
} from "../../utils/bundles";
// The exact storefront renderer, so the preview is what shoppers will see
import STOREFRONT_JS from "../../../extensions/xpoost-storefront/assets/xpoost-bundles.js?raw";
import STOREFRONT_CSS from "../../../extensions/xpoost-storefront/assets/xpoost-bundles.css?raw";

// ─────────────────────────────────────────────────────────────
// Search helpers
// ─────────────────────────────────────────────────────────────

function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}

type Found = { id: string; title: string; handle?: string; imageUrl?: string; price?: string; variantId?: string };

function useSearch(url: "/api/products/search" | "/api/collections/search", q: string, enabled = true) {
  const [results, setResults] = useState<Found[]>([]);
  const [loading, setLoading] = useState(false);
  const term = useDebounced(q.trim());
  useEffect(() => {
    if (!enabled || (url === "/api/products/search" && !term)) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`${url}?q=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: any) => alive && setResults(url === "/api/products/search" ? d.products || [] : d.collections || []))
      .catch(() => alive && setResults([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, term, enabled]);
  return { results, loading };
}

// ─────────────────────────────────────────────────────────────
// Product picker
// ─────────────────────────────────────────────────────────────

export function ProductPicker({
  value,
  onChange,
  max,
  qty,
  onQty,
  placeholder,
}: {
  value: BbProduct[];
  onChange: (v: BbProduct[]) => void;
  max: number;
  qty?: Record<string, number>;
  onQty?: (id: string, q: number) => void;
  placeholder?: string;
}) {
  const { t } = useTranslations();
  const [q, setQ] = useState("");
  const { results, loading } = useSearch("/api/products/search", q);
  const full = value.length >= max;
  const add = (f: Found) => {
    if (full || value.some((p) => p.id === f.id) || !f.handle) return;
    onChange([...value, { id: f.id, title: f.title, handle: f.handle, imageUrl: f.imageUrl || "", price: String(f.price || "0"), variantId: f.variantId || undefined }]);
    setQ("");
  };
  const move = (i: number, d: number) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="bb-picker">
      {value.length ? (
        <div className="bb-chosen">
          {value.map((p, i) => (
            <div key={p.id} className="bb-chosen-row">
              {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <div className="ph" />}
              <div className="ttl">
                <div>{p.title}</div>
                <small>{Number(p.price || 0).toFixed(2)}</small>
              </div>
              {onQty ? (
                <label className="bb-inline bb-sm">
                  {t("Qty")}
                  <input className="bb-input xs" type="number" min={1} max={10} value={qty?.[p.id] ?? 1} onChange={(e) => onQty(p.id, Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
                </label>
              ) : null}
              {max > 1 ? (
                <>
                  <button type="button" className="bb-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("Move up")}>↑</button>
                  <button type="button" className="bb-icon" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={t("Move down")}>↓</button>
                </>
              ) : null}
              <button type="button" className="bb-icon danger" onClick={() => onChange(value.filter((x) => x.id !== p.id))} aria-label={t("Remove")}>✕</button>
            </div>
          ))}
        </div>
      ) : null}
      {!full ? (
        <>
          <input className="bb-input" placeholder={placeholder || t("Search your products…")} value={q} onChange={(e) => setQ(e.target.value)} />
          {q.trim() ? (
            <div className="bb-results">
              {loading ? <div className="bb-muted pad">{t("Searching…")}</div> : null}
              {!loading && !results.length ? <div className="bb-muted pad">{t("No matches")}</div> : null}
              {results.slice(0, 10).map((r) => (
                <button type="button" key={r.id} className="bb-result" onClick={() => add(r)} disabled={value.some((p) => p.id === r.id)}>
                  {r.imageUrl ? <img src={r.imageUrl} alt="" /> : <div className="ph" />}
                  <span>{r.title}</span>
                  <small>{Number(r.price || 0).toFixed(2)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : max > 1 ? (
        <div className="bb-muted bb-sm">{t("Maximum of {max} products.", { max })}</div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Collection picker (also used for "where it shows")
// ─────────────────────────────────────────────────────────────

export function CollectionPicker({ value, onChange, max }: { value: BbCollection[]; onChange: (v: BbCollection[]) => void; max: number }) {
  const { t } = useTranslations();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { results, loading } = useSearch("/api/collections/search", q, open);
  const full = value.length >= max;
  return (
    <div className="bb-picker">
      {value.length ? (
        <div className="bb-chips">
          {value.map((c) => (
            <span key={c.id} className="bb-chip">
              {c.title || c.id}
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== c.id))} aria-label={t("Remove")}>✕</button>
            </span>
          ))}
        </div>
      ) : null}
      {!full ? (
        <>
          <input className="bb-input" placeholder={t("Search collections…")} value={q} onFocus={() => setOpen(true)} onChange={(e) => setQ(e.target.value)} />
          {open ? (
            <div className="bb-results">
              {loading ? <div className="bb-muted pad">{t("Searching…")}</div> : null}
              {!loading && !results.length ? <div className="bb-muted pad">{t("No matches")}</div> : null}
              {results.slice(0, 10).map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="bb-result"
                  disabled={value.some((x) => x.id === r.id)}
                  onClick={() => {
                    onChange([...value, { id: r.id, title: r.title, handle: r.handle || "" }]);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <span>{r.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Product/collection references (id + label) for placement rules */
export function RefPicker({ kind, value, onChange }: { kind: "products" | "collections"; value: { id: string; label: string }[]; onChange: (v: { id: string; label: string }[]) => void }) {
  if (kind === "collections") {
    return <CollectionPicker value={value.map((v) => ({ id: v.id, title: v.label, handle: "" }))} onChange={(list) => onChange(list.map((c) => ({ id: c.id, label: c.title })))} max={50} />;
  }
  return (
    <ProductPicker
      value={value.map((v) => ({ id: v.id, title: v.label, handle: v.id, imageUrl: "", price: "" }))}
      onChange={(list) => onChange(list.map((p) => ({ id: p.id, label: p.title })))}
      max={100}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Conditions
// ─────────────────────────────────────────────────────────────

export function ConditionBuilder({ value, onChange, currency, hasScope }: { value: BbConditions; onChange: (v: BbConditions) => void; currency: string; hasScope: boolean }) {
  const { t } = useTranslations();
  const setRule = (id: string, patch: Partial<BbCondition>) => onChange({ ...value, rules: value.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const needsCustomer = value.rules.some((r) => ["tag_any", "tag_none", "orders_gte", "orders_lte", "spent_gte"].includes(r.type));
  return (
    <div className="bb-conds">
      {value.rules.length === 0 ? (
        <div className="bb-empty">{t("No conditions: every shopper sees this bundle and gets its price.")}</div>
      ) : (
        <div className="bb-match">
          {t("Show the bundle and give its price when")}
          <select className="bb-input sm" value={value.match} onChange={(e) => onChange({ ...value, match: e.target.value === "any" ? "any" : "all" })}>
            <option value="all">{t("ALL of these are true")}</option>
            <option value="any">{t("ANY of these is true")}</option>
          </select>
        </div>
      )}
      {needsCustomer && !hasScope ? (
        <div className="bb-banner warn">{t("Customer rules need the new “read customers” permission. Open XPoost from your Shopify admin after the next deploy and approve it; until then these rules won't match anyone.")}</div>
      ) : null}
      {value.rules.map((r, idx) => {
        const meta = BB_COND_META[r.type];
        return (
          <div key={r.id} className="bb-rule">
            <div className="bb-rule-head">
              <span className="bb-rule-n">{idx + 1}</span>
              <select className="bb-input" value={r.type} onChange={(e) => onChange({ ...value, rules: value.rules.map((x) => (x.id === r.id ? { id: r.id, type: e.target.value as BbCondType } : x)) })}>
                {BB_COND_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {t(BB_COND_META[ct].label)}
                  </option>
                ))}
              </select>
              <button type="button" className="bb-icon danger" onClick={() => onChange({ ...value, rules: value.rules.filter((x) => x.id !== r.id) })} aria-label={t("Remove condition")}>✕</button>
            </div>
            {meta.input === "num" || meta.input === "money" ? (
              <div className="bb-inline">
                {meta.input === "money" ? <span className="bb-muted">{currency}</span> : null}
                <input className="bb-input sm" type="number" min={0} value={r.num ?? ""} placeholder={meta.input === "money" ? "250" : "1"} onChange={(e) => setRule(r.id, { num: e.target.value === "" ? undefined : Number(e.target.value) })} />
                {meta.hint ? <span className="bb-muted bb-sm">{t(meta.hint)}</span> : null}
              </div>
            ) : null}
            {meta.input === "tags" || meta.input === "countries" || meta.input === "markets" ? (
              <input
                key={`${r.id}-${r.type}`}
                className="bb-input"
                defaultValue={(r.values || []).join(", ")}
                placeholder={meta.input === "tags" ? t("e.g. VIP, wholesale") : meta.input === "countries" ? t("e.g. US, GB, AE") : t("Market handles, e.g. gcc, europe")}
                onBlur={(e) => setRule(r.id, { values: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            ) : null}
            {meta.input === "none" ? <span className="bb-muted bb-sm">{t("Nothing to set.")}</span> : null}
          </div>
        );
      })}
      <div>
        <button type="button" className="bb-btn ghost sm" onClick={() => onChange({ ...value, rules: [...value.rules, { id: newId(), type: "tag_any" }] })} disabled={value.rules.length >= 12}>
          {t("+ Add condition")}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Design wireframes
// ─────────────────────────────────────────────────────────────

const K = "#1d1d1d";
const L = "#c9c5bc";
const F = "#e4e1da";

export function DesignSchematic({ design }: { design: BbDesign }) {
  const card = (x: number, y: number, w: number, h: number, on = false) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="#fff" stroke={on ? K : L} strokeWidth={on ? 1.6 : 1} />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h * 0.55} rx="2" fill={F} />
      <rect x={x + 3} y={y + h * 0.66} width={w * 0.6} height="3" rx="1.5" fill={L} />
      <rect x={x + 3} y={y + h - 9} width={w - 6} height="6" rx="2" fill={on ? K : "#fff"} stroke={K} strokeWidth=".8" />
    </g>
  );
  const cta = <rect x="96" y="96" width="56" height="12" rx="3" fill={K} />;
  const total = <rect x="8" y="99" width="40" height="6" rx="2" fill={L} />;
  let body;
  switch (design) {
    case "slots":
      body = (
        <>
          {[0, 1, 2].map((i) => <rect key={i} x={8 + i * 48} y={8} width="44" height="18" rx="3" fill={i === 0 ? "#fff" : F} stroke={i === 0 ? K : L} strokeDasharray={i === 0 ? "" : "2 2"} />)}
          {[0, 1, 2].map((i) => card(8 + i * 48, 32, 44, 54, i === 0))}
          {total}
          {cta}
        </>
      );
      break;
    case "grid":
      body = (
        <>
          {[0, 1, 2].map((i) => card(8 + i * 48, 8, 44, 40, i === 1))}
          {[0, 1, 2].map((i) => card(8 + i * 48, 52, 44, 30))}
          <rect x="0" y="88" width="160" height="32" fill="#fff" />
          <rect x="8" y="92" width="10" height="10" rx="2" fill={F} stroke={L} />
          <rect x="21" y="92" width="10" height="10" rx="2" fill={F} stroke={L} />
          {cta}
        </>
      );
      break;
    case "stepper":
      body = (
        <>
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={14 + i * 44} cy="12" r="6" fill={i === 0 ? K : "#fff"} stroke={i === 0 ? K : L} />)}
          <line x1="20" y1="12" x2="52" y2="12" stroke={L} />
          <line x1="64" y1="12" x2="96" y2="12" stroke={L} />
          <line x1="108" y1="12" x2="140" y2="12" stroke={L} />
          {[0, 1].map((i) => card(8 + i * 48, 26, 44, 56, i === 0))}
          <rect x="112" y="86" width="40" height="10" rx="3" fill={K} />
          {total}
        </>
      );
      break;
    case "list":
      body = (
        <>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x="8" y={8 + i * 20} width="14" height="14" rx="2" fill={F} />
              <rect x="28" y={11 + i * 20} width="60" height="4" rx="2" fill={L} />
              <rect x="120" y={9 + i * 20} width="32" height="12" rx="6" fill="#fff" stroke={L} />
              <line x1="8" y1={26 + i * 20} x2="152" y2={26 + i * 20} stroke={F} />
            </g>
          ))}
          {total}
          {cta}
        </>
      );
      break;
    case "classic":
      body = (
        <>
          {[0, 1, 2].map((i) => card(8 + i * 52, 10, 40, 70))}
          <circle cx="52" cy="45" r="4" fill="#fff" stroke={L} />
          <circle cx="104" cy="45" r="4" fill="#fff" stroke={L} />
          {total}
          {cta}
        </>
      );
      break;
    case "tiles":
      body = (
        <>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <g key={i}>
              <rect x={8 + (i % 4) * 37} y={8 + Math.floor(i / 4) * 40} width="33" height="36" rx="3" fill="#fff" stroke={i < 3 ? K : L} strokeWidth={i < 3 ? 1.5 : 1} />
              <rect x={11 + (i % 4) * 37} y={11 + Math.floor(i / 4) * 40} width="27" height="20" rx="2" fill={F} />
              {i < 3 ? <circle cx={36 + (i % 4) * 37} cy={12 + Math.floor(i / 4) * 40} r="4" fill={K} /> : null}
            </g>
          ))}
          {total}
          {cta}
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 160 116" role="img" aria-label={BB_DESIGN_META[design].name}>
      <rect width="160" height="116" fill="#F5F3EE" />
      {body}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Color field
// ─────────────────────────────────────────────────────────────

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="bb-color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <span>
        {label}
        <br />
        <code>{value}</code>
      </span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Live preview (renders the real storefront code in an iframe)
// ─────────────────────────────────────────────────────────────

export type PreviewProduct = {
  id: string;
  handle: string;
  title: string;
  image: string;
  available: boolean;
  variants: { id: string; title: string; price: number; compare: number; available: boolean; image: string }[];
};

const tailId = (g: string) => String(g || "").split("/").pop() || "";

function placeholderProducts(seed: string, n: number, base = 1900): PreviewProduct[] {
  const tones = ["#d9c7b0", "#b7c9d6", "#c9d6b7", "#e2c2c8", "#cfc4e3", "#e6dcb8"];
  return Array.from({ length: n }, (_, i) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='${tones[(i + seed.length) % tones.length]}'/><circle cx='150' cy='130' r='52' fill='rgba(255,255,255,.55)'/></svg>`;
    const img = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    return {
      id: `${seed}${i}`,
      handle: `__sample-${seed}-${i}`,
      title: `Sample product ${i + 1}`,
      image: img,
      available: true,
      variants: [{ id: `9${i}${seed.length}`, title: "", price: base + i * 400, compare: 0, available: true, image: "" }],
    };
  });
}

/** Builds the same payload the storefront receives from the app proxy. */
export function previewPayload(
  input: { id: string; name: string; type: BbType; design: BbDesign; config: BbConfig; placement: BbPlacement; style: BbStyle; texts: BbTextsByLang },
  lang: BbLang,
  catalog: { products: Record<string, PreviewProduct>; collections: Record<string, string[]> },
) {
  const c = input.config;
  const texts = resolveTexts(input.texts, lang);
  const products: Record<string, PreviewProduct> = {};
  const use = (p: { id: string; handle: string; title: string; imageUrl: string; price: string; variantId?: string }) => {
    const real = catalog.products[tailId(p.id)];
    if (real) {
      products[real.handle] = real;
      return real.handle;
    }
    const cents = Math.round(Number(p.price || 0) * 100);
    products[p.handle] = {
      id: tailId(p.id),
      handle: p.handle,
      title: p.title,
      image: p.imageUrl,
      available: true,
      variants: [{ id: tailId(p.variantId || p.id), title: "", price: cents, compare: 0, available: true, image: "" }],
    };
    return p.handle;
  };
  const steps =
    input.type === "mix" || input.type === "box"
      ? c.steps.map((s, i) => {
          const handles = s.products.map(use);
          for (const col of s.collections) {
            const list = catalog.collections[tailId(col.id)];
            if (list && list.length) {
              for (const h of list) {
                const real = Object.values(catalog.products).find((x) => x.handle === h);
                if (real && !handles.includes(h)) {
                  products[h] = real;
                  handles.push(h);
                }
              }
            } else {
              for (const p of placeholderProducts(`c${i}`, 3)) {
                products[p.handle] = p;
                handles.push(p.handle);
              }
            }
          }
          if (!handles.length) {
            for (const p of placeholderProducts(`s${i}`, Math.max(3, s.max + 1))) {
              products[p.handle] = p;
              handles.push(p.handle);
            }
          }
          return { id: s.id, title: texts.steps[s.id] || s.title, min: s.min, max: s.max, handles };
        })
      : [];
  let fixed: { handle: string; qty: number }[] = [];
  if (input.type === "fixed") {
    fixed = c.fixed.map((f) => ({ handle: use(f), qty: f.qty }));
    if (!fixed.length) fixed = placeholderProducts("f", 3).map((p) => ((products[p.handle] = p), { handle: p.handle, qty: 1 }));
  }
  let multipack = null as null | { handle: string; min: number; max: number };
  if (input.type === "multipack") {
    let h: string;
    if (c.multipack.product) h = use(c.multipack.product);
    else {
      const p = placeholderProducts("m", 1)[0];
      p.title = "Sample product";
      p.variants = ["Option A", "Option B", "Option C", "Option D"].map((v, i) => ({ id: `77${i}`, title: v, price: 450, compare: 0, available: true, image: "" }));
      products[p.handle] = p;
      h = p.handle;
    }
    multipack = { handle: h, min: c.multipack.min, max: c.multipack.max };
  }
  let gift = null as null | { handle: string; variantId: string; minItems: number };
  if (c.gift.enabled && c.gift.product) {
    const h = use(c.gift.product);
    const p = products[h];
    gift = { handle: h, variantId: (p && p.variants[0]?.id) || tailId(c.gift.product.variantId || ""), minItems: c.gift.minItems };
  }
  const { steps: _s, ...plain } = texts;
  return {
    bundle: {
      id: input.id,
      name: input.name,
      type: input.type,
      design: input.design,
      display: c.display,
      afterAdd: "stay",
      hideSoldOut: c.hideSoldOut,
      allowDuplicates: c.allowDuplicates,
      steps,
      fixed,
      multipack,
      pricing: c.pricing,
      gift,
      style: input.style,
      texts: plain,
    },
    products,
  };
}

const FRAME_HTML = (css: string, js: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
<style>html,body{margin:0;background:#EDEBE6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}#m{padding:14px}#host{position:relative}</style>
</head><body><div id="m"></div><div id="host"></div>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
<script>
(function(){
  var cur=null;
  function size(){ try{ var h=document.documentElement.scrollHeight; var ov=document.querySelector('.xpb-overlay:not([hidden])'); parent.postMessage({__xpbH: ov?640:h},'*'); }catch(e){} }
  window.addEventListener('message',function(e){
    var d=e.data; if(!d||!d.__xpb) return;
    var m=document.getElementById('m'); m.innerHTML=''; document.querySelectorAll('.xpb-overlay').forEach(function(o){o.remove()});
    document.documentElement.classList.remove('xpb-lock');
    var el=document.createElement('div'); m.appendChild(el);
    document.documentElement.dir=d.rtl?'rtl':'ltr';
    cur=window.XPB.mount(el,d.bundle,{preview:true,products:d.products,rtl:d.rtl,moneyFormat:d.moneyFormat,currency:d.currency,rate:1});
    if(d.open && cur.overlay){ cur.open(); }
    setTimeout(size,60); setTimeout(size,400);
  });
  new MutationObserver(function(){ size(); }).observe(document.body,{subtree:true,childList:true,attributes:true});
  parent.postMessage({__xpbReady:1},'*');
})();
</script></body></html>`;

export function BundlePreview({ payload, rtl, moneyFormat, currency, device }: { payload: { bundle: any; products: any }; rtl: boolean; moneyFormat: string; currency: string; device: "desktop" | "mobile" }) {
  const { t } = useTranslations();
  const ref = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(440);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(560);
  const [openOverlay, setOpenOverlay] = useState(false);
  const srcDoc = useMemo(() => FRAME_HTML(STOREFRONT_CSS, STOREFRONT_JS), []);
  const msg = useMemo(() => JSON.stringify(payload), [payload]);
  const isOverlay = payload.bundle.display !== "inline";

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth || 440));
    ro.observe(el);
    setBoxW(el.clientWidth || 440);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      if (e.data?.__xpbReady) setReady(true);
      if (typeof e.data?.__xpbH === "number") setHeight(Math.max(220, Math.min(2400, e.data.__xpbH)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!ready || !ref.current?.contentWindow) return;
    const id = setTimeout(() => {
      ref.current?.contentWindow?.postMessage({ __xpb: 1, ...JSON.parse(msg), rtl, moneyFormat, currency, open: isOverlay && openOverlay }, "*");
    }, 120);
    return () => clearTimeout(id);
  }, [ready, msg, rtl, moneyFormat, currency, isOverlay, openOverlay]);

  return (
    <>
      {isOverlay ? (
        <div className="bb-seg sm" style={{ marginBottom: 8 }}>
          <button type="button" className={!openOverlay ? "on" : ""} onClick={() => setOpenOverlay(false)}>{t("Closed")}</button>
          <button type="button" className={openOverlay ? "on" : ""} onClick={() => setOpenOverlay(true)}>{t("Opened")}</button>
        </div>
      ) : null}
      <div ref={boxRef} style={{ width: "100%" }}>
        {(() => {
          // Desktop is drawn at a real 780px width and scaled down to fit, so the layout matches the store
          const virtual = device === "desktop" ? 780 : 390;
          const scale = Math.min(1, boxW / virtual);
          return (
            <div className="bb-stage" style={{ width: virtual * scale, height: height * scale }}>
              <iframe ref={ref} title={t("Bundle preview")} srcDoc={srcDoc} style={{ width: virtual, height, transform: `scale(${scale})`, transformOrigin: "0 0" }} sandbox="allow-scripts" />
            </div>
          );
        })()}
      </div>
    </>
  );
}
