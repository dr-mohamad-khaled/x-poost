import React from "react";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  DASHBOARD_I18N,
} from "../utils/translations";

interface FeatureLanguageSwitcherProps {
  selectedLang: SupportedLanguage;
  onSelectLang: (lang: SupportedLanguage) => void;
  onLoadPredefined?: () => void;
  dashboardLocale?: SupportedLanguage;
}

export function FeatureLanguageSwitcher({
  selectedLang,
  onSelectLang,
  onLoadPredefined,
  dashboardLocale = "en",
}: FeatureLanguageSwitcherProps) {
  const i18n = DASHBOARD_I18N[dashboardLocale] || DASHBOARD_I18N.en;
  const activeMeta = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #18181b 0%, #111113 100%)",
        border: "1px solid #27272a",
        borderRadius: "10px",
        padding: "14px 18px",
        marginBottom: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <label
              htmlFor="feature-lang-dropdown"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#f4f4f5",
                display: "block",
                marginBottom: "3px",
              }}
            >
              {i18n.featureLangTitle || "Feature Copy Language"}
            </label>
            <div style={{ fontSize: "11px", color: "#a1a1aa" }}>
              {i18n.featureLangSubtitle || "Select a language to edit its text or load predefined copy:"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <select
              id="feature-lang-dropdown"
              value={selectedLang}
              onChange={(e) => onSelectLang(e.target.value as SupportedLanguage)}
              style={{
                background: "#09090b",
                color: "#F3E5AB",
                border: "1px solid #D4AF37",
                borderRadius: "6px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
                minWidth: "180px",
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option
                  key={lang.code}
                  value={lang.code}
                  style={{ background: "#18181b", color: "#f4f4f5" }}
                >
                  {lang.nativeName} ({lang.label}) {lang.dir === "rtl" ? "[RTL]" : "[LTR]"}
                </option>
              ))}
            </select>

            <span
              style={{
                fontSize: "11px",
                padding: "4px 8px",
                borderRadius: "6px",
                background: activeMeta.dir === "rtl" ? "#3b1d22" : "#1e293b",
                color: activeMeta.dir === "rtl" ? "#fca5a5" : "#93c5fd",
                fontWeight: 600,
              }}
            >
              {activeMeta.dir === "rtl" ? "RTL" : "LTR"}
            </span>
          </div>
        </div>

        {onLoadPredefined && (
          <button
            type="button"
            onClick={onLoadPredefined}
            style={{
              background: "#27272a",
              color: "#e4e4e7",
              border: "1px solid #3f3f46",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#D4AF37";
              e.currentTarget.style.color = "#D4AF37";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#3f3f46";
              e.currentTarget.style.color = "#e4e4e7";
            }}
          >
            {i18n.btnLoadPredefined || "Load Predefined Values for this Language"}
          </button>
        )}
      </div>
    </div>
  );
}

export default FeatureLanguageSwitcher;

