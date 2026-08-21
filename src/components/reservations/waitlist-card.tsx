"use client"

import {
  Armchair,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Utensils,
  Wine,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  type WaitlistEntry,
  getElapsedMinutes,
  getLocationLabel,
} from "@/lib/waitlist-data"

interface WaitlistCardProps {
  entry: WaitlistEntry
  position: number
  elapsedOffset: number
  isExpanded: boolean
  onToggleExpand: () => void
  onOpenDetail: () => void
  onSeatAt: (tableId: string) => void
  onTextGuest: (action: string) => void
  onRemove: () => void
  onConvert: () => void
}

export function WaitlistCard({
  entry,
  position,
  elapsedOffset,
  isExpanded,
  onToggleExpand,
  onOpenDetail,
  onSeatAt,
  onTextGuest,
  onRemove,
  onConvert,
}: WaitlistCardProps) {
  const displayPhone = useDisplayPhone()
  const elapsed = getElapsedMinutes(entry) + elapsedOffset
  const quoted = Math.max(entry.quotedWait, 1)
  const waitRatio = elapsed / quoted
  const progressPct = Math.round(waitRatio * 100)
  const progressBarPct = Math.min(progressPct, 100)
  const status: "normal" | "warning" | "overdue" =
    waitRatio >= 1 ? "overdue" : waitRatio >= 0.7 ? "warning" : "normal"

  const hasMatch = entry.bestMatch !== null
  const isReadyNow = entry.bestMatch?.status === "ready-now"
  const barColor =
    status === "overdue"
      ? "bg-rose-500"
      : status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500"
  const shellTone = isReadyNow
    ? "border-emerald-500/45 shadow-[0_0_18px_rgba(16,185,129,0.12)]"
    : status === "overdue"
      ? "border-rose-500/35 shadow-[0_0_18px_rgba(244,63,94,0.12)]"
      : status === "warning"
        ? "border-amber-500/30 shadow-[0_0_16px_rgba(245,158,11,0.1)]"
        : "border-zinc-800/60 hover:border-zinc-700/70"
  const accentTone = isReadyNow
    ? "bg-emerald-400"
    : status === "overdue"
      ? "bg-rose-400"
      : status === "warning"
        ? "bg-amber-400"
        : "bg-cyan-400/70"
  const stateLabel = isReadyNow
    ? "Ready now"
    : hasMatch
      ? "Queued match"
      : "No table yet"

  return (
    <div
      className={cn(
        "wl-card group relative overflow-hidden rounded-xl border bg-zinc-900/85 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5",
        shellTone
      )}
      role="article"
      aria-label={`Waitlist position ${position}, ${entry.name}, ${entry.partySize} guests`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpenDetail()
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.08),transparent_45%)] opacity-60" />
      <div className={cn("pointer-events-none absolute inset-y-0 left-0 w-[3px]", accentTone)} />

      {/* Header row */}
      <div
        className="relative z-10 flex cursor-pointer items-start justify-between gap-3 px-4 pt-3.5"
        onClick={onOpenDetail}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-800/90 text-xs font-bold text-zinc-200">
            {position}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{entry.name}</h3>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {entry.smsStatus || getLocationLabel(entry.location)}
              </span>
              {entry.barTab && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Wine className="h-3 w-3" />
                  ${entry.barTab} tab
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-zinc-700 bg-zinc-800/60 text-xs font-bold text-zinc-200">
            {entry.partySize}p
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "hidden border text-[10px] font-semibold sm:inline-flex",
              isReadyNow
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : status === "overdue"
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : hasMatch
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                    : "border-zinc-700 bg-zinc-800/60 text-zinc-400"
            )}
          >
            {stateLabel}
          </Badge>
          <button
            type="button"
            className="text-zinc-500 hover:text-zinc-300"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Timer + Progress bar */}
      <div className="relative z-10 px-4 pt-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-zinc-400">
            <Clock className="h-3 w-3" />
            Waiting: <span className={`font-semibold ${status === "overdue" ? "text-rose-400" : "text-zinc-200"}`}>{elapsed} min</span>
          </span>
          <span className="text-zinc-500">
            Quoted: <span className="text-zinc-300">{entry.quotedWait} min</span>
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-zinc-800 bg-zinc-900/80">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${barColor} ${
              status === "overdue" ? "wl-overdue-pulse" : ""
            }`}
            style={{ width: `${progressBarPct}%` }}
            role="progressbar"
            aria-valuenow={progressBarPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${elapsed} of ${entry.quotedWait} minutes waited`}
          />
        </div>
        <div className="mt-1 flex items-center justify-end text-[10px] text-zinc-600">
          <span>{progressPct}%</span>
        </div>
      </div>

      {/* Match section */}
      {hasMatch && (
        <div
          className={`relative z-10 mx-4 mt-1.5 rounded-lg border px-3 py-2 ${
            isReadyNow
              ? "wl-match-pulse border-emerald-500/30 bg-emerald-500/10"
              : "border-cyan-500/20 bg-cyan-500/5"
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs">
            {isReadyNow ? (
              <>
                <Zap className="h-3 w-3 text-emerald-400" />
                <span className="font-bold text-emerald-300">AUTO-MATCH:</span>
                <span className="text-emerald-200">
                  {entry.bestMatch!.displayId ?? entry.bestMatch!.tableId} ready now!
                </span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 text-amber-400" />
                <span className="font-semibold text-amber-300">NEXT MATCH:</span>
                <span className="text-zinc-300">
                  {entry.bestMatch!.displayId ?? entry.bestMatch!.tableId} est. ~{entry.bestMatch!.estMinutes} min
                  {entry.bestMatch!.reason && (
                    <span className="text-zinc-500"> ({entry.bestMatch!.reason})</span>
                  )}
                </span>
              </>
            )}
          </div>
          {isReadyNow && (
            <div className="mt-1 text-[10px] text-zinc-500">
              {entry.bestMatch!.displayId ?? entry.bestMatch!.tableId} ({entry.bestMatch!.seats}-top, {entry.bestMatch!.zone}
              {entry.bestMatch!.detail ? `, ${entry.bestMatch!.detail}` : ""})
              {entry.altMatches.length > 0 && (
                <span>
                  {" "}&middot; Also fits:{" "}
                  {entry.altMatches.map((m) => `${m.displayId ?? m.tableId} at ~${m.estMinutes > 0 ? `${m.estMinutes} min` : "now"}`).join(", ")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {!hasMatch && (
        <div className="relative z-10 mx-4 mt-1.5 rounded-lg border border-zinc-800/50 bg-zinc-800/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            No immediate match &mdash; est. {entry.quotedWait - elapsed > 0 ? `${entry.quotedWait - elapsed}-${entry.quotedWait - elapsed + 5}` : "5-10"} min
          </div>
          {entry.mergeOption && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
              <Utensils className="h-3 w-3 text-zinc-600" />
              Could merge {entry.mergeOption.tables.join("+")} &mdash; available {entry.mergeOption.estTime}
            </div>
          )}
        </div>
      )}

      {/* Merge option for matched cards */}
      {hasMatch && entry.mergeOption && (
        <div className="relative z-10 mx-4 mt-1 text-[10px] text-zinc-500">
          <Utensils className="mr-1 inline h-3 w-3 text-zinc-600" />
          Could merge {entry.mergeOption.tables.join("+")} &mdash; available {entry.mergeOption.estTime}
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="wl-expand-in relative z-10 mt-2 border-t border-zinc-800/40 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {entry.phone && (
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Phone className="h-3 w-3" />
                {displayPhone(entry.phone)}
              </div>
            )}
            {entry.notes && (
              <div className="col-span-2 text-zinc-400">
                Notes: &ldquo;{entry.notes}&rdquo;
              </div>
            )}
            {entry.preferences && (
              <div className="col-span-2 flex items-center gap-1.5 text-zinc-400">
                <Armchair className="h-3 w-3" />
                {entry.preferences}
              </div>
            )}
          </div>
          {/* Alt matches */}
          {entry.altMatches.length > 0 && !isReadyNow && (
            <div className="mt-2 border-t border-zinc-800/30 pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Also Coming Up</span>
              <div className="mt-1 flex flex-col gap-1">
                {entry.altMatches.map((m) => (
                  <div key={m.tableId} className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">
                      {m.displayId ?? m.tableId} ({m.seats}-top, {m.zone}) &mdash; ~{m.estMinutes} min
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-2 text-[10px] text-zinc-500 hover:text-zinc-200"
                      onClick={() => onSeatAt(m.tableId)}
                    >
                      Seat Here
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-4 pb-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {isReadyNow && (
            <Button
              size="sm"
              className="h-7 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-500"
              onClick={() => onSeatAt(entry.bestMatch!.tableId)}
              aria-label={`Seat ${entry.name} at ${entry.bestMatch!.displayId ?? entry.bestMatch!.tableId}`}
            >
              <Armchair className="mr-1 h-3 w-3" />
              Seat at {entry.bestMatch!.displayId ?? entry.bestMatch!.tableId}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-zinc-700 bg-zinc-800/60 px-3 text-xs text-zinc-300 hover:bg-zinc-700"
            onClick={() => onTextGuest(isReadyNow ? "Ready" : status === "overdue" ? "Still Coming?" : "Update")}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            {isReadyNow ? "Text: Ready" : status === "overdue" ? "Still Coming?" : "Text"}
          </Button>
          {!isReadyNow && elapsed < entry.quotedWait * 0.7 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs text-zinc-500 hover:text-zinc-300"
              onClick={onConvert}
            >
              Convert to Res
            </Button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
              aria-label={`More actions for ${entry.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900">
            <DropdownMenuItem onClick={() => onSeatAt("")} className="text-zinc-300">
              <Armchair className="mr-2 h-3.5 w-3.5" /> Seat Now (choose table)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onConvert} className="text-zinc-300">
              <Utensils className="mr-2 h-3.5 w-3.5" /> Convert to Reservation
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onRemove}
              className="text-rose-400 focus:text-rose-300"
            >
              <span className="mr-2">&#x2715;</span> Remove from Waitlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
