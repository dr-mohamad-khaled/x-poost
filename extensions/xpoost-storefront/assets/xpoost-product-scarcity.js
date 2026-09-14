/**
 * XPoost — Product Scarcity & Inventory Block Runtime
 * Ultra-lightweight variant listener, live inventory updater & dynamic theme sync
 */
(function () {
  "use strict";

  var FLAME_SVG = '<svg viewBox="0 0 1200 1200" width="18" height="18" fill="currentColor"><path d="M 381.63997,1200 C 135.77919,1061.434 71.049038,930.27865 108.05732,751.14866 135.37841,618.87726 224.83888,511.26304 233.417,379.24524 271.63184,448.78945 287.59935,498.9368 291.87036,571.60898 413.41348,422.69507 493.73121,216.54632 498.48692,0 c 0,0 316.57523,186.01008 337.34836,466.98023 27.25312,-57.91289 40.97132,-149.89172 13.7182,-209.5043 C 931.31098,317.09086 1409.8464,846.31428 784.73519,1200 902.263,971.16186 815.05535,662.38827 610.99652,519.78234 624.62426,581.10164 600.73114,809.80288 510.45434,910.29655 535.46754,742.38092 486.6538,671.37843 486.6538,671.37843 c 0,0 -16.75337,94.05444 -81.7575,189.06609 C 345.53708,947.20639 304.40709,1039.2914 381.64021,1200 z" /></svg>';
  var EYE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';

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
    var rawDigits = String(productId || "").replace(/\\D/g, "");
    var pidNum = parseInt(rawDigits.slice(-4) || "7", 10);
    return (pidNum % (maxS - minS + 1)) + minS;
  }

  function formatTemplate(text, stock, viewers) {
    if (!text) return "";
    var stockHtml = '<span class="xpp-ps-stock-num">' + stock + '</span>';
    var viewersHtml = '<span class="xpp-ps-viewers-num">' + viewers + '</span>';
    return text.replace(/{stock}/g, stockHtml).replace(/{viewers}/g, viewersHtml);
  }

  function renderPresetHtml(preset, state) {
    var p = preset || "pulse_meter";
    var formattedHeadline = formatTemplate(state.headlineText, state.displayQty, state.currentViewers);
    var formattedSubtext = formatTemplate(state.subText, state.displayQty, state.currentViewers);
    var subHtml = formattedSubtext ? '<div class="xpp-ps-subtext">' + formattedSubtext + '</div>' : "";

    if (p === "urgency_badge") {
      return (
        '<div class="xpp-ps-urgency-badge">' +
          '<div class="xpp-ps-radar" aria-hidden="true">' +
            '<div class="xpp-ps-radar-dot"></div>' +
            '<div class="xpp-ps-radar-wave"></div>' +
          '</div>' +
          '<p class="xpp-ps-headline">' + formattedHeadline + '</p>' +
        '</div>'
      );
    }

    if (p === "luxury_card") {
      var suffix = state.viewingSuffix || "viewing";
      return (
        '<div class="xpp-ps-luxury-card">' +
          '<div class="xpp-ps-luxury-left">' +
            '<span class="xpp-ps-icon-flame" aria-hidden="true">' + FLAME_SVG + '</span>' +
            '<div>' +
              '<p class="xpp-ps-headline">' + formattedHeadline + '</p>' +
              subHtml +
            '</div>' +
          '</div>' +
          '<div class="xpp-ps-luxury-right">' +
            '<span class="xpp-ps-live-dot" aria-hidden="true"></span>' +
            EYE_SVG +
            '<span><span class="xpp-ps-viewers-num">' + state.currentViewers + '</span> ' + suffix + '</span>' +
          '</div>' +
        '</div>'
      );
    }

    if (p === "flash_demand") {
      var badge = state.badgeText || "High Demand";
      var flashSubHtml = formattedSubtext ? '<div class="xpp-ps-subtext" style="margin-bottom: 8px;">' + formattedSubtext + '</div>' : "";
      return (
        '<div class="xpp-ps-flash-demand">' +
          '<div class="xpp-ps-flash-header">' +
            '<span class="xpp-ps-badge-tag">' + badge + '</span>' +
            '<p class="xpp-ps-headline" style="margin: 0;">' + formattedHeadline + '</p>' +
          '</div>' +
          flashSubHtml +
          '<div class="xpp-ps-track">' +
            '<div class="xpp-ps-bar" style="width: ' + state.barPercent + '%;"></div>' +
          '</div>' +
        '</div>'
      );
    }

    // Default: pulse_meter
    return (
      '<div class="xpp-ps-pulse-meter">' +
        '<div class="xpp-ps-header">' +
          '<span class="xpp-ps-icon-flame" aria-hidden="true">' + FLAME_SVG + '</span>' +
          '<p class="xpp-ps-headline">' + formattedHeadline + '</p>' +
        '</div>' +
        '<div class="xpp-ps-track">' +
          '<div class="xpp-ps-bar" style="width: ' + state.barPercent + '%;"></div>' +
        '</div>' +
        subHtml +
      '</div>'
    );
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

      // Continuous Live Viewers State Setup
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
            var cleanPid = String(productId).replace(/\\D/g, "");
            var matched = pList.some(function (id) {
              return String(id).replace(/\\D/g, "") === cleanPid;
            });
            if (!matched) {
              root.classList.add("xpp-ps-hidden");
              return;
            }
            root.classList.remove("xpp-ps-hidden");
          } else if (cfg.targetMode === "EXCLUDE") {
            var pList = cfg.productIds || [];
            var cleanPid = String(productId).replace(/\\D/g, "");
            var excluded = pList.some(function (id) {
              return String(id).replace(/\\D/g, "") === cleanPid;
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

          // 6. RTL Support
          if (data && data.isRtl) {
            root.setAttribute("dir", "rtl");
          } else {
            root.removeAttribute("dir");
          }

          // 7. Dynamic Custom Colors from App Dashboard
          if (cfg.accentColor) root.style.setProperty("--xpp-ps-accent", cfg.accentColor);
          if (cfg.backgroundColor) root.style.setProperty("--xpp-ps-bg", cfg.backgroundColor);
          if (cfg.textColor) root.style.setProperty("--xpp-ps-text", cfg.textColor);
          if (cfg.borderColor) root.style.setProperty("--xpp-ps-border", cfg.borderColor);

          // 8. Texts & Copy
          var tPs = (data && data.translations && data.translations.productScarcity) ? data.translations.productScarcity : {};
          var activeHeadline = tPs.headlineText || cfg.headlineText || root.dataset.headline || "Hurry! Only {stock} items left in stock";
          var activeSubtext = tPs.subText || cfg.subText || root.dataset.subtext || "";
          var activeBadge = tPs.badgeText || "High Demand";
          var activeViewingSuffix = tPs.viewingSuffix || "viewing";

          // Calculate Progress Bar %
          var maxMeter = Math.max(maxStock, 15);
          if (maxMeter < displayQty) maxMeter = displayQty + 5;
          var barPercent = Math.min(100, Math.max(8, Math.round((displayQty / maxMeter) * 100)));

          // 9. Dynamic Preset Layout Render from App Dashboard
          var activePreset = cfg.designPreset || root.dataset.designPreset || "pulse_meter";
          root.dataset.designPreset = activePreset;

          root.innerHTML = renderPresetHtml(activePreset, {
            displayQty: displayQty,
            currentViewers: currentViewers,
            headlineText: activeHeadline,
            subText: activeSubtext,
            badgeText: activeBadge,
            viewingSuffix: activeViewingSuffix,
            barPercent: barPercent
          });
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
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScarcityBlocks);
  } else {
    initScarcityBlocks();
  }
})();
