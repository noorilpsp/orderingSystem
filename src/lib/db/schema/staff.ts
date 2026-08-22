import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { merchantLocations } from "./merchant-locations";

/**
 * Staff role enum
 */
export const staffRoleEnum = pgEnum("staff_role", [
  "cashier",
  "kitchen",
  "bar",
  "server",
  "driver",
  "manager",
  "other",
]);

/**
 * Staff permissions JSONB structure:
 * {
 *   "can_void_orders": boolean,
 *   "can_apply_discounts": boolean,
 *   "can_manage_tables": boolean,
 *   "can_refund": boolean,
 *   ...other permissions
 * }
 */
export type StaffPermissions = {
  can_void_orders?: boolean;
  can_apply_discounts?: boolean;
  can_manage_tables?: boolean;
  can_refund?: boolean;
  [key: string]: boolean | undefined;
};

/**
 * Staff table
 * Stores staff members for each merchant location
 */
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Foreign Keys
    userId: text("user_id"), // auth.users.id - links staff to Supabase user for session server assignment
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    // Personal Info
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    // Authentication
    pinCodeHash: varchar("pin_code_hash", { length: 255 }).notNull(),
    // Role & Permissions
    role: staffRoleEnum("role").notNull(),
    permissions: jsonb("permissions").$type<StaffPermissions>(),
    // Employment
    hourlyWage: decimal("hourly_wage", { precision: 10, scale: 2 }),
    isActive: boolean("is_active").default(true).notNull(),
    hiredAt: date("hired_at").notNull(),
    terminatedAt: date("terminated_at"),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    locationIdIdx: index("staff_location_id_idx").on(table.locationId),
    isActiveIdx: index("staff_is_active_idx").on(table.isActive),
  }),
);

export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;


