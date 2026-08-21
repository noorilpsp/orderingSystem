"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useLocation } from "@/lib/contexts/LocationContext"
import { PhoneNumberField } from "@/components/shared/phone-number-field"

interface AddGuestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationId: string
  onSuccess?: (createdId: string) => void
}

const inputClass =
  "rounded-lg border border-zinc-600/60 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"

export function AddGuestDialog({ open, onOpenChange, locationId, onSuccess }: AddGuestDialogProps) {
  const { locations } = useLocation()
  const storeCountry = locations.find((location) => location.id === locationId)?.country
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setPhone("")
      setEmail("")
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim() || null

    if (!trimmedName) {
      setError("Name is required")
      return
    }
    if (!trimmedPhone) {
      setError("Phone is required")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          name: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create guest")
      }

      toast.success("Guest added successfully")
      onOpenChange(false)
      onSuccess?.(data?.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create guest"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-add-guest-dialog
        className="add-guest-dialog max-h-[85dvh] overflow-y-auto border-zinc-700/60 bg-zinc-900/98 backdrop-blur-xl sm:max-w-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Add New Guest</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-guest-name" className="text-xs font-medium text-zinc-400">
              Name *
            </label>
            <input
              id="add-guest-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Guest name"
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-guest-phone" className="text-xs font-medium text-zinc-400">
              Phone *
            </label>
            <PhoneNumberField
              id="add-guest-phone"
              value={phone}
              onChange={setPhone}
              defaultCountry={storeCountry}
              disabled={loading}
              placeholder="Phone number"
              triggerClassName="rounded-lg border-zinc-600/60 bg-zinc-800/80 text-zinc-100"
              inputClassName={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-guest-email" className="text-xs font-medium text-zinc-400">
              Email
            </label>
            <input
              id="add-guest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="Email (optional)"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-700/50 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 text-emerald-50 hover:bg-emerald-500" disabled={loading}>
              {loading ? "Saving…" : "Save Guest"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
