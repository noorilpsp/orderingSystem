import { NextRequest, NextResponse } from "next/server";
import { getLoyaltyMembersViewForRequest } from "@/lib/loyalty/getLoyaltyMembersView";

export const runtime = "nodejs";

/**
 * GET /api/loyalty/members
 * Paginated loyalty program members for dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get("merchantId")?.trim() ?? "";
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "20", 10);
  const search = searchParams.get("search")?.trim() ?? "";
  const locationId = searchParams.get("locationId")?.trim() || null;

  if (!merchantId) {
    return NextResponse.json({ error: "merchantId is required" }, { status: 400 });
  }

  const result = await getLoyaltyMembersViewForRequest({
    merchantId,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    search,
    locationId,
  });

  if (result.error === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (result.error === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (result.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }
  if (result.error === "BAD_REQUEST") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
