import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locationStations } from "@/lib/db/schema/location-stations";
import { locationSubstations } from "@/lib/db/schema/location-substations";
import { verifyLocationAccess } from "@/lib/location-access";
import { assertStationKdsEnabled } from "@/lib/kds/assertKdsEnabled";
import { posSuccess, posFailure, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * PUT /api/kds/stations/[id]/substations/reorder
 * Reorder substations.
 * Body: { substations: [{ id: string, displayOrder: number }] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stationId } = await params;
    if (!stationId?.trim()) {
      return posFailure("BAD_REQUEST", "Station id is required", { status: 400 });
    }

    const kdsGate = await assertStationKdsEnabled(stationId);
    if (kdsGate) return kdsGate;

    const body = await request.json().catch(() => ({}));
    const { substations } = body;
    if (!Array.isArray(substations) || substations.length === 0) {
      return posFailure("BAD_REQUEST", "substations array is required", { status: 400 });
    }

    const station = await db.query.locationStations.findFirst({
      where: eq(locationStations.id, stationId),
      with: { location: { columns: { id: true } } },
    });
    if (!station) {
      return posFailure("NOT_FOUND", "Station not found", { status: 404 });
    }

    const access = await verifyLocationAccess(station.location.id);
    if (!access) {
      return posFailure("FORBIDDEN", "Forbidden", { status: 403 });
    }

    const orderMap = new Map(
      substations.map((s: { id?: string; displayOrder?: number }) => [
        s.id,
        typeof s.displayOrder === "number" ? s.displayOrder : 0,
      ])
    );

    const subs = await db.query.locationSubstations.findMany({
      where: eq(locationSubstations.stationId, stationId),
      columns: { id: true },
    });
    const validIds = new Set(subs.map((s) => s.id));
    for (const [id] of orderMap) {
      if (!validIds.has(id)) {
        return posFailure("BAD_REQUEST", `Substation ${id} not found for this station`, {
          status: 400,
        });
      }
    }

    const now = new Date();
    for (const [id, displayOrder] of orderMap) {
      await db
        .update(locationSubstations)
        .set({ displayOrder, updatedAt: now })
        .where(eq(locationSubstations.id, id));
    }

    return posSuccess({ ok: true });
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to reorder substations"),
      { status: 500 }
    );
  }
}
