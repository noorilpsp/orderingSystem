"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import type { CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StatusBadge } from "@/components/ui/status-badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Drawer } from "@/components/ui/drawer"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarPanel } from "@/components/ui/sidebar-panel"
import ConnectedRecords from "@/components/connected/ConnectedRecords"
import { cn } from "@/lib/utils"
import {
  Search,
  RefreshCw,
  Download,
  Settings,
  Grid3x3,
  List,
  Eye,
  MoreHorizontal,
  CheckCircle,
  Trash2,
  Users,
  Clock,
  MapPin,
  QrCode,
  ChevronDown,
  Plus,
  Calendar,
  Sparkles,
  DollarSign,
  Edit,
  X,
  ChevronRight,
  UserCheck,
  UtensilsCrossed,
  Book as Broom,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { useRestaurantStore } from "@/store/restaurantStore"
import { SECTION_CONFIG } from "@/store/types"
import type { StoreTable } from "@/store/types"
import {
  buildTableLiveMetricsMap,
  calculateDashboardOrderMetrics,
  type DashboardOrderMetrics,
  type TableLiveMetrics,
} from "@/lib/store/order-analytics"
import { useLocations } from "@/lib/hooks/useLocations"
import { TableQrDialog } from "@/components/dashboard/table-qr-dialog"

type ViewMode = "grid" | "list"
type TableStatus = "all" | "available" | "occupied" | "reserved" | "cleaning"

function storeTableToDisplay(t: StoreTable) {
  const seatedAtMillis = t.seatedAt ? new Date(t.seatedAt).getTime() : null
  const fallbackDuration =
    seatedAtMillis && Number.isFinite(seatedAtMillis)
      ? Math.max(0, Math.round((Date.now() - seatedAtMillis) / 60000))
      : undefined
  const status =
    t.status === "free" || t.status === "closed"
      ? "available"
      : t.status === "active" || t.status === "urgent" || t.status === "billing"
        ? "occupied"
        : t.status
  return {
    id: t.id,
    number: String(t.number),
    section: SECTION_CONFIG[t.section],
    status,
    capacity: t.capacity,
    guests: t.guests,
    server: t.serverName ?? undefined,
    orderId: t.orderId ?? undefined,
    seatedAt: t.seatedAt ?? undefined,
    shape: t.shape,
    duration: fallbackDuration,
    ticketTotal: 0,
    waveCount: t.session?.waveCount ?? 0,
  }
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min"
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins} min`
  }
  return `${minutes} min`
}

const mockStaffWorkload = [
  { id: "S1", name: "John Smith", load: "high", activeOrders: 5 },
  { id: "S2", name: "Maria Garcia", load: "medium", activeOrders: 3 },
  { id: "S3", name: "David Lee", load: "low", activeOrders: 1 },
]

export default function TablesPage() {
  const { locations } = useLocations()
  const storeSlug = locations.find((location) => location.storeSlug)?.storeSlug ?? ""
  const storeTables = useRestaurantStore((s) => s.tables)
  const storeOrders = useRestaurantStore((s) => s.orders)
  const tableMetricsById = useMemo(
    () => buildTableLiveMetricsMap(storeTables, storeOrders),
    [storeOrders, storeTables],
  )
  const dashboardMetrics = useMemo(
    () => calculateDashboardOrderMetrics(storeOrders),
    [storeOrders],
  )
  const tables = useMemo(
    () =>
      storeTables.map((table) => {
        const metrics = tableMetricsById.get(table.id) as TableLiveMetrics | undefined
        const display = storeTableToDisplay(table)
        return {
          ...display,
          duration: metrics?.durationMinutes ?? display.duration,
          ticketTotal: metrics?.ticketTotal ?? display.ticketTotal,
          waveCount: metrics?.waveCount ?? display.waveCount,
        }
      }),
    [storeTables, tableMetricsById],
  )

  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [statusFilter, setStatusFilter] = useState<TableStatus>("all")
  const [floorFilter, setFloorFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [turnoverMode, setTurnoverMode] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  )
  const [isInsightsCollapsed, setIsInsightsCollapsed] = useState(false)
  const [showCollapseButton, setShowCollapseButton] = useState(false)
  const [qrTableNumber, setQrTableNumber] = useState<string | null>(null)

  const hasActiveFilters = statusFilter !== "all" || floorFilter !== "all" || searchQuery !== ""

  const handleResetFilters = () => {
    setStatusFilter("all")
    setFloorFilter("all")
    setSearchQuery("")
  }

  // Filter tables
  const filteredTables = tables.filter((table) => {
    const matchesStatus = statusFilter === "all" || table.status === statusFilter
    const matchesFloor = floorFilter === "all" || table.section === floorFilter
    const matchesSearch =
      searchQuery === "" ||
      table.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.section.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesFloor && matchesSearch
  })

  // Calculate stats
  const occupiedCount = tables.filter((t) => t.status === "occupied").length
  const reservedCount = tables.filter((t) => t.status === "reserved").length
  const availableCount = tables.filter((t) => t.status === "available").length
  const cleaningCount = tables.filter((t) => t.status === "cleaning").length
  const totalTables = tables.length
  const occupancyPercent = totalTables > 0 ? Math.round((occupiedCount / totalTables) * 100) : 0
  const turnoversPerTable = totalTables > 0 ? dashboardMetrics.closedOrders / totalTables : 0
  const sectionOptions = useMemo(
    () => Array.from(new Set(tables.map((table) => table.section))).sort(),
    [tables],
  )

  // Chart data
  const chartData = [
    { name: "Occupied", value: occupiedCount, fill: "#EF4444" },
    { name: "Reserved", value: reservedCount, fill: "#FBBF24" },
    { name: "Available", value: availableCount, fill: "#10B981" },
    { name: "Cleaning", value: cleaningCount, fill: "#6B7280" },
  ]

  const selectedTableData = tables.find((t) => t.id === selectedTable)

  const searchParams = useSearchParams()
  const sessionId = searchParams.get("sessionId") ?? undefined

  const { toast } = useToast()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (rightSidebarOpen) {
      const timer = setTimeout(() => {
        setShowCollapseButton(true)
      }, 275)
      return () => clearTimeout(timer)
    } else {
      setShowCollapseButton(false)
    }
  }, [rightSidebarOpen])

  const handleSeatGuests = (table: any, guestName: string) => {
    toast({
      title: "✅ Guests seated",
      description: `${guestName} seated at Table ${table.number}. Order #${table.orderId || "NEW"} created.`,
    })
  }

  const handleClearTable = (table: any) => {
    toast({
      title: "✅ Table cleared",
      description: `Table ${table.number} cleared. Session completed.`,
    })
  }

  return (
    <div className="h-full">
      <div
        className={cn(
          "mx-auto w-full max-w-screen-2xl grid gap-6 transition-all duration-300 px-4 py-4 md:px-6 md:py-6",
          // Always use grid-cols-1 on mobile/tablet, grid with sidebar column on desktop
          "grid-cols-1",
          rightSidebarOpen ? "lg:grid-cols-[1fr_minmax(200px,22vw)]" : "lg:grid-cols-1",
        )}
      >
        <section className="flex flex-col gap-6 min-w-0">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1 text-left">
                <h1 className="text-3xl font-bold tracking-tight">Tables</h1>
                <p className="text-muted-foreground">Floor control center</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                className="lg:hidden"
              >
                <ChevronDown className={cn("h-5 w-5 transition-transform", rightSidebarOpen ? "rotate-180" : "")} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "occupied"
                    ? "bg-red-500 text-white border-red-500 dark:bg-red-500 dark:text-white dark:border-red-500"
                    : "hover:bg-red-100 dark:hover:bg-red-900",
                )}
                onClick={() => setStatusFilter(statusFilter === "occupied" ? "all" : "occupied")}
              >
                <span
                  className={cn("w-2 h-2 rounded-full mr-2", statusFilter === "occupied" ? "bg-white" : "bg-red-500")}
                />
                {occupiedCount} Occupied
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "reserved"
                    ? "bg-yellow-500 text-white border-yellow-500 dark:bg-yellow-500 dark:text-white dark:border-yellow-500"
                    : "hover:bg-yellow-100 dark:hover:bg-yellow-900",
                )}
                onClick={() => setStatusFilter(statusFilter === "reserved" ? "all" : "reserved")}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full mr-2",
                    statusFilter === "reserved" ? "bg-white" : "bg-yellow-500",
                  )}
                />
                {reservedCount} Reserved
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "available"
                    ? "bg-green-500 text-white border-green-500 dark:bg-green-500 dark:text-white dark:border-green-500"
                    : "hover:bg-green-100 dark:hover:bg-green-900",
                )}
                onClick={() => setStatusFilter(statusFilter === "available" ? "all" : "available")}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full mr-2",
                    statusFilter === "available" ? "bg-white" : "bg-green-500",
                  )}
                />
                {availableCount} Available
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "cleaning"
                    ? "bg-gray-500 text-white border-gray-500 dark:bg-gray-500 dark:text-white dark:border-gray-500"
                    : "hover:bg-gray-200 dark:hover:bg-gray-800",
                )}
                onClick={() => setStatusFilter(statusFilter === "cleaning" ? "all" : "cleaning")}
              >
                <span
                  className={cn("w-2 h-2 rounded-full mr-2", statusFilter === "cleaning" ? "bg-white" : "bg-gray-400")}
                />
                {cleaningCount} Cleaning
              </Badge>

              {hasActiveFilters && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 border-orange-500 dark:border-orange-600"
                  onClick={handleResetFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Reset
                </Badge>
              )}
            </div>

            <div className="space-y-2 w-full max-w-2xl">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Occupancy</span>
                <span className="font-medium">
                  {occupiedCount} / {totalTables} ({occupancyPercent}%)
                </span>
              </div>
              <ProgressBar value={occupancyPercent} className="h-4" />
            </div>

            <div className="text-sm text-muted-foreground">
              <Clock className="inline h-4 w-4 mr-1" />
              Average Session Time:{" "}
              <span className="font-medium">{formatMinutes(Math.round(dashboardMetrics.avgOpenSessionMinutes))}</span>
            </div>
            {/* Unified compact control bar */}
            <div className="space-y-2 md:space-y-0">
              <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full">
                {/* Search bar - full width on mobile, flexible on desktop */}
                <div className="relative w-full md:min-w-[120px] md:max-w-[240px] md:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn("pl-9", searchQuery && "pr-9")}
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 w-full sm:hidden">
                  {/* Status select - 50% width on mobile */}
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TableStatus)}>
                    <SelectTrigger className="w-1/2">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Floor select - 50% width on mobile */}
                  <Select value={floorFilter} onValueChange={setFloorFilter}>
                    <SelectTrigger className="w-1/2">
                      <SelectValue placeholder="Floor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Floors</SelectItem>
                      {sectionOptions.map((section) => (
                        <SelectItem key={section} value={section}>
                          {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status select - fixed width on tablet+ */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TableStatus)}>
                  <SelectTrigger className="hidden sm:flex flex-1 md:w-[120px] md:flex-none shrink-0">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                  </SelectContent>
                </Select>

                {/* Floor select - fixed width on tablet+ */}
                <Select value={floorFilter} onValueChange={setFloorFilter}>
                  <SelectTrigger className="hidden sm:flex flex-1 md:w-[120px] md:flex-none shrink-0">
                    <SelectValue placeholder="Floor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Floors</SelectItem>
                    {sectionOptions.map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Grid/List/Refresh buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    className="h-9 w-9"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                    className="h-9 w-9"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 bg-transparent">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Uncollapse button - hide on mobile, show on tablet/desktop when sidebar closed */}
                {!rightSidebarOpen && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden md:flex h-10 w-10 lg:h-12 lg:w-12 rounded-full shadow-lg bg-transparent border-2 shrink-0"
                    onClick={() => {
                      setRightSidebarOpen(true)
                      setIsInsightsCollapsed(false)
                    }}
                  >
                    <ChevronDown className="h-4 w-4 lg:h-5 lg:w-5 -rotate-90" />
                  </Button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 sm:w-full lg:w-auto">
              {/* Clean All Available — full width on mobile, 1/3 on tablet */}
              <Button variant="outline" size="sm" disabled className="w-full sm:w-1/3 lg:w-auto bg-transparent">
                <Sparkles className="h-4 w-4 mr-2" />
                Clean All Available
              </Button>

              {/* Layout Editor + Export group */}
              <div className="flex gap-2 sm:flex sm:w-2/3 lg:w-auto">
                <Button variant="outline" size="sm" disabled className="flex-1 sm:w-1/2 lg:w-auto bg-transparent">
                  <Settings className="h-4 w-4 mr-2" />
                  Layout Editor
                </Button>

                <Button variant="outline" size="sm" disabled className="flex-1 sm:w-1/2 lg:w-auto bg-transparent">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          {viewMode === "grid" ? (
            <div className="space-y-8">
              {sectionOptions.map((section) => {
                const sectionTables = filteredTables.filter((t) => t.section === section)
                if (sectionTables.length === 0) return null

                return (
                  <div key={section}>
                    <h3 className="text-sm font-medium mb-6 flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {section}
                    </h3>
                    <div
                      className={cn(
                        "w-full grid transition-[gap] duration-300",
                        "grid-cols-[repeat(auto-fit,minmax(144px,1fr))]",
                        rightSidebarOpen ? "gap-6" : "gap-10",
                      )}
                    >
                      {sectionTables.map((table) => (
                        <TableTile key={table.id} table={table} onClick={() => setSelectedTable(table.id)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto md:overflow-visible">
                  <Table
                    className={cn(
                      "min-w-[680px] w-full table-fixed text-sm",
                      "[&_thead_th]:px-2.5 [&_thead_th]:py-1.5",
                      "[&_tbody_td]:px-2.5 [&_tbody_td]:py-1.5",
                      isMobile && "[&_thead_th]:px-2 [&_tbody_td]:px-2 text-xs",
                    )}
                  >
                    <colgroup>
                      <col style={{ width: "12.5%" }} />
                      <col style={{ width: "12.5%" }} />
                      <col style={{ width: "12.5%" }} />
                      <col style={{ width: "12.5%" }} />
                      <col style={{ width: "12.5%" }} />
                      <col style={{ width: "12.5%" }} />
                      <col style={{ width: "12.5%" }} />
                      <col style={{ width: "12.5%" }} />
                    </colgroup>
                    <TableHeader className="bg-background [&>tr>th:first-child]:rounded-tl-xl [&>tr>th:last-child]:rounded-tr-xl">
                      <TableRow>
                        <TableHead className="text-center align-middle">Table</TableHead>
                        <TableHead className="text-center align-middle">Cap</TableHead>
                        <TableHead className="text-center align-middle">Status</TableHead>
                        <TableHead className="text-center align-middle">Guests</TableHead>
                        <TableHead className="text-center align-middle">Staff</TableHead>
                        <TableHead className="text-center align-middle">Duration</TableHead>
                        <TableHead className="text-center align-middle">Order</TableHead>
                        <TableHead className="text-center align-middle">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTables.map((table) => (
                        <TableRow
                          key={table.id}
                          className="min-h-[56px] cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedTable(table.id)}
                        >
                          <TableCell className="text-center align-middle">
                            <div className="font-medium">T{table.number}</div>
                            <div className="text-xs text-muted-foreground">{table.section}</div>
                          </TableCell>
                          <TableCell className="text-center align-middle">{table.capacity}</TableCell>
                          <TableCell className="text-center align-middle">
                            <div className="flex justify-center">
                              <StatusBadge status={table.status} />
                            </div>
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {table.status === "occupied" ? table.guests : "-"}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {table.status === "occupied" ? table.server : "-"}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {table.status === "occupied" && typeof table.duration === "number"
                              ? table.duration >= 60
                                ? `${Math.floor(table.duration / 60)}h ${table.duration % 60}min`
                                : `${table.duration} min`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {table.status === "occupied" ? table.orderId : "-"}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            <div className="flex justify-center">
                              <TableActionsDropdown
                                side={isMobile ? "top" : "bottom"}
                                onViewDetails={() => setSelectedTable(table.id)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {rightSidebarOpen && (
          <aside className="hidden lg:block transition-all duration-300 min-w-[200px] max-w-[22vw] w-full flex-shrink-0 self-start">
            <SidebarPanel
              title="Insights"
              collapsible
              isCollapsed={isInsightsCollapsed}
              onToggle={() => {
                const newCollapsed = !isInsightsCollapsed
                setIsInsightsCollapsed(newCollapsed)
                if (newCollapsed) {
                  setRightSidebarOpen(false)
                }
              }}
            >
                <InsightsContent
                  occupancyPercent={occupancyPercent}
                  occupiedCount={occupiedCount}
                  totalTables={totalTables}
                  chartData={chartData}
                  mockStaffWorkload={mockStaffWorkload}
                  dashboardMetrics={dashboardMetrics}
                  turnoversPerTable={turnoversPerTable}
                />
              </SidebarPanel>
            </aside>
        )}
      </div>

      {isMobile && rightSidebarOpen && (
        <Sheet open={rightSidebarOpen} onOpenChange={setRightSidebarOpen}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-md overflow-y-auto px-4 [&>button]:sm:hidden [&>button]:lg:block [&>button]:!top-1 pointer-events-auto"
          >
            <div className="pointer-events-auto">
              <SheetHeader className="pb-2">
                <SheetTitle className="leading-none">Insights</SheetTitle>
              </SheetHeader>
              <Separator className="mt-1.5 mb-0" />
              <div>
                <InsightsContent
                  occupancyPercent={occupancyPercent}
                  occupiedCount={occupiedCount}
                  totalTables={totalTables}
                  chartData={chartData}
                  mockStaffWorkload={mockStaffWorkload}
                  dashboardMetrics={dashboardMetrics}
                  turnoversPerTable={turnoversPerTable}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {isMobile && showCollapseButton && (
        <Button
          variant="outline"
          onClick={() => setRightSidebarOpen(false)}
          className="hidden sm:flex lg:hidden !h-7 !w-7 rounded-full !p-0 !min-w-0 !min-h-0 shrink-0 items-center justify-center fixed top-[12px] right-[434px] z-[999] shadow-lg bg-white pointer-events-auto transition-all duration-200 animate-in fade-in-0 zoom-in-95 border-0"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}

      {/* Table Details Drawer */}
      <Drawer
        open={!!selectedTable}
        onClose={() => setSelectedTable(null)}
        title={
          selectedTableData ? (
            <div className="flex items-center gap-3">
              <span>Table {selectedTableData.number}</span>
              <StatusBadge status={selectedTableData.status} />
            </div>
          ) : (
            "Table Details"
          )
        }
      >
        {selectedTableData && (
          <div className="space-y-6">
            <ConnectedRecords
              table={{
                id: selectedTableData.id,
                label: `Table ${selectedTableData.number}`,
                zone: selectedTableData.section,
              }}
              reservation={
                selectedTableData.status === "reserved" || selectedTableData.status === "occupied"
                  ? {
                      id: "RSV-2847",
                      name: selectedTableData.guestName || selectedTableData.server || "Guest",
                      time: selectedTableData.reservationTime || selectedTableData.seatedAt,
                    }
                  : undefined
              }
              order={
                selectedTableData.status === "occupied"
                  ? { id: selectedTableData.orderId || "NEW", total: 0 }
                  : undefined
              }
              sessionId={sessionId}
            />

            <TableDetails
              table={selectedTableData}
              storeSlug={storeSlug}
              onShowQr={(tableNumber) => setQrTableNumber(tableNumber)}
            />

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setSelectedTable(null)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Table</DialogTitle>
            <DialogDescription>Seat guests at an available table</DialogDescription>
          </DialogHeader>
          <AssignmentForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentModal(false)}>
              Cancel
            </Button>
            <Button disabled>Confirm & Seat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// TableTile Component

function TableTile({ table, onClick }: { table: any; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDropdownVisible, setIsDropdownVisible] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">("bottom")
  const [dropdownOffset, setDropdownOffset] = useState(0)
  const [hasTappedOnce, setHasTappedOnce] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const selfScrollRef = useRef(false)
  const lastUserScrollAtRef = useRef(0)
  const { toast } = useToast()
  const isMobileViewport = useIsMobile()
  const showHoverDropdown = !isMobileViewport

  function getScrollContainer(el: HTMLElement | null): HTMLElement | Window {
    if (!el) return window
    let node: HTMLElement | null = el.parentElement
    while (node && node !== document.body) {
      const style = getComputedStyle(node)
      const overflowY = style.overflowY
      if (overflowY === "auto" || overflowY === "scroll") return node
      node = node.parentElement
    }
    return window
  }

  type TableActionItem = {
    type: "item"
    label: string
    icon: LucideIcon
    title: string
    description: string
    variant?: "destructive"
  }

  type TableAction = TableActionItem | { type: "divider" }

  const actions = useMemo<TableAction[]>(() => {
    const statusSpecific: TableActionItem[] = []

    switch (table.status) {
      case "occupied":
        statusSpecific.push(
          {
            type: "item",
            label: "View Order",
            icon: Eye,
            title: "Viewing order",
            description: `Order for Table ${table.number} opened.`,
          },
          {
            type: "item",
            label: "Request Check",
            icon: DollarSign,
            title: "Check requested",
            description: `Requested check for Table ${table.number}.`,
          },
          {
            type: "item",
            label: "Close Order",
            icon: CheckCircle,
            title: "Order closed",
            description: `Closed order for Table ${table.number}.`,
          },
        )
        break
      case "reserved":
        statusSpecific.push(
          {
            type: "item",
            label: "Seat Guests",
            icon: UserCheck,
            title: "Guests seated",
            description: `${table.guestName ? `${table.guestName} seated` : "Guests seated"} at Table ${table.number}.`,
          },
          {
            type: "item",
            label: "View Reservation",
            icon: Calendar,
            title: "Viewing reservation",
            description: `Reservation for Table ${table.number} opened.`,
          },
        )
        break
      case "available":
        statusSpecific.push(
          {
            type: "item",
            label: "Start New Order",
            icon: Plus,
            title: "New order started",
            description: `Started a new order for Table ${table.number}.`,
          },
          {
            type: "item",
            label: "Assign Reservation",
            icon: Calendar,
            title: "Reservation assigned",
            description: `Assigned a reservation to Table ${table.number}.`,
          },
        )
        break
      case "cleaning":
        statusSpecific.push({
          type: "item",
          label: "Mark as Available",
          icon: Sparkles,
          title: "Table ready",
          description: `Table ${table.number} marked as available.`,
        })
        break
      default:
        break
    }

    const items: TableAction[] = [...statusSpecific]

    if (statusSpecific.length > 0) {
      items.push({ type: "divider" })
    }

    items.push(
      {
        type: "item",
        label: "Edit Table",
        icon: Edit,
        title: "Edit table",
        description: `Editing Table ${table.number}.`,
      },
      {
        type: "item",
        label: "Remove Table",
        icon: Trash2,
        title: "Remove table",
        description: `Removal requested for Table ${table.number}.`,
        variant: "destructive",
      },
    )

    return items
  }, [table])

  const handleAction = useCallback(
    (action: TableActionItem) => {
      toast({
        title: action.title,
        description: action.description,
        variant: action.variant === "destructive" ? "destructive" : undefined,
      })
      setIsDropdownVisible(false)
      setIsHovered(false)
      setHasTappedOnce(false)
    },
    [toast],
  )

  const handleCardClick = useCallback(() => {
    if (window.innerWidth <= 1024) {
      if (!hasTappedOnce) {
        // First tap: open dropdown
        setHasTappedOnce(true)
        setIsHovered(true)
        setIsDropdownVisible(true)
      } else {
        // Second tap: open drawer
        onClick()
        setHasTappedOnce(false)
        setIsHovered(false)
        setIsDropdownVisible(false)
      }
    } else {
      // Desktop: click opens drawer
      onClick()
    }
  }, [hasTappedOnce, onClick])

  const handleMouseEnter = useCallback(() => {
    if (!showHoverDropdown) {
      return
    }

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    setIsHovered(true)
    setIsDropdownVisible(true)
  }, [showHoverDropdown])

  const handleMouseLeave = useCallback(() => {
    if (!showHoverDropdown) {
      return
    }

    setIsHovered(false)

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    hideTimeoutRef.current = setTimeout(() => {
      setIsDropdownVisible(false)
    }, 150)
  }, [showHoverDropdown])

  useEffect(() => {
    const closeDropdown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsHovered(false)
        setIsDropdownVisible(false)
        setHasTappedOnce(false)
      }
    }
    document.addEventListener("click", closeDropdown)
    return () => document.removeEventListener("click", closeDropdown)
  }, [])

  useEffect(() => {
    if (isMobileViewport) {
      setIsHovered(false)
      setIsDropdownVisible(false)
    }
  }, [isMobileViewport])

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  const updateDropdownMetrics = useCallback(() => {
    if (!cardRef.current) {
      return
    }

    const rect = cardRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const cardMiddle = rect.top + rect.height / 2

    setDropdownPosition(cardMiddle < viewportHeight / 2 ? "bottom" : "top")

    if (!dropdownRef.current) {
      setDropdownOffset(0)
      return
    }

    const dropdownRect = dropdownRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const margin = 16
    let offset = 0

    if (dropdownRect.left < margin) {
      offset = margin - dropdownRect.left
    } else if (dropdownRect.right > viewportWidth - margin) {
      offset = viewportWidth - margin - dropdownRect.right
    }

    setDropdownOffset(Math.round(offset))
  }, [])

  const ensureDropdownInView = useCallback(() => {
    if (!dropdownRef.current || !cardRef.current) return

    // Skip if user scrolled in the last 150ms
    if (performance.now() - lastUserScrollAtRef.current < 150) {
      return
    }

    const margin = 16
    const ddRect = dropdownRef.current.getBoundingClientRect()
    const vh = window.innerHeight

    let delta = 0
    if (ddRect.top < margin) {
      delta = ddRect.top - margin // negative -> scroll up
    } else if (ddRect.bottom > vh - margin) {
      delta = ddRect.bottom - (vh - margin) // positive -> scroll down
    }

    if (delta !== 0) {
      // Set flag before programmatic scroll
      selfScrollRef.current = true

      const scroller = getScrollContainer(cardRef.current)
      if (scroller === window) {
        window.scrollBy({ top: delta, left: 0, behavior: "smooth" })
      } else {
        ;(scroller as HTMLElement).scrollBy({ top: delta, left: 0, behavior: "smooth" })
      }

      // Clear flag after a small timeout
      setTimeout(() => {
        selfScrollRef.current = false
      }, 120)
    }
  }, [])

  const scheduleMeasureWithNudge = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateDropdownMetrics()
      ensureDropdownInView()
    })
  }, [updateDropdownMetrics, ensureDropdownInView])

  const scheduleMeasureNoNudge = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateDropdownMetrics()
    })
  }, [updateDropdownMetrics])

  useEffect(() => {
    if (!isDropdownVisible) {
      return
    }

    // Initial measure + nudge on open
    const frame = requestAnimationFrame(() => {
      updateDropdownMetrics()
      requestAnimationFrame(() => ensureDropdownInView())
    })

    const handleResize = () => {
      scheduleMeasureWithNudge()
    }

    const handleOrientation = () => {
      scheduleMeasureWithNudge()
    }

    const handleScroll = () => {
      // Ignore if this is our own programmatic scroll
      if (selfScrollRef.current) {
        return
      }

      // Track user scroll timestamp
      lastUserScrollAtRef.current = performance.now()

      // Re-measure placement without nudging
      scheduleMeasureNoNudge()
    }

    window.addEventListener("resize", handleResize)
    window.addEventListener("orientationchange", handleOrientation)

    if (!isMobileViewport) {
      window.addEventListener("scroll", handleScroll, { capture: true, passive: true })
    }

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("orientationchange", handleOrientation)
      if (!isMobileViewport) {
        window.removeEventListener("scroll", handleScroll, { capture: true })
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [
    isDropdownVisible,
    updateDropdownMetrics,
    scheduleMeasureWithNudge,
    scheduleMeasureNoNudge,
    isMobileViewport,
    ensureDropdownInView,
  ])

  useEffect(() => {
    if (!isDropdownVisible) {
      setDropdownOffset(0)
    }
  }, [isDropdownVisible])

  // Shape configuration with explicit dimensions
  const shapeConfig = {
    square: { size: "h-36 w-36", rounded: "rounded-2xl" },
    rectangle: { size: "h-32 w-44", rounded: "rounded-2xl" },
    round: { size: "h-36 w-36", rounded: "rounded-full" },
  }

  const config = shapeConfig[table.shape as keyof typeof shapeConfig] || shapeConfig.square

  const getStatusColor = () => {
    switch (table.status) {
      case "available":
        return "border-green-500"
      case "occupied":
        return "border-red-500"
      case "reserved":
        return "border-yellow-500"
      case "cleaning":
        return "border-gray-400"
      default:
        return "border-border"
    }
  }

  const getBackgroundColor = () => {
    switch (table.status) {
      case "available":
        return "bg-green-50/50 dark:bg-green-950/10"
      case "occupied":
        return "bg-red-50/50 dark:bg-red-950/10"
      case "reserved":
        return "bg-yellow-50/50 dark:bg-yellow-950/10"
      case "cleaning":
        return "bg-gray-50/50 dark:bg-gray-950/10"
      default:
        return "bg-background"
    }
  }

  const getStatusDotColor = () => {
    switch (table.status) {
      case "available":
        return "bg-green-500"
      case "occupied":
        return "bg-red-500"
      case "reserved":
        return "bg-yellow-500"
      case "cleaning":
        return "bg-gray-400"
      default:
        return "bg-gray-300"
    }
  }

  const orderTotal =
    table.status === "occupied"
      ? `$${Number(table.ticketTotal ?? 0).toFixed(2)}`
      : "$0.00"
  const durationMinutes = typeof table.duration === "number" ? table.duration : null

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${hours}h ${mins}min`
    }
    return `${minutes} min`
  }

  const dropdownStyles = useMemo<CSSProperties>(
    () => ({
      transform: `translateX(calc(-50% + ${dropdownOffset}px))`,
    }),
    [dropdownOffset],
  )

  const caretStyles = useMemo<CSSProperties>(() => {
    const translateY = isDropdownVisible ? "0px" : dropdownPosition === "bottom" ? "4px" : "-4px"

    return {
      transform: `translateX(calc(-50% - ${dropdownOffset}px)) translateY(${translateY}) rotate(45deg)`,
    }
  }, [dropdownOffset, dropdownPosition, isDropdownVisible])

  return (
    <div
      ref={cardRef}
      className="group relative flex justify-center"
      onMouseEnter={showHoverDropdown ? handleMouseEnter : undefined}
      onMouseLeave={showHoverDropdown ? handleMouseLeave : undefined}
    >
      <Card
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-lg hover:brightness-105 hover:scale-[1.05] active:brightness-95 active:scale-[0.985]",
          "transform-gpu will-change-transform border-2 relative",
          config.size,
          config.rounded,
          getStatusColor(),
          getBackgroundColor(),
          (isHovered || isDropdownVisible) && "animate-[shadowPulse_2.4s_ease-in-out_infinite]",
          isHovered ? "z-10" : "",
        )}
        onClick={(e) => {
          if (window.innerWidth <= 1024) {
            try {
              navigator.vibrate?.(5)
            } catch {}
          }
          handleCardClick()
        }}
      >
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", getStatusDotColor())} />
        </div>

        <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center">
          {/* Table number - bold and prominent */}
          <div className="text-2xl font-bold mb-2">T{table.number}</div>

          {/* Capacity with icon */}
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">{table.capacity}</span>
          </div>

          {/* Time badge for occupied/reserved tables */}
          {table.status === "occupied" && durationMinutes !== null && (
            <div className="flex items-center gap-1.5 text-sm font-medium mt-1">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(durationMinutes)}</span>
            </div>
          )}

          {table.status === "reserved" && table.reservationTime && (
            <div className="text-sm font-medium mt-1">{table.reservationTime}</div>
          )}
        </CardContent>
      </Card>

      {(isDropdownVisible || isHovered) && (
        <div
          ref={dropdownRef}
          style={dropdownStyles}
          className={cn(
            "absolute left-1/2 z-50 w-64 transform-gpu backface-hidden will-change-transform rounded-xl transition-all duration-200",
            "ease-[cubic-bezier(0.33,1,0.68,1)]",
            "data-[state=open]:opacity-100 data-[state=open]:translate-y-0 data-[state=closed]:opacity-0 data-[state=closed]:translate-y-1",
            "motion-reduce:transition-none motion-reduce:animate-none",
            "backdrop-blur-[6px] bg-background/80",
            dropdownPosition === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          )}
          data-state={isDropdownVisible ? "open" : "closed"}
          onMouseEnter={showHoverDropdown ? handleMouseEnter : undefined}
          onMouseLeave={showHoverDropdown ? handleMouseLeave : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={cn(
              "will-change-transform will-change-opacity",
              isDropdownVisible ? "animate-in fade-in-0 duration-200" : "",
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute left-1/2 w-3 h-3 border border-border bg-background",
                "transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.33,1,0.68,1)]",
                dropdownPosition === "bottom" ? "-top-1" : "-bottom-1",
                isDropdownVisible
                  ? "opacity-100 translate-y-0"
                  : dropdownPosition === "bottom"
                    ? "opacity-0 translate-y-1"
                    : "opacity-0 -translate-y-1",
              )}
              style={caretStyles}
            />
            <Card
              className={cn(
                "border-2 rounded-xl overflow-hidden",
                "shadow-[0_12px_28px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.06)]",
                "dark:shadow-[0_12px_28px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.25)]",
                "bg-background",
              )}
            >
              <CardContent className="p-0">
                <div className="space-y-2 border-b px-4 py-3">
                  <h3 className="font-semibold text-base">Table {table.number}</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-semibold capitalize">{table.status}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Capacity:</span>
                      <span className="font-semibold">{table.capacity} seats</span>
                    </div>
                    {table.status === "occupied" && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Order Total:</span>
                        <span className="font-semibold">{orderTotal}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1 p-2">
                  {actions.map((action, index) => {
                    if (action.type === "divider") {
                      return <div key={`divider-${index}`} className="my-2 border-t" />
                    }

                    const Icon = action.icon

                    return (
                      <button
                        key={action.label}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors text-left",
                          action.variant === "destructive" && "text-destructive hover:bg-destructive/10",
                        )}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleAction(action)
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{action.label}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {storeSlug && qrTableNumber ? (
        <TableQrDialog
          open={!!qrTableNumber}
          onOpenChange={(open) => {
            if (!open) setQrTableNumber(null)
          }}
          storeSlug={storeSlug}
          tableNumber={qrTableNumber}
        />
      ) : null}
    </div>
  )
}

// Table Details Component
function TableDetails({
  table,
  storeSlug,
  onShowQr,
}: {
  table: any
  storeSlug: string
  onShowQr: (tableNumber: string) => void
}) {
  const { toast } = useToast()

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {table.section} • Seats {table.capacity}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-transparent"
          disabled={!storeSlug}
          onClick={() => {
            if (!storeSlug) {
              toast({
                title: "Store URL not configured",
                description: "Set a store slug in Dashboard → Stores before generating table QR codes.",
                variant: "destructive",
              })
              return
            }
            onShowQr(String(table.number))
          }}
        >
          <QrCode className="h-4 w-4 mr-2" />
          View QR Code
        </Button>
      </div>

      {/* Status-specific content */}
      {table.status === "available" && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Table is available</p>
                <p className="text-sm text-muted-foreground">Seats {table.capacity} guests</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button className="flex-1" disabled>
                <Plus className="h-4 w-4 mr-2" />
                New Order
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent" disabled>
                <Calendar className="h-4 w-4 mr-2" />
                Assign Reservation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {table.status === "reserved" && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Reserved for {table.guestName}</p>
                  <p className="text-sm text-muted-foreground">
                    {table.reservationTime} (in {table.timeUntil})
                  </p>
                  <p className="text-sm text-muted-foreground">Party of {table.partySize}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    toast({
                      title: "✅ Guests seated",
                      description: `${table.guestName} seated at Table ${table.number}`,
                    })
                  }}
                >
                  Seat Guests Now
                </Button>
                <Button variant="outline" className="flex-1 bg-transparent" disabled>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {table.status === "occupied" && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">
                    Seated {table.seatedAt} (
                    {typeof table.duration === "number" ? `${table.duration} min` : "duration pending"})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {table.guests} Guests • Server: {table.server}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Order {table.orderId} • {table.waveCount ?? 0} waves • ${Number(table.ticketTotal ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-transparent" disabled>
                  <Eye className="h-4 w-4 mr-2" />
                  View Order
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    toast({
                      title: "✅ Table cleared",
                      description: `Table ${table.number} cleared. Session completed.`,
                    })
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {table.status === "cleaning" && (
        <Card className="border-gray-400 bg-gray-50 dark:bg-gray-950/20">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Currently being cleaned</p>
                  <p className="text-sm text-muted-foreground">Started {table.cleaningStarted}</p>
                </div>
              </div>
              <Button className="w-full" disabled>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Available
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table & Staff Info */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Table Information</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Capacity:</span>
            <span className="font-medium">{table.capacity} guests</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Section:</span>
            <span className="font-medium">{table.section}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shape:</span>
            <span className="font-medium capitalize">{table.shape}</span>
          </div>
          {table.lastCleaned && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Cleaned:</span>
              <span className="font-medium">{table.lastCleaned}</span>
            </div>
          )}
          {table.condition && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Condition:</span>
              <span className="font-medium capitalize">{table.condition}</span>
            </div>
          )}
          {table.notes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notes:</span>
              <span className="font-medium">{table.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Manager Mode Panel */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80">
          <span>Manager Mode</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start bg-transparent" disabled>
            Edit Table
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start bg-transparent" disabled>
            Merge Tables
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start bg-transparent" disabled>
            Split Table
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start bg-transparent" disabled>
            Move Table
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start text-destructive bg-transparent" disabled>
            Delete Table
          </Button>
        </div>
      </details>
    </div>
  )
}

// Assignment Form Component
function AssignmentForm() {
  const storeTables = useRestaurantStore((s) => s.tables)
  const availableTables = useMemo(
    () => storeTables.map(storeTableToDisplay).filter((table) => table.status === "available"),
    [storeTables],
  )

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Guest Type</Label>
        <Select defaultValue="walk-in">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="walk-in">Walk-in</SelectItem>
            <SelectItem value="reservation">Reservation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Number of Guests</Label>
        <Input type="number" placeholder="4" min="1" />
      </div>

      <div className="space-y-2">
        <Label>Select Table</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose a table" />
          </SelectTrigger>
          <SelectContent>
            {availableTables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                Table {table.number} - {table.section} (Seats {table.capacity})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Assign Server</Label>
        <Select defaultValue="auto">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-assign</SelectItem>
            <SelectItem value="S1">John Smith</SelectItem>
            <SelectItem value="S2">Maria Garcia</SelectItem>
            <SelectItem value="S3">David Lee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Special Requests</Label>
        <Input placeholder="Window seat, high chair, etc." />
      </div>

      <div className="p-3 rounded-lg bg-muted">
        <p className="text-sm text-muted-foreground">
          <Clock className="inline h-4 w-4 mr-1" />
          Estimated Wait: <span className="font-medium">5 min</span>
        </p>
      </div>
    </div>
  )
}

function TableActionsDropdown({
  side = "bottom",
  onViewDetails,
}: {
  side?: "top" | "bottom"
  onViewDetails?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-muted transition-colors h-8 w-8"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={side}
        className="min-w-[180px] sm:min-w-[200px]"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={() => {
            onViewDetails?.()
          }}
        >
          <Eye className="mr-2 h-4 w-4" />
          View Table Details
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <UserCheck className="mr-2 h-4 w-4" />
          Assign Guests
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <UtensilsCrossed className="mr-2 h-4 w-4" />
          Mark as Occupied
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Broom className="mr-2 h-4 w-4" />
          Mark as Cleaning Done
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <XCircle className="mr-2 h-4 w-4" />
          Deactivate Table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InsightsContent({
  occupancyPercent,
  occupiedCount,
  totalTables,
  chartData,
  mockStaffWorkload,
  dashboardMetrics,
  turnoversPerTable,
}: {
  occupancyPercent: number
  occupiedCount: number
  totalTables: number
  chartData: any[]
  mockStaffWorkload: any[]
  dashboardMetrics: DashboardOrderMetrics
  turnoversPerTable: number
}) {
  return (
    <div className="space-y-6 pb-6">
      {/* Occupancy Summary */}
      <div className="mt-3.5">
        <h4 className="text-sm font-medium mb-3">Occupancy Summary</h4>
        <ProgressBar value={occupancyPercent} showPercentage />
        <p className="text-xs text-muted-foreground mt-2">
          {occupiedCount} of {totalTables} tables occupied
        </p>
      </div>

      {/* Status Distribution */}
      <div>
        <h4 className="text-sm font-medium mb-3">Status Distribution</h4>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
              <span className="text-muted-foreground">{item.name}:</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Workload */}
      <div>
        <h4 className="text-sm font-medium mb-3">Staff Workload</h4>
        <div className="space-y-2">
          {mockStaffWorkload.map((staff) => (
            <div key={staff.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    staff.load === "high" ? "bg-red-500" : staff.load === "medium" ? "bg-yellow-500" : "bg-green-500"
                  }`}
                />
                <span className="text-sm font-medium">{staff.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{staff.activeOrders} orders</span>
            </div>
          ))}
        </div>
      </div>

      {/* Average Metrics */}
      <div>
        <h4 className="text-sm font-medium mb-3">Average Metrics</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Session:</span>
            <span className="font-medium">{formatMinutes(Math.round(dashboardMetrics.avgOpenSessionMinutes))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Turn Time:</span>
            <span className="font-medium">{formatMinutes(Math.round(dashboardMetrics.avgTurnMinutes))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Ticket:</span>
            <span className="font-medium">${dashboardMetrics.avgTicketTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">First Fire:</span>
            <span className="font-medium">
              {dashboardMetrics.avgMinutesToFirstFire == null
                ? "--"
                : formatMinutes(Math.round(dashboardMetrics.avgMinutesToFirstFire))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Turnovers:</span>
            <span className="font-medium">{turnoversPerTable.toFixed(1)} / table</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Peak Occupancy:</span>
            <span className="font-medium">95%</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <Button variant="outline" className="w-full justify-start bg-transparent" size="sm" disabled>
          <Trash2 className="h-4 w-4 mr-2" />
          Clean All Available
        </Button>
        <Button variant="outline" className="w-full justify-start bg-transparent" size="sm" disabled>
          <Download className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
        <Button variant="outline" className="w-full justify-start bg-transparent" size="sm" disabled>
          <Settings className="h-4 w-4 mr-2" />
          Edit Layout
        </Button>
      </div>
    </div>
  )
}
