import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import {
  proposeGuestTableSplit,
  type GuestSplitMode,
} from "@/lib/public-menu/guestTableSplitState";

export const runtime = "nodejs";

/**
 * POST /api/public/table-bill/propose
 * Body: { storeSlug, tableNumber, deviceId, mode, equalCount?, amounts, unassignedAmount? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      storeSlug?: string;
      tableNumber?: string;
      deviceId?: string;
      mode?: GuestSplitMode;
      equalCount?: number;
      amounts?: Array<{
        seatId?: string | null;
        seatNumber?: number | null;
        amount?: number;
      }>;
      unassignedAmount?: number;
    } | null;

    const storeSlug = (body?.storeSlug ?? "").trim();
    const tableNumber = (body?.tableNumber ?? "").trim();
    const deviceId = (body?.deviceId ?? "").trim();
    const mode = body?.mode;

    if (!storeSlug || !tableNumber || !deviceId || !mode) {
      return posFailure(
        "BAD_REQUEST",
        "storeSlug, tableNumber, deviceId, and mode are required",
        { status: 400 },
      );
    }
    if (!Array.isArray(body?.amounts)) {
      return posFailure("BAD_REQUEST", "amounts is required", { status: 400 });
    }

    const result = await proposeGuestTableSplit({
      storeSlug,
      tableNumber,
      deviceId,
      mode,
      equalCount: body?.equalCount,
      amounts: body.amounts.map((row) => ({
        seatId: row.seatId ?? null,
        seatNumber: row.seatNumber ?? null,
        amount: Number(row.amount ?? 0),
      })),
      unassignedAmount: body?.unassignedAmount,
    });
    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
      return posFailure(result.code, result.message, { status });
    }

    return posSuccess({ proposal: result.proposal });
  } catch (error) {
    return posFailure("INTERNAL_ERROR", toErrorMessage(error, "Internal server error"), {
      status: 500,
    });
  }
}
