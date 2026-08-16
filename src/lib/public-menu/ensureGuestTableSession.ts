import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  seats as seatsTable,
  servicePeriods as servicePeriodsTable,
  sessionEvents as sessionEventsTable,
  sessions as sessionsTable,
  tables as tablesTable,
} from "@/lib/db/schema/orders";
import { withTx } from "@/domain/tx";
import type { GuestSessionMode } from "@/lib/guest-menu/types";
import { normalizeFurnitureStatus } from "@/lib/pos/tableStatus";
import {
  findOpenSessionForTable,
  findTableByNumber,
} from "@/lib/public-menu/tableSession";

export type EnsureGuestTableSessionInput = {
  locationId: string;
  tableNumber: string;
  guestSessionMode: GuestSessionMode;
  guestCount?: number;
};

export type EnsureGuestTableSessionResult =
  | {
      ok: true;
      sessionId: string;
      tableId: string;
      tableNumber: string;
      created: boolean;
    }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST"; message: string };

async function getCurrentServicePeriodIdForLocation(
  locationId: string,
): Promise<string | null> {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${hh}:${mm}`;

  const periods = await db.query.servicePeriods.findMany({
    where: eq(servicePeriodsTable.locationId, locationId),
    columns: { id: true, startTime: true, endTime: true },
  });
  for (const period of periods) {
    if (currentTime >= period.startTime && currentTime < period.endTime) {
      return period.id;
    }
  }
  return null;
}

async function ensureSeatsForGuestSession(
  sessionId: string,
  guestCount: number,
  dbOrTx: typeof db = db,
): Promise<void> {
  const targetCount = Math.max(1, Math.floor(guestCount));
  const now = new Date();

  for (let seatNumber = 1; seatNumber <= targetCount; seatNumber++) {
    const existing = await dbOrTx.query.seats.findFirst({
      where: and(
        eq(seatsTable.sessionId, sessionId),
        eq(seatsTable.seatNumber, seatNumber),
      ),
      columns: { id: true, status: true },
    });
    if (!existing) {
      await dbOrTx.insert(seatsTable).values({
        sessionId,
        seatNumber,
        status: "active",
        updatedAt: now,
      });
    } else if (existing.status === "removed") {
      await dbOrTx
        .update(seatsTable)
        .set({ status: "active", updatedAt: now })
        .where(eq(seatsTable.id, existing.id));
    }
  }
}

async function recordGuestSeatedEvent(
  sessionId: string,
  guestCount: number,
  dbOrTx: typeof db = db,
): Promise<void> {
  await dbOrTx.insert(sessionEventsTable).values({
    sessionId,
    type: "guest_seated",
    actorType: "customer",
    meta: {
      source: "guest_menu",
      guestCount,
      seatedAt: new Date().toISOString(),
    },
  });
}

function isUniqueOpenSessionViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "23505" && message.includes("sessions_one_open_per_table");
}

async function createGuestOpenSession(
  locationId: string,
  tableId: string,
  guestCount: number,
): Promise<string> {
  return withTx(async (tx) => {
    const existing = await tx.query.sessions.findFirst({
      where: and(
        eq(sessionsTable.locationId, locationId),
        eq(sessionsTable.tableId, tableId),
        eq(sessionsTable.status, "open"),
      ),
      columns: { id: true },
    });
    if (existing) return existing.id;

    const servicePeriodId = await getCurrentServicePeriodIdForLocation(locationId);
    const now = new Date();

    const [inserted] = await tx
      .insert(sessionsTable)
      .values({
        locationId,
        tableId,
        serverId: null,
        guestCount,
        status: "open",
        source: "qr",
        servicePeriodId: servicePeriodId ?? undefined,
        updatedAt: now,
      })
      .returning({ id: sessionsTable.id });

    if (!inserted?.id) {
      throw new Error("Failed to create guest session");
    }

    await ensureSeatsForGuestSession(inserted.id, guestCount, tx);
    await recordGuestSeatedEvent(inserted.id, guestCount, tx);

    return inserted.id;
  });
}

export async function ensureGuestTableSession(
  input: EnsureGuestTableSessionInput,
): Promise<EnsureGuestTableSessionResult> {
  const tableNumber = input.tableNumber.trim();
  if (!tableNumber) {
    return { ok: false, code: "BAD_REQUEST", message: "Table number is required" };
  }

  const tableRow = await findTableByNumber(input.locationId, tableNumber);
  if (!tableRow) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Table not found. Check the table number on your QR code.",
    };
  }

  const tableDetails = await db.query.tables.findFirst({
    where: and(
      eq(tablesTable.locationId, input.locationId),
      eq(tablesTable.id, tableRow.id),
    ),
    columns: { id: true, tableNumber: true, status: true },
  });
  if (!tableDetails) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Table not found. Check the table number on your QR code.",
    };
  }

  const furnitureStatus = normalizeFurnitureStatus(tableDetails.status ?? "");
  if (furnitureStatus === "maintenance" || furnitureStatus === "disabled") {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "This table is not available for ordering right now.",
    };
  }

  const existingSession = await findOpenSessionForTable(input.locationId, tableNumber);
  if (existingSession) {
    return {
      ok: true,
      sessionId: existingSession.sessionId,
      tableId: existingSession.tableId,
      tableNumber: existingSession.tableNumber,
      created: false,
    };
  }

  // Delivery-to-table and self-pickup both allow guests to open a session when they
  // choose a table (checkout / QR). Staff do not need to seat first.
  const guestCount =
    typeof input.guestCount === "number" &&
    Number.isFinite(input.guestCount) &&
    input.guestCount >= 1
      ? Math.floor(input.guestCount)
      : 1;

  try {
    const sessionId = await createGuestOpenSession(
      input.locationId,
      tableDetails.id,
      guestCount,
    );
    return {
      ok: true,
      sessionId,
      tableId: tableDetails.id,
      tableNumber: tableDetails.tableNumber,
      created: true,
    };
  } catch (error) {
    if (isUniqueOpenSessionViolation(error)) {
      const racedSession = await findOpenSessionForTable(input.locationId, tableNumber);
      if (racedSession) {
        return {
          ok: true,
          sessionId: racedSession.sessionId,
          tableId: racedSession.tableId,
          tableNumber: racedSession.tableNumber,
          created: false,
        };
      }
    }
    throw error;
  }
}
