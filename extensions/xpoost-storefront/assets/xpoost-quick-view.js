/*
 * XPoost Product Popup (shared by every XPoost feature that shows products).
 *
 * Tapping a product's photo or name opens its details in a popup instead of leaving the page:
 * the card's photo flies into a gallery, then the name, price, description and the feature's own
 * button (Choose / Add / Select) rise in. The button does exactly what the card's button does,
 * so offers, kit steps and tracking keep working. Closing flies the photo back into its card.
 *
 * Usage from a feature script:
 *   XPoostQV.bind(rootEl, {
 *     card: ".my-card",                    // product card selector inside rootEl
 *     hit: ".my-img, .my-name",            // what opens the popup (photo, name)
 *     handle: function (card) { ... },     // product handle for that card
 *     action: function (card) { ... },     // card button to press, or { el, label }, or null
 *     price: function (card) { ... },      // optional element whose text is the card's price
 *     colors: { accent, bg, text, muted, border, btn, btnText }, // optional, neutral by default
 *     dir: "rtl" | "ltr"
 *   });
 * Ctrl/Cmd/middle click still opens the product page. Respects "reduce motion".
 */
(function () {
  "use strict";
  if (window.XPoostQV) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";
  var LANG = String(document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  var DICT = {
    en: { close: "Close", page: "View full product page", err: "Couldn't load this product. Try again.", from: "From" },
    ar: { close: "اقفل", page: "شوف صفحة المنتج كاملة", err: "مقدرناش نحمّل المنتج. جرّب تاني.", from: "من" },
    fr: { close: "Fermer", page: "Voir la page produit", err: "Impossible de charger ce produit. Réessayez.", from: "À partir de" },
    de: { close: "Schließen", page: "Zur Produktseite", err: "Produkt konnte nicht geladen werden. Bitte erneut versuchen.", from: "Ab" },
    es: { close: "Cerrar", page: "Ver la página del producto", err: "No se pudo cargar el producto. Inténtalo de nuevo.", from: "Desde" },
    it: { close: "Chiudi", page: "Vai alla pagina del prodotto", err: "Impossibile caricare il prodotto. Riprova.", from: "Da" },
    pt: { close: "Fechar", page: "Ver página do produto", err: "Não foi possível carregar o produto. Tente novamente.", from: "A partir de" }
  };
  var T = DICT[LANG] || DICT.en;

  var CSS = [
    "html.xqv-lock{overflow:hidden}",
    ".xqv{--xqv-accent:#111111;--xqv-btn:var(--xqv-accent);--xqv-btn-text:#ffffff;--xqv-bg:#ffffff;--xqv-text:#111111;--xqv-muted:color-mix(in srgb,var(--xqv-text) 68%,var(--xqv-bg));--xqv-border:color-mix(in srgb,var(--xqv-text) 14%,transparent);",
    "position:fixed;inset:0;z-index:2147483600;display:flex;align-items:flex-end;justify-content:center;color:var(--xqv-text);line-height:1.5;font-family:inherit;text-align:start}",
    ".xqv[hidden]{display:none}",
    ".xqv *,.xqv *::before,.xqv *::after{box-sizing:border-box}",
    ".xqv button{font-family:inherit}",
    ".xqv :focus-visible{outline:2px solid var(--xqv-accent);outline-offset:2px}",
    ".xqv__bg{position:absolute;inset:0;background:rgba(0,0,0,.6);opacity:0;transition:opacity .3s ease}",
    ".xqv.is-open .xqv__bg{opacity:1}",
    ".xqv__panel{position:relative;width:100%;height:88vh;height:88dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--xqv-bg);border:1px solid var(--xqv-border);border-bottom:0;border-radius:22px 22px 0 0;opacity:0;transform:translateY(24px);transition:opacity .28s ease,transform .36s cubic-bezier(.2,.8,.2,1);box-shadow:0 -20px 60px -20px rgba(0,0,0,.45)}",
    ".xqv.is-open .xqv__panel,.xqv.is-fly .xqv__panel{transform:none}",
    ".xqv.is-open .xqv__panel{opacity:1}",
    ".xqv__x{position:absolute;z-index:6;top:12px;inset-inline-end:12px;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid var(--xqv-border);border-radius:99px;background:var(--xqv-bg);color:var(--xqv-text);font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.12)}",
    ".xqv__x svg{width:14px;height:14px}",
    ".xqv__body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}",
    ".xqv__stage{position:relative;height:42vh;height:42dvh;min-height:240px;background:color-mix(in srgb,var(--xqv-text) 4%,var(--xqv-bg))}",
    ".xqv__track{position:relative;height:100%;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}",
    ".xqv__track::-webkit-scrollbar{display:none}",
    ".xqv__slide{position:relative;flex:0 0 100%;height:100%;scroll-snap-align:center;display:flex;align-items:center;justify-content:center;padding:58px 0 30px}",
    ".xqv__box{position:relative;height:100%;aspect-ratio:var(--ar,1);max-width:84%;border-radius:var(--br,14px);overflow:hidden;background:#fff}",
    ".xqv__box--skel{background:color-mix(in srgb,var(--xqv-text) 8%,var(--xqv-bg))}",
    ".xqv__hero,.xqv__more{position:absolute;inset:0;width:100%;height:100%;object-fit:var(--fit,contain)}",
    ".xqv__more{object-fit:contain}",
    ".xqv__dots{position:absolute;z-index:3;bottom:10px;left:0;right:0;display:flex;justify-content:center;gap:6px}",
    ".xqv__dots button{width:7px;height:7px;padding:0;border:0;border-radius:99px;background:var(--xqv-text);opacity:.3;cursor:pointer;transition:width .3s ease,opacity .3s ease}",
    ".xqv__dots button.is-on{width:20px;opacity:1;background:var(--xqv-accent)}",
    ".xqv__info{padding:16px 18px calc(22px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px}",
    ".xqv__brand{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--xqv-muted);margin-bottom:-6px}",
    ".xqv__title{margin:0;font-size:20px;line-height:1.35;font-weight:700;color:var(--xqv-text)}",
    ".xqv__price{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;margin:0;font-size:19px;font-weight:800;color:var(--xqv-text);unicode-bidi:plaintext}",
    ".xqv__price s,.xqv__price del,.xqv__price [class*=orig],.xqv__price [class*=compare]{font-size:14px;font-weight:500;color:var(--xqv-muted);text-decoration:line-through}",
    ".xqv__price [class*=pill],.xqv__price [class*=badge]{font-size:12px;font-weight:800;padding:2px 8px;border-radius:99px;background:var(--xqv-accent);color:var(--xqv-btn-text)}",
    ".xqv__act{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 18px;border:0;border-radius:14px;background:var(--xqv-btn);color:var(--xqv-btn-text);font-size:16px;font-weight:800;cursor:pointer;transition:transform .15s ease}",
    ".xqv__act:not([disabled]):active{transform:scale(.97)}",
    ".xqv__act[disabled]{opacity:.45;cursor:not-allowed}",
    ".xqv__act svg{width:18px;height:18px}",
    ".xqv__page{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:14px;border:1px solid var(--xqv-border);color:var(--xqv-text);font-weight:700;font-size:14.5px;text-decoration:none}",
    ".xqv__msg{margin:0;font-size:14px;color:var(--xqv-muted)}",
    ".xqv__desc{border-top:1px solid var(--xqv-border);padding-top:14px;color:var(--xqv-muted);font-size:14px;line-height:1.75;overflow-wrap:anywhere}",
    ".xqv__desc img,.xqv__desc video,.xqv__desc iframe{max-width:100%;height:auto}",
    ".xqv__desc a{color:var(--xqv-accent)}",
    ".xqv__desc h1,.xqv__desc h2,.xqv__desc h3,.xqv__desc h4,.xqv__desc strong{color:var(--xqv-text)}",
    ".xqv__skel{display:block;height:12px;border-radius:6px;background:color-mix(in srgb,var(--xqv-text) 9%,var(--xqv-bg));margin:6px 0;animation:xqv-blink .9s ease-in-out infinite alternate}",
    ".xqv__skel--t{height:22px;width:75%}",
    ".xqv__skel--s{width:45%}",
    ".xqv__fly{position:fixed;z-index:2147483601;margin:0;pointer-events:none;transform-origin:0 0;will-change:transform}",
    ".xqv__info>*{opacity:0;transform:translateY(12px)}",
    ".xqv.is-in .xqv__info>*{opacity:1;transform:none;transition:opacity .4s ease,transform .5s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--k,0)*55ms)}",
    "@keyframes xqv-blink{from{opacity:.45}to{opacity:1}}",
    "@media (min-width:750px){",
    ".xqv{align-items:center;padding:24px}",
    ".xqv__panel{width:min(940px,100%);height:min(86vh,620px);border-radius:22px;border-bottom:1px solid var(--xqv-border);transform:translateY(18px) scale(.985)}",
    ".xqv__body{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);align-items:start}",
    ".xqv__stage{position:sticky;top:0;height:min(86vh,620px);min-height:0}",
    ".xqv__slide{padding:44px 0 36px}",
    ".xqv__info{padding:64px 28px 28px}",
    ".xqv__title{font-size:24px}",
    "}",
    "@media (prefers-reduced-motion:reduce){.xqv *,.xqv *::before,.xqv *::after{animation:none!important;transition:none!important}.xqv__info>*{opacity:1;transform:none}}"
  ].join("\n");

  var X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function sized(u, w) {
    if (!u) return u;
    u = String(u);
    if (u.indexOf("//") === 0) u = "https:" + u;
    if (u.indexOf("data:") === 0) return u;
    return u.replace(/([?&])width=\d+&?/, "$1").replace(/[?&]$/, "") + (u.indexOf("?") > -1 ? "&" : "?") + "width=" + w;
  }
  /* Same photo whatever the size, domain or CDN path: compare file names only. */
  function base(u) { return String(u || "").split("?")[0].split("/").pop().replace(/_\d+x\d*(?=\.)/, "").replace(/_(pico|icon|thumb|small|compact|medium|large|grande|original|master)(?=\.)/, ""); }
  function visible(r) { return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }
  /* Black or white text, whichever reads better on a hex color. */
  function readable(hex) {
    var m = String(hex || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return "";
    var h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
    var c = [0, 2, 4].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.4 ? "#111111" : "#ffffff";
  }
  function handleFromHref(href) {
    var m = String(href || "").match(/\/products\/([^/?#]+)/);
    if (!m) return "";
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }

  /* Product descriptions often hide blocks (opacity:0) until a scroll script reveals them.
     Scripts don't run inside a popup, so those blocks are shown here the way the product page shows them. */
  function reveal(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll("script"), function (s) { s.remove(); });
    var run = function () {
      var els = root.getElementsByTagName("*"), i, cs;
      for (i = 0; i < els.length; i++) {
        cs = getComputedStyle(els[i]);
        if (parseFloat(cs.opacity) < 0.05 && cs.animationName === "none") {
          els[i].style.setProperty("opacity", "1", "important");
          if (cs.transform !== "none") els[i].style.setProperty("transform", "none", "important");
        }
      }
    };
    requestAnimationFrame(function () { run(); setTimeout(run, 500); });
  }

  var CACHE = {};
  function loadProduct(h) {
    if (!h) return Promise.reject(new Error("no handle"));
    if (CACHE[h]) return CACHE[h];
    CACHE[h] = fetch(ROOT.replace(/\/?$/, "/") + "products/" + encodeURIComponent(h) + ".js", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function (e) { delete CACHE[h]; throw e; });
    return CACHE[h];
  }

  /* The photo the shopper tapped: the largest loaded image of the card, visible ones first. */
  function cardImage(card) {
    if (!card) return null;
    var best = null, area = 0, any = null, anyArea = 0;
    Array.prototype.forEach.call(card.querySelectorAll("img"), function (im) {
      if (!im.complete || !im.naturalWidth) return;
      var r = im.getBoundingClientRect();
      if (r.width < 24) return;
      if (r.width * r.height > anyArea) { anyArea = r.width * r.height; any = im; }
      if (!visible(r)) return;
      var cs = getComputedStyle(im);
      if (cs.visibility === "hidden" || Number(cs.opacity) < 0.5) return;
      if (r.width * r.height > area) { area = r.width * r.height; best = im; }
    });
    return best || any;
  }

  var VARMAP = { accent: "--xqv-accent", bg: "--xqv-bg", text: "--xqv-text", muted: "--xqv-muted", border: "--xqv-border", btn: "--xqv-btn", btnText: "--xqv-btn-text" };

  var Q = {
    build: function () {
      if (this.el) return;
      var self = this;
      if (!document.getElementById("xqv-css")) { var st = document.createElement("style"); st.id = "xqv-css"; st.textContent = CSS; document.head.appendChild(st); }
      var el = document.createElement("div");
      el.className = "xqv";
      el.hidden = true;
      el.innerHTML = '<div class="xqv__bg" data-q="close"></div><div class="xqv__panel" role="dialog" aria-modal="true" aria-labelledby="xqv-title">' +
        '<button type="button" class="xqv__x" data-q="close">' + X_ICON + "<span>" + esc(T.close) + '</span></button><div class="xqv__body"></div></div>';
      document.body.appendChild(el);
      this.el = el;
      this.panel = el.querySelector(".xqv__panel");
      this.body = el.querySelector(".xqv__body");
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-q]");
        if (!b) return;
        var a = b.getAttribute("data-q");
        if (a === "close") self.close();
        else if (a === "act") self.act();
        else if (a === "dot") self.goSlide(Number(b.getAttribute("data-i")));
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); self.close(); return; }
        if (e.key !== "Tab") return;
        var f = Array.prototype.filter.call(el.querySelectorAll("button,a[href]"), function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      });
      /* Taps inside the popup stay inside it, so a cart drawer or modal underneath doesn't treat them as "outside" clicks. */
      ["click", "pointerdown", "mousedown", "touchstart"].forEach(function (t) { el.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
      window.addEventListener("popstate", function () { if (self.isOpen && !(history.state && history.state.xqv)) self.close(true); });
      /* Swipe down to close; sideways swipes stay with the photo gallery. */
      var panel = this.panel, g = null;
      panel.addEventListener("touchstart", function (e) {
        if (e.touches.length !== 1) { g = null; return; }
        var t = e.touches[0];
        g = { x: t.clientX, y: t.clientY, top: self.body.scrollTop <= 0, mode: null, dy: 0, t0: Date.now() };
      }, { passive: true });
      panel.addEventListener("touchmove", function (e) {
        if (!g) return;
        var t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
        if (!g.mode) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          g.mode = g.top && dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2 ? "drag" : "none";
          if (g.mode === "drag") panel.style.transition = "none";
        }
        if (g.mode !== "drag") return;
        if (e.cancelable) e.preventDefault();
        g.dy = Math.max(0, dy);
        panel.style.transform = "translate3d(0," + g.dy + "px,0)";
      }, { passive: false });
      var release = function () {
        if (!g || g.mode !== "drag") { g = null; return; }
        var fast = g.dy > 50 && g.dy / Math.max(1, Date.now() - g.t0) > 0.5;
        var shut = fast || g.dy > Math.min(140, panel.offsetHeight * 0.22);
        panel.style.transition = "transform .3s cubic-bezier(.2,.8,.2,1), opacity .25s ease";
        if (shut) {
          panel.style.transform = "translate3d(0," + panel.offsetHeight + "px,0)";
          self.close();
          setTimeout(function () { panel.style.transition = ""; panel.style.transform = ""; }, 420);
        } else {
          panel.style.transform = "";
          setTimeout(function () { panel.style.transition = ""; }, 320);
        }
        g = null;
      };
      panel.addEventListener("touchend", release, { passive: true });
      panel.addEventListener("touchcancel", release, { passive: true });
    },

    /* ctx: { handle, card, opts } */
    open: function (ctx) {
      this.build();
      var self = this, el = this.el, opts = ctx.opts || {};
      if (this.isOpen) this.close(true, true);
      this.ctx = ctx;
      el.setAttribute("dir", opts.dir || document.documentElement.dir || "ltr");
      var colors = (typeof opts.colors === "function" ? opts.colors(ctx.card) : opts.colors) || {};
      for (var k in VARMAP) { if (colors[k]) el.style.setProperty(VARMAP[k], colors[k]); else el.style.removeProperty(VARMAP[k]); }
      var btn = colors.btn || colors.accent;
      if (btn && !colors.btnText) { var on = readable(btn); if (on) el.style.setProperty("--xqv-btn-text", on); }
      el.querySelector(".xqv__x span").textContent = T.close;
      this.src = cardImage(ctx.card);
      this.last = document.activeElement;
      var token = this.token = {};
      this.renderShell();
      el.classList.remove("is-in", "is-open");
      el.hidden = false;
      document.documentElement.classList.add("xqv-lock");
      try { history.pushState({ xqv: 1 }, ""); this.pushed = true; } catch (e) { this.pushed = false; }
      this.isOpen = true;

      var fly = !reduce && this.src && visible(this.src.getBoundingClientRect());
      if (fly) {
        var sr = this.src.getBoundingClientRect(), box = this.body.querySelector(".xqv__box"), hero = this.body.querySelector(".xqv__hero");
        el.classList.add("is-fly");
        void el.offsetWidth;
        el.classList.add("is-open");
        var tr = box.getBoundingClientRect();
        if (hero) hero.style.opacity = "0";
        var f = this.flyer(this.src, sr);
        this.src.style.visibility = "hidden";
        var dx = tr.left - sr.left, dy = tr.top - sr.top, sx = tr.width / sr.width, sy = tr.height / sr.height;
        var lift = Math.min(90, Math.abs(dy) * 0.25 + 30);
        var anim = f.animate([
          { transform: "translate3d(0,0,0) scale(1,1)" },
          { transform: "translate3d(" + dx * 0.55 + "px," + (dy * 0.55 - lift) + "px,0) scale(" + (1 + (sx - 1) * 0.6) + "," + (1 + (sy - 1) * 0.6) + ")", offset: 0.6 },
          { transform: "translate3d(" + dx + "px," + dy + "px,0) scale(" + sx + "," + sy + ")" }
        ], { duration: 560, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" });
        setTimeout(function () { if (self.token === token) el.classList.add("is-in"); }, 300);
        anim.onfinish = function () {
          var h = self.body.querySelector(".xqv__hero");
          if (h) h.style.opacity = "";
          f.remove();
          if (self.token === token) el.classList.remove("is-fly");
        };
        this.flyAnim = anim;
      } else {
        void el.offsetWidth;
        el.classList.add("is-open", "is-in");
      }
      el.querySelector(".xqv__x").focus({ preventScroll: true });

      loadProduct(ctx.handle).then(function (p) {
        if (self.token !== token) return;
        self.fill(p);
      }).catch(function () {
        if (self.token !== token) return;
        var info = self.body.querySelector(".xqv__info");
        info.innerHTML = '<p class="xqv__msg">' + esc(T.err) + '</p><a class="xqv__page" href="' + esc(ROOT.replace(/\/?$/, "/") + "products/" + encodeURIComponent(ctx.handle)) + '">' + esc(T.page) + "</a>";
        el.classList.add("is-in");
      });
    },

    flyer: function (img, r) {
      var f = document.createElement("img"), cs = getComputedStyle(img);
      f.className = "xqv__fly";
      f.src = img.currentSrc || img.src;
      f.alt = "";
      f.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;object-fit:" + cs.objectFit + ";object-position:" + cs.objectPosition + ";border-radius:" + cs.borderRadius + ";";
      document.body.appendChild(f);
      return f;
    },

    /* Layout first (stage sized like the card photo, the card photo reused as is), text as skeleton. */
    renderShell: function () {
      var src = this.src, ar = 1, fit = "contain", br = "14px", heroSrc = "";
      if (src) {
        var r = src.getBoundingClientRect(), cs = getComputedStyle(src);
        ar = r.width / r.height || 1;
        fit = cs.objectFit === "cover" ? "cover" : "contain";
        br = parseFloat(cs.borderRadius) ? cs.borderRadius : "14px";
        heroSrc = src.currentSrc || src.src;
      }
      ar = Math.max(0.6, Math.min(1.6, ar));
      this.ar = ar;
      this.body.innerHTML =
        '<div class="xqv__stage"><div class="xqv__track"><div class="xqv__slide">' +
          '<div class="xqv__box' + (heroSrc ? "" : " xqv__box--skel") + '" style="--ar:' + ar.toFixed(4) + ";--fit:" + fit + ";--br:" + br + '">' +
            (heroSrc ? '<img class="xqv__hero" src="' + esc(heroSrc) + '" alt="" decoding="async">' : "") +
          '</div></div></div><div class="xqv__dots"></div></div>' +
        '<div class="xqv__info">' +
          '<span class="xqv__skel xqv__skel--s" style="--k:0"></span><span class="xqv__skel xqv__skel--t" style="--k:1"></span>' +
          '<span class="xqv__skel xqv__skel--s" style="--k:2"></span><span class="xqv__skel" style="--k:3"></span><span class="xqv__skel" style="--k:4"></span>' +
        "</div>";
      this.body.scrollTop = 0;
    },

    /* The card's own button, found again if the feature re-rendered the card meanwhile. */
    action: function () {
      var ctx = this.ctx, opts = ctx.opts || {};
      if (!opts.action) return null;
      var card = ctx.card;
      if (!card || !card.isConnected) {
        card = null;
        var list = ctx.root.querySelectorAll(opts.card);
        for (var i = 0; i < list.length; i++) { if (opts.handle(list[i]) === ctx.handle) { card = list[i]; break; } }
        if (!card) return null;
        ctx.card = card;
      }
      var a = opts.action(card);
      if (!a) return null;
      if (a.nodeType === 1) a = { el: a };
      if (!a.el) return null;
      if (a.label == null) {
        var txt = a.el.textContent.replace(/\s+/g, " ").trim();
        /* Icon-only buttons (+, ✓): use their spoken label instead. */
        a.label = txt.replace(/[^\p{L}\p{N}]/gu, "").length < 2 ? (a.el.getAttribute("aria-label") || txt) : txt;
      }
      a.disabled = !!a.el.disabled || a.el.getAttribute("aria-disabled") === "true";
      return a;
    },

    priceHtml: function (p) {
      var opts = this.ctx.opts || {};
      var pe = opts.price && this.ctx.card ? opts.price(this.ctx.card) : null;
      if (pe && pe.textContent.trim()) {
        var c = pe.cloneNode(true);
        Array.prototype.forEach.call(c.querySelectorAll("button,input,select,svg,script"), function (n) { n.remove(); });
        Array.prototype.forEach.call(c.querySelectorAll("*"), function (n) { n.removeAttribute("style"); n.removeAttribute("id"); });
        return c.innerHTML;
      }
      var vs = p.variants || [], v = null;
      for (var i = 0; i < vs.length; i++) if (vs[i].available) { v = vs[i]; break; }
      v = v || vs[0];
      if (!v) return "";
      var money = window.Shopify && window.Shopify.formatMoney ? function (c) { return window.Shopify.formatMoney(c); } : function (c) {
        try { return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "currency", currency: (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || "USD" }).format(c / 100); } catch (e) { return (c / 100).toFixed(2); }
      };
      return "<span>" + (p.price_varies ? esc(T.from) + " " : "") + esc(money(v.price)) + "</span>" + (v.compare_at_price > v.price ? "<s>" + esc(money(v.compare_at_price)) + "</s>" : "");
    },

    fill: function (p) {
      var self = this, el = this.el;
      var url = p.url || (ROOT.replace(/\/?$/, "/") + "products/" + p.handle);
      var imgs = (p.images || []).slice(0, 10), box = this.body.querySelector(".xqv__box"), track = this.body.querySelector(".xqv__track");
      var heroBase = this.src ? base(this.src.currentSrc || this.src.src) : "";
      if (!this.src && imgs[0]) {
        box.classList.remove("xqv__box--skel");
        box.innerHTML = '<img class="xqv__hero" src="' + esc(sized(imgs[0], 900)) + '" alt="' + esc(p.title) + '" decoding="async">';
        heroBase = base(imgs[0]);
      } else if (this.src && this.src.naturalWidth < 520 && imgs[0]) {
        /* Small thumbnail: swap for a sharper copy once it's decoded (no flicker). Larger card photos are kept as is. */
        var hero = box.querySelector(".xqv__hero"), big = sized(base(imgs[0]) === heroBase ? imgs[0] : (this.src.currentSrc || this.src.src), 900), im = new Image(), token = this.token;
        im.src = big;
        (im.decode ? im.decode() : Promise.resolve()).then(function () { if (self.token === token && hero) hero.src = big; }).catch(function () {});
      }
      var extra = imgs.filter(function (u) { return base(u) !== heroBase; });
      if (extra.length) {
        track.insertAdjacentHTML("beforeend", extra.map(function (u, i) {
          return '<div class="xqv__slide"><div class="xqv__box" style="--ar:' + self.ar.toFixed(4) + '"><img class="xqv__more" src="' + esc(sized(u, 900)) + '" alt="' + esc(p.title) + '"' + (i < 2 ? "" : ' loading="lazy"') + ' decoding="async"></div></div>';
        }).join(""));
        var dots = this.body.querySelector(".xqv__dots"), n = extra.length + 1, html = "";
        for (var i = 0; i < n; i++) html += '<button type="button" data-q="dot" data-i="' + i + '" class="' + (i ? "" : "is-on") + '" aria-label="' + (i + 1) + "/" + n + '"></button>';
        dots.innerHTML = html;
        track.addEventListener("scroll", function () {
          var k = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
          Array.prototype.forEach.call(dots.children, function (b, j) { b.classList.toggle("is-on", j === k); });
        }, { passive: true });
      }
      var a = this.action();
      var info = this.body.querySelector(".xqv__info");
      info.innerHTML =
        (p.vendor ? '<span class="xqv__brand" style="--k:0">' + esc(p.vendor) + "</span>" : "") +
        '<h2 class="xqv__title" id="xqv-title" style="--k:1">' + esc(p.title) + "</h2>" +
        '<p class="xqv__price" style="--k:2">' + this.priceHtml(p) + "</p>" +
        (a && a.label ? '<button type="button" class="xqv__act" data-q="act" style="--k:3"' + (a.disabled ? " disabled" : "") + ">" + esc(a.label) + "</button>" : "") +
        '<a class="xqv__page" href="' + esc(url) + '" style="--k:4">' + esc(T.page) + "</a>" +
        (p.description ? '<div class="xqv__desc" style="--k:5">' + p.description + "</div>" : "");
      reveal(info.querySelector(".xqv__desc"));
      if (el.classList.contains("is-in") && !reduce) { el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in"); }
    },

    /* Press the card's own button after the popup closes, so the feature's own animation plays from the card. */
    act: function () {
      var a = this.action();
      this.close();
      if (!a || a.disabled) return;
      setTimeout(function () { if (a.el.isConnected) a.el.click(); }, reduce ? 0 : 320);
    },

    goSlide: function (i) {
      var s = this.body.querySelectorAll(".xqv__slide")[i];
      if (s) s.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "center" });
    },

    close: function (fromPop, instant) {
      var self = this, el = this.el, src = this.src;
      if (!this.isOpen) return;
      this.isOpen = false;
      this.token = null;
      if (this.flyAnim) { try { this.flyAnim.finish(); } catch (e) {} this.flyAnim = null; }
      var hero = this.body.querySelector(".xqv__hero"), track = this.body.querySelector(".xqv__track");
      var back = !instant && !reduce && src && src.isConnected && hero && track && Math.abs(track.scrollLeft) < 4;
      var tr = back ? src.getBoundingClientRect() : null, hr = back ? hero.getBoundingClientRect() : null;
      if (back && !(visible(tr) && visible(hr))) back = false;
      el.classList.remove("is-open", "is-in");
      document.documentElement.classList.remove("xqv-lock");
      var done = function () {
        if (src) src.style.visibility = "";
        if (!self.isOpen) { el.hidden = true; el.classList.remove("is-fly"); self.body.innerHTML = ""; }
      };
      if (back) {
        var f = this.flyer(src, hr);
        f.src = hero.currentSrc || hero.src;
        hero.style.opacity = "0";
        var anim = f.animate([
          { transform: "translate3d(0,0,0) scale(1,1)" },
          { transform: "translate3d(" + (tr.left - hr.left) + "px," + (tr.top - hr.top) + "px,0) scale(" + tr.width / hr.width + "," + tr.height / hr.height + ")" }
        ], { duration: 420, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
        anim.onfinish = function () { f.remove(); done(); };
      } else if (instant || reduce) {
        done();
      } else {
        setTimeout(done, 300);
      }
      if (this.pushed && !fromPop) { this.pushed = false; try { history.back(); } catch (e) {} }
      this.pushed = false;
      if (!instant && this.last && this.last.focus && document.contains(this.last)) this.last.focus({ preventScroll: true });
    }
  };

  /* Delegated: one listener per root, so cards rendered later (steps, re-renders, modals) work too. */
  function bind(root, opts) {
    if (!root || !opts || !opts.card) return;
    opts.handle = opts.handle || function (card) {
      var a = card.querySelector('a[href*="/products/"]');
      return a ? handleFromHref(a.getAttribute("href")) : card.getAttribute("data-h") || "";
    };
    var hit = opts.hit || "img";
    var onClick = function (e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var t = e.target;
      if (!t || !t.closest) return;
      var h = t.closest(hit);
      if (!h || !root.contains(h)) return;
      var ctl = t.closest("button,select,input,textarea");
      if (ctl && ctl !== h && h.contains(ctl)) return;
      var card = h.closest(opts.card);
      if (!card || !root.contains(card)) return;
      var handle = opts.handle(card);
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      Q.open({ handle: handle, card: card, root: root, opts: opts });
    };
    root.addEventListener("click", onClick, true);
    /* Warm the product data as soon as a shopper shows intent. */
    var warm = function (e) {
      var t = e.target;
      var h = t && t.closest && t.closest(hit);
      var card = h && h.closest(opts.card);
      if (card) { var hd = opts.handle(card); if (hd) loadProduct(hd).catch(function () {}); }
    };
    root.addEventListener("pointerover", warm, { passive: true });
    root.addEventListener("touchstart", warm, { passive: true });
    var cur = document.getElementById("xqv-cur");
    if (!cur) { cur = document.createElement("style"); cur.id = "xqv-cur"; document.head.appendChild(cur); }
    var rule = "[data-xqv] :is(" + hit + "){cursor:pointer}";
    if (cur.textContent.indexOf(rule) === -1) cur.textContent += rule + "\n";
    (root.nodeType === 9 ? root.documentElement : root).setAttribute("data-xqv", "1");
  }

  window.XPoostQV = {
    bind: bind,
    open: function (handle, card, opts) { Q.open({ handle: handle, card: card || null, root: document, opts: opts || {} }); },
    close: function () { Q.close(); },
    prefetch: function (handle) { return loadProduct(handle).catch(function () {}); },
    handleFromHref: handleFromHref,
    isOpen: function () { return !!Q.isOpen; }
  };
  try { document.dispatchEvent(new CustomEvent("xpoost:qv-ready")); } catch (e) {}
})();
