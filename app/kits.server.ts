// Kit Builder — server side: storefront payload (app proxy).

import prisma from "./db.server";
import { collectionProducts, conditionsPass, type ShopperContext } from "./bundles.server";
import { numericId } from "./utils/bundles";
import { parseKit, resolveKbTexts, type KbPool, type ParsedKit } from "./utils/kits";

type Admin = { graphql: Function };

export async function loadKits(shopId: string): Promise<ParsedKit[]> {
  const rows = await prisma.kit.findMany({ where: { shopId }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  return rows.map(parseKit);
}

function scheduleOk(k: ParsedKit, today: string) {
  if (k.config.startsAt && today < k.config.startsAt) return false;
  if (k.config.endsAt && today > k.config.endsAt) return false;
  return true;
}

export async function storefrontKits(admin: Admin | undefined, shop: string, kits: ParsedKit[], ctx: ShopperContext, lang: string) {
  const out: any[] = [];
  for (const k of kits) {
    if (!k.enabled || !scheduleOk(k, ctx.today) || !conditionsPass(k.conditions, ctx)) continue;
    const c = k.config;
    const texts = resolveKbTexts(k.texts, lang);
    const productIds = new Set<string>();
    const collectionIds = new Set<string>();
    const handlesOf = async (p: KbPool) => {
      const handles: string[] = [];
      for (const x of p.products) {
        if (!handles.includes(x.handle)) handles.push(x.handle);
        productIds.add(numericId(x.id));
      }
      for (const col of p.collections) {
        collectionIds.add(numericId(col.id));
        for (const x of await collectionProducts(admin, shop, col.id, 60)) if (!handles.includes(x.handle)) handles.push(x.handle);
      }
      return handles.slice(0, 60);
    };
    const steps: any[] = [];
    for (const s of c.steps) {
      const pools: Record<string, string[]> = {};
      if (s.byAnswer) for (const [opt, p] of Object.entries(s.byAnswer.pools)) pools[opt] = await handlesOf(p);
      const filters: any[] = [];
      for (const f of s.filters) filters.push({ id: f.id, label: f.label, handles: await handlesOf(f) });
      steps.push({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        pick: s.pick,
        min: s.min,
        max: s.max,
        handles: await handlesOf(s),
        filters,
        byAnswer: s.byAnswer ? { q: s.byAnswer.q, pools } : null,
        showIf: s.showIf,
      });
    }
    const hasProducts = steps.some((s) => s.handles.length || s.filters.some((f: any) => f.handles.length) || Object.values(s.byAnswer?.pools || {}).some((h: any) => h.length));
    if (!hasProducts) continue;
    out.push({
      id: k.id,
      name: k.name,
      design: k.design,
      display: c.display,
      afterAdd: c.afterAdd,
      hideSoldOut: c.hideSoldOut,
      allowDuplicates: c.allowDuplicates,
      heroImage: c.heroImage,
      device: k.placement.device,
      placement: {
        mode: k.placement.mode,
        products: k.placement.products.map((p) => numericId(p.id)),
        collections: k.placement.collections.map((x) => numericId(x.id)),
      },
      productIds: [...productIds],
      collectionIds: [...collectionIds],
      quiz: c.quiz.enabled ? c.quiz : { enabled: false, questions: [] },
      steps,
      pricing: c.pricing,
      gift: c.gift.enabled && c.gift.product?.variantId ? { handle: c.gift.product.handle, variantId: numericId(c.gift.product.variantId), minItems: c.gift.minItems } : null,
      style: k.style,
      texts,
    });
  }
  return out;
}
