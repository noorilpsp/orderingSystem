import { writeGuestActiveOrder } from "@/lib/public-menu/guest-active-order-storage";
import { toUserFacingErrorMessage } from "@/lib/db/withDbRetry";

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
  phone?: string | null;
  guestName?: string | null;
  items: GuestOrderPlacementItem[];
};

export type GuestOrderPlacementState = {
  idempotencyKey: string;
  status: "pending" | "success" | "error";
  orderId?: string;
  orderNumber?: string;
  claimToken?: string;
  error?: string;
  request?: GuestOrderPlacementRequest;
};

type StoredGuestOrderPlacement = GuestOrderPlacementState & {
  request?: GuestOrderPlacementRequest;
};

const STORAGE_PREFIX = "guest-order-placement:";
const CLAIM_STORAGE_PREFIX = "guest-order-claim:";
const inFlightPlacementKeys = new Set<string>();

function claimStorageKey(storeSlug: string, orderId: string): string {
  return `${CLAIM_STORAGE_PREFIX}${storeSlug}:${orderId}`;
}

export function writeGuestOrderClaimToken(
  storeSlug: string,
  orderId: string,
  token: string,
): void {
  if (typeof localStorage === "undefined") return;
  const trimmed = token.trim();
  if (!trimmed || !orderId) return;
  try {
    localStorage.setItem(claimStorageKey(storeSlug, orderId), trimmed);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readGuestOrderClaimToken(
  storeSlug: string,
  orderId: string,
): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const token = localStorage.getItem(claimStorageKey(storeSlug, orderId))?.trim();
    return token || null;
  } catch {
    return null;
  }
}

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
  const raw =
    (record?.error &&
      typeof record.error === "object" &&
      record.error.message) ||
    (typeof record?.error === "string" ? record.error : null) ||
    record?.message ||
    "Failed to place order";
  return toUserFacingErrorMessage(raw, "Could not place order. Please try again.");
}

export async function submitGuestOrderPlacement(
  idempotencyKey: string,
  request: GuestOrderPlacementRequest,
): Promise<{ orderId: string; orderNumber: string; claimToken?: string }> {
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

  const data = (payload as {
    data?: { orderId?: string; orderNumber?: string; claimToken?: string };
  }).data;
  if (!data?.orderId) {
    throw new Error("Invalid order response");
  }

  const claimToken = data.claimToken?.trim() || undefined;
  if (claimToken) {
    writeGuestOrderClaimToken(request.storeSlug, data.orderId, claimToken);
  }

  return {
    orderId: data.orderId,
    orderNumber: data.orderNumber ?? data.orderId,
    claimToken,
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
        claimToken: result.claimToken,
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
