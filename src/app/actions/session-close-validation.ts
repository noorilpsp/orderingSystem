 "use server";

import { eq, and, inArray, sql, isNull } from "drizzle-orm";
import { db } from "@/db";

const DEV = process.env.NODE_ENV !== "production";

import {
  sessions as sessionsTable,
  orders as ordersTable,
  orderItems as orderItemsTable,
} from "@/lib/db/schema/orders";
import { canCloseSession as canCloseSessionLogic } from "@/domain/serviceFlow";

type DbOrTx = typeof db;

export type CanCloseSessionResult =
  | { ok: true }
  | { ok: false; reason: "session_not_open" }
  | { ok: false; reason: "unfinished_items"; items: UnfinishedItem[] }
  | { ok: false; reason: "unpaid_balance"; remaining: number; sessionTotal: number; paymentsTotal: number }
  | { ok: false; reason: "payment_in_progress" }
  | { ok: false; reason: "kitchen_mid_fire" };

export type UnfinishedItem = {
  id: string;
  itemName: string;
  status: string;
  quantity: number;
  orderId: string;
};

const UNFINISHED_STATUSES = ["pending", "preparing", "ready"] as const;

export type CanCloseSessionOptions = {
  /** Amount of incoming payment (not yet in DB) to include in payments total. Used when closing with payment. */
  incomingPaymentAmount?: number;
};

type OrderItemRow = typeof orderItemsTable.$inferSelect;

/** Check if a session can be closed. Returns structured result instead of throwing. */
export async function canCloseSession(
  sessionId: string,
  options?: CanCloseSessionOptions,
  dbOrTx: DbOrTx = db,
  preloadedOrderItems?: OrderItemRow[]
): Promise<CanCloseSessionResult> {
  const incomingAmount = options?.incomingPaymentAmount ?? 0;

  const tSession = DEV ? performance.now() : 0;
  const session = await dbOrTx.query.sessions.findFirst({
    where: eq(sessionsTable.id, sessionId),
    columns: { id: true, status: true },
  });
  if (DEV) {
    const ms = Math.round(performance.now() - tSession);
    // eslint-disable-next-line no-console
    console.log(`[pos][close] sessionById ${ms}ms rows=${session ? 1 : 0}`);
  }

  if (!session) {
    return { ok: false, reason: "session_not_open" };
  }
  if (session.status !== "open") {
    return { ok: false, reason: "session_not_open" };
  }

  const tOrders = DEV ? performance.now() : 0;
  const orders = await dbOrTx.query.orders.findMany({
    where: eq(ordersTable.sessionId, sessionId),
    columns: { id: true },
  });
  if (DEV) {
    const ms = Math.round(performance.now() - tOrders);
    // eslint-disable-next-line no-console
    console.log(`[pos][close] ordersBySession ${ms}ms rows=${orders.length}`);
  }
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) {
    return { ok: true };
  }

  const tItems = DEV ? performance.now() : 0;
  const orderItems =
    (preloadedOrderItems
      ? preloadedOrderItems.filter((i) => i.voidedAt == null)
      : await dbOrTx.query.orderItems.findMany({
          where: and(
            inArray(orderItemsTable.orderId, orderIds),
            isNull(orderItemsTable.voidedAt)
          ),
          columns: {
            id: true,
            orderId: true,
            itemName: true,
            status: true,
            quantity: true,
            sentToKitchenAt: true,
            startedAt: true,
          },
        }));
  if (DEV) {
    const ms = Math.round(performance.now() - tItems);
    // eslint-disable-next-line no-console
    console.log(`[pos][close] orderItems ${ms}ms rows=${orderItems.length}`);
  }

  const unfinishedItems = orderItems.filter((i) =>
    UNFINISHED_STATUSES.includes(i.status as (typeof UNFINISHED_STATUSES)[number])
  );
  const kitchenMidFire = orderItems.some(
    (i) => i.sentToKitchenAt != null && i.startedAt == null
  );

  const tMoney = DEV ? performance.now() : 0;
  const [moneyRow] = await dbOrTx
    .select({
      pending_count: sql<number>`(SELECT count(*)::int FROM payments WHERE session_id = ${sessionId} AND status IN ('pending'))`.as("pending_count"),
      orders_total: sql<string>`(SELECT COALESCE(SUM(total),0)::numeric FROM orders WHERE session_id = ${sessionId} AND status != 'cancelled')`.as("orders_total"),
      // Count session payments and per-order payments on this visit (avoid double-pay gaps).
      payments_total: sql<string>`(
        SELECT COALESCE(SUM(amount),0)::numeric FROM payments p
        WHERE p.status = 'completed'
          AND (
            p.session_id = ${sessionId}
            OR p.order_id IN (SELECT id FROM orders WHERE session_id = ${sessionId})
          )
      )`.as("payments_total"),
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);
  const pendingCount = moneyRow?.pending_count ?? 0;
  const sessionTotal = Number(moneyRow?.orders_total ?? 0);
  const paymentsTotal =
    Number(moneyRow?.payments_total ?? 0) +
    (Number.isFinite(incomingAmount) && incomingAmount >= 0
      ? incomingAmount
      : 0);
  const hasPaymentInProgress = pendingCount > 0;
  if (DEV) {
    const ms = Math.round(performance.now() - tMoney);
    // eslint-disable-next-line no-console
    console.log(
      `[pos][close] moneyAgg ${ms}ms pending=${pendingCount} ordersTotal=${sessionTotal} paymentsTotal=${paymentsTotal}`
    );
  }

  const remaining = sessionTotal - paymentsTotal;
  const tolerance = 0.01;
  const hasUnpaidBalance = remaining > tolerance;

  const ctx = {
    sessionStatus: session.status,
    hasUnfinishedItems: unfinishedItems.length > 0,
    hasKitchenMidFire: kitchenMidFire,
    hasPaymentInProgress,
    hasUnpaidBalance,
  };

  const closeResult = canCloseSessionLogic(ctx);
  if (!closeResult.ok) {
    if (unfinishedItems.length > 0) {
      return {
        ok: false,
        reason: "unfinished_items",
        items: unfinishedItems.map((i) => ({
          id: i.id,
          itemName: i.itemName,
          status: i.status,
          quantity: i.quantity ?? 1,
          orderId: i.orderId,
        })),
      };
    }
    if (kitchenMidFire) return { ok: false, reason: "kitchen_mid_fire" };
    if (hasPaymentInProgress) return { ok: false, reason: "payment_in_progress" };
    if (hasUnpaidBalance) {
      return {
        ok: false,
        reason: "unpaid_balance",
        remaining: Math.round(remaining * 100) / 100,
        sessionTotal: Math.round(sessionTotal * 100) / 100,
        paymentsTotal: Math.round(paymentsTotal * 100) / 100,
      };
    }
    return { ok: false, reason: "session_not_open" };
  }

  return { ok: true };
}

export type OutstandingItemsResult = {
  canClose: boolean;
  reason?:
    | "session_not_open"
    | "unfinished_items"
    | "unpaid_balance"
    | "payment_in_progress"
    | "kitchen_mid_fire";
  unfinishedItems?: UnfinishedItem[];
  remaining?: number;
};

/** Returns items and issues still blocking session closure. Useful for UI. */
export async function getSessionOutstandingItems(
  sessionId: string
): Promise<OutstandingItemsResult> {
  const result = await canCloseSession(sessionId);
  if (result.ok) {
    return { canClose: true };
  }
  return {
    canClose: false,
    reason: result.reason,
    ...(result.reason === "unfinished_items" && { unfinishedItems: result.items }),
    ...(result.reason === "unpaid_balance" && { remaining: result.remaining }),
  };
}

export async function getSessionOutstandingItemsFromOrderItems(
  sessionId: string,
  orderItems: OrderItemRow[]
): Promise<OutstandingItemsResult> {
  const result = await canCloseSession(sessionId, undefined, db, orderItems);
  if (result.ok) {
    return { canClose: true };
  }
  return {
    canClose: false,
    reason: result.reason,
    ...(result.reason === "unfinished_items" && { unfinishedItems: result.items }),
    ...(result.reason === "unpaid_balance" && { remaining: result.remaining }),
  };
}
