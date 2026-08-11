/**
 * Server helper for fetching OrdersView. Used by the Orders page for initial server render.
 * Auth via supabaseServer + getPosUserId; location from getCurrentLocationId cookie.
 */

import { getCurrentLocationId } from "@/app/actions/location";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPosMerchantContext } from "@/lib/pos/posMerchantContext";
import { getPosUserId } from "@/lib/pos/posAuth";
import { buildOrdersView } from "./buildOrdersView";
import type { OrdersView } from "./ordersView";

export type GetOrdersViewResult =
  | { data: OrdersView }
  | { error: "UNAUTHORIZED" | "FORBIDDEN" | "NO_LOCATION" }
  | { error: "LOAD_ERROR"; message?: string };

/**
 * Fetch OrdersView for server-side render.
 * Uses locationId from cookie (getCurrentLocationId). If no location selected, returns NO_LOCATION.
 * Caller should render no-location state when error === "NO_LOCATION".
 */
export async function getOrdersView(): Promise<GetOrdersViewResult> {
  const supabase = await supabaseServer();
  const authResult = await getPosUserId(supabase);
  if (!authResult.ok) {
    return { error: "UNAUTHORIZED" };
  }

  const locationId = await getCurrentLocationId();
  if (!locationId?.trim()) {
    return { error: "NO_LOCATION" };
  }

  const ctx = await getPosMerchantContext(authResult.userId);
  if (ctx.locationIds.length === 0) {
    return { error: "FORBIDDEN" };
  }
  if (!ctx.locationIds.includes(locationId)) {
    return { error: "FORBIDDEN" };
  }

  try {
    const view = await buildOrdersView(locationId);
    if (!view) {
      return { error: "NO_LOCATION" };
    }
    return { data: view };
  } catch (e) {
    const message = e instanceof Error ? e.message : undefined;
    return { error: "LOAD_ERROR", message };
  }
}
