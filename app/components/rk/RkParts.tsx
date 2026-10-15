import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "../Translate";
import type { RcDesign } from "../../utils/recs";
import type { KbDesign } from "../../utils/kits";
// The exact storefront renderers, so the previews are what shoppers will see
import RECS_JS from "../../../extensions/xpoost-storefront/assets/xpoost-recs.js?raw";
import RECS_CSS from "../../../extensions/xpoost-storefront/assets/xpoost-recs.css?raw";
import KIT_JS from "../../../extensions/xpoost-storefront/assets/xpoost-kit.js?raw";
import KIT_CSS from "../../../extensions/xpoost-storefront/assets/xpoost-kit.css?raw";

const K = "#1a1a1a";
const L = "#c9c5bc";
const F = "#e4e1da";

// ─────────────────────────────────────────────────────────────
// Design schematics
// ─────────────────────────────────────────────────────────────

export function RcSchematic({ design }: { design: RcDesign }) {
  const card = (x: number, y: number, w: number, h: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h * 0.5} rx="3" fill={F} />
      <rect x={x} y={y + h * 0.56} width={w * 0.7} height="3.5" rx="1.5" fill={L} />
      <rect x={x} y={y + h * 0.66} width={w * 0.45} height="3.5" rx="1.5" fill={K} />
      <rect x={x} y={y + h * 0.76} width={w} height="7" rx="2" fill="#fff" stroke={L} />
      <rect x={x} y={y + h - 9} width={w} height="9" rx="2.5" fill={K} />
    </g>
  );
  let body;
  switch (design) {
    case "cards":
      body = [0, 1, 2].map((i) => card(10 + i * 48, 22, 42, 84));
      break;
    case "compact":
      body = [0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="10" y={22 + i * 30} width="22" height="22" rx="3" fill={F} />
          <rect x="38" y={25 + i * 30} width="58" height="4" rx="2" fill={L} />
          <rect x="38" y={33 + i * 30} width="30" height="4" rx="2" fill={K} />
          <rect x="116" y={26 + i * 30} width="34" height="12" rx="3" fill={K} />
          {i < 2 ? <line x1="10" y1={48 + i * 30} x2="150" y2={48 + i * 30} stroke={F} /> : null}
        </g>
      ));
      break;
    case "checklist":
      body = (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="10" y={20 + i * 22} width="140" height="18" rx="3" fill="#fff" stroke={i < 2 ? K : L} />
              <rect x="15" y={25 + i * 22} width="8" height="8" rx="2" fill={i < 2 ? K : "#fff"} stroke={i < 2 ? K : L} />
              <rect x="27" y={23 + i * 22} width="12" height="12" rx="2" fill={F} />
              <rect x="44" y={27 + i * 22} width="50" height="4" rx="2" fill={L} />
              <rect x="122" y={27 + i * 22} width="22" height="4" rx="2" fill={K} />
            </g>
          ))}
          <rect x="10" y="94" width="36" height="6" rx="2" fill={K} />
          <rect x="92" y="90" width="58" height="14" rx="3" fill={K} />
        </>
      );
      break;
    case "mini":
      body = [0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={10 + i * 36} y="26" width="32" height="32" rx="3" fill={F} />
          <rect x={12 + i * 36} y="28" width="14" height="6" rx="3" fill="#fff" />
          <circle cx={36 + i * 36} cy="52" r="5" fill={K} />
          <rect x={10 + i * 36} y="63" width="24" height="3.5" rx="1.5" fill={L} />
        </g>
      ));
      break;
    case "carousel":
      body = (
        <>
          {[0, 1, 2].map((i) => card(10 + i * 56, 22, 50, 84))}
          <rect x="150" y="0" width="10" height="116" fill="#F5F3EE" />
          <circle cx="128" cy="12" r="5" fill="#fff" stroke={L} />
          <circle cx="142" cy="12" r="5" fill="#fff" stroke={L} />
        </>
      );
      break;
    case "inline":
      body = [0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="10" y={24 + i * 22} width="140" height="17" rx="8.5" fill="#fff" stroke={L} />
          <circle cx="19" cy={32.5 + i * 22} r="5.5" fill={F} />
          <rect x="29" y={30 + i * 22} width="56" height="4" rx="2" fill={L} />
          <rect x="92" y={30 + i * 22} width="20" height="4" rx="2" fill={K} />
          <circle cx="141" cy={32.5 + i * 22} r="5.5" fill={K} />
        </g>
      ));
      break;
  }
  return (
    <svg viewBox="0 0 160 116" role="img" aria-label={design}>
      <rect width="160" height="116" fill="#F5F3EE" />
      <rect x="10" y="8" width="70" height="5" rx="2" fill={K} />
      {body}
    </svg>
  );
}

export function KbSchematic({ design }: { design: KbDesign }) {
  const prod = (x: number, y: number, w: number, h: number, on = false) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="#fff" stroke={on ? K : L} strokeWidth={on ? 1.6 : 1} />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h * 0.55} rx="2" fill={F} />
      <rect x={x + 3} y={y + h * 0.68} width={w * 0.6} height="3" rx="1.5" fill={L} />
      {on ? <circle cx={x + w - 5} cy={y + 5} r="4" fill={K} /> : null}
    </g>
  );
  let body;
  switch (design) {
    case "journey":
      body = (
        <>
          {[0, 1, 2].map((i) => <rect key={i} x={10 + i * 48} y="8" width="44" height="10" rx="5" fill={i === 0 ? K : i === 1 ? "#fff" : F} stroke={i === 1 ? K : "none"} />)}
          {[0, 1, 2].map((i) => prod(10 + i * 48, 26, 44, 50, i === 1))}
          <rect x="10" y="86" width="140" height="22" rx="4" fill="#fff" stroke={L} />
          {[0, 1, 2].map((i) => <rect key={i} x={15 + i * 16} y="91" width="12" height="12" rx="2" fill={i === 0 ? F : "#fff"} stroke={L} strokeDasharray={i === 0 ? "" : "2 2"} />)}
          <rect x="104" y="91" width="40" height="12" rx="3" fill={K} />
        </>
      );
      break;
    case "split":
      body = (
        <>
          <rect x="8" y="8" width="44" height="100" rx="4" fill="#fff" stroke={L} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx="16" cy={20 + i * 18} r="4" fill={i < 2 ? K : "#fff"} stroke={i < 2 ? K : L} />
              <rect x="24" y={18 + i * 18} width="22" height="4" rx="2" fill={i === 1 ? K : L} />
            </g>
          ))}
          <rect x="14" y="92" width="32" height="10" rx="3" fill={K} />
          {[0, 1, 2, 3].map((i) => prod(58 + (i % 2) * 48, 8 + Math.floor(i / 2) * 52, 44, 48, i === 0))}
        </>
      );
      break;
    case "focus":
      body = (
        <>
          <rect x="10" y="8" width="140" height="4" rx="2" fill={F} />
          <rect x="10" y="8" width="62" height="4" rx="2" fill={K} />
          <rect x="10" y="18" width="70" height="5" rx="2" fill={K} />
          {[0, 1].map((i) => prod(10 + i * 72, 30, 68, 62, i === 0))}
          <rect x="10" y="98" width="30" height="10" rx="3" fill="#fff" stroke={L} />
          <rect x="110" y="98" width="40" height="10" rx="3" fill={K} />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 160 116" role="img" aria-label={design}>
      <rect width="160" height="116" fill="#F5F3EE" />
      {body}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Live previews (sandboxed iframe running the storefront code)
// ─────────────────────────────────────────────────────────────

const frame = (css: string, js: string, mount: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
<style>html,body{margin:0;background:#EDEBE6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}#m{padding:14px}</style>
</head><body><div id="m"></div>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
<script>
(function(){
  var cur=null;
  function size(){ try{ var h=document.documentElement.scrollHeight; var ov=document.querySelector('.xpk-overlay:not([hidden])'); parent.postMessage({__rkH: ov?680:h},'*'); }catch(e){} }
  window.addEventListener('message',function(e){
    var d=e.data; if(!d||!d.__rk) return;
    var m=document.getElementById('m'); m.innerHTML=''; document.querySelectorAll('.xpk-overlay').forEach(function(o){o.remove()});
    document.documentElement.classList.remove('xpk-lock');
    var el=document.createElement('div'); m.appendChild(el);
    document.documentElement.dir=d.rtl?'rtl':'ltr';
    ${mount}
    setTimeout(size,60); setTimeout(size,450);
  });
  new MutationObserver(function(){ size(); }).observe(document.body,{subtree:true,childList:true,attributes:true});
  parent.postMessage({__rkReady:1},'*');
})();
</script></body></html>`;

const RECS_MOUNT = `cur=window.XPR.mount(el,d.rec,d.products,{preview:true,ratings:d.ratings||{},rtl:d.rtl,moneyFormat:d.moneyFormat,currency:d.currency,rate:1});`;
const KIT_MOUNT = `cur=window.XPK.mount(el,d.kit,{preview:true,products:d.products,rtl:d.rtl,moneyFormat:d.moneyFormat,currency:d.currency,rate:1});
    if(d.open && cur.open){ cur.open(); }`;

function FramePreview({ kind, payload, rtl, moneyFormat, currency, device, canOpen }: { kind: "recs" | "kit"; payload: any; rtl: boolean; moneyFormat: string; currency: string; device: "desktop" | "mobile"; canOpen?: boolean }) {
  const { t } = useTranslations();
  const ref = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(440);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(520);
  const [open, setOpen] = useState(false);
  const srcDoc = useMemo(() => (kind === "recs" ? frame(RECS_CSS, RECS_JS, RECS_MOUNT) : frame(KIT_CSS, KIT_JS, KIT_MOUNT)), [kind]);
  const msg = useMemo(() => JSON.stringify(payload), [payload]);

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
      if (e.data?.__rkReady) setReady(true);
      if (typeof e.data?.__rkH === "number") setHeight(Math.max(200, Math.min(2600, e.data.__rkH)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  useEffect(() => {
    if (!ready || !ref.current?.contentWindow) return;
    const id = setTimeout(() => {
      ref.current?.contentWindow?.postMessage({ __rk: 1, ...JSON.parse(msg), rtl, moneyFormat, currency, open: !!canOpen && open }, "*");
    }, 120);
    return () => clearTimeout(id);
  }, [ready, msg, rtl, moneyFormat, currency, open, canOpen]);

  const virtual = device === "desktop" ? (kind === "kit" && payload?.kit?.display === "page" ? 1000 : 780) : 390;
  const scale = Math.min(1, boxW / virtual);
  return (
    <>
      {canOpen ? (
        <div className="bb-seg sm" style={{ marginBottom: 8 }}>
          <button type="button" className={!open ? "on" : ""} onClick={() => setOpen(false)}>{t("Closed")}</button>
          <button type="button" className={open ? "on" : ""} onClick={() => setOpen(true)}>{t("Opened")}</button>
        </div>
      ) : null}
      <div ref={boxRef} style={{ width: "100%" }}>
        <div className="bb-stage" style={{ width: virtual * scale, height: height * scale }}>
          <iframe ref={ref} title={t("Live preview")} srcDoc={srcDoc} style={{ width: virtual, height, transform: `scale(${scale})`, transformOrigin: "0 0" }} sandbox="allow-scripts" />
        </div>
      </div>
    </>
  );
}

export function RecsPreview(p: { payload: { rec: any; products: any[]; ratings: any }; rtl: boolean; moneyFormat: string; currency: string; device: "desktop" | "mobile" }) {
  return <FramePreview kind="recs" {...p} />;
}
export function KitPreview(p: { payload: { kit: any; products: any }; rtl: boolean; moneyFormat: string; currency: string; device: "desktop" | "mobile" }) {
  const d = p.payload?.kit?.display;
  return <FramePreview kind="kit" {...p} canOpen={d === "drawer" || d === "modal"} />;
}
