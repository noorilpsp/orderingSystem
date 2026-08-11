import type { GuestCartItem, GuestMenuItem } from "@/lib/guest-menu/types";
import type { PublicMenuReward } from "@/lib/public-menu/types";

export function rewardCartLineId(rewardId: string): string {
  return `reward-line:${rewardId}`;
}

export function isRewardCartLine(item: Pick<GuestCartItem, "rewardId">): boolean {
  return typeof item.rewardId === "string" && item.rewardId.length > 0;
}

export function findRewardInCart(cart: GuestCartItem[]): GuestCartItem | undefined {
  return cart.find(isRewardCartLine);
}

export function buildRewardCartLine(
  reward: PublicMenuReward,
  menuItems: GuestMenuItem[],
): GuestCartItem {
  const menuItem =
    reward.menuItemId != null
      ? menuItems.find((item) => item.id === reward.menuItemId)
      : undefined;

  return {
    id: rewardCartLineId(reward.id),
    name: menuItem?.name ?? reward.name,
    quantity: 1,
    price: 0,
    rewardId: reward.id,
  };
}

export function previewCatalogDiscount(
  reward: PublicMenuReward,
  foodSubtotal: number,
): number {
  switch (reward.kind) {
    case "fixed_off":
      return Math.min(Number(reward.discountAmount ?? 0), foodSubtotal);
    case "percent_off": {
      const raw = (foodSubtotal * (reward.percentOff ?? 0)) / 100;
      return Math.min(raw, Number(reward.maxDiscountAmount ?? 0), foodSubtotal);
    }
    case "free_item":
      return 0;
    default: {
      const _exhaustive: never = reward.kind;
      return _exhaustive;
    }
  }
}

export function foodCartItems(cart: GuestCartItem[]): GuestCartItem[] {
  return cart.filter((item) => !isRewardCartLine(item));
}
