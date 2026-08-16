"use client"

import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import React from "react"

import { useEffect, useMemo, useState, useRef } from "react"
import { AlertTriangle, Check, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { Seat, OrderItem } from "@/lib/table-data"
import {
  dietaryIcons,
  statusConfig,
  getSeatTotal,
} from "@/lib/table-data"
import type { ItemStatus } from "@/lib/table-data"
import {
  deriveCanonicalWaveStatusFromItems,
  mapCanonicalWaveStatusToStoreLikeStatus,
} from "@/lib/wave-status"

interface OrderListProps {
  tableNumber?: number
  seats: Seat[]
  tableItems?: OrderItem[]
  selectedSeat: number | null
  onAddItemsTarget?: (seatNumber: number | null) => void
  onMarkServed: (itemId: string) => void
  onVoidItem: (itemId: string) => void
  onAdvanceWaveStatus?: (
    waveNumber: number,
    nextStatus: "cooking" | "ready" | "served"
  ) => void
}

type WaveFilter = "all" | number
type TargetFilter = "all" | "table" | number

function matchesTargetFilter(seatNumber: number, filter: TargetFilter): boolean {
  if (filter === "all") return true
  if (filter === "table") return seatNumber === 0
  return seatNumber === filter
}

function matchesWaveFilter(item: OrderItem, filter: WaveFilter): boolean {
  if (filter === "all") return true
  return getWaveNumber(item) === filter
}

// ── Swipeable Item Card ──────────────────────────────────────────────────────

function ItemCard({
  item,
  seatNumber,
  tableNumber,
  showSeat,
  showWaveChip = true,
  onMarkServed,
  onVoidItem,
}: {
  item: OrderItem
  seatNumber?: number
  tableNumber?: number
  showSeat?: boolean
  showWaveChip?: boolean
  onMarkServed: (id: string) => void
  onVoidItem: (id: string) => void
}) {
  const cfg = statusConfig[item.status]
  const resolvedWaveNumber = getWaveNumber(item)
  const waveLabel = resolvedWaveNumber ? `W${resolvedWaveNumber}` : null
  const visibleMods = (item.mods ?? []).filter((mod) => !/^Wave\s+\d+$/i.test(mod))
  const touchStartX = useRef(0)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeAction, setSwipeAction] = useState<"served" | "void" | null>(null)
  const isVoided = item.status === "void"

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    setSwipeAction(null)
  }
  function handleTouchMove(e: React.TouchEvent) {
    const diff = e.touches[0].clientX - touchStartX.current
    const clampedDiff = Math.max(-80, Math.min(80, diff))
    setSwipeOffset(clampedDiff)
    if (clampedDiff > 50) setSwipeAction("served")
    else if (clampedDiff < -50) setSwipeAction("void")
    else setSwipeAction(null)
  }
  function handleTouchEnd() {
    if (swipeAction === "served" && item.status !== "served" && item.status !== "void") {
      onMarkServed(item.id)
    } else if (swipeAction === "void" && item.status !== "void") {
      onVoidItem(item.id)
    }
    setSwipeOffset(0)
    setSwipeAction(null)
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe reveal backgrounds - hidden for voided */}
      {!isVoided && (
      <div className="absolute inset-0 flex items-center justify-between px-4">
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium transition-opacity",
          swipeAction === "void" ? "opacity-100 text-red-500" : "opacity-30 text-muted-foreground"
        )}>
          <X className="h-4 w-4" />
          Void
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium transition-opacity",
          swipeAction === "served" ? "opacity-100 text-emerald-500" : "opacity-30 text-muted-foreground"
        )}>
          <Check className="h-4 w-4" />
          Served
        </div>
      </div>
      )}

      <div
        className={cn(
          "relative flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3 transition-transform",
          cfg.pulse && "animate-pulse-ring",
          cfg.strike && "opacity-50"
        )}
        style={{
          transform: isVoided ? undefined : `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? "transform 0.2s ease" : "none",
        }}
        onTouchStart={isVoided ? undefined : handleTouchStart}
        onTouchMove={isVoided ? undefined : handleTouchMove}
        onTouchEnd={isVoided ? undefined : handleTouchEnd}
      >
        {/* Top row: name + price */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {item.allergyAlert && (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            )}
            <div className="flex items-center gap-2">
              <span className={cn("font-medium text-foreground", cfg.strike && "line-through")}>
                {item.name}
                {item.variant && (
                  <span className="text-muted-foreground"> ({item.variant})</span>
                )}
              </span>
              {isVoided && (
                <span className="inline-flex items-center rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:text-red-400 shrink-0">
                  VOIDED
                </span>
              )}
              {showWaveChip && waveLabel && (
                <span className="inline-flex h-5 items-center rounded border border-amber-400/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-200">
                  {waveLabel}
                </span>
              )}
              {showSeat && seatNumber !== undefined && (
                <span className="inline-flex h-5 items-center rounded border border-sky-400/45 bg-sky-500/15 px-1.5 text-[10px] font-bold text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.25)]">
                  {seatNumber === 0 ? `T${tableNumber ?? ""}` : `S${seatNumber}`}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 font-semibold text-foreground">
            {formatMoney(item.price)}
          </span>
        </div>

        {/* Modifiers */}
        {visibleMods.length > 0 && (
          <div className="space-y-0.5">
            {visibleMods.map((mod) => (
              <p
                key={mod}
                className={cn(
                  "text-sm",
                  mod.startsWith("-")
                    ? "font-medium text-red-500"
                    : mod.startsWith("+")
                      ? "font-medium text-emerald-500"
                    : "text-muted-foreground"
                )}
              >
                {mod}
              </p>
            ))}
          </div>
        )}

        {/* Status row */}
        <div className="flex items-center justify-between">
          <span className={cn("text-xs font-medium", cfg.colorClass, cfg.pulse && "animate-pulse")}>
            {cfg.label}
            {item.status === "ready" && " \u2014 Pick up!"}
            {item.eta ? ` \u00B7 ~${item.eta} min` : ""}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── By Seat View ─────────────────────────────────────────────────────────────

function BySeatView({
  tableNumber,
  seats,
  tableItems,
  selectedSeat,
  onAddItemsTarget,
  targetFilter,
  waveFilter,
  onMarkServed,
  onVoidItem,
}: {
  tableNumber?: number
  seats: Seat[]
  tableItems: OrderItem[]
  selectedSeat: number | null
  onAddItemsTarget?: (seatNumber: number | null) => void
  targetFilter: TargetFilter
  waveFilter: WaveFilter
  onMarkServed: (id: string) => void
  onVoidItem: (id: string) => void
}) {
  const targetFilteredSeats =
    targetFilter === "table"
      ? []
      : typeof targetFilter === "number"
        ? seats.filter((s) => s.number === targetFilter)
        : seats
  const filtered = selectedSeat
    ? targetFilteredSeats.filter((s) => s.number === selectedSeat)
    : targetFilteredSeats

  return (
    <div className="space-y-4">
      {selectedSeat === null && matchesTargetFilter(0, targetFilter) && (
        <div>
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Table
              </h3>
              <span className="inline-flex h-5 items-center rounded border border-sky-400/45 bg-sky-500/15 px-1.5 text-[10px] font-bold text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.25)]">
                T{tableNumber ?? ""}
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {formatMoney(tableItems.reduce((sum, item) => sum + item.price, 0))}
            </span>
          </div>
          <div className="space-y-2">
            {tableItems.filter((item) => matchesWaveFilter(item, waveFilter)).length > 0 ? (
              tableItems
                .filter((item) => matchesWaveFilter(item, waveFilter))
                .map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onMarkServed={onMarkServed}
                  onVoidItem={onVoidItem}
                />
              ))
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 gap-1 text-xs text-primary"
            onClick={() => onAddItemsTarget?.(null)}
          >
            <Plus className="h-3 w-3" />
            Add Items to T{tableNumber ?? ""}
          </Button>
        </div>
      )}

      {filtered.map((seat) => (
        <div key={seat.number}>
          {/* Seat header */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Seat {seat.number}
              </h3>
              <span className="inline-flex h-5 items-center rounded border border-sky-400/45 bg-sky-500/15 px-1.5 text-[10px] font-bold text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.25)]">
                S{seat.number}
              </span>
              {seat.dietary.map((d) => (
                <span key={d} className="text-sm">{dietaryIcons[d]}</span>
              ))}
            </div>
            <span className="text-sm font-semibold text-foreground">
              {formatMoney(getSeatTotal(seat))}
            </span>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {seat.items
              .filter((item) => matchesWaveFilter(item, waveFilter))
              .map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onMarkServed={onMarkServed}
                onVoidItem={onVoidItem}
              />
            ))}
          </div>

          {/* Add items */}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 gap-1 text-xs text-primary"
            onClick={() => onAddItemsTarget?.(seat.number)}
          >
            <Plus className="h-3 w-3" />
            Add Items to Seat {seat.number}
          </Button>
        </div>
      ))}
    </div>
  )
}

// ── By Wave View ─────────────────────────────────────────────────────────────

function ByWaveView({
  tableNumber,
  seats,
  tableItems,
  targetFilter,
  waveFilter,
  onAdvanceWaveStatus,
  onMarkServed,
  onVoidItem,
}: {
  tableNumber?: number
  seats: Seat[]
  tableItems: OrderItem[]
  targetFilter: TargetFilter
  waveFilter: WaveFilter
  onAdvanceWaveStatus?: (
    waveNumber: number,
    nextStatus: "cooking" | "ready" | "served"
  ) => void
  onMarkServed: (id: string) => void
  onVoidItem: (id: string) => void
}) {
  const waveGroups = new Map<number, { seatNumber: number; item: OrderItem }[]>()
  const unassigned: { seatNumber: number; item: OrderItem }[] = []
  const voided: { seatNumber: number; item: OrderItem }[] = []

  for (const seat of seats) {
    if (!matchesTargetFilter(seat.number, targetFilter)) continue
    for (const item of seat.items) {
      if (item.status === "void") {
        voided.push({ seatNumber: seat.number, item })
        continue
      }
      if (!matchesWaveFilter(item, waveFilter)) continue
      const waveNumber = getWaveNumber(item)
      if (waveNumber === null) {
        unassigned.push({ seatNumber: seat.number, item })
        continue
      }
      const existing = waveGroups.get(waveNumber) ?? []
      existing.push({ seatNumber: seat.number, item })
      waveGroups.set(waveNumber, existing)
    }
  }
  for (const item of tableItems) {
    if (!matchesTargetFilter(0, targetFilter)) continue
    if (item.status === "void") {
      voided.push({ seatNumber: 0, item })
      continue
    }
    if (!matchesWaveFilter(item, waveFilter)) continue
    const waveNumber = getWaveNumber(item)
    if (waveNumber === null) {
      unassigned.push({ seatNumber: 0, item })
      continue
    }
    const existing = waveGroups.get(waveNumber) ?? []
    existing.push({ seatNumber: 0, item })
    waveGroups.set(waveNumber, existing)
  }

  const sortedWaveNumbers = Array.from(waveGroups.keys()).sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      {sortedWaveNumbers.map((waveNumber) => {
        const items = waveGroups.get(waveNumber) ?? []
        const waveStatus = getWaveProgressStatus(items.map(({ item }) => item))
        const nextWaveAction = getNextWaveAction(waveStatus)
        return (
          <div key={waveNumber}>
            <div className="flex items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 items-center rounded border border-amber-400/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-200">
                  W{waveNumber}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Wave {waveNumber}
                </span>
                <span className={cn("text-[11px] font-semibold uppercase tracking-wide", statusConfig[waveStatus].colorClass)}>
                  {statusConfig[waveStatus].label}
                </span>
              </div>
              {nextWaveAction && onAdvanceWaveStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`table-wave-action-${nextWaveAction.nextStatus}-w${waveNumber}`}
                  className="h-6 rounded-md px-2 text-[11px] bg-transparent"
                  onClick={() => onAdvanceWaveStatus(waveNumber, nextWaveAction.nextStatus)}
                >
                  {nextWaveAction.label}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {items.map(({ seatNumber, item }) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  seatNumber={seatNumber}
                  tableNumber={tableNumber}
                  showSeat
                  showWaveChip={false}
                  onMarkServed={onMarkServed}
                  onVoidItem={onVoidItem}
                />
              ))}
            </div>
          </div>
        )
      })}

      {unassigned.length > 0 && (
        <div>
          <div className="pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unassigned
            </h3>
          </div>
          <div className="space-y-2">
            {unassigned.map(({ seatNumber, item }) => (
              <ItemCard
                key={item.id}
                item={item}
                seatNumber={seatNumber}
                tableNumber={tableNumber}
                showSeat
                onMarkServed={onMarkServed}
                onVoidItem={onVoidItem}
              />
            ))}
          </div>
        </div>
      )}

      {voided.length > 0 && (
        <div>
          <div className="pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Voided
            </h3>
          </div>
          <div className="space-y-2">
            {voided.map(({ seatNumber, item }) => (
              <ItemCard
                key={item.id}
                item={item}
                seatNumber={seatNumber}
                tableNumber={tableNumber}
                showSeat
                onMarkServed={onMarkServed}
                onVoidItem={onVoidItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getWaveNumber(item: OrderItem): number | null {
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

/** Wave is ready only when all non-void items are ready or served (no partial station readiness). */
function getWaveProgressStatus(items: OrderItem[]): "held" | "sent" | "cooking" | "ready" | "served" {
  return mapCanonicalWaveStatusToStoreLikeStatus(
    deriveCanonicalWaveStatusFromItems(items)
  )
}

function getNextWaveAction(
  status: "held" | "sent" | "cooking" | "ready" | "served"
): { nextStatus: "cooking" | "ready" | "served"; label: string } | null {
  if (status === "sent") return { nextStatus: "cooking", label: "Start Preparing" }
  if (status === "cooking") return { nextStatus: "ready", label: "Mark Ready" }
  if (status === "ready") return { nextStatus: "served", label: "Mark Served" }
  return null
}

// ── Main Order List ──────────────────────────────────────────────────────────

export function OrderList({
  tableNumber,
  seats,
  tableItems = [],
  selectedSeat,
  onAddItemsTarget,
  onAdvanceWaveStatus,
  onMarkServed,
  onVoidItem,
}: OrderListProps) {
  const { formatMoney } = useMerchantLocalization()
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("all")
  const [waveFilter, setWaveFilter] = useState<WaveFilter>("all")
  useEffect(() => {
    if (selectedSeat === null) {
      setTargetFilter("all")
      return
    }
    setTargetFilter(selectedSeat)
  }, [selectedSeat])
  const targetChips = useMemo(
    () => [
      { key: "all" as const, label: "All" },
      { key: "table" as const, label: `T${tableNumber ?? ""}` },
      ...seats.map((seat) => ({ key: seat.number as number, label: `S${seat.number}` })),
    ],
    [seats, tableNumber]
  )
  const waveOptions = useMemo(() => {
    const numbers = new Set<number>()
    for (const seat of seats) {
      for (const item of seat.items) {
        if (item.status === "void") continue
        const waveNumber = getWaveNumber(item)
        if (waveNumber !== null) numbers.add(waveNumber)
      }
    }
    for (const item of tableItems) {
      if (item.status === "void") continue
      const waveNumber = getWaveNumber(item)
      if (waveNumber !== null) numbers.add(waveNumber)
    }
    return Array.from(numbers).sort((a, b) => a - b)
  }, [seats, tableItems])
  const hasAnyOrderItems = useMemo(
    () =>
      seats.some((seat) => seat.items.some((item) => item.status !== "void")) ||
      tableItems.some((item) => item.status !== "void"),
    [seats, tableItems]
  )

  return (
    <div className="space-y-3">
      <Tabs defaultValue="by-seat">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Orders
          </h2>
          <TabsList className="h-8">
            <TabsTrigger value="by-seat" className="text-xs px-3 py-1">
              By Seat
            </TabsTrigger>
            <TabsTrigger value="by-wave" className="text-xs px-3 py-1" data-testid="table-orders-tab-by-wave">
              By Wave
            </TabsTrigger>
          </TabsList>
        </div>
        {hasAnyOrderItems && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {targetChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setTargetFilter(chip.key)}
                  className={cn(
                    "h-6 rounded-md border px-2 text-[11px] font-medium transition-colors",
                    targetFilter === chip.key
                      ? "border-sky-400 bg-sky-500/15 text-sky-200"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setWaveFilter("all")}
                className={cn(
                  "h-6 rounded-md border px-2 text-[11px] font-medium transition-colors",
                  waveFilter === "all"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                All Waves
              </button>
              {waveOptions.map((waveNumber) => (
                <button
                  key={waveNumber}
                  type="button"
                  onClick={() => setWaveFilter(waveNumber)}
                  className={cn(
                    "h-6 rounded-md border px-2 text-[11px] font-medium transition-colors",
                    waveFilter === waveNumber
                      ? "border-amber-400 bg-amber-500/15 text-amber-200"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  W{waveNumber}
                </button>
              ))}
            </div>
          </div>
        )}

        <TabsContent value="by-seat" className="mt-4">
          <BySeatView
            tableNumber={tableNumber}
            seats={seats}
            tableItems={tableItems}
            selectedSeat={selectedSeat}
            onAddItemsTarget={onAddItemsTarget}
            targetFilter={targetFilter}
            waveFilter={waveFilter}
            onMarkServed={onMarkServed}
            onVoidItem={onVoidItem}
          />
        </TabsContent>

        <TabsContent value="by-wave">
          <ByWaveView
            tableNumber={tableNumber}
            seats={seats}
            tableItems={tableItems}
            targetFilter={targetFilter}
            waveFilter={waveFilter}
            onAdvanceWaveStatus={onAdvanceWaveStatus}
            onMarkServed={onMarkServed}
            onVoidItem={onVoidItem}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
