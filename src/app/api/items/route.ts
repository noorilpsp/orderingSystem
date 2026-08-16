import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { items, categoryItems, itemTags, itemAllergens, itemCustomizations } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { getLocationStations, getSubstationKeysForStation } from "@/lib/kds/getLocationStations";
import { isLocationKdsEnabled } from "@/lib/merchant-features";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";
import { resolveItemPromos } from "@/lib/promotions/resolveActivePromotions";

export const runtime = "nodejs";

/**
 * GET /api/items
 * List all items for a location
 * Query params: locationId (required), status? (filter by status)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const status = searchParams.get("status");

    if (!locationId) {
      return posFailure("BAD_REQUEST", "Location ID is required", { status: 400 });
    }

    // Verify location exists and user has access
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        merchantId: true,
      },
    });

    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "You don't have access to this location", { status: 403 });
    }

    // Fetch items with relations (no caching to ensure fresh data)
    const whereConditions = [eq(items.locationId, locationId)];
    if (status) {
      whereConditions.push(eq(items.status, status as any));
    }

    const rawItems = await db.query.items.findMany({
      where: and(...whereConditions),
      orderBy: [desc(items.displayOrder), desc(items.createdAt)],
      with: {
        categoryItems: {
          with: {
            category: {
              columns: {
                id: true,
                name: true,
              },
            },
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
      },
    });

    // Transform to match expected format
    const itemsList = rawItems.map((item) => ({
      ...item,
      categories: item.categoryItems?.map((ci) => ci.category.id) || [],
      tags: item.itemTags?.map((it) => it.tag.name) || [],
      allergens: item.itemAllergens?.map((ia) => ia.allergen.name) || [],
      customizationGroups: item.itemCustomizations?.map((ic) => ic.group.id) || [],
    }));

    const promoByItem = await resolveItemPromos(
      locationId,
      new Map(
        itemsList.map((item) => [
          item.id,
          typeof item.price === "string" ? parseFloat(item.price) : Number(item.price) || 0,
        ]),
      ),
    );
    const itemsWithPromo = itemsList.map((item) => ({
      ...item,
      activePromo: promoByItem.get(item.id) ?? null,
    }));

    const res = posSuccess(itemsWithPromo);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (error) {
    console.error("[GET /api/items] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to fetch items"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/items
 * Create a new item
 * Body: { locationId, name, description?, price, photoUrl?, calories?, status?, useCustomHours?, customSchedule?, displayOrder?, categoryIds?, tagIds?, allergenIds?, customizationGroupIds? }
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json().catch(() => ({}));
    const {
      locationId,
      name,
      description,
      price,
      photoUrl,
      calories,
      status,
      featured,
      useCustomHours,
      customSchedule,
      displayOrder,
      categoryIds,
      tagIds,
      allergenIds,
      customizationGroupIds,
      defaultStation,
      defaultSubstation,
      i18n,
    } = body;

    if (!locationId || !name || price === undefined) {
      return NextResponse.json(
        { error: "Location ID, name, and price are required" },
        { status: 400 }
      );
    }

    // Verify location exists and user has access
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        merchantId: true,
      },
    });

    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this location" },
        { status: 403 }
      );
    }

    // Validate defaultStation against active location_stations (only when KDS enabled)
    const kdsEnabled = await isLocationKdsEnabled(locationId);
    let validatedDefaultStation: string | null = null;
    let validatedDefaultSubstation: string | null = null;
    if (kdsEnabled) {
      if (defaultStation != null && defaultStation !== "") {
        const stationKey = String(defaultStation).trim();
        if (stationKey.length > 50) {
          return posFailure("BAD_REQUEST", "defaultStation must be at most 50 characters", { status: 400 });
        }
        const activeStations = await getLocationStations(locationId);
        const isValid = activeStations.some((s) => s.key === stationKey);
        if (!isValid) {
          return posFailure(
            "BAD_REQUEST",
            "defaultStation must be an active station key for this location",
            { status: 400 }
          );
        }
        validatedDefaultStation = stationKey;
      }

      if (defaultSubstation != null && defaultSubstation !== "" && validatedDefaultStation) {
        const key = String(defaultSubstation).trim().toLowerCase();
        if (key.length <= 50) {
          const allowedKeys = await getSubstationKeysForStation(locationId, validatedDefaultStation);
          if (allowedKeys.has(key)) {
            validatedDefaultSubstation = key;
          }
        }
      }
    }

    // Create item
    const nextStatus = status || "draft";
    const nextFeatured = Boolean(featured);

    const [newItem] = await db
      .insert(items)
      .values({
        locationId,
        name,
        description: description || null,
        price: price.toString(),
        photoUrl: photoUrl || null,
        calories: calories || null,
        status: nextStatus,
        featured: nextFeatured,
        useCustomHours: useCustomHours ?? false,
        customSchedule: customSchedule || null,
        displayOrder: displayOrder ?? 0,
        defaultStation: validatedDefaultStation,
        defaultSubstation: validatedDefaultSubstation,
        i18n: i18n !== undefined ? normalizeCatalogI18n(i18n) : null,
      })
      .returning();

    // Create relations if provided
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
      await db.insert(categoryItems).values(
        categoryIds.map((categoryId: string, index: number) => ({
          categoryId,
          itemId: newItem.id,
          displayOrder: index,
        }))
      );
    }

    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      await db.insert(itemTags).values(
        tagIds.map((tagId: string) => ({
          tagId,
          itemId: newItem.id,
        }))
      );
    }

    if (allergenIds && Array.isArray(allergenIds) && allergenIds.length > 0) {
      await db.insert(itemAllergens).values(
        allergenIds.map((allergenId: string) => ({
          allergenId,
          itemId: newItem.id,
        }))
      );
    }

    if (customizationGroupIds && Array.isArray(customizationGroupIds) && customizationGroupIds.length > 0) {
      await db.insert(itemCustomizations).values(
        customizationGroupIds.map((groupId: string, index: number) => ({
          groupId,
          itemId: newItem.id,
          displayOrder: index,
        }))
      );
    }

    // Fetch the complete item with relations
    const completeItem = await db.query.items.findFirst({
      where: eq(items.id, newItem.id),
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

    return NextResponse.json(completeItem, { status: 201 });
  } catch (error) {
    console.error("[POST /api/items] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to create item",
      },
      { status: 500 }
    );
  }
}
