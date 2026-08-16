import { NextRequest, NextResponse } from "next/server";
import {
  deletePromotion,
  requireMerchantMember,
  setPromotionStatus,
  updatePromotion,
  type PromotionKind,
  type PromotionStatus,
} from "@/lib/promotions/promotionsApi";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/promotions/:id
 * DELETE /api/promotions/:id
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const merchantId = typeof body.merchantId === "string" ? body.merchantId.trim() : "";
  const auth = await requireMerchantMember(merchantId);
  if (!auth.ok) {
    const status =
      auth.error === "UNAUTHORIZED" ? 401 : auth.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: auth.error }, { status });
  }

  const isStatusOnly =
    (body.status === "active" || body.status === "paused") &&
    body.items === undefined &&
    body.name === undefined &&
    body.kind === undefined;
  if (isStatusOnly) {
    const result = await setPromotionStatus(merchantId, id, body.status);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ promotion: result.promotion });
  }

  const result = await updatePromotion(id, {
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
  return NextResponse.json({ promotion: result.promotion });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const merchantId =
    new URL(request.url).searchParams.get("merchantId")?.trim() ?? "";
  const auth = await requireMerchantMember(merchantId);
  if (!auth.ok) {
    const status =
      auth.error === "UNAUTHORIZED" ? 401 : auth.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: auth.error }, { status });
  }

  const result = await deletePromotion(merchantId, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
