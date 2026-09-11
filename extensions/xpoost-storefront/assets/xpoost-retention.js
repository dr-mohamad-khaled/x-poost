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

  function initRetention() {
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
        if (data.features?.exitIntent?.active) {
          setupExitIntent(data.features.exitIntent);
        }
      })
      .catch(function (err) {
        console.warn("[XPoost] Retention engine init skipped:", err);
      });
  }

  /* ─────────────────────────────────────────────────────────────
     Feature 6: Exit-Intent Countdown Saver Modal
     ───────────────────────────────────────────────────────────── */
  var exitTriggered = false;

  function setupExitIntent(config) {
    var storageKey = "xpoost_exit_saver_suppressed";
    var suppressedUntil = parseInt(localStorage.getItem(storageKey) || "0", 10);
    if (Date.now() < suppressedUntil) {
      return; // Under cool-down window
    }

    // Desktop: cursor exits top boundary
    document.addEventListener("mouseleave", function (e) {
      if (e.clientY <= 0 && !exitTriggered) {
        triggerExitModal(config, storageKey);
      }
    });

    // Mobile: rapid scroll up
    var lastScrollY = window.scrollY;
    var lastScrollTime = Date.now();
    window.addEventListener("scroll", function () {
      var currentY = window.scrollY;
      var now = Date.now();
      var timeDiff = now - lastScrollTime;

      if (timeDiff > 50 && timeDiff < 300) {
        var distance = currentY - lastScrollY;
        // Fast scroll upward (distance negative and speed high)
        if (distance < -150 && currentY < 800 && !exitTriggered) {
          triggerExitModal(config, storageKey);
        }
      }

      lastScrollY = currentY;
      lastScrollTime = now;
    }, { passive: true });
  }

  function triggerExitModal(config, storageKey) {
    if (exitTriggered) return;
    exitTriggered = true;

    var container = document.getElementById("xpoost-root") || document.body;
    var existing = container.querySelector(".xpr-exit-backdrop");
    if (existing) existing.remove();

    var code = config.discountCode || "SAVE10";
    var secondsLeft = config.countdownSeconds || 600;

    var html =
      '<div class="xpr-exit-backdrop is-open" id="xpr-exit-modal">' +
      '<div class="xpr-exit-modal" style="--xpr-bg:' + (config.backgroundColor || "#0B0B0B") + ';--xpr-gold:' + (config.accentColor || "#D4AF37") + ';--xpr-text:' + (config.textColor || "#fff") + ';">' +
      '<button type="button" class="xpr-exit-close" id="xpr-exit-close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
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
