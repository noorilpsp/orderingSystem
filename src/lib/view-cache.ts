/**
 * Module-level cache for last-known FloorMapView and TableView.
 * Used to show cached content immediately on remount, then refresh silently.
 * Server remains source of truth; cache is for perceived speed only.
 */

import type { FloorMapView } from "@/lib/floor-map/floorMapView";
import type { TableView } from "@/lib/pos/tableView";

const FLOOR_MAP_CACHE_MAX_ENTRIES = 12;

type FloorMapCacheEntry = {
  locationId: string;
  floorplanId: string;
  view: FloorMapView;
};

/** LRU-ish: Map insertion order; get/set "touch" moves key to the end. */
const floorMapCacheMap = new Map<string, FloorMapCacheEntry>();

// Table: key = tableId
let tableCache: { tableId: string; view: TableView } | null = null;

function floorMapCacheKey(locationId: string, floorplanId: string | null): string {
  return `${locationId}|${floorplanId ?? "active"}`;
}

function touchFloorMapCache(key: string, entry: FloorMapCacheEntry): void {
  floorMapCacheMap.delete(key);
  floorMapCacheMap.set(key, entry);
}

function trimFloorMapCache(): void {
  while (floorMapCacheMap.size > FLOOR_MAP_CACHE_MAX_ENTRIES) {
    const oldest = floorMapCacheMap.keys().next().value;
    if (oldest === undefined) break;
    floorMapCacheMap.delete(oldest);
  }
}

export function getFloorMapCache(
  locationId: string,
  floorplanId: string | null
): FloorMapView | null {
  const key = floorMapCacheKey(locationId, floorplanId);
  const direct = floorMapCacheMap.get(key);
  if (direct) {
    touchFloorMapCache(key, direct);
    return direct.view;
  }
  if (floorplanId == null) {
    for (const [k, entry] of [...floorMapCacheMap.entries()].reverse()) {
      if (entry.locationId === locationId) {
        touchFloorMapCache(k, entry);
        return entry.view;
      }
    }
  }
  return null;
}

export function setFloorMapCache(
  locationId: string,
  floorplanId: string | null,
  view: FloorMapView
): void {
  const fpId = view.floorplan?.activeId ?? floorplanId ?? "active";
  const key = floorMapCacheKey(locationId, fpId);
  const entry: FloorMapCacheEntry = { locationId, floorplanId: fpId, view };
  touchFloorMapCache(key, entry);
  trimFloorMapCache();
}

export function getTableCache(tableId: string): TableView | null {
  if (!tableCache) return null;
  if (tableCache.tableId !== tableId) return null;
  return tableCache.view;
}

function tableMatchesRequestId(view: TableView, tableId: string): boolean {
  if (!view.table) return false;
  return (
    view.table.id === tableId ||
    (view.table.displayId != null &&
      view.table.displayId.toLowerCase() === tableId.toLowerCase())
  );
}

export function setTableCache(tableId: string, view: TableView): void {
  if (!tableMatchesRequestId(view, tableId)) return;
  tableCache = { tableId, view };
}

/** Clear all floor map entries for a location. Call after seating so next refresh is fresh. */
export function invalidateFloorMapCache(locationId: string): void {
  for (const k of [...floorMapCacheMap.keys()]) {
    const e = floorMapCacheMap.get(k);
    if (e?.locationId === locationId) {
      floorMapCacheMap.delete(k);
    }
  }
}

/** Clear table cache when table matches (id or displayId). Call after seating at that table. */
export function invalidateTableCache(tableId: string): void {
  if (!tableCache || !tableCache.view.table) return;
  const t = tableCache.view.table;
  const matches =
    t.id === tableId ||
    (t.displayId != null && t.displayId.toLowerCase() === tableId.toLowerCase());
  if (matches) {
    tableCache = null;
  }
}

export const OPS_POST_SEATING_EVENT = "ops:post-seating";

export type PostSeatingDetail = { locationId: string; tableId?: string };

/** Clear caches only - no refresh event. Use when optimistic UI already shows the seated state. */
export function invalidatePostSeatingCaches(locationId: string, tableId?: string): void {
  invalidateFloorMapCache(locationId);
  if (tableId) invalidateTableCache(tableId);
}

/** Invalidate caches and notify mounted views to refresh. Call after Seat Now or Seat from Waitlist. */
export function postSeatingInvalidate(locationId: string, tableId?: string): void {
  invalidatePostSeatingCaches(locationId, tableId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<PostSeatingDetail>(OPS_POST_SEATING_EVENT, {
        detail: { locationId, tableId },
      })
    );
  }
}
