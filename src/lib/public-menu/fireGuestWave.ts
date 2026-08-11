import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems as orderItemsTable,
  orders as ordersTable,
  sessionEvents as sessionEventsTable,
} from "@/lib/db/schema/orders";
import { emit } from "@/domain/emitter";
import { canFireWave } from "@/domain/serviceFlow";

type DbOrTx = typeof db;

export async function fireGuestWave(
  orderId: string,
  sessionId: string,
  dbOrTx: DbOrTx = db,
): Promise<{ ok: true; wave: number; firedAt: Date } | { ok: false; message: string }> {
  const order = await dbOrTx.query.orders.findFirst({
    where: eq(ordersTable.id, orderId),
    columns: { id: true, sessionId: true, wave: true, firedAt: true },
  });
  if (!order) {
    return { ok: false, message: "Order not found" };
  }
  if (order.sessionId !== sessionId) {
    return { ok: false, message: "Order does not belong to session" };
  }

  const fireResult = canFireWave({ firedAt: order.firedAt });
  if (!fireResult.ok) {
    return { ok: false, message: "Wave already fired" };
  }

  const now = new Date();

  await dbOrTx
    .update(ordersTable)
    .set({
      firedAt: now,
      status: "confirmed",
      updatedAt: now,
    })
    .where(eq(ordersTable.id, orderId));

  const items = await dbOrTx.query.orderItems.findMany({
    where: and(eq(orderItemsTable.orderId, orderId), isNull(orderItemsTable.sentToKitchenAt)),
    columns: { id: true, quantity: true },
  });

  for (const item of items) {
    await dbOrTx
      .update(orderItemsTable)
      .set({ sentToKitchenAt: now })
      .where(eq(orderItemsTable.id, item.id));
  }

  await dbOrTx.insert(sessionEventsTable).values({
    sessionId,
    type: "course_fired",
    actorType: "customer",
    meta: {
      source: "guest_menu",
      wave: order.wave,
      firedAt: now.toISOString(),
    },
  });

  const itemCount = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  const affectedItems = items.map((item) => item.id);

  void emit({
    type: "wave.fired",
    payload: {
      sessionId,
      orderId,
      wave: order.wave,
      firedAt: now.toISOString(),
      itemCount,
      affectedItems,
    },
  });

  return { ok: true, wave: order.wave, firedAt: now };
}
