import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { merchantLocations, merchantUsers, staffPushSubscriptions } from "@/db/schema";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function hasLocationAccess(
  locationAccess: string[] | null | undefined,
  locationId: string,
): boolean {
  if (!locationAccess || locationAccess.length === 0) return true;
  return locationAccess.includes(locationId);
}

/**
 * GET /api/orders/push/status?locationId=...
 * Whether the current staff user has a saved closed-tab push subscription.
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get("locationId")?.trim() ?? "";
    if (!locationId) {
      return posFailure("BAD_REQUEST", "locationId is required", { status: 400 });
    }

    const supabase = await supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized", { status: 401 });
    }

    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: { id: true, merchantId: true },
    });
    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true),
      ),
      columns: { locationAccess: true },
    });
    if (!membership || !hasLocationAccess(membership.locationAccess, locationId)) {
      return posFailure("FORBIDDEN", "No access to this location", { status: 403 });
    }

    const rows = await db
      .select({ id: staffPushSubscriptions.id })
      .from(staffPushSubscriptions)
      .where(
        and(
          eq(staffPushSubscriptions.userId, user.id),
          eq(staffPushSubscriptions.locationId, locationId),
        ),
      );

    return posSuccess({
      subscribed: rows.length > 0,
      count: rows.length,
    });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Failed to load push status"), {
      status: 500,
    });
  }
}
