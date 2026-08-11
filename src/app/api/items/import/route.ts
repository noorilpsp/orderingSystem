import { NextRequest, NextResponse } from "next/server"
import { eq, and, inArray } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { db } from "@/db"
import {
  items,
  categories,
  categoryItems,
  itemTags,
  itemAllergens,
  menuCategories,
  tags,
  allergens,
  menus,
} from "@/db/schema"
import { merchantLocations, merchantUsers } from "@/lib/db/schema"
import { withDbRetry, toUserFacingDbError } from "@/lib/db/withDbRetry"
import {
  buildImportPlan,
  normalizeNameKey,
  type ImportRow,
  type ImportOptions,
  type ItemStatus,
  type ImportStationCatalog,
  type ImportMenuCatalog,
} from "@/lib/menu/import-items"
import { getLocationStationsWithSubstations } from "@/lib/kds/getLocationStations"
import { isLocationKdsEnabled } from "@/lib/merchant-features"

export const runtime = "nodejs"

interface ImportRequestBody {
  locationId: string
  options: ImportOptions
  rows: ImportRow[]
}

async function verifyLocationAccess(locationId: string, userId: string) {
  const location = await withDbRetry(() =>
    db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: { id: true, merchantId: true },
    }),
  )

  if (!location) {
    return { error: "Location not found", status: 404 as const }
  }

  const membership = await withDbRetry(() =>
    db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, userId),
        eq(merchantUsers.isActive, true),
      ),
      columns: { id: true },
    }),
  )

  if (!membership) {
    return { error: "Forbidden - You don't have access to this location", status: 403 as const }
  }

  return { location }
}

function resolveStatus(row: ImportRow, defaultStatus: ItemStatus): ItemStatus {
  return row.status ?? defaultStatus
}

/**
 * POST /api/items/import
 * Bulk import menu items from parsed CSV rows.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ImportRequestBody>
    const { locationId, rows, options } = body

    if (!locationId || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "Location ID and rows array are required" },
        { status: 400 },
      )
    }

    const importOptions: ImportOptions = {
      createMissingCategories: options?.createMissingCategories ?? true,
      defaultStatus: options?.defaultStatus ?? "draft",
      menuId: options?.menuId,
      dryRun: options?.dryRun ?? false,
    }

    const access = await verifyLocationAccess(locationId, user.id)
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const existingCategories = await withDbRetry(() =>
      db.query.categories.findMany({
        where: eq(categories.locationId, locationId),
        columns: { id: true, name: true },
      }),
    )

    const kdsEnabled = await isLocationKdsEnabled(locationId)
    const stationRows = kdsEnabled
      ? await withDbRetry(() => getLocationStationsWithSubstations(locationId))
      : []
    const stationCatalog: ImportStationCatalog = stationRows.map((s) => ({
      key: s.key,
      name: s.name,
      isActive: true,
      substations: s.substations.map((ss) => ({ key: ss.key, name: ss.name })),
    }))

    const locationMenus = await withDbRetry(() =>
      db.query.menus.findMany({
        where: eq(menus.locationId, locationId),
        columns: { id: true, name: true, status: true },
      }),
    )
    const menuCatalog: ImportMenuCatalog = locationMenus.map((m) => ({
      id: m.id,
      name: m.name,
      isActive: m.status === "active",
    }))

    const rawRows = rows.map((row) => ({
      name: row.name,
      price: String(row.price),
      category: row.category ?? "",
      description: row.description ?? "",
      photo_url: row.photoUrl ?? "",
      prep_station: row.defaultStation ?? "",
      kitchen_lane: row.defaultSubstation ?? "",
      menu: row.menuNames?.join(";") ?? "",
      tags: row.tags?.join(";") ?? "",
      allergens: row.allergens?.join(";") ?? "",
      calories: row.calories !== undefined ? String(row.calories) : "",
      status: row.status ?? "",
    }))

    const plan = buildImportPlan(
      rawRows,
      importOptions,
      existingCategories,
      stationCatalog,
      menuCatalog,
    )

    if (importOptions.dryRun) {
      return NextResponse.json({
        created: plan.validRows.length,
        skipped: plan.validations.length - plan.validRows.length,
        categoriesCreated: plan.categoriesToCreate,
        errors: plan.errors,
        itemIds: [],
        dryRun: true,
      })
    }

    if (plan.validRows.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: plan.validations.length,
        categoriesCreated: [],
        errors: plan.errors,
        itemIds: [],
      })
    }

    if (importOptions.menuId) {
      const menu = await withDbRetry(() =>
        db.query.menus.findFirst({
          where: and(eq(menus.id, importOptions.menuId!), eq(menus.locationId, locationId)),
          columns: { id: true },
        }),
      )
      if (!menu) {
        return NextResponse.json(
          { error: "Menu not found for this location" },
          { status: 400 },
        )
      }
    }

    const categoryMap = new Map<string, string>()
    for (const cat of existingCategories) {
      categoryMap.set(normalizeNameKey(cat.name), cat.id)
    }

    const categoriesCreated: string[] = []

    if (plan.categoriesToCreate.length > 0 && importOptions.createMissingCategories) {
      const maxOrder = existingCategories.length
      const inserted = await withDbRetry(() =>
        db
          .insert(categories)
          .values(
            plan.categoriesToCreate.map((name, index) => ({
              locationId,
              name,
              displayOrder: maxOrder + index,
            })),
          )
          .returning({ id: categories.id, name: categories.name }),
      )

      for (const cat of inserted) {
        categoryMap.set(normalizeNameKey(cat.name), cat.id)
        categoriesCreated.push(cat.name)
      }
    }

    const categoryMenuLinks = new Map<string, Set<string>>()
    for (const row of plan.validRows) {
      if (!row.category) continue
      const categoryId = categoryMap.get(normalizeNameKey(row.category))
      if (!categoryId) continue

      const menuIdsForRow =
        row.menuIds && row.menuIds.length > 0
          ? row.menuIds
          : importOptions.menuId
            ? [importOptions.menuId]
            : []

      if (!categoryMenuLinks.has(categoryId)) {
        categoryMenuLinks.set(categoryId, new Set())
      }
      for (const mid of menuIdsForRow) {
        categoryMenuLinks.get(categoryId)!.add(mid)
      }
    }

    const categoryIdsToLink = [...categoryMenuLinks.keys()]
    if (categoryIdsToLink.length > 0) {
      const existingLinks = await withDbRetry(() =>
        db.query.menuCategories.findMany({
          where: inArray(menuCategories.categoryId, categoryIdsToLink),
          columns: { menuId: true, categoryId: true },
        }),
      )
      const existingPairs = new Set(
        existingLinks.map((link) => `${link.menuId}:${link.categoryId}`),
      )

      const menuCategoryValues: Array<{
        menuId: string
        categoryId: string
        displayOrder: number
      }> = []

      for (const [categoryId, menuIdSet] of categoryMenuLinks) {
        let order = 0
        for (const menuId of menuIdSet) {
          const key = `${menuId}:${categoryId}`
          if (!existingPairs.has(key)) {
            menuCategoryValues.push({
              menuId,
              categoryId,
              displayOrder: order++,
            })
            existingPairs.add(key)
          }
        }
      }

      if (menuCategoryValues.length > 0) {
        await withDbRetry(() => db.insert(menuCategories).values(menuCategoryValues))
      }
    }

    const existingTags = await withDbRetry(() =>
      db.query.tags.findMany({
        where: eq(tags.locationId, locationId),
        columns: { id: true, name: true },
      }),
    )
    const tagMap = new Map<string, string>()
    for (const tag of existingTags) {
      tagMap.set(normalizeNameKey(tag.name), tag.id)
    }

    const tagNamesToCreate = new Set<string>()
    for (const row of plan.validRows) {
      for (const tag of row.tags ?? []) {
        if (!tagMap.has(normalizeNameKey(tag))) {
          tagNamesToCreate.add(tag.trim())
        }
      }
    }

    if (tagNamesToCreate.size > 0) {
      const insertedTags = await withDbRetry(() =>
        db
          .insert(tags)
          .values([...tagNamesToCreate].map((name) => ({ locationId, name })))
          .returning({ id: tags.id, name: tags.name }),
      )
      for (const tag of insertedTags) {
        tagMap.set(normalizeNameKey(tag.name), tag.id)
      }
    }

    const existingAllergens = await withDbRetry(() =>
      db.query.allergens.findMany({
        where: eq(allergens.locationId, locationId),
        columns: { id: true, name: true },
      }),
    )
    const allergenMap = new Map<string, string>()
    for (const allergen of existingAllergens) {
      allergenMap.set(normalizeNameKey(allergen.name), allergen.id)
    }

    const allergenNamesToCreate = new Set<string>()
    for (const row of plan.validRows) {
      for (const allergen of row.allergens ?? []) {
        if (!allergenMap.has(normalizeNameKey(allergen))) {
          allergenNamesToCreate.add(allergen.trim())
        }
      }
    }

    if (allergenNamesToCreate.size > 0) {
      const insertedAllergens = await withDbRetry(() =>
        db
          .insert(allergens)
          .values([...allergenNamesToCreate].map((name) => ({ locationId, name })))
          .returning({ id: allergens.id, name: allergens.name }),
      )
      for (const allergen of insertedAllergens) {
        allergenMap.set(normalizeNameKey(allergen.name), allergen.id)
      }
    }

    const insertedItems = await withDbRetry(() =>
      db
        .insert(items)
        .values(
          plan.validRows.map((row, index) => ({
            locationId,
            name: row.name,
            description: row.description ?? null,
            price: row.price.toString(),
            photoUrl: row.photoUrl ?? null,
            calories: row.calories ?? null,
            status: resolveStatus(row, importOptions.defaultStatus),
            displayOrder: index,
            useCustomHours: false,
            defaultStation: kdsEnabled ? (row.defaultStation ?? null) : null,
            defaultSubstation: kdsEnabled ? (row.defaultSubstation ?? null) : null,
          })),
        )
        .returning({ id: items.id }),
    )

    const categoryItemValues: Array<{
      categoryId: string
      itemId: string
      displayOrder: number
    }> = []
    const itemTagValues: Array<{ tagId: string; itemId: string }> = []
    const itemAllergenValues: Array<{ allergenId: string; itemId: string }> = []

    for (let i = 0; i < plan.validRows.length; i++) {
      const row = plan.validRows[i]
      const itemId = insertedItems[i].id

      if (row.category) {
        const categoryId = categoryMap.get(normalizeNameKey(row.category))
        if (categoryId) {
          categoryItemValues.push({ categoryId, itemId, displayOrder: 0 })
        }
      }

      for (const tag of row.tags ?? []) {
        const tagId = tagMap.get(normalizeNameKey(tag))
        if (tagId) {
          itemTagValues.push({ tagId, itemId })
        }
      }

      for (const allergen of row.allergens ?? []) {
        const allergenId = allergenMap.get(normalizeNameKey(allergen))
        if (allergenId) {
          itemAllergenValues.push({ allergenId, itemId })
        }
      }
    }

    if (categoryItemValues.length > 0) {
      await withDbRetry(() => db.insert(categoryItems).values(categoryItemValues))
    }
    if (itemTagValues.length > 0) {
      await withDbRetry(() => db.insert(itemTags).values(itemTagValues))
    }
    if (itemAllergenValues.length > 0) {
      await withDbRetry(() => db.insert(itemAllergens).values(itemAllergenValues))
    }

    return NextResponse.json({
      created: insertedItems.length,
      skipped: plan.validations.length - plan.validRows.length,
      categoriesCreated,
      errors: plan.errors,
      itemIds: insertedItems.map((item) => item.id),
    })
  } catch (error) {
    console.error("[POST /api/items/import] Error:", error)
    return NextResponse.json(
      {
        error: toUserFacingDbError(error, "Failed to import menu items"),
      },
      { status: 500 },
    )
  }
}
