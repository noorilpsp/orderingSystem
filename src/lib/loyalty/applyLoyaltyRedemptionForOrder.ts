import { and, eq, isNull, sql } from "drizzle-orm";
import type { PickupDeliveryLineItemInput } from "@/app/actions/orders";
import { db } from "@/db";
import {
  items,
  loyaltyAccounts,
  loyaltyLedgerEntries,
  loyaltyRewardRedemptions,
  loyaltyRewards,
  merchants,
  normalizeLoyaltySettings,
} from "@/db/schema";
import {
  redeemLoyaltyPointsForOrder,
  validateLoyaltyRedeem,
} from "@/lib/loyalty/redeemLoyaltyPointsForOrder";
import {
  consumePointLotsFifo,
  syncLoyaltyAccountBalance,
} from "@/lib/loyalty/loyaltyPointLots";

type DbOrTx = typeof db;

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? "");
  return code === "23505" || message.toLowerCase().includes("unique");
}

export type PrepareLoyaltyRedemptionInput = {
  userId: string;
  merchantId: string;
  locationId: string;
  subtotal: number;
  lineItems: PickupDeliveryLineItemInput[];
  pointsToRedeem?: number;
  rewardId?: string;
};

export type PreparedLoyaltyRedemption =
  | {
      ok: true;
      mode: "none";
      discountAmount: number;
      pointsToDebit: number;
      lineItems: PickupDeliveryLineItemInput[];
      subtotal: number;
      rewardId: null;
    }
  | {
      ok: true;
      mode: "wallet";
      discountAmount: number;
      pointsToDebit: number;
      lineItems: PickupDeliveryLineItemInput[];
      subtotal: number;
      rewardId: null;
    }
  | {
      ok: true;
      mode: "reward";
      discountAmount: number;
      pointsToDebit: number;
      lineItems: PickupDeliveryLineItemInput[];
      subtotal: number;
      rewardId: string;
    }
  | { ok: false; error: string };

async function resolveAccountBalance(input: {
  userId: string;
  merchantId: string;
  locationId: string;
  pointsScope: "merchant" | "location";
}): Promise<number> {
  const accountLocationId =
    input.pointsScope === "location" ? input.locationId : null;
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
  if (!account) return 0;
  return syncLoyaltyAccountBalance(db, account.id);
}

function applyFreeItemToLineItems(input: {
  lineItems: PickupDeliveryLineItemInput[];
  subtotal: number;
  menuItemId: string;
  menuItemName: string;
  station: string | null;
}): { lineItems: PickupDeliveryLineItemInput[]; subtotal: number } {
  const matchIndex = input.lineItems.findIndex(
    (line) => line.itemId === input.menuItemId,
  );

  if (matchIndex >= 0) {
    const line = input.lineItems[matchIndex]!;
    const customizationsTotal = Number(line.customizationsTotal);
    const oldLineTotal = Number(line.lineTotal);
    const newLineTotal = Math.max(0, customizationsTotal);
    const next = input.lineItems.map((entry, index) =>
      index === matchIndex
        ? {
            ...entry,
            itemPrice: "0.00",
            lineTotal: newLineTotal.toFixed(2),
            notes: [entry.notes, "Loyalty: free item"].filter(Boolean).join(" · "),
          }
        : entry,
    );
    return {
      lineItems: next,
      subtotal: Math.max(0, input.subtotal - (oldLineTotal - newLineTotal)),
    };
  }

  const freeLine: PickupDeliveryLineItemInput = {
    itemId: input.menuItemId,
    itemName: input.menuItemName,
    itemPrice: "0.00",
    quantity: 1,
    customizationsTotal: "0.00",
    lineTotal: "0.00",
    notes: "Loyalty: free item",
    stationOverride: input.station,
    customizations: [],
  };
  return {
    lineItems: [...input.lineItems, freeLine],
    subtotal: input.subtotal,
  };
}

/**
 * Validate xor wallet/reward redemption and compute discount / free-item line changes
 * before order insert.
 */
export async function prepareLoyaltyRedemptionForOrder(
  input: PrepareLoyaltyRedemptionInput,
): Promise<PreparedLoyaltyRedemption> {
  const requestedPoints = Math.floor(input.pointsToRedeem ?? 0);
  const rewardId = input.rewardId?.trim() || null;

  if (requestedPoints > 0 && rewardId) {
    return {
      ok: false,
      error: "Choose either loyalty points or a reward, not both",
    };
  }

  if (!rewardId && requestedPoints <= 0) {
    return {
      ok: true,
      mode: "none",
      discountAmount: 0,
      pointsToDebit: 0,
      lineItems: input.lineItems,
      subtotal: input.subtotal,
      rewardId: null,
    };
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

  if (requestedPoints > 0) {
    if (!settings.allowOpenWalletRedeem) {
      return {
        ok: false,
        error: "Open points redemption is disabled for this restaurant",
      };
    }
    const validated = await validateLoyaltyRedeem({
      userId: input.userId,
      merchantId: input.merchantId,
      locationId: input.locationId,
      subtotal: input.subtotal,
      pointsToRedeem: requestedPoints,
    });
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    return {
      ok: true,
      mode: "wallet",
      discountAmount: validated.discountAmount,
      pointsToDebit: validated.pointsToRedeem,
      lineItems: input.lineItems,
      subtotal: input.subtotal,
      rewardId: null,
    };
  }

  const reward = await db.query.loyaltyRewards.findFirst({
    where: and(
      eq(loyaltyRewards.id, rewardId!),
      eq(loyaltyRewards.merchantId, input.merchantId),
    ),
  });
  if (!reward || reward.status !== "active") {
    return { ok: false, error: "Reward is not available" };
  }
  if (reward.locationId && reward.locationId !== input.locationId) {
    return { ok: false, error: "Reward is not available at this location" };
  }
  if (reward.pointsCost <= 0) {
    return { ok: false, error: "Invalid reward" };
  }

  const balance = await resolveAccountBalance({
    userId: input.userId,
    merchantId: input.merchantId,
    locationId: input.locationId,
    pointsScope: settings.pointsScope,
  });
  if (balance < reward.pointsCost) {
    return { ok: false, error: "Not enough loyalty points for this reward" };
  }

  if (!Number.isFinite(input.subtotal) || input.subtotal < 0) {
    return { ok: false, error: "Invalid order subtotal" };
  }

  switch (reward.kind) {
    case "fixed_off": {
      const fixed = Number(reward.discountAmount ?? 0);
      if (!(fixed > 0)) {
        return { ok: false, error: "Invalid fixed discount reward" };
      }
      if (input.subtotal <= 0) {
        return { ok: false, error: "Add items before redeeming this reward" };
      }
      return {
        ok: true,
        mode: "reward",
        discountAmount: Math.min(fixed, input.subtotal),
        pointsToDebit: reward.pointsCost,
        lineItems: input.lineItems,
        subtotal: input.subtotal,
        rewardId: reward.id,
      };
    }
    case "percent_off": {
      const percent = reward.percentOff ?? 0;
      const maxDiscount = Number(reward.maxDiscountAmount ?? 0);
      if (!(percent > 0) || !(maxDiscount > 0)) {
        return { ok: false, error: "Invalid percent discount reward" };
      }
      if (input.subtotal <= 0) {
        return { ok: false, error: "Add items before redeeming this reward" };
      }
      const raw = (input.subtotal * percent) / 100;
      return {
        ok: true,
        mode: "reward",
        discountAmount: Math.min(raw, maxDiscount, input.subtotal),
        pointsToDebit: reward.pointsCost,
        lineItems: input.lineItems,
        subtotal: input.subtotal,
        rewardId: reward.id,
      };
    }
    case "free_item": {
      if (!reward.menuItemId) {
        return { ok: false, error: "Reward menu item is missing" };
      }
      const menuItem = await db.query.items.findFirst({
        where: and(
          eq(items.id, reward.menuItemId),
          eq(items.locationId, input.locationId),
        ),
        columns: {
          id: true,
          name: true,
          price: true,
          status: true,
          defaultStation: true,
        },
      });
      if (
        !menuItem ||
        menuItem.status === "draft" ||
        menuItem.status === "hidden"
      ) {
        return {
          ok: false,
          error: "Free item is unavailable — choose another reward",
        };
      }
      const applied = applyFreeItemToLineItems({
        lineItems: input.lineItems,
        subtotal: input.subtotal,
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        station: menuItem.defaultStation?.trim() || "kitchen",
      });
      return {
        ok: true,
        mode: "reward",
        discountAmount: 0,
        pointsToDebit: reward.pointsCost,
        lineItems: applied.lineItems,
        subtotal: applied.subtotal,
        rewardId: reward.id,
      };
    }
    default: {
      const _exhaustive: never = reward.kind;
      return { ok: false, error: `Unsupported reward kind: ${_exhaustive}` };
    }
  }
}

/**
 * Debit ledger (and catalog redemption row when applicable) after order create.
 * Idempotent on order redeem ledger + unique redemption per order.
 */
export async function applyLoyaltyRedemptionForOrder(
  input: {
    orderId: string;
    userId: string;
    merchantId: string;
    locationId: string;
    prepared: Extract<PreparedLoyaltyRedemption, { ok: true }>;
  },
  dbOrTx: DbOrTx = db,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { prepared } = input;
  if (prepared.mode === "none" || prepared.pointsToDebit <= 0) {
    return { ok: true };
  }

  if (prepared.mode === "wallet") {
    const result = await redeemLoyaltyPointsForOrder(
      {
        orderId: input.orderId,
        userId: input.userId,
        merchantId: input.merchantId,
        locationId: input.locationId,
        pointsToRedeem: prepared.pointsToDebit,
        subtotal: prepared.subtotal,
      },
      dbOrTx,
    );
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  const settingsMerchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, input.merchantId),
    columns: { loyaltySettings: true },
  });
  const settings = normalizeLoyaltySettings(settingsMerchant?.loyaltySettings);
  const accountLocationId =
    settings.pointsScope === "location" ? input.locationId : null;

  try {
    const existingLedger = await dbOrTx.query.loyaltyLedgerEntries.findFirst({
      where: and(
        eq(loyaltyLedgerEntries.orderId, input.orderId),
        eq(loyaltyLedgerEntries.kind, "redeem"),
      ),
      columns: { id: true },
    });
    if (existingLedger) {
      return { ok: true };
    }

    const account =
      accountLocationId === null
        ? await dbOrTx.query.loyaltyAccounts.findFirst({
            where: and(
              eq(loyaltyAccounts.merchantId, input.merchantId),
              eq(loyaltyAccounts.userId, input.userId),
              isNull(loyaltyAccounts.locationId),
            ),
          })
        : await dbOrTx.query.loyaltyAccounts.findFirst({
            where: and(
              eq(loyaltyAccounts.merchantId, input.merchantId),
              eq(loyaltyAccounts.userId, input.userId),
              eq(loyaltyAccounts.locationId, accountLocationId),
            ),
          });

    if (!account) {
      return { ok: false, error: "Insufficient loyalty balance" };
    }

    const balance = await syncLoyaltyAccountBalance(dbOrTx, account.id);
    if (balance < prepared.pointsToDebit) {
      return { ok: false, error: "Insufficient loyalty balance" };
    }

    await consumePointLotsFifo(dbOrTx, account.id, prepared.pointsToDebit);

    await dbOrTx.insert(loyaltyLedgerEntries).values({
      accountId: account.id,
      orderId: input.orderId,
      locationId: input.locationId,
      points: -prepared.pointsToDebit,
      kind: "redeem",
    });

    await dbOrTx
      .update(loyaltyAccounts)
      .set({
        balance: sql`${loyaltyAccounts.balance} - ${prepared.pointsToDebit}`,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccounts.id, account.id));

    if (prepared.rewardId) {
      await dbOrTx.insert(loyaltyRewardRedemptions).values({
        rewardId: prepared.rewardId,
        accountId: account.id,
        orderId: input.orderId,
        points: prepared.pointsToDebit,
      });
    }

    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: true };
    }
    console.error("[applyLoyaltyRedemptionForOrder]", input.orderId, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to redeem reward",
    };
  }
}
