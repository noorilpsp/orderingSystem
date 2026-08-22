"use client"

import * as React from "react"
import {
  Search,
  Download,
  X,
  Plus,
  AlertCircle,
  ClipboardList,
  LayoutGrid,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarIcon,
} from "lucide-react"
import { format } from "date-fns"
import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion, AnimatePresence } from "framer-motion"

import { useToast } from "@/hooks/use-toast"
import { StaffFilterProvider, useStaffFilter } from "./context/StaffFilterContext"
import { cn } from "@/lib/utils"
import { useLocation } from "@/lib/contexts/LocationContext"
import { formatCounterOrderLabel } from "@/lib/orders/formatCounterOrderLabel"
import type { OrderModes } from "@/lib/db/schema/merchant-locations"

const fullColumns = ["orderNumber", "table", "customer", "items", "total", "time", "status", "staff", "date"]
const compactDesktopColumns = ["orderNumber", "table", "total", "time", "status", "date"]
const compactMobileColumns = ["orderNumber", "table", "total", "status"]

function getPayloadErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback
  const err = (payload as { error?: unknown }).error
  if (typeof err === "string" && err.trim()) return err
  if (!err || typeof err !== "object" || !("message" in err)) return fallback
  const msg = (err as { message?: unknown }).message
  return typeof msg === "string" && msg.trim() ? msg : fallback
}

function unwrapOrdersList(payload: unknown): OrderData[] {
  if (!payload || typeof payload !== "object") return []
  const record = payload as Record<string, unknown>
  const data =
    record.ok === true && record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record
  return Array.isArray(data.orders) ? (data.orders as OrderData[]) : []
}

function unwrapOrderDetail(payload: unknown): DetailedOrderData | null {
  if (!payload || typeof payload !== "object") return null
  const record = payload as Record<string, unknown>
  const data =
    record.ok === true && record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record
  if (!data.order || typeof data.order !== "object") return null
  return data.order as DetailedOrderData
}

function formatOrderNumberLabel(order: {
  id: string
  orderNumber: string | number | null | undefined
  orderType: string
}): string {
  return formatCounterOrderLabel({
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    orderId: order.id,
  })
}

/** Unified board status - aligned with /orders ops labels. */
type DisplayStatus = "new" | "preparing" | "ready" | "completed" | "voided" | "refunded"

const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  voided: "Voided",
  refunded: "Refunded",
}

function getOrderDisplayStatus(order: {
  status: string
  paymentStatus?: string | null
}): DisplayStatus {
  if (order.paymentStatus === "refunded") return "refunded"
  switch (order.status) {
    case "cancelled":
      return "voided"
    case "completed":
      return "completed"
    case "ready":
      return "ready"
    case "preparing":
      return "preparing"
    case "pending":
    case "confirmed":
    default:
      return "new"
  }
}

function getOrderDisplayType(order: {
  orderType: string
  table?: { id: string; tableNumber: string } | null
}): "pickup" | "delivery" | "dine_in" {
  if (order.orderType === "pickup") return "pickup"
  if (order.orderType === "delivery") return "delivery"
  return "dine_in"
}

type OrderDisplayType = "dine_in" | "pickup" | "delivery"

/** Matches store-settings defaults in /dashboard/stores. */
function getEnabledOrderTypes(orderModes: OrderModes | null | undefined): OrderDisplayType[] {
  const enabled: OrderDisplayType[] = []
  if (orderModes?.dine_in?.enabled ?? true) enabled.push("dine_in")
  if (orderModes?.pickup?.enabled ?? true) enabled.push("pickup")
  if (orderModes?.delivery?.enabled ?? false) enabled.push("delivery")
  return enabled
}

function matchesTypeFilter(
  order: { orderType: string; table?: { id: string; tableNumber: string } | null },
  typeFilter: string | "all",
) {
  if (typeFilter === "all") return true
  return getOrderDisplayType(order) === typeFilter
}

function matchesStatusFilter(
  order: { status: string; paymentStatus?: string | null },
  filters: string[],
) {
  return filters.includes(getOrderDisplayStatus(order))
}

function OrderStatusBadge({
  order,
  className,
}: {
  order: { status: string; paymentStatus?: string | null }
  className?: string
}) {
  const key = getOrderDisplayStatus(order)
  return <StatusBadge status={key} label={DISPLAY_STATUS_LABEL[key]} className={className} />
}

function isFinishedDisplayStatus(status: DisplayStatus) {
  return status === "completed" || status === "voided" || status === "refunded"
}

function getOrderDurationMs(
  order: {
    status: string
    paymentStatus?: string | null
    createdAt: string
    updatedAt?: string | null
    completedAt?: string | null
    cancelledAt?: string | null
  },
  nowMs: number,
): number {
  const startMs = new Date(order.createdAt).getTime()
  if (!Number.isFinite(startMs)) return 0

  const display = getOrderDisplayStatus(order)
  if (isFinishedDisplayStatus(display)) {
    const endCandidate =
      order.completedAt ??
      order.cancelledAt ??
      order.updatedAt ??
      order.createdAt
    const endMs = new Date(endCandidate).getTime()
    if (!Number.isFinite(endMs)) return 0
    return Math.max(0, endMs - startMs)
  }

  return Math.max(0, nowMs - startMs)
}

function formatDurationMs(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return "<1m"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function matchesDateFilter(order: { createdAt: string }, dateRange: DateRange | undefined): boolean {
  if (!dateRange?.from) return true
  const createdMs = new Date(order.createdAt).getTime()
  if (!Number.isFinite(createdMs)) return false
  const startMs = startOfLocalDay(dateRange.from).getTime()
  const endMs = endOfLocalDay(dateRange.to ?? dateRange.from).getTime()
  return createdMs >= startMs && createdMs <= endMs
}

function formatDateRangeLabel(dateRange: DateRange | undefined): string {
  if (!dateRange?.from) return "Date"
  if (!dateRange.to || dateRange.to.getTime() === dateRange.from.getTime()) {
    return format(dateRange.from, "MMM d, yyyy")
  }
  if (dateRange.from.getFullYear() === dateRange.to.getFullYear()) {
    return `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
  }
  return `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`
}

function formatOrderPlacedDate(createdAt: string): string {
  const date = new Date(createdAt)
  if (!Number.isFinite(date.getTime())) return "-"
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function getOrderTypeLabel(order: {
  orderType: string
  table?: { tableNumber: string } | null
}): string {
  if (order.table?.tableNumber) return `Table ${order.table.tableNumber}`
  if (order.orderType === "pickup") return "Pickup"
  if (order.orderType === "delivery") return "Delivery"
  if (order.orderType === "dine_in") return "Dine-in"
  return order.orderType.replace(/_/g, " ")
}

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
  updatedAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
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
  const { toast } = useToast()
  const { formatMoney } = useMerchantLocalization()
  const { currentLocationId, loading: locationLoading, getCurrentLocation } = useLocation()
  const locationId = currentLocationId
  const currentLocation = getCurrentLocation()
  const enabledOrderTypes = React.useMemo(
    () => getEnabledOrderTypes(currentLocation?.orderModes),
    [currentLocation?.orderModes],
  )
  const showTypeFilters = enabledOrderTypes.length > 1
  const [orders, setOrders] = React.useState<OrderData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [locationStaff, setLocationStaff] = React.useState<Array<{ id: string; fullName: string }>>([])
  const [viewMode, setViewMode] = React.useState<"table" | "card">("table")
  const [statusFilter, setStatusFilter] = React.useState<string[]>([])
  const [typeFilter, setTypeFilter] = React.useState<"all" | OrderDisplayType>("all")
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined)
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 25
  const [nowMs, setNowMs] = React.useState(() => Date.now())

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const [windowWidth, setWindowWidth] = React.useState(typeof window !== "undefined" ? window.innerWidth : 1024)

  const [containerWidth, setContainerWidth] = React.useState(0)
  const controlsContainerRef = React.useRef<HTMLDivElement>(null)

  // Fetch orders for the current dashboard location
  React.useEffect(() => {
    if (locationLoading) return
    if (!locationId) {
      setOrders([])
      setLocationStaff([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function fetchOrders() {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams({ locationId: locationId! })

        const [ordersResponse, staffResponse] = await Promise.all([
          fetch(`/api/orders?${params.toString()}`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`/api/staff?${params.toString()}`, {
            credentials: "include",
            cache: "no-store",
          }),
        ])

        const ordersPayload = await ordersResponse.json().catch(() => ({}))
        if (!ordersResponse.ok || ordersPayload?.ok === false) {
          throw new Error(getPayloadErrorMessage(ordersPayload, "Failed to fetch orders"))
        }

        const staffPayload = await staffResponse.json().catch(() => ({}))
        const staffList: Array<{ id: string; fullName: string }> =
          staffResponse.ok && staffPayload?.ok !== false
            ? Array.isArray(staffPayload?.data?.staff)
              ? staffPayload.data.staff
              : Array.isArray(staffPayload?.staff)
                ? staffPayload.staff
                : []
            : []

        if (!cancelled) {
          setOrders(unwrapOrdersList(ordersPayload))
          setLocationStaff(
            staffList
              .filter((row) => row?.id && row?.fullName)
              .map((row) => ({ id: row.id, fullName: row.fullName })),
          )
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

    void fetchOrders()

    return () => {
      cancelled = true
    }
  }, [locationId, locationLoading])

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

        const payload = await response.json().catch(() => ({}))
        if (!response.ok || payload?.ok === false) {
          throw new Error(getPayloadErrorMessage(payload, "Failed to fetch order details"))
        }

        const order = unwrapOrderDetail(payload)
        if (!cancelled) {
          setSelectedOrder(order)
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

    void fetchOrderDetails()

    return () => {
      cancelled = true
    }
  }, [selectedOrderId, locationId])
  const [newOrderModalOpen, setNewOrderModalOpen] = React.useState(false)

  const { selectedStaff, setSelectedStaff } = useStaffFilter()

  React.useEffect(() => {
    localStorage.setItem("berrytap.orders.compact", JSON.stringify(isCompact))
  }, [isCompact])

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

  const filteredOrders = React.useMemo(() => {
    let filtered = orders.filter((order) => {
      if (!matchesTypeFilter(order, typeFilter)) {
        return false
      }

      if (statusFilter.length > 0 && !matchesStatusFilter(order, statusFilter)) {
        return false
      }

      if (!matchesDateFilter(order, dateRange)) {
        return false
      }

      // Staff filter (by accepter / assignee id)
      if (selectedStaff !== "all") {
        if (order.assignedStaff?.id !== selectedStaff) return false
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
          case "date":
            aValue = new Date(a.createdAt).getTime()
            bValue = new Date(b.createdAt).getTime()
            break
          case "time":
            aValue = getOrderDurationMs(a, nowMs)
            bValue = getOrderDurationMs(b, nowMs)
            break
          case "status":
            aValue = getOrderDisplayStatus(a)
            bValue = getOrderDisplayStatus(b)
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
  }, [orders, selectedStaff, searchQuery, sortColumn, sortDirection, statusFilter, typeFilter, dateRange, nowMs])

  const staffFilterOptions = React.useMemo(() => {
    const byId = new Map<string, string>()
    for (const row of locationStaff) {
      byId.set(row.id, row.fullName)
    }
    // Include people who appear on orders (e.g. owner/admin acceptors not in Staff roster).
    for (const order of orders) {
      if (order.assignedStaff?.id && order.assignedStaff.fullName) {
        byId.set(order.assignedStaff.id, order.assignedStaff.fullName)
      }
    }
    return [...byId.entries()]
      .map(([id, fullName]) => ({ id, fullName }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [locationStaff, orders])

  React.useEffect(() => {
    if (
      selectedStaff !== "all" &&
      !staffFilterOptions.some((option) => option.id === selectedStaff)
    ) {
      setSelectedStaff("all")
    }
  }, [selectedStaff, setSelectedStaff, staffFilterOptions])

  const handleExportOrders = () => {
    if (filteredOrders.length === 0) {
      toast({
        title: "Nothing to export",
        description: "There are no orders in the current view.",
      })
      return
    }

    const now = Date.now()
    const headers = [
      "Order",
      "Type",
      "Customer",
      "Items",
      "Total",
      "Duration",
      "Status",
      "Staff",
      "Date",
      "Payment",
      "Placed At",
      "Notes",
    ]

    const rows = filteredOrders.map((order) => {
      const displayStatus = getOrderDisplayStatus(order)
      return [
        formatOrderNumberLabel(order),
        getOrderTypeLabel(order),
        order.customer?.name || "Guest",
        order.itemsCount,
        order.total.toFixed(2),
        formatDurationMs(getOrderDurationMs(order, now)),
        DISPLAY_STATUS_LABEL[displayStatus],
        order.assignedStaff?.fullName || "",
        formatOrderPlacedDate(order.createdAt),
        order.paymentStatus,
        new Date(order.createdAt).toISOString(),
        order.notes || "",
      ]
        .map(escapeCsvCell)
        .join(",")
    })

    const csv = [headers.map(escapeCsvCell).join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 10)
    anchor.href = url
    anchor.download = `orders-export-${stamp}.csv`
    anchor.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Export ready",
      description: `Downloaded ${filteredOrders.length} order${filteredOrders.length === 1 ? "" : "s"} as CSV.`,
    })
  }

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, typeFilter, dateRange, selectedStaff, sortColumn, sortDirection, locationId])

  React.useEffect(() => {
    if (typeFilter !== "all" && !enabledOrderTypes.includes(typeFilter)) {
      setTypeFilter("all")
    }
  }, [enabledOrderTypes, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage))

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedOrders = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredOrders.slice(start, start + itemsPerPage)
  }, [filteredOrders, currentPage, itemsPerPage])

  const pageStartIndex = filteredOrders.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const pageEndIndex = Math.min(currentPage * itemsPerPage, filteredOrders.length)

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

  const getUrgencyColor = (order: OrderData) => {
    const createdAt = new Date(order.createdAt)
    const now = new Date()
    const minutesAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60)
    const display = getOrderDisplayStatus(order)

    if (display === "voided" || display === "refunded") return "bg-red-500"
    if (display === "new" && minutesAgo > 30) return "bg-red-500"
    if (display === "preparing" && minutesAgo > 45) return "bg-red-500"

    if (display === "new" && minutesAgo > 15) return "bg-yellow-500"
    if (display === "preparing" && minutesAgo > 30) return "bg-yellow-500"
    if (display === "ready" && minutesAgo > 20) return "bg-yellow-500"

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

  const isMobileCardView = windowWidth < 480

  return (
    <div className="relative h-full">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 md:px-6 md:py-6">
        <section className="flex flex-col gap-6 min-w-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportOrders}
                  disabled={isLoading || locationLoading || filteredOrders.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

        {/* Controls */}
        <div ref={controlsContainerRef} className="flex flex-wrap items-center gap-2 w-full">
          {/* Search + date share one row on mobile; unwrap into the main flex on md+ */}
          <div className="flex w-full items-center gap-2 md:contents">
            <div className="relative min-w-0 flex-1 md:min-w-[120px] md:max-w-[240px]">
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

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-12 w-[9.5rem] shrink-0 justify-start px-3 text-left font-normal md:h-9 md:w-[220px]",
                    !dateRange?.from && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{formatDateRangeLabel(dateRange)}</span>
                  {dateRange?.from ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Clear date filter"
                      className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setDateRange(undefined)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          setDateRange(undefined)
                        }
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                  </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={windowWidth >= 768 ? 2 : 1}
                  defaultMonth={dateRange?.from}
                />
                <div className="flex items-center justify-between gap-2 border-t p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!dateRange?.from}
                    onClick={() => setDateRange(undefined)}
                  >
                    Clear
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {dateRange?.from
                      ? formatDateRangeLabel(dateRange)
                      : "All dates"}
                  </p>
            </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Type dropdown - only when store has multiple order modes */}
          {showTypeFilters ? (
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                if (value === "all" || value === "pickup" || value === "delivery" || value === "dine_in") {
                  setTypeFilter(value)
                }
              }}
            >
              <SelectTrigger className="flex-1 md:w-[120px] md:flex-none shrink-0">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All Types</SelectItem>
                {enabledOrderTypes.includes("dine_in") ? (
                  <SelectItem value="dine_in">Dine-in</SelectItem>
                ) : null}
                {enabledOrderTypes.includes("pickup") ? (
                  <SelectItem value="pickup">Pickup</SelectItem>
                ) : null}
                {enabledOrderTypes.includes("delivery") ? (
                  <SelectItem value="delivery">Delivery</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          ) : null}

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
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>

          {/* Staff dropdown - flexible on mobile, fixed on desktop */}
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="flex-1 md:w-[140px] md:flex-none shrink-0">
              <SelectValue placeholder="Staff" />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="all">All Staff</SelectItem>
              {staffFilterOptions.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
        <div className="min-w-0">
          {/* Orders View */}
          {isLoading || locationLoading ? (
            <SkeletonBlock rows={8} />
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
          ) : (
            <div>
              {viewMode === "table" ? (
                isMobileCardView ? (
            <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {paginatedOrders.map((order) => (
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
                              <span className="font-semibold">#{formatOrderNumberLabel(order)}</span>
                            </div>
                          <div className="flex items-center gap-2">
                            <OrderStatusBadge order={order} />
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
                            <span className="font-bold text-base">{formatMoney(order.total)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>{order.customer?.name || "Guest"}</span>
                            <span>
                              {formatOrderPlacedDate(order.createdAt)} ·{" "}
                              {formatDurationMs(getOrderDurationMs(order, nowMs))}
                      </span>
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
                                  Type
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
                                  Duration
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
                            {visibleColumns.includes("date") && (
                              <TableHead 
                                className="align-middle text-center cursor-pointer hover:bg-muted/70 transition-colors select-none"
                                onClick={() => handleSort("date")}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  Date
                                  {getSortIcon("date")}
                                </div>
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedOrders.map((order) => (
                            <TableRow
                              key={order.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleOrderClick(order)}
                            >
                              {visibleColumns.includes("orderNumber") && (
                                <TableCell className="font-medium align-middle">
                                  <div className="flex items-center gap-2 justify-center">
                                    <div className={`w-1 h-8 rounded-full shrink-0 ${getUrgencyColor(order)}`} />
                                    <span className="whitespace-normal break-words">{formatOrderNumberLabel(order)}</span>
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
                                  {formatMoney(order.total)}
                                </TableCell>
                              )}
                              {visibleColumns.includes("time") && (
                                <TableCell className="text-muted-foreground whitespace-normal break-words align-middle text-center">
                                  {formatDurationMs(getOrderDurationMs(order, nowMs))}
                                </TableCell>
                              )}
                              {visibleColumns.includes("status") && (
                                <TableCell className="align-middle text-center">
                                  <OrderStatusBadge order={order} />
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
                              {visibleColumns.includes("date") && (
                                <TableCell className="text-muted-foreground whitespace-normal break-words align-middle text-center">
                                  {formatOrderPlacedDate(order.createdAt)}
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
                  {paginatedOrders.map((order) => (
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
                              <CardTitle className="text-lg">{formatOrderNumberLabel(order)}</CardTitle>
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
                              <span>{formatOrderPlacedDate(order.createdAt)}</span>
                              <span>•</span>
                              <span>{formatDurationMs(getOrderDurationMs(order, nowMs))}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <OrderStatusBadge order={order} />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{order.customer?.name || "Guest"}</span>
                          <span className="font-semibold">{formatMoney(order.total)}</span>
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

              {filteredOrders.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {pageStartIndex}-{pageEndIndex} of {filteredOrders.length} orders
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                        let pageNum: number
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
                      {totalPages > 5 && currentPage < totalPages - 2 ? (
                        <>
                          <span className="px-1 text-sm text-muted-foreground">...</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-9"
                          >
                            {totalPages}
                          </Button>
                        </>
                    ) : null}
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
                    ) : null}
                  </div>
          )}
        </div>
        </section>
                </div>

      {/* Order Details Drawer */}
      {selectedOrder && (
        <Drawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false)
            setSelectedOrderId(null)
            setSelectedOrder(null)
          }}
          title={formatOrderNumberLabel(selectedOrder)}
          subtitle={`Placed: ${new Date(selectedOrder.createdAt).toLocaleString()}`}
        >
          <div className="space-y-6 px-4">
            <OrderStatusBadge order={selectedOrder} />

            {/* Order Info */}
            <div className="space-y-3">
              <h3 className="font-semibold">Order Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedOrder.orderType === "dine_in" ? (
                  <div>
                    <p className="text-muted-foreground">Table</p>
                    <p className="font-medium">
                      {selectedOrder.table
                        ? `Table ${selectedOrder.table.tableNumber}`
                        : "No table"}
                            </p>
                          </div>
                ) : null}
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.customer?.name || "Guest"}</p>
                      </div>
                <div>
                  <p className="text-muted-foreground">Order Type</p>
                  <p className="font-medium capitalize">{selectedOrder.orderType.replace("_", " ")}</p>
                        </div>
                <div>
                  <p className="text-muted-foreground">Staff</p>
                  <p className="font-medium">{selectedOrder.assignedStaff?.fullName || "-"}</p>
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
                      <span className="font-medium">{formatMoney(item.lineTotal)}</span>
                    </div>
                        </div>
                      ))}
                    </div>
            </div>

            {/* Pricing */}
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatMoney(selectedOrder.taxAmount)}</span>
              </div>
              {selectedOrder.serviceCharge > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span>{formatMoney(selectedOrder.serviceCharge)}</span>
                </div>
              )}
              {selectedOrder.tipAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tip</span>
                  <span>{formatMoney(selectedOrder.tipAmount)}</span>
                </div>
              )}
              {selectedOrder.discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatMoney(selectedOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span>{formatMoney(selectedOrder.total)}</span>
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
                          <span>{formatMoney(payment.amount)}</span>
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
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <h3 className="font-semibold">Timeline</h3>
              <div className="space-y-3">
                {selectedOrder.timeline.map((event, index) => {
                  const displayStatus = getOrderDisplayStatus({ status: event.status })
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {event.changedBy
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-muted-foreground">Status changed to</span>
                          <StatusBadge
                            status={displayStatus}
                            label={DISPLAY_STATUS_LABEL[displayStatus]}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{event.changedBy}</span>
                          <span>•</span>
                          <span>{new Date(event.createdAt).toLocaleString()}</span>
                        </div>
                        {event.note ? (
                          <p className="text-xs text-muted-foreground">{event.note}</p>
            ) : null}
      </div>
                    </div>
                  )
                })}
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
