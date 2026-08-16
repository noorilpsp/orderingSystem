// ── Types ────────────────────────────────────────────────────────────────────

import type { StoreTable } from "@/store/types"
import { formatMerchantMoney } from "@/lib/merchant-localization"

export type ItemStatus = "held" | "sent" | "cooking" | "ready" | "served" | "void"
export type WaveType = "drinks" | "food" | "dessert"
export type WaveStatus = "held" | "fired" | "preparing" | "ready" | "served"
export type TableStatus =
  | "available"
  | "seated"
  | "ordering"
  | "in_kitchen"
  | "food_ready"
  | "served"
  | "bill_requested"
  | "needs_attention"
export type Pacing = "quick" | "relaxed"

export interface OrderItem {
  id: string
  /** Menu item id when known; needed for addItemsToOrder sync. */
  menuItemId?: string
  name: string
  variant?: string
  mods?: string[]
  price: number
  status: ItemStatus
  wave: WaveType
  waveNumber?: number
  eta?: number
  allergyAlert?: boolean
}

export interface Seat {
  number: number
  dietary: string[]
  notes: string[]
  items: OrderItem[]
  /** From DB seats table when loading from session */
  guestName?: string | null
}

export interface Wave {
  id: string
  type: WaveType
  status: WaveStatus
  firedAt?: string
  servedAt?: string
  eta?: number
  items?: number
}

export interface TableNote {
  text: string
  icon: string
}

export interface ReturningGuest {
  name: string
  visits: number
  vip: boolean
  usualOrder: string[]
}

export interface Server {
  id: string
  name: string
  avatar: string
}

export interface Bill {
  subtotal: number
  tax: number
  total: number
}

export interface TableDetail {
  id: string
  /** Owning floor plan for /floor-map?floorplan= when returning from this table. */
  floorPlanId?: string | null
  number: number
  /** Max guests the table can seat. */
  capacity?: number
  shape: "rectangular" | "round" | "square"
  section: string
  server: Server | null
  seatedAt: string
  lastCheckIn: string
  guestCount: number
  status: TableStatus
  pacing: Pacing
  returningGuest: ReturningGuest | null
  notes: TableNote[]
  seats: Seat[]
  waves: Wave[]
  bill: Bill
}

// ── Config Maps ──────────────────────────────────────────────────────────────

export const dietaryIcons: Record<string, string> = {
  nut_allergy: "\u{1F95C}",
  vegetarian: "\u{1F331}",
  vegan: "\u{1F33F}",
  gluten_free: "\u{1F33E}",
  dairy_free: "\u{1F95B}",
  shellfish_allergy: "\u{1F990}",
}

export const statusConfig: Record<
  ItemStatus,
  { colorClass: string; label: string; pulse?: boolean; strike?: boolean }
> = {
  held: { colorClass: "text-muted-foreground", label: "Held" },
  sent: { colorClass: "text-blue-500", label: "New" },
  cooking: { colorClass: "text-amber-500", label: "Preparing" },
  ready: { colorClass: "text-red-500", label: "Ready", pulse: true },
  served: { colorClass: "text-emerald-500", label: "Served" },
  void: { colorClass: "text-muted-foreground", label: "Void", strike: true },
}

export const tableStatusConfig: Record<
  TableStatus,
  { colorClass: string; bgClass: string; label: string; pulse?: boolean }
> = {
  available: { colorClass: "text-muted-foreground", bgClass: "bg-muted/50", label: "Available" },
  seated: { colorClass: "text-emerald-600", bgClass: "bg-emerald-500/15", label: "Seated" },
  ordering: { colorClass: "text-amber-600", bgClass: "bg-amber-500/15", label: "Ordering" },
  in_kitchen: { colorClass: "text-orange-600", bgClass: "bg-orange-500/15", label: "In Kitchen" },
  food_ready: { colorClass: "text-red-600", bgClass: "bg-red-500/15", label: "Food Ready", pulse: true },
  served: { colorClass: "text-emerald-600", bgClass: "bg-emerald-500/15", label: "Served" },
  bill_requested: { colorClass: "text-violet-600", bgClass: "bg-violet-500/15", label: "Bill Requested" },
  needs_attention: { colorClass: "text-red-600", bgClass: "bg-red-500/15", label: "Needs Attention", pulse: true },
}

export const waveStatusConfig: Record<
  WaveStatus,
  { colorClass: string; label: string }
> = {
  held: { colorClass: "text-muted-foreground", label: "Held" },
  fired: { colorClass: "text-orange-500", label: "New" },
  preparing: { colorClass: "text-amber-500", label: "Preparing" },
  ready: { colorClass: "text-red-500", label: "Ready" },
  served: { colorClass: "text-emerald-500", label: "Served" },
}

export const waveIcons: Record<WaveType, string> = {
  drinks: "\u{1F377}",
  food: "\u{1F37D}\uFE0F",
  dessert: "\u{1F370}",
}

// ── Build TableDetail from store (single source of truth for table identity) ──

const SECTION_LABELS: Record<string, string> = {
  main: "Main Dining",
  patio: "Patio",
  bar: "Bar Area",
  private: "Private Room",
}

function mapStoreStatusToTableStatus(s: StoreTable["status"]): TableStatus {
  switch (s) {
    case "free":
    case "reserved":
    case "cleaning":
      return "available"
    case "active":
    case "urgent":
      return "seated"
    case "billing":
      return "bill_requested"
    case "closed":
      return "served"
    default:
      return "available"
  }
}

function mapStoreShapeToTableShape(s: StoreTable["shape"]): TableDetail["shape"] {
  if (s === "rectangle" || s === "booth") return "rectangular"
  if (s === "round") return "round"
  return "square"
}

function cloneOrderItems(items: NonNullable<StoreTable["session"]>["tableItems"]): OrderItem[] {
  return items.map((item) => ({
    ...item,
    mods: item.mods ? [...item.mods] : undefined,
  }))
}

function cloneSeats(seats: NonNullable<StoreTable["session"]>["seats"]): Seat[] {
  return seats.map((seat) => ({
    number: seat.number,
    dietary: [...seat.dietary],
    notes: [...seat.notes],
    items: cloneOrderItems(seat.items),
    ...(seat.guestName != null && { guestName: seat.guestName }),
  }))
}

/** Build TableDetail from StoreTable so table detail page uses central store data. Seats array length = store capacity (empty order seats). No mock merge. */
export function buildTableDetailFromStore(st: StoreTable): TableDetail {
  const session = st.session ?? null
  const capacity = Math.max(1, st.capacity)
  const fallbackSeats: Seat[] = Array.from({ length: capacity }, (_, i) => ({
    number: i + 1,
    dietary: [],
    notes: [],
    items: [],
  }))
  const seats = session?.seats?.length ? cloneSeats(session.seats) : fallbackSeats
  return {
    id: st.id,
    number: st.number,
    capacity,
    shape: mapStoreShapeToTableShape(st.shape),
    section: SECTION_LABELS[st.section] ?? st.section,
    server:
      st.serverId && st.serverName
        ? { id: st.serverId, name: st.serverName, avatar: "👤" }
        : null,
    seatedAt: st.seatedAt ?? "",
    lastCheckIn: session?.lastCheckIn ?? st.seatedAt ?? "",
    guestCount: session?.guestCount ?? st.guests ?? 0,
    status: session?.status ?? mapStoreStatusToTableStatus(st.status),
    pacing: session?.pacing ?? "quick",
    returningGuest: null,
    notes: session?.notes?.map((note) => ({ ...note })) ?? [],
    seats,
    waves: [],
    bill: session?.bill ? { ...session.bill } : { subtotal: 0, tax: 0, total: 0 },
  }
}

// ── Mock Data ────────────────────────────────────────────────────────────────

const allTables: Record<string, TableDetail> = {
  t1: {
    id: "t1",
    number: 1,
    shape: "round",
    section: "A",
    server: null,
    seatedAt: undefined,
    lastCheckIn: undefined,
    guestCount: 0,
    status: "available",
    pacing: "quick",
    returningGuest: null,
    notes: [],
    seats: [],
    waves: [],
    bill: {
      subtotal: 0,
      tax: 0,
      total: 0,
    },
  },
  t2: {
    id: "t2",
    number: 2,
    shape: "round",
    section: "A",
    server: { id: "s2", name: "Marcus", avatar: "👨" },
    seatedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    lastCheckIn: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    guestCount: 2,
    status: "ordering",
    pacing: "quick",
    returningGuest: null,
    notes: [],
    seats: [
      {
        number: 1,
        dietary: ["vegetarian"],
        notes: [],
        items: [
          { id: "i1", name: "Water", price: 0, status: "served", wave: "drinks" },
        ],
      },
      {
        number: 2,
        dietary: [],
        notes: [],
        items: [
          { id: "i2", name: "Coffee", price: 3.5, status: "served", wave: "drinks" },
        ],
      },
    ],
    waves: [
      { id: "w1", type: "drinks", status: "served", firedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
    ],
    bill: {
      subtotal: 3.5,
      tax: 0.35,
      total: 3.85,
    },
  },
  t3: {
    id: "t3",
    number: 3,
    shape: "square",
    section: "B",
    server: { id: "s1", name: "Sarah", avatar: "👩‍🦰" },
    seatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    lastCheckIn: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    guestCount: 6,
    status: "needs_attention",
    pacing: "relaxed",
    returningGuest: null,
    notes: [
      { text: "Large party - split check needed", icon: "💳" },
      { text: "No rush, anniversary dinner", icon: "💕" },
    ],
    seats: [
      {
        number: 1,
        dietary: [],
        notes: [],
        items: [
          { id: "i1", name: "Wine Glass", variant: "Merlot", price: 14, status: "served", wave: "drinks" },
          { id: "i2", name: "Lobster Bisque", price: 16, status: "served", wave: "food" },
          { id: "i3", name: "Filet Mignon", variant: "Medium rare", price: 48, status: "served", wave: "food" },
        ],
      },
      {
        number: 2,
        dietary: ["gluten_free"],
        notes: [],
        items: [
          { id: "i4", name: "Champagne", price: 18, status: "served", wave: "drinks" },
          { id: "i5", name: "Caprese Salad", mods: ["-GF"], price: 12, status: "served", wave: "food" },
          { id: "i6", name: "Sea Bass", price: 38, status: "served", wave: "food" },
        ],
      },
      {
        number: 3,
        dietary: [],
        notes: [],
        items: [
          { id: "i7", name: "Beer", price: 7, status: "served", wave: "drinks" },
          { id: "i8", name: "Wings", price: 14, status: "served", wave: "food" },
        ],
      },
      {
        number: 4,
        dietary: ["vegan"],
        notes: [],
        items: [
          { id: "i9", name: "Soda", price: 3, status: "served", wave: "drinks" },
          { id: "i10", name: "Vegan Burger", mods: ["-Vegan"], price: 18, status: "served", wave: "food" },
        ],
      },
      {
        number: 5,
        dietary: [],
        notes: ["Kids meal"],
        items: [
          { id: "i11", name: "Juice", price: 3, status: "served", wave: "drinks" },
          { id: "i12", name: "Chicken Nuggets", price: 9, status: "served", wave: "food" },
        ],
      },
      {
        number: 6,
        dietary: [],
        notes: ["Kids meal"],
        items: [
          { id: "i13", name: "Milk", price: 2.5, status: "served", wave: "drinks" },
          { id: "i14", name: "Mac & Cheese", price: 8, status: "served", wave: "food" },
        ],
      },
    ],
    waves: [
      { id: "w1", type: "drinks", status: "served", firedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 38 * 60 * 1000).toISOString() },
      { id: "w2", type: "food", status: "served", firedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
      { id: "w3", type: "dessert", status: "held", items: 6 },
    ],
    bill: {
      subtotal: 210.5,
      tax: 21.05,
      total: 231.55,
    },
  },
  t5: {
    id: "t5",
    number: 5,
    shape: "rectangular",
    section: "C",
    server: { id: "s3", name: "Alex", avatar: "🧑" },
    seatedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    lastCheckIn: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    guestCount: 2,
    status: "in_kitchen",
    pacing: "quick",
    returningGuest: {
      name: "Lisa K.",
      visits: 15,
      vip: true,
      usualOrder: ["Sushi platter", "Green tea"],
    },
    notes: [
      { text: "VIP regular - comp appetizer", icon: "⭐" },
    ],
    seats: [
      {
        number: 1,
        dietary: ["shellfish_allergy"],
        notes: ["SEVERE allergy - NO shellfish cross-contamination"],
        items: [
          { id: "i1", name: "Green Tea", price: 0, status: "served", wave: "drinks" },
          { id: "i2", name: "Edamame", mods: ["-NO shellfish (COMP)"], price: 0, status: "served", wave: "food" },
          { id: "i3", name: "Vegetable Roll", mods: ["-ALLERGY ALERT"], price: 12, status: "cooking", wave: "food", eta: 8, allergyAlert: true },
          { id: "i4", name: "Tofu Teriyaki", price: 18, status: "cooking", wave: "food", eta: 8 },
        ],
      },
      {
        number: 2,
        dietary: [],
        notes: [],
        items: [
          { id: "i5", name: "Sake", price: 12, status: "served", wave: "drinks" },
          { id: "i6", name: "Miso Soup", price: 0, status: "served", wave: "food" },
          { id: "i7", name: "Sushi Platter", variant: "Deluxe", price: 38, status: "cooking", wave: "food", eta: 8 },
        ],
      },
    ],
    waves: [
      { id: "w1", type: "drinks", status: "served", firedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 13 * 60 * 1000).toISOString() },
      { id: "w2", type: "food", status: "preparing", firedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), eta: 8 },
    ],
    bill: {
      subtotal: 80,
      tax: 8,
      total: 88,
    },
  },
  t7: {
    id: "t7",
    number: 7,
    shape: "round",
    section: "A",
    server: { id: "s2", name: "Marcus", avatar: "👨" },
    seatedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    lastCheckIn: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    guestCount: 2,
    status: "bill_requested",
    pacing: "relaxed",
    returningGuest: null,
    notes: [],
    seats: [
      {
        number: 1,
        dietary: [],
        notes: [],
        items: [
          { id: "i1", name: "Espresso", price: 3.5, status: "served", wave: "drinks" },
          { id: "i2", name: "Bruschetta", price: 11, status: "served", wave: "food" },
          { id: "i3", name: "Margherita Pizza", price: 16, status: "served", wave: "food" },
          { id: "i4", name: "Gelato", variant: "Pistachio", price: 8, status: "served", wave: "dessert" },
        ],
      },
      {
        number: 2,
        dietary: [],
        notes: [],
        items: [
          { id: "i5", name: "Limoncello", price: 9, status: "served", wave: "drinks" },
          { id: "i6", name: "Arancini", price: 10, status: "served", wave: "food" },
          { id: "i7", name: "Carbonara", price: 19, status: "served", wave: "food" },
          { id: "i8", name: "Tiramisu", price: 9, status: "served", wave: "dessert" },
        ],
      },
    ],
    waves: [
      { id: "w1", type: "drinks", status: "served", firedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 48 * 60 * 1000).toISOString() },
      { id: "w2", type: "food", status: "served", firedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      { id: "w3", type: "dessert", status: "served", firedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
    ],
    bill: {
      subtotal: 85.5,
      tax: 8.55,
      total: 94.05,
    },
  },
  t10: {
    id: "t10",
    number: 10,
    shape: "rectangular",
    section: "B",
    server: { id: "s3", name: "Alex", avatar: "🧑" },
    seatedAt: new Date(Date.now() - 62 * 60 * 1000).toISOString(),
    lastCheckIn: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    guestCount: 5,
    status: "in_kitchen",
    pacing: "relaxed",
    returningGuest: {
      name: "Nora V.",
      visits: 21,
      vip: true,
      usualOrder: ["Sparkling Water", "Seabass", "Panna Cotta"],
    },
    notes: [
      { text: "Tasting menu demo table", icon: "🧪" },
      { text: "Seat 2 nut allergy, Seat 4 gluten-free", icon: "⚠️" },
      { text: "Mixed timing: kids + VIP pacing", icon: "🕒" },
    ],
    seats: [
      {
        number: 1,
        dietary: [],
        notes: ["Host seat"],
        items: [
          { id: "t10-demo-held", name: "Demo Held Item", mods: ["Status Demo"], price: 5, status: "held", wave: "food", waveNumber: 6 },
          { id: "t10-demo-new", name: "Demo New Item", mods: ["Status Demo"], price: 5, status: "sent", wave: "food", waveNumber: 3 },
          { id: "t10-demo-preparing", name: "Demo Preparing Item", mods: ["Status Demo"], price: 5, status: "cooking", wave: "food", waveNumber: 4, eta: 5 },
          { id: "t10-demo-ready", name: "Demo Ready Item", mods: ["Status Demo"], price: 5, status: "ready", wave: "food", waveNumber: 5, eta: 1 },
          { id: "t10-demo-served", name: "Demo Served Item", mods: ["Status Demo"], price: 5, status: "served", wave: "food", waveNumber: 2 },
          { id: "t10-i1", name: "Sparkling Water", price: 4, status: "served", wave: "drinks", waveNumber: 1, mods: ["Wave 1"] },
          { id: "t10-i2", name: "Oyster Trio", mods: ["+ Lemon", "+ Tabasco"], price: 18, status: "served", wave: "food", waveNumber: 2, },
          { id: "t10-i3", name: "Truffle Pasta", mods: ["+ Parmesan"], price: 27, status: "ready", wave: "food", waveNumber: 5, eta: 2 },
          { id: "t10-i4", name: "Affogato", price: 11, status: "held", wave: "dessert", waveNumber: 6 },
        ],
      },
      {
        number: 2,
        dietary: ["nut_allergy"],
        notes: ["Severe nut allergy"],
        items: [
          { id: "t10-i5", name: "Virgin Mojito", price: 9, status: "served", wave: "drinks", waveNumber: 1 },
          { id: "t10-i6", name: "Tomato Carpaccio", mods: ["- NO pesto (ALLERGY)"], price: 16, status: "served", wave: "food", waveNumber: 2, allergyAlert: true },
          { id: "t10-i7", name: "Sea Bass", mods: ["- NO almond crust"], price: 36, status: "cooking", wave: "food", waveNumber: 4, allergyAlert: true, eta: 6 },
          { id: "t10-i8", name: "Berry Sorbet", price: 9, status: "held", wave: "dessert", waveNumber: 6 },
        ],
      },
      {
        number: 3,
        dietary: [],
        notes: ["Business guest, quick pace"],
        items: [
          { id: "t10-i9", name: "Espresso", price: 3.5, status: "served", wave: "drinks", waveNumber: 1 },
          { id: "t10-i10", name: "Tuna Tartare", mods: ["+ Avocado"], price: 19, status: "served", wave: "food", waveNumber: 2 },
          { id: "t10-i11", name: "Ribeye", variant: "Medium Rare", mods: ["+ Peppercorn"], price: 42, status: "sent", wave: "food", waveNumber: 3 },
          { id: "t10-i12", name: "Chocolate Fondant", price: 12, status: "held", wave: "dessert", waveNumber: 7 },
        ],
      },
      {
        number: 4,
        dietary: ["gluten_free"],
        notes: ["Gluten-free only"],
        items: [
          { id: "t10-i13", name: "Still Water", price: 0, status: "served", wave: "drinks", waveNumber: 1 },
          { id: "t10-i14", name: "Burrata Salad", mods: ["- Croutons (GF)"], price: 15, status: "served", wave: "food", waveNumber: 2 },
          { id: "t10-i15", name: "GF Risotto", mods: ["+ Mushrooms"], price: 24, status: "ready", wave: "food", waveNumber: 5, eta: 1 },
          { id: "t10-i16", name: "Panna Cotta", price: 10, status: "held", wave: "dessert", waveNumber: 7 },
        ],
      },
      {
        number: 5,
        dietary: [],
        notes: ["Child seat"],
        items: [
          { id: "t10-i17", name: "Apple Juice", price: 3, status: "served", wave: "drinks", waveNumber: 1 },
          { id: "t10-i18", name: "Fries", mods: ["+ Ketchup"], price: 7, status: "served", wave: "food", waveNumber: 2 },
          { id: "t10-i19", name: "Mini Burger", mods: ["- Onion"], price: 13, status: "cooking", wave: "food", waveNumber: 5, eta: 4 },
          { id: "t10-i20", name: "Ice Cream", variant: "Vanilla", price: 6, status: "held", wave: "dessert", waveNumber: 6 },
        ],
      },
    ],
    waves: [
      { id: "w1", type: "drinks", status: "served", firedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(), items: 5 },
      { id: "w2", type: "food", status: "served", firedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), servedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), items: 5 },
      { id: "w3", type: "food", status: "fired", firedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), items: 1 },
      { id: "w4", type: "food", status: "preparing", firedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(), eta: 6, items: 2 },
      { id: "w5", type: "food", status: "ready", firedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(), eta: 1, items: 2 },
      { id: "w6", type: "dessert", status: "held", items: 3 },
      { id: "w7", type: "dessert", status: "held", items: 2 },
    ],
    bill: {
      subtotal: 341.5,
      tax: 34.15,
      total: 375.65,
    },
  },
  t12: {
    id: "t12",
    number: 12,
    shape: "rectangular",
    section: "A",
    server: { id: "s1", name: "Sarah", avatar: "👩‍🦰" },
    seatedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    lastCheckIn: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    guestCount: 4,
    status: "food_ready",
    pacing: "relaxed",
    returningGuest: {
      name: "John M.",
      visits: 8,
      vip: true,
      usualOrder: ["Ribeye", "Red wine"],
    },
    notes: [
      { text: "Birthday celebration", icon: "🎂" },
      { text: "Seat 3 is birthday girl - bring candle with dessert", icon: "📝" },
    ],
    seats: [
      {
        number: 1,
        dietary: [],
        notes: [],
        items: [
          { id: "i1", name: "Caesar Salad", mods: ["+Extra parmesan"], price: 14, status: "served", wave: "food" },
          { id: "i2", name: "Ribeye Steak", variant: "Medium", mods: ["+Peppercorn sauce"], price: 32, status: "cooking", wave: "food", eta: 5 },
          { id: "i3", name: "Coke", price: 3.5, status: "served", wave: "drinks" },
          { id: "i4", name: "Tiramisu", price: 12, status: "held", wave: "dessert" },
        ],
      },
      {
        number: 2,
        dietary: ["nut_allergy"],
        notes: ["Prefers window side"],
        items: [
          { id: "i5", name: "Pasta Carbonara", mods: ["-NO nuts (ALLERGY)"], price: 22, status: "ready", wave: "food", allergyAlert: true },
          { id: "i6", name: "Glass of Chianti", price: 12, status: "served", wave: "drinks" },
        ],
      },
      {
        number: 3,
        dietary: [],
        notes: ["Birthday girl 🎂"],
        items: [
          { id: "i7", name: "Salmon", price: 28, status: "ready", wave: "food" },
          { id: "i8", name: "Sparkling Water", price: 4, status: "served", wave: "drinks" },
          { id: "i9", name: "Panna Cotta", price: 10, status: "held", wave: "dessert" },
        ],
      },
      {
        number: 4,
        dietary: [],
        notes: [],
        items: [
          { id: "i10", name: "Burger", mods: ["+Bacon", "+Cheese"], price: 18, status: "cooking", wave: "food", eta: 3 },
          { id: "i11", name: "Beer", price: 7, status: "served", wave: "drinks" },
        ],
      },
    ],
    waves: [
      { id: "w1", type: "drinks", status: "served", firedAt: "2026-01-25T19:45:00Z", servedAt: "2026-01-25T19:48:00Z" },
      { id: "w2", type: "food", status: "preparing", firedAt: "2026-01-25T19:52:00Z", eta: 5 },
      { id: "w3", type: "dessert", status: "held", items: 2 },
    ],
    bill: {
      subtotal: 162.5,
      tax: 16.25,
      total: 178.75,
    },
  },
}

export const tableDetail = allTables.t12

export function getTableById(id: string): TableDetail {
  return allTables[id.toLowerCase()] || allTables.t12
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function minutesAgo(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000)
}

export function formatCurrency(
  amount: number,
  currency: string = "EUR",
  numberFormat?: string | null,
): string {
  return formatMerchantMoney(amount, { currency, numberFormat })
}

export function getSeatTotal(seat: Seat): number {
  return seat.items
    .filter((i) => i.status !== "void")
    .reduce((sum, i) => sum + i.price, 0)
}

export function getReadyItems(seats: Seat[]): OrderItem[] {
  return seats.flatMap((s) =>
    s.items.filter((i) => i.status === "ready")
  )
}

export function getSeatForItem(seats: Seat[], itemId: string): Seat | undefined {
  return seats.find((s) => s.items.some((i) => i.id === itemId))
}
