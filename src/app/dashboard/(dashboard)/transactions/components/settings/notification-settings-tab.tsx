"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CheckCircle } from "lucide-react"
import { PhoneNumberField } from "@/components/shared/phone-number-field"

interface NotificationSettingsTabProps {
  onSettingsChange: () => void
}

export function NotificationSettingsTab({ onSettingsChange }: NotificationSettingsTabProps) {
  const [smsPhone, setSmsPhone] = useState("+356 9945 1234")
  return (
    <div className="space-y-6">
      {/* Delivery Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Channels</CardTitle>
          <CardDescription>Configure how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="enableEmail" defaultChecked onCheckedChange={onSettingsChange} />
              <Label htmlFor="enableEmail" className="font-medium">
                Enable email notifications
              </Label>
            </div>
            <div className="ml-6 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email">Send to:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="email"
                    type="email"
                    defaultValue="sarah.johnson@berrytap.com"
                    className="max-w-md"
                    onChange={onSettingsChange}
                  />
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ccEmail">Also CC: (optional)</Label>
                <Input
                  id="ccEmail"
                  type="email"
                  placeholder="manager@berrytap.com"
                  className="max-w-md"
                  onChange={onSettingsChange}
                />
                <p className="text-xs text-muted-foreground">Separate multiple emails with semicolons</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="enableSMS" defaultChecked onCheckedChange={onSettingsChange} />
              <Label htmlFor="enableSMS" className="font-medium">
                Enable SMS notifications (critical alerts only)
              </Label>
            </div>
            <div className="ml-6 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number:</Label>
                <div className="flex items-center gap-2">
                  <PhoneNumberField
                    id="phone"
                    value={smsPhone}
                    onChange={(next) => {
                      setSmsPhone(next)
                      onSettingsChange()
                    }}
                    className="max-w-md"
                    placeholder="Mobile number"
                  />
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </Badge>
                </div>
                <p className="text-xs text-amber-600">SMS charges may apply based on your plan</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="enableInApp" defaultChecked onCheckedChange={onSettingsChange} />
              <Label htmlFor="enableInApp" className="font-medium">
                Show in-app notifications
              </Label>
            </div>
            <div className="ml-6 space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="playSound" defaultChecked onCheckedChange={onSettingsChange} />
                <Label htmlFor="playSound" className="font-normal">
                  Play sound for critical alerts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="desktopNotif" defaultChecked onCheckedChange={onSettingsChange} />
                <Label htmlFor="desktopNotif" className="font-normal">
                  Show desktop notifications (requires permission)
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Events */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="text-center">Email</TableHead>
                <TableHead className="text-center">In-App</TableHead>
                <TableHead className="text-center">SMS</TableHead>
                <TableHead className="text-center">Desktop</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Transaction completed</TableCell>
                <TableCell className="text-center">
                  <Checkbox onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox onCheckedChange={onSettingsChange} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Transaction failed</TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">High-value transaction (&gt;€500)</TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox onCheckedChange={onSettingsChange} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">New dispute/chargeback</TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Refund issued</TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox defaultChecked onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox onCheckedChange={onSettingsChange} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox onCheckedChange={onSettingsChange} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Digest & Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Digest & Summary</CardTitle>
          <CardDescription>Receive periodic summaries of transaction activity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="dailyDigest" defaultChecked onCheckedChange={onSettingsChange} />
              <Label htmlFor="dailyDigest" className="font-medium">
                Enable daily digest
              </Label>
            </div>
            <div className="ml-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dailyTime">Time:</Label>
                <Select defaultValue="9am" onValueChange={onSettingsChange}>
                  <SelectTrigger id="dailyTime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6am">6:00 AM</SelectItem>
                    <SelectItem value="9am">9:00 AM</SelectItem>
                    <SelectItem value="12pm">12:00 PM</SelectItem>
                    <SelectItem value="6pm">6:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailyTz">Timezone:</Label>
                <Select defaultValue="europe-malta" onValueChange={onSettingsChange}>
                  <SelectTrigger id="dailyTz">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="europe-malta">Europe/Malta</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="ml-6 space-y-2">
              <Label className="text-sm">Include in daily digest:</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="digestTotal" defaultChecked onCheckedChange={onSettingsChange} />
                  <Label htmlFor="digestTotal" className="font-normal">
                    Transaction count and total
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="digestFailed" defaultChecked onCheckedChange={onSettingsChange} />
                  <Label htmlFor="digestFailed" className="font-normal">
                    Failed transactions
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="digestRefunds" defaultChecked onCheckedChange={onSettingsChange} />
                  <Label htmlFor="digestRefunds" className="font-normal">
                    Refunds issued
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="digestDisputes" defaultChecked onCheckedChange={onSettingsChange} />
                  <Label htmlFor="digestDisputes" className="font-normal">
                    Active disputes
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="weeklyDigest" defaultChecked onCheckedChange={onSettingsChange} />
              <Label htmlFor="weeklyDigest" className="font-medium">
                Enable weekly digest
              </Label>
            </div>
            <div className="ml-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weeklyDay">Day:</Label>
                <Select defaultValue="monday" onValueChange={onSettingsChange}>
                  <SelectTrigger id="weeklyDay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="friday">Friday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeklyTime">Time:</Label>
                <Select defaultValue="9am" onValueChange={onSettingsChange}>
                  <SelectTrigger id="weeklyTime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9am">9:00 AM</SelectItem>
                    <SelectItem value="12pm">12:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>Pause non-critical notifications during specific times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="quietHours" defaultChecked onCheckedChange={onSettingsChange} />
            <Label htmlFor="quietHours" className="font-medium">
              Enable quiet hours
            </Label>
          </div>

          <div className="ml-6 space-y-4">
            <div className="flex items-center gap-4">
              <Label>Don't send notifications between:</Label>
              <Select defaultValue="10pm" onValueChange={onSettingsChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10pm">10:00 PM</SelectItem>
                  <SelectItem value="11pm">11:00 PM</SelectItem>
                </SelectContent>
              </Select>
              <span>and</span>
              <Select defaultValue="8am" onValueChange={onSettingsChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7am">7:00 AM</SelectItem>
                  <SelectItem value="8am">8:00 AM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Exceptions (always notify):</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="exceptCritical" defaultChecked onCheckedChange={onSettingsChange} />
                  <Label htmlFor="exceptCritical" className="font-normal">
                    Critical alerts (disputes, fraud)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="exceptProcessor" defaultChecked onCheckedChange={onSettingsChange} />
                  <Label htmlFor="exceptProcessor" className="font-normal">
                    Payment processor failures
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Quiet days:</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="quietSat" defaultChecked onCheckedChange={onSettingsChange} />
                  <Label htmlFor="quietSat" className="font-normal">
                    Saturday
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="quietSun" defaultChecked onCheckedChange={onSettingsChange} />
                  <Label htmlFor="quietSun" className="font-normal">
                    Sunday
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
