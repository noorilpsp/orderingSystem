import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import {
  claimGuestTableSeat,
  listGuestTableSeats,
  updateGuestSeatName,
} from "@/lib/public-menu/claimGuestTableSeat";

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

function failureStatus(code: string): number {
  if (code === "NOT_FOUND") return 404;
  if (code === "FORBIDDEN") return 403;
  if (code === "TOO_MANY_REQUESTS") return 429;
  if (code === "CONFLICT") return 409;
  return 400;
}

/**
 * POST /api/public/table-seat - claim or re-join a seat for this device at a table.
 * GET  /api/public/table-seat?storeSlug=&tableNumber= - list seats for change-seat UI.
 * PATCH /api/public/table-seat - set optional guest name on the claimed seat.
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

    if (!storeSlug || !tableNumber || !deviceId) {
      return posFailure("BAD_REQUEST", "storeSlug, tableNumber, and deviceId are required", {
        status: 400,
      });
    }

    if (!checkRateLimit(`${ip}:${storeSlug}:${tableNumber}:claim`)) {
      return posFailure("TOO_MANY_REQUESTS", "Too many requests. Please try again shortly.", {
        status: 429,
      });
    }

    const result = await claimGuestTableSeat({ storeSlug, tableNumber, deviceId });
    if (!result.ok) {
      return posFailure(result.code, result.message, { status: failureStatus(result.code) });
    }

    return posSuccess(result.data);
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Internal server error"), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeSlug = (searchParams.get("storeSlug") ?? "").trim().toLowerCase();
    const tableNumber = (searchParams.get("tableNumber") ?? "").trim();

    if (!storeSlug || !tableNumber) {
      return posFailure("BAD_REQUEST", "storeSlug and tableNumber are required", { status: 400 });
    }

    const result = await listGuestTableSeats({ storeSlug, tableNumber });
    if (!result.ok) {
      return posFailure(result.code, result.message, { status: failureStatus(result.code) });
    }

    return posSuccess({ seats: result.seats });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Internal server error"), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const body = await request.json().catch(() => ({}));
    const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug.trim().toLowerCase() : "";
    const seatId = typeof body.seatId === "string" ? body.seatId.trim() : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const guestName =
      body.guestName === null || typeof body.guestName === "string" ? body.guestName : undefined;

    if (!storeSlug || !seatId || !deviceId) {
      return posFailure("BAD_REQUEST", "storeSlug, seatId, and deviceId are required", {
        status: 400,
      });
    }

    if (!checkRateLimit(`${ip}:${storeSlug}:${seatId}:name`)) {
      return posFailure("TOO_MANY_REQUESTS", "Too many requests. Please try again shortly.", {
        status: 429,
      });
    }

    const result = await updateGuestSeatName({ storeSlug, seatId, deviceId, guestName });
    if (!result.ok) {
      return posFailure(result.code, result.message, { status: failureStatus(result.code) });
    }

    return posSuccess(result.data);
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Internal server error"), { status: 500 });
  }
}
