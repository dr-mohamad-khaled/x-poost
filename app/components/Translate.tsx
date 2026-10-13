import { useOutletContext } from "react-router";
import UI_DICT from "../utils/ui_dict.json";

function decodeEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&rarr;/g, "→")
    .replace(/&larr;/g, "←")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#8734;/g, "∞")
    .replace(/&#10003;/g, "✓");
}

export function translateText(text: string, locale: string = "en"): string {
  if (!text) return "";
  const dict = (UI_DICT as Record<string, Record<string, string>>)[locale] || (UI_DICT as any).en || {};
  const normalized = text.replace(/\s+/g, " ").trim();
  const decoded = decodeEntities(normalized);

  const translated =
    dict[normalized] ||
    dict[decoded] ||
    dict[text] ||
    (locale === "en" ? decoded : undefined);

  if (translated) {
    let clean = decodeEntities(translated);
    if (locale === "ar") {
      clean = clean.replace(/→/g, "←");
    }
    return clean;
  }

  let fallback = decodeEntities(text);
  if (locale === "ar") {
    fallback = fallback.replace(/→/g, "←");
  }
  return fallback;
}

export function Translate({ text }: { text: string }) {
  const ctx = useOutletContext<{ dashboardLocale?: string }>();
  const locale = ctx?.dashboardLocale || "en";
  return <>{translateText(text, locale)}</>;
}

export function useTranslations() {
  const ctx = useOutletContext<{ dashboardLocale?: string }>();
  const locale = ctx?.dashboardLocale || "en";
  const t = (text: string) => translateText(text, locale);
  return { t };
}
