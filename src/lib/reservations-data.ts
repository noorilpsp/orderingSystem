// ── Reservations Dashboard Data ──────────────────────────────────────────────

import { useMemo } from "react"
import { useRestaurantStore } from "@/store/restaurantStore"
import type { StoreReservation, StoreTable, WaitlistEntry as StoreWaitlistEntry } from "@/store/types"

export type ReservationStatus =
  | "confirmed"
  | "seated"
  | "completed"
  | "no-show"
  | "cancelled"
  | "late"

export type RiskLevel = "low" | "medium" | "high"

export type ServicePeriod = "breakfast" | "lunch" | "dinner" | "brunch" | "half-day" | "all-day"

export type TagType =
  | "vip"
  | "first-timer"
  | "birthday"
  | "anniversary"
  | "allergy"
  | "high-value"
  | "wheelchair"
  | "window"

export interface GuestTag {
  type: TagType
  label: string
  detail?: string
}

export interface Reservation {
  id: string
  customerId?: string
  guestName: string
  partySize: number
  time: string // "HH:MM" format
  date?: string // ISO date "YYYY-MM-DD" when from store
  /** End of hold window (HH:MM). When absent, derived from durationMinutes / party default. */
  endTime?: string
  /** Planned sitting length in minutes (from store). */
  durationMinutes?: number
  status: ReservationStatus
  risk: RiskLevel
  riskScore?: number // percentage for high-risk
  table: string | null // e.g., "T12" or null for unassigned
  tags: GuestTag[]
  notes?: string
  visitCount?: number
  bookedVia?: string
  confirmationSent?: boolean
  phone?: string
}

export interface WaitlistParty {
  id: string
  name: string
  partySize: number
  quotedWait: number // minutes
  elapsedWait: number // minutes
  autoMatch?: string // predicted table
  autoMatchTime?: number // minutes until available
  barTab?: number // dollar amount
  notes?: string
}

export type CourseStage =
  | "ordering"
  | "appetizers"
  | "mains-fired"
  | "mains-served"
  | "dessert"
  | "check-requested"
  | "check-printed"
  | "paying"

export interface OccupiedTable {
  id: string
  tableNumber: string
  partySize: number
  courseStage: CourseStage
  predictedTurnMin: number
  mealProgressPct: number
  noDessertOrdered?: boolean
  seatedAt: string // time string
}

export interface CapacitySlot {
  time: string
  occupancyPct: number
  seatsOccupied: number
  totalSeats: number
  arrivingReservations: number
  predictedTurns: number
}

export interface PaceMetrics {
  revenue: number
  revenueTarget: number
  covers: number
  coversExpected: number
  avgTurnMin: number
  avgTurnTarget: number
  kitchenTickets: number
  kitchenLoad: "low" | "moderate" | "high" | "critical"
}

// ── Time helpers (replace mock currentTime/currentDate) ────────────────────────

/** Current time as "HH:MM" in local timezone. Use instead of restaurantConfig.currentTime. */
export function getCurrentLocalTime24(now = new Date()): string {
  const h = now.getHours().toString().padStart(2, "0")
  const m = now.getMinutes().toString().padStart(2, "0")
  return `${h}:${m}`
}

/** Current date formatted like "Friday, Jan 17, 2025". Use instead of restaurantConfig.currentDate. */
export function getCurrentLocalDateFormatted(now = new Date()): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ── Restaurant Configuration (fallback when no real config) ───────────────────

export const restaurantConfig = {
  name: "Bella Vista",
  totalTables: 22,
  totalSeats: 78,
  zones: [
    { id: "main", name: "Main Dining", tables: 14 },
    { id: "patio", name: "Patio", tables: 5 },
    { id: "private", name: "Private Room", tables: 3 },
  ],
  servicePeriods: [
    { id: "lunch" as ServicePeriod, label: "Lunch", start: "11:30", end: "14:30" },
    { id: "dinner" as ServicePeriod, label: "Dinner", start: "17:00", end: "23:00" },
    { id: "half-day" as ServicePeriod, label: "12h", start: "12:00", end: "24:00" },
    { id: "all-day" as ServicePeriod, label: "24h", start: "00:00", end: "24:00" },
  ],
  currentTime: "19:23",
  currentDate: "Friday, Jan 17, 2025",
}

// ── Adapter: store → reservations-data shape ───────────────────────────────────

function mapStoreStatusToReservationStatus(s: StoreReservation["status"]): ReservationStatus {
  if (s === "noShow") return "no-show"
  if (s === "reserved" || s === "waitlist") return "confirmed"
  return s as ReservationStatus
}

function storeReservationToReservation(r: StoreReservation): Reservation {
  let time24 = r.time
  if (r.time.includes("PM") || r.time.includes("AM")) {
    const [hourStr, rest] = r.time.split(":")
    const hour = Number.parseInt(hourStr ?? "0", 10)
    const isPM = r.time.includes("PM")
    const hour24 = isPM && hour !== 12 ? hour + 12 : !isPM && hour === 12 ? 0 : hour
    const minStr = (rest ?? "00").replace(/\s*(AM|PM).*$/i, "").trim() || "00"
    time24 = `${hour24.toString().padStart(2, "0")}:${minStr.padStart(2, "0")}`
  }
  return {
    id: r.id,
    customerId: r.customerId,
    guestName: r.guestName,
    partySize: r.partySize,
    time: time24,
    date: r.date,
    endTime: r.endTime,
    durationMinutes: r.duration,
    status: mapStoreStatusToReservationStatus(r.status),
    risk: "low",
    table: r.table ?? r.tableId ?? null,
    tags: (r.tags ?? []).map((t) => ({ type: t.toLowerCase().replace(/\s/g, "-") as TagType, label: t })),
    notes: r.notes,
    visitCount: r.visitCount,
    bookedVia: r.source ?? undefined,
    confirmationSent: true,
    phone: r.phone,
  }
}

function computeElapsedMinutes(addedAt: string | null | undefined): number {
  if (!addedAt || typeof addedAt !== "string") return 0
  const ts = Date.parse(addedAt)
  if (Number.isNaN(ts)) return 0
  return Math.max(0, Math.floor((Date.now() - ts) / 60_000))
}

function storeWaitlistToWaitlistParty(w: StoreWaitlistEntry): WaitlistParty {
  const quoted = Number.parseInt(w.waitTime.replace(/\D/g, ""), 10) || 0
  const elapsed = computeElapsedMinutes(w.addedAt)
  return {
    id: w.id,
    name: w.guestName,
    partySize: w.partySize,
    quotedWait: quoted,
    elapsedWait: elapsed,
    notes: w.notes,
  }
}

/** Map store-shaped reservations/waitlist to UI shape. Used when converting ReservationsView to shell data. */
export function mapReservationsViewToData(view: {
  reservations: StoreReservation[]
  waitlist: StoreWaitlistEntry[]
}): { reservations: Reservation[]; waitlistParties: WaitlistParty[] } {
  return {
    reservations: view.reservations.map(storeReservationToReservation),
    waitlistParties: view.waitlist.map(storeWaitlistToWaitlistParty),
  }
}

/** Reservations and waitlist from the central store, mapped to reservations-data types. Use in components that need reactivity. */
export function useReservationsFromStore(): {
  reservations: Reservation[]
  waitlistParties: WaitlistParty[]
} {
  const storeReservations = useRestaurantStore((s) => s.reservations)
  const storeWaitlist = useRestaurantStore((s) => s.waitlist)
  const reservations = useMemo(
    () => storeReservations.map(storeReservationToReservation),
    [storeReservations]
  )
  const waitlistParties = useMemo(
    () => storeWaitlist.map(storeWaitlistToWaitlistParty),
    [storeWaitlist]
  )
  return { reservations, waitlistParties }
}

// Legacy static data: same shape for components that have not yet switched to useReservationsFromStore.
// Prefer useReservationsFromStore() so data stays in sync with the rest of the app.
export const reservations: Reservation[] = [
  {
    id: "r1",
    guestName: "James & Olivia Hart",
    partySize: 2,
    time: "17:30",
    status: "completed",
    risk: "low",
    table: "T1",
    tags: [{ type: "anniversary", label: "Anniversary" }],
    notes: "Window seat preferred",
    visitCount: 8,
    bookedVia: "Phone",
    confirmationSent: true,
  },
  {
    id: "r2",
    guestName: "Priya Sharma",
    partySize: 2,
    time: "18:00",
    status: "completed",
    risk: "low",
    table: "T3",
    tags: [{ type: "vip", label: "VIP" }, { type: "allergy", label: "Allergy", detail: "Gluten-free" }],
    visitCount: 24,
    bookedVia: "App",
    confirmationSent: true,
  },
  {
    id: "r3",
    guestName: "David Kim",
    partySize: 3,
    time: "18:00",
    status: "completed",
    risk: "low",
    table: "T5",
    tags: [{ type: "first-timer", label: "First timer" }],
    bookedVia: "Google",
    confirmationSent: true,
  },
  {
    id: "r4",
    guestName: "The Okonkwo Family",
    partySize: 4,
    time: "18:30",
    status: "seated",
    risk: "low",
    table: "T8",
    tags: [{ type: "birthday", label: "Birthday" }, { type: "high-value", label: "High value" }],
    notes: "Cake delivery at 8pm",
    visitCount: 3,
    bookedVia: "Phone",
    confirmationSent: true,
  },
  {
    id: "r5",
    guestName: "Elena & Marco Rossi",
    partySize: 4,
    time: "18:30",
    status: "seated",
    risk: "low",
    table: "T9",
    tags: [{ type: "vip", label: "VIP" }, { type: "allergy", label: "Allergy", detail: "Shellfish" }],
    visitCount: 15,
    bookedVia: "App",
    confirmationSent: true,
  },
  {
    id: "r6",
    guestName: "Nguyen Family",
    partySize: 6,
    time: "19:00",
    status: "seated",
    risk: "low",
    table: "T14",
    tags: [{ type: "birthday", label: "Birthday" }, { type: "allergy", label: "Allergy", detail: "Nut allergy" }],
    notes: "Cake requested - chocolate",
    visitCount: 5,
    bookedVia: "Phone",
    confirmationSent: true,
  },
  {
    id: "r7",
    guestName: "Liam Walsh",
    partySize: 2,
    time: "19:00",
    status: "seated",
    risk: "low",
    table: "T2",
    tags: [{ type: "first-timer", label: "First timer" }],
    bookedVia: "Google",
    confirmationSent: true,
  },
  {
    id: "r8",
    guestName: "Tanaka Business Group",
    partySize: 4,
    time: "19:15",
    status: "seated",
    risk: "low",
    table: "T15",
    tags: [{ type: "vip", label: "VIP" }, { type: "high-value", label: "High value" }],
    notes: "Private room preferred - business dinner",
    visitCount: 11,
    bookedVia: "Concierge",
    confirmationSent: true,
  },
  {
    id: "r9",
    guestName: "Sarah Chen",
    partySize: 4,
    time: "19:30",
    status: "confirmed",
    risk: "low",
    table: "T12",
    tags: [
      { type: "vip", label: "VIP" },
      { type: "allergy", label: "Allergy", detail: "Shellfish" },
    ],
    visitCount: 12,
    bookedVia: "App",
    confirmationSent: true,
    phone: "+1 (555) 234-5678",
  },
  {
    id: "r10",
    guestName: "Marcus Webb",
    partySize: 2,
    time: "19:30",
    status: "confirmed",
    risk: "medium",
    table: "T5",
    tags: [{ type: "first-timer", label: "First timer" }],
    bookedVia: "Google",
    confirmationSent: false,
    phone: "+1 (555) 876-5432",
  },
  {
    id: "r11",
    guestName: "Amara Osei",
    partySize: 3,
    time: "19:45",
    status: "confirmed",
    risk: "low",
    table: "T6",
    tags: [{ type: "first-timer", label: "First timer" }],
    bookedVia: "OpenTable",
    confirmationSent: true,
    phone: "+1 (555) 345-6789",
  },
  {
    id: "r12",
    guestName: "Jake Morrison",
    partySize: 4,
    time: "19:45",
    status: "confirmed",
    risk: "high",
    riskScore: 68,
    table: null,
    tags: [],
    bookedVia: "Website",
    confirmationSent: false,
    phone: "+1 (555) 987-6543",
  },
  {
    id: "r13",
    guestName: "Sofia Reyes",
    partySize: 2,
    time: "20:00",
    status: "confirmed",
    risk: "low",
    table: "T3",
    tags: [{ type: "window", label: "Window seat" }],
    notes: "Proposing tonight - please coordinate with staff",
    visitCount: 6,
    bookedVia: "Phone",
    confirmationSent: true,
    phone: "+1 (555) 456-7890",
  },
  {
    id: "r14",
    guestName: "Chen Wei Group",
    partySize: 8,
    time: "20:00",
    status: "confirmed",
    risk: "low",
    table: "T16",
    tags: [{ type: "high-value", label: "High value" }],
    notes: "Wheelchair accessible needed",
    visitCount: 2,
    bookedVia: "Phone",
    confirmationSent: true,
    phone: "+1 (555) 567-8901",
  },
  {
    id: "r15",
    guestName: "Isla McAllister",
    partySize: 2,
    time: "20:15",
    status: "confirmed",
    risk: "medium",
    table: "T4",
    tags: [{ type: "first-timer", label: "First timer" }],
    bookedVia: "Instagram",
    confirmationSent: true,
    phone: "+1 (555) 678-9012",
  },
  {
    id: "r16",
    guestName: "Patel Celebration",
    partySize: 6,
    time: "20:30",
    status: "confirmed",
    risk: "low",
    table: "T14",
    tags: [{ type: "birthday", label: "Birthday" }, { type: "allergy", label: "Allergy", detail: "Dairy-free" }],
    notes: "Cake delivery arranged",
    visitCount: 4,
    bookedVia: "Phone",
    confirmationSent: true,
    phone: "+1 (555) 789-0123",
  },
  {
    id: "r17",
    guestName: "Tom & Rachel Davis",
    partySize: 4,
    time: "21:00",
    status: "confirmed",
    risk: "medium",
    table: null,
    tags: [],
    bookedVia: "Google",
    confirmationSent: false,
    phone: "+1 (555) 890-1234",
  },
  {
    id: "r18",
    guestName: "Aiko Yamamoto",
    partySize: 2,
    time: "21:30",
    status: "confirmed",
    risk: "high",
    riskScore: 55,
    table: null,
    tags: [{ type: "first-timer", label: "First timer" }],
    bookedVia: "Website",
    confirmationSent: false,
    phone: "+1 (555) 901-2345",
  },
]

// ── Mock Waitlist (5 parties) ────────────────────────────────────────────────

export const waitlistParties: WaitlistParty[] = [
  {
    id: "w1",
    name: "Rodriguez family",
    partySize: 4,
    quotedWait: 25,
    elapsedWait: 18,
    autoMatch: "T14",
    autoMatchTime: 7,
  },
  {
    id: "w2",
    name: "Kim & Park",
    partySize: 2,
    quotedWait: 15,
    elapsedWait: 12,
    barTab: 34,
  },
  {
    id: "w3",
    name: "Thompson party",
    partySize: 6,
    quotedWait: 40,
    elapsedWait: 5,
    notes: "No tables predicted for 35 min",
  },
  {
    id: "w4",
    name: "Ali, Yusuf",
    partySize: 2,
    quotedWait: 20,
    elapsedWait: 3,
    autoMatch: "T3",
    autoMatchTime: 0,
    notes: "Auto-match: T3 turning now",
  },
  {
    id: "w5",
    name: "O'Brien group",
    partySize: 5,
    quotedWait: 45,
    elapsedWait: 1,
    notes: "Needs large table - T8+T9 booked until 9:15",
  },
]

// ── Mock Occupied Tables (fallback when no real tables) ───────────────────────

export const occupiedTables: OccupiedTable[] = [
  { id: "ot1", tableNumber: "T3", partySize: 2, courseStage: "check-printed", predictedTurnMin: 5, mealProgressPct: 92, seatedAt: "18:15" },
  { id: "ot2", tableNumber: "T7", partySize: 4, courseStage: "paying", predictedTurnMin: 3, mealProgressPct: 96, seatedAt: "18:00" },
  { id: "ot3", tableNumber: "T14", partySize: 4, courseStage: "mains-served", predictedTurnMin: 12, mealProgressPct: 70, noDessertOrdered: true, seatedAt: "18:45" },
  { id: "ot4", tableNumber: "T22", partySize: 2, courseStage: "check-requested", predictedTurnMin: 4, mealProgressPct: 94, seatedAt: "18:30" },
  { id: "ot5", tableNumber: "T1", partySize: 6, courseStage: "appetizers", predictedTurnMin: 65, mealProgressPct: 15, seatedAt: "19:10" },
  { id: "ot6", tableNumber: "T18", partySize: 2, courseStage: "ordering", predictedTurnMin: 55, mealProgressPct: 8, seatedAt: "19:18" },
  { id: "ot7", tableNumber: "T20", partySize: 4, courseStage: "mains-served", predictedTurnMin: 30, mealProgressPct: 55, seatedAt: "18:50" },
  { id: "ot8", tableNumber: "T9", partySize: 4, courseStage: "dessert", predictedTurnMin: 15, mealProgressPct: 82, seatedAt: "18:20" },
]

// ── Real Turn Tracker: store tables → occupied tables ────────────────────────

/** Map session status + stage to CourseStage. Honest coarse mapping. */
function deriveCourseStage(
  status: string,
  stage: string | null | undefined,
  billTotal: number
): CourseStage {
  // Bill-related statuses
  if (status === "bill_requested") return "check-requested"
  if (stage === "bill") return billTotal > 0 ? "paying" : "check-printed"

  // Later stages
  if (stage === "dessert") return "dessert"
  if (status === "served" || status === "food_ready") return "mains-served"
  if (status === "in_kitchen") return "mains-fired"
  if (status === "ordering" || status === "seated") {
    return stage === "food" ? "appetizers" : "ordering"
  }

  return "ordering"
}

/** Estimate predicted turn minutes from course stage. Simple honest model-no predictive analytics. */
function estimatePredictedTurnMin(stage: CourseStage): number {
  const map: Record<CourseStage, number> = {
    paying: 3,
    "check-printed": 5,
    "check-requested": 6,
    dessert: 15,
    "mains-served": 28,
    "mains-fired": 42,
    appetizers: 52,
    ordering: 62,
  }
  return map[stage] ?? 30
}

/** Estimate meal progress % from course stage. Coarse mapping. */
function estimateMealProgressPct(stage: CourseStage): number {
  const map: Record<CourseStage, number> = {
    paying: 97,
    "check-printed": 94,
    "check-requested": 90,
    dessert: 82,
    "mains-served": 65,
    "mains-fired": 40,
    appetizers: 25,
    ordering: 10,
  }
  return map[stage] ?? 50
}

/** Check if session has dessert wave with items (for noDessertOrdered heuristic). */
function hasDessertWave(session: { tableItems?: { wave: string }[]; seats?: { items: { wave: string }[] }[] } | null): boolean {
  if (!session) return false
  const items = [
    ...(session.tableItems ?? []),
    ...(session.seats ?? []).flatMap((s) => s.items ?? []),
  ]
  return items.some((i) => i.wave === "dessert")
}

/** Format seatedAt from ISO string to "HH:MM". */
function formatSeatedAt(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "-"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "-"
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
  } catch {
    return "-"
  }
}

/**
 * Derive OccupiedTable[] from store tables. Uses tables with status active, urgent, or billing
 * that have session data. Maps session status + stage to CourseStage; estimates turn time
 * and progress from stage (simple model, not predictive analytics).
 */
export function storeTablesToOccupiedTables(tables: StoreTable[]): OccupiedTable[] {
  const occupied: OccupiedTable[] = []
  const occupiedStatuses = ["active", "urgent", "billing"] as const

  for (const t of tables) {
    if (!occupiedStatuses.includes(t.status as (typeof occupiedStatuses)[number])) continue

    const session = t.session ?? null
    const status = session?.status ?? "seated"
    const stage = t.stage ?? null
    const billTotal = session?.bill?.total ?? 0

    const courseStage = deriveCourseStage(status, stage, billTotal)
    const partySize = t.guests ?? session?.guestCount ?? t.capacity ?? 2
    const seatedAt = formatSeatedAt(t.seatedAt)

    occupied.push({
      id: t.id,
      tableNumber: `T${t.number}`,
      partySize,
      courseStage,
      predictedTurnMin: estimatePredictedTurnMin(courseStage),
      mealProgressPct: estimateMealProgressPct(courseStage),
      noDessertOrdered:
        (courseStage === "mains-served" || courseStage === "dessert" || courseStage === "check-requested") &&
        !hasDessertWave(session)
          ? true
          : undefined,
      seatedAt,
    })
  }

  return occupied.sort((a, b) => a.predictedTurnMin - b.predictedTurnMin)
}

/** Occupied tables from restaurant store. Use real data when tables exist; fallback to mock. */
export function useOccupiedTables(): OccupiedTable[] {
  const tables = useRestaurantStore((s) => s.tables) ?? []
  return useMemo(() => {
    const real = storeTablesToOccupiedTables(tables)
    return real.length > 0 ? real : occupiedTables
  }, [tables])
}

// ── Capacity Slots (30-min intervals) ────────────────────────────────────────

export const capacitySlots: CapacitySlot[] = [
  { time: "17:00", occupancyPct: 12, seatsOccupied: 9, totalSeats: 78, arrivingReservations: 2, predictedTurns: 0 },
  { time: "17:30", occupancyPct: 18, seatsOccupied: 14, totalSeats: 78, arrivingReservations: 3, predictedTurns: 0 },
  { time: "18:00", occupancyPct: 45, seatsOccupied: 35, totalSeats: 78, arrivingReservations: 5, predictedTurns: 1 },
  { time: "18:30", occupancyPct: 72, seatsOccupied: 56, totalSeats: 78, arrivingReservations: 4, predictedTurns: 2 },
  { time: "19:00", occupancyPct: 88, seatsOccupied: 69, totalSeats: 78, arrivingReservations: 6, predictedTurns: 2 },
  { time: "19:30", occupancyPct: 95, seatsOccupied: 74, totalSeats: 78, arrivingReservations: 4, predictedTurns: 1 },
  { time: "20:00", occupancyPct: 100, seatsOccupied: 78, totalSeats: 78, arrivingReservations: 5, predictedTurns: 3 },
  { time: "20:30", occupancyPct: 92, seatsOccupied: 72, totalSeats: 78, arrivingReservations: 2, predictedTurns: 4 },
  { time: "21:00", occupancyPct: 75, seatsOccupied: 58, totalSeats: 78, arrivingReservations: 2, predictedTurns: 5 },
  { time: "21:30", occupancyPct: 52, seatsOccupied: 41, totalSeats: 78, arrivingReservations: 1, predictedTurns: 4 },
  { time: "22:00", occupancyPct: 30, seatsOccupied: 23, totalSeats: 78, arrivingReservations: 0, predictedTurns: 3 },
  { time: "22:30", occupancyPct: 12, seatsOccupied: 9, totalSeats: 78, arrivingReservations: 0, predictedTurns: 2 },
]

// ── Tonight's Pace Metrics ───────────────────────────────────────────────────

export const paceMetrics: PaceMetrics = {
  revenue: 4280,
  revenueTarget: 6500,
  covers: 94,
  coversExpected: 156,
  avgTurnMin: 72,
  avgTurnTarget: 68,
  kitchenTickets: 12,
  kitchenLoad: "moderate",
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse time to minutes from midnight. Handles "HH:MM" (24h) and "H:MM AM/PM". Returns null if invalid. */
function parseTimeToMinutesSafe(time: string): number | null {
  if (!time || typeof time !== "string") return null
  const trimmed = time.trim()
  // 24h format "HH:MM" or "H:MM"
  const m24 = trimmed.match(/^(\d{1,2}):(\d{1,2})\s*$/);
  if (m24) {
    const h = Number.parseInt(m24[1]!, 10)
    const m = Number.parseInt(m24[2]!, 10)
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
    return h * 60 + m
  }
  // 12h format "H:MM AM" or "HH:MM PM"
  const m12 = trimmed.match(/^(\d{1,2}):(\d{1,2})\s*(AM|PM)\s*$/i);
  if (m12) {
    let h = Number.parseInt(m12[1]!, 10)
    const m = Number.parseInt(m12[2]!, 10)
    const isPM = m12[3]!.toUpperCase() === "PM"
    if (Number.isNaN(h) || Number.isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) return null
    if (h === 12) h = isPM ? 12 : 0
    else if (isPM) h += 12
    return h * 60 + m
  }
  return null
}

function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function getUpcomingReservations(
  allReservations: Reservation[],
  currentTime: string
): Reservation[] {
  const currentMin = parseTimeToMinutesSafe(currentTime)
  if (currentMin == null) return []
  const todayIso = getTodayIso()
  const windowEnd = currentMin + 120 // next 2 hours

  return allReservations.filter((r) => {
    if (r.status === "completed" || r.status === "cancelled" || r.status === "no-show" || r.status === "seated") return false
    // Only show reservations for today
    const resDate = r.date ?? todayIso
    if (resDate !== todayIso) return false
    const resMinutes = parseTimeToMinutesSafe(r.time)
    if (resMinutes == null) return false
    return resMinutes >= currentMin - 15 && resMinutes <= windowEnd
  })
}

function minutesToTime24(totalMin: number): string {
  const n = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(n / 60).toString().padStart(2, "0")
  const m = (n % 60).toString().padStart(2, "0")
  return `${h}:${m}`
}

export function groupReservationsByTime(
  upcomingReservations: Reservation[],
  currentTime: string
): { label: string; time: string; isArrivingNow: boolean; reservations: Reservation[] }[] {
  const currentMinutes = parseTimeToMinutesSafe(currentTime) ?? 0

  const grouped = new Map<string, Reservation[]>()
  for (const r of upcomingReservations) {
    const minutes = parseTimeToMinutesSafe(r.time)
    if (minutes == null) continue
    const key = minutesToTime24(minutes)
    const existing = grouped.get(key) ?? []
    existing.push(r)
    grouped.set(key, existing)
  }

  const result: { label: string; time: string; isArrivingNow: boolean; reservations: Reservation[] }[] = []
  for (const [time24, resos] of grouped) {
    const resMinutes = parseTimeToMinutesSafe(time24) ?? 0
    const diff = resMinutes - currentMinutes

    let isArrivingNow = false
    let label: string

    if (diff <= 0 && diff >= -15) {
      isArrivingNow = true
      label = "Arriving Now"
    } else {
      const minutes = parseTimeToMinutesSafe(time24) ?? 0
      const h = Math.floor(minutes / 60) % 24
      const m = minutes % 60
      const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
      const ampm = h >= 12 ? "PM" : "AM"
      label = `${hour}:${m.toString().padStart(2, "0")} ${ampm}`
      if (resos.length > 1) label += ` (${resos.length} reservations)`
    }

    result.push({ label, time: time24, isArrivingNow, reservations: resos })
  }

  return result.sort((a, b) => {
    const am = parseTimeToMinutesSafe(a.time) ?? 0
    const bm = parseTimeToMinutesSafe(b.time) ?? 0
    return am - bm
  })
}

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number)
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  const ampm = h >= 12 ? "PM" : "AM"
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`
}

export interface GetHeroStatsOptions {
  totalSeats?: number
  currentTime?: string
  /** Capacity slots from real engine; if omitted, falls back to static mock. */
  capacitySlots?: CapacitySlot[]
}

export function getHeroStats(
  allReservations: Reservation[],
  waitlistPartiesList: WaitlistParty[] = [],
  options?: GetHeroStatsOptions
) {
  const totalCapacity = options?.totalSeats ?? 1
  const tonightReservations = allReservations.filter(
    (r) => r.status !== "cancelled"
  )
  const nowTime = options?.currentTime ?? getCurrentLocalTime24()
  const slots = options?.capacitySlots ?? capacitySlots
  const nowMinutes = (() => {
    const [h, m] = nowTime.split(":").map(Number)
    return h * 60 + m
  })()
  const currentSlot =
    slots.find((slot) => {
      const [h, m] = slot.time.split(":").map(Number)
      const slotStart = h * 60 + m
      return slotStart <= nowMinutes && nowMinutes < slotStart + 30
    }) ?? slots[0]

  const totalCovers = tonightReservations.reduce((sum, r) => sum + r.partySize, 0)
  const reserved = tonightReservations.filter(
    (r) => r.status === "confirmed" || r.status === "late"
  ).length
  const seated = allReservations
    .filter((r) => r.status === "seated")
    .reduce((sum, r) => sum + r.partySize, 0)
  const walkIns = 8
  const waitlist = waitlistPartiesList.length
  const noShows = allReservations.filter((r) => r.status === "no-show").length
  const noShowPct = tonightReservations.length > 0
    ? ((noShows / tonightReservations.length) * 100).toFixed(1)
    : "0"
  const upcoming2h = getUpcomingReservations(allReservations, nowTime).length

  return {
    covers: { current: totalCovers, capacity: totalCapacity },
    reserved,
    seated,
    walkIns,
    waitlist,
    noShows,
    noShowPct,
    capacityNow: {
      pct: currentSlot.occupancyPct,
      occupied: currentSlot.seatsOccupied,
      total: currentSlot.totalSeats,
    },
    upcoming2h,
  }
}

export function getCourseLabel(stage: CourseStage): string {
  const labels: Record<CourseStage, string> = {
    ordering: "Ordering",
    appetizers: "Appetizers firing",
    "mains-fired": "Mains fired",
    "mains-served": "Mains served",
    dessert: "Dessert served",
    "check-requested": "Check requested",
    "check-printed": "Check printed",
    paying: "Paying now",
  }
  return labels[stage]
}

export function getWaitTimerStatus(
  elapsed: number,
  quoted: number
): "normal" | "warning" | "overdue" {
  const ratio = elapsed / quoted
  if (ratio >= 1) return "overdue"
  if (ratio >= 0.8) return "warning"
  return "normal"
}
