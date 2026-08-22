"use client"

import { useState, useEffect } from "react"
import {
  CalendarDays,
  Plus,
  Clock,
  Eye,
  EyeOff,
  Users,
  DollarSign,
  Timer,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { type HeatMapMode, type ZoneId } from "@/lib/floorplan-data"
import {
  getCurrentLocalTime24,
  getCurrentLocalDateFormatted,
  formatTime12h,
} from "@/lib/reservations-data"
import { useReservationsData } from "@/lib/reservations/reservationsDataContext"
import type { ReservationZone } from "@/lib/reservations/zones"

interface FloorplanTopBarProps {
  heatMap: HeatMapMode
  onHeatMapChange: (mode: HeatMapMode) => void
  zone: ZoneId
  onZoneChange: (z: ZoneId) => void
  zones: ReservationZone[]
  whatIfMode: boolean
  onToggleWhatIf: () => void
}

const heatMapOptions: { value: HeatMapMode; label: string; icon: typeof Eye }[] = [
  { value: "off", label: "Off", icon: EyeOff },
  { value: "availability", label: "Availability", icon: Eye },
  { value: "server-load", label: "Server Load", icon: Users },
  { value: "revenue", label: "Revenue", icon: DollarSign },
  { value: "turn-time", label: "Turn Time", icon: Timer },
]

export function FloorplanTopBar({
  heatMap,
  onHeatMapChange,
  zone,
  onZoneChange,
  zones,
  whatIfMode,
  onToggleWhatIf,
}: FloorplanTopBarProps) {
  const zoneOptions: Array<{ value: ZoneId; label: string }> = [
    { value: "all", label: "All" },
    ...zones.map((z) => ({ value: z.id, label: z.name })),
  ]

  const { config } = useReservationsData()
  const [currentTime, setCurrentTime] = useState(getCurrentLocalTime24)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentLocalTime24())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="sticky top-0 z-50 glass-surface-strong">
      {/* Row 1: Title + Date + Service + CTA */}
      <div className="flex items-center justify-between px-4 py-2.5 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-foreground">
              Floor Plan
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {"Reservations"}
            </span>
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {getCurrentLocalDateFormatted()}
            </span>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-zinc-700 bg-zinc-800/60 text-foreground text-xs hover:bg-zinc-700/60">
                Dinner
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="border-zinc-700 bg-zinc-900">
              {config.servicePeriods.map((p) => (
                <DropdownMenuItem key={p.id} className="text-foreground text-xs focus:bg-zinc-800 focus:text-foreground">
                  {p.label || p.name} ({formatTime12h(p.start)} - {formatTime12h(p.end)})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums font-mono text-foreground">{formatTime12h(currentTime)}</span>
          </div>
        </div>

        <Button size="sm" className="hidden bg-emerald-600 text-emerald-50 hover:bg-emerald-500 md:flex">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Res
        </Button>
      </div>

      {/* Row 2: Heat Map + Zone filters */}
      <div className="flex items-center gap-3 overflow-x-auto border-t border-zinc-800/50 px-4 py-2 lg:px-6 scrollbar-none">
        {/* Heat map toggles */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Heat Map:</span>
          {heatMapOptions.map((opt) => {
            const Icon = opt.icon
            const active = heatMap === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onHeatMapChange(opt.value)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all whitespace-nowrap",
                  active
                    ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/30"
                    : "text-muted-foreground hover:bg-zinc-800 hover:text-foreground"
                )}
                aria-pressed={active}
                aria-label={`Heat map: ${opt.label}`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            )
          })}
        </div>

        <div className="h-4 w-px bg-zinc-700/50 shrink-0" />

        {/* Zone filters */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Zones:</span>
          {zoneOptions.map((z) => {
            const active = zone === z.value
            return (
              <button
                key={z.value}
                onClick={() => onZoneChange(z.value)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-all whitespace-nowrap",
                  active
                    ? "bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "text-muted-foreground hover:bg-zinc-800 hover:text-foreground"
                )}
                aria-pressed={active}
              >
                {z.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* What If banner */}
      {whatIfMode && (
        <div className="flex items-center justify-between border-t border-dashed border-amber-500/50 bg-amber-500/10 px-4 py-1.5 lg:px-6 animate-banner-enter">
          <span className="text-xs font-semibold text-amber-300">
            WHAT IF MODE - Changes are not saved
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-6 border-amber-500/40 bg-transparent text-[10px] text-amber-300 hover:bg-amber-500/20">
              Apply Changes
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-amber-300 hover:bg-amber-500/10" onClick={onToggleWhatIf}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full bg-emerald-600 shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 md:hidden"
        aria-label="New Reservation"
      >
        <Plus className="h-5 w-5 text-emerald-50" />
      </Button>
    </header>
  )
}
