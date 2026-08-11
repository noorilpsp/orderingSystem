import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import {
  guestOrderPushEvents,
  guestPushSubscriptions,
  type GuestOrderPushEventType,
} from "@/db/schema";
import { orders as ordersTable } from "@/lib/db/schema/orders";
import { configureWebPush } from "@/lib/orders/web-push";
import { formatCounterOrderLabel } from "@/lib/orders/formatCounterOrderLabel";

export type GuestOrderPushCopy = {
  title: string;
  body: string;
};

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current !== "object") break;
    const record = current as {
      code?: string;
      message?: string;
      cause?: unknown;
    };
    const code = record.code;
    const message = String(record.message ?? "").toLowerCase();
    if (
      code === "23505" ||
      message.includes("unique") ||
      message.includes("duplicate key")
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

/**
 * Claim an idempotent guest push event. Returns false if already sent.
 */
export async function claimGuestOrderPushEvent(
  orderId: string,
  eventType: GuestOrderPushEventType,
): Promise<boolean> {
  try {
    await db.insert(guestOrderPushEvents).values({
      orderId,
      eventType,
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function orderHasGuestPushSubscribers(orderId: string): Promise<boolean> {
  const row = await db.query.guestPushSubscriptions.findFirst({
    where: eq(guestPushSubscriptions.orderId, orderId),
    columns: { id: true },
  });
  return Boolean(row);
}

/**
 * Send a lifecycle push to all subscriptions for an order.
 * Safe to call fire-and-forget; never throws to callers.
 */
export async function sendGuestOrderPush(input: {
  orderId: string;
  eventType: GuestOrderPushEventType;
  copy: GuestOrderPushCopy;
}): Promise<void> {
  try {
    if (!configureWebPush()) {
      console.warn("[sendGuestOrderPush] VAPID keys missing - skip");
      return;
    }

    const rows = await db
      .select({
        id: guestPushSubscriptions.id,
        endpoint: guestPushSubscriptions.endpoint,
        p256dh: guestPushSubscriptions.p256dh,
        auth: guestPushSubscriptions.auth,
        confirmationUrl: guestPushSubscriptions.confirmationUrl,
      })
      .from(guestPushSubscriptions)
      .where(eq(guestPushSubscriptions.orderId, input.orderId));

    // Don't claim the event until someone is subscribed — otherwise Enable alerts
    // after Accept/Ready permanently misses those notifications.
    if (rows.length === 0) return;

    const claimed = await claimGuestOrderPushEvent(input.orderId, input.eventType);
    if (!claimed) return;

    const order = await db.query.orders.findFirst({
      where: eq(ordersTable.id, input.orderId),
      columns: { orderNumber: true, orderType: true },
    });
    const displayNumber = formatCounterOrderLabel({
      orderNumber: order?.orderNumber,
      orderType: order?.orderType,
      orderId: input.orderId,
    });

    let sent = 0;
    await Promise.all(
      rows.map(async (row) => {
        const payload = JSON.stringify({
          title: input.copy.title,
          body: input.copy.body,
          url: row.confirmationUrl,
          orderId: input.orderId,
          orderNumber: displayNumber,
          eventType: input.eventType,
        });
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            payload,
            { TTL: 60 * 60, urgency: "high" },
          );
          sent += 1;
        } catch (error) {
          const statusCode =
            error && typeof error === "object" && "statusCode" in error
              ? Number((error as { statusCode?: number }).statusCode)
              : null;
          if (statusCode === 404 || statusCode === 410) {
            await db
              .delete(guestPushSubscriptions)
              .where(eq(guestPushSubscriptions.id, row.id));
            return;
          }
          console.error("[sendGuestOrderPush] send failed", row.id, error);
        }
      }),
    );
    console.info(
      "[sendGuestOrderPush]",
      input.eventType,
      input.orderId,
      "delivered",
      sent,
      "/",
      rows.length,
    );
  } catch (error) {
    console.error("[sendGuestOrderPush]", input.eventType, input.orderId, error);
  }
}

/**
 * After a guest enables alerts mid-order, send any status pushes they already missed.
 */
export async function backfillGuestOrderPushes(orderId: string): Promise<void> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(ordersTable.id, orderId),
      columns: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        estimatedReadyAt: true,
      },
    });
    if (!order) return;

    const etaMinutes =
      order.estimatedReadyAt instanceof Date
        ? Math.max(1, Math.round((order.estimatedReadyAt.getTime() - Date.now()) / 60_000))
        : null;

    if (
      order.status === "preparing" ||
      order.status === "ready" ||
      order.status === "completed"
    ) {
      await notifyGuestOrderAccepted({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        etaMinutes,
      });
    }
    if (order.status === "ready" || order.status === "completed") {
      await notifyGuestOrderReady({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
      });
    }
    if (order.status === "completed") {
      await notifyGuestOrderCompleted({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
      });
    }
  } catch (error) {
    console.error("[backfillGuestOrderPushes]", orderId, error);
  }
}

export async function notifyGuestOrderAccepted(input: {
  orderId: string;
  orderNumber: string;
  etaMinutes: number | null;
  orderType: string;
}): Promise<void> {
  const eta =
    typeof input.etaMinutes === "number" && Number.isFinite(input.etaMinutes)
      ? Math.max(1, Math.round(input.etaMinutes))
      : null;
  const label = formatCounterOrderLabel({
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    orderId: input.orderId,
  });
  const typeHint =
    input.orderType === "pickup"
      ? "Pickup"
      : input.orderType === "dine_in"
        ? "Table"
        : "Order";
  await sendGuestOrderPush({
    orderId: input.orderId,
    eventType: "accepted",
    copy: {
      title: `${typeHint} ${label} is being made`,
      body: eta
        ? `Accepted · about ${eta} min`
        : "The kitchen accepted your order",
    },
  });
}

export async function notifyGuestOrderReady(input: {
  orderId: string;
  orderNumber: string;
  orderType: string;
}): Promise<void> {
  const isPickup = input.orderType === "pickup";
  const label = formatCounterOrderLabel({
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    orderId: input.orderId,
  });
  await sendGuestOrderPush({
    orderId: input.orderId,
    eventType: "ready",
    copy: {
      title: `Order ${label} is ready`,
      body: isPickup ? "Come collect your order" : "Ready at your table",
    },
  });
}

export async function notifyGuestOrderCompleted(input: {
  orderId: string;
  orderNumber: string;
  orderType?: string;
  pointsAwarded?: number | null;
}): Promise<void> {
  const points =
    typeof input.pointsAwarded === "number" && input.pointsAwarded > 0
      ? Math.round(input.pointsAwarded)
      : null;
  const label = formatCounterOrderLabel({
    orderNumber: input.orderNumber,
    orderType: input.orderType ?? "dine_in",
    orderId: input.orderId,
  });
  await sendGuestOrderPush({
    orderId: input.orderId,
    eventType: "completed",
    copy: {
      title: `Order ${label} complete`,
      body: points
        ? `Enjoy - you earned ${points} pts`
        : "Enjoy - thanks for ordering",
    },
  });
}

export async function notifyGuestScheduledReleased(input: {
  orderId: string;
  orderNumber: string;
  orderType?: string;
}): Promise<void> {
  const label = formatCounterOrderLabel({
    orderNumber: input.orderNumber,
    orderType: input.orderType ?? "pickup",
    orderId: input.orderId,
  });
  await sendGuestOrderPush({
    orderId: input.orderId,
    eventType: "scheduled_released",
    copy: {
      title: `Order ${label} started`,
      body: "Kitchen started your scheduled order",
    },
  });
}

export async function notifyGuestEtaSlipped(input: {
  orderId: string;
  orderNumber: string;
  orderType?: string;
}): Promise<void> {
  const label = formatCounterOrderLabel({
    orderNumber: input.orderNumber,
    orderType: input.orderType ?? "dine_in",
    orderId: input.orderId,
  });
  await sendGuestOrderPush({
    orderId: input.orderId,
    eventType: "eta_slipped",
    copy: {
      title: `Order ${label} update`,
      body: "Running a bit longer than quoted - hang tight",
    },
  });
}

/** Orders that still might need reminder pushes for a location. */
export async function listActiveGuestPushOrderIds(locationId: string): Promise<string[]> {
  const rows = await db
    .select({ orderId: guestPushSubscriptions.orderId })
    .from(guestPushSubscriptions)
    .innerJoin(ordersTable, eq(ordersTable.id, guestPushSubscriptions.orderId))
    .where(
      and(
        eq(ordersTable.locationId, locationId),
        inArray(ordersTable.status, [
          "pending",
          "confirmed",
          "preparing",
          "ready",
        ]),
      ),
    );
  return [...new Set(rows.map((row) => row.orderId))];
}
