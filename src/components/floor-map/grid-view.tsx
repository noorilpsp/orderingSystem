"use client"

import React, { useState, useCallback, useRef, useMemo } from "react"

import {
  Users,
  Clock,
  AlertTriangle,
  Flame,
  CreditCard,
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  Zap,
  MessageSquare,
  Eye,
  Plus,
  Check,
  NutOff,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  WaveBadge,
  waveStatusColors,
  waveStatusDot,
  waveStatusLabel,
} from "@/components/shared/wave-badges"
import type { FloorTable } from "@/lib/floor-map-data"
import { getFloorTableColorState, isOccupiedColorState, TABLE_CARD_COLOR_STATES, TABLE_COLOR_STATES, type TableColorState } from "@/lib/table-color-state"
import {
  minutesAgo,
  defaultSectionConfig,
} from "@/lib/floor-map-data"
import type { Wave, WaveStatus, DetailAlert } from "@/lib/table-detail-data"
import type { FloorMapLiveDetail } from "@/lib/floor-map-live-detail"
import { hasBillRequest, hasWaiterRequestAlert } from "@/lib/floor-map/acknowledgeTableService"
import { useViewportPrefetch } from "@/hooks/use-viewport-prefetch"

interface GridViewProps {
  sectionConfig?: Record<string, { name: string }>
  tables: FloorTable[]
  liveDetailByTableId: Map<string, FloorMapLiveDetail | null>
  currentServerId: string
  ownTableIds: string[]
  onTableTap: (tableId: string) => void
  onTablePrefetch?: (tableId: string) => void
  onMarkAvailable?: (tableId: string) => void
  onAcknowledgeService?: (tableId: string, requestType: "waiter" | "bill") => void
}

// ── Urgency ordering ───────────────────────────────────────────────────────
const statusOrder: TableColorState[] = [
  "needs_attention",
  "food_ready",
  "bill_requested",
  "occupied",
  "reserved",
  "available",
  "cleaning",
]

// statusOrder kept for grouping; visual colors now come from table-color-state.

// ── Group config ───────────────────────────────────────────────────────────
const groupConfig: Record<TableColorState, { label: string; defaultExpanded: boolean; emptyMsg: string }> = {
  needs_attention: { label: "NEEDS ATTENTION", defaultExpanded: true, emptyMsg: "No tables need attention — great work!" },
  food_ready: { label: "FOOD READY", defaultExpanded: true, emptyMsg: "No food ready tables" },
  bill_requested: { label: "BILL REQUESTED", defaultExpanded: true, emptyMsg: "No tables requesting the bill" },
  occupied: { label: "OCCUPIED", defaultExpanded: true, emptyMsg: "No occupied tables" },
  reserved: { label: "RESERVED", defaultExpanded: false, emptyMsg: "No reserved tables" },
  available: { label: "AVAILABLE", defaultExpanded: true, emptyMsg: "All tables occupied — full house!" },
  cleaning: { label: "CLEANING", defaultExpanded: false, emptyMsg: "No tables cleaning" },
}

// ── Quick action buttons logic ─────────────────────────────────────────────
function getQuickActions(table: FloorTable, waves?: Wave[]): { icon: typeof Zap; label: string; accent?: boolean }[] {
  const actions: { icon: typeof Zap; label: string; accent?: boolean }[] = []
  const foodWave = waves?.find((w) => w.type === "food")
  const dessertWave = waves?.find((w) => w.type === "dessert")

  if (foodWave?.status === "ready") {
    actions.push({ icon: Check, label: "On My Way", accent: true })
  } else if (dessertWave?.status === "held") {
    actions.push({ icon: Zap, label: "Fire Dessert", accent: true })
  } else if (table.status !== "free" && table.status !== "billing") {
    actions.push({ icon: Plus, label: "Add Items" })
  }
  if (table.status !== "free") {
    actions.push({ icon: MessageSquare, label: "Kitchen" })
  }
  actions.push({ icon: Eye, label: "View" })
  return actions
}

// ── Alert banner ───────────────────────────────────────────────────────────
function AlertBanner({ alerts }: { alerts: DetailAlert[] }) {
  if (alerts.length === 0) return null
  const alert = alerts[0]
  const bgMap: Record<string, string> = {
    urgent: "bg-red-500/10 border-red-400/20",
    warning: "bg-amber-500/10 border-amber-400/20",
    info: "bg-blue-500/10 border-blue-400/20",
  }
  const textMap: Record<string, string> = {
    urgent: "text-red-400",
    warning: "text-amber-400",
    info: "text-blue-400",
  }
  const IconMap: Record<string, typeof Flame> = {
    food_ready: Flame,
    no_checkin: AlertTriangle,
    bill_requested: CreditCard,
  }
  const Icon = IconMap[alert.type] ?? AlertTriangle

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2", bgMap[alert.severity])}>
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", textMap[alert.severity])} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[11px] font-semibold leading-tight", textMap[alert.severity])}>
          {alert.message}
        </p>
        {alert.items && alert.items.length > 0 && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/70 leading-tight truncate">
            {alert.items.join(" / ")}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Wave Progress Row ──────────────────────────────────────────────────────
function WaveProgress({ waves, compact = false }: { waves: Wave[]; compact?: boolean }) {
  if (waves.length === 0) return null

  if (compact) {
    return (
      <div className="w-full overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex items-center gap-3">
          {waves.map((w, index) => (
            <div key={`${w.type}-${index}`} className="flex items-center gap-1.5">
              <WaveBadge label={`W${index + 1}`} status={w.status} size="xs" variant="floorplan" />
              <span
                className={cn("h-1.5 w-1.5 rounded-full", waveStatusDot[w.status])}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex items-center gap-4">
        {waves.map((w, index) => (
          <div key={`${w.type}-${index}`} className="flex items-center gap-1.5">
            <WaveBadge label={`W${index + 1}`} status={w.status} size="sm" variant="floorplan" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", waveStatusDot[w.status])} />
                <span className={cn("text-[10px] font-medium", waveStatusColors[w.status])}>
                  {waveStatusLabel[w.status]}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Table Card ─────────────────────────────────────────────────────────────
const PREFETCH_INTENT_MS = 100

const TableCard = React.memo(function TableCard({
  table,
  detail,
  currentServerId,
  isOwn,
  onTap,
  onPrefetch,
  onMarkAvailable,
  onAcknowledgeService,
  cardIndex,
  sectionConfig,
}: {
  table: FloorTable
  detail: FloorMapLiveDetail | null
  currentServerId: string
  isOwn: boolean
  onTap: () => void
  onPrefetch?: () => void
  onMarkAvailable?: () => void
  onAcknowledgeService?: (requestType: "waiter" | "bill") => void
  cardIndex: number
  sectionConfig?: Record<string, { name: string }>
}) {
  const [hovered, setHovered] = useState(false)
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsed = table.seatedAt ? minutesAgo(table.seatedAt) : null
  const reserved = Boolean((table as unknown as { reserved?: boolean }).reserved)

  const waves = detail?.waves ?? []
  const alerts = detail?.alerts ?? []
  const billTotal = detail?.billTotal ?? 0
  const serverName = detail?.server?.name ?? null
  const serverIsYou = detail?.server?.id === currentServerId
  const hasDietary = detail?.seats.some((s) => s.dietary.length > 0)
  const hasSpecial = detail?.seats.some((s) => s.specialOccasion)
  const quickActions = getQuickActions(table, waves)

  const colorState = getFloorTableColorState({
    status: table.status,
    reserved,
    alerts,
    waves,
    stage: table.stage,
  })
  const cardColors = TABLE_CARD_COLOR_STATES[colorState]
  const tableColorVisual = TABLE_COLOR_STATES[colorState]
  const isUrgent = colorState === "needs_attention"
  const isIdle = !isOccupiedColorState(colorState)
  const showWaiterHandled = hasWaiterRequestAlert(table.alerts) && !!onAcknowledgeService
  const showBillHandled = hasBillRequest(table.stage) && !!onAcknowledgeService

  const viewportPrefetchRef = useViewportPrefetch(
    table.id,
    () => onPrefetch?.(),
    !!onPrefetch
  )

  const handlePointerEnter = useCallback(() => {
    setHovered(true)
    if (!onPrefetch) return
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current)
    prefetchTimerRef.current = setTimeout(() => {
      prefetchTimerRef.current = null
      onPrefetch()
    }, PREFETCH_INTENT_MS)
  }, [onPrefetch])

  const handlePointerLeave = useCallback(() => {
    setHovered(false)
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current)
      prefetchTimerRef.current = null
    }
  }, [])

  return (
    <div
      ref={viewportPrefetchRef}
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap()
        }
      }}
      onPointerDown={() => onPrefetch?.()}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "group flex flex-col rounded-xl border-l-[3px] border text-left cursor-pointer",
        "backdrop-blur-sm transition-all duration-200",
        cardColors.bgClass,
        cardColors.borderClass,
        isUrgent && "shadow-[0_0_18px_rgba(248,113,113,0.35)]",
        isOwn && "ring-1 ring-primary/15",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      style={{
        "--node-index": cardIndex,
        animationDelay: `${cardIndex * 30}ms`,
      } as React.CSSProperties}
      aria-label={`Table ${table.number}, ${sectionConfig[table.section]?.name ?? table.section}, ${table.guests} guests, ${table.status} status${billTotal > 0 ? `, bill total ${billTotal.toFixed(2)} euros` : ""}`}
    >
      {/* ── Card Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        <span
          className={cn(
            "relative flex h-2 w-2 rounded-full shrink-0",
            tableColorVisual.dotClass,
          )}
        >
          {isUrgent && (
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" />
          )}
        </span>
        <span className={cn("font-mono text-sm font-bold tracking-wide", cardColors.textClass)}>
          T{table.number}
        </span>
        {table.guests > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <Users className="h-3 w-3" />
            {table.guests}/{table.capacity}
          </span>
        )}
        {elapsed !== null && (
          <span className={cn(
            "flex items-center gap-1 font-mono text-[11px]",
            elapsed > 40 ? "text-red-400/80" : elapsed > 25 ? "text-amber-400/70" : "text-muted-foreground/60"
          )}>
            <Clock className="h-3 w-3" />
            {elapsed}m
          </span>
        )}

        {/* Badges */}
        <div className="ml-auto flex items-center gap-1.5">
          {hasDietary && (
            <NutOff className="h-3 w-3 text-amber-400/60" />
          )}
          {hasSpecial && (
            <Sparkles className="h-3 w-3 text-pink-400/60" />
          )}
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 hidden sm:inline">
            {(sectionConfig ?? defaultSectionConfig)[table.section]?.name ?? table.section}
          </span>
        </div>
      </div>

      {/* ── Alert Banner ────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="px-3.5 pb-2">
          <AlertBanner alerts={alerts} />
        </div>
      )}

      {/* ── Wave Progress ───────────────────────────────────────── */}
      {waves.length > 0 && !isIdle && (
        <div className="px-4 pb-2.5">
          {/* Compact on mobile, detailed on tablet+ */}
          <div className="sm:hidden">
            <WaveProgress waves={waves} compact />
          </div>
          <div className="hidden sm:block">
            <WaveProgress waves={waves} />
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      {showWaiterHandled && (
        <div className="border-t border-white/4 px-4 py-2.5">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
            onClick={(e) => {
              e.stopPropagation()
              onAcknowledgeService?.("waiter")
            }}
          >
            <Check className="h-3.5 w-3.5" />
            Waiter Handled
          </Button>
        </div>
      )}

      {showBillHandled && (
        <div className="border-t border-white/4 px-4 py-2.5">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-2 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
            onClick={(e) => {
              e.stopPropagation()
              onAcknowledgeService?.("bill")
            }}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Check Delivered
          </Button>
        </div>
      )}

      {colorState === "cleaning" && onMarkAvailable && (
        <div className="border-t border-white/4 px-4 py-2.5">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
            onClick={(e) => {
              e.stopPropagation()
              onMarkAvailable()
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Mark Available
          </Button>
        </div>
      )}

      {!isIdle && colorState !== "cleaning" && (
        <div className="flex items-center gap-2 border-t border-white/4 px-4 py-2.5">
          {serverName && (
            <span className="text-[11px] text-muted-foreground/60 truncate">
              {serverName}
              {serverIsYou && (
                <span className="ml-1 text-primary/70 font-medium">(You)</span>
              )}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {billTotal > 0 && (
              <span className="font-mono text-xs font-bold text-foreground/80">
                {"\u20AC"}{billTotal.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Action Buttons (Desktop hover only) ───────────── */}
      {hovered && !isIdle && (
        <div className="hidden lg:flex items-center gap-1 border-t border-white/4 px-3 py-2 animate-fade-slide-in">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 gap-1.5 rounded-lg px-2.5 text-[10px] font-medium",
                action.accent
                  ? "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/6"
              )}
              onClick={(e) => {
                e.stopPropagation()
                // Quick action handler placeholder
              }}
            >
              {action.icon && <action.icon className="h-3 w-3" />}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
})

// ── Sticky Urgent Banner (Mobile) ──────────────────────────────────────────
function UrgentBanner({
  urgentCount,
  onScrollToUrgent,
}: {
  urgentCount: number
  onScrollToUrgent: () => void
}) {
  if (urgentCount === 0) return null
  return (
    <button
      type="button"
      onClick={onScrollToUrgent}
      className={cn(
        "sticky top-0 z-20 flex w-full items-center justify-between px-4 py-2.5 sm:hidden",
        "bg-red-500/15 border-b border-red-400/20 backdrop-blur-md",
        "animate-pulse-ring",
      )}
      style={{"--glow-urgent": "0 72% 51%"} as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" />
          <span className="relative rounded-full h-2.5 w-2.5 bg-red-400" />
        </span>
        <span className="font-mono text-xs font-bold text-red-400 tracking-wider">
          {urgentCount} URGENT
        </span>
      </div>
      <span className="text-[10px] text-red-400/70 font-medium">
        View all urgent {"->"}
      </span>
    </button>
  )
}

// ── Main GridView ──────────────────────────────────────────────────────────
export function GridView({
  sectionConfig = defaultSectionConfig,
  tables,
  liveDetailByTableId,
  currentServerId,
  ownTableIds,
  onTableTap,
  onTablePrefetch,
  onMarkAvailable,
  onAcknowledgeService,
}: GridViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TableColorState>>(() => {
    const initial = new Set<TableColorState>()
    for (const s of statusOrder) {
      if (!groupConfig[s].defaultExpanded) initial.add(s)
    }
    return initial
  })
  const urgentRef = useRef<HTMLDivElement>(null)

  const grouped = useMemo(() =>
    statusOrder
      .map((status) => ({
        status,
        tables: tables
          .filter((t) => {
            const detail = liveDetailByTableId.get(t.id) ?? null
            const reserved = Boolean((t as unknown as { reserved?: boolean }).reserved)
            const colorState = getFloorTableColorState({
              status: t.status,
              reserved,
              alerts: detail?.alerts ?? [],
              waves: detail?.waves ?? [],
              stage: t.stage,
            })
            return colorState === status
          })
          .sort((a, b) => {
            // Within attention-needed, sort by oldest first (most neglected)
            if (status === "needs_attention" && a.seatedAt && b.seatedAt) {
              return new Date(a.seatedAt).getTime() - new Date(b.seatedAt).getTime()
            }
            return a.number - b.number
          }),
      })),
    [tables, liveDetailByTableId]
  )

  const urgentCount = grouped.find((g) => g.status === "needs_attention")?.tables.length ?? 0

  const toggleGroup = useCallback((status: TableColorState) => {
    // Needs-attention is always expanded
    if (status === "needs_attention") return
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }, [])

  const scrollToUrgent = useCallback(() => {
    urgentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  if (tables.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass-surface">
          <UtensilsCrossed className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="font-mono text-sm font-semibold text-foreground/80">No tables found</p>
        <p className="text-xs text-muted-foreground/60 max-w-[240px]">
          Try adjusting your filters to see more tables.
        </p>
      </div>
    )
  }

  let globalCardIndex = 0

  return (
    <div className="h-full overflow-y-auto scrollbar-none">
      {/* Mobile sticky urgent banner */}
      <UrgentBanner urgentCount={urgentCount} onScrollToUrgent={scrollToUrgent} />

      {grouped.map(({ status, tables: groupTables }) => {
        if (groupTables.length === 0 && status !== "needs_attention") return null

        const gcfg = groupConfig[status]
        const isCollapsed = collapsedGroups.has(status)
        const isUrgentGroup = status === "needs_attention"
        const visual = TABLE_COLOR_STATES[status]

        return (
          <div key={status} ref={isUrgentGroup ? urgentRef : undefined}>
            {/* Group Header */}
            <button
              type="button"
              onClick={() => toggleGroup(status)}
              className={cn(
                "sticky top-0 z-10 flex w-full items-center gap-2.5 px-4 py-2.5 md:px-6",
                "bg-background/85 backdrop-blur-md border-b border-white/4",
                "transition-colors hover:bg-white/2",
                isUrgentGroup && "cursor-default",
              )}
              aria-expanded={!isCollapsed}
              aria-label={`${gcfg.label} group, ${groupTables.length} tables`}
            >
              <span
                className={cn("h-2 w-2 rounded-full shrink-0", visual.dotClass)}
              />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
                {gcfg.label}
              </span>
              <span
                className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold"
                style={{
                  backgroundColor: `color-mix(in oklab, ${visual.fill} 22%, transparent)`,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {groupTables.length}
              </span>

              <div className="ml-2 flex-1 border-t border-white/4" />

              {!isUrgentGroup && (
                isCollapsed
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                  : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
            </button>

            {/* Cards */}
            {!isCollapsed && (
              <div className="px-3 pb-4 pt-2 md:px-5">
                {groupTables.length === 0 ? (
                  <div className="flex items-center justify-center rounded-xl glass-surface py-6 px-4">
                    <p className="text-xs text-muted-foreground/50 font-mono">
                      {gcfg.emptyMsg}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {groupTables.map((table) => {
                      const isOwn = ownTableIds.includes(table.id)
                      const idx = globalCardIndex++
                      return (
                        <TableCard
                          key={table.id}
                          table={table}
                          detail={liveDetailByTableId.get(table.id) ?? null}
                          currentServerId={currentServerId}
                          isOwn={isOwn}
                          onTap={() => onTableTap(table.id)}
                          onPrefetch={onTablePrefetch ? () => onTablePrefetch(table.id) : undefined}
                          onMarkAvailable={
                            onMarkAvailable ? () => onMarkAvailable(table.id) : undefined
                          }
                          onAcknowledgeService={
                            onAcknowledgeService
                              ? (requestType) => onAcknowledgeService(table.id, requestType)
                              : undefined
                          }
                          cardIndex={idx}
                          sectionConfig={sectionConfig}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
