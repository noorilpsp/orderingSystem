"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { PhoneNumberField } from "@/components/shared/phone-number-field"

interface BillingSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BillingSettingsModal({ open, onOpenChange }: BillingSettingsModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [contactPhone, setContactPhone] = useState("+356 9123 4567")

  const handleSave = () => {
    setIsLoading(true)
    setTimeout(() => {
      toast({
        title: "Settings saved",
        description: "Your billing settings have been updated.",
      })
      setIsLoading(false)
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Billing Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Billing Contact</h3>
            <div>
              <Label htmlFor="contactName">Name</Label>
              <Input id="contactName" defaultValue="Sarah Johnson" />
            </div>
            <div>
              <Label htmlFor="contactEmail">Email</Label>
              <Input id="contactEmail" type="email" defaultValue="sarah@berrytap.com" />
            </div>
            <div>
              <Label htmlFor="contactPhone">Phone</Label>
              <PhoneNumberField
                id="contactPhone"
                value={contactPhone}
                onChange={setContactPhone}
                placeholder="Mobile number"
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Billing Address</h3>
            <div>
              <Label htmlFor="company">Company Name</Label>
              <Input id="company" defaultValue="BerryTap Restaurant Ltd" />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" defaultValue="123 Republic Street" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" defaultValue="Valletta" />
              </div>
              <div>
                <Label htmlFor="postal">Postal Code</Label>
                <Input id="postal" defaultValue="VLT 1234" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Notifications</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="emailInvoices" defaultChecked />
                <Label htmlFor="emailInvoices" className="font-normal">
                  Email invoice immediately after payment
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="upcomingPayment" defaultChecked />
                <Label htmlFor="upcomingPayment" className="font-normal">
                  Upcoming payment reminder (3 days before)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="failedPayment" defaultChecked />
                <Label htmlFor="failedPayment" className="font-normal">
                  Failed payment alert
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
