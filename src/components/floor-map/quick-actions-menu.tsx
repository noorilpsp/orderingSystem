"use client"

import { useEffect, useRef } from "react"
import {
  Plus,
  Flame,
  MessageSquare,
  CheckCircle2,
  ArrowRightLeft,
  X,
  UserPlus,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickActionsMenuProps {
  tableNumber: number
  position: { x: number; y: number }
  isCleaning?: boolean
  hasWaiterRequest?: boolean
  hasBillRequest?: boolean
  onClose: () => void
  onSeatParty?: () => void
  onMarkAvailable?: () => void
  onAcknowledgeService?: (requestType: "waiter" | "bill") => void
}

const actions = [
  { icon: UserPlus, label: "Seat Party", key: "seat_party", accent: "text-emerald-400", isSeatParty: true },
  { icon: Plus, label: "Add Items", key: "add", accent: "text-primary" },
  { icon: Flame, label: "Fire Next Wave", key: "fire", accent: "text-orange-400" },
  { icon: MessageSquare, label: "Message Kitchen", key: "message", accent: "text-blue-400" },
  { icon: CheckCircle2, label: "Mark Checked In", key: "checkin", accent: "text-emerald-400" },
  { icon: ArrowRightLeft, label: "Transfer Table", key: "transfer", accent: "text-violet-400" },
]

export function QuickActionsMenu({
  tableNumber,
  position,
  isCleaning = false,
  hasWaiterRequest = false,
  hasBillRequest = false,
  onClose,
  onSeatParty,
  onMarkAvailable,
  onAcknowledgeService,
}: QuickActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 w-56 rounded-xl border border-white/[0.08] shadow-2xl shadow-black/50 animate-fade-slide-in",
        "bg-[hsl(225,15%,10%)]/90 backdrop-blur-xl",
      )}
      style={{
        left: Math.min(position.x, window.innerWidth - 240),
        top: Math.min(position.y, window.innerHeight - 280),
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
        <span className="text-sm font-bold font-mono text-foreground tracking-wide">
          T{tableNumber}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Actions */}
      <div className="py-1.5">
        {isCleaning ? (
          <button
            type="button"
            onClick={() => {
              onMarkAvailable?.()
              onClose()
            }}
            className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-white/[0.08]"
          >
            <Sparkles className="h-4 w-4 text-emerald-400 transition-colors" />
            Mark Available
          </button>
        ) : (
          <>
            {hasWaiterRequest && (
              <button
                type="button"
                onClick={() => {
                  onAcknowledgeService?.("waiter")
                  onClose()
                }}
                className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-white/[0.08]"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 transition-colors" />
                Waiter Handled
              </button>
            )}
            {hasBillRequest && (
              <button
                type="button"
                onClick={() => {
                  onAcknowledgeService?.("bill")
                  onClose()
                }}
                className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-white/[0.08]"
              >
                <CheckCircle2 className="h-4 w-4 text-amber-400 transition-colors" />
                Check Delivered
              </button>
            )}
            {actions.map(({ icon: Icon, label, key, accent, isSeatParty }) => (
              <button
                key={key}
                type="button"
                onClick={isSeatParty && onSeatParty ? onSeatParty : onClose}
                className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground font-medium transition-all hover:bg-white/[0.08]"
              >
                <Icon className={cn("h-4 w-4 transition-colors", accent)} />
                {label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
