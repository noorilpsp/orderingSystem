import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { orders } from "@/lib/db/schema/orders";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import {
  computeRequestHash,
  getIdempotentResponse,
  IDEMPOTENCY_CONFLICT,
  saveIdempotentResponse,
} from "@/domain/idempotency";
import { updateOrderStatus } from "@/domain";
import { posFailure, posSuccess, requireIdempotencyKey, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * PUT /api/orders/[id]/status
 * Update order status (also creates timeline entry)
 * Body: { status, note?, changedByStaffId? }
 */
const ROUTE = "PUT /api/orders/[id]/status";

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
    const { status, note, changedByStaffId, etaMinutes } = body;

    if (!status) {
      return posFailure("BAD_REQUEST", "Status is required", { status: 400, correlationId: idempotencyKey });
    }

    const parsedEtaMinutes =
      typeof etaMinutes === "number" && Number.isFinite(etaMinutes) && etaMinutes > 0
        ? Math.min(180, Math.max(1, Math.round(etaMinutes)))
        : typeof etaMinutes === "string" && etaMinutes.trim()
          ? (() => {
              const n = Number.parseInt(etaMinutes, 10);
              return Number.isFinite(n) && n > 0 ? Math.min(180, Math.max(1, n)) : undefined;
            })()
          : undefined;

    const requestHash = computeRequestHash({ ...body, id });
    const cached = await getIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE,
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

    const existingOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { location: { columns: { merchantId: true } } },
    });

    if (!existingOrder) {
      return posFailure("NOT_FOUND", "Order not found", { status: 404, correlationId: idempotencyKey });
    }

    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingOrder.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: { id: true },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "Forbidden - You don't have access to this location", {
        status: 403,
        correlationId: idempotencyKey,
      });
    }

    const result = await updateOrderStatus(id, {
      status,
      note: note ?? undefined,
      changedByStaffId: changedByStaffId ?? undefined,
      changedByUserId: user.id,
      etaMinutes: parsedEtaMinutes,
    });

    if (!result.ok) {
      const statusCode = result.reason === "unauthorized" ? 403 : 400;
      const code = statusCode === 403 ? "FORBIDDEN" : "BAD_REQUEST";
      const failureBody = { ok: false as const, error: { code, message: result.reason }, correlationId: idempotencyKey };
      await saveIdempotentResponse({
        key: idempotencyKey,
        userId: user.id,
        route: ROUTE,
        requestHash,
        responseJson: { body: failureBody, status: statusCode },
      });
      return posFailure(code, result.reason, { status: statusCode, correlationId: idempotencyKey });
    }

    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });
    const successBody = { ok: true as const, data: { order: updatedOrder }, correlationId: idempotencyKey };
    await saveIdempotentResponse({
      key: idempotencyKey,
      userId: user.id,
      route: ROUTE,
      requestHash,
      responseJson: { body: successBody, status: 200 },
    });
    return posSuccess(successBody.data, { correlationId: idempotencyKey });
  } catch (error) {
    console.error("[PUT /api/orders/[id]/status] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to update order status"),
      { status: 500, correlationId: idempotencyKey }
    );
  }
}
