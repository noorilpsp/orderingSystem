import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import { unstable_cache } from "@/lib/unstable-cache";
import { buildPublicMenuView } from "@/lib/public-menu/buildPublicMenuView";
import { getNextPublicMenuTransitionAt } from "@/lib/public-menu/nextCatalogTransition";
import type { PublicMenuView } from "@/lib/public-menu/types";

const MAX_CACHE_MS = 60 * 60 * 1000;
const MIN_CACHE_MS = 15 * 1000;

type PublicMenuCacheEntry = {
  view: PublicMenuView | null;
  validUntilMs: number;
};

export function publicMenuCacheTag(storeSlug: string): string {
  return `public-menu:${storeSlug.trim().toLowerCase()}`;
}

async function loadPublicMenuCacheEntry(storeSlug: string): Promise<PublicMenuCacheEntry> {
  const view = await buildPublicMenuView(storeSlug);
  const next = view?.locationId
    ? await getNextPublicMenuTransitionAt(view.locationId)
    : null;
  const cap = Date.now() + MAX_CACHE_MS;
  const until = next ? Math.min(next.getTime(), cap) : cap;
  return {
    view,
    validUntilMs: Math.max(until, Date.now() + MIN_CACHE_MS),
  };
}

export async function getCachedPublicMenuView(
  storeSlug: string,
): Promise<PublicMenuView | null> {
  const slug = storeSlug.trim().toLowerCase();
  if (!slug) return null;

  const readEntry = unstable_cache(
    () => loadPublicMenuCacheEntry(slug),
    ["public-menu-view", slug],
    {
      revalidate: 3600,
      tags: [publicMenuCacheTag(slug)],
    },
  );

  const entry = await readEntry();
  if (Date.now() < entry.validUntilMs) {
    return entry.view;
  }

  revalidateTag(publicMenuCacheTag(slug), { expire: 0 });
  const fresh = await loadPublicMenuCacheEntry(slug);
  return fresh.view;
}

export async function revalidatePublicMenuForSlug(storeSlug: string | null | undefined) {
  const slug = storeSlug?.trim().toLowerCase();
  if (!slug) return;
  // Immediate expire so store-settings changes are not served stale.
  revalidateTag(publicMenuCacheTag(slug), { expire: 0 });
  revalidatePath(`/menu/${slug}`, "layout");
  revalidatePath(`/api/public/menu/${slug}`);
}

export async function revalidatePublicMenuForLocation(
  locationId: string | null | undefined,
) {
  if (!locationId) return;
  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.id, locationId),
    columns: { storeSlug: true },
  });
  await revalidatePublicMenuForSlug(location?.storeSlug);
}

export async function revalidatePublicMenuForMerchant(
  merchantId: string | null | undefined,
) {
  if (!merchantId) return;
  const rows = await db.query.merchantLocations.findMany({
    where: eq(merchantLocations.merchantId, merchantId),
    columns: { storeSlug: true },
  });
  await Promise.all(rows.map((row) => revalidatePublicMenuForSlug(row.storeSlug)));
}
