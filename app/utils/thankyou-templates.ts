import {
  DEFAULT_CONFIG,
  type TyConfig,
  type TyConditions,
  type TyDesign,
  type TyKind,
  type TyTextsByLang,
} from "./thankyou";

export type TyTemplate = {
  key: string;
  name: string;
  tagline: string;
  why: string;
  kind: TyKind;
  design: TyDesign;
  build: (aov: number | null) => { config: TyConfig; conditions: TyConditions; texts?: TyTextsByLang };
};

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const rule = (r: Record<string, unknown>) => ({ id: Math.random().toString(36).slice(2, 8), ...r }) as any;

export const TEMPLATES: TyTemplate[] = [
  {
    key: "reward15",
    name: "Come-back gift",
    tagline: "A unique 15% code for the next order, revealed with a tap.",
    why: "The strongest lever on a thank-you page: it costs nothing until a customer returns, and it expires so it creates a reason to come back soon.",
    kind: "reward",
    design: "gift_reveal",
    build: (aov) => {
      const config = clone(DEFAULT_CONFIG);
      config.reward = { kind: "code", expiryDays: 30, codePrefix: "THANKS", tiers: [{ valueType: "percent", value: 15, minSpend: aov ? round5(aov * 1.2) : 0 }] };
      return { config, conditions: { match: "all", rules: [] } };
    },
  },
  {
    key: "ladder",
    name: "VIP ladder",
    tagline: "Three steps: spend more next time, unlock a bigger reward.",
    why: "Tiered rewards pull the next basket above your average order value instead of just discounting it.",
    kind: "reward",
    design: "vip_ladder",
    build: (aov) => {
      const base = aov || 50;
      const config = clone(DEFAULT_CONFIG);
      config.reward = {
        kind: "code",
        expiryDays: 45,
        codePrefix: "VIP",
        tiers: [
          { valueType: "percent", value: 10, minSpend: round5(base * 0.9) },
          { valueType: "percent", value: 15, minSpend: round5(base * 1.5) },
          { valueType: "percent", value: 20, minSpend: round5(base * 2.4) },
        ],
      };
      return { config, conditions: { match: "all", rules: [rule({ type: "subtotal_gte", num: round5(base * 0.8) })] } };
    },
  },
  {
    key: "shiptogether",
    name: "Ship it together",
    tagline: "A 20-minute window: add items now, they ship in one box with free shipping.",
    why: "Removes the fear of paying shipping twice. The timer is real: the code expires when it ends.",
    kind: "shiptogether",
    design: "ship_timer",
    build: () => {
      const config = clone(DEFAULT_CONFIG);
      config.addon = { ...config.addon, benefit: "free_shipping", windowMinutes: 20, showTimer: true };
      return { config, conditions: { match: "all", rules: [] } };
    },
  },
  {
    key: "routine",
    name: "Complete the routine",
    tagline: "3 matching products in a grid, 15% off, one button.",
    why: "Offers with 3 products convert roughly twice as well as a single product.",
    kind: "addon",
    design: "routine",
    build: () => {
      const config = clone(DEFAULT_CONFIG);
      config.addon = { ...config.addon, benefit: "percent", percent: 15, windowMinutes: 60, showTimer: true };
      return { config, conditions: { match: "all", rules: [] } };
    },
  },
  {
    key: "firstbuyer",
    name: "First-order hero add-on",
    tagline: "One hero product for first-time customers with 20% off.",
    why: "First-time buyers are the most open to a second product while the brand is fresh.",
    kind: "addon",
    design: "spotlight",
    build: () => {
      const config = clone(DEFAULT_CONFIG);
      config.addon = { ...config.addon, benefit: "percent", percent: 20, windowMinutes: 30, showTimer: true };
      return { config, conditions: { match: "all", rules: [rule({ type: "customer_type", choice: "first" })] } };
    },
  },
  {
    key: "returning",
    name: "Returning-customer thanks",
    tagline: "A quiet banner with 10% for loyal customers.",
    why: "Keeps the page calm for people who already know you, and rewards the repeat.",
    kind: "reward",
    design: "minimal",
    build: () => {
      const config = clone(DEFAULT_CONFIG);
      config.reward = { kind: "code", expiryDays: 21, codePrefix: "LOYAL", tiers: [{ valueType: "percent", value: 10, minSpend: 0 }] };
      return { config, conditions: { match: "all", rules: [rule({ type: "customer_type", choice: "returning" })] } };
    },
  },
];

export type Suggestion = { level: "good" | "tip" | "warn"; text: string };

/** Plain-language coaching for the offer being edited. */
export function coach(
  d: { kind: TyKind; design: TyDesign; config: TyConfig; conditions: TyConditions; enabled: boolean },
  aov: number | null,
  money: (n: number) => string,
): Suggestion[] {
  const out: Suggestion[] = [];
  const r = d.config.reward;
  const a = d.config.addon;

  if (d.kind === "reward") {
    const top = r.tiers[0];
    if (top && top.valueType === "percent" && top.value > 25) {
      out.push({ level: "warn", text: `${top.value}% is generous. Rewards between 10% and 20% bring customers back without teaching them to wait for discounts.` });
    }
    if (r.expiryDays > 60) out.push({ level: "tip", text: "Codes that last over 60 days feel optional. 14–30 days is the sweet spot between urgency and fairness." });
    if (r.expiryDays < 7) out.push({ level: "tip", text: "Under a week is tight for a next purchase. Most customers need 2–4 weeks." });
    if (top && top.minSpend === 0 && d.design !== "vip_ladder") {
      out.push({
        level: "tip",
        text: aov
          ? `Set a minimum spend a little above your average order (${money(aov)}), for example ${money(Math.round(aov * 1.2))}, so the reward lifts the next basket.`
          : "Set a minimum spend a little above your average order so the reward lifts the next basket instead of just cutting its price.",
      });
    }
    if (d.design === "vip_ladder") {
      const asc = r.tiers.every((t, i) => i === 0 || (t.minSpend > r.tiers[i - 1].minSpend && t.value >= r.tiers[i - 1].value));
      if (!asc) out.push({ level: "warn", text: "Each step should ask for more spend and give a bigger reward." });
      else out.push({ level: "good", text: "Steps rise with spend. Make the first step slightly above your average order so most customers can see themselves reaching it." });
    }
    if (r.kind === "giftcard") {
      out.push({ level: "tip", text: "A gift card is stored value you owe the customer even if they would have returned anyway. Discount codes cost nothing until used." });
    }
  } else {
    if (a.products.length === 0) out.push({ level: "warn", text: "Add at least one product. The offer stays paused until you do." });
    if (a.products.length === 1 && d.design === "routine") out.push({ level: "tip", text: "The Routine design is built for 2–4 products. Add more, or switch to Spotlight." });
    if (a.products.length >= 1 && a.products.length < 3 && d.design === "ship_timer") out.push({ level: "tip", text: "Offers with 3 products convert about twice as well as a single product." });
    if (a.windowMinutes > 60) out.push({ level: "tip", text: "Long windows lose urgency and keep your fulfilment team waiting. 15–30 minutes works best for ship-together." });
    if (d.kind === "shiptogether" && a.benefit === "free_shipping") out.push({ level: "good", text: "Free shipping on the added items matches the promise “no extra shipping fee”. The code is single-use and expires with the timer." });
    if (a.benefit === "percent" && a.percent > 25) out.push({ level: "warn", text: `${a.percent}% off add-ons can cut deeply into margin. 10–20% is usually enough right after a purchase.` });
    if (aov) {
      const dear = a.products.filter((p) => Number(p.price) > aov * 0.6);
      if (dear.length) out.push({ level: "tip", text: `${dear.map((p) => p.title).slice(0, 2).join(", ")} costs more than 60% of your average order. After a purchase, small add-ons (refills, minis, accessories) get the most takes.` });
    }
    out.push({ level: "tip", text: "Items added from this page become a second order. XPoost links it to the first (note “Ship together with #1042” in the order's additional details) so you can pack both in one box." });
  }

  if (d.conditions.rules.length === 0) {
    out.push({ level: "tip", text: "This offer shows for every order. Add a condition (for example first-time customers, or orders that contain a specific product) and keep a broader offer below it as a fallback." });
  }
  return out;
}
