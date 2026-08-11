import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { tables } from "@/lib/db/schema/orders";
import { merchantUsers } from "@/lib/db/schema";
import { acknowledgeTableService, type AcknowledgeServiceType } from "@/lib/floor-map/acknowledgeTableService";
import { posFailure, posSuccess, requireIdempotencyKey, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * POST /api/tables/[id]/acknowledge-service
 * Staff marks a guest service request as handled (waiter call or bill request).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let idempotencyKey: string | undefined;
  try {
    const keyRes = requireIdempotencyKey(request);
    if (!keyRes.ok) return keyRes.failure;
    idempotencyKey = keyRes.key;

    const { id: tableId } = await params;
    if (!tableId?.trim()) {
      return posFailure("BAD_REQUEST", "Table id is required", {
        status: 400,
        correlationId: idempotencyKey,
      });
    }

    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", {
        status: 401,
        correlationId: idempotencyKey,
      });
    }

    const table = await db.query.tables.findFirst({
      where: eq(tables.id, tableId.trim()),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!table?.location) {
      return posFailure("NOT_FOUND", "Table not found", {
        status: 404,
        correlationId: idempotencyKey,
      });
    }

    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, table.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true),
      ),
      columns: { id: true },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "You don't have access to this location", {
        status: 403,
        correlationId: idempotencyKey,
      });
    }

    const body = await request.json().catch(() => ({}));
    const requestType: AcknowledgeServiceType =
      body?.requestType === "bill" ? "bill" : "waiter";

    const result = await acknowledgeTableService(table.location.id, table.id, requestType);
    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 400;
      return posFailure(result.code, result.message, {
        status,
        correlationId: idempotencyKey,
      });
    }

    return posSuccess(
      {
        tableId: result.tableId,
        sessionId: result.sessionId,
        alreadyHandled: result.alreadyHandled ?? false,
        message:
          requestType === "bill"
            ? result.alreadyHandled
              ? "Bill request already handled"
              : "Bill request handled"
            : result.alreadyHandled
              ? "Waiter request already handled"
              : "Waiter request handled",
      },
      { correlationId: idempotencyKey },
    );
  } catch (error) {
    console.error("[POST /api/tables/[id]/acknowledge-service] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to acknowledge service"),
      { status: 500, correlationId: idempotencyKey },
    );
  }
}
