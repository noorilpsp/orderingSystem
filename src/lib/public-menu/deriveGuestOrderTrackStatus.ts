export type GuestOrderTrackStatus =
  | "scheduled"
  | "placed"
  | "preparing"
  | "ready"
  | "served"
  | "cancelled"
  | "refunded";

export type GuestOrderItemSnapshot = {
  status: string;
  voidedAt: Date | null;
};

/**
 * Guest-facing tracker aligned with staff /orders counter flow:
 * Scheduled (parked) → Received (placed) → Preparing → Ready → (served/handoff)
 * Terminal money/service paths: cancelled (void) · refunded
 */
export function deriveGuestOrderTrackStatus(input: {
  orderType: string;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  firedAt: Date | null;
  items: GuestOrderItemSnapshot[];
  scheduledParked?: boolean;
}): GuestOrderTrackStatus {
  if (input.paymentStatus === "refunded") {
    return "refunded";
  }

  if (input.scheduledParked) {
    return "scheduled";
  }

  // Prefer order-level status when staff advances the ticket as a whole.
  switch (input.orderStatus) {
    case "completed":
      return "served";
    case "ready":
      return "ready";
    case "preparing":
      return "preparing";
    case "cancelled":
      return "cancelled";
    default:
      break;
  }

  const activeItems = input.items.filter((item) => item.voidedAt == null);
  if (activeItems.length === 0) {
    return "placed";
  }

  // Table tickets not fired yet are still "received".
  if (input.orderType === "dine_in" && input.firedAt == null) {
    return "placed";
  }

  const hasPending = activeItems.some((item) => item.status === "pending");
  const hasPreparing = activeItems.some((item) => item.status === "preparing");
  const hasReady = activeItems.some((item) => item.status === "ready");
  const allServed = activeItems.every((item) => item.status === "served");

  if (allServed) return "served";
  if (hasReady && !hasPending && !hasPreparing) return "ready";
  if (hasPreparing || (hasPending && hasReady)) return "preparing";
  // pending-only (or pre-accept) = received / New on staff board
  return "placed";
}

export function guestTrackStatusIndex(status: GuestOrderTrackStatus): number {
  switch (status) {
    case "scheduled":
      return 0;
    case "placed":
      return 1;
    case "preparing":
      return 2;
    case "ready":
      return 3;
    case "served":
      return 4;
    case "cancelled":
    case "refunded":
      return -1;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function isGuestOrderInProgress(status: GuestOrderTrackStatus): boolean {
  switch (status) {
    case "scheduled":
    case "placed":
    case "preparing":
    case "ready":
      return true;
    case "served":
    case "cancelled":
    case "refunded":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function computeGuestEtaSecondsRemaining(input: {
  trackStatus: GuestOrderTrackStatus;
  firedAt: Date | null;
  createdAt?: Date | null;
  estimatedReadyAt?: Date | null;
  scheduledPickupAt?: Date | null;
  averagePrepMinutes: number | null;
  fallbackMinutes: number;
}): number | null {
  if (
    input.trackStatus === "ready" ||
    input.trackStatus === "served" ||
    input.trackStatus === "cancelled" ||
    input.trackStatus === "refunded"
  ) {
    return 0;
  }

  if (input.trackStatus === "scheduled") {
    if (input.scheduledPickupAt == null) return null;
    return Math.ceil((input.scheduledPickupAt.getTime() - Date.now()) / 1000);
  }

  // Countdown starts only after staff accepts and sets a quote on /orders.
  if (input.trackStatus === "placed") {
    return null;
  }

  if (input.estimatedReadyAt != null) {
    // May be negative after the quote elapses — guest UI uses that for delay copy.
    return Math.ceil((input.estimatedReadyAt.getTime() - Date.now()) / 1000);
  }

  // Accepted but missing estimatedReadyAt (legacy) — start from accept/fire time, not created.
  const prepMinutes = input.averagePrepMinutes ?? input.fallbackMinutes;
  const startedAt = input.firedAt ?? null;
  if (startedAt == null) {
    return prepMinutes * 60;
  }

  const prepMs = prepMinutes * 60_000;
  const remaining = Math.ceil((prepMs - (Date.now() - startedAt.getTime())) / 1000);
  return remaining;
}
