import { useEffect, useMemo, useState } from "react";
import { formatCountdown, type TyRenderPayload } from "../../utils/thankyou";

/**
 * Live preview of a thank-you offer in the admin. It mirrors the layout of the checkout extension
 * (extensions/xpoost-thank-you) — the real page takes its colors, fonts and corners from the store's checkout branding.
 */

export const PREVIEW_CSS = `
.typ{font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#232323;background:#fff;border-radius:14px;padding:20px;text-align:start}
.typ *{box-sizing:border-box}
.typ .card{border:1px solid #e3e3e3;border-radius:14px;padding:20px;background:#fff}
.typ .card.soft{background:#f6f6f7}
.typ .stack{display:flex;flex-direction:column;gap:12px}
.typ .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.typ .center{align-items:center;text-align:center}
.typ h3{margin:0;font-size:20px;line-height:1.25;font-weight:700}
.typ .muted{color:#6d6d6d}
.typ .small{font-size:12px}
.typ .strong{font-weight:600}
.typ .badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;background:#e3f1df;color:#1a5c2a}
.typ .badge.info{background:#e1ecff;color:#1e4a9b}
.typ .badge.warn{background:#fff1cc;color:#7a5200}
.typ .btn{display:block;width:100%;text-align:center;padding:11px 16px;border-radius:10px;font-weight:600;border:1px solid #232323;background:#232323;color:#fff;cursor:pointer;font-size:14px}
.typ .btn.secondary{background:#fff;color:#232323;border-color:#cccccc}
.typ .btn.inline{display:inline-block;width:auto}
.typ .timer{display:flex;justify-content:space-between;align-items:center;background:#f1f2f3;border-radius:12px;padding:12px 16px}
.typ .timer b{font-size:22px;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.typ .thumb{width:64px;height:64px;border-radius:10px;background:linear-gradient(135deg,#ececec,#DCDCDC);object-fit:cover;flex-shrink:0}
.typ .thumb.big{width:100%;height:auto;aspect-ratio:1/1}
.typ .prow{display:grid;grid-template-columns:64px 1fr;gap:12px;align-items:center}
.typ .code{font-size:24px;font-weight:800;letter-spacing:.08em;font-variant-numeric:tabular-nums;word-break:break-all}
.typ .sealed{border:1px solid #d8d8d8;border-radius:14px;padding:22px;background:#fff;cursor:pointer;width:100%;text-align:center}
.typ .sealed:hover{border-color:#232323}
.typ .grid{display:grid;gap:10px}
.typ .tile{border:1px solid #e3e3e3;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px}
.typ .tile.off{background:#f6f6f7;opacity:.7}
.typ .spot{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center}
.typ.mobile .spot{grid-template-columns:1fr}
.typ .banner{background:#e8f1ff;border-radius:10px;padding:12px 14px}
.typ hr{border:0;border-top:1px solid #e3e3e3;margin:0}
.typ .sample{position:absolute;top:8px;right:12px}
`;

type Props = { payload: TyRenderPayload; mobile?: boolean; live?: boolean };

function useClock(payload: TyRenderPayload, live: boolean) {
  const target = payload.expiresAt ? Date.parse(payload.expiresAt) : 0;
  const offset = payload.serverNow ? Date.parse(payload.serverNow) - Date.now() : 0;
  const active = payload.kind !== "reward" && payload.showTimer !== false && !!payload.expiresAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, live]);
  const left = Math.max(0, target - (now + offset));
  return { active, text: formatCountdown(left), ended: active && left <= 0 };
}

const Thumb = ({ src, big }: { src?: string; big?: boolean }) =>
  src ? <img className={`thumb${big ? " big" : ""}`} src={src} alt="" /> : <div className={`thumb${big ? " big" : ""}`} />;

export function ThankYouPreview({ payload, mobile = false, live = true }: Props) {
  const clock = useClock(payload, live);
  const texts = useMemo(
    () => Object.fromEntries(Object.entries(payload.texts || {}).map(([k, v]) => [k, String(v).replace(/\{time_left\}/g, clock.text)])),
    [payload.texts, clock.text],
  ) as unknown as NonNullable<TyRenderPayload["texts"]>;
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  useEffect(() => setRevealed(false), [payload.offerId, payload.design]);

  if (!payload.show || !payload.texts) return null;
  const p = payload;
  const t = texts;
  const items = p.products || [];
  const over = (p.kind !== "reward" && p.expired) || clock.ended;
  const badge = p.benefit === "free_shipping" ? t.freeShippingBadge : t.savingsBadge;
  const dir = p.dir || "ltr";

  const Eyebrow = (tone = "") => (t.eyebrow ? <span className={`badge ${tone}`}>{t.eyebrow}</span> : null);
  const Foot = t.footnote ? <div className="muted small">{t.footnote}</div> : null;
  const Timer = clock.active ? (
    <div className="timer">
      <span className="muted">{t.timerLabel}</span>
      <b>{clock.text}</b>
    </div>
  ) : null;

  let body: JSX.Element | null = null;

  if (p.design === "gift_reveal" && p.rewards?.[0]) {
    const r = p.rewards[0];
    body = (
      <div className="card soft stack center">
        {Eyebrow()}
        <h3>{t.headline}</h3>
        <div className="muted">{t.subheadline}</div>
        {!revealed ? (
          <button type="button" className="sealed" onClick={() => setRevealed(true)}>
            <div style={{ fontSize: 28 }}>🎁</div>
            <div className="strong">{t.revealLabel}</div>
            <div className="muted small">{t.benefitLine}</div>
          </button>
        ) : (
          <div className="stack center" style={{ width: "100%" }}>
            <div className="card center stack" style={{ width: "100%", gap: 6 }}>
              <div className="muted small">{t.codeLabel}</div>
              <div className="code">{r.code}</div>
              <span className="badge info">{r.discountText}</span>
              {r.minSpendLine ? <div className="muted small">{r.minSpendLine}</div> : null}
              <div className="muted small">{t.validUntil}</div>
            </div>
            <div className="btn">{t.shopCta}</div>
            <div className="muted small">{t.applyNote}</div>
          </div>
        )}
        {Foot}
      </div>
    );
  } else if (p.design === "vip_ladder" && p.rewards?.length) {
    const rs = p.rewards;
    body = (
      <div className="card stack">
        <div className="row">{Eyebrow("info")}</div>
        <h3>{t.headline}</h3>
        <div className="muted">{t.subheadline}</div>
        {rs.map((r, i) => (
          <div key={r.code} className={`card stack ${i === rs.length - 1 ? "soft" : ""}`} style={{ padding: 14, gap: 8 }}>
            <div className="row">
              <span className={`badge ${i === rs.length - 1 ? "" : "info"}`}>{i + 1}</span>
              <span className="strong">{r.label}</span>
            </div>
            <div className="muted small">
              {t.codeLabel}: {r.code}
            </div>
            <div className={`btn ${i === 0 ? "" : "secondary"}`}>{t.shopCta}</div>
          </div>
        ))}
        <div className="muted small">
          {t.validUntil}. {t.applyNote}
        </div>
        {Foot}
      </div>
    );
  } else if (p.design === "ship_timer" && items.length) {
    body = (
      <div className="card stack">
        <div className="row">{Eyebrow()}</div>
        <h3>{t.headline}</h3>
        <div className="muted">{t.subheadline}</div>
        {over ? (
          <div className="banner">{t.timerExpired}</div>
        ) : (
          <>
            {Timer}
            <div className="strong">{t.benefitLine}</div>
            <hr />
            {items.map((it) => (
              <div key={it.variantId} className="stack" style={{ gap: 8 }}>
                <div className="prow">
                  <Thumb src={it.imageUrl} />
                  <div>
                    <div className="strong">{it.title}</div>
                    <div className="row" style={{ gap: 6 }}>
                      {it.priceText ? <span className="muted">{it.priceText}</span> : null}
                      <span className="badge">{badge}</span>
                    </div>
                  </div>
                </div>
                <div className="btn secondary">{t.productCta}</div>
              </div>
            ))}
            {items.length > 1 ? <div className="btn">{t.bundleCta}</div> : null}
          </>
        )}
        {Foot}
      </div>
    );
  } else if (p.design === "routine" && items.length) {
    const cols = mobile ? 2 : items.length === 4 ? 4 : items.length;
    body = (
      <div className="card stack">
        <div className="row">{Eyebrow("info")}</div>
        <h3>{t.headline}</h3>
        <div className="muted">{t.subheadline}</div>
        {over ? (
          <div className="banner">{t.timerExpired}</div>
        ) : (
          <>
            {Timer}
            <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {items.map((it) => {
                const on = picked[it.vid] !== false;
                return (
                  <div key={it.variantId} className={`tile ${on ? "" : "off"}`}>
                    <Thumb src={it.imageUrl} big />
                    <div className="strong" style={{ fontSize: 13 }}>{it.title}</div>
                    <div className="row" style={{ gap: 6 }}>
                      {it.priceText ? <span className="muted small">{it.priceText}</span> : null}
                      <span className="badge">{badge}</span>
                    </div>
                    <label className="row small" style={{ cursor: "pointer" }}>
                      <input type="checkbox" checked={on} onChange={() => setPicked((s) => ({ ...s, [it.vid]: !on }))} />
                      {t.productCta}
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="strong">{t.benefitLine}</div>
            <div className="btn">{t.bundleCta}</div>
          </>
        )}
        {Foot}
      </div>
    );
  } else if (p.design === "spotlight" && items[0]) {
    const it = items[0];
    body = (
      <div className="card stack">
        {over ? (
          <div className="banner">{t.timerExpired}</div>
        ) : (
          <div className="spot">
            <Thumb src={it.imageUrl} big />
            <div className="stack">
              <div className="row">{Eyebrow()}</div>
              <h3>{t.headline}</h3>
              <div className="muted">{t.subheadline}</div>
              <div className="row">
                <span className="strong">{it.title}</span>
                {it.priceText ? <span className="muted">{it.priceText}</span> : null}
              </div>
              <div className="row">
                <span className="badge">{badge}</span>
                <span>{t.benefitLine}</span>
              </div>
              {Timer}
              <div className="btn">{t.productCta}</div>
            </div>
          </div>
        )}
        {Foot}
      </div>
    );
  } else {
    // minimal
    const isReward = p.kind === "reward";
    const r = p.rewards?.[0];
    if (!isReward && over) body = <div className="banner">{t.timerExpired}</div>;
    else {
      const sub = isReward && r ? `${t.codeLabel}: ${r.code} · ${r.discountText}` : clock.active ? `${t.timerLabel} ${clock.text}` : t.benefitLine;
      const label = isReward ? t.shopCta : items.length > 1 ? t.bundleCta : t.productCta;
      body = (
        <div className="card soft stack" style={{ padding: 14 }}>
          <div>
            <div className="strong">{t.headline}</div>
            <div className="muted">{sub}</div>
          </div>
          <div className="btn">{label}</div>
        </div>
      );
    }
  }

  return (
    <div className={`typ${mobile ? " mobile" : ""}`} dir={dir} style={{ position: "relative" }}>
      {p.sample ? <span className="badge warn sample">Preview</span> : null}
      {body}
    </div>
  );
}
