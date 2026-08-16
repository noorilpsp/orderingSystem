/**
 * Past orders for the signed-in diner at one store.
 * Anonymous guests get an empty list — their only order is the device-local active one.
 */
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItemCustomizations as orderItemCustomizationsTable,
  orderItems as orderItemsTable,
  orders as ordersTable,
} from "@/lib/db/schema/orders";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import { deriveGuestOrderTrackStatus } from "@/lib/public-menu/deriveGuestOrderTrackStatus";
import { formatCounterOrderLabel } from "@/lib/orders/formatCounterOrderLabel";
import { getLoggedInCustomer } from "@/lib/public-menu/getLoggedInCustomer";
import { groupIdenticalGuestLines } from "@/lib/public-menu/groupGuestConfirmationItems";
import type { GuestOrderTrackStatus } from "@/lib/public-menu/deriveGuestOrderTrackStatus";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type GuestOrderHistoryQuery = {
  limit?: number;
  offset?: number;
};

function clampLimit(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

function clampOffset(value: number | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export type GuestOrderHistoryItem = {
  itemId: string | null;
  itemName: string;
  quantity: number;
  lineTotal: number;
  notes: string | null;
  customizations?: Array<{
    groupId: string | null;
    optionId: string | null;
    groupName: string;
    optionName: string;
    optionPrice: number;
    quantity: number;
  }>;
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
  | {
      ok: true;
      signedIn: boolean;
      orders: GuestOrderHistoryEntry[];
      total: number;
    }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST"; message: string };

export async function getGuestOrderHistory(
  storeSlug: string,
  query: GuestOrderHistoryQuery = {},
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
    return { ok: true, signedIn: !!customer, orders: [], total: 0 };
  }

  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const where = and(
    eq(ordersTable.locationId, location.id),
    eq(ordersTable.customerId, customer.customerId),
  );

  const [countRow] = await db
    .select({ total: count() })
    .from(ordersTable)
    .where(where);

  const orderRows = await db.query.orders.findMany({
    where,
    orderBy: [desc(ordersTable.createdAt)],
    limit,
    offset,
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

    const itemIds = itemRows.map((item) => item.id).filter(Boolean);
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
    const customizationsByItemId = new Map<
      string,
      GuestOrderHistoryItem["customizations"]
    >();
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

    const groupedItems = groupIdenticalGuestLines(
      itemRows.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        notes: item.notes,
        customizations: customizationsByItemId.get(item.id) ?? [],
      })),
    );

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
      items: groupedItems.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        notes: item.notes,
        customizations: item.customizations ?? [],
      })),
    });
  }

  return { ok: true, signedIn: true, orders, total: Number(countRow?.total ?? 0) };
}
