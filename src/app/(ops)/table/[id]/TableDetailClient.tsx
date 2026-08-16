"use client"

import { useState, useCallback, useMemo, useEffect, useRef, startTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { TopBar } from "@/components/table-detail/top-bar"
import { TableVisual } from "@/components/table-detail/table-visual"
import { WaveTimeline } from "@/components/table-detail/wave-timeline"
import { OrderList } from "@/components/table-detail/order-list"
import { InfoPanel } from "@/components/table-detail/info-panel"
import { ActionBar } from "@/components/table-detail/action-bar"
import { PaymentModal } from "@/components/table-detail/payment-modal"
import { FoodReadyAlert } from "@/components/table-detail/food-ready-alert"
import { KitchenDelayAlert } from "@/components/table-detail/kitchen-delay-alert"
import { BillRequestAlert } from "@/components/table-detail/bill-request-alert"
import { WaiterRequestAlert } from "@/components/table-detail/waiter-request-alert"
import { SeatPartyModal } from "@/components/floor-map/seat-party-modal"
import { Button } from "@/components/ui/button"
import { CategoryNav } from "@/components/take-order/category-nav"
import { MenuSearch } from "@/components/take-order/menu-search"
import { MenuItemCard } from "@/components/take-order/menu-item-card"
import { CustomizeItemModal } from "@/components/take-order/customize-item-modal"
import type { ItemCustomization } from "@/components/take-order/customize-item-modal"
import { OrderSummary } from "@/components/take-order/order-summary"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getReadyItems } from "@/lib/table-data"
import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import type {
  TableDetail,
  ItemStatus,
  Seat,
  WaveStatus,
  WaveType,
  OrderItem as TableOrderItem,
} from "@/lib/table-data"
import {
  calculateOrderTotals,
  hasAllergyConflict,
  takeOrderData,
} from "@/lib/take-order-data"
import type { MenuItem, OrderItem as TakeOrderItem } from "@/lib/take-order-data"
import { useLocationMenu } from "@/lib/hooks/useLocationMenu"
import { useRestaurantStore } from "@/store/restaurantStore"
import { useLocation } from "@/lib/contexts/LocationContext"
import { isTableView, buildOptimisticSeatedTableView, buildOptimisticForceClosedTableView, isOptimisticSessionId, type TableView, type TableViewItemStatus, type TableViewUiMode } from "@/lib/pos/tableView"
import type { StoreTable, StoreTableSessionState } from "@/store/types"
import { storeTablesToFloorTables } from "@/lib/floor-map-data"
import { floorMapPath } from "@/lib/floor-map/floorMapNav"
import { patchFloorMapViewTableCleaning } from "@/lib/floor-map/floorMapView"
import { hasBillRequest, hasWaiterRequestAlert } from "@/lib/floor-map/acknowledgeTableService"
import { prefetchFloorMapView } from "@/lib/floor-map/prefetchFloorMapView"
import { prefetchRoute } from "@/components/ui/link"
import { fetchPos, getPosCorrelationId, makeIdempotencyKey } from "@/lib/pos/fetchPos"
import { fireAndForget } from "@/lib/pos/fireAndForget"
import { posDebugError } from "@/lib/pos/posDebugError"
import { TablePageSkeleton } from "@/components/table-detail/TablePageSkeleton"
import {
  getTableCache,
  getFloorMapCache,
  setTableCache,
  setFloorMapCache,
  invalidateFloorMapCache,
  invalidateTableCache,
  invalidatePostSeatingCaches,
  OPS_POST_SEATING_EVENT,
  type PostSeatingDetail,
} from "@/lib/view-cache"
import {
  deriveCanonicalWaveStatusFromItems,
  mapCanonicalWaveStatusToTablePageStatus,
} from "@/lib/wave-status"
import { uniqueById } from "@/lib/promotions/promotions-category"

function getAutoSelectedOptions(item: MenuItem): Record<string, string> {
  const options: Record<string, string> = {}
  for (const option of item.options || []) {
    if (!option.required) continue
    const firstChoice = option.choices[0]
    if (!firstChoice) continue
    options[option.name] =
      typeof firstChoice === "string" ? firstChoice : firstChoice.name
  }
  return options
}

function getAutoOptionUpcharge(item: MenuItem, selectedOptions: Record<string, string>): number {
  let upcharge = 0
  for (const option of item.options || []) {
    const selected = selectedOptions[option.name]
    if (!selected) continue
    const match = option.choices.find((choice) =>
      typeof choice === "string" ? choice === selected : choice.name === selected
    )
    if (match && typeof match !== "string") {
      upcharge += match.price
    }
  }
  return upcharge
}

function toUiErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value
  if (value instanceof Error && value.message.trim()) return value.message
  if (value && typeof value === "object") {
    const message = (value as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return fallback
}

function withPosDevContext(
  message: string,
  endpoint: string,
  payload?: unknown,
  res?: Response | null,
  label = "POS request failed"
): string {
  if (process.env.NODE_ENV === "production") return message
  posDebugError({ label, endpoint, payload, res })
  const correlationId = getPosCorrelationId(payload, res)
  const corrPart = correlationId ? `, corr: ${correlationId}` : ""
  return `${message} (endpoint: ${endpoint}${corrPart})`
}

type PosMutationError = {
  message: string
  payload?: unknown
  res?: Response | null
}

function mutationError(message: string, payload?: unknown, res?: Response | null): PosMutationError {
  return { message, payload, res }
}

type OptimisticSeatOps = {
  added: Array<{ opId: string; tempSeatNumber: number }>
  deleted: number[]
  renamed: Record<number, number>
}

function applyOptimisticSeats(baseSeats: Seat[], ops: OptimisticSeatOps): Seat[] {
  const deletedSet = new Set(ops.deleted)
  let seats = baseSeats
    .filter((s) => !deletedSet.has(s.number))
    .map((s) => {
      const newNum = ops.renamed[s.number] ?? s.number
      return { ...s, number: newNum }
    })
  for (const { tempSeatNumber } of ops.added) {
    seats.push({
      number: tempSeatNumber,
      dietary: [],
      notes: [],
      items: [],
      guestName: null,
    })
  }
  return seats.sort((a, b) => a.number - b.number)
}

function isPosMutationError(error: unknown): error is PosMutationError {
  if (!error || typeof error !== "object") return false
  const maybe = error as { message?: unknown }
  return typeof maybe.message === "string"
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isDbOrderItemId(id: string): boolean {
  return UUID_REGEX.test(id)
}

function getItemWaveNumber(item: TableOrderItem): number | null {
  if (typeof item.waveNumber === "number" && Number.isFinite(item.waveNumber)) {
    return item.waveNumber
  }
  const waveTag = item.mods?.find((mod) => /^Wave\s+\d+$/i.test(mod))
  if (waveTag) {
    const match = waveTag.match(/(\d+)/)
    if (match) {
      const taggedWave = Number(match[1])
      if (Number.isFinite(taggedWave)) return taggedWave
    }
  }

  if (item.wave === "drinks") return 1
  if (item.wave === "food") return 2
  if (item.wave === "dessert") return 3
  return null
}

function getDraftItemWaveNumber(item: TakeOrderItem): number {
  const match = item.notes?.match(/\bWave\s+(\d+)\b/i)
  if (match) {
    const parsed = Number(match[1])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  if (item.wave === "drinks") return 1
  if (item.wave === "food") return 2
  if (item.wave === "dessert") return 3
  return 1
}

/** Wave is ready only when all non-void items are ready or served (no partial station readiness). */
function getMealWaveStatus(items: TableOrderItem[]): WaveStatus {
  return mapCanonicalWaveStatusToTablePageStatus(
    deriveCanonicalWaveStatusFromItems(items)
  )
}

function getNextHeldWaveNumberFromItems(items: TableOrderItem[]): number | null {
  const heldWaveNumbers = items
    .filter((item) => item.status === "held")
    .map((item) => getItemWaveNumber(item))
    .filter((waveNumber): waveNumber is number => typeof waveNumber === "number" && Number.isFinite(waveNumber))

  if (heldWaveNumbers.length === 0) return null
  return Math.min(...heldWaveNumbers)
}

function buildMealProgressState(
  table: TableDetail,
  tableItems: TableOrderItem[],
  waveCount: number
): {
  waves: TableDetail["waves"]
  waveItemsById: Record<string, { seatNumber: number; item: TableOrderItem }[]>
  waveLabelsById: Record<string, string>
  nextFireableWaveNumber: number | null
} {
  const allItemsWithSeat = [
    ...table.seats.flatMap((seat) =>
      seat.items.map((item) => ({ seatNumber: seat.number, item }))
    ),
    ...tableItems.map((item) => ({ seatNumber: 0, item })),
  ].filter(({ item }) => item.status !== "void")

  const hasMealStarted = allItemsWithSeat.some(({ item }) => item.status !== "held")
  if (!hasMealStarted) {
    return {
      waves: [],
      waveItemsById: {},
      waveLabelsById: {},
      nextFireableWaveNumber: null,
    }
  }

  const groupedByNumber = new Map<number, { seatNumber: number; item: TableOrderItem }[]>()
  for (const entry of allItemsWithSeat) {
    const waveNumber = getItemWaveNumber(entry.item)
    if (!waveNumber) continue
    const existing = groupedByNumber.get(waveNumber) ?? []
    existing.push(entry)
    groupedByNumber.set(waveNumber, existing)
  }

  const maxWaveWithItems = Math.max(0, ...Array.from(groupedByNumber.keys()))
  const totalWaves = maxWaveWithItems > 0 ? Math.max(1, waveCount, maxWaveWithItems) : 0
  const waveTypeOrder: WaveType[] = ["drinks", "food", "dessert"]

  const waves: TableDetail["waves"] = []
  const waveItemsById: Record<string, { seatNumber: number; item: TableOrderItem }[]> = {}
  const waveLabelsById: Record<string, string> = {}
  let nextFireableWaveNumber: number | null = null

  for (let waveNumber = 1; waveNumber <= totalWaves; waveNumber += 1) {
    const waveId = `mw-${waveNumber}`
    const itemsForWave = groupedByNumber.get(waveNumber) ?? []
    const onlyItems = itemsForWave.map(({ item }) => item)
    const status = getMealWaveStatus(onlyItems)
    if (nextFireableWaveNumber === null && onlyItems.some((item) => item.status === "held")) {
      nextFireableWaveNumber = waveNumber
    }

    waveItemsById[waveId] = itemsForWave
    waveLabelsById[waveId] = `W${waveNumber}`
    waves.push({
      id: waveId,
      type: waveTypeOrder[(waveNumber - 1) % waveTypeOrder.length],
      status,
      eta:
        status === "preparing"
          ? Math.max(
              0,
              ...onlyItems
                .map((item) => item.eta ?? 0)
                .filter((eta) => eta > 0)
            ) || undefined
          : undefined,
      items: onlyItems.length,
    })
  }

  return { waves, waveItemsById, waveLabelsById, nextFireableWaveNumber }
}

function cloneTableItems(items: StoreTableSessionState["tableItems"] | undefined): TableOrderItem[] {
  if (!items) return []
  return items.map((item) => ({
    ...item,
    mods: item.mods ? [...item.mods] : undefined,
  }))
}

/** Format "19:30" or "07:30" to "7:30 PM" / "7:30 AM" */
function formatReservationTime(timeStr: string): string {
  const parts = String(timeStr).trim().split(":")
  const h = parseInt(parts[0] ?? "12", 10) || 0
  const m = parseInt(parts[1] ?? "0", 10) || 0
  const hour12 = h % 12 || 12
  const ampm = h < 12 ? "AM" : "PM"
  const minStr = m > 0 ? `:${String(m).padStart(2, "0")}` : ""
  return `${hour12}${minStr} ${ampm}`
}

/** Wave number to type: 1->drinks, 2->food, 3->dessert, then cycle */
function waveNumberToType(n: number): "drinks" | "food" | "dessert" {
  const i = ((n - 1) % 3) + 1
  return i === 1 ? "drinks" : i === 2 ? "food" : "dessert"
}

function mapPosShapeToUi(shape: string): TableDetail["shape"] {
  if (shape === "round") return "round"
  if (shape === "square") return "square"
  return "rectangular"
}

function createEmptyTableDetail(tableId: string): TableDetail {
  return {
    id: tableId,
    floorPlanId: null,
    number: 0,
    capacity: 0,
    shape: "round",
    section: "Main Dining",
    server: null,
    seatedAt: "",
    lastCheckIn: "",
    guestCount: 0,
    status: "available",
    pacing: "quick",
    returningGuest: null,
    notes: [],
    seats: [],
    waves: [],
    bill: { subtotal: 0, tax: 0, total: 0 },
  }
}

function projectTableView(view: TableView | null, tableId: string): {
  table: TableDetail
  tableItems: TableOrderItem[]
  waveCount: number
  sessionId: string | null
  uiMode: TableViewUiMode
  furnitureStatus: "active" | "maintenance" | "disabled"
  outstandingItems: TableView["outstanding"]
  kitchenDelays: TableView["delays"]
  seatIdByNumber: Map<number, string>
  itemOrderIds: Map<string, string>
} {
  /** null view = unresolved/loading. Do not use returned uiMode for rendering; gate on view !== null. */
  if (!view) {
    return {
      table: createEmptyTableDetail(tableId),
      tableItems: [],
      waveCount: 1,
      sessionId: null,
      uiMode: "needs_seating",
      furnitureStatus: "active",
      outstandingItems: null,
      kitchenDelays: null,
      seatIdByNumber: new Map(),
      itemOrderIds: new Map(),
    }
  }

  const seatsSorted = [...view.seats].sort((a, b) => a.seatNumber - b.seatNumber)
  const seatIdByNumber = new Map<number, string>()
  for (const seat of seatsSorted) {
    seatIdByNumber.set(seat.seatNumber, seat.id)
  }
  const seatMap = new Map<number, TableOrderItem[]>()
  const itemOrderIds = new Map<string, string>()
  const sharedItems: TableOrderItem[] = []
  let maxWave = 1

  for (const row of view.items) {
    maxWave = Math.max(maxWave, row.waveNumber)
    itemOrderIds.set(row.id, row.orderId)
    const notes = row.notes?.trim() ? row.notes.split("·").map((part) => part.trim()).filter(Boolean) : []
    const item: TableOrderItem = {
      id: row.id,
      ...(row.menuItemId && { menuItemId: row.menuItemId }),
      name: row.name,
      price: row.price * Math.max(1, row.quantity),
      status: row.status,
      wave: waveNumberToType(row.waveNumber),
      waveNumber: row.waveNumber,
      mods: notes.length > 0 ? notes : undefined,
    }
    if (row.seatNumber > 0) {
      const list = seatMap.get(row.seatNumber) ?? []
      list.push(item)
      seatMap.set(row.seatNumber, list)
    } else {
      sharedItems.push(item)
    }
  }

  const waveCount = view.openSession?.waveCount ?? Math.max(1, ...view.waves.map((w) => w.waveNumber), maxWave)
  const table: TableDetail = {
    ...createEmptyTableDetail(view.table.id),
    id: view.table.id,
    floorPlanId: view.table.floorPlanId ?? null,
    number: view.table.number,
    capacity: view.table.capacity,
    section: view.table.section,
    shape: mapPosShapeToUi(view.table.shape),
    guestCount: view.openSession?.guestCount ?? view.table.guests ?? seatsSorted.length,
    seatedAt: view.table.seatedAt ?? view.openSession?.openedAt ?? "",
    lastCheckIn: view.table.seatedAt ?? view.openSession?.openedAt ?? "",
    status: view.serviceStage ?? "available",
    seats: seatsSorted.map((seat) => ({
      number: seat.seatNumber,
      dietary: [],
      notes: [],
      items: cloneTableItems(seatMap.get(seat.seatNumber) ?? []),
      guestName: seat.guestName,
    })),
    bill: {
      subtotal: view.bill.subtotal,
      tax: view.bill.tax,
      total: view.bill.total,
    },
  }

  return {
    table,
    tableItems: sharedItems,
    waveCount,
    sessionId: view.openSession?.id ?? null,
    uiMode: view.uiMode ?? (view.openSession ? "in_service" : "needs_seating"),
    furnitureStatus: (view.table.status === "maintenance" || view.table.status === "disabled" ? view.table.status : "active") as "active" | "maintenance" | "disabled",
    outstandingItems: view.outstanding ?? null,
    kitchenDelays: view.delays ?? null,
    seatIdByNumber,
    itemOrderIds,
  }
}

type TableDetailClientProps = {
  initialTableView: import("@/lib/pos/tableView").TableView;
  tableId: string;
};

export function TableDetailClient({ initialTableView, tableId }: TableDetailClientProps) {
  const id = tableId;
  const router = useRouter()
  const { formatMoney } = useMerchantLocalization()
  const { currentLocationId } = useLocation()
  const { menuItems: locationMenuItems, categories: locationCategories, loading: menuLoading } = useLocationMenu()
  const storeTables = useRestaurantStore((s) => s.tables)
  const openOrderForTable = useRestaurantStore((s) => s.openOrderForTable)
  const closeOrder = useRestaurantStore((s) => s.closeOrder)
  const activeStoreTable = useMemo<StoreTable | undefined>(
    () => storeTables.find((t) => t.id === id || t.id === id.toLowerCase()),
    [id, storeTables]
  )
  const floorTablesForModal = useMemo(
    () => storeTablesToFloorTables(storeTables),
    [storeTables]
  )
  const initialTableViewRef = useRef(initialTableView)
  const prevTableIdRef = useRef<string | null>(null)
  const itemOrderIdsRef = useRef<Map<string, string>>(new Map())
  const seatIdByNumberRef = useRef<Map<number, string>>(new Map())
  const addItemsInFlightRef = useRef(false)
  const sendRollbackWavesRef = useRef<TableView["waves"] | null>(null)
  const mutationInFlightRef = useRef(0)
  const refreshInFlightRef = useRef(false)
  const rollbackSnapshotRef = useRef<{ items?: TableView["items"]; waves?: TableView["waves"] } | null>(null)
  /** If user exits ordering before wave creation finishes, delete once the wave exists. */
  const pendingAutoDeleteWaveRef = useRef<number | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [waiterAckInFlight, setWaiterAckInFlight] = useState(false)
  const [seatPartyOpen, setSeatPartyOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [closeInFlight, setCloseInFlight] = useState(false)
  const [isOrderingInline, setIsOrderingInline] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("drinks")
  const [searchQuery, setSearchQuery] = useState("")
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null)
  const [customizeDefaults, setCustomizeDefaults] = useState<{ seat: number; wave: number } | null>(null)
  const [editingOrderItemId, setEditingOrderItemId] = useState<string | null>(null)
  const [orderItems, setOrderItems] = useState<TakeOrderItem[]>([])
  const [selectedWaveNumber, setSelectedWaveNumber] = useState(1)
  const [autoCreatedWaveNumber, setAutoCreatedWaveNumber] = useState<number | null>(null)
  const [summaryScope, setSummaryScope] = useState<"seat" | "all">("all")
  const [warningDialog, setWarningDialog] = useState<{
    open: boolean
    title: string
    description: string
  }>({
    open: false,
    title: "",
    description: "",
  })
  const [discardDraftDialogOpen, setDiscardDraftDialogOpen] = useState(false)
  const [optimisticSeatOps, setOptimisticSeatOps] = useState<OptimisticSeatOps>({
    added: [],
    deleted: [],
    renamed: {},
  })
  const [optimisticWavesAdded, setOptimisticWavesAdded] = useState<Array<{ opId: string; waveNumber: number }>>([])
  const [optimisticWavesDeleted, setOptimisticWavesDeleted] = useState<number[]>([])
  const [waveAddInFlight, setWaveAddInFlight] = useState(false)
  const [waveDeleteInFlight, setWaveDeleteInFlight] = useState<Set<number>>(new Set())
  const [seatAddInFlight, setSeatAddInFlight] = useState(false)
  const [seatDeleteInFlight, setSeatDeleteInFlight] = useState<Set<number>>(new Set())
  const [seatRenameInFlight, setSeatRenameInFlight] = useState<Set<number>>(new Set())
  const [armedWaveDelete, setArmedWaveDelete] = useState<number | null>(null)
  const [armedSeatDelete, setArmedSeatDelete] = useState<number | null>(null)
  const [seatRenameState, setSeatRenameState] = useState<{ seatNumber: number; input: string } | null>(null)
  const [tableViewLoading, setTableViewLoading] = useState(() =>
    initialTableView ? false : !getTableCache(id)
  )
  const [tableViewError, setTableViewError] = useState<string | null>(null)
  const [kitchenDelayDismissed, setKitchenDelayDismissed] = useState(false)
  const waveHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seatHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waveHoldTriggeredRef = useRef<number | null>(null)
  const addContextPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [addContextPulse, setAddContextPulse] = useState<{
    id: number
    targetLabel: string
    waveLabel: string
  } | null>(null)
  const [tableView, setTableView] = useState<TableView | null>(
    () => initialTableView ?? getTableCache(id) ?? null
  )
  const {
    table,
    tableItems,
    waveCount,
    sessionId: tableViewSessionId,
    uiMode,
    furnitureStatus,
    outstandingItems,
    kitchenDelays,
    seatIdByNumber,
    itemOrderIds,
  } = useMemo(() => {
    if (process.env.NODE_ENV !== "production") {
      console.time("[perf] projectTableView")
    }
    const result = projectTableView(tableView, id)
    if (process.env.NODE_ENV !== "production") {
      console.timeEnd("[perf] projectTableView")
    }
    return result
  }, [id, tableView])

  const projectedSeats = useMemo(
    () => applyOptimisticSeats(table.seats, optimisticSeatOps),
    [table.seats, optimisticSeatOps]
  )
  const backToFloorMapHref = useMemo(() => floorMapPath(table.floorPlanId), [table.floorPlanId])

  useEffect(() => {
    prefetchRoute(backToFloorMapHref, router)
  }, [backToFloorMapHref, router])

  useEffect(() => {
    const locationId = currentLocationId ?? tableView?.table.locationId ?? null
    const floorplanId = table.floorPlanId?.trim() || null
    if (!locationId || !floorplanId) return
    void prefetchFloorMapView(locationId, floorplanId)
  }, [currentLocationId, tableView?.table.locationId, table.floorPlanId])

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[table]", { tableStatus: table.status, hasSession: !!tableViewSessionId, uiMode })
    }
  }, [table.status, tableViewSessionId, uiMode])
  const effectiveSessionId = tableViewSessionId ?? activeStoreTable?.sessionId ?? null
  const isInteractionOpen = useMemo(
    () =>
      isOrderingInline ||
      paymentOpen ||
      seatPartyOpen ||
      discardDraftDialogOpen ||
      warningDialog.open ||
      seatRenameState !== null ||
      customizingItem !== null,
    [
      customizingItem,
      discardDraftDialogOpen,
      isOrderingInline,
      paymentOpen,
      seatPartyOpen,
      seatRenameState,
      warningDialog.open,
    ]
  )
  const isInteractionOpenRef = useRef(false)

  const withMutation = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[perf] UI blocking state active", { source: "mutationInFlightRef" })
    }
    mutationInFlightRef.current += 1
    try {
      return await fn()
    } finally {
      mutationInFlightRef.current = Math.max(0, mutationInFlightRef.current - 1)
    }
  }, [])

  const applyTableView = useCallback((view: TableView) => {
    setTableView(view)
  }, [])

  const patchTableView = useCallback((patchFn: (prev: TableView) => TableView) => {
    setTableView((prev) => (prev ? patchFn(prev) : prev))
  }, [])

  const refreshTableView = useCallback(async (options?: { silent?: boolean }) => {
    if (refreshInFlightRef.current) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[perf] refresh skipped: inFlight")
      }
      return
    }
    refreshInFlightRef.current = true
    if (process.env.NODE_ENV !== "production") {
      console.time("[perf] refreshTableView total")
    }
    if (!options?.silent) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[perf] UI blocking state active", { source: "tableViewLoading" })
      }
      setTableViewLoading(true)
      setTableViewError(null)
    }
    try {
      const endpoint = `/api/tables/${encodeURIComponent(id)}/pos`
      if (process.env.NODE_ENV !== "production") {
        console.time("[perf] refresh fetch")
      }
      const res = await fetch(endpoint, { cache: "no-store" })
      const payload = await res.json().catch(() => null)
      if (process.env.NODE_ENV !== "production") {
        console.timeEnd("[perf] refresh fetch")
      }
      if (!res.ok || payload?.ok === false || !isTableView(payload?.data)) {
        const message = withPosDevContext(
          toUiErrorMessage(payload?.error, "Failed to load table view."),
          endpoint,
          payload,
          res,
          "Failed to load table view"
        )
        setTableViewError(message)
        return false
      }
      if (process.env.NODE_ENV !== "production") {
        console.time("[perf] refresh apply state")
      }
      const data = payload.data
      applyTableView(data)
      setTableCache(id, data)
      setKitchenDelayDismissed(false)
      if (!options?.silent) setTableViewError(null)
      if (process.env.NODE_ENV !== "production") {
        console.timeEnd("[perf] refresh apply state")
      }
      return true
    } catch {
      setTableViewError("Network error. Failed to load table view.")
      return false
    } finally {
      refreshInFlightRef.current = false
      if (!options?.silent) setTableViewLoading(false)
      if (process.env.NODE_ENV !== "production") {
        console.timeEnd("[perf] refreshTableView total")
      }
    }
  }, [applyTableView, id])

  const mutateThenRefresh = useCallback(
    async <T,>(
      label: string,
      endpoint: string,
      fn: () => Promise<T>,
      options?: { skipRefreshOnSuccess?: boolean }
    ): Promise<T | null> =>
      withMutation(async () => {
        try {
          const result = await fn()
          if (!options?.skipRefreshOnSuccess) {
            refreshTableView({ silent: true })
          }
          return result
        } catch (error) {
          const normalized = isPosMutationError(error)
            ? error
            : mutationError(toUiErrorMessage(error, "Request failed. Please try again."))
          const endpointWithContext = withPosDevContext(
            normalized.message,
            endpoint,
            normalized.payload,
            normalized.res ?? null,
            label
          )
          posDebugError({
            label,
            endpoint,
            payload: normalized.payload ?? normalized.message,
            res: normalized.res ?? null,
          })
          setWarningDialog({
            open: true,
            title: label,
            description: endpointWithContext,
          })
          return null
        }
      }),
    [refreshTableView, withMutation]
  )

  const fireAndReconcile = useCallback(
    async <T,>(opts: {
      label: string
      endpoint: string
      optimisticApply: () => void
      optimisticRollback: () => void
      onSuccessClearOptimistic?: () => void
      /** If provided, patch tableView with mutation response; no refresh. */
      onSuccessPatch?: (result: T) => void
      /** Neutral name for success logs (e.g. "addSeat", "deleteWave"). */
      successLabel?: string
      requestFn: () => Promise<T>
    }) => {
      opts.optimisticApply()
      try {
        const reqStart = process.env.NODE_ENV !== "production" ? performance.now() : 0
        const result = await opts.requestFn()
        if (process.env.NODE_ENV !== "production" && reqStart > 0) {
          console.log("[perf] mutation request duration", { ms: Math.round(performance.now() - reqStart), endpoint: opts.endpoint })
        }
        if (opts.onSuccessPatch) {
          opts.onSuccessPatch(result)
          opts.onSuccessClearOptimistic?.()
          if (process.env.NODE_ENV !== "production") {
            console.log("[perf] mutation success: patched tableView (no refresh)", { action: opts.successLabel ?? opts.label })
          }
        } else {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[perf] handler called refreshTableView on success (no onSuccessPatch)", { label: opts.label, endpoint: opts.endpoint })
          }
          const p = refreshTableView({ silent: true })
          fireAndForget(p, `reconcile after ${opts.label}`)
          p.then(() => opts.onSuccessClearOptimistic?.())
        }
        return result
      } catch (error) {
        opts.optimisticRollback()
        const normalized = isPosMutationError(error)
          ? error
          : mutationError(toUiErrorMessage(error, "Request failed. Please try again."))
        const endpointWithContext = withPosDevContext(
          normalized.message,
          opts.endpoint,
          normalized.payload,
          normalized.res ?? null,
          opts.label
        )
        posDebugError({
          label: opts.label,
          endpoint: opts.endpoint,
          payload: normalized.payload ?? normalized.message,
          res: normalized.res ?? null,
        })
        setWarningDialog({
          open: true,
          title: opts.label,
          description: endpointWithContext,
        })
        throw error
      }
    },
    [refreshTableView]
  )

  useEffect(() => {
    if (prevTableIdRef.current !== id) {
      prevTableIdRef.current = id
      const cached = getTableCache(id)
      if (!cached) {
        setTableView(null)
      }
      setSelectedWaveNumber(1)
      setOptimisticSeatOps({ added: [], deleted: [], renamed: {} })
      setOptimisticWavesAdded([])
      setOptimisticWavesDeleted([])
      setWaveAddInFlight(false)
      setWaveDeleteInFlight(new Set())
      setSeatAddInFlight(false)
      setSeatDeleteInFlight(new Set())
      setSeatRenameInFlight(new Set())
      setOrderItems([])
      setKitchenDelayDismissed(false)
      itemOrderIdsRef.current = new Map()
      seatIdByNumberRef.current = new Map()
    }
    const fromServer = initialTableViewRef.current
    if (fromServer && (fromServer.table.id === id || (fromServer.table.displayId && String(fromServer.table.displayId).toLowerCase() === id.toLowerCase()))) {
      initialTableViewRef.current = null
      setTableCache(id, fromServer)
      setTableViewLoading(false)
      setTableViewError(null)
      void refreshTableView({ silent: true })
      return
    }
    const cached = getTableCache(id)
    if (cached) {
      applyTableView(cached)
      setTableViewLoading(false)
      setTableViewError(null)
      void refreshTableView({ silent: true })
    } else {
      void refreshTableView()
    }
  }, [id, refreshTableView, applyTableView])

  useEffect(() => {
    const handler = (e: CustomEvent<PostSeatingDetail>) => {
      const evTableId = e.detail?.tableId
      if (!evTableId) return
      const matches = evTableId === id || evTableId.toLowerCase() === id.toLowerCase()
      if (matches) void refreshTableView({ silent: true })
    }
    window.addEventListener(OPS_POST_SEATING_EVENT, handler as EventListener)
    return () => window.removeEventListener(OPS_POST_SEATING_EVENT, handler as EventListener)
  }, [id, refreshTableView])

  useEffect(() => {
    itemOrderIdsRef.current = itemOrderIds
    seatIdByNumberRef.current = seatIdByNumber
  }, [itemOrderIds, seatIdByNumber])

  const readyItems = getReadyItems(projectedSeats)
  const showAlert = readyItems.length > 0 && !alertDismissed
  const showWaiterRequest = hasWaiterRequestAlert(tableView?.table.alerts ?? null)
  const showBillRequest = hasBillRequest(tableView?.table.stage)
  const selectedSeatNumber = selectedSeat
  const waveNumbers = useMemo(() => {
    const backend = (tableView?.waves ?? []).map((w) => w.waveNumber)
    const deletedSet = new Set(optimisticWavesDeleted)
    const filtered = backend.filter((n) => !deletedSet.has(n))
    const base = filtered
    const addedNums = optimisticWavesAdded.map((a) => a.waveNumber)
    const withOptimistic = [...new Set([...base, ...addedNums])].sort((a, b) => a - b)
    return withOptimistic
  }, [tableView?.waves, optimisticWavesAdded, optimisticWavesDeleted])

  const heldWaveNumbers = useMemo(() => {
    const held = new Set<number>()
    for (const w of tableView?.waves ?? []) {
      if (w.status === "held") held.add(w.waveNumber)
    }
    for (const a of optimisticWavesAdded) {
      held.add(a.waveNumber)
    }
    for (const d of optimisticWavesDeleted) {
      held.delete(d)
    }
    return [...held].sort((a, b) => a - b)
  }, [optimisticWavesAdded, optimisticWavesDeleted, tableView?.waves])

  const isHeldWaveNumber = useCallback(
    (waveNumber: number) => heldWaveNumbers.includes(waveNumber),
    [heldWaveNumbers]
  )
  const mealProgress = useMemo(() => {
    const serverWaves = tableView?.waves ?? []
    const allItemsWithSeat = [
      ...projectedSeats.flatMap((seat) =>
        seat.items.map((item) => ({ seatNumber: seat.number, item }))
      ),
      ...tableItems.map((item) => ({ seatNumber: 0, item })),
    ]
    const activeItemsWithSeat = allItemsWithSeat.filter(({ item }) => item.status !== "void")

    const hasMealStarted = activeItemsWithSeat.some(({ item }) => item.status !== "held")
    if (!hasMealStarted) {
      return {
        waves: [] as TableDetail["waves"],
        waveItemsById: {} as Record<string, { seatNumber: number; item: TableOrderItem }[]>,
        waveLabelsById: {} as Record<string, string>,
        nextFireableWaveNumber: null as number | null,
      }
    }

    const waveItemsById: Record<string, { seatNumber: number; item: TableOrderItem }[]> = {}
    const waveLabelsById: Record<string, string> = {}
    const serverWaveByNumber = new Map(serverWaves.map((w) => [w.waveNumber, w]))
    const waves: TableDetail["waves"] = waveNumbers.map((waveNumber) => {
      const waveId = `mw-${waveNumber}`
      const itemsForDisplay = allItemsWithSeat.filter(
        ({ item }) => getItemWaveNumber(item) === waveNumber
      )
      const activeItemsForWave = itemsForDisplay.filter(({ item }) => item.status !== "void")
      waveItemsById[waveId] = itemsForDisplay
      waveLabelsById[waveId] = `W${waveNumber}`
      const server = serverWaveByNumber.get(waveNumber)
      const onlyActiveItems = activeItemsForWave.map(({ item }) => item)
      const status = server
        ? (server.status === "sent" ? "fired" : server.status)
        : getMealWaveStatus(onlyActiveItems)
      return {
        id: waveId,
        type: waveNumberToType(waveNumber),
        status,
        items: server?.itemCount ?? onlyActiveItems.length,
      }
    })

    const nextFireableWaveNumber =
      serverWaves.find((wave) => wave.canFire)?.waveNumber ?? null

    return { waves, waveItemsById, waveLabelsById, nextFireableWaveNumber }
  }, [projectedSeats, tableItems, tableView?.waves, waveNumbers])
  const hasMealProgress = mealProgress.waves.length > 0
  useEffect(() => {
    isInteractionOpenRef.current = isInteractionOpen
  }, [isInteractionOpen])

  useEffect(() => {
    if (!effectiveSessionId) return
    const interval = setInterval(() => {
      if (isInteractionOpenRef.current) return
      if (mutationInFlightRef.current > 0) return
      refreshTableView({ silent: true })
    }, 60_000)
    return () => clearInterval(interval)
  }, [effectiveSessionId, refreshTableView])

  const ensureSessionForMutations = useCallback(async (): Promise<string | null> => {
    if (effectiveSessionId && !isOptimisticSessionId(effectiveSessionId)) {
      return effectiveSessionId
    }
    if (!currentLocationId || !id) return null
    const ensureRes = await fetchPos("/api/sessions/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableUuid: id,
        locationId: currentLocationId,
        guestCount: Math.max(1, table.guestCount),
        eventSource: "table_page",
      }),
    }).catch(() => null)
    const ensurePayload = ensureRes ? await ensureRes.json().catch(() => null) : null
    if (!ensureRes?.ok || ensurePayload?.ok === false) {
      posDebugError({
        label: "Failed to ensure session",
        endpoint: "/api/sessions/ensure",
        payload: ensurePayload,
        res: ensureRes,
      })
      return null
    }
    const sid =
      typeof ensurePayload?.data?.sessionId === "string"
        ? ensurePayload.data.sessionId
        : null
    if (!sid) return null

    setTableView((prev) => {
      if (!prev?.openSession) return prev
      const next: TableView = {
        ...prev,
        openSession: { ...prev.openSession, id: sid },
      }
      setTableCache(id, next)
      return next
    })

    return sid
  }, [currentLocationId, effectiveSessionId, id, table.guestCount])

  const resolveOpenSessionIdForClose = useCallback(async (): Promise<string | null> => {
    if (effectiveSessionId && !isOptimisticSessionId(effectiveSessionId)) {
      return effectiveSessionId
    }
    if (!id) return null
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(id)}/pos`, {
        cache: "no-store",
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || payload?.ok === false || !isTableView(payload?.data)) {
        return null
      }
      const sid =
        typeof payload.data.openSession?.id === "string" ? payload.data.openSession.id : null
      if (!sid || isOptimisticSessionId(sid)) return null
      setTableView((prev) => {
        if (!prev?.openSession) return prev
        const next: TableView = {
          ...prev,
          openSession: { ...prev.openSession, id: sid },
        }
        setTableCache(id, next)
        return next
      })
      return sid
    } catch {
      return null
    }
  }, [effectiveSessionId, id])

  // Use real menu from location when available; otherwise placeholder for demo/no-location
  const menuSource = useMemo(() => {
    if (currentLocationId && !menuLoading) {
      return { menuItems: locationMenuItems, categories: locationCategories }
    }
    return { menuItems: takeOrderData.menuItems, categories: takeOrderData.categories }
  }, [currentLocationId, menuLoading, locationMenuItems, locationCategories])

  const orderSeats = useMemo(() => {
    const seats = projectedSeats.map((seat) => {
      const originalsForDisplay = Object.entries(optimisticSeatOps.renamed)
        .filter(([_, to]) => to === seat.number)
        .map(([from]) => Number(from))
      const matchingSeats = [seat.number, ...originalsForDisplay]
      const seatItems = orderItems.filter((item) => matchingSeats.includes(item.seat))
      const total = seatItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const itemCount = seatItems.reduce((sum, item) => sum + item.quantity, 0)
      return {
        number: seat.number,
        dietary: seat.dietary,
        notes: seat.notes,
        items: itemCount,
        total,
      }
    })
    const tableItems = orderItems.filter((item) => item.seat === 0)
    if (tableItems.length > 0) {
      const tableTotal = tableItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const tableCount = tableItems.reduce((sum, item) => sum + item.quantity, 0)
      return [
        {
          number: 0,
          dietary: [],
          notes: [],
          items: tableCount,
          total: tableTotal,
        },
        ...seats,
      ]
    }
    return seats
  }, [orderItems, projectedSeats, optimisticSeatOps.renamed])

  const filteredMenuItems = useMemo(() => {
    let items = menuSource.menuItems

    if (selectedCategory && !searchQuery.trim()) {
      items = items.filter((item) => item.category === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = uniqueById(
        items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            (item.description ?? "").toLowerCase().includes(query)
        )
      )
    }

    return items
  }, [menuSource.menuItems, selectedCategory, searchQuery])
  const matchedCategoryIds = useMemo(
    () => Array.from(new Set(filteredMenuItems.map((item) => item.category))),
    [filteredMenuItems]
  )

  const summaryItems = useMemo(() => {
    if (summaryScope === "seat" && selectedSeat !== null) {
      return orderItems.filter((item) => item.seat === selectedSeat)
    }
    return orderItems
  }, [orderItems, selectedSeat, summaryScope])
  const summarySeats = useMemo(() => {
    if (summaryScope === "seat" && selectedSeat !== null) {
      return orderSeats.filter((seat) => seat.number === selectedSeat)
    }
    return orderSeats
  }, [orderSeats, selectedSeat, summaryScope])
  const summaryTotals = useMemo(() => calculateOrderTotals(summaryItems), [summaryItems])

  useEffect(() => {
    const maxWave = waveNumbers.length > 0 ? Math.max(...waveNumbers) : 1
    setSelectedWaveNumber((prev) => Math.min(Math.max(1, prev), maxWave))
  }, [waveNumbers])

  useEffect(() => {
    const seatNumbers = new Set(projectedSeats.map((s) => s.number))
    setSelectedSeat((prev) => {
      if (prev === null) return null
      return seatNumbers.has(prev) ? prev : null
    })
  }, [projectedSeats])

  const nextSendableWaveNumber = useMemo(() => {
    const allItems = [
      ...projectedSeats.flatMap((seat) => seat.items),
      ...tableItems,
      ...orderItems.map((draft): TableOrderItem => ({
        id: draft.id,
        name: draft.name,
        price: draft.price,
        status: "held" as ItemStatus,
        wave: draft.wave === "drinks" ? "drinks" : "food",
        waveNumber: getDraftItemWaveNumber(draft),
      })),
    ]
    return getNextHeldWaveNumberFromItems(allItems)
  }, [orderItems, projectedSeats, tableItems])
  const hasPendingSend = orderItems.length > 0 || Boolean(tableView?.actions.canSend)
  const canBill = useMemo(() => {
    const seatedItemsTotal = projectedSeats.reduce(
      (sum, seat) =>
        sum +
        seat.items.reduce(
          (seatSum, item) => (item.status !== "void" ? seatSum + item.price : seatSum),
          0
        ),
      0
    )
    const sharedItemsTotal = tableItems.reduce(
      (sum, item) => (item.status !== "void" ? sum + item.price : sum),
      0
    )
    return seatedItemsTotal + sharedItemsTotal > 0
  }, [projectedSeats, tableItems])
  const clearWaveHoldTimer = useCallback(() => {
    if (waveHoldTimerRef.current) {
      clearTimeout(waveHoldTimerRef.current)
      waveHoldTimerRef.current = null
    }
  }, [])

  const clearSeatHoldTimer = useCallback(() => {
    if (seatHoldTimerRef.current) {
      clearTimeout(seatHoldTimerRef.current)
      seatHoldTimerRef.current = null
    }
  }, [])

  const triggerAddContextPulse = useCallback(
    (seatNumber: number, waveNumber: number) => {
      if (addContextPulseTimerRef.current) {
        clearTimeout(addContextPulseTimerRef.current)
      }
      setAddContextPulse({
        id: Date.now(),
        targetLabel: seatNumber === 0 ? `T${table.number}` : `S${seatNumber}`,
        waveLabel: `W${waveNumber}`,
      })
      addContextPulseTimerRef.current = setTimeout(() => {
        setAddContextPulse(null)
      }, 680)
    },
    [table.number]
  )

  const armWaveDeleteByHold = useCallback(
    (waveNumber: number) => {
      clearWaveHoldTimer()
      waveHoldTimerRef.current = setTimeout(() => {
        waveHoldTriggeredRef.current = waveNumber
        setArmedWaveDelete(waveNumber)
      }, 450)
    },
    [clearWaveHoldTimer]
  )

  const armSeatDeleteByHold = useCallback(
    (seatNumber: number) => {
      clearSeatHoldTimer()
      seatHoldTimerRef.current = setTimeout(() => {
        setArmedSeatDelete(seatNumber)
      }, 450)
    },
    [clearSeatHoldTimer]
  )

  const handleDeleteWave = useCallback(
    (waveNumber: number, opts?: { force?: boolean; silent?: boolean }) => {
      const timerId = process.env.NODE_ENV !== "production" ? `[perf] deleteWave ${performance.now()}` : ""
      if (timerId) console.time(timerId)
      if (process.env.NODE_ENV !== "production") {
        const t = performance.now()
        queueMicrotask(() => {
          console.log("[perf] event loop delay", performance.now() - t)
        })
      }
      if (waveDeleteInFlight.has(waveNumber)) {
        if (timerId) console.timeEnd(timerId)
        return
      }
      if (!opts?.force && !tableView?.actions.canDeleteWave) {
        if (timerId) console.timeEnd(timerId)
        setWarningDialog({
          open: true,
          title: "Cannot delete wave",
          description: "Wave deletion is not allowed right now.",
        })
        return
      }
      const label = "Cannot delete wave"
      const endpoint = `/api/sessions/{sid}/waves/${waveNumber}`
      const prevSelected = selectedWaveNumber
      setWaveDeleteInFlight((prev) => {
        const next = new Set(prev).add(waveNumber)
        if (process.env.NODE_ENV !== "production") {
          console.log("[perf] waveDeleteInFlight disabled", { waveNumber, inFlight: [...next] })
        }
        return next
      })
      void fireAndReconcile({
        label,
        endpoint,
        optimisticApply: () => {
          setOptimisticWavesDeleted((prev) => [...prev, waveNumber])
          if (prevSelected === waveNumber) {
            const remaining = waveNumbers.filter((n) => n !== waveNumber)
            setSelectedWaveNumber(remaining.length > 0 ? Math.min(...remaining) : 1)
          }
          setArmedWaveDelete(null)
          if (timerId) console.timeEnd(timerId)
          if (process.env.NODE_ENV !== "production") console.log("[perf] optimistic UI applied", performance.now())
        },
        optimisticRollback: () => {
          setWaveDeleteInFlight((prev) => {
            const next = new Set(prev)
            next.delete(waveNumber)
            if (process.env.NODE_ENV !== "production") {
              console.log("[perf] waveDeleteInFlight enabled", { waveNumber, inFlight: [...next] })
            }
            return next
          })
          setOptimisticWavesDeleted((prev) => prev.filter((n) => n !== waveNumber))
        },
        onSuccessClearOptimistic: () => {
          setWaveDeleteInFlight((prev) => {
            const next = new Set(prev)
            next.delete(waveNumber)
            if (process.env.NODE_ENV !== "production") {
              console.log("[perf] waveDeleteInFlight enabled", { waveNumber, inFlight: [...next] })
            }
            return next
          })
          setOptimisticWavesDeleted((prev) => prev.filter((n) => n !== waveNumber))
        },
        successLabel: "deleteWave",
        onSuccessPatch: (data: { deletedWaveNumber?: number }) => {
          const deleted = data?.deletedWaveNumber ?? waveNumber
          if (pendingAutoDeleteWaveRef.current === deleted) {
            pendingAutoDeleteWaveRef.current = null
          }
          patchTableView((prev) => {
            const waves = prev.waves.filter((w) => w.waveNumber !== deleted)
            const waveCount = waves.length
            return {
              ...prev,
              waves,
              openSession: prev.openSession
                ? { ...prev.openSession, waveCount }
                : null,
              actions: {
                ...prev.actions,
                canDeleteWave: waveCount > 1,
              },
            }
          })
        },
        requestFn: async () => {
          if (process.env.NODE_ENV !== "production") console.time("[perf] deleteWave ensureSession")
          const sid = await ensureSessionForMutations()
          if (process.env.NODE_ENV !== "production") console.timeEnd("[perf] deleteWave ensureSession")
          if (!sid) throw mutationError("Could not open a session for this table.")
          const url = `/api/sessions/${encodeURIComponent(sid)}/waves/${waveNumber}`
          if (process.env.NODE_ENV !== "production") console.time(`[perf] deleteWave DELETE waves/${waveNumber}`)
          const res = await fetchPos(url, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventSource: "table_page" }),
          }).catch(() => null)
          const payload = res ? (await res.json().catch(() => null)) as { ok?: boolean; data?: { deletedWaveNumber?: number }; error?: unknown } | null : null
          if (process.env.NODE_ENV !== "production") console.timeEnd(`[perf] deleteWave DELETE waves/${waveNumber}`)
          if (!res?.ok || payload?.ok === false) {
            if (opts?.silent) {
              throw mutationError("silent")
            }
            throw mutationError(
              toUiErrorMessage(payload?.error, res ? "Could not remove wave. Please try again." : "Network error. Please try again."),
              payload,
              res
            )
          }
          return payload?.data ?? { deletedWaveNumber: waveNumber }
        },
      }).catch(() => {})
    },
    [
      tableView?.actions.canDeleteWave,
      selectedWaveNumber,
      waveNumbers,
      waveDeleteInFlight,
      ensureSessionForMutations,
      fireAndReconcile,
      patchTableView,
    ]
  )

  const ensureNewHeldWaveTarget = useCallback(
    async (reason: "add_items" | "wave_picker" = "add_items") => {
      if (!tableView?.actions.canAddWave && effectiveSessionId) {
        setWarningDialog({
          open: true,
          title: "Cannot add wave",
          description: "Adding a wave is not allowed right now.",
        })
        return null
      }

      // If the backend still provides an empty placeholder Wave 1 (held, 0 items),
      // treat it as "not yet created" and adopt it as the new target instead of creating Wave 2.
      // This keeps first Add Items on a fresh table showing only Wave 1.
      const existingWaves = (tableView?.waves ?? []).filter((w) => !optimisticWavesDeleted.includes(w.waveNumber))
      const hasAnyNonVoidItems = (tableView?.items ?? []).some((i) => i.status !== "void")
      const placeholderW1 =
        existingWaves.length === 1 &&
        existingWaves[0]?.waveNumber === 1 &&
        existingWaves[0]?.status === "held" &&
        (existingWaves[0]?.itemCount ?? 0) === 0 &&
        !hasAnyNonVoidItems
      if (placeholderW1 && reason === "add_items") {
        setSelectedWaveNumber(1)
        setAutoCreatedWaveNumber(1)
        setArmedWaveDelete(null)
        return 1
      }

      const nextWave = waveNumbers.length > 0 ? Math.max(...waveNumbers) + 1 : 1
      const prevSelected = selectedWaveNumber
      const opId = crypto.randomUUID()
      const addEntry = { opId, waveNumber: nextWave }

      setAutoCreatedWaveNumber(nextWave)
      setWaveAddInFlight(true)

      try {
        await fireAndReconcile({
          label: "Failed to add wave",
          endpoint: "/api/sessions/{sid}/waves/next",
          optimisticApply: () => {
            setOptimisticWavesAdded((prev) => [...prev, addEntry])
            setSelectedWaveNumber(nextWave)
            if (reason === "add_items") setArmedWaveDelete(null)
          },
          optimisticRollback: () => {
            setWaveAddInFlight(false)
            setOptimisticWavesAdded((prev) => prev.filter((a) => a.opId !== opId))
            setSelectedWaveNumber(prevSelected)
            setAutoCreatedWaveNumber(null)
          },
          onSuccessClearOptimistic: () => {
            setWaveAddInFlight(false)
            setOptimisticWavesAdded((prev) => prev.filter((a) => a.opId !== opId))
          },
          successLabel: "addWave",
          onSuccessPatch: (data: { waveNumber?: number }) => {
            const waveNum = data?.waveNumber ?? nextWave
            patchTableView((prev) => {
              const newWave = {
                waveNumber: waveNum,
                status: "held" as const,
                itemCount: 0,
                canFire: false,
                canAdvanceToPreparing: false,
                canAdvanceToReady: false,
                canAdvanceToServed: false,
              }
              const waves = [...prev.waves, newWave].sort((a, b) => a.waveNumber - b.waveNumber)
              const waveCount = waves.length
              return {
                ...prev,
                waves,
                openSession: prev.openSession
                  ? { ...prev.openSession, waveCount }
                  : null,
                actions: {
                  ...prev.actions,
                  canDeleteWave: true,
                },
              }
            })
            queueMicrotask(() => {
              const pending = pendingAutoDeleteWaveRef.current
              if (pending == null || pending !== waveNum) return
              handleDeleteWave(pending, { force: true, silent: true })
            })
          },
          requestFn: async () => {
            const sid = await ensureSessionForMutations()
            if (!sid) throw mutationError("Could not open a session for this table.")
            const url = `/api/sessions/${encodeURIComponent(sid)}/waves/next`
            const res = await fetchPos(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventSource: "table_page" }),
            }).catch(() => null)
            const payload = res ? await res.json().catch(() => null) : null
            if (!res?.ok || payload?.ok === false) {
              throw mutationError(
                toUiErrorMessage(
                  (payload as { error?: unknown })?.error,
                  res ? "Could not create wave. Please try again." : "Network error. Please try again."
                ),
                payload,
                res
              )
            }
            const data = (payload as { ok?: boolean; data?: { waveNumber?: number } })?.data
            return data ? { waveNumber: data.waveNumber ?? nextWave } : { waveNumber: nextWave }
          },
        })
      } catch {
        // fireAndReconcile handles UI; rollback already occurred
        return null
      }

      return nextWave
    },
    [
      effectiveSessionId,
      ensureSessionForMutations,
      fireAndReconcile,
      handleDeleteWave,
      patchTableView,
      selectedWaveNumber,
      tableView?.actions.canAddWave,
      waveNumbers,
      optimisticWavesDeleted,
      tableView?.items,
      tableView?.waves,
    ]
  )

  const handleAddWave = useCallback(() => {
    const timerId = process.env.NODE_ENV !== "production" ? `[perf] addWave ${performance.now()}` : ""
    if (timerId) console.time(timerId)
    if (process.env.NODE_ENV !== "production") {
      const t = performance.now()
      queueMicrotask(() => {
        console.log("[perf] event loop delay (addWave)", performance.now() - t)
      })
    }
    if (waveAddInFlight) {
      if (timerId) console.timeEnd(timerId)
      return
    }
    const label = "Failed to add wave"
    const endpoint = "/api/sessions/{sid}/waves/next"
    if (!tableView?.actions.canAddWave) {
      if (timerId) console.timeEnd(timerId)
      setWarningDialog({
        open: true,
        title: label,
        description: "Adding a wave is not allowed right now.",
      })
      return
    }
    const nextWave = waveNumbers.length > 0 ? Math.max(...waveNumbers) + 1 : 1
    const opId = crypto.randomUUID()
    const addEntry = { opId, waveNumber: nextWave }
    setWaveAddInFlight(true)
    if (process.env.NODE_ENV !== "production") console.log("[perf] waveAddInFlight disabled (true)")
    void fireAndReconcile({
      label,
      endpoint,
      optimisticApply: () => {
        setOptimisticWavesAdded((prev) => [...prev, addEntry])
        setSelectedWaveNumber(nextWave)
        if (timerId) console.timeEnd(timerId)
        if (process.env.NODE_ENV !== "production") console.log("[perf] optimistic UI applied", performance.now())
      },
      optimisticRollback: () => {
        setWaveAddInFlight(false)
        if (process.env.NODE_ENV !== "production") console.log("[perf] waveAddInFlight enabled (false)")
        setOptimisticWavesAdded((prev) => prev.filter((a) => a.opId !== opId))
        setSelectedWaveNumber((prev) => Math.max(1, prev - 1))
      },
      onSuccessClearOptimistic: () => {
        setWaveAddInFlight(false)
        if (process.env.NODE_ENV !== "production") console.log("[perf] waveAddInFlight enabled (false)")
        setOptimisticWavesAdded((prev) => prev.filter((a) => a.opId !== opId))
      },
      successLabel: "addWave",
      onSuccessPatch: (data: { waveNumber?: number }) => {
        const waveNum = data?.waveNumber ?? nextWave
        patchTableView((prev) => {
          const newWave = {
            waveNumber: waveNum,
            status: "held" as const,
            itemCount: 0,
            canFire: false,
            canAdvanceToPreparing: false,
            canAdvanceToReady: false,
            canAdvanceToServed: false,
          }
          const waves = [...prev.waves, newWave].sort((a, b) => a.waveNumber - b.waveNumber)
          const waveCount = waves.length
          return {
            ...prev,
            waves,
            openSession: prev.openSession
              ? { ...prev.openSession, waveCount }
              : null,
            actions: {
              ...prev.actions,
              canDeleteWave: true,
            },
          }
        })
      },
      requestFn: async () => {
        if (process.env.NODE_ENV !== "production") console.time("[perf] addWave ensureSession")
        const sid = await ensureSessionForMutations()
        if (process.env.NODE_ENV !== "production") console.timeEnd("[perf] addWave ensureSession")
        if (!sid) throw mutationError("Could not open a session for this table.")
        const url = `/api/sessions/${encodeURIComponent(sid)}/waves/next`
        if (process.env.NODE_ENV !== "production") console.time("[perf] addWave POST waves/next")
        const res = await fetchPos(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventSource: "table_page" }),
        }).catch(() => null)
        const payload = res ? await res.json().catch(() => null) : null
        if (process.env.NODE_ENV !== "production") console.timeEnd("[perf] addWave POST waves/next")
        if (!res?.ok || payload?.ok === false) {
          throw mutationError(
            toUiErrorMessage(
              (payload as { error?: unknown })?.error,
              res ? "Could not create wave. Please try again." : "Network error. Please try again."
            ),
            payload,
            res
          )
        }
        const data = (payload as { ok?: boolean; data?: { waveNumber?: number } })?.data
        return data ? { waveNumber: data.waveNumber ?? nextWave } : { waveNumber: nextWave }
      },
    }).catch(() => {})
  }, [tableView?.actions.canAddWave, waveNumbers, waveAddInFlight, ensureSessionForMutations, fireAndReconcile, patchTableView])

  const handleAddSeat = useCallback(() => {
    const timerId = process.env.NODE_ENV !== "production" ? `[perf] addSeat ${performance.now()}` : ""
    if (timerId) console.time(timerId)
    if (process.env.NODE_ENV !== "production") {
      const t = performance.now()
      queueMicrotask(() => {
        console.log("[perf] event loop delay (addSeat)", performance.now() - t)
      })
    }
    if (seatAddInFlight) {
      if (timerId) console.timeEnd(timerId)
      return
    }
    const label = "Cannot add seat"
    const endpoint = "/api/sessions/{sid}/seats"
    const nextNum = projectedSeats.length > 0 ? Math.max(...projectedSeats.map((s) => s.number)) + 1 : 1
    const opId = crypto.randomUUID()
    const addEntry = { opId, tempSeatNumber: nextNum }
    setSeatAddInFlight(true)
    void fireAndReconcile({
      label,
      endpoint,
      optimisticApply: () => {
        setOptimisticSeatOps((prev) => ({
          ...prev,
          added: [...prev.added, addEntry],
        }))
        setSelectedSeat(nextNum)
        setArmedSeatDelete(null)
        if (timerId) console.timeEnd(timerId)
        if (process.env.NODE_ENV !== "production") console.log("[perf] optimistic UI applied", performance.now())
      },
      optimisticRollback: () => {
        setSeatAddInFlight(false)
        setOptimisticSeatOps((prev) => ({
          ...prev,
          added: prev.added.filter((a) => a.opId !== opId),
        }))
        setSelectedSeat((prev) => (prev === nextNum ? null : prev))
      },
      onSuccessClearOptimistic: () => {
        setSeatAddInFlight(false)
        setOptimisticSeatOps((prev) => ({
          ...prev,
          added: prev.added.filter((a) => a.opId !== opId),
        }))
      },
      successLabel: "addSeat",
      onSuccessPatch: (data: { seatId?: string | null; seatNumber?: number | null }) => {
        const seatId = data?.seatId ?? crypto.randomUUID()
        const num = data?.seatNumber ?? nextNum
        patchTableView((prev) => {
          const seats = [
            ...prev.seats,
            { id: seatId, seatNumber: num, guestName: null as string | null },
          ].sort((a, b) => a.seatNumber - b.seatNumber)
          return { ...prev, seats }
        })
      },
      requestFn: async () => {
        const sid = await ensureSessionForMutations()
        if (!sid) throw mutationError("Could not open a session for this table.")
        const url = `/api/sessions/${encodeURIComponent(sid)}/seats`
        const res = await fetchPos(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventSource: "table_page" }),
        }).catch(() => null)
        const payload = res ? (await res.json().catch(() => null)) as { ok?: boolean; data?: { seatId?: string | null; seatNumber?: number | null }; error?: unknown } | null : null
        if (!res?.ok || payload?.ok === false) {
          throw mutationError(
            toUiErrorMessage(payload?.error, res ? "Could not add seat. Please try again." : "Network error. Please try again."),
            payload,
            res
          )
        }
        return payload?.data ?? { seatId: null, seatNumber: nextNum }
      },
    }).catch(() => {})
  }, [projectedSeats, seatAddInFlight, ensureSessionForMutations, fireAndReconcile, patchTableView])

  const handleDeleteSeat = useCallback(
    (seatNumber: number) => {
      const timerId = process.env.NODE_ENV !== "production" ? `[perf] deleteSeat ${performance.now()}` : ""
      if (timerId) console.time(timerId)
      if (process.env.NODE_ENV !== "production") {
        const t = performance.now()
        queueMicrotask(() => {
          console.log("[perf] event loop delay (deleteSeat)", performance.now() - t)
        })
      }
      if (seatDeleteInFlight.has(seatNumber)) {
        if (timerId) console.timeEnd(timerId)
        return
      }
      if (projectedSeats.length <= 1) {
        if (timerId) console.timeEnd(timerId)
        return
      }
      const hasNonVoidItems =
        tableView?.items.some(
          (item) => item.seatNumber === seatNumber && item.status !== "void"
        ) ?? false
      if (hasNonVoidItems) {
        if (timerId) console.timeEnd(timerId)
        setWarningDialog({
          open: true,
          title: "Cannot delete seat",
          description: `Seat ${seatNumber} has items. Move or remove them first.`,
        })
        return
      }
      const label = "Cannot delete seat"
      const endpoint = `/api/sessions/{sid}/seats/${seatNumber}`
      const prevSelected = selectedSeat
      const remainingAfterDelete = projectedSeats.filter((s) => s.number !== seatNumber)
      const nextSeat = remainingAfterDelete.length > 0 ? Math.min(...remainingAfterDelete.map((s) => s.number)) : null
      setSeatDeleteInFlight((prev) => new Set(prev).add(seatNumber))
      void fireAndReconcile({
        label,
        endpoint,
        optimisticApply: () => {
          setOptimisticSeatOps((prev) => ({
            ...prev,
            deleted: [...prev.deleted, seatNumber],
          }))
          if (prevSelected === seatNumber) setSelectedSeat(nextSeat)
          setArmedSeatDelete(null)
          if (timerId) console.timeEnd(timerId)
          if (process.env.NODE_ENV !== "production") console.log("[perf] optimistic UI applied", performance.now())
        },
        optimisticRollback: () => {
          setSeatDeleteInFlight((prev) => {
            const next = new Set(prev)
            next.delete(seatNumber)
            return next
          })
          setOptimisticSeatOps((prev) => ({
            ...prev,
            deleted: prev.deleted.filter((n) => n !== seatNumber),
          }))
          if (prevSelected === seatNumber) setSelectedSeat(seatNumber)
        },
        onSuccessClearOptimistic: () => {
          setSeatDeleteInFlight((prev) => {
            const next = new Set(prev)
            next.delete(seatNumber)
            return next
          })
          setOptimisticSeatOps((prev) => ({
            ...prev,
            deleted: prev.deleted.filter((n) => n !== seatNumber),
          }))
          setSelectedSeat((prev) => (prev === seatNumber ? nextSeat : prev))
        },
        successLabel: "deleteSeat",
        onSuccessPatch: (data: { deletedSeatNumber?: number }) => {
          const deleted = data?.deletedSeatNumber ?? seatNumber
          patchTableView((prev) => ({
            ...prev,
            seats: prev.seats.filter((s) => s.seatNumber !== deleted),
          }))
        },
        requestFn: async () => {
          const sid = await ensureSessionForMutations()
          if (!sid) throw mutationError("Could not open a session for this table.")
          const url = `/api/sessions/${encodeURIComponent(sid)}/seats/${seatNumber}`
          const res = await fetchPos(url, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventSource: "table_page" }),
          }).catch(() => null)
          const payload = res ? (await res.json().catch(() => null)) as { ok?: boolean; data?: { deletedSeatNumber?: number }; error?: { meta?: { seatNumber?: number } } } | null : null
          if (!res?.ok || payload?.ok === false) {
            if (res?.status === 409 && process.env.NODE_ENV !== "production") {
              const meta = (payload as { error?: { meta?: { seatNumber?: number } } })?.error?.meta
              console.log("[seat delete] 409 CONFLICT from backend", { meta: meta?.seatNumber })
            }
            throw mutationError(
              toUiErrorMessage((payload as { error?: unknown })?.error, res ? "Seat has items." : "Network error. Please try again."),
              payload,
              res
            )
          }
          return payload?.data ?? { deletedSeatNumber: seatNumber }
        },
      }).catch(() => {})
    },
    [projectedSeats, tableView?.items, selectedSeat, seatDeleteInFlight, ensureSessionForMutations, fireAndReconcile, patchTableView]
  )

  const handleRenameSeat = useCallback(
    (seatNumber: number, newSeatNumber: number) => {
      const timerId = process.env.NODE_ENV !== "production" ? `[perf] renameSeat ${performance.now()}` : ""
      if (timerId) console.time(timerId)
      if (process.env.NODE_ENV !== "production") {
        const t = performance.now()
        queueMicrotask(() => {
          console.log("[perf] event loop delay (renameSeat)", performance.now() - t)
        })
      }
      if (seatRenameInFlight.has(seatNumber)) {
        if (timerId) console.timeEnd(timerId)
        return
      }
      if (seatNumber === newSeatNumber) {
        if (timerId) console.timeEnd(timerId)
        return
      }
      const label = "Cannot rename seat"
      const endpoint = `/api/sessions/{sid}/seats/${seatNumber}/rename`
      const prevSelected = selectedSeat
      setSeatRenameInFlight((prev) => new Set(prev).add(seatNumber))
      void fireAndReconcile({
        label,
        endpoint,
        optimisticApply: () => {
          setOptimisticSeatOps((prev) => ({
            ...prev,
            renamed: { ...prev.renamed, [seatNumber]: newSeatNumber },
          }))
          setSeatRenameState(null)
          setArmedSeatDelete(null)
          if (prevSelected === seatNumber) setSelectedSeat(newSeatNumber)
          if (timerId) console.timeEnd(timerId)
          if (process.env.NODE_ENV !== "production") console.log("[perf] optimistic UI applied", performance.now())
        },
        optimisticRollback: () => {
          setSeatRenameInFlight((prev) => {
            const next = new Set(prev)
            next.delete(seatNumber)
            return next
          })
          setOptimisticSeatOps((prev) => {
            const { [seatNumber]: _, ...rest } = prev.renamed
            return { ...prev, renamed: rest }
          })
          if (prevSelected === seatNumber) setSelectedSeat(seatNumber)
        },
        onSuccessClearOptimistic: () => {
          setSeatRenameInFlight((prev) => {
            const next = new Set(prev)
            next.delete(seatNumber)
            return next
          })
          setOptimisticSeatOps((prev) => {
            const { [seatNumber]: _, ...rest } = prev.renamed
            return { ...prev, renamed: rest }
          })
          setSelectedSeat((prev) => (prev === seatNumber ? newSeatNumber : prev))
        },
        successLabel: "renameSeat",
        onSuccessPatch: (data: { from?: number; to?: number }) => {
          const fromNum = data?.from ?? seatNumber
          const toNum = data?.to ?? newSeatNumber
          patchTableView((prev) => ({
            ...prev,
            seats: prev.seats.map((s) =>
              s.seatNumber === fromNum ? { ...s, seatNumber: toNum } : s
            ).sort((a, b) => a.seatNumber - b.seatNumber),
            items: prev.items.map((item) =>
              item.seatNumber === fromNum ? { ...item, seatNumber: toNum } : item
            ),
          }))
        },
        requestFn: async () => {
          const sid = await ensureSessionForMutations()
          if (!sid) throw mutationError("Could not open a session for this table.")
          const url = `/api/sessions/${encodeURIComponent(sid)}/seats/${seatNumber}/rename`
          const res = await fetchPos(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newSeatNumber, eventSource: "table_page" }),
          }).catch(() => null)
          const payload = res ? (await res.json().catch(() => null)) as { ok?: boolean; data?: { from?: number; to?: number }; error?: unknown } | null : null
          if (!res?.ok || payload?.ok === false) {
            throw mutationError(
              toUiErrorMessage(payload?.error, res ? "Seat number already exists." : "Network error. Please try again."),
              payload,
              res
            )
          }
          return payload?.data ?? { from: seatNumber, to: newSeatNumber }
        },
      }).catch(() => {})
    },
    [selectedSeat, seatRenameInFlight, ensureSessionForMutations, fireAndReconcile, patchTableView]
  )

  useEffect(() => {
    setSummaryScope(selectedSeat === null ? "all" : "seat")
  }, [selectedSeat])

  useEffect(() => {
    return () => clearWaveHoldTimer()
  }, [clearWaveHoldTimer])

  useEffect(() => {
    return () => clearSeatHoldTimer()
  }, [clearSeatHoldTimer])

  useEffect(() => {
    return () => {
      if (addContextPulseTimerRef.current) {
        clearTimeout(addContextPulseTimerRef.current)
      }
    }
  }, [])

  const fireWaveNumber = useCallback(
    (waveNumber: number) => {
      const label = "Failed to fire wave"
      const endpoint = `/api/sessions/{sid}/waves/${waveNumber}/fire`
      void fireAndReconcile({
        label,
        endpoint,
        successLabel: "fireWave",
        optimisticApply: () => {
          rollbackSnapshotRef.current = tableView
            ? {
                items: tableView.items.map((i) => ({ ...i })),
                waves: tableView.waves.map((w) => ({ ...w })),
              }
            : null
          patchTableView((prev) => {
            const items = prev.items.map((item) =>
              item.waveNumber === waveNumber && item.status === "held"
                ? { ...item, status: "sent" as const }
                : item
            )
            const waves = prev.waves.map((w) =>
              w.waveNumber === waveNumber ? { ...w, status: "sent" as const } : w
            )
            return { ...prev, items, waves }
          })
        },
        optimisticRollback: () => {
          const snap = rollbackSnapshotRef.current
          if (snap?.items && snap?.waves) {
            patchTableView((prev) => ({ ...prev, items: snap.items!, waves: snap.waves! }))
          }
          rollbackSnapshotRef.current = null
        },
        onSuccessPatch: (data: { waveNumber?: number; status?: string; affectedItemIds?: string[] }) => {
          const wn = data?.waveNumber ?? waveNumber
          const ids = new Set(data?.affectedItemIds ?? [])
          patchTableView((prev) => {
            const items = prev.items.map((item) =>
              (item.waveNumber === wn && item.status === "held") || (ids.has(item.id) && item.status === "held")
                ? { ...item, status: "sent" as const }
                : item
            )
            const waves = prev.waves.map((w) =>
              w.waveNumber === wn ? { ...w, status: "sent" as const } : w
            )
            return { ...prev, items, waves }
          })
        },
        requestFn: async () => {
          const sid = await ensureSessionForMutations()
          if (!sid) throw mutationError("Could not open a session for this table.")
          const res = await fetchPos(`/api/sessions/${encodeURIComponent(sid)}/waves/${waveNumber}/fire`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventSource: "table_page" }),
          }).catch(() => null)
          const payload = res ? (await res.json().catch(() => null)) as { ok?: boolean; data?: { waveNumber?: number; status?: string; affectedItemIds?: string[] }; error?: unknown } | null : null
          if (!res?.ok || payload?.ok === false) {
            throw mutationError(
              toUiErrorMessage(payload?.error, res ? "Server rejected the request. Please try again." : "Network error. Please try again."),
              payload,
              res
            )
          }
          return payload?.data ?? { waveNumber, status: "sent", affectedItemIds: [] }
        },
      }).catch(() => {})
    },
    [tableView, ensureSessionForMutations, fireAndReconcile, patchTableView]
  )

  const handleFireWave = useCallback((waveId: string) => {
    const match = waveId.match(/^mw-(\d+)$/)
    if (!match) return
    const waveNumber = Number(match[1])
    if (!Number.isFinite(waveNumber)) return
    fireWaveNumber(waveNumber)
  }, [fireWaveNumber])

  const handleFireNextWave = useCallback(() => {
    if (!mealProgress.nextFireableWaveNumber) return
    fireWaveNumber(mealProgress.nextFireableWaveNumber)
  }, [fireWaveNumber, mealProgress.nextFireableWaveNumber])

  const resolveOrderIdForItem = useCallback(
    async (itemId: string): Promise<string | null> => {
      const knownOrderId = itemOrderIdsRef.current.get(itemId)
      if (knownOrderId) return knownOrderId
      const fromView = tableView?.items.find((item) => item.id === itemId)?.orderId ?? null
      if (fromView) {
        itemOrderIdsRef.current.set(itemId, fromView)
      }
      return fromView
    },
    [tableView?.items]
  )

  const handleMarkServed = useCallback(
    (itemId: string) => {
      if (!isDbOrderItemId(itemId)) return
      const label = "Failed to mark served"
      const endpoint = `/api/orders/{orderId}/items/${itemId}`
      void fireAndReconcile({
        label,
        endpoint,
        successLabel: "markServed",
        optimisticApply: () => {
          rollbackSnapshotRef.current = tableView
            ? { items: tableView.items.map((i) => ({ ...i })), waves: undefined }
            : null
          patchTableView((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              item.id === itemId ? { ...item, status: "served" as const } : item
            ),
          }))
        },
        optimisticRollback: () => {
          const snap = rollbackSnapshotRef.current
          if (snap?.items) {
            patchTableView((prev) => ({ ...prev, items: snap.items! }))
          }
          rollbackSnapshotRef.current = null
        },
        onSuccessPatch: (data: { itemId?: string; status?: string }) => {
          const id = data?.itemId ?? itemId
          patchTableView((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              item.id === id ? { ...item, status: "served" as const } : item
            ),
          }))
        },
        requestFn: async () => {
          const orderId = await resolveOrderIdForItem(itemId)
          if (!orderId) throw mutationError("Could not resolve order for item.")
          const res = await fetchPos(`/api/orders/${orderId}/items/${itemId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "served", eventSource: "table_page" }),
          }).catch(() => null)
          const payload = res
            ? (await res.json().catch(() => null)) as {
                ok?: boolean
                data?: { itemId?: string; status?: string }
                error?: unknown
              } | null
            : null
          if (!res?.ok || payload?.ok === false) {
            throw mutationError(
              toUiErrorMessage(
                payload?.error,
                res ? "Server rejected the request. Please try again." : "Network error. Please try again."
              ),
              payload,
              res
            )
          }
          return payload?.data ?? { itemId, status: "served" }
        },
      }).catch(() => {})
    },
    [tableView, resolveOrderIdForItem, fireAndReconcile, patchTableView]
  )

  const handleAdvanceWaveStatus = useCallback(
    (waveNumber: number, nextStatus: "cooking" | "ready" | "served") => {
      const dbStatus: "preparing" | "ready" | "served" =
        nextStatus === "cooking" ? "preparing" : nextStatus === "ready" ? "ready" : "served"
      const label = "Failed to advance wave"
      const endpoint = `/api/sessions/{sid}/waves/${waveNumber}/advance`
      const itemStatus = nextStatus
      const waveStatus = nextStatus === "cooking" ? ("preparing" as const) : nextStatus
      void fireAndReconcile({
        label,
        endpoint,
        successLabel: "advanceWave",
        optimisticApply: () => {
          rollbackSnapshotRef.current = tableView
            ? {
                items: tableView.items.map((i) => ({ ...i })),
                waves: tableView.waves.map((w) => ({ ...w })),
              }
            : null
          patchTableView((prev) => {
            const ids = new Set(
              prev.items.filter((i) => i.waveNumber === waveNumber && i.status !== "void").map((i) => i.id)
            )
            const items = prev.items.map((item) =>
              ids.has(item.id) ? { ...item, status: itemStatus as "cooking" | "ready" | "served" } : item
            )
            const waves = prev.waves.map((w) =>
              w.waveNumber === waveNumber ? { ...w, status: waveStatus } : w
            )
            return { ...prev, items, waves }
          })
        },
        optimisticRollback: () => {
          const snap = rollbackSnapshotRef.current
          if (snap?.items && snap?.waves) {
            patchTableView((prev) => ({ ...prev, items: snap.items!, waves: snap.waves! }))
          }
          rollbackSnapshotRef.current = null
        },
        onSuccessPatch: (data: { waveNumber?: number; toStatus?: string; updatedItemIds?: string[] }) => {
          const wn = data?.waveNumber ?? waveNumber
          const toStat = (data?.toStatus ?? dbStatus) as "preparing" | "ready" | "served"
          const itemStat =
            toStat === "preparing" ? ("cooking" as const) : toStat === "ready" ? ("ready" as const) : ("served" as const)
          const waveStat =
            toStat === "preparing" ? ("preparing" as const) : toStat === "ready" ? ("ready" as const) : ("served" as const)
          const ids = new Set(data?.updatedItemIds ?? [])
          patchTableView((prev) => {
            const items = prev.items.map((item) =>
              item.waveNumber === wn && (ids.size === 0 || ids.has(item.id)) && item.status !== "void"
                ? { ...item, status: itemStat }
                : item
            )
            const waves = prev.waves.map((w) =>
              w.waveNumber === wn ? { ...w, status: waveStat } : w
            )
            return { ...prev, items, waves }
          })
        },
        requestFn: async () => {
          const sid = await ensureSessionForMutations()
          if (!sid) throw mutationError("Could not open a session for this table.")
          const response = await fetchPos(`/api/sessions/${encodeURIComponent(sid)}/waves/${waveNumber}/advance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toStatus: dbStatus, eventSource: "table_page" }),
          }).catch(() => null)
          const payload = response
            ? (await response.json().catch(() => null)) as {
                ok?: boolean
                data?: { waveNumber?: number; toStatus?: string; updatedItemIds?: string[] }
                error?: unknown
              } | null
            : null
          if (!response?.ok || payload?.ok === false) {
            throw mutationError(
              toUiErrorMessage(
                payload?.error,
                response ? "Server rejected the request. Please try again." : "Network error. Please try again."
              ),
              payload,
              response
            )
          }
          if (nextStatus === "ready" || nextStatus === "served") {
            fetchPos(`/api/sessions/${encodeURIComponent(sid!)}/events`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: nextStatus === "ready" ? "item_ready" : "served",
                payload: { waveNumber },
                eventSource: "table_page",
              }),
            }).catch(() => null)
          }
          return payload?.data ?? { waveNumber, toStatus: dbStatus, updatedItemIds: [] }
        },
      }).catch(() => {})
    },
    [tableView, ensureSessionForMutations, fireAndReconcile, patchTableView]
  )

  const handleMarkWaveServed = useCallback((waveId: string) => {
    const match = waveId.match(/^mw-(\d+)$/)
    if (!match) return
    const waveNumber = Number(match[1])
    if (!Number.isFinite(waveNumber)) return
    handleAdvanceWaveStatus(waveNumber, "served")
  }, [handleAdvanceWaveStatus])

  const handleVoidItem = useCallback(
    (itemId: string) => {
      if (!isDbOrderItemId(itemId)) return
      const label = "Failed to void item"
      const endpoint = `/api/orders/{orderId}/items/${itemId}`
      void fireAndReconcile({
        label,
        endpoint,
        successLabel: "voidItem",
        optimisticApply: () => {
          rollbackSnapshotRef.current = tableView
            ? { items: tableView.items.map((i) => ({ ...i })), waves: undefined }
            : null
          patchTableView((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              item.id === itemId ? { ...item, status: "void" as const } : item
            ),
          }))
        },
        optimisticRollback: () => {
          const snap = rollbackSnapshotRef.current
          if (snap?.items) {
            patchTableView((prev) => ({ ...prev, items: snap.items! }))
          }
          rollbackSnapshotRef.current = null
        },
        onSuccessPatch: (data: { itemId?: string; status?: string }) => {
          const id = data?.itemId ?? itemId
          patchTableView((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              item.id === id ? { ...item, status: "void" as const } : item
            ),
          }))
        },
        requestFn: async () => {
          const orderId = await resolveOrderIdForItem(itemId)
          if (!orderId) throw mutationError("Could not resolve order for item.")
          const res = await fetchPos(`/api/orders/${orderId}/items/${itemId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: "Voided from table view",
              eventSource: "table_page",
            }),
          }).catch(() => null)
          const payload = res
            ? (await res.json().catch(() => null)) as {
                ok?: boolean
                data?: { itemId?: string; status?: string }
                error?: unknown
              } | null
            : null
          if (!res?.ok || payload?.ok === false) {
            throw mutationError(
              toUiErrorMessage(
                payload?.error,
                res ? "Server rejected the request. Please try again." : "Network error. Please try again."
              ),
              payload,
              res
            )
          }
          return (payload as { data?: { itemId?: string; status?: string } })?.data ?? { itemId, status: "void" }
        },
      }).catch(() => {})
    },
    [tableView, resolveOrderIdForItem, fireAndReconcile, patchTableView]
  )

  const handleEnterOrdering = useCallback((seatNumber: number | null = null) => {
    if (projectedSeats.length === 0) return
    setSelectedSeat(seatNumber)
    setIsOrderingInline(true)
    // Policy: Add Items always targets a NEW held wave by default.
    // Create/select the new wave immediately (optimistically) so users start in the right target.
    void ensureNewHeldWaveTarget("add_items")
  }, [ensureNewHeldWaveTarget, projectedSeats.length])

  const handleQuantityChange = useCallback((itemId: string, delta: number) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    )
  }, [])

  const handleRemoveItem = useCallback((itemId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== itemId))
  }, [])

  const handleExitOrderingView = useCallback((opts?: { draftItems?: TakeOrderItem[] }) => {
    clearWaveHoldTimer()
    clearSeatHoldTimer()
    setArmedWaveDelete(null)
    setArmedSeatDelete(null)
    // Cleanup: if we created a new wave but no items were actually added, delete it.
    if (autoCreatedWaveNumber !== null) {
      const draftItems = opts?.draftItems ?? orderItems
      const draftHasItemsInWave = draftItems.some((d) => getDraftItemWaveNumber(d) === autoCreatedWaveNumber)
      const persistedHasItemsInWave =
        (tableView?.items ?? []).some((i) => i.status !== "void" && i.waveNumber === autoCreatedWaveNumber)
      if (!draftHasItemsInWave && !persistedHasItemsInWave) {
        pendingAutoDeleteWaveRef.current = autoCreatedWaveNumber
        handleDeleteWave(autoCreatedWaveNumber, { force: true, silent: true })
      }
      setAutoCreatedWaveNumber(null)
    }
    setIsOrderingInline(false)
    setSelectedSeat(null)
    setDiscardDraftDialogOpen(false)
  }, [autoCreatedWaveNumber, clearSeatHoldTimer, clearWaveHoldTimer, handleDeleteWave, orderItems, tableView?.items])

  const handleSendCurrentOrder = useCallback(async () => {
    if (orderItems.length === 0 && !nextSendableWaveNumber) return
    if (addItemsInFlightRef.current) return

    const newDrafts = orderItems.filter((d) => !d.id || !isDbOrderItemId(d.id))
    const draftWaveNumbers = newDrafts
      .flatMap((draft) => Array.from({ length: Math.max(1, draft.quantity) }, () => getDraftItemWaveNumber(draft)))
      .filter((wave): wave is number => Number.isFinite(wave) && wave > 0)
    const waveToSend = draftWaveNumbers.includes(1) ? 1 : null

    if (newDrafts.length === 0) {
      setOrderItems([])
      handleExitOrderingView()
      if (waveToSend !== null) await fireWaveNumber(waveToSend)
      return
    }

    const sid = await ensureSessionForMutations()
    if (!sid || !currentLocationId) {
      throw mutationError("Could not open a session for this table.")
    }

    const draftsSnapshot = [...newDrafts]
    const tempIds: string[] = []
    for (const draft of newDrafts) {
      for (let i = 0; i < Math.max(1, draft.quantity); i += 1) {
        tempIds.push(`temp-${draft.id}-${i}`)
      }
    }

    const idempotencyKey = makeIdempotencyKey()
    const addInputs: Array<{ itemId: string; quantity: number; seatId?: string; notes?: string; waveNumber: number }> = []
    for (const draft of newDrafts) {
      const waveNumber = getDraftItemWaveNumber(draft)
      const visibleNotes = (draft.notes ?? "")
        .replace(/\bWave\s+\d+\b/gi, "")
        .replace(/[·|,-]\s*$/g, "")
        .replace(/^\s*[·|,-]\s*/g, "")
        .trim()
      const mods = [
        `Wave ${waveNumber}`,
        ...Object.values(draft.options ?? {}),
        ...(draft.extras ?? []).map((e) => `+ ${e}`),
        ...(visibleNotes ? [visibleNotes] : []),
      ]
      const notesStr = mods.filter(Boolean).join(" · ")
      const seatId = draft.seat > 0 ? seatIdByNumberRef.current.get(draft.seat) : undefined
      for (let i = 0; i < Math.max(1, draft.quantity); i += 1) {
        addInputs.push({
          itemId: draft.menuItemId,
          quantity: 1,
          seatId,
          notes: notesStr || undefined,
          waveNumber,
        })
      }
    }

    const tempItems: Array<{
      id: string
      orderId: string
      menuItemId: string | null
      name: string
      price: number
      quantity: number
      status: "held"
      seatNumber: number
      waveNumber: number
      notes: string | null
    }> = []
    let idx = 0
    for (const draft of newDrafts) {
      const waveNumber = getDraftItemWaveNumber(draft)
      for (let i = 0; i < Math.max(1, draft.quantity); i += 1) {
        tempItems.push({
          id: tempIds[idx],
          orderId: "temp",
          menuItemId: draft.menuItemId,
          name: draft.name,
          price: draft.price,
          quantity: 1,
          status: "held",
          seatNumber: draft.seat,
          waveNumber,
          notes: draft.notes ?? null,
        })
        idx += 1
      }
    }

    addItemsInFlightRef.current = true
    void fireAndReconcile({
      label: "Failed to add items",
      endpoint: "/api/orders",
      successLabel: "sendOrder",
      optimisticApply: () => {
        if (waveToSend !== 1) sendRollbackWavesRef.current = null
        else if (tableView?.waves) sendRollbackWavesRef.current = tableView.waves.map((w) => ({ ...w }))
        patchTableView((prev) => {
          let next = { ...prev, items: [...prev.items, ...tempItems] }
          if (waveToSend === 1) {
            next = {
              ...next,
              items: next.items.map((item) =>
                item.waveNumber === 1 && tempIds.includes(item.id)
                  ? { ...item, status: "sent" as const }
                  : item
              ),
              waves: next.waves.map((w) =>
                w.waveNumber === 1 ? { ...w, status: "sent" as const } : w
              ),
            }
          }
          return next
        })
        setOrderItems((prev) => prev.filter((d) => d.id && isDbOrderItemId(d.id)))
        handleExitOrderingView()
        if (process.env.NODE_ENV !== "production") console.log("[perf] optimistic UI applied", performance.now())
      },
      optimisticRollback: () => {
        patchTableView((prev) => {
          const withoutTemps = { ...prev, items: prev.items.filter((i) => !tempIds.includes(i.id)) }
          const snap = sendRollbackWavesRef.current
          if (snap?.length) {
            sendRollbackWavesRef.current = null
            return { ...withoutTemps, waves: snap }
          }
          return withoutTemps
        })
        setOrderItems((prev) => {
          const withoutNew = prev.filter((d) => d.id && isDbOrderItemId(d.id))
          return [...withoutNew, ...draftsSnapshot]
        })
      },
      onSuccessClearOptimistic: () => {},
      onSuccessPatch: (
        result: {
          addedItems?: Array<{
            id: string
            orderId: string
            menuItemId: string | null
            name: string
            price: number
            quantity: number
            status: string
            seatNumber: number
            waveNumber: number
            notes: string | null
          }>
          affectedWaveNumbers?: number[]
          autoFiredWave?: number
        }
      ) => {
        const rawAdded = result.addedItems ?? []
        const addedItems = rawAdded.map((i) => ({ ...i, status: i.status as TableViewItemStatus }))
        const autoFiredWave = result.autoFiredWave
        patchTableView((prev) => {
          const withoutTemps = prev.items.filter((i) => !i.id.startsWith("temp-"))
          let items: TableView["items"] = [...withoutTemps, ...addedItems]
          if (typeof autoFiredWave === "number") {
            items = items.map((item) =>
              item.waveNumber === autoFiredWave && item.status === "held"
                ? { ...item, status: "sent" as const }
                : item
            )
          }
          const waves =
            typeof autoFiredWave === "number"
              ? prev.waves.map((w) =>
                  w.waveNumber === autoFiredWave ? { ...w, status: "sent" as const } : w
                )
              : prev.waves
          return { ...prev, items, waves }
        })
      },
      requestFn: async () => {
        try {
          const response = await fetchPos("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              locationId: currentLocationId,
              sessionId: sid,
              orderType: "dine_in",
              paymentTiming: "pay_later",
              guestCount: Math.max(1, table.guestCount ?? 0),
              eventSource: "table_page",
              autoFireWave1: waveToSend === 1,
              items: addInputs.map((input) => ({
                itemId: input.itemId,
                quantity: input.quantity,
                seatId: input.seatId,
                notes: input.notes ?? null,
                waveNumber: input.waveNumber,
              })),
            }),
          }, { idempotencyKey }).catch(() => null)
          const payload = response ? (await response.json().catch(() => null)) : null
          if (!response?.ok || payload?.ok === false || !payload?.data) {
            throw mutationError(
              toUiErrorMessage(payload?.error, response ? "Unable to add items. Please try again." : "Network error. Please try again."),
              payload,
              response
            )
          }
          return payload.data as {
            orderId: string
            addedItems: Array<{
              id: string
              orderId: string
              menuItemId: string | null
              name: string
              price: number
              quantity: number
              status: string
              seatNumber: number
              waveNumber: number
              notes: string | null
            }>
            affectedWaveNumbers?: number[]
            autoFiredWave?: number
          }
        } finally {
          addItemsInFlightRef.current = false
        }
      },
    }).catch(() => {
      addItemsInFlightRef.current = false
    })
  }, [
    currentLocationId,
    ensureSessionForMutations,
    fireWaveNumber,
    handleExitOrderingView,
    nextSendableWaveNumber,
    orderItems,
    table.guestCount,
    tableView,
    fireAndReconcile,
    patchTableView,
  ])

  const handleCloseTable = useCallback(
    async (
      arg?: { force?: boolean } | { mode: string; method: string; subtotal: number; tip: number; total: number; charges: Array<{ label: string; amount: number }> }
    ) => {
      const isForceClose = arg != null && !("total" in arg) && arg.force === true
      const isPaymentSummary = arg != null && "total" in arg

      type CloseResult = {
        ok: boolean
        reason?: string
        error?: unknown
        items?: Array<{ id: string; itemName: string; status: string; quantity: number }>
        remaining?: number
        sessionTotal?: number
        paymentsTotal?: number
        correlationId?: string
      }

      const formatCloseError = (closeResult: CloseResult): string => {
        const fallbackReason = toUiErrorMessage(closeResult.error, "")
        const reason =
          closeResult.reason ??
          (fallbackReason === "unfinished_items" ||
          fallbackReason === "unpaid_balance" ||
          fallbackReason === "invalid_tip" ||
          fallbackReason === "payment_in_progress" ||
          fallbackReason === "kitchen_mid_fire" ||
          fallbackReason === "session_not_open"
            ? fallbackReason
            : undefined)
        if (reason === "unfinished_items") {
          return typeof closeResult.items?.length === "number"
            ? `Cannot close: ${closeResult.items.length} item(s) still pending, preparing, or ready. Finish or void them first.`
            : "Cannot close: items are still pending, preparing, or ready. Finish or void them first."
        }
        if (reason === "unpaid_balance") {
          return `Cannot close: ${formatMoney(closeResult.remaining ?? 0)} unpaid. Session total: ${formatMoney(closeResult.sessionTotal ?? 0)}, payments: ${formatMoney(closeResult.paymentsTotal ?? 0)}.`
        }
        if (reason === "invalid_tip") return "Tip amount must be >= 0."
        if (reason === "payment_in_progress") return "Cannot close: a payment is in progress."
        if (reason === "kitchen_mid_fire") {
          return "Cannot close: items sent to kitchen but not yet started."
        }
        if (reason === "session_not_open") return "Session is not open."
        return toUiErrorMessage(closeResult.error, "Cannot close table.")
      }

      const requestCloseSession = async (
        sid: string,
        payment: { amount: number; tipAmount: number; method: "card" | "cash" | "mobile" | "other" },
        options?: { force?: boolean }
      ): Promise<CloseResult> => {
        const idempotencyKey = makeIdempotencyKey()
        return fetchPos(`/api/sessions/${sid}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment,
            options,
            eventSource: "table_page",
          }),
        }, { idempotencyKey })
          .then(async (response) => {
            const payload = await response.json().catch(() => null)
            if (payload && typeof payload === "object") {
              return payload as CloseResult
            }
            return {
              ok: false,
              reason: response.ok ? "unknown_error" : "request_failed",
              error: response.ok ? "Unknown response" : response.statusText,
            } satisfies CloseResult
          })
          .catch(() => ({ ok: false, reason: "network_error", error: "Network request failed" }) satisfies CloseResult)
      }

      const sid = await resolveOpenSessionIdForClose()
      if (!sid || !tableView) {
        toast.error("No open session to close.")
        return
      }
      if (!currentLocationId) {
        toast.error("No location selected.")
        return
      }

      const payment = isPaymentSummary
        ? {
            amount: (arg as { total: number }).total,
            tipAmount: (arg as { tip: number }).tip ?? 0,
            method: ((arg as { method: string }).method ?? "other") as
              | "card"
              | "cash"
              | "mobile"
              | "other",
          }
        : {
            amount: table.bill?.total ?? 0,
            tipAmount: 0,
            method: "other" as const,
          }

      const closeOptions = isForceClose ? { force: true } : undefined
      const successMessage = isForceClose ? "Table force closed" : "Table closed"

      setCloseInFlight(true)
      try {
        const closeResult = await requestCloseSession(sid, payment, closeOptions)
        if (!closeResult.ok) {
          toast.error(formatCloseError(closeResult))
          return
        }

        const optimisticTableView = buildOptimisticForceClosedTableView(tableView)
        applyTableView(optimisticTableView)
        setTableCache(id, optimisticTableView)

        if (activeStoreTable?.orderId) {
          closeOrder(activeStoreTable.orderId, table.bill)
        }

        const floorPlanId = table.floorPlanId
        const cachedFloorMap = getFloorMapCache(currentLocationId, floorPlanId)
        if (cachedFloorMap) {
          setFloorMapCache(
            currentLocationId,
            floorPlanId,
            patchFloorMapViewTableCleaning(cachedFloorMap, id)
          )
        }

        if (isPaymentSummary) {
          setPaymentOpen(false)
        }

        fireAndForget(
          fetchPos(`/api/sessions/${encodeURIComponent(sid)}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "payment_completed",
              eventSource: "table_page",
            }),
          }),
          "record payment_completed event"
        )

        invalidateTableCache(id)
        invalidateFloorMapCache(currentLocationId)

        const destination = floorMapPath(table.floorPlanId)
        toast.success(successMessage)
        startTransition(() => {
          router.push(destination)
        })
      } catch (error) {
        const normalized = isPosMutationError(error)
          ? error
          : mutationError(toUiErrorMessage(error, "Failed to close table."))
        toast.error(normalized.message)
      } finally {
        setCloseInFlight(false)
      }
    },
    [
      activeStoreTable,
      applyTableView,
      closeOrder,
      currentLocationId,
      formatMoney,
      id,
      resolveOpenSessionIdForClose,
      router,
      table.bill,
      table.floorPlanId,
      tableView,
    ]
  )

  const handlePaymentComplete = handleCloseTable

  const handleAddToOrder = useCallback((customization: ItemCustomization) => {
    const menuItem = menuSource.menuItems.find((m) => m.id === customization.menuItemId)
    const draftId = editingOrderItemId ?? `to-${Date.now()}`
    const newOrderItem: TakeOrderItem = {
      id: draftId,
      menuItemId: customization.menuItemId,
      name: customization.name,
      seat: customization.seat,
      quantity: customization.quantity,
      options: customization.options,
      extras: customization.extras,
      notes: [customization.notes, `Wave ${customization.waveNumber}`].filter(Boolean).join(" · "),
      price: customization.totalPrice,
      wave: menuItem?.category === "drinks" ? "drinks" : "food",
    }
    if (editingOrderItemId) {
      setOrderItems((prev) =>
        prev.map((item) => (item.id === editingOrderItemId ? newOrderItem : item))
      )
    } else {
      setOrderItems((prev) => [...prev, newOrderItem])
    }
    triggerAddContextPulse(customization.seat, customization.waveNumber)
    setCustomizingItem(null)
    setCustomizeDefaults(null)
    setEditingOrderItemId(null)
  }, [editingOrderItemId, triggerAddContextPulse])

  const handleQuickAddMenuItem = useCallback((item: MenuItem) => {
    const seatNumber = selectedSeatNumber ?? 0
    if (!isHeldWaveNumber(selectedWaveNumber)) {
      // Safety: never add into locked waves.
      void ensureNewHeldWaveTarget("add_items")
      return
    }
    const selectedOptions = getAutoSelectedOptions(item)
    const optionUpcharge = getAutoOptionUpcharge(item, selectedOptions)
    const unitPrice = item.price + optionUpcharge

    const newOrderItem: TakeOrderItem = {
      id: `to-${Date.now()}`,
      menuItemId: item.id,
      name: item.name,
      seat: seatNumber,
      quantity: 1,
      options: selectedOptions,
      extras: [],
      notes: `Wave ${selectedWaveNumber}`,
      price: unitPrice,
      wave: item.category === "drinks" ? "drinks" : "food",
    }

    setOrderItems((prev) => [...prev, newOrderItem])
    triggerAddContextPulse(seatNumber, selectedWaveNumber)
  }, [ensureNewHeldWaveTarget, isHeldWaveNumber, selectedSeatNumber, selectedWaveNumber, triggerAddContextPulse])

  const handleSeated = useCallback(
    async (formData: import("@/lib/floor-map-data").SeatPartyForm) => {
      if (!currentLocationId) {
        setWarningDialog({
          open: true,
          title: "Failed to seat party",
          description: "No location selected.",
        });
        return false;
      }
      if (!tableView) {
        toast.error("Table data is still loading. Please try again.");
        return false;
      }

      const partySize = formData.partySize;
      const snapshot = structuredClone(tableView);
      const optimistic = buildOptimisticSeatedTableView(tableView, partySize);

      applyTableView(optimistic);
      setTableCache(id, optimistic);
      openOrderForTable(activeStoreTable?.id ?? id, partySize);
      setSeatPartyOpen(false);
      setIsOrderingInline(false);
      setArmedWaveDelete(null);
      setArmedSeatDelete(null);
      setOrderItems([]);

      void (async () => {
        try {
          const res = await fetchPos("/api/sessions/ensure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tableUuid: id,
              locationId: currentLocationId,
              guestCount: partySize,
              eventSource: "table_page",
            }),
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok || payload?.ok === false) {
            throw mutationError(
              toUiErrorMessage(
                payload?.error,
                "Could not create session. Please try again."
              ),
              payload,
              res
            );
          }
          const sid =
            typeof payload?.data?.sessionId === "string" ? payload.data.sessionId : null;
          if (!sid) {
            throw mutationError("Could not create session. Please try again.", payload, res);
          }
          setTableView((prev) => {
            if (!prev) return prev
            const next: TableView = {
              ...prev,
              openSession: prev.openSession
                ? { ...prev.openSession, id: sid }
                : {
                    id: sid,
                    status: "open",
                    guestCount: partySize,
                    openedAt: new Date().toISOString(),
                    waveCount: 1,
                  },
            }
            setTableCache(id, next)
            return next
          })
          fireAndForget(
            fetchPos(`/api/sessions/${encodeURIComponent(sid)}/events`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "guest_seated",
                payload: { guestCount: partySize },
                eventSource: "table_page",
              }),
            }),
            "record guest_seated event"
          );
          invalidatePostSeatingCaches(currentLocationId, id);
          toast.success(`Party of ${partySize} seated`);
          void refreshTableView({ silent: true });
        } catch (error) {
          applyTableView(snapshot);
          setTableCache(id, snapshot);
          const normalized = isPosMutationError(error)
            ? error
            : mutationError(
                toUiErrorMessage(error, "Failed to seat party. Please try again.")
              );
          toast.error(normalized.message);
        }
      })();

      return true;
    },
    [
      activeStoreTable?.id,
      applyTableView,
      currentLocationId,
      id,
      openOrderForTable,
      refreshTableView,
      tableView,
    ]
  );

  const handleAcknowledgeService = useCallback(
    async (requestType: "waiter" | "bill") => {
      if (waiterAckInFlight) return;

      const snapshot = tableView;
      setWaiterAckInFlight(true);
      setTableView((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          table: {
            ...prev.table,
            alerts:
              requestType === "waiter"
                ? (prev.table.alerts ?? []).filter((alert) => alert !== "waiting")
                : prev.table.alerts,
            stage: requestType === "bill" ? null : prev.table.stage,
          },
        };
      });

      try {
        const res = await fetchPos(`/api/tables/${encodeURIComponent(id)}/acknowledge-service`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestType }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload?.ok !== true) {
          setTableView(snapshot);
          const msg =
            (payload?.error &&
              typeof payload.error === "object" &&
              (payload.error as { message?: string }).message) ||
            (typeof payload?.error === "string" ? payload.error : null);
          toast.error(
            msg ??
              (requestType === "bill"
                ? "Failed to mark bill request handled"
                : "Failed to mark waiter request handled"),
          );
          return;
        }

        const locationId = currentLocationId ?? tableView?.table.locationId ?? null;
        if (locationId) invalidateFloorMapCache(locationId);

        const alreadyHandled = Boolean(
          (payload.data as { alreadyHandled?: boolean } | undefined)?.alreadyHandled,
        );
        if (requestType === "bill") {
          toast.success(alreadyHandled ? "Bill request already handled" : "Bill request handled");
        } else {
          toast.success(
            alreadyHandled ? "Waiter request already handled" : "Waiter request handled",
          );
        }
        void refreshTableView({ silent: true });
      } catch {
        setTableView(snapshot);
        toast.error(
          requestType === "bill"
            ? "Failed to mark bill request handled"
            : "Failed to mark waiter request handled",
        );
      } finally {
        setWaiterAckInFlight(false);
      }
    },
    [currentLocationId, id, refreshTableView, tableView, waiterAckInFlight],
  );

  const handleAcknowledgeWaiter = useCallback(async () => {
    await handleAcknowledgeService("waiter");
  }, [handleAcknowledgeService]);

  const handleAcknowledgeBill = useCallback(async () => {
    await handleAcknowledgeService("bill");
  }, [handleAcknowledgeService]);

  if (tableView === null && !tableViewError) {
    return <TablePageSkeleton />
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background pb-14 animate-[fade-in_0.15s_ease-out]">
      {/* Top Bar */}
      <TopBar
        table={table}
        onToggleInfo={() => setInfoOpen((v) => !v)}
        onCloseTable={handleCloseTable}
        closePendingLabel={closeInFlight ? "Closing table…" : null}
      />

      {tableViewError && (
        <div className="mx-3 mt-2 flex items-center justify-between rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200 md:mx-4">
          <span>{tableViewError}</span>
          <Button size="sm" variant="outline" onClick={() => { void refreshTableView() }}>
            Retry
          </Button>
        </div>
      )}
      {tableView !== null && tableViewLoading && (
        <div className="mx-3 mt-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:mx-4">
          Loading table...
        </div>
      )}

      {/* Food Ready Alert */}
      {showAlert && (
        <FoodReadyAlert
          seats={projectedSeats}
          onDismiss={() => setAlertDismissed(true)}
          onAcknowledge={() => setAlertDismissed(true)}
        />
      )}

      {/* Kitchen Delay Alert */}
      {kitchenDelays && kitchenDelays.length > 0 && !kitchenDelayDismissed && (
        <KitchenDelayAlert
          items={kitchenDelays}
          onDismiss={() => setKitchenDelayDismissed(true)}
        />
      )}

      {/* Guest bill request */}
      {showBillRequest && (
        <BillRequestAlert
          onAcknowledge={() => {
            void handleAcknowledgeBill();
          }}
          pending={waiterAckInFlight}
        />
      )}

      {/* Guest waiter request */}
      {showWaiterRequest && (
        <WaiterRequestAlert
          onAcknowledge={() => {
            void handleAcknowledgeWaiter();
          }}
          pending={waiterAckInFlight}
        />
      )}

      {/* Main content area - responsive grid */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* CENTER: Main content */}
          <main className="flex flex-1 flex-col overflow-y-auto">
            {/* Mobile: Table Visual */}
            <div className="shrink-0 border-b border-border bg-card md:hidden">
              <div className="p-3">
                <TableVisual
                  tableNumber={table.number}
                  capacity={table.capacity}
                  seats={projectedSeats}
                  selectedSeat={selectedSeat}
                  onSelectSeat={setSelectedSeat}
                  status={table.status}
                  onAddItemsForSeat={handleEnterOrdering}
                  waiterRequested={showWaiterRequest}
                  onAcknowledgeWaiter={() => {
                    void handleAcknowledgeWaiter()
                  }}
                  waiterAckPending={waiterAckInFlight}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {uiMode === "blocked" ? (
                /* Blocked (furniture maintenance/disabled) */
                <div className="flex h-full flex-col items-center justify-center gap-4 p-3 md:p-4 lg:p-5">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                      <AlertTriangle className="h-8 w-8 text-amber-500" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-foreground">Table Unavailable</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {furnitureStatus === "maintenance"
                          ? "This table is under maintenance."
                          : "This table is disabled."}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => router.push(floorMapPath(table.floorPlanId))}
                    className="gap-2"
                  >
                    Back to floor map
                  </Button>
                </div>
              ) : uiMode === "needs_seating" ? (
                /* Seat Party CTA */
                <div className="flex h-full flex-col items-center justify-center gap-4 p-3 md:p-4 lg:p-5">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-foreground">Table is Active</h3>
                      <p className="text-sm text-muted-foreground mt-1">Ready to seat a new party</p>
                    </div>
                  </div>
                  <Button 
                    data-testid="table-seat-party-open"
                    size="lg" 
                    onClick={() => setSeatPartyOpen(true)}
                    className="gap-2 bg-primary/90 hover:bg-primary text-primary-foreground mt-2"
                  >
                    <Users className="h-4 w-4" />
                    Seat Party Here
                  </Button>
                </div>
              ) : isOrderingInline ? (
                <div className="relative flex h-full flex-col overflow-hidden">
                  <div className="relative z-20 border-b border-border bg-card px-3 py-2 md:px-4 overflow-visible">
                    <div className="flex min-w-0 items-center gap-3 overflow-visible">
                      <div className="min-w-0 flex-1">
                        <MenuSearch
                          value={searchQuery}
                          onChange={setSearchQuery}
                          inputClassName="h-7 text-xs"
                        />
                      </div>

                      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                        <div className="flex min-w-0 items-center gap-2">
                        <span className="pointer-events-none relative -z-10 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Wave
                        </span>
                        <div className="relative z-30 -mx-2 my-[-8px] flex min-w-0 max-w-[min(36vw,22rem)] items-center gap-1 overflow-x-auto scrollbar-none px-2 py-2">
                          {waveNumbers.map((waveNumber) => (
                            (() => {
                              const isHeld = isHeldWaveNumber(waveNumber)
                              const locked = !isHeld
                              return (
                            <div key={waveNumber} className="relative flex shrink-0 items-center">
                              <button
                                type="button"
                                disabled={locked}
                                onClick={() => {
                                  if (waveHoldTriggeredRef.current === waveNumber) {
                                    waveHoldTriggeredRef.current = null
                                    return
                                  }
                                  if (!isHeld) return
                                  if (selectedWaveNumber === waveNumber) {
                                    setArmedWaveDelete((prev) =>
                                      prev === waveNumber ? null : waveNumber
                                    )
                                  } else {
                                    setSelectedWaveNumber(waveNumber)
                                    setArmedWaveDelete(null)
                                  }
                                }}
                                onPointerDown={() => armWaveDeleteByHold(waveNumber)}
                                onPointerUp={() => {
                                  clearWaveHoldTimer()
                                  setTimeout(() => {
                                    if (waveHoldTriggeredRef.current === waveNumber) {
                                      waveHoldTriggeredRef.current = null
                                    }
                                  }, 0)
                                }}
                                onPointerLeave={clearWaveHoldTimer}
                                onPointerCancel={clearWaveHoldTimer}
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  if (!isHeld) return
                                  setArmedWaveDelete(waveNumber)
                                }}
                                className={`h-7 shrink-0 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
                                  selectedWaveNumber === waveNumber
                                    ? "relative z-40 border-amber-400 bg-amber-500/15 text-amber-200 animate-selected-chip [--chip-glow:rgba(251,191,36,0.5)]"
                                    : locked
                                      ? "border-border/50 bg-background/30 text-muted-foreground/40 cursor-not-allowed"
                                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                                }`}
                                aria-label={`Wave ${waveNumber}`}
                                title={locked ? "Wave is locked (not editable)" : "Hold to reveal delete"}
                              >
                                W{waveNumber}
                              </button>
                              {armedWaveDelete === waveNumber && waveNumbers.length > 1 && (
                                <button
                                  type="button"
                                  disabled={waveDeleteInFlight.has(waveNumber)}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteWave(waveNumber)
                                  }}
                                  className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label={`Delete wave ${waveNumber}`}
                                  title={`Delete Wave ${waveNumber}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                              )
                            })()
                          ))}
                          <button
                            type="button"
                            disabled={waveAddInFlight}
                            onClick={() => {
                              void ensureNewHeldWaveTarget("wave_picker")
                            }}
                            className="relative z-50 h-7 shrink-0 rounded-md border border-border bg-background px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                            aria-label="Add wave"
                            title="Add wave"
                          >
                            +
                          </button>
                        </div>
                        </div>

                        <div className="h-5 w-px shrink-0 bg-border/60" />

                        <div className="flex min-w-0 items-center gap-2">
                          <span className="pointer-events-none relative -z-10 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Seats
                          </span>
                          <div className="relative z-30 -mx-2 my-[-8px] flex min-w-0 max-w-[min(42vw,26rem)] items-center gap-1 overflow-x-auto scrollbar-none px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setSelectedSeat(null)}
                              className={`h-7 shrink-0 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
                                selectedSeat === null
                                  ? "relative z-40 border-primary bg-primary text-primary-foreground animate-selected-chip [--chip-glow:rgba(56,189,248,0.5)]"
                                  : "border-border bg-background text-muted-foreground hover:bg-accent"
                              }`}
                              aria-label={`Table ${table.number}`}
                            >
                              T-{table.number}
                            </button>
                            {projectedSeats.map((seat) => (
                              <div key={seat.number} className="relative flex shrink-0 items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSeat(seat.number)
                                    if (armedSeatDelete !== seat.number) setArmedSeatDelete(null)
                                  }}
                                  onPointerDown={() => armSeatDeleteByHold(seat.number)}
                                  onPointerUp={clearSeatHoldTimer}
                                  onPointerLeave={clearSeatHoldTimer}
                                  onPointerCancel={clearSeatHoldTimer}
                                  onContextMenu={(e) => {
                                    e.preventDefault()
                                    setArmedSeatDelete(seat.number)
                                  }}
                                  className={`h-7 shrink-0 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
                                    selectedSeatNumber === seat.number
                                      ? "relative z-40 border-primary bg-primary text-primary-foreground animate-selected-chip [--chip-glow:rgba(56,189,248,0.5)]"
                                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                                  }`}
                                  aria-label={`Seat ${seat.number}`}
                                  title="Hold to reveal delete"
                                >
                                  S{seat.number}
                                </button>
                                {armedSeatDelete === seat.number && projectedSeats.length > 1 && (
                                  <div className="ml-1 flex items-center gap-0.5">
                                    {seatRenameState?.seatNumber === seat.number ? (
                                      <>
                                        <input
                                          type="number"
                                          min={1}
                                          max={99}
                                          value={seatRenameState.input}
                                          onChange={(e) =>
                                            setSeatRenameState((s) =>
                                              s ? { ...s, input: e.target.value } : s
                                            )
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              const n = parseInt(
                                                seatRenameState.input,
                                                10
                                              )
                                              if (
                                                Number.isFinite(n) &&
                                                n >= 1 &&
                                                n !== seat.number
                                              ) {
                                                handleRenameSeat(seat.number, n)
                                              }
                                            }
                                            if (e.key === "Escape") {
                                              setSeatRenameState(null)
                                              setArmedSeatDelete(null)
                                            }
                                          }}
                                          className="h-7 w-12 rounded-md border border-border bg-background px-1.5 text-center text-[11px] font-semibold tabular-nums"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          disabled={seatRenameInFlight.has(seat.number)}
                                          onClick={() => {
                                            const n = parseInt(
                                              seatRenameState.input,
                                              10
                                            )
                                            if (
                                              Number.isFinite(n) &&
                                              n >= 1 &&
                                              n !== seat.number
                                            ) {
                                              handleRenameSeat(seat.number, n)
                                            }
                                          }}
                                          className="h-7 px-1.5 text-[10px] font-semibold text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          OK
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSeatRenameState(null)
                                            setArmedSeatDelete(null)
                                          }}
                                          className="h-7 px-1 text-[10px] font-semibold text-muted-foreground"
                                        >
                                          ×
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          disabled={seatRenameInFlight.has(seat.number)}
                                          onClick={() =>
                                            setSeatRenameState({
                                              seatNumber: seat.number,
                                              input: String(seat.number),
                                            })
                                          }
                                          className="h-7 px-1.5 text-[10px] font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                          title={`Rename seat ${seat.number}`}
                                        >
                                          Rename
                                        </button>
                                        <button
                                          type="button"
                                          disabled={seatDeleteInFlight.has(seat.number)}
                                          onClick={() =>
                                            handleDeleteSeat(seat.number)
                                          }
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                          aria-label={`Delete seat ${seat.number}`}
                                          title={`Delete Seat ${seat.number}`}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              disabled={seatAddInFlight}
                              onClick={handleAddSeat}
                              className="h-7 shrink-0 rounded-md border border-border bg-background px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Add seat"
                              title="Add seat"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1">
                    <aside className="hidden w-48 shrink-0 border-r border-border bg-card lg:block">
                      <CategoryNav
                        categories={menuSource.categories}
                        selectedCategory={selectedCategory}
                        selectedCategories={searchQuery.trim() ? matchedCategoryIds : undefined}
                        onSelectCategory={setSelectedCategory}
                        variant="vertical"
                      />
                    </aside>

                    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                      {addContextPulse && (
                        <div
                          key={addContextPulse.id}
                          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                        >
                          <div className="animate-add-context-burst rounded-2xl border border-sky-300/40 bg-slate-950/45 px-7 py-5 shadow-[0_24px_64px_rgba(2,6,23,0.68)] backdrop-blur-[2px]">
                            <div className="flex items-center gap-4">
                              <span className="inline-flex h-20 min-w-34 items-center justify-center rounded-2xl border border-amber-300/60 bg-linear-to-b from-amber-300/30 to-amber-700/24 px-5 text-4xl font-black tracking-[0.08em] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_14px_28px_rgba(245,158,11,0.32)]">
                                {addContextPulse.waveLabel}
                              </span>
                              <span className="inline-flex h-20 min-w-34 items-center justify-center rounded-2xl border border-sky-300/60 bg-linear-to-b from-sky-300/32 to-sky-700/24 px-5 text-4xl font-black tracking-[0.08em] text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.46),0_14px_28px_rgba(14,165,233,0.34)]">
                                {addContextPulse.targetLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="lg:hidden">
                        <CategoryNav
                          categories={menuSource.categories}
                          selectedCategory={selectedCategory}
                          selectedCategories={searchQuery.trim() ? matchedCategoryIds : undefined}
                          onSelectCategory={setSelectedCategory}
                          variant="horizontal"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5">
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                          {filteredMenuItems.map((item) => (
                            <MenuItemCard
                              key={item.id}
                              item={item}
                              categoryLabel={
                                searchQuery.trim()
                                  ? menuSource.categories.find((c) => c.id === item.category)?.name ??
                                    item.category
                                  : undefined
                              }
                              hasAllergyConflict={!!selectedSeat && hasAllergyConflict(item, projectedSeats.find((seat) => seat.number === selectedSeat)?.dietary ?? [])}
                              onClick={handleQuickAddMenuItem}
                            />
                          ))}
                        </div>

                        {filteredMenuItems.length === 0 && (
                          <div className="flex h-64 items-center justify-center">
                            <p className="text-muted-foreground">No items found</p>
                          </div>
                        )}
                      </div>
                    </main>
                  </div>
                </div>
              ) : (
                <>
                  {/* Reservation info - when session originated from reservation */}
                  {tableView?.reservation && (
                    <div className="mx-3 mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 md:mx-4 md:mt-4 lg:mx-5 lg:mt-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400/90">
                        Reserved for
                      </p>
                      <p className="mt-0.5 font-medium text-foreground">
                        {tableView.reservation.guestName}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatReservationTime(tableView.reservation.reservationTime)}
                        {" · "}
                        Party of {tableView.reservation.partySize}
                      </p>
                    </div>
                  )}
                  {/* Wave Timeline */}
                  {hasMealProgress && (
                    <div className="mb-4 px-3 pb-1 pt-3 md:px-4 md:pb-1 md:pt-4 lg:px-5 lg:pb-1 lg:pt-5">
                      <WaveTimeline
                        waves={mealProgress.waves}
                        seats={projectedSeats}
                        onFireWave={handleFireWave}
                        onMarkWaveServed={handleMarkWaveServed}
                        tableNumber={table.number}
                        waveItemsById={mealProgress.waveItemsById}
                        waveLabelsById={mealProgress.waveLabelsById}
                      />
                    </div>
                  )}

                  {/* Orders */}
                  <div
                    className={
                      hasMealProgress
                        ? "px-3 pb-3 pt-0 md:px-4 md:pb-4 md:pt-0 lg:px-5 lg:pb-5 lg:pt-0"
                        : "px-3 pb-3 pt-3 md:px-4 md:pb-4 md:pt-4 lg:px-5 lg:pb-5 lg:pt-5"
                    }
                  >
                    <OrderList
                      tableNumber={table.number}
                      seats={projectedSeats}
                      tableItems={tableItems}
                      selectedSeat={selectedSeat}
                      onAddItemsTarget={handleEnterOrdering}
                      onAdvanceWaveStatus={handleAdvanceWaveStatus}
                      onMarkServed={handleMarkServed}
                      onVoidItem={handleVoidItem}
                    />
                  </div>
                </>
              )}
            </div>
          </main>

          {/* RIGHT COLUMN: Table visual + Server + Table Info (hidden on mobile) */}
          {isOrderingInline ? (
            <aside className="hidden w-72 shrink-0 border-l border-border bg-card md:block lg:w-80">
              <OrderSummary
                items={summaryItems}
                seats={summarySeats}
                total={summaryTotals.total}
                enableWaveView
                summaryScope={summaryScope}
                canSeatScope={selectedSeat !== null}
                onSummaryScopeChange={setSummaryScope}
                onQuantityChange={handleQuantityChange}
                onEditItem={(itemId) => {
                  const item = orderItems.find((i) => i.id === itemId)
                  if (!item) return
                  const menuItem = menuSource.menuItems.find((m) => m.id === item.menuItemId)
                  if (menuItem) {
                    setCustomizeDefaults({
                      seat: item.seat,
                      wave: getDraftItemWaveNumber(item),
                    })
                    setEditingOrderItemId(item.id)
                    setCustomizingItem(menuItem)
                  }
                }}
                onRemoveItem={handleRemoveItem}
              />
            </aside>
          ) : (
            <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-card md:block lg:w-80">
              <div className="px-4 pt-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Table Info
                </h2>
              </div>
              <div className="px-4 pt-7 pb-1">
                <TableVisual
                  tableNumber={table.number}
                  capacity={table.capacity}
                  seats={projectedSeats}
                  selectedSeat={selectedSeat}
                  onSelectSeat={setSelectedSeat}
                  status={table.status}
                  onAddItemsForSeat={handleEnterOrdering}
                  waiterRequested={showWaiterRequest}
                  onAcknowledgeWaiter={() => {
                    void handleAcknowledgeWaiter()
                  }}
                  waiterAckPending={waiterAckInFlight}
                />
              </div>
              <div className="px-4 pb-4">
                <InfoPanel table={table} showTitle={false} />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <ActionBar
        table={table}
        onFireWave={handleFireWave}
        canFireWave={mealProgress.nextFireableWaveNumber !== null}
        nextFireWaveLabel={
          mealProgress.nextFireableWaveNumber
            ? `Fire W${mealProgress.nextFireableWaveNumber}`
            : "Fire Wave"
        }
        onFireNextWave={handleFireNextWave}
        onSend={handleSendCurrentOrder}
        onBill={() => {
          if (currentLocationId && id) {
            const record = (sid: string) =>
              fireAndForget(
                fetchPos(`/api/sessions/${encodeURIComponent(sid)}/events`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "bill_requested", eventSource: "table_page" }),
                }),
                "record bill_requested event"
              )
            if (effectiveSessionId) record(effectiveSessionId)
          }
          setPaymentOpen(true)
        }}
        onAddItems={() => {
          if (isOrderingInline) {
            if (orderItems.length > 0) {
              setDiscardDraftDialogOpen(true)
              return
            }
            handleExitOrderingView()
            return
          }
          handleEnterOrdering()
        }}
        isOrdering={isOrderingInline}
        hasPendingSend={hasPendingSend}
        canBill={canBill}
      />

      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        tableNumber={table.number}
        guestCount={table.guestCount}
        seats={projectedSeats}
        tableItems={tableItems}
        onComplete={handlePaymentComplete}
        outstandingItems={
          outstandingItems
            ? {
                ...outstandingItems,
                unfinishedItems: outstandingItems.unfinishedItems?.map((item) => ({
                  id: item.id,
                  name: item.itemName,
                  status: item.status,
                })),
              }
            : null
        }
      />

      {/* Mobile/Tablet: Info panel as sheet */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Table Info</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {isOrderingInline ? (
              <OrderSummary
                items={summaryItems}
                seats={summarySeats}
                total={summaryTotals.total}
                enableWaveView
                summaryScope={summaryScope}
                canSeatScope={selectedSeat !== null}
                onSummaryScopeChange={setSummaryScope}
                onQuantityChange={handleQuantityChange}
                onEditItem={(itemId) => {
                  const item = orderItems.find((i) => i.id === itemId)
                  if (!item) return
                  const menuItem = menuSource.menuItems.find((m) => m.id === item.menuItemId)
                  if (menuItem) {
                    setCustomizeDefaults({
                      seat: item.seat,
                      wave: getDraftItemWaveNumber(item),
                    })
                    setEditingOrderItemId(item.id)
                    setCustomizingItem(menuItem)
                  }
                  setInfoOpen(false)
                }}
                onRemoveItem={handleRemoveItem}
              />
            ) : (
              <InfoPanel table={table} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CustomizeItemModal
        item={customizingItem}
        seats={orderSeats}
        defaultSeat={customizeDefaults?.seat ?? selectedSeat ?? projectedSeats[0]?.number ?? 1}
        defaultWave={customizeDefaults?.wave ?? selectedWaveNumber}
        waveOptions={heldWaveNumbers}
        submitLabel={editingOrderItemId ? "Save Changes" : "Add to Order"}
        open={!!customizingItem}
        onClose={() => {
          setCustomizingItem(null)
          setCustomizeDefaults(null)
          setEditingOrderItemId(null)
        }}
        onAddToOrder={handleAddToOrder}
      />

      <Dialog
        open={warningDialog.open}
        onOpenChange={(open) =>
          setWarningDialog((prev) => ({
            ...prev,
            open,
          }))
        }
      >
        <DialogContent className="max-w-md border-red-500/30 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-5 w-5" />
              {warningDialog.title}
            </DialogTitle>
            <DialogDescription>{warningDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() =>
                setWarningDialog((prev) => ({
                  ...prev,
                  open: false,
                }))
              }
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardDraftDialogOpen} onOpenChange={setDiscardDraftDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discard unsent items?</DialogTitle>
            <DialogDescription>
              You have items in Current Order that are not sent yet. Leaving now will discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardDraftDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                setOrderItems([])
                setCustomizingItem(null)
                setCustomizeDefaults(null)
                setEditingOrderItemId(null)
                // Discard clears drafts immediately; run cleanup against the post-discard empty draft state.
                handleExitOrderingView({ draftItems: [] })
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seat Party Modal */}
      <SeatPartyModal
        open={seatPartyOpen}
        tables={floorTablesForModal}
        preSelectedTableId={table.id}
        onClose={() => setSeatPartyOpen(false)}
        onSeated={handleSeated}
      />
    </div>
  )
}
