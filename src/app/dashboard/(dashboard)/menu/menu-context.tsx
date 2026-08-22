"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { MenuItem } from "@/types/menu-item"
import type { Category } from "@/types/category"
import type {
  CreateCustomizationGroupInput,
  CreatedCustomizationGroup,
  CustomizationGroup,
} from "@/types/customization"
import type { Menu } from "@/types/menu"
import type { ImportRow, ImportOptions } from "@/lib/menu/import-items"
import type {
  CustomizationImportGroup,
  CustomizationImportOptions,
} from "@/lib/menu/import-customizations"
import type {
  CategoryImportRow,
  CategoryImportOptions,
} from "@/lib/menu/import-categories"
import { toast } from "sonner"
import { useLocation } from "@/lib/contexts/LocationContext"
import { normalizeCatalogI18n } from "@/lib/catalog-i18n"

function formatMenuMutationError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes("failed query") ||
    lower.includes("fetch failed") ||
    lower.includes("etimedout") ||
    lower.includes("database connection timed out")
  ) {
    return "Database connection timed out. Please try again."
  }
  return message
}

interface MenuContextType {
  // State
  items: MenuItem[]
  categories: Category[]
  customizationGroups: CustomizationGroup[]
  menus: Menu[]
  tags: Array<{ id: string; name: string; emoji?: string | null }>
  allergens: Array<{ id: string; name: string; emoji?: string | null }>
  loading: boolean
  error: string | null
  locationId: string | null
  locations: Array<{ id: string; name: string }>
  setLocationId: (id: string) => void

  // Items CRUD
  createItem: (item: Partial<MenuItem>) => Promise<void>
  updateItem: (id: string, updates: Partial<MenuItem>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  bulkUpdateItems: (ids: string[], updates: Partial<MenuItem>) => Promise<void>
  bulkDeleteItems: (ids: string[]) => Promise<void>
  reorderItems: (items: MenuItem[], categoryId?: string) => Promise<void>
  importItems: (
    rows: ImportRow[],
    options: ImportOptions,
  ) => Promise<{
    created: number
    skipped: number
    categoriesCreated: string[]
    errors: Array<{ row: number; field?: string; message: string }>
  }>
  importCustomizationGroups: (
    groups: CustomizationImportGroup[],
    options: CustomizationImportOptions,
  ) => Promise<{
    created: number
    skipped: number
    errors: Array<{ row: number; field?: string; message: string }>
  }>
  importCategories: (
    rows: CategoryImportRow[],
    options: CategoryImportOptions,
  ) => Promise<{
    created: number
    skipped: number
    errors: Array<{ row: number; field?: string; message: string }>
  }>

  // Categories CRUD
  createCategory: (category: Omit<Category, "id" | "itemCount">) => Promise<void>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  reorderCategories: (categories: Category[]) => Promise<void>

  // Customization Groups CRUD
  createCustomizationGroup: (
    group: CreateCustomizationGroupInput,
    options?: { silent?: boolean },
  ) => Promise<CreatedCustomizationGroup | null>
  updateCustomizationGroup: (id: string, updates: Partial<CustomizationGroup>) => Promise<void>
  deleteCustomizationGroup: (id: string) => Promise<void>
  duplicateCustomizationGroup: (id: string) => Promise<void>

  // Menus CRUD
  createMenu: (menu: Omit<Menu, "id" | "categoryCount" | "itemCount">) => Promise<void>
  updateMenu: (id: string, updates: Partial<Menu>) => Promise<void>
  deleteMenu: (id: string) => Promise<void>
  toggleMenuActive: (id: string) => Promise<void>
  duplicateMenu: (id: string) => Promise<void>

  // Refresh data
  refetch: () => Promise<void>

  // Tag/allergen helpers
  addTag: (tag: { id: string; name: string; emoji?: string | null }) => void
  addAllergen: (allergen: { id: string; name: string; emoji?: string | null }) => void
}

const MenuContext = createContext<MenuContextType | undefined>(undefined)

// Helper to normalize time to "HH:MM" format (24-hour)
function normalizeTime(time: string | number | undefined | null): string {
  if (!time && time !== 0) return "00:00"
  
  // Handle if time is a number (e.g., 7 or 700 or 0700)
  if (typeof time === 'number') {
    const str = String(time).padStart(4, '0')
    return `${str.slice(0, 2)}:${str.slice(2)}`
  }
  
  const timeStr = String(time).trim()
  
  // If it's just hours (e.g., "7" or "07")
  if (!timeStr.includes(':')) {
    return `${timeStr.padStart(2, '0')}:00`
  }
  
  // Ensure proper padding
  const [hours, minutes] = timeStr.split(':')
  return `${hours.padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}`
}

// Helper to convert 24-hour time to 12-hour format for UI (e.g., "07:00" -> "7:00 AM")
function to12HourFormat(time24: string): string {
  if (!time24) return "12:00 AM"
  
  const [hoursStr, minutesStr] = time24.split(':')
  let hours = parseInt(hoursStr, 10)
  const minutes = minutesStr || '00'
  
  if (isNaN(hours)) return "12:00 AM"
  
  const period = hours >= 12 ? "PM" : "AM"
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  
  return `${displayHours}:${minutes} ${period}`
}

// Helper function to convert database schedule to UI schedule
function dbScheduleToUISchedule(schedule: any): Array<{ days: number[]; startTime: string; endTime: string }> {
  if (!schedule || typeof schedule !== 'object') return []
  
  const dayMap: { [key: string]: number } = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }

  const result: Array<{ days: number[]; startTime: string; endTime: string }> = []
  const timeBlocks: { [key: string]: Array<{ open: string; close: string }> } = {}

  // Group time blocks by time ranges
  Object.entries(schedule).forEach(([day, blocks]: [string, any]) => {
    if (Array.isArray(blocks)) {
      blocks.forEach((block: { open: string; close: string }) => {
        const normalizedOpen = normalizeTime(block.open)
        const normalizedClose = normalizeTime(block.close)
        const key = `${normalizedOpen}-${normalizedClose}`
        if (!timeBlocks[key]) {
          timeBlocks[key] = []
        }
        timeBlocks[key].push({ day, open: normalizedOpen, close: normalizedClose })
      })
    }
  })

  // Convert grouped blocks to UI format
  Object.values(timeBlocks).forEach((blocks) => {
    if (blocks.length > 0) {
      const days = blocks.map((b: any) => dayMap[b.day]).filter((d) => d !== undefined)
      if (days.length > 0) {
        result.push({
          days,
          startTime: to12HourFormat(blocks[0].open),
          endTime: to12HourFormat(blocks[0].close),
        })
      }
    }
  })

  return result
}

// Helper to convert 12-hour time to 24-hour format for DB (e.g., "7:00 AM" -> "07:00")
function to24HourFormat(time12: string): string {
  if (!time12) return "00:00"
  
  // If already in 24-hour format, return as-is
  if (!time12.includes('AM') && !time12.includes('PM')) {
    return normalizeTime(time12)
  }
  
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return "00:00"
  
  let hours = parseInt(match[1], 10)
  const minutes = match[2]
  const period = match[3].toUpperCase()
  
  if (period === 'AM') {
    if (hours === 12) hours = 0
  } else { // PM
    if (hours !== 12) hours += 12
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`
}

// Helper function to convert UI schedule to database schedule
function uiScheduleToDbSchedule(schedule: Array<{ days: number[]; startTime: string; endTime: string }>): any {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const result: any = {}

  schedule.forEach((block) => {
    block.days.forEach((dayNum) => {
      const dayName = dayNames[dayNum]
      if (!result[dayName]) {
        result[dayName] = []
      }
      result[dayName].push({
        open: to24HourFormat(block.startTime),
        close: to24HourFormat(block.endTime),
      })
    })
  })

  return result
}

// Transform database item to UI item
function transformItem(dbItem: any): MenuItem {
  // Get all tags from database and normalize to lowercase
  const allTags: string[] = dbItem.itemTags?.map((it: any) => 
    (it.tag.name || "").toLowerCase()
  ) || []
  
  const dietaryTagValues = [
    "vegetarian",
    "vegan",
    "gluten-free",
    "dairy-free",
    "nut-free",
    "sugar-free",
    "keto",
    "paleo",
    "low-carb",
    "high-protein",
    "organic",
    "raw",
    "halal",
    "kosher",
  ]
  const dietaryTags = allTags.filter((tag: string) => 
    dietaryTagValues.includes(tag)
  )
  
  // Regular tags are: spicy, popular, new, chef-pick (and any others)
  const regularTags = allTags.filter((tag: string) => 
    !dietaryTagValues.includes(tag)
  )
  
  return {
    id: dbItem.id,
    name: dbItem.name,
    description: dbItem.description || undefined,
    price: parseFloat(dbItem.price || "0"),
    currency: "USD", // Default, can be made configurable
    image: dbItem.photoUrl || undefined,
    status: dbItem.status,
    categories: dbItem.categoryItems?.map((ci: any) => ci.category?.id ?? ci.categoryId) || [],
    categoryOrders: Object.fromEntries(
      (dbItem.categoryItems ?? []).map((ci: any) => [
        ci.category?.id ?? ci.categoryId,
        typeof ci.displayOrder === "number" ? ci.displayOrder : 0,
      ]),
    ),
    tags: regularTags,
    dietaryTags: dietaryTags,
    customizationGroups: dbItem.itemCustomizations?.map((ic: any) => ic.group.id) || [],
    availabilityMode: dbItem.useCustomHours ? "custom" : "menu-hours",
    customSchedule: (() => {
      const converted = dbItem.customSchedule
        ? dbScheduleToUISchedule(dbItem.customSchedule)
        : []
      return converted.length > 0
        ? converted
        : [{ days: [], startTime: "7:00 AM", endTime: "11:00 PM" }]
    })(),
    nutrition: {
      calories: dbItem.calories || undefined,
      // Normalize allergens to lowercase to match UI expected values
      allergens: dbItem.itemAllergens?.map((ia: any) => 
        (ia.allergen.name || "").toLowerCase()
      ) || [],
    },
    defaultStation: dbItem.defaultStation ?? undefined,
    defaultSubstation: dbItem.defaultSubstation ?? undefined,
    featured: Boolean(dbItem.featured),
    i18n: normalizeCatalogI18n(dbItem.i18n),
  }
}

// Transform database category to UI category
function transformCategory(dbCategory: any): Category {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    emoji: dbCategory.emoji || undefined,
    description: dbCategory.description || undefined,
    i18n: normalizeCatalogI18n(dbCategory.i18n),
    displayOrder: dbCategory.displayOrder ?? dbCategory.order ?? 0,
    itemCount: dbCategory.itemCount || 0,
    menuIds: dbCategory.menuIds || [],
    menuNames: dbCategory.menuNames || [],
  }
}

// Transform database menu to UI menu
function transformMenu(dbMenu: any): Menu {
  const orderTypes: ("delivery" | "pickup" | "dine-in")[] = []
  if (dbMenu.availabilityDelivery) orderTypes.push("delivery")
  if (dbMenu.availabilityPickup) orderTypes.push("pickup")
  if (dbMenu.availabilityDineIn) orderTypes.push("dine-in")

  return {
    id: dbMenu.id,
    name: dbMenu.name,
    schedule: dbScheduleToUISchedule(dbMenu.schedule),
    orderTypes,
    categoryCount: dbMenu.categoryCount || 0,
    itemCount: 0, // Will be calculated from relations
    isActive: dbMenu.status === "active",
  }
}

// Transform database customization group to UI group
function transformCustomizationGroup(dbGroup: any): CustomizationGroup & {
  conditionalPricing?: any;
  conditionalQuantities?: any;
  secondaryGroups?: any;
  defaultSelections?: any;
} {
  // Reconstruct priceMatrix from conditionalPrices
  const priceMatrix: Record<string, Record<string, number>> = {};
  if (dbGroup.options) {
    dbGroup.options.forEach((option: any) => {
      if (option.conditionalPrices && option.conditionalPrices.length > 0) {
        priceMatrix[option.id] = {};
        option.conditionalPrices.forEach((cp: any) => {
          if (cp.baseOption) {
            priceMatrix[option.id][cp.baseOption.id] = parseFloat(cp.price || "0");
          }
        });
      }
    });
  }

  // Reconstruct rulesMatrix from conditionalQuantities
  const rulesMatrix: Record<string, any> = {};
  if (dbGroup.conditionalQuantities) {
    dbGroup.conditionalQuantities.forEach((cq: any) => {
      if (cq.baseOption) {
        rulesMatrix[cq.baseOption.id] = {
          min: cq.minSelections || 0,
          max: cq.maxSelections ?? undefined,
          required: cq.isRequired || false,
          maxPerOption: cq.maxPerOption ?? undefined,
        };
      }
    });
  }

  // Reconstruct secondary groups
  const secondaryGroupsRules: Array<{ id: string; triggerOptionId: string; showGroupId: string; required: boolean }> = [];
  if (dbGroup.secondaryRules) {
    dbGroup.secondaryRules.forEach((rule: any) => {
      secondaryGroupsRules.push({
        id: rule.id,
        triggerOptionId: rule.triggerOptionId,
        showGroupId: rule.showGroupId,
        required: rule.isRequired || false,
      });
    });
  }

  // Reconstruct default selections from defaultOptionIds
  // Can be stored as array of IDs (legacy) or object mapping optionId -> quantity
  const defaultSelections: Record<string, number> = {};
  if (dbGroup.defaultOptionIds) {
    if (Array.isArray(dbGroup.defaultOptionIds)) {
      // Legacy format: array of option IDs, default quantity to 1
      dbGroup.defaultOptionIds.forEach((optionId: string) => {
        defaultSelections[optionId] = 1;
      });
    } else if (typeof dbGroup.defaultOptionIds === 'object' && dbGroup.defaultOptionIds !== null) {
      // New format: object mapping optionId -> quantity
      Object.entries(dbGroup.defaultOptionIds).forEach(([optionId, quantity]) => {
        if (typeof quantity === 'number' && quantity > 0) {
          defaultSelections[optionId] = quantity;
        }
      });
    }
  }

  return {
    id: dbGroup.id,
    name: dbGroup.name,
    customerInstructions: dbGroup.customerInstructions || "",
    internalNotes: dbGroup.internalNotes,
    i18n: normalizeCatalogI18n(dbGroup.i18n),
    rules: {
      min: dbGroup.minSelections || 0,
      max: dbGroup.maxSelections || undefined,
      required: dbGroup.isRequired || false,
    },
    options: dbGroup.options?.map((opt: any, index: number) => {
      // Check if option is a default (handle both array and object formats)
      let isDefault = false;
      if (dbGroup.defaultOptionIds) {
        if (Array.isArray(dbGroup.defaultOptionIds)) {
          // Legacy format: array of option IDs
          isDefault = dbGroup.defaultOptionIds.includes(opt.id);
        } else if (typeof dbGroup.defaultOptionIds === 'object' && dbGroup.defaultOptionIds !== null) {
          // New format: object mapping optionId -> quantity
          isDefault = opt.id in dbGroup.defaultOptionIds && (dbGroup.defaultOptionIds as any)[opt.id] > 0;
        }
      }
      
      return {
        id: opt.id,
        name: opt.name,
        priceDelta: parseFloat(opt.price || "0"),
        isDefault,
        order: opt.displayOrder || index,
        i18n: normalizeCatalogI18n(opt.i18n),
      };
    }) || [],
    itemCount: dbGroup.itemCount || 0,
    itemNames: dbGroup.itemCustomizations?.map((ic: any) => ic.item.name) || [],
    // Advanced features
    conditionalPricing: dbGroup.useConditionalPricing ? {
      enabled: true,
      basedOnGroupId: dbGroup.conditionalPricingBaseGroupId || "",
      priceMatrix: Object.keys(priceMatrix).length > 0 ? priceMatrix : {},
    } : undefined,
    conditionalQuantities: dbGroup.useConditionalQuantities ? {
      enabled: true,
      basedOnGroupId: dbGroup.conditionalQuantitiesBaseGroupId || "",
      rulesMatrix: Object.keys(rulesMatrix).length > 0 ? rulesMatrix : {},
    } : undefined,
    secondaryGroups: secondaryGroupsRules.length > 0 ? {
      rules: secondaryGroupsRules,
    } : undefined,
    defaultSelections: Object.keys(defaultSelections).length > 0 ? defaultSelections : undefined,
  }
}

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const {
    currentLocationId,
    setCurrentLocation,
    locations,
    loading: locationsLoading,
  } = useLocation()
  const locationId = currentLocationId
  const setLocationId = setCurrentLocation
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customizationGroups, setCustomizationGroups] = useState<CustomizationGroup[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [tags, setTags] = useState<Array<{ id: string; name: string; emoji?: string | null }>>([])
  const [allergens, setAllergens] = useState<Array<{ id: string; name: string; emoji?: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper to map tag names to IDs (returns existing IDs only)
  const getTagIdsFromNames = useCallback((tagNames: string[]): string[] => {
    return tagNames
      .map((name) => tags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id)
      .filter((id): id is string => id !== undefined)
  }, [tags])

  // Helper to get or create tags - returns tag IDs, creating any that don't exist
  const getOrCreateTagIds = useCallback(async (tagNames: string[]): Promise<string[]> => {
    if (!locationId) return []
    
    const tagIds: string[] = []
    const tagsToCreate: string[] = []
    
    for (const name of tagNames) {
      const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
      if (existing) {
        tagIds.push(existing.id)
      } else {
        tagsToCreate.push(name)
      }
    }
    
    // Create any missing tags
    for (const name of tagsToCreate) {
      try {
        const response = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, name }),
        })
        if (response.ok) {
          const newTag = await response.json()
          tagIds.push(newTag.id)
          // Update local tags state
          setTags(prev => [...prev, { id: newTag.id, name: newTag.name, emoji: newTag.emoji ?? null }])
        } else {
          // Common race: tag was created moments ago but local context hasn't refreshed yet.
          // Re-read the location tag list and match by name so the item can still save.
          const existingTagsRes = await fetch(`/api/tags?locationId=${locationId}`, {
            credentials: 'include',
            cache: 'no-store',
          })
          if (existingTagsRes.ok) {
            const payload = await existingTagsRes.json()
            const rows = Array.isArray((payload as any)?.data)
              ? (payload as any).data
              : Array.isArray(payload)
                ? payload
                : []
            const matched = rows.find((row: { id: string; name: string }) =>
              row.name?.toLowerCase?.() === name.toLowerCase()
            )
            if (matched?.id) {
              tagIds.push(matched.id)
              setTags(prev => prev.some((t) => t.id === matched.id)
                ? prev
                : [...prev, { id: matched.id, name: matched.name, emoji: (matched as any).emoji ?? null }])
            }
          }
        }
      } catch (err) {
        console.error(`Failed to create tag: ${name}`, err)
      }
    }
    
    return tagIds
  }, [locationId, tags])

  // Helper to map allergen names to IDs (returns existing IDs only)
  const getAllergenIdsFromNames = useCallback((allergenNames: string[]): string[] => {
    return allergenNames
      .map((name) => allergens.find((a) => a.name.toLowerCase() === name.toLowerCase())?.id)
      .filter((id): id is string => id !== undefined)
  }, [allergens])

  // Helper to get or create allergens - returns allergen IDs, creating any that don't exist
  const getOrCreateAllergenIds = useCallback(async (allergenNames: string[]): Promise<string[]> => {
    if (!locationId) return []
    
    const allergenIds: string[] = []
    const allergensToCreate: string[] = []
    
    for (const name of allergenNames) {
      const existing = allergens.find((a) => a.name.toLowerCase() === name.toLowerCase())
      if (existing) {
        allergenIds.push(existing.id)
      } else {
        allergensToCreate.push(name)
      }
    }
    
    // Create any missing allergens
    for (const name of allergensToCreate) {
      try {
        const response = await fetch('/api/allergens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, name }),
        })
        if (response.ok) {
          const newAllergen = await response.json()
          allergenIds.push(newAllergen.id)
          // Update local allergens state
          setAllergens(prev => [...prev, { id: newAllergen.id, name: newAllergen.name, emoji: newAllergen.emoji ?? null }])
        } else {
          const existingAllergensRes = await fetch(`/api/allergens?locationId=${locationId}`, {
            credentials: 'include',
            cache: 'no-store',
          })
          if (existingAllergensRes.ok) {
            const payload = await existingAllergensRes.json()
            const rows = Array.isArray((payload as any)?.data)
              ? (payload as any).data
              : Array.isArray(payload)
                ? payload
                : []
            const matched = rows.find((row: { id: string; name: string }) =>
              row.name?.toLowerCase?.() === name.toLowerCase()
            )
            if (matched?.id) {
              allergenIds.push(matched.id)
              setAllergens(prev => prev.some((a) => a.id === matched.id)
                ? prev
                : [...prev, { id: matched.id, name: matched.name, emoji: (matched as any).emoji ?? null }])
            }
          }
        }
      } catch (err) {
        console.error(`Failed to create allergen: ${name}`, err)
      }
    }
    
    return allergenIds
  }, [locationId, allergens])

  // Retry utility function
  const retryFetch = useCallback(async (
    url: string,
    options: RequestInit = {},
    maxRetries = 3,
    delay = 1000
  ): Promise<Response> => {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)
        if (response.ok || attempt === maxRetries - 1) {
          return response
        }
        // If not ok and not last attempt, wait and retry
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)))
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error')
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)))
        }
      }
    }
    
    throw lastError || new Error('Failed after retries')
  }, [])

  // Fetch all data when locationId changes
  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!locationId) {
      setLoading(false)
      return
    }

    try {
      if (!options?.silent) {
        setLoading(true)
        setError(null)
      }

      // Fetch all data in parallel with retry logic
      // Add timestamp to bust server-side cache
      const cacheBuster = `&_t=${Date.now()}`
      const [itemsRes, categoriesRes, customizationsRes, menusRes, tagsRes, allergensRes] = await Promise.all([
        retryFetch(`/api/items?locationId=${locationId}${cacheBuster}`, { credentials: 'include', cache: 'no-store' }),
        retryFetch(`/api/categories?locationId=${locationId}${cacheBuster}`, { credentials: 'include', cache: 'no-store' }),
        retryFetch(`/api/customizations?locationId=${locationId}${cacheBuster}`, { credentials: 'include', cache: 'no-store' }),
        retryFetch(`/api/menus?locationId=${locationId}${cacheBuster}`, { credentials: 'include', cache: 'no-store' }),
        retryFetch(`/api/tags?locationId=${locationId}${cacheBuster}`, { credentials: 'include', cache: 'no-store' }),
        retryFetch(`/api/allergens?locationId=${locationId}${cacheBuster}`, { credentials: 'include', cache: 'no-store' }),
      ])

      if (!itemsRes.ok) throw new Error('Failed to fetch items')
      if (!categoriesRes.ok) throw new Error('Failed to fetch categories')
      if (!customizationsRes.ok) throw new Error('Failed to fetch customizations')
      if (!menusRes.ok) throw new Error('Failed to fetch menus')
      if (!tagsRes.ok) throw new Error('Failed to fetch tags')
      if (!allergensRes.ok) throw new Error('Failed to fetch allergens')

      const [itemsJson, categoriesJson, customizationsJson, menusJson, tagsJson, allergensJson] =
        await Promise.all([
          itemsRes.json(),
          categoriesRes.json(),
          customizationsRes.json(),
          menusRes.json(),
          tagsRes.json(),
          allergensRes.json(),
        ])

      // Unwrap POS envelope { ok, data } - all list APIs return posSuccess
      const unwrap = <T,>(json: unknown, label: string): T[] => {
        if (process.env.NODE_ENV === "development") {
          const ok = json && typeof json === "object" && "ok" in (json as object)
          const hasData = json && typeof json === "object" && "data" in (json as object)
          if (!ok || !hasData) {
            console.warn(
              `[MenuContext] ${label}: expected POS envelope { ok, data }, got:`,
              json && typeof json === "object" ? Object.keys(json as object) : typeof json
            )
          }
        }
        const data = json && typeof json === "object" && "data" in (json as object)
          ? (json as { data: unknown }).data
          : null
        return Array.isArray(data) ? (data as T[]) : []
      }

      setItems(unwrap<unknown>(itemsJson, "items").map(transformItem))
      setCategories(unwrap<unknown>(categoriesJson, "categories").map(transformCategory))
      setCustomizationGroups(
        unwrap<unknown>(customizationsJson, "customizations").map(transformCustomizationGroup)
      )
      setMenus(unwrap<unknown>(menusJson, "menus").map(transformMenu))
      setTags(unwrap<unknown>(tagsJson, "tags").map((t: { id: string; name: string; emoji?: string | null }) => ({ id: t.id, name: t.name, emoji: t.emoji ?? null })))
      setAllergens(
        unwrap<unknown>(allergensJson, "allergens").map((a: { id: string; name: string; emoji?: string | null }) => ({
          id: a.id,
          name: a.name,
          emoji: a.emoji ?? null,
        }))
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch menu data'
      setError(errorMessage)
      toast.error(`${errorMessage}. Please try again.`)
      console.error('[MenuContext] Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [locationId, retryFetch])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Items CRUD with optimistic updates
  const createItem = useCallback(async (item: Partial<MenuItem>) => {
    if (!locationId) {
      toast.error("No location selected")
      return
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const optimisticItem: MenuItem = {
      id: tempId,
      name: item.name || "New Item",
      description: item.description,
      price: item.price || 0,
      currency: "USD",
      image: item.image,
      status: item.status || "draft",
      categories: item.categories || [],
      tags: item.tags || [],
      dietaryTags: item.dietaryTags || [],
      customizationGroups: item.customizationGroups || [],
      availabilityMode: item.availabilityMode || "menu-hours",
      nutrition: item.nutrition,
      defaultStation: item.defaultStation ?? undefined,
      defaultSubstation: item.defaultSubstation ?? undefined,
      featured: item.featured ?? false,
      i18n: item.i18n ?? null,
    }
    setItems((prev) => [...prev, optimisticItem])

    try {
      const schedule = item.customSchedule ? uiScheduleToDbSchedule(item.customSchedule) : null
      // Combine regular tags and dietary tags when saving (auto-create if they don't exist)
      const allTags = [...(item.tags || []), ...(item.dietaryTags || [])]
      const tagIds = await getOrCreateTagIds(allTags)
      const allergenIds = await getOrCreateAllergenIds(item.nutrition?.allergens || [])
      
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          locationId,
          name: item.name,
          description: item.description,
          price: item.price || 0,
          photoUrl: item.image,
          calories: item.nutrition?.calories,
          status: item.status || "draft",
          featured: item.featured ?? false,
          useCustomHours: item.availabilityMode === "custom",
          customSchedule: schedule,
          displayOrder: 0,
          categoryIds: item.categories || [],
          tagIds,
          allergenIds,
          customizationGroupIds: item.customizationGroups || [],
          defaultStation: item.defaultStation ?? null,
          defaultSubstation: item.defaultSubstation ?? null,
          i18n: item.i18n ?? null,
        }),
      })

      if (!response.ok) {
        // Rollback optimistic update
        setItems((prev) => prev.filter((i) => i.id !== tempId))
        const error = await response.json()
        throw new Error(error.error || 'Failed to create item')
      }

      toast.success(`${item.name || "Item"} created successfully`)
      await fetchData({ silent: true })
    } catch (err) {
      // Rollback optimistic update
      setItems((prev) => prev.filter((i) => i.id !== tempId))
      const errorMessage = err instanceof Error ? err.message : 'Failed to create item'
      toast.error(errorMessage)
      throw err
    }
  }, [locationId, fetchData, getOrCreateTagIds, getOrCreateAllergenIds])

  const updateItem = useCallback(async (id: string, updates: Partial<MenuItem>) => {
    // Optimistic update
    const originalItem = items.find((i) => i.id === id)
    if (originalItem) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)))
    }

    try {
      const schedule = updates.customSchedule ? uiScheduleToDbSchedule(updates.customSchedule) : undefined
      // Combine regular tags and dietary tags when updating (auto-create if they don't exist)
      const hasTags = updates.tags !== undefined || updates.dietaryTags !== undefined
      const tagIds = hasTags 
        ? await getOrCreateTagIds([...(updates.tags || []), ...(updates.dietaryTags || [])])
        : undefined
      const allergenIds = updates.nutrition?.allergens 
        ? await getOrCreateAllergenIds(updates.nutrition.allergens) 
        : undefined
      
      const response = await fetch(`/api/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          price: updates.price,
          photoUrl: updates.image,
          calories: updates.nutrition?.calories,
          status: updates.status,
          featured: updates.featured,
          ...(updates.availabilityMode !== undefined
            ? { useCustomHours: updates.availabilityMode === "custom" }
            : {}),
          ...(updates.customSchedule !== undefined ? { customSchedule: schedule } : {}),
          categoryIds: updates.categories,
          tagIds,
          allergenIds,
          customizationGroupIds: updates.customizationGroups,
          defaultStation: updates.defaultStation !== undefined ? updates.defaultStation : undefined,
          defaultSubstation: updates.defaultSubstation !== undefined ? updates.defaultSubstation : undefined,
          ...(updates.i18n !== undefined ? { i18n: updates.i18n ?? null } : {}),
        }),
      })

      if (!response.ok) {
        // Rollback optimistic update
        if (originalItem) {
          setItems((prev) => prev.map((i) => (i.id === id ? originalItem : i)))
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to update item')
      }

      toast.success("Item updated successfully")
      await fetchData({ silent: true })
    } catch (err) {
      // Rollback optimistic update
      if (originalItem) {
        setItems((prev) => prev.map((i) => (i.id === id ? originalItem : i)))
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item'
      toast.error(errorMessage)
      throw err
    }
  }, [items, fetchData, getOrCreateTagIds, getOrCreateAllergenIds])

  const deleteItem = useCallback(async (id: string) => {
    // Optimistic update
    const item = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))

    try {
      const response = await fetch(`/api/items/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        // Rollback optimistic update
        if (item) {
          setItems((prev) => [...prev, item])
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete item')
      }

      toast.success(`${item?.name || "Item"} deleted`)
      await fetchData({ silent: true })
    } catch (err) {
      // Rollback optimistic update
      if (item) {
        setItems((prev) => [...prev, item])
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item'
      toast.error(errorMessage)
      throw err
    }
  }, [items, fetchData])

  const bulkUpdateItems = useCallback(async (ids: string[], updates: Partial<MenuItem>) => {
    const uniqueIds = [...new Set(ids.filter((id) => id.trim().length > 0))]
    if (uniqueIds.length === 0) return

    const originals = new Map(
      items.filter((item) => uniqueIds.includes(item.id)).map((item) => [item.id, item]),
    )
    setItems((prev) =>
      prev.map((item) => {
        if (!uniqueIds.includes(item.id)) return item
        return {
          ...item,
          ...(updates.status !== undefined ? { status: updates.status } : {}),
          ...(updates.featured !== undefined ? { featured: updates.featured } : {}),
          ...(updates.tags !== undefined
            ? { tags: [...new Set([...item.tags, ...updates.tags])] }
            : {}),
          ...(updates.dietaryTags !== undefined
            ? { dietaryTags: [...new Set([...item.dietaryTags, ...updates.dietaryTags])] }
            : {}),
          ...(updates.categories !== undefined
            ? { categories: [...new Set([...item.categories, ...updates.categories])] }
            : {}),
        }
      }),
    )

    try {
      const hasTags = updates.tags !== undefined || updates.dietaryTags !== undefined
      const addTagIds = hasTags
        ? await getOrCreateTagIds([...(updates.tags || []), ...(updates.dietaryTags || [])])
        : undefined

      const response = await fetch("/api/items/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ids: uniqueIds,
          updates: {
            ...(updates.status !== undefined ? { status: updates.status } : {}),
            ...(updates.featured !== undefined ? { featured: updates.featured } : {}),
            ...(addTagIds && addTagIds.length > 0 ? { addTagIds } : {}),
            ...(updates.categories !== undefined ? { addCategoryIds: updates.categories } : {}),
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          typeof error?.error === "string" ? error.error : "Failed to update items",
        )
      }

      await fetchData({ silent: true })
    } catch (err) {
      setItems((prev) =>
        prev.map((item) => originals.get(item.id) ?? item),
      )
      const errorMessage = err instanceof Error ? err.message : "Failed to update items"
      toast.error(errorMessage)
      throw err
    }
  }, [items, fetchData, getOrCreateTagIds])

  const bulkDeleteItems = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids.filter((id) => id.trim().length > 0))]
    if (uniqueIds.length === 0) return

    const removed = items.filter((item) => uniqueIds.includes(item.id))
    setItems((prev) => prev.filter((item) => !uniqueIds.includes(item.id)))

    try {
      const response = await fetch("/api/items/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: uniqueIds }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          typeof error?.error === "string" ? error.error : "Failed to delete items",
        )
      }

      await fetchData({ silent: true })
    } catch (err) {
      setItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id))
        return [...prev, ...removed.filter((item) => !existingIds.has(item.id))]
      })
      const errorMessage = err instanceof Error ? err.message : "Failed to delete items"
      toast.error(errorMessage)
      throw err
    }
  }, [items, fetchData])

  const importItems = useCallback(
    async (rows: ImportRow[], options: ImportOptions) => {
      if (!locationId) {
        toast.error("No location selected")
        return {
          created: 0,
          skipped: rows.length,
          categoriesCreated: [],
          errors: [{ row: 0, message: "No location selected" }],
        }
      }

      try {
        const response = await retryFetch("/api/items/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ locationId, rows, options }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          const message =
            (typeof error?.error === "string" ? error.error : null) ??
            "Failed to import menu items"
          throw new Error(message)
        }

        const result = await response.json()
        const created = result.created ?? 0
        const skipped = result.skipped ?? 0
        if (created > 0) {
          toast.success(
            `Imported ${created} item${created === 1 ? "" : "s"}${
              skipped > 0 ? ` (${skipped} skipped)` : ""
            }`,
          )
        } else if (skipped > 0) {
          toast.error(`No items imported (${skipped} row${skipped === 1 ? "" : "s"} skipped)`)
        }
        await fetchData({ silent: true })
        return {
          created,
          skipped,
          categoriesCreated: result.categoriesCreated ?? [],
          errors: result.errors ?? [],
        }
      } catch (err) {
        const errorMessage = formatMenuMutationError(
          err instanceof Error ? err.message : "Failed to import menu items",
        )
        toast.error(errorMessage)
        return {
          created: 0,
          skipped: rows.length,
          categoriesCreated: [],
          errors: [{ row: 0, message: errorMessage }],
        }
      }
    },
    [locationId, retryFetch, fetchData],
  )

  const reorderItems = useCallback(async (reorderedItems: MenuItem[], categoryId?: string) => {
    const previousItems = items
    const updates = reorderedItems.map((item, index) => ({
      id: item.id,
      displayOrder: index,
    }))

    if (categoryId) {
      const orderById = new Map(updates.map((update) => [update.id, update.displayOrder]))
      setItems((prev) =>
        prev.map((item) => {
          const displayOrder = orderById.get(item.id)
          if (displayOrder === undefined) return item
          return {
            ...item,
            categoryOrders: {
              ...item.categoryOrders,
              [categoryId]: displayOrder,
            },
          }
        }),
      )
    } else {
      setItems(reorderedItems)
    }

    try {
      const response = await retryFetch(`/api/items/reorder?locationId=${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: updates, categoryId: categoryId ?? null }),
      })
      if (!response.ok) {
        throw new Error("Failed to reorder items")
      }
    } catch (err) {
      setItems(previousItems)
      toast.error("Failed to reorder items")
    }
  }, [items, locationId, retryFetch])

  // Categories CRUD with optimistic updates
  const createCategory = useCallback(async (category: Omit<Category, "id" | "itemCount">) => {
    if (!locationId) {
      toast.error("No location selected")
      return
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const optimisticCategory: Category = {
      ...category,
      id: tempId,
      itemCount: 0,
    }
    setCategories((prev) => [...prev, optimisticCategory])

    try {
      const response = await retryFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          locationId,
          name: category.name,
          emoji: category.emoji,
          description: category.description,
          displayOrder: category.displayOrder,
          menuIds: category.menuIds || [],
          i18n: category.i18n ?? null,
        }),
      })

      if (!response.ok) {
        // Rollback optimistic update
        setCategories((prev) => prev.filter((c) => c.id !== tempId))
        const error = await response.json().catch(() => ({}))
        const message = formatMenuMutationError(
          (typeof error?.error === "string" ? error.error : null) ?? 'Failed to create category'
        )
        toast.error(message)
        return
      }
      await response.json()
      
      toast.success(`${category.name} created`)
      await fetchData({ silent: true })
    } catch (err) {
      // Rollback optimistic update
      setCategories((prev) => prev.filter((c) => c.id !== tempId))
      const errorMessage = formatMenuMutationError(
        err instanceof Error ? err.message : 'Failed to create category'
      )
      toast.error(errorMessage)
    }
  }, [locationId, fetchData, retryFetch])

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    try {
      // Build request body, only including defined fields
      const body: any = {}
      if (updates.name !== undefined) body.name = updates.name
      if (updates.emoji !== undefined) body.emoji = updates.emoji || null
      if (updates.description !== undefined) body.description = updates.description || null
      if (updates.displayOrder !== undefined) body.displayOrder = updates.displayOrder
      if (updates.menuIds !== undefined) body.menuIds = updates.menuIds
      if (updates.i18n !== undefined) body.i18n = updates.i18n ?? null

      console.log('updateCategory - id:', id, 'body:', body)

      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('updateCategory API error:', error)
        throw new Error(error.error || 'Failed to update category')
      }

      const updatedCategory = await response.json()
      console.log('updateCategory - response:', updatedCategory)

      toast.success("Category updated")
      await fetchData({ silent: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update category'
      console.error('updateCategory error:', err)
      toast.error(errorMessage)
      throw err
    }
  }, [fetchData])

  const deleteCategory = useCallback(async (id: string) => {
    if (id.startsWith("temp-")) {
      setCategories((prev) => prev.filter((c) => c.id !== id))
      return
    }

    const category = categories.find((c) => c.id === id)
    setCategories((prev) => prev.filter((c) => c.id !== id))

    try {
      const response = await retryFetch(`/api/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        if (category) {
          setCategories((prev) => [...prev, category])
        }
        const error = await response.json().catch(() => ({}))
        const message = formatMenuMutationError(
          (typeof error?.error === "string" ? error.error : null) ?? 'Failed to delete category'
        )
        toast.error(message)
        return
      }

      toast.success(`${category?.name || "Category"} deleted`)
      await fetchData({ silent: true })
    } catch (err) {
      if (category) {
        setCategories((prev) => [...prev, category])
      }
      const errorMessage = formatMenuMutationError(
        err instanceof Error ? err.message : 'Failed to delete category'
      )
      toast.error(errorMessage)
    }
  }, [categories, fetchData, retryFetch])

  const reorderCategories = useCallback(async (reorderedCategories: Category[]) => {
    // Optimistically update UI immediately
    const previousCategories = categories
    const updatedCategories = reorderedCategories.map((cat, index) => ({
      ...cat,
      displayOrder: index,
    }))
    setCategories(updatedCategories)

    // Save in background - batch update via single API call
    try {
      const updates = updatedCategories.map((cat) => ({
        id: cat.id,
        displayOrder: cat.displayOrder,
      }))
      
      await retryFetch(`/api/categories/reorder?locationId=${locationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: updates }),
      })
    } catch (err) {
      // Revert on error
      setCategories(previousCategories)
      toast.error('Failed to reorder categories')
    }
  }, [categories, locationId])

  // Customization Groups CRUD
  const createCustomizationGroup = useCallback(async (
    group: CreateCustomizationGroupInput,
    options?: { silent?: boolean },
  ): Promise<CreatedCustomizationGroup | null> => {
    if (!locationId) {
      toast.error("No location selected")
      return null
    }

    try {
      const response = await fetch('/api/customizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          locationId,
          name: group.name,
          customerInstructions: group.customerInstructions,
          internalNotes: group.internalNotes,
          i18n: group.i18n ?? null,
          isRequired: group.rules.required,
          minSelections: group.rules.min,
          maxSelections: group.rules.max,
          displayOrder: 0,
          options: group.options.map((opt, index) => ({
            id: opt.id,
            name: opt.name,
            price: opt.priceDelta,
            displayOrder: opt.order ?? index,
            isDefault: opt.isDefault || false,
            i18n: opt.i18n ?? null,
          })),
          useConditionalPricing: group.conditionalPricing?.enabled || false,
          conditionalPricingBaseGroupId: group.conditionalPricing?.basedOnGroupId && group.conditionalPricing.basedOnGroupId !== "" 
            ? group.conditionalPricing.basedOnGroupId 
            : null,
          conditionalPricing: group.conditionalPricing,
          useConditionalQuantities: group.conditionalQuantities?.enabled || false,
          conditionalQuantitiesBaseGroupId: group.conditionalQuantities?.basedOnGroupId && group.conditionalQuantities.basedOnGroupId !== ""
            ? group.conditionalQuantities.basedOnGroupId 
            : null,
          conditionalQuantities: group.conditionalQuantities,
          secondaryGroups: group.secondaryGroups,
          defaultSelections: group.defaultSelections,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create customization group')
      }

      const created = await response.json()
      if (!options?.silent) {
        toast.success(`${group.name} created`)
      }
      await fetchData({ silent: true })

      if (typeof created?.id !== "string") return null

      const createdOptions = Array.isArray(created.options)
        ? created.options
            .map((option: { id?: unknown; name?: unknown }) => ({
              id: typeof option?.id === "string" ? option.id : "",
              name: typeof option?.name === "string" ? option.name : "",
            }))
            .filter((option: { id: string; name: string }) => option.id.length > 0)
        : []

      return { id: created.id, options: createdOptions }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create customization group'
      toast.error(errorMessage)
      throw err
    }
  }, [locationId, fetchData])

  const updateCustomizationGroup = useCallback(async (id: string, updates: Partial<CustomizationGroup> & {
    conditionalPricing?: any;
    conditionalQuantities?: any;
    secondaryGroups?: any;
    defaultSelections?: any;
  }) => {
    try {
      const response = await fetch(`/api/customizations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: updates.name,
          customerInstructions: updates.customerInstructions,
          internalNotes: updates.internalNotes,
          i18n: updates.i18n ?? null,
          isRequired: updates.rules?.required,
          minSelections: updates.rules?.min,
          maxSelections: updates.rules?.max,
          // Include options if provided
          options: updates.options?.map((opt, index) => ({
            name: opt.name,
            price: opt.priceDelta || 0,
            displayOrder: index,
            isDefault: opt.isDefault || false,
            i18n: opt.i18n ?? null,
          })),
          // Include advanced features (ensure empty strings are converted to null for UUID fields)
          useConditionalPricing: updates.conditionalPricing?.enabled || false,
          conditionalPricingBaseGroupId: updates.conditionalPricing?.basedOnGroupId && updates.conditionalPricing.basedOnGroupId !== "" 
            ? updates.conditionalPricing.basedOnGroupId 
            : null,
          conditionalPricing: updates.conditionalPricing,
          useConditionalQuantities: updates.conditionalQuantities?.enabled || false,
          conditionalQuantitiesBaseGroupId: updates.conditionalQuantities?.basedOnGroupId && updates.conditionalQuantities.basedOnGroupId !== ""
            ? updates.conditionalQuantities.basedOnGroupId 
            : null,
          conditionalQuantities: updates.conditionalQuantities,
          secondaryGroups: updates.secondaryGroups,
          defaultSelections: updates.defaultSelections,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update customization group')
      }

      toast.success("Customization group updated")
      await fetchData({ silent: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update customization group'
      toast.error(errorMessage)
      throw err
    }
  }, [fetchData])

  const deleteCustomizationGroup = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/customizations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete customization group')
      }

      const group = customizationGroups.find((g) => g.id === id)
      toast.success(`${group?.name || "Group"} deleted`)
      await fetchData({ silent: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete customization group'
      toast.error(errorMessage)
      throw err
    }
  }, [customizationGroups, fetchData])

  const importCustomizationGroups = useCallback(
    async (groups: CustomizationImportGroup[], options: CustomizationImportOptions) => {
      if (!locationId) {
        toast.error("No location selected")
        return {
          created: 0,
          skipped: groups.length,
          errors: [{ row: 0, message: "No location selected" }],
        }
      }

      try {
        const response = await retryFetch("/api/customizations/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ locationId, groups, options }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          const message =
            (typeof error?.error === "string" ? error.error : null) ??
            "Failed to import customization groups"
          throw new Error(message)
        }

        const result = await response.json()
        const created = result.created ?? 0
        const skipped = result.skipped ?? 0
        if (created > 0) {
          toast.success(
            `Imported ${created} group${created === 1 ? "" : "s"}${
              skipped > 0 ? ` (${skipped} skipped)` : ""
            }`,
          )
        } else if (skipped > 0) {
          toast.error(
            `No groups imported (${skipped} group${skipped === 1 ? "" : "s"} skipped)`,
          )
        }
        await fetchData({ silent: true })
        return {
          created,
          skipped,
          errors: result.errors ?? [],
        }
      } catch (err) {
        const errorMessage = formatMenuMutationError(
          err instanceof Error ? err.message : "Failed to import customization groups",
        )
        toast.error(errorMessage)
        return {
          created: 0,
          skipped: groups.length,
          errors: [{ row: 0, message: errorMessage }],
        }
      }
    },
    [locationId, retryFetch, fetchData],
  )

  const importCategories = useCallback(
    async (rows: CategoryImportRow[], options: CategoryImportOptions) => {
      if (!locationId) {
        toast.error("No location selected")
        return {
          created: 0,
          skipped: rows.length,
          errors: [{ row: 0, message: "No location selected" }],
        }
      }

      try {
        const response = await retryFetch("/api/categories/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ locationId, rows, options }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          const message =
            (typeof error?.error === "string" ? error.error : null) ??
            "Failed to import categories"
          throw new Error(message)
        }

        const result = await response.json()
        const created = result.created ?? 0
        const skipped = result.skipped ?? 0
        if (created > 0) {
          toast.success(
            `Imported ${created} categor${created === 1 ? "y" : "ies"}${
              skipped > 0 ? ` (${skipped} skipped)` : ""
            }`,
          )
        } else if (skipped > 0) {
          toast.error(
            `No categories imported (${skipped} row${skipped === 1 ? "" : "s"} skipped)`,
          )
        }
        await fetchData({ silent: true })
        return {
          created,
          skipped,
          errors: result.errors ?? [],
        }
      } catch (err) {
        const errorMessage = formatMenuMutationError(
          err instanceof Error ? err.message : "Failed to import categories",
        )
        toast.error(errorMessage)
        return {
          created: 0,
          skipped: rows.length,
          errors: [{ row: 0, message: errorMessage }],
        }
      }
    },
    [locationId, retryFetch, fetchData],
  )

  const duplicateCustomizationGroup = useCallback(async (id: string) => {
    const group = customizationGroups.find((g) => g.id === id)
    if (group) {
      await createCustomizationGroup({
        ...group,
        name: `${group.name} (Copy)`,
      })
    }
  }, [customizationGroups, createCustomizationGroup])

  // Menus CRUD with optimistic updates
  const createMenu = useCallback(async (menu: Omit<Menu, "id" | "categoryCount" | "itemCount">) => {
    if (!locationId) {
      toast.error("No location selected")
      return
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const optimisticMenu: Menu = {
      ...menu,
      id: tempId,
      categoryCount: 0,
      itemCount: 0,
    }
    setMenus((prev) => [...prev, optimisticMenu])

    try {
      const schedule = uiScheduleToDbSchedule(menu.schedule)
      const response = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          locationId,
          name: menu.name,
          schedule,
          availabilityDelivery: menu.orderTypes.includes("delivery"),
          availabilityPickup: menu.orderTypes.includes("pickup"),
          availabilityDineIn: menu.orderTypes.includes("dine-in"),
          status: menu.isActive ? "active" : "inactive",
          displayOrder: 0,
        }),
      })

      if (!response.ok) {
        // Rollback optimistic update
        setMenus((prev) => prev.filter((m) => m.id !== tempId))
        const error = await response.json()
        throw new Error(error.error || 'Failed to create menu')
      }

      toast.success(`${menu.name} created`)
      await fetchData({ silent: true })
    } catch (err) {
      // Rollback optimistic update
      setMenus((prev) => prev.filter((m) => m.id !== tempId))
      const errorMessage = err instanceof Error ? err.message : 'Failed to create menu'
      toast.error(errorMessage)
      throw err
    }
  }, [locationId, fetchData])

  const updateMenu = useCallback(async (id: string, updates: Partial<Menu>) => {
    try {
      const schedule = updates.schedule ? uiScheduleToDbSchedule(updates.schedule) : undefined
      const response = await fetch(`/api/menus/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: updates.name,
          schedule,
          availabilityDelivery: updates.orderTypes?.includes("delivery"),
          availabilityPickup: updates.orderTypes?.includes("pickup"),
          availabilityDineIn: updates.orderTypes?.includes("dine-in"),
          status: updates.isActive !== undefined ? (updates.isActive ? "active" : "inactive") : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update menu')
      }

      toast.success("Menu updated")
      await fetchData({ silent: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update menu'
      toast.error(errorMessage)
      throw err
    }
  }, [fetchData])

  const deleteMenu = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/menus/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete menu')
      }

      const menu = menus.find((m) => m.id === id)
      toast.success(`${menu?.name || "Menu"} deleted`)
      await fetchData({ silent: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete menu'
      toast.error(errorMessage)
      throw err
    }
  }, [menus, fetchData])

  const toggleMenuActive = useCallback(async (id: string) => {
    const menu = menus.find((m) => m.id === id)
    if (menu) {
      await updateMenu(id, { isActive: !menu.isActive })
    }
  }, [menus, updateMenu])

  const duplicateMenu = useCallback(async (id: string) => {
    const menu = menus.find((m) => m.id === id)
    if (menu) {
      await createMenu({
        ...menu,
        name: `${menu.name} (Copy)`,
      })
    }
  }, [menus, createMenu])

  const value: MenuContextType = {
    items,
    categories,
    customizationGroups,
    menus,
    tags,
    allergens,
    loading: loading || locationsLoading,
    error,
    locationId,
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
    setLocationId,
    createItem,
    updateItem,
    deleteItem,
    bulkUpdateItems,
    bulkDeleteItems,
    importItems,
    reorderItems,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    importCategories,
    createCustomizationGroup,
    updateCustomizationGroup,
    deleteCustomizationGroup,
    duplicateCustomizationGroup,
    importCustomizationGroups,
    createMenu,
    updateMenu,
    deleteMenu,
    toggleMenuActive,
    duplicateMenu,
    refetch: fetchData,
    addTag: (tag) => setTags((prev) => {
      if (prev.some((t) => t.id === tag.id)) return prev
      return [...prev, tag]
    }),
    addAllergen: (allergen) => setAllergens((prev) => {
      if (prev.some((a) => a.id === allergen.id)) return prev
      return [...prev, allergen]
    }),
  }

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}

export function useMenu() {
  const context = useContext(MenuContext)
  if (context === undefined) {
    throw new Error("useMenu must be used within a MenuProvider")
  }
  return context
}
