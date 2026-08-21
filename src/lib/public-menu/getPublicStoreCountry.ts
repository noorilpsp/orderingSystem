import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";

export async function getPublicStoreCountry(
  storeSlug: string | null | undefined,
): Promise<string | null> {
  const slug = storeSlug?.trim().toLowerCase();
  if (!slug) return null;
  try {
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.storeSlug, slug),
      columns: { country: true },
    });
    return location?.country ?? null;
  } catch {
    return null;
  }
}
