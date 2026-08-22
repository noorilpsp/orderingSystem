import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { normalizeCatalogI18n, type CatalogI18n } from "@/lib/catalog-i18n";
import { guestSeatClaims } from "@/lib/db/schema/guest-seat-claims";
import type { GuestSplitProposalRecord } from "@/lib/db/schema/guest-table-splits";
import {
  customizationOptions as customizationOptionsTable,
  itemCustomizations as itemCustomizationsTable,
  items as itemsTable,
} from "@/lib/db/schema/menus";
import {
  orderItemCustomizations as orderItemCustomizationsTable,
  orderItems as orderItemsTable,
  orders as ordersTable,
  seats as seatsTable,
} from "@/lib/db/schema/orders";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import { getGuestTableSplitState } from "@/lib/public-menu/guestTableSplitState";
import { findOpenSessionForTable } from "@/lib/public-menu/tableSession";

export type GuestBillSplitSeat = {
  seatId: string | null;
  seatNumber: number | null;
  guestName: string | null;
  itemCount: number;
  subtotal: number;
  isYours: boolean;
};

export type GuestBillSplitCustomization = {
  groupName: string;
  optionName: string;
  optionPrice: number;
  quantity: number;
};

export type GuestBillSplitItem = {
  id: string;
  /** Menu item id when known - used with i18n for guest locale names. */
  itemId: string | null;
  name: string;
  /** Catalog locale overrides (Arabic name, etc.). */
  i18n: CatalogI18n | null;
  quantity: number;
  price: number;
  seatId: string | null;
  seatNumber: number | null;
  isYours: boolean;
  /** Size / extras for this line (empty when plain). */
  customizations: GuestBillSplitCustomization[];
  notes: string | null;
  /** Normalized assignment shares (empty = unassigned). */
  assignmentShares: Array<{ seatId: string; seatNumber: number | null; shares: number }>;
  isAssignmentSplit: boolean;
  claimedBySeatId: string | null;
  claimedBySeatNumber: number | null;
  claimedByYou: boolean;
};

export type GuestBillSplitResult =
  | {
      ok: true;
      tableNumber: string;
      sessionId: string;
      subtotal: number;
      itemCount: number;
      yourSeat: GuestBillSplitSeat | null;
      seats: GuestBillSplitSeat[];
      unassigned: GuestBillSplitSeat | null;
      seatCountWithItems: number;
      items: GuestBillSplitItem[];
      proposal: GuestSplitProposalRecord | null;
      /** Shared + Payer seats for Item split (visible on every device). */
      extraPayers: Array<{ id: string; seatNumber: number }>;
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN";
      message: string;
    };

function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function normalizeDeviceId(deviceId: string): string | null {
  const trimmed = deviceId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/** Guest-bill display key: only collapse lines that are truly identical. */
function guestBillMergeKey(item: {
  itemId: string | null;
  itemName: string;
  seatId: string | null;
  itemPrice: number;
  customizationsTotal: number;
  customizations: GuestBillSplitCustomization[];
  notes: string | null;
}): string {
  const itemKey = item.itemId?.trim()
    ? `id:${item.itemId.trim()}`
    : `name:${item.itemName.trim().toLowerCase()}`;
  const seatKey = item.seatId?.trim() || "unassigned";
  // Use Unit Separator (\u001f), never NUL (\u0000) - Postgres jsonb rejects \\u0000 in text.
  const fieldSep = "\u001f";
  const customizationKey = item.customizations
    .map((row) =>
      [
        row.groupName.trim().toLowerCase(),
        row.optionName.trim().toLowerCase(),
        String(money(row.optionPrice)),
        String(row.quantity),
      ].join(fieldSep),
    )
    .sort()
    .join("|");
  const notesKey = (item.notes ?? "").trim().toLowerCase();
  return [
    itemKey,
    seatKey,
    `price:${money(item.itemPrice)}`,
    `extras:${money(item.customizationsTotal)}`,
    `mods:${customizationKey || "-"}`,
    `notes:${notesKey || "-"}`,
  ].join("::");
}

function mapCustomizations(
  rows: Array<{
    groupId?: string | null;
    optionId?: string | null;
    groupName: string;
    optionName: string;
    optionPrice: unknown;
    quantity: number | null;
    createdAt?: Date | null;
  }>,
  /** Group order as shown on the item customization modal (`item_customizations.displayOrder`). */
  groupIndexById: Map<string, number> | undefined,
  optionDisplayOrderById: Map<string, number>,
): GuestBillSplitCustomization[] {
  return [...rows]
    .map((row, index) => ({
      groupName: row.groupName,
      optionName: row.optionName,
      optionPrice: money(row.optionPrice),
      quantity: Math.max(1, row.quantity ?? 1),
      groupIndex:
        row.groupId && groupIndexById?.has(row.groupId)
          ? groupIndexById.get(row.groupId)!
          : null,
      optionOrder:
        row.optionId && optionDisplayOrderById.has(row.optionId)
          ? optionDisplayOrderById.get(row.optionId)!
          : null,
      createdAtMs: row.createdAt?.getTime() ?? 0,
      index,
    }))
    .sort((a, b) => {
      // Same as item detail modal: groups in customizationGroupIds order, then options by displayOrder.
      if (a.groupIndex != null && b.groupIndex != null && a.groupIndex !== b.groupIndex) {
        return a.groupIndex - b.groupIndex;
      }
      if (a.groupIndex != null && b.groupIndex == null) return -1;
      if (a.groupIndex == null && b.groupIndex != null) return 1;
      if (a.optionOrder != null && b.optionOrder != null && a.optionOrder !== b.optionOrder) {
        return a.optionOrder - b.optionOrder;
      }
      if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
      return a.index - b.index;
    })
    .map(({ groupName, optionName, optionPrice, quantity }) => ({
      groupName,
      optionName,
      optionPrice,
      quantity,
    }));
}

/**
 * Guest-facing bill split preview for the open table session.
 * Requires a claimed seat on this table (QR / deep link) - same gate as staff
 * opening one table on the floor plan - then returns the full check so guests
 * can review One bill / By seat / Equal (payment still happens with staff).
 */
export async function getGuestTableBillSplit(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
  seatId?: string | null;
}): Promise<GuestBillSplitResult> {
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

  const session = await findOpenSessionForTable(location.id, tableNumber);
  if (!session) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "No open check for this table yet. Order something first.",
    };
  }

  const claim = await db.query.guestSeatClaims.findFirst({
    where: and(
      eq(guestSeatClaims.sessionId, session.sessionId),
      eq(guestSeatClaims.deviceId, deviceId),
    ),
    columns: { seatId: true },
  });
  if (!claim) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Join this table from its QR code to see the check.",
    };
  }

  const requestedSeatId = input.seatId?.trim() || null;
  if (requestedSeatId && requestedSeatId !== claim.seatId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Seat does not belong to this device",
    };
  }

  const yourSeatId = claim.seatId;

  // Match /orders live board: only unpaid (or partial) orders count toward the open check.
  const sessionOrders = await db.query.orders.findMany({
    where: and(
      eq(ordersTable.sessionId, session.sessionId),
      ne(ordersTable.status, "cancelled"),
    ),
    columns: { id: true, paymentStatus: true },
  });
  const unpaidOrderIds = sessionOrders
    .filter((order) => {
      const payment = (order.paymentStatus ?? "unpaid").trim().toLowerCase();
      return payment === "unpaid" || payment === "partial";
    })
    .map((order) => order.id);

  if (unpaidOrderIds.length === 0) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "No open unpaid check for this table.",
    };
  }

  const seatRows = await db.query.seats.findMany({
    where: and(eq(seatsTable.sessionId, session.sessionId), ne(seatsTable.status, "removed")),
    columns: { id: true, seatNumber: true, guestName: true },
    orderBy: [asc(seatsTable.seatNumber)],
  });

  const totalsBySeatId = new Map<string, { itemCount: number; subtotal: number }>();
  let unassignedItemCount = 0;
  let unassignedSubtotal = 0;
  let totalItemCount = 0;
  let totalSubtotal = 0;
  const mergedByKey = new Map<string, GuestBillSplitItem>();

  const items = await db.query.orderItems.findMany({
    where: and(
      inArray(orderItemsTable.orderId, unpaidOrderIds),
      isNull(orderItemsTable.voidedAt),
    ),
    columns: {
      id: true,
      itemId: true,
      itemName: true,
      itemPrice: true,
      customizationsTotal: true,
      notes: true,
      seatId: true,
      quantity: true,
      lineTotal: true,
    },
    with: {
      customizations: {
        columns: {
          groupId: true,
          optionId: true,
          groupName: true,
          optionName: true,
          optionPrice: true,
          quantity: true,
          createdAt: true,
        },
        orderBy: [asc(orderItemCustomizationsTable.createdAt)],
      },
    },
    orderBy: [asc(orderItemsTable.createdAt)],
  });

  const catalogItemIds = [
    ...new Set(
      items
        .map((item) => item.itemId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const catalogRows =
    catalogItemIds.length > 0
      ? await db.query.items.findMany({
          where: inArray(itemsTable.id, catalogItemIds),
          columns: { id: true, i18n: true },
        })
      : [];
  const i18nByItemId = new Map(
    catalogRows.map((row) => [row.id, normalizeCatalogI18n(row.i18n)] as const),
  );

  const customizationOptionIds = [
    ...new Set(
      items.flatMap((item) =>
        (item.customizations ?? [])
          .map((row) => row.optionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  /** Per menu item: groupId → index in the item customization modal order. */
  const groupIndexByItemId = new Map<string, Map<string, number>>();
  if (catalogItemIds.length > 0) {
    const itemGroupRows = await db
      .select({
        itemId: itemCustomizationsTable.itemId,
        groupId: itemCustomizationsTable.groupId,
        displayOrder: itemCustomizationsTable.displayOrder,
        createdAt: itemCustomizationsTable.createdAt,
      })
      .from(itemCustomizationsTable)
      .where(inArray(itemCustomizationsTable.itemId, catalogItemIds))
      .orderBy(
        asc(itemCustomizationsTable.itemId),
        asc(itemCustomizationsTable.displayOrder),
        asc(itemCustomizationsTable.createdAt),
      );
    for (const row of itemGroupRows) {
      let byGroup = groupIndexByItemId.get(row.itemId);
      if (!byGroup) {
        byGroup = new Map();
        groupIndexByItemId.set(row.itemId, byGroup);
      }
      if (!byGroup.has(row.groupId)) {
        byGroup.set(row.groupId, byGroup.size);
      }
    }
  }

  const optionDisplayOrderById = new Map<string, number>();
  if (customizationOptionIds.length > 0) {
    const optionRows = await db
      .select({
        id: customizationOptionsTable.id,
        displayOrder: customizationOptionsTable.displayOrder,
      })
      .from(customizationOptionsTable)
      .where(inArray(customizationOptionsTable.id, customizationOptionIds));
    for (const row of optionRows) {
      optionDisplayOrderById.set(row.id, row.displayOrder ?? 0);
    }
  }

  const seatNumberById = new Map(seatRows.map((seat) => [seat.id, seat.seatNumber]));

  for (const item of items) {
    const qty = Math.max(1, item.quantity ?? 1);
    const line = money(item.lineTotal);
    totalItemCount += qty;
    totalSubtotal += line;

    const seatId = item.seatId ?? null;
    const seatNumber = seatId ? (seatNumberById.get(seatId) ?? null) : null;
    const itemId = item.itemId?.trim() || null;
    const customizations = mapCustomizations(
      item.customizations ?? [],
      itemId ? groupIndexByItemId.get(itemId) : undefined,
      optionDisplayOrderById,
    );
    const itemPrice = money(item.itemPrice);
    const customizationsTotal = money(item.customizationsTotal);
    const notes = item.notes?.trim() || null;
    const key = guestBillMergeKey({
      itemId,
      itemName: item.itemName,
      seatId,
      itemPrice,
      customizationsTotal,
      customizations,
      notes,
    });
    const existingLine = mergedByKey.get(key);
    if (existingLine) {
      existingLine.quantity += qty;
      existingLine.price = money(existingLine.price + line);
    } else {
      mergedByKey.set(key, {
        id: `merged:${key}`,
        itemId,
        name: item.itemName,
        i18n: itemId ? (i18nByItemId.get(itemId) ?? null) : null,
        quantity: qty,
        price: line,
        seatId,
        seatNumber,
        isYours: seatId != null && seatId === yourSeatId,
        customizations,
        notes,
        assignmentShares: [],
        isAssignmentSplit: false,
        claimedBySeatId: null,
        claimedBySeatNumber: null,
        claimedByYou: false,
      });
    }

    if (!seatId) {
      unassignedItemCount += qty;
      unassignedSubtotal += line;
      continue;
    }

    const existing = totalsBySeatId.get(seatId) ?? { itemCount: 0, subtotal: 0 };
    existing.itemCount += qty;
    existing.subtotal += line;
    totalsBySeatId.set(seatId, existing);
  }

  const lineItems = [...mergedByKey.values()];
  const splitState = await getGuestTableSplitState(session.sessionId);
  for (const line of lineItems) {
    const claim =
      splitState.claims[line.id] ??
      splitState.claims[line.id.replace(/\u0000/g, "\u001f")] ??
      null;
    const shares = claim?.shares ?? [];
    line.assignmentShares = shares;
    line.isAssignmentSplit = shares.length > 1;
    const sole = shares.length === 1 ? shares[0] : null;
    line.claimedBySeatId = sole?.seatId ?? null;
    line.claimedBySeatNumber = sole?.seatNumber ?? null;
    line.claimedByYou = shares.some((share) => share.seatId === yourSeatId);
  }

  if (totalItemCount === 0) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "No open unpaid check for this table.",
    };
  }

  const seats: GuestBillSplitSeat[] = seatRows
    .map((seat) => {
      const totals = totalsBySeatId.get(seat.id) ?? { itemCount: 0, subtotal: 0 };
      return {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        guestName: seat.guestName,
        itemCount: totals.itemCount,
        subtotal: Math.round(totals.subtotal * 100) / 100,
        isYours: seat.id === yourSeatId,
      };
    });
  // Keep every open session seat so guests can assign items to diners who
  // haven't ordered yet (Item split / + Payer targets).

  for (const [seatId, totals] of totalsBySeatId) {
    if (seats.some((seat) => seat.seatId === seatId)) continue;
    seats.push({
      seatId,
      seatNumber: null,
      guestName: null,
      itemCount: totals.itemCount,
      subtotal: Math.round(totals.subtotal * 100) / 100,
      isYours: seatId === yourSeatId,
    });
  }

  seats.sort((a, b) => {
    if (a.isYours !== b.isYours) return a.isYours ? -1 : 1;
    if (a.seatNumber == null && b.seatNumber == null) return 0;
    if (a.seatNumber == null) return 1;
    if (b.seatNumber == null) return -1;
    return a.seatNumber - b.seatNumber;
  });

  const unassigned =
    unassignedItemCount > 0
      ? {
          seatId: null,
          seatNumber: null,
          guestName: null,
          itemCount: unassignedItemCount,
          subtotal: Math.round(unassignedSubtotal * 100) / 100,
          isYours: false,
        }
      : null;

  const yourSeat = seats.find((seat) => seat.isYours) ?? null;
  const seatCountWithItems = seats.filter((seat) => seat.itemCount > 0).length;

  return {
    ok: true,
    tableNumber: session.tableNumber,
    sessionId: session.sessionId,
    subtotal: Math.round(totalSubtotal * 100) / 100,
    itemCount: totalItemCount,
    yourSeat,
    seats,
    unassigned,
    seatCountWithItems,
    items: lineItems,
    proposal: splitState.proposal,
    extraPayers: splitState.extraPayers,
  };
}
