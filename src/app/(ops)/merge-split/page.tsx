"use client"

import { useState, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Layers, Zap, Link2, ChevronUp } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

import { MergeTopBar } from "@/components/merge-split/merge-top-bar"
import { MergeFloorPlan } from "@/components/merge-split/merge-floor-plan"
import { ActiveMergesPanel } from "@/components/merge-split/active-merges-panel"
import { MergeSuggestionsPanel } from "@/components/merge-split/merge-suggestions-panel"
import { CombinationsPanel } from "@/components/merge-split/combinations-panel"
import { NewMergeDialog } from "@/components/merge-split/new-merge-dialog"
import { SplitDialog } from "@/components/merge-split/split-dialog"
import { MergeHistoryPanel } from "@/components/merge-split/merge-history-panel"
import { MobileMergeList } from "@/components/merge-split/mobile-merge-list"
import {
  activeMerges,
  compatibleCombinations,
  mergeSuggestions,
} from "@/lib/merge-split-data"

export default function MergeSplitPage() {
  const isMobile = useIsMobile()

  // Selection state
  const [selectedTables, setSelectedTables] = useState<string[]>([])

  // Dialog state
  const [newMergeOpen, setNewMergeOpen] = useState(false)
  const [splitMergeId, setSplitMergeId] = useState<string | null>(null)
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Bottom sheet state for tablet
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)

  // Available combos count
  const availableCombos = compatibleCombinations.filter((c) => c.available).length

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTableSelect = useCallback((tableId: string) => {
    setSelectedTables((prev) => {
      if (prev.includes(tableId)) {
        return prev.filter((id) => id !== tableId)
      }
      return [...prev, tableId]
    })
  }, [])

  const handleMergedTableClick = useCallback((mergeId: string) => {
    setSplitMergeId(mergeId)
    setSplitDialogOpen(true)
  }, [])

  const handleNewMerge = useCallback(() => {
    if (selectedTables.length >= 2) {
      setNewMergeOpen(true)
    }
  }, [selectedTables])

  const handleNewMergeButton = useCallback(() => {
    // Clear selection and let user pick
    setSelectedTables([])
    // If they already have tables selected, open dialog
    if (selectedTables.length >= 2) {
      setNewMergeOpen(true)
    }
  }, [selectedTables])

  const handleSplit = useCallback((mergeId: string) => {
    setSplitMergeId(mergeId)
    setSplitDialogOpen(true)
  }, [])

  const handleApplyMerge = useCallback((tables: string[]) => {
    setSelectedTables(tables)
    setNewMergeOpen(true)
  }, [])

  const handleSelectCombination = useCallback((tables: string[]) => {
    setSelectedTables(tables)
  }, [])

  const handleConfirmMerge = useCallback(() => {
    setNewMergeOpen(false)
    setSelectedTables([])
  }, [])

  const handleConfirmSplit = useCallback(() => {
    setSplitDialogOpen(false)
    setSplitMergeId(null)
  }, [])

  const handleChangeSelection = useCallback(() => {
    setNewMergeOpen(false)
    setSelectedTables([])
  }, [])

  // Auto-open merge dialog when 2+ tables selected
  const handleTableSelectWithAutoOpen = useCallback(
    (tableId: string) => {
      handleTableSelect(tableId)
    },
    [handleTableSelect]
  )

  // ── Mobile Layout ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex h-full flex-col">
        <MergeTopBar
          activeMergeCount={activeMerges.length}
          availableCombosCount={availableCombos}
          onNewMerge={handleNewMergeButton}
          onViewHistory={() => setHistoryOpen(true)}
        />
        <ScrollArea className="flex-1">
          <MobileMergeList
            activeMerges={activeMerges}
            suggestions={mergeSuggestions}
            combinations={compatibleCombinations}
            onSplit={handleSplit}
            onApplyMerge={handleApplyMerge}
            onSelectCombination={(tables) => {
              setSelectedTables(tables)
              setNewMergeOpen(true)
            }}
            onViewHistory={() => setHistoryOpen(true)}
          />
        </ScrollArea>

        <NewMergeDialog
          open={newMergeOpen}
          onOpenChange={setNewMergeOpen}
          selectedTables={selectedTables}
          onConfirm={handleConfirmMerge}
          onAddTable={handleChangeSelection}
          onChangeSelection={handleChangeSelection}
        />
        <SplitDialog
          open={splitDialogOpen}
          onOpenChange={setSplitDialogOpen}
          mergeId={splitMergeId}
          onConfirm={handleConfirmSplit}
        />
        <MergeHistoryPanel open={historyOpen} onOpenChange={setHistoryOpen} />
      </div>
    )
  }

  // ── Desktop/Tablet Layout ─────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      <MergeTopBar
        activeMergeCount={activeMerges.length}
        availableCombosCount={availableCombos}
        onNewMerge={handleNewMergeButton}
        onViewHistory={() => setHistoryOpen(true)}
      />

      {/* Selection info bar */}
      {selectedTables.length > 0 && (
        <div className="merge-selection-bar flex items-center justify-between border-b border-cyan-500/20 bg-cyan-500/5 px-4 py-2">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="border-cyan-500/30 bg-cyan-500/15 text-cyan-400">
              {selectedTables.length} table{selectedTables.length > 1 ? "s" : ""} selected
            </Badge>
            <span className="text-muted-foreground">
              {selectedTables.join(" + ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedTables.length >= 2 && (
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleNewMerge}>
                Create Merge
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setSelectedTables([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left: Floor Plan */}
        <div className="flex-1 p-3">
          <MergeFloorPlan
            selectedTables={selectedTables}
            onTableSelect={handleTableSelectWithAutoOpen}
            onMergedTableClick={handleMergedTableClick}
          />
        </div>

        {/* Right: Tabbed Config Panel (hidden on tablet, shown on desktop) - same container/theme as table-merge */}
        <div className="merge-panel-right hidden w-[380px] shrink-0 border-l border-border/20 xl:flex xl:flex-col">
          <Tabs defaultValue="active" className="flex h-full flex-col">
            <div className="shrink-0 border-b border-border/20 px-2 pt-2">
              <TabsList className="grid w-full grid-cols-3 bg-secondary/30">
                <TabsTrigger value="active" className="gap-1.5 text-xs">
                  <Layers className="h-3 w-3" />
                  Active
                  {activeMerges.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[9px]">
                      {activeMerges.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="gap-1.5 text-xs">
                  <Zap className="h-3 w-3" />
                  Suggest
                  {mergeSuggestions.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[9px]">
                      {mergeSuggestions.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="combos" className="gap-1.5 text-xs">
                  <Link2 className="h-3 w-3" />
                  Combos
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[9px]">
                    {availableCombos}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4">
                <TabsContent value="active" className="mt-0">
                  <ActiveMergesPanel
                    merges={activeMerges}
                    onSplit={handleSplit}
                    onViewDetails={handleMergedTableClick}
                  />
                </TabsContent>
                <TabsContent value="suggestions" className="mt-0">
                  <MergeSuggestionsPanel
                    suggestions={mergeSuggestions}
                    onApplyMerge={handleApplyMerge}
                  />
                </TabsContent>
                <TabsContent value="combos" className="mt-0">
                  <CombinationsPanel
                    combinations={compatibleCombinations}
                    onSelectCombination={handleSelectCombination}
                  />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Tablet: Bottom sheet trigger */}
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 xl:hidden">
          <Sheet open={bottomSheetOpen} onOpenChange={setBottomSheetOpen}>
            <SheetTrigger asChild>
              <button className="glass-surface-strong mx-3 flex w-[calc(100%-24px)] items-center justify-between rounded-t-xl border-b-0 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">Active Merges ({activeMerges.length})</span>
                  <div className="flex items-center gap-2">
                    {activeMerges.map((m) => (
                      <Badge
                        key={m.id}
                        variant="secondary"
                        className={`text-[10px] ${
                          m.status === "in_use"
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                            : "border-blue-500/30 bg-blue-500/15 text-blue-400"
                        }`}
                      >
                        {m.tables.join("+")} ({m.combinedSeats}p)
                      </Badge>
                    ))}
                  </div>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="glass-surface-strong h-[70vh] rounded-t-2xl border-border/30 p-0">
              <div className="mx-auto mb-3 mt-2 h-1 w-10 rounded-full bg-muted-foreground/20" />
              <Tabs defaultValue="active" className="flex h-full flex-col">
                <TabsList className="mx-4 mb-2 grid grid-cols-4 bg-secondary/30">
                  <TabsTrigger value="active" className="gap-1 text-xs">
                    <Layers className="h-3 w-3" />
                    Active
                  </TabsTrigger>
                  <TabsTrigger value="suggestions" className="gap-1 text-xs">
                    <Zap className="h-3 w-3" />
                    Suggest
                  </TabsTrigger>
                  <TabsTrigger value="combos" className="gap-1 text-xs">
                    <Link2 className="h-3 w-3" />
                    Combos
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">
                    History
                  </TabsTrigger>
                </TabsList>
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    <TabsContent value="active" className="mt-0">
                      <ActiveMergesPanel
                        merges={activeMerges}
                        onSplit={handleSplit}
                        onViewDetails={handleMergedTableClick}
                      />
                    </TabsContent>
                    <TabsContent value="suggestions" className="mt-0">
                      <MergeSuggestionsPanel
                        suggestions={mergeSuggestions}
                        onApplyMerge={handleApplyMerge}
                      />
                    </TabsContent>
                    <TabsContent value="combos" className="mt-0">
                      <CombinationsPanel
                        combinations={compatibleCombinations}
                        onSelectCombination={handleSelectCombination}
                      />
                    </TabsContent>
                    <TabsContent value="history" className="mt-0">
                      <div className="text-sm text-muted-foreground">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setBottomSheetOpen(false)
                            setHistoryOpen(true)
                          }}
                        >
                          Open Full History Panel
                        </Button>
                      </div>
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Dialogs */}
      <NewMergeDialog
        open={newMergeOpen}
        onOpenChange={setNewMergeOpen}
        selectedTables={selectedTables}
        onConfirm={handleConfirmMerge}
        onAddTable={handleChangeSelection}
        onChangeSelection={handleChangeSelection}
      />
      <SplitDialog
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        mergeId={splitMergeId}
        onConfirm={handleConfirmSplit}
      />
      <MergeHistoryPanel open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  )
}
