import type {
  GuestCartItem,
  GuestCustomizationGroup,
} from "@/lib/guest-menu/types";
import { isRewardCartLine } from "@/lib/public-menu/guest-reward-cart";
import { resolveCustomizationOptionPrice } from "@/lib/public-menu/resolve-customization-option-price";
import { guestLineCompareAtTotal, lineTotalWithPromo } from "@/lib/promotions/pricing";

type PricedCartItem = Pick<
  GuestCartItem,
  | "price"
  | "quantity"
  | "selectedOptions"
  | "sauceQuantities"
  | "rewardId"
  | "promoKind"
  | "compareAtPrice"
>;

/**
 * Unit price for a guest cart line: menu base + selected customization option prices.
 * Legacy static "size" options replace the base price (absolute pricing); all other
 * options are treated as add-on deltas (merchant customization groups), including
 * size-dependent conditional topping prices when present.
 */
export function getGuestCartItemUnitPrice(
  item: PricedCartItem,
  groups: GuestCustomizationGroup[],
): number {
  if (isRewardCartLine(item)) return 0;

  const groupMap = new Map(groups.map((group) => [group.id, group]));
  let basePrice = Number(item.price) || 0;
  let addOns = 0;
  const selectedOptions = item.selectedOptions ?? {};

  const sizeOptionId = selectedOptions.size?.[0];
  if (sizeOptionId) {
    const sizeGroup = groupMap.get("size");
    const sizeOption = sizeGroup?.options.find((option) => option.id === sizeOptionId);
    if (sizeOption) {
      basePrice = Number(sizeOption.price) || 0;
    }
  }

  for (const [groupId, optionIds] of Object.entries(selectedOptions)) {
    if (groupId === "size") continue;
    const group = groupMap.get(groupId);
    if (!group) continue;
    for (const optionId of optionIds) {
      const option = group.options.find((entry) => entry.id === optionId);
      if (option) {
        addOns += resolveCustomizationOptionPrice(
          option,
          selectedOptions,
          groups,
        );
      }
    }
  }

  for (const [sauceId, qty] of Object.entries(item.sauceQuantities ?? {})) {
    if (qty <= 0) continue;
    const sauceGroup = groupMap.get("sauces");
    const sauce = sauceGroup?.options.find((entry) => entry.id === sauceId);
    if (sauce) {
      addOns +=
        resolveCustomizationOptionPrice(sauce, selectedOptions, groups) * qty;
    }
  }

  return Math.max(0, basePrice + addOns);
}

export function getGuestCartItemLineTotal(
  item: PricedCartItem,
  groups: GuestCustomizationGroup[],
): number {
  const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
  const unit = getGuestCartItemUnitPrice(item, groups);
  const base = Number(item.price) || 0;
  const addOns = Math.max(0, unit - base);
  return lineTotalWithPromo({
    kind: item.promoKind,
    unitBasePrice: base,
    addOnsTotalPerUnit: addOns,
    quantity,
  });
}

export function getGuestCartItemCompareAtLineTotal(
  item: PricedCartItem,
  groups: GuestCustomizationGroup[],
): number | null {
  if (isRewardCartLine(item)) return null;
  const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
  const unit = getGuestCartItemUnitPrice(item, groups);
  const base = Number(item.price) || 0;
  const addOns = Math.max(0, unit - base);
  return guestLineCompareAtTotal({
    promoKind: item.promoKind,
    chargedTotal: getGuestCartItemLineTotal(item, groups),
    quantity,
    unitBasePrice: base,
    compareAtPrice: item.compareAtPrice,
    addOnsTotalPerUnit: addOns,
  });
}

export function sumGuestCartItems(
  items: PricedCartItem[],
  groups: GuestCustomizationGroup[],
): number {
  return items.reduce(
    (sum, item) => sum + getGuestCartItemLineTotal(item, groups),
    0,
  );
}
