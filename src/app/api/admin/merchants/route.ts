import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";

import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import {
  locationStatusEnum,
  businessTypeEnum,
  merchantStatusEnum,
  subscriptionTierEnum,
  merchantUserRoleEnum,
  merchants,
  invitations,
  platformPersonnel,
} from "@/db/schema";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import { ADMIN_MERCHANTS_CACHE_TAG } from "@/lib/queries";

export const runtime = "nodejs";

// Ensure websocket support for Neon transactions in a Node runtime
if (typeof globalThis.WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ws = require("ws");
  neonConfig.webSocketConstructor = ws;
}

const merchantSchema = z.object({
  name: z.string().optional().default(""),
  publicBrandName: z.string().optional().nullable(),
  contactEmail: z.union([z.string().email(), z.literal("")]).optional().default(""),
  contactPhone: z.string().optional().default(""),
  legalName: z.string().optional().default(""),
  vatNumber: z.string().optional().nullable(),
  registeredAddressLine1: z.string().optional().nullable(),
  registeredAddressLine2: z.string().optional().nullable(),
  registeredPostalCode: z.string().optional().nullable(),
  registeredCity: z.string().optional().nullable(),
  registeredCountry: z.string().optional().nullable(),
  kboNumber: z.string().optional().nullable(),
  businessType: z.enum(businessTypeEnum.enumValues).optional().default("restaurant"),
  status: z.enum(merchantStatusEnum.enumValues).optional().default("onboarding"),
  subscriptionTier: z.enum(subscriptionTierEnum.enumValues).optional().default("trial"),
  subscriptionExpiresAt: z.string().datetime().optional().nullable(),
  billingEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  criticalAlertsEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultTimezone: z.string().optional(),
  defaultLanguage: z.string().optional(),
  notificationPreferences: z
    .object({
      order_notifications: z.boolean().optional(),
      marketing_emails: z.boolean().optional(),
      system_updates: z.boolean().optional(),
      weekly_reports: z.boolean().optional(),
    })
    .optional()
    .nullable(),
});

const locationSchema = z.object({
  name: z.string().optional().default(""),
  storeType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  storeSlug: z.string().optional().nullable(),
  address: z.string().optional().default(""),
  addressLine2: z.string().optional().nullable(),
  postalCode: z.string().optional().default(""),
  city: z.string().optional().default(""),
  country: z.string().optional().default("Belgium"),
  phone: z.string().optional().default(""),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  websiteUrl: z.string().url().optional().nullable(),
  instagramHandle: z.string().optional().nullable(),
  facebookUrl: z.string().url().optional().nullable(),
  tiktokHandle: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  openingHours: z.any().optional().nullable(),
  orderModes: z.any().optional().nullable(),
  primaryBrandColor: z.string().optional().nullable(),
  accentColor: z.string().optional().nullable(),
  seatingCapacity: z.number().optional().nullable(),
  numberOfTables: z.number().optional().nullable(),
  serviceChargePercentage: z.number().optional().nullable(),
  taxRate: z.number().optional().nullable(),
  averagePrepTimeMinutes: z.number().optional().nullable(),
  enableTables: z.boolean().optional(),
  enableReservations: z.boolean().optional(),
  maxPartySize: z.number().optional(),
  bookingWindowDays: z.number().optional(),
  enableOnlineOrders: z.boolean().optional(),
  acceptsCash: z.boolean().optional(),
  acceptsCards: z.boolean().optional(),
  acceptsMobilePayments: z.boolean().optional(),
  status: z.enum(locationStatusEnum.enumValues).optional(),
  visibleInDirectory: z.boolean().optional(),
  timezone: z.string().optional().nullable(),
});

const invitationSchema = z.object({
  email: z.union([z.string().email(), z.literal("")]).optional().default(""),
  role: z.enum(merchantUserRoleEnum.enumValues).default("admin"),
  locationAccess: z.array(z.string()).optional().nullable(),
});

function getTransactionDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle(pool);
}

async function requirePlatformPersonnel() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { status: 401, error: "Unauthorized", user: null };
  }

  const personnel = await db.query.platformPersonnel.findFirst({
    where: eq(platformPersonnel.userId, user.id),
    columns: { role: true, isActive: true },
  });

  if (!personnel || !personnel.isActive) {
    return { status: 403, error: "Forbidden: platform personnel only", user: null };
  }

  return { status: 200, error: null, user };
}

async function uploadIfPresent(file: File | null, prefix: string) {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const filename = `${prefix}-${Date.now()}-${file.name}`;
  const uploaded = await put(filename, file, { access: "public" });
  return uploaded.url;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await requirePlatformPersonnel();
    if (auth.error || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Expect multipart/form-data with merchant and location JSON payloads and optional files
    const formData = await request.formData();
    const merchantRaw = formData.get("merchant");
    const locationRaw = formData.get("location");
    const invitationRaw = formData.get("invitation");

    if (!merchantRaw || !locationRaw) {
      return NextResponse.json(
        { error: "merchant and location payloads are required" },
        { status: 400 },
      );
    }

    let merchantParsed: unknown;
    let locationParsed: unknown;
    let invitationParsed: unknown = null;

    try {
      merchantParsed = typeof merchantRaw === "string" ? JSON.parse(merchantRaw) : merchantRaw;
      locationParsed = typeof locationRaw === "string" ? JSON.parse(locationRaw) : locationRaw;
      if (invitationRaw) {
        invitationParsed = typeof invitationRaw === "string" ? JSON.parse(invitationRaw) : invitationRaw;
      }
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON in form data" }, { status: 400 });
    }

    const merchantResult = merchantSchema.safeParse(merchantParsed);
    const locationResult = locationSchema.safeParse(locationParsed);
    
    // Build invitation data with fallback
    const invitationData = invitationParsed ?? {
      email: merchantResult.success ? merchantResult.data.contactEmail : "",
      role: "admin" as const,
    };
    const invitationResult = invitationSchema.safeParse(invitationData);

    const errors: Record<string, unknown> = {};
    if (!merchantResult.success) errors.merchant = merchantResult.error.flatten();
    if (!locationResult.success) errors.location = locationResult.error.flatten();
    if (!invitationResult.success) errors.invitation = invitationResult.error.flatten();

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    // TypeScript now knows these are valid after validation check
    if (!merchantResult.success || !locationResult.success || !invitationResult.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const merchant = merchantResult.data;
    const location = locationResult.data;
    const invitation = invitationResult.data;
    const inviteEmail = invitation.email?.trim() ?? "";
    const shouldInvite = z.string().email().safeParse(inviteEmail).success;

    // File uploads
    const logoFile = formData.get("logo") as File | null;
    const bannerFile = formData.get("banner") as File | null;
    const [logoUrl, bannerUrl] = await Promise.all([
      uploadIfPresent(logoFile, "merchant-logo"),
      uploadIfPresent(bannerFile, "merchant-banner"),
    ]);

    const invitationToken = randomUUID();
    const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const txDb = getTransactionDb();

    const result = await txDb.transaction(async (tx) => {
      // Merchant - insert and get the generated ID
      const insertedMerchants = await tx.insert(merchants).values({
        name: merchant.name.trim() || "Untitled store",
        publicBrandName: merchant.publicBrandName ?? null,
        contactEmail: merchant.contactEmail.trim() || inviteEmail || "",
        contactPhone: merchant.contactPhone.trim() || "",
        legalName: merchant.legalName.trim() || merchant.name.trim() || "Untitled store",
        vatNumber: merchant.vatNumber ?? null,
        registeredAddressLine1: merchant.registeredAddressLine1 ?? null,
        registeredAddressLine2: merchant.registeredAddressLine2 ?? null,
        registeredPostalCode: merchant.registeredPostalCode ?? null,
        registeredCity: merchant.registeredCity ?? null,
        registeredCountry: merchant.registeredCountry ?? "Belgium",
        kboNumber: merchant.kboNumber ?? null,
        businessType: merchant.businessType,
      status: merchant.status ?? "onboarding",
        subscriptionTier: merchant.subscriptionTier ?? "trial",
        subscriptionExpiresAt: merchant.subscriptionExpiresAt
          ? new Date(merchant.subscriptionExpiresAt)
          : null,
        logoUrl: logoUrl ?? null,
        bannerUrl: bannerUrl ?? null,
        primaryBrandColor: null,
        accentColor: null,
        defaultCurrency: merchant.defaultCurrency ?? "EUR",
        defaultTimezone: merchant.defaultTimezone ?? "Europe/Brussels",
        defaultLanguage: merchant.defaultLanguage ?? "nl-BE",
        dateFormat: null,
        numberFormat: null,
        billingEmail: merchant.billingEmail?.trim() || null,
        criticalAlertsEmail: merchant.criticalAlertsEmail?.trim() || null,
        notificationPreferences: merchant.notificationPreferences ?? null,
      }).returning({ id: merchants.id });

      if (!insertedMerchants || insertedMerchants.length === 0 || !insertedMerchants[0]?.id) {
        throw new Error("Failed to create merchant: no ID returned");
      }

      const merchantId = insertedMerchants[0].id;

      // Location - use type assertion to work around Drizzle type inference issue
      const locationValues = {
        merchantId,
        name: location.name.trim() || merchant.name.trim() || "Untitled store",
        storeType: location.storeType ?? null,
        description: location.description ?? null,
        storeSlug: location.storeSlug ?? null,
        address: location.address.trim() || "",
        addressLine2: location.addressLine2 ?? null,
        postalCode: location.postalCode.trim() || "",
        city: location.city.trim() || "",
        country: location.country?.trim() || "Belgium",
        lat: location.lat ?? null,
        lng: location.lng ?? null,
        phone: location.phone.trim() || "",
        email: location.email?.trim() || null,
        websiteUrl: location.websiteUrl ?? null,
        instagramHandle: location.instagramHandle ?? null,
        facebookUrl: location.facebookUrl ?? null,
        tiktokHandle: location.tiktokHandle ?? null,
        openingHours: location.openingHours ?? null,
        logoUrl: logoUrl ?? null,
        bannerUrl: bannerUrl ?? null,
        primaryBrandColor: location.primaryBrandColor ?? null,
        accentColor: location.accentColor ?? null,
        enableTables: location.enableTables ?? false,
        enableReservations: location.enableReservations ?? false,
        maxPartySize: location.maxPartySize ?? 8,
        bookingWindowDays: location.bookingWindowDays ?? 30,
        enableOnlineOrders: location.enableOnlineOrders ?? true,
        orderModes: location.orderModes ?? null,
        seatingCapacity: location.seatingCapacity ?? null,
        numberOfTables: location.numberOfTables ?? null,
        acceptsCash: location.acceptsCash ?? true,
        acceptsCards: location.acceptsCards ?? true,
        acceptsMobilePayments: location.acceptsMobilePayments ?? false,
        serviceChargePercentage: location.serviceChargePercentage?.toString() ?? null,
        taxRate: (location.taxRate ?? 0).toString(),
        averagePrepTimeMinutes: location.averagePrepTimeMinutes ?? null,
        status: location.status ?? "active",
        visibleInDirectory: location.visibleInDirectory ?? true,
        timezone: location.timezone ?? null,
      } as typeof merchantLocations.$inferInsert;
      
      const insertedLocations = await tx.insert(merchantLocations).values(locationValues).returning({ id: merchantLocations.id });

      if (!insertedLocations || insertedLocations.length === 0 || !insertedLocations[0]?.id) {
        throw new Error("Failed to create location: no ID returned");
      }

      const locationId = insertedLocations[0].id;

      let invitationTokenOut: string | null = null;
      if (shouldInvite) {
        await tx.insert(invitations).values({
          merchantId,
          invitedBy: auth.user.id,
          email: inviteEmail,
          role: invitation.role,
          locationAccess: invitation.locationAccess ?? null,
          token: invitationToken,
          expiresAt: invitationExpiresAt,
          acceptedAt: null,
        });
        invitationTokenOut = invitationToken;
      }

      return { merchantId, locationId, invitationToken: invitationTokenOut };
    });

    let emailSent = false;
    if (shouldInvite && result.invitationToken) {
      try {
        const { sendInvitationEmail } = await import("@/lib/email");
        const emailResult = await sendInvitationEmail(
          inviteEmail,
          result.invitationToken,
          merchant.name.trim() || "Untitled store",
          invitation.role,
        );
        emailSent = emailResult.success;
        if (!emailResult.success) {
          console.error("[invitation-email] Failed to send:", emailResult.error);
        }
      } catch (emailErr) {
        console.error("[invitation-email] Error sending invitation email:", emailErr);
      }
    }

    if (!result.merchantId || !result.locationId) {
      console.error("[admin/create-merchant] Transaction completed but missing IDs:", result);
      throw new Error("Merchant creation succeeded but IDs not returned");
    }

    // Revalidate the admin merchants page cache to show the new merchant immediately
    revalidateTag(ADMIN_MERCHANTS_CACHE_TAG, "max");
    revalidatePath("/admin/merchants");

    return NextResponse.json(
      {
        merchantId: result.merchantId,
        locationId: result.locationId,
        invitationToken: result.invitationToken,
        invitationExpiresAt,
        logoUrl: logoUrl ?? null,
        bannerUrl: bannerUrl ?? null,
        emailSent,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/create-merchant] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create merchant" },
      { status: 500 },
    );
  }
}


