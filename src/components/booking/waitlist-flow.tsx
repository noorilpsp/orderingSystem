"use client"

import { useState } from "react"
import { Clock, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneCountrySelect } from "@/components/shared/phone-country-select"
import { composeGuestPhone } from "@/lib/public-menu/guest-phone"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import {
  type BookingState,
  formatDateShort,
  servicePeriods,
} from "@/lib/booking-data"

interface WaitlistFlowProps {
  state: BookingState
  onBack: () => void
}

export function WaitlistFlow({ state, onBack }: WaitlistFlowProps) {
  const displayPhone = useDisplayPhone()
  const [joined, setJoined] = useState(false)
  const [firstName, setFirstName] = useState(state.firstName)
  const [lastName, setLastName] = useState(state.lastName)
  const [phone, setPhone] = useState(state.phone)
  const [countryCode, setCountryCode] = useState(state.countryCode)
  const [preferredFrom, setPreferredFrom] = useState("19:00")
  const [preferredTo, setPreferredTo] = useState("20:30")

  const period = servicePeriods.find((p) => p.id === state.servicePeriod)
  const summaryLabel = state.date
    ? `${formatDateShort(state.date)} \u00B7 ${period?.name ?? ""} \u00B7 ${state.partySize} guest${state.partySize !== 1 ? "s" : ""}`
    : ""
  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && phone.trim().length > 0

  if (joined) {
    return (
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
          <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {"You're on the waitlist, " + (firstName || "Guest") + "!"}
          </h2>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {"Position: #3 in line"}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {"Estimated wait: ~25 minutes"}
            </p>
          </div>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {"We'll send you a text at " + displayPhone(composeGuestPhone(countryCode, phone)) + " as soon as a table is available."}
        </p>

        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-500/20 dark:bg-amber-500/10">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {"Tip: Head to our bar while you wait \u2014 your tab transfers to your table automatically."}
          </p>
        </div>

        <Button
          variant="ghost"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          onClick={onBack}
        >
          Leave Waitlist
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Join the Waitlist</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{summaryLabel}</p>
      </div>

      {/* Preferred time range */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Preferred time range</Label>
        <div className="flex items-center gap-3">
          <select
            value={preferredFrom}
            onChange={(e) => setPreferredFrom(e.target.value)}
            aria-label="Preferred start time"
            className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-emerald-500"
          >
            {["17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="text-sm text-zinc-400">to</span>
          <select
            value={preferredTo}
            onChange={(e) => setPreferredTo(e.target.value)}
            aria-label="Preferred end time"
            className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-emerald-500"
          >
            {["18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Guest info */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="wl-fn" className="text-sm text-zinc-700 dark:text-zinc-300">
              First Name <span className="text-rose-500" aria-hidden="true">*</span>
            </Label>
            <Input
              id="wl-fn"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              aria-required="true"
              placeholder="Sarah"
              className="h-10 rounded-lg border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="wl-ln" className="text-sm text-zinc-700 dark:text-zinc-300">
              Last Name <span className="text-rose-500" aria-hidden="true">*</span>
            </Label>
            <Input
              id="wl-ln"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              aria-required="true"
              placeholder="Chen"
              className="h-10 rounded-lg border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wl-phone" className="text-sm text-zinc-700 dark:text-zinc-300">
            Phone <span className="text-rose-500" aria-hidden="true">*</span>
          </Label>
          <div className="flex gap-2" dir="ltr">
            <PhoneCountrySelect
              value={countryCode}
              onChange={setCountryCode}
              className="h-10 rounded-lg border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <Input
              id="wl-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              aria-required="true"
              placeholder="0412 345 678"
              className="h-10 flex-1 rounded-lg border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {"We'll text you as soon as a table opens in your preferred window. Average wait: ~25 minutes for Friday dinner."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          className="h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-40 disabled:shadow-none dark:bg-emerald-500 dark:shadow-emerald-500/25 dark:hover:bg-emerald-600"
          onClick={() => setJoined(true)}
          disabled={!canSubmit}
        >
          {"Join Waitlist \u2192"}
        </Button>
        <Button
          variant="ghost"
          className="h-10 w-full text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          onClick={onBack}
        >
          Go Back
        </Button>
      </div>
    </div>
  )
}
