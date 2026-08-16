import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  items as itemsTable,
  customizationOptions as customizationOptionsTable,
  customizationGroups as customizationGroupsTable,
  conditionalPrices as conditionalPricesTable,
} from "@/lib/db/schema/menus";
import {
  orders as ordersTable,
  orderItems as orderItemsTable,
  orderItemCustomizations as orderItemCustomizationsTable,
  sessions as sessionsTable,
  seats as seatsTable,
} from "@/lib/db/schema/orders";
import { withTx } from "@/domain/tx";
import { recalculateOrderTotals, recalculateSessionTotals } from "@/domain/orderTotals";
import {
  getStationRoutingContext,
  resolveStationOverride,
} from "@/lib/kds/resolveStationForOrderItem";
import { resolveOptionPriceFromSelectedOptionIds } from "@/lib/public-menu/resolve-customization-option-price";
import { fireGuestWave } from "@/lib/public-menu/fireGuestWave";
import type { PublicOrderItemInput } from "@/lib/public-menu/types";
import { repricePromoLines } from "@/lib/promotions/applyOrderBogo";
import { resolveItemPromos } from "@/lib/promotions/resolveActivePromotions";

type DbOrTx = typeof db;

async function createGuestNextWave(
  sessionId: string,
  dbOrTx: DbOrTx = db,
): Promise<{ ok: true; order: { id: string; wave: number } } | { ok: false; error: string }> {
  const session = await dbOrTx.query.sessions.findFirst({
    where: eq(sessionsTable.id, sessionId),
    columns: { id: true, locationId: true, tableId: true },
  });
  if (!session) return { ok: false, error: "Session not found" };

  const [maxRow] = await dbOrTx
    .select({
      maxWave: sql<number>`COALESCE(MAX(${ordersTable.wave}), 0)::int`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.sessionId, sessionId));
  const nextWave = (maxRow?.maxWave ?? 0) + 1;

  // Same daily sequence as pickup (ORD-001 → DI-001 on the board).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayOrders = await dbOrTx.query.orders.findMany({
    where: and(
      eq(ordersTable.locationId, session.locationId),
      gte(ordersTable.createdAt, today),
      lte(ordersTable.createdAt, tomorrow),
    ),
    columns: { id: true },
  });
  const orderNumber = `ORD-${String(todayOrders.length + 1).padStart(3, "0")}`;
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

export async function addGuestItemsToSession(
  sessionId: string,
  locationId: string,
  items: PublicOrderItemInput[],
  options?: { autoFire?: boolean; seatId?: string; seatNumber?: number },
): Promise<
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; message: string }
> {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessionsTable.id, sessionId),
      eq(sessionsTable.locationId, locationId),
      eq(sessionsTable.status, "open"),
    ),
    columns: { id: true, status: true },
  });
  if (!session) {
    return { ok: false, message: "Session not found or closed" };
  }

  const seatId = options?.seatId?.trim();
  let seatRow = seatId
    ? await db.query.seats.findFirst({
        where: and(
          eq(seatsTable.id, seatId),
          eq(seatsTable.sessionId, sessionId),
          eq(seatsTable.status, "active"),
        ),
        columns: { id: true, seatNumber: true },
      })
    : null;

  if (!seatRow) {
    seatRow = await db.query.seats.findFirst({
      where: and(eq(seatsTable.sessionId, sessionId), eq(seatsTable.status, "active")),
      columns: { id: true, seatNumber: true },
      orderBy: [asc(seatsTable.seatNumber)],
    });
  }

  if (!seatRow) {
    const now = new Date();
    const [createdSeat] = await db
      .insert(seatsTable)
      .values({
        sessionId,
        seatNumber: 1,
        status: "active",
        updatedAt: now,
      })
      .returning({ id: seatsTable.id, seatNumber: seatsTable.seatNumber });
    seatRow = createdSeat ?? null;
  }

  if (!seatRow) {
    return { ok: false, message: "Unable to assign a seat for this table" };
  }

  const resolvedSeatId = seatRow.id;
  const resolvedSeatNumber = seatRow.seatNumber;

  return withTx(async (tx) => {
    // Each guest checkout is its own kitchen ticket (no append to in-progress orders).
    const created = await createGuestNextWave(sessionId, tx);
    if (!created.ok) return { ok: false, message: created.error };

    let orderId = created.order.id;
    let order = await tx.query.orders.findFirst({
      where: eq(ordersTable.id, orderId),
      columns: { id: true, locationId: true, status: true, firedAt: true, orderNumber: true },
    });
    if (!order) return { ok: false, message: "Order not found" };

    const itemIds = [...new Set(items.map((item) => item.itemId).filter(Boolean))];
    if (itemIds.length === 0) {
      return { ok: false, message: "At least one menu item is required" };
    }
    const menuItems = await tx
      .select({
        id: itemsTable.id,
        name: itemsTable.name,
        price: itemsTable.price,
        defaultStation: itemsTable.defaultStation,
        status: itemsTable.status,
      })
      .from(itemsTable)
      .where(and(eq(itemsTable.locationId, order.locationId), inArray(itemsTable.id, itemIds)));
    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
    const promoByItem = await resolveItemPromos(
      order.locationId,
      new Map(menuItems.map((item) => [item.id, Number(item.price) || 0])),
    );

    if (menuItems.length !== itemIds.length) {
      return { ok: false, message: "One or more items are invalid" };
    }

    const stationCtx = await getStationRoutingContext(order.locationId);
    const optionIds = [
      ...new Set(
        items.flatMap((item) => (item.customizations ?? []).map((c) => c.optionId)).filter(Boolean),
      ),
    ];

    let optionMap = new Map<string, { id: string; groupId: string; name: string; price: string }>();
    let groupMap = new Map<string, string>();
    const conditionalByOptionId = new Map<
      string,
      Array<{ baseOptionId: string; price: string }>
    >();
    const optionNameById = new Map<string, string>();
    if (optionIds.length > 0) {
      const options = await tx.query.customizationOptions.findMany({
        where: inArray(customizationOptionsTable.id, optionIds),
        columns: { id: true, groupId: true, name: true, price: true },
      });
      optionMap = new Map(options.map((option) => [option.id, option]));
      const groupIds = [...new Set(options.map((option) => option.groupId).filter(Boolean))] as string[];
      if (groupIds.length > 0) {
        const groups = await tx.query.customizationGroups.findMany({
          where: inArray(customizationGroupsTable.id, groupIds),
          columns: { id: true, name: true },
        });
        groupMap = new Map(groups.map((group) => [group.id, group.name]));
      }
      const conditionalRows = await tx.query.conditionalPrices.findMany({
        where: inArray(conditionalPricesTable.optionId, optionIds),
        columns: { optionId: true, baseOptionId: true, price: true },
      });
      for (const row of conditionalRows) {
        const list = conditionalByOptionId.get(row.optionId) ?? [];
        list.push({ baseOptionId: row.baseOptionId, price: row.price });
        conditionalByOptionId.set(row.optionId, list);
      }
      const nameLookupIds = [
        ...new Set([
          ...optionIds,
          ...conditionalRows.map((row) => row.baseOptionId),
        ]),
      ];
      if (nameLookupIds.length > 0) {
        const namedOptions = await tx.query.customizationOptions.findMany({
          where: inArray(customizationOptionsTable.id, nameLookupIds),
          columns: { id: true, name: true },
        });
        for (const named of namedOptions) {
          optionNameById.set(named.id, named.name);
        }
      }
    }

    for (const input of items) {
      const menuItem = menuItemMap.get(input.itemId);
      if (!menuItem) return { ok: false, message: "Item not found" };
      if (menuItem.status === "draft" || menuItem.status === "hidden") {
        return { ok: false, message: `Item "${menuItem.name}" is not available` };
      }

      const qty = Math.max(1, Math.floor(input.quantity ?? 1));
      const price = promoByItem.get(menuItem.id)?.price ?? Number(menuItem.price);
      let customizationsTotal = 0;
      const custRows: Array<{
        groupId: string;
        optionId: string;
        groupName: string;
        optionName: string;
        optionPrice: string;
        quantity: number;
      }> = [];

      const selectedOptionIds = new Set(
        (input.customizations ?? []).map((entry) => entry.optionId),
      );

      for (const customization of input.customizations ?? []) {
        const opt = optionMap.get(customization.optionId);
        if (!opt) return { ok: false, message: "Invalid customization" };
        const optPrice = resolveOptionPriceFromSelectedOptionIds(
          Number(opt.price),
          conditionalByOptionId.get(opt.id) ?? [],
          selectedOptionIds,
          optionNameById,
        );
        const custQty = Math.max(1, Math.floor(customization.quantity ?? 1));
        customizationsTotal += optPrice * custQty;
        custRows.push({
          groupId: opt.groupId,
          optionId: opt.id,
          groupName: groupMap.get(opt.groupId) ?? "Customization",
          optionName: opt.name,
          optionPrice: optPrice.toFixed(2),
          quantity: custQty,
        });
      }

      const unitCustomizationsTotal = customizationsTotal;
      const unitLineTotal = price + unitCustomizationsTotal;
      const resolvedStation = resolveStationOverride(
        stationCtx,
        menuItem.defaultStation,
      );

      for (let unitIndex = 0; unitIndex < qty; unitIndex += 1) {
        const [row] = await tx
          .insert(orderItemsTable)
          .values({
            orderId,
            itemId: input.itemId,
            itemName: menuItem.name,
            itemPrice: price.toFixed(2),
            quantity: 1,
            seat: resolvedSeatNumber,
            seatId: resolvedSeatId,
            customizationsTotal: unitCustomizationsTotal.toFixed(2),
            lineTotal: unitLineTotal.toFixed(2),
            notes: input.notes ?? null,
            status: "pending",
            stationOverride: resolvedStation,
          })
          .returning({ id: orderItemsTable.id });

        if (row && custRows.length > 0) {
          await tx.insert(orderItemCustomizationsTable).values(
            custRows.map((customization) => ({
              orderItemId: row.id,
              ...customization,
            })),
          );
        }
      }
    }

    await repricePromoLines({
      locationId: order.locationId,
      orderId,
      sessionId,
      itemIds,
      dbOrTx: tx,
    });

    await recalculateOrderTotals(orderId, tx);
    await recalculateSessionTotals(sessionId, tx);

    if (options?.autoFire) {
      const fireResult = await fireGuestWave(orderId, sessionId, tx);
      if (!fireResult.ok) {
        return { ok: false, message: fireResult.message };
      }
    }

    return {
      ok: true,
      orderId,
      orderNumber: order.orderNumber ?? orderId,
    };
  });
}
