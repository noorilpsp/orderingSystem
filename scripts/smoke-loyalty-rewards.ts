/**
 * Smoke checks for loyalty rewards catalog (v1).
 * Run: npx tsx scripts/smoke-loyalty-rewards.ts
 */
import { loadEnvConfig } from "@next/env";
import { and, eq, isNull } from "drizzle-orm";

loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import("../src/db");
  const {
    items,
    loyaltyAccounts,
    loyaltyRewards,
    merchantLocations,
    merchants,
    normalizeLoyaltySettings,
  } = await import("../src/db/schema");
  const { prepareLoyaltyRedemptionForOrder } = await import(
    "../src/lib/loyalty/applyLoyaltyRedemptionForOrder"
  );

  const failures: string[] = [];

  const merchant = await db.query.merchants.findFirst({
    columns: { id: true, loyaltySettings: true, name: true },
  });
  if (!merchant) {
    throw new Error("No merchant found - seed DB first");
  }

  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.merchantId, merchant.id),
    columns: { id: true, storeSlug: true },
  });
  if (!location) {
    throw new Error("No location for merchant");
  }

  const settings = normalizeLoyaltySettings(merchant.loyaltySettings);
  console.log("✓ loyalty settings normalize", {
    enabled: settings.enabled,
    allowOpenWalletRedeem: settings.allowOpenWalletRedeem,
  });

  const menuItem = await db.query.items.findFirst({
    where: eq(items.locationId, location.id),
    columns: { id: true, name: true, price: true, status: true },
  });
  const usableItem =
    menuItem && menuItem.status !== "draft" && menuItem.status !== "hidden"
      ? menuItem
      : null;

  const createdIds: string[] = [];
  const stamp = Date.now();

  const [fixed] = await db
    .insert(loyaltyRewards)
    .values({
      merchantId: merchant.id,
      name: `Smoke $5 ${stamp}`,
      status: "active",
      kind: "fixed_off",
      pointsCost: 50,
      discountAmount: "5.00",
    })
    .returning({ id: loyaltyRewards.id });
  createdIds.push(fixed!.id);

  const [percent] = await db
    .insert(loyaltyRewards)
    .values({
      merchantId: merchant.id,
      name: `Smoke 10% ${stamp}`,
      status: "active",
      kind: "percent_off",
      pointsCost: 80,
      percentOff: 10,
      maxDiscountAmount: "8.00",
    })
    .returning({ id: loyaltyRewards.id });
  createdIds.push(percent!.id);

  if (usableItem) {
    const [free] = await db
      .insert(loyaltyRewards)
      .values({
        merchantId: merchant.id,
        name: `Smoke free ${stamp}`,
        status: "active",
        kind: "free_item",
        pointsCost: 100,
        menuItemId: usableItem.id,
      })
      .returning({ id: loyaltyRewards.id });
    createdIds.push(free!.id);
  }

  const [inactive] = await db
    .insert(loyaltyRewards)
    .values({
      merchantId: merchant.id,
      name: `Smoke inactive ${stamp}`,
      status: "inactive",
      kind: "fixed_off",
      pointsCost: 10,
      discountAmount: "1.00",
    })
    .returning({ id: loyaltyRewards.id });
  createdIds.push(inactive!.id);

  console.log("✓ created three reward kinds (+ inactive)", { count: createdIds.length });

  try {
    const account = await db.query.loyaltyAccounts.findFirst({
      where: and(
        eq(loyaltyAccounts.merchantId, merchant.id),
        isNull(loyaltyAccounts.locationId),
      ),
      columns: { userId: true, balance: true },
    });

    if (!account || account.balance < 100) {
      console.log("⚠ skip redeem prepare checks (no loyalty account with ≥100 pts)");
    } else {
      const lineItems = [
        {
          itemId: usableItem?.id ?? null,
          itemName: usableItem?.name ?? "Item",
          itemPrice: "20.00",
          quantity: 1,
          customizationsTotal: "0.00",
          lineTotal: "20.00",
          notes: null,
          stationOverride: "kitchen",
          customizations: [],
        },
      ];

      const xor = await prepareLoyaltyRedemptionForOrder({
        userId: account.userId,
        merchantId: merchant.id,
        locationId: location.id,
        subtotal: 20,
        lineItems,
        pointsToRedeem: 10,
        rewardId: fixed!.id,
      });
      if (xor.ok) failures.push("xor should reject wallet+reward");
      else console.log("✓ xor reject", xor.error);

      const fixedPrep = await prepareLoyaltyRedemptionForOrder({
        userId: account.userId,
        merchantId: merchant.id,
        locationId: location.id,
        subtotal: 20,
        lineItems,
        rewardId: fixed!.id,
      });
      if (!fixedPrep.ok || fixedPrep.discountAmount !== 5) {
        failures.push(`fixed_off prepare failed: ${JSON.stringify(fixedPrep)}`);
      } else console.log("✓ fixed_off prepare", fixedPrep.discountAmount);

      const percentPrep = await prepareLoyaltyRedemptionForOrder({
        userId: account.userId,
        merchantId: merchant.id,
        locationId: location.id,
        subtotal: 20,
        lineItems,
        rewardId: percent!.id,
      });
      if (!percentPrep.ok || Math.abs(percentPrep.discountAmount - 2) > 0.001) {
        failures.push(`percent_off prepare failed: ${JSON.stringify(percentPrep)}`);
      } else console.log("✓ percent_off prepare", percentPrep.discountAmount);

      if (usableItem) {
        const freeId = createdIds.find((id) => id !== fixed!.id && id !== percent!.id && id !== inactive!.id)!;
        const freePrep = await prepareLoyaltyRedemptionForOrder({
          userId: account.userId,
          merchantId: merchant.id,
          locationId: location.id,
          subtotal: 20,
          lineItems,
          rewardId: freeId,
        });
        if (!freePrep.ok || freePrep.discountAmount !== 0) {
          failures.push(`free_item prepare failed: ${JSON.stringify(freePrep)}`);
        } else if (freePrep.lineItems.every((l) => Number(l.itemPrice) > 0)) {
          failures.push("free_item should zero matching line or add $0 line");
        } else console.log("✓ free_item prepare", {
          lines: freePrep.lineItems.length,
          subtotal: freePrep.subtotal,
        });
      }

      const inactivePrep = await prepareLoyaltyRedemptionForOrder({
        userId: account.userId,
        merchantId: merchant.id,
        locationId: location.id,
        subtotal: 20,
        lineItems,
        rewardId: inactive!.id,
      });
      if (inactivePrep.ok) failures.push("inactive reward should be rejected");
      else console.log("✓ inactive reward rejected");

      if (settings.allowOpenWalletRedeem) {
        const walletOffMerchant = {
          ...merchant,
          loyaltySettings: {
            ...settings,
            allowOpenWalletRedeem: false,
          },
        };
        await db
          .update(merchants)
          .set({ loyaltySettings: walletOffMerchant.loyaltySettings })
          .where(eq(merchants.id, merchant.id));
        try {
          const walletBlocked = await prepareLoyaltyRedemptionForOrder({
            userId: account.userId,
            merchantId: merchant.id,
            locationId: location.id,
            subtotal: 20,
            lineItems,
            pointsToRedeem: 10,
          });
          if (walletBlocked.ok) {
            failures.push("wallet should be blocked when allowOpenWalletRedeem=false");
          } else console.log("✓ wallet toggle off blocks open redeem", walletBlocked.error);
        } finally {
          await db
            .update(merchants)
            .set({ loyaltySettings: merchant.loyaltySettings })
            .where(eq(merchants.id, merchant.id));
        }
      }
    }
  } finally {
    for (const id of createdIds) {
      await db.delete(loyaltyRewards).where(eq(loyaltyRewards.id, id));
    }
    console.log("✓ cleaned up smoke rewards");
  }

  if (failures.length > 0) {
    console.error("SMOKE FAILED", failures);
    process.exit(1);
  }
  console.log("SMOKE PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
