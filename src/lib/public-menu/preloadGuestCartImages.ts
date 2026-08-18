import type { GuestCartItem } from "@/lib/guest-menu/types";
import { isRewardCartLine } from "@/lib/public-menu/guest-reward-cart";

const warmed = new Set<string>();

/** Warm the exact URL the cart `<img>` will use so thumbs aren't fetched on open. */
export function preloadGuestImage(url?: string | null) {
  if (typeof window === "undefined") return;
  const cleaned = url?.trim() ?? "";
  if (!cleaned || cleaned === "/placeholder.svg" || warmed.has(cleaned)) return;
  warmed.add(cleaned);
  const img = new Image();
  img.decoding = "async";
  if ("fetchPriority" in img) {
    (img as HTMLImageElement & { fetchPriority: string }).fetchPriority = "low";
  }
  img.src = cleaned;
}

export function preloadGuestCartImages(
  cart: GuestCartItem[],
  items: Array<{ id: string; image?: string | null }>,
  rewards: Array<{ id: string; menuItemId?: string | null }>,
) {
  if (cart.length === 0) return;
  const itemById = new Map(items.map((item) => [item.id, item]));
  for (const line of cart) {
    if (isRewardCartLine(line)) {
      const reward = rewards.find((entry) => entry.id === line.rewardId);
      const menuItem = reward?.menuItemId ? itemById.get(reward.menuItemId) : undefined;
      preloadGuestImage(menuItem?.image);
      continue;
    }
    preloadGuestImage(itemById.get(line.id)?.image);
  }
}
