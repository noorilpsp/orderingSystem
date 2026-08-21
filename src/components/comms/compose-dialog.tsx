"use client"

import { useState } from "react"
import {
  CheckCircle2,
  Search,
  Send,
  Users,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import { templates, allVariables } from "@/lib/comms-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Sample guest suggestions
const guestSuggestions = [
  { name: "Sarah Chen", phone: "+1 (555) 123-4567" },
  { name: "Kim Family", phone: "+1 (555) 234-5678" },
  { name: "Rivera", phone: "+1 (555) 345-6789" },
  { name: "Anderson", phone: "+1 (555) 456-7890" },
  { name: "Patel", phone: "+1 (555) 789-0123" },
  { name: "Baker", phone: "+1 (555) 567-8901" },
]

const quickGroups = [
  { label: "Tonight's Guests", icon: Users },
  { label: "VIPs", icon: Users },
  { label: "Waitlist", icon: Users },
]

export function ComposeDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const displayPhone = useDisplayPhone()
  const [guestSearch, setGuestSearch] = useState("")
  const [selectedGuest, setSelectedGuest] = useState<
    (typeof guestSuggestions)[0] | null
  >(null)
  const [channel, setChannel] = useState<"sms" | "email">("sms")
  const [templateId, setTemplateId] = useState<string>("none")
  const [body, setBody] = useState("")
  const [schedule, setSchedule] = useState<"now" | "later">("now")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const charCount = body.length
  const maxChars = channel === "sms" ? 160 : 5000
  const charWarning = channel === "sms" && charCount > 140

  // Filter guests
  const filtered = guestSearch.length > 0
    ? guestSuggestions.filter(
        (g) =>
          g.name.toLowerCase().includes(guestSearch.toLowerCase()) ||
          g.phone.includes(guestSearch)
      )
    : []

  // Apply template
  function handleTemplateChange(value: string) {
    setTemplateId(value)
    if (value !== "none") {
      const t = templates.find((t) => t.id === value)
      if (t) setBody(t.body)
    }
  }

  // Preview
  const preview = body
    .replace(/\{guest_name\}/g, selectedGuest?.name ?? "Guest")
    .replace(/\{restaurant\}/g, "Chez Laurent")
    .replace(/\{date\}/g, "Friday, Jan 17")
    .replace(/\{time\}/g, "7:30 PM")
    .replace(/\{party_size\}/g, "4")
    .replace(/\{table\}/g, "T12")
    .replace(/\{server\}/g, "Alex")
    .replace(/\{wait_time\}/g, "15 min")
    .replace(/\{booking_link\}/g, "book.chezlaurent.com/xyz")
    .replace(/\{cancel_link\}/g, "cancel.chezlaurent.com/xyz")

  function handleSend() {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setSent(true)
      setTimeout(() => {
        setSent(false)
        onClose()
        // Reset
        setBody("")
        setSelectedGuest(null)
        setGuestSearch("")
        setTemplateId("none")
      }, 1200)
    }, 600)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-compose-dialog
        className="compose-dialog max-h-[90vh] max-w-lg overflow-y-auto border-zinc-700/60 bg-zinc-900/98 backdrop-blur-md sm:max-w-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-zinc-50">
            New Message
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {/* To field */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">To</Label>
            {selectedGuest ? (
              <div className="flex items-center gap-2 rounded-md border border-zinc-600/60 bg-zinc-800/80 px-2 py-1.5">
                <span className="text-xs font-medium text-zinc-100">
                  {selectedGuest.name}
                </span>
                <span className="text-[10px] text-zinc-400">
                  ({displayPhone(selectedGuest.phone)})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedGuest(null)}
                  className="ml-auto text-zinc-400 hover:text-zinc-100"
                  aria-label="Remove selected guest"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  className="h-8 border-zinc-600/60 bg-zinc-800/80 pl-7 text-xs text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Search guests..."
                />
                {filtered.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-zinc-600/60 bg-zinc-800/95 p-1 shadow-lg backdrop-blur-sm">
                    {filtered.map((g) => (
                      <button
                        key={g.phone}
                        type="button"
                        onClick={() => {
                          setSelectedGuest(g)
                          setGuestSearch("")
                        }}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs text-zinc-100 hover:bg-zinc-700"
                      >
                        <span className="font-medium">{g.name}</span>
                        <span className="text-[10px] text-zinc-400">{displayPhone(g.phone)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Quick groups */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-zinc-400">Or:</span>
              {quickGroups.map((qg) => (
                <Button
                  key={qg.label}
                  variant="outline"
                  size="sm"
                  className="h-5 gap-1 px-1.5 text-[9px] border-zinc-600 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <qg.icon className="h-2 w-2" />
                  {qg.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Channel */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">Channel</Label>
            <RadioGroup
              value={channel}
              onValueChange={(v) => setChannel(v as "sms" | "email")}
              className="flex items-center gap-4"
            >
              <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                <RadioGroupItem value="sms" />
                SMS
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                <RadioGroupItem value="email" />
                Email
              </label>
            </RadioGroup>
          </div>

          {/* Template */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">Template</Label>
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger className="compose-select-trigger h-8 border-zinc-600/60 bg-zinc-800/80 text-xs text-zinc-100">
                <SelectValue placeholder="None (custom)" />
              </SelectTrigger>
              <SelectContent className="compose-select-content border-zinc-600 bg-zinc-800">
                <SelectItem value="none">None (custom)</SelectItem>
                {templates
                  .filter((t) => t.channel === channel)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">Message</Label>
            <div className="relative">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="resize-none border-zinc-600/60 bg-zinc-800/80 pb-6 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500"
                placeholder="Type your message..."
              />
              <span
                className={cn(
                  "absolute bottom-2 right-3 text-[10px]",
                  charWarning ? "text-amber-400" : "text-zinc-500"
                )}
              >
                {charCount}/{maxChars} chars
              </span>
            </div>
            {/* Quick variables */}
            <div className="flex flex-wrap gap-1">
              {allVariables.slice(0, 4).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBody((p) => p + `{${v}}`)}
                  className="rounded border border-zinc-600 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-cyan-400 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">Schedule</Label>
            <RadioGroup
              value={schedule}
              onValueChange={(v) => setSchedule(v as "now" | "later")}
              className="flex items-center gap-4"
            >
              <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                <RadioGroupItem value="now" />
                Send now
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                <RadioGroupItem value="later" />
                Schedule
              </label>
            </RadioGroup>
          </div>

          {/* Preview */}
          {body.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Preview
              </span>
              <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3">
                <div className="mx-auto max-w-[280px]">
                  <div className="rounded-xl bg-emerald-600/20 px-3 py-2 text-xs leading-relaxed text-zinc-100">
                    {preview}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-zinc-700/50 pt-3">
            <Button
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-medium transition-all text-white",
                sent
                  ? "bg-emerald-600"
                  : "bg-emerald-600 hover:bg-emerald-500",
                sending && "scale-95"
              )}
              onClick={handleSend}
              disabled={!body || sending || sent}
            >
              {sent ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sent!
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {sending ? "Sending..." : "Send Message"}
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
