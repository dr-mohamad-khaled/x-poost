/**
 * Kit Builder — shared types, defaults and sanitizers.
 * A kit is built step by step: each step has its own products or collections, optional sub-filters,
 * and can show different products depending on a short quiz. Pricing, customer rules, placement
 * and colors reuse the Bundle Builder types, and the checkout price is validated by the same
 * "XPoost Bundles" Shopify Function (a kit is checked like a step-by-step bundle).
 */
import {
  BB_LANGS,
  BB_PRICE_MODES,
  BB_SAN,
  defaultPlacement,
  sanitizeConditions,
  sanitizePlacement,
  sanitizeStyle,
  BB_DEFAULT_STYLE,
  type BbCollection,
  type BbConditions,
  type BbLang,
  type BbPlacement,
  type BbPricing,
  type BbProduct,
  type BbStyle,
  type BbTier,
} from "./bundles";

const { str, int, dec, date, oneOf, uniqBy } = BB_SAN;

export const KB_DESIGNS = ["journey", "split", "focus"] as const;
export type KbDesign = (typeof KB_DESIGNS)[number];

export const KB_DISPLAYS = ["inline", "drawer", "modal", "page"] as const;
export type KbDisplay = (typeof KB_DISPLAYS)[number];

export type KbPool = { products: BbProduct[]; collections: BbCollection[] };
export type KbFilter = KbPool & { id: string; label: string };
export type KbOption = { id: string; label: string };
export type KbQuestion = { id: string; title: string; options: KbOption[] };

export type KbStep = KbPool & {
  id: string;
  title: string;
  subtitle: string;
  pick: "one" | "many"; // one = moves on after a pick · many = Next button
  min: number;
  max: number;
  filters: KbFilter[];
  /** Different products for each answer of one quiz question (optional) */
  byAnswer: { q: string; pools: Record<string, KbPool> } | null;
  /** Show this step only for some answers (optional) */
  showIf: { q: string; options: string[] } | null;
};

export type KbConfig = {
  steps: KbStep[];
  quiz: { enabled: boolean; questions: KbQuestion[] };
  pricing: BbPricing;
  gift: { enabled: boolean; product: BbProduct | null; minItems: number };
  allowDuplicates: boolean;
  allowMultiples: boolean;
  hideSoldOut: boolean;
  afterAdd: "drawer" | "cart" | "checkout" | "stay";
  display: KbDisplay;
  heroImage: string;
  startsAt: string;
  endsAt: string;
};

export const KB_MAX_KITS = 30;
export const KB_MAX_STEPS = 8;
export const KB_MAX_FILTERS = 8;
export const KB_MAX_QUESTIONS = 4;
export const KB_MAX_OPTIONS = 6;
export const KB_MAX_POOL_PRODUCTS = 60;
export const KB_MAX_POOL_COLLECTIONS = 5;
export const KB_MAX_ITEMS = 12;

export const KB_DESIGN_META: Record<KbDesign, { name: string; blurb: string }> = {
  journey: { name: "Journey", blurb: "Step pills on top, products below and a tray that fills with each pick." },
  split: { name: "Split view", blurb: "Steps listed on the side with your picks, products next to them." },
  focus: { name: "Focus cards", blurb: "One step per screen with large product cards. Made for mobile." },
};

export const KB_DISPLAY_META: Record<KbDisplay, { name: string; blurb: string }> = {
  inline: { name: "On the page", blurb: "The builder sits where you put the block." },
  drawer: { name: "Side drawer", blurb: "A compact card with a button opens the builder from the side." },
  modal: { name: "Pop-up", blurb: "A compact card with a button opens the builder in a pop-up." },
  page: { name: "Landing page", blurb: "A full-width page with its own link, inside your theme." },
};

// ── Texts ──
export const KB_TEXT_KEYS = [
  "title",
  "subtitle",
  "openButton",
  "addButton",
  "lineLabel",
  "badge",
  "quizTitle",
  "quizStart",
  "quizSkip",
  "choose",
  "selected",
  "remove",
  "next",
  "back",
  "skip",
  "optional",
  "stepOf",
  "pickOne",
  "pickExact",
  "pickRange",
  "pickedCount",
  "allFilter",
  "review",
  "reviewTitle",
  "change",
  "startOver",
  "total",
  "saveTag",
  "ready",
  "readyNoSave",
  "needMore",
  "giftOn",
  "giftOff",
  "soldOut",
  "empty",
  "addedMsg",
  "errorMsg",
  "adding",
  "close",
  "freeWord",
] as const;
export type KbTextKey = (typeof KB_TEXT_KEYS)[number];
/** labels: translated names of steps (id), step subtitles (id:s), questions, options and filters (id) */
export type KbTexts = Partial<Record<KbTextKey, string>> & { labels?: Record<string, string> };
export type KbTextsByLang = Partial<Record<BbLang, KbTexts>>;

export const KB_MAIN_TEXTS: KbTextKey[] = ["title", "subtitle", "badge", "openButton", "addButton", "quizTitle", "lineLabel"];

export const KB_TEXT_META: Record<KbTextKey, { label: string; vars?: string }> = {
  title: { label: "Heading" },
  subtitle: { label: "Subheading" },
  openButton: { label: "Open button (drawer / pop-up)" },
  addButton: { label: "Add to cart button" },
  lineLabel: { label: "Cart line label" },
  badge: { label: "Savings badge", vars: "{save}" },
  quizTitle: { label: "Quiz heading" },
  quizStart: { label: "Quiz: see my products button" },
  quizSkip: { label: "Quiz: skip link" },
  choose: { label: "Choose button" },
  selected: { label: "Selected label" },
  remove: { label: "Remove button" },
  next: { label: "Next button" },
  back: { label: "Back button" },
  skip: { label: "Skip step button" },
  optional: { label: "Optional step label" },
  stepOf: { label: "Step counter", vars: "{n} {total}" },
  pickOne: { label: "Step rule (one item)" },
  pickExact: { label: "Step rule (exact)", vars: "{count}" },
  pickRange: { label: "Step rule (range)", vars: "{min} {max}" },
  pickedCount: { label: "Picked counter", vars: "{n} {max}" },
  allFilter: { label: "Filter: all" },
  review: { label: "Review button" },
  reviewTitle: { label: "Review title" },
  change: { label: "Change link" },
  startOver: { label: "Start over link" },
  total: { label: "Total label" },
  saveTag: { label: "Savings tag", vars: "{percent}" },
  ready: { label: "Kit complete (with savings)", vars: "{saved}" },
  readyNoSave: { label: "Kit complete (no savings)" },
  needMore: { label: "Items still needed", vars: "{remaining}" },
  giftOn: { label: "Gift unlocked", vars: "{gift}" },
  giftOff: { label: "Gift locked", vars: "{count} {gift}" },
  soldOut: { label: "Sold out" },
  empty: { label: "No products in this filter" },
  addedMsg: { label: "Added to cart message" },
  errorMsg: { label: "Error message" },
  adding: { label: "Adding… label" },
  close: { label: "Close (screen readers)" },
  freeWord: { label: "Word for free" },
};

type Base = Required<Omit<KbTexts, "labels">>;
const EN: Base = {
  title: "Build your kit",
  subtitle: "Pick one product in each step and save on the set",
  openButton: "Build your kit",
  addButton: "Add kit to cart",
  lineLabel: "Kit",
  badge: "Save {save}",
  quizTitle: "Tell us a little, we'll show the right products",
  quizStart: "Show my products",
  quizSkip: "Skip, show everything",
  choose: "Choose",
  selected: "Selected",
  remove: "Remove",
  next: "Next",
  back: "Back",
  skip: "Skip this step",
  optional: "Optional",
  stepOf: "Step {n} of {total}",
  pickOne: "Pick 1",
  pickExact: "Pick {count}",
  pickRange: "Pick {min} to {max}",
  pickedCount: "{n} of {max} picked",
  allFilter: "All",
  review: "Review my kit",
  reviewTitle: "Your kit",
  change: "Change",
  startOver: "Start over",
  total: "Total",
  saveTag: "−{percent}%",
  ready: "Kit ready. You save {saved}",
  readyNoSave: "Kit ready",
  needMore: "Pick {remaining} more",
  giftOn: "Free gift included: {gift}",
  giftOff: "Pick {count} items to get {gift} free",
  soldOut: "Sold out",
  empty: "No products here yet",
  addedMsg: "Added to your cart",
  errorMsg: "Couldn't add the kit. Please try again.",
  adding: "Adding…",
  close: "Close",
  freeWord: "FREE",
};

export const KB_DEFAULT_TEXTS: Record<BbLang, Base> = {
  en: EN,
  ar: {
    title: "كوّن طقمك",
    subtitle: "اختر منتجًا في كل خطوة ووفّر على الطقم كاملًا",
    openButton: "كوّن طقمك",
    addButton: "أضف الطقم إلى السلة",
    lineLabel: "طقم",
    badge: "وفّر {save}",
    quizTitle: "أجب عن أسئلة قليلة وسنعرض لك المنتجات المناسبة",
    quizStart: "اعرض منتجاتي",
    quizSkip: "تخطَّ واعرض الكل",
    choose: "اختر",
    selected: "تم الاختيار",
    remove: "إزالة",
    next: "التالي",
    back: "رجوع",
    skip: "تخطَّ هذه الخطوة",
    optional: "اختياري",
    stepOf: "الخطوة {n} من {total}",
    pickOne: "اختر 1",
    pickExact: "اختر {count}",
    pickRange: "اختر من {min} إلى {max}",
    pickedCount: "تم اختيار {n} من {max}",
    allFilter: "الكل",
    review: "راجع طقمك",
    reviewTitle: "طقمك",
    change: "تغيير",
    startOver: "ابدأ من جديد",
    total: "الإجمالي",
    saveTag: "−{percent}%",
    ready: "الطقم جاهز. وفّرت {saved}",
    readyNoSave: "الطقم جاهز",
    needMore: "اختر {remaining} أخرى",
    giftOn: "هدية مجانية مضافة: {gift}",
    giftOff: "اختر {count} منتجات لتحصل على {gift} مجانًا",
    soldOut: "نفدت الكمية",
    empty: "لا توجد منتجات هنا بعد",
    addedMsg: "تمت الإضافة إلى سلتك",
    errorMsg: "تعذّرت إضافة الطقم. حاول مرة أخرى.",
    adding: "جارٍ الإضافة…",
    close: "إغلاق",
    freeWord: "مجانًا",
  },
  fr: {
    title: "Composez votre kit",
    subtitle: "Choisissez un produit à chaque étape et économisez sur l'ensemble",
    openButton: "Composer mon kit",
    addButton: "Ajouter le kit au panier",
    lineLabel: "Kit",
    badge: "Économisez {save}",
    quizTitle: "Répondez à quelques questions, nous afficherons les bons produits",
    quizStart: "Voir mes produits",
    quizSkip: "Passer, tout afficher",
    choose: "Choisir",
    selected: "Sélectionné",
    remove: "Retirer",
    next: "Suivant",
    back: "Retour",
    skip: "Passer cette étape",
    optional: "Facultatif",
    stepOf: "Étape {n} sur {total}",
    pickOne: "Choisissez 1",
    pickExact: "Choisissez {count}",
    pickRange: "Choisissez de {min} à {max}",
    pickedCount: "{n} sur {max} choisis",
    allFilter: "Tous",
    review: "Voir mon kit",
    reviewTitle: "Votre kit",
    change: "Modifier",
    startOver: "Recommencer",
    total: "Total",
    saveTag: "−{percent} %",
    ready: "Kit prêt. Vous économisez {saved}",
    readyNoSave: "Kit prêt",
    needMore: "Encore {remaining} à choisir",
    giftOn: "Cadeau offert inclus : {gift}",
    giftOff: "Choisissez {count} articles pour recevoir {gift} gratuitement",
    soldOut: "Épuisé",
    empty: "Aucun produit ici pour le moment",
    addedMsg: "Ajouté à votre panier",
    errorMsg: "Impossible d'ajouter le kit. Veuillez réessayer.",
    adding: "Ajout…",
    close: "Fermer",
    freeWord: "GRATUIT",
  },
  de: {
    title: "Stellen Sie Ihr Set zusammen",
    subtitle: "Wählen Sie in jedem Schritt ein Produkt und sparen Sie beim Set",
    openButton: "Set zusammenstellen",
    addButton: "Set in den Warenkorb",
    lineLabel: "Set",
    badge: "Spare {save}",
    quizTitle: "Ein paar Fragen, dann zeigen wir die passenden Produkte",
    quizStart: "Meine Produkte zeigen",
    quizSkip: "Überspringen, alles zeigen",
    choose: "Auswählen",
    selected: "Ausgewählt",
    remove: "Entfernen",
    next: "Weiter",
    back: "Zurück",
    skip: "Schritt überspringen",
    optional: "Optional",
    stepOf: "Schritt {n} von {total}",
    pickOne: "Wähle 1",
    pickExact: "Wähle {count}",
    pickRange: "Wähle {min} bis {max}",
    pickedCount: "{n} von {max} gewählt",
    allFilter: "Alle",
    review: "Mein Set ansehen",
    reviewTitle: "Ihr Set",
    change: "Ändern",
    startOver: "Neu beginnen",
    total: "Gesamt",
    saveTag: "−{percent} %",
    ready: "Set fertig. Sie sparen {saved}",
    readyNoSave: "Set fertig",
    needMore: "Noch {remaining} wählen",
    giftOn: "Gratisgeschenk dabei: {gift}",
    giftOff: "Wählen Sie {count} Artikel und erhalten Sie {gift} gratis",
    soldOut: "Ausverkauft",
    empty: "Hier sind noch keine Produkte",
    addedMsg: "In den Warenkorb gelegt",
    errorMsg: "Das Set konnte nicht hinzugefügt werden. Bitte erneut versuchen.",
    adding: "Wird hinzugefügt…",
    close: "Schließen",
    freeWord: "GRATIS",
  },
  es: {
    title: "Arma tu kit",
    subtitle: "Elige un producto en cada paso y ahorra en el conjunto",
    openButton: "Armar mi kit",
    addButton: "Añadir kit al carrito",
    lineLabel: "Kit",
    badge: "Ahorra {save}",
    quizTitle: "Responde unas preguntas y te mostramos los productos adecuados",
    quizStart: "Ver mis productos",
    quizSkip: "Saltar y ver todo",
    choose: "Elegir",
    selected: "Elegido",
    remove: "Quitar",
    next: "Siguiente",
    back: "Atrás",
    skip: "Saltar este paso",
    optional: "Opcional",
    stepOf: "Paso {n} de {total}",
    pickOne: "Elige 1",
    pickExact: "Elige {count}",
    pickRange: "Elige de {min} a {max}",
    pickedCount: "{n} de {max} elegidos",
    allFilter: "Todos",
    review: "Revisar mi kit",
    reviewTitle: "Tu kit",
    change: "Cambiar",
    startOver: "Empezar de nuevo",
    total: "Total",
    saveTag: "−{percent}%",
    ready: "Kit listo. Ahorras {saved}",
    readyNoSave: "Kit listo",
    needMore: "Elige {remaining} más",
    giftOn: "Regalo incluido: {gift}",
    giftOff: "Elige {count} artículos y llévate {gift} gratis",
    soldOut: "Agotado",
    empty: "Aún no hay productos aquí",
    addedMsg: "Añadido a tu carrito",
    errorMsg: "No se pudo añadir el kit. Inténtalo de nuevo.",
    adding: "Añadiendo…",
    close: "Cerrar",
    freeWord: "GRATIS",
  },
  it: {
    title: "Crea il tuo kit",
    subtitle: "Scegli un prodotto per ogni passaggio e risparmia sul set",
    openButton: "Crea il mio kit",
    addButton: "Aggiungi il kit al carrello",
    lineLabel: "Kit",
    badge: "Risparmia {save}",
    quizTitle: "Rispondi a poche domande, ti mostriamo i prodotti giusti",
    quizStart: "Mostra i miei prodotti",
    quizSkip: "Salta, mostra tutto",
    choose: "Scegli",
    selected: "Scelto",
    remove: "Rimuovi",
    next: "Avanti",
    back: "Indietro",
    skip: "Salta questo passaggio",
    optional: "Facoltativo",
    stepOf: "Passaggio {n} di {total}",
    pickOne: "Scegline 1",
    pickExact: "Scegline {count}",
    pickRange: "Scegline da {min} a {max}",
    pickedCount: "{n} di {max} scelti",
    allFilter: "Tutti",
    review: "Rivedi il mio kit",
    reviewTitle: "Il tuo kit",
    change: "Cambia",
    startOver: "Ricomincia",
    total: "Totale",
    saveTag: "−{percent}%",
    ready: "Kit pronto. Risparmi {saved}",
    readyNoSave: "Kit pronto",
    needMore: "Scegline altri {remaining}",
    giftOn: "Regalo incluso: {gift}",
    giftOff: "Scegli {count} articoli per avere {gift} in regalo",
    soldOut: "Esaurito",
    empty: "Ancora nessun prodotto qui",
    addedMsg: "Aggiunto al carrello",
    errorMsg: "Impossibile aggiungere il kit. Riprova.",
    adding: "Aggiunta…",
    close: "Chiudi",
    freeWord: "GRATIS",
  },
  pt: {
    title: "Monte seu kit",
    subtitle: "Escolha um produto em cada etapa e economize no conjunto",
    openButton: "Montar meu kit",
    addButton: "Adicionar kit ao carrinho",
    lineLabel: "Kit",
    badge: "Economize {save}",
    quizTitle: "Responda algumas perguntas e mostramos os produtos certos",
    quizStart: "Ver meus produtos",
    quizSkip: "Pular e ver tudo",
    choose: "Escolher",
    selected: "Escolhido",
    remove: "Remover",
    next: "Próximo",
    back: "Voltar",
    skip: "Pular esta etapa",
    optional: "Opcional",
    stepOf: "Etapa {n} de {total}",
    pickOne: "Escolha 1",
    pickExact: "Escolha {count}",
    pickRange: "Escolha de {min} a {max}",
    pickedCount: "{n} de {max} escolhidos",
    allFilter: "Todos",
    review: "Revisar meu kit",
    reviewTitle: "Seu kit",
    change: "Trocar",
    startOver: "Recomeçar",
    total: "Total",
    saveTag: "−{percent}%",
    ready: "Kit pronto. Você economiza {saved}",
    readyNoSave: "Kit pronto",
    needMore: "Escolha mais {remaining}",
    giftOn: "Brinde incluído: {gift}",
    giftOff: "Escolha {count} itens e ganhe {gift}",
    soldOut: "Esgotado",
    empty: "Ainda não há produtos aqui",
    addedMsg: "Adicionado ao seu carrinho",
    errorMsg: "Não foi possível adicionar o kit. Tente novamente.",
    adding: "Adicionando…",
    close: "Fechar",
    freeWord: "GRÁTIS",
  },
};

// ── Defaults ──
export const newKbId = () => Math.random().toString(36).slice(2, 10);

export function newStep(title = "", pick: "one" | "many" = "one"): KbStep {
  return { id: newKbId(), title, subtitle: "", pick, min: 1, max: pick === "one" ? 1 : 3, products: [], collections: [], filters: [], byAnswer: null, showIf: null };
}

export function defaultKbConfig(): KbConfig {
  return {
    steps: [newStep("Step 1"), newStep("Step 2"), newStep("Step 3")],
    quiz: { enabled: false, questions: [] },
    pricing: { mode: "percent", value: 15, tiers: [], cheapestCount: 1, cheapestPercent: 100 },
    gift: { enabled: false, product: null, minItems: 3 },
    allowDuplicates: false,
    allowMultiples: true,
    hideSoldOut: false,
    afterAdd: "drawer",
    display: "inline",
    heroImage: "",
    startsAt: "",
    endsAt: "",
  };
}

export const KB_DEFAULT_STYLE: BbStyle = { ...BB_DEFAULT_STYLE, columns: 3 };

// ── Sanitizers ──
const kid = (v: unknown) => (/^[a-z0-9]{4,12}$/.test(String(v || "")) ? String(v) : newKbId());

function pool(raw: any): KbPool {
  return {
    products: uniqBy((Array.isArray(raw?.products) ? raw.products : []).map(BB_SAN.product).filter(Boolean) as BbProduct[], (p) => p.id).slice(0, KB_MAX_POOL_PRODUCTS),
    collections: uniqBy((Array.isArray(raw?.collections) ? raw.collections : []).map(BB_SAN.collection).filter(Boolean) as BbCollection[], (c) => c.id).slice(0, KB_MAX_POOL_COLLECTIONS),
  };
}
export const poolSize = (p: KbPool) => p.products.length + p.collections.length;

export function sanitizeKbConfig(raw: any): KbConfig {
  const d = defaultKbConfig();
  const r = raw && typeof raw === "object" ? raw : {};

  const questions: KbQuestion[] = uniqBy(
    (Array.isArray(r.quiz?.questions) ? r.quiz.questions : []).slice(0, KB_MAX_QUESTIONS).map((q: any) => ({
      id: kid(q?.id),
      title: str(q?.title, 140),
      options: uniqBy(
        (Array.isArray(q?.options) ? q.options : []).slice(0, KB_MAX_OPTIONS).map((o: any) => ({ id: kid(o?.id), label: str(o?.label, 60) })),
        (o: KbOption) => o.id,
      ),
    })),
    (q: KbQuestion) => q.id,
  );
  const qById = new Map(questions.map((q) => [q.id, q]));

  const steps: KbStep[] = (Array.isArray(r.steps) ? r.steps : d.steps).slice(0, KB_MAX_STEPS).map((s: any) => {
    const pick = s?.pick === "many" ? "many" : "one";
    const max = pick === "one" ? 1 : int(s?.max, 1, KB_MAX_ITEMS, 3);
    const min = pick === "one" ? int(s?.min, 0, 1, 1) : int(s?.min, 0, max, Math.min(max, 1));
    const base = pool(s);
    const filters: KbFilter[] = uniqBy(
      (Array.isArray(s?.filters) ? s.filters : []).slice(0, KB_MAX_FILTERS).map((f: any) => ({ id: kid(f?.id), label: str(f?.label, 40), ...pool(f) })),
      (f: KbFilter) => f.id,
    );
    let byAnswer: KbStep["byAnswer"] = null;
    const bq = qById.get(String(s?.byAnswer?.q || ""));
    if (bq) {
      const pools: Record<string, KbPool> = {};
      for (const o of bq.options) {
        const p = pool(s.byAnswer?.pools?.[o.id]);
        if (poolSize(p)) pools[o.id] = p;
      }
      byAnswer = { q: bq.id, pools };
    }
    let showIf: KbStep["showIf"] = null;
    const sq = qById.get(String(s?.showIf?.q || ""));
    if (sq) {
      const allowed = new Set(sq.options.map((o) => o.id));
      const opts = (Array.isArray(s.showIf?.options) ? s.showIf.options : []).map(String).filter((x: string) => allowed.has(x));
      if (opts.length) showIf = { q: sq.id, options: [...new Set(opts)] as string[] };
    }
    return { id: kid(s?.id), title: str(s?.title, 80), subtitle: str(s?.subtitle, 140), pick, min, max, ...base, filters, byAnswer, showIf };
  });
  if (!steps.length) steps.push(...d.steps);
  if (steps.every((s) => s.min === 0)) steps[0].min = 1;

  const pr = r.pricing || {};
  const mode = oneOf(pr.mode, BB_PRICE_MODES, "percent");
  const pricing: BbPricing = {
    mode,
    value: mode === "percent" ? dec(pr.value, 0, 100, 15) : dec(pr.value, 0, 1_000_000, 0),
    tiers: uniqBy(
      (Array.isArray(pr.tiers) ? pr.tiers : [])
        .map((t: any) => {
          const m = oneOf(t?.mode, ["percent", "amount", "price"] as const, "percent");
          return { min: int(t?.min, 1, 99, 2), mode: m, value: m === "percent" ? dec(t?.value, 0, 100, 10) : dec(t?.value, 0, 1_000_000, 0) };
        })
        .filter((t: BbTier) => t.value > 0 || t.mode === "price")
        .slice(0, 6)
        .sort((a: BbTier, b: BbTier) => a.min - b.min),
      (t: BbTier) => String(t.min),
    ),
    cheapestCount: int(pr.cheapestCount, 1, 10, 1),
    cheapestPercent: dec(pr.cheapestPercent, 1, 100, 100),
  };

  const hero = str(r.heroImage, 1000).trim();
  return {
    steps,
    quiz: { enabled: !!r.quiz?.enabled && questions.length > 0, questions },
    pricing,
    gift: { enabled: !!r.gift?.enabled, product: BB_SAN.product(r.gift?.product), minItems: int(r.gift?.minItems, 1, 24, 3) },
    allowDuplicates: !!r.allowDuplicates,
    allowMultiples: r.allowMultiples === undefined ? d.allowMultiples : !!r.allowMultiples,
    hideSoldOut: !!r.hideSoldOut,
    afterAdd: oneOf(r.afterAdd, ["drawer", "cart", "checkout", "stay"] as const, "drawer"),
    display: oneOf(r.display, KB_DISPLAYS, "inline"),
    heroImage: /^https:\/\/[^\s"'<>]+$/.test(hero) ? hero : "",
    startsAt: date(r.startsAt),
    endsAt: date(r.endsAt),
  };
}

export function sanitizeKbTexts(raw: any): KbTextsByLang {
  const out: KbTextsByLang = {};
  const r = raw && typeof raw === "object" ? raw : {};
  for (const lang of BB_LANGS) {
    const src = r[lang];
    if (!src || typeof src !== "object") continue;
    const t: KbTexts = {};
    for (const k of KB_TEXT_KEYS) {
      const v = String(src[k] ?? "").trim();
      if (v) t[k] = v.slice(0, 200);
    }
    if (src.labels && typeof src.labels === "object") {
      const labels: Record<string, string> = {};
      for (const [id, v] of Object.entries(src.labels)) if (/^[a-z0-9]{4,12}(:s)?$/.test(id) && String(v || "").trim()) labels[id] = String(v).trim().slice(0, 140);
      if (Object.keys(labels).length) t.labels = labels;
    }
    if (Object.keys(t).length) out[lang] = t;
  }
  return out;
}

export function resolveKbTexts(texts: KbTextsByLang, lang: string): Base & { labels: Record<string, string> } {
  const l = (BB_LANGS as readonly string[]).includes(lang) ? (lang as BbLang) : "en";
  const base = KB_DEFAULT_TEXTS[l];
  const own = texts[l] || {};
  const en = texts.en || {};
  const out: any = {};
  for (const k of KB_TEXT_KEYS) out[k] = own[k] || (KB_MAIN_TEXTS.includes(k) && l !== "en" && en[k] && !texts[l] ? en[k] : base[k]);
  out.labels = { ...(en.labels || {}), ...(own.labels || {}) };
  return out;
}

export function validateKit(c: KbConfig): string[] {
  const errs: string[] = [];
  c.steps.forEach((s, i) => {
    const n = poolSize(s) + Object.values(s.byAnswer?.pools || {}).reduce((a, p) => a + poolSize(p), 0);
    if (!n) errs.push(`Step ${i + 1} has no products or collections.`);
    else if (!c.allowDuplicates && s.collections.length === 0 && !s.byAnswer && s.products.length < s.min) errs.push(`Step ${i + 1} needs at least ${s.min} different products to choose from.`);
    s.filters.forEach((f, k) => {
      if (!f.label.trim()) errs.push(`Step ${i + 1}: filter ${k + 1} needs a name.`);
      else if (!poolSize(f)) errs.push(`Step ${i + 1}: the filter “${f.label}” has no products or collection.`);
    });
  });
  if (c.quiz.enabled) {
    c.quiz.questions.forEach((q, i) => {
      if (!q.title.trim()) errs.push(`Question ${i + 1} needs a text.`);
      if (q.options.filter((o) => o.label.trim()).length < 2) errs.push(`Question ${i + 1} needs at least 2 answers.`);
    });
  }
  if (c.pricing.mode === "tiers" && !c.pricing.tiers.length) errs.push("Add at least one tier, or choose another discount type.");
  if (c.pricing.mode === "percent" && !(c.pricing.value > 0)) errs.push("Enter a percentage above 0, or choose “No discount”.");
  if ((c.pricing.mode === "amount" || c.pricing.mode === "price") && !(c.pricing.value > 0)) errs.push("Enter an amount above 0.");
  if (c.gift.enabled && !c.gift.product) errs.push("Pick the free gift product, or turn the gift off.");
  if (c.startsAt && c.endsAt && c.endsAt < c.startsAt) errs.push("The end date is before the start date.");
  return errs;
}

export function kitSize(c: KbConfig) {
  return { min: c.steps.reduce((a, s) => a + (s.showIf ? 0 : s.min), 0), max: c.steps.reduce((a, s) => a + s.max, 0) };
}

/** Every product and collection a step can show (default pool, filters, answer pools). */
export function stepUnion(s: KbStep): KbPool {
  const products = new Map<string, BbProduct>();
  const collections = new Map<string, BbCollection>();
  const add = (p: KbPool) => {
    for (const x of p.products) products.set(x.id, x);
    for (const x of p.collections) collections.set(x.id, x);
  };
  add(s);
  s.filters.forEach(add);
  Object.values(s.byAnswer?.pools || {}).forEach(add);
  return { products: [...products.values()], collections: [...collections.values()] };
}

// ── Templates ──
export type KbTemplate = { key: string; name: string; tagline: string; build: () => Pick<KbConfig, "steps" | "quiz" | "pricing"> & { design: KbDesign; title: string; subtitle: string } };

const q = (title: string, labels: string[]): KbQuestion => ({ id: newKbId(), title, options: labels.map((label) => ({ id: newKbId(), label })) });

export const KB_TEMPLATES: KbTemplate[] = [
  {
    key: "routine",
    name: "3-step routine",
    tagline: "Cleanser, treatment, moisturizer. One pick each, 15% off.",
    build: () => ({
      design: "journey",
      title: "Build your routine",
      subtitle: "Three steps, 15% off together",
      steps: [newStep("Choose your cleanser"), newStep("Choose your treatment"), newStep("Choose your moisturizer")],
      quiz: { enabled: false, questions: [] },
      pricing: { mode: "percent", value: 15, tiers: [], cheapestCount: 1, cheapestPercent: 100 },
    }),
  },
  {
    key: "quiz",
    name: "Quiz first, then the kit",
    tagline: "One question changes the products in every step.",
    build: () => {
      const question = q("What is your skin type?", ["Oily", "Dry", "Sensitive"]);
      const steps = [newStep("Cleanser"), newStep("Serum"), newStep("Moisturizer")].map((s) => ({ ...s, byAnswer: { q: question.id, pools: {} } }));
      return {
        design: "focus",
        title: "Find your routine",
        subtitle: "Answer one question and we'll match each step to you",
        steps,
        quiz: { enabled: true, questions: [question] },
        pricing: { mode: "percent", value: 15, tiers: [], cheapestCount: 1, cheapestPercent: 100 },
      };
    },
  },
  {
    key: "outfit",
    name: "Complete the outfit",
    tagline: "Top, bottom, shoes, and an optional accessory.",
    build: () => {
      const acc = { ...newStep("Add an accessory"), min: 0 };
      return {
        design: "split",
        title: "Build your outfit",
        subtitle: "Pick a piece in each step, save on the full look",
        steps: [newStep("Pick a top"), newStep("Pick a bottom"), newStep("Pick your shoes"), acc],
        quiz: { enabled: false, questions: [] },
        pricing: { mode: "tiers", value: 0, tiers: [{ min: 3, mode: "percent", value: 10 }, { min: 4, mode: "percent", value: 15 }], cheapestCount: 1, cheapestPercent: 100 },
      };
    },
  },
  {
    key: "setup",
    name: "Build your setup",
    tagline: "Main item, then several add-ons with a Next button.",
    build: () => ({
      design: "journey",
      title: "Build your setup",
      subtitle: "Start with the main piece, then add what you need",
      steps: [newStep("Choose the main item"), { ...newStep("Add accessories", "many"), min: 1, max: 4 }, { ...newStep("Protect it", "one"), min: 0 }],
      quiz: { enabled: false, questions: [] },
      pricing: { mode: "tiers", value: 0, tiers: [{ min: 2, mode: "percent", value: 5 }, { min: 3, mode: "percent", value: 10 }, { min: 5, mode: "percent", value: 15 }], cheapestCount: 1, cheapestPercent: 100 },
    }),
  },
  {
    key: "gift",
    name: "Gift box with sub-filters",
    tagline: "Steps with filters like For him / For her.",
    build: () => {
      const s1 = { ...newStep("Pick the main gift"), filters: [{ id: newKbId(), label: "For her", products: [], collections: [] }, { id: newKbId(), label: "For him", products: [], collections: [] }] };
      return {
        design: "journey",
        title: "Build a gift box",
        subtitle: "Pick the gift, add the extras, we wrap it",
        steps: [s1, { ...newStep("Add the extras", "many"), min: 1, max: 3 }, newStep("Choose the card")],
        quiz: { enabled: false, questions: [] },
        pricing: { mode: "amount", value: 10, tiers: [], cheapestCount: 1, cheapestPercent: 100 },
      };
    },
  },
];

// ── Parsed row ──
export type ParsedKit = {
  id: string;
  name: string;
  design: KbDesign;
  enabled: boolean;
  priority: number;
  config: KbConfig;
  placement: BbPlacement;
  conditions: BbConditions;
  style: BbStyle;
  texts: KbTextsByLang;
  updatedAt: string;
};

const safeJson = (s: string | null | undefined) => {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
};

export function parseKit(row: {
  id: string;
  name: string;
  design: string;
  enabled: boolean;
  priority: number;
  configJson: string;
  placementJson: string;
  conditionsJson: string;
  styleJson: string;
  textsJson: string;
  updatedAt: Date | string;
}): ParsedKit {
  return {
    id: row.id,
    name: row.name,
    design: oneOf(row.design, KB_DESIGNS, "journey"),
    enabled: row.enabled,
    priority: row.priority,
    config: sanitizeKbConfig(safeJson(row.configJson)),
    placement: sanitizePlacement(safeJson(row.placementJson)),
    conditions: sanitizeConditions(safeJson(row.conditionsJson)),
    style: sanitizeStyle(safeJson(row.styleJson)),
    texts: sanitizeKbTexts(safeJson(row.textsJson)),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : row.updatedAt.toISOString(),
  };
}

export { defaultPlacement };
