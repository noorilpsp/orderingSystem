/**
 * Past orders for the signed-in diner at one store.
 * Anonymous guests get an empty list — their only order is the device-local active one.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems as orderItemsTable,
  orders as ordersTable,
} from "@/lib/db/schema/orders";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import { deriveGuestOrderTrackStatus } from "@/lib/public-menu/deriveGuestOrderTrackStatus";
import { formatCounterOrderLabel } from "@/lib/orders/formatCounterOrderLabel";
import { getLoggedInCustomer } from "@/lib/public-menu/getLoggedInCustomer";
import type { GuestOrderTrackStatus } from "@/lib/public-menu/deriveGuestOrderTrackStatus";

const HISTORY_LIMIT = 20;

export type GuestOrderHistoryItem = {
  itemId: string | null;
  itemName: string;
  quantity: number;
  lineTotal: number;
  notes: string | null;
};

export type GuestOrderHistoryEntry = {
  orderId: string;
  orderNumber: string;
  orderType: string;
  trackStatus: GuestOrderTrackStatus;
  createdAt: string;
  total: number;
  discountAmount: number;
  items: GuestOrderHistoryItem[];
};

export type GetGuestOrderHistoryResult =
  | { ok: true; signedIn: boolean; orders: GuestOrderHistoryEntry[] }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST"; message: string };

export async function getGuestOrderHistory(
  storeSlug: string,
): Promise<GetGuestOrderHistoryResult> {
  const normalizedSlug = storeSlug.trim().toLowerCase();
  if (!normalizedSlug) {
    return { ok: false, code: "BAD_REQUEST", message: "storeSlug is required" };
  }

  const location = await resolvePublicLocationBySlug(normalizedSlug);
  if (!location?.storeSlug) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }

  const customer = await getLoggedInCustomer(normalizedSlug);
  if (!customer?.customerId) {
    return { ok: true, signedIn: !!customer, orders: [] };
  }

  const orderRows = await db.query.orders.findMany({
    where: and(
      eq(ordersTable.locationId, location.id),
      eq(ordersTable.customerId, customer.customerId),
    ),
    orderBy: [desc(ordersTable.createdAt)],
    limit: HISTORY_LIMIT,
    columns: {
      id: true,
      orderNumber: true,
      orderType: true,
      status: true,
      paymentStatus: true,
      firedAt: true,
      createdAt: true,
      total: true,
      discountAmount: true,
    },
  });

  const orders: GuestOrderHistoryEntry[] = [];
  for (const order of orderRows) {
    const itemRows = await db.query.orderItems.findMany({
      where: and(
        eq(orderItemsTable.orderId, order.id),
        isNull(orderItemsTable.voidedAt),
      ),
      columns: {
        itemId: true,
        itemName: true,
        quantity: true,
        lineTotal: true,
        notes: true,
        status: true,
        voidedAt: true,
      },
    });

    orders.push({
      orderId: order.id,
      orderNumber: formatCounterOrderLabel({
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        orderId: order.id,
      }),
      orderType: order.orderType,
      trackStatus: deriveGuestOrderTrackStatus({
        orderType: order.orderType,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        firedAt: order.firedAt,
        items: itemRows,
        scheduledParked: false,
      }),
      createdAt: order.createdAt.toISOString(),
      total: Number(order.total),
      discountAmount: Number(order.discountAmount),
      items: itemRows.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        notes: item.notes,
      })),
    });
  }

  return { ok: true, signedIn: true, orders };
}
