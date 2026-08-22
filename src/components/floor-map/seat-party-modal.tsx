"use client"

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react"
import {
  X,
  ArrowLeft,
  ArrowRight,
  Users,
  Check,
  NutOff,
  Leaf,
  LeafyGreen,
  Wheat,
  MilkOff,
  Shell,
  Cake,
  Gem,
  GraduationCap,
  PartyPopper,
  Heart,
  StickyNote,
  Sparkles,
  ChevronDown,
  MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { CurrentServer, FloorTable, SectionId, DietaryId, OccasionId, SeatPartyForm } from "@/lib/floor-map-data"
import {
  currentServer as defaultCurrentServer,
  defaultSectionConfig,
  dietaryOptions,
  occasionOptions,
  quickNoteSuggestions,
  getAvailableTables,
} from "@/lib/floor-map-data"
import { useIsMobile } from "@/hooks/use-mobile"

// ── Types ────────────────────────────────────────────────────────────────────

type Step = "size" | "table" | "review"
type ModalState = "form" | "success"

interface SeatPartyModalProps {
  sectionConfig?: Record<string, { name: string }>
  /** Real server from FloorMapView. Falls back to floor-map-data default when omitted (e.g. table page). */
  currentServer?: CurrentServer
  open: boolean
  tables: FloorTable[]
  preSelectedTableId?: string | null
  onClose: () => void
  onSeated: (formData: SeatPartyForm) => Promise<boolean>
  onViewTable?: (tableId: string) => void
}

// ── Dietary icons ────────────────────────────────────────────────────────────

const dietaryIcons: Record<DietaryId, typeof NutOff> = {
  nut_allergy: NutOff,
  vegetarian: Leaf,
  vegan: LeafyGreen,
  gluten_free: Wheat,
  dairy_free: MilkOff,
  shellfish: Shell,
}

const occasionIcons: Record<OccasionId, typeof Cake> = {
  birthday: Cake,
  anniversary: Heart,
  vip: Gem,
  graduation: GraduationCap,
  celebration: PartyPopper,
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SeatPartyModal({ sectionConfig = defaultSectionConfig, currentServer: currentServerProp, open, tables, preSelectedTableId, onClose, onSeated, onViewTable }: SeatPartyModalProps) {
  const currentServer = currentServerProp ?? defaultCurrentServer
  const isMobile = useIsMobile()
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Form State ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("size")
  const [modalState, setModalState] = useState<ModalState>("form")
  const [form, setForm] = useState<SeatPartyForm>({
    partySize: 2,
    tableId: null,
    dietary: [],
    occasion: null,
    notes: "",
  })
  const [customSize, setCustomSize] = useState("")
  const [showCustomSize, setShowCustomSize] = useState(false)
  const [showDietary, setShowDietary] = useState(false)
  const [showOccasion, setShowOccasion] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [tableFilter, setTableFilter] = useState<SectionId | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const wasOpenRef = useRef(false)

  // Reset only when the modal opens - not when `tables` refreshes during seating.
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open

    if (!justOpened) return

    const preTable = preSelectedTableId
      ? tables.find((t) => t.id === preSelectedTableId)
      : null

    setForm({
      partySize: preTable?.capacity ?? 2,
      tableId: preTable?.id ?? null,
      dietary: [],
      occasion: null,
      notes: "",
    })
    // Always start at "size" step - if table is preselected, we skip "table" step during navigation
    setStep("size")
    setModalState("form")
    setShowCustomSize(false)
    setShowDietary(false)
    setShowOccasion(false)
    setShowNotes(false)
    setValidationError(null)
    setSubmissionError(null)
    setTableFilter(null)
    setCustomSize("")
  }, [open, preSelectedTableId, tables])

  // ── Available Tables ────────────────────────────────────────────────────────
  const available = useMemo(
    () => getAvailableTables(tables, form.partySize, currentServer),
    [tables, form.partySize]
  )

  const filteredAvailable = useMemo(
    () => tableFilter ? available.filter((t) => t.section === tableFilter) : available,
    [available, tableFilter]
  )

  const selectedTable = useMemo(
    () => (form.tableId ? tables.find((t) => t.id === form.tableId) ?? null : null),
    [tables, form.tableId]
  )

  // ── Handlers ────────────────────────────────────────────────────────────────
  const setPartySize = useCallback((size: number) => {
    setForm((prev) => ({ 
      ...prev, 
      partySize: size, 
      // Don't clear tableId if we have a preselected table
      tableId: preSelectedTableId || null 
    }))
    setShowCustomSize(false)
    setValidationError(null)
    // Auto-advance after setting party size
    if (size >= 1) {
      // If table is preselected, skip table selection step
      if (preSelectedTableId) {
        setStep("review")
      } else {
        setStep("table")
      }
    }
  }, [preSelectedTableId])

  const selectTable = useCallback((tableId: string) => {
    setForm((prev) => ({ ...prev, tableId }))
    setValidationError(null)
    // Auto-advance to review after selecting a table
    setStep("review")
  }, [])

  const toggleDietary = useCallback((id: DietaryId) => {
    setForm((prev) => {
      const exists = prev.dietary.find((d) => d.restriction === id)
      if (exists) {
        return { ...prev, dietary: prev.dietary.filter((d) => d.restriction !== id) }
      }
      return { ...prev, dietary: [...prev.dietary, { restriction: id, seats: [] }] }
    })
  }, [])

  const selectOccasion = useCallback((id: OccasionId | null) => {
    setForm((prev) => ({
      ...prev,
      occasion: id ? { type: id, seat: null, notes: "" } : null,
    }))
  }, [])

  const addQuickNote = useCallback((note: string) => {
    setForm((prev) => ({
      ...prev,
      notes: prev.notes ? `${prev.notes}\n${note}` : note,
    }))
  }, [])

  const goNext = useCallback(() => {
    if (step === "size") {
      if (form.partySize < 1) { setValidationError("Party size must be at least 1"); return }
      // If table is preselected, skip table selection step
      if (preSelectedTableId && form.tableId) {
        setStep("review")
      } else {
        setStep("table")
      }
      setValidationError(null)
    } else if (step === "table") {
      if (!form.tableId) { setValidationError("Please select a table"); return }
      setStep("review")
      setValidationError(null)
    }
  }, [step, form.partySize, form.tableId, preSelectedTableId])

  const goBack = useCallback(() => {
    if (step === "table") setStep("size")
    else if (step === "review") {
      // If table was preselected, go back to size instead of table selection
      if (preSelectedTableId) {
        setStep("size")
      } else {
        setStep("table")
      }
    }
    setValidationError(null)
  }, [step, preSelectedTableId])

  const handleSeat = useCallback(() => {
    if (!form.tableId) return
    setSubmissionError(null)
    const payload = form
    onClose()
    void onSeated(payload)
  }, [form, onClose, onSeated])

  const handleSuccess = useCallback((action: "view" | "another") => {
    if (action === "another") {
      setForm({ partySize: 2, tableId: null, dietary: [], occasion: null, notes: "" })
      setStep("size")
      setModalState("form")
      setShowCustomSize(false)
      setShowDietary(false)
      setShowOccasion(false)
      setShowNotes(false)
      setSubmissionError(null)
    } else {
      if (form.tableId) {
        onViewTable?.(form.tableId)
      }
      onClose()
    }
  }, [form.tableId, onClose, onViewTable])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      if (e.key === "Escape") { e.preventDefault(); onClose() }
      else if (e.key === "Enter") {
        e.preventDefault()
        if (modalState === "success") handleSuccess("view")
        else if (step === "review") handleSeat()
        else goNext()
      }
      // Number keys for party size on step 1
      else if (step === "size" && modalState === "form") {
        const num = parseInt(e.key)
        if (num >= 1 && num <= 8) { e.preventDefault(); setPartySize(num) }
        else if (e.key === "9") { e.preventDefault(); setShowCustomSize(true) }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, step, modalState, goNext, handleSeat, handleSuccess, onClose, setPartySize])

  if (!open) return null

  // ── Step Progress ───────────────────────────────────────────────────────────
  const steps: Step[] = ["size", "table", "review"]
  const stepIndex = steps.indexOf(step)
  const stepLabels: Record<Step, string> = { size: "Party Size", table: "Table", review: "Review" }

  // ── Success State (legacy path; Seat Now closes the modal immediately) ─────
  if (modalState === "success") {
    return (
      <ModalShell onClose={onClose} isMobile={isMobile}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 animate-zoom-in">
          {/* Success icon */}
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 border border-primary/20">
              <Check className="h-10 w-10 text-primary" strokeWidth={2.5} />
            </div>
            <SuccessSparkles />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">
              Party seated at T{selectedTable?.number}!
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {form.partySize} guests &middot; {selectedTable ? (sectionConfig[selectedTable.section]?.name ?? selectedTable.section) : ""}
            </p>
          </div>
          <div className="flex flex-col gap-2.5 w-full max-w-xs mt-2">
            <Button
              data-testid="seat-party-view-table"
              onClick={() => handleSuccess("view")}
              className="h-12 rounded-xl bg-primary text-primary-foreground font-semibold tracking-wide hover:bg-primary/90"
            >
              View Table
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSuccess("another")}
              className="h-12 rounded-xl border-white/[0.1] bg-transparent text-foreground font-medium hover:bg-white/[0.06]"
            >
              Seat Another Party
            </Button>
          </div>
        </div>
      </ModalShell>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <ModalShell onClose={onClose} isMobile={isMobile}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-lg font-bold text-foreground tracking-tight">Seat Party</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-2.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
          Step {stepIndex + 1} of {steps.length}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i <= stepIndex ? "w-6 bg-primary" : "w-1.5 bg-white/[0.1]"
              )}
            />
          ))}
        </div>
      </div>

      {/* Step content (scrollable) */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {step === "size" && (
          <StepPartySize
            partySize={form.partySize}
            showCustom={showCustomSize}
            customSize={customSize}
            onSetSize={setPartySize}
            onShowCustom={() => { setShowCustomSize(true); setTimeout(() => inputRef.current?.focus(), 100) }}
            onCustomChange={setCustomSize}
            onCustomSubmit={() => {
              const n = parseInt(customSize)
              if (n >= 1 && n <= 20) setPartySize(n)
            }}
            inputRef={inputRef}
          />
        )}
        {step === "table" && (
          <StepTableSelection
            sectionConfig={sectionConfig}
            currentServer={currentServer}
            available={filteredAvailable}
            selectedTableId={form.tableId}
            partySize={form.partySize}
            sectionFilter={tableFilter}
            onSelectTable={selectTable}
            onSectionFilter={setTableFilter}
          />
        )}
        {step === "review" && (
          <StepReview
            sectionConfig={sectionConfig}
            currentServer={currentServer}
            form={form}
            selectedTable={selectedTable}
            showDietary={showDietary}
            showOccasion={showOccasion}
            showNotes={showNotes}
            onToggleDietary={() => setShowDietary((v) => !v)}
            onToggleOccasion={() => setShowOccasion((v) => !v)}
            onToggleNotes={() => setShowNotes((v) => !v)}
            onDietaryChange={toggleDietary}
            onOccasionChange={selectOccasion}
            onNotesChange={(n) => setForm((prev) => ({ ...prev, notes: n }))}
            onAddQuickNote={addQuickNote}
            onOccasionNotesChange={(n) =>
              setForm((prev) => ({
                ...prev,
                occasion: prev.occasion ? { ...prev.occasion, notes: n } : null,
              }))
            }
            onEditStep={setStep}
          />
        )}
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-2 border-t border-red-400/10 bg-red-500/[0.06] px-5 py-2.5">
          <span className="text-xs font-medium text-red-400">{validationError}</span>
        </div>
      )}
      {submissionError && (
        <div className="flex items-center gap-2 border-t border-red-400/10 bg-red-500/[0.06] px-5 py-2.5">
          <span className="text-xs font-medium text-red-400">{submissionError}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4 gap-3">
        {step === "review" ? (
          <>
            <Button
              variant="ghost"
              onClick={goBack}
              className="h-11 rounded-xl px-5 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
            <Button
              data-testid="seat-party-seat-now"
              onClick={handleSeat}
              disabled={!form.tableId}
              className="h-11 flex-1 max-w-[200px] rounded-xl bg-primary text-primary-foreground font-bold tracking-wide hover:bg-primary/90 disabled:opacity-40"
            >
              Seat Now
            </Button>
          </>
        ) : step === "size" ? (
          /* Size step - only show Cancel button */
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-11 rounded-xl px-5 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
          >
            Cancel
          </Button>
        ) : (
          /* Table step - show Back and Next */
          <>
            <Button
              variant="ghost"
              onClick={goBack}
              className="h-11 rounded-xl px-5 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={goNext}
              disabled={!form.tableId}
              className="h-11 rounded-xl bg-primary/90 text-primary-foreground font-semibold tracking-wide hover:bg-primary disabled:opacity-40 gap-1.5"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </ModalShell>
  )
}

// ── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({
  onClose,
  isMobile,
  children,
}: {
  onClose: () => void
  isMobile: boolean
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-slide-in"
        onClick={onClose}
        aria-hidden
      />
      {/* Modal */}
      <div
        className={cn(
          "relative z-10 flex flex-col animate-zoom-in",
          "border border-white/[0.08] bg-[hsl(225,15%,8%)] shadow-2xl shadow-black/40",
          isMobile
            ? "w-full max-h-[92dvh] rounded-t-2xl"
            : "w-full max-w-[600px] max-h-[85dvh] rounded-2xl mx-4"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Seat party"
      >
        {/* Mobile drag indicator */}
        {isMobile && (
          <div className="flex justify-center py-2">
            <div className="h-1 w-8 rounded-full bg-white/[0.15]" />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ── Step 1: Party Size ───────────────────────────────────────────────────────

function StepPartySize({
  partySize,
  showCustom,
  customSize,
  onSetSize,
  onShowCustom,
  onCustomChange,
  onCustomSubmit,
  inputRef,
}: {
  partySize: number
  showCustom: boolean
  customSize: string
  onSetSize: (n: number) => void
  onShowCustom: () => void
  onCustomChange: (v: string) => void
  onCustomSubmit: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const sizes = [1, 2, 3, 4, 5, 6, 7, 8]

  return (
    <div className="px-5 py-6">
      <h3 className="text-base font-semibold text-foreground mb-1">How many guests?</h3>
      <p className="text-xs text-muted-foreground/60 mb-5">
        Press 1-8 on keyboard for quick selection
      </p>

      <div className="grid grid-cols-4 gap-2.5">
        {sizes.map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`seat-party-size-${n}`}
            onClick={() => onSetSize(n)}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-xl border transition-all duration-150 h-16 sm:h-14",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              partySize === n
                ? "border-primary bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--glow-free)/0.2)]"
                : "border-white/[0.08] bg-white/[0.03] text-foreground/80 hover:bg-white/[0.06] hover:border-white/[0.12]",
              "active:scale-95"
            )}
            aria-label={`${n} guest${n > 1 ? "s" : ""}`}
          >
            <span className="font-mono text-xl font-bold">{n}</span>
            {n === 2 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 px-1.5 items-center rounded-full bg-primary/20 border border-primary/30">
                <span className="font-mono text-[8px] font-bold text-primary">COMMON</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 8+ button */}
      <button
        type="button"
        onClick={onShowCustom}
        className={cn(
          "mt-2.5 flex w-full items-center justify-center rounded-xl border h-12 transition-all duration-150",
          showCustom || partySize > 8
            ? "border-primary bg-primary/15 text-primary"
            : "border-white/[0.08] bg-white/[0.03] text-foreground/80 hover:bg-white/[0.06]",
          "active:scale-[0.99]"
        )}
      >
        <Users className="mr-2 h-4 w-4" />
        <span className="font-mono text-sm font-semibold">8+ guests</span>
      </button>

      {/* Custom input */}
      {showCustom && (
        <div className="mt-3 flex items-center gap-2 animate-fade-slide-in">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={20}
            value={customSize}
            onChange={(e) => onCustomChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onCustomSubmit() }}
            placeholder="Enter number"
            className="h-12 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 font-mono text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            aria-label="Custom party size"
          />
          <Button
            onClick={onCustomSubmit}
            disabled={!customSize || parseInt(customSize) < 1}
            className="h-12 rounded-xl bg-primary/90 px-5 text-primary-foreground font-semibold hover:bg-primary disabled:opacity-40"
          >
            Set
          </Button>
        </div>
      )}

      {/* Party size display */}
      <div className="mt-6 flex items-center justify-center gap-3 rounded-xl glass-surface px-4 py-3.5">
        <Users className="h-5 w-5 text-primary/70" />
        <span className="font-mono text-lg font-bold text-foreground tracking-wide">{partySize}</span>
        <span className="text-sm text-muted-foreground/60">guest{partySize !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}

// ── Step 2: Table Selection ──────────────────────────────────────────────────

function StepTableSelection({
  sectionConfig,
  currentServer,
  available,
  selectedTableId,
  partySize,
  sectionFilter,
  onSelectTable,
  onSectionFilter,
}: {
  sectionConfig: Record<string, { name: string }>
  currentServer: CurrentServer
  available: (FloorTable & { suggested: boolean; reason: string })[]
  selectedTableId: string | null
  partySize: number
  sectionFilter: SectionId | null
  onSelectTable: (id: string) => void
  onSectionFilter: (s: SectionId | null) => void
}) {
  const suggested = available.filter((t) => t.suggested)
  const others = available.filter((t) => !t.suggested)
  const sections: (SectionId | null)[] = [null, "patio", "bar", "main"]

  return (
    <div className="px-5 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Select table</h3>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            {available.length} available for {partySize} guest{partySize !== 1 ? "s" : ""}
          </p>
        </div>
        {suggested.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px] font-bold text-primary tracking-wide">SUGGESTED</span>
          </span>
        )}
      </div>

      {/* Section filter tabs */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-1">
        {sections.map((s) => (
          <button
            key={s ?? "all"}
            type="button"
            onClick={() => onSectionFilter(s)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all",
              sectionFilter === s
                ? "bg-primary/15 text-primary border border-primary/25"
                : "bg-white/[0.04] text-muted-foreground/70 border border-transparent hover:bg-white/[0.06]"
            )}
          >
            {s ? (sectionConfig[s]?.name ?? s) : "All"}
          </button>
        ))}
      </div>

      {available.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl glass-surface py-10 gap-3">
          <Users className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-foreground/80">No tables available</p>
          <p className="text-xs text-muted-foreground/50 text-center max-w-[220px]">
            All suitable tables are occupied. Try a different party size.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Suggested tables */}
          {suggested.length > 0 && (
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-primary/60 mb-2 block">
                Best matches
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {suggested.map((t) => (
                  <TablePickCard
                    key={t.id}
                    sectionConfig={sectionConfig}
                    currentServer={currentServer}
                    table={t}
                    selected={selectedTableId === t.id}
                    suggested
                    onSelect={() => onSelectTable(t.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other tables */}
          {others.length > 0 && (
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-2 block">
                Other available ({others.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {others.map((t) => (
                  <TablePickCard
                    key={t.id}
                    sectionConfig={sectionConfig}
                    currentServer={currentServer}
                    table={t}
                    selected={selectedTableId === t.id}
                    suggested={false}
                    onSelect={() => onSelectTable(t.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Table Pick Card ──────────────────────────────────────────────────────────

function TablePickCard({
  sectionConfig,
  currentServer,
  table,
  selected,
  suggested,
  onSelect,
}: {
  sectionConfig: Record<string, { name: string }>
  currentServer: CurrentServer
  table: FloorTable & { reason: string }
  selected: boolean
  suggested: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-center rounded-xl border p-3.5 transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "border-primary bg-primary/15 shadow-[0_0_14px_hsl(var(--glow-free)/0.2)]"
          : suggested
            ? "border-primary/20 bg-primary/[0.04] hover:bg-primary/[0.08]"
            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
        "active:scale-95"
      )}
      aria-label={`Table ${table.number}, ${table.capacity}-top, ${sectionConfig[table.section]?.name ?? table.section}`}
      aria-pressed={selected}
    >
      {selected && (
        <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
        </div>
      )}
      {suggested && !selected && (
        <div className="absolute top-1.5 right-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary/60" />
        </div>
      )}
      <span className={cn(
        "font-mono text-lg font-bold tracking-wide",
        selected ? "text-primary" : "text-foreground/90"
      )}>
        T{table.number}
      </span>
      <span className="flex items-center gap-1 mt-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="font-mono text-[10px] text-emerald-400/80">Free</span>
      </span>
      <span className="mt-1.5 text-[11px] text-muted-foreground/60">{table.capacity}-top</span>
      <span className="text-[10px] text-muted-foreground/40">{sectionConfig[table.section]?.name ?? table.section}</span>
      {table.section === currentServer.section && (
        <span className="mt-1 font-mono text-[9px] font-semibold text-primary/50 tracking-wider">YOUR SECTION</span>
      )}
    </button>
  )
}

// ── Step 3: Review ───────────────────────────────────────────────────────────

function StepReview({
  sectionConfig,
  currentServer,
  form,
  selectedTable,
  showDietary,
  showOccasion,
  showNotes,
  onToggleDietary,
  onToggleOccasion,
  onToggleNotes,
  onDietaryChange,
  onOccasionChange,
  onNotesChange,
  onAddQuickNote,
  onOccasionNotesChange,
  onEditStep,
}: {
  sectionConfig: Record<string, { name: string }>
  currentServer: CurrentServer
  form: SeatPartyForm
  selectedTable: FloorTable | null
  showDietary: boolean
  showOccasion: boolean
  showNotes: boolean
  onToggleDietary: () => void
  onToggleOccasion: () => void
  onToggleNotes: () => void
  onDietaryChange: (id: DietaryId) => void
  onOccasionChange: (id: OccasionId | null) => void
  onNotesChange: (n: string) => void
  onAddQuickNote: (n: string) => void
  onOccasionNotesChange: (n: string) => void
  onEditStep: (s: Step) => void
}) {
  return (
    <div className="px-5 py-6 space-y-4">
      {/* Summary */}
      <div className="rounded-xl glass-surface-strong p-4 space-y-3">
        {/* Party size - editable */}
        <button
          type="button"
          onClick={() => onEditStep("size")}
          className="flex w-full items-center justify-between rounded-lg px-1 py-1 -mx-1 hover:bg-white/[0.04] transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-primary/70" />
            <span className="text-sm text-foreground font-medium">{form.partySize} guests</span>
          </div>
          <span className="text-[10px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
        </button>

        <div className="border-t border-white/[0.04]" />

        {/* Table - editable */}
        <button
          type="button"
          onClick={() => onEditStep("table")}
          className="flex w-full items-center justify-between rounded-lg px-1 py-1 -mx-1 hover:bg-white/[0.04] transition-colors group"
        >
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-primary/70" />
            <div className="text-left">
              <span className="text-sm text-foreground font-medium">
                Table {selectedTable?.number}
              </span>
              <span className="text-xs text-muted-foreground/50 ml-2">
                {selectedTable ? `${selectedTable.capacity}-top, ${sectionConfig[selectedTable.section]?.name ?? selectedTable.section}` : ""}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
        </button>

        <div className="border-t border-white/[0.04]" />

        {/* Server */}
        <div className="flex items-center gap-3 px-1">
          <Sparkles className="h-4 w-4 text-muted-foreground/40" />
          <span className="text-sm text-muted-foreground/70">
            Server: {currentServer.name} <span className="text-primary/60 font-medium">(You)</span>
          </span>
        </div>
      </div>

      {/* Optional sections */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
          Guest info (optional)
        </p>

        {/* Dietary toggle */}
        <ToggleSection
          label="Dietary restrictions"
          icon={NutOff}
          open={showDietary}
          onToggle={onToggleDietary}
          count={form.dietary.length}
        >
          <div className="grid grid-cols-2 gap-2 pt-3">
            {dietaryOptions.map((d) => {
              const Icon = dietaryIcons[d.id]
              const isActive = form.dietary.some((fd) => fd.restriction === d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onDietaryChange(d.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                    isActive
                      ? "border-amber-400/30 bg-amber-400/[0.08] text-amber-300"
                      : "border-white/[0.06] bg-white/[0.02] text-muted-foreground/70 hover:bg-white/[0.04]",
                    "active:scale-95"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">{d.label}</span>
                  {isActive && <Check className="ml-auto h-3.5 w-3.5 text-amber-400" />}
                </button>
              )
            })}
          </div>
        </ToggleSection>

        {/* Occasion toggle */}
        <ToggleSection
          label="Special occasion"
          icon={Cake}
          open={showOccasion}
          onToggle={onToggleOccasion}
          count={form.occasion ? 1 : 0}
        >
          <div className="grid grid-cols-2 gap-2 pt-3">
            {occasionOptions.map((o) => {
              const Icon = occasionIcons[o.id]
              const isActive = form.occasion?.type === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onOccasionChange(isActive ? null : o.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                    isActive
                      ? "border-pink-400/30 bg-pink-400/[0.08] text-pink-300"
                      : "border-white/[0.06] bg-white/[0.02] text-muted-foreground/70 hover:bg-white/[0.04]",
                    "active:scale-95"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">{o.label}</span>
                  {isActive && <Check className="ml-auto h-3.5 w-3.5 text-pink-400" />}
                </button>
              )
            })}
          </div>
          {form.occasion && (
            <div className="mt-3 animate-fade-slide-in">
              <input
                type="text"
                value={form.occasion.notes}
                onChange={(e) => onOccasionNotesChange(e.target.value)}
                placeholder="Any special instructions..."
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
              />
            </div>
          )}
        </ToggleSection>

        {/* Notes toggle */}
        <ToggleSection
          label="Add notes"
          icon={StickyNote}
          open={showNotes}
          onToggle={onToggleNotes}
          count={form.notes ? 1 : 0}
        >
          <div className="space-y-3 pt-3">
            <textarea
              value={form.notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Notes for the kitchen or other servers..."
              rows={3}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none resize-none focus:border-primary/40 placeholder:text-muted-foreground/30"
            />
            <div className="flex flex-wrap gap-1.5">
              {quickNoteSuggestions.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => onAddQuickNote(note)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-muted-foreground/60 hover:bg-white/[0.06] hover:text-muted-foreground transition-colors active:scale-95"
                >
                  {note}
                </button>
              ))}
            </div>
          </div>
        </ToggleSection>
      </div>
    </div>
  )
}

// ── Toggle Section ───────────────────────────────────────────────────────────

function ToggleSection({
  label,
  icon: Icon,
  open,
  onToggle,
  count,
  children,
}: {
  label: string
  icon: typeof NutOff
  open: boolean
  onToggle: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <Icon className="h-4 w-4 text-muted-foreground/50" />
        <span className="text-sm font-medium text-foreground/80 flex-1 text-left">{label}</span>
        {count > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 px-1.5">
            <span className="font-mono text-[10px] font-bold text-primary">{count}</span>
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 animate-fade-slide-in">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Success Sparkles ─────────────────────────────────────────────────────────

function SuccessSparkles() {
  const sparkles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2
    const dist = 48 + Math.random() * 16
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      delay: i * 40,
      size: 3 + Math.random() * 3,
    }
  })

  return (
    <>
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-primary/70"
          style={{
            width: s.size,
            height: s.size,
            left: `calc(50% + ${s.x}px)`,
            top: `calc(50% + ${s.y}px)`,
            animation: `sparkle-burst 600ms ease-out ${s.delay}ms both`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes sparkle-burst {
          0% { opacity: 0; transform: scale(0) translate(-50%, -50%); }
          40% { opacity: 1; transform: scale(1.2) translate(-50%, -50%); }
          100% { opacity: 0; transform: scale(0.5) translate(-50%, -50%); }
        }
      `}</style>
    </>
  )
}
