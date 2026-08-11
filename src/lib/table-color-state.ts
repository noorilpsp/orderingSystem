import type { FloorTableStatus } from "@/lib/floor-map-data"
import type { DetailAlert, Wave } from "@/lib/table-detail-data"
import type { TableStatus } from "@/lib/table-data"

export type TableColorState =
  | "available"
  | "reserved"
  | "occupied"
  | "food_ready"
  | "bill_requested"
  | "needs_attention"
  | "cleaning"

type TableColorVisual = {
  label: string
  fill: string
  ringClass: string
  glow: string
  textClass: string
  dotClass: string
  pulse?: boolean
}

export const TABLE_COLOR_STATES: Record<TableColorState, TableColorVisual> = {
  available: {
    label: "Available",
    fill: "hsl(150, 44%, 25%)",
    ringClass: "ring-emerald-400/35",
    glow: "0 0 16px 2px rgba(52,211,153,0.2), inset 0 0 10px rgba(52,211,153,0.06)",
    textClass: "text-emerald-300",
    dotClass: "bg-emerald-400",
  },
  reserved: {
    label: "Reserved",
    fill: "hsl(268, 36%, 27%)",
    ringClass: "ring-violet-400/45",
    glow: "0 0 18px 3px rgba(167,139,250,0.24), inset 0 0 12px rgba(139,92,246,0.08)",
    textClass: "text-violet-300",
    dotClass: "bg-violet-400",
  },
  occupied: {
    label: "Occupied",
    fill: "hsl(212, 48%, 27%)",
    ringClass: "ring-sky-400/35",
    glow: "0 0 18px 3px rgba(96,165,250,0.22), inset 0 0 12px rgba(96,165,250,0.08)",
    textClass: "text-sky-300",
    dotClass: "bg-sky-400",
  },
  food_ready: {
    label: "Food Ready",
    fill: "hsl(46, 74%, 30%)",
    ringClass: "ring-yellow-400/40",
    glow: "0 0 18px 3px rgba(250,204,21,0.26), inset 0 0 12px rgba(250,204,21,0.08)",
    textClass: "text-yellow-200",
    dotClass: "bg-yellow-300",
  },
  bill_requested: {
    label: "Bill Requested",
    fill: "hsl(28, 72%, 29%)",
    ringClass: "ring-orange-400/40",
    glow: "0 0 18px 3px rgba(251,146,60,0.24), inset 0 0 12px rgba(251,146,60,0.08)",
    textClass: "text-orange-300",
    dotClass: "bg-orange-400",
  },
  needs_attention: {
    label: "Needs Server",
    fill: "hsl(0, 56%, 28%)",
    ringClass: "ring-red-500/55",
    glow: "0 0 24px 6px rgba(248,113,113,0.32), inset 0 0 14px rgba(248,113,113,0.12)",
    textClass: "text-red-300",
    dotClass: "bg-red-400 animate-pulse",
    pulse: true,
  },
  cleaning: {
    label: "Cleaning",
    fill: "hsl(220, 8%, 25%)",
    ringClass: "ring-slate-400/25",
    glow: "0 0 10px 1px rgba(148,163,184,0.12)",
    textClass: "text-slate-300",
    dotClass: "bg-slate-400/70",
  },
}

// Softer, card-friendly variants of the same status colors for grid/list UIs.
export const TABLE_CARD_COLOR_STATES: Record<
  TableColorState,
  { bgClass: string; borderClass: string; textClass: string; dotClass: string }
> = {
  available: {
    bgClass: "bg-emerald-500/5",
    borderClass: "border-emerald-400/40",
    textClass: "text-emerald-300",
    dotClass: "bg-emerald-400",
  },
  reserved: {
    bgClass: "bg-violet-500/7",
    borderClass: "border-violet-400/45",
    textClass: "text-violet-300",
    dotClass: "bg-violet-400",
  },
  occupied: {
    bgClass: "bg-sky-500/6",
    borderClass: "border-sky-400/45",
    textClass: "text-sky-300",
    dotClass: "bg-sky-400",
  },
  food_ready: {
    bgClass: "bg-yellow-500/8",
    borderClass: "border-yellow-400/45",
    textClass: "text-yellow-200",
    dotClass: "bg-yellow-300",
  },
  bill_requested: {
    bgClass: "bg-orange-500/8",
    borderClass: "border-orange-400/50",
    textClass: "text-orange-300",
    dotClass: "bg-orange-400",
  },
  needs_attention: {
    bgClass: "bg-red-500/10",
    borderClass: "border-red-400/60",
    textClass: "text-red-300",
    dotClass: "bg-red-400",
  },
  cleaning: {
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-400/40",
    textClass: "text-slate-300",
    dotClass: "bg-slate-400/70",
  },
}

type FloorTableColorInput = {
  status: FloorTableStatus
  reserved?: boolean
  alerts?: DetailAlert[]
  waves?: Wave[]
  stage?: string | null
}

function hasAttentionAlert(alerts: DetailAlert[] = []): boolean {
  return alerts.some((alert) => {
    const message = alert.message.toLowerCase()
    return (
      alert.type === "no_checkin" ||
      alert.type === "kitchen_delay" ||
      message.includes("waiting for service")
    )
  })
}

function hasFoodReadySignal(alerts: DetailAlert[] = [], waves: Wave[] = []): boolean {
  return (
    alerts.some((alert) => alert.type === "food_ready") ||
    waves.some((wave) => wave.status === "ready")
  )
}

function hasBillRequestedSignal(alerts: DetailAlert[] = []): boolean {
  return alerts.some(
    (alert) =>
      alert.type === "bill_requested" && !alert.message.toLowerCase().includes("waiting for service")
  )
}

export function getFloorTableColorState({
  status,
  reserved,
  alerts = [],
  waves = [],
  stage = null,
}: FloorTableColorInput): TableColorState {
  if (status === "urgent" || hasAttentionAlert(alerts)) return "needs_attention"
  if (status === "billing" || stage === "bill" || hasBillRequestedSignal(alerts)) {
    return "bill_requested"
  }
  if (hasFoodReadySignal(alerts, waves)) return "food_ready"
  if (status === "active") return "occupied"
  if (status === "free" && reserved) return "reserved"
  if (status === "free") return "available"
  return "cleaning"
}

export function getTableDetailColorState(status: TableStatus): TableColorState {
  switch (status) {
    case "food_ready":
      return "food_ready"
    case "bill_requested":
      return "bill_requested"
    case "needs_attention":
      return "needs_attention"
    case "available":
      return "available"
    default:
      return "occupied"
  }
}

export function isOccupiedColorState(state: TableColorState): boolean {
  return state === "occupied" || state === "food_ready" || state === "bill_requested" || state === "needs_attention"
}
