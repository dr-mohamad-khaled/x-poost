import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";

const LAYOUT_STYLES = [
  {
    id: "action_stack",
    name: "Action Stack (Multi-Layer Buttons)",
    badge: "Recommended",
    description: "Stacked full-width tactile buttons for WhatsApp, VIP Deals, and dedicated social follow channels.",
  },
  {
    id: "concierge_card",
    name: "Live Support Portal",
    badge: "Support Focused",
    description: "Live agent header with online status beacon, quick-question chips, VIP pass, and WhatsApp chat.",
  },
  {
    id: "vip_funnel",
    name: "VIP Club & Remarketing Hub",
    badge: "High Conversion",
    description: "Prominent VIP club card with 3-point member benefits checklist, 1-click join CTA, and WhatsApp help.",
  },
  {
    id: "compact_dock",
    name: "Compact Horizontal Dock",
    badge: "Minimalist",
    description: "Floating horizontal capsule dock with direct WhatsApp CTA, VIP perks badge, and compact social tray.",
  },
];

const DESIGN_THEMES = [
  {
    id: "gold_luxury",
    name: "Royal Onyx & Gold",
    badge: "Luxury & Jewelry",
    bg: "#0B0B0B",
    accent: "#D4AF37",
    text: "#FFFFFF",
    description: "Opulent obsidian with 24K gold accents and warm amber neon glow.",
  },
  {
    id: "glassmorphism",
    name: "Frosted Crystal Glass",
    badge: "iOS / Translucent",
    bg: "#12141A",
    accent: "#60A5FA",
    text: "#FFFFFF",
    description: "Frosted translucent glass with blur and specular light border.",
  },
  {
    id: "rose_beauty",
    name: "Rose Gold & Silk",
    badge: "Cosmetics & Beauty",
    bg: "#1C0E14",
    accent: "#E8A598",
    text: "#FFFFFF",
    description: "Velvety berry undertone with champagne rose gold accents.",
  },
  {
    id: "emerald_care",
    name: "Emerald Support",
    badge: "Live Support",
    bg: "#062117",
    accent: "#25D366",
    text: "#FFFFFF",
    description: "Rich emerald background with vivid WhatsApp green pulse.",
  },
  {
    id: "midnight_minimal",
    name: "Midnight Stealth",
    badge: "Monochrome",
    bg: "#121212",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    description: "High-contrast stark monochrome with crisp razor borders.",
  },
  {
    id: "cyber_gradient",
    name: "Sunset Aurora",
    badge: "Neon Gradient",
    bg: "#110E1D",
    accent: "#FF5E7E",
    text: "#FFFFFF",
    description: "Dynamic sunset neon gradient border (Pink to Violet to Cyan).",
  },
];

function parsePosition(rawPos: string | null | undefined) {
  let side = "bottom-right";
  let bottomOffsetPx = 24;
  let mobileBottomOffsetPx = 24;
  let designTheme = "gold_luxury";
  let layoutStyle = "action_stack";

  if (rawPos) {
    if (rawPos.startsWith("{")) {
      try {
        const parsed = JSON.parse(rawPos);
        if (parsed.side) side = parsed.side;
        if (typeof parsed.bottomOffsetPx === "number" || typeof parsed.bottomOffsetPx === "string") {
          const b = parseInt(String(parsed.bottomOffsetPx), 10);
          if (!isNaN(b)) bottomOffsetPx = b;
        }
        if (typeof parsed.mobileBottomOffsetPx === "number" || typeof parsed.mobileBottomOffsetPx === "string") {
          const m = parseInt(String(parsed.mobileBottomOffsetPx), 10);
          if (!isNaN(m)) mobileBottomOffsetPx = m;
        }
        if (parsed.designTheme) designTheme = parsed.designTheme;
        if (parsed.layoutStyle) layoutStyle = parsed.layoutStyle;
      } catch {
        side = rawPos;
      }
    } else {
      side = rawPos;
    }
  }

  return { side, bottomOffsetPx, mobileBottomOffsetPx, designTheme, layoutStyle };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  let config = await prisma.socialWidgetConfig.findUnique({
    where: { shopId: shop.id },
  });

  if (!config) {
    config = await prisma.socialWidgetConfig.create({
      data: {
        shopId: shop.id,
        active: true,
        position: JSON.stringify({
          side: "bottom-right",
          bottomOffsetPx: 24,
          mobileBottomOffsetPx: 24,
          designTheme: "gold_luxury",
          layoutStyle: "action_stack",
        }),
        badgeText: "Need help? Chat with us",
        whatsappNumber: "+1234567890",
        whatsappMessage: "Hi, I have a question about my order!",
        instagramUrl: "https://instagram.com/yourstore",
        facebookUrl: "https://facebook.com/yourstore",
        tiktokUrl: "https://tiktok.com/@yourstore",
        vipCommunityLabel: "Join our VIP Deals Group",
        vipCommunityUrl: "https://t.me/yourvipgroup",
        backgroundColor: "#0B0B0B",
        accentColor: "#D4AF37",
        textColor: "#FFFFFF",
      },
    });
  }

  const parsedPos = parsePosition(config.position);

  return {
    shop,
    enabled: shop.socialBarEnabled,
    config,
    parsedPos,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();

  const active = formData.get("active") === "on";
  const side = String(formData.get("side") || "bottom-right");
  const bottomOffsetPx = Math.max(10, Math.min(300, parseInt(String(formData.get("bottomOffsetPx") || "24"), 10) || 24));
  const mobileBottomOffsetPx = Math.max(10, Math.min(300, parseInt(String(formData.get("mobileBottomOffsetPx") || "24"), 10) || 24));
  const designTheme = String(formData.get("designTheme") || "gold_luxury");
  const layoutStyle = String(formData.get("layoutStyle") || "action_stack");

  const position = JSON.stringify({
    side,
    bottomOffsetPx,
    mobileBottomOffsetPx,
    designTheme,
    layoutStyle,
  });

  const badgeText = String(formData.get("badgeText") || "Need help? Chat with us");
  const whatsappNumber = String(formData.get("whatsappNumber") || "").trim();
  const whatsappMessage = String(formData.get("whatsappMessage") || "").trim();
  const instagramUrl = String(formData.get("instagramUrl") || "").trim();
  const facebookUrl = String(formData.get("facebookUrl") || "").trim();
  const tiktokUrl = String(formData.get("tiktokUrl") || "").trim();
  const vipCommunityLabel = String(formData.get("vipCommunityLabel") || "Join our VIP Deals Group").trim();
  const vipCommunityUrl = String(formData.get("vipCommunityUrl") || "").trim();
  const backgroundColor = String(formData.get("backgroundColor") || "#0B0B0B");
  const accentColor = String(formData.get("accentColor") || "#D4AF37");
  const textColor = String(formData.get("textColor") || "#FFFFFF");

  await prisma.socialWidgetConfig.upsert({
    where: { shopId: shop.id },
    update: {
      active,
      position,
      badgeText,
      whatsappNumber,
      whatsappMessage,
      instagramUrl,
      facebookUrl,
      tiktokUrl,
      vipCommunityLabel,
      vipCommunityUrl,
      backgroundColor,
      accentColor,
      textColor,
    },
    create: {
      shopId: shop.id,
      active,
      position,
      badgeText,
      whatsappNumber,
      whatsappMessage,
      instagramUrl,
      facebookUrl,
      tiktokUrl,
      vipCommunityLabel,
      vipCommunityUrl,
      backgroundColor,
      accentColor,
      textColor,
    },
  });

  await prisma.shop.update({
    where: { id: shop.id },
    data: { socialBarEnabled: active },
  });

  return { ok: true, message: "Omnichannel Social & Support Bar settings saved!" };
};

export default function SocialBarSettings() {
  const { config, parsedPos } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedLayout, setSelectedLayout] = useState<string>(parsedPos.layoutStyle || "action_stack");
  const [selectedTheme, setSelectedTheme] = useState<string>(parsedPos.designTheme || "gold_luxury");
  const [side, setSide] = useState<string>(parsedPos.side || "bottom-right");
  const [desktopOffset, setDesktopOffset] = useState<number>(parsedPos.bottomOffsetPx || 24);
  const [mobileOffset, setMobileOffset] = useState<number>(parsedPos.mobileBottomOffsetPx || 24);

  const [badgeText, setBadgeText] = useState(config.badgeText || "Need help? Chat with us");
  const [waNumber, setWaNumber] = useState(config.whatsappNumber || "+1234567890");
  const [waMsg, setWaMsg] = useState(config.whatsappMessage || "Hi, I have a question about my order!");
  const [vipLabel, setVipLabel] = useState(config.vipCommunityLabel || "Join our VIP Deals Group");
  const [accentColor, setAccentColor] = useState(config.accentColor || "#D4AF37");
  const [bgColor, setBgColor] = useState(config.backgroundColor || "#0B0B0B");
  const [textColor, setTextColor] = useState(config.textColor || "#FFFFFF");

  const cleanWaNumber = waNumber.replace(/[^0-9]/g, "");
  const waUrl = cleanWaNumber ? `https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(waMsg)}` : "#";

  const handleSelectTheme = (theme: typeof DESIGN_THEMES[number]) => {
    setSelectedTheme(theme.id);
    setBgColor(theme.bg);
    setAccentColor(theme.accent);
    setTextColor(theme.text);
  };

  return (
    <s-page heading="Omnichannel Social & Support Action Bar">
      <style>{SOCIAL_BAR_STYLES}</style>

      {actionData && "ok" in actionData ? (
        <s-banner tone="success">{actionData.message}</s-banner>
      ) : null}

      <div className="xp-social-layout">
        <div className="xp-social-config">
          <Form method="post" className="xp-form">
            <input type="hidden" name="layoutStyle" value={selectedLayout} />
            <input type="hidden" name="designTheme" value={selectedTheme} />

            {/* Layout Architecture Selection */}
            <s-section heading="1. Choose Layout Architecture">
              <p className="xp-section-intro">
                Select the structural arrangement for your action bar. Each layout provides a completely different layout flow, button structure, and customer experience.
              </p>
              <div className="xp-layouts-grid">
                {LAYOUT_STYLES.map((layout) => {
                  const isSelected = selectedLayout === layout.id;
                  return (
                    <div
                      key={layout.id}
                      className={`xp-layout-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedLayout(layout.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="xp-layout-header">
                        <span className="xp-layout-badge">{layout.badge}</span>
                        {isSelected && <span className="xp-theme-check">Selected</span>}
                      </div>
                      <h4 className="xp-layout-title">{layout.name}</h4>
                      <p className="xp-layout-desc">{layout.description}</p>
                    </div>
                  );
                })}
              </div>
            </s-section>

            {/* Design Theme Selection */}
            <s-section heading="2. Choose Color Theme">
              <p className="xp-section-intro">
                Choose the visual surface material and color palette to match your store branding.
              </p>
              <div className="xp-themes-grid">
                {DESIGN_THEMES.map((theme) => {
                  const isSelected = selectedTheme === theme.id;
                  return (
                    <div
                      key={theme.id}
                      className={`xp-theme-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectTheme(theme)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="xp-theme-header">
                        <span className="xp-theme-badge">{theme.badge}</span>
                        {isSelected && <span className="xp-theme-check">Selected</span>}
                      </div>
                      <h4 className="xp-theme-title">{theme.name}</h4>
                      <p className="xp-theme-desc">{theme.description}</p>
                      <div className="xp-theme-palette">
                        <span className="xp-swatch" style={{ background: theme.bg }} title="Background" />
                        <span className="xp-swatch" style={{ background: theme.accent }} title="Accent" />
                        <span className="xp-swatch" style={{ background: theme.text }} title="Text" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </s-section>

            {/* Placement & Vertical Offset Controls */}
            <s-section heading="3. Position & Vertical Offset Adjustments">
              <p className="xp-section-intro">
                Set exact vertical clearance on Desktop and Mobile to avoid overlapping sticky bottom bars, cart buttons, or navigation docks.
              </p>

              <div className="xp-grid-2">
                <div className="xp-field">
                  <label>Screen Anchor Position</label>
                  <select
                    name="side"
                    className="xp-input"
                    value={side}
                    onChange={(e) => setSide(e.target.value)}
                  >
                    <option value="bottom-right">Bottom Right (Standard)</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>

                <div className="xp-field">
                  <label>Collapsed Button Label</label>
                  <input
                    type="text"
                    name="badgeText"
                    className="xp-input"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                  />
                </div>
              </div>

              {/* Desktop Vertical Offset Slider */}
              <div className="xp-offset-box">
                <div className="xp-offset-header">
                  <div>
                    <label className="xp-offset-label">Desktop Bottom Distance</label>
                    <small>Vertical distance from bottom edge of desktop screens</small>
                  </div>
                  <div className="xp-offset-val-wrap">
                    <input
                      type="number"
                      name="bottomOffsetPx"
                      min={10}
                      max={300}
                      className="xp-offset-number"
                      value={desktopOffset}
                      onChange={(e) => setDesktopOffset(Number(e.target.value))}
                    />
                    <span>px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={250}
                  step={2}
                  className="xp-range-slider"
                  value={desktopOffset}
                  onChange={(e) => setDesktopOffset(Number(e.target.value))}
                />
                <div className="xp-offset-presets">
                  <span className="xp-preset-label">Presets:</span>
                  <button type="button" className="xp-preset-btn" onClick={() => setDesktopOffset(24)}>Default (24px)</button>
                  <button type="button" className="xp-preset-btn" onClick={() => setDesktopOffset(70)}>Above Sticky Bar (70px)</button>
                  <button type="button" className="xp-preset-btn" onClick={() => setDesktopOffset(120)}>Elevated (120px)</button>
                </div>
              </div>

              {/* Mobile Vertical Offset Slider */}
              <div className="xp-offset-box">
                <div className="xp-offset-header">
                  <div>
                    <label className="xp-offset-label">Mobile Bottom Distance</label>
                    <small>Recommended 70px to 90px on stores with sticky add-to-cart bars</small>
                  </div>
                  <div className="xp-offset-val-wrap">
                    <input
                      type="number"
                      name="mobileBottomOffsetPx"
                      min={10}
                      max={300}
                      className="xp-offset-number"
                      value={mobileOffset}
                      onChange={(e) => setMobileOffset(Number(e.target.value))}
                    />
                    <span>px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={250}
                  step={2}
                  className="xp-range-slider"
                  value={mobileOffset}
                  onChange={(e) => setMobileOffset(Number(e.target.value))}
                />
                <div className="xp-offset-presets">
                  <span className="xp-preset-label">Presets:</span>
                  <button type="button" className="xp-preset-btn" onClick={() => setMobileOffset(24)}>Standard (24px)</button>
                  <button type="button" className="xp-preset-btn" onClick={() => setMobileOffset(80)}>Above Cart Bar (80px)</button>
                  <button type="button" className="xp-preset-btn" onClick={() => setMobileOffset(130)}>High Float (130px)</button>
                </div>
              </div>
            </s-section>

            {/* General Status */}
            <s-section heading="4. Widget Status">
              <div className="xp-row">
                <label className="xp-toggle">
                  <input type="checkbox" name="active" defaultChecked={config.active} />
                  <span>Enabled on storefront</span>
                </label>
              </div>
            </s-section>

            {/* WhatsApp Chat */}
            <s-section heading="5. WhatsApp Direct Chat">
              <div className="xp-grid-2">
                <div className="xp-field">
                  <label>WhatsApp Number (with country code)</label>
                  <input
                    type="text"
                    name="whatsappNumber"
                    className="xp-input"
                    value={waNumber}
                    onChange={(e) => setWaNumber(e.target.value)}
                    placeholder="+14155552671"
                  />
                  <small>Digits only with country code (e.g. +1415...)</small>
                </div>
                <div className="xp-field">
                  <label>Pre-filled Message</label>
                  <input
                    type="text"
                    name="whatsappMessage"
                    className="xp-input"
                    value={waMsg}
                    onChange={(e) => setWaMsg(e.target.value)}
                  />
                </div>
              </div>
              <div className="xp-wa-preview">
                <strong>Generated Link:</strong> <code>{waUrl}</code>
              </div>
            </s-section>

            {/* VIP Community */}
            <s-section heading="6. VIP Community Funnel">
              <div className="xp-grid-2">
                <div className="xp-field">
                  <label>VIP Button Label</label>
                  <input
                    type="text"
                    name="vipCommunityLabel"
                    className="xp-input"
                    value={vipLabel}
                    onChange={(e) => setVipLabel(e.target.value)}
                  />
                </div>
                <div className="xp-field">
                  <label>Community Link (Telegram / WhatsApp / Discord)</label>
                  <input
                    type="url"
                    name="vipCommunityUrl"
                    className="xp-input"
                    defaultValue={config.vipCommunityUrl || ""}
                    placeholder="https://t.me/yourcommunity"
                  />
                </div>
              </div>
            </s-section>

            {/* Social Profiles */}
            <s-section heading="7. Social Profiles">
              <div className="xp-field">
                <label>Instagram URL</label>
                <input
                  type="url"
                  name="instagramUrl"
                  className="xp-input"
                  defaultValue={config.instagramUrl || ""}
                  placeholder="https://instagram.com/yourstore"
                />
              </div>
              <div className="xp-field">
                <label>Facebook URL</label>
                <input
                  type="url"
                  name="facebookUrl"
                  className="xp-input"
                  defaultValue={config.facebookUrl || ""}
                  placeholder="https://facebook.com/yourstore"
                />
              </div>
              <div className="xp-field">
                <label>TikTok URL</label>
                <input
                  type="url"
                  name="tiktokUrl"
                  className="xp-input"
                  defaultValue={config.tiktokUrl || ""}
                  placeholder="https://tiktok.com/@yourstore"
                />
              </div>
            </s-section>

            {/* Appearance Overrides */}
            <s-section heading="8. Color Customization (Optional Overrides)">
              <div className="xp-grid-3">
                <div className="xp-field">
                  <label>Background Color</label>
                  <div className="xp-color-wrap">
                    <input
                      type="color"
                      name="backgroundColor"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                    />
                    <span>{bgColor}</span>
                  </div>
                </div>
                <div className="xp-field">
                  <label>Accent Color</label>
                  <div className="xp-color-wrap">
                    <input
                      type="color"
                      name="accentColor"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                    />
                    <span>{accentColor}</span>
                  </div>
                </div>
                <div className="xp-field">
                  <label>Text Color</label>
                  <div className="xp-color-wrap">
                    <input
                      type="color"
                      name="textColor"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                    />
                    <span>{textColor}</span>
                  </div>
                </div>
              </div>
            </s-section>

            <button type="submit" className="xp-btn-submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving Configuration..." : "Save Configuration"}
            </button>
          </Form>
        </div>

        {/* Live Interactive Preview */}
        <div className="xp-social-preview-wrap">
          <div className="xp-preview-sticky">
            <div className="xp-preview-card-header">
              <h3>Live Interactive Preview</h3>
              <span className="xp-preview-tag">
                {LAYOUT_STYLES.find((l) => l.id === selectedLayout)?.name.split(" ")[0]} - {DESIGN_THEMES.find((t) => t.id === selectedTheme)?.name.split(" ")[0]}
              </span>
            </div>
            <p className="xp-sub">Simulating actual appearance on storefront with selected layout and palette.</p>

            <div className="xp-offset-indicator-bar">
              <span>Desktop: <strong>{desktopOffset}px</strong></span>
              <span>Mobile: <strong>{mobileOffset}px</strong></span>
              <span>Side: <strong>{side === "bottom-left" ? "Left" : "Right"}</strong></span>
            </div>

            {/* RENDER LAYOUT 1: Action Stack */}
            {selectedLayout === "action_stack" && (
              <div
                className={`xp-preview-social-deck xp-preview-deck--${selectedTheme}`}
                style={{ background: bgColor, borderColor: `${accentColor}77`, color: textColor }}
              >
                <div className="xp-deck-header" style={{ color: accentColor }}>
                  <span className="xp-pulse-live" style={{ background: accentColor }}></span>
                  <strong>Quick Actions</strong>
                </div>

                {/* Layer 1: Dedicated WhatsApp Button */}
                <a href={waUrl} target="_blank" rel="noreferrer" className="xp-stack-btn xp-stack-btn-wa">
                  <svg className="xp-svg-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.14c-1.52 0-3-.4-4.3-1.17l-.31-.18-3.19.84.85-3.11-.2-.32a8.16 8.16 0 0 1-1.25-4.29c0-4.51 3.67-8.18 8.18-8.18 2.19 0 4.24.85 5.79 2.4 1.54 1.55 2.4 3.61 2.4 5.79 0 4.51-3.67 8.19-8.17 8.19z"/>
                  </svg>
                  <div className="xp-stack-btn-text">
                    <strong>Chat on WhatsApp</strong>
                    <small>Instant reply under 2 mins</small>
                  </div>
                  <span className="xp-stack-arrow">&rarr;</span>
                </a>

                {/* Layer 2: VIP Club Offers Banner Button */}
                <div className="xp-stack-btn xp-stack-btn-vip" style={{ borderColor: accentColor }}>
                  <svg className="xp-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <div className="xp-stack-btn-text">
                    <strong>{vipLabel}</strong>
                    <small style={{ color: accentColor }}>Exclusive VIP Drops &amp; Offers</small>
                  </div>
                  <span className="xp-stack-pill" style={{ background: accentColor, color: bgColor }}>VIP PASS</span>
                </div>

                {/* Layer 3: Distinct Multi-Row Social Channels */}
                <div className="xp-stack-social-list">
                  <div className="xp-social-row-btn">
                    <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <span>Follow on Instagram</span>
                    <span className="xp-row-arrow">&rarr;</span>
                  </div>
                  <div className="xp-social-row-btn">
                    <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.02 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.05 3.25-1.57 3.32-3.38.07-2.87.03-5.75.04-8.62.01-3.21-.01-6.42.02-9.63z"/>
                    </svg>
                    <span>Follow on TikTok</span>
                    <span className="xp-row-arrow">&rarr;</span>
                  </div>
                  <div className="xp-social-row-btn">
                    <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/>
                    </svg>
                    <span>Follow on Facebook</span>
                    <span className="xp-row-arrow">&rarr;</span>
                  </div>
                </div>
              </div>
            )}

            {/* RENDER LAYOUT 2: Live Concierge Portal */}
            {selectedLayout === "concierge_card" && (
              <div
                className={`xp-preview-social-deck xp-preview-deck--${selectedTheme}`}
                style={{ background: bgColor, borderColor: `${accentColor}77`, color: textColor }}
              >
                <div className="xp-concierge-header">
                  <div className="xp-concierge-avatar" style={{ borderColor: accentColor }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <span className="xp-concierge-dot" style={{ background: "#25D366" }}></span>
                  </div>
                  <div>
                    <div className="xp-concierge-name">Customer Support</div>
                    <div className="xp-concierge-status" style={{ color: "#25D366" }}>Online Now - Fast Response</div>
                  </div>
                </div>

                {/* Primary WhatsApp Support Button */}
                <a href={waUrl} target="_blank" rel="noreferrer" className="xp-concierge-wa-btn">
                  <svg className="xp-svg-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.14c-1.52 0-3-.4-4.3-1.17l-.31-.18-3.19.84.85-3.11-.2-.32a8.16 8.16 0 0 1-1.25-4.29c0-4.51 3.67-8.18 8.18-8.18 2.19 0 4.24.85 5.79 2.4 1.54 1.55 2.4 3.61 2.4 5.79 0 4.51-3.67 8.19-8.17 8.19z"/>
                  </svg>
                  <div className="xp-concierge-wa-info">
                    <strong>Chat with Customer Support</strong>
                    <small>Typically replies in minutes</small>
                  </div>
                  <span className="xp-concierge-wa-arrow">&rarr;</span>
                </a>

                {/* Quick Inquiry Chips */}
                <div className="xp-chips-label">Quick Inquiries:</div>
                <div className="xp-quick-chips">
                  <span className="xp-chip">Track My Order</span>
                  <span className="xp-chip">Product Advice</span>
                  <span className="xp-chip">Discount Help</span>
                </div>

                {/* VIP Pass Banner Card */}
                <div className="xp-vip-card" style={{ borderColor: accentColor }}>
                  <div className="xp-vip-card-top">
                    <span className="xp-vip-badge" style={{ background: accentColor, color: bgColor }}>VIP PASS</span>
                    <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </div>
                  <div className="xp-vip-title">{vipLabel}</div>
                  <span className="xp-vip-cta" style={{ color: accentColor }}>Get secret member drops &rarr;</span>
                </div>

                {/* Official Social Channels Row */}
                <div className="xp-concierge-social-section">
                  <span className="xp-concierge-social-label">Follow Official Channels:</span>
                  <div className="xp-concierge-social-row">
                    <span className="xp-social-icon-circle" title="Instagram">
                      <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </span>
                    <span className="xp-social-icon-circle" title="TikTok">
                      <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.02 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.05 3.25-1.57 3.32-3.38.07-2.87.03-5.75.04-8.62.01-3.21-.01-6.42.02-9.63z"/>
                      </svg>
                    </span>
                    <span className="xp-social-icon-circle" title="Facebook">
                      <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* RENDER LAYOUT 3: VIP Club & Remarketing Hub */}
            {selectedLayout === "vip_funnel" && (
              <div
                className={`xp-preview-social-deck xp-preview-deck--${selectedTheme}`}
                style={{ background: bgColor, borderColor: `${accentColor}77`, color: textColor }}
              >
                <div className="xp-vip-hero-card" style={{ borderColor: accentColor }}>
                  <div className="xp-vip-hero-header">
                    <span className="xp-vip-badge" style={{ background: accentColor, color: bgColor }}>VIP CLUB</span>
                    <span style={{ color: accentColor, fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px" }}>MEMBERS ONLY</span>
                  </div>
                  <h4 className="xp-vip-hero-title">{vipLabel}</h4>
                  <ul className="xp-vip-benefits">
                    <li>
                      <span className="xp-vip-check-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                      <span>Secret 20% flash drops &amp; private deals</span>
                    </li>
                    <li>
                      <span className="xp-vip-check-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                      <span>24h early access to new collection releases</span>
                    </li>
                    <li>
                      <span className="xp-vip-check-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                      <span>Member-only complimentary luxury gift sets</span>
                    </li>
                  </ul>
                  <button type="button" className="xp-vip-join-btn" style={{ background: accentColor, color: bgColor }}>
                    Claim VIP Membership &rarr;
                  </button>
                </div>

                <a href={waUrl} target="_blank" rel="noreferrer" className="xp-secondary-wa-btn">
                  <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.14c-1.52 0-3-.4-4.3-1.17l-.31-.18-3.19.84.85-3.11-.2-.32a8.16 8.16 0 0 1-1.25-4.29c0-4.51 3.67-8.18 8.18-8.18 2.19 0 4.24.85 5.79 2.4 1.54 1.55 2.4 3.61 2.4 5.79 0 4.51-3.67 8.19-8.17 8.19z"/>
                  </svg>
                  <span>Need personal advice? Chat on WhatsApp</span>
                </a>

                <div className="xp-vip-social-follow">
                  <span>Follow Our Official Channels:</span>
                  <div className="xp-concierge-social-row">
                    <span className="xp-social-icon-circle" title="Instagram">
                      <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </span>
                    <span className="xp-social-icon-circle" title="TikTok">
                      <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.02 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.05 3.25-1.57 3.32-3.38.07-2.87.03-5.75.04-8.62.01-3.21-.01-6.42.02-9.63z"/>
                      </svg>
                    </span>
                    <span className="xp-social-icon-circle" title="Facebook">
                      <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* RENDER LAYOUT 4: Compact Horizontal Dock */}
            {selectedLayout === "compact_dock" && (
              <div
                className={`xp-preview-dock-strip xp-preview-deck--${selectedTheme}`}
                style={{ background: bgColor, borderColor: accentColor, color: textColor }}
              >
                <a href={waUrl} target="_blank" rel="noreferrer" className="xp-dock-pill xp-dock-pill-wa">
                  <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.14c-1.52 0-3-.4-4.3-1.17l-.31-.18-3.19.84.85-3.11-.2-.32a8.16 8.16 0 0 1-1.25-4.29c0-4.51 3.67-8.18 8.18-8.18 2.19 0 4.24.85 5.79 2.4 1.54 1.55 2.4 3.61 2.4 5.79 0 4.51-3.67 8.19-8.17 8.19z"/>
                  </svg>
                  <span>WhatsApp</span>
                </a>
                <div className="xp-dock-divider" style={{ background: `${accentColor}44` }}></div>
                <div className="xp-dock-pill xp-dock-pill-vip" style={{ color: accentColor }}>
                  <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <span>VIP Deals</span>
                </div>
                <div className="xp-dock-divider" style={{ background: `${accentColor}44` }}></div>
                <div className="xp-dock-social-group">
                  <span className="xp-dock-social-btn" title="Instagram">
                    <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </span>
                  <span className="xp-dock-social-btn" title="TikTok">
                    <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.02 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.05 3.25-1.57 3.32-3.38.07-2.87.03-5.75.04-8.62.01-3.21-.01-6.42.02-9.63z"/>
                    </svg>
                  </span>
                  <span className="xp-dock-social-btn" title="Facebook">
                    <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/>
                    </svg>
                  </span>
                </div>
              </div>
            )}

            {/* Collapsed Trigger Button Preview */}
            <div className="xp-trigger-preview-container">
              <div
                className={`xp-floating-trigger-mock xp-trigger--${selectedTheme}`}
                style={{ background: bgColor, borderColor: accentColor, color: textColor }}
              >
                <svg className="xp-svg-icon-sm" viewBox="0 0 24 24" fill="currentColor" style={{ color: accentColor }}>
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
                <span className="xp-trigger-badge-text">{badgeText}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </s-page>
  );
}

const SOCIAL_BAR_STYLES = `
  .xp-social-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 24px;
    margin-top: 16px;
  }
  @media (max-width: 960px) {
    .xp-social-layout {
      grid-template-columns: 1fr;
    }
  }
  .xp-section-intro {
    font-size: 13px;
    color: #5c5f62;
    margin: 0 0 16px;
    line-height: 1.4;
  }
  .xp-sub {
    font-size: 12px;
    color: #6d7175;
    margin: 4px 0 0;
  }
  .xp-row {
    margin-bottom: 14px;
  }
  .xp-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
  }
  .xp-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .xp-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .xp-field label {
    font-size: 13px;
    font-weight: 600;
    color: #202223;
  }
  .xp-field small {
    font-size: 11px;
    color: #6d7175;
  }
  .xp-input {
    padding: 8px 12px;
    border: 1px solid #c9cccf;
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
  }
  .xp-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 600px) {
    .xp-grid-2 {
      grid-template-columns: 1fr;
    }
  }
  .xp-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 600px) {
    .xp-grid-3 {
      grid-template-columns: 1fr;
    }
  }

  /* Layout Architecture Cards */
  .xp-layouts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  @media (max-width: 600px) {
    .xp-layouts-grid {
      grid-template-columns: 1fr;
    }
  }
  .xp-layout-card {
    border: 2px solid #e1e3e5;
    border-radius: 10px;
    padding: 14px;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .xp-layout-card:hover {
    border-color: #a4e8f2;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  .xp-layout-card.is-selected {
    border-color: #008060;
    background: #fbfdfc;
    box-shadow: 0 0 0 1px #008060, 0 4px 14px rgba(0, 128, 96, 0.15);
  }
  .xp-layout-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-layout-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: #f0f2f5;
    color: #444;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .xp-layout-title {
    margin: 2px 0 0;
    font-size: 13px;
    font-weight: 700;
    color: #202223;
  }
  .xp-layout-desc {
    margin: 0;
    font-size: 11px;
    color: #6d7175;
    line-height: 1.35;
  }

  /* Themes Grid */
  .xp-themes-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  @media (max-width: 600px) {
    .xp-themes-grid {
      grid-template-columns: 1fr;
    }
  }
  .xp-theme-card {
    border: 2px solid #e1e3e5;
    border-radius: 10px;
    padding: 14px;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
  }
  .xp-theme-card:hover {
    border-color: #a4e8f2;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  .xp-theme-card.is-selected {
    border-color: #008060;
    background: #fbfdfc;
    box-shadow: 0 0 0 1px #008060, 0 4px 14px rgba(0, 128, 96, 0.15);
  }
  .xp-theme-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-theme-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: #f0f2f5;
    color: #444;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .xp-theme-check {
    font-size: 11px;
    font-weight: 700;
    color: #008060;
  }
  .xp-theme-title {
    margin: 2px 0 0;
    font-size: 13px;
    font-weight: 700;
    color: #202223;
  }
  .xp-theme-desc {
    margin: 0;
    font-size: 11px;
    color: #6d7175;
    line-height: 1.35;
    flex-grow: 1;
  }
  .xp-theme-palette {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .xp-swatch {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(0,0,0,0.15);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  /* Vertical Offset Box */
  .xp-offset-box {
    background: #f9fafb;
    border: 1px solid #e1e3e5;
    border-radius: 8px;
    padding: 14px 16px;
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .xp-offset-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-offset-label {
    font-size: 13px;
    font-weight: 700;
    color: #202223;
    display: block;
  }
  .xp-offset-header small {
    font-size: 11px;
    color: #6d7175;
  }
  .xp-offset-val-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
  }
  .xp-offset-number {
    width: 60px;
    padding: 4px 8px;
    border: 1px solid #c9cccf;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 700;
    text-align: center;
  }
  .xp-range-slider {
    width: 100%;
    cursor: pointer;
    accent-color: #008060;
  }
  .xp-offset-presets {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 4px;
  }
  .xp-preset-label {
    font-size: 11px;
    color: #6d7175;
  }
  .xp-preset-btn {
    background: #fff;
    border: 1px solid #c9cccf;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #202223;
    cursor: pointer;
    transition: background 0.15s;
  }
  .xp-preset-btn:hover {
    background: #f1f2f3;
    border-color: #8c9196;
  }

  .xp-color-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .xp-color-wrap input[type="color"] {
    width: 38px;
    height: 34px;
    border: 1px solid #c9cccf;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
  }
  .xp-wa-preview {
    margin-top: 10px;
    padding: 8px 12px;
    background: #f4f6f8;
    border-radius: 6px;
    font-size: 11px;
    word-break: break-all;
  }
  .xp-btn-submit {
    background: #008060;
    color: #ffffff;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    align-self: flex-start;
    transition: background 0.2s;
  }
  .xp-btn-submit:hover {
    background: #006e52;
  }

  /* Live Preview Styles */
  .xp-preview-sticky {
    position: sticky;
    top: 20px;
  }
  .xp-preview-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-preview-card-header h3 {
    margin: 0;
    font-size: 15px;
  }
  .xp-preview-tag {
    font-size: 11px;
    background: #008060;
    color: #fff;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 700;
  }
  .xp-offset-indicator-bar {
    display: flex;
    justify-content: space-between;
    background: #eef1f3;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    margin: 10px 0 14px;
    color: #333;
  }

  .xp-preview-social-deck {
    border-width: 1px;
    border-style: solid;
    border-radius: 14px;
    padding: 16px;
    box-shadow: 0 12px 35px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: all 0.3s ease;
  }

  .xp-deck-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .xp-pulse-live {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  /* Action Stack Buttons */
  .xp-stack-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    text-decoration: none;
    transition: all 0.2s;
  }
  .xp-stack-btn-wa {
    background: #25D366;
    color: #fff;
  }
  .xp-stack-btn-vip {
    background: rgba(255, 255, 255, 0.04);
    border: 1px dashed;
    color: #fff;
  }
  .xp-stack-btn-text {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .xp-stack-btn-text strong {
    font-size: 13px;
  }
  .xp-stack-btn-text small {
    font-size: 10px;
    opacity: 0.9;
  }
  .xp-stack-arrow {
    font-size: 16px;
    font-weight: 700;
  }
  .xp-stack-pill {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }
  .xp-stack-social-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 10px;
  }
  .xp-social-row-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .xp-row-arrow {
    margin-left: auto;
    opacity: 0.6;
  }

  /* Concierge Card */
  .xp-concierge-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 10px;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .xp-concierge-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }
  .xp-concierge-avatar svg {
    width: 22px;
    height: 22px;
    fill: currentColor;
  }
  .xp-concierge-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #000;
    box-shadow: 0 0 8px #25D366;
  }
  .xp-concierge-name {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.3;
  }
  .xp-concierge-status {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.3;
  }
  .xp-concierge-wa-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #25D366;
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
    box-shadow: 0 4px 15px rgba(37, 211, 102, 0.35);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-sizing: border-box;
  }
  .xp-concierge-wa-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(37, 211, 102, 0.5);
  }
  .xp-concierge-wa-btn svg {
    width: 22px;
    height: 22px;
    fill: #ffffff;
    flex-shrink: 0;
  }
  .xp-concierge-wa-info {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .xp-concierge-wa-info strong {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    display: block;
  }
  .xp-concierge-wa-info small {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.9);
    display: block;
  }
  .xp-concierge-wa-arrow {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
  }
  .xp-chips-label {
    font-size: 11px;
    font-weight: 600;
    color: #888;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .xp-quick-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .xp-chip {
    font-size: 11px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #ffffff;
    padding: 5px 10px;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .xp-chip:hover {
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
  .xp-vip-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px dashed;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }
  .xp-vip-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }
  .xp-vip-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-vip-badge {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    display: inline-block;
    width: fit-content;
  }
  .xp-vip-title {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    margin: 2px 0;
  }
  .xp-vip-cta {
    font-size: 11px;
    font-weight: 600;
  }
  .xp-concierge-social-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .xp-concierge-social-label {
    font-size: 11px;
    color: #888;
  }

  /* VIP Funnel */
  .xp-vip-hero-card {
    border: 1px solid;
    border-radius: 10px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .xp-vip-hero-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .xp-vip-hero-title {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
  }
  .xp-vip-benefits {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
  }
  .xp-vip-benefits li {
    display: flex;
    align-items: center;
    gap: 8px;
    line-height: 1.35;
  }
  .xp-vip-check-badge {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(37, 211, 102, 0.15);
    border: 1px solid rgba(37, 211, 102, 0.5);
    color: #25D366;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .xp-vip-join-btn {
    border: none;
    padding: 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    text-align: center;
    transition: opacity 0.2s ease;
  }
  .xp-vip-join-btn:hover {
    opacity: 0.9;
  }
  .xp-secondary-wa-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(37, 211, 102, 0.15);
    border: 1px solid rgba(37, 211, 102, 0.4);
    color: #25D366;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    margin-top: 10px;
  }
  .xp-vip-social-follow {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    color: #888;
  }
  .xp-concierge-social-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .xp-social-icon-circle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .xp-social-icon-circle:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: translateY(-2px);
    border-color: #D4AF37;
    color: #D4AF37;
  }

  /* Compact Horizontal Dock */
  .xp-preview-dock-strip {
    border-width: 1px;
    border-style: solid;
    border-radius: 40px;
    padding: 6px 14px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(212, 175, 55, 0.15);
    backdrop-filter: blur(12px);
  }
  .xp-dock-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    padding: 6px 10px;
    border-radius: 20px;
    transition: all 0.2s ease;
    cursor: pointer;
  }
  .xp-dock-pill-wa {
    background: rgba(37, 211, 102, 0.16);
    border: 1px solid rgba(37, 211, 102, 0.4);
    color: #25D366;
  }
  .xp-dock-pill-wa:hover {
    background: #25D366;
    color: #0B0B0B;
    transform: translateY(-1px);
  }
  .xp-dock-pill-vip {
    background: rgba(212, 175, 55, 0.12);
    border: 1px solid rgba(212, 175, 55, 0.35);
  }
  .xp-dock-pill-vip:hover {
    background: rgba(212, 175, 55, 0.25);
    transform: translateY(-1px);
  }
  .xp-dock-divider {
    width: 1px;
    height: 20px;
    flex-shrink: 0;
  }
  .xp-dock-social-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .xp-dock-social-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  .xp-dock-social-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    border-color: #D4AF37;
    color: #D4AF37;
  }

  /* SVG Icons */
  .xp-svg-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  .xp-svg-icon-sm {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  /* Trigger mock */
  .xp-trigger-preview-container {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
  .xp-floating-trigger-mock {
    border-width: 1px;
    border-style: solid;
    border-radius: 24px;
    padding: 9px 18px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.3);
  }
  .xp-trigger-badge-text {
    font-weight: 600;
  }
`;
