import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { changeGuestTableSeat } from "@/lib/public-menu/claimGuestTableSeat";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

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

function failureStatus(code: string): number {
  if (code === "NOT_FOUND") return 404;
  if (code === "FORBIDDEN") return 403;
  if (code === "CONFLICT") return 409;
  return 400;
}

/**
 * POST /api/public/table-seat/change — move this device to another seat.
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const body = await request.json().catch(() => ({}));
    const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug.trim().toLowerCase() : "";
    const tableNumber = typeof body.tableNumber === "string" ? body.tableNumber.trim() : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const targetSeatNumber =
      typeof body.targetSeatNumber === "number" && Number.isFinite(body.targetSeatNumber)
        ? Math.floor(body.targetSeatNumber)
        : undefined;

    if (!storeSlug || !tableNumber || !deviceId) {
      return posFailure("BAD_REQUEST", "storeSlug, tableNumber, and deviceId are required", {
        status: 400,
      });
    }

    if (!checkRateLimit(`${ip}:${storeSlug}:${tableNumber}:change`)) {
      return posFailure("TOO_MANY_REQUESTS", "Too many requests. Please try again shortly.", {
        status: 429,
      });
    }

    const result = await changeGuestTableSeat({
      storeSlug,
      tableNumber,
      deviceId,
      targetSeatNumber,
    });
    if (!result.ok) {
      return posFailure(result.code, result.message, { status: failureStatus(result.code) });
    }

    return posSuccess(result.data);
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Internal server error"), { status: 500 });
  }
}
