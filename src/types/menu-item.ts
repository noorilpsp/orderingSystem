import type { CatalogI18n } from "@/lib/catalog-i18n"

export interface MenuItem {
  id: string
  name: string
  description?: string
  /** Optional Arabic (etc.) overrides for guest menu. */
  i18n?: CatalogI18n | null
  price: number
  currency: string
  image?: string
  status: "live" | "draft" | "hidden" | "soldout"
  categories: string[]
  /** Per-category item order from `category_items.display_order`. */
  categoryOrders?: Record<string, number>
  tags: string[]
  dietaryTags: string[]
  customizationGroups: string[]
  availabilityMode: "menu-hours" | "custom"
  customSchedule?: Array<{
    days: number[]
    startTime: string
    endTime: string
  }>
  soldOutUntil?: Date | null
  nutrition?: {
    calories?: number
    allergens?: string[]
  }
  /** KDS prep station key from active location_stations. Used for routing order items to KDS tabs. */
  defaultStation?: string | null
  /** Kitchen lane/substation (grill, fryer, cold_prep). Only used when defaultStation is kitchen. */
  defaultSubstation?: string | null
  /** Show on guest menu Featured strip when live. */
  featured?: boolean
  // Legacy fields for backward compatibility
  category?: string
  categoryId?: string
  customizationCount?: number
}

export interface Category {
  id: string
  name: string
  emoji?: string
  itemCount: number
  /** Overview / legacy ordering field (distinct from dashboard `displayOrder`). */
  order: number
  isExpanded: boolean
  i18n?: CatalogI18n | null
}
