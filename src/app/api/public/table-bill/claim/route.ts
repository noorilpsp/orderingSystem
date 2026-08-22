import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import {
  assignGuestBillLine,
  assignGuestBillLinesBatch,
  claimGuestBillLine,
} from "@/lib/public-menu/guestTableSplitState";

export const runtime = "nodejs";

/**
 * POST /api/public/table-bill/claim
 * Body variants:
 * - { storeSlug, tableNumber, deviceId, lineId, claim: boolean } - claim me / release
 * - { storeSlug, tableNumber, deviceId, lineId, seatId } - assign to seat (last write wins)
 * - { storeSlug, tableNumber, deviceId, lineId, shares: [{ seatId, shares }] } - split
 * - { storeSlug, tableNumber, deviceId, lineId, clear: true } - clear
 * - { storeSlug, tableNumber, deviceId, assignments: [...] } - batch preset / clear-all
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      storeSlug?: string;
      tableNumber?: string;
      deviceId?: string;
      lineId?: string;
      claim?: boolean;
      clear?: boolean;
      seatId?: string | null;
      shares?: Array<{ seatId?: string; shares?: number }>;
      assignments?: Array<{
        lineId?: string;
        clear?: boolean;
        seatId?: string | null;
        shares?: Array<{ seatId?: string; shares?: number }>;
      }>;
    } | null;

    const storeSlug = (body?.storeSlug ?? "").trim();
    const tableNumber = (body?.tableNumber ?? "").trim();
    const deviceId = (body?.deviceId ?? "").trim();

    if (!storeSlug || !tableNumber || !deviceId) {
      return posFailure(
        "BAD_REQUEST",
        "storeSlug, tableNumber, and deviceId are required",
        { status: 400 },
      );
    }

    if (Array.isArray(body?.assignments)) {
      const result = await assignGuestBillLinesBatch({
        storeSlug,
        tableNumber,
        deviceId,
        assignments: body.assignments.map((row) => ({
          lineId: String(row.lineId ?? ""),
          clear: Boolean(row.clear),
          seatId: row.seatId,
          shares: row.shares
            ?.filter((share) => share.seatId)
            .map((share) => ({
              seatId: String(share.seatId),
              shares: share.shares,
            })),
        })),
      });
      if (!result.ok) {
        const status =
          result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
        return posFailure(result.code, result.message, { status });
      }
      return posSuccess({ claims: result.claims });
    }

    const lineId = (body?.lineId ?? "").trim();
    if (!lineId) {
      return posFailure(
        "BAD_REQUEST",
        "storeSlug, tableNumber, deviceId, and lineId are required",
        { status: 400 },
      );
    }

    // Legacy claim/release toggle
    if (typeof body?.claim === "boolean" && !body.clear && !body.shares && body.seatId == null) {
      const result = await claimGuestBillLine({
        storeSlug,
        tableNumber,
        deviceId,
        lineId,
        claim: body.claim,
      });
      if (!result.ok) {
        const status =
          result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
        return posFailure(result.code, result.message, { status });
      }
      return posSuccess({ claims: result.claims });
    }

    const result = await assignGuestBillLine({
      storeSlug,
      tableNumber,
      deviceId,
      lineId,
      clear: Boolean(body?.clear),
      seatId: body?.seatId,
      shares: body?.shares
        ?.filter((row) => row.seatId)
        .map((row) => ({
          seatId: String(row.seatId),
          shares: row.shares,
        })),
    });
    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
      return posFailure(result.code, result.message, { status });
    }

    return posSuccess({ claims: result.claims });
  } catch (error) {
    console.error("[public/table-bill/claim]", error);
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Internal server error"), {
      status: 500,
    });
  }
}
