import { catalogI18nFromArFields, type CatalogI18n } from "@/lib/catalog-i18n"

export type ItemStatus = "live" | "soldout" | "hidden" | "draft"

export interface ImportRow {
  name: string
  price: number
  category?: string
  description?: string
  photoUrl?: string
  tags?: string[]
  allergens?: string[]
  calories?: number
  status?: ItemStatus
  defaultStation?: string
  defaultSubstation?: string
  menuIds?: string[]
  menuNames?: string[]
  i18n?: CatalogI18n | null
}

export interface ImportMenuCatalogEntry {
  id: string
  name: string
  isActive?: boolean
}

export type ImportMenuCatalog = ImportMenuCatalogEntry[]

export interface ImportStationCatalogEntry {
  key: string
  name: string
  isActive: boolean
  substations: Array<{ key: string; name: string }>
}

export type ImportStationCatalog = ImportStationCatalogEntry[]

export interface ImportOptions {
  createMissingCategories: boolean
  defaultStatus: ItemStatus
  menuId?: string
  dryRun?: boolean
}

export interface ImportError {
  row: number
  field?: string
  message: string
}

export interface RowValidation {
  rowIndex: number
  valid: boolean
  errors: ImportError[]
  warnings: ImportError[]
  normalized?: ImportRow
}

export interface ImportPlan {
  validations: RowValidation[]
  validRows: ImportRow[]
  errors: ImportError[]
  categoriesToCreate: string[]
}

const VALID_STATUSES = new Set<ItemStatus>(["live", "soldout", "hidden", "draft"])

const COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  item: "name",
  "item name": "name",
  price: "price",
  category: "category",
  categories: "category",
  description: "description",
  desc: "description",
  tags: "tags",
  tag: "tags",
  allergens: "allergens",
  allergen: "allergens",
  calories: "calories",
  calorie: "calories",
  status: "status",
  photo_url: "photo_url",
  photourl: "photo_url",
  "photo url": "photo_url",
  image: "photo_url",
  image_url: "photo_url",
  "image url": "photo_url",
  photo: "photo_url",
  prep_station: "prep_station",
  "prep station": "prep_station",
  kds_station: "prep_station",
  "kds station": "prep_station",
  default_station: "prep_station",
  station: "prep_station",
  kitchen_lane: "kitchen_lane",
  "kitchen lane": "kitchen_lane",
  lane: "kitchen_lane",
  default_substation: "kitchen_lane",
  substation: "kitchen_lane",
  menu: "menu",
  menus: "menu",
  name_ar: "name_ar",
  "name ar": "name_ar",
  arabic_name: "name_ar",
  name_arabic: "name_ar",
  "arabic name": "name_ar",
  "name arabic": "name_ar",
  description_ar: "description_ar",
  "description ar": "description_ar",
  arabic_description: "description_ar",
  description_arabic: "description_ar",
  "arabic description": "description_ar",
  "description arabic": "description_ar",
}

export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase()
}

export function normalizePrice(raw: string): number | null {
  if (!raw || !raw.trim()) return null
  const cleaned = raw.trim().replace(/[$€£\s]/g, "").replace(",", ".")
  const num = Number.parseFloat(cleaned)
  if (Number.isNaN(num) || num < 0) return null
  return Math.round(num * 100) / 100
}

export function parseListField(raw?: string): string[] {
  if (!raw || !raw.trim()) return []
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function normalizePhotoUrl(raw?: string): string | null {
  if (!raw || !raw.trim()) return null
  const trimmed = raw.trim()
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (trimmed.length > 500) return null
    return trimmed
  } catch {
    return null
  }
}

export function normalizeCsvRow(raw: Record<string, string | undefined>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const alias = COLUMN_ALIASES[key.trim().toLowerCase()]
    if (alias && value !== undefined) {
      normalized[alias] = value
    }
  }
  return normalized
}

function getField(row: Record<string, string>, field: string): string {
  return (row[field] ?? "").trim()
}

export function resolveKdsFields(
  prepStationRaw: string,
  kitchenLaneRaw: string,
  catalog: ImportStationCatalog | undefined,
  rowIndex: number,
): {
  defaultStation?: string
  defaultSubstation?: string
  warnings: ImportError[]
} {
  const warnings: ImportError[] = []
  const prepRaw = prepStationRaw.trim()
  const laneRaw = kitchenLaneRaw.trim()

  if (!prepRaw && !laneRaw) {
    return { warnings }
  }

  if (!catalog || catalog.length === 0) {
    if (prepRaw) {
      return {
        defaultStation: prepRaw.length <= 50 ? prepRaw : undefined,
        defaultSubstation:
          laneRaw && prepRaw && laneRaw.length <= 50 ? laneRaw.toLowerCase() : undefined,
        warnings,
      }
    }
    if (laneRaw) {
      warnings.push({
        row: rowIndex,
        field: "kitchen_lane",
        message: "Kitchen lane requires prep_station, ignored",
      })
    }
    return { warnings }
  }

  const station = findActiveStation(prepRaw, catalog)
  if (!station) {
    if (prepRaw) {
      warnings.push({
        row: rowIndex,
        field: "prep_station",
        message: `Unknown prep station "${prepRaw}", ignored`,
      })
    }
    if (laneRaw) {
      warnings.push({
        row: rowIndex,
        field: "kitchen_lane",
        message: "Kitchen lane requires a valid prep_station, ignored",
      })
    }
    return { warnings }
  }

  let defaultSubstation: string | undefined
  if (laneRaw) {
    if (station.substations.length === 0) {
      warnings.push({
        row: rowIndex,
        field: "kitchen_lane",
        message: `Station "${station.key}" has no kitchen lanes, ignored`,
      })
    } else {
      const laneKey = findSubstationKey(laneRaw, station)
      if (laneKey) {
        defaultSubstation = laneKey
      } else {
        warnings.push({
          row: rowIndex,
          field: "kitchen_lane",
          message: `Unknown kitchen lane "${laneRaw}" for ${station.key}, ignored`,
        })
      }
    }
  }

  return {
    defaultStation: station.key,
    defaultSubstation,
    warnings,
  }
}

function findActiveStation(
  raw: string,
  catalog: ImportStationCatalog,
): ImportStationCatalogEntry | null {
  const lower = raw.toLowerCase()
  for (const station of catalog) {
    if (!station.isActive) continue
    if (station.key === raw || station.key.toLowerCase() === lower) return station
    if (station.name.toLowerCase() === lower) return station
  }
  return null
}

function findSubstationKey(
  raw: string,
  station: ImportStationCatalogEntry,
): string | null {
  const lower = raw.toLowerCase()
  for (const sub of station.substations) {
    if (sub.key === lower || sub.key === raw || sub.name.toLowerCase() === lower) {
      return sub.key
    }
  }
  return null
}

export function resolveMenuFields(
  menuRaw: string,
  catalog: ImportMenuCatalog | undefined,
  rowIndex: number,
  fallbackMenuId?: string,
): {
  menuIds?: string[]
  menuNames?: string[]
  warnings: ImportError[]
} {
  const warnings: ImportError[] = []
  const names = parseListField(menuRaw)

  if (names.length === 0) {
    if (fallbackMenuId && catalog?.some((m) => m.id === fallbackMenuId)) {
      const fallback = catalog.find((m) => m.id === fallbackMenuId)!
      return {
        menuIds: [fallbackMenuId],
        menuNames: [fallback.name],
        warnings,
      }
    }
    return { warnings }
  }

  if (!catalog || catalog.length === 0) {
    warnings.push({
      row: rowIndex,
      field: "menu",
      message: "Menu names provided but no menus loaded, ignored",
    })
    return { warnings }
  }

  const menuIds: string[] = []
  const menuNames: string[] = []

  for (const name of names) {
    const lower = name.toLowerCase()
    const match = catalog.find(
      (m) => m.name.toLowerCase() === lower || m.id === name,
    )
    if (match) {
      if (!menuIds.includes(match.id)) {
        menuIds.push(match.id)
        menuNames.push(match.name)
      }
    } else {
      warnings.push({
        row: rowIndex,
        field: "menu",
        message: `Unknown menu "${name}", ignored`,
      })
    }
  }

  return {
    menuIds: menuIds.length > 0 ? menuIds : undefined,
    menuNames: menuNames.length > 0 ? menuNames : undefined,
    warnings,
  }
}

export function validateImportRow(
  raw: Record<string, string>,
  rowIndex: number,
  options: Pick<ImportOptions, "createMissingCategories" | "defaultStatus" | "menuId">,
  existingCategoryNames: Set<string>,
  stationCatalog?: ImportStationCatalog,
  menuCatalog?: ImportMenuCatalog,
): RowValidation {
  const errors: ImportError[] = []
  const warnings: ImportError[] = []

  const name = getField(raw, "name")
  const priceRaw = getField(raw, "price")
  const category = getField(raw, "category")
  const description = getField(raw, "description")
  const tagsRaw = raw.tags
  const allergensRaw = raw.allergens
  const caloriesRaw = getField(raw, "calories")
  const statusRaw = getField(raw, "status").toLowerCase()
  const photoUrlRaw = getField(raw, "photo_url")
  const prepStationRaw = getField(raw, "prep_station")
  const kitchenLaneRaw = getField(raw, "kitchen_lane")
  const menuRaw = getField(raw, "menu")
  const nameAr = getField(raw, "name_ar")
  const descriptionAr = getField(raw, "description_ar")

  if (!name) {
    errors.push({ row: rowIndex, field: "name", message: "Name is required" })
  }

  const price = normalizePrice(priceRaw)
  if (price === null) {
    errors.push({ row: rowIndex, field: "price", message: "Invalid price" })
  }

  if (!category) {
    errors.push({ row: rowIndex, field: "category", message: "Category is required" })
  } else if (!existingCategoryNames.has(normalizeNameKey(category))) {
    if (options.createMissingCategories) {
      warnings.push({
        row: rowIndex,
        field: "category",
        message: `Category "${category}" will be created`,
      })
    } else {
      errors.push({
        row: rowIndex,
        field: "category",
        message: `Unknown category "${category}"`,
      })
    }
  }

  let status = options.defaultStatus
  if (statusRaw) {
    if (VALID_STATUSES.has(statusRaw as ItemStatus)) {
      status = statusRaw as ItemStatus
    } else {
      warnings.push({
        row: rowIndex,
        field: "status",
        message: `Invalid status "${statusRaw}", using ${options.defaultStatus}`,
      })
    }
  }

  let calories: number | undefined
  if (caloriesRaw) {
    const parsed = Number.parseInt(caloriesRaw, 10)
    if (Number.isNaN(parsed) || parsed < 0) {
      warnings.push({
        row: rowIndex,
        field: "calories",
        message: "Invalid calories, ignored",
      })
    } else {
      calories = parsed
    }
  }

  const tags = parseListField(tagsRaw)
  const allergenList = parseListField(allergensRaw)

  let photoUrl: string | undefined
  if (photoUrlRaw) {
    const normalized = normalizePhotoUrl(photoUrlRaw)
    if (normalized) {
      photoUrl = normalized
    } else {
      warnings.push({
        row: rowIndex,
        field: "photo_url",
        message: "Invalid photo URL, ignored",
      })
    }
  }

  const kds = resolveKdsFields(prepStationRaw, kitchenLaneRaw, stationCatalog, rowIndex)
  warnings.push(...kds.warnings)

  const menus = resolveMenuFields(menuRaw, menuCatalog, rowIndex, options.menuId)
  warnings.push(...menus.warnings)

  const valid = errors.length === 0

  return {
    rowIndex,
    valid,
    errors,
    warnings,
    normalized: valid
      ? {
          name,
          price: price!,
          category,
          description: description || undefined,
          photoUrl,
          tags: tags.length > 0 ? tags : undefined,
          allergens: allergenList.length > 0 ? allergenList : undefined,
          calories,
          status,
          defaultStation: kds.defaultStation,
          defaultSubstation: kds.defaultSubstation,
          menuIds: menus.menuIds,
          menuNames: menus.menuNames,
          i18n: catalogI18nFromArFields({ name: nameAr, description: descriptionAr }),
        }
      : undefined,
  }
}

export function buildImportPlan(
  rawRows: Record<string, string | undefined>[],
  options: Pick<ImportOptions, "createMissingCategories" | "defaultStatus" | "menuId">,
  existingCategories: Array<{ id: string; name: string }>,
  stationCatalog?: ImportStationCatalog,
  menuCatalog?: ImportMenuCatalog,
): ImportPlan {
  const categoryNames = new Set(existingCategories.map((c) => normalizeNameKey(c.name)))
  const validations: RowValidation[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const normalizedRow = normalizeCsvRow(rawRows[i])
    const isEmpty = Object.values(normalizedRow).every((v) => !v.trim())
    if (isEmpty) continue

    const rowIndex = i + 2
    const validation = validateImportRow(
      normalizedRow,
      rowIndex,
      options,
      categoryNames,
      stationCatalog,
      menuCatalog,
    )
    validations.push(validation)

    if (validation.valid && validation.normalized?.category && options.createMissingCategories) {
      categoryNames.add(normalizeNameKey(validation.normalized.category))
    }
  }

  const validRows: ImportRow[] = []
  const errors: ImportError[] = []
  const categoriesToCreateSet = new Set<string>()

  const existingKeys = new Set(existingCategories.map((c) => normalizeNameKey(c.name)))

  for (const validation of validations) {
    errors.push(...validation.errors)
    if (validation.valid && validation.normalized) {
      validRows.push(validation.normalized)
      if (
        validation.normalized.category &&
        options.createMissingCategories &&
        !existingKeys.has(normalizeNameKey(validation.normalized.category))
      ) {
        categoriesToCreateSet.add(validation.normalized.category.trim())
      }
    }
  }

  return {
    validations,
    validRows,
    errors,
    categoriesToCreate: [...categoriesToCreateSet],
  }
}
