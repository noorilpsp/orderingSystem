// ── Timeline View ("The River") Data ─────────────────────────────────────────

import type { StoreTable } from "@/store/types"
import { type CapacitySlot, restaurantConfig } from "./reservations-data"

export type TimelineStatus =
  | "confirmed"
  | "seated"
  | "partially-seated"
  | "completed"
  | "no-show"
  | "late"
  | "arriving"
  | "unconfirmed"

export type CourseProgress =
  | "ordering"
  | "apps"
  | "mains-fired"
  | "mains-served"
  | "dessert"
  | "check"
  | "paying"

export interface TimelineTag {
  type: "vip" | "allergy" | "birthday" | "anniversary" | "first-timer" | "note"
  label: string
  icon: string
  detail?: string
}

export interface TimelineBlock {
  id: string
  guestName: string
  partySize: number
  table: string
  mergedWith?: string          // e.g. "T9" if this block also uses T9
  startTime: string            // "HH:MM"
  endTime: string              // "HH:MM"
  date?: string                // ISO date "YYYY-MM-DD" - which service day this block belongs to
  status: TimelineStatus
  risk: "low" | "medium" | "high"
  riskScore?: number
  arrivedPartySize?: number
  lateMinutes?: number
  courseProgress?: CourseProgress
  tags: TimelineTag[]
  notes?: string
}

export interface GhostBlock {
  id: string
  table: string
  predictedTime: string        // "HH:MM" - when it becomes available
  endTime: string
  label: string
  conditional?: string         // e.g. "IF Morrison shows"
}

export interface MergedBlock {
  table: string
  mergedWith: string           // the primary table
  startTime: string
  endTime: string
}

export interface TableLane {
  id: string
  label: string                // e.g. "T1"
  seats: number
  /** Canonical section id from StoreTable.section (real floorplan sections). */
  zone: string
}

interface GhostQueryOptions {
  serviceStart?: string
  serviceEnd?: string
  nowTime?: string | null
  blocks?: TimelineBlock[]
}

// ── Table Definitions ────────────────────────────────────────────────────────

/** Build table lanes from store tables so the timeline only shows tables from the floor plan. */
export function getTableLanesFromStore(tables: StoreTable[]): TableLane[] {
  return tables
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((t) => ({
      id: `T${t.number}`,
      label: `T${t.number}`,
      seats: t.capacity,
      zone: t.section,
    }))
}

// ── Time Axis Config ─────────────────────────────────────────────────────────

export const DINNER_START = "17:00"
export const DINNER_END   = "23:00"
export const NOW_TIME     = "19:23"
export const NOW_LABEL    = NOW_TIME

export type ZoomLevel = "1hr" | "30min" | "15min"

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function getRangeBounds(startTime: string, endTime: string): { startMin: number; endMin: number; totalMin: number } {
  const startMin = parseTimeToMinutes(startTime)
  let endMin = parseTimeToMinutes(endTime)
  if (endMin <= startMin) endMin += 24 * 60
  return { startMin, endMin, totalMin: endMin - startMin }
}

export function getCurrentLocalTime24(now = new Date()): string {
  const h = now.getHours().toString().padStart(2, "0")
  const m = now.getMinutes().toString().padStart(2, "0")
  return `${h}:${m}`
}

/** Returns the number of total columns for the dinner range at a given zoom */
export function getColumnCount(zoom: ZoomLevel, startTime: string = DINNER_START, endTime: string = DINNER_END): number {
  const { totalMin: totalMinutes } = getRangeBounds(startTime, endTime)
  const slotMinutes = zoom === "1hr" ? 60 : zoom === "30min" ? 30 : 15
  return totalMinutes / slotMinutes
}

/** Returns the width in pixels for a single column slot at a given zoom */
export function getSlotWidth(zoom: ZoomLevel): number {
  return zoom === "1hr" ? 120 : zoom === "30min" ? 100 : 80
}

/** Converts "HH:MM" to minutes from DINNER_START (17:00) */
export function timeToOffset(time: string, startTime: string = DINNER_START): number {
  const startMin = parseTimeToMinutes(startTime)
  let timeMin = parseTimeToMinutes(time)
  if (timeMin < startMin) timeMin += 24 * 60
  return timeMin - startMin
}

/** Converts offset minutes from DINNER_START to pixel position */
export function offsetToPixel(offset: number, zoom: ZoomLevel): number {
  const slotMinutes = zoom === "1hr" ? 60 : zoom === "30min" ? 30 : 15
  const slotWidth = getSlotWidth(zoom)
  return (offset / slotMinutes) * slotWidth
}

/** Returns time label strings for the axis */
export function getTimeLabels(zoom: ZoomLevel, startTime: string = DINNER_START, endTime: string = DINNER_END): string[] {
  const labels: string[] = []
  const { startMin, totalMin } = getRangeBounds(startTime, endTime)
  const slotMinutes = zoom === "1hr" ? 60 : zoom === "30min" ? 30 : 15
  for (let minutes = 0; minutes < totalMin; minutes += slotMinutes) {
    const absoluteMin = startMin + minutes
    const h = Math.floor(absoluteMin / 60) % 24
    const m = absoluteMin % 60
    labels.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`)
  }
  return labels
}

/** Returns the NOW position in pixels */
export function getNowPixel(
  zoom: ZoomLevel,
  nowTime: string | null = NOW_TIME,
  startTime: string = DINNER_START,
  endTime: string = DINNER_END
): number | null {
  if (!nowTime) return null
  const { startMin, endMin } = getRangeBounds(startTime, endTime)
  let nowMin = parseTimeToMinutes(nowTime)
  if (nowMin < startMin) nowMin += 24 * 60
  if (nowMin < startMin || nowMin > endMin) return null
  return offsetToPixel(nowMin - startMin, zoom)
}

/** Returns capacity data aligned to timeline slots. Prefer passing capacitySlots from useReservationsData(). */
export function getTimelineCapacity(capacitySlots?: CapacitySlot[]): CapacitySlot[] {
  return capacitySlots ?? []
}

// ── Build timeline blocks from reservations (store / reservations-data) ───────

/** Minimal reservation shape for building timeline blocks (avoids circular deps). */
export interface ReservationLikeForTimeline {
  id: string
  guestName: string
  partySize: number
  time: string
  table?: string | null
  tableId?: string | null
  endTime?: string | null
  duration?: number | null
  status: string
  risk?: string
  tags?: { type: string; label: string }[]
  date?: string | null
}

const DEFAULT_BLOCK_DURATION_MIN = 90

function parseTimeToMinutesPublic(time: string): number {
  const parts = time.split(":")
  const h = Number(parts[0])
  const m = parts[1] != null ? Number(parts[1]) : 0
  return h * 60 + m
}

function timeFromMinutes(totalMin: number): string {
  const n = ((totalMin % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(n / 60).toString().padStart(2, "0")
  const m = (n % 60).toString().padStart(2, "0")
  return `${h}:${m}`
}

function mapReservationStatusToTimeline(status: string): TimelineStatus {
  switch (status) {
    case "seated": return "seated"
    case "completed": return "completed"
    case "no-show": return "no-show"
    case "late": return "late"
    case "arriving": return "arriving"
    case "confirmed": return "confirmed"
    case "unconfirmed": return "unconfirmed"
    case "cancelled": return "no-show"
    default: return "confirmed"
  }
}

/** Normalize table id to match tableLanes (e.g. "12" or "t12" -> "T12"). */
function normalizeTableIdForBlock(raw: string): string {
  const s = raw.trim()
  if (!s) return s
  const lower = s.toLowerCase()
  if (lower.charAt(0) === "t") return "T" + s.slice(1)
  if (/^\d+$/.test(s)) return "T" + s
  return s
}

/** Convert a single reservation to a timeline block (only if it has a table). Returns null if no table. */
export function reservationToTimelineBlock(r: ReservationLikeForTimeline, todayIso: string): TimelineBlock | null {
  const table = (r.table ?? r.tableId ?? "").trim()
  if (!table) return null
  const tableId = normalizeTableIdForBlock(table)
  const startMin = parseTimeToMinutesPublic(r.time)
  let endMin: number
  if (r.endTime) {
    endMin = parseTimeToMinutesPublic(r.endTime)
    if (endMin <= startMin) endMin += 24 * 60
  } else {
    const durationMin = typeof r.duration === "number" && r.duration > 0 ? r.duration : DEFAULT_BLOCK_DURATION_MIN
    endMin = startMin + durationMin
  }
  const endTime = timeFromMinutes(endMin)
  const tags: TimelineTag[] = (r.tags ?? []).map((t) => ({
    type: (t.type as TimelineTag["type"]) || "note",
    label: t.label,
    icon: "tag",
  }))
  return {
    id: r.id,
    guestName: r.guestName,
    partySize: r.partySize,
    table: tableId,
    startTime: r.time,
    endTime,
    date: r.date ?? todayIso,
    status: mapReservationStatusToTimeline(r.status),
    risk: (r.risk as "low" | "medium" | "high") ?? "low",
    tags,
  }
}

/** Build non-overlapping timeline blocks from an array of blocks (e.g. from reservations). */
export function buildTimelineBlocksNoOverlapFromBlocks(inputBlocks: TimelineBlock[]): TimelineBlock[] {
  const tableIds = Array.from(new Set(inputBlocks.map((block) => block.table)))
  const result: TimelineBlock[] = []
  const todayIso = getTodayIsoInternal()

  for (const tableId of tableIds) {
    const tableBlocks = inputBlocks.filter((block) => block.table === tableId)
    const rawStarts = tableBlocks.map((block) => parseTimeToMinutes(block.startTime))
    const anchorStart = rawStarts.length > 0 ? Math.min(...rawStarts) : 0

    const normalized = tableBlocks
      .map((block) => {
        const start = parseTimeToMinutes(block.startTime)
        const end = parseTimeToMinutes(block.endTime)
        const window = normalizeWindow(start, end, anchorStart)
        if (!window) return null
        return { block, start: window.start, end: window.end }
      })
      .filter((item): item is { block: TimelineBlock; start: number; end: number } => item !== null)
      .sort((a, b) => a.start - b.start || a.end - b.end || a.block.id.localeCompare(b.block.id))

    let lastEnd = Number.NEGATIVE_INFINITY
    for (const { block, start, end } of normalized) {
      const adjustedStart = Math.max(start, lastEnd)
      const adjustedEnd = Math.max(end, adjustedStart + 15)
      lastEnd = adjustedEnd
      result.push({
        ...block,
        startTime: toTime24(adjustedStart),
        endTime: toTime24(adjustedEnd),
        date: block.date ?? todayIso,
      })
    }
  }

  return result
}

/** Build timeline blocks from reservations (store); only reservations with a table in tableLanes are included. */
export function getTimelineBlocksFromReservations(
  reservations: ReservationLikeForTimeline[],
  validTableIds?: Set<string>
): TimelineBlock[] {
  const todayIso = getTodayIsoInternal()
  const tableSet = validTableIds ?? new Set(tableLanes.map((l) => l.id))
  const withTable = reservations.filter((r) => {
    const raw = (r.table ?? r.tableId ?? "").trim()
    if (!raw) return false
    const normalized = normalizeTableIdForBlock(raw)
    return tableSet.has(normalized)
  })
  const raw = withTable
    .map((r) => reservationToTimelineBlock(r, todayIso))
    .filter((b): b is TimelineBlock => b !== null)
  return buildTimelineBlocksNoOverlapFromBlocks(raw)
}

// ── Mock Timeline Blocks ─────────────────────────────────────────────────────

/** ISO date for the current service day - used to stamp demo blocks so that
 *  availability calculations can correctly scope reservations to today. */
function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const getTodayIsoInternal = getTodayIso
const TODAY = getTodayIso()

export const timelineBlocks: TimelineBlock[] = [
  // Completed
  {
    id: "tb1",
    guestName: "Thompson",
    partySize: 2,
    table: "T4",
    startTime: "17:30",
    endTime: "19:15",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb2",
    guestName: "Anderson Party",
    partySize: 6,
    table: "T22",
    startTime: "17:30",
    endTime: "19:30",
    status: "completed",
    risk: "low",
    tags: [],
  },

  // Seated
  {
    id: "tb3",
    guestName: "Williams",
    partySize: 2,
    table: "T1",
    startTime: "18:00",
    endTime: "20:00",
    status: "seated",
    risk: "low",
    courseProgress: "mains-served",
    tags: [],
  },
  {
    id: "tb4",
    guestName: "Patel",
    partySize: 4,
    table: "T12",
    startTime: "18:00",
    endTime: "19:45",
    status: "seated",
    risk: "low",
    courseProgress: "check",
    tags: [],
  },
  {
    id: "tb5",
    guestName: "Jensen",
    partySize: 2,
    table: "T3",
    startTime: "18:30",
    endTime: "20:15",
    status: "seated",
    risk: "low",
    courseProgress: "dessert",
    tags: [],
  },
  {
    id: "tb6",
    guestName: "Kim Family",
    partySize: 4,
    table: "T7",
    startTime: "18:30",
    endTime: "20:15",
    status: "seated",
    risk: "low",
    courseProgress: "mains-fired",
    tags: [],
  },
  {
    id: "tb7",
    guestName: "Nguyen",
    partySize: 4,
    table: "T16",
    startTime: "18:30",
    endTime: "20:30",
    status: "seated",
    risk: "low",
    courseProgress: "mains-served",
    tags: [],
  },
  {
    id: "tb8",
    guestName: "Lee",
    partySize: 3,
    table: "T25",
    startTime: "18:30",
    endTime: "20:15",
    status: "seated",
    risk: "low",
    courseProgress: "mains-served",
    tags: [],
  },
  {
    id: "tb9",
    guestName: "O'Brien",
    partySize: 6,
    table: "T8",
    mergedWith: "T9",
    startTime: "19:00",
    endTime: "21:15",
    status: "seated",
    risk: "low",
    courseProgress: "apps",
    tags: [
      { type: "birthday", label: "Birthday", icon: "cake" },
      { type: "note", label: "Cake at 8pm", icon: "note", detail: "Cake at 8pm" },
    ],
    notes: "Cake at 8pm",
  },
  {
    id: "tb10",
    guestName: "Webb",
    partySize: 2,
    table: "T5",
    startTime: "19:00",
    endTime: "20:45",
    status: "seated",
    risk: "medium",
    courseProgress: "apps",
    tags: [
      { type: "first-timer", label: "First-timer", icon: "star" },
    ],
  },
  {
    id: "tb11",
    guestName: "Johansson",
    partySize: 4,
    table: "T19",
    startTime: "19:00",
    endTime: "21:00",
    status: "seated",
    risk: "low",
    courseProgress: "ordering",
    tags: [],
  },

  // Arriving / Confirmed
  {
    id: "tb12",
    guestName: "Chen",
    partySize: 4,
    table: "T12",
    startTime: "19:30",
    endTime: "21:30",
    status: "arriving",
    risk: "low",
    tags: [
      { type: "vip", label: "VIP", icon: "star" },
      { type: "allergy", label: "Shellfish allergy", icon: "shrimp", detail: "Shellfish" },
    ],
  },
  {
    id: "tb13",
    guestName: "Morrison",
    partySize: 4,
    table: "T14",
    startTime: "19:30",
    endTime: "21:30",
    status: "unconfirmed",
    risk: "high",
    riskScore: 68,
    tags: [],
  },
  {
    id: "tb14",
    guestName: "Müller",
    partySize: 4,
    table: "T20",
    startTime: "19:45",
    endTime: "21:45",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb15",
    guestName: "Corporate Dinner",
    partySize: 8,
    table: "T23",
    mergedWith: "T24",
    startTime: "20:00",
    endTime: "22:30",
    status: "confirmed",
    risk: "low",
    tags: [
      { type: "note", label: "Pre-order wine", icon: "note" },
    ],
    notes: "Pre-order wine, merged tables",
  },
  {
    id: "tb16",
    guestName: "Dubois",
    partySize: 2,
    table: "T18",
    startTime: "20:00",
    endTime: "21:30",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb17",
    guestName: "Ali",
    partySize: 2,
    table: "T4",
    startTime: "20:15",
    endTime: "22:00",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb18",
    guestName: "Garcia",
    partySize: 4,
    table: "T7",
    startTime: "20:30",
    endTime: "22:15",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb19",
    guestName: "Santos",
    partySize: 4,
    table: "T25",
    startTime: "20:30",
    endTime: "22:30",
    status: "unconfirmed",
    risk: "medium",
    tags: [],
  },
  {
    id: "tb20",
    guestName: "Park",
    partySize: 2,
    table: "T3",
    startTime: "21:00",
    endTime: "22:30",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb21",
    guestName: "Nakamura",
    partySize: 3,
    table: "T9",
    startTime: "21:00",
    endTime: "22:45",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb22",
    guestName: "Rivera",
    partySize: 5,
    table: "T22",
    startTime: "21:00",
    endTime: "23:00",
    status: "confirmed",
    risk: "low",
    tags: [
      { type: "anniversary", label: "Anniversary", icon: "ring" },
    ],
  },
  {
    id: "tb23",
    guestName: "Bennett",
    partySize: 2,
    table: "T1",
    startTime: "20:30",
    endTime: "22:00",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb24",
    guestName: "Fischer",
    partySize: 2,
    table: "T3",
    startTime: "17:00",
    endTime: "18:15",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb25",
    guestName: "Davis",
    partySize: 2,
    table: "T5",
    startTime: "21:15",
    endTime: "22:45",
    status: "arriving",
    risk: "low",
    tags: [{ type: "first-timer", label: "First-time guest", icon: "spark" }],
  },
  {
    id: "tb26",
    guestName: "Keller",
    partySize: 4,
    table: "T7",
    startTime: "17:15",
    endTime: "18:45",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb27",
    guestName: "Lopez",
    partySize: 4,
    table: "T8",
    startTime: "21:30",
    endTime: "22:45",
    status: "confirmed",
    risk: "medium",
    tags: [{ type: "first-timer", label: "First-time guest", icon: "spark" }],
  },
  {
    id: "tb28",
    guestName: "Ibrahim",
    partySize: 3,
    table: "T9",
    startTime: "17:00",
    endTime: "18:45",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb29",
    guestName: "Rossi",
    partySize: 4,
    table: "T12",
    startTime: "21:45",
    endTime: "23:00",
    status: "confirmed",
    risk: "low",
    tags: [{ type: "vip", label: "VIP return", icon: "star" }],
  },
  {
    id: "tb30",
    guestName: "Salim",
    partySize: 4,
    table: "T14",
    startTime: "17:15",
    endTime: "18:45",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb31",
    guestName: "Gruber",
    partySize: 4,
    table: "T14",
    startTime: "21:45",
    endTime: "23:00",
    status: "late",
    risk: "high",
    riskScore: 74,
    lateMinutes: 14,
    tags: [{ type: "note", label: "Running late", icon: "note", detail: "ETA +14 min" }],
  },
  {
    id: "tb32",
    guestName: "Yamamoto",
    partySize: 4,
    arrivedPartySize: 2,
    table: "T16",
    startTime: "20:30",
    endTime: "22:00",
    status: "partially-seated",
    risk: "low",
    tags: [],
  },
  {
    id: "tb32a",
    guestName: "Brown",
    partySize: 4,
    table: "T16",
    startTime: "22:00",
    endTime: "23:00",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb33",
    guestName: "Arman",
    partySize: 2,
    table: "T18",
    startTime: "17:30",
    endTime: "19:00",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb34",
    guestName: "Stein",
    partySize: 2,
    table: "T18",
    startTime: "21:45",
    endTime: "23:00",
    status: "unconfirmed",
    risk: "medium",
    tags: [],
  },
  {
    id: "tb35",
    guestName: "Petrov",
    partySize: 4,
    table: "T19",
    startTime: "17:15",
    endTime: "18:45",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb36",
    guestName: "Meyer",
    partySize: 4,
    table: "T19",
    startTime: "21:15",
    endTime: "22:45",
    status: "confirmed",
    risk: "low",
    tags: [{ type: "allergy", label: "Nut allergy", icon: "alert", detail: "No nuts" }],
  },
  {
    id: "tb37",
    guestName: "Noor",
    partySize: 4,
    table: "T20",
    startTime: "17:30",
    endTime: "19:00",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb38",
    guestName: "Bailey",
    partySize: 4,
    table: "T20",
    startTime: "22:00",
    endTime: "23:00",
    status: "unconfirmed",
    risk: "high",
    riskScore: 71,
    tags: [],
  },
  {
    id: "tb39",
    guestName: "Hoffman",
    partySize: 2,
    table: "T21",
    startTime: "17:00",
    endTime: "18:30",
    status: "no-show",
    risk: "high",
    riskScore: 100,
    tags: [{ type: "note", label: "No response", icon: "note" }],
  },
  {
    id: "tb40",
    guestName: "Pereira",
    partySize: 2,
    table: "T21",
    startTime: "20:30",
    endTime: "22:00",
    status: "confirmed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb41",
    guestName: "Walters",
    partySize: 6,
    table: "T22",
    startTime: "19:45",
    endTime: "21:00",
    status: "arriving",
    risk: "low",
    tags: [{ type: "birthday", label: "Birthday", icon: "cake" }],
  },
  {
    id: "tb42",
    guestName: "Nordic Team",
    partySize: 8,
    table: "T23",
    mergedWith: "T24",
    startTime: "17:00",
    endTime: "19:30",
    status: "completed",
    risk: "low",
    tags: [{ type: "note", label: "Set menu", icon: "note" }],
  },
  {
    id: "tb43",
    guestName: "Aoki",
    partySize: 4,
    table: "T25",
    startTime: "17:00",
    endTime: "18:15",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb44",
    guestName: "Hansen",
    partySize: 3,
    table: "T16",
    startTime: "17:00",
    endTime: "18:15",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb45",
    guestName: "Verma",
    partySize: 2,
    table: "T1",
    startTime: "17:00",
    endTime: "17:45",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb46",
    guestName: "Sato",
    partySize: 2,
    table: "T5",
    startTime: "17:45",
    endTime: "18:45",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb47",
    guestName: "Mendes",
    partySize: 4,
    table: "T7",
    startTime: "22:15",
    endTime: "23:00",
    status: "arriving",
    risk: "medium",
    tags: [],
  },
  {
    id: "tb48",
    guestName: "Costa",
    partySize: 4,
    table: "T12",
    startTime: "17:00",
    endTime: "18:00",
    status: "completed",
    risk: "low",
    tags: [],
  },
  {
    id: "tb49",
    guestName: "Khan",
    partySize: 2,
    table: "T4",
    startTime: "22:00",
    endTime: "23:00",
    status: "unconfirmed",
    risk: "high",
    riskScore: 63,
    tags: [],
  },
  {
    id: "tb50",
    guestName: "Silva",
    partySize: 5,
    table: "T22",
    startTime: "20:00",
    endTime: "22:00",
    status: "confirmed",
    risk: "low",
    tags: [{ type: "anniversary", label: "Anniversary", icon: "ring" }],
  },
  {
    id: "tb51",
    guestName: "Reed",
    partySize: 3,
    table: "T19",
    startTime: "22:45",
    endTime: "23:00",
    status: "late",
    risk: "high",
    riskScore: 58,
    tags: [],
  },
  {
    id: "tb52",
    guestName: "Yamada",
    partySize: 6,
    table: "T23",
    startTime: "22:30",
    endTime: "23:00",
    status: "confirmed",
    risk: "low",
    tags: [{ type: "vip", label: "VIP", icon: "star" }],
  },
]

// ── Ghost Blocks ─────────────────────────────────────────────────────────────

export const ghostBlocks: GhostBlock[] = [
  {
    id: "g1",
    table: "T1",
    predictedTime: "20:15",
    endTime: "22:15",
    label: "Available ~8:15",
  },
  {
    id: "g2",
    table: "T5",
    predictedTime: "20:30",
    endTime: "22:30",
    label: "Available ~8:30",
  },
  {
    id: "g3",
    table: "T14",
    predictedTime: "20:45",
    endTime: "22:45",
    label: "Available ~8:45",
    conditional: "IF Morrison shows",
  },
  {
    id: "g4",
    table: "T16",
    predictedTime: "20:30",
    endTime: "22:30",
    label: "Available ~8:30",
  },
]

// ── Merged Blocks (blocked lanes) ────────────────────────────────────────────

export const mergedBlocks: MergedBlock[] = [
  {
    table: "T9",
    mergedWith: "T8",
    startTime: "19:00",
    endTime: "21:15",
  },
  {
    table: "T24",
    mergedWith: "T23",
    startTime: "20:00",
    endTime: "22:30",
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

let nonOverlappingBlocksCache: Map<string, TimelineBlock[]> | null = null

function buildNonOverlappingBlocksCache(): Map<string, TimelineBlock[]> {
  const cache = new Map<string, TimelineBlock[]>()
  const tableIds = Array.from(new Set(timelineBlocks.map((block) => block.table)))

  for (const tableId of tableIds) {
    const tableBlocks = timelineBlocks.filter((block) => block.table === tableId)
    const rawStarts = tableBlocks.map((block) => parseTimeToMinutes(block.startTime))
    const anchorStart = rawStarts.length > 0 ? Math.min(...rawStarts) : 0

    const normalized = tableBlocks
      .map((block) => {
        const start = parseTimeToMinutes(block.startTime)
        const end = parseTimeToMinutes(block.endTime)
        const window = normalizeWindow(start, end, anchorStart)
        if (!window) return null
        return { block, start: window.start, end: window.end }
      })
      .filter((item): item is { block: TimelineBlock; start: number; end: number } => item !== null)
      .sort((a, b) => a.start - b.start || a.end - b.end || a.block.id.localeCompare(b.block.id))

    let lastEnd = Number.NEGATIVE_INFINITY
    const sanitized = normalized.map(({ block, start, end }) => {
      const adjustedStart = Math.max(start, lastEnd)
      const adjustedEnd = Math.max(end, adjustedStart + 15)
      lastEnd = adjustedEnd

      return {
        ...block,
        startTime: toTime24(adjustedStart),
        endTime: toTime24(adjustedEnd),
        // Stamp blocks with the current service day so availability can filter by date
        date: block.date ?? TODAY,
      }
    })

    cache.set(tableId, sanitized)
  }

  return cache
}

function getNonOverlappingBlocksCache(): Map<string, TimelineBlock[]> {
  if (!nonOverlappingBlocksCache) {
    nonOverlappingBlocksCache = buildNonOverlappingBlocksCache()
  }
  return nonOverlappingBlocksCache
}

export function getBlocksForTable(tableId: string): TimelineBlock[] {
  return getNonOverlappingBlocksCache().get(tableId) ?? []
}

export function getTimelineBlocksNoOverlap(): TimelineBlock[] {
  return Array.from(getNonOverlappingBlocksCache().values()).flat()
}

export function getGhostsForTable(tableId: string, options?: GhostQueryOptions): GhostBlock[] {
  return getGhostsForTableWithinService(tableId, options)
}

function toTime24(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(normalized / 60).toString().padStart(2, "0")
  const m = (normalized % 60).toString().padStart(2, "0")
  return `${h}:${m}`
}

function normalizeWindow(start: number, end: number, anchorStart: number): { start: number; end: number } | null {
  let normalizedStart = start
  let normalizedEnd = end
  if (normalizedEnd <= normalizedStart) normalizedEnd += 24 * 60
  while (normalizedEnd <= anchorStart) {
    normalizedStart += 24 * 60
    normalizedEnd += 24 * 60
  }
  if (normalizedEnd <= normalizedStart) return null
  return { start: normalizedStart, end: normalizedEnd }
}

export function getGhostsForTableWithinService(
  tableId: string,
  options?: GhostQueryOptions
): GhostBlock[] {
  const serviceStart = options?.serviceStart ?? DINNER_START
  const serviceEnd = options?.serviceEnd ?? DINNER_END
  const { startMin: serviceStartMin, endMin: serviceEndMin } = getRangeBounds(serviceStart, serviceEnd)

  const windows: Array<{ start: number; end: number }> = []

  const sourceBlocks = options?.blocks
    ? options.blocks.filter((block) => block.table === tableId)
    : getBlocksForTable(tableId)

  for (const block of sourceBlocks) {
    const startMin = parseTimeToMinutes(block.startTime)
    const endMin = parseTimeToMinutes(block.endTime)
    const normalized = normalizeWindow(startMin, endMin, serviceStartMin)
    if (!normalized) continue
    const clampedStart = Math.max(normalized.start, serviceStartMin)
    const clampedEnd = Math.min(normalized.end, serviceEndMin)
    if (clampedEnd > clampedStart) {
      windows.push({ start: clampedStart, end: clampedEnd })
    }
  }

  const merged = getMergedForTable(tableId)
  if (merged) {
    const mergedStart = parseTimeToMinutes(merged.startTime)
    const mergedEnd = parseTimeToMinutes(merged.endTime)
    const normalizedMerged = normalizeWindow(mergedStart, mergedEnd, serviceStartMin)
    if (normalizedMerged) {
      const clampedStart = Math.max(normalizedMerged.start, serviceStartMin)
      const clampedEnd = Math.min(normalizedMerged.end, serviceEndMin)
      if (clampedEnd > clampedStart) {
        windows.push({ start: clampedStart, end: clampedEnd })
      }
    }
  }

  if (windows.length === 0) return []

  const sorted = [...windows].sort((a, b) => a.start - b.start || a.end - b.end)
  const mergedWindows = sorted.reduce<Array<{ start: number; end: number }>>((acc, current) => {
    const last = acc[acc.length - 1]
    if (!last || current.start > last.end) {
      acc.push({ ...current })
      return acc
    }
    last.end = Math.max(last.end, current.end)
    return acc
  }, [])

  const anchorRaw = options?.nowTime ? parseTimeToMinutes(options.nowTime) : serviceStartMin
  const anchorNormalized = Number.isFinite(anchorRaw)
    ? (anchorRaw < serviceStartMin ? anchorRaw + 24 * 60 : anchorRaw)
    : serviceStartMin
  const anchor = Math.min(Math.max(anchorNormalized, serviceStartMin), serviceEndMin)

  let cursor = anchor
  for (const interval of mergedWindows) {
    if (interval.end <= cursor) continue
    if (interval.start > cursor) break
    cursor = interval.end
  }

  if (cursor >= serviceEndMin) return []

  // Ghost slots represent "becomes available later", not "already available now".
  if (cursor <= anchor) return []

  const nextBlockStart = mergedWindows.find((interval) => interval.start > cursor)?.start ?? serviceEndMin
  const predictedTime = toTime24(cursor)
  const endTime = toTime24(nextBlockStart)

  return [
    {
      id: `ghost-${tableId}-${cursor}`,
      table: tableId,
      predictedTime,
      endTime,
      label: `Available ~${formatTime12h(predictedTime)}`,
    },
  ]
}

export function getMergedForTable(tableId: string): MergedBlock | undefined {
  return mergedBlocks.find((m) => m.table === tableId)
}

export function getTablesForZone(zoneId: string, lanes?: TableLane[]): TableLane[] {
  const list = lanes ?? []
  return list.filter((t) => t.zone === zoneId)
}

export function getBlockColor(block: TimelineBlock): {
  container: string
  text: string
  statusText: string
  pulse: string | null
  withBlur: boolean
  borderStyle?: "solid" | "dashed dashed dashed solid"
} {
  switch (block.status) {
    case "confirmed":
      return {
        container: "bg-cyan-500/15 border border-cyan-500/30 border-l-[3px] border-l-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]",
        text: "text-zinc-100",
        statusText: "text-cyan-400",
        pulse: null,
        withBlur: true,
      }
    case "unconfirmed":
      return {
        container: "bg-violet-400/[0.07] border-[1.5px] border-dashed border-violet-300/45 border-l-[3px] border-l-violet-400 [border-left-style:solid] shadow-[0_0_12px_rgba(139,92,246,0.2)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]",
        text: "text-zinc-100/85",
        statusText: "text-violet-400",
        pulse: null,
        withBlur: true,
      }
    case "arriving":
      return {
        container: "bg-amber-500/15 border border-amber-500/30 border-l-[3px] border-l-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.35)]",
        text: "text-zinc-100",
        statusText: "text-amber-400",
        pulse: "tl-pulse-arriving-neon",
        withBlur: true,
      }
    case "seated":
      return {
        container: "bg-emerald-500/15 border border-emerald-500/25 border-l-[3px] border-l-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]",
        text: "text-zinc-100",
        statusText: "text-emerald-400",
        pulse: null,
        withBlur: true,
      }
    case "partially-seated":
      return {
        container: "bg-transparent border border-emerald-500/35 border-l-[3px] border-l-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15),0_0_12px_rgba(6,182,212,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.24),0_0_20px_rgba(6,182,212,0.24)]",
        text: "text-zinc-100",
        statusText: "text-emerald-400",
        pulse: null,
        withBlur: true,
      }
    case "late":
      return {
        container: "bg-rose-500/15 border border-rose-500/30 border-l-[3px] border-l-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.25)] hover:shadow-[0_0_22px_rgba(244,63,94,0.4)]",
        text: "text-zinc-100",
        statusText: "text-rose-400",
        pulse: "tl-pulse-late-neon",
        withBlur: true,
      }
    case "no-show":
      return {
        container: "bg-gradient-to-r from-rose-500/10 to-zinc-700/10 border border-rose-500/20 border-l-[3px] border-l-rose-500/30",
        text: "text-zinc-100/45",
        statusText: "text-rose-400/60",
        pulse: null,
        withBlur: true,
      }
    case "completed":
      return {
        container: "bg-zinc-700/10 border border-zinc-600/20 border-l-[3px] border-l-zinc-600/30",
        text: "text-zinc-100/40",
        statusText: "text-zinc-500",
        pulse: null,
        withBlur: false,
      }
  }
}

export function getPartiallySeatedRatio(block: TimelineBlock): number | null {
  if (block.status !== "partially-seated") return null
  const arrived = Math.max(0, Math.min(block.arrivedPartySize ?? Math.ceil(block.partySize / 2), block.partySize))
  const ratio = block.partySize > 0 ? (arrived / block.partySize) * 100 : 50
  return Math.max(0, Math.min(100, ratio))
}

export function getStatusDot(block: TimelineBlock): {
  className: string
  pulseClass?: string
  style?: { backgroundImage?: string }
} {
  if (block.status === "partially-seated") {
    const ratio = getPartiallySeatedRatio(block) ?? 50
    return {
      className: "bg-transparent",
      style: { backgroundImage: `linear-gradient(90deg, rgb(52 211 153) 0%, rgb(52 211 153) ${ratio}%, rgb(34 211 238) ${ratio}%, rgb(34 211 238) 100%)` },
    }
  }
  if (block.status === "arriving") {
    return { className: "bg-amber-400" }
  }
  if (block.status === "late") {
    return { className: "bg-rose-400" }
  }
  if (block.status === "confirmed" && block.tags.some((tag) => tag.type === "first-timer")) {
    return { className: "bg-amber-400" }
  }
  if (block.status === "confirmed") return { className: "bg-cyan-400" }
  if (block.status === "unconfirmed") return { className: "bg-violet-400" }
  if (block.status === "seated") return { className: "bg-emerald-400" }
  if (block.status === "no-show") return { className: "bg-rose-500" }
  return { className: "bg-zinc-500/50" }
}

export function getStatusLabel(block: TimelineBlock): string {
  if (block.status === "completed") return "Completed \u2713"
  if (block.status === "no-show") return "No-Show \u2717"
  if (block.status === "arriving") return "Arriving now"
  if (block.status === "unconfirmed") return "Unconfirmed"
  if (block.status === "late") return `Late \u00b7 ${block.lateMinutes ?? 12} min`
  if (block.status === "confirmed") return "Confirmed"
  if (block.status === "partially-seated") {
    const arrived = Math.max(0, Math.min(block.arrivedPartySize ?? Math.ceil(block.partySize / 2), block.partySize))
    return `Partially Seated \u00b7 ${arrived}/${block.partySize} here`
  }
  if (block.status === "seated" && block.courseProgress) {
    const labels: Record<CourseProgress, string> = {
      ordering: "Seated \u00b7 Ordering",
      apps: "Seated \u00b7 Apps",
      "mains-fired": "Seated \u00b7 Mains",
      "mains-served": "Seated \u00b7 Mains",
      dessert: "Seated \u00b7 Dessert",
      check: "Seated \u00b7 Check",
      paying: "Seated \u00b7 Paying",
    }
    return labels[block.courseProgress]
  }
  return "Seated"
}

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number)
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  const ampm = h >= 12 ? "PM" : "AM"
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`
}

export function formatTime24h(time24: string): string {
  const [h, m] = time24.split(":").map(Number)
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

export { restaurantConfig }
