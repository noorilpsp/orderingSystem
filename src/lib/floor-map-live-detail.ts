import type { AlertType, FloorTable } from "@/lib/floor-map-data"
import type {
  StoreAlertType,
  StoreMealStage,
  StoreOrder,
  StoreOrderItem,
  StoreTable,
  StoreTableSessionState,
} from "@/store/types"
import type { DetailAlert, Wave, WaveStatus } from "@/lib/table-detail-data"
import {
  deriveCanonicalWaveStatusFromItems,
  mapCanonicalWaveStatusToDetailStatus,
  mapStoreLikeWaveStatusToCanonical,
} from "@/lib/wave-status"

const WAVE_TYPE_ORDER: Array<Wave["type"]> = ["drinks", "food", "dessert"]
const OCCASION_KEYWORDS = ["birthday", "anniversary", "graduation", "celebration", "vip"]

interface FloorMapSeatDetail {
  dietary: string[]
  specialOccasion?: string
  orderTotal: number
}

export interface FloorMapLiveDetail {
  server: { id: string; name: string } | null
  seats: FloorMapSeatDetail[]
  waves: Wave[]
  alerts: DetailAlert[]
  billTotal: number
}

function getOrderTotal(items: StoreOrderItem[]): number {
  return items
    .filter((item) => item.status !== "void")
    .reduce((sum, item) => sum + item.price, 0)
}

function getItemWaveNumber(item: StoreOrderItem): number | null {
  if (typeof item.waveNumber === "number" && Number.isFinite(item.waveNumber)) {
    return item.waveNumber
  }
  const waveTag = item.mods?.find((mod) => /^Wave\s+\d+$/i.test(mod))
  if (waveTag) {
    const match = waveTag.match(/(\d+)/)
    if (match) {
      const parsed = Number(match[1])
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
  }

  if (item.wave === "drinks") return 1
  if (item.wave === "food") return 2
  if (item.wave === "dessert") return 3
  return null
}

function getWaveStatus(items: StoreOrderItem[]): WaveStatus {
  return mapCanonicalWaveStatusToDetailStatus(
    deriveCanonicalWaveStatusFromItems(items)
  )
}

function buildSessionWaves(session: StoreTableSessionState | null | undefined): Wave[] {
  if (!session) return []

  const allItems = [
    ...session.seats.flatMap((seat) => seat.items),
    ...session.tableItems,
  ].filter((item) => item.status !== "void")

  const hasMealStarted = allItems.some((item) => item.status !== "held")
  if (!hasMealStarted) return []

  const grouped = new Map<number, StoreOrderItem[]>()
  for (const item of allItems) {
    const waveNumber = getItemWaveNumber(item)
    if (!waveNumber) continue
    const existing = grouped.get(waveNumber) ?? []
    existing.push(item)
    grouped.set(waveNumber, existing)
  }

  const maxWaveWithItems = Math.max(0, ...Array.from(grouped.keys()))
  if (maxWaveWithItems <= 0) return []

  const totalWaves = Math.max(1, session.waveCount || 1, maxWaveWithItems)

  const waves: Wave[] = []
  for (let waveNumber = 1; waveNumber <= totalWaves; waveNumber += 1) {
    waves.push({
      type: WAVE_TYPE_ORDER[(waveNumber - 1) % WAVE_TYPE_ORDER.length],
      status: getWaveStatus(grouped.get(waveNumber) ?? []),
    })
  }

  return waves
}

function mapOrderWaveStatusToDetail(status: StoreOrder["waves"][number]["status"]): WaveStatus {
  return mapCanonicalWaveStatusToDetailStatus(
    mapStoreLikeWaveStatusToCanonical(status)
  )
}

function buildOrderWaves(order: StoreOrder | null | undefined): Wave[] {
  if (!order || order.waves.length === 0) return []
  return order.waves.map((wave) => ({
    type: WAVE_TYPE_ORDER[(Math.max(1, wave.number) - 1) % WAVE_TYPE_ORDER.length],
    status: mapOrderWaveStatusToDetail(wave.status),
  }))
}

function buildFallbackWaves(stage: StoreMealStage | null | undefined, hasReadyAlert: boolean): Wave[] {
  if (!stage) return []

  if (stage === "drinks") {
    return [
      { type: "drinks", status: "cooking" },
      { type: "food", status: "not_started" },
      { type: "dessert", status: "not_started" },
    ]
  }

  if (stage === "food") {
    return [
      { type: "drinks", status: "served" },
      { type: "food", status: hasReadyAlert ? "ready" : "cooking" },
      { type: "dessert", status: "not_started" },
    ]
  }

  if (stage === "dessert") {
    return [
      { type: "drinks", status: "served" },
      { type: "food", status: "served" },
      { type: "dessert", status: hasReadyAlert ? "ready" : "cooking" },
    ]
  }

  if (stage === "bill") {
    return [
      { type: "drinks", status: "served" },
      { type: "food", status: "served" },
      { type: "dessert", status: "served" },
    ]
  }

  return []
}

function mapStoreAlertToDetail(type: StoreAlertType): DetailAlert {
  if (type === "food_ready") {
    return {
      type: "food_ready",
      severity: "urgent",
      message: "Food ready for pickup",
    }
  }
  if (type === "kitchen_delay") {
    return {
      type: "kitchen_delay",
      severity: "urgent",
      message: "Kitchen delay",
    }
  }
  if (type === "no_checkin") {
    return {
      type: "no_checkin",
      severity: "warning",
      message: "No check-in for 15m",
    }
  }
  return {
    type: "bill_requested",
    severity: "info",
    message: "Waiting for service",
  }
}

function mapFloorAlertToDetail(type: AlertType): DetailAlert {
  if (type === "food_ready") {
    return {
      type: "food_ready",
      severity: "urgent",
      message: "Food ready for pickup",
    }
  }
  if (type === "no_checkin") {
    return {
      type: "no_checkin",
      severity: "warning",
      message: "No check-in for 15m",
    }
  }
  return {
    type: "bill_requested",
    severity: "info",
    message: "Waiting for service",
  }
}

function detectOccasion(notes: string[]): string | undefined {
  const joined = notes.join(" ").toLowerCase()
  const match = OCCASION_KEYWORDS.find((keyword) => joined.includes(keyword))
  return match
}

function buildAlerts(storeTable: StoreTable, waves: Wave[]): DetailAlert[] {
  const alerts = (storeTable.alerts ?? []).map(mapStoreAlertToDetail)
  if (storeTable.status === "billing" && !alerts.some((alert) => alert.type === "bill_requested")) {
    alerts.push({
      type: "bill_requested",
      severity: "info",
      message: "Bill requested",
    })
  }

  if (alerts.some((alert) => alert.type === "food_ready")) return alerts
  const hasReadyWave = waves.some((wave) => wave.status === "ready")
  if (!hasReadyWave) return alerts

  return [
    {
      type: "food_ready",
      severity: "urgent",
      message: "Food ready for pickup",
    },
    ...alerts,
  ]
}

/** Floor table with optional view enrichment (waves, billTotal, serverId). */
type FloorTableWithEnrichment = FloorTable & {
  waves?: { type: string; status: string }[]
  billTotal?: number
  serverId?: string | null
}

export function buildFloorMapLiveDetail(
  floorTable: FloorTableWithEnrichment,
  storeTable?: StoreTable,
  storeOrder?: StoreOrder
): FloorMapLiveDetail | null {
  const source = storeTable
  if (!source) {
    const waves =
      floorTable.waves && floorTable.waves.length > 0
        ? floorTable.waves.map((w) => ({ type: w.type, status: w.status }))
        : Array.isArray(floorTable.waves)
          ? []
          : buildFallbackWaves(floorTable.stage, floorTable.alerts?.includes("food_ready") ?? false)
    const billTotal =
      typeof floorTable.billTotal === "number" && Number.isFinite(floorTable.billTotal)
        ? floorTable.billTotal
        : 0
    const displayName = floorTable.server ?? floorTable.serverId ?? null
    const server =
      floorTable.serverId
        ? { id: floorTable.serverId, name: displayName ?? floorTable.serverId }
        : displayName
          ? { id: displayName, name: displayName }
          : null
    return {
      server,
      seats: [],
      waves,
      alerts: [
        ...(floorTable.alerts ?? []).map(mapFloorAlertToDetail),
        ...(floorTable.stage === "bill"
          ? [
              {
                type: "bill_requested" as const,
                severity: "info" as const,
                message: "Bill requested",
              },
            ]
          : []),
      ],
      billTotal,
    }
  }

  const activeOrder = storeOrder?.status === "open" ? storeOrder : null
  const session = activeOrder?.session ?? source.session ?? null
  const hasReadyAlert = (source.alerts ?? []).includes("food_ready")
  const orderWaves = buildOrderWaves(activeOrder)
  const sessionWaves = buildSessionWaves(session)
  const effectiveWaves =
    orderWaves.length > 0
      ? orderWaves
      : sessionWaves.length > 0
        ? sessionWaves
        : buildFallbackWaves(source.stage, hasReadyAlert)
  const alerts = buildAlerts(source, effectiveWaves)

  const seats = (session?.seats ?? []).map((seat) => ({
    dietary: [...seat.dietary],
    specialOccasion: detectOccasion(seat.notes),
    orderTotal: getOrderTotal(seat.items),
  }))

  const sessionItemTotal = session
    ? getOrderTotal([
        ...session.seats.flatMap((seat) => seat.items),
        ...session.tableItems,
      ])
    : 0
  const orderBillTotal = activeOrder?.bill.total ?? 0
  const sessionBillTotal = session?.bill.total && session.bill.total > 0 ? session.bill.total : sessionItemTotal
  const billTotal = orderBillTotal > 0 ? orderBillTotal : sessionBillTotal

  return {
    server:
      source.serverId && source.serverName
        ? { id: source.serverId, name: source.serverName }
        : source.serverId
          ? { id: source.serverId, name: source.serverId }
          : null,
    seats,
    waves: effectiveWaves,
    alerts,
    billTotal,
  }
}
