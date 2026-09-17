/**
 * XPoost - Quantity Breaks & Volume Discounts Runtime
 * Ultra-compact responsive layout, out-of-stock suppression, unclipped floating badges,
 * and integrated Add to Cart button synchronized with Shopify Discount Function.
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

  function isOutOfStock(root) {
    if (root.getAttribute("data-available") === "false" || root.getAttribute("data-product-available") === "false") {
      return true;
    }
    var form = findProductForm(root);
    if (form) {
      var submitBtn = form.querySelector('[type="submit"], [name="add"], button.add-to-cart, button.product-form__submit');
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

    // Check out-of-stock condition first
    if (isOutOfStock(root)) {
      root.classList.add("xpp-qb-hidden");
      root.style.display = "none";
      setupVariantWatcher(function (newPrice, available) {
        if (available !== false) {
          root.setAttribute("data-available", "true");
          root.classList.remove("xpp-qb-hidden");
          initQuantityBreaks();
        }
      });
      return;
    }

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
    root.style.setProperty("--xpp-qb-btn-bg", offer.btnBgColor || offer.accentColor || "#D4AF37");
    root.style.setProperty("--xpp-qb-btn-text", offer.btnTextColor || "#000000");

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
      html += '<span class="xpp-qb-header-title">' + escapeHtml(offerTitle) + '</span>';
      if (t.subtitle && t.subtitle.trim() !== "") {
        html += '<span class="xpp-qb-header-subtitle">' + escapeHtml(t.subtitle) + '</span>';
      }
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

        var isShimmer = anim === "shimmer" && (isHighlighted || isSelected);
        var shimmerHtml = isShimmer ? '<div class="xpp-qb-shimmer-layer"></div>' : "";

        var badgeHtml = "";
        if (isHighlighted) {
          var badgeClass = "xpp-qb-badge" + (preset === "grid_boxes" ? " xpp-qb-badge-pos" : "");
          badgeHtml = '<span class="' + badgeClass + '">' + escapeHtml(tier.badge) + '</span>';
        }

        var buyLabel = (t.buyPrefix || "Buy") + " " + calc.qty + " " + (t.itemsSuffix || "items");
        var tierTitle = tier.title && tier.title.trim() !== "" ? tier.title : buyLabel;

        if (preset === "grid_boxes") {
          html += '<div class="' + itemClasses + '" data-tier-index="' + idx + '">';
          html += shimmerHtml;
          html += badgeHtml;
          html += '<div class="xpp-qb-qty-big">' + calc.qty + 'x</div>';
          html += '<div class="xpp-qb-tier-title">' + escapeHtml(tierTitle) + '</div>';
          html += '<div class="xpp-qb-price-unit">' + formatMoney(calc.lineTotal, currencySymbol) + '</div>';
          html += '<div class="xpp-qb-price-total">' + formatMoney(calc.unitPrice, currencySymbol) + ' ' + escapeHtml(t.eachSuffix || "ea") + '</div>';
          if (calc.savings > 0) {
            html += '<div class="xpp-qb-save-tag">' + (t.savePrefix || "Save") + " " + formatMoney(calc.savings, currencySymbol) + '</div>';
          }
          html += '</div>';
        } else if (preset === "minimal_table") {
          html += '<div class="' + itemClasses + '" data-tier-index="' + idx + '">';
          html += shimmerHtml;
          html += '<div class="xpp-qb-tier-left">';
          html += '<span class="xpp-qb-radio"><span class="xpp-qb-radio-inner"></span></span>';
          html += '<div class="xpp-qb-tier-title">' + escapeHtml(tierTitle) + '</div>';
          if (badgeHtml) html += badgeHtml;
          html += '</div>';
          html += '<div class="xpp-qb-tier-right">';
          if (calc.savings > 0) {
            html += '<span style="font-size:11px;color:rgba(255,255,255,0.6);text-decoration:line-through;">' + formatMoney(calc.originalTotal, currencySymbol) + '</span>';
          }
          html += '<span class="xpp-qb-price-unit">' + formatMoney(calc.lineTotal, currencySymbol) + '</span>';
          html += '</div>';
          html += '</div>';
        } else {
          // modern_cards & luxury_gold
          html += '<div class="' + itemClasses + '" data-tier-index="' + idx + '">';
          html += shimmerHtml;
          html += badgeHtml;

          html += '<div class="xpp-qb-tier-left">';
          html += '<span class="xpp-qb-radio"><span class="xpp-qb-radio-inner"></span></span>';
          html += '<div class="xpp-qb-tier-info">';
          html += '<div class="xpp-qb-tier-title">' + escapeHtml(tierTitle) + '</div>';
          if (tier.subtitle && tier.subtitle.trim() !== "") {
            html += '<div class="xpp-qb-tier-subtitle">' + escapeHtml(tier.subtitle) + '</div>';
          } else if (calc.savings > 0) {
            html += '<div class="xpp-qb-tier-subtitle" style="color:var(--xpp-qb-accent);font-weight:700;">' + (t.savePrefix || "Save") + " " + formatMoney(calc.savings, currencySymbol) + '</div>';
          }
          html += '</div>';
          html += '</div>';

          html += '<div class="xpp-qb-tier-right">';
          html += '<div class="xpp-qb-price-unit">' + formatMoney(calc.lineTotal, currencySymbol) + '</div>';
          html += '<div class="xpp-qb-price-sub">';
          if (calc.savings > 0) {
            html += '<span class="xpp-qb-price-compare">' + formatMoney(calc.originalTotal, currencySymbol) + '</span>';
          }
          html += '<span>' + formatMoney(calc.unitPrice, currencySymbol) + ' ' + escapeHtml(t.eachSuffix || "ea") + '</span>';
          html += '</div>';
          html += '</div>';

          html += '</div>';
        }
      }

      html += '</div>';

      // Integrated Add to Cart button
      if (offer.showAddToCartBtn !== false) {
        var btnText = t.addToCartBtn || offer.addToCartBtnText || "Add to Cart";
        html += '<button type="button" class="xpp-qb-atc-btn">';
        html += '<span class="xpp-qb-btn-label">' + escapeHtml(btnText) + '</span>';
        html += '</button>';
      }

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

      // Attach click listener to Add to Cart button
      var atcBtn = container.querySelector(".xpp-qb-atc-btn");
      if (atcBtn) {
        atcBtn.addEventListener("click", function (e) {
          e.preventDefault();
          var form = findProductForm(root);
          if (!form) return;

          syncFormWithTier(form, tiers[selectedIndex], offer);

          atcBtn.classList.add("is-loading");
          atcBtn.disabled = true;
          var originalContent = atcBtn.innerHTML;
          atcBtn.innerHTML = '<span class="xpp-qb-spinner"></span>';

          var formData = new FormData(form);
          fetch("/cart/add.js", {
            method: "POST",
            body: formData,
            headers: { "X-Requested-With": "XMLHttpRequest" }
          })
            .then(function (res) {
              if (!res.ok) throw new Error("Cart response error");
              return res.json();
            })
            .then(function () {
              document.dispatchEvent(new CustomEvent("cart:updated", { bubbles: true }));
              document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));

              // Try opening theme cart drawer if present
              var drawer = document.querySelector("cart-drawer, cart-notification, #cart-drawer");
              if (drawer && typeof drawer.open === "function") {
                drawer.open();
              } else if (drawer && drawer.classList) {
                drawer.classList.add("active", "is-empty");
              } else {
                window.location.href = "/cart";
              }
            })
            .catch(function () {
              // Fallback to native form submission
              form.submit();
            })
            .finally(function () {
              atcBtn.classList.remove("is-loading");
              atcBtn.disabled = false;
              atcBtn.innerHTML = originalContent;
            });
        });
      }
    }

    // Initial render
    updateUi();

    // Initial product form sync
    var productForm = findProductForm(root);
    syncFormWithTier(productForm, tiers[selectedIndex], offer);

    // Watch for variant changes
    setupVariantWatcher(function (newPrice, isAvailable) {
      if (isAvailable === false) {
        root.classList.add("xpp-qb-hidden");
        root.style.display = "none";
        return;
      }

      root.classList.remove("xpp-qb-hidden");
      if (newPrice && newPrice > 0 && newPrice !== currentPrice) {
        currentPrice = newPrice;
        updateUi();
        var f = findProductForm(root);
        syncFormWithTier(f, tiers[selectedIndex], offer);
      } else {
        root.style.display = "block";
      }
    });
  }

  function setupVariantWatcher(onVariantChange) {
    document.addEventListener("variant:change", function (e) {
      if (e.detail && e.detail.variant) {
        var p = e.detail.variant.price != null ? parseInt(e.detail.variant.price, 10) : null;
        var avail = e.detail.variant.available;
        onVariantChange(p, avail);
      }
    });

    document.addEventListener("shopify:product:variant-change", function (e) {
      if (e.detail && e.detail.variant) {
        var p = e.detail.variant.price != null ? parseInt(e.detail.variant.price, 10) : null;
        var avail = e.detail.variant.available;
        onVariantChange(p, avail);
      }
    });

    var form = findProductForm();
    if (form) {
      form.addEventListener("change", function (e) {
        var target = e.target;
        if (target && (target.name === "id" || target.getAttribute("data-variant-id"))) {
          var matchedOption = target.options ? target.options[target.selectedIndex] : null;
          if (matchedOption) {
            var p = matchedOption.getAttribute("data-price") ? parseInt(matchedOption.getAttribute("data-price"), 10) : null;
            var disabled = matchedOption.disabled || (matchedOption.textContent || "").toLowerCase().indexOf("sold out") !== -1;
            onVariantChange(p, !disabled);
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
