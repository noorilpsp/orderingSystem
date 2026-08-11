import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { getPublicOrderStatus } from "@/lib/public-menu/getPublicOrderStatus";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

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

function parseFallbackEtaMinutes(value: string | null): number {
  if (!value) return 15;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

/**
 * GET /api/public/orders/[orderId]/status?storeSlug=...
 * Live guest order tracking from kitchen item statuses. No authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const storeSlug = request.nextUrl.searchParams.get("storeSlug")?.trim().toLowerCase() ?? "";
    const fallbackEtaMinutes = parseFallbackEtaMinutes(request.nextUrl.searchParams.get("eta"));

    if (!storeSlug) {
      return posFailure("BAD_REQUEST", "storeSlug is required", { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (!checkRateLimit(`${ip}:${storeSlug}:${orderId}:status`)) {
      return posFailure("TOO_MANY_REQUESTS", "Too many requests. Please try again shortly.", {
        status: 429,
      });
    }

    const result = await getPublicOrderStatus(storeSlug, orderId, fallbackEtaMinutes);
    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 400;
      return posFailure(result.code, result.message, { status });
    }

    const response = posSuccess(result.status);
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    return response;
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Failed to load order status"), {
      status: 500,
    });
  }
}
