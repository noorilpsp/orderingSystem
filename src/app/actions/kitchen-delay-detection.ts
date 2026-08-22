 "use server";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";

import {
  orderItems as orderItemsTable,
  orders as ordersTable,
  sessions as sessionsTable,
} from "@/lib/db/schema/orders";
import { recordSessionEventWithSource } from "@/app/actions/session-events";
import {
  computeKitchenDelaysFromOrderItems,
  type KitchenDelayItem,
} from "@/lib/pos/computeKitchenDelays";

export type DetectKitchenDelaysOptions = {
  /** Minutes before warning (default 10) */
  warningMinutes?: number;
  /** Minutes before critical (default 20); items beyond this are still included with their actual minutesLate */
  criticalMinutes?: number;
  /** Whether to record session events for each delayed item (default true) */
  recordEvents?: boolean;
  /** If true (and DEV), log a single per-request warning when any item has minutesLate > 240 (e.g. ?debug_delays=1) */
  warnExtremeDelays?: boolean;
};

const DEFAULT_WARNING_MINUTES = 10;

/**
 * Find order items sent to kitchen but not yet ready, where the delay exceeds the threshold.
 * Records session events (type = kitchen_delay, meta = { orderItemId, minutesLate }) for each.
 * Helper only - does not run automatically.
 */
export async function detectKitchenDelays(
  sessionId: string,
  options?: DetectKitchenDelaysOptions
): Promise<KitchenDelayItem[]> {
  const warningMinutes = options?.warningMinutes ?? DEFAULT_WARNING_MINUTES;
  const recordEvents = options?.recordEvents ?? true;

  const session = await db.query.sessions.findFirst({
    where: eq(sessionsTable.id, sessionId),
    columns: { id: true, locationId: true },
  });
  if (!session) return [];

  const orders = await db.query.orders.findMany({
    where: eq(ordersTable.sessionId, sessionId),
    columns: { id: true, station: true },
  });
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) return [];

  const orderIdToStation = new Map(orders.map((o) => [o.id, o.station ?? null]));

  const items = await db.query.orderItems.findMany({
    where: and(
      inArray(orderItemsTable.orderId, orderIds),
      isNotNull(orderItemsTable.sentToKitchenAt),
      isNull(orderItemsTable.readyAt),
      isNull(orderItemsTable.voidedAt)
    ),
    columns: {
      id: true,
      orderId: true,
      sentToKitchenAt: true,
      stationOverride: true,
    },
  });
  const results = computeKitchenDelaysFromOrderItems(
    items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      sentToKitchenAt: item.sentToKitchenAt,
      readyAt: null,
      voidedAt: null,
      stationOverride: item.stationOverride,
    })),
    orderIdToStation,
    { warningMinutes }
  );

  if (recordEvents) {
    for (const item of results) {
      await recordSessionEventWithSource(
        session.locationId,
        sessionId,
        "kitchen_delay",
        "system",
        { orderItemId: item.orderItemId, minutesLate: item.minutesLate }
      );
    }
  }

  return results;
}
