import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locationStations } from "@/lib/db/schema/location-stations";
import { merchantUsers } from "@/lib/db/schema/merchant-users";
import { verifyLocationAccess } from "@/lib/location-access";
import { assertLocationKdsEnabled } from "@/lib/kds/assertKdsEnabled";
import { posSuccess, posFailure, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * PUT /api/kds/stations/reorder?locationId=<uuid>
 * Reorder stations.
 * Body: { stations: [{ id: string, displayOrder: number }] }
 */
export async function PUT(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get("locationId");
    if (!locationId?.trim()) {
      return posFailure("BAD_REQUEST", "locationId is required", { status: 400 });
    }

    const access = await verifyLocationAccess(locationId);
    if (!access) {
      return posFailure("FORBIDDEN", "Forbidden - You don't have access to this location", {
        status: 403,
      });
    }

    const kdsGate = await assertLocationKdsEnabled(locationId);
    if (kdsGate) return kdsGate;

    const body = await request.json().catch(() => ({}));
    const { stations } = body;

    if (!Array.isArray(stations)) {
      return posFailure("BAD_REQUEST", "stations array is required", { status: 400 });
    }

    const updates = stations.filter(
      (s: unknown): s is { id: string; displayOrder: number } =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as { id?: unknown }).id === "string" &&
        typeof (s as { displayOrder?: unknown }).displayOrder === "number"
    );

    if (updates.length === 0) {
      return posSuccess({ updated: 0 });
    }

    const existingStations = await db.query.locationStations.findMany({
      where: eq(locationStations.locationId, locationId),
      columns: { id: true },
    });
    const validIds = new Set(existingStations.map((s) => s.id));

    const now = new Date();
    await Promise.all(
      updates
        .filter((u) => validIds.has(u.id))
        .map((u) =>
          db
            .update(locationStations)
            .set({ displayOrder: u.displayOrder, updatedAt: now })
            .where(eq(locationStations.id, u.id))
        )
    );

    return posSuccess({ updated: updates.filter((u) => validIds.has(u.id)).length });
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to reorder stations"),
      { status: 500 }
    );
  }
}
