"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useReservationsData } from "@/lib/reservations/reservationsDataContext"
import { useRestaurantMutations } from "@/lib/hooks/useRestaurantMutations"
import { WaitlistTopBar } from "./waitlist-top-bar"
import { WaitlistAlertBanner } from "./waitlist-alert-banner"
import { WaitlistCard } from "./waitlist-card"
import { WaitlistMatchingPanel } from "./waitlist-matching-panel"
import { WaitlistQrPanel } from "./waitlist-qr-panel"
import { WaitlistCompleted } from "./waitlist-completed"
import { WaitlistAddDialog } from "./waitlist-add-dialog"
import { WaitlistSeatDialog } from "./waitlist-seat-dialog"
import { WaitlistDetailPanel } from "./waitlist-detail-panel"
import { toast } from "sonner"
import {
  type WaitlistEntry,
  type SortMode,
  sortWaitlist,
  getElapsedMinutes,
  waitlistPartyToWaitlistEntry,
} from "@/lib/waitlist-data"

export function WaitlistView() {
  const isDesktop = useMediaQuery("(min-width: 1280px)")
  const isTablet = useMediaQuery("(min-width: 768px)")
  const { addToWaitlist, removeFromWaitlist, seatFromWaitlist } = useRestaurantMutations()

  const { waitlistParties, tables } = useReservationsData()
  const entries = useMemo(
    () => waitlistParties.map((wp) => waitlistPartyToWaitlistEntry(wp, tables)),
    [waitlistParties, tables]
  )

  const [sortMode, setSortMode] = useState<SortMode>("smart")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAlert, setShowAlert] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [seatDialog, setSeatDialog] = useState<{
    entry: WaitlistEntry
    tableId: string
    tableDisplayId?: string
  } | null>(null)
  const [showMatchPanel, setShowMatchPanel] = useState(false)
  const [detailEntry, setDetailEntry] = useState<WaitlistEntry | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [elapsedOffset, setElapsedOffset] = useState(0)
  const [signalFilters, setSignalFilters] = useState<Array<"ready" | "warning" | "overdue" | "no-match">>([])

  const sorted = useMemo(() => sortWaitlist(entries, sortMode, elapsedOffset), [elapsedOffset, entries, sortMode])

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedOffset((prev) => prev + 1)
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!detailEntry) return
    const stillExists = entries.some((entry) => entry.id === detailEntry.id)
    if (!stillExists) {
      setDetailOpen(false)
      setDetailEntry(null)
    }
  }, [detailEntry, entries])

  // Alert match: first entry with ready-now match
  const alertEntry = entries.find((e) => e.bestMatch?.status === "ready-now")

  const handleSeatAt = useCallback(
    (entry: WaitlistEntry, tableId: string) => {
      if (!tableId) {
        // "Choose table" - open matching panel on tablet
        if (!isDesktop) setShowMatchPanel(true)
        return
      }
      const m = entry.bestMatch?.tableId === tableId ? entry.bestMatch : entry.altMatches.find((x) => x.tableId === tableId)
      const tableDisplayId = m?.displayId ?? (m ? `T${m.seats}` : undefined)
      setSeatDialog({ entry, tableId, tableDisplayId })
    },
    [isDesktop],
  )

  const handleConfirmSeat = useCallback(async () => {
    if (!seatDialog) return
    try {
      await seatFromWaitlist(seatDialog.entry.id, seatDialog.tableId)
      setSeatDialog(null)
      setShowAlert(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to seat party"
      toast.error(msg)
    }
  }, [seatDialog, seatFromWaitlist])

  const handleRemove = useCallback(async (id: string) => {
    await removeFromWaitlist(id)
  }, [removeFromWaitlist])

  const handleOpenDetail = useCallback((entry: WaitlistEntry) => {
    setDetailEntry(entry)
    setDetailOpen(true)
  }, [])

  const handleAdd = useCallback(
    async (data: { name: string; phone: string; partySize: number; quote: number }) => {
      await addToWaitlist({
        guestName: data.name,
        partySize: data.partySize,
        phone: data.phone,
        waitTime: `${data.quote} min`,
      })
    },
    [addToWaitlist],
  )

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "smart", label: "Smart" },
    { value: "wait-time", label: "Wait Time" },
    { value: "party-size", label: "Party Size" },
    { value: "quoted-time", label: "Quoted Time" },
  ]

  const queueSignals = useMemo(() => {
    let readyNow = 0
    let warning = 0
    let overdue = 0
    let noMatch = 0

    for (const entry of entries) {
      const ratio = (getElapsedMinutes(entry) + elapsedOffset) / Math.max(entry.quotedWait, 1)
      if (entry.bestMatch?.status === "ready-now") readyNow += 1
      if (!entry.bestMatch) noMatch += 1
      if (ratio >= 0.7 && ratio < 1) warning += 1
      if (ratio >= 1) overdue += 1
    }

    return {
      total: entries.length,
      readyNow,
      warning,
      overdue,
      noMatch,
    }
  }, [elapsedOffset, entries])

  const matchesSignalFilter = useCallback(
    (entry: WaitlistEntry, filter: "ready" | "warning" | "overdue" | "no-match") => {
      const ratio = (getElapsedMinutes(entry) + elapsedOffset) / Math.max(entry.quotedWait, 1)
      if (filter === "ready") return entry.bestMatch?.status === "ready-now"
      if (filter === "warning") return ratio >= 0.7 && ratio < 1
      if (filter === "overdue") return ratio >= 1
      return !entry.bestMatch
    },
    [elapsedOffset]
  )

  const toggleSignalFilter = useCallback((filter: "ready" | "warning" | "overdue" | "no-match") => {
    setSignalFilters((prev) => {
      if (prev.includes(filter)) return prev.filter((item) => item !== filter)
      return [...prev, filter]
    })
  }, [])

  const clearSignalFilters = useCallback(() => setSignalFilters([]), [])

  const visibleEntries = useMemo(() => {
    if (signalFilters.length === 0) return sorted
    return sorted.filter((entry) => signalFilters.some((filter) => matchesSignalFilter(entry, filter)))
  }, [matchesSignalFilter, signalFilters, sorted])

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_15%_-20%,rgba(16,185,129,0.15),transparent_34%),radial-gradient(circle_at_85%_120%,rgba(6,182,212,0.1),transparent_36%)]">
      <WaitlistTopBar
        onAddParty={() => setShowAddDialog(true)}
        sortMode={sortMode}
        sortOptions={sortOptions}
        onSortModeChange={setSortMode}
        signalCounts={queueSignals}
        selectedSignalFilters={signalFilters}
        onToggleSignalFilter={toggleSignalFilter}
        onClearSignalFilters={clearSignalFilters}
      />

      {/* Alert Banner */}
      {showAlert && alertEntry && (
        <WaitlistAlertBanner
          tableId={alertEntry.bestMatch!.tableId}
          partyName={alertEntry.name}
          partySize={alertEntry.partySize}
          waitedMin={getElapsedMinutes(alertEntry) + elapsedOffset}
          quotedMin={alertEntry.quotedWait}
          onSeatNow={() => handleSeatAt(alertEntry, alertEntry.bestMatch!.tableId)}
          onDismiss={() => setShowAlert(false)}
        />
      )}

      {/* Main content */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(24,24,27,0.65)_0%,rgba(9,9,11,0.85)_65%)]" />
        {/* Left column: Waitlist Queue */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto border-r border-zinc-800/40 scrollbar-none xl:border-r-0">
          {/* Sort header */}
          <div className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/85 px-4 py-3 backdrop-blur-xl md:border-b-0 md:px-0 md:py-0 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-zinc-800/60 bg-zinc-900/60 p-1 md:hidden">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortMode(opt.value)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                      sortMode === opt.value
                        ? "bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]"
                        : "text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300"
                    }`}
                    aria-label={`Sort by ${opt.label}`}
                  >
                    {opt.label}
                  </button>
                ))}
                {/* Tablet: show matching panel button */}
                {!isDesktop && isTablet && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMatchPanel(true)}
                    className="ml-1 h-6 border-zinc-700 bg-zinc-800/60 px-2 text-[10px] text-zinc-400 hover:bg-zinc-700"
                  >
                    Matching
                  </Button>
                )}
              </div>
            </div>

          </div>

          {/* Card list */}
          <div className="relative flex flex-col gap-3 px-4 pb-5 pt-3 lg:px-6">
            {visibleEntries.map((entry, i) => (
              <div
                key={entry.id}
                className="wl-card-stagger"
                style={{ "--card-index": i } as React.CSSProperties}
              >
                <WaitlistCard
                  entry={entry}
                  position={i + 1}
                  elapsedOffset={elapsedOffset}
                  isExpanded={expandedId === entry.id}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === entry.id ? null : entry.id))
                  }
                  onOpenDetail={() => handleOpenDetail(entry)}
                  onSeatAt={(tableId) => handleSeatAt(entry, tableId)}
                  onTextGuest={() => {}}
                  onRemove={() => handleRemove(entry.id)}
                  onConvert={() => {}}
                />
              </div>
            ))}

            {/* Add button at bottom */}
            <button
              onClick={() => setShowAddDialog(true)}
              className="group flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 py-3 text-sm text-zinc-400 transition-all hover:border-emerald-400/45 hover:bg-emerald-500/10 hover:text-zinc-200"
            >
              <Plus className="h-4 w-4 text-emerald-400 transition-transform group-hover:rotate-90" />
              Add to Waitlist
            </button>

            {/* Completed / Removed */}
            <WaitlistCompleted />
          </div>
        </div>

        {/* Right column: Desktop matching panel */}
        {isDesktop && (
          <div className="relative z-10 w-[410px] flex-shrink-0 overflow-y-auto border-l border-zinc-800/50 bg-zinc-950/70 p-4 backdrop-blur-xl scrollbar-none">
            <div className="mb-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300">Host Brain</div>
              <div className="mt-1 text-xs text-zinc-400">Live table turnover, best-fit matching, and quote calibration.</div>
            </div>
            <WaitlistMatchingPanel entries={entries} tables={tables} />
            <div className="mt-4">
              <WaitlistQrPanel />
            </div>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      {!isTablet && (
        <div className="fixed bottom-24 right-4 z-40">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full bg-emerald-600 p-0 shadow-lg shadow-emerald-900/40 hover:bg-emerald-500"
            onClick={() => setShowAddDialog(true)}
            aria-label="Add to waitlist"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Tablet: Matching Panel Sheet */}
      {!isDesktop && (
        <Sheet open={showMatchPanel} onOpenChange={setShowMatchPanel}>
          <SheetContent
            side={isTablet ? "right" : "bottom"}
            className="w-full overflow-y-auto border-zinc-800 bg-zinc-900 p-4 sm:max-w-[420px]"
          >
            <SheetHeader className="mb-4">
              <SheetTitle className="text-zinc-100">Smart Matching</SheetTitle>
              <SheetDescription className="text-zinc-500">Table availability and forecasts</SheetDescription>
            </SheetHeader>
            <WaitlistMatchingPanel entries={entries} tables={tables} />
            <div className="mt-4">
              <WaitlistQrPanel />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Add Dialog */}
      <WaitlistAddDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAdd}
      />

      {/* Seat Confirmation Dialog */}
      <WaitlistSeatDialog
        open={!!seatDialog}
        onOpenChange={(open) => { if (!open) setSeatDialog(null) }}
        entry={seatDialog?.entry ?? null}
        tableId={seatDialog?.tableId ?? ""}
        tableDisplayId={seatDialog?.tableDisplayId}
        onConfirm={handleConfirmSeat}
      />

      <WaitlistDetailPanel
        entry={detailEntry}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onSeatAt={(tableId) => {
          if (!detailEntry) return
          handleSeatAt(detailEntry, tableId)
        }}
        onTextGuest={() => {}}
        onRemove={() => {
          if (!detailEntry) return
          handleRemove(detailEntry.id)
          setDetailOpen(false)
        }}
        onConvert={() => {}}
      />
    </div>
  )
}
