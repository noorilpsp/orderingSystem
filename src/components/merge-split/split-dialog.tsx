"use client"

import { useState } from "react"
import { AlertTriangle, Info, Split, ArrowRight, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { floorTables, activeMerges } from "@/lib/merge-split-data"
import type { SplitTiming } from "@/lib/merge-split-data"

interface SplitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mergeId: string | null
  onConfirm: () => void
}

const TIME_OPTIONS = ["8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM"]

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

export function SplitDialog({ open, onOpenChange, mergeId, onConfirm }: SplitDialogProps) {
  const [splitTiming, setSplitTiming] = useState<SplitTiming>("when_leaves")
  const [splitTime, setSplitTime] = useState("9:00 PM")
  const [t8Assignment, setT8Assignment] = useState("available")
  const [t9Assignment, setT9Assignment] = useState("nakamura")

  const merge = activeMerges.find((m) => m.id === mergeId)
  if (!merge) return null

  const mergeTables = merge.tables.map((id) => floorTables.find((t) => t.id === id)).filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-surface-strong max-h-[90vh] max-w-lg overflow-y-auto border-border/30 p-0">
        <DialogHeader className="border-b border-border/20 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Split className="h-4 w-4 text-rose-400" />
            Split Tables
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-5 py-4">
          {/* Current state */}
          <section>
            <p className="mb-3 text-sm text-muted-foreground">
              Splitting: <span className="font-medium text-foreground">{merge.tables.join(" + ")}</span>{" "}
              (currently merged as {merge.combinedSeats}-top)
            </p>

            {/* Visual: merged -> split - own container (section-zone style) */}
            <div className="merge-dialog-section-box flex flex-col items-center gap-3 rounded-lg p-4">
              {/* Merged state */}
              <div className="flex items-center gap-0 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                {mergeTables.map((t, i) => (
                  <div key={t?.id} className="flex items-center gap-1">
                    {i > 0 && <span className="mx-1 text-xs text-emerald-400">+</span>}
                    <span className="text-xs font-bold text-emerald-400">T{t?.number}</span>
                    <span className="text-[10px] text-muted-foreground">({t?.seats}p)</span>
                  </div>
                ))}
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {merge.reservation.guest} ({merge.reservation.partySize}p)
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3 rotate-90" />
                splits into
              </div>

              {/* Split state */}
              <div className="flex items-center gap-4">
                {mergeTables.map((t) => (
                  <div
                    key={t?.id}
                    className="flex h-14 w-16 flex-col items-center justify-center rounded-lg border border-border/50 bg-secondary/30"
                  >
                    <span className="text-xs font-bold text-foreground">T{t?.number}</span>
                    <span className="text-[10px] text-muted-foreground">{t?.seats}p</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Warnings */}
          <section role="alert">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex flex-col gap-2">
                {merge.status === "in_use" && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <p className="text-xs text-amber-400">
                      {merge.reservation.guest} party ({merge.reservation.partySize}p) is currently seated at this merged table.
                      Splitting now would disrupt their service. Wait until they finish (~{formatTime(merge.reservation.estimatedEnd)}).
                    </p>
                  </div>
                )}

                {merge.conflictNote && (
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                    <p className="text-xs text-blue-400">
                      {merge.conflictNote}. Auto-split is scheduled for {formatTime(merge.autoSplitAt)}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <Separator className="bg-border/20" />

          {/* Split timing */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Split Timing
            </h3>
            <RadioGroup
              value={splitTiming}
              onValueChange={(v) => setSplitTiming(v as SplitTiming)}
              className="flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="now" id="split-now" />
                <Label htmlFor="split-now" className="text-xs text-foreground">
                  Split now{" "}
                  {merge.status === "in_use" && (
                    <Badge variant="outline" className="ml-1 h-4 border-amber-500/30 px-1 text-[9px] text-amber-400">
                      will disrupt service
                    </Badge>
                  )}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="when_leaves" id="split-leaves" />
                <Label htmlFor="split-leaves" className="text-xs text-foreground">
                  Split when current party leaves
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="specific_time" id="split-time" />
                <Label htmlFor="split-time" className="flex items-center gap-2 text-xs text-foreground">
                  Split at specific time:
                  {splitTiming === "specific_time" && (
                    <Select value={splitTime} onValueChange={setSplitTime}>
                      <SelectTrigger className="h-7 w-28 border-border/40 bg-secondary/30 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Label>
              </div>
            </RadioGroup>
          </section>

          <Separator className="bg-border/20" />

          {/* After split assignments */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              After Split, Assign
            </h3>
            <div className="flex flex-col gap-2.5">
              {mergeTables.map((t, i) => (
                <div key={t?.id} className="flex items-center gap-3">
                  <span className="w-8 text-xs font-semibold text-foreground">T{t?.number}:</span>
                  <Select
                    value={i === 0 ? t8Assignment : t9Assignment}
                    onValueChange={(v) => (i === 0 ? setT8Assignment(v) : setT9Assignment(v))}
                  >
                    <SelectTrigger className="h-7 flex-1 border-border/40 bg-secondary/30 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="nakamura">Nakamura (3p, 9:00 PM)</SelectItem>
                      <SelectItem value="hold">Hold for walkup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border/20 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-rose-500/80 text-rose-50 hover:bg-rose-500"
            onClick={onConfirm}
          >
            <Split className="h-3.5 w-3.5" />
            Confirm Split
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
