"use client"

import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import React from "react"

import { CheckCircle2, Edit3, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TABLE_COLOR_STATES, getTableDetailColorState } from "@/lib/table-color-state"
import type { Seat, TableStatus } from "@/lib/table-data"
import { dietaryIcons, getSeatTotal } from "@/lib/table-data"

interface TableVisualProps {
  tableNumber: number
  capacity?: number
  seats: Seat[]
  selectedSeat: number | null
  onSelectSeat: (seatNumber: number | null) => void
  status?: TableStatus
  onAddItemsForSeat?: (seatNumber: number) => void
  waiterRequested?: boolean
  onAcknowledgeWaiter?: () => void
  waiterAckPending?: boolean
}

function SeatBadge({
  seat,
  isSelected,
  onClick,
  style,
}: {
  seat: Seat
  isSelected: boolean
  onClick: () => void
  style?: React.CSSProperties
}) {
  const hasDietary = seat.dietary.length > 0
  const hasNotes = seat.notes.length > 0
  const hasReady = seat.items.some((i) => i.status === "ready")

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200 md:h-14 md:w-14 md:text-base",
        "border border-slate-300/55 bg-[radial-gradient(circle_at_30%_20%,rgba(248,250,252,0.94)_0%,rgba(226,232,240,0.86)_35%,rgba(148,163,184,0.62)_66%,rgba(51,65,85,0.45)_100%)] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),inset_0_-8px_12px_rgba(15,23,42,0.28),0_8px_16px_rgba(15,23,42,0.22)]",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-card shadow-[0_0_20px_rgba(56,189,248,0.45)] scale-110",
        !isSelected && "hover:scale-105 hover:brightness-105",
        hasReady && !isSelected && "animate-seat-ready-pulse"
      )}
      style={style}
      aria-label={`Seat ${seat.number}`}
    >
      <>
        <span className="pointer-events-none absolute inset-[2px] rounded-full border border-slate-200/45" />
        <span className="pointer-events-none absolute left-1/2 top-[3px] h-[5px] w-8 -translate-x-1/2 rounded-full bg-white/72 blur-[0.35px] md:w-9" />
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 h-[4px] w-7 -translate-x-1/2 rounded-full bg-slate-900/28 blur-[0.45px] md:w-8" />
      </>
      {seat.number}
      {(hasDietary || hasNotes) && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center text-[10px]">
          {hasDietary
            ? seat.dietary.map((d) => dietaryIcons[d] || "").join("")
            : ""}
          {hasNotes && !hasDietary ? "\u{1F4DD}" : ""}
        </span>
      )}
    </button>
  )
}

export function TableVisual({
  tableNumber,
  capacity,
  seats,
  selectedSeat,
  onSelectSeat,
  status = "seated",
  onAddItemsForSeat,
  waiterRequested = false,
  onAcknowledgeWaiter,
  waiterAckPending = false,
}: TableVisualProps) {
  const { formatMoney } = useMerchantLocalization()
  const selected = seats.find((s) => s.number === selectedSeat)
  const colorConfig = TABLE_COLOR_STATES[getTableDetailColorState(status)]
  const isTableSelected = selectedSeat === null
  const seatCapacity = capacity ?? seats.length

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop / Tablet: Table shape with seats around it */}
      <div className="hidden md:flex flex-col items-center gap-3 -mt-4">
        <div className="relative flex flex-col items-center gap-3 px-8 pb-4 pt-0">
          {/* Top seats */}
          <div className="flex items-center gap-7">
            {seats.filter((_, i) => i % 2 === 1).map((seat, i) => (
              <SeatBadge
                key={seat.number}
                seat={seat}
                isSelected={selectedSeat === seat.number}
                onClick={() =>
                  onSelectSeat(selectedSeat === seat.number ? null : seat.number)
                }
                style={{ animationDelay: `${(i + 1) * 80}ms` }}
              />
            ))}
          </div>

          {/* Table surface */}
          <div className="relative w-60">
            <button
              type="button"
              onClick={() => onSelectSeat(null)}
              className={cn(
                "relative z-0 isolate flex h-28 w-60 cursor-pointer items-center justify-center overflow-visible rounded-xl border-2 transition-all duration-300 hover:brightness-110",
                isTableSelected && "ring-2 ring-primary ring-offset-2 ring-offset-card scale-[1.02]"
              )}
              style={{
                backgroundColor: colorConfig.fill,
                backgroundImage:
                  "linear-gradient(165deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 38%, rgba(15,23,42,0.22) 100%), radial-gradient(120% 90% at 18% 16%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 48%)",
                borderColor: "rgba(255,255,255,0.18)",
                filter: "brightness(1.1)",
                boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 7px 16px rgba(2,6,23,0.3), ${colorConfig.glow}, inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -10px 14px rgba(2,6,23,0.24)`,
              }}
            >
              <span
                className="pointer-events-none absolute -inset-3 -z-10 rounded-[16px] animate-table-aura"
                style={{ backgroundColor: colorConfig.fill, filter: "blur(11px)" }}
              />
              <span className="pointer-events-none absolute inset-[3px] rounded-[10px] border border-white/7" />
              <span className="pointer-events-none absolute left-1/2 top-2 h-2 w-40 -translate-x-1/2 rounded-full bg-white/8 blur-[0.8px]" />
              <span className={cn("relative z-10 flex flex-col items-center gap-0.5", colorConfig.textClass)}>
                <span className="text-xl font-bold tracking-[0.08em] drop-shadow-[0_1px_6px_rgba(2,6,23,0.55)]">
                  {"T-"}
                  {tableNumber}
                </span>
                {seatCapacity > 0 && (
                  <span className="text-[11px] font-medium tracking-wide opacity-80">
                    {seatCapacity} {seatCapacity === 1 ? "seat" : "seats"}
                  </span>
                )}
              </span>
            </button>
            {waiterRequested && onAcknowledgeWaiter && (
              <div className="absolute inset-x-2 bottom-2 z-20">
                <Button
                  type="button"
                  size="sm"
                  disabled={waiterAckPending}
                  className="h-7 w-full gap-1 rounded-lg bg-emerald-400 text-[11px] font-semibold text-black shadow-lg hover:bg-emerald-300 disabled:opacity-60"
                  onClick={(event) => {
                    event.stopPropagation()
                    onAcknowledgeWaiter()
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {waiterAckPending ? "Saving…" : "Handled"}
                </Button>
              </div>
            )}
          </div>

          {/* Bottom seats */}
          <div className="flex items-center gap-7">
            {seats.filter((_, i) => i % 2 === 0).map((seat, i) => (
              <SeatBadge
                key={seat.number}
                seat={seat}
                isSelected={selectedSeat === seat.number}
                onClick={() =>
                  onSelectSeat(selectedSeat === seat.number ? null : seat.number)
                }
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: Horizontal seat strip */}
      <div className="flex gap-2 overflow-x-auto px-1 py-2 md:hidden">
        {seats.map((seat) => (
          <button
            key={seat.number}
            type="button"
            onClick={() =>
              onSelectSeat(selectedSeat === seat.number ? null : seat.number)
            }
            className={cn(
              "relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-4 py-2.5 transition-all duration-200",
              selectedSeat === seat.number
                ? "bg-primary/10 ring-2 ring-primary"
                : "bg-card hover:bg-secondary",
              seat.items.some((i) => i.status === "ready") &&
                selectedSeat !== seat.number &&
                "animate-seat-ready-pulse"
            )}
          >
            <span className="text-sm font-semibold text-foreground">{seat.number}</span>
            {seat.dietary.length > 0 && (
              <span className="text-[10px]">
                {seat.dietary.map((d) => dietaryIcons[d] || "").join("")}
              </span>
            )}
            {seat.notes.length > 0 && seat.dietary.length === 0 && (
              <span className="text-[10px]">{"\u{1F4DD}"}</span>
            )}
            {/* Item dots */}
            {seat.items.length > 0 && (
              <div className="flex gap-0.5">
                {seat.items.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      item.status === "served" && "bg-emerald-500",
                      item.status === "cooking" && "bg-amber-500",
                      item.status === "ready" && "bg-red-500",
                      item.status === "held" && "bg-muted-foreground/40",
                      item.status === "sent" && "bg-blue-500",
                      item.status === "void" && "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Seat detail (when selected) */}
      {selected && (
        <div className="animate-fade-slide-in rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Seat {selected.number}
            </h3>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
              <Edit3 className="h-3 w-3" />
              Edit
            </Button>
          </div>
          <div className="mt-2 space-y-1">
            {selected.dietary.map((d) => (
              <p key={d} className="text-sm text-foreground">
                {dietaryIcons[d]} {d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
            ))}
            {selected.notes.map((n) => (
              <p key={n} className="text-sm text-muted-foreground">
                {"\u{1F4DD}"} {`"${n}"`}
              </p>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {"Ordered: "}
            {selected.items.length}
            {" items"}
            {" \u00B7 "}
            {formatMoney(getSeatTotal(selected))}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 text-xs bg-transparent"
            onClick={() => onAddItemsForSeat?.(selected.number)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Items for Seat {selected.number}
          </Button>
        </div>
      )}
    </div>
  )
}
