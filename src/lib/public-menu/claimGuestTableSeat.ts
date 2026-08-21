import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { guestSeatClaims } from "@/lib/db/schema/guest-seat-claims";
import {
  orderItems as orderItemsTable,
  orders as ordersTable,
  seats as seatsTable,
  sessions as sessionsTable,
  tables as tablesTable,
} from "@/lib/db/schema/orders";
import { withTx } from "@/domain/tx";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import { ensureGuestTableSession } from "@/lib/public-menu/ensureGuestTableSession";
import { resolveGuestSessionMode } from "@/lib/public-menu/guestSessionMode";

export type GuestSeatAssignment = {
  sessionId: string;
  tableId: string;
  tableNumber: string;
  seatId: string;
  seatNumber: number;
  guestName: string | null;
};

export type GuestSeatMutationResult =
  | { ok: true; data: GuestSeatAssignment }
  | { ok: false; code: string; message: string };

/** Soft (no-order) seat claims expire after this TTL so walk-away scanners don't burn S1. */
export const SOFT_SEAT_CLAIM_TTL_MS = 10 * 60 * 1000;

const DEVICE_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DbOrTx = typeof db;

function normalizeDeviceId(deviceId: string): string | null {
  const trimmed = deviceId.trim();
  return DEVICE_ID_REGEX.test(trimmed) ? trimmed : null;
}

/**
 * Release soft seat claims older than {@link SOFT_SEAT_CLAIM_TTL_MS}.
 * Soft = claim with no non-voided order items on that seat.
 * If any claims were released and the session then has no orders and no claims, close it.
 */
export async function releaseExpiredSoftSeatClaims(
  sessionId: string,
  dbOrTx: DbOrTx = db,
): Promise<{ releasedSeatIds: string[]; sessionClosed: boolean }> {
  const session = await dbOrTx.query.sessions.findFirst({
    where: and(eq(sessionsTable.id, sessionId), eq(sessionsTable.status, "open")),
    columns: { id: true },
  });
  if (!session) {
    return { releasedSeatIds: [], sessionClosed: false };
  }

  const claims = await dbOrTx.query.guestSeatClaims.findMany({
    where: eq(guestSeatClaims.sessionId, sessionId),
    columns: { id: true, seatId: true, createdAt: true },
  });
  if (claims.length === 0) {
    return { releasedSeatIds: [], sessionClosed: false };
  }

  const cutoffMs = Date.now() - SOFT_SEAT_CLAIM_TTL_MS;
  const expiredClaims = claims.filter(
    (claim) => claim.createdAt.getTime() < cutoffMs,
  );
  if (expiredClaims.length === 0) {
    return { releasedSeatIds: [], sessionClosed: false };
  }

  const expiredSeatIds = [...new Set(expiredClaims.map((claim) => claim.seatId))];
  const activeItemRows =
    expiredSeatIds.length > 0
      ? await dbOrTx
          .selectDistinct({ seatId: orderItemsTable.seatId })
          .from(orderItemsTable)
          .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
          .where(
            and(
              inArray(orderItemsTable.seatId, expiredSeatIds),
              isNull(orderItemsTable.voidedAt),
              ne(ordersTable.status, "cancelled"),
            ),
          )
      : [];
  const hardSeatIds = new Set(
    activeItemRows
      .map((row) => row.seatId)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  const softExpired = expiredClaims.filter((claim) => !hardSeatIds.has(claim.seatId));
  if (softExpired.length === 0) {
    return { releasedSeatIds: [], sessionClosed: false };
  }

  const releasedSeatIds = [...new Set(softExpired.map((claim) => claim.seatId))];
  const softClaimIds = softExpired.map((claim) => claim.id);
  const now = new Date();

  await dbOrTx
    .delete(guestSeatClaims)
    .where(inArray(guestSeatClaims.id, softClaimIds));

  await dbOrTx
    .update(seatsTable)
    .set({ guestName: null, updatedAt: now })
    .where(
      and(
        eq(seatsTable.sessionId, sessionId),
        inArray(seatsTable.id, releasedSeatIds),
      ),
    );

  const sessionClosed = await closeEmptyGuestSessionIfNeeded(sessionId, dbOrTx);
  return { releasedSeatIds, sessionClosed };
}

/**
 * Close an open guest session that has no non-cancelled orders and no seat claims.
 * Only called after soft-claim expiry actually released something (caller gates that).
 */
async function closeEmptyGuestSessionIfNeeded(
  sessionId: string,
  dbOrTx: DbOrTx = db,
): Promise<boolean> {
  const remainingClaims = await dbOrTx.query.guestSeatClaims.findMany({
    where: eq(guestSeatClaims.sessionId, sessionId),
    columns: { id: true },
    limit: 1,
  });
  if (remainingClaims.length > 0) return false;

  const openOrders = await dbOrTx.query.orders.findMany({
    where: and(
      eq(ordersTable.sessionId, sessionId),
      ne(ordersTable.status, "cancelled"),
    ),
    columns: { id: true },
    limit: 1,
  });
  if (openOrders.length > 0) return false;

  const now = new Date();
  const updated = await dbOrTx
    .update(sessionsTable)
    .set({ status: "closed", closedAt: now, updatedAt: now })
    .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.status, "open")))
    .returning({ id: sessionsTable.id });

  return updated.length > 0;
}

/**
 * Close walk-away table sessions for a location: expire soft seat claims, then
 * close sessions that still have no orders and no remaining claims once they
 * have been idle for {@link SOFT_SEAT_CLAIM_TTL_MS}.
 */
export async function sweepIdleEmptyGuestSessionsForLocation(
  locationId: string,
): Promise<void> {
  const id = locationId.trim();
  if (!id) return;

  const openRows = await db.query.sessions.findMany({
    where: and(eq(sessionsTable.locationId, id), eq(sessionsTable.status, "open")),
    columns: { id: true, openedAt: true },
  });
  if (openRows.length === 0) return;

  const idleCutoffMs = Date.now() - SOFT_SEAT_CLAIM_TTL_MS;
  for (const row of openRows) {
    const expiry = await releaseExpiredSoftSeatClaims(row.id);
    if (expiry.sessionClosed) continue;
    const openedAtMs = row.openedAt?.getTime() ?? 0;
    if (openedAtMs > idleCutoffMs) continue;
    await closeEmptyGuestSessionIfNeeded(row.id);
  }
}

async function loadSeatAssignment(
  sessionId: string,
  seatId: string,
  tableId: string,
  tableNumber: string,
  dbOrTx: DbOrTx = db,
): Promise<GuestSeatAssignment | null> {
  const seat = await dbOrTx.query.seats.findFirst({
    where: and(eq(seatsTable.id, seatId), eq(seatsTable.sessionId, sessionId)),
    columns: { id: true, seatNumber: true, guestName: true, status: true },
  });
  if (!seat || seat.status !== "active") return null;
  return {
    sessionId,
    tableId,
    tableNumber,
    seatId: seat.id,
    seatNumber: seat.seatNumber,
    guestName: seat.guestName ?? null,
  };
}

async function createSeatWithNumber(
  sessionId: string,
  seatNumber: number,
  dbOrTx: DbOrTx,
): Promise<{ id: string; seatNumber: number; guestName: string | null } | null> {
  const now = new Date();
  const existing = await dbOrTx.query.seats.findFirst({
    where: and(
      eq(seatsTable.sessionId, sessionId),
      eq(seatsTable.seatNumber, seatNumber),
    ),
    columns: { id: true, seatNumber: true, guestName: true, status: true },
  });
  if (existing) {
    if (existing.status === "removed") {
      await dbOrTx
        .update(seatsTable)
        .set({ status: "active", updatedAt: now })
        .where(eq(seatsTable.id, existing.id));
    }
    return {
      id: existing.id,
      seatNumber: existing.seatNumber,
      guestName: existing.guestName ?? null,
    };
  }

  const [inserted] = await dbOrTx
    .insert(seatsTable)
    .values({
      sessionId,
      seatNumber,
      status: "active",
      updatedAt: now,
    })
    .returning({
      id: seatsTable.id,
      seatNumber: seatsTable.seatNumber,
      guestName: seatsTable.guestName,
    });

  if (!inserted) return null;
  return {
    id: inserted.id,
    seatNumber: inserted.seatNumber,
    guestName: inserted.guestName ?? null,
  };
}

async function createNextSeat(
  sessionId: string,
  dbOrTx: DbOrTx,
): Promise<{ id: string; seatNumber: number; guestName: string | null } | null> {
  const [maxRow] = await dbOrTx
    .select({
      maxSeat: sql<number>`COALESCE(MAX(${seatsTable.seatNumber}), 0)::int`,
    })
    .from(seatsTable)
    .where(eq(seatsTable.sessionId, sessionId));
  const nextNumber = (maxRow?.maxSeat ?? 0) + 1;
  return createSeatWithNumber(sessionId, nextNumber, dbOrTx);
}

async function findLowestUnclaimedSeat(
  sessionId: string,
  dbOrTx: DbOrTx,
): Promise<{ id: string; seatNumber: number; guestName: string | null } | null> {
  const activeSeats = await dbOrTx.query.seats.findMany({
    where: and(eq(seatsTable.sessionId, sessionId), eq(seatsTable.status, "active")),
    columns: { id: true, seatNumber: true, guestName: true },
    orderBy: [asc(seatsTable.seatNumber)],
  });
  if (activeSeats.length === 0) return null;

  const claims = await dbOrTx.query.guestSeatClaims.findMany({
    where: eq(guestSeatClaims.sessionId, sessionId),
    columns: { seatId: true },
  });
  const claimedSeatIds = new Set(claims.map((claim) => claim.seatId));

  const unclaimed = activeSeats.find((seat) => !claimedSeatIds.has(seat.id));
  if (!unclaimed) return null;

  return {
    id: unclaimed.id,
    seatNumber: unclaimed.seatNumber,
    guestName: unclaimed.guestName ?? null,
  };
}

async function assignSeatToDevice(
  sessionId: string,
  deviceId: string,
  seat: { id: string; seatNumber: number; guestName: string | null },
  dbOrTx: DbOrTx,
): Promise<void> {
  await dbOrTx.insert(guestSeatClaims).values({
    sessionId,
    deviceId,
    seatId: seat.id,
  });
}

export async function claimGuestTableSeat(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
}): Promise<GuestSeatMutationResult> {
  const storeSlug = input.storeSlug.trim().toLowerCase();
  const tableNumber = input.tableNumber.trim();
  const deviceId = normalizeDeviceId(input.deviceId);

  if (!storeSlug) {
    return { ok: false, code: "BAD_REQUEST", message: "storeSlug is required" };
  }
  if (!tableNumber) {
    return { ok: false, code: "BAD_REQUEST", message: "tableNumber is required" };
  }
  if (!deviceId) {
    return { ok: false, code: "BAD_REQUEST", message: "A valid deviceId is required" };
  }

  const location = await resolvePublicLocationBySlug(storeSlug);
  if (!location?.storeSlug) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }
  if (!location.enableOnlineOrders) {
    return { ok: false, code: "FORBIDDEN", message: "Online ordering is disabled for this store" };
  }
  if (location.status !== "active") {
    return { ok: false, code: "FORBIDDEN", message: "This store is not accepting orders" };
  }

  const tableSession = await ensureGuestTableSession({
    locationId: location.id,
    tableNumber,
    guestSessionMode: resolveGuestSessionMode(location.orderModes),
  });
  if (!tableSession.ok) {
    return { ok: false, code: tableSession.code, message: tableSession.message };
  }

  let sessionId = tableSession.sessionId;
  let tableId = tableSession.tableId;
  let resolvedTableNumber = tableSession.tableNumber;

  const expiry = await releaseExpiredSoftSeatClaims(sessionId);
  if (expiry.sessionClosed) {
    const refreshed = await ensureGuestTableSession({
      locationId: location.id,
      tableNumber,
      guestSessionMode: resolveGuestSessionMode(location.orderModes),
    });
    if (!refreshed.ok) {
      return { ok: false, code: refreshed.code, message: refreshed.message };
    }
    sessionId = refreshed.sessionId;
    tableId = refreshed.tableId;
    resolvedTableNumber = refreshed.tableNumber;
  }

  try {
    return await withTx(async (tx) => {
      const existingClaim = await tx.query.guestSeatClaims.findFirst({
        where: and(
          eq(guestSeatClaims.sessionId, sessionId),
          eq(guestSeatClaims.deviceId, deviceId),
        ),
        columns: { seatId: true },
      });

      if (existingClaim) {
        const assignment = await loadSeatAssignment(
          sessionId,
          existingClaim.seatId,
          tableId,
          resolvedTableNumber,
          tx,
        );
        if (assignment) {
          return { ok: true, data: assignment };
        }
        await tx
          .delete(guestSeatClaims)
          .where(
            and(
              eq(guestSeatClaims.sessionId, sessionId),
              eq(guestSeatClaims.deviceId, deviceId),
            ),
          );
      }

      let seat = await findLowestUnclaimedSeat(sessionId, tx);
      if (!seat) {
        seat = await createNextSeat(sessionId, tx);
      }
      if (!seat) {
        return { ok: false, code: "INTERNAL_ERROR", message: "Unable to assign a seat" };
      }

      await assignSeatToDevice(sessionId, deviceId, seat, tx);

      return {
        ok: true,
        data: {
          sessionId,
          tableId,
          tableNumber: resolvedTableNumber,
          seatId: seat.id,
          seatNumber: seat.seatNumber,
          guestName: seat.guestName,
        },
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to claim seat";
    if (message.includes("guest_seat_claims_session_seat_key")) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "That seat was just taken. Please try again.",
      };
    }
    throw error;
  }
}

export async function changeGuestTableSeat(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
  targetSeatNumber?: number;
}): Promise<GuestSeatMutationResult> {
  const claimResult = await claimGuestTableSeat({
    storeSlug: input.storeSlug,
    tableNumber: input.tableNumber,
    deviceId: input.deviceId,
  });
  if (!claimResult.ok) return claimResult;

  const deviceId = normalizeDeviceId(input.deviceId);
  if (!deviceId) {
    return { ok: false, code: "BAD_REQUEST", message: "A valid deviceId is required" };
  }

  const sessionId = claimResult.data.sessionId;
  const currentSeatId = claimResult.data.seatId;

  try {
    return await withTx(async (tx) => {
      let targetSeat: { id: string; seatNumber: number; guestName: string | null } | null = null;

      if (
        typeof input.targetSeatNumber === "number" &&
        Number.isFinite(input.targetSeatNumber) &&
        input.targetSeatNumber >= 1
      ) {
        const seatNumber = Math.floor(input.targetSeatNumber);
        const seatRow = await createSeatWithNumber(sessionId, seatNumber, tx);
        if (!seatRow) {
          return { ok: false, code: "INTERNAL_ERROR", message: "Unable to create seat" };
        }

        const existingClaim = await tx.query.guestSeatClaims.findFirst({
          where: and(
            eq(guestSeatClaims.sessionId, sessionId),
            eq(guestSeatClaims.seatId, seatRow.id),
          ),
          columns: { deviceId: true },
        });
        if (existingClaim && existingClaim.deviceId !== deviceId) {
          return {
            ok: false,
            code: "CONFLICT",
            message: `Seat ${seatNumber} is already in use`,
          };
        }
        targetSeat = seatRow;
      } else {
        targetSeat = await findLowestUnclaimedSeat(sessionId, tx);
        if (!targetSeat) {
          targetSeat = await createNextSeat(sessionId, tx);
        }
      }

      if (!targetSeat) {
        return { ok: false, code: "INTERNAL_ERROR", message: "Unable to change seat" };
      }

      if (targetSeat.id === currentSeatId) {
        return { ok: true, data: claimResult.data };
      }

      await tx
        .delete(guestSeatClaims)
        .where(
          and(
            eq(guestSeatClaims.sessionId, sessionId),
            eq(guestSeatClaims.deviceId, deviceId),
          ),
        );

      const taken = await tx.query.guestSeatClaims.findFirst({
        where: and(
          eq(guestSeatClaims.sessionId, sessionId),
          eq(guestSeatClaims.seatId, targetSeat.id),
        ),
        columns: { id: true },
      });
      if (taken) {
        return {
          ok: false,
          code: "CONFLICT",
          message: `Seat ${targetSeat.seatNumber} is already in use`,
        };
      }

      await assignSeatToDevice(sessionId, deviceId, targetSeat, tx);

      return {
        ok: true,
        data: {
          sessionId,
          tableId: claimResult.data.tableId,
          tableNumber: claimResult.data.tableNumber,
          seatId: targetSeat.id,
          seatNumber: targetSeat.seatNumber,
          guestName: targetSeat.guestName,
        },
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to change seat";
    if (message.includes("guest_seat_claims_session_seat_key")) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "That seat was just taken. Please try another.",
      };
    }
    throw error;
  }
}

export async function listGuestTableSeats(input: {
  storeSlug: string;
  tableNumber: string;
}): Promise<
  | {
      ok: true;
      seats: Array<{ seatNumber: number; seatId: string; claimed: boolean; guestName: string | null }>;
    }
  | { ok: false; code: string; message: string }
> {
  const storeSlug = input.storeSlug.trim().toLowerCase();
  const tableNumber = input.tableNumber.trim();
  if (!storeSlug || !tableNumber) {
    return { ok: false, code: "BAD_REQUEST", message: "storeSlug and tableNumber are required" };
  }

  const location = await resolvePublicLocationBySlug(storeSlug);
  if (!location?.storeSlug) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }

  const tableSession = await ensureGuestTableSession({
    locationId: location.id,
    tableNumber,
    guestSessionMode: resolveGuestSessionMode(location.orderModes),
  });
  if (!tableSession.ok) {
    return { ok: false, code: tableSession.code, message: tableSession.message };
  }

  let sessionId = tableSession.sessionId;
  const expiry = await releaseExpiredSoftSeatClaims(sessionId);
  if (expiry.sessionClosed) {
    const refreshed = await ensureGuestTableSession({
      locationId: location.id,
      tableNumber,
      guestSessionMode: resolveGuestSessionMode(location.orderModes),
    });
    if (!refreshed.ok) {
      return { ok: false, code: refreshed.code, message: refreshed.message };
    }
    sessionId = refreshed.sessionId;
  }

  const activeSeats = await db.query.seats.findMany({
    where: and(
      eq(seatsTable.sessionId, sessionId),
      eq(seatsTable.status, "active"),
    ),
    columns: { id: true, seatNumber: true, guestName: true },
    orderBy: [asc(seatsTable.seatNumber)],
  });

  const claims = await db.query.guestSeatClaims.findMany({
    where: eq(guestSeatClaims.sessionId, sessionId),
    columns: { seatId: true },
  });
  const claimedSeatIds = new Set(claims.map((claim) => claim.seatId));

  return {
    ok: true,
    seats: activeSeats.map((seat) => ({
      seatId: seat.id,
      seatNumber: seat.seatNumber,
      guestName: seat.guestName ?? null,
      claimed: claimedSeatIds.has(seat.id),
    })),
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateGuestSeatName(input: {
  storeSlug: string;
  seatId: string;
  deviceId: string;
  guestName?: string | null;
}): Promise<GuestSeatMutationResult> {
  const storeSlug = input.storeSlug.trim().toLowerCase();
  const seatId = input.seatId.trim();
  const deviceId = normalizeDeviceId(input.deviceId);

  if (!storeSlug) {
    return { ok: false, code: "BAD_REQUEST", message: "storeSlug is required" };
  }
  if (!UUID_REGEX.test(seatId)) {
    return { ok: false, code: "BAD_REQUEST", message: "A valid seatId is required" };
  }
  if (!deviceId) {
    return { ok: false, code: "BAD_REQUEST", message: "A valid deviceId is required" };
  }

  const location = await resolvePublicLocationBySlug(storeSlug);
  if (!location?.storeSlug) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }

  const normalizedName = (input.guestName ?? "").trim().slice(0, 255) || null;

  const claim = await db.query.guestSeatClaims.findFirst({
    where: and(eq(guestSeatClaims.seatId, seatId), eq(guestSeatClaims.deviceId, deviceId)),
    columns: { sessionId: true, seatId: true },
  });
  if (!claim) {
    return { ok: false, code: "FORBIDDEN", message: "You can only update your own seat" };
  }

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.id, claim.sessionId),
      eq(sessionsTable.locationId, location.id),
      eq(sessionsTable.status, "open"),
    ),
    columns: { id: true, tableId: true },
  });
  if (!session?.tableId) {
    return { ok: false, code: "NOT_FOUND", message: "Session not found or closed" };
  }

  const tableRow = await db.query.tables.findFirst({
    where: eq(tablesTable.id, session.tableId),
    columns: { tableNumber: true },
  });

  const now = new Date();
  const [updated] = await db
    .update(seatsTable)
    .set({ guestName: normalizedName, updatedAt: now })
    .where(and(eq(seatsTable.id, seatId), eq(seatsTable.sessionId, claim.sessionId)))
    .returning({
      id: seatsTable.id,
      seatNumber: seatsTable.seatNumber,
      guestName: seatsTable.guestName,
    });

  if (!updated) {
    return { ok: false, code: "NOT_FOUND", message: "Seat not found" };
  }

  return {
    ok: true,
    data: {
      sessionId: claim.sessionId,
      tableId: session.tableId,
      tableNumber: tableRow?.tableNumber ?? "",
      seatId: updated.id,
      seatNumber: updated.seatNumber,
      guestName: updated.guestName ?? null,
    },
  };
}

export async function validateGuestSeatForOrder(input: {
  locationId: string;
  sessionId: string;
  seatId: string;
  deviceId?: string;
}): Promise<
  | { ok: true; seatNumber: number }
  | { ok: false; code: string; message: string }
> {
  const seatId = input.seatId.trim();
  if (!UUID_REGEX.test(seatId)) {
    return { ok: false, code: "BAD_REQUEST", message: "A valid seatId is required" };
  }

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.id, input.sessionId),
      eq(sessionsTable.locationId, input.locationId),
      eq(sessionsTable.status, "open"),
    ),
    columns: { id: true },
  });
  if (!session) {
    return { ok: false, code: "BAD_REQUEST", message: "Table session not found or closed" };
  }

  const seat = await db.query.seats.findFirst({
    where: and(
      eq(seatsTable.id, seatId),
      eq(seatsTable.sessionId, input.sessionId),
      eq(seatsTable.status, "active"),
    ),
    columns: { id: true, seatNumber: true },
  });
  if (!seat) {
    return { ok: false, code: "BAD_REQUEST", message: "Seat not found for this table" };
  }

  if (input.deviceId) {
    const deviceId = normalizeDeviceId(input.deviceId);
    if (!deviceId) {
      return { ok: false, code: "BAD_REQUEST", message: "A valid deviceId is required" };
    }
    const claim = await db.query.guestSeatClaims.findFirst({
      where: and(
        eq(guestSeatClaims.sessionId, input.sessionId),
        eq(guestSeatClaims.seatId, seatId),
        eq(guestSeatClaims.deviceId, deviceId),
      ),
      columns: { id: true },
    });
    if (!claim) {
      return { ok: false, code: "FORBIDDEN", message: "Seat does not belong to this device" };
    }
  }

  return { ok: true, seatNumber: seat.seatNumber };
}
