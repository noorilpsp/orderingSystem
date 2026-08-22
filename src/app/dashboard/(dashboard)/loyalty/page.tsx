"use client"

import { useCallback, useEffect, useState } from "react"
import {
  LoyaltyProgramSettingsCard,
  LoyaltySampleDataBanner,
} from "@/components/dashboard/loyalty-program-settings-card"
import { LoyaltyRewardsManager } from "@/components/dashboard/loyalty-rewards-manager"
import { useTenant } from "@/lib/contexts/TenantContext"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import type { LoyaltyMemberRow } from "@/lib/loyalty/loyaltyMembersView"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Trophy, Users, Award, Percent, Gift, Coins, Star, CalendarIcon, Search, RotateCw, Download, Plus, ChevronDown, X, Target, UserPlus, BarChart3, FileText, FileSpreadsheet, TrendingUp, TrendingDown, ArrowUp, ArrowDown, MoreVertical, Eye, Edit, Copy, Trash2, Play, Pause, ChevronLeft, ChevronRight, AlertCircle, Filter, ArrowUpDown, Coffee, Cake, Pizza, Wine, Beer, IceCream, Sparkles, Zap, Crown, ArrowRight, ArrowLeft, Check, Info, CheckCircle, AlertTriangle, Settings, Clock, MapPin, GripVertical, Ticket, Minus, Lightbulb, ChevronUp, CalendarDays, Trash, Send, CheckCircleIcon, Activity, Flame, Mail, ShoppingBag, UserX, MessageSquare } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, BarChart, Bar, Area, AreaChart, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from "recharts"
import { format, formatDistanceToNow } from "date-fns"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"

// KPI Data
const loyaltyKPIs = [
  {
    id: "active_members",
    title: "Active Members",
    icon: Users,
    value: 2847,
    delta: 234,
    deltaPercent: 9.0,
    deltaLabel: "+234 vs last month",
    sparkline: [2400, 2510, 2580, 2620, 2710, 2780, 2847],
    subtitle: "Growth: +9.0% vs Last Month",
    iconColor: "hsl(var(--chart-1))",
  },
  {
    id: "avg_points",
    title: "Avg Points per Member",
    icon: Award,
    value: 458,
    delta: 23,
    deltaPercent: 5.3,
    deltaLabel: "+23 vs last month",
    sparkline: [435, 440, 448, 450, 453, 455, 458],
    subtitle: "Growth: +5.3% vs Last Month",
    iconColor: "hsl(var(--chart-2))",
  },
  {
    id: "redemption_rate",
    title: "Redemption Rate",
    icon: Percent,
    value: 68.5,
    unit: "%",
    delta: 3.2,
    deltaPercent: 4.9,
    deltaLabel: "+3.2% vs last month",
    sparkline: [70.2, 68.8, 67.5, 68.1, 68.2, 68.8, 69.5],
    subtitle: "vs Last Month",
    iconColor: "hsl(var(--chart-3))",
  },
  {
    id: "rewards_redeemed",
    title: "Rewards Redeemed",
    icon: Gift,
    value: 1456,
    delta: 178,
    deltaPercent: 13.9,
    deltaLabel: "+178 this month",
    sparkline: [1100, 1150, 1220, 1280, 1340, 1400, 1456],
    subtitle: "Top: Free Drink",
    subtitleExtra: "345 redeemed",
    iconColor: "hsl(var(--chart-4))",
  },
  {
    id: "points_issued",
    title: "Points Issued",
    icon: Coins,
    value: 1304000,
    valueFormatted: "1.3M",
    delta: 145000,
    deltaFormatted: "+145K",
    deltaPercent: 12.5,
    deltaLabel: "+145K this month",
    sparkline: [1100000, 1150000, 1180000, 1210000, 1245000, 1280000, 1304000],
    subtitle: "This Month",
    iconColor: "hsl(var(--chart-5))",
  },
  {
    id: "tier_engagement",
    title: "Tier Engagement",
    icon: Star,
    value: 82,
    unit: "%",
    delta: 5,
    deltaPercent: 6.5,
    deltaLabel: "+5% vs last month",
    sparkline: [76, 77.5, 78, 79.2, 80.5, 81, 82],
    subtitle: "Active Tiers: 4/5",
    miniBreakdown: [
      { tier: "Bronze", percent: 31, color: "hsl(28, 80%, 52%)" },
      { tier: "Silver", percent: 44, color: "hsl(0, 0%, 75%)" },
      { tier: "Gold", percent: 20, color: "hsl(45, 100%, 51%)" },
      { tier: "Platinum", percent: 5, color: "hsl(270, 60%, 70%)" },
    ],
    iconColor: "hsl(var(--chart-1))",
  },
]

// Filter Options
const tierOptions = [
  { label: "All Tiers", value: "all", count: 2847 },
  { label: "Bronze", value: "bronze", count: 892 },
  { label: "Silver", value: "silver", count: 1245 },
  { label: "Gold", value: "gold", count: 567 },
  { label: "Platinum", value: "platinum", count: 143 },
]

const rewardTypeOptions = [
  { label: "All Types", value: "all" },
  { label: "Discount", value: "discount", count: 45 },
  { label: "Free Item", value: "free_item", count: 23 },
  { label: "Special Access", value: "special_access", count: 12 },
  { label: "Points Multiplier", value: "points_multiplier", count: 8 },
]

const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "active", count: 2847 },
  { label: "Inactive", value: "inactive", count: 456 },
  { label: "Expired", value: "expired", count: 234 },
]

const tiersMockData = [
  {
    id: "tier-1",
    name: "Bronze",
    emoji: "🥉",
    subtitle: "Entry Level",
    pointsRequired: 0,
    pointsHelper: "Starting",
    benefits: [
      "5% discount on all orders",
      "Birthday reward",
      "Email updates",
      "Early access to new menu items",
      "Member-only promotions"
    ],
    memberCount: 892,
    memberPercent: 31.3,
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    createdAt: "2024-01-15",
    updatedAt: "2024-11-15",
    createdBy: "Admin"
  },
  {
    id: "tier-2",
    name: "Silver",
    emoji: "🥈",
    subtitle: "Regular",
    pointsRequired: 500,
    pointsHelper: "~6 visits",
    benefits: [
      "10% discount on all orders",
      "Priority seating",
      "Exclusive offers",
      "Free appetizer monthly",
      "Birthday surprise upgrade",
      "Access to member events"
    ],
    memberCount: 1245,
    memberPercent: 43.7,
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    createdAt: "2024-01-15",
    updatedAt: "2024-11-15",
    createdBy: "Admin"
  },
  {
    id: "tier-3",
    name: "Gold",
    emoji: "🥇",
    subtitle: "Premium",
    pointsRequired: 1500,
    pointsHelper: "~18 visits",
    benefits: [
      "15% discount on all orders",
      "Skip the line access",
      "Free dessert weekly",
      "2x points on purchases",
      "Exclusive events",
      "Complimentary drink with meal",
      "Personal thank you from chef"
    ],
    memberCount: 567,
    memberPercent: 19.9,
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    createdAt: "2024-01-15",
    updatedAt: "2024-11-15",
    createdBy: "Admin"
  },
  {
    id: "tier-4",
    name: "Platinum",
    emoji: "💎",
    subtitle: "Elite",
    pointsRequired: 3000,
    pointsHelper: "~35 visits",
    benefits: [
      "20% discount on all orders",
      "VIP lounge access",
      "Personal concierge",
      "Free meal monthly",
      "3x points on purchases",
      "Private dining events",
      "Complimentary valet"
    ],
    memberCount: 143,
    memberPercent: 5.0,
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    createdAt: "2024-01-15",
    updatedAt: "2024-11-15",
    createdBy: "Admin"
  },
  {
    id: "tier-5",
    name: "Diamond",
    emoji: "👑",
    subtitle: "Founder",
    pointsRequired: 5000,
    pointsHelper: "~60 visits",
    benefits: [
      "25% discount on all orders",
      "All Platinum benefits",
      "Plus exclusive perks"
    ],
    memberCount: 0,
    memberPercent: 0,
    status: "paused",
    statusLabel: "Coming Soon",
    statusColor: "warning",
    createdAt: "2024-01-15",
    updatedAt: "2024-11-15",
    createdBy: "Admin"
  }
]

const membersMockData = [
  {
    id: "member-1",
    name: "Sarah Mitchell",
    email: "sarah.m@email.com",
    phone: "+1 (555) 123-4567",
    avatar: "",
    tier: "Platinum",
    tierEmoji: "💎",
    tierId: "tier-4",
    points: 3456,
    pointsDelta: 125,
    pointsTrend: "up",
    rewardsRedeemed: 12,
    joinedDate: "2024-01-15",
    joinedDaysAgo: 315,
    lastVisit: "2024-11-14",
    lastVisitRelative: "2 days ago",
    activityStatus: "active",
    activityColor: "success"
  },
  {
    id: "member-2",
    name: "James Thompson",
    email: "james.t@email.com",
    phone: "+1 (555) 234-5678",
    avatar: "",
    tier: "Gold",
    tierEmoji: "🥇",
    tierId: "tier-3",
    points: 2134,
    pointsDelta: 89,
    pointsTrend: "up",
    rewardsRedeemed: 8,
    joinedDate: "2024-03-22",
    joinedDaysAgo: 243,
    lastVisit: "2024-11-11",
    lastVisitRelative: "5 days ago",
    activityStatus: "active",
    activityColor: "success"
  },
  {
    id: "member-3",
    name: "Emma Rodriguez",
    email: "emma.r@email.com",
    phone: "+1 (555) 345-6789",
    avatar: "",
    tier: "Silver",
    tierEmoji: "🥈",
    tierId: "tier-2",
    points: 876,
    pointsDelta: 45,
    pointsTrend: "up",
    rewardsRedeemed: 5,
    joinedDate: "2024-05-10",
    joinedDaysAgo: 194,
    lastVisit: "2024-11-09",
    lastVisitRelative: "1 week ago",
    activityStatus: "idle",
    activityColor: "warning"
  },
  {
    id: "member-4",
    name: "Michael Chen",
    email: "michael.c@email.com",
    phone: "+1 (555) 456-7890",
    avatar: "",
    tier: "Bronze",
    tierEmoji: "🥉",
    tierId: "tier-1",
    points: 234,
    pointsDelta: 12,
    pointsTrend: "up",
    rewardsRedeemed: 2,
    joinedDate: "2024-09-01",
    joinedDaysAgo: 76,
    lastVisit: "2024-10-26",
    lastVisitRelative: "3 weeks ago",
    activityStatus: "inactive",
    activityColor: "destructive"
  }
]

const rewardsMockData = [
  {
    id: "reward-1",
    name: "Free Coffee",
    emoji: "☕",
    description: "Any size, any blend",
    type: "Free Item",
    typeCategory: "Food & Beverage",
    typeIcon: Coffee,
    pointsCost: 50,
    pointsCostLevel: "low",
    visitEquivalent: "~1 visit",
    redemptionCount: 345,
    redemptionMax: 500,
    redemptionPercent: 69,
    redemptionTrend: "up",
    monetaryValue: "€3.50",
    valueFormatted: "€3.50 per redemption",
    valueType: "fixed",
    roi: 2.8,
    roiDelta: 0.3,
    roiTrend: "up",
    roiColor: "warning",
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    statusReason: "",
    availability: "All locations",
    created: "Jan 2024",
    createdBy: "Admin",
    dailyRedemptions: [5, 6, 8, 7, 9, 10, 12],
    popularityScore: 85,
    engagementRate: 69
  },
  {
    id: "reward-2",
    name: "10% Off Meal",
    emoji: "🍔",
    description: "Any menu item",
    type: "Discount",
    typeCategory: "Percentage",
    typeIcon: Percent,
    pointsCost: 100,
    pointsCostLevel: "low",
    visitEquivalent: "~2 visits",
    redemptionCount: 289,
    redemptionMax: 400,
    redemptionPercent: 72,
    redemptionTrend: "up",
    monetaryValue: "€2.80",
    valueFormatted: "€2.80 avg discount",
    valueType: "average",
    roi: 3.2,
    roiDelta: 0.5,
    roiTrend: "up",
    roiColor: "success",
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    statusReason: "",
    availability: "All locations",
    created: "Feb 2024",
    createdBy: "Admin",
    dailyRedemptions: [4, 5, 7, 6, 8, 9, 10],
    popularityScore: 78,
    engagementRate: 72
  },
  {
    id: "reward-3",
    name: "Skip the Line",
    emoji: "🎟️",
    description: "VIP priority access",
    type: "Special Access",
    typeCategory: "VIP",
    typeIcon: Sparkles,
    pointsCost: 200,
    pointsCostLevel: "medium",
    visitEquivalent: "~4 visits",
    redemptionCount: 178,
    redemptionMax: 200,
    redemptionPercent: 89,
    redemptionTrend: "up",
    monetaryValue: "Priceless",
    valueFormatted: "High demand",
    valueType: "qualitative",
    roi: 5.4,
    roiDelta: 1.2,
    roiTrend: "up",
    roiColor: "success",
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    statusReason: "",
    availability: "Fri-Sun only",
    created: "Jan 2024",
    createdBy: "Admin",
    dailyRedemptions: [2, 3, 5, 4, 6, 7, 8],
    popularityScore: 92,
    engagementRate: 89
  },
  {
    id: "reward-4",
    name: "Double Points",
    emoji: "💰",
    description: "2x points next visit",
    type: "Points Multiplier",
    typeCategory: "2x Bonus",
    typeIcon: Zap,
    pointsCost: 150,
    pointsCostLevel: "medium",
    visitEquivalent: "~3 visits",
    redemptionCount: 234,
    redemptionMax: 300,
    redemptionPercent: 78,
    redemptionTrend: "up",
    monetaryValue: "Variable",
    valueFormatted: "Increases engagement",
    valueType: "qualitative",
    roi: 2.1,
    roiDelta: 0.2,
    roiTrend: "up",
    roiColor: "warning",
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    statusReason: "",
    availability: "Valid 30 days",
    created: "Mar 2024",
    createdBy: "Admin",
    dailyRedemptions: [3, 4, 5, 5, 6, 7, 8],
    popularityScore: 75,
    engagementRate: 78
  },
  {
    id: "reward-5",
    name: "Free Dessert",
    emoji: "🍰",
    description: "Any dessert",
    type: "Free Item",
    typeCategory: "Food & Beverage",
    typeIcon: Cake,
    pointsCost: 75,
    pointsCostLevel: "low",
    visitEquivalent: "~1.5 visits",
    redemptionCount: 198,
    redemptionMax: 500,
    redemptionPercent: 40,
    redemptionTrend: "down",
    monetaryValue: "€5.50",
    valueFormatted: "€5.50 per redemption",
    valueType: "fixed",
    roi: 3.8,
    roiDelta: 0.8,
    roiTrend: "up",
    roiColor: "success",
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    statusReason: "",
    availability: "Dine-in only",
    created: "Jan 2024",
    createdBy: "Admin",
    dailyRedemptions: [2, 3, 3, 4, 4, 5, 6],
    popularityScore: 65,
    engagementRate: 40
  },
  {
    id: "reward-6",
    name: "Birthday Special",
    emoji: "🎂",
    description: "Free appetizer",
    type: "Discount",
    typeCategory: "Special Offer",
    typeIcon: Gift,
    pointsCost: 0,
    pointsCostLevel: "low",
    visitEquivalent: "Birthday month",
    redemptionCount: 892,
    redemptionMax: 1000,
    redemptionPercent: 89,
    redemptionTrend: "up",
    monetaryValue: "€8.00",
    valueFormatted: "€8.00 avg value",
    valueType: "average",
    roi: 4.2,
    roiDelta: 0.6,
    roiTrend: "up",
    roiColor: "success",
    status: "active",
    statusLabel: "Active",
    statusColor: "success",
    statusReason: "",
    availability: "Month of birthday",
    created: "Jan 2024",
    createdBy: "Admin",
    dailyRedemptions: [10, 12, 15, 14, 16, 18, 20],
    popularityScore: 95,
    engagementRate: 89
  },
  {
    id: "reward-7",
    name: "Wine Pairing",
    emoji: "🍷",
    description: "Expert sommelier",
    type: "Special Access",
    typeCategory: "Experience",
    typeIcon: Wine,
    pointsCost: 250,
    pointsCostLevel: "medium",
    visitEquivalent: "~5 visits",
    redemptionCount: 45,
    redemptionMax: 250,
    redemptionPercent: 18,
    redemptionTrend: "down",
    monetaryValue: "€12.00",
    valueFormatted: "€12.00 per redemption",
    valueType: "fixed",
    roi: 1.9,
    roiDelta: -0.2,
    roiTrend: "down",
    roiColor: "destructive",
    status: "warning",
    statusLabel: "Low Performance",
    statusColor: "warning",
    statusReason: "Low redemption rate",
    availability: "Dinner only",
    created: "Apr 2024",
    createdBy: "Admin",
    dailyRedemptions: [1, 1, 2, 1, 2, 1, 2],
    popularityScore: 35,
    engagementRate: 18
  },
  {
    id: "reward-8",
    name: "Founder's Club",
    emoji: "🏆",
    description: "Exclusive membership",
    type: "Special Access",
    typeCategory: "Elite",
    typeIcon: Crown,
    pointsCost: 5000,
    pointsCostLevel: "high",
    visitEquivalent: "~60 visits",
    redemptionCount: 0,
    redemptionMax: 50,
    redemptionPercent: 0,
    redemptionTrend: "neutral",
    monetaryValue: "Premium",
    valueFormatted: "Exclusive benefits",
    valueType: "qualitative",
    roi: 0,
    roiDelta: 0,
    roiTrend: "neutral",
    roiColor: "secondary",
    status: "coming_soon",
    statusLabel: "Coming Soon",
    statusColor: "secondary",
    statusReason: "Launching Q1 2025",
    availability: "Launching Q1 2025",
    created: "Nov 2024",
    createdBy: "Admin",
    dailyRedemptions: [0, 0, 0, 0, 0, 0, 0],
    popularityScore: 0,
    engagementRate: 0
  }
]

const redemptionAnalytics = {
  todayRedemptions: 47,
  todayDelta: 12,
  todayTrend: "up",
  avgDailyRedemptions: 48.5,
  avgDelta: 3.2,
  avgTrend: "up",
  mostPopularToday: {
    name: "Free Coffee",
    emoji: "☕",
    count: 12
  },
  categoryBreakdown: [
    { category: "Free Item", count: 543, percent: 37.3, color: "hsl(var(--chart-1))" },
    { category: "Discount", count: 612, percent: 42.0, color: "hsl(var(--chart-2))" },
    { category: "Special Access", count: 223, percent: 15.3, color: "hsl(var(--chart-3))" },
    { category: "Points Multiplier", count: 78, percent: 5.4, color: "hsl(var(--chart-4))" }
  ],
  dailyTrends: [
    { date: "Nov 1", redemptions: 35 },
    { date: "Nov 5", redemptions: 38 },
    { date: "Nov 10", redemptions: 42 },
    { date: "Nov 15", redemptions: 45 },
    { date: "Nov 20", redemptions: 48 },
    { date: "Nov 25", redemptions: 52 },
    { date: "Nov 30", redemptions: 58 }
  ]
}

const topPerformers = [
  { id: "reward-6", name: "Birthday Special", emoji: "🎂", redemptions: 892, rate: 89, roi: 4.2, rating: "Excellent" },
  { id: "reward-1", name: "Free Coffee", emoji: "☕", redemptions: 345, rate: 69, roi: 2.8, rating: "Very Good" },
  { id: "reward-2", name: "10% Off Meal", emoji: "🍔", redemptions: 289, rate: 72, roi: 3.2, rating: "Very Good" },
  { id: "reward-4", name: "Double Points", emoji: "💰", redemptions: 234, rate: 78, roi: 2.1, rating: "Good" },
  { id: "reward-5", name: "Free Dessert", emoji: "🍰", redemptions: 198, rate: 40, roi: 3.8, rating: "Fair" }
]

export default function LoyaltyPage() {
  const displayPhone = useDisplayPhone()
  const { currentMerchantId } = useTenant()
  const [searchQuery, setSearchQuery] = useState("")
  const [tierFilter, setTierFilter] = useState("all")
  const [rewardTypeFilter, setRewardTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dateRange, setDateRange] = useState({
    from: new Date(2024, 10, 1),
    to: new Date(2024, 10, 30),
  })

  const [activeTab, setActiveTab] = useState<"tiers" | "members" | "timeline" | "calendar" | "campaigns" | "analytics">("tiers")
  const [selectedTiers, setSelectedTiers] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [tiersPage, setTiersPage] = useState(1)
  const [membersPage, setMembersPage] = useState(1)
  const [isTableLoading, setIsTableLoading] = useState(false)
  const [membersSearchInput, setMembersSearchInput] = useState("")
  const [membersSearch, setMembersSearch] = useState("")
  const [loyaltyMembers, setLoyaltyMembers] = useState<LoyaltyMemberRow[]>([])
  const [membersTotalCount, setMembersTotalCount] = useState(0)
  const [membersFetchError, setMembersFetchError] = useState<string | null>(null)
  const itemsPerPage = 20

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMembersSearch(membersSearchInput.trim())
      setMembersPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [membersSearchInput])

  const fetchLoyaltyMembers = useCallback(async () => {
    if (!currentMerchantId) {
      setLoyaltyMembers([])
      setMembersTotalCount(0)
      return
    }
    setIsTableLoading(true)
    setMembersFetchError(null)
    try {
      const params = new URLSearchParams({
        merchantId: currentMerchantId,
        page: String(membersPage),
        pageSize: String(itemsPerPage),
      })
      if (membersSearch) params.set("search", membersSearch)
      const response = await fetch(`/api/loyalty/members?${params.toString()}`, {
        credentials: "include",
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to load members",
        )
      }
      const data = await response.json()
      setLoyaltyMembers(Array.isArray(data.members) ? data.members : [])
      setMembersTotalCount(typeof data.totalCount === "number" ? data.totalCount : 0)
    } catch (error) {
      setMembersFetchError(
        error instanceof Error ? error.message : "Failed to load members",
      )
      setLoyaltyMembers([])
      setMembersTotalCount(0)
    } finally {
      setIsTableLoading(false)
    }
  }, [currentMerchantId, itemsPerPage, membersPage, membersSearch])

  useEffect(() => {
    if (activeTab !== "members") return
    void fetchLoyaltyMembers()
  }, [activeTab, fetchLoyaltyMembers])

  const membersTotalPages = Math.max(1, Math.ceil(membersTotalCount / itemsPerPage))
  const membersPageStart =
    membersTotalCount === 0 ? 0 : (membersPage - 1) * itemsPerPage + 1
  const membersPageEnd = Math.min(membersPage * itemsPerPage, membersTotalCount)

  const [timelineView, setTimelineView] = useState<"aggregate" | "member">("aggregate")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [timelineGranularity, setTimelineGranularity] = useState<"day" | "week" | "month">("day")

  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month")
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2024, 10, 1))

  const [campaignTab, setCampaignTab] = useState<"active" | "scheduled" | "triggers">("active")

  // Rewards tab state
  const [rewardsPage, setRewardsPage] = useState(1)
  const [selectedRewards, setSelectedRewards] = useState<string[]>([])
  const [rewardTypeTab, setRewardTypeTab] = useState("all")
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false)

  // Tier Wizard State
  const [showTierWizard, setShowTierWizard] = useState(false)
  const [tierWizardStep, setTierWizardStep] = useState(1)
  const [tierFormData, setTierFormData] = useState({
    name: "",
    displayName: "",
    emoji: "🥈",
    color: "silver",
    shortDescription: "",
    fullDescription: "",
    pointsRequired: 500,
    autoUpgrade: true,
    manualApproval: false,
    allowDowngrade: false,
    benefits: [] as any[],
    activationType: "draft" as "immediate" | "draft" | "scheduled",
    scheduledDate: null as Date | null,
    notifications: {
      email: true,
      push: true,
      banner: true,
      autoEnroll: false,
    },
    // Added fields from the update
    description: "",
    minPoints: 0,
  })

  // Reward Wizard State
  const [showRewardWizard, setShowRewardWizard] = useState(false)
  const [rewardWizardStep, setRewardWizardStep] = useState(1)
  const [rewardFormData, setRewardFormData] = useState({
    type: "free-item" as "free-item" | "discount" | "special-access" | "points-multiplier",
    name: "",
    emoji: "☕",
    description: "",
    itemSelection: "specific" as "category" | "specific",
    category: "",
    selectedItems: [] as string[],
    sizeLimit: "any",
    modificationsAllowed: true,
    dineInOnly: false,
    excludeTakeout: false,
    pointsCost: 50,
    maxRedemptions: 500,
    perMemberLimit: 1,
    perMemberPeriod: "day" as "day" | "week" | "month",
    tierRestrictions: ["bronze", "silver", "gold", "platinum"],
    dateRange: { start: null as Date | null, end: null as Date | null },
    daysAvailable: "all" as "all" | "specific",
    specificDays: [] as string[],
    timeRestriction: "all-day" as "all-day" | "specific",
    timeRange: { start: "", end: "" },
    locationAvailability: "all" as "all" | "specific",
    specificLocations: [] as string[],
    orderTypes: { dineIn: true, takeout: true, delivery: true, mobile: true },
    minPurchase: 0,
    noCombine: false,
    activationType: "immediate" as "immediate" | "draft" | "scheduled",
    scheduledDate: null as Date | null,
    notifications: {
      email: true,
      push: true,
      feature: true,
    },
  })

  const [showTierDrawer, setShowTierDrawer] = useState(false)
  const [selectedTier, setSelectedTier] = useState<any>(null) // Renamed for clarity
  const [tierDrawerTab, setTierDrawerTab] = useState("overview")

  const [showRewardDrawer, setShowRewardDrawer] = useState(false)
  const [selectedReward, setSelectedReward] = useState<any>(null) // Renamed for clarity
  const [rewardDrawerTab, setRewardDrawerTab] = useState("overview")

  // Benefit Builder State
  const [editingBenefit, setEditingBenefit] = useState<number | null>(null)
  const [newBenefit, setNewBenefit] = useState({
    icon: "💰",
    title: "",
    description: "",
    priority: "medium" as "high" | "medium" | "low",
    active: true,
  })

  // Mock Data for Wizards
  const menuItems = [
    { id: "espresso", name: "Espresso", price: 2.50, category: "Beverages" },
    { id: "cappuccino", name: "Cappuccino", price: 3.50, category: "Beverages" },
    { id: "latte", name: "Latte", price: 3.50, category: "Beverages" },
    { id: "americano", name: "Americano", price: 2.80, category: "Beverages" },
    { id: "mocha", name: "Mocha", price: 4.00, category: "Beverages" },
    { id: "cold-brew", name: "Cold Brew", price: 4.50, category: "Beverages" },
  ]

  const locations = [
    { id: "downtown", name: "Downtown Location", address: "123 Main St" },
    { id: "westside", name: "Westside Branch", address: "456 Oak Ave" },
    { id: "eastside", name: "Eastside Branch", address: "789 Elm Rd" },
  ]

  // Calculator state
  const [calcAverageOrder, setCalcAverageOrder] = useState(25)
  const [calcPointsPerEuro, setCalcPointsPerEuro] = useState(10)

  const calculateVisitsNeeded = (points: number) => {
    if (calcAverageOrder === 0 || calcPointsPerEuro === 0) return 0
    return Math.ceil(points / (calcAverageOrder * calcPointsPerEuro))
  }

  const handleAddBenefit = () => {
    if (newBenefit.title) {
      setTierFormData({
        ...tierFormData,
        benefits: [...tierFormData.benefits, { ...newBenefit, id: Date.now() }]
      })
      setNewBenefit({
        icon: "💰",
        title: "",
        description: "",
        priority: "medium",
        active: true,
      })
    }
  }

  const handleRemoveBenefit = (index: number) => {
    const updated = [...tierFormData.benefits]
    updated.splice(index, 1)
    setTierFormData({ ...tierFormData, benefits: updated })
  }

  const handleMoveBenefit = (index: number, direction: "up" | "down") => {
    const updated = [...tierFormData.benefits]
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex >= 0 && newIndex < updated.length) {
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
      setTierFormData({ ...tierFormData, benefits: updated })
    }
  }

  const handleToggleItem = (itemId: string) => {
    const updated = rewardFormData.selectedItems.includes(itemId)
      ? rewardFormData.selectedItems.filter(id => id !== itemId)
      : [...rewardFormData.selectedItems, itemId]
    setRewardFormData({ ...rewardFormData, selectedItems: updated })
  }

  const calculateAverageItemValue = () => {
    if (rewardFormData.selectedItems.length === 0) return 0
    const total = rewardFormData.selectedItems.reduce((sum, id) => {
      const item = menuItems.find(m => m.id === id)
      return sum + (item?.price || 0)
    }, 0)
    return total / rewardFormData.selectedItems.length
  }

  const calculatePointValueRatio = () => {
    const avgValue = calculateAverageItemValue()
    if (rewardFormData.pointsCost === 0) return 0
    return avgValue / rewardFormData.pointsCost
  }

  const calculateProjectedRedemptions = () => {
    const weeklyRedemptions = rewardFormData.maxRedemptions > 0
      ? Math.min(50, rewardFormData.maxRedemptions / 10)
      : 50
    return {
      weekly: Math.floor(weeklyRedemptions),
      weeksToLimit: rewardFormData.maxRedemptions > 0 && weeklyRedemptions > 0
        ? Math.ceil(rewardFormData.maxRedemptions / weeklyRedemptions)
        : 0,
      totalCost: Math.floor(rewardFormData.maxRedemptions * calculateAverageItemValue()),
      roi: 2.5 + Math.random()
    }
  }

  const handleSelectAllTiers = (checked: boolean) => {
    if (checked) {
      setSelectedTiers(tiersMockData.map(t => t.id))
    } else {
      setSelectedTiers([])
    }
  }

  const handleSelectTier = (tierId: string, checked: boolean) => {
    if (checked) {
      setSelectedTiers([...selectedTiers, tierId])
    } else {
      setSelectedTiers(selectedTiers.filter(id => id !== tierId))
    }
  }

  const handleSelectAllMembers = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(loyaltyMembers.map((m) => m.id))
    } else {
      setSelectedMembers([])
    }
  }

  const handleSelectMember = (memberId: string, checked: boolean) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, memberId])
    } else {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId))
    }
  }

  // Reward selection handlers
  const handleSelectAllRewards = (checked: boolean) => {
    if (checked) {
      setSelectedRewards(rewardsMockData.map(r => r.id))
    } else {
      setSelectedRewards([])
    }
  }

  const handleSelectReward = (rewardId: string, checked: boolean) => {
    if (checked) {
      setSelectedRewards([...selectedRewards, rewardId])
    } else {
      setSelectedRewards(selectedRewards.filter(id => id !== rewardId))
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleTierWizardNext = () => {
    if (tierWizardStep < 4) {
      setTierWizardStep(tierWizardStep + 1)
    }
  }

  const handleTierWizardBack = () => {
    if (tierWizardStep > 1) {
      setTierWizardStep(tierWizardStep - 1)
    }
  }

  const handleTierWizardSaveDraft = () => {
    console.log("[v0] Saving tier draft:", tierFormData)
    setShowTierWizard(false)
    setTierWizardStep(1)
  }

  const handleTierWizardPublish = () => {
    console.log("[v0] Publishing tier:", tierFormData)
    setShowTierWizard(false)
    setTierWizardStep(1)
  }

  const handleRewardWizardNext = () => {
    if (rewardWizardStep < 5) {
      setRewardWizardStep(rewardWizardStep + 1)
    }
  }

  const handleRewardWizardBack = () => {
    if (rewardWizardStep > 1) {
      setRewardWizardStep(rewardWizardStep - 1)
    }
  }

  const handleRewardWizardSaveDraft = () => {
    console.log("[v0] Saving reward draft:", rewardFormData)
    setShowRewardWizard(false)
    setRewardWizardStep(1)
  }

  const handleRewardWizardPublish = () => {
    console.log("[v0] Publishing reward:", rewardFormData)
    setShowRewardWizard(false)
    setRewardWizardStep(1)
  }

  const handleUseRewardTemplate = (template: { emoji: string; name: string; type?: string; points?: number }) => {
    // Pre-fill form data based on template
    setRewardFormData({
      ...rewardFormData,
      emoji: template.emoji,
      name: template.name,
      type: template.type as any || 'free-item',
      pointsCost: template.points || 50,
    })
    setShowTemplatesDialog(false)
    setShowRewardWizard(true)
    setRewardWizardStep(1)
  }

  const handleViewTierDetails = (tier: any) => {
    setSelectedTier(tier)
    setShowTierDrawer(true)
  }

  const handleViewRewardDetails = (reward: any) => {
    setSelectedReward(reward)
    setShowRewardDrawer(true)
  }

  const aggregateTimelineData = {
    month: 'November 2024',
    dailyActivity: [
      { date: 'Nov 1', visits: 234, points: 2340, redemptions: 23, intensity: 85, events: ['tier_upgrades'] },
      { date: 'Nov 2', visits: 189, points: 1890, redemptions: 18, intensity: 68 },
      { date: 'Nov 3', visits: 156, points: 1560, redemptions: 15, intensity: 56 },
      { date: 'Nov 4', visits: 167, points: 1670, redemptions: 17, intensity: 60 },
      { date: 'Nov 5', visits: 198, points: 1980, redemptions: 20, intensity: 71 },
      { date: 'Nov 8', visits: 245, points: 2450, redemptions: 25, intensity: 89, events: ['newsletter'] },
      { date: 'Nov 15', visits: 278, points: 2780, redemptions: 28, intensity: 95, events: ['campaign_start'] },
      { date: 'Nov 22', visits: 312, points: 3120, redemptions: 31, intensity: 100 },
      { date: 'Nov 25', visits: 289, points: 2890, redemptions: 29, intensity: 98 },
    ],
    keyEvents: [
      { date: 'Nov 1', icon: '🎯', description: 'Silver Tier members +89', details: 'Bronze → Silver tier upgrades', metric: '94% retention' },
      { date: 'Nov 8', icon: '📧', description: 'Monthly newsletter sent', details: '2,847 members', metric: '68% open rate' },
      { date: 'Nov 15', icon: '🎁', description: 'Double Points Weekend started', details: 'All tiers eligible', metric: '+156% engagement' },
      { date: 'Nov 22', icon: '💎', description: 'Platinum tier milestone', details: '50+ new Platinum members', metric: '€45K revenue' },
    ]
  }

  const memberTimelineData = {
    id: 'MBR-2024-00142',
    name: 'Sarah Mitchell',
    avatar: '/placeholder.svg?height=40&width=40',
    tier: { name: 'Platinum', icon: '💎', color: 'bg-purple-600' },
    points: 3456,
    memberSince: '2024-01-15',
    tierHistory: [
      { tier: 'Bronze', icon: '🥉', date: '2024-01-15', day: 1, points: 0 },
      { tier: 'Silver', icon: '🥈', date: '2024-03-01', day: 45, points: 500 },
      { tier: 'Gold', icon: '🥇', date: '2024-05-15', day: 120, points: 1500 },
      { tier: 'Platinum', icon: '💎', date: '2024-09-20', day: 240, points: 3000 }
    ],
    recentActivity: [
      {
        date: '2024-11-20',
        time: '6:45 PM',
        type: 'redemption',
        icon: '🎁',
        reward: 'Skip the Line VIP',
        pointsCost: 200,
        details: { orderTotal: 125.00, tip: 25.00, partySize: 4, pointsEarned: 125 }
      },
      {
        date: '2024-11-18',
        time: '7:30 PM',
        type: 'visit',
        icon: '🍽️',
        details: { orderTotal: 98.50, pointsEarned: 98 }
      },
      {
        date: '2024-11-15',
        time: '12:15 PM',
        type: 'redemption',
        icon: '🎁',
        reward: '10% Off Entire Meal',
        pointsCost: 100,
        details: { orderTotal: 67.00, discount: 7.40, pointsEarned: 67 }
      },
    ],
    metrics: {
      visitFrequency: { value: 2.8, unit: 'per week', vsAverage: '+18%', trend: 'up' },
      avgOrderValue: { value: 98.50, currency: '€', vsAverage: '+35%', trend: 'up' },
      pointsBalance: { value: 3456, percentile: 92 },
      redemptionCount: { value: 12, label: 'rewards redeemed' },
      emailEngagement: { openRate: 85, clickRate: 62 },
      retentionPrediction: { score: 94, label: 'High' }
    },
    upcomingMilestones: [
      { label: 'Next tier bonus', progress: 78, pointsNeeded: 456, daysEstimate: 12 },
      { label: 'Birthday reward unlock', progress: 45, daysUntil: 28 },
    ]
  }

  const calendarData = {
    month: 'November 2024',
    days: [
      { date: '2024-11-01', dayNumber: 1, isToday: false, points: 2.3, members: 234, events: [{ icon: '🎯', count: 89, label: 'tier upgrades' }] },
      { date: '2024-11-02', dayNumber: 2, isToday: false, points: 1.9, members: 189, events: [] },
      { date: '2024-11-03', dayNumber: 3, isToday: false, points: 1.6, members: 156, events: [] },
      { date: '2024-11-08', dayNumber: 8, isToday: false, points: 2.5, members: 245, events: [{ icon: '📧', count: 1, label: 'newsletter' }] },
      { date: '2024-11-15', dayNumber: 15, isToday: false, points: 2.8, members: 278, events: [{ icon: '🎁', count: 1, label: 'campaign' }] },
      { date: '2024-11-20', dayNumber: 20, isToday: true, points: 2.1, members: 210, events: [] },
      { date: '2024-11-25', dayNumber: 25, isToday: false, points: 4.0, members: 401, events: [] },
    ],
    summary: {
      totalPoints: 84560,
      totalMembers: 8934,
      avgPointsPerDay: 2819,
      peakDay: { date: 'Nov 25', points: 4010, members: 401 }
    }
  }

  const activeCampaigns = [
    {
      id: 'camp_001',
      name: 'Birthday Month Rewards',
      icon: '🎂',
      status: 'active',
      description: 'Automatic birthday rewards sent to members',
      duration: 'Nov 1-30, 2024',
      target: 'All tiers • Birthday members only',
      performance: {
        eligible: 67,
        redemptions: 63,
        redemptionRate: 94,
        avgOrderValue: 45,
        revenueLift: 2835
      }
    },
    {
      id: 'camp_002',
      name: 'Double Points Weekend',
      icon: '⭐',
      status: 'active',
      description: 'Earn 2x points on all purchases',
      duration: 'Nov 15-17, 2024',
      target: 'All tiers • All members',
      performance: {
        participants: 1243,
        bonusPoints: 24860,
        participationRate: 68,
        avgVisitsPerMember: 1.8
      }
    },
    {
      id: 'camp_003',
      name: 'Monthly Newsletter',
      icon: '📧',
      status: 'active',
      description: 'November loyalty program updates',
      duration: 'Nov 8, 2024',
      target: 'All tiers • Active members',
      performance: {
        sent: 2847,
        opens: 1936,
        clicks: 582,
        openRate: 68,
        clickRate: 20
      }
    }
  ]

  const scheduledCampaigns = [
    {
      id: 'camp_004',
      name: 'Holiday Shopping Bonus',
      icon: '🎄',
      status: 'scheduled',
      description: 'Bonus points for December purchases',
      startDate: 'Dec 1, 2024',
      endDate: 'Dec 31, 2024',
      target: 'Gold & Platinum tiers',
      estimatedImpact: {
        expectedParticipants: 890,
        estimatedRevenue: 125000,
        budgetedPoints: 45000
      }
    },
    {
      id: 'camp_005',
      name: 'New Year Tier Boost',
      icon: '🎆',
      status: 'scheduled',
      description: 'Fast-track tier upgrades in January',
      startDate: 'Jan 1, 2025',
      endDate: 'Jan 31, 2025',
      target: 'Bronze & Silver tiers',
      estimatedImpact: {
        expectedUpgrades: 450,
        estimatedRevenue: 78000,
        budgetedPoints: 22500
      }
    }
  ]

  const automatedTriggers = [
    {
      id: 'trigger_001',
      name: 'Birthday Reward',
      icon: '🎂',
      trigger: 'Member birthday',
      action: 'Send free dessert reward + 100 bonus points',
      status: 'active',
      stats: { triggered: 67, redeemed: 63, successRate: 94, avgEngagement: 85 },
      lastTriggered: 'Nov 18, 2024'
    },
    {
      id: 'trigger_002',
      name: 'Tier Upgrade Celebration',
      icon: '🏆',
      trigger: 'Member reaches new tier',
      action: 'Send congratulations email + tier welcome bonus',
      status: 'active',
      stats: { triggered: 156, redeemed: 142, successRate: 91, avgEngagement: 92 },
      lastTriggered: 'Nov 22, 2024'
    },
    {
      id: 'trigger_003',
      name: 'Inactive Member Re-engagement',
      icon: '🔔',
      trigger: 'No visit in 30 days',
      action: 'Send 20% off reward + personalized message',
      status: 'active',
      stats: { triggered: 234, redeemed: 89, successRate: 38, avgEngagement: 45 },
      lastTriggered: 'Nov 10, 2024'
    },
    {
      id: 'trigger_004',
      name: 'Points Expiration Warning',
      icon: '⏳',
      trigger: 'Points expiring within 7 days',
      action: 'Send reminder email with quick-redeem options',
      status: 'active',
      stats: { triggered: 456, redeemed: 312, successRate: 68, avgEngagement: 75 },
      lastTriggered: 'Nov 25, 2024'
    },
    {
      id: 'trigger_005',
      name: 'High-Value Customer Recognition',
      icon: '💎',
      trigger: 'Order total > €150',
      action: 'Send thank you + 2x points bonus',
      status: 'active',
      stats: { triggered: 89, redeemed: 76, successRate: 85, avgEngagement: 90 },
      lastTriggered: 'Nov 19, 2024'
    }
  ]

  const heatmapData = {
    hours: ['6AM', '7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM', '9PM', '10PM', '11PM'],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: [
      [10, 12, 25, 45, 50, 60, 78, 55, 35, 30, 35, 45, 95, 85, 70, 60, 45, 25], // Monday
      [12, 15, 28, 48, 52, 62, 80, 58, 38, 32, 38, 48, 92, 82, 68, 58, 42, 22], // Tuesday
      [15, 18, 30, 50, 55, 65, 82, 60, 40, 35, 40, 50, 98, 88, 72, 62, 48, 28], // Wednesday
      [10, 13, 26, 46, 48, 58, 76, 52, 32, 28, 32, 42, 88, 78, 65, 55, 40, 20], // Thursday
      [18, 22, 35, 55, 60, 70, 88, 65, 45, 40, 45, 55, 100, 95, 80, 70, 55, 35], // Friday
      [25, 30, 45, 65, 75, 85, 95, 80, 60, 55, 60, 70, 98, 92, 85, 78, 65, 45], // Saturday
      [22, 28, 42, 62, 72, 82, 90, 90, 60, 40, 25, 35, 95, 100, 90, 70, 35, 15], // Sunday
    ]
  }

  const getIntensityColor = (intensity: number) => {
    if (intensity < 20) return 'bg-gray-100'
    if (intensity < 40) return 'bg-orange-200'
    if (intensity < 60) return 'bg-orange-400'
    if (intensity < 80) return 'bg-red-400'
    return 'bg-red-600'
  }

  // --- NEW MOCK DATA AND HELPER FUNCTIONS ---

  // Redemption Calendar Data (for week view)
  type RedemptionCalendarEntry = { reward: string; count: number } | null

  const redemptionCalendarData = {
    weekOf: 'Nov 18-24, 2024',
    days: ['Mon 18', 'Tue 19', 'Wed 20', 'Thu 21', 'Fri 22', 'Sat 23', 'Sun 24'],
    hours: ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '5 PM', '6 PM', '7 PM', '8 PM'],
    redemptions: {
      '8 AM': [null, null, null, null, null, { reward: '☕ Free Coffee', count: 3 }, { reward: '☕ Free Coffee', count: 2 }],
      '9 AM': [{ reward: '☕ Free Coffee', count: 2 }, { reward: '☕ Free Coffee', count: 1 }, { reward: '☕ Free Coffee', count: 4 }, null, { reward: '☕ Free Coffee', count: 3 }, { reward: '☕ Free Coffee', count: 5 }, null],
      '10 AM': [null, null, null, null, null, null, null],
      '11 AM': [null, null, null, null, null, null, null],
      '12 PM': [{ reward: '🍔 10% Off', count: 8 }, { reward: '🍔 10% Off', count: 6 }, { reward: '🍔 10% Off', count: 12 }, { reward: '🍔 10% Off', count: 7 }, { reward: '🍔 10% Off', count: 15 }, { reward: '🍔 10% Off', count: 18 }, { reward: '🍔 10% Off', count: 14 }],
      '1 PM': [null, null, null, null, null, null, null],
      '2 PM': [null, null, null, null, null, null, null],
      '5 PM': [null, null, null, null, { reward: '🍰 Free Dessert', count: 4 }, { reward: '🍰 Free Dessert', count: 7 }, { reward: '🍰 Free Dessert', count: 5 }],
      '6 PM': [{ reward: '🎟️ Skip Line', count: 5 }, null, { reward: '🎟️ Skip Line', count: 8 }, null, { reward: '🎟️ Skip Line', count: 12 }, { reward: '🎟️ Skip Line', count: 15 }, { reward: '🎟️ Skip Line', count: 11 }],
      '7 PM': [null, { reward: '💰 2x Points', count: 6 }, null, { reward: '💰 2x Points', count: 8 }, null, { reward: '💰 2x Points', count: 14 }, null],
      '8 PM': [null, null, null, null, null, null, null],
    } as Record<string, RedemptionCalendarEntry[]>,
    summary: {
      total: 289,
      mostPopular: { name: '10% Off Meal', count: 80 },
      peakTime: 'Friday 6-7 PM (27 redemptions)',
      peakDay: { name: 'Saturday', count: 78 }
    }
  }

  // Tier Progression Data
  const tierProgressionData = {
    members: [
      {
        name: 'Sarah Mitchell',
        points: 3456,
        journey: [
          { tier: '🥉 Bronze', start: 0, duration: 45, color: 'bg-orange-600' },
          { tier: '🥈 Silver', start: 45, duration: 75, color: 'bg-slate-400' },
          { tier: '🥇 Gold', start: 120, duration: 120, color: 'bg-yellow-500' },
          { tier: '💎 Platinum', start: 240, duration: 75, color: 'bg-purple-600' }
        ]
      },
      {
        name: 'James Thompson',
        points: 2134,
        journey: [
          { tier: '🥉 Bronze', start: 0, duration: 60, color: 'bg-orange-600' },
          { tier: '🥈 Silver', start: 60, duration: 120, color: 'bg-slate-400' },
          { tier: '🥇 Gold', start: 180, duration: 135, color: 'bg-yellow-500' }
        ]
      },
      {
        name: 'Emma Rodriguez',
        points: 876,
        journey: [
          { tier: '🥉 Bronze', start: 0, duration: 90, color: 'bg-orange-600' },
          { tier: '🥈 Silver', start: 90, duration: 225, color: 'bg-slate-400' }
        ]
      },
      {
        name: 'Michael Chen',
        points: 234,
        journey: [
          { tier: '🥉 Bronze', start: 0, duration: 315, color: 'bg-orange-600' }
        ]
      },
      {
        name: 'Lisa Park',
        points: 2890,
        journey: [
          { tier: '🥉 Bronze', start: 0, duration: 30, color: 'bg-orange-600' },
          { tier: '🥈 Silver', start: 30, duration: 120, color: 'bg-slate-400' },
          { tier: '🥇 Gold', start: 150, duration: 165, color: 'bg-yellow-500', note: '110 pts to Platinum' }
        ]
      }
    ],
    insights: [
      'Average time Bronze → Silver: 45 days',
      'Average time Silver → Gold: 75 days',
      'Average time Gold → Platinum: 120 days',
      '445 members on track to reach next tier within 30 days',
      '67 members at risk of tier downgrade (below activity threshold)'
    ]
  }

  // Churn Prediction Data
  const churnPredictionData = [
    {
      id: 'MBR-2024-00789',
      name: 'David Martinez',
      tier: 'Gold',
      tierIcon: '🥇',
      currentPoints: 1589,
      pointsNeeded: 411,
      daysUntilDowngrade: 12,
      riskLevel: 'high',
      visitFrequency: { current: '0.8 per week', previous: '2.1 per week', decline: -62 },
      lastVisit: '18 days ago',
      recommendedAction: 'Send exclusive Gold member offer'
    },
    {
      id: 'MBR-2024-01234',
      name: 'Rachel Kim',
      tier: 'Platinum',
      tierIcon: '💎',
      currentPoints: 3089,
      pointsNeeded: 211,
      daysUntilDowngrade: 18,
      riskLevel: 'medium',
      visitFrequency: { current: '1.2 per week', previous: '2.8 per week', decline: -57 },
      lastVisit: '12 days ago',
      recommendedAction: 'Personal outreach from manager'
    },
    {
      id: 'MBR-2024-00567',
      name: 'Tom Wilson',
      tier: 'Silver',
      tierIcon: '🥈',
      currentPoints: 534,
      pointsNeeded: 34,
      daysUntilDowngrade: 24,
      riskLevel: 'medium',
      visitFrequency: { current: '1.5 per week', previous: '2.4 per week', decline: -38 },
      lastVisit: '8 days ago',
      recommendedAction: 'Send birthday month preview'
    }
  ]

  // Activity Heatmap Data
  const activityHeatmapData = {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    hours: ['6AM', '7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM', '9PM', '10PM', '11PM'],
    intensity: [
      // Monday through Sunday, each array represents one day's hourly intensity (0-100)
      [5, 5, 15, 30, 45, 70, 85, 80, 50, 30, 15, 25, 85, 90, 65, 40, 20, 5],
      [5, 5, 15, 30, 45, 70, 85, 80, 50, 30, 15, 25, 85, 90, 65, 40, 20, 5],
      [5, 5, 15, 30, 45, 70, 85, 80, 50, 30, 15, 25, 85, 90, 65, 40, 20, 5],
      [5, 5, 15, 30, 45, 70, 85, 80, 50, 30, 15, 25, 85, 90, 65, 40, 20, 5],
      [5, 5, 15, 30, 45, 70, 85, 80, 50, 30, 15, 35, 90, 95, 85, 60, 30, 10],
      [5, 5, 20, 40, 60, 80, 90, 90, 60, 40, 25, 35, 95, 100, 90, 70, 35, 15],
      [5, 5, 20, 40, 60, 80, 90, 90, 60, 40, 25, 35, 95, 100, 90, 70, 35, 15]
    ],
    insights: [
      'Peak hours: 6-8 PM daily (especially Fri-Sun)',
      'Lunch rush: 12-1 PM consistent across all days',
      'Weekend mornings: Higher brunch activity (9-11 AM)',
      'Late night: Minimal activity after 10 PM',
      'Opportunity: Thursday evenings underperforming vs other weekdays'
    ]
  }

  // Helper functions for heatmap colors
  const getHeatmapColor = (intensity: number) => {
    if (intensity >= 90) return 'bg-red-600'
    if (intensity >= 70) return 'bg-orange-500'
    if (intensity >= 50) return 'bg-yellow-500'
    if (intensity >= 30) return 'bg-green-500'
    if (intensity >= 15) return 'bg-blue-500'
    return 'bg-slate-200'
  }

  // New sidebar and insights state
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState("12s ago")
  const [analyticsTab, setAnalyticsTab] = useState<"overview" | "members" | "tiers" | "rewards" | "revenue" | "predictions" | "custom">("overview")
  const [showReportBuilder, setShowReportBuilder] = useState(false)
  const [reportBuilderStep, setReportBuilderStep] = useState(1)
  const [topPerformersFilter, setTopPerformersFilter] = useState<"members" | "rewards" | "campaigns">("members")
  const [topPerformersTimeframe, setTopPerformersTimeframe] = useState("this-month")
  // State for new dialogs
  const [showTierCreation, setShowTierCreation] = useState(false)
  const [showRewardCreation, setShowRewardCreation] = useState(false)
  const [selectedRewardDetails, setSelectedRewardDetails] = useState<typeof topPerformers[0] | null>(null)

  // Member Profile Drawer
  const [showMemberProfile, setShowMemberProfile] = useState(false)
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<any>(null)
  const [memberProfileTab, setMemberProfileTab] = useState<"overview" | "activity" | "points" | "communications" | "notes" | "history">("overview")
  
  // Points Adjustment Modal
  const [showPointsAdjustment, setShowPointsAdjustment] = useState(false)
  const [pointsAdjustmentType, setPointsAdjustmentType] = useState<"add" | "remove">("add")
  const [pointsAdjustmentAmount, setPointsAdjustmentAmount] = useState("")
  const [pointsAdjustmentReason, setPointsAdjustmentReason] = useState("")
  const [pointsAdjustmentCategory, setPointsAdjustmentCategory] = useState("")
  const [sendNotification, setSendNotification] = useState(true)

  // Notes
  const [newNote, setNewNote] = useState("")
  const [noteImportant, setNoteImportant] = useState(false)
  const [noteNotifyTeam, setNoteNotifyTeam] = useState(false)
  const [noteFollowUp, setNoteFollowUp] = useState(false)

  // Settings & Configuration
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"general" | "points-rules" | "tiers" | "rewards" | "notifications" | "integrations" | "advanced">("general")
  
  // Email Templates
  const [showEmailTemplates, setShowEmailTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  
  // Audit Log
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [auditLogFilter, setAuditLogFilter] = useState("all")
  const [auditLogUserFilter, setAuditLogUserFilter] = useState("all")
  const [auditLogTimeFilter, setAuditLogTimeFilter] = useState("last-30-days")

  // Mock data for member profile
  const mockMemberProfile = {
    id: "MBR-2024-00142",
    name: "Sarah Mitchell",
    email: "sarah.mitchell@email.com",
    phone: "+1 (555) 123-4567",
    birthday: "March 15, 1988",
    joined: "January 15, 2024",
    tier: "Platinum",
    tierEmoji: "💎",
    points: 3456,
    healthScore: 98,
    churnRisk: 2,
    totalVisits: 145,
    totalSpent: 12450,
    avgOrderValue: 85.86,
    lifetimeValue: 12450,
    predictedLtv12mo: 15680,
    predictedLtv24mo: 32450,
    favoriteItems: ["Grilled Salmon", "Caesar Salad", "Margherita Pizza"],
    tags: ["VIP", "High-Value", "Frequent Diner", "Email Engaged", "Social Referrer"],
    preferences: {
      email: true,
      sms: true,
      push: true,
      marketing: true,
      preferredContact: "Email"
    }
  }

  return (
    <>
      <div className="flex h-full min-h-0 w-full max-w-full overflow-hidden">
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="bg-background p-6">
        <LoyaltyProgramSettingsCard />
        <LoyaltyRewardsManager />
        <LoyaltySampleDataBanner />
        {/* Header */}
        <header
          role="banner"
          aria-label="Loyalty and rewards page header"
          className="space-y-4"
        >
          {/* Title Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy
                className="h-8 w-8"
                style={{ color: "hsl(var(--chart-4))" }}
                aria-hidden="true"
              />
              <h1 id="page-title" className="text-3xl font-bold">
                Loyalty & Rewards
              </h1>
            </div>
          </div>

          {/* Controls Row 1 - Date Range & Search */}
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal sm:w-[280px]"
                  aria-label="Select date range"
                  aria-expanded="false"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {dateRange.from && dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} -{" "}
                      {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    <span>Pick a date range</span>
                  )}
                  <ChevronDown className="ml-auto h-4 w-4" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Quick Presets</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" size="sm" className="justify-start">
                        Today
                      </Button>
                      <Button variant="ghost" size="sm" className="justify-start">
                        Yesterday
                      </Button>
                      <Button variant="ghost" size="sm" className="justify-start">
                        Last 7 days
                      </Button>
                      <Button variant="ghost" size="sm" className="justify-start">
                        Last 30 days
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="justify-start"
                      >
                        This Month ✓
                      </Button>
                      <Button variant="ghost" size="sm" className="justify-start">
                        Last Month
                      </Button>
                    </div>
                  </div>
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    numberOfMonths={2}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1">
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search members, tiers, rewards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
                aria-label="Search loyalty data"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Controls Row 2 - Filters & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tier Filter */}
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by tier">
                <Target className="mr-2 h-4 w-4" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tierOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.count && (
                      <span className="ml-2 text-muted-foreground">
                        ({option.count})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reward Type Filter */}
            <Select
              value={rewardTypeFilter}
              onValueChange={setRewardTypeFilter}
            >
              <SelectTrigger
                className="w-[160px]"
                aria-label="Filter by reward type"
              >
                <Gift className="mr-2 h-4 w-4" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rewardTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.count && (
                      <span className="ml-2 text-muted-foreground">
                        ({option.count})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-[140px]"
                aria-label="Filter by status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.count && (
                      <span className="ml-2 text-muted-foreground">
                        ({option.count})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label="Refresh loyalty data"
                className="transition-transform"
                style={{
                  transform: isRefreshing ? "rotate(360deg)" : "rotate(0deg)",
                  transition: "transform 500ms",
                }}
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>
                    <FileText className="mr-2 h-4 w-4" />
                    Export Members CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileText className="mr-2 h-4 w-4" />
                    Export Tiers Report PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export Analytics Excel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Export Settings</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem checked>
                    Include points history
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked>
                    Include redemption data
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem>
                    Include member demographics
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* KPI Cards Section */}
        <section aria-labelledby="kpi-section-title">
          <h2 id="kpi-section-title" className="sr-only">
            Key Performance Indicators
          </h2>

          <div
            role="list"
            aria-label="Loyalty metrics"
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {loyaltyKPIs.map((kpi, index) => {
              const Icon = kpi.icon
              const chartData = kpi.sparkline.map((value, i) => ({
                value,
                index: i,
              }))

              return (
                <Card
                  key={kpi.id}
                  role="listitem"
                  aria-labelledby={`kpi-${kpi.id}-title`}
                  className="group transition-all duration-200 hover:shadow-md hover:border-opacity-30"
                  style={{
                    animation: `fadeIn 300ms ease-out ${index * 50}ms both`,
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle
                      id={`kpi-${kpi.id}-title`}
                      className="text-sm font-medium"
                    >
                      {kpi.title}
                    </CardTitle>
                    <Icon
                      className="h-4 w-4"
                      style={{ color: kpi.iconColor }}
                      aria-hidden="true"
                    />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Value & Delta */}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">
                          {kpi.valueFormatted || kpi.value.toLocaleString()}
                          {kpi.unit}
                        </span>
                      </div>
                      <div
                        className="mt-1 flex items-center gap-1 text-sm text-success"
                        aria-label={`Increased by ${kpi.delta} compared to last period`}
                      >
                        <TrendingUp className="h-3 w-3" aria-hidden="true" />
                        <span className="font-medium">
                          {kpi.deltaFormatted || `+${kpi.delta.toLocaleString()}`}
                        </span>
                        <span className="text-muted-foreground">
                          (+{kpi.deltaPercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div aria-label={`Sparkline showing ${kpi.title} trend`}>
                      <ResponsiveContainer width="100%" height={60}>
                        <LineChart data={chartData}>
                          <XAxis dataKey="index" hide />
                          <YAxis hide domain={["dataMin", "dataMax"]} />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={kpi.iconColor}
                            strokeWidth={2}
                            dot={{ r: 3, fill: kpi.iconColor }}
                            activeDot={{ r: 4 }}
                            style={{
                              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Subtitle */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {kpi.subtitle}
                      </p>
                      {kpi.subtitleExtra && (
                        <p className="text-xs text-muted-foreground">
                          {kpi.subtitleExtra}
                        </p>
                      )}
                    </div>

                    {/* Mini Breakdown for Tier Engagement */}
                    {kpi.miniBreakdown && (
                      <div className="space-y-2">
                        {kpi.miniBreakdown.map((tier) => (
                          <div key={tier.tier} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span>{tier.tier}</span>
                              <span className="text-muted-foreground">
                                {tier.percent}%
                              </span>
                            </div>
                            <Progress
                              value={tier.percent}
                              className="h-2"
                              style={
                                {
                                  "--progress-background": tier.color,
                                } as React.CSSProperties
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* NEW Rewards Catalog Section */}
        <section aria-labelledby="rewards-section-title" className="space-y-6">
          <div className="flex items-center gap-3">
            <Gift className="h-7 w-7" style={{ color: "hsl(var(--chart-4))" }} />
            <h2 id="rewards-section-title" className="text-2xl font-bold">
              Rewards Catalog & Analytics
            </h2>
          </div>

          {/* Redemption Analytics Dashboard */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Redemption Analytics
                  </CardTitle>
                  <CardDescription>Last 30 Days Performance</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue="30days">
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Top 3 KPI Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Today's Redemptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{redemptionAnalytics.todayRedemptions}</div>
                    <div className="mt-1 flex items-center gap-1 text-sm text-success">
                      <TrendingUp className="h-3 w-3" />
                      <span>+{redemptionAnalytics.todayDelta} vs yesterday</span>
                    </div>
                    <ResponsiveContainer width="100%" height={40} className="mt-2">
                      <LineChart data={redemptionAnalytics.dailyTrends}>
                        <Line type="monotone" dataKey="redemptions" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Daily Redemptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{redemptionAnalytics.avgDailyRedemptions}</div>
                    <div className="mt-1 flex items-center gap-1 text-sm text-success">
                      <TrendingUp className="h-3 w-3" />
                      <span>+{redemptionAnalytics.avgDelta} vs last week</span>
                    </div>
                    <ResponsiveContainer width="100%" height={40} className="mt-2">
                      <AreaChart data={redemptionAnalytics.dailyTrends}>
                        <Area type="monotone" dataKey="redemptions" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Most Popular Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{redemptionAnalytics.mostPopularToday.emoji}</span>
                      <div>
                        <div className="font-semibold">{redemptionAnalytics.mostPopularToday.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {redemptionAnalytics.mostPopularToday.count} redemptions today
                        </div>
                      </div>
                    </div>
                    <Button variant="link" className="mt-2 h-auto p-0">
                      View Details →
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Category Breakdown */}
              <div>
                <h3 className="mb-3 font-semibold">Redemptions by Category (Last 30 Days)</h3>
                <div className="space-y-3">
                  {redemptionAnalytics.categoryBreakdown.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{cat.category}:</span>
                        <span className="text-muted-foreground">
                          {cat.count} ({cat.percent}%)
                        </span>
                      </div>
                      <Progress
                        value={cat.percent}
                        className="h-3"
                        style={{
                          // @ts-ignore
                          "--progress-background": cat.color,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend Chart */}
              <div>
                <h3 className="mb-3 font-semibold">Redemption Trends (Daily, Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={redemptionAnalytics.dailyTrends}>
                    <defs>
                      <linearGradient id="colorRedemptions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="redemptions" stroke="hsl(var(--chart-1))" fillOpacity={1} fill="url(#colorRedemptions)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Performers Sidebar - shown as card on mobile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Top Performing Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topPerformers.map((performer, idx) => (
                <div key={performer.id}>
                  {idx > 0 && <Separator className="my-4" />}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-muted-foreground">{idx + 1}.</span>
                      <span className="text-xl">{performer.emoji}</span>
                      <span className="font-semibold">{performer.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {performer.redemptions} redemptions • {performer.rate}% rate • {performer.roi}x ROI
                    </div>
                    <Progress value={performer.rate} className="h-2" />
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{performer.rating}</Badge>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0"
                        onClick={() => setSelectedRewardDetails(performer)}
                      >
                        View Details →
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Rewards Catalog Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  <CardTitle>Rewards Catalog</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="search"
                    placeholder="Search rewards..."
                    className="w-[200px]"
                  />
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                  <Button size="sm" onClick={() => setShowTemplatesDialog(true)}> {/* Changed from setShowRewardWizard */}
                    <Plus className="mr-2 h-4 w-4" />
                    New Reward
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Select defaultValue="all-types" value={rewardTypeTab} onValueChange={setRewardTypeTab}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-types">All Types</SelectItem>
                      <SelectItem value="free-item">Free Item</SelectItem>
                      <SelectItem value="discount">Discount</SelectItem>
                      <SelectItem value="special-access">Special Access</SelectItem>
                      <SelectItem value="points-multiplier">Points Multiplier</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="active-only">
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active-only">Active Only</SelectItem>
                      <SelectItem value="all-status">All Status</SelectItem>
                      <SelectItem value="warning">Low Performance</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="most-popular">
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="most-popular">Sort: Most Popular</SelectItem>
                      <SelectItem value="highest-roi">Sort: Highest ROI</SelectItem>
                      <SelectItem value="newest">Sort: Newest</SelectItem>
                      <SelectItem value="points-low">Sort: Points (Low)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="all-locations">
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-locations">All Locations</SelectItem>
                      <SelectItem value="downtown">Downtown</SelectItem>
                      <SelectItem value="westside">Westside</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span>Showing 1-{rewardsMockData.length} of 88 rewards</span>
              </div>
            </CardHeader>
            <CardContent>
              {/* Bulk Action Bar */}
              {selectedRewards.length > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-lg border-2 border-primary bg-muted px-6 py-3">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={true} onCheckedChange={() => setSelectedRewards([])} />
                    <span className="font-medium">
                      {selectedRewards.length} reward{selectedRewards.length > 1 ? "s" : ""} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                    <Button variant="outline" size="sm">
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </Button>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Archive
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedRewards([])}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedRewards.length === rewardsMockData.length}
                          onCheckedChange={handleSelectAllRewards}
                        />
                      </TableHead>
                      <TableHead className="min-w-[280px]">
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          Reward Name
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[120px]">Type</TableHead>
                      <TableHead className="w-[100px]">
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          Points Cost
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[140px]">Redeemed</TableHead>
                      <TableHead className="w-[120px]">Value</TableHead>
                      <TableHead className="w-[100px]">
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          ROI
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewardsMockData.map((reward) => (
                      <TableRow
                        key={reward.id}
                        className="group cursor-pointer transition-colors hover:bg-muted/50"
                        style={{ height: "88px" }}
                        onClick={() => handleViewRewardDetails(reward)} // Added click handler
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedRewards.includes(reward.id)}
                            onCheckedChange={(checked) =>
                              handleSelectReward(reward.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{reward.emoji}</span>
                            <div>
                              <div className="font-semibold text-lg">{reward.name}</div>
                              <div className="text-sm text-muted-foreground">{reward.description}</div>
                              <div className="text-xs text-muted-foreground">Created: {reward.created}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge variant="outline" className="gap-1">
                              {reward.type}
                            </Badge>
                            <div className="mt-1 text-xs text-muted-foreground">{reward.typeCategory}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className={`font-semibold ${
                              reward.pointsCostLevel === "low" ? "text-success" :
                              reward.pointsCostLevel === "medium" ? "text-warning" :
                              "text-orange-500"
                            }`}>
                              {reward.pointsCost === 0 ? "FREE" : `${reward.pointsCost} pts`}
                            </div>
                            <div className="text-xs text-muted-foreground">{reward.visitEquivalent}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="space-y-1">
                                  <div className="font-semibold">{reward.redemptionCount}</div>
                                  <Progress
                                    value={reward.redemptionPercent}
                                    className="h-2"
                                    style={{
                                      // @ts-ignore
                                      "--progress-background": reward.redemptionPercent >= 80 ? "hsl(var(--success))" : reward.redemptionPercent >= 50 ? "hsl(var(--warning))" : "hsl(var(--muted))"
                                    }}
                                  />
                                  <div className="text-xs text-muted-foreground">
                                    {reward.redemptionPercent}% • Max: {reward.redemptionMax}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{reward.redemptionCount} of {reward.redemptionMax} redeemed ({reward.redemptionPercent}%)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{reward.monetaryValue}</div>
                            <div className="text-xs text-muted-foreground">{reward.valueType === "fixed" ? "per redemption" : reward.valueType === "average" ? "avg" : ""}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="space-y-1">
                                  <div className={`font-semibold ${
                                    reward.roi >= 3 ? "text-success" :
                                    reward.roi >= 2 ? "text-warning" :
                                    "text-destructive"
                                  }`}>
                                    {reward.roi > 0 ? `${reward.roi}x` : "--"}
                                  </div>
                                  {reward.roiTrend !== "neutral" && (
                                    <div className={`flex items-center gap-1 text-xs ${
                                      reward.roiTrend === "up" ? "text-success" : "text-destructive"
                                    }`}>
                                      {reward.roiTrend === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                      {reward.roiTrend === "up" ? "+" : ""}{reward.roiDelta}x
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Return on Investment: {reward.roi}x</p>
                                <p className="text-xs">Based on redemptions vs value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge variant={reward.statusColor as any}>
                              {reward.statusLabel}
                            </Badge>
                            {reward.statusReason && (
                              <div className="mt-1 text-xs text-muted-foreground">{reward.statusReason}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => handleViewRewardDetails(reward)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewRewardDetails(reward)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Reward
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {reward.status === "active" ? (
                                  <DropdownMenuItem>
                                    <Pause className="mr-2 h-4 w-4" />
                                    Pause
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem>
                                    <Play className="mr-2 h-4 w-4" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing 1-{rewardsMockData.length} of 88 rewards
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button variant="outline" size="sm">1</Button>
                  <Button variant="ghost" size="sm">2</Button>
                  <Button variant="ghost" size="sm">3</Button>
                  <span className="text-sm text-muted-foreground">...</span>
                  <Button variant="ghost" size="sm">11</Button>
                  <Button variant="outline" size="sm">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="tables-section-title" className="space-y-4">
          <h2 id="tables-section-title" className="sr-only">
            Loyalty Tiers and Members Tables
          </h2>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b overflow-x-auto">
            <Button
              variant={activeTab === "tiers" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("tiers")}
              className="rounded-b-none"
            >
              <Target className="mr-2 h-4 w-4" />
              Loyalty Tiers
            </Button>
            <Button
              variant={activeTab === "members" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("members")}
              className="rounded-b-none"
            >
              <Users className="mr-2 h-4 w-4" />
              Program Members
            </Button>
            <Button
              variant={activeTab === "timeline" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("timeline")}
              className="rounded-b-none"
            >
              <Clock className="mr-2 h-4 w-4" />
              Timeline & Activity
            </Button>
            <Button
              variant={activeTab === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("calendar")}
              className="rounded-b-none"
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Calendar
            </Button>
            <Button
              variant={activeTab === "campaigns" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("campaigns")}
              className="rounded-b-none"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Campaigns
            </Button>
            <Button
              variant={activeTab === "analytics" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("analytics")}
              className="rounded-b-none"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </div>

          {/* Bulk Action Bar for Tiers */}
          {activeTab === "tiers" && selectedTiers.length > 0 && (
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border-2 border-primary bg-muted px-6 py-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={true} onCheckedChange={() => setSelectedTiers([])} />
                <span className="font-medium">
                  {selectedTiers.length} tier{selectedTiers.length > 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Pause className="mr-2 h-4 w-4" />
                  Pause Selected
                </Button>
                <Button variant="outline" size="sm">
                  <Play className="mr-2 h-4 w-4" />
                  Activate
                </Button>
                <Button variant="outline" size="sm">
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedTiers([])}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Action Bar for Members */}
          {activeTab === "members" && selectedMembers.length > 0 && (
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border-2 border-primary bg-muted px-6 py-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={true} onCheckedChange={() => setSelectedMembers([])} />
                <span className="font-medium">
                  {selectedMembers.length} member{selectedMembers.length > 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Gift className="mr-2 h-4 w-4" />
                  Send Reward
                </Button>
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Export Selected
                </Button>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMembers([])}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tiers Table */}
          {activeTab === "tiers" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    <CardTitle>Loyalty Tiers</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="search"
                      placeholder="Search tiers..."
                      className="w-[200px]"
                    />
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                    <Button size="sm" onClick={() => setShowTierWizard(true)}> {/* Open wizard */}
                      <Plus className="mr-2 h-4 w-4" />
                      New Tier
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tiers</SelectItem>
                        <SelectItem value="active">Active Only</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span>Showing 1-{tiersMockData.length} of {tiersMockData.length}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table role="table" aria-label="Loyalty tiers list">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedTiers.length === tiersMockData.length}
                            onCheckedChange={handleSelectAllTiers}
                            aria-label="Select all tiers"
                          />
                        </TableHead>
                        <TableHead className="min-w-[280px]">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            Tier
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="w-[140px]">Points Required</TableHead>
                        <TableHead className="w-[400px]">Benefits</TableHead>
                        <TableHead className="w-[120px]">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            Members
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tiersMockData.map((tier) => (
                        <TableRow
                          key={tier.id}
                          className="group cursor-pointer transition-colors hover:bg-muted/50"
                          style={{ height: "80px" }}
                          onClick={() => handleViewTierDetails(tier)} // Added click handler
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedTiers.includes(tier.id)}
                              onCheckedChange={(checked) =>
                                handleSelectTier(tier.id, checked as boolean)
                              }
                              aria-label={`Select ${tier.name} tier`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{tier.emoji}</span>
                              <div>
                                <div className="font-semibold text-lg">{tier.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {tier.subtitle}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {tier.pointsRequired.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {tier.pointsHelper}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="space-y-1">
                                    {tier.benefits.slice(0, 3).map((benefit, idx) => (
                                      <div key={idx} className="text-sm">
                                        • {benefit}
                                      </div>
                                    ))}
                                    {tier.benefits.length > 3 && (
                                      <div className="text-xs text-muted-foreground">
                                        +{tier.benefits.length - 3} more
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[300px]">
                                  <div className="space-y-1">
                                    {tier.benefits.map((benefit, idx) => (
                                      <div key={idx} className="text-sm">
                                        • {benefit}
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold">
                                {tier.memberCount.toLocaleString()}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {tier.memberPercent}%
                              </div>
                              <Progress value={tier.memberPercent} className="mt-1 h-1" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={tier.statusColor as any}>
                              {tier.statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => handleViewTierDetails(tier)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewTierDetails(tier)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {tier.status === "active" ? (
                                    <DropdownMenuItem>
                                      <Pause className="mr-2 h-4 w-4" />
                                      Pause
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem>
                                      <Play className="mr-2 h-4 w-4" />
                                      Activate
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Archive
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Empty State for Tiers */}
                {tiersMockData.length === 0 && (
                  <Alert className="mt-4">
                    <Target className="h-4 w-4" />
                    <AlertTitle>No loyalty tiers yet</AlertTitle>
                    <AlertDescription>
                      Create your first tier to start rewarding your customers for their loyalty
                    </AlertDescription>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => setShowTierWizard(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Tier
                      </Button>
                      <Button variant="outline" size="sm">
                        Browse Templates
                      </Button>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Members Table */}
          {activeTab === "members" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <CardTitle>Program Members</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="search"
                      placeholder="Search members..."
                      className="w-[200px]"
                      value={membersSearchInput}
                      onChange={(event) => setMembersSearchInput(event.target.value)}
                    />
                    <Button variant="outline" size="sm" disabled>
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                    <Button size="sm" disabled>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Member
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Select defaultValue="all-members" disabled>
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue placeholder="Activity (soon)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-members">All Members</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select defaultValue="all-tiers" disabled>
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue placeholder="Tier (soon)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-tiers">All Tiers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span>
                    {membersTotalCount === 0
                      ? "No members"
                      : `Showing ${membersPageStart}-${membersPageEnd} of ${membersTotalCount.toLocaleString()}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Member list is live; tier column is still a placeholder.
                </p>
              </CardHeader>
              <CardContent>
                {membersFetchError ? (
                  <p className="mb-4 text-sm text-destructive">{membersFetchError}</p>
                ) : null}
                <div className="overflow-x-auto rounded-lg border">
                  <Table role="table" aria-label="Program members list">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={
                              loyaltyMembers.length > 0 &&
                              selectedMembers.length === loyaltyMembers.length
                            }
                            onCheckedChange={handleSelectAllMembers}
                            aria-label="Select all members"
                          />
                        </TableHead>
                        <TableHead className="min-w-[280px]">Member</TableHead>
                        <TableHead className="w-[100px]">Tier</TableHead>
                        <TableHead className="w-[120px]">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            Points
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="w-[100px]">Redeemed</TableHead>
                        <TableHead className="w-[140px]">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            Joined
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="w-[140px]">Last Visit</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isTableLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                            Loading members…
                          </TableCell>
                        </TableRow>
                      ) : loyaltyMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                            {currentMerchantId
                              ? "No loyalty members yet."
                              : "Select a merchant to view members."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        loyaltyMembers.map((member) => (
                        <TableRow
                          key={member.id}
                          className="group cursor-pointer transition-colors hover:bg-muted/50"
                          style={{ height: "72px" }}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedMembers.includes(member.id)}
                              onCheckedChange={(checked) =>
                                handleSelectMember(member.id, checked as boolean)
                              }
                              aria-label={`Select ${member.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>
                                  {member.name.split(" ").map((n) => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold">{member.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {member.email ?? "-"}
                                </div>
                                {member.phone ? (
                                  <div className="text-xs text-muted-foreground">
                                    {displayPhone(member.phone)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">-</span>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">
                              {member.balance.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {member.rewardsRedeemed.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {member.rewardsRedeemed === 1 ? "redemption" : "redemptions"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(member.joinedAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {member.lastVisitAt ? (
                              <div>
                                <div className="text-sm">
                                  {format(new Date(member.lastVisitAt), "MMM d, yyyy")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(member.lastVisitAt), {
                                    addSuffix: true,
                                  })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">No visits yet</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                                disabled
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                                disabled
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {membersTotalCount === 0
                      ? "No members to display"
                      : `Showing ${membersPageStart}-${membersPageEnd} of ${membersTotalCount.toLocaleString()} members`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={membersPage <= 1 || isTableLoading}
                      onClick={() => setMembersPage((page) => Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {membersPage} of {membersTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={membersPage >= membersTotalPages || isTableLoading}
                      onClick={() =>
                        setMembersPage((page) => Math.min(membersTotalPages, page + 1))
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* NEW Templates Dialog */}
        <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Reward Templates
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose a template to get started quickly</p>

              <Tabs defaultValue="popular">
                <TabsList>
                  <TabsTrigger value="popular">Popular</TabsTrigger>
                  <TabsTrigger value="food">Food & Bev</TabsTrigger>
                  <TabsTrigger value="access">Access</TabsTrigger>
                  <TabsTrigger value="points">Points</TabsTrigger>
                </TabsList>

                <TabsContent value="popular" className="mt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { emoji: "☕", name: "Free Coffee", type: "free-item", points: 50, desc: "Any size drink", },
                      { emoji: "🍔", name: "% Off Meal", type: "discount", points: 150, desc: "Percentage discount", },
                      { emoji: "🎂", name: "Birthday Treat", type: "free-item", desc: "Special treat on birthday", },
                      { emoji: "🎟️", name: "Skip Line Pass", type: "special-access", points: 250, desc: "VIP priority access", },
                      { emoji: "💰", name: "2x Points Bonus", type: "points-multiplier", points: 150, desc: "Double points next purchase", },
                      { emoji: "🍰", name: "Free Dessert", type: "free-item", points: 75, desc: "Choose from dessert menu", }
                    ].map((template) => (
                      <Card key={template.name} className="cursor-pointer transition-all hover:shadow-md">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{template.emoji}</span>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">{template.desc}</p>
                          <p className="text-sm font-medium">{template.points ? `${template.points} points` : ""}</p>
                          <Button size="sm" className="w-full" onClick={() => handleUseRewardTemplate(template)}>Use Template</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                {/* Add other TabsContent for Food & Bev, Access, Points if needed */}
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>

        {/* TIER CREATION WIZARD */}
        <Dialog open={showTierWizard} onOpenChange={setShowTierWizard}>
          <DialogContent className="max-w-[900px] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Create New Loyalty Tier</DialogTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleTierWizardSaveDraft}>
                    Save Draft
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">
                  Step {tierWizardStep} of 4: {
                    tierWizardStep === 1 ? "Basic Information" :
                    tierWizardStep === 2 ? "Points Requirements" :
                    tierWizardStep === 3 ? "Benefits & Perks" :
                    "Review & Publish"
                  }
                </div>
                <div className="flex items-center gap-1">
                  <div className={`h-1 flex-1 rounded-full ${tierWizardStep >= 1 ? 'bg-primary' : 'bg-muted'}`} />
                  <div className={`h-1 flex-1 rounded-full ${tierWizardStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                  <div className={`h-1 flex-1 rounded-full ${tierWizardStep >= 3 ? 'bg-primary' : 'bg-muted'}`} />
                  <div className={`h-1 flex-1 rounded-full ${tierWizardStep >= 4 ? 'bg-primary' : 'bg-muted'}`} />
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-auto pr-2">
              {/* STEP 1: BASIC INFORMATION */}
              {tierWizardStep === 1 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <h3 className="font-semibold">Tier Details</h3>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Tier Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="Silver"
                      value={tierFormData.name}
                      onChange={(e) => setTierFormData({ ...tierFormData, name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">This is what customers will see</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Display Name (Optional)</label>
                    <Input
                      placeholder="Silver Member"
                      value={tierFormData.displayName}
                      onChange={(e) => setTierFormData({ ...tierFormData, displayName: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Friendly name for member-facing displays</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Tier Emoji/Icon <span className="text-destructive">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="text-4xl">{tierFormData.emoji}</div>
                      <Select value={tierFormData.emoji} onValueChange={(value) => setTierFormData({ ...tierFormData, emoji: value })}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="🥉">🥉 Bronze</SelectItem>
                          <SelectItem value="🥈">🥈 Silver</SelectItem>
                          <SelectItem value="🥇">🥇 Gold</SelectItem>
                          <SelectItem value="💎">💎 Platinum</SelectItem>
                          <SelectItem value="👑">👑 Crown</SelectItem>
                          <SelectItem value="⭐">⭐ Star</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tier Color</label>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-2">
                        {["silver", "gold", "blue", "purple", "green", "red"].map((color) => (
                          <button
                            key={color}
                            onClick={() => setTierFormData({ ...tierFormData, color })}
                            className={`w-8 h-8 rounded-full border-2 ${
                              tierFormData.color === color ? 'border-primary' : 'border-transparent'
                            }`}
                            style={{
                              backgroundColor:
                                color === "silver" ? "#c0c0c0" :
                                color === "gold" ? "#ffd700" :
                                color === "blue" ? "#3b82f6" :
                                color === "purple" ? "#a855f7" :
                                color === "green" ? "#22c55e" :
                                "#ef4444"
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Used for badges, progress bars, and UI accents</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Short Description <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      placeholder="Regular members who enjoy consistent perks"
                      value={tierFormData.shortDescription}
                      onChange={(e) => setTierFormData({ ...tierFormData, shortDescription: e.target.value })}
                      maxLength={160}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">{tierFormData.shortDescription.length}/160 characters</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Description</label>
                    <Textarea
                      placeholder="Our Silver tier is designed for loyal customers who visit regularly. Enjoy enhanced benefits and exclusive offers that reward your loyalty."
                      value={tierFormData.fullDescription}
                      onChange={(e) => setTierFormData({ ...tierFormData, fullDescription: e.target.value })}
                      maxLength={500}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">{tierFormData.fullDescription.length}/500 characters</p>
                  </div>
                </div>
              )}

              {/* STEP 2: POINTS REQUIREMENTS */}
              {tierWizardStep === 2 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <h3 className="font-semibold">Points Configuration</h3>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Points Required to Achieve Tier <span className="text-destructive">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={tierFormData.pointsRequired}
                        onChange={(e) => setTierFormData({ ...tierFormData, pointsRequired: parseInt(e.target.value) || 0 })}
                        className="max-w-[200px]"
                      />
                      <span className="text-sm text-muted-foreground">points</span>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100">Points Calculator</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Average order value:</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">€</span>
                          <Input
                            type="number"
                            value={calcAverageOrder}
                            onChange={(e) => setCalcAverageOrder(parseInt(e.target.value) || 0)}
                            className="max-w-[100px]"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Points per euro:</label>
                        <Input
                          type="number"
                          value={calcPointsPerEuro}
                          onChange={(e) => setCalcPointsPerEuro(parseInt(e.target.value) || 0)}
                          className="max-w-[100px]"
                        />
                        <p className="text-xs text-muted-foreground">(default: 10 points/€)</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                      <p className="text-sm">
                        <span className="font-medium">Estimated visits needed:</span><br />
                        {tierFormData.pointsRequired} points ÷ (€{calcAverageOrder} × {calcPointsPerEuro} points/€) = ~{calculateVisitsNeeded(tierFormData.pointsRequired)} visits
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Time to achieve (estimated):</span>
                      </p>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Weekly visitor: ~{calculateVisitsNeeded(tierFormData.pointsRequired)} weeks</li>
                        <li>• Monthly visitor: ~{calculateVisitsNeeded(tierFormData.pointsRequired)} months</li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Tier Positioning</h4>
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <p className="text-sm font-medium">Current Tier Structure:</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🥉</span>
                          <span className="text-sm font-medium">Bronze</span>
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-sm text-muted-foreground">0 pts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{tierFormData.emoji}</span>
                          <span className="text-sm font-medium">{tierFormData.name || "New Tier"}</span>
                          <div className="flex-1 h-px bg-primary" />
                          <span className="text-sm font-semibold text-primary">{tierFormData.pointsRequired} pts</span>
                          <Badge variant="outline">New</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🥇</span>
                          <span className="text-sm font-medium">Gold</span>
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-sm text-muted-foreground">1,500 pts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">💎</span>
                          <span className="text-sm font-medium">Platinum</span>
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-sm text-muted-foreground">3,000 pts</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="auto-upgrade"
                        checked={tierFormData.autoUpgrade}
                        onCheckedChange={(checked) => setTierFormData({ ...tierFormData, autoUpgrade: checked as boolean })}
                      />
                      <label htmlFor="auto-upgrade" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Auto-upgrade members when they reach points threshold
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="manual-approval"
                        checked={tierFormData.manualApproval}
                        onCheckedChange={(checked) => setTierFormData({ ...tierFormData, manualApproval: checked as boolean })}
                      />
                      <label htmlFor="manual-approval" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Require manual approval for tier upgrades
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="allow-downgrade"
                        checked={tierFormData.allowDowngrade}
                        onCheckedChange={(checked) => setTierFormData({ ...tierFormData, allowDowngrade: checked as boolean })}
                      />
                      <label htmlFor="allow-downgrade" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Allow tier downgrade if points fall below threshold
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: BENEFITS & PERKS */}
              {tierWizardStep === 3 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Tier Benefits Builder</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Templates
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Drag to reorder • Benefits appear in this order on member profiles
                  </p>

                  <div className="space-y-3">
                    {tierFormData.benefits.map((benefit: any, index: number) => (
                      <div key={benefit.id || index} className="p-4 border rounded-lg bg-card">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveBenefit(index, "up")}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveBenefit(index, "down")}
                              disabled={index === tierFormData.benefits.length - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">{benefit.icon}</span>
                              <span className="font-medium">{index + 1}. {benefit.title}</span>
                              <Badge variant="outline" className="ml-auto">
                                {benefit.priority === "high" ? "High Priority" :
                                  benefit.priority === "medium" ? "Medium Priority" :
                                    "Low Priority"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{benefit.description}</p>
                            {benefit.active && (
                              <p className="text-xs text-green-600 mt-1">Always active</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingBenefit(index)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleRemoveBenefit(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 border-2 border-dashed rounded-lg space-y-4">
                    <h4 className="font-medium">Add Custom Benefit</h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Icon</label>
                        <Select value={newBenefit.icon} onValueChange={(value) => setNewBenefit({ ...newBenefit, icon: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="💰">💰 Discount</SelectItem>
                            <SelectItem value="🪑">🪑 Priority Seating</SelectItem>
                            <SelectItem value="✉️">✉️ Email Offers</SelectItem>
                            <SelectItem value="🍽️">🍽️ Free Item</SelectItem>
                            <SelectItem value="⭐">⭐ Points Bonus</SelectItem>
                            <SelectItem value="🎁">🎁 Gift</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Priority</label>
                        <Select value={newBenefit.priority} onValueChange={(value: any) => setNewBenefit({ ...newBenefit, priority: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Benefit Title</label>
                      <Input
                        placeholder="e.g., 10% discount on all orders"
                        value={newBenefit.title}
                        onChange={(e) => setNewBenefit({ ...newBenefit, title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="e.g., Applied automatically at checkout"
                        value={newBenefit.description}
                        onChange={(e) => setNewBenefit({ ...newBenefit, description: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <Button onClick={handleAddBenefit} className="w-full" disabled={!newBenefit.title}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Benefit
                    </Button>

                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium mb-2">Or choose from templates:</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm">Points Multiplier</Button>
                        <Button variant="outline" size="sm">Free Item</Button>
                        <Button variant="outline" size="sm">Discount</Button>
                        <Button variant="outline" size="sm">Special Access</Button>
                      </div>
                    </div>
                  </div>

                  {tierFormData.benefits.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Preview:</h4>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-2xl">{tierFormData.emoji}</span>
                          <span className="font-semibold">{tierFormData.name || "New Tier"} Benefits</span>
                        </div>
                        <ul className="space-y-2">
                          {tierFormData.benefits.map((benefit: any, index: number) => (
                            <li key={index} className="text-sm flex items-center gap-2">
                              <span>{benefit.icon}</span>
                              <span>{benefit.title}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground mt-3">
                          This is how members will see their benefits
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: REVIEW & PUBLISH */}
              {tierWizardStep === 4 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <h3 className="font-semibold">Review Your Tier</h3>

                  <div className="p-4 bg-muted rounded-lg space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{tierFormData.emoji}</span>
                        <div>
                          <h4 className="font-semibold text-lg">{tierFormData.name}</h4>
                          <p className="text-sm text-muted-foreground">{tierFormData.shortDescription}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTierWizardStep(1)}>
                        Edit Step 1
                      </Button>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Points Required:</p>
                        <p className="text-lg">{tierFormData.pointsRequired} points (~{calculateVisitsNeeded(tierFormData.pointsRequired)} visits)</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTierWizardStep(2)}>
                        Edit Step 2
                      </Button>
                    </div>

                    <Separator />

                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium mb-2">Benefits: {tierFormData.benefits.length} perks configured</p>
                        <ul className="space-y-1">
                          {tierFormData.benefits.map((benefit: any, index: number) => (
                            <li key={index} className="text-sm flex items-center gap-2">
                              <span>{benefit.icon}</span>
                              <span>{benefit.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTierWizardStep(3)}>
                        Edit Step 3
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Launch Settings</h4>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Activation:</label>
                      <RadioGroup value={tierFormData.activationType} onValueChange={(value: any) => setTierFormData({ ...tierFormData, activationType: value })}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="immediate" id="immediate" />
                          <label htmlFor="immediate" className="text-sm">Publish immediately</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="draft" id="draft" />
                          <label htmlFor="draft" className="text-sm">Save as draft (activate later)</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="scheduled" id="scheduled" />
                          <label htmlFor="scheduled" className="text-sm">Schedule activation</label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Member Notifications:</label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="email-notif"
                            checked={tierFormData.notifications.email}
                            onCheckedChange={(checked) => setTierFormData({
                              ...tierFormData,
                              notifications: { ...tierFormData.notifications, email: checked as boolean }
                            })}
                          />
                          <label htmlFor="email-notif" className="text-sm">Email existing members about new tier</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="push-notif"
                            checked={tierFormData.notifications.push}
                            onCheckedChange={(checked) => setTierFormData({
                              ...tierFormData,
                              notifications: { ...tierFormData.notifications, push: checked as boolean }
                            })}
                          />
                          <label htmlFor="push-notif" className="text-sm">Push notification to app users</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="banner-notif"
                            checked={tierFormData.notifications.banner}
                            onCheckedChange={(checked) => setTierFormData({
                              ...tierFormData,
                              notifications: { ...tierFormData.notifications, banner: checked as boolean }
                            })}
                          />
                          <label htmlFor="banner-notif" className="text-sm">Show banner on website/app</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="auto-enroll-notif"
                            checked={tierFormData.notifications.autoEnroll}
                            onCheckedChange={(checked) => setTierFormData({
                              ...tierFormData,
                              notifications: { ...tierFormData.notifications, autoEnroll: checked as boolean }
                            })}
                          />
                          <label htmlFor="auto-enroll-notif" className="text-sm">Auto-enroll eligible members</label>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h5 className="font-medium mb-2">Estimated Impact:</h5>
                      <div className="space-y-1 text-sm">
                        <p>Based on current member distribution:</p>
                        <ul className="space-y-1 ml-4">
                          <li>• ~450 members may qualify immediately</li>
                          <li>• ~200 members within 1 month</li>
                          <li>• Expected engagement increase: 15-20%</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              {tierWizardStep > 1 && (
                <Button variant="outline" onClick={handleTierWizardBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowTierWizard(false)}>
                Cancel
              </Button>
              {tierWizardStep < 4 ? (
                <Button onClick={handleTierWizardNext}>
                  Next Step
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleTierWizardPublish}>
                  Publish Tier
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* REWARD CREATION WIZARD */}
        <Dialog open={showRewardWizard} onOpenChange={setShowRewardWizard}>
          <DialogContent className="max-w-[900px] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Create New Reward</DialogTitle>
                <Button variant="outline" size="sm" onClick={handleRewardWizardSaveDraft}>
                  Save Draft
                </Button>
              </div>
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">
                  Step {rewardWizardStep} of 5: {
                    rewardWizardStep === 1 ? "Reward Type" :
                    rewardWizardStep === 2 ? "Reward Details" :
                    rewardWizardStep === 3 ? "Points Cost & Limits" :
                    rewardWizardStep === 4 ? "Availability & Scheduling" :
                    "Review & Publish"
                  }
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div key={step} className={`h-1 flex-1 rounded-full ${rewardWizardStep >= step ? 'bg-primary' : 'bg-muted'}`} />
                  ))}
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-auto pr-2">
              {/* STEP 1: REWARD TYPE */}
              {rewardWizardStep === 1 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <div>
                    <h3 className="font-semibold mb-2">Choose Reward Type</h3>
                    <p className="text-sm text-muted-foreground">Select the type of reward you want to create</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setRewardFormData({ ...rewardFormData, type: 'free-item' })}
                      className={`p-6 border-2 rounded-lg text-left transition-all ${
                        rewardFormData.type === 'free-item' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">🎁</div>
                      <h4 className="font-semibold mb-2">Free Item</h4>
                      <p className="text-sm text-muted-foreground mb-3">Members receive a complimentary menu item</p>
                      <div className="text-xs space-y-1">
                        <p className="font-medium">Popular Examples:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>Free coffee</li>
                          <li>Free dessert</li>
                          <li>Free appetizer</li>
                        </ul>
                      </div>
                      {rewardFormData.type === 'free-item' && (
                        <div className="mt-3">
                          <Badge variant="default">Selected</Badge>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setRewardFormData({ ...rewardFormData, type: 'discount' })}
                      className={`p-6 border-2 rounded-lg text-left transition-all ${
                        rewardFormData.type === 'discount' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">💰</div>
                      <h4 className="font-semibold mb-2">Discount</h4>
                      <p className="text-sm text-muted-foreground mb-3">Percentage or fixed amount off their purchase</p>
                      <div className="text-xs space-y-1">
                        <p className="font-medium">Popular Examples:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>10% off meal</li>
                          <li>€5 off order</li>
                          <li>BOGO deals</li>
                        </ul>
                      </div>
                      {rewardFormData.type === 'discount' && (
                        <div className="mt-3">
                          <Badge variant="default">Selected</Badge>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setRewardFormData({ ...rewardFormData, type: 'special-access' })}
                      className={`p-6 border-2 rounded-lg text-left transition-all ${
                        rewardFormData.type === 'special-access' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">🎟️</div>
                      <h4 className="font-semibold mb-2">Special Access</h4>
                      <p className="text-sm text-muted-foreground mb-3">VIP perks and exclusive experiences</p>
                      <div className="text-xs space-y-1">
                        <p className="font-medium">Popular Examples:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>Skip the line</li>
                          <li>Priority seating</li>
                          <li>VIP lounge</li>
                        </ul>
                      </div>
                      {rewardFormData.type === 'special-access' && (
                        <div className="mt-3">
                          <Badge variant="default">Selected</Badge>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setRewardFormData({ ...rewardFormData, type: 'points-multiplier' })}
                      className={`p-6 border-2 rounded-lg text-left transition-all ${
                        rewardFormData.type === 'points-multiplier' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">⚡</div>
                      <h4 className="font-semibold mb-2">Points Multiplier</h4>
                      <p className="text-sm text-muted-foreground mb-3">Earn bonus points on purchases</p>
                      <div className="text-xs space-y-1">
                        <p className="font-medium">Popular Examples:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>2x points</li>
                          <li>Triple points</li>
                          <li>Bonus points</li>
                        </ul>
                      </div>
                      {rewardFormData.type === 'points-multiplier' && (
                        <div className="mt-3">
                          <Badge variant="default">Selected</Badge>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: REWARD DETAILS */}
              {rewardWizardStep === 2 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <h3 className="font-semibold">
                    {rewardFormData.type === 'free-item' ? 'Free Item Configuration' :
                      rewardFormData.type === 'discount' ? 'Discount Configuration' :
                        rewardFormData.type === 'special-access' ? 'Special Access Configuration' :
                          'Points Multiplier Configuration'}
                  </h3>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Reward Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="Free Coffee"
                      value={rewardFormData.name}
                      onChange={(e) => setRewardFormData({ ...rewardFormData, name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">This is what members will see</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Reward Icon/Emoji <span className="text-destructive">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="text-4xl">{rewardFormData.emoji}</div>
                      <Select value={rewardFormData.emoji} onValueChange={(value) => setRewardFormData({ ...rewardFormData, emoji: value })}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="☕">☕ Coffee</SelectItem>
                          <SelectItem value="🍰">🍰 Dessert</SelectItem>
                          <SelectItem value="🍔">🍔 Burger</SelectItem>
                          <SelectItem value="🍕">🍕 Pizza</SelectItem>
                          <SelectItem value="🎁">🎁 Gift</SelectItem>
                          <SelectItem value="💰">💰 Money</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Description <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      placeholder="Enjoy a free coffee of any size on us!"
                      value={rewardFormData.description}
                      onChange={(e) => setRewardFormData({ ...rewardFormData, description: e.target.value })}
                      maxLength={160}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">{rewardFormData.description.length}/160 characters</p>
                  </div>

                  {rewardFormData.type === 'free-item' && (
                    <>
                      <div className="space-y-4">
                        <label className="text-sm font-medium">
                          Select Item(s) <span className="text-destructive">*</span>
                        </label>
                        <p className="text-sm text-muted-foreground">Choose which menu items members can redeem</p>

                        <RadioGroup value={rewardFormData.itemSelection} onValueChange={(value: any) => setRewardFormData({ ...rewardFormData, itemSelection: value })}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="category" id="category" />
                            <label htmlFor="category" className="text-sm">Any item from category</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="specific" id="specific" />
                            <label htmlFor="specific" className="text-sm">Specific items</label>
                          </div>
                        </RadioGroup>

                        {rewardFormData.itemSelection === 'specific' && (
                          <div className="p-4 border rounded-lg space-y-3">
                            <Input placeholder="Search menu items..." className="mb-3" />

                            <div>
                              <p className="text-sm font-medium mb-2">
                                Selected Items ({rewardFormData.selectedItems.length}):
                              </p>
                              <div className="space-y-2">
                                {rewardFormData.selectedItems.map((itemId) => {
                                  const item = menuItems.find(m => m.id === itemId)
                                  return item ? (
                                    <div key={itemId} className="flex items-center justify-between p-2 bg-muted rounded">
                                      <div className="flex items-center gap-2">
                                        <Checkbox checked={true} onCheckedChange={() => handleToggleItem(itemId)} />
                                        <span className="text-sm">{item.name} (€{item.price.toFixed(2)})</span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleToggleItem(itemId)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : null
                                })}
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-medium mb-2">Available Items:</p>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {menuItems.filter(item => !rewardFormData.selectedItems.includes(item.id)).map((item) => (
                                  <div key={item.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                                    <Checkbox
                                      checked={false}
                                      onCheckedChange={() => handleToggleItem(item.id)}
                                    />
                                    <span className="text-sm">{item.name} (€{item.price.toFixed(2)})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium">Item Restrictions</label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="mods-allowed"
                              checked={rewardFormData.modificationsAllowed}
                              onCheckedChange={(checked) => setRewardFormData({ ...rewardFormData, modificationsAllowed: checked as boolean })}
                            />
                            <label htmlFor="mods-allowed" className="text-sm">Modifications allowed (e.g., add syrup, extra shot)</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="dine-in-only"
                              checked={rewardFormData.dineInOnly}
                              onCheckedChange={(checked) => setRewardFormData({ ...rewardFormData, dineInOnly: checked as boolean })}
                            />
                            <label htmlFor="dine-in-only" className="text-sm">Dine-in only</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="exclude-takeout"
                              checked={rewardFormData.excludeTakeout}
                              onCheckedChange={(checked) => setRewardFormData({ ...rewardFormData, excludeTakeout: checked as boolean })}
                            />
                            <label htmlFor="exclude-takeout" className="text-sm">Takeout/delivery excluded</label>
                          </div>
                        </div>
                      </div>

                      {rewardFormData.selectedItems.length > 0 && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm">
                            <span className="font-medium">Estimated Value per Redemption:</span>{' '}
                            €{calculateAverageItemValue().toFixed(2)} avg
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* STEP 3: POINTS & LIMITS */}
              {rewardWizardStep === 3 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <h3 className="font-semibold">Points Configuration</h3>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Points Cost <span className="text-destructive">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={rewardFormData.pointsCost}
                        onChange={(e) => setRewardFormData({ ...rewardFormData, pointsCost: parseInt(e.target.value) || 0 })}
                        className="max-w-[200px]"
                      />
                      <span className="text-sm text-muted-foreground">points to redeem</span>
                    </div>
                  </div>

                  {rewardFormData.type === 'free-item' && rewardFormData.selectedItems.length > 0 && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-blue-600" />
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100">Points Value Calculator</h4>
                      </div>

                      <div className="space-y-2 text-sm">
                        <p>Average item value: €{calculateAverageItemValue().toFixed(2)}</p>
                        <p>Points cost: {rewardFormData.pointsCost} points</p>
                        <p>Point value ratio: 1 point = €{calculatePointValueRatio().toFixed(2)}</p>

                        <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                          <p className="font-medium mb-1">For reference:</p>
                          <ul className="space-y-1 ml-4">
                            <li>• Members earn ~10 points per €1 spent</li>
                            <li>• {rewardFormData.pointsCost} points = ~€{(rewardFormData.pointsCost / 10).toFixed(0)} in purchases (~1 visit)</li>
                          </ul>
                        </div>

                        <div className="pt-2">
                          <p>Recommended range: {Math.floor(calculateAverageItemValue() * 10 * 0.8)}-{Math.ceil(calculateAverageItemValue() * 10 * 1.5)} points</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setRewardFormData({ ...rewardFormData, pointsCost: Math.round(calculateAverageItemValue() * 10) })}
                          >
                            Apply Suggested: {Math.round(calculateAverageItemValue() * 10)} pts
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="font-medium">Redemption Limits</h4>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Maximum Total Redemptions</label>
                      <RadioGroup
                        value={rewardFormData.maxRedemptions > 0 ? 'limited' : 'unlimited'}
                        onValueChange={(value) => setRewardFormData({
                          ...rewardFormData,
                          maxRedemptions: value === 'unlimited' ? 0 : 500
                        })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="unlimited" id="unlimited-redemptions" />
                          <label htmlFor="unlimited-redemptions" className="text-sm">Unlimited</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="limited" id="limited-redemptions" />
                          <label htmlFor="limited-redemptions" className="text-sm">Limited:</label>
                          <Input
                            type="number"
                            value={rewardFormData.maxRedemptions}
                            onChange={(e) => setRewardFormData({ ...rewardFormData, maxRedemptions: parseInt(e.target.value) || 0 })}
                            className="max-w-[120px]"
                            disabled={rewardFormData.maxRedemptions === 0}
                          />
                          <span className="text-sm text-muted-foreground">total redemptions</span>
                        </div>
                      </RadioGroup>
                      {rewardFormData.maxRedemptions > 0 && (
                        <p className="text-xs text-muted-foreground ml-6">When limit is reached, reward becomes unavailable</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Per-Member Limits</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={rewardFormData.perMemberLimit}
                          onChange={(e) => setRewardFormData({ ...rewardFormData, perMemberLimit: parseInt(e.target.value) || 1 })}
                          className="max-w-[100px]"
                        />
                        <span className="text-sm">redemption(s) per</span>
                        <Select value={rewardFormData.perMemberPeriod} onValueChange={(value: any) => setRewardFormData({ ...rewardFormData, perMemberPeriod: value })}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Day</SelectItem>
                            <SelectItem value="week">Week</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Tier Restrictions</label>
                      <RadioGroup value={rewardFormData.tierRestrictions.length === 4 ? 'all' : 'restricted'}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="all-tiers" />
                          <label htmlFor="all-tiers" className="text-sm">Available to all tiers</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="restricted" id="restricted-tiers" />
                          <label htmlFor="restricted-tiers" className="text-sm">Restricted to:</label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-6">
                      {['bronze', 'silver', 'gold', 'platinum'].map((tier) => (
                        <div key={tier} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tier-${tier}`}
                            checked={rewardFormData.tierRestrictions.includes(tier)}
                            onCheckedChange={(checked) => {
                              const updated = checked
                                ? [...rewardFormData.tierRestrictions, tier]
                                : rewardFormData.tierRestrictions.filter(t => t !== tier)
                              setRewardFormData({ ...rewardFormData, tierRestrictions: updated })
                            }}
                          />
                          <label htmlFor={`tier-${tier}`} className="text-sm">{tier}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {rewardFormData.type === 'free-item' && rewardFormData.selectedItems.length > 0 && rewardFormData.maxRedemptions > 0 && (
                    <div className="p-4 bg-muted rounded-lg">
                      <h5 className="font-medium mb-2">Projected Impact:</h5>
                      <div className="space-y-1 text-sm">
                        <p>• Estimated weekly redemptions: {calculateProjectedRedemptions().weekly}</p>
                        <p>• Time to reach {rewardFormData.maxRedemptions} limit: ~{calculateProjectedRedemptions().weeksToLimit} weeks</p>
                        <p>• Cost to business: ~€{calculateProjectedRedemptions().totalCost.toLocaleString()} total</p>
                        <p>• Expected ROI: {calculateProjectedRedemptions().roi.toFixed(1)}x</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: AVAILABILITY */}
              {rewardWizardStep === 4 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <h3 className="font-semibold">When & Where</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Date Range</label>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">Start:</label>
                          <Select defaultValue="immediately">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="immediately">📅 Immediately</SelectItem>
                              <SelectItem value="custom">Custom Date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">End:</label>
                          <Select defaultValue="no-end">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-end">📅 No end date</SelectItem>
                              <SelectItem value="custom">Custom Date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Days Available</label>
                      <RadioGroup value={rewardFormData.daysAvailable} onValueChange={(value: any) => setRewardFormData({ ...rewardFormData, daysAvailable: value })}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="all-days" />
                          <label htmlFor="all-days" className="text-sm">All days</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="specific" id="specific-days" />
                          <label htmlFor="specific-days" className="text-sm">Specific days</label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Time Restrictions</label>
                      <RadioGroup value={rewardFormData.timeRestriction} onValueChange={(value: any) => setRewardFormData({ ...rewardFormData, timeRestriction: value })}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all-day" id="all-day" />
                          <label htmlFor="all-day" className="text-sm">Available all day</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="specific" id="specific-hours" />
                          <label htmlFor="specific-hours" className="text-sm">Specific hours</label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Location Availability</label>
                      <RadioGroup value={rewardFormData.locationAvailability} onValueChange={(value: any) => setRewardFormData({ ...rewardFormData, locationAvailability: value })}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="all-locations" />
                          <label htmlFor="all-locations" className="text-sm">All locations</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="specific" id="specific-locations" />
                          <label htmlFor="specific-locations" className="text-sm">Specific locations</label>
                        </div>
                      </RadioGroup>
                      {rewardFormData.locationAvailability === 'specific' && (
                        <div className="ml-6 space-y-2">
                          {locations.map((location) => (
                            <div key={location.id} className="flex items-center space-x-2">
                              <Checkbox id={`location-${location.id}`} />
                              <label htmlFor={`location-${location.id}`} className="text-sm">
                                {location.name} ({location.address})
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Order Type Restrictions</label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="order-dine-in"
                            checked={rewardFormData.orderTypes.dineIn}
                            onCheckedChange={(checked) => setRewardFormData({
                              ...rewardFormData,
                              orderTypes: { ...rewardFormData.orderTypes, dineIn: checked as boolean }
                            })}
                          />
                          <label htmlFor="order-dine-in" className="text-sm">Dine-in</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="order-takeout"
                            checked={rewardFormData.orderTypes.takeout}
                            onCheckedChange={(checked) => setRewardFormData({
                              ...rewardFormData,
                              orderTypes: { ...rewardFormData.orderTypes, takeout: checked as boolean }
                            })}
                          />
                          <label htmlFor="order-takeout" className="text-sm">Takeout</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="order-delivery"
                            checked={rewardFormData.orderTypes.delivery}
                            onCheckedChange={(checked) => setRewardFormData({
                              ...rewardFormData,
                              orderTypes: { ...rewardFormData.orderTypes, delivery: checked as boolean }
                            })}
                          />
                          <label htmlFor="order-delivery" className="text-sm">Delivery</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="order-mobile"
                            checked={rewardFormData.orderTypes.mobile}
                            onCheckedChange={(checked) => setRewardFormData({
                              ...rewardFormData,
                              orderTypes: { ...rewardFormData.orderTypes, mobile: checked as boolean }
                            })}
                          />
                          <label htmlFor="order-mobile" className="text-sm">Mobile order</label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Special Conditions</label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="min-purchase" />
                          <label htmlFor="min-purchase" className="text-sm">Minimum purchase required: €</label>
                          <Input type="number" className="max-w-[100px] h-8" placeholder="0.00" />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="no-combine"
                            checked={rewardFormData.noCombine}
                            onCheckedChange={(checked) => setRewardFormData({ ...rewardFormData, noCombine: checked as boolean })}
                          />
                          <label htmlFor="no-combine" className="text-sm">Cannot combine with other promotions</label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h5 className="font-medium mb-2">Preview Availability:</h5>
                    <div className="space-y-1 text-sm">
                      <p>This reward will be available:</p>
                      <ul className="space-y-1 ml-4">
                        <li>• Starting immediately, no end date</li>
                        <li>• {rewardFormData.daysAvailable === 'all' ? 'All days of the week' : 'Specific days'}, {rewardFormData.timeRestriction === 'all-day' ? 'all hours' : 'specific hours'}</li>
                        <li>• At {rewardFormData.locationAvailability === 'all' ? 'all locations' : 'specific locations'}</li>
                        <li>• For {Object.entries(rewardFormData.orderTypes).filter(([_, v]) => v).length === 4 ? 'all order types' : 'selected order types'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: REVIEW & PUBLISH */}
              {rewardWizardStep === 5 && (
                <div className="space-y-6 p-6 border rounded-lg">
                  <h3 className="font-semibold">Review Your Reward</h3>

                  <div className="p-4 bg-muted rounded-lg space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{rewardFormData.emoji}</span>
                        <div>
                          <h4 className="font-semibold text-lg">{rewardFormData.name}</h4>
                          <p className="text-sm text-muted-foreground capitalize">{rewardFormData.type.replace('-', ' ')} • {rewardFormData.description}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setRewardWizardStep(2)}>
                        Edit Steps
                      </Button>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium mb-1">Items:</p>
                        <p>{rewardFormData.selectedItems.length > 0
                          ? rewardFormData.selectedItems.map(id => menuItems.find(m => m.id === id)?.name).join(', ')
                          : 'Not configured'
                        }</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Points:</p>
                        <p>{rewardFormData.pointsCost} points (~1 visit)</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Limit:</p>
                        <p>{rewardFormData.maxRedemptions > 0 ? `${rewardFormData.maxRedemptions} total` : 'Unlimited'}, {rewardFormData.perMemberLimit} per {rewardFormData.perMemberPeriod} per member</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Availability:</p>
                        <p>All days, all locations</p>
                      </div>
                    </div>

                    {rewardFormData.type === 'free-item' && rewardFormData.selectedItems.length > 0 && rewardFormData.maxRedemptions > 0 && (
                      <>
                        <Separator />
                        <div className="text-sm">
                          <p><span className="font-medium">Estimated Cost:</span> ~€{calculateProjectedRedemptions().totalCost.toLocaleString()} total</p>
                          <p><span className="font-medium">Expected ROI:</span> {calculateProjectedRedemptions().roi.toFixed(1)}x</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Member Preview:</h4>
                    <div className="p-4 bg-background border-2 rounded-lg">
                      <div className="max-w-md mx-auto p-4 border rounded-lg shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{rewardFormData.emoji}</span>
                            <span className="font-semibold">{rewardFormData.name}</span>
                          </div>
                          <Badge variant="secondary">{rewardFormData.pointsCost} pts</Badge>
                        </div>
                        <Separator className="my-3" />
                        <p className="text-sm mb-3">{rewardFormData.description}</p>
                        {rewardFormData.selectedItems.length > 0 && (
                          <p className="text-sm text-muted-foreground mb-2">
                            Choose from: {rewardFormData.selectedItems.map(id => menuItems.find(m => m.id === id)?.name).join(', ')}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mb-2">Available all day, every day</p>
                        <p className="text-sm text-muted-foreground mb-4">{rewardFormData.perMemberLimit} redemption per {rewardFormData.perMemberPeriod}</p>
                        <Button className="w-full">Redeem Now</Button>
                      </div>
                      <p className="text-xs text-center text-muted-foreground mt-3">
                        This is how members will see this reward
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Launch Settings</h4>

                    <RadioGroup value={rewardFormData.activationType} onValueChange={(value: any) => setRewardFormData({ ...rewardFormData, activationType: value })}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="immediate" id="immediate-reward" />
                        <label htmlFor="immediate-reward" className="text-sm">Make available immediately</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="draft" id="draft-reward" />
                        <label htmlFor="draft-reward" className="text-sm">Save as draft (activate later)</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="scheduled" id="scheduled-reward" />
                        <label htmlFor="scheduled-reward" className="text-sm">Schedule activation</label>
                      </div>
                    </RadioGroup>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notifications:</label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="email-reward-notif"
                            checked={rewardFormData.notifications.email}
                            onCheckedChange={(checked) => setRewardFormData({
                              ...rewardFormData,
                              notifications: { ...rewardFormData.notifications, email: checked as boolean }
                            })}
                          />
                          <label htmlFor="email-reward-notif" className="text-sm">Email all eligible members</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="push-reward-notif"
                            checked={rewardFormData.notifications.push}
                            onCheckedChange={(checked) => setRewardFormData({
                              ...rewardFormData,
                              notifications: { ...rewardFormData.notifications, push: checked as boolean }
                            })}
                          />
                          <label htmlFor="push-reward-notif" className="text-sm">Push notification to app</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="feature-reward-notif"
                            checked={rewardFormData.notifications.feature}
                            onCheckedChange={(checked) => setRewardFormData({
                              ...rewardFormData,
                              notifications: { ...rewardFormData.notifications, feature: checked as boolean }
                            })}
                          />
                          <label htmlFor="feature-reward-notif" className="text-sm">Feature on rewards page</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              {rewardWizardStep > 1 && (
                <Button variant="outline" onClick={handleRewardWizardBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowRewardWizard(false)}>
                Cancel
              </Button>
              {rewardWizardStep < 5 ? (
                <Button onClick={handleRewardWizardNext} disabled={rewardWizardStep === 1 && !rewardFormData.type}>
                  Next Step
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleRewardWizardPublish}>
                  Publish Reward
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={showTierDrawer} onOpenChange={setShowTierDrawer}>
          <SheetContent className="w-[900px] max-w-[90vw] overflow-y-auto">
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setShowTierDrawer(false)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <SheetTitle className="text-2xl">🥈 Silver Tier</SheetTitle>
                  <div className="flex items-center gap-4 mt-1">
                    <Badge variant="default" className="bg-green-500">Active</Badge>
                    <span className="text-sm text-muted-foreground">1,245 members (43.7%)</span>
                    <span className="text-sm text-muted-foreground">Last updated: 1h ago</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate Tier
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Export Data
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Tier
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </SheetHeader>

            <Separator className="my-4" />

            <Tabs value={tierDrawerTab} onValueChange={setTierDrawerTab} className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                <div>
                  <h3 className="font-semibold mb-4">Quick Stats</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Members</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">1,245</div>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          +89 (7.7%)
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Avg Points</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">876</div>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          +45 (5.4%)
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Avg Visits</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">6.2/month</div>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          +0.3
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Retention</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">84%</div>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          +2%
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Tier Requirements</h3>
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div>
                        <p className="text-sm font-medium">Points Required: 500 points</p>
                        <p className="text-sm text-muted-foreground">Estimated to achieve: ~2 visits (~2-4 weeks for regular customers)</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Path to Next Tier:</p>
                        <div className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <span>🥈 Silver (500 pts)</span>
                            <ArrowRight className="h-4 w-4" />
                            <span>🥇 Gold (1,500 pts)</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Gap: 1,000 points needed</p>
                          <p className="text-sm text-muted-foreground">Average time to upgrade: 8-12 weeks</p>
                          <p className="text-sm font-medium mt-2">445 members (35.7%) on track to reach Gold within 3 months</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Benefits & Perks</h3>
                  <div className="space-y-3">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">💰 10% discount on all orders</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Applied automatically • Always active</p>
                        <p className="text-sm text-muted-foreground mb-3">Avg savings per visit: €2.80</p>
                        <Separator className="my-3" />
                        <div className="flex items-center justify-between text-sm">
                          <span>Redemptions: 8,934 times used</span>
                          <span>Member usage: 95% have used this benefit</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">🪑 Priority seating</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Available all days • All locations</p>
                        <p className="text-sm text-muted-foreground mb-3">Skip wait times during peak hours</p>
                        <Separator className="my-3" />
                        <div className="text-sm">
                          <span>Engagement: <Badge variant="default">Very High</Badge></span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">✉️ Exclusive offers via email</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Monthly delivery • Special promotions</p>
                        <p className="text-sm text-muted-foreground mb-3">Open rate: 68% • Click rate: 42%</p>
                        <Separator className="my-3" />
                        <div className="text-sm">
                          <span>Engagement: <Badge variant="default">Very High</Badge></span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">🍽️ Free appetizer monthly</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Redeemable once per month • Choose from appetizer menu</p>
                        <Separator className="my-3" />
                        <div className="flex items-center justify-between text-sm">
                          <span>Redemptions: 567 this month</span>
                          <span>Member usage: 45% have redeemed this month</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Member Distribution</h3>
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-3">By Points Balance:</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm w-32">500-749 pts:</span>
                            <Progress value={35.7} className="flex-1" />
                            <span className="text-sm text-muted-foreground w-32">445 members (35.7%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm w-32">750-999 pts:</span>
                            <Progress value={25.1} className="flex-1" />
                            <span className="text-sm text-muted-foreground w-32">312 members (25.1%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm w-32">1000-1499 pts:</span>
                            <Progress value={39.2} className="flex-1" />
                            <span className="text-sm text-muted-foreground w-32">488 members (39.2%)</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Top Members (by points)</h3>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">1.</span>
                          <Avatar>
                            <AvatarFallback>ER</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">Emma Rodriguez</p>
                            <p className="text-sm text-muted-foreground">1,445 pts (15 pts from Gold) • 12 visits</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="link" className="w-full mt-3">View All Silver Members →</Button>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Metadata</h3>
                  <Card>
                    <CardContent className="pt-6 space-y-2 text-sm">
                      <p>Created: Jan 15, 2024 by Sarah Johnson</p>
                      <p>Last modified: Nov 10, 2024 by Mike Chen</p>
                      <p>Tier ID: tier_silver_001</p>
                      <p>Tags: regular-tier, mid-level, core-program</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="members" className="space-y-6 mt-6">
                <p className="text-sm text-muted-foreground">Member list with filters and sorting</p>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox />
                        </TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Visits</TableHead>
                        <TableHead>Next Tier</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <Checkbox />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar>
                              <AvatarFallback>ER</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">Emma Rodriguez</p>
                              <p className="text-sm text-muted-foreground">emma.r@email.com</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">1,445</p>
                            <Progress value={96.3} className="h-1 w-16 mt-1" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <p>12</p>
                          <p className="text-xs text-muted-foreground">this mo</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">Gold in 55pts</p>
                          <p className="text-xs text-muted-foreground">~1 visit</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-500">Active</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Checkbox />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar>
                              <AvatarFallback>MC</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">Michael Chang</p>
                              <p className="text-sm text-muted-foreground">michael.c@email.com</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">1,398</p>
                            <Progress value={93.2} className="h-1 w-16 mt-1" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <p>11</p>
                          <p className="text-xs text-muted-foreground">this mo</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">Gold in 102</p>
                          <p className="text-xs text-muted-foreground">~2 visits</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-500">Active</Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="default" size="sm">1</Button>
                  <Button variant="outline" size="sm">2</Button>
                  <Button variant="outline" size="sm">3</Button>
                  <span className="text-sm text-muted-foreground">...</span>
                  <Button variant="outline" size="sm">63</Button>
                  <Button variant="outline" size="sm">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6 mt-6">
                <p className="text-sm text-muted-foreground">Redemption trends, ROI calculations, popularity metrics</p>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6 mt-6">
                <p className="text-sm text-muted-foreground">Edit tier configuration and settings</p>
              </TabsContent>

              <TabsContent value="history" className="space-y-6 mt-6">
                <p className="text-sm text-muted-foreground">Audit log of changes</p>
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>

        <Sheet open={showRewardDrawer} onOpenChange={setShowRewardDrawer}>
          <SheetContent className="w-[600px] max-w-[90vw] overflow-auto">
            <SheetHeader>
              <SheetTitle>Reward Details</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Reward details content</p>
            </div>
          </SheetContent>
        </Sheet>

        <div className="space-y-6">
          {/* Timeline View Toggle */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => {
                    const newDate = new Date(currentCalendarDate)
                    newDate.setMonth(newDate.getMonth() - 1)
                    setCurrentCalendarDate(newDate)
                  }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-xl font-semibold">Member Engagement Timeline</h2>
                  <Button variant="ghost" size="icon" onClick={() => {
                    const newDate = new Date(currentCalendarDate)
                    newDate.setMonth(newDate.getMonth() + 1)
                    setCurrentCalendarDate(newDate)
                  }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Select value={timelineView} onValueChange={(v: any) => setTimelineView(v)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aggregate">Aggregate View</SelectItem>
                      <SelectItem value="member">Member View</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={timelineGranularity} onValueChange={(v: any) => setTimelineGranularity(v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Timeline & Activity Tab */}
          {activeTab === "timeline" && (
            <div className="space-y-6">
              
              {/* Activity Density Visualization */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Density Heatmap</CardTitle>
                  <CardDescription>November 2024 engagement overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-16 gap-1 items-end">
                    {aggregateTimelineData.dailyActivity.map((day, i) => (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 rounded-t transition-all hover:opacity-80 cursor-pointer ${getIntensityColor(day.intensity)}`}
                            style={{ height: `${day.intensity}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <div className="font-semibold">{day.date}</div>
                            <div>{day.visits} visits</div>
                            <div>{day.points} points</div>
                            <div>{day.redemptions} redemptions</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Nov 1</span>
                    <span>Nov 15</span>
                    <span>Nov 30</span>
                  </div>
                  <div className="flex gap-4 mt-4 text-xs justify-center">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-primary/20 rounded"></div> Light</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-primary/60 rounded"></div> Medium</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-primary rounded"></div> Peak</span>
                  </div>
                </CardContent>
              </Card>

              {/* Daily Highlights */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Highlights</CardTitle>
                  <CardDescription>Significant activity days this month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aggregateTimelineData.dailyActivity
                      .filter(day => day.intensity >= 85)
                      .map((day, i) => (
                        <div key={i} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold">{day.date}</span>
                            <div className="flex gap-2">
                              {day.events?.map((event, idx) => (
                                <Badge key={idx} variant="secondary">{event}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">Visits</div>
                              <div className="font-semibold text-lg">{day.visits}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Points Earned</div>
                              <div className="font-semibold text-lg">{day.points}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Redemptions</div>
                              <div className="font-semibold text-lg">{day.redemptions}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Key Events */}
              <Card>
                <CardHeader>
                  <CardTitle>Key Events This Month</CardTitle>
                  <CardDescription>Important milestones and campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aggregateTimelineData.keyEvents.map((event, i) => (
                      <div key={i} className="flex items-start gap-4 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="text-2xl">{event.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{event.date}</span>
                            <Badge variant="outline">{event.metric}</Badge>
                          </div>
                          <div className="font-semibold">{event.description}</div>
                          <div className="text-sm text-muted-foreground">{event.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Activity Heatmap */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Heatmap</CardTitle>
                  <CardDescription>Member engagement by day and hour</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* Heatmap grid */}
                      <div className="grid gap-1" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                        {/* Header */}
                        <div></div>
                        {activityHeatmapData.days.map((day, i) => (
                          <div key={i} className="text-center text-sm font-medium p-1">{day}</div>
                        ))}

                        {/* Rows */}
                        {activityHeatmapData.hours.map((hour, hourIdx) => (
                          <>
                            <div key={`label-${hourIdx}`} className="text-xs font-medium flex items-center justify-end pr-2 text-muted-foreground">
                              {hour}
                            </div>
                            {activityHeatmapData.days.map((_, dayIdx) => {
                              const intensity = activityHeatmapData.intensity[dayIdx][hourIdx]
                              return (
                                <Tooltip key={`${hourIdx}-${dayIdx}`}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`h-8 rounded cursor-pointer transition-transform hover:scale-105 ${getHeatmapColor(intensity)}`}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs">
                                      <div className="font-semibold">{activityHeatmapData.days[dayIdx]} {hour}</div>
                                      <div>Activity: {intensity}%</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )
                            })}
                          </>
                        ))}
                      </div>

                      {/* Legend */}
                      <div className="flex gap-4 mt-4 text-xs justify-center items-center">
                        <span>Low</span>
                        <div className="flex gap-1">
                          <div className="w-6 h-4 bg-slate-200 rounded"></div>
                          <div className="w-6 h-4 bg-blue-500 rounded"></div>
                          <div className="w-6 h-4 bg-green-500 rounded"></div>
                          <div className="w-6 h-4 bg-yellow-500 rounded"></div>
                          <div className="w-6 h-4 bg-orange-500 rounded"></div>
                          <div className="w-6 h-4 bg-red-600 rounded"></div>
                        </div>
                        <span>High</span>
                      </div>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="mt-6 space-y-2">
                    <h4 className="font-semibold text-sm">Insights</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {activityHeatmapData.insights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Tier Progression Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Tier Progression Timeline</CardTitle>
                  <CardDescription>Member journeys across loyalty tiers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Timeline scale */}
                    <div className="text-xs text-muted-foreground flex justify-between px-2">
                      <span>Day 0</span>
                      <span>Day 90</span>
                      <span>Day 180</span>
                      <span>Day 270</span>
                      <span>Today (Day 315)</span>
                    </div>

                    {/* Member progression bars */}
                    <div className="space-y-4">
                      {tierProgressionData.members.map((member, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium">{member.name}</span>
                              <span className="text-muted-foreground ml-2">{member.points} pts</span>
                            </div>
                          </div>
                          <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
                            {member.journey.map((segment, idx) => (
                              <Tooltip key={idx}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`absolute h-full ${segment.color} flex items-center justify-center text-xs font-medium text-white cursor-pointer hover:opacity-90 transition-opacity`}
                                    style={{
                                      left: `${(segment.start / 315) * 100}%`,
                                      width: `${(segment.duration / 315) * 100}%`
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <div className="font-semibold">{segment.tier}</div>
                                    <div>Day {segment.start} - Day {segment.start + segment.duration}</div>
                                    <div>{segment.duration} days in tier</div>
                                    {segment.note && <div className="text-amber-400 mt-1">{segment.note}</div>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Progression insights */}
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold text-sm mb-3">Progression Insights</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {tierProgressionData.insights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircleIcon className="h-4 w-4 text-green-600" />
                            <span>{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Predicted Churn Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Predicted Churn Timeline</CardTitle>
                  <CardDescription>Members at risk of tier downgrade</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {churnPredictionData.map((member, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{member.tierIcon}</div>
                            <div>
                              <div className="font-semibold">{member.name}</div>
                              <div className="text-sm text-muted-foreground">{member.id}</div>
                            </div>
                          </div>
                          <Badge variant={member.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                            {member.riskLevel.toUpperCase()} RISK
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">Current Tier</div>
                            <div className="font-semibold">{member.tier}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Points Balance</div>
                            <div className="font-semibold">{member.currentPoints} pts</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Points Needed</div>
                            <div className="font-semibold text-red-600">{member.pointsNeeded} pts</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Days Until Downgrade</div>
                            <div className="font-semibold text-red-600">{member.daysUntilDowngrade} days</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <div className="text-xs text-muted-foreground">Visit Frequency</div>
                            <div className="text-sm">
                              {member.visitFrequency.current} <span className="text-muted-foreground">(was {member.visitFrequency.previous})</span>
                            </div>
                            <div className="text-xs text-red-600 font-medium mt-1">
                              {member.visitFrequency.decline}% decline
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Last Visit</div>
                            <div className="text-sm font-medium">{member.lastVisit}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 text-sm">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Recommended: </span>
                            <span className="font-medium">{member.recommendedAction}</span>
                          </div>
                          <Button size="sm" variant="outline">
                            <Send className="h-4 w-4 mr-2" />
                            Send Offer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <Button variant="outline" className="w-full">
                      View All At-Risk Members ({churnPredictionData.length * 22})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="space-y-6">
              {/* Points Activity Calendar */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Button variant="ghost" size="icon" onClick={() => {
                        const newDate = new Date(currentCalendarDate)
                        newDate.setMonth(newDate.getMonth() - 1)
                        setCurrentCalendarDate(newDate)
                      }}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="text-xl font-semibold">{new Date(currentCalendarDate).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                      <Button variant="ghost" size="icon" onClick={() => {
                        const newDate = new Date(currentCalendarDate)
                        newDate.setMonth(newDate.getMonth() + 1)
                        setCurrentCalendarDate(newDate)
                      }}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={calendarView === "month" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCalendarView("month")}
                      >
                        Month
                      </Button>
                      <Button
                        variant={calendarView === "week" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCalendarView("week")}
                      >
                        Week
                      </Button>
                      <Button
                        variant={calendarView === "day" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCalendarView("day")}
                      >
                        Day
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Redemption Calendar for Week View */}
                  {calendarView === "week" && (
                    <div className="space-y-6">
                      <div className="text-center font-semibold text-lg mb-4">
                        Redemption Calendar - Week of {redemptionCalendarData.weekOf}
                      </div>

                      {/* Week view grid */}
                      <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                          <div className="grid gap-1" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                            {/* Header */}
                            <div></div>
                            {redemptionCalendarData.days.map((day, i) => (
                              <div key={i} className="text-center text-sm font-medium p-2 border-b">{day}</div>
                            ))}

                            {/* Time slots */}
                            {redemptionCalendarData.hours.map((hour, hourIdx) => (
                              <>
                                <div key={`label-${hourIdx}`} className="text-xs font-medium flex items-center justify-end pr-2 text-muted-foreground">
                                  {hour}
                                </div>
                                {redemptionCalendarData.days.map((_, dayIdx) => {
                                  const redemption = redemptionCalendarData.redemptions[hour]?.[dayIdx]
                                  return (
                                    <div
                                      key={`${hourIdx}-${dayIdx}`}
                                      className={`min-h-[60px] p-2 border rounded text-xs ${
                                        redemption ? 'bg-primary/10 hover:bg-primary/20' : 'bg-muted/30'
                                      } transition-colors cursor-pointer`}
                                    >
                                      {redemption && (
                                        <div className="space-y-1">
                                          <div className="font-medium">{redemption.reward}</div>
                                          <Badge variant="secondary" className="text-xs">
                                            {redemption.count}
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Week summary */}
                      <Card>
                        <CardContent className="pt-4">
                          <h3 className="font-semibold mb-3">Week Summary</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Total Redemptions</div>
                              <div className="text-xl font-bold">{redemptionCalendarData.summary.total}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Most Popular</div>
                              <div className="font-semibold">{redemptionCalendarData.summary.mostPopular.name}</div>
                              <div className="text-xs text-muted-foreground">{redemptionCalendarData.summary.mostPopular.count} redemptions</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Peak Time</div>
                              <div className="font-semibold">{redemptionCalendarData.summary.peakTime}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Peak Day</div>
                              <div className="font-semibold">{redemptionCalendarData.summary.peakDay.name}</div>
                              <div className="text-xs text-muted-foreground">{redemptionCalendarData.summary.peakDay.count} redemptions</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Month view - existing calendar */}
                  {calendarView === "month" && (
                    <>
                      <div className="grid grid-cols-7 gap-2">
                        {/* Day headers */}
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                          <div key={day} className="text-center text-sm font-medium p-2">
                            {day}
                          </div>
                        ))}

                        {/* Calendar cells */}
                        {Array.from({ length: new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 0).getDate() }).map((_, index) => {
                          const dayNumber = index + 1
                          const dayData = calendarData.days.find(d => d.dayNumber === dayNumber)
                          const isToday = dayData?.isToday || false

                          return (
                            <Card
                              key={index}
                              className={`min-h-[100px] p-2 ${isToday ? 'border-primary border-2' : ''} ${!dayData ? 'opacity-50' : ''}`}
                            >
                              <div className="text-sm font-medium">{dayNumber}</div>
                              {dayData && (
                                <div className="mt-1 space-y-1 text-xs">
                                  <div className="font-semibold">{dayData.points}K pts</div>
                                  <div className="text-muted-foreground">{dayData.members} mbrs</div>
                                  {dayData.events?.map((event, i) => (
                                    <Tooltip key={i}>
                                      <TooltipTrigger asChild>
                                        <Badge variant="secondary" className="text-xs cursor-pointer">
                                          {event.icon} {event.count}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {event.label}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              )}
                            </Card>
                          )
                        })}
                      </div>

                      {/* Month summary */}
                      <Card className="mt-6">
                        <CardContent className="pt-4">
                          <h3 className="font-semibold mb-3">Month Summary</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Total Points Issued</div>
                              <div className="text-xl font-bold">{calendarData.summary.totalPoints.toLocaleString()} pts</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Active Members</div>
                              <div className="text-xl font-bold">{calendarData.summary.totalMembers.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Avg Points/Day</div>
                              <div className="text-xl font-bold">{calendarData.summary.avgPointsPerDay.toLocaleString()} pts</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Peak Day</div>
                              <div className="text-xl font-bold">{calendarData.summary.peakDay.date}</div>
                              <div className="text-xs text-muted-foreground">{calendarData.summary.peakDay.points} pts</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "campaigns" && (
            <div className="space-y-6">
              {/* Campaign Tabs */}
              <div className="flex items-center gap-2 border-b">
                <Button
                  variant={campaignTab === "active" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCampaignTab("active")}
                  className="rounded-b-none"
                >
                  Active ({activeCampaigns.length})
                </Button>
                <Button
                  variant={campaignTab === "scheduled" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCampaignTab("scheduled")}
                  className="rounded-b-none"
                >
                  Scheduled (2)
                </Button>
                <Button
                  variant={campaignTab === "triggers" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCampaignTab("triggers")}
                  className="rounded-b-none"
                >
                  Automated Triggers ({automatedTriggers.length})
                </Button>
              </div>

              {/* Active Campaigns */}
              {campaignTab === "active" && (
                <div className="space-y-4">
                  {activeCampaigns.map(campaign => (
                    <Card key={campaign.id} className="border-l-4 border-l-green-500">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{campaign.icon}</span>
                              <CardTitle>{campaign.name}</CardTitle>
                              <Badge className="bg-green-500">Active</Badge>
                            </div>
                            <CardDescription>{campaign.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Campaign details */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Duration:</span> {campaign.duration}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Target:</span> {campaign.target}
                          </div>
                        </div>

                        {/* Performance metrics */}
                        <div>
                          <div className="text-sm font-medium mb-3">Performance:</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(campaign.performance).map(([key, value]) => (
                              <div key={key}>
                                <div className="text-xs text-muted-foreground capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </div>
                                <div className="text-lg font-bold">
                                  {typeof value === 'number' && key.includes('Rate') ? `${value}%` : value.toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Scheduled Campaigns */}
              {campaignTab === "scheduled" && (
                <div className="space-y-4">
                  {scheduledCampaigns.map(campaign => (
                    <Card key={campaign.id} className="border-l-4 border-l-blue-500">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{campaign.icon}</span>
                              <CardTitle>{campaign.name}</CardTitle>
                              <Badge variant="secondary">Scheduled</Badge>
                            </div>
                            <CardDescription>{campaign.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Campaign details */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Start Date:</span> {campaign.startDate}
                          </div>
                          <div>
                            <span className="text-muted-foreground">End Date:</span> {campaign.endDate}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Target:</span> {campaign.target}
                          </div>
                        </div>

                        {/* Estimated impact */}
                        <div>
                          <div className="text-sm font-medium mb-3">Estimated Impact:</div>
                          <div className="grid grid-cols-3 gap-4">
                            {campaign.estimatedImpact.expectedParticipants && (
                              <div>
                                <div className="text-xs text-muted-foreground">Expected Participants</div>
                                <div className="text-lg font-bold">{campaign.estimatedImpact.expectedParticipants.toLocaleString()}</div>
                              </div>
                            )}
                            {campaign.estimatedImpact.expectedUpgrades && (
                              <div>
                                <div className="text-xs text-muted-foreground">Expected Upgrades</div>
                                <div className="text-lg font-bold">{campaign.estimatedImpact.expectedUpgrades.toLocaleString()}</div>
                              </div>
                            )}
                            <div>
                              <div className="text-xs text-muted-foreground">Estimated Revenue</div>
                              <div className="text-lg font-bold">€{campaign.estimatedImpact.estimatedRevenue.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Budgeted Points</div>
                              <div className="text-lg font-bold">{campaign.estimatedImpact.budgetedPoints.toLocaleString()} pts</div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Automated Triggers */}
              {campaignTab === "triggers" && (
                <div className="space-y-4">
                  {automatedTriggers.map((trigger, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-3">
                            <div className="text-2xl">{trigger.icon}</div>
                            <div>
                              <h3 className="font-semibold text-lg">{trigger.name}</h3>
                              <Badge variant="secondary">⚡ Automated</Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Rules
                            </Button>
                            <Button variant="outline" size="sm">
                              <Pause className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Trigger Condition</div>
                              <div className="font-medium">{trigger.trigger}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Action</div>
                              <div className="font-medium">{trigger.action}</div>
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">Times Triggered</div>
                              <div className="text-lg font-bold">{trigger.stats.triggered}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Success Rate</div>
                              <div className="text-lg font-bold text-green-600">{trigger.stats.successRate}%</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Avg Engagement</div>
                              <div className="text-lg font-bold">{trigger.stats.avgEngagement}%</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 text-sm">
                            <span className="text-muted-foreground">
                              Status: <Badge variant="secondary">{trigger.status}</Badge>
                            </span>
                            <span className="text-muted-foreground">
                              Last triggered: {trigger.lastTriggered}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Analytics Sub-navigation */}
              <div className="flex items-center justify-between">
                <Tabs value={analyticsTab} onValueChange={(v: any) => setAnalyticsTab(v)} className="w-full">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="tiers">Tiers</TabsTrigger>
                    <TabsTrigger value="rewards">Rewards</TabsTrigger>
                    <TabsTrigger value="revenue">Revenue</TabsTrigger>
                    <TabsTrigger value="predictions">Predictions</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2">
                  <Select defaultValue="last-30-days">
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="last-7-days">Last 7 days</SelectItem>
                      <SelectItem value="last-30-days">Last 30 days</SelectItem>
                      <SelectItem value="this-month">This month</SelectItem>
                      <SelectItem value="last-month">Last month</SelectItem>
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Overview Analytics Content */}
              {analyticsTab === "overview" && (
                <div className="space-y-8">
                  {/* Program Health Score */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <Activity className="h-5 w-5" />
                        Program Health Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex flex-col items-center gap-4">
                        <div className="text-center">
                          <div className="text-6xl font-bold text-primary">87</div>
                          <div className="text-sm text-muted-foreground">/100</div>
                          <div className="mt-2 flex items-center justify-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            ))}
                            <span className="ml-2 font-medium">Excellent</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Member Engagement</span>
                            <span className="font-medium">92/100 · Excellent</span>
                          </div>
                          <Progress value={92} className="h-2" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Tier Distribution</span>
                            <span className="font-medium">85/100 · Very Good</span>
                          </div>
                          <Progress value={85} className="h-2" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Redemption Health</span>
                            <span className="font-medium">88/100 · Excellent</span>
                          </div>
                          <Progress value={88} className="h-2" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Revenue Impact</span>
                            <span className="font-medium">90/100 · Excellent</span>
                          </div>
                          <Progress value={90} className="h-2" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Member Retention</span>
                            <span className="font-medium">82/100 · Good</span>
                          </div>
                          <Progress value={82} className="h-2" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Growth Trajectory</span>
                            <span className="font-medium">89/100 · Excellent</span>
                          </div>
                          <Progress value={89} className="h-2" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                        <div>
                          <div className="text-sm text-muted-foreground">vs Last Month</div>
                          <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                            <TrendingUp className="h-4 w-4" />
                            +4 points
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">vs Industry Avg</div>
                          <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                            <TrendingUp className="h-4 w-4" />
                            +12 points (Top 15%)
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Member Lifecycle Funnel */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Member Lifecycle Funnel</CardTitle>
                      <CardDescription>Last 90 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium">Acquisition</span>
                            <span className="text-sm text-muted-foreground">3,245 signed up</span>
                          </div>
                          <div className="h-12 rounded-lg bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: '100%' }} />
                          <div className="mt-1 text-sm text-muted-foreground text-center">87.7% conversion ↓</div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium">Activation</span>
                            <span className="text-sm text-muted-foreground">2,847 made first purchase</span>
                          </div>
                          <div className="h-12 rounded-lg bg-gradient-to-r from-blue-400 to-blue-300" style={{ width: '87.7%' }} />
                          <div className="mt-1 text-sm text-muted-foreground text-center">68.5% conversion ↓</div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium">Engagement</span>
                            <span className="text-sm text-muted-foreground">1,950 earned points 3+ times</span>
                          </div>
                          <div className="h-12 rounded-lg bg-gradient-to-r from-blue-300 to-blue-200" style={{ width: '60%' }} />
                          <div className="mt-1 text-sm text-muted-foreground text-center">82.0% conversion ↓</div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium">Retention</span>
                            <span className="text-sm text-muted-foreground">1,599 active 60+ days</span>
                          </div>
                          <div className="h-12 rounded-lg bg-gradient-to-r from-blue-200 to-blue-100" style={{ width: '49%' }} />
                          <div className="mt-1 text-sm text-muted-foreground text-center">15.3% conversion ↓</div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium">Advocacy</span>
                            <span className="text-sm text-muted-foreground">245 referred others</span>
                          </div>
                          <div className="h-12 rounded-lg bg-gradient-to-r from-blue-100 to-blue-50" style={{ width: '7.5%' }} />
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 rounded-lg border p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Signup → Activation: 87.7%</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Activation → Engagement: 62.3%</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <span>Engagement → Retention: 15.3% (opportunity to improve)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CHANGE: Added Dialog to show reward details when View Details button is clicked */}
        <Dialog open={selectedRewardDetails !== null} onOpenChange={(open) => !open && setSelectedRewardDetails(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{selectedRewardDetails?.emoji}</span>
                {selectedRewardDetails?.name}
              </DialogTitle>
              <DialogDescription>
                Detailed performance metrics and statistics
              </DialogDescription>
            </DialogHeader>
            
            {selectedRewardDetails && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedRewardDetails.redemptions}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Redemption rate: {selectedRewardDetails.rate}%
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Return on Investment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedRewardDetails.roi}x</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Rating: {selectedRewardDetails.rating}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance Overview */}
                <div>
                  <h3 className="font-semibold mb-3">Performance Overview</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Redemption Progress</span>
                        <span className="text-muted-foreground">{selectedRewardDetails.rate}%</span>
                      </div>
                      <Progress value={selectedRewardDetails.rate} className="h-2" />
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div>
                  <h3 className="font-semibold mb-3">Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Redemptions:</span>
                      <span className="font-medium">{selectedRewardDetails.redemptions}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Redemption Rate:</span>
                      <span className="font-medium">{selectedRewardDetails.rate}%</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ROI:</span>
                      <span className="font-medium">{selectedRewardDetails.roi}x</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rating:</span>
                      <span className="font-medium">{selectedRewardDetails.rating}</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedRewardDetails(null)}>
                    Close
                  </Button>
                  <Button>
                    View Full Report
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

          </div>
        </div>
      </div>
    </>
  )
}
