import { Translate } from "../components/Translate";
import { useMemo, useState, type CSSProperties } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../shop.server";
import {
  DEFAULT_PERK_SETTINGS,
  sanitizePerkSettings,
  sanitizeTier,
  syncPerksDiscount,
} from "../perks.server";
import type { PerkSettings } from "../perks.server";
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
  rewardType?: string;
  rewardValue?: number;
  rewardCap?: number;
  rewardLabel?: string;
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

function symbolForCurrency(code: string): string {
  const c = String(code || "USD").toUpperCase();
  if (c === "EGP") return "LE ";
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency: c, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    const sym = part?.value || "";
    if (!sym || sym === "\u00a4") return `${c} `;
    return /^[A-Za-z]{2,}$/.test(sym) ? `${sym} ` : sym;
  } catch {
    return `${c} `;
  }
}

async function getShopCurrency(admin: any): Promise<string> {
  try {
    const res = await admin.graphql(`#graphql\nquery XpShipCurrency { shop { currencyCode } }`);
    const j = await res.json();
    return String(j?.data?.shop?.currencyCode || "USD").toUpperCase();
  } catch {
    return "USD";
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const shopCurrency = await getShopCurrency(admin);
  const shopSymbol = symbolForCurrency(shopCurrency);

  let config = await prisma.shippingBarConfig.findUnique({
    where: { shopId: shop.id },
  });

  if (!config) {
    config = await prisma.shippingBarConfig.create({
      data: {
        shopId: shop.id,
        active: true,
        currency: shopCurrency,
        currencySymbol: shopSymbol,
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

  // The bar always uses the store's own currency (never a hard-coded USD).
  if (config.currency !== shopCurrency || config.currencySymbol !== shopSymbol) {
    config = await prisma.shippingBarConfig.update({
      where: { shopId: shop.id },
      data: { currency: shopCurrency, currencySymbol: shopSymbol },
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
  let targeting: { mode: string; countries: string[]; overrides: { countries: string[]; tiers: Tier[] }[] } = { mode: "all", countries: [], overrides: [] };
  let perks: PerkSettings = DEFAULT_PERK_SETTINGS;
  try {
    const parsed = JSON.parse(config.tiersJson);
    if (Array.isArray(parsed)) {
      tiers = parsed;
    } else if (parsed && Array.isArray(parsed.tiers)) {
      tiers = parsed.tiers;
      if (parsed.layoutStyle) layoutStyle = parsed.layoutStyle;
      perks = sanitizePerkSettings(parsed.perks);
      const t = parsed.targeting;
      if (t && (t.mode === "include" || t.mode === "exclude") && Array.isArray(t.countries)) {
        targeting = { ...targeting, mode: t.mode, countries: t.countries.map((c: unknown) => String(c).toUpperCase()) };
      }
      if (t && Array.isArray(t.overrides)) {
        targeting.overrides = t.overrides
          .filter((o: { countries?: unknown; tiers?: unknown }) => Array.isArray(o?.countries) && Array.isArray(o?.tiers))
          .map((o: { countries: unknown[]; tiers: Tier[] }) => ({
            countries: o.countries.map((c) => String(c).toUpperCase()),
            tiers: o.tiers,
          }));
      }
    }
    if (tiers.length === 0) tiers = DEFAULT_TIERS;
  } catch {
    tiers = DEFAULT_TIERS;
  }

  return {
    shop,
    enabled: shop.shippingBarEnabled,
    config: { ...config, tiers, layoutStyle, targeting, perks },
    allTranslations,
    dashboardLocale,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const shopCurrency = await getShopCurrency(admin);
  const formData = await request.formData();

  const active = formData.get("active") === "on";
  const currency = shopCurrency;
  const currencySymbol = symbolForCurrency(shopCurrency);
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

  // Normalise milestones (reward type / value / cap / label) and sort ascending
  tiers = tiers
    .map((t) => sanitizeTier(t))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .sort((a, b) => a.targetAmount - b.targetAmount);
  if (tiers.length === 0) {
    return { error: "Add at least one milestone with a threshold and a reward name." };
  }

  let perks: PerkSettings;
  try {
    perks = sanitizePerkSettings(JSON.parse(String(formData.get("perksJson") || "{}")));
  } catch {
    perks = DEFAULT_PERK_SETTINGS;
  }

  const targetModeRaw = String(formData.get("targetMode") || "all");
  const targetCountries = Array.from(
    new Set(
      String(formData.get("targetCountries") || "")
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[A-Z]{2}$/.test(c)),
    ),
  );
  let overrides: { countries: string[]; tiers: Tier[] }[] = [];
  try {
    const rawOv = JSON.parse(String(formData.get("targetOverrides") || "[]"));
    if (Array.isArray(rawOv)) {
      overrides = rawOv
        .slice(0, 10)
        .map((o: { countries?: unknown; tiers?: unknown }) => {
          const countries = Array.from(
            new Set(
              (Array.isArray(o?.countries) ? o.countries : [])
                .map((c: unknown) => String(c).trim().toUpperCase())
                .filter((c: string) => /^[A-Z]{2}$/.test(c)),
            ),
          ) as string[];
          const ovTiers = (Array.isArray(o?.tiers) ? o.tiers : [])
            .map((t: Partial<Tier>) => sanitizeTier(t))
            .filter((t): t is NonNullable<ReturnType<typeof sanitizeTier>> => !!t)
            .sort((a, b) => a.targetAmount - b.targetAmount)
            .slice(0, 6);
          return { countries, tiers: ovTiers };
        })
        .filter((o) => o.countries.length > 0 && o.tiers.length > 0);
    }
  } catch {
    overrides = [];
  }
  const targeting = {
    mode: (targetModeRaw === "include" || targetModeRaw === "exclude") && targetCountries.length > 0 ? targetModeRaw : "all",
    countries: (targetModeRaw === "include" || targetModeRaw === "exclude") ? targetCountries : ([] as string[]),
    overrides,
  };

  const serializedTiers = JSON.stringify({
    tiers,
    layoutStyle,
    targeting,
    perks,
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

  const sync = await syncPerksDiscount(admin, {
    tiers: tiers as any,
    targeting: targeting as any,
    perks,
  });

  return {
    ok: true,
    message: "Tiered Shipping Bar configuration saved! " + sync.message,
    perksState: sync.state,
  };
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
  const currencySymbol = config.currencySymbol || "$";
  const [progressColor, setProgressColor] = useState(config.progressColor || "#D4AF37");
  const [bgColor, setBgColor] = useState(config.backgroundColor || "#0B0B0B");
  const [textColor, setTextColor] = useState(config.textColor || "#FFFFFF");
  const [trackColor, setTrackColor] = useState(config.trackColor || "#222222");
  const [targetMode, setTargetMode] = useState<string>(config.targeting?.mode || "all");
  const [targetCountries, setTargetCountries] = useState<string[]>(config.targeting?.countries || []);
  const [targetOverrides, setTargetOverrides] = useState<{ countries: string[]; tiers: Tier[] }[]>(
    (config.targeting?.overrides as { countries: string[]; tiers: Tier[] }[]) || [],
  );
  const countryNames = useMemo(() => buildCountryNames(), []);
  const updateOverride = (i: number, patch: Partial<{ countries: string[]; tiers: Tier[] }>) =>
    setTargetOverrides((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const [perks, setPerks] = useState<PerkSettings>(config.perks as PerkSettings);
  const patchOverrideTier = (oi: number, ti: number, patch: Partial<Tier>) =>
    setTargetOverrides((prev) =>
      prev.map((o, i) =>
        i === oi ? { ...o, tiers: o.tiers.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : o,
      ),
    );
  const previewVars = { color: textColor, "--xp-t": textColor, "--xp-track": trackColor } as CSSProperties;
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
            <div className="xp-section-card"><h3 className="xp-section-title"><Translate text='1. Choose Progress Bar Layout' /></h3>
              <p className="xp-section-intro">
                
                                              <Translate text='Select the visual structure and reward format that appears in the cart drawer and cart page.' />
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
            <div className="xp-section-card"><h3 className="xp-section-title"><Translate text='2. General & Multi-Language Messages' /></h3>
              <div className="xp-row">
                <label className="xp-toggle">
                  <input type="checkbox" name="active" defaultChecked={config.active} />
                  <span><Translate text='Enable Tiered Shipping Bar on storefront' /></span>
                </label>
              </div>

              <div className="xp-field">
                <label><Translate text='Store Currency' /></label>
                <input type="hidden" name="currency" value={config.currency} />
                <input type="hidden" name="currencySymbol" value={currencySymbol} />
                <div className="xp-input" style={{ opacity: 0.85 }}>
                  {config.currency} ({currencySymbol.trim()}<Translate text=') — taken automatically from your Shopify store settings.
                                                    Shoppers who see another market currency get thresholds converted automatically.' />
                                                  </div>
              </div>

              <FeatureLanguageSwitcher
                selectedLang={selectedLang}
                onSelectLang={setSelectedLang}
                onLoadPredefined={handleLoadPredefined}
                dashboardLocale={dashboardLocale}
              />

              <div className="xp-field">
                <label><Translate text='Initial Message / Empty Cart (' />{selectedLang.toUpperCase()})</label>
                <input
                  type="text"
                  className="xp-input"
                  dir={selectedLang === "ar" ? "rtl" : "ltr"}
                  value={currentCopy.initialMessage}
                  onChange={(e) => handleTextChange("initialMessage", e.target.value)}
                />
              </div>

              <div className="xp-field">
                <label><Translate text='Progress Toward Next Reward Message (' />{selectedLang.toUpperCase()})</label>
                <input
                  type="text"
                  className="xp-input"
                  dir={selectedLang === "ar" ? "rtl" : "ltr"}
                  value={currentCopy.progressMessage}
                  onChange={(e) => handleTextChange("progressMessage", e.target.value)}
                />
                <small><Translate text='Use &#123;amount&#125; variable for remaining distance to reward.' /></small>
              </div>

              <div className="xp-field">
                <label><Translate text='All Tiers Unlocked Message (' />{selectedLang.toUpperCase()})</label>
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
            <div className="xp-section-card"><h3 className="xp-section-title"><Translate text='3. Milestone Tiers' /></h3>
              <p className="xp-sub"><Translate text='Set sequential order thresholds and unlockable incentives.' /></p>

              <div className="xp-tiers-list">
                {tiers.map((tier, idx) => (
                  <div key={idx} className="xp-tier-card">
                    <div className="xp-tier-header">
                      <span className="xp-tier-badge"><Translate text='Tier' /> {idx + 1}</span>
                      {tiers.length > 1 && (
                        <button type="button" onClick={() => removeTier(idx)} className="xp-tier-del">
                          
                                                              <Translate text='Remove' />
                                                            </button>
                      )}
                    </div>
                    <div className="xp-grid-2">
                      <div className="xp-field">
                        <label><Translate text='Threshold Amount (' />{currencySymbol})</label>
                        <input
                          type="number"
                          className="xp-input"
                          value={tier.targetAmount}
                          onChange={(e) => updateTier(idx, { targetAmount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="xp-field">
                        <label><Translate text='Reward Name' /></label>
                        <input
                          type="text"
                          className="xp-input"
                          value={tier.rewardTitle}
                          onChange={(e) => updateTier(idx, { rewardTitle: e.target.value })}
                        />
                      </div>
                    </div>
                    <RewardFields tier={tier} symbol={currencySymbol} onChange={(patch) => updateTier(idx, patch)} />
                  </div>
                ))}
              </div>

              <button type="button" onClick={addTier} className="xp-btn-secondary">
                
                                              <Translate text='+ Add Another Milestone' />
                                            </button>
            </div>

            {/* Appearance */}
            <div className="xp-section-card"><h3 className="xp-section-title"><Translate text='4. Palette Customization' /></h3>
              <div className="xp-grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <div className="xp-field">
                  <label><Translate text='Progress Accent' /></label>
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
                  <label><Translate text='Background' /></label>
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
                  <label><Translate text='Track Background' /></label>
                  <div className="xp-color-wrap">
                    <input
                      type="color"
                      name="trackColor"
                      value={trackColor}
                      onChange={(e) => setTrackColor(e.target.value)}
                    />
                    <span>{trackColor}</span>
                  </div>
                </div>
                <div className="xp-field">
                  <label><Translate text='Text Color' /></label>
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
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="xp-btn-secondary"
                  onClick={() => { setBgColor("#0B0B0B"); setTextColor("#FFFFFF"); setTrackColor("#222222"); setProgressColor("#D4AF37"); }}
                >
                  
                                                    <Translate text='Dark preset' />
                                                  </button>
                <button
                  type="button"
                  className="xp-btn-secondary"
                  onClick={() => { setBgColor("#FFFFFF"); setTextColor("#1A1A1A"); setTrackColor("#E5E5E5"); setProgressColor("#B8860B"); }}
                >
                  
                                                    <Translate text='Light preset' />
                                                  </button>
              </div>
            </div>

            {/* Audience targeting */}
            <div className="xp-section-card">
              <h3 className="xp-section-title"><Translate text='5. Audience Targeting' /></h3>
              <p className="xp-sub" style={{ margin: "0 0 12px" }}>
                
                                              <Translate text='Choose which visitors see the perk bar. Rules always follow the country your customer picks in your store&apos;s country selector (Markets): the bar updates whenever they change it, and checkout uses the same country.' />
                                            </p>
              <input type="hidden" name="targetMode" value={targetCountries.length === 0 ? "all" : targetMode} />
              <input type="hidden" name="targetCountries" value={targetCountries.join(",")} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {[
                  { id: "all", label: "Show to visitors from all countries" },
                  { id: "include", label: "Show only to visitors from the countries below" },
                  { id: "exclude", label: "Hide from visitors from the countries below" },
                ].map((o) => (
                  <label key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="targetModeRadio"
                      checked={targetMode === o.id}
                      onChange={() => setTargetMode(o.id)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              {targetMode !== "all" && (
                <CountryPicker value={targetCountries} onChange={setTargetCountries} names={countryNames} />
              )}
            </div>

            {/* Country-specific rewards */}
            <div className="xp-section-card">
              <h3 className="xp-section-title"><Translate text='6. Country-Specific Rewards' /></h3>
              <p className="xp-sub" style={{ margin: "0 0 12px" }}>
                
                                              <Translate text='Give selected countries their own reward ladder (different thresholds and rewards). Visitors from any other country
                                              see the default milestones from section 3. Amounts are entered in your store currency (' />{config.currency}<Translate text=') and are
                                              converted automatically for shoppers who see another currency. If a visitor matches several rules, the first one is used.' />
                                            </p>
              <input type="hidden" name="targetOverrides" value={JSON.stringify(targetOverrides)} />

              {targetOverrides.map((ov, oi) => (
                <div
                  key={oi}
                  style={{ border: "1px solid rgba(212,175,55,0.35)", borderRadius: 10, padding: 14, marginBottom: 14 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <strong><Translate text='Rule' /> {oi + 1}: {ov.countries.length ? ov.countries.join(", ") : "no countries yet"}</strong>
                    <button
                      type="button"
                      className="xp-btn-secondary"
                      onClick={() => setTargetOverrides((prev) => prev.filter((_, i) => i !== oi))}
                    >
                      
                                                    <Translate text='Delete rule' />
                                                  </button>
                  </div>

                  <CountryPicker
                    value={ov.countries}
                    onChange={(countries) => updateOverride(oi, { countries })}
                    names={countryNames}
                    label="Countries for this rule"
                  />

                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}><Translate text='Rewards for these countries' /></label>
                    {ov.tiers.map((t, ti) => (
                      <div key={ti} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: "1px dashed rgba(255,255,255,0.12)" }}>
                      <div
                        style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}
                      >
                        <input
                          type="number"
                          min="1"
                          className="xp-input"
                          value={t.targetAmount}
                          onChange={(e) =>
                            updateOverride(oi, {
                              tiers: ov.tiers.map((x, i) => (i === ti ? { ...x, targetAmount: parseFloat(e.target.value) || 0 } : x)),
                            })
                          }
                        />
                        <input
                          type="text"
                          className="xp-input"
                          placeholder="Reward title"
                          value={t.rewardTitle}
                          onChange={(e) =>
                            updateOverride(oi, {
                              tiers: ov.tiers.map((x, i) => (i === ti ? { ...x, rewardTitle: sanitizeText(e.target.value) } : x)),
                            })
                          }
                        />
                        <input
                          type="text"
                          className="xp-input"
                          placeholder="Unlocked message"
                          value={t.unlockedMessage}
                          onChange={(e) =>
                            updateOverride(oi, {
                              tiers: ov.tiers.map((x, i) => (i === ti ? { ...x, unlockedMessage: sanitizeText(e.target.value) } : x)),
                            })
                          }
                        />
                        <button
                          type="button"
                          className="xp-btn-secondary"
                          aria-label="Remove reward"
                          disabled={ov.tiers.length <= 1}
                          onClick={() => updateOverride(oi, { tiers: ov.tiers.filter((_, i) => i !== ti) })}
                        >
                          
                                                              <Translate text='&times;' />
                                                            </button>
                      </div>
                      <RewardFields tier={t} symbol={currencySymbol} onChange={(patch) => patchOverrideTier(oi, ti, patch)} />
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="xp-btn-secondary"
                        disabled={ov.tiers.length >= 6}
                        onClick={() => {
                          const last = ov.tiers[ov.tiers.length - 1];
                          updateOverride(oi, {
                            tiers: [
                              ...ov.tiers,
                              {
                                targetAmount: last ? last.targetAmount + 50 : 50,
                                rewardTitle: `Reward Level ${ov.tiers.length + 1}`,
                                unlockedMessage: `Unlocked Level ${ov.tiers.length + 1}!`,
                              },
                            ],
                          });
                        }}
                      >
                        
                                                          <Translate text='+ Add reward' />
                                                        </button>
                      <button
                        type="button"
                        className="xp-btn-secondary"
                        onClick={() => updateOverride(oi, { tiers: tiers.map((t) => ({ ...t })) })}
                      >
                        
                                                          <Translate text='Copy default milestones' />
                                                        </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="xp-btn-secondary"
                disabled={targetOverrides.length >= 10}
                onClick={() =>
                  setTargetOverrides((prev) => [...prev, { countries: [], tiers: tiers.map((t) => ({ ...t })) }])
                }
              >
                
                                              <Translate text='+ Add country rule' />
                                            </button>
            </div>

            {/* Checkout rewards (Shopify Function) */}
            <div className="xp-section-card">
              <h3 className="xp-section-title"><Translate text='7. Checkout Rewards (applied automatically)' /></h3>
              <p className="xp-sub" style={{ margin: "0 0 12px" }}>
                
                                              <Translate text='Milestones with a reward type other than &quot;Display only&quot; are applied at checkout by a Shopify Function, so what the
                                              bar promises is exactly what the customer gets &mdash; no discount codes needed. It appears in your Shopify admin under
                                              Discounts as &quot;Tier Perks Rewards&quot;.' />
                                            </p>
              <input type="hidden" name="perksJson" value={JSON.stringify(perks)} />

              <div className="xp-field">
                <label><Translate text='When a cart unlocks several rewards' /></label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                    <input type="radio" name="perkStacking" checked={perks.stacking === "best"} onChange={() => setPerks({ ...perks, stacking: "best" })} />
                    <span><Translate text='Give only the best reward of each kind (recommended)' /></span>
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                    <input type="radio" name="perkStacking" checked={perks.stacking === "all"} onChange={() => setPerks({ ...perks, stacking: "all" })} />
                    <span><Translate text='Stack every unlocked reward' /></span>
                  </label>
                </div>
              </div>

              <div className="xp-field">
                <label><Translate text='Can combine with your other Shopify discounts' /></label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={perks.combineProduct} onChange={(e) => setPerks({ ...perks, combineProduct: e.target.checked })} />
                    <span><Translate text='Product discounts' /></span>
                  </label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={perks.combineOrder} onChange={(e) => setPerks({ ...perks, combineOrder: e.target.checked })} />
                    <span><Translate text='Order discounts' /></span>
                  </label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={perks.combineShipping} onChange={(e) => setPerks({ ...perks, combineShipping: e.target.checked })} />
                    <span><Translate text='Shipping discounts' /></span>
                  </label>
                </div>
              </div>

              <div className="xp-grid-2">
                <div className="xp-field">
                  <label><Translate text='Campaign starts (optional, UTC)' /></label>
                  <input type="date" className="xp-input" value={perks.startsAt ? perks.startsAt.slice(0, 10) : ""} onChange={(e) => setPerks({ ...perks, startsAt: e.target.value })} />
                </div>
                <div className="xp-field">
                  <label><Translate text='Campaign ends (optional, UTC)' /></label>
                  <input type="date" className="xp-input" value={perks.endsAt ? perks.endsAt.slice(0, 10) : ""} onChange={(e) => setPerks({ ...perks, endsAt: e.target.value })} />
                </div>
              </div>

              <div className="xp-field">
                <label><Translate text='What will be applied' /></label>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                  {tiers.some(isFunctionalTier) ? (
                    [...tiers].sort((a, b) => a.targetAmount - b.targetAmount).filter(isFunctionalTier).map((t, i) => (
                      <li key={`d${i}`}>
                        <strong><Translate text='Everyone' />{targetCountries.length ? (targetMode === "include" ? " in the selected countries" : " outside the selected countries") : ""}:</strong>{" "}
                        
                                                    <Translate text='cart of' /> {currencySymbol}{t.targetAmount}<Translate text='+ &rarr;' /> {describeReward(t, currencySymbol)}
                      </li>
                    ))
                  ) : (
                    <li><Translate text='Nothing yet. Set a reward type on a milestone above.' /></li>
                  )}
                  {targetOverrides.filter((o) => o.countries.length).map((o, oi) =>
                    [...o.tiers].sort((a, b) => a.targetAmount - b.targetAmount).filter(isFunctionalTier).map((t, i) => (
                      <li key={`o${oi}-${i}`}>
                        <strong>{o.countries.join(", ")}:</strong>  <Translate text='cart of' /> {currencySymbol}{t.targetAmount}<Translate text='+ &rarr;' /> {describeReward(t, currencySymbol)}
                      </li>
                    )),
                  )}
                </ul>
                <small><Translate text='Amounts are in' /> {config.currency}  <Translate text='and converted automatically for other currencies. Thresholds use the cart subtotal before shipping and tax.' /></small>
              </div>

              {actionData && "perksState" in actionData && actionData.perksState === "not_deployed" && (
                <s-banner tone="warning">
                  
                                                    <Translate text='The rewards engine has not been deployed yet. Run' /> <code><Translate text='shopify app deploy' /></code><Translate text=', then save this page again.' />
                                                  </s-banner>
              )}
              {actionData && "perksState" in actionData && actionData.perksState === "error" && (
                <s-banner tone="critical"><Translate text='Checkout rewards could not be synced. See the message above and try saving again.' /></s-banner>
              )}

              <a
                href="shopify:admin/discounts"
                target="_top"
                className="xp-btn-secondary"
                style={{ display: "inline-block", textDecoration: "none", marginTop: 10 }}
              >
                
                                              <Translate text='View in Shopify Discounts &rarr;' />
                                            </a>
            </div>

            {/* Real free shipping note */}
            <div className="xp-section-card xp-ship-note">
              <h3 className="xp-section-title"><Translate text='Free shipping and your store&apos;s shipping rates' /></h3>
              <p className="xp-sub" style={{ margin: "0 0 10px" }}>
                
                                              <Translate text='The easiest way: set a milestone&apos;s reward to' /> <strong><Translate text='Free shipping' /></strong>  <Translate text='(or a shipping discount) above. The rewards engine then
                                              discounts your existing shipping rates automatically at checkout. It can only discount rates that exist, so make sure your
                                              shipping profile has at least one rate for the countries you sell to.
                                              Prefer to manage it yourself? Leave the reward as' /> <strong><Translate text='Display only' /></strong>  <Translate text='and create a matching free-shipping rate with the same
                                              minimum order price in your Shopify shipping settings (Shipping and delivery &rarr; your profile &rarr; Add rate &rarr; condition based on order price),
                                              keeping the amount identical to the milestone here.' />
                                            </p>
              <a
                href="shopify:admin/settings/shipping"
                target="_top"
                className="xp-btn-secondary"
                style={{ display: "inline-block", textDecoration: "none" }}
              >
                
                                              <Translate text='Open Shipping &amp; delivery settings &rarr;' />
                                            </a>
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
              <h3><Translate text='Interactive Cart Simulator' /></h3>
              <span className="xp-preview-tag">
                {SHIPPING_LAYOUTS.find((l) => l.id === selectedLayout)?.name.split(" ")[0]}
              </span>
            </div>
            <p className="xp-sub"><Translate text='Drag the slider to test milestones and progress transitions.' /></p>

            <div className="xp-slider-control">
              <label>
                
                                              <Translate text='Simulated Cart Total:' /> <strong>{currencySymbol}{testCartValue.toFixed(2)}</strong>
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
                style={{ ...previewVars, background: bgColor, borderColor: `${progressColor}55` }}
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
                              borderColor: isReached ? progressColor : "color-mix(in srgb, var(--xp-t) 35%, transparent)",
                              background: isReached ? progressColor : bgColor,
                              color: isReached ? bgColor : "color-mix(in srgb, var(--xp-t) 65%, transparent)",
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
                style={{ ...previewVars, background: bgColor, borderColor: `${progressColor}55` }}
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
                        style={{ borderColor: isReached ? progressColor : "color-mix(in srgb, var(--xp-t) 16%, transparent)" }}
                      >
                        <div className="xp-card-icon-wrap" style={{ color: isReached ? progressColor : "color-mix(in srgb, var(--xp-t) 50%, transparent)" }}>
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
                        <div className="xp-card-badge" style={{ background: isReached ? progressColor : "color-mix(in srgb, var(--xp-t) 12%, transparent)", color: isReached ? bgColor : "color-mix(in srgb, var(--xp-t) 75%, transparent)" }}>
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
                style={{ ...previewVars, background: bgColor, borderColor: `${progressColor}55` }}
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
                  <span><Translate text='Cart:' /> {currencySymbol}{testCartValue.toFixed(2)}</span>
                  <span><Translate text='Goal:' /> {currencySymbol}{maxTier}</span>
                </div>
              </div>
            )}

            {/* PREVIEW LAYOUT 4: Split Achievement Ribbon */}
            {selectedLayout === "split_ribbon" && (
              <div
                className="xp-bar-preview-box"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                style={{ ...previewVars, background: bgColor, borderColor: `${progressColor}55` }}
              >
                <div className="xp-split-ribbon-top">
                  <div className="xp-split-badge-achieved" style={{ borderColor: progressColor, color: progressColor }}>
                    <span><Translate text='Level' /> {sortedTiers.filter((t) => testCartValue >= t.targetAmount).length}  <Translate text='Unlocked' /></span>
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

const REWARD_OPTIONS: { id: string; label: string }[] = [
  { id: "display", label: "Display only (no automatic discount)" },
  { id: "free_shipping", label: "Free shipping" },
  { id: "shipping_percent", label: "% off shipping" },
  { id: "shipping_fixed", label: "Fixed amount off shipping" },
  { id: "order_percent", label: "% off the whole order" },
  { id: "order_fixed", label: "Fixed amount off the whole order" },
];

function isFunctionalTier(t: Tier): boolean {
  if (!t.rewardType || t.rewardType === "display") return false;
  if (t.rewardType === "free_shipping") return true;
  return (t.rewardValue || 0) > 0;
}

function suggestRewardTitle(type: string, value: number, symbol: string, current: string): string {
  const v = Number(value) || 0;
  switch (type) {
    case "free_shipping": return "Free Shipping";
    case "shipping_percent": return v ? `${v}% Off Shipping` : current;
    case "shipping_fixed": return v ? `${symbol}${v} Off Shipping` : current;
    case "order_percent": return v ? `${v}% Off Your Order` : current;
    case "order_fixed": return v ? `${symbol}${v} Off Your Order` : current;
    default: return current;
  }
}

function describeReward(t: Tier, symbol: string): string {
  const v = Number(t.rewardValue) || 0;
  switch (t.rewardType) {
    case "free_shipping": return "free shipping";
    case "shipping_percent": return `${v}% off shipping`;
    case "shipping_fixed": return `${symbol}${v} off shipping`;
    case "order_percent": return `${v}% off the order${t.rewardCap ? ` (max ${symbol}${t.rewardCap})` : ""}`;
    case "order_fixed": return `${symbol}${v} off the order`;
    default: return "display only";
  }
}

function RewardFields({
  tier,
  symbol,
  onChange,
}: {
  tier: Tier;
  symbol: string;
  onChange: (patch: Partial<Tier>) => void;
}) {
  const type = tier.rewardType || "display";
  const needsValue = type !== "display" && type !== "free_shipping";
  const isPercent = type === "shipping_percent" || type === "order_percent";

  // Keep the reward name in sync with the reward while it is still auto-generated.
  const withTitle = (nextType: string, nextValue: number): Partial<Tier> => {
    const previousAuto = suggestRewardTitle(type, tier.rewardValue || 0, symbol, "");
    const looksAuto =
      !tier.rewardTitle ||
      tier.rewardTitle === previousAuto ||
      /^Reward Level \d+$/.test(tier.rewardTitle) ||
      ["Free Standard Shipping", "Free Express Priority", "Free Mystery Luxury Gift"].includes(tier.rewardTitle);
    if (!looksAuto) return {};
    const next = suggestRewardTitle(nextType, nextValue, symbol, tier.rewardTitle);
    return next && next !== tier.rewardTitle ? { rewardTitle: next, unlockedMessage: `${next} Unlocked!` } : {};
  };

  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(212,175,55,0.06)", border: "1px dashed rgba(212,175,55,0.35)" }}>
      <div className="xp-field" style={{ marginBottom: 8 }}>
        <label><Translate text='Checkout reward' /></label>
        <select
          className="xp-input"
          value={type}
          onChange={(e) => {
            const nextType = e.target.value;
            onChange({
              rewardType: nextType,
              rewardValue: nextType === "display" || nextType === "free_shipping" ? undefined : tier.rewardValue || (nextType.endsWith("percent") ? 10 : 5),
              rewardCap: nextType === "order_percent" ? tier.rewardCap : undefined,
              ...withTitle(nextType, tier.rewardValue || (nextType.endsWith("percent") ? 10 : 5)),
            });
          }}
        >
          {REWARD_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>
      {type !== "display" && (
        <div className="xp-grid-2" style={{ gap: 8 }}>
          {needsValue && (
            <div className="xp-field" style={{ marginBottom: 0 }}>
              <label>{isPercent ? "Discount (%)" : `Discount amount (${symbol.trim()})`}</label>
              <input
                type="number"
                min="0"
                max={isPercent ? 100 : undefined}
                className="xp-input"
                value={tier.rewardValue ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  onChange({ rewardValue: v, ...withTitle(type, v) });
                }}
              />
            </div>
          )}
          {type === "order_percent" && (
            <div className="xp-field" style={{ marginBottom: 0 }}>
              <label><Translate text='Max discount (' />{symbol.trim()}<Translate text=', optional)' /></label>
              <input
                type="number"
                min="0"
                className="xp-input"
                value={tier.rewardCap ?? ""}
                placeholder="No cap"
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onChange({ rewardCap: Number.isFinite(v) && v > 0 ? v : undefined });
                }}
              />
            </div>
          )}
          <div className="xp-field" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
            <label><Translate text='Label shown at checkout (optional)' /></label>
            <input
              type="text"
              className="xp-input"
              value={tier.rewardLabel ?? ""}
              placeholder={tier.rewardTitle || "Defaults to the reward name"}
              onChange={(e) => onChange({ rewardLabel: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" ");

const COUNTRY_GROUPS: { label: string; codes: string[] }[] = [
  { label: "Gulf (GCC)", codes: ["SA", "AE", "KW", "QA", "BH", "OM"] },
  { label: "Arab world", codes: ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "LB", "IQ", "MA", "DZ", "TN", "LY", "SD", "YE", "SY", "PS"] },
  { label: "North America", codes: ["US", "CA", "MX"] },
  { label: "Europe (EU)", codes: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"] },
];

function buildCountryNames(): Record<string, string> {
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames(["en"], { type: "region" }); } catch { dn = null; }
  const map: Record<string, string> = {};
  for (const c of COUNTRY_CODES) {
    let n = c;
    try { n = (dn && dn.of(c)) || c; } catch { n = c; }
    map[c] = n;
  }
  return map;
}

function CountryPicker({
  value,
  onChange,
  names,
  label = "Add a country",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  names: Record<string, string>;
  label?: string;
}) {
  const [search, setSearch] = useState("");
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as string[];
    return COUNTRY_CODES.filter(
      (c) => !value.includes(c) && (c.toLowerCase() === q || (names[c] || c).toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [search, value, names]);
  const add = (codes: string[]) => onChange(Array.from(new Set([...value, ...codes])));

  return (
    <div>
      <div className="xp-field">
        <label>{label}</label>
        <input
          type="text"
          className="xp-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type a country name or code (e.g. Egypt, SA)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) { add([matches[0]]); setSearch(""); }
            }
          }}
        />
        {matches.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {matches.map((c) => (
              <button key={c} type="button" className="xp-btn-secondary" onClick={() => { add([c]); setSearch(""); }}>
                + {names[c]} ({c})
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
        <span className="xp-sub" style={{ alignSelf: "center" }}><Translate text='Quick add:' /></span>
        {COUNTRY_GROUPS.map((g) => (
          <button key={g.label} type="button" className="xp-btn-secondary" onClick={() => add(g.codes)}>
            {g.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {value.length === 0 && <span className="xp-sub"><Translate text='No countries selected yet.' /></span>}
        {value.map((c) => (
          <span
            key={c}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
              borderRadius: 999, background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.5)", fontSize: 12,
            }}
          >
            {names[c] || c} ({c})
            <button
              type="button"
              aria-label={`Remove ${c}`}
              onClick={() => onChange(value.filter((x) => x !== c))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              
                                  <Translate text='&times;' />
                                </button>
          </span>
        ))}
        {value.length > 0 && (
          <button type="button" className="xp-btn-secondary" onClick={() => onChange([])}>
            
                                  <Translate text='Clear all' />
                                </button>
        )}
      </div>
    </div>
  );
}

const SHIPPING_BAR_STYLES = `

  /* High-Contrast Layout Choice Badges & Cards */
  .xp-layouts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  @media (max-width: 600px) {
    .xp-layouts-grid {
      grid-template-columns: 1fr;
    }
  }
  .xp-layout-card {
    border: 1px solid #333333 !important;
    border-radius: 10px !important;
    padding: 16px !important;
    background: #181818 !important;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .xp-layout-card:hover {
    border-color: rgba(212, 175, 55, 0.6) !important;
    background: #1f1f1f !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4) !important;
  }
  .xp-layout-card.is-selected {
    border-color: #D4AF37 !important;
    background: #1e1b12 !important;
    box-shadow: 0 0 0 1px #D4AF37, 0 4px 18px rgba(212, 175, 55, 0.25) !important;
  }
  .xp-layout-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .xp-layout-name, .xp-layout-title {
    font-size: 14px !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    margin: 0 !important;
  }
  .xp-layout-card.is-selected .xp-layout-name,
  .xp-layout-card.is-selected .xp-layout-title {
    color: #F5D77F !important;
  }
  .xp-layout-badge {
    font-size: 10px !important;
    font-weight: 800 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.6px !important;
    background: rgba(212, 175, 55, 0.15) !important;
    color: #D4AF37 !important;
    border: 1px solid rgba(212, 175, 55, 0.4) !important;
    padding: 3px 8px !important;
    border-radius: 4px !important;
    display: inline-block !important;
    white-space: nowrap !important;
  }
  .xp-layout-card.is-selected .xp-layout-badge {
    background: #D4AF37 !important;
    color: #0B0B0B !important;
    border-color: #D4AF37 !important;
    font-weight: 900 !important;
  }
  .xp-layout-desc {
    margin: 0 !important;
    font-size: 12px !important;
    color: #c4c4c4 !important;
    line-height: 1.45 !important;
  }


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
    color: #D4AF37 !important; margin: 0 0 16px 0 !important; border-bottom: 1px solid #282828 !important; padding-bottom: 12px !important;
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
    color: var(--xp-t, #fff);
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
    background: var(--xp-track, #333);
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
    color: var(--xp-t, #fff);
  }
  .xp-node-title {
    font-size: 10px;
    color: color-mix(in srgb, var(--xp-t, #fff) 65%, transparent);
  }

  /* Gamified Cards */
  .xp-cards-progress-bar {
    height: 6px;
    background: var(--xp-track, #333);
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
    background: color-mix(in srgb, var(--xp-t, #fff) 6%, transparent);
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
    color: var(--xp-t, #fff);
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
    background: var(--xp-track, #222);
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
    color: color-mix(in srgb, var(--xp-t, #fff) 65%, transparent);
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
    color: color-mix(in srgb, var(--xp-t, #fff) 80%, transparent);
    font-weight: 600;
  }
  .xp-split-track {
    height: 6px;
    background: var(--xp-track, #222);
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
