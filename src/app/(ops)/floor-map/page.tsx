import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentLocationId } from "@/app/actions/location";
import { getLastViewedFloorMapFloorplanId } from "@/app/actions/floor-map-preferences";
import { getFloorMapView } from "@/lib/floor-map/getFloorMapView";
import { FloorMapPageSkeleton } from "@/components/floor-map/FloorMapPageSkeleton";
import { FloorMapClient } from "./FloorMapClient";

export const dynamic = "force-dynamic";

export default async function FloorMapPage({
  searchParams,
}: {
  searchParams: Promise<{ floorplan?: string }>;
}) {
  const sp = await searchParams;
  const explicitFloorplanId = sp.floorplan?.trim() || null;
  const currentLocationId = await getCurrentLocationId();
  const rememberedFloorplanId = (
    explicitFloorplanId
    || (currentLocationId ? await getLastViewedFloorMapFloorplanId(currentLocationId) : null)
  );
  const result = await getFloorMapView(rememberedFloorplanId);

  if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
    redirect("/staff/login");
  }

  if (result.error === "DB_ERROR") {
    return (
      <Suspense fallback={<FloorMapPageSkeleton />}>
        <FloorMapClient
          initialFloorMapView={null}
          initialLoadError={result.message ?? "Failed to load floor map. Please try again."}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<FloorMapPageSkeleton />}>
      <FloorMapClient initialFloorMapView={result.error === "NO_LOCATION" ? null : result.data} />
    </Suspense>
  );
}
