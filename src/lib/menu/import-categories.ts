import {
  normalizeNameKey,
  resolveMenuFields,
  type ImportMenuCatalog,
} from "@/lib/menu/import-items"
import { catalogI18nFromArFields, type CatalogI18n } from "@/lib/catalog-i18n"

export interface CategoryImportRow {
  name: string
  description?: string
  emoji?: string
  menuIds?: string[]
  menuNames?: string[]
  i18n?: CatalogI18n | null
}

export interface CategoryImportOptions {
  skipExistingCategories: boolean
  menuId?: string
  dryRun?: boolean
}

export interface CategoryImportError {
  row: number
  field?: string
  message: string
}

export interface CategoryRowValidation {
  rowIndex: number
  valid: boolean
  errors: CategoryImportError[]
  warnings: CategoryImportError[]
  normalized?: CategoryImportRow
}

export interface CategoryImportPlan {
  validations: CategoryRowValidation[]
  validRows: CategoryImportRow[]
  errors: CategoryImportError[]
}

const COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  category: "name",
  category_name: "name",
  "category name": "name",
  description: "description",
  desc: "description",
  emoji: "emoji",
  icon: "emoji",
  menu: "menu",
  menus: "menu",
  name_ar: "name_ar",
  "name ar": "name_ar",
  arabic_name: "name_ar",
  "arabic name": "name_ar",
  "name arabic": "name_ar",
  description_ar: "description_ar",
  "description ar": "description_ar",
  arabic_description: "description_ar",
  "arabic description": "description_ar",
  "description arabic": "description_ar",
}

function canonicalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

function getField(raw: Record<string, string | undefined>, canonical: string): string {
  for (const [key, value] of Object.entries(raw)) {
    const alias = COLUMN_ALIASES[canonicalizeKey(key)]
    if (alias === canonical) {
      return (value ?? "").trim()
    }
  }
  return ""
}

export function buildCategoryImportPlan(
  rawRows: Record<string, string | undefined>[],
  options: CategoryImportOptions,
  existingCategoryNames: string[],
  menuCatalog?: ImportMenuCatalog,
): CategoryImportPlan {
  const existing = new Set(existingCategoryNames.map(normalizeNameKey))
  const seenInFile = new Set<string>()
  const validations: CategoryRowValidation[] = []

  rawRows.forEach((raw, index) => {
    const rowIndex = index + 2
    const errors: CategoryImportError[] = []
    const warnings: CategoryImportError[] = []

    const name = getField(raw, "name")
    const description = getField(raw, "description")
    const emoji = getField(raw, "emoji")
    const menuRaw = getField(raw, "menu")
    const nameAr = getField(raw, "name_ar")
    const descriptionAr = getField(raw, "description_ar")

    if (!name) {
      errors.push({ row: rowIndex, field: "name", message: "Name is required" })
    }

    if (emoji && emoji.length > 10) {
      errors.push({
        row: rowIndex,
        field: "emoji",
        message: "Emoji must be 10 characters or fewer",
      })
    }

    const nameKey = name ? normalizeNameKey(name) : ""
    if (nameKey && seenInFile.has(nameKey)) {
      errors.push({
        row: rowIndex,
        field: "name",
        message: `Duplicate category "${name}" in CSV`,
      })
    } else if (nameKey) {
      seenInFile.add(nameKey)
    }

    if (nameKey && existing.has(nameKey) && options.skipExistingCategories) {
      errors.push({
        row: rowIndex,
        field: "name",
        message: `Category "${name}" already exists, skipped`,
      })
    }

    const menus = resolveMenuFields(menuRaw, menuCatalog, rowIndex, options.menuId)
    warnings.push(
      ...menus.warnings.map((warning) => ({
        row: warning.row,
        field: warning.field,
        message: warning.message,
      })),
    )

    const valid = errors.length === 0
    validations.push({
      rowIndex,
      valid,
      errors,
      warnings,
      normalized: valid
        ? {
            name: name.trim(),
            description: description || undefined,
            emoji: emoji || undefined,
            menuIds: menus.menuIds,
            menuNames: menus.menuNames,
            i18n: catalogI18nFromArFields({ name: nameAr, description: descriptionAr }),
          }
        : undefined,
    })
  })

  const validRows: CategoryImportRow[] = []
  const errors: CategoryImportError[] = []

  for (const validation of validations) {
    errors.push(...validation.errors)
    if (validation.valid && validation.normalized) {
      validRows.push(validation.normalized)
    }
  }

  return { validations, validRows, errors }
}
