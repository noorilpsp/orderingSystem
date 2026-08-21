import { NextRequest } from "next/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { orders } from "@/lib/db/schema/orders";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { assertLocationKdsEnabled } from "@/lib/kds/assertKdsEnabled";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { formatGuestContactLabel } from "@/lib/orders/guestContactLabel";

export const runtime = "nodejs";

const KDS_ORDER_STATUSES = ["pending", "preparing", "ready"] as const;

/**
 * GET /api/kds/orders
 * List active kitchen orders for a location. Uses only orders + order_items (no table-based lookup).
 * Query params: locationId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return posFailure("BAD_REQUEST", "Location ID is required", { status: 400 });
    }

    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: { id: true, merchantId: true, country: true },
    });

    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    const kdsGate = await assertLocationKdsEnabled(locationId);
    if (kdsGate) return kdsGate;

    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: { id: true },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "You don't have access to this location", { status: 403 });
    }

    const ordersList = await db.query.orders.findMany({
      where: and(
        eq(orders.locationId, locationId),
        inArray(orders.status, [...KDS_ORDER_STATUSES])
      ),
      orderBy: [desc(orders.firedAt), desc(orders.createdAt)],
      columns: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        station: true,
        wave: true,
        firedAt: true,
        createdAt: true,
        sessionId: true,
      },
      with: {
        table: {
          columns: { id: true, tableNumber: true },
        },
        customer: {
          columns: { id: true, name: true, phone: true },
        },
        session: {
          columns: { id: true, tableId: true },
          with: {
            table: {
              columns: { id: true, tableNumber: true },
            },
          },
        },
        orderItems: {
          columns: {
            id: true,
            itemName: true,
            quantity: true,
            notes: true,
            status: true,
            sentToKitchenAt: true,
            startedAt: true,
            readyAt: true,
            servedAt: true,
          },
        },
      },
      limit: 100,
    });

    const kdsOrders = ordersList.map((order) => {
      const tableNumber =
        order.session?.table?.tableNumber ??
        order.table?.tableNumber ??
        null;
      const customerName = order.customer
        ? formatGuestContactLabel(order.customer.name, order.customer.phone, location.country)
        : null;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableNumber,
        customerName,
        status: order.status,
        station: order.station ?? null,
        firedAt: order.firedAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
        wave: order.wave,
        sessionId: order.sessionId,
        items: (order.orderItems ?? []).map((item) => ({
          id: item.id,
          name: item.itemName,
          quantity: item.quantity ?? 1,
          notes: item.notes,
          status: item.status,
          sentToKitchenAt: item.sentToKitchenAt?.toISOString() ?? null,
          startedAt: item.startedAt?.toISOString() ?? null,
          readyAt: item.readyAt?.toISOString() ?? null,
          servedAt: item.servedAt?.toISOString() ?? null,
        })),
      };
    });

    const res = posSuccess({ orders: kdsOrders });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (error) {
    console.error("[GET /api/kds/orders] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to fetch KDS orders"),
      { status: 500 }
    );
  }
}
