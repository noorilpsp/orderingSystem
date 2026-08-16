import { NextRequest, NextResponse } from "next/server";
import {
  computeRequestHash,
  getIdempotentResponse,
  IDEMPOTENCY_CONFLICT,
  saveIdempotentResponse,
} from "@/domain/idempotency";
import { posFailure, requireIdempotencyKey } from "@/app/api/_lib/pos-envelope";
import { toUserFacingDbError, withDbRetry } from "@/lib/db/withDbRetry";
import {
  createPublicOrder,
  getPublicGuestIdempotencyUserId,
} from "@/lib/public-menu/createPublicOrder";

export const runtime = "nodejs";

const ROUTE = "POST /api/public/orders";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

/**
 * POST /api/public/orders
 * Create a guest order for a public store menu. No authentication required.
 */
export async function POST(request: NextRequest) {
  let idempotencyKey: string | undefined;
  try {
    const idem = requireIdempotencyKey(request);
    if (!idem.ok) return idem.failure;
    idempotencyKey = idem.key;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const body = await request.json().catch(() => ({}));
    const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug.trim().toLowerCase() : "";

    if (!storeSlug) {
      return posFailure("BAD_REQUEST", "storeSlug is required", {
        status: 400,
        correlationId: idempotencyKey,
      });
    }

    if (!checkRateLimit(`${ip}:${storeSlug}`)) {
      return posFailure("TOO_MANY_REQUESTS", "Too many order attempts. Please try again shortly.", {
        status: 429,
        correlationId: idempotencyKey,
      });
    }

    const guestUserId = getPublicGuestIdempotencyUserId();
    const requestHash = computeRequestHash(body);
    const cached = await withDbRetry(() =>
      getIdempotentResponse({
        key: idempotencyKey!,
        userId: guestUserId,
        route: ROUTE,
        requestHash,
      }),
    );

    if (cached) {
      if (!cached.ok) {
        return posFailure(IDEMPOTENCY_CONFLICT, "Idempotency-Key reuse with different request", {
          status: 409,
          correlationId: idempotencyKey,
        });
      }
      const saved = cached.response as { body: Record<string, unknown>; status: number };
      const replayBody = {
        ...(saved.body ?? cached.response) as Record<string, unknown>,
        correlationId: idempotencyKey,
      };
      return NextResponse.json(replayBody, { status: saved.status ?? 201 });
    }

    const result = await withDbRetry(() =>
      createPublicOrder({
        storeSlug,
        orderType: body.orderType,
        paymentTiming: body.paymentTiming ?? "pay_later",
        tableNumber: body.tableNumber ?? null,
        seatId: body.seatId ?? null,
        deviceId: body.deviceId ?? null,
        guestCount: body.guestCount,
        notes: body.notes ?? null,
        scheduledPickupAt: body.scheduledPickupAt ?? null,
        pointsToRedeem:
          typeof body.pointsToRedeem === "number" && body.pointsToRedeem > 0
            ? Math.floor(body.pointsToRedeem)
            : undefined,
        rewardId:
          typeof body.rewardId === "string" && body.rewardId.trim().length > 0
            ? body.rewardId.trim()
            : undefined,
        items: body.items ?? [],
      }),
    );

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "FORBIDDEN"
            ? 403
            : result.code === "TOO_MANY_REQUESTS"
              ? 429
              : result.code === "INTERNAL_ERROR"
                ? 500
                : 400;
      return posFailure(result.code, result.message, {
        status,
        correlationId: idempotencyKey,
      });
    }

    const responseBody = {
      ok: true,
      data: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
      },
      correlationId: idempotencyKey,
    };

    await withDbRetry(() =>
      saveIdempotentResponse({
        key: idempotencyKey!,
        userId: guestUserId,
        route: ROUTE,
        requestHash,
        responseJson: { body: responseBody, status: 201 },
      }),
    );

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    console.error("[POST /api/public/orders]", error);
    return posFailure(
      "INTERNAL_ERROR",
      toUserFacingDbError(error, "Failed to create order. Please try again."),
      { status: 500, correlationId: idempotencyKey },
    );
  }
}
