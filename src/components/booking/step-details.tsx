"use client"

import { useCallback, useMemo, useState } from "react"
import { AlertCircle, Info, Lock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PhoneCountrySelect } from "@/components/shared/phone-country-select"
import {
  type BookingState,
  dietaryOptions,
  formatDateShort,
  formatTime12h,
  occasions,
  seatingOptions,
  servicePeriods,
} from "@/lib/booking-data"

interface StepDetailsProps {
  state: BookingState
  onChange: (patch: Partial<BookingState>) => void
  onSubmit: () => void
  onBack: () => void
  isSubmitting: boolean
}

export function StepDetails({ state, onChange, onSubmit, onBack, isSubmitting }: StepDetailsProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const period = servicePeriods.find((p) => p.id === state.servicePeriod)
  const seating = seatingOptions.find((s) => s.id === state.seatingPreference)

  const summaryParts = [
    state.date ? formatDateShort(state.date) : "",
    state.timeSlot ? formatTime12h(state.timeSlot) : "",
    `${state.partySize} guest${state.partySize !== 1 ? "s" : ""}`,
    seating && seating.id !== "no_pref" ? seating.label : null,
  ].filter(Boolean)

  // Validation
  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (touched.firstName && state.firstName.trim().length === 0) e.firstName = "First name is required"
    if (touched.lastName && state.lastName.trim().length === 0) e.lastName = "Last name is required"
    if (touched.phone && state.phone.trim().length === 0) e.phone = "Phone number is required"
    if (touched.phone && state.phone.trim().length > 0 && !/^[\d\s\-+()]{7,15}$/.test(state.phone.trim()))
      e.phone = "Enter a valid phone number"
    if (touched.email && state.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim()))
      e.email = "Enter a valid email address"
    return e
  }, [state.firstName, state.lastName, state.phone, state.email, touched])

  const canSubmit =
    state.firstName.trim().length > 0 &&
    state.lastName.trim().length > 0 &&
    state.phone.trim().length > 0 &&
    state.agreedToPolicy &&
    Object.keys(errors).length === 0

  const handleBlur = useCallback((field: string) => {
    setTouched((t) => ({ ...t, [field]: true }))
  }, [])

  const toggleDietary = useCallback(
    (id: string) => {
      const next = state.dietary.includes(id) ? state.dietary.filter((d) => d !== id) : [...state.dietary, id]
      onChange({ dietary: next })
    },
    [state.dietary, onChange]
  )

  const needsDeposit = state.partySize >= 6 || (state.timeSlot && parseInt(state.timeSlot.split(":")[0]) >= 19 && parseInt(state.timeSlot.split(":")[0]) <= 21)

  return (
    <div className="flex flex-col gap-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{summaryParts.join(" \u00B7 ")}</span>
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Change
        </button>
      </div>

      {/* Your Information */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Your Information
        </legend>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="bk-fn" className="text-sm text-zinc-700 dark:text-zinc-300">
              First Name <span className="text-rose-500" aria-hidden="true">*</span>
            </Label>
            <Input
              id="bk-fn"
              value={state.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
              onBlur={() => handleBlur("firstName")}
              required
              aria-required="true"
              aria-invalid={!!errors.firstName}
              placeholder="Sarah"
              className={cn(
                "h-11 rounded-lg border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                errors.firstName && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
              )}
            />
            {errors.firstName && (
              <p className="flex items-center gap-1 text-xs text-rose-500 booking-error-enter" role="alert">
                <AlertCircle className="h-3 w-3" /> {errors.firstName}
              </p>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="bk-ln" className="text-sm text-zinc-700 dark:text-zinc-300">
              Last Name <span className="text-rose-500" aria-hidden="true">*</span>
            </Label>
            <Input
              id="bk-ln"
              value={state.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              onBlur={() => handleBlur("lastName")}
              required
              aria-required="true"
              aria-invalid={!!errors.lastName}
              placeholder="Chen"
              className={cn(
                "h-11 rounded-lg border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                errors.lastName && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
              )}
            />
            {errors.lastName && (
              <p className="flex items-center gap-1 text-xs text-rose-500 booking-error-enter" role="alert">
                <AlertCircle className="h-3 w-3" /> {errors.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bk-phone" className="text-sm text-zinc-700 dark:text-zinc-300">
            Phone Number <span className="text-rose-500" aria-hidden="true">*</span>
          </Label>
          <div className="flex gap-2" dir="ltr">
            <PhoneCountrySelect
              value={state.countryCode}
              onChange={(countryCode) => onChange({ countryCode })}
              invalid={!!errors.phone}
              className="h-11 rounded-lg border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <Input
              id="bk-phone"
              type="tel"
              value={state.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              onBlur={() => handleBlur("phone")}
              required
              aria-required="true"
              aria-invalid={!!errors.phone}
              placeholder="0412 345 678"
              className={cn(
                "h-11 flex-1 rounded-lg border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                errors.phone && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
              )}
            />
          </div>
          {errors.phone ? (
            <p className="flex items-center gap-1 text-xs text-rose-500 booking-error-enter" role="alert">
              <AlertCircle className="h-3 w-3" /> {errors.phone}
            </p>
          ) : (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{"We'll send your confirmation via SMS."}</p>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bk-email" className="text-sm text-zinc-700 dark:text-zinc-300">Email</Label>
          <Input
            id="bk-email"
            type="email"
            value={state.email}
            onChange={(e) => onChange({ email: e.target.value })}
            onBlur={() => handleBlur("email")}
            aria-invalid={!!errors.email}
            placeholder="sarah.chen@email.com"
            className={cn(
              "h-11 rounded-lg border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500",
              errors.email && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
            )}
          />
          {errors.email && (
            <p className="flex items-center gap-1 text-xs text-rose-500 booking-error-enter" role="alert">
              <AlertCircle className="h-3 w-3" /> {errors.email}
            </p>
          )}
        </div>
      </fieldset>

      {/* Occasion */}
      <fieldset className="flex flex-col gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <legend className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Occasion <span className="font-normal normal-case">(optional)</span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {occasions.map((o) => {
            const isSelected = state.occasion === o.id
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-pressed={isSelected}
                onClick={() => onChange({ occasion: isSelected ? null : o.id })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-xs font-medium transition-all duration-150",
                  isSelected
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
                )}
              >
                <span className="text-sm" aria-hidden="true">{o.icon}</span>
                <span>{o.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Dietary & Allergies */}
      <fieldset className="flex flex-col gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <legend className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {"Dietary & Allergies"} <span className="font-normal normal-case">(optional)</span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {dietaryOptions.map((d) => {
            const isSelected = state.dietary.includes(d.id)
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleDietary(d.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-xs font-medium transition-all duration-150",
                  isSelected
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-400"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
                )}
              >
                <span className="text-sm" aria-hidden="true">{d.icon}</span>
                <span>{d.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Special Requests */}
      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <Label htmlFor="bk-requests" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Special Requests <span className="font-normal text-zinc-400 dark:text-zinc-500">(optional)</span>
        </Label>
        <div className="relative">
          <Textarea
            id="bk-requests"
            value={state.specialRequests}
            onChange={(e) => {
              if (e.target.value.length <= 200) onChange({ specialRequests: e.target.value })
            }}
            placeholder="High chair needed, window seat preferred..."
            rows={3}
            className="resize-none rounded-lg border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <span className="absolute bottom-2 right-3 text-[11px] text-zinc-400 dark:text-zinc-500">
            {state.specialRequests.length}/200
          </span>
        </div>
      </div>

      {/* Deposit Notice (conditional) */}
      {needsDeposit && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10 booking-warning-enter">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Deposit Required</h4>
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            {"A deposit of \u20AC25.00 per person (\u20AC" + (state.partySize * 25).toFixed(2) + " total) is required for this booking. This will be applied to your final bill. Full refund if cancelled 4+ hours in advance."}
          </p>
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-600 dark:text-amber-400">
            <Lock className="h-3 w-3" />
            <span>Secured by Stripe</span>
          </div>
        </div>
      )}

      {/* Cancellation Policy */}
      <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {"Free cancellation up to 4 hours before your reservation. Late cancellations may be subject to a \u20AC25/person fee."}
        </p>
      </div>

      {/* Agreements */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="bk-policy"
            checked={state.agreedToPolicy}
            onCheckedChange={(c) => onChange({ agreedToPolicy: c === true })}
            aria-required="true"
            className="mt-0.5 border-zinc-300 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 dark:border-zinc-600 dark:data-[state=checked]:border-emerald-500 dark:data-[state=checked]:bg-emerald-500"
          />
          <Label htmlFor="bk-policy" className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            I agree to the cancellation policy <span className="text-rose-500" aria-hidden="true">*</span>
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="bk-marketing"
            checked={state.marketingOptIn}
            onCheckedChange={(c) => onChange({ marketingOptIn: c === true })}
            className="mt-0.5 border-zinc-300 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 dark:border-zinc-600 dark:data-[state=checked]:border-emerald-500 dark:data-[state=checked]:bg-emerald-500"
          />
          <Label htmlFor="bk-marketing" className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Send me special offers and events (optional)
          </Label>
        </div>
      </div>

      {/* Submit CTA */}
      <div className="sticky bottom-0 -mx-6 border-t border-zinc-100 bg-white/90 px-6 pb-2 pt-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none">
        <Button
          className="h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-700 disabled:opacity-40 disabled:shadow-none dark:bg-emerald-500 dark:shadow-emerald-500/25 dark:hover:bg-emerald-600"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Booking...
            </span>
          ) : (
            "Complete Reservation \u2192"
          )}
        </Button>
      </div>

      {/* Trust badge */}
      <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-zinc-400 dark:text-zinc-500">
        <Lock className="h-3 w-3" />
        Your information is secure and only used for your reservation.
      </p>
    </div>
  )
}
