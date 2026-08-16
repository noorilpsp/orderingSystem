import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { tables } from "@/lib/db/schema/orders";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { getComputedStatusesForTables } from "@/app/actions/tables";
import {
  computeRequestHash,
  getIdempotentResponse,
  IDEMPOTENCY_CONFLICT,
  saveIdempotentResponse,
} from "@/domain/idempotency";
import { createTableMutation } from "@/domain";
import { posFailure, posSuccess, requireIdempotencyKey, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * GET /api/tables
 * List all tables for a location
 * Query params: locationId (required), status? (filter by status)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const status = searchParams.get("status");

    if (!locationId) {
      return posFailure("BAD_REQUEST", "Location ID is required", { status: 400 });
    }

    // Verify location exists and user has access
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        merchantId: true,
      },
    });

    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "You don't have access to this location", { status: 403 });
    }

    const [tablesList, computedStatuses] = await Promise.all([
      db.query.tables.findMany({
        where: eq(tables.locationId, locationId),
        orderBy: [desc(tables.createdAt)],
      }),
      getComputedStatusesForTables(locationId),
    ]);

    let result = tablesList.map((t) => ({
      ...t,
      status: computedStatuses.get(t.id) ?? t.status,
    }));

    if (status) {
      result = result.filter((t) => t.status === status);
    }

    const res = posSuccess(result);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (error) {
    console.error("[GET /api/tables] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to fetch tables"),
      { status: 500 }
    );
  }
}

const ROUTE_POST_TABLES = "POST /api/tables";

/**
 * POST /api/tables
 * Create a new table
 * Body: { locationId, tableNumber, seats?, status? }
 */
export async function POST(request: NextRequest) {
  let idempotencyKey: string | undefined;
  try {
    const keyRes = requireIdempotencyKey(request);
    if (!keyRes.ok) return keyRes.failure;
    idempotencyKey = keyRes.key;

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401, correlationId: idempotencyKey });
    }

    const body = await request.json().catch(() => ({}));
    const { locationId, tableNumber, seats, status } = body;

    if (!locationId || !tableNumber) {
      return posFailure("BAD_REQUEST", "Location ID and table number are required", {
        status: 400,
        correlationId: idempotencyKey,
      });
    }

    const requestHash = computeRequestHash(body);
    const cached = await getIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE_POST_TABLES,
      requestHash,
    });
    if (cached) {
      if (!cached.ok) {
        return posFailure(IDEMPOTENCY_CONFLICT, "Idempotency-Key reuse with different request", {
          status: 409,
          correlationId: idempotencyKey,
        });
      }
      const saved = cached.response as { body: Record<string, unknown>; status: number };
      const replayBody = { ...(saved.body ?? cached.response) as Record<string, unknown>, correlationId: idempotencyKey };
      return NextResponse.json(replayBody, { status: saved.status ?? 201 });
    }

    // Verify location exists and user has access
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        merchantId: true,
      },
    });

    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404, correlationId: idempotencyKey });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "Forbidden - You don't have access to this location", {
        status: 403,
        correlationId: idempotencyKey,
      });
    }

    const result = await createTableMutation({
      locationId,
      tableNumber,
      seats: seats || null,
      status,
    });
    if (!result.ok) {
      const code = result.reason === "table_number_exists" ? "CONFLICT" : "BAD_REQUEST";
      const msg = result.reason === "table_number_exists"
        ? "Table number already exists for this location"
        : "Invalid table status";
      const statusCode = result.reason === "table_number_exists" ? 409 : 400;
      const failureBody = { ok: false as const, error: { code, message: msg }, correlationId: idempotencyKey };
      await saveIdempotentResponse({
        key: idempotencyKey,
        userId: user.id,
        route: ROUTE_POST_TABLES,
        requestHash,
        responseJson: { body: failureBody, status: statusCode },
      });
      return posFailure(code, msg, { status: statusCode, correlationId: idempotencyKey });
    }

    const successBody = { ok: true as const, data: { ...result.table }, correlationId: idempotencyKey };
    await saveIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE_POST_TABLES,
      requestHash,
      responseJson: { body: successBody, status: 201 },
    });
    await revalidatePublicMenuForLocation(locationId);
    return posSuccess(successBody.data, { status: 201, correlationId: idempotencyKey });
  } catch (error) {
    console.error("[POST /api/tables] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to create table"),
      { status: 500, correlationId: idempotencyKey }
    );
  }
}
