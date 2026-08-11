import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  loyaltyAccounts,
  loyaltyLedgerEntries,
  merchantLocations,
  merchants,
  normalizeLoyaltySettings,
  maxRedeemablePoints,
  pointsToDiscountAmount,
} from "@/db/schema";
import {
  consumePointLotsFifo,
  syncLoyaltyAccountBalance,
} from "@/lib/loyalty/loyaltyPointLots";

type DbOrTx = typeof db;

export type RedeemLoyaltyResult =
  | { ok: true; pointsRedeemed: number; discountAmount: number }
  | { ok: false; error: string };

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? "");
  return code === "23505" || message.toLowerCase().includes("unique");
}

export type ValidateRedeemInput = {
  userId: string;
  merchantId: string;
  locationId: string;
  subtotal: number;
  pointsToRedeem: number;
};

export type ValidateRedeemResult =
  | {
      ok: true;
      pointsToRedeem: number;
      discountAmount: number;
      settings: ReturnType<typeof normalizeLoyaltySettings>;
    }
  | { ok: false; error: string };

/**
 * Validate redeem eligibility and compute discount before order create.
 */
export async function validateLoyaltyRedeem(
  input: ValidateRedeemInput,
): Promise<ValidateRedeemResult> {
  const requested = Math.floor(input.pointsToRedeem);
  if (requested <= 0) {
    return { ok: false, error: "No points to redeem" };
  }

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, input.merchantId),
    columns: { id: true, loyaltySettings: true },
  });
  if (!merchant) {
    return { ok: false, error: "Merchant not found" };
  }

  const settings = normalizeLoyaltySettings(merchant.loyaltySettings);
  if (!settings.enabled) {
    return { ok: false, error: "Loyalty program is disabled" };
  }
  if (!settings.allowOpenWalletRedeem) {
    return {
      ok: false,
      error: "Open points redemption is disabled for this restaurant",
    };
  }

  if (!Number.isFinite(input.subtotal) || input.subtotal <= 0) {
    return { ok: false, error: "Invalid order subtotal" };
  }

  const accountLocationId =
    settings.pointsScope === "location" ? input.locationId : null;

  const account =
    accountLocationId === null
      ? await db.query.loyaltyAccounts.findFirst({
          where: and(
            eq(loyaltyAccounts.merchantId, input.merchantId),
            eq(loyaltyAccounts.userId, input.userId),
            isNull(loyaltyAccounts.locationId),
          ),
          columns: { id: true, balance: true },
        })
      : await db.query.loyaltyAccounts.findFirst({
          where: and(
            eq(loyaltyAccounts.merchantId, input.merchantId),
            eq(loyaltyAccounts.userId, input.userId),
            eq(loyaltyAccounts.locationId, accountLocationId),
          ),
          columns: { id: true, balance: true },
        });

  const balance = account
    ? await syncLoyaltyAccountBalance(db, account.id)
    : 0;
  const maxPoints = maxRedeemablePoints(balance, input.subtotal, settings);
  if (requested > maxPoints) {
    return { ok: false, error: "Points exceed redeemable amount for this order" };
  }

  const discountAmount = pointsToDiscountAmount(requested, settings);
  return {
    ok: true,
    pointsToRedeem: requested,
    discountAmount,
    settings,
  };
}

/**
 * Redeem loyalty points for an order (negative ledger + balance decrement).
 * Idempotent via unique (order_id, kind).
 */
export async function redeemLoyaltyPointsForOrder(
  input: {
    orderId: string;
    userId: string;
    merchantId: string;
    locationId: string;
    pointsToRedeem: number;
    subtotal: number;
  },
  dbOrTx: DbOrTx = db,
): Promise<RedeemLoyaltyResult> {
  const validated = await validateLoyaltyRedeem({
    userId: input.userId,
    merchantId: input.merchantId,
    locationId: input.locationId,
    subtotal: input.subtotal,
    pointsToRedeem: input.pointsToRedeem,
  });
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const { pointsToRedeem, discountAmount, settings } = validated;
  const accountLocationId =
    settings.pointsScope === "location" ? input.locationId : null;

  const run = async (tx: DbOrTx) => {
    const existingLedger = await tx.query.loyaltyLedgerEntries.findFirst({
      where: and(
        eq(loyaltyLedgerEntries.orderId, input.orderId),
        eq(loyaltyLedgerEntries.kind, "redeem"),
      ),
      columns: { id: true },
    });
    if (existingLedger) return;

    const account =
      accountLocationId === null
        ? await tx.query.loyaltyAccounts.findFirst({
            where: and(
              eq(loyaltyAccounts.merchantId, input.merchantId),
              eq(loyaltyAccounts.userId, input.userId),
              isNull(loyaltyAccounts.locationId),
            ),
          })
        : await tx.query.loyaltyAccounts.findFirst({
            where: and(
              eq(loyaltyAccounts.merchantId, input.merchantId),
              eq(loyaltyAccounts.userId, input.userId),
              eq(loyaltyAccounts.locationId, accountLocationId),
            ),
          });

    if (!account) {
      throw new Error("Insufficient loyalty balance");
    }

    const balance = await syncLoyaltyAccountBalance(tx, account.id);
    if (balance < pointsToRedeem) {
      throw new Error("Insufficient loyalty balance");
    }

    await consumePointLotsFifo(tx, account.id, pointsToRedeem);

    await tx.insert(loyaltyLedgerEntries).values({
      accountId: account.id,
      orderId: input.orderId,
      locationId: input.locationId,
      points: -pointsToRedeem,
      kind: "redeem",
    });

    await tx
      .update(loyaltyAccounts)
      .set({
        balance: sql`${loyaltyAccounts.balance} - ${pointsToRedeem}`,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccounts.id, account.id));
  };

  try {
    await run(dbOrTx);
    return { ok: true, pointsRedeemed: pointsToRedeem, discountAmount };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: true, pointsRedeemed: pointsToRedeem, discountAmount };
    }
    console.error("[redeemLoyaltyPointsForOrder]", input.orderId, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to redeem points",
    };
  }
}

export async function resolveMerchantIdForLocation(
  locationId: string,
): Promise<string | null> {
  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { merchantId: true },
  });
  return location?.merchantId ?? null;
}
