import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { categories, menuCategories, categoryItems, menus } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { unstable_cache } from "@/lib/unstable-cache";
import { withDbRetry, toUserFacingDbError } from "@/lib/db/withDbRetry";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * GET /api/categories/[id]
 * Get a single category with items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params;

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

    if (!categoryId || categoryId.trim() === "") {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Fetch category with relations
    const getCachedCategory = unstable_cache(
      async () => {
        const category = await db.query.categories.findFirst({
          where: eq(categories.id, categoryId),
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
            categoryItems: {
              with: {
                item: true,
              },
              orderBy: (categoryItems, { asc }) => [asc(categoryItems.displayOrder)],
            },
            location: {
              columns: {
                id: true,
                merchantId: true,
              },
            },
          },
        });
        return category;
      },
      ["category-data", categoryId],
      { revalidate: 300 } // 5 minutes
    );

    const category = await getCachedCategory();

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Check user has access to this location
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, category.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this category" },
        { status: 403 }
      );
    }

    return NextResponse.json(category, {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[GET /api/categories/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch category",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/categories/[id]
 * Update a category
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params;

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

    if (!categoryId || categoryId.trim() === "") {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Get existing category to verify access
    const existingCategory = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingCategory.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this category" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updateData: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Update fields if they are provided (including empty strings and null)
    if (body.name !== undefined) updateData.name = body.name;
    if (body.emoji !== undefined) updateData.emoji = body.emoji || null;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;
    if (body.i18n !== undefined) updateData.i18n = normalizeCatalogI18n(body.i18n);

    // Update category
    const [updatedCategory] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, categoryId))
      .returning();

    // Update menu-category links if menuIds provided
    if (body.menuIds !== undefined && Array.isArray(body.menuIds)) {
      // Delete existing menu-category links
      await db.delete(menuCategories).where(eq(menuCategories.categoryId, categoryId));

      // Create new links if menuIds provided
      if (body.menuIds.length > 0) {
        // Verify all menu IDs belong to the same location
        const validMenus = await db.query.menus.findMany({
          where: eq(menus.locationId, existingCategory.locationId),
          columns: { id: true },
        });

        const validMenuIds = validMenus.map((m) => m.id);
        const menuIdsToLink = body.menuIds.filter((id: string) => validMenuIds.includes(id));

        if (menuIdsToLink.length > 0) {
          await db.insert(menuCategories).values(
            menuIdsToLink.map((menuId: string, index: number) => ({
              menuId,
              categoryId: categoryId,
              displayOrder: index,
            }))
          );
        }
      }
    }

    // Fetch complete category with relations
    const completeCategory = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
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

    await revalidatePublicMenuForLocation(existingCategory.location.id);
    return NextResponse.json({
      ...completeCategory,
      menuIds: completeCategory?.menuCategories?.map((mc) => mc.menu.id) || [],
      menuNames: completeCategory?.menuCategories?.map((mc) => mc.menu.name) || [],
      itemCount: completeCategory?.categoryItems?.length || 0,
    });
  } catch (error) {
    console.error("[PUT /api/categories/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to update category",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[id]
 * Delete a category
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params;

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

    if (!categoryId || categoryId.trim() === "") {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Get existing category to verify access
    const existingCategory = await withDbRetry(() =>
      db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
        with: {
          location: {
            columns: {
              id: true,
              merchantId: true,
            },
          },
        },
      })
    );

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await withDbRetry(() =>
      db.query.merchantUsers.findFirst({
        where: and(
          eq(merchantUsers.merchantId, existingCategory.location.merchantId),
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
        { error: "Forbidden - You don't have access to this category" },
        { status: 403 }
      );
    }

    // Delete category (cascade will handle related records)
    await withDbRetry(() => db.delete(categories).where(eq(categories.id, categoryId)));

    await revalidatePublicMenuForLocation(existingCategory.location.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/categories/[id]] Error:", error);
    return NextResponse.json(
      {
        error: toUserFacingDbError(error, "Internal server error - Failed to delete category"),
      },
      { status: 500 }
    );
  }
}
