"use client"

import { useEffect, useRef } from "react"
import {
  Armchair,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  PlusCircle,
  UserMinus,
  X,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import {
  type WaitlistEntry,
  getElapsedMinutes,
  getLocationLabel,
  getProgressPct,
  getProgressStatus,
} from "@/lib/waitlist-data"

interface WaitlistDetailPanelProps {
  entry: WaitlistEntry | null
  open: boolean
  onClose: () => void
  onSeatAt: (tableId: string) => void
  onTextGuest: (action: string) => void
  onRemove: () => void
  onConvert: () => void
}

export function WaitlistDetailPanel({
  entry,
  open,
  onClose,
  onSeatAt,
  onTextGuest,
  onRemove,
  onConvert,
}: WaitlistDetailPanelProps) {
  const displayPhone = useDisplayPhone()
  const isDesktop = useMediaQuery("(min-width: 1280px)")
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1279px)")
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setTimeout(() => panelRef.current?.focus(), 80)
    }
  }, [open])

  if (!open || !entry) return null

  const elapsed = getElapsedMinutes(entry)
  const progress = getProgressPct(entry)
  const status = getProgressStatus(entry)
  const statusColor =
    status === "overdue" ? "text-rose-400" : status === "warning" ? "text-amber-400" : "text-emerald-400"

  const content = (
    <>
      <div className="sticky top-0 z-10 border-b border-zinc-800/50 bg-zinc-950/95 px-5 py-4 backdrop-blur-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-100">{entry.name}</h2>
            <p className="mt-0.5 text-sm text-zinc-400">Party of {entry.partySize} · Waitlist #{entry.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-zinc-700 bg-zinc-800/60 text-zinc-200">
            <Clock className="mr-1 h-3 w-3" />
            {elapsed} min waited / {entry.quotedWait} min quoted
          </Badge>
          <Badge variant="outline" className={`border-zinc-700 bg-zinc-800/60 ${statusColor}`}>
            {status.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="border-zinc-700 bg-zinc-800/60 text-zinc-300">
            <MapPin className="mr-1 h-3 w-3" />
            {entry.smsStatus || getLocationLabel(entry.location)}
          </Badge>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${status === "overdue" ? "bg-rose-500" : status === "warning" ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-emerald-600 text-emerald-50 hover:bg-emerald-500"
            onClick={() => onSeatAt(entry.bestMatch?.tableId ?? "")}
          >
            <Armchair className="mr-1.5 h-3.5 w-3.5" />
            Seat {entry.bestMatch?.tableId ? `at ${entry.bestMatch.tableId}` : "Now"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700 bg-zinc-800/50 text-zinc-200 hover:bg-zinc-700"
            onClick={() => onTextGuest("ready")}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Text Guest
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700 bg-zinc-800/50 text-zinc-200 hover:bg-zinc-700"
            onClick={onConvert}
          >
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            Convert
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-rose-700/50 bg-rose-900/20 text-rose-300 hover:bg-rose-900/30"
            onClick={onRemove}
          >
            <UserMinus className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-5 text-sm">
          {entry.bestMatch ? (
            <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-emerald-300">
                <Zap className="h-4 w-4" />
                <span className="font-semibold">Best Match: {entry.bestMatch.tableId}</span>
              </div>
              <p className="text-xs text-zinc-300">
                {entry.bestMatch.seats}-top · {entry.bestMatch.zone} · {entry.bestMatch.detail}
                {entry.bestMatch.estMinutes > 0 ? ` · ~${entry.bestMatch.estMinutes} min` : " · Ready now"}
              </p>
              {entry.bestMatch.reason && <p className="mt-1 text-xs text-zinc-400">{entry.bestMatch.reason}</p>}
            </section>
          ) : (
            <section className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-3">
              <p className="text-xs text-zinc-400">No immediate table match yet.</p>
            </section>
          )}

          {entry.altMatches.length > 0 && (
            <section className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Alternate Matches</h3>
              <div className="space-y-2">
                {entry.altMatches.map((m) => (
                  <div key={m.tableId} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/70 px-2.5 py-2">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{m.tableId} · {m.seats}-top</p>
                      <p className="text-[11px] text-zinc-500">{m.zone} · {m.detail} · {m.estMinutes > 0 ? `~${m.estMinutes} min` : "Now"}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-zinc-300 hover:text-zinc-100"
                      onClick={() => onSeatAt(m.tableId)}
                    >
                      Seat Here
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {entry.mergeOption && (
            <section className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Merge Option</h3>
              <p className="text-xs text-zinc-300">
                {entry.mergeOption.tables.join("+")} ({entry.mergeOption.combinedSeats}-top) · {entry.mergeOption.estTime}
              </p>
              {entry.mergeOption.reason && <p className="mt-1 text-xs text-zinc-500">{entry.mergeOption.reason}</p>}
            </section>
          )}

          <section className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Guest Details</h3>
            <div className="space-y-1.5 text-xs text-zinc-300">
              {entry.phone && (
                <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-zinc-500" />{displayPhone(entry.phone)}</p>
              )}
              {entry.barTab !== undefined && <p>Bar tab: ${entry.barTab}</p>}
              {entry.preferences && <p>Preferences: {entry.preferences}</p>}
              {entry.notes && <p>Notes: {entry.notes}</p>}
              {!entry.phone && entry.barTab === undefined && !entry.preferences && !entry.notes && (
                <p className="text-zinc-500">No additional details captured.</p>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>
    </>
  )

  if (isDesktop) {
    return (
      <>
        <button className="fixed inset-0 z-40 bg-zinc-950/60" onClick={onClose} aria-hidden="true" />
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Waitlist detail for ${entry.name}`}
          className="fixed inset-y-0 right-0 z-50 flex w-[460px] flex-col border-l border-zinc-800/50 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
        >
          {content}
        </div>
      </>
    )
  }

  if (isTablet) {
    return (
      <>
        <button className="fixed inset-0 z-40 bg-zinc-950/60" onClick={onClose} aria-hidden="true" />
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Waitlist detail for ${entry.name}`}
          className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
        >
          {content}
        </div>
      </>
    )
  }

  return (
    <>
      <button className="fixed inset-0 z-40 bg-zinc-950/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Waitlist detail for ${entry.name}`}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-2xl border-t border-zinc-800/50 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-zinc-600" />
        </div>
        {content}
      </div>
    </>
  )
}
