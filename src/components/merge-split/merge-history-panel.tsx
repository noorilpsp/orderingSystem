"use client"

import { useMemo } from "react"
import { Check, Clock, History, Combine, Timer, BarChart3, TrendingUp, CalendarDays } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { mergeHistory } from "@/lib/merge-split-data"

interface MergeHistoryPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

export function MergeHistoryPanel({ open, onOpenChange }: MergeHistoryPanelProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, typeof mergeHistory> = {}
    for (const entry of mergeHistory) {
      const key = entry.date
      if (!groups[key]) groups[key] = []
      groups[key].push(entry)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [])

  // Analytics
  const completedEntries = mergeHistory.filter((e) => e.status === "completed")
  const avgDuration = completedEntries.length > 0
    ? Math.round(completedEntries.reduce((sum, e) => sum + (e.duration || 0), 0) / completedEntries.length)
    : 0

  // Most merged combination
  const comboCounts: Record<string, number> = {}
  for (const entry of mergeHistory) {
    const key = entry.tables.join("+")
    comboCounts[key] = (comboCounts[key] || 0) + 1
  }
  const mostMerged = Object.entries(comboCounts).sort(([, a], [, b]) => b - a)[0]

  // Avg party size from guest strings
  const partySizes = mergeHistory.map((e) => {
    const match = e.guest.match(/\((\d+)p\)/)
    return match ? parseInt(match[1]) : 0
  }).filter((n) => n > 0)
  const avgPartySize = partySizes.length > 0
    ? (partySizes.reduce((a, b) => a + b, 0) / partySizes.length).toFixed(1)
    : "0"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="glass-surface-strong w-full max-w-md border-border/30 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border/20 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-cyan-400" />
            Merge History
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="flex flex-col gap-4 p-5">
            {/* Day groups */}
            {grouped.map(([date, entries], gIdx) => {
              const isToday = date === "2025-01-17"
              const isYesterday = date === "2025-01-16"
              const label = isToday
                ? "Today, Friday Jan 17"
                : isYesterday
                  ? "Yesterday, Thursday Jan 16"
                  : formatDate(date)

              return (
                <div key={date}>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{label}</h3>
                  <div className="flex flex-col gap-2">
                    {entries.map((entry, i) => (
                      <Card
                        key={`${date}-${i}`}
                        className="glass-surface overflow-hidden border-border/20 p-0"
                        style={{ animationDelay: `${(gIdx * entries.length + i) * 50}ms` }}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Combine className="h-3.5 w-3.5 text-cyan-400/70" />
                              <span className="text-sm font-medium text-foreground">
                                {entry.tables.join("+")} -- {entry.tables.length * 4} seats
                              </span>
                            </div>
                            <Badge
                              variant="secondary"
                              className={
                                entry.status === "active"
                                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                                  : "border-border/40 bg-secondary/50 text-muted-foreground"
                              }
                            >
                              {entry.status === "active" ? "Active" : "Completed"}
                            </Badge>
                          </div>

                          <div className="mt-2 flex flex-col gap-1 pl-5.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-2.5 w-2.5" />
                              {entry.time}
                            </div>
                            <div>{entry.guest}</div>
                            {entry.duration && (
                              <div className="flex items-center gap-1.5">
                                <Timer className="h-2.5 w-2.5" />
                                Duration: {formatDuration(entry.duration)}
                              </div>
                            )}
                            {entry.status === "completed" && (
                              <div className="flex items-center gap-1.5">
                                <Check className="h-2.5 w-2.5 text-emerald-400/70" />
                                {entry.autoSplit
                                  ? "Auto-split"
                                  : `Manual split by ${entry.splitBy}`}
                              </div>
                            )}
                            {entry.createdBy && (
                              <div className="text-muted-foreground/60">
                                Created by {entry.createdBy}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}

            <Separator className="bg-border/20" />

            {/* Analytics - class for ops-tables sheet styling parity */}
            <div className="merge-history-analytics">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                Merge Analytics
              </h3>
              <Card className="glass-surface border-border/20 p-0 rounded-xl">
                <div className="grid grid-cols-2 gap-0">
                  <div className="merge-history-analytics-cell border-b border-r border-border/15 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">This Week</div>
                    <div className="mt-1 text-lg font-bold text-foreground">{mergeHistory.length} merges</div>
                  </div>
                  <div className="merge-history-analytics-cell border-b border-border/15 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Avg Duration</div>
                    <div className="mt-1 text-lg font-bold text-foreground">{formatDuration(avgDuration)}</div>
                  </div>
                  <div className="merge-history-analytics-cell border-r border-border/15 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Most Merged</div>
                    <div className="mt-1 text-sm font-bold text-foreground">
                      {mostMerged ? `${mostMerged[0]} (${mostMerged[1]}x)` : "--"}
                    </div>
                  </div>
                  <div className="merge-history-analytics-cell p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Avg Party Size</div>
                    <div className="mt-1 text-lg font-bold text-foreground">{avgPartySize} guests</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
