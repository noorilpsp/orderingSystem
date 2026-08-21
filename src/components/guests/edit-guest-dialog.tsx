"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { GuestProfile, AllergyEntry } from "@/lib/guests-data"
import { useLocation } from "@/lib/contexts/LocationContext"
import { PhoneNumberField } from "@/components/shared/phone-number-field"

interface EditGuestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: GuestProfile | null
  onSuccess?: () => void
}

const inputClass =
  "rounded-lg border border-zinc-600/60 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"

function parseTags(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim().replace(/\s+/g, "-").toLowerCase())
    .filter(Boolean)
}

function formatTags(tags: string[]): string {
  return tags.join(", ")
}

function parseDietary(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function EditGuestDialog({ open, onOpenChange, guest, onSuccess }: EditGuestDialogProps) {
  const { getCurrentLocation } = useLocation()
  const storeCountry = getCurrentLocation()?.country
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [birthday, setBirthday] = useState("")
  const [anniversary, setAnniversary] = useState("")
  const [allergies, setAllergies] = useState<AllergyEntry[]>([])
  const [dietaryRaw, setDietaryRaw] = useState("")
  const [seating, setSeating] = useState("")
  const [zone, setZone] = useState("")
  const [server, setServer] = useState("")
  const [welcomeDrink, setWelcomeDrink] = useState("")
  const [tagsRaw, setTagsRaw] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && guest) {
      setName(guest.name)
      setPhone(guest.phone)
      setEmail(guest.email ?? "")
      setBirthday(guest.birthday ?? "")
      setAnniversary(guest.anniversary ?? "")
      setAllergies([...guest.allergies])
      setDietaryRaw(guest.dietary.join(", "))
      setSeating(guest.preferences.seating ?? "")
      setZone(guest.preferences.zone ?? "")
      setServer(guest.preferences.server ?? "")
      setWelcomeDrink(guest.preferences.welcomeDrink ?? "")
      setTagsRaw(formatTags(guest.tags))
      setError(null)
    }
  }, [open, guest])

  function addAllergy() {
    setAllergies((prev) => [...prev, { type: "", severity: "mild" }])
  }
  function removeAllergy(i: number) {
    setAllergies((prev) => prev.filter((_, idx) => idx !== i))
  }
  function updateAllergy(i: number, field: "type" | "severity", value: string) {
    setAllergies((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!guest) return
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

    const validAllergies = allergies
      .filter((a) => a.type.trim())
      .map((a) => ({ type: a.type.trim(), severity: a.severity as "mild" | "moderate" | "severe" }))
    const dietary = parseDietary(dietaryRaw)
    const tags = parseTags(tagsRaw)
    const prefs = {
      seating: seating.trim() || null,
      zone: zone.trim() || null,
      server: server.trim() || null,
      welcomeDrink: welcomeDrink.trim() || null,
    }
    const hasPrefs = Object.values(prefs).some(Boolean)
    const profileMeta =
      validAllergies.length > 0 ||
      dietary.length > 0 ||
      tags.length > 0 ||
      hasPrefs
        ? {
            ...(validAllergies.length > 0 && { allergies: validAllergies }),
            ...(dietary.length > 0 && { dietary }),
            ...(hasPrefs && { preferences: prefs }),
            ...(tags.length > 0 && { tags }),
          }
        : null

    setLoading(true)
    try {
      const res = await fetch(`/api/customers/${guest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          birthday: birthday.trim() || null,
          anniversary: anniversary.trim() || null,
          profileMeta,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to update guest")
      }

      toast.success("Guest updated")
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update guest"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!guest) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-edit-guest-dialog
        className="edit-guest-dialog max-h-[85dvh] overflow-y-auto border-zinc-700/60 bg-zinc-900/98 backdrop-blur-xl sm:max-w-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Edit Guest</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-guest-name" className="text-xs font-medium text-zinc-400">
              Name *
            </label>
            <input
              id="edit-guest-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Guest name"
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-guest-phone" className="text-xs font-medium text-zinc-400">
              Phone *
            </label>
            <PhoneNumberField
              id="edit-guest-phone"
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
            <label htmlFor="edit-guest-email" className="text-xs font-medium text-zinc-400">
              Email
            </label>
            <input
              id="edit-guest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="Email (optional)"
              disabled={loading}
            />
          </div>

          <div className="border-t border-zinc-700/50 pt-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Profile Details</h4>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-guest-birthday" className="text-xs font-medium text-zinc-400">
                    Birthday
                  </label>
                  <input
                    id="edit-guest-birthday"
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className={inputClass}
                    disabled={loading}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-guest-anniversary" className="text-xs font-medium text-zinc-400">
                    Anniversary
                  </label>
                  <input
                    id="edit-guest-anniversary"
                    type="date"
                    value={anniversary}
                    onChange={(e) => setAnniversary(e.target.value)}
                    className={inputClass}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400">Allergies</label>
                <div className="flex flex-col gap-2">
                  {allergies.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={a.type}
                        onChange={(e) => updateAllergy(i, "type", e.target.value)}
                        className={inputClass + " flex-1"}
                        placeholder="e.g. Shellfish"
                        disabled={loading}
                      />
                      <select
                        value={a.severity}
                        onChange={(e) => updateAllergy(i, "severity", e.target.value)}
                        className={inputClass + " w-24"}
                        disabled={loading}
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                      </select>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeAllergy(i)} className="text-zinc-400 hover:text-rose-400" disabled={loading}>
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addAllergy} className="w-fit border-dashed text-xs text-zinc-400" disabled={loading}>
                    + Add allergy
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-guest-dietary" className="text-xs font-medium text-zinc-400">
                  Dietary
                </label>
                <input
                  id="edit-guest-dietary"
                  type="text"
                  value={dietaryRaw}
                  onChange={(e) => setDietaryRaw(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Vegetarian, Gluten-free (comma-separated)"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-guest-seating" className="text-xs font-medium text-zinc-400">
                    Seating
                  </label>
                  <input
                    id="edit-guest-seating"
                    type="text"
                    value={seating}
                    onChange={(e) => setSeating(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. window"
                    disabled={loading}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-guest-zone" className="text-xs font-medium text-zinc-400">
                    Zone
                  </label>
                  <input
                    id="edit-guest-zone"
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. main"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-guest-server" className="text-xs font-medium text-zinc-400">
                    Preferred server
                  </label>
                  <input
                    id="edit-guest-server"
                    type="text"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className={inputClass}
                    placeholder="Optional"
                    disabled={loading}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-guest-welcome" className="text-xs font-medium text-zinc-400">
                    Welcome drink
                  </label>
                  <input
                    id="edit-guest-welcome"
                    type="text"
                    value={welcomeDrink}
                    onChange={(e) => setWelcomeDrink(e.target.value)}
                    className={inputClass}
                    placeholder="Optional"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-guest-tags" className="text-xs font-medium text-zinc-400">
                  Tags
                </label>
                <input
                  id="edit-guest-tags"
                  type="text"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. vip, birthday-celebrations (comma-separated)"
                  disabled={loading}
                />
              </div>
            </div>
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
              {loading ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
