import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  decimal,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { merchants } from "./merchants";
import { merchantLocations } from "./merchant-locations";
import { orders } from "./orders";
import { items } from "./menus";

export const loyaltyLedgerKindEnum = pgEnum("loyalty_ledger_kind", [
  "earn",
  "adjust",
  "redeem",
  "expire",
]);

export const loyaltyRewardKindEnum = pgEnum("loyalty_reward_kind", [
  "fixed_off",
  "percent_off",
  "free_item",
]);

export const loyaltyRewardStatusEnum = pgEnum("loyalty_reward_status", [
  "active",
  "inactive",
]);

/**
 * Loyalty account balances.
 * locationId is null for merchant-wide scope; set for per-location scope.
 * userId is the platform users.id (Supabase auth user).
 */
export const loyaltyAccounts = pgTable(
  "loyalty_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => merchantLocations.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").notNull(),
    balance: integer("balance").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    merchantUserMerchantScopeUidx: uniqueIndex(
      "loyalty_accounts_merchant_user_uidx",
    )
      .on(table.merchantId, table.userId)
      .where(sql`${table.locationId} IS NULL`),
    merchantLocationUserUidx: uniqueIndex(
      "loyalty_accounts_merchant_location_user_uidx",
    )
      .on(table.merchantId, table.locationId, table.userId)
      .where(sql`${table.locationId} IS NOT NULL`),
    userIdIdx: index("loyalty_accounts_user_id_idx").on(table.userId),
    merchantIdIdx: index("loyalty_accounts_merchant_id_idx").on(table.merchantId),
  }),
);

export const loyaltyLedgerEntries = pgTable(
  "loyalty_ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    kind: loyaltyLedgerKindEnum("kind").notNull().default("earn"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orderKindUidx: uniqueIndex("loyalty_ledger_entries_order_kind_uidx")
      .on(table.orderId, table.kind)
      .where(sql`${table.orderId} IS NOT NULL`),
    accountIdIdx: index("loyalty_ledger_entries_account_id_idx").on(
      table.accountId,
    ),
  }),
);

export const loyaltyPointLots = pgTable(
  "loyalty_point_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: "cascade" }),
    earnLedgerEntryId: uuid("earn_ledger_entry_id").references(
      () => loyaltyLedgerEntries.id,
      { onDelete: "set null" },
    ),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    pointsInitial: integer("points_initial").notNull(),
    pointsRemaining: integer("points_remaining").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    earnLedgerUidx: uniqueIndex("loyalty_point_lots_earn_ledger_uidx")
      .on(table.earnLedgerEntryId)
      .where(sql`${table.earnLedgerEntryId} IS NOT NULL`),
    accountExpiresIdx: index("loyalty_point_lots_account_expires_idx").on(
      table.accountId,
      table.expiresAt,
    ),
    accountRemainingIdx: index("loyalty_point_lots_account_remaining_idx").on(
      table.accountId,
      table.pointsRemaining,
    ),
  }),
);

export const loyaltyRewards = pgTable(
  "loyalty_rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => merchantLocations.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    description: text("description"),
    status: loyaltyRewardStatusEnum("status").notNull().default("active"),
    kind: loyaltyRewardKindEnum("kind").notNull(),
    pointsCost: integer("points_cost").notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
    percentOff: integer("percent_off"),
    maxDiscountAmount: decimal("max_discount_amount", {
      precision: 10,
      scale: 2,
    }),
    menuItemId: uuid("menu_item_id").references(() => items.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    merchantIdIdx: index("loyalty_rewards_merchant_id_idx").on(table.merchantId),
    merchantStatusIdx: index("loyalty_rewards_merchant_status_idx").on(
      table.merchantId,
      table.status,
    ),
  }),
);

export const loyaltyRewardRedemptions = pgTable(
  "loyalty_reward_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => loyaltyRewards.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orderIdUidx: uniqueIndex("loyalty_reward_redemptions_order_id_uidx").on(
      table.orderId,
    ),
    rewardIdIdx: index("loyalty_reward_redemptions_reward_id_idx").on(
      table.rewardId,
    ),
  }),
);

export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect;
export type NewLoyaltyAccount = typeof loyaltyAccounts.$inferInsert;
export type LoyaltyLedgerEntry = typeof loyaltyLedgerEntries.$inferSelect;
export type NewLoyaltyLedgerEntry = typeof loyaltyLedgerEntries.$inferInsert;
export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type NewLoyaltyReward = typeof loyaltyRewards.$inferInsert;
export type LoyaltyRewardRedemption = typeof loyaltyRewardRedemptions.$inferSelect;
export type NewLoyaltyRewardRedemption = typeof loyaltyRewardRedemptions.$inferInsert;
export type LoyaltyPointLot = typeof loyaltyPointLots.$inferSelect;
export type NewLoyaltyPointLot = typeof loyaltyPointLots.$inferInsert;
