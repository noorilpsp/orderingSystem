import assert from "node:assert/strict"
import { buildCustomizationImportPlan } from "../src/lib/menu/import-customizations"
import { buildCustomizationImportTemplateCsv } from "../src/lib/menu/import-customization-template"
import Papa from "papaparse"

function parseCsv(csv: string): Record<string, string>[] {
  const results = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  })
  return results.data.filter((row) => Object.values(row).some((value) => value?.trim()))
}

function testTemplateRoundTrip() {
  const csv = buildCustomizationImportTemplateCsv()
  const rows = parseCsv(csv)
  const plan = buildCustomizationImportPlan(rows, { skipExistingGroups: true }, [])
  assert.equal(plan.validGroups.length, 2)
  assert.equal(plan.validGroups[0]?.name, "Pizza Size")
  assert.equal(plan.validGroups[0]?.options.length, 3)
  assert.equal(plan.validGroups[0]?.required, true)
  assert.equal(plan.validGroups[0]?.min, 1)
  assert.equal(plan.validGroups[0]?.max, 1)
  assert.equal(plan.validGroups[0]?.options[0]?.isDefault, true)
  assert.equal(plan.validGroups[0]?.i18n?.ar?.name, "حجم البيتزا")
  assert.equal(plan.validGroups[0]?.options[0]?.i18n?.ar?.name, "صغير")
  assert.equal(plan.validGroups[1]?.name, "Spice Level")
}

function testContinuationRows() {
  const plan = buildCustomizationImportPlan(
    [
      {
        group: "Milk Choice",
        instructions: "Choose milk",
        required: "yes",
        min: "1",
        max: "1",
        option: "Whole",
        price: "0",
        default: "true",
      },
      { option: "Oat", price: "0.75", default: "false" },
      { option: "Almond", price: "$0.75" },
    ],
    { skipExistingGroups: true },
    [],
  )
  assert.equal(plan.validGroups.length, 1)
  assert.equal(plan.validGroups[0]?.options.length, 3)
  assert.equal(plan.validGroups[0]?.options[1]?.priceDelta, 0.75)
}

function testSkipExisting() {
  const rows = [
    { group: "Size", option: "Small", price: "0", required: "true", min: "1", max: "1" },
    { group: "Size", option: "Large", price: "2" },
  ]
  const skipped = buildCustomizationImportPlan(rows, { skipExistingGroups: true }, ["size"])
  assert.equal(skipped.validGroups.length, 0)
  assert.ok(skipped.errors.some((error) => error.message.includes("already exists")))

  const created = buildCustomizationImportPlan(rows, { skipExistingGroups: false }, ["Size"])
  assert.equal(created.validGroups.length, 1)
}

function testValidation() {
  const plan = buildCustomizationImportPlan(
    [
      { option: "Small", price: "0" },
      { group: "Size", option: "", price: "0" },
      { group: "Bad Max", option: "A", min: "2", max: "1" },
    ],
    { skipExistingGroups: true },
    [],
  )
  assert.equal(plan.validGroups.length, 0)
  assert.ok(plan.validations[0] && !plan.validations[0].valid)
  assert.ok(plan.validations[1] && !plan.validations[1].valid)
  assert.ok(plan.validations[2] && !plan.validations[2].valid)
}

function testDuplicateOption() {
  const plan = buildCustomizationImportPlan(
    [
      { group: "Size", option: "Small", price: "0" },
      { group: "Size", option: "small", price: "1" },
      { group: "Size", option: "Large", price: "2" },
    ],
    { skipExistingGroups: true },
    [],
  )
  assert.equal(plan.validGroups.length, 1)
  assert.equal(plan.validGroups[0]?.options.length, 2)
  assert.ok(plan.validations.some((validation) => !validation.valid))
}

function testArabicContinuation() {
  const plan = buildCustomizationImportPlan(
    [
      {
        group: "Milk Choice",
        group_ar: "اختيار الحليب",
        instructions: "Choose milk",
        instructions_ar: "اختر الحليب",
        option: "Whole",
        option_ar: "كامل",
        price: "0",
      },
      { option: "Oat", option_ar: "شوفان", price: "0.75" },
    ],
    { skipExistingGroups: true },
    [],
  )
  assert.equal(plan.validGroups[0]?.i18n?.ar?.name, "اختيار الحليب")
  assert.equal(plan.validGroups[0]?.i18n?.ar?.customerInstructions, "اختر الحليب")
  assert.equal(plan.validGroups[0]?.options[1]?.i18n?.ar?.name, "شوفان")
}

testTemplateRoundTrip()
testContinuationRows()
testSkipExisting()
testValidation()
testDuplicateOption()
testArabicContinuation()

console.log("import-customizations checks passed")
