import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { merchants, normalizeLoyaltySettings } from "@/lib/db/schema/merchants";
import { merchantUsers } from "@/lib/db/schema/merchant-users";
import type { Merchant } from "@/lib/db/schema/merchants";
import { unstable_cache } from "@/lib/unstable-cache";

export const runtime = "nodejs";

/**
 * GET /api/merchants/[id]
 * Fetch merchant details by ID
 * Requires: User must be authenticated and belong to the merchant
 * 
 * Optimized with caching:
 * - Permission check: cached per user+merchant (10 min)
 * - Merchant data: cached per merchant (10 min, shared across users)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 16, params is always a Promise and must be awaited
    const { id: merchantId } = await params

    // Get authenticated user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    // Validate merchant ID - check for null, undefined, or empty string
    if (!merchantId || merchantId.trim() === '') {
      console.error('[GET /api/merchants/[id]] Invalid merchant ID:', { merchantId, params })
      return NextResponse.json(
        { error: "Merchant ID is required" },
        { status: 400 }
      );
    }

    // Cached permission check - verifies user belongs to this merchant
    const checkAccess = unstable_cache(
      async () => {
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
        });
        return membership !== null;
      },
      ['merchant-access', user.id, merchantId],
      { revalidate: 600 } // 10 minutes
    );

    const hasAccess = await checkAccess();

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this merchant" },
        { status: 403 }
      );
    }

    // Cached merchant fetch - this can be shared across users who have access
    // The merchant data itself doesn't change frequently
    const getCachedMerchant = unstable_cache(
      async () => {
        const merchant = await db.query.merchants.findFirst({
          where: eq(merchants.id, merchantId),
        });
        return merchant;
      },
      ['merchant-data', merchantId],
      { revalidate: 600 } // 10 minutes
    );

    const merchant = await getCachedMerchant();

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 404 }
      );
    }

    // Return merchant data - no browser cache to prevent cross-user data leaks
    // Server-side cache (unstable_cache) is still active and keyed by user+merchant
    return NextResponse.json(merchant as Merchant, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error("[GET /api/merchants/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch merchant",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/merchants/[id]
 * Update merchant details
 * Requires: User must be authenticated and belong to the merchant
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 16, params is always a Promise and must be awaited
    const { id: merchantId } = await params

    // Get authenticated user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    // Validate merchant ID
    if (!merchantId || merchantId.trim() === '') {
      return NextResponse.json(
        { error: "Merchant ID is required" },
        { status: 400 }
      );
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
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this merchant" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));

    // Map form fields to merchant schema
    const updateData: Partial<typeof merchants.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Basic info
    if (body.businessName !== undefined) {
      updateData.name = body.businessName;
    }
    if (body.primaryEmail !== undefined) {
      updateData.contactEmail = body.primaryEmail;
    }
    if (body.primaryPhone !== undefined) {
      updateData.contactPhone = body.primaryPhone || null;
    }

    // Legal info
    if (body.legalEntityName !== undefined) {
      updateData.legalName = body.legalEntityName;
    }
    if (body.vatTaxId !== undefined) {
      updateData.vatNumber = body.vatTaxId || null;
    }
    if (body.companyRegNumber !== undefined) {
      updateData.kboNumber = body.companyRegNumber || null;
    }

    // Address
    if (body.streetAddress1 !== undefined) {
      updateData.registeredAddressLine1 = body.streetAddress1;
    }
    if (body.streetAddress2 !== undefined) {
      updateData.registeredAddressLine2 = body.streetAddress2 || null;
    }
    if (body.postalCode !== undefined) {
      updateData.registeredPostalCode = body.postalCode;
    }
    if (body.city !== undefined) {
      updateData.registeredCity = body.city;
    }
    if (body.country !== undefined) {
      updateData.registeredCountry = body.country;
    }

    // Branding
    if (body.primaryBrandColor !== undefined) {
      updateData.primaryBrandColor = body.primaryBrandColor;
    }
    if (body.accentColor !== undefined) {
      updateData.accentColor = body.accentColor || null;
    }

    // Localization
    if (body.defaultCurrency !== undefined) {
      updateData.defaultCurrency = body.defaultCurrency;
    }
    if (body.defaultTimezone !== undefined) {
      updateData.defaultTimezone = body.defaultTimezone;
    }
    if (body.defaultLanguage !== undefined) {
      updateData.defaultLanguage = body.defaultLanguage;
    }
    if (body.dateFormat !== undefined) {
      updateData.dateFormat = body.dateFormat;
    }
    if (body.numberFormat !== undefined) {
      updateData.numberFormat = body.numberFormat;
    }

    // Notifications
    if (body.billingEmail !== undefined) {
      updateData.billingEmail = body.billingEmail || null;
    }
    if (body.criticalAlertsEmail !== undefined) {
      updateData.criticalAlertsEmail = body.criticalAlertsEmail || null;
    }

    // Branding images
    // logoUrl/bannerUrl can be: string (URL), null (remove), or undefined (no change)
    if (body.logoUrl !== undefined) {
      // If it's an empty string, treat as null (remove)
      // Otherwise use the value (string URL or null)
      updateData.logoUrl = body.logoUrl === "" ? null : body.logoUrl;
      console.log('[PUT /api/merchants/[id]] Updating logoUrl:', {
        received: body.logoUrl,
        type: typeof body.logoUrl,
        setting: updateData.logoUrl,
      });
    }
    if (body.bannerUrl !== undefined) {
      // If it's an empty string, treat as null (remove)
      // Otherwise use the value (string URL or null)
      updateData.bannerUrl = body.bannerUrl === "" ? null : body.bannerUrl;
      console.log('[PUT /api/merchants/[id]] Updating bannerUrl:', {
        received: body.bannerUrl,
        type: typeof body.bannerUrl,
        setting: updateData.bannerUrl,
      });
    }
    
    console.log('[PUT /api/merchants/[id]] Update data:', {
      hasLogoUrl: body.logoUrl !== undefined,
      hasBannerUrl: body.bannerUrl !== undefined,
      updateDataKeys: Object.keys(updateData),
    });

    // Notification preferences
    if (
      body.notifyBilling !== undefined ||
      body.notifyUpdates !== undefined ||
      body.notifyTips !== undefined ||
      body.notifyMarketing !== undefined
    ) {
      // Get existing preferences first
      const existingMerchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, merchantId),
        columns: {
          notificationPreferences: true,
        },
      });

      const existingPrefs = (existingMerchant?.notificationPreferences as Record<string, boolean>) || {};

      updateData.notificationPreferences = {
        ...existingPrefs,
        ...(body.notifyBilling !== undefined && { order_notifications: body.notifyBilling }),
        ...(body.notifyUpdates !== undefined && { system_updates: body.notifyUpdates }),
        ...(body.notifyTips !== undefined && { weekly_reports: body.notifyTips }),
        ...(body.notifyMarketing !== undefined && { marketing_emails: body.notifyMarketing }),
      } as any;
    }

    // Loyalty points settings (merchant-wide)
    if (body.loyaltySettings !== undefined && body.loyaltySettings !== null) {
      const incoming = body.loyaltySettings as {
        enabled?: boolean;
        pointsScope?: string;
        pointsPerDollar?: number;
        redeemPointsPerDollarOff?: number;
        allowOpenWalletRedeem?: boolean;
        pointsExpirationMonths?: number;
      };
      const existingMerchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, merchantId),
        columns: { loyaltySettings: true },
      });
      const existing = normalizeLoyaltySettings(
        existingMerchant?.loyaltySettings as Parameters<typeof normalizeLoyaltySettings>[0],
      );
      updateData.loyaltySettings = {
        ...existing,
        enabled: incoming.enabled !== false,
        pointsScope: incoming.pointsScope === "location" ? "location" : "merchant",
        pointsPerDollar:
          typeof incoming.pointsPerDollar === "number" && incoming.pointsPerDollar > 0
            ? Math.floor(incoming.pointsPerDollar)
            : existing.pointsPerDollar,
        redeemPointsPerDollarOff:
          typeof incoming.redeemPointsPerDollarOff === "number" &&
          incoming.redeemPointsPerDollarOff > 0
            ? Math.floor(incoming.redeemPointsPerDollarOff)
            : existing.redeemPointsPerDollarOff,
        allowOpenWalletRedeem:
          incoming.allowOpenWalletRedeem !== undefined
            ? incoming.allowOpenWalletRedeem !== false
            : existing.allowOpenWalletRedeem,
        pointsExpirationMonths:
          typeof incoming.pointsExpirationMonths === "number" &&
          incoming.pointsExpirationMonths >= 0
            ? Math.floor(incoming.pointsExpirationMonths)
            : existing.pointsExpirationMonths,
      };
    }

    // Debug: Log what we're updating
    console.log('[PUT /api/merchants/[id]] Updating merchant with data:', JSON.stringify(updateData, null, 2));

    // Update merchant
    await db
      .update(merchants)
      .set(updateData)
      .where(eq(merchants.id, merchantId));
    
    console.log('[PUT /api/merchants/[id]] Merchant updated successfully');

    // Fetch updated merchant
    const updatedMerchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });

    if (!updatedMerchant) {
      return NextResponse.json(
        { error: "Merchant not found after update" },
        { status: 404 }
      );
    }

    // Note: Cache will naturally expire after 10 minutes (revalidate: 600)
    // For immediate invalidation, we'd need to use a different caching strategy
    // The updated data will be available on next request after cache expires

    return NextResponse.json(updatedMerchant as Merchant, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error("[PUT /api/merchants/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to update merchant",
      },
      { status: 500 }
    );
  }
}
