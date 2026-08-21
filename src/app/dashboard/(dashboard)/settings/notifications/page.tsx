"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, TestTube2, Plus, Search, MoreVertical, CheckCircle2, AlertCircle, Clock } from "lucide-react"
import { mockChannels, mockTemplates, mockTriggers, mockDeliveryLogs } from "./data"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TestNotificationModal } from "./components/test-notification-modal"
import { EditTemplateModal } from "./components/edit-template-modal"
import { ConfigureChannelModal } from "./components/configure-channel-modal"
import { AddChannelModal } from "./components/add-channel-modal"
import { AddTriggerModal } from "./components/add-trigger-modal"
import { EditTriggerModal } from "./components/edit-trigger-modal"
import { NotificationsSettingsModal } from "./components/notifications-settings-modal"
import { ViewDeliveryLogModal } from "./components/view-delivery-log-modal"
import { useToast } from "@/hooks/use-toast"
import type { NotificationChannel, NotificationTemplate } from "./types"
import type { NotificationTrigger, DeliveryLog } from "./types"

export default function NotificationsPage() {
  const displayPhone = useDisplayPhone()
  const [channels, setChannels] = useState(mockChannels)
  const [templates] = useState(mockTemplates)
  const [triggers, setTriggers] = useState(mockTriggers)
  const [logs] = useState(mockDeliveryLogs)
  const [searchQuery, setSearchQuery] = useState("")

  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testChannelId, setTestChannelId] = useState<string | undefined>()
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null)
  const [configureModalOpen, setConfigureModalOpen] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null)
  const [addChannelModalOpen, setAddChannelModalOpen] = useState(false)
  const [addTriggerModalOpen, setAddTriggerModalOpen] = useState(false)
  const [editTriggerModalOpen, setEditTriggerModalOpen] = useState(false)
  const [selectedTrigger, setSelectedTrigger] = useState<NotificationTrigger | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [viewLogModalOpen, setViewLogModalOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<DeliveryLog | null>(null)
  const { toast } = useToast()

  const activeChannels = channels.filter((c) => c.active).length
  const totalChannels = channels.length

  const handleToggleChannel = (channelId: string) => {
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, active: !c.active } : c)))
    const channel = channels.find((c) => c.id === channelId)
    toast({
      title: `${channel?.name} ${channel?.active ? "disabled" : "enabled"}`,
      description: `Notifications via ${channel?.name} have been ${channel?.active ? "disabled" : "enabled"}`,
    })
  }

  const handleTestChannel = (channelId: string) => {
    setTestChannelId(channelId)
    setTestModalOpen(true)
  }

  const handleConfigureChannel = (channel: NotificationChannel) => {
    setSelectedChannel(channel)
    setConfigureModalOpen(true)
  }

  const handleEditTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template)
    setEditTemplateModalOpen(true)
  }

  const handleNewTemplate = () => {
    setSelectedTemplate(null)
    setEditTemplateModalOpen(true)
  }

  const handleDeleteTemplate = (templateId: string) => {
    toast({
      title: "Template deleted",
      description: "The template has been permanently deleted",
    })
  }

  const handleToggleTrigger = (triggerId: string) => {
    setTriggers((prev) => prev.map((t) => (t.id === triggerId ? { ...t, active: !t.active } : t)))
    const trigger = triggers.find((t) => t.id === triggerId)
    toast({
      title: `Trigger ${trigger?.active ? "disabled" : "enabled"}`,
      description: `"${trigger?.event}" trigger has been ${trigger?.active ? "disabled" : "enabled"}`,
    })
  }

  const handleRetryLog = (logId: string) => {
    toast({
      title: "Retrying notification",
      description: "The notification is being resent...",
    })
  }

  const handleViewLog = (log: DeliveryLog) => {
    setSelectedLog(log)
    setViewLogModalOpen(true)
  }

  const handleEditTrigger = (trigger: NotificationTrigger) => {
    setSelectedTrigger(trigger)
    setEditTriggerModalOpen(true)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Manage notification channels, templates, and delivery settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTestModalOpen(true)}>
            <TestTube2 className="h-4 w-4 mr-2" />
            Test Notifications
          </Button>
          <Button variant="outline" onClick={() => setSettingsModalOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Global Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {channels.slice(0, 4).map((channel) => (
                <div key={channel.id} className="flex items-center gap-2">
                  <span className="text-2xl">{channel.icon}</span>
                  <Switch checked={channel.active} onCheckedChange={() => handleToggleChannel(channel.id)} />
                </div>
              ))}
              <Badge variant="secondary">
                {activeChannels} of {totalChannels} Active
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setTestModalOpen(true)}>
                Send Test
              </Button>
              <Button variant="outline" size="sm">
                View Logs
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSettingsModalOpen(true)}>
                Channel Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="channels" className="space-y-6">
        <TabsList>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Notification Channels ({channels.length})</h2>
            <Button onClick={() => setAddChannelModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => (
              <Card key={channel.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{channel.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{channel.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          {channel.connected ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              <span className="text-green-600">Connected & Active</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 text-orange-600" />
                              <span className="text-orange-600">Not Connected</span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={channel.active}
                      disabled={!channel.connected}
                      onCheckedChange={() => handleToggleChannel(channel.id)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider:</span>
                      <span className="font-medium">{channel.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={channel.status === "healthy" ? "default" : "secondary"}>{channel.status}</Badge>
                    </div>
                  </div>

                  {channel.connected && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sent today:</span>
                        <span className="font-medium">{channel.sentToday}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Failed:</span>
                        <span className="font-medium">{channel.failedToday}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery rate:</span>
                        <span className="font-medium">{channel.deliveryRate}%</span>
                      </div>
                    </div>
                  )}

                  {channel.lastTested && (
                    <div className="text-xs text-muted-foreground">
                      Last tested: {channel.lastTested.date} by {channel.lastTested.by}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {channel.connected ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent"
                          onClick={() => handleTestChannel(channel.id)}
                        >
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent"
                          onClick={() => handleConfigureChannel(channel)}
                        >
                          Configure
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" className="flex-1" onClick={() => handleConfigureChannel(channel)}>
                          Connect
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent"
                          onClick={() => handleConfigureChannel(channel)}
                        >
                          Setup
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-xl font-semibold">Notification Templates ({templates.length})</h2>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="order">Orders</SelectItem>
                  <SelectItem value="reservation">Reservations</SelectItem>
                  <SelectItem value="receipt">Receipts</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button onClick={handleNewTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Channels</th>
                    <th className="text-left p-4 font-medium">Updated</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <Badge variant="outline">{template.type}</Badge>
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-muted-foreground">{template.description}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {template.sentLast7Days} sent (last 7 days)
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {template.channels.map((channel) => (
                            <span key={channel} className="text-lg">
                              {channel === "email" && "📧"}
                              {channel === "sms" && "📱"}
                              {channel === "whatsapp" && "💬"}
                              {channel === "push" && "🔔"}
                            </span>
                          ))}
                          <Badge variant={template.active ? "default" : "secondary"} className="text-xs">
                            {template.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <div>{template.updatedAt}</div>
                          <div className="text-muted-foreground">{template.updatedBy}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditTemplate(template)}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setTestModalOpen(true)}>
                            Test
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Duplicate</DropdownMenuItem>
                              <DropdownMenuItem>View History</DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteTemplate(template.id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Triggers Tab */}
        <TabsContent value="triggers" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Notification Triggers ({triggers.length})</h2>
            <Button onClick={() => setAddTriggerModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Trigger
            </Button>
          </div>

          <div className="space-y-3">
            {triggers.map((trigger) => (
              <Card key={trigger.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`mt-1 h-3 w-3 rounded-full ${trigger.active ? "bg-green-600" : "bg-gray-400"}`} />
                      <div className="flex-1 space-y-2">
                        <div className="font-medium">{trigger.event}</div>
                        <div className="text-sm text-muted-foreground">
                          → Send "{trigger.template}" via{" "}
                          {trigger.channels
                            .map((c) => {
                              if (c === "email") return "📧 Email"
                              if (c === "sms") return "📱 SMS"
                              if (c === "whatsapp") return "💬 WhatsApp"
                              if (c === "push") return "🔔 Push"
                              return c
                            })
                            .join(", ")}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Sent: {trigger.sentLast7Days} times (last 7 days)</span>
                          <span>•</span>
                          <span>Success rate: {trigger.successRate}%</span>
                        </div>
                        {!trigger.active && (
                          <Badge variant="secondary" className="text-xs">
                            Disabled for testing
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button variant="outline" size="sm" onClick={() => handleEditTrigger(trigger)}>
                        Edit
                      </Button>
                      <Switch checked={trigger.active} onCheckedChange={() => handleToggleTrigger(trigger.id)} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View History</DropdownMenuItem>
                          <DropdownMenuItem>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Delivery Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Notification Delivery Logs</h2>
            <div className="flex gap-2">
              <Select defaultValue="all-channels">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-channels">All Channels</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all-status">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-status">All Status</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Sent</CardDescription>
                <CardTitle className="text-3xl">532</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Delivered</CardDescription>
                <CardTitle className="text-3xl text-green-600">528</CardTitle>
                <CardDescription className="text-green-600">99.2%</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Failed</CardDescription>
                <CardTitle className="text-3xl text-red-600">3</CardTitle>
                <CardDescription className="text-red-600">0.6%</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Pending</CardDescription>
                <CardTitle className="text-3xl text-orange-600">1</CardTitle>
                <CardDescription className="text-orange-600">0.2%</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Logs Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">Time</th>
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">To</th>
                    <th className="text-left p-4 font-medium">Channel</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div className="text-sm">{log.createdAt}</div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{log.type}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <div className="font-medium">{log.recipient.name}</div>
                          {log.recipient.email && <div className="text-muted-foreground">{log.recipient.email}</div>}
                          {log.recipient.phone && <div className="text-muted-foreground">{displayPhone(log.recipient.phone)}</div>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {log.channels.map((channel, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <span>
                                {channel.type === "email" && "📧"}
                                {channel.type === "sms" && "📱"}
                                {channel.type === "whatsapp" && "💬"}
                                {channel.type === "push" && "🔔"}
                              </span>
                              <span className="text-muted-foreground">{channel.type}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {log.channels.map((channel, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              {channel.status === "delivered" && (
                                <Badge variant="default" className="text-xs bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Delivered
                                </Badge>
                              )}
                              {channel.status === "pending" && (
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                              {channel.status === "failed" && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Failed
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewLog(log)}>
                            View
                          </Button>
                          {log.status === "failed" && (
                            <Button variant="outline" size="sm" onClick={() => handleRetryLog(log.id)}>
                              Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="text-center text-sm text-muted-foreground">Showing 1-25 of 532 notifications</div>
        </TabsContent>
      </Tabs>

      <TestNotificationModal open={testModalOpen} onOpenChange={setTestModalOpen} channelId={testChannelId} />
      <EditTemplateModal
        open={editTemplateModalOpen}
        onOpenChange={setEditTemplateModalOpen}
        template={selectedTemplate}
      />
      <ConfigureChannelModal open={configureModalOpen} onOpenChange={setConfigureModalOpen} channel={selectedChannel} />
      <AddChannelModal open={addChannelModalOpen} onOpenChange={setAddChannelModalOpen} />
      <AddTriggerModal open={addTriggerModalOpen} onOpenChange={setAddTriggerModalOpen} />
      <EditTriggerModal open={editTriggerModalOpen} onOpenChange={setEditTriggerModalOpen} trigger={selectedTrigger} />
      <NotificationsSettingsModal open={settingsModalOpen} onOpenChange={setSettingsModalOpen} />
      <ViewDeliveryLogModal open={viewLogModalOpen} onOpenChange={setViewLogModalOpen} log={selectedLog} />
    </div>
  )
}
