/**
 * Drizzle ORM Schema Index
 * 
 * This file exports all table schemas and their relations.
 * 
 * Database: Neon Postgres (serverless)
 * ORM: Drizzle ORM
 * Framework: Next.js 16
 * Auth: Supabase (auth.users table already exists)
 * 
 * Note: Foreign keys to auth.users (Supabase auth table) are documented
 * but cannot be created in Drizzle as auth.users is managed by Supabase.
 */

import { relations } from "drizzle-orm";

// Export all tables
export * from "./merchants";
export * from "./merchant-locations";
export * from "./location-stations";
export * from "./location-substations";
export * from "./merchant-users";
export * from "./staff";
export * from "./invitations";
export * from "./platform-personnel";
export * from "./menus";
export * from "./orders";
export * from "./floor-plans";
export * from "./pos-idempotency";
export * from "./guest-seat-claims";
export * from "./guest-table-splits";
export * from "./loyalty";
export * from "./promotions";
export * from "./staff-push-subscriptions";
export * from "./guest-push-subscriptions";

// Import tables for relations
import { merchants } from "./merchants";
import { merchantLocations } from "./merchant-locations";
import { locationStations } from "./location-stations";
import { locationSubstations } from "./location-substations";
import { merchantUsers } from "./merchant-users";
import { staff } from "./staff";
import { invitations } from "./invitations";
import { platformPersonnel } from "./platform-personnel";
import {
  menus,
  categories,
  items,
  tags,
  allergens,
  customizationGroups,
} from "./menus";
import {
  tables,
  sessions,
  seats,
  customers,
  reservations,
  orders,
  orderTimeline,
  waitlist,
} from "./orders";
import { floorPlans } from "./floor-plans";
import { loyaltyAccounts } from "./loyalty";
import { promotions } from "./promotions";

// ============================================================================
// Relations
// ============================================================================

/**
 * Merchants relations
 * - One merchant has many locations
 * - One merchant has many merchant users
 * - One merchant has many invitations
 */
export const merchantsRelations = relations(merchants, ({ many }) => ({
  locations: many(merchantLocations),
  merchantUsers: many(merchantUsers),
  invitations: many(invitations),
  loyaltyAccounts: many(loyaltyAccounts),
}));

/**
 * Merchant locations relations
 * - Many locations belong to one merchant
 * - One location has many staff members
 * - One location has many menus
 * - One location has many categories
 * - One location has many items
 * - One location has many tags
 * - One location has many allergens
 * - One location has many customization groups
 * - One location has many tables
 * - One location has many customers
 * - One location has many reservations
 * - One location has many orders
 * - One location has many waitlist entries
 * - One location has many floor plans
 * - One location has many location_stations (KDS stations)
 */
export const merchantLocationsRelations = relations(
  merchantLocations,
  ({ one, many }) => ({
    merchant: one(merchants, {
      fields: [merchantLocations.merchantId],
      references: [merchants.id],
    }),
    locationStations: many(locationStations),
    staff: many(staff),
    menus: many(menus),
    categories: many(categories),
    items: many(items),
    tags: many(tags),
    allergens: many(allergens),
    customizationGroups: many(customizationGroups),
    tables: many(tables),
    sessions: many(sessions),
    customers: many(customers),
    reservations: many(reservations),
    orders: many(orders),
    waitlist: many(waitlist),
    floorPlans: many(floorPlans),
    promotions: many(promotions),
  }),
);

/**
 * Merchant users relations
 * - Many merchant users belong to one merchant
 * - One merchant user belongs to one user (auth.users)
 * - One merchant user can be invited by one user (auth.users)
 * 
 * Note: user_id and invited_by reference auth.users.id which is managed by Supabase
 */
export const merchantUsersRelations = relations(merchantUsers, ({ one }) => ({
  merchant: one(merchants, {
    fields: [merchantUsers.merchantId],
    references: [merchants.id],
  }),
  // Note: user relation would reference auth.users.id
  // This is documented but not implemented as auth.users is managed by Supabase
}));

/**
 * Staff relations
 * - Many staff members belong to one location
 * - One staff member can be assigned to many orders
 * - One staff member can change many order timeline entries
 */
export const staffRelations = relations(staff, ({ one, many }) => ({
  location: one(merchantLocations, {
    fields: [staff.locationId],
    references: [merchantLocations.id],
  }),
  assignedOrders: many(orders),
  orderTimelineChanges: many(orderTimeline),
}));

/**
 * Invitations relations
 * - Many invitations belong to one merchant
 * - One invitation is created by one user (auth.users)
 * 
 * Note: invited_by references auth.users.id which is managed by Supabase
 */
export const invitationsRelations = relations(invitations, ({ one }) => ({
  merchant: one(merchants, {
    fields: [invitations.merchantId],
    references: [merchants.id],
  }),
  // Note: invitedBy relation would reference auth.users.id
  // This is documented but not implemented as auth.users is managed by Supabase
}));

/**
 * Platform personnel relations
 * - One platform personnel entry belongs to one user (auth.users)
 * 
 * Note: user_id references auth.users.id which is managed by Supabase
 */
export const platformPersonnelRelations = relations(
  platformPersonnel,
  ({ one }) => ({
    // Note: user relation would reference auth.users.id
    // This is documented but not implemented as auth.users is managed by Supabase
  }),
);

// Re-export relations from orders schema
export {
  tablesRelations,
  sessionsRelations,
  seatsRelations,
  servicePeriodsRelations,
  sessionEventsRelations,
  customerNotesRelations,
  customersRelations,
  reservationsRelations,
  ordersRelations,
  orderItemsRelations,
  orderItemCustomizationsRelations,
  orderTimelineRelations,
  paymentsRelations,
  orderDeliveryRelations,
  waitlistRelations,
} from "./orders";

export { floorPlansRelations } from "./floor-plans";

export {
  promotionsRelations,
  promotionItemsRelations,
} from "./promotions";

export const locationStationsRelations = relations(locationStations, ({ one, many }) => ({
  location: one(merchantLocations, {
    fields: [locationStations.locationId],
    references: [merchantLocations.id],
  }),
  substations: many(locationSubstations),
}));

export const locationSubstationsRelations = relations(locationSubstations, ({ one }) => ({
  station: one(locationStations, {
    fields: [locationSubstations.stationId],
    references: [locationStations.id],
  }),
}));


