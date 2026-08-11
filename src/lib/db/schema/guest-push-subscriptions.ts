import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const GUEST_ORDER_PUSH_EVENT_TYPES = [
  "accepted",
  "ready",
  "completed",
  "scheduled_released",
  "eta_slipped",
] as const;

export type GuestOrderPushEventType = (typeof GUEST_ORDER_PUSH_EVENT_TYPES)[number];

/**
 * Guest Web Push subscriptions for order-confirmation alerts when the browser is closed.
 */
export const guestPushSubscriptions = pgTable(
  "guest_push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    storeSlug: varchar("store_slug", { length: 255 }).notNull(),
    confirmationUrl: text("confirmation_url").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderEndpointUnique: uniqueIndex("guest_push_subscriptions_order_endpoint_uidx").on(
      table.orderId,
      table.endpoint,
    ),
    orderIdx: index("guest_push_subscriptions_order_idx").on(table.orderId),
    endpointIdx: index("guest_push_subscriptions_endpoint_idx").on(table.endpoint),
  }),
);

/** Idempotent log of guest push lifecycle events already delivered. */
export const guestOrderPushEvents = pgTable(
  "guest_order_push_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderEventUnique: uniqueIndex("guest_order_push_events_order_event_uidx").on(
      table.orderId,
      table.eventType,
    ),
    orderIdx: index("guest_order_push_events_order_idx").on(table.orderId),
  }),
);
