"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { FloorMapView } from "@/lib/floor-map/floorMapView";
import { isFloorMapView } from "@/lib/floor-map/floorMapView";
import { getFloorMapCache, setFloorMapCache } from "@/lib/view-cache";

const FLOOR_MAP_PATCH_COOLDOWN_MS = 3000;
const FLOOR_MAP_BACKGROUND_REFRESH_MS = 15_000;

function pickInitialFloorMapView(
  initialData: FloorMapView | null | undefined,
  locationId: string | null,
  floorplanId: string | null | undefined
): FloorMapView | null {
  if (!locationId) {
    return null;
  }
  const fid = floorplanId ?? null;
  if (initialData) {
    const matches = fid == null || fid === "" || initialData.floorplan.activeId === fid;
    if (matches) return initialData;
  }
  return getFloorMapCache(locationId, fid) ?? null;
}

export type UseFloorMapViewResult = {
  view: FloorMapView | null;
  loading: boolean;
  /** Initial load or non-silent refresh failure. Triggers full-page error when no view. */
  error: string | null;
  /** Silent refresh failure when view exists. Keep view, show stale banner. */
  staleError: string | null;
  refresh: (silent?: boolean) => Promise<boolean>;
  patch: (updater: (prev: FloorMapView) => FloorMapView) => void;
};

export type UseFloorMapViewOptions = {
  /** Server-fetched initial data. When provided and location matches, skip initial blocking fetch. */
  initialData?: FloorMapView | null;
  /** Server render failed to load floor map (e.g. DB timeout). */
  initialError?: string | null;
};

export function useFloorMapView(
  locationId: string | null,
  floorplanId?: string | null,
  options?: UseFloorMapViewOptions
): UseFloorMapViewResult {
  const initialData = options?.initialData;
  const initialError = options?.initialError ?? null;
  const [view, setView] = useState<FloorMapView | null>(() =>
    pickInitialFloorMapView(initialData, locationId, floorplanId)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [staleError, setStaleError] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);
  const viewRef = useRef<FloorMapView | null>(null);
  viewRef.current = view;
  const prevLocationIdRef = useRef<string | null>(null);
  const lastPatchAtRef = useRef(0);

  const refresh = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!locationId) {
        setView(null);
        setError(null);
        setStaleError(null);
        return false;
      }
      if (refreshInFlightRef.current) return false;
      if (silent && Date.now() - lastPatchAtRef.current < FLOOR_MAP_PATCH_COOLDOWN_MS) {
        return false;
      }
      refreshInFlightRef.current = true;
      const refreshStartedAt = Date.now();
      if (!silent) {
        setLoading(true);
        setError(null);
        setStaleError(null);
      }
      try {
        const params = new URLSearchParams({ locationId });
        if (floorplanId != null && floorplanId !== "") {
          params.set("floorplanId", floorplanId);
        }
        const res = await fetch(`/api/floor-map/view?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || payload?.ok === false || !isFloorMapView(payload?.data)) {
          const message =
            payload?.error?.message ??
            (typeof payload?.error === "string" ? payload.error : "Failed to load floor map view.");
          if (silent && viewRef.current) {
            setStaleError(message);
          } else {
            setError(message);
          }
          return false;
        }
        const data = payload.data;
        setView((current) => {
          if (current && lastPatchAtRef.current > refreshStartedAt) {
            return current;
          }
          return data;
        });
        setError(null);
        setStaleError(null);
        setFloorMapCache(locationId, floorplanId, data);
        return true;
      } catch {
        const message = "Network error. Failed to load floor map view.";
        if (silent && viewRef.current) {
          setStaleError(message);
        } else {
          setError(message);
        }
        return false;
      } finally {
        refreshInFlightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [locationId, floorplanId]
  );

  const patch = useCallback(
    (updater: (prev: FloorMapView) => FloorMapView) => {
      setView((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        if (locationId) {
          setFloorMapCache(locationId, floorplanId ?? null, next);
        }
        return next;
      });
      lastPatchAtRef.current = Date.now();
    },
    [locationId, floorplanId]
  );

  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;
  const initialErrorRef = useRef(initialError);
  initialErrorRef.current = initialError;
  const consumedInitialDataRef = useRef(false);
  const hasInitialFromServer =
    initialData != null &&
    locationId != null &&
    (floorplanId == null ||
      floorplanId === "" ||
      initialData.floorplan.activeId === floorplanId);

  useEffect(() => {
    if (!locationId) {
      prevLocationIdRef.current = null;
      setView(null);
      setError(null);
      setStaleError(null);
      return;
    }
    const switchedLocation =
      prevLocationIdRef.current != null && prevLocationIdRef.current !== locationId;
    prevLocationIdRef.current = locationId;

    if (!consumedInitialDataRef.current && initialErrorRef.current) {
      consumedInitialDataRef.current = true;
      setLoading(false);
      return;
    }

    const fromServer = initialDataRef.current;
    if (!consumedInitialDataRef.current && fromServer) {
      consumedInitialDataRef.current = true;
      const matchesPlan =
        floorplanId == null ||
        floorplanId === "" ||
        fromServer.floorplan.activeId === floorplanId;
      if (matchesPlan) {
        setFloorMapCache(locationId, floorplanId ?? null, fromServer);
        setLoading(false);
        setError(null);
        setStaleError(null);
        return;
      }
      const cachedMismatch = getFloorMapCache(locationId, floorplanId ?? null);
      if (cachedMismatch) {
        setView(cachedMismatch);
        setLoading(false);
        setError(null);
        setStaleError(null);
        void refresh(true);
        return;
      }
      const keepUiMismatch =
        viewRef.current != null && !switchedLocation;
      void refresh(keepUiMismatch);
      return;
    }
    const cached = getFloorMapCache(locationId, floorplanId ?? null);
    if (cached) {
      setView(cached);
      setLoading(false);
      setError(null);
      setStaleError(null);
      void refresh(true);
    } else {
      const keepUi =
        viewRef.current != null && !switchedLocation;
      void refresh(keepUi);
    }
  }, [refresh, locationId, floorplanId]);

  // Background sync after SSR - avoids duplicating heavy DB work on immediate mount.
  useEffect(() => {
    if (!locationId || !hasInitialFromServer) return;
    const timer = window.setTimeout(() => {
      void refresh(true);
    }, FLOOR_MAP_BACKGROUND_REFRESH_MS);
    return () => window.clearTimeout(timer);
  }, [locationId, hasInitialFromServer, refresh]);

  // Refresh when page becomes visible (e.g. returning from another tab)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible" || !locationId) return;
      if (Date.now() - lastPatchAtRef.current < FLOOR_MAP_PATCH_COOLDOWN_MS) return;
      void refresh(true);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [locationId, refresh]);

  // Auto-refresh while tables are in cleaning so they return to available after the window expires.
  useEffect(() => {
    const cleaningCount = view?.statusCounts?.closed ?? 0;
    if (!locationId || cleaningCount === 0) return;
    const intervalId = window.setInterval(() => {
      void refresh(true);
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [locationId, view?.statusCounts?.closed, refresh]);

  return {
    view,
    loading,
    error,
    staleError,
    refresh,
    patch,
  };
}
