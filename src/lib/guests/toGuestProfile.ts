/**
 * Adapts GuestsUnifiedGuest to GuestProfile for existing UI components.
 */

import type { GuestProfile, ChurnRisk, VisitRecord } from "@/lib/guests-data";
import type { GuestsUnifiedGuest, GuestsSegment } from "./guestsView";

function toVisitRecord(v: { id: string; date: string; total: number; status: string; items: string[] }, index: number): VisitRecord {
  const d = new Date(v.date);
  const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
  return {
    id: index + 1,
    date: v.date,
    dayOfWeek,
    service: "Dinner",
    partySize: 1,
    table: "—",
    zone: "—",
    server: "—",
    status: v.status === "cancelled" ? "cancelled" : "completed",
    total: v.total,
    duration: null,
    items: v.items,
    note: null,
  };
}

function segmentToChurnRisk(segment: GuestsSegment): ChurnRisk {
  switch (segment) {
    case "flagged":
    case "at_risk":
      return "high";
    case "new":
      return "medium";
    default:
      return segment === "vip" ? "very_low" : "low";
  }
}

function deriveVipScore(g: GuestsUnifiedGuest): number {
  if (g.segment === "vip") return 80 + Math.min(20, Math.floor(g.totalVisits / 2));
  if (g.segment === "flagged") return Math.max(5, 30 - g.noShows * 10);
  if (g.segment === "at_risk") return 40;
  if (g.segment === "new") return 20 + g.totalVisits * 5;
  return 50 + Math.min(30, g.totalVisits * 3);
}

export function toGuestProfile(g: GuestsUnifiedGuest): GuestProfile {
  return {
    id: g.id,
    name: g.name,
    phone: g.phone,
    email: g.email,
    segment: g.segment,
    vipTier: null,
    totalVisits: g.totalVisits,
    lifetimeValue: g.lifetimeValue,
    avgSpend: g.avgSpend,
    lastVisit: g.lastVisit,
    firstVisit: g.firstVisit,
    noShows: g.noShows,
    cancellations: g.cancellations,
    birthday: g.birthday,
    anniversary: g.anniversary,
    allergies: g.allergies,
    dietary: g.dietary,
    preferences: g.preferences,
    tags: g.tags,
    vipScore: deriveVipScore(g),
    loyaltyPoints: g.loyaltyPointsBalance,
    churnRisk: segmentToChurnRisk(g.segment),
    visitHistory: g.visits.map((v, i) => toVisitRecord(v, i)),
    daysSinceLastVisit: Math.floor(
      (Date.now() - new Date(g.lastVisit).getTime()) / (1000 * 60 * 60 * 24)
    ),
    favoriteItems: g.favoriteItems,
    staffNotes: g.staffNotes.map((n) => ({
      id: n.id,
      author: n.author,
      role: n.role,
      date: n.date,
      text: n.text,
    })),
    upcomingReservations: g.upcomingReservations,
  };
}
