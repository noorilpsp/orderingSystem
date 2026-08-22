/**
 * Domain service flow - centralized allowed transitions for sessions, orders, and order_items.
 * Pure validation functions: no DB, no side effects. Return structured results for better UI.
 * All actions must call these validators before mutating state.
 */

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type OrderWaveInput = {
  firedAt: Date | null;
};

export type SessionInput = {
  status: string;
};

export type OrderItemInput = {
  status: string;
  voidedAt?: Date | null;
  refiredAt?: Date | null;
};

export type OrderItemModifyInput = {
  sentToKitchenAt: Date | null;
};

/** Item cannot be modified (seat, quantity, notes, etc.) once sent to kitchen. voidItem and refireItem are excepted. */
export function canModifyOrderItem(item: OrderItemModifyInput): ValidationResult {
  if (item.sentToKitchenAt != null) return { ok: false, reason: "item_sent_to_kitchen" };
  return { ok: true };
}

export type SessionCloseContext = {
  sessionStatus: string;
  hasUnfinishedItems: boolean;
  hasKitchenMidFire: boolean;
  hasPaymentInProgress: boolean;
  hasUnpaidBalance: boolean;
};

/** Wave can be fired only if it has not been fired yet. Prevents double-firing. */
export function canFireWave(order: OrderWaveInput): ValidationResult {
  if (order.firedAt != null) return { ok: false, reason: "wave_already_fired" };
  return { ok: true };
}

/** Items can be added only when session is open. */
export function canAddItems(session: SessionInput): ValidationResult {
  if (session.status !== "open") return { ok: false, reason: "session_not_open" };
  return { ok: true };
}

/** Item can be served only when ready. No skipping states. */
export function canServeItem(item: OrderItemInput): ValidationResult {
  if (item.status !== "ready") return { ok: false, reason: "item_not_ready" };
  return { ok: true };
}

/** Item can be un-served (recall) only when served. Puts it back to ready. */
export function canUnserveItem(item: OrderItemInput): ValidationResult {
  if (item.status !== "served") return { ok: false, reason: "item_not_served" };
  return { ok: true };
}

/** Item can be marked preparing only from pending. */
export function canMarkItemPreparing(item: OrderItemInput): ValidationResult {
  if (item.status !== "pending") return { ok: false, reason: "item_not_pending" };
  return { ok: true };
}

/** Item can be marked ready only from preparing. */
export function canMarkItemReady(item: OrderItemInput): ValidationResult {
  if (item.status !== "preparing") return { ok: false, reason: "item_not_preparing" };
  return { ok: true };
}

/** Session can be closed when open and all safety conditions met. */
export function canCloseSession(ctx: SessionCloseContext): ValidationResult {
  if (ctx.sessionStatus !== "open") return { ok: false, reason: "session_not_open" };
  if (ctx.hasUnfinishedItems) return { ok: false, reason: "unfinished_items" };
  if (ctx.hasKitchenMidFire) return { ok: false, reason: "kitchen_mid_fire" };
  if (ctx.hasPaymentInProgress) return { ok: false, reason: "payment_in_progress" };
  if (ctx.hasUnpaidBalance) return { ok: false, reason: "unpaid_balance" };
  return { ok: true };
}

/** Item can be voided only if not already voided. */
export function canVoidItem(item: OrderItemInput): ValidationResult {
  if ((item.voidedAt ?? null) != null) return { ok: false, reason: "item_already_voided" };
  return { ok: true };
}

/** Item can be refired only if not already refired. */
export function canRefireItem(item: OrderItemInput): ValidationResult {
  if ((item.refiredAt ?? null) != null) return { ok: false, reason: "item_already_refired" };
  return { ok: true };
}
