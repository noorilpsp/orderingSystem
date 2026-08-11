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

async function requireStaffForLocation(locationId: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, failure: posFailure("UNAUTHORIZED", "Unauthorized", { status: 401 }) };
  }

  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { id: true, merchantId: true },
  });
  if (!location) {
    return { ok: false as const, failure: posFailure("NOT_FOUND", "Location not found", { status: 404 }) };
  }

  const membership = await db.query.merchantUsers.findFirst({
    where: and(
      eq(merchantUsers.merchantId, location.merchantId),
      eq(merchantUsers.userId, user.id),
      eq(merchantUsers.isActive, true),
    ),
    columns: { id: true, locationAccess: true },
  });
  if (!membership || !hasLocationAccess(membership.locationAccess, locationId)) {
    return { ok: false as const, failure: posFailure("FORBIDDEN", "No access to this location", { status: 403 }) };
  }

  return { ok: true as const, userId: user.id, locationId };
}

/**
 * POST /api/orders/push/subscribe
 * Body: { locationId, subscription: PushSubscriptionJSON }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const locationId =
      typeof body?.locationId === "string" ? body.locationId.trim() : "";
    const subscription = body?.subscription;
    const endpoint =
      typeof subscription?.endpoint === "string" ? subscription.endpoint.trim() : "";
    const p256dh =
      typeof subscription?.keys?.p256dh === "string" ? subscription.keys.p256dh : "";
    const auth =
      typeof subscription?.keys?.auth === "string" ? subscription.keys.auth : "";

    if (!locationId || !endpoint || !p256dh || !auth) {
      return posFailure("BAD_REQUEST", "locationId and subscription keys are required", {
        status: 400,
      });
    }

    const authz = await requireStaffForLocation(locationId);
    if (!authz.ok) return authz.failure;

    const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;
    const existing = await db.query.staffPushSubscriptions.findFirst({
      where: eq(staffPushSubscriptions.endpoint, endpoint),
      columns: { id: true },
    });

    if (existing) {
      await db
        .update(staffPushSubscriptions)
        .set({
          userId: authz.userId,
          locationId,
          p256dh,
          auth,
          userAgent,
          updatedAt: new Date(),
        })
        .where(eq(staffPushSubscriptions.id, existing.id));
    } else {
      await db.insert(staffPushSubscriptions).values({
        userId: authz.userId,
        locationId,
        endpoint,
        p256dh,
        auth,
        userAgent,
      });
    }

    return posSuccess({ subscribed: true });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Failed to subscribe"), {
      status: 500,
    });
  }
}

/**
 * DELETE /api/orders/push/subscribe
 * Body: { endpoint } or { locationId } to clear this user's location subs
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const endpoint =
      typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
    const locationId =
      typeof body?.locationId === "string" ? body.locationId.trim() : "";

    const supabase = await supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized", { status: 401 });
    }

    if (endpoint) {
      await db
        .delete(staffPushSubscriptions)
        .where(
          and(
            eq(staffPushSubscriptions.endpoint, endpoint),
            eq(staffPushSubscriptions.userId, user.id),
          ),
        );
      return posSuccess({ unsubscribed: true });
    }

    if (locationId) {
      await db
        .delete(staffPushSubscriptions)
        .where(
          and(
            eq(staffPushSubscriptions.locationId, locationId),
            eq(staffPushSubscriptions.userId, user.id),
          ),
        );
      return posSuccess({ unsubscribed: true });
    }

    return posFailure("BAD_REQUEST", "endpoint or locationId is required", { status: 400 });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Failed to unsubscribe"), {
      status: 500,
    });
  }
}
