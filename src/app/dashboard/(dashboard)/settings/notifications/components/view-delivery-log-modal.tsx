"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, Clock } from "lucide-react"
import type { DeliveryLog } from "../types"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"

interface ViewDeliveryLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: DeliveryLog | null
}

export function ViewDeliveryLogModal({ open, onOpenChange, log }: ViewDeliveryLogModalProps) {
  const displayPhone = useDisplayPhone()
  if (!log) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notification Details</DialogTitle>
          <DialogDescription>Detailed information about this notification delivery</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="font-semibold">Basic Information</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notification ID:</span>
                <span className="font-mono">{log.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="outline">{log.type}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{log.createdAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge
                  variant={
                    log.status === "delivered" ? "default" : log.status === "failed" ? "destructive" : "secondary"
                  }
                >
                  {log.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-3">
            <h3 className="font-semibold">Recipient</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span>{log.recipient.name}</span>
              </div>
              {log.recipient.email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{log.recipient.email}</span>
                </div>
              )}
              {log.recipient.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span>{displayPhone(log.recipient.phone)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-3">
            <h3 className="font-semibold">Delivery Channels</h3>
            <div className="space-y-3">
              {log.channels.map((channel, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {channel.type === "email" && "📧"}
                        {channel.type === "sms" && "📱"}
                        {channel.type === "whatsapp" && "💬"}
                        {channel.type === "push" && "🔔"}
                      </span>
                      <span className="font-medium capitalize">{channel.type}</span>
                    </div>
                    {channel.status === "delivered" && (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Delivered
                      </Badge>
                    )}
                    {channel.status === "pending" && (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                    {channel.status === "failed" && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                  {channel.deliveredAt && (
                    <div className="text-sm text-muted-foreground">Delivered at: {channel.deliveredAt}</div>
                  )}
                  {channel.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">Error: {channel.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content Preview */}
          {log.channels.some((c) => c.type === "email") && (
            <div className="space-y-3">
              <h3 className="font-semibold">Content Preview</h3>
              <div className="bg-muted p-4 rounded-lg text-sm">
                <p className="font-medium mb-2">Subject: {log.type}</p>
                <p className="text-muted-foreground">
                  This is a preview of the notification content that was sent to the recipient...
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
