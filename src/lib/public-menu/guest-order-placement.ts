import { writeGuestActiveOrder } from "@/lib/public-menu/guest-active-order-storage";

export type GuestOrderPlacementItem = {
  itemId: string;
  quantity: number;
  notes: string | null;
  customizations: Array<{
    groupId: string;
    optionId: string;
    quantity: number;
  }>;
};

export type GuestOrderPlacementRequest = {
  storeSlug: string;
  orderType: "dine_in" | "pickup";
  paymentTiming: "pay_later";
  tableNumber: string | null;
  seatId?: string | null;
  deviceId?: string | null;
  notes?: string | null;
  scheduledPickupAt?: string | null;
  pointsToRedeem?: number;
  rewardId?: string;
  items: GuestOrderPlacementItem[];
};

export type GuestOrderPlacementState = {
  idempotencyKey: string;
  status: "pending" | "success" | "error";
  orderId?: string;
  orderNumber?: string;
  error?: string;
  request?: GuestOrderPlacementRequest;
};

type StoredGuestOrderPlacement = GuestOrderPlacementState & {
  request?: GuestOrderPlacementRequest;
};

const STORAGE_PREFIX = "guest-order-placement:";
const inFlightPlacementKeys = new Set<string>();

function storageKey(storeSlug: string, idempotencyKey: string): string {
  return `${STORAGE_PREFIX}${storeSlug}:${idempotencyKey}`;
}

export function buildGuestIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readGuestOrderPlacement(
  storeSlug: string,
  idempotencyKey: string,
): StoredGuestOrderPlacement | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(storeSlug, idempotencyKey));
    if (!raw) return null;
    return JSON.parse(raw) as StoredGuestOrderPlacement;
  } catch {
    return null;
  }
}

export function writeGuestOrderPlacement(
  storeSlug: string,
  placement: StoredGuestOrderPlacement,
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(storageKey(storeSlug, placement.idempotencyKey), JSON.stringify(placement));
}

function parseOrderError(payload: unknown): string {
  const record = payload as {
    error?: { message?: string } | string;
    message?: string;
  } | null;
  return (
    (record?.error &&
      typeof record.error === "object" &&
      record.error.message) ||
    (typeof record?.error === "string" ? record.error : null) ||
    record?.message ||
    "Failed to place order"
  );
}

export async function submitGuestOrderPlacement(
  idempotencyKey: string,
  request: GuestOrderPlacementRequest,
): Promise<{ orderId: string; orderNumber: string }> {
  const response = await fetch("/api/public/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(request),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(parseOrderError(payload));
  }

  const data = (payload as { data?: { orderId?: string; orderNumber?: string } }).data;
  if (!data?.orderId) {
    throw new Error("Invalid order response");
  }

  return {
    orderId: data.orderId,
    orderNumber: data.orderNumber ?? data.orderId,
  };
}

export function runGuestOrderPlacementInBackground(
  storeSlug: string,
  idempotencyKey: string,
  request: GuestOrderPlacementRequest,
  onUpdate: (placement: GuestOrderPlacementState) => void,
): void {
  if (inFlightPlacementKeys.has(idempotencyKey)) return;
  inFlightPlacementKeys.add(idempotencyKey);

  const pending: StoredGuestOrderPlacement = {
    idempotencyKey,
    status: "pending",
    request,
  };
  writeGuestOrderPlacement(storeSlug, pending);
  onUpdate(pending);

  void (async () => {
    try {
      const result = await submitGuestOrderPlacement(idempotencyKey, request);
      const success: StoredGuestOrderPlacement = {
        idempotencyKey,
        status: "success",
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        request,
      };
      writeGuestOrderPlacement(storeSlug, success);
      writeGuestActiveOrder(storeSlug, {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        mode: request.orderType === "pickup" ? "pickup" : "on_site",
        tableNumber: request.tableNumber,
        etaMinutes: 15,
        savedAt: Date.now(),
      });
      onUpdate(success);
    } catch (error) {
      const failed: StoredGuestOrderPlacement = {
        idempotencyKey,
        status: "error",
        request,
        error: error instanceof Error ? error.message : "Failed to place order",
      };
      writeGuestOrderPlacement(storeSlug, failed);
      onUpdate(failed);
    } finally {
      inFlightPlacementKeys.delete(idempotencyKey);
    }
  })();
}

export function resumeGuestOrderPlacementIfNeeded(
  storeSlug: string,
  idempotencyKey: string,
  onUpdate: (placement: GuestOrderPlacementState) => void,
): GuestOrderPlacementState | null {
  const stored = readGuestOrderPlacement(storeSlug, idempotencyKey);
  if (!stored) return null;

  if (stored.status !== "pending") {
    onUpdate(stored);
    return stored;
  }

  if (stored.request) {
    runGuestOrderPlacementInBackground(
      storeSlug,
      idempotencyKey,
      stored.request,
      onUpdate,
    );
  }

  return stored;
}
