import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { merchantLocations } from "@/db/schema";
import { orders as ordersTable } from "@/lib/db/schema/orders";
import { isScheduledOrderParked } from "@/lib/public-menu/scheduledOrderRelease";
import {
  listActiveGuestPushOrderIds,
  notifyGuestEtaSlipped,
  notifyGuestScheduledReleased,
  orderHasGuestPushSubscribers,
} from "@/lib/public-menu/sendGuestOrderPush";

const ETA_SLIP_GRACE_MS = 2 * 60_000;

function resolvePrepMinutes(location: {
  averagePrepTimeMinutes: number | null;
  orderModes: unknown;
}): number {
  const orderModes = location.orderModes as
    | { pickup?: { estimated_time_minutes?: number } }
    | null
    | undefined;
  return (
    orderModes?.pickup?.estimated_time_minutes ??
    location.averagePrepTimeMinutes ??
    15
  );
}

/**
 * Fire scheduled-release and ETA-slip guest pushes for subscribed orders.
 * Intended to run on staff board polls (and optionally guest status polls).
 * Safe fire-and-forget; never throws.
 */
export async function processGuestOrderPushReminders(
  locationId: string,
): Promise<void> {
  try {
    const orderIds = await listActiveGuestPushOrderIds(locationId);
    if (orderIds.length === 0) return;

    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        averagePrepTimeMinutes: true,
        orderModes: true,
      },
    });
    if (!location) return;
    const prepMinutes = resolvePrepMinutes(location);
    const now = new Date();

    const orderRows = await db.query.orders.findMany({
      where: inArray(ordersTable.id, orderIds),
      columns: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        scheduledPickupAt: true,
        estimatedReadyAt: true,
      },
    });

    await Promise.all(
      orderRows.map(async (order) => {
        const hasSubs = await orderHasGuestPushSubscribers(order.id);
        if (!hasSubs) return;

        const isPreAccept =
          order.status === "pending" || order.status === "confirmed";
        if (isPreAccept && order.scheduledPickupAt) {
          const stillParked = isScheduledOrderParked({
            scheduledPickupAt: order.scheduledPickupAt,
            prepMinutes,
            now,
          });
          if (!stillParked) {
            await notifyGuestScheduledReleased({
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderType: order.orderType,
            });
          }
        }

        if (
          order.status === "preparing" &&
          order.estimatedReadyAt &&
          order.estimatedReadyAt.getTime() + ETA_SLIP_GRACE_MS < now.getTime()
        ) {
          await notifyGuestEtaSlipped({
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderType: order.orderType,
          });
        }
      }),
    );
  } catch (error) {
    console.error("[processGuestOrderPushReminders]", locationId, error);
  }
}
