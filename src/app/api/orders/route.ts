import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, asc, gte, lte, inArray } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { orders, orderItems, orderTimeline, seats } from "@/lib/db/schema/orders";
import { staff } from "@/lib/db/schema/staff";
import { users } from "@/db/schema";
import { devTimer, devSqlLog, devTimeStart, devTimeEnd, runExplain, DEV } from "@/lib/pos/devTimer";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { createOrderFromApi, fireWave } from "@/domain";
import {
  computeRequestHash,
  getIdempotentResponse,
  IDEMPOTENCY_CONFLICT,
  saveIdempotentResponse,
} from "@/domain/idempotency";
import { posFailure, posSuccess, requireIdempotencyKey, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * GET /api/orders
 * List orders for a location with filters
 * Query params: locationId (required), status?, orderType?, date?, startDate?, endDate?
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
    const status = searchParams.get("status");
    const orderType = searchParams.get("orderType");
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!locationId) {
      return posFailure("BAD_REQUEST", "Location ID is required", { status: 400 });
    }

    // Verify location exists and user has access
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        merchantId: true,
      },
    });

    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "You don't have access to this location", { status: 403 });
    }

    // Build where conditions
    const whereConditions = [eq(orders.locationId, locationId)];
    if (status) {
      whereConditions.push(eq(orders.status, status as any));
    }
    if (orderType) {
      whereConditions.push(eq(orders.orderType, orderType as any));
    }
    if (date) {
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);
      whereConditions.push(gte(orders.createdAt, dateStart));
      whereConditions.push(lte(orders.createdAt, dateEnd));
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereConditions.push(gte(orders.createdAt, start));
      whereConditions.push(lte(orders.createdAt, end));
    }

    // Fetch orders with relations
    const ordersList = await db.query.orders.findMany({
      where: and(...whereConditions),
      orderBy: [desc(orders.createdAt)],
      with: {
        customer: {
          columns: {
            id: true,
            name: true,
          },
        },
        table: {
          columns: {
            id: true,
            tableNumber: true,
          },
        },
        assignedStaff: {
          columns: {
            id: true,
            fullName: true,
          },
        },
        orderItems: {
          columns: {
            id: true,
            notes: true,
          },
        },
      },
      limit: 100, // Limit to prevent huge responses
    });

    // Who accepted / started preparing (first preparing timeline entry per order).
    const orderIds = ordersList.map((order) => order.id);
    const acceptedByByOrderId = new Map<string, { id: string; fullName: string }>();
    if (orderIds.length > 0) {
      const preparingEvents = await db.query.orderTimeline.findMany({
        where: and(
          inArray(orderTimeline.orderId, orderIds),
          eq(orderTimeline.status, "preparing"),
        ),
        columns: {
          orderId: true,
          changedByStaffId: true,
          changedByUserId: true,
          createdAt: true,
        },
        with: {
          changedByStaff: {
            columns: {
              id: true,
              fullName: true,
            },
          },
          changedByUser: {
            columns: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: [asc(orderTimeline.createdAt)],
      });

      const missingUserIds = new Set<string>();
      for (const event of preparingEvents) {
        if (acceptedByByOrderId.has(event.orderId)) continue;
        if (event.changedByStaff) {
          acceptedByByOrderId.set(event.orderId, {
            id: event.changedByStaff.id,
            fullName: event.changedByStaff.fullName,
          });
          continue;
        }
        // Owner/admin accounts often aren't linked to a Staff row - use users.fullName.
        if (event.changedByUser?.fullName) {
          acceptedByByOrderId.set(event.orderId, {
            id: event.changedByUser.id,
            fullName: event.changedByUser.fullName,
          });
          continue;
        }
        if (event.changedByUserId) {
          missingUserIds.add(event.changedByUserId);
        }
      }

      if (missingUserIds.size > 0) {
        const [staffRows, userRows] = await Promise.all([
          db.query.staff.findMany({
            where: and(
              eq(staff.locationId, locationId),
              inArray(staff.userId, [...missingUserIds]),
            ),
            columns: {
              id: true,
              fullName: true,
              userId: true,
            },
          }),
          db.query.users.findMany({
            where: inArray(users.id, [...missingUserIds]),
            columns: {
              id: true,
              fullName: true,
            },
          }),
        ]);

        const staffByUserId = new Map(
          staffRows
            .filter((row): row is typeof row & { userId: string } => !!row.userId)
            .map((row) => [row.userId, { id: row.id, fullName: row.fullName }] as const),
        );
        const userById = new Map(
          userRows.map((row) => [row.id, { id: row.id, fullName: row.fullName }] as const),
        );

        for (const event of preparingEvents) {
          if (acceptedByByOrderId.has(event.orderId)) continue;
          const fromStaff =
            event.changedByUserId != null
              ? staffByUserId.get(event.changedByUserId) ?? null
              : null;
          if (fromStaff) {
            acceptedByByOrderId.set(event.orderId, fromStaff);
            continue;
          }
          const fromUser =
            event.changedByUserId != null
              ? userById.get(event.changedByUserId) ?? null
              : null;
          if (fromUser) {
            acceptedByByOrderId.set(event.orderId, fromUser);
          }
        }
      }
    }

    // Transform to match expected format
    const transformedOrders = ordersList.map((order) => {
      // Check if any items have notes
      const hasItemNotes = order.orderItems?.some((item) => item.notes && item.notes.trim().length > 0) || false;
      const acceptedBy =
        acceptedByByOrderId.get(order.id) ??
        (order.assignedStaff
          ? { id: order.assignedStaff.id, fullName: order.assignedStaff.fullName }
          : null);

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        table: order.table
          ? { id: order.table.id, tableNumber: order.table.tableNumber }
          : null,
        customer: order.customer
          ? { id: order.customer.id, name: order.customer.name || "Guest" }
          : null,
        itemsCount: order.orderItems?.length || 0,
        total: parseFloat(order.total || "0"),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        completedAt: order.completedAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        status: order.status,
        // Staff column = who accepted / started preparing.
        assignedStaff: acceptedBy,
        paymentStatus: order.paymentStatus,
        notes: order.notes,
        hasItemNotes,
      };
    });

    const res = posSuccess({ orders: transformedOrders });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (error) {
    console.error("[GET /api/orders] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to fetch orders"),
      { status: 500 }
    );
  }
}

const ROUTE_ORDERS_CREATE = "POST /api/orders";

/**
 * POST /api/orders
 * Create order with items and customizations. Routes through service layer.
 * Body: { locationId, customerId?, sessionId?, tableId?, reservationId?, assignedStaffId?, orderType, paymentTiming, guestCount?, items: [...], notes? }
 *
 * Dine-in: ensureSessionByTableUuid + addItemsToOrder (validators, events, totals).
 * Pickup/delivery: createOrderWithItemsForPickupDelivery.
 *
 * Requires Idempotency-Key header.
 */
export async function POST(request: NextRequest) {
  const totalStart = DEV ? performance.now() : 0;
  const explainMode = DEV && new URL(request.url).searchParams.get("explain") === "1";
  let idempotencyKey: string | undefined;
  try {
    const idem = requireIdempotencyKey(request);
    if (!idem.ok) return idem.failure;
    idempotencyKey = idem.key;

    const t0 = DEV ? performance.now() : 0;
    devTimeStart("POST /orders auth");
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    devTimeEnd("POST /orders auth");
    if (DEV) devTimer("POST /orders auth", t0);

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401, correlationId: idempotencyKey });
    }

    const body = await request.json().catch(() => ({}));
    const {
      locationId,
      customerId,
      sessionId,
      tableId,
      reservationId,
      assignedStaffId,
      orderType,
      paymentTiming,
      items,
      notes,
      guestCount,
      eventSource,
      autoFireWave1,
    } = body;

    if (!locationId || !orderType || !paymentTiming || !items || !Array.isArray(items) || items.length === 0) {
      return posFailure(
        "BAD_REQUEST",
        "Location ID, order type, payment timing, and at least one item are required",
        { status: 400, correlationId: idempotencyKey }
      );
    }

    const requestHash = computeRequestHash(body);
    const t1 = DEV ? performance.now() : 0;
    devTimeStart("POST /orders getIdempotentResponse");
    const cached = await getIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE_ORDERS_CREATE,
      requestHash,
    });
    devTimeEnd("POST /orders getIdempotentResponse", cached ? 1 : 0);
    if (DEV) devTimer("POST /orders getIdempotentResponse", t1, cached ? 1 : 0);
    if (cached) {
      if (!cached.ok) {
        return posFailure(IDEMPOTENCY_CONFLICT, "Idempotency-Key reuse with different request", {
          status: 409,
          correlationId: idempotencyKey,
        });
      }
      const saved = cached.response as { body: Record<string, unknown>; status: number };
      const replayBody = { ...(saved.body ?? cached.response) as Record<string, unknown>, correlationId: idempotencyKey };
      return NextResponse.json(replayBody, { status: saved.status ?? 201 });
    }

    const t2 = DEV ? performance.now() : 0;
    devTimeStart("POST /orders createOrderFromApi");
    const result = await createOrderFromApi({
      locationId,
      customerId: customerId ?? null,
      sessionId: sessionId ?? null,
      tableId: tableId ?? null,
      reservationId: reservationId ?? null,
      assignedStaffId: assignedStaffId ?? null,
      orderType,
      paymentTiming,
      guestCount,
      notes: notes ?? null,
      items,
      eventSource,
      changedByUserId: user.id,
    });
    devTimeEnd("POST /orders createOrderFromApi");
    if (DEV) devTimer("POST /orders createOrderFromApi", t2);

    if (!result.ok) {
      const isForbidden =
        result.reason === "Unauthorized or location not found" ||
        result.reason === "You are not staff at this location";
      return posFailure(
        isForbidden ? "FORBIDDEN" : "BAD_REQUEST",
        result.reason,
        { status: isForbidden ? 403 : 400, correlationId: idempotencyKey }
      );
    }

    const t3 = DEV ? performance.now() : 0;
    devTimeStart("POST /orders completeOrder.findFirst");
    const completeOrder = await db.query.orders.findFirst({
      where: eq(orders.id, result.orderId),
      with: {
        customer: true,
        table: true,
        session: true,
        reservation: true,
        assignedStaff: true,
        orderItems: {
          with: {
            customizations: true,
          },
        },
        timeline: {
          orderBy: [desc(orderTimeline.createdAt)],
        },
        payments: true,
        delivery: true,
      },
    });
    devTimeEnd("POST /orders completeOrder.findFirst", completeOrder ? 1 : 0);
    if (DEV) devTimer("POST /orders completeOrder.findFirst", t3, completeOrder ? 1 : 0);

    const ordersSelectSql = db.select().from(orders).where(eq(orders.id, result.orderId));
    const { sql: ordersSql, params: ordersParams } = ordersSelectSql.toSQL();
    if (DEV) devSqlLog("POST /orders", "orders.findFirst (main query)", ordersSql, ordersParams);

    const addedItemIds = result.addedItemIds ?? [];
    const orderIdToWave = new Map<string, number>(
      (result.orders ?? []).map((o) => [o.orderId, o.wave])
    );
    const defaultWave = completeOrder?.wave ?? 1;
    const sid = result.sessionId ?? null;

    const t4 = DEV ? performance.now() : 0;
    devTimeStart("POST /orders seats.findMany");
    const seatRows =
      sid !== null
        ? await db.query.seats.findMany({
            where: and(eq(seats.sessionId, sid), eq(seats.status, "active")),
            columns: { id: true, seatNumber: true },
          })
        : [];
    devTimeEnd("POST /orders seats.findMany", seatRows.length);
    if (DEV) devTimer("POST /orders seats.findMany", t4, seatRows.length);
    const seatNumberBySeatId = new Map(seatRows.map((s) => [s.id, s.seatNumber]));

    const orderItemRows =
      addedItemIds.length > 0
        ? await db.query.orderItems.findMany({
            where: inArray(orderItems.id, addedItemIds),
            with: { customizations: true },
          })
        : [];

    const addedItems = orderItemRows.map((row) => {
      const waveNumber = orderIdToWave.get(row.orderId) ?? defaultWave;
      const seatNumber =
        row.seatId && seatNumberBySeatId.has(row.seatId)
          ? seatNumberBySeatId.get(row.seatId)!
          : (row.seat ?? 0);
      const status: "held" | "sent" | "cooking" | "ready" | "served" | "void" = row.voidedAt
        ? "void"
        : row.status === "served"
          ? "served"
          : row.status === "ready"
            ? "ready"
            : row.status === "preparing"
              ? "cooking"
              : row.status === "pending"
                ? "held"
                : "sent";
      return {
        id: row.id,
        orderId: row.orderId,
        menuItemId: row.itemId,
        name: row.itemName ?? "",
        price: Number(row.itemPrice),
        quantity: row.quantity ?? 1,
        status,
        seatNumber,
        waveNumber,
        notes: row.notes,
      };
    });

    const affectedWaveNumbers = addedItems.length > 0
      ? [...new Set(addedItems.map((i) => i.waveNumber))].sort((a, b) => a - b)
      : [];

    let autoFiredWave: number | undefined;
    if (Boolean(autoFireWave1) && affectedWaveNumbers.includes(1) && sid) {
      const t5 = DEV ? performance.now() : 0;
      devTimeStart("POST /orders fireWave");
      const fireResult = await fireWave(sid, { waveNumber: 1, eventSource });
      devTimeEnd("POST /orders fireWave");
      if (DEV) devTimer("POST /orders fireWave", t5);
      if (fireResult.ok) {
        autoFiredWave = 1;
        for (const item of addedItems) {
          if (item.waveNumber === 1) (item as { status: string }).status = "sent";
        }
      }
    }

    const data = {
      order: completeOrder,
      orderId: result.orderId,
      sessionId: sid,
      addedItemIds,
      addedItems,
      affectedWaveNumbers,
      ...(autoFiredWave !== undefined && { autoFiredWave }),
    };
    const responseBody = { ok: true as const, data, correlationId: idempotencyKey };

    const t6 = DEV ? performance.now() : 0;
    devTimeStart("POST /orders saveIdempotentResponse");
    await saveIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE_ORDERS_CREATE,
      requestHash,
      responseJson: { body: responseBody, status: 201 },
    });
    devTimeEnd("POST /orders saveIdempotentResponse", 1);
    if (DEV) devTimer("POST /orders saveIdempotentResponse", t6);
    if (DEV) devTimer("POST /orders total", totalStart);

    let meta: { explain?: string } | undefined;
    if (explainMode) {
      meta = { explain: await runExplain(ordersSql, ordersParams) };
    }
    return posSuccess(data, { status: 201, correlationId: idempotencyKey, meta });
  } catch (error) {
    console.error("[POST /api/orders] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to create order"),
      { status: 500, correlationId: idempotencyKey }
    );
  }
}
