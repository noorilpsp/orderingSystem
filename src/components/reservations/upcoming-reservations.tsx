"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  ArrowRight,
  MessageSquare,
  UserX,
  Armchair,
  AlertTriangle,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  type Reservation,
  formatTime12h,
  getCurrentLocalTime24,
  groupReservationsByTime,
  getUpcomingReservations,
} from "@/lib/reservations-data"
import { useReservationsData } from "@/lib/reservations/reservationsDataContext"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import { toast } from "sonner"

function getRiskDot(risk: Reservation["risk"]): React.ReactNode {
  if (risk === "low") return <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-label="Low risk" />
  if (risk === "medium") return <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-label="Medium risk" />
  return <span className="h-2.5 w-2.5 rounded-full bg-rose-500 res-pulse-badge" aria-label="High risk" />
}

function getTagBadge(tag: { type: string; label: string; detail?: string }) {
  const styleMap: Record<string, string> = {
    vip: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    "first-timer": "bg-blue-500/15 text-blue-400 border-blue-500/25",
    birthday: "bg-pink-500/15 text-pink-400 border-pink-500/25",
    anniversary: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    allergy: "bg-rose-500/15 text-rose-400 border-rose-500/25",
    "high-value": "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    wheelchair: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
    window: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  }
  const style = styleMap[tag.type] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/25"

  return (
    <Badge
      key={tag.type + tag.label}
      variant="outline"
      className={`text-[10px] font-medium ${style}`}
    >
      {tag.label}
      {tag.detail ? `: ${tag.detail}` : ""}
    </Badge>
  )
}

function ReservationCard({
  reservation,
  index,
  onOpenDetail,
  onAssignTable,
  currentTime,
  locationName,
}: {
  reservation: Reservation
  index: number
  onOpenDetail: (reservationId: string) => void
  onAssignTable: (reservationId: string) => void
  currentTime: string
  locationName: string
}) {
  const displayPhone = useDisplayPhone()
  const isLate =
    reservation.status === "confirmed" &&
    (() => {
      const [rh, rm] = reservation.time.split(":").map(Number)
      const [ch, cm] = currentTime.split(":").map(Number)
      return ch * 60 + cm - (rh * 60 + rm) >= 10
    })()

  const minutesLate = (() => {
    const [rh, rm] = reservation.time.split(":").map(Number)
    const [ch, cm] = currentTime.split(":").map(Number)
    return ch * 60 + cm - (rh * 60 + rm)
  })()

  const isUnassigned = !reservation.table

  return (
    <div
      className={`group glass-surface rounded-lg p-3 transition-all hover:border-zinc-700 ${
        isLate ? "border-rose-500/30 bg-rose-950/20" : ""
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(reservation.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenDetail(reservation.id)
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {getRiskDot(reservation.risk)}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTime12h(reservation.time)}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {reservation.guestName}
              </span>
              <span className="text-xs text-muted-foreground">
                {reservation.partySize} guests
              </span>
              {reservation.table ? (
                <Badge variant="outline" className="text-[10px] border-zinc-700 text-foreground">
                  {reservation.table}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
                  Unassigned
                </Badge>
              )}
            </div>

            {/* Tags */}
            {(reservation.tags.length > 0 ||
              reservation.visitCount ||
              reservation.risk === "high") && (
              <div className="flex flex-wrap items-center gap-1.5">
                {reservation.tags.map((tag) => getTagBadge(tag))}
                {reservation.visitCount && reservation.visitCount > 1 && (
                  <span className="text-[10px] text-muted-foreground">
                    {reservation.visitCount}th visit
                  </span>
                )}
                {reservation.bookedVia && (
                  <span className="text-[10px] text-muted-foreground">
                    via {reservation.bookedVia}
                  </span>
                )}
                {reservation.risk === "high" && reservation.riskScore && (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-rose-400">
                    <AlertTriangle className="h-3 w-3" />
                    High no-show risk ({reservation.riskScore}%)
                    {!reservation.confirmationSent && " - No confirmation"}
                  </span>
                )}
              </div>
            )}

            {/* Late indicator */}
            {isLate && minutesLate > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-rose-400">
                <Clock className="h-3 w-3" />
                {minutesLate} min late
              </span>
            )}

            {/* Notes */}
            {reservation.notes && (
              <p className="text-[10px] text-muted-foreground/70 italic">
                {reservation.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons - visible on hover, always visible on mobile */}
      <div className="mt-2 flex gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <Button
          size="sm"
          className={
            isUnassigned
              ? "h-7 border border-amber-500/40 bg-amber-500/15 px-2.5 text-[11px] text-amber-200 hover:bg-amber-500/20"
              : "h-7 bg-emerald-600 px-2.5 text-[11px] text-emerald-50 hover:bg-emerald-500"
          }
          onClick={(e) => {
            e.stopPropagation()
            if (isUnassigned) {
              onAssignTable(reservation.id)
              return
            }
            toast.success(`${reservation.guestName} (${reservation.partySize} guests) seated at ${reservation.table}`, {
              action: { label: "Undo", onClick: () => {} },
              duration: 5000,
            })
          }}
        >
          <Armchair className="mr-1 h-3 w-3" />
          {isUnassigned ? "Assign Table" : "Seat Now"}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-zinc-700 px-2.5 text-[11px] text-blue-400 hover:bg-blue-950/40 hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
            >
              <MessageSquare className="mr-1 h-3 w-3" />
              Text
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 border-zinc-700 bg-zinc-900 p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Send to {displayPhone(reservation.phone) || "Guest"}:
            </p>
            <p className="mb-3 rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs text-foreground">
              Hi {reservation.guestName.split(" ")[0]}, your table is ready at{" "}
              {locationName}! We look forward to seeing you.
            </p>
            <Button
              size="sm"
              className="h-7 w-full bg-blue-600 text-[11px] text-blue-50 hover:bg-blue-500"
              onClick={(e) => {
                e.stopPropagation()
                toast.success(`Message sent to ${reservation.guestName}`)
              }}
            >
              Send Message
            </Button>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          variant="outline"
          className="h-7 border-zinc-700 px-2.5 text-[11px] text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
          onClick={(e) => {
            e.stopPropagation()
            if (
              window.confirm(
                `Mark ${reservation.guestName} as no-show? This will free ${reservation.table ?? "their spot"}.`
              )
            ) {
              toast.error(`${reservation.guestName} marked as no-show`)
            }
          }}
        >
          <UserX className="mr-1 h-3 w-3" />
          No-Show
        </Button>
      </div>
    </div>
  )
}

export function UpcomingReservations() {
  const { reservations, config } = useReservationsData()
  const currentTime = getCurrentLocalTime24()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const upcoming = getUpcomingReservations(reservations, currentTime)
  const grouped = groupReservationsByTime(upcoming, currentTime)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleGroup = (time: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(time)) next.delete(time)
      else next.add(time)
      return next
    })
  }

  const openDetail = (reservationId: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("detail", reservationId)
    next.delete("action")
    next.delete("id")
    next.delete("draft")
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const openEditForAssignment = (reservationId: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("action", "edit")
    next.set("id", reservationId)
    next.delete("detail")
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="glass-surface flex h-full flex-col rounded-xl">
      <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Upcoming Reservations
        </h2>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Link href="/reservations/list">
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4">
          {grouped.map((group) => {
            const isOpen = !collapsed.has(group.time)

            return (
              <div key={group.time}>
                <button
                  className={`flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-zinc-800/40 ${
                    group.isArrivingNow ? "res-arriving-now-border" : ""
                  }`}
                  onClick={() => toggleGroup(group.time)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      group.isArrivingNow ? "text-emerald-400" : "text-foreground"
                    }`}
                  >
                    {group.label}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-2 space-y-2 pl-1">
                    {group.reservations.map((r, i) => (
                      <ReservationCard
                        key={r.id}
                        reservation={r}
                        currentTime={currentTime}
                        locationName={config.name}
                        index={i}
                        onOpenDetail={openDetail}
                        onAssignTable={openEditForAssignment}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {grouped.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No upcoming reservations for this window
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
