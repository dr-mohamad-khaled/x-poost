import type { CSSProperties, ReactNode } from "react";

/**
 * Looping, CSS-only explainer animations (mini storefront + moving cursor)
 * for every XPoost feature. No video, no JS timers: pure @keyframes.
 *
 * Everything is sized in `em`; the stage's font-size is 2.5cqw so the whole
 * scene scales to whatever width its container has (dashboard card or banner).
 * Scene coordinate space: 40em x 25em.
 */

export type DemoId =
  | "scarcity"
  | "prePurchase"
  | "inCart"
  | "socialBar"
  | "shippingBar"
  | "productScarcity"
  | "thankYou"
  | "quantityBreaks";

export const DEMO_INFO: Record<DemoId, { title: string; steps: string[] }> = {
  prePurchase: {
    title: "Pre-Purchase Interceptor",
    steps: [
      "The shopper clicks Add to cart",
      "A popup shows products that go with it",
      "Ticked add-ons join the cart in one click",
    ],
  },
  inCart: {
    title: "In-Cart Offer",
    steps: [
      "The shopper adds a product",
      "The cart drawer opens",
      "Your offer appears right under the item that triggered it",
    ],
  },
  shippingBar: {
    title: "Free Shipping Bar",
    steps: [
      "The shopper adds more items",
      "The bar fills toward each reward tier",
      "Free shipping unlocks at your goal",
    ],
  },
  scarcity: {
    title: "Urgency Notifications",
    steps: [
      "Small toasts appear on the storefront",
      "Recent orders, live viewers and low stock build urgency",
      "Shoppers decide faster",
    ],
  },
  socialBar: {
    title: "Support & Social Bar",
    steps: [
      "A floating button stays on every page",
      "The shopper taps it to open your channels",
      "One tap to WhatsApp, Instagram or your VIP group",
    ],
  },
  productScarcity: {
    title: "Product Stock Scarcity",
    steps: [
      "A stock meter shows on the product page",
      "The bar drops as inventory goes down",
      "Low stock nudges the shopper to buy now",
    ],
  },
  thankYou: {
    title: "Thank-you Page Upsell",
    steps: [
      "The customer places an order",
      "An offer shows on the confirmation page",
      "One click adds it to the shipment",
    ],
  },
  quantityBreaks: {
    title: "Quantity Breaks",
    steps: [
      "The shopper sees volume tiers",
      "Picking a bigger tier saves more",
      "The price updates, then Add to cart",
    ],
  },
};

const PATH_TO_ID: Record<string, DemoId> = {
  "/app/scarcity": "scarcity",
  "/app/pre-purchase": "prePurchase",
  "/app/in-cart": "inCart",
  "/app/social-bar": "socialBar",
  "/app/shipping-bar": "shippingBar",
  "/app/product-scarcity": "productScarcity",
  "/app/thank-you": "thankYou",
  "/app/quantity-breaks": "quantityBreaks",
};

export function demoIdFromPath(pathname: string): DemoId | null {
  const clean = String(pathname || "").replace(/\/+$/, "");
  return PATH_TO_ID[clean] || null;
}

/* ------------------------------------------------------------------ */
/* Keyframe helpers                                                    */
/* ------------------------------------------------------------------ */

type Step = [number, string];

class Kf {
  private out: string[] = [];
  private n = 0;
  constructor(private p: string, private T: number) {}

  private add(steps: Step[]): string {
    const name = `xd-${this.p}-${this.n++}`;
    this.out.push(
      `@keyframes ${name}{${steps.map(([p, c]) => `${p}%{${c}}`).join("")}}`
    );
    return name;
  }
  private a(name: string, ease = "ease-in-out"): CSSProperties {
    return { animation: `${name} ${this.T}s ${ease} infinite` };
  }

  /** Raw keyframes. */
  track(steps: Step[], ease?: string): CSSProperties {
    return this.a(this.add(steps), ease);
  }

  /** Cursor path: [percent, x(em), y(em)] */
  cursor(pts: [number, number, number][]): CSSProperties {
    const style = this.track(pts.map(([p, x, y]) => [p, `left:${x}em;top:${y}em`] as Step));
    return { ...style, left: `${pts[0][1]}em`, top: `${pts[0][2]}em` };
  }

  /** Fade (and optionally move) in, hold, fade out. */
  win(
    inAt: number,
    inEnd: number,
    outAt: number,
    outEnd: number,
    from = "transform:none",
    to = "transform:none"
  ): CSSProperties {
    return this.track([
      [0, `opacity:0;${from}`],
      [inAt, `opacity:0;${from}`],
      [inEnd, `opacity:1;${to}`],
      [outAt, `opacity:1;${to}`],
      [outEnd, `opacity:0;${from}`],
      [100, `opacity:0;${from}`],
    ]);
  }

  /** Visible from the start until `outAt`, then hidden until the loop restarts. */
  until(outAt: number, outEnd: number): CSSProperties {
    return this.track([
      [0, "opacity:1"],
      [outAt, "opacity:1"],
      [outEnd, "opacity:0"],
      [96, "opacity:0"],
      [100, "opacity:1"],
    ]);
  }

  /** Button press feedback at `at`%. */
  press(at: number): CSSProperties {
    return this.track([
      [0, "transform:none;filter:none"],
      [at - 1, "transform:none;filter:none"],
      [at + 1, "transform:scale(.94);filter:brightness(.82)"],
      [at + 5, "transform:none;filter:none"],
      [100, "transform:none;filter:none"],
    ]);
  }

  /** Click ripple at `at`%. */
  rip(at: number): CSSProperties {
    return this.track(
      [
        [0, "opacity:0;transform:scale(.2)"],
        [at - 0.5, "opacity:0;transform:scale(.2)"],
        [at, "opacity:.95;transform:scale(.35)"],
        [at + 6, "opacity:0;transform:scale(1.35)"],
        [100, "opacity:0;transform:scale(1.35)"],
      ],
      "ease-out"
    );
  }

  css(): string {
    return this.out.join("");
  }
}

/* ------------------------------------------------------------------ */
/* Tiny layout helpers                                                 */
/* ------------------------------------------------------------------ */

const GOLD = "#D4AF37";
const DARK = "#131316";

type BProps = {
  l?: number;
  t?: number;
  w?: number;
  h?: number;
  r?: number;
  b?: number;
  s?: CSSProperties;
  children?: ReactNode;
};
/**
 * Positioned box. Positions/sizes are in "stage em". If the box sets its own
 * fontSize (leaf text), every em value on it is divided by that factor so it
 * still lands in stage-em space.
 */
const B = ({ l, t, w, h, r, b, s, children }: BProps) => {
  const fsm = typeof s?.fontSize === "string" ? /^([\d.]+)em$/.exec(s.fontSize) : null;
  const f = fsm ? parseFloat(fsm[1]) : 1;
  const em = (v?: number) => (v !== undefined ? `${+(v / f).toFixed(3)}em` : undefined);
  const scaled: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(s || {})) {
    scaled[key] =
      f !== 1 && key !== "fontSize" && typeof val === "string"
        ? val.replace(/(-?[\d.]+)em/g, (_m, n) => `${+(parseFloat(n) / f).toFixed(3)}em`)
        : val;
  }
  return (
    <div
      className="xd-a"
      style={{
        left: em(l),
        top: em(t),
        right: em(r),
        bottom: em(b),
        width: em(w),
        height: em(h),
        ...(scaled as CSSProperties),
      }}
    >
      {children}
    </div>
  );
};

const center: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const Cursor = ({ style }: { style: CSSProperties }) => (
  <svg className="xd-cur" viewBox="0 0 24 24" style={style} aria-hidden="true">
    <path
      d="M3 2l7.5 18 2.6-7.4L20.5 10z"
      fill="#111"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const Ripple = ({ x, y, style }: { x: number; y: number; style: CSSProperties }) => (
  <i className="xd-rip" style={{ left: `${x}em`, top: `${y}em`, ...style }} />
);

const Thumb = ({ l, t, size, tone = 0 }: { l: number; t: number; size: number; tone?: number }) => {
  const tones = [
    "linear-gradient(135deg,#f1dca6,#c79a3d)",
    "linear-gradient(135deg,#cfe3da,#6fa48c)",
    "linear-gradient(135deg,#e9cfd6,#c27a8c)",
  ];
  return (
    <B l={l} t={t} w={size} h={size} s={{ background: tones[tone % 3], borderRadius: ".5em" }}>
      <B
        l={size * 0.32}
        t={size * 0.16}
        w={size * 0.36}
        h={size * 0.68}
        s={{ background: "rgba(255,255,255,.55)", borderRadius: ".4em" }}
      />
    </B>
  );
};

/** Plain product page backdrop (nav + image + title lines). */
const PageBg = () => (
  <>
    <B l={0} t={0} w={40} h={2.8} s={{ background: "#fff", borderBottom: ".1em solid #e8e3d6" }} />
    <B l={1.5} t={1} w={6} h={0.9} s={{ background: "#d9d4c5", borderRadius: ".5em" }} />
    <B l={10} t={1.1} w={3} h={0.7} s={{ background: "#e3dfd2", borderRadius: ".4em" }} />
    <B l={14} t={1.1} w={3} h={0.7} s={{ background: "#e3dfd2", borderRadius: ".4em" }} />
    <B l={18} t={1.1} w={3} h={0.7} s={{ background: "#e3dfd2", borderRadius: ".4em" }} />
    <B l={35.6} t={0.8} w={2} h={1.4} s={{ background: "#d9d4c5", borderRadius: ".4em" }} />
    <B
      l={3}
      t={5}
      w={14}
      h={15.5}
      s={{ background: "linear-gradient(135deg,#efe3c4,#cfae6c)", borderRadius: ".9em" }}
    >
      <B l={4.6} t={3} w={4.8} h={10} s={{ background: "rgba(255,255,255,.6)", borderRadius: "1.2em" }} />
    </B>
    <B l={20} t={5.2} w={12} h={1.2} s={{ background: "#222", borderRadius: ".4em" }} />
    <B l={20} t={7.4} w={16} h={0.7} s={{ background: "#d6d1c3", borderRadius: ".4em" }} />
    <B l={20} t={8.9} w={11} h={0.7} s={{ background: "#d6d1c3", borderRadius: ".4em" }} />
  </>
);

const Price = ({ t = 10.6, text = "$49.00" }: { t?: number; text?: string }) => (
  <B l={20} t={t} s={{ fontSize: "2em", fontWeight: 800 }}>
    {text}
  </B>
);

const AtcBtn = ({ t = 16, style, label = "Add to cart" }: { t?: number; style?: CSSProperties; label?: ReactNode }) => (
  <B
    l={20}
    t={t}
    w={17}
    h={3.6}
    s={{
      background: "#1a1a1a",
      color: "#fff",
      borderRadius: ".6em",
      fontSize: "1.5em",
      fontWeight: 700,
      ...center,
      ...style,
    }}
  >
    {label}
  </B>
);

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

type Scene = { css: string; node: ReactNode };

function prePurchase(): Scene {
  const k = new Kf("pp", 9);
  const cur = k.cursor([
    [0, 37, 23.5],
    [16, 28.8, 18.2],
    [26, 28.8, 18.2],
    [40, 30.9, 9.8],
    [47, 30.9, 9.8],
    [53, 30.9, 14.8],
    [59, 30.9, 14.8],
    [67, 20, 19.3],
    [74, 20, 19.3],
    [88, 35, 23],
    [100, 37, 23.5],
  ]);
  const row = (top: number, name: string, price: string, tone: number, check: CSSProperties) => (
    <B l={1.5} t={top} w={25} h={4.4} s={{ background: "#1d1d22", border: ".1em solid #34343a", borderRadius: ".7em" }}>
      <Thumb l={0.5} t={0.5} size={3.2} tone={tone} />
      <B l={4.5} t={0.55} s={{ fontSize: "1.45em", fontWeight: 700, color: "#fff" }}>{name}</B>
      <B l={4.5} t={2.4} s={{ fontSize: "1.3em", fontWeight: 700, color: GOLD }}>{price}</B>
      <B l={22.6} t={1.4} w={1.6} h={1.6} s={{ border: `.15em solid ${GOLD}`, borderRadius: ".35em" }}>
        <B l={0} t={0} w={1.3} h={1.3} s={{ background: GOLD, color: "#111", fontSize: "1.1em", fontWeight: 900, ...center, borderRadius: ".15em", ...check }}>
          ✓
        </B>
      </B>
    </B>
  );
  const node = (
    <>
      <PageBg />
      <Price />
      <AtcBtn style={k.press(21)} />
      <B l={0} t={0} w={40} h={25} s={{ background: "rgba(0,0,0,.55)", ...k.win(24, 30, 80, 86) }} />
      <B l={6} t={3.5} w={28} h={18} s={{ background: DARK, border: `.12em solid ${GOLD}`, borderRadius: "1em", boxShadow: "0 1em 3em rgba(0,0,0,.5)", ...k.win(25, 31, 76, 81, "transform:scale(.88)", "transform:none") }}>
        <B l={1.5} t={1.3} s={{ fontSize: "1.7em", fontWeight: 800, color: GOLD }}>Add these before you go</B>
        {row(4.2, "Hydrating Serum", "$18.00", 1, k.win(43, 45, 96, 98))}
        {row(9.2, "Gel Cleanser", "$22.00", 2, k.win(56, 58, 96, 98))}
        <B l={1.5} t={14.4} w={25} h={3} s={{ background: GOLD, color: "#111", borderRadius: ".6em", fontSize: "1.5em", fontWeight: 800, ...center, ...k.press(70) }}>
          Add selected to cart
        </B>
      </B>
      <B l={11} t={20.6} w={18} h={2.8} s={{ background: DARK, color: "#fff", border: `.1em solid ${GOLD}`, borderRadius: "1.4em", fontSize: "1.4em", fontWeight: 700, ...center, ...k.win(76, 80, 90, 94, "transform:translateY(1em)", "transform:none") }}>
        <span style={{ color: GOLD, marginRight: ".4em" }}>✓</span> 2 items added
      </B>
      <Ripple x={28.8} y={18.2} style={k.rip(21)} />
      <Ripple x={30.9} y={9.8} style={k.rip(43)} />
      <Ripple x={30.9} y={14.8} style={k.rip(56)} />
      <Ripple x={20} y={19.3} style={k.rip(70)} />
      <Cursor style={cur} />
    </>
  );
  return { css: k.css(), node };
}

function inCart(): Scene {
  const k = new Kf("ic", 9);
  const cur = k.cursor([
    [0, 37, 23.5],
    [15, 28.8, 18.2],
    [24, 28.8, 18.2],
    [48, 35.2, 14.6],
    [58, 35.2, 14.6],
    [74, 34, 22],
    [100, 37, 23.5],
  ]);
  const item = (top: number, name: string, price: string, tone: number, style: CSSProperties) => (
    <B l={1.2} t={top} w={15.6} h={4.2} s={style}>
      <Thumb l={0} t={0} size={4.2} tone={tone} />
      <B l={5.2} t={0.3} s={{ fontSize: "1.3em", fontWeight: 700, color: "#222" }}>{name}</B>
      <B l={5.2} t={2.4} s={{ fontSize: "1.3em", color: "#555" }}>{price}</B>
    </B>
  );
  const node = (
    <>
      <PageBg />
      <Price />
      <AtcBtn style={k.press(19)} />
      <B l={0} t={0} w={40} h={25} s={{ background: "rgba(0,0,0,.45)", ...k.win(22, 29, 90, 95) }} />
      <B l={22} t={0} w={18} h={25} s={{ background: "#fff", boxShadow: "-.6em 0 2em rgba(0,0,0,.25)", ...k.win(22, 30, 90, 95, "transform:translateX(100%)", "transform:none") }}>
        <B l={1.2} t={1.2} s={{ fontSize: "1.7em", fontWeight: 800, color: "#111" }}>Your cart</B>
        <B l={1.2} t={3.4} w={15.6} h={0.1} s={{ background: "#eee" }} />
        {item(4.2, "Vitamin C", "$49.00", 0, {})}
        <B l={1.2} t={9} w={15.6} h={7.4} s={{ background: DARK, border: `.12em solid ${GOLD}`, borderRadius: ".8em", ...k.win(36, 42, 58, 62, "transform:translateY(-.8em)", "transform:none") }}>
          <B l={1} t={0.9} s={{ fontSize: "1.25em", fontWeight: 800, color: GOLD }}>Pairs well with this</B>
          <Thumb l={1} t={3} size={3.4} tone={2} />
          <B l={4.8} t={3} s={{ fontSize: "1.25em", fontWeight: 700, color: "#fff" }}>Gel Cleanser</B>
          <B l={4.8} t={4.9} s={{ fontSize: "1.15em", fontWeight: 700, color: GOLD }}>
            <span style={{ color: "#888", textDecoration: "line-through", marginRight: ".4em", fontWeight: 400 }}>$22</span>$18
          </B>
          <B l={10.8} t={4.6} w={4.2} h={2.2} s={{ background: GOLD, color: "#111", borderRadius: ".5em", fontSize: "1.3em", fontWeight: 800, ...center, ...k.press(56) }}>Add</B>
        </B>
        {item(9, "Gel Cleanser", "$18.00", 2, k.win(60, 66, 92, 96))}
        <B l={1.2} t={17.4} s={{ fontSize: "1.3em", color: "#666" }}>Subtotal</B>
        <B l={9.8} t={17.3} w={7} s={{ fontSize: "1.5em", fontWeight: 800, color: "#111", textAlign: "right", ...k.until(58, 62) }}>$49.00</B>
        <B l={9.8} t={17.3} w={7} s={{ fontSize: "1.5em", fontWeight: 800, color: "#111", textAlign: "right", opacity: 0, ...k.win(58, 62, 92, 96) }}>$67.00</B>
        <B l={1.2} t={20} w={15.6} h={3} s={{ background: "#111", color: "#fff", borderRadius: ".6em", fontSize: "1.4em", fontWeight: 700, ...center }}>Checkout</B>
      </B>
      <Ripple x={28.8} y={18.2} style={k.rip(19)} />
      <Ripple x={35.2} y={14.6} style={k.rip(56)} />
      <Cursor style={cur} />
    </>
  );
  return { css: k.css(), node };
}

function shippingBar(): Scene {
  const k = new Kf("sb", 9);
  const cur = k.cursor([
    [0, 36, 22],
    [14, 28.7, 14.4],
    [24, 28.7, 14.4],
    [46, 28.7, 14.4],
    [56, 28.7, 14.4],
    [80, 34, 21],
    [100, 36, 22],
  ]);
  const msg = (text: ReactNode, style: CSSProperties) => (
    <B l={9.5} t={6} w={21} s={{ fontSize: "1.25em", fontWeight: 700, color: "#222", ...style }}>{text}</B>
  );
  const dot = (x: number, style: CSSProperties) => (
    <B l={x} t={8.25} w={1.8} h={1.8} s={{ borderRadius: "50%", background: "#fff", border: ".18em solid #cfc9b6" }}>
      <B l={-0.18} t={-0.18} w={1.8} h={1.8} s={{ borderRadius: "50%", background: GOLD, border: `.18em solid ${GOLD}`, color: "#111", fontSize: "1.1em", fontWeight: 900, ...center, ...style }}>✓</B>
    </B>
  );
  const qty = (txt: string, style: CSSProperties) => (
    <B l={25} t={13.7} w={2.2} s={{ fontSize: "1.5em", fontWeight: 800, textAlign: "center", ...style }}>{txt}</B>
  );
  const node = (
    <>
      <PageBg />
      <B l={0} t={0} w={40} h={25} s={{ background: "rgba(0,0,0,.4)" }} />
      <B l={8} t={2} w={24} h={21} s={{ background: "#fff", borderRadius: "1em", boxShadow: "0 1em 3em rgba(0,0,0,.35)" }}>
        <B l={1.5} t={1.1} s={{ fontSize: "1.7em", fontWeight: 800, color: "#111" }}>Your cart</B>
      </B>
      {msg("Add $50 more for 10% off", k.until(26, 30))}
      {msg("Add $25 more for free shipping", { opacity: 0, ...k.track([[0, "opacity:0"], [27, "opacity:0"], [31, "opacity:1"], [52, "opacity:1"], [56, "opacity:0"], [100, "opacity:0"]]) })}
      {msg(<span style={{ color: "#1d7a3f" }}>Free shipping unlocked!</span>, { opacity: 0, ...k.win(57, 61, 90, 95) })}
      <B l={9.5} t={8.6} w={21} h={1.1} s={{ background: "#ece8db", borderRadius: ".6em", overflow: "hidden" }}>
        <B l={0} t={0} h={1.1} s={{ background: `linear-gradient(90deg,#b8962e,${GOLD})`, borderRadius: ".6em", ...k.track([[0, "width:8%"], [22, "width:8%"], [30, "width:50%"], [52, "width:50%"], [60, "width:100%"], [92, "width:100%"], [100, "width:8%"]]) }} />
      </B>
      {dot(19.6, k.track([[0, "opacity:0"], [29, "opacity:0"], [31, "opacity:1"], [94, "opacity:1"], [98, "opacity:0"], [100, "opacity:0"]]))}
      {dot(29.6, k.track([[0, "opacity:0"], [59, "opacity:0"], [61, "opacity:1"], [94, "opacity:1"], [98, "opacity:0"], [100, "opacity:0"]]))}
      <B l={16.5} t={10.5} s={{ fontSize: "1.1em", color: "#777" }}>10% off</B>
      <B l={26.5} t={10.5} s={{ fontSize: "1.1em", color: "#777" }}>Free ship</B>
      <B l={9.5} t={12.4} w={21} h={4.6} s={{ border: ".1em solid #eee", borderRadius: ".7em" }}>
        <Thumb l={0.4} t={0.4} size={3.8} tone={0} />
        <B l={5} t={0.5} s={{ fontSize: "1.4em", fontWeight: 700, color: "#222" }}>Face Serum</B>
        <B l={5} t={2.5} s={{ fontSize: "1.2em", color: "#666" }}>$25.00</B>
        <B l={14.6} t={1.1} w={1.9} h={1.9} s={{ border: ".1em solid #ccc", borderRadius: ".4em", fontSize: "1.4em", ...center }}>–</B>
        <B l={18.2} t={1.1} w={1.9} h={1.9} s={{ border: ".1em solid #ccc", borderRadius: ".4em", fontSize: "1.4em", ...center, ...k.press(20) }}>+</B>
      </B>
      {qty("1", { left: "25.75em", color: "#111", ...k.until(22, 24) })}
      {qty("2", { left: "25.75em", color: "#111", opacity: 0, ...k.track([[0, "opacity:0"], [22, "opacity:0"], [24, "opacity:1"], [52, "opacity:1"], [54, "opacity:0"], [100, "opacity:0"]]) })}
      {qty("3", { left: "25.75em", color: "#111", opacity: 0, ...k.win(54, 56, 94, 97) })}
      <B l={9.5} t={18.2} s={{ fontSize: "1.3em", color: "#666" }}>Total</B>
      {[
        ["$25.00", k.until(22, 24)],
        ["$50.00", k.track([[0, "opacity:0"], [22, "opacity:0"], [24, "opacity:1"], [52, "opacity:1"], [54, "opacity:0"], [100, "opacity:0"]])],
        ["$75.00", k.win(54, 56, 94, 97)],
      ].map(([txt, st]) => (
        <B key={txt as string} l={22} t={18.1} w={8.5} s={{ fontSize: "1.5em", fontWeight: 800, color: "#111", textAlign: "right", ...(st as CSSProperties) }}>
          {txt as string}
        </B>
      ))}
      <B l={9.5} t={20.3} w={21} h={2.2} s={{ background: "#111", color: "#fff", borderRadius: ".6em", fontSize: "1.3em", fontWeight: 700, ...center }}>Checkout</B>
      <Ripple x={28.7} y={14.4} style={k.rip(20)} />
      <Ripple x={28.7} y={14.4} style={k.rip(50)} />
      <Cursor style={cur} />
    </>
  );
  return { css: k.css(), node };
}

function scarcity(): Scene {
  const k = new Kf("sc", 9);
  const toast = (icon: string, line1: string, line2: string, style: CSSProperties) => (
    <B l={2} t={19.6} w={27} h={4.4} s={{ background: DARK, borderLeft: `.4em solid ${GOLD}`, borderRadius: ".8em", boxShadow: "0 .6em 2em rgba(0,0,0,.35)", ...style }}>
      <B l={1} t={0.9} w={2.6} h={2.6} s={{ borderRadius: "50%", background: "rgba(212,175,55,.18)", color: GOLD, fontSize: "1.4em", fontWeight: 900, ...center }}>{icon}</B>
      <B l={4.4} t={0.7} s={{ fontSize: "1.3em", fontWeight: 700, color: "#fff" }}>{line1}</B>
      <B l={4.4} t={2.5} s={{ fontSize: "1.1em", color: "#a1a1aa" }}>{line2}</B>
    </B>
  );
  const node = (
    <>
      <PageBg />
      <Price />
      <AtcBtn />
      {toast("★", "Someone in Cairo just ordered", "3 minutes ago", k.win(4, 10, 30, 35, "transform:translateY(1.2em)", "transform:none"))}
      {toast("●", "14 people are viewing this", "right now", k.win(38, 44, 62, 67, "transform:translateY(1.2em)", "transform:none"))}
      {toast("!", "Only 3 left in stock", "order soon", k.win(70, 76, 92, 97, "transform:translateY(1.2em)", "transform:none"))}
    </>
  );
  return { css: k.css(), node };
}

function socialBar(): Scene {
  const k = new Kf("so", 9);
  const cur = k.cursor([
    [0, 30, 14],
    [18, 35.6, 21.6],
    [26, 35.6, 21.6],
    [52, 28.3, 8.6],
    [64, 28.3, 8.6],
    [88, 20, 14],
    [100, 30, 14],
  ]);
  const row = (top: number, label: string, sub: string, color: string, hl?: CSSProperties) => (
    <B l={1} t={top} w={13.5} h={3.2} s={{ background: "#1d1d22", borderRadius: ".7em", border: ".1em solid #34343a" }}>
      {hl ? <B l={-0.1} t={-0.1} w={13.5} h={3.2} s={{ border: `.15em solid ${GOLD}`, borderRadius: ".7em", background: "rgba(212,175,55,.15)", ...hl }} /> : null}
      <B l={0.7} t={0.6} w={2} h={2} s={{ background: color, borderRadius: "50%" }} />
      <B l={3.3} t={0.35} s={{ fontSize: "1.3em", fontWeight: 700, color: "#fff" }}>{label}</B>
      <B l={3.3} t={1.85} s={{ fontSize: "1em", color: "#a1a1aa" }}>{sub}</B>
    </B>
  );
  const node = (
    <>
      <PageBg />
      <Price />
      <AtcBtn />
      <B l={20.5} t={3} w={15.5} h={16} s={{ background: DARK, border: `.12em solid ${GOLD}`, borderRadius: "1em", boxShadow: "0 1em 3em rgba(0,0,0,.4)", ...k.win(27, 33, 80, 86, "transform:translateY(1em) scale(.95)", "transform:none") }}>
        <B l={1} t={1.2} s={{ fontSize: "1.6em", fontWeight: 800, color: GOLD }}>Chat with us</B>
        {row(4.2, "WhatsApp", "Reply in minutes", "#25D366", k.track([[0, "opacity:0"], [56, "opacity:0"], [58, "opacity:1"], [68, "opacity:1"], [72, "opacity:0"], [100, "opacity:0"]]))}
        {row(7.9, "Instagram", "DM us anytime", "#d6249f")}
        {row(11.6, "VIP Group", "Early access & deals", GOLD)}
      </B>
      <B l={34} t={20} w={4} h={4} s={{ background: GOLD, borderRadius: "50%", boxShadow: "0 .4em 1.2em rgba(0,0,0,.35)", ...center, ...k.press(22) }}>
        <svg viewBox="0 0 24 24" style={{ width: "55%", height: "55%" }} aria-hidden="true">
          <path d="M4 4h16v11H9l-5 4z" fill="#111" />
        </svg>
      </B>
      <Ripple x={35.6} y={21.6} style={k.rip(22)} />
      <Ripple x={28.3} y={8.6} style={k.rip(58)} />
      <Cursor style={cur} />
    </>
  );
  return { css: k.css(), node };
}

function productScarcity(): Scene {
  const k = new Kf("ps", 9);
  const label = (txt: ReactNode, style: CSSProperties) => (
    <B l={20} t={13.1} w={17} s={{ fontSize: "1.4em", fontWeight: 800, ...style }}>{txt}</B>
  );
  const node = (
    <>
      <PageBg />
      <Price />
      {label("12 left in stock", { color: "#6b5a1c", ...k.until(30, 34) })}
      {label("Only 7 left", { color: "#b3501a", opacity: 0, ...k.track([[0, "opacity:0"], [32, "opacity:0"], [36, "opacity:1"], [58, "opacity:1"], [62, "opacity:0"], [100, "opacity:0"]]) })}
      {label("Only 4 left — hurry!", { color: "#c0392b", opacity: 0, ...k.win(60, 64, 92, 96) })}
      <B l={20} t={15.1} w={17} h={1.1} s={{ background: "#e6e1d2", borderRadius: ".6em", overflow: "hidden" }}>
        <B l={0} t={0} h={1.1} s={{ borderRadius: ".6em", ...k.track([[0, "width:80%;background:#D4AF37"], [30, "width:80%;background:#D4AF37"], [40, "width:46%;background:#e07b2a"], [58, "width:46%;background:#e07b2a"], [68, "width:24%;background:#c0392b"], [92, "width:24%;background:#c0392b"], [100, "width:80%;background:#D4AF37"]]) }} />
      </B>
      <AtcBtn t={17.4} style={k.track([[0, "transform:none"], [72, "transform:none"], [78, "transform:scale(1.04)"], [84, "transform:none"], [90, "transform:scale(1.04)"], [96, "transform:none"], [100, "transform:none"]])} />
      <B l={3.6} t={5.6} w={7.4} h={2.4} s={{ background: "#c0392b", color: "#fff", borderRadius: "1.2em", fontSize: "1.2em", fontWeight: 800, ...center, ...k.win(64, 68, 92, 96, "transform:scale(.6)", "transform:none") }}>Low stock</B>
    </>
  );
  return { css: k.css(), node };
}

function thankYou(): Scene {
  const k = new Kf("ty", 10);
  const cur = k.cursor([
    [0, 36, 23],
    [34, 36, 23],
    [52, 28.7, 18.3],
    [66, 28.7, 18.3],
    [88, 35, 23],
    [100, 36, 23],
  ]);
  const node = (
    <>
      <B l={0} t={0} w={40} h={25} s={{ background: "#fff" }} />
      <B l={0} t={0} w={40} h={2.8} s={{ background: "#f6f4ee", borderBottom: ".1em solid #e8e3d6" }} />
      <B l={1.5} t={1} w={6} h={0.9} s={{ background: "#d9d4c5", borderRadius: ".5em" }} />
      <B l={3} t={4.6} w={3.4} h={3.4} s={{ background: "#1d7a3f", color: "#fff", borderRadius: "50%", fontSize: "1.8em", fontWeight: 900, ...center }}>✓</B>
      <B l={7.4} t={4.5} s={{ fontSize: "1.25em", fontWeight: 800, color: "#111" }}>Order confirmed</B>
      <B l={7.4} t={6.6} s={{ fontSize: "1.1em", color: "#777" }}>Thank you!</B>
      {[10.5, 12.7, 14.9, 17.1].map((y, i) => (
        <B key={y} l={3} t={y} w={i === 3 ? 9 : 13} h={1} s={{ background: "#ece8db", borderRadius: ".5em" }} />
      ))}
      <B l={19.5} t={3.2} w={18.5} h={18.4} s={{ background: DARK, border: `.12em solid ${GOLD}`, borderRadius: "1em", boxShadow: "0 1em 2.5em rgba(0,0,0,.25)", ...k.win(12, 20, 94, 98, "transform:translateY(1.2em)", "transform:none") }}>
        <B l={1.3} t={1.3} s={{ fontSize: "1.3em", fontWeight: 800, color: GOLD }}>Add to your shipment</B>
        <B l={1.3} t={3.4} s={{ fontSize: "1.1em", color: "#a1a1aa" }}>Ships with your order</B>
        <B l={1.3} t={5.4} w={15.9} h={4.6} s={{ background: "#1d1d22", border: ".1em solid #34343a", borderRadius: ".7em" }}>
          <Thumb l={0.5} t={0.5} size={3.6} tone={2} />
          <B l={4.9} t={0.6} s={{ fontSize: "1.4em", fontWeight: 700, color: "#fff" }}>Gel Cleanser</B>
          <B l={4.9} t={2.5} s={{ fontSize: "1.3em", fontWeight: 700, color: GOLD }}>
            <span style={{ color: "#888", textDecoration: "line-through", marginRight: ".4em", fontWeight: 400 }}>$22</span>$14
          </B>
        </B>
        <B l={1.3} t={10.9} w={15.9} h={2.2} s={{ background: "rgba(192,57,43,.18)", color: "#ff8a7a", borderRadius: "1.1em", fontSize: "1.2em", fontWeight: 700, ...center }}>
          Offer ends in 09:42
        </B>
        <B l={1.3} t={13.9} w={15.9} h={3} s={{ background: GOLD, color: "#111", borderRadius: ".6em", fontSize: "1.4em", fontWeight: 800, ...center, ...k.track([[0, "opacity:1;transform:none"], [58, "opacity:1;transform:none"], [60, "opacity:1;transform:scale(.94);filter:brightness(.82)"], [64, "opacity:0;transform:none"], [95, "opacity:0"], [100, "opacity:1;transform:none"]]) }}>
          Add to shipment
        </B>
        <B l={1.3} t={13.9} w={15.9} h={3} s={{ background: "#1d7a3f", color: "#fff", borderRadius: ".6em", fontSize: "1.25em", fontWeight: 800, ...center, opacity: 0, ...k.win(63, 67, 94, 98) }}>
          ✓ Added to shipment
        </B>
      </B>
      <Ripple x={28.7} y={18.3} style={k.rip(58)} />
      <Cursor style={cur} />
    </>
  );
  return { css: k.css(), node };
}

function quantityBreaks(): Scene {
  const k = new Kf("qb", 9);
  const cur = k.cursor([
    [0, 36, 23],
    [14, 28.5, 12.9],
    [30, 28.5, 12.9],
    [46, 28.5, 16.1],
    [60, 28.5, 16.1],
    [74, 28.5, 22.9],
    [86, 28.5, 22.9],
    [100, 36, 23],
  ]);
  const node = QtyBreaksScene({ k, cur });
  return { css: k.css(), node };
}

function QtyBreaksScene({ k, cur }: { k: Kf; cur: CSSProperties }) {
  const tier = (top: number, a: string, b: string, price: string, sel: CSSProperties, badge?: string) => (
    <B l={20} t={top} w={17.5} h={2.9} s={{ background: "#fff", border: ".12em solid #ddd7c6", borderRadius: ".8em" }}>
      <B l={-0.12} t={-0.12} w={17.5} h={2.9} s={{ background: "rgba(212,175,55,.16)", border: `.18em solid ${GOLD}`, borderRadius: ".8em", ...sel }} />
      <B l={1.2} t={0.6} s={{ fontSize: "1.45em", fontWeight: 800, color: "#111" }}>{a}</B>
      <B l={6.8} t={0.85} s={{ fontSize: "1.15em", fontWeight: 700, color: "#8a6d0b" }}>{b}</B>
      <B l={12} t={0.6} w={4.6} s={{ fontSize: "1.5em", fontWeight: 800, color: "#111", textAlign: "right" }}>{price}</B>
      {badge ? (
        <B r={5.2} t={-0.9} w={5.4} h={1.6} s={{ background: GOLD, color: "#111", borderRadius: ".9em", fontSize: "1em", fontWeight: 800, ...center }}>{badge}</B>
      ) : null}
    </B>
  );
  const btn = (txt: string, style: CSSProperties) => (
    <B l={20} t={21.5} w={17.5} h={2.9} s={{ background: "#1a1a1a", color: "#fff", borderRadius: ".6em", fontSize: "1.4em", fontWeight: 700, ...center, ...style }}>{txt}</B>
  );
  return (
    <>
      <PageBg />
      <B l={20} t={9.5} s={{ fontSize: "1.2em", fontWeight: 700, color: "#555" }}>Choose your bundle</B>
      {tier(11.4, "Buy 1", "", "$20", k.until(27, 29))}
      {tier(14.7, "Buy 2", "Save 10%", "$36", k.track([[0, "opacity:0"], [27, "opacity:0"], [29, "opacity:1"], [56, "opacity:1"], [58, "opacity:0"], [100, "opacity:0"]]), "Popular")}
      {tier(18.0, "Buy 3", "Save 20%", "$48", k.win(58, 60, 94, 97))}
      {btn("Add to cart · $20", k.until(27, 29))}
      {btn("Add to cart · $36", k.track([[0, "opacity:0"], [27, "opacity:0"], [29, "opacity:1"], [56, "opacity:1"], [58, "opacity:0"], [100, "opacity:0"]]))}
      {btn("Add to cart · $48", { ...k.track([[0, "opacity:0;transform:none;filter:none"], [58, "opacity:0"], [60, "opacity:1"], [77, "opacity:1;transform:none;filter:none"], [79, "opacity:1;transform:scale(.94);filter:brightness(.82)"], [84, "opacity:1;transform:none;filter:none"], [94, "opacity:1"], [97, "opacity:0"], [100, "opacity:0"]]) })}
      <Ripple x={28.5} y={12.9} style={k.rip(27)} />
      <Ripple x={28.5} y={16.1} style={k.rip(57)} />
      <Ripple x={28.5} y={22.9} style={k.rip(79)} />
      <Cursor style={cur} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

const BASE_CSS = `
.xd{container-type:inline-size;width:100%}
.xd-stage{position:relative;font-size:2.5cqw;width:40em;height:25em;overflow:hidden;border-radius:.9em;background:#f4f1ea;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;user-select:none;pointer-events:none;line-height:1.2;box-shadow:0 0 0 1px rgba(212,175,55,.35)}
.xd-stage *{box-sizing:border-box}
.xd-a{position:absolute;white-space:nowrap}
.xd-cur{position:absolute;width:2.6em;height:2.6em;margin:-.22em 0 0 -.33em;z-index:60;filter:drop-shadow(0 .15em .25em rgba(0,0,0,.45))}
.xd-rip{position:absolute;width:3.4em;height:3.4em;margin:-1.7em 0 0 -1.7em;border-radius:50%;border:.25em solid rgba(212,175,55,.95);background:rgba(212,175,55,.28);opacity:0;z-index:55}
.xd-sm{margin:0 0 14px}
@media (prefers-reduced-motion: reduce){.xd-stage *{animation:none!important}.xd-cur,.xd-rip{display:none}}
`;

const BANNER_CSS = `
.xd-banner{background:#141414;border:1px solid #282828;border-radius:12px;margin:16px 12px 0;overflow:hidden}
.xd-banner>summary{cursor:pointer;list-style:none;padding:12px 16px;font-size:14px;font-weight:800;color:#D4AF37;display:flex;align-items:center;gap:8px}
.xd-banner>summary::-webkit-details-marker{display:none}
.xd-banner>summary::before{content:"▸";transition:transform .15s}
.xd-banner[open]>summary::before{transform:rotate(90deg)}
.xd-banner>summary small{margin-left:auto;font-weight:500;color:#71717a;font-size:12px}
.xd-banner-body{display:flex;flex-wrap:wrap;gap:20px;align-items:center;padding:0 16px 16px}
.xd-banner-stage{flex:1 1 320px;max-width:560px;min-width:0}
.xd-steps{flex:1 1 220px;margin:0;padding:0;list-style:none;counter-reset:xd}
.xd-steps li{counter-increment:xd;display:flex;gap:10px;align-items:flex-start;color:#d4d4d8;font-size:14px;line-height:1.45;padding:7px 0}
.xd-steps li::before{content:counter(xd);flex:none;width:24px;height:24px;border-radius:50%;background:rgba(212,175,55,.15);border:1px solid #D4AF37;color:#D4AF37;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center}
`;

let cache: Partial<Record<DemoId, Scene>> = {};
function scene(id: DemoId): Scene {
  if (cache[id]) return cache[id]!;
  const builders: Record<DemoId, () => Scene> = {
    prePurchase,
    inCart,
    shippingBar,
    scarcity,
    socialBar,
    productScarcity,
    thankYou,
    quantityBreaks,
  };
  const s = builders[id]();
  cache[id] = s;
  return s;
}

export function FeatureDemo({ id, size = "sm" }: { id: DemoId; size?: "sm" | "lg" }) {
  if (!DEMO_INFO[id]) return null;
  const s = scene(id);
  return (
    <div className={`xd ${size === "sm" ? "xd-sm" : ""}`} role="img" aria-label={`${DEMO_INFO[id].title} animated demo`}>
      <style>{BASE_CSS + s.css}</style>
      <div className="xd-stage">{s.node}</div>
    </div>
  );
}

export function FeatureDemoBanner({ id }: { id: DemoId | null }) {
  if (!id || !DEMO_INFO[id]) return null;
  const info = DEMO_INFO[id];
  return (
    <details className="xd-banner" open>
      <style>{BANNER_CSS}</style>
      <summary>
        How {info.title} works
        <small>click to show / hide</small>
      </summary>
      <div className="xd-banner-body">
        <div className="xd-banner-stage">
          <FeatureDemo id={id} size="lg" />
        </div>
        <ol className="xd-steps">
          {info.steps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>
    </details>
  );
}
