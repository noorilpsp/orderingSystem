/**
 * Shared core logic for building GuestsView from locationId.
 * Used by getGuestsView (server page) and GET /api/guests/view.
 * Caller must have validated auth and location access.
 */

import { eq, and, isNotNull, isNull, desc, inArray, gte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  customerNotes,
  orders,
  orderItems,
  reservations,
} from "@/lib/db/schema/orders";
import { merchantLocations, loyaltyAccounts, merchants, normalizeLoyaltySettings } from "@/lib/db/schema";
import type {
  GuestsView,
  GuestsUnifiedGuest,
  GuestsSegment,
  GuestsVisit,
} from "./guestsView";

function deriveSegment(params: {
  totalVisits: number;
  noShows: number;
  lifetimeValue: number;
  daysSinceLastVisit: number;
  allLtvs: number[];
}): GuestsSegment {
  const { totalVisits, noShows, lifetimeValue, daysSinceLastVisit, allLtvs } =
    params;

  if (noShows >= 2) return "flagged";
  if (totalVisits <= 2) return "new";
  if (totalVisits >= 5 && daysSinceLastVisit > 45) return "at_risk";
  if (totalVisits >= 12) return "vip";
  const sorted = [...allLtvs].sort((a, b) => b - a);
  const top10Idx = Math.max(0, Math.ceil(sorted.length * 0.1) - 1);
  const vipThreshold = sorted[top10Idx] ?? 0;
  if (vipThreshold > 0 && lifetimeValue >= vipThreshold) return "vip";
  return "regular";
}

export async function buildGuestsView(
  locationId: string
): Promise<GuestsView | null> {
  const locationRow = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { id: true, name: true, merchantId: true },
  });
  if (!locationRow) return null;

  const locationName = locationRow.name ?? "Restaurant";
  const merchantId = locationRow.merchantId;

  const merchantRow = merchantId
    ? await db.query.merchants.findFirst({
        where: eq(merchants.id, merchantId),
        columns: { loyaltySettings: true },
      })
    : null;
  const loyaltySettings = normalizeLoyaltySettings(merchantRow?.loyaltySettings);

  const custRows = await db.query.customers.findMany({
    where: eq(customers.locationId, locationId),
    columns: {
      id: true,
      userId: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      birthday: true,
      anniversary: true,
      profileMeta: true,
    },
    orderBy: [desc(customers.createdAt)],
    limit: 500,
  });

  if (custRows.length === 0) {
    return {
      locationId,
      locationName,
      guests: [],
      segmentCounts: { all: 0, vip: 0, regular: 0, new: 0, at_risk: 0, flagged: 0 },
    };
  }

  const linkedUserIds = [
    ...new Set(
      custRows
        .map((c) => c.userId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  const balanceByUserId = new Map<string, number>();
  if (merchantId && linkedUserIds.length > 0) {
    const accountScope =
      loyaltySettings.pointsScope === "location"
        ? and(
            eq(loyaltyAccounts.merchantId, merchantId),
            eq(loyaltyAccounts.locationId, locationId),
            inArray(loyaltyAccounts.userId, linkedUserIds),
          )
        : and(
            eq(loyaltyAccounts.merchantId, merchantId),
            isNull(loyaltyAccounts.locationId),
            inArray(loyaltyAccounts.userId, linkedUserIds),
          );

    const accountRows = await db.query.loyaltyAccounts.findMany({
      where: accountScope,
      columns: { userId: true, balance: true },
    });
    for (const account of accountRows) {
      balanceByUserId.set(account.userId, account.balance);
    }
  }

  const customerIds = custRows.map((c) => c.id);
  const today = new Date().toISOString().slice(0, 10);

  const [orderRows, reservationRows, notesRows, upcomingResRows] =
    await Promise.all([
    db.query.orders.findMany({
      where: and(
        eq(orders.locationId, locationId),
        isNotNull(orders.customerId)
      ),
      columns: {
        id: true,
        customerId: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    }),
    db
      .select({
        customerId: reservations.customerId,
        status: reservations.status,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.locationId, locationId),
          isNotNull(reservations.customerId)
        )
      ),
    customerIds.length > 0
      ? db
          .select({
            customerId: customerNotes.customerId,
            id: customerNotes.id,
            authorName: customerNotes.authorName,
            role: customerNotes.role,
            text: customerNotes.text,
            createdAt: customerNotes.createdAt,
          })
          .from(customerNotes)
          .where(inArray(customerNotes.customerId, customerIds))
      : [],
    db
      .select({
        id: reservations.id,
        customerId: reservations.customerId,
        reservationDate: reservations.reservationDate,
        reservationTime: reservations.reservationTime,
        partySize: reservations.partySize,
        status: reservations.status,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.locationId, locationId),
          isNotNull(reservations.customerId),
          gte(reservations.reservationDate, today),
          or(
            eq(reservations.status, "pending"),
            eq(reservations.status, "confirmed")
          )
        )
      ),
  ]);

  const ordersByCustomer = new Map<
    string,
    Array<{
      id: string;
      orderNumber: string;
      total: number;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      completedAt: Date | null;
    }>
  >();
  for (const o of orderRows) {
    if (o.customerId) {
      const list = ordersByCustomer.get(o.customerId) ?? [];
      list.push({
        id: o.id,
        orderNumber: o.orderNumber ?? "",
        total: parseFloat(String(o.total ?? 0)) || 0,
        status: o.status ?? "",
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        completedAt: o.completedAt,
      });
      ordersByCustomer.set(o.customerId, list);
    }
  }

  const orderIdsForItems = orderRows
    .filter((o) => o.status === "completed" || o.status === "cancelled")
    .map((o) => o.id);
  const itemsRows =
    orderIdsForItems.length > 0
      ? await db
          .select({
            orderId: orderItems.orderId,
            itemName: orderItems.itemName,
            quantity: orderItems.quantity,
            voidedAt: orderItems.voidedAt,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIdsForItems))
      : [];
  const itemsByOrderId = new Map<string, string[]>();
  for (const row of itemsRows) {
    if (row.voidedAt) continue;
    const list = itemsByOrderId.get(row.orderId) ?? [];
    const label =
      (row.quantity ?? 1) > 1
        ? `${row.itemName ?? "Item"} x${row.quantity}`
        : (row.itemName ?? "Item");
    list.push(label);
    itemsByOrderId.set(row.orderId, list);
  }

  const notesByCustomer = new Map<
    string,
    Array<{
      id: string;
      authorName: string | null;
      role: string | null;
      text: string;
      createdAt: Date;
    }>
  >();
  for (const n of notesRows) {
    const list = notesByCustomer.get(n.customerId) ?? [];
    list.push({
      id: n.id,
      authorName: n.authorName,
      role: n.role,
      text: n.text,
      createdAt: n.createdAt,
    });
    notesByCustomer.set(n.customerId, list);
  }
  for (const list of notesByCustomer.values()) {
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const upcomingByCustomer = new Map<
    string,
    Array<{
      id: string;
      reservationDate: string;
      reservationTime: string;
      partySize: number;
      status: string;
    }>
  >();
  for (const r of upcomingResRows) {
    if (r.customerId) {
      const list = upcomingByCustomer.get(r.customerId) ?? [];
      list.push({
        id: r.id,
        reservationDate: r.reservationDate,
        reservationTime: r.reservationTime,
        partySize: r.partySize ?? 0,
        status: r.status ?? "",
      });
      upcomingByCustomer.set(r.customerId, list);
    }
  }
  for (const list of upcomingByCustomer.values()) {
    list.sort((a, b) => {
      const d = a.reservationDate.localeCompare(b.reservationDate);
      return d !== 0 ? d : a.reservationTime.localeCompare(b.reservationTime);
    });
  }

  const resNoShowsByCustomer = new Map<string, number>();
  const resCancelsByCustomer = new Map<string, number>();
  for (const r of reservationRows) {
    if (r.customerId) {
      if (r.status === "no_show") {
        resNoShowsByCustomer.set(
          r.customerId,
          (resNoShowsByCustomer.get(r.customerId) ?? 0) + 1
        );
      }
      if (r.status === "cancelled") {
        resCancelsByCustomer.set(
          r.customerId,
          (resCancelsByCustomer.get(r.customerId) ?? 0) + 1
        );
      }
    }
  }

  const allLtvs: number[] = [];
  for (const c of custRows) {
    const custOrders = ordersByCustomer.get(c.id) ?? [];
    const completedOrders = custOrders.filter((o) => o.status === "completed");
    const ltv = completedOrders.reduce((sum, o) => sum + o.total, 0);
    if (ltv > 0) allLtvs.push(ltv);
  }

  const favoriteItemsByCustomer = new Map<
    string,
    Array<{ name: string; frequency: number; total: number }>
  >();
  for (const c of custRows) {
    const custOrderIds = new Set(
      (ordersByCustomer.get(c.id) ?? [])
        .filter((o) => o.status === "completed")
        .map((o) => o.id)
    );
    const totalOrders = custOrderIds.size;
    const itemOrderCounts = new Map<string, number>();
    for (const row of itemsRows) {
      if (!custOrderIds.has(row.orderId) || row.voidedAt) continue;
      const name = row.itemName ?? "Item";
      itemOrderCounts.set(name, (itemOrderCounts.get(name) ?? 0) + 1);
    }
    const entries = [...itemOrderCounts.entries()]
      .map(([name, frequency]) => ({ name, frequency, total: totalOrders }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
    favoriteItemsByCustomer.set(c.id, entries);
  }

  const guestList: GuestsUnifiedGuest[] = [];
  for (const c of custRows) {
    const custOrders = ordersByCustomer.get(c.id) ?? [];
    const completedOrders = custOrders.filter((o) => o.status === "completed");
    const cancelledOrders = custOrders.filter((o) => o.status === "cancelled");

    const totalVisits = completedOrders.length;
    const lifetimeValue = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const avgSpend = totalVisits > 0 ? lifetimeValue / totalVisits : 0;

    const orderDates = custOrders.flatMap((o) => [
      o.createdAt.getTime(),
      o.updatedAt.getTime(),
    ]);
    const lastTs =
      orderDates.length > 0 ? Math.max(...orderDates) : c.createdAt.getTime();
    const firstTs =
      orderDates.length > 0 ? Math.min(...orderDates) : c.createdAt.getTime();

    const lastVisit = new Date(lastTs).toISOString().slice(0, 10);
    const firstVisit = new Date(firstTs).toISOString().slice(0, 10);

    const noShows = resNoShowsByCustomer.get(c.id) ?? 0;
    const resCancels = resCancelsByCustomer.get(c.id) ?? 0;
    const orderCancels = cancelledOrders.length;
    const cancellations = orderCancels + resCancels;

    const daysSinceLastVisit = Math.floor(
      (Date.now() - lastTs) / (1000 * 60 * 60 * 24)
    );

    const segment = deriveSegment({
      totalVisits,
      noShows,
      lifetimeValue,
      daysSinceLastVisit,
      allLtvs,
    });

    const visitOrders = custOrders
      .filter((o) => o.status === "completed" || o.status === "cancelled")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50);

    const meta = (c.profileMeta ?? {}) as {
      allergies?: Array<{ type: string; severity: "mild" | "moderate" | "severe" }>;
      dietary?: string[];
      preferences?: { seating?: string; zone?: string; server?: string; welcomeDrink?: string };
      tags?: string[];
    };
    const allergies = meta.allergies ?? [];
    const dietary = meta.dietary ?? [];
    const prefs = meta.preferences ?? {};
    const tags = meta.tags ?? [];

    const notes = (notesByCustomer.get(c.id) ?? []).map((n) => ({
      id: n.id,
      author: n.authorName ?? "Staff",
      role: n.role ?? "",
      date: n.createdAt.toISOString().slice(0, 10),
      text: n.text,
    }));

    const upcoming = (upcomingByCustomer.get(c.id) ?? []).map((r) => ({
      id: r.id,
      date: r.reservationDate,
      time: r.reservationTime,
      partySize: r.partySize,
      status: r.status,
    }));

    const favRaw = favoriteItemsByCustomer.get(c.id) ?? [];
    const favoriteItems = favRaw.map(({ name, frequency, total }) => ({
      name,
      frequency,
      total,
      percentage: total > 0 ? Math.round((frequency / total) * 100) : 0,
    }));

    const visits: GuestsVisit[] = visitOrders.map((o) => {
      const dt = o.completedAt ?? o.updatedAt ?? o.createdAt;
      const dateStr = dt.toISOString().slice(0, 10);
      const items = itemsByOrderId.get(o.id) ?? [];

      return {
        id: o.id,
        date: dateStr,
        total: o.total,
        status: o.status === "cancelled" ? "cancelled" : "completed",
        orderNumber: o.orderNumber,
        items,
      };
    });

    guestList.push({
      id: c.id,
      name: c.name?.trim() || "Guest",
      phone: c.phone ?? "",
      email: c.email ?? null,
      createdAt: c.createdAt.getTime(),
      totalVisits,
      lifetimeValue,
      avgSpend,
      lastVisit,
      firstVisit,
      noShows,
      cancellations,
      segment,
      visits,
      birthday: c.birthday ?? null,
      anniversary: c.anniversary ?? null,
      allergies,
      dietary,
      preferences: {
        seating: prefs.seating ?? null,
        zone: prefs.zone ?? null,
        server: prefs.server ?? null,
        welcomeDrink: prefs.welcomeDrink ?? null,
      },
      tags,
      staffNotes: notes,
      upcomingReservations: upcoming,
      favoriteItems,
      loyaltyPointsBalance: c.userId
        ? (balanceByUserId.get(c.userId) ?? 0)
        : null,
    });
  }

  guestList.sort((a, b) => b.createdAt - a.createdAt);

  const segmentCounts = {
    all: guestList.length,
    vip: guestList.filter((g) => g.segment === "vip").length,
    regular: guestList.filter((g) => g.segment === "regular").length,
    new: guestList.filter((g) => g.segment === "new").length,
    at_risk: guestList.filter((g) => g.segment === "at_risk").length,
    flagged: guestList.filter((g) => g.segment === "flagged").length,
  };

  return {
    locationId,
    locationName,
    guests: guestList,
    segmentCounts,
  };
}
