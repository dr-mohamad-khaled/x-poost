/**
 * XPoost Bundle Builder (storefront).
 *
 * One renderer for every bundle type and design:
 *   types:   mix (pick N from a pool) | box (step by step) | fixed (set items, shopper picks variants) | multipack (one product, several variants)
 *   designs: slots | grid | stepper | list | classic | tiles
 *   display: inline | drawer | modal
 *
 * Prices shown here are a preview. The real discount is computed and checked at checkout
 * by the "XPoost Bundles" Shopify Function, which validates every line, so a shopper
 * can't change the price by editing cart properties.
 *
 * The same file renders the live preview in the XPoost admin (ctx.preview = true).
 */
(function () {
  "use strict";
  if (window.XPB && window.XPB.__v) return;

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function fill(tpl, vars) {
    return String(tpl || "").replace(/\{(\w+)\}/g, function (m, k) {
      return vars && vars[k] != null ? vars[k] : m;
    });
  }
  function rid() {
    return Math.random().toString(36).slice(2, 10);
  }
  function num(v, d) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : d || 0;
  }
  function img(url, w) {
    if (!url) return "";
    var u = String(url);
    if (u.indexOf("//") === 0) u = "https:" + u;
    if (u.indexOf("cdn.shopify.com") === -1 && u.indexOf("/cdn/shop/") === -1) return u;
    return u + (u.indexOf("?") === -1 ? "?" : "&") + "width=" + (w || 360);
  }

  /** Shopify money format, e.g. "${{amount}}" or "{{amount_with_comma_separator}} €" */
  function formatMoney(cents, format, currency) {
    var c = Math.round(num(cents));
    var fmt = format || "";
    if (!fmt || fmt.indexOf("{{") === -1) {
      try {
        return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "currency", currency: currency || "USD" }).format(c / 100);
      } catch (e) {
        return (c / 100).toFixed(2);
      }
    }
    function delim(n, prec, thou, dec) {
      thou = thou == null ? "," : thou;
      dec = dec == null ? "." : dec;
      var s = (n / 100).toFixed(prec);
      var parts = s.split(".");
      var whole = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + thou);
      return parts[1] ? whole + dec + parts[1] : whole;
    }
    var m = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    var key = m ? m[1] : "amount";
    var val;
    switch (key) {
      case "amount_no_decimals":
        val = delim(c, 0);
        break;
      case "amount_with_comma_separator":
        val = delim(c, 2, ".", ",");
        break;
      case "amount_no_decimals_with_comma_separator":
        val = delim(c, 0, ".", ",");
        break;
      case "amount_with_apostrophe_separator":
        val = delim(c, 2, "'", ".");
        break;
      case "amount_with_space_separator":
        val = delim(c, 2, " ", ",");
        break;
      default:
        val = delim(c, 2);
    }
    return fmt.replace(/\{\{\s*\w+\s*\}\}/, val).replace(/<[^>]*>/g, "");
  }

  // ─────────────────────────────────────────────────────────
  // Pricing (mirrors the Shopify Function; amounts in cents of the shopper's currency)
  // ─────────────────────────────────────────────────────────
  function toCents(v, rate) {
    return Math.round(num(v) * (rate || 1) * 100);
  }
  function applyRule(mode, value, gross, rate) {
    if (mode === "percent") return Math.round((gross * Math.min(100, Math.max(0, num(value)))) / 100);
    if (mode === "amount") return Math.min(gross, toCents(value, rate));
    if (mode === "price") return Math.max(0, gross - toCents(value, rate));
    return 0;
  }
  function pickTier(tiers, n) {
    var best = null;
    (tiers || []).forEach(function (t) {
      if (n >= num(t.min) && (!best || num(t.min) > num(best.min))) best = t;
    });
    return best;
  }
  /** units: array of unit prices (cents). Returns the discount in cents for one complete bundle. */
  function bundleDiscount(pricing, units, rate) {
    var p = pricing || {};
    var gross = units.reduce(function (a, b) { return a + b; }, 0);
    var n = units.length;
    if (!n) return 0;
    switch (p.mode) {
      case "percent":
      case "amount":
      case "price":
        return applyRule(p.mode, p.value, gross, rate);
      case "tiers": {
        var t = pickTier(p.tiers, n);
        return t ? applyRule(t.mode, t.value, gross, rate) : 0;
      }
      case "cheapest": {
        var sorted = units.slice().sort(function (a, b) { return a - b; });
        var c = Math.max(0, Math.min(n, Math.floor(num(p.cheapestCount, 1))));
        var pct = Math.min(100, Math.max(0, num(p.cheapestPercent, 100)));
        var sum = 0;
        for (var i = 0; i < c; i++) sum += sorted[i];
        return Math.round((sum * pct) / 100);
      }
      default:
        return 0;
    }
  }
  function ruleLabel(mode, value, ctx) {
    if (mode === "percent") return Math.round(num(value)) + "%";
    if (mode === "amount") return ctx.money(toCents(value, ctx.rate));
    if (mode === "price") return ctx.money(toCents(value, ctx.rate));
    return "";
  }

  // ─────────────────────────────────────────────────────────
  // Product data (Ajax API, so prices are already in the shopper's currency)
  // ─────────────────────────────────────────────────────────
  var productCache = {};
  function loadProduct(handle, ctx) {
    if (ctx.products && ctx.products[handle]) return Promise.resolve(ctx.products[handle]);
    if (productCache[handle]) return productCache[handle];
    var url = (ctx.root || "/") + "products/" + encodeURIComponent(handle) + ".js";
    productCache[handle] = fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("product " + r.status);
        return r.json();
      })
      .then(normalizeProduct)
      .catch(function () {
        delete productCache[handle];
        return null;
      });
    return productCache[handle];
  }
  function normalizeProduct(p) {
    if (!p) return null;
    var variants = (p.variants || []).map(function (v) {
      var fi = v.featured_image && (v.featured_image.src || v.featured_image);
      return {
        id: String(v.id),
        title: v.title === "Default Title" ? "" : v.title || "",
        price: num(v.price),
        compare: num(v.compare_at_price),
        available: v.available !== false,
        image: typeof fi === "string" ? fi : "",
      };
    });
    return {
      id: String(p.id),
      handle: p.handle,
      title: p.title,
      url: p.url || "/products/" + p.handle,
      image: p.featured_image || (p.images && p.images[0]) || "",
      variants: variants,
      available: variants.some(function (v) { return v.available; }),
    };
  }
  function loadAll(handles, ctx) {
    var out = {};
    var queue = handles.slice();
    var workers = [];
    function next() {
      var h = queue.shift();
      if (!h) return Promise.resolve();
      return loadProduct(h, ctx).then(function (p) {
        if (p) out[h] = p;
        return next();
      });
    }
    for (var i = 0; i < 6; i++) workers.push(next());
    return Promise.all(workers).then(function () { return out; });
  }

  // ─────────────────────────────────────────────────────────
  // Builder instance
  // ─────────────────────────────────────────────────────────
  function Builder(root, bundle, ctx) {
    this.root = root;
    this.b = bundle;
    this.ctx = ctx;
    this.t = bundle.texts || {};
    this.products = {};
    this.loading = true;
    this.view = 0;
    this.msg = "";
    this.msgKind = "";
    this.busy = false;
    var self = this;

    // Selection model
    this.steps = (bundle.steps || []).map(function (s) {
      return { def: s, picks: [] };
    });
    if (bundle.type === "multipack" && bundle.multipack) {
      this.steps = [{ def: { id: "mp", title: "", min: bundle.multipack.min, max: bundle.multipack.max, handles: [bundle.multipack.handle] }, picks: [] }];
    }
    this.fixed = (bundle.type === "fixed" ? bundle.fixed || [] : []).map(function (f) {
      return { handle: f.handle, qty: Math.max(1, num(f.qty, 1)), variant: "" };
    });
    this.variantChoice = {}; // handle -> variant id picked in a card select

    root.classList.add("xpb", "xpb-d-" + bundle.design, "xpb-t-" + bundle.type);
    if (ctx.rtl) root.setAttribute("dir", "rtl");
    this.applyStyle(root);

    root.addEventListener("click", function (e) { self.onClick(e); });
    root.addEventListener("change", function (e) { self.onChange(e); });
    this.bindPopup(root);

    this.render();
    var handles = this.allHandles();
    loadAll(handles, ctx).then(function (map) {
      self.products = map;
      self.loading = false;
      self.fixed.forEach(function (f) {
        var p = map[f.handle];
        var v = p && self.firstAvailable(p);
        f.variant = v ? v.id : "";
      });
      self.render();
      if (window.XPT && !ctx.preview) window.XPT.observe(self.root, "bb", { o: bundle.id, d: bundle.design });
    });
  }

  /* Product popup: tapping a product photo or name shows its details; the popup's button adds it to the bundle like the card's button. */
  Builder.prototype.bindPopup = function (el) {
    if (!this.ctx.popup || this.ctx.preview || !window.XPoostQV) return;
    var self = this, s = this.b.style || {};
    window.XPoostQV.bind(el, {
      card: ".xpb-card, .xpb-fx",
      hit: ".xpb-img, .xpb-name",
      handle: function (c) { return c.getAttribute("data-h") || ""; },
      action: function (c) {
        var el = c.querySelector('button.xpb-add, button[data-act="add"], button[data-act="slot"], button[data-act="addv"]');
        if (!el) return null;
        /* The +/− quantity buttons have no words: name the popup button "Add". */
        return el.classList.contains("xpb-qbtn") ? { el: el, label: self.t.add || "Add" } : el;
      },
      price: function (c) { return c.querySelector(".xpb-prices"); },
      colors: { accent: s.accent, bg: s.bg, text: s.text, muted: s.muted, border: s.border, btn: s.btnBg, btnText: s.btnText },
      dir: this.ctx.rtl ? "rtl" : "ltr",
    });
  };

  Builder.prototype.applyStyle = function (el) {
    var s = this.b.style || {};
    var map = {
      "--xpb-accent": s.accent,
      "--xpb-bg": s.bg,
      "--xpb-text": s.text,
      "--xpb-muted": s.muted,
      "--xpb-border": s.border,
      "--xpb-btn-bg": s.btnBg,
      "--xpb-btn-text": s.btnText,
      "--xpb-badge-bg": s.badgeBg,
      "--xpb-badge-text": s.badgeText,
      "--xpb-radius": s.radius != null ? s.radius + "px" : null,
      "--xpb-cols": s.columns ? String(s.columns) : null,
    };
    Object.keys(map).forEach(function (k) {
      if (map[k] != null && map[k] !== "") el.style.setProperty(k, map[k]);
    });
    if (s.font === "system") el.classList.add("xpb-font-system");
    if (s.imageRatio) el.classList.add("xpb-img-" + s.imageRatio);
  };

  Builder.prototype.allHandles = function () {
    var set = {};
    this.steps.forEach(function (s) {
      (s.def.handles || []).forEach(function (h) { set[h] = 1; });
    });
    this.fixed.forEach(function (f) { set[f.handle] = 1; });
    if (this.b.gift && this.b.gift.handle) set[this.b.gift.handle] = 1;
    return Object.keys(set);
  };

  Builder.prototype.firstAvailable = function (p) {
    for (var i = 0; i < p.variants.length; i++) if (p.variants[i].available) return p.variants[i];
    return p.variants[0] || null;
  };
  Builder.prototype.variantOf = function (p, id) {
    for (var i = 0; i < p.variants.length; i++) if (p.variants[i].id === String(id)) return p.variants[i];
    return null;
  };

  // ── Counts & rules ──
  Builder.prototype.totalPicked = function () {
    return this.steps.reduce(function (a, s) { return a + s.picks.length; }, 0);
  };
  Builder.prototype.totalMin = function () {
    return this.steps.reduce(function (a, s) { return a + num(s.def.min); }, 0);
  };
  Builder.prototype.totalMax = function () {
    return this.steps.reduce(function (a, s) { return a + num(s.def.max); }, 0);
  };
  Builder.prototype.stepDone = function (i) {
    var s = this.steps[i];
    return s && s.picks.length >= num(s.def.min);
  };
  Builder.prototype.complete = function () {
    if (this.b.type === "fixed") {
      var self = this;
      return this.fixed.length > 0 && this.fixed.every(function (f) {
        var p = self.products[f.handle];
        var v = p && self.variantOf(p, f.variant);
        return v && v.available;
      });
    }
    for (var i = 0; i < this.steps.length; i++) if (!this.stepDone(i)) return false;
    return this.steps.length > 0;
  };
  Builder.prototype.countIn = function (stepIdx, handle, variantId) {
    var s = this.steps[stepIdx];
    if (!s) return 0;
    return s.picks.filter(function (p) {
      return p.h === handle && (!variantId || p.v === variantId);
    }).length;
  };
  Builder.prototype.canAdd = function (stepIdx, handle) {
    var s = this.steps[stepIdx];
    if (!s) return false;
    if (s.picks.length >= num(s.def.max)) return false;
    if (this.b.type !== "multipack" && !this.b.allowDuplicates && this.countIn(stepIdx, handle) > 0) return false;
    return true;
  };

  // ── Price summary ──
  Builder.prototype.units = function () {
    var self = this;
    var out = [];
    if (this.b.type === "fixed") {
      this.fixed.forEach(function (f) {
        var p = self.products[f.handle];
        var v = p && self.variantOf(p, f.variant);
        if (v) for (var i = 0; i < f.qty; i++) out.push(v.price);
      });
      return out;
    }
    this.steps.forEach(function (s) {
      s.picks.forEach(function (pk) {
        var p = self.products[pk.h];
        var v = p && self.variantOf(p, pk.v);
        if (v) out.push(v.price);
      });
    });
    return out;
  };
  Builder.prototype.summary = function () {
    var units = this.units();
    var gross = units.reduce(function (a, b) { return a + b; }, 0);
    var complete = this.complete();
    var disc = complete ? bundleDiscount(this.b.pricing, units, this.ctx.rate) : 0;
    return { units: units, n: units.length, gross: gross, discount: disc, total: gross - disc, complete: complete, gift: complete && this.giftQualifies(units.length) };
  };
  Builder.prototype.giftQualifies = function (n) {
    var g = this.b.gift;
    if (!g || !g.handle || !g.variantId) return false;
    var p = this.products[g.handle];
    var v = p && this.variantOf(p, g.variantId);
    return !!(v && v.available && n >= num(g.minItems, 1));
  };

  /** "Save up to 20%" style headline value, or "" */
  Builder.prototype.bestSave = function () {
    var p = this.b.pricing || {};
    var ctx = this.ctx;
    if (p.mode === "percent" || p.mode === "amount") return ruleLabel(p.mode, p.value, ctx);
    if (p.mode === "tiers" && p.tiers && p.tiers.length) {
      var pct = p.tiers.filter(function (t) { return t.mode === "percent"; });
      if (pct.length === p.tiers.length) return Math.round(Math.max.apply(null, pct.map(function (t) { return num(t.value); }))) + "%";
      return "";
    }
    if (p.mode === "cheapest" && num(p.cheapestPercent) > 0) return num(p.cheapestPercent) >= 100 ? (this.t.freeWord || "FREE") : Math.round(num(p.cheapestPercent)) + "%";
    return "";
  };

  // ─────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────
  Builder.prototype.render = function () {
    var focusKey = document.activeElement && this.root.contains(document.activeElement) ? document.activeElement.getAttribute("data-fk") : null;
    var oldPanel = this.overlay && this.overlay.querySelector(".xpb-panel");
    var scrollTop = oldPanel ? oldPanel.scrollTop : 0;
    var display = this.b.display || "inline";
    if (display === "inline") {
      this.root.innerHTML = this.css() + this.builderHtml();
    } else {
      this.root.innerHTML = this.css() + this.launcherHtml();
      this.renderOverlay();
    }
    if (scrollTop) {
      var newPanel = this.overlay && this.overlay.querySelector(".xpb-panel");
      if (newPanel) newPanel.scrollTop = scrollTop;
    }
    if (focusKey) {
      var target = (this.overlay || this.root).querySelector('[data-fk="' + focusKey + '"]') || this.root.querySelector('[data-fk="' + focusKey + '"]');
      if (target) target.focus();
    }
    this.fx();
  };

  // ─────────────────────────────────────────────────────────
  // Motion. The DOM is rebuilt on every render, so each effect is
  // triggered by comparing what is on screen now with the last render.
  // Nothing runs when the shopper prefers reduced motion.
  // ─────────────────────────────────────────────────────────
  var RISE_SEL = ".xpb-card, .xpb-slot, .xpb-row, .xpb-tile, .xpb-fx";
  function calm() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function rise(list) {
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      el.classList.remove("fx-rise");
      void el.offsetWidth;
      el.style.setProperty("--i", Math.min(i, 12));
      el.classList.add("fx-rise");
    }
  }

  /** Where a product image is on screen right now, so it can fly to its slot. */
  Builder.prototype.flyFrom = function (img) {
    if (!img || calm()) return null;
    var r = img.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    return { l: r.left, t: r.top, w: r.width, h: r.height, src: img.currentSrc || img.src };
  };

  /** A copy of something that is about to be removed shrinks away instead of vanishing. */
  Builder.prototype.fxGhost = function (node) {
    if (!node || calm() || !node.animate) return;
    var r = node.getBoundingClientRect();
    var wrap = document.createElement("div");
    wrap.className = "xpb xpb-ghost";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = this.root.style.cssText + ";position:fixed;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;margin:0;pointer-events:none;z-index:2147483600;";
    if (this.root.getAttribute("dir")) wrap.setAttribute("dir", this.root.getAttribute("dir"));
    var copy = node.cloneNode(true);
    var btns = copy.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) btns[i].parentNode.removeChild(btns[i]);
    copy.style.margin = "0";
    copy.style.width = "100%";
    copy.style.height = "100%";
    wrap.appendChild(copy);
    document.body.appendChild(wrap);
    var anim = wrap.animate(
      [
        { opacity: 1, transform: "scale(1) rotate(0deg)" },
        { opacity: 0, transform: "scale(.55) translateY(-10px) rotate(-4deg)" }
      ],
      { duration: 300, easing: "cubic-bezier(.5, 0, .75, 0)", fill: "forwards" }
    );
    anim.onfinish = function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    };
  };

  /** The picked product's photo travels from its card to the slot (or thumbnail) it fills. */
  Builder.prototype.fxFly = function (from, target) {
    if (!from || !target || !target.animate) return;
    var tr = target.getBoundingClientRect();
    if (tr.width < 4 || tr.bottom < 0 || tr.top > window.innerHeight) return;
    var size = Math.min(tr.width, tr.height, 64);
    var tl = tr.left + (tr.width - size) / 2;
    var tt = tr.top + (tr.height - size) / 2;
    var fly = document.createElement("img");
    fly.src = from.src;
    fly.alt = "";
    fly.setAttribute("aria-hidden", "true");
    fly.style.cssText = "position:fixed;left:" + from.l + "px;top:" + from.t + "px;width:" + from.w + "px;height:" + from.h + "px;object-fit:cover;border-radius:12px;pointer-events:none;z-index:2147483600;transform-origin:0 0;box-shadow:0 14px 30px -10px rgba(0,0,0,.45);";
    document.body.appendChild(fly);
    var sx = size / from.w;
    var sy = size / from.h;
    var dx = tl - from.l;
    var dy = tt - from.t;
    var lift = Math.max(30, Math.min(90, Math.abs(dy) * 0.25));
    var anim = fly.animate(
      [
        { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
        { transform: "translate(" + dx * 0.55 + "px, " + (dy * 0.55 - lift) + "px) scale(" + (sx + (1 - sx) * 0.35) + ", " + (sy + (1 - sy) * 0.35) + ")", opacity: 1, offset: 0.55 },
        { transform: "translate(" + dx + "px, " + dy + "px) scale(" + sx + ", " + sy + ")", opacity: 0.9 }
      ],
      { duration: 620, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "forwards" }
    );
    anim.onfinish = function () {
      if (fly.parentNode) fly.parentNode.removeChild(fly);
    };
  };

  /** Counts the shown total up or down instead of jumping. */
  Builder.prototype.fxCount = function (el, from, to) {
    var money = this.ctx.money;
    if (!el || !window.requestAnimationFrame || typeof from !== "number" || typeof to !== "number") return;
    var t0 = null;
    var dur = 520;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 4);
      el.textContent = money(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = money(to);
    }
    el.textContent = money(from);
    requestAnimationFrame(step);
  };

  Builder.prototype.burst = function (cta) {
    var host = cta && cta.parentNode;
    if (!host) return;
    var wrap = document.createElement("span");
    wrap.className = "xpb-burst";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.left = cta.offsetLeft + cta.offsetWidth / 2 + "px";
    wrap.style.top = cta.offsetTop + cta.offsetHeight / 2 + "px";
    var html = "";
    for (var i = 0; i < 14; i++) {
      var a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      var d = 38 + Math.random() * 40;
      html += '<i style="--dx:' + Math.round(Math.cos(a) * d) + "px;--dy:" + Math.round(Math.sin(a) * d) + "px;--d:" + Math.round(Math.random() * 90) + "ms;--s:" + (5 + Math.round(Math.random() * 4)) + 'px"></i>';
    }
    wrap.innerHTML = html;
    host.appendChild(wrap);
    setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 1000);
  };

  Builder.prototype.fx = function () {
    if (this.loading) return;
    var self = this;
    var scopes = [this.root];
    if (this.overlay) scopes.push(this.overlay);
    function qa(sel) {
      var out = [];
      scopes.forEach(function (s) {
        var list = s.querySelectorAll(sel);
        for (var i = 0; i < list.length; i++) out.push(list[i]);
      });
      return out;
    }
    function play(el, cls) {
      if (el) el.classList.add(cls);
    }
    var sm = this.summary();
    var bar = qa(".xpb-bar span")[0];
    var counts = {};
    var ids = {};
    var picked = 0;
    this.steps.forEach(function (s, i) {
      s.picks.forEach(function (pk) {
        if (!pk) return;
        picked += 1;
        counts[i + ":" + pk.h] = (counts[i + ":" + pk.h] || 0) + 1;
        ids[String(pk.k)] = 1;
      });
    });
    var snap = {
      counts: counts,
      ids: ids,
      picked: picked,
      total: sm.total,
      discount: sm.discount,
      complete: !!sm.complete,
      gift: !!sm.gift,
      pct: bar ? parseFloat(bar.style.width) || 0 : 0,
      view: this.view,
      msg: this.msg || ""
    };
    var prev = this._fxPrev;
    this._fxPrev = snap;
    if (calm()) return;

    if (!prev) {
      rise(qa(RISE_SEL));
      return;
    }
    if (prev.view !== snap.view) rise(qa(".xpb-step-h, .xpb-grid > *, .xpb-tiles > *"));

    qa(".xpb-card.is-picked, .xpb-row.is-picked, .xpb-tile.is-picked").forEach(function (el) {
      var hit = el.querySelector("[data-h]");
      if (!hit) return;
      var key = (hit.getAttribute("data-step") || "0") + ":" + hit.getAttribute("data-h");
      if ((counts[key] || 0) > (prev.counts[key] || 0)) {
        play(el, "fx-picked");
        play(el.querySelector(".xpb-check"), "fx-pop");
        play(el.querySelector(".xpb-qn"), "fx-bump");
      }
    });
    qa(".xpb-slot.is-full").forEach(function (el) {
      var x = el.querySelector("[data-k]");
      if (x && !prev.ids[x.getAttribute("data-k")]) play(el, "fx-pop");
    });
    if (snap.picked > prev.picked) {
      qa(".xpb-thumb").forEach(function (el, i) {
        if (i >= prev.picked) play(el, "fx-pop");
      });
    }
    if (snap.total !== prev.total) {
      qa(".xpb-tv").forEach(function (el) {
        play(el, "fx-bump");
        self.fxCount(el, prev.total, snap.total);
      });
    }
    var from = this._fly;
    this._fly = null;
    if (from) {
      var landed = qa(".xpb-slot.is-full.fx-pop")[0] || qa(".xpb-thumb.fx-pop").pop();
      if (landed) {
        landed.style.animationDelay = "420ms";
        this.fxFly(from, landed);
      }
    }
    if (snap.discount > 0 && !(prev.discount > 0)) qa(".xpb-save").forEach(function (el) { play(el, "fx-pop"); });
    else if (snap.discount !== prev.discount) qa(".xpb-save").forEach(function (el) { play(el, "fx-bump"); });
    if (bar && prev.pct !== snap.pct) {
      bar.style.width = prev.pct + "%";
      void bar.offsetWidth;
      bar.style.width = snap.pct + "%";
    }
    if (snap.msg && snap.msg !== prev.msg) play(qa(".xpb-msg")[0], "fx-rise");
    if (snap.gift && !prev.gift) play(qa(".xpb-gift")[0], "fx-pop");
    if (snap.complete && !prev.complete) {
      var cta = qa(".xpb-cta")[0];
      play(qa(".xpb-summary")[0], "fx-complete");
      play(cta, "fx-ready");
      play(qa(".xpb-msg")[0], "fx-rise");
      this.burst(cta);
    }
  };

  Builder.prototype.css = function () {
    var c = this.b.style && this.b.style.customCss;
    if (!c) return "";
    return "<style>" + String(c).replace(/<\/style/gi, "<\\/style") + "</style>";
  };

  Builder.prototype.headHtml = function () {
    var save = this.bestSave();
    var badge = save && this.t.badge ? '<span class="xpb-badge">' + esc(fill(this.t.badge, { save: save })) + "</span>" : "";
    return (
      '<div class="xpb-head">' +
      '<div class="xpb-head-txt">' +
      (this.t.title ? '<h3 class="xpb-title">' + esc(this.t.title) + "</h3>" : "") +
      (this.t.subtitle ? '<p class="xpb-sub">' + esc(this.t.subtitle) + "</p>" : "") +
      "</div>" +
      badge +
      "</div>" +
      this.tiersHtml()
    );
  };

  Builder.prototype.tiersHtml = function () {
    var p = this.b.pricing || {};
    if (p.mode !== "tiers" || !p.tiers || !p.tiers.length) return "";
    var n = this.b.type === "fixed" ? this.units().length : this.totalPicked();
    var active = pickTier(p.tiers, n);
    var self = this;
    var chips = p.tiers
      .slice()
      .sort(function (a, b) { return num(a.min) - num(b.min); })
      .map(function (t) {
        var on = active && num(active.min) === num(t.min);
        var label = t.mode === "price" ? fill(self.t.tierPrice || "{count} for {value}", { count: t.min, value: ruleLabel(t.mode, t.value, self.ctx) }) : fill(self.t.tierChip || "{count}+ items: save {value}", { count: t.min, value: ruleLabel(t.mode, t.value, self.ctx) });
        return '<li class="xpb-tier' + (on ? " is-on" : "") + '">' + esc(label) + "</li>";
      })
      .join("");
    return '<ul class="xpb-tiers" aria-label="' + esc(this.t.tiersLabel || "Savings") + '">' + chips + "</ul>";
  };

  Builder.prototype.builderHtml = function () {
    if (this.loading) return this.headHtml() + this.skeleton();
    var d = this.b.design;
    var body;
    if (this.b.type === "fixed") body = d === "list" ? this.fixedList() : d === "slots" ? this.fixedSlots() : this.fixedClassic();
    else if (d === "stepper") body = this.stepperHtml();
    else if (d === "tiles") body = this.tilesHtml();
    else if (d === "list") body = this.listHtml();
    else if (d === "grid") body = this.gridHtml();
    else body = this.slotsHtml();
    return this.headHtml() + body + this.summaryHtml();
  };

  Builder.prototype.skeleton = function () {
    var cells = "";
    for (var i = 0; i < 4; i++) cells += '<div class="xpb-card xpb-skel"><div class="xpb-img"></div><div class="xpb-info"><div class="xpb-skel-line"></div><div class="xpb-skel-line s"></div></div></div>';
    return '<div class="xpb-grid" aria-busy="true">' + cells + "</div>";
  };

  // ── Product card (shared by slots / grid / stepper) ──
  Builder.prototype.visibleProducts = function (stepIdx) {
    var s = this.steps[stepIdx];
    var self = this;
    var list = [];
    (s && s.def.handles ? s.def.handles : []).forEach(function (h) {
      var p = self.products[h];
      if (!p) return;
      if (!p.available && self.b.hideSoldOut) return;
      list.push(p);
    });
    return list;
  };

  Builder.prototype.variantSelect = function (p, key, selected, cls) {
    if (p.variants.length <= 1) return "";
    var self = this;
    var opts = p.variants
      .map(function (v) {
        return '<option value="' + esc(v.id) + '"' + (v.id === selected ? " selected" : "") + (v.available ? "" : " disabled") + ">" + esc(v.title) + (v.available ? "" : " — " + esc(self.t.soldOut || "Sold out")) + "</option>";
      })
      .join("");
    return '<select class="xpb-select ' + (cls || "") + '" data-act="variant" data-key="' + esc(key) + '" data-fk="sel-' + esc(key) + '" aria-label="' + esc(fill(this.t.chooseOption || "Choose an option for {name}", { name: p.title })) + '">' + opts + "</select>";
  };

  Builder.prototype.cardVariant = function (p) {
    var chosen = this.variantChoice[p.handle];
    var v = chosen && this.variantOf(p, chosen);
    if (v && v.available) return v;
    return this.firstAvailable(p);
  };

  Builder.prototype.priceHtml = function (v) {
    if (!v) return "";
    var cmp = v.compare > v.price ? ' <s class="xpb-cmp">' + esc(this.ctx.money(v.compare)) + "</s>" : "";
    return '<span class="xpb-price">' + esc(this.ctx.money(v.price)) + "</span>" + cmp;
  };

  Builder.prototype.card = function (p, stepIdx, mode) {
    var v = this.cardVariant(p);
    var picked = this.countIn(stepIdx, p.handle);
    var can = p.available && this.canAdd(stepIdx, p.handle);
    var key = stepIdx + ":" + p.handle;
    var control;
    if (!p.available) {
      control = '<span class="xpb-out">' + esc(this.t.soldOut || "Sold out") + "</span>";
    } else if (mode === "counter") {
      control =
        '<div class="xpb-counter">' +
        '<button type="button" class="xpb-qbtn" data-act="dec" data-step="' + stepIdx + '" data-h="' + esc(p.handle) + '" data-fk="dec-' + esc(key) + '"' + (picked ? "" : " disabled") + ' aria-label="' + esc(fill(this.t.removeOne || "Remove one {name}", { name: p.title })) + '">−</button>' +
        '<span class="xpb-qn" aria-live="polite">' + picked + "</span>" +
        '<button type="button" class="xpb-qbtn" data-act="add" data-step="' + stepIdx + '" data-h="' + esc(p.handle) + '" data-fk="inc-' + esc(key) + '"' + (can ? "" : " disabled") + ' aria-label="' + esc(fill(this.t.addOne || "Add {name}", { name: p.title })) + '">+</button>' +
        "</div>";
    } else {
      if (picked && !this.b.allowDuplicates) {
        control = '<button type="button" class="xpb-add is-picked" data-act="dec" data-step="' + stepIdx + '" data-h="' + esc(p.handle) + '" data-fk="add-' + esc(key) + '" aria-label="' + esc(fill(this.t.removeOne || "Remove one {name}", { name: p.title })) + '">' + esc(this.t.remove || "Remove") + "</button>";
      } else {
        control = '<button type="button" class="xpb-add' + (picked ? " is-picked" : "") + '" data-act="add" data-step="' + stepIdx + '" data-h="' + esc(p.handle) + '" data-fk="add-' + esc(key) + '"' + (can ? "" : " disabled") + ">" + esc(this.t.add || "Add") + (picked ? " <b>×" + picked + "</b>" : "") + "</button>";
        if (picked) {
          control = '<div class="xpb-pair">' + control + '<button type="button" class="xpb-qbtn" data-act="dec" data-step="' + stepIdx + '" data-h="' + esc(p.handle) + '" data-fk="dec-' + esc(key) + '" aria-label="' + esc(fill(this.t.removeOne || "Remove one {name}", { name: p.title })) + '">−</button></div>';
        }
      }
    }
    return (
      '<div class="xpb-card' + (picked ? " is-picked" : "") + (p.available ? "" : " is-out") + '" data-h="' + esc(p.handle) + '">' +
      '<div class="xpb-img">' + (v && v.image ? '<img src="' + esc(img(v.image, 400)) + '" alt="" loading="lazy">' : p.image ? '<img src="' + esc(img(p.image, 400)) + '" alt="" loading="lazy">' : "") + (picked ? '<span class="xpb-check" aria-hidden="true">✓</span>' : "") + "</div>" +
      '<div class="xpb-info">' +
      '<div class="xpb-name">' + esc(p.title) + "</div>" +
      '<div class="xpb-prices">' + this.priceHtml(v) + "</div>" +
      (p.available ? this.variantSelect(p, key, v && v.id) : "") +
      control +
      "</div></div>"
    );
  };

  Builder.prototype.stepHeading = function (i) {
    var s = this.steps[i];
    if (this.steps.length < 2 && !s.def.title) return "";
    var range = num(s.def.min) === num(s.def.max) ? fill(this.t.pickExact || "Pick {count}", { count: s.def.max }) : fill(this.t.pickRange || "Pick {min} to {max}", { min: s.def.min, max: s.def.max });
    var done = this.stepDone(i) ? ' <span class="xpb-done" aria-label="' + esc(this.t.stepDone || "Done") + '">✓</span>' : "";
    return '<div class="xpb-step-h"><span class="xpb-step-n">' + (i + 1) + "</span><b>" + esc(s.def.title || "") + "</b><span class=\"xpb-step-r\">" + esc(range) + " · " + s.picks.length + "/" + num(s.def.max) + "</span>" + done + "</div>";
  };

  // ── Slots ──
  Builder.prototype.slotRow = function (i) {
    var s = this.steps[i];
    var self = this;
    var html = "";
    for (var k = 0; k < num(s.def.max); k++) {
      var pk = s.picks[k];
      if (pk) {
        var p = self.products[pk.h];
        var v = p && self.variantOf(p, pk.v);
        html +=
          '<div class="xpb-slot is-full">' +
          (v && (v.image || p.image) ? '<img src="' + esc(img(v.image || p.image, 200)) + '" alt="">' : "") +
          '<span class="xpb-slot-t">' + esc(p ? p.title : "") + (v && v.title ? " · " + esc(v.title) : "") + "</span>" +
          '<button type="button" class="xpb-x" data-act="rm" data-step="' + i + '" data-k="' + pk.k + '" data-fk="rm-' + pk.k + '" aria-label="' + esc(fill(this.t.removeOne || "Remove one {name}", { name: p ? p.title : "" })) + '">×</button>' +
          "</div>";
      } else {
        var opt = k >= num(s.def.min);
        html += '<div class="xpb-slot' + (opt ? " is-opt" : "") + (k === s.picks.length ? " is-next" : "") + '"><span class="xpb-slot-n">' + (k + 1) + "</span>" + (opt ? '<span class="xpb-slot-o">' + esc(this.t.optional || "Optional") + "</span>" : "") + "</div>";
      }
    }
    return '<div class="xpb-slots" style="--xpb-slots:' + Math.min(6, num(s.def.max)) + '">' + html + "</div>";
  };

  Builder.prototype.slotsHtml = function () {
    var out = "";
    for (var i = 0; i < this.steps.length; i++) {
      var cards = this.visibleProducts(i).map(function (p) { return this.card(p, i, "button"); }, this).join("");
      out += '<section class="xpb-step">' + this.stepHeading(i) + this.slotRow(i) + '<div class="xpb-grid">' + cards + "</div></section>";
    }
    return out;
  };

  // ── Grid (counters + sticky summary) ──
  Builder.prototype.gridHtml = function () {
    var out = "";
    for (var i = 0; i < this.steps.length; i++) {
      var cards = this.visibleProducts(i).map(function (p) { return this.card(p, i, "counter"); }, this).join("");
      out += '<section class="xpb-step">' + this.stepHeading(i) + '<div class="xpb-grid">' + cards + "</div></section>";
    }
    return out;
  };

  // ── Compact list ──
  Builder.prototype.listHtml = function () {
    var out = "";
    var self = this;
    for (var i = 0; i < this.steps.length; i++) {
      var rows = this.visibleProducts(i)
        .map(function (p) {
          if (self.b.type === "multipack") return p.variants.map(function (v) { return self.variantRow(p, v, i); }).join("");
          var v = self.cardVariant(p);
          var picked = self.countIn(i, p.handle);
          var can = p.available && self.canAdd(i, p.handle);
          var key = i + ":" + p.handle;
          return (
            '<li class="xpb-row' + (picked ? " is-picked" : "") + (p.available ? "" : " is-out") + '">' +
            '<div class="xpb-row-img">' + (v && (v.image || p.image) ? '<img src="' + esc(img((v && v.image) || p.image, 160)) + '" alt="" loading="lazy">' : "") + "</div>" +
            '<div class="xpb-row-main"><div class="xpb-name">' + esc(p.title) + '</div><div class="xpb-prices">' + self.priceHtml(v) + "</div>" + (p.available ? self.variantSelect(p, key, v && v.id, "sm") : '<span class="xpb-out">' + esc(self.t.soldOut || "Sold out") + "</span>") + "</div>" +
            (p.available
              ? '<div class="xpb-counter">' +
                '<button type="button" class="xpb-qbtn" data-act="dec" data-step="' + i + '" data-h="' + esc(p.handle) + '" data-fk="dec-' + esc(key) + '"' + (picked ? "" : " disabled") + ' aria-label="' + esc(fill(self.t.removeOne || "Remove one {name}", { name: p.title })) + '">−</button>' +
                '<span class="xpb-qn">' + picked + "</span>" +
                '<button type="button" class="xpb-qbtn" data-act="add" data-step="' + i + '" data-h="' + esc(p.handle) + '" data-fk="inc-' + esc(key) + '"' + (can ? "" : " disabled") + ' aria-label="' + esc(fill(self.t.addOne || "Add {name}", { name: p.title })) + '">+</button>' +
                "</div>"
              : "") +
            "</li>"
          );
        })
        .join("");
      out += '<section class="xpb-step">' + this.stepHeading(i) + '<ul class="xpb-list">' + rows + "</ul></section>";
    }
    return out;
  };

  /** One row per variant (multipack) */
  Builder.prototype.variantRow = function (p, v, i) {
    if (!v.available && this.b.hideSoldOut) return "";
    var picked = this.countIn(i, p.handle, v.id);
    var s = this.steps[i];
    var can = v.available && s.picks.length < num(s.def.max);
    var key = i + ":" + v.id;
    var name = v.title || p.title;
    return (
      '<li class="xpb-row' + (picked ? " is-picked" : "") + (v.available ? "" : " is-out") + '">' +
      '<div class="xpb-row-img">' + (v.image || p.image ? '<img src="' + esc(img(v.image || p.image, 160)) + '" alt="" loading="lazy">' : "") + "</div>" +
      '<div class="xpb-row-main"><div class="xpb-name">' + esc(name) + '</div><div class="xpb-prices">' + this.priceHtml(v) + "</div>" + (v.available ? "" : '<span class="xpb-out">' + esc(this.t.soldOut || "Sold out") + "</span>") + "</div>" +
      (v.available
        ? '<div class="xpb-counter">' +
          '<button type="button" class="xpb-qbtn" data-act="decv" data-step="' + i + '" data-h="' + esc(p.handle) + '" data-v="' + esc(v.id) + '" data-fk="decv-' + esc(key) + '"' + (picked ? "" : " disabled") + ' aria-label="' + esc(fill(this.t.removeOne || "Remove one {name}", { name: name })) + '">−</button>' +
          '<span class="xpb-qn">' + picked + "</span>" +
          '<button type="button" class="xpb-qbtn" data-act="addv" data-step="' + i + '" data-h="' + esc(p.handle) + '" data-v="' + esc(v.id) + '" data-fk="addv-' + esc(key) + '"' + (can ? "" : " disabled") + ' aria-label="' + esc(fill(this.t.addOne || "Add {name}", { name: name })) + '">+</button>' +
          "</div>"
        : "") +
      "</li>"
    );
  };

  // ── Variant tiles (multipack) ──
  Builder.prototype.tilesHtml = function () {
    var self = this;
    var out = "";
    for (var i = 0; i < this.steps.length; i++) {
      var s = this.steps[i];
      var prods = this.visibleProducts(i);
      var tiles = "";
      prods.forEach(function (p) {
        p.variants.forEach(function (v) {
          if (!v.available && self.b.hideSoldOut) return;
          var picked = self.countIn(i, p.handle, v.id);
          var can = v.available && s.picks.length < num(s.def.max);
          var name = v.title || p.title;
          tiles +=
            '<div class="xpb-tile' + (picked ? " is-picked" : "") + (v.available ? "" : " is-out") + '">' +
            '<button type="button" class="xpb-tile-hit" data-act="addv" data-step="' + i + '" data-h="' + esc(p.handle) + '" data-v="' + esc(v.id) + '" data-fk="tile-' + esc(v.id) + '"' + (can ? "" : " disabled") + ' aria-label="' + esc(fill(self.t.addOne || "Add {name}", { name: name })) + '">' +
            (v.image || p.image ? '<img src="' + esc(img(v.image || p.image, 300)) + '" alt="" loading="lazy">' : '<span class="xpb-tile-ph">' + esc(name.slice(0, 2)) + "</span>") +
            '<span class="xpb-tile-name">' + esc(name) + "</span>" +
            '<span class="xpb-tile-price">' + esc(self.ctx.money(v.price)) + "</span>" +
            "</button>" +
            (picked ? '<span class="xpb-tile-n">' + picked + '</span><button type="button" class="xpb-tile-rm" data-act="decv" data-step="' + i + '" data-h="' + esc(p.handle) + '" data-v="' + esc(v.id) + '" data-fk="tilerm-' + esc(v.id) + '" aria-label="' + esc(fill(self.t.removeOne || "Remove one {name}", { name: name })) + '">−</button>' : "") +
            (v.available ? "" : '<span class="xpb-tile-out">' + esc(self.t.soldOut || "Sold out") + "</span>") +
            "</div>";
        });
      });
      var prod = prods[0];
      var top = prod ? '<div class="xpb-mp-head">' + (prod.image ? '<img src="' + esc(img(prod.image, 160)) + '" alt="">' : "") + '<div><div class="xpb-name">' + esc(prod.title) + '</div><div class="xpb-muted">' + esc(fill(num(s.def.min) === num(s.def.max) ? this.t.pickExact || "Pick {count}" : this.t.pickRange || "Pick {min} to {max}", { count: s.def.max, min: s.def.min, max: s.def.max })) + " · " + s.picks.length + "/" + num(s.def.max) + "</div></div></div>" : "";
      out += '<section class="xpb-step">' + top + '<div class="xpb-tiles">' + tiles + "</div></section>";
    }
    return out;
  };

  // ── Stepper ──
  Builder.prototype.stepperViews = function () {
    // box: one view per step. mix/multipack: one view per slot. Last view = review.
    if (this.b.type === "box") return this.steps.map(function (s, i) { return { step: i, slot: -1 }; });
    var views = [];
    var max = num(this.steps[0] && this.steps[0].def.max);
    for (var k = 0; k < max; k++) views.push({ step: 0, slot: k });
    return views;
  };

  Builder.prototype.stepperHtml = function () {
    var views = this.stepperViews();
    var total = views.length + 1;
    if (this.view > views.length) this.view = views.length;
    var self = this;
    var dots = "";
    for (var i = 0; i < total; i++) {
      var done = i < views.length ? this.viewDone(views[i]) : this.complete();
      dots += '<li class="xpb-dot' + (i === this.view ? " is-on" : "") + (done ? " is-done" : "") + '"><button type="button" data-act="goto" data-view="' + i + '" data-fk="dot-' + i + '"' + (this.canGoto(i, views) ? "" : " disabled") + ' aria-label="' + esc(fill(this.t.stepOf || "Step {n} of {total}", { n: i + 1, total: total })) + '">' + (i < views.length ? i + 1 : "✓") + "</button></li>";
    }
    var head = '<ol class="xpb-dots">' + dots + "</ol>" + '<div class="xpb-step-of">' + esc(fill(this.t.stepOf || "Step {n} of {total}", { n: this.view + 1, total: total })) + "</div>";

    var body;
    if (this.view === views.length) {
      body = this.reviewHtml();
    } else {
      var vw = views[this.view];
      var s = this.steps[vw.step];
      var title;
      if (vw.slot >= 0) {
        var opt = vw.slot >= num(s.def.min);
        title = '<div class="xpb-step-h"><b>' + esc(fill(this.t.pickItem || "Choose item {n}", { n: vw.slot + 1 })) + "</b>" + (opt ? '<span class="xpb-step-r">' + esc(this.t.optional || "Optional") + "</span>" : "") + "</div>";
      } else {
        title = this.stepHeading(vw.step);
      }
      var cards;
      if (this.b.type === "multipack") {
        cards = '<div class="xpb-tiles">' + this.visibleProducts(0).map(function (p) {
          return p.variants.map(function (v) {
            if (!v.available && self.b.hideSoldOut) return "";
            var cur = s.picks[vw.slot];
            var on = cur && cur.v === v.id;
            var name = v.title || p.title;
            return '<div class="xpb-tile' + (on ? " is-picked" : "") + (v.available ? "" : " is-out") + '"><button type="button" class="xpb-tile-hit" data-act="slotv" data-slot="' + vw.slot + '" data-h="' + esc(p.handle) + '" data-v="' + esc(v.id) + '" data-fk="slotv-' + esc(v.id) + '"' + (v.available ? "" : " disabled") + ">" + (v.image || p.image ? '<img src="' + esc(img(v.image || p.image, 300)) + '" alt="" loading="lazy">' : "") + '<span class="xpb-tile-name">' + esc(name) + '</span><span class="xpb-tile-price">' + esc(self.ctx.money(v.price)) + "</span></button></div>";
          }).join("");
        }).join("") + "</div>";
      } else if (vw.slot >= 0) {
        cards = '<div class="xpb-grid">' + this.visibleProducts(0).map(function (p) { return self.slotCard(p, vw.slot); }).join("") + "</div>";
      } else {
        cards = '<div class="xpb-grid">' + this.visibleProducts(vw.step).map(function (p) { return self.card(p, vw.step, "button"); }).join("") + "</div>";
      }
      var canNext = this.viewDone(vw) || (vw.slot >= 0 && vw.slot >= num(s.def.min));
      var skipToReview = vw.slot >= 0 && this.complete() && vw.slot < views.length - 1;
      body =
        title +
        cards +
        '<div class="xpb-nav">' +
        (this.view > 0 ? '<button type="button" class="xpb-ghost" data-act="back" data-fk="back">' + esc(this.t.back || "Back") + "</button>" : "<span></span>") +
        '<span class="xpb-nav-r">' +
        (skipToReview ? '<button type="button" class="xpb-ghost" data-act="goto" data-view="' + views.length + '" data-fk="review">' + esc(this.t.review || "Review bundle") + "</button>" : "") +
        '<button type="button" class="xpb-next" data-act="next" data-fk="next"' + (canNext ? "" : " disabled") + ">" + esc(vw.slot >= 0 && !s.picks[vw.slot] && vw.slot >= num(s.def.min) ? this.t.skip || "Skip" : this.t.next || "Next") + "</button>" +
        "</span></div>";
    }
    return head + '<div class="xpb-view">' + body + "</div>";
  };

  Builder.prototype.viewDone = function (vw) {
    var s = this.steps[vw.step];
    if (!s) return false;
    if (vw.slot >= 0) return !!s.picks[vw.slot];
    return s.picks.length >= num(s.def.min);
  };
  Builder.prototype.canGoto = function (i, views) {
    if (i <= this.view) return true;
    for (var k = 0; k < i && k < views.length; k++) {
      var vw = views[k];
      var s = this.steps[vw.step];
      if (!this.viewDone(vw) && !(vw.slot >= 0 && vw.slot >= num(s.def.min))) return false;
    }
    return true;
  };

  Builder.prototype.slotCard = function (p, slot) {
    var s = this.steps[0];
    var cur = s.picks[slot];
    var on = cur && cur.h === p.handle;
    var v = on ? this.variantOf(p, cur.v) : this.cardVariant(p);
    var key = "s" + slot + ":" + p.handle;
    var usedElsewhere = !this.b.allowDuplicates && !on && s.picks.some(function (x, i) { return x && i !== slot && x.h === p.handle; });
    var dis = !p.available || usedElsewhere;
    return (
      '<div class="xpb-card' + (on ? " is-picked" : "") + (p.available ? "" : " is-out") + '" data-h="' + esc(p.handle) + '">' +
      '<div class="xpb-img">' + (v && (v.image || p.image) ? '<img src="' + esc(img((v && v.image) || p.image, 400)) + '" alt="" loading="lazy">' : "") + (on ? '<span class="xpb-check" aria-hidden="true">✓</span>' : "") + "</div>" +
      '<div class="xpb-info"><div class="xpb-name">' + esc(p.title) + '</div><div class="xpb-prices">' + this.priceHtml(v) + "</div>" +
      (p.available ? this.variantSelect(p, key, v && v.id) : "") +
      '<button type="button" class="xpb-add' + (on ? " is-picked" : "") + '" data-act="slot" data-slot="' + slot + '" data-h="' + esc(p.handle) + '" data-fk="slot-' + esc(key) + '"' + (dis ? " disabled" : "") + ">" + esc(!p.available ? this.t.soldOut || "Sold out" : usedElsewhere ? this.t.added || "Added" : on ? this.t.remove || "Remove" : this.t.choose || "Choose") + "</button>" +
      "</div></div>"
    );
  };

  Builder.prototype.reviewHtml = function () {
    var self = this;
    var rows = "";
    this.steps.forEach(function (s, i) {
      s.picks.forEach(function (pk) {
        var p = self.products[pk.h];
        var v = p && self.variantOf(p, pk.v);
        if (!p || !v) return;
        rows += '<li class="xpb-row"><div class="xpb-row-img">' + (v.image || p.image ? '<img src="' + esc(img(v.image || p.image, 160)) + '" alt="">' : "") + '</div><div class="xpb-row-main"><div class="xpb-name">' + esc(p.title) + "</div>" + (v.title ? '<div class="xpb-muted">' + esc(v.title) + "</div>" : "") + "</div>" + '<div class="xpb-prices">' + self.priceHtml(v) + "</div></li>";
      });
    });
    return '<div class="xpb-step-h"><b>' + esc(this.t.reviewTitle || "Your bundle") + "</b></div>" + '<ul class="xpb-list">' + rows + "</ul>" + '<div class="xpb-nav"><button type="button" class="xpb-ghost" data-act="back" data-fk="back">' + esc(this.t.back || "Back") + "</button><span></span></div>";
  };

  // ── Fixed bundle designs ──
  Builder.prototype.fixedItem = function (f, i, compact) {
    var p = this.products[f.handle];
    if (!p) return "";
    var v = this.variantOf(p, f.variant) || this.firstAvailable(p);
    var key = "f" + i;
    var qty = f.qty > 1 ? '<span class="xpb-qtytag">' + f.qty + "×</span>" : "";
    return (
      '<div class="xpb-fx' + (p.available ? "" : " is-out") + (compact ? " is-compact" : "") + '" data-h="' + esc(p.handle) + '">' +
      '<div class="xpb-img">' + (v && (v.image || p.image) ? '<img src="' + esc(img((v && v.image) || p.image, 400)) + '" alt="" loading="lazy">' : "") + qty + "</div>" +
      '<div class="xpb-info"><div class="xpb-name">' + esc(p.title) + '</div><div class="xpb-prices">' + this.priceHtml(v) + "</div>" +
      (p.available ? this.variantSelect(p, key, v && v.id) : '<span class="xpb-out">' + esc(this.t.soldOut || "Sold out") + "</span>") +
      "</div></div>"
    );
  };
  Builder.prototype.fixedClassic = function () {
    var self = this;
    var parts = this.fixed.map(function (f, i) { return self.fixedItem(f, i, false); }).filter(Boolean);
    return '<div class="xpb-classic">' + parts.join('<span class="xpb-plus" aria-hidden="true">+</span>') + "</div>";
  };
  Builder.prototype.fixedList = function () {
    var self = this;
    var rows = this.fixed
      .map(function (f, i) {
        var p = self.products[f.handle];
        if (!p) return "";
        var v = self.variantOf(p, f.variant) || self.firstAvailable(p);
        return '<li class="xpb-row' + (p.available ? "" : " is-out") + '"><div class="xpb-row-img">' + (v && (v.image || p.image) ? '<img src="' + esc(img((v && v.image) || p.image, 160)) + '" alt="" loading="lazy">' : "") + '</div><div class="xpb-row-main"><div class="xpb-name">' + (f.qty > 1 ? f.qty + "× " : "") + esc(p.title) + "</div>" + (p.available ? self.variantSelect(p, "f" + i, v && v.id, "sm") : '<span class="xpb-out">' + esc(self.t.soldOut || "Sold out") + "</span>") + '</div><div class="xpb-prices">' + self.priceHtml(v) + "</div></li>";
      })
      .join("");
    return '<ul class="xpb-list">' + rows + "</ul>";
  };
  Builder.prototype.fixedSlots = function () {
    var self = this;
    var cells = this.fixed.map(function (f, i) { return self.fixedItem(f, i, true); }).join("");
    return '<div class="xpb-fxgrid">' + cells + "</div>";
  };

  // ── Summary & CTA ──
  Builder.prototype.summaryHtml = function () {
    var sm = this.summary();
    var t = this.t;
    var ctx = this.ctx;
    var isFixed = this.b.type === "fixed";
    var picked = isFixed ? sm.n : this.totalPicked();
    var min = isFixed ? sm.n : this.totalMin();
    var max = isFixed ? sm.n : this.totalMax();
    var pct = max ? Math.min(100, Math.round((picked / Math.max(min || max, 1)) * 100)) : 0;
    var msg;
    if (this.msg) {
      msg = '<div class="xpb-msg is-' + (this.msgKind || "info") + '" role="status">' + esc(this.msg) + "</div>";
    } else if (!sm.complete) {
      var remaining = Math.max(0, min - picked);
      msg = '<div class="xpb-msg" role="status">' + esc(isFixed ? t.chooseOptions || "Choose your options" : remaining ? fill(remaining === 1 ? t.pickOneMore || "Pick 1 more item" : t.pickMore || "Pick {remaining} more items", { remaining: remaining }) : "") + "</div>";
    } else {
      var hint = this.tierHint(sm);
      msg = '<div class="xpb-msg is-ok" role="status">' + esc(sm.discount > 0 ? fill(t.ready || "Bundle ready. You save {saved}", { saved: ctx.money(sm.discount) }) : t.readyNoSave || "Bundle ready") + (hint ? '<span class="xpb-hint">' + esc(hint) + "</span>" : "") + "</div>";
    }
    var gift = "";
    if (this.b.gift && this.b.gift.handle) {
      var gp = this.products[this.b.gift.handle];
      if (gp) {
        gift = '<div class="xpb-gift' + (sm.gift ? " is-on" : "") + '"><span class="xpb-gift-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg></span> ' + esc(sm.gift ? fill(t.giftOn || "Free gift included: {gift}", { gift: gp.title }) : fill(t.giftOff || "Pick {count} items to get {gift} free", { count: this.b.gift.minItems, gift: gp.title })) + "</div>";
      }
    }
    var showBar = !isFixed;
    var totals =
      '<div class="xpb-totals"><span class="xpb-tl">' + esc(t.total || "Total") + "</span>" +
      (sm.discount > 0 ? '<s class="xpb-cmp">' + esc(ctx.money(sm.gross)) + "</s>" : "") +
      '<b class="xpb-tv">' + esc(ctx.money(sm.total)) + "</b>" +
      (sm.discount > 0 && sm.gross > 0 ? '<span class="xpb-save">' + esc(fill(t.saveTag || "−{percent}%", { percent: Math.round((sm.discount / sm.gross) * 100) })) + "</span>" : "") +
      "</div>";
    var thumbs = "";
    if (this.b.design === "grid" && !isFixed) {
      var self = this;
      this.steps.forEach(function (s) {
        s.picks.forEach(function (pk) {
          var p = self.products[pk.h];
          var v = p && self.variantOf(p, pk.v);
          if (p) thumbs += '<span class="xpb-thumb">' + ((v && v.image) || p.image ? '<img src="' + esc(img((v && v.image) || p.image, 96)) + '" alt="">' : "") + "</span>";
        });
      });
      thumbs = '<div class="xpb-thumbs">' + thumbs + "</div>";
    }
    var ctaLabel = this.busy ? t.adding || "Adding…" : t.addButton || "Add bundle to cart";
    return (
      '<div class="xpb-summary' + (this.b.design === "grid" ? " is-sticky" : "") + '">' +
      (showBar ? '<div class="xpb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + (min || max) + '" aria-valuenow="' + picked + '"><span style="width:' + pct + '%"></span></div>' : "") +
      msg +
      gift +
      '<div class="xpb-sum-row">' + thumbs + totals +
      '<button type="button" class="xpb-cta" data-act="cart" data-fk="cta"' + (sm.complete && !this.busy ? "" : " disabled") + ">" + esc(ctaLabel) + "</button>" +
      "</div></div>"
    );
  };

  Builder.prototype.tierHint = function (sm) {
    var p = this.b.pricing || {};
    if (p.mode !== "tiers" || this.b.type === "fixed") return "";
    var max = this.totalMax();
    var next = null;
    (p.tiers || []).forEach(function (t) {
      if (num(t.min) > sm.n && num(t.min) <= max && (!next || num(t.min) < num(next.min))) next = t;
    });
    if (!next) return "";
    return fill(this.t.tierHint || "Add {more} more to save {value}", { more: num(next.min) - sm.n, value: ruleLabel(next.mode, next.value, this.ctx) });
  };

  // ── Drawer / modal ──
  Builder.prototype.launcherHtml = function () {
    var save = this.bestSave();
    return (
      '<div class="xpb-launch">' +
      '<div class="xpb-launch-txt">' +
      (this.t.title ? '<div class="xpb-title">' + esc(this.t.title) + "</div>" : "") +
      (this.t.subtitle ? '<div class="xpb-sub">' + esc(this.t.subtitle) + "</div>" : "") +
      "</div>" +
      (save && this.t.badge ? '<span class="xpb-badge">' + esc(fill(this.t.badge, { save: save })) + "</span>" : "") +
      '<button type="button" class="xpb-cta" data-act="open" data-fk="open" aria-haspopup="dialog">' + esc(this.t.openButton || "Build your bundle") + "</button>" +
      "</div>"
    );
  };
  Builder.prototype.renderOverlay = function () {
    if (!this.overlay) {
      var self = this;
      var ov = document.createElement("div");
      ov.className = "xpb-overlay " + (this.b.display === "drawer" ? "is-drawer" : "is-modal");
      ov.hidden = true;
      if (this.ctx.rtl) ov.setAttribute("dir", "rtl");
      ov.addEventListener("click", function (e) {
        if (e.target === ov) self.close();
        else self.onClick(e);
      });
      ov.addEventListener("change", function (e) { self.onChange(e); });
      ov.addEventListener("keydown", function (e) {
        if (e.key === "Escape") self.close();
        if (e.key === "Tab") self.trapFocus(e);
      });
      (this.ctx.overlayHost || document.body).appendChild(ov);
      this.overlay = ov;
      this.bindPopup(ov);
    }
    var panel = document.createElement("div");
    panel.className = "xpb xpb-panel xpb-d-" + this.b.design + " xpb-t-" + this.b.type;
    this.applyStyle(panel);
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", this.t.title || this.t.openButton || "Bundle");
    panel.innerHTML = '<button type="button" class="xpb-close" data-act="close" data-fk="close" aria-label="' + esc(this.t.close || "Close") + '">×</button>' + this.builderHtml();
    this.overlay.innerHTML = "";
    this.overlay.appendChild(panel);
  };
  Builder.prototype.open = function () {
    this.lastFocus = document.activeElement;
    this.overlay.hidden = false;
    document.documentElement.classList.add("xpb-lock");
    if (!calm()) {
      var ov = this.overlay;
      ov.classList.add("is-opening");
      rise(ov.querySelectorAll(RISE_SEL));
      setTimeout(function () { ov.classList.remove("is-opening"); }, 450);
    }
    var c = this.overlay.querySelector(".xpb-close");
    if (c) c.focus();
    if (window.XPT && !this.ctx.preview) window.XPT.track("bb", "c", { o: this.b.id, d: "open" });
  };
  Builder.prototype.close = function () {
    if (!this.overlay || this.overlay.hidden) return;
    this.overlay.hidden = true;
    document.documentElement.classList.remove("xpb-lock");
    if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
  };
  Builder.prototype.trapFocus = function (e) {
    var f = this.overlay.querySelectorAll("button:not([disabled]),select,a[href]");
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };

  // ─────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────
  Builder.prototype.onChange = function (e) {
    var el = e.target;
    if (!el || el.getAttribute("data-act") !== "variant") return;
    var key = el.getAttribute("data-key") || "";
    var val = el.value;
    if (key.charAt(0) === "f") {
      var f = this.fixed[parseInt(key.slice(1), 10)];
      if (f) f.variant = val;
    } else {
      var handle = key.split(":").slice(1).join(":");
      this.variantChoice[handle] = val;
      // In the stepper, changing the option of the chosen product updates that slot
      var m = /^s(\d+)$/.exec(key.split(":")[0]);
      if (m) {
        var slot = parseInt(m[1], 10);
        var pk = this.steps[0] && this.steps[0].picks[slot];
        if (pk && pk.h === handle) pk.v = val;
      }
    }
    this.msg = "";
    this.render();
  };

  Builder.prototype.onClick = function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el && e.target && e.target.closest && !e.target.closest("select, a, label")) {
      // Clicking a chosen product (or its slot) takes it out again
      var chosen = e.target.closest(".xpb-slot.is-full, .xpb-card.is-picked");
      if (chosen) el = chosen.querySelector('.xpb-x, .xpb-add.is-picked[data-act="dec"], .xpb-add.is-picked[data-act="slot"]');
    }
    if (!el || el.disabled || el.tagName === "SELECT") return;
    var fromBox = el.closest(".xpb-card, .xpb-tile, .xpb-row");
    var fromImg = fromBox ? fromBox.querySelector("img") : null;
    this._fly = null;
    var act = el.getAttribute("data-act");
    var step = parseInt(el.getAttribute("data-step") || "0", 10);
    var h = el.getAttribute("data-h");
    var self = this;
    var p = h ? this.products[h] : null;
    this.msg = "";

    switch (act) {
      case "open":
        this.open();
        return;
      case "close":
        this.close();
        return;
      case "add": {
        if (!p || !this.canAdd(step, h)) return;
        var v = this.cardVariant(p);
        if (!v || !v.available) return;
        this.steps[step].picks.push({ h: h, v: v.id, k: rid() });
        this._fly = this.flyFrom(fromImg);
        this.trackPick();
        // Step-by-step: move on once a step is full
        if (this.b.design === "stepper" && this.b.type === "box" && this.steps[step].picks.length >= num(this.steps[step].def.max)) {
          this.view = Math.min(this.view + 1, this.stepperViews().length);
        }
        break;
      }
      case "addv": {
        var vid = el.getAttribute("data-v");
        var s = this.steps[step];
        if (!s || s.picks.length >= num(s.def.max)) return;
        this.steps[step].picks.push({ h: h, v: vid, k: rid() });
        this._fly = this.flyFrom(fromImg);
        this.trackPick();
        break;
      }
      case "dec":
      case "decv": {
        var picks = this.steps[step].picks;
        var want = act === "decv" ? el.getAttribute("data-v") : null;
        for (var i = picks.length - 1; i >= 0; i--) {
          if (picks[i].h === h && (!want || picks[i].v === want)) {
            picks.splice(i, 1);
            break;
          }
        }
        break;
      }
      case "rm": {
        this.fxGhost(el.closest(".xpb-slot"));
        var k = el.getAttribute("data-k");
        this.steps[step].picks = this.steps[step].picks.filter(function (x) { return x.k !== k; });
        break;
      }
      case "slot":
      case "slotv": {
        var slot = parseInt(el.getAttribute("data-slot") || "0", 10);
        var s0 = this.steps[0];
        var vv = act === "slotv" ? el.getAttribute("data-v") : (this.cardVariant(p) || {}).id;
        if (!vv) return;
        // Slots fill in order (a skipped optional slot never leaves a gap)
        var held = s0.picks[slot];
        if (held && held.h === h && held.v === vv) {
          // Choosing the same product again un-chooses it
          s0.picks.splice(slot, 1);
          break;
        }
        var idx = Math.min(slot, s0.picks.length);
        s0.picks[idx] = { h: h, v: vv, k: rid() };
        this._fly = this.flyFrom(fromImg);
        this.trackPick();
        this.view = Math.min(idx + 1, this.stepperViews().length);
        break;
      }
      case "next": {
        var vws = this.stepperViews();
        if (this.view < vws.length) this.view += 1;
        break;
      }
      case "back":
        if (this.view > 0) this.view -= 1;
        break;
      case "goto":
        this.view = parseInt(el.getAttribute("data-view") || "0", 10);
        break;
      case "cart":
        this.addToCart();
        return;
      default:
        return;
    }
    this.render();
  };

  Builder.prototype.trackPick = function () {
    if (window.XPT && !this.ctx.preview) window.XPT.track("bb", "c", { o: this.b.id, d: "pick" });
  };

  // ─────────────────────────────────────────────────────────
  // Add to cart
  // ─────────────────────────────────────────────────────────
  Builder.prototype.cartItems = function () {
    var b = this.b;
    var iid = rid();
    var label = this.t.lineLabel || "Bundle";
    var title = this.t.title || b.name || "Bundle";
    var lines = {};
    var order = [];
    var n = 0;
    function push(variantId, stepKey, qty) {
      var key = variantId + "|" + stepKey;
      if (!lines[key]) {
        var props = {};
        props["_xpb"] = b.id + "|" + iid + "|" + stepKey;
        props[label] = title;
        lines[key] = { id: Number(variantId), quantity: 0, properties: props };
        order.push(key);
      }
      lines[key].quantity += qty;
    }
    if (b.type === "fixed") {
      this.fixed.forEach(function (f) {
        push(f.variant, "f", f.qty);
        n += f.qty;
      });
    } else {
      this.steps.forEach(function (s, i) {
        s.picks.forEach(function (pk) {
          if (!pk) return;
          push(pk.v, String(i), 1);
          n += 1;
        });
      });
    }
    var items = order.map(function (k) {
      var it = lines[k];
      it.properties["_xpoost_src"] = "bb:" + b.id + ":" + n;
      return it;
    });
    if (this.giftQualifies(n)) {
      var gp = {};
      gp["_xpb"] = b.id + "|" + iid + "|g";
      gp["_xpoost_src"] = "bb:" + b.id + ":gift";
      gp[label] = title;
      items.push({ id: Number(b.gift.variantId), quantity: 1, properties: gp });
    }
    return items;
  };

  Builder.prototype.addToCart = function () {
    if (this.busy || !this.complete()) return;
    var self = this;
    var items = this.cartItems();
    var sm = this.summary();
    if (this.ctx.preview) {
      this.msg = this.t.addedMsg || "Added to your cart";
      this.msgKind = "ok";
      this.render();
      return;
    }
    this.busy = true;
    this.render();
    var after = this.b.afterAdd || "drawer";
    var root = this.ctx.root || "/";

    function done(engineResponse) {
      self.busy = false;
      if (window.XPT) window.XPT.track("bb", "a", { o: self.b.id, d: String(sm.n), v: Math.round(sm.total) / 100 });
      self.reset();
      if (after === "cart") {
        window.location.href = root + "cart";
        return;
      }
      if (after === "checkout") {
        window.location.href = root + "checkout";
        return;
      }
      self.msg = self.t.addedMsg || "Added to your cart";
      self.msgKind = "ok";
      self.close();
      self.render();
      if (after === "drawer") {
        if (engineResponse) window.XPoostCart.refresh(engineResponse);
        else refreshCart();
      }
    }
    function fail(text) {
      self.busy = false;
      self.msg = text || self.t.errorMsg || "Couldn't add the bundle. Please try again.";
      self.msgKind = "err";
      self.render();
    }

    var xc = window.XPoostCart;
    var useEngine = after === "drawer" && xc && typeof xc.refresh === "function";
    var body = { items: items };
    if (useEngine && typeof xc.sectionId === "function") {
      body.sections = xc.sectionId();
      body.sections_url = window.location.pathname;
    }

    fetch(root + "cart/add.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error((j && (j.description || j.message)) || "add failed");
          return j;
        });
      })
      .then(function (j) {
        done(useEngine ? j : null);
      })
      .catch(function (err) { fail(err && err.message && err.message !== "add failed" ? err.message : ""); });
  };

  Builder.prototype.reset = function () {
    this.steps.forEach(function (s) { s.picks = []; });
    this.view = 0;
  };

  function refreshCart() {
    try {
      document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true, detail: { sourceId: "xpoost-bundles" } }));
      var drawer = document.querySelector("cart-drawer-component") || document.querySelector("cart-drawer");
      if (drawer) {
        var sectionId = (document.querySelector("cart-items-component[data-section-id]") || {}).dataset;
        sectionId = (sectionId && sectionId.sectionId) || "cart-drawer";
        fetch((window.Shopify && window.Shopify.routes && window.Shopify.routes.root || "/") + "?sections=" + encodeURIComponent(sectionId) + ",cart-icon-bubble")
          .then(function (r) { return r.json(); })
          .then(function (sections) {
            document.dispatchEvent(new CustomEvent("cart:update", { bubbles: true, detail: { resource: null, sourceId: "xpoost-bundles", data: { sections: sections, source: "xpoost" } } }));
            var html = sections && sections[sectionId];
            if (html && drawer.tagName === "CART-DRAWER") {
              var doc = new DOMParser().parseFromString(html, "text/html");
              var fresh = doc.querySelector("cart-drawer");
              if (fresh) drawer.innerHTML = fresh.innerHTML;
            }
            var bubble = sections && sections["cart-icon-bubble"];
            var icon = document.getElementById("cart-icon-bubble");
            if (bubble && icon) {
              var d2 = new DOMParser().parseFromString(bubble, "text/html");
              var inner = d2.querySelector(".shopify-section");
              if (inner) icon.innerHTML = inner.innerHTML;
            }
            if (typeof drawer.showDialog === "function") drawer.showDialog();
            else if (typeof drawer.open === "function") drawer.open();
            if (drawer.classList.contains("is-empty")) drawer.classList.remove("is-empty");
          })
          .catch(function () {});
      } else {
        var btn = document.querySelector('[data-testid="cart-drawer-trigger"], #cart-icon-bubble, .header__icon--cart, [aria-controls="CartDrawer"]');
        if (btn) btn.click();
      }
    } catch (e) {}
  }

  // ─────────────────────────────────────────────────────────
  // Boot (storefront)
  // ─────────────────────────────────────────────────────────
  function matchesPlacement(b, ds) {
    var pl = b.placement || {};
    var mode = pl.mode || "in_bundle";
    var pid = ds.productId || "";
    var colls = (ds.collections || "").split(",").filter(Boolean);
    if (ds.bundleId) return b.id === ds.bundleId;
    if (!pid) return mode === "landing" || mode === "anywhere";
    switch (mode) {
      case "all":
      case "anywhere":
        return true;
      case "products":
        return (pl.products || []).indexOf(pid) !== -1;
      case "collections":
        return (pl.collections || []).some(function (c) { return colls.indexOf(c) !== -1; });
      case "exclude":
        return (pl.products || []).indexOf(pid) === -1 && !(pl.collections || []).some(function (c) { return colls.indexOf(c) !== -1; });
      case "in_bundle":
        return (b.productIds || []).indexOf(pid) !== -1 || (b.collectionIds || []).some(function (c) { return colls.indexOf(c) !== -1; });
      default:
        return false;
    }
  }
  function deviceOk(b) {
    var d = b.device || "all";
    if (d === "all") return true;
    var mobile = window.matchMedia ? window.matchMedia("(max-width: 749px)").matches : false;
    return d === "mobile" ? mobile : !mobile;
  }

  function boot(el) {
    if (el.__xpb) return;
    el.__xpb = true;
    var ds = el.dataset;
    var rate = num(window.Shopify && window.Shopify.currency && window.Shopify.currency.rate, 1) || 1;
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";
    var locale = (ds.locale || document.documentElement.lang || "en").split("-")[0].toLowerCase();
    var ctx = {
      rate: rate,
      root: root,
      rtl: locale === "ar" || document.documentElement.dir === "rtl",
      money: function (c) { return formatMoney(c, ds.moneyFormat, ds.currency); },
    };
    var qs = "?locale=" + encodeURIComponent(locale) + "&country=" + encodeURIComponent(ds.country || "") + "&market=" + encodeURIComponent(ds.market || "") + (ds.bundleId ? "&bundle=" + encodeURIComponent(ds.bundleId) : "");
    fetch((ds.proxy || "/apps/xpoost/bundles") + qs, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = (data && data.bundles) || [];
        var pick = null;
        for (var i = 0; i < list.length; i++) {
          if (matchesPlacement(list[i], ds) && deviceOk(list[i])) {
            pick = list[i];
            break;
          }
        }
        if (!pick) {
          el.remove();
          return;
        }
        el.hidden = false;
        ctx.popup = !data || data.productPopup !== false;
        new Builder(el, pick, ctx);
      })
      .catch(function () { el.remove(); });
  }

  function scan() {
    var els = document.querySelectorAll("[data-xpb-root]");
    for (var i = 0; i < els.length; i++) boot(els[i]);
  }

  window.XPB = {
    __v: 1,
    /** Admin preview / programmatic mount */
    mount: function (el, bundle, ctx) {
      var c = ctx || {};
      if (!c.money) c.money = function (v) { return formatMoney(v, c.moneyFormat || "${{amount}}", c.currency); };
      if (!c.rate) c.rate = 1;
      return new Builder(el, bundle, c);
    },
    bundleDiscount: bundleDiscount,
    formatMoney: formatMoney,
    scan: scan,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  document.addEventListener("shopify:section:load", scan);
})();
