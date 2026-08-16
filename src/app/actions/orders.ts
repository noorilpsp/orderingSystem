"use server";

import { eq, and, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  tables as tablesTable,
  sessions as sessionsTable,
  seats as seatsTable,
  orders as ordersTable,
  orderItems as orderItemsTable,
  orderItemCustomizations as orderItemCustomizationsTable,
  orderTimeline as orderTimelineTable,
  payments as paymentsTable,
  servicePeriods as servicePeriodsTable,
} from "@/lib/db/schema/orders";
import { staff as staffTable } from "@/lib/db/schema/staff";
import { verifyLocationAccess } from "@/lib/location-access";
import { canCloseSession } from "@/app/actions/session-close-validation";
import {
  recordSessionEvent,
  recordSessionEventWithSource,
  type EventSource,
} from "@/app/actions/session-events";
import {
  markItemPreparing,
  markItemReady,
  markItemServed,
} from "@/app/actions/order-item-lifecycle";
import { addSeatToSession, syncSeatsWithGuestCount } from "@/app/actions/seat-management";
import { normalizeFurnitureStatus } from "@/lib/pos/tableStatus";
import { canFireWave, canAddItems } from "@/domain/serviceFlow";
import { recalculateSessionTotals, recalculateStandaloneOrderTotals } from "@/domain/orderTotals";
import { awardLoyaltyPointsForCompletedOrder } from "@/lib/loyalty/awardLoyaltyPointsForCompletedOrder";
import {
  notifyGuestOrderAccepted,
  notifyGuestOrderCompleted,
  notifyGuestOrderReady,
} from "@/lib/public-menu/sendGuestOrderPush";

/**
 * Sync seats with guest count. Uses syncSeatsWithGuestCount to create/mark seats.
 */
async function ensureSeatsForSession(
  sessionId: string,
  guestCount: number
): Promise<void> {
  const result = await syncSeatsWithGuestCount(sessionId, guestCount);
  if (!result.ok) {
    throw new Error(result.error ?? "Failed to sync seats");
  }
}

/**
 * Get seats for a session. For seat_id resolution (sync) use activeOnly: false (default).
 * For table UI display use activeOnly: true.
 */
export async function getSeatsForSession(
  sessionId: string,
  activeOnly = false
): Promise<Array<{ id: string; seatNumber: number; guestName: string | null }>> {
  const rows = await db.query.seats.findMany({
    where: activeOnly
      ? and(eq(seatsTable.sessionId, sessionId), eq(seatsTable.status, "active"))
      : eq(seatsTable.sessionId, sessionId),
    columns: { id: true, seatNumber: true, guestName: true },
    orderBy: (s, { asc }) => [asc(s.seatNumber)],
  });
  return rows.map((r) => ({
    id: r.id,
    seatNumber: r.seatNumber,
    guestName: r.guestName ?? null,
  }));
}

/**
 * Get the current service period id for a location based on current time.
 * Returns null if no matching period or no periods defined.
 */
async function getCurrentServicePeriodIdForLocation(
  locationId: string
): Promise<string | null> {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${hh}:${mm}`;

  const periods = await db.query.servicePeriods.findMany({
    where: eq(servicePeriodsTable.locationId, locationId),
    columns: { id: true, startTime: true, endTime: true },
  });
  for (const p of periods) {
    if (currentTime >= p.startTime && currentTime < p.endTime) {
      return p.id;
    }
  }
  return null;
}

/**
 * Get or create an open session for a table. At most one open session per table.
 * When reservationId is provided and a new session is created, sets source: "reservation" and sessions.reservationId.
 */
async function getOrCreateSessionForTable(
  locationId: string,
  tableUuid: string,
  guestCount: number,
  serverId?: string | null,
  reservationId?: string | null
): Promise<string | null> {
  const existing = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.locationId, locationId),
      eq(sessionsTable.tableId, tableUuid),
      eq(sessionsTable.status, "open")
    ),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const servicePeriodId = await getCurrentServicePeriodIdForLocation(locationId);
  const isFromReservation = Boolean(reservationId?.trim());
  const [inserted] = await db
    .insert(sessionsTable)
    .values({
      locationId,
      tableId: tableUuid,
      serverId: serverId ?? null,
      guestCount,
      status: "open",
      source: isFromReservation ? "reservation" : "walk_in",
      reservationId: isFromReservation ? reservationId : null,
      servicePeriodId: servicePeriodId ?? undefined,
      updatedAt: new Date(),
    })
    .returning({ id: sessionsTable.id });
  if (!inserted?.id) return null;
  await ensureSeatsForSession(inserted.id, guestCount);
  return inserted.id;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

/** Resolve staff.id for (userId, locationId). Returns null if user is not staff for the location. */
async function getStaffIdForUser(
  locationId: string,
  userId: string
): Promise<string | null> {
  const row = await db.query.staff.findFirst({
    where: and(
      eq(staffTable.userId, userId),
      eq(staffTable.locationId, locationId),
      eq(staffTable.isActive, true)
    ),
    columns: { id: true },
  });
  return row?.id ?? null;
}

export type EnsureSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: "user_not_staff" }
  | { ok: false; reason: "no_location" }
  | { ok: false; reason: "no_table" }
  | { ok: false; reason: "table_not_active" };

export type EnsureSessionOptions = {
  /** Caller already validated location + merchant membership (e.g. API route). */
  accessVerified?: boolean;
};

/**
 * Get or create an open session for a table by table UUID (tables.id) or displayId.
 * Table lookup matches /api/tables/[id]/pos: UUID → eq(id), else ilike(displayId).
 * Requires userId to resolve staff.id. Rejects if furniture status is maintenance/disabled.
 * When reservationId is provided and a new session is created, sets source: "reservation".
 */
export async function ensureSessionForTableByTableUuid(
  locationId: string,
  tableUuid: string,
  guestCount: number,
  userId: string,
  reservationId?: string | null,
  options?: EnsureSessionOptions
): Promise<EnsureSessionResult> {
  if (!options?.accessVerified) {
    const location = await verifyLocationAccess(locationId);
    if (!location) return { ok: false, reason: "no_location" };
  }

  const tableLookup = isValidUuid(tableUuid)
    ? db.query.tables.findFirst({
        where: and(
          eq(tablesTable.locationId, locationId),
          eq(tablesTable.id, tableUuid)
        ),
        columns: { id: true, status: true },
      })
    : db.query.tables.findFirst({
        where: and(
          eq(tablesTable.locationId, locationId),
          ilike(tablesTable.displayId, tableUuid)
        ),
        columns: { id: true, status: true },
      });

  const [staffId, tableRow] = await Promise.all([
    getStaffIdForUser(locationId, userId),
    tableLookup,
  ]);
  if (!staffId) return { ok: false, reason: "user_not_staff" };
  if (!tableRow) return { ok: false, reason: "no_table" };

  const furnitureStatus = normalizeFurnitureStatus(tableRow.status ?? "");
  if (furnitureStatus === "maintenance" || furnitureStatus === "disabled") {
    return { ok: false, reason: "table_not_active" };
  }

  const sessionId = await getOrCreateSessionForTable(
    locationId,
    tableRow.id,
    guestCount,
    staffId,
    reservationId
  );
  return sessionId ? { ok: true, sessionId } : { ok: false, reason: "no_table" };
}

/** Get or create an open session for a table. Delegates to ensureSessionForTableByTableUuid. Supports UUID or displayId (T12). */
export async function ensureSessionForTable(
  locationId: string,
  tableId: string,
  guestCount: number,
  userId: string,
  reservationId?: string | null
): Promise<EnsureSessionResult> {
  return ensureSessionForTableByTableUuid(
    locationId,
    tableId,
    guestCount,
    userId,
    reservationId
  );
}

/**
 * Get open session id for a table (by table id string).
 * Supports: UUID (tables.id), display_id, table_number (case-insensitive).
 * Returns null if no open session.
 *
 * Examples: getOpenSessionIdForTable("t6"), getOpenSessionIdForTable("<uuid>"), getOpenSessionIdForTable("T6")
 */
export async function getOpenSessionIdForTable(
  locationId: string,
  tableId: string
): Promise<string | null> {
  const location = await verifyLocationAccess(locationId);
  if (!location) return null;

  let tableRow: { id: string } | null;
  if (isValidUuid(tableId)) {
    tableRow =
      (await db.query.tables.findFirst({
        where: and(
          eq(tablesTable.locationId, locationId),
          eq(tablesTable.id, tableId)
        ),
        columns: { id: true },
      })) ?? null;
  } else {
    tableRow =
      (await db.query.tables.findFirst({
        where: and(
          eq(tablesTable.locationId, locationId),
          or(
            ilike(tablesTable.tableNumber, tableId),
            ilike(tablesTable.displayId, tableId)
          )
        ),
        columns: { id: true },
      })) ?? null;
  }
  if (!tableRow) return null;

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.locationId, locationId),
      eq(sessionsTable.tableId, tableRow.id),
      eq(sessionsTable.status, "open")
    ),
    columns: { id: true },
  });
  return session?.id ?? null;
}

type DbOrTx = typeof db;

/**
 * Create the next order wave for a session. Finds highest wave number and creates a new order
 * with wave = highest + 1, status = pending, fired_at = null, station = null.
 */
export async function createNextWave(
  sessionId: string,
  dbOrTx: DbOrTx = db
): Promise<{ ok: true; order: { id: string; wave: number } } | { ok: false; error: string }> {
  const session = await dbOrTx.query.sessions.findFirst({
    where: eq(sessionsTable.id, sessionId),
    columns: { id: true, locationId: true, tableId: true },
  });
  if (!session) return { ok: false, error: "Session not found" };

  const location = await verifyLocationAccess(session.locationId);
  if (!location) return { ok: false, error: "Unauthorized or location not found" };

  const [maxRow] = await dbOrTx
    .select({
      maxWave: sql<number>`COALESCE(MAX(${ordersTable.wave}), 0)::int`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.sessionId, sessionId));
  const highestWave = maxRow?.maxWave ?? 0;
  const nextWave = highestWave + 1;

  const tableRow = session.tableId
    ? await dbOrTx.query.tables.findFirst({
        where: eq(tablesTable.id, session.tableId),
        columns: { tableNumber: true },
      })
    : null;
  const tableNum = tableRow?.tableNumber?.match(/^[A-Za-z]*(\d+)$/)?.[1] ?? "1";
  const orderNumber = `T${tableNum}-${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const now = new Date();

  const [inserted] = await dbOrTx
    .insert(ordersTable)
    .values({
      sessionId,
      wave: nextWave,
      locationId: session.locationId,
      tableId: session.tableId,
      orderNumber,
      orderType: "dine_in",
      status: "pending",
      paymentStatus: "unpaid",
      paymentTiming: "pay_later",
      subtotal: "0",
      taxAmount: "0",
      serviceCharge: "0",
      tipAmount: "0",
      discountAmount: "0",
      total: "0",
      firedAt: null,
      station: null,
      updatedAt: now,
    })
    .returning({ id: ordersTable.id, wave: ordersTable.wave });

  if (!inserted) return { ok: false, error: "Failed to create order" };
  return { ok: true, order: { id: inserted.id, wave: inserted.wave } };
}

export type RemoveWaveResult =
  | { ok: true; orderId: string; wave: number }
  | {
      ok: false
      error: string
      reason?: "session_not_found" | "wave_not_found" | "not_last_wave" | "wave_has_items"
    }

/**
 * Remove a wave order from a session.
 * Safety rules:
 * - only the highest wave can be removed (prevents wave-number gaps)
 * - wave must have no non-void items
 */
export async function removeWave(
  sessionId: string,
  waveNumber: number,
  dbOrTx: DbOrTx = db
): Promise<RemoveWaveResult> {
  if (!Number.isFinite(waveNumber) || waveNumber <= 0) {
    return { ok: false, error: "Invalid wave number" }
  }

  const session = await dbOrTx.query.sessions.findFirst({
    where: eq(sessionsTable.id, sessionId),
    columns: { id: true, locationId: true },
  })
  if (!session) return { ok: false, error: "Session not found", reason: "session_not_found" }

  const location = await verifyLocationAccess(session.locationId)
  if (!location) return { ok: false, error: "Unauthorized or location not found" }

  const [maxRow] = await dbOrTx
    .select({
      maxWave: sql<number>`COALESCE(MAX(${ordersTable.wave}), 0)::int`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.sessionId, sessionId))
  const highestWave = maxRow?.maxWave ?? 0
  if (waveNumber !== highestWave) {
    return {
      ok: false,
      error: `Only the last wave (W${highestWave}) can be removed`,
      reason: "not_last_wave",
    }
  }

  const waveOrder = await dbOrTx.query.orders.findFirst({
    where: and(
      eq(ordersTable.sessionId, sessionId),
      eq(ordersTable.wave, waveNumber)
    ),
    columns: { id: true, wave: true },
  })
  if (!waveOrder) return { ok: false, error: "Wave not found", reason: "wave_not_found" }

  const activeItem = await dbOrTx.query.orderItems.findFirst({
    where: and(
      eq(orderItemsTable.orderId, waveOrder.id),
      isNull(orderItemsTable.voidedAt)
    ),
    columns: { id: true },
  })
  if (activeItem) {
    return {
      ok: false,
      error: `Wave ${waveNumber} has items. Move or remove them first.`,
      reason: "wave_has_items",
    }
  }

  await dbOrTx.delete(ordersTable).where(eq(ordersTable.id, waveOrder.id))
  return { ok: true, orderId: waveOrder.id, wave: waveOrder.wave }
}

/**
 * Fire a wave: set fired_at = now, status = confirmed, update order_items.sent_to_kitchen_at
 * if not set, and record session event course_fired.
 */
export async function fireWave(
  orderId: string,
  options?: { eventSource?: EventSource },
  dbOrTx: DbOrTx = db
): Promise<{ ok: boolean; error?: string }> {
  const order = await dbOrTx.query.orders.findFirst({
    where: eq(ordersTable.id, orderId),
    columns: {
      id: true,
      sessionId: true,
      locationId: true,
      wave: true,
      firedAt: true,
    },
  });
  if (!order) return { ok: false, error: "Order not found" };

  const location = await verifyLocationAccess(order.locationId);
  if (!location) return { ok: false, error: "Unauthorized or location not found" };

  const fireResult = canFireWave({ firedAt: order.firedAt });
  if (!fireResult.ok) {
    return { ok: false, error: "Wave already fired" };
  }

  const now = new Date();

  await dbOrTx
    .update(ordersTable)
    .set({
      firedAt: now,
      status: "confirmed",
      updatedAt: now,
    })
    .where(eq(ordersTable.id, orderId));

  const items = await dbOrTx.query.orderItems.findMany({
    where: and(
      eq(orderItemsTable.orderId, orderId),
      isNull(orderItemsTable.sentToKitchenAt)
    ),
    columns: { id: true },
  });
  for (const item of items) {
    await dbOrTx
      .update(orderItemsTable)
      .set({ sentToKitchenAt: now })
      .where(eq(orderItemsTable.id, item.id));
  }

  if (order.sessionId) {
    const meta = { wave: order.wave };
    if (options?.eventSource) {
      await recordSessionEventWithSource(
        order.locationId,
        order.sessionId,
        "course_fired",
        options.eventSource,
        meta,
        undefined,
        undefined,
        dbOrTx
      );
    } else {
      await recordSessionEvent(order.locationId, order.sessionId, "course_fired", meta, undefined, dbOrTx);
    }
  }

  return { ok: true };
}

/** Get order id for a session and wave number. Used to wire fireWave from table page. */
export async function getOrderIdForSessionAndWave(
  sessionId: string,
  waveNumber: number
): Promise<string | null> {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(ordersTable.sessionId, sessionId),
      eq(ordersTable.wave, waveNumber)
    ),
    columns: { id: true },
  });
  return order?.id ?? null;
}

/**
 * Advance all items in a wave to a kitchen status. Mutations keyed by sessionId.
 * @deprecated Unused call path. Kept for compatibility until legacy removal.
 */
export async function advanceOrderWaveStatusBySession(
  sessionId: string,
  waveNumber: number,
  status: "preparing" | "ready" | "served"
): Promise<{ ok: boolean; error?: string }> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessionsTable.id, sessionId),
    columns: { id: true, locationId: true },
  });
  if (!session) return { ok: false, error: "Session not found" };

  const location = await verifyLocationAccess(session.locationId);
  if (!location) return { ok: false, error: "Unauthorized or location not found" };

  const orderRow = await db.query.orders.findFirst({
    where: and(
      eq(ordersTable.sessionId, sessionId),
      eq(ordersTable.wave, waveNumber)
    ),
    columns: { id: true },
  });
  if (!orderRow) return { ok: false, error: "Order (wave) not found" };

  const items = await db.query.orderItems.findMany({
    where: and(
      eq(orderItemsTable.orderId, orderRow.id),
      isNull(orderItemsTable.voidedAt)
    ),
    columns: { id: true },
  });
  const eventSource: EventSource = "system";
  for (const item of items) {
    const result =
      status === "preparing"
        ? await markItemPreparing(item.id)
        : status === "ready"
          ? await markItemReady(item.id, { eventSource })
          : await markItemServed(item.id, { eventSource });
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true };
}

/** DB order item status */
const ORDER_ITEM_STATUS = ["pending", "preparing", "ready", "served"] as const;

export type OrderForTableItem = {
  /** DB order_items.id when loaded from database; omit for draft items. */
  id?: string;
  /** DB orders.id for mutation routes keyed by orderId + itemId. */
  orderId?: string;
  /** Menu item id (items.id); needed for addItemsToOrder sync. */
  itemId?: string | null;
  name: string;
  price: number;
  quantity: number;
  status: (typeof ORDER_ITEM_STATUS)[number];
  notes: string | null;
  /** From DB: seat number (0 = shared). Use for seat assignment when loading. */
  seatNumber?: number;
  /** From DB: seat_id when using seats table. */
  seatId?: string | null;
};

export type OrderForTableResult = {
  guestCount: number;
  seatedAt: string | null;
  items: OrderForTableItem[];
  /** Set when table has an open session (so UI can load seats from DB). */
  sessionId?: string | null;
} | null;

/**
 * Load active order + items for a table from DB. Returns data only when an open session exists.
 * Returns null when no open session (sessions are the source of truth).
 */
export async function getOrderForTable(
  locationId: string,
  tableId: string
): Promise<OrderForTableResult> {
  const location = await verifyLocationAccess(locationId);
  if (!location) return null;

  const tableRows = await db.query.tables.findMany({
    where: and(
      eq(tablesTable.locationId, locationId),
      ilike(tablesTable.tableNumber, tableId)
    ),
    columns: { id: true, guests: true, seatedAt: true },
    limit: 1,
  });
  const tableRow = tableRows[0];
  if (!tableRow) return null;

  const guestCount = tableRow.guests ?? 0;
  const seatedAt = tableRow.seatedAt?.toISOString() ?? null;

  const openSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.locationId, locationId),
      eq(sessionsTable.tableId, tableRow.id),
      eq(sessionsTable.status, "open")
    ),
    columns: { id: true, guestCount: true, openedAt: true },
  });

  if (openSession) {
    const sessionOrders = await db.query.orders.findMany({
      where: eq(ordersTable.sessionId, openSession.id),
      columns: { id: true },
    });
    const orderIds = sessionOrders.map((o) => o.id);
    if (orderIds.length === 0) {
      return {
        guestCount: openSession.guestCount ?? guestCount,
        seatedAt: seatedAt ?? openSession.openedAt?.toISOString() ?? null,
        items: [],
        sessionId: openSession.id,
      };
    }
    const rows = await db.query.orderItems.findMany({
      where: inArray(orderItemsTable.orderId, orderIds),
      columns: {
        id: true,
        orderId: true,
        itemId: true,
        itemName: true,
        itemPrice: true,
        quantity: true,
        status: true,
        notes: true,
        seat: true,
        seatId: true,
      },
    });
    const seatIds = rows.map((r) => r.seatId).filter((id): id is string => !!id);
    const seatIdToNumber = new Map<string, number>();
    if (seatIds.length > 0) {
      const seatRows = await db.query.seats.findMany({
        where: inArray(seatsTable.id, seatIds),
        columns: { id: true, seatNumber: true },
      });
      seatRows.forEach((s) => seatIdToNumber.set(s.id, s.seatNumber));
    }
    const items: OrderForTableItem[] = rows.map((r) => {
      const seatNumber =
        r.seatId != null
          ? seatIdToNumber.get(r.seatId) ?? r.seat ?? 0
          : r.seat ?? 0;
      return {
        id: r.id,
        orderId: r.orderId,
        itemId: r.itemId ?? null,
        name: r.itemName,
        price: Number(r.itemPrice),
        quantity: r.quantity ?? 1,
        status: ORDER_ITEM_STATUS.includes(r.status as (typeof ORDER_ITEM_STATUS)[number])
          ? (r.status as (typeof ORDER_ITEM_STATUS)[number])
          : "pending",
        notes: r.notes,
        seatNumber,
        seatId: r.seatId ?? null,
      };
    });
    return {
      guestCount: openSession.guestCount ?? guestCount,
      seatedAt: seatedAt ?? openSession.openedAt?.toISOString() ?? null,
      items,
      sessionId: openSession.id,
    };
  }

  return null;
}

/** Optional payment to record when closing a session. */
export type CloseTablePayment = {
  amount: number;
  tipAmount?: number;
  method?: "card" | "cash" | "mobile" | "other";
};

/** Options for closing a table session. */
export type CloseOrderForTableOptions = {
  /** Manager override: skip validation, void blocking items, record forced_close event. */
  force?: boolean;
  /** Correlate events triggered by the same user action. */
  correlationId?: string;
};

export type CloseOrderForTableResult =
  | { ok: true; completedOrderIds?: string[] }
  | {
      ok: false;
      error: string;
      reason?: "session_not_open" | "unfinished_items" | "unpaid_balance" | "payment_in_progress" | "kitchen_mid_fire" | "invalid_tip";
      items?: Array<{ id: string; itemName: string; status: string; quantity: number }>;
      remaining?: number;
      sessionTotal?: number;
      paymentsTotal?: number;
    };

/**
 * Close a session by sessionId. All mutations keyed by sessionId.
 * Validates session is in a safe state unless force=true (manager override).
 */
export async function closeSession(
  sessionId: string,
  payment?: CloseTablePayment,
  options?: CloseOrderForTableOptions,
  dbOrTx: DbOrTx = db
): Promise<CloseOrderForTableResult> {
  const session = await dbOrTx.query.sessions.findFirst({
    where: eq(sessionsTable.id, sessionId),
    columns: { id: true, locationId: true, status: true },
  });
  if (!session) return { ok: false, error: "Session not found" };
  if (session.status !== "open") return { ok: false, error: "Session is not open", reason: "session_not_open" };

  const location = await verifyLocationAccess(session.locationId);
  if (!location) return { ok: false, error: "Unauthorized or location not found" };

  const now = new Date();
  const force = options?.force === true;

  if (payment && (payment.tipAmount ?? 0) < 0) {
    return { ok: false, error: "Tip amount must be >= 0", reason: "invalid_tip" };
  }

  if (!force) {
    await recalculateSessionTotals(sessionId, dbOrTx);
    const canClose = await canCloseSession(sessionId, { incomingPaymentAmount: payment?.amount }, dbOrTx);
    if (!canClose.ok) {
      const err: CloseOrderForTableResult = {
        ok: false,
        error: `Cannot close session: ${canClose.reason}`,
        reason: canClose.reason,
      };
      if (canClose.reason === "unfinished_items") err.items = canClose.items;
      if (canClose.reason === "unpaid_balance") {
        err.remaining = canClose.remaining;
        err.sessionTotal = canClose.sessionTotal;
        err.paymentsTotal = canClose.paymentsTotal;
      }
      return err;
    }
  } else {
    const ordersForSession = await dbOrTx.query.orders.findMany({
      where: eq(ordersTable.sessionId, sessionId),
      columns: { id: true },
    });
    const orderIds = ordersForSession.map((o) => o.id);
    if (orderIds.length > 0) {
      const unfinishedItems = await dbOrTx.query.orderItems.findMany({
        where: and(
          inArray(orderItemsTable.orderId, orderIds),
          inArray(orderItemsTable.status, ["pending", "preparing", "ready"]),
          isNull(orderItemsTable.voidedAt)
        ),
        columns: { id: true },
      });
      for (const item of unfinishedItems) {
        await dbOrTx
          .update(orderItemsTable)
          .set({ voidedAt: now })
          .where(eq(orderItemsTable.id, item.id));
      }
    }
    await recordSessionEventWithSource(
      session.locationId,
      sessionId,
      "payment_completed",
      "system",
      { forced_close: true, reason: "manager_override" },
      undefined,
      options?.correlationId,
      dbOrTx
    );
  }

  if (payment && payment.amount > 0) {
    await dbOrTx.insert(paymentsTable).values({
      sessionId,
      amount: payment.amount.toFixed(2),
      tipAmount: (payment.tipAmount ?? 0).toFixed(2),
      method: payment.method ?? "other",
      status: "completed",
      paidAt: now,
    });
    await recalculateSessionTotals(sessionId, dbOrTx);
  }

  await dbOrTx
    .update(sessionsTable)
    .set({ status: "closed", closedAt: now, updatedAt: now })
    .where(eq(sessionsTable.id, sessionId));

  // Closing the visit settles the check: kitchen-complete + paid.
  await dbOrTx
    .update(ordersTable)
    .set({
      status: "completed",
      paymentStatus: "paid",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(ordersTable.sessionId, sessionId));

  const completedSessionOrders = await dbOrTx.query.orders.findMany({
    where: eq(ordersTable.sessionId, sessionId),
    columns: { id: true },
  });

  return {
    ok: true,
    completedOrderIds: completedSessionOrders.map((order) => order.id),
  };
}

/** Line item input for pickup/delivery order creation. Used by createOrderWithItemsForPickupDelivery. */
export type PickupDeliveryLineItemInput = {
  itemId: string | null;
  itemName: string;
  itemPrice: string;
  quantity: number;
  customizationsTotal: string;
  lineTotal: string;
  notes: string | null;
  /** Resolved station for KDS (e.g. kitchen, bar). */
  stationOverride?: string | null;
  customizations: Array<{
    groupId: string;
    optionId: string;
    groupName: string;
    optionName: string;
    optionPrice: string;
    quantity: number;
  }>;
};

/**
 * Create a pickup, delivery, or counter dine-in order with items. No session.
 * Used by service layer. Caller must have verified location access and validated items.
 */
export async function createOrderWithItemsForPickupDelivery(
  order: {
    locationId: string;
    customerId?: string | null;
    tableId?: string | null;
    reservationId?: string | null;
    assignedStaffId?: string | null;
    orderNumber: string;
    orderType: "pickup" | "delivery" | "dine_in";
    paymentTiming: "pay_first" | "pay_later";
    subtotal: string;
    taxAmount: string;
    serviceCharge: string;
    discountAmount?: string;
    total: string;
    notes?: string | null;
    scheduledPickupAt?: Date | null;
  },
  lineItems: PickupDeliveryLineItemInput[],
  options: { changedByUserId?: string | null; changedByStaffId?: string | null },
  dbOrTx: DbOrTx = db,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const now = new Date();
  const [inserted] = await dbOrTx
    .insert(ordersTable)
    .values({
      locationId: order.locationId,
      sessionId: null,
      wave: 1,
      customerId: order.customerId ?? null,
      tableId: order.tableId ?? null,
      reservationId: order.reservationId ?? null,
      assignedStaffId: order.assignedStaffId ?? null,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: "pending",
      paymentStatus: "unpaid",
      paymentTiming: order.paymentTiming,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      discountAmount: order.discountAmount ?? "0.00",
      total: order.total,
      notes: order.notes ?? null,
      scheduledPickupAt: order.scheduledPickupAt ?? null,
      updatedAt: now,
    })
    .returning({ id: ordersTable.id });

  if (!inserted?.id) return { ok: false, error: "Failed to create order" };

  for (const item of lineItems) {
    const { customizations, ...itemValues } = item;
    const [orderItem] = await dbOrTx
      .insert(orderItemsTable)
      .values({
        orderId: inserted.id,
        ...itemValues,
        seat: 0,
        status: "pending",
      })
      .returning({ id: orderItemsTable.id });

    if (orderItem?.id && customizations.length > 0) {
      await dbOrTx.insert(orderItemCustomizationsTable).values(
        customizations.map((c) => ({
          orderItemId: orderItem.id,
          ...c,
        }))
      );
    }
  }

  await dbOrTx.insert(orderTimelineTable).values({
    orderId: inserted.id,
    status: "pending",
    changedByUserId: options.changedByUserId ?? null,
    changedByStaffId: options.changedByStaffId ?? null,
    note: "Order created",
  });

  return { ok: true, orderId: inserted.id };
}

// -----------------------------------------------------------------------------
// Order metadata, cancellation, status, and payments (used by service layer)
// -----------------------------------------------------------------------------

export type UpdateOrderMetadataPatch = {
  customerId?: string | null;
  tableId?: string | null;
  reservationId?: string | null;
  assignedStaffId?: string | null;
  notes?: string | null;
};

export async function updateOrderMetadata(
  orderId: string,
  patch: UpdateOrderMetadataPatch
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const order = await db.query.orders.findFirst({ where: eq(ordersTable.id, orderId), columns: { locationId: true } });
  if (!order) return { ok: false, error: "Order not found" };
  const location = await verifyLocationAccess(order.locationId);
  if (!location) return { ok: false, error: "Unauthorized" };

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.customerId !== undefined) updateData.customerId = patch.customerId;
  if (patch.tableId !== undefined) updateData.tableId = patch.tableId;
  if (patch.reservationId !== undefined) updateData.reservationId = patch.reservationId;
  if (patch.assignedStaffId !== undefined) updateData.assignedStaffId = patch.assignedStaffId;
  if (patch.notes !== undefined) updateData.notes = patch.notes;

  await db.update(ordersTable).set(updateData as any).where(eq(ordersTable.id, orderId));
  return { ok: true, orderId };
}

export async function cancelOrderByOrderId(
  orderId: string,
  userId: string
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const order = await db.query.orders.findFirst({
    where: eq(ordersTable.id, orderId),
    with: { location: { columns: { id: true, merchantId: true } } },
    columns: { id: true, locationId: true, tableId: true, status: true, paymentStatus: true },
  });
  if (!order) return { ok: false, error: "Order not found" };

  const location = await verifyLocationAccess(order.locationId);
  if (!location) return { ok: false, error: "Unauthorized or location not found" };

  if (order.paymentStatus === "paid" || order.paymentStatus === "partial") {
    return { ok: false, error: "Paid orders must be refunded, not voided" };
  }
  if (order.paymentStatus === "refunded") {
    return { ok: false, error: "Order is already refunded" };
  }
  if (order.status === "cancelled") {
    return { ok: true, orderId };
  }

  const now = new Date();
  await db
    .update(ordersTable)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(eq(ordersTable.id, orderId));

  await db.insert(orderTimelineTable).values({
    orderId,
    status: "cancelled",
    changedByUserId: userId,
    note: "Order cancelled",
  });

  if (order.tableId) {
    await db
      .update(tablesTable)
      .set({ status: "available", updatedAt: now })
      .where(eq(tablesTable.id, order.tableId));
  }

  return { ok: true, orderId };
}

export async function refundOrderByOrderId(
  orderId: string,
  userId: string
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const order = await db.query.orders.findFirst({
    where: eq(ordersTable.id, orderId),
    with: { location: { columns: { id: true, merchantId: true } } },
    columns: {
      id: true,
      locationId: true,
      status: true,
      paymentStatus: true,
    },
  });
  if (!order) return { ok: false, error: "Order not found" };

  const location = await verifyLocationAccess(order.locationId);
  if (!location) return { ok: false, error: "Unauthorized or location not found" };

  if (order.paymentStatus === "refunded") {
    return { ok: true, orderId };
  }
  if (
    order.paymentStatus !== "paid" &&
    order.paymentStatus !== "partial" &&
    order.status !== "completed"
  ) {
    return { ok: false, error: "Only paid orders can be refunded" };
  }

  const now = new Date();
  await db
    .update(paymentsTable)
    .set({ status: "refunded", refundedAt: now })
    .where(and(eq(paymentsTable.orderId, orderId), eq(paymentsTable.status, "completed")));

  const orderUpdate: Record<string, unknown> = {
    paymentStatus: "refunded",
    updatedAt: now,
  };
  // Pull unfinished kitchen work off Live when money is refunded.
  if (order.status !== "completed" && order.status !== "cancelled") {
    orderUpdate.status = "cancelled";
    orderUpdate.cancelledAt = now;
  }

  await db.update(ordersTable).set(orderUpdate as any).where(eq(ordersTable.id, orderId));

  await db.insert(orderTimelineTable).values({
    orderId,
    status: (orderUpdate.status as "cancelled" | typeof order.status) ?? order.status,
    changedByUserId: userId,
    note: "Order refunded",
  });

  return { ok: true, orderId };
}

export type AddItemToOrderByOrderIdInput = {
  itemId: string;
  itemName: string;
  itemPrice: number;
  quantity: number;
  customizationsTotal: number;
  lineTotal: number;
  notes?: string | null;
  customizations: Array<{
    groupId: string;
    optionId: string;
    groupName: string;
    optionName: string;
    optionPrice: string;
    quantity: number;
  }>;
};

export async function addItemToOrderByOrderId(
  orderId: string,
  input: AddItemToOrderByOrderIdInput
): Promise<{ ok: true; orderItemId: string } | { ok: false; error: string }> {
  const order = await db.query.orders.findFirst({ where: eq(ordersTable.id, orderId), columns: { locationId: true } });
  if (!order) return { ok: false, error: "Order not found" };
  const location = await verifyLocationAccess(order.locationId);
  if (!location) return { ok: false, error: "Unauthorized" };

  const [row] = await db
    .insert(orderItemsTable)
    .values({
      orderId,
      itemId: input.itemId,
      itemName: input.itemName,
      itemPrice: input.itemPrice.toFixed(2),
      quantity: input.quantity,
      customizationsTotal: input.customizationsTotal.toFixed(2),
      lineTotal: input.lineTotal.toFixed(2),
      notes: input.notes ?? null,
      seat: 0,
      status: "pending",
    })
    .returning({ id: orderItemsTable.id });
  if (!row?.id) return { ok: false, error: "Failed to insert order item" };

  if (input.customizations.length > 0) {
    await db.insert(orderItemCustomizationsTable).values(
      input.customizations.map((c) => ({ orderItemId: row.id, ...c }))
    );
  }

  await recalculateStandaloneOrderTotals(orderId);
  return { ok: true, orderItemId: row.id };
}

export type UpdateOrderStatusOptions = {
  note?: string | null;
  changedByStaffId?: string | null;
  changedByUserId?: string | null;
  /** When accepting/preparing, set guest-facing ready estimate. */
  estimatedReadyAt?: Date | null;
};

const ITEM_STATUS_RANK: Record<"pending" | "preparing" | "ready" | "served", number> = {
  pending: 0,
  preparing: 1,
  ready: 2,
  served: 3,
};

function orderStatusToItemStatus(
  orderStatus: string
): "preparing" | "ready" | "served" | null {
  if (orderStatus === "preparing") return "preparing";
  if (orderStatus === "ready") return "ready";
  if (orderStatus === "completed") return "served";
  return null;
}

/**
 * When counter/order-level status advances (Accept / Ready / Served), move non-voided
 * items forward to match. Never moves items backwards. Fills kitchen timestamps so the
 * ordering check constraint stays valid when skipping intermediate statuses.
 */
async function syncOrderItemsToOrderStatus(
  orderId: string,
  orderStatus: string
): Promise<void> {
  const targetStatus = orderStatusToItemStatus(orderStatus);
  if (!targetStatus) return;

  const targetRank = ITEM_STATUS_RANK[targetStatus];
  const items = await db.query.orderItems.findMany({
    where: and(eq(orderItemsTable.orderId, orderId), isNull(orderItemsTable.voidedAt)),
    columns: {
      id: true,
      status: true,
      sentToKitchenAt: true,
      startedAt: true,
      readyAt: true,
      servedAt: true,
    },
  });

  const now = new Date();
  for (const item of items) {
    const current = item.status as keyof typeof ITEM_STATUS_RANK;
    const currentRank = ITEM_STATUS_RANK[current] ?? 0;
    if (currentRank >= targetRank) continue;

    const updateData: {
      status: "preparing" | "ready" | "served";
      sentToKitchenAt?: Date;
      startedAt?: Date;
      readyAt?: Date;
      servedAt?: Date;
    } = { status: targetStatus };

    if (targetRank >= 1) {
      updateData.sentToKitchenAt = item.sentToKitchenAt ?? now;
      updateData.startedAt = item.startedAt ?? now;
    }
    if (targetRank >= 2) {
      updateData.readyAt = item.readyAt ?? now;
    }
    if (targetRank >= 3) {
      updateData.servedAt = item.servedAt ?? now;
    }

    await db
      .update(orderItemsTable)
      .set(updateData)
      .where(eq(orderItemsTable.id, item.id));
  }
}

export async function updateOrderStatusByOrderId(
  orderId: string,
  status: string,
  options: UpdateOrderStatusOptions
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const order = await db.query.orders.findFirst({
    where: eq(ordersTable.id, orderId),
    columns: {
      locationId: true,
      orderNumber: true,
      orderType: true,
      total: true,
      paymentStatus: true,
      assignedStaffId: true,
      sessionId: true,
    },
  });
  if (!order) return { ok: false, error: "Order not found" };
  const location = await verifyLocationAccess(order.locationId);
  if (!location) return { ok: false, error: "Unauthorized" };

  let changedByStaffId = options.changedByStaffId ?? null;
  if (!changedByStaffId && options.changedByUserId) {
    changedByStaffId = await getStaffIdForUser(order.locationId, options.changedByUserId);
  }

  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "completed") updateData.completedAt = new Date();
  if (status === "cancelled") updateData.cancelledAt = new Date();
  if (options.estimatedReadyAt !== undefined) {
    updateData.estimatedReadyAt = options.estimatedReadyAt;
  }
  // Accept / start preparing: pin assignee to the accepting staff when unset.
  if (
    status === "preparing" &&
    !order.assignedStaffId &&
    changedByStaffId
  ) {
    updateData.assignedStaffId = changedByStaffId;
  }

  await db.update(ordersTable).set(updateData as any).where(eq(ordersTable.id, orderId));
  await db.insert(orderTimelineTable).values({
    orderId,
    status: status as any,
    changedByStaffId,
    changedByUserId: options.changedByUserId ?? null,
    note: options.note ?? null,
  });
  await syncOrderItemsToOrderStatus(orderId, status);

  // Open-check (delivery-to-table): kitchen "served" must not settle payment.
  // Standalone/counter: completing settles the check.
  const isOpenTableCheck = Boolean(order.sessionId);
  if (status === "completed" && !isOpenTableCheck) {
    await markStandaloneOrderPaidIfNeeded(orderId, {
      total: order.total,
      paymentStatus: order.paymentStatus,
    });
  }

  let pointsAwarded: number | null = null;
  // Loyalty for table sessions is awarded on session close, not kitchen complete.
  if (status === "completed" && !isOpenTableCheck) {
    try {
      const loyalty = await awardLoyaltyPointsForCompletedOrder(orderId);
      if (loyalty.ok && loyalty.awarded > 0) {
        pointsAwarded = loyalty.awarded;
      }
    } catch (error) {
      console.error("[updateOrderStatusByOrderId] loyalty award failed", orderId, error);
    }
  }

  // Guest closed-tab pushes (idempotent per event). Fire-and-forget.
  void (async () => {
    try {
      if (status === "preparing") {
        const etaMinutes =
          options.estimatedReadyAt instanceof Date
            ? Math.max(
                1,
                Math.round((options.estimatedReadyAt.getTime() - Date.now()) / 60_000),
              )
            : null;
        await notifyGuestOrderAccepted({
          orderId,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          etaMinutes,
        });
      } else if (status === "ready") {
        await notifyGuestOrderReady({
          orderId,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
        });
      } else if (status === "completed" && !isOpenTableCheck) {
        await notifyGuestOrderCompleted({
          orderId,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          pointsAwarded,
        });
      }
    } catch (error) {
      console.error("[updateOrderStatusByOrderId] guest push failed", orderId, error);
    }
  })();

  return { ok: true, orderId };
}

/**
 * When a standalone/counter order is completed, treat the check as settled (cash)
 * unless it was already paid or refunded.
 */
async function markStandaloneOrderPaidIfNeeded(
  orderId: string,
  snapshot: { total: string | number | null; paymentStatus: string | null },
): Promise<void> {
  if (snapshot.paymentStatus === "paid" || snapshot.paymentStatus === "refunded") {
    return;
  }

  const existingPayments = await db.query.payments.findMany({
    where: and(eq(paymentsTable.orderId, orderId), eq(paymentsTable.status, "completed")),
    columns: { amount: true },
  });
  const totalPaid = existingPayments.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
  const orderTotal = parseFloat(String(snapshot.total ?? 0)) || 0;
  const remaining = Math.max(0, Math.round((orderTotal - totalPaid) * 100) / 100);
  const now = new Date();

  if (remaining > 0) {
    await db.insert(paymentsTable).values({
      orderId,
      amount: remaining.toFixed(2),
      tipAmount: "0.00",
      method: "cash",
      status: "completed",
      paidAt: now,
    });
  }

  await db
    .update(ordersTable)
    .set({ paymentStatus: "paid", updatedAt: now })
    .where(eq(ordersTable.id, orderId));
}

export type AddPaymentToOrderInput = {
  amount: number;
  tipAmount?: number;
  method: string;
  provider?: string | null;
  providerTransactionId?: string | null;
  providerResponse?: unknown;
};

export async function addPaymentToOrder(
  orderId: string,
  input: AddPaymentToOrderInput
): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  const order = await db.query.orders.findFirst({
    where: eq(ordersTable.id, orderId),
    columns: { id: true, locationId: true, total: true, tipAmount: true },
  });
  if (!order) return { ok: false, error: "Order not found" };
  const location = await verifyLocationAccess(order.locationId);
  if (!location) return { ok: false, error: "Unauthorized" };

  const now = new Date();
  const [payment] = await db
    .insert(paymentsTable)
    .values({
      orderId,
      amount: input.amount.toFixed(2),
      tipAmount: (input.tipAmount ?? 0).toFixed(2),
      method: input.method as any,
      provider: input.provider ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      providerResponse: input.providerResponse ?? null,
      status: "completed",
      paidAt: now,
    })
    .returning({ id: paymentsTable.id });
  if (!payment?.id) return { ok: false, error: "Failed to insert payment" };

  const allPayments = await db.query.payments.findMany({
    where: and(eq(paymentsTable.orderId, orderId), eq(paymentsTable.status, "completed")),
    columns: { amount: true },
  });
  const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const orderTotal = parseFloat(order.total);
  let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
  if (totalPaid >= orderTotal) paymentStatus = "paid";
  else if (totalPaid > 0) paymentStatus = "partial";

  const newTipAmount = parseFloat(order.tipAmount) + (input.tipAmount ?? 0);
  await db
    .update(ordersTable)
    .set({
      paymentStatus: paymentStatus as any,
      tipAmount: newTipAmount.toFixed(2),
      updatedAt: now,
    })
    .where(eq(ordersTable.id, orderId));

  return { ok: true, paymentId: payment.id };
}

export async function updatePaymentStatus(
  paymentId: string,
  status: string
): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  const payment = await db.query.payments.findFirst({
    where: eq(paymentsTable.id, paymentId),
    with: { order: { columns: { id: true, locationId: true, total: true } } },
    columns: { id: true, orderId: true, paidAt: true },
  });
  if (!payment) return { ok: false, error: "Payment not found" };
  if (!payment.order) return { ok: false, error: "Payment order not found" };

  const relatedOrderId = payment.order.id ?? payment.orderId;
  if (!relatedOrderId) {
    return { ok: false, error: "Payment is not linked to an order" };
  }

  const location = await verifyLocationAccess(payment.order.locationId);
  if (!location) return { ok: false, error: "Unauthorized or location not found" };

  const updateData: Record<string, unknown> = { status };
  if (status === "completed" && !payment.paidAt) updateData.paidAt = new Date();
  if (status === "refunded") updateData.refundedAt = new Date();

  await db.update(paymentsTable).set(updateData as any).where(eq(paymentsTable.id, paymentId));

  const allPayments = await db.query.payments.findMany({
    where: and(eq(paymentsTable.orderId, relatedOrderId), eq(paymentsTable.status, "completed")),
    columns: { amount: true },
  });
  const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const orderTotal = parseFloat(payment.order.total);
  let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
  if (totalPaid >= orderTotal) paymentStatus = "paid";
  else if (totalPaid > 0) paymentStatus = "partial";

  await db
    .update(ordersTable)
    .set({ paymentStatus: paymentStatus as any, updatedAt: new Date() })
    .where(eq(ordersTable.id, relatedOrderId));

  return { ok: true, paymentId };
}
