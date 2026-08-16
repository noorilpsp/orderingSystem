import Papa from "papaparse"
import { getMenuCsvColumns } from "@/lib/menu/import-template"
import { catalogArField } from "@/lib/catalog-i18n"
import type { MenuItem } from "@/types/menu-item"
import type { Category } from "@/types/category"

export const MENU_EXPORT_FILENAME = "menu-items-export.csv"

function joinList(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join("; ")
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(value.trim())
  }
  return result
}

export function buildMenuItemsExportCsv(
  items: MenuItem[],
  categories: Category[],
  includeKds = false,
): string {
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  const rows = items.map((item) => {
    const itemCategories = item.categories
      .map((id) => categoryById.get(id))
      .filter((category): category is Category => Boolean(category))

    const menuNames = unique(itemCategories.flatMap((category) => category.menuNames ?? []))
    const tags = unique([...item.dietaryTags, ...item.tags])

    return {
      name: item.name,
      name_ar: catalogArField(item.i18n, "name"),
      price: Number.isFinite(item.price) ? item.price.toFixed(2) : "",
      category: joinList(itemCategories.map((category) => category.name)),
      menu: joinList(menuNames),
      description: item.description ?? "",
      description_ar: catalogArField(item.i18n, "description"),
      photo_url: item.image ?? "",
      prep_station: item.defaultStation ?? "",
      kitchen_lane: item.defaultSubstation ?? "",
      tags: joinList(tags),
      allergens: joinList(item.nutrition?.allergens ?? []),
      calories:
        typeof item.nutrition?.calories === "number" ? String(item.nutrition.calories) : "",
      status: item.status,
    }
  })

  return Papa.unparse(rows, { columns: getMenuCsvColumns(includeKds) })
}

export function downloadMenuItemsCsv(
  items: MenuItem[],
  categories: Category[],
  includeKds = false,
): void {
  const content = `\uFEFF${buildMenuItemsExportCsv(items, categories, includeKds)}`
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = MENU_EXPORT_FILENAME
  link.click()
  URL.revokeObjectURL(url)
}
