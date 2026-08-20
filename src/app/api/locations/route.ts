import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { supabaseServer } from "@/lib/supabaseServer"
import { db } from "@/db"
import { merchantLocations } from "@/lib/db/schema/merchant-locations"
import { merchantUsers } from "@/lib/db/schema/merchant-users"
import type { MerchantLocation } from "@/lib/db/schema/merchant-locations"
import { revalidateTag } from "next/cache"
import { unstable_cache } from "@/lib/unstable-cache"
import { revalidatePublicMenuForSlug } from "@/lib/public-menu/publicMenuCache"
import { timezoneFromCountry } from "@/lib/timezone/fromCountry"

export const runtime = "nodejs"

/**
 * GET /api/locations
 * Fetch all locations for the current merchant
 * Requires: User must be authenticated and belong to a merchant
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get merchant ID from query params or header (or use current merchant from context)
    // For now, we'll get it from the query param or check user's merchant membership
    const { searchParams } = new URL(request.url)
    const merchantId = searchParams.get("merchantId")

    if (!merchantId) {
      return NextResponse.json(
        { error: "Merchant ID is required" },
        { status: 400 }
      )
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, merchantId),
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
        { error: "Forbidden - You don't have access to this merchant" },
        { status: 403 }
      )
    }

    // Cached locations fetch - shared across users who have access
    const getCachedLocations = unstable_cache(
      async () => {
        const locations = await db.query.merchantLocations.findMany({
          where: eq(merchantLocations.merchantId, merchantId),
          orderBy: (locations, { desc }) => [desc(locations.createdAt)],
        })
        return locations
      },
      ["merchant-locations-list", merchantId],
      { revalidate: 600, tags: [`merchant-locations:${merchantId}`] }
    )

    const locations = await getCachedLocations()

    // Return locations - no browser cache to prevent cross-user data leaks
    return NextResponse.json(locations as MerchantLocation[], {
      status: 200,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (error) {
    console.error("[GET /api/locations] Error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch locations",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/locations
 * Create a new location for the current merchant
 * Requires: User must be authenticated and belong to the merchant
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parse request body
    const body = await request.json().catch(() => ({}))

    const merchantId = body.merchantId

    if (!merchantId) {
      return NextResponse.json(
        { error: "Merchant ID is required" },
        { status: 400 }
      )
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, merchantId),
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
        { error: "Forbidden - You don't have access to this merchant" },
        { status: 403 }
      )
    }

    // Map form data to location schema
    const rawStatus = body.storeStatus || "active"
    const status: typeof merchantLocations.$inferInsert.status =
      rawStatus === "active" ||
      rawStatus === "inactive" ||
      rawStatus === "coming_soon" ||
      rawStatus === "temporarily_closed"
        ? rawStatus
        : "active"

    const country = body.address?.country || body.country || "Belgium"

    const locationData: typeof merchantLocations.$inferInsert = {
      merchantId,
      name: body.storeName || body.name || "New Location",
      storeType: body.storeType || null,
      description: body.shortDescription || body.description || null,
      storeSlug: body.storeSlug || null,
      address: body.address?.street || body.address || "",
      addressLine2: body.address?.apartment || body.addressLine2 || null,
      postalCode: body.address?.postalCode || body.postalCode || "",
      city: body.address?.city || body.city || "",
      country,
      phone: body.phoneNumber || body.phone || "",
      email: body.publicEmail || body.email || null,
      websiteUrl: body.website || null,
      instagramHandle: body.instagram || null,
      facebookUrl: body.facebook || null,
      tiktokHandle: body.tiktok || null,
      enableTables: body.enableTables ?? false,
      enableReservations: body.enableReservations ?? false,
      maxPartySize: body.maxPartySize || 8,
      bookingWindowDays: body.bookingWindow || body.bookingWindowDays || 30,
      enableOnlineOrders: body.enableOnlineOrders ?? true,
      status,
      visibleInDirectory: body.publicListing ?? true,
      timezone: timezoneFromCountry(country),
      // Opening hours and order modes - already in DB format from client
      openingHours: body.openingHours || {},
      orderModes:
        body.orderModes || {
          dine_in: { enabled: true },
          pickup: { enabled: true },
          delivery: { enabled: false },
        },
      accentColor: body.accentColor || null,
      logoUrl: body.logoUrl ?? null,
      bannerUrl: body.bannerUrl ?? null,
    }

    if (body.taxRate !== undefined && body.taxRate !== null) {
      const taxRate = Number(body.taxRate)
      if (Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100) {
        locationData.taxRate = taxRate.toFixed(2)
      }
    }

    // Create location
    const [newLocation] = await db
      .insert(merchantLocations)
      .values(locationData)
      .returning()

    revalidateTag(`merchant-locations:${merchantId}`, { expire: 0 })
    await revalidatePublicMenuForSlug(newLocation?.storeSlug)

    // Return created location - no browser cache
    return NextResponse.json(newLocation as MerchantLocation, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (error) {
    console.error("[POST /api/locations] Error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to create location",
      },
      { status: 500 }
    )
  }
}
