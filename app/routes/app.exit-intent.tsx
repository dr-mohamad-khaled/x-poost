import { useEffect, useState } from "react";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  let config = await prisma.exitIntentConfig.findUnique({
    where: { shopId: shop.id },
  });

  if (!config) {
    config = await prisma.exitIntentConfig.create({
      data: {
        shopId: shop.id,
        active: true,
        countdownSeconds: 600,
        discountCode: "SAVE10",
        headline: "Wait! Don't leave empty handed",
        bodyText: "Take an extra 10% off your entire order right now before this VIP deal expires.",
        buttonText: "Claim 10% Off & Checkout",
        suppressionDays: 1,
        backgroundColor: "#0B0B0B",
        accentColor: "#D4AF37",
        textColor: "#FFFFFF",
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

  return {
    shop,
    enabled: shop.exitIntentEnabled,
    config,
    allTranslations,
    dashboardLocale,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();

  const active = formData.get("active") === "on";
  const countdownSeconds = Math.max(30, parseInt(String(formData.get("countdownSeconds") || "600"), 10));
  const discountCode = String(formData.get("discountCode") || "SAVE10").trim();
  const headline = String(formData.get("headline") || "Wait! Don't leave empty handed");
  const bodyText = String(formData.get("bodyText") || "Take an extra 10% off your entire order right now.");
  const buttonText = String(formData.get("buttonText") || "Claim 10% Off & Checkout");
  const suppressionDays = Math.max(1, parseInt(String(formData.get("suppressionDays") || "1"), 10));
  const backgroundColor = String(formData.get("backgroundColor") || "#0B0B0B");
  const accentColor = String(formData.get("accentColor") || "#D4AF37");
  const textColor = String(formData.get("textColor") || "#FFFFFF");
  const translationsJsonRaw = String(formData.get("translationsJson") || "");

  await prisma.exitIntentConfig.upsert({
    where: { shopId: shop.id },
    update: {
      active,
      countdownSeconds,
      discountCode,
      headline,
      bodyText,
      buttonText,
      suppressionDays,
      backgroundColor,
      accentColor,
      textColor,
    },
    create: {
      shopId: shop.id,
      active,
      countdownSeconds,
      discountCode,
      headline,
      bodyText,
      buttonText,
      suppressionDays,
      backgroundColor,
      accentColor,
      textColor,
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
      console.error("[Exit Intent Action] Error updating translationConfig:", e);
    }
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: { exitIntentEnabled: active },
  });

  return { ok: true, message: "Exit-Intent Saver settings saved!" };
};

export default function ExitIntentSettings() {
  const { config, allTranslations, dashboardLocale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(dashboardLocale || "ar");
  const [translationsMap, setTranslationsMap] = useState(allTranslations);

  const currentCopy = translationsMap[selectedLang]?.exitIntent || DEFAULT_TRANSLATIONS_BY_LANG[selectedLang].exitIntent;

  const handleTextChange = (field: "headline" | "bodyText" | "buttonText" | "dismissText", val: string) => {
    const clean = sanitizeText(val);
    setTranslationsMap((prev) => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        exitIntent: {
          ...prev[selectedLang].exitIntent,
          [field]: clean,
        },
      },
    }));
  };

  const handleLoadPredefined = () => {
    const def = DEFAULT_TRANSLATIONS_BY_LANG[selectedLang].exitIntent;
    setTranslationsMap((prev) => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        exitIntent: { ...def },
      },
    }));
  };

  const [code, setCode] = useState(config.discountCode || "SAVE10");
  const [accentColor, setAccentColor] = useState(config.accentColor || "#D4AF37");
  const [bgColor, setBgColor] = useState(config.backgroundColor || "#0B0B0B");
  const [copied, setCopied] = useState(false);

  // Live countdown timer in preview
  const [timeLeft, setTimeLeft] = useState(config.countdownSeconds || 600);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  function handleCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <s-page heading="Exit-Intent Countdown Saver Modal">
      <style>{EXIT_INTENT_STYLES}</style>

      {actionData && "ok" in actionData ? (
        <s-banner tone="success">{actionData.message}</s-banner>
      ) : null}

      <div className="xp-exit-layout">
        <div className="xp-exit-config">
          <Form method="post" className="xp-form">
            <input type="hidden" name="translationsJson" value={JSON.stringify(translationsMap)} />
            <input type="hidden" name="headline" value={currentCopy.headline} />
            <input type="hidden" name="bodyText" value={currentCopy.bodyText} />
            <input type="hidden" name="buttonText" value={currentCopy.buttonText} />

            <s-section heading="General & Trigger Logic">
              <div className="xp-row">
                <label className="xp-toggle">
                  <input type="checkbox" name="active" defaultChecked={config.active} />
                  <span>Enabled on storefront</span>
                </label>
              </div>

              <div className="xp-grid-2">
                <div className="xp-field">
                  <label>Countdown Duration (seconds)</label>
                  <input
                    type="number"
                    name="countdownSeconds"
                    className="xp-input"
                    defaultValue={config.countdownSeconds}
                    step="30"
                    min="30"
                  />
                  <small>Default: 600 seconds (10 minutes)</small>
                </div>
                <div className="xp-field">
                  <label>Suppression Window (Days)</label>
                  <input
                    type="number"
                    name="suppressionDays"
                    className="xp-input"
                    defaultValue={config.suppressionDays}
                    min="1"
                  />
                  <small>Days before a dismissed modal shows again to the same visitor.</small>
                </div>
              </div>
            </s-section>

            <s-section heading="Offer & Multi-Language Copy">
              <FeatureLanguageSwitcher
                selectedLang={selectedLang}
                onSelectLang={setSelectedLang}
                onLoadPredefined={handleLoadPredefined}
                dashboardLocale={dashboardLocale}
              />

              <div className="xp-grid-2">
                <div className="xp-field">
                  <label>Discount Coupon Code</label>
                  <input
                    type="text"
                    name="discountCode"
                    className="xp-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="xp-field">
                  <label>Call to Action Button ({selectedLang.toUpperCase()})</label>
                  <input
                    type="text"
                    className="xp-input"
                    dir={selectedLang === "ar" ? "rtl" : "ltr"}
                    value={currentCopy.buttonText}
                    onChange={(e) => handleTextChange("buttonText", e.target.value)}
                  />
                </div>
              </div>

              <div className="xp-field">
                <label>Headline ({selectedLang.toUpperCase()})</label>
                <input
                  type="text"
                  className="xp-input"
                  dir={selectedLang === "ar" ? "rtl" : "ltr"}
                  value={currentCopy.headline}
                  onChange={(e) => handleTextChange("headline", e.target.value)}
                />
              </div>

              <div className="xp-field">
                <label>Body Text ({selectedLang.toUpperCase()})</label>
                <textarea
                  className="xp-input"
                  rows={3}
                  dir={selectedLang === "ar" ? "rtl" : "ltr"}
                  value={currentCopy.bodyText}
                  onChange={(e) => handleTextChange("bodyText", e.target.value)}
                />
              </div>

              <div className="xp-field">
                <label>Dismiss Button / Text ({selectedLang.toUpperCase()})</label>
                <input
                  type="text"
                  className="xp-input"
                  dir={selectedLang === "ar" ? "rtl" : "ltr"}
                  value={currentCopy.dismissText}
                  onChange={(e) => handleTextChange("dismissText", e.target.value)}
                />
              </div>
            </s-section>

            <s-section heading="Appearance">
              <div className="xp-grid-3">
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
                  <label>Accent Gold</label>
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
                      defaultValue={config.textColor || "#FFFFFF"}
                    />
                    <span>{config.textColor || "#FFFFFF"}</span>
                  </div>
                </div>
              </div>
            </s-section>

            <button type="submit" className="xp-btn-gold" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Exit Saver"}
            </button>
          </Form>
        </div>

        <div className="xp-exit-preview-wrap">
          <div className="xp-preview-sticky">
            <h3>Live Exit-Intent Modal Preview ({selectedLang.toUpperCase()})</h3>
            <p className="xp-sub">Triggers on top-viewport cursor breach or rapid upward mobile scroll.</p>

            <div
              className="xp-exit-modal-box"
              dir={selectedLang === "ar" ? "rtl" : "ltr"}
              style={{ background: bgColor, borderColor: `${accentColor}55` }}
            >
              <div className="xp-exit-close">&times;</div>
              <div className="xp-exit-timer-pill" style={{ borderColor: accentColor, color: accentColor }}>
                <span className="xp-timer-icon">&#9202;</span>
                <span className="xp-timer-digits">{timeFormatted}</span>
                <span className="xp-timer-label">EXPIRES</span>
              </div>

              <h4 className="xp-exit-title">{currentCopy.headline}</h4>
              <p className="xp-exit-desc">{currentCopy.bodyText}</p>

              <div className="xp-exit-coupon-box" onClick={handleCopy} style={{ borderColor: accentColor }}>
                <span className="xp-coupon-code">{code}</span>
                <span className="xp-copy-badge" style={{ background: accentColor, color: "#0B0B0B" }}>
                  {copied ? "COPIED! ✓" : "CLICK TO COPY"}
                </span>
              </div>

              <button
                type="button"
                className="xp-exit-cta-btn"
                style={{ background: accentColor, color: "#0B0B0B" }}
              >
                {currentCopy.buttonText} &rarr;
              </button>
              <div style={{ marginTop: 8, fontSize: 11, color: "#71717a", textAlign: "center", cursor: "pointer" }}>
                {currentCopy.dismissText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </s-page>
  );
}

const EXIT_INTENT_STYLES = `
  .xp-exit-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 24px;
    margin-top: 16px;
  }
  @media (max-width: 900px) {
    .xp-exit-layout {
      grid-template-columns: 1fr;
    }
  }
  .xp-sub {
    font-size: 12px;
    color: #6d7175;
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
    gap: 16px;
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
  .xp-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
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
  .xp-btn-gold {
    background: #0B0B0B;
    color: #D4AF37;
    border: 1px solid #D4AF37;
    padding: 12px 20px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    align-self: flex-start;
  }
  .xp-preview-sticky {
    position: sticky;
    top: 20px;
  }
  .xp-exit-modal-box {
    border: 1px solid;
    border-radius: 14px;
    padding: 24px;
    color: #fff;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
    position: relative;
    text-align: center;
  }
  .xp-exit-close {
    position: absolute;
    top: 14px;
    right: 16px;
    color: #888;
    font-size: 20px;
    cursor: pointer;
  }
  .xp-exit-timer-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 12px;
  }
  .xp-timer-digits {
    font-family: monospace;
    font-size: 14px;
  }
  .xp-timer-label {
    font-size: 9px;
    letter-spacing: 1px;
  }
  .xp-exit-title {
    font-size: 17px;
    font-weight: 700;
    margin: 0 0 8px;
  }
  .xp-exit-desc {
    font-size: 12px;
    color: #aaa;
    margin: 0 0 16px;
    line-height: 1.4;
  }
  .xp-exit-coupon-box {
    border: 1px dashed;
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    margin-bottom: 16px;
    background: rgba(255, 255, 255, 0.03);
  }
  .xp-coupon-code {
    font-family: monospace;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #fff;
  }
  .xp-copy-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 4px 8px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }
  .xp-exit-cta-btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
  }
`;
