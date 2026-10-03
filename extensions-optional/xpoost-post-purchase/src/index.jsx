import { useEffect, useState } from "react";
import {
  extend,
  render,
  useExtensionInput,
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  InlineStack,
  Layout,
  Separator,
  Text,
  TextBlock,
  TextContainer,
} from "@shopify/post-purchase-ui-extensions-react";

// Change this if the app is hosted somewhere else.
const APP_URL = "https://sea-turtle-app-a4uct.ondigitalocean.app";

async function api(token, body) {
  const res = await fetch(`${APP_URL}/api/post-purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Ask the backend whether this order gets an offer; the page is skipped when it doesn't. */
extend("Checkout::PostPurchase::ShouldRender", async ({ inputData, storage }) => {
  try {
    const purchase = inputData.initialPurchase || {};
    const items = purchase.lineItems || [];
    const offer = await api(inputData.token, {
      intent: "offer",
      referenceId: purchase.referenceId,
      locale: inputData.locale || "en",
      subtotal: Number(purchase.totalPriceSet?.presentmentMoney?.amount || 0),
      currency: purchase.totalPriceSet?.presentmentMoney?.currencyCode || "USD",
      itemCount: items.reduce((n, i) => n + Number(i.quantity || 1), 0),
      productIds: items.map((i) => i.product?.id).filter(Boolean),
      variantIds: items.map((i) => i.product?.variant?.id).filter(Boolean),
      country: inputData.shippingAddress?.countryCode,
    });
    if (!offer?.show) return { render: false };
    await storage.update(offer);
    return { render: true };
  } catch {
    return { render: false }; // never block the thank-you page
  }
});

render("Checkout::PostPurchase::Render", () => <App />);

function App() {
  const { storage, inputData, done, calculateChangeset, applyChangeset } = useExtensionInput();
  const offer = storage.initialData;
  const items = offer?.products || [];
  const [selected, setSelected] = useState(() => items.map((i) => i.variantId));
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(offer.expiresAt) - Date.parse(offer.serverNow || new Date().toISOString())));
  const [error, setError] = useState("");

  const t = offer.texts;
  const referenceId = inputData.initialPurchase.referenceId;

  useEffect(() => {
    api(inputData.token, { intent: "event", offerId: offer.offerId, event: "view" }).catch(() => {});
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (left === 0) done();
  }, [left]);

  const mmss = `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      api(inputData.token, { intent: "event", offerId: offer.offerId, event: "click", dim: "accept" }).catch(() => {});
      const { token } = await api(inputData.token, {
        intent: "sign",
        referenceId,
        offerId: offer.offerId,
        variantIds: selected,
        discountTitle: offer.discountText,
      });
      if (!token) throw new Error("no token");
      await applyChangeset(token);
      api(inputData.token, { intent: "event", offerId: offer.offerId, event: "action", dim: "accepted" }).catch(() => {});
      done();
    } catch {
      setError("Sorry, we couldn't add that. Your order is unchanged.");
      setBusy(false);
    }
  };

  const decline = () => {
    api(inputData.token, { intent: "event", offerId: offer.offerId, event: "dismiss" }).catch(() => {});
    done();
  };

  return (
    <BlockStack spacing="loose" alignment="center">
      <CalloutBanner title={(t.timerLabel || "Offer ends in") + " " + mmss}>
        <Text>{t.benefitLine}</Text>
      </CalloutBanner>
      <Layout maxInlineSize={0.7} sizes={{ small: [1], medium: [1], large: [1] }}>
        <BlockStack spacing="base">
          <TextContainer alignment="center">
            <Heading level={1}>{t.headline}</Heading>
            <TextBlock subdued>{t.subheadline}</TextBlock>
          </TextContainer>
          <Separator />
          {items.map((i) => (
            <InlineStack key={i.variantId} spacing="base" blockAlignment="center">
              {i.imageUrl ? <Image source={i.imageUrl} description={i.title} /> : null}
              <BlockStack spacing="none">
                <Text emphasized>{i.title}</Text>
                {i.priceText ? <Text subdued>{i.priceText}</Text> : null}
              </BlockStack>
            </InlineStack>
          ))}
          {error ? <TextBlock appearance="critical">{error}</TextBlock> : null}
          <Button submit onPress={accept} loading={busy} disabled={!selected.length}>
            {items.length > 1 ? t.bundleCta : t.productCta}
          </Button>
          <Button plain onPress={decline}>
            No thanks
          </Button>
          <TextBlock subdued size="small">
            {t.footnote}
          </TextBlock>
        </BlockStack>
      </Layout>
    </BlockStack>
  );
}
