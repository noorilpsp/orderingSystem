import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { items as itemsTable } from "@/lib/db/schema/menus";
import {
  orderItems as orderItemsTable,
  orders as ordersTable,
} from "@/lib/db/schema/orders";
import {
  assignBogoPaidQuantities,
  roundMoney,
} from "@/lib/promotions/pricing";
import { resolveItemPromos } from "@/lib/promotions/resolveActivePromotions";

type DbOrTx = typeof db;

export async function repricePromoLines(args: {
  locationId: string;
  orderId: string;
  sessionId?: string | null;
  itemIds: string[];
  dbOrTx?: DbOrTx;
}): Promise<void> {
  const itemIds = [...new Set(args.itemIds.filter(Boolean))];
  if (itemIds.length === 0) return;

  const dbOrTx = args.dbOrTx ?? db;

  const catalogRows = await dbOrTx
    .select({ id: itemsTable.id, price: itemsTable.price })
    .from(itemsTable)
    .where(inArray(itemsTable.id, itemIds));
  const catalogById = new Map(
    catalogRows.map((row) => [row.id, Number(row.price) || 0]),
  );

  const promoByItem = await resolveItemPromos(args.locationId, catalogById);

  const lines = await dbOrTx
    .select({
      id: orderItemsTable.id,
      itemId: orderItemsTable.itemId,
      quantity: orderItemsTable.quantity,
      customizationsTotal: orderItemsTable.customizationsTotal,
      createdAt: orderItemsTable.createdAt,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(
      and(
        args.sessionId
          ? eq(ordersTable.sessionId, args.sessionId)
          : eq(ordersTable.id, args.orderId),
        inArray(orderItemsTable.itemId, itemIds),
        isNull(orderItemsTable.voidedAt),
      ),
    )
    .orderBy(asc(orderItemsTable.createdAt));

  const byItem = new Map<string, typeof lines>();
  for (const line of lines) {
    if (!line.itemId) continue;
    const list = byItem.get(line.itemId) ?? [];
    list.push(line);
    byItem.set(line.itemId, list);
  }

  for (const [itemId, itemLines] of byItem) {
    const catalogPrice = catalogById.get(itemId) ?? 0;
    const promo = promoByItem.get(itemId);
    const unitPrice = promo?.price ?? catalogPrice;
    const paidById =
      promo?.kind === "bogo"
        ? assignBogoPaidQuantities(
            itemLines.map((line) => ({ id: line.id, quantity: line.quantity })),
          )
        : null;

    for (const line of itemLines) {
      const qty = Math.max(1, Math.floor(line.quantity));
      const paidQty = paidById?.get(line.id) ?? qty;
      const customizations = Number(line.customizationsTotal) || 0;
      const lineTotal = roundMoney(paidQty * unitPrice + customizations);

      await dbOrTx
        .update(orderItemsTable)
        .set({
          itemPrice: unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        })
        .where(eq(orderItemsTable.id, line.id));
    }
  }
}
