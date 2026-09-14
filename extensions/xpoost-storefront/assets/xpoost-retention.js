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

  /* ─────────────────────────────────────────────────────────────
     Customer Order Detection:
     If the customer has placed an order, the exit-intent recovery
     modal MUST NEVER trigger.
     ───────────────────────────────────────────────────────────── */
  function hasCustomerOrdered() {
    try {
      if (localStorage.getItem("xpoost_customer_has_ordered") === "true") return true;
      if (sessionStorage.getItem("xpoost_customer_has_ordered") === "true") return true;

      // Detect Shopify Order Confirmation / Thank You page
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
    } catch (e) {
      // Storage access protected or private browsing
    }
    return false;
  }

  /* ─────────────────────────────────────────────────────────────
     Store Entry vs Internal Navigation Detection:
     Only trigger when the user is at the entry point of the store
     so clicking Back would exit the website entirely.
     If clicking Back leads to another store page, DO NOT INTERCEPT.
     ───────────────────────────────────────────────────────────── */
  function isStoreEntryPoint() {
    try {
      var referrer = document.referrer || "";
      if (!referrer) return true; // Direct entry, bookmark, or stripped in-app browser referrer (TikTok, IG, FB)

      var refHost = "";
      try {
        refHost = new URL(referrer).hostname;
      } catch (e) {
        refHost = "";
      }

      var currentHost = window.location.hostname;
      // If referrer is external (different domain), this page is the landing/entry point!
      if (refHost && refHost !== currentHost) {
        return true;
      }

      // If marked as entry in history state
      if (window.history && window.history.state && window.history.state.xpoost_is_entry) {
        return true;
      }
    } catch (e) {
      return true;
    }
    return false;
  }

  function initRetention() {
    // If the customer already ordered, never run retention/exit-intent
    if (hasCustomerOrdered()) return;

    var proxyPath = "/apps/xpoost/config";
    var mount = document.getElementById("xpoost-exit-intent");
    if (mount) {
      proxyPath = mount.getAttribute("data-proxy-path") || proxyPath;
    }

    var loadConfig = window.__xpoost_load_config || function (p) {
      return fetch(p, { credentials: "same-origin" }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    };

    loadConfig(proxyPath)
      .then(function (data) {
        if (!data || !data.active) return;
        if (data.features && data.features.exitIntent && data.features.exitIntent.active) {
          setupExitIntent(data.features.exitIntent);
        }
      })
      .catch(function (err) {
        console.warn("[XPoost] Retention engine init skipped:", err);
      });
  }

  /* ─────────────────────────────────────────────────────────────
     Feature 6: Back-Button Store Exit Interceptor
     Triggers ONLY when the customer clicks the Back button to leave
     the website entirely without placing an order.
     ───────────────────────────────────────────────────────────── */
  var exitTriggered = false;

  function setupExitIntent(config) {
    if (hasCustomerOrdered()) return;

    var storageKey = "xpoost_exit_saver_suppressed";
    var suppressedUntil = parseInt(localStorage.getItem(storageKey) || "0", 10);
    if (Date.now() < suppressedUntil) {
      return; // Under cool-down suppression window
    }

    // CRITICAL: Only arm the exit-intent guard on the entry page of the store.
    // If the user navigated here from another page on this same store (internal link),
    // clicking Back will take them back to that previous store page, so DO NOT INTERCEPT!
    if (!isStoreEntryPoint()) {
      return;
    }

    // Mark current state as entry page
    try {
      if (window.history.replaceState) {
        window.history.replaceState(
          { xpoost_is_entry: true, xpoost_url: window.location.href },
          document.title,
          window.location.href
        );
      }
    } catch (e) {}

    var guardArmed = false;
    function armExitGuard() {
      if (guardArmed || exitTriggered || hasCustomerOrdered()) return;
      guardArmed = true;

      try {
        // Push duplicate dummy history state
        window.history.pushState(
          { xpoost_exit_guard: true, xpoost_armed_at: Date.now() },
          document.title,
          window.location.href
        );
      } catch (e) {}
    }

    // Arm after the customer "browses a bit" (2 seconds or on first interaction)
    var armTimer = setTimeout(armExitGuard, 2000);
    function onBrowse() {
      clearTimeout(armTimer);
      armExitGuard();
      window.removeEventListener("scroll", onBrowse);
      window.removeEventListener("touchstart", onBrowse);
      window.removeEventListener("click", onBrowse);
    }
    window.addEventListener("scroll", onBrowse, { passive: true, once: true });
    window.addEventListener("touchstart", onBrowse, { passive: true, once: true });
    window.addEventListener("click", onBrowse, { passive: true, once: true });

    // Listen for the Back button click (popstate event)
    window.addEventListener("popstate", function (e) {
      // 1. If customer ordered at any point, never trigger
      if (hasCustomerOrdered()) return;

      // 2. If modal is already open and user hits back again, close it and let them leave
      var existingModal = document.getElementById("xpr-exit-modal");
      if (existingModal) {
        existingModal.remove();
        return;
      }

      // 3. If already triggered once, do not re-trap
      if (exitTriggered) return;

      // 4. Check suppression window
      var suppressed = parseInt(localStorage.getItem(storageKey) || "0", 10);
      if (Date.now() < suppressed) {
        return;
      }

      // 5. Customer clicked Back to leave the site! Show the recovery modal!
      triggerExitModal(config, storageKey);
    });
  }

  function triggerExitModal(config, storageKey) {
    if (exitTriggered || hasCustomerOrdered()) return;
    exitTriggered = true;

    var container = document.getElementById("xpoost-root") || document.body;
    var existing = container.querySelector(".xpr-exit-backdrop");
    if (existing) existing.remove();

    var code = config.discountCode || "SAVE10";
    var secondsLeft = config.countdownSeconds || 600;

    var html =
      '<div class="xpr-exit-backdrop is-open" id="xpr-exit-modal">' +
      '<div class="xpr-exit-modal" style="--xpr-bg:' + (config.backgroundColor || "#0B0B0B") + ';--xpr-gold:' + (config.accentColor || "#D4AF37") + ';--xpr-text:' + (config.textColor || "#fff") + ';">' +
      '<button type="button" class="xpr-exit-close" id="xpr-exit-close" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '<div class="xpr-exit-timer">' +
      '<span style="display:inline-flex;align-items:center;vertical-align:middle;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>' +
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
    wrap.innerHTML = html;
    var modalEl = wrap.firstElementChild;
    container.appendChild(modalEl);

    // Suppress further triggers for configured days
    var days = config.suppressionDays || 1;
    localStorage.setItem(storageKey, String(Date.now() + days * 86400000));

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

    // Backdrop click to close
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
