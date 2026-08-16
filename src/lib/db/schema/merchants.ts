import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

/**
 * Business type enum for merchants
 */
export const businessTypeEnum = pgEnum("business_type", [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "food_truck",
  "fine_dining",
  "fast_food",
  "other",
]);

/**
 * Merchant status enum
 */
export const merchantStatusEnum = pgEnum("merchant_status", [
  "onboarding",
  "active",
  "suspended",
  "inactive",
]);

/**
 * Subscription tier enum
 */
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "trial",
  "basic",
  "pro",
  "enterprise",
]);

/**
 * Notification preferences JSONB structure:
 * {
 *   "order_notifications": boolean,
 *   "marketing_emails": boolean,
 *   "system_updates": boolean,
 *   "weekly_reports": boolean
 * }
 */
export type NotificationPreferences = {
  order_notifications?: boolean;
  marketing_emails?: boolean;
  system_updates?: boolean;
  weekly_reports?: boolean;
};

export type LoyaltyPointsScope = "merchant" | "location";

export type LoyaltySettings = {
  enabled?: boolean;
  pointsScope?: LoyaltyPointsScope;
  /** Points awarded per $1 of order subtotal. Default 10. */
  pointsPerDollar?: number;
  /** Points required for $1 off at checkout. Default 10. */
  redeemPointsPerDollarOff?: number;
  /** When true, guests may spend arbitrary points at the wallet rate. Default true. */
  allowOpenWalletRedeem?: boolean;
  /** Months until earned points expire. 0 = points never expire. */
  pointsExpirationMonths?: number;
};

export const DEFAULT_LOYALTY_SETTINGS: Required<LoyaltySettings> = {
  enabled: true,
  pointsScope: "location",
  pointsPerDollar: 10,
  redeemPointsPerDollarOff: 10,
  allowOpenWalletRedeem: true,
  pointsExpirationMonths: 6,
};

/**
 * Platform-controlled merchant modules. Defaults are off unless explicitly enabled.
 */
export type MerchantFeatures = {
  /** Kitchen Display System: ops /kds, station settings, item routing. */
  kds?: boolean;
};

export const DEFAULT_MERCHANT_FEATURES: Required<MerchantFeatures> = {
  kds: false,
};

export function normalizeMerchantFeatures(
  features: MerchantFeatures | null | undefined,
): Required<MerchantFeatures> {
  return {
    kds: features?.kds === true,
  };
}

function clampPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return fallback;
}

export function normalizeLoyaltySettings(
  settings: LoyaltySettings | null | undefined,
): Required<LoyaltySettings> {
  return {
    enabled: settings?.enabled !== false,
    pointsScope: "location",
    pointsPerDollar: clampPositiveInt(
      settings?.pointsPerDollar,
      DEFAULT_LOYALTY_SETTINGS.pointsPerDollar,
    ),
    redeemPointsPerDollarOff: clampPositiveInt(
      settings?.redeemPointsPerDollarOff,
      DEFAULT_LOYALTY_SETTINGS.redeemPointsPerDollarOff,
    ),
    allowOpenWalletRedeem: settings?.allowOpenWalletRedeem !== false,
    pointsExpirationMonths: clampNonNegativeInt(
      settings?.pointsExpirationMonths,
      DEFAULT_LOYALTY_SETTINGS.pointsExpirationMonths,
    ),
  };
}

function clampNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

/** Max points redeemable against a food subtotal. */
export function maxRedeemablePoints(
  balance: number,
  subtotal: number,
  settings: Required<LoyaltySettings>,
): number {
  if (balance <= 0 || subtotal <= 0) return 0;
  const subtotalCap = Math.floor(subtotal * settings.redeemPointsPerDollarOff);
  return Math.max(0, Math.min(balance, subtotalCap));
}

/** Dollar discount for a points amount. */
export function pointsToDiscountAmount(
  points: number,
  settings: Required<LoyaltySettings>,
): number {
  if (points <= 0) return 0;
  return points / settings.redeemPointsPerDollarOff;
}

/**
 * Merchants table
 * Stores merchant/business information including legal details, branding, and subscription data
 */
export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Identity & Contact
    name: varchar("name", { length: 255 }).notNull(),
    publicBrandName: varchar("public_brand_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 50 }).notNull(),
    // Legal & Tax
    legalName: varchar("legal_name", { length: 255 }).notNull(),
    vatNumber: varchar("vat_number", { length: 50 }),
    registeredAddressLine1: varchar("registered_address_line1", {
      length: 255,
    }),
    registeredAddressLine2: varchar("registered_address_line2", {
      length: 255,
    }),
    registeredPostalCode: varchar("registered_postal_code", { length: 20 }),
    registeredCity: varchar("registered_city", { length: 100 }),
    registeredCountry: varchar("registered_country", { length: 100 }).default(
      "Belgium",
    ),
    kboNumber: varchar("kbo_number", { length: 50 }),
    // Business Configuration
    businessType: businessTypeEnum("business_type").notNull(),
    status: merchantStatusEnum("status").default("onboarding").notNull(),
    subscriptionTier: subscriptionTierEnum("subscription_tier")
      .default("trial")
      .notNull(),
    subscriptionExpiresAt: timestamp("subscription_expires_at", {
      withTimezone: true,
    }),
    // Branding
    logoUrl: varchar("logo_url", { length: 500 }),
    bannerUrl: varchar("banner_url", { length: 500 }),
    primaryBrandColor: varchar("primary_brand_color", { length: 7 }),
    accentColor: varchar("accent_color", { length: 7 }),
    // Localization & Preferences
    defaultCurrency: varchar("default_currency", { length: 3 })
      .default("EUR")
      .notNull(),
    defaultTimezone: varchar("default_timezone", { length: 50 })
      .default("Europe/Brussels")
      .notNull(),
    defaultLanguage: varchar("default_language", { length: 5 })
      .default("nl-BE")
      .notNull(),
    /** Guest menu languages offered (subset of en | ar). */
    availableLanguages: jsonb("available_languages")
      .$type<Array<"en" | "ar">>()
      .default(["en", "ar"]),
    dateFormat: varchar("date_format", { length: 20 }),
    numberFormat: varchar("number_format", { length: 20 }),
    // Notifications
    billingEmail: varchar("billing_email", { length: 255 }),
    criticalAlertsEmail: varchar("critical_alerts_email", { length: 255 }),
    notificationPreferences: jsonb("notification_preferences").$type<NotificationPreferences>(),
    /** Loyalty points program settings (earn rate, merchant vs location scope). */
    loyaltySettings: jsonb("loyalty_settings").$type<LoyaltySettings>(),
    /** Platform modules (KDS, etc.). Controlled from /admin/merchants. */
    features: jsonb("features").$type<MerchantFeatures>(),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusIdx: index("merchants_status_idx").on(table.status),
    subscriptionTierIdx: index("merchants_subscription_tier_idx").on(
      table.subscriptionTier,
    ),
    contactEmailIdx: index("merchants_contact_email_idx").on(
      table.contactEmail,
    ),
  }),
);

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;


