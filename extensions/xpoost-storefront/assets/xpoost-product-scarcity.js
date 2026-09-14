/**
 * XPoost — Product Scarcity & Inventory Block Runtime
 * Ultra-lightweight variant listener & live inventory updater
 */
(function () {
  "use strict";

  function initScarcityBlocks() {
    var blocks = document.querySelectorAll(".xpp-ps-root");
    if (!blocks.length) return;

    blocks.forEach(function (root) {
      if (root.dataset.xppInitialized) return;
      root.dataset.xppInitialized = "true";

      var minStock = parseInt(root.dataset.minStock || "3", 10);
      var maxStock = parseInt(root.dataset.maxStock || "12");
      var stockSource = root.dataset.stockSource || "shopify";
      var threshold = parseInt(root.dataset.threshold || "20", 10);
      var productId = root.dataset.productId || "";
      var headlineTpl = root.dataset.headline || "Hurry! Only {stock} items left in stock";
      var subTextTpl = root.dataset.subtext || "";

      // Optional sync with XPoost global App Proxy config
      
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

      var proxyPath = root.dataset.proxyPath || "/apps/xpoost/config";
      if (proxyPath && window.fetch) {
        try {
          var loc = detectStorefrontLocale(root); var sep = proxyPath.indexOf("?") === -1 ? "?" : "&"; fetch(proxyPath + sep + "locale=" + encodeURIComponent(loc))
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (!data || !data.active || !data.features || !data.features.productScarcity) return;
              var cfg = data.features.productScarcity;
              if (!cfg.active) {
                root.classList.add("xpp-ps-hidden");
                return;
              }
              // Targeting checks
              if (cfg.targetMode === "SPECIFIC") {
                var pList = cfg.productIds || [];
                var cleanPid = String(productId).replace(/\D/g, "");
                var matched = pList.some(function (id) {
                  return String(id).replace(/\D/g, "") === cleanPid;
                });
                if (!matched) {
                  root.classList.add("xpp-ps-hidden");
                  return;
                }
              } else if (cfg.targetMode === "EXCLUDE") {
                var pList = cfg.productIds || [];
                var cleanPid = String(productId).replace(/\D/g, "");
                var excluded = pList.some(function (id) {
                  return String(id).replace(/\D/g, "") === cleanPid;
                });
                if (excluded) {
                  root.classList.add("xpp-ps-hidden");
                  return;
                }
              }
              if (data && data.isRtl) {
                root.setAttribute("dir", "rtl");
              }
              if (data && data.translations && data.translations.productScarcity) {
                var tPs = data.translations.productScarcity;
                var stockNum = root.querySelector(".xpp-ps-stock-num");
                var curStock = stockNum ? stockNum.textContent : "5";
                var viewNum = root.querySelector(".xpp-ps-viewers-num");
                var curView = viewNum ? viewNum.textContent : "18";

                var hEl = root.querySelector(".xpp-ps-headline");
                if (hEl && tPs.headlineText) {
                  hEl.innerHTML = tPs.headlineText
                    .replace(/{stock}/g, '<span class="xpp-ps-stock-num">' + curStock + '</span>')
                    .replace(/{viewers}/g, '<span class="xpp-ps-viewers-num">' + curView + '</span>');
                }
                var sEl = root.querySelector(".xpp-ps-subtext");
                if (sEl && tPs.subText) {
                  sEl.innerHTML = tPs.subText
                    .replace(/{stock}/g, '<span class="xpp-ps-stock-num">' + curStock + '</span>')
                    .replace(/{viewers}/g, '<span class="xpp-ps-viewers-num">' + curView + '</span>');
                }
                var bEl = root.querySelector(".xpp-ps-badge-tag");
                if (bEl && tPs.badgeText) {
                  bEl.textContent = tPs.badgeText;
                }
                var luxRight = root.querySelector(".xpp-ps-luxury-right");
                if (luxRight && tPs.viewingSuffix) {
                  var spanWrapper = luxRight.querySelector("span:not(.xpp-ps-live-dot)");
                  if (spanWrapper) {
                    spanWrapper.innerHTML = '<span class="xpp-ps-viewers-num">' + curView + '</span> ' + tPs.viewingSuffix;
                  }
                }
              }
            })
            .catch(function () {});
        } catch (e) {}
      }

      // Variant inventory change listener
      function updateStockDisplay(newQuantity) {
        var qty = parseInt(newQuantity, 10);
        if (isNaN(qty)) return;

        if (threshold > 0 && qty > threshold) {
          root.classList.add("xpp-ps-hidden");
          return;
        } else {
          root.classList.remove("xpp-ps-hidden");
        }

        var stockEls = root.querySelectorAll(".xpp-ps-stock-num");
        stockEls.forEach(function (el) {
          el.textContent = String(qty);
        });

        var bar = root.querySelector(".xpp-ps-bar");
        if (bar) {
          var maxRange = Math.max(maxStock, 20);
          var pct = Math.min(100, Math.max(8, Math.round((qty / maxRange) * 100)));
          bar.style.width = pct + "%";
        }
      }

      // Listen to theme variant change events
      document.addEventListener("variant:change", function (evt) {
        if (evt.detail && evt.detail.variant && typeof evt.detail.variant.inventory_quantity !== "undefined") {
          updateStockDisplay(evt.detail.variant.inventory_quantity);
        }
      });

      // Form change fallback
      var form = root.closest("form") || document.querySelector('form[action*="/cart/add"]');
      if (form) {
        form.addEventListener("change", function () {
          // Delay briefly to allow theme to update variant data
          setTimeout(function () {
            var variantInput = form.querySelector('[name="id"]');
            if (variantInput && variantInput.dataset && variantInput.dataset.inventoryQuantity) {
              updateStockDisplay(variantInput.dataset.inventoryQuantity);
            }
          }, 50);
        });
      }

      // Continuous Live Viewers Counter
      var initialViewers = parseInt(root.dataset.initialViewers || "18", 10);
      if (isNaN(initialViewers) || initialViewers < 5) {
        var firstViewerEl = root.querySelector(".xpp-ps-viewers-num");
        if (firstViewerEl) {
          var parsed = parseInt(firstViewerEl.textContent.trim(), 10);
          if (!isNaN(parsed) && parsed > 0) initialViewers = parsed;
        }
      }
      if (isNaN(initialViewers) || initialViewers < 5) initialViewers = 18;

      var currentViewers = initialViewers;
      var minViewers = Math.max(6, initialViewers - 7);
      var maxViewers = initialViewers + 13;

      function updateViewersDisplay(count) {
        var viewerEls = root.querySelectorAll(".xpp-ps-viewers-num");
        if (!viewerEls.length) return;
        viewerEls.forEach(function (el) {
          el.textContent = String(count);
          el.classList.remove("xpp-ps-num-tick");
          void el.offsetWidth;
          el.classList.add("xpp-ps-num-tick");
        });
      }

      function scheduleNextViewerTick() {
        var delay = Math.floor(Math.random() * 2600) + 3200;
        setTimeout(function () {
          if (!document.hidden) {
            var rand = Math.random();
            var delta = 0;
            if (currentViewers <= minViewers) {
              delta = Math.floor(Math.random() * 2) + 1;
            } else if (currentViewers >= maxViewers) {
              delta = -(Math.floor(Math.random() * 2) + 1);
            } else {
              if (rand < 0.28) delta = -1;
              else if (rand < 0.58) delta = 1;
              else if (rand < 0.76) delta = 2;
              else if (rand < 0.90) delta = -2;
              else if (rand < 0.95) delta = 3;
              else delta = -3;
            }
            var nextCount = Math.max(minViewers, Math.min(maxViewers, currentViewers + delta));
            if (nextCount !== currentViewers) {
              currentViewers = nextCount;
              updateViewersDisplay(currentViewers);
            }
          }
          scheduleNextViewerTick();
        }, delay);
      }

      scheduleNextViewerTick();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScarcityBlocks);
  } else {
    initScarcityBlocks();
  }
})();
