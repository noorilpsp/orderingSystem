// ── Waitlist Intelligence System - Data Layer ───────────────────────────────

import { storeTablesToOccupiedTables } from "@/lib/reservations-data"
import type { StoreTable } from "@/store/types"

export type WaitlistLocation =
  | "at-restaurant"
  | "at-bar"
  | "stepped-out"
  | "left-area"
  | "just-arrived"
  | "just-added"

export type MatchStatus = "ready-now" | "turning-soon" | "long-wait" | "merge-option"

export type SortMode = "smart" | "wait-time" | "party-size" | "quoted-time"

export interface TableMatch {
  /** Table UUID for API/seat flow. Use for seatFromWaitlist. */
  tableId: string
  /** Display label for UI, e.g. "T12". Use displayId ?? tableId when showing to user. */
  displayId?: string
  seats: number
  zone: string
  detail: string // e.g. "Window", "Outdoor"
  status: MatchStatus
  estMinutes: number // 0 = available now
  reason?: string // e.g. "Williams finishing dessert"
}

export interface MergeOption {
  tables: string[]
  combinedSeats: number
  estTime: string // e.g. "~8:30"
  reason?: string
}

export interface WaitlistEntry {
  id: string
  name: string
  partySize: number
  quotedWait: number // minutes
  joinedAt: number // minutes after 17:00 (absolute for timer calc)
  location: WaitlistLocation
  phone?: string
  barTab?: number
  notes?: string
  preferences?: string
  smsSent?: boolean
  smsStatus?: string // e.g. "Confirmed at restaurant", "SMS sent - browsing menu"
  bestMatch: TableMatch | null
  altMatches: TableMatch[]
  mergeOption?: MergeOption
}

export interface CompletedEntry {
  id: string
  name: string
  partySize: number
  joinedTime: string // display time e.g. "6:00 PM"
  waitedMin: number
  quotedMin: number
  withinQuote: boolean
}

export interface RemovedEntry {
  id: string
  name: string
  partySize: number
  time: string
  reason: string // "Left after 15 min", "Cancelled via SMS", etc.
}

export interface AvailableTable {
  /** Table UUID for matching to entries. */
  id: string
  /** Display label for UI, e.g. "T12". */
  displayId?: string
  seats: number
  zone: string
  detail: string
  status: "available-now" | "turning-soon" | "occupied"
  estMinutes: number
  currentParty?: string
  courseStage?: string
}

export interface QuoteAccuracy {
  totalSeated: number
  withinQuote: number
  accuracyPct: number
  avgOverquoteMin: number
  avgUnderquoteMin: number
  underquoteCount: number
  tip: string
  suggestedQuote?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

export const CURRENT_TIME = "7:23 PM"
export const CURRENT_DATE = "Fri, Jan 17"
export const SERVICE_PERIOD = "Dinner"
// Minutes since 17:00 that equals "now"
export const NOW_MINUTES = 143 // 7:23 PM = 143 min after 17:00

/** Map store/reservations-data waitlist party to full WaitlistEntry (for UI that expects bestMatch, etc.). */
export type WaitlistPartyLike = {
  id: string
  name: string
  partySize: number
  quotedWait: number
  elapsedWait?: number
  notes?: string
}
export function waitlistPartyToWaitlistEntry(
  wp: WaitlistPartyLike,
  tables?: StoreTable[] | null
): WaitlistEntry {
  const elapsed = wp.elapsedWait ?? 0
  const joinedAt = Math.max(0, NOW_MINUTES - elapsed)
  const { bestMatch, altMatches } = computeBestMatchesForParty(wp, tables ?? [])
  return {
    id: wp.id,
    name: wp.name,
    partySize: wp.partySize,
    quotedWait: wp.quotedWait,
    joinedAt,
    location: "at-restaurant",
    bestMatch,
    altMatches,
    notes: wp.notes,
  }
}

/** Fallback est minutes when no real occupied-table ETA exists. */
const FALLBACK_OCCUPIED_EST_MINUTES = 15
/** Est minutes for cleaning tables (honest guess). */
const CLEANING_EST_MINUTES = 5

/** Build tableId → predictedTurnMin from real turn tracker. Used for occupied-table ETAs. */
function getOccupiedEtaMap(tables: StoreTable[]): Map<string, number> {
  const occupied = storeTablesToOccupiedTables(tables)
  return new Map(occupied.map((o) => [o.id, o.predictedTurnMin]))
}

/**
 * Compute best and alternate table matches for a waitlist party using real table state.
 * Uses party size, table capacity, and table status. Occupied tables use per-table ETA
 * from the real turn tracker (stage-aware); falls back to FALLBACK_OCCUPIED_EST_MINUTES
 * when no estimate exists.
 */
export function computeBestMatchesForParty(
  party: { partySize: number },
  tables: StoreTable[]
): { bestMatch: TableMatch | null; altMatches: TableMatch[] } {
  if (tables.length === 0) return { bestMatch: null, altMatches: [] }

  const fits = tables.filter((t) => t.capacity >= party.partySize && t.status !== "closed")
  if (fits.length === 0) return { bestMatch: null, altMatches: [] }

  const occupiedEta = getOccupiedEtaMap(tables)

  const toMatch = (t: StoreTable): TableMatch => {
    const isFree = t.status === "free"
    const isCleaning = t.status === "cleaning"
    let status: MatchStatus
    let estMinutes: number
    if (isFree) {
      status = "ready-now"
      estMinutes = 0
    } else if (isCleaning) {
      status = "turning-soon"
      estMinutes = CLEANING_EST_MINUTES
    } else {
      status = "turning-soon"
      estMinutes = occupiedEta.get(t.id) ?? FALLBACK_OCCUPIED_EST_MINUTES
    }
    return {
      tableId: t.id,
      displayId: `T${t.number}`,
      seats: t.capacity,
      zone: t.section,
      detail: "",
      status,
      estMinutes,
    }
  }

  const matches = fits.map(toMatch)
  const ready = matches.filter((m) => m.status === "ready-now")
  const turning = matches.filter((m) => m.status === "turning-soon")

  // Best: smallest available now, else soonest turning (by ETA), then smallest capacity
  const bySeats = (a: TableMatch, b: TableMatch) => a.seats - b.seats
  const byEtaThenSeats = (a: TableMatch, b: TableMatch) =>
    a.estMinutes !== b.estMinutes ? a.estMinutes - b.estMinutes : a.seats - b.seats
  const best =
    ready.length > 0 ? [...ready].sort(bySeats)[0] : turning.length > 0 ? [...turning].sort(byEtaThenSeats)[0] : null
  const rest = best ? matches.filter((m) => m.tableId !== best.tableId).sort(byEtaThenSeats).slice(0, 4) : []
  return { bestMatch: best, altMatches: rest }
}

/**
 * Convert store tables to AvailableTable list for the matching panel.
 * Excludes closed tables. Occupied tables use per-table ETA from turn tracker.
 */
export function storeTablesToAvailableTables(tables: StoreTable[]): AvailableTable[] {
  const occupiedEta = getOccupiedEtaMap(tables)
  const out: AvailableTable[] = []
  for (const t of tables) {
    if (t.status === "closed") continue
    const isFree = t.status === "free"
    const isCleaning = t.status === "cleaning"
    let status: "available-now" | "turning-soon" | "occupied"
    let estMinutes: number
    if (isFree) {
      status = "available-now"
      estMinutes = 0
    } else if (isCleaning) {
      status = "turning-soon"
      estMinutes = CLEANING_EST_MINUTES
    } else {
      status = "turning-soon"
      estMinutes = occupiedEta.get(t.id) ?? FALLBACK_OCCUPIED_EST_MINUTES
    }
    out.push({
      id: t.id,
      displayId: `T${t.number}`,
      seats: t.capacity,
      zone: t.section,
      detail: "",
      status,
      estMinutes,
    })
  }
  return out.sort((a, b) => (a.estMinutes !== b.estMinutes ? a.estMinutes - b.estMinutes : a.seats - b.seats))
}

// ── Active Waitlist (expanded scenarios for testing) ─────────────────────────

export const activeWaitlist: WaitlistEntry[] = [
  {
    id: "wl-1",
    name: "Rodriguez Family",
    partySize: 4,
    quotedWait: 25,
    joinedAt: 125, // joined at 7:05 PM → 18 min ago
    location: "at-restaurant",
    phone: "+1 (555) 123-4567",
    smsSent: true,
    smsStatus: "Confirmed at restaurant",
    notes: "Kids with us, need highchair",
    preferences: "Prefers indoor",
    bestMatch: {
      tableId: "T3",
      seats: 4,
      zone: "Main Dining",
      detail: "Window",
      status: "ready-now",
      estMinutes: 0,
    },
    altMatches: [
      { tableId: "T7", seats: 4, zone: "Main Dining", detail: "Center", status: "turning-soon", estMinutes: 15, reason: "Kim Family - mains" },
      { tableId: "T14", seats: 4, zone: "Main Dining", detail: "Corner", status: "turning-soon", estMinutes: 10, reason: "Martinez wrapping up" },
    ],
  },
  {
    id: "wl-2",
    name: "Kim & Park",
    partySize: 2,
    quotedWait: 15,
    joinedAt: 131, // joined at 7:11 PM → 12 min ago
    location: "at-bar",
    barTab: 67,
    phone: "+1 (555) 234-5678",
    smsSent: true,
    smsStatus: "At the bar",
    bestMatch: {
      tableId: "T1",
      seats: 2,
      zone: "Main Dining",
      detail: "Banquette",
      status: "turning-soon",
      estMinutes: 8,
      reason: "Williams finishing dessert",
    },
    altMatches: [
      { tableId: "T21", seats: 2, zone: "Patio", detail: "Outdoor", status: "ready-now", estMinutes: 0 },
    ],
  },
  {
    id: "wl-3",
    name: "Thompson Group",
    partySize: 6,
    quotedWait: 40,
    joinedAt: 138, // joined at 7:18 PM → 5 min ago
    location: "at-restaurant",
    phone: "+1 (555) 345-6789",
    smsSent: true,
    smsStatus: "SMS sent - browsing menu on phone",
    notes: "Celebrating promotion, budget flexible",
    bestMatch: {
      tableId: "T22",
      seats: 6,
      zone: "Main Dining",
      detail: "Round table",
      status: "turning-soon",
      estMinutes: 35,
      reason: "Anderson party - finishing",
    },
    altMatches: [],
    mergeOption: {
      tables: ["T15", "T16"],
      combinedSeats: 8,
      estTime: "~8:30",
      reason: "Both clearing after current seatings",
    },
  },
  {
    id: "wl-4",
    name: "Yusuf Ali",
    partySize: 2,
    quotedWait: 20,
    joinedAt: 140, // joined at 7:20 PM → 3 min ago
    location: "at-restaurant",
    phone: "+1 (555) 456-7890",
    smsSent: true,
    smsStatus: "Confirmed at restaurant",
    bestMatch: {
      tableId: "T3",
      seats: 4,
      zone: "Main Dining",
      detail: "Window",
      status: "turning-soon",
      estMinutes: 7,
      reason: "If Rodriguez seated now",
    },
    altMatches: [
      { tableId: "T1", seats: 2, zone: "Main Dining", detail: "Banquette", status: "turning-soon", estMinutes: 8, reason: "Williams finishing" },
    ],
  },
  {
    id: "wl-5",
    name: "O'Connor & Davies",
    partySize: 3,
    quotedWait: 30,
    joinedAt: 141, // joined at 7:21 PM → 2 min ago
    location: "at-restaurant",
    phone: "+32 (0)2 345 6789",
    smsSent: false,
    notes: "Allergy: gluten-free needed",
    bestMatch: null,
    altMatches: [],
  },
  {
    id: "wl-6",
    name: "Sato",
    partySize: 2,
    quotedWait: 10,
    joinedAt: 142, // joined at 7:22 PM → 1 min ago
    location: "just-arrived",
    phone: "+1 (555) 567-8901",
    smsSent: true,
    smsStatus: "Just arrived",
    notes: "Anniversary dinner",
    bestMatch: {
      tableId: "T1",
      seats: 2,
      zone: "Main Dining",
      detail: "Banquette",
      status: "turning-soon",
      estMinutes: 8,
      reason: "Williams finishing dessert",
    },
    altMatches: [
      { tableId: "T21", seats: 2, zone: "Patio", detail: "Outdoor", status: "ready-now", estMinutes: 0 },
    ],
  },
  {
    id: "wl-7",
    name: "Petrova & Ivanov",
    partySize: 4,
    quotedWait: 35,
    joinedAt: 143, // just added
    location: "just-added",
    phone: "+1 (555) 678-9012",
    smsSent: false,
    notes: "Quiet area preferred",
    bestMatch: null,
    altMatches: [],
  },
  {
    id: "wl-8",
    name: "Mensah Family",
    partySize: 5,
    quotedWait: 45,
    joinedAt: 143, // just added
    location: "stepped-out",
    phone: "+1 (555) 789-0123",
    smsSent: true,
    smsStatus: "Will be back in 10 min",
    bestMatch: null,
    altMatches: [],
    mergeOption: {
      tables: ["T10", "T12"],
      combinedSeats: 8,
      estTime: "~8:45",
      reason: "After Chen party finishes",
    },
  },
  {
    id: "wl-9",
    name: "Gruber",
    partySize: 2,
    quotedWait: 12,
    joinedAt: 124,
    location: "at-restaurant",
    phone: "+1 (555) 890-1111",
    smsSent: true,
    smsStatus: "At host stand",
    bestMatch: {
      tableId: "T18",
      seats: 2,
      zone: "Main Dining",
      detail: "Booth",
      status: "ready-now",
      estMinutes: 0,
    },
    altMatches: [
      { tableId: "T5", seats: 2, zone: "Patio", detail: "Edge", status: "turning-soon", estMinutes: 6, reason: "Bennett paying" },
    ],
  },
  {
    id: "wl-10",
    name: "Silva Party",
    partySize: 7,
    quotedWait: 50,
    joinedAt: 110,
    location: "at-bar",
    phone: "+1 (555) 890-2222",
    barTab: 112,
    smsSent: true,
    smsStatus: "At the bar",
    notes: "Business dinner, wine service",
    bestMatch: {
      tableId: "T28",
      seats: 8,
      zone: "Private",
      detail: "Long table",
      status: "turning-soon",
      estMinutes: 22,
      reason: "Corporate ending entrees",
    },
    altMatches: [],
    mergeOption: {
      tables: ["T31", "T32"],
      combinedSeats: 10,
      estTime: "~8:55",
      reason: "Both close to check",
    },
  },
  {
    id: "wl-11",
    name: "Nakamura",
    partySize: 2,
    quotedWait: 18,
    joinedAt: 126,
    location: "just-arrived",
    phone: "+1 (555) 890-3333",
    smsSent: true,
    smsStatus: "Just arrived",
    bestMatch: {
      tableId: "T5",
      seats: 2,
      zone: "Patio",
      detail: "Edge",
      status: "ready-now",
      estMinutes: 0,
    },
    altMatches: [
      { tableId: "T2", seats: 2, zone: "Main Dining", detail: "Rail", status: "turning-soon", estMinutes: 7, reason: "Jensen on dessert" },
    ],
  },
  {
    id: "wl-12",
    name: "Patel Family",
    partySize: 5,
    quotedWait: 25,
    joinedAt: 116,
    location: "at-restaurant",
    phone: "+1 (555) 890-4444",
    smsSent: true,
    smsStatus: "Confirmed at restaurant",
    notes: "Needs stroller space",
    bestMatch: {
      tableId: "T30",
      seats: 6,
      zone: "Main Dining",
      detail: "Round",
      status: "turning-soon",
      estMinutes: 18,
      reason: "Nguyen on check",
    },
    altMatches: [
      { tableId: "T25", seats: 6, zone: "Main Dining", detail: "Center", status: "turning-soon", estMinutes: 26, reason: "Slow mains" },
    ],
  },
  {
    id: "wl-13",
    name: "Brown & Lee",
    partySize: 2,
    quotedWait: 20,
    joinedAt: 136,
    location: "left-area",
    phone: "+1 (555) 890-5555",
    smsSent: true,
    smsStatus: "Left area - returns in 5",
    bestMatch: null,
    altMatches: [],
  },
  {
    id: "wl-14",
    name: "Garcia Team",
    partySize: 8,
    quotedWait: 55,
    joinedAt: 129,
    location: "at-restaurant",
    phone: "+1 (555) 890-6666",
    smsSent: false,
    notes: "Needs quieter corner",
    bestMatch: {
      tableId: "T31+T32",
      seats: 10,
      zone: "Private",
      detail: "Merge candidate",
      status: "merge-option",
      estMinutes: 28,
      reason: "Requires merge flow",
    },
    altMatches: [],
    mergeOption: {
      tables: ["T31", "T32"],
      combinedSeats: 10,
      estTime: "~8:40",
    },
  },
  {
    id: "wl-15",
    name: "Olsen",
    partySize: 1,
    quotedWait: 8,
    joinedAt: 139,
    location: "at-restaurant",
    phone: "+1 (555) 890-7777",
    smsSent: true,
    smsStatus: "Standing by",
    bestMatch: {
      tableId: "T2",
      seats: 2,
      zone: "Main Dining",
      detail: "Rail",
      status: "ready-now",
      estMinutes: 0,
    },
    altMatches: [],
  },
  {
    id: "wl-16",
    name: "Chen Trio",
    partySize: 3,
    quotedWait: 22,
    joinedAt: 121,
    location: "at-restaurant",
    phone: "+1 (555) 890-8888",
    smsSent: true,
    smsStatus: "Confirmed at restaurant",
    bestMatch: {
      tableId: "T14",
      seats: 4,
      zone: "Main Dining",
      detail: "Corner",
      status: "turning-soon",
      estMinutes: 12,
      reason: "Turn expected",
    },
    altMatches: [
      { tableId: "T7", seats: 4, zone: "Main Dining", detail: "Center", status: "turning-soon", estMinutes: 16, reason: "Apps" },
    ],
  },
  {
    id: "wl-17",
    name: "Davis",
    partySize: 4,
    quotedWait: 28,
    joinedAt: 135,
    location: "at-restaurant",
    phone: "+1 (555) 891-0001",
    smsSent: true,
    smsStatus: "At restaurant",
    bestMatch: {
      tableId: "T11",
      seats: 4,
      zone: "Patio",
      detail: "Heated",
      status: "ready-now",
      estMinutes: 0,
    },
    altMatches: [
      { tableId: "T19", seats: 4, zone: "Main Dining", detail: "Window", status: "turning-soon", estMinutes: 9, reason: "Check dropped" },
    ],
  },
  {
    id: "wl-18",
    name: "Romero",
    partySize: 6,
    quotedWait: 35,
    joinedAt: 119,
    location: "at-bar",
    phone: "+1 (555) 891-0002",
    barTab: 84,
    smsSent: true,
    smsStatus: "At the bar",
    bestMatch: null,
    altMatches: [],
    mergeOption: {
      tables: ["T10", "T12"],
      combinedSeats: 8,
      estTime: "~8:45",
      reason: "Needs merged seating",
    },
  },
  {
    id: "wl-19",
    name: "Wang",
    partySize: 2,
    quotedWait: 12,
    joinedAt: 133,
    location: "at-restaurant",
    phone: "+1 (555) 891-0003",
    smsSent: true,
    smsStatus: "At host stand",
    bestMatch: {
      tableId: "T6",
      seats: 2,
      zone: "Main Dining",
      detail: "Booth",
      status: "turning-soon",
      estMinutes: 5,
      reason: "Dessert finishing",
    },
    altMatches: [
      { tableId: "T21", seats: 2, zone: "Patio", detail: "Outdoor", status: "ready-now", estMinutes: 0 },
    ],
  },
  {
    id: "wl-20",
    name: "Ibrahim",
    partySize: 4,
    quotedWait: 16,
    joinedAt: 118,
    location: "stepped-out",
    phone: "+1 (555) 891-0004",
    smsSent: true,
    smsStatus: "Stepped out - 10 min",
    bestMatch: null,
    altMatches: [],
  },
  {
    id: "wl-21",
    name: "Lopez",
    partySize: 3,
    quotedWait: 18,
    joinedAt: 130,
    location: "at-restaurant",
    phone: "+1 (555) 891-0005",
    smsSent: true,
    smsStatus: "Confirmed at restaurant",
    bestMatch: {
      tableId: "T26",
      seats: 4,
      zone: "Main Dining",
      detail: "Aisle",
      status: "ready-now",
      estMinutes: 0,
    },
    altMatches: [
      { tableId: "T14", seats: 4, zone: "Main Dining", detail: "Corner", status: "turning-soon", estMinutes: 11, reason: "If needed" },
    ],
  },
  {
    id: "wl-22",
    name: "Singh",
    partySize: 2,
    quotedWait: 14,
    joinedAt: 134,
    location: "just-arrived",
    phone: "+1 (555) 891-0006",
    smsSent: true,
    smsStatus: "Just arrived",
    bestMatch: {
      tableId: "T1",
      seats: 2,
      zone: "Main Dining",
      detail: "Banquette",
      status: "long-wait",
      estMinutes: 20,
      reason: "Unexpected slow turn",
    },
    altMatches: [],
  },
  {
    id: "wl-23",
    name: "Moretti",
    partySize: 5,
    quotedWait: 30,
    joinedAt: 137,
    location: "at-restaurant",
    phone: "+1 (555) 891-0007",
    smsSent: false,
    notes: "Birthday dessert setup",
    bestMatch: {
      tableId: "T25",
      seats: 6,
      zone: "Main Dining",
      detail: "Center",
      status: "turning-soon",
      estMinutes: 21,
      reason: "Large-table turnover",
    },
    altMatches: [
      { tableId: "T22", seats: 6, zone: "Main Dining", detail: "Round table", status: "turning-soon", estMinutes: 28, reason: "Backup" },
    ],
  },
  {
    id: "wl-24",
    name: "Khan",
    partySize: 2,
    quotedWait: 9,
    joinedAt: 128,
    location: "at-bar",
    phone: "+1 (555) 891-0008",
    barTab: 39,
    smsSent: true,
    smsStatus: "At the bar",
    bestMatch: null,
    altMatches: [],
  },
  {
    id: "wl-25",
    name: "Dubois",
    partySize: 4,
    quotedWait: 26,
    joinedAt: 132,
    location: "at-restaurant",
    phone: "+1 (555) 891-0009",
    smsSent: true,
    smsStatus: "Confirmed at restaurant",
    bestMatch: {
      tableId: "T19",
      seats: 4,
      zone: "Main Dining",
      detail: "Window",
      status: "merge-option",
      estMinutes: 19,
      reason: "Table reassignment pending",
    },
    altMatches: [],
    mergeOption: {
      tables: ["T17", "T18"],
      combinedSeats: 6,
      estTime: "~8:38",
      reason: "Fast merge path",
    },
  },
  {
    id: "wl-26",
    name: "Alvarez",
    partySize: 6,
    quotedWait: 42,
    joinedAt: 120,
    location: "at-restaurant",
    phone: "+1 (555) 891-0010",
    smsSent: true,
    smsStatus: "At restaurant",
    notes: "Needs highchair",
    bestMatch: {
      tableId: "T22",
      seats: 6,
      zone: "Main Dining",
      detail: "Round table",
      status: "turning-soon",
      estMinutes: 24,
      reason: "Expected clear soon",
    },
    altMatches: [
      { tableId: "T28", seats: 8, zone: "Private", detail: "Long table", status: "turning-soon", estMinutes: 30, reason: "Backup large top" },
    ],
  },
]

// ── Available / Turning Tables ───────────────────────────────────────────────

export const availableTables: AvailableTable[] = [
  { id: "T3", seats: 4, zone: "Main Dining", detail: "Window", status: "available-now", estMinutes: 0 },
  { id: "T21", seats: 2, zone: "Patio", detail: "Outdoor", status: "available-now", estMinutes: 0 },
  { id: "T2", seats: 2, zone: "Main Dining", detail: "Rail", status: "available-now", estMinutes: 0 },
  { id: "T11", seats: 4, zone: "Patio", detail: "Heated", status: "available-now", estMinutes: 0 },
  { id: "T18", seats: 2, zone: "Main Dining", detail: "Booth", status: "available-now", estMinutes: 0 },
  { id: "T26", seats: 4, zone: "Main Dining", detail: "Aisle", status: "available-now", estMinutes: 0 },
  { id: "T1", seats: 2, zone: "Main Dining", detail: "Banquette", status: "turning-soon", estMinutes: 8, currentParty: "Williams", courseStage: "Dessert" },
  { id: "T7", seats: 4, zone: "Main Dining", detail: "Center", status: "turning-soon", estMinutes: 15, currentParty: "Kim Family", courseStage: "Mains" },
  { id: "T22", seats: 6, zone: "Main Dining", detail: "Round table", status: "turning-soon", estMinutes: 35, currentParty: "Anderson", courseStage: "Finishing" },
  { id: "T14", seats: 4, zone: "Main Dining", detail: "Corner", status: "turning-soon", estMinutes: 10, currentParty: "Martinez", courseStage: "Check" },
  { id: "T25", seats: 6, zone: "Main Dining", detail: "Center", status: "turning-soon", estMinutes: 21, currentParty: "Rossi", courseStage: "Mains" },
  { id: "T28", seats: 8, zone: "Private", detail: "Long table", status: "turning-soon", estMinutes: 24, currentParty: "Corporate", courseStage: "Dessert" },
  { id: "T30", seats: 6, zone: "Main Dining", detail: "Round", status: "turning-soon", estMinutes: 18, currentParty: "Nguyen", courseStage: "Check" },
]

export const mergeOptions = [
  { tables: ["T15", "T16"], combinedSeats: 8, estTime: "~8:30" },
  { tables: ["T10", "T12"], combinedSeats: 8, estTime: "~8:45", reason: "After Chen" },
  { tables: ["T17", "T18"], combinedSeats: 6, estTime: "~8:38", reason: "Fast merge path" },
  { tables: ["T31", "T32"], combinedSeats: 10, estTime: "~8:40", reason: "Large party route" },
  { tables: ["T19", "T20"], combinedSeats: 8, estTime: "~8:50", reason: "If main dining slows" },
]

// ── Completed Today (15 parties) ─────────────────────────────────────────────

export const completedEntries: CompletedEntry[] = [
  { id: "c1", name: "Martinez", partySize: 4, joinedTime: "5:15 PM", waitedMin: 12, quotedMin: 15, withinQuote: true },
  { id: "c2", name: "Brown", partySize: 2, joinedTime: "5:30 PM", waitedMin: 8, quotedMin: 10, withinQuote: true },
  { id: "c3", name: "Davis", partySize: 3, joinedTime: "5:40 PM", waitedMin: 22, quotedMin: 20, withinQuote: false },
  { id: "c4", name: "Lee Family", partySize: 5, joinedTime: "5:50 PM", waitedMin: 18, quotedMin: 25, withinQuote: true },
  { id: "c5", name: "Johnson", partySize: 2, joinedTime: "6:00 PM", waitedMin: 5, quotedMin: 10, withinQuote: true },
  { id: "c6", name: "Nakamura", partySize: 4, joinedTime: "6:10 PM", waitedMin: 14, quotedMin: 15, withinQuote: true },
  { id: "c7", name: "Hernandez", partySize: 3, joinedTime: "6:15 PM", waitedMin: 20, quotedMin: 20, withinQuote: true },
  { id: "c8", name: "Patel", partySize: 6, joinedTime: "6:20 PM", waitedMin: 38, quotedMin: 35, withinQuote: false },
  { id: "c9", name: "O'Brien", partySize: 2, joinedTime: "6:30 PM", waitedMin: 10, quotedMin: 15, withinQuote: true },
  { id: "c10", name: "Chen", partySize: 4, joinedTime: "6:35 PM", waitedMin: 12, quotedMin: 15, withinQuote: true },
  { id: "c11", name: "Williams", partySize: 2, joinedTime: "6:40 PM", waitedMin: 7, quotedMin: 10, withinQuote: true },
  { id: "c12", name: "Kim", partySize: 3, joinedTime: "6:50 PM", waitedMin: 16, quotedMin: 20, withinQuote: true },
  { id: "c13", name: "Garcia", partySize: 4, joinedTime: "6:55 PM", waitedMin: 22, quotedMin: 25, withinQuote: true },
  { id: "c14", name: "Singh", partySize: 2, joinedTime: "7:00 PM", waitedMin: 9, quotedMin: 10, withinQuote: true },
  { id: "c15", name: "Andersen", partySize: 5, joinedTime: "7:05 PM", waitedMin: 15, quotedMin: 20, withinQuote: true },
]

// ── Removed (3 parties) ─────────────────────────────────────────────────────

export const removedEntries: RemovedEntry[] = [
  { id: "rm1", name: "Garcia", partySize: 4, time: "6:45 PM", reason: "Left after 15 min" },
  { id: "rm2", name: "Wilson", partySize: 2, time: "7:00 PM", reason: "Cancelled via SMS" },
  { id: "rm3", name: "Taylor", partySize: 6, time: "7:15 PM", reason: "No response after 45 min" },
]

// ── Quote Accuracy ───────────────────────────────────────────────────────────

export const quoteAccuracy: QuoteAccuracy = {
  totalSeated: 15,
  withinQuote: 13,
  accuracyPct: 87,
  avgOverquoteMin: 4,
  avgUnderquoteMin: 8,
  underquoteCount: 2,
  tip: "You're slightly underquoting 6-tops.",
  suggestedQuote: "Quote 45 min instead of 35 for 6+ guests",
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getElapsedMinutes(entry: WaitlistEntry): number {
  return NOW_MINUTES - entry.joinedAt
}

export function getProgressPct(entry: WaitlistEntry): number {
  const elapsed = getElapsedMinutes(entry)
  return Math.min(Math.round((elapsed / entry.quotedWait) * 100), 120)
}

export function getProgressStatus(entry: WaitlistEntry): "normal" | "warning" | "overdue" {
  const pct = getProgressPct(entry)
  if (pct >= 100) return "overdue"
  if (pct >= 70) return "warning"
  return "normal"
}

export function getLocationLabel(loc: WaitlistLocation): string {
  switch (loc) {
    case "at-restaurant": return "At restaurant"
    case "at-bar": return "At the bar"
    case "stepped-out": return "Stepped out"
    case "left-area": return "Left area"
    case "just-arrived": return "Just arrived"
    case "just-added": return "Just added"
  }
}

export function getActiveStats() {
  const parties = activeWaitlist.length
  const guests = activeWaitlist.reduce((sum, e) => sum + e.partySize, 0)
  const elapsedTimes = activeWaitlist.map(getElapsedMinutes)
  const avgWait = Math.round(elapsedTimes.reduce((a, b) => a + b, 0) / parties)
  const longestWait = Math.max(...elapsedTimes)
  return { parties, guests, avgWait, longestWait, accuracyPct: quoteAccuracy.accuracyPct }
}

/** Smart sort: prioritizes parties with ready-now matches, then by wait time ratio */
export function sortWaitlist(entries: WaitlistEntry[], mode: SortMode, elapsedOffset = 0): WaitlistEntry[] {
  const sorted = [...entries]
  const elapsedFor = (entry: WaitlistEntry) => getElapsedMinutes(entry) + elapsedOffset
  switch (mode) {
    case "smart":
      return sorted.sort((a, b) => {
        const aReady = a.bestMatch?.status === "ready-now" ? 1 : 0
        const bReady = b.bestMatch?.status === "ready-now" ? 1 : 0
        if (aReady !== bReady) return bReady - aReady
        const aRatio = elapsedFor(a) / a.quotedWait
        const bRatio = elapsedFor(b) / b.quotedWait
        return bRatio - aRatio
      })
    case "wait-time":
      return sorted.sort((a, b) => elapsedFor(b) - elapsedFor(a))
    case "party-size":
      return sorted.sort((a, b) => a.partySize - b.partySize)
    case "quoted-time": {
      return sorted.sort((a, b) => {
        const aRemaining = a.quotedWait - elapsedFor(a)
        const bRemaining = b.quotedWait - elapsedFor(b)
        return aRemaining - bRemaining
      })
    }
  }
}

/** Get AI-suggested quote based on party size and current table availability */
export function getAiQuoteEstimate(partySize: number): { minutes: number; explanation: string } {
  if (partySize <= 2) return { minutes: 15, explanation: "2 tables turning in ~8-10 min, quick seating likely" }
  if (partySize <= 4) return { minutes: 25, explanation: "3 tables turning in ~15-20 min, 1 no-show risk (may free T14 sooner)" }
  if (partySize <= 5) return { minutes: 40, explanation: "Needs 6-top or merge. T22 turning in ~35 min, merge T15+T16 at ~8:30" }
  return { minutes: 45, explanation: "Large party - limited 6-tops. T22 est. ~35 min, or merge T10+T12 at ~8:45" }
}
