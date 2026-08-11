import { NextRequest } from "next/server";
import { getPosUserId } from "@/lib/pos/posAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPosMerchantContext } from "@/lib/pos/posMerchantContext";
import { buildKdsView } from "@/lib/kds/buildKdsView";
import { assertLocationKdsEnabled } from "@/lib/kds/assertKdsEnabled";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * GET /api/kds/view?locationId=<uuid>
 * Returns full KDS read model for the location. Read-only.
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get("locationId");
    if (!locationId?.trim()) {
      return posFailure("BAD_REQUEST", "locationId is required", { status: 400 });
    }

    const supabase = await supabaseServer();
    const authResult = await getPosUserId(supabase);
    if (!authResult.ok) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401 });
    }

    const ctx = await getPosMerchantContext(authResult.userId);
    if (!ctx.locationIds.length) {
      return posFailure("FORBIDDEN", "Forbidden - No locations available", { status: 403 });
    }
    if (!ctx.locationIds.includes(locationId)) {
      return posFailure(
        "FORBIDDEN",
        "Forbidden - You don't have access to this location",
        { status: 403 }
      );
    }

    const kdsGate = await assertLocationKdsEnabled(locationId);
    if (kdsGate) return kdsGate;

    const view = await buildKdsView(locationId);
    if (!view) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    return posSuccess(view);
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to load KDS view"),
      { status: 500 }
    );
  }
}
