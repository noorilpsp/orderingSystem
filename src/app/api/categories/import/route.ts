import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { db } from "@/db"
import { categories, menuCategories, menus } from "@/db/schema"
import { merchantLocations, merchantUsers } from "@/lib/db/schema"
import { withDbRetry, toUserFacingDbError } from "@/lib/db/withDbRetry"
import { normalizeCatalogI18n } from "@/lib/catalog-i18n"
import {
  buildCategoryImportPlan,
  type CategoryImportOptions,
  type CategoryImportRow,
} from "@/lib/menu/import-categories"
import type { ImportMenuCatalog } from "@/lib/menu/import-items"

export const runtime = "nodejs"

interface ImportRequestBody {
  locationId: string
  options: CategoryImportOptions
  rows: CategoryImportRow[]
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

function rowsToRaw(rows: CategoryImportRow[]): Record<string, string>[] {
  return rows.map((row) => ({
    name: row.name,
    name_ar: row.i18n?.ar?.name ?? "",
    description: row.description ?? "",
    description_ar: row.i18n?.ar?.description ?? "",
    emoji: row.emoji ?? "",
    menu: row.menuNames?.join(";") ?? "",
  }))
}

/**
 * POST /api/categories/import
 * Bulk import categories from parsed CSV rows.
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

    const importOptions: CategoryImportOptions = {
      skipExistingCategories: options?.skipExistingCategories ?? true,
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
        columns: { id: true, name: true, displayOrder: true },
      }),
    )

    const locationMenus = await withDbRetry(() =>
      db.query.menus.findMany({
        where: eq(menus.locationId, locationId),
        columns: { id: true, name: true, status: true },
      }),
    )
    const menuCatalog: ImportMenuCatalog = locationMenus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      isActive: menu.status === "active",
    }))

    if (importOptions.menuId) {
      const menu = menuCatalog.find((entry) => entry.id === importOptions.menuId)
      if (!menu) {
        return NextResponse.json(
          { error: "Menu not found for this location" },
          { status: 400 },
        )
      }
    }

    const plan = buildCategoryImportPlan(
      rowsToRaw(rows),
      importOptions,
      existingCategories.map((category) => category.name),
      menuCatalog,
    )

    if (importOptions.dryRun) {
      return NextResponse.json({
        created: plan.validRows.length,
        skipped: rows.length - plan.validRows.length,
        errors: plan.errors,
        categoryIds: [],
        dryRun: true,
      })
    }

    if (plan.validRows.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: rows.length,
        errors: plan.errors,
        categoryIds: [],
      })
    }

    const maxOrder = existingCategories.reduce(
      (max, category) => Math.max(max, category.displayOrder ?? 0),
      existingCategories.length,
    )

    const createdIds: string[] = []
    const createErrors = [...plan.errors]
    const menuLinks: Array<{ menuId: string; categoryId: string; displayOrder: number }> = []

    for (const [index, row] of plan.validRows.entries()) {
      try {
        const [created] = await withDbRetry(() =>
          db
            .insert(categories)
            .values({
              locationId,
              name: row.name,
              description: row.description || null,
              emoji: row.emoji || null,
              displayOrder: maxOrder + index + 1,
              i18n: normalizeCatalogI18n(row.i18n),
            })
            .returning({ id: categories.id }),
        )

        createdIds.push(created.id)

        const menuIds =
          row.menuIds && row.menuIds.length > 0
            ? row.menuIds
            : importOptions.menuId
              ? [importOptions.menuId]
              : []

        menuIds.forEach((menuId, menuIndex) => {
          if (menuCatalog.some((menu) => menu.id === menuId)) {
            menuLinks.push({
              menuId,
              categoryId: created.id,
              displayOrder: menuIndex,
            })
          }
        })
      } catch (error) {
        createErrors.push({
          row: 0,
          message: `Failed to create "${row.name}": ${toUserFacingDbError(error, "Database error")}`,
        })
      }
    }

    if (menuLinks.length > 0) {
      await withDbRetry(() => db.insert(menuCategories).values(menuLinks))
    }

    return NextResponse.json({
      created: createdIds.length,
      skipped: rows.length - createdIds.length,
      errors: createErrors,
      categoryIds: createdIds,
    })
  } catch (error) {
    console.error("[POST /api/categories/import] Error:", error)
    return NextResponse.json(
      {
        error: toUserFacingDbError(error, "Failed to import categories"),
      },
      { status: 500 },
    )
  }
}
