import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { tables } from "@/lib/db/schema/orders";
import { merchantUsers } from "@/lib/db/schema";
import { computeTableStatus } from "@/app/actions/tables";
import {
  computeRequestHash,
  getIdempotentResponse,
  IDEMPOTENCY_CONFLICT,
  saveIdempotentResponse,
} from "@/domain/idempotency";
import {
  deleteTableMutation,
  updateTableMutation,
} from "@/domain";
import { posFailure, posSuccess, requireIdempotencyKey, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * GET /api/tables/[id]
 * Get single table
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401 });
    }

    const table = await db.query.tables.findFirst({
      where: eq(tables.id, id),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!table) {
      return posFailure("NOT_FOUND", "Table not found", { status: 404 });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, table.location.merchantId),
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

    const derivedStatus = await computeTableStatus(table.id);
    return posSuccess({ ...table, status: derivedStatus });
  } catch (error) {
    console.error("[GET /api/tables/[id]] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to fetch table"),
      { status: 500 }
    );
  }
}

const ROUTE_PUT_TABLE = "PUT /api/tables/[id]";
const ROUTE_DELETE_TABLE = "DELETE /api/tables/[id]";

/**
 * PUT /api/tables/[id]
 * Update table (including status)
 * Body: { tableNumber?, seats?, status? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let idempotencyKey: string | undefined;
  try {
    const keyRes = requireIdempotencyKey(request);
    if (!keyRes.ok) return keyRes.failure;
    idempotencyKey = keyRes.key;

    const { id } = await params;
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401, correlationId: idempotencyKey });
    }

    const body = await request.json().catch(() => ({}));
    const { tableNumber, seats, status } = body;

    const requestHash = computeRequestHash({ ...body, id });
    const cached = await getIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE_PUT_TABLE,
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
      return NextResponse.json(replayBody, { status: saved.status ?? 200 });
    }

    // Get existing table
    const existingTable = await db.query.tables.findFirst({
      where: eq(tables.id, id),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingTable) {
      return posFailure("NOT_FOUND", "Table not found", { status: 404, correlationId: idempotencyKey });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingTable.location.merchantId),
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

    const result = await updateTableMutation(existingTable.locationId, id, {
      tableNumber,
      seats,
      status,
    });
    if (!result.ok) {
      const code =
        result.reason === "table_not_found"
          ? "NOT_FOUND"
          : result.reason === "table_number_exists"
            ? "CONFLICT"
            : "BAD_REQUEST";
      const msg =
        result.reason === "table_not_found"
          ? "Table not found"
          : result.reason === "table_number_exists"
            ? "Table number already exists for this location"
            : "Invalid table status";
      const statusCode = result.reason === "table_not_found" ? 404 : result.reason === "table_number_exists" ? 409 : 400;
      const failureBody = { ok: false as const, error: { code, message: msg }, correlationId: idempotencyKey };
      await saveIdempotentResponse({
        key: idempotencyKey,
        userId: user.id,
        route: ROUTE_PUT_TABLE,
        requestHash,
        responseJson: { body: failureBody, status: statusCode },
      });
      return posFailure(code, msg, { status: statusCode, correlationId: idempotencyKey });
    }

    const successBody = { ok: true as const, data: { ...result.table }, correlationId: idempotencyKey };
    await saveIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE_PUT_TABLE,
      requestHash,
      responseJson: { body: successBody, status: 200 },
    });
    await revalidatePublicMenuForLocation(existingTable.locationId);
    return posSuccess(successBody.data, { correlationId: idempotencyKey });
  } catch (error) {
    console.error("[PUT /api/tables/[id]] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to update table"),
      { status: 500, correlationId: idempotencyKey }
    );
  }
}

/**
 * DELETE /api/tables/[id]
 * Delete table
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let idempotencyKey: string | undefined;
  try {
    const keyRes = requireIdempotencyKey(request);
    if (!keyRes.ok) return keyRes.failure;
    idempotencyKey = keyRes.key;

    const { id } = await params;
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401, correlationId: idempotencyKey });
    }

    // Get existing table
    const existingTable = await db.query.tables.findFirst({
      where: eq(tables.id, id),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingTable) {
      return posFailure("NOT_FOUND", "Table not found", { status: 404, correlationId: idempotencyKey });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingTable.location.merchantId),
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

    const body = await request.json().catch(() => ({}));
    const requestHash = computeRequestHash({ ...body, id });
    const cached = await getIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE_DELETE_TABLE,
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
      return NextResponse.json(replayBody, { status: saved.status ?? 200 });
    }

    const result = await deleteTableMutation(existingTable.locationId, id);
    if (!result.ok) {
      const failureBody = { ok: false as const, error: { code: "NOT_FOUND", message: "Table not found" }, correlationId: idempotencyKey };
      await saveIdempotentResponse({
        key: idempotencyKey,
        userId: user.id,
        route: ROUTE_DELETE_TABLE,
        requestHash,
        responseJson: { body: failureBody, status: 404 },
      });
      return posFailure("NOT_FOUND", "Table not found", { status: 404, correlationId: idempotencyKey });
    }

    const successBody = { ok: true as const, data: { success: true }, correlationId: idempotencyKey };
    await saveIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE_DELETE_TABLE,
      requestHash,
      responseJson: { body: successBody, status: 200 },
    });
    await revalidatePublicMenuForLocation(existingTable.locationId);
    return posSuccess(successBody.data, { correlationId: idempotencyKey });
  } catch (error) {
    console.error("[DELETE /api/tables/[id]] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to delete table"),
      { status: 500, correlationId: idempotencyKey }
    );
  }
}
