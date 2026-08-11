/**
 * Server helper for fetching FloorMapView. Used by the floor-map page for initial server render.
 * Auth via supabaseServer + getPosUserId; location from getCurrentLocationId cookie.
 */

import { getCurrentLocationId } from "@/app/actions/location";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPosMerchantContext } from "@/lib/pos/posMerchantContext";
import { getPosUserId } from "@/lib/pos/posAuth";
import { withDbRetry, toUserFacingDbError } from "@/lib/db/withDbRetry";
import { buildFloorMapView } from "@/lib/floor-map/buildFloorMapView";
import type { FloorMapView } from "@/lib/floor-map/floorMapView";

/** Dev-only timing for perf diagnosis. No-op in production. */
const DEV = process.env.NODE_ENV !== "production";
function devTimer(label: string, start: number): void {
  if (!DEV) return;
  const ms = Math.round(performance.now() - start);
  // eslint-disable-next-line no-console
  console.log(`[getFloorMapView] ${label}: ${ms}ms`);
}

export type GetFloorMapViewResult =
  | { data: FloorMapView }
  | {
      error: "UNAUTHORIZED" | "FORBIDDEN" | "NO_LOCATION" | "DB_ERROR";
      message?: string;
    };

/**
 * Fetch FloorMapView for server-side render.
 * Uses locationId from cookie (getCurrentLocationId). If no location selected, returns NO_LOCATION.
 * Caller should render no-location state when error === "NO_LOCATION".
 */
export async function getFloorMapView(
  floorplanId?: string | null
): Promise<GetFloorMapViewResult> {
  const totalStart = DEV ? performance.now() : 0;

  const t0 = DEV ? performance.now() : 0;
  const locationId = await getCurrentLocationId();
  if (DEV) devTimer("getCurrentLocationId (cookie read)", t0);
  if (!locationId?.trim()) {
    return { error: "NO_LOCATION" };
  }

  const t1 = DEV ? performance.now() : 0;
  const supabase = await supabaseServer();
  const authResult = await getPosUserId(supabase);
  if (DEV) devTimer("auth (supabaseServer + getPosUserId)", t1);
  if (!authResult.ok) {
    return { error: "UNAUTHORIZED" };
  }

  const t2 = DEV ? performance.now() : 0;
  const ctx = await getPosMerchantContext(authResult.userId);
  if (DEV) devTimer("merchant context (getPosMerchantContext)", t2);
  if (ctx.locationIds.length === 0) {
    return { error: "FORBIDDEN" };
  }
  if (!ctx.locationIds.includes(locationId)) {
    return { error: "FORBIDDEN" };
  }

  const t3 = DEV ? performance.now() : 0;
  try {
    const view = await withDbRetry(() =>
      buildFloorMapView(locationId, authResult.userId, floorplanId),
    );
    if (DEV) devTimer("buildFloorMapView", t3);
    if (!view) {
      return { error: "NO_LOCATION" };
    }

    if (DEV) devTimer("getFloorMapView total", totalStart);
    return { data: view };
  } catch (error) {
    if (DEV) devTimer("buildFloorMapView (failed)", t3);
    return {
      error: "DB_ERROR",
      message: toUserFacingDbError(error, "Failed to load floor map. Please try again."),
    };
  }
}
