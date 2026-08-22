/**
 * KDS view contract - shape returned by GET /api/kds/view.
 * Minimal and practical for the first slice.
 */

export type KdsOrder = {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  station: string | null;
  wave: number;
  firedAt: string | null;
  sessionId: string | null;
  tableId: string | null;
  tableNumber: string | null;
  customerName: string | null;
  createdAt: string;
  /** When snooze was triggered. */
  snoozedAt: string | null;
  /** When snooze expires. */
  snoozeUntil: string | null;
  /** Effective: snoozeUntil != null && snoozeUntil > now. */
  isSnoozed: boolean;
  /** Set on wake; prevents re-snooze. */
  wasSnoozed: boolean;
};

export type KdsOrderItemStatus = "pending" | "preparing" | "ready" | "served";

export type KdsOrderItem = {
  id: string;
  orderId: string;
  itemName: string;
  quantity: number;
  notes: string | null;
  status: KdsOrderItemStatus;
  sentToKitchenAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  voidedAt: string | null;
  /** When item was refired (remake). */
  refiredAt: string | null;
  stationOverride: string | null;
  seatNumber: number | null;
  /** Kitchen lane from menu item default_substation (grill, fryer, cold_prep). null = unassigned. */
  substation: string | null;
  /** Work group for split tickets. null = main; non-null = split group. */
  prepGroup: string | null;
};

export type KdsSubstation = {
  id: string;
  key: string;
  name: string;
  displayOrder: number;
};

export type KdsStation = {
  id: string;
  name: string;
  displayOrder?: number;
  substations?: KdsSubstation[];
};

export type KdsDelay = {
  orderItemId: string;
  minutesLate: number;
  station: string | null;
};

export type KdsItemActions = {
  canMarkPreparing: boolean;
  canMarkReady: boolean;
  canMarkServed: boolean;
};

export type KdsActions = Record<string, KdsItemActions>;

export type KdsView = {
  location: { id: string; name?: string };
  orders: KdsOrder[];
  orderItems: KdsOrderItem[];
  stations: KdsStation[];
  delays: KdsDelay[];
  actions: KdsActions;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

export function isKdsView(x: unknown): x is KdsView {
  if (!isRecord(x)) return false;
  if (!isRecord(x.location) || !isString(x.location.id)) return false;
  if (!isArray(x.orders) || !isArray(x.orderItems) || !isArray(x.stations) || !isArray(x.delays)) return false;
  if (!isRecord(x.actions)) return false;
  return true;
}
