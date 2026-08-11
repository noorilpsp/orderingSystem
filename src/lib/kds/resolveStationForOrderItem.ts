import { getActiveStationKeysForRouting } from "@/lib/kds/getLocationStations";
import { isLocationKdsEnabled } from "@/lib/merchant-features";

export type StationRoutingContext = {
  kdsEnabled: boolean;
  validKeys: Set<string>;
  firstKey: string | null;
};

/**
 * Load station routing context for a location.
 * When KDS is disabled for the merchant, returns empty keys so items are not routed to KDS.
 */
export async function getStationRoutingContext(
  locationId: string,
): Promise<StationRoutingContext> {
  const kdsEnabled = await isLocationKdsEnabled(locationId);
  if (!kdsEnabled) {
    return { kdsEnabled: false, validKeys: new Set(), firstKey: null };
  }
  const { validKeys, firstKey } = await getActiveStationKeysForRouting(locationId);
  return { kdsEnabled: true, validKeys, firstKey };
}

/**
 * Resolve which station an order item should route to.
 * Returns null when KDS is off (orders still work; nothing is sent to KDS).
 */
export function resolveStationOverride(
  ctx: StationRoutingContext,
  menuDefault: string | null | undefined,
  inputOverride?: string | null,
): string | null {
  if (!ctx.kdsEnabled) return null;

  const override = inputOverride?.trim() || null;
  if (override && ctx.validKeys.has(override)) return override;

  const menu = menuDefault?.trim() || null;
  if (menu && ctx.validKeys.has(menu)) return menu;

  return ctx.firstKey ?? "kitchen";
}
