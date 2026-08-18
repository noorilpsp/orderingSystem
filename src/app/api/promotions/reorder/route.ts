import { NextRequest, NextResponse } from "next/server";
import {
  reorderPromotions,
  requireMerchantMember,
} from "@/lib/promotions/promotionsApi";

export const runtime = "nodejs";

/**
 * PUT /api/promotions/reorder
 * Body: { merchantId, locationId, promotions: [{ id, displayOrder }] }
 */
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const merchantId = typeof body.merchantId === "string" ? body.merchantId.trim() : "";
  const locationId = typeof body.locationId === "string" ? body.locationId.trim() : "";
  const auth = await requireMerchantMember(merchantId);
  if (!auth.ok) {
    const status =
      auth.error === "UNAUTHORIZED" ? 401 : auth.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: auth.error }, { status });
  }
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }
  if (!Array.isArray(body.promotions)) {
    return NextResponse.json({ error: "promotions array is required" }, { status: 400 });
  }

  const updates = body.promotions.filter(
    (update: { id?: unknown; displayOrder?: unknown }) =>
      typeof update?.id === "string" && typeof update?.displayOrder === "number",
  ) as Array<{ id: string; displayOrder: number }>;

  const result = await reorderPromotions(merchantId, locationId, updates);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
