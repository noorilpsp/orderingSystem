import { formatMerchantMoney } from "@/lib/merchant-localization"

export interface Seat {
  number: number
  dietary: string[]
  notes?: string[]
  items: number
  total: number
}

export interface MenuOption {
  name: string
  required: boolean
  choices: (string | { name: string; price: number })[]
}

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  compareAtPrice?: number | null
  promoKind?: "sale_price" | "bogo" | null
  promoDisplayOrder?: number
  category: string
  image: string
  dietary: string[]
  options: MenuOption[]
  extras?: { name: string; price: number }[]
  available: boolean
  stockStatus?: "low" | "sold_out"
  stockCount?: number
}

export interface OrderItem {
  id: string
  menuItemId: string
  name: string
  seat: number
  quantity: number
  options: Record<string, string>
  extras: string[]
  notes: string
  price: number
  wave: "drinks" | "food"
}

export interface Category {
  id: string
  name: string
  icon: string
}

export const dietaryIcons: Record<
  string,
  { icon: string; label: string }
> = {
  vegetarian: { icon: "🌱", label: "Vegetarian" },
  vegan: { icon: "🌿", label: "Vegan" },
  gluten_free: { icon: "🌾", label: "Gluten Free" },
  contains_nuts: { icon: "🥜", label: "Contains Nuts" },
  dairy_free: { icon: "🥛", label: "Dairy Free" },
  nut_allergy: { icon: "🥜", label: "Nut Allergy" },
}

export const takeOrderData = {
  table: {
    id: "t12",
    number: 12,
  },

  seats: [
    { number: 1, dietary: [], items: 1, total: 40.0 },
    {
      number: 2,
      dietary: ["nut_allergy"],
      items: 2,
      total: 26.0,
    },
    {
      number: 3,
      dietary: [],
      notes: ["Birthday girl 🎂"],
      items: 0,
      total: 0,
    },
    { number: 4, dietary: [], items: 1, total: 18.0 },
  ] as Seat[],

  selectedSeat: 2,

  categories: [
    { id: "drinks", name: "Drinks", icon: "🍹" },
    { id: "starters", name: "Starters", icon: "🥗" },
    { id: "mains", name: "Mains", icon: "🍽️" },
    { id: "desserts", name: "Desserts", icon: "🍰" },
    { id: "shisha", name: "Shisha", icon: "🌿" },
  ] as Category[],

  menuItems: [
    {
      id: "m1",
      name: "Caesar Salad",
      description: "Crisp romaine, parmesan, croutons",
      price: 14.0,
      category: "starters",
      image: "/placeholder-salad.jpg",
      dietary: ["vegetarian"],
      options: [],
      available: true,
    },
    {
      id: "m2",
      name: "Ribeye Steak",
      description: "Grilled to perfection with seasonal sides",
      price: 32.0,
      category: "mains",
      image: "/placeholder-steak.jpg",
      dietary: [],
      options: [
        {
          name: "Cooking Temperature",
          required: true,
          choices: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
        },
        {
          name: "Sauce",
          required: false,
          choices: [
            { name: "Peppercorn", price: 2 },
            { name: "Mushroom", price: 2 },
            { name: "Béarnaise", price: 3 },
            { name: "No sauce", price: 0 },
          ],
        },
      ],
      extras: [
        { name: "Extra mushrooms", price: 3 },
        { name: "Side salad", price: 4 },
        { name: "Onion rings", price: 3 },
      ],
      available: true,
    },
    {
      id: "m3",
      name: "Pasta Carbonara",
      description: "Classic Italian with pancetta and egg",
      price: 22.0,
      category: "mains",
      image: "/placeholder-pasta.jpg",
      dietary: ["contains_nuts"],
      options: [],
      available: true,
    },
    {
      id: "m4",
      name: "Salmon",
      description: "Pan-seared with lemon butter",
      price: 28.0,
      category: "mains",
      image: "/placeholder-salmon.jpg",
      dietary: [],
      options: [],
      available: false,
      stockStatus: "sold_out" as const,
    },
    {
      id: "m5",
      name: "Burger",
      description: "Angus beef, brioche bun, fries",
      price: 18.0,
      category: "mains",
      image: "/placeholder-burger.jpg",
      dietary: [],
      options: [
        {
          name: "Cook",
          required: true,
          choices: ["Medium", "Well Done"],
        },
      ],
      extras: [
        { name: "Bacon", price: 2 },
        { name: "Cheese", price: 1 },
        { name: "Egg", price: 2 },
      ],
      available: true,
      stockStatus: "low" as const,
      stockCount: 3,
    },
    {
      id: "m6",
      name: "Coke",
      description: "",
      price: 4.0,
      category: "drinks",
      image: "/placeholder-coke.jpg",
      dietary: [],
      options: [],
      available: true,
    },
    {
      id: "m7",
      name: "Tiramisu",
      description: "Classic Italian dessert",
      price: 12.0,
      category: "desserts",
      image: "/placeholder-tiramisu.jpg",
      dietary: ["contains_nuts"],
      options: [],
      available: true,
    },
    {
      id: "m8",
      name: "Mojito",
      description: "Fresh mint, lime, rum",
      price: 10.0,
      category: "drinks",
      image: "/placeholder-mojito.jpg",
      dietary: [],
      options: [],
      available: true,
    },
  ] as MenuItem[],

  currentOrder: {
    items: [
      {
        id: "o1",
        menuItemId: "m2",
        name: "Ribeye Steak",
        seat: 1,
        quantity: 1,
        options: { "Cooking Temperature": "Medium", Sauce: "Mushroom" },
        extras: ["Onion rings"],
        notes: "Extra crispy please",
        price: 40.0,
        wave: "food" as const,
      },
      {
        id: "o2",
        menuItemId: "m3",
        name: "Pasta Carbonara",
        seat: 2,
        quantity: 1,
        options: {},
        extras: [],
        notes: "NO NUTS - allergy",
        price: 22.0,
        wave: "food" as const,
      },
      {
        id: "o3",
        menuItemId: "m6",
        name: "Coke",
        seat: 2,
        quantity: 1,
        options: {},
        extras: [],
        notes: "",
        price: 4.0,
        wave: "drinks" as const,
      },
      {
        id: "o4",
        menuItemId: "m5",
        name: "Burger",
        seat: 4,
        quantity: 1,
        options: { Cook: "Medium" },
        extras: ["Bacon", "Cheese"],
        notes: "",
        price: 21.0,
        wave: "food" as const,
      },
    ] as OrderItem[],
    subtotal: 87.0,
    tax: 8.7,
    total: 95.7,
  },
}

export function formatCurrency(
  amount: number,
  currency: string = "EUR",
  numberFormat?: string | null,
): string {
  return formatMerchantMoney(amount, { currency, numberFormat })
}

export function hasAllergyConflict(
  item: MenuItem,
  seatDietary: string[]
): boolean {
  if (seatDietary.includes("nut_allergy") && item.dietary.includes("contains_nuts")) {
    return true
  }
  return false
}

export function getSeatItems(items: OrderItem[], seatNumber: number): OrderItem[] {
  return items.filter((item) => item.seat === seatNumber)
}

export function calculateOrderTotals(items: OrderItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax
  return { subtotal, tax, total }
}
