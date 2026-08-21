"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { mockIntegrations } from "../data"
import { ExternalLink, Lock, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PhoneNumberField } from "@/components/shared/phone-number-field"

interface ConnectIntegrationModalProps {
  integrationKey: string
  open: boolean
  onClose: () => void
}

export function ConnectIntegrationModal({ integrationKey, open, onClose }: ConnectIntegrationModalProps) {
  const integration = mockIntegrations.find((i) => i.key === integrationKey)
  const { toast } = useToast()
  const [connecting, setConnecting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showAuthToken, setShowAuthToken] = useState(false)
  const [agreed, setAgreed] = useState(false)

  // Form state for API key integrations
  const [accountSid, setAccountSid] = useState("")
  const [authToken, setAuthToken] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")

  if (!integration) return null

  const isOAuthIntegration = ["stripe", "paypal", "uber_eats", "quickbooks", "xero"].includes(integration.key)

  const handleOAuthConnect = () => {
    if (!agreed) {
      toast({
        title: "Please agree to continue",
        variant: "destructive",
      })
      return
    }

    setConnecting(true)
    toast({
      title: "Redirecting to " + integration.name,
      description: "Please authorize BerryTap in the popup window",
    })

    // Simulate OAuth flow
    setTimeout(() => {
      setConnecting(false)
      toast({
        title: "Connected successfully!",
        description: `${integration.name} has been connected to your account.`,
      })
      onClose()
    }, 2000)
  }

  const handleApiKeyConnect = () => {
    if (!accountSid || !authToken || !phoneNumber) {
      toast({
        title: "Please fill all fields",
        variant: "destructive",
      })
      return
    }

    setConnecting(true)
    toast({
      title: "Testing connection...",
      description: "Verifying your credentials",
    })

    // Simulate API key validation
    setTimeout(() => {
      setConnecting(false)
      toast({
        title: "Connected successfully!",
        description: `${integration.name} has been connected.`,
      })
      onClose()
    }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{integration.logo}</span>
            Connect {integration.name}
          </DialogTitle>
          <DialogDescription>{integration.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isOAuthIntegration ? (
            // OAuth Flow
            <>
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">What Happens Next</h4>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <div>
                      <p className="text-sm font-medium">You'll be redirected to {integration.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Log in to your {integration.name} account (or create one)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                    <div>
                      <p className="text-sm font-medium">Authorize BerryTap</p>
                      <p className="text-xs text-muted-foreground">Grant permission to access your account</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                    <div>
                      <p className="text-sm font-medium">Return to BerryTap</p>
                      <p className="text-xs text-muted-foreground">Your account will be connected automatically</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Security
                </h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>🔒 Secure OAuth 2.0 connection</li>
                  <li>🔒 No passwords stored</li>
                  <li>🔒 Revoke access anytime from {integration.name}</li>
                </ul>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox id="terms" checked={agreed} onCheckedChange={(checked) => setAgreed(checked as boolean)} />
                <Label htmlFor="terms" className="text-xs leading-tight cursor-pointer">
                  I have permission to connect this {integration.name} account and agree to share data with BerryTap
                </Label>
              </div>
            </>
          ) : (
            // API Key Flow (Twilio example)
            <>
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Step 1: Get Your Credentials</h4>
                  <ol className="text-xs space-y-1 text-muted-foreground list-decimal list-inside">
                    <li>Log in to your {integration.name} Console</li>
                    <li>Find your Account SID and Auth Token</li>
                    <li>Get your {integration.name} phone number</li>
                  </ol>
                  <Button
                    size="sm"
                    variant="link"
                    className="mt-2 h-auto p-0"
                    onClick={() => window.open(integration.documentation, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open {integration.name} Console
                  </Button>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Step 2: Enter Credentials</h4>

                  <div className="space-y-2">
                    <Label htmlFor="accountSid">Account SID *</Label>
                    <div className="relative">
                      <Input
                        id="accountSid"
                        placeholder="AC••••••••••••••••••••••••••••••"
                        value={accountSid}
                        onChange={(e) => setAccountSid(e.target.value)}
                        type={showApiKey ? "text" : "password"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Found in {integration.name} Console → Account Info</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="authToken">Auth Token *</Label>
                    <div className="relative">
                      <Input
                        id="authToken"
                        placeholder="••••••••••••••••••••••••••••••••"
                        value={authToken}
                        onChange={(e) => setAuthToken(e.target.value)}
                        type={showAuthToken ? "text" : "password"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowAuthToken(!showAuthToken)}
                      >
                        {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Found in {integration.name} Console → Account Info</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <PhoneNumberField
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={setPhoneNumber}
                      placeholder="Mobile number"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your {integration.name} phone number
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4" />
                  Security
                </h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>🔒 Credentials are encrypted at rest</li>
                  <li>🔒 Only used for sending SMS via {integration.name}</li>
                  <li>🔒 Never shared with third parties</li>
                </ul>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="permission"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked as boolean)}
                />
                <Label htmlFor="permission" className="text-xs leading-tight cursor-pointer">
                  I have permission to use this {integration.name} account
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {isOAuthIntegration ? (
            <Button onClick={handleOAuthConnect} disabled={connecting || !agreed}>
              {connecting ? "Connecting..." : `Continue to ${integration.name}`}
              {!connecting && <ExternalLink className="h-4 w-4 ml-2" />}
            </Button>
          ) : (
            <Button onClick={handleApiKeyConnect} disabled={connecting || !agreed}>
              {connecting ? "Connecting..." : "Save & Connect"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
