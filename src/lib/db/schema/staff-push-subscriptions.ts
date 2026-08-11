import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { merchantLocations } from "./merchant-locations";

/**
 * Staff Web Push subscriptions for closed-tab incoming-order alerts.
 * userId is the Supabase auth user id.
 */
export const staffPushSubscriptions = pgTable(
  "staff_push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    endpointUnique: uniqueIndex("staff_push_subscriptions_endpoint_uidx").on(table.endpoint),
    locationIdx: index("staff_push_subscriptions_location_idx").on(table.locationId),
    userIdx: index("staff_push_subscriptions_user_idx").on(table.userId),
  }),
);
