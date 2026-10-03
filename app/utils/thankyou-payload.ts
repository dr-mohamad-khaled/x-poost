/**
 * Thank-you page upsell — building the render payload (pure, shared by the server, the admin preview and tests).
 */
import {
  type TyConfig,
  type TyKind,
  type TyLang,
  type TyProduct,
  type TyRenderPayload,
  TY_LANG_META,
  buildAddLink,
  describeTier,
  discountPhrase,
  fillTemplate,
  formatMoney,
  gidTail,
  resolveTexts,
  DEFAULT_CONFIG,
} from "./thankyou";
import type { TyOfferLike } from "./thankyou";

export type IssuedCode = {
  code: string;
  type: "reward" | "addon_percent" | "addon_shipping";
  tierIndex: number;
  minSpend: number;
  discountText: string; // localized later; here the raw value, e.g. "15%" or "5.00"
  valueType: "percent" | "fixed" | "ship";
  value: number;
  giftCard?: boolean;
};

const STORE_LOCALE: Record<TyLang, string> = { en: "en", ar: "ar", fr: "fr", de: "de", es: "es", it: "it", pt: "pt" };

function formatDate(d: Date, lang: TyLang): string {
  try {
    return new Intl.DateTimeFormat(STORE_LOCALE[lang], { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function buildPayload(opts: {
  offer: TyOfferLike;
  codes: IssuedCode[];
  expiresAt: Date;
  lang: TyLang;
  shop: { name: string; currency: string; url: string; domain: string };
  firstName?: string;
  orderNumber?: string | null;
  orderId?: string | null;
  products: TyProduct[];
  showPrices: boolean;
  sample?: boolean;
  now?: Date;
}): TyRenderPayload {
  const { offer, codes, lang, shop } = opts;
  const now = opts.now || new Date();
  const loc = STORE_LOCALE[lang];
  const texts = resolveTexts(offer.kind, offer.texts, lang);
  const isReward = offer.kind === "reward";
  const a = offer.config.addon;
  const r = offer.config.reward;

  // The discount phrase used in {discount}
  let discountText = "";
  let rewards: TyRenderPayload["rewards"];
  if (isReward) {
    const sorted = [...codes].sort((x, y) => x.tierIndex - y.tierIndex);
    const best = sorted[sorted.length - 1]; // the ladder's top step
    const valText = (c: IssuedCode) => describeTier({ valueType: c.valueType === "percent" ? "percent" : "fixed", value: c.value, minSpend: c.minSpend }, shop.currency, loc);
    discountText = best ? discountPhrase(lang, "value", valText(best)) : "";
    rewards = sorted.map((c) => {
      const dt = discountPhrase(lang, "value", valText(c));
      const minText = c.minSpend > 0 ? formatMoney(c.minSpend, shop.currency, loc) : "";
      return {
        code: c.code,
        applyLink: `${shop.url}/discount/${encodeURIComponent(c.code)}`,
        discountText: dt,
        minSpend: c.minSpend,
        minSpendText: minText,
        minSpendLine: minText ? fillTemplate(texts.minSpendNote, { min_spend: minText }) : "",
        label: minText ? fillTemplate(texts.tierLabel, { discount: dt, min_spend: minText }) : fillTemplate(dt, {}),
      };
    });
  } else {
    discountText = a.benefit === "free_shipping" ? discountPhrase(lang, "ship") : discountPhrase(lang, "value", `${trimPct(a.percent)}%`);
  }

  const first = codes[0];
  const minSpendFirst = isReward && r.tiers[0]?.minSpend ? formatMoney(r.tiers[0].minSpend, shop.currency, loc) : "";
  const vars = {
    first_name: (opts.firstName || "").trim(),
    order_number: opts.orderNumber || "",
    code: first?.code || "",
    discount: discountText,
    minutes: String(a.windowMinutes),
    min_spend: minSpendFirst,
    expires: formatDate(opts.expiresAt, lang),
    shop: shop.name,
  };
  const filled = Object.fromEntries(
    Object.entries(texts).map(([k, v]) => [k, fillTemplate(String(v), vars, ["time_left"])]),
  ) as unknown as typeof texts;

  const expired = !isReward && opts.expiresAt.getTime() <= now.getTime();
  const addCode = !isReward ? first?.code || null : null;
  const products = !isReward
    ? opts.products.slice(0, 4).map((p) => ({
        variantId: p.variantId,
        vid: gidTail(p.variantId),
        title: p.title,
        imageUrl: p.imageUrl,
        priceText: opts.showPrices && Number(p.price) > 0 ? formatMoney(Number(p.price), shop.currency, loc) : "",
        priceValue: Number(p.price) || 0,
        link: buildAddLink({
          shopDomain: new URL(shop.url).host,
          variantIds: [p.variantId],
          code: addCode,
          orderNumber: opts.orderNumber,
          orderId: opts.orderId,
          offerId: offer.id,
          shipTogether: offer.kind === "shiptogether",
        }),
      }))
    : undefined;

  return {
    show: true,
    offerId: offer.id,
    kind: offer.kind,
    design: offer.design,
    lang,
    dir: TY_LANG_META[lang].dir,
    texts: filled,
    currency: shop.currency,
    rewards,
    expiresAt: opts.expiresAt.toISOString(),
    expired,
    products,
    addLink:
      !isReward && opts.products.length
        ? buildAddLink({
            shopDomain: new URL(shop.url).host,
            variantIds: opts.products.slice(0, 4).map((p) => p.variantId),
            code: addCode,
            orderNumber: opts.orderNumber,
            orderId: opts.orderId,
            offerId: offer.id,
          shipTogether: offer.kind === "shiptogether",
          })
        : undefined,
    serverNow: now.toISOString(),
    linkTemplate: !isReward
      ? buildAddLink({
          shopDomain: new URL(shop.url).host,
          variantIds: [],
          code: addCode,
          orderNumber: opts.orderNumber,
          orderId: opts.orderId,
          offerId: offer.id,
          shipTogether: offer.kind === "shiptogether",
        })
      : undefined,
    totalText:
      !isReward && opts.showPrices
        ? formatMoney(opts.products.slice(0, 4).reduce((acc, p) => acc + (Number(p.price) || 0), 0), shop.currency, loc)
        : undefined,
    benefit: a.benefit,
    discountText,
    showTimer: offer.kind === "shiptogether" ? true : a.showTimer,
    shopUrl: shop.url,
    sample: opts.sample || undefined,
  };
}

const trimPct = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(1));

export function buildSample(
  offer: TyOfferLike,
  shop: { name: string; currency: string; url: string; domain: string },
  lang: TyLang,
  products: TyProduct[],
): TyRenderPayload {
  const now = new Date();
  const r = offer.config.reward;
  const a = offer.config.addon;
  const codes: IssuedCode[] =
    offer.kind === "reward"
      ? (offer.design === "vip_ladder" ? r.tiers : r.tiers.slice(0, 1)).map((t, i) => ({
          code: `${r.codePrefix}-7K4Q-9XMD`.replace(/-9XMD$/, i ? `-${["2AFN", "8RWT", "5HZP"][i % 3]}` : "-9XMD"),
          type: "reward" as const,
          tierIndex: i,
          minSpend: t.minSpend,
          discountText: String(t.value),
          valueType: t.valueType,
          value: t.value,
        }))
      : [
          a.benefit === "free_shipping"
            ? { code: "SHIP-7K4Q-9XMD", type: "addon_shipping" as const, tierIndex: 0, minSpend: 0, discountText: "", valueType: "ship" as const, value: 0 }
            : { code: "ADD-7K4Q-9XMD", type: "addon_percent" as const, tierIndex: 0, minSpend: 0, discountText: String(a.percent), valueType: "percent" as const, value: a.percent },
        ];
  const minutes = offer.kind === "reward" ? r.expiryDays * 1440 : a.windowMinutes;
  const demo: TyProduct[] = products.length
    ? products
    : [
        { productId: "gid://shopify/Product/1", variantId: "gid://shopify/ProductVariant/1", title: "Hydrating Face Serum", imageUrl: "", price: "29", handle: "" },
        { productId: "gid://shopify/Product/2", variantId: "gid://shopify/ProductVariant/2", title: "Gentle Daily Cleanser", imageUrl: "", price: "18", handle: "" },
        { productId: "gid://shopify/Product/3", variantId: "gid://shopify/ProductVariant/3", title: "Barrier Repair Cream", imageUrl: "", price: "24", handle: "" },
      ];
  return buildPayload({
    offer,
    codes,
    expiresAt: new Date(now.getTime() + minutes * 60_000),
    lang,
    shop,
    firstName: "Alex",
    orderNumber: "#1042",
    orderId: "gid://shopify/Order/1042",
    products: demo,
    showPrices: true,
    sample: true,
    now,
  });
}
