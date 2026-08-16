import Papa from "papaparse"
import type { ImportMenuCatalog } from "@/lib/menu/import-items"

export const CATEGORY_IMPORT_TEMPLATE_FILENAME = "category-import-template.csv"

export const CATEGORY_CSV_COLUMNS = [
  "name",
  "name_ar",
  "description",
  "description_ar",
  "emoji",
  "menu",
] as const

export type CategoryCsvColumn = (typeof CATEGORY_CSV_COLUMNS)[number]

function pickExampleMenu(menuCatalog?: ImportMenuCatalog): string {
  if (menuCatalog && menuCatalog.length > 0) {
    return menuCatalog[0].name
  }
  return "Lunch Menu"
}

export function buildCategoryImportTemplateCsv(menuCatalog?: ImportMenuCatalog): string {
  const exampleMenu = pickExampleMenu(menuCatalog)
  const rows: Array<Record<CategoryCsvColumn, string>> = [
    {
      name: "Pizzas",
      name_ar: "بيتزا",
      description: "Wood-fired pizzas",
      description_ar: "بيتزا فرن حطب",
      emoji: "🍕",
      menu: exampleMenu,
    },
    {
      name: "Salads",
      name_ar: "سلطات",
      description: "Fresh greens",
      description_ar: "",
      emoji: "🥗",
      menu: "",
    },
  ]

  return Papa.unparse(rows, { columns: [...CATEGORY_CSV_COLUMNS] })
}

export function downloadCategoryImportTemplate(menuCatalog?: ImportMenuCatalog): void {
  const content = `\uFEFF${buildCategoryImportTemplateCsv(menuCatalog)}`
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = CATEGORY_IMPORT_TEMPLATE_FILENAME
  link.click()
  URL.revokeObjectURL(url)
}
