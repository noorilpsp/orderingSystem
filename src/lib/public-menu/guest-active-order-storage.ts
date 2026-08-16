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
const MAX_ACTIVE = 12;

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

function coerceActiveOrder(value: unknown): GuestActiveOrder | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<GuestActiveOrder>;
  if (!parsed.orderId || typeof parsed.orderId !== "string") return null;
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
}

function readStoredActiveOrders(storeSlug: string): GuestActiveOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(storeSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list
      .map(coerceActiveOrder)
      .filter((order): order is GuestActiveOrder => order != null);
  } catch {
    return [];
  }
}

function writeStoredActiveOrders(storeSlug: string, orders: GuestActiveOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    if (orders.length === 0) {
      window.localStorage.removeItem(storageKey(storeSlug));
      return;
    }
    window.localStorage.setItem(
      storageKey(storeSlug),
      JSON.stringify(orders.slice(0, MAX_ACTIVE)),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function readGuestActiveOrders(storeSlug: string): GuestActiveOrder[] {
  const dismissed = new Set(readDismissedOrderIds(storeSlug));
  const stored = readStoredActiveOrders(storeSlug);
  const kept = stored.filter((order) => !dismissed.has(order.orderId));
  if (kept.length !== stored.length) {
    writeStoredActiveOrders(storeSlug, kept);
  }
  return [...kept].sort((a, b) => b.savedAt - a.savedAt);
}

export function readGuestActiveOrder(storeSlug: string): GuestActiveOrder | null {
  return readGuestActiveOrders(storeSlug)[0] ?? null;
}

export function writeGuestActiveOrder(storeSlug: string, order: GuestActiveOrder): void {
  if (typeof window === "undefined") return;
  const dismissed = new Set(readDismissedOrderIds(storeSlug));
  if (dismissed.has(order.orderId)) return;
  const next: GuestActiveOrder = {
    ...order,
    savedAt: Date.now(),
  };
  const others = readStoredActiveOrders(storeSlug).filter(
    (entry) => entry.orderId !== order.orderId && !dismissed.has(entry.orderId),
  );
  writeStoredActiveOrders(storeSlug, [next, ...others]);
}

export function clearGuestActiveOrder(storeSlug: string, orderId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const knownOrderId = orderId ?? readGuestActiveOrder(storeSlug)?.orderId;
    if (!knownOrderId) {
      writeStoredActiveOrders(storeSlug, []);
      return;
    }
    markGuestActiveOrderDismissed(storeSlug, knownOrderId);
    clearSessionPlacementsForOrder(storeSlug, knownOrderId);
    writeStoredActiveOrders(
      storeSlug,
      readStoredActiveOrders(storeSlug).filter((entry) => entry.orderId !== knownOrderId),
    );
  } catch {
    // ignore
  }
}

/** Recover in-progress orders from session placement keys (same browser tab session). */
export function recoverGuestActiveOrdersFromSession(storeSlug: string): GuestActiveOrder[] {
  if (typeof window === "undefined") return readGuestActiveOrders(storeSlug);
  const normalized = storeSlug.trim().toLowerCase();
  const dismissed = new Set(readDismissedOrderIds(storeSlug));
  const recovered: GuestActiveOrder[] = [];

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
      recovered.push({
        orderId: parsed.orderId,
        orderNumber: parsed.orderNumber || parsed.orderId,
        mode: parsed.request?.orderType === "pickup" ? "pickup" : "on_site",
        tableNumber: parsed.request?.tableNumber?.trim() || null,
        etaMinutes: 15,
        savedAt: Date.now(),
      });
    }
  } catch {
    // fall through to stored list
  }

  const stored = readStoredActiveOrders(storeSlug);
  const byId = new Map(stored.map((order) => [order.orderId, order]));
  for (const order of recovered) {
    if (!byId.has(order.orderId)) byId.set(order.orderId, order);
  }
  writeStoredActiveOrders(
    storeSlug,
    [...byId.values()].filter((order) => !dismissed.has(order.orderId)),
  );
  return readGuestActiveOrders(storeSlug);
}

/** Recover an in-progress order from session placement keys (same browser tab session). */
export function recoverGuestActiveOrderFromSession(storeSlug: string): GuestActiveOrder | null {
  return recoverGuestActiveOrdersFromSession(storeSlug)[0] ?? null;
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
