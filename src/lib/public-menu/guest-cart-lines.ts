import type { GuestCartItem, GuestMenuItem } from "@/lib/guest-menu/types";
import { isRewardCartLine } from "@/lib/public-menu/guest-reward-cart";

export function newGuestCartLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function guestCartLineId(item: Pick<GuestCartItem, "id" | "lineId">): string {
  return item.lineId ?? item.id;
}

export function guestCartCustomizationKey(
  item: Pick<
    GuestCartItem,
    "selectedOptions" | "sauceQuantities" | "specialInstructions" | "rewardId"
  >,
): string {
  const options = item.selectedOptions ?? {};
  const optionPart = Object.keys(options)
    .sort()
    .map((groupId) => `${groupId}:${[...(options[groupId] ?? [])].sort().join(",")}`)
    .join("|");

  const sauces = item.sauceQuantities ?? {};
  const saucePart = Object.keys(sauces)
    .sort()
    .filter((sauceId) => (sauces[sauceId] ?? 0) > 0)
    .map((sauceId) => `${sauceId}:${sauces[sauceId]}`)
    .join("|");

  const notes = (item.specialInstructions ?? "").trim();
  const reward = item.rewardId ?? "";
  return `${optionPart}#${saucePart}#${notes}#${reward}`;
}

export function cartQuantityForCatalogItem(
  cart: GuestCartItem[],
  catalogItemId: string,
): number {
  return cart
    .filter((entry) => entry.id === catalogItemId && !isRewardCartLine(entry))
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function findLastIndex(
  cart: GuestCartItem[],
  predicate: (item: GuestCartItem) => boolean,
): number {
  for (let index = cart.length - 1; index >= 0; index -= 1) {
    if (predicate(cart[index])) return index;
  }
  return -1;
}

function toCartLine(
  item: GuestMenuItem | GuestCartItem,
  quantity: number,
  lineId: string,
): GuestCartItem {
  return {
    ...(item as GuestCartItem),
    quantity,
    lineId,
  };
}

export function mergeGuestCartAdd(
  prevCart: GuestCartItem[],
  item: GuestMenuItem | GuestCartItem,
  incomingQty: number,
): GuestCartItem[] {
  if (isRewardCartLine(item as GuestCartItem)) return prevCart;

  const incomingLineId =
    "lineId" in item && typeof item.lineId === "string" && item.lineId.length > 0
      ? item.lineId
      : null;

  if (incomingLineId) {
    const existingIndex = prevCart.findIndex((cartItem) => cartItem.lineId === incomingLineId);
    if (existingIndex >= 0) {
      return prevCart.map((cartItem, index) =>
        index === existingIndex
          ? { ...cartItem, quantity: cartItem.quantity + incomingQty }
          : cartItem,
      );
    }
  }

  const incomingKey = guestCartCustomizationKey(item as GuestCartItem);
  const matchIndex = prevCart.findIndex(
    (cartItem) =>
      !isRewardCartLine(cartItem) &&
      cartItem.id === item.id &&
      guestCartCustomizationKey(cartItem) === incomingKey,
  );

  if (matchIndex >= 0) {
    return prevCart.map((cartItem, index) =>
      index === matchIndex
        ? {
            ...cartItem,
            quantity: cartItem.quantity + incomingQty,
            lineId: cartItem.lineId ?? newGuestCartLineId(),
          }
        : cartItem,
    );
  }

  return [...prevCart, toCartLine(item, incomingQty, newGuestCartLineId())];
}

export function decrementGuestCartLine(
  prevCart: GuestCartItem[],
  itemId: string,
): { cart: GuestCartItem[]; removedReward: boolean } {
  const byLineId = prevCart.findIndex((cartItem) => cartItem.lineId === itemId);
  const index =
    byLineId >= 0 ? byLineId : findLastIndex(prevCart, (cartItem) => cartItem.id === itemId);

  if (index < 0) return { cart: prevCart, removedReward: false };

  const existing = prevCart[index];
  if (isRewardCartLine(existing)) {
    return {
      cart: prevCart.filter((_, entryIndex) => entryIndex !== index),
      removedReward: true,
    };
  }

  if (existing.quantity > 1) {
    return {
      cart: prevCart.map((cartItem, entryIndex) =>
        entryIndex === index
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem,
      ),
      removedReward: false,
    };
  }

  return {
    cart: prevCart.filter((_, entryIndex) => entryIndex !== index),
    removedReward: false,
  };
}

export function replaceGuestCartItem(
  prevCart: GuestCartItem[],
  item: GuestCartItem,
): GuestCartItem[] {
  const targetId = guestCartLineId(item);
  let found = false;
  const next = prevCart.map((cartItem) => {
    if (guestCartLineId(cartItem) !== targetId) return cartItem;
    found = true;
    return {
      ...item,
      lineId: cartItem.lineId ?? item.lineId ?? newGuestCartLineId(),
    };
  });
  return found ? next : prevCart;
}
