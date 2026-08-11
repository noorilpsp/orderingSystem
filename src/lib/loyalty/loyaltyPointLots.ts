import { and, asc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  loyaltyAccounts,
  loyaltyLedgerEntries,
  loyaltyPointLots,
  merchants,
  normalizeLoyaltySettings,
  type LoyaltySettings,
} from "@/db/schema";

type DbOrTx = typeof db;

export type LoyaltyPointsExpirySummary = {
  /** Earliest upcoming expiry among remaining lots. */
  nextExpiresAt: string | null;
  /** Points in the earliest-expiring batch. */
  pointsExpiringNext: number;
};

export async function resolveLoyaltyAccount(input: {
  userId: string;
  merchantId: string;
  locationId: string;
}): Promise<{ id: string } | null> {
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, input.merchantId),
    columns: { loyaltySettings: true },
  });
  const settings = normalizeLoyaltySettings(merchant?.loyaltySettings);
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
          columns: { id: true },
        })
      : await db.query.loyaltyAccounts.findFirst({
          where: and(
            eq(loyaltyAccounts.merchantId, input.merchantId),
            eq(loyaltyAccounts.userId, input.userId),
            eq(loyaltyAccounts.locationId, accountLocationId),
          ),
          columns: { id: true },
        });

  return account ?? null;
}

export function computePointLotExpiresAt(
  earnedAt: Date,
  settings: Pick<LoyaltySettings, "pointsExpirationMonths">,
): Date | null {
  const months = normalizeLoyaltySettings(settings).pointsExpirationMonths;
  if (months <= 0) return null;
  const expiresAt = new Date(earnedAt);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  return expiresAt;
}

export async function createPointLotForEarn(
  tx: DbOrTx,
  input: {
    accountId: string;
    earnLedgerEntryId: string;
    orderId: string;
    locationId: string;
    points: number;
    expiresAt: Date | null;
  },
): Promise<void> {
  if (input.points <= 0) return;
  await tx.insert(loyaltyPointLots).values({
    accountId: input.accountId,
    earnLedgerEntryId: input.earnLedgerEntryId,
    orderId: input.orderId,
    locationId: input.locationId,
    pointsInitial: input.points,
    pointsRemaining: input.points,
    expiresAt: input.expiresAt,
  });
}

async function listSpendableLots(tx: DbOrTx, accountId: string) {
  const now = new Date();
  return tx.query.loyaltyPointLots.findMany({
    where: and(
      eq(loyaltyPointLots.accountId, accountId),
      gt(loyaltyPointLots.pointsRemaining, 0),
      or(
        isNull(loyaltyPointLots.expiresAt),
        gt(loyaltyPointLots.expiresAt, now),
      ),
    ),
    orderBy: [
      asc(sql`COALESCE(${loyaltyPointLots.expiresAt}, 'infinity'::timestamptz)`),
      asc(loyaltyPointLots.createdAt),
    ],
  });
}

export async function consumePointLotsFifo(
  tx: DbOrTx,
  accountId: string,
  pointsNeeded: number,
): Promise<void> {
  if (pointsNeeded <= 0) return;

  const lots = await listSpendableLots(tx, accountId);
  let remaining = pointsNeeded;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.pointsRemaining, remaining);
    await tx
      .update(loyaltyPointLots)
      .set({ pointsRemaining: lot.pointsRemaining - take })
      .where(eq(loyaltyPointLots.id, lot.id));
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("Insufficient unexpired loyalty points");
  }
}

export async function expireStalePointLots(
  tx: DbOrTx,
  accountId: string,
): Promise<number> {
  const now = new Date();
  const expiredLots = await tx.query.loyaltyPointLots.findMany({
    where: and(
      eq(loyaltyPointLots.accountId, accountId),
      gt(loyaltyPointLots.pointsRemaining, 0),
      isNotNull(loyaltyPointLots.expiresAt),
      lte(loyaltyPointLots.expiresAt, now),
    ),
    orderBy: [asc(loyaltyPointLots.expiresAt), asc(loyaltyPointLots.createdAt)],
  });

  if (expiredLots.length === 0) return 0;

  let totalExpired = 0;
  for (const lot of expiredLots) {
    totalExpired += lot.pointsRemaining;
    await tx
      .update(loyaltyPointLots)
      .set({ pointsRemaining: 0 })
      .where(eq(loyaltyPointLots.id, lot.id));

    await tx.insert(loyaltyLedgerEntries).values({
      accountId,
      orderId: null,
      locationId: lot.locationId,
      points: -lot.pointsRemaining,
      kind: "expire",
    });
  }

  await tx
    .update(loyaltyAccounts)
    .set({
      balance: sql`${loyaltyAccounts.balance} - ${totalExpired}`,
      updatedAt: new Date(),
    })
    .where(eq(loyaltyAccounts.id, accountId));

  return totalExpired;
}

export async function reconcilePointLotsToBalance(
  tx: DbOrTx,
  accountId: string,
): Promise<void> {
  const account = await tx.query.loyaltyAccounts.findFirst({
    where: eq(loyaltyAccounts.id, accountId),
    columns: { balance: true },
  });
  if (!account) return;

  let lots = await tx.query.loyaltyPointLots.findMany({
    where: and(
      eq(loyaltyPointLots.accountId, accountId),
      gt(loyaltyPointLots.pointsRemaining, 0),
    ),
    orderBy: [
      asc(sql`COALESCE(${loyaltyPointLots.expiresAt}, 'infinity'::timestamptz)`),
      asc(loyaltyPointLots.createdAt),
    ],
  });

  const lotTotal = lots.reduce((sum, lot) => sum + lot.pointsRemaining, 0);
  let excess = lotTotal - account.balance;
  if (excess <= 0) return;

  for (const lot of lots) {
    if (excess <= 0) break;
    const reduceBy = Math.min(lot.pointsRemaining, excess);
    await tx
      .update(loyaltyPointLots)
      .set({ pointsRemaining: lot.pointsRemaining - reduceBy })
      .where(eq(loyaltyPointLots.id, lot.id));
    excess -= reduceBy;
  }
}

export async function syncLoyaltyAccountBalance(
  tx: DbOrTx,
  accountId: string,
): Promise<number> {
  await reconcilePointLotsToBalance(tx, accountId);
  await expireStalePointLots(tx, accountId);
  const account = await tx.query.loyaltyAccounts.findFirst({
    where: eq(loyaltyAccounts.id, accountId),
    columns: { balance: true },
  });
  return account?.balance ?? 0;
}

export async function getLoyaltyPointsExpirySummary(
  accountId: string,
): Promise<LoyaltyPointsExpirySummary> {
  await syncLoyaltyAccountBalance(db, accountId);

  const now = new Date();
  const lots = await db.query.loyaltyPointLots.findMany({
    where: and(
      eq(loyaltyPointLots.accountId, accountId),
      gt(loyaltyPointLots.pointsRemaining, 0),
      isNotNull(loyaltyPointLots.expiresAt),
      gt(loyaltyPointLots.expiresAt, now),
    ),
    orderBy: [asc(loyaltyPointLots.expiresAt), asc(loyaltyPointLots.createdAt)],
    columns: {
      expiresAt: true,
      pointsRemaining: true,
    },
  });

  if (lots.length === 0) {
    return { nextExpiresAt: null, pointsExpiringNext: 0 };
  }

  const earliest = lots[0]!;
  const earliestExpiry = earliest.expiresAt!;
  const pointsExpiringNext = lots
    .filter(
      (lot) =>
        lot.expiresAt &&
        lot.expiresAt.getTime() === earliestExpiry.getTime(),
    )
    .reduce((sum, lot) => sum + lot.pointsRemaining, 0);

  return {
    nextExpiresAt: earliestExpiry.toISOString(),
    pointsExpiringNext,
  };
}

export type PointLotSnapshot = {
  expiresAt: string | null;
  pointsRemaining: number;
};

function toLotDate(expiresAt: string | null): Date | null {
  if (!expiresAt) return null;
  const parsed = new Date(expiresAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Last calendar day the guest can afford this reward before point expirations
 * drop their balance below the cost.
 */
export function computeRewardGoodThroughDate(
  lots: PointLotSnapshot[],
  pointsCost: number,
): Date | null {
  if (pointsCost <= 0) return null;

  const active = lots
    .map((lot) => ({
      expiresAt: toLotDate(lot.expiresAt),
      pointsRemaining: lot.pointsRemaining,
    }))
    .filter((lot) => lot.pointsRemaining > 0);

  const total = active.reduce((sum, lot) => sum + lot.pointsRemaining, 0);
  if (total < pointsCost) return null;

  const expiring = active.filter((lot) => lot.expiresAt != null);
  if (expiring.length === 0) return null;

  const expiryTimes = [
    ...new Set(expiring.map((lot) => lot.expiresAt!.getTime())),
  ].sort((a, b) => a - b);

  let runningBalance = total;
  for (const expiryMs of expiryTimes) {
    const expiringPoints = expiring
      .filter((lot) => lot.expiresAt!.getTime() === expiryMs)
      .reduce((sum, lot) => sum + lot.pointsRemaining, 0);

    if (runningBalance >= pointsCost) {
      const afterExpiry = runningBalance - expiringPoints;
      if (afterExpiry < pointsCost) {
        return new Date(expiryMs);
      }
    }

    runningBalance -= expiringPoints;
  }

  const lastExpiryMs = expiryTimes[expiryTimes.length - 1];
  return lastExpiryMs != null ? new Date(lastExpiryMs) : null;
}

export function formatGoodThroughLabel(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `Good through ${month}-${day}-${year}`;
}

export async function getLoyaltyPointLotsSnapshot(
  accountId: string,
): Promise<PointLotSnapshot[]> {
  await syncLoyaltyAccountBalance(db, accountId);

  const lots = await db.query.loyaltyPointLots.findMany({
    where: and(
      eq(loyaltyPointLots.accountId, accountId),
      gt(loyaltyPointLots.pointsRemaining, 0),
    ),
    orderBy: [
      asc(sql`COALESCE(${loyaltyPointLots.expiresAt}, 'infinity'::timestamptz)`),
      asc(loyaltyPointLots.createdAt),
    ],
    columns: {
      expiresAt: true,
      pointsRemaining: true,
    },
  });

  return lots.map((lot) => ({
    expiresAt: lot.expiresAt?.toISOString() ?? null,
    pointsRemaining: lot.pointsRemaining,
  }));
}

export async function getRewardGoodThroughDate(
  accountId: string,
  pointsCost: number,
): Promise<string | null> {
  const lots = await getLoyaltyPointLotsSnapshot(accountId);
  const goodThrough = computeRewardGoodThroughDate(lots, pointsCost);
  return goodThrough ? formatGoodThroughLabel(goodThrough) : null;
}
