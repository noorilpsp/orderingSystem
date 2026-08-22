/**
 * Guests view contract - shape returned by getGuestsView and GET /api/guests/view.
 * Minimal real read model for the Guests ops page.
 */

export type GuestsSegment =
  | "new"
  | "flagged"
  | "at_risk"
  | "vip"
  | "regular";

/** Real visit = one order (completed or cancelled). Used for visit history. */
export interface GuestsVisit {
  id: string;
  date: string;
  total: number;
  status: "completed" | "cancelled";
  orderNumber: string;
  items: string[];
}

export type AllergyEntry = {
  type: string;
  severity: "mild" | "moderate" | "severe";
};

export interface GuestsStaffNote {
  id: string;
  author: string;
  role: string;
  date: string;
  text: string;
}

export interface GuestsUpcomingReservation {
  id: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
}

export interface GuestsFavoriteItem {
  name: string;
  frequency: number;
  total: number;
  percentage: number;
}

export interface GuestsUnifiedGuest {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: number;
  totalVisits: number;
  lifetimeValue: number;
  avgSpend: number;
  lastVisit: string;
  firstVisit: string;
  noShows: number;
  cancellations: number;
  segment: GuestsSegment;
  /** Recent visits (orders) for profile detail. Sorted by date desc. */
  visits: GuestsVisit[];
  /** CRM enrichment (stored). */
  birthday: string | null;
  anniversary: string | null;
  allergies: AllergyEntry[];
  dietary: string[];
  preferences: {
    seating: string | null;
    zone: string | null;
    server: string | null;
    welcomeDrink: string | null;
  };
  tags: string[];
  staffNotes: GuestsStaffNote[];
  /** Derived: upcoming reservations (pending/confirmed, date >= today). */
  upcomingReservations: GuestsUpcomingReservation[];
  /** Derived: favorite items from order history. */
  favoriteItems: GuestsFavoriteItem[];
  /** Real loyalty points balance when customer is linked to an auth user; null if walk-in only. */
  loyaltyPointsBalance: number | null;
}

export interface GuestsViewSegmentCounts {
  all: number;
  vip: number;
  regular: number;
  new: number;
  at_risk: number;
  flagged: number;
}

/** Neutral fallback when segment counts are temporarily absent. Use real data from GuestsView in production. */
export const EMPTY_SEGMENT_COUNTS: GuestsViewSegmentCounts = {
  all: 0,
  vip: 0,
  regular: 0,
  new: 0,
  at_risk: 0,
  flagged: 0,
};

export interface GuestsView {
  locationId: string;
  locationName: string;
  guests: GuestsUnifiedGuest[];
  segmentCounts: GuestsViewSegmentCounts;
}

export function isGuestsView(x: unknown): x is GuestsView {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.locationId === "string" &&
    typeof o.locationName === "string" &&
    Array.isArray(o.guests)
  );
}
