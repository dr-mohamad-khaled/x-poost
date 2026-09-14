/**
 * XPoost — Product Scarcity & Inventory Block Runtime
 * Ultra-lightweight variant listener & live inventory updater
 */
(function () {
  "use strict";

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

  function isOutOfStock(root) {
    if (root.dataset.available === "false" || root.dataset.productAvailable === "false") {
      return true;
    }
    var form = root.closest("form") || document.querySelector('form[action*="/cart/add"]');
    if (form) {
      var submitBtn = form.querySelector('[type="submit"], [name="add"]');
      if (submitBtn) {
        var btnText = (submitBtn.textContent || "").toLowerCase();
        if (
          submitBtn.disabled ||
          btnText.indexOf("sold out") !== -1 ||
          btnText.indexOf("out of stock") !== -1 ||
          btnText.indexOf("غير متوفر") !== -1 ||
          btnText.indexOf("نفذت") !== -1 ||
          btnText.indexOf("épuisé") !== -1 ||
          btnText.indexOf("ausverkauft") !== -1 ||
          btnText.indexOf("agotado") !== -1 ||
          btnText.indexOf("esgotado") !== -1
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function computeSimulatedStock(productId, minStock, maxStock) {
    var minS = parseInt(minStock || "3", 10);
    var maxS = parseInt(maxStock || "12", 10);
    if (isNaN(minS) || minS < 1) minS = 3;
    if (isNaN(maxS) || maxS <= minS) maxS = minS + 5;
    var rawDigits = String(productId || "").replace(/\D/g, "");
    var pidNum = parseInt(rawDigits.slice(-4) || "7", 10);
    return (pidNum % (maxS - minS + 1)) + minS;
  }

  function initScarcityBlocks() {
    var blocks = document.querySelectorAll(".xpp-ps-root");
    if (!blocks.length) return;

    blocks.forEach(function (root) {
      if (root.dataset.xppInitialized) return;
      root.dataset.xppInitialized = "true";

      // 1. Initial Sold Out check: hide immediately if out of stock
      if (isOutOfStock(root)) {
        root.classList.add("xpp-ps-hidden");
      }

      var minStock = parseInt(root.dataset.minStock || "3", 10);
      var maxStock = parseInt(root.dataset.maxStock || "12", 10);
      var stockSource = root.dataset.stockSource || "shopify";
      var threshold = parseInt(root.dataset.threshold || "0", 10);
      if (isNaN(threshold)) threshold = 0;

      var productId = root.dataset.productId || "";
      var headlineTpl = root.dataset.headline || "Hurry! Only {stock} items left in stock";
      var subTextTpl = root.dataset.subtext || "";

      // Sync with XPoost global App Proxy config
      var proxyPath = root.dataset.proxyPath || "/apps/xpoost/config";
      var loadConfig = window.__xpoost_load_config || function (p, m) {
        var loc = detectStorefrontLocale(m);
        var sep = p.indexOf("?") === -1 ? "?" : "&";
        return fetch(p + sep + "locale=" + encodeURIComponent(loc), { credentials: "same-origin" }).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });
      };

      loadConfig(proxyPath, root)
        .then(function (data) {
          if (!data || !data.active || !data.features || !data.features.productScarcity) return;
          var cfg = data.features.productScarcity;
          if (!cfg.active) {
            root.classList.add("xpp-ps-hidden");
            return;
          }

          // Check Out of Stock first
          if (isOutOfStock(root)) {
            root.classList.add("xpp-ps-hidden");
            return;
          }

          // 2. Sync stockSource, minStock, maxStock
          if (cfg.stockSource) {
            stockSource = cfg.stockSource;
            root.dataset.stockSource = stockSource;
          }
          if (cfg.minStock) minStock = parseInt(cfg.minStock, 10);
          if (cfg.maxStock) maxStock = parseInt(cfg.maxStock, 10);

          // 3. Sync lowStockThreshold (0 = Always Show)
          if (typeof cfg.lowStockThreshold !== "undefined" && cfg.lowStockThreshold !== null) {
            var appThreshold = parseInt(cfg.lowStockThreshold, 10);
            if (!isNaN(appThreshold)) {
              threshold = appThreshold;
              root.dataset.threshold = String(threshold);
            }
          }

          // 4. Product Targeting Check
          if (cfg.targetMode === "ALL") {
            root.classList.remove("xpp-ps-hidden");
          } else if (cfg.targetMode === "SPECIFIC") {
            var pList = cfg.productIds || [];
            var cleanPid = String(productId).replace(/\D/g, "");
            var matched = pList.some(function (id) {
              return String(id).replace(/\D/g, "") === cleanPid;
            });
            if (!matched) {
              root.classList.add("xpp-ps-hidden");
              return;
            }
            root.classList.remove("xpp-ps-hidden");
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
            root.classList.remove("xpp-ps-hidden");
          }

          // 5. Stock Level & Visibility Handling
          var displayQty = 5;
          if (stockSource === "manual_range") {
            // SIMULATED STOCK RANGE:
            // Calculate simulated stock (e.g. between 3 and 12).
            // Do NOT apply inventory threshold cutoff to simulated stock!
            displayQty = computeSimulatedStock(productId, minStock, maxStock);
            root.classList.remove("xpp-ps-hidden");

            var stockEls = root.querySelectorAll(".xpp-ps-stock-num");
            stockEls.forEach(function (el) {
              el.textContent = String(displayQty);
            });

            var bar = root.querySelector(".xpp-ps-bar");
            if (bar) {
              var effMax = Math.max(maxStock, 12);
              var pct = Math.min(100, Math.max(8, Math.round((displayQty / effMax) * 100)));
              bar.style.width = pct + "%";
            }
          } else {
            // REAL SHOPIFY INVENTORY:
            var stockNum = root.querySelector(".xpp-ps-stock-num");
            var curStock = stockNum ? stockNum.textContent.trim() : "5";
            var curQty = parseInt(curStock, 10);
            displayQty = isNaN(curQty) ? 5 : curQty;

            // Out of stock check
            if (displayQty <= 0) {
              root.classList.add("xpp-ps-hidden");
              return;
            }

            // Threshold cutoff check (0 = Always Show)
            if (threshold > 0 && displayQty > threshold) {
              root.classList.add("xpp-ps-hidden");
              return;
            } else {
              root.classList.remove("xpp-ps-hidden");
            }
          }

          // 6. Translations & RTL
          if (data && data.isRtl) {
            root.setAttribute("dir", "rtl");
          }

          if (data && data.translations && data.translations.productScarcity) {
            var tPs = data.translations.productScarcity;
            var viewNum = root.querySelector(".xpp-ps-viewers-num");
            var curView = viewNum ? viewNum.textContent : "18";

            var hEl = root.querySelector(".xpp-ps-headline");
            if (hEl && tPs.headlineText) {
              hEl.innerHTML = tPs.headlineText
                .replace(/{stock}/g, '<span class="xpp-ps-stock-num">' + displayQty + '</span>')
                .replace(/{viewers}/g, '<span class="xpp-ps-viewers-num">' + curView + '</span>');
            }
            var sEl = root.querySelector(".xpp-ps-subtext");
            if (sEl && tPs.subText) {
              sEl.innerHTML = tPs.subText
                .replace(/{stock}/g, '<span class="xpp-ps-stock-num">' + displayQty + '</span>')
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

      // Variant inventory change listener
      function handleVariantChange(variant) {
        if (!variant) return;

        // 1. If variant is OUT OF STOCK (available === false), HIDE IMMEDIATELY!
        if (variant.available === false) {
          root.dataset.available = "false";
          root.classList.add("xpp-ps-hidden");
          return;
        }

        root.dataset.available = "true";

        // 2. If stock source is simulated (manual_range), stay visible with simulated stock
        if (stockSource === "manual_range") {
          root.classList.remove("xpp-ps-hidden");
          return;
        }

        // 3. If stock source is Shopify inventory:
        var qty = typeof variant.inventory_quantity !== "undefined" ? parseInt(variant.inventory_quantity, 10) : NaN;
        if (isNaN(qty)) {
          root.classList.remove("xpp-ps-hidden");
          return;
        }

        // If inventory is 0 or less, hide
        if (qty <= 0) {
          root.classList.add("xpp-ps-hidden");
          return;
        }

        // Check threshold (0 = Always Show)
        if (threshold > 0 && qty > threshold) {
          root.classList.add("xpp-ps-hidden");
          return;
        }

        root.classList.remove("xpp-ps-hidden");

        var stockEls = root.querySelectorAll(".xpp-ps-stock-num");
        stockEls.forEach(function (el) {
          el.textContent = String(qty);
        });

        var bar = root.querySelector(".xpp-ps-bar");
        if (bar) {
          var maxRange = Math.max(maxStock, 20);
          if (maxRange < qty) {
            maxRange = qty + 5;
          }
          var pct = Math.min(100, Math.max(8, Math.round((qty / maxRange) * 100)));
          bar.style.width = pct + "%";
        }
      }

      // Listen to theme variant change events
      document.addEventListener("variant:change", function (evt) {
        if (evt.detail && evt.detail.variant) {
          handleVariantChange(evt.detail.variant);
        }
      });

      // Form change fallback
      var form = root.closest("form") || document.querySelector('form[action*="/cart/add"]');
      if (form) {
        form.addEventListener("change", function () {
          setTimeout(function () {
            var submitBtn = form.querySelector('[type="submit"], [name="add"]');
            if (submitBtn) {
              var btnText = (submitBtn.textContent || "").toLowerCase();
              if (
                submitBtn.disabled ||
                btnText.indexOf("sold out") !== -1 ||
                btnText.indexOf("out of stock") !== -1 ||
                btnText.indexOf("غير متوفر") !== -1 ||
                btnText.indexOf("نفذت") !== -1
              ) {
                root.classList.add("xpp-ps-hidden");
                return;
              }
            }
            var variantInput = form.querySelector('[name="id"]');
            if (variantInput && variantInput.dataset) {
              var avail = variantInput.dataset.available !== "false";
              var qty = variantInput.dataset.inventoryQuantity;
              handleVariantChange({
                available: avail,
                inventory_quantity: qty ? parseInt(qty, 10) : undefined
              });
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
