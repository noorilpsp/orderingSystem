import type { GuestCartItem } from "@/lib/guest-menu/types";
import { isRewardCartLine } from "@/lib/public-menu/guest-reward-cart";
import { newGuestCartLineId } from "@/lib/public-menu/guest-cart-lines";

export const GUEST_CART_STORAGE_PREFIX = "guest-cart:";
export const GUEST_CART_STORAGE_VERSION = 1;
export const GUEST_CART_MAX_LINES = 40;
export const GUEST_CART_MAX_QUANTITY = 99;

const PROMO_KINDS = new Set(["sale_price", "bogo"]);

export function guestCartStorageKey(storeSlug: string): string {
  return `${GUEST_CART_STORAGE_PREFIX}${storeSlug.trim().toLowerCase()}`;
}

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseSelectedOptions(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const next: Record<string, string[]> = {};
  for (const [groupId, optionIds] of Object.entries(raw as Record<string, unknown>)) {
    if (!groupId.trim() || !Array.isArray(optionIds)) continue;
    const ids = optionIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length > 0) next[groupId] = ids;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function parseSauceQuantities(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const next: Record<string, number> = {};
  for (const [sauceId, qty] of Object.entries(raw as Record<string, unknown>)) {
    const n = asFiniteNumber(qty);
    if (!sauceId.trim() || n == null || n <= 0) continue;
    next[sauceId] = Math.min(GUEST_CART_MAX_QUANTITY, Math.max(1, Math.floor(n)));
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function parseStoredGuestCartItem(raw: unknown): GuestCartItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) return null;
  if (typeof record.name !== "string" || !record.name.trim()) return null;

  const quantity = asFiniteNumber(record.quantity);
  const price = asFiniteNumber(record.price);
  if (quantity == null || quantity <= 0 || price == null || price < 0) return null;

  if (typeof record.rewardId === "string" && record.rewardId.length > 0) {
    return null;
  }

  const compareAt = asFiniteNumber(record.compareAtPrice);
  const promoKind =
    typeof record.promoKind === "string" && PROMO_KINDS.has(record.promoKind)
      ? (record.promoKind as GuestCartItem["promoKind"])
      : undefined;

  const line: GuestCartItem = {
    id: record.id,
    name: record.name,
    quantity: Math.min(GUEST_CART_MAX_QUANTITY, Math.max(1, Math.floor(quantity))),
    price,
    lineId:
      typeof record.lineId === "string" && record.lineId.trim()
        ? record.lineId
        : newGuestCartLineId(),
  };

  if (compareAt != null && compareAt > price) line.compareAtPrice = compareAt;
  if (promoKind) line.promoKind = promoKind;

  const selectedOptions = parseSelectedOptions(record.selectedOptions);
  if (selectedOptions) line.selectedOptions = selectedOptions;

  const sauceQuantities = parseSauceQuantities(record.sauceQuantities);
  if (sauceQuantities) line.sauceQuantities = sauceQuantities;

  if (typeof record.specialInstructions === "string" && record.specialInstructions.trim()) {
    line.specialInstructions = record.specialInstructions.trim().slice(0, 500);
  }

  return line;
}

export function parseStoredGuestCart(raw: string | null): GuestCartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : [];
    const lines: GuestCartItem[] = [];
    for (const entry of items) {
      const line = parseStoredGuestCartItem(entry);
      if (!line) continue;
      lines.push(line);
      if (lines.length >= GUEST_CART_MAX_LINES) break;
    }
    return lines;
  } catch {
    return [];
  }
}

export function pruneGuestCartAgainstMenu(
  cart: GuestCartItem[],
  menuItemIds: ReadonlySet<string>,
): GuestCartItem[] {
  if (menuItemIds.size === 0) return cart;
  const next = cart.filter(
    (line) => isRewardCartLine(line) || menuItemIds.has(line.id),
  );
  return next.length === cart.length ? cart : next;
}

export function foodLinesForGuestCartStorage(cart: GuestCartItem[]): GuestCartItem[] {
  return cart.filter((line) => !isRewardCartLine(line)).slice(0, GUEST_CART_MAX_LINES);
}

export function readGuestCart(storeSlug: string): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  const slug = storeSlug.trim();
  if (!slug || slug === "demo") return [];
  try {
    return parseStoredGuestCart(window.localStorage.getItem(guestCartStorageKey(slug)));
  } catch {
    return [];
  }
}

export function writeGuestCart(storeSlug: string, cart: GuestCartItem[]): void {
  if (typeof window === "undefined") return;
  const slug = storeSlug.trim();
  if (!slug || slug === "demo") return;
  try {
    const items = foodLinesForGuestCartStorage(cart);
    if (items.length === 0) {
      window.localStorage.removeItem(guestCartStorageKey(slug));
      return;
    }
    window.localStorage.setItem(
      guestCartStorageKey(slug),
      JSON.stringify({ v: GUEST_CART_STORAGE_VERSION, items }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearGuestCart(storeSlug: string): void {
  if (typeof window === "undefined") return;
  const slug = storeSlug.trim();
  if (!slug || slug === "demo") return;
  try {
    window.localStorage.removeItem(guestCartStorageKey(slug));
  } catch {
    // ignore
  }
}
