import { NextRequest } from "next/server";
import { buildPublicMenuView } from "@/lib/public-menu/buildPublicMenuView";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * GET /api/public/menu/[storeSlug]
 * Public guest menu for a store. No authentication required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  const { storeSlug } = await params;
  const normalizedSlug = storeSlug?.trim().toLowerCase();

  if (!normalizedSlug) {
    return posFailure("BAD_REQUEST", "Store slug is required", { status: 400 });
  }

  try {
    const view = await buildPublicMenuView(normalizedSlug);
    if (!view) {
      return posFailure("NOT_FOUND", "Store not found", { status: 404 });
    }

    const response = posSuccess(view);
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    return response;
  } catch (error) {
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Connection is slow or unstable. Please try again."),
      { status: 503 },
    );
  }
}
