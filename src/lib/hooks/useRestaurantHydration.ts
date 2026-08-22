"use client";

import { useEffect, useRef } from "react";
import { useLocation } from "@/lib/contexts/LocationContext";
import { useRestaurantStore } from "@/store/restaurantStore";
import { getTablesForLocation, getTablesForFloorPlan } from "@/app/actions/tables";
import { getActiveFloorPlan, getConvertedTablesForFloorPlan } from "@/app/actions/floor-plans";

/**
 * Hydrates the restaurant Zustand store from Neon when currentLocationId is set.
 * Reservations and waitlist are NOT hydrated here - they use the server-read path
 * (layout + GET /api/reservations/view) to avoid duplicate fetches.
 */
export function useRestaurantHydration() {
  const { currentLocationId, loading: locationLoading } = useLocation();
  const setTables = useRestaurantStore((s) => s.setTables);
  const lastLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (locationLoading || !currentLocationId || currentLocationId.trim() === "") {
      if (!currentLocationId && lastLocationRef.current) {
        lastLocationRef.current = null;
      }
      return;
    }

    if (lastLocationRef.current === currentLocationId) {
      return;
    }
    lastLocationRef.current = currentLocationId;

    let cancelled = false;

    async function hydrate() {
      try {
        const [allTables, activeFloorPlan] = await Promise.all([
          getTablesForLocation(currentLocationId!),
          getActiveFloorPlan(currentLocationId!),
        ]);

        if (cancelled) return;

        if (activeFloorPlan && activeFloorPlan.elements.length > 0) {
          const planTables = await getTablesForFloorPlan(currentLocationId!, activeFloorPlan.id);
          const toSet = planTables.length > 0
            ? planTables
            : await getConvertedTablesForFloorPlan(currentLocationId!, activeFloorPlan.id);
          setTables(toSet.length > 0 ? toSet : allTables);
        } else {
          setTables(allTables);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useRestaurantHydration] Error:", err);
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [currentLocationId, locationLoading, setTables]);
}
