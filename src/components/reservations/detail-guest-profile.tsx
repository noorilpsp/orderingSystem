"use client"

import { Phone, Mail, AlertTriangle, ExternalLink } from "lucide-react"
import { type DetailReservation, getDaysAgo, tagConfig } from "@/lib/detail-modal-data"
import { cn } from "@/lib/utils"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"

interface DetailGuestProfileProps {
  reservation: DetailReservation
}

export function DetailGuestProfile({ reservation }: DetailGuestProfileProps) {
  const displayPhone = useDisplayPhone()
  const { guest, guestName, guestPhone, guestEmail, tags } = reservation
  const initials = guestName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const avatarColor = guest.vipTier === "gold"
    ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30"
    : guest.vipTier === "silver"
      ? "bg-blue-600/20 text-blue-300 border-blue-500/30"
      : "bg-zinc-700/40 text-zinc-300 border-zinc-600/30"

  const daysAgo = getDaysAgo(guest.lastVisit)

  return (
    <section className="detail-section-stagger rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Guest Profile</h3>
        <button className="flex items-center gap-1 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300">
          Full Profile <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Avatar + Contact */}
      <div className="mb-4 flex items-start gap-3">
        <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold", avatarColor)}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{guestName}</p>
          <a href={`tel:${guestPhone}`} className="flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200">
            <Phone className="h-3 w-3" /> {displayPhone(guestPhone)}
          </a>
          <a href={`mailto:${guestEmail}`} className="flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200">
            <Mail className="h-3 w-3" /> {guestEmail}
          </a>
        </div>
      </div>

      {/* Mini stat cards */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/30 px-3 py-2 text-center">
          <p className="text-lg font-bold text-foreground">{guest.totalVisits}</p>
          <p className="text-[10px] text-zinc-400">
            visits
            {guest.vipTier === "gold" && <span className="ml-1 text-amber-400">VIP</span>}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/30 px-3 py-2 text-center">
          <p className="text-lg font-bold text-foreground">${guest.avgSpend}</p>
          <p className="text-[10px] text-zinc-400">avg spend</p>
        </div>
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/30 px-3 py-2 text-center">
          <p className="text-lg font-bold text-foreground">{daysAgo === 0 ? "Today" : `${daysAgo}d`}</p>
          <p className="text-[10px] text-zinc-400">last visit</p>
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const cfg = tagConfig[tag]
            if (!cfg) return null
            return (
              <span key={tag} className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.color)}>
                {cfg.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Preferences */}
      {guest.preferences.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Preferences</p>
          <ul className="space-y-0.5">
            {guest.preferences.map((pref, i) => (
              <li key={i} className="text-xs text-zinc-300">
                <span className="mr-1.5 text-zinc-600">{"•"}</span>
                {pref}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Allergy alert */}
      {guest.allergies.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-amber-300">ALLERGY: {guest.allergies.join(", ")}</p>
            <p className="text-[10px] text-amber-400/70">Kitchen auto-alerted</p>
          </div>
        </div>
      )}
    </section>
  )
}
