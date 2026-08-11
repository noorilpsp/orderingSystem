"use client"

import { Star, Phone, Mail, MapPin, Edit, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { GuestProfile } from "@/lib/guests-data"
import { getInitials, getAvatarColor, getSegmentLabel, getSegmentColor, formatCurrency } from "@/lib/guests-data"

interface ProfileHeaderProps {
  guest: GuestProfile
  onEdit?: () => void
}

function tagLabel(tag: string): string {
  const labels: Record<string, string> = {
    "vip": "VIP",
    "high-value": "High-value",
    "window-preference": "Window",
    "regular": "Regular",
    "birthday-celebrations": "Birthdays",
    "anniversary-couple": "Anniversary",
    "celebration-regular": "Celebrations",
    "first-timer": "First-timer",
    "high-risk": "High Risk",
    "repeat-no-show": "No-shows",
    "no-show-history": "No-show History",
    "lunch-regular": "Lunch Regular",
    "at-risk": "At Risk",
    "was-regular": "Was Regular",
    "vegetarian": "Vegetarian",
    "nut-allergy": "Nut Allergy",
    "quiet-area": "Quiet Area",
    "gluten-sensitive": "Gluten Sensitive",
    "dairy-allergy": "Dairy Allergy",
    "business-dinners": "Business",
    "high-potential": "High Potential",
  }
  return labels[tag] || tag.replace(/-/g, " ")
}

function tagColor(tag: string): string {
  if (tag === "vip" || tag === "high-value") return "border-amber-500/30 bg-amber-500/10 text-amber-300"
  if (tag.includes("allergy") || tag.includes("shellfish") || tag.includes("nut") || tag.includes("dairy") || tag.includes("gluten")) return "border-rose-500/30 bg-rose-500/10 text-rose-300"
  if (tag.includes("no-show") || tag.includes("high-risk") || tag.includes("at-risk")) return "border-rose-500/30 bg-rose-500/10 text-rose-300"
  if (tag.includes("window") || tag.includes("quiet")) return "border-blue-500/30 bg-blue-500/10 text-blue-300"
  if (tag.includes("anniversary") || tag.includes("birthday") || tag.includes("celebration")) return "border-pink-500/30 bg-pink-500/10 text-pink-300"
  if (tag === "first-timer" || tag === "high-potential") return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
  if (tag === "vegetarian") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  if (tag === "business-dinners") return "border-blue-500/30 bg-blue-500/10 text-blue-300"
  return "border-border/30 bg-secondary/40 text-muted-foreground"
}

export function GuestProfileHeader({ guest, onEdit }: ProfileHeaderProps) {
  const tierColor = guest.vipTier === "gold" ? "text-amber-400" : guest.vipTier === "silver" ? "text-zinc-300" : "text-orange-400"

  return (
    <div className="guest-profile-section flex flex-col gap-4 p-4 lg:p-5">
      {/* Top: Avatar + Name + Contact */}
      <div className="flex items-start gap-4">
        <div className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-bold lg:h-20 lg:w-20 lg:text-xl",
          getAvatarColor(guest.segment)
        )}>
          {getInitials(guest.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {guest.segment === "vip" && <Star className="h-4 w-4 text-amber-400" />}
            <h2 className="truncate text-lg font-semibold text-foreground">{guest.name}</h2>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("rounded-full border px-2 py-0.5 font-medium", getSegmentColor(guest.segment))}>
              {getSegmentLabel(guest.segment)} Guest
            </span>
            {guest.vipTier && (
              <span className={cn("font-medium capitalize", tierColor)}>
                {guest.vipTier} Tier
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />{guest.phone}
            </span>
            {guest.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />{guest.email}
              </span>
            )}
            {guest.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{guest.location}
              </span>
            )}
          </div>
        </div>

        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
            <Edit className="mr-1 h-3 w-3" />
            Edit
          </Button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { value: guest.totalVisits.toString(), label: "visits", sub: guest.vipScore >= 80 ? "Top 5%" : guest.vipScore >= 60 ? "Active" : null, subColor: "text-amber-400" },
          { value: formatCurrency(guest.lifetimeValue), label: "lifetime", sub: guest.lifetimeValue >= 2000 ? "Top 3%" : null, subColor: "text-amber-400" },
          { value: formatCurrency(guest.avgSpend), label: "avg spend", sub: guest.avgSpend >= 200 ? "High" : guest.avgSpend >= 120 ? "Above Avg" : null, subColor: "text-emerald-400" },
          {
            value:
              guest.loyaltyPoints != null
                ? guest.loyaltyPoints.toLocaleString()
                : "—",
            label: "loyalty pts",
            sub: guest.loyaltyPoints != null ? "Enrolled" : "Not enrolled",
            subColor: guest.loyaltyPoints != null ? "text-orange-400" : "text-muted-foreground",
          },
          { value: guest.noShows.toString(), label: "no-shows", sub: guest.noShows === 0 ? "Perfect" : `${guest.noShows} missed`, subColor: guest.noShows === 0 ? "text-emerald-400" : "text-rose-400" },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center rounded-xl border border-border/30 bg-secondary/30 px-2 py-2.5">
            <span className="text-base font-bold text-foreground lg:text-lg">{stat.value}</span>
            <span className="text-[10px] text-muted-foreground">{stat.label}</span>
            {stat.sub && (
              <span className={cn("mt-0.5 text-[10px] font-medium", stat.subColor)}>{stat.sub}</span>
            )}
          </div>
        ))}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        {guest.tags.map((tag) => (
          <Badge key={tag} variant="outline" className={cn("guest-tag-badge text-[10px]", tagColor(tag))}>
            {tagLabel(tag)}
          </Badge>
        ))}
        {guest.allergies.map((a) => (
          <Badge key={a.type} variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-300" role="alert">
            {a.type} ({a.severity})
          </Badge>
        ))}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-0.5 rounded-full border border-dashed border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-2.5 w-2.5" />
            Add Tag
          </button>
        )}
      </div>

      <Separator className="bg-border/30" />
    </div>
  )
}
