// Shared reward logic for the Tier Perks Engine (order + shipping discounts).
// Mirrors the storefront bar: same country rules, same threshold scaling.

export const ORDER_TYPES = ["order_percent", "order_fixed"];
export const SHIPPING_TYPES = ["free_shipping", "shipping_percent", "shipping_fixed"];

function num(v, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export function readConfig(input) {
  const raw = input && input.discount && input.discount.metafield && input.discount.metafield.jsonValue;
  if (!raw || typeof raw !== "object") return null;
  return raw;
}

export function readCountry(input) {
  const groups = (input && input.cart && input.cart.deliveryGroups) || [];
  for (const g of groups) {
    const c = g && g.deliveryAddress && g.deliveryAddress.countryCode;
    if (c) return String(c).toUpperCase();
  }
  const l = input && input.localization && input.localization.country && input.localization.country.isoCode;
  return l ? String(l).toUpperCase() : "";
}

// Same visibility rule as the storefront bar (include / exclude by country).
export function audienceAllows(cfg, country) {
  const mode = cfg.mode;
  const list = Array.isArray(cfg.countries) ? cfg.countries : [];
  if ((mode !== "include" && mode !== "exclude") || list.length === 0) return true;
  const inList = list.indexOf(country) !== -1;
  return mode === "include" ? inList : !inList;
}

// First matching country rule wins, otherwise the default ladder.
export function pickTiers(cfg, country) {
  const overrides = Array.isArray(cfg.overrides) ? cfg.overrides : [];
  if (country) {
    for (const o of overrides) {
      if (o && Array.isArray(o.countries) && o.countries.indexOf(country) !== -1 && Array.isArray(o.tiers) && o.tiers.length) {
        return o.tiers;
      }
    }
  }
  return Array.isArray(cfg.tiers) ? cfg.tiers : [];
}

// Identical rounding to the storefront bar so the bar and checkout agree.
export function scaleThreshold(amount, rate) {
  const a = num(amount);
  if (rate === 1) return a;
  const s = a * rate;
  return s >= 10 ? Math.round(s) : Math.round(s * 100) / 100;
}

export function money(n) {
  return (Math.max(0, Math.round(n * 100) / 100)).toFixed(2);
}

/**
 * Returns { order: [...], shipping: [...], stacking } where each entry is a reward
 * the cart has unlocked, already converted to the buyer's currency.
 */
export function resolveRewards(input) {
  const cfg = readConfig(input);
  if (!cfg) return null;
  const country = readCountry(input);
  if (!audienceAllows(cfg, country)) return null;

  const rate = num(input.presentmentCurrencyRate, 1) || 1;
  const subtotal = num(input.cart && input.cart.cost && input.cart.cost.subtotalAmount && input.cart.cost.subtotalAmount.amount);
  if (subtotal <= 0) return null;

  const order = [];
  const shipping = [];
  for (const t of pickTiers(cfg, country)) {
    if (!t) continue;
    const type = String(t.rewardType || "");
    if (ORDER_TYPES.indexOf(type) === -1 && SHIPPING_TYPES.indexOf(type) === -1) continue;
    if (subtotal < scaleThreshold(t.targetAmount, rate)) continue;
    const label = String(t.rewardLabel || t.rewardTitle || "Reward unlocked").slice(0, 80);
    const value = num(t.rewardValue);
    const cap = num(t.rewardCap) * rate;

    if (type === "order_percent" && value > 0) {
      const pct = Math.min(100, value);
      const off = (subtotal * pct) / 100;
      const capped = cap > 0 && off > cap;
      order.push({ type, label, pct, capped, cap, off: capped ? cap : off });
    } else if (type === "order_fixed" && value > 0) {
      const amt = Math.min(subtotal, value * rate);
      order.push({ type, label, amount: amt, off: amt });
    } else if (type === "free_shipping") {
      shipping.push({ type, label, pct: 100, strength: 1e9 });
    } else if (type === "shipping_percent" && value > 0) {
      const pct = Math.min(100, value);
      shipping.push({ type, label, pct, strength: pct });
    } else if (type === "shipping_fixed" && value > 0) {
      shipping.push({ type, label, amount: value * rate, strength: value * rate });
    }
  }

  const stacking = cfg.stacking === "all" ? "all" : "best";
  if (stacking === "best") {
    order.sort((a, b) => b.off - a.off);
    shipping.sort((a, b) => b.strength - a.strength);
    return { stacking, order: order.slice(0, 1), shipping: shipping.slice(0, 1) };
  }
  return { stacking, order, shipping };
}
