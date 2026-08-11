import { and, eq, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { sessions as sessionsTable, tables as tablesTable } from "@/lib/db/schema/orders";

export type ResolvedTableSession = {
  sessionId: string;
  tableId: string;
  tableNumber: string;
};

type TableRow = {
  id: string;
  tableNumber: string;
  displayId: string | null;
  alerts: unknown;
};

function extractNumericPart(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = trimmed.replace(/^t/i, "").match(/^(\d+)$/);
  if (direct) {
    const num = Number.parseInt(direct[1], 10);
    return Number.isFinite(num) ? num : null;
  }
  const embedded = trimmed.match(/(\d+)/);
  if (!embedded) return null;
  const num = Number.parseInt(embedded[1], 10);
  return Number.isFinite(num) ? num : null;
}

export function tableIdentifiersMatch(
  row: { tableNumber: string; displayId?: string | null },
  input: string,
): boolean {
  const normalizedInput = input.trim().toLowerCase();
  if (!normalizedInput) return false;

  const tableNumber = row.tableNumber.trim().toLowerCase();
  const displayId = (row.displayId ?? "").trim().toLowerCase();

  if (tableNumber === normalizedInput || displayId === normalizedInput) {
    return true;
  }

  const inputNum = extractNumericPart(normalizedInput);
  if (inputNum == null) return false;

  const tableNum = extractNumericPart(tableNumber);
  const displayNum = displayId ? extractNumericPart(displayId) : null;

  return tableNum === inputNum || displayNum === inputNum;
}

function mapTableRow(row: TableRow): {
  id: string;
  tableNumber: string;
  alerts: string[] | null;
} {
  const alerts = Array.isArray(row.alerts) ? (row.alerts as string[]) : null;
  return { id: row.id, tableNumber: row.tableNumber, alerts };
}

async function findTableRowByIdentifiers(
  locationId: string,
  identifiers: string[],
): Promise<TableRow | null> {
  for (const identifier of identifiers) {
    const row = await db.query.tables.findFirst({
      where: and(
        eq(tablesTable.locationId, locationId),
        or(
          ilike(tablesTable.tableNumber, identifier),
          ilike(tablesTable.displayId, identifier),
        ),
      ),
      columns: { id: true, tableNumber: true, displayId: true, alerts: true },
    });
    if (row) return row;
  }
  return null;
}

export async function findTableByNumber(
  locationId: string,
  tableNumber: string,
): Promise<{ id: string; tableNumber: string; alerts: string[] | null } | null> {
  const input = tableNumber.trim();
  if (!input) return null;

  const lookupOrder: string[] = [];
  if (input.match(/^\d+$/)) {
    lookupOrder.push(`T${input}`, input);
  } else {
    lookupOrder.push(input);
    const numeric = extractNumericPart(input);
    if (numeric != null) lookupOrder.push(`T${numeric}`, String(numeric));
  }

  const direct = await findTableRowByIdentifiers(locationId, lookupOrder);
  if (direct) return mapTableRow(direct);

  const rows = await db.query.tables.findMany({
    where: eq(tablesTable.locationId, locationId),
    columns: { id: true, tableNumber: true, displayId: true, alerts: true },
  });

  const matched = rows.find((row) => tableIdentifiersMatch(row, input));
  return matched ? mapTableRow(matched) : null;
}

export async function findOpenSessionForTable(
  locationId: string,
  tableNumber: string,
): Promise<ResolvedTableSession | null> {
  const input = tableNumber.trim();
  if (!input) return null;

  const tableRow = await findTableByNumber(locationId, input);
  if (tableRow) {
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessionsTable.locationId, locationId),
        eq(sessionsTable.tableId, tableRow.id),
        eq(sessionsTable.status, "open"),
      ),
      columns: { id: true },
    });
    if (session) {
      return {
        sessionId: session.id,
        tableId: tableRow.id,
        tableNumber: tableRow.tableNumber,
      };
    }
  }

  const openSessions = await db
    .select({
      sessionId: sessionsTable.id,
      tableId: tablesTable.id,
      tableNumber: tablesTable.tableNumber,
      displayId: tablesTable.displayId,
    })
    .from(sessionsTable)
    .innerJoin(tablesTable, eq(sessionsTable.tableId, tablesTable.id))
    .where(
      and(eq(sessionsTable.locationId, locationId), eq(sessionsTable.status, "open")),
    );

  const matched = openSessions.filter((row) =>
    tableIdentifiersMatch(
      { tableNumber: row.tableNumber, displayId: row.displayId },
      input,
    ),
  );
  if (matched.length === 0) return null;

  const best = matched[0];
  return {
    sessionId: best.sessionId,
    tableId: best.tableId,
    tableNumber: best.tableNumber,
  };
}

export async function findOpenSessionForTableId(
  locationId: string,
  tableId: string,
): Promise<ResolvedTableSession | null> {
  const tableRow = await db.query.tables.findFirst({
    where: and(eq(tablesTable.locationId, locationId), eq(tablesTable.id, tableId)),
    columns: { id: true, tableNumber: true },
  });
  if (!tableRow) return null;

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.locationId, locationId),
      eq(sessionsTable.tableId, tableRow.id),
      eq(sessionsTable.status, "open"),
    ),
    columns: { id: true },
  });
  if (!session) return null;

  return {
    sessionId: session.id,
    tableId: tableRow.id,
    tableNumber: tableRow.tableNumber,
  };
}
