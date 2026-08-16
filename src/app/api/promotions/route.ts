import { NextRequest, NextResponse } from "next/server";
import {
  createPromotion,
  listPromotionsForLocation,
  requireMerchantMember,
  type PromotionKind,
  type PromotionStatus,
} from "@/lib/promotions/promotionsApi";

export const runtime = "nodejs";

/**
 * GET /api/promotions?merchantId=&locationId=
 * POST /api/promotions
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const merchantId = params.get("merchantId")?.trim() ?? "";
  const locationId = params.get("locationId")?.trim() ?? "";
  const auth = await requireMerchantMember(merchantId);
  if (!auth.ok) {
    const status =
      auth.error === "UNAUTHORIZED" ? 401 : auth.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: auth.error }, { status });
  }
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const promotions = await listPromotionsForLocation(merchantId, locationId);
  return NextResponse.json({ promotions });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const merchantId = typeof body.merchantId === "string" ? body.merchantId.trim() : "";
  const auth = await requireMerchantMember(merchantId);
  if (!auth.ok) {
    const status =
      auth.error === "UNAUTHORIZED" ? 401 : auth.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: auth.error }, { status });
  }

  const result = await createPromotion({
    merchantId,
    locationId: typeof body.locationId === "string" ? body.locationId.trim() : "",
    name: typeof body.name === "string" ? body.name : "",
    kind: body.kind as PromotionKind,
    status: body.status as PromotionStatus | undefined,
    startsOn: body.startsOn ?? null,
    endsOn: body.endsOn ?? null,
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
    activeDays: Array.isArray(body.activeDays) ? body.activeDays : null,
    items: Array.isArray(body.items) ? body.items : [],
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ promotion: result.promotion }, { status: 201 });
}
