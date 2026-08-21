"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Edit,
  Copy,
  MoreVertical,
  Download,
  Trash2,
  Mail,
  MessageSquare,
  Users,
  TrendingUp,
  ExternalLink,
  Search,
  ChevronDown,
  CheckCircle,
  XCircle,
  MapPin,
  Monitor,
  Tablet,
  Smartphone,
  Play,
  FileText,
} from "lucide-react"
import { getCampaignDetailData } from "../detail-mock-data"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const displayPhone = useDisplayPhone()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [recipientSearch, setRecipientSearch] = useState("")
  const [recipientStatusFilter, setRecipientStatusFilter] = useState("all")
  const [recipientChannelFilter, setRecipientChannelFilter] = useState("all")
  const [orderSearch, setOrderSearch] = useState("")
  const [orderAttributionFilter, setOrderAttributionFilter] = useState("all")
  const [attributionWindow, setAttributionWindow] = useState("7")
  const [attributionModel, setAttributionModel] = useState("last_click")

  const data = getCampaignDetailData(params.id)

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-2">Campaign not found</h2>
          <p className="text-muted-foreground mb-4">The campaign you're looking for doesn't exist.</p>
          <Button onClick={() => router.push("/campaigns")}>Back to Campaigns</Button>
        </div>
      </div>
    )
  }

  const filteredRecipients = data.recipients.filter((r) => {
    const matchesSearch =
      recipientSearch === "" ||
      r.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.email?.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.phone?.toLowerCase().includes(recipientSearch.toLowerCase())
    const matchesStatus = recipientStatusFilter === "all" || r.deliveryStatus === recipientStatusFilter
    const matchesChannel = recipientChannelFilter === "all" || r.channels.includes(recipientChannelFilter)
    return matchesSearch && matchesStatus && matchesChannel
  })

  const filteredOrders = data.attributedOrders.filter((o) => {
    const matchesSearch =
      orderSearch === "" ||
      o.orderId.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerName.toLowerCase().includes(orderSearch.toLowerCase())
    const matchesType = orderAttributionFilter === "all" || o.attributionType === orderAttributionFilter
    return matchesSearch && matchesType
  })

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1400px]">
      {/* Back Button */}
      <Button variant="ghost" className="mb-4" onClick={() => router.push("/campaigns")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Campaigns
      </Button>

      {/* Campaign Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-6 h-6 text-primary" />
                <h1 className="text-3xl font-bold">{data.name}</h1>
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Sent
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                Sent on{" "}
                {new Date(data.sentAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                at {new Date(data.sentAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} CET •
                Created by {data.createdBy}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium">Channels:</span>
                {data.channels.map((channel) => (
                  <Badge key={channel} variant="outline" className="gap-1">
                    {channel === "email" && <Mail className="w-3 h-3" />}
                    {channel === "sms" && <MessageSquare className="w-3 h-3" />}
                    {channel.charAt(0).toUpperCase() + channel.slice(1)}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{data.audience.count.toLocaleString()} customers</span>
                <span className="text-muted-foreground">• {data.audience.segmentName}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Download className="w-4 h-4 mr-2" />
                    Export Results
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button size="sm">
              <Play className="w-4 h-4 mr-2" />
              Run Again
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              View Template
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Performance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.sent.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground mt-1">100%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.delivered.toLocaleString()}</div>
            <div className="text-sm font-semibold text-success">{data.metrics.deliveryRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">Industry avg {data.benchmarks.deliveryRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Opened</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.opens.toLocaleString()}</div>
            <div className="text-sm font-semibold text-success flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {data.metrics.openRate}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Above avg {data.benchmarks.openRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clicked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.clicks.toLocaleString()}</div>
            <div className="text-sm font-semibold text-success flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {data.metrics.clickRate}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Above avg {data.benchmarks.clickRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.conversions.toLocaleString()}</div>
            <div className="text-sm font-semibold text-success flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {data.metrics.conversionRate}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Excellent {data.benchmarks.conversionRate}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{data.metrics.revenue.toLocaleString()}</div>
            <div className="text-sm text-success flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" />
              +€2,145 vs average
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.roi}x</div>
            <div className="text-sm text-success flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" />
              +0.8x vs target
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unsubscribed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.unsubscribes}</div>
            <div className="text-sm text-muted-foreground mt-1">0.2% • Low rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Performance Over Time Chart */}
          <PerformanceChart data={data} />

          {/* Delivery Timeline */}
          <DeliveryTimeline timeline={data.timeline} />

          {/* Channel Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.channelMetrics.email && <EmailPerformance metrics={data.channelMetrics.email} />}
            {data.channelMetrics.sms && <SMSPerformance metrics={data.channelMetrics.sms} />}
          </div>

          {/* Geographic Performance */}
          <GeographicPerformance geoData={data.geoData} />

          {/* Top Performing Links */}
          <TopPerformingLinks links={data.links} />
        </TabsContent>

        {/* Recipients Tab */}
        <TabsContent value="recipients" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recipient List</CardTitle>
                  <CardDescription>Showing {filteredRecipients.length} recipients</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search recipients..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={recipientStatusFilter} onValueChange={setRecipientStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={recipientChannelFilter} onValueChange={setRecipientChannelFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <RecipientsTable recipients={filteredRecipients.slice(0, 10)} />
            </CardContent>
          </Card>

          {/* Delivery Status Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Status Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Delivered: {data.deliveryStatus.delivered} (
                    {((data.deliveryStatus.delivered / data.metrics.sent) * 100).toFixed(1)}%)
                  </span>
                  <span className="font-medium">
                    {((data.deliveryStatus.delivered / data.metrics.sent) * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={(data.deliveryStatus.delivered / data.metrics.sent) * 100} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Failed: {data.deliveryStatus.failed} (
                    {((data.deliveryStatus.failed / data.metrics.sent) * 100).toFixed(1)}%)
                  </span>
                  <span className="font-medium">
                    {((data.deliveryStatus.failed / data.metrics.sent) * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={(data.deliveryStatus.failed / data.metrics.sent) * 100}
                  className="bg-muted [&>div]:bg-destructive"
                />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Failed reasons:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {data.deliveryStatus.failureReasons.map((reason) => (
                    <li key={reason.reason}>
                      • {reason.reason}: {reason.count} ({reason.percentage.toFixed(1)}%)
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm">
                  View Failed Recipients
                </Button>
                <Button variant="outline" size="sm">
                  Retry Failed
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attribution Tab */}
        <TabsContent value="attribution" className="space-y-6">
          <AttributionSummary
            data={data}
            attributionWindow={attributionWindow}
            setAttributionWindow={setAttributionWindow}
            attributionModel={attributionModel}
            setAttributionModel={setAttributionModel}
          />

          <ConversionTimeline timeSeriesData={data.timeSeriesData.conversions} />

          <AttributedOrdersList
            orders={filteredOrders.slice(0, 10)}
            orderSearch={orderSearch}
            setOrderSearch={setOrderSearch}
            orderAttributionFilter={orderAttributionFilter}
            setOrderAttributionFilter={setOrderAttributionFilter}
            totalOrders={data.attributedOrders.length}
          />

          <AttributionBreakdown data={data} />
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Performance Analytics</CardTitle>
              <CardDescription>Deep dive into campaign metrics and insights</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Advanced analytics coming soon. This will include engagement patterns, A/B test results, and comparison
                analytics.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <CampaignSettings data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Component: Performance Chart
function PerformanceChart({ data }: { data: any }) {
  const maxValue = Math.max(...data.timeSeriesData.opens.map((d: any) => d.count))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Opens & Clicks Over Time</CardTitle>
            <CardDescription>Performance in the first 24 hours</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="24h">
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Export Chart
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Export as PNG</DropdownMenuItem>
                <DropdownMenuItem>Export as SVG</DropdownMenuItem>
                <DropdownMenuItem>Export CSV Data</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] relative">
          {/* Simple SVG chart */}
          <svg className="w-full h-full" viewBox="0 0 800 300">
            {/* Grid lines */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={i}
                x1="40"
                y1={50 + i * 40}
                x2="780"
                y2={50 + i * 40}
                stroke="currentColor"
                strokeOpacity="0.1"
              />
            ))}

            {/* Y-axis labels */}
            {[0, 100, 200, 300, 400, 500].map((val, i) => (
              <text key={val} x="30" y={250 - i * 40} fontSize="12" fill="currentColor" opacity="0.5" textAnchor="end">
                {val}
              </text>
            ))}

            {/* Opens line (blue) */}
            <polyline
              points={data.timeSeriesData.opens
                .map((d: any, i: number) => `${60 + i * 60},${250 - (d.count / maxValue) * 200}`)
                .join(" ")}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />

            {/* Clicks line (green) */}
            <polyline
              points={data.timeSeriesData.clicks
                .map((d: any, i: number) => `${60 + i * 60},${250 - (d.count / maxValue) * 200}`)
                .join(" ")}
              fill="none"
              stroke="hsl(var(--success))"
              strokeWidth="2"
              strokeDasharray="5,5"
            />

            {/* X-axis labels */}
            {data.timeSeriesData.opens.slice(0, 12).map((d: any, i: number) => (
              <text key={i} x={60 + i * 60} y="275" fontSize="12" fill="currentColor" opacity="0.5" textAnchor="middle">
                {new Date(d.timestamp).toLocaleTimeString("en-US", { hour: "numeric" })}
              </text>
            ))}
          </svg>
        </div>

        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span className="text-sm">Opens ({data.metrics.opens} total)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success"></div>
            <span className="text-sm">Clicks ({data.metrics.clicks} total)</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center mt-4">Peak activity: 12:00 PM - 2:00 PM</p>
      </CardContent>
    </Card>
  )
}

// Component: Delivery Timeline
function DeliveryTimeline({ timeline }: { timeline: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Progress & Status</CardTitle>
        <CardDescription>Complete timeline of campaign delivery</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {timeline.map((event, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                {index < timeline.length - 1 && <div className="w-0.5 h-full bg-border mt-1"></div>}
              </div>
              <div className="flex-1 pb-6">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  {new Date(event.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="font-semibold mb-1">{event.event}</div>
                <div className="text-sm text-muted-foreground">{event.details}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Component: Email Performance
function EmailPerformance({ metrics }: { metrics: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Email Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Sent</p>
            <p className="font-semibold">{metrics.sent.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Delivered</p>
            <p className="font-semibold">
              {metrics.delivered.toLocaleString()} ({((metrics.delivered / metrics.sent) * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Opened</p>
            <p className="font-semibold">
              {metrics.opened.toLocaleString()} ({((metrics.opened / metrics.delivered) * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Clicked</p>
            <p className="font-semibold">
              {metrics.clicked.toLocaleString()} ({((metrics.clicked / metrics.delivered) * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Conversions</p>
            <p className="font-semibold">
              {metrics.conversions.toLocaleString()} ({((metrics.conversions / metrics.delivered) * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Revenue</p>
            <p className="font-semibold">€{metrics.revenue.toLocaleString()}</p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Top performing subject:</p>
          <p className="text-sm text-muted-foreground">"{metrics.topSubject}"</p>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Device breakdown:</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <span>Mobile</span>
              </div>
              <span className="font-medium">{metrics.deviceBreakdown.mobile}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span>Desktop</span>
              </div>
              <span className="font-medium">{metrics.deviceBreakdown.desktop}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Tablet className="w-4 h-4" />
                <span>Tablet</span>
              </div>
              <span className="font-medium">{metrics.deviceBreakdown.tablet}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Component: SMS Performance
function SMSPerformance({ metrics }: { metrics: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-success" />
          SMS Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Sent</p>
            <p className="font-semibold">{metrics.sent.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Delivered</p>
            <p className="font-semibold">
              {metrics.delivered.toLocaleString()} ({((metrics.delivered / metrics.sent) * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Clicked</p>
            <p className="font-semibold">
              {metrics.clicked.toLocaleString()} ({((metrics.clicked / metrics.sent) * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Conversions</p>
            <p className="font-semibold">
              {metrics.conversions.toLocaleString()} ({((metrics.conversions / metrics.sent) * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Revenue</p>
            <p className="font-semibold">€{metrics.revenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cost</p>
            <p className="font-semibold">
              €{metrics.cost.toFixed(2)} (€{(metrics.cost / metrics.sent).toFixed(2)}/msg)
            </p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">ROI</p>
          <p className="text-2xl font-bold text-success">{metrics.roi}x</p>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Avg response time</p>
          <p className="text-sm text-muted-foreground">{metrics.avgResponseTime}</p>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Link clicks by time:</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            {metrics.clicksByTime.map((slot: any) => (
              <div key={slot.time}>
                • {slot.time}: {slot.percentage}%
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Component: Geographic Performance
function GeographicPerformance({ geoData }: { geoData: any[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Opens by Location</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Map View
            </Button>
            <Button variant="default" size="sm">
              List View
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {geoData.map((loc, index) => (
            <div key={loc.location} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {index + 1}. {loc.location}
                  </span>
                  <span className="text-muted-foreground">
                    {loc.opens} opens ({loc.percentage.toFixed(1)}%)
                  </span>
                </div>
                <span className="font-medium">{loc.percentage.toFixed(1)}%</span>
              </div>
              <Progress value={loc.percentage} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Component: Top Performing Links
function TopPerformingLinks({ links }: { links: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Performing Links</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Link</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>Conversions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.url}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{link.label}</span>
                  </div>
                </TableCell>
                <TableCell>{link.clicks}</TableCell>
                <TableCell>{link.ctr.toFixed(1)}%</TableCell>
                <TableCell>{link.conversions > 0 ? `${link.conversions} orders` : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// Component: Recipients Table
function RecipientsTable({ recipients }: { recipients: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox />
          </TableHead>
          <TableHead>Recipient</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Opened</TableHead>
          <TableHead>Clicked</TableHead>
          <TableHead>Converted</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recipients.map((recipient) => (
          <TableRow key={recipient.id}>
            <TableCell>
              <Checkbox />
            </TableCell>
            <TableCell>
              <div>
                <div className="font-medium">{recipient.name}</div>
                <div className="text-sm text-muted-foreground">{recipient.email || displayPhone(recipient.phone)}</div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                {recipient.channels.includes("email") && <Mail className="w-4 h-4 text-primary" />}
                {recipient.channels.includes("sms") && <MessageSquare className="w-4 h-4 text-success" />}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={recipient.deliveryStatus === "delivered" ? "default" : "destructive"}>
                {recipient.deliveryStatus}
              </Badge>
            </TableCell>
            <TableCell>
              {recipient.openCount > 0 ? (
                <div>
                  <CheckCircle className="w-4 h-4 text-success inline mr-1" />
                  {recipient.openCount}x
                  <div className="text-xs text-muted-foreground">
                    {recipient.openTimestamps[0] && new Date(recipient.openTimestamps[0]).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>
              {recipient.clickCount > 0 ? (
                <div>
                  <CheckCircle className="w-4 h-4 text-success inline mr-1" />
                  {recipient.clickCount}x
                  <div className="text-xs text-muted-foreground">
                    {recipient.clickTimestamps[0] && new Date(recipient.clickTimestamps[0]).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>
              {recipient.converted ? (
                <div>
                  <CheckCircle className="w-4 h-4 text-success inline mr-1" />
                  <div className="text-xs text-muted-foreground">€{recipient.orderValue}</div>
                </div>
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>View Full Profile</DropdownMenuItem>
                  <DropdownMenuItem>View Orders</DropdownMenuItem>
                  <DropdownMenuItem>Resend Message</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// Component: Attribution Summary
function AttributionSummary({
  data,
  attributionWindow,
  setAttributionWindow,
  attributionModel,
  setAttributionModel,
}: any) {
  const directClick = Math.round(data.attributedOrders.length * 0.57)
  const sameSession = Math.round(data.attributedOrders.length * 0.29)
  const within24h = data.attributedOrders.length - directClick - sameSession

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Attribution</CardTitle>
        <CardDescription>Track orders and revenue from this campaign</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Attribution Window</label>
            <Select value={attributionWindow} onValueChange={setAttributionWindow}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Day</SelectItem>
                <SelectItem value="3">3 Days</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Attribution Model</label>
            <Select value={attributionModel} onValueChange={setAttributionModel}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_click">Last Click</SelectItem>
                <SelectItem value="first_click">First Click</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="time_decay">Time Decay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Total Orders</div>
              <div className="text-2xl font-bold">{data.attributedOrders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Direct Click</div>
              <div className="text-2xl font-bold">{directClick}</div>
              <div className="text-xs text-muted-foreground">57%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Same Session</div>
              <div className="text-2xl font-bold">{sameSession}</div>
              <div className="text-xs text-muted-foreground">29%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Within 24h</div>
              <div className="text-2xl font-bold">{within24h}</div>
              <div className="text-xs text-muted-foreground">14%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
              <div className="text-2xl font-bold">€{data.metrics.revenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Avg Order Value</div>
              <div className="text-2xl font-bold">
                €{(data.metrics.revenue / data.attributedOrders.length).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Campaign Cost</div>
              <div className="text-2xl font-bold">€2,950</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">ROI</div>
              <div className="text-2xl font-bold text-success">{data.metrics.roi}x</div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}

// Component: Conversion Timeline
function ConversionTimeline({ timeSeriesData }: { timeSeriesData: any[] }) {
  const maxRevenue = Math.max(...timeSeriesData.map((d) => d.revenue))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Orders Over Time</CardTitle>
            <CardDescription>Conversion timeline since campaign sent</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Export Chart
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Export as PNG</DropdownMenuItem>
              <DropdownMenuItem>Export as SVG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <svg className="w-full h-full" viewBox="0 0 800 250">
            {/* Grid */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1="40"
                y1={40 + i * 40}
                x2="760"
                y2={40 + i * 40}
                stroke="currentColor"
                strokeOpacity="0.1"
              />
            ))}

            {/* Line */}
            <polyline
              points={timeSeriesData.map((d, i) => `${60 + i * 65},${200 - (d.count / 40) * 150}`).join(" ")}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />

            {/* Points */}
            {timeSeriesData.map((d, i) => (
              <circle key={i} cx={60 + i * 65} cy={200 - (d.count / 40) * 150} r="4" fill="hsl(var(--primary))" />
            ))}

            {/* X-axis labels */}
            {timeSeriesData.map((d, i) => (
              <text key={i} x={60 + i * 65} y="230" fontSize="12" fill="currentColor" opacity="0.5" textAnchor="middle">
                Day {i + 1}
              </text>
            ))}
          </svg>
        </div>
        <p className="text-sm text-muted-foreground text-center mt-4">Total: 156 orders • Peak: Day 2 (38 orders)</p>
      </CardContent>
    </Card>
  )
}

// Component: Attributed Orders List
function AttributedOrdersList({
  orders,
  orderSearch,
  setOrderSearch,
  orderAttributionFilter,
  setOrderAttributionFilter,
  totalOrders,
}: any) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Attributed Orders List</CardTitle>
            <CardDescription>
              Showing {orders.length} of {totalOrders} orders
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={orderAttributionFilter} onValueChange={setOrderAttributionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Attribution Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="direct_click">Direct Click</SelectItem>
              <SelectItem value="same_session">Same Session</SelectItem>
              <SelectItem value="within_24h">Within 24h</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox />
              </TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order Total</TableHead>
              <TableHead>Attributed</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order: any) => (
              <TableRow key={order.orderId}>
                <TableCell>
                  <Checkbox />
                </TableCell>
                <TableCell>
                  <Button variant="link" className="h-auto p-0 font-medium">
                    {order.orderId}
                  </Button>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{order.customerName}</div>
                    <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">€{order.orderTotal.toFixed(2)}</TableCell>
                <TableCell className="text-sm">{order.attributionTime}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {order.attributionType === "direct_click" && "Direct click"}
                    {order.attributionType === "same_session" && "Same session"}
                    {order.attributionType === "within_24h" && "Within 24h"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// Component: Attribution Breakdown
function AttributionBreakdown({ data }: { data: any }) {
  const attributionTypes = [
    { label: "Direct Click", value: 57, count: 89 },
    { label: "Same Session", value: 29, count: 45 },
    { label: "Within 24h", value: 14, count: 22 },
  ]

  const productCategories = [
    { label: "Main Courses", value: 50, count: 78 },
    { label: "Beverages", value: 29, count: 45 },
    { label: "Desserts", value: 21, count: 33 },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Attribution Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {attributionTypes.map((type) => (
            <div key={type.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {type.label}: {type.count} ({type.value}%)
                </span>
                <span className="font-medium">{type.value}%</span>
              </div>
              <Progress value={type.value} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {productCategories.map((cat) => (
            <div key={cat.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {cat.label}: {cat.count} ({cat.value}%)
                </span>
                <span className="font-medium">{cat.value}%</span>
              </div>
              <Progress value={cat.value} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Component: Campaign Settings
function CampaignSettings({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Setup</CardTitle>
          <CardDescription>View-only configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Campaign Name</label>
            <p className="text-sm text-muted-foreground mt-1">{data.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Created By</label>
            <p className="text-sm text-muted-foreground mt-1">{data.createdBy}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Created Date</label>
            <p className="text-sm text-muted-foreground mt-1">{new Date(data.sentAt).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audience Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Segment Used</label>
            <p className="text-sm text-muted-foreground mt-1">{data.audience.segmentName}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Final Recipient Count</label>
            <p className="text-sm text-muted-foreground mt-1">{data.audience.count.toLocaleString()} customers</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Subject Line</label>
            <p className="text-sm text-muted-foreground mt-1">"Welcome! Here's 20% off your first order"</p>
          </div>
          <div>
            <label className="text-sm font-medium">Links Included</label>
            <p className="text-sm text-muted-foreground mt-1">{data.links.length} links</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Send Time</label>
            <p className="text-sm text-muted-foreground mt-1">{new Date(data.sentAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Timezone</label>
            <p className="text-sm text-muted-foreground mt-1">Europe/Malta (CET)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
