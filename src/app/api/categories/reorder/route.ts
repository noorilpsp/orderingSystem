import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { categories } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache"
import { revalidateCategoriesList } from "@/lib/menu/categoriesListCache"

export async function PUT(request: NextRequest) {
  try {
    // Auth check
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("locationId")

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 })
    }

    const body = await request.json()
    const { categories: categoryUpdates } = body

    if (!Array.isArray(categoryUpdates)) {
      return NextResponse.json({ error: "categories array is required" }, { status: 400 })
    }

    // Update all categories in parallel (Neon HTTP doesn't support transactions)
    await Promise.all(
      categoryUpdates
        .filter((update) => update.id && typeof update.displayOrder === 'number')
        .map((update) =>
          db
            .update(categories)
            .set({ 
              displayOrder: update.displayOrder,
              updatedAt: new Date(),
            })
            .where(eq(categories.id, update.id))
        )
    )

    await revalidatePublicMenuForLocation(locationId)
    revalidateCategoriesList(locationId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error reordering categories:", error)
    return NextResponse.json(
      { error: "Failed to reorder categories" },
      { status: 500 }
    )
  }
}
