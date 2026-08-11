import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { guestPushSubscriptions } from "@/db/schema";
import { orders as ordersTable } from "@/lib/db/schema/orders";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";

export const runtime = "nodejs";

/**
 * GET /api/public/orders/push/status?storeSlug=&orderId=
 */
export async function GET(request: NextRequest) {
  try {
    const storeSlug = (request.nextUrl.searchParams.get("storeSlug") ?? "")
      .trim()
      .toLowerCase();
    const orderId = (request.nextUrl.searchParams.get("orderId") ?? "").trim();
    if (!storeSlug || !orderId) {
      return posFailure("BAD_REQUEST", "storeSlug and orderId are required", {
        status: 400,
      });
    }

    const location = await resolvePublicLocationBySlug(storeSlug);
    if (!location) {
      return posFailure("NOT_FOUND", "Store not found", { status: 404 });
    }

    const order = await db.query.orders.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.locationId, location.id)),
      columns: { id: true },
    });
    if (!order) {
      return posFailure("NOT_FOUND", "Order not found", { status: 404 });
    }

    const row = await db.query.guestPushSubscriptions.findFirst({
      where: eq(guestPushSubscriptions.orderId, orderId),
      columns: { id: true },
    });

    return posSuccess({ subscribed: Boolean(row) });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Failed to load status"), {
      status: 500,
    });
  }
}
