"use client"

import { Progress } from "@/components/ui/progress"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  ChevronLeft,
  HelpCircle,
  Plus,
  Hand,
  Square,
  Circle,
  Users,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  RotateCw,
  Maximize2,
  Package,
  Eye,
  EyeOff,
  Edit,
  MoreVertical,
  Link,
  Unlink,
  Search,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
  Check,
  X,
  MapPin,
  Filter,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  MousePointerIcon,
  Loader2,
  History,
  Star,
  GitCompare,
  Lock,
  Shield,
  Bell,
  Settings,
  FileText,
  Clock,
} from "lucide-react"
import NextLink from "next/link"

type UserRole = "owner" | "manager" | "staff" | "viewer"

type Permission = {
  canViewPublished: boolean
  canViewDrafts: boolean
  canEditDrafts: boolean
  canPublish: boolean
  canDelete: boolean
  canRollback: boolean
  canManageUsers: boolean
  canViewLogs: boolean
  canChangeSettings: boolean
  canExport: boolean
  canImport: boolean
  rollbackDaysLimit?: number
}

type User = {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}

type ApprovalRequest = {
  id: string
  requestedBy: User
  requestedAt: string
  approver: User | null
  status: "pending" | "approved" | "rejected" | "changes_requested"
  message: string
  priority: "normal" | "urgent"
  lockDraft: boolean
  changesSummary: {
    added: number
    modified: number
    deleted: number
  }
  feedback?: string
  reviewedAt?: string
  scheduledPublishAt?: string
}

type ActivityLog = {
  id: string
  timestamp: string
  user: User
  action: string
  details: string
  changes?: {
    before: any
    after: any
  }
  ipAddress?: string
}

type Notification = {
  id: string
  type: "approval_request" | "approval_response" | "publish" | "version_restored" | "permission_changed"
  title: string
  message: string
  timestamp: string
  read: boolean
  data?: any
}

// Helper function to get permissions based on role
const getRolePermissions = (role: UserRole): Permission => {
  switch (role) {
    case "owner":
      return {
        canViewPublished: true,
        canViewDrafts: true,
        canEditDrafts: true,
        canPublish: true,
        canDelete: true,
        canRollback: true,
        canManageUsers: true,
        canViewLogs: true,
        canChangeSettings: true,
        canExport: true,
        canImport: true,
      }
    case "manager":
      return {
        canViewPublished: true,
        canViewDrafts: true,
        canEditDrafts: true,
        canPublish: true,
        canDelete: true,
        canRollback: true,
        canManageUsers: false,
        canViewLogs: true,
        canChangeSettings: false,
        canExport: true,
        canImport: true,
        rollbackDaysLimit: 7,
      }
    case "staff":
      return {
        canViewPublished: true,
        canViewDrafts: true,
        canEditDrafts: true,
        canPublish: false,
        canDelete: false,
        canRollback: false,
        canManageUsers: false,
        canViewLogs: false,
        canChangeSettings: false,
        canExport: false,
        canImport: false,
      }
    case "viewer":
      return {
        canViewPublished: true,
        canViewDrafts: false,
        canEditDrafts: false,
        canPublish: false,
        canDelete: false,
        canRollback: false,
        canManageUsers: false,
        canViewLogs: false,
        canChangeSettings: false,
        canExport: false,
        canImport: false,
      }
  }
}

type TableShape = "rectangle" | "circle" | "square"

type Table = {
  id: string
  name: string
  capacity: number
  shape: TableShape
  x: number
  y: number
  width: number
  height: number
  rotation: number
  sectionId?: string
  tags?: string[]
  changeStatus?: "unchanged" | "added" | "modified" | "deleted"
}

type Section = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string
  visible: boolean
  staff?: string
  description?: string
  order: number
  changeStatus?: "unchanged" | "added" | "modified" | "deleted"
}

type Combo = {
  id: string
  name: string
  tableIds: string[]
  totalCapacity: number
}

type Tool = "select" | "add-table" | "pan" | "section"

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null

type AlignmentGuide = {
  type: "vertical" | "horizontal"
  position: number
  tableIds: string[]
}

type Floor = {
  id: string
  name: string
  width: number
  height: number
}

type ViewMode = "canvas" | "list"
type SortColumn = "name" | "capacity" | "shape" | "section" | "position" | null
type SortDirection = "asc" | "desc"

type Version = {
  versionNumber: number
  publishedAt: string
  publishedBy: string
  notes: string
  tables: Table[]
  sections: Section[]
  changesSummary: { added: number; modified: number; deleted: number }
}

type ValidationError = {
  type: "overlap" | "out_of_bounds" | "duplicate"
  message: string
  items: string[]
}

type ComparisonMode = "side-by-side" | "overlay" | "list"

interface Action {
  id: string
  type: string
  description: string
  timestamp: Date
  undo: () => void
  redo: () => void
}

const GRID_SIZE = 32
const DEFAULT_CANVAS_WIDTH = 2000
const DEFAULT_CANVAS_HEIGHT = 1200
const MIN_TABLE_WIDTH = 60
const MIN_TABLE_HEIGHT = 40
const ROTATION_SNAP_ANGLE = 15

const TABLE_TEMPLATES = [
  { name: "2-Seat Rectangle", shape: "rectangle" as TableShape, width: 80, height: 60, capacity: 2 },
  { name: "4-Seat Rectangle", shape: "rectangle" as TableShape, width: 140, height: 90, capacity: 4 },
  { name: "6-Seat Rectangle", shape: "rectangle" as TableShape, width: 180, height: 90, capacity: 6 },
  { name: "2-Seat Round", shape: "circle" as TableShape, width: 80, height: 80, capacity: 2 },
  { name: "4-Seat Round", shape: "circle" as TableShape, width: 120, height: 120, capacity: 4 },
  { name: "4-Seat Square", shape: "square" as TableShape, width: 100, height: 100, capacity: 4 },
]

const SECTION_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Orange", value: "#F97316" },
  { name: "Green", value: "#10B981" },
  { name: "Red", value: "#EF4444" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Gray", value: "#6B7280" },
]

const STAFF_MEMBERS = ["Sarah Johnson", "Michael Chen", "Emma Wilson", "James Martinez", "Olivia Brown"]

const FLOORS = [
  { id: "main", name: "Main Floor" },
  { id: "patio", name: "Patio" },
  { id: "bar", name: "Bar Area" },
]

const COMMON_TAGS = ["vip", "window", "bar", "quiet", "outdoor", "accessible", "corner", "booth"]

function ChangeStatusBadge({ status }: { status?: "unchanged" | "added" | "modified" | "deleted" }) {
  if (!status || status === "unchanged") return null

  const badgeConfig = {
    added: { icon: "🆕", text: "NEW", className: "bg-green-500 text-white" },
    modified: { icon: "📝", text: "EDITED", className: "bg-blue-500 text-white" },
    deleted: { icon: "🗑️", text: "DELETED", className: "bg-gray-500 text-white" },
  }

  const config = badgeConfig[status]

  return (
    <div
      className={cn(
        "absolute top-1 right-1 px-2 py-0.5 text-[10px] font-bold rounded pointer-events-none z-10 flex items-center gap-1",
        config.className,
      )}
    >
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </div>
  )
}

export default function FloorplanEditorPage({
  params,
}: {
  params: { storeId: string; floorId: string }
}) {
  const [currentUser] = useState<User>({
    id: "user-1",
    name: "Emma Wilson",
    email: "emma@example.com",
    role: "staff", // Change this to test different roles: "owner", "manager", "staff", "viewer"
    avatar: "/placeholder.svg?height=32&width=32",
  })

  const permissions = getRolePermissions(currentUser.role)

  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  const [permissionMessage, setPermissionMessage] = useState("")
  const [approvalMessage, setApprovalMessage] = useState("")
  const [selectedApprover, setSelectedApprover] = useState<string>("")
  const [approvalPriority, setApprovalPriority] = useState<"normal" | "urgent">("normal")
  const [lockDraftOnApproval, setLockDraftOnApproval] = useState(true)
  const [showActivityLogs, setShowActivityLogs] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [currentApprovalRequest, setCurrentApprovalRequest] = useState<ApprovalRequest | null>(null)

  // Mock available approvers (managers and owners)
  const availableApprovers: User[] = [
    {
      id: "user-2",
      name: "Sarah Johnson",
      email: "sarah@example.com",
      role: "manager",
    },
    {
      id: "user-3",
      name: "Michael Chen",
      email: "michael@example.com",
      role: "owner",
    },
  ]

  const [isDraftMode, setIsDraftMode] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("canvas")
  const [lastSaved, setLastSaved] = useState(new Date())

  const [tool, setTool] = useState<Tool>("select")
  const [tables, setTables] = useState<Table[]>([
    {
      id: "T1",
      name: "T1",
      capacity: 4,
      shape: "rectangle",
      x: 240,
      y: 320,
      width: 140,
      height: 90,
      rotation: 0,
      sectionId: "section1",
      tags: ["vip", "window"],
      changeStatus: "unchanged", // Initialize with unchanged status
    },
    {
      id: "T2",
      name: "T2",
      capacity: 2,
      shape: "circle",
      x: 420,
      y: 320,
      width: 80,
      height: 80,
      rotation: 0,
      sectionId: "section1",
      tags: [],
      changeStatus: "unchanged", // Initialize with unchanged status
    },
    {
      id: "T3",
      name: "T3",
      capacity: 4,
      shape: "rectangle",
      x: 600,
      y: 320,
      width: 140,
      height: 90,
      rotation: 0,
      sectionId: "section1",
      tags: ["bar"],
      changeStatus: "unchanged", // Initialize with unchanged status
    },
  ])

  const [sections, setSections] = useState<Section[]>([
    {
      id: "section1",
      name: "Main Dining",
      x: 200,
      y: 280,
      width: 600,
      height: 200,
      color: "#3B82F6",
      visible: true,
      staff: "Sarah Johnson",
      description: "Main dining area with natural lighting",
      order: 0,
      changeStatus: "unchanged", // Initialize with unchanged status
    },
  ])

  const [combos, setCombos] = useState<Combo[]>([])

  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState(TABLE_TEMPLATES[1])
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [floorName, setFloorName] = useState("Main Floor")
  const [floorWidth, setFloorWidth] = useState(DEFAULT_CANVAS_WIDTH)
  const [floorHeight, setFloorHeight] = useState(DEFAULT_CANVAS_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  // const [history, setHistory] = useState<Table[][]>([tables]) // Removed basic history
  // const [historyIndex, setHistoryIndex] = useState(0) // Removed basic history index

  const [actionHistory, setActionHistory] = useState<Action[]>([])
  const [actionHistoryIndex, setActionHistoryIndex] = useState(-1)
  const [showActionHistory, setShowActionHistory] = useState(false)

  const [versionToRestore, setVersionToRestore] = useState<Version | null>(null)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [restoreNotes, setRestoreNotes] = useState("")

  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false)
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 })
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 })

  const [isSectionDrawing, setIsSectionDrawing] = useState(false)
  const [sectionDrawStart, setSectionDrawStart] = useState({ x: 0, y: 0 })
  const [sectionDrawEnd, setSectionDrawEnd] = useState({ x: 0, y: 0 })
  const [newSectionName, setNewSectionName] = useState("")
  const [newSectionColor, setNewSectionColor] = useState(SECTION_COLORS[0].value)
  const [newSectionStaff, setNewSectionStaff] = useState<string | undefined>(undefined)
  const [newSectionDescription, setNewSectionDescription] = useState("")
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false)

  const [isDraggingSection, setIsDraggingSection] = useState(false)

  const [showComboDialog, setShowComboDialog] = useState(false)
  const [comboName, setComboName] = useState("")

  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle>(null)
  const [resizeStartTable, setResizeStartTable] = useState<Table | null>(null)
  const [lockAspectRatio, setLockAspectRatio] = useState(false)

  const [isRotating, setIsRotating] = useState(false)
  const [rotationStart, setRotationStart] = useState(0)

  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([])

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [filterSection, setFilterSection] = useState<string>("all")
  const [filterCapacity, setFilterCapacity] = useState<string>("all")
  const [filterShape, setFilterShape] = useState<string>("all")
  const [filterTags, setFilterTags] = useState<string>("all")
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>("")
  const [showTagEditor, setShowTagEditor] = useState<string | null>(null)
  const [tagEditorValue, setTagEditorValue] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [isDiscardOpen, setIsDiscardOpen] = useState(false)
  const [publishedSnapshot, setPublishedSnapshot] = useState<{
    tables: Table[]
    sections: Section[]
  } | null>(null)
  const [pulsingTableId, setPulsingTableId] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [pendingRecovery, setPendingRecovery] = useState<any>(null)

  const [currentVersion, setCurrentVersion] = useState(12)
  const [versions, setVersions] = useState<Version[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState(0)
  const [publishingStep, setPublishingStep] = useState("")
  const [showPublishSuccess, setShowPublishSuccess] = useState(false)
  const [publishedVersionNumber, setPublishedVersionNumber] = useState<number | null>(null)
  const [versionNotes, setVersionNotes] = useState("") // For publish modal
  const [publishNotes, setPublishNotes] = useState("") // For publish modal
  const [notifyStaff, setNotifyStaff] = useState(true)

  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<Version | null>(null)
  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [compareVersionA, setCompareVersionA] = useState<number | null>(null)
  const [compareVersionB, setCompareVersionB] = useState<number | null>(null)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("side-by-side")
  const [isComparingVersions, setIsComparingVersions] = useState(false)
  const [versionSearchQuery, setVersionSearchQuery] = useState("")
  const [versionFilterDays, setVersionFilterDays] = useState<number | null>(null)
  const [beforeCompareState, setBeforeCompareState] = useState<{
    tables: Table[]
    sections: Section[]
    panOffset: { x: number; y: number }
    zoom: number
  } | null>(null)

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  const selectedTables = tables.filter((t) => selectedTableIds.includes(t.id))
  const selectedTable = selectedTables.length === 1 ? selectedTables[0] : null
  const selectedSection = sections.find((s) => s.id === selectedSectionId)

  const getChangeCounts = () => {
    const addedTables = tables.filter((t) => t.changeStatus === "added").length
    const modifiedTables = tables.filter((t) => t.changeStatus === "modified").length
    const deletedTables = tables.filter((t) => t.changeStatus === "deleted").length
    const addedSections = sections.filter((s) => s.changeStatus === "added").length
    const modifiedSections = sections.filter((s) => s.changeStatus === "modified").length
    const deletedSections = sections.filter((s) => s.changeStatus === "deleted").length

    return {
      added: addedTables + addedSections,
      modified: modifiedTables + modifiedSections,
      deleted: deletedTables + deletedSections,
      total: addedTables + modifiedTables + deletedTables + addedSections + modifiedSections + deletedSections,
      addedTables,
      modifiedTables,
      deletedTables,
      addedSections,
      modifiedSections,
      deletedSections,
    }
  }

  const validateFloorPlan = () => {
    const errors: ValidationError[] = []
    const activeTables = tables.filter((t) => t.changeStatus !== "deleted")

    // Check for table overlaps
    activeTables.forEach((t1, i) => {
      activeTables.slice(i + 1).forEach((t2) => {
        if (tablesOverlap(t1, t2)) {
          errors.push({
            type: "overlap",
            message: `${t1.name} overlaps with ${t2.name}`,
            items: [t1.id, t2.id],
          })
        }
      })
    })

    // Check for tables out of bounds
    activeTables.forEach((t) => {
      if (isOutOfBounds(t, floorWidth, floorHeight)) {
        errors.push({
          type: "out_of_bounds",
          message: `${t.name} extends beyond floor boundaries`,
          items: [t.id],
        })
      }
    })

    // Check for duplicate names
    const names = activeTables.map((t) => t.name)
    const seenNames = new Set<string>()
    const duplicateNames = new Set<string>()
    names.forEach((name) => {
      if (seenNames.has(name)) {
        duplicateNames.add(name)
      }
      seenNames.add(name)
    })
    duplicateNames.forEach((name) => {
      const tableIds = activeTables.filter((t) => t.name === name).map((t) => t.id)
      errors.push({
        type: "duplicate",
        message: `Duplicate table name: ${name}`,
        items: tableIds,
      })
    })

    return { errors, isValid: errors.length === 0 }
  }

  const tablesOverlap = (t1: Table, t2: Table): boolean => {
    // Simple AABB (axis-aligned bounding box) collision detection
    // Note: This doesn't account for rotation, but works for basic cases
    const t1Left = t1.x
    const t1Right = t1.x + t1.width
    const t1Top = t1.y
    const t1Bottom = t1.y + t1.height

    const t2Left = t2.x
    const t2Right = t2.x + t2.width
    const t2Top = t2.y
    const t2Bottom = t2.y + t2.height

    return !(t1Right < t2Left || t1Left > t2Right || t1Bottom < t2Top || t1Top > t2Bottom)
  }

  const isOutOfBounds = (table: Table, maxWidth: number, maxHeight: number): boolean => {
    return table.x < 0 || table.y < 0 || table.x + table.width > maxWidth || table.y + table.height > maxHeight
  }

  const handleAutoFixOverlap = (error: ValidationError) => {
    if (error.type !== "overlap" || error.items.length !== 2) return

    const [id1, id2] = error.items
    const t1 = tables.find((t) => t.id === id1)
    const t2 = tables.find((t) => t.id === id2)

    if (!t1 || !t2) return

    // Calculate how far to move t2 to the right to avoid overlap
    const moveDistance = t1.x + t1.width - t2.x + 20 // Add 20px padding

    const newTables = tables.map((t) => {
      if (t.id === id2) {
        return {
          ...t,
          x: t.x + moveDistance,
          changeStatus: t.changeStatus === "added" ? ("added" as const) : ("modified" as const),
        }
      }
      return t
    })

    setTables(newTables)
    toast.success(`Moved ${t2.name} to fix overlap`)

    // Re-validate after fix
    setTimeout(() => {
      const result = validateFloorPlan()
      setValidationErrors(result.errors)
      if (result.isValid) {
        setShowValidationModal(false)
        setShowPublishModal(true)
      }
    }, 100)
  }

  // Original handlePublishClick function - modified to check permissions and show approval dialog for staff
  const handlePublishClick = async () => {
    // Check if user has publish permission
    if (!permissions.canPublish) {
      // Staff user - show approval request dialog
      setShowApprovalDialog(true)
      return
    }

    const counts = getChangeCounts()
    if (counts.total === 0) {
      toast.info("No changes to publish")
      return
    }

    setIsValidating(true)
    setValidationErrors([])

    // Simulate validation delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = validateFloorPlan()
    setIsValidating(false)

    if (!result.isValid) {
      setValidationErrors(result.errors)
      setShowValidationModal(true)
    } else {
      setShowPublishModal(true)
    }
  }

  const handleRequestApproval = () => {
    if (!selectedApprover || !approvalMessage.trim()) {
      toast.error("Please select an approver and provide a message")
      return
    }

    const counts = getChangeCounts()
    const approver = availableApprovers.find((u) => u.id === selectedApprover)

    const request: ApprovalRequest = {
      id: `APR-${Math.floor(Math.random() * 10000)}`,
      requestedBy: currentUser,
      requestedAt: new Date().toISOString(),
      approver: approver || null,
      status: "pending",
      message: approvalMessage,
      priority: approvalPriority,
      lockDraft: lockDraftOnApproval,
      changesSummary: {
        added: counts.added,
        modified: counts.modified,
        deleted: counts.deleted,
      },
    }

    setApprovalRequests((prev) => [request, ...prev])
    setCurrentApprovalRequest(request)

    logActivity("Requested Approval", `Approval request ${request.id} sent to ${approver?.name}`)

    // Create notification for approver
    const notification: Notification = {
      id: `notif-${Date.now()}`,
      type: "approval_request",
      title: "Approval Request",
      message: `${currentUser.name} requests approval to publish changes to ${floorName}`,
      timestamp: new Date().toISOString(),
      read: false,
      data: request,
    }
    setNotifications((prev) => [notification, ...prev])

    setShowApprovalDialog(false)
    setApprovalMessage("")
    setSelectedApprover("")
    setApprovalPriority("normal")
    setLockDraftOnApproval(true)

    toast.success(`Approval request ${request.id} sent to ${approver?.name}`)
  }

  const handleDeleteTable = useCallback(() => {
    if (selectedTableIds.length > 0) {
      // Check delete permission
      if (!checkPermission("canDelete", "delete tables")) {
        return
      }

      const previousTables = [...tables]

      const newTables = tables
        .map((t) => {
          if (selectedTableIds.includes(t.id)) {
            // If table was just added, remove it entirely
            if (t.changeStatus === "added") {
              return null
            }
            // Otherwise, mark as deleted
            return { ...t, changeStatus: "deleted" as const }
          }
          return t
        })
        .filter(Boolean) as Table[]

      setTables(newTables)

      const deletedCount = selectedTableIds.length
      const deletedNames = tables
        .filter((t) => selectedTableIds.includes(t.id))
        .map((t) => t.name)
        .join(", ")

      recordAction({
        id: `action-${Date.now()}`,
        type: "delete_table",
        description: `Deleted ${deletedCount} table(s): ${deletedNames}`,
        timestamp: new Date(),
        undo: () => setTables(previousTables),
        redo: () => setTables(newTables),
      })

      logActivity("Deleted Tables", `Deleted ${deletedCount} table(s): ${deletedNames}`)

      setSelectedTableIds([])
      toast.success(`Deleted ${selectedTableIds.length} table(s)`)
    }
  }, [selectedTableIds, tables, checkPermission, recordAction, logActivity])

  const handlePublishConfirm = async () => {
    setIsPublishing(true)
    setShowPublishModal(false)
    setPublishProgress(0)
    setPublishingStep("Validating changes...")

    // Simulate publishing progress
    await new Promise((resolve) => setTimeout(resolve, 300))
    setPublishProgress(20)
    setPublishingStep("Creating version snapshot...")

    await new Promise((resolve) => setTimeout(resolve, 500))
    setPublishProgress(50)
    setPublishingStep("Updating floor plan...")

    await new Promise((resolve) => setTimeout(resolve, 400))
    setPublishProgress(80)
    setPublishingStep("Finalizing...")

    await new Promise((resolve) => setTimeout(resolve, 300))
    setPublishProgress(100)

    // Create version snapshot
    const counts = getChangeCounts()
    const newVersion: Version = {
      versionNumber: currentVersion + 1,
      publishedAt: new Date().toISOString(),
      publishedBy: currentUser.name, // Use current user name
      notes: versionNotes,
      tables: tables
        .filter((t) => t.changeStatus !== "deleted")
        .map((t) => ({ ...t, changeStatus: "unchanged" as const })),
      sections: sections
        .filter((s) => s.changeStatus !== "deleted")
        .map((s) => ({ ...s, changeStatus: "unchanged" as const })),
      changesSummary: {
        added: counts.added,
        modified: counts.modified,
        deleted: counts.deleted,
      },
    }

    setVersions([...versions, newVersion])
    setCurrentVersion(currentVersion + 1)
    setPublishedVersionNumber(currentVersion + 1)

    // Clear all changeStatus flags and remove deleted items
    setTables(
      tables.filter((t) => t.changeStatus !== "deleted").map((t) => ({ ...t, changeStatus: "unchanged" as const })),
    )
    setSections(
      sections.filter((s) => s.changeStatus !== "deleted").map((s) => ({ ...s, changeStatus: "unchanged" as const })),
    )

    // Clear draft from localStorage
    localStorage.removeItem(`floorplan-draft-${params.floorId}`)

    // Switch to published mode
    setIsDraftMode(false)
    setPublishedSnapshot(null)
    setLastSaved(new Date())
    setIsPublishing(false)
    setVersionNotes("")
    setNotifyStaff(true)

    logActivity(
      "Published Changes",
      `Published version ${newVersion.versionNumber} with ${counts.total} changes`,
      newVersion.changesSummary,
    )

    // Show success modal
    setShowPublishSuccess(true)

    if (notifyStaff) {
      toast.success("Floor plan published and staff notified")
    } else {
      toast.success("Floor plan published")
    }
  }

  const filteredAndSortedTables = (() => {
    let filtered = tables

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((t) => {
        const searchLower = searchQuery.toLowerCase()
        return (
          t.name.toLowerCase().includes(searchLower) ||
          t.capacity.toString().includes(searchLower) ||
          t.shape.toLowerCase().includes(searchLower) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(searchLower)))
        )
      })
    }

    // Apply section filter
    if (filterSection !== "all") {
      filtered = filtered.filter((t) => {
        if (filterSection === "unassigned") return !t.sectionId
        return t.sectionId === filterSection
      })
    }

    // Apply capacity filter
    if (filterCapacity !== "all") {
      const capacity = Number.parseInt(filterCapacity)
      filtered = filtered.filter((t) => t.capacity === capacity)
    }

    // Apply shape filter
    if (filterShape !== "all") {
      filtered = filtered.filter((t) => t.shape === filterShape)
    }

    // Apply tags filter
    if (filterTags !== "all") {
      filtered = filtered.filter((t) => t.tags && t.tags.includes(filterTags))
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let compareA: any
        let compareB: any

        switch (sortColumn) {
          case "name":
            compareA = a.name
            compareB = b.name
            break
          case "capacity":
            compareA = a.capacity
            compareB = b.capacity
            break
          case "shape":
            compareA = a.shape
            compareB = b.shape
            break
          case "section":
            compareA = sections.find((s) => s.id === a.sectionId)?.name || "Unassigned"
            compareB = sections.find((s) => s.id === b.sectionId)?.name || "Unassigned"
            break
          case "position":
            compareA = a.x + a.y
            compareB = b.x + b.y
            break
          default:
            return 0
        }

        if (compareA < compareB) return sortDirection === "asc" ? -1 : 1
        if (compareA > compareB) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  })()

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const handleStartEdit = (tableId: string, field: string, value: any) => {
    setEditingTableId(tableId)
    setEditingField(field)
    setEditingValue(value?.toString() || "")
  }

  const handleSaveEdit = () => {
    if (!editingTableId || !editingField) return

    const newTables = tables.map((t) => {
      if (t.id !== editingTableId) return t

      const updatedTable = { ...t }
      switch (editingField) {
        case "name":
          updatedTable.name = editingValue
          break
        case "capacity":
          updatedTable.capacity = Number.parseInt(editingValue) || 1
          break
        default:
          return t
      }

      // Only mark as modified if it wasn't already added
      if (updatedTable.changeStatus !== "added" && updatedTable.changeStatus !== "deleted") {
        updatedTable.changeStatus = "modified"
      }

      return updatedTable
    })

    setTables(newTables)
    // Remove old history add
    // addToHistory(newTables)
    setEditingTableId(null)
    setEditingField(null)
    setEditingValue("")
    toast.success("Table updated")
  }

  const handleCancelEdit = () => {
    setEditingTableId(null)
    setEditingField(null)
    setEditingValue("")
  }

  const handleOpenTagEditor = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId)
    if (table) {
      setShowTagEditor(tableId)
      setTagEditorValue(table.tags || [])
      setNewTag("")
    }
  }

  const handleAddTag = () => {
    if (!newTag.trim()) return
    const tag = newTag.trim().toLowerCase()
    if (!tagEditorValue.includes(tag)) {
      setTagEditorValue([...tagEditorValue, tag])
    }
    setNewTag("")
  }

  const handleRemoveTag = (tag: string) => {
    setTagEditorValue(tagEditorValue.filter((t) => t !== tag))
  }

  const handleSaveTags = () => {
    if (!showTagEditor) return

    const newTables = tables.map((t) => {
      if (t.id === showTagEditor) {
        const updatedTable = { ...t, tags: tagEditorValue }
        if (updatedTable.changeStatus !== "added" && updatedTable.changeStatus !== "deleted") {
          updatedTable.changeStatus = "modified"
        }
        return updatedTable
      }
      return t
    })

    setTables(newTables)
    // Remove old history add
    // addToHistory(newTables)
    setShowTagEditor(null)
    toast.success("Tags updated")
  }

  const handleLocate = (id: string) => {
    const table = tables.find((t) => t.id === id)
    const section = sections.find((s) => s.id === id)
    const item = table || section

    if (!item || !canvasRef.current) return

    // Close review panel
    setIsReviewOpen(false)

    // Switch to canvas view
    setViewMode("canvas")

    // Select the item
    if (table) {
      setSelectedTableIds([id])
    } else if (section) {
      setSelectedSectionId(id)
    }

    // Center canvas on the item
    setTimeout(() => {
      if (canvasRef.current && item) {
        const rect = canvasRef.current.getBoundingClientRect()
        const centerX = item.x + item.width / 2
        const centerY = item.y + item.height / 2

        setPanOffset({
          x: rect.width / 2 - centerX * (zoom / 100),
          y: rect.height / 2 - centerY * (zoom / 100),
        })

        // Add pulse animation
        setPulsingTableId(id)
        setTimeout(() => setPulsingTableId(null), 2000)

        toast.success(`Located ${table ? table.name : section?.name} on canvas`)
      }
    }, 100)
  }

  const handleRestore = (id: string) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id && t.changeStatus === "deleted" ? { ...t, changeStatus: "modified" } : t)),
    )
    setSections((prev) =>
      prev.map((s) => (s.id === id && s.changeStatus === "deleted" ? { ...s, changeStatus: "modified" } : s)),
    )

    const table = tables.find((t) => t.id === id)
    const section = sections.find((s) => s.id === id)
    toast.success(`${table ? `Table ${table.name}` : section ? `Section ${section.name}` : "Item"} restored`)
  }

  const handleLocateOnCanvas = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table || !canvasRef.current) return

    setViewMode("canvas")
    setSelectedTableIds([tableId])

    setTimeout(() => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const centerX = table.x + table.width / 2
        const centerY = table.y + table.height / 2

        setPanOffset({
          x: rect.width / 2 - centerX * (zoom / 100),
          y: rect.height / 2 - centerY * (zoom / 100),
        })

        toast.success(`Located ${table.name} on canvas`)
      }
    }, 100)
  }

  const handleExportCSV = () => {
    const headers = ["Name", "Capacity", "Shape", "Section", "Position X", "Position Y", "Tags"]
    const rows = tables.map((t) => [
      t.name,
      t.capacity.toString(),
      t.shape,
      sections.find((s) => s.id === t.sectionId)?.name || "Unassigned",
      t.x.toString(),
      t.y.toString(),
      (t.tags || []).join("; "),
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${floorName}-tables.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success("CSV exported successfully")
  }

  const handleClearFilters = () => {
    setSearchQuery("")
    setFilterSection("all")
    setFilterCapacity("all")
    setFilterShape("all")
    setFilterTags("all")
    toast.info("Filters cleared")
  }

  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE

  const snapAngle = (angle: number, shiftKey: boolean) => {
    if (shiftKey) return angle
    return Math.round(angle / ROTATION_SNAP_ANGLE) * ROTATION_SNAP_ANGLE
  }

  const checkCollision = (table1: Table, table2: Table): boolean => {
    return !(
      table1.x + table1.width < table2.x ||
      table1.x > table2.x + table2.width ||
      table1.y + table1.height < table2.y ||
      table1.y > table2.y + table2.height
    )
  }

  // Replace basic history add with recordAction
  // const addToHistory = useCallback(
  //   (newTables: Table[]) => {
  //     setHistory((prev) => {
  //       const newHistory = prev.slice(0, historyIndex + 1)
  //       newHistory.push(newTables)
  //       return newHistory.slice(-20)
  //     })
  //     setHistoryIndex((prev) => Math.min(prev + 1, 19))
  //   },
  //   [historyIndex],
  // )

  // const undo = useCallback(() => {
  //   if (historyIndex > 0) {
  //     setHistoryIndex(historyIndex - 1)
  //     setTables(history[historyIndex - 1])
  //     toast.info("Undone")
  //   }
  // }, [history, historyIndex])

  // const redo = useCallback(() => {
  //   if (historyIndex < history.length - 1) {
  //     setHistoryIndex(historyIndex + 1)
  //     setTables(history[historyIndex + 1])
  //     toast.info("Redone")
  //   }
  // }, [history, historyIndex])

  const recordAction = useCallback(
    (action: Action) => {
      setActionHistory((prev) => {
        // Remove any redo history
        const newHistory = prev.slice(0, actionHistoryIndex + 1)
        newHistory.push(action)
        // Keep last 50 actions
        return newHistory.slice(-50)
      })
      setActionHistoryIndex((prev) => Math.min(prev + 1, 49))
    },
    [actionHistoryIndex],
  )

  const undo = useCallback(() => {
    if (actionHistoryIndex < 0) return
    actionHistory[actionHistoryIndex].undo()
    setActionHistoryIndex(actionHistoryIndex - 1)
    toast.info(`Undone: ${actionHistory[actionHistoryIndex].description}`)
  }, [actionHistory, actionHistoryIndex])

  const redo = useCallback(() => {
    if (actionHistoryIndex >= actionHistory.length - 1) return
    setActionHistoryIndex(actionHistoryIndex + 1)
    actionHistory[actionHistoryIndex + 1].redo()
    toast.info(`Redone: ${actionHistory[actionHistoryIndex + 1].description}`)
  }, [actionHistory, actionHistoryIndex])

  const handleUndoTo = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= actionHistory.length) return

      const actionsToUndo = actionHistory.slice(targetIndex + 1, actionHistoryIndex + 1)
      if (actionsToUndo.length === 0) return

      const confirmed = confirm(
        `Undo ${actionsToUndo.length} action${actionsToUndo.length !== 1 ? "s" : ""}?\n\n` +
          actionsToUndo
            .reverse()
            .map((a) => `• ${a.description}`)
            .join("\n"),
      )

      if (!confirmed) return

      // Undo all actions in reverse
      for (let i = actionHistoryIndex; i > targetIndex; i--) {
        actionHistory[i].undo()
      }
      setActionHistoryIndex(targetIndex)
      toast.success(`Undone ${actionsToUndo.length} actions`)
    },
    [actionHistory, actionHistoryIndex],
  )

  const clearActionHistory = useCallback(() => {
    setActionHistory([])
    setActionHistoryIndex(-1)
  }, [])

  const getTablesInMarquee = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const left = Math.min(start.x, end.x)
      const right = Math.max(start.x, end.x)
      const top = Math.min(start.y, end.y)
      const bottom = Math.max(start.y, end.y)

      return tables.filter((table) => {
        const tableRight = table.x + table.width
        const tableBottom = table.y + table.height
        return table.x >= left && tableRight <= right && table.y >= top && tableBottom <= bottom
      })
    },
    [tables],
  )

  const detectAlignmentGuides = useCallback(
    (movingTableIds: string[]) => {
      const guides: AlignmentGuide[] = []
      const threshold = 5
      const movingTables = tables.filter((t) => movingTableIds.includes(t.id))
      const staticTables = tables.filter((t) => !movingTableIds.includes(t.id))

      if (movingTables.length === 0 || staticTables.length === 0) return guides

      movingTables.forEach((movingTable) => {
        staticTables.forEach((staticTable) => {
          const movingLeft = movingTable.x
          const movingCenter = movingTable.x + movingTable.width / 2
          const movingRight = movingTable.x + movingTable.width
          const staticLeft = staticTable.x
          const staticCenter = staticTable.x + staticTable.width / 2
          const staticRight = staticTable.x + staticTable.width

          if (Math.abs(movingLeft - staticLeft) < threshold) {
            guides.push({
              type: "vertical",
              position: staticLeft,
              tableIds: [movingTable.id, staticTable.id],
            })
          }
          if (Math.abs(movingCenter - staticCenter) < threshold) {
            guides.push({
              type: "vertical",
              position: staticCenter,
              tableIds: [movingTable.id, staticTable.id],
            })
          }
          if (Math.abs(movingRight - staticRight) < threshold) {
            guides.push({
              type: "vertical",
              position: staticRight,
              tableIds: [movingTable.id, staticTable.id],
            })
          }

          const movingTop = movingTable.y
          const movingMiddle = movingTable.y + movingTable.height / 2
          const movingBottom = movingTable.y + movingTable.height / 2
          const staticTop = staticTable.y
          const staticMiddle = staticTable.y + staticTable.height / 2
          const staticBottom = staticTable.y + staticTable.height / 2

          if (Math.abs(movingTop - staticTop) < threshold) {
            guides.push({
              type: "horizontal",
              position: staticTop,
              tableIds: [movingTable.id, staticTable.id],
            })
          }
          if (Math.abs(movingMiddle - staticMiddle) < threshold) {
            guides.push({
              type: "horizontal",
              position: staticMiddle,
              tableIds: [movingTable.id, staticTable.id],
            })
          }
          if (Math.abs(movingBottom - staticBottom) < threshold) {
            guides.push({
              type: "horizontal",
              position: staticBottom,
              tableIds: [movingTable.id, staticTable.id],
            })
          }
        })
      })

      return guides
    },
    [tables],
  )

  const handleCreateSection = () => {
    if (!newSectionName.trim()) {
      toast.error("Please enter a section name")
      return
    }

    const left = Math.min(sectionDrawStart.x, sectionDrawEnd.x)
    const top = Math.min(sectionDrawStart.y, sectionDrawEnd.y)
    const width = Math.abs(sectionDrawEnd.x - sectionDrawStart.x)
    const height = Math.abs(sectionDrawEnd.y - sectionDrawStart.y)

    const tablesInSection = tables.filter((table) => {
      return (
        table.x >= left &&
        table.x + table.width <= left + width &&
        table.y >= top &&
        table.y + table.height <= top + height
      )
    })

    const newSection: Section = {
      id: `section${sections.length + 1}`,
      name: newSectionName,
      x: left,
      y: top,
      width,
      height,
      color: newSectionColor,
      visible: true,
      staff: newSectionStaff,
      description: newSectionDescription,
      order: sections.length,
      changeStatus: "added", // Mark new section as added
    }

    setSections([...sections, newSection])

    if (tablesInSection.length > 0) {
      const newTables = tables.map((t) => {
        if (tablesInSection.find((ts) => ts.id === t.id)) {
          const updatedTable = { ...t, sectionId: newSection.id }
          if (updatedTable.changeStatus !== "added" && updatedTable.changeStatus !== "deleted") {
            updatedTable.changeStatus = "modified"
          }
          return updatedTable
        }
        return t
      })
      setTables(newTables)
      // Remove old history add
      // addToHistory(newTables)
    }

    toast.success(`Created section: ${newSectionName}`)
    setShowNewSectionDialog(false)
    setNewSectionName("")
    setNewSectionColor(SECTION_COLORS[0].value)
    setNewSectionStaff(undefined)
    setNewSectionDescription("")
    setIsSectionDrawing(false)
  }

  const handleCreateCombo = () => {
    if (selectedTableIds.length < 2) {
      toast.error("Select at least 2 tables to create a combination")
      return
    }

    const totalCapacity = selectedTables.reduce((sum, t) => sum + t.capacity, 0)
    const tableNames = selectedTables.map((t) => t.name).join("-")

    const newCombo: Combo = {
      id: `combo${combos.length + 1}`,
      name: comboName || `Tables ${tableNames}`,
      tableIds: selectedTableIds,
      totalCapacity,
    }

    setCombos([...combos, newCombo])
    toast.success(`Created combo: ${newCombo.name}`)
    setShowComboDialog(false)
    setComboName("")
  }

  const toggleSectionVisibility = (sectionId: string) => {
    setSections(sections.map((s) => (s.id === sectionId ? { ...s, visible: !s.visible } : s)))
  }

  const deleteSection = (sectionId: string) => {
    setSections(sections.filter((s) => s.id !== sectionId))
    const newTables = tables.map((t) => (t.sectionId === sectionId ? { ...t, sectionId: undefined } : t))
    setTables(newTables)
    // Remove old history add
    // addToHistory(newTables)
    toast.success("Section deleted")
  }

  const deleteCombo = (comboId: string) => {
    setCombos(combos.filter((c) => c.id !== comboId))
    toast.success("Combo deleted")
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool === "add-table" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x = snapToGrid((e.clientX - rect.left - panOffset.x) / (zoom / 100))
      const y = snapToGrid((e.clientY - rect.top - panOffset.y) / (zoom / 100))

      const newTable: Table = {
        id: `T${tables.length + 1}`,
        name: `T${tables.length + 1}`,
        capacity: selectedTemplate.capacity,
        shape: selectedTemplate.shape,
        x,
        y,
        width: selectedTemplate.width,
        height: selectedTemplate.height,
        rotation: 0,
        tags: [],
        changeStatus: "added", // Mark new table as added
      }

      const newTables = [...tables, newTable]
      const previousTables = [...tables]

      setTables(newTables)

      recordAction({
        id: `action-${Date.now()}`,
        type: "add_table",
        description: `Added table ${newTable.name}`,
        timestamp: new Date(),
        undo: () => setTables(previousTables),
        redo: () => setTables(newTables),
      })

      setSelectedTableIds([newTable.id])
      toast.success(`Added ${newTable.name}`)
    }
  }

  const handleTableClick = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation()
    if (tool === "select") {
      if (e.shiftKey) {
        setSelectedTableIds((prev) =>
          prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId],
        )
      } else {
        setSelectedTableIds([tableId])
      }
      setSelectedSectionId(null)
    }
  }

  const handleSectionClick = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation()
    if (tool === "select") {
      setSelectedSectionId(sectionId)
      setSelectedTableIds([])
    }
  }

  const handleSectionDragStart = (e: React.MouseEvent, sectionId: string) => {
    if (tool !== "select") return
    e.preventDefault()
    e.stopPropagation()

    setSelectedSectionId(sectionId)
    setSelectedTableIds([])
    setIsDraggingSection(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleTableDragStart = (e: React.MouseEvent, tableId: string) => {
    if (tool !== "select") return
    e.preventDefault() // Prevent text selection during drag
    e.stopPropagation()

    if (!selectedTableIds.includes(tableId)) {
      setSelectedTableIds([tableId])
    }

    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const getResizeHandleAtPosition = (table: Table, mouseX: number, mouseY: number, scale: number): ResizeHandle => {
    const handleSize = 8
    const handles: { handle: ResizeHandle; x: number; y: number }[] = [
      { handle: "nw", x: table.x * scale, y: table.y * scale },
      { handle: "n", x: (table.x + table.width / 2) * scale, y: table.y * scale },
      { handle: "ne", x: (table.x + table.width) * scale, y: table.y * scale },
      { handle: "e", x: (table.x + table.width) * scale, y: (table.y + table.height / 2) * scale },
      { handle: "se", x: (table.x + table.width) * scale, y: (table.y + table.height) * scale },
      { handle: "s", x: (table.x + table.width / 2) * scale, y: (table.y + table.height) * scale },
      { handle: "sw", x: table.x * scale, y: (table.y + table.height) * scale },
      { handle: "w", x: table.x * scale, y: (table.y + table.height / 2) * scale },
    ]

    for (const { handle, x, y } of handles) {
      if (Math.abs(mouseX - x) <= handleSize && Math.abs(mouseY - y) <= handleSize) {
        return handle
      }
    }

    return null
  }

  const isOverRotationHandle = (table: Table, mouseX: number, mouseY: number, scale: number): boolean => {
    const centerX = (table.x + table.width / 2) * scale
    const centerY = (table.y + table.height / 2) * scale
    const handleY = table.y * scale - 40 * scale
    const handleRadius = 8

    return Math.abs(mouseX - centerX) <= handleRadius && Math.abs(mouseY - handleY) <= handleRadius
  }

  const handleDuplicate = useCallback(() => {
    if (selectedTableIds.length > 0) {
      const newTables = [...tables]
      const previousTables = [...tables]
      const addedTables: Table[] = []

      selectedTableIds.forEach((id) => {
        const table = tables.find((t) => t.id === id)
        if (table) {
          const newTable = {
            ...table,
            id: `T${newTables.length + 1}`,
            name: `${table.name}-copy`,
            x: table.x + 40,
            y: table.y + 40,
            changeStatus: "added", // Mark duplicated table as added
          }
          newTables.push(newTable)
          addedTables.push(newTable)
        }
      })
      setTables(newTables)

      // Record duplicate action
      recordAction({
        id: `action-${Date.now()}`,
        type: "duplicate_table",
        description: `Duplicated ${selectedTableIds.length} table(s)`,
        timestamp: new Date(),
        undo: () => setTables(previousTables),
        redo: () => setTables(newTables),
      })

      toast.success(`Duplicated ${selectedTableIds.length} table(s)`)
    }
  }, [tables, selectedTableIds, recordAction])

  const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (!isDraftMode) return // Only allow interaction in draft mode
    e.stopPropagation()

    if (tool === "select") {
      if (e.shiftKey) {
        setSelectedTableIds((prev) =>
          prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId],
        )
      } else {
        setSelectedTableIds([tableId])
      }
      setSelectedSectionId(null)
    }

    if (tool !== "select") return

    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const x = Math.round((e.clientX - rect.left - panOffset.x) / (zoom / 100))
        const y = Math.round((e.clientY - rect.top - panOffset.y) / (zoom / 100))
        setCursorPos({ x, y })
      }

      if (isSectionDrawing && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left - panOffset.x) / (zoom / 100)
        const y = (e.clientY - rect.top - panOffset.y) / (zoom / 100)
        setSectionDrawEnd({ x, y })
      }

      if (isMarqueeSelecting && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left - panOffset.x) / (zoom / 100)
        const y = (e.clientY - rect.top - panOffset.y) / (zoom / 100)
        setMarqueeEnd({ x, y })
      }

      if (activeResizeHandle && resizeStartTable && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left - panOffset.x) / (zoom / 100)
        const mouseY = (e.clientY - rect.top - panOffset.y) / (zoom / 100)
        const deltaX = mouseX - dragStart.x / (zoom / 100)
        const deltaY = mouseY - dragStart.y / (zoom / 100)

        setTables((prev) =>
          prev.map((t) => {
            if (t.id !== resizeStartTable.id) return t

            let newWidth = t.width
            let newHeight = t.height
            let newX = t.x
            let newY = t.y

            if (activeResizeHandle.includes("e")) {
              newWidth = Math.max(MIN_TABLE_WIDTH, resizeStartTable.width + deltaX)
            }
            if (activeResizeHandle.includes("w")) {
              const widthChange = deltaX
              newWidth = Math.max(MIN_TABLE_WIDTH, resizeStartTable.width - widthChange)
              if (newWidth > MIN_TABLE_WIDTH) {
                newX = resizeStartTable.x + widthChange
              }
            }
            if (activeResizeHandle.includes("s")) {
              newHeight = Math.max(MIN_TABLE_HEIGHT, resizeStartTable.height + deltaY)
            }
            if (activeResizeHandle.includes("n")) {
              const heightChange = deltaY
              newHeight = Math.max(MIN_TABLE_HEIGHT, resizeStartTable.height - heightChange)
              if (newHeight > MIN_TABLE_HEIGHT) {
                newY = resizeStartTable.y + heightChange
              }
            }

            if (t.shape === "circle" || lockAspectRatio) {
              const aspectRatio = resizeStartTable.width / resizeStartTable.height
              if (activeResizeHandle.includes("e") || activeResizeHandle.includes("w")) {
                newHeight = newWidth / aspectRatio
              } else {
                newWidth = newHeight * aspectRatio
              }
            }

            if (t.shape === "circle") {
              const size = Math.max(newWidth, newHeight)
              newWidth = size
              newHeight = size
            }

            return { ...t, x: newX, y: newY, width: newWidth, height: newHeight }
          }),
        )
      }

      if (isRotating && selectedTable && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left - panOffset.x) / (zoom / 100)
        const mouseY = (e.clientY - rect.top - panOffset.y) / (zoom / 100)
        const centerX = selectedTable.x + selectedTable.width / 2
        const centerY = selectedTable.y + selectedTable.height / 2
        const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI) + 90
        const snappedAngle = snapAngle(angle, e.shiftKey)

        setTables((prev) => prev.map((t) => (t.id === selectedTable.id ? { ...t, rotation: snappedAngle } : t)))
      }

      if (isDraggingSection && selectedSectionId && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const deltaX = (e.clientX - dragStart.x) / (zoom / 100)
        const deltaY = (e.clientY - dragStart.y) / (zoom / 100)

        setSections((prev) =>
          prev.map((s) =>
            s.id === selectedSectionId
              ? {
                  ...s,
                  x: snapToGrid(s.x + deltaX),
                  y: snapToGrid(s.y + deltaY),
                }
              : s,
          ),
        )
        setDragStart({ x: e.clientX, y: e.clientY })
      }

      if (isDragging && !activeResizeHandle && !isRotating && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const deltaX = (e.clientX - dragStart.x) / (zoom / 100)
        const deltaY = (e.clientY - dragStart.y) / (zoom / 100)

        const newTables = tables.map((t) => {
          if (!selectedTableIds.includes(t.id)) return t

          const updatedTable = {
            ...t,
            x: snapToGrid(t.x + deltaX),
            y: snapToGrid(t.y + deltaY),
          }

          if (updatedTable.changeStatus !== "added" && updatedTable.changeStatus !== "deleted") {
            updatedTable.changeStatus = "modified" as const
          }

          return updatedTable
        })

        setTables(newTables)
        setDragStart({ x: e.clientX, y: e.clientY })

        const guides = detectAlignmentGuides(selectedTableIds)
        setAlignmentGuides(guides)
      }

      if (isPanning && canvasRef.current) {
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y
        setPanOffset((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }))
        setDragStart({ x: e.clientX, y: e.clientY })
      }
    }

    const handleMouseUp = () => {
      if (isSectionDrawing && canvasRef.current) {
        const width = Math.abs(sectionDrawEnd.x - sectionDrawStart.x)
        const height = Math.abs(sectionDrawEnd.y - sectionDrawStart.y)
        if (width > 50 && height > 50) {
          setIsSectionDrawing(false)
          setShowNewSectionDialog(true)
        } else {
          toast.error("Section too small. Draw a larger area.")
          setIsSectionDrawing(false)
        }
        return
      }

      if (isDraggingSection) {
        setIsDraggingSection(false)
      }

      if (isDragging && !activeResizeHandle && !isRotating && selectedTableIds.length > 0) {
        const movedTables = tables.filter((t) => selectedTableIds.includes(t.id))
        const previousState = [...tables]
        const currentState = [...tables]

        recordAction({
          id: `action-${Date.now()}`,
          type: "move_table",
          description: `Moved ${movedTables.length} table(s)`,
          timestamp: new Date(),
          undo: () => setTables(previousState),
          redo: () => setTables(currentState),
        })
      }

      if (activeResizeHandle && resizeStartTable) {
        const previousState = tables.map((t) => (t.id === resizeStartTable.id ? resizeStartTable : t))
        const currentState = [...tables]

        recordAction({
          id: `action-${Date.now()}`,
          type: "resize_table",
          description: `Resized table ${resizeStartTable.name}`,
          timestamp: new Date(),
          undo: () => setTables(previousState),
          redo: () => setTables(currentState),
        })
      }

      if (isRotating && selectedTable) {
        const previousRotation = selectedTable.rotation
        const currentRotation = tables.find((t) => t.id === selectedTable.id)?.rotation || 0
        const previousState = tables.map((t) => (t.id === selectedTable.id ? { ...t, rotation: previousRotation } : t))
        const currentState = [...tables]

        recordAction({
          id: `action-${Date.now()}`,
          type: "rotate_table",
          description: `Rotated table ${selectedTable.name}`,
          timestamp: new Date(),
          undo: () => setTables(previousState),
          redo: () => setTables(currentState),
        })
      }

      setIsDragging(false)
      setIsPanning(false)
      setActiveResizeHandle(null)
      setResizeStartTable(null)
      setIsRotating(false)
      setAlignmentGuides([])

      if (isMarqueeSelecting) {
        const selectedInMarquee = getTablesInMarquee(marqueeStart, marqueeEnd)
        setSelectedTableIds(selectedInMarquee.map((t) => t.id))
        setIsMarqueeSelecting(false)
      }
    }

    if (
      isDragging ||
      isPanning ||
      isMarqueeSelecting ||
      activeResizeHandle ||
      isRotating ||
      isSectionDrawing ||
      isDraggingSection
    ) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [
    isDragging,
    isPanning,
    isMarqueeSelecting,
    isSectionDrawing,
    selectedTableIds,
    dragStart,
    zoom,
    panOffset,
    tables,
    // Removed addToHistory, undo, redo
    // addToHistory,
    undo,
    redo,
    marqueeStart,
    marqueeEnd,
    sectionDrawStart,
    sectionDrawEnd,
    getTablesInMarquee,
    activeResizeHandle,
    resizeStartTable,
    lockAspectRatio,
    isRotating,
    selectedTable,
    detectAlignmentGuides,
    isDraggingSection,
    selectedSectionId,
    recordAction, // Added
  ])

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (contextMenu) {
      setContextMenu(null)
    }

    if (tool === "section" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - panOffset.x) / (zoom / 100)
      const y = (e.clientY - rect.top - panOffset.y) / (zoom / 100)
      setIsSectionDrawing(true)
      setSectionDrawStart({ x, y })
      setSectionDrawEnd({ x, y })
      return
    }

    if (tool === "pan" || e.button === 1) {
      setIsPanning(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    } else if (tool === "select" && !e.shiftKey && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - panOffset.x) / (zoom / 100)
      const y = (e.clientY - rect.top - panOffset.y) / (zoom / 100)
      setIsMarqueeSelecting(true)
      setMarqueeStart({ x, y })
      setMarqueeEnd({ x, y })
      setSelectedTableIds([])
      setSelectedSectionId(null)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (selectedTableIds.length > 0) {
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
  }

  const handleAlign = (direction: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (selectedTableIds.length < 2) {
      toast.error("Select at least 2 tables to align")
      return
    }

    const selectedTables = tables.filter((t) => selectedTableIds.includes(t.id))
    let newTables = [...tables]
    const previousTables = [...tables]
    const actionDescription = `Aligned ${selectedTableIds.length} table(s)`
    let changedTableIds = new Set<string>()

    if (direction === "left") {
      const minX = Math.min(...selectedTables.map((t) => t.x))
      newTables = newTables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, x: minX } : t))
      changedTableIds = new Set(selectedTableIds)
    } else if (direction === "center") {
      const avgX = selectedTables.reduce((sum, t) => sum + t.x + t.width / 2, 0) / selectedTables.length
      newTables = newTables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, x: avgX - t.width / 2 } : t))
      changedTableIds = new Set(selectedTableIds)
    } else if (direction === "right") {
      const maxX = Math.max(...selectedTables.map((t) => t.x + t.width))
      newTables = newTables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, x: maxX - t.width } : t))
      changedTableIds = new Set(selectedTableIds)
    } else if (direction === "top") {
      const minY = Math.min(...selectedTables.map((t) => t.y))
      newTables = newTables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, y: minY } : t))
      changedTableIds = new Set(selectedTableIds)
    } else if (direction === "middle") {
      const avgY = selectedTables.reduce((sum, t) => sum + t.y + t.height / 2, 0) / selectedTables.length
      newTables = newTables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, y: avgY - t.height / 2 } : t))
      changedTableIds = new Set(selectedTableIds)
    } else if (direction === "bottom") {
      const maxY = Math.max(...selectedTables.map((t) => t.y + t.height))
      newTables = newTables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, y: maxY - t.height } : t))
      changedTableIds = new Set(selectedTableIds)
    }

    if (changedTableIds.size > 0) {
      setTables(newTables)
      // Record alignment action
      recordAction({
        id: `action-${Date.now()}`,
        type: "align_tables",
        description: actionDescription,
        timestamp: new Date(),
        undo: () => setTables(previousTables),
        redo: () => setTables(newTables),
      })
      toast.success(actionDescription)
    }
  }

  const handleDistribute = (direction: "horizontal" | "vertical") => {
    if (selectedTableIds.length < 3) {
      toast.error("Select at least 3 tables to distribute")
      return
    }

    const selectedTables = tables.filter((t) => selectedTableIds.includes(t.id))
    let newTables = [...tables]
    const previousTables = [...tables]
    let actionDescription = `Distributed ${selectedTableIds.length} tables horizontally`

    if (direction === "horizontal") {
      const sorted = [...selectedTables].sort((a, b) => a.x - b.x)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalSpace = last.x + last.width - first.x
      const tableWidths = sorted.reduce((sum, t) => sum + t.width, 0)
      const spacing = (totalSpace - tableWidths) / (sorted.length - 1)

      let currentX = first.x
      sorted.forEach((table) => {
        newTables = newTables.map((t) => (t.id === table.id ? { ...t, x: currentX } : t))
        currentX += table.width + spacing
      })
    } else {
      actionDescription = `Distributed ${selectedTableIds.length} tables vertically`
      const sorted = [...selectedTables].sort((a, b) => a.y - b.y)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalSpace = last.y + last.height - first.y
      const tableHeights = sorted.reduce((sum, t) => sum + t.height, 0)
      const spacing = (totalSpace - tableHeights) / (sorted.length - 1)

      let currentY = first.y
      sorted.forEach((table) => {
        newTables = newTables.map((t) => (t.id === table.id ? { ...t, y: currentY } : t))
        currentY += table.height + spacing
      })
    }

    setTables(newTables)
    // Record distribute action
    recordAction({
      id: `action-${Date.now()}`,
      type: "distribute_tables",
      description: actionDescription,
      timestamp: new Date(),
      undo: () => setTables(previousTables),
      redo: () => setTables(newTables),
    })
    toast.success(actionDescription)
  }

  const handleFitToScreen = () => {
    if (tables.length === 0) return

    const minX = Math.min(...tables.map((t) => t.x))
    const maxX = Math.max(...tables.map((t) => t.x + t.width))
    const minY = Math.min(...tables.map((t) => t.y))
    const maxY = Math.max(...tables.map((t) => t.y + t.height))

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const scaleX = (rect.width * 0.8) / contentWidth
      const scaleY = (rect.height * 0.8) / contentHeight
      const newZoom = Math.floor(Math.min(scaleX, scaleY) * 100)
      setZoom(Math.max(25, Math.min(200, newZoom)))

      setPanOffset({
        x: rect.width / 2 - ((minX + maxX) / 2) * (newZoom / 100),
        y: rect.height / 2 - ((minY + maxY) / 2) * (newZoom / 100),
      })
    }

    toast.success("Fit to screen")
  }

  const handleZoomToSelection = () => {
    if (selectedTableIds.length === 0) return

    const selectedTables = tables.filter((t) => selectedTableIds.includes(t.id))
    const minX = Math.min(...selectedTables.map((t) => t.x))
    const maxX = Math.max(...selectedTables.map((t) => t.x + t.width))
    const minY = Math.min(...selectedTables.map((t) => t.y))
    const maxY = Math.max(...selectedTables.map((t) => t.y + t.height))

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const scaleX = (rect.width * 0.8) / contentWidth
      const scaleY = (rect.height * 0.8) / contentHeight
      const newZoom = Math.floor(Math.min(scaleX, scaleY) * 100)
      setZoom(Math.max(25, Math.min(200, newZoom)))

      setPanOffset({
        x: rect.width / 2 - ((minX + maxX) / 2) * (newZoom / 100),
        y: rect.height / 2 - ((minY + maxY) / 2) * (newZoom / 100),
      })
    }

    toast.success("Zoomed to selection")
  }

  const updateTableProperty = <K extends keyof Table>(key: K, value: Table[K]) => {
    if (selectedTableIds.length === 0) return
    const newTables = tables.map((t) => {
      if (!selectedTableIds.includes(t.id)) return t

      const updatedTable = { ...t, [key]: value }
      if (updatedTable.changeStatus !== "added" && updatedTable.changeStatus !== "deleted") {
        updatedTable.changeStatus = "modified" as const
      }
      return updatedTable
    })
    setTables(newTables)
    // Remove old history add
    // addToHistory(newTables)
  }

  const handleSave = () => {
    console.log("[v0] Saving floorplan:", { tables, sections, combos, floorName, floorWidth, floorHeight })
    setLastSaved(new Date())
    toast.success("Floorplan saved!")
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "Never"
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    if (isToday) {
      return `Today at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const handleDiscardDraft = () => {
    if (publishedSnapshot) {
      setTables(publishedSnapshot.tables)
      setSections(publishedSnapshot.sections)
    }
    setPublishedSnapshot(null)
    setIsDraftMode(false)
    setIsDiscardOpen(false)

    clearActionHistory()

    localStorage.removeItem(`floorplan-draft-${params.floorId}`)
    toast.success("Draft discarded")
  }

  useEffect(() => {
    if (isDraftMode && !publishedSnapshot) {
      setPublishedSnapshot({
        tables: tables.map((t) => ({ ...t })),
        sections: sections.map((s) => ({ ...s })),
      })
    }
  }, [isDraftMode, publishedSnapshot, tables, sections])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDraftMode) return // Only in draft mode

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        e.preventDefault()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        redo()
        e.preventDefault()
      }
      if (e.key === "v") {
        setTool("select")
      }
      if (e.key === "t") {
        setTool("add-table")
      }
      if (e.key === "s") {
        setTool("section")
      }
      if (e.key === "h") {
        setTool("pan")
      }
      if (e.key === " " && !isPanning) {
        e.preventDefault()
        setTool("pan")
      }

      // Nudge selected tables with arrow keys
      if (selectedTableIds.length > 0) {
        const nudgeDistance = e.shiftKey ? GRID_SIZE : 1
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          const newTables = tables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, x: t.x - nudgeDistance } : t))
          setTables(newTables)
          // Remove old history add
          // addToHistory(newTables)
        }
        if (e.key === "ArrowRight") {
          e.preventDefault()
          const newTables = tables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, x: t.x + nudgeDistance } : t))
          setTables(newTables)
          // Remove old history add
          // addToHistory(newTables)
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          const newTables = tables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, y: t.y - nudgeDistance } : t))
          setTables(newTables)
          // Remove old history add
          // addToHistory(newTables)
        }
        if (e.key === "ArrowDown") {
          e.preventDefault()
          const newTables = tables.map((t) => (selectedTableIds.includes(t.id) ? { ...t, y: t.y + nudgeDistance } : t))
          setTables(newTables)
          // Remove old history add
          // addToHistory(newTables)
        }
      }

      // Select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault()
        setSelectedTableIds(tables.map((t) => t.id))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setTool("select")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [
    selectedTableIds,
    tables,
    isPanning,
    // Removed addToHistory
    // addToHistory,
    undo,
    redo,
    handleDuplicate,
    handleDeleteTable,
    setTool,
    isSectionDrawing,
    activeResizeHandle,
    resizeStartTable,
    isRotating,
    isDraggingSection,
    selectedSectionId,
    recordAction, // Added
  ])

  const saveDraft = useCallback(() => {
    if (!isDraftMode) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const counts = getChangeCounts()
      const draftData = {
        tables,
        sections,
        combos,
        savedAt: new Date().toISOString(),
        changeCount: {
          added: counts.added,
          modified: counts.modified,
          deleted: counts.deleted,
          total: counts.total,
        },
      }

      localStorage.setItem(`floorplan-draft-${params.floorId}`, JSON.stringify(draftData))
      setLastSavedAt(new Date())
      setLastSaved(new Date())
      setIsSaving(false)
    } catch (error) {
      console.error("[v0] Failed to save draft:", error)
      setSaveError("Failed to save draft")
      setIsSaving(false)
    }
  }, [isDraftMode, tables, sections, combos, params.floorId])

  const handleManualSave = () => {
    saveDraft()
    toast.success("Draft saved")
  }

  const handleRetrySave = () => {
    setSaveError(null)
    saveDraft()
  }

  const handleRestoreDraft = () => {
    if (!pendingRecovery) return

    setTables(pendingRecovery.tables)
    setSections(pendingRecovery.sections)
    setCombos(pendingRecovery.combos || [])
    setIsDraftMode(true)
    setShowRecoveryDialog(false)
    toast.success("Draft restored")
  }

  const handleDiscardRecovery = () => {
    localStorage.removeItem(`floorplan-draft-${params.floorId}`)
    setShowRecoveryDialog(false)
    setPendingRecovery(null)
  }

  useEffect(() => {
    const savedDraft = localStorage.getItem(`floorplan-draft-${params.floorId}`)
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft)
        setPendingRecovery(parsedDraft)
        setShowRecoveryDialog(true)
      } catch (error) {
        console.error("[v0] Failed to parse saved draft:", error)
        localStorage.removeItem(`floorplan-draft-${params.floorId}`)
      }
    }
  }, [params.floorId])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDraftMode) {
        const counts = getChangeCounts()
        if (counts.total > 0) {
          saveDraft()
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isDraftMode, saveDraft])

  const handleViewVersion = (version: Version) => {
    // Save current state before viewing
    setBeforeCompareState({
      tables: tables,
      sections: sections,
      panOffset: panOffset,
      zoom: zoom,
    })

    // Load version data
    setViewingVersion(version)
    setTables(version.tables)
    setSections(version.sections)
    setShowVersionHistory(false)

    toast.success(`Viewing version ${version.versionNumber}`)
  }

  const handleBackToCurrent = () => {
    if (!beforeCompareState) return

    // Restore current state
    setTables(beforeCompareState.tables)
    setSections(beforeCompareState.sections)
    setPanOffset(beforeCompareState.panOffset)
    setZoom(beforeCompareState.zoom)
    setViewingVersion(null)
    setBeforeCompareState(null)

    toast.success("Back to current version")
  }

  // Updated restore version handler with confirmation dialog
  const handleRestoreVersionClick = (version: Version) => {
    setVersionToRestore(version)
    setShowRestoreDialog(true)
    setRestoreNotes("")
  }

  const handleRestoreVersionConfirm = async () => {
    if (!versionToRestore) return

    const currentTables = [...tables]
    const currentSections = [...sections]
    const restoredTables = versionToRestore.tables.map((t) => ({ ...t, changeStatus: "unchanged" as const }))
    const restoredSections = versionToRestore.sections.map((s) => ({ ...s, changeStatus: "unchanged" as const }))

    // Create new version as copy of restored version
    const newVersion: Version = {
      versionNumber: currentVersion + 1,
      publishedAt: new Date().toISOString(),
      publishedBy: "Current User",
      notes: restoreNotes || `Restored from v${versionToRestore.versionNumber}`,
      tables: restoredTables,
      sections: restoredSections,
      changesSummary: {
        added: 0,
        modified: 0,
        deleted: 0,
      },
    }

    setVersions((prev) => [...prev, newVersion])
    setCurrentVersion(newVersion.versionNumber)
    setTables(restoredTables)
    setSections(restoredSections)
    setViewingVersion(null)
    setBeforeCompareState(null)
    setIsDraftMode(false) // Switch to published mode after restore
    setLastSaved(new Date())

    // Clear action history on restore
    clearActionHistory()

    setShowRestoreDialog(false)
    setVersionToRestore(null)
    setShowVersionHistory(false) // Close version history sheet

    toast.success(`Restored to version ${versionToRestore.versionNumber} as v${newVersion.versionNumber}`)
  }

  const getRestoreSummary = () => {
    if (!versionToRestore) return { tablesToRemove: [], tablesToRestore: [], capacityChange: 0 }

    const currentTableIds = new Set(tables.map((t) => t.id))
    const restoredTableIds = new Set(versionToRestore.tables.map((t) => t.id))

    const tablesToRemove = tables.filter((t) => !restoredTableIds.has(t.id))
    const tablesToRestore = versionToRestore.tables.filter((t) => !currentTableIds.has(t.id))

    const currentCapacity = tables.reduce((sum, t) => sum + t.capacity, 0)
    const restoredCapacity = versionToRestore.tables.reduce((sum, t) => sum + t.capacity, 0)
    const capacityChange = restoredCapacity - currentCapacity

    return { tablesToRemove, tablesToRestore, capacityChange }
  }

  const handleCompareVersions = () => {
    if (compareVersionA === null || compareVersionB === null) {
      toast.error("Please select two versions to compare")
      return
    }

    const versionA = versions.find((v) => v.versionNumber === compareVersionA)
    const versionB =
      compareVersionB === currentVersion
        ? {
            versionNumber: currentVersion,
            tables,
            sections,
            publishedAt: new Date().toISOString(),
            publishedBy: "Current",
            notes: "Current version",
            changesSummary: { added: 0, modified: 0, deleted: 0 },
          }
        : versions.find((v) => v.versionNumber === compareVersionB)

    if (!versionA || !versionB) {
      toast.error("Invalid version selection")
      return
    }

    setIsComparingVersions(true)
    setShowCompareDialog(false)
    setShowVersionHistory(false)
  }

  const handleExitComparison = () => {
    setIsComparingVersions(false)
    setCompareVersionA(null)
    setCompareVersionB(null)
  }

  const getVersionDifferences = (vA: Version, vB: Version) => {
    const differences: {
      status: "added" | "modified" | "deleted"
      name: string
      type: "table" | "section"
      changes: string
    }[] = []

    // Find added tables
    vB.tables.forEach((tableB) => {
      if (!vA.tables.find((t) => t.id === tableB.id)) {
        differences.push({
          status: "added",
          name: tableB.name,
          type: "table",
          changes: `(new) ${tableB.capacity} seats, ${tableB.shape}`,
        })
      }
    })

    // Find modified tables
    vA.tables.forEach((tableA) => {
      const tableB = vB.tables.find((t) => t.id === tableA.id)
      if (tableB) {
        const changes: string[] = []
        if (tableA.capacity !== tableB.capacity) changes.push(`Capacity: ${tableA.capacity} → ${tableB.capacity}`)
        if (tableA.shape !== tableB.shape) changes.push(`Shape: ${tableA.shape} → ${tableB.shape}`)
        if (tableA.x !== tableB.x || tableA.y !== tableB.y) changes.push(`Position changed`)

        if (changes.length > 0) {
          differences.push({
            status: "modified",
            name: tableA.name,
            type: "table",
            changes: changes.join(", "),
          })
        }
      }
    })

    // Find deleted tables
    vA.tables.forEach((tableA) => {
      if (!vB.tables.find((t) => t.id === tableA.id)) {
        differences.push({
          status: "deleted",
          name: tableA.name,
          type: "table",
          changes: `(deleted) was ${tableA.capacity} seats`,
        })
      }
    })

    return differences
  }

  const filterVersions = (versions: Version[]) => {
    let filtered = versions

    // Filter by search query
    if (versionSearchQuery) {
      filtered = filtered.filter(
        (v) =>
          v.notes.toLowerCase().includes(versionSearchQuery.toLowerCase()) ||
          v.publishedBy.toLowerCase().includes(versionSearchQuery.toLowerCase()),
      )
    }

    // Filter by days
    if (versionFilterDays !== null) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - versionFilterDays)
      filtered = filtered.filter((v) => new Date(v.publishedAt) >= cutoffDate)
    }

    return filtered
  }

  const handleToggleDraftMode = () => {
    if (isDraftMode) {
      setIsDraftMode(false)
    } else {
      // Check if there are unsaved changes before switching to draft mode
      const counts = getChangeCounts()
      if (counts.total > 0) {
        setIsDraftMode(true)
      } else {
        toast.info("No changes to make into a draft.")
      }
    }
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return "Just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // Modified publish handler to use currentUser name and log activity
  const handlePublishDraft = async () => {
    setIsPublishing(true)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const newVersion: Version = {
      versionNumber: currentVersion + 1,
      publishedAt: new Date().toISOString(),
      publishedBy: currentUser.name,
      notes: publishNotes,
      tables: tables
        .filter((t) => t.changeStatus !== "deleted")
        .map((t) => ({ ...t, changeStatus: "unchanged" as const })),
      sections: sections
        .filter((s) => s.changeStatus !== "deleted")
        .map((s) => ({ ...s, changeStatus: "unchanged" as const })),
      changesSummary: {
        added: tables.filter((t) => t.changeStatus === "added").length,
        modified: tables.filter((t) => t.changeStatus === "modified").length,
        deleted: tables.filter((t) => t.changeStatus === "deleted").length,
      },
    }

    setVersions((prev) => [...prev, newVersion])
    setCurrentVersion(newVersion.versionNumber)

    setTables((prev) =>
      prev.filter((t) => t.changeStatus !== "deleted").map((t) => ({ ...t, changeStatus: "unchanged" as const })),
    )
    setSections((prev) =>
      prev.filter((s) => s.changeStatus !== "deleted").map((s) => ({ ...s, changeStatus: "unchanged" as const })),
    )

    setPublishedSnapshot(null)
    setIsDraftMode(false)
    setLastSaved(new Date())

    clearActionHistory()

    localStorage.removeItem(`floorplan-draft-${params.floorId}`)

    setIsPublishing(false)
    setShowPublishModal(false) // Close the publish modal
    setShowPublishSuccess(true)
    setPublishNotes("")
    setNotifyStaff(false)

    logActivity("Published Draft", `Published draft as version ${newVersion.versionNumber}`)

    toast.success(`Published as version ${newVersion.versionNumber}!`)
  }

  const logActivity = useCallback(
    (action: string, details: string, changes?: any) => {
      const log: ActivityLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: currentUser,
        action,
        details,
        changes,
        ipAddress: "192.168.1.1", // In real app, get from request
      }
      setActivityLogs((prev) => [log, ...prev])
    },
    [currentUser],
  )

  const checkPermission = useCallback(
    (permissionKey: keyof Permission, actionName: string): boolean => {
      const hasPermission = permissions[permissionKey]
      if (!hasPermission) {
        const roleNames: Record<UserRole, string> = {
          owner: "Owner",
          manager: "Manager",
          staff: "Staff",
          viewer: "Viewer",
        }

        let requiredRoles = ""
        if (permissionKey === "canPublish" || permissionKey === "canDelete") {
          requiredRoles = "Manager or Owner"
        } else if (permissionKey === "canManageUsers" || permissionKey === "canChangeSettings") {
          requiredRoles = "Owner"
        } else {
          requiredRoles = "Manager or Owner"
        }

        setPermissionMessage(
          `You don't have permission to ${actionName}.\n\nYour role: ${roleNames[currentUser.role]}\nRequired: ${requiredRoles}`,
        )
        setShowPermissionDialog(true)
        return false
      }
      return true
    },
    [permissions, currentUser.role],
  )

  // The handlePublishClick function is intentionally duplicated here to be able to demonstrate conditional logic for staff vs other roles
  // In a real application, this would be refactored into a single function with conditional checks inside.
  // This duplicate is removed in the final code.

  useEffect(() => {
    if (isDraftMode) {
      const counts = getChangeCounts()
      if (counts.total === 0) return

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new debounce timer (2 seconds after last edit)
      debounceTimerRef.current = setTimeout(() => {
        saveDraft()
      }, 2000)

      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
      }
    }
  }, [isDraftMode, tables, sections, combos, saveDraft]) // Added dependencies

  useEffect(() => {
    if (isDraftMode) {
      saveTimerRef.current = setInterval(() => {
        const counts = getChangeCounts()
        if (counts.total > 0) {
          saveDraft()
        }
      }, 120000) // 2 minutes

      return () => {
        if (saveTimerRef.current) {
          clearInterval(saveTimerRef.current)
        }
      }
    }
  }, [isDraftMode, saveDraft]) // Added dependencies

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Navigation Bar */}
      <div className="border-b bg-muted/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <NextLink
              href={`/stores/${params.storeId}/floorplan`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Floorplans
            </NextLink>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-semibold">{floorName}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
                </Badge>
                <span>
                  {tables.length} tables • {tables.reduce((sum, t) => sum + t.capacity, 0)} seats
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {permissions.canViewLogs && (
              <Button variant="ghost" size="sm" onClick={() => setShowActivityLogs(true)}>
                <FileText className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowNotifications(true)} className="relative">
              <Bell className="w-4 h-4" />
              {notifications.filter((n) => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Button>
            {permissions.canChangeSettings && (
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)}>
              <HelpCircle className="w-4 h-4" />
            </Button>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="canvas">Canvas</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {isDraftMode ? (
        currentApprovalRequest?.status === "pending" ? (
          <Alert className="rounded-none border-x-0 border-t-0 bg-blue-50 border-blue-200">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-blue-900">
                  PENDING APPROVAL - Waiting for {currentApprovalRequest.approver?.name || "manager"} review
                </span>
                <span className="text-xs text-blue-700">
                  Requested by: You ({currentUser.name}) • Request ID: {currentApprovalRequest.id} • Requested:{" "}
                  {formatDate(new Date(currentApprovalRequest.requestedAt))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentApprovalRequest(null)
                    toast.success("Approval request withdrawn")
                  }}
                  className="h-auto py-1"
                >
                  Withdraw Request
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentApprovalRequest.lockDraft}
                  onClick={() => toast.info("Draft is locked until approval")}
                  className="h-auto py-1"
                >
                  {currentApprovalRequest.lockDraft ? "Draft Locked" : "Edit Draft"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="rounded-none border-x-0 border-t-0 bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-yellow-900">
                  DRAFT MODE • {(() => {
                    const counts = getChangeCounts()
                    if (counts.total === 0) return "No changes"
                    const parts = []
                    if (counts.added > 0) parts.push(`${counts.added} added`)
                    if (counts.modified > 0) parts.push(`${counts.modified} modified`)
                    if (counts.deleted > 0) parts.push(`${counts.deleted} deleted`)
                    return `${counts.total} change${counts.total !== 1 ? "s" : ""} (${parts.join(", ")})`
                  })()}
                </span>
                <span className="text-yellow-700">•</span>
                <span className="text-yellow-700">Last saved: {formatDate(lastSaved)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePublishClick}
                  disabled={getChangeCounts().total === 0 || isValidating}
                  className="h-auto py-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Validating...
                    </>
                  ) : permissions.canPublish ? (
                    <>✨ Publish Changes</>
                  ) : (
                    <>
                      <Lock className="h-3 w-3 mr-1" />
                      Request Publish Approval
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReviewOpen(true)}
                  className="h-auto py-1 text-yellow-900 hover:text-yellow-950 hover:bg-yellow-100"
                >
                  Review Changes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDiscardOpen(true)}
                  className="h-auto py-1 text-yellow-900 hover:text-yellow-950 hover:bg-yellow-100"
                >
                  Discard Draft
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDraftMode(false)}
                  className="h-auto py-1 text-yellow-900 hover:text-yellow-950 hover:bg-yellow-100"
                >
                  Switch to Published View
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )
      ) : (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <div className="font-medium text-green-900">Published (v{currentVersion})</div>
              <div className="text-xs text-green-700">
                Last published {formatDate(lastSaved)} • {tables.length} tables •{" "}
                {tables.reduce((sum, t) => sum + t.capacity, 0)} seats
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowVersionHistory(true)}>
              <History className="h-4 w-4 mr-2" />
              Version History
            </Button>
            <Button variant="default" size="sm" onClick={handleToggleDraftMode} disabled={!permissions.canEditDrafts}>
              <Edit className="h-4 w-4 mr-2" />
              Enter Draft Mode
            </Button>
          </div>
        </div>
      )}

      {viewMode === "canvas" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Tools, Templates & Sections */}
          <div className="w-64 border-r bg-muted/30 overflow-y-auto">
            <Tabs defaultValue="tools" className="h-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="tools">Tools</TabsTrigger>
                <TabsTrigger value="sections">Sections</TabsTrigger>
              </TabsList>

              <TabsContent value="tools" className="p-4 space-y-6 mt-0">
                {/* Tools */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">TOOLS</h3>
                  <div className="space-y-2">
                    <Button
                      variant={tool === "select" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setTool("select")}
                    >
                      <MousePointerIcon className="w-4 h-4 mr-2" />
                      Select Tool
                      {tool === "select" && <Badge className="ml-auto text-xs">Active</Badge>}
                    </Button>
                    <Button
                      variant={tool === "add-table" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setTool("add-table")}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Table
                    </Button>
                    <Button
                      variant={tool === "section" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setTool("section")}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Add Section
                      {tool === "section" && <Badge className="ml-auto text-xs">Active</Badge>}
                    </Button>
                    <Button
                      variant={tool === "pan" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setTool("pan")}
                    >
                      <Hand className="w-4 h-4 mr-2" />
                      Pan Tool
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Keyboard Shortcuts */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">KEYBOARD SHORTCUTS</h3>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>V</span>
                      <span>Select tool</span>
                    </div>
                    <div className="flex justify-between">
                      <span>T</span>
                      <span>Add table</span>
                    </div>
                    <div className="flex justify-between">
                      <span>S</span>
                      <span>Add section</span>
                    </div>
                    <div className="flex justify-between">
                      <span>H</span>
                      <span>Pan tool</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Space</span>
                      <span>Temp pan</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delete</span>
                      <span>Remove</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cmd+D</span>
                      <span>Duplicate</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Arrows</span>
                      <span>Nudge 1px</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shift+Arrows</span>
                      <span>Nudge grid</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Table Templates */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">TABLE TEMPLATES</h3>
                  {tool === "add-table" ? (
                    <div className="space-y-2">
                      {TABLE_TEMPLATES.map((template, idx) => (
                        <Card
                          key={idx}
                          className={cn(
                            "p-3 cursor-pointer hover:border-primary transition-colors",
                            selectedTemplate === template && "border-primary bg-primary/5",
                          )}
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 border rounded flex items-center justify-center bg-background">
                              {template.shape === "rectangle" && <Square className="w-6 h-6" />}
                              {template.shape === "circle" && <Circle className="w-6 h-6" />}
                              {template.shape === "square" && <Square className="w-6 h-6" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{template.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {template.width}×{template.height}px
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                Capacity: {template.capacity}
                              </div>
                            </div>
                          </div>
                          {selectedTemplate === template && (
                            <Button size="sm" className="w-full mt-2">
                              Selected
                            </Button>
                          )}
                        </Card>
                      ))}
                    </div>
                  ) : tool === "section" ? (
                    <p className="text-xs text-muted-foreground">Click and drag on canvas to draw a section area</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Select Add Table tool first</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="sections" className="p-4 space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">SECTIONS</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTool("section")}
                    disabled={!permissions.canEditDrafts}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>

                {sections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No sections yet. Click Add Section to create one.</p>
                ) : (
                  <div className="space-y-3">
                    {sections
                      .sort((a, b) => a.order - b.order)
                      .map((section) => {
                        const tablesInSection = tables.filter((t) => t.sectionId === section.id)
                        const totalCapacity = tablesInSection.reduce((sum, t) => sum + t.capacity, 0)

                        return (
                          <Card key={section.id} className="p-3">
                            <div className="flex items-start gap-2">
                              <div
                                className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                                style={{ backgroundColor: section.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{section.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {tablesInSection.length} tables • {totalCapacity} seats
                                </div>
                                {section.staff && (
                                  <div className="text-xs text-muted-foreground">Staff: {section.staff}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 mt-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => {
                                  setSelectedSectionId(section.id)
                                  setSelectedTableIds([])
                                }}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => toggleSectionVisibility(section.id)}
                              >
                                {section.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 px-2">
                                    <MoreVertical className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedSectionId(section.id)
                                      setSelectedTableIds([])
                                    }}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Properties
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleSectionVisibility(section.id)}>
                                    {section.visible ? (
                                      <>
                                        <EyeOff className="w-4 h-4 mr-2" />
                                        Hide Section
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-4 h-4 mr-2" />
                                        Show Section
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => deleteSection(section.id)}
                                    disabled={!permissions.canDelete}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Section
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </Card>
                        )
                      })}
                  </div>
                )}

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">COMBINATIONS</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (selectedTableIds.length < 2) {
                          toast.error("Select at least 2 tables")
                        } else {
                          setShowComboDialog(true)
                        }
                      }}
                    >
                      <Link className="w-4 h-4 mr-1" />
                      Create
                    </Button>
                  </div>

                  {combos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No combos yet. Select 2+ tables and click Create Combo.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {combos.map((combo) => (
                        <Card key={combo.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-sm">{combo.name}</div>
                              <div className="text-xs text-muted-foreground">{combo.totalCapacity} total seats</div>
                              <div className="text-xs text-muted-foreground">
                                Tables: {combo.tableIds.map((id) => tables.find((t) => t.id === id)?.name).join(", ")}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => deleteCombo(combo.id)}
                            >
                              <Unlink className="w-3 h-3" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold mb-3">TOTAL CAPACITY</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tables:</span>
                      <span className="font-medium">{tables.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Seats:</span>
                      <span className="font-medium">{tables.reduce((sum, t) => sum + t.capacity, 0)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Canvas Container */}
            <div
              ref={canvasRef}
              className={cn(
                "flex-1 overflow-auto bg-muted/10 relative",
                tool === "add-table" && "cursor-crosshair",
                tool === "pan" && "cursor-move",
                tool === "section" && "cursor-crosshair",
                isPanning && "cursor-grabbing",
              )}
              onMouseDown={handleCanvasMouseDown}
              onClick={handleCanvasClick}
              onContextMenu={handleContextMenu}
              style={{
                cursor:
                  tool === "select"
                    ? "default"
                    : tool === "add-table"
                      ? "crosshair"
                      : tool === "pan"
                        ? isPanning
                          ? "grabbing"
                          : "grab"
                        : "crosshair",
              }}
            >
              {!isDraftMode && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
                  <div className="text-6xl font-bold text-muted-foreground/10 rotate-[-30deg] select-none">
                    READ ONLY
                  </div>
                </div>
              )}

              <div
                className="relative"
                style={{
                  width: `${floorWidth * (zoom / 100)}px`,
                  height: `${floorHeight * (zoom / 100)}px`,
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                  margin: "40px",
                }}
              >
                {/* Grid */}
                {showGrid && (
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    width="100%"
                    height="100%"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <pattern
                        id="grid"
                        width={GRID_SIZE * (zoom / 100)}
                        height={GRID_SIZE * (zoom / 100)}
                        patternUnits="userSpaceOnUse"
                      >
                        <circle
                          cx={(GRID_SIZE * (zoom / 100)) / 2}
                          cy={(GRID_SIZE * (zoom / 100)) / 2}
                          r="1.5"
                          fill="#E5E7EB"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                )}

                {sections
                  .filter((s) => s.visible)
                  .map((section) => {
                    const isSelected = selectedSectionId === section.id
                    const scale = zoom / 100

                    return (
                      <div
                        key={section.id}
                        className={cn(
                          "absolute border-2 border-dashed select-none", // Add select-none to prevent text selection
                          isSelected
                            ? "border-primary cursor-move"
                            : "border-border cursor-pointer hover:border-primary/50",
                        )}
                        style={{
                          left: section.x * scale,
                          top: section.y * scale,
                          width: section.width * scale,
                          height: section.height * scale,
                          backgroundColor: `${section.color}1A`,
                          borderColor: section.color,
                          zIndex: 1,
                        }}
                        onClick={(e) => handleSectionClick(e, section.id)}
                        onMouseDown={(e) => handleSectionDragStart(e, section.id)} // Add drag handler for sections
                      >
                        <div
                          className="absolute top-0 left-0 px-2 py-1 text-white text-xs font-medium rounded-br pointer-events-none" // Add pointer-events-none to label
                          style={{ backgroundColor: section.color }}
                        >
                          {section.name}
                        </div>
                      </div>
                    )
                  })}

                {isSectionDrawing && (
                  <div
                    className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
                    style={{
                      left: Math.min(sectionDrawStart.x, sectionDrawEnd.x) * (zoom / 100),
                      top: Math.min(sectionDrawStart.y, sectionDrawEnd.y) * (zoom / 100),
                      width: Math.abs(sectionDrawEnd.x - sectionDrawStart.x) * (zoom / 100),
                      height: Math.abs(sectionDrawEnd.y - sectionDrawStart.y) * (zoom / 100),
                      zIndex: 1000,
                    }}
                  >
                    <div className="absolute top-0 left-0 px-2 py-1 bg-primary text-white text-xs font-medium rounded-br">
                      New Section
                    </div>
                  </div>
                )}

                {alignmentGuides.map((guide, idx) => (
                  <div
                    key={idx}
                    className="absolute pointer-events-none"
                    style={{
                      ...(guide.type === "vertical"
                        ? {
                            left: guide.position * (zoom / 100),
                            top: 0,
                            bottom: 0,
                            width: 1,
                          }
                        : {
                            top: guide.position * (zoom / 100),
                            left: 0,
                            right: 0,
                            height: 1,
                          }),
                      backgroundColor: "#3B82F6",
                      zIndex: 100,
                    }}
                  />
                ))}

                {isMarqueeSelecting && (
                  <div
                    className="absolute border-2 border-primary border-dashed bg-primary/10 pointer-events-none"
                    style={{
                      left: Math.min(marqueeStart.x, marqueeEnd.x) * (zoom / 100),
                      top: Math.min(marqueeStart.y, marqueeEnd.y) * (zoom / 100),
                      width: Math.abs(marqueeEnd.x - marqueeStart.x) * (zoom / 100),
                      height: Math.abs(marqueeEnd.y - marqueeStart.y) * (zoom / 100),
                      zIndex: 1000,
                    }}
                  />
                )}

                {combos.map((combo) => {
                  const comboTables = tables.filter((t) => combo.tableIds.includes(t.id))
                  if (comboTables.length === 0) return null

                  const minX = Math.min(...comboTables.map((t) => t.x))
                  const maxX = Math.max(...comboTables.map((t) => t.x + t.width))
                  const minY = Math.min(...comboTables.map((t) => t.y))
                  const maxY = Math.max(...comboTables.map((t) => t.y + t.height))
                  const scale = zoom / 100

                  return (
                    <div
                      key={combo.id}
                      className="absolute border-4 border-purple-500 rounded-lg pointer-events-none"
                      style={{
                        left: (minX - 10) * scale,
                        top: (minY - 10) * scale,
                        width: (maxX - minX + 20) * scale,
                        height: (maxY - minY + 20) * scale,
                        zIndex: 2,
                      }}
                    >
                      <div className="absolute -top-6 left-0 px-2 py-1 bg-purple-500 text-white text-xs font-medium rounded">
                        {combo.name}
                      </div>
                    </div>
                  )
                })}

                {/* Tables */}
                {tables.map((table) => {
                  const isSelected = selectedTableIds.includes(table.id)
                  const tableSection = sections.find((s) => s.id === table.sectionId)

                  return (
                    <div
                      key={table.id}
                      className={cn(
                        "absolute group",
                        !isDraftMode && "pointer-events-none",
                        table.changeStatus === "deleted" && "opacity-50",
                        pulsingTableId === table.id && "animate-pulse",
                      )}
                      style={{
                        left: table.x * (zoom / 100),
                        top: table.y * (zoom / 100),
                        cursor: isDraftMode ? (isSelected ? "move" : "pointer") : "not-allowed",
                        ...(pulsingTableId === table.id && {
                          animation: "pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) 3",
                        }),
                      }}
                      onMouseDown={(e) => {
                        if (!isDraftMode) return
                        handleTableMouseDown(e, table.id)
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (table.changeStatus === "deleted") return
                        setSelectedTableIds([table.id])
                        toast.info(`Editing ${table.name}`)
                      }}
                    >
                      <div
                        className={cn(
                          "bg-white shadow-sm transition-all select-none flex items-center justify-center text-center",
                          isSelected && "border-4 border-primary shadow-lg",
                          !isSelected && "border",
                          table.changeStatus === "added" && "border-green-500 border-2",
                          table.changeStatus === "modified" && "border-blue-500 border-2",
                          table.changeStatus === "deleted" && "border-gray-400 border-dashed opacity-50",
                          !table.changeStatus || table.changeStatus === "unchanged"
                            ? "border-border hover:border-primary/50"
                            : "",
                        )}
                        style={{
                          width: table.width,
                          height: table.height,
                          borderRadius: table.shape === "circle" ? "50%" : table.shape === "square" ? "8px" : "4px",
                          transform: `rotate(${table.rotation}deg)`,
                          transformOrigin: "center",
                          zIndex: 10,
                          userSelect: "none", // Explicitly prevent text selection
                          WebkitUserSelect: "none", // For Safari
                        }}
                      >
                        <ChangeStatusBadge status={table.changeStatus} />

                        <div className="pointer-events-none">
                          <div
                            className={cn(
                              "font-semibold",
                              isSelected && "font-bold",
                              table.changeStatus === "deleted" && "line-through",
                            )}
                            style={{ fontSize: 14 }}
                          >
                            {table.name}
                          </div>
                          <div
                            className={cn("text-muted-foreground", table.changeStatus === "deleted" && "line-through")}
                            style={{ fontSize: 12 }}
                          >
                            {table.capacity} seats
                          </div>
                        </div>

                        {isSelected && selectedTableIds.length === 1 && (
                          <>
                            {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => {
                              const handlePositions = {
                                nw: { left: 0, top: 0, cursor: "nw-resize" },
                                n: { left: "50%", top: 0, transform: "translateX(-50%)", cursor: "n-resize" },
                                ne: { right: 0, top: 0, cursor: "ne-resize" },
                                e: { right: 0, top: "50%", transform: "translateY(-50%)", cursor: "e-resize" },
                                se: { right: 0, bottom: 0, cursor: "se-resize" },
                                s: { left: "50%", bottom: 0, transform: "translateX(-50%)", cursor: "s-resize" },
                                sw: { left: 0, bottom: 0, cursor: "sw-resize" },
                                w: { left: 0, top: "50%", transform: "translateY(-50%)", cursor: "w-resize" },
                              }

                              return (
                                <div
                                  key={handle}
                                  className="absolute w-2 h-2 bg-primary border border-white rounded-full"
                                  style={{
                                    ...handlePositions[handle as ResizeHandle],
                                    marginLeft: -4,
                                    marginTop: -4,
                                    zIndex: 10,
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    setActiveResizeHandle(handle as ResizeHandle)
                                    setResizeStartTable(table)
                                    setDragStart({ x: e.clientX, y: e.clientY })
                                  }}
                                />
                              )
                            })}

                            <div
                              className="absolute w-2 h-2 bg-primary border border-white rounded-full cursor-grab"
                              style={{
                                left: "50%",
                                top: -40,
                                transform: "translateX(-50%)",
                                marginLeft: -4,
                                marginTop: -4,
                                zIndex: 10,
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                setIsRotating(true)
                                setRotationStart(table.rotation)
                              }}
                            />
                            <div
                              className="absolute w-0.5 bg-primary pointer-events-none"
                              style={{
                                left: "50%",
                                top: 0,
                                height: 40,
                                transform: "translate(-50%, -100%)",
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* End Canvas */}
          </div>

          {/* Right Sidebar - Properties */}
          <div className="w-80 border-l bg-muted/30 overflow-y-auto p-4 space-y-6">
            {selectedTable ? (
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3">SELECTED TABLE</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="table-name" className="text-xs">
                        Name *
                      </Label>
                      <Input
                        id="table-name"
                        value={selectedTable.name}
                        onChange={(e) => updateTableProperty("name", e.target.value)}
                        className="mt-1"
                        disabled={!permissions.canEditDrafts}
                      />
                    </div>

                    <div>
                      <Label htmlFor="capacity" className="text-xs">
                        Capacity
                      </Label>
                      <Input
                        id="capacity"
                        type="number"
                        min="1"
                        max="20"
                        value={selectedTable.capacity}
                        onChange={(e) => updateTableProperty("capacity", Number(e.target.value))}
                        className="mt-1"
                        disabled={!permissions.canEditDrafts}
                      />
                    </div>

                    <div>
                      <Label htmlFor="section" className="text-xs">
                        Section
                      </Label>
                      <Select
                        value={selectedTable.sectionId || "none"}
                        onValueChange={(value) =>
                          updateTableProperty("sectionId", value === "none" ? undefined : value)
                        }
                        disabled={!permissions.canEditDrafts}
                      >
                        <SelectTrigger id="section" className="mt-1">
                          <SelectValue placeholder="No section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No section</SelectItem>
                          {sections.map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: section.color }} />
                                {section.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Shape</Label>
                      <RadioGroup
                        value={selectedTable.shape}
                        onValueChange={(value) => updateTableProperty("shape", value as TableShape)}
                        className="mt-2 space-y-2"
                        disabled={!permissions.canEditDrafts}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="rectangle" id="rect" />
                          <Label htmlFor="rect" className="cursor-pointer">
                            Rectangle
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="circle" id="circle" />
                          <Label htmlFor="circle" className="cursor-pointer">
                            Circle
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="square" id="square" />
                          <Label htmlFor="square" className="cursor-pointer">
                            Square
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="x" className="text-xs">
                          Position X
                        </Label>
                        <Input
                          id="x"
                          type="number"
                          value={selectedTable.x}
                          onChange={(e) => updateTableProperty("x", Number(e.target.value))}
                          className="mt-1"
                          disabled={!permissions.canEditDrafts}
                        />
                      </div>
                      <div>
                        <Label htmlFor="y" className="text-xs">
                          Position Y
                        </Label>
                        <Input
                          id="y"
                          type="number"
                          value={selectedTable.y}
                          onChange={(e) => updateTableProperty("y", Number(e.target.value))}
                          className="mt-1"
                          disabled={!permissions.canEditDrafts}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={lockAspectRatio}
                        onCheckedChange={setLockAspectRatio}
                        id="aspect"
                        disabled={!permissions.canEditDrafts}
                      />
                      <Label htmlFor="aspect" className="text-sm cursor-pointer">
                        Lock aspect ratio
                      </Label>
                    </div>

                    <div>
                      <Label htmlFor="rotation" className="text-xs">
                        Rotation
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="rotation"
                          type="number"
                          min="0"
                          max="360"
                          value={Math.round(selectedTable.rotation)}
                          onChange={(e) => updateTableProperty("rotation", Number(e.target.value))}
                          disabled={!permissions.canEditDrafts}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateTableProperty("rotation", 0)}
                          title="Reset Rotation"
                          disabled={!permissions.canEditDrafts}
                        >
                          <RotateCw className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs bg-transparent"
                          onClick={() => updateTableProperty("rotation", 0)}
                          disabled={!permissions.canEditDrafts}
                        >
                          0°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs bg-transparent"
                          onClick={() => updateTableProperty("rotation", 45)}
                          disabled={!permissions.canEditDrafts}
                        >
                          45°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs bg-transparent"
                          onClick={() => updateTableProperty("rotation", 90)}
                          disabled={!permissions.canEditDrafts}
                        >
                          90°
                        </Button>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      onClick={handleDuplicate}
                      disabled={!permissions.canEditDrafts}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicate Table
                    </Button>

                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleDeleteTable}
                      disabled={!permissions.canDelete}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Table
                    </Button>
                  </div>
                </div>
              </>
            ) : selectedTableIds.length > 1 ? (
              /* Added multi-select properties panel */
              <div>
                <h3 className="text-sm font-semibold mb-3">MULTIPLE TABLES SELECTED</h3>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">{selectedTableIds.length} tables selected</div>

                  <Separator />

                  <div>
                    <h4 className="text-xs font-semibold mb-2">BULK ACTIONS</h4>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start text-sm bg-transparent"
                        onClick={handleDuplicate}
                        disabled={!permissions.canEditDrafts}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate All
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-sm bg-transparent"
                        onClick={handleZoomToSelection}
                      >
                        <Maximize2 className="w-4 h-4 mr-2" />
                        Zoom to Selection
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-sm bg-transparent"
                        onClick={() => {
                          setShowComboDialog(true)
                          setContextMenu(null)
                        }}
                        disabled={!permissions.canEditDrafts}
                      >
                        <Link className="w-4 h-4 mr-2" />
                        Create Combo
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-xs font-semibold mb-2">ALIGNMENT</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAlign("left")}
                        title="Align Left"
                        disabled={!permissions.canEditDrafts}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAlign("center")}
                        title="Align Center"
                        disabled={!permissions.canEditDrafts}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAlign("right")}
                        title="Align Right"
                        disabled={!permissions.canEditDrafts}
                      >
                        <AlignRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAlign("top")}
                        title="Align Top"
                        disabled={!permissions.canEditDrafts}
                      >
                        <AlignLeft className="w-4 h-4 rotate-90" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAlign("middle")}
                        title="Align Middle"
                        disabled={!permissions.canEditDrafts}
                      >
                        <AlignCenter className="w-4 h-4 rotate-90" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAlign("bottom")}
                        title="Align Bottom"
                        disabled={!permissions.canEditDrafts}
                      >
                        <AlignRight className="w-4 h-4 rotate-90" />
                      </Button>
                    </div>
                  </div>

                  {selectedTableIds.length >= 3 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-xs font-semibold mb-2">DISTRIBUTE</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDistribute("horizontal")}
                            className="text-xs"
                            disabled={!permissions.canEditDrafts}
                          >
                            Horizontally
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDistribute("vertical")}
                            className="text-xs"
                            disabled={!permissions.canEditDrafts}
                          >
                            Vertically
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div>
                    <h4 className="text-xs font-semibold mb-2">SELECTION INFO</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tables:</span>
                        <span>{selectedTables.map((t) => t.name).join(", ")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total capacity:</span>
                        <span>{selectedTables.reduce((sum, t) => sum + t.capacity, 0)} seats</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleDeleteTable}
                    disabled={!permissions.canDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All Selected
                  </Button>
                </div>
              </div>
            ) : selectedSection ? (
              /* Added section properties panel */
              <div>
                <h3 className="text-sm font-semibold mb-3">SECTION PROPERTIES</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="section-name" className="text-xs">
                      Section Name *
                    </Label>
                    <Input
                      id="section-name"
                      value={selectedSection.name}
                      onChange={(e) => {
                        setSections(
                          sections.map((s) => (s.id === selectedSection.id ? { ...s, name: e.target.value } : s)),
                        )
                      }}
                      className="mt-1"
                      disabled={!permissions.canEditDrafts}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Color</Label>
                    <div className="flex gap-2 mt-2">
                      {SECTION_COLORS.map((color) => (
                        <button
                          key={color.value}
                          className={cn(
                            "w-8 h-8 rounded border-2 transition-all",
                            selectedSection.color === color.value
                              ? "border-foreground scale-110"
                              : "border-transparent",
                          )}
                          style={{ backgroundColor: color.value }}
                          onClick={() => {
                            setSections(
                              sections.map((s) => (s.id === selectedSection.id ? { ...s, color: color.value } : s)),
                            )
                          }}
                          title={color.name}
                          disabled={!permissions.canEditDrafts}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="section-staff" className="text-xs">
                      Default Staff
                    </Label>
                    <Select
                      value={selectedSection.staff || "none"}
                      onValueChange={(value) => {
                        setSections(
                          sections.map((s) =>
                            s.id === selectedSection.id ? { ...s, staff: value === "none" ? undefined : value } : s,
                          ),
                        )
                      }}
                      disabled={!permissions.canEditDrafts}
                    >
                      <SelectTrigger id="section-staff" className="mt-1">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {STAFF_MEMBERS.map((staff) => (
                          <SelectItem key={staff} value={staff}>
                            {staff}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="section-description" className="text-xs">
                      Description (Optional)
                    </Label>
                    <Textarea
                      id="section-description"
                      value={selectedSection.description || ""}
                      onChange={(e) => {
                        setSections(
                          sections.map((s) =>
                            s.id === selectedSection.id ? { ...s, description: e.target.value } : s,
                          ),
                        )
                      }}
                      className="mt-1"
                      rows={3}
                      disabled={!permissions.canEditDrafts}
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-xs">Area & Capacity</Label>
                    <div className="space-y-2 text-sm mt-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Area:</span>
                        <span>
                          {selectedSection.width} × {selectedSection.height}px
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tables:</span>
                        <span>{tables.filter((t) => t.sectionId === selectedSection.id).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total capacity:</span>
                        <span>
                          {tables
                            .filter((t) => t.sectionId === selectedSection.id)
                            .reduce((sum, t) => sum + t.capacity, 0)}{" "}
                          seats
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() => toggleSectionVisibility(selectedSection.id)}
                    disabled={!permissions.canEditDrafts}
                  >
                    {selectedSection.visible ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Hide Section
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Show Section
                      </>
                    )}
                  </Button>

                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => deleteSection(selectedSection.id)}
                    disabled={!permissions.canDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Section
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3">FLOOR PROPERTIES</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="floor-name" className="text-xs">
                        Floor Name *
                      </Label>
                      <Input
                        id="floor-name"
                        value={floorName}
                        onChange={(e) => setFloorName(e.target.value)}
                        className="mt-1"
                        disabled={!permissions.canEditDrafts}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="floor-width" className="text-xs">
                          Width (px)
                        </Label>
                        <Input
                          id="floor-width"
                          type="number"
                          value={floorWidth}
                          onChange={(e) => setFloorWidth(Number(e.target.value))}
                          className="mt-1"
                          disabled={!permissions.canEditDrafts}
                        />
                      </div>
                      <div>
                        <Label htmlFor="floor-height" className="text-xs">
                          Height (px)
                        </Label>
                        <Input
                          id="floor-height"
                          type="number"
                          value={floorHeight}
                          onChange={(e) => setFloorHeight(Number(e.target.value))}
                          className="mt-1"
                          disabled={!permissions.canEditDrafts}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="grid-size" className="text-xs">
                        Grid Size (px)
                      </Label>
                      <Input id="grid-size" type="number" value={GRID_SIZE} disabled className="mt-1" />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={showGrid}
                        onCheckedChange={setShowGrid}
                        id="snap-grid"
                        disabled={!permissions.canEditDrafts}
                      />
                      <Label htmlFor="snap-grid" className="text-sm cursor-pointer">
                        Snap to grid
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold mb-3">STATISTICS</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Tables:</span>
                      <span className="font-medium">{tables.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Capacity:</span>
                      <span className="font-medium">{tables.reduce((sum, t) => sum + t.capacity, 0)} seats</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sections:</span>
                      <span className="font-medium">{sections.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Combos:</span>
                      <span className="font-medium">{combos.length}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* List View - new implementation */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-4">
              {/* Header with Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Tables ({filteredAndSortedTables.length})</h2>
                  <p className="text-sm text-muted-foreground">
                    Total capacity: {filteredAndSortedTables.reduce((sum, t) => sum + t.capacity, 0)} seats
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!permissions.canExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info("CSV import coming soon")}
                    disabled={!permissions.canImport}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button size="sm" onClick={() => setViewMode("canvas")} disabled={!permissions.canEditDrafts}>
                    <Plus className="w-4 h-4 mr-2" />
                    Quick Add Table
                  </Button>
                </div>
              </div>

              {/* Search and Filters */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search tables by name, capacity, tags..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleClearFilters}>
                      <Filter className="w-4 h-4 mr-2" />
                      Clear Filters
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <Select value={filterSection} onValueChange={setFilterSection}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterCapacity} onValueChange={setFilterCapacity}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Capacities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Capacities</SelectItem>
                        <SelectItem value="2">2 seats</SelectItem>
                        <SelectItem value="4">4 seats</SelectItem>
                        <SelectItem value="6">6 seats</SelectItem>
                        <SelectItem value="8">8 seats</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterShape} onValueChange={setFilterShape}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Shapes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Shapes</SelectItem>
                        <SelectItem value="rectangle">Rectangle</SelectItem>
                        <SelectItem value="circle">Circle</SelectItem>
                        <SelectItem value="square">Square</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterTags} onValueChange={setFilterTags}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Tags" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tags</SelectItem>
                        {COMMON_TAGS.map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Bulk Actions Bar */}
              {selectedTableIds.length > 0 && (
                <Card className="p-3 bg-primary/5 border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedTableIds.length === filteredAndSortedTables.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTableIds(filteredAndSortedTables.map((t) => t.id))
                          } else {
                            setSelectedTableIds([])
                          }
                        }}
                        disabled={!permissions.canEditDrafts}
                      />
                      <span className="text-sm font-medium">{selectedTableIds.length} selected</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDuplicate}
                        disabled={!permissions.canEditDrafts}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </Button>
                      {selectedTableIds.length >= 2 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={!permissions.canEditDrafts}>
                              <AlignLeft className="w-4 h-4 mr-2" />
                              Align
                              <ChevronDown className="w-4 h-4 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleAlign("left")} disabled={!permissions.canEditDrafts}>
                              Align Left
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAlign("center")}
                              disabled={!permissions.canEditDrafts}
                            >
                              Align Center
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAlign("right")}
                              disabled={!permissions.canEditDrafts}
                            >
                              Align Right
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleAlign("top")} disabled={!permissions.canEditDrafts}>
                              Align Top
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAlign("middle")}
                              disabled={!permissions.canEditDrafts}
                            >
                              Align Middle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAlign("bottom")}
                              disabled={!permissions.canEditDrafts}
                            >
                              Align Bottom
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteTable}
                        disabled={!permissions.canDelete}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Table List */}
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="w-12 p-3">
                          <Checkbox
                            checked={
                              selectedTableIds.length === filteredAndSortedTables.length &&
                              filteredAndSortedTables.length > 0
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTableIds(filteredAndSortedTables.map((t) => t.id))
                              } else {
                                setSelectedTableIds([])
                              }
                            }}
                            disabled={!permissions.canEditDrafts}
                          />
                        </th>
                        <th
                          className="text-left p-3 cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center gap-1">
                            Name
                            {sortColumn === "name" &&
                              (sortDirection === "asc" ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="text-left p-3 cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("capacity")}
                        >
                          <div className="flex items-center gap-1">
                            Capacity
                            {sortColumn === "capacity" &&
                              (sortDirection === "asc" ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="text-left p-3 cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("shape")}
                        >
                          <div className="flex items-center gap-1">
                            Shape
                            {sortColumn === "shape" &&
                              (sortDirection === "asc" ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="text-left p-3 cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("section")}
                        >
                          <div className="flex items-center gap-1">
                            Section
                            {sortColumn === "section" &&
                              (sortDirection === "asc" ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="text-left p-3 cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("position")}
                        >
                          <div className="flex items-center gap-1">
                            Position
                            {sortColumn === "position" &&
                              (sortDirection === "asc" ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              ))}
                          </div>
                        </th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Tags</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedTables.map((table) => {
                        const section = sections.find((s) => s.id === table.sectionId)
                        const isEditing = editingTableId === table.id

                        return (
                          <tr key={table.id} className="border-b hover:bg-muted/30">
                            <td className="p-3">
                              <Checkbox
                                checked={selectedTableIds.includes(table.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedTableIds([...selectedTableIds, table.id])
                                  } else {
                                    setSelectedTableIds(selectedTableIds.filter((id) => id !== table.id))
                                  }
                                }}
                                disabled={!permissions.canEditDrafts}
                              />
                            </td>
                            <td className="p-3">
                              {isEditing && editingField === "name" ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="h-8"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveEdit()
                                      if (e.key === "Escape") handleCancelEdit()
                                    }}
                                  />
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSaveEdit}>
                                    <Check className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCancelEdit}>
                                    <X className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  className="font-medium cursor-pointer hover:text-primary"
                                  onClick={() => handleStartEdit(table.id, "name", table.name)}
                                >
                                  {table.name}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {isEditing && editingField === "capacity" ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="h-8 w-20"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveEdit()
                                      if (e.key === "Escape") handleCancelEdit()
                                    }}
                                  />
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSaveEdit}>
                                    <Check className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCancelEdit}>
                                    <X className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  className="cursor-pointer hover:text-primary"
                                  onClick={() => handleStartEdit(table.id, "capacity", table.capacity)}
                                >
                                  <div className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {table.capacity} people
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <Select
                                value={table.shape}
                                onValueChange={(value) => {
                                  const newTables = tables.map((t) => {
                                    if (t.id === table.id) {
                                      const updatedTable = { ...t, shape: value as TableShape }
                                      if (
                                        updatedTable.changeStatus !== "added" &&
                                        updatedTable.changeStatus !== "deleted"
                                      ) {
                                        updatedTable.changeStatus = "modified" as const
                                      }
                                      return updatedTable
                                    }
                                    return t
                                  })
                                  setTables(newTables)
                                  // Remove old history add
                                  // addToHistory(newTables)
                                  toast.success("Shape updated")
                                }}
                                disabled={!permissions.canEditDrafts}
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="rectangle">
                                    <div className="flex items-center gap-2">
                                      <Square className="w-4 h-4" />
                                      Rectangle
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="circle">
                                    <div className="flex items-center gap-2">
                                      <Circle className="w-4 h-4" />
                                      Circle
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="square">
                                    <div className="flex items-center gap-2">
                                      <Square className="w-4 h-4" />
                                      Square
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Select
                                value={table.sectionId || "none"}
                                onValueChange={(value) => {
                                  const newTables = tables.map((t) => {
                                    if (t.id === table.id) {
                                      const updatedTable = { ...t, sectionId: value === "none" ? undefined : value }
                                      if (
                                        updatedTable.changeStatus !== "added" &&
                                        updatedTable.changeStatus !== "deleted"
                                      ) {
                                        updatedTable.changeStatus = "modified" as const
                                      }
                                      return updatedTable
                                    }
                                    return t
                                  })
                                  setTables(newTables)
                                  // Remove old history add
                                  // addToHistory(newTables)
                                  toast.success("Section updated")
                                }}
                                disabled={!permissions.canEditDrafts}
                              >
                                <SelectTrigger className="w-40 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unassigned</SelectItem>
                                  {sections.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
                                        {s.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => handleLocateOnCanvas(table.id)}
                              >
                                <MapPin className="w-3 h-3 mr-1" />
                                {table.x}, {table.y}
                              </Button>
                            </td>
                            <td className="p-3">
                              {table.changeStatus === "added" && (
                                <Badge className="bg-green-500 text-white">
                                  <span className="mr-1">🆕</span>
                                  New
                                </Badge>
                              )}
                              {table.changeStatus === "modified" && (
                                <Badge className="bg-blue-500 text-white">
                                  <span className="mr-1">📝</span>
                                  Modified
                                </Badge>
                              )}
                              {table.changeStatus === "deleted" && (
                                <Badge variant="secondary" className="bg-gray-500 text-white">
                                  <span className="mr-1">🗑️</span>
                                  Deleted
                                </Badge>
                              )}
                              {(!table.changeStatus || table.changeStatus === "unchanged") && (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => handleOpenTagEditor(table.id)}
                                disabled={!permissions.canEditDrafts}
                              >
                                {table.tags && table.tags.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    {table.tags.slice(0, 2).map((tag) => (
                                      <Badge key={tag} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {table.tags.length > 2 && (
                                      <span className="text-muted-foreground">+{table.tags.length - 2}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Add tags</span>
                                )}
                              </Button>
                            </td>
                            <td className="p-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleLocateOnCanvas(table.id)}>
                                    <MapPin className="w-4 h-4 mr-2" />
                                    Locate on Canvas
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTableIds([table.id])
                                      handleDuplicate()
                                    }}
                                    disabled={!permissions.canEditDrafts}
                                  >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      setSelectedTableIds([table.id])
                                      handleDeleteTable()
                                    }}
                                    disabled={!permissions.canDelete}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {filteredAndSortedTables.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No tables found matching your filters.</p>
                      <Button variant="link" onClick={handleClearFilters}>
                        Clear filters
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Stats Summary */}
              <Card className="p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Tables</div>
                    <div className="text-2xl font-bold">{tables.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Capacity</div>
                    <div className="text-2xl font-bold">{tables.reduce((sum, t) => sum + t.capacity, 0)} seats</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Sections</div>
                    <div className="text-2xl font-bold">{sections.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Combinations</div>
                    <div className="text-2xl font-bold">{combos.length}</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs and Modals */}
      {showTagEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Tags: {tables.find((t) => t.id === showTagEditor)?.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowTagEditor(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div>
              <Label className="text-sm">Current Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {tagEditorValue.length > 0 ? (
                  tagEditorValue.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tags yet</p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm">Add New Tag</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Enter tag name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTag()
                  }}
                />
                <Button onClick={handleAddTag}>Add</Button>
              </div>
            </div>

            <div>
              <Label className="text-sm">Common Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COMMON_TAGS.map((tag) => (
                  <Button
                    key={tag}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!tagEditorValue.includes(tag)) {
                        setTagEditorValue([...tagEditorValue, tag])
                      }
                    }}
                    disabled={tagEditorValue.includes(tag) || !permissions.canEditDrafts}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setShowTagEditor(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveTags} disabled={!permissions.canEditDrafts}>
                Save Tags
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showNewSectionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
          <Card className="w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">New Section Created</h3>

            <div>
              <Label htmlFor="new-section-name" className="text-sm">
                Section Name *
              </Label>
              <Input
                id="new-section-name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Main Dining"
                className="mt-1"
                disabled={!permissions.canEditDrafts}
              />
            </div>

            <div>
              <Label className="text-sm">Color</Label>
              <div className="flex gap-2 mt-2">
                {SECTION_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={cn(
                      "w-8 h-8 rounded border-2 transition-all",
                      newSectionColor === color.value ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setNewSectionColor(color.value)}
                    title={color.name}
                    disabled={!permissions.canEditDrafts}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="new-section-staff" className="text-sm">
                Default Staff (Optional)
              </Label>
              <Select
                value={newSectionStaff || "none"}
                onValueChange={(v) => setNewSectionStaff(v === "none" ? undefined : v)}
                disabled={!permissions.canEditDrafts}
              >
                <SelectTrigger id="new-section-staff" className="mt-1">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {STAFF_MEMBERS.map((staff) => (
                    <SelectItem key={staff} value={staff}>
                      {staff}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="new-section-description" className="text-sm">
                Description (Optional)
              </Label>
              <Textarea
                id="new-section-description"
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
                placeholder="e.g., Main dining area with natural lighting"
                className="mt-1"
                rows={3}
                disabled={!permissions.canEditDrafts}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => {
                  setShowNewSectionDialog(false)
                  setIsSectionDrawing(false) // Reset drawing state
                  setNewSectionName("")
                  setNewSectionColor(SECTION_COLORS[0].value)
                  setNewSectionStaff(undefined)
                  setNewSectionDescription("")
                }}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreateSection} disabled={!permissions.canEditDrafts}>
                Create Section
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showComboDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
          <Card className="w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">Create Table Combination</h3>

            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Selected tables: {selectedTables.map((t) => t.name).join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">
                Total capacity: {selectedTables.reduce((sum, t) => sum + t.capacity, 0)} seats
              </p>
            </div>

            <div>
              <Label htmlFor="combo-name" className="text-sm">
                Combination Name (Optional)
              </Label>
              <Input
                id="combo-name"
                value={comboName}
                onChange={(e) => setComboName(e.target.value)}
                placeholder={`Tables ${selectedTables.map((t) => t.name).join("-")}`}
                className="mt-1"
                disabled={!permissions.canEditDrafts}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => {
                  setShowComboDialog(false)
                  setComboName("")
                }}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreateCombo} disabled={!permissions.canEditDrafts}>
                Create Combo
              </Button>
            </div>
          </Card>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed bg-popover border rounded-md shadow-lg py-1 z-[9999]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start px-3 py-1.5 text-sm"
            onClick={handleDuplicate}
            disabled={!permissions.canEditDrafts}
          >
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </Button>
          <Separator className="my-1" />
          {selectedTableIds.length >= 2 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-3 py-1.5 text-sm"
                onClick={() => {
                  setShowComboDialog(true)
                  setContextMenu(null)
                }}
                disabled={!permissions.canEditDrafts}
              >
                <Link className="w-4 h-4 mr-2" />
                Create Combo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-3 py-1.5 text-sm"
                onClick={() => {
                  handleAlign("left")
                  setContextMenu(null)
                }}
                disabled={!permissions.canEditDrafts}
              >
                <AlignLeft className="w-4 h-4 mr-2" />
                Align Left
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-3 py-1.5 text-sm"
                onClick={() => {
                  handleAlign("center")
                  setContextMenu(null)
                }}
                disabled={!permissions.canEditDrafts}
              >
                <AlignCenter className="w-4 h-4 mr-2" />
                Align Center
              </Button>
              <Separator className="my-1" />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start px-3 py-1.5 text-sm text-destructive"
            onClick={handleDeleteTable}
            disabled={!permissions.canDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      )}

      <Sheet open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <SheetContent side="right" className="w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Search and Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search versions..."
                  value={versionSearchQuery}
                  onChange={(e) => setVersionSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={versionFilterDays?.toString() || "all"}
                onValueChange={(v) => setVersionFilterDays(v === "all" ? null : Number.parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All versions</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Version List */}
            <div className="space-y-2">
              {/* Current Version */}
              <Card className="p-4 border-2 border-primary">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">v{currentVersion} (Current)</span>
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{formatDate(lastSaved)} • Current User</div>
                    <div className="text-sm">
                      {tables.length} tables • {tables.reduce((sum, t) => sum + t.capacity, 0)} seats
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setCompareVersionA(currentVersion - 1)
                          setCompareVersionB(currentVersion)
                          setShowCompareDialog(true)
                        }}
                      >
                        <GitCompare className="h-4 w-4 mr-2" />
                        Compare with previous
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>

              {/* Previous Versions */}
              {filterVersions(versions)
                .reverse()
                .map((version) => (
                  <Card key={version.versionNumber} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <div className="font-semibold mb-1">v{version.versionNumber}</div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {formatDate(new Date(version.publishedAt))} • {version.publishedBy}
                        </div>
                        {version.notes && <div className="text-sm mb-2 italic">"{version.notes}"</div>}
                        <div className="text-sm">
                          {version.tables.length} tables • {version.tables.reduce((sum, t) => sum + t.capacity, 0)}{" "}
                          seats
                          {version.changesSummary.added +
                            version.changesSummary.modified +
                            version.changesSummary.deleted >
                            0 && (
                            <span className="text-muted-foreground">
                              {" • "}
                              {version.changesSummary.added > 0 && `+${version.changesSummary.added} added`}
                              {version.changesSummary.added > 0 && version.changesSummary.modified > 0 && ", "}
                              {version.changesSummary.modified > 0 && `+${version.changesSummary.modified} modified`}
                              {(version.changesSummary.added > 0 || version.changesSummary.modified > 0) &&
                                version.changesSummary.deleted > 0 &&
                                ", "}
                              {version.changesSummary.deleted > 0 && `${version.changesSummary.deleted} deleted`}
                            </span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewVersion(version)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setCompareVersionA(version.versionNumber)
                              setCompareVersionB(currentVersion)
                              setShowCompareDialog(true)
                            }}
                          >
                            <GitCompare className="h-4 w-4 mr-2" />
                            Compare with current
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRestoreVersionClick(version)}
                            disabled={!permissions.canRollback}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => handleViewVersion(version)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreVersionClick(version)}
                        disabled={!permissions.canRollback}
                      >
                        Restore
                      </Button>
                    </div>
                  </Card>
                ))}

              {filterVersions(versions).length === 0 && versions.length > 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">No versions match your filters</div>
              )}

              {versions.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">No version history yet</div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {viewingVersion && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBackToCurrent}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Current
              </Button>
              <div className="h-4 w-px bg-blue-300" />
              <Eye className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium text-blue-900">
                  Viewing: Version {viewingVersion.versionNumber} (Read-only)
                </div>
                <div className="text-xs text-blue-700">
                  Published {formatDate(new Date(viewingVersion.publishedAt))} by {viewingVersion.publishedBy}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-blue-700">
                {viewingVersion.tables.length} tables • {viewingVersion.tables.reduce((sum, t) => sum + t.capacity, 0)}{" "}
                seats
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCompareVersionA(viewingVersion.versionNumber)
                  setCompareVersionB(currentVersion)
                  setShowCompareDialog(true)
                }}
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare with Current
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleRestoreVersionClick(viewingVersion)}
                disabled={!permissions.canRollback}
              >
                <Download className="h-4 w-4 mr-2" />
                Restore This Version
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compare Versions</DialogTitle>
            <DialogDescription>Select two versions to compare side-by-side</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div>
              <Label>Version A</Label>
              <Select
                value={compareVersionA?.toString() || ""}
                onValueChange={(v) => setCompareVersionA(Number.parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.versionNumber} value={v.versionNumber.toString()}>
                      v{v.versionNumber} - {formatDate(new Date(v.publishedAt))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Version B</Label>
              <Select
                value={compareVersionB?.toString() || ""}
                onValueChange={(v) => setCompareVersionB(Number.parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentVersion.toString()}>v{currentVersion} (Current)</SelectItem>
                  {versions.map((v) => (
                    <SelectItem key={v.versionNumber} value={v.versionNumber.toString()}>
                      v{v.versionNumber} - {formatDate(new Date(v.publishedAt))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>View Mode</Label>
              <RadioGroup value={comparisonMode} onValueChange={(v) => setComparisonMode(v as ComparisonMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="side-by-side" id="side-by-side" />
                  <Label htmlFor="side-by-side">Side-by-side</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="list" id="list" />
                  <Label htmlFor="list">List</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompareVersions}>Compare</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isComparingVersions &&
        compareVersionA !== null &&
        compareVersionB !== null &&
        (() => {
          const versionA = versions.find((v) => v.versionNumber === compareVersionA)
          const versionB =
            compareVersionB === currentVersion
              ? {
                  versionNumber: currentVersion,
                  tables,
                  sections,
                  publishedAt: new Date().toISOString(),
                  publishedBy: "Current",
                  notes: "Current version",
                  changesSummary: { added: 0, modified: 0, deleted: 0 },
                }
              : versions.find((v) => v.versionNumber === compareVersionB)

          if (!versionA || !versionB) return null

          const differences = getVersionDifferences(versionA, versionB)

          return (
            <div className="fixed inset-0 bg-background z-50 flex flex-col">
              {/* Comparison Header */}
              <div className="bg-muted border-b px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={handleExitComparison}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <div className="h-4 w-px bg-border" />
                  <div className="font-medium">
                    Compare: v{versionA.versionNumber} vs v{versionB.versionNumber}
                    {compareVersionB === currentVersion && " (Current)"}
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>

              {comparisonMode === "side-by-side" && (
                <div className="flex-1 flex overflow-hidden">
                  {/* Version A */}
                  <div className="flex-1 border-r flex flex-col">
                    <div className="bg-muted/50 border-b px-4 py-2">
                      <div className="font-semibold">VERSION {versionA.versionNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {versionA.tables.length} tables • {versionA.tables.reduce((sum, t) => sum + t.capacity, 0)}{" "}
                        seats
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      <div className="relative bg-muted/10" style={{ width: floorWidth, height: floorHeight }}>
                        {versionA.sections
                          .filter((s) => s.visible)
                          .map((section) => (
                            <div
                              key={section.id}
                              className="absolute border-2 border-dashed"
                              style={{
                                left: section.x,
                                top: section.y,
                                width: section.width,
                                height: section.height,
                                borderColor: section.color,
                                backgroundColor: `${section.color}20`,
                              }}
                            >
                              <div className="p-2 text-sm font-medium" style={{ color: section.color }}>
                                {section.name}
                              </div>
                            </div>
                          ))}
                        {versionA.tables.map((table) => {
                          const hasChanged = !versionB.tables.find(
                            (t) =>
                              t.id === table.id && t.x === table.x && t.y === table.y && t.capacity === table.capacity,
                          )
                          return (
                            <div
                              key={table.id}
                              className={cn(
                                "absolute flex items-center justify-center border-2 bg-white",
                                hasChanged && "border-yellow-500 border-4",
                              )}
                              style={{
                                left: table.x,
                                top: table.y,
                                width: table.width,
                                height: table.height,
                                borderRadius: table.shape === "circle" ? "50%" : "8px",
                              }}
                            >
                              <span className="font-semibold">{table.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Version B */}
                  <div className="flex-1 flex flex-col">
                    <div className="bg-muted/50 border-b px-4 py-2">
                      <div className="font-semibold">
                        VERSION {versionB.versionNumber}
                        {compareVersionB === currentVersion && " (Current)"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {versionB.tables.length} tables • {versionB.tables.reduce((sum, t) => sum + t.capacity, 0)}{" "}
                        seats
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      <div className="relative bg-muted/10" style={{ width: floorWidth, height: floorHeight }}>
                        {versionB.sections
                          .filter((s) => s.visible)
                          .map((section) => (
                            <div
                              key={section.id}
                              className="absolute border-2 border-dashed"
                              style={{
                                left: section.x,
                                top: section.y,
                                width: section.width,
                                height: section.height,
                                borderColor: section.color,
                                backgroundColor: `${section.color}20`,
                              }}
                            >
                              <div className="p-2 text-sm font-medium" style={{ color: section.color }}>
                                {section.name}
                              </div>
                            </div>
                          ))}
                        {versionB.tables.map((table) => {
                          const hasChanged = !versionA.tables.find(
                            (t) =>
                              t.id === table.id && t.x === table.x && t.y === table.y && t.capacity === table.capacity,
                          )
                          const isNew = !versionA.tables.find((t) => t.id === table.id)
                          return (
                            <div
                              key={table.id}
                              className={cn(
                                "absolute flex items-center justify-center border-2 bg-white",
                                isNew && "border-green-500 border-4",
                                hasChanged && !isNew && "border-blue-500 border-4",
                              )}
                              style={{
                                left: table.x,
                                top: table.y,
                                width: table.width,
                                height: table.height,
                                borderRadius: table.shape === "circle" ? "50%" : "8px",
                              }}
                            >
                              <span className="font-semibold">{table.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {comparisonMode === "list" && (
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">Changes: {differences.length} total</h3>
                      <div className="flex gap-2 text-sm">
                        {differences.filter((d) => d.status === "added").length > 0 && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            🆕 {differences.filter((d) => d.status === "added").length} Added
                          </Badge>
                        )}
                        {differences.filter((d) => d.status === "modified").length > 0 && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            📝 {differences.filter((d) => d.status === "modified").length} Modified
                          </Badge>
                        )}
                        {differences.filter((d) => d.status === "deleted").length > 0 && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            🗑️ {differences.filter((d) => d.status === "deleted").length} Deleted
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                            <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                            <th className="px-4 py-2 text-left text-sm font-semibold">
                              v{versionA.versionNumber} → v{versionB.versionNumber}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {differences.map((diff, index) => (
                            <tr key={index} className="border-t">
                              <td className="px-4 py-3 text-lg">
                                {diff.status === "added" && "🆕"}
                                {diff.status === "modified" && "📝"}
                                {diff.status === "deleted" && "🗑️"}
                              </td>
                              <td className="px-4 py-3 font-medium">{diff.name}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{diff.changes}</td>
                            </tr>
                          ))}
                          {differences.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                No differences found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Changes Summary Footer */}
              <div className="bg-muted border-t px-6 py-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">CHANGES: {differences.length} total</span>
                  {differences.filter((d) => d.status === "added").length > 0 && (
                    <span>
                      🆕{" "}
                      {differences
                        .filter((d) => d.status === "added")
                        .map((d) => d.name)
                        .join(", ")}
                    </span>
                  )}
                  {differences.filter((d) => d.status === "modified").length > 0 && (
                    <span>
                      📝{" "}
                      {differences
                        .filter((d) => d.status === "modified")
                        .map((d) => d.name)
                        .join(", ")}
                    </span>
                  )}
                  {differences.filter((d) => d.status === "deleted").length > 0 && (
                    <span>
                      🗑️{" "}
                      {differences
                        .filter((d) => d.status === "deleted")
                        .map((d) => d.name)
                        .join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

      <Sheet open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <SheetContent side="right" className="w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review Changes</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Summary Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Summary</h3>
              {(() => {
                const counts = getChangeCounts()
                return (
                  <div className="space-y-2">
                    {counts.added > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-lg">🆕</span>
                        <div>
                          <span className="font-medium">Added ({counts.added})</span>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {counts.addedTables > 0 && (
                              <div>
                                • {counts.addedTables} new table{counts.addedTables !== 1 ? "s" : ""} (
                                {tables
                                  .filter((t) => t.changeStatus === "added")
                                  .map((t) => t.name)
                                  .join(", ")}
                                )
                              </div>
                            )}
                            {counts.addedSections > 0 && (
                              <div>
                                • {counts.addedSections} new section{counts.addedSections !== 1 ? "s" : ""} (
                                {sections
                                  .filter((s) => s.changeStatus === "added")
                                  .map((s) => s.name)
                                  .join(", ")}
                                )
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {counts.modified > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-lg">📝</span>
                        <div>
                          <span className="font-medium">Modified ({counts.modified})</span>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {counts.modifiedTables > 0 && (
                              <div>
                                • {counts.modifiedTables} table{counts.modifiedTables !== 1 ? "s" : ""} modified
                              </div>
                            )}
                            {counts.modifiedSections > 0 && (
                              <div>
                                • {counts.modifiedSections} section{counts.modifiedSections !== 1 ? "s" : ""} modified
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {counts.deleted > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-lg">🗑️</span>
                        <div>
                          <span className="font-medium">Deleted ({counts.deleted})</span>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {counts.deletedTables > 0 && (
                              <div>
                                • {counts.deletedTables} table{counts.deletedTables !== 1 ? "s" : ""} removed
                              </div>
                            )}
                            {counts.deletedSections > 0 && (
                              <div>
                                • {counts.deletedSections} section{counts.deletedSections !== 1 ? "s" : ""} removed
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {counts.total === 0 && <div className="text-sm text-muted-foreground">No changes yet</div>}
                  </div>
                )
              })()}
            </div>

            {/* Impact Section */}
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Impact</h3>
              {(() => {
                const currentTables = tables.filter((t) => t.changeStatus !== "deleted")
                const currentSeats = currentTables.reduce((sum, t) => sum + t.capacity, 0)
                const originalTables = publishedSnapshot?.tables.length || 0
                const originalSeats = publishedSnapshot?.tables.reduce((sum, t) => sum + t.capacity, 0) || 0
                const tableDiff = currentTables.length - originalTables
                const seatDiff = currentSeats - originalSeats

                return (
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Before:</span>
                      <span>
                        {originalTables} tables, {originalSeats} seats
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">After:</span>
                      <span>
                        {currentTables.length} tables, {currentSeats} seats
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Net:</span>
                      <span className={cn(tableDiff > 0 && "text-green-600", tableDiff < 0 && "text-red-600")}>
                        {tableDiff > 0 && "+"}
                        {tableDiff} tables, {seatDiff > 0 && "+"}
                        {seatDiff} seats
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Detailed Changes Section */}
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Detailed Changes</h3>
              <div className="space-y-2">
                {tables
                  .filter((t) => t.changeStatus !== "unchanged")
                  .map((table) => (
                    <Card key={table.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <span className="text-base">
                            {table.changeStatus === "added" && "🆕"}
                            {table.changeStatus === "modified" && "📝"}
                            {table.changeStatus === "deleted" && "🗑️"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              Table {table.name}{" "}
                              <span className="text-muted-foreground font-normal">
                                ({table.changeStatus === "added" && "New"}
                                {table.changeStatus === "modified" && "Modified"}
                                {table.changeStatus === "deleted" && "Deleted"})
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {table.changeStatus === "added" && (
                                <>
                                  Section: {sections.find((s) => s.id === table.sectionId)?.name || "None"} • Capacity:{" "}
                                  {table.capacity} • Shape: {table.shape}
                                </>
                              )}
                              {table.changeStatus === "deleted" && (
                                <>
                                  Was: {table.capacity} seats, {table.shape}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div>
                          {table.changeStatus === "deleted" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestore(table.id)}
                              disabled={!permissions.canEditDrafts}
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleLocate(table.id)}>
                              Locate
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}

                {sections
                  .filter((s) => s.changeStatus !== "unchanged")
                  .map((section) => (
                    <Card key={section.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <span className="text-base">
                            {section.changeStatus === "added" && "🆕"}
                            {section.changeStatus === "modified" && "📝"}
                            {section.changeStatus === "deleted" && "🗑️"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              Section {section.name}{" "}
                              <span className="text-muted-foreground font-normal">
                                ({section.changeStatus === "added" && "New"}
                                {section.changeStatus === "modified" && "Modified"}
                                {section.changeStatus === "deleted" && "Deleted"})
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {section.changeStatus === "added" && <>Staff: {section.staff || "None"}</>}
                              {section.changeStatus === "deleted" && <>Was assigned to: {section.staff || "None"}</>}
                            </div>
                          </div>
                        </div>
                        <div>
                          {section.changeStatus === "deleted" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestore(section.id)}
                              disabled={!permissions.canEditDrafts}
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleLocate(section.id)}>
                              Locate
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}

                {tables.filter((t) => t.changeStatus !== "unchanged").length === 0 &&
                  sections.filter((s) => s.changeStatus !== "unchanged").length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">No changes to display</div>
                  )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard Draft Changes?</DialogTitle>
            <DialogDescription>Are you sure you want to discard all unpublished changes?</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            {(() => {
              const counts = getChangeCounts()
              return (
                <>
                  <div className="text-sm">
                    <p className="mb-2">You will lose:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {counts.addedTables > 0 && (
                        <li>
                          {counts.addedTables} table{counts.addedTables !== 1 ? "s" : ""} added
                        </li>
                      )}
                      {counts.modifiedTables > 0 && (
                        <li>
                          {counts.modifiedTables} table{counts.modifiedTables !== 1 ? "s" : ""} modified
                        </li>
                      )}
                      {counts.deletedTables > 0 && (
                        <li>
                          {counts.deletedTables} table{counts.deletedTables !== 1 ? "s" : ""} deleted
                        </li>
                      )}
                      {counts.addedSections > 0 && (
                        <li>
                          {counts.addedSections} section{counts.addedSections !== 1 ? "s" : ""} added
                        </li>
                      )}
                      {counts.modifiedSections > 0 && (
                        <li>
                          {counts.modifiedSections} section{counts.modifiedSections !== 1 ? "s" : ""} modified
                        </li>
                      )}
                      {counts.deletedSections > 0 && (
                        <li>
                          {counts.deletedSections} section{counts.deletedSections !== 1 ? "s" : ""} deleted
                        </li>
                      )}
                    </ul>
                  </div>

                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">This cannot be undone.</AlertDescription>
                  </Alert>
                </>
              )
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDiscardOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscardDraft}>
              Yes, Discard Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-4 right-4 z-50">
        <Card className="p-3 shadow-lg bg-white border">
          {saveError ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Save failed</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleRetrySave} className="h-7 text-xs bg-transparent">
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={handleManualSave} className="h-7 text-xs bg-transparent">
                  Save Manually
                </Button>
              </div>
            </div>
          ) : isSaving ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Saving...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                Last saved:{" "}
                {lastSavedAt
                  ? (() => {
                      const diff = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000)
                      if (diff < 60) return "just now"
                      if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
                      return `${Math.floor(diff / 3600)} hr ago`
                    })()
                  : "never"}
              </span>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Draft Found</DialogTitle>
            <DialogDescription>We found unsaved changes from your last session.</DialogDescription>
          </DialogHeader>

          {pendingRecovery && (
            <div className="space-y-4 my-4">
              <div className="text-sm space-y-2">
                <p>
                  <span className="font-medium">Draft from:</span> {(() => {
                    const savedDate = new Date(pendingRecovery.savedAt)
                    const today = new Date()
                    const isToday = savedDate.toDateString() === today.toDateString()
                    if (isToday) {
                      return `Today at ${savedDate.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}`
                    }
                    return savedDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  })()}
                </p>
                <p>
                  <span className="font-medium">Last saved:</span> {(() => {
                    const diff = Math.floor((Date.now() - new Date(pendingRecovery.savedAt).getTime()) / 1000)
                    if (diff < 60) return "just now"
                    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
                    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
                    return `${Math.floor(diff / 86400)} days ago`
                  })()}
                </p>
              </div>

              {pendingRecovery.changeCount && pendingRecovery.changeCount.total > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-2">Changes:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {pendingRecovery.changeCount.added > 0 && (
                      <li>
                        {pendingRecovery.changeCount.added} table
                        {pendingRecovery.changeCount.added !== 1 ? "s" : ""} added
                      </li>
                    )}
                    {pendingRecovery.changeCount.modified > 0 && (
                      <li>
                        {pendingRecovery.changeCount.modified} table
                        {pendingRecovery.changeCount.modified !== 1 ? "s" : ""} modified
                      </li>
                    )}
                    {pendingRecovery.changeCount.deleted > 0 && (
                      <li>
                        {pendingRecovery.changeCount.deleted} table
                        {pendingRecovery.changeCount.deleted !== 1 ? "s" : ""} deleted
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleDiscardRecovery}>
              Discard
            </Button>
            <Button onClick={handleRestoreDraft}>Restore Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cannot Publish - Validation Errors
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {validationErrors.map((error, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {error.type === "overlap" && "Table Overlap"}
                        {error.type === "out_of_bounds" && "Out of Bounds"}
                        {error.type === "duplicate" && "Duplicate Name"}
                      </p>
                      <p className="text-sm text-muted-foreground">{error.message}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const tableId = error.items[0]
                        const table = tables.find((t) => t.id === tableId)
                        if (table) {
                          setViewMode("canvas")
                          setSelectedTableIds([tableId])
                          // Note: This camera positioning logic might need adjustment based on actual canvas implementation
                          // setCameraX(-table.x + containerWidth / (2 * zoom))
                          // setCameraY(-table.y + containerHeight / (2 * zoom))
                          setPulsingTableId(tableId)
                          setTimeout(() => setPulsingTableId(null), 2000)
                          setShowValidationModal(false)
                        }
                      }}
                    >
                      Locate
                    </Button>
                    {error.type === "overlap" && (
                      <Button variant="outline" size="sm" onClick={() => handleAutoFixOverlap(error)}>
                        Auto-Fix
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setShowValidationModal(false)}>Back to Editor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Floor Plan Changes?</DialogTitle>
            <DialogDescription>Publishing changes to Main Floor.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="text-sm space-y-2">
              <p className="font-medium">CHANGES:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                {(() => {
                  const counts = getChangeCounts()
                  const items = []
                  if (counts.added > 0) items.push(<li key="added">{counts.added} tables added</li>)
                  if (counts.modified > 0) items.push(<li key="modified">{counts.modified} tables modified</li>)
                  if (counts.deleted > 0) items.push(<li key="deleted">{counts.deleted} items deleted</li>)
                  return items
                })()}
              </ul>
            </div>

            <div className="text-sm">
              <p>
                <span className="font-medium">Total:</span> {tables.filter((t) => t.changeStatus !== "deleted").length}{" "}
                tables, {tables.filter((t) => t.changeStatus !== "deleted").reduce((sum, t) => sum + t.capacity, 0)}{" "}
                seats
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version-notes">VERSION NOTES (optional):</Label>
              <Textarea
                id="version-notes"
                placeholder="Added patio seating area..."
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-staff"
                checked={notifyStaff}
                onCheckedChange={(checked) => setNotifyStaff(checked === true)}
              />
              <Label htmlFor="notify-staff" className="text-sm font-normal cursor-pointer">
                Notify staff of this change
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishModal(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublishConfirm}>Publish Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPublishing} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" hideCloseButton>
          <div className="space-y-4 py-4">
            <p className="font-medium">Publishing...</p>
            <Progress value={publishProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">{publishingStep}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPublishSuccess} onOpenChange={setShowPublishSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Published Successfully!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <p className="text-sm">
              Floor plan published as <span className="font-medium">Version {publishedVersionNumber}</span>
            </p>

            <div className="text-sm space-y-1">
              {(() => {
                const lastVersion = versions[versions.length - 1]
                if (!lastVersion) return null
                const { added, modified, deleted } = lastVersion.changesSummary
                return (
                  <>
                    <p>• {added + modified + deleted} changes published</p>
                    <p>
                      • {lastVersion.tables.length} tables, {lastVersion.tables.reduce((sum, t) => sum + t.capacity, 0)}{" "}
                      seats
                    </p>
                  </>
                )
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishSuccess(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowPublishSuccess(false)
                setIsDraftMode(false)
              }}
            >
              View Published Floor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showActionHistory} onOpenChange={setShowActionHistory}>
        <SheetContent side="right" className="w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Action History</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {actionHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No actions yet</p>
              </div>
            ) : (
              <>
                {actionHistory.map((action, index) => {
                  const isCurrent = index === actionHistoryIndex
                  const isFuture = index > actionHistoryIndex
                  const timeAgo = formatTimeAgo(action.timestamp)

                  return (
                    <Card
                      key={action.id}
                      className={`p-3 ${isCurrent ? "border-primary border-2" : ""} ${isFuture ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {isCurrent && <span className="text-xs font-semibold text-primary">NOW</span>}
                            {!isFuture && !isCurrent && <CheckCircle className="h-3 w-3 text-green-600" />}
                            <span className="text-sm">{action.description}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{timeAgo}</div>
                        </div>
                        {index < actionHistoryIndex && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUndoTo(index)}
                            className="text-xs h-auto py-1"
                          >
                            Undo To
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </>
            )}

            {actionHistory.length > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>{actionHistory.length} actions</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Clear all action history? This cannot be undone.")) {
                        clearActionHistory()
                        toast.success("Action history cleared")
                      }
                    }}
                    className="text-xs h-auto py-1"
                  >
                    Clear History
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restore Version {versionToRestore?.versionNumber}?</DialogTitle>
          </DialogHeader>

          {versionToRestore && (
            <div className="space-y-4">
              <div className="text-sm space-y-2">
                <p className="font-medium">Restoring to Version {versionToRestore.versionNumber} will:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Revert floor plan to v{versionToRestore.versionNumber} state</li>
                  {getRestoreSummary().tablesToRemove.length > 0 && (
                    <li>
                      Remove {getRestoreSummary().tablesToRemove.length} table(s) (
                      {getRestoreSummary()
                        .tablesToRemove.map((t) => t.name)
                        .join(", ")}
                      )
                    </li>
                  )}
                  {getRestoreSummary().tablesToRestore.length > 0 && (
                    <li>
                      Restore {getRestoreSummary().tablesToRestore.length} table(s) (
                      {getRestoreSummary()
                        .tablesToRestore.map((t) => t.name)
                        .join(", ")}
                      )
                    </li>
                  )}
                  <li>
                    Create new version v{currentVersion + 1} (copy of v{versionToRestore.versionNumber})
                  </li>
                </ul>

                {getRestoreSummary().capacityChange !== 0 && (
                  <div className="pt-2 border-t">
                    <p className="font-medium">
                      Capacity: {tables.reduce((sum, t) => sum + t.capacity, 0)} →{" "}
                      {versionToRestore.tables.reduce((sum, t) => sum + t.capacity, 0)} seats
                      <span className={getRestoreSummary().capacityChange > 0 ? "text-green-600" : "text-red-600"}>
                        {" "}
                        ({getRestoreSummary().capacityChange > 0 ? "+" : ""}
                        {getRestoreSummary().capacityChange})
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Restore Notes (optional):</label>
                <Textarea
                  placeholder="e.g., Patio construction delayed..."
                  value={restoreNotes}
                  onChange={(e) => setRestoreNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Previous v{currentVersion} will remain in history.</AlertDescription>
              </Alert>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCompareVersionA(versionToRestore.versionNumber)
                    setCompareVersionB(currentVersion)
                    setShowCompareDialog(true)
                    setShowRestoreDialog(false)
                  }}
                >
                  Compare First
                </Button>
                <Button variant="default" onClick={handleRestoreVersionConfirm} disabled={!permissions.canRollback}>
                  Restore to v{versionToRestore.versionNumber}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              Permission Required
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground whitespace-pre-line">{permissionMessage}</p>
            {!permissions.canPublish && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">You can:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Request approval from a manager</li>
                  <li>• Continue editing the draft</li>
                  <li>• Save draft for later</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            {!permissions.canPublish && (
              <Button
                onClick={() => {
                  setShowPermissionDialog(false)
                  setShowApprovalDialog(true)
                }}
              >
                Request Approval
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowPermissionDialog(false)}>
              Continue Editing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Publish Approval</DialogTitle>
            <DialogDescription>You're requesting approval to publish changes to {floorName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-medium text-sm">CHANGES SUMMARY</h4>
              {(() => {
                const counts = getChangeCounts()
                return (
                  <>
                    <div className="text-sm space-y-1">
                      {counts.added > 0 && <div>• {counts.added} tables added</div>}
                      {counts.modified > 0 && <div>• {counts.modified} tables modified</div>}
                      {counts.deleted > 0 && <div>• {counts.deleted} items deleted</div>}
                    </div>
                    <div className="text-sm font-medium mt-2">
                      Total impact: {tables.filter((t) => t.changeStatus !== "deleted").length} tables,{" "}
                      {tables.filter((t) => t.changeStatus !== "deleted").reduce((sum, t) => sum + t.capacity, 0)} seats
                    </div>
                  </>
                )
              })()}
            </div>

            <div className="space-y-2">
              <Label>Message to approver (required)</Label>
              <Textarea
                value={approvalMessage}
                onChange={(e) => setApprovalMessage(e.target.value)}
                placeholder="Explain the changes and why they're needed..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Request approval from</Label>
              <Select value={selectedApprover} onValueChange={setSelectedApprover}>
                <SelectTrigger>
                  <SelectValue placeholder="Select approver..." />
                </SelectTrigger>
                <SelectContent>
                  {availableApprovers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role.charAt(0).toUpperCase() + user.role.slice(1)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <RadioGroup value={approvalPriority} onValueChange={(v) => setApprovalPriority(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="normal" />
                  <Label htmlFor="normal">Normal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="urgent" id="urgent" />
                  <Label htmlFor="urgent">Urgent</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="lock-draft"
                checked={lockDraftOnApproval}
                onCheckedChange={(checked) => setLockDraftOnApproval(checked as boolean)}
              />
              <Label htmlFor="lock-draft" className="text-sm">
                Lock draft until approval (prevent further edits)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestApproval}>Send Approval Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showActivityLogs} onOpenChange={setShowActivityLogs}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Activity Logs</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ScrollArea className="h-[calc(100vh-120px)]">
              <div className="space-y-4">
                {activityLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No activity logs yet</p>
                  </div>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium">{log.user.name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">{log.user.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {log.action}
                        </Badge>
                      </div>
                      <p className="text-sm">{log.details}</p>
                      {log.changes && (
                        <div className="text-xs bg-muted p-2 rounded">
                          <pre>{JSON.stringify(log.changes, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showNotifications} onOpenChange={setShowNotifications}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications ({notifications.filter((n) => !n.read).length})</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ScrollArea className="h-[calc(100vh-120px)]">
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "border rounded-lg p-3 cursor-pointer hover:bg-muted/50",
                        !notif.read && "bg-blue-50 border-blue-200",
                      )}
                      onClick={() => {
                        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)))
                      }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-medium text-sm">{notif.title}</div>
                        {!notif.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(notif.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium">Editor Preferences</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Show grid</Label>
                  <Switch checked={showGrid} onCheckedChange={setShowGrid} disabled={!permissions.canChangeSettings} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Lock aspect ratio when resizing</Label>
                  <Switch
                    checked={lockAspectRatio}
                    onCheckedChange={setLockAspectRatio}
                    disabled={!permissions.canChangeSettings}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Auto-save enabled</Label>
                  <Switch checked={true} disabled={!permissions.canChangeSettings} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-medium">Default Values</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Default table capacity</Label>
                  <Input type="number" defaultValue="4" disabled={!permissions.canChangeSettings} />
                </div>
                <div className="space-y-2">
                  <Label>Default table shape</Label>
                  <Select defaultValue="rectangle" disabled={!permissions.canChangeSettings}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-medium">Notifications</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Email notifications</Label>
                  <Switch defaultChecked disabled={!permissions.canChangeSettings} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>In-app notifications</Label>
                  <Switch defaultChecked disabled={!permissions.canChangeSettings} />
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showHelp} onOpenChange={setShowHelp}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Help & Documentation</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ScrollArea className="h-[calc(100vh-120px)]">
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-3">Keyboard Shortcuts</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Undo</span>
                      <kbd className="px-2 py-1 bg-muted rounded">Ctrl+Z</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Redo</span>
                      <kbd className="px-2 py-1 bg-muted rounded">Ctrl+Shift+Z</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Save draft</span>
                      <kbd className="px-2 py-1 bg-muted rounded">Ctrl+S</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Delete selected</span>
                      <kbd className="px-2 py-1 bg-muted rounded">Delete</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Duplicate</span>
                      <kbd className="px-2 py-1 bg-muted rounded">Ctrl+D</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Select all</span>
                      <kbd className="px-2 py-1 bg-muted rounded">Ctrl+A</kbd>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-3">Tools</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-medium">Select Tool</div>
                      <p className="text-muted-foreground">
                        Click tables to select. Shift+click for multi-select. Drag to move.
                      </p>
                    </div>
                    <div>
                      <div className="font-medium">Pan Tool</div>
                      <p className="text-muted-foreground">
                        Click and drag to move around the canvas. Use mouse wheel to zoom.
                      </p>
                    </div>
                    <div>
                      <div className="font-medium">Add Table Tool</div>
                      <p className="text-muted-foreground">Click on canvas to place a new table.</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-3">Quick Start Guide</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Enter Draft Mode to start making changes</li>
                    <li>Use the toolbar to add tables and sections</li>
                    <li>Drag tables to arrange your floor plan</li>
                    <li>Resize tables using the corner handles</li>
                    <li>Review your changes before publishing</li>
                    <li>Publish when ready to make changes live</li>
                  </ol>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-3">Permissions</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Your role: <strong>{currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}</strong>
                    </p>
                    <div className="space-y-1 text-muted-foreground">
                      <div>✓ View published floors: {permissions.canViewPublished ? "Yes" : "No"}</div>
                      <div>✓ View drafts: {permissions.canViewDrafts ? "Yes" : "No"}</div>
                      <div>✓ Edit drafts: {permissions.canEditDrafts ? "Yes" : "No"}</div>
                      <div>✓ Publish changes: {permissions.canPublish ? "Yes" : "No (request approval)"}</div>
                      <div>✓ Delete tables: {permissions.canDelete ? "Yes" : "No"}</div>
                      <div>✓ View activity logs: {permissions.canViewLogs ? "Yes" : "No"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* This is already handled by the checkPermission function in handleDeleteTable */}
    </div>
  )
}
