// ── Guest CRM Data Layer ──────────────────────────────────────────

export type AllergyEntry = { type: string; severity: "mild" | "moderate" | "severe" }
export type GuestSegment = "vip" | "regular" | "new" | "at_risk" | "flagged"
export type ChurnRisk = "very_low" | "low" | "medium" | "high"
export type VipTier = "gold" | "silver" | "bronze" | null

export interface FavoriteItem {
  name: string
  frequency: number
  total: number
  percentage: number
}

export interface VisitRecord {
  id: number
  date: string
  dayOfWeek: string
  service: "Dinner" | "Lunch" | "Brunch"
  partySize: number
  table: string
  zone: string
  server: string
  status: "completed" | "in_progress" | "no_show" | "cancelled"
  total: number
  duration: string | null
  items: string[]
  note: string | null
}

export interface CommMessage {
  id: string
  date: string
  type: "sms" | "email"
  direction: "outbound" | "inbound"
  subject: string
  preview: string
  status: "delivered" | "read" | "opened" | "failed" | "sent"
  reply?: string
}

export interface StaffNote {
  id: string
  author: string
  role: string
  date: string
  text: string
}

export interface SmartAction {
  id: string
  icon: string
  text: string
  subtext: string
  action: string
}

export interface GuestProfile {
  id: string
  name: string
  phone: string
  email: string | null
  segment: GuestSegment
  vipTier: VipTier
  totalVisits: number
  lifetimeValue: number
  avgSpend: number
  lastVisit: string
  firstVisit: string
  noShows: number
  cancellations: number
  birthday: string | null
  anniversary: string | null
  allergies: AllergyEntry[]
  dietary: string[]
  preferences: {
    seating: string | null
    zone: string | null
    server: string | null
    welcomeDrink: string | null
  }
  tags: string[]
  vipScore: number
  /** Real loyalty points when linked to auth user; null if not enrolled. */
  loyaltyPoints?: number | null
  churnRisk: ChurnRisk
  projectedAnnualValue?: number
  favoriteItems?: FavoriteItem[]
  preferredDays?: string[]
  preferredTime?: string
  avgPartySize?: number
  bookingChannel?: string
  flags?: string[]
  churnNote?: string
  daysSinceLastVisit?: number
  location?: string
  /** Real visit history from backend. Prefer over synthetic. */
  visitHistory?: VisitRecord[]
  /** Staff notes for this guest (CRM). */
  staffNotes?: StaffNote[]
  /** Upcoming reservations (pending/confirmed). */
  upcomingReservations?: Array<{
    id: string
    date: string
    time: string
    partySize: number
    status: string
  }>
}

// ── Segment Counts ──────────────────────────────────────────────
/** Mock segment counts. Use real segmentCounts from GuestsView when available. */
export const SEGMENT_COUNTS: {
  all: number
  vip: number
  regular: number
  new: number
  at_risk: number
  flagged: number
} = {
  all: 247,
  vip: 18,
  regular: 42,
  new: 35,
  at_risk: 12,
  flagged: 3,
}

// ── 20 Guest Profiles ──────────────────────────────────────────
export const guests: GuestProfile[] = [
  {
    id: "guest_001",
    name: "Sarah Chen",
    phone: "+1 (555) 123-4567",
    email: "sarah.chen@email.com",
    segment: "vip",
    vipTier: "gold",
    totalVisits: 12,
    lifetimeValue: 2640,
    avgSpend: 220,
    lastVisit: "2025-01-17",
    firstVisit: "2024-08-12",
    noShows: 0,
    cancellations: 1,
    birthday: "1988-03-15",
    anniversary: "2018-09-22",
    allergies: [{ type: "Shellfish", severity: "severe" }],
    dietary: [],
    preferences: { seating: "window", zone: "main", server: "Mike", welcomeDrink: "Old Fashioned" },
    tags: ["vip", "high-value", "window-preference"],
    vipScore: 92,
    churnRisk: "very_low",
    projectedAnnualValue: 4752,
    favoriteItems: [
      { name: "Old Fashioned", frequency: 10, total: 12, percentage: 83 },
      { name: "Ribeye (Medium-Rare)", frequency: 7, total: 12, percentage: 58 },
      { name: "Tuna Tartare", frequency: 6, total: 12, percentage: 50 },
      { name: "Burrata Salad", frequency: 5, total: 12, percentage: 42 },
      { name: "Creme Brulee", frequency: 4, total: 12, percentage: 33 },
    ],
    preferredDays: ["friday", "saturday"],
    preferredTime: "19:00-19:30",
    avgPartySize: 3.2,
    location: "Brooklyn, NY",
  },
  {
    id: "guest_002",
    name: "Kim Family",
    phone: "+1 (555) 234-5678",
    email: "jkim@email.com",
    segment: "regular",
    vipTier: null,
    totalVisits: 15,
    lifetimeValue: 2475,
    avgSpend: 165,
    lastVisit: "2025-01-17",
    firstVisit: "2024-04-20",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: "quiet", zone: "main", server: null, welcomeDrink: null },
    tags: ["regular", "birthday-celebrations"],
    vipScore: 78,
    churnRisk: "low",
    avgPartySize: 5.2,
    preferredDays: ["saturday", "sunday"],
    preferredTime: "18:00-18:30",
    favoriteItems: [
      { name: "Pasta Primavera", frequency: 12, total: 15, percentage: 80 },
      { name: "Margherita Pizza", frequency: 10, total: 15, percentage: 67 },
      { name: "Tiramisu", frequency: 8, total: 15, percentage: 53 },
    ],
  },
  {
    id: "guest_003",
    name: "Rivera",
    phone: "+1 (555) 345-6789",
    email: "rivera.couple@email.com",
    segment: "regular",
    vipTier: null,
    totalVisits: 4,
    lifetimeValue: 760,
    avgSpend: 190,
    lastVisit: "2025-01-17",
    firstVisit: "2024-09-15",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: "2019-06-15",
    allergies: [],
    dietary: [],
    preferences: { seating: "booth", zone: "main", server: null, welcomeDrink: null },
    tags: ["anniversary-couple"],
    vipScore: 62,
    churnRisk: "low",
    avgPartySize: 2,
    preferredDays: ["friday", "saturday"],
    preferredTime: "19:30-20:00",
  },
  {
    id: "guest_004",
    name: "Anderson",
    phone: "+1 (555) 456-7890",
    email: null,
    segment: "regular",
    vipTier: null,
    totalVisits: 6,
    lifetimeValue: 1860,
    avgSpend: 310,
    lastVisit: "2025-01-17",
    firstVisit: "2024-06-10",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: "private", server: "Anna", welcomeDrink: "Champagne" },
    tags: ["high-value", "celebration-regular"],
    vipScore: 75,
    churnRisk: "low",
    avgPartySize: 6.5,
    preferredDays: ["friday", "saturday"],
    preferredTime: "20:00-20:30",
    favoriteItems: [
      { name: "Champagne", frequency: 6, total: 6, percentage: 100 },
      { name: "Tasting Menu", frequency: 5, total: 6, percentage: 83 },
      { name: "Wagyu Steak", frequency: 4, total: 6, percentage: 67 },
    ],
  },
  {
    id: "guest_005",
    name: "Baker",
    phone: "+1 (555) 567-8901",
    email: "baker.j@email.com",
    segment: "flagged",
    vipTier: null,
    totalVisits: 5,
    lifetimeValue: 325,
    avgSpend: 65,
    lastVisit: "2025-01-17",
    firstVisit: "2024-07-20",
    noShows: 3,
    cancellations: 1,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: ["high-risk", "repeat-no-show"],
    vipScore: 15,
    churnRisk: "high",
    flags: ["3 no-shows in 2024", "Deposit required for future bookings"],
  },
  {
    id: "guest_006",
    name: "Marcus Webb",
    phone: "+1 (555) 678-9012",
    email: "mwebb@gmail.com",
    segment: "new",
    vipTier: null,
    totalVisits: 1,
    lifetimeValue: 85,
    avgSpend: 85,
    lastVisit: "2025-01-17",
    firstVisit: "2025-01-17",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: ["first-timer"],
    bookingChannel: "google",
    vipScore: 20,
    churnRisk: "medium",
  },
  {
    id: "guest_007",
    name: "Dubois",
    phone: "+32 (0)2 345 6789",
    email: "m.dubois@email.be",
    segment: "at_risk",
    vipTier: null,
    totalVisits: 5,
    lifetimeValue: 475,
    avgSpend: 95,
    lastVisit: "2024-11-28",
    firstVisit: "2024-06-15",
    daysSinceLastVisit: 50,
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: "patio", server: null, welcomeDrink: null },
    tags: ["lunch-regular", "at-risk"],
    vipScore: 45,
    churnRisk: "high",
    churnNote: "Previously visited every 2 weeks. No visit in 50 days.",
    preferredDays: ["tuesday", "wednesday"],
    preferredTime: "12:00-12:30",
  },
  {
    id: "guest_008",
    name: "Patel",
    phone: "+1 (555) 789-0123",
    email: "patel.family@email.com",
    segment: "regular",
    vipTier: null,
    totalVisits: 7,
    lifetimeValue: 1015,
    avgSpend: 145,
    lastVisit: "2025-01-17",
    firstVisit: "2024-05-18",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: ["vegetarian"],
    preferences: { seating: null, zone: "main", server: null, welcomeDrink: null },
    tags: ["vegetarian"],
    vipScore: 65,
    churnRisk: "low",
    avgPartySize: 4,
    favoriteItems: [
      { name: "Garden Risotto", frequency: 6, total: 7, percentage: 86 },
      { name: "Burrata Salad", frequency: 5, total: 7, percentage: 71 },
      { name: "Mushroom Pasta", frequency: 4, total: 7, percentage: 57 },
    ],
  },
  {
    id: "guest_009",
    name: "O'Brien",
    phone: "+1 (555) 890-1234",
    email: null,
    segment: "regular",
    vipTier: null,
    totalVisits: 8,
    lifetimeValue: 1120,
    avgSpend: 140,
    lastVisit: "2025-01-17",
    firstVisit: "2024-05-05",
    noShows: 1,
    cancellations: 0,
    birthday: "1975-11-08",
    anniversary: null,
    allergies: [{ type: "Nuts", severity: "moderate" }],
    dietary: [],
    preferences: { seating: "booth", zone: "main", server: null, welcomeDrink: "Guinness" },
    tags: ["nut-allergy"],
    vipScore: 58,
    churnRisk: "low",
    avgPartySize: 2.5,
  },
  {
    id: "guest_010",
    name: "Nguyen Family",
    phone: "+1 (555) 901-2345",
    email: "nguyen.fam@email.com",
    segment: "regular",
    vipTier: null,
    totalVisits: 8,
    lifetimeValue: 1440,
    avgSpend: 180,
    lastVisit: "2025-01-17",
    firstVisit: "2024-04-10",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: "quiet", zone: "main", server: null, welcomeDrink: null },
    tags: ["regular", "birthday-celebrations", "quiet-area"],
    vipScore: 72,
    churnRisk: "very_low",
    avgPartySize: 6,
    preferredDays: ["saturday", "sunday"],
  },
  {
    id: "guest_011",
    name: "Morrison",
    phone: "+1 (555) 012-3456",
    email: "jake.m@email.com",
    segment: "flagged",
    vipTier: null,
    totalVisits: 3,
    lifetimeValue: 195,
    avgSpend: 65,
    lastVisit: "2025-01-10",
    firstVisit: "2024-10-05",
    noShows: 2,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: ["high-risk", "no-show-history"],
    vipScore: 12,
    churnRisk: "high",
    flags: ["2 no-shows out of 3 bookings (67% no-show rate)", "Deposit now required"],
  },
  {
    id: "guest_012",
    name: "Jensen",
    phone: "+45 20 12 34 56",
    email: "a.jensen@email.dk",
    segment: "regular",
    vipTier: null,
    totalVisits: 6,
    lifetimeValue: 510,
    avgSpend: 85,
    lastVisit: "2025-01-17",
    firstVisit: "2024-07-30",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [{ type: "Gluten", severity: "mild" }],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: ["gluten-sensitive"],
    vipScore: 48,
    churnRisk: "low",
  },
  {
    id: "guest_013",
    name: "Garcia",
    phone: "+1 (555) 234-8765",
    email: null,
    segment: "new",
    vipTier: null,
    totalVisits: 2,
    lifetimeValue: 155,
    avgSpend: 77,
    lastVisit: "2025-01-10",
    firstVisit: "2024-12-28",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: [],
    vipScore: 25,
    churnRisk: "medium",
  },
  {
    id: "guest_014",
    name: "Johansson",
    phone: "+46 70 123 4567",
    email: "e.johansson@email.se",
    segment: "new",
    vipTier: null,
    totalVisits: 1,
    lifetimeValue: 98,
    avgSpend: 98,
    lastVisit: "2025-01-17",
    firstVisit: "2025-01-17",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: ["first-timer"],
    vipScore: 22,
    churnRisk: "medium",
  },
  {
    id: "guest_015",
    name: "Santos",
    phone: "+1 (555) 456-3210",
    email: "d.santos@email.com",
    segment: "new",
    vipTier: null,
    totalVisits: 2,
    lifetimeValue: 170,
    avgSpend: 85,
    lastVisit: "2025-01-03",
    firstVisit: "2024-12-20",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [{ type: "Dairy", severity: "moderate" }],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: ["dairy-allergy"],
    vipScore: 28,
    churnRisk: "medium",
  },
  {
    id: "guest_016",
    name: "Muller",
    phone: "+49 170 1234567",
    email: "h.mueller@email.de",
    segment: "regular",
    vipTier: null,
    totalVisits: 5,
    lifetimeValue: 625,
    avgSpend: 125,
    lastVisit: "2025-01-17",
    firstVisit: "2024-08-25",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: [],
    vipScore: 52,
    churnRisk: "low",
    preferredDays: ["friday"],
  },
  {
    id: "guest_017",
    name: "Thompson",
    phone: "+1 (555) 321-6540",
    email: null,
    segment: "regular",
    vipTier: null,
    totalVisits: 3,
    lifetimeValue: 246,
    avgSpend: 82,
    lastVisit: "2025-01-17",
    firstVisit: "2024-11-15",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: [],
    vipScore: 35,
    churnRisk: "low",
  },
  {
    id: "guest_018",
    name: "Nakamura",
    phone: "+81 90 1234 5678",
    email: "k.nakamura@email.jp",
    segment: "new",
    vipTier: null,
    totalVisits: 1,
    lifetimeValue: 110,
    avgSpend: 110,
    lastVisit: "2024-12-15",
    firstVisit: "2024-12-15",
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: null, server: null, welcomeDrink: null },
    tags: ["first-timer", "high-potential"],
    vipScore: 30,
    churnRisk: "medium",
  },
  {
    id: "guest_019",
    name: "Okafor",
    phone: "+1 (555) 654-0987",
    email: "c.okafor@email.com",
    segment: "at_risk",
    vipTier: null,
    totalVisits: 9,
    lifetimeValue: 990,
    avgSpend: 110,
    lastVisit: "2024-11-05",
    firstVisit: "2024-04-15",
    daysSinceLastVisit: 73,
    noShows: 0,
    cancellations: 0,
    birthday: null,
    anniversary: null,
    allergies: [],
    dietary: [],
    preferences: { seating: null, zone: "patio", server: null, welcomeDrink: null },
    tags: ["at-risk", "was-regular"],
    vipScore: 55,
    churnRisk: "high",
    churnNote: "Visited regularly for 4 months, then stopped. Last 73 days -- needs re-engagement.",
    preferredDays: ["wednesday", "thursday"],
  },
  {
    id: "guest_020",
    name: "Petrov",
    phone: "+1 (555) 789-4321",
    email: "a.petrov@email.com",
    segment: "vip",
    vipTier: "silver",
    totalVisits: 18,
    lifetimeValue: 3960,
    avgSpend: 220,
    lastVisit: "2025-01-15",
    firstVisit: "2024-03-10",
    noShows: 0,
    cancellations: 0,
    birthday: "1982-07-22",
    anniversary: null,
    allergies: [{ type: "Eggs", severity: "mild" }],
    dietary: [],
    preferences: { seating: "booth", zone: "main", server: "Mike", welcomeDrink: "Negroni" },
    tags: ["vip", "high-value", "business-dinners"],
    vipScore: 88,
    churnRisk: "very_low",
    projectedAnnualValue: 5760,
    favoriteItems: [
      { name: "Negroni", frequency: 16, total: 18, percentage: 89 },
      { name: "Wagyu Steak", frequency: 12, total: 18, percentage: 67 },
      { name: "Tuna Tartare", frequency: 10, total: 18, percentage: 56 },
      { name: "Espresso Martini", frequency: 8, total: 18, percentage: 44 },
    ],
    avgPartySize: 3.8,
    preferredDays: ["tuesday", "thursday"],
    preferredTime: "19:00-19:30",
    location: "Manhattan, NY",
  },
]

// ── Sarah Chen's Visit History ──────────────────────────────────
export const sarahVisitHistory: VisitRecord[] = [
  { id: 12, date: "2025-01-17", dayOfWeek: "Friday", service: "Dinner", partySize: 4, table: "T12", zone: "Window", server: "Mike", status: "in_progress", total: 248.75, duration: null, items: ["Old Fashioned x2", "Burrata", "Tuna Tartare", "Ribeye", "Salmon", "Pasta Primavera", "Chicken"], note: null },
  { id: 11, date: "2025-01-03", dayOfWeek: "Friday", service: "Dinner", partySize: 3, table: "T7", zone: "Main", server: "Anna", status: "completed", total: 310, duration: "2h 05min", items: ["Old Fashioned", "Negroni", "Tasting Menu x2", "Ribeye", "Wine Pairing"], note: "Brought friend, recommended tasting menu" },
  { id: 10, date: "2024-12-20", dayOfWeek: "Saturday", service: "Dinner", partySize: 2, table: "T3", zone: "Window", server: "Mike", status: "completed", total: 245, duration: "1h 45min", items: ["Old Fashioned x2", "Burrata", "Ribeye", "Salmon", "Creme Brulee", "Espresso"], note: "Asked about private room for March birthday" },
  { id: 9, date: "2024-12-06", dayOfWeek: "Friday", service: "Dinner", partySize: 4, table: "T12", zone: "Window", server: "Mike", status: "completed", total: 285, duration: "1h 50min", items: ["Old Fashioned x2", "Martini x2", "Tuna Tartare", "Ribeye", "Chicken", "Pasta", "Creme Brulee x2"], note: null },
  { id: 8, date: "2024-11-22", dayOfWeek: "Friday", service: "Dinner", partySize: 2, table: "T12", zone: "Window", server: "Mike", status: "completed", total: 195, duration: "1h 30min", items: ["Old Fashioned", "Wine", "Burrata", "Ribeye", "Tiramisu"], note: null },
  { id: 7, date: "2024-11-08", dayOfWeek: "Friday", service: "Dinner", partySize: 4, table: "T3", zone: "Window", server: "Anna", status: "completed", total: 265, duration: "1h 55min", items: ["Old Fashioned x2", "Gin Tonic x2", "Tuna Tartare", "Burrata", "Ribeye", "Salmon", "Chicken", "Creme Brulee"], note: null },
  { id: 6, date: "2024-10-25", dayOfWeek: "Friday", service: "Dinner", partySize: 2, table: "T12", zone: "Window", server: "Mike", status: "completed", total: 210, duration: "1h 40min", items: ["Old Fashioned x2", "Tuna Tartare", "Ribeye", "Creme Brulee"], note: null },
  { id: 5, date: "2024-10-11", dayOfWeek: "Friday", service: "Dinner", partySize: 3, table: "T12", zone: "Window", server: "Mike", status: "completed", total: 230, duration: "1h 45min", items: ["Old Fashioned", "Negroni", "Burrata", "Ribeye", "Salmon", "Tiramisu"], note: null },
  { id: 4, date: "2024-09-27", dayOfWeek: "Friday", service: "Dinner", partySize: 2, table: "T3", zone: "Window", server: "Mike", status: "completed", total: 185, duration: "1h 35min", items: ["Old Fashioned x2", "Tuna Tartare", "Ribeye", "Espresso"], note: "Anniversary dinner with husband" },
  { id: 3, date: "2024-09-13", dayOfWeek: "Friday", service: "Dinner", partySize: 4, table: "T12", zone: "Window", server: "Anna", status: "completed", total: 275, duration: "2h 00min", items: ["Old Fashioned x2", "Wine x2", "Burrata", "Tuna Tartare", "Ribeye", "Chicken", "Salmon", "Creme Brulee x2"], note: null },
  { id: 2, date: "2024-08-30", dayOfWeek: "Friday", service: "Dinner", partySize: 2, table: "T7", zone: "Main", server: "Mike", status: "completed", total: 195, duration: "1h 30min", items: ["Old Fashioned", "Wine", "Tuna Tartare", "Ribeye", "Espresso"], note: null },
  { id: 1, date: "2024-08-12", dayOfWeek: "Monday", service: "Dinner", partySize: 2, table: "T5", zone: "Main", server: "Anna", status: "completed", total: 115, duration: "1h 20min", items: ["Old Fashioned", "Burrata", "Pasta Primavera"], note: "First visit, seemed impressed. Potential regular." },
]

// ── Sarah's Spend Chart Data ──────────────────────────────────
export const sarahSpendData = sarahVisitHistory.slice().reverse().map((v, i) => ({
  visit: i + 1,
  amount: v.total,
  date: v.date,
}))

// ── Sarah's Visit Frequency Data ──────────────────────────────
export const sarahFrequencyData = [
  { month: "Aug", visits: 2 },
  { month: "Sep", visits: 2 },
  { month: "Oct", visits: 2 },
  { month: "Nov", visits: 2 },
  { month: "Dec", visits: 2 },
  { month: "Jan", visits: 2 },
]

// ── Sarah's Communications ────────────────────────────────────
export const sarahCommunications: CommMessage[] = [
  { id: "c1", date: "2025-01-17 19:28", type: "sms", direction: "outbound", subject: "Table Ready", preview: "Hi Sarah, your table is ready!", status: "delivered" },
  { id: "c2", date: "2025-01-17 12:00", type: "sms", direction: "outbound", subject: "Reminder", preview: "Reminder: Tonight at 7:30 PM, party of 4", status: "read" },
  { id: "c3", date: "2025-01-15 14:32", type: "sms", direction: "outbound", subject: "Confirmation", preview: "Your reservation is confirmed for Friday, Jan 17 at 7:30 PM", status: "read", reply: "C" },
  { id: "c4", date: "2025-01-02 10:00", type: "email", direction: "outbound", subject: "Happy New Year", preview: "Happy New Year from Bella Vista! Start 2025 with our new winter tasting menu...", status: "opened" },
  { id: "c5", date: "2024-12-19 14:15", type: "sms", direction: "outbound", subject: "Confirmation", preview: "Your reservation is confirmed for Dec 20 at 7:30 PM", status: "read", reply: "C" },
  { id: "c6", date: "2024-12-10 11:00", type: "email", direction: "outbound", subject: "Holiday Specials", preview: "Join us for our festive holiday menu. Reserve your table today...", status: "opened" },
  { id: "c7", date: "2024-11-20 15:00", type: "sms", direction: "outbound", subject: "Confirmation", preview: "Your reservation is confirmed for Nov 22 at 7:00 PM", status: "read", reply: "C" },
  { id: "c8", date: "2024-10-23 14:00", type: "sms", direction: "outbound", subject: "Confirmation", preview: "Your reservation is confirmed for Oct 25 at 7:30 PM", status: "read", reply: "See you then!" },
]

// ── Sarah's Staff Notes ──────────────────────────────────────
export const sarahStaffNotes: StaffNote[] = [
  { id: "n1", author: "Mike", role: "Server", date: "2025-01-17", text: "Loved the new winter menu, asked about the truffle risotto. Hinted at hosting a birthday dinner in March." },
  { id: "n2", author: "Anna", role: "Server", date: "2025-01-03", text: "Brought a friend, recommended the tasting menu. Friend was impressed. Potential new regular." },
  { id: "n3", author: "Maria", role: "Host", date: "2024-12-20", text: "Asked about private room availability for March." },
  { id: "n4", author: "Mike", role: "Server", date: "2024-09-27", text: "Anniversary dinner. Husband surprised her with flowers. Comp'd a dessert." },
]

// ── Sarah's Smart Actions ─────────────────────────────────────
export const sarahSmartActions: SmartAction[] = [
  { id: "sa1", icon: "Gift", text: "Birthday (Mar 15) is in 57 days.", subtext: "She asked about the private room.", action: "Send Birthday Invite" },
  { id: "sa2", icon: "Sparkles", text: "She hasn't tried the new winter cocktails.", subtext: "High engagement — likely to appreciate a preview.", action: "Send New Menu Preview" },
  { id: "sa3", icon: "Heart", text: "Referred a friend on Jan 3.", subtext: "Potential new regular. Send a thank-you note?", action: "Send Thank You" },
]

// ── VIP Score Breakdown for Sarah ──────────────────────────────
export const sarahVipBreakdown = {
  frequency: 9,
  spend: 8,
  loyalty: 9,
  engagement: 8,
  reliability: 10,
}

// ── Revenue Impact Data ────────────────────────────────────────
export const sarahRevenueImpact = {
  annualRevenuePercent: 1.2,
  topGuestPercent: 3,
  avgVsRestaurant: 2.6,
  restaurantAvg: 85,
  projectedAnnual: 4752,
}

// ── Retention Risk ─────────────────────────────────────────────
export const sarahRetentionRisk = {
  level: "very_low" as const,
  visitFrequencyTrend: "stable_up",
  spendTrend: "increasing",
  lastVisit: "today",
  engagementRate: 92,
  churnProbability: 5,
}

// ── Helper Functions ───────────────────────────────────────────
export function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

export function getSegmentColor(segment: GuestSegment): string {
  switch (segment) {
    case "vip": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    case "regular": return "bg-blue-500/20 text-blue-300 border-blue-500/30"
    case "new": return "bg-zinc-500/20 text-zinc-300 border-zinc-500/30"
    case "at_risk": return "bg-amber-500/20 text-amber-300 border-amber-500/30"
    case "flagged": return "bg-rose-500/20 text-rose-300 border-rose-500/30"
  }
}

export function getAvatarColor(segment: GuestSegment): string {
  switch (segment) {
    case "vip": return "bg-emerald-600 text-emerald-50"
    case "regular": return "bg-blue-600 text-blue-50"
    case "new": return "bg-zinc-600 text-zinc-50"
    case "at_risk": return "bg-amber-600 text-amber-50"
    case "flagged": return "bg-rose-600 text-rose-50"
  }
}

export function getSegmentLabel(segment: GuestSegment): string {
  switch (segment) {
    case "vip": return "VIP"
    case "regular": return "Regular"
    case "new": return "New"
    case "at_risk": return "At Risk"
    case "flagged": return "Flagged"
  }
}

export function getRelativeDate(dateStr: string): string {
  const today = new Date("2025-01-17")
  const date = new Date(dateStr)
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${diffDays} days ago`
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`
}

export function getChurnColor(risk: ChurnRisk): string {
  switch (risk) {
    case "very_low": return "text-emerald-400"
    case "low": return "text-emerald-300"
    case "medium": return "text-amber-400"
    case "high": return "text-rose-400"
  }
}

export function getChurnLabel(risk: ChurnRisk): string {
  switch (risk) {
    case "very_low": return "Very Low"
    case "low": return "Low"
    case "medium": return "Medium"
    case "high": return "High"
  }
}

export type SortOption = "last_visit" | "total_visits" | "ltv" | "name" | "risk_score"
export type ViewMode = "list" | "cards"

export function sortGuests(list: GuestProfile[], sort: SortOption): GuestProfile[] {
  return [...list].sort((a, b) => {
    switch (sort) {
      case "last_visit": return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      case "total_visits": return b.totalVisits - a.totalVisits
      case "ltv": return b.lifetimeValue - a.lifetimeValue
      case "name": return a.name.localeCompare(b.name)
      case "risk_score": return b.vipScore - a.vipScore
    }
  })
}

export function filterBySegment(list: GuestProfile[], segment: GuestSegment | "all"): GuestProfile[] {
  if (segment === "all") return list
  return list.filter(g => g.segment === segment)
}

export function searchGuests(list: GuestProfile[], query: string): GuestProfile[] {
  if (!query.trim()) return list
  const q = query.toLowerCase()
  return list.filter(g =>
    g.name.toLowerCase().includes(q) ||
    g.phone.includes(q) ||
    (g.email && g.email.toLowerCase().includes(q)) ||
    g.tags.some(t => t.toLowerCase().includes(q))
  )
}
