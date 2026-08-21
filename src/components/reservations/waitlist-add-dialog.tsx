"use client"

import { useState } from "react"
import { Lightbulb, MessageSquare, Wine } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { getAiQuoteEstimate } from "@/lib/waitlist-data"
import { useLocation } from "@/lib/contexts/LocationContext"
import { PhoneNumberField } from "@/components/shared/phone-number-field"

interface AddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: { name: string; phone: string; partySize: number; quote: number }) => void
}

export function WaitlistAddDialog({ open, onOpenChange, onAdd }: AddDialogProps) {
  const { getCurrentLocation } = useLocation()
  const storeCountry = getCurrentLocation()?.country
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [partySize, setPartySize] = useState(2)
  const [notes, setNotes] = useState("")
  const [sendSms, setSendSms] = useState(true)
  const [atBar, setAtBar] = useState(false)
  const [steppedOut, setSteppedOut] = useState(false)

  const aiEstimate = getAiQuoteEstimate(partySize)
  const [customQuote, setCustomQuote] = useState<number | null>(null)
  const displayQuote = customQuote ?? aiEstimate.minutes

  function handleSubmit() {
    if (!name.trim()) return
    onAdd({ name: name.trim(), phone, partySize, quote: displayQuote })
    // Reset
    setName("")
    setPhone("")
    setPartySize(2)
    setNotes("")
    setCustomQuote(null)
    onOpenChange(false)
  }

  const sizes = [1, 2, 3, 4, 5, 6]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Add to Waitlist</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Add a new party to the queue
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <Label htmlFor="wl-name" className="text-xs text-zinc-400">Guest Name *</Label>
            <Input
              id="wl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Johnson Family"
              className="mt-1 border-zinc-800 bg-zinc-800/60 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="wl-phone" className="text-xs text-zinc-400">Phone Number *</Label>
            <PhoneNumberField
              id="wl-phone"
              value={phone}
              onChange={setPhone}
              defaultCountry={storeCountry}
              placeholder="Mobile number"
              className="mt-1"
              triggerClassName="border-zinc-800 bg-zinc-800/60 text-zinc-100"
              inputClassName="border-zinc-800 bg-zinc-800/60 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Party Size */}
          <div>
            <Label className="text-xs text-zinc-400">Party Size *</Label>
            <div className="mt-1.5 flex gap-1.5">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => { setPartySize(s); setCustomQuote(null) }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-all ${
                    partySize === s
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                      : "border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {s === 6 ? "6+" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="wl-notes" className="text-xs text-zinc-400">Special Requests</Label>
            <Input
              id="wl-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, seating preferences, etc."
              className="mt-1 border-zinc-800 bg-zinc-800/60 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* AI Estimate */}
          <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/30 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold uppercase tracking-wider text-zinc-400">AI Estimate</span>
            </div>
            <div className="mt-2 text-sm text-zinc-200">
              Recommended Quote: <span className="font-bold text-emerald-400">{aiEstimate.minutes} minutes</span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              Based on: {aiEstimate.explanation}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Label htmlFor="wl-quote" className="text-xs text-zinc-400 whitespace-nowrap">Quote to Guest:</Label>
              <Input
                id="wl-quote"
                type="number"
                value={displayQuote}
                onChange={(e) => setCustomQuote(parseInt(e.target.value) || aiEstimate.minutes)}
                className="h-8 w-20 border-zinc-700 bg-zinc-800/60 text-center text-sm text-zinc-100"
              />
              <span className="text-xs text-zinc-500">minutes</span>
            </div>
            {customQuote !== null && customQuote !== aiEstimate.minutes && (
              <div className="mt-1 text-[10px] text-amber-500">Host override applied</div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <Checkbox checked={sendSms} onCheckedChange={(v) => setSendSms(v as boolean)} />
              <MessageSquare className="h-3 w-3" />
              Send SMS confirmation
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <Checkbox checked={atBar} onCheckedChange={(v) => setAtBar(v as boolean)} />
              <Wine className="h-3 w-3" />
              Guest will wait at bar
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <Checkbox checked={steppedOut} onCheckedChange={(v) => setSteppedOut(v as boolean)} />
              Guest stepped out (will return)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Add to Waitlist
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
