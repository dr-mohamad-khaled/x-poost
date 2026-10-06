import { useOutletContext } from "react-router";
import UI_DICT from "../utils/ui_dict.json";

export function Translate({ text }: { text: string }) {
  const ctx = useOutletContext<{ dashboardLocale?: string }>();
  const locale = ctx?.dashboardLocale || "en";
  // @ts-ignore
  return <>{UI_DICT[locale]?.[text] || text}</>;
}

export function useTranslations() {
  const ctx = useOutletContext<{ dashboardLocale?: string }>();
  const locale = ctx?.dashboardLocale || "en";
  const t = (text: string) => {
    // @ts-ignore
    return UI_DICT[locale]?.[text] || text;
  };
  return { t };
}
