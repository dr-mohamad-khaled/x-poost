import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";
import { Translate } from "./Translate";

/* ─────────────────────────────────────────────────────────────
   Dashboard hero: fixed line + rotating headline with its own
   illustration. Flat shapes, brand palette only, CSS animations
   that restart whenever a slide becomes active.
   ───────────────────────────────────────────────────────────── */

const SLIDE_MS = 6500;

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 280 230" width="100%" height="100%" role="presentation" focusable="false">
      <rect x="10" y="10" width="260" height="210" rx="16" fill="#161512" stroke="#2A2A2A" />
      {children}
    </svg>
  );
}

const cssVar = (i: number) => ({ ["--i" as any]: i }) as React.CSSProperties;

/* 1. Visitors -> customers: analytics line chart */
function ArtGrowth() {
  const line = "M32 168 C 62 164 76 142 100 147 S 138 124 162 108 S 212 82 242 56";
  return (
    <Frame>
      <rect x="30" y="30" width="64" height="7" rx="3.5" fill="#3A3A3A" />
      <rect x="30" y="43" width="40" height="5" rx="2.5" fill="#2A2A2A" />
      <rect x="194" y="28" width="58" height="22" rx="11" fill="rgba(255,176,0,0.14)" />
      <path d="M210 41l5-6 4 4 7-8" fill="none" stroke="#FFB000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="232" y="36" width="12" height="5" rx="2.5" fill="#FFB000" />
      {[86, 118, 150, 182].map((y) => (
        <line key={y} x1="30" x2="252" y1={y} y2={y} stroke="#262626" />
      ))}
      <path d="M32 174 C 82 172 140 166 252 154" fill="none" stroke="#5A5A5A" strokeWidth="2" strokeDasharray="4 5" />
      <path className="a-fade" d={`${line} L242 186 L32 186 Z`} fill="rgba(255,176,0,0.15)" />
      <path className="a-draw" d={line} fill="none" stroke="#FFB000" strokeWidth="3.5" strokeLinecap="round" />
      <circle className="a-ring" cx="242" cy="56" r="7" fill="none" stroke="#FFB000" strokeWidth="2" />
      <circle className="a-pop" cx="242" cy="56" r="5.5" fill="#FFB000" stroke="#161512" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={36 + i * 36} y="196" width="12" height="4" rx="2" fill="#2F2F2F" />
      ))}
    </Frame>
  );
}

/* 2. Orders -> bigger orders: stacked bars (order + add-on) */
function ArtOrders() {
  const base = [34, 40, 46, 54, 60, 66];
  const add = [0, 0, 10, 18, 30, 44];
  return (
    <Frame>
      <circle cx="36" cy="38" r="4.5" fill="#FFB000" />
      <rect x="46" y="35" width="34" height="6" rx="3" fill="#3A3A3A" />
      <circle cx="100" cy="38" r="4.5" fill="#FF7700" />
      <rect x="110" y="35" width="34" height="6" rx="3" fill="#3A3A3A" />
      <line x1="28" x2="254" y1="192" y2="192" stroke="#333333" />
      {base.map((b, i) => {
        const x = 34 + i * 36;
        return (
          <g key={i} className="a-bar" style={cssVar(i)}>
            <rect x={x} y={192 - b} width="24" height={b} rx="4" fill="#FFB000" />
            {add[i] > 0 && <rect x={x} y={192 - b - add[i]} width="24" height={add[i]} rx="4" fill="#FF7700" />}
          </g>
        );
      })}
      <g className="a-pop" style={cssVar(6)}>
        <circle cx="226" cy="64" r="10" fill="#FFD985" stroke="#161512" strokeWidth="2" />
        <path d="M221 64h10M226 59v10" stroke="#060605" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </Frame>
  );
}

/* 3. Engage shoppers, raise AOV: gauge + shopper rows */
function ArtEngage() {
  const rows = [
    { y: 78, c: "#FFD985" },
    { y: 116, c: "#FF7700" },
    { y: 154, c: "#FFB000" },
  ];
  return (
    <Frame>
      <g transform="rotate(-90 92 118)">
        <circle cx="92" cy="118" r="46" fill="none" stroke="#2A2A2A" strokeWidth="12" />
        <circle className="a-arc" cx="92" cy="118" r="46" fill="none" stroke="#FFB000" strokeWidth="12" strokeLinecap="round" strokeDasharray="289" strokeDashoffset="80" />
      </g>
      <path d="M92 128V106M82 115l10-10 10 10" fill="none" stroke="#FFD985" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="76" y="136" width="32" height="6" rx="3" fill="#3A3A3A" />
      {rows.map((r, i) => (
        <g key={i} className="a-row" style={cssVar(i)}>
          <circle cx="166" cy={r.y} r="10" fill={r.c} />
          <rect x="184" y={r.y - 8} width="42" height="6" rx="3" fill="#3A3A3A" />
          <rect x="184" y={r.y + 3} width="26" height="5" rx="2.5" fill="#2A2A2A" />
          <g className="a-pop" style={cssVar(i + 3)}>
            <rect x="232" y={r.y - 10} width="26" height="20" rx="10" fill="rgba(255,119,0,0.2)" />
            <path d={`M239 ${r.y}h12M245 ${r.y - 6}v12`} stroke="#FF7700" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        </g>
      ))}
    </Frame>
  );
}

/* 4. Upsell when and where it matters: product -> cart drawer offer */
function ArtUpsell() {
  return (
    <Frame>
      <rect x="28" y="46" width="94" height="134" rx="10" fill="#1C1B18" stroke="#2A2A2A" />
      <rect x="36" y="54" width="78" height="58" rx="6" fill="#262420" />
      <circle cx="58" cy="75" r="7" fill="#3A3A3A" />
      <path d="M44 106l18-18 12 12 10-8 20 14z" fill="#333030" />
      <rect x="36" y="122" width="58" height="6" rx="3" fill="#3A3A3A" />
      <rect x="36" y="134" width="38" height="6" rx="3" fill="#2A2A2A" />
      <rect x="36" y="152" width="78" height="18" rx="9" fill="#3A3A3A" />
      <rect x="56" y="159" width="38" height="4" rx="2" fill="#8A8A8A" />
      <path className="a-flow" d="M118 161 C 134 161 132 128 148 128" fill="none" stroke="#FFB000" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
      <g className="a-drawer">
        <rect x="146" y="26" width="116" height="178" rx="10" fill="#0F0E0C" stroke="#3A3A3A" />
        <rect x="156" y="36" width="44" height="6" rx="3" fill="#3A3A3A" />
        <rect x="156" y="52" width="22" height="22" rx="5" fill="#262420" />
        <rect x="184" y="56" width="50" height="6" rx="3" fill="#3A3A3A" />
        <rect x="184" y="67" width="30" height="5" rx="2.5" fill="#2A2A2A" />
        <rect x="154" y="86" width="100" height="64" rx="9" fill="rgba(255,176,0,0.10)" stroke="#FFB000" strokeWidth="1.6" />
        <rect x="162" y="95" width="24" height="24" rx="6" fill="#FFB000" />
        <rect x="192" y="98" width="50" height="6" rx="3" fill="#FFD985" />
        <rect x="192" y="109" width="28" height="5" rx="2.5" fill="#6B5A2A" />
        <g className="a-btnpulse">
          <rect x="162" y="126" width="84" height="16" rx="8" fill="#FFB000" />
          <path d="M196 134h10M201 129v10" stroke="#060605" strokeWidth="2" strokeLinecap="round" />
          <rect x="212" y="132" width="22" height="4" rx="2" fill="#060605" />
        </g>
        <rect x="154" y="176" width="100" height="18" rx="9" fill="#3A3A3A" />
      </g>
    </Frame>
  );
}

function Gear({ cx, cy, r, tooth, n, fill, hub, cls }: { cx: number; cy: number; r: number; tooth: number; n: number; fill: string; hub: number; cls: string }) {
  return (
    <g className={cls}>
      {Array.from({ length: n }).map((_, i) => (
        <rect
          key={i}
          x={cx - tooth / 2}
          y={cy - r - tooth * 0.9}
          width={tooth}
          height={tooth * 1.2}
          rx="1.5"
          fill={fill}
          transform={`rotate(${(360 / n) * i} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <circle cx={cx} cy={cy} r={hub} fill="#161512" stroke="#060605" strokeWidth="2" />
    </g>
  );
}

/* 5. Ultimate selling machine: gears + conveyor + coins -> cart */
function ArtMachine() {
  return (
    <Frame>
      <defs>
        <clipPath id="xpa-belt-clip">
          <rect x="28" y="120" width="172" height="60" />
        </clipPath>
      </defs>
      <Gear cx={84} cy={84} r={26} tooth={9} n={10} fill="#FFB000" hub={9} cls="a-spin" />
      <Gear cx={140} cy={60} r={15} tooth={7} n={8} fill="#FF7700" hub={5} cls="a-spin-r" />
      <g className="a-float">
        <circle cx="218" cy="70" r="24" fill="#FFD985" stroke="#161512" strokeWidth="2" />
        <circle cx="218" cy="70" r="18" fill="none" stroke="#060605" strokeWidth="2" opacity="0.55" />
        <path d="M218 58v24M224 63c-2-3-12-4-12 2 0 6 12 3 12 9 0 6-10 5-13 1" fill="none" stroke="#060605" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <rect x="28" y="164" width="224" height="12" rx="6" fill="#262420" />
      <line className="a-belt" x1="38" x2="242" y1="170" y2="170" stroke="#4A4A4A" strokeWidth="2" strokeDasharray="6 8" />
      <circle cx="34" cy="170" r="9" fill="#161512" stroke="#3A3A3A" strokeWidth="2" />
      <circle cx="246" cy="170" r="9" fill="#161512" stroke="#3A3A3A" strokeWidth="2" />
      <g clipPath="url(#xpa-belt-clip)">
        <g className="a-coins">
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <circle cx={30 + k * 50} cy="152" r="10" fill="#FFB000" stroke="#161512" strokeWidth="2" />
              <circle cx={30 + k * 50} cy="152" r="5.5" fill="none" stroke="#060605" strokeWidth="1.6" opacity="0.5" />
            </g>
          ))}
        </g>
      </g>
      <g transform="translate(206 112) scale(2.1)" fill="none" stroke="#FFD985" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </g>
      <path className="a-twinkle" d="M42 130l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4z" fill="#FFD985" />
    </Frame>
  );
}

type Slide = {
  key: string;
  title: string;
  text: string;
  cta: string;
  route: string;
  Art: () => ReactElement;
};

const SLIDES: Slide[] = [
  {
    key: "visitors",
    title: "Turn visitors into customers",
    text: "Urgency, social proof and one-tap WhatsApp support remove the last doubt, right where shoppers hesitate.",
    cta: "Add urgency &rarr;",
    route: "/app/scarcity",
    Art: ArtGrowth,
  },
  {
    key: "orders",
    title: "Turn orders into bigger orders",
    text: "A bundle offer after Add to Cart, a smart add-on in the cart drawer, a reward on the thank-you page. Every step adds a little more.",
    cta: "Build an upsell &rarr;",
    route: "/app/pre-purchase",
    Art: ArtOrders,
  },
  {
    key: "engage",
    title: "Engage shoppers and increase average order value",
    text: "A free-shipping goal and volume tiers give shoppers a reason to add one more item, and something to aim for.",
    cta: "Set a shipping goal &rarr;",
    route: "/app/shipping-bar",
    Art: ArtEngage,
  },
  {
    key: "upsell",
    title: "Upsell when it matters, where it matters",
    text: "Show the right offer at the right moment: after Add to Cart, inside the cart drawer, and right after checkout.",
    cta: "Choose your moments &rarr;",
    route: "/app/in-cart",
    Art: ArtUpsell,
  },
  {
    key: "machine",
    title: "Turn your site into the ultimate selling machine",
    text: "Upsells, urgency, volume pricing, shipping goals and live analytics, working together on every page of your store.",
    cta: "See all features &rarr;",
    route: "#xp-features",
    Art: ArtMachine,
  },
];

export function HeroBanner({ onBrowse }: { onBrowse: (e: { preventDefault: () => void }) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const count = SLIDES.length;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, reduced, count]);

  const autoplay = !paused && !reduced;

  return (
    <div
      className="xp-banner"
      role="region"
      aria-roledescription="carousel"
      aria-label="XPoost highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <style>{HERO_STYLES}</style>
      <div className="xp-banner-content">
        <div className="xp-hero-tag">
          <Translate text="One app to replace them all" />
        </div>
        <div className="xp-bstage" aria-live={autoplay ? "off" : "polite"}>
          {SLIDES.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.key}
                className={`xp-bslide ${active ? "is-active" : ""}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${count}`}
                aria-hidden={!active}
              >
                <div className="xp-hero-title" role="heading" aria-level={1}>
                  <Translate text={s.title} />
                </div>
                <p className="xp-hero-subtitle">
                  <Translate text={s.text} />
                </p>
                <div className="xp-banner-cta">
                  {s.route.startsWith("#") ? (
                    <a href={s.route} className="xp-btn xp-btn--primary" onClick={onBrowse} tabIndex={active ? 0 : -1}>
                      <Translate text={s.cta} />
                    </a>
                  ) : (
                    <Link to={s.route} className="xp-btn xp-btn--primary" tabIndex={active ? 0 : -1}>
                      <Translate text={s.cta} />
                    </Link>
                  )}
                  <Link to="/app/analytics" className="xp-btn xp-btn--ghost" tabIndex={active ? 0 : -1}>
                    <Translate text="See your results &rarr;" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <div className="xp-bfoot">
          <div className="xp-bdots" role="tablist" aria-label="Choose highlight">
            {SLIDES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.title}
                className={`xp-bdot ${i === index ? "is-active" : ""}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <span className="xp-bcount">
            {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
        </div>
      </div>
      <div className="xp-banner-art" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <div key={s.key} className={`xp-bart ${i === index ? "is-active" : ""}`}>
            <s.Art />
          </div>
        ))}
      </div>
      <div className="xp-bprog" aria-hidden="true">
        <span
          key={`${index}-${autoplay}`}
          className="xp-bprog-fill"
          style={{
            animationDuration: `${SLIDE_MS}ms`,
            animationPlayState: autoplay ? "running" : "paused",
            animationName: reduced ? "none" : undefined,
            transform: reduced ? "scaleX(1)" : undefined,
          }}
        />
      </div>
    </div>
  );
}

const HERO_STYLES = `
  .xp-banner {
    position: relative;
    overflow: hidden;
    background: #0F0E0C;
    border: 1px solid #2A2A2A;
    border-radius: 14px;
    padding: 34px 36px 38px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    align-items: center;
    gap: 28px;
  }
  .xp-banner-content { min-width: 0; }
  .xp-hero-tag {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #FFB000;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.2px;
    margin-bottom: 14px;
  }
  .xp-hero-tag::before {
    content: "";
    width: 22px;
    height: 2px;
    border-radius: 2px;
    background: #FFB000;
  }
  .xp-bstage { display: grid; }
  .xp-bslide {
    grid-area: 1 / 1;
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px);
    transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s linear 0.5s;
  }
  .xp-bslide.is-active {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    transition: opacity 0.5s ease 0.12s, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) 0.12s, visibility 0s;
  }
  .xp-hero-title {
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 36px;
    line-height: 1.14;
    font-weight: 600;
    margin: 0 0 14px;
    letter-spacing: -0.5px;
    color: #FFFFFF;
    max-width: 580px;
  }
  .xp-hero-subtitle {
    font-size: 15px;
    color: #B2B2B2;
    margin: 0 0 24px;
    line-height: 1.6;
    max-width: 540px;
  }
  .xp-banner-cta { display: flex; flex-wrap: wrap; gap: 10px; }
  .xp-bfoot {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 26px;
  }
  .xp-bdots { display: flex; gap: 6px; }
  .xp-bdot {
    width: 8px;
    height: 8px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: #3A3A3A;
    cursor: pointer;
    transition: width 0.3s ease, background 0.3s ease;
  }
  .xp-bdot:hover { background: #5A5A5A; }
  .xp-bdot.is-active { width: 26px; background: #FFB000; }
  .xp-bdot:focus-visible { outline: 2px solid #FFB000; outline-offset: 2px; }
  .xp-bcount { font-size: 11px; color: #6A6A6A; font-variant-numeric: tabular-nums; }
  .xp-bprog {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.05);
  }
  .xp-bprog-fill {
    display: block;
    height: 100%;
    background: #FFB000;
    transform-origin: left center;
    animation-name: xp-bprog;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }
  [dir="rtl"] .xp-bprog-fill { transform-origin: right center; }
  @keyframes xp-bprog { from { transform: scaleX(0); } to { transform: scaleX(1); } }

  /* Illustrations */
  .xp-banner-art {
    display: grid;
    width: 300px;
    height: 246px;
    justify-self: center;
  }
  .xp-bart {
    grid-area: 1 / 1;
    opacity: 0;
    transform: scale(0.94) translateY(8px);
    transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .xp-bart.is-active { opacity: 1; transform: none; transition-delay: 0.12s; }
  .xp-bart svg { overflow: visible; }
  .xp-bart [class^="a-"] { transform-box: fill-box; transform-origin: center; }

  .xp-bart.is-active .a-draw { stroke-dasharray: 420; animation: xpa-draw 1.5s 0.3s cubic-bezier(0.3, 0.6, 0.3, 1) both; }
  .xp-bart.is-active .a-fade { animation: xpa-fade 0.9s 0.9s ease both; }
  .xp-bart.is-active .a-pop { animation: xpa-pop 0.5s calc(0.6s + var(--i, 0) * 0.12s) cubic-bezier(0.3, 1.5, 0.5, 1) both; }
  .xp-bart.is-active .a-ring { animation: xpa-ring 2s 1.6s ease-out infinite; }
  .xp-bart.is-active .a-bar { transform-origin: 50% 100%; animation: xpa-grow 0.7s calc(0.25s + var(--i, 0) * 0.09s) cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .xp-bart.is-active .a-arc { animation: xpa-arc 1.4s 0.3s cubic-bezier(0.3, 0.6, 0.3, 1) both; }
  .xp-bart.is-active .a-row { animation: xpa-row 0.55s calc(0.3s + var(--i, 0) * 0.14s) cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .xp-bart.is-active .a-drawer { animation: xpa-drawer 0.7s 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .xp-bart.is-active .a-flow { animation: xpa-flow 1.2s linear infinite; }
  .xp-bart.is-active .a-btnpulse { animation: xpa-btn 1.6s 1s ease-in-out infinite; }
  .xp-bart.is-active .a-spin { animation: xpa-spin 12s linear infinite; }
  .xp-bart.is-active .a-spin-r { animation: xpa-spin 8.5s linear infinite reverse; }
  .xp-bart.is-active .a-float { animation: xpa-float 3s ease-in-out infinite; }
  .xp-bart.is-active .a-belt { animation: xpa-belt 0.9s linear infinite; }
  .xp-bart.is-active .a-coins { transform-box: view-box; animation: xpa-coins 2.4s linear infinite; }
  .xp-bart.is-active .a-twinkle { animation: xpa-twinkle 2.2s ease-in-out infinite; }

  @keyframes xpa-draw { from { stroke-dashoffset: 420; } to { stroke-dashoffset: 0; } }
  @keyframes xpa-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes xpa-pop { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
  @keyframes xpa-ring { 0% { opacity: 0.8; transform: scale(1); } 100% { opacity: 0; transform: scale(2.6); } }
  @keyframes xpa-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes xpa-arc { from { stroke-dashoffset: 289; } to { stroke-dashoffset: 80; } }
  @keyframes xpa-row { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes xpa-drawer { from { opacity: 0; transform: translateX(34px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes xpa-flow { to { stroke-dashoffset: -16; } }
  @keyframes xpa-btn { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes xpa-spin { to { transform: rotate(360deg); } }
  @keyframes xpa-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes xpa-belt { to { stroke-dashoffset: -14; } }
  @keyframes xpa-coins { from { transform: translateX(0); } to { transform: translateX(50px); } }
  @keyframes xpa-twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.1); } }

  @media (max-width: 900px) {
    .xp-banner { grid-template-columns: 1fr; padding: 24px 20px 30px; }
    .xp-banner-art { display: none; }
    .xp-hero-title { font-size: 26px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .xp-bslide, .xp-bart { transition: none; }
    .xp-bart [class^="a-"] { animation: none !important; }
  }
`;
