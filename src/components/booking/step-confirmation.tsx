"use client"

import { useState } from "react"
import {
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  type BookingState,
  confirmationData,
  dietaryOptions,
  formatDate,
  formatTime12h,
  occasions,
  restaurant,
  seatingOptions,
} from "@/lib/booking-data"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"

interface StepConfirmationProps {
  state: BookingState
  onBookAnother: () => void
  onModify: () => void
}

function AnimatedCheckmark() {
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15 booking-confirm-pop">
      <svg className="h-10 w-10" viewBox="0 0 52 52" aria-hidden="true">
        <circle
          cx="26"
          cy="26"
          r="25"
          fill="none"
          className="stroke-emerald-600 dark:stroke-emerald-500"
          strokeWidth="2"
          strokeDasharray="166"
          strokeDashoffset="0"
        />
        <path
          fill="none"
          className="stroke-emerald-600 dark:stroke-emerald-500 booking-checkmark-draw"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.1 27.2l7.1 7.2 16.7-16.8"
        />
      </svg>
    </div>
  )
}

export function StepConfirmation({ state, onBookAnother, onModify }: StepConfirmationProps) {
  const displayPhone = useDisplayPhone()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  const seating = seatingOptions.find((s) => s.id === state.seatingPreference)
  const occasion = occasions.find((o) => o.id === state.occasion)
  const selectedAllergies = dietaryOptions.filter((d) => state.dietary.includes(d.id))

  if (cancelled) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <X className="h-7 w-7 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Reservation Cancelled</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Your booking has been cancelled.</p>
        </div>
        <Button
          className="mt-2 h-12 rounded-xl bg-emerald-600 px-8 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 dark:bg-emerald-500 dark:shadow-emerald-500/25 dark:hover:bg-emerald-600"
          onClick={onBookAnother}
        >
          Book Another Table
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      {/* Animated checkmark */}
      <AnimatedCheckmark />

      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        {"You're all set, " + (state.firstName || "Guest") + "!"}
      </h2>

      {/* Booking details card */}
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50 booking-card-slide-up">
        <div className="mb-4 flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{restaurant.name}</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <Calendar className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
            <span>{state.date ? formatDate(state.date) : confirmationData.date}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <Clock className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
            <span>{state.timeSlot ? formatTime12h(state.timeSlot) : formatTime12h(confirmationData.time)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <Users className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
            <span>{state.partySize} guest{state.partySize !== 1 ? "s" : ""}</span>
          </div>
          {seating && seating.id !== "no_pref" && (
            <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs" aria-hidden="true">
                {seating.icon}
              </span>
              <span>{seating.label} seating requested</span>
            </div>
          )}
          {occasion && (
            <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs" aria-hidden="true">
                {occasion.icon}
              </span>
              <span>{occasion.label} celebration</span>
            </div>
          )}
          {selectedAllergies.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs" aria-hidden="true">
                {selectedAllergies[0].icon}
              </span>
              <span>{selectedAllergies.map((a) => a.label).join(", ")} allergy noted</span>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-700">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Confirmation #: <span className="font-mono text-zinc-700 dark:text-zinc-300">{confirmationData.confirmationId}</span>
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <MapPin className="h-3 w-3" />
            <span>{restaurant.address}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Phone className="h-3 w-3" />
            <span>{displayPhone(restaurant.phone)}</span>
          </div>
        </div>
      </div>

      {/* Confirmation sent */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {"Confirmation sent to " + displayPhone(state.phone ? state.phone : confirmationData.phone)}
      </p>

      {/* Manage reservation */}
      <div className="flex w-full flex-col gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Manage Your Reservation</p>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-xl border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            onClick={onModify}
          >
            <Calendar className="mr-1.5 h-4 w-4" />
            Modify
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-xl border-zinc-200 bg-white text-sm font-medium text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-rose-400 dark:hover:border-rose-900 dark:hover:bg-rose-500/10"
            onClick={() => setCancelDialogOpen(true)}
          >
            <X className="mr-1.5 h-4 w-4" />
            Cancel
          </Button>
        </div>

        <Button
          variant="outline"
          className="h-11 w-full rounded-xl border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          asChild
        >
          <a href="#" onClick={(e) => e.preventDefault()}>
            <Calendar className="mr-1.5 h-4 w-4" />
            Add to Calendar
          </a>
        </Button>
        <Button
          variant="outline"
          className="h-11 w-full rounded-xl border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          asChild
        >
          <a href={restaurant.mapUrl} target="_blank" rel="noopener noreferrer">
            <MapPin className="mr-1.5 h-4 w-4" />
            Get Directions
            <ExternalLink className="ml-auto h-3 w-3 text-zinc-400" />
          </a>
        </Button>
      </div>

      {/* Help text */}
      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
        {"Need to make changes? Reply to your confirmation text or call us at " + restaurant.phone + "."}
      </p>

      {/* Book Another */}
      <Button
        className="h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 dark:bg-emerald-500 dark:shadow-emerald-500/25 dark:hover:bg-emerald-600"
        onClick={onBookAnother}
      >
        Book Another Table
      </Button>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="rounded-xl border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-50">Cancel Reservation?</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              {"This cannot be undone. Free cancellation up to 4 hours before your reservation. Late cancellations may be subject to a \u20AC25/person fee."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 sm:gap-3">
            <Button
              variant="ghost"
              onClick={() => setCancelDialogOpen(false)}
              className="text-zinc-600 dark:text-zinc-400"
            >
              Keep Reservation
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCancelDialogOpen(false)
                setCancelled(true)
              }}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
