import { NextRequest, NextResponse } from "next/server";
import { posSuccess } from "@/app/api/_lib/pos-envelope";
import { eq, and, desc } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { menus, menuCategories, categories } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { unstable_cache } from "@/lib/unstable-cache";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * GET /api/menus
 * List all menus for a location
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
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json(
        { error: "Location ID is required" },
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
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
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

    // Fetch menus with categories
    const getCachedMenus = unstable_cache(
      async () => {
        const menusList = await db.query.menus.findMany({
          where: eq(menus.locationId, locationId),
          orderBy: [desc(menus.displayOrder), desc(menus.createdAt)],
          with: {
            menuCategories: {
              with: {
                category: true,
              },
            },
          },
        });

        // Transform to include category count
        return menusList.map((menu) => ({
          ...menu,
          categoryCount: menu.menuCategories?.length || 0,
        }));
      },
      ["menus-list", locationId],
      { revalidate: 300 } // 5 minutes
    );

    const menusList = await getCachedMenus();

    const res = posSuccess(menusList);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (error) {
    console.error("[GET /api/menus] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch menus",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/menus
 * Create a new menu
 * Body: { locationId, name, description?, schedule, availabilityDelivery, availabilityPickup, availabilityDineIn, status?, displayOrder? }
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
    const { locationId, name, description, schedule, availabilityDelivery, availabilityPickup, availabilityDineIn, status, displayOrder } = body;

    if (!locationId || !name) {
      return NextResponse.json(
        { error: "Location ID and name are required" },
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
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
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

    // Create menu
    const [newMenu] = await db
      .insert(menus)
      .values({
        locationId,
        name,
        description: description || null,
        schedule: schedule || {},
        availabilityDelivery: availabilityDelivery ?? false,
        availabilityPickup: availabilityPickup ?? false,
        availabilityDineIn: availabilityDineIn ?? false,
        status: status || "active",
        displayOrder: displayOrder ?? 0,
      })
      .returning();

    await revalidatePublicMenuForLocation(locationId);
    return NextResponse.json(newMenu, { status: 201 });
  } catch (error) {
    console.error("[POST /api/menus] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to create menu",
      },
      { status: 500 }
    );
  }
}
