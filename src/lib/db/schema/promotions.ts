import {
  date,
  decimal,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { merchants } from "./merchants";
import { merchantLocations } from "./merchant-locations";
import { items } from "./menus";

export const promotionKindEnum = pgEnum("promotion_kind", [
  "sale_price",
  "bogo",
]);

export const promotionStatusEnum = pgEnum("promotion_status", [
  "active",
  "paused",
]);

export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    kind: promotionKindEnum("kind").notNull(),
    status: promotionStatusEnum("status").notNull().default("active"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),
    activeDays: text("active_days").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    locationStatusIdx: index("promotions_location_status_idx").on(
      table.locationId,
      table.status,
    ),
    merchantIdIdx: index("promotions_merchant_id_idx").on(table.merchantId),
  }),
);

export const promotionItems = pgTable(
  "promotion_items",
  {
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.promotionId, table.itemId] }),
    itemIdIdx: index("promotion_items_item_id_idx").on(table.itemId),
  }),
);

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [promotions.merchantId],
    references: [merchants.id],
  }),
  location: one(merchantLocations, {
    fields: [promotions.locationId],
    references: [merchantLocations.id],
  }),
  items: many(promotionItems),
}));

export const promotionItemsRelations = relations(promotionItems, ({ one }) => ({
  promotion: one(promotions, {
    fields: [promotionItems.promotionId],
    references: [promotions.id],
  }),
  item: one(items, {
    fields: [promotionItems.itemId],
    references: [items.id],
  }),
}));
