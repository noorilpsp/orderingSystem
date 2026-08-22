// ── List View ("Operational Command Center") Data ────────────────────────────

import { getDurationForParty } from "@/lib/reservation-form-data"

export type ListReservationStatus =
  | "arriving"
  | "late"
  | "confirmed"
  | "unconfirmed"
  | "seated"
  | "completed"
  | "no-show"
  | "cancelled"
  | "waitlist"

export type ListRiskLevel = "low" | "medium" | "high"

export type ListTagType =
  | "vip"
  | "birthday"
  | "anniversary"
  | "allergy"
  | "first-timer"
  | "regular"
  | "high-value"
  | "wheelchair"
  | "service-dog"

export type CourseStage =
  | "ordering"
  | "apps"
  | "mains"
  | "dessert"
  | "check"

export type BookingChannel =
  | "Direct"
  | "Phone"
  | "Google"
  | "Walk-in"
  | "Instagram"

export interface ListTag {
  type: ListTagType
  label: string
  detail?: string // e.g. "Shellfish" for allergy
}

export interface ListReservation {
  id: string
  time: string // "HH:MM"
  guestName: string
  partySize: number
  table: string | null // "T12", "T8+T9", null for unassigned
  status: ListReservationStatus
  courseStage?: CourseStage // only for seated
  risk: ListRiskLevel
  riskScore?: number
  server: string | null
  zone: "Main" | "Patio" | "Private" | null
  tags: ListTag[]
  notes?: string
  phone?: string
  visitCount?: number
  bookedVia: BookingChannel
  confirmationSent: boolean
  checkAmount?: number // for completed
  bookedDate?: string // e.g., "Jan 15"
  cancelledNote?: string
  /** Planned sitting length (minutes). Omitted for waitlist-only rows. */
  durationMinutes?: number
}

/** Minimal shape for mapping from store/reservations-data into ListReservation. */
export interface ReservationLike {
  id: string
  time: string
  date?: string | null
  guestName: string
  partySize: number
  table: string | null
  status: string
  risk?: string
  tags?: { type: string; label: string; detail?: string }[]
  notes?: string
  phone?: string
  visitCount?: number
  bookedVia?: string
  confirmationSent?: boolean
  durationMinutes?: number
}

/** Format ISO date for list display (e.g. "Mon 1/17" or "Today"). */
export function formatListDate(iso: string | null | undefined): string | undefined {
  if (!iso || typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return undefined
  const d = new Date(iso + "T12:00:00")
  if (Number.isNaN(d.getTime())) return undefined
  const today = new Date()
  if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
    return "Today"
  }
  return d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })
}

export function reservationToListReservation(r: ReservationLike): ListReservation {
  const dateLabel = formatListDate(r.date)
  const durationMinutes =
    typeof r.durationMinutes === "number" && Number.isFinite(r.durationMinutes) && r.durationMinutes > 0
      ? r.durationMinutes
      : getDurationForParty(r.partySize)
  return {
    id: r.id,
    time: r.time,
    bookedDate: dateLabel,
    guestName: r.guestName,
    partySize: r.partySize,
    table: r.table,
    status: r.status as ListReservationStatus,
    risk: ((r.risk ?? "low") as ListRiskLevel) || "low",
    server: null,
    zone: null,
    tags: (r.tags ?? []).map((t) => ({ type: t.type as ListTagType, label: t.label, detail: t.detail })),
    notes: r.notes,
    phone: r.phone,
    visitCount: r.visitCount,
    bookedVia: (r.bookedVia as BookingChannel) ?? "Direct",
    confirmationSent: r.confirmationSent ?? false,
    durationMinutes,
  }
}

/** Map a waitlist party to ListReservation so it can be shown in the list/table when "Waitlist" is selected. */
export interface WaitlistPartyLike {
  id: string
  name: string
  partySize: number
  notes?: string
}

export function waitlistPartyToListReservation(wp: WaitlistPartyLike): ListReservation {
  return {
    id: wp.id,
    time: "-",
    guestName: wp.name,
    partySize: wp.partySize,
    table: null,
    status: "waitlist",
    risk: "low",
    server: null,
    zone: null,
    tags: [],
    notes: wp.notes,
    phone: undefined,
    visitCount: undefined,
    bookedVia: "Walk-in",
    confirmationSent: false,
  }
}

// ── 32 reservations for Friday dinner service ────────────────────────────────

export const listReservations: ListReservation[] = [
  // ── ARRIVING NOW / LATE ──
  {
    id: "lv1",
    time: "19:30",
    guestName: "Sarah Chen",
    partySize: 4,
    table: "T12",
    status: "arriving",
    risk: "low",
    server: "Mike",
    zone: "Main",
    tags: [
      { type: "vip", label: "VIP" },
      { type: "allergy", label: "Shellfish", detail: "Shellfish" },
    ],
    notes: "12th visit, prefers window seat",
    phone: "+1 (555) 234-5678",
    visitCount: 12,
    bookedVia: "Direct",
    confirmationSent: true,
  },
  {
    id: "lv2",
    time: "19:30",
    guestName: "Marcus Webb",
    partySize: 2,
    table: "T5",
    status: "late",
    risk: "high",
    riskScore: 41,
    server: "Anna",
    zone: "Main",
    tags: [{ type: "first-timer", label: "First-timer" }],
    notes: "Guest called, running 12 minutes late",
    phone: "+1 (555) 876-5432",
    bookedVia: "Google",
    confirmationSent: false,
  },

  // ── UPCOMING / CONFIRMED (12) ──
  {
    id: "lv3",
    time: "19:45",
    guestName: "Nguyen Family",
    partySize: 6,
    table: "T8+T9",
    status: "confirmed",
    risk: "low",
    server: "Mike",
    zone: "Main",
    tags: [
      { type: "birthday", label: "Birthday" },
      { type: "allergy", label: "Peanut", detail: "Peanut allergy" },
    ],
    notes: "Cake at 8pm, birthday boy is 10",
    phone: "+1 (555) 123-4567",
    visitCount: 5,
    bookedVia: "Phone",
    confirmationSent: true,
  },
  {
    id: "lv4",
    time: "19:45",
    guestName: "Jake Morrison",
    partySize: 4,
    table: null,
    status: "unconfirmed",
    risk: "high",
    riskScore: 68,
    server: null,
    zone: null,
    tags: [],
    notes: "No confirmation response, no table assigned",
    phone: "+1 (555) 987-6543",
    bookedVia: "Direct",
    confirmationSent: false,
  },
  {
    id: "lv5",
    time: "19:45",
    guestName: "Muller",
    partySize: 4,
    table: "T20",
    status: "confirmed",
    risk: "low",
    server: "Carlos",
    zone: "Patio",
    tags: [],
    phone: "+1 (555) 444-5566",
    bookedVia: "Google",
    confirmationSent: true,
  },
  {
    id: "lv6",
    time: "20:00",
    guestName: "Corporate Dinner",
    partySize: 8,
    table: "T23+T24",
    status: "confirmed",
    risk: "low",
    server: "Jordan",
    zone: "Private",
    tags: [{ type: "high-value", label: "High-value" }],
    notes: "Pre-order wine, separate checks, business dinner",
    phone: "+1 (555) 567-8901",
    visitCount: 2,
    bookedVia: "Phone",
    confirmationSent: true,
  },
  {
    id: "lv7",
    time: "20:00",
    guestName: "Dubois",
    partySize: 2,
    table: "T18",
    status: "confirmed",
    risk: "low",
    server: "Carlos",
    zone: "Patio",
    tags: [],
    phone: "+1 (555) 222-3344",
    bookedVia: "Direct",
    confirmationSent: true,
  },
  {
    id: "lv8",
    time: "20:00",
    guestName: "Sofia Reyes",
    partySize: 2,
    table: "T3",
    status: "confirmed",
    risk: "low",
    server: "Anna",
    zone: "Main",
    tags: [],
    notes: "Proposing tonight - please coordinate with staff",
    phone: "+1 (555) 456-7890",
    visitCount: 6,
    bookedVia: "Phone",
    confirmationSent: true,
  },
  {
    id: "lv9",
    time: "20:15",
    guestName: "Ali, Yusuf",
    partySize: 2,
    table: "T4",
    status: "confirmed",
    risk: "low",
    server: "Anna",
    zone: "Main",
    tags: [],
    phone: "+1 (555) 678-9012",
    bookedVia: "Walk-in",
    confirmationSent: true,
  },
  {
    id: "lv10",
    time: "20:30",
    guestName: "Garcia",
    partySize: 4,
    table: "T7",
    status: "confirmed",
    risk: "low",
    server: "Anna",
    zone: "Main",
    tags: [{ type: "regular", label: "Regular" }],
    phone: "+1 (555) 333-4455",
    visitCount: 14,
    bookedVia: "Direct",
    confirmationSent: true,
  },
  {
    id: "lv11",
    time: "20:30",
    guestName: "Santos",
    partySize: 4,
    table: "T25",
    status: "unconfirmed",
    risk: "medium",
    server: "Jordan",
    zone: "Private",
    tags: [],
    phone: "+1 (555) 555-6677",
    bookedVia: "Google",
    confirmationSent: false,
  },
  {
    id: "lv12",
    time: "21:00",
    guestName: "Park, Min-Jun",
    partySize: 2,
    table: "T3",
    status: "confirmed",
    risk: "low",
    server: "Anna",
    zone: "Main",
    tags: [{ type: "first-timer", label: "First-timer" }],
    phone: "+1 (555) 777-8899",
    bookedVia: "Instagram",
    confirmationSent: true,
  },
  {
    id: "lv13",
    time: "21:00",
    guestName: "Nakamura",
    partySize: 3,
    table: "T9",
    status: "confirmed",
    risk: "low",
    server: "Mike",
    zone: "Main",
    tags: [
      { type: "allergy", label: "Gluten", detail: "Gluten-free" },
    ],
    phone: "+1 (555) 888-9900",
    bookedVia: "Phone",
    confirmationSent: true,
  },
  {
    id: "lv14",
    time: "21:30",
    guestName: "Agarwal",
    partySize: 2,
    table: null,
    status: "unconfirmed",
    risk: "high",
    riskScore: 55,
    server: null,
    zone: null,
    tags: [{ type: "first-timer", label: "First-timer" }],
    phone: "+1 (555) 111-2233",
    bookedVia: "Direct",
    confirmationSent: false,
  },

  // ── SEATED (8) ──
  {
    id: "lv15",
    time: "18:00",
    guestName: "Williams",
    partySize: 2,
    table: "T1",
    status: "seated",
    courseStage: "mains",
    risk: "low",
    server: "Anna",
    zone: "Main",
    tags: [],
    bookedVia: "Direct",
    confirmationSent: true,
    checkAmount: 145,
  },
  {
    id: "lv16",
    time: "18:00",
    guestName: "Patel",
    partySize: 4,
    table: "T12",
    status: "seated",
    courseStage: "check",
    risk: "low",
    server: "Mike",
    zone: "Main",
    tags: [],
    bookedVia: "Direct",
    confirmationSent: true,
    checkAmount: 186,
  },
  {
    id: "lv17",
    time: "18:30",
    guestName: "Jensen",
    partySize: 2,
    table: "T3",
    status: "seated",
    courseStage: "dessert",
    risk: "low",
    server: "Anna",
    zone: "Main",
    tags: [],
    bookedVia: "Phone",
    confirmationSent: true,
    checkAmount: 78,
  },
  {
    id: "lv18",
    time: "18:30",
    guestName: "Kim Family",
    partySize: 4,
    table: "T7",
    status: "seated",
    courseStage: "mains",
    risk: "low",
    server: "Anna",
    zone: "Main",
    tags: [],
    bookedVia: "Direct",
    confirmationSent: true,
    checkAmount: 156,
  },
  {
    id: "lv19",
    time: "18:30",
    guestName: "Nguyen",
    partySize: 4,
    table: "T16",
    status: "seated",
    courseStage: "mains",
    risk: "low",
    server: "Lisa",
    zone: "Main",
    tags: [],
    bookedVia: "Google",
    confirmationSent: true,
    checkAmount: 168,
  },
  {
    id: "lv20",
    time: "18:30",
    guestName: "Lee",
    partySize: 3,
    table: "T25",
    status: "seated",
    courseStage: "mains",
    risk: "low",
    server: "Jordan",
    zone: "Private",
    tags: [],
    bookedVia: "Direct",
    confirmationSent: true,
    checkAmount: 145,
  },
  {
    id: "lv21",
    time: "19:00",
    guestName: "O'Brien",
    partySize: 6,
    table: "T8+T9",
    status: "seated",
    courseStage: "apps",
    risk: "low",
    server: "Mike",
    zone: "Main",
    tags: [{ type: "birthday", label: "Birthday" }],
    notes: "Cake at 8pm",
    bookedVia: "Phone",
    confirmationSent: true,
    visitCount: 3,
    checkAmount: 210,
  },
  {
    id: "lv22",
    time: "19:00",
    guestName: "Johansson",
    partySize: 4,
    table: "T19",
    status: "seated",
    courseStage: "ordering",
    risk: "low",
    server: "Carlos",
    zone: "Patio",
    tags: [{ type: "first-timer", label: "First-timer" }],
    bookedVia: "Google",
    confirmationSent: true,
    checkAmount: 0,
  },

  // ── COMPLETED (3) ──
  {
    id: "lv23",
    time: "17:30",
    guestName: "Thompson",
    partySize: 2,
    table: "T4",
    status: "completed",
    risk: "low",
    server: "Anna",
    zone: "Main",
    tags: [],
    bookedVia: "Direct",
    confirmationSent: true,
    checkAmount: 89,
  },
  {
    id: "lv24",
    time: "17:30",
    guestName: "Anderson Party",
    partySize: 6,
    table: "T22",
    status: "completed",
    risk: "low",
    server: "Carlos",
    zone: "Patio",
    tags: [],
    bookedVia: "Phone",
    confirmationSent: true,
    checkAmount: 234,
  },
  {
    id: "lv25",
    time: "17:30",
    guestName: "Rivera",
    partySize: 5,
    table: "T22",
    status: "completed",
    risk: "low",
    server: "Carlos",
    zone: "Patio",
    tags: [{ type: "anniversary", label: "Anniversary" }],
    bookedVia: "Direct",
    confirmationSent: true,
    checkAmount: 312,
  },

  // ── NO-SHOWS (2) ──
  {
    id: "lv26",
    time: "18:30",
    guestName: "Baker",
    partySize: 2,
    table: "T21",
    status: "no-show",
    risk: "high",
    server: "Carlos",
    zone: "Patio",
    tags: [],
    notes: "3rd no-show this year",
    bookedVia: "Direct",
    confirmationSent: true,
  },
  {
    id: "lv27",
    time: "19:00",
    guestName: "Petrov",
    partySize: 4,
    table: "T14",
    status: "no-show",
    risk: "high",
    server: "Lisa",
    zone: "Main",
    tags: [{ type: "first-timer", label: "First-timer" }],
    notes: "Phone went to voicemail",
    bookedVia: "Google",
    confirmationSent: false,
  },

  // ── CANCELLED (2) ──
  {
    id: "lv28",
    time: "19:00",
    guestName: "Foster",
    partySize: 4,
    table: null,
    status: "cancelled",
    risk: "low",
    server: null,
    zone: null,
    tags: [],
    cancelledNote: "Cancelled 2hrs ago",
    bookedVia: "Direct",
    confirmationSent: true,
  },
  {
    id: "lv29",
    time: "20:00",
    guestName: "Hernandez",
    partySize: 2,
    table: null,
    status: "cancelled",
    risk: "low",
    server: null,
    zone: null,
    tags: [],
    cancelledNote: "Cancelled yesterday",
    bookedVia: "Phone",
    confirmationSent: true,
  },

  // ── WAITLIST (5) ──
  {
    id: "lv30",
    time: "19:23",
    guestName: "Rodriguez Family",
    partySize: 4,
    table: null,
    status: "waitlist",
    risk: "low",
    server: null,
    zone: null,
    tags: [],
    notes: "Waiting 18min, quoted 25min. Predicted: T14 in 7min",
    bookedVia: "Walk-in",
    confirmationSent: false,
  },
  {
    id: "lv31",
    time: "19:23",
    guestName: "Kowalski",
    partySize: 2,
    table: null,
    status: "waitlist",
    risk: "low",
    server: null,
    zone: null,
    tags: [],
    notes: "Waiting 12min, quoted 15min. Bar tab: $34",
    bookedVia: "Walk-in",
    confirmationSent: false,
  },
  {
    id: "lv32",
    time: "19:23",
    guestName: "Svensson Party",
    partySize: 6,
    table: null,
    status: "waitlist",
    risk: "low",
    server: null,
    zone: null,
    tags: [{ type: "wheelchair", label: "Wheelchair" }],
    notes: "Waiting 5min, quoted 40min. Needs large table",
    bookedVia: "Walk-in",
    confirmationSent: false,
  },
  {
    id: "lv33",
    time: "19:23",
    guestName: "Mensah",
    partySize: 2,
    table: null,
    status: "waitlist",
    risk: "low",
    server: null,
    zone: null,
    tags: [{ type: "service-dog", label: "Service dog" }],
    notes: "Waiting 3min, quoted 20min. Auto-match: T3 turning now",
    bookedVia: "Walk-in",
    confirmationSent: false,
  },
  {
    id: "lv34",
    time: "19:23",
    guestName: "Okafor Group",
    partySize: 5,
    table: null,
    status: "waitlist",
    risk: "low",
    server: null,
    zone: null,
    tags: [{ type: "allergy", label: "Dairy", detail: "Dairy-free" }],
    notes: "Waiting 1min, quoted 45min",
    bookedVia: "Walk-in",
    confirmationSent: false,
  },
]

// ── Sort order for grouping by status ────────────────────────────────────────

export const STATUS_GROUP_ORDER: ListReservationStatus[] = [
  "arriving",
  "late",
  "confirmed",
  "unconfirmed",
  "seated",
  "completed",
  "no-show",
  "cancelled",
  "waitlist",
]

export const STATUS_GROUP_LABELS: Record<ListReservationStatus, string> = {
  arriving: "Arriving Now",
  late: "Late",
  confirmed: "Upcoming",
  unconfirmed: "Upcoming",
  seated: "Seated",
  completed: "Completed",
  "no-show": "No-Shows",
  cancelled: "Cancelled",
  waitlist: "Waitlist",
}

export type GroupByOption = "status" | "time" | "zone" | "server" | "party-size" | "none"

export const SERVERS = ["Anna", "Mike", "Lisa", "Carlos", "Jordan"] as const
export const ZONES = ["Main", "Patio", "Private"] as const
export const CHANNELS: BookingChannel[] = ["Direct", "Phone", "Google", "Walk-in", "Instagram"]
export const TAG_TYPES: ListTagType[] = ["vip", "birthday", "anniversary", "allergy", "first-timer", "regular", "high-value", "wheelchair", "service-dog"]
export const RISK_LEVELS: ListRiskLevel[] = ["low", "medium", "high"]
export const PARTY_RANGES = ["1-2", "3-4", "5-6", "7+"] as const
export const TIME_RANGES = ["Next 30min", "Next 1hr", "Next 2hr", "All evening"] as const

// ── Status display helpers ───────────────────────────────────────────────────

export function getStatusBadge(status: ListReservationStatus, courseStage?: CourseStage): {
  label: string
  bgClass: string
  textClass: string
  dotClass: string
  dotColor?: string
  pillClass?: string
  rowClass?: string
  cardClass?: string
  pulseClass?: string
  nameClass?: string
  borderStyle?: string
} {
  switch (status) {
    case "arriving":
      return {
        label: "Arriving now",
        bgClass: "bg-amber-500/15",
        textClass: "text-amber-300",
        dotClass: "bg-amber-400",
        dotColor: "#fcd34d",
        pillClass: "border border-amber-400/35 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
        rowClass: "bg-amber-400/[0.14] shadow-[inset_3px_0_0_rgba(251,191,36,0.45)]",
        cardClass: "bg-amber-500/15 border border-amber-500/30 border-l-[3px] border-l-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
        pulseClass: "tl-pulse-arriving-neon",
      }
    case "late":
      return {
        label: "Late",
        bgClass: "bg-rose-500/15",
        textClass: "text-rose-300",
        dotClass: "bg-rose-400",
        dotColor: "#fda4af",
        pillClass: "border border-rose-400/35 shadow-[0_0_14px_rgba(244,63,94,0.25)]",
        rowClass: "bg-rose-400/[0.16] shadow-[inset_3px_0_0_rgba(251,113,133,0.5)]",
        cardClass: "bg-rose-500/15 border border-rose-500/30 border-l-[3px] border-l-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.25)]",
        pulseClass: "tl-pulse-late-neon",
      }
    case "confirmed":
      return {
        label: "Confirmed",
        bgClass: "bg-cyan-500/15",
        textClass: "text-cyan-300",
        dotClass: "bg-cyan-400",
        dotColor: "#67e8f9",
        pillClass: "border border-cyan-400/35 shadow-[0_0_12px_rgba(6,182,212,0.2)]",
        rowClass: "bg-cyan-400/[0.14] shadow-[inset_3px_0_0_rgba(34,211,238,0.45)]",
        cardClass: "bg-cyan-500/15 border border-cyan-500/30 border-l-[3px] border-l-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]",
      }
    case "unconfirmed":
      return {
        label: "Unconfirmed",
        bgClass: "bg-violet-500/15",
        textClass: "text-violet-300",
        dotClass: "bg-violet-300",
        dotColor: "#c4b5fd",
        pillClass: "border border-violet-300/45 border-dashed shadow-[0_0_12px_rgba(139,92,246,0.2)]",
        rowClass: "bg-violet-400/[0.14] shadow-[inset_3px_0_0_rgba(167,139,250,0.45)]",
        cardClass: "bg-violet-400/[0.07] border-[1.5px] border-dashed border-violet-300/45 border-l-[3px] border-l-violet-400 [border-left-style:solid] shadow-[0_0_12px_rgba(139,92,246,0.2)]",
        borderStyle: "dashed dashed dashed solid",
      }
    case "seated": {
      const stageLabels: Record<CourseStage, string> = {
        ordering: "Ordering",
        apps: "Apps",
        mains: "Mains",
        dessert: "Dessert",
        check: "Check",
      }
      const stage = courseStage ? `Seated \u00b7 ${stageLabels[courseStage]}` : "Seated"
      return {
        label: stage,
        bgClass: "bg-emerald-500/15",
        textClass: "text-emerald-300",
        dotClass: "bg-emerald-400",
        dotColor: "#6ee7b7",
        pillClass: "border border-emerald-400/35 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
        rowClass: "bg-emerald-400/[0.14] shadow-[inset_3px_0_0_rgba(52,211,153,0.45)]",
        cardClass: "bg-emerald-500/15 border border-emerald-500/30 border-l-[3px] border-l-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
      }
    }
    case "completed":
      return {
        label: "Completed \u2713",
        bgClass: "bg-zinc-700/10",
        textClass: "text-zinc-500",
        dotClass: "bg-zinc-500/70",
        dotColor: "#71717a",
        pillClass: "border border-zinc-600/30",
        rowClass: "bg-zinc-500/[0.10] shadow-[inset_3px_0_0_rgba(161,161,170,0.35)] opacity-85",
        cardClass: "bg-zinc-700/10 border border-zinc-600/20 border-l-[3px] border-l-zinc-600/30",
      }
    case "no-show":
      return {
        label: "No-Show \u2717",
        bgClass: "bg-rose-500/10",
        textClass: "text-rose-300/80",
        dotClass: "bg-rose-500",
        dotColor: "rgba(253, 164, 175, 0.8)",
        pillClass: "border border-rose-400/30",
        rowClass: "bg-gradient-to-r from-rose-400/[0.14] to-zinc-700/[0.06] shadow-[inset_3px_0_0_rgba(244,63,94,0.4)]",
        cardClass: "bg-gradient-to-r from-rose-500/10 to-zinc-700/10 border border-rose-500/20 border-l-[3px] border-l-rose-500/30",
        nameClass: "line-through text-zinc-500",
      }
    case "cancelled":
      return {
        label: "Cancelled",
        bgClass: "bg-zinc-700/10",
        textClass: "text-zinc-500",
        dotClass: "bg-zinc-600",
        dotColor: "#52525b",
        pillClass: "border border-zinc-600/25",
        rowClass: "bg-zinc-500/[0.12] shadow-[inset_3px_0_0_rgba(113,113,122,0.4)] opacity-90",
        cardClass: "bg-zinc-700/10 border border-zinc-600/20",
      }
    case "waitlist":
      return {
        label: "Waitlist",
        bgClass: "bg-orange-500/15",
        textClass: "text-orange-300",
        dotClass: "bg-orange-300",
        dotColor: "#fdba74",
        pillClass: "border border-orange-400/30",
        rowClass: "bg-orange-400/[0.14] shadow-[inset_3px_0_0_rgba(251,146,60,0.45)]",
        cardClass: "bg-orange-500/12 border border-orange-500/25",
      }
  }
}

export function getRiskDisplay(risk: ListRiskLevel): { label: string; dotClass: string } {
  switch (risk) {
    case "low": return { label: "Low", dotClass: "bg-emerald-400" }
    case "medium": return { label: "Med", dotClass: "bg-amber-400" }
    case "high": return { label: "High", dotClass: "bg-rose-400" }
  }
}

export function getTagIcon(type: ListTagType): string {
  switch (type) {
    case "vip": return "star"
    case "birthday": return "cake"
    case "anniversary": return "heart"
    case "allergy": return "alert"
    case "first-timer": return "sparkles"
    case "regular": return "repeat"
    case "high-value": return "dollar"
    case "wheelchair": return "wheelchair"
    case "service-dog": return "paw"
  }
}

/** Compact sitting length for lists and detail headers (e.g. `90m`, `1h 30m`). */
export function formatReservationDurationCompact(minutes: number | undefined | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "-"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatTime12h(time24: string): string {
  const parts = time24.split(":")
  const h = Number(parts[0])
  const m = parts[1] != null ? Number(parts[1]) : 0
  if (Number.isNaN(h) || Number.isNaN(m)) return time24
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  const ampm = h >= 12 ? "PM" : "AM"
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`
}

export function formatTimeShort(time24: string): string {
  const parts = time24.split(":")
  const h = Number(parts[0])
  const m = parts[1] != null ? Number(parts[1]) : 0
  if (Number.isNaN(h) || Number.isNaN(m)) return time24
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, "0")}`
}

/** Group reservations by given option */
export function groupReservations(
  reservations: ListReservation[],
  groupBy: GroupByOption
): { label: string; reservations: ListReservation[] }[] {
  if (groupBy === "none") {
    return [{ label: "", reservations }]
  }

  const map = new Map<string, ListReservation[]>()

  for (const r of reservations) {
    let key: string
    switch (groupBy) {
      case "status":
        key = STATUS_GROUP_LABELS[r.status]
        break
      case "time": {
        const parts = r.time.split(":")
        const h = Number(parts[0])
        const m = parts[1] != null ? Number(parts[1]) : 0
        if (Number.isNaN(h) || Number.isNaN(m)) {
          key = "-"
          break
        }
        const slot = Math.floor(m / 30) * 30
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
        key = `${h12}:${slot.toString().padStart(2, "0")}`
        break
      }
      case "zone":
        key = r.zone ?? "Unassigned"
        break
      case "server":
        key = r.server ?? "Unassigned"
        break
      case "party-size":
        if (r.partySize <= 2) key = "1-2 guests"
        else if (r.partySize <= 4) key = "3-4 guests"
        else if (r.partySize <= 6) key = "5-6 guests"
        else key = "7+ guests"
        break
      default:
        key = ""
    }
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }

  // Sort groups: show every group that has at least one item; for status use fixed order
  if (groupBy === "status") {
    const groupOrder = ["Waitlist", "Arriving Now", "Late", "Upcoming", "Seated", "Completed", "No-Shows", "Cancelled"]
    const ordered = groupOrder
      .filter((label) => map.has(label) && (map.get(label)?.length ?? 0) > 0)
      .map((label) => ({ label, reservations: map.get(label)! }))
    // Include any other groups present in data but not in fixed order (so nothing with items is hidden)
    const orderedLabels = new Set(ordered.map((g) => g.label))
    for (const [label, list] of map.entries()) {
      if (list.length > 0 && !orderedLabels.has(label)) {
        ordered.push({ label, reservations: list })
        orderedLabels.add(label)
      }
    }
    return ordered
  }

  return Array.from(map.entries())
    .filter(([, reservations]) => reservations.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, reservations]) => ({ label, reservations }))
}

/** Compute summary counts */
export function getListSummary(reservations: ListReservation[]) {
  const totalRes = reservations.length
  const totalCovers = reservations.reduce((sum, r) => sum + r.partySize, 0)
  const statusCounts: Partial<Record<ListReservationStatus, number>> = {}
  for (const r of reservations) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
  }
  return { totalRes, totalCovers, statusCounts }
}
