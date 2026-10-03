# XPoost post-purchase add-on (optional)

The post-purchase page appears right after payment and, unlike the thank-you page, can **add items to the same order in one tap**
(same shipment, one order, no second checkout). XPoost's backend for it is already live (`/api/post-purchase`);
this folder is the storefront extension.

It lives outside `/extensions` on purpose. Shopify's post-purchase pages are still a **beta**:

- A live store must be approved for post-purchase pages (Partner Dashboard → your app → Extensions → request access).
- Only one app per store can run post-purchase pages, max 3 products, and they don't run for wallets / buy-now-pay-later,
  gift cards, local delivery, or multi-currency / duty orders.

If the extension is deployed before your app is approved, `shopify app deploy` can fail and block your other updates, so enable it only when ready:

1. Run `shopify app generate extension --template post_purchase_ui` once in a scratch folder and compare its
   `shopify.extension.toml` with the one here. If they differ, use the generated one (Shopify has changed this format before).
2. Move this folder to `extensions/xpoost-post-purchase`, run `npm install`, then `shopify app deploy`.
3. In the XPoost admin, add-on and ship-together offers are used automatically for the post-purchase page too;
   shoppers who can't see it (wallets, etc.) still get the thank-you page version.
