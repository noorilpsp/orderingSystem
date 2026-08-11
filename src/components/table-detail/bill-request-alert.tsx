"use client"

import { CheckCircle2, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BillRequestAlertProps {
  onAcknowledge: () => void
  pending?: boolean
}

export function BillRequestAlert({ onAcknowledge, pending = false }: BillRequestAlertProps) {
  return (
    <div className="animate-fade-slide-in mx-3 mb-2 rounded-xl border border-amber-400/70 bg-gradient-to-r from-amber-600/28 via-amber-500/22 to-amber-400/10 px-3 py-2.5 shadow-[0_10px_28px_rgba(251,191,36,0.28)] ring-1 ring-amber-400/35 md:mx-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-black shadow-[0_0_10px_rgba(251,191,36,0.45)]">
              <CreditCard className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-amber-50">Guest Requested the Check</h3>
          </div>
          <p className="mt-1 text-xs text-amber-100">
            A guest at this table asked for the bill. Mark delivered after you bring the check.
          </p>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          disabled={pending}
          className="h-7 bg-amber-400 px-2.5 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-60"
          onClick={onAcknowledge}
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          {pending ? "Saving…" : "Check Delivered"}
        </Button>
      </div>
    </div>
  )
}
