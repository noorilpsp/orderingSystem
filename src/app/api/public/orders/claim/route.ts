import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import {
  claimGuestOrderForAccount,
  type ClaimGuestOrderFailureCode,
} from "@/lib/public-menu/claimGuestOrderForAccount";

export const runtime = "nodejs";

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

function statusForCode(code: ClaimGuestOrderFailureCode): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "GONE":
      return 410;
    case "INTERNAL_ERROR":
      return 500;
    default: {
      const _exhaustive: never = code;
      throw new Error(`Unhandled claim failure: ${_exhaustive}`);
    }
  }
}

/**
 * POST /api/public/orders/claim
 * Attach a guest-placed order to the signed-in diner and award points if complete.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      storeSlug?: string;
      orderId?: string;
      token?: string;
    } | null;

    const storeSlug = body?.storeSlug?.trim().toLowerCase() ?? "";
    const orderId = body?.orderId?.trim() ?? "";
    const token = body?.token?.trim() ?? "";

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (!checkRateLimit(`${ip}:${storeSlug || "none"}:claim`)) {
      return posFailure("TOO_MANY_REQUESTS", "Too many attempts. Please try again shortly.", {
        status: 429,
      });
    }

    const result = await claimGuestOrderForAccount({ storeSlug, orderId, token });
    if (!result.ok) {
      return posFailure(result.code, result.message, { status: statusForCode(result.code) });
    }

    return posSuccess({ awarded: result.awarded });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Failed to save this order"), {
      status: 500,
    });
  }
}
