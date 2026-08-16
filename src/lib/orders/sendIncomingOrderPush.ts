import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { staffPushSubscriptions } from "@/db/schema";
import { configureWebPush } from "@/lib/orders/web-push";
import { isScheduledOrderParked } from "@/lib/public-menu/scheduledOrderRelease";

export type IncomingOrderPushPayload = {
  locationId: string;
  orderId: string;
  orderNumber: string;
  orderType: "pickup" | "delivery" | "dine_in";
  itemCount: number;
  scheduledPickupAt?: Date | null;
  prepMinutes?: number;
};

function buildNotificationBody(input: IncomingOrderPushPayload): string {
  const typeLabel =
    input.orderType === "pickup"
      ? "Pickup"
      : input.orderType === "delivery"
        ? "Delivery"
        : "Table";
  return `${typeLabel} · ${input.itemCount} ${input.itemCount === 1 ? "item" : "items"}`;
}

/**
 * Notify subscribed staff devices for a location when an incoming order is created.
 * Safe to call fire-and-forget; never throws to callers.
 */
export async function sendIncomingOrderPush(
  input: IncomingOrderPushPayload,
): Promise<void> {
  try {
    if (
      input.scheduledPickupAt &&
      isScheduledOrderParked({
        scheduledPickupAt: input.scheduledPickupAt,
        prepMinutes: input.prepMinutes ?? 15,
      })
    ) {
      return;
    }

    if (!configureWebPush()) {
      console.warn("[sendIncomingOrderPush] VAPID keys missing - skip");
      return;
    }

    const rows = await db
      .select({
        id: staffPushSubscriptions.id,
        endpoint: staffPushSubscriptions.endpoint,
        p256dh: staffPushSubscriptions.p256dh,
        auth: staffPushSubscriptions.auth,
      })
      .from(staffPushSubscriptions)
      .where(eq(staffPushSubscriptions.locationId, input.locationId));
    if (rows.length === 0) return;

    console.info(
      "[sendIncomingOrderPush] sending",
      rows.length,
      "subscription(s) for location",
      input.locationId,
      "order",
      input.orderNumber,
    );

    const payload = JSON.stringify({
      title: `New order ${input.orderNumber}`,
      body: buildNotificationBody(input),
      url: "/orders",
      orderId: input.orderId,
      orderNumber: input.orderNumber,
    });

    let sent = 0;
    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: {
                p256dh: row.p256dh,
                auth: row.auth,
              },
            },
            payload,
            { TTL: 60 * 30, urgency: "high" },
          );
          sent += 1;
        } catch (error) {
          const statusCode =
            error && typeof error === "object" && "statusCode" in error
              ? Number((error as { statusCode?: number }).statusCode)
              : null;
          if (statusCode === 404 || statusCode === 410) {
            await db
              .delete(staffPushSubscriptions)
              .where(eq(staffPushSubscriptions.id, row.id));
            return;
          }
          console.error("[sendIncomingOrderPush] send failed", row.id, error);
        }
      }),
    );
    console.info("[sendIncomingOrderPush] delivered", sent, "/", rows.length);
  } catch (error) {
    console.error("[sendIncomingOrderPush]", error);
  }
}
