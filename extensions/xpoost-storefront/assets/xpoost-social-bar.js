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

  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.14c-1.52 0-3-.4-4.3-1.17l-.31-.18-3.19.84.85-3.11-.2-.32a8.16 8.16 0 0 1-1.25-4.29c0-4.51 3.67-8.18 8.18-8.18 2.19 0 4.24.85 5.79 2.4 1.54 1.55 2.4 3.61 2.4 5.79 0 4.51-3.67 8.19-8.17 8.19z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.02 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.05 3.25-1.57 3.32-3.38.07-2.87.03-5.75.04-8.62.01-3.21-.01-6.42.02-9.63z"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
  };

  function initSocialBar() {
    var mount = document.getElementById("xpoost-social-bar");
    if (!mount) return;

    var proxyPath = mount.getAttribute("data-proxy-path") || "/apps/xpoost/config";

    var loadConfig = window.__xpoost_load_config || function (p) {
      return fetch(p, { credentials: "same-origin" }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    };

    var loc = detectStorefrontLocale(mount); loadConfig(proxyPath + (proxyPath.indexOf("?") === -1 ? "?" : "&") + "locale=" + encodeURIComponent(loc), mount)
      .then(function (data) {
        var config = data?.features?.social;
        if (!config || !config.active) return;
        renderSocialBar(mount, config);
      })
      .catch(function (err) {
        console.warn("[XPoost] Social bar init skipped:", err);
      });
  }

  function renderSocialBar(mount, config) {
    var position = config.position || "bottom-right";
    var designTheme = config.designTheme || "gold_luxury";
    var layoutStyle = config.layoutStyle || "action_stack";

    mount.className = "xpoost-social-bar xpoost-social-bar--" + position + " xpoost-social-bar--theme-" + designTheme + " xpoost-social-bar--layout-" + layoutStyle;

    var bottomDesktop = (config.bottomOffsetPx != null ? config.bottomOffsetPx : 24) + "px";
    var bottomMobile = (config.mobileBottomOffsetPx != null ? config.mobileBottomOffsetPx : 24) + "px";
    mount.style.setProperty("--xpsb-bottom-desktop", bottomDesktop);
    mount.style.setProperty("--xpsb-bottom-mobile", bottomMobile);
    mount.style.setProperty("--xpsb-bg", config.backgroundColor || "#0B0B0B");
    mount.style.setProperty("--xpsb-gold", config.accentColor || "#D4AF37");
    mount.style.setProperty("--xpsb-text", config.textColor || "#FFFFFF");

    var waClean = (config.whatsappNumber || "").replace(/[^0-9]/g, "");
    var waMsg = encodeURIComponent(config.whatsappMessage || "Hi, I have a question!");
    var waUrl = waClean ? "https://wa.me/" + waClean + "?text=" + waMsg : "";

    var deckHtml = "";

    // LAYOUT 1: Action Stack (Multi-layered buttons)
    if (layoutStyle === "action_stack") {
      deckHtml =
        '<div class="xpsb-deck xpsb-deck--stack" id="xpsb-deck">' +
        '<div class="xpsb-deck-header">' +
        '<span class="xpsb-deck-title">Quick Actions</span>' +
        '<button type="button" class="xpsb-deck-close" id="xpsb-close" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        (waUrl
          ? '<a href="' + waUrl + '" target="_blank" rel="noreferrer" class="xpsb-stack-btn xpsb-stack-btn-wa">' +
            '<span class="xpsb-stack-icon">' + ICONS.whatsapp + '</span>' +
            '<div class="xpsb-stack-info"><strong>Chat on WhatsApp</strong><small>Instant reply under 2 mins</small></div>' +
            '<span class="xpsb-stack-arrow">→</span>' +
            '</a>'
          : "") +
        (config.vipCommunityUrl
          ? '<a href="' + escapeHtml(config.vipCommunityUrl) + '" target="_blank" rel="noreferrer" class="xpsb-stack-btn xpsb-stack-btn-vip">' +
            '<span class="xpsb-stack-icon">' + ICONS.crown + '</span>' +
            '<div class="xpsb-stack-info"><strong>' + escapeHtml(config.vipCommunityLabel || "Join VIP Deals") + '</strong><small>Exclusive Secret Drops & Offers</small></div>' +
            '<span class="xpsb-stack-badge">VIP PASS</span>' +
            '</a>'
          : "") +
        '<div class="xpsb-stack-social-list">' +
        (config.instagramUrl ? '<a href="' + escapeHtml(config.instagramUrl) + '" target="_blank" rel="noreferrer" class="xpsb-stack-social-item"><span class="xpsb-stack-sm-icon">' + ICONS.instagram + '</span><span>Follow on Instagram</span><span class="xpsb-stack-sub-arrow">→</span></a>' : "") +
        (config.tiktokUrl ? '<a href="' + escapeHtml(config.tiktokUrl) + '" target="_blank" rel="noreferrer" class="xpsb-stack-social-item"><span class="xpsb-stack-sm-icon">' + ICONS.tiktok + '</span><span>Follow on TikTok</span><span class="xpsb-stack-sub-arrow">→</span></a>' : "") +
        (config.facebookUrl ? '<a href="' + escapeHtml(config.facebookUrl) + '" target="_blank" rel="noreferrer" class="xpsb-stack-social-item"><span class="xpsb-stack-sm-icon">' + ICONS.facebook + '</span><span>Follow on Facebook</span><span class="xpsb-stack-sub-arrow">→</span></a>' : "") +
        '</div>' +
        '</div>';
    }
    // LAYOUT 2: Concierge Card (Agent silhouette + Quick Inquiries)
    else if (layoutStyle === "concierge_card") {
      var trackMsg = waClean ? "https://wa.me/" + waClean + "?text=" + encodeURIComponent("Hi, I would like to track my order.") : "#";
      var adviceMsg = waClean ? "https://wa.me/" + waClean + "?text=" + encodeURIComponent("Hi, I need assistance picking a product.") : "#";
      var discMsg = waClean ? "https://wa.me/" + waClean + "?text=" + encodeURIComponent("Hi, are there any active discount offers today?") : "#";

      var conciergeSocialRow = "";
      if (config.instagramUrl || config.tiktokUrl || config.facebookUrl) {
        conciergeSocialRow = '<div class="xpsb-concierge-social-row">' +
          (config.instagramUrl ? '<a href="' + escapeHtml(config.instagramUrl) + '" target="_blank" rel="noreferrer" class="xpsb-social-circle-btn" title="Instagram">' + ICONS.instagram + '</a>' : '') +
          (config.tiktokUrl ? '<a href="' + escapeHtml(config.tiktokUrl) + '" target="_blank" rel="noreferrer" class="xpsb-social-circle-btn" title="TikTok">' + ICONS.tiktok + '</a>' : '') +
          (config.facebookUrl ? '<a href="' + escapeHtml(config.facebookUrl) + '" target="_blank" rel="noreferrer" class="xpsb-social-circle-btn" title="Facebook">' + ICONS.facebook + '</a>' : '') +
          '</div>';
      }

      deckHtml =
        '<div class="xpsb-deck xpsb-deck--concierge" id="xpsb-deck">' +
        '<div class="xpsb-concierge-header">' +
        '<div class="xpsb-concierge-avatar">' + ICONS.user + '<span class="xpsb-live-dot"></span></div>' +
        '<div class="xpsb-concierge-meta">' +
        '<div class="xpsb-concierge-name">Customer Support</div>' +
        '<div class="xpsb-concierge-status">Online Now - Fast Response</div>' +
        '</div>' +
        '<button type="button" class="xpsb-deck-close" id="xpsb-close" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        (waUrl
          ? '<a href="' + waUrl + '" target="_blank" rel="noreferrer" class="xpsb-wa-btn">' +
            ICONS.whatsapp +
            '<div class="xpsb-wa-text"><strong>Chat with Customer Support</strong><small>Typically replies in minutes</small></div>' +
            '<span class="xpsb-stack-arrow">→</span>' +
            '</a>'
          : "") +
        '<div class="xpsb-chips-label">Quick Inquiries:</div>' +
        '<div class="xpsb-chips-row">' +
        (waClean ? '<a href="' + trackMsg + '" target="_blank" rel="noreferrer" class="xpsb-chip">Track My Order</a>' : '') +
        (waClean ? '<a href="' + adviceMsg + '" target="_blank" rel="noreferrer" class="xpsb-chip">Product Advice</a>' : '') +
        (waClean ? '<a href="' + discMsg + '" target="_blank" rel="noreferrer" class="xpsb-chip">Discount Help</a>' : '') +
        '</div>' +
        (config.vipCommunityUrl
          ? '<a href="' + escapeHtml(config.vipCommunityUrl) + '" target="_blank" rel="noreferrer" class="xpsb-vip-card">' +
            '<div class="xpsb-vip-card-top">' +
            '<span class="xpsb-vip-badge">VIP PASS</span>' +
            ICONS.crown +
            '</div>' +
            '<div class="xpsb-vip-text">' + escapeHtml(config.vipCommunityLabel || "Join VIP Group") + '</div>' +
            '<div class="xpsb-vip-sub">Unlock member-only secret drops →</div>' +
            '</a>'
          : "") +
        conciergeSocialRow +
        '</div>';
    }
    // LAYOUT 3: VIP Funnel (VIP Pass hero card + benefits checklist)
    else if (layoutStyle === "vip_funnel") {
      var funnelSocialRow = "";
      if (config.instagramUrl || config.tiktokUrl || config.facebookUrl) {
        funnelSocialRow = '<div class="xpsb-funnel-social-follow">' +
          '<div class="xpsb-funnel-social-label">Follow Our Official Channels:</div>' +
          '<div class="xpsb-concierge-social-row">' +
          (config.instagramUrl ? '<a href="' + escapeHtml(config.instagramUrl) + '" target="_blank" rel="noreferrer" class="xpsb-social-circle-btn" title="Instagram">' + ICONS.instagram + '</a>' : '') +
          (config.tiktokUrl ? '<a href="' + escapeHtml(config.tiktokUrl) + '" target="_blank" rel="noreferrer" class="xpsb-social-circle-btn" title="TikTok">' + ICONS.tiktok + '</a>' : '') +
          (config.facebookUrl ? '<a href="' + escapeHtml(config.facebookUrl) + '" target="_blank" rel="noreferrer" class="xpsb-social-circle-btn" title="Facebook">' + ICONS.facebook + '</a>' : '') +
          '</div></div>';
      }

      deckHtml =
        '<div class="xpsb-deck xpsb-deck--funnel" id="xpsb-deck">' +
        '<div class="xpsb-deck-header">' +
        '<span class="xpsb-deck-title">VIP Membership</span>' +
        '<button type="button" class="xpsb-deck-close" id="xpsb-close" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        '<div class="xpsb-vip-hero">' +
        '<div class="xpsb-vip-hero-top">' +
        '<span class="xpsb-vip-badge">VIP CLUB</span>' +
        '<span class="xpsb-vip-hero-note">MEMBERS ONLY</span>' +
        '</div>' +
        '<div class="xpsb-vip-hero-title">' + escapeHtml(config.vipCommunityLabel || "Join our VIP Deals Group") + '</div>' +
        '<ul class="xpsb-vip-checklist">' +
        '<li><span class="xpsb-check-ico">' + ICONS.check + '</span> Secret 20% flash drops & private deals</li>' +
        '<li><span class="xpsb-check-ico">' + ICONS.check + '</span> 24h early access to new releases</li>' +
        '<li><span class="xpsb-check-ico">' + ICONS.check + '</span> Member-only complimentary luxury gift sets</li>' +
        '</ul>' +
        (config.vipCommunityUrl
          ? '<a href="' + escapeHtml(config.vipCommunityUrl) + '" target="_blank" rel="noreferrer" class="xpsb-vip-claim-btn">Claim VIP Membership →</a>'
          : '') +
        '</div>' +
        (waUrl
          ? '<a href="' + waUrl + '" target="_blank" rel="noreferrer" class="xpsb-secondary-wa-btn">' +
            ICONS.whatsapp +
            '<span>Need personal advice? Chat on WhatsApp</span>' +
            '</a>'
          : '') +
        funnelSocialRow +
        '</div>';
    }
    // LAYOUT 4: Compact Horizontal Dock
    else if (layoutStyle === "compact_dock") {
      var socialDockBtns = "";
      if (config.instagramUrl) {
        socialDockBtns += '<a href="' + escapeHtml(config.instagramUrl) + '" target="_blank" rel="noreferrer" class="xpsb-dock-social-btn" title="Instagram">' + ICONS.instagram + '</a>';
      }
      if (config.tiktokUrl) {
        socialDockBtns += '<a href="' + escapeHtml(config.tiktokUrl) + '" target="_blank" rel="noreferrer" class="xpsb-dock-social-btn" title="TikTok">' + ICONS.tiktok + '</a>';
      }
      if (config.facebookUrl) {
        socialDockBtns += '<a href="' + escapeHtml(config.facebookUrl) + '" target="_blank" rel="noreferrer" class="xpsb-dock-social-btn" title="Facebook">' + ICONS.facebook + '</a>';
      }

      deckHtml =
        '<div class="xpsb-deck xpsb-deck--dock" id="xpsb-deck">' +
        '<div class="xpsb-dock-strip">' +
        (waUrl
          ? '<a href="' + waUrl + '" target="_blank" rel="noreferrer" class="xpsb-dock-pill xpsb-dock-pill-wa">' +
            ICONS.whatsapp +
            '<span>WhatsApp</span>' +
            '</a>'
          : '') +
        (waUrl && (config.vipCommunityUrl || socialDockBtns) ? '<div class="xpsb-dock-divider"></div>' : '') +
        (config.vipCommunityUrl
          ? '<a href="' + escapeHtml(config.vipCommunityUrl) + '" target="_blank" rel="noreferrer" class="xpsb-dock-pill xpsb-dock-pill-vip">' +
            ICONS.crown +
            '<span>' + escapeHtml(config.vipCommunityLabel || "VIP Deals") + '</span>' +
            '</a>'
          : '') +
        (config.vipCommunityUrl && socialDockBtns ? '<div class="xpsb-dock-divider"></div>' : '') +
        (socialDockBtns ? '<div class="xpsb-dock-social-group">' + socialDockBtns + '</div>' : '') +
        '<button type="button" class="xpsb-deck-close xpsb-dock-close" id="xpsb-close" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        '</div>';
    }

    var triggerHtml =
      '<button type="button" class="xpsb-trigger" id="xpsb-trigger" aria-expanded="false">' +
      '<span class="xpsb-icon-wrap">' + ICONS.chat + '</span>' +
      '<span class="xpsb-trigger-text">' + escapeHtml(config.badgeText || "Need help? Chat with us") + '</span>' +
      '</button>';

    mount.innerHTML = deckHtml + triggerHtml;

    var trigger = mount.querySelector("#xpsb-trigger");
    var deck = mount.querySelector("#xpsb-deck");
    var closeBtn = mount.querySelector("#xpsb-close");

    function toggleDeck(open) {
      if (!deck) return;
      var willOpen = open !== undefined ? open : !deck.classList.contains("is-open");
      if (willOpen) {
        deck.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      } else {
        deck.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      }
    }

    if (trigger) {
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleDeck();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleDeck(false);
      });
    }

    document.addEventListener("click", function (e) {
      if (!mount.contains(e.target)) {
        toggleDeck(false);
      }
    });
  }

  ready(initSocialBar);
})();
