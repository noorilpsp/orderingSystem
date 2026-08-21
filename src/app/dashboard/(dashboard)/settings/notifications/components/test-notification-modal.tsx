"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PhoneNumberField } from "@/components/shared/phone-number-field"

interface TestNotificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId?: string
}

export function TestNotificationModal({ open, onOpenChange, channelId }: TestNotificationModalProps) {
  const [sending, setSending] = useState(false)
  const [channel, setChannel] = useState(channelId || "email")
  const [recipient, setRecipient] = useState("")
  const [template, setTemplate] = useState("order-confirmed")
  const { toast } = useToast()

  const handleSend = async () => {
    setSending(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setSending(false)
    toast({
      title: "Test notification sent",
      description: `Successfully sent test notification via ${channel} to ${recipient}`,
    })
    onOpenChange(false)
    setRecipient("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Test Notification</DialogTitle>
          <DialogDescription>Send a test notification to verify your channel configuration</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="channel">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">📧 Email</SelectItem>
                <SelectItem value="sms">📱 SMS</SelectItem>
                <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                <SelectItem value="push">🔔 Push</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order-confirmed">Order Confirmed</SelectItem>
                <SelectItem value="order-ready">Order Ready</SelectItem>
                <SelectItem value="reservation-confirmed">Reservation Confirmed</SelectItem>
                <SelectItem value="receipt">Receipt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">
              {channel === "email"
                ? "Email Address"
                : channel === "sms" || channel === "whatsapp"
                  ? "Phone Number"
                  : "User ID"}
            </Label>
            {channel === "sms" || channel === "whatsapp" ? (
              <PhoneNumberField
                id="recipient"
                value={recipient}
                onChange={setRecipient}
                placeholder="Mobile number"
              />
            ) : (
              <Input
                id="recipient"
                type={channel === "email" ? "email" : "text"}
                placeholder={channel === "email" ? "test@example.com" : "user123"}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !recipient}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Test
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
