/**
 * Floor Map view contract — shape returned by GET /api/floor-map/view.
 * Matches Floor Map Architecture spec §3.1.
 */

import type { PlacedElement } from "@/lib/floorplan-types";

export type FloorMapTableStatus =
  | "free"
  | "active"
  | "urgent"
  | "billing"
  | "closed";

export type FloorMapTableStage =
  | "drinks"
  | "food"
  | "dessert"
  | "bill"
  | null;

/** Reservation overlay when table is reserved (free but assigned to upcoming reservation). */
export interface FloorMapTableReservation {
  id: string;
  guestName: string;
  partySize: number;
  time: string;
}

export interface FloorMapTable {
  id: string;
  /** Builder placed-element id; links scene elements to `tables` when numbers differ across floor plans. */
  elementId?: string;
  number: number;
  section: string;
  status: FloorMapTableStatus;
  capacity: number;
  guests: number;
  stage: FloorMapTableStage;
  position: { x: number; y: number };
  shape: string;
  serverId: string | null;
  serverName: string | null;
  seatedAt: string | null;
  alerts: string[];
  width?: number;
  height?: number;
  rotation?: number;
  waves?: { type: string; status: string }[];
  billTotal?: number;
  /** True when table is free but assigned to an upcoming reservation within window. Visual overlay only; sessions remain source of truth for status. */
  reserved?: boolean;
  reservation?: FloorMapTableReservation;
}

export interface FloorMapView {
  tables: FloorMapTable[];
  sections: { id: string; name: string }[];
  /** All floor plans for the location (for selector). */
  allFloorplans: { id: string; name: string }[];
  floorplan: {
    id: string | null;
    elements: PlacedElement[];
    activeId: string | null;
  };
  statusCounts: {
    free: number;
    active: number;
    urgent: number;
    billing: number;
    closed: number;
  };
  currentServer: {
    id: string;
    name: string;
    section: string;
    assignedTableIds: string[];
  } | null;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

export function isFloorMapView(x: unknown): x is FloorMapView {
  if (!isRecord(x)) return false;
  if (!isArray(x.tables) || !isArray(x.sections) || !isArray(x.allFloorplans)) return false;
  const fp = x.floorplan;
  if (!isRecord(fp)) return false;
  if (fp.id !== null && !isString(fp.id)) return false;
  if (!isArray(fp.elements)) return false;
  if (fp.activeId !== null && !isString(fp.activeId)) return false;
  const sc = x.statusCounts;
  if (!isRecord(sc)) return false;
  const requiredCounts = ["free", "active", "urgent", "billing", "closed"];
  for (const k of requiredCounts) {
    if (typeof (sc as Record<string, unknown>)[k] !== "number") return false;
  }
  const cs = x.currentServer;
  if (cs !== null && !isRecord(cs)) return false;
  if (cs && (!isString(cs.id) || !isString(cs.name) || !isArray(cs.assignedTableIds)))
    return false;
  return true;
}

/** Map FloorMapTable[] to StoreTable format for store sync (live detail needs store tables). */
export function viewTablesToStoreTables(
  tables: FloorMapTable[]
): Array<{
  id: string;
  number: number;
  section: string;
  capacity: number;
  status: FloorMapTableStatus;
  shape: string;
  position: { x: number; y: number };
  guests?: number;
  serverId?: string | null;
  seatedAt?: string | null;
  stage?: FloorMapTableStage;
  alerts?: string[];
  width?: number;
  height?: number;
  rotation?: number;
}> {
  return tables.map((t) => ({
    id: t.id,
    number: t.number,
    section: t.section,
    capacity: t.capacity,
    status: t.status,
    shape: t.shape,
    position: t.position,
    guests: t.guests,
    serverId: t.serverId,
    seatedAt: t.seatedAt ?? undefined,
    stage: t.stage ?? undefined,
    alerts: t.alerts,
    width: t.width,
    height: t.height,
    rotation: t.rotation,
  }));
}

/** Map FloorMapTable[] to FloorTable format for MapCanvas/GridView. Includes optional waves/billTotal/serverId for live detail, reserved/reservation for overlay. */
export function viewTablesToFloorTables(
  tables: FloorMapTable[]
): Array<{
  id: string;
  number: number;
  section: string;
  status: FloorMapTableStatus;
  capacity: number;
  guests: number;
  stage: FloorMapTableStage;
  position: { x: number; y: number };
  shape: string;
  server: string | null;
  serverId?: string | null;
  seatedAt?: string;
  alerts?: string[];
  waves?: { type: string; status: string }[];
  billTotal?: number;
  width?: number;
  height?: number;
  rotation?: number;
  reserved?: boolean;
  reservation?: FloorMapTableReservation;
}> {
  return tables.map((t) => ({
    id: t.id,
    number: t.number,
    section: t.section,
    status: t.status,
    capacity: t.capacity,
    guests: t.guests,
    stage: t.stage,
    position: t.position,
    shape: t.shape,
    ...(t.elementId ? { elementId: t.elementId } : {}),
    server: t.serverName ?? t.serverId ?? null,
    serverId: t.serverId ?? null,
    seatedAt: t.seatedAt ?? undefined,
    alerts: t.alerts,
    waves: t.waves,
    billTotal: t.billTotal,
    width: t.width,
    height: t.height,
    rotation: t.rotation,
    reserved: t.reserved,
    reservation: t.reservation,
  }));
}

/** Optimistic floor map patch when staff handles a guest waiter request. */
export function patchFloorMapViewAcknowledgeService(
  prev: FloorMapView,
  tableId: string,
  requestType: "waiter" | "bill" = "waiter",
): FloorMapView {
  const tables = prev.tables.map((t) =>
    t.id.toLowerCase() === tableId.toLowerCase()
      ? requestType === "bill"
        ? { ...t, stage: null }
        : { ...t, alerts: t.alerts.filter((alert) => alert !== "waiting") }
      : t,
  );
  return {
    ...prev,
    tables,
    statusCounts: {
      ...prev.statusCounts,
      urgent: tables.filter((t) => t.status === "urgent").length,
    },
  };
}

/** Optimistic floor map patch when a table enters cleaning after close. */
export function patchFloorMapViewTableCleaning(
  prev: FloorMapView,
  tableId: string
): FloorMapView {
  const tables = prev.tables.map((t) =>
    t.id.toLowerCase() === tableId.toLowerCase()
      ? {
          ...t,
          status: "closed" as const,
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
  return {
    ...prev,
    tables,
    statusCounts: {
      ...prev.statusCounts,
      free: tables.filter((t) => t.status === "free").length,
      active: tables.filter((t) => t.status === "active").length,
      closed: tables.filter((t) => t.status === "closed").length,
    },
  };
}
