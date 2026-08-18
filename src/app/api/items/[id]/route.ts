import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { items, categoryItems, itemTags, itemAllergens, itemCustomizations } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { getSubstationKeysForStation } from "@/lib/kds/getLocationStations";
import { getLocationStations } from "@/lib/kds/getLocationStations";
import { isLocationKdsEnabled } from "@/lib/merchant-features";
import { unstable_cache } from "@/lib/unstable-cache";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";
import { itemDetailCacheTag, revalidateItemDetail } from "@/lib/menu/itemDetailCache";

export const runtime = "nodejs";

/**
 * GET /api/items/[id]
 * Get a single item with all relations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    if (!itemId || itemId.trim() === "") {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Fetch item with all relations
    const getCachedItem = unstable_cache(
      async () => {
        const item = await db.query.items.findFirst({
          where: eq(items.id, itemId),
          with: {
            categoryItems: {
              with: {
                category: true,
              },
            },
            itemTags: {
              with: {
                tag: true,
              },
            },
            itemAllergens: {
              with: {
                allergen: true,
              },
            },
            itemCustomizations: {
              with: {
                group: {
                  with: {
                    options: true,
                  },
                },
              },
            },
            location: {
              columns: {
                id: true,
                merchantId: true,
              },
            },
          },
        });
        return item;
      },
      ["item-data", itemId],
      { revalidate: 300, tags: [itemDetailCacheTag(itemId)] }
    );

    const item = await getCachedItem();

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Check user has access to this location
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, item.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this item" },
        { status: 403 }
      );
    }

    return NextResponse.json(item, {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[GET /api/items/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch item",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/items/[id]
 * Update an item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    if (!itemId || itemId.trim() === "") {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Get existing item to verify access
    const existingItem = await db.query.items.findFirst({
      where: eq(items.id, itemId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingItem.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this item" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updateData: Partial<typeof items.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = body.price.toString();
    if (body.photoUrl !== undefined) updateData.photoUrl = body.photoUrl;
    if (body.calories !== undefined) updateData.calories = body.calories;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.featured !== undefined) updateData.featured = Boolean(body.featured);
    if (body.useCustomHours !== undefined) updateData.useCustomHours = body.useCustomHours;
    if (body.customSchedule !== undefined) updateData.customSchedule = body.customSchedule;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;
    if (body.i18n !== undefined) updateData.i18n = normalizeCatalogI18n(body.i18n);

    if (body.defaultStation !== undefined) {
      const locationId = existingItem.location.id;
      const kdsEnabled = await isLocationKdsEnabled(locationId);
      if (!kdsEnabled) {
        // Preserve existing station data; ignore updates while KDS is disabled.
      } else if (body.defaultStation == null || body.defaultStation === "") {
        updateData.defaultStation = null;
      } else {
        const stationKey = String(body.defaultStation).trim();
        if (stationKey.length > 50) {
          return NextResponse.json(
            { error: "defaultStation must be at most 50 characters" },
            { status: 400 }
          );
        }
        const activeStations = await getLocationStations(locationId);
        const isValid = activeStations.some((s) => s.key === stationKey);
        if (!isValid) {
          return NextResponse.json(
            { error: "defaultStation must be an active station key for this location" },
            { status: 400 }
          );
        }
        updateData.defaultStation = stationKey;
      }
    }

    if (body.defaultSubstation !== undefined) {
      const locationId = existingItem.location.id;
      const kdsEnabled = await isLocationKdsEnabled(locationId);
      if (!kdsEnabled) {
        // Preserve existing substation data; ignore updates while KDS is disabled.
      } else if (body.defaultSubstation == null || body.defaultSubstation === "") {
        updateData.defaultSubstation = null;
      } else {
        const stationKey = updateData.defaultStation ?? existingItem.defaultStation;
        const key = String(body.defaultSubstation).trim().toLowerCase();
        if (key.length <= 50 && stationKey) {
          const allowedKeys = await getSubstationKeysForStation(locationId, stationKey);
          updateData.defaultSubstation = allowedKeys.has(key) ? key : null;
        } else {
          updateData.defaultSubstation = null;
        }
      }
    }

    // Update item
    await db.update(items).set(updateData).where(eq(items.id, itemId));

    // Update relations if provided
    if (body.categoryIds !== undefined && Array.isArray(body.categoryIds)) {
      if (body.categoryIds.length > 0) {
        const existingLinks = await db.query.categoryItems.findMany({
          where: eq(categoryItems.itemId, itemId),
          columns: { categoryId: true, displayOrder: true },
        })
        const existingOrder = new Map(existingLinks.map((link) => [link.categoryId, link.displayOrder]))
        await db.delete(categoryItems).where(eq(categoryItems.itemId, itemId));
        await db.insert(categoryItems).values(
          body.categoryIds.map((categoryId: string, index: number) => ({
            categoryId,
            itemId,
            displayOrder: existingOrder.get(categoryId) ?? index,
          }))
        );
      } else {
        await db.delete(categoryItems).where(eq(categoryItems.itemId, itemId));
      }
    }

    if (body.tagIds !== undefined && Array.isArray(body.tagIds)) {
      await db.delete(itemTags).where(eq(itemTags.itemId, itemId));
      if (body.tagIds.length > 0) {
        await db.insert(itemTags).values(
          body.tagIds.map((tagId: string) => ({
            tagId,
            itemId,
          }))
        );
      }
    }

    if (body.allergenIds !== undefined && Array.isArray(body.allergenIds)) {
      await db.delete(itemAllergens).where(eq(itemAllergens.itemId, itemId));
      if (body.allergenIds.length > 0) {
        await db.insert(itemAllergens).values(
          body.allergenIds.map((allergenId: string) => ({
            allergenId,
            itemId,
          }))
        );
      }
    }

    if (body.customizationGroupIds !== undefined && Array.isArray(body.customizationGroupIds)) {
      await db.delete(itemCustomizations).where(eq(itemCustomizations.itemId, itemId));
      if (body.customizationGroupIds.length > 0) {
        await db.insert(itemCustomizations).values(
          body.customizationGroupIds.map((groupId: string, index: number) => ({
            groupId,
            itemId,
            displayOrder: index,
          }))
        );
      }
    }

    // Fetch updated item with relations
    const updatedItem = await db.query.items.findFirst({
      where: eq(items.id, itemId),
      with: {
        categoryItems: {
          with: {
            category: true,
          },
        },
        itemTags: {
          with: {
            tag: true,
          },
        },
        itemAllergens: {
          with: {
            allergen: true,
          },
        },
        itemCustomizations: {
          with: {
            group: true,
          },
        },
      },
    });

    await revalidatePublicMenuForLocation(existingItem.location.id);
    revalidateItemDetail(existingItem.id);
    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("[PUT /api/items/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to update item",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/items/[id]
 * Delete an item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    if (!itemId || itemId.trim() === "") {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Get existing item to verify access
    const existingItem = await db.query.items.findFirst({
      where: eq(items.id, itemId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingItem.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this item" },
        { status: 403 }
      );
    }

    // Delete item (cascade will handle related records)
    await db.delete(items).where(eq(items.id, itemId));

    await revalidatePublicMenuForLocation(existingItem.location.id);
    revalidateItemDetail(existingItem.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/items/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to delete item",
      },
      { status: 500 }
    );
  }
}
