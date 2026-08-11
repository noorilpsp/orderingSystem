import { NextRequest } from "next/server";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { getGuestOrderHistory } from "@/lib/public-menu/getGuestOrderHistory";

export const runtime = "nodejs";

/**
 * GET /api/public/orders/history?storeSlug=...
 * Past orders for the signed-in diner at this store. Anonymous callers get an empty list.
 */
export async function GET(request: NextRequest) {
  try {
    const storeSlug =
      request.nextUrl.searchParams.get("storeSlug")?.trim().toLowerCase() ?? "";
    if (!storeSlug) {
      return posFailure("BAD_REQUEST", "storeSlug is required", { status: 400 });
    }

    const result = await getGuestOrderHistory(storeSlug);
    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 400;
      return posFailure(result.code, result.message, { status });
    }

    const response = posSuccess({
      signedIn: result.signedIn,
      orders: result.orders,
    });
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    return response;
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Failed to load order history"),
      { status: 500 },
    );
  }
}
