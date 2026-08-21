"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { MerchantLocation } from "@/lib/db/schema/merchant-locations";
import { useLocations } from "@/lib/hooks/useLocations";
import { useTenant } from "@/lib/contexts/TenantContext";
import { getCurrentLocationId, setCurrentLocationId } from "@/app/actions/location";

type LocationContextType = {
  currentLocationId: string | null;
  setCurrentLocation: (locationId: string) => void;
  locations: MerchantLocation[];
  loading: boolean;
  getCurrentLocation: () => MerchantLocation | null;
};

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { currentMerchantId, loading: tenantLoading } = useTenant();
  const { locations, loading: locationsLoading } = useLocations();
  const [currentLocationId, setCurrentLocationIdState] = useState<
    string | null
  >(null);
  const [initialized, setInitialized] = useState(false);

  const loading = tenantLoading || locationsLoading || !initialized;

  // Initialize from server cookie and validate against loaded locations
  useEffect(() => {
    if (locationsLoading || !currentMerchantId) {
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const fromCookie = await getCurrentLocationId();

        const validIds = new Set(locations.map((l) => l.id));
        let locationIdToUse: string | null = null;

        if (
          fromCookie &&
          fromCookie.trim() !== "" &&
          validIds.has(fromCookie)
        ) {
          locationIdToUse = fromCookie;
        } else if (locations.length > 0) {
          locationIdToUse = locations[0].id;
          await setCurrentLocationId(locationIdToUse);
        }

        if (!cancelled) {
          setCurrentLocationIdState(locationIdToUse);
        }
      } catch {
        if (!cancelled && locations.length > 0) {
          setCurrentLocationIdState(locations[0].id);
        }
      } finally {
        if (!cancelled) {
          setInitialized(true);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [locations, locationsLoading, currentMerchantId]);

  // When merchant changes, locations change; reset if current location not in new list
  useEffect(() => {
    if (!initialized || locations.length === 0) return;

    const validIds = new Set(locations.map((l) => l.id));
    if (currentLocationId && !validIds.has(currentLocationId)) {
      const first = locations[0]?.id;
      if (first) {
        setCurrentLocationIdState(first);
        setCurrentLocationId(first);
      } else {
        setCurrentLocationIdState(null);
      }
    }
  }, [locations, currentLocationId, initialized]);

  const setCurrentLocation = useCallback(async (locationId: string) => {
    const validIds = new Set(locations.map((l) => l.id));
    if (!validIds.has(locationId)) return;

    setCurrentLocationIdState(locationId);
    await setCurrentLocationId(locationId);
  }, [locations]);

  const getCurrentLocation = useCallback((): MerchantLocation | null => {
    if (!currentLocationId) return null;
    return locations.find((l) => l.id === currentLocationId) ?? null;
  }, [currentLocationId, locations]);

  return (
    <LocationContext.Provider
      value={{
        currentLocationId,
        setCurrentLocation,
        locations,
        loading,
        getCurrentLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within LocationProvider");
  }
  return context;
}

export function useLocationOptional() {
  return useContext(LocationContext) ?? null;
}
