import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { items } from "@/lib/db/schema/menus"
import { eq } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache"

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
    const { items: itemUpdates } = body

    if (!Array.isArray(itemUpdates)) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 })
    }

    // Update all items in parallel (Neon HTTP doesn't support transactions)
    await Promise.all(
      itemUpdates
        .filter((update) => update.id && typeof update.displayOrder === 'number')
        .map((update) =>
          db
            .update(items)
            .set({ 
              displayOrder: update.displayOrder,
              updatedAt: new Date(),
            })
            .where(eq(items.id, update.id))
        )
    )

    await revalidatePublicMenuForLocation(locationId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error reordering items:", error)
    return NextResponse.json(
      { error: "Failed to reorder items" },
      { status: 500 }
    )
  }
}
