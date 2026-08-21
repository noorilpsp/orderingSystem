"use client"

import {
  Phone,
  MessageSquare,
  Star,
  Cake,
  Heart,
  AlertTriangle,
  Sparkles,
  Repeat,
  DollarSign,
  Accessibility,
  Dog,
  MapPin,
  Clock,
  Users,
  UtensilsCrossed,
  StickyNote,
  Timer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  type ListReservation,
  type ListTagType,
  getStatusBadge,
  getRiskDisplay,
  formatTime12h,
  formatReservationDurationCompact,
} from "@/lib/listview-data"
import { cn } from "@/lib/utils"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"

interface ListDetailPanelProps {
  reservation: ListReservation | null
  open: boolean
  onClose: () => void
  /** Called when user cancels a reservation or removes from waitlist. id, and whether it's a waitlist entry. */
  onCancel?: (id: string, isWaitlist: boolean) => void | Promise<void>
}

function TagBadge({ type, label }: { type: ListTagType; label: string }) {
  const iconCls = "h-3 w-3 shrink-0"
  let icon: React.ReactNode
  switch (type) {
    case "vip": icon = <Star className={cn(iconCls, "text-amber-400 fill-amber-400")} />; break
    case "birthday": icon = <Cake className={cn(iconCls, "text-pink-400")} />; break
    case "anniversary": icon = <Heart className={cn(iconCls, "text-rose-400 fill-rose-400")} />; break
    case "allergy": icon = <AlertTriangle className={cn(iconCls, "text-amber-400")} />; break
    case "first-timer": icon = <Sparkles className={cn(iconCls, "text-cyan-400")} />; break
    case "regular": icon = <Repeat className={cn(iconCls, "text-blue-400")} />; break
    case "high-value": icon = <DollarSign className={cn(iconCls, "text-emerald-400")} />; break
    case "wheelchair": icon = <Accessibility className={cn(iconCls, "text-purple-400")} />; break
    case "service-dog": icon = <Dog className={cn(iconCls, "text-amber-300")} />; break
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
      {icon}
      {label}
    </span>
  )
}

export function ListDetailPanel({ reservation, open, onClose, onCancel }: ListDetailPanelProps) {
  const displayPhone = useDisplayPhone()
  if (!reservation) return null

  const statusBadge = getStatusBadge(reservation.status, reservation.courseStage)
  const riskDisplay = getRiskDisplay(reservation.risk)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-md border-l border-zinc-800 bg-zinc-950 p-0 sm:max-w-sm"
      >
        <div className="flex h-full flex-col overflow-auto">
          <SheetHeader className="border-b border-zinc-800 px-5 py-4">
            <div className="flex items-center gap-2">
              {reservation.tags.some((t) => t.type === "vip") && (
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              )}
              <SheetTitle className="text-base font-semibold text-foreground">
                {reservation.guestName}
              </SheetTitle>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                statusBadge.pillClass,
                statusBadge.bgClass, statusBadge.textClass
              )} style={{ borderStyle: statusBadge.borderStyle }}>
                <span
                  className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", statusBadge.dotClass)}
                  style={statusBadge.dotColor ? { backgroundColor: statusBadge.dotColor } : undefined}
                />
                {statusBadge.label}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", riskDisplay.dotClass)} />
                {riskDisplay.label} risk
                {reservation.riskScore && ` (${reservation.riskScore}%)`}
              </span>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-5 px-5 py-4">
            {/* Quick info grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 p-2.5">
                <Clock className="h-4 w-4 text-zinc-500" />
                <div>
                  <div className="text-[10px] text-zinc-500">Time</div>
                  <div className="text-xs font-medium text-foreground">{formatTime12h(reservation.time)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 p-2.5">
                <Users className="h-4 w-4 text-zinc-500" />
                <div>
                  <div className="text-[10px] text-zinc-500">Party</div>
                  <div className="text-xs font-medium text-foreground">{reservation.partySize} guests</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 p-2.5">
                <Timer className="h-4 w-4 text-zinc-500" />
                <div>
                  <div className="text-[10px] text-zinc-500">Stay</div>
                  <div className="text-xs font-medium text-foreground">
                    {formatReservationDurationCompact(reservation.durationMinutes)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 p-2.5">
                <MapPin className="h-4 w-4 text-zinc-500" />
                <div>
                  <div className="text-[10px] text-zinc-500">Table</div>
                  <div className={cn(
                    "text-xs font-medium",
                    reservation.table ? "text-foreground" : "text-amber-400"
                  )}>
                    {reservation.table ?? "Unassigned"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 p-2.5 sm:col-span-2">
                <UtensilsCrossed className="h-4 w-4 text-zinc-500" />
                <div>
                  <div className="text-[10px] text-zinc-500">Server</div>
                  <div className="text-xs font-medium text-foreground">{reservation.server ?? "Unassigned"}</div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {reservation.tags.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {reservation.tags.map((tag, i) => (
                    <TagBadge key={i} type={tag.type} label={tag.detail ?? tag.label} />
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {reservation.notes && (
              <div>
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  <StickyNote className="h-3 w-3" /> Notes
                </div>
                <p className="rounded-lg bg-zinc-900/60 p-3 text-xs leading-relaxed text-zinc-300">
                  {reservation.notes}
                </p>
              </div>
            )}

            {/* Booking details */}
            <div>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Booking Details</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Channel</span>
                  <span className="text-zinc-300">{reservation.bookedVia}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Confirmation</span>
                  <span className={reservation.confirmationSent ? "text-emerald-400" : "text-amber-400"}>
                    {reservation.confirmationSent ? "Sent" : "Not sent"}
                  </span>
                </div>
                {reservation.visitCount && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Visit count</span>
                    <span className="text-zinc-300">{reservation.visitCount} visits</span>
                  </div>
                )}
                {reservation.zone && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Zone</span>
                    <span className="text-zinc-300">{reservation.zone}</span>
                  </div>
                )}
                {reservation.checkAmount !== undefined && reservation.checkAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Check</span>
                    <span className="text-emerald-400 font-medium">${reservation.checkAmount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
            {reservation.phone && (
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Contact</div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Phone className="h-3.5 w-3.5 text-zinc-500" />
                  {displayPhone(reservation.phone)}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="border-t border-zinc-800 px-5 py-3">
            <div className="grid grid-cols-2 gap-2">
              {(reservation.status === "arriving" || reservation.status === "late" || reservation.status === "confirmed" || reservation.status === "unconfirmed") && (
                <>
                  <Button size="sm" className="h-8 bg-emerald-600 text-xs text-emerald-50 hover:bg-emerald-500">
                    Seat Now
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700">
                    <MessageSquare className="mr-1 h-3 w-3" /> Text Guest
                  </Button>
                </>
              )}
              {reservation.status === "seated" && (
                <Button size="sm" variant="outline" className="h-8 border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 col-span-2">
                  Print Check
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700">
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-rose-700/30 text-xs text-rose-400 hover:bg-rose-500/10"
                onClick={() => onCancel?.(reservation.id, reservation.status === "waitlist")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
