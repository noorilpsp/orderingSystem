"use client"

import { useMemo } from "react"
import { Trophy, Check } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type TableAssignMode,
  type AvailableTable,
  type ReservationServicePeriodLike,
  computeManualTableOpeningFromContinuousWindow,
} from "@/lib/reservation-form-data"
import type { TableLane } from "@/lib/timeline-data"
import { getZonesFromTableLanes } from "@/lib/reservations/zones"
import type { Reservation } from "@/lib/reservations-data"

interface FormTableAssignmentProps {
  tableLanes?: TableLane[]
  zoneLabels?: Readonly<Record<string, string>>
  mode: TableAssignMode
  assignedTable: string | null
  zonePreference: string
  partySize: number
  selectedTime: string
  duration: number
  /** ISO date YYYY-MM-DD for reservation day - blocks use store/API reservations for this day only. */
  selectedDate: string
  reservations: Reservation[]
  /** Same service window as global fit / best table (continuous-window parity). */
  servicePeriodId?: string
  servicePeriods?: ReservationServicePeriodLike[]
  bestTable: AvailableTable | undefined
  onModeChange: (mode: TableAssignMode) => void
  onTableChange: (tableId: string | null) => void
}

interface ManualTableOption {
  id: string
  label: string
  seats: number
  zone: string
  zoneLabel: string
  available: boolean
  nextAvailable?: string
  openingInMin: number
  capacityDelta: number
  score: number
}

function formatOpeningDelta(minutes: number): string {
  if (minutes <= 0) return "now"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function FormTableAssignment({
  tableLanes: tableLanesProp,
  zoneLabels,
  mode,
  assignedTable,
  zonePreference,
  partySize,
  selectedTime,
  duration,
  selectedDate,
  reservations,
  servicePeriodId,
  servicePeriods,
  bestTable,
  onModeChange,
  onTableChange,
}: FormTableAssignmentProps) {
  const tableLanes = tableLanesProp ?? []
  const zones = useMemo(
    () => getZonesFromTableLanes(tableLanes, zoneLabels),
    [tableLanes, zoneLabels]
  )

  const manualData = useMemo(() => {
    const buildOption = (lane: TableLane): ManualTableOption => {
      const zoneLabel = zones.find((z) => z.id === lane.zone)?.name ?? lane.zone

      const projection = computeManualTableOpeningFromContinuousWindow(
        lane.id,
        selectedTime,
        duration,
        selectedDate,
        reservations,
        servicePeriodId,
        servicePeriods,
        tableLanes
      )
      const available = projection.canHostFullDuration
      const openingInMin = projection.openingInMin
      const capacityDelta = lane.seats - partySize
      const seatFitPenalty = Math.abs(capacityDelta) * 3
      const availabilityBonus = available ? 1000 : Math.max(0, 700 - openingInMin)
      const score = availabilityBonus - seatFitPenalty

      return {
        id: lane.id,
        label: lane.label,
        seats: lane.seats,
        zone: lane.zone,
        zoneLabel,
        available,
        nextAvailable: available ? undefined : projection.nextAvailable,
        openingInMin,
        capacityDelta,
        score,
      }
    }

    const zoneFiltered = tableLanes.filter((table) => (
      (zonePreference === "any" || table.zone === zonePreference)
      && table.seats >= partySize
    ))
    const base = zoneFiltered.map((lane) => buildOption(lane))

    const withSelectedFallback = (() => {
      if (!assignedTable) return base
      if (base.some((table) => table.id === assignedTable)) return base

      const lane = tableLanes.find((table) => table.id === assignedTable)
      if (!lane) return base
      if (lane.seats < partySize) return base
      return [buildOption(lane), ...base]
    })()

    const sorted = withSelectedFallback.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.available !== b.available) return a.available ? -1 : 1
      if (a.openingInMin !== b.openingInMin) return a.openingInMin - b.openingInMin
      if (a.capacityDelta !== b.capacityDelta) return a.capacityDelta - b.capacityDelta
      return a.label.localeCompare(b.label)
    })

    const bestNow = sorted.filter((table) => table.available).slice(0, 2)
    const bestNowIds = new Set(bestNow.map((table) => table.id))
    const availableNow = sorted.filter((table) => table.available && !bestNowIds.has(table.id))
    const opensSoon = sorted.filter((table) => !table.available && table.openingInMin <= 90)
    const later = sorted.filter((table) => !table.available && table.openingInMin > 90)

    return {
      options: sorted,
      bestNow,
      availableNow,
      opensSoon,
      later,
      availableCount: sorted.filter((table) => table.available).length,
      recommended: bestNow[0] ?? sorted[0],
    }
  }, [
    assignedTable,
    duration,
    partySize,
    reservations,
    selectedDate,
    selectedTime,
    servicePeriodId,
    servicePeriods,
    zonePreference,
    tableLanes,
  ])

  const selectedTableOption = useMemo(
    () => (assignedTable ? manualData.options.find((table) => table.id === assignedTable) : undefined),
    [assignedTable, manualData.options]
  )

  return (
    <div className="space-y-4">
      <RadioGroup
        value={mode}
        onValueChange={(v) => {
          onModeChange(v as TableAssignMode)
          if (v === "auto" && bestTable) {
            onTableChange(bestTable.id)
          } else if (v === "unassigned") {
            onTableChange(null)
          }
        }}
        className="space-y-2"
      >
        {/* AI auto-assign */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            mode === "auto"
              ? "border-primary/40 bg-primary/5"
              : "border-border/40 bg-secondary/30 hover:border-border/60"
          }`}
        >
          <RadioGroupItem value="auto" id="auto" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Label htmlFor="auto" className="text-sm font-medium cursor-pointer">
                AI auto-assign
              </Label>
              {bestTable && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5">
                  <Trophy className="h-2.5 w-2.5" />
                  Best: {bestTable.label}
                </span>
              )}
            </div>
            {bestTable && mode === "auto" && (
              <div className="mt-2 space-y-1">
                {bestTable.matchReasons.map((reason, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                    {reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        </label>

        {/* Manual */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            mode === "manual"
              ? "border-primary/40 bg-primary/5"
              : "border-border/40 bg-secondary/30 hover:border-border/60"
          }`}
        >
          <RadioGroupItem value="manual" id="manual" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <Label htmlFor="manual" className="text-sm font-medium cursor-pointer">
              Choose manually
            </Label>
            {mode === "manual" && (
              <div className="mt-2 space-y-2">
                <div className="rounded-md border border-zinc-700/40 bg-zinc-900/40 px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                      {manualData.availableCount} available now
                    </span>
                    {manualData.opensSoon.length > 0 && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300">
                        {manualData.opensSoon.length} opening soon
                      </span>
                    )}
                    {manualData.recommended && (
                      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
                        recommend {manualData.recommended.label}
                      </span>
                    )}
                  </div>
                </div>
                <Select
                  value={assignedTable ?? ""}
                  onValueChange={(v) => onTableChange(v || null)}
                >
                  <SelectTrigger className="h-10 w-full bg-secondary/50 border-border/60">
                    {selectedTableOption ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 font-semibold tabular-nums">{selectedTableOption.label}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {selectedTableOption.seats}-top &middot; {selectedTableOption.zoneLabel}
                        </span>
                        {selectedTableOption.available ? (
                          <span className="shrink-0 text-[10px] text-emerald-300">available</span>
                        ) : (
                          <span className="shrink-0 text-[10px] text-amber-300">
                            opens {selectedTableOption.nextAvailable}
                          </span>
                        )}
                      </div>
                    ) : (
                      <SelectValue placeholder="Select a table..." />
                    )}
                  </SelectTrigger>
                  <SelectContent className="max-h-96 min-w-[var(--radix-select-trigger-width)]">
                    {manualData.bestNow.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-widest text-cyan-300/80">
                          Best Now
                        </SelectLabel>
                        {manualData.bestNow.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex w-full min-w-0 items-center gap-2">
                              <span className="shrink-0 font-semibold tabular-nums">{t.label}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{t.seats}-top</span>
                              <span className="truncate text-xs text-muted-foreground">{t.zoneLabel}</span>
                              {t.capacityDelta === 0 && (
                                <span className="shrink-0 text-[10px] text-cyan-300">exact fit</span>
                              )}
                              <span className="ml-auto shrink-0 text-[10px] text-emerald-300">available</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {manualData.availableNow.length > 0 && (
                      <>
                        {manualData.bestNow.length > 0 && <SelectSeparator />}
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-widest text-emerald-300/80">
                            Available Now
                          </SelectLabel>
                          {manualData.availableNow.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <div className="flex w-full min-w-0 items-center gap-2">
                                <span className="shrink-0 font-medium tabular-nums">{t.label}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{t.seats}-top</span>
                                <span className="truncate text-xs text-muted-foreground">{t.zoneLabel}</span>
                                <span className="ml-auto shrink-0 text-[10px] text-emerald-300">available</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}

                    {manualData.opensSoon.length > 0 && (
                      <>
                        {(manualData.bestNow.length > 0 || manualData.availableNow.length > 0) && <SelectSeparator />}
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-widest text-amber-300/80">
                            Opens Soon
                          </SelectLabel>
                          {manualData.opensSoon.map((t) => (
                            <SelectItem key={t.id} value={t.id} disabled>
                              <div className="flex w-full min-w-0 items-center gap-2">
                                <span className="shrink-0 font-medium tabular-nums">{t.label}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{t.seats}-top</span>
                                <span className="truncate text-xs text-muted-foreground">{t.zoneLabel}</span>
                                <span className="ml-auto shrink-0 text-[10px] text-amber-300">
                                  +{formatOpeningDelta(t.openingInMin)} ({t.nextAvailable})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}

                    {manualData.later.length > 0 && (
                      <>
                        {(manualData.bestNow.length > 0 || manualData.availableNow.length > 0 || manualData.opensSoon.length > 0) && <SelectSeparator />}
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-widest text-zinc-400">
                            Later
                          </SelectLabel>
                          {manualData.later.map((t) => (
                            <SelectItem key={t.id} value={t.id} disabled>
                              <div className="flex w-full min-w-0 items-center gap-2">
                                <span className="shrink-0 font-medium tabular-nums">{t.label}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{t.seats}-top</span>
                                <span className="truncate text-xs text-muted-foreground">{t.zoneLabel}</span>
                                <span className="ml-auto shrink-0 text-[10px] text-zinc-500">
                                  +{formatOpeningDelta(t.openingInMin)} ({t.nextAvailable})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {manualData.options.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No tables match current party size and floorplan preference.
                  </p>
                )}
              </div>
            )}
          </div>
        </label>

        {/* Unassigned */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            mode === "unassigned"
              ? "border-primary/40 bg-primary/5"
              : "border-border/40 bg-secondary/30 hover:border-border/60"
          }`}
        >
          <RadioGroupItem value="unassigned" id="unassigned" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <Label htmlFor="unassigned" className="text-sm font-medium cursor-pointer">
              Leave unassigned
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">Table will be assigned closer to arrival</p>
          </div>
        </label>
      </RadioGroup>

    </div>
  )
}
