import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { db } from "@/db"
import { merchantLocations } from "@/lib/db/schema/merchant-locations"
import { merchantUsers } from "@/lib/db/schema/merchant-users"
import type { MerchantLocation } from "@/lib/db/schema/merchant-locations"
import { revalidateTag } from "next/cache"
import { unstable_cache } from "@/lib/unstable-cache"
import { revalidatePublicMenuForLocation, revalidatePublicMenuForSlug } from "@/lib/public-menu/publicMenuCache"
import { timezoneFromCountry } from "@/lib/timezone/fromCountry"
import { parseOptionalStoreSlug } from "@/lib/public-menu/guestMenuPaths"

export const runtime = "nodejs"

/**
 * GET /api/locations/[id]
 * Fetch location details by ID
 * Requires: User must be authenticated and belong to the merchant that owns the location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 16, params is always a Promise and must be awaited
    const { id: locationId } = await params

    // Get authenticated user
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      )
    }

    // Validate location ID
    if (!locationId || locationId.trim() === "") {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      )
    }

    // Cached location fetch - this can be shared across users who have access
    const getCachedLocation = unstable_cache(
      async () => {
        const location = await db.query.merchantLocations.findFirst({
          where: eq(merchantLocations.id, locationId),
        })
        return location
      },
      ["location-data", locationId],
      { revalidate: 600, tags: [`location-data:${locationId}`] }
    )

    const location = await getCachedLocation()

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      )
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
        role: true,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this location" },
        { status: 403 }
      )
    }

    // Return location data - no browser cache to prevent cross-user data leaks
    return NextResponse.json(location as MerchantLocation, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (error) {
    console.error("[GET /api/locations/[id]] Error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch location",
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/locations/[id]
 * Update location details
 * Requires: User must be authenticated and belong to the merchant that owns the location
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 16, params is always a Promise and must be awaited
    const { id: locationId } = await params

    // Get authenticated user
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      )
    }

    // Validate location ID
    if (!locationId || locationId.trim() === "") {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      )
    }

    // Get existing location to verify access
    const existingLocation = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
    })

    if (!existingLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      )
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingLocation.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
        role: true,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this location" },
        { status: 403 }
      )
    }

    const previousSlug = existingLocation.storeSlug

    // Parse request body
    const body = await request.json().catch(() => ({}))
    console.log("[PUT /api/locations/[id]] Received body:", body)

    // Map form fields to location schema
    const updateData: Partial<typeof merchantLocations.$inferInsert> = {
      updatedAt: new Date(),
    }

    // Basic info
    if (body.storeName !== undefined) {
      updateData.name = body.storeName
    }
    if (body.storeType !== undefined) {
      updateData.storeType = body.storeType || null
    }
    if (body.shortDescription !== undefined) {
      updateData.description = body.shortDescription || null
    }
    if (body.storeSlug !== undefined) {
      const parsedSlug = parseOptionalStoreSlug(body.storeSlug)
      if (!parsedSlug.ok) {
        return NextResponse.json({ error: parsedSlug.message }, { status: 400 })
      }
      updateData.storeSlug = parsedSlug.slug
    }

    // Address
    if (body.address?.street !== undefined) {
      updateData.address = body.address.street
    }
    if (body.address?.apartment !== undefined) {
      updateData.addressLine2 = body.address.apartment || null
    }
    if (body.address?.postalCode !== undefined) {
      updateData.postalCode = body.address.postalCode
    }
    if (body.address?.city !== undefined) {
      updateData.city = body.address.city
    }
    if (body.address?.country !== undefined) {
      updateData.country = body.address.country
    }

    const nextCountry =
      typeof updateData.country === "string"
        ? updateData.country
        : existingLocation.country
    updateData.timezone = timezoneFromCountry(nextCountry)

    // Contact
    if (body.phoneNumber !== undefined) {
      updateData.phone = body.phoneNumber
    }
    if (body.publicEmail !== undefined) {
      updateData.email = body.publicEmail || null
    }

    // Website & Social
    if (body.website !== undefined) {
      updateData.websiteUrl = body.website || null
    }
    if (body.instagram !== undefined) {
      updateData.instagramHandle = body.instagram || null
    }
    if (body.facebook !== undefined) {
      updateData.facebookUrl = body.facebook || null
    }
    if (body.tiktok !== undefined) {
      updateData.tiktokHandle = body.tiktok || null
    }

    // Operational settings
    if (body.enableTables !== undefined) {
      updateData.enableTables = body.enableTables
    }
    if (body.enableReservations !== undefined) {
      updateData.enableReservations = body.enableReservations
    }
    if (body.maxPartySize !== undefined) {
      updateData.maxPartySize = body.maxPartySize
    }
    if (body.bookingWindow !== undefined) {
      updateData.bookingWindowDays = body.bookingWindow
    }
    if (body.enableOnlineOrders !== undefined) {
      updateData.enableOnlineOrders = body.enableOnlineOrders
    }
    if (body.storeStatus !== undefined) {
      updateData.status = body.storeStatus
    }
    if (body.publicListing !== undefined) {
      updateData.visibleInDirectory = body.publicListing
    }

    // Opening hours - already in DB format from client
    if (body.openingHours !== undefined) {
      updateData.openingHours = body.openingHours
    }

    // Order modes - already in DB format from client
    if (body.orderModes !== undefined) {
      updateData.orderModes = body.orderModes
    }

    // Accent color
    if (body.accentColor !== undefined) {
      updateData.accentColor = body.accentColor || null
    }

    // Logo and banner URLs
    if (body.logoUrl !== undefined) {
      updateData.logoUrl = body.logoUrl ?? null
    }
    if (body.bannerUrl !== undefined) {
      updateData.bannerUrl = body.bannerUrl ?? null
    }

    // Tax rate (percent, e.g. 21 = 21%)
    if (body.taxRate !== undefined && body.taxRate !== null) {
      const taxRate = Number(body.taxRate)
      if (Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100) {
        updateData.taxRate = taxRate.toFixed(2)
      }
    }

    // Debug: Log the final update data
    console.log("[PUT /api/locations/[id]] Updating location with data:", updateData)

    // Update location
    await db
      .update(merchantLocations)
      .set(updateData)
      .where(eq(merchantLocations.id, locationId))

    // Fetch updated location
    const updatedLocation = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
    })

    if (!updatedLocation) {
      return NextResponse.json(
        { error: "Failed to retrieve updated location" },
        { status: 500 }
      )
    }

    // Return updated location data - no browser cache
    revalidateTag(`location-data:${locationId}`, { expire: 0 })
    if (existingLocation.merchantId) {
      revalidateTag(`merchant-locations:${existingLocation.merchantId}`, { expire: 0 })
    }
    if (
      previousSlug &&
      updatedLocation.storeSlug &&
      previousSlug.trim().toLowerCase() !== updatedLocation.storeSlug.trim().toLowerCase()
    ) {
      await revalidatePublicMenuForSlug(previousSlug)
    }
    await revalidatePublicMenuForLocation(locationId)
    return NextResponse.json(updatedLocation as MerchantLocation, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (error) {
    console.error("[PUT /api/locations/[id]] Error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to update location",
      },
      { status: 500 }
    )
  }
}
