import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import {
  addGuestTableExtraPayer,
  removeGuestTableExtraPayer,
} from "@/lib/public-menu/guestTableSplitState";

export const runtime = "nodejs";

/**
 * POST /api/public/table-bill/payers
 * Body:
 * - { storeSlug, tableNumber, deviceId, action: "add", payer?: { id, seatNumber } }
 * - { storeSlug, tableNumber, deviceId, action: "remove", payerId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      storeSlug?: string;
      tableNumber?: string;
      deviceId?: string;
      action?: string;
      payerId?: string;
      payer?: { id?: string; seatNumber?: number };
    } | null;

    const storeSlug = (body?.storeSlug ?? "").trim();
    const tableNumber = (body?.tableNumber ?? "").trim();
    const deviceId = (body?.deviceId ?? "").trim();
    const action = (body?.action ?? "").trim().toLowerCase();

    if (!storeSlug || !tableNumber || !deviceId) {
      return posFailure(
        "BAD_REQUEST",
        "storeSlug, tableNumber, and deviceId are required",
        { status: 400 },
      );
    }

    if (action === "add") {
      const result = await addGuestTableExtraPayer({
        storeSlug,
        tableNumber,
        deviceId,
        payer: body?.payer,
      });
      if (!result.ok) {
        const status =
          result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
        return posFailure(result.code, result.message, { status });
      }
      return posSuccess({
        extraPayers: result.extraPayers,
        added: result.added,
      });
    }

    if (action === "remove") {
      const payerId = (body?.payerId ?? "").trim();
      if (!payerId) {
        return posFailure("BAD_REQUEST", "payerId is required", { status: 400 });
      }
      const result = await removeGuestTableExtraPayer({
        storeSlug,
        tableNumber,
        deviceId,
        payerId,
      });
      if (!result.ok) {
        const status =
          result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
        return posFailure(result.code, result.message, { status });
      }
      return posSuccess({
        extraPayers: result.extraPayers,
        claims: result.claims,
      });
    }

    return posFailure("BAD_REQUEST", 'action must be "add" or "remove"', {
      status: 400,
    });
  } catch (error) {
    console.error("[public/table-bill/payers]", error);
    return posFailure("INTERNAL", toErrorMessage(error), { status: 500 });
  }
}
