(function () {
  "use strict";

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

  /* ─────────────────────────────────────────────────────────────
     Customer Order Detection:
     If the customer has placed an order, the exit-intent recovery
     modal MUST NEVER trigger.
     ───────────────────────────────────────────────────────────── */
  function hasCustomerOrdered() {
    try {
      if (localStorage.getItem("xpoost_customer_has_ordered") === "true") return true;
      if (sessionStorage.getItem("xpoost_customer_has_ordered") === "true") return true;

      var path = (window.location.pathname || "").toLowerCase();
      var href = (window.location.href || "").toLowerCase();
      var isThankYou =
        path.indexOf("/thank_you") !== -1 ||
        path.indexOf("/orders/") !== -1 ||
        path.indexOf("/checkout_completed") !== -1 ||
        href.indexOf("order_id") !== -1 ||
        Boolean(window.Shopify && window.Shopify.checkout && window.Shopify.checkout.order_id);

      if (isThankYou) {
        localStorage.setItem("xpoost_customer_has_ordered", "true");
        sessionStorage.setItem("xpoost_customer_has_ordered", "true");
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ─────────────────────────────────────────────────────────────
     Internal Navigation Detection:
     If the user arrived on this page from another page on this same
     store, clicking Back will navigate to that previous store page,
     so we must NOT intercept the back button on internal pages!
     ───────────────────────────────────────────────────────────── */
  function isInternalNavigation() {
    try {
      var ref = document.referrer || "";
      if (!ref) return false;
      var origin = window.location.origin;
      return ref.indexOf(origin) === 0;
    } catch (e) {
      return false;
    }
  }

  function initRetention() {
    // 1. Check if the customer has already ordered
    if (hasCustomerOrdered()) return;

    var mount = document.getElementById("xpoost-exit-intent");
    var proxyPath = mount ? (mount.getAttribute("data-proxy-path") || "/apps/xpoost/config") : "/apps/xpoost/config";

    var loadConfig = window.__xpoost_load_config || function (p, m) {
      var loc = detectStorefrontLocale(m);
      var sep = p.indexOf("?") === -1 ? "?" : "&";
      var fullUrl = p + sep + "locale=" + encodeURIComponent(loc);
      return fetch(fullUrl, { credentials: "same-origin" }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    };

    loadConfig(proxyPath, mount)
      .then(function (data) {
        if (!data || !data.active) return;
        if (data.features && data.features.exitIntent && data.features.exitIntent.active) {
          setupExitIntent(data.features.exitIntent);
        }
      })
      .catch(function (err) {
        console.warn("[XPoost] Exit-intent retention init skipped:", err);
      });
  }

  /* ─────────────────────────────────────────────────────────────
     Feature 6: Back-Button Exit-Intent Interceptor
     ───────────────────────────────────────────────────────────── */
  var exitTriggered = false;

  function setupExitIntent(config) {
    if (hasCustomerOrdered()) return;

    // Check test mode flag to allow testing without suppression
    var isTestMode = window.location.href.indexOf("xpoost_test") !== -1 ||
                     window.location.href.indexOf("test_exit") !== -1 ||
                     Boolean(window.Shopify && window.Shopify.designMode);

    var storageKey = "xpoost_exit_saver_suppressed";
    var suppressedUntil = parseInt(localStorage.getItem(storageKey) || "0", 10);
    if (!isTestMode && Date.now() < suppressedUntil) {
      return; // Under cool-down suppression
    }

    // CRITICAL: If this page was reached via internal navigation (user clicked an internal link on the store),
    // clicking Back will take them to the previous store page. DO NOT PUSH EXIT GUARD HERE!
    if (isInternalNavigation()) {
      return;
    }

    // THIS IS THE STORE ENTRY PAGE (User entered from Google, TikTok, IG, FB, or direct link).
    // Behind this page in browser history is external. Clicking Back here will EXIT the store.
    // Replace initial entry state, then push guard state.
    var guardArmed = false;
    function armGuard() {
      if (guardArmed || exitTriggered || hasCustomerOrdered()) return;
      guardArmed = true;
      try {
        if (window.history.replaceState) {
          window.history.replaceState(
            { xpoost_entry: true, xpoost_time: Date.now() },
            document.title,
            window.location.href
          );
        }
        window.history.pushState(
          { xpoost_guard: true, xpoost_time: Date.now() },
          document.title,
          window.location.href
        );
      } catch (e) {}
    }

    // Arm after 800ms or on user interaction
    var armTimer = setTimeout(armGuard, 800);
    function onInteract() {
      clearTimeout(armTimer);
      armGuard();
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("click", onInteract);
    }
    window.addEventListener("scroll", onInteract, { passive: true, once: true });
    window.addEventListener("touchstart", onInteract, { passive: true, once: true });
    window.addEventListener("click", onInteract, { passive: true, once: true });

    // Handle Back Button press (popstate event)
    window.addEventListener("popstate", function (e) {
      if (hasCustomerOrdered()) return;

      // If modal is currently open and user presses back again, remove it and let them exit
      var openModal = document.getElementById("xpr-exit-modal");
      if (openModal) {
        openModal.remove();
        return;
      }

      // If already shown in this session, do not re-trap
      if (exitTriggered) return;

      var suppressed = parseInt(localStorage.getItem(storageKey) || "0", 10);
      if (!isTestMode && Date.now() < suppressed) {
        return;
      }

      // Customer clicked Back to leave the store! Trigger Exit Recovery Modal!
      triggerExitModal(config, storageKey);
    });

    // Reset exitTriggered if restored via BFCache without modal
    window.addEventListener("pageshow", function (e) {
      if (!document.getElementById("xpr-exit-modal")) {
        exitTriggered = false;
      }
    });
  }

  function triggerExitModal(config, storageKey) {
    if (exitTriggered || hasCustomerOrdered()) return;
    exitTriggered = true;

    // Remove any existing modal
    var existing = document.getElementById("xpr-exit-modal");
    if (existing) existing.remove();

    var code = config.discountCode || "SAVE10";
    var secondsLeft = config.countdownSeconds || 600;

    var modalHtml =
      '<div class="xpr-exit-backdrop is-open" id="xpr-exit-modal">' +
      '<div class="xpr-exit-modal" style="--xpr-bg:' + (config.backgroundColor || "#0B0B0B") + ';--xpr-gold:' + (config.accentColor || "#D4AF37") + ';--xpr-text:' + (config.textColor || "#fff") + ';">' +
      '<button type="button" class="xpr-exit-close" id="xpr-exit-close" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<div class="xpr-exit-timer">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
      '<span class="xpr-exit-digits" id="xpr-countdown">10:00</span>' +
      '<span>EXPIRES SOON</span>' +
      '</div>' +
      '<h3 class="xpr-exit-headline">' + escapeHtml(config.headline || "Wait! Don't leave empty handed") + '</h3>' +
      '<p class="xpr-exit-body">' + escapeHtml(config.bodyText || "Take an extra discount off your order right now before this offer expires.") + '</p>' +
      '<div class="xpr-exit-coupon" id="xpr-coupon-box">' +
      '<span class="xpr-coupon-code">' + escapeHtml(code) + '</span>' +
      '<span class="xpr-coupon-copy" id="xpr-copy-label">CLICK TO COPY</span>' +
      '</div>' +
      '<button type="button" class="xpr-exit-btn" id="xpr-exit-cta">' + escapeHtml(config.buttonText || "Claim Discount & Checkout") + ' \u2192</button>' +
      '</div>' +
      '</div>';

    var wrap = document.createElement("div");
    wrap.innerHTML = modalHtml;
    var modalEl = wrap.firstElementChild;
    document.body.appendChild(modalEl);

    // Suppress further triggers for configured days (unless in test mode)
    var isTestMode = window.location.href.indexOf("xpoost_test") !== -1 ||
                     window.location.href.indexOf("test_exit") !== -1;
    if (!isTestMode) {
      var days = config.suppressionDays || 1;
      localStorage.setItem(storageKey, String(Date.now() + days * 86400000));
    }

    // Countdown timer
    var countdownEl = modalEl.querySelector("#xpr-countdown");
    var timerInterval = setInterval(function () {
      if (secondsLeft <= 0) {
        clearInterval(timerInterval);
        return;
      }
      secondsLeft--;
      var m = Math.floor(secondsLeft / 60);
      var s = secondsLeft % 60;
      if (countdownEl) {
        countdownEl.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
      }
    }, 1000);

    function closeModal() {
      clearInterval(timerInterval);
      modalEl.classList.remove("is-open");
      setTimeout(function () { modalEl.remove(); }, 250);
    }

    modalEl.querySelector("#xpr-exit-close").addEventListener("click", closeModal);

    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) {
        closeModal();
      }
    });

    var couponBox = modalEl.querySelector("#xpr-coupon-box");
    var copyLabel = modalEl.querySelector("#xpr-copy-label");
    function copyCode() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code);
      }
      if (copyLabel) {
        copyLabel.textContent = "COPIED!";
        setTimeout(function () { copyLabel.textContent = "CLICK TO COPY"; }, 2000);
      }
    }
    couponBox.addEventListener("click", copyCode);

    modalEl.querySelector("#xpr-exit-cta").addEventListener("click", function () {
      copyCode();
      closeModal();
      window.location.href = "/checkout?discount=" + encodeURIComponent(code);
    });
  }

  ready(initRetention);
})();
