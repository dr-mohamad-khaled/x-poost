import { useEffect, useState } from "react";
import { useTranslations } from "./Translate";

/**
 * "Chat with support" for merchants, powered by the free tawk.to widget.
 * The widget script is loaded only when the merchant opens the chat, so the dashboard
 * stays fast and no third-party script runs until it's needed.
 * IDs come from the environment (TAWK_PROPERTY_ID / TAWK_WIDGET_ID); without them nothing renders.
 */
declare global {
  interface Window {
    Tawk_API?: any;
    Tawk_LoadStart?: Date;
  }
}

const ID_RE = /^[a-zA-Z0-9]{6,40}$/;

export function SupportChat({ propertyId, widgetId, shop }: { propertyId: string; widgetId: string; shop: string }) {
  const { t, isAr } = useTranslations();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const valid = ID_RE.test(propertyId) && ID_RE.test(widgetId);

  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => setState((s) => (s === "loading" ? "error" : s)), 15000);
    return () => clearTimeout(timer);
  }, [state]);

  if (!valid) return null;

  const open = () => {
    if (state === "ready" && window.Tawk_API?.maximize) {
      window.Tawk_API.maximize();
      return;
    }
    if (state === "loading") return;
    setState("loading");
    const api = (window.Tawk_API = window.Tawk_API || {});
    window.Tawk_LoadStart = new Date();
    api.customStyle = { visibility: { desktop: { position: isAr ? "bl" : "br", xOffset: 20, yOffset: 20 }, mobile: { position: isAr ? "bl" : "br", xOffset: 10, yOffset: 10 } } };
    api.onLoad = () => {
      setState("ready");
      try {
        api.setAttributes?.({ store: shop }, () => {});
        api.maximize?.();
      } catch {
        /* the chat still works without attributes */
      }
    };
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    s.onerror = () => setState("error");
    document.body.appendChild(s);
  };

  // Once tawk.to has loaded, its own bubble takes over
  if (state === "ready") return null;

  return (
    <button
      type="button"
      onClick={open}
      disabled={state === "loading"}
      aria-label={t("Chat with XPoost support")}
      style={{
        position: "fixed",
        bottom: 20,
        [isAr ? "left" : "right"]: 20,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "11px 18px",
        borderRadius: 999,
        border: "1px solid #E8C872",
        background: "linear-gradient(135deg, #FFEB97 0%, #E8C872 48%, #B8863B 100%)",
        color: "#111",
        fontWeight: 800,
        fontSize: 13,
        cursor: state === "loading" ? "wait" : "pointer",
        boxShadow: "0 8px 24px rgba(0,0,0,.45)",
        fontFamily: "inherit",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.2a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" />
      </svg>
      {state === "loading" ? t("Opening chat…") : state === "error" ? t("Chat unavailable. Try again") : t("Chat with support")}
    </button>
  );
}
