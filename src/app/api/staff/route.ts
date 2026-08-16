import { NextRequest } from "next/server"
import { and, asc, eq } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { db } from "@/db"
import { merchantLocations, merchantUsers } from "@/lib/db/schema"
import { staff } from "@/lib/db/schema/staff"
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope"

export const runtime = "nodejs"

/**
 * GET /api/staff?locationId=...
 * Active staff roster for a location the current user can access.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401 })
    }

    const locationId = new URL(request.url).searchParams.get("locationId")
    if (!locationId) {
      return posFailure("BAD_REQUEST", "locationId is required", { status: 400 })
    }

    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: { id: true, merchantId: true },
    })
    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 })
    }

    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true),
      ),
      columns: { id: true },
    })
    if (!membership) {
      return posFailure("FORBIDDEN", "Forbidden - You don't have access to this location", {
        status: 403,
      })
    }

    const staffRows = await db.query.staff.findMany({
      where: and(eq(staff.locationId, locationId), eq(staff.isActive, true)),
      columns: {
        id: true,
        fullName: true,
        role: true,
      },
      orderBy: [asc(staff.fullName)],
    })

    const res = posSuccess({
      staff: staffRows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        role: row.role,
      })),
    })
    res.headers.set("Cache-Control", "no-store, must-revalidate")
    return res
  } catch (error) {
    console.error("[GET /api/staff] Error:", error)
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to fetch staff"),
      { status: 500 },
    )
  }
}
