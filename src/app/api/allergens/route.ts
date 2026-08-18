import { NextRequest, NextResponse } from "next/server";
import { posSuccess } from "@/app/api/_lib/pos-envelope";
import { eq, and } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { allergens } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { unstable_cache } from "@/lib/unstable-cache";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * GET /api/allergens
 * List all allergens for a location
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

    // Fetch allergens
    const getCachedAllergens = unstable_cache(
      async () => {
        return await db.query.allergens.findMany({
          where: eq(allergens.locationId, locationId),
          orderBy: (allergens, { asc }) => [asc(allergens.name)],
        });
      },
      ["allergens-list", locationId],
      { revalidate: 300 } // 5 minutes
    );

    const allergensList = await getCachedAllergens();

    const res = posSuccess(allergensList);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (error) {
    console.error("[GET /api/allergens] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch allergens",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/allergens
 * Create a new allergen
 * Body: { locationId, name, icon? }
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
    const { locationId, name, emoji, icon } = body;

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

    // Create allergen
    const [newAllergen] = await db
      .insert(allergens)
      .values({
        locationId,
        name,
        emoji: emoji || null,
        icon: icon || null,
      })
      .returning();

    await revalidatePublicMenuForLocation(locationId);
    return NextResponse.json(newAllergen, { status: 201 });
  } catch (error) {
    console.error("[POST /api/allergens] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to create allergen",
      },
      { status: 500 }
    );
  }
}
