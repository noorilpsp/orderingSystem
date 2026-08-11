"use client"

import * as React from "react"
import {
  Search,
  Download,
  MoreHorizontal,
  X,
  Plus,
  CreditCard,
  AlertCircle,
  Flame,
  Wallet,
  ClipboardList,
  Edit,
  Trash2,
  Copy,
  Send,
  Printer,
  LayoutGrid,
  LayoutList,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  XCircle,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Drawer } from "@/components/ui/drawer"
import { StatusBadge } from "@/components/ui/status-badge"
import { SkeletonBlock } from "@/components/ui/skeleton-block"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SidebarPanel } from "@/components/ui/sidebar-panel"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ConnectedRecords from "@/components/connected/ConnectedRecords"
import { motion, AnimatePresence } from "framer-motion"

import { mockStaffWorkload, mockRecentOrderActivity, mockOrdersPerformance } from "@/lib/mockData"
import { LineChart, Line, ResponsiveContainer } from "recharts"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { StaffFilterProvider, useStaffFilter } from "./context/StaffFilterContext"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { useLocations } from "@/lib/hooks/useLocations"

const fullColumns = ["orderNumber", "table", "customer", "items", "total", "time", "status", "staff", "actions"]
const compactDesktopColumns = ["orderNumber", "table", "total", "time", "status"]
const compactMobileColumns = ["orderNumber", "table", "total", "status"]

// Type for order data from API
type OrderData = {
  id: string
  orderNumber: string
  orderType: string
  table: { id: string; tableNumber: string } | null
  customer: { id: string; name: string } | null
  itemsCount: number
  total: number
  createdAt: string
  status: string
  assignedStaff: { id: string; fullName: string } | null
  paymentStatus: string
  notes: string | null
  hasItemNotes: boolean
}

// Type for detailed order from API
type DetailedOrderData = {
  id: string
  orderNumber: string
  orderType: string
  status: string
  paymentStatus: string
  reservation: { id: string; reservationDate: string; reservationTime: string } | null
  table: { id: string; tableNumber: string } | null
  customer: { id: string; name: string; email: string | null; phone: string | null } | null
  assignedStaff: { id: string; fullName: string } | null
  items: Array<{
    id: string
    itemName: string
    itemPrice: number
    quantity: number
    customizations: Array<{
      groupName: string
      optionName: string
      optionPrice: number
      quantity: number
    }>
    customizationsTotal: number
    lineTotal: number
    notes: string | null
    status: string
  }>
  subtotal: number
  taxAmount: number
  serviceCharge: number
  tipAmount: number
  discountAmount: number
  total: number
  timeline: Array<{
    status: string
    createdAt: string
    changedBy: string
    note: string | null
  }>
  payments: Array<{
    id: string
    amount: number
    tipAmount: number
    method: string
    status: string
    paidAt: string | null
  }>
  delivery: {
    addressLine1: string
    addressLine2: string | null
    city: string
    postalCode: string
    deliveryInstructions: string | null
    deliveryFee: number
    estimatedDeliveryAt: string | null
    deliveredAt: string | null
  } | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

function OrdersPageContent() {
  const { locations, loading: locationsLoading } = useLocations()
  const [locationId, setLocationId] = React.useState<string | null>(null)
  const [orders, setOrders] = React.useState<OrderData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"table" | "card">("table")
  const [statusFilter, setStatusFilter] = React.useState<string[]>([])
  const [activeFilter, setActiveFilter] = React.useState(false)
  const [needsAttention, setNeedsAttention] = React.useState(false)
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc")

  const [windowWidth, setWindowWidth] = React.useState(typeof window !== "undefined" ? window.innerWidth : 1024)

  const [containerWidth, setContainerWidth] = React.useState(0)
  const controlsContainerRef = React.useRef<HTMLDivElement>(null)
  const mainColumnRef = React.useRef<HTMLDivElement>(null)
  const sidebarRef = React.useRef<HTMLDivElement>(null)
  const [sidebarHeight, setSidebarHeight] = React.useState<number | null>(null)

  // Set locationId from first available location
  React.useEffect(() => {
    if (!locationsLoading && locations.length > 0 && !locationId) {
      setLocationId(locations[0].id)
    }
  }, [locations, locationsLoading, locationId])

  // Fetch orders when locationId changes
  React.useEffect(() => {
    if (!locationId) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function fetchOrders() {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams({ locationId })
        // Note: API currently only supports single status, so we'll filter client-side for multiple
        // If you want to support multiple statuses in API, you'd need to update the API route

        const response = await fetch(`/api/orders?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to fetch orders")
        }

        const data = await response.json()
        if (!cancelled) {
          setOrders(data.orders || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch orders")
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to fetch orders",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchOrders()

    return () => {
      cancelled = true
    }
  }, [locationId, statusFilter])

  React.useEffect(() => {
    if (!controlsContainerRef.current) return

    let timeoutId: NodeJS.Timeout

    const resizeObserver = new ResizeObserver((entries) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width)
        }
      }, 50)
    })

    resizeObserver.observe(controlsContainerRef.current)

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [])

  const [isCompact, setIsCompact] = React.useState(() => {
    if (typeof window !== "undefined") {
      // Phase-2: User preferences will be loaded from backend
      const saved = localStorage.getItem("berrytap.orders.compact")
      if (saved !== null) return JSON.parse(saved)
      // Default to compact on mobile (<768px)
      if (window.innerWidth < 768) return true
    }
    return false
  })

  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedOrder, setSelectedOrder] = React.useState<DetailedOrderData | null>(null)
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  // Fetch detailed order when selected
  React.useEffect(() => {
    if (!selectedOrderId || !locationId) return

    let cancelled = false

    async function fetchOrderDetails() {
      try {
        const response = await fetch(`/api/orders/${selectedOrderId}`, {
          credentials: "include",
          cache: "no-store",
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to fetch order details")
        }

        const data = await response.json()
        if (!cancelled) {
          setSelectedOrder(data.order)
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to fetch order details",
            variant: "destructive",
          })
        }
      }
    }

    fetchOrderDetails()

    return () => {
      cancelled = true
    }
  }, [selectedOrderId, locationId])
  const [newOrderModalOpen, setNewOrderModalOpen] = React.useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = React.useState(
    () => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true),
  )
  const [isInsightsCollapsed, setIsInsightsCollapsed] = React.useState(false)
  const [showCollapseButton, setShowCollapseButton] = React.useState(false)

  const { selectedStaff, setSelectedStaff } = useStaffFilter()
  const isMobileViewport = useIsMobile()

  const searchParams = useSearchParams()
  const sessionId = searchParams.get("sessionId") ?? undefined

  const { toast } = useToast()

  const hasActiveFilters = React.useMemo(() => {
    return searchQuery !== "" || statusFilter.length > 0 || activeFilter || needsAttention || selectedStaff !== "all"
  }, [searchQuery, statusFilter, activeFilter, needsAttention, selectedStaff])

  const handleResetFilters = () => {
    setSearchQuery("")
    setStatusFilter([])
    setActiveFilter(false)
    setNeedsAttention(false)
    setSelectedStaff("all")
  }


  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status)
      } else {
        return [...prev, status]
      }
    })
  }

  React.useEffect(() => {
    localStorage.setItem("berrytap.orders.compact", JSON.stringify(isCompact))
  }, [isCompact])

  React.useEffect(() => {
    if (rightSidebarOpen) {
      const timer = setTimeout(() => {
        setShowCollapseButton(true)
      }, 275)

      return () => clearTimeout(timer)
    }

    setShowCollapseButton(false)
  }, [rightSidebarOpen])

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const showButtonText = containerWidth >= 700

  const visibleColumns = React.useMemo(() => {
    if (windowWidth < 640) return compactMobileColumns
    return isCompact ? compactDesktopColumns : fullColumns
  }, [windowWidth, isCompact])

  const showCompactToggle = windowWidth >= 640

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  React.useEffect(() => {
    const savedView = localStorage.getItem("ordersViewMode")
    if (savedView === "table" || savedView === "card") {
      setViewMode(savedView)
    }
  }, [])

  const handleViewModeChange = (mode: "table" | "card") => {
    setViewMode(mode)
    localStorage.setItem("ordersViewMode", mode)
  }

  const handleOrderClick = (order: OrderData) => {
    setSelectedOrderId(order.id)
    setDrawerOpen(true)
  }

  const handleMarkPaid = (order: typeof selectedOrder) => {
    if (!order) return

    toast({
      title: "✅ Payment received",
      description: (
        <div className="space-y-2">
          <p>Payment received for Order #{order.id}. Clear table?</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast({
                  title: "Table cleared",
                  description: `Table ${order.table} is now available.`,
                })
              }}
            >
              Yes, Clear
            </Button>
            <Button size="sm" variant="outline">
              Still Dining
            </Button>
          </div>
        </div>
      ),
    })
  }

  const filteredOrders = React.useMemo(() => {
    let filtered = orders.filter((order) => {
      // If activeFilter is on, show preparing OR any status in statusFilter
      // If activeFilter is off, only use statusFilter
      if (activeFilter && statusFilter.length > 0) {
        // Show orders that are either preparing (from active) OR match any status in statusFilter
        if (order.status !== "preparing" && !statusFilter.includes(order.status)) {
          return false
        }
      } else if (activeFilter) {
        // Only active filter is on, show only preparing
        if (order.status !== "preparing") {
          return false
        }
      } else if (statusFilter.length > 0) {
        // Only status filters are on, show matching statuses
        if (!statusFilter.includes(order.status)) {
          return false
        }
      }

      // Staff filter
      if (selectedStaff === "all") {
        // Show all orders
      } else if (selectedStaff === "me") {
        // TODO: Get current user's staff ID and filter
        // For now, show all orders
      } else {
        // Show orders for specific staff member
        if (order.assignedStaff?.fullName !== selectedStaff) return false
      }

      // Needs attention filter - only show orders with urgency (yellow or red)
      if (needsAttention && !hasUrgency(order)) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          order.orderNumber.toLowerCase().includes(query) ||
          order.customer?.name.toLowerCase().includes(query) ||
          order.table?.tableNumber.toLowerCase().includes(query)
        )
      }
      return true
    })

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (sortColumn) {
          case "orderNumber":
            aValue = a.orderNumber
            bValue = b.orderNumber
            break
          case "table":
            aValue = a.table?.tableNumber || (a.orderType === "pickup" ? "Pickup" : a.orderType === "delivery" ? "Delivery" : "")
            bValue = b.table?.tableNumber || (b.orderType === "pickup" ? "Pickup" : b.orderType === "delivery" ? "Delivery" : "")
            break
          case "customer":
            aValue = a.customer?.name || "Guest"
            bValue = b.customer?.name || "Guest"
            break
          case "items":
            aValue = a.itemsCount
            bValue = b.itemsCount
            break
          case "total":
            aValue = a.total
            bValue = b.total
            break
          case "time":
            aValue = new Date(a.createdAt).getTime()
            bValue = new Date(b.createdAt).getTime()
            break
          case "status":
            aValue = a.status
            bValue = b.status
            break
          case "staff":
            aValue = a.assignedStaff?.fullName || ""
            bValue = b.assignedStaff?.fullName || ""
            break
          default:
            return 0
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [orders, selectedStaff, searchQuery, sortColumn, sortDirection, statusFilter, activeFilter, needsAttention])

  React.useEffect(() => {
    if (!rightSidebarOpen || isMobileViewport) {
      setSidebarHeight(null)
      return
    }

    const updateSidebarHeight = () => {
      if (!mainColumnRef.current) return
      const mainHeight = mainColumnRef.current.getBoundingClientRect().height
      const viewportOffset =
        typeof window !== "undefined"
          ? Math.min(Math.max(Math.round(window.innerHeight * 0.22), 160), 360)
          : 200
      const height = Math.max(mainHeight + viewportOffset - 4, 280)
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
  }, [rightSidebarOpen, isMobileViewport, filteredOrders, viewMode, isCompact, isLoading])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Set new column and default to descending
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    )
  }

  const stats = React.useMemo(() => {
    return {
      active: orders.filter((o) => o.status === "preparing" || o.status === "ready").length,
      pending: orders.filter((o) => o.status === "pending").length,
      ready: orders.filter((o) => o.status === "ready").length,
      completed: orders.filter((o) => o.status === "completed").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    }
  }, [orders])

  const hasUrgency = (order: OrderData) => {
    // Calculate urgency based on order age and status
    const createdAt = new Date(order.createdAt)
    const now = new Date()
    const minutesAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60)

    // Highly urgent (red): pending > 30 min, preparing > 45 min, or cancelled
    if (order.status === "cancelled") return true
    if (order.status === "pending" && minutesAgo > 30) return true
    if (order.status === "preparing" && minutesAgo > 45) return true
    
    // Urgent (yellow): pending > 15 min, preparing > 30 min, or ready > 20 min
    if (order.status === "pending" && minutesAgo > 15) return true
    if (order.status === "preparing" && minutesAgo > 30) return true
    if (order.status === "ready" && minutesAgo > 20) return true
    
    // Not urgent (green): everything else
    return false
  }

  const getUrgencyColor = (order: OrderData) => {
    // Calculate urgency based on order age and status
    const createdAt = new Date(order.createdAt)
    const now = new Date()
    const minutesAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60)

    // Highly urgent (red): pending > 30 min, preparing > 45 min, or cancelled
    if (order.status === "cancelled") return "bg-red-500"
    if (order.status === "pending" && minutesAgo > 30) return "bg-red-500"
    if (order.status === "preparing" && minutesAgo > 45) return "bg-red-500"
    
    // Urgent (yellow): pending > 15 min, preparing > 30 min, or ready > 20 min
    if (order.status === "pending" && minutesAgo > 15) return "bg-yellow-500"
    if (order.status === "preparing" && minutesAgo > 30) return "bg-yellow-500"
    if (order.status === "ready" && minutesAgo > 20) return "bg-yellow-500"
    
    // Not urgent (green): everything else
    return "bg-green-500"
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "text-green-600"
      case "Pending":
        return "text-yellow-600"
      case "Failed":
      case "Refunded":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
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

  const InsightsContent = ({ className }: { className?: string }) => (
    <div
      className={cn(
        "space-y-4",
        className,
      )}
    >
      {/* Quick Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start bg-transparent" size="sm">
            <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
            Needs Attention
          </Button>
          <Button variant="outline" className="w-full justify-start bg-transparent" size="sm">
            <Flame className="h-4 w-4 mr-2 text-orange-500" />
            Rush Orders
          </Button>
          <Button variant="outline" className="w-full justify-start bg-transparent" size="sm">
            <Wallet className="h-4 w-4 mr-2 text-yellow-500" />
            Unpaid
          </Button>
          <Button variant="outline" className="w-full justify-start bg-transparent" size="sm">
            <ClipboardList className="h-4 w-4 mr-2 text-blue-500" />
            My Orders
          </Button>
        </CardContent>
      </Card>

      {/* Performance Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Avg Prep Time</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold">18 min</span>
                <TrendingUp className="h-3 w-3 text-red-500" />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Avg Order Value</span>
              <span className="font-semibold">$42.50</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Orders per Hour</span>
              <span className="font-semibold">7.2</span>
            </div>
          </div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockOrdersPerformance}>
                <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
              onClick={() => setSelectedStaff(staff.name)}
              className={`flex items-center justify-between border rounded-lg p-2 cursor-pointer transition-all hover:bg-muted/50 ${
                selectedStaff === staff.name ? "ring-2 ring-primary bg-muted/30" : ""
              }`}
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

      {/* Table Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Table Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Occupied</span>
              <span className="font-semibold">12 / 20</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-6 rounded ${i < 12 ? "bg-red-500" : i < 17 ? "bg-green-500" : "bg-yellow-500"}`}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockRecentOrderActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
              <div className="flex-1 space-y-1">
                <p className="text-sm">{activity.message}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )

  const isMobileCardView = windowWidth < 480

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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightSidebarOpen((prev) => !prev)}
                  className="lg:hidden"
                >
                  <ChevronDown
                    className={cn("h-5 w-5 transition-transform", rightSidebarOpen ? "rotate-180" : "")}
                  />
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
                <Button variant="outline" size="sm" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
              activeFilter
                ? "bg-blue-500 text-white border-blue-500 dark:bg-blue-500 dark:text-white dark:border-blue-500"
                : "hover:bg-blue-100 dark:hover:bg-blue-900",
            )}
            onClick={() => {
              setActiveFilter(!activeFilter)
              // Remove preparing from individual filters when toggling active
              if (!activeFilter) {
                setStatusFilter(statusFilter.filter(s => s !== "preparing"))
              }
            }}
          >
            {stats.active} Active
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
              statusFilter.includes("pending")
                ? "bg-gray-300 text-gray-900 border-gray-400 dark:bg-gray-600 dark:text-white dark:border-gray-600"
                : "hover:bg-gray-200 dark:hover:bg-gray-700",
            )}
            onClick={() => toggleStatusFilter("pending")}
          >
            {stats.pending} Pending
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
              statusFilter.includes("ready")
                ? "bg-green-500 text-white border-green-500 dark:bg-green-500 dark:text-white dark:border-green-500"
                : "hover:bg-green-100 dark:hover:bg-green-900",
            )}
            onClick={() => toggleStatusFilter("ready")}
          >
            {stats.ready} Ready
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
              statusFilter.includes("completed")
                ? "bg-slate-500 text-white border-slate-500 dark:bg-slate-500 dark:text-white dark:border-slate-500"
                : "hover:bg-slate-200 dark:hover:bg-slate-700",
            )}
            onClick={() => toggleStatusFilter("completed")}
          >
            {stats.completed} Completed Today
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              "cursor-pointer px-3 py-1 lg:px-2.5 lg:py-0.5 text-sm rounded-full",
              statusFilter.includes("cancelled")
                ? "bg-red-600 text-white border-red-600 dark:bg-red-600 dark:text-white dark:border-red-600"
                : "hover:bg-red-100 dark:hover:bg-red-900",
            )}
            onClick={() => toggleStatusFilter("cancelled")}
          >
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
        <div ref={controlsContainerRef} className="flex flex-wrap items-center gap-2 w-full">
          {/* Search bar - full width on mobile, flexible on desktop */}
          <div className="relative w-full md:min-w-[120px] md:max-w-[240px] md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
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

          {/* Status dropdown - flexible on mobile, fixed on desktop */}
            <Select 
              value={statusFilter.length === 0 ? "all" : statusFilter[0]} 
              onValueChange={(value) => {
                if (value === "all") {
                  setStatusFilter([])
                } else {
                  setStatusFilter([value])
                }
              }}
            >
              <SelectTrigger className="flex-1 md:w-[120px] md:flex-none shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

          {/* Staff dropdown - flexible on mobile, fixed on desktop */}
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="flex-1 md:w-[120px] md:flex-none shrink-0">
              <SelectValue placeholder="Staff" />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="all">All Staff</SelectItem>
              <SelectItem value="me">You (My Orders)</SelectItem>
              <SelectItem value="John Smith">John Smith</SelectItem>
              <SelectItem value="Maria Garcia">Maria Garcia</SelectItem>
              <SelectItem value="David Lee">David Lee</SelectItem>
            </SelectContent>
          </Select>

          {/* Needs Attention - adapts based on container width */}
          <Button
            variant={needsAttention ? "secondary" : "outline"}
            size="sm"
            onClick={() => setNeedsAttention(!needsAttention)}
            className={cn(
              "shrink-0 overflow-hidden",
              "transition-all duration-300 ease-in-out",
              showButtonText ? "min-w-[140px] px-3 justify-start" : "w-9 h-9 px-0 justify-center",
              needsAttention &&
                "bg-yellow-100 text-yellow-700 border-yellow-400 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-600 dark:hover:bg-yellow-900/40",
            )}
          >
            <div className="flex items-center justify-center gap-0">
              <AlertTriangle
                className={cn(
                  "h-4 w-4 shrink-0 transition-all duration-300 ease-in-out",
                  showButtonText && "mr-2",
                  needsAttention && "text-yellow-600 dark:text-yellow-400",
                )}
              />
              <span
                className={cn(
                  "whitespace-nowrap overflow-hidden",
                  "transition-all duration-300 ease-in-out",
                  showButtonText ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0",
                )}
              >
                Needs Attention
              </span>
            </div>
          </Button>

          {/* Compact toggle */}
          {viewMode === "table" && (
            <div className="flex max-sm:hidden items-center gap-2 px-3 py-1.5 h-12 lg:h-9 border rounded-md shrink-0">
              <Switch id="compact-view" checked={isCompact} onCheckedChange={setIsCompact} />
              <Label htmlFor="compact-view" className="text-sm cursor-pointer">
                Compact
              </Label>
            </div>
          )}

          {/* View mode toggle */}
          <div className="flex max-sm:hidden items-center gap-1 border rounded-md shrink-0">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => handleViewModeChange("table")}
              className="h-9 w-9"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => handleViewModeChange("card")}
              className="h-9 w-9"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

        {/* Main Content - Only table/card view */}
        <div className="min-w-0" ref={mainColumnRef}>
          {/* Orders View */}
          {isLoading ? (
            <SkeletonBlock rows={8} />
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery ? "Try adjusting your search" : "Create your first order to get started"}
                </p>
                <Button onClick={() => setNewOrderModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Order
                </Button>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Error loading orders</h3>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : !locationId ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No location selected</h3>
                <p className="text-sm text-muted-foreground">
                  Please select a location to view orders
                </p>
              </CardContent>
            </Card>
          ) : (
            <div>
              {viewMode === "table" ? (
                isMobileCardView ? (
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {filteredOrders.slice(0, 10).map((order) => (
                        <motion.div
                          key={order.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => handleOrderClick(order)}
                          className="rounded-xl border p-3 shadow-sm bg-card text-sm flex flex-col gap-2 cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"
                        >
                          <div className="flex justify-between items-start font-medium">
                            <div className="flex items-center gap-2">
                              <div className={`w-1 h-8 rounded-full shrink-0 ${getUrgencyColor(order)}`} />
                              <span className="font-semibold">#{order.orderNumber}</span>
                            </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={order.status} />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full hover:bg-muted transition-colors h-8 w-8"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  side="top"
                                  className="min-w-[180px] sm:min-w-[200px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DropdownMenuItem>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Order
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print Receipt
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel Order
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-base">
                              {order.table 
                                ? `Table ${order.table.tableNumber}` 
                                : order.orderType === "pickup" 
                                  ? "Pickup" 
                                  : order.orderType === "delivery" 
                                    ? "Delivery" 
                                    : "No table"}
                            </span>
                            <span className="font-bold text-base">${order.total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>{order.customer?.name || "Guest"}</span>
                            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Card className="overflow-hidden">
                    <div className="w-full overflow-x-auto md:overflow-visible">
                      <Table
                        className={cn(
                          "w-full border-separate border-spacing-0 text-sm",
                          "[&_th]:py-4 [&_th]:align-middle",
                          "[&_td]:py-4 [&_td]:align-middle",
                          isCompact && "table-fixed",
                          windowWidth < 640 && "[&>tbody>tr>td]:py-1 [&>thead>tr>th]:py-1 text-xs",
                        )}
                      >
                        <colgroup>
                          {visibleColumns.map((_, i) => (
                            <col key={i} style={{ width: `${100 / visibleColumns.length}%` }} />
                          ))}
                        </colgroup>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="[&>th:first-child]:rounded-tl-lg [&>th:last-child]:rounded-tr-lg">
                            {visibleColumns.includes("orderNumber") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("orderNumber")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Order #
                                  {getSortIcon("orderNumber")}
                                </div>
                              </TableHead>
                            )}
                            {visibleColumns.includes("table") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("table")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Table
                                  {getSortIcon("table")}
                                </div>
                              </TableHead>
                            )}
                            {visibleColumns.includes("customer") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("customer")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Customer
                                  {getSortIcon("customer")}
                                </div>
                              </TableHead>
                            )}
                            {visibleColumns.includes("items") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("items")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Items
                                  {getSortIcon("items")}
                                </div>
                              </TableHead>
                            )}
                            {visibleColumns.includes("total") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("total")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Total
                                  {getSortIcon("total")}
                                </div>
                              </TableHead>
                            )}
                            {visibleColumns.includes("time") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("time")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Time
                                  {getSortIcon("time")}
                                </div>
                              </TableHead>
                            )}
                            {visibleColumns.includes("status") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("status")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Status
                                  {getSortIcon("status")}
                                </div>
                              </TableHead>
                            )}
                            {visibleColumns.includes("staff") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("staff")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Staff
                                  {getSortIcon("staff")}
                                </div>
                              </TableHead>
                            )}
                            {visibleColumns.includes("actions") && (
                              <TableHead className="text-center align-middle">Actions</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOrders.slice(0, 10).map((order) => (
                            <TableRow
                              key={order.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleOrderClick(order)}
                            >
                              {visibleColumns.includes("orderNumber") && (
                                <TableCell className="font-medium align-middle">
                                  <div className="flex items-center gap-2 justify-center">
                                    <div className={`w-1 h-8 rounded-full shrink-0 ${getUrgencyColor(order)}`} />
                                    <span className="whitespace-normal break-words">{order.orderNumber}</span>
                                    {order.notes && (
                                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" title={`Order Notes: ${order.notes}`} />
                                    )}
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.includes("table") && (
                                <TableCell className="whitespace-normal break-words align-middle text-center">
                                  {order.table 
                                    ? `Table ${order.table.tableNumber}` 
                                    : order.orderType === "pickup" 
                                      ? "Pickup" 
                                      : order.orderType === "delivery" 
                                        ? "Delivery" 
                                        : "-"}
                                </TableCell>
                              )}
                              {visibleColumns.includes("customer") && (
                                <TableCell className="whitespace-normal break-words align-middle text-center">
                                  {order.customer?.name || "Guest"}
                                </TableCell>
                              )}
                              {visibleColumns.includes("items") && (
                                <TableCell className="align-middle text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    {order.itemsCount}
                                    {order.hasItemNotes && (
                                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" title="One or more items have notes" />
                                    )}
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.includes("total") && (
                                <TableCell className="whitespace-normal break-words align-middle text-center">
                                  ${order.total.toFixed(2)}
                                </TableCell>
                              )}
                              {visibleColumns.includes("time") && (
                                <TableCell className="text-muted-foreground whitespace-normal break-words align-middle text-center">
                                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </TableCell>
                              )}
                              {visibleColumns.includes("status") && (
                                <TableCell className="align-middle text-center">
                                  <StatusBadge status={order.status} />
                                </TableCell>
                              )}
                              {visibleColumns.includes("staff") && (
                                <TableCell className="align-middle text-center">
                                  {order.assignedStaff ? (
                                    <div className="flex items-center gap-2 justify-center">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs">
                                          {order.assignedStaff.fullName
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-sm whitespace-normal break-words">
                                        {order.assignedStaff.fullName.split(" ")[0]}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              )}
                              {visibleColumns.includes("actions") && (
                                <TableCell className="text-center align-middle">
                                  <div className="flex justify-center">
                                    <div className="flex items-center gap-2">
                                      <CreditCard className={`h-4 w-4 ${getPaymentStatusColor(order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "partial" ? "Pending" : "Unpaid")}`} />
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-full hover:bg-muted transition-colors h-8 w-8"
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
                                          <DropdownMenuItem>
                                            <Eye className="mr-2 h-4 w-4" />
                                            View Details
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit Order
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Duplicate
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled>
                                            <Printer className="mr-2 h-4 w-4" />
                                            Print Receipt
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled>
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Cancel Order
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  {filteredOrders.slice(0, 6).map((order) => (
                    <Card
                      key={order.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleOrderClick(order)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-1 h-8 rounded-full shrink-0 ${getUrgencyColor(order)}`} />
                              <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                              {order.notes && (
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" title={`Order Notes: ${order.notes}`} />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>
                                {order.table 
                                  ? `Table ${order.table.tableNumber}` 
                                  : order.orderType === "pickup" 
                                    ? "Pickup" 
                                    : order.orderType === "delivery" 
                                      ? "Delivery" 
                                      : "No table"}
                              </span>
                              <span>•</span>
                              <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={order.status} />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-full hover:bg-muted transition-colors h-8 w-8"
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
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Order
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  <Printer className="mr-2 h-4 w-4" />
                                  Print Receipt
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{order.customer?.name || "Guest"}</span>
                          <span className="font-semibold">${order.total.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{order.itemsCount} items</span>
                            {order.hasItemNotes && (
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" title="One or more items have notes" />
                            )}
                          </div>
                          {order.assignedStaff && (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {order.assignedStaff.fullName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span>{order.assignedStaff.fullName.split(" ")[0]}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
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

      {/* Order Details Drawer */}
      {selectedOrder && (
        <Drawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false)
            setSelectedOrderId(null)
            setSelectedOrder(null)
          }}
          title={selectedOrder.orderNumber}
          subtitle={`Placed: ${new Date(selectedOrder.createdAt).toLocaleString()}`}
        >
          <div className="space-y-6 px-4">
            <Select value={selectedOrder.status} disabled>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Connected Records */}
            <ConnectedRecords
              order={{ id: selectedOrder.id, total: selectedOrder.total }}
              table={selectedOrder.table ? { id: selectedOrder.table.id, label: `Table ${selectedOrder.table.tableNumber}` } : undefined}
              reservation={
                selectedOrder.reservation
                  ? { id: selectedOrder.reservation.id, name: selectedOrder.customer?.name || "Guest", time: selectedOrder.reservation.reservationTime }
                  : undefined
              }
              sessionId={sessionId}
            />

            {/* Order Info */}
            <div className="space-y-3">
              <h3 className="font-semibold">Order Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Table</p>
                  <p className="font-medium">{selectedOrder.table ? `Table ${selectedOrder.table.tableNumber}` : "No table"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.customer?.name || "Guest"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Order Type</p>
                  <p className="font-medium">{selectedOrder.orderType.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned Staff</p>
                  <p className="font-medium">{selectedOrder.assignedStaff?.fullName || "Not assigned"}</p>
                </div>
              </div>
              {selectedOrder.notes && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Order Notes
                  </p>
                  <p className="text-sm mt-1">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Items</h3>
                <Button variant="ghost" size="sm" disabled>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between p-3 border rounded-md">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.itemName}</span>
                        <span className="text-muted-foreground">x{item.quantity}</span>
                      </div>
                      {item.customizations.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.customizations.map((c, i) => (
                            <span key={i}>
                              {c.groupName}: {c.optionName} {c.quantity > 1 && `(x${c.quantity})`}
                              {i < item.customizations.length - 1 && ", "}
                            </span>
                          ))}
                        </p>
                      )}
                      {item.notes && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                          <p className="text-xs font-medium flex items-center gap-1 text-blue-700 dark:text-blue-400">
                            <FileText className="h-3 w-3" />
                            Item Note
                          </p>
                          <p className="text-sm mt-1">{item.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${item.lineTotal.toFixed(2)}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${selectedOrder.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>${selectedOrder.taxAmount.toFixed(2)}</span>
              </div>
              {selectedOrder.serviceCharge > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span>${selectedOrder.serviceCharge.toFixed(2)}</span>
                </div>
              )}
              {selectedOrder.tipAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tip</span>
                  <span>${selectedOrder.tipAmount.toFixed(2)}</span>
                </div>
              )}
              {selectedOrder.discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-${selectedOrder.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span>${selectedOrder.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-3">
              <h3 className="font-semibold">Payment</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className={`font-medium ${getPaymentStatusColor(selectedOrder.paymentStatus === "paid" ? "Paid" : selectedOrder.paymentStatus === "partial" ? "Pending" : "Unpaid")}`}>
                    {selectedOrder.paymentStatus.charAt(0).toUpperCase() + selectedOrder.paymentStatus.slice(1)}
                  </p>
                </div>
                {selectedOrder.payments.length > 0 && (
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium">{selectedOrder.payments[0].method}</p>
                  </div>
                )}
              </div>
              {selectedOrder.payments.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Payments</p>
                  <div className="space-y-2">
                    {selectedOrder.payments.map((payment) => (
                      <div key={payment.id} className="p-2 border rounded text-sm">
                        <div className="flex justify-between">
                          <span>${payment.amount.toFixed(2)}</span>
                          <span className="text-muted-foreground">{payment.method}</span>
                        </div>
                        {payment.paidAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Paid: {new Date(payment.paidAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleMarkPaid(selectedOrder)}>
                  Mark Paid
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Refund
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Split
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Send Invoice
                </Button>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <h3 className="font-semibold">Timeline</h3>
              <div className="space-y-3">
                {selectedOrder.timeline.map((event, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {event.changedBy
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Status changed to: {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{event.changedBy}</span>
                        <span>•</span>
                        <span>{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                      {event.note && (
                        <p className="text-xs text-muted-foreground mt-1">{event.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex gap-2">
                <Button className="flex-1" disabled>
                  Mark as Ready
                </Button>
                <Button variant="outline" disabled>
                  <Printer className="h-4 w-4" />
                </Button>
                <Button variant="outline" disabled>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 bg-transparent" disabled>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 bg-transparent" disabled>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
                <Button variant="outline" size="sm" className="flex-1 bg-transparent" disabled>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* New Order Modal */}
      <Dialog open={newOrderModalOpen} onOpenChange={setNewOrderModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
            <DialogDescription>Create a new order for a table</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Table</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Table 1</SelectItem>
                    <SelectItem value="2">Table 2</SelectItem>
                    <SelectItem value="3">Table 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Order Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine-in">Dine-in</SelectItem>
                    <SelectItem value="takeout">Takeout</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input placeholder="Enter customer name" />
            </div>
            <div className="space-y-2">
              <Label>Menu Items</Label>
              <div className="border rounded-md p-4 space-y-2">
                <Input placeholder="Search menu items..." />
                <p className="text-sm text-muted-foreground">Select items to add to order</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Special Instructions</Label>
              <Input placeholder="Any special requests or notes..." />
            </div>
            <div className="space-y-2">
              <Label>Assigned Staff</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="You" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="you">You</SelectItem>
                  <SelectItem value="john">John Smith</SelectItem>
                  <SelectItem value="maria">Maria Garcia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" disabled>
              Save as Draft
            </Button>
            <Button disabled>Save & Send to Kitchen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function OrdersPage() {
  return (
    <StaffFilterProvider>
      <OrdersPageContent />
    </StaffFilterProvider>
  )
}
