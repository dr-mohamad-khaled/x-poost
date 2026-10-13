import React, { createContext, useContext } from "react";
import { useOutletContext } from "react-router";
import UI_DICT from "../utils/ui_dict.json";

function decodeEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&rarr;/g, "→")
    .replace(/&larr;/g, "←")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#8734;/g, "∞")
    .replace(/&#10003;/g, "✓")
    .replace(/\\u2192/g, "→")
    .replace(/\\u2190/g, "←");
}

export function translateText(
  text: string,
  locale: string = "en",
  params?: Record<string, string | number>
): string {
  if (!text) return "";
  const dict =
    (UI_DICT as Record<string, Record<string, string>>)[locale] ||
    (UI_DICT as any).en ||
    {};
  const normalized = text.replace(/\s+/g, " ").trim();
  const decoded = decodeEntities(normalized);

  const translated =
    dict[normalized] ||
    dict[decoded] ||
    dict[text] ||
    (locale === "en" ? decoded : undefined);

  let clean = translated ? decodeEntities(translated) : decodeEntities(text);
  if (locale === "ar") {
    clean = clean.replace(/→/g, "←");
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      clean = clean.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return clean;
}

export const TranslationContext = createContext<{ dashboardLocale?: string }>({
  dashboardLocale: "en",
});

export function TranslationProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <TranslationContext.Provider value={{ dashboardLocale: locale }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslations() {
  const ctx = useContext(TranslationContext);
  let outletCtx: { dashboardLocale?: string } | null = null;
  try {
    outletCtx = useOutletContext<{ dashboardLocale?: string }>();
  } catch {}
  const locale = ctx?.dashboardLocale || outletCtx?.dashboardLocale || "en";
  const t = (text: string, params?: Record<string, string | number>) =>
    translateText(text, locale, params);
  const isAr = locale === "ar";
  return { t, locale, isAr };
}

export function Translate({
  text,
  children,
  params,
}: {
  text?: string;
  children?: React.ReactNode;
  params?: Record<string, string | number>;
}) {
  const content = text || (typeof children === "string" ? children : "");
  const { t } = useTranslations();
  return <>{t(content, params)}</>;
}
