"use client";

import { useCallback } from "react";
import { fetchPos } from "@/lib/pos/fetchPos";
import { toast } from "sonner";
import { fireAndForget } from "@/lib/pos/fireAndForget";
import { invalidatePostSeatingCaches } from "@/lib/view-cache";
import type { FloorMapView } from "@/lib/floor-map/floorMapView";
import { patchFloorMapViewAcknowledgeService } from "@/lib/floor-map/floorMapView";
import type { AcknowledgeServiceType } from "@/lib/floor-map/acknowledgeTableService";

export type UseFloorMapMutationsOptions = {
  patch: (updater: (prev: FloorMapView) => FloorMapView) => void;
  refresh: (silent?: boolean) => Promise<boolean>;
  view: FloorMapView | null;
};

/**
 * Floor Map mutation helper: optimistic patch → API → refresh on success, rollback on failure.
 * Same spirit as table page fireAndReconcile and KDS kdsFireAndReconcile.
 */
export async function mutateThenRefresh<T>(opts: {
  label: string;
  patch: (updater: (prev: FloorMapView) => FloorMapView) => void;
  refresh: (silent?: boolean) => Promise<boolean>;
  view: FloorMapView | null;
  optimisticPatch?: (prev: FloorMapView) => FloorMapView;
  requestFn: () => Promise<T>;
  onSuccess?: (result: T) => void;
  skipRefreshOnSuccess?: boolean;
  /** Apply optimistic patch, then run request + refresh without blocking the caller. */
  background?: boolean;
}): Promise<T | null> {
  let snapshot: FloorMapView | null = null;

  if (opts.optimisticPatch) {
    opts.patch((prev) => {
      if (!prev) return prev;
      if (!snapshot) snapshot = structuredClone(prev);
      return opts.optimisticPatch!(prev);
    });
  }

  const run = async (): Promise<T | null> => {
    try {
      const result = await opts.requestFn();
      if (!opts.skipRefreshOnSuccess) {
        await opts.refresh(true);
      }
      opts.onSuccess?.(result);
      return result;
    } catch (error) {
      if (snapshot && opts.optimisticPatch) {
        opts.patch(() => snapshot as FloorMapView);
      }
      const message =
        error instanceof Error ? error.message : "Request failed. Please try again.";
      toast.error(message);
      return null;
    }
  };

  if (opts.background) {
    void run();
    return null;
  }

  return run();
}

/**
 * Hook that returns seat party mutation using mutateThenRefresh.
 */
export function useFloorMapMutations({
  patch,
  refresh,
  view,
}: UseFloorMapMutationsOptions) {
  const seatParty = useCallback(
    async (params: {
      tableId: string;
      partySize: number;
      locationId: string;
      serverId: string;
      skipRefreshOnSuccess?: boolean;
      /** Close UI immediately; API + refresh continue in the background. */
      background?: boolean;
    }): Promise<boolean> => {
      const {
        tableId,
        partySize,
        locationId,
        serverId,
        skipRefreshOnSuccess = false,
        background = false,
      } = params;
      if (!locationId?.trim() || !tableId?.trim()) return false;

      const tableNumber = view?.tables.find(
        (t) => t.id.toLowerCase() === tableId.toLowerCase()
      )?.number;

      const optimisticPatch = (prev: FloorMapView): FloorMapView => {
        const tables = prev.tables.map((t) =>
          t.id.toLowerCase() === tableId.toLowerCase()
            ? {
                ...t,
                status: "active" as const,
                guests: partySize,
                stage: "drinks" as const,
                serverId,
                serverName: prev.currentServer?.name ?? null,
                seatedAt: new Date().toISOString(),
              }
            : t
        );
        const freeCount = tables.filter((t) => t.status === "free").length;
        const activeCount = tables.filter((t) => t.status === "active").length;
        return {
          ...prev,
          tables,
          statusCounts: {
            ...prev.statusCounts,
            free: freeCount,
            active: activeCount,
          },
        };
      };

      const result = await mutateThenRefresh({
        label: "Seat party",
        patch,
        refresh,
        view,
        optimisticPatch,
        skipRefreshOnSuccess: background ? true : skipRefreshOnSuccess,
        background,
        onSuccess: background
          ? () => {
              if (tableNumber != null) {
                toast.success(`Party seated at T${tableNumber}`);
              }
              invalidatePostSeatingCaches(locationId, tableId);
            }
          : undefined,
        requestFn: async () => {
          const res = await fetchPos("/api/sessions/ensure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tableUuid: tableId,
              locationId,
              guestCount: partySize,
              eventSource: "floor_map",
            }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok || payload?.ok !== true) {
            const msg =
              (payload?.error && typeof payload.error === "object" && payload.error.message) ||
              (typeof payload?.error === "string" ? payload.error : null);
            throw new Error(msg ?? "Failed to create session");
          }
          const data = payload.data as { sessionId?: string };
          if (data?.sessionId) {
            fireAndForget(
              fetchPos(`/api/sessions/${encodeURIComponent(data.sessionId)}/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "guest_seated",
                  payload: { guestCount: partySize },
                  eventSource: "floor_map",
                }),
              }),
              "record guest_seated event"
            );
          }
          return data;
        },
      });

      if (background) return true;
      return result != null;
    },
    [view, patch, refresh]
  );

  const markTableAvailable = useCallback(
    async (tableId: string): Promise<boolean> => {
      if (!view) return false;

      const optimisticPatch = (prev: FloorMapView): FloorMapView => {
        const tables = prev.tables.map((t) =>
          t.id.toLowerCase() === tableId.toLowerCase()
            ? {
                ...t,
                status: "free" as const,
                guests: 0,
                stage: null,
                serverId: null,
                serverName: null,
                seatedAt: null,
                billTotal: undefined,
                waves: undefined,
              }
            : t
        );
        const freeCount = tables.filter((t) => t.status === "free").length;
        const closedCount = tables.filter((t) => t.status === "closed").length;
        return {
          ...prev,
          tables,
          statusCounts: {
            ...prev.statusCounts,
            free: freeCount,
            closed: closedCount,
          },
        };
      };

      const result = await mutateThenRefresh({
        label: "Mark table available",
        patch,
        refresh,
        view,
        optimisticPatch,
        requestFn: async () => {
          const res = await fetchPos(
            `/api/tables/${encodeURIComponent(tableId)}/mark-available`,
            { method: "POST" }
          );
          const payload = await res.json().catch(() => ({}));
          if (!res.ok || payload?.ok !== true) {
            const msg =
              (payload?.error && typeof payload.error === "object" && payload.error.message) ||
              (typeof payload?.error === "string" ? payload.error : null);
            throw new Error(msg ?? "Failed to mark table available");
          }
          return payload.data;
        },
        onSuccess: () => {
          toast.success("Table marked available");
        },
      });

      return result != null;
    },
    [view, patch, refresh]
  );

  const acknowledgeService = useCallback(
    async (
      tableId: string,
      requestType: AcknowledgeServiceType = "waiter",
    ): Promise<boolean> => {
      if (!view) return false;

      const optimisticPatch = (prev: FloorMapView): FloorMapView =>
        patchFloorMapViewAcknowledgeService(prev, tableId, requestType);

      const result = await mutateThenRefresh({
        label: requestType === "bill" ? "Acknowledge bill request" : "Acknowledge service",
        patch,
        refresh,
        view,
        optimisticPatch,
        requestFn: async () => {
          const res = await fetchPos(
            `/api/tables/${encodeURIComponent(tableId)}/acknowledge-service`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requestType }),
            },
          );
          const payload = await res.json().catch(() => ({}));
          if (!res.ok || payload?.ok !== true) {
            const msg =
              (payload?.error && typeof payload.error === "object" && payload.error.message) ||
              (typeof payload?.error === "string" ? payload.error : null);
            throw new Error(
              msg ??
                (requestType === "bill"
                  ? "Failed to mark bill request handled"
                  : "Failed to mark waiter request handled"),
            );
          }
          return payload.data as { alreadyHandled?: boolean };
        },
        onSuccess: (data) => {
          if (requestType === "bill") {
            toast.success(
              data?.alreadyHandled ? "Bill request already handled" : "Bill request handled",
            );
            return;
          }
          toast.success(
            data?.alreadyHandled ? "Waiter request already handled" : "Waiter request handled",
          );
        },
      });

      return result != null;
    },
    [view, patch, refresh],
  );

  return { seatParty, markTableAvailable, acknowledgeService };
}
