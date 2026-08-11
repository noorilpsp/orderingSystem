import { NextRequest, NextResponse } from "next/server";
import {
  patchLoyaltyReward,
  requireMerchantMember,
  type LoyaltyRewardKind,
  type LoyaltyRewardStatus,
} from "@/lib/loyalty/loyaltyRewards";

export const runtime = "nodejs";

/**
 * PATCH /api/loyalty/rewards/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rewardId } = await params;
  const body = await request.json().catch(() => ({}));
  const merchantId = typeof body.merchantId === "string" ? body.merchantId.trim() : "";
  const auth = await requireMerchantMember(merchantId);
  if (!auth.ok) {
    const status =
      auth.error === "UNAUTHORIZED" ? 401 : auth.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: auth.error }, { status });
  }

  const result = await patchLoyaltyReward({
    rewardId,
    merchantId,
    name: typeof body.name === "string" ? body.name : undefined,
    description:
      body.description === null
        ? null
        : typeof body.description === "string"
          ? body.description
          : undefined,
    status: body.status as LoyaltyRewardStatus | undefined,
    kind: body.kind as LoyaltyRewardKind | undefined,
    pointsCost: body.pointsCost != null ? Number(body.pointsCost) : undefined,
    discountAmount:
      body.discountAmount != null ? Number(body.discountAmount) : undefined,
    percentOff: body.percentOff != null ? Number(body.percentOff) : undefined,
    maxDiscountAmount:
      body.maxDiscountAmount != null ? Number(body.maxDiscountAmount) : undefined,
    menuItemId:
      body.menuItemId === null
        ? null
        : typeof body.menuItemId === "string"
          ? body.menuItemId
          : undefined,
    locationId:
      body.locationId === null
        ? null
        : typeof body.locationId === "string"
          ? body.locationId
          : undefined,
  });

  if (!result.ok) {
    const status = result.error === "Reward not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ reward: result.reward });
}
