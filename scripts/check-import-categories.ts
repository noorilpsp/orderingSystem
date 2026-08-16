import assert from "node:assert/strict"
import Papa from "papaparse"
import { buildCategoryImportPlan } from "../src/lib/menu/import-categories"
import { buildCategoryImportTemplateCsv } from "../src/lib/menu/import-category-template"

function parseCsv(csv: string): Record<string, string>[] {
  const results = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  })
  return results.data.filter((row) => Object.values(row).some((value) => value?.trim()))
}

function testTemplateRoundTrip() {
  const csv = buildCategoryImportTemplateCsv([
    { id: "menu-1", name: "Lunch Menu", isActive: true },
  ])
  const rows = parseCsv(csv)
  const plan = buildCategoryImportPlan(
    rows,
    { skipExistingCategories: true },
    [],
    [{ id: "menu-1", name: "Lunch Menu", isActive: true }],
  )
  assert.equal(plan.validRows.length, 2)
  assert.equal(plan.validRows[0]?.name, "Pizzas")
  assert.equal(plan.validRows[0]?.emoji, "🍕")
  assert.equal(plan.validRows[0]?.i18n?.ar?.name, "بيتزا")
  assert.deepEqual(plan.validRows[0]?.menuNames, ["Lunch Menu"])
  assert.equal(plan.validRows[1]?.name, "Salads")
}

function testSkipExistingAndDuplicates() {
  const rows = [
    { name: "Pizzas", description: "A", emoji: "🍕", menu: "" },
    { name: "pizzas", description: "B", emoji: "", menu: "" },
    { name: "Salads", description: "", emoji: "🥗", menu: "" },
  ]
  const skipped = buildCategoryImportPlan(rows, { skipExistingCategories: true }, ["Pizzas"])
  assert.equal(skipped.validRows.length, 1)
  assert.equal(skipped.validRows[0]?.name, "Salads")

  const created = buildCategoryImportPlan(rows, { skipExistingCategories: false }, ["Pizzas"])
  assert.equal(created.validRows.length, 2)
}

function testMenuFallback() {
  const plan = buildCategoryImportPlan(
    [{ name: "Mains", menu: "" }],
    { skipExistingCategories: true, menuId: "menu-1" },
    [],
    [{ id: "menu-1", name: "Dinner", isActive: true }],
  )
  assert.equal(plan.validRows.length, 1)
  assert.deepEqual(plan.validRows[0]?.menuIds, ["menu-1"])
  assert.deepEqual(plan.validRows[0]?.menuNames, ["Dinner"])
}

function testUnknownMenuWarning() {
  const plan = buildCategoryImportPlan(
    [{ name: "Drinks", menu: "Brunch; Dinner" }],
    { skipExistingCategories: true },
    [],
    [{ id: "menu-1", name: "Dinner", isActive: true }],
  )
  assert.equal(plan.validRows.length, 1)
  assert.deepEqual(plan.validRows[0]?.menuNames, ["Dinner"])
  assert.ok(plan.validations[0]?.warnings.some((warning) => warning.message.includes("Brunch")))
}

function testArabicFields() {
  const plan = buildCategoryImportPlan(
    [
      {
        name: "Pizzas",
        name_ar: "بيتزا",
        description: "Wood-fired",
        description_ar: "فرن حطب",
      },
    ],
    { skipExistingCategories: true },
    [],
  )
  assert.equal(plan.validRows[0]?.i18n?.ar?.name, "بيتزا")
  assert.equal(plan.validRows[0]?.i18n?.ar?.description, "فرن حطب")
}

testTemplateRoundTrip()
testSkipExistingAndDuplicates()
testMenuFallback()
testUnknownMenuWarning()
testArabicFields()

console.log("import-categories checks passed")
