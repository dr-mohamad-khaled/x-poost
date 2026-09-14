import { useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import FeatureLanguageSwitcher from "../components/FeatureLanguageSwitcher";
import {
  DEFAULT_TRANSLATIONS_BY_LANG,
  getAllTranslations,
  sanitizeText,
  type SupportedLanguage,
} from "../utils/translations";

// ── Icon library (kept in sync with the storefront runtime script) ──
const ICON_OPTIONS = [
  { value: "discount", label: "Discount / Promo code" },
  { value: "scarcity", label: "Low stock / Urgency" },
  { value: "visitors", label: "Live viewers / Purchase proof" },
  { value: "fast_shipping", label: "Fast / Free shipping" },
  { value: "rare", label: "Rare / Premium" },
  { value: "guarantee", label: "Guarantee" },
  { value: "none", label: "No icon" },
] as const;

type Message = {
  icon: string;
  badge?: string;
  text: string;
  pill?: string;
  url?: string;
};

const DEFAULT_MESSAGES: Message[] = [
  { icon: "discount", badge: "Exclusive code:", text: "Use code SAVE15 for 15% off — next 15 minutes only", pill: "SAVE15" },
  { icon: "scarcity", badge: "Almost gone:", text: "Low stock — only a few units left" },
  { icon: "visitors", badge: "Trending now:", text: "Someone just ordered this product" },
  { icon: "fast_shipping", badge: "Free delivery:", text: "Spend $50 more to unlock free priority shipping" },
];

async function getOrCreateShop(shopDomain: string) {
  return prisma.shop.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  let config = await prisma.scarcityWidgetConfig.findUnique({ where: { shopId: shop.id } });

  if (!config) {
    config = await prisma.scarcityWidgetConfig.create({
      data: { shopId: shop.id, messagesJson: JSON.stringify(DEFAULT_MESSAGES) },
    });
  }

  let messages: Message[] = [];
  try {
    messages = JSON.parse(config.messagesJson);
    if (!Array.isArray(messages)) messages = [];
  } catch {
    messages = [];
  }

  const translationConfig = await prisma.translationConfig.findUnique({
    where: { shopId: shop.id },
  });
  const allTranslations = getAllTranslations(translationConfig?.translationsJson);
  const dashboardLocale = (translationConfig?.dashboardLocale || "en") as SupportedLanguage;

  return {
    config: { ...config, messages },
    allTranslations,
    dashboardLocale,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();

  const messagesRaw = String(formData.get("messagesJson") || "[]");
  let messages: Message[];
  try {
    messages = JSON.parse(messagesRaw);
    if (!Array.isArray(messages)) throw new Error("not an array");
  } catch {
    return { error: "Something went wrong reading the message list — try again." };
  }

  const translationsJsonRaw = String(formData.get("translationsJson") || "");

  const data = {
    active: formData.get("active") === "on",
    showOn: String(formData.get("showOn") || "all"),
    position: String(formData.get("position") || "bottom-left"),
    onsetDelayMs: Number(formData.get("onsetDelayMs") || 4000),
    displayDurationMs: Number(formData.get("displayDurationMs") || 6000),
    intervalDelayMs: Number(formData.get("intervalDelayMs") || 5000),
    desktopBottomOffsetPx: Number(formData.get("desktopBottomOffsetPx") || 24),
    mobileBottomOffsetPx: Number(formData.get("mobileBottomOffsetPx") || 24),
    backgroundColor: String(formData.get("backgroundColor") || "#0B0B0B"),
    accentColor: String(formData.get("accentColor") || "#D4AF37"),
    textColor: String(formData.get("textColor") || "#FFFFFF"),
    borderRadiusPx: Number(formData.get("borderRadiusPx") || 12),
    showCloseButton: formData.get("showCloseButton") === "on",
    showProgressBar: formData.get("showProgressBar") === "on",
    pauseOnHover: formData.get("pauseOnHover") === "on",
    messagesJson: JSON.stringify(messages),
  };

  try {
    await prisma.scarcityWidgetConfig.upsert({
      where: { shopId: shop.id },
      update: data,
      create: { shopId: shop.id, ...data },
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
      } catch (tErr) {
        console.error("[Scarcity Action] Error saving translationConfig:", tErr);
      }
    }

    await prisma.shop.update({ where: { id: shop.id }, data: { scarcityEnabled: data.active } });
  } catch (error) {
    console.error("[XPoost] Failed to save scarcity widget config:", error);
    return {
      error:
        "Couldn't save changes. Check the terminal running `npm run dev` for the full error " +
        "— this usually means the database needs a migration (`npx prisma migrate dev`).",
    };
  }

  return { ok: true };
};

export default function ScarcityToastSettings() {
  const { config, allTranslations, dashboardLocale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";

  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(dashboardLocale || "ar");
  const [translationsMap, setTranslationsMap] = useState(allTranslations);

  const currentCopy =
    translationsMap[selectedLang]?.scarcityToast ||
    DEFAULT_TRANSLATIONS_BY_LANG[selectedLang].scarcityToast;

  const handleSelectLang = (lang: SupportedLanguage) => {
    setSelectedLang(lang);
    const langToast =
      translationsMap[lang]?.scarcityToast ||
      DEFAULT_TRANSLATIONS_BY_LANG[lang]?.scarcityToast;
    if (langToast) {
      setMessages([
        { icon: "discount", badge: langToast.discountBadge, text: langToast.discountText, pill: "SAVE15" },
        { icon: "scarcity", badge: langToast.stockBadge, text: langToast.stockText },
        { icon: "visitors", badge: langToast.trendingBadge, text: langToast.trendingText },
        { icon: "fast_shipping", badge: langToast.shippingBadge, text: langToast.shippingText },
      ]);
    }
  };

  const handleCopyChange = (field: keyof typeof currentCopy, val: string) => {
    const clean = sanitizeText(val);
    setTranslationsMap((prev) => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        scarcityToast: {
          ...prev[selectedLang].scarcityToast,
          [field]: clean,
        },
      },
    }));
    setMessages((prev) => {
      const next = [...prev];
      if (field === "discountBadge" && next[0]) next[0] = { ...next[0], badge: clean };
      if (field === "discountText" && next[0]) next[0] = { ...next[0], text: clean };
      if (field === "stockBadge" && next[1]) next[1] = { ...next[1], badge: clean };
      if (field === "stockText" && next[1]) next[1] = { ...next[1], text: clean };
      if (field === "trendingBadge" && next[2]) next[2] = { ...next[2], badge: clean };
      if (field === "trendingText" && next[2]) next[2] = { ...next[2], text: clean };
      if (field === "shippingBadge" && next[3]) next[3] = { ...next[3], badge: clean };
      if (field === "shippingText" && next[3]) next[3] = { ...next[3], text: clean };
      return next;
    });
  };

  const handleLoadPredefined = () => {
    const def = DEFAULT_TRANSLATIONS_BY_LANG[selectedLang].scarcityToast;
    setTranslationsMap((prev) => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        scarcityToast: { ...def },
      },
    }));
    setMessages([
      { icon: "discount", badge: def.discountBadge, text: def.discountText, pill: "SAVE15" },
      { icon: "scarcity", badge: def.stockBadge, text: def.stockText },
      { icon: "visitors", badge: def.trendingBadge, text: def.trendingText },
      { icon: "fast_shipping", badge: def.shippingBadge, text: def.shippingText },
    ]);
  };


  const [messages, setMessages] = useState<Message[]>(config.messages);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [accentColor, setAccentColor] = useState(config.accentColor);
  const [backgroundColor, setBackgroundColor] = useState(config.backgroundColor);
  const [textColor, setTextColor] = useState(config.textColor);
  const [borderRadiusPx, setBorderRadiusPx] = useState(config.borderRadiusPx);

  const messagesJson = useMemo(() => JSON.stringify(messages), [messages]);
  const preview = messages[previewIndex] ?? messages[0];

  function updateMessage(index: number, patch: Partial<Message>) {
    const sanitizedPatch: Partial<Message> = {};
    if (patch.badge !== undefined) sanitizedPatch.badge = sanitizeText(patch.badge);
    if (patch.text !== undefined) sanitizedPatch.text = sanitizeText(patch.text);
    if (patch.pill !== undefined) sanitizedPatch.pill = sanitizeText(patch.pill);
    if (patch.url !== undefined) sanitizedPatch.url = patch.url;
    if (patch.icon !== undefined) sanitizedPatch.icon = patch.icon;
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, ...sanitizedPatch } : m)));
  }

  function addMessage() {
    setMessages((prev) => [...prev, { icon: "discount", text: "New message" }]);
  }

  function removeMessage(index: number) {
    setMessages((prev) => prev.filter((_, i) => i !== index));
    setPreviewIndex(0);
  }

  function moveMessage(index: number, dir: -1 | 1) {
    setMessages((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <s-page heading="Scarcity & Social Proof Toast">
      <style>{ADMIN_STYLES}</style>

      {actionData && "error" in actionData ? (
        <s-banner tone="critical">{actionData.error}</s-banner>
      ) : null}
      {actionData && "ok" in actionData ? <s-banner tone="success">Saved.</s-banner> : null}

      <Form method="post" className="xps-form">
        <input type="hidden" name="messagesJson" value={messagesJson} />
        <input type="hidden" name="translationsJson" value={JSON.stringify(translationsMap)} />

        <div className="xp-section-card"><h3 className="xp-section-title">General</h3>
          <div className="xps-row">
            <label className="xps-toggle">
              <input type="checkbox" name="active" defaultChecked={config.active} />
              <span>Enabled on storefront</span>
            </label>
          </div>
          <div className="xps-field">
            <label htmlFor="showOn">Show on</label>
            <select id="showOn" name="showOn" defaultValue={config.showOn} className="xps-input">
              <option value="all">All pages</option>
              <option value="home_product">Home &amp; product pages</option>
              <option value="product_only">Product pages only</option>
            </select>
          </div>
        </div>

        <div className="xp-section-card"><h3 className="xp-section-title">Timing</h3>
          <div className="xps-grid">
            <div className="xps-field">
              <label htmlFor="onsetDelayMs">First appearance delay (ms)</label>
              <input id="onsetDelayMs" className="xps-input" type="number" name="onsetDelayMs" defaultValue={config.onsetDelayMs} min={0} step={500} />
            </div>
            <div className="xps-field">
              <label htmlFor="displayDurationMs">Display duration (ms)</label>
              <input id="displayDurationMs" className="xps-input" type="number" name="displayDurationMs" defaultValue={config.displayDurationMs} min={1000} step={500} />
            </div>
            <div className="xps-field">
              <label htmlFor="intervalDelayMs">Gap between messages (ms)</label>
              <input id="intervalDelayMs" className="xps-input" type="number" name="intervalDelayMs" defaultValue={config.intervalDelayMs} min={0} step={500} />
            </div>
          </div>
        </div>

        <div className="xp-section-card"><h3 className="xp-section-title">Position</h3>
          <div className="xps-grid">
            <div className="xps-field">
              <label htmlFor="position">Corner</label>
              <select id="position" name="position" defaultValue={config.position} className="xps-input">
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
              </select>
            </div>
            <div className="xps-field">
              <label htmlFor="desktopBottomOffsetPx">Desktop offset from bottom (px)</label>
              <input id="desktopBottomOffsetPx" className="xps-input" type="number" name="desktopBottomOffsetPx" defaultValue={config.desktopBottomOffsetPx} min={0} />
            </div>
            <div className="xps-field">
              <label htmlFor="mobileBottomOffsetPx">Mobile offset from bottom (px)</label>
              <input id="mobileBottomOffsetPx" className="xps-input" type="number" name="mobileBottomOffsetPx" defaultValue={config.mobileBottomOffsetPx} min={0} />
              <small>Raise this if it overlaps a sticky mobile nav or the social bar.</small>
            </div>
          </div>
        </div>

        <div className="xp-section-card"><h3 className="xp-section-title">Appearance</h3>
          <div className="xps-grid">
            <div className="xps-field">
              <label htmlFor="backgroundColor">Background</label>
              <div className="xps-color">
                <input id="backgroundColor" type="color" name="backgroundColor" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
                <span>{backgroundColor}</span>
              </div>
            </div>
            <div className="xps-field">
              <label htmlFor="accentColor">Accent</label>
              <div className="xps-color">
                <input id="accentColor" type="color" name="accentColor" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                <span>{accentColor}</span>
              </div>
            </div>
            <div className="xps-field">
              <label htmlFor="textColor">Text</label>
              <div className="xps-color">
                <input id="textColor" type="color" name="textColor" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                <span>{textColor}</span>
              </div>
            </div>
            <div className="xps-field">
              <label htmlFor="borderRadiusPx">Corner roundness (px)</label>
              <input
                id="borderRadiusPx"
                className="xps-input"
                type="range"
                name="borderRadiusPx"
                min={0}
                max={24}
                value={borderRadiusPx}
                onChange={(e) => setBorderRadiusPx(Number(e.target.value))}
              />
              <small>{borderRadiusPx}px</small>
            </div>
          </div>

          <div className="xps-row xps-row--wrap">
            <label className="xps-toggle">
              <input type="checkbox" name="showCloseButton" defaultChecked={config.showCloseButton} />
              <span>Show close button</span>
            </label>
            <label className="xps-toggle">
              <input type="checkbox" name="showProgressBar" defaultChecked={config.showProgressBar} />
              <span>Show timer progress bar</span>
            </label>
            <label className="xps-toggle">
              <input type="checkbox" name="pauseOnHover" defaultChecked={config.pauseOnHover} />
              <span>Pause on hover (desktop)</span>
            </label>
          </div>
        </div>

        {/* Multi-Language Copy & Toast Templates */}
        <div className="xp-section-card"><h3 className="xp-section-title">Multi-Language Toast Templates & Copy</h3>
          <FeatureLanguageSwitcher
            selectedLang={selectedLang}
            onSelectLang={handleSelectLang}
            onLoadPredefined={handleLoadPredefined}
            dashboardLocale={dashboardLocale}
          />

          <div className="xps-grid">
            <div className="xps-field">
              <label>Discount Badge ({selectedLang.toUpperCase()})</label>
              <input
                className="xps-input"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                value={currentCopy.discountBadge}
                onChange={(e) => handleCopyChange("discountBadge", e.target.value)}
              />
            </div>
            <div className="xps-field">
              <label>Discount Toast Message ({selectedLang.toUpperCase()})</label>
              <input
                className="xps-input"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                value={currentCopy.discountText}
                onChange={(e) => handleCopyChange("discountText", e.target.value)}
              />
            </div>
          </div>
          <div className="xps-grid">
            <div className="xps-field">
              <label>Low Stock Badge ({selectedLang.toUpperCase()})</label>
              <input
                className="xps-input"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                value={currentCopy.stockBadge}
                onChange={(e) => handleCopyChange("stockBadge", e.target.value)}
              />
            </div>
            <div className="xps-field">
              <label>Low Stock Toast Message ({selectedLang.toUpperCase()})</label>
              <input
                className="xps-input"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                value={currentCopy.stockText}
                onChange={(e) => handleCopyChange("stockText", e.target.value)}
              />
            </div>
          </div>
          <div className="xps-grid">
            <div className="xps-field">
              <label>Trending Badge ({selectedLang.toUpperCase()})</label>
              <input
                className="xps-input"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                value={currentCopy.trendingBadge}
                onChange={(e) => handleCopyChange("trendingBadge", e.target.value)}
              />
            </div>
            <div className="xps-field">
              <label>Trending Toast Message ({selectedLang.toUpperCase()})</label>
              <input
                className="xps-input"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                value={currentCopy.trendingText}
                onChange={(e) => handleCopyChange("trendingText", e.target.value)}
              />
            </div>
          </div>
          <div className="xps-grid">
            <div className="xps-field">
              <label>Shipping Badge ({selectedLang.toUpperCase()})</label>
              <input
                className="xps-input"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                value={currentCopy.shippingBadge}
                onChange={(e) => handleCopyChange("shippingBadge", e.target.value)}
              />
            </div>
            <div className="xps-field">
              <label>Shipping Toast Message ({selectedLang.toUpperCase()})</label>
              <input
                className="xps-input"
                dir={selectedLang === "ar" ? "rtl" : "ltr"}
                value={currentCopy.shippingText}
                onChange={(e) => handleCopyChange("shippingText", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="xp-section-card"><h3 className="xp-section-title">Messages</h3>
          <div className="xps-messages">
            {messages.map((msg, i) => (
              <div className="xps-message-card" key={i}>
                <div className="xps-message-card__head">
                  <strong>Message {i + 1}</strong>
                  <div className="xps-message-card__actions">
                    <button type="button" className="xps-icon-btn" onClick={() => moveMessage(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button type="button" className="xps-icon-btn" onClick={() => moveMessage(i, 1)} disabled={i === messages.length - 1} aria-label="Move down">↓</button>
                    <button type="button" className="xps-icon-btn xps-icon-btn--danger" onClick={() => removeMessage(i)} disabled={messages.length <= 1} aria-label="Remove">✕</button>
                  </div>
                </div>
                <div className="xps-grid">
                  <div className="xps-field">
                    <label>Icon</label>
                    <select className="xps-input" value={msg.icon} onChange={(e) => updateMessage(i, { icon: e.target.value })}>
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="xps-field">
                    <label>Small label (optional)</label>
                    <input className="xps-input" dir={selectedLang === "ar" ? "rtl" : "ltr"} value={msg.badge ?? ""} onChange={(e) => updateMessage(i, { badge: e.target.value })} placeholder="e.g. Exclusive code:" />
                  </div>
                  <div className="xps-field">
                    <label>Highlight pill (optional)</label>
                    <input className="xps-input" dir={selectedLang === "ar" ? "rtl" : "ltr"} value={msg.pill ?? ""} onChange={(e) => updateMessage(i, { pill: e.target.value })} placeholder="e.g. SAVE15" />
                  </div>
                </div>
                <div className="xps-field">
                  <label>Message text</label>
                  <input className="xps-input" dir={selectedLang === "ar" ? "rtl" : "ltr"} value={msg.text} onChange={(e) => updateMessage(i, { text: e.target.value })} placeholder="What the customer sees" />
                </div>
                <div className="xps-field">
                  <label>Link on click (optional)</label>
                  <input className="xps-input" value={msg.url ?? ""} onChange={(e) => updateMessage(i, { url: e.target.value })} placeholder="https://…" />
                </div>
                <button type="button" className="xps-link-btn" onClick={() => setPreviewIndex(i)}>Preview this message →</button>
              </div>
            ))}
          </div>
          <button type="button" className="xps-secondary-btn" onClick={addMessage}>+ Add message</button>
        </div>

        <div className="xps-save-bar">
          <button type="submit" className="xps-primary-btn" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Form>

      <div slot="aside" className="xp-section-card">
        <h3 className="xp-section-title">Live preview</h3>
        <TogglePreview
          message={preview}
          backgroundColor={backgroundColor}
          accentColor={accentColor}
          textColor={textColor}
          borderRadiusPx={borderRadiusPx}
          dir={selectedLang === "ar" ? "rtl" : "ltr"}
        />
        <p className="xps-preview-hint">
          Actual on-site behavior (cycling, sheen animation, progress bar) plays out live once the
          XPoost app embed is enabled in the theme editor — this is a static look at the styling.
        </p>
      </div>
    </s-page>
  );
}

function TogglePreview({
  message,
  backgroundColor,
  accentColor,
  textColor,
  borderRadiusPx,
  dir = "ltr",
}: {
  message?: Message;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  borderRadiusPx: number;
  dir?: "rtl" | "ltr";
}) {
  if (!message) return null;
  return (
    <div
      className="xps-toast-preview"
      dir={dir}
      style={{
        background: `linear-gradient(145deg, ${backgroundColor} 0%, #050505 100%)`,
        border: `1px solid ${accentColor}73`,
        borderRadius: borderRadiusPx,
        boxShadow: `0 10px 28px -4px rgba(0,0,0,0.8), 0 0 18px ${accentColor}47`,
      }}
    >
      <span className="xps-toast-preview__icon" style={{ color: accentColor, borderColor: `${accentColor}59` }}>
        {ICON_GLYPH[message.icon] ?? "●"}
      </span>
      <span className="xps-toast-preview__body">
        {message.badge ? (
          <span className="xps-toast-preview__badge" style={{ color: accentColor }}>
            {message.badge}
          </span>
        ) : null}
        {message.pill ? (
          <span className="xps-toast-preview__pill" style={{ background: accentColor }}>
            {message.pill}
          </span>
        ) : null}
        <span className="xps-toast-preview__text" style={{ color: textColor }}>
          {message.text}
        </span>
      </span>
    </div>
  );
}

const ICON_GLYPH: Record<string, string> = {
  discount: "%",
  scarcity: "!",
  visitors: "*",
  fast_shipping: ">",
  rare: "#",
  guarantee: "+",
  none: "",
};

const ADMIN_STYLES = `

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

.xps-form { display: flex; flex-direction: column; gap: 16px; color: #ffffff; max-width: 1060px; margin: 0 auto; padding: 20px 0 80px; }
s-section {
  display: block;
  background: #141414;
  border: 1px solid #282828;
  border-radius: 12px;
  padding: 24px;
  color: #ffffff;
}
s-card {
  display: block;
  background: #141414;
  border: 1px solid #282828;
  border-radius: 12px;
  padding: 24px;
  color: #ffffff;
}
.xps-row { display: flex; align-items: center; gap: 20px; padding: 4px 0; }
.xps-row--wrap { flex-wrap: wrap; }
.xps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 8px 0; }
.xps-field { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
.xps-field label { font-size: 13px; font-weight: 700; color: #ffffff; }
.xps-field small { font-size: 12px; color: #888888; }
.xps-input {
  border: 1px solid #333333;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #ffffff;
  background: #1f1f1f;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.15s ease;
}
.xps-input:focus { outline: none; border-color: #D4AF37; box-shadow: 0 0 0 1px #D4AF37; }
.xps-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #ffffff; cursor: pointer; }
.xps-color { display: flex; align-items: center; gap: 8px; }
.xps-color input[type="color"] { width: 36px; height: 36px; border: 1px solid #333333; border-radius: 8px; padding: 2px; background: #111; cursor: pointer; }
.xps-color span { font-size: 12px; color: #aaaaaa; font-family: monospace; }
.xps-messages { display: flex; flex-direction: column; gap: 14px; }
.xps-message-card { border: 1px solid #2a2a2a; border-radius: 10px; padding: 16px; background: #181818; color: #ffffff; }
.xps-message-card__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.xps-message-card__actions { display: flex; gap: 6px; }
.xps-icon-btn {
  width: 30px; height: 30px; border-radius: 6px; border: 1px solid #333333; background: #222222;
  cursor: pointer; font-size: 13px; color: #ffffff; display: flex; align-items: center; justify-content: center;
}
.xps-icon-btn:hover:not(:disabled) { background: #2a2a2a; border-color: #D4AF37; }
.xps-icon-btn:disabled { opacity: 0.35; cursor: default; }
.xps-icon-btn--danger:hover:not(:disabled) { background: #3b1818; border-color: #e0322b; color: #ff8888; }
.xps-link-btn {
  background: none; border: none; color: #D4AF37; font-size: 13px; cursor: pointer; padding: 4px 0;
}
.xps-link-btn:hover { text-decoration: underline; }
.xps-secondary-btn {
  align-self: flex-start; margin-top: 10px; padding: 8px 16px; border-radius: 8px;
  border: 1px solid #333333; background: #222222; color: #ffffff; font-size: 14px; font-weight: 600; cursor: pointer;
}
.xps-secondary-btn:hover { background: #2a2a2a; border-color: #D4AF37; }
.xps-primary-btn {
  padding: 10px 24px; border-radius: 8px; border: 1px solid #D4AF37; background: #0B0B0B; color: #D4AF37;
  font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: all 0.15s ease;
}
.xps-primary-btn:hover { background: #1c1c1c; transform: translateY(-1px); }
.xps-primary-btn:disabled { opacity: 0.6; cursor: default; }
.xps-save-bar { position: sticky; bottom: 0; padding: 16px 0 4px; background: rgba(10, 10, 12, 0.85); backdrop-filter: blur(8px); }
.xps-toast-preview {
  position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  max-width: 300px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.xps-toast-preview__icon {
  flex: 0 0 30px; width: 30px; height: 30px; border-radius: 8px; border: 1px solid;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.xps-toast-preview__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.xps-toast-preview__badge { font-size: 11px; font-weight: 700; word-break: break-word; white-space: normal; }
.xps-toast-preview__pill {
  display: inline-block; align-self: flex-start; padding: 1px 7px; border-radius: 999px;
  color: #0b0b0b; font-size: 9.5px; font-weight: 800; margin-bottom: 2px;
}
.xps-toast-preview__text { font-size: 12.5px; line-height: 1.45; word-break: break-word; white-space: normal; }
.xps-preview-hint { font-size: 12px; color: #888888; margin-top: 10px; }
`;
