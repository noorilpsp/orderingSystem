"use server";

import { eq, and, desc, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  tables as tablesTable,
  sessions as sessionsTable,
  sessionEvents as sessionEventsTable,
} from "@/lib/db/schema/orders";
import { verifyLocationAccess } from "@/lib/location-access";
import { withDbRetry } from "@/lib/db/withDbRetry";
import { updateTableMutation } from "@/domain/table-mutations";
import { isValidUuid } from "@/lib/resolveTableUuid";
import { recordSessionEventWithSource } from "@/app/actions/session-events";
import type { StoreTable } from "@/store/types";

/**
 * Map DB table row to StoreTable
 */
function mapTableRowToStoreTable(row: {
  id: string;
  displayId?: string | null;
  tableNumber: string;
  seats: number | null;
  status: string;
  section: string | null;
  shape: string | null;
  position: unknown;
  width: number | null;
  height: number | null;
  rotation: number | null;
  guests: number | null;
  serverId: string | null;
  seatedAt: Date | null;
  stage: string | null;
  alerts: unknown;
}): StoreTable {
  const pos = row.position as { x?: number; y?: number } | null;
  const alerts = row.alerts as string[] | null;
  // Parse "T1", "T2" or "1", "2" format for display number
  const numMatch = row.tableNumber.match(/^[A-Za-z]*(\d+)$/);
  const num = numMatch ? parseInt(numMatch[1], 10) : parseInt(row.tableNumber, 10) || 1;
  // Use DB UUID as real identity; number is for UI display only
  const id = row.id;

  return {
    id,
    number: num,
    section: (row.section as StoreTable["section"]) ?? "main",
    capacity: row.seats ?? 4,
    status: mapDbStatusToStoreStatus(row.status),
    shape: (row.shape as StoreTable["shape"]) ?? "square",
    position: pos && typeof pos.x === "number" && typeof pos.y === "number"
      ? { x: pos.x, y: pos.y }
      : { x: 0, y: 0 },
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    rotation: row.rotation ?? undefined,
    guests: row.guests ?? undefined,
    serverId: row.serverId ?? undefined,
    seatedAt: row.seatedAt ? row.seatedAt.toISOString() : undefined,
    stage: (row.stage as StoreTable["stage"]) ?? undefined,
    alerts: alerts && Array.isArray(alerts) ? (alerts as StoreTable["alerts"]) : undefined,
  };
}

function mapDbStatusToStoreStatus(
  dbStatus: string
): StoreTable["status"] {
  const map: Record<string, StoreTable["status"]> = {
    available: "free",
    occupied: "active",
    reserved: "reserved",
    unavailable: "closed",
    cleaning: "cleaning",
  };
  return map[dbStatus] ?? "free";
}

/** Minutes after session close that table is considered "cleaning". */
const CLEANING_WINDOW_MINUTES = 5;

function cleaningWindowSql() {
  return sql`${sessionsTable.closedAt} >= now() - interval '${sql.raw(String(CLEANING_WINDOW_MINUTES))} minutes'`;
}

async function getCleanedSessionIds(sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const rows = await db
    .select({ sessionId: sessionEventsTable.sessionId })
    .from(sessionEventsTable)
    .where(
      and(
        inArray(sessionEventsTable.sessionId, sessionIds),
        eq(sessionEventsTable.type, "table_cleaned")
      )
    );
  return new Set(rows.map((row) => row.sessionId));
}

export type ComputedTableStatus = "available" | "occupied" | "cleaning";

/**
 * Derive table status from sessions. Does not use tables.status.
 * - No open session → available
 * - Open session → occupied
 * - Session closed within last CLEANING_WINDOW_MINUTES → cleaning
 * - Cleaning finished → available
 */
export async function computeTableStatus(tableId: string): Promise<ComputedTableStatus> {
  const openSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.tableId, tableId),
      eq(sessionsTable.status, "open")
    ),
    columns: { id: true },
  });
  if (openSession) return "occupied";

  const recentlyClosed = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.tableId, tableId),
        eq(sessionsTable.status, "closed"),
        cleaningWindowSql()
      )
    )
    .orderBy(desc(sessionsTable.closedAt))
    .limit(1);
  if (recentlyClosed.length === 0) return "available";

  const cleanedSessionIds = await getCleanedSessionIds([recentlyClosed[0].id]);
  if (cleanedSessionIds.has(recentlyClosed[0].id)) return "available";

  return "cleaning";
}

/** Batch: derive status from sessions for many tables. Used by getTablesForLocation/getTablesForFloorPlan and API routes. */
export async function getComputedStatusesForTables(
  locationId: string
): Promise<Map<string, ComputedTableStatus>> {
  const [openSessions, recentlyClosedSessions] = await Promise.all([
    db.query.sessions.findMany({
      where: and(
        eq(sessionsTable.locationId, locationId),
        eq(sessionsTable.status, "open")
      ),
      columns: { tableId: true },
    }),
    db
      .select({
        id: sessionsTable.id,
        tableId: sessionsTable.tableId,
        closedAt: sessionsTable.closedAt,
      })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.locationId, locationId),
          eq(sessionsTable.status, "closed"),
          cleaningWindowSql()
        )
      )
      .orderBy(desc(sessionsTable.closedAt)),
  ]);

  const openTableIds = new Set(openSessions.map((s) => s.tableId));
  const latestClosedByTable = new Map<string, string>();
  for (const session of recentlyClosedSessions) {
    if (!latestClosedByTable.has(session.tableId)) {
      latestClosedByTable.set(session.tableId, session.id);
    }
  }
  const cleanedSessionIds = await getCleanedSessionIds([
    ...latestClosedByTable.values(),
  ]);

  const result = new Map<string, ComputedTableStatus>();
  for (const s of openSessions) {
    result.set(s.tableId, "occupied");
  }
  for (const [tableId, sessionId] of latestClosedByTable) {
    if (!openTableIds.has(tableId) && !cleanedSessionIds.has(sessionId)) {
      result.set(tableId, "cleaning");
    }
  }
  return result;
}

/**
 * Mark a table as available after cleaning by recording table_cleaned on the
 * most recent closed session within the cleaning window.
 */
export async function markTableCleaningDone(
  locationId: string,
  tableId: string
): Promise<{ ok: boolean; error?: string }> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    return { ok: false, error: "Unauthorized or location not found" };
  }

  const tableRow = await db.query.tables.findFirst({
    where: and(eq(tablesTable.locationId, locationId), eq(tablesTable.id, tableId)),
    columns: { id: true },
  });
  if (!tableRow) {
    return { ok: false, error: "Table not found" };
  }

  const recentSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.locationId, locationId),
      eq(sessionsTable.tableId, tableId),
      eq(sessionsTable.status, "closed"),
      cleaningWindowSql()
    ),
    orderBy: [desc(sessionsTable.closedAt)],
    columns: { id: true },
  });
  if (!recentSession) {
    return { ok: false, error: "Table is not in cleaning state" };
  }

  const cleanedSessionIds = await getCleanedSessionIds([recentSession.id]);
  if (cleanedSessionIds.has(recentSession.id)) {
    return { ok: true };
  }

  const eventResult = await recordSessionEventWithSource(
    locationId,
    recentSession.id,
    "table_cleaned",
    "api"
  );
  if (!eventResult.ok) {
    return { ok: false, error: eventResult.error ?? "Failed to mark table available" };
  }

  return { ok: true };
}

export async function getTablesForLocation(
  locationId: string
): Promise<StoreTable[]> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    throw new Error("Unauthorized or location not found");
  }

  const [rows, computedStatuses] = await Promise.all([
    db.query.tables.findMany({
      where: eq(tablesTable.locationId, locationId),
      orderBy: [desc(tablesTable.createdAt)],
    }),
    getComputedStatusesForTables(locationId),
  ]);

  return rows.map((r) => {
    const status = computedStatuses.get(r.id) ?? "available";
    return mapTableRowToStoreTable({
      ...r,
      status,
      position: r.position,
      alerts: r.alerts,
    });
  });
}

/** Internal: get tables for a floor plan. Caller must have validated access. */
export async function getTablesForFloorPlanTrusted(
  locationId: string,
  floorPlanId: string
): Promise<StoreTable[]> {
  return withDbRetry(async () => {
    const [rows, computedStatuses] = await Promise.all([
      db.query.tables.findMany({
        where: and(
          eq(tablesTable.locationId, locationId),
          eq(tablesTable.floorPlanId, floorPlanId)
        ),
        orderBy: [desc(tablesTable.createdAt)],
      }),
      getComputedStatusesForTables(locationId),
    ]);

    return rows.map((r) => {
      const status = computedStatuses.get(r.id) ?? "available";
      return mapTableRowToStoreTable({
        ...r,
        status,
        position: r.position,
        alerts: r.alerts,
      });
    });
  });
}

/** Get tables for a specific floor plan from DB. Status derived from sessions via computeTableStatus. */
export async function getTablesForFloorPlan(
  locationId: string,
  floorPlanId: string
): Promise<StoreTable[]> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    throw new Error("Unauthorized or location not found");
  }

  return getTablesForFloorPlanTrusted(locationId, floorPlanId);
}

/** Update table status, guests, seatedAt, stage, alerts in DB. These are denormalized from session for quick reads; canonical state is in sessions. */
export async function updateTable(
  locationId: string,
  tableId: string,
  patch: {
    status?: StoreTable["status"];
    guests?: number;
    seatedAt?: string | null;
    stage?: StoreTable["stage"] | null;
    alerts?: StoreTable["alerts"];
  }
): Promise<{ ok: boolean; error?: string }> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    return { ok: false, error: "Unauthorized or location not found" };
  }

  const rows = await db.query.tables.findMany({
    where: isValidUuid(tableId)
      ? and(eq(tablesTable.locationId, locationId), eq(tablesTable.id, tableId))
      : and(
          eq(tablesTable.locationId, locationId),
          or(
            ilike(tablesTable.tableNumber, tableId),
            ilike(tablesTable.displayId, tableId)
          )
        ),
    columns: { id: true },
    limit: 1,
  });
  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Table not found" };
  }

  const result = await updateTableMutation(locationId, row.id, {
    status: patch.status,
    guests: patch.guests,
    seatedAt: patch.seatedAt,
    stage: patch.stage ?? null,
    alerts: patch.alerts,
  });
  if (!result.ok) {
    if (result.reason === "table_not_found") {
      return { ok: false, error: "Table not found" };
    }
    if (result.reason === "invalid_status") {
      return { ok: false, error: "Invalid table status" };
    }
    return { ok: false, error: "Failed to update table" };
  }

  return { ok: true };
}
