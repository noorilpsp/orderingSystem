/**
 * Shared core logic for building OrdersView from locationId.
 * Used by getOrdersView (server page) and GET /api/orders/view.
 * Caller must have validated auth and location access.
 */

import { eq, and, inArray, isNull, isNotNull, ne, desc, asc, gte, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderItemCustomizations,
  sessions,
  orderTimeline,
  seats,
  tables,
} from "@/lib/db/schema/orders";
import {
  merchantLocations,
  items as catalogItems,
  customizationGroups,
  customizationOptions,
} from "@/lib/db/schema";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";
import type {
  OrdersView,
  OrdersUnifiedOrder,
  OrdersUnifiedStatus,
  OrdersWaveStatus,
  OrdersOrderSource,
  OrdersPaymentState,
  OrdersPaymentMethod,
  OrdersServiceRequest,
} from "./ordersView";
import {
  hasBillRequest,
  hasWaiterRequestAlert,
} from "@/lib/floor-map/acknowledgeTableService";
import { sweepIdleEmptyGuestSessionsForLocation } from "@/lib/public-menu/claimGuestTableSeat";
import {
  deriveCanonicalWaveStatusFromItemStatuses,
  mapCanonicalWaveStatusToStoreLikeStatus,
  type RawWaveItemStatus,
} from "@/lib/wave-status";
import { isScheduledOrderParked } from "@/lib/public-menu/scheduledOrderRelease";
import { processGuestOrderPushReminders } from "@/lib/public-menu/guest-order-push-reminders";
import { formatCounterOrderLabel } from "@/lib/orders/formatCounterOrderLabel";
import {
  buildTableCheckOrder,
  formatTableSeatGuestLabel,
} from "@/lib/orders/buildTableCheckOrder";
import { formatGuestContactLabel } from "@/lib/orders/guestContactLabel";
import { coerceTaxRatePercent } from "@/lib/tax-rate";

const SECTION_LABELS: Record<string, string> = {
  main: "Main Dining",
  patio: "Patio",
  bar: "Bar Area",
  private: "Private Room",
};

type OrdersViewItemCustomization = NonNullable<
  OrdersUnifiedOrder["items"][number]["customizations"]
>[number];

type OrdersViewItem = OrdersUnifiedOrder["items"][number];

function resolveTargetEtaMinutes(input: {
  estimatedReadyAt: Date | null | undefined;
  createdAtMs: number;
  preparingEnteredAtMs?: number | null;
  fallbackPrepMinutes: number;
}): number {
  const fallback = Math.min(
    180,
    Math.max(1, Math.round(input.fallbackPrepMinutes || 15)),
  );
  const readyAt = input.estimatedReadyAt?.getTime();
  if (!readyAt || !Number.isFinite(readyAt)) return fallback;

  const start =
    typeof input.preparingEnteredAtMs === "number" &&
    Number.isFinite(input.preparingEnteredAtMs) &&
    input.preparingEnteredAtMs > 0
      ? input.preparingEnteredAtMs
      : input.createdAtMs;
  if (!start || !Number.isFinite(start)) return fallback;

  const minutes = Math.round((readyAt - start) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return fallback;
  return Math.min(180, Math.max(1, minutes));
}

async function loadCustomizationsByOrderItemId(
  orderItemIds: string[],
): Promise<Map<string, OrdersViewItemCustomization[]>> {
  const map = new Map<string, OrdersViewItemCustomization[]>();
  if (orderItemIds.length === 0) return map;

  const rows = await db
    .select({
      orderItemId: orderItemCustomizations.orderItemId,
      groupName: orderItemCustomizations.groupName,
      optionName: orderItemCustomizations.optionName,
      optionPrice: orderItemCustomizations.optionPrice,
      quantity: orderItemCustomizations.quantity,
      groupId: orderItemCustomizations.groupId,
      optionId: orderItemCustomizations.optionId,
      groupI18n: customizationGroups.i18n,
      optionI18n: customizationOptions.i18n,
    })
    .from(orderItemCustomizations)
    .leftJoin(
      customizationGroups,
      eq(orderItemCustomizations.groupId, customizationGroups.id),
    )
    .leftJoin(
      customizationOptions,
      eq(orderItemCustomizations.optionId, customizationOptions.id),
    )
    .where(inArray(orderItemCustomizations.orderItemId, orderItemIds));

  for (const row of rows) {
    const list = map.get(row.orderItemId) ?? [];
    list.push({
      groupName: row.groupName,
      optionName: row.optionName,
      optionPrice: parseFloat(String(row.optionPrice ?? 0)) || 0,
      quantity: row.quantity ?? 1,
      groupId: row.groupId ?? null,
      optionId: row.optionId ?? null,
      groupI18n: normalizeCatalogI18n(row.groupI18n),
      optionI18n: normalizeCatalogI18n(row.optionI18n),
    });
    map.set(row.orderItemId, list);
  }
  return map;
}

type CounterStageKey = "sent" | "preparing" | "ready" | "served";

function mapDbStatusToCounterStage(status: string): CounterStageKey | null {
  if (status === "pending" || status === "confirmed") return "sent";
  if (status === "preparing") return "preparing";
  if (status === "ready") return "ready";
  if (status === "completed") return "served";
  return null;
}

function buildStageEnteredAt(
  createdAtMs: number,
  timelineRows: Array<{ status: string; createdAt: Date | null }>
): Partial<Record<CounterStageKey, number>> {
  const stageEnteredAt: Partial<Record<CounterStageKey, number>> = {
    sent: createdAtMs,
  };

  for (const row of timelineRows) {
    const stage = mapDbStatusToCounterStage(row.status);
    if (!stage) continue;
    const at = row.createdAt?.getTime();
    if (at == null) continue;
    // First time each stage was entered.
    if (stageEnteredAt[stage] == null) {
      stageEnteredAt[stage] = at;
    }
  }

  return stageEnteredAt;
}

function itemStatusToWaveStatus(s: string): OrdersWaveStatus {
  return mapCanonicalWaveStatusToStoreLikeStatus(
    deriveCanonicalWaveStatusFromItemStatuses([s as RawWaveItemStatus])
  );
}

function mapDbItemStatus(s: string): string {
  if (s === "served") return "served";
  if (s === "ready") return "ready";
  if (s === "preparing") return "preparing";
  return s === "pending" ? "held" : "sent";
}

function mapOrderLineToViewItem(it: {
  id: string;
  itemId?: string | null;
  itemName: string | null;
  itemI18n?: unknown;
  quantity: number | null;
  lineTotal: string | null;
  status: string;
  notes: string | null;
}, extra?: Partial<OrdersViewItem> & { customizations?: OrdersViewItem["customizations"] }): OrdersViewItem {
  return {
    id: it.id,
    name: it.itemName ?? "",
    itemId: it.itemId ?? null,
    i18n: normalizeCatalogI18n(it.itemI18n),
    qty: it.quantity ?? 1,
    status: mapDbItemStatus(it.status),
    price: parseFloat(String(it.lineTotal ?? 0)) || 0,
    notes: it.notes ?? null,
    ...extra,
  };
}

function mapOrderStatusToUnified(
  status: string,
  paymentStatus: string
): OrdersUnifiedStatus {
  if (paymentStatus === "refunded") return "refunded";
  if (status === "cancelled") return "voided";
  if (status === "completed") return "served";
  if (status === "ready") return "ready";
  if (status === "preparing") return "preparing";
  if (status === "confirmed" || status === "pending") return "sent";
  return "sent";
}

/** Paid only when paymentStatus says so - kitchen "completed" is not settlement. */
function resolveOrdersPaymentState(paymentStatus: string): OrdersPaymentState {
  if (paymentStatus === "refunded" || paymentStatus === "paid") return "paid";
  return "unpaid";
}

/** When older rows stored tax as 0, derive money fields from the location rate for display. */
function withDerivedTax(input: {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRatePercent: number;
}): { subtotal: number; taxAmount: number; total: number } {
  const { subtotal, taxAmount, total, taxRatePercent } = input;
  if (subtotal <= 0 || taxAmount > 0 || taxRatePercent <= 0) {
    return { subtotal, taxAmount, total };
  }
  // Only backfill when total looks tax-exclusive (matches subtotal within a cent).
  if (Math.abs(total - subtotal) > 0.02 && total > subtotal) {
    return { subtotal, taxAmount, total };
  }
  const derivedTax = Math.round(subtotal * (taxRatePercent / 100) * 100) / 100;
  return {
    subtotal,
    taxAmount: derivedTax,
    total: Math.round((subtotal + derivedTax) * 100) / 100,
  };
}

export async function buildOrdersView(locationId: string): Promise<OrdersView | null> {
  const locationRow = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: {
      id: true,
      name: true,
      averagePrepTimeMinutes: true,
      orderModes: true,
      taxRate: true,
      country: true,
    },
  });
  if (!locationRow) return null;

  try {
    await sweepIdleEmptyGuestSessionsForLocation(locationId);
  } catch {
    // Board still loads; empty sessions are omitted below.
  }

  const locationName = locationRow.name ?? "Restaurant";
  const taxRatePercent = coerceTaxRatePercent(locationRow.taxRate);
  const orderModesRaw = locationRow.orderModes as
    | {
        dine_in?: { enabled?: boolean; guest_session_mode?: "staff_seated" | "self_service" };
        pickup?: { enabled?: boolean; estimated_time_minutes?: number };
        delivery?: { enabled?: boolean };
      }
    | null
    | undefined;
  const prepMinutes =
    orderModesRaw?.pickup?.estimated_time_minutes ??
    locationRow.averagePrepTimeMinutes ??
    15;
  const dineInEnabled = orderModesRaw?.dine_in?.enabled !== false;
  const pickupEnabled = orderModesRaw?.pickup?.enabled !== false;
  const deliveryEnabled = orderModesRaw?.delivery?.enabled === true;
  const dineInMode =
    orderModesRaw?.dine_in?.guest_session_mode === "self_service"
      ? ("self_service" as const)
      : dineInEnabled
        ? ("staff_seated" as const)
        : null;
  const channels = {
    deliveryToTable: dineInEnabled && dineInMode === "staff_seated",
    selfPickup: dineInEnabled && dineInMode === "self_service",
    pickup: pickupEnabled,
    delivery: deliveryEnabled,
    dineInMode,
  };

  const [openSessions, standaloneOrders, locationTables] = await Promise.all([
    db.query.sessions.findMany({
      where: and(
        eq(sessions.locationId, locationId),
        eq(sessions.status, "open")
      ),
      columns: { id: true, tableId: true, guestCount: true, openedAt: true },
      with: {
        table: {
          columns: { id: true, tableNumber: true, displayId: true, section: true, status: true },
        },
      },
    }),
    db.query.orders.findMany({
      where: and(
        eq(orders.locationId, locationId),
        isNull(orders.sessionId),
        inArray(orders.orderType, ["pickup", "delivery", "dine_in"])
      ),
      orderBy: [desc(orders.updatedAt)],
      columns: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        notes: true,
        scheduledPickupAt: true,
        estimatedReadyAt: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        customer: { columns: { name: true, phone: true } },
      },
      limit: 100,
    }),
    db.query.tables.findMany({
      where: eq(tables.locationId, locationId),
      columns: {
        id: true,
        tableNumber: true,
        displayId: true,
        alerts: true,
        stage: true,
      },
    }),
  ]);

  const serviceRequests: OrdersServiceRequest[] = [];
  for (const table of locationTables) {
    const tableNumber = (table.displayId?.trim() || table.tableNumber).trim();
    if (hasWaiterRequestAlert(table.alerts as string[] | null)) {
      serviceRequests.push({
        id: `${table.id}:waiter`,
        tableId: table.id,
        tableNumber,
        requestType: "waiter",
      });
    }
    if (hasBillRequest(table.stage)) {
      serviceRequests.push({
        id: `${table.id}:bill`,
        tableId: table.id,
        tableNumber,
        requestType: "bill",
      });
    }
  }
  serviceRequests.sort((a, b) => {
    if (a.requestType !== b.requestType) {
      return a.requestType === "waiter" ? -1 : 1;
    }
    return a.tableNumber.localeCompare(b.tableNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  const tableOrders: OrdersUnifiedOrder[] = [];
  const sessionIds = openSessions.map((s) => s.id);

  if (sessionIds.length > 0) {
    const sessionOrders = await db.query.orders.findMany({
      where: and(
        inArray(orders.sessionId, sessionIds),
        ne(orders.status, "cancelled")
      ),
      orderBy: orders.wave,
      columns: {
        id: true,
        sessionId: true,
        wave: true,
        firedAt: true,
        status: true,
        orderNumber: true,
        orderType: true,
        paymentStatus: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        notes: true,
        estimatedReadyAt: true,
        createdAt: true,
        updatedAt: true,
        customerId: true,
      },
      with: {
        customer: { columns: { name: true, phone: true } },
      },
    });

    const sessionOrderIds = sessionOrders.map((o) => o.id);
    const sessionOrderItems =
      sessionOrderIds.length > 0
        ? await db
            .select({
              orderId: orderItems.orderId,
              id: orderItems.id,
              itemId: orderItems.itemId,
              itemName: orderItems.itemName,
              itemI18n: catalogItems.i18n,
              quantity: orderItems.quantity,
              lineTotal: orderItems.lineTotal,
              status: orderItems.status,
              voidedAt: orderItems.voidedAt,
              notes: orderItems.notes,
              seat: orderItems.seat,
              seatId: orderItems.seatId,
            })
            .from(orderItems)
            .leftJoin(catalogItems, eq(orderItems.itemId, catalogItems.id))
            .where(inArray(orderItems.orderId, sessionOrderIds))
        : [];

    const sessionSeatIds = [
      ...new Set(
        sessionOrderItems
          .map((i) => i.seatId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const seatsById = new Map<string, { seatNumber: number; guestName: string | null }>();
    if (sessionSeatIds.length > 0) {
      const seatRows = await db
        .select({
          id: seats.id,
          seatNumber: seats.seatNumber,
          guestName: seats.guestName,
        })
        .from(seats)
        .where(inArray(seats.id, sessionSeatIds));
      for (const row of seatRows) {
        seatsById.set(row.id, {
          seatNumber: row.seatNumber,
          guestName: row.guestName ?? null,
        });
      }
    }

    const sessionCustomizationsByItemId = await loadCustomizationsByOrderItemId(
      sessionOrderItems.filter((i) => !i.voidedAt).map((i) => i.id),
    );

    const sessionTimeline =
      sessionOrderIds.length > 0 && channels.deliveryToTable
        ? await db
            .select({
              orderId: orderTimeline.orderId,
              status: orderTimeline.status,
              createdAt: orderTimeline.createdAt,
            })
            .from(orderTimeline)
            .where(inArray(orderTimeline.orderId, sessionOrderIds))
            .orderBy(asc(orderTimeline.createdAt))
        : [];

    const sessionTimelineByOrder = new Map<
      string,
      Array<{ status: string; createdAt: Date | null }>
    >();
    for (const row of sessionTimeline) {
      const list = sessionTimelineByOrder.get(row.orderId) ?? [];
      list.push({ status: row.status, createdAt: row.createdAt });
      sessionTimelineByOrder.set(row.orderId, list);
    }

    const ordersBySession = new Map<string, typeof sessionOrders>();
    for (const o of sessionOrders) {
      if (o.sessionId) {
        const list = ordersBySession.get(o.sessionId) ?? [];
        list.push(o);
        ordersBySession.set(o.sessionId, list);
      }
    }

    const itemsByOrderId = new Map<string, typeof sessionOrderItems>();
    for (const i of sessionOrderItems) {
      if (i.voidedAt) continue;
      const list = itemsByOrderId.get(i.orderId) ?? [];
      list.push(i);
      itemsByOrderId.set(i.orderId, list);
    }

    // Delivery-to-table: kitchen tickets stay separate; served+unpaid roll into one table check.
    if (channels.deliveryToTable) {
      for (const sess of openSessions) {
        const table = sess.table;
        if (!table) continue;
        const rawTableNumber = table.tableNumber?.trim() || "?";
        const plainNumeric = rawTableNumber.match(/^(?:T)?(\d+)$/i)?.[1];
        const tableLabel = plainNumeric ? `T${plainNumeric}` : rawTableNumber;
        const sectionLabel =
          SECTION_LABELS[table.section ?? "main"] ?? table.section ?? "Main";

        const servedUnpaid: OrdersUnifiedOrder[] = [];

        for (const o of ordersBySession.get(sess.id) ?? []) {
          const items = (itemsByOrderId.get(o.id) ?? []).map((it) => {
            const customizations = sessionCustomizationsByItemId.get(it.id) ?? [];
            const seatMeta = it.seatId ? seatsById.get(it.seatId) : undefined;
            const seatGuestName =
              seatMeta?.guestName?.trim() ||
              o.customer?.name?.trim() ||
              null;
            return mapOrderLineToViewItem(it, {
              seatNumber: seatMeta?.seatNumber ?? (it.seat > 0 ? it.seat : null),
              seatGuestName,
              customizations: customizations.length > 0 ? customizations : undefined,
            });
          });
          if (items.length === 0) continue;

          const paymentStatus = (o.paymentStatus ?? "unpaid") as string;
          const status = mapOrderStatusToUnified(o.status, paymentStatus);
          const paymentState = resolveOrdersPaymentState(paymentStatus);
          const createdAt = o.createdAt?.getTime() ?? sess.openedAt?.getTime() ?? 0;
          const stageEnteredAt = buildStageEnteredAt(
            createdAt,
            sessionTimelineByOrder.get(o.id) ?? [],
          );
          const money = withDerivedTax({
            subtotal: parseFloat(String(o.subtotal ?? 0)) || 0,
            taxAmount: parseFloat(String(o.taxAmount ?? 0)) || 0,
            total: parseFloat(String(o.total ?? 0)) || 0,
            taxRatePercent,
          });
          const code = formatCounterOrderLabel({
            orderNumber: o.orderNumber,
            orderType: o.orderType ?? "dine_in",
            orderId: o.id,
          });

          const ticket: OrdersUnifiedOrder = {
            id: `order-${o.id}`,
            source: "table",
            label: code,
            sectionLabel,
            guestLabel: formatTableSeatGuestLabel(tableLabel, items),
            status,
            createdAt,
            updatedAt: o.updatedAt?.getTime() ?? createdAt,
            stageEnteredAt,
            subtotal: money.subtotal,
            taxAmount: money.taxAmount,
            total: money.total,
            itemCount: items.reduce((sum, item) => sum + item.qty, 0),
            items,
            waves: [],
            tableId: table.id,
            sessionId: sess.id,
            orderId: o.id,
            waveNumber: o.wave ?? 1,
            note: o.notes ?? undefined,
            needsAccept: status === "sent",
            paymentState,
            paymentMethod: null,
            targetEtaMinutes: resolveTargetEtaMinutes({
              estimatedReadyAt: o.estimatedReadyAt,
              createdAtMs: createdAt,
              preparingEnteredAtMs: stageEnteredAt.preparing ?? null,
              fallbackPrepMinutes: prepMinutes,
            }),
          };

          if (status === "served" && paymentState !== "paid") {
            servedUnpaid.push(ticket);
            continue;
          }
          if (status === "voided" || status === "refunded") {
            tableOrders.push(ticket);
            continue;
          }
          tableOrders.push(ticket);
        }

        const check = buildTableCheckOrder(
          servedUnpaid.map((t) => ({
            ...t,
            // buildTableCheckOrder reads table code from guestLabel / label
            label: tableLabel,
            guestLabel: `Table ${tableLabel}`,
          })),
        );
        if (check) tableOrders.push(check);
      }
    } else {
      for (const sess of openSessions) {
        const table = sess.table;
        if (!table) continue;
        const rawTableNumber = table.tableNumber?.trim() || "?";
        const plainNumeric = rawTableNumber.match(/^(?:T)?(\d+)$/i)?.[1];
        const label = plainNumeric ? `T${plainNumeric}` : rawTableNumber;
        const sectionLabel =
          SECTION_LABELS[table.section ?? "main"] ?? table.section ?? "Main";
        const guestCount = sess.guestCount ?? 0;
        const guestLabel = `${guestCount} guest${guestCount === 1 ? "" : "s"}`;
        const openedAt = sess.openedAt?.getTime() ?? Date.now();

        const sessOrders = (ordersBySession.get(sess.id) ?? []).sort(
          (a, b) => (a.wave ?? 1) - (b.wave ?? 1),
        );

        const waves: Array<{ number: number; status: OrdersWaveStatus }> = [];
        const allItems: OrdersViewItem[] = [];
        let total = 0;
        let subtotal = 0;
        let taxAmount = 0;

        for (const o of sessOrders) {
          const waveNum = o.wave ?? 1;
          const items = itemsByOrderId.get(o.id) ?? [];
          const statuses = items.map((i) => itemStatusToWaveStatus(i.status));
          let waveStatus: OrdersWaveStatus = "held";
          if (o.firedAt) {
            if (statuses.every((s) => s === "served")) waveStatus = "served";
            else if (statuses.some((s) => s === "ready")) waveStatus = "ready";
            else if (statuses.some((s) => s === "cooking")) waveStatus = "cooking";
            else waveStatus = "fired";
          } else {
            waveStatus = "held";
          }
          waves.push({ number: waveNum, status: waveStatus });
          for (const it of items) {
            const customizations = sessionCustomizationsByItemId.get(it.id) ?? [];
            allItems.push(
              mapOrderLineToViewItem(it, {
                customizations: customizations.length > 0 ? customizations : undefined,
              }),
            );
          }
          total += parseFloat(String(o.total ?? 0)) || 0;
          subtotal += parseFloat(String(o.subtotal ?? 0)) || 0;
          taxAmount += parseFloat(String(o.taxAmount ?? 0)) || 0;
        }

        let status: OrdersUnifiedStatus;
        if (waves.some((w) => w.status === "ready")) status = "ready";
        else if (waves.some((w) => w.status === "cooking")) status = "preparing";
        else if (waves.some((w) => w.status === "fired") || waves.some((w) => w.status === "held"))
          status = "sent";
        else if (waves.every((w) => w.status === "served")) status = "served";
        else status = "sent";

        const lastUpdated =
          sessOrders.length > 0
            ? Math.max(...sessOrders.map((o) => o.updatedAt?.getTime() ?? 0))
            : openedAt;

        if (allItems.length === 0) continue;

        const money = withDerivedTax({
          subtotal,
          taxAmount,
          total,
          taxRatePercent,
        });

        tableOrders.push({
          id: `table-${table.id}`,
          source: "table",
          label,
          sectionLabel,
          guestLabel,
          status,
          createdAt: openedAt,
          updatedAt: lastUpdated,
          subtotal: money.subtotal,
          taxAmount: money.taxAmount,
          total: money.total,
          itemCount: allItems.length,
          items: allItems,
          waves,
          tableId: table.id,
          sessionId: sess.id,
        });
      }
    }
  }

  // Closed delivery-to-table visits from today (after Paid → session close).
  if (channels.deliveryToTable) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const closedVisitFilters = [
      eq(orders.locationId, locationId),
      isNotNull(orders.sessionId),
      gte(orders.updatedAt, startOfToday),
      inArray(orders.status, ["completed", "cancelled"]),
    ];
    if (sessionIds.length > 0) {
      closedVisitFilters.push(notInArray(orders.sessionId, sessionIds));
    }

    const closedVisitOrders = await db.query.orders.findMany({
      where: and(...closedVisitFilters),
      orderBy: [desc(orders.updatedAt)],
      columns: {
        id: true,
        sessionId: true,
        wave: true,
        status: true,
        orderNumber: true,
        paymentStatus: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        notes: true,
        estimatedReadyAt: true,
        createdAt: true,
        updatedAt: true,
        tableId: true,
      },
      with: {
        table: {
          columns: {
            id: true,
            tableNumber: true,
            displayId: true,
            section: true,
          },
        },
      },
      limit: 100,
    });

    const closedVisitOrderIds = closedVisitOrders.map((o) => o.id);
    if (closedVisitOrderIds.length > 0) {
      const closedItems = await db
        .select({
          orderId: orderItems.orderId,
          id: orderItems.id,
          itemId: orderItems.itemId,
          itemName: orderItems.itemName,
          itemI18n: catalogItems.i18n,
          quantity: orderItems.quantity,
          lineTotal: orderItems.lineTotal,
          status: orderItems.status,
          voidedAt: orderItems.voidedAt,
          notes: orderItems.notes,
        })
        .from(orderItems)
        .leftJoin(catalogItems, eq(orderItems.itemId, catalogItems.id))
        .where(inArray(orderItems.orderId, closedVisitOrderIds));

      const closedCustomizationsByItemId = await loadCustomizationsByOrderItemId(
        closedItems.filter((i) => !i.voidedAt).map((i) => i.id),
      );

      const itemsByClosedOrderId = new Map<string, typeof closedItems>();
      for (const i of closedItems) {
        if (i.voidedAt) continue;
        const list = itemsByClosedOrderId.get(i.orderId) ?? [];
        list.push(i);
        itemsByClosedOrderId.set(i.orderId, list);
      }

      const closedBySession = new Map<string, OrdersUnifiedOrder[]>();
      for (const o of closedVisitOrders) {
        const table = o.table;
        if (!table || !o.sessionId) continue;
        const items = (itemsByClosedOrderId.get(o.id) ?? []).map((it) => {
          const customizations = closedCustomizationsByItemId.get(it.id) ?? [];
          return mapOrderLineToViewItem(it, {
            customizations: customizations.length > 0 ? customizations : undefined,
          });
        });
        if (items.length === 0) continue;

        const paymentStatus = (o.paymentStatus ?? "unpaid") as string;
        const status = mapOrderStatusToUnified(o.status, paymentStatus);
        const createdAt = o.createdAt?.getTime() ?? 0;
        const money = withDerivedTax({
          subtotal: parseFloat(String(o.subtotal ?? 0)) || 0,
          taxAmount: parseFloat(String(o.taxAmount ?? 0)) || 0,
          total: parseFloat(String(o.total ?? 0)) || 0,
          taxRatePercent,
        });
        const rawTableNumber = table.tableNumber?.trim() || "?";
        const plainNumeric = rawTableNumber.match(/^(?:T)?(\d+)$/i)?.[1];
        const tableLabel = plainNumeric ? `T${plainNumeric}` : rawTableNumber;
        const sectionLabel =
          SECTION_LABELS[table.section ?? "main"] ?? table.section ?? "Main";

        const ticket: OrdersUnifiedOrder = {
          id: `order-${o.id}`,
          source: "table",
          label: tableLabel,
          sectionLabel,
          guestLabel: `Table ${tableLabel}`,
          status,
          createdAt,
          updatedAt: o.updatedAt?.getTime() ?? createdAt,
          subtotal: money.subtotal,
          taxAmount: money.taxAmount,
          total: money.total,
          itemCount: items.reduce((sum, item) => sum + item.qty, 0),
          items,
          waves: [],
          tableId: table.id,
          sessionId: o.sessionId,
          orderId: o.id,
          waveNumber: o.wave ?? 1,
          note: o.notes ?? undefined,
          needsAccept: false,
          paymentState: "paid",
          paymentMethod: null,
        };
        const list = closedBySession.get(o.sessionId) ?? [];
        list.push(ticket);
        closedBySession.set(o.sessionId, list);
      }

      for (const members of closedBySession.values()) {
        const check = buildTableCheckOrder(members, { paid: true });
        if (check) tableOrders.push(check);
      }
    }
  }

  const standaloneOrderIds = standaloneOrders.map((o) => o.id);
  let standaloneItems: Array<{
    orderId: string;
    id: string;
    itemId: string | null;
    itemName: string | null;
    itemI18n: unknown;
    quantity: number | null;
    lineTotal: string | null;
    status: string;
    voidedAt: Date | null;
    notes: string | null;
  }> = [];
  let standaloneTimeline: Array<{
    orderId: string;
    status: string;
    createdAt: Date | null;
  }> = [];

  if (standaloneOrderIds.length > 0) {
    const [itemRows, timelineRows] = await Promise.all([
      db
        .select({
          orderId: orderItems.orderId,
          id: orderItems.id,
          itemId: orderItems.itemId,
          itemName: orderItems.itemName,
          itemI18n: catalogItems.i18n,
          quantity: orderItems.quantity,
          lineTotal: orderItems.lineTotal,
          status: orderItems.status,
          voidedAt: orderItems.voidedAt,
          notes: orderItems.notes,
        })
        .from(orderItems)
        .leftJoin(catalogItems, eq(orderItems.itemId, catalogItems.id))
        .where(inArray(orderItems.orderId, standaloneOrderIds)),
      db
        .select({
          orderId: orderTimeline.orderId,
          status: orderTimeline.status,
          createdAt: orderTimeline.createdAt,
        })
        .from(orderTimeline)
        .where(inArray(orderTimeline.orderId, standaloneOrderIds))
        .orderBy(asc(orderTimeline.createdAt)),
    ]);
    standaloneItems = itemRows;
    standaloneTimeline = timelineRows;
  }

  const standaloneCustomizationsByItemId = await loadCustomizationsByOrderItemId(
    standaloneItems.filter((i) => !i.voidedAt).map((i) => i.id),
  );

  const itemsByStandaloneOrder = new Map<string, OrdersViewItem[]>();
  for (const i of standaloneItems) {
    if (i.voidedAt) continue;
    const list = itemsByStandaloneOrder.get(i.orderId) ?? [];
    const customizations = standaloneCustomizationsByItemId.get(i.id) ?? [];
    list.push(
      mapOrderLineToViewItem(i, {
        customizations: customizations.length > 0 ? customizations : undefined,
      }),
    );
    itemsByStandaloneOrder.set(i.orderId, list);
  }

  const timelineByOrder = new Map<
    string,
    Array<{ status: string; createdAt: Date | null }>
  >();
  for (const row of standaloneTimeline) {
    const list = timelineByOrder.get(row.orderId) ?? [];
    list.push({ status: row.status, createdAt: row.createdAt });
    timelineByOrder.set(row.orderId, list);
  }

  const counterOrders: OrdersUnifiedOrder[] = standaloneOrders.map((o) => {
    const items = itemsByStandaloneOrder.get(o.id) ?? [];
    const paymentStatus = (o.paymentStatus ?? "unpaid") as string;
    const status = mapOrderStatusToUnified(o.status, paymentStatus);
    const source: OrdersOrderSource =
      o.orderType === "delivery"
        ? "delivery"
        : o.orderType === "pickup"
          ? "pickup"
          : "dine_in_no_table";
    const code = formatCounterOrderLabel({
      orderNumber: o.orderNumber,
      orderType: o.orderType,
      orderId: o.id,
    });
    const customerName = formatGuestContactLabel(
      o.customer?.name,
      o.customer?.phone,
      locationRow.country,
    );
    const paymentState = resolveOrdersPaymentState(paymentStatus);
    const createdAt = o.createdAt?.getTime() ?? 0;
    const stageEnteredAt = buildStageEnteredAt(createdAt, timelineByOrder.get(o.id) ?? []);
    const scheduledPickupAtMs = o.scheduledPickupAt?.getTime() ?? null;
    const scheduledParked =
      status === "sent" &&
      isScheduledOrderParked({
        scheduledPickupAt: o.scheduledPickupAt,
        prepMinutes:
          o.orderType === "delivery"
            ? orderModesRaw?.delivery?.estimated_time_minutes ?? prepMinutes
            : prepMinutes,
      });

    const money = withDerivedTax({
      subtotal: parseFloat(String(o.subtotal ?? 0)) || 0,
      taxAmount: parseFloat(String(o.taxAmount ?? 0)) || 0,
      total: parseFloat(String(o.total ?? 0)) || 0,
      taxRatePercent,
    });

    return {
      id: `order-${o.id}`,
      source,
      label: code,
      sectionLabel:
        source === "delivery" ? "Delivery" : source === "pickup" ? "Pickup" : "Dine",
      guestLabel: customerName,
      status,
      createdAt,
      updatedAt: o.updatedAt?.getTime() ?? 0,
      stageEnteredAt,
      subtotal: money.subtotal,
      taxAmount: money.taxAmount,
      total: money.total,
      itemCount: items.length,
      items,
      waves: [],
      orderId: o.id,
      note: o.notes ?? undefined,
      scheduledPickupAt: scheduledPickupAtMs,
      scheduledParked,
      paymentState,
      paymentMethod: null as OrdersPaymentMethod,
      targetEtaMinutes: resolveTargetEtaMinutes({
        estimatedReadyAt: o.estimatedReadyAt,
        createdAtMs: createdAt,
        preparingEnteredAtMs: stageEnteredAt.preparing ?? null,
        fallbackPrepMinutes: prepMinutes,
      }),
    };
  });

  const allOrders = [...tableOrders, ...counterOrders].sort(
    (a, b) => a.createdAt - b.createdAt
  );

  // Scheduled-release + ETA-slip guest pushes (idempotent). Staff board polls often enough.
  void processGuestOrderPushReminders(locationId);

  return {
    locationId,
    locationName,
    orders: allOrders,
    defaultPrepMinutes: prepMinutes,
    channels,
    serviceRequests,
  };
}
