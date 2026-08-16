import Papa from "papaparse"
import {
  CUSTOMIZATION_CSV_COLUMNS,
} from "@/lib/menu/import-customization-template"
import { catalogArField } from "@/lib/catalog-i18n"
import type { CustomizationGroup } from "@/types/customization"

export const CUSTOMIZATION_EXPORT_FILENAME = "customization-groups-export.csv"

function boolCsv(value: boolean): string {
  return value ? "true" : "false"
}

export function buildCustomizationGroupsExportCsv(groups: CustomizationGroup[]): string {
  const rows = groups.flatMap((group) =>
    [...group.options]
      .sort((a, b) => a.order - b.order)
      .map((option) => ({
        group: group.name,
        group_ar: catalogArField(group.i18n, "name"),
        instructions: group.customerInstructions ?? "",
        instructions_ar: catalogArField(group.i18n, "customerInstructions"),
        required: boolCsv(group.rules.required),
        min: String(group.rules.min),
        max: group.rules.max == null ? "" : String(group.rules.max),
        option: option.name,
        option_ar: catalogArField(option.i18n, "name"),
        price: Number.isFinite(option.priceDelta) ? option.priceDelta.toFixed(2) : "0.00",
        default: boolCsv(option.isDefault),
      })),
  )

  return Papa.unparse(rows, { columns: [...CUSTOMIZATION_CSV_COLUMNS] })
}

export function downloadCustomizationGroupsCsv(groups: CustomizationGroup[]): void {
  const content = `\uFEFF${buildCustomizationGroupsExportCsv(groups)}`
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = CUSTOMIZATION_EXPORT_FILENAME
  link.click()
  URL.revokeObjectURL(url)
}
