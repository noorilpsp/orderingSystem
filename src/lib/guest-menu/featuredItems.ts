import type { GuestCategory, GuestMenuItem } from "@/lib/guest-menu/types";

/** Featured carousel follows menu category order, not promotions. */
export function featuredItemsInCategoryOrder(
  categories: GuestCategory[],
  items: GuestMenuItem[],
): GuestMenuItem[] {
  const categoryIndex = new Map(
    categories.map((category, index) => [category.id, index]),
  );
  const lastIndexById = new Map<string, number>();
  const lastById = new Map<string, GuestMenuItem>();
  items.forEach((item, index) => {
    lastById.set(item.id, item);
    lastIndexById.set(item.id, index);
  });

  return [...lastById.values()]
    .filter((item) => Boolean(item.featured))
    .sort((a, b) => {
      const aCategory = categoryIndex.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER;
      const bCategory = categoryIndex.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER;
      if (aCategory !== bCategory) return aCategory - bCategory;
      return (lastIndexById.get(a.id) ?? 0) - (lastIndexById.get(b.id) ?? 0);
    });
}
