import type { GuestOrderModes, GuestOrderType } from "@/lib/guest-menu/types";
import { resolveGuestSessionMode } from "@/lib/public-menu/guestSessionMode";

export function isGuestTableSession(
  orderType: GuestOrderType,
  orderModes: GuestOrderModes | null | undefined,
): boolean {
  return (
    orderType === "dine-in" &&
    resolveGuestSessionMode(orderModes) !== "self_service"
  );
}

/** Pickup, delivery, and counter dine-in park when the store is closed. Table QR does not. */
export function guestParksUntilOpen(input: {
  storeOpenNow: boolean | null;
  orderType: GuestOrderType;
  orderModes?: GuestOrderModes | null;
}): boolean {
  if (input.storeOpenNow !== false) return false;
  if (isGuestTableSession(input.orderType, input.orderModes)) return false;
  switch (input.orderType) {
    case "pickup":
    case "delivery":
    case "dine-in":
      return true;
    default: {
      const _exhaustive: never = input.orderType;
      return _exhaustive;
    }
  }
}
