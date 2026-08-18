import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { merchants } from "./merchants";

/**
 * Location status enum
 */
export const locationStatusEnum = pgEnum("location_status", [
  "active",
  "inactive",
  "coming_soon",
  "temporarily_closed",
]);

/**
 * Opening hours JSONB structure:
 * {
 *   "monday": [{"open": "09:00", "close": "22:00"}],
 *   "tuesday": [{"open": "09:00", "close": "22:00"}],
 *   "wednesday": [],
 *   "thursday": [{"open": "11:00", "close": "14:00"}, {"open": "18:00", "close": "22:00"}],
 *   "friday": [{"open": "09:00", "close": "23:00"}],
 *   "saturday": [{"open": "10:00", "close": "23:00"}],
 *   "sunday": [{"open": "10:00", "close": "21:00"}]
 * }
 */
export type OpeningHours = {
  monday?: Array<{ open: string; close: string }>;
  tuesday?: Array<{ open: string; close: string }>;
  wednesday?: Array<{ open: string; close: string }>;
  thursday?: Array<{ open: string; close: string }>;
  friday?: Array<{ open: string; close: string }>;
  saturday?: Array<{ open: string; close: string }>;
  sunday?: Array<{ open: string; close: string }>;
};

/**
 * Order modes JSONB structure:
 * {
 *   "dine_in": { "enabled": boolean },
 *   "pickup": {
 *     "enabled": boolean,
 *     "estimated_time_minutes": number,
 *     "instructions": string
 *   },
 *   "delivery": {
 *     "enabled": boolean,
 *     "radius_km": number,
 *     "minimum_order": number,
 *     "delivery_fee": number,
 *     "free_delivery_threshold": number,
 *     "estimated_time_minutes": number
 *   }
 * }
 */
export type GuestSessionMode = "staff_seated" | "self_service";

export type OrderModes = {
  dine_in?: {
    enabled: boolean;
    guest_session_mode?: GuestSessionMode;
  };
  pickup?: {
    enabled: boolean;
    estimated_time_minutes?: number;
    /** Shown in the guest menu when pickup is selected. */
    instructions?: string;
  };
  delivery?: {
    enabled: boolean;
    radius_km?: number;
    minimum_order?: number;
    delivery_fee?: number;
    free_delivery_threshold?: number;
    estimated_time_minutes?: number;
  };
};

/**
 * Merchant locations table
 * Stores individual store/location information for each merchant
 */
export const merchantLocations = pgTable(
  "merchant_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Foreign Keys
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    // Basic Info
    name: varchar("name", { length: 255 }).notNull(),
    storeType: varchar("store_type", { length: 100 }),
    description: text("description"),
    storeSlug: varchar("store_slug", { length: 255 }),
    // Location & Contact
    address: varchar("address", { length: 255 }).notNull(),
    addressLine2: varchar("address_line2", { length: 255 }),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    country: varchar("country", { length: 100 }).default("Belgium").notNull(),
    lat: decimal("lat", { precision: 10, scale: 8 }),
    lng: decimal("lng", { precision: 11, scale: 8 }),
    phone: varchar("phone", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }),
    // Website & Social Media
    websiteUrl: varchar("website_url", { length: 500 }),
    instagramHandle: varchar("instagram_handle", { length: 100 }),
    facebookUrl: varchar("facebook_url", { length: 500 }),
    tiktokHandle: varchar("tiktok_handle", { length: 100 }),
    // Opening Hours
    openingHours: jsonb("opening_hours").$type<OpeningHours>(),
    // Store Branding (Overrides - NULL means use merchant default)
    logoUrl: varchar("logo_url", { length: 500 }),
    bannerUrl: varchar("banner_url", { length: 500 }),
    primaryBrandColor: varchar("primary_brand_color", { length: 7 }),
    accentColor: varchar("accent_color", { length: 7 }),
    // Operational Settings
    enableTables: boolean("enable_tables").default(false).notNull(),
    enableReservations: boolean("enable_reservations").default(false).notNull(),
    maxPartySize: integer("max_party_size").default(8),
    bookingWindowDays: integer("booking_window_days").default(30),
    enableOnlineOrders: boolean("enable_online_orders").default(true).notNull(),
    orderModes: jsonb("order_modes").$type<OrderModes>(),
    // Physical Capacity
    seatingCapacity: integer("seating_capacity"),
    numberOfTables: integer("number_of_tables"),
    // Payment Methods
    acceptsCash: boolean("accepts_cash").default(true).notNull(),
    acceptsCards: boolean("accepts_cards").default(true).notNull(),
    acceptsMobilePayments: boolean("accepts_mobile_payments")
      .default(false)
      .notNull(),
    // Financial Settings
    serviceChargePercentage: decimal("service_charge_percentage", {
      precision: 5,
      scale: 2,
    }),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 })
      .default("0.00")
      .notNull(),
    // Kitchen Operations
    averagePrepTimeMinutes: integer("average_prep_time_minutes"),
    // Status & Visibility
    status: locationStatusEnum("status").default("active").notNull(),
    visibleInDirectory: boolean("visible_in_directory").default(true).notNull(),
    timezone: varchar("timezone", { length: 50 }),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    merchantIdIdx: index("merchant_locations_merchant_id_idx").on(
      table.merchantId,
    ),
    statusIdx: index("merchant_locations_status_idx").on(table.status),
    storeSlugIdx: uniqueIndex("merchant_locations_store_slug_idx").on(
      table.storeSlug,
    ),
    visibleInDirectoryIdx: index(
      "merchant_locations_visible_in_directory_idx",
    ).on(table.visibleInDirectory),
  }),
);

export type MerchantLocation = typeof merchantLocations.$inferSelect;
export type NewMerchantLocation = typeof merchantLocations.$inferInsert;


