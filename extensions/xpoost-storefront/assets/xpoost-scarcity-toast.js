(function () {
  "use strict";

  var ICONS = {
    discount:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>',
    scarcity:
      '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 23c-4.97 0-9-3.8-9-8.5 0-3.37 2.12-6.57 4.29-8.79.7-.72 1.91-.25 1.98.76.24 3.32 2.5 4.53 3.73 2.53C14.2 6.94 15.5 4 14.5 1c4.5 2.5 7.5 7.5 7.5 13.5 0 4.7-4.03 8.5-10 8.5z"/></svg>',
    visitors:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
    fast_shipping:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" stroke-width="1.4"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" stroke="currentColor" stroke-width="1.4"/><circle cx="5.5" cy="18.5" r="2.2" stroke="currentColor" stroke-width="1.2"/><circle cx="18.5" cy="18.5" r="2.2" stroke="currentColor" stroke-width="1.2"/></svg>',
    rare:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h12l4 6-10 12L2 9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 3v18M2 9h20M6.5 3L11 9l-4.5 12M17.5 3L13 9l4.5 12" stroke="currentColor" stroke-width="1.2"/></svg>',
    guarantee:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  
  function detectStorefrontLocale(mountEl) {
    var l = "";
    if (mountEl && mountEl.getAttribute && mountEl.getAttribute("data-locale")) {
      l = mountEl.getAttribute("data-locale");
    } else if (window.Shopify && window.Shopify.locale) {
      l = window.Shopify.locale;
    } else if (document.documentElement && document.documentElement.lang) {
      l = document.documentElement.lang;
    } else if (navigator.language) {
      l = navigator.language;
    }
    var code = (l || "en").split("-")[0].toLowerCase();
    var valid = ["ar", "en", "fr", "de", "es", "it", "pt"];
    return valid.indexOf(code) !== -1 ? code : "en";
  }

  function ready(fn) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(fn, { timeout: 2000 });
    } else {
      window.addEventListener("load", fn, { once: true });
    }
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function matchesShowOn(showOn, pageType) {
    if (!showOn || showOn === "all") return true;
    if (showOn === "product_only") return pageType === "product";
    if (showOn === "home_product") return pageType === "index" || pageType === "product";
    return true;
  }

  function applyTheme(root, config) {
    root.classList.add("xpoost-scarcity-toast--" + (config.position || "bottom-left"));
    root.style.setProperty("--xps-bg", config.backgroundColor || "#0B0B0B");
    root.style.setProperty("--xps-gold", config.accentColor || "#D4AF37");
    root.style.setProperty("--xps-text", config.textColor || "#FFFFFF");
    root.style.setProperty("--xps-radius", (config.borderRadiusPx != null ? config.borderRadiusPx : 12) + "px");
    root.style.setProperty("--xps-bottom-desktop", (config.desktopBottomOffsetPx != null ? config.desktopBottomOffsetPx : 24) + "px");
    root.style.setProperty("--xps-bottom-mobile", (config.mobileBottomOffsetPx != null ? config.mobileBottomOffsetPx : 24) + "px");
  }

  function buildCard(root, config) {
    root.innerHTML =
      '<div class="xpoost-toast-card" id="xpoost-toast-card">' +
      '<span class="xpoost-toast-sheen" aria-hidden="true"></span>' +
      (config.showCloseButton
        ? '<button type="button" class="xpoost-toast-close" id="xpoost-toast-close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          "</button>"
        : "") +
      '<div class="xpoost-toast-item" id="xpoost-toast-item"></div>' +
      (config.showProgressBar
        ? '<div class="xpoost-toast-progress" aria-hidden="true"><div class="xpoost-toast-progress-bar" id="xpoost-toast-progress-bar"></div></div>'
        : "") +
      "</div>";

    return {
      card: root.querySelector("#xpoost-toast-card"),
      item: root.querySelector("#xpoost-toast-item"),
      progressBar: root.querySelector("#xpoost-toast-progress-bar"),
      closeBtn: root.querySelector("#xpoost-toast-close"),
    };
  }

  function renderMessage(item, msg) {
    var icon = msg.icon && msg.icon !== "none" ? ICONS[msg.icon] : "";
    var iconHtml = icon
      ? '<span class="xpoost-toast-icon">' +
        icon +
        (msg.icon === "visitors" ? '<span class="xpoost-pulse-dot"></span>' : "") +
        "</span>"
      : "";

    var body =
      '<span class="xpoost-toast-body">' +
      (msg.badge || msg.pill
        ? '<span class="xpoost-toast-topline">' +
          (msg.badge ? '<span class="xpoost-toast-badge">' + escapeHtml(msg.badge) + "</span>" : "") +
          (msg.pill ? '<span class="xpoost-toast-pill">' + escapeHtml(msg.pill) + "</span>" : "") +
          "</span>"
        : "") +
      '<span class="xpoost-toast-text">' + escapeHtml(msg.text) + "</span>" +
      "</span>";

    var inner = '<span class="xpoost-toast-inner">' + iconHtml + body + "</span>";

    item.innerHTML = msg.url
      ? '<a class="xpoost-toast-link" href="' + encodeURI(msg.url) + '">' + inner + "</a>"
      : inner;
  }

  function startCycle(root, config) {
    var messages = config.messages;
    var els = buildCard(root, config);
    var index = 0;
    var dismissed = false;
    var hovered = false;
    var timer = null;

    var onset = Number(config.onsetDelayMs) || 4000;
    var duration = Number(config.displayDurationMs) || 6000;
    var interval = Number(config.intervalDelayMs) || 5000;

    function clearTimer() {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function startProgress() {
      if (!els.progressBar) return;
      els.progressBar.style.transition = "none";
      els.progressBar.style.transform = "scaleX(1)";
      // force reflow so the transition below actually animates
      void els.progressBar.offsetWidth;
      els.progressBar.style.transition = "transform " + duration / 1000 + "s linear";
      els.progressBar.style.transform = "scaleX(0)";
    }

    function resetProgress() {
      if (!els.progressBar) return;
      els.progressBar.style.transition = "none";
      els.progressBar.style.transform = "scaleX(1)";
    }

    function show() {
      if (dismissed) return;
      clearTimer();
      renderMessage(els.item, messages[index % messages.length]);
      els.card.classList.remove("is-hiding");
      els.card.classList.add("is-visible");
      startProgress();
      timer = window.setTimeout(hide, duration);
    }

    function hide() {
      if (dismissed) return;
      clearTimer();
      els.card.classList.remove("is-visible");
      els.card.classList.add("is-hiding");
      resetProgress();
      index = (index + 1) % messages.length;
      timer = window.setTimeout(show, interval);
    }

    var hasHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    if (config.pauseOnHover && hasHover) {
      els.card.addEventListener("mouseenter", function () {
        if (els.card.classList.contains("is-visible")) {
          hovered = true;
          clearTimer();
        }
      });
      els.card.addEventListener("mouseleave", function () {
        if (hovered && !dismissed) {
          hovered = false;
          clearTimer();
          timer = window.setTimeout(hide, 1200);
        }
      });
    }

    if (els.closeBtn) {
      els.closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        dismissed = true;
        clearTimer();
        els.card.classList.remove("is-visible");
        els.card.classList.add("is-hiding");
      });
    }

    timer = window.setTimeout(show, onset);
  }

  function init() {
    var root = document.getElementById("xpoost-scarcity-toast");
    if (!root) return;

    var proxyPath = root.getAttribute("data-proxy-path") || "/apps/xpoost/config";
    var altProxyPath = root.getAttribute("data-alt-proxy-path") || "/apps/xpoost/scarcity-config";
    var pageType =
      root.getAttribute("data-page-type") ||
      (window.location.pathname === "/"
        ? "index"
        : window.location.pathname.indexOf("/products/") !== -1
        ? "product"
        : "other");

    function handleData(data) {
      if (window.__xpoost_scarcity_initialized) return true;
      if (!data) return false;
      var config = data.features ? data.features.scarcity : data;
      if (!config || !config.active) return false;
      if (!config.messages || !config.messages.length) return false;
      if (!matchesShowOn(config.showOn, pageType)) return false;

      window.__xpoost_scarcity_initialized = true;
      applyTheme(root, config);
      startCycle(root, config);
      return true;
    }

    var loadConfig = window.__xpoost_load_config || function (p) {
      return fetch(p, { credentials: "same-origin" }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    };

    var loc = detectStorefrontLocale(root); loadConfig(proxyPath + (proxyPath.indexOf("?") === -1 ? "?" : "&") + "locale=" + encodeURIComponent(loc), root)
      .then(function (data) {
        var ok = handleData(data);
        if (!ok && altProxyPath && altProxyPath !== proxyPath) {
          fetch(altProxyPath, { credentials: "same-origin" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(handleData)
            .catch(function () {});
        }
      })
      .catch(function () {
        if (altProxyPath && altProxyPath !== proxyPath) {
          fetch(altProxyPath, { credentials: "same-origin" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(handleData)
            .catch(function () {});
        }
      });
  }

  ready(init);
})();
