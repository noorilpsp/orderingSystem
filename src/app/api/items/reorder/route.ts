import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { items, categoryItems } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache"

export async function PUT(request: NextRequest) {
  try {
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
    const { items: itemUpdates, categoryId } = body as {
      items?: Array<{ id?: string; displayOrder?: number }>
      categoryId?: string | null
    }

    if (!Array.isArray(itemUpdates)) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 })
    }

    const validUpdates = itemUpdates.filter(
      (update) => update.id && typeof update.displayOrder === "number",
    )

    if (typeof categoryId === "string" && categoryId.length > 0) {
      await Promise.all(
        validUpdates.map((update) =>
          db
            .update(categoryItems)
            .set({ displayOrder: update.displayOrder })
            .where(
              and(
                eq(categoryItems.itemId, update.id as string),
                eq(categoryItems.categoryId, categoryId),
              ),
            ),
        ),
      )
    } else {
      await Promise.all(
        validUpdates.map((update) =>
          db
            .update(items)
            .set({
              displayOrder: update.displayOrder,
              updatedAt: new Date(),
            })
            .where(eq(items.id, update.id as string)),
        ),
      )
    }

    await revalidatePublicMenuForLocation(locationId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error reordering items:", error)
    return NextResponse.json(
      { error: "Failed to reorder items" },
      { status: 500 },
    )
  }
}
