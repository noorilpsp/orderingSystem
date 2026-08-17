import { revalidateTag } from "next/cache";

export function itemDetailCacheTag(itemId: string): string {
  return `item-data:${itemId}`;
}

export function revalidateItemDetail(itemId: string | null | undefined) {
  if (!itemId) return;
  revalidateTag(itemDetailCacheTag(itemId), "max");
}
