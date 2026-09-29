/**
 * XPoost analytics tracker (shared by every XPoost block).
 *
 *   XPT.track(feature, event, { o: offerId, d: detail, v: value, once: true })
 *   XPT.observe(element, feature, { o, d })   // viewable impression: >=50% visible for 1s, once per session
 *
 * feature: pp | ic | qb | sb | ei | st | ps | so     event: i (impression) | c (click) | a (action) | x (dismiss)
 * Events are batched and sent with navigator.sendBeacon to the app proxy (/apps/xpoost/track).
 * Anonymous random ids only; no personal data. If the visitor declined analytics
 * (Shopify Customer Privacy API), only anonymous counts are sent.
 */
(function () {
  "use strict";
  if (window.XPT && window.XPT.__xp) return;

  // Don't count the theme editor, automated browsers or known crawlers
  var skip = false;
  try {
    skip = Boolean(window.Shopify && window.Shopify.designMode) ||
      Boolean(navigator.webdriver) ||
      /bot|crawl|spider|lighthouse|headless|preview/i.test(navigator.userAgent || "");
  } catch (e) {}
  if (skip) {
    window.XPT = { __xp: 1, track: function () {}, observe: function () {}, flush: function () {} };
    return;
  }

  var ENDPOINT = "/apps/xpoost/track";
  var FLUSH_MS = 4000;
  var MAX_QUEUE = 25;
  var SESSION_IDLE_MS = 30 * 60 * 1000;

  var queue = [];
  var flushTimer = null;
  var memOnce = {};

  function store(kind) {
    try {
      var s = window[kind];
      var k = "__xpt";
      s.setItem(k, "1");
      s.removeItem(k);
      return s;
    } catch (e) {
      return null;
    }
  }
  var ss = store("sessionStorage");
  var ls = store("localStorage");

  function rid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function consentAllowed() {
    try {
      var cp = window.Shopify && window.Shopify.customerPrivacy;
      if (cp && typeof cp.analyticsProcessingAllowed === "function") {
        return cp.analyticsProcessingAllowed() !== false;
      }
    } catch (e) {}
    return true;
  }

  function visitorId() {
    if (!consentAllowed() || !ls) return "";
    var v = ls.getItem("xp_vid");
    if (!v || !/^[a-z0-9]{8,40}$/.test(v)) {
      v = rid();
      try { ls.setItem("xp_vid", v); } catch (e) {}
    }
    return v;
  }

  // Session: 30 minutes of inactivity starts a new one
  var sessionIsNew = false;
  (function initSession() {
    if (!ss) { sessionIsNew = true; return; }
    var now = Date.now();
    var last = parseInt(ss.getItem("xp_sts") || "0", 10);
    if (!ss.getItem("xp_sid") || now - last > SESSION_IDLE_MS) {
      ss.setItem("xp_sid", rid());
      ss.setItem("xp_once", "{}");
      ss.removeItem("xp_attr");
      sessionIsNew = true;
    }
    ss.setItem("xp_sts", String(now));
  })();

  function onceSeen(key) {
    if (!ss) {
      if (memOnce[key]) return true;
      memOnce[key] = 1;
      return false;
    }
    var map = {};
    try { map = JSON.parse(ss.getItem("xp_once") || "{}"); } catch (e) {}
    if (map[key]) return true;
    map[key] = 1;
    try { ss.setItem("xp_once", JSON.stringify(map)); } catch (e) {}
    return false;
  }

  function device() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 749px)").matches) return "m";
    } catch (e) {}
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "") ? "m" : "d";
  }

  // Link this visitor to their cart once per session so orders can be matched to what they saw.
  // Uses XHR on purpose: XPoost's cart engine watches fetch() for cart changes.
  function tagCart() {
    if (!ss || ss.getItem("xp_attr")) return;
    var vid = visitorId();
    if (!vid) return;
    ss.setItem("xp_attr", "1");
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/cart/update.js", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify({ attributes: { _xp_vid: vid } }));
    } catch (e) {}
  }

  function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (queue.length === 0) return;
    var batch = queue.splice(0, queue.length);
    var body = JSON.stringify({ v: 1, vid: visitorId(), dev: device(), ev: batch });
    var sent = false;
    try {
      if (navigator.sendBeacon) {
        sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }));
      }
    } catch (e) {}
    if (!sent) {
      try {
        fetch(ENDPOINT, { method: "POST", body: body, keepalive: true, credentials: "same-origin", headers: { "Content-Type": "text/plain" } }).catch(function () {});
      } catch (e) {}
    }
  }

  function schedule() {
    if (queue.length >= MAX_QUEUE) { flush(); return; }
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
  }

  function track(f, e, opts) {
    opts = opts || {};
    var o = opts.o != null ? String(opts.o).slice(0, 40) : "";
    var d = opts.d != null ? String(opts.d).slice(0, 40) : "";
    if (opts.once && onceSeen(f + "|" + e + "|" + o + "|" + d)) return;
    var ev = { f: f, e: e };
    if (o) ev.o = o;
    if (d) ev.d = d;
    var v = parseFloat(opts.v);
    if (isFinite(v) && v > 0) ev.v = Math.round(v * 100) / 100;
    queue.push(ev);
    if (e === "i") tagCart();
    schedule();
  }

  var observed = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function observe(el, f, opts) {
    if (!el || !f) return;
    opts = opts || {};
    var key = f + "|" + (opts.o || "") + "|" + (opts.d || "");
    if (observed) {
      var keys = observed.get(el) || {};
      if (keys[key]) return;
      keys[key] = 1;
      observed.set(el, keys);
    }
    var fire = function () { track(f, "i", { o: opts.o, d: opts.d, once: true }); };
    if (!("IntersectionObserver" in window)) { fire(); return; }

    var timer = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!timer) {
            timer = setTimeout(function () {
              fire();
              io.disconnect();
            }, 1000);
          }
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      });
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);

  window.XPT = { __xp: 1, track: track, observe: observe, flush: flush };

  if (sessionIsNew) track("_s", "s");
})();
