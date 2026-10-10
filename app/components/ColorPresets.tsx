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
 * "warm" is the default for new setups; "classic" is the original black & gold.
 */
export const PALETTES: Palette[] = [
  {
    id: "warm",
    name: "Warm Taupe & Champagne",
    bg: "#2E2823",
    surface: "#352E28",
    track: "#4A4238",
    border: "#4A4238",
    accent: "#D9C9A8",
    text: "#F6F1E7",
    onAccent: "#2E2823",
  },
  {
    id: "cream",
    name: "Warm Cream & Bronze",
    bg: "#F6F1E7",
    surface: "#FFFFFF",
    track: "#E2D8C6",
    border: "#D9CDB8",
    accent: "#8C6B4B",
    text: "#2B2620",
    onAccent: "#FFFFFF",
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
      <div style={{ fontSize: 12, color: "#A39E91", marginBottom: 8 }}>
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
              border: "1px solid #3A352B",
              background: "#1D1A14",
              color: "#E9DFC8",
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
