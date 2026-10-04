(function () {
  "use strict";

  function xpTrack(f, e, opts) {
    try { if (window.XPT) window.XPT.track(f, e, opts); } catch (err) {}
  }
  function xpObserve(el, f, opts) {
    try { if (window.XPT && el) window.XPT.observe(el, f, opts); } catch (err) {}
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
  ICONS.x = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>';
  ICONS.pinterest = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>';
  ICONS.youtube = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>';
  ICONS.linkedin = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
  ICONS.snapchat = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/></svg>';
  ICONS.telegram = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';
  ICONS.threads = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/></svg>';
  ICONS.discord = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';
  ICONS.reddit = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"/></svg>';
  ICONS.twitch = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>';

  // Every social network the bar can show. A network is shown only when it has a link.
  var NETWORKS = [
    { k: "instagram", f: "instagramUrl", l: "Instagram" },
    { k: "tiktok", f: "tiktokUrl", l: "TikTok" },
    { k: "facebook", f: "facebookUrl", l: "Facebook" },
    { k: "x", l: "X" },
    { k: "pinterest", l: "Pinterest" },
    { k: "youtube", l: "YouTube" },
    { k: "linkedin", l: "LinkedIn" },
    { k: "snapchat", l: "Snapchat" },
    { k: "telegram", l: "Telegram" },
    { k: "threads", l: "Threads" },
    { k: "discord", l: "Discord" },
    { k: "reddit", l: "Reddit" },
    { k: "twitch", l: "Twitch" }
  ];

  // Accept only http(s) links (adds https:// to bare domains); anything else is dropped.
  function safeUrl(u) {
    u = String(u == null ? "" : u).trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    if (/^[\w-]+(\.[\w-]+)+(\/|$|\?|#)/i.test(u)) return "https://" + u;
    return "";
  }

  function getSocials(config) {
    var list = [];
    NETWORKS.forEach(function (n) {
      var raw = n.f ? config[n.f] : (config.networks && config.networks[n.k]);
      var url = safeUrl(raw);
      if (url && ICONS[n.k]) list.push({ k: n.k, l: n.l, url: url, icon: ICONS[n.k] });
    });
    return list;
  }

  function socialAnchors(list, cls, withLabel) {
    return list.map(function (n) {
      return '<a href="' + escapeHtml(n.url) + '" target="_blank" rel="noreferrer noopener" class="' + cls + '" data-net="' + n.k + '" title="' + n.l + '">' +
        (withLabel
          ? '<span class="xpsb-stack-sm-icon">' + n.icon + '</span><span>Follow on ' + n.l + '</span><span class="xpsb-stack-sub-arrow">\u2192</span>'
          : n.icon) +
        '</a>';
    }).join("");
  }


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

  // Quick-inquiry options for the support chat. Each option opens WhatsApp with its own ready-made message.
  var INQUIRIES = {
    en: { title: "How can we help you?", other: "Ask something else", opts: [
      ["Track my order", "Hi, I would like to track my order."],
      ["Product advice", "Hi, I need help choosing the right product."],
      ["Return request", "Hi, I would like to request a return for my order."],
      ["Shipping & delivery", "Hi, I have a question about shipping and delivery."],
      ["Discounts & offers", "Hi, are there any active discounts or offers today?"],
      ["Payment or order issue", "Hi, I have a problem with my payment or order."]
    ] },
    ar: { title: "\u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u0627 \u0645\u0633\u0627\u0639\u062f\u062a\u0643\u061f", other: "\u0633\u0624\u0627\u0644 \u0622\u062e\u0631", opts: [
      ["\u062a\u062a\u0628\u0639 \u0637\u0644\u0628\u064a", "\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0623\u0648\u062f \u062a\u062a\u0628\u0639 \u0637\u0644\u0628\u064a."],
      ["\u0646\u0635\u064a\u062d\u0629 \u0628\u062e\u0635\u0648\u0635 \u0645\u0646\u062a\u062c", "\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0623\u062d\u062a\u0627\u062c \u0645\u0633\u0627\u0639\u062f\u0629 \u0641\u064a \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0645\u0646\u062a\u062c \u0627\u0644\u0645\u0646\u0627\u0633\u0628."],
      ["\u0637\u0644\u0628 \u0625\u0631\u062c\u0627\u0639", "\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0623\u0648\u062f \u0637\u0644\u0628 \u0625\u0631\u062c\u0627\u0639 \u0644\u0637\u0644\u0628\u064a."],
      ["\u0627\u0644\u0634\u062d\u0646 \u0648\u0627\u0644\u062a\u0648\u0635\u064a\u0644", "\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0644\u062f\u064a \u0633\u0624\u0627\u0644 \u0639\u0646 \u0627\u0644\u0634\u062d\u0646 \u0648\u0627\u0644\u062a\u0648\u0635\u064a\u0644."],
      ["\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a \u0648\u0627\u0644\u0639\u0631\u0648\u0636", "\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0647\u0644 \u062a\u0648\u062c\u062f \u062e\u0635\u0648\u0645\u0627\u062a \u0623\u0648 \u0639\u0631\u0648\u0636 \u0645\u062a\u0627\u062d\u0629 \u0627\u0644\u064a\u0648\u0645\u061f"],
      ["\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u062f\u0641\u0639 \u0623\u0648 \u0627\u0644\u0637\u0644\u0628", "\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0644\u062f\u064a \u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u062f\u0641\u0639 \u0623\u0648 \u0641\u064a \u0637\u0644\u0628\u064a."]
    ] },
    fr: { title: "Comment pouvons-nous vous aider ?", other: "Poser une autre question", opts: [
      ["Suivre ma commande", "Bonjour, je souhaite suivre ma commande."],
      ["Conseil produit", "Bonjour, j'ai besoin d'aide pour choisir le bon produit."],
      ["Demande de retour", "Bonjour, je souhaite demander un retour pour ma commande."],
      ["Livraison et exp\u00e9dition", "Bonjour, j'ai une question sur la livraison et l'exp\u00e9dition."],
      ["Promotions et offres", "Bonjour, y a-t-il des promotions ou des offres en cours aujourd'hui ?"],
      ["Probl\u00e8me de paiement ou de commande", "Bonjour, j'ai un probl\u00e8me avec mon paiement ou ma commande."]
    ] },
    de: { title: "Wie k\u00f6nnen wir Ihnen helfen?", other: "Andere Frage stellen", opts: [
      ["Bestellung verfolgen", "Hallo, ich m\u00f6chte meine Bestellung verfolgen."],
      ["Produktberatung", "Hallo, ich brauche Hilfe bei der Auswahl des richtigen Produkts."],
      ["R\u00fccksendung anfragen", "Hallo, ich m\u00f6chte eine R\u00fccksendung f\u00fcr meine Bestellung anfragen."],
      ["Versand & Lieferung", "Hallo, ich habe eine Frage zu Versand und Lieferung."],
      ["Rabatte & Angebote", "Hallo, gibt es heute aktuelle Rabatte oder Angebote?"],
      ["Zahlungs- oder Bestellproblem", "Hallo, ich habe ein Problem mit meiner Zahlung oder Bestellung."]
    ] },
    es: { title: "\u00bfC\u00f3mo podemos ayudarte?", other: "Hacer otra pregunta", opts: [
      ["Rastrear mi pedido", "Hola, me gustar\u00eda rastrear mi pedido."],
      ["Asesor\u00eda de producto", "Hola, necesito ayuda para elegir el producto adecuado."],
      ["Solicitar una devoluci\u00f3n", "Hola, quisiera solicitar una devoluci\u00f3n de mi pedido."],
      ["Env\u00edo y entrega", "Hola, tengo una pregunta sobre el env\u00edo y la entrega."],
      ["Descuentos y ofertas", "Hola, \u00bfhay descuentos u ofertas activos hoy?"],
      ["Problema de pago o pedido", "Hola, tengo un problema con mi pago o mi pedido."]
    ] },
    it: { title: "Come possiamo aiutarti?", other: "Fai un'altra domanda", opts: [
      ["Traccia il mio ordine", "Ciao, vorrei tracciare il mio ordine."],
      ["Consigli sui prodotti", "Ciao, ho bisogno di aiuto per scegliere il prodotto giusto."],
      ["Richiesta di reso", "Ciao, vorrei richiedere un reso per il mio ordine."],
      ["Spedizione e consegna", "Ciao, ho una domanda sulla spedizione e sulla consegna."],
      ["Sconti e offerte", "Ciao, ci sono sconti o offerte attive oggi?"],
      ["Problema di pagamento o ordine", "Ciao, ho un problema con il pagamento o con il mio ordine."]
    ] },
    pt: { title: "Como podemos ajudar?", other: "Fazer outra pergunta", opts: [
      ["Rastrear meu pedido", "Ol\u00e1, gostaria de rastrear meu pedido."],
      ["Orienta\u00e7\u00e3o sobre produtos", "Ol\u00e1, preciso de ajuda para escolher o produto certo."],
      ["Solicitar devolu\u00e7\u00e3o", "Ol\u00e1, gostaria de solicitar a devolu\u00e7\u00e3o do meu pedido."],
      ["Envio e entrega", "Ol\u00e1, tenho uma d\u00favida sobre envio e entrega."],
      ["Descontos e ofertas", "Ol\u00e1, h\u00e1 descontos ou ofertas ativos hoje?"],
      ["Problema com pagamento ou pedido", "Ol\u00e1, estou com um problema no pagamento ou no meu pedido."]
    ] }
  };

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

    var socials = getSocials(config);

    // Nothing configured: don't show an empty button / popup on the storefront.
    if (!waClean && !config.vipCommunityUrl && !socials.length) {
      mount.innerHTML = "";
      mount.style.display = "none";
      return;
    }
    mount.style.display = "";

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
          ? '<a href="' + escapeHtml(safeUrl(config.vipCommunityUrl)) + '" target="_blank" rel="noreferrer" class="xpsb-stack-btn xpsb-stack-btn-vip">' +
            '<span class="xpsb-stack-icon">' + ICONS.crown + '</span>' +
            '<div class="xpsb-stack-info"><strong>' + escapeHtml(config.vipCommunityLabel || "Join VIP Deals") + '</strong><small>Exclusive Secret Drops & Offers</small></div>' +
            '<span class="xpsb-stack-badge">VIP PASS</span>' +
            '</a>'
          : "") +
        (socials.length ? '<div class="xpsb-stack-social-list">' + socialAnchors(socials, 'xpsb-stack-social-item', true) + '</div>' : '') +
        '</div>';
    }
    // LAYOUT 2: Concierge Card (Agent silhouette + Quick Inquiries)
    else if (layoutStyle === "concierge_card") {
      // Quick inquiries: each option opens WhatsApp with its own tailored message
      var inq = INQUIRIES[detectStorefrontLocale(mount)] || INQUIRIES.en;
      var inqOpts = inq.opts.concat([[inq.other, config.whatsappMessage || INQUIRIES.en.opts[0][1]]]);
      var inqRows = waClean ? inqOpts.map(function (o) {
        return '<a href="https://wa.me/' + waClean + '?text=' + encodeURIComponent(o[1]) + '" target="_blank" rel="noreferrer noopener" class="xpsb-inq-item" data-inq="1">' +
          '<span>' + escapeHtml(o[0]) + '</span><span class="xpsb-stack-sub-arrow">\u2192</span></a>';
      }).join("") : "";

      var conciergeSocialRow = "";
      if (socials.length) {
        conciergeSocialRow = '<div class="xpsb-concierge-social-row">' +
          socialAnchors(socials, 'xpsb-social-circle-btn', false) +
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
        (waClean
          ? '<button type="button" class="xpsb-wa-btn xpsb-inq-toggle" id="xpsb-inq-toggle" aria-expanded="false" aria-controls="xpsb-inq">' +
            ICONS.whatsapp +
            '<div class="xpsb-wa-text"><strong>Chat with Customer Support</strong><small>Typically replies in minutes</small></div>' +
            '<span class="xpsb-stack-arrow xpsb-inq-chevron">\u2192</span>' +
            '</button>' +
            '<div class="xpsb-inq" id="xpsb-inq" hidden>' +
            '<div class="xpsb-inq-title">' + escapeHtml(inq.title) + '</div>' +
            inqRows +
            '</div>'
          : "") +
        (config.vipCommunityUrl
          ? '<a href="' + escapeHtml(safeUrl(config.vipCommunityUrl)) + '" target="_blank" rel="noreferrer" class="xpsb-vip-card">' +
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
      if (socials.length) {
        funnelSocialRow = '<div class="xpsb-funnel-social-follow">' +
          '<div class="xpsb-funnel-social-label">Follow Our Official Channels:</div>' +
          '<div class="xpsb-concierge-social-row">' +
          socialAnchors(socials, 'xpsb-social-circle-btn', false) +
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
          ? '<a href="' + escapeHtml(safeUrl(config.vipCommunityUrl)) + '" target="_blank" rel="noreferrer" class="xpsb-vip-claim-btn">Claim VIP Membership →</a>'
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
      var socialDockBtns = socialAnchors(socials, "xpsb-dock-social-btn", false);

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
          ? '<a href="' + escapeHtml(safeUrl(config.vipCommunityUrl)) + '" target="_blank" rel="noreferrer" class="xpsb-dock-pill xpsb-dock-pill-vip">' +
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
      xpObserve(trigger, "so");
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        if (deck && !deck.classList.contains("is-open")) xpTrack("so", "c", { d: "open" });
        toggleDeck();
      });
    }

    // Analytics: which channel shoppers pick
    mount.addEventListener("click", function (e) {
      var link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!link || !mount.contains(link)) return;
      var href = (link.getAttribute("href") || "").toLowerCase();
      var channel = "other";
      if (href.indexOf("wa.me") !== -1 || href.indexOf("whatsapp") !== -1) {
        channel = (link.classList.contains("xpsb-chip") || link.hasAttribute("data-inq")) ? "whatsapp_quick" : "whatsapp";
      } else if (link.getAttribute("data-net")) channel = link.getAttribute("data-net");
      else if (config.vipCommunityUrl && href === safeUrl(config.vipCommunityUrl).toLowerCase()) channel = "vip";
      xpTrack("so", "a", { d: channel });
    });

    var inqToggle = mount.querySelector("#xpsb-inq-toggle");
    var inqPanel = mount.querySelector("#xpsb-inq");
    if (inqToggle && inqPanel) {
      inqToggle.addEventListener("click", function (e) {
        e.preventDefault();
        var open = inqPanel.hasAttribute("hidden");
        if (open) inqPanel.removeAttribute("hidden"); else inqPanel.setAttribute("hidden", "");
        inqToggle.setAttribute("aria-expanded", open ? "true" : "false");
        inqToggle.classList.toggle("is-open", open);
        if (open) xpTrack("so", "a", { d: "support_menu" });
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
