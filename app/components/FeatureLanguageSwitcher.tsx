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
        background: "linear-gradient(180deg, #1D150C 0%, #1B110A 100%)",
        border: "1px solid #322817",
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
            <div style={{ fontSize: "11px", color: "#9E957B" }}>
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
                color: "#FFEB97",
                border: "1px solid #E8C872",
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
                  style={{ background: "#1D150C", color: "#f4f4f5" }}
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
                background: activeMeta.dir === "rtl" ? "#3b1d22" : "#352B19",
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
              background: "#322817",
              color: "#E5D8B3",
              border: "1px solid #4D3B22",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#E8C872";
              e.currentTarget.style.color = "#E8C872";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#4D3B22";
              e.currentTarget.style.color = "#E5D8B3";
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

