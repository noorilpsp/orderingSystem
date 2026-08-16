"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { ElementRenderer } from "@/components/builder/element-renderer"
import type { PlacedElement } from "@/lib/floorplan-types"
import type { FloorTableStatus, MealStage } from "@/lib/floor-map-data"
import { minutesAgo, currentServer } from "@/lib/floor-map-data"
import { useViewportPrefetch } from "@/hooks/use-viewport-prefetch"
import type { Wave, DetailAlert } from "@/lib/table-detail-data"
import { TABLE_COLOR_STATES, getFloorTableColorState, isOccupiedColorState } from "@/lib/table-color-state"
import { WaveBadge } from "@/components/shared/wave-badges"
import { Users, Flame } from "lucide-react"
import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"

// ── Status overlay visuals for tables in view mode ──────────────────────────

export interface TableStatusInfo {
  elementId: string
  tableNumber: number
  status: FloorTableStatus
  guests: number
  capacity: number
  stage?: MealStage | null
  seatedAt?: string
  serverName?: string | null
  serverId?: string | null
   billTotal?: number
  waves?: Wave[]
  alerts?: DetailAlert[]
  /** True when free but assigned to upcoming reservation. Visual overlay only. */
  reserved?: boolean
  reservation?: { id: string; guestName: string; partySize: number; time: string }
}

// ── Props ───────────────────────────────────────────────────────────────────

interface FloorplanSceneProps {
  elements: PlacedElement[]
  mode: "edit" | "view"
  /** Table status info for view mode - maps element IDs to live table data */
  tableStatuses?: TableStatusInfo[]
  /** Current server id for "serverIsYou" styling. When provided, used instead of floor-map-data default. */
  currentServerId?: string
  /** Which table IDs are "own" (assigned to current server) */
  ownTableIds?: string[]
  /** Currently highlighted table */
  highlightedId?: string | null
  /** Dimmed table IDs (filtered out) */
  dimmedIds?: Set<string>
  /** Hidden element IDs (filtered out) */
  hiddenIds?: Set<string>
  /** Click handler for tables in view mode */
  onTableTap?: (elementId: string) => void
  /** Prefetch on pointer intent (elementId). Resolved to tableId by parent. */
  onTablePrefetch?: (elementId: string) => void
  /** Long press handler for tables in view mode */
  onTableLongPress?: (elementId: string, e: React.MouseEvent | React.TouchEvent) => void
  /** Whether entry animation has completed */
  appeared?: boolean
}

// ── Scene Component ─────────────────────────────────────────────────────────

export function FloorplanScene({
  elements,
  mode,
  tableStatuses = [],
  currentServerId: currentServerIdProp,
  ownTableIds = [],
  highlightedId,
  dimmedIds,
  hiddenIds,
  onTableTap,
  onTablePrefetch,
  onTableLongPress,
  appeared = true,
}: FloorplanSceneProps) {
  // Build a lookup map for quick status access
  const statusMap = new Map<string, TableStatusInfo>()
  for (const s of tableStatuses) {
    statusMap.set(s.elementId, s)
  }
  const effectiveCurrentServerId = currentServerIdProp ?? currentServer.id

  // Separate elements: non-tables render first (background), tables on top
  const backgroundElements = elements.filter(
    (el) => el.category !== "tables" && el.category !== "seating"
  )
  const seatingElements = elements.filter((el) => el.category === "seating")
  const tableElements = elements.filter(
    (el) => el.category === "tables" && (el.seats ?? 0) > 0
  )
  const decorativeTableElements = elements.filter(
    (el) => el.category === "tables" && (el.seats ?? 0) === 0
  )

  return (
    <>
      {/* Layer 1: Walls, fixtures, decor (non-interactive) */}
      {backgroundElements.map((el) => (
        <SceneElement
          key={el.id}
          element={el}
          mode={mode}
          currentServerId={effectiveCurrentServerId}
          appeared={appeared}
        />
      ))}

      {/* Layer 2: Decorative tables (coffee tables, etc.) */}
      {decorativeTableElements.map((el) => (
        <SceneElement
          key={el.id}
          element={el}
          mode={mode}
          currentServerId={effectiveCurrentServerId}
          appeared={appeared}
        />
      ))}

      {/* Layer 3: Seating */}
      {seatingElements.map((el) => {
        if (hiddenIds?.has(el.id)) return null
        return (
          <SceneElement
            key={el.id}
            element={el}
            mode={mode}
            statusInfo={statusMap.get(el.id)}
            currentServerId={effectiveCurrentServerId}
            isOwn={ownTableIds.includes(el.id)}
            isHighlighted={highlightedId === el.id}
            isDimmed={dimmedIds?.has(el.id)}
            onTap={onTableTap}
            onPrefetch={onTablePrefetch}
            onLongPress={onTableLongPress}
            appeared={appeared}
          />
        )
      })}

      {/* Layer 4: Tables (interactive in view mode) */}
      {tableElements.map((el) => {
        if (hiddenIds?.has(el.id)) return null
        return (
          <SceneElement
            key={el.id}
            element={el}
            mode={mode}
            statusInfo={statusMap.get(el.id)}
            currentServerId={effectiveCurrentServerId}
            isOwn={ownTableIds.includes(el.id)}
            isHighlighted={highlightedId === el.id}
            isDimmed={dimmedIds?.has(el.id)}
            onTap={onTableTap}
            onPrefetch={onTablePrefetch}
            onLongPress={onTableLongPress}
            appeared={appeared}
          />
        )
      })}
    </>
  )
}

// ── Individual Element ──────────────────────────────────────────────────────

function SceneElement({
  element,
  mode,
  statusInfo,
  currentServerId,
  isOwn,
  isHighlighted,
  isDimmed,
  onTap,
  onPrefetch,
  onLongPress,
  appeared,
}: {
  element: PlacedElement
  mode: "edit" | "view"
  statusInfo?: TableStatusInfo
  currentServerId: string
  isOwn?: boolean
  isHighlighted?: boolean
  isDimmed?: boolean
  onTap?: (id: string) => void
  onPrefetch?: (id: string) => void
  onLongPress?: (id: string, e: React.MouseEvent | React.TouchEvent) => void
  appeared?: boolean
}) {
  const isTable = element.category === "tables" && (element.seats ?? 0) > 0
  const isSeatingWithSeats = element.category === "seating" && (element.seats ?? 0) > 0
  const isInteractive = mode === "view" && (isTable || isSeatingWithSeats) && !!onTap
  const status = statusInfo?.status ?? "free"
  const colorState = statusInfo
    ? getFloorTableColorState({
        status,
        reserved: statusInfo.reserved,
        alerts: statusInfo.alerts,
        waves: statusInfo.waves,
        stage: statusInfo.stage,
      })
    : "available"
  const colorConfig = TABLE_COLOR_STATES[colorState]
  const showReservedStyle = colorState === "reserved" && !!statusInfo?.reservation

  // Long press handling
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefetchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    if (isInteractive && onPrefetch && !isDimmed) onPrefetch(element.id)
    if (!isInteractive || !onLongPress) return
    longPressTimer.current = setTimeout(() => {
      onLongPress(element.id, e as unknown as React.MouseEvent)
    }, 500)
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handlePointerEnter() {
    setIsHovered(true)
    if (!isInteractive || !onPrefetch || isDimmed) return
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current)
    prefetchTimer.current = setTimeout(() => {
      prefetchTimer.current = null
      onPrefetch(element.id)
    }, 100)
  }

  function handlePointerLeave(e: React.PointerEvent) {
    handlePointerUp()
    setIsHovered(false)
    if (prefetchTimer.current) {
      clearTimeout(prefetchTimer.current)
      prefetchTimer.current = null
    }
  }

  const Tag = isInteractive ? "button" : "div"
  const [isHovered, setIsHovered] = React.useState(false)

  const viewportPrefetchRef = useViewportPrefetch(
    element.id,
    (id) => onPrefetch?.(id),
    isInteractive && !isDimmed && !!onPrefetch
  )

  // When occupied, show only as many chairs as seated guests; when free/closed, use capacity
  const chairCountOverride =
    statusInfo && isOccupiedColorState(colorState)
      ? Math.max(1, statusInfo.guests ?? 0)
      : undefined

  return (
    <Tag
      ref={viewportPrefetchRef}
      {...(isInteractive
        ? {
            type: "button" as const,
            onClick: () => onTap?.(element.id),
            onPointerDown: handlePointerDown,
            onPointerUp: handlePointerUp,
            onPointerLeave: handlePointerLeave,
            onPointerEnter: handlePointerEnter,
            "aria-label": showReservedStyle && statusInfo?.reservation
              ? `Table ${statusInfo.tableNumber}, reserved for ${statusInfo.reservation.guestName} at ${statusInfo.reservation.time}`
              : `Table ${statusInfo?.tableNumber ?? ""}, ${colorConfig.label.toLowerCase()}${statusInfo?.guests ? `, ${statusInfo.guests} guests` : ""}`,
            title: showReservedStyle && statusInfo?.reservation
              ? `Reserved for ${statusInfo.reservation.guestName} at ${statusInfo.reservation.time}`
              : undefined,
          }
        : {
            "aria-hidden": true as const,
          })}
      className={cn(
        "absolute",
        // Interactive table styling
        isInteractive && [
          "ring-[2.5px] transition-all duration-200 gpu-layer",
          colorConfig.ringClass,
          colorConfig.pulse && "animate-pulse-ring",
          isDimmed && "opacity-15 pointer-events-none",
          isOwn && !isDimmed && "ring-offset-2 ring-offset-background ring-primary/50",
          isHighlighted && "animate-highlight-pulse",
          !isDimmed && "cursor-pointer",
          !appeared && "animate-node-appear",
        ],
        // Non-interactive elements
        !isInteractive && "pointer-events-none",
        // Shape-based border radius
        element.shape === "circle" && "rounded-full",
        element.shape === "ellipse" && "rounded-full",
        element.shape === "rect" && "rounded-md",
      )}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotation}deg) scale(${isInteractive && !isDimmed && isHovered ? 1.12 : 1})`,
        opacity: isDimmed ? 0.15 : element.opacity,
        filter: isInteractive && !isDimmed ? `brightness(${isHovered ? 1.45 : 1.3})` : undefined,
        boxShadow: isInteractive && !isDimmed
          ? colorConfig.glow
          : undefined,
        zIndex: isTable ? 10 : isSeatingWithSeats ? 5 : 1,
      }}
    >
      {/* The actual SVG element rendering - tinted by status in view mode */}
      <ElementRenderer
        element={element}
        width={element.width}
        height={element.height}
        colorOverride={isInteractive && statusInfo
          ? colorConfig.fill
          : undefined}
        chairCountOverride={chairCountOverride}
      />

      {/* Rich status overlay (view mode only) */}
      {isInteractive && statusInfo && !isDimmed && (
        <RichTableOverlay
          element={element}
          statusInfo={statusInfo}
          currentServerId={currentServerId}
        />
      )}
    </Tag>
  )
}

// ── Status Colors ───────────────────────────────────────────────────────────

// ── Effective usable dimensions after rotation & shape ──────────────────────

function getUsableDims(w: number, h: number, rotation: number, isRound: boolean) {
  // After rotation, the bounding box stays the same but the
  // visible content area effectively swaps major/minor axis.
  const rad = ((rotation % 180) * Math.PI) / 180
  const s = Math.abs(Math.sin(rad))
  const c = Math.abs(Math.cos(rad))
  let effW = w * c + h * s
  let effH = w * s + h * c

  // Round shapes: inscribe a rectangle inside the ellipse (factor ~0.7)
  if (isRound) {
    effW *= 0.7
    effH *= 0.7
  }

  return { effW, effH }
}

// ── Rich Table Overlay ──────────────────────────────────────────────────────

function RichTableOverlay({
  element,
  statusInfo,
  currentServerId,
}: {
  element: PlacedElement
  statusInfo: TableStatusInfo
  currentServerId: string
}) {
  const { formatMoney } = useMerchantLocalization()
  const { width: w, height: h, rotation, shape } = element
  const colorState = getFloorTableColorState({
    status: statusInfo.status,
    reserved: statusInfo.reserved,
    alerts: statusInfo.alerts,
    waves: statusInfo.waves,
    stage: statusInfo.stage,
  })
  const colorConfig = TABLE_COLOR_STATES[colorState]
  const isIdleTable =
    colorState === "available" || colorState === "reserved" || colorState === "cleaning"
  const elapsed = statusInfo.seatedAt ? minutesAgo(statusInfo.seatedAt) : null
  const billTotal = typeof statusInfo.billTotal === "number" ? statusInfo.billTotal : 0
  const waves = statusInfo.waves ?? []
  const alerts = statusInfo.alerts ?? []
  const hasAlert = alerts.length > 0
  const serverIsYou = statusInfo.serverId === currentServerId
  const isRound = shape === "circle" || shape === "ellipse"

  // Compute usable content area after rotation and shape constraints
  const { effW, effH } = getUsableDims(w, h, rotation, isRound)
  const minDim = Math.min(effW, effH)
  const maxDim = Math.max(effW, effH)
  const area = effW * effH

  // Counter-rotate so text is always upright
  const counterRotation = rotation !== 0 ? -rotation : 0

  // ── All sizes are proportional to usable space ──────────────────────
  const unit = minDim / 10 // base unit: 1/10th of smallest dimension
  const numFont = Math.max(8, Math.min(18, unit * 2.2))
  const subFont = Math.max(6, Math.min(12, unit * 1.4))
  const microFont = Math.max(5, Math.min(10, unit * 1.1))
  const iconSize = Math.max(6, Math.min(14, unit * 1.5))
  const gap = Math.max(1, Math.min(6, unit * 0.5))
  const pad = isRound ? Math.max(4, minDim * 0.14) : Math.max(2, unit * 0.4)

  // Decide what fits: progressively add info layers
  const showGuests = minDim > 40
  const showTimer = !isIdleTable && elapsed !== null && minDim > 35
  const showBill = billTotal > 0 && !isIdleTable && minDim > 40
  const showWaves = area > 5500 && waves.length > 0 && !isIdleTable
  const showAlert = hasAlert && minDim > 35
  const showServer = minDim > 65 && statusInfo.serverName && !isIdleTable
  const showAlertText = showAlert && area > 7000

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]"
      style={{ padding: pad }}>
      <div
        style={{ transform: `rotate(${counterRotation}deg)`, gap }}
        className="flex h-full w-full flex-col items-center justify-center"
      >
        {/* Row 1: table label + guests/capacity */}
        <div className="flex items-center" style={{ gap: gap * 0.6 }}>
          <span
            className={cn(
              "font-mono font-bold drop-shadow-lg leading-none",
              colorConfig.textClass,
            )}
            style={{ fontSize: numFont }}
          >
            T{statusInfo.tableNumber}
          </span>
          {showGuests && (
            <div className="flex items-center" style={{ gap: gap * 0.3 }}>
              <Users
                className="text-white/40 shrink-0"
                style={{ width: iconSize * 0.8, height: iconSize * 0.8 }}
              />
              <span
                className="font-mono text-white/50 leading-none"
                style={{ fontSize: microFont }}
              >
                {isIdleTable && colorState !== "available"
                  ? colorState === "reserved"
                    ? "Reserved"
                    : colorState === "cleaning"
                      ? "Cleaning"
                      : `${statusInfo.capacity}p`
                  : `${statusInfo.guests}/${statusInfo.capacity}`}
              </span>
            </div>
          )}
        </div>

        {/* Row 2: server name */}
        {showServer && (
          <span
            className={cn(
              "font-mono truncate leading-none",
              serverIsYou ? "text-primary/80 font-bold" : "text-white/25",
            )}
            style={{ fontSize: microFont, maxWidth: effW * 0.9 }}
          >
            {serverIsYou ? "YOU" : statusInfo.serverName}
          </span>
        )}

        {/* Row 3: waves (horizontal scroll, no wrap) */}
        {showWaves && (
          <div className="mt-0.5 w-full overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="flex items-center justify-center"
              style={{ gap: gap * 0.55 }}
            >
              {waves.slice(0, 6).map((wv, index) => (
                <WaveBadge
                  key={`${wv.type}-${index}`}
                  label={`W${index + 1}`}
                  status={wv.status}
                  size="xs"
                  variant="floorplan"
                  className="shadow-[0_0_10px_rgba(15,23,42,0.16)]"
                />
              ))}
            </div>
          </div>
        )}

        {/* Row 4: time seated + bill */}
        {(showTimer || showBill) && (
          <div className="flex items-center gap-2">
            {showTimer && elapsed !== null && (
              <span
                className={cn(
                  "font-mono leading-none",
                  elapsed > 40
                    ? "text-red-400"
                    : elapsed > 25
                      ? "text-amber-400/70"
                      : "text-white/30",
                )}
                style={{ fontSize: microFont }}
              >
                {elapsed}m
              </span>
            )}
            {showBill && (
              <span
                className="font-mono leading-none text-white/70"
                style={{ fontSize: microFont }}
              >
                {formatMoney(billTotal)}
              </span>
            )}
          </div>
        )}

        {/* Alert icon (bottom, minimal) */}
        {showAlert && (
          <div className="flex items-center" style={{ gap: gap * 0.4 }}>
            <Flame
              className="text-red-400 animate-pulse shrink-0"
              style={{ width: iconSize, height: iconSize }}
            />
            {showAlertText && (
              <span
                className="font-mono font-bold text-red-400 uppercase tracking-wider leading-none"
                style={{ fontSize: microFont }}
              >
                {alerts[0].type === "food_ready" ? "READY" : "ALERT"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
