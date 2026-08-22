export type TableViewItemStatus = "held" | "sent" | "cooking" | "ready" | "served" | "void"
export type TableViewWaveStatus = "held" | "sent" | "preparing" | "ready" | "served"

/** UI mode derived from furniture status + session. Use this, not table.status, for seating/ordering gates. */
export type TableViewUiMode = "blocked" | "needs_seating" | "in_service"

/** Service stage for header badge and TableVisual. Matches TableDetail.status. */
export type TableViewServiceStage =
  | "available"
  | "seated"
  | "ordering"
  | "in_kitchen"
  | "food_ready"
  | "served"
  | "bill_requested"
  | "needs_attention"

export type TableView = {
  /** Furniture-only status (slow-changing): active, maintenance, disabled, or legacy values. */
  table: {
    id: string
    locationId: string
    /** Floor plan that owns this table row; used to return to the correct map without flashing another plan. */
    floorPlanId: string | null
    number: number
    displayId: string | null
    status: string
    section: string
    shape: string
    capacity: number
    guests: number
    seatedAt: string | null
    stage: string | null
    alerts: string[] | null
  }
  openSession: {
    id: string
    status: string
    guestCount: number
    openedAt: string
    waveCount: number
  } | null
  seats: Array<{
    id: string
    seatNumber: number
    guestName: string | null
  }>
  items: Array<{
    id: string
    orderId: string
    menuItemId: string | null
    name: string
    price: number
    quantity: number
    status: TableViewItemStatus
    seatNumber: number
    waveNumber: number
    notes: string | null
  }>
  waves: Array<{
    waveNumber: number
    status: TableViewWaveStatus
    itemCount: number
    canFire: boolean
    canAdvanceToPreparing: boolean
    canAdvanceToReady: boolean
    canAdvanceToServed: boolean
  }>
  actions: {
    canSend: boolean
    canAddWave: boolean
    canDeleteWave: boolean
    canCloseSession: boolean
  }
  bill: {
    subtotal: number
    tax: number
    total: number
  }
  outstanding: {
    canClose: boolean
    reason?:
      | "session_not_open"
      | "unfinished_items"
      | "unpaid_balance"
      | "payment_in_progress"
      | "kitchen_mid_fire"
    unfinishedItems?: Array<{
      id: string
      itemName: string
      status: string
      quantity: number
      orderId: string
    }>
    remaining?: number
  } | null
  delays: Array<{
    orderItemId: string
    minutesLate: number
    station: string | null
  }> | null
  /** Service state for UI: blocked (furniture), needs_seating (no session), in_service (session open). */
  uiMode: TableViewUiMode
  /** Stage for header badge and TableVisual. Derived from items/waves. */
  serviceStage: TableViewServiceStage
  /** When session originated from a reservation, linked reservation info. */
  reservation?: {
    id: string
    guestName: string
    partySize: number
    reservationTime: string
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null
}

function isString(x: unknown): x is string {
  return typeof x === "string"
}

function isNullableString(x: unknown): x is string | null {
  return x === null || typeof x === "string"
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x)
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every(isString)
}

export function isTableView(x: unknown): x is TableView {
  if (!isRecord(x)) return false
  if (!isRecord(x.table)) return false
  if (!("openSession" in x)) return false
  if (!Array.isArray(x.seats) || !Array.isArray(x.items) || !Array.isArray(x.waves)) return false
  if (!isRecord(x.actions)) return false
  if (!isRecord(x.bill)) return false
  if (!(x.outstanding === null || isRecord(x.outstanding))) return false
  if (!(x.delays === null || Array.isArray(x.delays))) return false
  if (x.uiMode !== "blocked" && x.uiMode !== "needs_seating" && x.uiMode !== "in_service") return false
  const validStages = ["available", "seated", "ordering", "in_kitchen", "food_ready", "served", "bill_requested", "needs_attention"]
  if (typeof x.serviceStage !== "string" || !validStages.includes(x.serviceStage)) return false

  const table = x.table
  const floorPlanIdNorm = "floorPlanId" in table ? table.floorPlanId : null
  if (!isNullableString(floorPlanIdNorm)) return false
  if (
    !isString(table.id) ||
    !isString(table.locationId) ||
    !isNumber(table.number) ||
    !isNullableString(table.displayId) ||
    !isString(table.status) ||
    !isString(table.section) ||
    !isString(table.shape) ||
    !isNumber(table.capacity) ||
    !isNumber(table.guests) ||
    !isNullableString(table.seatedAt) ||
    !isNullableString(table.stage) ||
    !(table.alerts === null || isStringArray(table.alerts))
  ) {
    return false
  }

  if (x.openSession !== null) {
    if (!isRecord(x.openSession)) return false
    if (
      !isString(x.openSession.id) ||
      !isString(x.openSession.status) ||
      !isNumber(x.openSession.guestCount) ||
      !isString(x.openSession.openedAt) ||
      !isNumber(x.openSession.waveCount)
    ) {
      return false
    }
  }

  for (const seat of x.seats) {
    if (!isRecord(seat)) return false
    if (!isString(seat.id) || !isNumber(seat.seatNumber) || !isNullableString(seat.guestName)) return false
  }

  for (const item of x.items) {
    if (!isRecord(item)) return false
    if (
      !isString(item.id) ||
      !isString(item.orderId) ||
      !isNullableString(item.menuItemId) ||
      !isString(item.name) ||
      !isNumber(item.price) ||
      !isNumber(item.quantity) ||
      !isString(item.status) ||
      !isNumber(item.seatNumber) ||
      !isNumber(item.waveNumber) ||
      !isNullableString(item.notes)
    ) {
      return false
    }
  }

  for (const wave of x.waves) {
    if (!isRecord(wave)) return false
    if (
      !isNumber(wave.waveNumber) ||
      !isString(wave.status) ||
      !isNumber(wave.itemCount) ||
      typeof wave.canFire !== "boolean" ||
      typeof wave.canAdvanceToPreparing !== "boolean" ||
      typeof wave.canAdvanceToReady !== "boolean" ||
      typeof wave.canAdvanceToServed !== "boolean"
    ) {
      return false
    }
  }

  const actions = x.actions
  if (
    typeof actions.canSend !== "boolean" ||
    typeof actions.canAddWave !== "boolean" ||
    typeof actions.canDeleteWave !== "boolean" ||
    typeof actions.canCloseSession !== "boolean"
  ) {
    return false
  }

  const bill = x.bill
  if (!isNumber(bill.subtotal) || !isNumber(bill.tax) || !isNumber(bill.total)) return false

  if (x.outstanding !== null) {
    const outstanding = x.outstanding
    if (typeof outstanding.canClose !== "boolean") return false
    if (!(outstanding.reason === undefined || isString(outstanding.reason))) return false
    if (!(outstanding.remaining === undefined || isNumber(outstanding.remaining))) return false
    if (!(outstanding.unfinishedItems === undefined || Array.isArray(outstanding.unfinishedItems))) return false
  }

  if (x.delays !== null) {
    for (const delay of x.delays) {
      if (!isRecord(delay)) return false
      if (!isString(delay.orderItemId) || !isNumber(delay.minutesLate) || !isNullableString(delay.station)) {
        return false
      }
    }
  }

  return true
}

/** Client-only placeholder IDs - must not be sent to session APIs. */
export function isOptimisticSessionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("optimistic-")
}

/** Optimistic table view after seating - reverted if the session API fails. */
export function buildOptimisticSeatedTableView(
  prev: TableView,
  guestCount: number
): TableView {
  const now = new Date().toISOString();
  const safeGuestCount = Math.max(1, Math.floor(guestCount));
  const seats = Array.from({ length: safeGuestCount }, (_, i) => ({
    id: prev.seats[i]?.id ?? `optimistic-seat-${i + 1}`,
    seatNumber: i + 1,
    guestName: prev.seats[i]?.guestName ?? null,
  }));

  return {
    ...prev,
    uiMode: "in_service",
    serviceStage: "seated",
    table: {
      ...prev.table,
      guests: safeGuestCount,
      seatedAt: now,
      status: "active",
      stage: "drinks",
    },
    openSession: {
      id: prev.openSession?.id ?? `optimistic-${Date.now()}`,
      status: "open",
      guestCount: safeGuestCount,
      openedAt: now,
      waveCount: prev.openSession?.waveCount ?? 1,
    },
    seats,
    actions: {
      ...prev.actions,
      canSend: false,
      canAddWave: true,
      canDeleteWave: false,
      canCloseSession: false,
    },
  };
}

/** Optimistic table view after force close - reverted if the close API fails. */
export function buildOptimisticForceClosedTableView(prev: TableView): TableView {
  return {
    ...prev,
    uiMode: "needs_seating",
    serviceStage: "available",
    openSession: null,
    seats: [],
    items: [],
    waves: [],
    table: {
      ...prev.table,
      guests: 0,
      seatedAt: null,
      stage: null,
    },
    actions: {
      canSend: false,
      canAddWave: false,
      canDeleteWave: false,
      canCloseSession: false,
    },
    bill: { subtotal: 0, tax: 0, total: 0 },
    outstanding: null,
    delays: null,
  };
}
