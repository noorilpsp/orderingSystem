import type { Reservation } from "./reservations-data"

// ── Reservation Create/Edit Form Data ────────────────────────────────────────
//
// Availability layers (used together by the reservation form):
// 1) Global table-time fit - count of zone-eligible tables that have a long enough
//    continuous free window at each slot (`buildTimeFitMap` in reservation-form-view).
// 2) Selected-table window - `getContinuousWindowMetaForTable` for the assigned lane;
//    drives duration max and whether the chosen time works for that table only.
// 3) Restaurant capacity - seat demand from reservations overlapping the slot
//    (`getCapacityAtTime`); independent of which table is selected.
// 4) Recommendation - best table/heuristic; must use the same continuous-window + duration
//    rule as (2) so auto-assign matches “can hold this sitting” logic.
// 5) Manual table list - `computeManualTableOpeningFromContinuousWindow` uses the same
//    continuous-window + duration rule as (2)/(4); “opening soon” walks block ends /
//    next holds, not overlap with [slot, slot+duration] only.
// 6) UI tone - slot list colors: global fit (open/busy/tight/short/full) and capacity %;
//    selected-table mismatch is a separate inline hint, not mixed into the global fit bar.

export interface GuestProfile {
  id: string
  name: string
  phone: string
  email: string
  visitCount: number
  lastVisit: string | null
  avgSpend: number
  allergies: string[]
  preferences: string[]
  tags: string[]
  noShowCount: number
  totalReservations: number
}

export interface AvailableTable {
  id: string
  label: string
  seats: number
  zone: string
  zoneLabel: string
  server: string
  features: string[]
  availableFrom: string
  availableUntil: string
  matchScore: number
  matchReasons: string[]
  avoidReasons?: string[]
}

export interface BusyTable {
  id: string
  label: string
  guest: string
  time: string
  partySize: number
  reason: string
}

export interface CapacitySnapshot {
  time: string
  label: string
  occupancyPct: number
  seatsOccupied: number
  totalSeats: number
}

export interface TimeSlotStatus {
  time: string
  label: string
  status: "available" | "busy" | "full" | "closed"
}

export interface ConflictWarning {
  id: string
  type: "buffer" | "risk" | "info" | "merge"
  severity: "warning" | "info"
  message: string
  suggestion?: string
}

export type FormTag =
  | "vip"
  | "birthday"
  | "anniversary"
  | "allergy"
  | "highchair"
  | "accessible"
  | "service-dog"
  | "business"
  | "celebration"
  | "high-value"
  | "first-timer"

export interface FormTagDef {
  id: FormTag
  label: string
  icon: string
  triggersField?: "allergy-detail" | "date-detail" | "quantity" | "accessible-filter"
}

export type TableAssignMode = "auto" | "manual" | "unassigned"

export type BookingChannel = "direct" | "phone" | "website" | "google" | "opentable" | "instagram" | "app" | "concierge"

export interface ReservationFormData {
  guestName: string
  guestId: string | null
  phone: string
  email: string
  date: string
  time: string
  partySize: number
  duration: number
  tableAssignMode: TableAssignMode
  assignedTable: string | null
  zonePreference: string
  tags: FormTag[]
  allergyDetail: string
  notes: string
  sendSms: boolean
  sendEmail: boolean
  requireDeposit: boolean
  depositAmount: string
  addToCalendar: boolean
  channel: BookingChannel
}

export interface EditModeData {
  reservationId: string
  createdAt: string
  createdVia: string
  lastModified: string | null
  lastModifiedNote: string | null
  originalTime: string | null
}

// ── Tag Definitions ──────────────────────────────────────────────────────────

export const formTagDefs: FormTagDef[] = [
  { id: "vip", label: "VIP", icon: "Star" },
  { id: "birthday", label: "Birthday", icon: "Cake", triggersField: "date-detail" },
  { id: "anniversary", label: "Anniversary", icon: "Heart", triggersField: "date-detail" },
  { id: "allergy", label: "Allergy", icon: "ShieldAlert", triggersField: "allergy-detail" },
  { id: "highchair", label: "Highchair", icon: "Baby", triggersField: "quantity" },
  { id: "accessible", label: "Accessible", icon: "Accessibility", triggersField: "accessible-filter" },
  { id: "service-dog", label: "Service Dog", icon: "Dog" },
  { id: "business", label: "Business", icon: "Briefcase" },
  { id: "celebration", label: "Celebration", icon: "PartyPopper" },
  { id: "high-value", label: "High-value", icon: "Crown" },
  { id: "first-timer", label: "First-timer", icon: "Sparkles" },
]

export const bookingChannels: { value: BookingChannel; label: string }[] = [
  { value: "direct", label: "Direct / Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "website", label: "Website" },
  { value: "google", label: "Google" },
  { value: "opentable", label: "OpenTable" },
  { value: "instagram", label: "Instagram" },
  { value: "app", label: "App" },
  { value: "concierge", label: "Concierge" },
]

// ── Guest Database (10 profiles) ─────────────────────────────────────────────

export const guestDatabase: GuestProfile[] = [
  {
    id: "g1",
    name: "Sarah Chen",
    phone: "+1 (555) 234-5678",
    email: "sarah@email.com",
    visitCount: 12,
    lastVisit: "Jan 3, 2025",
    avgSpend: 220,
    allergies: ["Shellfish"],
    preferences: ["Window seat", "Old Fashioned cocktail"],
    tags: ["vip", "high-value"],
    noShowCount: 0,
    totalReservations: 12,
  },
  {
    id: "g2",
    name: "Marcus Webb",
    phone: "+1 (555) 876-5432",
    email: "marcus.w@email.com",
    visitCount: 1,
    lastVisit: "Dec 28, 2024",
    avgSpend: 85,
    allergies: [],
    preferences: [],
    tags: ["first-timer"],
    noShowCount: 0,
    totalReservations: 1,
  },
  {
    id: "g3",
    name: "Nguyen Family",
    phone: "+1 (555) 345-6789",
    email: "nguyen.fam@email.com",
    visitCount: 8,
    lastVisit: "Jan 10, 2025",
    avgSpend: 180,
    allergies: ["Nut allergy"],
    preferences: ["Quiet area", "Birthday celebrations"],
    tags: ["birthday"],
    noShowCount: 0,
    totalReservations: 8,
  },
  {
    id: "g4",
    name: "Jake Morrison",
    phone: "+1 (555) 987-6543",
    email: "jake.m@email.com",
    visitCount: 3,
    lastVisit: "Dec 15, 2024",
    avgSpend: 65,
    allergies: [],
    preferences: [],
    tags: [],
    noShowCount: 2,
    totalReservations: 5,
  },
  {
    id: "g5",
    name: "Claire Dubois",
    phone: "+1 (555) 456-7890",
    email: "claire.d@email.com",
    visitCount: 5,
    lastVisit: "Jan 8, 2025",
    avgSpend: 95,
    allergies: [],
    preferences: ["Lunch regular"],
    tags: [],
    noShowCount: 0,
    totalReservations: 5,
  },
  {
    id: "g6",
    name: "Kim Family",
    phone: "+1 (555) 567-8901",
    email: "kim.family@email.com",
    visitCount: 15,
    lastVisit: "Jan 14, 2025",
    avgSpend: 165,
    allergies: [],
    preferences: ["Corner booth"],
    tags: ["vip", "high-value"],
    noShowCount: 0,
    totalReservations: 15,
  },
  {
    id: "g7",
    name: "Yusuf Ali",
    phone: "+1 (555) 678-9012",
    email: "yusuf.ali@email.com",
    visitCount: 2,
    lastVisit: "Jan 5, 2025",
    avgSpend: 75,
    allergies: [],
    preferences: [],
    tags: [],
    noShowCount: 0,
    totalReservations: 2,
  },
  {
    id: "g8",
    name: "James Anderson",
    phone: "+1 (555) 789-0123",
    email: "j.anderson@email.com",
    visitCount: 6,
    lastVisit: "Jan 11, 2025",
    avgSpend: 310,
    allergies: [],
    preferences: ["Celebrates frequently", "Prefers champagne"],
    tags: ["high-value", "celebration"],
    noShowCount: 0,
    totalReservations: 6,
  },
  {
    id: "g9",
    name: "Sofia Rivera",
    phone: "+1 (555) 890-1234",
    email: "sofia.r@email.com",
    visitCount: 4,
    lastVisit: "Jan 2, 2025",
    avgSpend: 190,
    allergies: [],
    preferences: ["Anniversary couple", "Romantic setting"],
    tags: ["anniversary"],
    noShowCount: 0,
    totalReservations: 4,
  },
  {
    id: "g10",
    name: "Raj Patel",
    phone: "+1 (555) 901-2345",
    email: "raj.p@email.com",
    visitCount: 7,
    lastVisit: "Jan 13, 2025",
    avgSpend: 145,
    allergies: [],
    preferences: ["Vegetarian preference"],
    tags: [],
    noShowCount: 0,
    totalReservations: 7,
  },
]

// ── Available Tables for 7:30 PM ─────────────────────────────────────────────

export const availableTables: AvailableTable[] = [
  {
    id: "T12",
    label: "T12",
    seats: 4,
    zone: "main",
    zoneLabel: "Main Dining",
    server: "Mike",
    features: ["Window"],
    availableFrom: "7:25 PM",
    availableUntil: "Close",
    matchScore: 98,
    matchReasons: [
      "Matches party size (4-top)",
      "Guest's preferred spot (window)",
      "Available 7:30 - 9:30+",
      "Server Mike (familiar with guest)",
    ],
  },
  {
    id: "T7",
    label: "T7",
    seats: 4,
    zone: "main",
    zoneLabel: "Main Dining",
    server: "Anna",
    features: [],
    availableFrom: "7:30 PM",
    availableUntil: "9:15 PM",
    matchScore: 82,
    matchReasons: [
      "Matches party size (4-top)",
      "Available at requested time",
    ],
  },
  {
    id: "T14",
    label: "T14",
    seats: 4,
    zone: "main",
    zoneLabel: "Main Dining",
    server: "Lisa",
    features: [],
    availableFrom: "5:00 PM",
    availableUntil: "Close",
    matchScore: 78,
    matchReasons: [
      "Matches party size (4-top)",
      "Open all evening",
    ],
  },
  {
    id: "T20",
    label: "T20",
    seats: 4,
    zone: "patio",
    zoneLabel: "Patio",
    server: "Carlos",
    features: ["Outdoor"],
    availableFrom: "7:30 PM",
    availableUntil: "Close",
    matchScore: 65,
    matchReasons: [
      "Matches party size (4-top)",
      "Outdoor seating",
    ],
  },
  {
    id: "T25",
    label: "T25",
    seats: 4,
    zone: "private",
    zoneLabel: "Private Room",
    server: "Jordan",
    features: ["Private"],
    availableFrom: "7:30 PM",
    availableUntil: "9:00 PM",
    matchScore: 55,
    matchReasons: [
      "Matches party size (4-top)",
      "Private dining option",
    ],
  },
]

// ── Busy Tables ──────────────────────────────────────────────────────────────

export const busyTables: BusyTable[] = [
  { id: "T8", label: "T8+T9", guest: "O'Brien", time: "7:00 PM", partySize: 6, reason: "Birthday party (6p)" },
  { id: "T22", label: "T22", guest: "Williams", time: "6:30 PM", partySize: 2, reason: "Booked until 8:30" },
  { id: "T1", label: "T1", guest: "Williams", time: "6:00 PM", partySize: 2, reason: "Dessert stage" },
  { id: "T3", label: "T3", guest: "Jensen", time: "6:15 PM", partySize: 4, reason: "Finishing up" },
  { id: "T16", label: "T16", guest: "Nguyen", time: "7:00 PM", partySize: 6, reason: "Mains served" },
]

// ── Capacity Timeline ────────────────────────────────────────────────────────

export const capacityTimeline: CapacitySnapshot[] = [
  { time: "17:00", label: "5:00 PM", occupancyPct: 12, seatsOccupied: 9, totalSeats: 78 },
  { time: "17:30", label: "5:30 PM", occupancyPct: 18, seatsOccupied: 14, totalSeats: 78 },
  { time: "18:00", label: "6:00 PM", occupancyPct: 45, seatsOccupied: 35, totalSeats: 78 },
  { time: "18:30", label: "6:30 PM", occupancyPct: 72, seatsOccupied: 56, totalSeats: 78 },
  { time: "19:00", label: "7:00 PM", occupancyPct: 88, seatsOccupied: 69, totalSeats: 78 },
  { time: "19:30", label: "7:30 PM", occupancyPct: 80, seatsOccupied: 62, totalSeats: 78 },
  { time: "20:00", label: "8:00 PM", occupancyPct: 100, seatsOccupied: 78, totalSeats: 78 },
  { time: "20:30", label: "8:30 PM", occupancyPct: 92, seatsOccupied: 72, totalSeats: 78 },
  { time: "21:00", label: "9:00 PM", occupancyPct: 75, seatsOccupied: 58, totalSeats: 78 },
  { time: "21:30", label: "9:30 PM", occupancyPct: 52, seatsOccupied: 41, totalSeats: 78 },
  { time: "22:00", label: "10:00 PM", occupancyPct: 30, seatsOccupied: 23, totalSeats: 78 },
]

// ── Time Slot Statuses ───────────────────────────────────────────────────────

export const timeSlots: TimeSlotStatus[] = [
  { time: "17:00", label: "5:00 PM", status: "available" },
  { time: "17:15", label: "5:15 PM", status: "available" },
  { time: "17:30", label: "5:30 PM", status: "available" },
  { time: "17:45", label: "5:45 PM", status: "available" },
  { time: "18:00", label: "6:00 PM", status: "available" },
  { time: "18:15", label: "6:15 PM", status: "available" },
  { time: "18:30", label: "6:30 PM", status: "busy" },
  { time: "18:45", label: "6:45 PM", status: "busy" },
  { time: "19:00", label: "7:00 PM", status: "busy" },
  { time: "19:15", label: "7:15 PM", status: "busy" },
  { time: "19:30", label: "7:30 PM", status: "busy" },
  { time: "19:45", label: "7:45 PM", status: "busy" },
  { time: "20:00", label: "8:00 PM", status: "full" },
  { time: "20:15", label: "8:15 PM", status: "full" },
  { time: "20:30", label: "8:30 PM", status: "busy" },
  { time: "20:45", label: "8:45 PM", status: "busy" },
  { time: "21:00", label: "9:00 PM", status: "available" },
  { time: "21:15", label: "9:15 PM", status: "available" },
  { time: "21:30", label: "9:30 PM", status: "available" },
  { time: "21:45", label: "9:45 PM", status: "available" },
  { time: "22:00", label: "10:00 PM", status: "available" },
  { time: "22:15", label: "10:15 PM", status: "closed" },
  { time: "22:30", label: "10:30 PM", status: "closed" },
]

// ── Mini Timeline Data ───────────────────────────────────────────────────────

export interface MiniTimelineEntry {
  tableLabel: string
  blocks: { guest: string; startMin: number; endMin: number; isNew?: boolean }[]
}

export const miniTimeline: MiniTimelineEntry[] = [
  {
    tableLabel: "T12",
    blocks: [
      { guest: "Patel", startMin: 0, endMin: 55 },
      { guest: "Chen", startMin: 60, endMin: 150, isNew: true },
    ],
  },
  {
    tableLabel: "T7",
    blocks: [
      { guest: "Kim", startMin: 0, endMin: 50 },
      { guest: "Garcia", startMin: 70, endMin: 150 },
    ],
  },
  {
    tableLabel: "T14",
    blocks: [
      { guest: "Morrison?", startMin: 50, endMin: 140 },
    ],
  },
]
// timeline starts at 7:00 PM (420 min), each entry relative from 0
export const MINI_TL_START = 420 // 7:00 PM in minutes
export const MINI_TL_END = 570 // 9:30 PM in minutes
export const MINI_TL_RANGE = MINI_TL_END - MINI_TL_START // 150 min
export const MINI_TL_NOW_OFFSET = 30 // 7:30 PM = 30 min from start

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map API customer shape to GuestProfile. Enrichment fields use safe defaults. */
function customerToGuestProfile(c: {
  id: string
  name: string | null
  phone: string | null
  email: string | null
}): GuestProfile {
  return {
    id: c.id,
    name: c.name?.trim() || "Guest",
    phone: c.phone ?? "",
    email: c.email ?? "",
    visitCount: 0,
    lastVisit: null,
    avgSpend: 0,
    allergies: [],
    preferences: [],
    tags: [],
    noShowCount: 0,
    totalReservations: 0,
  }
}

/**
 * Search customers via API and map to GuestProfile.
 * Returns real guest data when locationId is set and API succeeds.
 */
export async function searchCustomersAsGuests(
  locationId: string,
  query: string
): Promise<GuestProfile[]> {
  if (!query || query.trim().length < 2) return []
  const q = encodeURIComponent(query.trim())
  const res = await fetch(`/api/customers?locationId=${encodeURIComponent(locationId)}&q=${q}`)
  if (!res.ok) return []
  const data = await res.json().catch(() => [])
  const list = Array.isArray(data) ? data : []
  return list.map(customerToGuestProfile)
}

/** Build a minimal GuestProfile from reservation prefill. Use when no richer source exists. */
export function guestProfileFromPrefill(p: {
  guestId: string
  guestName?: string
  phone?: string
  email?: string
  visitCount?: number
  noShowCount?: number
  totalReservations?: number
}): GuestProfile {
  const totalRes = p.totalReservations ?? 0
  return {
    id: p.guestId,
    name: p.guestName?.trim() || "Guest",
    phone: p.phone ?? "",
    email: p.email ?? "",
    visitCount: p.visitCount ?? 0,
    lastVisit: null,
    avgSpend: 0,
    allergies: [],
    preferences: [],
    tags: [],
    noShowCount: p.noShowCount ?? 0,
    totalReservations: totalRes,
  }
}

/** Build GuestProfile from StoreReservation. Uses customerProfile when available; otherwise minimal from reservation fields. */
export function guestProfileFromStoreReservation(sr: {
  customerId?: string
  guestName: string
  phone?: string
  email?: string
  visitCount?: number
  customerProfile?: {
    totalVisits?: number
    lastVisit?: string | null
    avgSpend?: number
    noShowCount?: number
    cancelCount?: number
    preferences?: string
    favoriteItems?: string[]
  } | null
}): GuestProfile {
  const cp = sr.customerProfile
  const id = sr.customerId ?? sr.guestName?.toLowerCase().replace(/\s+/g, "-") ?? "guest"
  const visitCount = cp?.totalVisits ?? sr.visitCount ?? 0
  return {
    id,
    name: sr.guestName?.trim() || "Guest",
    phone: sr.phone ?? "",
    email: sr.email ?? "",
    visitCount,
    lastVisit: cp?.lastVisit ?? null,
    avgSpend: cp?.avgSpend ?? 0,
    allergies: [],
    preferences: cp?.preferences ? cp.preferences.split(/[,;]/).map((p) => p.trim()).filter(Boolean) : [],
    tags: [],
    noShowCount: cp?.noShowCount ?? 0,
    totalReservations: visitCount,
  }
}

/**
 * Local guest search. Returns empty in production-prefer searchCustomersAsGuests (API).
 * Kept for backward compatibility; callers should use API when locationId is available.
 */
export function searchGuests(_query: string): GuestProfile[] {
  return []
}

export function getDurationForParty(size: number): number {
  if (size <= 2) return 75
  if (size <= 4) return 90
  if (size <= 6) return 105
  return 120
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export function getConflictsForSelection(
  time: string,
  tableId: string | null,
  partySize: number,
  guest: GuestProfile | null
): ConflictWarning[] {
  const warnings: ConflictWarning[] = []

  if (tableId === "T12" && time === "19:30") {
    warnings.push({
      id: "c1",
      type: "buffer",
      severity: "warning",
      message: "T12 has a reservation ending at 7:25. There's only a 5-minute buffer.",
      suggestion: "Consider 7:45 PM or a different table.",
    })
  }

  if (guest && guest.noShowCount >= 2) {
    const noShowRate = Math.round((guest.noShowCount / guest.totalReservations) * 100)
    warnings.push({
      id: "c2",
      type: "risk",
      severity: "warning",
      message: `This guest has ${guest.noShowCount} no-shows out of ${guest.totalReservations} reservations (${noShowRate}% no-show rate). Consider requiring a deposit.`,
    })
  }

  if (guest && !guest.visitCount) {
    const dayOfWeek = "Friday"
    if (dayOfWeek === "Friday" && partySize >= 6) {
      warnings.push({
        id: "c3",
        type: "risk",
        severity: "warning",
        message: `First-time guest booking for a Friday ${time} ${partySize}-top. Historical no-show risk: 23%. Consider requiring deposit.`,
      })
    }
  }

  if (partySize >= 7) {
    warnings.push({
      id: "c5",
      type: "merge",
      severity: "info",
      message: `Party of ${partySize} requires merging tables. Options: T8+T9, T15+T16, T23+T24`,
    })
  }

  return warnings
}

export function getRiskLevel(guest: GuestProfile | null): { level: "low" | "medium" | "high"; label: string; color: string } {
  if (!guest) return { level: "medium", label: "Unknown", color: "text-amber-400" }
  if (guest.noShowCount >= 2) return { level: "high", label: "High", color: "text-red-400" }
  if (guest.visitCount <= 1) return { level: "medium", label: "Medium", color: "text-amber-400" }
  return { level: "low", label: "Low", color: "text-emerald-400" }
}

/** Statuses that do not consume seats for capacity / table blocking. */
const RESERVATION_EXCLUDED_FROM_DEMAND = new Set<string>(["cancelled", "no-show", "completed"])

/**
 * True when a reservation row belongs to the same calendar day as the form date (YYYY-MM-DD).
 * Handles plain date strings, full ISO timestamps, and minor format drift.
 */
/** True if the global fit snapshot says at least one table can host the party at this slot (full or partial window). */
export function isTimeSlotGloballyViable(fit: { available: number; tone: string } | undefined): boolean {
  if (!fit) return false
  return fit.available > 0 || fit.tone === "short"
}

export function reservationMatchesServiceDate(reservationDateRaw: string | undefined, selectedDate: string): boolean {
  const sel = selectedDate.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sel)) return false
  if (reservationDateRaw == null || !String(reservationDateRaw).trim()) return false
  const raw = String(reservationDateRaw).trim()
  const prefix = raw.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(prefix) && prefix === sel) return true
  const ts = Date.parse(raw)
  if (!Number.isNaN(ts)) {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}` === sel
  }
  return false
}

function parseHhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

function addMinutesToHhmm(start: string, delta: number): string {
  const base = parseHhmmToMinutes(start)
  if (!Number.isFinite(base)) return start
  const normalized = ((base + delta) % (24 * 60) + (24 * 60)) % (24 * 60)
  const h = Math.floor(normalized / 60).toString().padStart(2, "0")
  const mm = (normalized % 60).toString().padStart(2, "0")
  return `${h}:${mm}`
}

export type ReservationBlockingWindow = { startTime: string; endTime: string }

/**
 * Blocking intervals for manual table pick / fit math, scoped to one service date.
 * Uses store/API reservations only (not timeline demo blocks).
 */
export function getBlockingWindowsFromReservations(
  reservations: Reservation[],
  tableId: string,
  selectedDate: string
): ReservationBlockingWindow[] {
  return reservations
    .filter((r) => r.table === tableId && reservationMatchesServiceDate(r.date, selectedDate))
    .filter((r) => !RESERVATION_EXCLUDED_FROM_DEMAND.has(r.status))
    .map((r) => {
      const startTime = r.time
      const endTime =
        r.endTime ?? addMinutesToHhmm(startTime, r.durationMinutes ?? getDurationForParty(r.partySize))
      return { startTime, endTime }
    })
}

/** Service period bounds for reservation availability math (HH:MM, 24h or as stored). */
export type ReservationServicePeriodLike = { id: string; start: string; end: string }

const DEFAULT_RESERVATION_SERVICE_PERIODS: ReservationServicePeriodLike[] = [
  { id: "dinner", start: "17:00", end: "23:00" },
]

/** Parse reservation form / picker times (12h or 24h, including 24:00 end-of-day). */
export function parseReservationFormTimeToMinutes(timeValue: string): number {
  const raw = timeValue.trim()
  if (!raw) return Number.NaN

  const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (match12) {
    let h = Number.parseInt(match12[1], 10)
    const m = Number.parseInt(match12[2], 10)
    if (h < 1 || h > 12 || m < 0 || m > 59) return Number.NaN
    const meridiem = match12[3].toUpperCase()
    if (meridiem === "AM") h = h % 12
    else h = (h % 12) + 12
    return h * 60 + m
  }

  const match24 = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match24) return Number.NaN

  const h = Number.parseInt(match24[1], 10)
  const m = Number.parseInt(match24[2], 10)
  if (h === 24 && m === 0) return 24 * 60
  if (h < 0 || h > 23 || m < 0 || m > 59) return Number.NaN
  return h * 60 + m
}

function formatReservationMinutesAsTime24(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(normalized / 60).toString().padStart(2, "0")
  const m = (normalized % 60).toString().padStart(2, "0")
  return `${h}:${m}`
}

function normalizeReservationBlockWindow(
  blockStart: number,
  blockEnd: number,
  anchor: number
): { start: number; end: number } {
  let start = blockStart
  let end = blockEnd
  if (end <= start) end += 24 * 60
  while (end <= anchor) {
    start += 24 * 60
    end += 24 * 60
  }
  return { start, end }
}

function getReservationServiceBoundsMinutes(
  time: string,
  servicePeriodId?: string,
  servicePeriods?: ReservationServicePeriodLike[]
): { start: number; end: number } {
  const periods =
    (servicePeriods?.length ?? 0) > 0 ? (servicePeriods ?? []) : DEFAULT_RESERVATION_SERVICE_PERIODS
  if (servicePeriodId) {
    const forcedPeriod = periods.find((period) => period.id === servicePeriodId)
    if (forcedPeriod) {
      const start = parseReservationFormTimeToMinutes(forcedPeriod.start)
      let end = parseReservationFormTimeToMinutes(forcedPeriod.end)
      if (end <= start) end += 24 * 60
      return { start, end }
    }
  }

  const selectedMin = parseReservationFormTimeToMinutes(time)
  const matching = periods
    .map((period) => {
      const start = parseReservationFormTimeToMinutes(period.start)
      let end = parseReservationFormTimeToMinutes(period.end)
      if (end <= start) end += 24 * 60
      let selected = selectedMin
      if (selected < start) selected += 24 * 60
      if (selected >= start && selected < end) return { start, end }
      return undefined
    })
    .find((value): value is { start: number; end: number } => typeof value !== "undefined")

  if (matching) return matching

  const fallback = periods.find((period) => period.id === "dinner") ?? periods[0]
  const fallbackStart = parseReservationFormTimeToMinutes(fallback.start)
  let fallbackEnd = parseReservationFormTimeToMinutes(fallback.end)
  if (fallbackEnd <= fallbackStart) fallbackEnd += 24 * 60
  return { start: fallbackStart, end: fallbackEnd }
}

/**
 * Continuous free minutes from `startTime` until service end or the next reservation hold
 * on this table (same rule as global fit / best-table / duration checks).
 */
export function getContinuousWindowMetaForTable(
  tableId: string,
  startTime: string,
  servicePeriodId: string | undefined,
  selectedDate: string | undefined,
  tableLanes: { id: string; label: string }[] | undefined,
  servicePeriods: ReservationServicePeriodLike[] | undefined,
  reservations: Reservation[]
): {
  availableMinutes: number
  boundaryKind: "none" | "service-end" | "next-reservation"
  boundaryTime?: string
  tableLabel: string
} {
  const selectedStart = parseReservationFormTimeToMinutes(startTime)
  const tableLabel = tableLanes?.find((lane) => lane.id === tableId)?.label ?? tableId
  if (!Number.isFinite(selectedStart)) {
    return {
      availableMinutes: 0,
      boundaryKind: "none",
      tableLabel,
    }
  }

  const normalize = (value: number): number => {
    let normalized = value
    while (normalized <= selectedStart) normalized += 24 * 60
    return normalized
  }

  const blockingWindows =
    selectedDate && selectedDate.length > 0
      ? getBlockingWindowsFromReservations(reservations, tableId, selectedDate)
      : []

  const hasOverlapAtStart = blockingWindows.some((window) => {
    const rawStart = parseReservationFormTimeToMinutes(window.startTime)
    const rawEnd = parseReservationFormTimeToMinutes(window.endTime)
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return false
    const { start, end } = normalizeReservationBlockWindow(rawStart, rawEnd, selectedStart)
    return selectedStart >= start && selectedStart < end
  })
  if (hasOverlapAtStart) {
    return {
      availableMinutes: 0,
      boundaryKind: "next-reservation",
      tableLabel,
    }
  }

  let serviceEnd = getReservationServiceBoundsMinutes(startTime, servicePeriodId, servicePeriods).end
  while (serviceEnd <= selectedStart) serviceEnd += 24 * 60

  const nextReservationStart = blockingWindows
    .map((window) => {
      const rawStart = parseReservationFormTimeToMinutes(window.startTime)
      if (!Number.isFinite(rawStart)) return undefined
      return normalize(rawStart)
    })
    .filter((start): start is number => typeof start === "number")
    .filter((start) => start > selectedStart)
    .sort((a, b) => a - b)[0]

  const boundaryCandidates: Array<{ minute: number; kind: "service-end" | "next-reservation" }> = [
    { minute: serviceEnd, kind: "service-end" },
  ]
  if (typeof nextReservationStart === "number") {
    boundaryCandidates.push({ minute: nextReservationStart, kind: "next-reservation" })
  }

  const earliestBoundary = boundaryCandidates.sort((a, b) => a.minute - b.minute)[0]
  const availableMinutes = Math.max(0, earliestBoundary.minute - selectedStart)

  return {
    availableMinutes,
    boundaryKind: earliestBoundary.kind,
    boundaryTime: formatReservationMinutesAsTime24(earliestBoundary.minute),
    tableLabel,
  }
}

/**
 * Manual table list: same “can host `duration` from a contiguous free window” rule as
 * `getContinuousWindowMetaForTable`. When the slot cannot be hosted, estimates the earliest
 * later start (within the service window) by walking block ends / next holds - not interval
 * overlap with [slot, slot+duration] alone.
 */
export function computeManualTableOpeningFromContinuousWindow(
  tableId: string,
  selectedTime: string,
  durationMinutes: number,
  selectedDate: string,
  reservations: Reservation[],
  servicePeriodId: string | undefined,
  servicePeriods: ReservationServicePeriodLike[] | undefined,
  tableLanes: { id: string; label: string }[] | undefined
): {
  canHostFullDuration: boolean
  openingInMin: number
  nextAvailable?: string
  availableMinutesAtSlot: number
  tableLabel: string
} {
  const dateKey = selectedDate.trim()
  const meta = getContinuousWindowMetaForTable(
    tableId,
    selectedTime,
    servicePeriodId,
    dateKey.length > 0 ? dateKey : undefined,
    tableLanes,
    servicePeriods,
    reservations
  )
  const anchor = parseReservationFormTimeToMinutes(selectedTime)
  if (!Number.isFinite(anchor)) {
    return {
      canHostFullDuration: false,
      openingInMin: 24 * 60,
      availableMinutesAtSlot: meta.availableMinutes,
      tableLabel: meta.tableLabel,
    }
  }

  if (meta.availableMinutes >= durationMinutes) {
    return {
      canHostFullDuration: true,
      openingInMin: 0,
      availableMinutesAtSlot: meta.availableMinutes,
      tableLabel: meta.tableLabel,
    }
  }

  const windows =
    dateKey.length > 0
      ? getBlockingWindowsFromReservations(reservations, tableId, dateKey)
      : []

  const extWindows = windows
    .map((w) => {
      const rawS = parseReservationFormTimeToMinutes(w.startTime)
      const rawE = parseReservationFormTimeToMinutes(w.endTime)
      if (!Number.isFinite(rawS) || !Number.isFinite(rawE)) return undefined
      return normalizeReservationBlockWindow(rawS, rawE, anchor)
    })
    .filter((w): w is { start: number; end: number } => w != null)

  let serviceEnd = getReservationServiceBoundsMinutes(selectedTime, servicePeriodId, servicePeriods).end
  while (serviceEnd <= anchor) serviceEnd += 24 * 60

  let t = anchor
  for (let iter = 0; iter < 48; iter++) {
    let svcEnd = serviceEnd
    while (svcEnd <= t) svcEnd += 24 * 60

    const covering = extWindows.filter((w) => t >= w.start && t < w.end)
    if (covering.length > 0) {
      t = Math.max(...covering.map((w) => w.end))
      continue
    }

    const nextStart = extWindows
      .map((w) => w.start)
      .filter((s) => s > t)
      .sort((a, b) => a - b)[0]
    const boundary = typeof nextStart === "number" ? Math.min(svcEnd, nextStart) : svcEnd
    const avail = Math.max(0, boundary - t)
    if (avail >= durationMinutes) {
      return {
        canHostFullDuration: false,
        openingInMin: Math.max(0, t - anchor),
        nextAvailable: formatReservationMinutesAsTime24(t),
        availableMinutesAtSlot: meta.availableMinutes,
        tableLabel: meta.tableLabel,
      }
    }
    if (boundary >= svcEnd) {
      break
    }
    const blockingAtBoundary = extWindows.find((w) => w.start === boundary)
    t = blockingAtBoundary ? blockingAtBoundary.end : boundary
  }

  return {
    canHostFullDuration: false,
    openingInMin: 24 * 60,
    availableMinutesAtSlot: meta.availableMinutes,
    tableLabel: meta.tableLabel,
  }
}

export function getCapacityAtTime(
  time: string,
  options?: { totalSeats?: number; selectedDate?: string; reservations?: Reservation[] }
): CapacitySnapshot | undefined {
  const toLabel = (hhmm: string): string => {
    const [h, m] = hhmm.split(":").map(Number)
    const hour12 = h % 12 === 0 ? 12 : h % 12
    const suffix = h >= 12 ? "PM" : "AM"
    return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`
  }

  const totalSeats = options?.totalSeats
  if (totalSeats == null || totalSeats <= 0) return undefined
  const selectedDate = options?.selectedDate
  const reservations = options?.reservations ?? []
  const target = parseHhmmToMinutes(time)
  if (!Number.isFinite(target)) return undefined

  if (!selectedDate) {
    return {
      time,
      label: toLabel(time),
      occupancyPct: 0,
      seatsOccupied: 0,
      totalSeats,
    }
  }

  const activeSeatDemand = reservations
    .filter((r) => reservationMatchesServiceDate(r.date, selectedDate))
    .filter((r) => !RESERVATION_EXCLUDED_FROM_DEMAND.has(r.status))
    .filter((r) => {
      const start = parseHhmmToMinutes(r.time)
      let end = parseHhmmToMinutes(r.endTime ?? addMinutesToHhmm(r.time, r.durationMinutes ?? getDurationForParty(r.partySize)))
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false
      if (end <= start) end += 24 * 60
      let point = target
      if (point < start) point += 24 * 60
      return point >= start && point < end
    })
    .reduce((sum, r) => sum + r.partySize, 0)

  const seatsOccupied = Math.min(totalSeats, Math.max(0, activeSeatDemand))
  const occupancyPct = Math.round((seatsOccupied / totalSeats) * 100)

  return {
    time,
    label: toLabel(time),
    occupancyPct,
    seatsOccupied,
    totalSeats,
  }
}

export function getFilteredTables(
  zonePreference: string,
  partySize: number
): AvailableTable[] {
  return availableTables
    .filter((t) => {
      if (zonePreference && zonePreference !== "any" && t.zone !== zonePreference) return false
      if (t.seats < partySize) return false
      return true
    })
    .sort((a, b) => b.matchScore - a.matchScore)
}

// ── Edit mode sample data ────────────────────────────────────────────────────

export const sampleEditData: EditModeData = {
  reservationId: "r9",
  createdAt: "Jan 15, 2025 at 2:34 PM",
  createdVia: "Direct",
  lastModified: "Jan 16, 2025 at 10:15 AM",
  lastModifiedNote: "Time changed from 7:00 to 7:30",
  originalTime: "19:00",
}

/** Base defaults; date is overridden at init with today when creating. */
export const defaultFormData: ReservationFormData = {
  guestName: "",
  guestId: null,
  phone: "",
  email: "",
  date: "", // Replaced with today's ISO at form init when creating
  time: "19:30",
  partySize: 4,
  duration: 90,
  tableAssignMode: "auto",
  assignedTable: null,
  zonePreference: "any",
  tags: [],
  allergyDetail: "",
  notes: "",
  sendSms: true,
  sendEmail: true,
  requireDeposit: false,
  depositAmount: "",
  addToCalendar: false,
  channel: "direct",
}

export const editFormData: ReservationFormData = {
  guestName: "Sarah Chen",
  guestId: "g1",
  phone: "+1 (555) 234-5678",
  email: "sarah@email.com",
  date: "2025-01-17",
  time: "19:30",
  partySize: 4,
  duration: 90,
  tableAssignMode: "auto",
  assignedTable: "T12",
  zonePreference: "any",
  tags: ["vip", "allergy"],
  allergyDetail: "Shellfish",
  notes: "Window seat preferred. 12th visit, prefers Old Fashioned cocktail.",
  sendSms: true,
  sendEmail: true,
  requireDeposit: false,
  depositAmount: "",
  addToCalendar: false,
  channel: "direct",
}
