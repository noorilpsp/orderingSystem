export type GuestActiveOrder = {
  orderId: string;
  orderNumber: string;
  mode: "on_site" | "pickup";
  tableNumber: string | null;
  etaMinutes: number;
  savedAt: number;
};

const STORAGE_PREFIX = "guest-active-order:";
const DISMISSED_PREFIX = "guest-active-order-dismissed:";
const MAX_DISMISSED = 30;

function storageKey(storeSlug: string): string {
  return `${STORAGE_PREFIX}${storeSlug.trim().toLowerCase()}`;
}

function dismissedKey(storeSlug: string): string {
  return `${DISMISSED_PREFIX}${storeSlug.trim().toLowerCase()}`;
}

function readDismissedOrderIds(storeSlug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(dismissedKey(storeSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function markGuestActiveOrderDismissed(storeSlug: string, orderId: string): void {
  if (typeof window === "undefined" || !orderId) return;
  try {
    const next = [
      orderId,
      ...readDismissedOrderIds(storeSlug).filter((id) => id !== orderId),
    ].slice(0, MAX_DISMISSED);
    window.localStorage.setItem(dismissedKey(storeSlug), JSON.stringify(next));
  } catch {
    // ignore
  }
}

function clearSessionPlacementsForOrder(storeSlug: string, orderId: string): void {
  if (typeof window === "undefined" || !orderId) return;
  const normalized = storeSlug.trim().toLowerCase();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (!key?.startsWith("guest-order-placement:")) continue;
      const rest = key.slice("guest-order-placement:".length);
      const colon = rest.indexOf(":");
      if (colon < 0) continue;
      if (rest.slice(0, colon).toLowerCase() !== normalized) continue;
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { orderId?: string };
      if (parsed.orderId === orderId) keysToRemove.push(key);
    }
    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function readGuestActiveOrder(storeSlug: string): GuestActiveOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(storeSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestActiveOrder>;
    if (!parsed.orderId || typeof parsed.orderId !== "string") return null;
    if (readDismissedOrderIds(storeSlug).includes(parsed.orderId)) {
      window.localStorage.removeItem(storageKey(storeSlug));
      return null;
    }
    return {
      orderId: parsed.orderId,
      orderNumber:
        typeof parsed.orderNumber === "string" && parsed.orderNumber
          ? parsed.orderNumber
          : parsed.orderId,
      mode: parsed.mode === "pickup" ? "pickup" : "on_site",
      tableNumber:
        typeof parsed.tableNumber === "string" && parsed.tableNumber.trim()
          ? parsed.tableNumber.trim()
          : null,
      etaMinutes:
        typeof parsed.etaMinutes === "number" && parsed.etaMinutes > 0
          ? parsed.etaMinutes
          : 15,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeGuestActiveOrder(storeSlug: string, order: GuestActiveOrder): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(storeSlug),
      JSON.stringify({
        ...order,
        savedAt: Date.now(),
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearGuestActiveOrder(storeSlug: string, orderId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const knownOrderId = orderId ?? readGuestActiveOrder(storeSlug)?.orderId;
    window.localStorage.removeItem(storageKey(storeSlug));
    if (knownOrderId) {
      markGuestActiveOrderDismissed(storeSlug, knownOrderId);
      clearSessionPlacementsForOrder(storeSlug, knownOrderId);
    }
  } catch {
    // ignore
  }
}

/** Recover an in-progress order from session placement keys (same browser tab session). */
export function recoverGuestActiveOrderFromSession(storeSlug: string): GuestActiveOrder | null {
  if (typeof window === "undefined") return null;
  const normalized = storeSlug.trim().toLowerCase();
  const dismissed = new Set(readDismissedOrderIds(storeSlug));
  let best: GuestActiveOrder | null = null;

  try {
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (!key?.startsWith("guest-order-placement:")) continue;
      const rest = key.slice("guest-order-placement:".length);
      const colon = rest.indexOf(":");
      if (colon < 0) continue;
      if (rest.slice(0, colon).toLowerCase() !== normalized) continue;
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        status?: string;
        orderId?: string;
        orderNumber?: string;
        request?: { orderType?: string; tableNumber?: string | null };
      };
      if (parsed.status !== "success" || !parsed.orderId) continue;
      if (dismissed.has(parsed.orderId)) continue;
      const candidate: GuestActiveOrder = {
        orderId: parsed.orderId,
        orderNumber: parsed.orderNumber || parsed.orderId,
        mode: parsed.request?.orderType === "pickup" ? "pickup" : "on_site",
        tableNumber: parsed.request?.tableNumber?.trim() || null,
        etaMinutes: 15,
        savedAt: Date.now(),
      };
      best = candidate;
    }
  } catch {
    return best;
  }

  if (best) {
    writeGuestActiveOrder(storeSlug, best);
  }
  return best;
}

export function buildGuestActiveOrderConfirmationPath(
  storeSlug: string,
  order: GuestActiveOrder,
): string {
  const params = new URLSearchParams();
  params.set("orderId", order.orderId);
  params.set("orderNumber", order.orderNumber);
  params.set("mode", order.mode === "pickup" ? "pickup" : "on_site");
  if (order.tableNumber) params.set("table", order.tableNumber);
  params.set("eta", String(order.etaMinutes));
  return `/menu/${encodeURIComponent(storeSlug)}/order-confirmation?${params.toString()}`;
}
