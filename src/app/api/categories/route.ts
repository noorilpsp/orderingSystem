import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc, desc } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { categories, menuCategories, categoryItems, menus } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { unstable_cache } from "@/lib/unstable-cache";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { withDbRetry, toUserFacingDbError } from "@/lib/db/withDbRetry";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";

export const runtime = "nodejs";

/**
 * GET /api/categories
 * List all categories for a location
 * Query params: locationId (required)
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

    // Fetch categories with item counts
    const getCachedCategories = unstable_cache(
      async () => {
        const categoriesList = await db.query.categories.findMany({
          where: eq(categories.locationId, locationId),
          orderBy: [asc(categories.displayOrder), desc(categories.createdAt)],
          with: {
            menuCategories: {
              with: {
                menu: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            categoryItems: true,
          },
        });

        // Transform to include item count and menu info
        return categoriesList.map((category) => ({
          ...category,
          itemCount: category.categoryItems?.length || 0,
          menuIds: category.menuCategories?.map((mc) => mc.menu.id) || [],
          menuNames: category.menuCategories?.map((mc) => mc.menu.name) || [],
        }));
      },
      ["categories-list", locationId],
      { revalidate: 300 } // 5 minutes
    );

    const categoriesList = await getCachedCategories();

    const res = posSuccess(categoriesList);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (error) {
    console.error("[GET /api/categories] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to fetch categories"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 * Create a new category
 * Body: { locationId, name, emoji?, description?, displayOrder? }
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
    const { locationId, name, emoji, description, displayOrder, menuIds, i18n } = body;

    if (!locationId || !name) {
      return NextResponse.json(
        { error: "Location ID and name are required" },
        { status: 400 }
      );
    }

    // Verify location exists and user has access
    const location = await withDbRetry(() =>
      db.query.merchantLocations.findFirst({
        where: eq(merchantLocations.id, locationId),
        columns: {
          id: true,
          merchantId: true,
        },
      })
    );

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Check user has access to this merchant
    const membership = await withDbRetry(() =>
      db.query.merchantUsers.findFirst({
        where: and(
          eq(merchantUsers.merchantId, location.merchantId),
          eq(merchantUsers.userId, user.id),
          eq(merchantUsers.isActive, true)
        ),
        columns: {
          id: true,
        },
      })
    );

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this location" },
        { status: 403 }
      );
    }

    // Create category
    const [newCategory] = await withDbRetry(() =>
      db
        .insert(categories)
        .values({
          locationId,
          name,
          emoji: emoji || null,
          description: description || null,
          displayOrder: displayOrder ?? 0,
          i18n: i18n !== undefined ? normalizeCatalogI18n(i18n) : null,
        })
        .returning()
    );

    // Link category to menus if menuIds provided
    if (menuIds && Array.isArray(menuIds) && menuIds.length > 0) {
      // Verify all menu IDs belong to the same location
      const validMenus = await db.query.menus.findMany({
        where: and(
          eq(menus.locationId, locationId),
          // Check if menuIds are in the valid menus
        ),
        columns: { id: true },
      });

      const validMenuIds = validMenus.map((m) => m.id);
      const menuIdsToLink = menuIds.filter((id: string) => validMenuIds.includes(id));

      if (menuIdsToLink.length > 0) {
        await db.insert(menuCategories).values(
          menuIdsToLink.map((menuId: string, index: number) => ({
            menuId,
            categoryId: newCategory.id,
            displayOrder: index,
          }))
        );
      }
    }

    // Fetch complete category with relations
    const completeCategory = await db.query.categories.findFirst({
      where: eq(categories.id, newCategory.id),
      with: {
        menuCategories: {
          with: {
            menu: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ...completeCategory,
      menuIds: completeCategory?.menuCategories?.map((mc) => mc.menu.id) || [],
      menuNames: completeCategory?.menuCategories?.map((mc) => mc.menu.name) || [],
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/categories] Error:", error);
    return NextResponse.json(
      {
        error: toUserFacingDbError(error, "Internal server error - Failed to create category"),
      },
      { status: 500 }
    );
  }
}
