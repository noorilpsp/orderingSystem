import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  loyaltyAccounts,
  loyaltyLedgerEntries,
  merchantLocations,
  merchants,
  normalizeLoyaltySettings,
  orders,
} from "@/db/schema";
import { withTx } from "@/domain/tx";
import {
  computePointLotExpiresAt,
  createPointLotForEarn,
  syncLoyaltyAccountBalance,
} from "@/lib/loyalty/loyaltyPointLots";

export type AwardLoyaltyResult =
  | { ok: true; awarded: number; skipped?: undefined }
  | { ok: true; awarded: 0; skipped: string }
  | { ok: false; error: string };

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? "");
  return code === "23505" || message.toLowerCase().includes("unique");
}

/**
 * Award loyalty points when an order becomes completed.
 * Idempotent via unique ledger.order_id.
 */
export async function awardLoyaltyPointsForCompletedOrder(
  orderId: string,
): Promise<AwardLoyaltyResult> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: {
        id: true,
        locationId: true,
        customerId: true,
        subtotal: true,
        discountAmount: true,
        status: true,
      },
    });

    if (!order) return { ok: true, awarded: 0, skipped: "order_not_found" };
    if (order.status !== "completed") {
      return { ok: true, awarded: 0, skipped: "order_not_completed" };
    }
    if (!order.customerId) {
      return { ok: true, awarded: 0, skipped: "no_customer" };
    }

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, order.customerId),
      columns: { id: true, userId: true },
    });
    if (!customer?.userId) {
      return { ok: true, awarded: 0, skipped: "no_user" };
    }

    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, order.locationId),
      columns: { id: true, merchantId: true },
    });
    if (!location) {
      return { ok: true, awarded: 0, skipped: "location_not_found" };
    }

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, location.merchantId),
      columns: { id: true, loyaltySettings: true },
    });
    if (!merchant) {
      return { ok: true, awarded: 0, skipped: "merchant_not_found" };
    }

    const settings = normalizeLoyaltySettings(merchant.loyaltySettings);
    if (!settings.enabled) {
      return { ok: true, awarded: 0, skipped: "loyalty_disabled" };
    }

    const rawSubtotal = Number.parseFloat(order.subtotal);
    const discount = Number.parseFloat(order.discountAmount ?? "0");
    const subtotal = Math.max(
      0,
      (Number.isFinite(rawSubtotal) ? rawSubtotal : 0) -
        (Number.isFinite(discount) ? discount : 0),
    );
    if (subtotal <= 0) {
      return { ok: true, awarded: 0, skipped: "zero_subtotal" };
    }

    const points = Math.floor(subtotal * settings.pointsPerDollar);
    if (points <= 0) {
      return { ok: true, awarded: 0, skipped: "zero_points" };
    }

    const accountLocationId =
      settings.pointsScope === "location" ? order.locationId : null;

    const awarded = await withTx(async (tx) => {
      const existingLedger = await tx.query.loyaltyLedgerEntries.findFirst({
        where: and(
          eq(loyaltyLedgerEntries.orderId, orderId),
          eq(loyaltyLedgerEntries.kind, "earn"),
        ),
        columns: { id: true, points: true },
      });
      if (existingLedger) {
        return 0;
      }

      let account =
        accountLocationId === null
          ? await tx.query.loyaltyAccounts.findFirst({
              where: and(
                eq(loyaltyAccounts.merchantId, merchant.id),
                eq(loyaltyAccounts.userId, customer.userId!),
                isNull(loyaltyAccounts.locationId),
              ),
            })
          : await tx.query.loyaltyAccounts.findFirst({
              where: and(
                eq(loyaltyAccounts.merchantId, merchant.id),
                eq(loyaltyAccounts.userId, customer.userId!),
                eq(loyaltyAccounts.locationId, accountLocationId),
              ),
            });

      if (!account) {
        const [created] = await tx
          .insert(loyaltyAccounts)
          .values({
            merchantId: merchant.id,
            locationId: accountLocationId,
            userId: customer.userId!,
            balance: 0,
          })
          .returning();
        account = created;
      }

      if (!account) {
        throw new Error("Failed to create loyalty account");
      }

      await tx.insert(loyaltyLedgerEntries).values({
        accountId: account.id,
        orderId,
        locationId: order.locationId,
        points,
        kind: "earn",
      });

      const earnLedger = await tx.query.loyaltyLedgerEntries.findFirst({
        where: and(
          eq(loyaltyLedgerEntries.orderId, orderId),
          eq(loyaltyLedgerEntries.kind, "earn"),
        ),
        columns: { id: true },
      });

      if (earnLedger) {
        await createPointLotForEarn(tx, {
          accountId: account.id,
          earnLedgerEntryId: earnLedger.id,
          orderId,
          locationId: order.locationId,
          points,
          expiresAt: computePointLotExpiresAt(new Date(), settings),
        });
      }

      await tx
        .update(loyaltyAccounts)
        .set({
          balance: sql`${loyaltyAccounts.balance} + ${points}`,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyAccounts.id, account.id));

      return points;
    });

    return { ok: true, awarded };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: true, awarded: 0, skipped: "already_awarded" };
    }
    console.error("[awardLoyaltyPointsForCompletedOrder]", orderId, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to award points",
    };
  }
}

export async function awardLoyaltyPointsForCompletedOrders(
  orderIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(orderIds.filter(Boolean))];
  for (const orderId of uniqueIds) {
    try {
      await awardLoyaltyPointsForCompletedOrder(orderId);
    } catch (error) {
      console.error("[awardLoyaltyPointsForCompletedOrders]", orderId, error);
    }
  }
}

/**
 * Resolve current points balance for a diner at a merchant/location.
 */
export async function getLoyaltyBalanceForUser(input: {
  userId: string;
  merchantId: string;
  locationId: string;
}): Promise<number> {
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, input.merchantId),
    columns: { loyaltySettings: true },
  });
  const settings = normalizeLoyaltySettings(merchant?.loyaltySettings);

  const account =
    settings.pointsScope === "location"
      ? await db.query.loyaltyAccounts.findFirst({
          where: and(
            eq(loyaltyAccounts.merchantId, input.merchantId),
            eq(loyaltyAccounts.userId, input.userId),
            eq(loyaltyAccounts.locationId, input.locationId),
          ),
          columns: { id: true, balance: true },
        })
      : await db.query.loyaltyAccounts.findFirst({
          where: and(
            eq(loyaltyAccounts.merchantId, input.merchantId),
            eq(loyaltyAccounts.userId, input.userId),
            isNull(loyaltyAccounts.locationId),
          ),
          columns: { id: true, balance: true },
        });

  if (!account) return 0;
  return syncLoyaltyAccountBalance(db, account.id);
}
