"use client"

import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneNumberField } from "@/components/shared/phone-number-field"
import { useLocation } from "@/lib/contexts/LocationContext"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  Download,
  Grid,
  List,
  Plus,
  Search,
  ChevronDown,
  AlertCircle,
  Activity,
  MoreVertical,
  MessageSquare,
  MapPin,
  Mail,
  Star,
  Calendar,
  Clock3,
  X,
  RefreshCw,
  ChevronLeft,
  Settings,
  Phone,
  ChevronRight,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { SidebarPanel } from "@/components/ui/sidebar-panel"
import { cn } from "@/lib/utils"
import { mockStaffData, getWorkloadColor, getRoleColor, getStatusColor } from "@/lib/staff-data"
import { useIsMobile } from "@/hooks/use-mobile"
import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal"

export default function StaffPage() {
  const displayPhone = useDisplayPhone()
  const [view, setView] = useState<"grid" | "list">("grid")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState<string[]>([])
  const [selectedShift, setSelectedShift] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedStaff, setSelectedStaff] = useState<(typeof mockStaffData)[0] | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAddStaffDrawerOpen, setIsAddStaffDrawerOpen] = useState(false)
  const [isEditStaffDrawerOpen, setIsEditStaffDrawerOpen] = useState(false)
  const [staffToEdit, setStaffToEdit] = useState<(typeof mockStaffData)[0] | null>(null)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  )
  const [isInsightsCollapsed, setIsInsightsCollapsed] = useState(false)
  const [showCollapseButton, setShowCollapseButton] = useState(false)

  const isMobile = useIsMobile()

  const hasActiveFilters = useMemo(() => {
    return searchTerm !== "" || selectedRole.length > 0 || selectedShift !== "all" || selectedStatus !== "all"
  }, [searchTerm, selectedRole, selectedShift, selectedStatus])

  const handleResetFilters = () => {
    setSearchTerm("")
    setSelectedRole([])
    setSelectedShift("all")
    setSelectedStatus("all")
  }

  const handleEditStaff = (staff: (typeof mockStaffData)[0]) => {
    setStaffToEdit(staff)
    setIsEditStaffDrawerOpen(true)
    setIsDrawerOpen(false) // Close detail drawer
  }

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

  // Filter logic
  const filteredStaff = useMemo(() => {
    return mockStaffData.filter((staff) => {
      const matchesSearch = staff.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = selectedRole.length === 0 || selectedRole.includes(staff.role)
      const matchesShift = selectedShift === "all" || staff.currentShift.type === selectedShift
      const matchesStatus = selectedStatus === "all" || staff.status === selectedStatus

      return matchesSearch && matchesRole && matchesShift && matchesStatus
    })
  }, [searchTerm, selectedRole, selectedShift, selectedStatus])

  const activeClockedIn = mockStaffData.filter((s) => s.clockedIn).length
  const onBreak = mockStaffData.filter((s) => s.currentBreak).length
  const avgWorkload = Math.round(mockStaffData.reduce((sum, s) => sum + s.workload, 0) / mockStaffData.length)
  const totalStaff = mockStaffData.length

  const handleSelectStaff = (staff: (typeof mockStaffData)[0]) => {
    setSelectedStaff(staff)
    setIsDrawerOpen(true)
  }

  return (
    <div className="h-full">
      <div
        className={cn(
          "mx-auto w-full max-w-screen-2xl grid gap-6 transition-all duration-300 px-4 py-4 md:px-6 md:py-6",
          "grid-cols-1",
          rightSidebarOpen ? "lg:grid-cols-[1fr_minmax(200px,22vw)]" : "lg:grid-cols-1",
        )}
      >
        <section className="flex flex-col gap-6 min-w-0">
          {/* Header and Controls */}
          <div className="space-y-4">
            {/* Title and Top Actions */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1 text-left">
                <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
                <p className="text-muted-foreground">Manage your team</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="gap-2 shrink-0" onClick={() => setIsAddStaffDrawerOpen(true)}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Staff</span>
                </Button>

                <Button variant="outline" size="sm" className="gap-2 shrink-0 bg-transparent">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Clock In/Out</span>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 shrink-0 bg-transparent">
                      <Download className="h-4 w-4" />
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Export as PDF</DropdownMenuItem>
                    <DropdownMenuItem>Export as CSV</DropdownMenuItem>
                    <DropdownMenuItem>Export as Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {!rightSidebarOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex md:flex gap-2 shrink-0 bg-transparent"
                    onClick={() => {
                      setRightSidebarOpen(true)
                      setIsInsightsCollapsed(false)
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}

                {!rightSidebarOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                    className="hidden"
                  >
                    <ChevronDown className={cn("h-5 w-5 transition-transform", rightSidebarOpen ? "rotate-180" : "")} />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                  className="lg:hidden"
                >
                  <ChevronDown className={cn("h-5 w-5 transition-transform", rightSidebarOpen ? "rotate-180" : "")} />
                </Button>
              </div>
            </div>

            {/* Quick Stats Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  selectedStatus === "available"
                    ? "bg-green-500 text-white border-green-500 dark:bg-green-500 dark:text-white dark:border-green-500"
                    : "hover:bg-green-100 dark:hover:bg-green-900",
                )}
                onClick={() => setSelectedStatus(selectedStatus === "available" ? "all" : "available")}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full mr-2",
                    selectedStatus === "available" ? "bg-white" : "bg-green-500",
                  )}
                />
                {mockStaffData.filter((s) => s.status === "available").length} Available
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  selectedStatus === "busy"
                    ? "bg-red-500 text-white border-red-500 dark:bg-red-500 dark:text-white dark:border-red-500"
                    : "hover:bg-red-100 dark:hover:bg-red-900",
                )}
                onClick={() => setSelectedStatus(selectedStatus === "busy" ? "all" : "busy")}
              >
                <span
                  className={cn("w-2 h-2 rounded-full mr-2", selectedStatus === "busy" ? "bg-white" : "bg-red-500")}
                />
                {mockStaffData.filter((s) => s.status === "busy").length} Busy
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
                  selectedStatus === "break"
                    ? "bg-yellow-500 text-white border-yellow-500 dark:bg-yellow-500 dark:text-white dark:border-yellow-500"
                    : "hover:bg-yellow-100 dark:hover:bg-yellow-900",
                )}
                onClick={() => setSelectedStatus(selectedStatus === "break" ? "all" : "break")}
              >
                <span
                  className={cn("w-2 h-2 rounded-full mr-2", selectedStatus === "break" ? "bg-white" : "bg-yellow-500")}
                />
                {mockStaffData.filter((s) => s.status === "break").length} On Break
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

            {/* Unified Control Bar */}
            <div className="space-y-2 md:space-y-0">
              <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full">
                {/* Search bar */}
                <div className="relative w-full md:min-w-[120px] md:max-w-[240px] md:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn("pl-9", searchTerm && "pr-9")}
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchTerm("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Status select */}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="flex-1 md:w-[120px] md:flex-none shrink-0">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="break">On Break</SelectItem>
                  </SelectContent>
                </Select>

                {/* Shift select */}
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="flex-1 md:w-[120px] md:flex-none shrink-0">
                    <SelectValue placeholder="Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>

                {/* View mode toggle */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant={view === "grid" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setView("grid")}
                    className="h-9 w-9"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={view === "list" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setView("list")}
                    className="h-9 w-9"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 bg-transparent">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {/* Settings button */}
                  <Button variant="outline" size="icon" className="h-9 w-9 bg-transparent">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1 shrink-0"></div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="min-w-0">
            {view === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
                {filteredStaff.map((staff) => (
                  <StaffCard key={staff.staffId} staff={staff} onSelect={handleSelectStaff} />
                ))}
              </div>
            ) : (
              <StaffListView staff={filteredStaff} onSelectStaff={handleSelectStaff} />
            )}
          </div>
        </section>

        {/* Sidebar - Desktop */}
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
              <StaffInsights mockData={mockStaffData} />
            </SidebarPanel>
          </aside>
        )}
      </div>

      {/* Sidebar - Mobile */}
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
              <div className="pt-4 pb-6">
                <StaffInsights mockData={mockStaffData} />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Collapse Button for Mobile */}
      {isMobile && showCollapseButton && (
        <Button
          variant="outline"
          onClick={() => setRightSidebarOpen(false)}
          className="hidden sm:flex lg:hidden !h-7 !w-7 rounded-full !p-0 !min-w-0 !min-h-0 shrink-0 items-center justify-center fixed top-[12px] right-[434px] z-[999] shadow-lg bg-white dark:bg-slate-950 pointer-events-auto transition-all duration-200 animate-in fade-in-0 zoom-in-95 border-0"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}

      {/* Staff Detail Drawer */}
      {selectedStaff && (
        <StaffDetailDrawer
          staff={selectedStaff}
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          onEdit={handleEditStaff}
        />
      )}

      <AddStaffDrawer isOpen={isAddStaffDrawerOpen} onOpenChange={setIsAddStaffDrawerOpen} />

      {staffToEdit && (
        <EditStaffDrawer staff={staffToEdit} isOpen={isEditStaffDrawerOpen} onOpenChange={setIsEditStaffDrawerOpen} />
      )}
    </div>
  )
}

// Staff Card Component
function StaffCard({
  staff,
  onSelect,
}: {
  staff: (typeof mockStaffData)[0]
  onSelect: (staff: (typeof mockStaffData)[0]) => void
}) {
  const workloadColor = getWorkloadColor(staff.workload)
  const roleColor = getRoleColor(staff.role)
  const statusColor = getStatusColor(staff.status)

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 overflow-hidden"
      onClick={() => onSelect(staff)}
    >
      <div className="p-4 space-y-3">
        {/* Header with Avatar and Status */}
        <div className="flex items-start justify-between">
          <div className="flex gap-3 items-start flex-1">
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src={staff.avatar || "/placeholder.svg"} alt={staff.name} />
                <AvatarFallback>{staff.name.substring(0, 2)}</AvatarFallback>
              </Avatar>
              {staff.clockedIn && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{staff.name}</p>
              <Badge variant="outline" className={cn("text-xs", roleColor)}>
                {staff.role}
              </Badge>
            </div>
          </div>
          <Badge className={cn("text-xs", statusColor)}>
            {staff.status.charAt(0).toUpperCase() + staff.status.slice(1)}
          </Badge>
        </div>

        <Separator />

        {/* Metrics */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Workload</span>
            <span className="font-semibold">{staff.workload}%</span>
          </div>
          <Progress value={staff.workload} className="h-2" />

          <div className="pt-2 space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Tables: {staff.tablesAssigned.length} active</span>
              <span>{staff.todayMetrics.tablesServed} served</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Orders: {staff.ordersAssigned.length} active</span>
              <span>{staff.todayMetrics.ordersCompleted} completed</span>
            </div>
          </div>
        </div>

        {/* Shift Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock3 className="w-4 h-4" />
          <span>
            {staff.currentShift.start} - {staff.currentShift.end}
          </span>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2 bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Message</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2 bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">Locate</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Staff List View Component
function StaffListView({
  staff,
  onSelectStaff,
}: {
  staff: (typeof mockStaffData)[0][]
  onSelectStaff: (staff: (typeof mockStaffData)[0]) => void
}) {
  return (
    <div className="space-y-2">
      {staff.map((s) => (
        <Card
          key={s.staffId}
          className="p-4 cursor-pointer hover:bg-accent transition-colors"
          onClick={() => onSelectStaff(s)}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <Avatar className="h-10 w-10">
                <AvatarImage src={s.avatar || "/placeholder.svg"} alt={s.name} />
                <AvatarFallback>{s.name.substring(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{s.name}</p>
                <Badge variant="outline" className="text-xs">
                  {s.role}
                </Badge>
              </div>
            </div>

            <Badge className={cn("text-xs", getStatusColor(s.status))}>
              {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
            </Badge>

            <div className="text-sm text-muted-foreground text-right hidden md:block">
              <p>Tables: {s.tablesAssigned.length}</p>
              <p>Orders: {s.ordersAssigned.length}</p>
            </div>

            <div className="text-sm text-muted-foreground text-right">
              <p>
                {s.currentShift.start} - {s.currentShift.end}
              </p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span className="font-semibold">{s.performanceRating}</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

// Staff Insights Component (Replaces Staff Sidebar Component)
function StaffInsights({ mockData }: { mockData: (typeof mockStaffData)[0][] }) {
  const topPerformer = mockData.sort((a, b) => b.performanceRating - a.performanceRating)[0]
  const recentActivities = [
    { id: 1, text: "Sarah clocked in", time: "2 min ago" },
    { id: 2, text: "Mike completed Order #127", time: "5 min ago" },
    { id: 3, text: "Emma took break", time: "12 min ago" },
    { id: 4, text: "John finished shift", time: "45 min ago" },
  ]

  const alerts = [
    { id: 1, type: "overload", text: "Sarah is overloaded (92% workload)", severity: "high" },
    { id: 2, type: "break", text: "Mike overdue for break (5+ hours)", severity: "medium" },
    { id: 3, type: "shift", text: "Emma shift ending in 15 min", severity: "low" },
  ]

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="space-y-3 mt-3.5">
        <h3 className="font-semibold text-foreground text-sm">Quick Stats</h3>
        <div className="grid gap-2">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Total Staff</div>
            <div className="text-2xl font-bold">{mockData.length}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Clocked In</div>
            <div className="text-2xl font-bold">{mockData.filter((s) => s.clockedIn).length}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Avg Workload</div>
            <div className="text-2xl font-bold">
              {Math.round(mockData.reduce((sum, s) => sum + s.workload, 0) / mockData.length)}%
            </div>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Top Performer */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Top Performer</h3>
        <Card className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={topPerformer.avatar || "/placeholder.svg"} alt={topPerformer.name} />
              <AvatarFallback>{topPerformer.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sm">{topPerformer.name}</p>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span className="text-xs font-semibold">{topPerformer.performanceRating}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Separator />

      {/* Activity Feed */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4" />
          Live Activity
        </h3>
        <ScrollArea className="h-[150px]">
          <div className="space-y-2 pr-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="text-xs p-2 bg-card rounded-lg border border-border">
                <p className="text-foreground font-medium">{activity.text}</p>
                <p className="text-muted-foreground text-xs">{activity.time}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      {/* Alerts */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          Alerts
        </h3>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={cn(
                "p-2 border-l-4",
                alert.severity === "high"
                  ? "border-l-red-500 bg-red-500/5"
                  : alert.severity === "medium"
                    ? "border-l-yellow-500 bg-yellow-500/5"
                    : "border-l-blue-500 bg-blue-500/5",
              )}
            >
              <p className="text-xs font-medium text-foreground">{alert.text}</p>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Performance Chart */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Performance</h3>
        <Card className="p-3">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Servers</span>
              <span className="font-semibold">245</span>
            </div>
            <div className="flex justify-between">
              <span>Kitchen</span>
              <span className="font-semibold">180</span>
            </div>
            <div className="flex justify-between">
              <span>Bartenders</span>
              <span className="font-semibold">95</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// Staff Detail Drawer Component
function StaffDetailDrawer({
  staff,
  isOpen,
  onOpenChange,
  onEdit,
}: {
  staff: (typeof mockStaffData)[0]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (staff: (typeof mockStaffData)[0]) => void
}) {
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    if (isOpen) {
      setActiveTab("overview")
    }
  }, [isOpen])

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full p-0 flex flex-col h-full",
          "sm:max-w-[480px] md:w-[480px]",
          "max-md:h-screen max-md:rounded-none max-md:border-none",
        )}
      >
        <div className="sticky top-0 z-10 border-b bg-white dark:bg-slate-950">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="size-8">
                <X className="size-4" />
              </Button>
              <SheetTitle className="text-lg font-semibold">{staff.name}</SheetTitle>
            </div>
            <Badge className={cn("text-xs", getStatusColor(staff.status))}>
              {staff.status.charAt(0).toUpperCase() + staff.status.slice(1)}
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <div className="sticky top-[55px] z-10 border-b bg-white dark:bg-slate-950">
            <TabsList className="w-full justify-start rounded-none border-0 bg-transparent p-0">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="assignment"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
              >
                Assignment
              </TabsTrigger>
              <TabsTrigger
                value="metrics"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
              >
                Metrics
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
              >
                Performance
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Staff Profile Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={staff.avatar || "/placeholder.svg"} alt={staff.name} />
                      <AvatarFallback className="text-lg">{staff.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">{staff.name}</h3>
                      <Badge variant="outline" className={cn("mt-1", getRoleColor(staff.role))}>
                        {staff.role}
                      </Badge>
                      <div className="flex items-center gap-1 mt-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-semibold">{staff.performanceRating}/5</span>
                        <span className="text-xs text-muted-foreground ml-1">rating</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Contact Information</h3>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium text-sm">{displayPhone(staff.phone)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium text-sm">{staff.email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Employment Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Employment Details</h3>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Hire Date</p>
                        <p className="font-medium text-sm">{staff.hireDate}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock3 className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Current Shift</p>
                        <p className="font-medium text-sm">
                          {staff.currentShift.start} - {staff.currentShift.end}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {staff.currentShift.type.charAt(0).toUpperCase() + staff.currentShift.type.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    {staff.clockedIn && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-300">
                            Currently Clocked In
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Certifications */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Certifications</h3>
                  <div className="space-y-2">
                    {staff.certifications.map((cert) => (
                      <div key={cert.name} className="p-3 bg-card border border-border rounded-lg">
                        <p className="font-medium text-sm">{cert.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">Expires: {cert.expires}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Assignment Tab */}
          <TabsContent value="assignment" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Active Tables</h3>
                    <Badge variant="secondary">{staff.tablesAssigned.length} tables</Badge>
                  </div>

                  <div className="space-y-2">
                    {staff.tablesAssigned.length > 0 ? (
                      staff.tablesAssigned.map((table) => (
                        <div
                          key={table}
                          className="p-3 bg-card border border-border rounded-lg flex justify-between items-center"
                        >
                          <span className="font-medium text-sm">{table}</span>
                          <Button size="sm" variant="outline">
                            Reassign
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-muted-foreground text-sm">No tables currently assigned</div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Active Orders</h3>
                    <Badge variant="secondary">{staff.ordersAssigned.length} orders</Badge>
                  </div>

                  <div className="space-y-2">
                    {staff.ordersAssigned.length > 0 ? (
                      staff.ordersAssigned.map((order) => (
                        <div
                          key={order}
                          className="p-3 bg-card border border-border rounded-lg flex justify-between items-center"
                        >
                          <span className="font-medium text-sm">{order}</span>
                          <Badge variant="outline" className="text-xs">
                            In Progress
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-muted-foreground text-sm">No orders currently assigned</div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Today's Performance</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Orders</p>
                      <p className="text-2xl font-bold">{staff.todayMetrics.ordersCompleted}</p>
                      <p className="text-xs text-muted-foreground mt-1">completed</p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Tables</p>
                      <p className="text-2xl font-bold">{staff.todayMetrics.tablesServed}</p>
                      <p className="text-xs text-muted-foreground mt-1">served</p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Avg Time</p>
                      <p className="text-2xl font-bold">{staff.todayMetrics.avgServiceTime}</p>
                      <p className="text-xs text-muted-foreground mt-1">minutes</p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Tips</p>
                      <p className="text-2xl font-bold">${staff.todayMetrics.tipsEarned}</p>
                      <p className="text-xs text-muted-foreground mt-1">earned</p>
                    </Card>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Customer Feedback</h3>
                  <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "w-5 h-5",
                              i < Math.floor(staff.todayMetrics.customerRating)
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300",
                            )}
                          />
                        ))}
                      </div>
                      <span className="font-bold text-lg">{staff.todayMetrics.customerRating}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Average customer rating today</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Workload</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current workload</span>
                      <span className="font-semibold">{staff.workload}%</span>
                    </div>
                    <Progress value={staff.workload} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {staff.workload >= 80
                        ? "High workload - consider redistributing"
                        : staff.workload >= 50
                          ? "Moderate workload"
                          : "Low workload"}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Performance Rating</h3>
                  <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="text-3xl font-bold">{staff.performanceRating}</span>
                        <span className="text-muted-foreground">/5</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      >
                        Excellent
                      </Badge>
                    </div>
                    <Progress value={staff.performanceRating * 20} className="h-2" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Achievement Badges</h3>
                  <div className="flex flex-wrap gap-2">
                    {staff.badges.map((badge) => (
                      <Badge key={badge} variant="secondary" className="px-3 py-1">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Weekly Overview</h3>
                  <Card className="p-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Orders/Day</span>
                        <span className="font-semibold">
                          {Math.round(
                            staff.weeklyMetrics.ordersCompleted.reduce((a, b) => a + b) /
                              staff.weeklyMetrics.ordersCompleted.length,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Customer Rating</span>
                        <span className="font-semibold">
                          {(
                            staff.weeklyMetrics.customerRatings.reduce((a, b) => a + b) /
                            staff.weeklyMetrics.customerRatings.length
                          ).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Tips</span>
                        <span className="font-semibold">
                          ${staff.weeklyMetrics.ordersCompleted.reduce((a, b) => a + b) * 5}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Recent Notes</h3>
                  <div className="space-y-2">
                    {staff.notes.slice(0, 3).map((note) => (
                      <Card key={note.id} className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">{note.date}</p>
                        <p className="text-sm">{note.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">— {note.author}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <SheetFooter className="sticky bottom-0 border-t bg-white dark:bg-slate-950 p-4">
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => onEdit(staff)}>
              Edit Staff
            </Button>
            <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
              <Clock className="w-4 h-4 mr-2" />
              Clock In/Out
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// Add Staff Modal Component
function AddStaffModal({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [phone, setPhone] = useState("")
  const storeCountry = useLocation().getCurrentLocation()?.country

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name *</label>
            <Input placeholder="Enter staff name" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role *</label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="server">Server</SelectItem>
                <SelectItem value="chef">Chef</SelectItem>
                <SelectItem value="bartender">Bartender</SelectItem>
                <SelectItem value="host">Host</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <PhoneNumberField
                value={phone}
                onChange={setPhone}
                defaultCountry={storeCountry}
                placeholder="Mobile number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="staff@berrytap.com" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Hourly Rate</label>
            <Input type="number" placeholder="15.50" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Input type="date" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>Add Staff</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddStaffDrawer({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState("basic")
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [phone, setPhone] = useState("")
  const storeCountry = useLocation().getCurrentLocation()?.country

  useEffect(() => {
    if (isOpen) {
      setActiveTab("basic")
      setIsClosing(false)
      setIsDirty(false)
    }
  }, [isOpen])

  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedModal(true)
      return
    }
    setIsClosing(true)
    onOpenChange(false)
  }

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false)
    setIsClosing(true)
    setIsDirty(false)
    onOpenChange(false)
  }

  const handleSaveAndClose = async () => {
    setShowUnsavedModal(false)
    await handleSave()
    setIsClosing(true)
    onOpenChange(false)
  }

  const handleCancelUnsaved = () => {
    setShowUnsavedModal(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Add save logic here
    setTimeout(() => {
      setIsSaving(false)
      setIsDirty(false)
      onOpenChange(false)
    }, 1000)
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          className={cn(
            "w-full p-0 flex flex-col h-full",
            "sm:max-w-[480px] md:w-[480px]",
            "max-md:h-screen max-md:rounded-none max-md:border-none",
          )}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b bg-white dark:bg-slate-950">
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={handleClose} className="size-8">
                  <X className="size-4" />
                </Button>
                <SheetTitle className="text-lg font-semibold">New Staff Member</SheetTitle>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <div className="sticky top-[55px] z-10 border-b bg-white dark:bg-slate-950">
              <TabsList className="w-full justify-start rounded-none border-0 bg-transparent p-0">
                <TabsTrigger
                  value="basic"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
                >
                  Basic Info
                </TabsTrigger>
                <TabsTrigger
                  value="schedule"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
                >
                  Schedule
                </TabsTrigger>
                <TabsTrigger
                  value="access"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
                >
                  Access
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: BASIC INFO */}
            <TabsContent value="basic" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Personal Information</h3>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name *</label>
                      <Input placeholder="Enter staff name" onChange={() => setIsDirty(true)} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role *</label>
                      <Select onValueChange={() => setIsDirty(true)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="server">Server</SelectItem>
                          <SelectItem value="chef">Chef</SelectItem>
                          <SelectItem value="bartender">Bartender</SelectItem>
                          <SelectItem value="host">Host</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Phone</label>
                        <PhoneNumberField
                          value={phone}
                          onChange={(next) => {
                            setPhone(next)
                            setIsDirty(true)
                          }}
                          defaultCountry={storeCountry}
                          placeholder="Mobile number"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input type="email" placeholder="staff@berrytap.com" onChange={() => setIsDirty(true)} />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold">Employment Details</h3>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Hourly Rate</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          className="pl-7"
                          placeholder="15.50"
                          onChange={() => setIsDirty(true)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Date</label>
                      <Input type="date" onChange={() => setIsDirty(true)} />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB 2: SCHEDULE */}
            <TabsContent value="schedule" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Work Schedule</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Set the default working hours for this staff member
                    </p>

                    <div className="space-y-3">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                        <div key={day} className="flex items-center gap-3">
                          <div className="w-24">
                            <label className="text-sm font-medium">{day}</label>
                          </div>
                          <Select defaultValue="off" onValueChange={() => setIsDirty(true)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="off">Day Off</SelectItem>
                              <SelectItem value="morning">Morning (9 AM - 5 PM)</SelectItem>
                              <SelectItem value="evening">Evening (5 PM - 11 PM)</SelectItem>
                              <SelectItem value="full">Full Day (9 AM - 11 PM)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB 3: ACCESS */}
            <TabsContent value="access" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">System Access</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Control what this staff member can access in the system
                    </p>

                    <div className="space-y-3">
                      {[
                        { name: "View Orders", description: "Can view all orders" },
                        { name: "Manage Menu", description: "Can edit menu items and categories" },
                        { name: "Manage Staff", description: "Can add and edit staff members" },
                      ].map((permission) => (
                        <div key={permission.name} className="flex items-start gap-3 p-3 border rounded-lg">
                          <input type="checkbox" className="mt-1" onChange={() => setIsDirty(true)} />
                          <div>
                            <p className="font-medium text-sm">{permission.name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{permission.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <SheetFooter className="sticky bottom-0 border-t bg-white dark:bg-slate-950 p-4">
            <div className="flex w-full gap-2">
              <Button variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Adding..." : "Add Staff"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <UnsavedChangesModal
        open={showUnsavedModal}
        onOpenChange={setShowUnsavedModal}
        onDiscard={handleDiscardChanges}
        onSave={handleSaveAndClose}
        onCancel={handleCancelUnsaved}
        isSaving={isSaving}
      />
    </>
  )
}

function EditStaffDrawer({
  staff,
  isOpen,
  onOpenChange,
}: {
  staff: (typeof mockStaffData)[0]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState("basic")
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [phone, setPhone] = useState(staff.phone)
  const storeCountry = useLocation().getCurrentLocation()?.country

  useEffect(() => {
    if (isOpen) {
      setActiveTab("basic")
      setIsClosing(false)
      setIsDirty(false)
      setPhone(staff.phone)
    }
  }, [isOpen, staff.phone])

  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedModal(true)
      return
    }
    setIsClosing(true)
    onOpenChange(false)
  }

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false)
    setIsClosing(true)
    setIsDirty(false)
    onOpenChange(false)
  }

  const handleSaveAndClose = async () => {
    setShowUnsavedModal(false)
    await handleSave()
    setIsClosing(true)
    onOpenChange(false)
  }

  const handleCancelUnsaved = () => {
    setShowUnsavedModal(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Add save logic here
    setTimeout(() => {
      setIsSaving(false)
      setIsDirty(false)
      onOpenChange(false)
    }, 1000)
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          className={cn(
            "w-full p-0 flex flex-col h-full",
            "sm:max-w-[480px] md:w-[480px]",
            "max-md:h-screen max-md:rounded-none max-md:border-none",
          )}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b bg-white dark:bg-slate-950">
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={handleClose} className="size-8">
                  <X className="size-4" />
                </Button>
                <SheetTitle className="text-lg font-semibold">Edit Staff Member</SheetTitle>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <div className="sticky top-[55px] z-10 border-b bg-white dark:bg-slate-950">
              <TabsList className="w-full justify-start rounded-none border-0 bg-transparent p-0">
                <TabsTrigger
                  value="basic"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
                >
                  Basic Info
                </TabsTrigger>
                <TabsTrigger
                  value="schedule"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
                >
                  Schedule
                </TabsTrigger>
                <TabsTrigger
                  value="access"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
                >
                  Access
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: BASIC INFO */}
            <TabsContent value="basic" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Personal Information</h3>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name *</label>
                      <Input
                        defaultValue={staff.name}
                        placeholder="Enter staff name"
                        onChange={() => setIsDirty(true)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role *</label>
                      <Select defaultValue={staff.role} onValueChange={() => setIsDirty(true)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="server">Server</SelectItem>
                          <SelectItem value="chef">Chef</SelectItem>
                          <SelectItem value="bartender">Bartender</SelectItem>
                          <SelectItem value="host">Host</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Phone</label>
                        <PhoneNumberField
                          value={phone}
                          onChange={(next) => {
                            setPhone(next)
                            setIsDirty(true)
                          }}
                          defaultCountry={storeCountry}
                          placeholder="Mobile number"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input
                          type="email"
                          defaultValue={staff.email}
                          placeholder="staff@berrytap.com"
                          onChange={() => setIsDirty(true)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold">Employment Details</h3>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Hourly Rate</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          className="pl-7"
                          defaultValue="15.50"
                          placeholder="15.50"
                          onChange={() => setIsDirty(true)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Hire Date</label>
                      <Input type="date" defaultValue={staff.hireDate} onChange={() => setIsDirty(true)} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select defaultValue={staff.status} onValueChange={() => setIsDirty(true)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="busy">Busy</SelectItem>
                          <SelectItem value="break">On Break</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB 2: SCHEDULE */}
            <TabsContent value="schedule" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Work Schedule</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Set the default working hours for this staff member
                    </p>

                    <div className="space-y-3">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                        <div key={day} className="flex items-center gap-3">
                          <div className="w-24">
                            <label className="text-sm font-medium">{day}</label>
                          </div>
                          <Select defaultValue="off" onValueChange={() => setIsDirty(true)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="off">Day Off</SelectItem>
                              <SelectItem value="morning">Morning (9 AM - 5 PM)</SelectItem>
                              <SelectItem value="evening">Evening (5 PM - 11 PM)</SelectItem>
                              <SelectItem value="full">Full Day (9 AM - 11 PM)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold">Current Shift</h3>
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock3 className="w-4 h-4" />
                        <span className="font-medium">Today's Shift</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {staff.currentShift.start} - {staff.currentShift.end}
                      </p>
                      <Badge className="mt-2" variant="outline">
                        {staff.currentShift.type.charAt(0).toUpperCase() + staff.currentShift.type.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB 3: ACCESS */}
            <TabsContent value="access" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">System Access</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Control what this staff member can access in the system
                    </p>

                    <div className="space-y-3">
                      {[
                        { name: "View Orders", description: "Can view all orders" },
                        { name: "Manage Menu", description: "Can edit menu items and categories" },
                        { name: "Manage Staff", description: "Can add and edit staff members" },
                      ].map((permission) => (
                        <div key={permission.name} className="flex items-start gap-3 p-3 border rounded-lg">
                          <input type="checkbox" className="mt-1" onChange={() => setIsDirty(true)} />
                          <div>
                            <p className="font-medium text-sm">{permission.name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{permission.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold">Performance</h3>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium">Performance Rating</span>
                      </div>
                      <p className="text-2xl font-bold">{staff.performanceRating}/5</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {staff.badges.map((badge) => (
                          <Badge key={badge} variant="secondary" className="text-xs">
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <SheetFooter className="sticky bottom-0 border-t bg-white dark:bg-slate-950 p-4">
            <div className="flex w-full gap-2">
              <Button variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <UnsavedChangesModal
        open={showUnsavedModal}
        onOpenChange={setShowUnsavedModal}
        onDiscard={handleDiscardChanges}
        onSave={handleSaveAndClose}
        onCancel={handleCancelUnsaved}
        isSaving={isSaving}
      />
    </>
  )
}
