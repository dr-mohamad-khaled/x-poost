import { useEffect, useRef, useState } from "react";
import {
  COND_META,
  COND_TYPES,
  TY_DESIGNS,
  TY_DESIGN_META,
  TY_LANGS,
  TY_LANG_META,
  TY_PLACEHOLDERS,
  TY_TEXT_FIELDS,
  defaultTexts,
  resolveTexts,
  type CondType,
  type TyCondition,
  type TyConditions,
  type TyDesign,
  type TyKind,
  type TyLang,
  type TyProduct,
  type TyTexts,
  type TyTextsByLang,
} from "../../utils/thankyou";

// ─────────────────────────────────────────────────────────────
// Design gallery
// ─────────────────────────────────────────────────────────────

const G = "#C9B78F";
const L = "#3e3b32";
const F = "#2a271e";

/** Tiny wireframes so the merchant sees the layout before picking */
export function DesignSchematic({ design }: { design: TyDesign }) {
  const w = 120;
  const h = 78;
  const body = (() => {
    switch (design) {
      case "gift_reveal":
        return (
          <>
            <rect x="10" y="8" width="100" height="62" rx="8" fill={F} stroke={L} />
            <rect x="42" y="14" width="36" height="6" rx="3" fill={L} />
            <rect x="26" y="26" width="68" height="26" rx="6" fill="#1d1a14" stroke={G} strokeDasharray="3 2" />
            <text x="60" y="43" textAnchor="middle" fontSize="12" fill={G}>🎁</text>
            <rect x="34" y="57" width="52" height="8" rx="4" fill={G} />
          </>
        );
      case "vip_ladder":
        return (
          <>
            <rect x="10" y="6" width="100" height="66" rx="8" fill={F} stroke={L} />
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x="16" y={12 + i * 19} width="88" height="15" rx="5" fill="#1d1a14" stroke={i === 2 ? G : L} />
                <circle cx="25" cy={19.5 + i * 19} r="4" fill={i === 2 ? G : L} />
                <rect x="34" y={17 + i * 19} width={40 + i * 8} height="5" rx="2.5" fill={L} />
                <rect x="84" y={16 + i * 19} width="16" height="7" rx="3.5" fill={i === 2 ? G : L} />
              </g>
            ))}
          </>
        );
      case "ship_timer":
        return (
          <>
            <rect x="10" y="6" width="100" height="66" rx="8" fill={F} stroke={L} />
            <rect x="16" y="11" width="88" height="14" rx="5" fill="#1d1a14" />
            <rect x="21" y="16" width="30" height="4" rx="2" fill={L} />
            <text x="98" y="22" textAnchor="end" fontSize="9" fontWeight="700" fill={G}>09:41</text>
            {[0, 1].map((i) => (
              <g key={i}>
                <rect x="16" y={30 + i * 20} width="18" height="16" rx="4" fill={L} />
                <rect x="38" y={32 + i * 20} width="38" height="4" rx="2" fill={L} />
                <rect x="38" y={39 + i * 20} width="22" height="3" rx="1.5" fill="#2f5d3a" />
                <rect x="82" y={34 + i * 20} width="22" height="9" rx="4.5" fill="none" stroke={G} />
              </g>
            ))}
          </>
        );
      case "routine":
        return (
          <>
            <rect x="10" y="6" width="100" height="66" rx="8" fill={F} stroke={L} />
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={16 + i * 30} y="12" width="26" height="32" rx="5" fill="#1d1a14" stroke={L} />
                <rect x={19 + i * 30} y="15" width="20" height="14" rx="3" fill={L} />
                <rect x={19 + i * 30} y="32" width="16" height="3" rx="1.5" fill={L} />
                <rect x={19 + i * 30} y="38" width="6" height="4" rx="1" fill={G} />
              </g>
            ))}
            <rect x="16" y="52" width="88" height="14" rx="6" fill={G} />
          </>
        );
      case "spotlight":
        return (
          <>
            <rect x="10" y="6" width="100" height="66" rx="8" fill={F} stroke={L} />
            <rect x="16" y="12" width="42" height="54" rx="6" fill={L} />
            <rect x="64" y="14" width="30" height="4" rx="2" fill={G} />
            <rect x="64" y="23" width="40" height="5" rx="2.5" fill="#d4d1c8" />
            <rect x="64" y="32" width="36" height="3" rx="1.5" fill={L} />
            <rect x="64" y="38" width="30" height="3" rx="1.5" fill={L} />
            <rect x="64" y="52" width="40" height="12" rx="6" fill={G} />
          </>
        );
      default:
        return (
          <>
            <rect x="10" y="24" width="100" height="30" rx="8" fill={F} stroke={L} />
            <rect x="18" y="31" width="44" height="5" rx="2.5" fill="#d4d1c8" />
            <rect x="18" y="40" width="30" height="3" rx="1.5" fill={L} />
            <rect x="74" y="32" width="28" height="12" rx="6" fill={G} />
          </>
        );
    }
  })();
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={TY_DESIGN_META[design].name}>
      {body}
    </svg>
  );
}

export function DesignPicker({ kind, value, onChange }: { kind: TyKind; value: TyDesign; onChange: (d: TyDesign) => void }) {
  return (
    <div className="ty-design-grid">
      {TY_DESIGNS.map((d) => {
        const meta = TY_DESIGN_META[d];
        const ok = meta.kinds.includes(kind);
        return (
          <button
            key={d}
            type="button"
            disabled={!ok}
            className={`ty-design ${value === d ? "on" : ""}`}
            onClick={() => ok && onChange(d)}
            title={ok ? meta.blurb : `Not available for “${kind}” offers`}
          >
            <DesignSchematic design={d} />
            <div className="ty-design-name">{meta.name}</div>
            <div className="ty-design-blurb">{meta.blurb}</div>
            {!ok ? <div className="ty-design-lock">Other offer types only</div> : null}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Search helpers
// ─────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

type Found = { id: string; title: string; imageUrl?: string; price?: string; variantId?: string; handle?: string };

function useSearch(url: "/api/products/search" | "/api/collections/search", q: string) {
  const [results, setResults] = useState<Found[]>([]);
  const [loading, setLoading] = useState(false);
  const term = useDebounced(q.trim());
  useEffect(() => {
    if (url === "/api/products/search" && !term) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`${url}?q=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: any) => {
        if (!alive) return;
        setResults(url === "/api/products/search" ? d.products || [] : d.collections || []);
      })
      .catch(() => alive && setResults([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, term]);
  return { results, loading };
}

// ─────────────────────────────────────────────────────────────
// Product picker (offer products)
// ─────────────────────────────────────────────────────────────

export function ProductPicker({ value, onChange, max }: { value: TyProduct[]; onChange: (v: TyProduct[]) => void; max: number }) {
  const [q, setQ] = useState("");
  const { results, loading } = useSearch("/api/products/search", q);
  const full = value.length >= max;

  const add = (f: Found) => {
    if (full || !f.variantId || value.some((p) => p.productId === f.id)) return;
    onChange([
      ...value,
      { productId: f.id, variantId: f.variantId, title: f.title, imageUrl: f.imageUrl || "", price: String(f.price || "0"), handle: f.handle || "" },
    ]);
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
    <div className="ty-picker">
      {value.length ? (
        <div className="ty-chosen">
          {value.map((p, i) => (
            <div key={p.productId} className="ty-chosen-row">
              {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <div className="ph" />}
              <div className="ttl">
                <div>{p.title}</div>
                <small>${Number(p.price).toFixed(2)}</small>
              </div>
              <button type="button" className="ty-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button type="button" className="ty-icon" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down">↓</button>
              <button type="button" className="ty-icon danger" onClick={() => onChange(value.filter((x) => x.productId !== p.productId))} aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="ty-empty">No products yet. Search below to add up to {max}.</div>
      )}
      {!full ? (
        <>
          <input className="ty-input" placeholder="Search your products…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q.trim() ? (
            <div className="ty-results">
              {loading ? <div className="ty-muted pad">Searching…</div> : null}
              {!loading && !results.length ? <div className="ty-muted pad">No matches</div> : null}
              {results.slice(0, 8).map((r) => (
                <button type="button" key={r.id} className="ty-result" onClick={() => add(r)} disabled={value.some((p) => p.productId === r.id)}>
                  {r.imageUrl ? <img src={r.imageUrl} alt="" /> : <div className="ph" />}
                  <span>{r.title}</span>
                  <small>${Number(r.price || 0).toFixed(2)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="ty-muted">Maximum of {max} products for this design.</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Condition builder
// ─────────────────────────────────────────────────────────────

function ResourceChips({
  kind,
  value,
  onChange,
}: {
  kind: "products" | "collections";
  value: { id: string; label: string }[];
  onChange: (v: { id: string; label: string }[]) => void;
}) {
  const [q, setQ] = useState("");
  const url = kind === "products" ? "/api/products/search" : "/api/collections/search";
  const { results, loading } = useSearch(url, q);
  return (
    <div className="ty-picker">
      <div className="ty-chips">
        {value.map((v) => (
          <span key={v.id} className="ty-chip">
            {v.label || v.id}
            <button type="button" onClick={() => onChange(value.filter((x) => x.id !== v.id))} aria-label="Remove">✕</button>
          </span>
        ))}
      </div>
      <input className="ty-input" placeholder={kind === "products" ? "Search products…" : "Search collections…"} value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() || kind === "collections" ? (
        <div className="ty-results">
          {loading ? <div className="ty-muted pad">Searching…</div> : null}
          {results.slice(0, 8).map((r) => (
            <button
              type="button"
              key={r.id}
              className="ty-result"
              disabled={value.some((x) => x.id === r.id)}
              onClick={() => {
                onChange([...value, { id: r.id, label: r.title }]);
                setQ("");
              }}
            >
              <span>{r.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const newRule = (type: CondType = "subtotal_gte"): TyCondition => ({ id: Math.random().toString(36).slice(2, 8), type });

export function ConditionBuilder({ value, onChange, currency }: { value: TyConditions; onChange: (v: TyConditions) => void; currency: string }) {
  const setRule = (id: string, patch: Partial<TyCondition>) => onChange({ ...value, rules: value.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  return (
    <div className="ty-conds">
      {value.rules.length === 0 ? (
        <div className="ty-empty">No conditions: this offer shows for <b>every order</b>. Add a condition to target it.</div>
      ) : (
        <div className="ty-match">
          Show this offer when
          <select className="ty-input sm" value={value.match} onChange={(e) => onChange({ ...value, match: e.target.value === "any" ? "any" : "all" })}>
            <option value="all">ALL of these are true</option>
            <option value="any">ANY of these is true</option>
          </select>
        </div>
      )}
      {value.rules.map((r, idx) => {
        const meta = COND_META[r.type];
        return (
          <div key={r.id} className="ty-rule">
            <div className="ty-rule-head">
              <span className="ty-rule-n">{idx + 1}</span>
              <select
                className="ty-input"
                value={r.type}
                onChange={(e) => {
                  const t = e.target.value as CondType;
                  onChange({ ...value, rules: value.rules.map((x) => (x.id === r.id ? { id: r.id, type: t } : x)) });
                }}
              >
                {COND_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {COND_META[t].label}
                  </option>
                ))}
              </select>
              <button type="button" className="ty-icon danger" onClick={() => onChange({ ...value, rules: value.rules.filter((x) => x.id !== r.id) })} aria-label="Remove condition">✕</button>
            </div>
            <div className="ty-rule-body">
              {meta.input === "num" ? (
                <div className="ty-inline">
                  {r.type.startsWith("subtotal") ? <span className="ty-muted">{currency}</span> : null}
                  <input
                    className="ty-input sm"
                    type="number"
                    min={0}
                    step={r.type.startsWith("subtotal") ? "1" : "1"}
                    value={r.num ?? ""}
                    placeholder={r.type.startsWith("subtotal") ? "e.g. 75" : "e.g. 2"}
                    onChange={(e) => setRule(r.id, { num: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                  {r.type.startsWith("subtotal") ? <span className="ty-muted">(before shipping & tax, in your store currency)</span> : null}
                </div>
              ) : null}
              {meta.input === "products" ? <ResourceChips kind="products" value={r.items || []} onChange={(items) => setRule(r.id, { items })} /> : null}
              {meta.input === "collections" ? <ResourceChips kind="collections" value={r.items || []} onChange={(items) => setRule(r.id, { items })} /> : null}
              {meta.input === "tags" || meta.input === "countries" || meta.input === "codes" || meta.input === "currencies" ? (
                <input
                  className="ty-input"
                  value={(r.values || []).join(", ")}
                  placeholder={
                    meta.input === "tags" ? "e.g. serum, bestseller" : meta.input === "countries" ? "e.g. US, CA, GB" : meta.input === "currencies" ? "e.g. USD, EUR" : "e.g. WELCOME10 (leave empty for any code)"
                  }
                  onChange={(e) => setRule(r.id, { values: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              ) : null}
              {meta.input === "choice" ? (
                <select className="ty-input sm" value={r.choice || "first"} onChange={(e) => setRule(r.id, { choice: e.target.value })}>
                  <option value="first">A first-time customer</option>
                  <option value="returning">A returning customer</option>
                </select>
              ) : null}
              {meta.input === "none" ? <span className="ty-muted">Nothing to set.</span> : null}
            </div>
          </div>
        );
      })}
      <button type="button" className="ty-btn ghost" onClick={() => onChange({ ...value, rules: [...value.rules, newRule()] })} disabled={value.rules.length >= 12}>
        + Add condition
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Texts & translations
// ─────────────────────────────────────────────────────────────

export function TextsEditor({
  kind,
  texts,
  onChange,
  lang,
  onLang,
}: {
  kind: TyKind;
  texts: TyTextsByLang;
  onChange: (t: TyTextsByLang) => void;
  lang: TyLang;
  onLang: (l: TyLang) => void;
}) {
  const effective = resolveTexts(kind, texts, lang);
  const defaults = defaultTexts(kind, lang);
  const focused = useRef<keyof TyTexts | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const fields = TY_TEXT_FIELDS.filter((f) => !f.kinds || f.kinds.includes(kind));
  const edited = (k: keyof TyTexts) => (texts[lang] as Partial<TyTexts> | undefined)?.[k] !== undefined;

  const setField = (k: keyof TyTexts, v: string) => {
    const cur = { ...((texts[lang] as Partial<TyTexts>) || {}) };
    if (v === defaults[k]) delete cur[k];
    else cur[k] = v;
    const next = { ...texts };
    if (Object.keys(cur).length) next[lang] = cur;
    else delete next[lang];
    onChange(next);
  };

  const insert = (token: string) => {
    const k = focused.current || "headline";
    const el = refs.current[k];
    const val = effective[k] || "";
    if (el && typeof el.selectionStart === "number") {
      const a = el.selectionStart;
      const b = el.selectionEnd ?? a;
      setField(k, val.slice(0, a) + token + val.slice(b));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(a + token.length, a + token.length);
      });
    } else setField(k, val + token);
  };

  const hasEdits = !!texts[lang] && Object.keys(texts[lang] as object).length > 0;

  return (
    <div className="ty-texts">
      <div className="ty-langs" role="tablist">
        {TY_LANGS.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={l === lang} className={`ty-lang ${l === lang ? "on" : ""}`} onClick={() => onLang(l)}>
            {TY_LANG_META[l].native}
            {texts[l] && Object.keys(texts[l] as object).length ? <span className="dot" title="Customised" /> : null}
          </button>
        ))}
      </div>
      <div className="ty-hint">
        Customers see the language of their checkout. Every language comes with ready-made copy; edit any line to make it yours.
        {lang !== "en" ? " Languages you don't edit use the built-in translation. Customers in other languages see English." : ""}
      </div>
      <div className="ty-ph">
        <span className="ty-muted">Click to insert:</span>
        {TY_PLACEHOLDERS.map((ph) => (
          <button key={ph.key} type="button" className="ty-ph-chip" title={ph.hint} onClick={() => insert(ph.key)}>
            {ph.key}
          </button>
        ))}
      </div>
      <div className="ty-fields">
        {fields.map((f) => {
          const common = {
            className: "ty-input",
            dir: TY_LANG_META[lang].dir,
            value: effective[f.key],
            onFocus: () => (focused.current = f.key),
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(f.key, e.target.value),
          };
          return (
            <div key={f.key} className="ty-field">
              <label>
                {f.label}
                {edited(f.key) ? (
                  <button type="button" className="ty-link" onClick={() => setField(f.key, defaults[f.key])}>
                    Reset
                  </button>
                ) : null}
              </label>
              {f.multiline ? (
                <textarea rows={2} {...common} ref={(el) => { refs.current[f.key] = el; }} />
              ) : (
                <input type="text" {...common} ref={(el) => { refs.current[f.key] = el; }} />
              )}
              {f.hint ? <small>{f.hint}</small> : null}
            </div>
          );
        })}
      </div>
      {hasEdits ? (
        <button
          type="button"
          className="ty-btn ghost"
          onClick={() => {
            const next = { ...texts };
            delete next[lang];
            onChange(next);
          }}
        >
          Reset all {TY_LANG_META[lang].label} text to the built-in copy
        </button>
      ) : null}
    </div>
  );
}
