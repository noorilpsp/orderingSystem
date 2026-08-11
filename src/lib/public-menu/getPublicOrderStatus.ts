import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { merchantLocations } from "@/lib/db/schema";
import {
  orderItemCustomizations as orderItemCustomizationsTable,
  orderItems as orderItemsTable,
  orders as ordersTable,
} from "@/lib/db/schema/orders";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import {
  computeGuestEtaSecondsRemaining,
  deriveGuestOrderTrackStatus,
  type GuestOrderTrackStatus,
} from "@/lib/public-menu/deriveGuestOrderTrackStatus";
import { processGuestOrderPushReminders } from "@/lib/public-menu/guest-order-push-reminders";
import { formatCounterOrderLabel } from "@/lib/orders/formatCounterOrderLabel";
import { isScheduledOrderParked } from "@/lib/public-menu/scheduledOrderRelease";
import { coerceTaxRatePercent } from "@/lib/tax-rate";

export type PublicOrderStatusItem = {
  id: string;
  itemId: string | null;
  itemName: string;
  quantity: number;
  lineTotal: number;
  notes: string | null;
  customizations: Array<{
    groupId: string | null;
    optionId: string | null;
    groupName: string;
    optionName: string;
    optionPrice: number;
    quantity: number;
  }>;
};

export type PublicOrderStatusView = {
  orderId: string;
  orderNumber: string;
  orderType: string;
  trackStatus: GuestOrderTrackStatus;
  firedAt: string | null;
  createdAt: string;
  scheduledPickupAt: string | null;
  /** Whole-order guest instructions (not per-item). */
  notes: string | null;
  itemSummary: {
    total: number;
    pending: number;
    preparing: number;
    ready: number;
    served: number;
  };
  etaSecondsRemaining: number | null;
  items: PublicOrderStatusItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
};

export type GetPublicOrderStatusResult =
  | { ok: true; status: PublicOrderStatusView }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST"; message: string };

export async function getPublicOrderStatus(
  storeSlug: string,
  orderId: string,
  fallbackEtaMinutes = 15,
): Promise<GetPublicOrderStatusResult> {
  const normalizedSlug = storeSlug.trim().toLowerCase();
  const normalizedOrderId = orderId.trim();

  if (!normalizedSlug) {
    return { ok: false, code: "BAD_REQUEST", message: "storeSlug is required" };
  }
  if (!normalizedOrderId) {
    return { ok: false, code: "BAD_REQUEST", message: "orderId is required" };
  }

  const location = await resolvePublicLocationBySlug(normalizedSlug);
  if (!location?.storeSlug) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }

  const order = await db.query.orders.findFirst({
    where: and(eq(ordersTable.id, normalizedOrderId), eq(ordersTable.locationId, location.id)),
    columns: {
      id: true,
      orderNumber: true,
      orderType: true,
      status: true,
      firedAt: true,
      createdAt: true,
      updatedAt: true,
      estimatedReadyAt: true,
      scheduledPickupAt: true,
      notes: true,
      paymentStatus: true,
      subtotal: true,
      taxAmount: true,
      discountAmount: true,
      total: true,
    },
  });

  if (!order) {
    return { ok: false, code: "NOT_FOUND", message: "Order not found" };
  }

  const itemRows = await db.query.orderItems.findMany({
    where: and(eq(orderItemsTable.orderId, order.id), isNull(orderItemsTable.voidedAt)),
    columns: {
      id: true,
      itemId: true,
      itemName: true,
      quantity: true,
      lineTotal: true,
      notes: true,
      status: true,
      voidedAt: true,
    },
  });

  const itemIds = itemRows.map((item) => item.id);
  const customizationRows =
    itemIds.length > 0
      ? await db.query.orderItemCustomizations.findMany({
          where: inArray(orderItemCustomizationsTable.orderItemId, itemIds),
          columns: {
            orderItemId: true,
            groupId: true,
            optionId: true,
            groupName: true,
            optionName: true,
            optionPrice: true,
            quantity: true,
          },
        })
      : [];

  const customizationsByItemId = new Map<string, PublicOrderStatusItem["customizations"]>();
  for (const row of customizationRows) {
    const list = customizationsByItemId.get(row.orderItemId) ?? [];
    list.push({
      groupId: row.groupId,
      optionId: row.optionId,
      groupName: row.groupName,
      optionName: row.optionName,
      optionPrice: Number(row.optionPrice) || 0,
      quantity: row.quantity ?? 1,
    });
    customizationsByItemId.set(row.orderItemId, list);
  }

  const items: PublicOrderStatusItem[] = itemRows.map((item) => ({
    id: item.id,
    itemId: item.itemId,
    itemName: item.itemName,
    quantity: item.quantity ?? 1,
    lineTotal: Number(item.lineTotal) || 0,
    notes: item.notes ?? null,
    customizations: customizationsByItemId.get(item.id) ?? [],
  }));

  const locationDetails = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, location.id),
    columns: {
      averagePrepTimeMinutes: true,
      orderModes: true,
      taxRate: true,
    },
  });

  const orderModes = locationDetails?.orderModes as
    | { pickup?: { estimated_time_minutes?: number } }
    | null
    | undefined;
  const prepMinutes =
    orderModes?.pickup?.estimated_time_minutes ??
    locationDetails?.averagePrepTimeMinutes ??
    fallbackEtaMinutes;
  const taxRatePercent = coerceTaxRatePercent(locationDetails?.taxRate);

  const scheduledParked =
    (order.status === "pending" || order.status === "confirmed") &&
    isScheduledOrderParked({
      scheduledPickupAt: order.scheduledPickupAt,
      prepMinutes,
    });

  const trackStatus = deriveGuestOrderTrackStatus({
    orderType: order.orderType,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    firedAt: order.firedAt,
    items: itemRows,
    scheduledParked,
  });

  const itemSummary = {
    total: itemRows.length,
    pending: itemRows.filter((item) => item.status === "pending").length,
    preparing: itemRows.filter((item) => item.status === "preparing").length,
    ready: itemRows.filter((item) => item.status === "ready").length,
    served: itemRows.filter((item) => item.status === "served").length,
  };

  // Prefer the staff quote from /orders accept. Otherwise clock from fire/accept time.
  const acceptClock =
    order.firedAt ??
    (trackStatus === "preparing" || trackStatus === "ready" ? order.updatedAt : null);

  const etaSecondsRemaining = computeGuestEtaSecondsRemaining({
    trackStatus,
    firedAt: acceptClock,
    createdAt: order.createdAt,
    estimatedReadyAt: order.estimatedReadyAt,
    scheduledPickupAt: order.scheduledPickupAt,
    averagePrepMinutes: locationDetails?.averagePrepTimeMinutes ?? null,
    fallbackMinutes: fallbackEtaMinutes,
  });

  // ETA-slip / scheduled-release while this guest (or others) still poll status.
  void processGuestOrderPushReminders(location.id);

  const subtotal = Number(order.subtotal) || 0;
  const discountAmount = Number(order.discountAmount) || 0;
  let taxAmount = Number(order.taxAmount) || 0;
  let total = Number(order.total) || 0;

  // Older rows often stored tax=0 / total=subtotal. Backfill from the store tax rate
  // for display so refresh matches checkout.
  if (subtotal > 0 && taxAmount <= 0 && taxRatePercent > 0) {
    const exclusive = Math.max(0, subtotal - discountAmount);
    const looksTaxExclusive =
      Math.abs(total - exclusive) <= 0.02 || Math.abs(total - subtotal) <= 0.02;
    if (looksTaxExclusive) {
      taxAmount = Math.round(subtotal * (taxRatePercent / 100) * 100) / 100;
      total = Math.max(
        0,
        Math.round((subtotal + taxAmount - discountAmount) * 100) / 100,
      );
    }
  }

  return {
    ok: true,
    status: {
      orderId: order.id,
      orderNumber: formatCounterOrderLabel({
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        orderId: order.id,
      }),
      orderType: order.orderType,
      trackStatus,
      firedAt: order.firedAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      scheduledPickupAt: order.scheduledPickupAt?.toISOString() ?? null,
      notes: order.notes?.trim() || null,
      itemSummary,
      etaSecondsRemaining,
      items,
      subtotal,
      taxAmount,
      discountAmount,
      total,
    },
  };
}
