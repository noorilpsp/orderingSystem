import assert from "node:assert/strict"
import {
  buildImportPlan,
  normalizePrice,
  normalizeNameKey,
  normalizePhotoUrl,
  parseListField,
  resolveKdsFields,
  resolveMenuFields,
  type ImportMenuCatalog,
  type ImportStationCatalog,
} from "../src/lib/menu/import-items"

function testNormalizePrice() {
  assert.equal(normalizePrice("14.50"), 14.5)
  assert.equal(normalizePrice("14,50"), 14.5)
  assert.equal(normalizePrice("$9.00"), 9)
  assert.equal(normalizePrice("€12.99"), 12.99)
  assert.equal(normalizePrice(""), null)
  assert.equal(normalizePrice("abc"), null)
  assert.equal(normalizePrice("-5"), null)
}

function testParseListField() {
  assert.deepEqual(parseListField("Popular;Spicy"), ["Popular", "Spicy"])
  assert.deepEqual(parseListField(""), [])
  assert.deepEqual(parseListField("  Gluten ; Dairy "), ["Gluten", "Dairy"])
}

function testCategoryMatching() {
  const plan = buildImportPlan(
    [
      { name: "Burger", price: "12", category: "mains" },
      { name: "Fries", price: "5", category: "Mains" },
    ],
    { createMissingCategories: true, defaultStatus: "draft" },
    [{ id: "cat-1", name: "Mains" }],
  )
  assert.equal(plan.validRows.length, 2)
  assert.equal(plan.categoriesToCreate.length, 0)
}

function testUnknownCategoryWithoutAutoCreate() {
  const plan = buildImportPlan(
    [{ name: "Soup", price: "8", category: "Soups" }],
    { createMissingCategories: false, defaultStatus: "draft" },
    [],
  )
  assert.equal(plan.validRows.length, 0)
  assert.equal(plan.errors.length, 1)
  assert.match(plan.errors[0].message, /Unknown category/)
}

function testAutoCreateCategory() {
  const plan = buildImportPlan(
    [{ name: "Soup", price: "8", category: "Soups" }],
    { createMissingCategories: true, defaultStatus: "draft" },
    [],
  )
  assert.equal(plan.validRows.length, 1)
  assert.deepEqual(plan.categoriesToCreate, ["Soups"])
}

function testInvalidRowSkipped() {
  const plan = buildImportPlan(
    [
      { name: "Good", price: "10", category: "Food" },
      { name: "", price: "5", category: "Food" },
      { name: "Bad", price: "nope", category: "Food" },
    ],
    { createMissingCategories: true, defaultStatus: "draft" },
    [{ id: "c1", name: "Food" }],
  )
  assert.equal(plan.validRows.length, 1)
  assert.equal(plan.errors.length, 2)
}

function testNormalizeNameKey() {
  assert.equal(normalizeNameKey("  Pizzas "), "pizzas")
}

function testArabicFields() {
  const plan = buildImportPlan(
    [
      {
        name: "Margherita Pizza",
        name_ar: "بيتزا مارغريتا",
        price: "14.50",
        category: "Pizzas",
        description: "Classic",
        description_ar: "كلاسيكية",
      },
    ],
    { createMissingCategories: true, defaultStatus: "draft" },
    [{ id: "cat-1", name: "Pizzas" }],
  )
  assert.equal(plan.validRows[0]?.i18n?.ar?.name, "بيتزا مارغريتا")
  assert.equal(plan.validRows[0]?.i18n?.ar?.description, "كلاسيكية")
}

function testNormalizePhotoUrl() {
  assert.equal(
    normalizePhotoUrl("https://example.com/pizza.jpg"),
    "https://example.com/pizza.jpg",
  )
  assert.equal(normalizePhotoUrl(""), null)
  assert.equal(normalizePhotoUrl("not-a-url"), null)
  assert.equal(normalizePhotoUrl("ftp://example.com/a.jpg"), null)
}

function testPhotoUrlInImportPlan() {
  const plan = buildImportPlan(
    [
      {
        name: "Pizza",
        price: "12",
        category: "Food",
        photo_url: "https://example.com/pizza.jpg",
      },
    ],
    { createMissingCategories: true, defaultStatus: "draft" },
    [{ id: "c1", name: "Food" }],
  )
  assert.equal(plan.validRows[0]?.photoUrl, "https://example.com/pizza.jpg")
}

const sampleCatalog: ImportStationCatalog = [
  {
    key: "kitchen",
    name: "Kitchen",
    isActive: true,
    substations: [
      { key: "grill", name: "Grill" },
      { key: "fryer", name: "Fryer" },
    ],
  },
  {
    key: "bar",
    name: "Bar",
    isActive: true,
    substations: [],
  },
]

function testKdsFields() {
  const resolved = resolveKdsFields("kitchen", "grill", sampleCatalog, 2)
  assert.equal(resolved.defaultStation, "kitchen")
  assert.equal(resolved.defaultSubstation, "grill")
  assert.equal(resolved.warnings.length, 0)

  const laneWithoutStation = resolveKdsFields("", "grill", sampleCatalog, 3)
  assert.equal(laneWithoutStation.defaultSubstation, undefined)
  assert.match(laneWithoutStation.warnings[0]?.message ?? "", /prep_station/)

  const barLane = resolveKdsFields("bar", "grill", sampleCatalog, 4)
  assert.equal(barLane.defaultStation, "bar")
  assert.equal(barLane.defaultSubstation, undefined)
  assert.match(barLane.warnings[0]?.message ?? "", /no kitchen lanes/)
}

function testKdsInImportPlan() {
  const plan = buildImportPlan(
    [
      {
        name: "Burger",
        price: "14",
        category: "Mains",
        prep_station: "Kitchen",
        kitchen_lane: "Grill",
      },
    ],
    { createMissingCategories: true, defaultStatus: "draft" },
    [{ id: "c1", name: "Mains" }],
    sampleCatalog,
  )
  assert.equal(plan.validRows[0]?.defaultStation, "kitchen")
  assert.equal(plan.validRows[0]?.defaultSubstation, "grill")
}

const sampleMenus: ImportMenuCatalog = [
  { id: "menu-lunch", name: "Lunch Menu", isActive: true },
  { id: "menu-dinner", name: "Dinner Menu", isActive: true },
]

function testMenuFields() {
  const resolved = resolveMenuFields("Lunch Menu", sampleMenus, 2)
  assert.deepEqual(resolved.menuIds, ["menu-lunch"])
  assert.deepEqual(resolved.menuNames, ["Lunch Menu"])

  const multi = resolveMenuFields("Lunch Menu;Dinner Menu", sampleMenus, 3)
  assert.equal(multi.menuIds?.length, 2)

  const fallback = resolveMenuFields("", sampleMenus, 4, "menu-dinner")
  assert.deepEqual(fallback.menuIds, ["menu-dinner"])
}

function testMenuInImportPlan() {
  const plan = buildImportPlan(
    [
      {
        name: "Soup",
        price: "8",
        category: "Starters",
        menu: "Lunch Menu",
      },
    ],
    { createMissingCategories: true, defaultStatus: "draft" },
    [],
    undefined,
    sampleMenus,
  )
  assert.equal(plan.validRows[0]?.menuIds?.[0], "menu-lunch")
}

testNormalizePrice()
testParseListField()
testNormalizePhotoUrl()
testPhotoUrlInImportPlan()
testKdsFields()
testKdsInImportPlan()
testMenuFields()
testMenuInImportPlan()
testCategoryMatching()
testUnknownCategoryWithoutAutoCreate()
testAutoCreateCategory()
testInvalidRowSkipped()
testNormalizeNameKey()
testArabicFields()

console.log("check-import-items: all tests passed")
