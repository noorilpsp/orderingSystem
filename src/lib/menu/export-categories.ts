import Papa from "papaparse"
import { CATEGORY_CSV_COLUMNS } from "@/lib/menu/import-category-template"
import { catalogArField } from "@/lib/catalog-i18n"
import type { Category } from "@/types/category"

export const CATEGORY_EXPORT_FILENAME = "categories-export.csv"

function joinList(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join("; ")
}

export function buildCategoriesExportCsv(categories: Category[]): string {
  const rows = [...categories]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((category) => ({
      name: category.name,
      name_ar: catalogArField(category.i18n, "name"),
      description: category.description ?? "",
      description_ar: catalogArField(category.i18n, "description"),
      emoji: category.emoji ?? "",
      menu: joinList(category.menuNames ?? []),
    }))

  return Papa.unparse(rows, { columns: [...CATEGORY_CSV_COLUMNS] })
}

export function downloadCategoriesCsv(categories: Category[]): void {
  const content = `\uFEFF${buildCategoriesExportCsv(categories)}`
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = CATEGORY_EXPORT_FILENAME
  link.click()
  URL.revokeObjectURL(url)
}
