import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { getGuestTableBillSplit } from "@/lib/public-menu/getGuestTableBillSplit";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;

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
 * GET /api/public/table-bill?storeSlug=&tableNumber=&deviceId=&seatId=
 * Guest bill preview for the caller's claimed seat only (floor-plan style: one table join).
 */
export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const storeSlug = (request.nextUrl.searchParams.get("storeSlug") ?? "").trim().toLowerCase();
    const tableNumber = (request.nextUrl.searchParams.get("tableNumber") ?? "").trim();
    const deviceId = (request.nextUrl.searchParams.get("deviceId") ?? "").trim();
    const seatId = (request.nextUrl.searchParams.get("seatId") ?? "").trim() || null;

    if (!storeSlug) {
      return posFailure("BAD_REQUEST", "storeSlug is required", { status: 400 });
    }
    if (!tableNumber) {
      return posFailure("BAD_REQUEST", "tableNumber is required", { status: 400 });
    }
    if (!deviceId) {
      return posFailure("BAD_REQUEST", "deviceId is required", { status: 400 });
    }

    if (!checkRateLimit(`${ip}:${storeSlug}:${tableNumber}:bill`)) {
      return posFailure("TOO_MANY_REQUESTS", "Too many requests. Please try again shortly.", {
        status: 429,
      });
    }

    const result = await getGuestTableBillSplit({ storeSlug, tableNumber, deviceId, seatId });
    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
      return posFailure(result.code, result.message, { status });
    }

    return posSuccess(result);
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Internal server error"), {
      status: 500,
    });
  }
}
