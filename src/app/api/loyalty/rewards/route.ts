import { NextRequest, NextResponse } from "next/server";
import {
  createLoyaltyReward,
  listLoyaltyRewards,
  requireMerchantMember,
  type LoyaltyRewardKind,
  type LoyaltyRewardStatus,
} from "@/lib/loyalty/loyaltyRewards";
import { revalidatePublicMenuForMerchant } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * GET /api/loyalty/rewards?merchantId=
 * POST /api/loyalty/rewards
 */
export async function GET(request: NextRequest) {
  const merchantId = new URL(request.url).searchParams.get("merchantId")?.trim() ?? "";
  const auth = await requireMerchantMember(merchantId);
  if (!auth.ok) {
    const status =
      auth.error === "UNAUTHORIZED" ? 401 : auth.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: auth.error }, { status });
  }

  const rewards = await listLoyaltyRewards(merchantId);
  return NextResponse.json({ rewards });
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

  const kind = body.kind as LoyaltyRewardKind;
  const result = await createLoyaltyReward({
    merchantId,
    name: typeof body.name === "string" ? body.name : "",
    description: typeof body.description === "string" ? body.description : null,
    status: (body.status as LoyaltyRewardStatus | undefined) ?? "active",
    kind,
    pointsCost: Number(body.pointsCost),
    discountAmount:
      body.discountAmount != null ? Number(body.discountAmount) : null,
    percentOff: body.percentOff != null ? Number(body.percentOff) : null,
    maxDiscountAmount:
      body.maxDiscountAmount != null ? Number(body.maxDiscountAmount) : null,
    menuItemId: typeof body.menuItemId === "string" ? body.menuItemId : null,
    locationId: typeof body.locationId === "string" ? body.locationId : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await revalidatePublicMenuForMerchant(merchantId);
  return NextResponse.json({ reward: result.reward }, { status: 201 });
}
