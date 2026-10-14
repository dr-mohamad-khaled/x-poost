/**
 * Bundle Builder — shared types, defaults and sanitizers.
 * Used by the admin editor, the storefront payload (app proxy) and the checkout discount sync.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export const BB_TYPES = ["mix", "box", "fixed", "multipack"] as const;
export type BbType = (typeof BB_TYPES)[number];

export const BB_DESIGNS = ["slots", "grid", "stepper", "list", "classic", "tiles"] as const;
export type BbDesign = (typeof BB_DESIGNS)[number];

export const BB_DISPLAYS = ["inline", "drawer", "modal"] as const;
export type BbDisplay = (typeof BB_DISPLAYS)[number];

export const BB_PRICE_MODES = ["percent", "amount", "price", "tiers", "cheapest", "none"] as const;
export type BbPriceMode = (typeof BB_PRICE_MODES)[number];

export type BbRuleMode = "percent" | "amount" | "price";
export type BbTier = { min: number; mode: BbRuleMode; value: number };

export type BbPricing = {
  mode: BbPriceMode;
  value: number;
  tiers: BbTier[];
  cheapestCount: number;
  cheapestPercent: number;
};

export type BbProduct = { id: string; title: string; handle: string; imageUrl: string; price: string; variantId?: string };
export type BbCollection = { id: string; title: string; handle: string };

export type BbStep = { id: string; title: string; min: number; max: number; products: BbProduct[]; collections: BbCollection[] };
export type BbFixedItem = BbProduct & { qty: number };

export const BB_PLACEMENTS = ["in_bundle", "all", "products", "collections", "exclude", "landing"] as const;
export type BbPlacementMode = (typeof BB_PLACEMENTS)[number];
export type BbPlacement = {
  mode: BbPlacementMode;
  products: { id: string; label: string }[];
  collections: { id: string; label: string }[];
  device: "all" | "mobile" | "desktop";
};

export type BbConfig = {
  steps: BbStep[]; // mix: 1 step · box: 1–6 steps
  fixed: BbFixedItem[];
  multipack: { product: BbProduct | null; min: number; max: number };
  allowDuplicates: boolean;
  allowMultiples: boolean; // shopper may raise quantities in the cart (2 bundles, 3 bundles…)
  pricing: BbPricing;
  gift: { enabled: boolean; product: BbProduct | null; minItems: number };
  hideSoldOut: boolean;
  afterAdd: "drawer" | "cart" | "checkout" | "stay";
  display: BbDisplay;
  startsAt: string; // YYYY-MM-DD or ""
  endsAt: string;
};

/** Feature-level settings (one checkout discount serves every bundle). */
export type BbSettings = { combineOrder: boolean; combineShipping: boolean; combineProduct: boolean };
export const BB_DEFAULT_SETTINGS: BbSettings = { combineOrder: true, combineShipping: true, combineProduct: false };
export function sanitizeSettings(raw: any): BbSettings {
  const r = raw && typeof raw === "object" ? raw : {};
  const d = BB_DEFAULT_SETTINGS;
  return {
    combineOrder: r.combineOrder === undefined ? d.combineOrder : !!r.combineOrder,
    combineShipping: r.combineShipping === undefined ? d.combineShipping : !!r.combineShipping,
    combineProduct: r.combineProduct === undefined ? d.combineProduct : !!r.combineProduct,
  };
}

export type BbStyle = {
  accent: string;
  bg: string;
  text: string;
  muted: string;
  border: string;
  btnBg: string;
  btnText: string;
  badgeBg: string;
  badgeText: string;
  radius: number;
  columns: number;
  imageRatio: "square" | "portrait" | "natural";
  font: "theme" | "system";
  customCss: string;
};

// ── Conditions (who sees the bundle and who gets the price at checkout) ──
export const BB_COND_TYPES = [
  "tag_any",
  "tag_none",
  "logged_in",
  "guest",
  "orders_gte",
  "orders_lte",
  "spent_gte",
  "country_in",
  "country_not_in",
  "market_in",
] as const;
export type BbCondType = (typeof BB_COND_TYPES)[number];
export type BbCondition = { id: string; type: BbCondType; values?: string[]; num?: number };
export type BbConditions = { match: "all" | "any"; rules: BbCondition[] };

export const BB_COND_META: Record<BbCondType, { label: string; input: "tags" | "num" | "money" | "countries" | "markets" | "none"; hint?: string }> = {
  tag_any: { label: "Customer has any of these tags", input: "tags" },
  tag_none: { label: "Customer has none of these tags", input: "tags" },
  logged_in: { label: "Customer is logged in", input: "none" },
  guest: { label: "Customer is not logged in", input: "none" },
  orders_gte: { label: "Customer has placed at least … orders", input: "num" },
  orders_lte: { label: "Customer has placed at most … orders", input: "num", hint: "0 = first-time customers only" },
  spent_gte: { label: "Customer has spent at least", input: "money" },
  country_in: { label: "Shopper's country is one of", input: "countries" },
  country_not_in: { label: "Shopper's country is not one of", input: "countries" },
  market_in: { label: "Shopper's market is one of", input: "markets" },
};

// ── Texts ──
export const BB_LANGS = ["en", "ar", "fr", "de", "es", "it", "pt"] as const;
export type BbLang = (typeof BB_LANGS)[number];

export const BB_TEXT_KEYS = [
  "title",
  "subtitle",
  "badge",
  "addButton",
  "openButton",
  "lineLabel",
  "add",
  "remove",
  "choose",
  "selected",
  "added",
  "soldOut",
  "optional",
  "pickExact",
  "pickRange",
  "pickItem",
  "pickMore",
  "pickOneMore",
  "chooseOptions",
  "ready",
  "readyNoSave",
  "tierChip",
  "tierPrice",
  "tierHint",
  "total",
  "saveTag",
  "giftOn",
  "giftOff",
  "next",
  "back",
  "skip",
  "review",
  "reviewTitle",
  "stepOf",
  "addedMsg",
  "errorMsg",
  "adding",
  "close",
  "freeWord",
] as const;
export type BbTextKey = (typeof BB_TEXT_KEYS)[number];
export type BbTexts = Partial<Record<BbTextKey, string>> & { steps?: Record<string, string> };
export type BbTextsByLang = Partial<Record<BbLang, BbTexts>>;

/** Fields shown first in the editor; the rest sit under "All texts". */
export const BB_MAIN_TEXTS: BbTextKey[] = ["title", "subtitle", "badge", "addButton", "openButton", "lineLabel"];

export const BB_TEXT_META: Record<BbTextKey, { label: string; vars?: string }> = {
  title: { label: "Heading" },
  subtitle: { label: "Subheading" },
  badge: { label: "Savings badge", vars: "{save}" },
  addButton: { label: "Add to cart button" },
  openButton: { label: "Open button (drawer / pop-up)" },
  lineLabel: { label: "Cart line label" },
  add: { label: "Add product button" },
  remove: { label: "Remove product button" },
  choose: { label: "Choose button (step by step)" },
  selected: { label: "Selected label" },
  added: { label: "Already added label" },
  soldOut: { label: "Sold out" },
  optional: { label: "Optional slot" },
  pickExact: { label: "Step rule (exact)", vars: "{count}" },
  pickRange: { label: "Step rule (range)", vars: "{min} {max}" },
  pickItem: { label: "Step by step: item title", vars: "{n}" },
  pickMore: { label: "Items still needed", vars: "{remaining}" },
  pickOneMore: { label: "One item still needed" },
  chooseOptions: { label: "Fixed bundle: choose options" },
  ready: { label: "Bundle complete (with savings)", vars: "{saved}" },
  readyNoSave: { label: "Bundle complete (no savings)" },
  tierChip: { label: "Tier chip", vars: "{count} {value}" },
  tierPrice: { label: "Tier chip (bundle price)", vars: "{count} {value}" },
  tierHint: { label: "Next tier hint", vars: "{more} {value}" },
  total: { label: "Total label" },
  saveTag: { label: "Savings tag", vars: "{percent}" },
  giftOn: { label: "Gift unlocked", vars: "{gift}" },
  giftOff: { label: "Gift locked", vars: "{count} {gift}" },
  next: { label: "Next button" },
  back: { label: "Back button" },
  skip: { label: "Skip button" },
  review: { label: "Review button" },
  reviewTitle: { label: "Review title" },
  stepOf: { label: "Step counter", vars: "{n} {total}" },
  addedMsg: { label: "Added to cart message" },
  errorMsg: { label: "Error message" },
  adding: { label: "Adding… label" },
  close: { label: "Close (screen readers)" },
  freeWord: { label: "Word for free" },
};

const T_EN: Required<Omit<BbTexts, "steps">> = {
  title: "Build your bundle",
  subtitle: "Pick your favourites and save",
  badge: "Save {save}",
  addButton: "Add bundle to cart",
  openButton: "Build your bundle",
  lineLabel: "Bundle",
  add: "Add",
  remove: "Remove",
  choose: "Choose",
  selected: "Selected",
  added: "Added",
  soldOut: "Sold out",
  optional: "Optional",
  pickExact: "Pick {count}",
  pickRange: "Pick {min} to {max}",
  pickItem: "Choose item {n}",
  pickMore: "Pick {remaining} more items",
  pickOneMore: "Pick 1 more item",
  chooseOptions: "Choose your options",
  ready: "Bundle ready. You save {saved}",
  readyNoSave: "Bundle ready",
  tierChip: "{count}+ items: save {value}",
  tierPrice: "{count} for {value}",
  tierHint: "Add {more} more to save {value}",
  total: "Total",
  saveTag: "−{percent}%",
  giftOn: "Free gift included: {gift}",
  giftOff: "Pick {count} items to get {gift} free",
  next: "Next",
  back: "Back",
  skip: "Skip",
  review: "Review bundle",
  reviewTitle: "Your bundle",
  stepOf: "Step {n} of {total}",
  addedMsg: "Added to your cart",
  errorMsg: "Couldn't add the bundle. Please try again.",
  adding: "Adding…",
  close: "Close",
  freeWord: "FREE",
};

export const BB_DEFAULT_TEXTS: Record<BbLang, Required<Omit<BbTexts, "steps">>> = {
  en: T_EN,
  ar: {
    title: "كوّن الباقة الخاصة بك",
    subtitle: "اختر منتجاتك المفضلة ووفّر",
    badge: "وفّر {save}",
    addButton: "أضف الباقة إلى السلة",
    openButton: "كوّن باقتك",
    lineLabel: "الباقة",
    add: "أضف",
    remove: "إزالة",
    choose: "اختر",
    selected: "تم الاختيار",
    added: "مضاف",
    soldOut: "نفدت الكمية",
    optional: "اختياري",
    pickExact: "اختر {count}",
    pickRange: "اختر من {min} إلى {max}",
    pickItem: "اختر المنتج رقم {n}",
    pickMore: "اختر {remaining} منتجات أخرى",
    pickOneMore: "اختر منتجًا واحدًا آخر",
    chooseOptions: "اختر الخيارات",
    ready: "الباقة جاهزة. وفّرت {saved}",
    readyNoSave: "الباقة جاهزة",
    tierChip: "{count}+ منتجات: وفّر {value}",
    tierPrice: "{count} بسعر {value}",
    tierHint: "أضف {more} لتوفّر {value}",
    total: "الإجمالي",
    saveTag: "−{percent}%",
    giftOn: "هدية مجانية مضافة: {gift}",
    giftOff: "اختر {count} منتجات واحصل على {gift} مجانًا",
    next: "التالي",
    back: "رجوع",
    skip: "تخطَّ",
    review: "راجع الباقة",
    reviewTitle: "باقتك",
    stepOf: "الخطوة {n} من {total}",
    addedMsg: "تمت الإضافة إلى سلتك",
    errorMsg: "تعذّرت إضافة الباقة. حاول مرة أخرى.",
    adding: "جارٍ الإضافة…",
    close: "إغلاق",
    freeWord: "مجانًا",
  },
  fr: {
    title: "Composez votre lot",
    subtitle: "Choisissez vos favoris et économisez",
    badge: "Économisez {save}",
    addButton: "Ajouter le lot au panier",
    openButton: "Composer mon lot",
    lineLabel: "Lot",
    add: "Ajouter",
    remove: "Retirer",
    choose: "Choisir",
    selected: "Sélectionné",
    added: "Ajouté",
    soldOut: "Épuisé",
    optional: "Facultatif",
    pickExact: "Choisissez-en {count}",
    pickRange: "Choisissez-en {min} à {max}",
    pickItem: "Choisissez l'article {n}",
    pickMore: "Encore {remaining} articles à choisir",
    pickOneMore: "Encore 1 article à choisir",
    chooseOptions: "Choisissez vos options",
    ready: "Lot complet. Vous économisez {saved}",
    readyNoSave: "Lot complet",
    tierChip: "{count}+ articles : -{value}",
    tierPrice: "{count} pour {value}",
    tierHint: "Ajoutez-en {more} pour économiser {value}",
    total: "Total",
    saveTag: "−{percent} %",
    giftOn: "Cadeau offert inclus : {gift}",
    giftOff: "Choisissez {count} articles pour recevoir {gift} offert",
    next: "Suivant",
    back: "Retour",
    skip: "Passer",
    review: "Voir le lot",
    reviewTitle: "Votre lot",
    stepOf: "Étape {n} sur {total}",
    addedMsg: "Ajouté à votre panier",
    errorMsg: "Impossible d'ajouter le lot. Veuillez réessayer.",
    adding: "Ajout…",
    close: "Fermer",
    freeWord: "OFFERT",
  },
  de: {
    title: "Stell dein Set zusammen",
    subtitle: "Wähle deine Favoriten und spare",
    badge: "Spare {save}",
    addButton: "Set in den Warenkorb",
    openButton: "Set zusammenstellen",
    lineLabel: "Set",
    add: "Hinzufügen",
    remove: "Entfernen",
    choose: "Auswählen",
    selected: "Ausgewählt",
    added: "Hinzugefügt",
    soldOut: "Ausverkauft",
    optional: "Optional",
    pickExact: "Wähle {count}",
    pickRange: "Wähle {min} bis {max}",
    pickItem: "Wähle Artikel {n}",
    pickMore: "Noch {remaining} Artikel wählen",
    pickOneMore: "Noch 1 Artikel wählen",
    chooseOptions: "Wähle deine Optionen",
    ready: "Set komplett. Du sparst {saved}",
    readyNoSave: "Set komplett",
    tierChip: "Ab {count} Artikeln: {value} sparen",
    tierPrice: "{count} für {value}",
    tierHint: "Noch {more} hinzufügen und {value} sparen",
    total: "Gesamt",
    saveTag: "−{percent} %",
    giftOn: "Gratis-Geschenk dabei: {gift}",
    giftOff: "Wähle {count} Artikel und erhalte {gift} gratis",
    next: "Weiter",
    back: "Zurück",
    skip: "Überspringen",
    review: "Set prüfen",
    reviewTitle: "Dein Set",
    stepOf: "Schritt {n} von {total}",
    addedMsg: "Zum Warenkorb hinzugefügt",
    errorMsg: "Das Set konnte nicht hinzugefügt werden. Bitte versuche es erneut.",
    adding: "Wird hinzugefügt…",
    close: "Schließen",
    freeWord: "GRATIS",
  },
  es: {
    title: "Crea tu pack",
    subtitle: "Elige tus favoritos y ahorra",
    badge: "Ahorra {save}",
    addButton: "Añadir pack al carrito",
    openButton: "Crear mi pack",
    lineLabel: "Pack",
    add: "Añadir",
    remove: "Quitar",
    choose: "Elegir",
    selected: "Elegido",
    added: "Añadido",
    soldOut: "Agotado",
    optional: "Opcional",
    pickExact: "Elige {count}",
    pickRange: "Elige de {min} a {max}",
    pickItem: "Elige el artículo {n}",
    pickMore: "Elige {remaining} artículos más",
    pickOneMore: "Elige 1 artículo más",
    chooseOptions: "Elige tus opciones",
    ready: "Pack listo. Ahorras {saved}",
    readyNoSave: "Pack listo",
    tierChip: "{count}+ artículos: ahorra {value}",
    tierPrice: "{count} por {value}",
    tierHint: "Añade {more} más y ahorra {value}",
    total: "Total",
    saveTag: "−{percent} %",
    giftOn: "Regalo incluido: {gift}",
    giftOff: "Elige {count} artículos y llévate {gift} gratis",
    next: "Siguiente",
    back: "Atrás",
    skip: "Omitir",
    review: "Revisar pack",
    reviewTitle: "Tu pack",
    stepOf: "Paso {n} de {total}",
    addedMsg: "Añadido a tu carrito",
    errorMsg: "No se pudo añadir el pack. Inténtalo de nuevo.",
    adding: "Añadiendo…",
    close: "Cerrar",
    freeWord: "GRATIS",
  },
  it: {
    title: "Crea il tuo bundle",
    subtitle: "Scegli i tuoi preferiti e risparmia",
    badge: "Risparmia {save}",
    addButton: "Aggiungi il bundle al carrello",
    openButton: "Crea il tuo bundle",
    lineLabel: "Bundle",
    add: "Aggiungi",
    remove: "Rimuovi",
    choose: "Scegli",
    selected: "Selezionato",
    added: "Aggiunto",
    soldOut: "Esaurito",
    optional: "Facoltativo",
    pickExact: "Scegline {count}",
    pickRange: "Scegline da {min} a {max}",
    pickItem: "Scegli l'articolo {n}",
    pickMore: "Scegli altri {remaining} articoli",
    pickOneMore: "Scegli ancora 1 articolo",
    chooseOptions: "Scegli le opzioni",
    ready: "Bundle pronto. Risparmi {saved}",
    readyNoSave: "Bundle pronto",
    tierChip: "{count}+ articoli: risparmi {value}",
    tierPrice: "{count} a {value}",
    tierHint: "Aggiungine altri {more} per risparmiare {value}",
    total: "Totale",
    saveTag: "−{percent}%",
    giftOn: "Regalo incluso: {gift}",
    giftOff: "Scegli {count} articoli e ricevi {gift} in omaggio",
    next: "Avanti",
    back: "Indietro",
    skip: "Salta",
    review: "Rivedi il bundle",
    reviewTitle: "Il tuo bundle",
    stepOf: "Passo {n} di {total}",
    addedMsg: "Aggiunto al carrello",
    errorMsg: "Impossibile aggiungere il bundle. Riprova.",
    adding: "Aggiunta…",
    close: "Chiudi",
    freeWord: "GRATIS",
  },
  pt: {
    title: "Monte o seu kit",
    subtitle: "Escolha os seus favoritos e economize",
    badge: "Economize {save}",
    addButton: "Adicionar kit ao carrinho",
    openButton: "Montar o meu kit",
    lineLabel: "Kit",
    add: "Adicionar",
    remove: "Remover",
    choose: "Escolher",
    selected: "Selecionado",
    added: "Adicionado",
    soldOut: "Esgotado",
    optional: "Opcional",
    pickExact: "Escolha {count}",
    pickRange: "Escolha de {min} a {max}",
    pickItem: "Escolha o item {n}",
    pickMore: "Escolha mais {remaining} itens",
    pickOneMore: "Escolha mais 1 item",
    chooseOptions: "Escolha as suas opções",
    ready: "Kit pronto. Você economiza {saved}",
    readyNoSave: "Kit pronto",
    tierChip: "{count}+ itens: economize {value}",
    tierPrice: "{count} por {value}",
    tierHint: "Adicione mais {more} para economizar {value}",
    total: "Total",
    saveTag: "−{percent}%",
    giftOn: "Brinde incluído: {gift}",
    giftOff: "Escolha {count} itens e ganhe {gift} grátis",
    next: "Próximo",
    back: "Voltar",
    skip: "Pular",
    review: "Rever kit",
    reviewTitle: "O seu kit",
    stepOf: "Passo {n} de {total}",
    addedMsg: "Adicionado ao seu carrinho",
    errorMsg: "Não foi possível adicionar o kit. Tente novamente.",
    adding: "Adicionando…",
    close: "Fechar",
    freeWord: "GRÁTIS",
  },
};

// ─────────────────────────────────────────────────────────────
// Meta (names shown in the editor)
// ─────────────────────────────────────────────────────────────

export const BB_TYPE_META: Record<BbType, { name: string; blurb: string; designs: BbDesign[] }> = {
  mix: { name: "Mix & Match", blurb: "Shoppers pick any items from a group you choose, for example any 3 for one price.", designs: ["slots", "grid", "stepper", "list"] },
  box: { name: "Build a Box", blurb: "Shoppers fill the box step by step, with a different group of products in each step.", designs: ["stepper", "slots", "grid", "list"] },
  fixed: { name: "Fixed Bundle", blurb: "You set the products. Shoppers only choose sizes or colors.", designs: ["classic", "list", "slots"] },
  multipack: { name: "Multipack", blurb: "One product, several variants: for example a 6-pack in any flavours.", designs: ["tiles", "list", "stepper"] },
};

export const BB_DESIGN_META: Record<BbDesign, { name: string; blurb: string }> = {
  slots: { name: "Slot Builder", blurb: "Empty slots on top fill up as the shopper picks." },
  grid: { name: "Grid + Summary", blurb: "Product grid with counters and a summary that stays in view." },
  stepper: { name: "Step by Step", blurb: "One choice per screen, with progress dots and a final review." },
  list: { name: "Compact List", blurb: "Small rows with + and − buttons. Fits under the buy button." },
  classic: { name: "Classic (A + B + C)", blurb: "Products side by side with plus signs and one total." },
  tiles: { name: "Variant Tiles", blurb: "A tile per variant with a counter, ideal for flavours and colors." },
};

export const BB_PRICE_META: Record<BbPriceMode, { name: string; blurb: string }> = {
  percent: { name: "Percentage off", blurb: "e.g. 20% off the bundle" },
  amount: { name: "Amount off", blurb: "e.g. $10 off the bundle" },
  price: { name: "Bundle price", blurb: "e.g. any 3 for $49" },
  tiers: { name: "Tiers by item count", blurb: "e.g. 2 items 10% off, 3 items 20% off" },
  cheapest: { name: "Cheapest item free or discounted", blurb: "e.g. buy 2, get the 3rd free" },
  none: { name: "No discount", blurb: "A builder without a price change" },
};

export const BB_PLACEMENT_META: Record<BbPlacementMode, { name: string; blurb: string }> = {
  in_bundle: { name: "Pages of products in this bundle", blurb: "Shows on the product page of every product the bundle uses." },
  all: { name: "All product pages", blurb: "Shows on every product page that has the block." },
  products: { name: "Specific product pages", blurb: "Only on the products you pick." },
  collections: { name: "Products in specific collections", blurb: "Product pages of products in the collections you pick." },
  exclude: { name: "All product pages except…", blurb: "Every product page except the products and collections you pick." },
  landing: { name: "Only where I place it by ID", blurb: "Put the block on any page (a landing page, the home page) and enter this bundle's ID in the block settings." },
};

export const BB_LANG_META: Record<BbLang, { name: string; dir: "ltr" | "rtl" }> = {
  en: { name: "English", dir: "ltr" },
  ar: { name: "العربية", dir: "rtl" },
  fr: { name: "Français", dir: "ltr" },
  de: { name: "Deutsch", dir: "ltr" },
  es: { name: "Español", dir: "ltr" },
  it: { name: "Italiano", dir: "ltr" },
  pt: { name: "Português", dir: "ltr" },
};

// ─────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────

export const BB_DEFAULT_STYLE: BbStyle = {
  accent: "#111111",
  bg: "#FFFFFF",
  text: "#111111",
  muted: "#5C5C5C",
  border: "#E2E2E2",
  btnBg: "#111111",
  btnText: "#FFFFFF",
  badgeBg: "#E7F4EA",
  badgeText: "#14532D",
  radius: 12,
  columns: 3,
  imageRatio: "square",
  font: "theme",
  customCss: "",
};

export const newId = () => Math.random().toString(36).slice(2, 10);

export function defaultConfig(type: BbType = "mix"): BbConfig {
  return {
    steps:
      type === "box"
        ? [
            { id: newId(), title: "Step 1", min: 1, max: 1, products: [], collections: [] },
            { id: newId(), title: "Step 2", min: 1, max: 1, products: [], collections: [] },
          ]
        : [{ id: newId(), title: "", min: 3, max: 3, products: [], collections: [] }],
    fixed: [],
    multipack: { product: null, min: 3, max: 3 },
    allowDuplicates: false,
    allowMultiples: true,
    pricing: { mode: "percent", value: 15, tiers: [], cheapestCount: 1, cheapestPercent: 100 },
    gift: { enabled: false, product: null, minItems: 3 },
    hideSoldOut: false,
    afterAdd: "drawer",
    display: "inline",
    startsAt: "",
    endsAt: "",
  };
}

export function defaultPlacement(): BbPlacement {
  return { mode: "in_bundle", products: [], collections: [], device: "all" };
}

export const MAX_BUNDLES = 30;
export const MAX_STEPS = 6;
export const MAX_POOL_PRODUCTS = 60;
export const MAX_POOL_COLLECTIONS = 5;
export const MAX_ITEMS = 12;

// ─────────────────────────────────────────────────────────────
// Sanitizers (everything from the browser goes through these)
// ─────────────────────────────────────────────────────────────

const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max);
const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const dec = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 100) / 100)) : d;
};
const color = (v: unknown, d: string) => (/^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v).toUpperCase() : d);
const gid = (v: unknown, kind: string) => {
  const s = String(v ?? "");
  if (new RegExp(`^gid://shopify/${kind}/\\d+$`).test(s)) return s;
  if (/^\d+$/.test(s)) return `gid://shopify/${kind}/${s}`;
  return "";
};
const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

function sanitizeProduct(p: any): BbProduct | null {
  const id = gid(p?.id || p?.productId, "Product");
  const handle = str(p?.handle, 255).trim();
  if (!id || !handle) return null;
  const out: BbProduct = { id, title: str(p?.title, 255), handle, imageUrl: str(p?.imageUrl, 1000), price: str(p?.price, 20) };
  const v = gid(p?.variantId, "ProductVariant");
  if (v) out.variantId = v;
  return out;
}
function sanitizeCollection(c: any): BbCollection | null {
  const id = gid(c?.id, "Collection");
  if (!id) return null;
  return { id, title: str(c?.title, 255), handle: str(c?.handle, 255) };
}
const uniqBy = <T,>(list: T[], key: (t: T) => string) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function sanitizeConfig(raw: any, type: BbType): BbConfig {
  const d = defaultConfig(type);
  const r = raw && typeof raw === "object" ? raw : {};
  const steps: BbStep[] = (Array.isArray(r.steps) ? r.steps : d.steps).slice(0, type === "box" ? MAX_STEPS : 1).map((s: any, i: number) => {
    const max = int(s?.max, 1, MAX_ITEMS, 3);
    const min = int(s?.min, type === "box" ? 0 : 1, max, Math.min(max, 1));
    return {
      id: /^[a-z0-9]{4,12}$/.test(String(s?.id || "")) ? String(s.id) : newId(),
      title: str(s?.title, 80),
      min,
      max,
      products: uniqBy((Array.isArray(s?.products) ? s.products : []).map(sanitizeProduct).filter(Boolean) as BbProduct[], (p) => p.id).slice(0, MAX_POOL_PRODUCTS),
      collections: uniqBy((Array.isArray(s?.collections) ? s.collections : []).map(sanitizeCollection).filter(Boolean) as BbCollection[], (c) => c.id).slice(0, MAX_POOL_COLLECTIONS),
    };
  });
  if (!steps.length) steps.push(...d.steps);
  // A box needs at least one item in total
  if (type === "box" && steps.every((s) => s.min === 0)) steps[0].min = 1;

  const fixed: BbFixedItem[] = uniqBy(
    (Array.isArray(r.fixed) ? r.fixed : [])
      .map((f: any) => {
        const p = sanitizeProduct(f);
        return p ? { ...p, qty: int(f?.qty, 1, 10, 1) } : null;
      })
      .filter(Boolean) as BbFixedItem[],
    (p) => p.id,
  ).slice(0, 8);

  const mpMax = int(r.multipack?.max, 1, 24, 3);
  const multipack = { product: sanitizeProduct(r.multipack?.product), max: mpMax, min: int(r.multipack?.min, 1, mpMax, Math.min(mpMax, 3)) };

  const pr = r.pricing || {};
  const mode = oneOf(pr.mode, BB_PRICE_MODES, "percent");
  const pricing: BbPricing = {
    mode,
    value: mode === "percent" ? dec(pr.value, 0, 100, 15) : dec(pr.value, 0, 1_000_000, 0),
    tiers: (Array.isArray(pr.tiers) ? pr.tiers : [])
      .map((t: any) => {
        const m = oneOf(t?.mode, ["percent", "amount", "price"] as const, "percent");
        return { min: int(t?.min, 1, 99, 2), mode: m, value: m === "percent" ? dec(t?.value, 0, 100, 10) : dec(t?.value, 0, 1_000_000, 0) };
      })
      .filter((t: BbTier) => t.value > 0 || t.mode === "price")
      .slice(0, 6),
    cheapestCount: int(pr.cheapestCount, 1, 10, 1),
    cheapestPercent: dec(pr.cheapestPercent, 1, 100, 100),
  };
  pricing.tiers = uniqBy(pricing.tiers.sort((a, b) => a.min - b.min), (t) => String(t.min));

  return {
    steps,
    fixed,
    multipack,
    allowDuplicates: !!r.allowDuplicates,
    allowMultiples: r.allowMultiples === undefined ? d.allowMultiples : !!r.allowMultiples,
    pricing,
    gift: { enabled: !!r.gift?.enabled, product: sanitizeProduct(r.gift?.product), minItems: int(r.gift?.minItems, 1, 24, 3) },
    hideSoldOut: !!r.hideSoldOut,
    afterAdd: oneOf(r.afterAdd, ["drawer", "cart", "checkout", "stay"] as const, "drawer"),
    display: oneOf(r.display, BB_DISPLAYS, "inline"),
    startsAt: date(r.startsAt),
    endsAt: date(r.endsAt),
  };
}

export function sanitizePlacement(raw: any): BbPlacement {
  const r = raw && typeof raw === "object" ? raw : {};
  const refs = (list: any, kind: string) =>
    uniqBy(
      (Array.isArray(list) ? list : [])
        .map((x: any) => ({ id: gid(x?.id, kind), label: str(x?.label, 255) }))
        .filter((x: any) => x.id),
      (x: any) => x.id,
    ).slice(0, 100);
  return {
    mode: oneOf(r.mode, BB_PLACEMENTS, "in_bundle"),
    products: refs(r.products, "Product"),
    collections: refs(r.collections, "Collection"),
    device: oneOf(r.device, ["all", "mobile", "desktop"] as const, "all"),
  };
}

export function sanitizeConditions(raw: any): BbConditions {
  const r = raw && typeof raw === "object" ? raw : {};
  const rules: BbCondition[] = (Array.isArray(r.rules) ? r.rules : [])
    .map((c: any) => {
      const type = oneOf(c?.type, BB_COND_TYPES, "tag_any");
      const out: BbCondition = { id: /^[a-z0-9]{4,12}$/.test(String(c?.id || "")) ? String(c.id) : newId(), type };
      const meta = BB_COND_META[type];
      const list: string[] = (Array.isArray(c?.values) ? c.values : []).map((v: any) => String(v ?? ""));
      if (meta.input === "tags") out.values = uniqBy(list.map((v) => v.slice(0, 80).trim()).filter(Boolean), (v) => v.toLowerCase()).slice(0, 20);
      if (meta.input === "countries") out.values = uniqBy(list.map((v) => v.trim().toUpperCase()).filter((v) => /^[A-Z]{2}$/.test(v)), (v) => v).slice(0, 60);
      if (meta.input === "markets") out.values = uniqBy(list.map((v) => v.trim().toLowerCase()).filter((v) => /^[a-z0-9-]{1,80}$/.test(v)), (v) => v).slice(0, 30);
      if (meta.input === "num") out.num = c?.num === undefined || c?.num === "" ? undefined : int(c.num, 0, 100000, 0);
      if (meta.input === "money") out.num = c?.num === undefined || c?.num === "" ? undefined : dec(c.num, 0, 100_000_000, 0);
      return out;
    })
    .slice(0, 12);
  return { match: r.match === "any" ? "any" : "all", rules };
}

export function sanitizeStyle(raw: any): BbStyle {
  const r = raw && typeof raw === "object" ? raw : {};
  const d = BB_DEFAULT_STYLE;
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
    radius: int(r.radius, 0, 28, d.radius),
    columns: int(r.columns, 2, 5, d.columns),
    imageRatio: oneOf(r.imageRatio, ["square", "portrait", "natural"] as const, "square"),
    font: oneOf(r.font, ["theme", "system"] as const, "theme"),
    customCss: str(r.customCss, 6000),
  };
}

export function sanitizeTexts(raw: any): BbTextsByLang {
  const out: BbTextsByLang = {};
  const r = raw && typeof raw === "object" ? raw : {};
  for (const lang of BB_LANGS) {
    const src = r[lang];
    if (!src || typeof src !== "object") continue;
    const t: BbTexts = {};
    for (const k of BB_TEXT_KEYS) {
      const v = String(src[k] ?? "").trim();
      if (v) t[k] = v.slice(0, 200);
    }
    if (src.steps && typeof src.steps === "object") {
      const steps: Record<string, string> = {};
      for (const [id, v] of Object.entries(src.steps)) if (/^[a-z0-9]{4,12}$/.test(id) && String(v || "").trim()) steps[id] = String(v).trim().slice(0, 80);
      if (Object.keys(steps).length) t.steps = steps;
    }
    if (Object.keys(t).length) out[lang] = t;
  }
  return out;
}

/** Merchant text for a language, falling back to the language default, then English. */
export function resolveTexts(texts: BbTextsByLang, lang: string): Required<Omit<BbTexts, "steps">> & { steps: Record<string, string> } {
  const l = (BB_LANGS as readonly string[]).includes(lang) ? (lang as BbLang) : "en";
  const base = BB_DEFAULT_TEXTS[l];
  const own = texts[l] || {};
  const en = texts.en || {};
  const out: any = {};
  for (const k of BB_TEXT_KEYS) {
    // Heading-type texts the merchant wrote in English are kept for other languages only if
    // that language has no own value; the built-in translation is used for UI words.
    out[k] = own[k] || (BB_MAIN_TEXTS.includes(k) && l !== "en" && en[k] && !texts[l] ? en[k] : base[k]);
  }
  out.steps = { ...(en.steps || {}), ...(own.steps || {}) };
  return out;
}

// ─────────────────────────────────────────────────────────────
// Validation for saving: messages the merchant can act on
// ─────────────────────────────────────────────────────────────

export function validateBundle(type: BbType, c: BbConfig): string[] {
  const errs: string[] = [];
  if (type === "mix" || type === "box") {
    c.steps.forEach((s, i) => {
      const n = s.products.length + s.collections.length;
      const label = type === "box" ? `Step ${i + 1}` : "The product group";
      if (!n) errs.push(`${label} has no products or collections.`);
      else if (!c.allowDuplicates && s.collections.length === 0 && s.products.length < s.min) errs.push(`${label} needs at least ${s.min} different products to choose from, or allow the same product more than once.`);
    });
  }
  if (type === "fixed" && c.fixed.length < 2) errs.push("A fixed bundle needs at least 2 products.");
  if (type === "multipack" && !c.multipack.product) errs.push("Pick the product for the multipack.");
  if (c.pricing.mode === "tiers" && !c.pricing.tiers.length) errs.push("Add at least one tier, or choose another discount type.");
  if (c.pricing.mode === "percent" && !(c.pricing.value > 0)) errs.push("Enter a percentage above 0, or choose “No discount”.");
  if ((c.pricing.mode === "amount" || c.pricing.mode === "price") && !(c.pricing.value > 0)) errs.push("Enter an amount above 0.");
  if (c.gift.enabled && !c.gift.product) errs.push("Pick the free gift product, or turn the gift off.");
  if (c.startsAt && c.endsAt && c.endsAt < c.startsAt) errs.push("The end date is before the start date.");
  return errs;
}

/** Items one complete bundle holds (min/max), for labels and the gift threshold. */
export function bundleSize(type: BbType, c: BbConfig): { min: number; max: number } {
  if (type === "fixed") {
    const n = c.fixed.reduce((a, f) => a + f.qty, 0);
    return { min: n, max: n };
  }
  if (type === "multipack") return { min: c.multipack.min, max: c.multipack.max };
  return { min: c.steps.reduce((a, s) => a + s.min, 0), max: c.steps.reduce((a, s) => a + s.max, 0) };
}

export function describePricing(p: BbPricing, money: (n: number) => string): string {
  switch (p.mode) {
    case "percent":
      return `${p.value}% off`;
    case "amount":
      return `${money(p.value)} off`;
    case "price":
      return `Bundle price ${money(p.value)}`;
    case "tiers":
      return p.tiers.map((t) => `${t.min}+: ${t.mode === "percent" ? `${t.value}%` : money(t.value)}${t.mode === "price" ? "" : " off"}`).join(" · ") || "Tiers";
    case "cheapest":
      return p.cheapestPercent >= 100 ? `Cheapest ${p.cheapestCount} free` : `Cheapest ${p.cheapestCount} ${p.cheapestPercent}% off`;
    default:
      return "No discount";
  }
}

export function describeConditions(c: BbConditions, money: (n: number) => string): string {
  if (!c.rules.length) return "Everyone";
  const parts = c.rules.map((r) => {
    const v = (r.values || []).join(", ");
    switch (r.type) {
      case "tag_any":
        return `tag: ${v || "…"}`;
      case "tag_none":
        return `not tag: ${v || "…"}`;
      case "logged_in":
        return "logged in";
      case "guest":
        return "guest";
      case "orders_gte":
        return `${r.num ?? "…"}+ orders`;
      case "orders_lte":
        return r.num === 0 ? "first order" : `≤ ${r.num ?? "…"} orders`;
      case "spent_gte":
        return `spent ${r.num === undefined ? "…" : money(r.num)}+`;
      case "country_in":
        return `in ${v || "…"}`;
      case "country_not_in":
        return `not in ${v || "…"}`;
      case "market_in":
        return `market ${v || "…"}`;
    }
  });
  return parts.join(c.match === "all" ? " and " : " or ");
}

export function formatMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency || "USD", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Starter templates (presets the merchant can start from)
// ─────────────────────────────────────────────────────────────

export type BbTemplate = {
  key: string;
  type: BbType;
  design: BbDesign;
  name: string;
  tagline: string;
  patch: (c: BbConfig) => BbConfig;
  texts: Partial<Record<BbTextKey, string>>;
};

export const BB_TEMPLATES: BbTemplate[] = [
  {
    key: "any3",
    type: "mix",
    design: "slots",
    name: "Pick any 3",
    tagline: "Any 3 from a collection, 20% off.",
    patch: (c) => ({ ...c, steps: [{ ...c.steps[0], min: 3, max: 3 }], pricing: { ...c.pricing, mode: "percent", value: 20 } }),
    texts: { title: "Pick any 3 and save 20%", subtitle: "Mix and match your favourites" },
  },
  {
    key: "tiered",
    type: "mix",
    design: "grid",
    name: "The more you pick, the more you save",
    tagline: "2 items 10%, 3 items 15%, 4+ items 20%.",
    patch: (c) => ({
      ...c,
      steps: [{ ...c.steps[0], min: 2, max: 6 }],
      pricing: { ...c.pricing, mode: "tiers", tiers: [{ min: 2, mode: "percent", value: 10 }, { min: 3, mode: "percent", value: 15 }, { min: 4, mode: "percent", value: 20 }] },
    }),
    texts: { title: "Build your set", subtitle: "The more you pick, the more you save", badge: "Up to {save} off" },
  },
  {
    key: "b2g1",
    type: "mix",
    design: "list",
    name: "Buy 2, get 1 free",
    tagline: "The cheapest of 3 items is free.",
    patch: (c) => ({ ...c, steps: [{ ...c.steps[0], min: 3, max: 3 }], pricing: { ...c.pricing, mode: "cheapest", cheapestCount: 1, cheapestPercent: 100 } }),
    texts: { title: "Buy 2, get the 3rd free", subtitle: "The lowest-priced item is on us", badge: "3rd item {save}" },
  },
  {
    key: "routine",
    type: "box",
    design: "stepper",
    name: "Build your routine",
    tagline: "3 steps, one product each, one bundle price.",
    patch: (c) => ({
      ...c,
      steps: [
        { id: newId(), title: "Choose your cleanser", min: 1, max: 1, products: [], collections: [] },
        { id: newId(), title: "Choose your treatment", min: 1, max: 1, products: [], collections: [] },
        { id: newId(), title: "Choose your moisturizer", min: 1, max: 1, products: [], collections: [] },
      ],
      pricing: { ...c.pricing, mode: "percent", value: 15 },
    }),
    texts: { title: "Build your routine", subtitle: "Three steps, 15% off together" },
  },
  {
    key: "giftbox",
    type: "box",
    design: "slots",
    name: "Gift box with a free gift",
    tagline: "Fill the box, the gift card or wrap is free.",
    patch: (c) => ({
      ...c,
      steps: [
        { id: newId(), title: "Pick 2 main gifts", min: 2, max: 2, products: [], collections: [] },
        { id: newId(), title: "Add a little extra", min: 1, max: 2, products: [], collections: [] },
      ],
      pricing: { ...c.pricing, mode: "amount", value: 10 },
      gift: { enabled: true, product: null, minItems: 3 },
    }),
    texts: { title: "Build a gift box", subtitle: "Fill it your way, gift wrap included" },
  },
  {
    key: "complete",
    type: "fixed",
    design: "classic",
    name: "Complete the look",
    tagline: "2–3 set products, one bundle price.",
    patch: (c) => ({ ...c, pricing: { ...c.pricing, mode: "percent", value: 10 } }),
    texts: { title: "Complete the look", subtitle: "Get the full set and save" },
  },
  {
    key: "sixpack",
    type: "multipack",
    design: "tiles",
    name: "Mix your 6-pack",
    tagline: "6 of one product, any variants.",
    patch: (c) => ({ ...c, multipack: { ...c.multipack, min: 6, max: 6 }, pricing: { ...c.pricing, mode: "percent", value: 15 } }),
    texts: { title: "Mix your 6-pack", subtitle: "Choose any 6 flavours" },
  },
];

// ─────────────────────────────────────────────────────────────
// Parsed row
// ─────────────────────────────────────────────────────────────

export type ParsedBundle = {
  id: string;
  name: string;
  type: BbType;
  design: BbDesign;
  enabled: boolean;
  priority: number;
  config: BbConfig;
  placement: BbPlacement;
  conditions: BbConditions;
  style: BbStyle;
  texts: BbTextsByLang;
  updatedAt: string;
};

const safeJson = (s: string | null | undefined) => {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
};

export function parseBundle(row: {
  id: string;
  name: string;
  type: string;
  design: string;
  enabled: boolean;
  priority: number;
  configJson: string;
  placementJson: string;
  conditionsJson: string;
  styleJson: string;
  textsJson: string;
  updatedAt: Date | string;
}): ParsedBundle {
  const type = oneOf(row.type, BB_TYPES, "mix");
  const allowed = BB_TYPE_META[type].designs;
  const design = allowed.includes(row.design as BbDesign) ? (row.design as BbDesign) : allowed[0];
  return {
    id: row.id,
    name: row.name,
    type,
    design,
    enabled: row.enabled,
    priority: row.priority,
    config: sanitizeConfig(safeJson(row.configJson), type),
    placement: sanitizePlacement(safeJson(row.placementJson)),
    conditions: sanitizeConditions(safeJson(row.conditionsJson)),
    style: sanitizeStyle(safeJson(row.styleJson)),
    texts: sanitizeTexts(safeJson(row.textsJson)),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : row.updatedAt.toISOString(),
  };
}

export const numericId = (g: string) => String(g || "").split("/").pop() || "";
