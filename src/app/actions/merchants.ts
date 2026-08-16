"use server";

import { z } from "zod";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { merchants, merchantLocations } from "@/db/schema";
import { revalidatePath, revalidateTag } from "next/cache";
import { isPlatformAdmin } from "@/lib/permissions";
import { ADMIN_MERCHANTS_CACHE_TAG } from "@/lib/queries";
import { revalidatePublicMenuForMerchant } from "@/lib/public-menu/publicMenuCache";
import { normalizeMerchantFeatures } from "@/lib/db/schema/merchants";

// Configure Neon to use WebSocket for transaction support
if (typeof globalThis.WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ws = typeof require !== "undefined" ? require("ws") : null;
  if (ws) {
    neonConfig.webSocketConstructor = ws;
  }
}

// Create a transaction-capable database connection using Pool
function getTransactionDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle(pool, {
    schema: { merchants, merchantLocations },
  });
}

// Helper to check if user is platform admin
async function checkAdminAccess() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized", user: null };
  }

  const admin = await isPlatformAdmin(user.id);
  if (!admin) {
    return { error: "Forbidden: Super admin access required", user: null };
  }

  return { error: null, user };
}

const merchantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  legalName: z.string().min(1, "Legal name is required"),
  contactEmail: z.string().email("Valid email is required"),
  businessType: z.enum([
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "food_truck",
    "fine_dining",
    "fast_food",
    "other",
  ]),
  status: z.enum(["onboarding", "active", "suspended", "inactive"]),
  locationName: z.string().min(1, "Location name is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  timezone: z.string().min(1, "Timezone is required"),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerEmail: z.string().email("Valid owner email is required"),
  subscriptionTier: z.enum(["trial", "basic", "pro", "enterprise"]),
  subscriptionExpiresAt: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  /** Platform module: Kitchen Display System. Default false. */
  kdsEnabled: z.boolean().optional().default(false),
});

export async function createMerchant(data: unknown) {
  // Check admin access
  const { error: authError } = await checkAdminAccess();
  if (authError) {
    return { error: authError };
  }

  // Validate input
  const validation = merchantSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const validated = validation.data;

  try {
    // Use transaction-capable database connection
    const transactionDb = getTransactionDb();

    // Use transaction to ensure both merchant and location are created atomically
    const result = await transactionDb.transaction(async (tx) => {
      // Create merchant
      const [createdMerchant] = await tx
        .insert(merchants)
        .values({
          name: validated.name,
          legalName: validated.legalName,
          contactEmail: validated.contactEmail,
          contactPhone: validated.phone,
          registeredAddressLine1: validated.address,
          registeredCity: validated.city,
          registeredCountry: validated.country,
          businessType: validated.businessType,
          status: validated.status,
          subscriptionTier: validated.subscriptionTier,
          subscriptionExpiresAt: validated.subscriptionExpiresAt
            ? new Date(validated.subscriptionExpiresAt)
            : null,
          defaultTimezone: validated.timezone,
          defaultCurrency: "EUR",
          features: normalizeMerchantFeatures({ kds: validated.kdsEnabled === true }),
        })
        .returning();

      if (!createdMerchant) throw new Error("Failed to create merchant");

      const merchantId = createdMerchant.id;

      // Create first location
      const [createdLocation] = await tx
        .insert(merchantLocations)
        .values({
          merchantId,
          name: validated.locationName,
          address: validated.address,
          postalCode: "",
          city: validated.city,
          country: validated.country,
          phone: validated.phone,
          email: validated.contactEmail,
          logoUrl: validated.logoUrl?.trimEnd() || null,
          bannerUrl: validated.bannerUrl?.trimEnd() || null,
          status: "active",
          openingHours: {},
          timezone: validated.timezone,
        })
        .returning();

      return { createdMerchant, createdLocation };
    });

    return {
      success: true,
      merchant: result.createdMerchant,
      location: result.createdLocation,
      ownerInfo: {
        name: validated.ownerName,
        email: validated.ownerEmail,
      },
    };
  } catch (error) {
    console.error("[create-merchant] Error:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("violates foreign key") ||
        error.message.includes("duplicate key")
      ) {
        return {
          error: "Database constraint violation. Please check your input data.",
        };
      }

      if (error.message.includes("relation") || error.message.includes("column")) {
        return {
          error: "Database schema error. Please contact support.",
        };
      }
    }

    return {
      error: error instanceof Error ? error.message : "Failed to create merchant and location",
    };
  }
}

const optionalText = z.string().optional().nullable();
const optionalEmail = z
  .union([z.string().email(), z.literal(""), z.null()])
  .optional();

const updateMerchantSchema = z.object({
  id: z.string().min(1, "Merchant ID is required"),
  locationId: z.string().optional().nullable(),
  name: optionalText,
  legalName: optionalText,
  kboNumber: optionalText,
  contactEmail: optionalEmail,
  businessType: z
    .enum([
      "restaurant",
      "cafe",
      "bar",
      "bakery",
      "food_truck",
      "fine_dining",
      "fast_food",
      "other",
    ])
    .optional(),
  status: z.enum(["onboarding", "active", "suspended", "inactive"]).optional(),
  storeType: optionalText,
  phone: optionalText,
  address: optionalText,
  addressLine2: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: optionalText,
  publicEmail: optionalEmail,
  subscriptionTier: z.enum(["trial", "basic", "pro", "enterprise"]).optional(),
  subscriptionExpiresAt: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  kdsEnabled: z.boolean().optional(),
});

export async function updateMerchant(data: unknown) {
  // Check admin access
  const { error: authError } = await checkAdminAccess();
  if (authError) {
    return { error: authError };
  }

  // Validate input
  const validation = updateMerchantSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const validated = validation.data;

  try {
    // Check if merchant exists
    const existingMerchant = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, validated.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existingMerchant) {
      return { error: "Merchant not found" };
    }

    const storeName = validated.name?.trim() || existingMerchant.name || "Untitled store";
    const legalName =
      validated.legalName?.trim() || existingMerchant.legalName || storeName;
    const contactEmail =
      validated.contactEmail === undefined || validated.contactEmail === null
        ? existingMerchant.contactEmail
        : validated.contactEmail.trim();
    const phone =
      validated.phone === undefined || validated.phone === null
        ? existingMerchant.contactPhone
        : validated.phone.trim();
    const address = validated.address?.trim() || "";
    const city = validated.city?.trim() || "";
    const country = validated.country?.trim() || "Belgium";
    const postalCode = validated.postalCode?.trim() || "";
    const publicEmail = validated.publicEmail?.trim() || null;
    const subscriptionTier = validated.subscriptionTier ?? existingMerchant.subscriptionTier;

    let subscriptionExpiresAt = existingMerchant.subscriptionExpiresAt;
    if (subscriptionTier === "trial") {
      subscriptionExpiresAt = validated.subscriptionExpiresAt
        ? new Date(validated.subscriptionExpiresAt)
        : null;
    }

    await db
      .update(merchants)
      .set({
        name: storeName,
        legalName,
        contactEmail,
        contactPhone: phone,
        registeredAddressLine1: address,
        registeredCity: city,
        registeredCountry: country,
        kboNumber: validated.kboNumber?.trim() || null,
        businessType: validated.businessType ?? existingMerchant.businessType,
        status: validated.status ?? existingMerchant.status,
        subscriptionTier,
        subscriptionExpiresAt,
        features:
          validated.kdsEnabled === undefined
            ? existingMerchant.features
            : normalizeMerchantFeatures({
                ...normalizeMerchantFeatures(existingMerchant.features),
                kds: validated.kdsEnabled === true,
              }),
        updatedAt: new Date(),
      })
      .where(eq(merchants.id, validated.id));

    const locationValues = {
      name: storeName,
      storeType: validated.storeType?.trim() || null,
      address,
      addressLine2: validated.addressLine2?.trim() || null,
      postalCode,
      city,
      country,
      phone,
      email: publicEmail,
      updatedAt: new Date(),
      ...(validated.logoUrl !== undefined
        ? { logoUrl: validated.logoUrl?.trimEnd() || null }
        : {}),
      ...(validated.bannerUrl !== undefined
        ? { bannerUrl: validated.bannerUrl?.trimEnd() || null }
        : {}),
    };

    if (validated.locationId) {
      await db
        .update(merchantLocations)
        .set(locationValues)
        .where(eq(merchantLocations.id, validated.locationId));
    } else {
      await db.insert(merchantLocations).values({
        merchantId: validated.id,
        ...locationValues,
        status: "active",
        openingHours: {},
      });
    }

    // Fetch updated merchant
    const updatedMerchant = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, validated.id))
      .limit(1)
      .then((rows) => rows[0]);

    const updatedLocation = await db
      .select()
      .from(merchantLocations)
      .where(eq(merchantLocations.merchantId, validated.id))
      .limit(1)
      .then((rows) => rows[0]);

    revalidateTag(ADMIN_MERCHANTS_CACHE_TAG, "max");
    revalidatePath("/admin/merchants");
    revalidatePath(`/admin/merchants/${validated.id}`);
    revalidatePath(`/admin/merchants/${validated.id}/edit`);
    await revalidatePublicMenuForMerchant(validated.id);

    return {
      success: true,
      merchant: updatedMerchant,
      location: updatedLocation,
    };
  } catch (error) {
    console.error("[update-merchant] Error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update merchant",
    };
  }
}

export async function uploadImage(formData: FormData) {
  // Check admin access
  const { error: authError } = await checkAdminAccess();
  if (authError) {
    return { error: authError };
  }

  // Check for Blob token
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[upload] BLOB_READ_WRITE_TOKEN is not set");
    return {
      error: "Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN in your environment variables.",
    };
  }

  try {
    const file = formData.get("file") as File;

    if (!file) {
      return { error: "File is required" };
    }

    // Validate content type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return {
        error: "Invalid content type. Only JPG, PNG, or WEBP are allowed",
      };
    }

    // Validate file size (2MB max)
    const MAX_FILE_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return { error: "File must be 2MB or smaller" };
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN, // Explicitly pass token
    });

    return { success: true, url: blob.url };
  } catch (error) {
    console.error("[upload] Error uploading file:", error);
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes("Access denied") || error.message.includes("token")) {
        return {
          error: "Blob storage authentication failed. Please check your BLOB_READ_WRITE_TOKEN environment variable.",
        };
      }
      return { error: error.message };
    }
    
    return {
      error: "Failed to upload file. Please check your Blob storage configuration.",
    };
  }
}
