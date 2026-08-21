"use client"

import { useState, useRef, useEffect } from "react"
import {
  CalendarIcon,
  Clock,
  Users,
  MapPin,
  Phone,
  Search,
  Filter,
  Download,
  Settings,
  ChevronDown,
  AlertTriangle,
  Star,
  Repeat,
  Cake,
  Accessibility,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  User,
  ShoppingCart,
  X,
  MoreHorizontal,
  UserCheck,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneNumberField } from "@/components/shared/phone-number-field"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { StatusBadge } from "@/components/ui/status-badge"
import { Drawer } from "@/components/ui/drawer"
import { SidebarPanel } from "@/components/ui/sidebar-panel"
import { Progress } from "@/components/ui/progress"
import { AlertBanner } from "@/components/ui/alert-banner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { mockStaffWorkload } from "@/lib/mockData"
import { useRestaurantStore } from "@/store/restaurantStore"
import { SECTION_CONFIG } from "@/store/types"
import { STATUS_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import ConnectedRecords from "@/components/connected/ConnectedRecords"

type ViewMode = "list" | "timeline" | "calendar"

export default function ReservationsPage() {
  const displayPhone = useDisplayPhone()
  const reservations = useRestaurantStore((s) => s.reservations)
  const tables = useRestaurantStore((s) => s.tables)
  const waitlist = useRestaurantStore((s) => s.waitlist)

  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedReservation, setSelectedReservation] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isConflictDrawerOpen, setIsConflictDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [timeFilter, setTimeFilter] = useState("all-day")
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [autoAssign, setAutoAssign] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

  const [zoneFilter, setZoneFilter] = useState("all")
  const [partySizeFilter, setPartySizeFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [staffFilter, setStaffFilter] = useState("all")

  const [rightSidebarOpen, setRightSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  )
  const [isInsightsCollapsed, setIsInsightsCollapsed] = useState(false)
  const [showCollapseButton, setShowCollapseButton] = useState(false)
  const [sidebarHeight, setSidebarHeight] = useState<number | null>(null)
  const [newReservationPhone, setNewReservationPhone] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const mainColumnRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isMobileViewport = useIsMobile()

  const searchParams = useSearchParams()
  const sessionId = searchParams.get("sessionId") ?? undefined

  const { toast } = useToast()

  const handleSeatNow = (reservation: any) => {
    toast({
      title: "✅ Guests seated",
      description: `${reservation.guestName} seated at Table ${reservation.table || "12"}. Order #NEW created.`,
    })
  }

  useEffect(() => {
    if (rightSidebarOpen) {
      const timer = setTimeout(() => {
        setShowCollapseButton(true)
      }, 275)

      return () => clearTimeout(timer)
    }

    setShowCollapseButton(false)
  }, [rightSidebarOpen])

  useEffect(() => {
    if (!rightSidebarOpen || isMobileViewport) {
      setSidebarHeight(null)
      return
    }

    const updateSidebarHeight = () => {
      if (!mainColumnRef.current) return
      const mainHeight = mainColumnRef.current.getBoundingClientRect().height
      const viewportOffset =
        typeof window !== "undefined" ? Math.min(Math.max(Math.round(window.innerHeight * 0.28), 220), 440) : 300
      const height = Math.max(mainHeight + viewportOffset, 280)
      setSidebarHeight(height)
    }

    const timer = setTimeout(updateSidebarHeight, 100)
    updateSidebarHeight()

    const observer = new ResizeObserver(updateSidebarHeight)
    if (mainColumnRef.current) {
      observer.observe(mainColumnRef.current)
    }

    window.addEventListener("resize", updateSidebarHeight)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener("resize", updateSidebarHeight)
    }
  }, [rightSidebarOpen, isMobileViewport, viewMode, statusFilter, searchQuery])

  // Mock conflict data for timeline
  const mockConflict = {
    table: "12",
    reservations: [
      { id: "RSV-2847", guest: "Anna K.", time: "7:30 PM", partySize: 4 },
      { id: "RSV-2860", guest: "Tom H.", time: "7:45 PM", partySize: 2 },
    ],
  }

  const reservation = reservations.find((r) => r.id === selectedReservation)

  const hasActiveFilters =
    statusFilter !== "all" ||
    timeFilter !== "all-day" ||
    zoneFilter !== "all" ||
    partySizeFilter !== "all" ||
    sourceFilter !== "all" ||
    staffFilter !== "all" ||
    searchQuery !== ""

  const handleResetFilters = () => {
    setStatusFilter("all")
    setTimeFilter("all-day")
    setZoneFilter("all")
    setPartySizeFilter("all")
    setSourceFilter("all")
    setStaffFilter("all")
    setSearchQuery("")
  }

  const filteredReservations = reservations.filter((res) => {
    // Status filter
    if (statusFilter !== "all" && res.status !== statusFilter) return false

    // Search query filter
    if (
      searchQuery &&
      !res.guestName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !res.phone.includes(searchQuery) &&
      !res.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false

    // Time filter
    if (timeFilter !== "all-day") {
      const hour = Number.parseInt(res.time.split(":")[0])
      const isPM = res.time.includes("PM")
      const hour24 = isPM && hour !== 12 ? hour + 12 : !isPM && hour === 12 ? 0 : hour

      if (timeFilter === "breakfast" && (hour24 < 6 || hour24 >= 11)) return false
      if (timeFilter === "lunch" && (hour24 < 11 || hour24 >= 15)) return false
      if (timeFilter === "dinner" && (hour24 < 17 || hour24 >= 23)) return false
    }

    // Zone filter
    if (zoneFilter !== "all" && res.zone?.toLowerCase() !== zoneFilter.toLowerCase()) return false

    // Party size filter
    if (partySizeFilter !== "all") {
      if (partySizeFilter === "1-2" && (res.partySize < 1 || res.partySize > 2)) return false
      if (partySizeFilter === "3-4" && (res.partySize < 3 || res.partySize > 4)) return false
      if (partySizeFilter === "5-8" && (res.partySize < 5 || res.partySize > 8)) return false
      if (partySizeFilter === "9+" && res.partySize < 9) return false
    }

    // Source filter
    if (sourceFilter !== "all" && res.source?.toLowerCase() !== sourceFilter.toLowerCase()) return false

    // Staff filter
    if (staffFilter !== "all" && res.staff !== staffFilter) return false

    return true
  })

  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedReservations = filteredReservations.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [filteredReservations.length])

  // Calculate stats
  const stats = {
    upcoming: reservations.filter((r) => r.status === "reserved" || r.status === "confirmed").length,
    seated: reservations.filter((r) => r.status === "seated").length,
    completed: reservations.filter((r) => r.status === "completed").length,
    noShow: reservations.filter((r) => r.status === "noShow").length,
    cancelled: reservations.filter((r) => r.status === "cancelled").length,
  }

  const getLoadPercentage = (load: string) => {
    switch (load) {
      case "high":
        return 85
      case "medium":
        return 55
      case "low":
        return 25
      default:
        return 0
    }
  }

  // Status distribution for pie chart
  const statusDistribution = [
    { name: "Upcoming", value: stats.upcoming, fill: STATUS_COLORS.reserved },
    { name: "Seated", value: stats.seated, fill: STATUS_COLORS.seated },
    { name: "Completed", value: stats.completed, fill: STATUS_COLORS.completed },
  ]

  const openReservationDrawer = (id: string) => {
    setSelectedReservation(id)
    setIsDrawerOpen(true)
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "late":
        return "border-l-4 border-l-red-500"
      case "arriving-soon":
        return "border-l-4 border-l-amber-500"
      default:
        return ""
    }
  }

  const getUrgencyBadge = (urgency: string, minutesUntil?: number | null, graceLeft?: number) => {
    if (urgency === "late" && graceLeft !== undefined) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
          <Clock className="size-3 mr-1" />
          Grace {graceLeft}m left
        </Badge>
      )
    }
    if (urgency === "arriving-soon") {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
          <Clock className="size-3 mr-1" />
          Arriving soon
        </Badge>
      )
    }
    return null
  }

  const InsightsContent = ({ className }: { className?: string }) => (
    <div className={cn("space-y-4", className)}>
      {/* Today's Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today's Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Reservations</span>
            <span className="font-semibold">12</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Occupancy Rate</span>
            <span className="font-semibold">68%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Avg Party Size</span>
            <span className="font-semibold">3.8</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">No-shows</span>
            <span className="font-semibold text-red-600">1</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cancellations</span>
            <span className="font-semibold text-amber-600">1</span>
          </div>
        </CardContent>
      </Card>

      {/* Next Hour */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next Hour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">7:30 PM</span>
            </div>
            <span className="text-sm text-muted-foreground">Anna K. (4)</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">7:45 PM</span>
            </div>
            <span className="text-sm text-muted-foreground">Patricia G. (6)</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">8:00 PM</span>
            </div>
            <span className="text-sm text-muted-foreground">Michael C. (2)</span>
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {statusDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-sm">{item.name}</span>
                </div>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staff Workload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff Workload</CardTitle>
        </CardHeader>
        <CardContent className="max-h-64 overflow-y-auto pr-2.5 space-y-2">
          {mockStaffWorkload.map((staff) => (
            <div
              key={staff.id}
              className="flex items-center justify-between border rounded-lg p-2 transition-all hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">
                    {staff.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{staff.name}</p>
                  <p className="text-xs text-muted-foreground">{staff.role}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {staff.activeOrders} {staff.activeOrders === 1 ? "order" : "orders"}
                </span>
                <Progress value={getLoadPercentage(staff.load)} className="w-16 h-1.5" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Waitlist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waitlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {waitlist.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">{item.guestName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.partySize} guests • {item.waitTime}
                </p>
              </div>
              <Button size="sm" variant="outline">
                Seat
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Needs Attention */}
      <AlertBanner
        variant="warning"
        message="1 reservation late - grace period ending soon"
        action={{ label: "View", onClick: () => console.log("[v0] View late reservation") }}
      />
    </div>
  )

  return (
    <div className="relative h-full">
      <div
        className={cn(
          "mx-auto w-full max-w-screen-2xl",
          "grid gap-6 transition-all duration-300 px-4 py-4 md:px-6 md:py-6",
          "grid-cols-1",
          rightSidebarOpen ? "lg:grid-cols-[1fr_minmax(200px,22vw)]" : "lg:grid-cols-1",
        )}
      >
        <section className="flex flex-col gap-6 min-w-0">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Reservations</h1>
                <p className="text-muted-foreground">Manage bookings and reservation system</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightSidebarOpen((prev) => !prev)}
                  className="lg:hidden"
                >
                  <ChevronDown className={cn("h-5 w-5 transition-transform", rightSidebarOpen ? "rotate-180" : "")} />
                </Button>
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

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "reserved" || statusFilter === "confirmed"
                    ? "bg-yellow-500 text-white border-yellow-500 dark:bg-yellow-500 dark:text-white dark:border-yellow-500"
                    : "hover:bg-yellow-100 dark:hover:bg-yellow-900",
                )}
                onClick={() =>
                  setStatusFilter(statusFilter === "reserved" || statusFilter === "confirmed" ? "all" : "reserved")
                }
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full mr-2",
                    statusFilter === "reserved" || statusFilter === "confirmed" ? "bg-white" : "bg-yellow-500",
                  )}
                />
                {stats.upcoming} Upcoming
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "seated"
                    ? "bg-green-500 text-white border-green-500 dark:bg-green-500 dark:text-white dark:border-green-500"
                    : "hover:bg-green-100 dark:hover:bg-green-900",
                )}
                onClick={() => setStatusFilter(statusFilter === "seated" ? "all" : "seated")}
              >
                <span
                  className={cn("w-2 h-2 rounded-full mr-2", statusFilter === "seated" ? "bg-white" : "bg-green-500")}
                />
                {stats.seated} Seated
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "completed"
                    ? "bg-slate-500 text-white border-slate-500 dark:bg-slate-400 dark:text-white dark:border-slate-400"
                    : "hover:bg-slate-200 dark:hover:bg-slate-800",
                )}
                onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full mr-2",
                    statusFilter === "completed" ? "bg-white" : "bg-slate-500 dark:bg-slate-400",
                  )}
                />
                {stats.completed} Completed
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "noShow"
                    ? "bg-gray-700 text-white border-gray-700 dark:bg-gray-500 dark:text-white dark:border-gray-500"
                    : "hover:bg-gray-200 dark:hover:bg-gray-800",
                )}
                onClick={() => setStatusFilter(statusFilter === "noShow" ? "all" : "noShow")}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full mr-2",
                    statusFilter === "noShow" ? "bg-white" : "bg-gray-700 dark:bg-gray-500",
                  )}
                />
                {stats.noShow} No-show
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  statusFilter === "cancelled"
                    ? "bg-red-500 text-white border-red-500 dark:bg-red-500 dark:text-white dark:border-red-500"
                    : "hover:bg-red-100 dark:hover:bg-red-900",
                )}
                onClick={() => setStatusFilter(statusFilter === "cancelled" ? "all" : "cancelled")}
              >
                <span
                  className={cn("w-2 h-2 rounded-full mr-2", statusFilter === "cancelled" ? "bg-white" : "bg-red-500")}
                />
                {stats.cancelled} Cancelled
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

            {/* Controls */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="size-4 mr-2" />
                      Today
                      <ChevronDown className="size-4 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
                  </PopoverContent>
                </Popover>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="reserved">Upcoming</SelectItem>
                    <SelectItem value="seated">Seated</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="noShow">No-show</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-day">All Day</SelectItem>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={() => setShowMoreFilters(!showMoreFilters)}>
                  <Filter className="size-4 mr-2" />
                  More Filters
                </Button>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
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

                <div className="flex items-center gap-2 ml-auto">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background">
                    <span className="text-sm text-muted-foreground">View:</span>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="h-7 px-2"
                    >
                      <List className="size-4" />
                    </Button>
                    <Button
                      variant={viewMode === "timeline" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("timeline")}
                      className="h-7 px-2"
                    >
                      <LayoutGrid className="size-4" />
                    </Button>
                    <Button
                      variant={viewMode === "calendar" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("calendar")}
                      className="h-7 px-2"
                    >
                      <CalendarIcon className="size-4" />
                    </Button>
                  </div>

                  <Button variant="outline" size="sm" disabled>
                    <Download className="size-4 mr-2" />
                    Export
                  </Button>

                  <Button variant="outline" size="sm" disabled>
                    <Settings className="size-4" />
                  </Button>
                </div>
              </div>

              {showMoreFilters && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Zone</Label>
                        <Select value={zoneFilter} onValueChange={setZoneFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Zones" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Zones</SelectItem>
                            <SelectItem value="main">Main Hall</SelectItem>
                            <SelectItem value="patio">Patio</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Party Size</Label>
                        <Select value={partySizeFilter} onValueChange={setPartySizeFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Any Size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any Size</SelectItem>
                            <SelectItem value="1-2">1-2 guests</SelectItem>
                            <SelectItem value="3-4">3-4 guests</SelectItem>
                            <SelectItem value="5-8">5-8 guests</SelectItem>
                            <SelectItem value="9+">9+ guests</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Source</Label>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Sources" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="website">Website</SelectItem>
                            <SelectItem value="app">App</SelectItem>
                            <SelectItem value="walk-in">Walk-in</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Staff</Label>
                        <Select value={staffFilter} onValueChange={setStaffFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Staff" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Staff</SelectItem>
                            <SelectItem value="John Smith">John Smith</SelectItem>
                            <SelectItem value="Maria Garcia">Maria Garcia</SelectItem>
                            <SelectItem value="David Lee">David Lee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="min-w-0" ref={mainColumnRef}>
            {/* Main Content - Views */}
            {viewMode === "list" && (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[840px]">
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="text-center">Time</TableHead>
                          <TableHead className="text-center">Name</TableHead>
                          <TableHead className="text-center">Guests</TableHead>
                          <TableHead className="text-center">Table</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Source</TableHead>
                          <TableHead className="text-center">Staff</TableHead>
                          <TableHead className="text-center">Duration</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedReservations.map((res) => {
                          const tags = Array.isArray(res.tags) ? res.tags : []
                          const dietaryNeeds = Array.isArray(res.dietaryNeeds) ? res.dietaryNeeds : []

                          return (
                          <TableRow
                            key={res.id}
                            className={cn(
                              "min-h-[56px] cursor-pointer hover:bg-muted/50",
                              getUrgencyColor(res.urgency),
                              res.status === "noShow" && "opacity-60 line-through",
                            )}
                            onClick={() => openReservationDrawer(res.id)}
                          >
                            <TableCell className="font-medium text-center align-middle">
                              <div className="flex flex-col items-center">
                                <span>{res.time}</span>
                                {getUrgencyBadge(res.urgency, res.minutesUntil, res.graceLeft)}
                              </div>
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              <div className="flex items-center justify-center gap-2">
                                <span className="font-medium">{res.guestName}</span>
                                {res.isVIP && <Star className="size-3 fill-amber-500 text-amber-500" />}
                                {res.isRegular && <Repeat className="size-3 text-blue-500" />}
                                {tags.includes("Birthday") && <Cake className="size-3 text-pink-500" />}
                                {dietaryNeeds.length > 0 && <Accessibility className="size-3 text-purple-500" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                <Users className="size-4 text-muted-foreground" />
                                <span>{res.partySize}</span>
                                {res.children > 0 && (
                                  <span className="text-xs text-muted-foreground">+{res.children} kids</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              {res.table ? (
                                <div className="flex items-center justify-center gap-1">
                                  <MapPin className="size-4 text-muted-foreground" />
                                  <span>{res.table}</span>
                                  <span className="text-xs text-muted-foreground">({res.zone})</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              <div className="flex justify-center">
                                <StatusBadge status={res.status} />
                              </div>
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              <div className="flex justify-center">
                                <Badge variant="outline" className="text-xs">
                                  {res.source}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              {res.staff ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Avatar className="size-6">
                                    <AvatarFallback className="text-xs">
                                      {res.staff
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{res.staff}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              <span className="text-sm text-muted-foreground">{res.duration}m</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="rounded-full hover:bg-muted transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    side={isMobileViewport ? "top" : "bottom"}
                                    className="min-w-[180px] sm:min-w-[200px]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <DropdownMenuItem onSelect={() => openReservationDrawer(res.id)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit Reservation
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled>
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Assign Table
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled>
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Cancel Reservation
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredReservations.length)} of{" "}
                        {filteredReservations.length} reservations
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className="w-9"
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                          {totalPages > 5 && currentPage < totalPages - 2 && (
                            <>
                              <span className="px-2">...</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                                className="w-9"
                              >
                                {totalPages}
                              </Button>
                            </>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          Last
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {viewMode === "timeline" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Timeline View</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <ChevronLeft className="size-4" />
                      </Button>
                      <span className="text-sm font-medium">6:00 PM - 10:00 PM</span>
                      <Button variant="outline" size="sm">
                        <ChevronRight className="size-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        Zoom +
                      </Button>
                      <Button variant="outline" size="sm">
                        Zoom -
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative overflow-x-auto">
                    {/* Timeline Grid */}
                    <div className="min-w-[800px]">
                      {/* Time axis */}
                      <div className="flex border-b">
                        <div className="w-24 flex-shrink-0 p-2 font-medium text-sm">Table</div>
                        {["6:00", "6:30", "7:00", "7:30", "8:00", "8:30", "9:00", "9:30", "10:00"].map((time) => (
                          <div key={time} className="flex-1 p-2 text-center text-sm text-muted-foreground border-l">
                            {time}
                          </div>
                        ))}
                      </div>

                      {/* Table rows */}
                      {tables.slice(0, 10).map((table) => {
                        const tableReservations = filteredReservations.filter((r) => r.tableId === table.id)
                        return (
                          <div key={table.id} className="flex border-b relative h-16">
                            <div className="w-24 flex-shrink-0 p-2 font-medium text-sm flex items-center">
                              Table {table.number}
                            </div>
                            <div className="flex-1 relative">
                              {/* Time slots */}
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((slot) => (
                                <div
                                  key={slot}
                                  className="absolute top-0 bottom-0 border-l"
                                  style={{ left: `${(slot / 8) * 100}%` }}
                                />
                              ))}

                              {/* Current time indicator */}
                              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: "25%" }}>
                                <div className="absolute -top-1 -left-1 size-2 rounded-full bg-red-500" />
                              </div>

                              {/* Reservation blocks */}
                              {tableReservations.map((res) => {
                                // Calculate position based on time (simplified)
                                const startHour = Number.parseInt(res.time.split(":")[0])
                                const startMin = Number.parseInt(res.time.split(":")[1].split(" ")[0])
                                const startPercent = (((startHour - 18) * 60 + startMin) / 240) * 100
                                const widthPercent = (res.duration / 240) * 100

                                return (
                                  <div
                                    key={res.id}
                                    className="absolute top-1 bottom-1 rounded px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{
                                      left: `${startPercent}%`,
                                      width: `${widthPercent}%`,
                                      backgroundColor: STATUS_COLORS[res.status as keyof typeof STATUS_COLORS],
                                    }}
                                    onClick={() => openReservationDrawer(res.id)}
                                  >
                                    <div className="flex items-center gap-1 text-white">
                                      <Users className="size-3" />
                                      <span className="truncate">{res.guestName}</span>
                                      <span>({res.partySize})</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Conflict indicator */}
                    <div className="mt-4 p-4 border rounded-lg bg-amber-500/10 border-amber-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="size-5 text-amber-600" />
                          <div>
                            <p className="font-medium text-amber-900 dark:text-amber-100">Conflict Detected</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              Table {mockConflict.table} has overlapping reservations
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsConflictDrawerOpen(true)}>
                          Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode === "calendar" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Calendar View</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        Week
                      </Button>
                      <Button variant="outline" size="sm">
                        Month
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <div key={day} className="text-center font-medium text-sm text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => {
                      const dayReservations = i === 10 ? 12 : Math.floor(Math.random() * 15)
                      const capacity = 25
                      const occupancyPercent = (dayReservations / capacity) * 100

                      return (
                        <div
                          key={i}
                          className="aspect-square border rounded-lg p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <div className="flex flex-col h-full">
                            <span className="text-sm font-medium">{i + 1}</span>
                            <div className="flex-1 flex flex-col justify-center items-center gap-1">
                              <span className="text-lg font-bold">{dayReservations}</span>
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    occupancyPercent > 80
                                      ? "bg-red-500"
                                      : occupancyPercent > 60
                                        ? "bg-amber-500"
                                        : "bg-green-500",
                                  )}
                                  style={{ width: `${occupancyPercent}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{occupancyPercent.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {rightSidebarOpen && (
          <aside
            ref={sidebarRef}
            className="hidden lg:block transition-all duration-300 min-w-[200px] max-w-[22vw] w-full flex-shrink-0 self-start"
            style={sidebarHeight ? { height: sidebarHeight, maxHeight: sidebarHeight } : undefined}
          >
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
              className="h-full w-full"
              contentClassName="flex flex-col h-full min-h-0"
              bodyClassName="flex-1 min-h-0 overflow-y-auto pr-2 md:pr-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <InsightsContent />
            </SidebarPanel>
          </aside>
        )}
      </div>

      {isMobileViewport && rightSidebarOpen && (
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
              <InsightsContent className="pt-4 pb-6" />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {isMobileViewport && showCollapseButton && (
        <Button
          variant="outline"
          onClick={() => setRightSidebarOpen(false)}
          className="hidden sm:flex lg:hidden !h-7 !w-7 rounded-full !p-0 !min-w-0 !min-h-0 shrink-0 items-center justify-center fixed top-[12px] right-[434px] z-[999] shadow-lg bg-white pointer-events-auto transition-all duration-200 animate-in fade-in-0 zoom-in-95 border-0"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}

      {/* Reservation Details Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={reservation?.guestName || "Reservation Details"}
        subtitle={`${reservation?.time} • ${reservation?.code}`}
      >
        {reservation && (() => {
          const dietaryNeeds = Array.isArray(reservation.dietaryNeeds) ? reservation.dietaryNeeds : []

          return (
          <div className="space-y-6">
            <ConnectedRecords
              reservation={{ id: reservation.code, name: reservation.guestName, time: reservation.time }}
              table={
                reservation.table
                  ? { id: reservation.tableId || reservation.table, label: reservation.table, zone: reservation.zone }
                  : undefined
              }
              order={
                reservation.linkedOrderId ? { id: reservation.linkedOrderId, total: reservation.spendTotal } : undefined
              }
              sessionId={sessionId}
            />

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              <StatusBadge status={reservation.status} />
              {reservation.isVIP && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                >
                  <Star className="size-3 mr-1 fill-amber-500" />
                  VIP
                </Badge>
              )}
              {getUrgencyBadge(reservation.urgency, reservation.minutesUntil, reservation.graceLeft)}
            </div>

            {/* Core Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Reservation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Guests</p>
                      <p className="text-sm font-medium">
                        {reservation.partySize}
                        {reservation.children > 0 && ` + ${reservation.children} kids`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Table</p>
                      <p className="text-sm font-medium">{reservation.table || "Not assigned"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-medium">{reservation.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="text-sm font-medium">{reservation.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Staff</p>
                      <p className="text-sm font-medium">{reservation.staff || "Not assigned"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">{displayPhone(reservation.phone)}</p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm">{reservation.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <Badge variant="outline">{reservation.source}</Badge>
                </div>
                {reservation.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{reservation.notes}</p>
                  </div>
                )}
                {reservation.specialRequests && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Special Requests</p>
                    <p className="text-sm">{reservation.specialRequests}</p>
                  </div>
                )}
                {dietaryNeeds.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Dietary Needs</p>
                    <div className="flex flex-wrap gap-1">
                      {dietaryNeeds.map((need) => (
                        <Badge key={need} variant="outline" className="text-xs">
                          {need}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Linked Order */}
            {reservation.linkedOrderId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Linked Order</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{reservation.linkedOrderId}</span>
                    </div>
                    <Button size="sm" variant="outline">
                      View Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Customer Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Visits</p>
                    <p className="text-sm font-medium">{reservation.customerProfile.totalVisits}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Spend</p>
                    <p className="text-sm font-medium">${reservation.customerProfile.avgSpend.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Loyalty Tier</p>
                    <Badge variant="outline">{reservation.loyaltyTier}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Visit</p>
                    <p className="text-sm font-medium">{reservation.customerProfile.lastVisit || "First visit"}</p>
                  </div>
                </div>
                {reservation.customerProfile.favoriteItems.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Favorite Items</p>
                    <div className="flex flex-wrap gap-1">
                      {reservation.customerProfile.favoriteItems.map((item) => (
                        <Badge key={item} variant="outline" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reservation.timeline.map((activity, index) => (
                    <div key={index} className="flex gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{activity.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.event}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.time} • {activity.user}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2 sticky bottom-0 bg-background pt-4 border-t">
              {reservation.status === "reserved" || reservation.status === "confirmed" ? (
                <Button className="flex-1" onClick={() => handleSeatNow(reservation)}>
                  Seat Now
                </Button>
              ) : null}
              <Button variant="outline" className="flex-1 bg-transparent">
                Edit
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent">
                Cancel
              </Button>
            </div>
          </div>
          )
        })()}
      </Drawer>

      {/* Conflict Drawer */}
      <Drawer
        isOpen={isConflictDrawerOpen}
        onClose={() => setIsConflictDrawerOpen(false)}
        title="Resolve Conflict"
        subtitle={`Table ${mockConflict.table} - Overlapping Reservations`}
      >
        <div className="space-y-6">
          <AlertBanner
            variant="warning"
            message="Two reservations are scheduled for the same table at overlapping times"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Conflicting Reservations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockConflict.reservations.map((res) => (
                <div key={res.id} className="p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{res.guest}</span>
                    <Badge variant="outline">{res.id}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {res.time}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="size-3" />
                      {res.partySize} guests
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Suggested Solutions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <MapPin className="size-4 mr-2" />
                Auto-assign alternative table
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <Clock className="size-4 mr-2" />
                Delay second seating by 15 minutes
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <AlertTriangle className="size-4 mr-2" />
                Override and keep both
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button className="flex-1">Apply Solution</Button>
            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setIsConflictDrawerOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>

      {/* New Reservation Modal */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
            <DialogDescription>Create a new reservation for a guest</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="guest" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="guest">Guest</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="confirm">Confirm</TabsTrigger>
            </TabsList>

            <TabsContent value="guest" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guest-name">Guest Name *</Label>
                <Input id="guest-name" placeholder="Enter guest name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <PhoneNumberField
                    id="phone"
                    value={newReservationPhone}
                    onChange={setNewReservationPhone}
                    placeholder="Mobile number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="guest@email.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="party-size">Party Size *</Label>
                <Select>
                  <SelectTrigger id="party-size">
                    <SelectValue placeholder="Select party size" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size} {size === 1 ? "guest" : "guests"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start bg-transparent">
                        <CalendarIcon className="size-4 mr-2" />
                        Select date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time *</Label>
                  <Select>
                    <SelectTrigger id="time">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {["6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"].map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="table">Table</Label>
                <Select>
                  <SelectTrigger id="table">
                    <SelectValue placeholder="Auto-assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-assign</SelectItem>
                    {tables.slice(0, 10).map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        Table {table.number} ({table.capacity} seats)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff">Assign Staff</Label>
                <Select>
                  <SelectTrigger id="staff">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S1">John Smith</SelectItem>
                    <SelectItem value="S2">Maria Garcia</SelectItem>
                    <SelectItem value="S3">David Lee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-4">
              <div className="space-y-2">
                <Label>Quick Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: Cake, label: "Birthday" },
                    { icon: Star, label: "VIP" },
                    { icon: Users, label: "Anniversary" },
                  ].map((tag) => (
                    <Button key={tag.label} variant="outline" size="sm">
                      <tag.icon className="size-3 mr-1" />
                      {tag.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dietary Needs</Label>
                <div className="space-y-2">
                  {["Vegetarian", "Vegan", "Gluten-free", "Nut allergy", "Dairy-free"].map((need) => (
                    <div key={need} className="flex items-center space-x-2">
                      <Checkbox id={need} />
                      <Label htmlFor={need} className="font-normal">
                        {need}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Special Requests</Label>
                <Input id="notes" placeholder="Any special requests or notes..." />
              </div>
            </TabsContent>

            <TabsContent value="confirm" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Reservation Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guest:</span>
                    <span className="font-medium">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Party Size:</span>
                    <span className="font-medium">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date & Time:</span>
                    <span className="font-medium">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table:</span>
                    <span className="font-medium">Auto-assign</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline">Save Draft</Button>
            <Button>Create Reservation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAB */}
    </div>
  )
}
