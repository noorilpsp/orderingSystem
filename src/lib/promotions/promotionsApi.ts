import { and, asc, eq, inArray, max, ne } from "drizzle-orm";
import { db } from "@/db";
import { items, merchantLocations } from "@/db/schema";
import { promotionItems, promotions } from "@/lib/db/schema/promotions";
import { requireMerchantMember } from "@/lib/loyalty/loyaltyRewards";
import { roundMoney } from "@/lib/promotions/pricing";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";
import type {
  PromotionDto,
  PromotionItemDto,
  PromotionItemInput,
  PromotionKind,
  PromotionStatus,
} from "@/lib/promotions/types";

export type {
  PromotionDto,
  PromotionItemDto,
  PromotionItemInput,
  PromotionStatus,
  PromotionKind,
};

export type UpsertPromotionInput = {
  merchantId: string;
  locationId: string;
  name: string;
  kind: PromotionKind;
  status?: PromotionStatus;
  startsOn?: string | null;
  endsOn?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  activeDays?: string[] | null;
  items: PromotionItemInput[];
};

const WEEKDAYS = new Set([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

function normalizeDays(days: string[] | null | undefined): string[] | null {
  if (!days || days.length === 0) return null;
  const unique = [
    ...new Set(days.map((day) => day.trim().toLowerCase()).filter((day) => WEEKDAYS.has(day))),
  ];
  if (unique.length === 0 || unique.length === 7) return null;
  return unique;
}

function normalizeTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(":");
  return `${hours.padStart(2, "0")}:${minutes}`;
}

function normalizeDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function toDto(
  row: typeof promotions.$inferSelect,
  itemRows: PromotionItemDto[],
): PromotionDto {
  return {
    id: row.id,
    merchantId: row.merchantId,
    locationId: row.locationId,
    name: row.name,
    kind: row.kind,
    status: row.status,
    startsOn: row.startsOn ?? null,
    endsOn: row.endsOn ?? null,
    startTime: row.startTime,
    endTime: row.endTime,
    activeDays: row.activeDays,
    displayOrder: row.displayOrder ?? 0,
    items: itemRows,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadPromotionItems(
  promotionId: string,
): Promise<PromotionItemDto[]> {
  const rows = await db
    .select({
      itemId: promotionItems.itemId,
      salePrice: promotionItems.salePrice,
      name: items.name,
      catalogPrice: items.price,
    })
    .from(promotionItems)
    .innerJoin(items, eq(items.id, promotionItems.itemId))
    .where(eq(promotionItems.promotionId, promotionId))
    .orderBy(asc(items.name));

  return rows.map((row) => ({
    itemId: row.itemId,
    name: row.name,
    catalogPrice: Number(row.catalogPrice) || 0,
    salePrice: row.salePrice != null ? Number(row.salePrice) : null,
  }));
}

export async function listPromotionsForLocation(
  merchantId: string,
  locationId: string,
): Promise<PromotionDto[]> {
  const rows = await db.query.promotions.findMany({
    where: and(eq(promotions.merchantId, merchantId), eq(promotions.locationId, locationId)),
    orderBy: [asc(promotions.displayOrder), asc(promotions.createdAt)],
  });
  const result: PromotionDto[] = [];
  for (const row of rows) {
    result.push(toDto(row, await loadPromotionItems(row.id)));
  }
  return result;
}

async function validateUpsert(
  input: UpsertPromotionInput,
  excludePromotionId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  if (input.kind !== "sale_price" && input.kind !== "bogo") {
    return { ok: false, error: "Choose a sale price or buy 1 get 1" };
  }
  if (!input.locationId.trim()) return { ok: false, error: "Location is required" };
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "Pick an item" };
  }
  if (input.items.length !== 1) {
    return {
      ok: false,
      error: "A promotion is for one item. Create another promotion for a second item.",
    };
  }

  const itemIds = [...new Set(input.items.map((item) => item.itemId).filter(Boolean))];
  if (itemIds.length !== 1) return { ok: false, error: "Pick an item" };

  const location = await db.query.merchantLocations.findFirst({
    where: and(
      eq(merchantLocations.id, input.locationId),
      eq(merchantLocations.merchantId, input.merchantId),
    ),
    columns: { id: true },
  });
  if (!location) return { ok: false, error: "Location not found" };

  const catalogItems = await db.query.items.findMany({
    where: and(eq(items.locationId, input.locationId), inArray(items.id, itemIds)),
    columns: { id: true, name: true, price: true, status: true },
  });
  if (catalogItems.length !== itemIds.length) {
    return { ok: false, error: "One or more items are not on this location menu" };
  }
  const unpublished = catalogItems.find(
    (item) => item.status === "draft" || item.status === "hidden",
  );
  if (unpublished) {
    return {
      ok: false,
      error: `${unpublished.name} is not live on the guest menu. Make it live first, or pick a live item.`,
    };
  }
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));

  if (input.kind === "sale_price") {
    for (const entry of input.items) {
      const catalog = catalogById.get(entry.itemId);
      const salePrice = roundMoney(Number(entry.salePrice) || 0);
      if (!catalog || salePrice <= 0) {
        return { ok: false, error: "Enter a sale price below the catalog price" };
      }
      if (salePrice >= Number(catalog.price)) {
        return {
          ok: false,
          error: `Sale price for ${catalog.name} must be less than ${catalog.price}`,
        };
      }
    }
  }

  const overlapConditions = [
    eq(promotions.locationId, input.locationId),
    eq(promotions.status, "active"),
    inArray(promotionItems.itemId, itemIds),
  ];
  if (excludePromotionId) {
    overlapConditions.push(ne(promotions.id, excludePromotionId));
  }

  const overlapping = await db
    .select({ itemId: promotionItems.itemId, name: promotions.name })
    .from(promotionItems)
    .innerJoin(promotions, eq(promotions.id, promotionItems.promotionId))
    .where(and(...overlapConditions))
    .limit(1);

  if (overlapping[0] && (input.status ?? "active") === "active") {
    return {
      ok: false,
      error: `An item is already in another active promo (${overlapping[0].name})`,
    };
  }

  return { ok: true };
}

function itemRowsForKind(
  kind: PromotionKind,
  entries: PromotionItemInput[],
  promotionId: string,
) {
  return entries.map((entry) => ({
    promotionId,
    itemId: entry.itemId,
    salePrice:
      kind === "sale_price" && entry.salePrice != null
        ? roundMoney(entry.salePrice).toFixed(2)
        : null,
  }));
}

export async function createPromotion(
  input: UpsertPromotionInput,
): Promise<{ ok: true; promotion: PromotionDto } | { ok: false; error: string }> {
  const validation = await validateUpsert(input);
  if (!validation.ok) return validation;

  const [maxRow] = await db
    .select({ maxOrder: max(promotions.displayOrder) })
    .from(promotions)
    .where(eq(promotions.locationId, input.locationId));

  const [created] = await db
    .insert(promotions)
    .values({
      merchantId: input.merchantId,
      locationId: input.locationId,
      name: input.name.trim(),
      kind: input.kind,
      status: input.status ?? "active",
      startsOn: normalizeDate(input.startsOn),
      endsOn: normalizeDate(input.endsOn),
      startTime: normalizeTime(input.startTime),
      endTime: normalizeTime(input.endTime),
      activeDays: normalizeDays(input.activeDays),
      displayOrder: (maxRow?.maxOrder ?? -1) + 1,
      updatedAt: new Date(),
    })
    .returning();
  if (!created) return { ok: false, error: "Failed to create promotion" };

  await db.insert(promotionItems).values(itemRowsForKind(input.kind, input.items, created.id));
  await revalidatePublicMenuForLocation(created.locationId);

  return { ok: true, promotion: toDto(created, await loadPromotionItems(created.id)) };
}

export async function updatePromotion(
  promotionId: string,
  input: UpsertPromotionInput,
): Promise<{ ok: true; promotion: PromotionDto } | { ok: false; error: string }> {
  const existing = await db.query.promotions.findFirst({
    where: and(eq(promotions.id, promotionId), eq(promotions.merchantId, input.merchantId)),
  });
  if (!existing) return { ok: false, error: "Promotion not found" };

  const validation = await validateUpsert(input, promotionId);
  if (!validation.ok) return validation;

  const [updated] = await db
    .update(promotions)
    .set({
      name: input.name.trim(),
      kind: input.kind,
      status: input.status ?? existing.status,
      startsOn: normalizeDate(input.startsOn),
      endsOn: normalizeDate(input.endsOn),
      startTime: normalizeTime(input.startTime),
      endTime: normalizeTime(input.endTime),
      activeDays: normalizeDays(input.activeDays),
      updatedAt: new Date(),
    })
    .where(eq(promotions.id, promotionId))
    .returning();
  if (!updated) return { ok: false, error: "Failed to update promotion" };

  await db.delete(promotionItems).where(eq(promotionItems.promotionId, promotionId));
  await db.insert(promotionItems).values(itemRowsForKind(input.kind, input.items, promotionId));
  await revalidatePublicMenuForLocation(updated.locationId);

  return { ok: true, promotion: toDto(updated, await loadPromotionItems(promotionId)) };
}

export async function setPromotionStatus(
  merchantId: string,
  promotionId: string,
  status: PromotionStatus,
): Promise<{ ok: true; promotion: PromotionDto } | { ok: false; error: string }> {
  const existing = await db.query.promotions.findFirst({
    where: and(eq(promotions.id, promotionId), eq(promotions.merchantId, merchantId)),
  });
  if (!existing) return { ok: false, error: "Promotion not found" };

  if (status === "active") {
    const linked = await loadPromotionItems(promotionId);
    const validation = await validateUpsert(
      {
        merchantId,
        locationId: existing.locationId,
        name: existing.name,
        kind: existing.kind,
        status,
        startsOn: existing.startsOn,
        endsOn: existing.endsOn,
        startTime: existing.startTime,
        endTime: existing.endTime,
        activeDays: existing.activeDays,
        items: linked.map((item) => ({
          itemId: item.itemId,
          salePrice: item.salePrice,
        })),
      },
      promotionId,
    );
    if (!validation.ok) return validation;
  }

  const [updated] = await db
    .update(promotions)
    .set({ status, updatedAt: new Date() })
    .where(eq(promotions.id, promotionId))
    .returning();
  if (!updated) return { ok: false, error: "Failed to update promotion" };
  await revalidatePublicMenuForLocation(updated.locationId);
  return { ok: true, promotion: toDto(updated, await loadPromotionItems(promotionId)) };
}

export async function deletePromotion(
  merchantId: string,
  promotionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await db.query.promotions.findFirst({
    where: and(eq(promotions.id, promotionId), eq(promotions.merchantId, merchantId)),
    columns: { id: true, locationId: true },
  });
  if (!existing) return { ok: false, error: "Promotion not found" };
  await db.delete(promotions).where(eq(promotions.id, promotionId));
  await revalidatePublicMenuForLocation(existing.locationId);
  return { ok: true };
}

export async function reorderPromotions(
  merchantId: string,
  locationId: string,
  updates: Array<{ id: string; displayOrder: number }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const location = await db.query.merchantLocations.findFirst({
    where: and(
      eq(merchantLocations.id, locationId),
      eq(merchantLocations.merchantId, merchantId),
    ),
    columns: { id: true },
  });
  if (!location) return { ok: false, error: "Location not found" };

  const owned = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(
      and(eq(promotions.merchantId, merchantId), eq(promotions.locationId, locationId)),
    );
  const allowed = new Set(owned.map((row) => row.id));
  const validUpdates = updates.filter(
    (update) => allowed.has(update.id) && typeof update.displayOrder === "number",
  );

  await Promise.all(
    validUpdates.map((update) =>
      db
        .update(promotions)
        .set({ displayOrder: update.displayOrder, updatedAt: new Date() })
        .where(eq(promotions.id, update.id)),
    ),
  );
  await revalidatePublicMenuForLocation(locationId);
  return { ok: true };
}

export { requireMerchantMember };
