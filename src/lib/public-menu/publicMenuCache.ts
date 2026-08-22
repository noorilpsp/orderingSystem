import { revalidateTag } from "next/cache";
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
  sourceUpdatedAtMs: number;
  validUntilMs: number;
};

export function publicMenuCacheTag(storeSlug: string): string {
  return `public-menu:${storeSlug.trim().toLowerCase()}`;
}

export function normalizePublicMenuSlug(storeSlug: string | null | undefined): string {
  return storeSlug?.trim().toLowerCase() ?? "";
}

export async function getPublicMenuCatalogRevision(
  storeSlug: string | null | undefined,
): Promise<number | null> {
  const slug = normalizePublicMenuSlug(storeSlug);
  if (!slug) return null;
  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.storeSlug, slug),
    columns: { updatedAt: true },
  });
  return location?.updatedAt.getTime() ?? null;
}

async function loadPublicMenuCacheEntry(storeSlug: string): Promise<PublicMenuCacheEntry> {
  const view = await buildPublicMenuView(storeSlug);
  const next = view?.locationId
    ? await getNextPublicMenuTransitionAt(view.locationId)
    : null;
  const cap = Date.now() + MAX_CACHE_MS;
  const until = next ? Math.min(next.getTime(), cap) : cap;
  const sourceUpdatedAtMs = view?.catalogUpdatedAt
    ? Date.parse(view.catalogUpdatedAt)
    : 0;
  return {
    view,
    sourceUpdatedAtMs: Number.isFinite(sourceUpdatedAtMs) ? sourceUpdatedAtMs : 0,
    validUntilMs: Math.max(until, Date.now() + MIN_CACHE_MS),
  };
}

async function getCachedPublicMenuCatalogRevision(
  slug: string,
): Promise<number | null> {
  const readRevision = unstable_cache(
    () => getPublicMenuCatalogRevision(slug),
    ["public-menu-revision", slug],
    {
      revalidate: 30,
      tags: [publicMenuCacheTag(slug)],
    },
  );
  return readRevision();
}

export async function getCachedPublicMenuView(
  storeSlug: string,
): Promise<PublicMenuView | null> {
  const slug = normalizePublicMenuSlug(storeSlug);
  if (!slug) return null;

  const revisionMs = await getCachedPublicMenuCatalogRevision(slug);
  const readEntry = unstable_cache(
    () => loadPublicMenuCacheEntry(slug),
    ["public-menu-view", slug, String(revisionMs ?? 0)],
    {
      revalidate: 3600,
      tags: [publicMenuCacheTag(slug)],
    },
  );

  const entry = await readEntry();
  if (Date.now() < entry.validUntilMs) {
    return entry.view;
  }

  // Promo/menu hours expired. Do not revalidateTag during render (Next.js 16).
  return (await loadPublicMenuCacheEntry(slug)).view;
}

export async function revalidatePublicMenuForSlug(storeSlug: string | null | undefined) {
  const slug = normalizePublicMenuSlug(storeSlug);
  if (!slug) return;
  // Expire only the public-menu data cache. Do not call revalidatePath here:
  // Next.js would refresh the current dashboard route (the page that triggered
  // the mutation), which looks like a full reload of /dashboard/menu.
  revalidateTag(publicMenuCacheTag(slug), { expire: 0 });
}

export async function revalidatePublicMenuForLocation(
  locationId: string | null | undefined,
) {
  if (!locationId) return;
  try {
    // Stamp only so the next guest load/refresh sees a newer catalog.
    await db
      .update(merchantLocations)
      .set({ updatedAt: new Date() })
      .where(eq(merchantLocations.id, locationId));
  } catch (error) {
    console.error("[revalidatePublicMenuForLocation]", error);
  }
}

export async function revalidatePublicMenuForMerchant(
  merchantId: string | null | undefined,
) {
  if (!merchantId) return;
  try {
    await db
      .update(merchantLocations)
      .set({ updatedAt: new Date() })
      .where(eq(merchantLocations.merchantId, merchantId));
  } catch (error) {
    console.error("[revalidatePublicMenuForMerchant]", error);
  }
}
