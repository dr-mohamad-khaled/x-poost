import { useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import { FeatureLanguageSwitcher } from "../components/FeatureLanguageSwitcher";
import {
  type SupportedLanguage,
  DEFAULT_TRANSLATIONS_BY_LANG,
  getAllTranslations,
  sanitizeText,
} from "../utils/translations";

type Tier = {
  targetAmount: number;
  rewardTitle: string;
  unlockedMessage: string;
};

const DEFAULT_TIERS: Tier[] = [
  { targetAmount: 50, rewardTitle: "Free Standard Shipping", unlockedMessage: "Free Shipping Unlocked!" },
  { targetAmount: 100, rewardTitle: "Free Express Priority", unlockedMessage: "Free Express Priority Unlocked!" },
  { targetAmount: 150, rewardTitle: "Free Mystery Luxury Gift", unlockedMessage: "Free Mystery Gift Unlocked!" },
];

const SHIPPING_LAYOUTS = [
  {
    id: "milestone_stepper",
    name: "Milestone Stepper Roadmap",
    badge: "Most Popular",
    description: "Interconnected milestone nodes along a progress path with truck, lightning, and gift SVG icons.",
  },
  {
    id: "gamified_cards",
    name: "Gamified Reward Cards",
    badge: "High Engagement",
    description: "Side-by-side unlockable reward cards with lock indicators and unlocked gift celebration badges.",
  },
  {
    id: "luxury_gradient",
    name: "Luxury Minimalist Bar",
    badge: "Clean Beauty",
    description: "Sleek thin progress bar with flowing shimmer highlight and dynamic motivational headline.",
  },
  {
    id: "split_ribbon",
    name: "Split Achievement Ribbon",
    badge: "Compact",
    description: "Compact dual-badge ribbon showing current unlocked milestone on left and next target on right.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  let config = await prisma.shippingBarConfig.findUnique({
    where: { shopId: shop.id },
  });

  if (!config) {
    config = await prisma.shippingBarConfig.create({
      data: {
        shopId: shop.id,
        active: true,
        currency: "USD",
        currencySymbol: "$",
        tiersJson: JSON.stringify({ tiers: DEFAULT_TIERS, layoutStyle: "milestone_stepper" }),
        progressColor: "#D4AF37",
        trackColor: "#222222",
        backgroundColor: "#0B0B0B",
        textColor: "#FFFFFF",
        initialMessage: "Add items to unlock Free Shipping!",
        allUnlockedMessage: "Congratulations! You unlocked all rewards!",
      },
    });
  }

  let translationConfig = await prisma.translationConfig.findUnique({
    where: { shopId: shop.id },
  });
  if (!translationConfig) {
    translationConfig = await prisma.translationConfig.create({
      data: {
        shopId: shop.id,
        dashboardLocale: "en",
        storefrontLocale: "ar",
        translationsJson: "{}",
      },
    });
  }

  const allTranslations = getAllTranslations(translationConfig?.translationsJson);
  const dashboardLocale = (translationConfig?.dashboardLocale || "en") as SupportedLanguage;

  let tiers: Tier[] = [];
  let layoutStyle = "milestone_stepper";
  try {
    const parsed = JSON.parse(config.tiersJson);
    if (Array.isArray(parsed)) {
      tiers = parsed;
    } else if (parsed && Array.isArray(parsed.tiers)) {
      tiers = parsed.tiers;
      if (parsed.layoutStyle) layoutStyle = parsed.layoutStyle;
    }
    if (tiers.length === 0) tiers = DEFAULT_TIERS;
  } catch {
    tiers = DEFAULT_TIERS;
  }

  return {
    shop,
    enabled: shop.shippingBarEnabled,
    config: { ...config, tiers, layoutStyle },
    allTranslations,
    dashboardLocale,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();

  const active = formData.get("active") === "on";
  const currency = String(formData.get("currency") || "USD").toUpperCase();
  const currencySymbol = String(formData.get("currencySymbol") || "$");
  const progressColor = String(formData.get("progressColor") || "#D4AF37");
  const trackColor = String(formData.get("trackColor") || "#222222");
  const backgroundColor = String(formData.get("backgroundColor") || "#0B0B0B");
  const textColor = String(formData.get("textColor") || "#FFFFFF");
  const initialMessage = String(formData.get("initialMessage") || "Add items to unlock Free Shipping!");
  const allUnlockedMessage = String(formData.get("allUnlockedMessage") || "Congratulations! You unlocked all rewards!");
  const layoutStyle = String(formData.get("layoutStyle") || "milestone_stepper");
  const translationsJsonRaw = String(formData.get("translationsJson") || "");

  const tiersRaw = String(formData.get("tiersJson") || "[]");
  let tiers: Tier[];
  try {
    tiers = JSON.parse(tiersRaw);
    if (!Array.isArray(tiers)) throw new Error("not array");
  } catch {
    return { error: "Failed to parse tiers configuration." };
  }

  // Sort tiers ascending by target amount
  tiers.sort((a, b) => a.targetAmount - b.targetAmount);

  const serializedTiers = JSON.stringify({
    tiers,
    layoutStyle,
  });

  await prisma.shippingBarConfig.upsert({
    where: { shopId: shop.id },
    update: {
      active,
      currency,
      currencySymbol,
      tiersJson: serializedTiers,
      progressColor,
      trackColor,
      backgroundColor,
      textColor,
      initialMessage,
      allUnlockedMessage,
    },
    create: {
      shopId: shop.id,
      active,
      currency,
      currencySymbol,
      tiersJson: serializedTiers,
      progressColor,
      trackColor,
      backgroundColor,
      textColor,
      initialMessage,
      allUnlockedMessage,
    },
  });

  if (translationsJsonRaw) {
    try {
      const parsedAll = getAllTranslations(translationsJsonRaw);
      await prisma.translationConfig.upsert({
        where: { shopId: shop.id },
        update: { translationsJson: JSON.stringify(parsedAll) },
        create: {
          shopId: shop.id,
          dashboardLocale: "en",
          storefrontLocale: "ar",
          translationsJson: JSON.stringify(parsedAll),
        },
      });
    } catch (e) {
      console.error("[Shipping Bar Action] Error saving translationConfig:", e);
    }
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: { shippingBarEnabled: active },
  });

  return { ok: true, message: "Tiered Shipping Bar configuration saved!" };
};

export default function ShippingBarSettings() {
  const { config, allTranslations, dashboardLocale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(dashboardLocale || "ar");
  const [translationsMap, setTranslationsMap] = useState(allTranslations);

  const currentCopy = translationsMap[selectedLang]?.shippingBar || DEFAULT_TRANSLATIONS_BY_LANG[selectedLang].shippingBar;

  const handleTextChange = (field: "initialMessage" | "progressMessage" | "allUnlockedMessage", val: string) => {
    const clean = sanitizeText(val);
    setTranslationsMap((prev) => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        shippingBar: {
          ...prev[selectedLang].shippingBar,
          [field]: clean,
        },
      },
    }));
  };

  const handleLoadPredefined = () => {
    const def = DEFAULT_TRANSLATIONS_BY_LANG[selectedLang].shippingBar;
    setTranslationsMap((prev) => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        shippingBar: { ...def },
      },
    }));
  };

  const [selectedLayout, setSelectedLayout] = useState<string>(config.layoutStyle || "milestone_stepper");
  const [currencySymbol, setCurrencySymbol] = useState(config.currencySymbol || "$");
  const [progressColor, setProgressColor] = useState(config.progressColor || "#D4AF37");
  const [bgColor, setBgColor] = useState(config.backgroundColor || "#0B0B0B");
  const [tiers, setTiers] = useState<Tier[]>(config.tiers || DEFAULT_TIERS);

  // Simulator state
  const [testCartValue, setTestCartValue] = useState<number>(75);

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const newTarget = last ? last.targetAmount + 50 : 50;
    setTiers([...tiers, { targetAmount: newTarget, rewardTitle: `Reward Level ${tiers.length + 1}`, unlockedMessage: `Unlocked Level ${tiers.length + 1}!` }]);
  };

  const removeTier = (idx: number) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const updateTier = (idx: number, patch: Partial<Tier>) => {
    setTiers(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const sortedTiers = useMemo(() => {
    return [...tiers].sort((a, b) => a.targetAmount - b.targetAmount);
  }, [tiers]);

  const maxTier = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1].targetAmount : 100;
  const progressPercent = Math.min(100, Math.max(0, (testCartValue / (maxTier || 1)) * 100));

  const nextTier = sortedTiers.find((t) => t.targetAmount > testCartValue);
  const remaining = nextTier ? (nextTier.targetAmount - testCartValue).toFixed(2) : "0.00";

  return (
    <s-page heading="Smart Tiered Shipping & Rewards Bar">
      <style>{SHIPPING_BAR_STYLES}</style>

      {actionData && "ok" in actionData ? (
        <s-banner tone="success">{actionData.message}</s-banner>
      ) : null}

      <div className="xp-shipping-layout">
        <div className="xp-shipping-config">
          <Form method="post" className="xp-form">
            <input type="hidden" name="tiersJson" value={JSON.stringify(tiers)} />
            <input type="hidden" name="layoutStyle" value={selectedLayout} />
            <input type="hidden" name="translationsJson" value={JSON.stringify(translationsMap)} />
            <input type="hidden" name="initialMessage" value={currentCopy.initialMessage} />
            <input type="hidden" name="allUnlockedMessage" value={currentCopy.allUnlockedMessage} />

            {/* Layout Architecture Selection */}
            <div className="xp-section-card"><h3 className="xp-section-title">1. Choose Progress Bar Layout</h3>
              <p className="xp-section-intro">
                Select the visual structure and reward format that appears in the cart drawer and cart page.
              </p>
              <div className="xp-layouts-grid">
                {SHIPPING_LAYOUTS.map((layout) => {
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
                        <span className="xp-layout-name">{layout.name}</span>
                        <span className="xp-layout-badge">{layout.badge}</span>
                      </div>
                      <p className="xp-layout-desc">{layout.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* General Settings */}
            <div className="xp-section-card"><h3 className="xp-section-title">2. General & Multi-Language Messages</h3>
              <div className="xp-row">
                <label className="xp-toggle">
                  <input type="checkbox" name="active" defaultChecked={config.active} />
                  <span>Enable Tiered Shipping Bar on storefront</span>
                </label>
              </div>

              <div className="xp-grid-2">
                <div className="xp-field">
                  <label>Currency Code</label>
                  <input
                    type="text"
                    name="currency"
                    className="xp-input"
                    defaultValue={config.currency || "USD"}
                  />
                </div>
                <div className="xp-field">
                  <label>Currency Symbol</label>
                  <input
                    type="text"
                    name="currencySymbol"
                    className="xp-input"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                  />
                </div>
              </div>

              <FeatureLanguageSwitcher
                selectedLang={selectedLang}
                onSelectLang={setSelectedLang}
                onLoadPredefined={handleLoadPredefined}
                dashboardLocale={dashboardLocale}
              />

              <div className="xp-field">
                <label>Initial Message / Empty Cart ({selectedLang.toUpperCase()})</label>
                <input
                  type="text"
                  className="xp-input"
                  dir={selectedLang === "ar" ? "rtl" : "ltr"}
                  value={currentCopy.initialMessage}
                  onChange={(e) => handleTextChange("initialMessage", e.target.value)}
                />
              </div>

              <div className="xp-field">
                <label>Progress Toward Next Reward Message ({selectedLang.toUpperCase()})</label>
                <input
                  type="text"
                  className="xp-input"
                  dir={selectedLang === "ar" ? "rtl" : "ltr"}
                  value={currentCopy.progressMessage}
                  onChange={(e) => handleTextChange("progressMessage", e.target.value)}
                />
                <small>Use &#123;amount&#125; variable for remaining distance to reward.</small>
              </div>

              <div className="xp-field">
                <label>All Tiers Unlocked Message ({selectedLang.toUpperCase()})</label>
                <input
                  type="text"
                  className="xp-input"
                  dir={selectedLang === "ar" ? "rtl" : "ltr"}
                  value={currentCopy.allUnlockedMessage}
                  onChange={(e) => handleTextChange("allUnlockedMessage", e.target.value)}
                />
              </div>
            </div>

            {/* Milestone Tiers */}
            <div className="xp-section-card"><h3 className="xp-section-title">3. Milestone Tiers</h3>
              <p className="xp-sub">Set sequential order thresholds and unlockable incentives.</p>

              <div className="xp-tiers-list">
                {tiers.map((tier, idx) => (
                  <div key={idx} className="xp-tier-card">
                    <div className="xp-tier-header">
                      <span className="xp-tier-badge">Tier {idx + 1}</span>
                      {tiers.length > 1 && (
                        <button type="button" onClick={() => removeTier(idx)} className="xp-tier-del">
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="xp-grid-2">
                      <div className="xp-field">
                        <label>Threshold Amount ({currencySymbol})</label>
                        <input
                          type="number"
                          className="xp-input"
                          value={tier.targetAmount}
                          onChange={(e) => updateTier(idx, { targetAmount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="xp-field">
                        <label>Reward Name</label>
                        <input
                          type="text"
                          className="xp-input"
                          value={tier.rewardTitle}
                          onChange={(e) => updateTier(idx, { rewardTitle: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addTier} className="xp-btn-secondary">
                + Add Another Milestone
              </button>
            </div>

            {/* Appearance */}
            <div className="xp-section-card"><h3 className="xp-section-title">4. Palette Customization</h3>
              <div className="xp-grid-3">
                <div className="xp-field">
                  <label>Progress Accent</label>
                  <div className="xp-color-wrap">
                    <input
                      type="color"
                      name="progressColor"
                      value={progressColor}
                      onChange={(e) => setProgressColor(e.target.value)}
                    />
                    <span>{progressColor}</span>
                  </div>
                </div>
                <div className="xp-field">
                  <label>Background</label>
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
                  <label>Track Background</label>
                  <div className="xp-color-wrap">
                    <input
                      type="color"
                      name="trackColor"
                      defaultValue={config.trackColor || "#222222"}
                    />
                    <span>{config.trackColor || "#222222"}</span>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="xp-btn-submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Shipping Bar"}
            </button>
          </Form>
        </div>

        {/* Simulator & Live Preview */}
        <div className="xp-shipping-preview-wrap">
          <div className="xp-preview-sticky">
            <div className="xp-preview-card-header">
              <h3>Interactive Cart Simulator</h3>
              <span className="xp-preview-tag">
                {SHIPPING_LAYOUTS.find((l) => l.id === selectedLayout)?.name.split(" ")[0]}
              </span>
            </div>
            <p className="xp-sub">Drag the slider to test milestones and progress transitions.</p>

            <div className="xp-slider-control">
              <label>
                Simulated Cart Total: <strong>{currencySymbol}{testCartValue.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min="0"
                max={maxTier + 50}
                step="5"
                value={testCartValue}
                onChange={(e) => setTestCartValue(parseFloat(e.target.value))}
                className="xp-range-slider"
              />
            </div>

            {/* PREVIEW LAYOUT 1: Milestone Stepper Roadmap */}
            {selectedLayout === "milestone_stepper" && (
              <div
                className="xp-bar-preview-box"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                style={{ background: bgColor, borderColor: `${progressColor}55` }}
              >
                <div className="xp-bar-status-text">
                  {nextTier
                    ? currentCopy.progressMessage.replace("{amount}", `${currencySymbol}${remaining}`)
                    : currentCopy.allUnlockedMessage}
                </div>

                <div className="xp-stepper-track-wrap">
                  <div className="xp-stepper-line-bg">
                    <div className="xp-stepper-line-fill" style={{ width: `${progressPercent}%`, background: progressColor }}></div>
                  </div>

                  <div className="xp-stepper-nodes">
                    {sortedTiers.map((t, i) => {
                      const isReached = testCartValue >= t.targetAmount;
                      return (
                        <div key={i} className={`xp-stepper-node ${isReached ? "is-reached" : ""}`}>
                          <div
                            className="xp-node-circle"
                            style={{
                              borderColor: isReached ? progressColor : "#444",
                              background: isReached ? progressColor : bgColor,
                              color: isReached ? bgColor : "#888",
                            }}
                          >
                            {isReached ? (
                              <svg className="xp-svg-micro" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            ) : (
                              <span>{i + 1}</span>
                            )}
                          </div>
                          <span className="xp-node-amount">{currencySymbol}{t.targetAmount}</span>
                          <span className="xp-node-title">{t.rewardTitle.split(" ")[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW LAYOUT 2: Gamified Reward Cards */}
            {selectedLayout === "gamified_cards" && (
              <div
                className="xp-bar-preview-box"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                style={{ background: bgColor, borderColor: `${progressColor}55` }}
              >
                <div className="xp-bar-status-text">
                  {nextTier
                    ? currentCopy.progressMessage.replace("{amount}", `${currencySymbol}${remaining}`)
                    : currentCopy.allUnlockedMessage}
                </div>

                <div className="xp-cards-progress-bar">
                  <div className="xp-cards-progress-fill" style={{ width: `${progressPercent}%`, background: progressColor }}></div>
                </div>

                <div className="xp-reward-cards-row">
                  {sortedTiers.map((t, i) => {
                    const isReached = testCartValue >= t.targetAmount;
                    return (
                      <div
                        key={i}
                        className={`xp-reward-card-item ${isReached ? "is-unlocked" : "is-locked"}`}
                        style={{ borderColor: isReached ? progressColor : "rgba(255,255,255,0.1)" }}
                      >
                        <div className="xp-card-icon-wrap" style={{ color: isReached ? progressColor : "#666" }}>
                          {isReached ? (
                            <svg className="xp-svg-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="8" width="18" height="13" rx="2"/>
                              <path d="M12 8v13M3 12h18"/>
                              <path d="M12 8c-2-3-5-3-5 0 0 2 5 2 5 0z"/>
                              <path d="M12 8c2-3 5-3 5 0 0 2-5 2-5 0z"/>
                            </svg>
                          ) : (
                            <svg className="xp-svg-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          )}
                        </div>
                        <div className="xp-card-title">{t.rewardTitle}</div>
                        <div className="xp-card-badge" style={{ background: isReached ? progressColor : "rgba(255,255,255,0.1)", color: isReached ? bgColor : "#aaa" }}>
                          {isReached ? "UNLOCKED" : `${currencySymbol}${t.targetAmount}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PREVIEW LAYOUT 3: Luxury Minimalist Bar */}
            {selectedLayout === "luxury_gradient" && (
              <div
                className="xp-bar-preview-box"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                style={{ background: bgColor, borderColor: `${progressColor}55` }}
              >
                <div className="xp-luxury-headline">
                  {nextTier ? (
                    <span>
                      {currentCopy.progressMessage.replace("{amount}", `${currencySymbol}${remaining}`)}
                    </span>
                  ) : (
                    <span>{currentCopy.allUnlockedMessage}</span>
                  )}
                </div>

                <div className="xp-luxury-bar-track">
                  <div className="xp-luxury-bar-fill" style={{ width: `${progressPercent}%`, background: progressColor }}>
                    <div className="xp-luxury-shimmer"></div>
                  </div>
                </div>

                <div className="xp-luxury-footer">
                  <span>Cart: {currencySymbol}{testCartValue.toFixed(2)}</span>
                  <span>Goal: {currencySymbol}{maxTier}</span>
                </div>
              </div>
            )}

            {/* PREVIEW LAYOUT 4: Split Achievement Ribbon */}
            {selectedLayout === "split_ribbon" && (
              <div
                className="xp-bar-preview-box"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                style={{ background: bgColor, borderColor: `${progressColor}55` }}
              >
                <div className="xp-split-ribbon-top">
                  <div className="xp-split-badge-achieved" style={{ borderColor: progressColor, color: progressColor }}>
                    <span>Level {sortedTiers.filter((t) => testCartValue >= t.targetAmount).length} Unlocked</span>
                  </div>
                  <div className="xp-split-next-target">
                    {nextTier ? `+${currencySymbol}${remaining} for ${nextTier.rewardTitle.split(" ")[0]}` : "All Unlocked"}
                  </div>
                </div>

                <div className="xp-split-track">
                  <div className="xp-split-fill" style={{ width: `${progressPercent}%`, background: progressColor }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </s-page>
  );
}

const SHIPPING_BAR_STYLES = `

  /* Native Luxury Dark Section Cards */
  .xp-section-card {
    background: #141414 !important;
    border: 1px solid #282828 !important;
    border-radius: 12px !important;
    padding: 24px !important;
    margin-bottom: 20px !important;
    color: #ffffff !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25) !important;
  }
  .xp-section-title {
    font-size: 16px !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    margin: 0 0 16px 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
  }

  .xp-shipping-layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 24px;
    margin-top: 16px;
  }
  @media (max-width: 960px) {
    .xp-shipping-layout {
      grid-template-columns: 1fr;
    }
  }
  .xp-section-intro {
    font-size: 13px;
    color: #b0b0b0;
    margin: 0 0 16px;
    line-height: 1.4;
  }
  .xp-sub {
    font-size: 12px;
    color: #888888;
    margin: 4px 0 12px;
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
    color: #ffffff;
  }
  .xp-input {
    padding: 8px 12px;
    border: 1px solid #333333;
    border-radius: 6px;
    font-size: 13px;
    background: #141414;
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

  /* Layout Selector Cards */
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
    border: 1px solid #282828;
    border-radius: 10px;
    padding: 14px;
    background: #141414;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .xp-layout-card:hover {
    border-color: #D4AF37;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  .xp-layout-card.is-selected {
    border-color: #D4AF37;
    background: #1f1d14;
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
    background: #222222;
    color: #444;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .xp-theme-check {
    font-size: 11px;
    font-weight: 700;
    color: #D4AF37;
  }
  .xp-layout-title {
    margin: 2px 0 0;
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
  }
  .xp-layout-desc {
    margin: 0;
    font-size: 11px;
    color: #888888;
    line-height: 1.35;
  }

  /* Milestone Tiers List */
  .xp-tiers-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .xp-tier-card {
    border: 1px solid #282828;
    border-radius: 8px;
    padding: 12px 14px;
    background: #181818;
  }
  .xp-tier-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .xp-tier-badge {
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    background: #222222;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .xp-tier-del {
    background: none;
    border: none;
    color: #ff5555;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .xp-btn-secondary {
    background: #141414;
    border: 1px solid #333333;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    align-self: flex-start;
  }
  .xp-color-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .xp-color-wrap input[type="color"] {
    width: 38px;
    height: 34px;
    border: 1px solid #333333;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
  }
  .xp-btn-submit {
    background: #0B0B0B;
    color: #D4AF37;
    border: 1px solid #D4AF37;
    padding: 12px 24px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    align-self: flex-start;
    transition: background 0.2s;
  }
  .xp-btn-submit:hover {
    background: #1c1c1c;
  }

  /* Simulator & Preview */
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
  .xp-slider-control {
    background: #181818;
    padding: 12px;
    border-radius: 8px;
    margin: 12px 0 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .xp-slider-control label {
    font-size: 12px;
    color: #ffffff;
  }
  .xp-range-slider {
    width: 100%;
    cursor: pointer;
    accent-color: #D4AF37;
  }

  .xp-bar-preview-box {
    border-width: 1px;
    border-style: solid;
    border-radius: 12px;
    padding: 16px;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .xp-bar-status-text {
    font-size: 13px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 14px;
    line-height: 1.35;
  }

  /* Stepper Roadmap */
  .xp-stepper-track-wrap {
    position: relative;
    padding: 10px 0 20px;
  }
  .xp-stepper-line-bg {
    position: absolute;
    top: 22px;
    left: 20px;
    right: 20px;
    height: 4px;
    background: #333;
    border-radius: 2px;
    z-index: 1;
  }
  .xp-stepper-line-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .xp-stepper-nodes {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
  }
  .xp-stepper-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .xp-node-circle {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    transition: all 0.2s ease;
  }
  .xp-node-amount {
    font-size: 11px;
    font-weight: 700;
    color: #fff;
  }
  .xp-node-title {
    font-size: 10px;
    color: #888;
  }

  /* Gamified Cards */
  .xp-cards-progress-bar {
    height: 6px;
    background: #333;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .xp-cards-progress-fill {
    height: 100%;
    transition: width 0.3s ease;
  }
  .xp-reward-cards-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .xp-reward-card-item {
    border-width: 1px;
    border-style: solid;
    border-radius: 8px;
    padding: 8px 6px;
    text-align: center;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .xp-card-icon-wrap {
    width: 20px;
    height: 20px;
  }
  .xp-card-title {
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    color: #fff;
    min-height: 24px;
    display: flex;
    align-items: center;
  }
  .xp-card-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.3px;
  }

  /* Luxury Gradient */
  .xp-luxury-headline {
    font-size: 13px;
    text-align: center;
    margin-bottom: 12px;
    font-weight: 600;
  }
  .xp-luxury-bar-track {
    height: 8px;
    background: #222;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  .xp-luxury-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  .xp-luxury-shimmer {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    animation: xpShimmer 2s infinite;
  }
  @keyframes xpShimmer {
    100% { left: 100%; }
  }
  .xp-luxury-footer {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #888;
    margin-top: 6px;
  }

  /* Split Ribbon */
  .xp-split-ribbon-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .xp-split-badge-achieved {
    border: 1px solid;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
  }
  .xp-split-next-target {
    font-size: 11px;
    color: #aaa;
    font-weight: 600;
  }
  .xp-split-track {
    height: 6px;
    background: #222;
    border-radius: 3px;
    overflow: hidden;
  }
  .xp-split-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  /* SVG Helpers */
  .xp-svg-micro {
    width: 14px;
    height: 14px;
  }
  .xp-svg-sm {
    width: 18px;
    height: 18px;
  }
`;
