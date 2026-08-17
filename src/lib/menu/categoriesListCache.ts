import { revalidateTag } from "next/cache";

export function categoriesListCacheTag(locationId: string): string {
  return `categories-list:${locationId}`;
}

export function revalidateCategoriesList(locationId: string | null | undefined) {
  if (!locationId) return;
  revalidateTag(categoriesListCacheTag(locationId), "max");
}
