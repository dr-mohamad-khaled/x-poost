/*
 * XPoost Quick View for Minimog (replaces the theme's quick view everywhere on the site).
 *
 * - Any ".m-product-quickview-button" (product cards, collection pages, search, sliders) opens it.
 * - The product photo flies out of the card and lands on a glowing stage at the top of the popup,
 *   then the name, price and description rise in. Closing flies the photo back into its card.
 * - Uses the light /products/<handle>.js endpoint (no section HTML, no extra CSS/JS files),
 *   prefetched as soon as the shopper hovers or touches the button, and cached.
 * - Options as chips, quantity, add to cart (fills the theme cart drawer without a reload), buy now.
 * - Phone back button / Esc / swipe down close it. Respects "reduce motion".
 * Colors: edit the --iqv-* values in CSS below.
 */
(function () {
  'use strict';
  if (window.__xpQuickView) return;
  window.__xpQuickView = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AR = /^ar/i.test(document.documentElement.lang || '') || document.documentElement.dir === 'rtl';
  var T = AR ? {
    add: 'أضف للعربة', added: 'اتضاف', buy: 'اشتري دلوقتي', sold: 'خلصان', from: 'من', close: 'اقفل', page: 'شوف صفحة المنتج كاملة',
    qty: 'الكمية', more: 'اقرأ أكتر', less: 'أقل', err: 'حصلت مشكلة، جرّب تاني', cart: 'افتح العربة'
  } : {
    add: 'Add to cart', added: 'Added', buy: 'Buy it now', sold: 'Sold out', from: 'From', close: 'Close', page: 'View full product page',
    qty: 'Quantity', more: 'Read more', less: 'Show less', err: 'Something went wrong, try again', cart: 'View cart'
  };
  var S = window.MinimogSettings || {};
  var ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var MONEY = S.money_format || '{{amount}}';

  var CSS = [
    'html.xpc-lock{overflow:hidden}',
    'html.xpc-lock .firefly-canvas{display:none!important}',
    'html.xpc-lock #MainContent *,html.xpc-lock #MainContent *::before,html.xpc-lock #MainContent *::after{animation-play-state:paused!important}',
    '.iqv{--iqv-accent:#d4af37;--iqv-accent-2:#9c8102;--iqv-on:#141210;--iqv-bg:#121111;--iqv-bg2:#0b0a09;--iqv-text:#ffffff;--iqv-muted:#cfc8b8;--iqv-border:rgba(212,175,55,.32);--iqv-glow:rgba(212,175,55,.34);--iqv-chip:#1c1b19;--iqv-sale:#e4584c;',
    'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;color:var(--iqv-text);line-height:1.5;font-family:inherit}',
    '.iqv[hidden]{display:none}',
    '.iqv *,.iqv *::before,.iqv *::after{box-sizing:border-box}',
    '.iqv button,.iqv input{font-family:inherit}',
    '.iqv :focus-visible{outline:2px solid var(--iqv-accent);outline-offset:2px}',
    '.iqv__bg{position:absolute;inset:0;background:rgba(0,0,0,.74);opacity:0;transition:opacity .3s ease}',
    '.iqv.is-open .iqv__bg{opacity:1}',
    '.iqv__panel{position:relative;width:100%;height:90vh;height:90dvh;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,var(--iqv-bg),var(--iqv-bg2));border:1px solid var(--iqv-border);border-bottom:0;border-radius:26px 26px 0 0;opacity:0;transform:translateY(24px);transition:opacity .28s ease,transform .36s cubic-bezier(.2,.8,.2,1)}',
    '.iqv.is-open .iqv__panel,.iqv.is-fly .iqv__panel{transform:none}',
    '.iqv.is-open .iqv__panel{opacity:1}',
    '.iqv__x{position:absolute;z-index:6;top:12px;inset-inline-end:12px;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:0;border-radius:99px;background:var(--iqv-accent);color:var(--iqv-on);font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 0 0 3px color-mix(in srgb,var(--iqv-accent) 28%,transparent),0 0 18px color-mix(in srgb,var(--iqv-accent) 60%,transparent)}',
    '.iqv__x::after{content:"";position:absolute;inset:0;border-radius:inherit;border:2px solid var(--iqv-accent);opacity:0;pointer-events:none;animation:iqv-ring 2s ease-out infinite}',
    '.iqv__x svg{width:15px;height:15px}',
    '.iqv__body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
    '.iqv__stage{position:relative;height:42vh;height:42dvh;min-height:250px}',
    '.iqv__stage::before{content:"";position:absolute;inset:8% 10% 6%;border-radius:50%;background:radial-gradient(closest-side,var(--iqv-glow),rgba(0,0,0,0) 72%);pointer-events:none}',
    '.iqv__track{position:relative;height:100%;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}',
    '.iqv__track::-webkit-scrollbar{display:none}',
    '.iqv__slide{position:relative;flex:0 0 100%;height:100%;scroll-snap-align:center;display:flex;align-items:center;justify-content:center;padding:58px 0 30px}',
    '.iqv__box{position:relative;height:100%;aspect-ratio:var(--ar,1);max-width:84%;border-radius:var(--br,16px);overflow:hidden;box-shadow:0 24px 50px -22px rgba(0,0,0,.85)}',
    '.iqv__box--skel{background:rgba(255,255,255,.05)}',
    '.iqv__hero,.iqv__more{position:absolute;inset:0;width:100%;height:100%;object-fit:var(--fit,contain)}',
    '.iqv__more{object-fit:contain}',
    '.iqv__burst{position:absolute;left:50%;top:52%;width:66%;aspect-ratio:1;margin-left:-33%;border-radius:50%;border:2px solid var(--iqv-accent);opacity:0;pointer-events:none;transform:translateY(-50%) scale(.4)}',
    '.iqv__dots{position:absolute;z-index:3;bottom:9px;left:0;right:0;display:flex;justify-content:center;gap:6px}',
    '.iqv__dots button{width:7px;height:7px;padding:0;border:0;border-radius:99px;background:var(--iqv-text);opacity:.35;cursor:pointer;transition:width .3s ease,opacity .3s ease}',
    '.iqv__dots button.is-on{width:20px;opacity:1;background:var(--iqv-accent)}',
    '.iqv__info{padding:6px 18px calc(22px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:13px}',
    '.iqv__brand{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--iqv-accent);margin-bottom:-7px}',
    '.iqv__title{margin:0;font-size:21px;line-height:1.4;font-weight:700;color:var(--iqv-text)}',
    '.iqv__title a{color:inherit;text-decoration:none}',
    '.iqv__price{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;margin:0}',
    '.iqv__now{color:var(--iqv-accent);font-size:23px;font-weight:800;unicode-bidi:plaintext}',
    '.iqv__price.is-sale .iqv__now{color:var(--iqv-sale)}',
    '.iqv__was{color:var(--iqv-muted);opacity:.8;font-size:14px;text-decoration:line-through;unicode-bidi:plaintext}',
    '.iqv__off{padding:2px 9px;border-radius:99px;background:var(--iqv-sale);color:#fff;font-size:12px;font-weight:800}',
    '.iqv__opt{display:flex;flex-direction:column;gap:8px}',
    '.iqv__opt b{font-size:13px;font-weight:600;color:var(--iqv-muted)}',
    '.iqv__opt b span{color:var(--iqv-text);font-weight:700}',
    '.iqv__chips{display:flex;flex-wrap:wrap;gap:8px}',
    '.iqv__chip{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid var(--iqv-border);background:var(--iqv-chip);color:var(--iqv-text);font-size:14px;font-weight:600;cursor:pointer;transition:border-color .2s ease,background-color .2s ease,color .2s ease}',
    '.iqv__chip.is-on{border-color:var(--iqv-accent);background:color-mix(in srgb,var(--iqv-accent) 18%,var(--iqv-chip));color:var(--iqv-accent)}',
    '.iqv__chip.is-na{opacity:.4;text-decoration:line-through}',
    '.iqv__buy{display:flex;gap:10px;align-items:stretch}',
    '.iqv__qty{flex:none;display:flex;align-items:center;border:1px solid var(--iqv-border);border-radius:14px;background:var(--iqv-chip);overflow:hidden}',
    '.iqv__qty button{width:38px;height:100%;min-height:50px;border:0;background:none;color:var(--iqv-text);font-size:20px;cursor:pointer}',
    '.iqv__qty input{width:34px;border:0;background:none;color:var(--iqv-text);text-align:center;font-size:16px;font-weight:700;-moz-appearance:textfield}',
    '.iqv__qty input::-webkit-outer-spin-button,.iqv__qty input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
    '.iqv__add{position:relative;flex:1;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 16px;border:0;border-radius:14px;background:linear-gradient(135deg,var(--iqv-accent-2),var(--iqv-accent));color:var(--iqv-on);font-size:16px;font-weight:800;cursor:pointer;overflow:hidden;transition:transform .15s ease}',
    '.iqv__add:not([disabled]):active{transform:scale(.97)}',
    '.iqv__add[disabled]{opacity:.45;cursor:not-allowed}',
    '.iqv__add svg{width:18px;height:18px;flex:none}',
    '.iqv__add.is-busy svg{animation:iqv-spin .8s linear infinite}',
    '.iqv__add.is-done{background:#2f7d4f;color:#fff}',
    '.iqv__add.is-done svg{animation:iqv-pop .45s cubic-bezier(.3,1.5,.5,1) both}',
    '.iqv__add::after{content:"";position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);transform:translateX(-130%) skewX(-18deg);animation:iqv-shine 4s ease-in-out 1.2s infinite;pointer-events:none}',
    '.iqv__page{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:14px;border:1px solid var(--iqv-border);color:var(--iqv-accent);font-weight:700;font-size:14.5px;text-decoration:none}',
    '.iqv__msg{margin:-4px 0 0;font-size:13px;color:var(--iqv-sale)}',
    '.iqv__desc{border-top:1px solid var(--iqv-border);padding-top:14px;color:var(--iqv-muted);font-size:14px;line-height:1.8;overflow-wrap:anywhere}',
    '.iqv__desc img{max-width:100%;height:auto}',
    '.iqv__desc a{color:var(--iqv-accent)}',
    '.iqv__desc h1,.iqv__desc h2,.iqv__desc h3,.iqv__desc h4,.iqv__desc strong{color:var(--iqv-text)}',
    '.iqv__skel{display:block;height:12px;border-radius:6px;background:rgba(255,255,255,.07);margin:8px 0;animation:iqv-blink .9s ease-in-out infinite alternate}',
    '.iqv__skel--t{height:22px;width:75%}',
    '.iqv__skel--s{width:45%}',
    '.iqv__fly{position:fixed;z-index:2147483001;margin:0;pointer-events:none;transform-origin:0 0;will-change:transform}',
    '.iqv__info>*{opacity:0;transform:translateY(14px)}',
    '.iqv.is-in .iqv__info>*{opacity:1;transform:none;transition:opacity .4s ease,transform .5s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--k,0)*55ms)}',
    '.iqv.is-landed .iqv__box{animation:iqv-float 6s ease-in-out .2s infinite}',
    '.iqv.is-landed .iqv__burst{animation:iqv-burst .75s cubic-bezier(.2,.8,.2,1) both}',
    '.iqv.is-landed .iqv__stage::before{animation:iqv-aura 7s ease-in-out infinite}',
    '@keyframes iqv-ring{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.35,1.7)}}',
    '@keyframes iqv-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-7px,0)}}',
    '@keyframes iqv-burst{0%{opacity:.9;transform:translateY(-50%) scale(.45)}100%{opacity:0;transform:translateY(-50%) scale(1.15)}}',
    '@keyframes iqv-aura{0%,100%{transform:scale(.94);opacity:.65}50%{transform:scale(1.06);opacity:1}}',
    '@keyframes iqv-pop{0%{transform:scale(.3)}60%{transform:scale(1.2)}100%{transform:scale(1)}}',
    '@keyframes iqv-shine{0%,55%{transform:translateX(-130%) skewX(-18deg)}100%{transform:translateX(330%) skewX(-18deg)}}',
    '@keyframes iqv-blink{from{opacity:.4}to{opacity:1}}',
    '@keyframes iqv-spin{to{transform:rotate(360deg)}}',
    '@media (min-width:750px){',
    '.iqv{align-items:center;padding:24px}',
    '.iqv__panel{width:min(980px,100%);height:min(88vh,640px);border-radius:28px;border-bottom:1px solid var(--iqv-border);transform:translateY(18px) scale(.985)}',
    '.iqv__body{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);align-items:start}',
    '.iqv__stage{position:sticky;top:0;height:min(88vh,640px);min-height:0}',
    '.iqv__slide{padding:44px 0 36px}',
    '.iqv__info{padding:70px 30px 30px}',
    '.iqv__title{font-size:25px}',
    '}',
    '@media (prefers-reduced-motion:reduce){.iqv *,.iqv *::before,.iqv *::after{animation:none!important;transition:none!important}.iqv__info>*{opacity:1;transform:none}}'
  ].join('\n');

  var ICON = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    spin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(cents) {
    cents = Math.round(Number(cents) || 0);
    function f(dec, th, dp) { var n = (cents / 100).toFixed(dec).split('.'); return n[0].replace(/\B(?=(\d{3})+(?!\d))/g, th) + (n[1] ? dp + n[1] : ''); }
    var out = String(MONEY).replace(/<[^>]*>/g, '').replace(/\{\{\s*(\w+)\s*\}\}/, function (m, k) {
      switch (k) {
        case 'amount_no_decimals': return f(0, ',', '.');
        case 'amount_with_comma_separator': return f(2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return f(0, '.', ',');
        case 'amount_with_apostrophe_separator': return f(2, "'", '.');
        case 'amount_with_space_separator': return f(2, ' ', ',');
        default: return f(2, ',', '.');
      }
    });
    return cents % 100 === 0 ? out.replace(/[.,]00(?!\d)/, '') : out;
  }
  function sized(u, w) {
    if (!u) return u;
    u = String(u);
    if (u.indexOf('//') === 0) u = 'https:' + u;
    if (u.indexOf('data:') === 0) return u;
    return u.replace(/([?&])width=\d+&?/, '$1').replace(/[?&]$/, '') + (u.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  }
  function base(u) { return String(u || '').split('?')[0].replace(/^https?:/, '').replace(/_\d+x\d*(?=\.)/, ''); }
  function visible(r) { return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }

  var CACHE = {};
  function loadProduct(h) {
    if (!h) return Promise.reject(new Error('no handle'));
    if (CACHE[h]) return CACHE[h];
    CACHE[h] = fetch(ROOT.replace(/\/?$/, '/') + 'products/' + encodeURIComponent(h) + '.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function (e) { delete CACHE[h]; throw e; });
    return CACHE[h];
  }
  function themeDrawer() {
    var d = document.querySelector('m-cart-drawer') || document.querySelector('cart-drawer');
    return d && typeof d.getSectionsToRender === 'function' ? d : null;
  }
  function fillDrawer(d, j) {
    var cache = {};
    d.getSectionsToRender().forEach(function (x) {
      var id = x.section || x.id, html = j.sections && j.sections[id];
      if (!html) return;
      var el = x.selector ? document.querySelector(x.selector) : document.getElementById(x.id);
      if (!el) return;
      var doc = cache[id] || (cache[id] = new DOMParser().parseFromString(html, 'text/html'));
      var src = x.selector ? doc.querySelector(x.selector) : doc.querySelector('.shopify-section');
      if (src) el.innerHTML = src.innerHTML;
    });
    d.classList.remove('m-cart--empty', 'is-empty');
    var items = d.querySelector('m-cart-drawer-items, cart-drawer-items');
    if (items) items.classList.remove('m-cart--empty', 'is-empty');
  }
  function syncTheme(d, j) {
    try {
      if (d && j.sections) fillDrawer(d, j);
      else if (d && typeof d.onCartDrawerUpdate === 'function') d.onCartDrawerUpdate();
      if (window.FoxKitV2 && window.FoxKitV2.Modules && window.FoxKitV2.Modules.InCart) window.FoxKitV2.Modules.InCart.getCart();
      if (window.MinimogEvents && window.MinimogTheme && window.MinimogTheme.pubSubEvents) window.MinimogEvents.emit(window.MinimogTheme.pubSubEvents.cartUpdate, j);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
  }

  /* The photo shown in the card that was tapped (the one actually visible right now). */
  function cardImage(trigger) {
    var card = trigger.closest('article, .m-product-card, [class*="product-card"], .swiper-slide, li, [data-product-id]');
    if (!card) return null;
    var best = null, area = 0;
    Array.prototype.forEach.call(card.querySelectorAll('img'), function (im) {
      if (!im.complete || !im.naturalWidth) return;
      var r = im.getBoundingClientRect();
      if (r.width < 40 || !visible(r)) return;
      var cs = getComputedStyle(im);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) return;
      if (r.width * r.height > area) { area = r.width * r.height; best = im; }
    });
    return best;
  }

  var Q = {
    build: function () {
      if (this.el) return;
      var self = this;
      if (!document.getElementById('iqv-css')) { var st = document.createElement('style'); st.id = 'iqv-css'; st.textContent = CSS; document.head.appendChild(st); }
      var el = document.createElement('div');
      el.className = 'iqv';
      el.hidden = true;
      el.setAttribute('dir', document.documentElement.dir || (AR ? 'rtl' : 'ltr'));
      el.innerHTML = '<div class="iqv__bg" data-q="close"></div><div class="iqv__panel" role="dialog" aria-modal="true" aria-labelledby="iqv-title">' +
        '<button type="button" class="iqv__x" data-q="close">' + ICON.x + '<span>' + esc(T.close) + '</span></button><div class="iqv__body"></div></div>';
      document.body.appendChild(el);
      this.el = el;
      this.panel = el.querySelector('.iqv__panel');
      this.body = el.querySelector('.iqv__body');
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-q]');
        if (!b) return;
        var a = b.getAttribute('data-q');
        if (a === 'close') self.close();
        else if (a === 'add') self.add(b, false);
        else if (a === 'dot') self.goSlide(Number(b.getAttribute('data-i')));
        else if (a === 'chip') self.pick(Number(b.getAttribute('data-o')), b.getAttribute('data-v'));
        else if (a === 'minus' || a === 'plus') { var q = self.body.querySelector('.iqv__qty input'); q.value = Math.max(1, (parseInt(q.value, 10) || 1) + (a === 'plus' ? 1 : -1)); }
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); self.close(); return; }
        if (e.key !== 'Tab') return;
        var f = Array.prototype.filter.call(el.querySelectorAll('button,input,a[href]'), function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      });
      window.addEventListener('popstate', function () { if (self.isOpen && !(history.state && history.state.iqv)) self.close(true); });
      var sy = null;
      this.panel.addEventListener('touchstart', function (e) { sy = self.body.scrollTop <= 0 && !e.target.closest('.iqv__track') ? e.touches[0].clientY : null; }, { passive: true });
      this.panel.addEventListener('touchend', function (e) { if (sy != null && e.changedTouches[0].clientY - sy > 110) self.close(); sy = null; }, { passive: true });
    },

    open: function (handle, trigger) {
      this.build();
      var self = this, el = this.el;
      if (this.isOpen) this.close(true, true);
      this.handle = handle; this.p = null; this.v = null; this.sel = [];
      this.src = trigger ? cardImage(trigger) : null;
      this.last = document.activeElement;
      var token = this.token = {};
      this.renderShell();
      el.classList.remove('is-in', 'is-landed', 'is-open');
      el.hidden = false;
      document.documentElement.classList.add('xpc-lock');
      try { history.pushState({ iqv: 1 }, ''); this.pushed = true; } catch (e) { this.pushed = false; }
      this.isOpen = true;
      api.isOpen = true;

      var fly = !reduce && this.src && visible(this.src.getBoundingClientRect());
      if (fly) {
        var sr = this.src.getBoundingClientRect(), box = this.body.querySelector('.iqv__box'), hero = this.body.querySelector('.iqv__hero');
        el.classList.add('is-fly');
        void el.offsetWidth;
        el.classList.add('is-open');
        var tr = box.getBoundingClientRect();
        if (hero) hero.style.opacity = '0';
        var f = this.flyer(this.src, sr);
        this.src.style.visibility = 'hidden';
        var dx = tr.left - sr.left, dy = tr.top - sr.top, sx = tr.width / sr.width, sy2 = tr.height / sr.height;
        var lift = Math.min(90, Math.abs(dy) * 0.25 + 30);
        var anim = f.animate([
          { transform: 'translate3d(0,0,0) scale(1,1) rotate(0deg)' },
          { transform: 'translate3d(' + dx * 0.55 + 'px,' + (dy * 0.55 - lift) + 'px,0) scale(' + (1 + (sx - 1) * 0.6) * 1.04 + ',' + (1 + (sy2 - 1) * 0.6) * 1.04 + ') rotate(-5deg)', offset: 0.6 },
          { transform: 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(' + sx + ',' + sy2 + ') rotate(0deg)' }
        ], { duration: 640, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
        setTimeout(function () { if (self.token === token) el.classList.add('is-in'); }, 330);
        anim.onfinish = function () {
          var h = self.body.querySelector('.iqv__hero');
          if (h) h.style.opacity = '';
          f.remove();
          if (self.token === token) { el.classList.add('is-landed'); el.classList.remove('is-fly'); }
        };
        this.flyAnim = anim;
      } else {
        void el.offsetWidth;
        el.classList.add('is-open', 'is-in', 'is-landed');
      }
      el.querySelector('.iqv__x').focus({ preventScroll: true });

      loadProduct(handle).then(function (p) {
        if (self.token !== token) return;
        self.p = p;
        var v = null, vs = p.variants || [];
        for (var i = 0; i < vs.length; i++) if (vs[i].available) { v = vs[i]; break; }
        self.v = v || vs[0] || null;
        self.sel = self.v ? (self.v.options || []).slice() : [];
        self.fill();
      }).catch(function () {
        if (self.token !== token) return;
        var info = self.body.querySelector('.iqv__info');
        info.innerHTML = '<p class="iqv__msg">' + esc(T.err) + '</p>';
      });
    },

    flyer: function (img, r) {
      var f = document.createElement('img'), cs = getComputedStyle(img);
      f.className = 'iqv__fly';
      f.src = img.currentSrc || img.src;
      f.alt = '';
      f.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;object-fit:' + cs.objectFit + ';object-position:' + cs.objectPosition + ';border-radius:' + cs.borderRadius + ';';
      document.body.appendChild(f);
      return f;
    },

    /* Layout first (stage sized like the card photo), text as skeleton until the product arrives. */
    renderShell: function () {
      var src = this.src, ar = 1, fit = 'contain', br = '16px', heroSrc = '';
      if (src) {
        var r = src.getBoundingClientRect(), cs = getComputedStyle(src);
        ar = r.width / r.height || 1;
        fit = cs.objectFit === 'cover' ? 'cover' : 'contain';
        br = parseFloat(cs.borderRadius) ? cs.borderRadius : '16px';
        heroSrc = src.currentSrc || src.src;
      }
      this.ar = ar;
      this.body.innerHTML =
        '<div class="iqv__stage"><div class="iqv__track"><div class="iqv__slide">' +
          '<div class="iqv__box' + (heroSrc ? '' : ' iqv__box--skel') + '" style="--ar:' + ar.toFixed(4) + ';--fit:' + fit + ';--br:' + br + '">' +
            (heroSrc ? '<img class="iqv__hero" src="' + esc(heroSrc) + '" alt="" decoding="async">' : '') +
          '</div><span class="iqv__burst" aria-hidden="true"></span></div></div><div class="iqv__dots"></div></div>' +
        '<div class="iqv__info">' +
          '<span class="iqv__skel iqv__skel--s" style="--k:0"></span><span class="iqv__skel iqv__skel--t" style="--k:1"></span>' +
          '<span class="iqv__skel iqv__skel--s" style="--k:2"></span><span class="iqv__skel" style="--k:3"></span><span class="iqv__skel" style="--k:4"></span>' +
        '</div>';
      this.body.scrollTop = 0;
    },

    priceHtml: function (v, from) {
      var sale = v.compare_at_price > v.price, off = sale ? Math.round((1 - v.price / v.compare_at_price) * 100) : 0;
      return '<span class="iqv__now">' + (from ? esc(T.from) + ' ' : '') + esc(money(v.price)) + '</span>' +
        (sale ? '<s class="iqv__was">' + esc(money(v.compare_at_price)) + '</s>' + (off > 0 ? '<span class="iqv__off">-' + off + '%</span>' : '') : '');
    },

    fill: function () {
      var self = this, p = this.p, v = this.v, el = this.el;
      var url = p.url || (ROOT.replace(/\/?$/, '/') + 'products/' + p.handle);
      // Photos
      var imgs = (p.images || []).slice(0, 10), box = this.body.querySelector('.iqv__box'), track = this.body.querySelector('.iqv__track');
      var heroBase = this.src ? base(this.src.currentSrc || this.src.src) : '';
      if (!this.src && imgs[0]) {
        box.classList.remove('iqv__box--skel');
        box.innerHTML = '<img class="iqv__hero" src="' + esc(sized(imgs[0], 900)) + '" alt="' + esc(p.title) + '" decoding="async">';
        heroBase = base(imgs[0]);
      } else if (this.src) {
        var hero = box.querySelector('.iqv__hero'), big = sized(imgs[0] && base(imgs[0]) === heroBase ? imgs[0] : (this.src.currentSrc || this.src.src), 900), im = new Image(), token = this.token;
        im.src = big;
        (im.decode ? im.decode() : Promise.resolve()).then(function () { if (self.token === token && hero) hero.src = big; }).catch(function () {});
      }
      var extra = imgs.filter(function (u) { return base(u) !== heroBase; });
      if (extra.length) {
        track.insertAdjacentHTML('beforeend', extra.map(function (u) {
          return '<div class="iqv__slide"><div class="iqv__box" style="--ar:' + self.ar.toFixed(4) + '"><img class="iqv__more" src="' + esc(sized(u, 900)) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async"></div></div>';
        }).join(''));
        var dots = this.body.querySelector('.iqv__dots'), n = extra.length + 1, html = '';
        for (var i = 0; i < n; i++) html += '<button type="button" data-q="dot" data-i="' + i + '" class="' + (i ? '' : 'is-on') + '" aria-label="' + (i + 1) + '/' + n + '"></button>';
        dots.innerHTML = html;
        track.addEventListener('scroll', function () {
          var k = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
          Array.prototype.forEach.call(dots.children, function (b, j) { b.classList.toggle('is-on', j === k); });
        }, { passive: true });
      }
      // Options as chips
      var opts = '';
      var single = (p.variants || []).length <= 1 || (p.options && p.options.length === 1 && /^default title$/i.test((p.variants[0] || {}).title || ''));
      if (!single) {
        opts = (p.options || []).map(function (o, oi) {
          var name = typeof o === 'string' ? o : o.name, values = typeof o === 'string' ? [] : (o.values || []);
          if (!values.length) values = (p.variants || []).map(function (x) { return x.options[oi]; }).filter(function (x, k, a) { return a.indexOf(x) === k; });
          return '<div class="iqv__opt" style="--k:4"><b>' + esc(name) + ': <span data-q-name="' + oi + '">' + esc(self.sel[oi] || '') + '</span></b><div class="iqv__chips">' + values.map(function (val) {
            return '<button type="button" class="iqv__chip" data-q="chip" data-o="' + oi + '" data-v="' + esc(val) + '">' + esc(val) + '</button>';
          }).join('') + '</div></div>';
        }).join('');
      }
      var info = this.body.querySelector('.iqv__info');
      info.innerHTML =
        (p.vendor ? '<span class="iqv__brand" style="--k:0">' + esc(p.vendor) + '</span>' : '') +
        '<h2 class="iqv__title" id="iqv-title" style="--k:1"><a href="' + esc(url) + '">' + esc(p.title) + '</a></h2>' +
        '<p class="iqv__price" style="--k:2"></p>' + opts +
        '<div class="iqv__buy" style="--k:5"><div class="iqv__qty"><button type="button" data-q="minus" aria-label="-">−</button><input type="number" min="1" value="1" inputmode="numeric" aria-label="' + esc(T.qty) + '"><button type="button" data-q="plus" aria-label="+">+</button></div>' +
          '<button type="button" class="iqv__add" data-q="add"></button></div>' +
        '<a class="iqv__page" href="' + esc(url) + '" style="--k:7">' + esc(T.page) + '</a>' +
        (p.description ? '<div class="iqv__desc" style="--k:8">' + p.description + '</div>' : '');
      this.sync(true);
      // Let the real details rise in, like the skeleton did.
      if (el.classList.contains('is-in') && !reduce) { el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in'); }
    },

    pick: function (oi, val) {
      var vs = this.p.variants || [], sel = this.sel.slice();
      sel[oi] = val;
      var match = null, i;
      for (i = 0; i < vs.length; i++) if (vs[i].options.every(function (x, k) { return x === sel[k]; })) { match = vs[i]; break; }
      if (!match) for (i = 0; i < vs.length; i++) if (vs[i].options[oi] === val) { match = vs[i]; if (match.available) break; }
      if (!match) return;
      this.v = match;
      this.sel = match.options.slice();
      this.sync(false);
    },

    /* Price, chips and buttons follow the chosen variant (no re-render, the gallery stays put). */
    sync: function (first) {
      var p = this.p, v = this.v, self = this, info = this.body;
      if (!v) return;
      var pe = info.querySelector('.iqv__price');
      pe.className = 'iqv__price' + (v.compare_at_price > v.price ? ' is-sale' : '');
      pe.innerHTML = this.priceHtml(v, false);
      Array.prototype.forEach.call(info.querySelectorAll('.iqv__chip'), function (c) {
        var oi = Number(c.getAttribute('data-o')), val = c.getAttribute('data-v');
        c.classList.toggle('is-on', self.sel[oi] === val);
        var test = self.sel.slice(); test[oi] = val;
        var ok = (p.variants || []).some(function (x) { return x.available && x.options.every(function (y, k) { return y === test[k]; }); });
        c.classList.toggle('is-na', !ok);
      });
      Array.prototype.forEach.call(info.querySelectorAll('[data-q-name]'), function (s) { s.textContent = self.sel[Number(s.getAttribute('data-q-name'))] || ''; });
      var add = info.querySelector('.iqv__add');
      add.disabled = !v.available;
      add.classList.remove('is-busy', 'is-done');
      add.innerHTML = v.available ? ICON.bag + '<span>' + esc(T.add) + '</span>' : esc(T.sold);
      if (!first && v.featured_image && v.featured_image.src) {
        var b = base(v.featured_image.src), slides = this.body.querySelectorAll('.iqv__slide img');
        for (var k = 0; k < slides.length; k++) if (base(slides[k].src) === b) { this.goSlide(k); break; }
      }
    },

    goSlide: function (i) {
      var s = this.body.querySelectorAll('.iqv__slide')[i];
      if (s) s.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    },

    add: function (b, checkout) {
      var self = this, v = this.v;
      if (!v || b.disabled || b.classList.contains('is-busy')) return;
      var add = this.body.querySelector('.iqv__add');
      var qty = Math.max(1, parseInt(this.body.querySelector('.iqv__qty input').value, 10) || 1);
      add.classList.add('is-busy');
      add.innerHTML = ICON.spin + '<span>' + esc(T.add) + '</span>';
      var body = { items: [{ id: v.id, quantity: qty }] };
      var d = themeDrawer();
      if (d && !checkout) {
        var ids = [];
        try { d.getSectionsToRender().forEach(function (x) { var id = x.section || x.id; if (ids.indexOf(id) < 0) ids.push(id); }); } catch (e) {}
        if (ids.length) { body.sections = ids; body.sections_url = window.location.pathname; }
      }
      fetch(ROOT.replace(/\/?$/, '/') + 'cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.status) throw new Error(j.description || j.message || T.err); return j; }); })
        .then(function (j) {
          if (checkout) { window.location.href = ROOT.replace(/\/?$/, '/') + 'checkout'; return; }
          add.classList.remove('is-busy');
          add.classList.add('is-done');
          add.innerHTML = ICON.check + '<span>' + esc(T.added) + '</span>';
          if (d && typeof d.open === 'function') {
            syncTheme(d, j);
            setTimeout(function () { self.close(); setTimeout(function () { d.open(); }, 80); }, 450);
          } else {
            syncTheme(null, j);
            setTimeout(function () { if (add.isConnected) self.sync(false); }, 2200);
          }
        })
        .catch(function (e) {
          add.classList.remove('is-busy');
          add.innerHTML = '<span>' + esc(e.message || T.err) + '</span>';
          setTimeout(function () { if (add.isConnected) self.sync(false); }, 2600);
        });
    },

    /* Close: the photo flies back into its card when both are on screen. */
    close: function (fromPop, instant) {
      var self = this, el = this.el, src = this.src;
      if (!this.isOpen) return;
      this.isOpen = false;
      api.isOpen = false;
      this.token = null;
      if (this.flyAnim) { try { this.flyAnim.finish(); } catch (e) {} this.flyAnim = null; }
      var hero = this.body.querySelector('.iqv__hero'), track = this.body.querySelector('.iqv__track');
      var back = !instant && !reduce && src && hero && track && Math.abs(track.scrollLeft) < 4;
      var tr = back ? src.getBoundingClientRect() : null, hr = back ? hero.getBoundingClientRect() : null;
      if (back && !(visible(tr) && visible(hr))) back = false;
      el.classList.remove('is-open', 'is-in');
      document.documentElement.classList.remove('xpc-lock');
      var done = function () {
        if (src) src.style.visibility = '';
        if (!self.isOpen) { el.hidden = true; el.classList.remove('is-landed', 'is-fly'); self.body.innerHTML = ''; }
      };
      if (back) {
        var f = this.flyer(src, hr);
        f.src = hero.currentSrc || hero.src;
        hero.style.opacity = '0';
        var anim = f.animate([
          { transform: 'translate3d(0,0,0) scale(1,1)' },
          { transform: 'translate3d(' + (tr.left - hr.left) + 'px,' + (tr.top - hr.top) + 'px,0) scale(' + tr.width / hr.width + ',' + tr.height / hr.height + ')' }
        ], { duration: 460, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
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

  /* Public API kept compatible with the old theme object. */
  var api = {
    isOpen: false,
    open: function (handle, trigger) { Q.open(handle, trigger); },
    fetchHtml: function (handle) { Q.open(handle, null); },
    close: function () { Q.close(); }
  };
  if (!window.MinimogTheme) window.MinimogTheme = {};
  window.MinimogTheme.ProductQuickView = api;

  var SEL = '.m-product-quickview-button';
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest(SEL);
    if (!t) return;
    var h = t.getAttribute('data-product-handle');
    if (!h) return;
    e.preventDefault();
    e.stopPropagation();
    Q.open(h, t);
  }, true);
  // Prefetch the product as soon as the shopper shows intent.
  var warm = function (e) {
    var t = e.target.closest && e.target.closest(SEL);
    if (t) loadProduct(t.getAttribute('data-product-handle')).catch(function () {});
  };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('touchstart', warm, { passive: true });
  document.addEventListener('focusin', warm);
})();
