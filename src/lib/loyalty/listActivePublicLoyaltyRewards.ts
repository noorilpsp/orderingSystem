import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { items, loyaltyRewards } from "@/db/schema";

export type PublicLoyaltyReward = {
  id: string;
  name: string;
  description: string | null;
  kind: "fixed_off" | "percent_off" | "free_item";
  pointsCost: number;
  summary: string;
  discountAmount: number | null;
  percentOff: number | null;
  maxDiscountAmount: number | null;
  menuItemId: string | null;
  menuItemName: string | null;
};

function formatSummary(input: {
  kind: PublicLoyaltyReward["kind"];
  discountAmount: number | null;
  percentOff: number | null;
  maxDiscountAmount: number | null;
  menuItemName: string | null;
}): string {
  switch (input.kind) {
    case "fixed_off":
      return `$${Number(input.discountAmount ?? 0).toFixed(2)} off`;
    case "percent_off":
      return `${input.percentOff}% off (max $${Number(input.maxDiscountAmount ?? 0).toFixed(2)})`;
    case "free_item":
      return input.menuItemName ? `Free ${input.menuItemName}` : "Free menu item";
    default: {
      const _exhaustive: never = input.kind;
      return _exhaustive;
    }
  }
}

export async function listActivePublicLoyaltyRewards(input: {
  merchantId: string;
  locationId: string;
}): Promise<PublicLoyaltyReward[]> {
  const rows = await db.query.loyaltyRewards.findMany({
    where: and(
      eq(loyaltyRewards.merchantId, input.merchantId),
      eq(loyaltyRewards.status, "active"),
      or(
        isNull(loyaltyRewards.locationId),
        eq(loyaltyRewards.locationId, input.locationId),
      ),
    ),
    orderBy: [asc(loyaltyRewards.pointsCost), asc(loyaltyRewards.name)],
  });

  const itemIds = rows
    .map((row) => row.menuItemId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const itemNameById = new Map<string, string>();
  if (itemIds.length > 0) {
    const menuItems = await db.query.items.findMany({
      where: inArray(items.id, itemIds),
      columns: { id: true, name: true },
    });
    for (const item of menuItems) {
      itemNameById.set(item.id, item.name);
    }
  }

  return rows.map((row) => {
    const discountAmount =
      row.discountAmount != null ? Number(row.discountAmount) : null;
    const maxDiscountAmount =
      row.maxDiscountAmount != null ? Number(row.maxDiscountAmount) : null;
    const menuItemName = row.menuItemId
      ? itemNameById.get(row.menuItemId) ?? null
      : null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      kind: row.kind,
      pointsCost: row.pointsCost,
      discountAmount,
      percentOff: row.percentOff,
      maxDiscountAmount,
      menuItemId: row.menuItemId,
      menuItemName,
      summary: formatSummary({
        kind: row.kind,
        discountAmount,
        percentOff: row.percentOff,
        maxDiscountAmount,
        menuItemName,
      }),
    };
  });
}
