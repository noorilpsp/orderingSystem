import { NextRequest } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { locationStations } from "@/lib/db/schema/location-stations";
import { locationSubstations } from "@/lib/db/schema/location-substations";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import { verifyLocationAccess } from "@/lib/location-access";
import { assertLocationKdsEnabled } from "@/lib/kds/assertKdsEnabled";
import { posSuccess, posFailure, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

export type KdsStationSettingsSubstation = {
  id: string;
  key: string;
  name: string;
  displayOrder: number;
};

export type KdsStationSettingsStation = {
  id: string;
  key: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  substations: KdsStationSettingsSubstation[];
};

export type KdsStationSettingsView = {
  location: { id: string; name?: string };
  stations: KdsStationSettingsStation[];
};

/**
 * GET /api/kds/stations?locationId=<uuid>
 * Returns station settings read model for the location.
 * Includes all stations (active + inactive), ordered by displayOrder.
 */
export async function GET(request: NextRequest) {
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

    const locationRow = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: { id: true, name: true },
    });
    if (!locationRow) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    const rows = await db.query.locationStations.findMany({
      where: eq(locationStations.locationId, locationId),
      columns: { id: true, key: true, name: true, displayOrder: true, isActive: true },
      orderBy: [asc(locationStations.displayOrder), asc(locationStations.key)],
      with: {
        substations: {
          columns: { id: true, key: true, name: true, displayOrder: true },
          orderBy: [asc(locationSubstations.displayOrder), asc(locationSubstations.key)],
        },
      },
    });

    const data: KdsStationSettingsView = {
      location: { id: locationRow.id, name: locationRow.name ?? undefined },
      stations: rows.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        displayOrder: r.displayOrder,
        isActive: r.isActive,
        substations: (r.substations ?? []).map((s) => ({
          id: s.id,
          key: s.key,
          name: s.name,
          displayOrder: s.displayOrder,
        })),
      })),
    };

    return posSuccess(data);
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to load station settings"),
      { status: 500 }
    );
  }
}

/** Normalize display name to stable key: lowercase, spaces/special chars -> underscore. */
function normalizeStationKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\-\.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "station";
}

/**
 * POST /api/kds/stations
 * Create a new station.
 * Body: { locationId, name }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { locationId, name } = body;

    if (!locationId || typeof name !== "string" || !name.trim()) {
      return posFailure("BAD_REQUEST", "locationId and name are required", { status: 400 });
    }

    const access = await verifyLocationAccess(locationId);
    if (!access) {
      return posFailure("FORBIDDEN", "Forbidden - You don't have access to this location", {
        status: 403,
      });
    }

    const kdsGate = await assertLocationKdsEnabled(locationId);
    if (kdsGate) return kdsGate;

    const locationRow = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: { id: true },
    });
    if (!locationRow) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    let key = normalizeStationKey(name);
    const existing = await db.query.locationStations.findMany({
      where: eq(locationStations.locationId, locationId),
      columns: { key: true },
    });
    const existingKeys = new Set(existing.map((r) => r.key));
    let suffix = 0;
    while (existingKeys.has(key)) {
      suffix += 1;
      key = `${normalizeStationKey(name)}_${suffix}`;
    }

    const allStations = await db.query.locationStations.findMany({
      where: eq(locationStations.locationId, locationId),
      columns: { displayOrder: true },
    });
    const maxOrder =
      allStations.length > 0
        ? Math.max(...allStations.map((s) => s.displayOrder))
        : -1;

    const now = new Date();
    const [inserted] = await db
      .insert(locationStations)
      .values({
        locationId,
        key,
        name: name.trim(),
        displayOrder: maxOrder + 1,
        isActive: true,
        updatedAt: now,
      })
      .returning({
        id: locationStations.id,
        key: locationStations.key,
        name: locationStations.name,
        displayOrder: locationStations.displayOrder,
        isActive: locationStations.isActive,
      });

    return posSuccess({
      id: inserted.id,
      key: inserted.key,
      name: inserted.name,
      displayOrder: inserted.displayOrder,
      isActive: inserted.isActive,
    });
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to create station"),
      { status: 500 }
    );
  }
}
