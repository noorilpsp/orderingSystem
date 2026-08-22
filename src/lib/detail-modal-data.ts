import {
  reservations as overviewReservations,
  type Reservation as OverviewReservation,
} from "./reservations-data"
import type { StoreReservation, StoreTable } from "@/store/types"

// ── Reservation Detail Modal Data Layer ──────────────────────────────────────

export type DetailStatus =
  | "confirmed"
  | "arriving"
  | "seated"
  | "late"
  | "completed"
  | "no_show"
  | "cancelled"

export interface GuestProfile {
  totalVisits: number
  avgSpend: number
  lastVisit: string
  lifetimeValue: number
  noShows: number
  cancellations: number
  preferences: string[]
  allergies: string[]
  vipTier: "gold" | "silver" | null
}

export interface ReservationNote {
  type: "guest_request" | "staff_note"
  text: string
  status?: "matched" | "ordered" | "pending" | "unavailable"
  matchDetail?: string
  author?: string
  role?: string
  timestamp?: string
}

export interface Communication {
  direction: "out" | "in"
  type: "sms" | "email"
  template?: string
  content: string
  timestamp: string
  status?: "sent" | "delivered" | "failed"
  read?: boolean
}

export interface HistoryEvent {
  event: string
  detail: string
  actor: string
  timestamp: string
}

export interface CourseStatus {
  name: string
  status: "served" | "firing" | "ordered" | "not_ordered" | "pending"
  completedAt?: string
  firedAt?: string
}

export interface OrderItem {
  item: string
  qty: number
  price: number
}

export interface ServiceStatus {
  seatedAt: string
  estimatedFinish: string
  courses: CourseStatus[]
  currentOrder: OrderItem[]
  subtotal: number
  estimatedTotal: number
  tableTime: number
  estimatedDuration: number
}

export interface DetailReservation {
  id: string
  guestName: string
  guestPhone: string
  guestEmail: string
  partySize: number
  date: string
  time: string
  duration: number
  table: string | null
  tableCapacity: number | null
  tableFeature: string | null
  zone: string
  server: string | null
  status: DetailStatus
  riskScore: number
  riskLevel: "low" | "medium" | "high"
  channel: string
  createdAt: string
  createdBy: string
  confirmedAt: string | null
  confirmedVia: string | null
  deposit: number | null
  depositStatus: "none" | "required" | "paid" | "refunded"
  tags: string[]
  guest: GuestProfile
  notes: ReservationNote[]
  communications: Communication[]
  history: HistoryEvent[]
  serviceStatus: ServiceStatus | null
  // Completed-specific
  finalCheck?: number
  actualDuration?: number
  rating?: number | null
  // No-show specific
  depositCharged?: boolean
  noShowHistory?: { date: string; partySize: number }[]
  // Cancelled specific
  cancelledAt?: string
  cancelReason?: string
  cancelNote?: string
}

// ── Primary Mock: Sarah Chen (Arriving / Seated) ─────────────────────────────

export const sarahChen: DetailReservation = {
  id: "res_001",
  guestName: "Sarah Chen",
  guestPhone: "+1 (555) 123-4567",
  guestEmail: "sarah.chen@email.com",
  partySize: 4,
  date: "2025-01-17",
  time: "19:30",
  duration: 90,
  table: "T12",
  tableCapacity: 4,
  tableFeature: "Window",
  zone: "Main Dining",
  server: "Mike",
  status: "arriving",
  riskScore: 8,
  riskLevel: "low",
  channel: "Direct (website)",
  createdAt: "2025-01-15T14:30:00",
  createdBy: "Maria",
  confirmedAt: "2025-01-15T14:45:00",
  confirmedVia: "sms",
  deposit: null,
  depositStatus: "none",
  tags: ["vip", "shellfish-allergy", "high-value"],
  guest: {
    totalVisits: 12,
    avgSpend: 220,
    lastVisit: "2025-01-03",
    lifetimeValue: 2640,
    noShows: 0,
    cancellations: 1,
    preferences: [
      "Prefers window seats",
      "Usually orders Old Fashioned cocktail",
      "Likes the tasting menu",
    ],
    allergies: ["Shellfish"],
    vipTier: "gold",
  },
  notes: [
    {
      type: "guest_request",
      text: "Window seat preferred",
      status: "matched",
      matchDetail: "T12 is window",
    },
    {
      type: "guest_request",
      text: "Prefers Old Fashioned as welcome drink",
      status: "ordered",
    },
    {
      type: "staff_note",
      text: "Guest called ahead -- running 5 min late, hold table",
      author: "Maria",
      role: "Host",
      timestamp: "2025-01-17T19:20:00",
    },
    {
      type: "staff_note",
      text: "Seated at T12, offered the specials menu",
      author: "Mike",
      role: "Server",
      timestamp: "2025-01-17T19:35:00",
    },
  ],
  communications: [
    {
      direction: "out",
      type: "sms",
      template: "confirmation",
      content:
        "Hi Sarah, your reservation at Chez Laurent is confirmed for Fri Jan 17 at 7:30 PM, party of 4. Reply C to confirm or X to cancel.",
      timestamp: "2025-01-15T14:32:00",
      status: "delivered",
      read: true,
    },
    {
      direction: "in",
      type: "sms",
      content: "C",
      timestamp: "2025-01-15T14:45:00",
    },
    {
      direction: "out",
      type: "sms",
      template: "reminder",
      content:
        "Reminder: Your table at Chez Laurent is tonight at 7:30 PM. We look forward to seeing you!",
      timestamp: "2025-01-17T12:00:00",
      status: "delivered",
      read: true,
    },
    {
      direction: "out",
      type: "sms",
      template: "table_ready",
      content:
        "Hi Sarah, your table is ready! We're at the front waiting for you. See you soon!",
      timestamp: "2025-01-17T19:28:00",
      status: "delivered",
      read: false,
    },
  ],
  history: [
    {
      event: "seated",
      detail: "Guest seated at T12",
      actor: "Mike",
      timestamp: "2025-01-17T19:32:00",
    },
    {
      event: "sms_sent",
      detail: "'Table ready' SMS sent",
      actor: "Auto",
      timestamp: "2025-01-17T19:28:00",
    },
    {
      event: "note_added",
      detail: "Staff note added",
      actor: "Maria",
      timestamp: "2025-01-17T19:20:00",
    },
    {
      event: "sms_sent",
      detail: "Reminder SMS sent",
      actor: "Auto",
      timestamp: "2025-01-17T12:00:00",
    },
    {
      event: "time_changed",
      detail: "Time changed: 7:00 PM -> 7:30 PM",
      actor: "Sarah (Guest)",
      timestamp: "2025-01-16T16:15:00",
    },
    {
      event: "confirmed",
      detail: "Confirmation received via SMS",
      actor: "Guest",
      timestamp: "2025-01-15T14:45:00",
    },
    {
      event: "sms_sent",
      detail: "Confirmation SMS sent",
      actor: "Auto",
      timestamp: "2025-01-15T14:32:00",
    },
    {
      event: "created",
      detail: "Reservation created",
      actor: "Maria",
      timestamp: "2025-01-15T14:30:00",
    },
  ],
  serviceStatus: {
    seatedAt: "2025-01-17T19:32:00",
    estimatedFinish: "2025-01-17T21:00:00",
    courses: [
      { name: "Drinks", status: "served", completedAt: "2025-01-17T19:38:00" },
      {
        name: "Appetizers",
        status: "served",
        completedAt: "2025-01-17T19:55:00",
      },
      { name: "Mains", status: "firing", firedAt: "2025-01-17T20:10:00" },
      { name: "Dessert", status: "not_ordered" },
      { name: "Check", status: "pending" },
    ],
    currentOrder: [
      { item: "Old Fashioned", qty: 2, price: 14.0 },
      { item: "Burrata Salad", qty: 1, price: 16.0 },
      { item: "Tuna Tartare", qty: 1, price: 19.0 },
      { item: "Ribeye (MR, no shellfish)", qty: 1, price: 48.0 },
      { item: "Salmon", qty: 1, price: 36.0 },
      { item: "Pasta Primavera", qty: 1, price: 24.0 },
      { item: "Chicken Milanese", qty: 1, price: 28.0 },
    ],
    subtotal: 199.0,
    estimatedTotal: 248.75,
    tableTime: 72,
    estimatedDuration: 90,
  },
}

// ── Completed Mock ──────────────────────────────────────────────────────────

const completedBase: DetailReservation = {
  id: "res_002",
  guestName: "Thompson",
  guestPhone: "+1 (555) 234-0000",
  guestEmail: "thompson@email.com",
  partySize: 2,
  date: "2025-01-17",
  time: "17:30",
  duration: 75,
  table: "T4",
  tableCapacity: 2,
  tableFeature: null,
  zone: "Main Dining",
  server: "Anna",
  status: "completed",
  riskScore: 5,
  riskLevel: "low",
  channel: "Phone",
  createdAt: "2025-01-14T10:00:00",
  createdBy: "Front Desk",
  confirmedAt: "2025-01-16T09:00:00",
  confirmedVia: "phone",
  deposit: null,
  depositStatus: "none",
  tags: [],
  guest: {
    totalVisits: 3,
    avgSpend: 82,
    lastVisit: "2025-01-17",
    lifetimeValue: 246,
    noShows: 0,
    cancellations: 0,
    preferences: [],
    allergies: [],
    vipTier: null,
  },
  notes: [],
  communications: [
    {
      direction: "out",
      type: "sms",
      template: "confirmation",
      content: "Your reservation is confirmed for Fri Jan 17 at 5:30 PM.",
      timestamp: "2025-01-14T10:05:00",
      status: "delivered",
      read: true,
    },
  ],
  history: [
    {
      event: "completed",
      detail: "Table cleared, party departed",
      actor: "Anna",
      timestamp: "2025-01-17T18:45:00",
    },
    {
      event: "check_paid",
      detail: "Check paid: $89.00",
      actor: "Anna",
      timestamp: "2025-01-17T18:40:00",
    },
    {
      event: "seated",
      detail: "Guest seated at T4",
      actor: "Maria",
      timestamp: "2025-01-17T17:32:00",
    },
    {
      event: "created",
      detail: "Reservation created",
      actor: "Front Desk",
      timestamp: "2025-01-14T10:00:00",
    },
  ],
  serviceStatus: null,
  finalCheck: 89.0,
  actualDuration: 75,
  rating: null,
}

// ── No-Show Mock ────────────────────────────────────────────────────────────

const noShowBase: DetailReservation = {
  id: "res_003",
  guestName: "Baker",
  guestPhone: "+1 (555) 876-0000",
  guestEmail: "baker@email.com",
  partySize: 2,
  date: "2025-01-17",
  time: "18:30",
  duration: 90,
  table: "T21",
  tableCapacity: 2,
  tableFeature: null,
  zone: "Patio",
  server: "Carlos",
  status: "no_show",
  riskScore: 72,
  riskLevel: "high",
  channel: "Google",
  createdAt: "2025-01-12T11:00:00",
  createdBy: "Online",
  confirmedAt: null,
  confirmedVia: null,
  deposit: null,
  depositStatus: "none",
  tags: ["high-risk"],
  guest: {
    totalVisits: 5,
    avgSpend: 65,
    lastVisit: "2024-12-20",
    lifetimeValue: 325,
    noShows: 2,
    cancellations: 0,
    preferences: [],
    allergies: [],
    vipTier: null,
  },
  notes: [],
  communications: [
    {
      direction: "out",
      type: "sms",
      template: "confirmation",
      content: "Please confirm your reservation for Fri Jan 17 at 6:30 PM.",
      timestamp: "2025-01-12T11:05:00",
      status: "delivered",
      read: false,
    },
    {
      direction: "out",
      type: "sms",
      template: "reminder",
      content: "Reminder: Your table is tonight at 6:30 PM.",
      timestamp: "2025-01-17T12:00:00",
      status: "delivered",
      read: false,
    },
  ],
  history: [
    {
      event: "no_show",
      detail: "Marked as no-show after 30 min wait",
      actor: "Maria",
      timestamp: "2025-01-17T19:00:00",
    },
    {
      event: "sms_sent",
      detail: "Reminder SMS sent",
      actor: "Auto",
      timestamp: "2025-01-17T12:00:00",
    },
    {
      event: "created",
      detail: "Reservation created via Google",
      actor: "Online",
      timestamp: "2025-01-12T11:00:00",
    },
  ],
  serviceStatus: null,
  depositCharged: false,
  noShowHistory: [
    { date: "2024-11-15", partySize: 2 },
    { date: "2024-09-22", partySize: 4 },
  ],
}

// ── Cancelled Mock ──────────────────────────────────────────────────────────

const cancelledBase: DetailReservation = {
  id: "res_004",
  guestName: "Foster",
  guestPhone: "+1 (555) 999-0000",
  guestEmail: "foster@email.com",
  partySize: 4,
  date: "2025-01-17",
  time: "19:00",
  duration: 90,
  table: null,
  tableCapacity: null,
  tableFeature: null,
  zone: "Main Dining",
  server: null,
  status: "cancelled",
  riskScore: 15,
  riskLevel: "low",
  channel: "Direct (website)",
  createdAt: "2025-01-10T08:00:00",
  createdBy: "Online",
  confirmedAt: "2025-01-10T08:05:00",
  confirmedVia: "email",
  deposit: null,
  depositStatus: "none",
  tags: [],
  guest: {
    totalVisits: 1,
    avgSpend: 120,
    lastVisit: "2024-12-01",
    lifetimeValue: 120,
    noShows: 0,
    cancellations: 0,
    preferences: [],
    allergies: [],
    vipTier: null,
  },
  notes: [],
  communications: [
    {
      direction: "out",
      type: "email",
      template: "confirmation",
      content: "Your reservation for Jan 17 at 7:00 PM has been confirmed.",
      timestamp: "2025-01-10T08:02:00",
      status: "delivered",
      read: true,
    },
  ],
  history: [
    {
      event: "cancelled",
      detail: "Cancelled by guest: Family emergency",
      actor: "Guest",
      timestamp: "2025-01-17T17:00:00",
    },
    {
      event: "created",
      detail: "Reservation created",
      actor: "Online",
      timestamp: "2025-01-10T08:00:00",
    },
  ],
  serviceStatus: null,
  cancelledAt: "2025-01-17T17:00:00",
  cancelReason: "guest_request",
  cancelNote: "Family emergency",
}

function mapOverviewStatus(status: OverviewReservation["status"]): DetailStatus {
  switch (status) {
    case "confirmed":
      return "confirmed"
    case "late":
      return "late"
    case "seated":
      return "seated"
    case "completed":
      return "completed"
    case "no-show":
      return "no_show"
    case "cancelled":
      return "cancelled"
    default:
      return "confirmed"
  }
}

function normalizeZoneDisplay(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  if (lower === "main" || lower.includes("main")) return "Main Dining"
  if (lower === "patio") return "Patio"
  if (lower === "private" || lower.includes("private")) return "Private Room"
  if (lower === "bar") return "Bar Area"
  return raw
}

function deriveZoneFromTable(table: string | null): string {
  if (!table) return "Main Dining"
  const tableNumber = Number.parseInt(table.replace(/[^\d]/g, ""), 10)
  if (!Number.isFinite(tableNumber)) return "Main Dining"
  if (tableNumber <= 17) return "Main Dining"
  if (tableNumber <= 22) return "Patio"
  return "Private Room"
}

function mapOverviewTags(tags: OverviewReservation["tags"]): string[] {
  return [...new Set(tags.map((tag) => {
    if (tag.type === "allergy") {
      const detail = (tag.detail ?? "").toLowerCase()
      if (detail.includes("shellfish")) return "shellfish-allergy"
      return "allergy"
    }
    return tag.type
  }))]
}

const EMPTY_GUEST_PROFILE: GuestProfile = {
  totalVisits: 0,
  avgSpend: 0,
  lastVisit: "",
  lifetimeValue: 0,
  noShows: 0,
  cancellations: 0,
  preferences: [],
  allergies: [],
  vipTier: null,
}

/** Build ServiceStatus from table session when available. Honest derivation-no fake items. */
function buildServiceStatusFromTable(
  table: StoreTable,
  duration: number,
  date: string
): ServiceStatus | null {
  const session = table.session
  if (!session) return null

  const seatedAt = table.seatedAt ?? table.session?.lastCheckIn ?? new Date().toISOString()
  const seatedTs = new Date(seatedAt).getTime()
  const now = Date.now()
  const tableTime = Math.max(0, Math.floor((now - seatedTs) / 60_000))

  const waves = session.seats?.flatMap((s) => s.items ?? []) ?? []
  const tableItems = session.tableItems ?? []
  const allItems = [...waves, ...tableItems].filter((i) => i.status !== "void")

  const waveStatus = (waveType: "drinks" | "food" | "dessert"): CourseStatus["status"] => {
    const items = allItems.filter((i) => i.wave === waveType)
    if (items.length === 0) return "not_ordered"
    const anyServed = items.some((i) => i.status === "served")
    const anyCooking = items.some((i) => ["cooking", "ready"].includes(i.status ?? ""))
    const anySent = items.some((i) => i.status === "sent")
    if (anyServed) return "served"
    if (anyCooking || anySent) return "firing"
    return "ordered"
  }

  const courses: CourseStatus[] = [
    { name: "Drinks", status: waveStatus("drinks") },
    { name: "Food", status: waveStatus("food") },
    { name: "Dessert", status: waveStatus("dessert") },
    {
      name: "Check",
      status: (session.bill?.total ?? 0) > 0 ? "served" : "pending",
    },
  ]

  const itemMap = new Map<string, { qty: number; price: number }>()
  for (const i of allItems) {
    const key = i.name
    const existing = itemMap.get(key)
    if (existing) {
      existing.qty += 1
    } else {
      itemMap.set(key, { qty: 1, price: i.price ?? 0 })
    }
  }
  const currentOrder: OrderItem[] = Array.from(itemMap.entries()).map(([item, { qty, price }]) => ({
    item,
    qty,
    price,
  }))

  const subtotal = session.bill?.subtotal ?? session.bill?.total ?? 0
  const finishDate = new Date(seatedTs + duration * 60_000)

  return {
    seatedAt,
    estimatedFinish: finishDate.toISOString(),
    courses,
    currentOrder,
    subtotal,
    estimatedTotal: Math.round(subtotal * 1.25),
    tableTime,
    estimatedDuration: duration,
  }
}

/** Map StoreReservation.timeline to HistoryEvent[]. */
function mapStoreTimelineToHistory(
  timeline: StoreReservation["timeline"],
  baseEvent: HistoryEvent
): HistoryEvent[] {
  if (!timeline || timeline.length === 0) return [baseEvent]

  const mapped = timeline.map((e) => ({
    event: e.event,
    detail: e.event.replace(/_/g, " "),
    actor: e.user,
    timestamp: e.time,
  }))
  return [...mapped, baseEvent].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

/** Enrich GuestProfile from StoreReservation.customerProfile when available. */
function enrichGuestFromStore(
  base: GuestProfile,
  cp: StoreReservation["customerProfile"]
): GuestProfile {
  if (!cp) return base
  return {
    ...base,
    totalVisits: cp.totalVisits ?? base.totalVisits,
    avgSpend: cp.avgSpend ?? base.avgSpend,
    lastVisit: cp.lastVisit ?? base.lastVisit,
    lifetimeValue: (cp.avgSpend ?? 0) * (cp.totalVisits ?? 0),
    noShows: cp.noShowCount ?? base.noShows,
    cancellations: cp.cancelCount ?? base.cancellations,
    preferences: cp.preferences ? cp.preferences.split(/[,;]/).map((p) => p.trim()).filter(Boolean) : base.preferences,
    allergies: cp.favoriteItems?.length ? [] : base.allergies,
  }
}

/** Build DetailReservation from real overview data. Enriches from storeReservation/table when provided. */
function buildDetailFromOverview(
  reservation: OverviewReservation,
  storeReservation?: StoreReservation | null,
  table?: StoreTable | null
): DetailReservation {
  const status = mapOverviewStatus(reservation.status)
  const mappedTags = mapOverviewTags(reservation.tags)
  const duration =
    reservation.durationMinutes != null && Number.isFinite(reservation.durationMinutes)
      ? reservation.durationMinutes
      : storeReservation?.duration ??
        (reservation.partySize <= 2 ? 75 : reservation.partySize <= 4 ? 90 : reservation.partySize <= 6 ? 105 : 120)
  const safeGuestEmail = reservation.guestName
    ? `${reservation.guestName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "")}@guest.local`
    : ""
  const date = reservation.date ?? new Date().toISOString().slice(0, 10)
  const timelineTimes = storeReservation?.timeline?.map((e) => e.time).filter(Boolean) ?? []
  const createdAt = timelineTimes.length > 0
    ? timelineTimes.reduce((a, b) => (a < b ? a : b))
    : `${date}T12:00:00`
  const confirmedAt = reservation.confirmationSent ? `${date}T12:00:00` : null
  const tableCapacity = reservation.table ? (table?.capacity ?? Math.max(reservation.partySize, 2)) : null

  const baseGuest: GuestProfile = {
    ...EMPTY_GUEST_PROFILE,
    totalVisits: reservation.visitCount ?? storeReservation?.visitCount ?? 0,
  }
  const guest = enrichGuestFromStore(baseGuest, storeReservation?.customerProfile)

  const allergiesFromTags = reservation.tags
    .filter((t) => t.type === "allergy")
    .map((t) => t.detail ?? t.label ?? "Allergy")
    .filter(Boolean)
  if (allergiesFromTags.length > 0) {
    guest.allergies = [...new Set([...guest.allergies, ...allergiesFromTags])]
  }

  const notes: ReservationNote[] = reservation.notes
    ? [
        {
          type: "staff_note",
          text: reservation.notes,
          author: "Host",
          role: "Host",
          timestamp: createdAt,
        },
      ]
    : []

  const baseHistoryEvent: HistoryEvent = {
    event: "created",
    detail: `Reservation created via ${reservation.bookedVia ?? storeReservation?.source ?? "manual entry"}`,
    actor: "System",
    timestamp: createdAt,
  }
  const history = mapStoreTimelineToHistory(storeReservation?.timeline, baseHistoryEvent)
  if (confirmedAt && !history.some((h) => h.event === "confirmed")) {
    history.unshift({
      event: "confirmed",
      detail: "Guest confirmed reservation",
      actor: "Guest",
      timestamp: confirmedAt,
    })
  }

  const zone =
    normalizeZoneDisplay(storeReservation?.zone ?? null) ??
    (table ? normalizeZoneDisplay(table.section) ?? table.section : null) ??
    deriveZoneFromTable(reservation.table)

  const server = storeReservation?.staff ?? table?.serverName ?? null

  let serviceStatus: ServiceStatus | null = null
  if (status === "seated" && table?.session) {
    serviceStatus = buildServiceStatusFromTable(table, duration, date)
  }

  return {
    id: reservation.id,
    guestName: reservation.guestName,
    guestPhone: reservation.phone ?? storeReservation?.phone ?? "",
    guestEmail: storeReservation?.email ?? (safeGuestEmail || ""),
    partySize: reservation.partySize,
    date,
    time: reservation.time,
    duration,
    table: reservation.table,
    tableCapacity,
    tableFeature: reservation.tags.some((tag) => tag.type === "window") ? "Window" : null,
    zone: zone ?? deriveZoneFromTable(reservation.table),
    server,
    status,
    riskScore: reservation.riskScore ?? (reservation.risk === "high" ? 72 : reservation.risk === "medium" ? 42 : 12),
    riskLevel: reservation.risk,
    channel: reservation.bookedVia ?? storeReservation?.source ?? "Direct",
    createdAt,
    createdBy: "System",
    confirmedAt,
    confirmedVia: reservation.confirmationSent ? "sms" : null,
    deposit: null,
    depositStatus: "none",
    tags: mappedTags,
    guest,
    notes,
    communications: [],
    history,
    serviceStatus,
    ...(status === "completed" && {
      finalCheck: undefined,
      actualDuration: duration,
      rating: null,
    }),
    ...(status === "no_show" && {
      noShowHistory: [],
      depositCharged: false,
    }),
    ...(status === "cancelled" && {
      cancelledAt: createdAt,
      cancelReason: "guest_request",
      cancelNote: "Cancelled",
    }),
  }
}

export interface GetReservationByIdOptions {
  storeReservations?: StoreReservation[]
  tables?: StoreTable[]
}

export function getReservationById(
  id: string,
  overviewReservationsList?: OverviewReservation[],
  options?: GetReservationByIdOptions
): DetailReservation | undefined {
  const list = overviewReservationsList ?? overviewReservations
  const overviewMatch = list.find((r) => r.id === id)
  if (overviewMatch) {
    const storeRes = options?.storeReservations?.find((r) => r.id === id)
    const tableId = storeRes?.tableId ?? overviewMatch.table
    const table = tableId && options?.tables
      ? options.tables.find((t) => t.id === tableId || `T${t.number}` === tableId)
      : null
    return buildDetailFromOverview(overviewMatch, storeRes ?? null, table ?? null)
  }

  // Demo-only: static records for ids res_001, res_002, res_003, res_004 (not used with real UUIDs)
  const staticMatch = [sarahChen, completedBase, noShowBase, cancelledBase].find((r) => r.id === id)
  if (staticMatch) return staticMatch

  return undefined
}

// ── State Map ───────────────────────────────────────────────────────────────

export function getReservationByStatus(status: DetailStatus): DetailReservation {
  switch (status) {
    case "confirmed":
      return { ...sarahChen, status: "confirmed" }
    case "arriving":
      return { ...sarahChen, status: "arriving" }
    case "seated":
      return { ...sarahChen, status: "seated" }
    case "late":
      return { ...sarahChen, status: "late" }
    case "completed":
      return completedBase
    case "no_show":
      return noShowBase
    case "cancelled":
      return cancelledBase
    default:
      return sarahChen
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number)
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  const ampm = h >= 12 ? "PM" : "AM"
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`
}

export function getTimeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min} min ago`
  const hrs = Math.floor(min / 60)
  return `${hrs}h ${min % 60}m ago`
}

export function getDaysAgo(dateStr: string): number {
  if (!dateStr || typeof dateStr !== "string") return 0
  const d = new Date(dateStr + "T00:00:00")
  const ts = d.getTime()
  if (Number.isNaN(ts)) return 0
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const today = now.getTime()
  return Math.max(0, Math.floor((today - ts) / 86400000))
}

export const statusConfig: Record<
  DetailStatus,
  { label: string; color: string; bg: string; border: string; pulse?: boolean; strikethrough?: boolean }
> = {
  confirmed: {
    label: "Confirmed",
    color: "text-blue-300",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
  },
  arriving: {
    label: "Arriving Now",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    pulse: true,
  },
  seated: {
    label: "Seated",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
  },
  late: {
    label: "Late",
    color: "text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
    pulse: true,
  },
  completed: {
    label: "Completed",
    color: "text-zinc-400",
    bg: "bg-zinc-500/15",
    border: "border-zinc-500/30",
  },
  no_show: {
    label: "No-Show",
    color: "text-rose-400",
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
    strikethrough: true,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-zinc-500",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    strikethrough: true,
  },
}

export const tagConfig: Record<string, { label: string; color: string; bg: string }> = {
  vip: { label: "VIP", color: "text-amber-300", bg: "bg-amber-500/15" },
  "shellfish-allergy": { label: "Shellfish Allergy", color: "text-rose-300", bg: "bg-rose-500/15" },
  "high-value": { label: "High-value", color: "text-emerald-300", bg: "bg-emerald-500/15" },
  "high-risk": { label: "High-risk", color: "text-rose-300", bg: "bg-rose-500/15" },
  birthday: { label: "Birthday", color: "text-pink-300", bg: "bg-pink-500/15" },
  anniversary: { label: "Anniversary", color: "text-pink-300", bg: "bg-pink-500/15" },
  "first-timer": { label: "First timer", color: "text-blue-300", bg: "bg-blue-500/15" },
}
