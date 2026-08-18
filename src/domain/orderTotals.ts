"use server";

import { eq, and, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import {
  orders as ordersTable,
  orderItems as orderItemsTable,
  payments as paymentsTable,
} from "@/lib/db/schema/orders";

type DbOrTx = typeof db;

/**
 * Recalculate order totals from order_items (non-voided), applying the
 * location tax rate and service charge. Preserves tip and discount.
 */
export async function recalculateOrderTotals(
  orderId: string,
  dbOrTx: DbOrTx = db
): Promise<{
  ok: boolean;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  error?: string;
}> {
  const [order] = await dbOrTx
    .select({
      id: ordersTable.id,
      locationId: ordersTable.locationId,
      tipAmount: ordersTable.tipAmount,
      discountAmount: ordersTable.discountAmount,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order) return { ok: false, error: "Order not found" };

  const [location] = await dbOrTx
    .select({
      taxRate: merchantLocations.taxRate,
      serviceChargePercentage: merchantLocations.serviceChargePercentage,
    })
    .from(merchantLocations)
    .where(eq(merchantLocations.id, order.locationId))
    .limit(1);

  const [row] = await dbOrTx
    .select({
      subtotal: sql<string>`COALESCE(SUM((${orderItemsTable.lineTotal})::numeric), 0)::numeric`,
    })
    .from(orderItemsTable)
    .where(and(eq(orderItemsTable.orderId, orderId), isNull(orderItemsTable.voidedAt)));

  const subtotal = Number(row?.subtotal ?? 0);
  const taxRate = parseFloat(String(location?.taxRate ?? "0.00")) / 100;
  const serviceChargeRate =
    parseFloat(String(location?.serviceChargePercentage ?? "0.00")) / 100;
  const taxAmount = subtotal * taxRate;
  const serviceCharge = subtotal * serviceChargeRate;
  const tipAmount = parseFloat(String(order.tipAmount ?? "0"));
  const discountAmount = parseFloat(String(order.discountAmount ?? "0"));
  const total = Math.max(
    0,
    subtotal + taxAmount + serviceCharge + tipAmount - discountAmount,
  );

  const now = new Date();
  await dbOrTx
    .update(ordersTable)
    .set({
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      serviceCharge: serviceCharge.toFixed(2),
      total: total.toFixed(2),
      updatedAt: now,
    })
    .where(eq(ordersTable.id, orderId));

  return { ok: true, subtotal, taxAmount, total };
}

/**
 * Recalculate order totals for standalone (pickup/delivery) orders.
 * Same rules as recalculateOrderTotals (location tax + service charge).
 */
export async function recalculateStandaloneOrderTotals(
  orderId: string
): Promise<{ ok: boolean; subtotal?: number; error?: string }> {
  return recalculateOrderTotals(orderId);
}

export type SessionTotalsResult = {
  subtotal: number;
  total: number;
  paid: number;
  remaining: number;
};

/**
 * Recalculate session totals by aggregating all non-cancelled orders in the session.
 * Session totals = sum of order totals for the session.
 * Also returns paid (sum of completed payments) and remaining (total - paid).
 */
export async function recalculateSessionTotals(
  sessionId: string,
  dbOrTx: DbOrTx = db
): Promise<{ ok: boolean; subtotal?: number; total?: number; paid?: number; remaining?: number; error?: string }> {
  const orders = await dbOrTx
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(
      and(eq(ordersTable.sessionId, sessionId), ne(ordersTable.status, "cancelled"))
    );
  let subtotalSum = 0;
  let totalSum = 0;
  for (const o of orders) {
    const result = await recalculateOrderTotals(o.id, dbOrTx);
    if (result.ok) {
      subtotalSum += result.subtotal ?? 0;
      totalSum += result.total ?? result.subtotal ?? 0;
    }
  }
  const [paidRow] = await dbOrTx
    .select({
      paid: sql<string>`COALESCE(SUM((${paymentsTable.amount})::numeric), 0)::numeric`,
    })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.sessionId, sessionId),
        eq(paymentsTable.status, "completed")
      )
    );
  const paid = Number(paidRow?.paid ?? 0);
  const remaining = Math.max(0, totalSum - paid);
  return {
    ok: true,
    subtotal: subtotalSum,
    total: totalSum,
    paid,
    remaining,
  };
}
