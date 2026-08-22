"use client"

import { useState } from "react"
import { CalendarDays, Clock, Info, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  getDurationForParty,
  formatDuration,
  getCapacityAtTime,
  isTimeSlotGloballyViable,
} from "@/lib/reservation-form-data"
import type { Reservation } from "@/lib/reservations-data"
import type { ReservationZone } from "@/lib/reservations/zones"

interface FormBookingDetailsProps {
  date: string
  time: string
  partySize: number
  duration: number
  durationMax?: number
  allTimes?: string[]
  availableTimes?: string[]
  tableSeatLimit?: number
  tableSeatLabel?: string
  zonePreference: string
  zones?: ReservationZone[]
  fitContextLabel?: string
  timeFitByTime?: Record<string, { tone: "open" | "busy" | "tight" | "short" | "full" | "closed"; label: string; available: number; total: number; ratio: number; maxDurationMinutes?: number }>
  totalSeats?: number
  /** Store/API reservations for the location; drives capacity for the selected date. */
  reservations?: Reservation[]
  /** False when a table is assigned and its continuous free window is shorter than `duration`. */
  selectedTableFitsDuration?: boolean
  /** Set when placement has a concrete table (auto or manual). */
  assignedTableId?: string | null
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onPartySizeChange: (size: number) => void
  onDurationChange: (duration: number) => void
  onZonePreferenceChange: (zone: string) => void
}

const PAST_SLOT_GRACE_MINUTES = 8

function formatTimeLabel(time24: string): string {
  const [h, m] = time24.split(":").map(Number)
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const suffix = h >= 12 ? "PM" : "AM"
  return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`
}

function toMinutes(timeValue: string): number {
  const raw = timeValue.trim()
  if (!raw) return Number.NaN

  const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (match12) {
    let h = Number.parseInt(match12[1], 10)
    const m = Number.parseInt(match12[2], 10)
    if (h < 1 || h > 12 || m < 0 || m > 59) return Number.NaN
    const meridiem = match12[3].toUpperCase()
    if (meridiem === "AM") h = h % 12
    else h = (h % 12) + 12
    return h * 60 + m
  }

  const match24 = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match24) return Number.NaN
  const h = Number.parseInt(match24[1], 10)
  const m = Number.parseInt(match24[2], 10)
  if (h === 24 && m === 0) return 24 * 60
  if (h < 0 || h > 23 || m < 0 || m > 59) return Number.NaN
  return h * 60 + m
}

function normalizeTime24(timeValue: string): string {
  const minutes = toMinutes(timeValue)
  if (!Number.isFinite(minutes)) return timeValue
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(normalized / 60).toString().padStart(2, "0")
  const m = (normalized % 60).toString().padStart(2, "0")
  return `${h}:${m}`
}

/**
 * Time dropdown dot colors (global layer - not the assigned table):
 * - Emerald + "open" / fit label: global table-fit is favorable (or capacity <70% if fit data missing).
 * - Amber / red: capacity pressure bands (70%+ / 90%+).
 * - Violet + short label: some tables work but not for full `duration` (partial window).
 * - Zinc: no global fit at this slot (disabled row).
 */
function getPressureTone(
  time24: string,
  totalSeats?: number,
  selectedDate?: string,
  reservations?: Reservation[]
): {
  itemClass: string
  dotClass: string
  pressureLabel: string | null
} {
  const cap = getCapacityAtTime(time24, {
    totalSeats,
    selectedDate,
    reservations,
  })
  if (!cap) {
    return {
      itemClass: "text-muted-foreground",
      dotClass: "bg-muted-foreground/50",
      pressureLabel: null,
    }
  }
  if (cap.occupancyPct >= 90) {
    return {
      itemClass: "text-red-300",
      dotClass: "bg-red-400",
      pressureLabel: `${cap.occupancyPct}%`,
    }
  }
  if (cap.occupancyPct >= 70) {
    return {
      itemClass: "text-amber-300",
      dotClass: "bg-amber-400",
      pressureLabel: `${cap.occupancyPct}%`,
    }
  }
  return {
    itemClass: "text-emerald-300",
    dotClass: "bg-emerald-400",
    pressureLabel: `${cap.occupancyPct}%`,
  }
}

function getFitTone(snapshot: { tone: "open" | "busy" | "tight" | "short" | "full" | "closed"; label: string }): {
  itemClass: string
  dotClass: string
  pressureLabel: string | null
} {
  if (snapshot.tone === "short") {
    return {
      itemClass: "text-violet-300",
      dotClass: "bg-violet-400",
      pressureLabel: snapshot.label,
    }
  }
  if (snapshot.tone === "full" || snapshot.tone === "closed") {
    return {
      itemClass: "text-zinc-400",
      dotClass: "bg-zinc-500/90",
      pressureLabel: snapshot.label,
    }
  }
  if (snapshot.tone === "tight") {
    return {
      itemClass: "text-red-300",
      dotClass: "bg-red-400",
      pressureLabel: snapshot.label,
    }
  }
  if (snapshot.tone === "busy") {
    return {
      itemClass: "text-amber-300",
      dotClass: "bg-amber-400",
      pressureLabel: snapshot.label,
    }
  }
  return {
    itemClass: "text-emerald-300",
    dotClass: "bg-emerald-400",
    pressureLabel: snapshot.label,
  }
}

export function FormBookingDetails({
  date,
  time,
  partySize,
  duration,
  durationMax,
  allTimes = [],
  availableTimes = [],
  tableSeatLimit,
  tableSeatLabel,
  zonePreference,
  zones = [],
  fitContextLabel,
  timeFitByTime = {},
  totalSeats,
  reservations: reservationsProp,
  selectedTableFitsDuration = true,
  assignedTableId = null,
  onDateChange,
  onTimeChange,
  onPartySizeChange,
  onDurationChange,
  onZonePreferenceChange,
}: FormBookingDetailsProps) {
  const [calOpen, setCalOpen] = useState(false)
  const normalizedTime = normalizeTime24(time)
  const todayStart = (() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  })()
  const selectedDateStart = (() => {
    const parsed = new Date(`${date}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return null
    parsed.setHours(0, 0, 0, 0)
    return parsed
  })()
  const isPastDate = selectedDateStart !== null && selectedDateStart < todayStart
  const isToday = (() => {
    const parsed = new Date(`${date}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return false
    const now = new Date()
    return (
      parsed.getFullYear() === now.getFullYear()
      && parsed.getMonth() === now.getMonth()
      && parsed.getDate() === now.getDate()
    )
  })()
  const nowMinutes = (() => {
    if (!isToday) return null
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })()
  const autoDuration = getDurationForParty(partySize)
  const isCustomDuration = duration !== autoDuration
  const reservations = reservationsProp ?? []
  const capacity = getCapacityAtTime(normalizedTime, {
    totalSeats,
    selectedDate: date,
    reservations,
  })
  const renderedTimeSlots = (() => {
    if (isPastDate) return []
    const base = (allTimes.length > 0 ? allTimes : availableTimes).map(normalizeTime24)
    const deduped = [...new Set(base)]
      .filter(Boolean)
      .filter((value) => Number.isFinite(toMinutes(value)))
      .sort((a, b) => {
        const aMin = toMinutes(a)
        const bMin = toMinutes(b)
        return aMin - bMin
      })
    if (deduped.length === 0) return [normalizedTime]
    if (deduped.includes(normalizedTime)) return deduped
    return [...new Set([normalizedTime, ...deduped])].sort((a, b) => {
      const aMin = toMinutes(a)
      const bMin = toMinutes(b)
      return aMin - bMin
    })
  })()
  const timeSelectDisabled = isPastDate || renderedTimeSlots.length === 0
  const durationOptions = (() => {
    const baseOptions = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
    if (!durationMax) return baseOptions
    const snappedMax = Math.max(15, Math.floor(durationMax / 15) * 15)
    const stepped = Array.from({ length: Math.floor(snappedMax / 15) }, (_, i) => (i + 1) * 15)
    return stepped.length > 0 ? stepped : [15]
  })()
  const selectedFit = timeFitByTime[normalizedTime]

  const dateObj = date ? new Date(date + "T12:00:00") : new Date()
  const dateLabel = dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const partySizes = [1, 2, 3, 4, 5, 6]
  const [showLargeParty, setShowLargeParty] = useState(partySize > 6)
  const partySizeSection = (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
        Party Size <span className="text-red-400">*</span>
      </label>
      {!showLargeParty ? (
        <div className="flex gap-1">
          {partySizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onPartySizeChange(s)
                onDurationChange(getDurationForParty(s))
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                tableSeatLimit && s > tableSeatLimit
                  ? partySize === s
                    ? "bg-zinc-800/90 text-zinc-300 ring-1 ring-zinc-600/70"
                    : "bg-zinc-900/60 text-zinc-500 ring-1 ring-zinc-800/80 hover:bg-zinc-900/80"
                  : tableSeatLimit
                  ? partySize === s
                    ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/60 shadow-md shadow-amber-900/20"
                    : "bg-amber-500/10 text-amber-300/90 ring-1 ring-amber-500/40 hover:bg-amber-500/15"
                  : partySize === s
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              aria-pressed={partySize === s}
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setShowLargeParty(true)
              onPartySizeChange(7)
              onDurationChange(getDurationForParty(7))
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tableSeatLimit && tableSeatLimit < 7
                ? partySize > 6
                  ? "bg-zinc-800/90 text-zinc-300 ring-1 ring-zinc-600/70"
                  : "bg-zinc-900/60 text-zinc-500 ring-1 ring-zinc-800/80 hover:bg-zinc-900/80"
                : tableSeatLimit
                ? partySize > 6
                  ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/60 shadow-md shadow-amber-900/20"
                  : "bg-amber-500/10 text-amber-300/90 ring-1 ring-amber-500/40 hover:bg-amber-500/15"
                : partySize > 6
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            7+
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const next = Math.max(1, partySize - 1)
              if (next <= 6) {
                setShowLargeParty(false)
              }
              onPartySizeChange(next)
              onDurationChange(getDurationForParty(next))
            }}
            className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Decrease party size"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center w-16 py-2 rounded-lg bg-primary/10 border border-primary/30 text-lg font-semibold text-primary">
            {partySize}
          </div>
          <button
            type="button"
            onClick={() => {
              const next = partySize + 1
              onPartySizeChange(next)
              onDurationChange(getDurationForParty(next))
            }}
            className={`p-2 rounded-lg transition-colors ${
              tableSeatLimit && partySize + 1 > tableSeatLimit
                ? "bg-zinc-900/60 text-zinc-500 hover:bg-zinc-900/80"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            aria-label="Increase party size"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLargeParty(false)
              onPartySizeChange(4)
              onDurationChange(getDurationForParty(4))
            }}
            className="text-xs text-muted-foreground hover:text-foreground ml-2 underline underline-offset-2"
          >
            Back to 1-6
          </button>
        </div>
      )}
      {tableSeatLimit && partySize > 2 && (
        <p className="mt-1.5 text-[11px] text-amber-300/90">
          {tableSeatLabel ?? "Selected table"} fits {tableSeatLimit}p.
        </p>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      {partySizeSection}

      {/* Zone preference */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
          Zone Preference
        </label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[{ id: "any", label: "No Pref" }, ...zones.map((z) => ({ id: z.id, label: z.name }))].map((zone) => (
            <button
              key={zone.id}
              type="button"
              onClick={() => onZonePreferenceChange(zone.id)}
              className={`h-8 rounded-md border text-xs font-medium transition-all ${
                zonePreference === zone.id
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/60 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {zone.label}
            </button>
          ))}
        </div>
        {fitContextLabel && (
          <p className="text-[10px] text-muted-foreground">
            {fitContextLabel}
          </p>
        )}
      </div>

      {/* Duration */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Duration
            {!isCustomDuration && <span className="ml-1.5 text-muted-foreground/60">(auto)</span>}
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p>Based on party of {partySize}: {formatDuration(autoDuration)}</p>
                <p className="text-muted-foreground mt-1">1-2 guests: 1h 15min, 3-4: 1h 30min, 5-6: 1h 45min, 7+: 2h</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          value={duration.toString()}
          onValueChange={(v) => onDurationChange(parseInt(v))}
        >
          <SelectTrigger className="h-10 w-full bg-secondary/50 border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {durationOptions.map((m) => (
              <SelectItem key={m} value={m.toString()}>
                {formatDuration(m)}
                {m === autoDuration && <span className="text-muted-foreground ml-1">(recommended)</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Date <span className="text-red-400">*</span>
          </label>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start bg-secondary/50 border-border/60 hover:bg-secondary/80 text-left font-normal"
              >
                <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateObj}
                disabled={(candidateDate) => {
                  const normalized = new Date(candidateDate)
                  normalized.setHours(0, 0, 0, 0)
                  return normalized < todayStart
                }}
                onSelect={(d) => {
                  if (d) {
                    const normalized = new Date(d)
                    normalized.setHours(0, 0, 0, 0)
                    if (normalized < todayStart) return
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                    onDateChange(iso)
                  }
                  setCalOpen(false)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Time <span className="text-red-400">*</span>
          </label>
          <Select value={timeSelectDisabled ? undefined : normalizedTime} onValueChange={onTimeChange}>
            <SelectTrigger
              className="h-10 w-full bg-secondary/50 border-border/60"
              disabled={timeSelectDisabled}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={isPastDate ? "Past date (no times)" : "No times available"} />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {renderedTimeSlots.map((slotTime) => {
                const slotKey = normalizeTime24(slotTime)
                const slotFit = timeFitByTime[slotKey] ?? timeFitByTime[slotTime]
                const isCurrentSlot = slotKey === normalizedTime
                const globallyOk = isTimeSlotGloballyViable(slotFit)
                const isSelectable = globallyOk || isCurrentSlot
                const isShortFit = slotFit?.tone === "short" && !isCurrentSlot
                const isUnavailable = !isSelectable && !isShortFit
                const isDisabled = isUnavailable || isShortFit
                const slotMinutes = toMinutes(slotKey)
                const startedAgoMinutes = (
                  nowMinutes !== null
                  && Number.isFinite(slotMinutes)
                  && nowMinutes > slotMinutes
                  && nowMinutes - slotMinutes <= PAST_SLOT_GRACE_MINUTES
                )
                  ? nowMinutes - slotMinutes
                  : null
                const tone = isUnavailable
                  ? {
                      itemClass: "text-muted-foreground",
                      dotClass: "bg-zinc-500/80",
                      pressureLabel: null,
                    }
                  : (() => {
                      if (isShortFit && slotFit) return getFitTone(slotFit)
                      if (slotFit) return getFitTone(slotFit)
                      const base = getPressureTone(slotKey, totalSeats, date, reservations)
                      if (base.pressureLabel) return base
                      // If no capacity snapshot exists for this time, treat open slots as low pressure.
                      return {
                        itemClass: "text-emerald-300",
                        dotClass: "bg-emerald-400",
                        pressureLabel: "open",
                      }
                    })()
                return (
                <SelectItem
                  key={slotTime}
                  value={slotTime}
                  disabled={isDisabled}
                  className={
                    isUnavailable
                      ? "text-muted-foreground data-[disabled]:opacity-50"
                      : isShortFit
                        ? `${tone.itemClass} data-[disabled]:opacity-90`
                        : tone.itemClass
                  }
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isUnavailable ? "bg-zinc-500/80" : tone.dotClass
                      }`}
                    />
                    <span>{formatTimeLabel(slotTime)}</span>
                    {isUnavailable ? (
                      <span className="ml-1 text-[10px] text-muted-foreground">(unavailable)</span>
                    ) : isShortFit ? (
                      <span className="ml-1 text-[10px] text-violet-300/90">
                        ({slotFit?.label ?? "fit"}{typeof slotFit?.maxDurationMinutes === "number" ? ` · ${slotFit.maxDurationMinutes}m max` : ""})
                      </span>
                    ) : startedAgoMinutes !== null ? (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        (started {startedAgoMinutes}m ago)
                      </span>
                    ) : tone.pressureLabel && (
                      <span className="ml-1 text-[10px] text-muted-foreground">{tone.pressureLabel}</span>
                    )}
                  </div>
                </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {isPastDate && (
            <p className="mt-1.5 text-[10px] text-amber-300/90">
              Past dates cannot be booked.
            </p>
          )}
          {!isPastDate && assignedTableId && !selectedTableFitsDuration && (
            <p className="mt-1.5 text-[10px] text-amber-300/90">
              Selected table may not fit the full stay at this time - shorten duration, change time, or pick another table.
            </p>
          )}
          {(capacity || selectedFit) && (
            <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
              {capacity && (
                <div className="flex items-center gap-1">
                  <span className="w-6 text-right text-[10px] font-medium text-muted-foreground">Cap:</span>
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        capacity.occupancyPct >= 90
                          ? "bg-red-500"
                          : capacity.occupancyPct >= 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${capacity.occupancyPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {capacity.occupancyPct}%
                  </span>
                </div>
              )}
              {selectedFit && (
                <div className="flex items-center gap-1">
                  <span className="w-6 text-right text-[10px] font-medium text-muted-foreground">Fit:</span>
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedFit.tone === "open"
                          ? "bg-emerald-500"
                          : selectedFit.tone === "busy"
                          ? "bg-amber-500"
                          : selectedFit.tone === "tight"
                          ? "bg-red-500"
                          : selectedFit.tone === "short"
                          ? "bg-violet-500"
                          : "bg-zinc-500"
                      }`}
                      style={{
                        width: `${
                          selectedFit.tone === "short" && typeof selectedFit.maxDurationMinutes === "number" && duration > 0
                            ? Math.max(5, Math.round((selectedFit.maxDurationMinutes / duration) * 100))
                            : Math.max(5, Math.round(selectedFit.ratio * 100))
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {selectedFit.tone === "short"
                      ? selectedFit.label
                      : `${selectedFit.available}/${selectedFit.total}`
                    }
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
