import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

/**
 * XPoost — Thank-you page upsell (Checkout UI extension, purchase.thank-you.block.render)
 *
 * The extension is intentionally thin: the XPoost backend chooses the offer (conditions, priority), creates the
 * unique, expiring codes and returns ready-to-render text in the customer's language. This file only draws it.
 * Colors, fonts and corners come from the store's checkout branding, so every design matches the store.
 */

// Change this if the app is hosted somewhere else.
const APP_URL = "https://sea-turtle-app-a4uct.ondigitalocean.app";

export default async () => {
  render(<Extension />, document.body);
};

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────

async function call(body) {
  const token = await shopify.sessionToken.get();
  const res = await fetch(`${APP_URL}/api/thank-you`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`XPoost ${res.status}`);
  return res.json();
}

// `shopify.extension.editable` is a plain boolean in the checkout API (not a signal), so don't rely on `.value`.
function isEditor() {
  const e = shopify.extension?.editable;
  return typeof e === "boolean" ? e : Boolean(e?.value);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readContext() {
  const conf = shopify.orderConfirmation?.value;
  const addr = shopify.shippingAddress?.value;
  return {
    orderId: conf?.order?.id,
    isFirstOrder: typeof conf?.isFirstOrder === "boolean" ? conf.isFirstOrder : undefined,
    firstName: addr?.firstName,
    country: addr?.countryCode,
    locale: shopify.localization?.language?.value?.isoCode || "en",
  };
}

async function load() {
  const ctx = readContext();
  const editing = isEditor();
  if (editing || !ctx.orderId) {
    // Checkout editor (or no real order): show a sample so the merchant can see the placement
    return call({ intent: "sample", locale: ctx.locale });
  }
  // The order can take a moment to become visible to the API after payment
  for (let attempt = 0; attempt < 6; attempt++) {
    const payload = await call({ intent: "resolve", ...ctx });
    if (!payload.retry) return payload;
    await sleep(2500);
  }
  return { show: false };
}

function track(p, event, dim = "") {
  if (!p?.offerId || p.sample) return;
  call({ intent: "event", offerId: p.offerId, event, dim }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

function Extension() {
  const [payload, setPayload] = useState(null);
  const [problem, setProblem] = useState("");
  const cd = useCountdown(payload);
  const inEditor = isEditor();

  useEffect(() => {
    let alive = true;
    load()
      .then((p) => {
        if (!alive) return;
        if (p?.show) setPayload(p);
        else if (inEditor) setProblem(p?.error ? `The server answered: ${p.error}` : "No offer to preview. Create and switch on an offer in XPoost, and turn the feature on.");
      })
      .catch((e) => {
        // Never break the real thank-you page; only tell the merchant while they are in the checkout editor.
        console.error("[XPoost]", e);
        if (alive && inEditor) setProblem(`Could not reach XPoost (${e?.message || e}).`);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (payload) track(payload, "view");
  }, [payload?.offerId]);

  if (!payload) {
    // Only visible to the merchant inside the checkout editor
    return problem ? <s-banner tone="warning" heading="XPoost preview">{problem}</s-banner> : null;
  }

  // {time_left} is live: fill it into every text each second
  const texts = Object.fromEntries(Object.entries(payload.texts || {}).map(([k, v]) => [k, withTime(v, cd.text)]));
  const Design = DESIGNS[payload.design] || Minimal;
  return <Design p={{ ...payload, texts }} cd={cd} />;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Live countdown to the code's real expiry. The server clock keeps it honest when the customer's clock is off. */
function useCountdown(p) {
  const active = Boolean(p) && p.kind !== "reward" && p.showTimer !== false && Boolean(p.expiresAt);
  const target = p?.expiresAt ? Date.parse(p.expiresAt) : 0;
  const offset = useMemo(() => (p?.serverNow ? Date.parse(p.serverNow) - Date.now() : 0), [p?.serverNow]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  const left = Math.max(0, target - (now + offset));
  return { active, left, text: formatCountdown(left), ended: active && left <= 0 };
}

const withTime = (str, time) => String(str || "").replace(/\{time_left\}/g, time);

function offerBadge(p) {
  return p.benefit === "free_shipping" ? p.texts.freeShippingBadge : p.texts.savingsBadge;
}

// ─────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────

function Eyebrow({ p, tone = "success" }) {
  return p.texts.eyebrow ? <s-badge tone={tone}>{p.texts.eyebrow}</s-badge> : null;
}

function Footnote({ p }) {
  return p.texts.footnote ? (
    <s-text color="subdued" type="small">
      {p.texts.footnote}
    </s-text>
  ) : null;
}

function SampleTag({ p }) {
  return p.sample ? (
    <s-badge tone="warning">Preview</s-badge>
  ) : null;
}

function Expired({ p }) {
  return <s-banner tone="info">{p.texts.timerExpired}</s-banner>;
}

function Timer({ p, cd }) {
  if (!cd.active) return null;
  return (
    <s-box background="subdued" borderRadius="large" padding="base">
      <s-stack direction="inline" alignItems="center" justifyContent="space-between" gap="base">
        <s-text color="subdued">{p.texts.timerLabel}</s-text>
        <s-heading>{cd.text}</s-heading>
      </s-stack>
    </s-box>
  );
}

function Thumb({ src, alt, size }) {
  if (!src) return <s-box background="subdued" borderRadius="base" minInlineSize={size} minBlockSize={size} />;
  return <s-image src={src} alt={alt} aspectRatio="1" objectFit="cover" borderRadius="base" inlineSize="fill" />;
}

function ProductRow({ p, item }) {
  return (
    <s-stack gap="small">
      <s-grid gridTemplateColumns="64px 1fr" gap="base" alignItems="center">
        <Thumb src={item.imageUrl} alt={item.title} size="64px" />
        <s-stack gap="small-200">
          <s-text type="strong">{item.title}</s-text>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            {item.priceText ? <s-text color="subdued">{item.priceText}</s-text> : null}
            <s-badge tone="success">{offerBadge(p)}</s-badge>
          </s-stack>
        </s-stack>
      </s-grid>
      <s-button variant="secondary" inlineSize="fill" href={item.link} target="_blank" onClick={() => track(p, "click", `p:${item.vid}`)}>
        {p.texts.productCta}
      </s-button>
    </s-stack>
  );
}

// ─────────────────────────────────────────────────────────────
// Design 1 — Gift Reveal (next-order reward)
// ─────────────────────────────────────────────────────────────

function GiftReveal({ p }) {
  const [open, setOpen] = useState(false);
  const t = p.texts;
  const r = p.rewards?.[0];
  if (!r) return null;
  const reveal = () => {
    setOpen(true);
    track(p, "action", "reveal");
  };
  return (
    <s-box padding="large" border="base" borderRadius="large" background="subdued">
      <s-stack gap="base" alignItems="center">
        <s-stack direction="inline" gap="small" alignItems="center">
          <Eyebrow p={p} />
          <SampleTag p={p} />
        </s-stack>
        <s-heading>{t.headline}</s-heading>
        <s-text color="subdued">{t.subheadline}</s-text>

        {!open ? (
          <s-clickable
            onClick={reveal}
            accessibilityLabel={t.revealLabel}
            border="base"
            borderRadius="large"
            padding="large"
            background="base"
            inlineSize="fill"
          >
            <s-stack alignItems="center" gap="small-200">
              <s-heading>🎁</s-heading>
              <s-text type="strong">{t.revealLabel}</s-text>
              <s-text color="subdued" type="small">
                {t.benefitLine}
              </s-text>
            </s-stack>
          </s-clickable>
        ) : (
          <s-stack gap="base" alignItems="center" inlineSize="fill">
            <s-box background="base" border="base" borderRadius="large" padding="large" inlineSize="fill">
              <s-stack alignItems="center" gap="small-200">
                <s-text color="subdued" type="small">
                  {t.codeLabel}
                </s-text>
                <s-heading>{r.code}</s-heading>
                <s-badge tone="info">{r.discountText}</s-badge>
                {r.minSpendLine ? (
                  <s-text color="subdued" type="small">
                    {r.minSpendLine}
                  </s-text>
                ) : null}
                <s-text color="subdued" type="small">
                  {t.validUntil}
                </s-text>
              </s-stack>
            </s-box>
            <s-button variant="primary" inlineSize="fill" href={r.applyLink} target="_blank" onClick={() => track(p, "click", "apply")}>
              {t.shopCta}
            </s-button>
            <s-text color="subdued" type="small">
              {t.applyNote}
            </s-text>
          </s-stack>
        )}
        <Footnote p={p} />
      </s-stack>
    </s-box>
  );
}

// ─────────────────────────────────────────────────────────────
// Design 2 — VIP Ladder (up to 3 reward steps)
// ─────────────────────────────────────────────────────────────

function VipLadder({ p }) {
  const t = p.texts;
  const rewards = p.rewards || [];
  if (!rewards.length) return null;
  return (
    <s-box padding="large" border="base" borderRadius="large" background="base">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <Eyebrow p={p} tone="info" />
          <SampleTag p={p} />
        </s-stack>
        <s-heading>{t.headline}</s-heading>
        <s-text color="subdued">{t.subheadline}</s-text>
        <s-stack gap="small">
          {rewards.map((r, i) => (
            <s-box key={r.code} background={i === rewards.length - 1 ? "subdued" : "base"} border="base" borderRadius="large" padding="base">
              <s-stack gap="small">
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-badge tone={i === rewards.length - 1 ? "success" : "info"}>{String(i + 1)}</s-badge>
                  <s-text type="strong">{r.label}</s-text>
                </s-stack>
                <s-text color="subdued" type="small">
                  {t.codeLabel}: {r.code}
                </s-text>
                <s-button variant={i === 0 ? "primary" : "secondary"} inlineSize="fill" href={r.applyLink} target="_blank" onClick={() => track(p, "click", `tier${i + 1}`)}>
                  {t.shopCta}
                </s-button>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
        <s-text color="subdued" type="small">
          {t.validUntil}. {t.applyNote}
        </s-text>
        <Footnote p={p} />
      </s-stack>
    </s-box>
  );
}

// ─────────────────────────────────────────────────────────────
// Design 3 — Ship-Together Timer
// ─────────────────────────────────────────────────────────────

function ShipTimer({ p, cd }) {
  const t = p.texts;
  const items = p.products || [];
  if (!items.length) return null;
  const over = p.expired || cd.ended;
  return (
    <s-box padding="large" border="base" borderRadius="large" background="base">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <Eyebrow p={p} />
          <SampleTag p={p} />
        </s-stack>
        <s-heading>{t.headline}</s-heading>
        <s-text color="subdued">{t.subheadline}</s-text>
        {over ? (
          <Expired p={p} />
        ) : (
          <s-stack gap="base">
            <Timer p={p} cd={cd} />
            <s-text type="strong">{t.benefitLine}</s-text>
            <s-divider />
            {items.map((item) => (
              <ProductRow key={item.variantId} p={p} item={item} />
            ))}
            {items.length > 1 ? (
              <s-button variant="primary" inlineSize="fill" href={p.addLink} target="_blank" onClick={() => track(p, "click", "all")}>
                {t.bundleCta}
              </s-button>
            ) : null}
          </s-stack>
        )}
        <Footnote p={p} />
      </s-stack>
    </s-box>
  );
}

// ─────────────────────────────────────────────────────────────
// Design 4 — Complete the Routine (selectable grid)
// ─────────────────────────────────────────────────────────────

function Routine({ p, cd }) {
  const t = p.texts;
  const items = p.products || [];
  const [selected, setSelected] = useState(() => new Set(items.map((i) => i.vid)));
  if (!items.length) return null;
  const over = p.expired || cd.ended;

  const toggle = (vid) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(vid)) next.delete(vid);
      else next.add(vid);
      return next;
    });

  const chosen = items.filter((i) => selected.has(i.vid));
  const link = (p.linkTemplate || "").replace("__ITEMS__", chosen.map((i) => `${i.vid}:1`).join(","));
  const columns = items.length === 2 ? "1fr 1fr" : items.length === 3 ? "1fr 1fr 1fr" : "@container (inline-size > 520px) 1fr 1fr 1fr 1fr, 1fr 1fr";

  return (
    <s-box padding="large" border="base" borderRadius="large" background="base">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <Eyebrow p={p} tone="info" />
          <SampleTag p={p} />
        </s-stack>
        <s-heading>{t.headline}</s-heading>
        <s-text color="subdued">{t.subheadline}</s-text>
        {over ? (
          <Expired p={p} />
        ) : (
          <s-stack gap="base">
            <Timer p={p} cd={cd} />
            <s-grid gridTemplateColumns={columns} gap="small">
              {items.map((item) => (
                <s-box key={item.variantId} border="base" borderRadius="large" padding="small" background={selected.has(item.vid) ? "base" : "subdued"}>
                  <s-stack gap="small-200">
                    <Thumb src={item.imageUrl} alt={item.title} size="96px" />
                    <s-text type="strong">{item.title}</s-text>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      {item.priceText ? <s-text color="subdued">{item.priceText}</s-text> : null}
                      <s-badge tone="success">{offerBadge(p)}</s-badge>
                    </s-stack>
                    <s-checkbox label={t.productCta} checked={selected.has(item.vid)} onChange={() => toggle(item.vid)} />
                  </s-stack>
                </s-box>
              ))}
            </s-grid>
            <s-text type="strong">{t.benefitLine}</s-text>
            <s-button
              variant="primary"
              inlineSize="fill"
              href={link}
              target="_blank"
              disabled={chosen.length === 0}
              onClick={() => track(p, "click", `sel${chosen.length}`)}
            >
              {t.bundleCta}
            </s-button>
          </s-stack>
        )}
        <Footnote p={p} />
      </s-stack>
    </s-box>
  );
}

// ─────────────────────────────────────────────────────────────
// Design 5 — Spotlight (one hero product)
// ─────────────────────────────────────────────────────────────

function Spotlight({ p, cd }) {
  const t = p.texts;
  const item = p.products?.[0];
  if (!item) return null;
  const over = p.expired || cd.ended;
  return (
    <s-box padding="large" border="base" borderRadius="large" background="base">
      <s-stack gap="base">
        {over ? (
          <Expired p={p} />
        ) : (
          <s-grid gridTemplateColumns="@container (inline-size > 480px) 1fr 1fr, 1fr" gap="large" alignItems="center">
            <Thumb src={item.imageUrl} alt={item.title} size="200px" />
            <s-stack gap="base">
              <s-stack direction="inline" gap="small" alignItems="center">
                <Eyebrow p={p} />
                <SampleTag p={p} />
              </s-stack>
              <s-heading>{t.headline}</s-heading>
              <s-text color="subdued">{t.subheadline}</s-text>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text type="strong">{item.title}</s-text>
                {item.priceText ? <s-text color="subdued">{item.priceText}</s-text> : null}
              </s-stack>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-badge tone="success">{offerBadge(p)}</s-badge>
                <s-text>{t.benefitLine}</s-text>
              </s-stack>
              <Timer p={p} cd={cd} />
              <s-button variant="primary" inlineSize="fill" href={item.link} target="_blank" onClick={() => track(p, "click", `p:${item.vid}`)}>
                {t.productCta}
              </s-button>
            </s-stack>
          </s-grid>
        )}
        <Footnote p={p} />
      </s-stack>
    </s-box>
  );
}

// ─────────────────────────────────────────────────────────────
// Design 6 — Minimal
// ─────────────────────────────────────────────────────────────

function Minimal({ p, cd }) {
  const t = p.texts;
  const isReward = p.kind === "reward";
  const r = p.rewards?.[0];
  const href = isReward ? r?.applyLink : p.addLink || p.products?.[0]?.link;
  const label = isReward ? t.shopCta : p.products && p.products.length > 1 ? t.bundleCta : t.productCta;
  if (!href) return null;
  if (!isReward && (p.expired || cd.ended)) {
    return <Expired p={p} />;
  }
  const sub = isReward ? `${t.codeLabel}: ${r.code} · ${r.discountText}` : cd.active ? `${t.timerLabel} ${cd.text}` : t.benefitLine;
  return (
    <s-box border="base" borderRadius="large" padding="base" background="subdued">
      <s-stack gap="base">
        <s-stack gap="small-200">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-text type="strong">{t.headline}</s-text>
            <SampleTag p={p} />
          </s-stack>
          <s-text color="subdued">{sub}</s-text>
        </s-stack>
        <s-button variant="primary" inlineSize="fill" href={href} target="_blank" onClick={() => track(p, "click", "cta")}>
          {label}
        </s-button>
      </s-stack>
    </s-box>
  );
}

const DESIGNS = {
  gift_reveal: GiftReveal,
  vip_ladder: VipLadder,
  ship_timer: ShipTimer,
  routine: Routine,
  spotlight: Spotlight,
  minimal: Minimal,
};
