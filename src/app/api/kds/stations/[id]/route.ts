import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { locationStations } from "@/lib/db/schema/location-stations";
import { merchantUsers } from "@/lib/db/schema/merchant-users";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import { supabaseServer } from "@/lib/supabaseServer";
import { assertMerchantKdsEnabled } from "@/lib/kds/assertKdsEnabled";
import { posSuccess, posFailure, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * PATCH /api/kds/stations/[id]
 * Update station: rename (name), activate/deactivate (isActive).
 * Body: { name?: string, isActive?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stationId } = await params;
    if (!stationId?.trim()) {
      return posFailure("BAD_REQUEST", "Station id is required", { status: 400 });
    }

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, isActive } = body;

    const existing = await db.query.locationStations.findFirst({
      where: eq(locationStations.id, stationId),
      with: {
        location: { columns: { id: true, merchantId: true } },
      },
    });
    if (!existing) {
      return posFailure("NOT_FOUND", "Station not found", { status: 404 });
    }

    const kdsGate = await assertMerchantKdsEnabled(existing.location.merchantId);
    if (kdsGate) return kdsGate;

    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existing.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: { id: true },
    });
    if (!membership) {
      return posFailure("FORBIDDEN", "Forbidden - You don't have access to this station", {
        status: 403,
      });
    }

    const updates: Partial<{
      name: string;
      isActive: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof isActive === "boolean") {
      updates.isActive = isActive;
    }

    if (Object.keys(updates).length <= 1) {
      return posFailure("BAD_REQUEST", "Provide name and/or isActive to update", { status: 400 });
    }

    const [updated] = await db
      .update(locationStations)
      .set(updates)
      .where(eq(locationStations.id, stationId))
      .returning({
        id: locationStations.id,
        key: locationStations.key,
        name: locationStations.name,
        displayOrder: locationStations.displayOrder,
        isActive: locationStations.isActive,
      });

    return posSuccess({
      id: updated.id,
      key: updated.key,
      name: updated.name,
      displayOrder: updated.displayOrder,
      isActive: updated.isActive,
    });
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to update station"),
      { status: 500 }
    );
  }
}
