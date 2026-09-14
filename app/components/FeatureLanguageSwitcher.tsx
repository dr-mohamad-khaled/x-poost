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
        padding: "16px",
        marginBottom: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#f4f4f5",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>{i18n.featureLangTitle || "Feature Copy Language"}</span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: activeMeta.dir === "rtl" ? "#3b1d22" : "#1e293b",
                color: activeMeta.dir === "rtl" ? "#fca5a5" : "#93c5fd",
                fontWeight: 500,
              }}
            >
              {activeMeta.dir === "rtl" ? "RTL Layout" : "LTR Layout"}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "2px" }}>
            {i18n.featureLangSubtitle || "Select a language to edit its text or load predefined copy:"}
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
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 500,
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

      {/* Language Pills Bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          padding: "4px",
          background: "#09090b",
          borderRadius: "8px",
          border: "1px solid #1f1f23",
        }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = lang.code === selectedLang;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onSelectLang(lang.code)}
              style={{
                flex: "1 1 auto",
                minWidth: "100px",
                padding: "8px 12px",
                borderRadius: "6px",
                border: isSelected ? "1px solid #D4AF37" : "1px solid transparent",
                background: isSelected ? "rgba(212, 175, 55, 0.12)" : "transparent",
                color: isSelected ? "#F3E5AB" : "#a1a1aa",
                fontSize: "13px",
                fontWeight: isSelected ? 600 : 400,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontSize: "13px" }}>{lang.nativeName}</div>
              <div
                style={{
                  fontSize: "10px",
                  color: isSelected ? "#D4AF37" : "#71717a",
                  textTransform: "uppercase",
                  marginTop: "1px",
                }}
              >
                {lang.label} ({lang.code})
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FeatureLanguageSwitcher;
