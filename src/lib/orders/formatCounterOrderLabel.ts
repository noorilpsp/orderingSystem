/**
 * Staff /orders counter ticket label (PU-xxx / DI-xxx).
 * Matches the display format used on the ops board.
 * Already-prefixed ticket ids (PU-/DI-/T-) are returned unchanged.
 */
export function formatCounterOrderLabel(input: {
  orderNumber: string | null | undefined;
  orderType: string | null | undefined;
  orderId?: string | null;
}): string {
  const type = (input.orderType ?? "").trim().toLowerCase();
  const isPickup =
    type === "pickup" || type === "delivery" || type === "takeaway";
  const prefix = isPickup ? "PU" : "DI";
  const raw = (input.orderNumber ?? "").trim();
  if (!raw) {
    return `${prefix}-${input.orderId?.slice(0, 6) ?? "???"}`;
  }

  const upper = raw.toUpperCase();
  // Keep explicit ticket formats as stored (including table tickets like T1-4821).
  if (
    upper.startsWith("PU-") ||
    upper.startsWith("DI-") ||
    /^T[\w-]+$/i.test(raw)
  ) {
    return raw;
  }
  if (upper.startsWith("PU") || upper.startsWith("DI")) {
    // Already prefixed without a dash (rare)
    return raw;
  }

  // Prefer a readable numeric tail when present; otherwise last 4 chars.
  const digits = raw.replace(/\D/g, "");
  const tail = digits.length >= 3 ? digits.slice(-4) : raw.slice(-4);
  return `${prefix}-${tail}`;
}
