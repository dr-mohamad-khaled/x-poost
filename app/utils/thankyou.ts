/**
 * XPoost Thank-you page upsell — shared, dependency-free module.
 * Used by the admin editor, the checkout API and the tests.
 *
 * Three offer kinds:
 *  - reward        a unique, expiring code (or gift card) for the customer's NEXT order
 *  - addon         1–4 products shown on the thank-you page, opened as a new prefilled checkout with a benefit
 *  - shiptogether  same as addon, but with a real countdown: add items within the window and they ship together
 */

// ─────────────────────────────────────────────────────────────
// Languages
// ─────────────────────────────────────────────────────────────

export const TY_LANGS = ["en", "ar", "fr", "de", "es", "it", "pt"] as const;
export type TyLang = (typeof TY_LANGS)[number];

export const TY_LANG_META: Record<TyLang, { label: string; native: string; dir: "ltr" | "rtl" }> = {
  en: { label: "English", native: "English", dir: "ltr" },
  ar: { label: "Arabic", native: "العربية", dir: "rtl" },
  fr: { label: "French", native: "Français", dir: "ltr" },
  de: { label: "German", native: "Deutsch", dir: "ltr" },
  es: { label: "Spanish", native: "Español", dir: "ltr" },
  it: { label: "Italian", native: "Italiano", dir: "ltr" },
  pt: { label: "Portuguese", native: "Português", dir: "ltr" },
};

// ─────────────────────────────────────────────────────────────
// Kinds, designs
// ─────────────────────────────────────────────────────────────

export const TY_KINDS = ["reward", "addon", "shiptogether"] as const;
export type TyKind = (typeof TY_KINDS)[number];

export const TY_KIND_META: Record<TyKind, { name: string; blurb: string }> = {
  reward: {
    name: "Next-order reward",
    blurb: "Give a unique, expiring discount code (or gift card) to use on the next order. Brings customers back.",
  },
  addon: {
    name: "Add-on products",
    blurb: "Show 1–4 products. One tap opens a prefilled checkout with a discount or free shipping.",
  },
  shiptogether: {
    name: "Ship-together countdown",
    blurb: "“Add items within the time limit and they ship in one box, with no extra shipping.” Enforced by a real expiring code.",
  },
};

export const TY_DESIGNS = ["gift_reveal", "vip_ladder", "ship_timer", "routine", "spotlight", "minimal"] as const;
export type TyDesign = (typeof TY_DESIGNS)[number];

export const TY_DESIGN_META: Record<TyDesign, { name: string; blurb: string; kinds: TyKind[]; minProducts: number; maxProducts: number }> = {
  gift_reveal: {
    name: "Gift Reveal",
    blurb: "A tap-to-reveal gift card with your code, a copy button and the expiry date.",
    kinds: ["reward"],
    minProducts: 0,
    maxProducts: 0,
  },
  vip_ladder: {
    name: "VIP Ladder",
    blurb: "Up to 3 reward steps: spend more on the next order, unlock a bigger reward.",
    kinds: ["reward"],
    minProducts: 0,
    maxProducts: 0,
  },
  ship_timer: {
    name: "Ship-Together Timer",
    blurb: "A large live countdown, the benefit line, then product rows with one-tap add.",
    kinds: ["shiptogether", "addon"],
    minProducts: 1,
    maxProducts: 3,
  },
  routine: {
    name: "Complete the Routine",
    blurb: "A 2–4 product grid with a total and a single “add all” button. Offers with 3+ products convert about twice as well.",
    kinds: ["addon", "shiptogether"],
    minProducts: 2,
    maxProducts: 4,
  },
  spotlight: {
    name: "Spotlight",
    blurb: "One hero product with a large image, benefit points and one big button.",
    kinds: ["addon", "shiptogether"],
    minProducts: 1,
    maxProducts: 1,
  },
  minimal: {
    name: "Minimal",
    blurb: "A quiet single banner with one line and one button, for stores that want a clean thank-you page.",
    kinds: ["reward", "addon", "shiptogether"],
    minProducts: 0,
    maxProducts: 3,
  },
};

export function designsForKind(kind: TyKind): TyDesign[] {
  return TY_DESIGNS.filter((d) => TY_DESIGN_META[d].kinds.includes(kind));
}

// ─────────────────────────────────────────────────────────────
// Editable texts (+ translations)
// ─────────────────────────────────────────────────────────────

export const TY_PLACEHOLDERS = [
  { key: "{first_name}", hint: "Customer first name" },
  { key: "{order_number}", hint: "Order number, e.g. #1042" },
  { key: "{code}", hint: "The unique code" },
  { key: "{discount}", hint: "The benefit, e.g. 15% off" },
  { key: "{time_left}", hint: "Live countdown, e.g. 09:41" },
  { key: "{minutes}", hint: "Window length in minutes" },
  { key: "{min_spend}", hint: "Minimum spend for the reward" },
  { key: "{expires}", hint: "Expiry date" },
  { key: "{shop}", hint: "Your store name" },
] as const;

export type TyTexts = {
  eyebrow: string;
  headline: string;
  subheadline: string;
  benefitLine: string;
  timerLabel: string;
  timerExpired: string;
  productCta: string;
  bundleCta: string;
  savingsBadge: string;
  freeShippingBadge: string;
  codeLabel: string;
  revealLabel: string;
  applyNote: string;
  validUntil: string;
  minSpendNote: string;
  tierLabel: string;
  shopCta: string;
  footnote: string;
};

export const TY_TEXT_FIELDS: { key: keyof TyTexts; label: string; multiline?: boolean; kinds?: TyKind[]; hint?: string }[] = [
  { key: "eyebrow", label: "Small label above the headline" },
  { key: "headline", label: "Headline" },
  { key: "subheadline", label: "Sub-headline", multiline: true },
  { key: "benefitLine", label: "Benefit line", multiline: true, hint: "Shown under the headline, e.g. the free shipping promise." },
  { key: "timerLabel", label: "Timer label", kinds: ["shiptogether"] },
  { key: "timerExpired", label: "Text when the timer ends", kinds: ["shiptogether"], multiline: true },
  { key: "productCta", label: "Button on each product", kinds: ["addon", "shiptogether"] },
  { key: "bundleCta", label: "“Add all” / main button", kinds: ["addon", "shiptogether"] },
  { key: "savingsBadge", label: "Savings badge", kinds: ["addon", "shiptogether"] },
  { key: "freeShippingBadge", label: "Free-shipping badge", kinds: ["addon", "shiptogether"] },
  { key: "codeLabel", label: "Code label", kinds: ["reward"] },
  { key: "revealLabel", label: "Reveal prompt", kinds: ["reward"] },
  { key: "applyNote", label: "Note under the code", kinds: ["reward"], hint: "Tell customers the button applies the code for them." },
  { key: "validUntil", label: "Expiry line", kinds: ["reward"] },
  { key: "minSpendNote", label: "Minimum-spend line", kinds: ["reward"] },
  { key: "tierLabel", label: "Ladder step label", kinds: ["reward"] },
  { key: "shopCta", label: "“Keep shopping” button", kinds: ["reward"] },
  { key: "footnote", label: "Fine print", multiline: true },
];

type Common = Pick<
  TyTexts,
  | "timerLabel"
  | "timerExpired"
  | "productCta"
  | "bundleCta"
  | "savingsBadge"
  | "freeShippingBadge"
  | "codeLabel"
  | "revealLabel"
  | "applyNote"
  | "validUntil"
  | "minSpendNote"
  | "tierLabel"
  | "shopCta"
>;
type KindTexts = Pick<TyTexts, "eyebrow" | "headline" | "subheadline" | "benefitLine" | "footnote">;

const COMMON: Record<TyLang, Common> = {
  en: {
    timerLabel: "Offer ends in",
    timerExpired: "This offer has ended. Your order is on its way as planned.",
    productCta: "Add to my shipment",
    bundleCta: "Add all to my shipment",
    savingsBadge: "{discount}",
    freeShippingBadge: "Free shipping",
    codeLabel: "Your code",
    revealLabel: "Tap to reveal your gift",
    applyNote: "The button applies it automatically on your next visit.",
    validUntil: "Valid until {expires}",
    minSpendNote: "On orders over {min_spend}",
    tierLabel: "Spend {min_spend}, get {discount}",
    shopCta: "Use it on my next order",
  },
  ar: {
    timerLabel: "ينتهي العرض خلال",
    timerExpired: "انتهى هذا العرض. طلبك في طريقه إليك كما هو مخطط.",
    productCta: "أضف إلى شحنتي",
    bundleCta: "أضف الكل إلى شحنتي",
    savingsBadge: "{discount}",
    freeShippingBadge: "شحن مجاني",
    codeLabel: "كودك",
    revealLabel: "اضغط لكشف هديتك",
    applyNote: "الزر يطبّق الكود تلقائياً في زيارتك القادمة.",
    validUntil: "صالح حتى {expires}",
    minSpendNote: "على الطلبات التي تزيد عن {min_spend}",
    tierLabel: "أنفق {min_spend} واحصل على {discount}",
    shopCta: "استخدمه في طلبي القادم",
  },
  fr: {
    timerLabel: "L'offre se termine dans",
    timerExpired: "Cette offre est terminée. Votre commande suit son cours.",
    productCta: "Ajouter à mon envoi",
    bundleCta: "Tout ajouter à mon envoi",
    savingsBadge: "{discount}",
    freeShippingBadge: "Livraison offerte",
    codeLabel: "Votre code",
    revealLabel: "Touchez pour révéler votre cadeau",
    applyNote: "Le bouton l'applique automatiquement lors de votre prochaine visite.",
    validUntil: "Valable jusqu'au {expires}",
    minSpendNote: "Dès {min_spend} d'achat",
    tierLabel: "Dépensez {min_spend}, obtenez {discount}",
    shopCta: "L'utiliser pour ma prochaine commande",
  },
  de: {
    timerLabel: "Angebot endet in",
    timerExpired: "Dieses Angebot ist abgelaufen. Ihre Bestellung ist wie geplant unterwegs.",
    productCta: "Zu meiner Sendung hinzufügen",
    bundleCta: "Alles zu meiner Sendung hinzufügen",
    savingsBadge: "{discount}",
    freeShippingBadge: "Gratisversand",
    codeLabel: "Ihr Code",
    revealLabel: "Tippen, um Ihr Geschenk zu enthüllen",
    applyNote: "Der Button wendet ihn bei Ihrem nächsten Besuch automatisch an.",
    validUntil: "Gültig bis {expires}",
    minSpendNote: "Ab einem Bestellwert von {min_spend}",
    tierLabel: "{min_spend} ausgeben, {discount} erhalten",
    shopCta: "Für meine nächste Bestellung nutzen",
  },
  es: {
    timerLabel: "La oferta termina en",
    timerExpired: "Esta oferta ha terminado. Tu pedido sigue su camino como estaba previsto.",
    productCta: "Añadir a mi envío",
    bundleCta: "Añadir todo a mi envío",
    savingsBadge: "{discount}",
    freeShippingBadge: "Envío gratis",
    codeLabel: "Tu código",
    revealLabel: "Toca para descubrir tu regalo",
    applyNote: "El botón lo aplica automáticamente en tu próxima visita.",
    validUntil: "Válido hasta el {expires}",
    minSpendNote: "En pedidos superiores a {min_spend}",
    tierLabel: "Gasta {min_spend}, obtén {discount}",
    shopCta: "Usarlo en mi próximo pedido",
  },
  it: {
    timerLabel: "L'offerta termina tra",
    timerExpired: "Questa offerta è terminata. Il tuo ordine è in viaggio come previsto.",
    productCta: "Aggiungi alla mia spedizione",
    bundleCta: "Aggiungi tutto alla mia spedizione",
    savingsBadge: "{discount}",
    freeShippingBadge: "Spedizione gratuita",
    codeLabel: "Il tuo codice",
    revealLabel: "Tocca per scoprire il tuo regalo",
    applyNote: "Il pulsante lo applica automaticamente alla tua prossima visita.",
    validUntil: "Valido fino al {expires}",
    minSpendNote: "Su ordini superiori a {min_spend}",
    tierLabel: "Spendi {min_spend}, ottieni {discount}",
    shopCta: "Usalo sul mio prossimo ordine",
  },
  pt: {
    timerLabel: "A oferta termina em",
    timerExpired: "Esta oferta terminou. O seu pedido segue a caminho como previsto.",
    productCta: "Adicionar ao meu envio",
    bundleCta: "Adicionar tudo ao meu envio",
    savingsBadge: "{discount}",
    freeShippingBadge: "Envio grátis",
    codeLabel: "O seu código",
    revealLabel: "Toque para revelar o seu presente",
    applyNote: "O botão aplica-o automaticamente na sua próxima visita.",
    validUntil: "Válido até {expires}",
    minSpendNote: "Em pedidos acima de {min_spend}",
    tierLabel: "Gaste {min_spend}, ganhe {discount}",
    shopCta: "Usar no meu próximo pedido",
  },
};

const KIND_TEXT: Record<TyKind, Record<TyLang, KindTexts>> = {
  reward: {
    en: {
      eyebrow: "A thank-you gift",
      headline: "Thanks {first_name}! Here's {discount} for next time",
      subheadline: "Your order {order_number} is confirmed. Keep this code for your next visit.",
      benefitLine: "One-time code, made just for you.",
      footnote: "One use only. Cannot be combined with other discount codes.",
    },
    ar: {
      eyebrow: "هدية شكر",
      headline: "شكراً {first_name}! إليك {discount} لطلبك القادم",
      subheadline: "تم تأكيد طلبك {order_number}. احتفظ بهذا الكود لزيارتك القادمة.",
      benefitLine: "كود لمرة واحدة، مخصص لك.",
      footnote: "للاستخدام مرة واحدة فقط. لا يمكن دمجه مع أكواد خصم أخرى.",
    },
    fr: {
      eyebrow: "Un cadeau pour vous remercier",
      headline: "Merci {first_name} ! Voici {discount} pour la prochaine fois",
      subheadline: "Votre commande {order_number} est confirmée. Gardez ce code pour votre prochaine visite.",
      benefitLine: "Code à usage unique, créé pour vous.",
      footnote: "Une seule utilisation. Non cumulable avec d'autres codes de réduction.",
    },
    de: {
      eyebrow: "Ein Dankeschön",
      headline: "Danke {first_name}! Hier sind {discount} für das nächste Mal",
      subheadline: "Ihre Bestellung {order_number} ist bestätigt. Bewahren Sie diesen Code für Ihren nächsten Besuch auf.",
      benefitLine: "Einmal-Code, nur für Sie erstellt.",
      footnote: "Nur einmal einlösbar. Nicht mit anderen Rabattcodes kombinierbar.",
    },
    es: {
      eyebrow: "Un regalo de agradecimiento",
      headline: "¡Gracias {first_name}! Aquí tienes {discount} para la próxima",
      subheadline: "Tu pedido {order_number} está confirmado. Guarda este código para tu próxima visita.",
      benefitLine: "Código de un solo uso, creado para ti.",
      footnote: "Un solo uso. No acumulable con otros códigos de descuento.",
    },
    it: {
      eyebrow: "Un regalo per ringraziarti",
      headline: "Grazie {first_name}! Ecco {discount} per la prossima volta",
      subheadline: "Il tuo ordine {order_number} è confermato. Conserva questo codice per la tua prossima visita.",
      benefitLine: "Codice monouso, creato per te.",
      footnote: "Utilizzabile una sola volta. Non cumulabile con altri codici sconto.",
    },
    pt: {
      eyebrow: "Um presente de agradecimento",
      headline: "Obrigado {first_name}! Aqui estão {discount} para a próxima",
      subheadline: "O seu pedido {order_number} está confirmado. Guarde este código para a próxima visita.",
      benefitLine: "Código de uso único, criado para si.",
      footnote: "Uso único. Não acumulável com outros códigos de desconto.",
    },
  },
  addon: {
    en: {
      eyebrow: "Just for you",
      headline: "{first_name}, complete your order",
      subheadline: "Customers who bought this also loved these. Add them with {discount}.",
      benefitLine: "{discount} on everything you add.",
      footnote: "Offer valid for {minutes} minutes. Opens a new secure checkout.",
    },
    ar: {
      eyebrow: "خصيصاً لك",
      headline: "{first_name}، أكمل طلبك",
      subheadline: "عملاء اشتروا هذا أحبّوا هذه المنتجات أيضاً. أضفها مع {discount}.",
      benefitLine: "{discount} على كل ما تضيفه.",
      footnote: "العرض صالح لمدة {minutes} دقيقة. يفتح صفحة دفع آمنة جديدة.",
    },
    fr: {
      eyebrow: "Rien que pour vous",
      headline: "{first_name}, complétez votre commande",
      subheadline: "Les clients qui ont acheté ceci ont aussi adoré ces produits. Ajoutez-les avec {discount}.",
      benefitLine: "{discount} sur tout ce que vous ajoutez.",
      footnote: "Offre valable {minutes} minutes. Ouvre un nouveau paiement sécurisé.",
    },
    de: {
      eyebrow: "Nur für Sie",
      headline: "{first_name}, vervollständigen Sie Ihre Bestellung",
      subheadline: "Kunden, die dies gekauft haben, lieben auch diese Produkte. Fügen Sie sie mit {discount} hinzu.",
      benefitLine: "{discount} auf alles, was Sie hinzufügen.",
      footnote: "Angebot {minutes} Minuten gültig. Öffnet einen neuen sicheren Checkout.",
    },
    es: {
      eyebrow: "Solo para ti",
      headline: "{first_name}, completa tu pedido",
      subheadline: "A quienes compraron esto también les encantaron estos productos. Añádelos con {discount}.",
      benefitLine: "{discount} en todo lo que añadas.",
      footnote: "Oferta válida durante {minutes} minutos. Abre un nuevo pago seguro.",
    },
    it: {
      eyebrow: "Solo per te",
      headline: "{first_name}, completa il tuo ordine",
      subheadline: "Chi ha acquistato questo ha amato anche questi prodotti. Aggiungili con {discount}.",
      benefitLine: "{discount} su tutto ciò che aggiungi.",
      footnote: "Offerta valida per {minutes} minuti. Apre un nuovo checkout sicuro.",
    },
    pt: {
      eyebrow: "Só para si",
      headline: "{first_name}, complete o seu pedido",
      subheadline: "Quem comprou isto também adorou estes produtos. Adicione-os com {discount}.",
      benefitLine: "{discount} em tudo o que adicionar.",
      footnote: "Oferta válida por {minutes} minutos. Abre um novo checkout seguro.",
    },
  },
  shiptogether: {
    en: {
      eyebrow: "Order {order_number} confirmed",
      headline: "Forgot something? Ship it in the same box",
      subheadline: "Add new items within the time limit and they'll be included in one shipment, so you pay no extra shipping.",
      benefitLine: "{discount} on everything you add, shipped together with your order.",
      footnote: "The offer is real: your code expires when the timer ends. Items added are linked to order {order_number}.",
    },
    ar: {
      eyebrow: "تم تأكيد الطلب {order_number}",
      headline: "نسيت شيئاً؟ سنشحنه في نفس الصندوق",
      subheadline: "أضف منتجات جديدة خلال المهلة وسيتم شحنها مع طلبك في شحنة واحدة، فلا تدفع أي رسوم شحن إضافية.",
      benefitLine: "{discount} على كل ما تضيفه، ويُشحن مع طلبك.",
      footnote: "العرض حقيقي: ينتهي الكود عند انتهاء العداد. المنتجات المضافة مرتبطة بالطلب {order_number}.",
    },
    fr: {
      eyebrow: "Commande {order_number} confirmée",
      headline: "Un oubli ? Il part dans le même colis",
      subheadline: "Ajoutez de nouveaux articles dans le temps imparti : ils seront inclus dans la même expédition, sans frais de livraison supplémentaires.",
      benefitLine: "{discount} sur tout ce que vous ajoutez, expédié avec votre commande.",
      footnote: "L'offre est réelle : votre code expire à la fin du minuteur. Les articles ajoutés sont liés à la commande {order_number}.",
    },
    de: {
      eyebrow: "Bestellung {order_number} bestätigt",
      headline: "Etwas vergessen? Es reist im selben Paket mit",
      subheadline: "Fügen Sie innerhalb der Zeit neue Artikel hinzu – sie werden in einer Sendung verschickt, ohne zusätzliche Versandkosten.",
      benefitLine: "{discount} auf alles, was Sie hinzufügen, zusammen mit Ihrer Bestellung versendet.",
      footnote: "Das Angebot ist echt: Ihr Code läuft mit dem Timer ab. Hinzugefügte Artikel werden mit Bestellung {order_number} verknüpft.",
    },
    es: {
      eyebrow: "Pedido {order_number} confirmado",
      headline: "¿Olvidaste algo? Va en la misma caja",
      subheadline: "Añade nuevos artículos dentro del tiempo límite y se incluirán en un solo envío, sin gastos de envío adicionales.",
      benefitLine: "{discount} en todo lo que añadas, enviado junto con tu pedido.",
      footnote: "La oferta es real: tu código caduca cuando termina el temporizador. Los artículos añadidos se vinculan al pedido {order_number}.",
    },
    it: {
      eyebrow: "Ordine {order_number} confermato",
      headline: "Hai dimenticato qualcosa? Parte nella stessa scatola",
      subheadline: "Aggiungi nuovi articoli entro il tempo limite e saranno inclusi in un'unica spedizione, senza costi di spedizione aggiuntivi.",
      benefitLine: "{discount} su tutto ciò che aggiungi, spedito insieme al tuo ordine.",
      footnote: "L'offerta è reale: il tuo codice scade quando finisce il timer. Gli articoli aggiunti sono collegati all'ordine {order_number}.",
    },
    pt: {
      eyebrow: "Pedido {order_number} confirmado",
      headline: "Esqueceu-se de algo? Vai na mesma caixa",
      subheadline: "Adicione novos artigos dentro do tempo limite e serão incluídos numa única expedição, sem custos de envio adicionais.",
      benefitLine: "{discount} em tudo o que adicionar, enviado junto com o seu pedido.",
      footnote: "A oferta é real: o seu código expira quando o temporizador termina. Os artigos adicionados ficam ligados ao pedido {order_number}.",
    },
  },
};

export function defaultTexts(kind: TyKind, lang: TyLang = "en"): TyTexts {
  return { ...COMMON[lang], ...KIND_TEXT[kind][lang] };
}

export type TyTextsByLang = Partial<Record<TyLang, Partial<TyTexts>>>;

/** Copy for a language: the merchant's edits over the built-in defaults. English is the final fallback. */
export function resolveTexts(kind: TyKind, texts: TyTextsByLang | undefined, lang: TyLang): TyTexts {
  const base = defaultTexts(kind, "en");
  const builtin = lang === "en" ? base : defaultTexts(kind, lang);
  const en = (texts?.en || {}) as Partial<TyTexts>;
  const own = (lang === "en" ? {} : texts?.[lang] || {}) as Partial<TyTexts>;
  const out = { ...builtin } as TyTexts;
  // Each language ships built-in copy; a language is only changed by its own edits.
  for (const k of Object.keys(out) as (keyof TyTexts)[]) {
    const v = lang === "en" ? en[k] : own[k];
    if (typeof v === "string" && v.trim() !== "") out[k] = v;
  }
  return out;
}

/** Map a BCP-47 locale ("pt-BR", "fr-CA", "ar") to a supported language. */
export function pickLang(locale: string | undefined | null, available?: readonly TyLang[]): TyLang {
  const code = String(locale || "en").toLowerCase().split(/[-_]/)[0] as TyLang;
  const pool = available || TY_LANGS;
  return (pool as readonly string[]).includes(code) ? code : "en";
}

export type TyVars = Partial<Record<"first_name" | "order_number" | "code" | "discount" | "time_left" | "minutes" | "min_spend" | "expires" | "shop", string>>;

/**
 * Replace {placeholders}. `keep` lists placeholders to leave intact (the live {time_left}).
 * Unknown placeholders are dropped, stray spaces before punctuation are tidied and the first letter is capitalised.
 */
export function fillTemplate(tpl: string, vars: TyVars, keep: string[] = []): string {
  // A placeholder with no value is removed together with the space before it ("Thanks {first_name}!" → "Thanks!")
  const out = String(tpl || "").replace(/(\s*)\{(\w+)\}/g, (m, space: string, k: string) => {
    if (keep.includes(k)) return m;
    const v = (vars as Record<string, string | undefined>)[k];
    return v ? `${space}${v}` : "";
  });
  const tidy = out
    .replace(/^[,\u060C\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return tidy.charAt(0).toUpperCase() + tidy.slice(1);
}

const DISCOUNT_WORDS: Record<TyLang, { off: string; ship: string }> = {
  en: { off: "{v} off", ship: "free shipping" },
  ar: { off: "خصم {v}", ship: "شحن مجاني" },
  fr: { off: "{v} de réduction", ship: "livraison offerte" },
  de: { off: "{v} Rabatt", ship: "Gratisversand" },
  es: { off: "{v} de descuento", ship: "envío gratis" },
  it: { off: "{v} di sconto", ship: "spedizione gratuita" },
  pt: { off: "{v} de desconto", ship: "envio grátis" },
};

/** "15% off" / "free shipping" in the customer's language. */
export function discountPhrase(lang: TyLang, what: "value" | "ship", valueText = ""): string {
  const w = DISCOUNT_WORDS[lang] || DISCOUNT_WORDS.en;
  return what === "ship" ? w.ship : w.off.replace("{v}", valueText);
}

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

export type TyProduct = {
  productId: string; // GID
  variantId: string; // GID
  title: string;
  imageUrl: string;
  price: string; // decimal string, shop currency
  handle?: string;
};

export type TyRewardTier = {
  valueType: "percent" | "fixed";
  value: number;
  minSpend: number;
};

export type TyReward = {
  kind: "code" | "giftcard";
  tiers: TyRewardTier[]; // 1 (3 max for VIP ladder)
  expiryDays: number;
  codePrefix: string;
};

export type TyAddon = {
  products: TyProduct[];
  benefit: "percent" | "free_shipping";
  percent: number;
  windowMinutes: number;
  showTimer: boolean;
};

export type TyConfig = {
  reward: TyReward;
  addon: TyAddon;
};

export const DEFAULT_CONFIG: TyConfig = {
  reward: {
    kind: "code",
    tiers: [{ valueType: "percent", value: 15, minSpend: 0 }],
    expiryDays: 30,
    codePrefix: "THANKS",
  },
  addon: {
    products: [],
    benefit: "percent",
    percent: 15,
    windowMinutes: 20,
    showTimer: true,
  },
};

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
};
const str = (v: unknown, max = 200) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, max);

export function sanitizeProduct(p: any): TyProduct | null {
  const productId = str(p?.productId, 80);
  const variantId = str(p?.variantId, 80);
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(productId) || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variantId)) return null;
  return {
    productId,
    variantId,
    title: str(p?.title, 150),
    imageUrl: /^https:\/\//.test(String(p?.imageUrl || "")) ? str(p.imageUrl, 500) : "",
    price: String(clamp(p?.price, 0, 1_000_000, 0)),
    handle: str(p?.handle, 120),
  };
}

export function sanitizeConfig(raw: any): TyConfig {
  const r = raw?.reward || {};
  const a = raw?.addon || {};
  const tiersIn: any[] = Array.isArray(r.tiers) && r.tiers.length ? r.tiers.slice(0, 3) : DEFAULT_CONFIG.reward.tiers;
  const tiers: TyRewardTier[] = tiersIn.map((t) => {
    const valueType = t?.valueType === "fixed" ? "fixed" : "percent";
    return {
      valueType,
      value: valueType === "percent" ? clamp(t?.value, 1, 100, 10) : clamp(t?.value, 0.01, 100000, 5),
      minSpend: clamp(t?.minSpend, 0, 1_000_000, 0),
    };
  });
  const products = (Array.isArray(a.products) ? a.products : [])
    .map(sanitizeProduct)
    .filter(Boolean)
    .slice(0, 4) as TyProduct[];
  return {
    reward: {
      kind: r.kind === "giftcard" ? "giftcard" : "code",
      tiers,
      expiryDays: Math.round(clamp(r.expiryDays, 1, 365, 30)),
      codePrefix: str(r.codePrefix || "THANKS", 12).toUpperCase().replace(/[^A-Z0-9]/g, "") || "THANKS",
    },
    addon: {
      products,
      benefit: a.benefit === "free_shipping" ? "free_shipping" : "percent",
      percent: clamp(a.percent, 1, 100, 15),
      windowMinutes: Math.round(clamp(a.windowMinutes, 2, 1440, 20)),
      showTimer: a.showTimer !== false,
    },
  };
}

export function sanitizeTexts(raw: any): TyTextsByLang {
  const out: TyTextsByLang = {};
  const allowed = new Set(TY_TEXT_FIELDS.map((f) => f.key as string));
  for (const lang of TY_LANGS) {
    const src = raw?.[lang];
    if (!src || typeof src !== "object") continue;
    const clean: Partial<TyTexts> = {};
    for (const k of Object.keys(src)) {
      if (!allowed.has(k)) continue;
      const v = str(src[k], 500).trim();
      if (v) (clean as Record<string, string>)[k] = v;
    }
    if (Object.keys(clean).length) out[lang] = clean;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Conditions
// ─────────────────────────────────────────────────────────────

export const COND_TYPES = [
  "subtotal_gte",
  "subtotal_lte",
  "contains_product",
  "not_contains_product",
  "contains_collection",
  "contains_tag",
  "customer_type",
  "country",
  "item_count_gte",
  "item_count_lte",
  "uses_discount_code",
  "no_discount_code",
  "currency",
] as const;
export type CondType = (typeof COND_TYPES)[number];

export type TyCondition = {
  id: string;
  type: CondType;
  num?: number;
  /** product / collection picks */
  items?: { id: string; label: string }[];
  /** tags, country codes, currencies, discount codes (comma separated in the UI) */
  values?: string[];
  /** customer_type: "first" | "returning" */
  choice?: string;
};

export type TyConditions = { match: "all" | "any"; rules: TyCondition[] };

export const COND_META: Record<CondType, { label: string; input: "num" | "products" | "collections" | "tags" | "countries" | "choice" | "codes" | "currencies" | "none"; needsCatalog?: boolean }> = {
  subtotal_gte: { label: "Order subtotal is at least", input: "num" },
  subtotal_lte: { label: "Order subtotal is at most", input: "num" },
  contains_product: { label: "Order includes any of these products", input: "products", needsCatalog: true },
  not_contains_product: { label: "Order does NOT include these products", input: "products", needsCatalog: true },
  contains_collection: { label: "Order includes a product from collection", input: "collections", needsCatalog: true },
  contains_tag: { label: "Order includes a product tagged", input: "tags", needsCatalog: true },
  customer_type: { label: "Customer is", input: "choice" },
  country: { label: "Shipping country is one of", input: "countries" },
  item_count_gte: { label: "Number of items is at least", input: "num" },
  item_count_lte: { label: "Number of items is at most", input: "num" },
  uses_discount_code: { label: "Order used discount code", input: "codes" },
  no_discount_code: { label: "Order used no discount code", input: "none" },
  currency: { label: "Order currency is one of", input: "currencies" },
};

export type TyContext = {
  subtotal: number;
  currency: string;
  country: string;
  itemCount: number;
  isFirstOrder: boolean | null;
  discountCodes: string[];
  productIds: string[]; // GIDs of purchased products
  tags: string[];
  collectionIds: string[]; // GIDs
};

const tail = (gid: string) => String(gid).split("/").pop() || String(gid);
const low = (s: string) => String(s).trim().toLowerCase();

export function conditionNeedsCatalog(c: TyConditions | undefined): boolean {
  return !!c?.rules.some((r) => COND_META[r.type]?.needsCatalog && r.type !== "contains_product" && r.type !== "not_contains_product");
}

/** True for a rule the order satisfies. An incomplete rule (no value yet) is ignored, so a half-edited offer never blocks. */
export function evaluateRule(rule: TyCondition, ctx: TyContext): boolean | null {
  switch (rule.type) {
    case "subtotal_gte":
      return rule.num === undefined ? null : ctx.subtotal >= rule.num;
    case "subtotal_lte":
      return rule.num === undefined ? null : ctx.subtotal <= rule.num;
    case "item_count_gte":
      return rule.num === undefined ? null : ctx.itemCount >= rule.num;
    case "item_count_lte":
      return rule.num === undefined ? null : ctx.itemCount <= rule.num;
    case "contains_product": {
      const want = (rule.items || []).map((i) => tail(i.id));
      if (!want.length) return null;
      const have = new Set(ctx.productIds.map(tail));
      return want.some((w) => have.has(w));
    }
    case "not_contains_product": {
      const want = (rule.items || []).map((i) => tail(i.id));
      if (!want.length) return null;
      const have = new Set(ctx.productIds.map(tail));
      return !want.some((w) => have.has(w));
    }
    case "contains_collection": {
      const want = (rule.items || []).map((i) => tail(i.id));
      if (!want.length) return null;
      const have = new Set(ctx.collectionIds.map(tail));
      return want.some((w) => have.has(w));
    }
    case "contains_tag": {
      const want = (rule.values || []).map(low).filter(Boolean);
      if (!want.length) return null;
      const have = new Set(ctx.tags.map(low));
      return want.some((w) => have.has(w));
    }
    case "customer_type": {
      if (!rule.choice) return null;
      if (ctx.isFirstOrder === null) return false;
      return rule.choice === "first" ? ctx.isFirstOrder : !ctx.isFirstOrder;
    }
    case "country": {
      const want = (rule.values || []).map((v) => v.trim().toUpperCase()).filter(Boolean);
      if (!want.length) return null;
      return want.includes(ctx.country.toUpperCase());
    }
    case "currency": {
      const want = (rule.values || []).map((v) => v.trim().toUpperCase()).filter(Boolean);
      if (!want.length) return null;
      return want.includes(ctx.currency.toUpperCase());
    }
    case "uses_discount_code": {
      const want = (rule.values || []).map(low).filter(Boolean);
      const used = ctx.discountCodes.map(low);
      if (!want.length) return used.length > 0; // none typed → any code
      return want.some((w) => used.includes(w));
    }
    case "no_discount_code":
      return ctx.discountCodes.length === 0;
    default:
      return null;
  }
}

/** An offer with no (complete) rules matches every order. */
export function evaluateConditions(cond: TyConditions | undefined, ctx: TyContext): boolean {
  const results = (cond?.rules || []).map((r) => evaluateRule(r, ctx)).filter((r): r is boolean => r !== null);
  if (results.length === 0) return true;
  return cond?.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

export function sanitizeConditions(raw: any): TyConditions {
  const match = raw?.match === "any" ? "any" : "all";
  const rules: TyCondition[] = [];
  for (const r of (Array.isArray(raw?.rules) ? raw.rules : []).slice(0, 12)) {
    const type = (COND_TYPES as readonly string[]).includes(r?.type) ? (r.type as CondType) : null;
    if (!type) continue;
    const rule: TyCondition = { id: str(r?.id || Math.random().toString(36).slice(2, 8), 20), type };
    const input = COND_META[type].input;
    if (input === "num") {
      const n = Number(r?.num);
      if (Number.isFinite(n) && n >= 0) rule.num = Math.min(n, 10_000_000);
    } else if (input === "products" || input === "collections") {
      rule.items = (Array.isArray(r?.items) ? r.items : [])
        .map((i: any) => ({ id: str(i?.id, 80), label: str(i?.label, 150) }))
        .filter((i: { id: string }) => /^gid:\/\/shopify\/(Product|Collection)\/\d+$/.test(i.id))
        .slice(0, 50);
    } else if (input === "tags" || input === "countries" || input === "codes" || input === "currencies") {
      rule.values = (Array.isArray(r?.values) ? r.values : [])
        .map((v: unknown) => str(v, 60).trim())
        .filter(Boolean)
        .slice(0, 50);
    } else if (input === "choice") {
      rule.choice = r?.choice === "returning" ? "returning" : "first";
    }
    rules.push(rule);
  }
  return { match, rules };
}

/** Plain-English summary shown in the offer list. */
export function describeConditions(cond: TyConditions | undefined, money: (n: number) => string = (n) => String(n)): string {
  const rules = cond?.rules || [];
  if (!rules.length) return "Every order";
  const part = (r: TyCondition) => {
    switch (r.type) {
      case "subtotal_gte": return r.num === undefined ? "" : `subtotal ≥ ${money(r.num)}`;
      case "subtotal_lte": return r.num === undefined ? "" : `subtotal ≤ ${money(r.num)}`;
      case "item_count_gte": return r.num === undefined ? "" : `${r.num}+ items`;
      case "item_count_lte": return r.num === undefined ? "" : `up to ${r.num} items`;
      case "contains_product": return (r.items || []).length ? `includes ${(r.items || []).map((i) => i.label || "product").slice(0, 2).join(", ")}${(r.items || []).length > 2 ? "…" : ""}` : "";
      case "not_contains_product": return (r.items || []).length ? `excludes ${(r.items || []).map((i) => i.label || "product").slice(0, 2).join(", ")}` : "";
      case "contains_collection": return (r.items || []).length ? `from ${(r.items || []).map((i) => i.label || "collection").slice(0, 2).join(", ")}` : "";
      case "contains_tag": return (r.values || []).length ? `tagged ${(r.values || []).slice(0, 3).join(", ")}` : "";
      case "customer_type": return r.choice === "returning" ? "returning customer" : "first-time customer";
      case "country": return (r.values || []).length ? `ships to ${(r.values || []).slice(0, 4).join(", ")}` : "";
      case "currency": return (r.values || []).length ? `currency ${(r.values || []).join("/")}` : "";
      case "uses_discount_code": return (r.values || []).length ? `used code ${(r.values || []).slice(0, 2).join(", ")}` : "used a discount code";
      case "no_discount_code": return "no discount code";
      default: return "";
    }
  };
  const parts = rules.map(part).filter(Boolean);
  if (!parts.length) return "Every order";
  return parts.join(cond?.match === "any" ? "  OR  " : "  AND  ");
}

// ─────────────────────────────────────────────────────────────
// Offer descriptions, codes and links
// ─────────────────────────────────────────────────────────────

export function formatMoney(amount: number, currency: string, locale?: string): string {
  try {
    const whole = Math.abs(amount - Math.round(amount)) < 0.005;
    return new Intl.NumberFormat(locale || "en", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export const gidTail = (gid: string) => String(gid).split("/").pop() || String(gid);

export function describeTier(t: TyRewardTier, currency: string, locale?: string): string {
  return t.valueType === "percent" ? `${trimNum(t.value)}%` : formatMoney(t.value, currency, locale);
}

const trimNum = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2));

/** Short, human code like THANKS-7K4Q-9XMD from random bytes the caller supplies. */
export function buildCode(prefix: string, rand: string): string {
  const clean = rand.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "");
  return `${prefix || "THANKS"}-${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

/** Cart permalink: opens a prefilled checkout. Attributes link the follow-up order to the original. */
export const ITEMS_TOKEN = "__ITEMS__";

export function buildAddLink(opts: {
  shopDomain: string;
  variantIds: string[];
  code?: string | null;
  orderNumber?: string | null;
  orderId?: string | null;
  offerId: string;
  /** adds a visible “Ship together with #1042” line to the new order's additional details */
  shipTogether?: boolean;
}): string {
  const items = opts.variantIds.length ? opts.variantIds.map((v) => `${tail(v)}:1`).join(",") : ITEMS_TOKEN;
  const q: string[] = [];
  if (opts.code) q.push(`discount=${encodeURIComponent(opts.code)}`);
  q.push(`attributes[_xp_ty]=${encodeURIComponent(opts.offerId)}`);
  if (opts.orderNumber) q.push(`attributes[_xp_parent]=${encodeURIComponent(opts.orderNumber)}`);
  if (opts.orderId) q.push(`attributes[_xp_parent_id]=${encodeURIComponent(tail(opts.orderId))}`);
  if (opts.shipTogether && opts.orderNumber) q.push(`attributes[Ship%20together%20with]=${encodeURIComponent(opts.orderNumber)}`);
  return `https://${opts.shopDomain}/cart/${items}?${q.join("&")}`;
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ─────────────────────────────────────────────────────────────
// Payload sent to the checkout extension
// ─────────────────────────────────────────────────────────────

export type TyRenderPayload = {
  show: boolean;
  /** The order is not visible to the API yet — the extension should ask again in a moment. */
  retry?: boolean;
  offerId?: string;
  kind?: TyKind;
  design?: TyDesign;
  lang?: TyLang;
  dir?: "ltr" | "rtl";
  /** Copy for the customer's language with every placeholder filled except {time_left}. */
  texts?: TyTexts;
  currency?: string;
  /** server clock (ISO), so the countdown is right even when the customer's clock is off */
  serverNow?: string;
  /** reward kinds */
  rewards?: { code: string; label: string; minSpend: number; discountText: string; minSpendText: string; minSpendLine: string; applyLink: string }[];
  /** reward expiry, or the end of the ship-together window (ISO) */
  expiresAt?: string;
  expired?: boolean;
  /** add-on kinds */
  products?: { variantId: string; vid: string; title: string; imageUrl: string; priceText: string; priceValue: number; link: string }[];
  addLink?: string;
  /** link with an __ITEMS__ placeholder, filled with "variantId:1,variantId:1" for the customer's selection */
  linkTemplate?: string;
  /** total price text for all offered products (before the discount) */
  totalText?: string;
  benefit?: "percent" | "free_shipping";
  discountText?: string;
  showTimer?: boolean;
  shopUrl?: string;
  /** true when this is a sample shown in the checkout editor / admin preview */
  sample?: boolean;
};

/** The fields of an offer needed to render it (the server's ParsedOffer and the admin editor's draft both fit). */
export type TyOfferLike = {
  id: string;
  kind: TyKind;
  design: TyDesign;
  config: TyConfig;
  texts: TyTextsByLang;
};
