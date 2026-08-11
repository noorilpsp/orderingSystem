import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  merchantLocations,
  merchants,
  normalizeMerchantFeatures,
} from "@/lib/db/schema";

export { normalizeMerchantFeatures };

export async function isMerchantKdsEnabled(merchantId: string): Promise<boolean> {
  const row = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchantId),
    columns: { features: true },
  });
  return normalizeMerchantFeatures(row?.features).kds;
}

export async function isLocationKdsEnabled(locationId: string): Promise<boolean> {
  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { merchantId: true },
  });
  if (!location) return false;
  return isMerchantKdsEnabled(location.merchantId);
}
