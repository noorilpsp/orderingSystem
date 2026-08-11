import { db } from "@/db";
import { sessionEvents as sessionEventsTable } from "@/lib/db/schema/orders";
import { updateTableMutation } from "@/domain/table-mutations";
import { emit } from "@/domain/emitter";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import { ensureGuestTableSession } from "@/lib/public-menu/ensureGuestTableSession";
import { resolveGuestSessionMode } from "@/lib/public-menu/guestSessionMode";
import { findTableByNumber } from "@/lib/public-menu/tableSession";
import type { StoreAlertType } from "@/store/types";

export type TableServiceRequestType = "waiter" | "bill";

export type RequestTableServiceInput = {
  storeSlug: string;
  tableNumber: string;
  requestType: TableServiceRequestType;
};

export type RequestTableServiceResult =
  | { ok: true; tableId: string; sessionId: string; deduplicated?: boolean }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN"; message: string };

const WAITER_ALERT: StoreAlertType = "waiting";

function mergeAlert(
  existing: string[] | null | undefined,
  alert: StoreAlertType,
): StoreAlertType[] {
  const current = Array.isArray(existing) ? [...existing] : [];
  if (!current.includes(alert)) current.push(alert);
  return current;
}

async function recordGuestServiceEvent(
  sessionId: string,
  requestType: TableServiceRequestType,
  tableNumber: string,
): Promise<void> {
  await db.insert(sessionEventsTable).values({
    sessionId,
    type: requestType === "bill" ? "bill_requested" : "kitchen_delay",
    actorType: "customer",
    meta: {
      source: "guest_menu",
      guestRequest: requestType,
      tableNumber,
      notifiedAt: new Date().toISOString(),
    },
  });
}

export async function requestTableService(
  input: RequestTableServiceInput,
): Promise<RequestTableServiceResult> {
  const normalizedSlug = input.storeSlug.trim().toLowerCase();
  const tableNumber = input.tableNumber.trim();

  if (!tableNumber) {
    return { ok: false, code: "BAD_REQUEST", message: "Table number is required" };
  }

  const location = await resolvePublicLocationBySlug(normalizedSlug);
  if (!location?.storeSlug) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }
  if (location.status !== "active") {
    return { ok: false, code: "FORBIDDEN", message: "This store is not accepting requests" };
  }

  const tableSession = await ensureGuestTableSession({
    locationId: location.id,
    tableNumber,
    guestSessionMode: resolveGuestSessionMode(location.orderModes),
  });
  if (!tableSession.ok) {
    return {
      ok: false,
      code: tableSession.code,
      message: tableSession.message,
    };
  }

  const tableRow = await findTableByNumber(location.id, tableSession.tableNumber);
  const existingAlerts = tableRow?.alerts ?? [];
  const alreadyWaiting = existingAlerts.includes(WAITER_ALERT);
  const alreadyBillRequested = tableRow?.stage === "bill";

  if (input.requestType === "waiter" && alreadyWaiting) {
    return {
      ok: true,
      tableId: tableSession.tableId,
      sessionId: tableSession.sessionId,
      deduplicated: true,
    };
  }

  if (input.requestType === "bill" && alreadyBillRequested) {
    return {
      ok: true,
      tableId: tableSession.tableId,
      sessionId: tableSession.sessionId,
      deduplicated: true,
    };
  }

  const patch =
    input.requestType === "bill"
      ? { stage: "bill" as const }
      : { alerts: mergeAlert(existingAlerts, WAITER_ALERT) };

  const updateResult = await updateTableMutation(location.id, tableSession.tableId, patch);
  if (!updateResult.ok) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "Failed to update table status",
    };
  }

  await recordGuestServiceEvent(
    tableSession.sessionId,
    input.requestType,
    tableSession.tableNumber,
  );

  void emit({
    type: "table.service_requested",
    payload: {
      locationId: location.id,
      tableId: tableSession.tableId,
      sessionId: tableSession.sessionId,
      tableNumber: tableSession.tableNumber,
      requestType: input.requestType,
    },
  });

  return {
    ok: true,
    tableId: tableSession.tableId,
    sessionId: tableSession.sessionId,
  };
}
