import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { db } from "@/db"
import { customizationGroups, customizationOptions } from "@/db/schema"
import { merchantLocations, merchantUsers } from "@/lib/db/schema"
import { withDbRetry, toUserFacingDbError } from "@/lib/db/withDbRetry"
import { catalogArField, normalizeCatalogI18n } from "@/lib/catalog-i18n"
import {
  buildCustomizationImportPlan,
  type CustomizationImportGroup,
  type CustomizationImportOptions,
} from "@/lib/menu/import-customizations"
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache"

export const runtime = "nodejs"

interface ImportRequestBody {
  locationId: string
  options: CustomizationImportOptions
  groups: CustomizationImportGroup[]
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

function groupsToRawRows(groups: CustomizationImportGroup[]): Record<string, string>[] {
  return groups.flatMap((group) =>
    group.options.map((option) => ({
      group: group.name,
      group_ar: catalogArField(group.i18n, "name"),
      instructions: group.customerInstructions ?? "",
      instructions_ar: catalogArField(group.i18n, "customerInstructions"),
      required: group.required ? "true" : "false",
      min: String(group.min),
      max: group.max == null ? "" : String(group.max),
      option: option.name,
      option_ar: catalogArField(option.i18n, "name"),
      price: String(option.priceDelta),
      default: option.isDefault ? "true" : "false",
    })),
  )
}

/**
 * POST /api/customizations/import
 * Bulk import customization groups from parsed CSV groups.
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
    const { locationId, groups, options } = body

    if (!locationId || !Array.isArray(groups)) {
      return NextResponse.json(
        { error: "Location ID and groups array are required" },
        { status: 400 },
      )
    }

    const importOptions: CustomizationImportOptions = {
      skipExistingGroups: options?.skipExistingGroups ?? true,
      dryRun: options?.dryRun ?? false,
    }

    const access = await verifyLocationAccess(locationId, user.id)
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const existingGroups = await withDbRetry(() =>
      db.query.customizationGroups.findMany({
        where: eq(customizationGroups.locationId, locationId),
        columns: { id: true, name: true, displayOrder: true },
      }),
    )

    const plan = buildCustomizationImportPlan(
      groupsToRawRows(groups),
      importOptions,
      existingGroups.map((group) => group.name),
    )

    if (importOptions.dryRun) {
      return NextResponse.json({
        created: plan.validGroups.length,
        skipped: groups.length - plan.validGroups.length,
        errors: plan.errors,
        groupIds: [],
        dryRun: true,
      })
    }

    if (plan.validGroups.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: groups.length,
        errors: plan.errors,
        groupIds: [],
      })
    }

    const maxOrder = existingGroups.reduce(
      (max, group) => Math.max(max, group.displayOrder ?? 0),
      existingGroups.length,
    )

    const createdIds: string[] = []
    const createErrors = [...plan.errors]

    for (const [index, group] of plan.validGroups.entries()) {
      try {
        const [created] = await withDbRetry(() =>
          db
            .insert(customizationGroups)
            .values({
              locationId,
              name: group.name,
              customerInstructions: group.customerInstructions || null,
              isRequired: group.required,
              minSelections: group.min,
              maxSelections: group.max,
              displayOrder: maxOrder + index + 1,
              i18n: normalizeCatalogI18n(group.i18n),
            })
            .returning({ id: customizationGroups.id }),
        )

        const insertedOptions = await withDbRetry(() =>
          db
            .insert(customizationOptions)
            .values(
              group.options.map((option, optionIndex) => ({
                groupId: created.id,
                name: option.name,
                price: option.priceDelta.toFixed(2),
                displayOrder: optionIndex,
                i18n: normalizeCatalogI18n(option.i18n),
              })),
            )
            .returning({ id: customizationOptions.id }),
        )

        const defaultOptionIds = insertedOptions
          .filter((_, optionIndex) => group.options[optionIndex]?.isDefault)
          .map((option) => option.id)

        if (defaultOptionIds.length > 0) {
          await withDbRetry(() =>
            db
              .update(customizationGroups)
              .set({ defaultOptionIds, updatedAt: new Date() })
              .where(eq(customizationGroups.id, created.id)),
          )
        }

        createdIds.push(created.id)
      } catch (error) {
        createErrors.push({
          row: 0,
          message: `Failed to create "${group.name}": ${toUserFacingDbError(error, "Database error")}`,
        })
      }
    }

    await revalidatePublicMenuForLocation(locationId)

    return NextResponse.json({
      created: createdIds.length,
      skipped: groups.length - createdIds.length,
      errors: createErrors,
      groupIds: createdIds,
    })
  } catch (error) {
    console.error("[POST /api/customizations/import] Error:", error)
    return NextResponse.json(
      {
        error: toUserFacingDbError(error, "Failed to import customization groups"),
      },
      { status: 500 },
    )
  }
}
