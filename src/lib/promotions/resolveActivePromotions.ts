import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import { promotionItems, promotions } from "@/lib/db/schema/promotions";
import {
  applyCatalogPromo,
  type AppliedItemPromo,
  type PromotionKind,
} from "@/lib/promotions/pricing";
import { isPromotionScheduleActive } from "@/lib/promotions/schedule";
import { resolveStoreTimezone } from "@/lib/timezone/fromCountry";

export type { AppliedItemPromo, PromotionKind };

type PendingItemPromo = {
  promotionId: string;
  kind: PromotionKind;
  salePrice: number | null;
  displayOrder: number;
};

export async function listActiveItemPromos(
  locationId: string,
  itemIds?: string[],
  now = new Date(),
): Promise<Map<string, PendingItemPromo>> {
  const result = new Map<string, PendingItemPromo>();
  if (!locationId || (itemIds && itemIds.length === 0)) return result;

  const [location] = await db
    .select({
      timezone: merchantLocations.timezone,
      country: merchantLocations.country,
    })
    .from(merchantLocations)
    .where(eq(merchantLocations.id, locationId))
    .limit(1);

  const timezone = resolveStoreTimezone({
    country: location?.country,
    locationTimezone: location?.timezone,
  });

  const conditions = [
    eq(promotions.locationId, locationId),
    eq(promotions.status, "active"),
  ];
  if (itemIds && itemIds.length > 0) {
    conditions.push(inArray(promotionItems.itemId, itemIds));
  }

  const rows = await db
    .select({
      promotionId: promotions.id,
      kind: promotions.kind,
      displayOrder: promotions.displayOrder,
      startsOn: promotions.startsOn,
      endsOn: promotions.endsOn,
      startTime: promotions.startTime,
      endTime: promotions.endTime,
      activeDays: promotions.activeDays,
      itemId: promotionItems.itemId,
      salePrice: promotionItems.salePrice,
    })
    .from(promotions)
    .innerJoin(promotionItems, eq(promotionItems.promotionId, promotions.id))
    .where(and(...conditions));

  for (const row of rows) {
    if (
      !isPromotionScheduleActive(
        {
          startsOn: row.startsOn,
          endsOn: row.endsOn,
          activeDays: row.activeDays,
          startTime: row.startTime,
          endTime: row.endTime,
        },
        now,
        timezone,
      )
    ) {
      continue;
    }

    const next: PendingItemPromo = {
      promotionId: row.promotionId,
      kind: row.kind,
      salePrice: row.salePrice != null ? Number(row.salePrice) : null,
      displayOrder: row.displayOrder ?? 0,
    };
    const existing = result.get(row.itemId);
    if (!existing || (existing.kind !== "sale_price" && next.kind === "sale_price")) {
      result.set(row.itemId, next);
    }
  }

  return result;
}

export function finalizeItemPromo(
  catalogPrice: number,
  pending: PendingItemPromo | undefined,
): AppliedItemPromo | null {
  if (!pending) return null;
  return applyCatalogPromo(catalogPrice, pending);
}

export async function resolveItemPromos(
  locationId: string,
  catalogByItemId: Map<string, number>,
  now = new Date(),
): Promise<Map<string, AppliedItemPromo>> {
  const pending = await listActiveItemPromos(
    locationId,
    [...catalogByItemId.keys()],
    now,
  );
  const resolved = new Map<string, AppliedItemPromo>();
  for (const [itemId, catalogPrice] of catalogByItemId) {
    const applied = finalizeItemPromo(catalogPrice, pending.get(itemId));
    if (applied) resolved.set(itemId, applied);
  }
  return resolved;
}
