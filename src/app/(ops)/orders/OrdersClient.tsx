"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/**
 * Extract error message from API payload. Handles { error: { message?: string } }.
 * Returns fallback when payload shape is unexpected.
 */
function getPayloadErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback
  const err = (payload as { error?: unknown }).error
  if (!err || typeof err !== "object" || !("message" in err)) return fallback
  const msg = (err as { message?: unknown }).message
  return typeof msg === "string" && msg.trim() ? msg : fallback
}
import Link from "next/link"
import { AlertTriangle, Armchair, Banknote, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock3, CreditCard, Flame, HandPlatter, MoreHorizontal, Search, ShoppingBag, Store, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"

import { IncomingOrderOverlay, IncomingWaitingBadge } from "@/components/orders/incoming-order-overlay"
import { ServiceRequestBanner } from "@/components/orders/service-request-banner"
import { OrdersStaffMenu } from "@/components/orders/orders-staff-menu"
import { OpsCustomizationDisplayLines } from "@/components/shared/customization-display-lines"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { fetchPos } from "@/lib/pos/fetchPos"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { CatalogI18n } from "@/lib/catalog-i18n"
import {
  opsGuestCountLabel,
  opsItemsCountLabel,
  opsOrderMatchesQuery,
  opsTableWithCodeLabel,
  resolveOpsCatalogName,
  useStaffLocale,
  type OpsLocale,
  type OpsTranslate,
} from "@/lib/ops-i18n"
import {
  createIncomingOrderAlertSound,
  notifyIncomingOrderAlert,
  primeIncomingOrderAlertAudio,
} from "@/lib/orders/incoming-order-alert-sound"
import type { OrdersStaffProfile } from "@/lib/orders/getOrdersStaffProfile"
import { isOrdersView, type OrdersServiceRequest, type OrdersView } from "@/lib/orders/ordersView"
import { extractTableCode, mergeServedTableTicketsForBoard, formatTableSeatGuestLabel } from "@/lib/orders/buildTableCheckOrder"
import { groupOpsOrderItems } from "@/lib/orders/groupOpsOrderItems"

type OrderSource = "table" | "pickup" | "dine_in_no_table"
type UnifiedStatus = "sent" | "preparing" | "ready" | "served" | "voided" | "refunded"
type LocalWaveStatus = "served" | "ready" | "cooking" | "fired" | "held" | "not_started"
type PaymentState = "paid" | "unpaid"
type PaymentMethod = "card" | "cash" | "other" | null

type UnifiedOrder = {
  id: string
  source: OrderSource
  label: string
  sectionLabel: string
  guestLabel: string
  status: UnifiedStatus
  createdAt: number
  updatedAt: number
  stageEnteredAt?: Partial<Record<"sent" | "preparing" | "ready" | "served", number>>
  subtotal?: number
  taxAmount?: number
  total: number
  itemCount: number
  items: Array<{
    id: string
    name: string
    itemId?: string | null
    i18n?: CatalogI18n | null
    qty: number
    status: string
    price: number
    notes?: string | null
    seatNumber?: number | null
    seatGuestName?: string | null
    customizations?: Array<{
      groupName: string
      optionName: string
      optionPrice: number
      quantity: number
      groupId?: string | null
      optionId?: string | null
      groupI18n?: CatalogI18n | null
      optionI18n?: CatalogI18n | null
    }>
  }>
  waves: Array<{ number: number; status: LocalWaveStatus }>
  tableId?: string
  sessionId?: string
  orderId?: string
  waveNumber?: number
  memberOrderIds?: string[]
  note?: string
  scheduledPickupAt?: number | null
  scheduledParked?: boolean
  paymentState?: PaymentState
  paymentMethod?: PaymentMethod
  targetEtaMinutes?: number
  needsAccept?: boolean
}

type BoardMode = "live" | "history" | "scheduled"

const ORDERS_POLL_MS = 5_000
const INCOMING_SNOOZE_MS = 30_000

/** Counter-flow rank so we never let a stale poll/rollback move an order backwards. */
const COUNTER_STATUS_RANK: Record<UnifiedStatus, number> = {
  sent: 0,
  preparing: 1,
  ready: 2,
  served: 3,
  voided: 4,
  refunded: 4,
}

function counterStatusRank(status: UnifiedStatus): number {
  return COUNTER_STATUS_RANK[status] ?? 0
}

function mergeOrdersViewWithLocal(
  local: OrdersView,
  server: OrdersView,
  protectedOrderIds: Set<string>
): OrdersView {
  const localById = new Map(local.orders.map((order) => [order.id, order]))
  const mergedOrders = server.orders.map((serverOrder) => {
    const localOrder = localById.get(serverOrder.id)
    if (!localOrder) return serverOrder
    const protectStatus =
      protectedOrderIds.has(serverOrder.id) ||
      counterStatusRank(localOrder.status) > counterStatusRank(serverOrder.status)
    // Keep optimistic Paid until the server catches up (Mark paid → History).
    const protectPayment =
      protectedOrderIds.has(serverOrder.id) ||
      (localOrder.paymentState === "paid" && serverOrder.paymentState !== "paid")

    if (!protectStatus && !protectPayment) return serverOrder

    return {
      ...serverOrder,
      status: protectStatus ? localOrder.status : serverOrder.status,
      paymentState: protectPayment
        ? localOrder.paymentState
        : serverOrder.paymentState,
      paymentMethod: protectPayment
        ? localOrder.paymentMethod
        : serverOrder.paymentMethod,
      updatedAt: Math.max(localOrder.updatedAt, serverOrder.updatedAt),
      stageEnteredAt: {
        ...serverOrder.stageEnteredAt,
        ...localOrder.stageEnteredAt,
      },
      items: localOrder.items.length > 0 ? localOrder.items : serverOrder.items,
      targetEtaMinutes: localOrder.targetEtaMinutes ?? serverOrder.targetEtaMinutes,
    }
  })

  // Keep optimistic local rows the server has not returned yet (rare).
  for (const localOrder of local.orders) {
    if (!mergedOrders.some((order) => order.id === localOrder.id)) {
      mergedOrders.push(localOrder)
    }
  }

  return {
    ...server,
    orders: mergedOrders,
    channels: server.channels ?? local.channels,
    defaultPrepMinutes: server.defaultPrepMinutes ?? local.defaultPrepMinutes,
    serviceRequests: server.serviceRequests ?? local.serviceRequests ?? [],
  }
}

function sourceLabelFor(t: OpsTranslate, source: OrderSource): string {
  switch (source) {
    case "table":
      return t("source.table")
    case "pickup":
      return t("source.pickup")
    case "dine_in_no_table":
      return t("source.dine")
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}

/** Source chip text — table orders include the table code (e.g. "Table T5"). */
function sourceBadgeLabel(
  order: Pick<UnifiedOrder, "source" | "label" | "guestLabel">,
  t: OpsTranslate,
): string {
  if (order.source !== "table") return sourceLabelFor(t, order.source)
  const code = extractTableCode(order)
  return opsTableWithCodeLabel(t, code)
}

function localizeTableGuestLabel(t: OpsTranslate, label: string): string {
  const guests = opsGuestCountLabel(t, label)
  if (guests !== label) return guests
  return label.replace(/^Table\s+/i, `${t("source.table")} `)
}

/** Card subtitle: Table Tx · Sx · Name for kitchen tickets; table checks stay Table Tx only. */
function orderCardGuestLine(order: UnifiedOrder, t: OpsTranslate): string {
  if (order.source !== "table") return localizeTableGuestLabel(t, order.guestLabel)
  const code = extractTableCode(order)
  const tableOnly = opsTableWithCodeLabel(t, code)
  if (isTableCheck(order)) return tableOnly
  const fromItems = formatTableSeatGuestLabel(code, order.items)
  if (order.items.some((item) => item.seatNumber != null && item.seatNumber > 0)) {
    return localizeTableGuestLabel(t, fromItems)
  }
  return localizeTableGuestLabel(t, order.guestLabel || fromItems)
}

const sourceChipClass: Record<OrderSource, string> = {
  table: "border-cyan-300/45 bg-cyan-500/12 text-cyan-100",
  pickup: "border-violet-300/45 bg-violet-500/12 text-violet-100",
  dine_in_no_table: "border-amber-300/45 bg-amber-500/12 text-amber-100",
}

const liveStatusOrder: UnifiedStatus[] = ["ready", "preparing", "sent", "served"]
const liveStatusFilterOrder: UnifiedStatus[] = ["sent", "preparing", "ready", "served"]
const historyStatusOrder: UnifiedStatus[] = ["served", "voided", "refunded"]

const statusChipClass: Record<UnifiedStatus, string> = {
  sent: "border-sky-300/45 bg-sky-500/12 text-sky-100",
  preparing: "border-amber-300/45 bg-amber-500/12 text-amber-100",
  ready: "border-red-300/45 bg-red-500/12 text-red-100",
  served: "border-emerald-300/45 bg-emerald-500/12 text-emerald-100",
  voided: "border-red-400/40 bg-red-500/10 text-red-200",
  refunded: "border-fuchsia-300/45 bg-fuchsia-500/12 text-fuchsia-100",
}

const statusFilterToneClass: Record<
  UnifiedStatus,
  { active: string; idle: string }
> = {
  sent: {
    active: "border-sky-300/60 bg-sky-500/22 text-sky-100",
    idle: "border-sky-300/35 bg-sky-500/10 text-sky-200/85 hover:bg-sky-500/16",
  },
  preparing: {
    active: "border-amber-300/60 bg-amber-500/22 text-amber-100",
    idle: "border-amber-300/35 bg-amber-500/10 text-amber-200/85 hover:bg-amber-500/16",
  },
  ready: {
    active: "border-red-300/60 bg-red-500/22 text-red-100",
    idle: "border-red-300/35 bg-red-500/10 text-red-200/85 hover:bg-red-500/16",
  },
  served: {
    active: "border-emerald-300/60 bg-emerald-500/22 text-emerald-100",
    idle: "border-emerald-300/35 bg-emerald-500/10 text-emerald-200/85 hover:bg-emerald-500/16",
  },
  voided: {
    active: "border-rose-300/55 bg-rose-500/20 text-rose-100",
    idle: "border-rose-300/35 bg-rose-500/10 text-rose-200/80 hover:bg-rose-500/16",
  },
  refunded: {
    active: "border-fuchsia-300/55 bg-fuchsia-500/20 text-fuchsia-100",
    idle: "border-fuchsia-300/35 bg-fuchsia-500/10 text-fuchsia-200/80 hover:bg-fuchsia-500/16",
  },
}

const waveChipClass: Record<LocalWaveStatus, string> = {
  served: "border-emerald-400/55 bg-emerald-500/14 text-emerald-300",
  ready: "border-red-400/55 bg-red-500/14 text-red-300",
  cooking: "border-amber-400/55 bg-amber-500/14 text-amber-300",
  fired: "border-sky-400/55 bg-sky-500/14 text-sky-300",
  held: "border-white/15 bg-white/[0.04] text-muted-foreground",
  not_started: "border-white/10 bg-white/[0.02] text-muted-foreground/60",
}

type OrderTone = "urgent" | "active" | "served" | "billing" | "closed" | "voided" | "refunded" | "completed_history"

const statusTone: Record<UnifiedStatus, OrderTone> = {
  ready: "urgent",
  preparing: "active",
  sent: "billing",
  served: "served",
  voided: "voided",
  refunded: "refunded",
}

const toneBorderClass: Record<OrderTone, string> = {
  urgent: "border-s-red-400/80",
  active: "border-s-amber-400/60",
  served: "border-s-emerald-400/70",
  billing: "border-s-blue-400/60",
  closed: "border-s-slate-300/55",
  voided: "border-s-rose-400/70",
  refunded: "border-s-fuchsia-400/70",
  completed_history: "border-s-indigo-400/75",
}

const toneDotClass: Record<OrderTone, string> = {
  urgent: "bg-red-400",
  active: "bg-amber-400",
  served: "bg-emerald-400",
  billing: "bg-blue-400",
  closed: "bg-slate-300",
  voided: "bg-rose-400",
  refunded: "bg-fuchsia-400",
  completed_history: "bg-indigo-400",
}

const toneTextClass: Record<OrderTone, string> = {
  urgent: "text-red-400",
  active: "text-amber-400",
  served: "text-emerald-400",
  billing: "text-blue-400",
  closed: "text-slate-300",
  voided: "text-rose-400",
  refunded: "text-fuchsia-400",
  completed_history: "text-indigo-300",
}

const toneGlowClass: Record<OrderTone, string> = {
  urgent: "shadow-[inset_0_0_0_1px_hsl(var(--glow-urgent)/0.15)]",
  active: "",
  served: "",
  billing: "",
  closed: "",
  voided: "",
  refunded: "",
  completed_history: "",
}

const toneAccentColor: Record<OrderTone, string> = {
  urgent: "#f87171",
  active: "#fbbf24",
  served: "#34d399",
  billing: "#60a5fa",
  closed: "#cbd5e1",
  voided: "#fb7185",
  refunded: "#e879f9",
  completed_history: "#818cf8",
}

const toneAccentBg: Record<OrderTone, string> = {
  urgent: "#f8717120",
  active: "#fbbf2420",
  served: "#34d39920",
  billing: "#60a5fa20",
  closed: "#cbd5e120",
  voided: "#fb718520",
  refunded: "#e879f920",
  completed_history: "#818cf820",
}

const historyCompletedTone = {
  chipClass: "border-indigo-300/45 bg-indigo-500/12 text-indigo-100",
  filterActive: "border-indigo-300/60 bg-indigo-500/22 text-indigo-100",
  filterIdle: "border-indigo-300/35 bg-indigo-500/10 text-indigo-200/85 hover:bg-indigo-500/16",
  accent: "#818cf8",
  accentBg: "#818cf820",
}

const paymentStateClass: Record<PaymentState, string> = {
  paid: "border-emerald-300/55 bg-emerald-500/14 text-emerald-200",
  unpaid: "border-amber-300/55 bg-amber-500/14 text-amber-200",
}

const paymentMethodClass: Record<Exclude<PaymentMethod, null>, string> = {
  card: "border-sky-300/55 bg-sky-500/14 text-sky-200",
  cash: "border-emerald-300/55 bg-emerald-500/14 text-emerald-200",
  other: "border-violet-300/55 bg-violet-500/14 text-violet-200",
}

function minutesAgo(ts: number): number {
  return Math.max(0, Math.round((Date.now() - ts) / 60000))
}

function statusChipLabel(status: UnifiedStatus, t: OpsTranslate, historyCompleted = false): string {
  if (historyCompleted) return t("status.completed")
  switch (status) {
    case "sent":
      return t("status.new")
    case "preparing":
      return t("status.preparing")
    case "ready":
      return t("status.ready")
    case "served":
      return t("status.served")
    case "voided":
      return t("status.voided")
    case "refunded":
      return t("status.refunded")
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function statusGroupLabel(status: UnifiedStatus, t: OpsTranslate, historyCompleted = false): string {
  if (historyCompleted) return t("group.completed")
  switch (status) {
    case "sent":
      return t("group.new")
    case "preparing":
      return t("group.preparing")
    case "ready":
      return t("group.urgent")
    case "served":
      return t("group.served")
    case "voided":
      return t("group.voided")
    case "refunded":
      return t("group.refunded")
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function formatItemStatusLabel(status: string, t: OpsTranslate): string {
  return statusChipLabel(itemStatusToUnified(status), t)
}

function paymentMethodLabel(method: Exclude<PaymentMethod, null>, t: OpsTranslate): string {
  switch (method) {
    case "card":
      return t("payment.card")
    case "cash":
      return t("payment.cash")
    case "other":
      return t("payment.other")
    default: {
      const _exhaustive: never = method
      return _exhaustive
    }
  }
}

function formatScheduledPickupWhen(
  ms: number | null | undefined,
  locale: OpsLocale,
  t: OpsTranslate,
): string {
  if (ms == null) return t("status.scheduled")
  return new Date(ms).toLocaleString(locale === "ar" ? "ar" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function itemStatusToUnified(status: string): UnifiedStatus {
  if (status === "held" || status === "pending" || status === "sent") return "sent"
  if (status === "preparing" || status === "cooking") return "preparing"
  if (status === "ready") return "ready"
  if (status === "served") return "served"
  if (status === "voided") return "voided"
  if (status === "refunded") return "refunded"
  return "sent"
}

type UnifiedOrderItem = UnifiedOrder["items"][number]

type SeatItemGroup = {
  key: string
  seatNumber: number | null
  seatGuestName: string | null
  items: Array<{ item: UnifiedOrderItem; index: number }>
  total: number
}

function groupOrderItemsBySeat(items: UnifiedOrderItem[]): SeatItemGroup[] {
  const groups = new Map<string, SeatItemGroup>()

  items.forEach((item, index) => {
    const hasSeat = item.seatNumber != null && item.seatNumber > 0
    const key = hasSeat ? `seat-${item.seatNumber}` : "unassigned"
    const existing = groups.get(key)
    if (existing) {
      existing.items.push({ item, index })
      existing.total += item.price
      if (!existing.seatGuestName && item.seatGuestName) {
        existing.seatGuestName = item.seatGuestName
      }
      return
    }
    groups.set(key, {
      key,
      seatNumber: hasSeat ? item.seatNumber! : null,
      seatGuestName: item.seatGuestName ?? null,
      items: [{ item, index }],
      total: item.price,
    })
  })

  return Array.from(groups.values()).sort((a, b) => {
    if (a.seatNumber == null && b.seatNumber == null) return 0
    if (a.seatNumber == null) return 1
    if (b.seatNumber == null) return -1
    return a.seatNumber - b.seatNumber
  })
}

function formatMinutesCompact(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes))
  if (safe < 60) return `${safe}m`

  const totalHours = Math.floor(safe / 60)
  if (totalHours < 24) {
    const minutes = safe % 60
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`
  }

  const totalDays = Math.floor(totalHours / 24)
  if (totalDays < 7) {
    const hours = totalHours % 24
    return hours > 0 ? `${totalDays}d ${hours}h` : `${totalDays}d`
  }

  const totalWeeks = Math.floor(totalDays / 7)
  if (totalWeeks < 5) {
    const days = totalDays % 7
    return days > 0 ? `${totalWeeks}w ${days}d` : `${totalWeeks}w`
  }

  const totalMonths = Math.floor(totalDays / 30)
  if (totalMonths < 12) {
    return `${totalMonths}mo`
  }

  const years = Math.floor(totalDays / 365)
  return `${years}y`
}

const counterStatusFlow: UnifiedStatus[] = ["sent", "preparing", "ready", "served"]

type CounterStageKey = "sent" | "preparing" | "ready" | "served"

function getCounterFlowIndex(status: UnifiedStatus): number {
  const index = counterStatusFlow.indexOf(status)
  if (index >= 0) return index
  if (status === "refunded" || status === "voided") return counterStatusFlow.length - 1
  return 0
}

function getStageEnteredAt(
  order: UnifiedOrder,
  stage: CounterStageKey
): number | null {
  const fromMap = order.stageEnteredAt?.[stage]
  if (typeof fromMap === "number" && fromMap > 0) return fromMap
  if (stage === "sent" && order.createdAt > 0) return order.createdAt
  return null
}

/** Real minutes spent in each meal-progress stage (completed + current). */
function getCounterStageMinutes(
  order: UnifiedOrder,
  nowMs: number
): Array<number | null> {
  const flowIndex = getCounterFlowIndex(order.status)
  const terminal = order.status === "served" || order.status === "refunded" || order.status === "voided"

  return counterStatusFlow.map((stage, index) => {
    if (stage !== "sent" && stage !== "preparing" && stage !== "ready" && stage !== "served") {
      return null
    }
    if (index > flowIndex) return null

    const enteredAt = getStageEnteredAt(order, stage)
    if (enteredAt == null) {
      // Fallback for missing timeline: only show elapsed on current stage.
      if (index === flowIndex) {
        const start = order.updatedAt > 0 ? order.updatedAt : order.createdAt
        return Math.max(0, Math.floor((nowMs - start) / 60000))
      }
      return null
    }

    if (index < flowIndex) {
      const nextStage = counterStatusFlow[index + 1]
      const nextEntered =
        nextStage === "sent" || nextStage === "preparing" || nextStage === "ready" || nextStage === "served"
          ? getStageEnteredAt(order, nextStage)
          : null
      const endAt = nextEntered ?? order.updatedAt ?? nowMs
      return Math.max(0, Math.floor((endAt - enteredAt) / 60000))
    }

    // Current (or final completed) stage.
    const endAt = terminal && index === flowIndex ? (order.updatedAt > enteredAt ? order.updatedAt : nowMs) : nowMs
    // For served as final step, duration is time from entering served until now/updatedAt.
    return Math.max(0, Math.floor((endAt - enteredAt) / 60000))
  })
}

function isTableCheck(order: UnifiedOrder): boolean {
  return order.id.startsWith("check-")
}

function isOpenTableCheck(order: UnifiedOrder): boolean {
  return order.source === "table" && Boolean(order.sessionId)
}

function isOrderFromToday(order: UnifiedOrder, nowMs: number = Date.now()): boolean {
  const d = new Date(nowMs)
  d.setHours(0, 0, 0, 0)
  const start = d.getTime()
  // Prefer completion/update time so late finishes still land in today's history;
  // fall back to createdAt for tickets missing updatedAt.
  const ts = order.updatedAt > 0 ? order.updatedAt : order.createdAt
  return ts >= start
}

function isOrderVisibleInBoardMode(order: UnifiedOrder, mode: BoardMode): boolean {
  if (mode === "scheduled") {
    return order.scheduledParked === true
  }

  const isPaid = order.paymentState === "paid"
  const isOpenCheck = isOpenTableCheck(order)

  if (mode === "live") {
    if (order.scheduledParked) return false
    if (order.status === "ready" || order.status === "preparing" || order.status === "sent") {
      return true
    }
    // Table check (served+unpaid rollup) stays on Live until Paid.
    if (order.status === "served" && isOpenCheck && !isPaid) return true
    return false
  }

  // History
  if (order.status === "voided" || order.status === "refunded") {
    return isOrderFromToday(order)
  }
  if (order.status === "served") {
    if (isOpenCheck || order.source === "table") {
      return isPaid && isOrderFromToday(order)
    }
    return isOrderFromToday(order)
  }
  return false
}

function isCounterStyleOrder(order: UnifiedOrder): boolean {
  if (order.source === "pickup" || order.source === "dine_in_no_table") return true
  if (order.source !== "table") return false
  // Kitchen tickets and rolled-up table checks (paid once).
  return order.id.startsWith("order-") || isTableCheck(order)
}

function getNextFireableWaveNumber(order: UnifiedOrder): number | null {
  if (order.source !== "table" || isTableCheck(order)) return null
  const next = order.waves.find((wave) => wave.status === "held" || wave.status === "not_started")
  return next ? next.number : null
}

function WaveStrip({ waves }: { waves: UnifiedOrder["waves"] }) {
  if (waves.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {waves.map((wave) => (
        <span
          key={`w-${wave.number}`}
          className={cn(
            "inline-flex h-6 min-w-[2.2rem] items-center justify-center rounded-md border px-2 text-[10px] font-black tracking-wide",
            waveChipClass[wave.status]
          )}
          dir="ltr"
        >
          W{wave.number}
        </span>
      ))}
    </div>
  )
}

function getIdentifier(order: UnifiedOrder): {
  Icon: typeof Armchair
  text: string
} {
  if (order.source === "table") {
    if (isTableCheck(order)) {
      return { Icon: HandPlatter, text: order.label }
    }
    // Kitchen ticket: DI-xxx (table shown as secondary guestLabel).
    const code = order.label.toUpperCase().startsWith("DI-")
      ? order.label
      : order.label.toUpperCase().startsWith("PU-")
        ? order.label
        : `DI-${order.label}`
    return { Icon: HandPlatter, text: code }
  }
  if (order.source === "pickup") {
    const code = order.label.toUpperCase().startsWith("PU-") ? order.label : `PU-${order.label}`
    return { Icon: ShoppingBag, text: code }
  }
  const code = order.label.toUpperCase().startsWith("DI-") ? order.label : `DI-${order.label}`
  return { Icon: Store, text: code }
}

function OrderCard({
  order,
  boardMode,
  onMarkReady,
  onMarkServed,
  onOpenDetail,
  onFireTableWave,
}: {
  order: UnifiedOrder
  boardMode: BoardMode
  onMarkReady: (order: UnifiedOrder) => void
  onMarkServed: (order: UnifiedOrder) => void
  onOpenDetail: (order: UnifiedOrder) => void
  onFireTableWave: (order: UnifiedOrder) => void
}) {
  const { formatMoney } = useMerchantLocalization()
  const { t, locale } = useStaffLocale()
  const elapsed = minutesAgo(order.createdAt)
  const isHistoryCompleted = boardMode === "history" && order.status === "served"
  const displayItems = groupOpsOrderItems(order.items)
  const tone: OrderTone = isHistoryCompleted ? "completed_history" : statusTone[order.status]
  const isUrgent = order.status === "ready"
  const isPreparing = order.status === "preparing"
  const hasAllergyHint = /allergy|no nuts|no nut|allergic/i.test(order.note ?? "")
  const identifier = getIdentifier(order)
  const canMarkReady = order.status === "preparing" && isCounterStyleOrder(order) && !isTableCheck(order)
  const canMarkServed = order.status === "ready" && isCounterStyleOrder(order) && !isTableCheck(order)
  const nextFireableWaveNumber = getNextFireableWaveNumber(order)
  const canFireNextWave =
    order.source === "table" &&
    !isCounterStyleOrder(order) &&
    order.status === "served" &&
    nextFireableWaveNumber !== null

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(order)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpenDetail(order)
        }
      }}
      className={cn(
        "group flex cursor-pointer flex-col rounded-xl border-s-[3px] border border-white/[0.06] bg-card/60 text-start backdrop-blur-sm transition-all duration-200",
        toneBorderClass[tone],
        toneGlowClass[tone],
        isUrgent && "bg-red-500/[0.04]",
        "hover:-translate-y-0.5 hover:bg-card/80 hover:shadow-lg hover:shadow-black/20"
      )}
      style={isUrgent ? ({ "--glow-urgent": "0 72% 51%" } as React.CSSProperties) : undefined}
    >
      <header className="flex items-start gap-1.5 px-4 pt-3.5 pb-2.5">
        <span
          className={cn(
            "relative inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0",
            toneDotClass[tone]
          )}
        >
          {isUrgent ? <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" /> : null}
          <identifier.Icon className="relative z-10 h-3.5 w-3.5 text-slate-950/90" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("font-mono text-sm font-bold tracking-wide", toneTextClass[tone])} dir="ltr">
              {identifier.text}
            </span>
            <span className={cn("inline-flex h-5 shrink-0 items-center rounded border px-1 text-[10px] font-semibold", sourceChipClass[order.source])}>
              {sourceBadgeLabel(order, t)}
            </span>
            <span
              className={cn(
                "inline-flex h-5 shrink-0 items-center rounded border px-1 text-[10px] font-semibold",
                isHistoryCompleted ? historyCompletedTone.chipClass : statusChipClass[order.status]
              )}
            >
              {statusChipLabel(order.status, t, isHistoryCompleted)}
            </span>
            {order.paymentState ? (
              <span
                className={cn(
                  "inline-flex h-5 shrink-0 items-center gap-1 rounded border px-1 text-[10px] font-semibold",
                  paymentStateClass[order.paymentState]
                )}
              >
                {order.paymentState === "paid" ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                <span>{order.paymentState === "paid" ? t("payment.paid") : t("payment.unpaid")}</span>
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground/70">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{orderCardGuestLine(order, t)}</span>
            </span>
          </div>
        </div>
        <div className="ms-auto shrink-0 text-end">
          <div className="text-sm font-semibold tabular-nums text-foreground" dir="ltr">
            {formatMoney(order.total)}
          </div>
          <div className={cn("mt-0.5 flex items-center justify-end gap-0.5 font-mono text-[11px]", isUrgent ? "text-red-400/80" : "text-muted-foreground/60")} dir="ltr">
            <Clock3 className="h-3 w-3" />
            {formatMinutesCompact(elapsed)}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-foreground/90">{opsItemsCountLabel(t, order.itemCount)}</div>
        </div>
      </header>

      {displayItems.length > 0 ? (
        <div className="mx-4 mb-2 space-y-1.5 border-t border-white/10 pt-2">
          {displayItems.slice(0, 4).map((item, index) => (
            <div key={`${item.id}-${index}`} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground/85">
                  <span dir="ltr">{item.qty}×</span> {resolveOpsCatalogName(locale, item.name, item.i18n)}
                </p>
                {item.customizations && item.customizations.length > 0 ? (
                  <OpsCustomizationDisplayLines
                    customizations={item.customizations}
                    textSizeClassName="text-[11px]"
                    showPrice={false}
                  />
                ) : null}
                {item.notes ? (
                  <p className="mt-0.5 truncate text-[11px]">
                    <span className="text-white/45">{t("common.note")}</span>{" "}
                    <span className="italic text-amber-200/80">{item.notes}</span>
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground" dir="ltr">
                {formatMoney(item.price)}
              </span>
            </div>
          ))}
          {displayItems.length > 4 ? (
            <p className="pt-0.5 text-xs font-semibold text-foreground/80">
            {t("card.more", { count: displayItems.length - 4 })}
            </p>
          ) : null}
        </div>
      ) : null}

      {order.note ? (
        <div className={cn("mx-4 mb-2 rounded-md border px-2 py-1.5 text-[11px]", hasAllergyHint ? "border-amber-400/30 bg-amber-500/10 text-amber-200/90" : "border-white/10 bg-black/20 text-muted-foreground")}>
          <span className="not-italic text-white/55">{t("common.instructions")}</span>{" "}
          <span className="italic">{order.note}</span>
        </div>
      ) : null}

      {isPreparing && canMarkReady ? (
        <div className="px-3.5 pb-2">
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-2">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold leading-tight text-amber-200">{t("prep.inPreparation")}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                {t("prep.markReadyHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onMarkReady(order)
              }}
              className="ms-2 inline-flex h-7 shrink-0 items-center gap-1 self-center rounded-md border border-red-300/50 bg-red-500/20 px-2.5 text-[11px] font-semibold text-red-100 transition-colors hover:bg-red-500/30"
            >
              {t("action.ready")}
            </button>
          </div>
        </div>
      ) : null}

      {isUrgent ? (
        <div className="px-3.5 pb-2">
          <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold leading-tight text-red-400">{t("ready.itemsReady")}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                {t("ready.moveHandoff")}
              </p>
            </div>
            {canMarkServed ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onMarkServed(order)
                }}
                className="ms-2 inline-flex h-7 shrink-0 items-center gap-1 self-center rounded-md border border-emerald-300/50 bg-emerald-500/20 px-2.5 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("action.served")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {order.waves.length > 0 && !isCounterStyleOrder(order) ? (
        <div className="px-4 pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <WaveStrip waves={order.waves} />
            {canFireNextWave ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onFireTableWave(order)
                }}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-orange-300/45 bg-orange-500/14 px-2.5 text-[11px] font-semibold text-orange-100 transition-colors hover:bg-orange-500/24"
              >
                <Flame className="h-3.5 w-3.5" />
                {t("action.fireWave", { number: nextFireableWaveNumber })}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

    </article>
  )
}

function OrdersNoLocationState({ staffProfile }: { staffProfile: OrdersStaffProfile | null }) {
  const { t } = useStaffLocale()
  return (
    <div className="relative flex h-full min-h-[400px] flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_12%_8%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_84%_0%,rgba(16,185,129,0.12),transparent_32%),hsl(222,24%,8%)] text-foreground px-4">
      <div className="absolute end-4 top-4">
        <OrdersStaffMenu profile={staffProfile} />
      </div>
      <Store className="h-12 w-12 text-muted-foreground/60" strokeWidth={1.5} />
      <p className="text-center text-base font-medium text-muted-foreground max-w-sm">
        {t("board.noLocation")}
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-foreground/90 hover:bg-white/10 transition-colors"
      >
        {t("board.goToDashboard")}
      </Link>
    </div>
  )
}

function OrdersErrorState({
  message: _message,
  onRetry,
  staffProfile,
}: {
  message: string
  onRetry: () => void
  staffProfile: OrdersStaffProfile | null
}) {
  const { t } = useStaffLocale()
  return (
    <div className="relative flex h-full min-h-[400px] flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_12%_8%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_84%_0%,rgba(16,185,129,0.12),transparent_32%),hsl(222,24%,8%)] px-4 text-foreground">
      <div className="absolute end-4 top-4">
        <OrdersStaffMenu profile={staffProfile} />
      </div>
      <AlertTriangle className="h-12 w-12 text-amber-500/80" strokeWidth={1.5} />
      <p className="max-w-sm text-center text-base font-medium text-muted-foreground">{t("error.loadFailed")}</p>
      <Button
        onClick={onRetry}
        variant="outline"
        className="rounded-lg border-white/15 bg-white/[0.06] text-foreground/90 hover:bg-white/10"
      >
        {t("common.retry")}
      </Button>
    </div>
  )
}

interface OrdersClientProps {
  initialOrdersView: OrdersView | null
  /** When set, show error state instead of board. Retry re-fetches via router.refresh(). */
  loadError?: string | null
  staffProfile?: OrdersStaffProfile | null
}

export function OrdersClient({
  initialOrdersView,
  loadError,
  staffProfile = null,
}: OrdersClientProps) {
  const router = useRouter()

  if (loadError) {
    return (
      <OrdersErrorState
        message={loadError}
        onRetry={() => router.refresh()}
        staffProfile={staffProfile}
      />
    )
  }
  if (initialOrdersView === null) {
    return <OrdersNoLocationState staffProfile={staffProfile} />
  }
  return (
    <OrdersBoard
      initialOrdersView={initialOrdersView}
      staffProfile={staffProfile}
    />
  )
}

function OrdersBoard({
  initialOrdersView,
  staffProfile,
}: {
  initialOrdersView: OrdersView
  staffProfile: OrdersStaffProfile | null
}) {
  const router = useRouter()
  const { formatMoney, formatDateTime } = useMerchantLocalization()
  const { t, locale, dir } = useStaffLocale()
  const [query, setQuery] = useState("")
  const [boardMode, setBoardMode] = useState<BoardMode>("live")
  const [sourceFilter, setSourceFilter] = useState<"all" | OrderSource>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | UnifiedStatus>("all")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<null | {
    type: "void" | "refund"
    order: UnifiedOrder
  }>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<UnifiedStatus>>(new Set())
  const [ordersView, setOrdersView] = useState(initialOrdersView)
  const [incomingMuted, setIncomingMuted] = useState(false)
  const [incomingSnoozed, setIncomingSnoozed] = useState(false)
  const [incomingAccepting, setIncomingAccepting] = useState(false)
  const [progressNowMs, setProgressNowMs] = useState(() => Date.now())
  const [serviceAckPendingId, setServiceAckPendingId] = useState<string | null>(null)
  const seenServiceRequestIdsRef = useRef<Set<string>>(new Set())
  const serviceRequestsHydratedRef = useRef(false)
  const inFlightActionsRef = useRef<Set<string>>(new Set())
  const orderActionQueueRef = useRef<Map<string, Promise<void>>>(new Map())

  useEffect(() => {
    const cleanupPrime = primeIncomingOrderAlertAudio()
    return () => {
      cleanupPrime()
    }
  }, [])

  useEffect(() => {
    setOrdersView((prev) => {
      if (!initialOrdersView) return prev
      const protectedIds = new Set(
        [...inFlightActionsRef.current].map((key) => key.split(":")[1] ?? key)
      )
      return mergeOrdersViewWithLocal(prev, initialOrdersView, protectedIds)
    })
  }, [initialOrdersView])

  useEffect(() => {
    const locationId = ordersView.locationId
    let cancelled = false

    const poll = async () => {
      if (document.visibilityState !== "visible") return
      try {
        const res = await fetch(
          `/api/orders/view?locationId=${encodeURIComponent(locationId)}`,
          { cache: "no-store" }
        )
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean
          data?: unknown
        } | null
        if (cancelled) return
        if (res.ok && payload?.ok !== false && isOrdersView(payload?.data)) {
          const protectedIds = new Set(
            [...inFlightActionsRef.current].map((key) => key.split(":")[1] ?? key)
          )
          setOrdersView((prev) => mergeOrdersViewWithLocal(prev, payload.data, protectedIds))
        }
      } catch {
        // Keep showing the last good board on silent poll failures.
      }
    }

    const id = window.setInterval(() => {
      void poll()
    }, ORDERS_POLL_MS)
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [ordersView.locationId])

  useEffect(() => {
    if (!incomingSnoozed) return
    const id = window.setTimeout(() => setIncomingSnoozed(false), INCOMING_SNOOZE_MS)
    return () => window.clearTimeout(id)
  }, [incomingSnoozed])

  const baseOrders = ordersView.orders

  const allOrders = useMemo(
    () =>
      mergeServedTableTicketsForBoard(
        [...baseOrders].sort((a, b) => a.createdAt - b.createdAt),
      ),
    [baseOrders]
  )

  const incomingOrders = useMemo(
    () =>
      allOrders
        .filter(
          (order) =>
            !order.scheduledParked &&
            order.status === "sent" &&
            isCounterStyleOrder(order),
        )
        .sort((a, b) => a.createdAt - b.createdAt),
    [allOrders]
  )

  const serviceRequests = useMemo(
    () => ordersView.serviceRequests ?? [],
    [ordersView.serviceRequests],
  )

  useEffect(() => {
    const nextIds = new Set(serviceRequests.map((request) => request.id))
    if (!serviceRequestsHydratedRef.current) {
      serviceRequestsHydratedRef.current = true
      seenServiceRequestIdsRef.current = nextIds
      return
    }

    const newlyArrived = serviceRequests.filter(
      (request) => !seenServiceRequestIdsRef.current.has(request.id),
    )
    seenServiceRequestIdsRef.current = nextIds
    if (newlyArrived.length === 0) return

    const first = newlyArrived[0]
    const label =
      first.requestType === "waiter"
        ? t("service.toastWaiter", { code: first.tableNumber })
        : t("service.toastCheck", { code: first.tableNumber })
    toast.message(label, {
      description:
        newlyArrived.length > 1
          ? t("service.toastMany", { count: newlyArrived.length })
          : first.requestType === "waiter"
            ? t("service.toastWaiterDesc")
            : t("service.toastCheckDesc"),
    })
    if (!incomingMuted) {
      void createIncomingOrderAlertSound().start()
      window.setTimeout(() => createIncomingOrderAlertSound().stop(), 1800)
    }
  }, [serviceRequests, incomingMuted, t])

  const handleAcknowledgeServiceRequest = useCallback(
    async (request: OrdersServiceRequest) => {
      if (serviceAckPendingId) return
      setServiceAckPendingId(request.id)
      setOrdersView((prev) => ({
        ...prev,
        serviceRequests: (prev.serviceRequests ?? []).filter(
          (row) => row.id !== request.id,
        ),
      }))
      try {
        const res = await fetchPos(
          `/api/tables/${encodeURIComponent(request.tableId)}/acknowledge-service`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestType: request.requestType }),
          },
        )
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean
          error?: { message?: string }
        } | null
        if (!res.ok || payload?.ok === false) {
          throw new Error(
            getPayloadErrorMessage(
              payload,
              request.requestType === "bill"
                ? t("service.failCheck")
                : t("service.failWaiter"),
            ),
          )
        }
        toast.success(
          request.requestType === "bill"
            ? t("service.ackCheck", { code: request.tableNumber })
            : t("service.ackWaiter", { code: request.tableNumber }),
        )
      } catch (error) {
        setOrdersView((prev) => {
          const existing = prev.serviceRequests ?? []
          if (existing.some((row) => row.id === request.id)) return prev
          return {
            ...prev,
            serviceRequests: [...existing, request].sort((a, b) => {
              if (a.requestType !== b.requestType) {
                return a.requestType === "waiter" ? -1 : 1
              }
              return a.tableNumber.localeCompare(b.tableNumber, undefined, {
                numeric: true,
                sensitivity: "base",
              })
            }),
          }
        })
        toast.error(
          error instanceof Error
            ? error.message
            : t("service.failUpdate"),
        )
      } finally {
        setServiceAckPendingId(null)
      }
    },
    [serviceAckPendingId, t],
  )

  const scheduledOrders = useMemo(
    () =>
      allOrders
        .filter((order) => order.scheduledParked === true)
        .sort(
          (a, b) =>
            (a.scheduledPickupAt ?? Number.MAX_SAFE_INTEGER) -
            (b.scheduledPickupAt ?? Number.MAX_SAFE_INTEGER),
        ),
    [allOrders],
  )
  const activeIncoming = incomingOrders[0] ?? null

  // Don't block the next awaiting order while the previous accept request is still in flight.
  useEffect(() => {
    setIncomingAccepting(false)
  }, [activeIncoming?.id])

  const showIncomingOverlay =
    boardMode === "live" && activeIncoming != null && !incomingSnoozed
  const showIncomingBadge =
    boardMode === "live" && incomingOrders.length > 0 && incomingSnoozed

  // Auto-play alert whenever a new incoming order is on screen.
  useEffect(() => {
    if (!showIncomingOverlay || !activeIncoming || incomingMuted) {
      createIncomingOrderAlertSound().stop()
      return
    }

    let cancelled = false
    let notifiedFallback = false
    const sound = createIncomingOrderAlertSound()

    const fireNotificationFallback = () => {
      if (cancelled || notifiedFallback || incomingMuted) return
      notifiedFallback = notifyIncomingOrderAlert({
        orderLabel: activeIncoming.label,
        guestLabel: activeIncoming.guestLabel,
        itemCount: activeIncoming.itemCount,
      })
    }

    const tryStart = async () => {
      if (cancelled) return
      const ok = await sound.start()
      if (cancelled) return
      if (ok) return
      // HTML audio blocked (common on cold /orders load) — OS notification can still sound.
      fireNotificationFallback()
      window.setTimeout(() => {
        if (cancelled) return
        void sound.start().then((retryOk) => {
          if (cancelled || retryOk) return
          fireNotificationFallback()
        })
      }, 400)
    }

    void tryStart()
    const retryInterval = window.setInterval(() => {
      if (cancelled || incomingMuted) return
      if (sound.isPlaying()) return
      void sound.start().then((ok) => {
        if (cancelled || ok) return
        fireNotificationFallback()
      })
    }, 1500)

    return () => {
      cancelled = true
      window.clearInterval(retryInterval)
      sound.stop()
    }
  }, [
    showIncomingOverlay,
    activeIncoming?.id,
    activeIncoming?.label,
    activeIncoming?.guestLabel,
    activeIncoming?.itemCount,
    incomingMuted,
  ])

  const patchOrderStatus = useCallback((
    orderId: string,
    status: UnifiedStatus,
    extras?: { targetEtaMinutes?: number },
  ) => {
    const now = Date.now()
    const itemStatus =
      status === "preparing"
        ? "preparing"
        : status === "ready"
          ? "ready"
          : status === "served"
            ? "served"
            : status === "sent"
              ? "held"
              : null
    setOrdersView((prev) => ({
      ...prev,
      orders: prev.orders.map((row) => {
        if (row.id !== orderId) return row
        const stageKey =
          status === "sent" || status === "preparing" || status === "ready" || status === "served"
            ? status
            : null
        return {
          ...row,
          status,
          updatedAt: now,
          needsAccept: status === "sent" ? row.needsAccept : false,
          ...(typeof extras?.targetEtaMinutes === "number"
            ? { targetEtaMinutes: extras.targetEtaMinutes }
            : {}),
          stageEnteredAt: stageKey
            ? {
                ...row.stageEnteredAt,
                [stageKey]: row.stageEnteredAt?.[stageKey] ?? now,
              }
            : row.stageEnteredAt,
          items: itemStatus
            ? row.items.map((item) => ({ ...item, status: itemStatus }))
            : row.items,
        }
      }),
    }))
  }, [])

  /** Only roll back if the UI is still on the status this request set (don't undo a newer step). */
  const rollbackOrderStatus = useCallback(
    (orderId: string, expectedStatus: UnifiedStatus, previousStatus: UnifiedStatus) => {
      setOrdersView((prev) => ({
        ...prev,
        orders: prev.orders.map((row) => {
          if (row.id !== orderId) return row
          if (row.status !== expectedStatus) return row
          const prevStage =
            previousStatus === "sent" ||
            previousStatus === "preparing" ||
            previousStatus === "ready" ||
            previousStatus === "served"
              ? previousStatus
              : null
          const nextStageEntered = { ...row.stageEnteredAt }
          if (
            expectedStatus === "sent" ||
            expectedStatus === "preparing" ||
            expectedStatus === "ready" ||
            expectedStatus === "served"
          ) {
            delete nextStageEntered[expectedStatus]
          }
          return {
            ...row,
            status: previousStatus,
            needsAccept:
              previousStatus === "sent" && row.source === "table" ? true : row.needsAccept,
            stageEnteredAt: prevStage
              ? { ...nextStageEntered, [prevStage]: nextStageEntered[prevStage] ?? row.updatedAt }
              : nextStageEntered,
          }
        }),
      }))
    },
    []
  )

  const beginAction = useCallback((actionKey: string): boolean => {
    if (inFlightActionsRef.current.has(actionKey)) return false
    inFlightActionsRef.current.add(actionKey)
    return true
  }, [])

  const endAction = useCallback((actionKey: string) => {
    inFlightActionsRef.current.delete(actionKey)
  }, [])

  const enqueueOrderAction = useCallback((orderKey: string, action: () => Promise<void>) => {
    const previous = orderActionQueueRef.current.get(orderKey) ?? Promise.resolve()
    const next = previous
      .catch(() => {
        // Keep the queue moving even if a prior step failed.
      })
      .then(action)
      .finally(() => {
        if (orderActionQueueRef.current.get(orderKey) === next) {
          orderActionQueueRef.current.delete(orderKey)
        }
      })
    orderActionQueueRef.current.set(orderKey, next)
  }, [])

  const handleMarkReady = useCallback(
    (order: UnifiedOrder) => {
      if (order.status !== "preparing" || !isCounterStyleOrder(order)) return
      const orderId = order.orderId ?? order.id.replace(/^order-/, "")
      if (!orderId) return
      const actionKey = `ready:${order.id}`
      if (!beginAction(actionKey)) return

      const previousStatus = order.status
      const optimisticStatus = "ready" as const
      patchOrderStatus(order.id, optimisticStatus)
      toast.success(`${order.label} marked ready`)

      enqueueOrderAction(order.id, async () => {
        try {
          const res = await fetchPos(`/api/orders/${encodeURIComponent(orderId)}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ready" }),
          })
          const payload = (await res.json().catch(() => null)) as {
            ok?: boolean
            error?: { message?: string }
          } | null
          if (!res.ok || payload?.ok === false) {
            rollbackOrderStatus(order.id, optimisticStatus, previousStatus)
            toast.error(getPayloadErrorMessage(payload, t("error.markReady")))
          }
        } catch {
          rollbackOrderStatus(order.id, optimisticStatus, previousStatus)
          toast.error(t("error.requestFailed"))
        } finally {
          endAction(actionKey)
        }
      })
    },
    [beginAction, endAction, enqueueOrderAction, patchOrderStatus, rollbackOrderStatus, t]
  )

  const patchOrderPayment = useCallback(
    (
      orderId: string,
      payment: { paymentState: PaymentState; paymentMethod?: PaymentMethod },
    ) => {
      setOrdersView((prev) => ({
        ...prev,
        orders: prev.orders.map((row) => {
          if (row.id !== orderId) return row
          return {
            ...row,
            paymentState: payment.paymentState,
            paymentMethod:
              payment.paymentMethod !== undefined
                ? payment.paymentMethod
                : row.paymentMethod,
            updatedAt: Date.now(),
          }
        }),
      }))
    },
    [],
  )

  const handleMarkServed = useCallback(
    (order: UnifiedOrder) => {
      if (order.status !== "ready" || !isCounterStyleOrder(order)) return
      const orderId = order.orderId ?? order.id.replace(/^order-/, "")
      if (!orderId) return
      const actionKey = `served:${order.id}`
      if (!beginAction(actionKey)) return

      const previousStatus = order.status
      const previousPaymentState = order.paymentState ?? "unpaid"
      const previousPaymentMethod = order.paymentMethod ?? null
      const optimisticStatus = "served" as const
      const settleOnServe = !isOpenTableCheck(order)
      patchOrderStatus(order.id, optimisticStatus)
      // Pickup / counter: served settles. Delivery-to-table: stays unpaid until Paid.
      if (settleOnServe) {
        patchOrderPayment(order.id, { paymentState: "paid", paymentMethod: "cash" })
      }
      toast.success(`${order.label} marked served`)

      enqueueOrderAction(order.id, async () => {
        try {
          const res = await fetchPos(`/api/orders/${encodeURIComponent(orderId)}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "completed" }),
          })
          const payload = (await res.json().catch(() => null)) as {
            ok?: boolean
            error?: { message?: string }
          } | null
          if (!res.ok || payload?.ok === false) {
            rollbackOrderStatus(order.id, optimisticStatus, previousStatus)
            if (settleOnServe) {
              patchOrderPayment(order.id, {
                paymentState: previousPaymentState,
                paymentMethod: previousPaymentMethod,
              })
            }
            toast.error(getPayloadErrorMessage(payload, t("error.markServed")))
          }
        } catch {
          rollbackOrderStatus(order.id, optimisticStatus, previousStatus)
          if (settleOnServe) {
            patchOrderPayment(order.id, {
              paymentState: previousPaymentState,
              paymentMethod: previousPaymentMethod,
            })
          }
          toast.error(t("error.requestFailed"))
        } finally {
          endAction(actionKey)
        }
      })
    },
    [beginAction, endAction, enqueueOrderAction, patchOrderPayment, patchOrderStatus, rollbackOrderStatus, t]
  )

  const handleMarkPaid = useCallback(
    (order: UnifiedOrder, method: Exclude<PaymentMethod, null> = "cash") => {
      if (!isCounterStyleOrder(order)) return
      if (order.status === "voided" || order.status === "refunded") return
      if (order.paymentState === "paid") return
      const orderId = order.orderId ?? order.id.replace(/^order-/, "")
      if (!orderId) return
      const actionKey = `paid:${order.id}`
      if (!beginAction(actionKey)) return

      const previousPaymentState = order.paymentState ?? "unpaid"
      const previousPaymentMethod = order.paymentMethod ?? null
      const openTableSessionId = isOpenTableCheck(order) ? order.sessionId : null

      if (openTableSessionId) {
        // Pay closes the whole table visit (rolled-up check or any session ticket).
        const sessionOrders = ordersView.orders.filter(
          (row) => row.sessionId === openTableSessionId,
        )
        const paymentSnapshots = sessionOrders.map((row) => ({
          id: row.id,
          paymentState: row.paymentState ?? "unpaid",
          paymentMethod: row.paymentMethod ?? null,
          status: row.status,
        }))
        const closeAmount =
          Math.round(
            (isTableCheck(order)
              ? order.total
              : sessionOrders
                  .filter((row) => row.paymentState !== "paid")
                  .reduce((sum, row) => sum + (Number(row.total) || 0), 0)) * 100,
          ) / 100
        const paymentAmount = Math.max(closeAmount, Number(order.total) || 0, 0.01)

        // Optimistic: leave Live immediately (check → History).
        for (const row of sessionOrders) {
          if (row.status === "voided" || row.status === "refunded") continue
          if (row.status === "sent" || row.status === "preparing" || row.status === "ready") {
            // Still in kitchen — leave status; server will reject close if unfinished.
            continue
          }
          patchOrderStatus(row.id, "served")
          patchOrderPayment(row.id, { paymentState: "paid", paymentMethod: method })
        }
        if (isTableCheck(order) || order.status === "served") {
          patchOrderStatus(order.id, "served")
          patchOrderPayment(order.id, { paymentState: "paid", paymentMethod: method })
        }
        setSelectedOrderId(null)
        toast.success(`${order.label} paid · table closed`)

        enqueueOrderAction(order.id, async () => {
          const restore = () => {
            for (const snap of paymentSnapshots) {
              if (snap.status !== "voided" && snap.status !== "refunded") {
                rollbackOrderStatus(snap.id, "served", snap.status)
              }
              patchOrderPayment(snap.id, {
                paymentState: snap.paymentState,
                paymentMethod: snap.paymentMethod,
              })
            }
            if (isTableCheck(order)) {
              patchOrderPayment(order.id, {
                paymentState: previousPaymentState,
                paymentMethod: previousPaymentMethod,
              })
            }
          }
          try {
            const res = await fetchPos(
              `/api/sessions/${encodeURIComponent(openTableSessionId)}/close`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  payment: {
                    amount: paymentAmount,
                    method: method === "other" ? "other" : method,
                  },
                }),
              },
            )
            const payload = (await res.json().catch(() => null)) as {
              ok?: boolean
              error?: { message?: string }
            } | null
            if (!res.ok || payload?.ok === false) {
              restore()
              toast.error(
                getPayloadErrorMessage(
                  payload,
                  t("error.closeTable"),
                ),
              )
            }
          } catch {
            restore()
            toast.error(t("error.requestFailed"))
          } finally {
            endAction(actionKey)
          }
        })
        return
      }

      patchOrderPayment(order.id, { paymentState: "paid", paymentMethod: method })
      toast.success(`${order.label} marked paid`)

      enqueueOrderAction(order.id, async () => {
        try {
          const res = await fetchPos(`/api/orders/${encodeURIComponent(orderId)}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: order.total,
              method,
            }),
          })
          const payload = (await res.json().catch(() => null)) as {
            ok?: boolean
            error?: { message?: string }
          } | null
          if (!res.ok || payload?.ok === false) {
            patchOrderPayment(order.id, {
              paymentState: previousPaymentState,
              paymentMethod: previousPaymentMethod,
            })
            toast.error(getPayloadErrorMessage(payload, t("error.markPaid")))
          }
        } catch {
          patchOrderPayment(order.id, {
            paymentState: previousPaymentState,
            paymentMethod: previousPaymentMethod,
          })
          toast.error(t("error.requestFailed"))
        } finally {
          endAction(actionKey)
        }
      })
    },
    [beginAction, endAction, enqueueOrderAction, ordersView.orders, patchOrderPayment, patchOrderStatus, rollbackOrderStatus, t]
  )

  const handleVoidOrder = useCallback(
    (order: UnifiedOrder) => {
      if (!isCounterStyleOrder(order)) return
      if (order.status === "voided" || order.status === "refunded") return
      if (order.paymentState === "paid") return
      const orderId = order.orderId ?? order.id.replace(/^order-/, "")
      if (!orderId) return
      const actionKey = `void:${order.id}`
      if (!beginAction(actionKey)) return

      const previousStatus = order.status
      const optimisticStatus = "voided" as const
      patchOrderStatus(order.id, optimisticStatus)
      setSelectedOrderId(null)
      toast.success(`${order.label} voided`)

      enqueueOrderAction(order.id, async () => {
        try {
          const res = await fetchPos(`/api/orders/${encodeURIComponent(orderId)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
          const payload = (await res.json().catch(() => null)) as {
            ok?: boolean
            error?: { message?: string }
          } | null
          if (!res.ok || payload?.ok === false) {
            rollbackOrderStatus(order.id, optimisticStatus, previousStatus)
            toast.error(getPayloadErrorMessage(payload, t("error.void")))
          }
        } catch {
          rollbackOrderStatus(order.id, optimisticStatus, previousStatus)
          toast.error(t("error.requestFailed"))
        } finally {
          endAction(actionKey)
        }
      })
    },
    [beginAction, endAction, enqueueOrderAction, patchOrderStatus, rollbackOrderStatus, t]
  )

  const handleRefundOrder = useCallback(
    (order: UnifiedOrder) => {
      if (!isCounterStyleOrder(order)) return
      if (order.status === "refunded") return
      if (order.paymentState !== "paid") return
      const orderId = order.orderId ?? order.id.replace(/^order-/, "")
      if (!orderId) return
      const actionKey = `refund:${order.id}`
      if (!beginAction(actionKey)) return

      const previousStatus = order.status
      const optimisticStatus = "refunded" as const
      patchOrderStatus(order.id, optimisticStatus)
      setSelectedOrderId(null)
      toast.success(`${order.label} refunded`)

      enqueueOrderAction(order.id, async () => {
        try {
          const res = await fetchPos(`/api/orders/${encodeURIComponent(orderId)}/refund`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
          const payload = (await res.json().catch(() => null)) as {
            ok?: boolean
            error?: { message?: string }
          } | null
          if (!res.ok || payload?.ok === false) {
            rollbackOrderStatus(order.id, optimisticStatus, previousStatus)
            toast.error(getPayloadErrorMessage(payload, t("error.refund")))
          }
        } catch {
          rollbackOrderStatus(order.id, optimisticStatus, previousStatus)
          toast.error(t("error.requestFailed"))
        } finally {
          endAction(actionKey)
        }
      })
    },
    [beginAction, endAction, enqueueOrderAction, patchOrderStatus, rollbackOrderStatus, t]
  )

  const handleAcceptIncoming = useCallback((etaMinutes: number) => {
    if (!activeIncoming) return
    const actionKey = `accept:${activeIncoming.id}`
    if (!beginAction(actionKey)) return
    setIncomingAccepting(true)

    const accepted = activeIncoming
    const previousStatus = accepted.status
    const optimisticStatus = "preparing" as const
    const safeEta = Math.min(180, Math.max(1, Math.round(etaMinutes)))
    const orderId = accepted.orderId ?? accepted.id.replace(/^order-/, "")
    patchOrderStatus(accepted.id, optimisticStatus, { targetEtaMinutes: safeEta })
    toast.success(`${accepted.label} accepted · ${safeEta}m`)

    enqueueOrderAction(accepted.id, async () => {
      try {
        if (!orderId) {
          rollbackOrderStatus(accepted.id, optimisticStatus, previousStatus)
          toast.error(t("error.accept"))
          return
        }

        // Delivery-to-table: accept is counter-style (no wave fire / KDS).
        const res = await fetchPos(`/api/orders/${encodeURIComponent(orderId)}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "preparing", etaMinutes: safeEta }),
        })
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean
          error?: { message?: string }
        } | null
        if (!res.ok || payload?.ok === false) {
          rollbackOrderStatus(accepted.id, optimisticStatus, previousStatus)
          toast.error(getPayloadErrorMessage(payload, t("error.accept")))
        }
      } catch {
        rollbackOrderStatus(accepted.id, optimisticStatus, previousStatus)
        toast.error(t("error.requestFailed"))
      } finally {
        endAction(actionKey)
        setIncomingAccepting(false)
      }
    })
  }, [activeIncoming, beginAction, endAction, enqueueOrderAction, patchOrderStatus, rollbackOrderStatus, t])

  const selectedOrder = useMemo(
    () => allOrders.find((order) => order.id === selectedOrderId) ?? null,
    [allOrders, selectedOrderId]
  )

  useEffect(() => {
    if (selectedOrderId && !selectedOrder) {
      setSelectedOrderId(null)
    }
  }, [selectedOrder, selectedOrderId])

  const visibleStatuses = boardMode === "history" ? historyStatusOrder : liveStatusOrder
  const visibleStatusFilters = boardMode === "history" ? historyStatusOrder : liveStatusFilterOrder

  const sourceCounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = allOrders.filter((order) => {
      if (!isOrderVisibleInBoardMode(order, boardMode)) return false
      if (!q) return true
      return opsOrderMatchesQuery(order, query)
    })

    return {
      all: base.length,
      table: base.filter((o) => o.source === "table").length,
      pickup: base.filter((o) => o.source === "pickup").length,
      dineIn: base.filter((o) => o.source === "dine_in_no_table").length,
    }
  }, [allOrders, boardMode, query])

  const channels = ordersView.channels
  const sourceFilters = useMemo(() => {
    type SourceFilter = {
      id: "all" | OrderSource
      label: string
      shortLabel: string
      Icon?: typeof HandPlatter
    }
    const channelFilters: SourceFilter[] = []

    const dineInMode = channels?.dineInMode
    const tableLabel = dineInMode === "self_service" ? t("source.dine") : t("source.table")
    const tableShort = tableLabel

    // Table-session tickets: delivery-to-table OR self-service dine-in (same source, different label).
    if (
      channels?.deliveryToTable ||
      channels?.selfPickup ||
      sourceCounts.table > 0
    ) {
      channelFilters.push({
        id: "table",
        label: `${tableLabel} (${sourceCounts.table})`,
        shortLabel: `${tableShort} (${sourceCounts.table})`,
        Icon: HandPlatter,
      })
    }

    if (channels?.pickup !== false || sourceCounts.pickup > 0) {
      channelFilters.push({
        id: "pickup",
        label: `${t("source.pickup")} (${sourceCounts.pickup})`,
        shortLabel: `${t("source.pickup")} (${sourceCounts.pickup})`,
        Icon: ShoppingBag,
      })
    }

    // Counter dine-in tickets without a table session.
    if (sourceCounts.dineIn > 0) {
      channelFilters.push({
        id: "dine_in_no_table",
        label: `${t("source.dine")} (${sourceCounts.dineIn})`,
        shortLabel: `${t("source.dine")} (${sourceCounts.dineIn})`,
        Icon: Store,
      })
    }

    // All is only useful when more than one channel can be filtered.
    if (channelFilters.length <= 1) return channelFilters

    return [
      {
        id: "all" as const,
        label: `${t("filter.all")} (${sourceCounts.all})`,
        shortLabel: `${t("filter.all")} (${sourceCounts.all})`,
      },
      ...channelFilters,
    ]
  }, [channels, sourceCounts, t])

  useEffect(() => {
    if (sourceFilters.length === 0) {
      if (sourceFilter !== "all") setSourceFilter("all")
      return
    }
    if (sourceFilters.length === 1) {
      const only = sourceFilters[0]!.id
      if (sourceFilter !== only) setSourceFilter(only)
      return
    }
    if (sourceFilter === "all") return
    if (!sourceFilters.some((filter) => filter.id === sourceFilter)) {
      setSourceFilter("all")
    }
  }, [sourceFilter, sourceFilters])

  useEffect(() => {
    if (statusFilter !== "all" && !visibleStatuses.includes(statusFilter)) {
      setStatusFilter("all")
    }
  }, [boardMode, statusFilter, visibleStatuses])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const next = allOrders.filter((order) => {
      if (!isOrderVisibleInBoardMode(order, boardMode)) return false
      if (sourceFilter !== "all" && order.source !== sourceFilter) return false
      if (statusFilter !== "all" && order.status !== statusFilter) return false
      if (!q) return true
      return opsOrderMatchesQuery(order, query)
    })
    if (boardMode === "history") {
      next.sort((a, b) => b.updatedAt - a.updatedAt)
    } else if (boardMode === "live") {
      next.sort((a, b) => b.createdAt - a.createdAt)
    }
    return next
  }, [allOrders, boardMode, query, sourceFilter, statusFilter])

  const statusCounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = allOrders.filter((order) => {
      if (!isOrderVisibleInBoardMode(order, boardMode)) return false
      if (sourceFilter !== "all" && order.source !== sourceFilter) return false
      if (!q) return true
      return opsOrderMatchesQuery(order, query)
    })

    return base.reduce<Record<UnifiedStatus, number>>(
      (acc, order) => {
        acc[order.status] += 1
        return acc
      },
      {
        sent: 0,
        preparing: 0,
        ready: 0,
        served: 0,
        voided: 0,
        refunded: 0,
      }
    )
  }, [allOrders, boardMode, query, sourceFilter])

  const groupedOrders = useMemo(
    () => visibleStatuses.map((status) => ({ status, orders: filtered.filter((order) => order.status === status) })),
    [filtered, visibleStatuses]
  )

  const toggleGroup = useCallback((status: UnifiedStatus) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }, [])

  const handleOpenOrder = useCallback((order: UnifiedOrder) => {
    setSelectedOrderId(order.id)
  }, [])

  const handleFireTableWave = useCallback(
    (order: UnifiedOrder) => {
      if (order.source !== "table" || !order.sessionId) return
      const nextWave = getNextFireableWaveNumber(order)
      if (!nextWave) return
      const actionKey = `fire:${order.id}:${nextWave}`
      if (!beginAction(actionKey)) return

      toast.success(t("action.waveFired", { label: order.label, number: nextWave }))

      void (async () => {
        try {
          const res = await fetchPos(
            `/api/sessions/${encodeURIComponent(order.sessionId!)}/waves/${nextWave}/fire`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventSource: "api" }),
            }
          )
          const payload = (await res.json().catch(() => null)) as {
            ok?: boolean
            error?: { message?: string }
          } | null
          if (!res.ok || payload?.ok === false) {
            toast.error(getPayloadErrorMessage(payload, t("error.fireWave")))
          }
        } catch {
          toast.error(t("error.requestFailed"))
        } finally {
          endAction(actionKey)
        }
      })()
    },
    [beginAction, endAction, t]
  )

  const selectedIdentifier = selectedOrder ? getIdentifier(selectedOrder) : null
  const selectedIsCounterOrder = !!selectedOrder && isCounterStyleOrder(selectedOrder)
  const canVoidSelected =
    !!selectedOrder &&
    selectedIsCounterOrder &&
    selectedOrder.status !== "voided" &&
    selectedOrder.status !== "refunded" &&
    selectedOrder.paymentState !== "paid"
  const canRefundSelected =
    !!selectedOrder &&
    selectedIsCounterOrder &&
    selectedOrder.status !== "refunded" &&
    selectedOrder.paymentState === "paid"
  const canMarkPaidSelected =
    !!selectedOrder &&
    selectedIsCounterOrder &&
    selectedOrder.status !== "voided" &&
    selectedOrder.status !== "refunded" &&
    selectedOrder.paymentState !== "paid"
  const showMoneyActions =
    !!selectedOrder &&
    selectedIsCounterOrder &&
    selectedOrder.status !== "voided" &&
    selectedOrder.status !== "refunded"
  const selectedOpenedMinutes = selectedOrder ? minutesAgo(selectedOrder.createdAt) : 0
  const selectedElapsedMinutes = selectedOrder
    ? minutesAgo(
        selectedIsCounterOrder
          ? (selectedOrder.stageEnteredAt?.preparing ?? selectedOrder.createdAt)
          : selectedOrder.createdAt,
      )
    : 0
  const selectedIsCounterDineIn = selectedOrder?.source === "dine_in_no_table"
  const selectedSourceLabel = !selectedOrder
    ? ""
    : selectedOrder.source === "table" && channels?.dineInMode === "self_service"
      ? t("source.dine")
      : sourceBadgeLabel(selectedOrder, t)
  const selectedSeatGroups = useMemo(
    () => (selectedOrder ? groupOrderItemsBySeat(groupOpsOrderItems(selectedOrder.items)) : []),
    [selectedOrder],
  )
  const selectedFlowIndex = selectedOrder ? getCounterFlowIndex(selectedOrder.status) : 0
  useEffect(() => {
    if (!selectedOrder || !selectedIsCounterOrder) return
    setProgressNowMs(Date.now())
    const id = window.setInterval(() => setProgressNowMs(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [selectedOrder?.id, selectedOrder?.status, selectedIsCounterOrder])
  const selectedStageMinutes = selectedOrder
    ? getCounterStageMinutes(selectedOrder, progressNowMs)
    : []
  const locationDefaultPrepMinutes = Math.min(
    180,
    Math.max(1, Math.round(ordersView.defaultPrepMinutes ?? 15)),
  )
  const selectedTargetEtaMinutes = selectedOrder
    ? Math.min(
        180,
        Math.max(
          1,
          Math.round(selectedOrder.targetEtaMinutes ?? locationDefaultPrepMinutes),
        ),
      )
    : locationDefaultPrepMinutes
  const selectedEtaRemaining = Math.max(0, selectedTargetEtaMinutes - selectedElapsedMinutes)
  const selectedEtaLate = selectedElapsedMinutes > selectedTargetEtaMinutes
  const incomingDefaultEtaMinutes = locationDefaultPrepMinutes

  return (
    <main className="h-full bg-[radial-gradient(circle_at_12%_8%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_84%_0%,rgba(16,185,129,0.12),transparent_32%),hsl(222,24%,8%)] text-foreground">
      {showIncomingOverlay && activeIncoming ? (
        <IncomingOrderOverlay
          order={{
            id: activeIncoming.id,
            label: activeIncoming.label,
            sourceLabel: sourceLabelFor(t, activeIncoming.source),
            guestLabel: orderCardGuestLine(activeIncoming, t),
            itemCount: activeIncoming.itemCount,
            createdAt: activeIncoming.createdAt,
            note: activeIncoming.note,
            total: activeIncoming.total,
            items: activeIncoming.items,
          }}
          waitingCount={incomingOrders.length}
          accepting={incomingAccepting}
          muted={incomingMuted}
          defaultEtaMinutes={incomingDefaultEtaMinutes}
          onAccept={(etaMinutes) => {
            createIncomingOrderAlertSound().stop()
            void handleAcceptIncoming(etaMinutes)
          }}
          onMuteToggle={() => {
            setIncomingMuted((prev) => {
              const next = !prev
              if (next) createIncomingOrderAlertSound().stop()
              return next
            })
          }}
          onSnooze={() => {
            createIncomingOrderAlertSound().stop()
            setIncomingSnoozed(true)
          }}
        />
      ) : null}
      {showIncomingBadge ? (
        <IncomingWaitingBadge
          count={incomingOrders.length}
          onResume={() => setIncomingSnoozed(false)}
        />
      ) : null}
      <div className="mx-auto h-full w-full max-w-[1680px] overflow-y-auto p-3 md:p-4">
        <header className="rounded-xl border border-white/10 bg-[hsl(224,18%,12%)]/88 p-3 backdrop-blur-md">
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[1fr_auto_auto]">
              <div className="flex items-center gap-1.5">
                <div className="orders-board-tabs inline-flex h-9 max-w-full items-center overflow-hidden rounded-md border border-white/15 bg-black/25 p-0.5">
                  <button
                    type="button"
                    onClick={() => setBoardMode("live")}
                    className={cn(
                      "inline-flex h-full min-h-0 min-w-0 shrink-0 items-center justify-center rounded-sm px-3 text-xs font-semibold leading-none whitespace-nowrap transition-colors",
                      boardMode === "live"
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "text-muted-foreground hover:bg-white/[0.06]"
                    )}
                  >
                    {t("board.live")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardMode("scheduled")}
                    className={cn(
                      "inline-flex h-full min-h-0 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 text-xs font-semibold leading-none whitespace-nowrap transition-colors",
                      boardMode === "scheduled"
                        ? "bg-amber-500/20 text-amber-100"
                        : "text-muted-foreground hover:bg-white/[0.06]"
                    )}
                  >
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {t("board.scheduled")}
                    {scheduledOrders.length > 0 ? ` (${scheduledOrders.length})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardMode("history")}
                    className={cn(
                      "inline-flex h-full min-h-0 min-w-0 shrink-0 items-center justify-center rounded-sm px-3 text-xs font-semibold leading-none whitespace-nowrap transition-colors",
                      boardMode === "history"
                        ? "bg-fuchsia-500/20 text-fuchsia-100"
                        : "text-muted-foreground hover:bg-white/[0.06]"
                    )}
                  >
                    {t("board.history")}
                  </button>
                </div>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("board.searchPlaceholder")}
                    className="h-9 border-white/15 bg-black/20 ps-8"
                  />
                </div>
                <div className="lg:hidden">
                  <OrdersStaffMenu profile={staffProfile} />
                </div>
              </div>
              {sourceFilters.length > 1 ? (
              <div className={cn("orders-source-filters flex w-full flex-nowrap items-center gap-1 sm:w-auto sm:justify-end sm:gap-1.5", boardMode === "scheduled" && "opacity-40 pointer-events-none")}>
                {sourceFilters.map((filter) => {
                  const Icon = filter.Icon
                  return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setSourceFilter(filter.id)}
                    className={cn(
                      "inline-flex h-8 min-h-0 min-w-0 flex-1 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold leading-none transition-colors sm:flex-none sm:px-2.5 sm:text-xs",
                      sourceFilter === filter.id
                        ? "border-cyan-300/55 bg-cyan-500/18 text-cyan-100"
                        : "border-white/15 text-muted-foreground hover:bg-white/[0.06]"
                    )}
                  >
                    <span className="inline-flex w-full items-center justify-center gap-1 truncate">
                      {Icon ? <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:inline" /> : null}
                      <span className="truncate sm:hidden">{filter.shortLabel}</span>
                      <span className="hidden truncate sm:inline">{filter.label}</span>
                    </span>
                  </button>
                  )
                })}
              </div>
              ) : null}
              <div className={cn("orders-status-filters flex w-full flex-nowrap items-center gap-1 sm:w-auto sm:flex-wrap sm:justify-end sm:gap-1.5", boardMode === "scheduled" && "hidden")}>
                {(["all", ...visibleStatusFilters] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "inline-flex h-[2.125rem] min-h-0 min-w-0 flex-1 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold leading-none capitalize transition-all duration-150 sm:flex-none sm:px-2.5 sm:text-xs",
                      statusFilter === status && "shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(56,189,248,0.16)] sm:-translate-y-[1px]",
                      status === "all"
                        ? statusFilter === "all"
                          ? "border-cyan-300/55 bg-cyan-500/18 text-cyan-100"
                          : "border-white/15 text-muted-foreground hover:bg-white/[0.06]"
                        : statusFilter === status
                          ? boardMode === "history" && status === "served"
                            ? historyCompletedTone.filterActive
                            : statusFilterToneClass[status].active
                          : boardMode === "history" && status === "served"
                            ? historyCompletedTone.filterIdle
                            : statusFilterToneClass[status].idle
                    )}
                  >
                    <span className="block truncate text-center">
                    {status === "all" ? (
                      `${t("filter.all")} (${visibleStatusFilters.reduce((sum, key) => sum + statusCounts[key], 0)})`
                    ) : (
                      `${statusChipLabel(status, t, boardMode === "history" && status === "served")} (${statusCounts[status]})`
                    )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden shrink-0 lg:block">
              <OrdersStaffMenu profile={staffProfile} />
            </div>
          </div>
        </header>

        <div className="mt-3">
          <ServiceRequestBanner
            requests={serviceRequests}
            pendingId={serviceAckPendingId}
            onAcknowledge={(request) => {
              void handleAcknowledgeServiceRequest(request)
            }}
          />
        </div>

        <section className="mt-3">
          {boardMode === "scheduled" ? (
            scheduledOrders.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center">
                <CalendarClock className="h-6 w-6 text-muted-foreground/60" />
                <div className="text-sm font-semibold text-foreground">{t("board.noScheduled")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("board.noScheduledHint")}
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {scheduledOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-amber-300/30 bg-[hsl(224,18%,11%)]/90 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-black tracking-wide text-foreground" dir="ltr">{order.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{orderCardGuestLine(order, t)}</p>
                      </div>
                      <span className={cn("rounded-md border border-amber-300/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-100", locale === "en" && "uppercase tracking-wide")}>
                        {t("status.scheduled")}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-amber-100">
                      <CalendarClock className="h-4 w-4 shrink-0" />
                      <span className="font-semibold" dir="ltr">
                        {formatScheduledPickupWhen(order.scheduledPickupAt, locale, t)}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {opsItemsCountLabel(t, order.itemCount)}
                        {order.note ? ` · ${t("common.instructions")} ${order.note}` : ""}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground" dir="ltr">
                        {formatMoney(order.total)}
                      </span>
                    </p>
                    {order.items.length > 0 ? (
                      <ul className="mt-3 space-y-1 border-t border-white/10 pt-2">
                        {groupOpsOrderItems(order.items).slice(0, 4).map((item, index) => (
                          <li key={`${item.id}-${index}`} className="text-xs text-foreground/90">
                            <div className="flex justify-between gap-2">
                              <span className="truncate">
                                <span dir="ltr">{item.qty}×</span> {resolveOpsCatalogName(locale, item.name, item.i18n)}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground" dir="ltr">
                                {formatMoney(item.price)}
                              </span>
                            </div>
                            {item.customizations && item.customizations.length > 0 ? (
                              <OpsCustomizationDisplayLines
                                customizations={item.customizations}
                                compact
                                showPrice={false}
                                textSizeClassName="text-[11px]"
                              />
                            ) : null}
                          </li>
                        ))}
                        {groupOpsOrderItems(order.items).length > 4 ? (
                          <li className="pt-0.5 text-xs font-semibold text-foreground/80">
                            {t("card.more", { count: groupOpsOrderItems(order.items).length - 4 })}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            )
          ) : filtered.length === 0 ? (
            <div className="col-span-full flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center">
              <ShoppingBag className="h-6 w-6 text-muted-foreground/60" />
              <div className="text-sm font-semibold text-foreground">{t("board.noMatching")}</div>
              <div className="text-xs text-muted-foreground">
                {boardMode === "live"
                  ? t("board.noMatchingLiveHint")
                  : t("board.noMatchingHistoryHint")}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {groupedOrders.map(({ status, orders }) => {
                if (orders.length === 0) return null
                const tone = statusTone[status]
                const isCollapsed = collapsedGroups.has(status)
                const isHistoryCompleted = boardMode === "history" && status === "served"
                return (
                  <div key={status}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(status)}
                      className={cn(
                        "sticky top-0 z-10 flex w-full items-center gap-2.5 border-b border-white/[0.04] bg-background/85 px-4 py-2.5 text-start backdrop-blur-md transition-colors hover:bg-white/[0.02]"
                      )}
                      aria-expanded={!isCollapsed}
                      aria-label={t("group.aria", {
                        label: statusGroupLabel(status, t, isHistoryCompleted),
                        count: orders.length,
                      })}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: isHistoryCompleted ? historyCompletedTone.accent : toneAccentColor[tone] }}
                      />
                      <span className={cn("font-mono text-[10px] font-bold text-muted-foreground/80", locale === "en" && "uppercase tracking-[0.15em]")}>
                        {statusGroupLabel(status, t, isHistoryCompleted)}
                      </span>
                      <span
                        className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold"
                        style={{
                          backgroundColor: isHistoryCompleted ? historyCompletedTone.accentBg : toneAccentBg[tone],
                          color: isHistoryCompleted ? historyCompletedTone.accent : toneAccentColor[tone],
                        }}
                      >
                        {orders.length}
                      </span>
                      <div className="ml-2 flex-1 border-t border-white/[0.04]" />
                      {isCollapsed ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </button>
                    {!isCollapsed ? (
                      <div className="px-3 pb-4 pt-2 md:px-5">
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {orders.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            boardMode={boardMode}
                            onMarkReady={handleMarkReady}
                            onMarkServed={handleMarkServed}
                            onOpenDetail={handleOpenOrder}
                            onFireTableWave={handleFireTableWave}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <Sheet open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
          <SheetContent
            side={dir === "rtl" ? "left" : "right"}
            className="w-full border-s border-white/15 bg-[linear-gradient(180deg,rgba(8,13,24,0.98),rgba(12,19,34,0.97))] p-0 sm:max-w-[520px]"
          >
            {selectedOrder && selectedIdentifier ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-white/10 px-4 pb-4 pt-5">
                  <SheetHeader className="space-y-1 text-start">
                    <SheetTitle className="flex items-center gap-2 text-cyan-100">
                      <selectedIdentifier.Icon className="h-4 w-4" />
                      <span dir="ltr">{selectedIdentifier.text}</span>
                      {selectedIsCounterOrder ? (
                        <>
                          <span
                            className={cn(
                              "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold",
                              paymentStateClass[selectedOrder.paymentState ?? "unpaid"]
                            )}
                          >
                            {selectedOrder.paymentState === "paid" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                            <span>{selectedOrder.paymentState === "paid" ? t("payment.paid") : t("payment.unpaid")}</span>
                          </span>
                          {selectedOrder.paymentState === "paid" && selectedOrder.paymentMethod ? (
                            <span
                              className={cn(
                                "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold",
                                paymentMethodClass[selectedOrder.paymentMethod]
                              )}
                            >
                              {selectedOrder.paymentMethod === "card" ? <CreditCard className="h-3.5 w-3.5" /> : null}
                              {selectedOrder.paymentMethod === "cash" ? <Banknote className="h-3.5 w-3.5" /> : null}
                              {selectedOrder.paymentMethod === "other" ? <ShoppingBag className="h-3.5 w-3.5" /> : null}
                              <span>{paymentMethodLabel(selectedOrder.paymentMethod, t)}</span>
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground">
                      {t("card.opened", {
                        datetime: formatDateTime(selectedOrder.createdAt),
                        ago: formatMinutesCompact(selectedOpenedMinutes),
                      })}
                      {" · "}
                      <span className="font-semibold text-foreground">
                        {formatMoney(selectedOrder.total)}
                      </span>
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <span className={cn("inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold", sourceChipClass[selectedOrder.source])}>
                        {selectedOrder.source === "dine_in_no_table" ? <Store className="h-3.5 w-3.5" /> : null}
                        {selectedOrder.source === "pickup" ? <ShoppingBag className="h-3.5 w-3.5" /> : null}
                        <span>{selectedSourceLabel}</span>
                      </span>
                      {selectedIsCounterOrder ? (
                        <span className="inline-flex h-6 items-center gap-1 rounded-md border border-white/15 bg-white/[0.05] px-2 text-[11px] text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span>
                            {selectedIsCounterDineIn
                              ? selectedOrder.guestLabel.match(/\d+/)?.[0] ?? selectedOrder.guestLabel
                              : selectedOrder.guestLabel}
                          </span>
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold",
                          boardMode === "history" && selectedOrder.status === "served"
                            ? historyCompletedTone.chipClass
                            : statusChipClass[selectedOrder.status]
                        )}
                      >
                        {statusChipLabel(selectedOrder.status, t, boardMode === "history" && selectedOrder.status === "served")}
                      </span>
                    </div>
                    {selectedIsCounterOrder && selectedOrder.status === "preparing" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkReady(selectedOrder)}
                        className="ms-auto inline-flex h-7 shrink-0 items-center rounded-md border border-red-300/50 bg-red-500/20 px-2.5 text-[11px] font-semibold text-red-100 transition-colors hover:bg-red-500/30"
                      >
                        {t("action.markReady")}
                      </button>
                    ) : null}
                    {selectedIsCounterOrder && selectedOrder.status === "ready" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkServed(selectedOrder)}
                        className="ms-auto inline-flex h-7 shrink-0 items-center rounded-md border border-emerald-300/50 bg-emerald-500/20 px-2.5 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30"
                      >
                        {t("action.markServed")}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  {selectedIsCounterOrder ? (
                    <section className="rounded-xl border border-white/12 bg-white/[0.03] p-3">
                      <h3 className={cn("mb-2 text-xs font-semibold text-muted-foreground", locale === "en" && "uppercase tracking-[0.12em]")}>
                        {t("progress.meal")}
                      </h3>
                      <div className="grid grid-cols-4 gap-1.5">
                        {counterStatusFlow.map((stepStatus, index) => (
                          <div
                            key={stepStatus}
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-center",
                              index <= selectedFlowIndex
                                ? statusFilterToneClass[stepStatus].idle
                                : "border-white/10 bg-black/20 text-muted-foreground"
                            )}
                          >
                            <p className="text-[10px] font-semibold">{statusChipLabel(stepStatus, t)}</p>
                            <p className="mt-0.5 text-[9px] font-medium opacity-85">
                              {selectedStageMinutes[index] == null
                                ? "—"
                                : formatMinutesCompact(selectedStageMinutes[index]!)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
                        <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                          <p className="text-[10px] text-muted-foreground">{t("progress.target")}</p>
                          <p className="font-semibold text-foreground" dir="ltr">{selectedTargetEtaMinutes}m</p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                          <p className="text-[10px] text-muted-foreground">{t("progress.elapsed")}</p>
                          <p className="font-semibold text-foreground" dir="ltr">
                            {formatMinutesCompact(selectedElapsedMinutes)}
                          </p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                          <p className="text-[10px] text-muted-foreground">{t("progress.eta")}</p>
                          <p className={cn("font-semibold", selectedEtaLate ? "text-red-300" : "text-emerald-200")} dir="ltr">
                            {selectedEtaLate
                              ? `+${formatMinutesCompact(selectedElapsedMinutes - selectedTargetEtaMinutes)}`
                              : `${selectedEtaRemaining}m`}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {selectedEtaLate ? t("progress.late") : t("progress.onTrack")}
                      </p>
                    </section>
                  ) : null}

                  {selectedOrder.waves.length > 0 ? (
                    <section>
                      <h3 className={cn("mb-2 text-xs font-semibold text-muted-foreground", locale === "en" && "uppercase tracking-[0.12em]")}>
                        {t("progress.waves")}
                      </h3>
                      <WaveStrip waves={selectedOrder.waves} />
                    </section>
                  ) : null}

                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className={cn("text-xs font-semibold text-muted-foreground", locale === "en" && "uppercase tracking-[0.12em]")}>
                        {t("common.items")}
                      </h3>
                      <span className="text-xs text-muted-foreground">{opsItemsCountLabel(t, selectedOrder.itemCount)}</span>
                    </div>
                    <div className="space-y-3">
                      {selectedSeatGroups.map((group) => {
                        const showSeatChrome = group.seatNumber != null || selectedSeatGroups.length > 1
                        return (
                          <div key={group.key} className="space-y-2">
                            {group.items.map(({ item, index }) => (
                              <div key={`${item.id}-${index}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      <span dir="ltr">{item.qty}x</span> {resolveOpsCatalogName(locale, item.name, item.i18n)}
                                    </p>
                                    {item.customizations && item.customizations.length > 0 ? (
                                      <OpsCustomizationDisplayLines
                                        customizations={item.customizations}
                                        textSizeClassName="text-xs"
                                      />
                                    ) : null}
                                    {item.notes ? (
                                      <p className="mt-1 truncate text-xs">
                                        <span className="text-white/55">{t("common.instructions")}</span>{" "}
                                        <span className="italic text-amber-200/80">{item.notes}</span>
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="text-sm font-semibold tabular-nums text-foreground" dir="ltr">
                                      {formatMoney(item.price)}
                                    </span>
                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                      {item.seatNumber != null && item.seatNumber > 0 ? (
                                        <span className="inline-flex h-5 max-w-[9rem] items-center truncate rounded border border-sky-300/35 bg-sky-500/15 px-1.5 text-[10px] font-semibold text-sky-100">
                                          {`S${item.seatNumber}`}
                                        </span>
                                      ) : null}
                                      <span
                                        className={cn(
                                          "inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-semibold",
                                          statusChipClass[itemStatusToUnified(item.status)],
                                        )}
                                      >
                                        {formatItemStatusLabel(item.status, t)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {showSeatChrome ? (
                              <div className="flex items-center justify-between gap-2 rounded-md border border-sky-300/20 bg-sky-500/10 px-3 py-1.5 text-xs">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {group.seatNumber != null ? (
                                    <span className="inline-flex h-5 max-w-[9rem] shrink-0 items-center truncate rounded border border-sky-300/35 bg-sky-500/15 px-1.5 text-[10px] font-semibold text-sky-100">
                                      {`S${group.seatNumber}${group.seatGuestName ? ` · ${group.seatGuestName}` : ""}`}
                                    </span>
                                  ) : (
                                    <span className="inline-flex h-5 items-center rounded border border-sky-300/35 bg-sky-500/15 px-1.5 text-[10px] font-semibold text-sky-100">
                                      {t("common.noSeat")}
                                    </span>
                                  )}
                                  <span className="font-medium text-sky-100/90">{t("common.seatTotal")}</span>
                                </div>
                                <span className="shrink-0 font-semibold tabular-nums text-sky-50">
                                  {formatMoney(group.total)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                    {selectedOrder.note ? (
                      <div
                        className={cn(
                          "mt-3 rounded-lg border px-3 py-2 text-xs",
                          /allergy|no nuts|no nut|allergic/i.test(selectedOrder.note)
                            ? "border-amber-400/25 bg-amber-500/10 text-amber-200/90"
                            : "border-white/10 bg-black/20 text-muted-foreground",
                        )}
                      >
                        <span className="not-italic text-white/55">{t("common.instructions")}</span>{" "}
                        <span className="italic">{selectedOrder.note}</span>
                      </div>
                    ) : null}
                    <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                      {typeof selectedOrder.taxAmount === "number" &&
                      selectedOrder.taxAmount > 0 &&
                      typeof selectedOrder.subtotal === "number" ? (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{t("common.subtotal")}</span>
                            <span className="tabular-nums text-foreground">
                              {formatMoney(selectedOrder.subtotal)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{t("common.tax")}</span>
                            <span className="tabular-nums text-foreground">
                              {formatMoney(selectedOrder.taxAmount)}
                            </span>
                          </div>
                        </>
                      ) : null}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-semibold text-foreground">{t("common.total")}</span>
                        <span className="text-base font-bold tabular-nums text-foreground">
                          {formatMoney(selectedOrder.total)}
                        </span>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="border-t border-white/10 p-4">
                  {showMoneyActions ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canMarkPaidSelected}
                        onClick={() => {
                          if (!selectedOrder || !canMarkPaidSelected) return
                          handleMarkPaid(selectedOrder, "cash")
                        }}
                        className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-500/15"
                      >
                        {t("action.markPaid")}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t("action.orderActions")}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={8}
                          className="w-48 border-white/10 bg-[hsl(224,18%,12%)] text-zinc-100"
                        >
                          <DropdownMenuItem
                            disabled={!canVoidSelected}
                            className="cursor-pointer text-rose-200 focus:bg-rose-500/15 focus:text-rose-100 data-[disabled]:opacity-40"
                            onSelect={() => {
                              if (!selectedOrder || !canVoidSelected) return
                              setConfirmAction({ type: "void", order: selectedOrder })
                            }}
                          >
                            {t("action.voidOrder")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canRefundSelected}
                            className="cursor-pointer text-fuchsia-200 focus:bg-fuchsia-500/15 focus:text-fuchsia-100 data-[disabled]:opacity-40"
                            onSelect={() => {
                              if (!selectedOrder || !canRefundSelected) return
                              setConfirmAction({ type: "refund", order: selectedOrder })
                            }}
                          >
                            {t("action.refundOrder")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>

        <AlertDialog
          open={confirmAction != null}
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null)
          }}
        >
          <AlertDialogContent className="border-white/15 bg-[hsl(224,18%,12%)] text-foreground">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === "refund" ? t("action.refundConfirmTitle") : t("action.voidConfirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === "refund"
                  ? t("action.refundConfirmBody", { label: confirmAction.order.label })
                  : t("action.voidConfirmBody", { label: confirmAction?.order.label ?? "" })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className={
                  confirmAction?.type === "refund"
                    ? "bg-fuchsia-600 text-white hover:bg-fuchsia-500"
                    : "bg-rose-600 text-white hover:bg-rose-500"
                }
                onClick={() => {
                  if (!confirmAction) return
                  const action = confirmAction
                  setConfirmAction(null)
                  if (action.type === "refund") handleRefundOrder(action.order)
                  else handleVoidOrder(action.order)
                }}
              >
                {confirmAction?.type === "refund" ? t("action.refund") : t("action.void")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  )
}
