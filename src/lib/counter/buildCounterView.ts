/**
 * Shared core logic for building CounterView from locationId.
 * Used by getCounterView (server page) and GET /api/counter/view.
 * Caller must have validated auth and location access.
 */

import { eq, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  items,
  categories,
  customizationGroups,
  categoryItems,
  itemTags,
  itemAllergens,
  itemCustomizations,
} from "@/db/schema";
import { merchantLocations } from "@/lib/db/schema";
import { resolveItemPromos } from "@/lib/promotions/resolveActivePromotions";
import { attachPosPromotionsCategory } from "@/lib/promotions/promotions-category";
import type {
  CounterView,
  CounterViewCustomizationGroup,
} from "@/lib/counter/counterView";
import type { MenuItem, Category } from "@/lib/take-order-data";

const CATEGORY_ICONS: Record<string, string> = {
  drinks: "🍹",
  starters: "🥗",
  mains: "🍽️",
  desserts: "🍰",
  food: "🍽️",
  default: "📋",
};

function mapCategory(
  api: { id: string; name: string; emoji?: string | null }
): Category {
  const nameLower = (api.name || "").toLowerCase();
  const icon =
    api.emoji?.trim() ||
    CATEGORY_ICONS[nameLower] ||
    CATEGORY_ICONS[api.id?.toLowerCase()] ||
    CATEGORY_ICONS.default;
  return {
    id: api.id,
    name: api.name || "Uncategorized",
    icon,
  };
}

function mapItem(
  raw: {
    id: string;
    name: string;
    description?: string | null;
    price: string;
    photoUrl?: string | null;
    status?: string;
    categoryIds?: string[];
    tagNames?: string[];
    groupIds?: string[];
  },
  groupMap: Map<string, CounterViewCustomizationGroup>
): MenuItem {
  const price = parseFloat(raw.price);
  const categoryId = raw.categoryIds?.[0] ?? "uncategorized";
  const available =
    raw.status !== "hidden" &&
    raw.status !== "soldout" &&
    raw.status !== "draft";

  const options: MenuItem["options"] = [];

  for (const groupId of raw.groupIds ?? []) {
    const group = groupMap.get(groupId);
    if (!group?.options?.length) continue;

    const choices: (string | { name: string; price: number })[] = group.options
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((opt) => {
        const p =
          typeof opt.price === "string" ? parseFloat(opt.price) : Number(opt.price);
        if (p > 0) return { name: opt.name, price: p };
        return opt.name;
      });

    options.push({
      name: group.name || "Options",
      required: !!group.isRequired || (group.minSelections ?? 0) > 0,
      choices,
    });
  }

  const dietary = (raw.tagNames ?? [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase().replace(/\s+/g, "_"));

  return {
    id: raw.id,
    name: raw.name || "Item",
    description: raw.description ?? "",
    price: Number.isFinite(price) ? price : 0,
    category: categoryId,
    image: raw.photoUrl ?? "",
    dietary,
    options,
    extras: undefined,
    available,
  };
}

export async function buildCounterView(
  locationId: string
): Promise<CounterView | null> {
  const locationRow = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { id: true, name: true },
  });
  if (!locationRow) return null;

  const [rawItems, rawCategories, rawGroups] = await Promise.all([
    db.query.items.findMany({
      where: eq(items.locationId, locationId),
      orderBy: [desc(items.displayOrder), desc(items.createdAt)],
      columns: {
        id: true,
        name: true,
        description: true,
        price: true,
        photoUrl: true,
        status: true,
      },
      with: {
        categoryItems: {
          with: { category: { columns: { id: true } } },
        },
        itemTags: { with: { tag: { columns: { name: true } } } },
        itemCustomizations: {
          with: { group: { columns: { id: true } } },
        },
      },
    }),
    db.query.categories.findMany({
      where: eq(categories.locationId, locationId),
      orderBy: [asc(categories.displayOrder), desc(categories.createdAt)],
      columns: { id: true, name: true, emoji: true },
    }),
    db.query.customizationGroups.findMany({
      where: eq(customizationGroups.locationId, locationId),
      orderBy: [desc(customizationGroups.displayOrder), desc(customizationGroups.createdAt)],
      columns: {
        id: true,
        name: true,
        isRequired: true,
        minSelections: true,
        maxSelections: true,
      },
      with: {
        options: {
          orderBy: (opt, { asc }) => [asc(opt.displayOrder)],
          columns: { id: true, name: true, price: true, displayOrder: true },
        },
      },
    }),
  ]);

  const customizations: CounterViewCustomizationGroup[] = rawGroups.map((g) => ({
    id: g.id,
    name: g.name,
    isRequired: g.isRequired,
    minSelections: g.minSelections,
    maxSelections: g.maxSelections,
    options: g.options.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price,
      displayOrder: o.displayOrder,
    })),
  }));

  const groupMap = new Map(customizations.map((g) => [g.id, g]));

  const mappedCategories = rawCategories.map((c) =>
    mapCategory({ id: c.id, name: c.name, emoji: c.emoji })
  );
  const uncategorized: Category = {
    id: "uncategorized",
    name: "Uncategorized",
    icon: CATEGORY_ICONS.default,
  };
  const categoryIds = new Set(mappedCategories.map((c) => c.id));
  if (!categoryIds.has("uncategorized")) {
    mappedCategories.push(uncategorized);
  }

  const mappedItems = rawItems.map((item) =>
    mapItem(
      {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        photoUrl: item.photoUrl,
        status: item.status,
        categoryIds: item.categoryItems?.map((ci) => ci.category.id) ?? [],
        tagNames: item.itemTags?.map((it) => it.tag.name) ?? [],
        groupIds: item.itemCustomizations?.map((ic) => ic.group.id) ?? [],
      },
      groupMap
    )
  );

  const promoByItem = await resolveItemPromos(
    locationId,
    new Map(mappedItems.map((item) => [item.id, item.price])),
  );
  const itemsWithPromo = mappedItems.map((item) => {
    const promo = promoByItem.get(item.id);
    if (!promo) return item;
    return {
      ...item,
      price: promo.price,
      compareAtPrice: promo.compareAtPrice,
      promoKind: promo.kind,
    };
  });

  const { categories: menuCategories, items: menuItems } =
    attachPosPromotionsCategory(mappedCategories, itemsWithPromo);

  return {
    location: {
      id: locationRow.id,
      name: locationRow.name ?? undefined,
    },
    menu: {
      items: menuItems,
      categories: menuCategories,
      customizations,
    },
  };
}
