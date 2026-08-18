import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { allergens } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * DELETE /api/allergens/[id]
 * Delete an allergen
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: allergenId } = await params;

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

    if (!allergenId || allergenId.trim() === "") {
      return NextResponse.json(
        { error: "Allergen ID is required" },
        { status: 400 }
      );
    }

    // Get existing allergen to verify access
    const existingAllergen = await db.query.allergens.findFirst({
      where: eq(allergens.id, allergenId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingAllergen) {
      return NextResponse.json(
        { error: "Allergen not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingAllergen.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this allergen" },
        { status: 403 }
      );
    }

    // Delete allergen (cascade will handle related records)
    await db.delete(allergens).where(eq(allergens.id, allergenId));

    await revalidatePublicMenuForLocation(existingAllergen.location.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/allergens/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to delete allergen",
      },
      { status: 500 }
    );
  }
}
