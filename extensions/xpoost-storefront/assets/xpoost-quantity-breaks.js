/**
 * XPoost - Quantity Breaks & Volume Discounts Runtime
 * Handles tier selection, dynamic price computation, animation, RTL localization,
 * and seamless product form synchronization with Shopify Discount Functions.
 */
(function () {
  "use strict";

  function detectLocale(root) {
    var l = "";
    if (root && root.getAttribute && root.getAttribute("data-locale")) {
      l = root.getAttribute("data-locale");
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

  function formatMoney(cents, symbol) {
    var s = symbol || "$";
    var num = (cents / 100).toFixed(2);
    // If ends in .00, keep decimal for precision or format cleanly
    return s + num;
  }

  function findProductForm(root) {
    if (root) {
      var form = root.closest("form");
      if (form) return form;
    }
    return (
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector('product-form form') ||
      document.querySelector('form[data-type="add-to-cart-form"]') ||
      document.querySelector('form#add-to-cart-form')
    );
  }

  function syncFormWithTier(form, tier, offer) {
    if (!form || !tier) return;

    // 1. Sync quantity input
    var qtyInput = form.querySelector('input[name="quantity"]');
    if (qtyInput) {
      qtyInput.value = tier.quantity;
      qtyInput.dispatchEvent(new Event("change", { bubbles: true }));
      qtyInput.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      var hiddenQty = form.querySelector('input[name="quantity"][type="hidden"]');
      if (!hiddenQty) {
        hiddenQty = document.createElement("input");
        hiddenQty.type = "hidden";
        hiddenQty.name = "quantity";
        form.appendChild(hiddenQty);
      }
      hiddenQty.value = tier.quantity;
    }

    // 2. Sync discount property for Shopify Function (_xpoost_discount)
    var discountInput = form.querySelector('input[name="properties[_xpoost_discount]"]');
    var discountVal = parseFloat(tier.discountValue || 0);

    if (discountVal > 0) {
      if (!discountInput) {
        discountInput = document.createElement("input");
        discountInput.type = "hidden";
        discountInput.name = "properties[_xpoost_discount]";
        form.appendChild(discountInput);
      }
      if (offer.discountType === "FIXED_PER_ITEM") {
        discountInput.value = "fixed:" + discountVal.toFixed(2);
      } else {
        discountInput.value = String(discountVal);
      }
    } else if (discountInput) {
      discountInput.remove();
    }

    // 3. Sync tier label property (_xpoost_qb_tier)
    var tierInput = form.querySelector('input[name="properties[_xpoost_qb_tier]"]');
    if (discountVal > 0) {
      if (!tierInput) {
        tierInput = document.createElement("input");
        tierInput.type = "hidden";
        tierInput.name = "properties[_xpoost_qb_tier]";
        form.appendChild(tierInput);
      }
      tierInput.value = tier.title || ("Qty " + tier.quantity);
    } else if (tierInput) {
      tierInput.remove();
    }
  }

  function initQuantityBreaks() {
    var root = document.getElementById("xpoost-quantity-breaks-root");
    if (!root) return;

    var container = root.querySelector(".xpp-qb-container");
    if (!container) return;

    var productId = root.getAttribute("data-product-id");
    var rawPrice = parseInt(root.getAttribute("data-variant-price") || "0", 10);
    var currencySymbol = root.getAttribute("data-currency-symbol") || "$";
    var locale = detectLocale(root);
    var isRtl = locale === "ar";
    var proxyPath = root.getAttribute("data-proxy-path") || "/apps/xpoost/config";

    if (isRtl) {
      root.setAttribute("dir", "rtl");
    }

    var fetchUrl = proxyPath + (proxyPath.indexOf("?") === -1 ? "?" : "&") + "locale=" + encodeURIComponent(locale) + "&t=" + Date.now();

    fetch(fetchUrl, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.active || !data.features || !data.features.quantityBreaks) {
          return;
        }

        var qbFeature = data.features.quantityBreaks;
        if (!qbFeature.active || !qbFeature.offers || qbFeature.offers.length === 0) {
          return;
        }

        // Match current product against active offers
        var matchingOffer = null;
        for (var i = 0; i < qbFeature.offers.length; i++) {
          var offer = qbFeature.offers[i];
          var targetMode = (offer.targetMode || "ALL").toUpperCase();
          var pIds = offer.productIds || [];

          var isProductMatch = false;
          if (targetMode === "ALL") {
            isProductMatch = true;
          } else if (targetMode === "SPECIFIC") {
            isProductMatch = pIds.some(function (id) {
              return String(id) === String(productId) || String(id).indexOf(String(productId)) !== -1;
            });
          } else if (targetMode === "EXCLUDE") {
            var isExcluded = pIds.some(function (id) {
              return String(id) === String(productId) || String(id).indexOf(String(productId)) !== -1;
            });
            isProductMatch = !isExcluded;
          }

          if (isProductMatch && offer.tiers && offer.tiers.length > 0) {
            matchingOffer = offer;
            break;
          }
        }

        if (!matchingOffer) return;

        renderOffer(root, container, matchingOffer, rawPrice, currencySymbol, locale, isRtl);
      })
      .catch(function (err) {
        console.warn("[XPoost Quantity Breaks]", err);
      });
  }

  function renderOffer(root, container, offer, initialPrice, currencySymbol, locale, isRtl) {
    var tiers = offer.tiers || [];
    if (tiers.length === 0) return;

    var currentPrice = initialPrice || 0;
    var preset = offer.designPreset || "modern_cards";
    var anim = offer.animationStyle || "shimmer";
    var t = offer.translations || {};

    // Apply offer custom styling variables
    root.style.setProperty("--xpp-qb-accent", offer.accentColor || "#D4AF37");
    root.style.setProperty("--xpp-qb-bg", offer.backgroundColor || "#141414");
    root.style.setProperty("--xpp-qb-border", offer.borderColor || "#282828");
    root.style.setProperty("--xpp-qb-text", offer.textColor || "#FFFFFF");
    root.style.setProperty("--xpp-qb-badge-bg", offer.badgeBgColor || "#D4AF37");
    root.style.setProperty("--xpp-qb-badge-text", offer.badgeTextColor || "#000000");

    // Apply layout and animation classes
    root.className = "xpp-qb-root xpp-qb-preset-" + preset + " xpp-qb-anim-" + anim;

    // Pick default selected tier (tier with badge, or 2nd tier, or 1st tier)
    var selectedIndex = 0;
    for (var i = 0; i < tiers.length; i++) {
      if (tiers[i].badge && tiers[i].badge.trim() !== "") {
        selectedIndex = i;
        break;
      }
    }
    if (selectedIndex === 0 && tiers.length > 1) {
      selectedIndex = 1;
    }

    function calculateTier(tier) {
      var qty = parseInt(tier.quantity || 1, 10);
      var disc = parseFloat(tier.discountValue || 0);
      var unitPrice = currentPrice;

      if (disc > 0) {
        if (offer.discountType === "FIXED_PER_ITEM") {
          var discCents = Math.round(disc * 100);
          unitPrice = Math.max(0, currentPrice - discCents);
        } else {
          unitPrice = Math.round(currentPrice * (1 - disc / 100));
        }
      }

      var lineTotal = unitPrice * qty;
      var originalTotal = currentPrice * qty;
      var savings = Math.max(0, originalTotal - lineTotal);

      return {
        qty: qty,
        unitPrice: unitPrice,
        lineTotal: lineTotal,
        originalTotal: originalTotal,
        savings: savings,
        disc: disc,
      };
    }

    function buildHtml() {
      var html = "";

      // Header
      var offerTitle = t.offerTitle || "Select Quantity & Save";
      html += '<div class="xpp-qb-header">';
      html += '<span class="xpp-qb-header-text">' + escapeHtml(offerTitle) + '</span>';
      html += '</div>';

      html += '<div class="xpp-qb-tiers-list">';

      for (var idx = 0; idx < tiers.length; idx++) {
        var tier = tiers[idx];
        var calc = calculateTier(tier);
        var isSelected = idx === selectedIndex;
        var isHighlighted = tier.badge && tier.badge.trim() !== "";

        var itemClasses = "xpp-qb-tier-item";
        if (isSelected) itemClasses += " xpp-qb-selected";
        if (isHighlighted) itemClasses += " xpp-qb-highlighted";

        var badgeHtml = "";
        if (tier.badge && tier.badge.trim() !== "") {
          badgeHtml = '<span class="xpp-qb-badge">' + escapeHtml(tier.badge) + '</span>';
        }

        var buyLabel = (t.buyPrefix || "Buy") + " " + calc.qty + " " + (t.itemsSuffix || "items");
        var tierTitle = tier.title && tier.title.trim() !== "" ? tier.title : buyLabel;

        if (preset === "grid_boxes") {
          var gridBadgeHtml = "";
          if (tier.badge && tier.badge.trim() !== "") {
            gridBadgeHtml = '<span class="xpp-qb-badge xpp-qb-badge-pos">' + escapeHtml(tier.badge) + '</span>';
          }
          html += '<div class="' + itemClasses + '" data-tier-index="' + idx + '">';
          html += gridBadgeHtml;
          html += '<div class="xpp-qb-qty-big">' + calc.qty + 'x</div>';
          html += '<div class="xpp-qb-tier-title">' + escapeHtml(tierTitle) + '</div>';
          html += '<div class="xpp-qb-price-unit">' + formatMoney(calc.unitPrice, currencySymbol) + ' <span style="font-size:10px;font-weight:normal;opacity:0.75;">' + escapeHtml(t.eachSuffix || "each") + '</span></div>';
          html += '<div class="xpp-qb-price-total">' + escapeHtml(t.totalLabel || "Total") + ': ' + formatMoney(calc.lineTotal, currencySymbol) + '</div>';
          if (calc.savings > 0) {
            html += '<div class="xpp-qb-save-tag">' + (t.savePrefix || "Save") + " " + formatMoney(calc.savings, currencySymbol) + '</div>';
          }
          html += '</div>';
        } else if (preset === "minimal_table") {
          html += '<div class="' + itemClasses + '" data-tier-index="' + idx + '">';
          html += '<div class="xpp-qb-tier-left">';
          html += '<span class="xpp-qb-radio"><span class="xpp-qb-radio-inner"></span></span>';
          html += '<div class="xpp-qb-tier-title">' + escapeHtml(tierTitle) + '</div>';
          if (badgeHtml) html += badgeHtml;
          html += '</div>';
          html += '<div class="xpp-qb-tier-right">';
          if (calc.savings > 0) {
            html += '<span style="font-size:12px;color:rgba(255,255,255,0.6);text-decoration:line-through;">' + formatMoney(calc.originalTotal, currencySymbol) + '</span>';
          }
          html += '<span class="xpp-qb-price-unit">' + formatMoney(calc.lineTotal, currencySymbol) + '</span>';
          html += '</div>';
          html += '</div>';
        } else {
          // modern_cards & luxury_gold
          html += '<div class="' + itemClasses + '" data-tier-index="' + idx + '">';
          html += '<div class="xpp-qb-tier-left">';
          html += '<span class="xpp-qb-radio"><span class="xpp-qb-radio-inner"></span></span>';
          html += '<div class="xpp-qb-tier-info">';
          html += '<div class="xpp-qb-tier-title">';
          html += escapeHtml(tierTitle);
          if (badgeHtml) html += ' ' + badgeHtml;
          html += '</div>';
          if (tier.subtitle && tier.subtitle.trim() !== "") {
            html += '<div class="xpp-qb-tier-subtitle">' + escapeHtml(tier.subtitle) + '</div>';
          } else if (calc.savings > 0) {
            html += '<div class="xpp-qb-tier-subtitle" style="color:var(--xpp-qb-accent);font-weight:600;">' + (t.savePrefix || "Save") + " " + formatMoney(calc.savings, currencySymbol) + '</div>';
          }
          html += '</div>';
          html += '</div>';

          html += '<div class="xpp-qb-tier-right">';
          html += '<div class="xpp-qb-price-unit">' + formatMoney(calc.unitPrice, currencySymbol) + ' <span style="font-size:11px;font-weight:normal;opacity:0.75;">' + escapeHtml(t.eachSuffix || "each") + '</span></div>';
          if (calc.savings > 0) {
            html += '<div class="xpp-qb-price-compare">' + formatMoney(currentPrice, currencySymbol) + '</div>';
          }
          html += '<div class="xpp-qb-price-total">' + escapeHtml(t.totalLabel || "Total") + ': ' + formatMoney(calc.lineTotal, currencySymbol) + '</div>';
          html += '</div>';

          html += '</div>';
        }
      }

      html += '</div>';
      return html;
    }

    function updateUi() {
      container.innerHTML = buildHtml();
      root.style.display = "block";

      // Attach click listeners to tier elements
      var tierEls = container.querySelectorAll(".xpp-qb-tier-item");
      tierEls.forEach(function (el) {
        el.addEventListener("click", function () {
          var idx = parseInt(el.getAttribute("data-tier-index"), 10);
          if (isNaN(idx) || idx === selectedIndex) return;

          selectedIndex = idx;
          var form = findProductForm(root);
          syncFormWithTier(form, tiers[selectedIndex], offer);
          updateUi();
        });
      });
    }

    // Initial render
    updateUi();

    // Initial product form sync
    var productForm = findProductForm(root);
    syncFormWithTier(productForm, tiers[selectedIndex], offer);

    // Watch for variant change on product page
    setupVariantWatcher(function (newPrice) {
      if (newPrice && newPrice > 0 && newPrice !== currentPrice) {
        currentPrice = newPrice;
        updateUi();
        var f = findProductForm(root);
        syncFormWithTier(f, tiers[selectedIndex], offer);
      }
    });
  }

  function setupVariantWatcher(onVariantPriceChange) {
    // 1. Dawn / modern theme variant custom events
    document.addEventListener("variant:change", function (e) {
      if (e.detail && e.detail.variant && e.detail.variant.price != null) {
        onVariantPriceChange(parseInt(e.detail.variant.price, 10));
      }
    });

    document.addEventListener("shopify:product:variant-change", function (e) {
      if (e.detail && e.detail.variant && e.detail.variant.price != null) {
        onVariantPriceChange(parseInt(e.detail.variant.price, 10));
      }
    });

    // 2. Standard change on form inputs
    var form = findProductForm();
    if (form) {
      form.addEventListener("change", function (e) {
        var target = e.target;
        if (target && (target.name === "id" || target.getAttribute("data-variant-id"))) {
          var matchedOption = target.options ? target.options[target.selectedIndex] : null;
          if (matchedOption && matchedOption.getAttribute("data-price")) {
            var p = parseInt(matchedOption.getAttribute("data-price"), 10);
            if (!isNaN(p)) onVariantPriceChange(p);
          }
        }
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initQuantityBreaks);
  } else {
    initQuantityBreaks();
  }
})();
