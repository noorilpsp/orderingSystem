"use client"

import { useState, useRef } from "react"
import {
  BarChart3, Calendar, Download, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { KpiBar } from "@/components/analytics/kpi-bar"
import { OverviewTab } from "@/components/analytics/overview-tab"
import { CoversRevenueTab } from "@/components/analytics/covers-revenue-tab"
import { NoShowsTab } from "@/components/analytics/no-shows-tab"
import { TurnTimesTab } from "@/components/analytics/turn-times-tab"
import { ChannelsTab } from "@/components/analytics/channels-tab"
import { WaitlistTab } from "@/components/analytics/waitlist-tab"

const PERIOD_OPTIONS = [
  "Today",
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
  "Last Month",
  "This Quarter",
  "Custom Range",
]

const COMPARE_OPTIONS = [
  "Previous Period",
  "Same Period Last Year",
  "Target / Budget",
]

const TAB_ITEMS = [
  { value: "overview", label: "Overview" },
  { value: "covers-revenue", label: "Covers & Revenue" },
  { value: "no-shows", label: "No-Shows" },
  { value: "turn-times", label: "Turn Times" },
  { value: "channels", label: "Channels" },
  { value: "waitlist", label: "Waitlist" },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("Last 30 Days")
  const [compare, setCompare] = useState("Previous Period")
  const [activeTab, setActiveTab] = useState("overview")
  const contentRef = useRef<HTMLDivElement>(null)

  function handleKpiClick(tabLink: string) {
    setActiveTab(tabLink)
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Sticky Top Bar ──────────────────────────────────── */}
      <div className="shrink-0 border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl">
        {/* Title row */}
        <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-2 md:px-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <h1 className="text-lg font-bold tracking-tight text-foreground">Reservation Analytics</h1>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Period selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 hover:bg-zinc-800">
                  <Calendar className="h-3 w-3" />
                  {period}
                  <ChevronDown className="h-3 w-3 text-zinc-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900">
                {PERIOD_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt} onSelect={() => setPeriod(opt)} className="text-xs text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                    {opt}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Compare selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden h-8 gap-1 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 hover:bg-zinc-800 md:flex">
                  Compare: {compare}
                  <ChevronDown className="h-3 w-3 text-zinc-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900">
                {COMPARE_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt} onSelect={() => setCompare(opt)} className="text-xs text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                    {opt}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export */}
            <Button variant="outline" size="sm" className="h-8 gap-1 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 hover:bg-zinc-800" aria-label="Export analytics report as PDF">
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* KPI bar */}
        <KpiBar onKpiClick={handleKpiClick} />
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-zinc-800/50 bg-zinc-950/80 px-4 md:px-6">
          <TabsList className="scrollbar-none flex h-10 w-full justify-start gap-0 overflow-x-auto bg-transparent p-0">
            {TAB_ITEMS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium text-zinc-500 data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 md:text-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1" ref={contentRef}>
          <div className="p-4 md:p-6">
            <TabsContent value="overview" className="mt-0">
              <OverviewTab />
            </TabsContent>
            <TabsContent value="covers-revenue" className="mt-0">
              <CoversRevenueTab />
            </TabsContent>
            <TabsContent value="no-shows" className="mt-0">
              <NoShowsTab />
            </TabsContent>
            <TabsContent value="turn-times" className="mt-0">
              <TurnTimesTab />
            </TabsContent>
            <TabsContent value="channels" className="mt-0">
              <ChannelsTab />
            </TabsContent>
            <TabsContent value="waitlist" className="mt-0">
              <WaitlistTab />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
