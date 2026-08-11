import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { merchantLocations, merchantUsers, staffPushSubscriptions } from "@/db/schema";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { supabaseServer } from "@/lib/supabaseServer";
import { configureWebPush } from "@/lib/orders/web-push";

export const runtime = "nodejs";

function hasLocationAccess(
  locationAccess: string[] | null | undefined,
  locationId: string,
): boolean {
  if (!locationAccess || locationAccess.length === 0) return true;
  return locationAccess.includes(locationId);
}

/**
 * POST /api/orders/push/test
 * Body: { locationId }
 * Sends a test Web Push to the current user's saved subscriptions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const locationId =
      typeof body?.locationId === "string" ? body.locationId.trim() : "";
    if (!locationId) {
      return posFailure("BAD_REQUEST", "locationId is required", { status: 400 });
    }

    if (!configureWebPush()) {
      return posFailure("INTERNAL_ERROR", "Web Push is not configured (missing VAPID keys)", {
        status: 503,
      });
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
      .select({
        id: staffPushSubscriptions.id,
        endpoint: staffPushSubscriptions.endpoint,
        p256dh: staffPushSubscriptions.p256dh,
        auth: staffPushSubscriptions.auth,
      })
      .from(staffPushSubscriptions)
      .where(
        and(
          eq(staffPushSubscriptions.userId, user.id),
          eq(staffPushSubscriptions.locationId, locationId),
        ),
      );

    if (rows.length === 0) {
      return posFailure(
        "BAD_REQUEST",
        "No closed-tab subscription saved yet. Tap Enable alerts first.",
        { status: 400 },
      );
    }

    const payload = JSON.stringify({
      title: "Test order alert",
      body: "Closed-tab push is working. You can close Safari and still get new-order alerts.",
      url: "/orders",
      orderId: null,
      orderNumber: "TEST",
    });

    let sent = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
          { TTL: 60 },
        );
        sent += 1;
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : null;
        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(staffPushSubscriptions)
            .where(eq(staffPushSubscriptions.id, row.id));
          errors.push("Subscription expired - enable alerts again");
        } else {
          const raw = error instanceof Error ? error.message : "Send failed";
          const body =
            error && typeof error === "object" && "body" in error
              ? String((error as { body?: unknown }).body ?? "")
              : "";
          if (
            statusCode === 403 ||
            raw.toLowerCase().includes("badjwttoken") ||
            body.toLowerCase().includes("badjwttoken")
          ) {
            errors.push(
              "Apple rejected the push token. Set VAPID_SUBJECT to a valid mailto: email (not *.local) and restart the server.",
            );
          } else {
            errors.push(raw);
          }
        }
      }
    }

    if (sent === 0) {
      return posFailure(
        "INTERNAL_ERROR",
        errors[0] ?? "Failed to deliver test push",
        { status: 500 },
      );
    }

    return posSuccess({ sent, errors });
  } catch (error) {
    const message = toErrorMessage(error, "Failed to send test push");
    // Surface Apple JWT failures clearly (common with bad VAPID_SUBJECT).
    if (message.toLowerCase().includes("badjwttoken") || message.includes("403")) {
      return posFailure(
        "INTERNAL_ERROR",
        "Apple rejected the push token. Set VAPID_SUBJECT to a valid mailto: email (not *.local) and restart the server.",
        { status: 500 },
      );
    }
    return posFailure("INTERNAL_ERROR", message, {
      status: 500,
    });
  }
}
