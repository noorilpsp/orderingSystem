// ── Types ────────────────────────────────────────────────────────────────────

import { formatMerchantMoney } from "@/lib/merchant-localization"

export type MyTableStatus = "urgent" | "warning" | "active" | "good" | "new"
export type WaveType = "drinks" | "food" | "dessert"
export type WaveProgressStatus = "served" | "ready" | "preparing" | "held"
export type BadgeType = "allergy" | "notes" | "quick" | "relaxed" | "vip" | "birthday"

export interface WaveProgress {
  type: WaveType
  status: WaveProgressStatus
}

export interface TableAlert {
  type: "food_ready" | "no_checkin" | "waiting"
  message: string
  time: string
}

export interface MyTable {
  id: string
  number: number
  guestCount: number
  seatedAt: string
  lastCheckIn: string
  status: MyTableStatus
  bill: number
  pacing: "quick" | "relaxed" | null
  waves: WaveProgress[]
  alerts: TableAlert[]
  badges: BadgeType[]
  hasAllergy?: boolean
  hasNotes?: boolean
  isVip?: boolean
}

export interface ServerInfo {
  id: string
  name: string
  section: string
}

export interface QuickStats {
  tablesOccupied: number
  tablesTotal: number
  totalGuests: number
  sales: number
  avgTurnTime: number
  foodReady: number
}

export interface MyTablesData {
  server: ServerInfo
  stats: QuickStats
  tables: MyTable[]
}

// ── Config Maps ──────────────────────────────────────────────────────────────

export const myTableStatusConfig: Record<
  MyTableStatus,
  {
    borderClass: string
    bgClass: string
    label: string
    sortOrder: number
  }
> = {
  urgent: {
    borderClass: "border-l-red-500",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    label: "Urgent",
    sortOrder: 0,
  },
  warning: {
    borderClass: "border-l-orange-500",
    bgClass: "bg-orange-50 dark:bg-orange-950/30",
    label: "Warning",
    sortOrder: 1,
  },
  active: {
    borderClass: "border-l-yellow-500",
    bgClass: "bg-card",
    label: "Active",
    sortOrder: 2,
  },
  good: {
    borderClass: "border-l-emerald-500",
    bgClass: "bg-card",
    label: "Good",
    sortOrder: 3,
  },
  new: {
    borderClass: "border-l-blue-500",
    bgClass: "bg-card",
    label: "New",
    sortOrder: 4,
  },
}

export const waveProgressIcons: Record<WaveType, string> = {
  drinks: "Drinks",
  food: "Food",
  dessert: "Dessert",
}

export const waveProgressStatusConfig: Record<
  WaveProgressStatus,
  { colorClass: string; bgClass: string; label: string }
> = {
  served: { colorClass: "text-emerald-600", bgClass: "bg-emerald-500", label: "Served" },
  ready: { colorClass: "text-red-600", bgClass: "bg-red-500", label: "Ready" },
  preparing: { colorClass: "text-amber-600", bgClass: "bg-amber-500", label: "Preparing" },
  held: { colorClass: "text-muted-foreground", bgClass: "bg-muted-foreground/40", label: "Not Started" },
}

export const badgeConfig: Record<BadgeType, { label: string; icon: string }> = {
  allergy: { label: "Allergy", icon: "allergy" },
  notes: { label: "Notes", icon: "notes" },
  quick: { label: "Quick", icon: "quick" },
  relaxed: { label: "Relaxed", icon: "relaxed" },
  vip: { label: "VIP", icon: "vip" },
  birthday: { label: "Birthday", icon: "birthday" },
}

export type FilterOption = "all" | "urgent" | "food_ready" | "active" | "good"
export type SortOption = "attention" | "newest" | "oldest" | "table_number"

// ── Mock Data ────────────────────────────────────────────────────────────────

export const myTablesData: MyTablesData = {
  server: {
    id: "s1",
    name: "Sarah",
    section: "A",
  },
  stats: {
    tablesOccupied: 5,
    tablesTotal: 8,
    totalGuests: 18,
    sales: 847.5,
    avgTurnTime: 34,
    foodReady: 2,
  },
  tables: [
    {
      id: "t12",
      number: 12,
      guestCount: 4,
      seatedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      lastCheckIn: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      status: "urgent",
      bill: 127.5,
      pacing: "relaxed",
      waves: [
        { type: "drinks", status: "served" },
        { type: "food", status: "ready" },
        { type: "dessert", status: "held" },
      ],
      alerts: [{ type: "food_ready", message: "Food ready!", time: "4m ago" }],
      badges: ["allergy", "notes"],
      hasAllergy: true,
      hasNotes: true,
    },
    {
      id: "t7",
      number: 7,
      guestCount: 2,
      seatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      lastCheckIn: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      status: "warning",
      bill: 64.0,
      pacing: "quick",
      waves: [
        { type: "drinks", status: "served" },
        { type: "food", status: "preparing" },
      ],
      alerts: [{ type: "no_checkin", message: "No check-in", time: "12m" }],
      badges: ["quick"],
    },
    {
      id: "t3",
      number: 3,
      guestCount: 3,
      seatedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      lastCheckIn: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      status: "good",
      bill: 156.0,
      pacing: "relaxed",
      waves: [
        { type: "drinks", status: "served" },
        { type: "food", status: "served" },
        { type: "dessert", status: "preparing" },
      ],
      alerts: [],
      badges: ["vip", "birthday"],
      isVip: true,
    },
    {
      id: "t5",
      number: 5,
      guestCount: 2,
      seatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      lastCheckIn: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: "new",
      bill: 0,
      pacing: null,
      waves: [{ type: "drinks", status: "held" }],
      alerts: [],
      badges: [],
    },
    {
      id: "t9",
      number: 9,
      guestCount: 6,
      seatedAt: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
      lastCheckIn: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      status: "active",
      bill: 234.5,
      pacing: "relaxed",
      waves: [
        { type: "drinks", status: "served" },
        { type: "food", status: "preparing" },
        { type: "dessert", status: "held" },
      ],
      alerts: [],
      badges: ["allergy", "notes"],
      hasAllergy: true,
    },
  ],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function minutesAgo(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000)
}

export function formatCurrency(
  amount: number,
  currency: string = "EUR",
  numberFormat?: string | null,
): string {
  return formatMerchantMoney(amount, { currency, numberFormat })
}

export function sortTablesByAttention(tables: MyTable[]): MyTable[] {
  return [...tables].sort(
    (a, b) =>
      myTableStatusConfig[a.status].sortOrder -
      myTableStatusConfig[b.status].sortOrder
  )
}

export function filterTables(
  tables: MyTable[],
  filter: FilterOption
): MyTable[] {
  switch (filter) {
    case "urgent":
      return tables.filter((t) => t.status === "urgent")
    case "food_ready":
      return tables.filter((t) =>
        t.waves.some((w) => w.status === "ready")
      )
    case "active":
      return tables.filter(
        (t) => t.status === "active" || t.status === "warning"
      )
    case "good":
      return tables.filter((t) => t.status === "good")
    default:
      return tables
  }
}

export function sortTables(
  tables: MyTable[],
  sort: SortOption
): MyTable[] {
  const sorted = [...tables]
  switch (sort) {
    case "attention":
      return sortTablesByAttention(sorted)
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.seatedAt).getTime() - new Date(a.seatedAt).getTime()
      )
    case "oldest":
      return sorted.sort(
        (a, b) =>
          new Date(a.seatedAt).getTime() - new Date(b.seatedAt).getTime()
      )
    case "table_number":
      return sorted.sort((a, b) => a.number - b.number)
    default:
      return sorted
  }
}
