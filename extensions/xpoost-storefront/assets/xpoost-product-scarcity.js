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
      var proxyPath = root.dataset.proxyPath || "/apps/xpoost/config";
      if (proxyPath && window.fetch) {
        try {
          fetch(proxyPath)
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
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScarcityBlocks);
  } else {
    initScarcityBlocks();
  }
})();
