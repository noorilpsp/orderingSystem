import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locationStations } from "@/lib/db/schema/location-stations";
import { locationSubstations } from "@/lib/db/schema/location-substations";
import { verifyLocationAccess } from "@/lib/location-access";
import { assertLocationKdsEnabled } from "@/lib/kds/assertKdsEnabled";
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
 * PATCH /api/kds/substations/[id]
 * Update substation: name, displayOrder.
 * Body: { name?: string, displayOrder?: number }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: substationId } = await params;
    if (!substationId?.trim()) {
      return posFailure("BAD_REQUEST", "Substation id is required", { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, displayOrder } = body;

    const existing = await db.query.locationSubstations.findFirst({
      where: eq(locationSubstations.id, substationId),
      with: {
        station: {
          with: { location: { columns: { id: true } } },
        },
      },
    });
    if (!existing) {
      return posFailure("NOT_FOUND", "Substation not found", { status: 404 });
    }

    const kdsGate = await assertLocationKdsEnabled(existing.station.location.id);
    if (kdsGate) return kdsGate;

    const access = await verifyLocationAccess(existing.station.location.id);
    if (!access) {
      return posFailure("FORBIDDEN", "Forbidden", { status: 403 });
    }

    const updates: Partial<{
      name: string;
      key: string;
      displayOrder: number;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
      const newKey = normalizeSubstationKey(name);
      const others = await db.query.locationSubstations.findMany({
        where: eq(locationSubstations.stationId, existing.stationId),
        columns: { key: true },
      });
      const otherKeys = new Set(others.filter((o) => o.key !== existing.key).map((o) => o.key));
      let key = newKey;
      let suffix = 0;
      while (otherKeys.has(key)) {
        suffix += 1;
        key = `${newKey}_${suffix}`;
      }
      updates.key = key;
    }
    if (typeof displayOrder === "number" && displayOrder >= 0) {
      updates.displayOrder = displayOrder;
    }

    if (Object.keys(updates).length <= 1) {
      return posFailure("BAD_REQUEST", "Provide name and/or displayOrder to update", {
        status: 400,
      });
    }

    const [updated] = await db
      .update(locationSubstations)
      .set(updates)
      .where(eq(locationSubstations.id, substationId))
      .returning({
        id: locationSubstations.id,
        key: locationSubstations.key,
        name: locationSubstations.name,
        displayOrder: locationSubstations.displayOrder,
      });

    return posSuccess({
      id: updated.id,
      key: updated.key,
      name: updated.name,
      displayOrder: updated.displayOrder,
    });
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to update substation"),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kds/substations/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: substationId } = await params;
    if (!substationId?.trim()) {
      return posFailure("BAD_REQUEST", "Substation id is required", { status: 400 });
    }

    const existing = await db.query.locationSubstations.findFirst({
      where: eq(locationSubstations.id, substationId),
      with: {
        station: {
          with: { location: { columns: { id: true } } },
        },
      },
    });
    if (!existing) {
      return posFailure("NOT_FOUND", "Substation not found", { status: 404 });
    }

    const kdsGate = await assertLocationKdsEnabled(existing.station.location.id);
    if (kdsGate) return kdsGate;

    const access = await verifyLocationAccess(existing.station.location.id);
    if (!access) {
      return posFailure("FORBIDDEN", "Forbidden", { status: 403 });
    }

    await db
      .delete(locationSubstations)
      .where(eq(locationSubstations.id, substationId));

    return posSuccess({ deleted: true });
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to delete substation"),
      { status: 500 }
    );
  }
}
