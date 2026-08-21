/**
 * Shared core logic for building KdsView from locationId.
 * Used by both getKdsView (server page) and GET /api/kds/view.
 * Caller must have validated auth and location access.
 */

import { eq, and, desc, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems } from "@/lib/db/schema/orders";
import { merchantLocations } from "@/lib/db/schema";
import { computeKitchenDelaysFromOrderItems } from "@/lib/pos/computeKitchenDelays";
import { computeKdsActions } from "@/lib/kds/computeKdsActions";
import { getLocationStationsWithSubstations } from "@/lib/kds/getLocationStations";
import type { KdsView, KdsOrder, KdsOrderItem, KdsStation, KdsDelay } from "@/lib/kds/kdsView";
import { isKdsView } from "@/lib/kds/kdsView";
import { formatGuestContactLabel } from "@/lib/orders/guestContactLabel";

/** KDS shows orders sent to kitchen. Dine-in: only fired waves (firedAt set). Pickup/delivery: included when placed (no fire step). */

export async function buildKdsView(locationId: string): Promise<KdsView | null> {
  const locationRow = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { id: true, name: true, country: true },
  });
  if (!locationRow) return null;

  const ordersList = await db.query.orders.findMany({
    where: and(
      eq(orders.locationId, locationId),
      or(isNotNull(orders.firedAt), inArray(orders.orderType, ["pickup", "delivery"]))
    ),
    orderBy: [desc(orders.firedAt), desc(orders.createdAt)],
    columns: {
      id: true,
      orderNumber: true,
      orderType: true,
      status: true,
      station: true,
      wave: true,
      firedAt: true,
      sessionId: true,
      tableId: true,
      createdAt: true,
      snoozedAt: true,
      snoozeUntil: true,
      wasSnoozed: true,
    },
    with: {
      table: { columns: { id: true, tableNumber: true } },
      customer: { columns: { id: true, name: true, phone: true } },
      session: {
        columns: { id: true, tableId: true },
        with: { table: { columns: { id: true, tableNumber: true } } },
      },
    },
    limit: 100,
  });

  const orderIds = ordersList.map((o) => o.id);
  let itemRows: Array<{
    id: string;
    orderId: string;
    itemName: string | null;
    quantity: number | null;
    notes: string | null;
    status: string;
    sentToKitchenAt: Date | null;
    startedAt: Date | null;
    readyAt: Date | null;
    servedAt: Date | null;
    voidedAt: Date | null;
    refiredAt: Date | null;
    stationOverride: string | null;
    seat: number | null;
    prepGroup: string | null;
    item: { defaultSubstation: string | null } | null;
  }> = [];

  if (orderIds.length > 0) {
    itemRows = await db.query.orderItems.findMany({
      where: inArray(orderItems.orderId, orderIds),
      columns: {
        id: true,
        orderId: true,
        itemName: true,
        quantity: true,
        notes: true,
        status: true,
        sentToKitchenAt: true,
        startedAt: true,
        readyAt: true,
        servedAt: true,
        voidedAt: true,
        refiredAt: true,
        stationOverride: true,
        seat: true,
        prepGroup: true,
      },
      with: {
        item: { columns: { defaultSubstation: true } },
      },
      orderBy: (i, { asc }) => [asc(i.createdAt)],
    });
  }

  const orderIdToStation = new Map(ordersList.map((o) => [o.id, o.station ?? null]));
  const tableNumberByOrderId = new Map(
    ordersList.map((o) => [
      o.id,
      o.session?.table?.tableNumber ?? o.table?.tableNumber ?? null,
    ])
  );
  const customerNameByOrderId = new Map(
    ordersList.map((o) => [
      o.id,
      o.customer
        ? formatGuestContactLabel(o.customer.name, o.customer.phone, locationRow.country)
        : null,
    ]),
  );

  const now = new Date();
  const kdsOrders: KdsOrder[] = ordersList.map((o) => {
    const snoozeUntil = o.snoozeUntil?.toISOString() ?? null;
    const isSnoozed =
      snoozeUntil != null && new Date(snoozeUntil).getTime() > now.getTime();
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      orderType: o.orderType,
      status: o.status,
      station: o.station ?? null,
      wave: o.wave ?? 1,
      firedAt: o.firedAt?.toISOString() ?? null,
      sessionId: o.sessionId ?? null,
      tableId: o.tableId ?? null,
      tableNumber: tableNumberByOrderId.get(o.id) ?? null,
      customerName: customerNameByOrderId.get(o.id) ?? null,
      createdAt: o.createdAt.toISOString(),
      snoozedAt: o.snoozedAt?.toISOString() ?? null,
      snoozeUntil,
      isSnoozed,
      wasSnoozed: o.wasSnoozed ?? false,
    };
  });

  const kdsOrderItems: KdsOrderItem[] = itemRows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    itemName: row.itemName ?? "",
    quantity: row.quantity ?? 1,
    notes: row.notes ?? null,
    status: row.status as KdsOrderItem["status"],
    sentToKitchenAt: row.sentToKitchenAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    readyAt: row.readyAt?.toISOString() ?? null,
    servedAt: row.servedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    refiredAt: row.refiredAt?.toISOString() ?? null,
    stationOverride: row.stationOverride ?? null,
    seatNumber: row.seat,
    substation: row.item?.defaultSubstation ?? null,
    prepGroup: row.prepGroup ?? null,
  }));

  const activeStations = await getLocationStationsWithSubstations(locationId);
  const stationKeyToMeta = new Map(
    activeStations.map((s) => [
      s.key,
      {
        id: s.key,
        name: s.name,
        displayOrder: s.displayOrder,
        substations: s.substations ?? [],
      },
    ])
  );

  if (stationKeyToMeta.size === 0) {
    stationKeyToMeta.set("kitchen", {
      id: "kitchen",
      name: "kitchen",
      displayOrder: 0,
      substations: [],
    });
  }

  const stations: KdsStation[] = Array.from(stationKeyToMeta.values())
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(({ id, name, displayOrder, substations }) => ({
      id,
      name,
      displayOrder,
      substations: substations.map((ss) => ({
        id: ss.id,
        key: ss.key,
        name: ss.name,
        displayOrder: ss.displayOrder,
      })),
    }));

  const delays: KdsDelay[] = computeKitchenDelaysFromOrderItems(
    itemRows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      sentToKitchenAt: r.sentToKitchenAt,
      readyAt: r.readyAt,
      voidedAt: r.voidedAt,
      stationOverride: r.stationOverride,
    })),
    orderIdToStation,
    { warningMinutes: 10 }
  );

  const actions = computeKdsActions(kdsOrderItems);

  const view: KdsView = {
    location: { id: locationRow.id, name: locationRow.name ?? undefined },
    orders: kdsOrders,
    orderItems: kdsOrderItems,
    stations,
    delays,
    actions,
  };

  if (!isKdsView(view)) return null;
  return view;
}
