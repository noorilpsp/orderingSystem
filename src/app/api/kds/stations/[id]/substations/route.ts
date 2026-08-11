import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locationStations } from "@/lib/db/schema/location-stations";
import { locationSubstations } from "@/lib/db/schema/location-substations";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import { verifyLocationAccess } from "@/lib/location-access";
import { assertStationKdsEnabled } from "@/lib/kds/assertKdsEnabled";
import { posSuccess, posFailure, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/** Normalize name to key: lowercase, spaces/special -> underscore. */
function normalizeSubstationKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\-\.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "lane";
}

/**
 * POST /api/kds/stations/[id]/substations
 * Create a substation (lane) for a station.
 * Body: { name: string }
 */
export async function POST(
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
    const { name } = body;
    if (typeof name !== "string" || !name.trim()) {
      return posFailure("BAD_REQUEST", "name is required", { status: 400 });
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

    const existing = await db.query.locationSubstations.findMany({
      where: eq(locationSubstations.stationId, stationId),
      columns: { key: true, displayOrder: true },
    });
    const existingKeys = new Set(existing.map((r) => r.key));
    let key = normalizeSubstationKey(name);
    let suffix = 0;
    while (existingKeys.has(key)) {
      suffix += 1;
      key = `${normalizeSubstationKey(name)}_${suffix}`;
    }

    const maxOrder =
      existing.length > 0
        ? Math.max(...existing.map((s) => s.displayOrder))
        : -1;

    const now = new Date();
    const [inserted] = await db
      .insert(locationSubstations)
      .values({
        stationId,
        key,
        name: name.trim(),
        displayOrder: maxOrder + 1,
        updatedAt: now,
      })
      .returning({
        id: locationSubstations.id,
        key: locationSubstations.key,
        name: locationSubstations.name,
        displayOrder: locationSubstations.displayOrder,
      });

    return posSuccess({
      id: inserted.id,
      key: inserted.key,
      name: inserted.name,
      displayOrder: inserted.displayOrder,
    });
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to create substation"),
      { status: 500 }
    );
  }
}
