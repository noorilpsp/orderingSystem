import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { guestPushSubscriptions } from "@/db/schema";
import { orders as ordersTable } from "@/lib/db/schema/orders";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import { configureWebPush, getVapidPublicKey } from "@/lib/orders/web-push";
import { backfillGuestOrderPushes } from "@/lib/public-menu/sendGuestOrderPush";

export const runtime = "nodejs";

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function parseSubscription(raw: unknown): {
  endpoint: string;
  p256dh: string;
  auth: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as SubscriptionBody;
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh =
    body.keys && typeof body.keys.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const auth =
    body.keys && typeof body.keys.auth === "string" ? body.keys.auth.trim() : "";
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

/**
 * POST /api/public/orders/push/subscribe
 * Body: { storeSlug, orderId, confirmationUrl, subscription }
 */
export async function POST(request: NextRequest) {
  try {
    if (!getVapidPublicKey() || !configureWebPush()) {
      return posFailure("INTERNAL_ERROR", "Web Push is not configured", { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const storeSlug =
      typeof body?.storeSlug === "string" ? body.storeSlug.trim().toLowerCase() : "";
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const confirmationUrl =
      typeof body?.confirmationUrl === "string" ? body.confirmationUrl.trim() : "";
    const subscription = parseSubscription(body?.subscription);

    if (!storeSlug || !orderId || !confirmationUrl || !subscription) {
      return posFailure(
        "BAD_REQUEST",
        "storeSlug, orderId, confirmationUrl, and subscription are required",
        { status: 400 },
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(confirmationUrl);
    } catch {
      return posFailure("BAD_REQUEST", "confirmationUrl must be an absolute URL", {
        status: 400,
      });
    }
    if (!parsedUrl.pathname.includes("/order-confirmation")) {
      return posFailure(
        "BAD_REQUEST",
        "confirmationUrl must point at order-confirmation",
        { status: 400 },
      );
    }

    const location = await resolvePublicLocationBySlug(storeSlug);
    if (!location) {
      return posFailure("NOT_FOUND", "Store not found", { status: 404 });
    }

    const order = await db.query.orders.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.locationId, location.id)),
      columns: { id: true, status: true },
    });
    if (!order) {
      return posFailure("NOT_FOUND", "Order not found", { status: 404 });
    }
    if (
      order.status === "cancelled" ||
      order.status === "completed" ||
      order.status === "refunded"
    ) {
      return posFailure("BAD_REQUEST", "Order is no longer active", { status: 400 });
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const now = new Date();

    const existing = await db.query.guestPushSubscriptions.findFirst({
      where: and(
        eq(guestPushSubscriptions.orderId, orderId),
        eq(guestPushSubscriptions.endpoint, subscription.endpoint),
      ),
      columns: { id: true },
    });

    if (existing) {
      await db
        .update(guestPushSubscriptions)
        .set({
          storeSlug,
          confirmationUrl: parsedUrl.toString(),
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          userAgent,
          updatedAt: now,
        })
        .where(eq(guestPushSubscriptions.id, existing.id));
    } else {
      await db.insert(guestPushSubscriptions).values({
        orderId,
        storeSlug,
        confirmationUrl: parsedUrl.toString(),
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent,
      });
    }

    // Catch up on Accept/Ready/Complete if the guest enabled alerts mid-order.
    void backfillGuestOrderPushes(orderId);

    return posSuccess({ subscribed: true });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Failed to subscribe"), {
      status: 500,
    });
  }
}

/**
 * DELETE /api/public/orders/push/subscribe
 * Body: { orderId, endpoint? }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
    if (!orderId) {
      return posFailure("BAD_REQUEST", "orderId is required", { status: 400 });
    }

    if (endpoint) {
      await db
        .delete(guestPushSubscriptions)
        .where(
          and(
            eq(guestPushSubscriptions.orderId, orderId),
            eq(guestPushSubscriptions.endpoint, endpoint),
          ),
        );
    } else {
      await db
        .delete(guestPushSubscriptions)
        .where(eq(guestPushSubscriptions.orderId, orderId));
    }

    return posSuccess({ subscribed: false });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Failed to unsubscribe"), {
      status: 500,
    });
  }
}
