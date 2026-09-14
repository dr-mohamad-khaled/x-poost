(function () {
  "use strict";

  if (window.__xpoost_cart_engine_initialized) return;
  window.__xpoost_cart_engine_initialized = true;

  function ensureCartDrawerAutoOpen() {
    try {
      var drawer = document.querySelector("cart-drawer-component");
      if (drawer && !drawer.hasAttribute("auto-open")) {
        drawer.setAttribute("auto-open", "true");
      }
    } catch (e) {}
  }
  ensureCartDrawerAutoOpen();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureCartDrawerAutoOpen);
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


  var UI_STRINGS = {
    ar: {
      stepPrimary: "المنتج الأساسي",
      stepComplementary: "الخطوة التكميلية {n}",
      added: "تمت الإضافة",
      selected: "محدد",
      add: "+ إضافة",
      saveBadge: "وفر {discount}%",
      bundleTotal: "إجمالي المجموعة ({count} منتجات):",
      bundleTotalSingle: "إجمالي المجموعة (منتج واحد):",
      bundleSavings: "أنت توفر {amount} (تم تطبيق خصم المجموعة {discount}%)",
      bundleSavingsApplied: "أنت توفر {amount} (تم تطبيق خصم المجموعة)",
      adding: "جاري الإضافة...",
      continueToCart: "المتابعة إلى السلة \u2190",
      addSingleItemSave: "إضافة منتج واحد ({price}) وتوفير الخصم \u2190",
      addSingleItem: "إضافة منتج واحد ({price}) \u2190",
      addAllItemsSave: "إضافة جميع المنتجات ({count}) ({price}) وتوفير الخصم \u2190",
      addAllItems: "إضافة جميع المنتجات ({count}) ({price}) \u2190",
      additionalUpgrades: "ترقيات إضافية:",
      ratingText: "تقييم 4.9 / 5.0",
      exclusivePrice: "سعر ترويجي حصري لهذا الطلب",
      flashDealItem: "منتج عرض سريع",
      upgradeItem: "منتج ترقية",
      recommendedAddOn: "منتج مقترح إضافي",
      bundleItem: "منتج المجموعة",
      featuredUpgrade: "ترقية مميزة"
    },
    en: {
      stepPrimary: "PRIMARY ESSENTIAL",
      stepComplementary: "COMPLEMENTARY STEP {n}",
      added: "Added",
      selected: "Selected",
      add: "+ Add",
      saveBadge: "SAVE {discount}%",
      bundleTotal: "Bundle Routine Total ({count} items):",
      bundleTotalSingle: "Bundle Routine Total (1 item):",
      bundleSavings: "You save {amount} ({discount}% Bundle Discount Applied)",
      bundleSavingsApplied: "You save {amount} (Bundle Discount Applied)",
      adding: "Adding...",
      continueToCart: "Continue to Cart \u2192",
      addSingleItemSave: "Add 1 Item ({price}) & Save \u2192",
      addSingleItem: "Add 1 Item ({price}) \u2192",
      addAllItemsSave: "Add All {count} Items ({price}) & Save \u2192",
      addAllItems: "Add All {count} Items ({price}) \u2192",
      additionalUpgrades: "Additional Upgrades:",
      ratingText: "4.9 / 5.0 Rating",
      exclusivePrice: "Exclusive single-order promotion price",
      flashDealItem: "Flash Deal Item",
      upgradeItem: "Upgrade Item",
      recommendedAddOn: "Recommended Add-On",
      bundleItem: "Bundle Item",
      featuredUpgrade: "Featured Upgrade"
    },
    fr: {
      stepPrimary: "PRODUIT PRINCIPAL",
      stepComplementary: "ÉTAPE COMPLÉMENTAIRE {n}",
      added: "Ajouté",
      selected: "Sélectionné",
      add: "+ Ajouter",
      saveBadge: "ÉCONOMISEZ {discount}%",
      bundleTotal: "Total du lot ({count} articles) :",
      bundleTotalSingle: "Total du lot (1 article) :",
      bundleSavings: "Vous économisez {amount} (remise de lot de {discount}% appliquée)",
      bundleSavingsApplied: "Vous économisez {amount} (remise de lot appliquée)",
      adding: "Ajout en cours...",
      continueToCart: "Continuer vers le panier \u2192",
      addSingleItemSave: "Ajouter 1 article ({price}) et économiser \u2192",
      addSingleItem: "Ajouter 1 article ({price}) \u2192",
      addAllItemsSave: "Ajouter les {count} articles ({price}) et économiser \u2192",
      addAllItems: "Ajouter les {count} articles ({price}) \u2192",
      additionalUpgrades: "Améliorations supplémentaires :",
      ratingText: "Évaluation 4,9 / 5,0",
      exclusivePrice: "Prix promotionnel exclusif pour cette commande",
      flashDealItem: "Article offre éclair",
      upgradeItem: "Article de mise à niveau",
      recommendedAddOn: "Article complémentaire recommandé",
      bundleItem: "Article du lot",
      featuredUpgrade: "Amélioration vedette"
    },
    de: {
      stepPrimary: "HAUPTPRODUKT",
      stepComplementary: "ERGÄNZENDE STUFE {n}",
      added: "Hinzugefügt",
      selected: "Ausgewählt",
      add: "+ Hinzufügen",
      saveBadge: "SPAREN SIE {discount}%",
      bundleTotal: "Set-Gesamtbetrag ({count} Artikel):",
      bundleTotalSingle: "Set-Gesamtbetrag (1 Artikel):",
      bundleSavings: "Sie sparen {amount} ({discount}% Paket-Rabatt angewendet)",
      bundleSavingsApplied: "Sie sparen {amount} (Paket-Rabatt angewendet)",
      adding: "Wird hinzugefügt...",
      continueToCart: "Weiter zum Warenkorb \u2192",
      addSingleItemSave: "1 Artikel hinzufügen ({price}) & sparen \u2192",
      addSingleItem: "1 Artikel hinzufügen ({price}) \u2192",
      addAllItemsSave: "Alle {count} Artikel hinzufügen ({price}) & sparen \u2192",
      addAllItems: "Alle {count} Artikel hinzufügen ({price}) \u2192",
      additionalUpgrades: "Zusätzliche Upgrades:",
      ratingText: "4.9 / 5.0 Bewertung",
      exclusivePrice: "Exklusiver Aktionspreis für diese Bestellung",
      flashDealItem: "Blitzangebot-Artikel",
      upgradeItem: "Upgrade-Artikel",
      recommendedAddOn: "Empfohlener Zusatzartikel",
      bundleItem: "Paket-Artikel",
      featuredUpgrade: "Ausgewähltes Upgrade"
    },
    es: {
      stepPrimary: "PRODUCTO PRINCIPAL",
      stepComplementary: "PASO COMPLEMENTARIO {n}",
      added: "Añadido",
      selected: "Seleccionado",
      add: "+ Añadir",
      saveBadge: "AHORRA {discount}%",
      bundleTotal: "Total del paquete ({count} artículos):",
      bundleTotalSingle: "Total del paquete (1 artículo):",
      bundleSavings: "Ahorras {amount} ({discount}% de descuento aplicado)",
      bundleSavingsApplied: "Ahorras {amount} (descuento de paquete aplicado)",
      adding: "Añadiendo...",
      continueToCart: "Continuar al carrito \u2192",
      addSingleItemSave: "Añadir 1 artículo ({price}) y ahorrar \u2192",
      addSingleItem: "Añadir 1 artículo ({price}) \u2192",
      addAllItemsSave: "Añadir los {count} artículos ({price}) y ahorrar \u2192",
      addAllItems: "Añadir los {count} artículos ({price}) \u2192",
      additionalUpgrades: "Mejoras adicionales:",
      ratingText: "Calificación 4.9 / 5.0",
      exclusivePrice: "Precio promocional exclusivo para este pedido",
      flashDealItem: "Artículo oferta flash",
      upgradeItem: "Artículo de mejora",
      recommendedAddOn: "Complemento recomendado",
      bundleItem: "Artículo del paquete",
      featuredUpgrade: "Mejora destacada"
    },
    it: {
      stepPrimary: "PRODOTTO PRINCIPALE",
      stepComplementary: "PASSO COMPLEMENTARE {n}",
      added: "Aggiunto",
      selected: "Selezionato",
      add: "+ Aggiungi",
      saveBadge: "RISPARMIA {discount}%",
      bundleTotal: "Totale pacchetto ({count} articoli):",
      bundleTotalSingle: "Totale pacchetto (1 articolo):",
      bundleSavings: "Risparmi {amount} ({discount}% di sconto applicato)",
      bundleSavingsApplied: "Risparmi {amount} (sconto pacchetto applicato)",
      adding: "Aggiunta in corso...",
      continueToCart: "Continua al carrello \u2192",
      addSingleItemSave: "Aggiungi 1 articolo ({price}) e risparmia \u2192",
      addSingleItem: "Aggiungi 1 articolo ({price}) \u2192",
      addAllItemsSave: "Aggiungi tutti i {count} articoli ({price}) e risparmia \u2192",
      addAllItems: "Aggiungi tutti i {count} articoli ({price}) \u2192",
      additionalUpgrades: "Aggiornamenti aggiuntivi:",
      ratingText: "Valutazione 4.9 / 5.0",
      exclusivePrice: "Prezzo promozionale esclusivo per questo ordine",
      flashDealItem: "Articolo offerta lampo",
      upgradeItem: "Articolo di aggiornamento",
      recommendedAddOn: "Aggiunta consigliata",
      bundleItem: "Articolo del pacchetto",
      featuredUpgrade: "Aggiornamento in evidenza"
    },
    pt: {
      stepPrimary: "PRODUTO PRINCIPAL",
      stepComplementary: "ETAPA COMPLEMENTAR {n}",
      added: "Adicionado",
      selected: "Selecionado",
      add: "+ Adicionar",
      saveBadge: "ECONOMIZE {discount}%",
      bundleTotal: "Total do pacote ({count} itens):",
      bundleTotalSingle: "Total do pacote (1 item):",
      bundleSavings: "Você economiza {amount} ({discount}% de desconto aplicado)",
      bundleSavingsApplied: "Você economiza {amount} (desconto de pacote aplicado)",
      adding: "Adicionando...",
      continueToCart: "Continuar para o carrinho \u2192",
      addSingleItemSave: "Adicionar 1 item ({price}) e economizar \u2192",
      addSingleItem: "Adicionar 1 item ({price}) \u2192",
      addAllItemsSave: "Adicionar todos os {count} itens ({price}) e economizar \u2192",
      addAllItems: "Adicionar todos os {count} itens ({price}) \u2192",
      additionalUpgrades: "Upgrades adicionais:",
      ratingText: "Avaliação 4.9 / 5.0",
      exclusivePrice: "Preço promocional exclusivo para este pedido",
      flashDealItem: "Item oferta relâmpago",
      upgradeItem: "Item de upgrade",
      recommendedAddOn: "Complemento recomendado",
      bundleItem: "Item do pacote",
      featuredUpgrade: "Upgrade em destaque"
    }
  };

  function getUiString(key, replacements) {
    var loc = configStore.storefrontLocale || (configStore.isRtl ? "ar" : "en");
    var dict = UI_STRINGS[loc] || UI_STRINGS.en;
    var text = dict[key] || UI_STRINGS.en[key] || "";
    if (replacements) {
      for (var k in replacements) {
        text = text.replace(new RegExp("\\{" + k + "\\}", "g"), String(replacements[k]));
      }
    }
    return text;
  }

  var cartState = {
    totalPrice: 0,
    items: [],
    currency: "USD",
  };

  var configStore = {
    prePurchase: null,
    inCart: null,
    shipping: null,
    storefrontLocale: 'en',
    isRtl: false,
    translations: null,
  };

  var productHandleMap = {};

  function slugify(text) {
    if (!text) return "";
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getProductUrl(rule) {
    if (!rule) return "#";
    if (rule.targetProductHandle) {
      return "/products/" + encodeURIComponent(rule.targetProductHandle);
    }
    var rawId = rule.targetProductId ? String(rule.targetProductId).replace(/[^0-9]/g, "") : "";
    if (rawId && productHandleMap[rawId]) {
      return "/products/" + encodeURIComponent(productHandleMap[rawId]);
    }
    if (rule.targetProductTitle && productHandleMap[rule.targetProductTitle]) {
      return "/products/" + encodeURIComponent(productHandleMap[rule.targetProductTitle]);
    }
    if (rule.targetProductTitle) {
      return "/products/" + slugify(rule.targetProductTitle);
    }
    return "#";
  }

  try {
    fetch("/products.json?limit=250")
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.products) {
          data.products.forEach(function (p) {
            if (p.id && p.handle) productHandleMap[String(p.id)] = p.handle;
            if (p.title && p.handle) productHandleMap[p.title] = p.handle;
          });
        }
      })
      .catch(function () {});
  } catch (e) {}

  window.__xpoost_load_config = window.__xpoost_load_config || function(proxyPath) {
    if (window.__xpoost_config_promise) {
      return window.__xpoost_config_promise;
    }
    try {
      var cached = sessionStorage.getItem("__xpoost_cfg");
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.ts && (Date.now() - parsed.ts < 60000)) {
          window.__xpoost_config_promise = Promise.resolve(parsed.data);
          return window.__xpoost_config_promise;
        }
      }
    } catch (e) {}

    window.__xpoost_config_promise = fetch(proxyPath || "/apps/xpoost/config", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        try {
          sessionStorage.setItem("__xpoost_cfg", JSON.stringify({ data: data, ts: Date.now() }));
        } catch (e) {}
        return data;
      })
      .catch(function (err) {
        window.__xpoost_config_promise = null;
        throw err;
      });

    return window.__xpoost_config_promise;
  };

  function initCartEngine() {
    var mount = document.getElementById("xpoost-cart-engine");
    var proxyPath = mount ? (mount.getAttribute("data-proxy-path") || "/apps/xpoost/config") : "/apps/xpoost/config";

    window.__xpoost_load_config(proxyPath)
      .then(function (data) {
        if (!data || !data.active) return;
        configStore.prePurchase = data.features?.prePurchase;
        configStore.inCart = data.features?.inCart;
        configStore.shipping = data.features?.shipping;
        configStore.scarcity = data.features?.scarcity;
        configStore.translations = data.translations;
        configStore.isRtl = data.isRtl;
        configStore.storefrontLocale = data.storefrontLocale || data.locale || (data.isRtl ? 'ar' : 'en');

        setupAjaxInterceptor();
        setupDrawerObserver();
        fetchCartState();
        setupPrePurchaseInterceptor();
      })
      .catch(function (err) {
        console.warn("[XPoost] Cart engine config fetch failed:", err);
      });
  }

  function fetchCartState() {
    fetch("/cart.js")
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        cartState.totalPrice = (cart.total_price || 0) / 100;
        cartState.items = cart.items || [];
        cartState.currency = cart.currency || (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || "USD";
        renderShippingBar();
        renderInCartUpsell();
      })
      .catch(function (e) {
        console.warn("[XPoost] Cart fetch failed:", e);
      });
  }

  // Intercept standard Ajax cart operations to trigger state updates
  function setupAjaxInterceptor() {
    var origFetch = window.fetch;
    window.fetch = function () {
      var args = arguments;
      var url = args[0] ? (typeof args[0] === "string" ? args[0] : args[0].url) : "";

      return origFetch.apply(this, args).then(function (response) {
        if (url && (url.indexOf("/cart/add") !== -1 || url.indexOf("/cart/change") !== -1 || url.indexOf("/cart/update") !== -1 || url.indexOf("/cart/clear") !== -1)) {
          setTimeout(fetchCartState, 250);
          setTimeout(fetchCartState, 800);
        }
        return response;
      });
    };

    // Listen for theme cart custom events (including next-gen theme's "cart:update")
    var themeCartEvents = ["cart:update", "cart:updated", "ajaxCart.afterCartLoad", "cart:refresh", "theme:cart:change", "cart:change", "cart-drawer:updated"];
    themeCartEvents.forEach(function (evt) {
      document.addEventListener(evt, function (e) {
        // Don't re-fetch if we dispatched this event ourselves
        if (e && e.detail && e.detail.sourceId === "xpoost") return;
        setTimeout(fetchCartState, 200);
      });
    });

    // Safe event listener for cart drawer toggles
    document.addEventListener("click", function (e) {
      if (!e.target || !e.target.closest) return;
      var trigger = e.target.closest('a[href="/cart"], [data-cart-drawer-trigger], [data-testid="cart-drawer-trigger"], [aria-controls="CartDrawer"], .header__icon--cart, #cart-icon-bubble');
      if (trigger) {
        setTimeout(fetchCartState, 200);
      }
    });
  }

  // ─── Detect the cart-drawer section ID dynamically ───
  // Next-gen Shopify themes (Horizon/Studio) use a dynamic section ID like
  // "sections--20270767177957__header_section" whereas Dawn uses "cart-drawer".
  // We discover it at runtime from the <cart-items-component data-section-id="...">
  // already present in the page.
  function getCartSectionId() {
    var cartItems = document.querySelector("cart-items-component[data-section-id]");
    if (cartItems) return cartItems.dataset.sectionId;
    // Fallback for Dawn or other OS 2.0 themes
    return "cart-drawer";
  }

  // Adds items to the cart AND asks Shopify to render the cart-drawer section
  // in the SAME request (the `sections` param on /cart/add.js). After the
  // response, we dispatch the theme's native "cart:update" event so that
  // cart-items-component morphs the DOM and cart-icon updates its bubble.
  function addItemsAndOpenDrawer(items, discountCode) {
    var sectionId = getCartSectionId();
    return fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items,
        sections: sectionId,
        sections_url: window.location.pathname,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        // Apply discount code if provided
        if (discountCode) {
          applyDiscountCode(discountCode);
        }
        // Feed the section HTML into the theme's event system & open the drawer
        refreshDrawerAndOpen(data, sectionId);
      })
      .catch(function (err) {
        console.warn("[XPoost] add to cart failed:", err);
        triggerCartDrawerOpen();
      });
  }

  // Apply a discount code to the cart via Shopify's /cart/update.js and /discount/ endpoints
  function applyDiscountCode(code) {
    if (!code) return;
    // 1. Set discount via cart update API (works for the cart page & checkout)
    fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discount: code }),
    }).catch(function (e) {
      console.warn("[XPoost] discount via /cart/update.js failed:", e);
    });
    // 2. Also hit /discount/<code> to set the checkout discount cookie
    fetch("/discount/" + encodeURIComponent(code), {
      method: "GET",
      credentials: "same-origin",
    }).catch(function (e) {
      console.warn("[XPoost] /discount/ endpoint failed:", e);
    });
  }

  // After items are added, push the section HTML through the theme's native
  // event bus so cart-items-component + cart-icon both self-update, then open
  // the cart drawer.
  function refreshDrawerAndOpen(addResponse, sectionId) {
    var sections = addResponse && addResponse.sections;
    var itemCount = 0;

    // Fetch the latest cart state to get item_count
    fetch("/cart.js")
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        itemCount = cart.item_count || 0;
        cartState.totalPrice = (cart.total_price || 0) / 100;
        cartState.items = cart.items || [];
        cartState.currency = cart.currency || "USD";

        // Build the event detail payload that matches the theme's CartUpdateEvent shape
        var eventData = {
          itemCount: itemCount,
          source: "xpoost",
        };
        if (sections && sections[sectionId]) {
          eventData.sections = {};
          eventData.sections[sectionId] = sections[sectionId];

          // Direct DOM replacement as an instant, infallible layer
          try {
            var parsed = new DOMParser().parseFromString(sections[sectionId], "text/html");

            // 1. Next-gen themes: update cart-items-component
            var newCartItems = parsed.querySelector("cart-items-component[data-drawer]");
            var currentCartItems = document.querySelector("cart-items-component[data-drawer]");
            if (newCartItems && currentCartItems) {
              currentCartItems.innerHTML = newCartItems.innerHTML;
            }

            // Remove empty class from dialog
            var drawerDialog = document.querySelector("cart-drawer-component dialog, dialog.cart-drawer__dialog, dialog.cart-drawer");
            if (drawerDialog) {
              drawerDialog.classList.remove("cart-drawer--empty");
            }

            // 2. Dawn / Vintage themes: update cart-drawer innerHTML
            var newDawnDrawer = parsed.querySelector("cart-drawer") || parsed.querySelector(".cart-drawer");
            var currentDawnDrawer = document.querySelector("cart-drawer");
            if (newDawnDrawer && currentDawnDrawer) {
              currentDawnDrawer.innerHTML = newDawnDrawer.innerHTML;
            }

            // 3. Update cart bubble count in header
            var newBubbleCount = parsed.querySelector("[data-testid='cart-bubble'], .cart-bubble__text-count, [ref='cartBubbleCount']");
            var currentBubbleCount = document.querySelector("[data-testid='cart-bubble'], .cart-bubble__text-count, [ref='cartBubbleCount']");
            if (newBubbleCount && currentBubbleCount) {
              currentBubbleCount.textContent = newBubbleCount.textContent || String(itemCount);
              currentBubbleCount.classList.remove("hidden");
            }
            var currentBubble = document.querySelector("[ref='cartBubble'], .cart-bubble");
            if (currentBubble) {
              currentBubble.classList.remove("visually-hidden");
            }
          } catch (domErr) {
            console.warn("[XPoost] Direct DOM update fallback:", domErr);
          }
        }

        // Dispatch the theme-native "cart:update" event.
        document.dispatchEvent(new CustomEvent("cart:update", {
          bubbles: true,
          detail: {
            resource: null,
            sourceId: "xpoost",
            data: eventData,
          },
        }));

        // If section HTML wasn't returned inline, let cart-items-component re-render
        if (!sections || !sections[sectionId]) {
          var cartItemsEl = document.querySelector("cart-items-component[data-section-id]");
          if (cartItemsEl && cartItemsEl.dataset.sectionId) {
            fetch("/?sections=" + encodeURIComponent(cartItemsEl.dataset.sectionId))
              .then(function (r) { return r.json(); })
              .then(function (secData) {
                var html = secData[cartItemsEl.dataset.sectionId];
                if (html) {
                  document.dispatchEvent(new CustomEvent("cart:update", {
                    bubbles: true,
                    detail: {
                      resource: null,
                      sourceId: "xpoost",
                      data: {
                        itemCount: itemCount,
                        source: "xpoost",
                        sections: secData,
                      },
                    },
                  }));
                }
              })
              .catch(function () {});
          }
        }

        // Open the cart drawer
        triggerCartDrawerOpen();

        // Re-render our own XPoost widgets (shipping bar, in-cart upsell)
        setTimeout(function () {
          renderShippingBar();
          renderInCartUpsell();
        }, 100);
      })
      .catch(function () {
        triggerCartDrawerOpen();
      });
  }

  function triggerCartDrawerOpen() {
    // Strategy 1: Next-gen theme (cart-drawer-component with showDialog)
    var drawerComponent = document.querySelector("cart-drawer-component");
    if (drawerComponent) {
      // cart-drawer-component extends DialogComponent which has showDialog()
      if (typeof drawerComponent.showDialog === "function") {
        drawerComponent.showDialog();
        return;
      }
      if (typeof drawerComponent.open === "function") {
        drawerComponent.open();
        return;
      }
      // If the component has a <dialog ref="dialog"> inside, use showModal
      var dialog = drawerComponent.querySelector("dialog");
      if (dialog && typeof dialog.showModal === "function" && !dialog.open) {
        dialog.showModal();
        return;
      }
    }

    // Strategy 2: Dawn / OS 2.0 <cart-drawer> element
    var cartDrawer = document.querySelector("cart-drawer");
    if (cartDrawer) {
      if (typeof cartDrawer.open === "function") {
        cartDrawer.open();
        return;
      }
      cartDrawer.classList.add("active", "is-open");
      cartDrawer.setAttribute("open", "");
      return;
    }

    // Strategy 3: Click the cart trigger button
    var trigger = document.querySelector(
      '[data-testid="cart-drawer-trigger"], ' +
      '#cart-icon-bubble, ' +
      '.header__icon--cart, ' +
      '[aria-controls="CartDrawer"], ' +
      'button[on\\:click$="/open"][aria-haspopup="dialog"]'
    );
    if (trigger) {
      trigger.click();
      return;
    }

    // Strategy 4: Dispatch legacy custom events
    document.dispatchEvent(new CustomEvent("cart:open", { bubbles: true }));
    document.dispatchEvent(new CustomEvent("theme:cart:open", { bubbles: true }));
  }

  function setupDrawerObserver() {
    if (window.__xpc_drawer_observer) return;
    window.__xpc_drawer_observer = true;

    // Find the drawer component -- support both next-gen and Dawn themes
    var drawerTarget =
      document.querySelector("cart-drawer-component") ||
      document.querySelector("cart-drawer") ||
      document.body;

    var debounceTimer = null;
    var observer = new MutationObserver(function (mutations) {
      var shouldCheck = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.target && m.target.closest && m.target.closest(".xpoost-root, #xpoost-scarcity-toast, #xpc-pre-modal")) continue;
        shouldCheck = true;
        break;
      }
      if (!shouldCheck) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var drawer = document.querySelector("cart-drawer-component, cart-drawer, .cart-drawer, .drawer");
        if (drawer) {
          var hasInCart = document.getElementById("xpc-in-cart-drawer");
          var hasShipping = document.getElementById("xpc-shipping-bar-drawer");
          if (!hasInCart || !hasInCart.isConnected || !hasShipping || !hasShipping.isConnected) {
            renderShippingBar();
            renderInCartUpsell();
          }
        }
      }, 150);
    });

    observer.observe(drawerTarget, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "class", "aria-hidden"] });
  }

  /* ─────────────────────────────────────────────────────────────
     Feature 2: Multi-Product Pre-Purchase Upsell Modal
     ───────────────────────────────────────────────────────────── */
  var pendingSubmission = null;
  var isPrePurchaseOpen = false;

  function getMatchingPrePurchaseRules(form) {
    if (!configStore.prePurchase || !configStore.prePurchase.active) return null;
    var rules = configStore.prePurchase.rules || [];
    if (rules.length === 0) return null;
    if (form.getAttribute("data-xpoost-bypass") === "true") return null;

    var idInput = form.querySelector('[name="id"]');
    var variantId = idInput ? String(idInput.value).trim() : "";
    if (!variantId) return null;

    var cleanVariantId = variantId.replace(/[^0-9]/g, "");

    // Detect product ID from various standard theme locations
    var prodIdInput = form.querySelector('[name="product-id"], [name="productId"]');
    var productId = prodIdInput ? String(prodIdInput.value).trim() : "";
    if (!productId) {
      productId = form.getAttribute("data-product-id") || "";
    }
    if (!productId) {
      var prodContainer = form.closest("[data-product-id], product-info, [data-section-type='product']");
      if (prodContainer) {
        productId = prodContainer.getAttribute("data-product-id") || "";
      }
    }
    if (!productId) {
      var pageProd = document.querySelector("[data-product-id]");
      if (pageProd) {
        productId = pageProd.getAttribute("data-product-id") || "";
      }
    }
    if (!productId && window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      productId = String(window.ShopifyAnalytics.meta.product.id || "");
    }
    if (!productId && window.meta && window.meta.product) {
      productId = String(window.meta.product.id || "");
    }
    var cleanProductId = productId ? String(productId).replace(/[^0-9]/g, "") : "";

    var specificOfferMap = {};
    var storewideOfferMap = {};

    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];

      // Never upsell the exact same product/variant that is currently being triggered
      var targetVariantClean = r.targetVariantId ? String(r.targetVariantId).replace(/[^0-9]/g, "") : "";
      var targetProductClean = r.targetProductId ? String(r.targetProductId).replace(/[^0-9]/g, "") : "";
      if (targetVariantClean && targetVariantClean === cleanVariantId) continue;
      if (targetProductClean && cleanProductId && targetProductClean === cleanProductId) continue;

      var isStorewide = (r.triggerProductId === "ALL");
      var isMatch = false;

      if (isStorewide) {
        isMatch = true;
      } else if (r.triggerProductId) {
        var tokens = r.triggerProductId.split(",");
        for (var j = 0; j < tokens.length; j++) {
          var tClean = tokens[j].replace(/[^0-9]/g, "").trim();
          if (tClean && ((cleanProductId && tClean === cleanProductId) || (cleanVariantId && tClean === cleanVariantId))) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        var offerKey = (r.offerHeadline || "Special Upgrade Offer").trim();
        var mapToUse = isStorewide ? storewideOfferMap : specificOfferMap;
        if (!mapToUse[offerKey]) {
          mapToUse[offerKey] = [];
        }
        mapToUse[offerKey].push(r);
      }
    }

    var specificKeys = Object.keys(specificOfferMap);
    if (specificKeys.length > 0) {
      return specificOfferMap[specificKeys[0]];
    }
    var storewideKeys = Object.keys(storewideOfferMap);
    if (storewideKeys.length > 0) {
      return storewideOfferMap[storewideKeys[0]];
    }
    return null;
  }

  function hookProductFormComponent() {
    function applyHook() {
      var pfc = window.customElements && window.customElements.get("product-form-component");
      if (!pfc || !pfc.prototype || pfc.prototype.__xpoost_hooked) return;
      pfc.prototype.__xpoost_hooked = true;

      var origHandleSubmit = pfc.prototype.handleSubmit;
      pfc.prototype.handleSubmit = function (event) {
        var form = this.querySelector("form");
        if (!form || form.getAttribute("data-xpoost-bypass") === "true") {
          return origHandleSubmit.call(this, event);
        }

        var matchingRules = getMatchingPrePurchaseRules(form);
        if (!matchingRules || matchingRules.length === 0) {
          // NO PRE-PURCHASE OFFER: allow theme to submit natively without interference!
          return origHandleSubmit.call(this, event);
        }

        // PRE-PURCHASE OFFER MATCHED:
        // Do NOT block the original product! Submit it natively so it lands in the cart
        // and opens the drawer first. Then pop up the pre-purchase modal on top!
        pendingSubmission = {
          form: form,
          rules: matchingRules
        };

        var self = this;
        var modalFired = false;
        function showAfterAdd() {
          if (modalFired) return;
          modalFired = true;
          setTimeout(function () {
            showPrePurchaseModal(matchingRules);
          }, 350);
        }

        self.addEventListener("cart:update", showAfterAdd, { once: true });
        document.addEventListener("cart:update", showAfterAdd, { once: true });
        setTimeout(showAfterAdd, 1400);

        return origHandleSubmit.call(this, event);
      };
    }

    applyHook();
    if (window.customElements && typeof window.customElements.whenDefined === "function") {
      window.customElements.whenDefined("product-form-component").then(applyHook);
    }
  }

  function setupPrePurchaseInterceptor() {
    if (!configStore.prePurchase || !configStore.prePurchase.active) return;
    var rules = configStore.prePurchase.rules || [];
    if (rules.length === 0) return;

    hookProductFormComponent();

    // General fallback interceptor for themes without product-form-component (e.g. Dawn)
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || !form.action || form.action.indexOf("/cart/add") === -1) return;
      if (form.getAttribute("data-xpoost-bypass") === "true") return;
      if (form.closest && form.closest("product-form-component")) return; // Handled by hook!

      var matchingRules = getMatchingPrePurchaseRules(form);
      if (!matchingRules || matchingRules.length === 0) return;

      pendingSubmission = {
        form: form,
        rules: matchingRules
      };

      var modalFired = false;
      function showAfterAdd() {
        if (modalFired) return;
        modalFired = true;
        setTimeout(function () {
          showPrePurchaseModal(matchingRules);
        }, 350);
      }

      document.addEventListener("cart:update", showAfterAdd, { once: true });
      setTimeout(showAfterAdd, 1400);
    }, true);
  }

  var VECTOR_ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18"/><path d="M12 8c-2-3-5-3-5 0 0 2 5 2 5 0z"/><path d="M12 8c2-3 5-3 5 0 0 2-5 2-5 0z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  };

  function showPrePurchaseModal(rules) {
    if (isPrePurchaseOpen) return;
    isPrePurchaseOpen = true;

    var container = document.getElementById("xpoost-root");
    if (!container) {
      container = document.createElement("div");
      container.id = "xpoost-root";
      container.className = "xpoost-root";
      document.body.appendChild(container);
    }

    var existing = container.querySelector(".xpc-modal-backdrop");
    if (existing) existing.remove();

    var tPre = (configStore.translations && configStore.translations.prePurchase) || {};
    var headline = rules[0].offerHeadline || tPre.headline || "Special Upgrade Offer";
    var description = rules[0].offerDescription || tPre.description || "Add these complementary items to your order!";
    var offerTag = rules[0].offerTag || tPre.offerTag || "SPECIAL UPGRADE OFFER";
    var acceptBtnText = rules[0].acceptButton || tPre.acceptButton || "Add Selected & Continue \u2192";
    var declineBtnText = rules[0].declineButton || tPre.declineButton || "No thanks, continue to cart";
    var urgencyLabelText = rules[0].urgencyLabel || tPre.urgencyLabel || "Special Offer Reserved For:";
    var scarcityNoticeText = rules[0].scarcityNotice || tPre.scarcityNotice || "Limited Allocation: Reserved exclusively for your cart session";
    var layoutStyle = rules[0].layoutStyle || "spotlight_hero";


    var symbol = (cartState.currency === "EGP" || cartState.currency === "LE" ? "LE " : "$");

    var modalInnerHtml = "";
    var countdownInterval = null;

    // LAYOUT 1: Spotlight Hero & Value Proposition
    if (layoutStyle === "spotlight_hero") {
      var heroRule = rules[0];
      var heroOrigPrice = parseFloat(heroRule.targetProductPrice || "29.99");
      var heroDisc = heroRule.discountPercent ? parseFloat(heroRule.discountPercent) : 0;
      var heroSalePrice = (heroDisc > 0 ? heroOrigPrice * (1 - heroDisc / 100) : heroOrigPrice).toFixed(2);
      var heroVariant = heroRule.targetVariantId ? heroRule.targetVariantId.replace(/[^0-9]/g, "") : "";
      var heroPreselected = heroRule.preselected !== false;
      var heroProdUrl = getProductUrl(heroRule);
      var heroFeatures = (heroRule.features && heroRule.features.length >= 3)
        ? heroRule.features
        : [
            getUiString("recommendedAddOn"),
            (configStore.isRtl ? "تركيبة متطورة وفعالة ومضمونة" : "Premium dermatologically evaluated formula"),
            getUiString("exclusivePrice")
          ];

      var extraProductsHtml = "";
      if (rules.length > 1) {
        extraProductsHtml = '<div class="xpc-spotlight-sub-title">' + escapeHtml(getUiString('additionalUpgrades')) + '</div><div class="xpc-modal-products-list">' +
          rules.slice(1).map(function (rule, idx) {
            var oPrice = parseFloat(rule.targetProductPrice || "29.99");
            var d = rule.discountPercent ? parseFloat(rule.discountPercent) : 0;
            var sPrice = (d > 0 ? oPrice * (1 - d / 100) : oPrice).toFixed(2);
            var vId = rule.targetVariantId ? rule.targetVariantId.replace(/[^0-9]/g, "") : "";
            var pSel = rule.preselected !== false;
            var pUrl = getProductUrl(rule);
            return (
              '<div class="xpc-modal-product' + (pSel ? ' is-selected' : '') + '" style="--item-index: ' + (idx + 1) + ';" data-index="' + (idx + 1) + '">' +
              '<input type="checkbox" class="xpc-product-check" data-index="' + (idx + 1) + '" data-variant-id="' + vId + '" data-price="' + sPrice + '" data-has-discount="' + (d > 0 ? '1' : '0') + '"' + (pSel ? ' checked' : '') + ' />' +
              '<a href="' + pUrl + '" target="_blank" class="xpc-product-link">' +
              (rule.targetProductImage ? '<img class="xpc-modal-thumb" src="' + escapeHtml(rule.targetProductImage) + '" alt="" />' : '<div class="xpc-modal-thumb"></div>') +
              '</a>' +
              '<div class="xpc-modal-pinfo">' +
              '<div class="xpc-modal-pname"><a href="' + pUrl + '" target="_blank" class="xpc-product-link">' + escapeHtml(rule.targetProductTitle || "Complementary Item") + '</a></div>' +
              '<div class="xpc-modal-pricing"><span class="xpc-modal-sale">' + symbol + sPrice + '</span>' + (d > 0 ? '<span class="xpc-modal-orig">' + symbol + oPrice.toFixed(2) + '</span><span class="xpc-modal-save-pill">' + escapeHtml(getUiString('saveBadge', { discount: d })) + '</span>' : "") + '</div>' +
              '</div>' +
              '</div>'
            );
          }).join("") + '</div>';
      }

      modalInnerHtml =
        '<div class="xpc-spotlight-hero-card' + (heroPreselected ? ' is-selected' : '') + '" data-index="0">' +
        '<input type="checkbox" class="xpc-product-check xpc-hero-check" data-index="0" data-variant-id="' + heroVariant + '" data-orig-price="' + heroOrigPrice.toFixed(2) + '" data-price="' + heroSalePrice + '" data-has-discount="' + (heroDisc > 0 ? '1' : '0') + '"' + (heroPreselected ? ' checked' : '') + ' style="display:none;" />' +
        '<div class="xpc-spotlight-check-pill ' + (heroPreselected ? 'is-checked' : '') + '">' +
        (heroPreselected ? VECTOR_ICONS.check + '<span>' + escapeHtml(getUiString('selected')) + '</span>' : '<span>' + escapeHtml(getUiString('add')) + '</span>') +
        '</div>' +
        '<div class="xpc-spotlight-img-wrap">' +
        '<a href="' + heroProdUrl + '" target="_blank" class="xpc-product-link">' +
        (heroRule.targetProductImage ? '<img src="' + escapeHtml(heroRule.targetProductImage) + '" alt="" class="xpc-spotlight-hero-img" />' : '<div class="xpc-spotlight-hero-img"></div>') +
        '</a>' +
        (heroDisc > 0 ? '<span class="xpc-spotlight-save-badge">' + escapeHtml(getUiString('saveBadge', { discount: heroDisc })) + '</span>' : '') +
        '</div>' +
        '<div class="xpc-spotlight-content">' +
        '<div class="xpc-spotlight-stars">' +
        VECTOR_ICONS.star + VECTOR_ICONS.star + VECTOR_ICONS.star + VECTOR_ICONS.star + VECTOR_ICONS.star +
        '<span class="xpc-spotlight-rating-text">' + escapeHtml(getUiString('ratingText')) + '</span>' +
        '</div>' +
        '<h4 class="xpc-spotlight-title">' +
        '<a href="' + heroProdUrl + '" target="_blank" class="xpc-product-link">' + escapeHtml(heroRule.targetProductTitle || "Featured Upgrade") + '</a>' +
        '</h4>' +
        '<div class="xpc-spotlight-pricing">' +
        '<span class="xpc-modal-sale">' + symbol + heroSalePrice + '</span>' +
        (heroDisc > 0 ? '<span class="xpc-modal-orig">' + symbol + heroOrigPrice.toFixed(2) + '</span>' : '') +
        '</div>' +
        '<ul class="xpc-spotlight-checklist">' +
        heroFeatures.map(function (feat) {
          return '<li><span class="xpc-check-bullet">' + VECTOR_ICONS.check + '</span> ' + escapeHtml(feat) + '</li>';
        }).join("") +
        '</ul>' +
        '</div>' +
        '</div>' +
        extraProductsHtml;
    }
    // LAYOUT 2: Bundle & Save Routine Set
    else if (layoutStyle === "bundle_grid") {
      var totalBundleOrig = 0;
      var totalBundleSale = 0;
      var hasAnyDiscount = false;

      var gridItemsHtml = rules.map(function (rule, idx) {
        var origPrice = parseFloat(rule.targetProductPrice || "29.99");
        var discount = rule.discountPercent ? parseFloat(rule.discountPercent) : 0;
        var hasDiscount = discount > 0;
        var salePrice = (hasDiscount ? origPrice * (1 - discount / 100) : origPrice).toFixed(2);
        var targetVariant = rule.targetVariantId ? rule.targetVariantId.replace(/[^0-9]/g, "") : "";
        var isPreselected = rule.preselected !== false;
        var stepLabel = idx === 0 ? getUiString("stepPrimary") : getUiString("stepComplementary", { n: idx + 1 });
        var pUrl = getProductUrl(rule);

        if (isPreselected) {
          totalBundleOrig += origPrice;
          totalBundleSale += parseFloat(salePrice);
          if (hasDiscount) hasAnyDiscount = true;
        }

        var connectorHtml = "";
        if (idx > 0) {
          connectorHtml =
            '<div class="xpc-bundle-connector-row">' +
            '<div class="xpc-bundle-line"></div>' +
            '<div class="xpc-bundle-plus-badge">+</div>' +
            '<div class="xpc-bundle-line"></div>' +
            '</div>';
        }

        return (
          connectorHtml +
          '<div class="xpc-bundle-item-card' + (isPreselected ? ' is-selected' : '') + '" style="--item-index: ' + idx + ';" data-index="' + idx + '">' +
          '<div class="xpc-bundle-card-thumb-wrap">' +
          '<a href="' + pUrl + '" target="_blank" class="xpc-product-link">' +
          (rule.targetProductImage ? '<img class="xpc-bundle-card-img" src="' + escapeHtml(rule.targetProductImage) + '" alt="" />' : '<div class="xpc-bundle-img-placeholder">' + VECTOR_ICONS.gift + '</div>') +
          '</a>' +
          (hasDiscount ? '<span class="xpc-bundle-thumb-save">-' + discount + '%</span>' : '') +
          '</div>' +
          '<div class="xpc-bundle-card-info">' +
          '<span class="xpc-bundle-step-tag">' + stepLabel + '</span>' +
          '<div class="xpc-bundle-card-title"><a href="' + pUrl + '" target="_blank" class="xpc-product-link">' + escapeHtml(rule.targetProductTitle || "Bundle Item") + '</a></div>' +
          '<div class="xpc-modal-pricing">' +
          '<span class="xpc-modal-sale">' + symbol + salePrice + '</span>' +
          (hasDiscount ? '<span class="xpc-modal-orig">' + symbol + origPrice.toFixed(2) + '</span>' : '') +
          (hasDiscount ? '<span class="xpc-modal-save-pill">' + escapeHtml(getUiString('saveBadge', { discount: discount })) + '</span>' : '') +
          '</div>' +
          '</div>' +
          '<div class="xpc-bundle-action-cell">' +
          '<input type="checkbox" class="xpc-product-check" style="display:none;" data-index="' + idx + '" data-variant-id="' + targetVariant + '" data-orig-price="' + origPrice.toFixed(2) + '" data-price="' + salePrice + '" data-has-discount="' + (hasDiscount ? '1' : '0') + '"' + (isPreselected ? ' checked' : '') + ' />' +
          '<div class="xpc-bundle-toggle-pill ' + (isPreselected ? 'is-checked' : '') + '">' +
          (isPreselected ? VECTOR_ICONS.check + '<span>' + escapeHtml(getUiString('added')) + '</span>' : '<span>' + escapeHtml(getUiString('add')) + '</span>') +
          '</div>' +
          '</div>' +
          '</div>'
        );
      }).join("");

      var bundleDiscountPercent = rules[0].discountPercent ? parseFloat(rules[0].discountPercent) : 0;
      var savings = totalBundleOrig - totalBundleSale;

      modalInnerHtml =
        '<div class="xpc-bundle-deck-wrap">' +
        '<div class="xpc-bundle-routine-deck">' + gridItemsHtml + '</div>' +
        '<div class="xpc-bundle-summary-card" id="xpc-bundle-summary">' +
        '<div class="xpc-bundle-summary-row">' +
        '<span class="xpc-bundle-summary-label">' + ((rules.filter(function(r){return r.preselected !== false;}).length === 1) ? getUiString('bundleTotalSingle') : getUiString('bundleTotal', { count: '<span id="xpc-bundle-count">' + (rules.filter(function(r){return r.preselected !== false;}).length) + '</span>' })) + '</span>' +
        '<div class="xpc-bundle-summary-prices">' +
        '<span class="xpc-bundle-sum-orig" id="xpc-bundle-orig" style="' + (hasAnyDiscount ? '' : 'display:none;') + '">' + symbol + totalBundleOrig.toFixed(2) + '</span>' +
        '<span class="xpc-bundle-sum-sale" id="xpc-bundle-sale">' + symbol + totalBundleSale.toFixed(2) + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="xpc-bundle-savings-highlight" id="xpc-bundle-savings" style="' + (savings > 0 ? '' : 'display:none;') + '">' +
        VECTOR_ICONS.check +
        '<span>' + escapeHtml(getUiString('bundleSavings', { amount: symbol + savings.toFixed(2), discount: bundleDiscountPercent })) + '</span>' +
        '</div>' +
        '</div>' +
        '</div>';
    }
    // LAYOUT 3: Sleek Slide-Up Bottom Sheet
    else if (layoutStyle === "bottom_sheet") {
      var sheetItemsHtml = rules.map(function (rule, idx) {
        var origPrice = parseFloat(rule.targetProductPrice || "29.99");
        var discount = rule.discountPercent ? parseFloat(rule.discountPercent) : 0;
        var hasDiscount = discount > 0;
        var salePrice = (hasDiscount ? origPrice * (1 - discount / 100) : origPrice).toFixed(2);
        var targetVariant = rule.targetVariantId ? rule.targetVariantId.replace(/[^0-9]/g, "") : "";
        var isPreselected = rule.preselected !== false;
        var pUrl = getProductUrl(rule);

        return (
          '<div class="xpc-sheet-item' + (isPreselected ? ' is-selected' : '') + '" data-index="' + idx + '">' +
          '<input type="checkbox" class="xpc-product-check" data-index="' + idx + '" data-variant-id="' + targetVariant + '" data-price="' + salePrice + '" data-has-discount="' + (hasDiscount ? '1' : '0') + '"' + (isPreselected ? ' checked' : '') + ' />' +
          '<a href="' + pUrl + '" target="_blank" class="xpc-product-link">' +
          (rule.targetProductImage ? '<img class="xpc-sheet-thumb" src="' + escapeHtml(rule.targetProductImage) + '" alt="" />' : '<div class="xpc-sheet-thumb"></div>') +
          '</a>' +
          '<div class="xpc-sheet-meta">' +
          '<div class="xpc-sheet-name"><a href="' + pUrl + '" target="_blank" class="xpc-product-link">' + escapeHtml(rule.targetProductTitle || getUiString("upgradeItem")) + '</a></div>' +
          '<div class="xpc-sheet-pricing"><span class="xpc-modal-sale">' + symbol + salePrice + '</span>' + (hasDiscount ? '<span class="xpc-modal-orig">' + symbol + origPrice.toFixed(2) + '</span>' : '') + '</div>' +
          '</div>' +
          '</div>'
        );
      }).join("");

      modalInnerHtml =
        '<div class="xpc-sheet-handle"></div>' +
        '<div class="xpc-sheet-list">' + sheetItemsHtml + '</div>';
    }
    // LAYOUT 4: Urgent Flash Deal with Live Countdown Timer
    else if (layoutStyle === "flash_urgency") {
      var flashItemsHtml = rules.map(function (rule, idx) {
        var origPrice = parseFloat(rule.targetProductPrice || "29.99");
        var discount = rule.discountPercent ? parseFloat(rule.discountPercent) : 0;
        var hasDiscount = discount > 0;
        var salePrice = (hasDiscount ? origPrice * (1 - discount / 100) : origPrice).toFixed(2);
        var targetVariant = rule.targetVariantId ? rule.targetVariantId.replace(/[^0-9]/g, "") : "";
        var isPreselected = rule.preselected !== false;
        var pUrl = getProductUrl(rule);

        return (
          '<div class="xpc-modal-product' + (isPreselected ? ' is-selected' : '') + '" style="--item-index: ' + idx + ';" data-index="' + idx + '">' +
          '<input type="checkbox" class="xpc-product-check" data-index="' + idx + '" data-variant-id="' + targetVariant + '" data-price="' + salePrice + '" data-has-discount="' + (hasDiscount ? '1' : '0') + '"' + (isPreselected ? ' checked' : '') + ' />' +
          '<a href="' + pUrl + '" target="_blank" class="xpc-product-link">' +
          (rule.targetProductImage ? '<img class="xpc-modal-thumb" src="' + escapeHtml(rule.targetProductImage) + '" alt="" />' : '<div class="xpc-modal-thumb"></div>') +
          '</a>' +
          '<div class="xpc-modal-pinfo">' +
          '<div class="xpc-modal-pname"><a href="' + pUrl + '" target="_blank" class="xpc-product-link">' + escapeHtml(rule.targetProductTitle || getUiString("flashDealItem")) + '</a></div>' +
          '<div class="xpc-modal-pricing">' +
          '<span class="xpc-modal-sale">' + symbol + salePrice + '</span>' +
          (hasDiscount ? '<span class="xpc-modal-orig">' + symbol + origPrice.toFixed(2) + '</span><span class="xpc-modal-save-pill">' + escapeHtml(getUiString('saveBadge', { discount: discount })) + '</span>' : "") +
          '</div>' +
          '</div>' +
          '</div>'
        );
      }).join("");

      modalInnerHtml =
        '<div class="xpc-urgency-banner">' +
        '<span class="xpc-urgency-icon">' + VECTOR_ICONS.clock + '</span>' +
        '<span class="xpc-urgency-label">' + escapeHtml(urgencyLabelText) + '</span>' +
        '<strong class="xpc-urgency-timer" id="xpc-urgency-timer">04:59</strong>' +
        '</div>' +
        '<div class="xpc-urgency-scarcity">' + escapeHtml(scarcityNoticeText) + '</div>' +
        '<div class="xpc-modal-products-list">' + flashItemsHtml + '</div>';
    }

    var html =
      '<div class="xpc-modal-backdrop xpc-modal-layout--' + layoutStyle + '" id="xpc-pre-modal"' + (configStore.isRtl ? ' dir="rtl"' : '') + '>' +
      '<div class="xpc-modal">' +
      '<button type="button" class="xpc-modal-close" id="xpc-modal-close" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '<span class="xpc-modal-tag">' + escapeHtml(offerTag) + '</span>' +
      '<h3 class="xpc-modal-title">' + escapeHtml(headline) + '</h3>' +
      '<p class="xpc-modal-desc">' + escapeHtml(description) + '</p>' +
      modalInnerHtml +
      '<div class="xpc-modal-actions">' +
      '<button type="button" class="xpc-btn-primary" id="xpc-btn-accept">' + escapeHtml(acceptBtnText) + '</button>' +
      '<button type="button" class="xpc-btn-skip" id="xpc-btn-decline">' + escapeHtml(declineBtnText) + '</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    var modalEl = wrap.firstElementChild;
    container.appendChild(modalEl);

    // Live countdown timer for flash urgency layout
    if (layoutStyle === "flash_urgency") {
      var timerEl = modalEl.querySelector("#xpc-urgency-timer");
      var secondsRemaining = 299;
      countdownInterval = setInterval(function () {
        secondsRemaining--;
        if (secondsRemaining <= 0) {
          clearInterval(countdownInterval);
          if (timerEl) timerEl.textContent = "00:00";
        } else {
          var m = Math.floor(secondsRemaining / 60);
          var s = secondsRemaining % 60;
          if (timerEl) timerEl.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
        }
      }, 1000);
    }

    // Smooth GPU-accelerated entrance via requestAnimationFrame
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modalEl.classList.add("is-open");
      });
    });

    var acceptBtn = modalEl.querySelector("#xpc-btn-accept");
    var checkboxes = modalEl.querySelectorAll(".xpc-product-check");

    function updateButtonState() {
      var selectedCount = 0;
      var total = 0;
      var totalOrig = 0;
      var hasDiscountInSelection = false;
      checkboxes.forEach(function (cb) {
        if (cb.checked) {
          selectedCount++;
          var price = parseFloat(cb.getAttribute("data-price") || "0");
          var origPrice = parseFloat(cb.getAttribute("data-orig-price") || cb.getAttribute("data-price") || "0");
          total += price;
          totalOrig += origPrice;
          if (cb.getAttribute("data-has-discount") === "1") {
            hasDiscountInSelection = true;
          }
        }
      });

      // Update Bundle Routine summary box if present
      var bundleCountEl = modalEl.querySelector("#xpc-bundle-count");
      var bundleOrigEl = modalEl.querySelector("#xpc-bundle-orig");
      var bundleSaleEl = modalEl.querySelector("#xpc-bundle-sale");
      var bundleSavingsEl = modalEl.querySelector("#xpc-bundle-savings");
      if (bundleCountEl && bundleSaleEl) {
        bundleCountEl.textContent = String(selectedCount);
        bundleSaleEl.textContent = symbol + total.toFixed(2);
        if (bundleOrigEl) {
          bundleOrigEl.textContent = symbol + totalOrig.toFixed(2);
          bundleOrigEl.style.display = (totalOrig > total && selectedCount > 0) ? "" : "none";
        }
        if (bundleSavingsEl) {
          var saved = totalOrig - total;
          if (saved > 0.009 && selectedCount > 0) {
            bundleSavingsEl.style.display = "flex";
            var saveTextSpan = bundleSavingsEl.querySelector("span");
            if (saveTextSpan) {
              saveTextSpan.textContent = getUiString("bundleSavingsApplied", { amount: symbol + saved.toFixed(2) });
            }
          } else {
            bundleSavingsEl.style.display = "none";
          }
        }
      }

      // Sync toggle pills inside bundle cards
      checkboxes.forEach(function (cb) {
        var card = cb.closest(".xpc-bundle-item-card");
        if (card) {
          var pill = card.querySelector(".xpc-bundle-toggle-pill");
          if (pill) {
            if (cb.checked) {
              pill.classList.add("is-checked");
              pill.innerHTML = VECTOR_ICONS.check + '<span>' + escapeHtml(getUiString("added")) + '</span>';
            } else {
              pill.classList.remove("is-checked");
              pill.innerHTML = '<span>' + escapeHtml(getUiString("add")) + '</span>';
            }
          }
        }
      });

      // Sync Spotlight Hero card toggle pill
      var heroCard = modalEl.querySelector(".xpc-spotlight-hero-card");
      if (heroCard) {
        var heroCb = heroCard.querySelector(".xpc-hero-check");
        var heroPill = heroCard.querySelector(".xpc-spotlight-check-pill");
        if (heroCb && heroPill) {
          if (heroCb.checked) {
            heroPill.classList.add("is-checked");
            heroPill.innerHTML = VECTOR_ICONS.check + '<span>' + escapeHtml(getUiString("selected")) + '</span>';
          } else {
            heroPill.classList.remove("is-checked");
            heroPill.innerHTML = '<span>' + escapeHtml(getUiString("add")) + '</span>';
          }
        }
      }

      if (selectedCount === 0) {
        acceptBtn.textContent = getUiString("continueToCart");
      } else if (rules[0].acceptButton && selectedCount === rules.length) {
        acceptBtn.textContent = rules[0].acceptButton;
      } else if (selectedCount === 1) {
        acceptBtn.textContent = hasDiscountInSelection
          ? getUiString("addSingleItemSave", { price: symbol + total.toFixed(2) })
          : getUiString("addSingleItem", { price: symbol + total.toFixed(2) });
      } else {
        acceptBtn.textContent = hasDiscountInSelection
          ? getUiString("addAllItemsSave", { count: selectedCount, price: symbol + total.toFixed(2) })
          : getUiString("addAllItems", { count: selectedCount, price: symbol + total.toFixed(2) });
      }
    }

    // Interactive card toggling
    modalEl.querySelectorAll(".xpc-modal-product, .xpc-bundle-card, .xpc-bundle-item-card, .xpc-sheet-item, .xpc-spotlight-hero-card").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target && (e.target.tagName === "INPUT" || e.target.closest("a"))) return;
        var cb = row.querySelector(".xpc-product-check");
        if (cb) {
          cb.checked = !cb.checked;
          row.classList.toggle("is-selected", cb.checked);
          updateButtonState();
        }
      });
    });

    checkboxes.forEach(function (cb) {
      cb.addEventListener("change", function () {
        var parentRow = cb.closest(".xpc-modal-product, .xpc-bundle-card, .xpc-bundle-item-card, .xpc-sheet-item, .xpc-spotlight-hero-card");
        if (parentRow) parentRow.classList.toggle("is-selected", cb.checked);
        updateButtonState();
      });
    });

    updateButtonState();

    function closeModal() {
      if (countdownInterval) clearInterval(countdownInterval);
      modalEl.classList.remove("is-open");
      modalEl.classList.add("is-closing");
      setTimeout(function () {
        modalEl.remove();
        isPrePurchaseOpen = false;
      }, 260);
    }

    // Apply dynamic custom colors from Pre-Purchase styling configuration
    var preConfig = configStore.prePurchase;
    var innerModal = modalEl.querySelector(".xpc-modal");
    if (innerModal && preConfig) {
      if (preConfig.backgroundColor) innerModal.style.setProperty("--xpc-bg", preConfig.backgroundColor);
      if (preConfig.accentColor) innerModal.style.setProperty("--xpc-gold", preConfig.accentColor);
      if (preConfig.textColor) innerModal.style.setProperty("--xpc-text", preConfig.textColor);
    }

    modalEl.querySelector("#xpc-modal-close").addEventListener("click", function () {
      closeModal();
      pendingSubmission = null;
    });

    modalEl.querySelector("#xpc-btn-decline").addEventListener("click", function () {
      closeModal();
      pendingSubmission = null;
    });

    acceptBtn.addEventListener("click", function () {
      acceptBtn.disabled = true;
      acceptBtn.classList.add("is-loading");
      acceptBtn.innerHTML = '<span class="xpc-spinner"></span> ' + escapeHtml(getUiString('adding'));

      var rawItems = [];
      var discountCodes = [];
      checkboxes.forEach(function (cb) {
        if (cb.checked) {
          var vId = cb.getAttribute("data-variant-id");
          if (!vId) return;
          var ruleIdx = parseInt(cb.getAttribute("data-index") || "0", 10);
          var rule = rules[ruleIdx];
          var disc = (rule && rule.discountPercent) ? String(rule.discountPercent) : "";
          rawItems.push({
            id: vId,
            quantity: 1,
            properties: disc ? { "_xpoost_discount": disc, "_xpoost_upsell": "true" } : {}
          });
          if (rule && rule.discountCode) {
            discountCodes.push(rule.discountCode);
          }
        }
      });

      // Strict variant deduplication to guarantee no double additions
      var deduplicated = [];
      var seenVariants = {};
      rawItems.forEach(function (item) {
        var cleanId = String(item.id).replace(/[^0-9]/g, "");
        if (!cleanId) return;
        if (!seenVariants[cleanId]) {
          seenVariants[cleanId] = true;
          deduplicated.push(item);
        }
      });

      var activeDiscountCode = discountCodes.length > 0 ? discountCodes[0] : null;

      if (deduplicated.length > 0) {
        addItemsAndOpenDrawer(deduplicated, activeDiscountCode).finally(function () {
          closeModal();
          pendingSubmission = null;
        });
      } else {
        closeModal();
        pendingSubmission = null;
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     Feature 5: Smart Tiered Shipping Progress Bar
     ───────────────────────────────────────────────────────────── */
  function removeShippingBars() {
    var existingDrawerBar = document.getElementById("xpc-shipping-bar-drawer");
    if (existingDrawerBar) existingDrawerBar.remove();
    var existingPageBar = document.getElementById("xpc-shipping-bar-page");
    if (existingPageBar) existingPageBar.remove();
    var blockContainers = document.querySelectorAll(".xpoost-shipping-bar-block");
    blockContainers.forEach(function (c) { c.innerHTML = ""; });
  }

  function renderShippingBar() {
    var config = configStore.shipping;
    if (!config || !config.active) {
      removeShippingBars();
      return;
    }

    if (!cartState.items || cartState.items.length === 0 || cartState.totalPrice <= 0) {
      removeShippingBars();
      return;
    }

    var tiers = config.tiers || [];
    if (tiers.length === 0) {
      removeShippingBars();
      return;
    }
    tiers.sort(function (a, b) { return a.targetAmount - b.targetAmount; });

    var currentTotal = cartState.totalPrice;
    var symbol = config.currencySymbol || (cartState.currency === "EGP" || cartState.currency === "LE" ? "LE " : "$");
    var highestTarget = tiers.length > 0 ? tiers[tiers.length - 1].targetAmount : 100;
    var progressPercent = Math.min(100, Math.round((currentTotal / highestTarget) * 100));

    var nextTier = null;
    for (var i = 0; i < tiers.length; i++) {
      if (currentTotal < tiers[i].targetAmount) {
        nextTier = tiers[i];
        break;
      }
    }

    var remaining = nextTier ? (nextTier.targetAmount - currentTotal).toFixed(2) : "0.00";
    var layoutStyle = config.layoutStyle || "milestone_stepper";
    var barInnerHtml = "";

    // LAYOUT 1: Milestone Stepper Roadmap
    if (layoutStyle === "milestone_stepper") {
      var headline = nextTier
        ? "Only " + symbol + remaining + " away from " + escapeHtml(nextTier.rewardTitle) + "!"
        : escapeHtml(config.allUnlockedMessage || "Congratulations! All rewards unlocked!");

      var stepperNodesHtml = tiers.map(function (tier, idx) {
        var isReached = currentTotal >= tier.targetAmount;
        return (
          '<div class="xpc-stepper-node ' + (isReached ? "is-reached" : "") + '">' +
          '<div class="xpc-node-circle">' + (isReached ? VECTOR_ICONS.check : '<span>' + (idx + 1) + '</span>') + '</div>' +
          '<span class="xpc-node-amount">' + symbol + tier.targetAmount + '</span>' +
          '<span class="xpc-node-title">' + escapeHtml(tier.rewardTitle.split(" ")[0]) + '</span>' +
          '</div>'
        );
      }).join("");

      barInnerHtml =
        '<div class="xpc-shipping-bar xpc-shipping-bar--stepper" style="--xpc-bg:' + (config.backgroundColor || "#0B0B0B") + ';--xpc-gold:' + (config.progressColor || "#D4AF37") + ';--xpc-track:' + (config.trackColor || "#222") + ';--xpc-text:' + (config.textColor || "#fff") + ';">' +
        '<div class="xpc-shipping-headline">' + headline + '</div>' +
        '<div class="xpc-stepper-track-wrap">' +
        '<div class="xpc-stepper-line-bg"><div class="xpc-stepper-line-fill" style="width:' + progressPercent + '%;"></div></div>' +
        '<div class="xpc-stepper-nodes">' + stepperNodesHtml + '</div>' +
        '</div>' +
        '</div>';
    }
    // LAYOUT 2: Gamified Reward Cards
    else if (layoutStyle === "gamified_cards") {
      var cardsHeadline = nextTier
        ? "Add " + symbol + remaining + " to unlock your next reward"
        : escapeHtml(config.allUnlockedMessage || "All rewards unlocked!");

      var cardsHtml = tiers.map(function (tier, idx) {
        var isReached = currentTotal >= tier.targetAmount;
        return (
          '<div class="xpc-reward-card-item ' + (isReached ? "is-unlocked" : "is-locked") + '">' +
          '<div class="xpc-card-icon-wrap">' + (isReached ? VECTOR_ICONS.gift : VECTOR_ICONS.lock) + '</div>' +
          '<div class="xpc-card-title">' + escapeHtml(tier.rewardTitle) + '</div>' +
          '<div class="xpc-card-badge">' + (isReached ? "UNLOCKED" : symbol + tier.targetAmount) + '</div>' +
          '</div>'
        );
      }).join("");

      barInnerHtml =
        '<div class="xpc-shipping-bar xpc-shipping-bar--cards" style="--xpc-bg:' + (config.backgroundColor || "#0B0B0B") + ';--xpc-gold:' + (config.progressColor || "#D4AF37") + ';--xpc-track:' + (config.trackColor || "#222") + ';--xpc-text:' + (config.textColor || "#fff") + ';">' +
        '<div class="xpc-shipping-headline">' + cardsHeadline + '</div>' +
        '<div class="xpc-cards-progress-bar"><div class="xpc-cards-progress-fill" style="width:' + progressPercent + '%;"></div></div>' +
        '<div class="xpc-reward-cards-row">' + cardsHtml + '</div>' +
        '</div>';
    }
    // LAYOUT 3: Luxury Minimalist Bar
    else if (layoutStyle === "luxury_gradient") {
      var luxHeadline = nextTier
        ? 'You are only <strong style="color:var(--xpc-gold);">' + symbol + remaining + '</strong> away from ' + escapeHtml(nextTier.rewardTitle)
        : escapeHtml(config.allUnlockedMessage || "All VIP rewards unlocked");

      barInnerHtml =
        '<div class="xpc-shipping-bar xpc-shipping-bar--luxury" style="--xpc-bg:' + (config.backgroundColor || "#0B0B0B") + ';--xpc-gold:' + (config.progressColor || "#D4AF37") + ';--xpc-track:' + (config.trackColor || "#222") + ';--xpc-text:' + (config.textColor || "#fff") + ';">' +
        '<div class="xpc-luxury-headline">' + luxHeadline + '</div>' +
        '<div class="xpc-luxury-bar-track"><div class="xpc-luxury-bar-fill" style="width:' + progressPercent + '%;"><div class="xpc-luxury-shimmer"></div></div></div>' +
        '<div class="xpc-luxury-footer"><span>Cart: ' + symbol + currentTotal.toFixed(2) + '</span><span>Goal: ' + symbol + highestTarget + '</span></div>' +
        '</div>';
    }
    // LAYOUT 4: Split Achievement Ribbon
    else if (layoutStyle === "split_ribbon") {
      var reachedCount = tiers.filter(function (t) { return currentTotal >= t.targetAmount; }).length;
      var targetNotice = nextTier ? "+" + symbol + remaining + " for " + escapeHtml(nextTier.rewardTitle.split(" ")[0]) : "All Unlocked";

      barInnerHtml =
        '<div class="xpc-shipping-bar xpc-shipping-bar--split" style="--xpc-bg:' + (config.backgroundColor || "#0B0B0B") + ';--xpc-gold:' + (config.progressColor || "#D4AF37") + ';--xpc-track:' + (config.trackColor || "#222") + ';--xpc-text:' + (config.textColor || "#fff") + ';">' +
        '<div class="xpc-split-ribbon-top">' +
        '<div class="xpc-split-badge-achieved">Level ' + reachedCount + ' Unlocked</div>' +
        '<div class="xpc-split-next-target">' + targetNotice + '</div>' +
        '</div>' +
        '<div class="xpc-split-track"><div class="xpc-split-fill" style="width:' + progressPercent + '%;"></div></div>' +
        '</div>';
    }

    // 1. Explicit Theme App Blocks
    var blockContainers = document.querySelectorAll(".xpoost-shipping-bar-block");
    blockContainers.forEach(function (c) {
      c.innerHTML = barInnerHtml;
    });

    // 2. Cart Drawer Auto-Injection
    // Place inside the scrollable drawer content area, right before items
    var drawerItems = document.querySelector(
      "cart-drawer-component .cart-drawer__items, " +
      "cart-items-component .cart-drawer__items, " +
      ".cart-drawer__items, " +
      "cart-drawer-items, " +
      ".cart-drawer-items"
    );
    var drawerContent = document.querySelector(
      "cart-drawer-component .cart-drawer__content, " +
      "cart-items-component .cart-drawer__content, " +
      ".cart-drawer__content"
    );
    var drawerHeader = document.querySelector(
      "cart-drawer-component .cart-drawer__header, " +
      "cart-drawer .drawer__header, " +
      ".drawer__header, " +
      ".cart-drawer__header"
    );

    var hasDrawerTarget = drawerItems || drawerContent || drawerHeader;

    if (hasDrawerTarget) {
      var existingDrawerBar = document.getElementById("xpc-shipping-bar-drawer");
      if (!existingDrawerBar) {
        var autoBarWrap = document.createElement("div");
        autoBarWrap.id = "xpc-shipping-bar-drawer";
        autoBarWrap.className = "xpoost-root xpc-shipping-bar-auto";
        autoBarWrap.setAttribute("data-rendered-total", String(currentTotal));
        autoBarWrap.setAttribute("data-rendered-percent", String(progressPercent));
        autoBarWrap.style.cssText = "display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:12px 16px 14px 16px!important;margin:0 0 10px 0!important;min-width:0!important;position:relative!important;z-index:5!important;background:transparent!important;";
        autoBarWrap.innerHTML = barInnerHtml;

        if (drawerItems) {
          drawerItems.parentNode.insertBefore(autoBarWrap, drawerItems);
        } else if (drawerContent && drawerContent.firstChild) {
          drawerContent.insertBefore(autoBarWrap, drawerContent.firstChild);
        } else if (drawerHeader) {
          drawerHeader.parentNode.insertBefore(autoBarWrap, drawerHeader.nextSibling);
        }
      } else {
        // Smart in-place update: avoid wiping innerHTML and causing flashes
        var prevTotal = existingDrawerBar.getAttribute("data-rendered-total");
        var prevPercent = existingDrawerBar.getAttribute("data-rendered-percent");
        if (prevTotal !== String(currentTotal) || prevPercent !== String(progressPercent)) {
          existingDrawerBar.setAttribute("data-rendered-total", String(currentTotal));
          existingDrawerBar.setAttribute("data-rendered-percent", String(progressPercent));
          var fillEl = existingDrawerBar.querySelector(".xpc-shipping-fill");
          if (fillEl) fillEl.style.width = progressPercent + "%";
          var headEl = existingDrawerBar.querySelector(".xpc-shipping-headline");
          if (headEl) headEl.innerHTML = statusMessage;
          var mileEl = existingDrawerBar.querySelector(".xpc-shipping-milestones");
          if (mileEl) mileEl.innerHTML = milestonesHtml;
        }
      }
    }

    // 3. Cart Page Auto-Injection
    var cartPageForm = document.querySelector("form[action*='/cart']:not(cart-drawer form)");
    if (cartPageForm && !hasDrawerTarget) {
      var existingPageBar = document.getElementById("xpc-shipping-bar-page");
      if (!existingPageBar) {
        var pageBarWrap = document.createElement("div");
        pageBarWrap.id = "xpc-shipping-bar-page";
        pageBarWrap.className = "xpoost-root xpc-shipping-bar-auto";
        pageBarWrap.style.cssText = "display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:0 16px!important;margin:10px 0!important;min-width:0!important;overflow:visible!important;";
        pageBarWrap.innerHTML = barInnerHtml;
        cartPageForm.parentNode.insertBefore(pageBarWrap, cartPageForm);
      } else {
        existingPageBar.innerHTML = barInnerHtml;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     Feature 3: In-Cart Drawer Upsell Block
     ───────────────────────────────────────────────────────────── */
  function removeInCartUpsells() {
    var existingDrawerUpsell = document.getElementById("xpc-in-cart-drawer");
    if (existingDrawerUpsell) existingDrawerUpsell.remove();
    var existingPageUpsell = document.getElementById("xpc-in-cart-page");
    if (existingPageUpsell) existingPageUpsell.remove();
    var blockContainers = document.querySelectorAll(".xpoost-in-cart-upsell-block");
    blockContainers.forEach(function (c) { c.innerHTML = ""; });
  }

  function renderInCartUpsell() {
    var config = configStore.inCart;
    if (!config || !config.active) {
      removeInCartUpsells();
      return;
    }

    // Empty Cart Check: do NOT display in-cart upsells when cart is empty
    if (!cartState.items || cartState.items.length === 0 || cartState.totalPrice <= 0) {
      removeInCartUpsells();
      return;
    }

    var rules = config.rules || [];
    if (rules.length === 0) {
      removeInCartUpsells();
      return;
    }

    // Filter candidate rules whose target product/variant is not already in the cart
    // Prioritize specific trigger matches over storewide (ALL)
    var specificCandidate = null;
    var storewideCandidate = null;

    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      var targetV = r.targetVariantId ? String(r.targetVariantId).replace(/[^0-9]/g, "") : "";
      var targetP = r.targetProductId ? String(r.targetProductId).replace(/[^0-9]/g, "") : "";

      var inCartAlready = cartState.items.some(function (item) {
        var itemVar = String(item.variant_id || item.id || "").replace(/[^0-9]/g, "");
        var itemProd = String(item.product_id || "").replace(/[^0-9]/g, "");
        return (targetV && itemVar === targetV) || (targetP && itemProd === targetP);
      });

      if (inCartAlready) continue;

      if (r.triggerProductId === "ALL") {
        if (!storewideCandidate) storewideCandidate = r;
      } else if (r.triggerProductId) {
        var tokens = r.triggerProductId.split(",");
        var triggerMatches = cartState.items.some(function (item) {
          var itemVar = String(item.variant_id || item.id || "").replace(/[^0-9]/g, "");
          var itemProd = String(item.product_id || "").replace(/[^0-9]/g, "");
          return tokens.some(function (tok) {
            var cleanTok = tok.replace(/[^0-9]/g, "").trim();
            return cleanTok && (cleanTok === itemProd || cleanTok === itemVar);
          });
        });

        if (triggerMatches) {
          specificCandidate = r;
          break; // Specific product match found
        }
      }
    }

    var activeRule = specificCandidate || storewideCandidate;

    if (!activeRule) {
      removeInCartUpsells();
      return;
    }

    var symbol = (cartState.currency === "EGP" || cartState.currency === "LE" ? "LE " : "$");
    var origPrice = parseFloat(activeRule.targetProductPrice || "19.99");
    var discount = activeRule.discountPercent ? parseFloat(activeRule.discountPercent) : 0;
    var hasDiscount = discount > 0;
    var salePrice = (hasDiscount ? origPrice * (1 - discount / 100) : origPrice).toFixed(2);
    var targetVariant = activeRule.targetVariantId ? activeRule.targetVariantId.replace(/[^0-9]/g, "") : "";

    var productUrl = getProductUrl(activeRule);

    var inCartConf = configStore.inCart || {};
    var inCartBg = inCartConf.backgroundColor || "#0B0B0B";
    var inCartAccent = inCartConf.accentColor || "#D4AF37";
    var tInCart = (configStore.translations && configStore.translations.inCart) || {};
    var inCartTitle = activeRule.offerHeadline || tInCart.sectionTitle || getUiString('recommendedAddOn');
    var inCartBtnText = activeRule.addButton || tInCart.addButton || getUiString('add');
    var inCartSaveBadgeFormat = activeRule.saveBadge || tInCart.saveBadge || getUiString('saveBadge');
    var inCartBadgeText = inCartSaveBadgeFormat.replace('{discount}', String(discount));

    var cardInnerHtml =
      '<div class="xpc-in-cart-upsell xpc-animate-in"' + (configStore.isRtl ? ' dir="rtl"' : '') + ' style="--xpc-bg:' + inCartBg + ';--xpc-gold:' + inCartAccent + ';--xpc-text:' + inCartText + ';display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;margin:0 auto!important;min-width:0!important;overflow:hidden!important;">' +
      '<div class="xpc-in-cart-title">' + escapeHtml(inCartTitle) + '</div>' +
      '<div class="xpc-in-cart-item">' +
      '<a href="' + productUrl + '" target="_blank" class="xpc-in-cart-thumb-link">' +
      (activeRule.targetProductImage
        ? '<img class="xpc-in-cart-thumb" src="' + escapeHtml(activeRule.targetProductImage) + '" alt="" />'
        : '<div class="xpc-in-cart-thumb"></div>') +
      '</a>' +
      '<div class="xpc-in-cart-details">' +
      '<div class="xpc-in-cart-name"><a href="' + productUrl + '" target="_blank" class="xpc-product-link">' + escapeHtml(activeRule.targetProductTitle || "Recommended Add-On") + '</a></div>' +
      '<div class="xpc-in-cart-pricing">' +
      '<span class="xpc-in-cart-price">' + symbol + salePrice + '</span>' +
      (hasDiscount ? '<span class="xpc-in-cart-orig">' + symbol + origPrice.toFixed(2) + '</span><span class="xpc-modal-save-pill" style="margin-inline-start:6px;font-size:10px;padding:2px 6px;">' + escapeHtml(inCartBadgeText) + '</span>' : "") +
      '</div>' +
      '</div>' +
      '<button type="button" class="xpc-in-cart-btn" data-variant-id="' + targetVariant + '">' + escapeHtml(inCartBtnText) + '</button>' +
      '</div>' +
      '</div>';

    // Check if the in-cart drawer upsell is ALREADY displayed for this exact product
    var existingDrawerUpsell = document.getElementById("xpc-in-cart-drawer");
    if (existingDrawerUpsell && existingDrawerUpsell.isConnected && existingDrawerUpsell.getAttribute("data-variant-id") === targetVariant) {
      // Already rendered and connected with this variant -- exit cleanly to avoid flashing!
      return;
    }
    // If the element exists but was orphaned by theme DOM morphing, clean it up
    if (existingDrawerUpsell && !existingDrawerUpsell.isConnected) {
      existingDrawerUpsell = null;
    }

    // 1. Explicit Theme App Blocks
    var blockContainers = document.querySelectorAll(".xpoost-in-cart-upsell-block");
    blockContainers.forEach(function (c) {
      if (c.getAttribute("data-variant-id") !== targetVariant) {
        c.setAttribute("data-variant-id", targetVariant);
        c.innerHTML = cardInnerHtml;
        attachAddEvent(c, targetVariant, activeRule.discountCode, activeRule.discountPercent);
      }
    });

    // 2. Cart Drawer Auto-Injection
    // Support next-gen themes (cart-drawer-component) AND Dawn (cart-drawer)
    var drawerTarget = document.querySelector(
      "cart-drawer-component .cart-drawer__summary, " +
      "cart-drawer-component .cart-drawer__footer, " +
      "cart-drawer .drawer__footer, " +
      ".cart-drawer .drawer__footer, " +
      ".drawer__footer, " +
      ".cart-drawer__footer"
    );

    if (drawerTarget) {
      if (!existingDrawerUpsell) {
        var autoUpsellWrap = document.createElement("div");
        autoUpsellWrap.id = "xpc-in-cart-drawer";
        autoUpsellWrap.setAttribute("data-variant-id", targetVariant);
        autoUpsellWrap.className = "xpoost-root xpc-in-cart-auto";
        autoUpsellWrap.style.cssText = "display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:0 16px!important;margin:10px 0!important;min-width:0!important;overflow:hidden!important;";
        autoUpsellWrap.innerHTML = cardInnerHtml;
        drawerTarget.parentNode.insertBefore(autoUpsellWrap, drawerTarget);
        attachAddEvent(autoUpsellWrap, targetVariant, activeRule.discountCode, activeRule.discountPercent);
      } else {
        existingDrawerUpsell.setAttribute("data-variant-id", targetVariant);
        existingDrawerUpsell.innerHTML = cardInnerHtml;
        attachAddEvent(existingDrawerUpsell, targetVariant, activeRule.discountCode, activeRule.discountPercent);
      }
    } else {
      // Fallback: below items in drawer (support both next-gen and Dawn)
      var itemsTarget = document.querySelector(
        "cart-drawer-component .cart-drawer__items, " +
        "cart-drawer-component .cart-drawer__content, " +
        "cart-items-component, " +
        "cart-drawer-items, .cart-drawer-items, .cart-drawer__items"
      );
      if (itemsTarget) {
        if (!existingDrawerUpsell) {
          var autoItemsWrap = document.createElement("div");
          autoItemsWrap.id = "xpc-in-cart-drawer";
          autoItemsWrap.setAttribute("data-variant-id", targetVariant);
          autoItemsWrap.className = "xpoost-root xpc-in-cart-auto";
          autoItemsWrap.style.cssText = "display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:0 16px!important;margin:10px 0!important;min-width:0!important;overflow:hidden!important;";
          autoItemsWrap.innerHTML = cardInnerHtml;
          itemsTarget.parentNode.insertBefore(autoItemsWrap, itemsTarget.nextSibling);
          attachAddEvent(autoItemsWrap, targetVariant, activeRule.discountCode, activeRule.discountPercent);
        } else {
          existingDrawerUpsell.setAttribute("data-variant-id", targetVariant);
          existingDrawerUpsell.innerHTML = cardInnerHtml;
          attachAddEvent(existingDrawerUpsell, targetVariant, activeRule.discountCode, activeRule.discountPercent);
        }
      }
    }

    // 3. Cart Page Auto-Injection
    var cartPageItems = document.querySelector(".cart__items, table.cart-items, form[action*='/cart'] .cart__footer");
    if (cartPageItems && !drawerTarget) {
      var existingPageUpsell = document.getElementById("xpc-in-cart-page");
      if (!existingPageUpsell) {
        var pageWrap = document.createElement("div");
        pageWrap.id = "xpc-in-cart-page";
        pageWrap.className = "xpoost-root xpc-in-cart-auto";
        pageWrap.style.cssText = "display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:0 16px!important;margin:10px 0!important;min-width:0!important;overflow:hidden!important;";
        pageWrap.innerHTML = cardInnerHtml;
        cartPageItems.parentNode.insertBefore(pageWrap, cartPageItems);
        attachAddEvent(pageWrap, targetVariant, activeRule.discountCode, activeRule.discountPercent);
      } else {
        existingPageUpsell.style.cssText = "display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:0 16px!important;margin:10px 0!important;min-width:0!important;overflow:hidden!important;";
        existingPageUpsell.innerHTML = cardInnerHtml;
        attachAddEvent(existingPageUpsell, targetVariant, activeRule.discountCode, activeRule.discountPercent);
      }
    }
  }

  function attachAddEvent(container, targetVariant, discountCode, discountPercent) {
    var btn = container.querySelector(".xpc-in-cart-btn");
    if (btn && targetVariant) {
      btn.addEventListener("click", function () {
        btn.disabled = true;
        btn.classList.add("is-loading");
        btn.innerHTML = '<span class="xpc-spinner"></span> ' + escapeHtml(getUiString('adding'));

        var disc = (discountPercent && parseFloat(discountPercent) > 0) ? String(discountPercent) : "";
        var itemToAdd = {
          id: targetVariant,
          quantity: 1,
          properties: disc ? { "_xpoost_discount": disc, "_xpoost_upsell": "true" } : {}
        };

        addItemsAndOpenDrawer([itemToAdd], discountCode || null)
          .then(function () {
            btn.classList.remove("is-loading");
            btn.classList.add("is-added");
            btn.innerHTML = '<span>' + escapeHtml(getUiString('added')) + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:2px"><polyline points="20 6 9 17 4 12"/></svg></span>';

            var card = container.querySelector(".xpc-in-cart-upsell");
            if (card) {
              card.classList.add("is-claimed");
              setTimeout(function () { card.classList.remove("is-claimed"); }, 1200);
            }
          })
          .catch(function () {
            btn.disabled = false;
            btn.classList.remove("is-loading");
            btn.textContent = inCartBtnText || getUiString("add");
          });
      });
    }
  }

  ready(initCartEngine);
})();
