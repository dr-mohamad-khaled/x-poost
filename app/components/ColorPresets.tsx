import { Translate } from "./Translate";

export type Palette = {
  id: string;
  name: string;
  bg: string;
  surface: string;
  track: string;
  border: string;
  accent: string;
  text: string;
  onAccent: string;
};

/**
 * Ready-made colour palettes shared by every feature.
 * "neutral_dark" is the default for new setups; the merchant picks any other palette or custom colors.
 */
export const PALETTES: Palette[] = [
  {
    id: "neutral_dark",
    name: "Neutral Dark",
    bg: "#141414",
    surface: "#1C1C1C",
    track: "#3A3A3A",
    border: "#333333",
    accent: "#F2F2F2",
    text: "#FFFFFF",
    onAccent: "#141414",
  },
  {
    id: "neutral_light",
    name: "Neutral Light",
    bg: "#FFFFFF",
    surface: "#F7F7F7",
    track: "#E4E4E4",
    border: "#DCDCDC",
    accent: "#141414",
    text: "#141414",
    onAccent: "#FFFFFF",
  },
  {
    id: "gold",
    name: "Gold",
    bg: "#140E08",
    surface: "#1D150C",
    track: "#33261A",
    border: "#3A2B17",
    accent: "#E8C872",
    text: "#FFFFFF",
    onAccent: "#140E08",
  },

  {
    id: "classic",
    name: "Classic Black & Gold",
    bg: "#0B0B0B",
    surface: "#141414",
    track: "#222222",
    border: "#282828",
    accent: "#D4AF37",
    text: "#FFFFFF",
    onAccent: "#000000",
  },
];

export const DEFAULT_PALETTE = PALETTES[0];

/** A row of palette buttons. Each page decides which of its colour fields to fill. */
export function ColorPresets({ onApply }: { onApply: (p: Palette) => void }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#A89B80", marginBottom: 8 }}>
        <Translate text="Start from a ready-made palette, then fine-tune any color below." />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onApply(p)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #43331D",
              background: "#1D150C",
              color: "#FFEB97",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex" }}>
              {[p.bg, p.accent, p.text].map((c, i) => (
                <span
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: c,
                    border: "1px solid rgba(255,255,255,0.25)",
                    marginInlineStart: i === 0 ? 0 : -4,
                  }}
                />
              ))}
            </span>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
