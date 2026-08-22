/**
 * Orders view contract - shape returned by getOrdersView and GET /api/orders/view.
 * Unified read model for the Orders ops page (table + pickup + delivery).
 */

import type { CatalogI18n } from "@/lib/catalog-i18n";

export type OrdersOrderSource = "table" | "pickup" | "delivery" | "dine_in_no_table";

export type OrdersUnifiedStatus =
  | "sent"
  | "preparing"
  | "ready"
  | "served"
  | "voided"
  | "refunded";

export type OrdersWaveStatus = "served" | "ready" | "cooking" | "fired" | "held" | "not_started";

export type OrdersPaymentState = "paid" | "unpaid";

export type OrdersPaymentMethod = "card" | "cash" | "other" | null;

export interface OrdersUnifiedOrder {
  id: string;
  source: OrdersOrderSource;
  /** Table number (T12), order code (PU-240), or DI-410 */
  label: string;
  sectionLabel: string;
  guestLabel: string;
  status: OrdersUnifiedStatus;
  createdAt: number;
  updatedAt: number;
  /**
   * Epoch ms when each counter-flow stage was entered (from order_timeline).
   * Used for accurate meal-progress durations on pickup / dine-in.
   */
  stageEnteredAt?: Partial<Record<"sent" | "preparing" | "ready" | "served", number>>;
  /** Pre-tax food/service subtotal when available. */
  subtotal?: number;
  /** Tax amount when available. */
  taxAmount?: number;
  total: number;
  itemCount: number;
  items: Array<{
    id: string;
    /** English snapshot name from the order line. */
    name: string;
    /** Catalog item id when the snapshot still points at a live menu item. */
    itemId?: string | null;
    /** Catalog locale overrides (Arabic). Names are resolved at render. */
    i18n?: CatalogI18n | null;
    qty: number;
    status: string;
    price: number;
    notes?: string | null;
    /** Seat number for delivery-to-table (split bill). */
    seatNumber?: number | null;
    /** Optional guest name on that seat. */
    seatGuestName?: string | null;
    customizations?: Array<{
      groupName: string;
      optionName: string;
      groupId?: string | null;
      optionId?: string | null;
      groupI18n?: CatalogI18n | null;
      optionI18n?: CatalogI18n | null;
      optionPrice: number;
      quantity: number;
    }>;
  }>;
  waves: Array<{ number: number; status: OrdersWaveStatus }>;
  /** For table: table UUID (for /table/[id] nav). */
  tableId?: string;
  /** For table: session UUID (for fire wave mutation). */
  sessionId?: string;
  /** For pickup/delivery: order id for mutations */
  orderId?: string;
  /** Session wave number for delivery-to-table tickets (kitchen fire). */
  waveNumber?: number;
  /** When this row is a rolled-up table check, underlying order ids. */
  memberOrderIds?: string[];
  note?: string;
  /** Epoch ms guest requested pickup time, if scheduled. */
  scheduledPickupAt?: number | null;
  /** True while still parked before release to kitchen. */
  scheduledParked?: boolean;
  paymentState?: OrdersPaymentState;
  paymentMethod?: OrdersPaymentMethod;
  /**
   * Quoted prep target in minutes (from staff accept ETA / estimatedReadyAt).
   * Falls back to location default when not yet set.
   */
  targetEtaMinutes?: number;
  /**
   * True when a table session has an unfired guest wave waiting for staff accept
   * (incoming overlay + alert on /orders).
   */
  needsAccept?: boolean;
}

export type OrdersServiceRequestType = "waiter" | "bill";

/** Open guest service request for the /orders ops board. */
export interface OrdersServiceRequest {
  id: string;
  tableId: string;
  tableNumber: string;
  requestType: OrdersServiceRequestType;
}

export interface OrdersView {
  locationId: string;
  locationName: string;
  orders: OrdersUnifiedOrder[];
  /** Default prep minutes from store pickup settings (accept overlay / missing targets). */
  defaultPrepMinutes?: number;
  /** Enabled fulfillment channels for filter chips (from store settings). */
  channels?: {
    deliveryToTable: boolean;
    pickup: boolean;
    delivery: boolean;
    selfPickup: boolean;
    dineInMode: "staff_seated" | "self_service" | null;
  };
  /** Guest call-waiter / request-check alerts for floor tables. */
  serviceRequests?: OrdersServiceRequest[];
}

export function isOrdersView(x: unknown): x is OrdersView {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.locationId === "string" &&
    typeof o.locationName === "string" &&
    Array.isArray(o.orders)
  );
}
