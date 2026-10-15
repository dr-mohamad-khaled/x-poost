// XPoost Bundle Builder — checkout logic.
//
// Every bundle line carries the attribute `_xpb = "<bundleId>|<instanceId>|<step>"`.
// The storefront sets it, but nothing it says is trusted: for each instance we check
// that the bundle exists and is live, the customer meets its conditions, every product
// belongs to the right step, and the counts match the bundle rules. Only then is the
// price applied. A shopper editing cart properties can't unlock a price they didn't build.

const MAX_MULTIPLES = 20;

function num(v, d = 0) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : d;
}
const round2 = (n) => Math.round(n * 100) / 100;
const tail = (gid) => String(gid || "").split("/").pop();
export const money = (n) => Math.max(0, round2(n)).toFixed(2);

export function readConfig(input) {
  const raw = input && input.discount && input.discount.metafield && input.discount.metafield.jsonValue;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.b)) return null;
  return raw;
}

export function readContext(input) {
  const bi = (input.cart && input.cart.buyerIdentity) || {};
  const c = bi.customer || null;
  const tags = new Set();
  if (c && Array.isArray(c.hasTags)) for (const t of c.hasTags) if (t && t.hasTag) tags.add(String(t.tag).toLowerCase());
  const loc = input.localization || {};
  return {
    loggedIn: !!bi.isAuthenticated || !!c,
    customer: !!c,
    orders: c ? num(c.numberOfOrders) : 0,
    spent: c && c.amountSpent ? num(c.amountSpent.amount) : 0,
    tags,
    country: String((loc.country && loc.country.isoCode) || "").toUpperCase(),
    market: String((loc.market && loc.market.handle) || "").toLowerCase(),
    today: String((input.shop && input.shop.localTime && input.shop.localTime.date) || ""),
  };
}

/** Same rules as the storefront. A rule with no value yet is ignored. */
export function conditionsPass(cond, ctx) {
  const rules = (cond && Array.isArray(cond.r) ? cond.r : []).map((r) => evalRule(r, ctx)).filter((x) => x !== null);
  if (!rules.length) return true;
  return cond.m === "any" ? rules.some(Boolean) : rules.every(Boolean);
}
function evalRule(r, ctx) {
  const vals = Array.isArray(r.v) ? r.v : [];
  switch (r.t) {
    case "tag_any":
      return vals.length ? vals.some((t) => ctx.tags.has(String(t).toLowerCase())) : null;
    case "tag_none":
      return vals.length ? !vals.some((t) => ctx.tags.has(String(t).toLowerCase())) : null;
    case "logged_in":
      return ctx.loggedIn;
    case "guest":
      return !ctx.loggedIn;
    case "orders_gte":
      return r.n == null ? null : ctx.orders >= num(r.n);
    case "orders_lte":
      return r.n == null ? null : ctx.orders <= num(r.n);
    case "spent_gte":
      return r.n == null ? null : ctx.spent >= num(r.n);
    case "country_in":
      return vals.length ? vals.indexOf(ctx.country) !== -1 : null;
    case "country_not_in":
      return vals.length ? vals.indexOf(ctx.country) === -1 : null;
    case "market_in":
      return vals.length ? vals.indexOf(ctx.market) !== -1 : null;
    default:
      return null;
  }
}

export function scheduleOk(b, today) {
  if (!today) return true;
  if (b.s && today < b.s) return false;
  if (b.e && today > b.e) return false;
  return true;
}

function inPool(step, line) {
  if (!step) return false;
  if ((step.p || []).indexOf(line.pid) !== -1) return true;
  const want = step.c || [];
  if (!want.length) return false;
  return line.colls.some((c) => want.indexOf(c) !== -1);
}

/** Returns k (how many complete bundles the lines make) or 0 when the lines don't form a valid bundle. */
export function validate(b, items) {
  if (!items.length) return 0;
  const total = items.reduce((a, l) => a + l.qty, 0);
  const maxK = b.mul ? MAX_MULTIPLES : 1;

  if (b.ty === "fixed") {
    const req = Array.isArray(b.f) ? b.f : [];
    if (!req.length) return 0;
    const have = {};
    for (const l of items) {
      if (l.step !== "f") return 0;
      have[l.pid] = (have[l.pid] || 0) + l.qty;
    }
    if (Object.keys(have).length !== req.length) return 0;
    const first = req[0];
    const k = (have[first.p] || 0) / num(first.q, 1);
    if (!Number.isInteger(k) || k < 1 || k > maxK) return 0;
    for (const r of req) if ((have[r.p] || 0) !== num(r.q, 1) * k) return 0;
    return k;
  }

  if (b.ty === "multipack") {
    const m = b.m || {};
    for (const l of items) if (l.pid !== m.p) return 0;
    for (let k = 1; k <= maxK; k++) {
      if (total % k) continue;
      const n = total / k;
      if (n >= num(m.mn, 1) && n <= num(m.mx, 1)) return k;
    }
    return 0;
  }

  // mix / box
  const steps = Array.isArray(b.st) ? b.st : [];
  if (!steps.length) return 0;
  const units = steps.map(() => 0);
  const perProduct = steps.map(() => ({}));
  for (const l of items) {
    const i = /^\d+$/.test(l.step) ? parseInt(l.step, 10) : -1;
    if (i < 0 || i >= steps.length) return 0;
    if (!inPool(steps[i], l)) return 0;
    units[i] += l.qty;
    perProduct[i][l.pid] = (perProduct[i][l.pid] || 0) + l.qty;
  }
  for (let k = 1; k <= maxK; k++) {
    let ok = true;
    for (let i = 0; i < steps.length && ok; i++) {
      if (units[i] % k) ok = false;
      else {
        const n = units[i] / k;
        if (n < num(steps[i].mn) || n > num(steps[i].mx)) ok = false;
      }
      if (ok && !b.dup) {
        for (const pid of Object.keys(perProduct[i])) if (perProduct[i][pid] > k) ok = false;
      }
    }
    if (ok && total / k >= 1) return k;
  }
  return 0;
}

function pickTier(tiers, n) {
  let best = null;
  for (const t of tiers || []) {
    const min = num(t[0]);
    if (n >= min && (!best || min > num(best[0]))) best = t;
  }
  return best;
}

/** Splits an amount over lines in proportion to their totals (cents-exact). */
function spread(lines, amount) {
  const gross = lines.reduce((a, l) => a + l.qty * l.price, 0);
  if (gross <= 0 || amount <= 0) return [];
  let left = Math.round(Math.min(amount, gross) * 100);
  const out = [];
  lines.forEach((l, i) => {
    const lineCents = Math.round(l.qty * l.price * 100);
    let part = i === lines.length - 1 ? left : Math.round((Math.min(amount, gross) * 100 * lineCents) / Math.round(gross * 100));
    part = Math.min(part, lineCents, left);
    left -= part;
    if (part > 0) out.push({ id: l.id, amount: part / 100 });
  });
  return out;
}

function ruleCandidates(mode, value, lines, k, rate, message) {
  const gross = lines.reduce((a, l) => a + l.qty * l.price, 0);
  if (mode === "percent") {
    const pct = Math.min(100, Math.max(0, num(value)));
    if (!pct) return [];
    return [{ message, targets: lines.map((l) => ({ cartLine: { id: l.id } })), value: { percentage: { value: round2(pct) } } }];
  }
  let off = 0;
  if (mode === "amount") off = Math.min(gross, round2(num(value) * rate) * k);
  if (mode === "price") off = Math.max(0, gross - round2(num(value) * rate) * k);
  return spread(lines, off).map((p) => ({
    message,
    targets: [{ cartLine: { id: p.id } }],
    value: { fixedAmount: { amount: money(p.amount), appliesToEachItem: false } },
  }));
}

export function bundleCandidates(b, items, gifts, k, rate) {
  const message = String(b.t || "Bundle").slice(0, 80);
  const n = items.reduce((a, l) => a + l.qty, 0) / k;
  const pr = b.pr || {};
  let out = [];
  switch (pr.m) {
    case "percent":
    case "amount":
    case "price":
      out = ruleCandidates(pr.m, pr.v, items, k, rate, message);
      break;
    case "tiers": {
      const t = pickTier(pr.t, n);
      if (t) out = ruleCandidates(t[1], t[2], items, k, rate, message);
      break;
    }
    case "cheapest": {
      const pct = Math.min(100, Math.max(0, num(pr.cp, 100)));
      let left = Math.max(0, Math.floor(num(pr.cc, 1))) * k;
      if (!pct || !left) break;
      const sorted = items.slice().sort((a, b2) => a.price - b2.price);
      const targets = [];
      for (const l of sorted) {
        if (left <= 0) break;
        const q = Math.min(l.qty, left);
        targets.push({ cartLine: { id: l.id, quantity: q } });
        left -= q;
      }
      if (targets.length) out = [{ message, targets, value: { percentage: { value: round2(pct) } } }];
      break;
    }
    default:
      break;
  }

  // Free gift: one unit per complete bundle
  const g = b.g;
  if (g && g.p && n >= num(g.mn, 1)) {
    let left = k;
    const targets = [];
    for (const l of gifts) {
      if (left <= 0) break;
      if (l.pid !== g.p) continue;
      const q = Math.min(l.qty, left);
      targets.push({ cartLine: { id: l.id, quantity: q } });
      left -= q;
    }
    if (targets.length) out.push({ message, targets, value: { percentage: { value: 100 } } });
  }
  return out;
}

/** Parses cart lines into bundle instances: { key: { bid, items, gifts } } */
export function groupLines(input) {
  const groups = {};
  const lines = (input.cart && input.cart.lines) || [];
  for (const line of lines) {
    const raw = line && line.bundle && line.bundle.value;
    if (!raw || line.merchandise.__typename !== "ProductVariant") continue;
    const m = /^([A-Za-z0-9_-]{4,40})\|([a-z0-9]{4,16})\|(\d{1,2}|f|g)$/.exec(String(raw));
    if (!m) continue;
    const product = line.merchandise.product || {};
    const l = {
      id: line.id,
      qty: Math.max(0, Math.floor(num(line.quantity))),
      price: num(line.cost && line.cost.amountPerQuantity && line.cost.amountPerQuantity.amount),
      pid: tail(product.id),
      colls: (product.inCollections || []).filter((c) => c && c.isMember).map((c) => c.collectionId),
      step: m[3],
    };
    if (!l.qty) continue;
    const key = m[1] + "|" + m[2];
    const g = groups[key] || (groups[key] = { bid: m[1], items: [], gifts: [] });
    (l.step === "g" ? g.gifts : g.items).push(l);
  }
  return groups;
}

/**
 * Product Recommendations offer. A line added from the recommendations block carries
 * `_xpr = "<id of the product the shopper was viewing>"`. Nothing in it is trusted: the
 * offer applies only when that product is in the cart on its own line, the recommended
 * product is a different product, and (for picked products or a collection) it belongs
 * to the list the merchant chose.
 */
export function recCandidates(input, cfg, rate) {
  const r = cfg && cfg.r;
  if (!r || (r.m !== "percent" && r.m !== "amount")) return [];
  const value = num(r.v);
  if (!(value > 0)) return [];
  const lines = (input.cart && input.cart.lines) || [];
  const plain = new Set();
  const recs = [];
  for (const line of lines) {
    if (!line || !line.merchandise || line.merchandise.__typename !== "ProductVariant") continue;
    const product = line.merchandise.product || {};
    const pid = tail(product.id);
    const anchor = line.rec && line.rec.value ? String(line.rec.value) : "";
    if (line.bundle && line.bundle.value) continue;
    if (anchor) {
      if (!/^\d{1,20}$/.test(anchor)) continue;
      recs.push({
        id: line.id,
        pid,
        anchor,
        qty: Math.max(0, Math.floor(num(line.quantity))),
        colls: (product.inCollections || []).filter((c) => c && c.isMember).map((c) => c.collectionId),
      });
    } else plain.add(pid);
  }
  const message = String(r.t || "Special offer").slice(0, 80);
  const out = [];
  for (const l of recs) {
    if (!l.qty || l.pid === l.anchor || !plain.has(l.anchor)) continue;
    if (Array.isArray(r.p) && r.p.indexOf(l.pid) === -1) continue;
    if (Array.isArray(r.c) && r.c.length && !l.colls.some((c) => r.c.indexOf(c) !== -1)) continue;
    if (r.m === "percent") {
      out.push({ message, targets: [{ cartLine: { id: l.id } }], value: { percentage: { value: round2(Math.min(100, value)) } } });
    } else {
      out.push({ message, targets: [{ cartLine: { id: l.id } }], value: { fixedAmount: { amount: money(value * rate), appliesToEachItem: true } } });
    }
  }
  return out;
}

export function resolveCandidates(input) {
  const cfg = readConfig(input);
  if (!cfg) return [];
  const byId = {};
  for (const b of cfg.b) if (b && b.id) byId[b.id] = b;
  const ctx = readContext(input);
  const rate = num(input.presentmentCurrencyRate, 1) || 1;
  const groups = groupLines(input);
  const out = [];
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    const b = byId[g.bid];
    if (!b) continue;
    if (!scheduleOk(b, ctx.today)) continue;
    if (!conditionsPass(b.c, ctx)) continue;
    const k = validate(b, g.items);
    if (!k) continue;
    for (const c of bundleCandidates(b, g.items, g.gifts, k, rate)) out.push(c);
  }
  for (const c of recCandidates(input, cfg, rate)) out.push(c);
  return out;
}
