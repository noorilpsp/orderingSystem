import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { ensureSessionByTableUuid } from "@/domain";
import { posFailure, posSuccess, requireIdempotencyKey, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * POST /api/sessions/ensure
 * Ensure a session exists for the given table. Creates one if needed.
 * Body: { tableUuid (required), locationId (required), guestCount?, eventSource? }
 * Does NOT write to DB inside the route - delegates to domain.
 */
export async function POST(request: NextRequest) {
  let idemKey: string | undefined;
  try {
    const idem = requireIdempotencyKey(request);
    if (!idem.ok) return idem.failure;
    idemKey = idem.key;

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401, correlationId: idemKey });
    }

    const body = await request.json().catch(() => ({}));
    const { tableUuid, locationId, guestCount } = body;

    if (!tableUuid || typeof tableUuid !== "string" || !tableUuid.trim()) {
      return posFailure("BAD_REQUEST", "tableUuid is required", { status: 400, correlationId: idemKey });
    }
    if (!locationId || typeof locationId !== "string" || !locationId.trim()) {
      return posFailure("BAD_REQUEST", "locationId is required", { status: 400, correlationId: idemKey });
    }

    const effectiveGuestCount =
      typeof guestCount === "number" && Number.isFinite(guestCount) && guestCount >= 0
        ? guestCount
        : 1;

    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        merchantId: true,
      },
    });

    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404, correlationId: idemKey });
    }

    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: { id: true },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "You don't have access to this location", { status: 403, correlationId: idemKey });
    }

    const result = await ensureSessionByTableUuid(
      locationId,
      tableUuid.trim(),
      effectiveGuestCount,
      user.id,
      null,
      { accessVerified: true }
    );

    if (!result.ok) {
      if (result.reason === "table_not_active") {
        return posFailure("CONFLICT", "Table is not active", { status: 409, correlationId: idemKey });
      }
      const isForbidden = result.reason === "You are not staff at this location";
      return posFailure(
        isForbidden ? "FORBIDDEN" : "BAD_REQUEST",
        result.reason,
        { status: isForbidden ? 403 : 400, correlationId: idemKey }
      );
    }

    return posSuccess(
      {
        sessionId: result.sessionId,
        tableUuid: tableUuid.trim(),
      },
      { correlationId: idemKey }
    );
  } catch (error) {
    console.error("[POST /api/sessions/ensure] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to ensure session"),
      { status: 500, correlationId: idemKey }
    );
  }
}
