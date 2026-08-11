/**
 * Server helper for fetching KdsView. Used by the KDS page for initial server render.
 * Auth via supabaseServer + getPosUserId; location from getCurrentLocationId cookie.
 */

import { eq } from "drizzle-orm";
import { getCurrentLocationId } from "@/app/actions/location";
import { db } from "@/db";
import { merchantLocations } from "@/lib/db/schema";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPosMerchantContext } from "@/lib/pos/posMerchantContext";
import { getPosUserId } from "@/lib/pos/posAuth";
import { buildKdsView } from "@/lib/kds/buildKdsView";
import type { KdsView } from "@/lib/kds/kdsView";
import { isMerchantKdsEnabled } from "@/lib/merchant-features";

export type GetKdsViewResult =
  | { data: KdsView }
  | { error: "UNAUTHORIZED" | "FORBIDDEN" | "NO_LOCATION" | "KDS_DISABLED" };

/**
 * Fetch KdsView for server-side render.
 * Uses locationId from cookie (getCurrentLocationId). If no location selected, returns NO_LOCATION.
 * Caller should render no-location state when error === "NO_LOCATION".
 */
export async function getKdsView(): Promise<GetKdsViewResult> {
  const locationId = await getCurrentLocationId();
  if (!locationId?.trim()) {
    return { error: "NO_LOCATION" };
  }

  const supabase = await supabaseServer();
  const authResult = await getPosUserId(supabase);
  if (!authResult.ok) {
    return { error: "UNAUTHORIZED" };
  }

  const ctx = await getPosMerchantContext(authResult.userId);
  if (ctx.locationIds.length === 0) {
    return { error: "FORBIDDEN" };
  }
  if (!ctx.locationIds.includes(locationId)) {
    return { error: "FORBIDDEN" };
  }

  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { merchantId: true },
  });
  if (!location) {
    return { error: "NO_LOCATION" };
  }
  if (!(await isMerchantKdsEnabled(location.merchantId))) {
    return { error: "KDS_DISABLED" };
  }

  const view = await buildKdsView(locationId);
  if (!view) {
    return { error: "NO_LOCATION" };
  }

  return { data: view };
}
