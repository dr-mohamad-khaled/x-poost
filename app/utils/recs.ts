/**
 * Product Recommendations — shared types, defaults and sanitizers.
 * Used by the admin editor, the storefront payload (app proxy) and the checkout discount sync.
 */
import { BB_LANGS, BB_SAN, type BbCollection, type BbLang, type BbProduct } from "./bundles";

const { str, int, dec, color, gid, oneOf, uniqBy } = BB_SAN;

export const RC_SOURCES = ["related", "complementary", "manual", "collection"] as const;
export type RcSource = (typeof RC_SOURCES)[number];

export const RC_DESIGNS = ["cards", "compact", "checklist", "mini", "carousel", "inline"] as const;
export type RcDesign = (typeof RC_DESIGNS)[number];

export const RC_OFFER_MODES = ["none", "percent", "amount"] as const;
export type RcOfferMode = (typeof RC_OFFER_MODES)[number];

export const RC_PLACEMENTS = ["all", "products", "collections", "exclude"] as const;
export type RcPlacementMode = (typeof RC_PLACEMENTS)[number];

export type RcConfig = {
  source: RcSource;
  products: BbProduct[];
  collection: BbCollection | null;
  count: number;
  shuffle: boolean;
  hideInCart: boolean;
  hideSoldOut: boolean;
  showRating: boolean;
  showCompare: boolean;
  showVariants: boolean;
  showQty: boolean;
  design: RcDesign;
  offer: { mode: RcOfferMode; value: number };
  afterAdd: "drawer" | "stay" | "cart";
  placement: { mode: RcPlacementMode; products: { id: string; label: string }[]; collections: { id: string; label: string }[]; device: "all" | "mobile" | "desktop" };
};

export type RcStyle = {
  accent: string;
  bg: string;
  text: string;
  muted: string;
  border: string;
  btnBg: string;
  btnText: string;
  badgeBg: string;
  badgeText: string;
  star: string;
  radius: number;
  imageRatio: "square" | "portrait" | "natural";
  font: "theme" | "system";
  customCss: string;
};

export const RC_TEXT_KEYS = ["title", "subtitle", "add", "added", "adding", "addSelected", "total", "save", "soldOut", "offerLabel", "offerHint", "errorMsg", "prev", "next"] as const;
export type RcTextKey = (typeof RC_TEXT_KEYS)[number];
export type RcTexts = Partial<Record<RcTextKey, string>>;
export type RcTextsByLang = Partial<Record<BbLang, RcTexts>>;

export const RC_MAIN_TEXTS: RcTextKey[] = ["title", "subtitle", "add", "addSelected", "offerLabel"];

export const RC_TEXT_META: Record<RcTextKey, { label: string; vars?: string }> = {
  title: { label: "Heading" },
  subtitle: { label: "Subheading (optional)" },
  add: { label: "Add button" },
  added: { label: "Added label" },
  adding: { label: "Adding… label" },
  addSelected: { label: "Bought together: add button", vars: "{count}" },
  total: { label: "Total label" },
  save: { label: "Offer badge", vars: "{value}" },
  soldOut: { label: "Sold out" },
  offerLabel: { label: "Discount name at checkout" },
  offerHint: { label: "Offer note" },
  errorMsg: { label: "Error message" },
  prev: { label: "Previous (screen readers)" },
  next: { label: "Next (screen readers)" },
};

const T: Record<BbLang, Required<RcTexts>> = {
  en: {
    title: "You may also like these products",
    subtitle: "",
    add: "Add",
    added: "Added",
    adding: "Adding…",
    addSelected: "Add {count} to cart",
    total: "Total",
    save: "Save {value}",
    soldOut: "Sold out",
    offerLabel: "Special offer",
    offerHint: "Offer price when you buy it with this product",
    errorMsg: "Couldn't add it. Please try again.",
    prev: "Previous",
    next: "Next",
  },
  ar: {
    title: "قد تعجبك هذه المنتجات أيضًا",
    subtitle: "",
    add: "أضف",
    added: "تمت الإضافة",
    adding: "جارٍ الإضافة…",
    addSelected: "أضف {count} إلى السلة",
    total: "الإجمالي",
    save: "وفّر {value}",
    soldOut: "نفدت الكمية",
    offerLabel: "عرض خاص",
    offerHint: "سعر العرض عند شرائه مع هذا المنتج",
    errorMsg: "تعذّرت الإضافة. حاول مرة أخرى.",
    prev: "السابق",
    next: "التالي",
  },
  fr: {
    title: "Vous aimerez aussi ces produits",
    subtitle: "",
    add: "Ajouter",
    added: "Ajouté",
    adding: "Ajout…",
    addSelected: "Ajouter {count} au panier",
    total: "Total",
    save: "Économisez {value}",
    soldOut: "Épuisé",
    offerLabel: "Offre spéciale",
    offerHint: "Prix de l'offre si vous l'achetez avec ce produit",
    errorMsg: "Impossible d'ajouter. Veuillez réessayer.",
    prev: "Précédent",
    next: "Suivant",
  },
  de: {
    title: "Das könnte Ihnen auch gefallen",
    subtitle: "",
    add: "Hinzufügen",
    added: "Hinzugefügt",
    adding: "Wird hinzugefügt…",
    addSelected: "{count} in den Warenkorb",
    total: "Gesamt",
    save: "Spare {value}",
    soldOut: "Ausverkauft",
    offerLabel: "Sonderangebot",
    offerHint: "Angebotspreis beim Kauf zusammen mit diesem Produkt",
    errorMsg: "Konnte nicht hinzugefügt werden. Bitte erneut versuchen.",
    prev: "Zurück",
    next: "Weiter",
  },
  es: {
    title: "También te pueden gustar estos productos",
    subtitle: "",
    add: "Añadir",
    added: "Añadido",
    adding: "Añadiendo…",
    addSelected: "Añadir {count} al carrito",
    total: "Total",
    save: "Ahorra {value}",
    soldOut: "Agotado",
    offerLabel: "Oferta especial",
    offerHint: "Precio de oferta si lo compras con este producto",
    errorMsg: "No se pudo añadir. Inténtalo de nuevo.",
    prev: "Anterior",
    next: "Siguiente",
  },
  it: {
    title: "Potrebbero piacerti anche questi prodotti",
    subtitle: "",
    add: "Aggiungi",
    added: "Aggiunto",
    adding: "Aggiunta…",
    addSelected: "Aggiungi {count} al carrello",
    total: "Totale",
    save: "Risparmia {value}",
    soldOut: "Esaurito",
    offerLabel: "Offerta speciale",
    offerHint: "Prezzo in offerta se lo acquisti con questo prodotto",
    errorMsg: "Impossibile aggiungere. Riprova.",
    prev: "Precedente",
    next: "Successivo",
  },
  pt: {
    title: "Você também pode gostar destes produtos",
    subtitle: "",
    add: "Adicionar",
    added: "Adicionado",
    adding: "Adicionando…",
    addSelected: "Adicionar {count} ao carrinho",
    total: "Total",
    save: "Economize {value}",
    soldOut: "Esgotado",
    offerLabel: "Oferta especial",
    offerHint: "Preço da oferta ao comprar com este produto",
    errorMsg: "Não foi possível adicionar. Tente novamente.",
    prev: "Anterior",
    next: "Próximo",
  },
};
export const RC_DEFAULT_TEXTS = T;

export const RC_SOURCE_META: Record<RcSource, { name: string; blurb: string }> = {
  related: { name: "Shopify recommendations: similar", blurb: "Products Shopify finds related to the one on the page. No setup, updates by itself." },
  complementary: { name: "Shopify recommendations: goes well with", blurb: "Products you set as complementary in the Shopify Search & Discovery app." },
  manual: { name: "Products I pick", blurb: "The same products on every page that shows the block." },
  collection: { name: "A collection", blurb: "Products from one collection, kept up to date automatically." },
};

export const RC_DESIGN_META: Record<RcDesign, { name: string; blurb: string }> = {
  cards: { name: "Product cards", blurb: "Image, rating, price, options and an Add button, side by side." },
  compact: { name: "Compact rows", blurb: "Small image on the side, details and Add next to it." },
  checklist: { name: "Bought together", blurb: "Tick boxes and one button that adds every ticked product." },
  mini: { name: "Mini tiles", blurb: "Small square images with a quick-add button on each." },
  carousel: { name: "Swipe strip", blurb: "A row that scrolls sideways. Good for 4 or more products." },
  inline: { name: "Slim pills", blurb: "The smallest option: a slim pill per product with a + button." },
};

export const RC_PLACEMENT_META: Record<RcPlacementMode, { name: string; blurb: string }> = {
  all: { name: "All product pages", blurb: "Every product page that has the block." },
  products: { name: "Specific product pages", blurb: "Only on the products you pick." },
  collections: { name: "Products in specific collections", blurb: "Product pages of products in the collections you pick." },
  exclude: { name: "All product pages except…", blurb: "Every product page except the products and collections you pick." },
};

export const RC_DEFAULT_STYLE: RcStyle = {
  accent: "#111111",
  bg: "#FFFFFF",
  text: "#111111",
  muted: "#5C5C5C",
  border: "#E2E2E2",
  btnBg: "#111111",
  btnText: "#FFFFFF",
  badgeBg: "#E7F4EA",
  badgeText: "#14532D",
  star: "#E0A200",
  radius: 12,
  imageRatio: "square",
  font: "theme",
  customCss: "",
};

export const RC_MAX_COUNT = 8;
export const RC_MAX_PRODUCTS = 30;

export function defaultRcConfig(): RcConfig {
  return {
    source: "related",
    products: [],
    collection: null,
    count: 3,
    shuffle: false,
    hideInCart: true,
    hideSoldOut: true,
    showRating: true,
    showCompare: true,
    showVariants: true,
    showQty: true,
    design: "cards",
    offer: { mode: "none", value: 10 },
    afterAdd: "drawer",
    placement: { mode: "all", products: [], collections: [], device: "all" },
  };
}

const refs = (list: any, kind: string) =>
  uniqBy(
    (Array.isArray(list) ? list : []).map((x: any) => ({ id: gid(x?.id, kind), label: str(x?.label, 255) })).filter((x: any) => x.id),
    (x: any) => x.id,
  ).slice(0, 100);

export function sanitizeRcConfig(raw: any): RcConfig {
  const d = defaultRcConfig();
  const r = raw && typeof raw === "object" ? raw : {};
  const bool = (v: unknown, def: boolean) => (v === undefined ? def : !!v);
  const om = oneOf(r.offer?.mode, RC_OFFER_MODES, "none");
  const pl = r.placement || {};
  return {
    source: oneOf(r.source, RC_SOURCES, d.source),
    products: uniqBy((Array.isArray(r.products) ? r.products : []).map(BB_SAN.product).filter(Boolean) as BbProduct[], (p) => p.id).slice(0, RC_MAX_PRODUCTS),
    collection: BB_SAN.collection(r.collection),
    count: int(r.count, 1, RC_MAX_COUNT, d.count),
    shuffle: bool(r.shuffle, d.shuffle),
    hideInCart: bool(r.hideInCart, d.hideInCart),
    hideSoldOut: bool(r.hideSoldOut, d.hideSoldOut),
    showRating: bool(r.showRating, d.showRating),
    showCompare: bool(r.showCompare, d.showCompare),
    showVariants: bool(r.showVariants, d.showVariants),
    showQty: bool(r.showQty, d.showQty),
    design: oneOf(r.design, RC_DESIGNS, d.design),
    offer: { mode: om, value: om === "percent" ? dec(r.offer?.value, 0, 100, 10) : dec(r.offer?.value, 0, 1_000_000, 0) },
    afterAdd: oneOf(r.afterAdd, ["drawer", "stay", "cart"] as const, d.afterAdd),
    placement: {
      mode: oneOf(pl.mode, RC_PLACEMENTS, "all"),
      products: refs(pl.products, "Product"),
      collections: refs(pl.collections, "Collection"),
      device: oneOf(pl.device, ["all", "mobile", "desktop"] as const, "all"),
    },
  };
}

export function sanitizeRcStyle(raw: any): RcStyle {
  const r = raw && typeof raw === "object" ? raw : {};
  const d = RC_DEFAULT_STYLE;
  return {
    accent: color(r.accent, d.accent),
    bg: color(r.bg, d.bg),
    text: color(r.text, d.text),
    muted: color(r.muted, d.muted),
    border: color(r.border, d.border),
    btnBg: color(r.btnBg, d.btnBg),
    btnText: color(r.btnText, d.btnText),
    badgeBg: color(r.badgeBg, d.badgeBg),
    badgeText: color(r.badgeText, d.badgeText),
    star: color(r.star, d.star),
    radius: int(r.radius, 0, 28, d.radius),
    imageRatio: oneOf(r.imageRatio, ["square", "portrait", "natural"] as const, "square"),
    font: oneOf(r.font, ["theme", "system"] as const, "theme"),
    customCss: str(r.customCss, 6000),
  };
}

export function sanitizeRcTexts(raw: any): RcTextsByLang {
  const out: RcTextsByLang = {};
  const r = raw && typeof raw === "object" ? raw : {};
  for (const lang of BB_LANGS) {
    const src = r[lang];
    if (!src || typeof src !== "object") continue;
    const t: RcTexts = {};
    for (const k of RC_TEXT_KEYS) {
      const v = String(src[k] ?? "").trim();
      if (v) t[k] = v.slice(0, 200);
    }
    if (Object.keys(t).length) out[lang] = t;
  }
  return out;
}

export function resolveRcTexts(texts: RcTextsByLang, lang: string): Required<RcTexts> {
  const l = (BB_LANGS as readonly string[]).includes(lang) ? (lang as BbLang) : "en";
  const base = T[l];
  const own = texts[l] || {};
  const en = texts.en || {};
  const out: any = {};
  for (const k of RC_TEXT_KEYS) out[k] = own[k] || ((k === "title" || k === "subtitle") && l !== "en" && en[k] && !texts[l] ? en[k] : base[k]);
  return out;
}

export function validateRc(c: RcConfig): string[] {
  const errs: string[] = [];
  if (c.source === "manual" && !c.products.length) errs.push("Pick at least one product to recommend.");
  if (c.source === "collection" && !c.collection) errs.push("Pick the collection to recommend from.");
  if (c.offer.mode !== "none" && !(c.offer.value > 0)) errs.push("Enter an offer above 0, or choose “No offer”.");
  return errs;
}

export type ParsedRecs = { enabled: boolean; config: RcConfig; style: RcStyle; texts: RcTextsByLang };

export function parseRecs(json: string | null | undefined, enabled: boolean): ParsedRecs {
  let r: any = {};
  try {
    r = JSON.parse(json || "{}");
  } catch {
    r = {};
  }
  return { enabled, config: sanitizeRcConfig(r.config), style: sanitizeRcStyle(r.style), texts: sanitizeRcTexts(r.texts) };
}

export function describeOffer(o: RcConfig["offer"], money: (n: number) => string) {
  if (o.mode === "percent") return `${o.value}% off each`;
  if (o.mode === "amount") return `${money(o.value)} off each`;
  return "No offer";
}
