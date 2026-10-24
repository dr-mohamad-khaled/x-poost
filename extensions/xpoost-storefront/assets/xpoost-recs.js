/**
 * XPoost Product Recommendations (storefront).
 *
 * Sources: Shopify's own recommendations (related / complementary), products the merchant
 * picked, or a collection. Designs: cards | compact | checklist | mini | carousel | inline.
 *
 * Prices are a preview. An offer price is checked at checkout by the "XPoost Bundles" Shopify
 * Function: it applies only when the product on this page is in the cart too.
 *
 * The same file renders the admin preview (ctx.preview = true).
 */
(function () {
  "use strict";
  if (window.XPR && window.XPR.__v) return;

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
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function calm() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

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
    var image = p.featured_image || (p.images && p.images[0]) || "";
    if (image && typeof image === "object") image = image.src || image.url || "";
    return {
      __n: 1,
      id: String(p.id),
      handle: p.handle,
      title: p.title,
      url: p.url || "/products/" + p.handle,
      image: image,
      variants: variants,
      available: variants.some(function (v) { return v.available; }),
    };
  }

  // ─────────────────────────────────────────────────────────
  // Data
  // ─────────────────────────────────────────────────────────
  function getJson(url) {
    return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }
  function loadByHandles(handles, root) {
    return Promise.all(
      handles.map(function (h) {
        return getJson(root + "products/" + encodeURIComponent(h) + ".js").then(normalizeProduct).catch(function () { return null; });
      }),
    ).then(function (list) { return list.filter(Boolean); });
  }
  function loadShopify(pid, intent, root) {
    if (!pid) return Promise.resolve([]);
    var url = root + "recommendations/products.json?product_id=" + encodeURIComponent(pid) + "&limit=10&intent=" + (intent === "complementary" ? "complementary" : "related");
    return getJson(url)
      .then(function (j) { return ((j && j.products) || []).map(normalizeProduct).filter(Boolean); })
      .catch(function () { return []; });
  }
  function loadCartIds(root) {
    return getJson(root + "cart.js")
      .then(function (c) {
        var ids = {};
        ((c && c.items) || []).forEach(function (it) { ids[String(it.product_id)] = 1; });
        return ids;
      })
      .catch(function () { return {}; });
  }

  // ─────────────────────────────────────────────────────────
  // Widget
  // ─────────────────────────────────────────────────────────
  function Widget(root, rec, products, ctx) {
    this.root = root;
    this.r = rec;
    this.t = rec.texts || {};
    this.ctx = ctx;
    this.ratings = ctx.ratings || {};
    var self = this;
    this.items = products.map(function (p) {
      var v = self.firstAvailable(p);
      return { p: p, vid: v ? v.id : p.variants[0] && p.variants[0].id, qty: 1, on: true, state: "" };
    });
    this.root.classList.add("xpr");
    this.root.setAttribute("data-design", rec.design || "cards");
    if (ctx.rtl) this.root.setAttribute("dir", "rtl");
    this.applyStyle();
    this.root.addEventListener("click", function (e) { self.onClick(e); });
    this.root.addEventListener("change", function (e) { self.onChange(e); });
    this.bindPopup();
    this.render(true);
    if (window.XPT && !ctx.preview) window.XPT.observe(this.root, "rc", { o: "recs", d: rec.design });
    if (rec.showRating && !ctx.preview) this.loadRatings();
  }

  /* Product popup: tapping a product photo or name shows its details instead of leaving the page; the popup's button adds it like the card's button. */
  Widget.prototype.bindPopup = function () {
    if (!this.ctx.popup || this.ctx.preview || !window.XPoostQV) return;
    var self = this, s = this.r.style || {};
    window.XPoostQV.bind(this.root, {
      card: ".xpr-it",
      hit: ".xpr-imgl, .xpr-img, .xpr-name",
      handle: function (c) { var it = self.items[Number(c.getAttribute("data-i"))]; return it ? it.p.handle : ""; },
      action: function (c) {
        var b = c.querySelector('button[data-act="add"]');
        if (b) return b;
        var cb = c.querySelector('input[data-k="on"]');
        return cb ? { el: cb, label: cb.checked ? self.t.added || "✓" : self.t.add || "Add" } : null;
      },
      price: function (c) { return c.querySelector(".xpr-price"); },
      colors: { accent: s.accent, bg: s.bg, text: s.text, muted: s.muted, border: s.border, btn: s.btnBg, btnText: s.btnText },
      dir: this.ctx.rtl ? "rtl" : "ltr",
    });
  };

  Widget.prototype.applyStyle = function () {
    var s = this.r.style || {};
    var st = this.root.style;
    var map = { "--xpr-accent": s.accent, "--xpr-bg": s.bg, "--xpr-text": s.text, "--xpr-muted": s.muted, "--xpr-border": s.border, "--xpr-btn": s.btnBg, "--xpr-btn-text": s.btnText, "--xpr-badge": s.badgeBg, "--xpr-badge-text": s.badgeText, "--xpr-star": s.star };
    for (var k in map) if (map[k]) st.setProperty(k, map[k]);
    st.setProperty("--xpr-radius", num(s.radius, 12) + "px");
    st.setProperty("--xpr-ratio", s.imageRatio === "portrait" ? "4 / 5" : s.imageRatio === "natural" ? "auto" : "1 / 1");
    st.setProperty("--xpr-cols", String(Math.max(1, Math.min(this.items.length || 1, this.r.design === "mini" ? 4 : 3))));
    if (s.font === "system") this.root.classList.add("xpr-sys");
    if (s.customCss && !this.root.querySelector("style[data-xpr]")) {
      var tag = document.createElement("style");
      tag.setAttribute("data-xpr", "1");
      tag.textContent = String(s.customCss).replace(/<\/?style/gi, "");
      this.root.parentNode && this.root.parentNode.insertBefore(tag, this.root);
    }
  };

  Widget.prototype.firstAvailable = function (p) {
    for (var i = 0; i < p.variants.length; i++) if (p.variants[i].available) return p.variants[i];
    return p.variants[0] || null;
  };
  Widget.prototype.variant = function (it) {
    for (var i = 0; i < it.p.variants.length; i++) if (it.p.variants[i].id === it.vid) return it.p.variants[i];
    return it.p.variants[0];
  };
  Widget.prototype.offerCents = function (price) {
    var o = this.r.offer || {};
    if (o.mode === "percent") return Math.round((price * Math.min(100, num(o.value))) / 100);
    if (o.mode === "amount") return Math.min(price, Math.round(num(o.value) * (this.ctx.rate || 1) * 100));
    return 0;
  };
  Widget.prototype.offerLabel = function () {
    var o = this.r.offer || {};
    if (o.mode === "percent" && num(o.value) > 0) return fill(this.t.save, { value: Math.round(num(o.value)) + "%" });
    if (o.mode === "amount" && num(o.value) > 0) return fill(this.t.save, { value: this.ctx.money(Math.round(num(o.value) * (this.ctx.rate || 1) * 100)) });
    return "";
  };

  Widget.prototype.loadRatings = function () {
    var self = this;
    var ids = this.items.map(function (it) { return it.p.id; }).filter(function (id) { return !self.ratings[id]; });
    if (!ids.length) return;
    getJson((this.ctx.proxy || "/apps/xpoost/recs") + "?ratings=" + ids.join(","))
      .then(function (j) {
        var r = (j && j.ratings) || {};
        var any = false;
        for (var k in r) {
          self.ratings[k] = r[k];
          any = true;
        }
        if (any) self.render(false);
      })
      .catch(function () {});
  };

  // ── Pieces ──
  Widget.prototype.stars = function (it) {
    if (!this.r.showRating) return "";
    var rt = this.ratings[it.p.id];
    if (!rt || !(rt.r > 0)) return "";
    var pct = Math.max(0, Math.min(100, (rt.r / 5) * 100));
    return (
      '<div class="xpr-stars" aria-label="' + esc(rt.r + " / 5") + '"><span class="xpr-stars-bg">★★★★★</span><span class="xpr-stars-fg" style="width:' + pct.toFixed(0) + '%">★★★★★</span>' +
      (rt.n ? '<span class="xpr-stars-n">(' + rt.n + ")</span>" : "") +
      "</div>"
    );
  };
  Widget.prototype.price = function (it) {
    var v = this.variant(it);
    if (!v) return "";
    var off = this.offerCents(v.price);
    var now = v.price - off;
    var was = off > 0 ? v.price : this.r.showCompare && v.compare > v.price ? v.compare : 0;
    return (
      '<div class="xpr-price">' +
      (was ? '<s class="xpr-was">' + esc(this.ctx.money(was)) + "</s>" : "") +
      '<span class="xpr-now' + (was ? " is-sale" : "") + '">' + esc(this.ctx.money(now)) + "</span>" +
      "</div>"
    );
  };
  Widget.prototype.select = function (it, i) {
    if (!this.r.showVariants || it.p.variants.length < 2) return "";
    var self = this;
    var hide = this.r.hideSoldOut;
    var opts = it.p.variants
      .filter(function (v) { return !hide || v.available || v.id === it.vid; })
      .map(function (v) {
        return '<option value="' + esc(v.id) + '"' + (v.id === it.vid ? " selected" : "") + (v.available ? "" : " disabled") + ">" + esc(v.title + (v.available ? "" : " · " + (self.t.soldOut || "Sold out"))) + "</option>";
      })
      .join("");
    return '<div class="xpr-sel"><select data-i="' + i + '" data-k="v" aria-label="' + esc(it.p.title) + '">' + opts + '</select><i aria-hidden="true"></i></div>';
  };
  Widget.prototype.qty = function (it, i) {
    if (!this.r.showQty) return "";
    return (
      '<div class="xpr-qty" role="group" aria-label="Quantity">' +
      '<button type="button" data-act="dec" data-i="' + i + '" aria-label="−"' + (it.qty <= 1 ? " disabled" : "") + ">−</button>" +
      '<span aria-live="polite">' + it.qty + "</span>" +
      '<button type="button" data-act="inc" data-i="' + i + '" aria-label="+">+</button>' +
      "</div>"
    );
  };
  Widget.prototype.addBtn = function (it, i, round) {
    var v = this.variant(it);
    var sold = !v || !v.available;
    var label = sold ? this.t.soldOut || "Sold out" : it.state === "busy" ? this.t.adding || "Adding…" : it.state === "done" ? this.t.added || "Added" : this.t.add || "Add";
    var cls = "xpr-add" + (round ? " is-round" : "") + (it.state === "done" ? " is-done" : "") + (it.state === "busy" ? " is-busy" : "");
    var inner = round
      ? it.state === "done"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
      : (it.state === "done" ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>' : "") + "<span>" + esc(label) + "</span>";
    return '<button type="button" class="' + cls + '" data-act="add" data-i="' + i + '"' + (sold || it.state === "busy" ? " disabled" : "") + ' aria-label="' + esc(label + " " + it.p.title) + '">' + inner + "</button>";
  };
  Widget.prototype.thumb = function (it, w) {
    var v = this.variant(it);
    var src = (v && v.image) || it.p.image;
    return src ? '<img src="' + esc(img(src, w)) + '" alt="' + esc(it.p.title) + '" loading="lazy" width="' + w + '" height="' + w + '">' : '<span class="xpr-noimg"></span>';
  };
  Widget.prototype.link = function (it, inner, cls) {
    return '<a class="' + (cls || "xpr-link") + '" href="' + esc(it.p.url) + '">' + inner + "</a>";
  };

  Widget.prototype.head = function () {
    var badge = this.offerLabel();
    var nav = this.r.design === "carousel" && this.items.length > 2
      ? '<div class="xpr-nav"><button type="button" data-act="prev" aria-label="' + esc(this.t.prev || "Previous") + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" data-act="next" aria-label="' + esc(this.t.next || "Next") + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>'
      : "";
    return (
      '<div class="xpr-head"><div class="xpr-head-t">' +
      (this.t.title ? '<h3 class="xpr-title">' + esc(this.t.title) + "</h3>" : "") +
      (this.t.subtitle ? '<p class="xpr-sub">' + esc(this.t.subtitle) + "</p>" : "") +
      "</div>" +
      (badge ? '<span class="xpr-badge">' + esc(badge) + "</span>" : "") +
      nav +
      "</div>"
    );
  };

  // ── Designs ──
  Widget.prototype.cards = function () {
    var self = this;
    return (
      '<div class="xpr-grid">' +
      this.items
        .map(function (it, i) {
          return (
            '<div class="xpr-card xpr-it" data-i="' + i + '">' +
            self.link(it, '<span class="xpr-img">' + self.thumb(it, 360) + "</span>", "xpr-imgl") +
            '<div class="xpr-body">' +
            self.link(it, esc(it.p.title), "xpr-name") +
            self.stars(it) +
            self.price(it) +
            self.select(it, i) +
            self.qty(it, i) +
            self.addBtn(it, i) +
            "</div></div>"
          );
        })
        .join("") +
      "</div>"
    );
  };
  Widget.prototype.compact = function () {
    var self = this;
    return (
      '<div class="xpr-rows">' +
      this.items
        .map(function (it, i) {
          return (
            '<div class="xpr-row xpr-it" data-i="' + i + '">' +
            self.link(it, '<span class="xpr-img">' + self.thumb(it, 160) + "</span>", "xpr-imgl") +
            '<div class="xpr-row-main">' +
            self.link(it, esc(it.p.title), "xpr-name") +
            self.stars(it) +
            self.price(it) +
            self.select(it, i) +
            "</div>" +
            '<div class="xpr-row-act">' + self.qty(it, i) + self.addBtn(it, i) + "</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  };
  Widget.prototype.checklist = function () {
    var self = this;
    var total = 0;
    var count = 0;
    var anyDone = false;
    this.items.forEach(function (it) {
      var v = self.variant(it);
      if (it.on && v && v.available) {
        total += (v.price - self.offerCents(v.price)) * it.qty;
        count += it.qty;
      }
      if (it.state === "done") anyDone = true;
    });
    var busy = this.items.some(function (it) { return it.state === "busy"; });
    var label = busy ? this.t.adding || "Adding…" : anyDone && !count ? this.t.added || "Added" : fill(this.t.addSelected || "Add {count} to cart", { count: count });
    return (
      '<div class="xpr-list">' +
      this.items
        .map(function (it, i) {
          var v = self.variant(it);
          var sold = !v || !v.available;
          return (
            '<label class="xpr-chk xpr-it' + (it.on && !sold ? " is-on" : "") + (sold ? " is-sold" : "") + (it.state === "done" ? " is-done" : "") + '" data-i="' + i + '">' +
            '<input type="checkbox" data-i="' + i + '" data-k="on"' + (it.on && !sold ? " checked" : "") + (sold ? " disabled" : "") + ">" +
            '<span class="xpr-box" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span>' +
            '<span class="xpr-img">' + self.thumb(it, 120) + "</span>" +
            '<span class="xpr-chk-main"><span class="xpr-name">' + esc(it.p.title) + "</span>" + self.stars(it) + self.select(it, i) + "</span>" +
            self.price(it) +
            "</label>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="xpr-foot"><div class="xpr-total"><span>' + esc(this.t.total || "Total") + '</span><b data-xpr-total="' + total + '">' + esc(this.ctx.money(total)) + "</b></div>" +
      '<button type="button" class="xpr-add xpr-addall' + (anyDone && !count ? " is-done" : "") + '" data-act="addall"' + (!count || busy ? " disabled" : "") + "><span>" + esc(label) + "</span></button></div>"
    );
  };
  Widget.prototype.mini = function () {
    var self = this;
    return (
      '<div class="xpr-grid xpr-minis">' +
      this.items
        .map(function (it, i) {
          var v = self.variant(it);
          var off = v ? self.offerCents(v.price) : 0;
          return (
            '<div class="xpr-mini xpr-it" data-i="' + i + '">' +
            '<div class="xpr-mini-img">' +
            self.link(it, '<span class="xpr-img">' + self.thumb(it, 280) + "</span>", "xpr-imgl") +
            (v ? '<span class="xpr-chip">' + esc(self.ctx.money(v.price - off)) + "</span>" : "") +
            self.addBtn(it, i, true) +
            "</div>" +
            self.link(it, esc(it.p.title), "xpr-name") +
            self.select(it, i) +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  };
  Widget.prototype.carousel = function () {
    var self = this;
    return (
      '<div class="xpr-track" tabindex="0">' +
      this.items
        .map(function (it, i) {
          return (
            '<div class="xpr-slide xpr-it" data-i="' + i + '">' +
            self.link(it, '<span class="xpr-img">' + self.thumb(it, 320) + "</span>", "xpr-imgl") +
            '<div class="xpr-body">' +
            self.link(it, esc(it.p.title), "xpr-name") +
            self.stars(it) +
            self.price(it) +
            self.select(it, i) +
            self.addBtn(it, i) +
            "</div></div>"
          );
        })
        .join("") +
      "</div>"
    );
  };
  Widget.prototype.inline = function () {
    var self = this;
    return (
      '<div class="xpr-chips">' +
      this.items
        .map(function (it, i) {
          return (
            '<div class="xpr-pill xpr-it" data-i="' + i + '">' +
            '<span class="xpr-img">' + self.thumb(it, 96) + "</span>" +
            '<span class="xpr-pill-main">' + self.link(it, esc(it.p.title), "xpr-name") + self.price(it) + "</span>" +
            self.select(it, i) +
            self.addBtn(it, i, true) +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  };

  Widget.prototype.render = function (first) {
    var d = this.r.design || "cards";
    var body = typeof this[d] === "function" ? this[d]() : this.cards();
    var hint = this.offerLabel() && this.t.offerHint ? '<p class="xpr-hint">' + esc(this.t.offerHint) + "</p>" : "";
    var msg = this.msg ? '<p class="xpr-msg is-' + (this.msgKind || "ok") + '" role="status">' + esc(this.msg) + "</p>" : "";
    var scroll = 0;
    var tr = this.root.querySelector(".xpr-track");
    if (tr) scroll = tr.scrollLeft;
    this.root.innerHTML = '<div class="xpr-in">' + this.head() + body + hint + msg + "</div>";
    if (scroll) {
      var nt = this.root.querySelector(".xpr-track");
      if (nt) nt.scrollLeft = scroll;
    }
    if (first && !calm()) {
      this.root.classList.add("is-in");
      var list = this.root.querySelectorAll(".xpr-it");
      for (var i = 0; i < list.length; i++) list[i].style.animationDelay = 60 + i * 70 + "ms";
    }
  };

  // ── Events ──
  Widget.prototype.onChange = function (e) {
    var el = e.target;
    var i = num(el.getAttribute("data-i"), -1);
    var it = this.items[i];
    if (!it) return;
    if (el.getAttribute("data-k") === "v") {
      it.vid = el.value;
      it.state = "";
      this.render(false);
    } else if (el.getAttribute("data-k") === "on") {
      it.on = el.checked;
      it.state = "";
      this.render(false);
      this.bumpTotal();
    }
  };
  Widget.prototype.bumpTotal = function () {
    var b = this.root.querySelector(".xpr-total b");
    if (!b || calm()) return;
    b.classList.remove("is-bump");
    void b.offsetWidth;
    b.classList.add("is-bump");
  };
  Widget.prototype.onClick = function (e) {
    var btn = e.target.closest && e.target.closest("button[data-act]");
    if (!btn || !this.root.contains(btn)) return;
    var act = btn.getAttribute("data-act");
    var i = num(btn.getAttribute("data-i"), -1);
    var it = this.items[i];
    if (act === "prev" || act === "next") {
      var tr = this.root.querySelector(".xpr-track");
      if (tr) {
        var dir = (act === "next" ? 1 : -1) * (this.ctx.rtl ? -1 : 1);
        tr.scrollBy({ left: dir * tr.clientWidth * 0.8, behavior: calm() ? "auto" : "smooth" });
      }
      return;
    }
    if (act === "inc" && it) {
      it.qty = Math.min(99, it.qty + 1);
      it.state = "";
      this.render(false);
      return;
    }
    if (act === "dec" && it) {
      it.qty = Math.max(1, it.qty - 1);
      it.state = "";
      this.render(false);
      return;
    }
    if (act === "add" && it) {
      e.preventDefault();
      this.add([i], btn);
      return;
    }
    if (act === "addall") {
      var self = this;
      var list = [];
      this.items.forEach(function (x, k) {
        var v = self.variant(x);
        if (x.on && v && v.available && x.state !== "done") list.push(k);
      });
      if (list.length) this.add(list, btn);
    }
  };

  Widget.prototype.fly = function (fromEl) {
    if (calm() || !fromEl || !fromEl.animate) return;
    var im = fromEl.querySelector && fromEl.querySelector("img");
    var target = document.querySelector("#cart-icon-bubble, [data-cart-count], .header__icon--cart, a[href$='/cart']");
    if (!im || !target) return;
    var a = im.getBoundingClientRect();
    var b = target.getBoundingClientRect();
    if (!a.width || !b.width) return;
    var g = im.cloneNode(true);
    g.className = "xpr-fly";
    g.style.cssText = "position:fixed;z-index:2147483000;pointer-events:none;border-radius:12px;object-fit:cover;left:" + a.left + "px;top:" + a.top + "px;width:" + a.width + "px;height:" + a.height + "px";
    document.body.appendChild(g);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2);
    var dy = b.top + b.height / 2 - (a.top + a.height / 2);
    var anim = g.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: "translate(" + dx * 0.55 + "px," + (dy * 0.55 - 60) + "px) scale(.5)", opacity: 0.95, offset: 0.6 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(.12)", opacity: 0.2 },
      ],
      { duration: 720, easing: "cubic-bezier(.5,0,.2,1)" },
    );
    anim.onfinish = function () { g.remove(); };
  };

  Widget.prototype.add = function (idxs, btn) {
    var self = this;
    var items = [];
    var value = 0;
    var anchor = this.ctx.productId || "";
    var withOffer = this.r.offer && this.r.offer.mode !== "none" && num(this.r.offer.value) > 0 && anchor;
    idxs.forEach(function (i) {
      var it = self.items[i];
      var v = self.variant(it);
      if (!v || !v.available) return;
      var props = { _xpoost_src: "rc:recs:" + it.p.id };
      if (withOffer) props._xpr = String(anchor);
      items.push({ id: Number(v.id), quantity: it.qty, properties: props });
      value += (v.price - self.offerCents(v.price)) * it.qty;
      it.state = "busy";
    });
    if (!items.length) return;
    if (window.XPT && !this.ctx.preview) window.XPT.track("rc", "c", { o: "recs", d: this.r.design });
    this.msg = "";
    this.render(false);
    var flyFrom = btn && btn.closest ? btn.closest(".xpr-it") || this.root.querySelector(".xpr-it.is-on") : null;

    function done(engine) {
      idxs.forEach(function (i) {
        if (self.items[i].state === "busy") self.items[i].state = "done";
      });
      if (window.XPT && !self.ctx.preview) window.XPT.track("rc", "a", { o: "recs", d: self.r.design, v: Math.round(value) / 100 });
      self.render(false);
      self.pop();
      self.fly(flyFrom);
      if (self.ctx.preview) return;
      var after = self.r.afterAdd || "drawer";
      if (after === "cart") {
        window.location.href = (self.ctx.root || "/") + "cart";
        return;
      }
      if (after === "drawer") {
        if (engine && window.XPoostCart) window.XPoostCart.refresh(engine);
        else refreshCart();
      } else refreshCount();
    }
    function fail(text) {
      idxs.forEach(function (i) {
        if (self.items[i].state === "busy") self.items[i].state = "";
      });
      self.msg = text || self.t.errorMsg || "Couldn't add it. Please try again.";
      self.msgKind = "err";
      self.render(false);
    }
    if (this.ctx.preview) {
      setTimeout(function () { done(null); }, 450);
      return;
    }
    var xc = window.XPoostCart;
    var useEngine = (this.r.afterAdd || "drawer") === "drawer" && xc && typeof xc.refresh === "function";
    var body = { items: items };
    if (useEngine && typeof xc.sectionId === "function") {
      body.sections = xc.sectionId();
      body.sections_url = window.location.pathname;
    }
    fetch((this.ctx.root || "/") + "cart/add.js", {
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

  /** Little success pulse on the buttons that just turned to "Added". */
  Widget.prototype.pop = function () {
    if (calm()) return;
    var list = this.root.querySelectorAll(".xpr-add.is-done");
    for (var i = 0; i < list.length; i++) {
      list[i].classList.add("is-pop");
      (function (el) {
        setTimeout(function () { el.classList.remove("is-pop"); }, 700);
      })(list[i]);
    }
  };

  function refreshCount() {
    try {
      document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true, detail: { sourceId: "xpoost-recs" } }));
    } catch (e) {}
  }
  function refreshCart() {
    try {
      document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true, detail: { sourceId: "xpoost-recs" } }));
      var drawer = document.querySelector("cart-drawer-component") || document.querySelector("cart-drawer");
      if (drawer) {
        var sectionId = (document.querySelector("cart-items-component[data-section-id]") || {}).dataset;
        sectionId = (sectionId && sectionId.sectionId) || "cart-drawer";
        fetch(((window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/") + "?sections=" + encodeURIComponent(sectionId) + ",cart-icon-bubble")
          .then(function (r) { return r.json(); })
          .then(function (sections) {
            document.dispatchEvent(new CustomEvent("cart:update", { bubbles: true, detail: { resource: null, sourceId: "xpoost-recs", data: { sections: sections, source: "xpoost" } } }));
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
  function placementOk(rec, ds) {
    var pl = rec.placement || {};
    var pid = ds.productId || "";
    var colls = (ds.collections || "").split(",").filter(Boolean);
    var inColl = (pl.collections || []).some(function (c) { return colls.indexOf(c) !== -1; });
    switch (pl.mode) {
      case "products":
        return (pl.products || []).indexOf(pid) !== -1;
      case "collections":
        return inColl;
      case "exclude":
        return (pl.products || []).indexOf(pid) === -1 && !inColl;
      default:
        return true;
    }
  }
  function deviceOk(rec) {
    var d = rec.device || "all";
    if (d === "all") return true;
    var mobile = window.matchMedia ? window.matchMedia("(max-width: 749px)").matches : false;
    return d === "mobile" ? mobile : !mobile;
  }

  /** Picks the products to show from what each source returned. */
  function choose(rec, list, pid, inCart) {
    var seen = {};
    var out = [];
    (rec.shuffle ? shuffle(list) : list).forEach(function (p) {
      if (!p || seen[p.id] || p.id === String(pid)) return;
      if (rec.hideInCart && inCart[p.id]) return;
      if (rec.hideSoldOut && !p.available) return;
      seen[p.id] = 1;
      out.push(p);
    });
    return out.slice(0, Math.max(1, num(rec.count, 3)));
  }

  function boot(el) {
    if (el.__xpr) return;
    el.__xpr = true;
    var ds = el.dataset;
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";
    var rate = num(window.Shopify && window.Shopify.currency && window.Shopify.currency.rate, 1) || 1;
    var locale = (ds.locale || document.documentElement.lang || "en").split("-")[0].toLowerCase();
    var proxy = ds.proxy || "/apps/xpoost/recs";
    var ctx = {
      rate: rate,
      root: root,
      proxy: proxy,
      productId: ds.productId || "",
      rtl: locale === "ar" || document.documentElement.dir === "rtl",
      money: function (c) { return formatMoney(c, ds.moneyFormat, ds.currency); },
    };
    getJson(proxy + "?locale=" + encodeURIComponent(locale))
      .then(function (data) {
        var rec = data && data.rec;
        if (!rec || !placementOk(rec, ds) || !deviceOk(rec)) throw new Error("off");
        var cartP = rec.hideInCart ? loadCartIds(root) : Promise.resolve({});
        var listP;
        if (rec.source === "related" || rec.source === "complementary") {
          listP = loadShopify(ctx.productId, rec.source, root).then(function (list) {
            // Nothing from Shopify yet: fall back to the products the merchant picked
            return list.length || !(rec.handles || []).length ? list : loadByHandles(rec.handles.slice(0, 12), root);
          });
        } else {
          listP = loadByHandles((rec.shuffle ? shuffle(rec.handles || []) : rec.handles || []).slice(0, 16), root);
        }
        return Promise.all([listP, cartP]).then(function (res) {
          var list = choose(rec, res[0], ctx.productId, res[1]);
          if (!list.length) throw new Error("empty");
          el.hidden = false;
          ctx.popup = data.productPopup !== false;
          new Widget(el, rec, list, ctx);
        });
      })
      .catch(function () { el.remove(); });
  }

  function scan() {
    var els = document.querySelectorAll("[data-xpr-root]");
    for (var i = 0; i < els.length; i++) boot(els[i]);
  }

  window.XPR = {
    __v: 1,
    mount: function (el, rec, products, ctx) {
      var c = ctx || {};
      if (!c.money) c.money = function (v) { return formatMoney(v, c.moneyFormat || "${{amount}}", c.currency); };
      if (!c.rate) c.rate = 1;
      return new Widget(el, rec, products.map(function (p) { return p && p.__n ? p : normalizeProduct(p); }).filter(Boolean), c);
    },
    scan: scan,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  document.addEventListener("shopify:section:load", scan);
})();
