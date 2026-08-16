import Papa from "papaparse"
import { CUSTOMIZATION_TEMPLATES } from "@/lib/menu/customization-templates"

export const CUSTOMIZATION_IMPORT_TEMPLATE_FILENAME = "customization-import-template.csv"

export const CUSTOMIZATION_CSV_COLUMNS = [
  "group",
  "group_ar",
  "instructions",
  "instructions_ar",
  "required",
  "min",
  "max",
  "option",
  "option_ar",
  "price",
  "default",
] as const

export type CustomizationCsvColumn = (typeof CUSTOMIZATION_CSV_COLUMNS)[number]

function boolCsv(value: boolean): string {
  return value ? "true" : "false"
}

const TEMPLATE_AR: Record<
  string,
  { group: string; instructions: string; options: Record<string, string> }
> = {
  "pizza-size": {
    group: "حجم البيتزا",
    instructions: "اختر الحجم",
    options: { Small: "صغير", Medium: "وسط", Large: "كبير" },
  },
  "spice-level": {
    group: "مستوى الحرارة",
    instructions: "كم تريدها حارة؟",
    options: { Mild: "خفيف", Medium: "وسط", Hot: "حار" },
  },
}

export function buildCustomizationImportTemplateCsv(): string {
  const examples = CUSTOMIZATION_TEMPLATES.slice(0, 2)
  const rows: Array<Record<CustomizationCsvColumn, string>> = examples.flatMap((template) => {
    const arabic = TEMPLATE_AR[template.id]
    return template.options.map((option) => ({
      group: template.name,
      group_ar: arabic?.group ?? "",
      instructions: template.customerInstructions,
      instructions_ar: arabic?.instructions ?? "",
      required: boolCsv(template.rules.required),
      min: String(template.rules.min),
      max: String(template.rules.max),
      option: option.name,
      option_ar: arabic?.options[option.name] ?? "",
      price: option.priceDelta.toFixed(2),
      default: boolCsv(option.isDefault),
    }))
  })

  return Papa.unparse(rows, { columns: [...CUSTOMIZATION_CSV_COLUMNS] })
}

export function downloadCustomizationImportTemplate(): void {
  const content = `\uFEFF${buildCustomizationImportTemplateCsv()}`
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = CUSTOMIZATION_IMPORT_TEMPLATE_FILENAME
  link.click()
  URL.revokeObjectURL(url)
}
