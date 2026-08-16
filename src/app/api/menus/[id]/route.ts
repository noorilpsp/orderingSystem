import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { menus, menuCategories, categories } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { unstable_cache } from "@/lib/unstable-cache";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * GET /api/menus/[id]
 * Get a single menu with categories
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: menuId } = await params;

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

    if (!menuId || menuId.trim() === "") {
      return NextResponse.json(
        { error: "Menu ID is required" },
        { status: 400 }
      );
    }

    // Fetch menu with relations
    const getCachedMenu = unstable_cache(
      async () => {
        const menu = await db.query.menus.findFirst({
          where: eq(menus.id, menuId),
          with: {
            menuCategories: {
              with: {
                category: {
                  with: {
                    categoryItems: {
                      with: {
                        item: true,
                      },
                    },
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
        return menu;
      },
      ["menu-data", menuId],
      { revalidate: 300 } // 5 minutes
    );

    const menu = await getCachedMenu();

    if (!menu) {
      return NextResponse.json(
        { error: "Menu not found" },
        { status: 404 }
      );
    }

    // Check user has access to this location
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, menu.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this menu" },
        { status: 403 }
      );
    }

    return NextResponse.json(menu, {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[GET /api/menus/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch menu",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/menus/[id]
 * Update a menu
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: menuId } = await params;

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

    if (!menuId || menuId.trim() === "") {
      return NextResponse.json(
        { error: "Menu ID is required" },
        { status: 400 }
      );
    }

    // Get existing menu to verify access
    const existingMenu = await db.query.menus.findFirst({
      where: eq(menus.id, menuId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingMenu) {
      return NextResponse.json(
        { error: "Menu not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingMenu.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this menu" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updateData: Partial<typeof menus.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.schedule !== undefined) updateData.schedule = body.schedule;
    if (body.availabilityDelivery !== undefined) updateData.availabilityDelivery = body.availabilityDelivery;
    if (body.availabilityPickup !== undefined) updateData.availabilityPickup = body.availabilityPickup;
    if (body.availabilityDineIn !== undefined) updateData.availabilityDineIn = body.availabilityDineIn;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;

    const [updatedMenu] = await db
      .update(menus)
      .set(updateData)
      .where(eq(menus.id, menuId))
      .returning();

    await revalidatePublicMenuForLocation(existingMenu.location.id);
    return NextResponse.json(updatedMenu);
  } catch (error) {
    console.error("[PUT /api/menus/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to update menu",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/menus/[id]
 * Delete a menu
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: menuId } = await params;

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

    if (!menuId || menuId.trim() === "") {
      return NextResponse.json(
        { error: "Menu ID is required" },
        { status: 400 }
      );
    }

    // Get existing menu to verify access
    const existingMenu = await db.query.menus.findFirst({
      where: eq(menus.id, menuId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingMenu) {
      return NextResponse.json(
        { error: "Menu not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingMenu.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this menu" },
        { status: 403 }
      );
    }

    // Delete menu (cascade will handle related records)
    await db.delete(menus).where(eq(menus.id, menuId));

    await revalidatePublicMenuForLocation(existingMenu.location.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/menus/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to delete menu",
      },
      { status: 500 }
    );
  }
}
