import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionEvents as sessionEventsTable, tables as tablesTable } from "@/lib/db/schema/orders";
import { updateTableMutation } from "@/domain/table-mutations";
import { emit } from "@/domain/emitter";
import { findOpenSessionForTableId } from "@/lib/public-menu/tableSession";
import type { StoreAlertType } from "@/store/types";

const WAITER_ALERT: StoreAlertType = "waiting";

export type AcknowledgeServiceType = "waiter" | "bill";

export type AcknowledgeTableServiceResult =
  | { ok: true; tableId: string; sessionId: string | null; alreadyHandled?: boolean }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST"; message: string };

export function hasWaiterRequestAlert(
  alerts: string[] | null | undefined,
): boolean {
  return Array.isArray(alerts) && alerts.includes(WAITER_ALERT);
}

export function hasBillRequest(stage: string | null | undefined): boolean {
  return stage === "bill";
}

function removeAlert(
  existing: string[] | null | undefined,
  alert: StoreAlertType,
): StoreAlertType[] {
  const current = Array.isArray(existing) ? [...existing] : [];
  return current.filter((value) => value !== alert);
}

export async function acknowledgeTableService(
  locationId: string,
  tableId: string,
  requestType: AcknowledgeServiceType = "waiter",
): Promise<AcknowledgeTableServiceResult> {
  const tableRow = await db.query.tables.findFirst({
    where: and(eq(tablesTable.locationId, locationId), eq(tablesTable.id, tableId)),
    columns: { id: true, tableNumber: true, alerts: true, stage: true },
  });
  if (!tableRow) {
    return { ok: false, code: "NOT_FOUND", message: "Table not found" };
  }

  const session = await findOpenSessionForTableId(locationId, tableRow.id);

  if (requestType === "bill") {
    if (!hasBillRequest(tableRow.stage)) {
      return {
        ok: true,
        tableId: tableRow.id,
        sessionId: session?.sessionId ?? null,
        alreadyHandled: true,
      };
    }

    const updateResult = await updateTableMutation(locationId, tableRow.id, { stage: null });
    if (!updateResult.ok) {
      return { ok: false, code: "BAD_REQUEST", message: "Failed to update table" };
    }

    if (session) {
      await db.insert(sessionEventsTable).values({
        sessionId: session.sessionId,
        type: "bill_requested",
        actorType: "server",
        meta: {
          source: "floor_map",
          action: "service_acknowledged",
          guestRequest: "bill",
          tableNumber: tableRow.tableNumber,
          acknowledgedAt: new Date().toISOString(),
        },
      });
    }

    void emit({
      type: "table.service_acknowledged",
      payload: {
        locationId,
        tableId: tableRow.id,
        sessionId: session?.sessionId ?? null,
        tableNumber: tableRow.tableNumber,
        requestType: "bill",
      },
    });

    return {
      ok: true,
      tableId: tableRow.id,
      sessionId: session?.sessionId ?? null,
    };
  }

  const existingAlerts = Array.isArray(tableRow.alerts)
    ? (tableRow.alerts as StoreAlertType[])
    : [];

  if (!hasWaiterRequestAlert(existingAlerts)) {
    return {
      ok: true,
      tableId: tableRow.id,
      sessionId: session?.sessionId ?? null,
      alreadyHandled: true,
    };
  }

  const updateResult = await updateTableMutation(locationId, tableRow.id, {
    alerts: removeAlert(existingAlerts, WAITER_ALERT),
  });
  if (!updateResult.ok) {
    return { ok: false, code: "BAD_REQUEST", message: "Failed to update table" };
  }

  if (session) {
    await db.insert(sessionEventsTable).values({
      sessionId: session.sessionId,
      type: "kitchen_delay",
      actorType: "server",
      meta: {
        source: "floor_map",
        action: "service_acknowledged",
        guestRequest: "waiter",
        tableNumber: tableRow.tableNumber,
        acknowledgedAt: new Date().toISOString(),
      },
    });
  }

  void emit({
    type: "table.service_acknowledged",
    payload: {
      locationId,
      tableId: tableRow.id,
      sessionId: session?.sessionId ?? null,
      tableNumber: tableRow.tableNumber,
      requestType: "waiter",
    },
  });

  return {
    ok: true,
    tableId: tableRow.id,
    sessionId: session?.sessionId ?? null,
  };
}
