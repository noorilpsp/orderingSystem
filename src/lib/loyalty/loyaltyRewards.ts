import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { loyaltyRewards, items } from "@/db/schema";
import { merchantUsers } from "@/lib/db/schema/merchant-users";
import { supabaseServer } from "@/lib/supabaseServer";

export type LoyaltyRewardKind = "fixed_off" | "percent_off" | "free_item";
export type LoyaltyRewardStatus = "active" | "inactive";

export type LoyaltyRewardDto = {
  id: string;
  merchantId: string;
  locationId: string | null;
  name: string;
  description: string | null;
  status: LoyaltyRewardStatus;
  kind: LoyaltyRewardKind;
  pointsCost: number;
  discountAmount: string | null;
  percentOff: number | null;
  maxDiscountAmount: string | null;
  menuItemId: string | null;
  menuItemName: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function requireMerchantMember(
  merchantId: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" }> {
  if (!merchantId.trim()) return { ok: false, error: "BAD_REQUEST" };
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, error: "UNAUTHORIZED" };

  const membership = await db.query.merchantUsers.findFirst({
    where: and(
      eq(merchantUsers.merchantId, merchantId),
      eq(merchantUsers.userId, user.id),
      eq(merchantUsers.isActive, true),
    ),
    columns: { id: true },
  });
  if (!membership) return { ok: false, error: "FORBIDDEN" };
  return { ok: true, userId: user.id };
}

function toDto(
  row: typeof loyaltyRewards.$inferSelect,
  menuItemName: string | null,
): LoyaltyRewardDto {
  return {
    id: row.id,
    merchantId: row.merchantId,
    locationId: row.locationId,
    name: row.name,
    description: row.description,
    status: row.status,
    kind: row.kind,
    pointsCost: row.pointsCost,
    discountAmount: row.discountAmount,
    percentOff: row.percentOff,
    maxDiscountAmount: row.maxDiscountAmount,
    menuItemId: row.menuItemId,
    menuItemName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listLoyaltyRewards(merchantId: string): Promise<LoyaltyRewardDto[]> {
  const rows = await db.query.loyaltyRewards.findMany({
    where: eq(loyaltyRewards.merchantId, merchantId),
    orderBy: [asc(loyaltyRewards.name)],
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

  return rows.map((row) =>
    toDto(row, row.menuItemId ? itemNameById.get(row.menuItemId) ?? null : null),
  );
}

export type CreateLoyaltyRewardInput = {
  merchantId: string;
  name: string;
  description?: string | null;
  status?: LoyaltyRewardStatus;
  kind: LoyaltyRewardKind;
  pointsCost: number;
  discountAmount?: number | null;
  percentOff?: number | null;
  maxDiscountAmount?: number | null;
  menuItemId?: string | null;
  locationId?: string | null;
};

export function validateRewardPayload(
  input: CreateLoyaltyRewardInput,
): string | null {
  if (!input.name.trim()) return "Name is required";
  if (!Number.isFinite(input.pointsCost) || input.pointsCost < 1) {
    return "Points cost must be at least 1";
  }
  switch (input.kind) {
    case "fixed_off": {
      if (
        typeof input.discountAmount !== "number" ||
        !Number.isFinite(input.discountAmount) ||
        input.discountAmount <= 0
      ) {
        return "Fixed discount amount must be greater than 0";
      }
      return null;
    }
    case "percent_off": {
      if (
        typeof input.percentOff !== "number" ||
        !Number.isFinite(input.percentOff) ||
        input.percentOff < 1 ||
        input.percentOff > 100
      ) {
        return "Percent off must be between 1 and 100";
      }
      if (
        typeof input.maxDiscountAmount !== "number" ||
        !Number.isFinite(input.maxDiscountAmount) ||
        input.maxDiscountAmount <= 0
      ) {
        return "Max discount amount is required for percent off rewards";
      }
      return null;
    }
    case "free_item": {
      if (!input.menuItemId?.trim()) return "Menu item is required for free item rewards";
      return null;
    }
    default: {
      const _exhaustive: never = input.kind;
      return `Unsupported reward kind: ${_exhaustive}`;
    }
  }
}

export async function createLoyaltyReward(
  input: CreateLoyaltyRewardInput,
): Promise<{ ok: true; reward: LoyaltyRewardDto } | { ok: false; error: string }> {
  const validationError = validateRewardPayload(input);
  if (validationError) return { ok: false, error: validationError };

  const [created] = await db
    .insert(loyaltyRewards)
    .values({
      merchantId: input.merchantId,
      locationId: input.locationId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.status ?? "active",
      kind: input.kind,
      pointsCost: Math.floor(input.pointsCost),
      discountAmount:
        input.kind === "fixed_off" && input.discountAmount != null
          ? input.discountAmount.toFixed(2)
          : null,
      percentOff: input.kind === "percent_off" ? Math.floor(input.percentOff!) : null,
      maxDiscountAmount:
        input.kind === "percent_off" && input.maxDiscountAmount != null
          ? input.maxDiscountAmount.toFixed(2)
          : null,
      menuItemId: input.kind === "free_item" ? input.menuItemId! : null,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) return { ok: false, error: "Failed to create reward" };

  let menuItemName: string | null = null;
  if (created.menuItemId) {
    const item = await db.query.items.findFirst({
      where: eq(items.id, created.menuItemId),
      columns: { name: true },
    });
    menuItemName = item?.name ?? null;
  }

  return { ok: true, reward: toDto(created, menuItemName) };
}

export type PatchLoyaltyRewardInput = Partial<CreateLoyaltyRewardInput> & {
  rewardId: string;
  merchantId: string;
};

export async function patchLoyaltyReward(
  input: PatchLoyaltyRewardInput,
): Promise<{ ok: true; reward: LoyaltyRewardDto } | { ok: false; error: string }> {
  const existing = await db.query.loyaltyRewards.findFirst({
    where: and(
      eq(loyaltyRewards.id, input.rewardId),
      eq(loyaltyRewards.merchantId, input.merchantId),
    ),
  });
  if (!existing) return { ok: false, error: "Reward not found" };

  const nextKind = input.kind ?? existing.kind;
  const merged: CreateLoyaltyRewardInput = {
    merchantId: input.merchantId,
    name: input.name ?? existing.name,
    description:
      input.description !== undefined ? input.description : existing.description,
    status: input.status ?? existing.status,
    kind: nextKind,
    pointsCost: input.pointsCost ?? existing.pointsCost,
    discountAmount:
      input.discountAmount !== undefined
        ? input.discountAmount
        : existing.discountAmount != null
          ? Number(existing.discountAmount)
          : null,
    percentOff:
      input.percentOff !== undefined ? input.percentOff : existing.percentOff,
    maxDiscountAmount:
      input.maxDiscountAmount !== undefined
        ? input.maxDiscountAmount
        : existing.maxDiscountAmount != null
          ? Number(existing.maxDiscountAmount)
          : null,
    menuItemId:
      input.menuItemId !== undefined ? input.menuItemId : existing.menuItemId,
    locationId:
      input.locationId !== undefined ? input.locationId : existing.locationId,
  };

  const validationError = validateRewardPayload(merged);
  if (validationError) return { ok: false, error: validationError };

  const [updated] = await db
    .update(loyaltyRewards)
    .set({
      name: merged.name.trim(),
      description: merged.description?.trim() || null,
      status: merged.status ?? "active",
      kind: merged.kind,
      pointsCost: Math.floor(merged.pointsCost),
      discountAmount:
        merged.kind === "fixed_off" && merged.discountAmount != null
          ? merged.discountAmount.toFixed(2)
          : null,
      percentOff: merged.kind === "percent_off" ? Math.floor(merged.percentOff!) : null,
      maxDiscountAmount:
        merged.kind === "percent_off" && merged.maxDiscountAmount != null
          ? merged.maxDiscountAmount.toFixed(2)
          : null,
      menuItemId: merged.kind === "free_item" ? merged.menuItemId! : null,
      locationId: merged.locationId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(loyaltyRewards.id, input.rewardId))
    .returning();

  if (!updated) return { ok: false, error: "Failed to update reward" };

  let menuItemName: string | null = null;
  if (updated.menuItemId) {
    const item = await db.query.items.findFirst({
      where: eq(items.id, updated.menuItemId),
      columns: { name: true },
    });
    menuItemName = item?.name ?? null;
  }

  return { ok: true, reward: toDto(updated, menuItemName) };
}
