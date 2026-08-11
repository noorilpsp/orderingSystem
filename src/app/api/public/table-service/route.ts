import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import {
  requestTableService,
  type TableServiceRequestType,
} from "@/lib/public-menu/requestTableService";

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

function parseRequestType(value: unknown): TableServiceRequestType | null {
  if (value === "waiter" || value === "bill") return value;
  return null;
}

/**
 * POST /api/public/table-service
 * Guest table service requests (call waiter, request bill). No authentication required.
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
    const requestType = parseRequestType(body.requestType);

    if (!storeSlug) {
      return posFailure("BAD_REQUEST", "storeSlug is required", { status: 400 });
    }
    if (!tableNumber) {
      return posFailure("BAD_REQUEST", "tableNumber is required", { status: 400 });
    }
    if (!requestType) {
      return posFailure("BAD_REQUEST", "requestType must be waiter or bill", { status: 400 });
    }

    if (!checkRateLimit(`${ip}:${storeSlug}:${tableNumber}:${requestType}`)) {
      return posFailure("TOO_MANY_REQUESTS", "Too many requests. Please try again shortly.", {
        status: 429,
      });
    }

    const result = await requestTableService({ storeSlug, tableNumber, requestType });

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
      return posFailure(result.code, result.message, { status });
    }

    return posSuccess({
      tableId: result.tableId,
      sessionId: result.sessionId,
      deduplicated: result.deduplicated ?? false,
      message:
        requestType === "bill"
          ? result.deduplicated
            ? "Bill request already sent to your server"
            : "Bill request sent to your server"
          : result.deduplicated
            ? "Your waiter has already been notified"
            : "Waiter notified",
    });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Internal server error"), { status: 500 });
  }
}
