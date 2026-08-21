"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { NotificationChannel } from "../types"
import { PhoneNumberField } from "@/components/shared/phone-number-field"

interface ConfigureChannelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel?: NotificationChannel | null
}

export function ConfigureChannelModal({ open, onOpenChange, channel }: ConfigureChannelModalProps) {
  const [saving, setSaving] = useState(false)
  const [provider, setProvider] = useState(channel?.provider || "")
  const [apiKey, setApiKey] = useState("")
  const [phone, setPhone] = useState("")
  const { toast } = useToast()

  const handleSave = async () => {
    setSaving(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setSaving(false)
    toast({
      title: "Channel configured",
      description: `Successfully configured ${channel?.name} channel`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure {channel?.name}</DialogTitle>
          <DialogDescription>Set up your {channel?.name} notification channel</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {channel?.name === "Email" && (
                  <>
                    <SelectItem value="SendGrid">SendGrid</SelectItem>
                    <SelectItem value="AWS SES">AWS SES</SelectItem>
                    <SelectItem value="Mailgun">Mailgun</SelectItem>
                  </>
                )}
                {channel?.name === "SMS" && (
                  <>
                    <SelectItem value="Twilio">Twilio</SelectItem>
                    <SelectItem value="MessageBird">MessageBird</SelectItem>
                  </>
                )}
                {channel?.name === "WhatsApp" && (
                  <>
                    <SelectItem value="Twilio">Twilio</SelectItem>
                    <SelectItem value="360dialog">360dialog</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
            />
          </div>

          {channel?.name === "SMS" || channel?.name === "WhatsApp" ? (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <PhoneNumberField
                id="phone"
                value={phone}
                onChange={setPhone}
                placeholder="Mobile number"
              />
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !provider || !apiKey}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
