import { z } from "zod";

/**
 * Validation schema for platform admin store onboarding.
 * Nothing is required - blanks are stored as empty / defaults.
 */

const belgianPostalCodeRegex = /^\d{4}$/;
const kboNumberRegex = /^\d{10}$/;

const optionalText = z.string().optional().or(z.literal(""));

const optionalEmail = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine(
    (val) => !val || val.trim() === "" || z.string().email().safeParse(val).success,
    "Please enter a valid email address",
  );

export const merchantOnboardingSchema = z
  .object({
    storeName: optionalText,
    storeType: z
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
    address: optionalText,
    addressLine2: optionalText,
    postalCode: optionalText,
    city: optionalText,
    country: optionalText,
    phone: optionalText,
    publicEmail: optionalEmail,
    legalName: optionalText,
    kboNumber: optionalText.refine(
      (val) => !val || val === "" || kboNumberRegex.test(val),
      "KBO number must be exactly 10 digits",
    ),
    contactEmail: optionalEmail,
    subscriptionTier: z.enum(["trial", "basic", "pro", "enterprise"]).optional(),
    trialExpires: z.string().optional(),
    status: z.enum(["onboarding", "active", "suspended", "inactive"]).optional(),
    kdsEnabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const country = data.country?.trim() || "Belgium";
    const isBelgium = country === "Belgium" || country === "BE";
    if (!isBelgium) return;
    const postal = data.postalCode?.trim() ?? "";
    if (postal && !belgianPostalCodeRegex.test(postal)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postalCode"],
        message: "Postal code must be exactly 4 digits",
      });
    }
  });

export type MerchantOnboardingFormData = z.infer<typeof merchantOnboardingSchema>;
