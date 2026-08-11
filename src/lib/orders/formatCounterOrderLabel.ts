/**
 * Staff /orders counter ticket label (PU-xxx / DI-xxx).
 * Matches the display format used on the ops board.
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
  if (upper.startsWith("PU-") || upper.startsWith("DI-")) {
    return raw;
  }
  if (upper.startsWith("PU") || upper.startsWith("DI")) {
    // Already prefixed without a dash (rare)
    return raw;
  }

  return `${prefix}-${raw.slice(-3)}`;
}
