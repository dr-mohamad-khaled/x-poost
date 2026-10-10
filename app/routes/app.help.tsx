import { useEffect, useMemo, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useOutletContext } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "../shop.server";

type Bi = { en: string; ar: string };
type FeatureId =
  | "scarcity"
  | "productScarcity"
  | "quantityBreaks"
  | "prePurchase"
  | "inCart"
  | "shippingBar"
  | "socialBar"
  | "thankYou";

type Category = "trust" | "aov" | "support" | "retention";

type Feature = {
  id: FeatureId;
  route: string;
  category: Category;
  name: Bi;
  goal: Bi;
  how: { en: string[]; ar: string[] };
  result: Bi;
  watch: Bi;
  tips: { en: string[]; ar: string[] };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  return {
    enabled: {
      scarcity: !!shop.scarcityEnabled,
      productScarcity: !!shop.productScarcityEnabled,
      quantityBreaks: !!shop.quantityBreaksEnabled,
      prePurchase: !!shop.prePurchaseEnabled,
      inCart: !!shop.inCartUpsellEnabled,
      shippingBar: !!shop.shippingBarEnabled,
      socialBar: !!shop.socialBarEnabled,
      thankYou: !!shop.thankYouEnabled,
    } as Record<FeatureId, boolean>,
  };
};

/* ─────────────────────────────────────────────────────────────
   Content (English + Arabic). Other dashboard languages show English.
   ───────────────────────────────────────────────────────────── */

const FEATURES: Feature[] = [
  {
    id: "prePurchase",
    route: "/app/pre-purchase",
    category: "aov",
    name: { en: "Pre-Purchase Upsell Modal", ar: "نافذة العرض قبل الشراء" },
    goal: {
      en: "Right after Add to Cart, offer a complementary bundle so the shopper adds more to the same order.",
      ar: "بعد الضغط على إضافة إلى السلة مباشرة، تعرض منتجات مكمّلة ليضيف العميل المزيد إلى الطلب نفسه.",
    },
    how: {
      en: [
        "Choose the product that triggers the offer and up to a few complementary products to suggest.",
        "Set a discount for taking the bundle and edit the headline and button text in each language.",
        "Use the live preview, which stays in view while you scroll, then save and test on your store.",
      ],
      ar: [
        "اختر المنتج الذي يُظهر العرض، ثم عدة منتجات مكمّلة لاقتراحها.",
        "حدّد خصمًا لمن يأخذ الحزمة، وعدّل العنوان ونص الأزرار لكل لغة.",
        "استخدم المعاينة الحية التي تبقى ظاهرة أثناء التمرير، ثم احفظ وجرّب على متجرك.",
      ],
    },
    result: {
      en: "More items per order. Shoppers who would have bought one product often take the pair.",
      ar: "عدد منتجات أكبر في كل طلب. العميل الذي كان سيشتري منتجًا واحدًا كثيرًا ما يأخذ الاثنين.",
    },
    watch: {
      en: "Offer views versus accepted offers, and units per order.",
      ar: "عدد مرات ظهور العرض مقابل عدد المرات التي قُبل فيها، وعدد القطع في كل طلب.",
    },
    tips: {
      en: [
        "Suggest products that clearly go together, such as a cleanser with a serum, not random bestsellers.",
        "Keep it to one to three products. Too many choices lower the chance of a yes.",
        "Use a small, believable discount. The goal is a nudge, not a clearance sale.",
      ],
      ar: [
        "اقترح منتجات تتكامل بوضوح، مثل غسول مع سيروم، وليس أي منتجات رائجة عشوائية.",
        "اجعل العرض من منتج إلى ثلاثة منتجات. كثرة الخيارات تقلل فرصة القبول.",
        "استخدم خصمًا صغيرًا ومقنعًا. الهدف دفعة لطيفة وليس تصفية.",
      ],
    },
  },
  {
    id: "inCart",
    route: "/app/in-cart",
    category: "aov",
    name: { en: "Cart Drawer Upsell", ar: "عروض داخل السلة" },
    goal: {
      en: "Inside the slide-out cart, where buying intent is highest, offer quick one-click add-ons.",
      ar: "داخل السلة الجانبية، حيث تكون نية الشراء أعلى ما يمكن، تعرض إضافات سريعة بضغطة واحدة.",
    },
    how: {
      en: [
        "Create a rule: when the cart contains a chosen product, show an offer.",
        "Add up to three add-on products to a single offer and set the discount.",
        "Pick a style and save. The offer appears in the cart drawer or cart page.",
      ],
      ar: [
        "أنشئ قاعدة: عندما تحتوي السلة على منتج معيّن يظهر عرض.",
        "أضف حتى ثلاثة منتجات إضافية في العرض الواحد وحدّد الخصم.",
        "اختر التصميم واحفظ. يظهر العرض في السلة الجانبية أو صفحة السلة.",
      ],
    },
    result: {
      en: "Extra revenue from impulse add-ons without interrupting checkout.",
      ar: "إيراد إضافي من منتجات تُضاف باندفاع دون تعطيل عملية الدفع.",
    },
    watch: {
      en: "Add-on clicks and the revenue they bring.",
      ar: "عدد النقرات على الإضافات والإيراد الناتج عنها.",
    },
    tips: {
      en: [
        "Offer small, low-priced items that feel like an easy extra.",
        "Make sure the add-on is in stock. A sold-out offer hurts trust.",
        "Match the add-on to what is already in the cart.",
      ],
      ar: [
        "اعرض منتجات صغيرة منخفضة السعر تبدو كإضافة سهلة.",
        "تأكد أن المنتج الإضافي متوفر. العرض غير المتوفر يضر بالثقة.",
        "اجعل الإضافة مناسبة لما هو موجود في السلة بالفعل.",
      ],
    },
  },
  {
    id: "thankYou",
    route: "/app/thank-you",
    category: "retention",
    name: { en: "Thank-You Page Upsell", ar: "عرض صفحة الشكر" },
    goal: {
      en: "After checkout, reward the customer with an offer for the next order or a chance to ship another item together.",
      ar: "بعد إتمام الدفع، تكافئ العميل بعرض لطلبه القادم أو بفرصة إضافة منتج آخر يُشحن معه.",
    },
    how: {
      en: [
        "In your Shopify checkout editor, add the XPoost Thank-you Upsell block to the Thank you page once.",
        "In XPoost, create offers with conditions such as order total, products in the order, new or returning customer, or country.",
        "Pick a design and a time window for the code, then save.",
      ],
      ar: [
        "في محرر صفحة الدفع في Shopify، أضف بلوك XPoost Thank-you Upsell إلى صفحة الشكر مرة واحدة.",
        "في XPoost أنشئ عروضًا بشروط مثل قيمة الطلب أو المنتجات في الطلب أو عميل جديد أو عائد أو الدولة.",
        "اختر التصميم ومدة صلاحية الكود ثم احفظ.",
      ],
    },
    result: {
      en: "Repeat purchases and a bigger first order, using the moment when the customer is happiest with you.",
      ar: "مشتريات متكررة وطلب أول أكبر، بالاستفادة من اللحظة التي يكون فيها العميل أسعد ما يكون بتجربتك.",
    },
    watch: {
      en: "Offer views, reveals and redeemed codes.",
      ar: "مرات ظهور العرض والكشف عنه والأكواد المستخدمة.",
    },
    tips: {
      en: [
        "Use a code with a short, real deadline. It gives the offer real urgency.",
        "Keep the offer simple and relevant to what was just bought.",
        "Test with a real order to see exactly what customers will see.",
      ],
      ar: [
        "استخدم كودًا بمهلة قصيرة وحقيقية. هذا يمنح العرض إلحاحًا فعليًا.",
        "اجعل العرض بسيطًا ومرتبطًا بما اشتراه العميل للتو.",
        "جرّب بطلب حقيقي لترى بالضبط ما سيراه العملاء.",
      ],
    },
  },
  {
    id: "shippingBar",
    route: "/app/shipping-bar",
    category: "aov",
    name: { en: "Tiered Perks & Free Shipping Bar", ar: "شريط المزايا المتدرجة والشحن المجاني" },
    goal: {
      en: "Show shoppers how close they are to the next reward, so they add one more item to reach it and your average order value grows.",
      ar: "يوضح للعميل كم تبقّى له ليفتح المكافأة التالية، فيضيف منتجًا إضافيًا للوصول إليها وترتفع قيمة متوسط الطلب.",
    },
    how: {
      en: [
        "Set up to a few milestones (for example 500, 1,000 and 2,000) in your store currency. Shoppers on another currency see them converted automatically.",
        "Pick what each milestone gives: display only, free shipping, a percentage or fixed amount off shipping, or a percentage or fixed amount off the whole order. Rewards are applied automatically at checkout, no discount code needed.",
        "Optionally show the bar only in selected countries, or give each country group its own thresholds and rewards. It follows the country your customer picks in your store's country selector.",
        "Choose a layout and your own colors, including a light preset for light stores, then save.",
      ],
      ar: [
        "حدّد عدة مراحل (مثل 500 و1,000 و2,000) بعملة متجرك. العميل الذي يتصفح بعملة أخرى يراها محوّلة تلقائيًا.",
        "اختر مكافأة كل مرحلة: عرض فقط، أو شحن مجاني، أو خصم بنسبة أو مبلغ ثابت على الشحن، أو خصم بنسبة أو مبلغ ثابت على الطلب كله. تُطبَّق المكافآت تلقائيًا عند الدفع بدون كود خصم.",
        "يمكنك إظهار الشريط في دول محددة فقط، أو إعطاء كل مجموعة دول مراحل ومكافآت خاصة بها. يتبع الشريط الدولة التي يختارها العميل من محدد الدولة في متجرك.",
        "اختر التصميم وألوانك الخاصة، بما في ذلك نمط فاتح للمتاجر الفاتحة، ثم احفظ.",
      ],
    },
    result: {
      en: "A higher average order value and fewer abandoned carts, because the reward is visible and the goal feels within reach.",
      ar: "ارتفاع متوسط قيمة الطلب وانخفاض عدد السلات المتروكة، لأن المكافأة ظاهرة والهدف يبدو قريبًا.",
    },
    watch: {
      en: "Average order value, and how many carts reach each milestone (Analytics).",
      ar: "متوسط قيمة الطلب، وعدد السلات التي تصل إلى كل مرحلة (صفحة التحليلات).",
    },
    tips: {
      en: [
        "Set the first milestone a little above your current average order value, so it is a small step rather than a leap.",
        "Only promise what you can afford: check your margin at every threshold, especially for order discounts.",
        "If you use free shipping, make sure your shipping profile has a rate for the countries you sell to. The reward discounts an existing rate.",
        "On a light store theme, press the Light preset so the text stays readable.",
      ],
      ar: [
        "اجعل أول مرحلة أعلى قليلًا من متوسط قيمة الطلب الحالي لديك، لتكون خطوة صغيرة وليست قفزة.",
        "لا تعد إلا بما تتحمله: راجع هامش ربحك عند كل مرحلة، خاصة مع خصومات الطلب.",
        "عند استخدام الشحن المجاني، تأكد أن ملف الشحن لديك يحتوي على سعر شحن للدول التي تبيع لها. المكافأة تخصم من سعر موجود فعلًا.",
        "إذا كان متجرك فاتح اللون، اضغط على النمط الفاتح ليبقى النص واضحًا.",
      ],
    },
  },
  {
    id: "quantityBreaks",
    route: "/app/quantity-breaks",
    category: "aov",
    name: { en: "Quantity Breaks", ar: "خصومات الكميات" },
    goal: {
      en: "Move buyers from one unit to two or three with clear volume pricing right on the product page.",
      ar: "ينقل العميل من شراء قطعة واحدة إلى قطعتين أو ثلاث بتسعير واضح للكميات داخل صفحة المنتج.",
    },
    how: {
      en: [
        "Define the tiers, such as 1, 2 and 3 or more units, with the discount for each.",
        "Mark the tier you want to promote, for example Most Popular.",
        "Save. The bundle selector appears on the product page and applies the price automatically.",
      ],
      ar: [
        "حدّد المستويات، مثل 1 و2 و3 قطع أو أكثر، مع الخصم لكل مستوى.",
        "اختر المستوى الذي تريد الترويج له، مثل الأكثر شعبية.",
        "احفظ. يظهر محدد الحزم في صفحة المنتج ويُطبَّق السعر تلقائيًا.",
      ],
    },
    result: {
      en: "More units per order and a higher average order value on products people reuse.",
      ar: "عدد قطع أكبر لكل طلب ومتوسط قيمة طلب أعلى في المنتجات التي يعيد الناس شراءها.",
    },
    watch: {
      en: "Which tier shoppers pick and units per order.",
      ar: "المستوى الذي يختاره العملاء وعدد القطع في كل طلب.",
    },
    tips: {
      en: [
        "Highlight the middle tier. It is the one most shoppers choose.",
        "Best for consumables like skincare, where buying two or three makes sense.",
        "Check that the discount at each tier still leaves a healthy margin.",
      ],
      ar: [
        "ميّز المستوى الأوسط، فهو الأكثر اختيارًا.",
        "الأنسب للمنتجات الاستهلاكية مثل العناية بالبشرة، حيث يكون شراء اثنين أو ثلاثة منطقيًا.",
        "تأكد أن الخصم في كل مستوى ما زال يترك هامش ربح جيدًا.",
      ],
    },
  },
  {
    id: "productScarcity",
    route: "/app/product-scarcity",
    category: "trust",
    name: { en: "Stock Scarcity Block", ar: "كتلة ندرة المخزون" },
    goal: {
      en: "A low-stock meter on the product page that nudges hesitant buyers to decide.",
      ar: "مؤشر مخزون منخفض في صفحة المنتج يدفع المتردد لاتخاذ القرار.",
    },
    how: {
      en: [
        "Choose the stock level at which the block starts to appear.",
        "Edit the message and style, then save.",
        "It shows only when the product is genuinely running low.",
      ],
      ar: [
        "اختر مستوى المخزون الذي يبدأ عنده ظهور الكتلة.",
        "عدّل الرسالة والتصميم ثم احفظ.",
        "تظهر فقط عندما يكون المنتج قليلًا فعلًا.",
      ],
    },
    result: {
      en: "Faster decisions on products that are almost sold out.",
      ar: "قرارات شراء أسرع في المنتجات التي أوشكت على النفاد.",
    },
    watch: {
      en: "Add-to-cart rate on products where the block is visible.",
      ar: "معدل الإضافة للسلة في المنتجات التي تظهر فيها الكتلة.",
    },
    tips: {
      en: [
        "Set the trigger to a real threshold so the message is always honest.",
        "Keep your inventory counts accurate in Shopify.",
      ],
      ar: [
        "اضبط حد الظهور على رقم حقيقي ليكون الكلام دائمًا صادقًا.",
        "حافظ على دقة كميات المخزون في Shopify.",
      ],
    },
  },
  {
    id: "socialBar",
    route: "/app/social-bar",
    category: "support",
    name: { en: "Support & Social Bar", ar: "شريط الدعم والتواصل" },
    goal: {
      en: "A floating button that gives shoppers one-tap support on WhatsApp, quick inquiry choices and your social channels.",
      ar: "زر عائم يمنح العميل دعمًا بضغطة واحدة على واتساب، مع خيارات استفسار سريعة وقنواتك الاجتماعية.",
    },
    how: {
      en: [
        "Enter your WhatsApp number with the country code and add the links you actually use (Instagram, TikTok, Facebook, X, Pinterest and more). Empty channels are never shown.",
        "Pick a layout and colors, or choose your own colors.",
        "In the support layout, shoppers pick a topic such as Track my order or Product advice, and each topic opens WhatsApp with its own message.",
      ],
      ar: [
        "أدخل رقم واتساب مع رمز الدولة وأضف الروابط التي تستخدمها فعلًا (إنستغرام وتيك توك وفيسبوك وX وبنترست وغيرها). القنوات الفارغة لا تظهر أبدًا.",
        "اختر التصميم والألوان، أو حدّد ألوانك الخاصة.",
        "في تصميم الدعم، يختار العميل موضوعًا مثل تتبع طلبي أو نصيحة عن منتج، ويفتح كل موضوع واتساب برسالة خاصة به.",
      ],
    },
    result: {
      en: "More conversations with shoppers who have questions, which turns doubts into orders.",
      ar: "محادثات أكثر مع العملاء الذين لديهم أسئلة، فتتحول الشكوك إلى طلبات.",
    },
    watch: {
      en: "Opens and clicks on each channel.",
      ar: "عدد فتح الشريط والنقرات على كل قناة.",
    },
    tips: {
      en: [
        "The bar stays hidden until you add a WhatsApp number or at least one link.",
        "Reply quickly. Fast answers are the main reason this feature pays off.",
        "Raise the bottom offset if the bar overlaps a sticky Add to Cart button on mobile.",
      ],
      ar: [
        "يبقى الشريط مخفيًا حتى تضيف رقم واتساب أو رابطًا واحدًا على الأقل.",
        "ردّ بسرعة. سرعة الرد هي السبب الرئيسي لنجاح هذه الميزة.",
        "ارفع المسافة السفلية إذا تداخل الشريط مع زر الإضافة للسلة الثابت في الجوال.",
      ],
    },
  },
  {
    id: "scarcity",
    route: "/app/scarcity",
    category: "trust",
    name: { en: "Urgency & Social Proof Notifications", ar: "إشعارات الإلحاح والإثبات الاجتماعي" },
    goal: {
      en: "Small corner messages that build trust and gentle urgency: recent purchases, low stock, limited offers and shipping hints.",
      ar: "رسائل صغيرة في زاوية الشاشة تبني الثقة وإحساسًا لطيفًا بالإلحاح: مشتريات حديثة، ومخزون منخفض، وعروض محدودة، وتنبيهات الشحن.",
    },
    how: {
      en: [
        "Write a few short messages and choose which kinds to show.",
        "Set when the first message appears, how long it stays and the gap between messages.",
        "Choose colors and position, then save.",
      ],
      ar: [
        "اكتب عدة رسائل قصيرة واختر الأنواع التي تريد إظهارها.",
        "حدّد وقت ظهور أول رسالة ومدة بقائها والفاصل بين الرسائل.",
        "اختر الألوان والمكان ثم احفظ.",
      ],
    },
    result: {
      en: "Less hesitation. Visitors feel others are buying, which makes them more comfortable to buy too.",
      ar: "تردد أقل. يشعر الزائر أن آخرين يشترون، فيصبح أكثر راحة للشراء.",
    },
    watch: {
      en: "Notification views and the add-to-cart rate after them.",
      ar: "مرات ظهور الإشعارات ومعدل الإضافة للسلة بعدها.",
    },
    tips: {
      en: [
        "Keep every message true. Never invent purchases or stock levels.",
        "Use a calm rhythm: a message every twenty to thirty seconds is plenty.",
        "Do not run it together with many other pop-ups on the same page.",
      ],
      ar: [
        "اجعل كل رسالة صادقة. لا تختلق مشتريات أو كميات مخزون.",
        "استخدم إيقاعًا هادئًا: رسالة كل عشرين إلى ثلاثين ثانية تكفي.",
        "لا تشغّله مع نوافذ منبثقة كثيرة أخرى في الصفحة نفسها.",
      ],
    },
  },
];

const CATEGORIES: { id: "all" | Category; label: Bi }[] = [
  { id: "all", label: { en: "All features", ar: "كل المزايا" } },
  { id: "aov", label: { en: "Raise order value", ar: "رفع قيمة الطلب" } },
  { id: "trust", label: { en: "Build trust & urgency", ar: "الثقة والإلحاح" } },
  { id: "support", label: { en: "Support", ar: "الدعم" } },
  { id: "retention", label: { en: "Repeat sales", ar: "مبيعات متكررة" } },
];

const UI = {
  eyebrow: { en: "XPoost Guide", ar: "دليل XPoost" },
  title: { en: "Help & Guide", ar: "المساعدة والدليل" },
  subtitle: {
    en: "Everything you need to turn XPoost into more orders: what each feature does, why it matters, what to expect, and how to get the best results.",
    ar: "كل ما تحتاجه لتحويل XPoost إلى طلبات أكثر: ما تفعله كل ميزة، ولماذا هي مهمة، وما النتيجة المتوقعة، وكيف تحصل على أفضل أداء.",
  },
  statFeatures: { en: "Conversion features", ar: "ميزة لزيادة المبيعات" },
  statLanguages: { en: "Storefront languages", ar: "لغات للمتجر" },
  statClick: { en: "Click to switch on", ar: "ضغطة لتفعيل كل ميزة" },
  quickTitle: { en: "Get started in 3 steps", ar: "ابدأ في 3 خطوات" },
  quick: [
    {
      t: { en: "Turn on the app embed", ar: "فعّل الإضافة في القالب" },
      d: {
        en: "In your theme editor, open App embeds and switch on the XPoost blocks. Without this, nothing shows on your store.",
        ar: "من محرر القالب افتح App embeds وفعّل بلوكات XPoost. بدون ذلك لن يظهر شيء في متجرك.",
      },
    },
    {
      t: { en: "Switch on a feature and fill it in", ar: "فعّل ميزة واضبط إعداداتها" },
      d: {
        en: "From the Overview page turn on a feature, open its settings, write your offer and save. Start with the Shipping Bar and one upsell.",
        ar: "من صفحة النظرة العامة فعّل ميزة وافتح إعداداتها واكتب عرضك ثم احفظ. ابدأ بشريط الشحن وعرض بيع إضافي واحد.",
      },
    },
    {
      t: { en: "Check Analytics and improve", ar: "راجع التحليلات وحسّن" },
      d: {
        en: "After a week, open Analytics to see what shoppers respond to, then adjust one thing at a time.",
        ar: "بعد أسبوع افتح صفحة التحليلات لترى ما يتفاعل معه العملاء، ثم عدّل شيئًا واحدًا في كل مرة.",
      },
    },
  ],
  openTheme: { en: "Open theme editor", ar: "افتح محرر القالب" },
  checklistTitle: { en: "Your launch checklist", ar: "قائمة الإطلاق" },
  checklistHint: { en: "Tick items as you go. Your progress is saved in this browser.", ar: "علّم ما أنجزته. يتم حفظ تقدمك في هذا المتصفح." },
  checklist: [
    { en: "App embed is switched on in my theme", ar: "فعّلت الإضافة (App embed) في القالب" },
    { en: "Storefront languages are set up in Translations", ar: "ضبطت لغات المتجر من صفحة الترجمة" },
    { en: "Free Shipping Bar is on with milestones that fit my margins", ar: "شريط الشحن مفعّل بمراحل تناسب هامش ربحي" },
    { en: "At least one upsell rule is live (pre-purchase or cart)", ar: "قاعدة بيع إضافي واحدة على الأقل تعمل" },
    { en: "My real WhatsApp number is in the Support Bar", ar: "رقم واتساب الحقيقي موجود في شريط الدعم" },
    { en: "I tested everything on my phone", ar: "جرّبت كل شيء على الجوال" },
    { en: "I checked Analytics after seven days", ar: "راجعت التحليلات بعد سبعة أيام" },
  ] as Bi[],
  done: { en: "done", ar: "منجز" },
  featuresTitle: { en: "Every feature, explained", ar: "كل ميزة بالتفصيل" },
  searchPh: { en: "Search features...", ar: "ابحث في المزايا..." },
  noResults: { en: "No feature matches your search.", ar: "لا توجد ميزة تطابق بحثك." },
  active: { en: "Active", ar: "مفعّلة" },
  off: { en: "Off", ar: "متوقفة" },
  openSettings: { en: "Open settings", ar: "افتح الإعدادات" },
  secGoal: { en: "Purpose", ar: "الهدف" },
  secHow: { en: "How to set it up", ar: "طريقة الإعداد" },
  secResult: { en: "Expected result", ar: "النتيجة المتوقعة" },
  secWatch: { en: "What to watch", ar: "ما الذي تراقبه" },
  secTips: { en: "Tips", ar: "نصائح" },
  bpTitle: { en: "Best practices", ar: "أفضل الممارسات" },
  bpSub: { en: "Habits that make the difference between a widget that is just there and one that sells.", ar: "عادات تصنع الفرق بين ميزة موجودة فقط وميزة تبيع فعلًا." },
  metricsTitle: { en: "How to measure success", ar: "كيف تقيس النجاح" },
  metricsSub: { en: "Open the Analytics page and compare the same number before and after each change. Give each change at least a week.", ar: "افتح صفحة التحليلات وقارن الرقم نفسه قبل كل تغيير وبعده. امنح كل تغيير أسبوعًا على الأقل." },
  faqTitle: { en: "Questions & troubleshooting", ar: "أسئلة وحل المشكلات" },
  ctaTitle: { en: "Ready to put it to work?", ar: "جاهز للتطبيق؟" },
  ctaOverview: { en: "Go to Overview", ar: "اذهب إلى النظرة العامة" },
  ctaAnalytics: { en: "Open Analytics", ar: "افتح التحليلات" },
};

const BEST_PRACTICES: { icon: string; t: Bi; d: Bi }[] = [
  {
    icon: "shield",
    t: { en: "Be truthful", ar: "كن صادقًا" },
    d: {
      en: "Use real stock levels, real deadlines and rewards you will honor. Trust is the thing these widgets are really selling.",
      ar: "استخدم مخزونًا حقيقيًا ومهلًا حقيقية ومكافآت ستلتزم بها. الثقة هي ما تبيعه هذه الأدوات فعلًا.",
    },
  },
  {
    icon: "coin",
    t: { en: "Protect your margin", ar: "احمِ هامش ربحك" },
    d: {
      en: "Before you set a threshold or discount, check what is left after the reward. A reward that loses money on every order is not a promotion.",
      ar: "قبل تحديد مرحلة أو خصم، احسب ما يتبقى بعد المكافأة. المكافأة التي تخسرك في كل طلب ليست عرضًا ترويجيًا.",
    },
  },
  {
    icon: "phone",
    t: { en: "Design for mobile first", ar: "صمّم للجوال أولًا" },
    d: {
      en: "Most shoppers browse on their phone. Always test there, and keep the Support Bar clear of sticky buttons.",
      ar: "أغلب العملاء يتصفحون من الجوال. جرّب دائمًا هناك، وأبعد شريط الدعم عن الأزرار الثابتة.",
    },
  },
  {
    icon: "layers",
    t: { en: "Do not stack pop-ups", ar: "لا تكدّس النوافذ" },
    d: {
      en: "Two or three widgets visible at once is a good ceiling. Space out their timing so the page never feels crowded.",
      ar: "ظهور ميزتين أو ثلاث معًا حد معقول. باعد بين توقيتاتها حتى لا تبدو الصفحة مزدحمة.",
    },
  },
  {
    icon: "globe",
    t: { en: "Speak your customer's language", ar: "خاطب عميلك بلغته" },
    d: {
      en: "Fill in each language you sell in from the Translations page. Short, friendly copy beats long explanations.",
      ar: "املأ كل لغة تبيع بها من صفحة الترجمة. النص القصير الودود أفضل من الشرح الطويل.",
    },
  },
  {
    icon: "flask",
    t: { en: "Change one thing at a time", ar: "غيّر شيئًا واحدًا في كل مرة" },
    d: {
      en: "If you change three things at once you will not know which one worked. Wait a week, compare, then move on.",
      ar: "إذا غيّرت ثلاثة أشياء معًا فلن تعرف أيها نجح. انتظر أسبوعًا وقارن ثم انتقل للتالي.",
    },
  },
];

const METRICS: { icon: string; t: Bi; d: Bi }[] = [
  {
    icon: "cart",
    t: { en: "Average order value", ar: "متوسط قيمة الطلب" },
    d: { en: "Should rise with the Shipping Bar and upsells.", ar: "يُفترض أن يرتفع مع شريط الشحن وعروض البيع الإضافي." },
  },
  {
    icon: "box",
    t: { en: "Units per order", ar: "القطع لكل طلب" },
    d: { en: "Quantity Breaks and bundles push this up.", ar: "خصومات الكميات والحزم ترفع هذا الرقم." },
  },
  {
    icon: "click",
    t: { en: "Offer acceptance", ar: "قبول العروض" },
    d: { en: "Views versus accepts on each upsell. Low acceptance means the offer is not relevant enough.", ar: "المشاهدات مقابل القبول في كل عرض. القبول المنخفض يعني أن العرض غير مناسب بما يكفي." },
  },
  {
    icon: "flag",
    t: { en: "Milestone reach", ar: "الوصول إلى المراحل" },
    d: { en: "How many carts reach each Shipping Bar milestone. If almost none do, the first one is too high.", ar: "عدد السلات التي تصل إلى كل مرحلة. إذا لم تصل إلا قلة فالمرحلة الأولى مرتفعة جدًا." },
  },
];

const FAQ: { q: Bi; a: Bi }[] = [
  {
    q: { en: "A feature is switched on but nothing shows on my store.", ar: "الميزة مفعّلة ولا يظهر شيء في متجري." },
    a: {
      en: "Check that the app embed is on in your theme editor (App embeds), that you saved the feature's settings, and that the feature is on in the Overview page. Then reload your store in a private window, because browsers keep old files for a short time. The Shipping Bar only appears when the cart has items, and the Support Bar only appears once you add a WhatsApp number or a link.",
      ar: "تأكد أن الإضافة مفعّلة في محرر القالب (App embeds)، وأنك حفظت إعدادات الميزة، وأنها مفعّلة في صفحة النظرة العامة. ثم أعد تحميل متجرك في نافذة خاصة لأن المتصفح يحتفظ بالملفات القديمة لفترة قصيرة. شريط الشحن يظهر فقط عندما تكون في السلة منتجات، وشريط الدعم يظهر فقط بعد إضافة رقم واتساب أو رابط.",
    },
  },
  {
    q: { en: "Which currency do the shipping thresholds use?", ar: "ما العملة المستخدمة في مراحل الشحن؟" },
    a: {
      en: "Your store currency, which is read from your Shopify settings. Shoppers who see another currency get the amounts converted automatically. If you change your store currency, open the Shipping Bar page and save once.",
      ar: "عملة متجرك كما هي في إعدادات Shopify. العملاء الذين يرون عملة أخرى تُحوَّل لهم المبالغ تلقائيًا. إذا غيّرت عملة المتجر افتح صفحة شريط الشحن واحفظ مرة واحدة.",
    },
  },
  {
    q: { en: "How do country rules decide who sees what?", ar: "كيف تحدد قواعد الدول من يرى ماذا؟" },
    a: {
      en: "They follow the country your customer picks in your store's country selector (Markets). When the customer changes it, the bar changes too, and checkout uses the same country for the rewards. To test, switch the country on your store and reload.",
      ar: "تتبع الدولة التي يختارها العميل من محدد الدولة في متجرك (Markets). عندما يغيّرها يتغير الشريط أيضًا، ويستخدم الدفع الدولة نفسها للمكافآت. للتجربة غيّر الدولة في متجرك وأعد التحميل.",
    },
  },
  {
    q: { en: "The bar promises free shipping but the customer still pays for shipping.", ar: "الشريط يعد بشحن مجاني لكن العميل ما زال يدفع الشحن." },
    a: {
      en: "The milestone's reward must be set to Free shipping (not Display only), and your shipping profile needs a rate for that country. When it works you will see a discount called Tier Perks Rewards in your Shopify Discounts. Also check that its combination settings allow it to work with your other discounts.",
      ar: "يجب ضبط مكافأة المرحلة على شحن مجاني (وليس عرض فقط)، ويجب أن يحتوي ملف الشحن على سعر لتلك الدولة. عند نجاحها سترى خصمًا باسم Tier Perks Rewards في صفحة الخصومات بـ Shopify. تأكد أيضًا أن إعدادات الدمج تسمح له بالعمل مع خصوماتك الأخرى.",
    },
  },
  {
    q: { en: "Does XPoost slow my store down?", ar: "هل يبطّئ XPoost متجري؟" },
    a: {
      en: "No. The storefront scripts are small and load after your page, as theme app extensions, so they do not block what your visitors see first.",
      ar: "لا. سكربتات المتجر صغيرة وتُحمَّل بعد صفحتك كإضافات للقالب، فلا تعطّل ما يراه الزوار أولًا.",
    },
  },
  {
    q: { en: "Which languages are supported?", ar: "ما اللغات المدعومة؟" },
    a: {
      en: "Seven: Arabic, English, French, German, Spanish, Italian and Portuguese. Open Translations to edit the text shoppers see in each language. The dashboard language is changed from the selector at the top.",
      ar: "سبع لغات: العربية والإنجليزية والفرنسية والألمانية والإسبانية والإيطالية والبرتغالية. افتح صفحة الترجمة لتعديل النص الذي يراه العملاء بكل لغة. لغة لوحة التحكم تتغير من القائمة في الأعلى.",
    },
  },
  {
    q: { en: "I do not see the Thank-You offer after checkout.", ar: "لا يظهر عرض الشكر بعد الدفع." },
    a: {
      en: "Add the XPoost Thank-you Upsell block to the Thank you page in your Shopify checkout editor, then create at least one active offer. Place a test order to see it.",
      ar: "أضف بلوك XPoost Thank-you Upsell إلى صفحة الشكر في محرر صفحة الدفع بـ Shopify، ثم أنشئ عرضًا واحدًا مفعّلًا على الأقل. اطلب طلبًا تجريبيًا لتراه.",
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   Small building blocks
   ───────────────────────────────────────────────────────────── */

const ICON_PATHS: Record<string, string> = {
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  coin: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.8c0 2.2-5 1.2-5 3.4 0 1.2 1 1.8 2.5 1.8s2.5-.5 2.5-1.5",
  phone: "M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  flask: "M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3M8 15h8",
  cart: "M3 4h2l2 11h10l2-8H7M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z",
  box: "M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10",
  click: "M9 3v4M3 9h4M5 5l3 3M12 12l8 3-3.5 1.5L15 20l-3-8z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  check: "M5 12l5 5 9-10",
  chevron: "M6 9l6 6 6-6",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 002 2h13",
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name] || ICON_PATHS.spark} />
    </svg>
  );
}

const FEATURE_ICON: Record<FeatureId, string> = {
  shippingBar: "flag",
  prePurchase: "layers",
  inCart: "cart",
  quantityBreaks: "box",
  scarcity: "spark",
  productScarcity: "flask",
  socialBar: "phone",
  thankYou: "book",
};

/** Marks .xh-reveal elements with data-in as they scroll into view (an attribute, so React className re-renders never strip it). */
function useReveal(deps: unknown[]) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".xh-reveal:not([data-in])"));
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((e) => e.setAttribute("data-in", "1"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.setAttribute("data-in", "1");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((e) => io.observe(e));
    // Safety net: never leave content hidden if the observer does not fire.
    const t = window.setTimeout(() => els.forEach((e) => e.setAttribute("data-in", "1")), 2500);
    return () => {
      window.clearTimeout(t);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function CountUp({ to, ms = 1100 }: { to: number; ms?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{n}</>;
}

/** Looping CSS mini-animations that mimic each feature on a storefront. */
function Demo({ id, isAr }: { id: FeatureId; isAr: boolean }) {
  switch (id) {
    case "shippingBar":
      return (
        <div className="xh-demo xh-d-ship" aria-hidden="true">
          <div className="xh-d-ship-label">{isAr ? "أضف 120 لتفتح الشحن المجاني" : "Add 120 to unlock free shipping"}</div>
          <div className="xh-d-ship-track"><i /></div>
          <div className="xh-d-ship-dots"><b>1</b><b>2</b><b>3</b></div>
        </div>
      );
    case "prePurchase":
      return (
        <div className="xh-demo xh-d-pre" aria-hidden="true">
          <div className="xh-d-pre-modal">
            <span className="xh-d-line w60" />
            <div className="xh-d-pre-row"><i className="xh-d-img" /><span className="xh-d-line w40" /><em /></div>
            <div className="xh-d-pre-row"><i className="xh-d-img" /><span className="xh-d-line w50" /><em /></div>
            <div className="xh-d-pre-btn">{isAr ? "أضف الاثنين ووفّر" : "Add both & save"}</div>
          </div>
        </div>
      );
    case "inCart":
      return (
        <div className="xh-demo xh-d-cart" aria-hidden="true">
          <div className="xh-d-cart-head" />
          <div className="xh-d-cart-row"><i className="xh-d-img" /><span className="xh-d-line w60" /></div>
          <div className="xh-d-cart-offer"><i className="xh-d-img" /><span className="xh-d-line w50" /><b>+</b></div>
          <div className="xh-d-cart-offer d2"><i className="xh-d-img" /><span className="xh-d-line w40" /><b>+</b></div>
        </div>
      );
    case "quantityBreaks":
      return (
        <div className="xh-demo xh-d-qty" aria-hidden="true">
          <div className="xh-d-q q1"><small>1x</small></div>
          <div className="xh-d-q q2"><small>2x</small><u>{isAr ? "الأشهر" : "Popular"}</u></div>
          <div className="xh-d-q q3"><small>3x</small></div>
        </div>
      );
    case "scarcity":
      return (
        <div className="xh-demo xh-d-toast-wrap" aria-hidden="true">
          <div className="xh-d-page"><span className="xh-d-line w60" /><span className="xh-d-line w40" /></div>
          <div className="xh-d-toast"><i /> <span>{isAr ? "شخص ما اشترى هذا للتو" : "Someone just ordered this"}</span></div>
        </div>
      );
    case "productScarcity":
      return (
        <div className="xh-demo xh-d-stock" aria-hidden="true">
          <div className="xh-d-stock-msg">{isAr ? "تبقّت قطع قليلة" : "Only a few left"}</div>
          <div className="xh-d-stock-track"><i /></div>
        </div>
      );
    case "socialBar":
      return (
        <div className="xh-demo xh-d-social" aria-hidden="true">
          <div className="xh-d-social-list">
            <span>{isAr ? "تتبع طلبي" : "Track my order"}</span>
            <span>{isAr ? "نصيحة عن منتج" : "Product advice"}</span>
            <span>{isAr ? "طلب إرجاع" : "Return request"}</span>
          </div>
          <div className="xh-d-social-btn"><i /></div>
        </div>
      );
    case "thankYou":
      return (
        <div className="xh-demo xh-d-gift" aria-hidden="true">
          <div className="xh-d-gift-box"><i className="lid" /><i className="body" /></div>
          <div className="xh-d-gift-code">THANKS10</div>
        </div>
      );
  }
}

function FeatureCard({
  f,
  isAr,
  open,
  onToggle,
  enabled,
}: {
  f: Feature;
  isAr: boolean;
  open: boolean;
  onToggle: () => void;
  enabled: boolean;
}) {
  const L = (b: Bi) => (isAr ? b.ar : b.en);
  const how = isAr ? f.how.ar : f.how.en;
  const tips = isAr ? f.tips.ar : f.tips.en;
  return (
    <article id={f.id} className={`xh-card xh-reveal ${open ? "is-open" : ""}`}>
      <button type="button" className="xh-card-head" aria-expanded={open} aria-controls={`${f.id}-body`} onClick={onToggle}>
        <span className="xh-card-icon"><Icon name={FEATURE_ICON[f.id]} size={20} /></span>
        <span className="xh-card-title">
          <strong>{L(f.name)}</strong>
          <small>{L(f.goal)}</small>
        </span>
        <span className={`xh-badge ${enabled ? "on" : ""}`}>{enabled ? L(UI.active) : L(UI.off)}</span>
        <span className="xh-chev"><Icon name="chevron" size={18} /></span>
      </button>
      <div className="xh-card-bodywrap" id={`${f.id}-body`}>
        <div className="xh-card-body">
          <div className="xh-card-cols">
            <div className="xh-card-main">
              <h4><Icon name="flag" size={14} /> {L(UI.secHow)}</h4>
              <ol className="xh-steps">
                {how.map((s, i) => (
                  <li key={i} style={{ animationDelay: `${i * 90}ms` }}>{s}</li>
                ))}
              </ol>
              <div className="xh-result">
                <h4><Icon name="spark" size={14} /> {L(UI.secResult)}</h4>
                <p>{L(f.result)}</p>
                <p className="xh-watch"><b>{L(UI.secWatch)}:</b> {L(f.watch)}</p>
              </div>
              <h4><Icon name="bulb" size={14} /> {L(UI.secTips)}</h4>
              <ul className="xh-tips">
                {tips.map((s, i) => (
                  <li key={i} style={{ animationDelay: `${i * 90}ms` }}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="xh-card-side">
              <Demo id={f.id} isAr={isAr} />
              <Link className="xh-btn" to={f.route}>
                {L(UI.openSettings)} <Icon name="arrow" size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HelpGuide() {
  const { enabled } = useLoaderData<typeof loader>();
  const ctx = useOutletContext<{ isAr?: boolean } | undefined>();
  const isAr = !!ctx?.isAr;
  const L = (b: Bi) => (isAr ? b.ar : b.en);

  const [category, setCategory] = useState<"all" | Category>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<FeatureId | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => UI.checklist.map(() => false));
  const [bpIndex, setBpIndex] = useState(0);
  const loaded = useRef(false);

  // Restore checklist and open the card named in the URL (#shippingBar)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("xp_help_checklist");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setChecked(UI.checklist.map((_, i) => !!arr[i]));
      }
    } catch {}
    const h = (window.location.hash || "").replace("#", "");
    if (h && FEATURES.some((f) => f.id === h)) setOpenId(h as FeatureId);
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem("xp_help_checklist", JSON.stringify(checked));
    } catch {}
  }, [checked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FEATURES.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (!q) return true;
      const hay = `${f.name.en} ${f.name.ar} ${f.goal.en} ${f.goal.ar}`.toLowerCase();
      return hay.includes(q);
    });
  }, [category, query]);

  useReveal([filtered.length, category, openId]);

  const doneCount = checked.filter(Boolean).length;
  const pct = Math.round((doneCount / UI.checklist.length) * 100);
  const featureCount = FEATURES.length;

  return (
    <s-page heading={L(UI.title)}>
      <style>{HELP_STYLES}</style>
      <div className="xh-root" dir={isAr ? "rtl" : "ltr"}>
        {/* HERO */}
        <section className="xh-hero">
          <span className="xh-orb xh-orb-a" />
          <span className="xh-orb xh-orb-b" />
          <div className="xh-hero-in">
            <div className="xh-eyebrow"><Icon name="book" size={14} /> {L(UI.eyebrow)}</div>
            <h1 className="xh-hero-title">{L(UI.title)}</h1>
            <p className="xh-hero-sub">{L(UI.subtitle)}</p>
            <div className="xh-stats">
              <div className="xh-stat"><b><CountUp to={featureCount} /></b><span>{L(UI.statFeatures)}</span></div>
              <div className="xh-stat"><b><CountUp to={7} /></b><span>{L(UI.statLanguages)}</span></div>
              <div className="xh-stat"><b>1</b><span>{L(UI.statClick)}</span></div>
            </div>
          </div>
        </section>

        {/* QUICK START */}
        <section className="xh-section">
          <h2 className="xh-h2">{L(UI.quickTitle)}</h2>
          <div className="xh-quick">
            <span className="xh-quick-line" />
            {UI.quick.map((s, i) => (
              <div key={i} className="xh-quick-step xh-reveal" style={{ transitionDelay: `${i * 120}ms` }}>
                <span className="xh-quick-num">{i + 1}</span>
                <h3>{L(s.t)}</h3>
                <p>{L(s.d)}</p>
                {i === 0 ? (
                  <a className="xh-btn" href="shopify:admin/themes/current/editor?context=apps" target="_top">
                    {L(UI.openTheme)} <Icon name="arrow" size={14} />
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* CHECKLIST */}
        <section className="xh-section">
          <div className="xh-panel xh-reveal">
            <div className="xh-panel-head">
              <div>
                <h2 className="xh-h2 xh-h2--tight">{L(UI.checklistTitle)}</h2>
                <p className="xh-muted">{L(UI.checklistHint)}</p>
              </div>
              <div className="xh-ring" role="img" aria-label={`${pct}%`}>
                <svg viewBox="0 0 44 44" width="64" height="64">
                  <circle cx="22" cy="22" r="19" className="bg" />
                  <circle cx="22" cy="22" r="19" className="fg" style={{ strokeDashoffset: 119.4 * (1 - pct / 100) }} />
                </svg>
                <span>{pct}%</span>
              </div>
            </div>
            <ul className="xh-check">
              {UI.checklist.map((c, i) => (
                <li key={i}>
                  <label className={checked[i] ? "is-done" : ""}>
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                    />
                    <span className="xh-box"><Icon name="check" size={14} /></span>
                    <span className="xh-check-text">{L(c)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FEATURES */}
        <section className="xh-section">
          <h2 className="xh-h2">{L(UI.featuresTitle)}</h2>
          <div className="xh-toolbar">
            <div className="xh-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={query}
                placeholder={L(UI.searchPh)}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={L(UI.searchPh)}
              />
            </div>
            <div className="xh-chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`xh-chip ${category === c.id ? "is-on" : ""}`}
                  onClick={() => setCategory(c.id)}
                >
                  {L(c.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="xh-cards">
            {filtered.length === 0 ? <p className="xh-muted">{L(UI.noResults)}</p> : null}
            {filtered.map((f) => (
              <FeatureCard
                key={f.id}
                f={f}
                isAr={isAr}
                open={openId === f.id}
                enabled={!!enabled[f.id]}
                onToggle={() => setOpenId(openId === f.id ? null : f.id)}
              />
            ))}
          </div>
        </section>

        {/* BEST PRACTICES */}
        <section className="xh-section">
          <h2 className="xh-h2">{L(UI.bpTitle)}</h2>
          <p className="xh-muted xh-sub">{L(UI.bpSub)}</p>
          <div className="xh-bp">
            {BEST_PRACTICES.map((b, i) => (
              <div
                key={i}
                className={`xh-bp-card xh-reveal ${bpIndex === i ? "is-hot" : ""}`}
                style={{ transitionDelay: `${(i % 3) * 90}ms` }}
                onMouseEnter={() => setBpIndex(i)}
              >
                <span className="xh-bp-icon"><Icon name={b.icon} size={20} /></span>
                <h3>{L(b.t)}</h3>
                <p>{L(b.d)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* METRICS */}
        <section className="xh-section">
          <h2 className="xh-h2">{L(UI.metricsTitle)}</h2>
          <p className="xh-muted xh-sub">{L(UI.metricsSub)}</p>
          <div className="xh-metrics">
            {METRICS.map((m, i) => (
              <div key={i} className="xh-metric xh-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="xh-metric-icon"><Icon name={m.icon} size={18} /></span>
                <div>
                  <strong>{L(m.t)}</strong>
                  <p>{L(m.d)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="xh-section">
          <h2 className="xh-h2">{L(UI.faqTitle)}</h2>
          <div className="xh-faq">
            {FAQ.map((x, i) => (
              <details key={i} className="xh-faq-item xh-reveal">
                <summary>
                  <span>{L(x.q)}</span>
                  <Icon name="chevron" size={16} />
                </summary>
                <p>{L(x.a)}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="xh-section">
          <div className="xh-cta xh-reveal">
            <h2>{L(UI.ctaTitle)}</h2>
            <div className="xh-cta-actions">
              <Link className="xh-btn xh-btn--solid" to="/app">{L(UI.ctaOverview)} <Icon name="arrow" size={14} /></Link>
              <Link className="xh-btn" to="/app/analytics">{L(UI.ctaAnalytics)} <Icon name="arrow" size={14} /></Link>
            </div>
          </div>
        </section>
      </div>
    </s-page>
  );
}

const HELP_STYLES = `
  .xh-root { --gold:#FFB000; --gold-soft:#FFD985; --bg:#060605; --card:#0F0E0C; --line:#2A2A2A; --muted:#9e9e9e; color:#fff; padding: 4px 0 40px; }
  .xh-root * { box-sizing: border-box; }
  .xh-section { margin-top: 28px; }
  .xh-h2 { font-size: 18px; font-weight: 800; color: var(--gold); margin: 0 0 14px; letter-spacing: .2px; display:flex; align-items:center; gap:10px; }
  .xh-h2::after { content:""; flex:1; height:1px; background: #2A2A2A; }
  [dir="rtl"] .xh-h2::after { background: #2A2A2A; }
  .xh-h2--tight { margin-bottom: 4px; }
  .xh-h2--tight::after { display:none; }
  .xh-muted { color: var(--muted); font-size: 13px; margin: 0; line-height: 1.6; }
  .xh-sub { margin: -6px 0 14px; }

  /* reveal on scroll */
  .xh-reveal { opacity: 0; transform: translateY(14px); transition: opacity .55s ease, transform .55s cubic-bezier(.2,.7,.2,1); }
  .xh-reveal[data-in] { opacity: 1; transform: none; }

  /* buttons */
  .xh-btn { display:inline-flex; align-items:center; gap:6px; padding: 8px 14px; border-radius: 8px; border:1px solid rgba(255,176,0,.5); color: var(--gold); background: rgba(255,176,0,.06); font-size: 12.5px; font-weight: 700; text-decoration:none; cursor:pointer; transition: background .2s, transform .2s, box-shadow .2s; }
  .xh-btn:hover { background: rgba(255,176,0,.16); transform: translateY(-1px);}
  .xh-btn--solid { background: var(--gold); color:#060605; }
  .xh-btn--solid:hover { background:#e2bf4a; }
  [dir="rtl"] .xh-btn svg { transform: scaleX(-1); }

  /* hero */
  .xh-hero { position:relative; overflow:hidden; border-radius: 14px; border:1px solid rgba(255,176,0,.25); background: #060605; padding: 34px 28px; }
  .xh-hero-in { position:relative; z-index:1; }
  .xh-orb { display:none; position:absolute; border-radius:50%; filter: blur(40px); opacity:.35; pointer-events:none; }
  .xh-orb-a { width:240px; height:240px; background:#FFB000; inset-block-start:-80px; inset-inline-end:-60px; animation: xh-float 9s ease-in-out infinite; }
  .xh-orb-b { width:180px; height:180px; background:#9a6b00; inset-block-end:-70px; inset-inline-start:30%; animation: xh-float 11s ease-in-out infinite reverse; }
  @keyframes xh-float { 0%,100% { transform: translate(0,0) scale(1);} 50% { transform: translate(-18px,14px) scale(1.12);} }
  .xh-eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:11px; font-weight:800; color: var(--gold); margin-bottom:10px; }
  .xh-hero-title { font-family: Georgia, "Iowan Old Style", "Times New Roman", serif; font-size: 34px; font-weight: 600; margin: 0 0 10px; letter-spacing:-.3px; color:#EFEFEF; }
  @keyframes xh-shine { to { background-position: 220% center; } }
  .xh-hero-sub { max-width: 640px; color:#CFCFCF; font-size: 14.5px; line-height: 1.7; margin: 0 0 22px; animation: xh-up .7s ease both .1s; }
  @keyframes xh-up { from { opacity:0; transform: translateY(10px);} to { opacity:1; transform:none; } }
  .xh-stats { display:flex; flex-wrap:wrap; gap: 12px; }
  .xh-stat { min-width: 130px; background: rgba(255,255,255,.04); border:1px solid #2C2C2C; border-radius: 12px; padding: 12px 16px; animation: xh-up .7s ease both .25s; }
  .xh-stat b { display:block; font-size: 26px; color: var(--gold); font-variant-numeric: tabular-nums; }
  .xh-stat span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }

  /* quick start */
  .xh-quick { position:relative; display:grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .xh-quick-line { position:absolute; inset-block-start: 22px; inset-inline: 16% 16%; height: 2px; background: #444444; transform-origin: left center; animation: xh-draw 1.4s ease both .3s; z-index:0; }
  [dir="rtl"] .xh-quick-line { transform-origin: right center; background: #444444; }
  @keyframes xh-draw { from { transform: scaleX(0);} to { transform: scaleX(1);} }
  .xh-quick-step { position:relative; z-index:1; background: var(--card); border:1px solid var(--line); border-radius: 12px; padding: 20px 16px 16px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .xh-quick-step h3 { margin:0; font-size: 14.5px; }
  .xh-quick-step p { margin:0 0 6px; font-size:12.5px; color: var(--muted); line-height:1.6; }
  .xh-quick-num { width: 44px; height:44px; border-radius:50%; display:grid; place-items:center; font-weight:800; font-size:18px; color:#060605; background: var(--gold);animation: xh-pulse 2.4s ease-out infinite; margin-block-start:-42px; }
  @keyframes xh-pulse { 0% {} 70%,100% {} }
  .xh-quick-step { margin-block-start: 22px; }

  /* panel + checklist */
  .xh-panel { background: var(--card); border:1px solid var(--line); border-radius: 12px; padding: 20px; }
  .xh-panel-head { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom: 14px; }
  .xh-ring { position:relative; width:64px; height:64px; flex-shrink:0; }
  .xh-ring svg { transform: rotate(-90deg); }
  .xh-ring circle { fill:none; stroke-width:4; }
  .xh-ring .bg { stroke:#262626; }
  .xh-ring .fg { stroke: var(--gold); stroke-linecap: round; stroke-dasharray: 119.4; transition: stroke-dashoffset .6s ease; }
  .xh-ring span { position:absolute; inset:0; display:grid; place-items:center; font-size:13px; font-weight:800; color: var(--gold); }
  .xh-check { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
  .xh-check label { display:flex; align-items:center; gap:12px; padding: 10px 12px; border:1px solid #262626; border-radius: 10px; cursor:pointer; background:#111; transition: border-color .2s, background .2s; }
  .xh-check label:hover { border-color: rgba(255,176,0,.4); }
  .xh-check input { position:absolute; opacity:0; pointer-events:none; }
  .xh-box { width:22px; height:22px; border-radius:7px; border:1.5px solid #444444; display:grid; place-items:center; color: transparent; flex-shrink:0; transition: all .25s cubic-bezier(.3,1.6,.5,1); }
  .xh-check input:focus-visible + .xh-box { outline:2px solid var(--gold); outline-offset:2px; }
  .xh-check label.is-done { background: rgba(255,176,0,.07); border-color: rgba(255,176,0,.35); }
  .xh-check label.is-done .xh-box { background: var(--gold); border-color: var(--gold); color:#060605; transform: scale(1.08); }
  .xh-check-text { font-size: 13.5px; color:#e5e5e5; }
  .xh-check label.is-done .xh-check-text { color:#9A9A9A; text-decoration: line-through; text-decoration-color: rgba(255,176,0,.6); }

  /* toolbar */
  .xh-toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-bottom: 14px; }
  .xh-search { display:flex; align-items:center; gap:8px; background:#111; border:1px solid #2C2C2C; border-radius:10px; padding: 8px 12px; min-width: 240px; color: var(--muted); transition: border-color .2s; }
  .xh-search:focus-within { border-color: rgba(255,176,0,.6); color: var(--gold); }
  .xh-search input { background:transparent; border:0; outline:0; color:#fff; font-size:13px; width:100%; }
  .xh-chips { display:flex; flex-wrap:wrap; gap:8px; }
  .xh-chip { background:#111; border:1px solid #2C2C2C; color:#C9C9C9; padding: 7px 13px; border-radius: 999px; font-size:12px; font-weight:600; cursor:pointer; transition: all .2s; }
  .xh-chip:hover { border-color: rgba(255,176,0,.5); color: var(--gold); }
  .xh-chip.is-on { background: var(--gold); color:#060605; border-color: var(--gold); }

  /* feature cards */
  .xh-cards { display:grid; gap: 12px; }
  .xh-card { background: var(--card); border:1px solid var(--line); border-radius: 12px; overflow:hidden; transition: border-color .25s, box-shadow .25s, opacity .55s ease, transform .55s cubic-bezier(.2,.7,.2,1); }
  .xh-card:hover { border-color: rgba(255,176,0,.35); }
  .xh-card.is-open { border-color: rgba(255,176,0,.6);}
  .xh-card-head { width:100%; display:flex; align-items:center; gap: 14px; padding: 16px 18px; background:transparent; border:0; color:inherit; cursor:pointer; text-align: start; font: inherit; }
  .xh-card-icon { width:40px; height:40px; border-radius:10px; display:grid; place-items:center; color: var(--gold); background: rgba(255,176,0,.1); border:1px solid rgba(255,176,0,.3); flex-shrink:0; transition: transform .3s; }
  .xh-card:hover .xh-card-icon, .xh-card.is-open .xh-card-icon { transform: rotate(-6deg) scale(1.06); }
  .xh-card-title { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
  .xh-card-title strong { font-size: 15px; }
  .xh-card-title small { font-size: 12.5px; color: var(--muted); line-height:1.5; }
  .xh-badge { font-size: 10.5px; font-weight:800; padding: 3px 9px; border-radius: 999px; background:#202020; color:#8A8A8A; border:1px solid #353535; flex-shrink:0; }
  .xh-badge.on { background: rgba(34,197,94,.12); color:#4ade80; border-color: rgba(34,197,94,.4); }
  .xh-chev { color: var(--muted); transition: transform .3s; display:grid; }
  .xh-card.is-open .xh-chev { transform: rotate(180deg); color: var(--gold); }
  .xh-card-bodywrap { display:grid; grid-template-rows: 0fr; transition: grid-template-rows .4s ease; }
  .xh-card.is-open .xh-card-bodywrap { grid-template-rows: 1fr; }
  .xh-card-body { overflow:hidden; min-height:0; }
  .xh-card-cols { display:grid; grid-template-columns: 1fr 260px; gap: 22px; padding: 4px 18px 20px; border-top:1px solid #262626; padding-top: 16px; }
  .xh-card-main h4 { display:flex; align-items:center; gap:7px; margin: 14px 0 8px; font-size: 11.5px; font-weight:800; color: var(--gold); text-transform: uppercase; letter-spacing:.8px; }
  .xh-card-main h4:first-child { margin-top:0; }
  .xh-steps, .xh-tips { margin:0; padding:0; list-style:none; display:grid; gap:8px; counter-reset: s; }
  .xh-steps li, .xh-tips li { position:relative; font-size: 13px; line-height:1.65; color:#D6D6D6; padding-inline-start: 30px; opacity:0; }
  .xh-card.is-open .xh-steps li, .xh-card.is-open .xh-tips li { animation: xh-up .5s ease both; }
  .xh-steps li::before { counter-increment: s; content: counter(s); position:absolute; inset-inline-start:0; top:1px; width:20px; height:20px; border-radius:50%; background: rgba(255,176,0,.15); color: var(--gold); font-size:11px; font-weight:800; display:grid; place-items:center; }
  .xh-tips li::before { content:""; position:absolute; inset-inline-start:6px; top:9px; width:8px; height:8px; border-radius:50%; background: var(--gold);}
  .xh-result { margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: rgba(255,176,0,.06); border:1px solid rgba(255,176,0,.25); }
  .xh-result h4 { margin-top:0 !important; }
  .xh-result p { margin: 0 0 6px; font-size: 13px; line-height:1.65; color:#eee; }
  .xh-result .xh-watch { color: var(--muted); font-size: 12.5px; margin:0; }
  .xh-result .xh-watch b { color: #CFCFCF; }
  .xh-card-side { display:flex; flex-direction:column; gap: 12px; align-items: stretch; }

  /* mini demos */
  .xh-demo { position:relative; height: 170px; border-radius: 12px; background: #060605; border:1px solid #262626; overflow:hidden; padding: 14px; display:flex; flex-direction:column; justify-content:center; gap:10px; }
  .xh-d-line { display:block; height:7px; border-radius:4px; background:#2a2a2a; }
  .w40{width:40%} .w50{width:50%} .w60{width:60%}
  .xh-d-img { display:block; width:26px; height:26px; border-radius:6px; background: #2b2000; flex-shrink:0; }
  /* shipping */
  .xh-d-ship-label { font-size: 11px; font-weight:700; text-align:center; color:#eee; }
  .xh-d-ship-track { height: 8px; border-radius: 4px; background:#262626; overflow:hidden; }
  .xh-d-ship-track i { display:block; height:100%; width:0; border-radius:4px; background: #FFB000; animation: xh-fill 6s ease-in-out infinite; }
  @keyframes xh-fill { 0% { width:5%; } 70% { width:100%; } 100% { width:100%; } }
  .xh-d-ship-dots { display:flex; justify-content:space-between; }
  .xh-d-ship-dots b { width:22px; height:22px; border-radius:50%; background:#262626; color:#757575; font-size:10px; display:grid; place-items:center; animation: xh-dot 6s ease-in-out infinite; }
  .xh-d-ship-dots b:nth-child(1) { animation-delay: 0s; } .xh-d-ship-dots b:nth-child(2) { animation-delay: 1.8s; } .xh-d-ship-dots b:nth-child(3) { animation-delay: 3.4s; }
  @keyframes xh-dot { 0%,25% { background:#262626; color:#757575; transform: scale(1);} 35%,100% { background:#FFB000; color:#060605; transform: scale(1.12);} }
  /* pre-purchase */
  .xh-d-pre-modal { background:#161616; border:1px solid #353535; border-radius:10px; padding: 12px; display:grid; gap:8px; animation: xh-pop 5s ease-in-out infinite; transform-origin:center; }
  @keyframes xh-pop { 0% { opacity:0; transform: scale(.85);} 12%,80% { opacity:1; transform: scale(1);} 95%,100% { opacity:0; transform: scale(.95);} }
  .xh-d-pre-row { display:flex; align-items:center; gap:8px; }
  .xh-d-pre-row .xh-d-line { flex:1; width:auto; }
  .xh-d-pre-row em { width:14px; height:14px; border-radius:4px; border:1.5px solid #FFB000; animation: xh-tick 5s infinite; }
  @keyframes xh-tick { 0%,30% { background:transparent; } 40%,100% { background:#FFB000; } }
  .xh-d-pre-btn { text-align:center; font-size:10.5px; font-weight:800; color:#060605; background:#FFB000; border-radius:6px; padding:6px; animation: xh-btn 5s infinite; }
  @keyframes xh-btn { 0%,45% { transform: scale(1);} 55% { transform: scale(1.06);} 65%,100% { transform: scale(1);} }
  /* cart */
  .xh-d-cart-head { height:8px; width:40%; border-radius:4px; background:#2a2a2a; }
  .xh-d-cart-row, .xh-d-cart-offer { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; background:#161616; border:1px solid #262626; }
  .xh-d-cart-row .xh-d-line, .xh-d-cart-offer .xh-d-line { flex:1; width:auto; }
  .xh-d-cart-offer { border-color: rgba(255,176,0,.4); opacity:0; animation: xh-slide 5s ease-in-out infinite; }
  .xh-d-cart-offer.d2 { animation-delay: .6s; }
  .xh-d-cart-offer b { width:18px; height:18px; border-radius:50%; background:#FFB000; color:#060605; display:grid; place-items:center; font-size:13px; }
  @keyframes xh-slide { 0% { opacity:0; transform: translateX(20px);} 15%,85% { opacity:1; transform:none;} 100% { opacity:0; transform: translateX(-10px);} }
  [dir="rtl"] .xh-d-cart-offer { animation-name: xh-slide-rtl; }
  @keyframes xh-slide-rtl { 0% { opacity:0; transform: translateX(-20px);} 15%,85% { opacity:1; transform:none;} 100% { opacity:0; transform: translateX(10px);} }
  /* quantity */
  .xh-demo.xh-d-qty { flex-direction:row; align-items:center; gap:8px; }
  .xh-d-q { flex:1; height: 84px; border-radius:10px; background:#161616; border:1px solid #2a2a2a; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; position:relative; animation: xh-qsel 6s infinite; }
  .xh-d-q small { font-size:15px; font-weight:800; color:#ddd; }
  .xh-d-q u { text-decoration:none; position:absolute; top:-7px; font-size:8.5px; font-weight:800; background:#FFB000; color:#060605; padding:1px 6px; border-radius:4px; }
  .q1 { animation-delay: 0s; } .q2 { animation-delay: 2s; } .q3 { animation-delay: 4s; }
  @keyframes xh-qsel { 0%,28% { border-color:#FFB000; background: rgba(255,176,0,.12); transform: translateY(-4px);} 34%,100% { border-color:#2a2a2a; background:#161616; transform:none; } }
  /* toast */
  .xh-d-page { display:grid; gap:8px; }
  .xh-d-toast { position:absolute; inset-block-end:12px; inset-inline-start:12px; display:flex; align-items:center; gap:8px; background:#060605; border:1px solid rgba(255,176,0,.5); border-radius:9px; padding:8px 10px; font-size:10.5px; font-weight:700; animation: xh-toast 5s ease-in-out infinite; }
  .xh-d-toast i { width:8px; height:8px; border-radius:50%; background:#4ade80; box-shadow:0 0 8px #4ade80; }
  @keyframes xh-toast { 0% { opacity:0; transform: translateX(-30px);} 15%,75% { opacity:1; transform:none;} 100% { opacity:0; transform: translateX(-30px);} }
  [dir="rtl"] .xh-d-toast { animation-name: xh-toast-rtl; }
  @keyframes xh-toast-rtl { 0% { opacity:0; transform: translateX(30px);} 15%,75% { opacity:1; transform:none;} 100% { opacity:0; transform: translateX(30px);} }
  /* stock */
  .xh-d-stock-msg { font-size:12px; font-weight:800; color:#ff8a8a; text-align:center; animation: xh-blink 1.6s infinite; }
  @keyframes xh-blink { 50% { opacity:.55; } }
  .xh-d-stock-track { height:10px; border-radius:5px; background:#141414; overflow:hidden; }
  .xh-d-stock-track i { display:block; height:100%; width:80%; border-radius:5px; background: #d9825b; animation: xh-drain 5s ease-in-out infinite; }
  @keyframes xh-drain { 0% { width:85%; } 70%,100% { width:18%; } }
  /* social */
  .xh-demo.xh-d-social { align-items:flex-end; justify-content:flex-end; }
  .xh-d-social-list { display:grid; gap:6px; margin-bottom: 8px; width: 78%; transform-origin: bottom right; animation: xh-open 5s ease-in-out infinite; }
  [dir="rtl"] .xh-d-social-list { transform-origin: bottom left; }
  .xh-d-social-list span { font-size:10.5px; font-weight:700; padding:6px 10px; border-radius:7px; background:#161616; border:1px solid #353535; }
  @keyframes xh-open { 0%,8% { opacity:0; transform: scale(.7);} 22%,80% { opacity:1; transform: scale(1);} 95%,100% { opacity:0; transform: scale(.8);} }
  .xh-d-social-btn { width:36px; height:36px; border-radius:50%; background:#25d366; display:grid; place-items:center; box-shadow:0 0 0 0 rgba(37,211,102,.5); animation: xh-pulse2 2.4s infinite; }
  .xh-d-social-btn i { width:14px; height:14px; border-radius:50%; background:#fff; opacity:.9; }
  @keyframes xh-pulse2 { 0% { box-shadow:0 0 0 0 rgba(37,211,102,.5);} 70%,100% { box-shadow:0 0 0 12px rgba(37,211,102,0);} }
  /* gift */
  .xh-demo.xh-d-gift { align-items:center; }
  .xh-d-gift-box { position:relative; width:64px; height:56px; }
  .xh-d-gift-box i { position:absolute; inset-inline:0; border-radius:6px; background: #FFB000; }
  .xh-d-gift-box .body { bottom:0; height:36px; }
  .xh-d-gift-box .lid { top:0; height:18px; inset-inline:-4px; animation: xh-lid 4s ease-in-out infinite; transform-origin: left bottom; background: #FFD985; }
  @keyframes xh-lid { 0%,25% { transform: rotate(0) translateY(0);} 40%,80% { transform: rotate(-24deg) translateY(-14px);} 100% { transform: rotate(0);} }
  .xh-d-gift-code { font-size:13px; font-weight:800; letter-spacing:2px; color:#FFB000; border:1px dashed rgba(255,176,0,.6); padding:5px 12px; border-radius:6px; animation: xh-code 4s ease-in-out infinite; }
  @keyframes xh-code { 0%,35% { opacity:0; transform: translateY(8px);} 50%,85% { opacity:1; transform:none;} 100% { opacity:0; } }

  /* best practices */
  .xh-bp { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .xh-bp-card { background: var(--card); border:1px solid var(--line); border-radius: 12px; padding: 16px; transition: border-color .25s, transform .35s cubic-bezier(.2,.7,.2,1), box-shadow .25s, opacity .55s ease; }
  .xh-bp-card[data-in]:hover, .xh-bp-card.is-hot[data-in]:hover { transform: translateY(-4px); border-color: rgba(255,176,0,.55); box-shadow: 0 12px 28px rgba(0,0,0,.4); }
  .xh-bp-icon { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; color: var(--gold); background: rgba(255,176,0,.1); border:1px solid rgba(255,176,0,.3); margin-bottom:10px; }
  .xh-bp-card h3 { margin:0 0 6px; font-size:14.5px; }
  .xh-bp-card p { margin:0; font-size: 12.8px; line-height:1.65; color: var(--muted); }

  /* metrics */
  .xh-metrics { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap:12px; }
  .xh-metric { display:flex; gap:12px; align-items:flex-start; background: var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; }
  .xh-metric-icon { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; color:#060605; background: var(--gold); flex-shrink:0; }
  .xh-metric strong { font-size:13.5px; }
  .xh-metric p { margin:4px 0 0; font-size:12.5px; color: var(--muted); line-height:1.6; }

  /* faq */
  .xh-faq { display:grid; gap:10px; }
  .xh-faq-item { background: var(--card); border:1px solid var(--line); border-radius: 12px; padding: 0 16px; transition: border-color .2s, opacity .55s ease, transform .55s ease; }
  .xh-faq-item[open] { border-color: rgba(255,176,0,.5); }
  .xh-faq-item summary { list-style:none; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:12px; padding: 14px 0; font-size:13.5px; font-weight:700; }
  .xh-faq-item summary::-webkit-details-marker { display:none; }
  .xh-faq-item summary svg { transition: transform .3s; color: var(--muted); flex-shrink:0; }
  .xh-faq-item[open] summary svg { transform: rotate(180deg); color: var(--gold); }
  .xh-faq-item p { margin:0; padding: 0 0 16px; font-size:13px; line-height:1.75; color:#CFCFCF; animation: xh-up .4s ease both; }

  /* cta */
  .xh-cta { text-align:center; border-radius:14px; padding: 28px 18px; background: rgba(255,176,0,.06); border:1px solid rgba(255,176,0,.35); }
  .xh-cta h2 { margin:0 0 14px; font-size:20px; }
  .xh-cta-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }

  @media (max-width: 760px) {
    .xh-hero { padding: 24px 16px; }
    .xh-hero-title { font-family: Georgia, "Iowan Old Style", "Times New Roman", serif; font-size: 34px; font-weight: 600; margin: 0 0 10px; letter-spacing:-.3px; color:#EFEFEF; }
    .xh-quick { grid-template-columns: 1fr; gap: 28px; }
    .xh-quick-line { display:none; }
    .xh-card-cols { grid-template-columns: 1fr; }
    .xh-card-head { flex-wrap: wrap; }
    .xh-badge { order: 3; }
    .xh-search { width:100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .xh-root *, .xh-root *::before, .xh-root *::after { animation: none !important; transition: none !important; }
    .xh-reveal { opacity:1; transform:none; }
    .xh-steps li, .xh-tips li { opacity:1; }
    .xh-d-cart-offer, .xh-d-pre-modal, .xh-d-toast, .xh-d-social-list, .xh-d-gift-code { opacity:1; }
  }
`;
