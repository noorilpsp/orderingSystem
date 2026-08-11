import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locationStations } from "@/lib/db/schema/location-stations";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import { isMerchantKdsEnabled } from "@/lib/merchant-features";
import { posFailure } from "@/app/api/_lib/pos-envelope";

export function kdsDisabledResponse() {
  return posFailure("FORBIDDEN", "KDS is not enabled for this merchant", {
    status: 403,
  });
}

export async function assertMerchantKdsEnabled(merchantId: string) {
  if (!(await isMerchantKdsEnabled(merchantId))) {
    return kdsDisabledResponse();
  }
  return null;
}

export async function assertLocationKdsEnabled(locationId: string) {
  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { merchantId: true },
  });
  if (!location) {
    return posFailure("NOT_FOUND", "Location not found", { status: 404 });
  }
  return assertMerchantKdsEnabled(location.merchantId);
}

export async function assertStationKdsEnabled(stationId: string) {
  const station = await db.query.locationStations.findFirst({
    where: eq(locationStations.id, stationId),
    columns: { locationId: true },
  });
  if (!station) {
    return posFailure("NOT_FOUND", "Station not found", { status: 404 });
  }
  return assertLocationKdsEnabled(station.locationId);
}
