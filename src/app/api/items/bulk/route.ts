import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { categoryItems, items, itemTags } from "@/db/schema";
import { merchantUsers } from "@/lib/db/schema";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";
import { revalidateItemDetail } from "@/lib/menu/itemDetailCache";

export const runtime = "nodejs";

const ITEM_STATUSES = ["live", "soldout", "hidden", "draft"] as const;
type ItemStatus = (typeof ITEM_STATUSES)[number];

function isItemStatus(value: unknown): value is ItemStatus {
  return (
    typeof value === "string" &&
    (ITEM_STATUSES as readonly string[]).includes(value)
  );
}

function uniqueIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  ];
}

async function requireUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 }) };
  }
  return { user };
}

async function loadAuthorizedItems(itemIds: string[], userId: string) {
  const existingItems = await db.query.items.findMany({
    where: inArray(items.id, itemIds),
    columns: { id: true, locationId: true },
    with: {
      location: {
        columns: { id: true, merchantId: true },
      },
    },
  });

  if (existingItems.length !== itemIds.length) {
    return {
      error: NextResponse.json({ error: "One or more items were not found" }, { status: 404 }),
    };
  }

  const merchantIds = [...new Set(existingItems.map((item) => item.location.merchantId))];
  const memberships = await db.query.merchantUsers.findMany({
    where: and(
      eq(merchantUsers.userId, userId),
      eq(merchantUsers.isActive, true),
      inArray(merchantUsers.merchantId, merchantIds),
    ),
    columns: { merchantId: true },
  });
  const allowedMerchants = new Set(memberships.map((row) => row.merchantId));
  if (merchantIds.some((merchantId) => !allowedMerchants.has(merchantId))) {
    return {
      error: NextResponse.json(
        { error: "Forbidden - You don't have access to one or more items" },
        { status: 403 },
      ),
    };
  }

  return { existingItems };
}

async function revalidateAffectedMenus(
  existingItems: Array<{ id: string; locationId: string }>,
) {
  const locationIds = [...new Set(existingItems.map((item) => item.locationId))];
  await Promise.all(locationIds.map((locationId) => revalidatePublicMenuForLocation(locationId)));
  for (const item of existingItems) {
    revalidateItemDetail(item.id);
  }
}

/**
 * PATCH /api/items/bulk
 * Apply the same update to many items, then revalidate the guest menu once.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const itemIds = uniqueIds(body?.ids);
    const updates = body?.updates ?? {};

    if (itemIds.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const loaded = await loadAuthorizedItems(itemIds, auth.user.id);
    if ("error" in loaded) return loaded.error;
    const { existingItems } = loaded;

    const updateData: Partial<typeof items.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updates.status !== undefined) {
      if (!isItemStatus(updates.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = updates.status;
    }

    if (updates.featured !== undefined) {
      updateData.featured = Boolean(updates.featured);
    }

    const hasItemFields = updates.status !== undefined || updates.featured !== undefined;
    if (hasItemFields) {
      await db.update(items).set(updateData).where(inArray(items.id, itemIds));
    }

    const addTagIds = uniqueIds(updates.addTagIds);
    if (addTagIds.length > 0) {
      const existingLinks = await db.query.itemTags.findMany({
        where: inArray(itemTags.itemId, itemIds),
        columns: { itemId: true, tagId: true },
      });
      const existingKeys = new Set(existingLinks.map((link) => `${link.itemId}:${link.tagId}`));
      const rows = itemIds.flatMap((itemId) =>
        addTagIds
          .filter((tagId) => !existingKeys.has(`${itemId}:${tagId}`))
          .map((tagId) => ({ itemId, tagId })),
      );
      if (rows.length > 0) {
        await db.insert(itemTags).values(rows).onConflictDoNothing();
      }
    }

    const addCategoryIds = uniqueIds(updates.addCategoryIds);
    if (addCategoryIds.length > 0) {
      const existingLinks = await db.query.categoryItems.findMany({
        where: inArray(categoryItems.itemId, itemIds),
        columns: { itemId: true, categoryId: true },
      });
      const existingKeys = new Set(
        existingLinks.map((link) => `${link.itemId}:${link.categoryId}`),
      );
      const rows = itemIds.flatMap((itemId) =>
        addCategoryIds
          .filter((categoryId) => !existingKeys.has(`${itemId}:${categoryId}`))
          .map((categoryId) => ({ itemId, categoryId, displayOrder: 0 })),
      );
      if (rows.length > 0) {
        await db.insert(categoryItems).values(rows).onConflictDoNothing();
      }
    }

    if (
      !hasItemFields &&
      addTagIds.length === 0 &&
      addCategoryIds.length === 0
    ) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    await revalidateAffectedMenus(existingItems);
    return NextResponse.json({ success: true, updated: itemIds.length });
  } catch (error) {
    console.error("[PATCH /api/items/bulk] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to update items",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/items/bulk
 * Delete many items, then revalidate the guest menu once.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const itemIds = uniqueIds(body?.ids);

    if (itemIds.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const loaded = await loadAuthorizedItems(itemIds, auth.user.id);
    if ("error" in loaded) return loaded.error;
    const { existingItems } = loaded;

    await db.delete(items).where(inArray(items.id, itemIds));
    await revalidateAffectedMenus(existingItems);
    return NextResponse.json({ success: true, deleted: itemIds.length });
  } catch (error) {
    console.error("[DELETE /api/items/bulk] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to delete items",
      },
      { status: 500 },
    );
  }
}
