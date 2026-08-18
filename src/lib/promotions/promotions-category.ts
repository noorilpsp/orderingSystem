import type { GuestCategory } from "@/lib/guest-menu/types";

export const PROMOTIONS_CATEGORY_ID = "__promotions__";

export function guestPromotionsCategory(): GuestCategory {
  return {
    id: PROMOTIONS_CATEGORY_ID,
    emoji: "🏷️",
    name: "Promotions",
    i18n: { ar: { name: "العروض" } },
  };
}

export function posPromotionsCategory(): {
  id: string;
  name: string;
  icon: string;
} {
  return {
    id: PROMOTIONS_CATEGORY_ID,
    name: "Promotions",
    icon: "🏷️",
  };
}

export function hasActivePromo(item: {
  promoKind?: "sale_price" | "bogo" | null;
}): boolean {
  return item.promoKind === "sale_price" || item.promoKind === "bogo";
}

/** Keep the item in its original category and also list it under Promotions. */
export function withPromotionsCategoryEntries<
  T extends { promoKind?: "sale_price" | "bogo" | null; promoDisplayOrder?: number },
>(items: T[], clone: (item: T) => T): T[] {
  const promoted = items
    .filter(hasActivePromo)
    .sort((a, b) => (a.promoDisplayOrder ?? 0) - (b.promoDisplayOrder ?? 0));
  if (promoted.length === 0) return items;
  return [...promoted.map(clone), ...items];
}

export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function attachGuestPromotionsCategory<
  T extends {
    categoryId: string;
    promoKind?: "sale_price" | "bogo" | null;
    promoDisplayOrder?: number;
  },
>(
  categories: GuestCategory[],
  items: T[],
): { categories: GuestCategory[]; items: T[] } {
  if (!items.some(hasActivePromo)) return { categories, items };
  return {
    categories: [
      guestPromotionsCategory(),
      ...categories.filter((category) => category.id !== PROMOTIONS_CATEGORY_ID),
    ],
    items: withPromotionsCategoryEntries(items, (item) => ({
      ...item,
      categoryId: PROMOTIONS_CATEGORY_ID,
    })),
  };
}

export function attachPosPromotionsCategory<
  C extends { id: string },
  I extends {
    category: string;
    promoKind?: "sale_price" | "bogo" | null;
    promoDisplayOrder?: number;
  },
>(
  categories: C[],
  items: I[],
): { categories: C[]; items: I[] } {
  if (!items.some(hasActivePromo)) return { categories, items };
  const promotions = posPromotionsCategory() as C;
  return {
    categories: [
      promotions,
      ...categories.filter((category) => category.id !== PROMOTIONS_CATEGORY_ID),
    ],
    items: withPromotionsCategoryEntries(items, (item) => ({
      ...item,
      category: PROMOTIONS_CATEGORY_ID,
    })),
  };
}
