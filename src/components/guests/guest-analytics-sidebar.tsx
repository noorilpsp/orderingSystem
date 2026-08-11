"use client"

import { useEffect, useRef, useState } from "react"
import { Calendar, Plus, TrendingUp, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { GuestProfile } from "@/lib/guests-data"
import { formatCurrency, getChurnLabel } from "@/lib/guests-data"

interface AnalyticsSidebarProps {
  guest: GuestProfile
}

/* ── VIP Score Ring ─────────────────────────────────────────── */
function VipScoreRing({ score }: { score: number }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  const color = score >= 80 ? "hsl(160 84% 39%)" : score >= 60 ? "hsl(185 85% 45%)" : score >= 40 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)"

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="108" height="108" viewBox="0 0 108 108" aria-label={`VIP score: ${score} out of 100`}>
          <circle cx="54" cy="54" r={radius} fill="none" stroke="hsl(220 15% 14%)" strokeWidth="7" />
          <circle
            cx="54" cy="54" r={radius}
            fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? circumference - progress : circumference}
            transform="rotate(-90 54 54)"
            style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
    </div>
  )
}

/* ── Score Breakdown Bar ────────────────────────────────────── */
function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}:</span>
      <div className="h-1.5 flex-1 rounded-full bg-secondary/50">
        <div
          className="h-full rounded-full bg-primary/60 guest-score-bar"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-medium text-foreground">{value}/{max}</span>
    </div>
  )
}

/* ── Main Analytics ─────────────────────────────────────────── */
export function GuestAnalyticsSidebar({ guest }: AnalyticsSidebarProps) {
  const breakdown = {
    frequency: Math.min(10, Math.round((guest.vipScore / 100) * 10)),
    spend: Math.min(10, Math.round((guest.avgSpend / 310) * 10)),
    visitFrequency: Math.min(10, Math.round((guest.totalVisits / 18) * 10)),
    engagement: Math.min(10, Math.round(guest.vipScore / 12)),
    reliability: Math.max(0, 10 - guest.noShows * 3),
  }
  const revenue = {
    annualRevenuePercent: Number(((guest.lifetimeValue / 220000) * 100).toFixed(1)),
    topGuestPercent: Math.max(1, Math.round(100 - guest.vipScore)),
    avgVsRestaurant: +(guest.avgSpend / 85).toFixed(1),
    restaurantAvg: 85,
    projectedAnnual: guest.projectedAnnualValue ?? Math.round(guest.avgSpend * guest.totalVisits * 2),
  }
  const daysSince = guest.daysSinceLastVisit ?? Math.floor(
    (Date.now() - new Date(guest.lastVisit).getTime()) / (1000 * 60 * 60 * 24)
  )
  const retention = {
    level: guest.churnRisk,
    visitFrequencyTrend: guest.churnRisk === "high" ? "declining" : "stable",
    spendTrend: guest.churnRisk === "high" ? "declining" : "stable",
    lastVisit: daysSince === 0 ? "today" : `${daysSince} days ago`,
    churnProbability: guest.churnRisk === "very_low" ? 5 : guest.churnRisk === "low" ? 15 : guest.churnRisk === "medium" ? 35 : 65,
  }

  const riskColor = retention.level === "very_low" ? "text-emerald-400" : retention.level === "low" ? "text-emerald-300" : retention.level === "medium" ? "text-amber-400" : "text-rose-400"
  const riskDot = retention.level === "very_low" || retention.level === "low" ? "bg-emerald-400" : retention.level === "medium" ? "bg-amber-400" : "bg-rose-400"

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Guest Insights</h3>

      {/* VIP Score */}
      <div className="guest-insight-section rounded-xl border border-border/30 bg-card/40 p-4">
        <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">VIP Score</h4>
        <VipScoreRing score={guest.vipScore} />
        <div className="mt-4 flex flex-col gap-2">
          <ScoreBar label="Frequency" value={breakdown.frequency} />
          <ScoreBar label="Spend" value={breakdown.spend} />
          <ScoreBar label="Visit frequency" value={breakdown.visitFrequency} />
          <ScoreBar label="Engagement" value={breakdown.engagement} />
          <ScoreBar label="Reliability" value={breakdown.reliability} />
        </div>
        {guest.loyaltyPoints != null ? (
          <div className="mt-4 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Points balance
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {guest.loyaltyPoints.toLocaleString()} pts
            </p>
          </div>
        ) : null}
      </div>

      {/* Revenue Impact */}
      <div className="guest-insight-section rounded-xl border border-border/30 bg-card/40 p-4">
        <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue Impact</h4>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Annual revenue share</span>
            <span className="font-medium text-foreground">{revenue.annualRevenuePercent}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Guest percentile</span>
            <span className="font-medium text-foreground">Top {revenue.topGuestPercent}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Avg vs restaurant</span>
            <span className="font-medium text-foreground">{formatCurrency(guest.avgSpend)} vs {formatCurrency(revenue.restaurantAvg)} ({revenue.avgVsRestaurant}x)</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/20 pt-2">
            <span className="text-muted-foreground">Projected annual</span>
            <span className="font-semibold text-primary">{formatCurrency(revenue.projectedAnnual)}</span>
          </div>
        </div>
      </div>

      {/* Retention Risk */}
      <div className="guest-insight-section rounded-xl border border-border/30 bg-card/40 p-4">
        <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Retention Risk</h4>
        <div className="mb-3 flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", riskDot)} />
          <span className={cn("text-sm font-semibold", riskColor)}>
            {getChurnLabel(retention.level as "very_low" | "low" | "medium" | "high")}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />
            <span>Visit frequency: {retention.visitFrequencyTrend === "stable_up" || retention.visitFrequencyTrend === "stable" ? "Stable" : "Declining"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />
            <span>Spend trend: {retention.spendTrend === "increasing" ? "Increasing" : retention.spendTrend === "stable" ? "Stable" : "Declining"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>Last visit: {retention.lastVisit}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            <span>Churn probability: {`<`}{retention.churnProbability}%</span>
          </div>
        </div>
      </div>

      {/* Upcoming Reservations */}
      <div className="guest-insight-section rounded-xl border border-border/30 bg-card/40 p-4">
        <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Reservations</h4>
        {(guest.upcomingReservations?.length ?? 0) > 0 ? (
          <div className="flex flex-col gap-2">
            {guest.upcomingReservations!.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/20 bg-secondary/20 px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-foreground">{new Date(r.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.time}</span>
                </div>
                <span className="text-xs text-muted-foreground">{r.partySize} guests</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No upcoming reservations</p>
        )}
        <Button variant="ghost" size="sm" className="mt-2 w-full gap-1 text-xs text-muted-foreground hover:text-primary">
          <Plus className="h-3 w-3" /> Book Next Visit
        </Button>
      </div>
    </div>
  )
}
