"use client"

import { BellRing, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WaiterRequestAlertProps {
  onAcknowledge: () => void
  pending?: boolean
}

export function WaiterRequestAlert({ onAcknowledge, pending = false }: WaiterRequestAlertProps) {
  return (
    <div className="animate-fade-slide-in mx-3 mb-2 rounded-xl border border-red-400/70 bg-gradient-to-r from-red-600/28 via-red-500/22 to-red-400/10 px-3 py-2.5 shadow-[0_10px_28px_rgba(248,113,113,0.28)] ring-1 ring-red-400/35 md:mx-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-400 text-xs font-bold text-black shadow-[0_0_10px_rgba(248,113,113,0.45)]">
              <BellRing className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-red-50">Guest Called for Service</h3>
          </div>
          <p className="mt-1 text-xs text-red-100">
            A guest at this table requested the waiter. Mark handled after you visit the table.
          </p>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          disabled={pending}
          className="h-7 bg-emerald-400 px-2.5 text-xs font-semibold text-black hover:bg-emerald-300 disabled:opacity-60"
          onClick={onAcknowledge}
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          {pending ? "Saving…" : "Handled"}
        </Button>
      </div>
    </div>
  )
}
