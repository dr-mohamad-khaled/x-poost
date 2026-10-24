/**
 * XPoost Kit Builder (storefront).
 *
 * Shoppers build a kit step by step. Each step has its own products; a step can move on by
 * itself after one pick, or allow several picks with a Next button. Optional: a short quiz
 * first (answers change the products in each step, or hide steps) and sub-filters per step.
 *
 *   designs: journey | split | focus        display: inline | drawer | modal | page
 *
 * Prices here are a preview. The real kit price is computed and checked at checkout by the
 * "XPoost Bundles" Shopify Function, which validates every line (`_xpb` = kit|instance|step).
 *
 * The same file renders the live preview in the XPoost admin (ctx.preview = true).
 */
(function () {
  "use strict";
  if (window.XPK && window.XPK.__v) return;

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
    return u + (u.indexOf("?") === -1 ? "?" : "&") + "width=" + (w || 400);
  }
  function calm() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }
  var ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>',
  };

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

  // ── Pricing (mirrors the Shopify Function; cents of the shopper's currency) ──
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
  function kitDiscount(pricing, units, rate) {
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

  // ── Products (Ajax API, so prices are in the shopper's currency) ──
  var productCache = {};
  function normalizeProduct(p) {
    if (!p) return null;
    if (p.__n) return p;
    var variants = (p.variants || []).map(function (v) {
      var fi = v.featured_image && (v.featured_image.src || v.featured_image);
      return { id: String(v.id), title: v.title === "Default Title" ? "" : v.title || "", price: num(v.price), compare: num(v.compare_at_price != null ? v.compare_at_price : v.compare), available: v.available !== false, image: typeof fi === "string" ? fi : v.image || "" };
    });
    var image = p.featured_image || p.image || (p.images && p.images[0]) || "";
    if (image && typeof image === "object") image = image.src || image.url || "";
    return { __n: 1, id: String(p.id), handle: p.handle, title: p.title, url: p.url || "/products/" + p.handle, image: image, variants: variants, available: variants.some(function (v) { return v.available; }) };
  }
  function loadProduct(handle, ctx) {
    if (ctx.products && ctx.products[handle]) return Promise.resolve(normalizeProduct(ctx.products[handle]));
    if (productCache[handle]) return productCache[handle];
    productCache[handle] = fetch((ctx.root || "/") + "products/" + encodeURIComponent(handle) + ".js", { credentials: "same-origin" })
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
  function loadAll(handles, ctx, out) {
    var queue = handles.filter(function (h) { return !out[h]; });
    var workers = [];
    function next() {
      var h = queue.shift();
      if (!h) return Promise.resolve();
      return loadProduct(h, ctx).then(function (p) {
        out[h] = p || false;
        return next();
      });
    }
    for (var i = 0; i < 6; i++) workers.push(next());
    return Promise.all(workers);
  }

  // ─────────────────────────────────────────────────────────
  // Kit
  // ─────────────────────────────────────────────────────────
  function Kit(root, kit, ctx) {
    this.root = root;
    this.k = kit;
    this.t = kit.texts || {};
    this.ctx = ctx;
    this.design = kit.design || "journey";
    this.display = kit.display || "inline";
    this.products = {};
    this.answers = {};
    this.qi = 0;
    this.phase = kit.quiz && kit.quiz.enabled && (kit.quiz.questions || []).length ? "quiz" : "steps";
    this.view = 0;
    this.picks = {};
    this.filter = {};
    this.dir = 1;
    this.msg = "";
    var self = this;
    (kit.steps || []).forEach(function (s) { self.picks[s.id] = []; });

    root.classList.add("xpk");
    root.setAttribute("data-design", this.design);
    root.setAttribute("data-display", this.display);
    if (ctx.rtl) root.setAttribute("dir", "rtl");
    this.applyStyle(root);

    this.overlay = null;
    if (this.display === "drawer" || this.display === "modal") {
      this.overlay = document.createElement("div");
      this.overlay.className = "xpk-overlay xpk is-" + this.display;
      this.overlay.setAttribute("data-design", this.design);
      this.overlay.hidden = true;
      if (ctx.rtl) this.overlay.setAttribute("dir", "rtl");
      this.applyStyle(this.overlay);
      document.body.appendChild(this.overlay);
      this.overlay.addEventListener("click", function (e) { self.onClick(e); });
      this.overlay.addEventListener("change", function (e) { self.onChange(e); });
      this.overlay.addEventListener("keydown", function (e) {
        if (e.key === "Escape") self.close();
        if (e.key === "Tab") self.trap(e);
      });
    }
    root.addEventListener("click", function (e) { self.onClick(e); });
    root.addEventListener("change", function (e) { self.onChange(e); });
    this.bindPopup();

    this.render();
    if (window.XPT && !ctx.preview) window.XPT.observe(root, "kb", { o: kit.id, d: this.design });
    this.ensure();
  }

  /* Product popup: tapping a product photo or name shows its details; the popup's button picks it like the card's button. */
  Kit.prototype.bindPopup = function () {
    if (!this.ctx.popup || this.ctx.preview || !window.XPoostQV) return;
    var s = this.k.style || {};
    var opts = {
      card: ".xpk-card",
      hit: ".xpk-img, .xpk-pname",
      handle: function (c) { return c.getAttribute("data-h") || ""; },
      action: function (c) { return c.querySelector('[data-act="pick"], [data-act="inc"], .xpk-pick'); },
      price: function (c) { return c.querySelector(".xpk-price"); },
      colors: { accent: s.accent, bg: s.bg, text: s.text, muted: s.muted, border: s.border, btn: s.btnBg, btnText: s.btnText },
      dir: this.ctx.rtl ? "rtl" : "ltr",
    };
    window.XPoostQV.bind(this.root, opts);
    if (this.overlay) window.XPoostQV.bind(this.overlay, opts);
  };

  Kit.prototype.applyStyle = function (el) {
    var s = this.k.style || {};
    var st = el.style;
    var map = { "--xpk-accent": s.accent, "--xpk-bg": s.bg, "--xpk-text": s.text, "--xpk-muted": s.muted, "--xpk-border": s.border, "--xpk-btn": s.btnBg, "--xpk-btn-text": s.btnText, "--xpk-badge": s.badgeBg, "--xpk-badge-text": s.badgeText };
    for (var k in map) if (map[k]) st.setProperty(k, map[k]);
    st.setProperty("--xpk-radius", num(s.radius, 12) + "px");
    st.setProperty("--xpk-cols", String(Math.max(2, Math.min(5, num(s.columns, 3)))));
    st.setProperty("--xpk-ratio", s.imageRatio === "portrait" ? "4 / 5" : s.imageRatio === "natural" ? "auto" : "1 / 1");
    if (s.font === "system") el.classList.add("xpk-sys");
    if (s.customCss && el === this.root) {
      var tag = document.createElement("style");
      tag.textContent = String(s.customCss).replace(/<\/?style/gi, "");
      el.parentNode && el.parentNode.insertBefore(tag, el);
    }
  };

  // ── Steps, pools, picks ──
  Kit.prototype.label = function (id, fallback) {
    var l = this.t.labels || {};
    return l[id] || fallback || "";
  };
  Kit.prototype.stepVisible = function (s) {
    if (!s.showIf) return true;
    var a = this.answers[s.showIf.q];
    return !a || (s.showIf.options || []).indexOf(a) !== -1;
  };
  Kit.prototype.visible = function () {
    var self = this;
    return (this.k.steps || []).filter(function (s) { return self.stepVisible(s); });
  };
  Kit.prototype.stepIndex = function (s) {
    return (this.k.steps || []).indexOf(s);
  };
  Kit.prototype.pool = function (s) {
    var base = s.handles || [];
    if (s.byAnswer) {
      var a = this.answers[s.byAnswer.q];
      var pools = s.byAnswer.pools || {};
      if (a && pools[a] && pools[a].length) return pools[a];
      if (!base.length) {
        var all = [];
        for (var k in pools) pools[k].forEach(function (h) { if (all.indexOf(h) === -1) all.push(h); });
        return all;
      }
    }
    return base;
  };
  Kit.prototype.shown = function (s) {
    var pool = this.pool(s);
    var f = this.filter[s.id];
    if (!f) return pool;
    var fl = null;
    (s.filters || []).forEach(function (x) { if (x.id === f) fl = x; });
    if (!fl) return pool;
    var both = (fl.handles || []).filter(function (h) { return pool.indexOf(h) !== -1; });
    return both.length ? both : fl.handles || [];
  };
  Kit.prototype.count = function (s) {
    return (this.picks[s.id] || []).length;
  };
  Kit.prototype.done = function (s) {
    return this.count(s) >= num(s.min, 0);
  };
  Kit.prototype.allPicks = function () {
    var self = this;
    var out = [];
    this.visible().forEach(function (s) {
      (self.picks[s.id] || []).forEach(function (pk) { out.push({ s: s, pk: pk }); });
    });
    return out;
  };
  Kit.prototype.complete = function () {
    var self = this;
    var vis = this.visible();
    return vis.length > 0 && vis.every(function (s) { return self.done(s); }) && this.allPicks().length > 0;
  };
  Kit.prototype.variantOf = function (h, vid) {
    var p = this.products[h];
    if (!p) return null;
    for (var i = 0; i < p.variants.length; i++) if (p.variants[i].id === vid) return p.variants[i];
    return p.variants[0] || null;
  };
  Kit.prototype.firstAvailable = function (p) {
    for (var i = 0; i < p.variants.length; i++) if (p.variants[i].available) return p.variants[i];
    return null;
  };
  Kit.prototype.summary = function () {
    var self = this;
    var units = [];
    this.allPicks().forEach(function (x) {
      var v = self.variantOf(x.pk.h, x.pk.v);
      if (v) units.push(v.price);
    });
    var gross = units.reduce(function (a, b) { return a + b; }, 0);
    var off = this.complete() ? kitDiscount(this.k.pricing, units, this.ctx.rate) : 0;
    return { n: units.length, gross: gross, off: off, total: gross - off };
  };
  Kit.prototype.bestSave = function () {
    var p = this.k.pricing || {};
    if (p.mode === "percent") return Math.round(num(p.value)) + "%";
    if (p.mode === "amount") return this.ctx.money(toCents(p.value, this.ctx.rate));
    if (p.mode === "tiers" && (p.tiers || []).length) {
      var last = p.tiers[p.tiers.length - 1];
      if (last.mode === "percent") return Math.round(num(last.value)) + "%";
    }
    return "";
  };
  Kit.prototype.giftOn = function (n) {
    var g = this.k.gift;
    return !!(g && g.variantId && n >= num(g.minItems, 1) && this.complete());
  };

  /** Loads products for the quiz-free steps that are on screen, then the rest. */
  Kit.prototype.ensure = function () {
    var self = this;
    var vis = this.visible();
    var cur = vis[this.view] || vis[0];
    var first = cur ? this.shown(cur).slice(0, 60) : [];
    var rest = [];
    vis.forEach(function (s) {
      self.pool(s).forEach(function (h) { if (first.indexOf(h) === -1 && rest.indexOf(h) === -1) rest.push(h); });
      (s.filters || []).forEach(function (f) { (f.handles || []).forEach(function (h) { if (first.indexOf(h) === -1 && rest.indexOf(h) === -1) rest.push(h); }); });
    });
    var g = this.k.gift && this.k.gift.handle;
    if (g) rest.push(g);
    var need = first.filter(function (h) { return !(h in self.products); });
    if (!need.length && this.loaded) {
      loadAll(rest, this.ctx, this.products);
      return;
    }
    loadAll(first, this.ctx, this.products).then(function () {
      self.loaded = true;
      self.render();
      loadAll(rest, self.ctx, self.products).then(function () { self.render(true); });
    });
  };

  // ─────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────
  Kit.prototype.host = function () {
    return this.overlay ? this.overlay.querySelector(".xpk-panel-body") : this.root;
  };

  Kit.prototype.render = function (quiet) {
    if (this.overlay) {
      this.root.innerHTML = this.launcherHtml();
      if (!this.overlay.hidden) this.renderOverlay();
    } else {
      this.paint(this.root, this.builderHtml(), quiet);
    }
  };
  Kit.prototype.paint = function (el, html, quiet) {
    var grid = el.querySelector(".xpk-products");
    var scroll = el.querySelector(".xpk-scroll");
    var top = scroll ? scroll.scrollTop : 0;
    el.innerHTML = html;
    var ns = el.querySelector(".xpk-scroll");
    if (ns && top && quiet) ns.scrollTop = top;
    if (!quiet) this.animateIn(el, !!grid);
    this.fx(el);
  };
  Kit.prototype.renderOverlay = function () {
    var html =
      '<div class="xpk-backdrop" data-act="close"></div>' +
      '<div class="xpk-panel" role="dialog" aria-modal="true" aria-label="' + esc(this.t.title || "Kit") + '">' +
      '<button type="button" class="xpk-close" data-act="close" aria-label="' + esc(this.t.close || "Close") + '">' + ICON.x + "</button>" +
      '<div class="xpk-panel-body">' + this.builderHtml() + "</div></div>";
    var body = this.overlay.querySelector(".xpk-panel-body");
    if (!body) {
      this.overlay.innerHTML = html;
      this.animateIn(this.overlay, false);
      this.fx(this.overlay);
    } else this.paint(body, this.builderHtml(), this.quietNext);
    this.quietNext = false;
  };

  Kit.prototype.launcherHtml = function () {
    var self = this;
    var vis = this.visible();
    var save = this.bestSave();
    var thumbs = vis
      .slice(0, 5)
      .map(function (s, i) {
        var pk = (self.picks[s.id] || [])[0];
        var p = pk && self.products[pk.h];
        return '<span class="xpk-lthumb' + (p ? " is-full" : "") + '">' + (p && p.image ? '<img src="' + esc(img(p.image, 120)) + '" alt="">' : "<b>" + (i + 1) + "</b>") + "</span>";
      })
      .join("");
    return (
      '<div class="xpk-launch">' +
      '<div class="xpk-launch-t">' +
      (save ? '<span class="xpk-badge">' + esc(fill(this.t.badge || "Save {save}", { save: save })) + "</span>" : "") +
      '<h3 class="xpk-title">' + esc(this.t.title) + "</h3>" +
      (this.t.subtitle ? '<p class="xpk-sub">' + esc(this.t.subtitle) + "</p>" : "") +
      '<div class="xpk-lthumbs">' + thumbs + "</div>" +
      "</div>" +
      '<button type="button" class="xpk-btn xpk-cta" data-act="open">' + esc(this.t.openButton || this.t.title) + "</button>" +
      (this.msg && this.msgKind === "ok" ? '<p class="xpk-msg is-ok" role="status">' + esc(this.msg) + "</p>" : "") +
      "</div>"
    );
  };

  Kit.prototype.headHtml = function () {
    var save = this.bestSave();
    var hero = this.display === "page" && this.k.heroImage ? ' style="--xpk-hero:url(' + esc(JSON.stringify(String(this.k.heroImage))) + ')"' : "";
    return (
      '<div class="xpk-head' + (this.display === "page" ? " is-hero" + (this.k.heroImage ? " has-img" : "") : "") + '"' + hero + ">" +
      '<div class="xpk-head-t">' +
      (save ? '<span class="xpk-badge">' + esc(fill(this.t.badge || "Save {save}", { save: save })) + "</span>" : "") +
      '<h2 class="xpk-title">' + esc(this.t.title) + "</h2>" +
      (this.t.subtitle ? '<p class="xpk-sub">' + esc(this.t.subtitle) + "</p>" : "") +
      "</div></div>"
    );
  };

  Kit.prototype.builderHtml = function () {
    var inner;
    if (this.phase === "quiz") inner = this.quizHtml();
    else if (this.phase === "review") inner = this.reviewHtml();
    else if (this.phase === "added") inner = this.addedHtml();
    else inner = this.design === "split" ? this.splitHtml() : this.design === "focus" ? this.focusHtml() : this.journeyHtml();
    return '<div class="xpk-in" data-phase="' + this.phase + '">' + this.headHtml() + inner + "</div>";
  };

  // ── Quiz ──
  Kit.prototype.quizHtml = function () {
    var self = this;
    var qs = this.k.quiz.questions || [];
    var q = qs[this.qi];
    if (!q) return "";
    var dots = qs.map(function (x, i) { return '<span class="' + (i < self.qi ? "is-done" : i === self.qi ? "is-on" : "") + '"></span>'; }).join("");
    var opts = (q.options || [])
      .map(function (o, i) {
        var on = self.answers[q.id] === o.id;
        return '<button type="button" class="xpk-opt' + (on ? " is-on" : "") + '" data-act="answer" data-q="' + esc(q.id) + '" data-o="' + esc(o.id) + '" style="--i:' + i + '"><span class="xpk-opt-k">' + String.fromCharCode(65 + i) + "</span><span>" + esc(self.label(o.id, o.label)) + "</span>" + (on ? ICON.check : "") + "</button>";
      })
      .join("");
    return (
      '<div class="xpk-quiz xpk-anim" data-dir="' + this.dir + '">' +
      '<div class="xpk-quiz-top"><span class="xpk-quiz-t">' + esc(this.t.quizTitle) + '</span><span class="xpk-dots">' + dots + "</span></div>" +
      '<h3 class="xpk-q">' + esc(this.label(q.id, q.title)) + "</h3>" +
      '<div class="xpk-opts">' + opts + "</div>" +
      '<div class="xpk-quiz-foot">' +
      (this.qi > 0 ? '<button type="button" class="xpk-link" data-act="qback">' + ICON.back + esc(this.t.back) + "</button>" : "<span></span>") +
      '<button type="button" class="xpk-link" data-act="qskip">' + esc(this.t.quizSkip) + "</button>" +
      "</div></div>"
    );
  };

  // ── Steps (shared) ──
  Kit.prototype.ruleText = function (s) {
    var n = this.count(s);
    var mx = num(s.max, 1);
    if (s.pick === "many") return n ? fill(this.t.pickedCount, { n: n, max: mx }) : num(s.min, 0) === mx ? fill(this.t.pickExact, { count: mx }) : fill(this.t.pickRange, { min: num(s.min, 0), max: mx });
    return (num(s.min, 0) === 0 ? (this.t.optional || "Optional") + " · " : "") + (this.t.pickOne || "Pick 1");
  };
  Kit.prototype.stepHead = function (s, vi, total) {
    return (
      '<div class="xpk-shead">' +
      '<span class="xpk-stepof">' + esc(fill(this.t.stepOf, { n: vi + 1, total: total })) + "</span>" +
      '<h3 class="xpk-stitle">' + esc(this.label(s.id, s.title) || fill(this.t.stepOf, { n: vi + 1, total: total })) + "</h3>" +
      (s.subtitle || this.label(s.id + ":s") ? '<p class="xpk-ssub">' + esc(this.label(s.id + ":s", s.subtitle)) + "</p>" : "") +
      '<span class="xpk-rule' + (this.done(s) && this.count(s) ? " is-ok" : "") + '">' + (this.done(s) && this.count(s) ? ICON.check : "") + esc(this.ruleText(s)) + "</span>" +
      "</div>"
    );
  };
  Kit.prototype.filtersHtml = function (s) {
    var self = this;
    if (!(s.filters || []).length) return "";
    var cur = this.filter[s.id] || "";
    var chips = ['<button type="button" class="xpk-chip' + (!cur ? " is-on" : "") + '" data-act="filter" data-s="' + esc(s.id) + '" data-f="">' + esc(this.t.allFilter || "All") + "</button>"];
    s.filters.forEach(function (f) {
      chips.push('<button type="button" class="xpk-chip' + (cur === f.id ? " is-on" : "") + '" data-act="filter" data-s="' + esc(s.id) + '" data-f="' + esc(f.id) + '">' + esc(self.label(f.id, f.label)) + "</button>");
    });
    return '<div class="xpk-chips" role="toolbar">' + chips.join("") + "</div>";
  };
  Kit.prototype.cardHtml = function (s, h, i) {
    var p = this.products[h];
    if (p === false) return "";
    if (!p) return '<div class="xpk-card is-skel" style="--i:' + i + '"><span class="xpk-img"></span><span class="xpk-sk"></span><span class="xpk-sk is-s"></span></div>';
    var hide = this.k.hideSoldOut;
    if (hide && !p.available) return "";
    var picks = this.picks[s.id] || [];
    var mine = picks.filter(function (pk) { return pk.h === h; });
    var on = mine.length > 0;
    var sel = this.sel && this.sel[s.id + "|" + h];
    var v = sel ? this.variantOf(h, sel) : (on ? this.variantOf(h, mine[0].v) : null) || this.firstAvailable(p) || p.variants[0];
    var sold = !v || !v.available;
    var full = s.pick === "many" && this.count(s) >= num(s.max, 1) && !on;
    var multi = s.pick === "many" && this.k.allowDuplicates;
    var price = v ? '<span class="xpk-price">' + (v.compare > v.price ? "<s>" + esc(this.ctx.money(v.compare)) + "</s>" : "") + "<b>" + esc(this.ctx.money(v.price)) + "</b></span>" : "";
    var opts = "";
    if (p.variants.length > 1) {
      var self = this;
      opts =
        '<div class="xpk-sel"><select data-k="variant" data-s="' + esc(s.id) + '" data-h="' + esc(h) + '" aria-label="' + esc(p.title) + '">' +
        p.variants
          .filter(function (x) { return !hide || x.available; })
          .map(function (x) { return '<option value="' + esc(x.id) + '"' + (v && x.id === v.id ? " selected" : "") + (x.available ? "" : " disabled") + ">" + esc(x.title + (x.available ? "" : " · " + self.t.soldOut)) + "</option>"; })
          .join("") +
        "</select><i></i></div>";
    }
    var btn;
    if (sold) btn = '<button type="button" class="xpk-pick" disabled>' + esc(this.t.soldOut) + "</button>";
    else if (multi && on)
      btn =
        '<div class="xpk-step-qty"><button type="button" data-act="dec" data-s="' + esc(s.id) + '" data-h="' + esc(h) + '" aria-label="' + esc(this.t.remove) + '">' + ICON.minus + "</button><b>" + mine.length + '</b><button type="button" data-act="inc" data-s="' + esc(s.id) + '" data-h="' + esc(h) + '" data-v="' + esc(v.id) + '"' + (this.count(s) >= num(s.max, 1) ? " disabled" : "") + ' aria-label="+">' + ICON.plus + "</button></div>";
    else btn = '<button type="button" class="xpk-pick' + (on ? " is-on" : "") + '" data-act="pick" data-s="' + esc(s.id) + '" data-h="' + esc(h) + '" data-v="' + esc(v.id) + '"' + (full ? " disabled" : "") + ' aria-pressed="' + on + '">' + (on ? ICON.check + "<span>" + esc(this.t.selected) + "</span>" : "<span>" + esc(this.t.choose) + "</span>") + "</button>";
    var im = (v && v.image) || p.image;
    return (
      '<div class="xpk-card' + (on ? " is-on" : "") + (sold ? " is-sold" : "") + (full ? " is-dim" : "") + '" data-h="' + esc(h) + '" style="--i:' + i + '">' +
      '<div class="xpk-img">' + (im ? '<img src="' + esc(img(im, 420)) + '" alt="' + esc(p.title) + '" loading="lazy">' : "") + (on ? '<span class="xpk-tick">' + ICON.check + "</span>" : "") + "</div>" +
      '<div class="xpk-cbody"><span class="xpk-pname">' + esc(p.title) + "</span>" + price + opts + btn + "</div>" +
      "</div>"
    );
  };
  Kit.prototype.gridHtml = function (s) {
    var self = this;
    var list = this.shown(s).slice(0, 60);
    var cards = list.map(function (h, i) { return self.cardHtml(s, h, i); }).join("");
    if (!list.length || (this.loaded && !cards)) cards = '<p class="xpk-empty">' + esc(this.t.empty) + "</p>";
    return '<div class="xpk-products xpk-anim" data-dir="' + this.dir + '" data-step="' + esc(s.id) + '">' + cards + "</div>";
  };
  Kit.prototype.navBtns = function (s, vi, total, compact) {
    var last = vi === total - 1;
    var canNext = this.done(s);
    var ready = this.complete();
    var nextLabel = last ? (ready ? this.t.review : this.t.next) : this.t.next;
    var out = "";
    if (vi > 0) out += '<button type="button" class="xpk-btn is-ghost" data-act="back">' + ICON.back + (compact ? "" : "<span>" + esc(this.t.back) + "</span>") + "</button>";
    if (num(s.min, 0) === 0 && !this.count(s) && !last) out += '<button type="button" class="xpk-link" data-act="skip">' + esc(this.t.skip) + "</button>";
    if (s.pick === "many" || last || num(s.min, 0) === 0 || this.count(s)) out += '<button type="button" class="xpk-btn xpk-next' + (canNext ? " is-ready" : "") + '" data-act="next"' + (canNext && (!last || ready) ? "" : " disabled") + "><span>" + esc(nextLabel) + "</span>" + ICON.next + "</button>";
    return '<div class="xpk-navs">' + out + "</div>";
  };

  Kit.prototype.trayHtml = function () {
    var self = this;
    var sm = this.summary();
    var vis = this.visible();
    var slots = [];
    vis.forEach(function (s, vi) {
      var list = self.picks[s.id] || [];
      var cap = Math.max(1, Math.min(num(s.max, 1), 4));
      for (var k = 0; k < cap; k++) {
        var pk = list[k];
        var p = pk && self.products[pk.h];
        if (pk && p) {
          var v = self.variantOf(pk.h, pk.v);
          var im = (v && v.image) || p.image;
          slots.push('<button type="button" class="xpk-slot is-full" data-act="unpick" data-s="' + esc(s.id) + '" data-k="' + k + '" data-key="' + esc(s.id + ":" + pk.h + ":" + k) + '" title="' + esc(self.t.remove + ": " + p.title) + '">' + (im ? '<img src="' + esc(img(im, 120)) + '" alt="">' : "") + '<i class="xpk-slot-x">' + ICON.x + "</i></button>");
        } else if (k < Math.max(1, num(s.min, 0)) || k === list.length) {
          slots.push('<button type="button" class="xpk-slot' + (vi === self.view && self.phase === "steps" ? " is-next" : "") + (num(s.min, 0) === 0 ? " is-opt" : "") + '" data-act="goto" data-vi="' + vi + '" aria-label="' + esc(self.label(s.id, s.title)) + '"><b>' + (vi + 1) + "</b></button>");
        }
      }
    });
    var giftHtml = "";
    var g = this.k.gift;
    if (g && g.handle) {
      var gp = this.products[g.handle];
      var on = this.giftOn(sm.n);
      giftHtml = '<span class="xpk-gift' + (on ? " is-on" : "") + '" title="' + esc(gp ? gp.title : "") + '">' + ICON.gift + "</span>";
    }
    var ready = this.complete();
    var pct = sm.gross > 0 && sm.off > 0 ? Math.round((sm.off / sm.gross) * 100) : 0;
    var msg = ready ? (sm.off > 0 ? fill(this.t.ready, { saved: this.ctx.money(sm.off) }) : this.t.readyNoSave) : this.needText();
    return (
      '<div class="xpk-tray' + (ready ? " is-ready" : "") + '">' +
      '<div class="xpk-slots">' + slots.join("") + giftHtml + "</div>" +
      '<div class="xpk-sum">' +
      '<div class="xpk-tot"><span class="xpk-tot-l">' + esc(this.t.total) + (pct ? ' <em class="xpk-save">' + esc(fill(this.t.saveTag, { percent: pct })) + "</em>" : "") + "</span>" +
      "<span>" + (sm.off > 0 ? "<s>" + esc(this.ctx.money(sm.gross)) + "</s> " : "") + '<b data-xpk-total="' + sm.total + '">' + esc(this.ctx.money(sm.total)) + "</b></span></div>" +
      '<p class="xpk-status">' + esc(msg) + "</p>" +
      "</div>" +
      '<button type="button" class="xpk-btn xpk-cta' + (ready ? " is-ready" : "") + '" data-act="add"' + (ready && !this.busy ? "" : " disabled") + ">" + esc(this.busy ? this.t.adding : this.t.addButton) + "</button>" +
      "</div>"
    );
  };
  Kit.prototype.needText = function () {
    var self = this;
    var rem = 0;
    this.visible().forEach(function (s) { rem += Math.max(0, num(s.min, 0) - self.count(s)); });
    if (!rem && !this.allPicks().length) rem = 1;
    return fill(this.t.needMore, { remaining: rem });
  };
  Kit.prototype.msgHtml = function () {
    return this.msg ? '<p class="xpk-msg is-' + (this.msgKind || "ok") + '" role="status">' + esc(this.msg) + "</p>" : "";
  };

  // ── Journey ──
  Kit.prototype.pillsHtml = function () {
    var self = this;
    var vis = this.visible();
    return (
      '<div class="xpk-pills" role="tablist">' +
      vis
        .map(function (s, vi) {
          var on = vi === self.view;
          var ok = self.done(s) && self.count(s) > 0;
          var pk = (self.picks[s.id] || [])[0];
          var p = pk && self.products[pk.h];
          var can = vi <= self.view || self.canReach(vi);
          return (
            '<button type="button" role="tab" class="xpk-pill' + (on ? " is-on" : "") + (ok ? " is-ok" : "") + '" data-act="goto" data-vi="' + vi + '"' + (can ? "" : " disabled") + ' aria-selected="' + on + '">' +
            '<span class="xpk-pill-n">' + (ok && p && p.image ? '<img src="' + esc(img(p.image, 80)) + '" alt="">' : ok ? ICON.check : vi + 1) + "</span>" +
            '<span class="xpk-pill-t">' + esc(self.label(s.id, s.title) || fill(self.t.stepOf, { n: vi + 1, total: vis.length })) + "</span>" +
            "</button>"
          );
        })
        .join('<span class="xpk-pill-line" aria-hidden="true"></span>') +
      "</div>"
    );
  };
  Kit.prototype.canReach = function (vi) {
    var vis = this.visible();
    for (var i = 0; i < vi; i++) if (!this.done(vis[i])) return false;
    return true;
  };
  Kit.prototype.journeyHtml = function () {
    var vis = this.visible();
    var s = vis[this.view];
    if (!s) return "";
    return (
      this.pillsHtml() +
      '<div class="xpk-stage">' +
      this.stepHead(s, this.view, vis.length) +
      this.filtersHtml(s) +
      this.gridHtml(s) +
      this.navBtns(s, this.view, vis.length) +
      "</div>" +
      this.trayHtml() +
      this.msgHtml()
    );
  };

  // ── Split ──
  Kit.prototype.splitHtml = function () {
    var self = this;
    var vis = this.visible();
    var s = vis[this.view];
    if (!s) return "";
    var list = vis
      .map(function (x, vi) {
        var picks = self.picks[x.id] || [];
        var names = picks
          .map(function (pk) {
            var p = self.products[pk.h];
            return p ? esc(p.title) : "";
          })
          .filter(Boolean)
          .join(", ");
        var ok = self.done(x) && picks.length > 0;
        var can = vi <= self.view || self.canReach(vi);
        return (
          '<button type="button" class="xpk-srow' + (vi === self.view ? " is-on" : "") + (ok ? " is-ok" : "") + '" data-act="goto" data-vi="' + vi + '"' + (can ? "" : " disabled") + ">" +
          '<span class="xpk-srow-n">' + (ok ? ICON.check : vi + 1) + "</span>" +
          '<span class="xpk-srow-t"><b>' + esc(self.label(x.id, x.title) || fill(self.t.stepOf, { n: vi + 1, total: vis.length })) + "</b><small>" + (names || esc(self.ruleText(x))) + "</small></span>" +
          "</button>"
        );
      })
      .join("");
    return (
      '<div class="xpk-split">' +
      '<aside class="xpk-side"><div class="xpk-srows">' + list + "</div>" + this.trayHtml() + "</aside>" +
      '<div class="xpk-stage">' + this.stepHead(s, this.view, vis.length) + this.filtersHtml(s) + this.gridHtml(s) + this.navBtns(s, this.view, vis.length) + "</div>" +
      "</div>" +
      this.msgHtml()
    );
  };

  // ── Focus ──
  Kit.prototype.focusHtml = function () {
    var vis = this.visible();
    var s = vis[this.view];
    if (!s) return "";
    var pct = Math.round(((this.view + (this.done(s) && this.count(s) ? 1 : 0)) / vis.length) * 100);
    var sm = this.summary();
    return (
      '<div class="xpk-progress" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
      '<div class="xpk-stage">' +
      this.stepHead(s, this.view, vis.length) +
      this.filtersHtml(s) +
      this.gridHtml(s) +
      "</div>" +
      '<div class="xpk-fbar">' +
      '<div class="xpk-fsum"><span>' + esc(this.t.total) + "</span><b>" + esc(this.ctx.money(sm.total)) + "</b></div>" +
      this.navBtns(s, this.view, vis.length, true) +
      "</div>" +
      this.msgHtml()
    );
  };

  // ── Review / added ──
  Kit.prototype.reviewHtml = function () {
    var self = this;
    var vis = this.visible();
    var rows = vis
      .map(function (s, vi) {
        var picks = self.picks[s.id] || [];
        var items = picks
          .map(function (pk, k) {
            var p = self.products[pk.h];
            var v = self.variantOf(pk.h, pk.v);
            if (!p || !v) return "";
            var im = v.image || p.image;
            return (
              '<div class="xpk-ritem" style="--i:' + (vi + k) + '">' +
              '<span class="xpk-rimg">' + (im ? '<img src="' + esc(img(im, 140)) + '" alt="">' : "") + "</span>" +
              '<span class="xpk-rname"><b>' + esc(p.title) + "</b>" + (v.title ? "<small>" + esc(v.title) + "</small>" : "") + "</span>" +
              '<span class="xpk-rprice">' + esc(self.ctx.money(v.price)) + "</span>" +
              "</div>"
            );
          })
          .join("");
        return (
          '<div class="xpk-rstep"><div class="xpk-rstep-h"><span>' + esc(self.label(s.id, s.title) || fill(self.t.stepOf, { n: vi + 1, total: vis.length })) + '</span><button type="button" class="xpk-link" data-act="goto" data-vi="' + vi + '">' + esc(self.t.change) + "</button></div>" +
          (items || '<p class="xpk-rnone">—</p>') +
          "</div>"
        );
      })
      .join("");
    return (
      '<div class="xpk-review xpk-anim" data-dir="1"><h3 class="xpk-stitle">' + esc(this.t.reviewTitle) + "</h3>" + rows + "</div>" +
      this.trayHtml() +
      '<div class="xpk-rfoot"><button type="button" class="xpk-link" data-act="back">' + ICON.back + esc(this.t.back) + '</button><button type="button" class="xpk-link" data-act="restart">' + esc(this.t.startOver) + "</button></div>" +
      this.msgHtml()
    );
  };
  Kit.prototype.addedHtml = function () {
    return (
      '<div class="xpk-added xpk-anim" data-dir="1"><span class="xpk-added-ic">' + ICON.check + "</span><h3>" + esc(this.t.addedMsg) + "</h3>" +
      '<button type="button" class="xpk-link" data-act="restart">' + esc(this.t.startOver) + "</button></div>"
    );
  };

  // ─────────────────────────────────────────────────────────
  // Motion
  // ─────────────────────────────────────────────────────────
  Kit.prototype.animateIn = function (el, gridOnly) {
    if (calm()) return;
    var a = el.querySelectorAll(".xpk-anim");
    for (var i = 0; i < a.length; i++) a[i].classList.add("is-enter");
    if (!gridOnly) {
      var head = el.querySelector(".xpk-in");
      if (head && !this.shownOnce) head.classList.add("is-first");
      this.shownOnce = true;
    }
  };
  /** Diff-based effects: new tray slots pop, the total counts up, the CTA shines when ready. */
  Kit.prototype.fx = function (el) {
    if (calm()) {
      this.prevKeys = this.slotKeys(el);
      return;
    }
    var keys = this.slotKeys(el);
    var prev = this.prevKeys || {};
    var self = this;
    var newest = null;
    for (var k in keys) {
      if (!prev[k]) {
        keys[k].classList.add("is-pop");
        newest = keys[k];
      }
    }
    if (newest && this.flyFrom) this.fly(this.flyFrom, newest);
    this.flyFrom = null;
    var tot = el.querySelector("[data-xpk-total]");
    if (tot) {
      var to = num(tot.getAttribute("data-xpk-total"));
      var from = this.prevTotal == null ? to : this.prevTotal;
      if (from !== to) this.countUp(tot, from, to);
      this.prevTotal = to;
    }
    var ready = this.complete();
    if (ready && !this.wasReady) {
      var cta = el.querySelector(".xpk-tray .xpk-cta");
      if (cta) {
        cta.classList.add("is-shine");
        this.burst(cta);
      }
    }
    this.wasReady = ready;
    this.prevKeys = keys;
    void self;
  };
  Kit.prototype.slotKeys = function (el) {
    var out = {};
    var list = el.querySelectorAll(".xpk-slot.is-full[data-key]");
    for (var i = 0; i < list.length; i++) out[list[i].getAttribute("data-key")] = list[i];
    return out;
  };
  Kit.prototype.countUp = function (el, from, to) {
    var self = this;
    var start = null;
    var dur = 520;
    function step(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = self.ctx.money(Math.round(from + (to - from) * e));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    el.classList.remove("is-bump");
    void el.offsetWidth;
    el.classList.add("is-bump");
  };
  Kit.prototype.fly = function (from, target) {
    if (!from || !from.r || !from.src || !target || !target.animate) return;
    var a = from.r;
    var b = target.getBoundingClientRect();
    if (!a.width || !b.width) return;
    var g = document.createElement("img");
    g.src = from.src;
    g.alt = "";
    g.className = "xpk-ghost";
    g.style.cssText = "position:fixed;z-index:2147483600;pointer-events:none;object-fit:cover;border-radius:12px;left:" + a.left + "px;top:" + a.top + "px;width:" + a.width + "px;height:" + a.height + "px";
    document.body.appendChild(g);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2);
    var dy = b.top + b.height / 2 - (a.top + a.height / 2);
    var sc = b.width / a.width;
    var anim = g.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: "translate(" + dx * 0.5 + "px," + (dy * 0.5 - 50) + "px) scale(" + (0.5 + sc / 2) + ")", opacity: 1, offset: 0.55 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(" + sc + ")", opacity: 0.6 },
      ],
      { duration: 620, easing: "cubic-bezier(.55,0,.25,1)" },
    );
    anim.onfinish = function () { g.remove(); };
  };
  Kit.prototype.burst = function (el) {
    if (!el.animate) return;
    var r = el.getBoundingClientRect();
    if (!r.width) return;
    for (var i = 0; i < 10; i++) {
      var s = document.createElement("i");
      s.className = "xpk-spark";
      s.style.cssText = "position:fixed;z-index:2147483600;pointer-events:none;left:" + (r.left + r.width / 2) + "px;top:" + (r.top + r.height / 2) + "px";
      document.body.appendChild(s);
      var ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
      var dist = 40 + Math.random() * 30;
      var an = s.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          { transform: "translate(" + (Math.cos(ang) * dist - 3) + "px," + (Math.sin(ang) * dist - 3) + "px) scale(.2)", opacity: 0 },
        ],
        { duration: 650 + Math.random() * 200, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
      (function (n) { an.onfinish = function () { n.remove(); }; })(s);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────
  Kit.prototype.findStep = function (id) {
    var out = null;
    (this.k.steps || []).forEach(function (s) { if (s.id === id) out = s; });
    return out;
  };
  Kit.prototype.go = function (vi) {
    var vis = this.visible();
    vi = Math.max(0, Math.min(vis.length - 1, vi));
    this.dir = vi >= this.view ? 1 : -1;
    this.view = vi;
    this.phase = "steps";
    this.msg = "";
    this.render();
    this.ensure();
    this.scrollTop();
  };
  Kit.prototype.scrollTop = function () {
    var host = this.overlay && !this.overlay.hidden ? this.overlay.querySelector(".xpk-panel-body") : null;
    if (host) {
      host.scrollTop = 0;
      return;
    }
    if (this.ctx.preview) return;
    var r = this.root.getBoundingClientRect();
    if (r.top < 0) window.scrollTo({ top: window.pageYOffset + r.top - 16, behavior: calm() ? "auto" : "smooth" });
  };
  Kit.prototype.advance = function () {
    var vis = this.visible();
    if (this.view < vis.length - 1) this.go(this.view + 1);
    else if (this.complete()) {
      this.dir = 1;
      this.phase = "review";
      this.render();
      this.scrollTop();
    }
  };

  Kit.prototype.onChange = function (e) {
    var el = e.target;
    if (el.getAttribute("data-k") !== "variant") return;
    var s = this.findStep(el.getAttribute("data-s"));
    var h = el.getAttribute("data-h");
    if (!s) return;
    this.sel = this.sel || {};
    this.sel[s.id + "|" + h] = el.value;
    (this.picks[s.id] || []).forEach(function (pk) { if (pk.h === h) pk.v = el.value; });
    this.quietNext = true;
    this.render(true);
  };

  Kit.prototype.onClick = function (e) {
    var btn = e.target.closest && e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");
    var self = this;
    var s = btn.getAttribute("data-s") ? this.findStep(btn.getAttribute("data-s")) : null;
    switch (act) {
      case "open":
        this.open();
        return;
      case "close":
        this.close();
        return;
      case "answer": {
        var q = btn.getAttribute("data-q");
        this.answers[q] = btn.getAttribute("data-o");
        // Answers can hide steps or change products, so drop picks that no longer fit
        this.prune();
        btn.classList.add("is-on", "is-press");
        var qs = this.k.quiz.questions || [];
        setTimeout(
          function () {
            self.dir = 1;
            if (self.qi < qs.length - 1) self.qi += 1;
            else {
              self.phase = "steps";
              self.view = 0;
            }
            self.render();
            self.ensure();
          },
          calm() ? 0 : 320,
        );
        return;
      }
      case "qback":
        this.dir = -1;
        this.qi = Math.max(0, this.qi - 1);
        this.render();
        return;
      case "qskip":
        this.answers = {};
        this.phase = "steps";
        this.view = 0;
        this.dir = 1;
        this.render();
        this.ensure();
        return;
      case "filter":
        if (!s) return;
        this.filter[s.id] = btn.getAttribute("data-f") || "";
        this.dir = 0;
        this.render();
        this.ensure();
        return;
      case "pick":
      case "inc":
        if (s) this.pick(s, btn.getAttribute("data-h"), btn.getAttribute("data-v"), btn, act === "inc");
        return;
      case "dec":
        if (s) this.unpickHandle(s, btn.getAttribute("data-h"));
        return;
      case "unpick":
        if (s) {
          var k = num(btn.getAttribute("data-k"), 0);
          this.picks[s.id].splice(k, 1);
          if (this.phase === "review" && !this.complete()) this.phase = "steps";
          this.quietNext = true;
          this.render(true);
        }
        return;
      case "goto":
        this.go(num(btn.getAttribute("data-vi"), 0));
        return;
      case "next":
        this.advance();
        return;
      case "skip":
        this.advance();
        return;
      case "back":
        if (this.phase === "review") {
          this.dir = -1;
          this.phase = "steps";
          this.render();
        } else if (this.view > 0) this.go(this.view - 1);
        else if (this.k.quiz && this.k.quiz.enabled && (this.k.quiz.questions || []).length) {
          this.dir = -1;
          this.phase = "quiz";
          this.render();
        }
        return;
      case "restart":
        this.reset();
        this.render();
        this.ensure();
        this.scrollTop();
        return;
      case "add":
        this.addToCart();
        return;
    }
  };

  Kit.prototype.prune = function () {
    var self = this;
    (this.k.steps || []).forEach(function (s) {
      if (!self.stepVisible(s)) {
        self.picks[s.id] = [];
        return;
      }
      var pool = self.pool(s);
      var extra = [];
      (s.filters || []).forEach(function (f) { extra = extra.concat(f.handles || []); });
      self.picks[s.id] = (self.picks[s.id] || []).filter(function (pk) { return pool.indexOf(pk.h) !== -1 || extra.indexOf(pk.h) !== -1; });
    });
  };

  Kit.prototype.pick = function (s, h, vid, btn, add) {
    var list = this.picks[s.id] || (this.picks[s.id] = []);
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].h === h) idx = i;
    var card = btn && btn.closest ? btn.closest(".xpk-card") : null;
    var el = card ? card.querySelector(".xpk-img img") : null;
    var im = el ? { r: el.getBoundingClientRect(), src: el.currentSrc || el.src } : null;
    if (s.pick !== "many") {
      if (idx !== -1) {
        // Tapping the chosen product again unselects it
        list.splice(idx, 1);
        this.quietNext = true;
        this.render(true);
        return;
      }
      this.picks[s.id] = [{ h: h, v: vid }];
      this.flyFrom = im;
      this.trackPick();
      this.quietNext = true;
      this.render(true);
      var self = this;
      var vis = this.visible();
      var last = this.view >= vis.length - 1;
      setTimeout(
        function () {
          if (self.phase !== "steps") return;
          if (!last) self.go(self.view + 1);
          else if (self.complete()) {
            self.dir = 1;
            self.phase = "review";
            self.render();
            self.scrollTop();
          }
        },
        calm() ? 60 : 560,
      );
      return;
    }
    if (idx !== -1 && !add) {
      list.splice(idx, 1);
    } else {
      if (list.length >= num(s.max, 1)) return;
      if (idx !== -1 && !this.k.allowDuplicates) return;
      list.push({ h: h, v: vid });
      this.flyFrom = im;
      this.trackPick();
    }
    this.quietNext = true;
    this.render(true);
  };
  Kit.prototype.unpickHandle = function (s, h) {
    var list = this.picks[s.id] || [];
    for (var i = list.length - 1; i >= 0; i--)
      if (list[i].h === h) {
        list.splice(i, 1);
        break;
      }
    this.quietNext = true;
    this.render(true);
  };
  Kit.prototype.trackPick = function () {
    if (window.XPT && !this.ctx.preview) window.XPT.track("kb", "c", { o: this.k.id, d: "pick" });
  };

  // ── Overlay ──
  Kit.prototype.open = function () {
    if (!this.overlay) return;
    this.lastFocus = document.activeElement;
    this.overlay.hidden = false;
    this.overlay.innerHTML = "";
    document.documentElement.classList.add("xpk-lock");
    this.renderOverlay();
    var ov = this.overlay;
    if (!calm()) {
      ov.classList.add("is-opening");
      setTimeout(function () { ov.classList.remove("is-opening"); }, 480);
    }
    var f = ov.querySelector(".xpk-close");
    if (f) f.focus();
    this.ensure();
  };
  Kit.prototype.close = function () {
    if (!this.overlay || this.overlay.hidden) return;
    this.overlay.hidden = true;
    this.overlay.innerHTML = "";
    document.documentElement.classList.remove("xpk-lock");
    this.root.innerHTML = this.launcherHtml();
    if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
  };
  Kit.prototype.trap = function (e) {
    var f = this.overlay.querySelectorAll("button:not([disabled]), select, a[href]");
    if (!f.length) return;
    var a = f[0];
    var b = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault();
      b.focus();
    } else if (!e.shiftKey && document.activeElement === b) {
      e.preventDefault();
      a.focus();
    }
  };

  // ─────────────────────────────────────────────────────────
  // Add to cart
  // ─────────────────────────────────────────────────────────
  Kit.prototype.cartItems = function () {
    var self = this;
    var k = this.k;
    var iid = rid();
    var label = this.t.lineLabel || "Kit";
    var title = this.t.title || k.name || "Kit";
    var lines = {};
    var order = [];
    var n = 0;
    function push(variantId, stepKey, qty) {
      var key = variantId + "|" + stepKey;
      if (!lines[key]) {
        var props = {};
        props["_xpb"] = k.id + "|" + iid + "|" + stepKey;
        props[label] = title;
        lines[key] = { id: Number(variantId), quantity: 0, properties: props };
        order.push(key);
      }
      lines[key].quantity += qty;
    }
    this.visible().forEach(function (s) {
      var si = self.stepIndex(s);
      (self.picks[s.id] || []).forEach(function (pk) {
        push(pk.v, String(si), 1);
        n += 1;
      });
    });
    var items = order.map(function (key) {
      lines[key].properties["_xpoost_src"] = "kb:" + k.id + ":" + n;
      return lines[key];
    });
    if (this.giftOn(n)) {
      var gp = {};
      gp["_xpb"] = k.id + "|" + iid + "|g";
      gp["_xpoost_src"] = "kb:" + k.id + ":gift";
      gp[label] = title;
      items.push({ id: Number(k.gift.variantId), quantity: 1, properties: gp });
    }
    return items;
  };
  Kit.prototype.addToCart = function () {
    if (this.busy || !this.complete()) return;
    var self = this;
    var items = this.cartItems();
    var sm = this.summary();
    if (this.ctx.preview) {
      this.phase = "added";
      this.render();
      return;
    }
    this.busy = true;
    this.quietNext = true;
    this.render(true);
    var after = this.k.afterAdd || "drawer";
    var root = this.ctx.root || "/";
    function done(engine) {
      self.busy = false;
      if (window.XPT) window.XPT.track("kb", "a", { o: self.k.id, d: String(sm.n), v: Math.round(sm.total) / 100 });
      if (after === "cart") {
        window.location.href = root + "cart";
        return;
      }
      if (after === "checkout") {
        window.location.href = root + "checkout";
        return;
      }
      self.reset();
      self.msg = self.t.addedMsg;
      self.msgKind = "ok";
      if (self.overlay) {
        self.close();
      } else {
        self.phase = "added";
        self.render();
      }
      if (after === "drawer") {
        if (engine && window.XPoostCart) window.XPoostCart.refresh(engine);
        else refreshCart();
      }
    }
    function fail(text) {
      self.busy = false;
      self.msg = text || self.t.errorMsg;
      self.msgKind = "err";
      self.render(true);
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
      .then(function (j) { done(useEngine ? j : null); })
      .catch(function (err) { fail(err && err.message && err.message !== "add failed" ? err.message : ""); });
  };
  Kit.prototype.reset = function () {
    var self = this;
    (this.k.steps || []).forEach(function (s) { self.picks[s.id] = []; });
    this.answers = {};
    this.filter = {};
    this.qi = 0;
    this.view = 0;
    this.dir = -1;
    this.wasReady = false;
    this.phase = this.k.quiz && this.k.quiz.enabled && (this.k.quiz.questions || []).length ? "quiz" : "steps";
  };

  function refreshCart() {
    try {
      document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true, detail: { sourceId: "xpoost-kit" } }));
      var drawer = document.querySelector("cart-drawer-component") || document.querySelector("cart-drawer");
      if (drawer) {
        var sectionId = (document.querySelector("cart-items-component[data-section-id]") || {}).dataset;
        sectionId = (sectionId && sectionId.sectionId) || "cart-drawer";
        fetch(((window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/") + "?sections=" + encodeURIComponent(sectionId) + ",cart-icon-bubble")
          .then(function (r) { return r.json(); })
          .then(function (sections) {
            document.dispatchEvent(new CustomEvent("cart:update", { bubbles: true, detail: { resource: null, sourceId: "xpoost-kit", data: { sections: sections, source: "xpoost" } } }));
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
  // Boot
  // ─────────────────────────────────────────────────────────
  function matchesPlacement(k, ds) {
    var pl = k.placement || {};
    var mode = pl.mode || "in_bundle";
    var pid = ds.productId || "";
    var colls = (ds.collections || "").split(",").filter(Boolean);
    if (ds.kitId) return k.id === ds.kitId;
    if (!pid) return mode === "landing";
    switch (mode) {
      case "all":
        return true;
      case "products":
        return (pl.products || []).indexOf(pid) !== -1;
      case "collections":
        return (pl.collections || []).some(function (c) { return colls.indexOf(c) !== -1; });
      case "exclude":
        return (pl.products || []).indexOf(pid) === -1 && !(pl.collections || []).some(function (c) { return colls.indexOf(c) !== -1; });
      case "in_bundle":
        return (k.productIds || []).indexOf(pid) !== -1 || (k.collectionIds || []).some(function (c) { return colls.indexOf(c) !== -1; });
      default:
        return false;
    }
  }
  function deviceOk(k) {
    var d = k.device || "all";
    if (d === "all") return true;
    var mobile = window.matchMedia ? window.matchMedia("(max-width: 749px)").matches : false;
    return d === "mobile" ? mobile : !mobile;
  }

  function boot(el) {
    if (el.__xpk) return;
    el.__xpk = true;
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
    var qs = "?locale=" + encodeURIComponent(locale) + "&country=" + encodeURIComponent(ds.country || "") + "&market=" + encodeURIComponent(ds.market || "") + (ds.kitId ? "&kit=" + encodeURIComponent(ds.kitId) : "");
    fetch((ds.proxy || "/apps/xpoost/kits") + qs, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = (data && data.kits) || [];
        var pick = null;
        for (var i = 0; i < list.length; i++) {
          if (matchesPlacement(list[i], ds) && deviceOk(list[i])) {
            pick = list[i];
            break;
          }
        }
        if (!pick) {
          if (ds.kitId && ds.landing) el.innerHTML = '<p class="xpk-gone">' + esc(ds.emptyText || "") + "</p>";
          else el.remove();
          return;
        }
        if (ds.landing) pick.display = "page";
        el.hidden = false;
        ctx.popup = !data || data.productPopup !== false;
        new Kit(el, pick, ctx);
      })
      .catch(function () { el.remove(); });
  }
  function scan() {
    var els = document.querySelectorAll("[data-xpk-root]");
    for (var i = 0; i < els.length; i++) boot(els[i]);
  }

  window.XPK = {
    __v: 1,
    mount: function (el, kit, ctx) {
      var c = ctx || {};
      if (!c.money) c.money = function (v) { return formatMoney(v, c.moneyFormat || "${{amount}}", c.currency); };
      if (!c.rate) c.rate = 1;
      return new Kit(el, kit, c);
    },
    discount: kitDiscount,
    scan: scan,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  document.addEventListener("shopify:section:load", scan);
})();
