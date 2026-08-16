import { normalizeNameKey, normalizePrice } from "@/lib/menu/import-items"
import { catalogI18nFromArFields, type CatalogI18n } from "@/lib/catalog-i18n"

export interface CustomizationImportOption {
  name: string
  priceDelta: number
  isDefault: boolean
  i18n?: CatalogI18n | null
}

export interface CustomizationImportGroup {
  name: string
  customerInstructions: string
  required: boolean
  min: number
  max: number | null
  options: CustomizationImportOption[]
  i18n?: CatalogI18n | null
}

export interface CustomizationImportOptions {
  skipExistingGroups: boolean
  dryRun?: boolean
}

export interface CustomizationImportError {
  row: number
  field?: string
  message: string
}

export interface CustomizationImportRowPreview {
  groupName: string
  groupNameAr?: string
  optionName: string
  optionNameAr?: string
  priceDelta: number
  required: boolean
  min: number
  max: number | null
  isDefault: boolean
}

export interface CustomizationRowValidation {
  rowIndex: number
  valid: boolean
  errors: CustomizationImportError[]
  warnings: CustomizationImportError[]
  normalized?: CustomizationImportRowPreview
}

export interface CustomizationImportPlan {
  validations: CustomizationRowValidation[]
  validGroups: CustomizationImportGroup[]
  errors: CustomizationImportError[]
}

const COLUMN_ALIASES: Record<string, string> = {
  group: "group",
  group_name: "group",
  "group name": "group",
  modifier: "group",
  modifier_group: "group",
  "modifier group": "group",
  customization: "group",
  customization_group: "group",
  instructions: "instructions",
  customer_instructions: "instructions",
  "customer instructions": "instructions",
  prompt: "instructions",
  required: "required",
  is_required: "required",
  "is required": "required",
  min: "min",
  min_selections: "min",
  "min selections": "min",
  max: "max",
  max_selections: "max",
  "max selections": "max",
  option: "option",
  option_name: "option",
  "option name": "option",
  choice: "option",
  price: "price",
  price_delta: "price",
  "price delta": "price",
  extra: "price",
  default: "default",
  is_default: "default",
  "is default": "default",
  group_ar: "group_ar",
  "group ar": "group_ar",
  arabic_group: "group_ar",
  "arabic group": "group_ar",
  "group arabic": "group_ar",
  instructions_ar: "instructions_ar",
  "instructions ar": "instructions_ar",
  "customer instructions ar": "instructions_ar",
  option_ar: "option_ar",
  "option ar": "option_ar",
  arabic_option: "option_ar",
  "arabic option": "option_ar",
  "option arabic": "option_ar",
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

function parseBoolean(raw: string, trueValues: string[], falseValues: string[]): boolean | null {
  if (!raw) return null
  const value = raw.trim().toLowerCase()
  if (trueValues.includes(value)) return true
  if (falseValues.includes(value)) return false
  return null
}

function parseRequired(raw: string): boolean | null {
  return parseBoolean(
    raw,
    ["true", "yes", "y", "1", "required"],
    ["false", "no", "n", "0", "optional"],
  )
}

function parseDefault(raw: string): boolean | null {
  return parseBoolean(raw, ["true", "yes", "y", "1", "default"], ["false", "no", "n", "0"])
}

function parseCount(raw: string): number | "empty" | null {
  if (!raw.trim()) return "empty"
  const num = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(num) || String(num) !== raw.trim() || num < 0) return null
  return num
}

type DraftGroup = {
  name: string
  nameAr: string
  customerInstructions: string
  customerInstructionsAr: string
  required: boolean | null
  min: number | "empty" | null
  max: number | "empty" | null
  options: Array<{
    rowIndex: number
    name: string
    nameAr: string
    priceDelta: number
    isDefault: boolean
  }>
  rowIndexes: number[]
  warnings: CustomizationImportError[]
  errors: CustomizationImportError[]
}

function uniqueOptionNameKey(name: string): string {
  return normalizeNameKey(name)
}

function finalizeRules(draft: DraftGroup): {
  required: boolean
  min: number
  max: number | null
} {
  const required = draft.required ?? false
  let min = draft.min === "empty" || draft.min == null ? (required ? 1 : 0) : draft.min
  let max: number | null =
    draft.max === "empty" || draft.max == null ? (min >= 1 ? min : null) : draft.max

  if (required && min < 1) {
    min = 1
    draft.warnings.push({
      row: draft.rowIndexes[0] ?? 0,
      field: "min",
      message: "Required groups need at least 1 selection; min set to 1",
    })
  }

  if (max !== null && max < min) {
    draft.errors.push({
      row: draft.rowIndexes[0] ?? 0,
      field: "max",
      message: `Max (${max}) cannot be less than min (${min})`,
    })
  }

  return { required, min, max }
}

export function buildCustomizationImportPlan(
  rawRows: Record<string, string | undefined>[],
  options: CustomizationImportOptions,
  existingGroupNames: string[],
): CustomizationImportPlan {
  const existing = new Set(existingGroupNames.map(normalizeNameKey))
  const drafts = new Map<string, DraftGroup>()
  const draftOrder: string[] = []
  const validations: CustomizationRowValidation[] = []
  let currentKey: string | null = null

  rawRows.forEach((raw, index) => {
    const rowIndex = index + 2
    const errors: CustomizationImportError[] = []
    const warnings: CustomizationImportError[] = []

    const groupRaw = getField(raw, "group")
    const optionRaw = getField(raw, "option")
    const priceRaw = getField(raw, "price")
    const instructionsRaw = getField(raw, "instructions")
    const requiredRaw = getField(raw, "required")
    const minRaw = getField(raw, "min")
    const maxRaw = getField(raw, "max")
    const defaultRaw = getField(raw, "default")
    const groupArRaw = getField(raw, "group_ar")
    const instructionsArRaw = getField(raw, "instructions_ar")
    const optionArRaw = getField(raw, "option_ar")

    const groupName = groupRaw || (currentKey ? (drafts.get(currentKey)?.name ?? "") : "")
    if (!groupName) {
      errors.push({ row: rowIndex, field: "group", message: "Group name is required" })
    }

    if (!optionRaw) {
      errors.push({ row: rowIndex, field: "option", message: "Option name is required" })
    }

    let priceDelta = 0
    if (priceRaw) {
      const parsed = normalizePrice(priceRaw)
      if (parsed === null) {
        errors.push({ row: rowIndex, field: "price", message: "Price must be a non-negative number" })
      } else {
        priceDelta = parsed
      }
    }

    const requiredParsed = parseRequired(requiredRaw)
    if (requiredRaw && requiredParsed === null) {
      errors.push({
        row: rowIndex,
        field: "required",
        message: 'Required must be true/false (or yes/no, required/optional)',
      })
    }

    const minParsed = parseCount(minRaw)
    if (minParsed === null) {
      errors.push({ row: rowIndex, field: "min", message: "Min must be a whole number 0 or greater" })
    }

    const maxParsed = parseCount(maxRaw)
    if (maxParsed === null) {
      errors.push({ row: rowIndex, field: "max", message: "Max must be a whole number 0 or greater" })
    }

    const defaultParsed = parseDefault(defaultRaw)
    if (defaultRaw && defaultParsed === null) {
      errors.push({
        row: rowIndex,
        field: "default",
        message: "Default must be true/false (or yes/no)",
      })
    }

    if (errors.length > 0) {
      validations.push({ rowIndex, valid: false, errors, warnings })
      return
    }

    const key = normalizeNameKey(groupName)
    currentKey = key

    let draft = drafts.get(key)
    if (!draft) {
      draft = {
        name: groupName.trim(),
        nameAr: groupArRaw,
        customerInstructions: instructionsRaw,
        customerInstructionsAr: instructionsArRaw,
        required: requiredParsed,
        min: minParsed,
        max: maxParsed,
        options: [],
        rowIndexes: [],
        warnings: [],
        errors: [],
      }
      drafts.set(key, draft)
      draftOrder.push(key)
    } else {
      if (instructionsRaw && !draft.customerInstructions) {
        draft.customerInstructions = instructionsRaw
      }
      if (groupArRaw && !draft.nameAr) {
        draft.nameAr = groupArRaw
      }
      if (instructionsArRaw && !draft.customerInstructionsAr) {
        draft.customerInstructionsAr = instructionsArRaw
      }
      if (requiredParsed !== null && draft.required === null) {
        draft.required = requiredParsed
      } else if (requiredParsed !== null && draft.required !== requiredParsed) {
        draft.warnings.push({
          row: rowIndex,
          field: "required",
          message: `Conflicting required value ignored for "${draft.name}"`,
        })
      }
      if (minParsed !== "empty" && minParsed !== null && (draft.min === "empty" || draft.min === null)) {
        draft.min = minParsed
      }
      if (maxParsed !== "empty" && maxParsed !== null && (draft.max === "empty" || draft.max === null)) {
        draft.max = maxParsed
      }
    }

    const optionName = optionRaw.trim()
    const optionKey = uniqueOptionNameKey(optionName)
    if (draft.options.some((option) => uniqueOptionNameKey(option.name) === optionKey)) {
      errors.push({
        row: rowIndex,
        field: "option",
        message: `Duplicate option "${optionName}" in group "${draft.name}"`,
      })
      validations.push({ rowIndex, valid: false, errors, warnings })
      return
    }

    draft.rowIndexes.push(rowIndex)
    draft.options.push({
      rowIndex,
      name: optionName,
      nameAr: optionArRaw,
      priceDelta,
      isDefault: defaultParsed ?? false,
    })

    validations.push({
      rowIndex,
      valid: true,
      errors,
      warnings,
      normalized: {
        groupName: draft.name,
        groupNameAr: draft.nameAr || groupArRaw || undefined,
        optionName,
        optionNameAr: optionArRaw || undefined,
        priceDelta,
        required: draft.required ?? false,
        min: draft.min === "empty" || draft.min == null ? 0 : draft.min,
        max: draft.max === "empty" || draft.max == null ? null : draft.max,
        isDefault: defaultParsed ?? false,
      },
    })
  })

  const validGroups: CustomizationImportGroup[] = []
  const errors: CustomizationImportError[] = []

  for (const key of draftOrder) {
    const draft = drafts.get(key)
    if (!draft) continue

    const rules = finalizeRules(draft)
    const groupErrors = [...draft.errors]
    const groupWarnings = [...draft.warnings]

    if (draft.options.length === 0) {
      groupErrors.push({
        row: draft.rowIndexes[0] ?? 0,
        field: "option",
        message: `Group "${draft.name}" has no options`,
      })
    }

    const exists = existing.has(key)
    if (exists && options.skipExistingGroups) {
      groupErrors.push({
        row: draft.rowIndexes[0] ?? 0,
        field: "group",
        message: `Group "${draft.name}" already exists, skipped`,
      })
    }

    const groupValid = groupErrors.length === 0

    for (const rowIndex of draft.rowIndexes) {
      const validation = validations.find((entry) => entry.rowIndex === rowIndex)
      if (!validation) continue
      validation.errors.push(...groupErrors.filter((error) => error.row === rowIndex || error.field === "group" || error.field === "max" || error.field === "option"))
      validation.warnings.push(...groupWarnings)
      if (validation.normalized) {
        validation.normalized.required = rules.required
        validation.normalized.min = rules.min
        validation.normalized.max = rules.max
      }
      if (!groupValid) {
        validation.valid = false
        if (validation.errors.length === 0) {
          validation.errors.push(...groupErrors)
        }
      }
    }

    if (!groupValid) {
      errors.push(...groupErrors)
      continue
    }

    for (const warning of groupWarnings) {
      const validation = validations.find((entry) => entry.rowIndex === warning.row)
      if (validation && !validation.warnings.some((existingWarning) => existingWarning.message === warning.message)) {
        validation.warnings.push(warning)
      }
    }

    validGroups.push({
      name: draft.name,
      customerInstructions: draft.customerInstructions,
      required: rules.required,
      min: rules.min,
      max: rules.max,
      i18n: catalogI18nFromArFields({
        name: draft.nameAr,
        customerInstructions: draft.customerInstructionsAr,
      }),
      options: draft.options.map((option) => ({
        name: option.name,
        priceDelta: option.priceDelta,
        isDefault: option.isDefault,
        i18n: catalogI18nFromArFields({ name: option.nameAr }),
      })),
    })
  }

  for (const validation of validations) {
    if (!validation.valid) {
      errors.push(...validation.errors)
    }
  }

  const uniqueErrors: CustomizationImportError[] = []
  const seen = new Set<string>()
  for (const error of errors) {
    const key = `${error.row}:${error.field ?? ""}:${error.message}`
    if (seen.has(key)) continue
    seen.add(key)
    uniqueErrors.push(error)
  }

  return {
    validations,
    validGroups,
    errors: uniqueErrors,
  }
}
