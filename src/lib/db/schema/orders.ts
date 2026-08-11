import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  date,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { merchantLocations } from "./merchant-locations";
import { floorPlans } from "./floor-plans";
import { staff } from "./staff";
import { users } from "../../../db/schema";
import { items, customizationGroups, customizationOptions } from "./menus";

// =============================================================================
// ENUMS
// =============================================================================

export const tableStatusEnum = pgEnum("table_status", [
  "available",
  "occupied",
  "reserved",
  "unavailable",
]);

export const reservationStatusEnum = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
]);

export const orderTypeEnum = pgEnum("order_type", [
  "dine_in",
  "pickup",
  "delivery",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "partial",
  "paid",
  "refunded",
]);

export const paymentTimingEnum = pgEnum("payment_timing", [
  "pay_first",
  "pay_later",
]);

export const orderItemStatusEnum = pgEnum("order_item_status", [
  "pending",
  "preparing",
  "ready",
  "served",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "card",
  "cash",
  "mobile",
  "other",
]);

export const paymentTransactionStatusEnum = pgEnum("payment_transaction_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
]);

/** Session = one dining visit at a table. At most one active session per table. */
export const sessionStatusEnum = pgEnum("session_status", [
  "open",
  "closed",
  "cancelled",
]);

export const sessionSourceEnum = pgEnum("session_source", [
  "walk_in",
  "reservation",
  "qr",
  "pos",
]);

export const seatStatusEnum = pgEnum("seat_status", ["active", "removed"]);

/** Wave/fire status for KDS and timing. */
export const orderWaveStatusEnum = pgEnum("order_wave_status", [
  "held",
  "sent",
  "preparing",
  "ready",
  "served",
]);

// =============================================================================
// TABLE 1: TABLES (Physical restaurant tables)
// =============================================================================

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    floorPlanId: uuid("floor_plan_id").references(() => floorPlans.id, {
      onDelete: "cascade",
    }),
    displayId: varchar("display_id", { length: 50 }), // e.g. "T1", "T2" - display label
    tableNumber: varchar("table_number", { length: 20 }).notNull(), // e.g. "T1", "T2" - for future A1, A2 etc
    seats: integer("seats"),
    /** Derived from open session in app; stored here for cache. Source of truth: sessions.status = 'open' per table. */
    status: tableStatusEnum("status").notNull().default("available"),
    // Layout (POS model: operational state lives on session)
    section: varchar("section", { length: 50 }),
    shape: varchar("shape", { length: 50 }),
    position: jsonb("position"),
    width: integer("width"),
    height: integer("height"),
    rotation: integer("rotation"),
    // Denormalized from active session for backward compat / quick reads
    guests: integer("guests"),
    serverId: uuid("server_id").references(() => staff.id),
    seatedAt: timestamp("seated_at", { withTimezone: true }),
    stage: varchar("stage", { length: 50 }),
    alerts: jsonb("alerts"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    locationIdIdx: index("tables_location_id_idx").on(table.locationId),
    tablesLocationIdDisplayIdIdx: index("tables_location_id_display_id_idx").on(
      table.locationId,
      table.displayId,
    ),
    floorPlanIdIdx: index("tables_floor_plan_id_idx").on(table.floorPlanId),
    locationTableNumberUnique: uniqueIndex("tables_location_table_number_unique").on(
      table.locationId,
      table.tableNumber,
    ),
    locationDisplayIdUnique: uniqueIndex("tables_location_display_id_unique").on(
      table.locationId,
      table.displayId,
    ),
  }),
);

// =============================================================================
// TABLE: WAITLIST
// =============================================================================

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    guestName: varchar("guest_name", { length: 255 }).notNull(),
    partySize: integer("party_size").notNull(),
    phone: varchar("phone", { length: 50 }),
    notes: text("notes"),
    waitTime: varchar("wait_time", { length: 50 }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    locationIdIdx: index("waitlist_location_id_idx").on(table.locationId),
  }),
);

// =============================================================================
// TABLE 2: CUSTOMERS
// =============================================================================

/** CRM enrichment stored in customers.profile_meta */
export type CustomerProfileMeta = {
  allergies?: Array<{ type: string; severity: "mild" | "moderate" | "severe" }>;
  dietary?: string[];
  preferences?: {
    seating?: string | null;
    zone?: string | null;
    server?: string | null;
    welcomeDrink?: string | null;
  };
  tags?: string[];
};

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id), // nullable (guest)
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    /** CRM: birthday (month-day or full date) */
    birthday: date("birthday"),
    /** CRM: anniversary */
    anniversary: date("anniversary"),
    /** CRM: allergies, dietary, preferences, tags */
    profileMeta: jsonb("profile_meta").$type<CustomerProfileMeta>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    locationIdIdx: index("customers_location_id_idx").on(table.locationId),
    userIdIdx: index("customers_user_id_idx").on(table.userId),
  }),
);

// =============================================================================
// TABLE 2b: CUSTOMER_NOTES (staff notes for CRM)
// =============================================================================

export const customerNotes = pgTable(
  "customer_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 255 }), // fallback when staffId null
    role: varchar("role", { length: 50 }), // e.g. "Server", "Host"
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    customerIdIdx: index("customer_notes_customer_id_idx").on(table.customerId),
  }),
);

// =============================================================================
// TABLE 3: RESERVATIONS
// =============================================================================

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id),
    tableId: uuid("table_id").references(() => tables.id),
    sessionId: uuid("session_id"), // FK to sessions.id (added in migration to avoid circular ref)
    partySize: integer("party_size").notNull(),
    reservationDate: date("reservation_date").notNull(),
    reservationTime: varchar("reservation_time", { length: 10 }).notNull(), // TIME as VARCHAR
    status: reservationStatusEnum("status").notNull().default("pending"),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 50 }),
    customerEmail: varchar("customer_email", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    locationIdIdx: index("reservations_location_id_idx").on(table.locationId),
    reservationDateIdx: index("reservations_reservation_date_idx").on(
      table.reservationDate,
    ),
    statusIdx: index("reservations_status_idx").on(table.status),
  }),
);

// =============================================================================
// TABLE 3a: SERVICE_PERIODS (Breakfast, Lunch, Dinner, Late Night - for analytics)
// =============================================================================

export const servicePeriods = pgTable(
  "service_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(), // e.g. "Breakfast", "Lunch"
    startTime: varchar("start_time", { length: 10 }).notNull(), // e.g. "08:00", "14:00"
    endTime: varchar("end_time", { length: 10 }).notNull(), // e.g. "11:00", "17:00"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    locationIdIdx: index("service_periods_location_id_idx").on(table.locationId),
  })
);

// =============================================================================
// TABLE 3b: SESSIONS (one dining visit per table; at most one active per table)
// =============================================================================

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    serverId: uuid("server_id").references(() => staff.id),
    guestCount: integer("guest_count").notNull().default(0),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    status: sessionStatusEnum("status").notNull().default("open"),
    source: sessionSourceEnum("source").notNull().default("walk_in"),
    reservationId: uuid("reservation_id").references(() => reservations.id),
    servicePeriodId: uuid("service_period_id").references(() => servicePeriods.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    locationIdIdx: index("sessions_location_id_idx").on(table.locationId),
    locationStatusIdx: index("sessions_location_id_status_idx").on(
      table.locationId,
      table.status
    ),
    tableIdIdx: index("sessions_table_id_idx").on(table.tableId),
    statusIdx: index("sessions_status_idx").on(table.status),
    openedAtIdx: index("sessions_opened_at_idx").on(table.openedAt),
    /** Enforce at most one open session per table. */
    oneOpenPerTable: uniqueIndex("sessions_one_open_per_table")
      .on(table.tableId)
      .where(sql`${table.status} = 'open'`),
  }),
);

// =============================================================================
// TABLE 3c: SESSION_EVENTS (operational events for analytics and audit)
// =============================================================================

export const sessionActorTypeEnum = pgEnum("session_actor_type", [
  "server",
  "kitchen",
  "system",
  "runner",
  "customer",
]);

export const sessionEventTypeEnum = pgEnum("session_event_type", [
  "session_opened",
  "guest_seated",
  "items_added",
  "order_sent",
  "item_ready",
  "served",
  "bill_requested",
  "payment_completed",
  "payment_attempted",
  "payment_failed",
  "refund_issued",
  "bill_split",
  "course_fired",
  "course_completed",
  "item_refired",
  "item_voided",
  "runner_assigned",
  "table_cleaned",
  "kitchen_delay",
  "guest_added",
  "guest_removed",
  "guest_count_adjusted",
]);

export const sessionEvents = pgTable(
  "session_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    type: sessionEventTypeEnum("type").notNull(),
    actorType: sessionActorTypeEnum("actor_type"),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    meta: jsonb("meta"),
  },
  (table) => ({
    sessionIdIdx: index("session_events_session_id_idx").on(table.sessionId),
    sessionIdTypeIdx: index("session_events_session_id_type_idx").on(
      table.sessionId,
      table.type
    ),
    sessionIdActorTypeIdx: index("session_events_session_id_actor_type_idx").on(
      table.sessionId,
      table.actorType
    ),
    actorIdIdx: index("session_events_actor_id_idx").on(table.actorId),
    createdAtIdx: index("session_events_created_at_idx").on(table.createdAt),
    metaOrderItemIdIdx: index("session_events_meta_order_item").on(
      sql`(${table.meta}->>'orderItemId')`
    ),
  })
);

// =============================================================================
// TABLE 3d: SEATS (one per guest position in a session; seat_number 1..guestCount)
// =============================================================================

export const seats = pgTable(
  "seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    seatNumber: integer("seat_number").notNull(),
    status: seatStatusEnum("status").notNull().default("active"),
    guestName: varchar("guest_name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index("seats_session_id_idx").on(table.sessionId),
    /** Hot path: addItemsToOrder/pos WHERE session_id = ? AND status = 'active' */
    sessionIdStatusIdx: index("seats_session_id_status_idx").on(table.sessionId, table.status),
    sessionSeatNumberUnique: uniqueIndex("seats_session_id_seat_number_key").on(
      table.sessionId,
      table.seatNumber
    ),
  })
);

// =============================================================================
// TABLE 4: ORDERS (waves/fires within a session)
// =============================================================================

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "cascade",
    }),
    wave: integer("wave").notNull().default(1),
    firedAt: timestamp("fired_at", { withTimezone: true }),
    station: varchar("station", { length: 50 }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => merchantLocations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id),
    tableId: uuid("table_id").references(() => tables.id),
    reservationId: uuid("reservation_id").references(() => reservations.id),
    assignedStaffId: uuid("assigned_staff_id").references(() => staff.id),
    orderNumber: varchar("order_number", { length: 20 }).notNull(),
    orderType: orderTypeEnum("order_type").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    paymentTiming: paymentTimingEnum("payment_timing").notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    serviceCharge: decimal("service_charge", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    tipAmount: decimal("tip_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    total: decimal("total", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    notes: text("notes"),
    estimatedReadyAt: timestamp("estimated_ready_at", { withTimezone: true }),
    /** Guest-requested future pickup time. Live board parks until releaseAt. */
    scheduledPickupAt: timestamp("scheduled_pickup_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    /** KDS snooze: when snooze was triggered. */
    snoozedAt: timestamp("snoozed_at", { withTimezone: true }),
    /** KDS snooze: when it expires. Derived isSnoozed = snoozeUntil != null && snoozeUntil > now. */
    snoozeUntil: timestamp("snooze_until", { withTimezone: true }),
    /** KDS: set on wake; prevents re-snooze. */
    wasSnoozed: boolean("was_snoozed").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index("orders_session_id_idx").on(table.sessionId),
    ordersSessionIdStatusIdx: index("orders_session_id_status_idx").on(
      table.sessionId,
      table.status,
    ),
    /** Hot path: getOpenWave WHERE session_id = ? AND fired_at IS NULL ORDER BY wave */
    sessionIdFiredAtIdx: index("orders_session_id_fired_at_idx").on(table.sessionId, table.firedAt),
    locationIdIdx: index("orders_location_id_idx").on(table.locationId),
    customerIdIdx: index("orders_customer_id_idx").on(table.customerId),
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
    locationScheduledPickupAtIdx: index("orders_location_scheduled_pickup_at_idx").on(
      table.locationId,
      table.scheduledPickupAt,
    ),
  }),
);

// =============================================================================
// TABLE 5: ORDER_ITEMS
// =============================================================================

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }), // menuItemId
    itemName: varchar("item_name", { length: 255 }).notNull(), // snapshot
    itemPrice: decimal("item_price", { precision: 10, scale: 2 }).notNull(), // snapshot
    quantity: integer("quantity").notNull().default(1),
    seat: integer("seat").notNull().default(0), // 0 = shared; deprecated, use seat_id
    seatId: uuid("seat_id").references(() => seats.id, { onDelete: "set null" }),
    customizationsTotal: decimal("customizations_total", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0.00"),
    lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    status: orderItemStatusEnum("status").notNull().default("pending"),
    stationOverride: varchar("station_override", { length: 50 }),
    sentToKitchenAt: timestamp("sent_to_kitchen_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    servedAt: timestamp("served_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    refiredAt: timestamp("refired_at", { withTimezone: true }),
    /** Work group for split tickets. null = main; non-null = split group (e.g. "grill", "salad"). */
    prepGroup: varchar("prep_group", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
    /** Hot path: fire/advance WHERE order_id = ? AND voided_at IS NULL */
    orderIdVoidedAtIdx: index("order_items_order_id_voided_at_idx").on(table.orderId, table.voidedAt),
    statusIdx: index("order_items_status_idx").on(table.status),
    /** Kitchen timestamps must be ordered: sentToKitchenAt <= startedAt <= readyAt <= servedAt. */
    kitchenTimestampsOrder: check(
      "order_items_kitchen_timestamps_order",
      sql`(
        (sent_to_kitchen_at IS NULL OR started_at IS NULL OR sent_to_kitchen_at <= started_at)
        AND (started_at IS NULL OR ready_at IS NULL OR started_at <= ready_at)
        AND (ready_at IS NULL OR served_at IS NULL OR ready_at <= served_at)
      )`
    ),
  }),
);

// =============================================================================
// TABLE 6: ORDER_ITEM_CUSTOMIZATIONS
// =============================================================================

export const orderItemCustomizations = pgTable(
  "order_item_customizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => customizationGroups.id, {
      onDelete: "set null",
    }),
    optionId: uuid("option_id").references(() => customizationOptions.id, {
      onDelete: "set null",
    }),
    groupName: varchar("group_name", { length: 255 }).notNull(), // snapshot
    optionName: varchar("option_name", { length: 255 }).notNull(), // snapshot
    optionPrice: decimal("option_price", { precision: 10, scale: 2 }).notNull(), // snapshot
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orderItemIdIdx: index("order_item_customizations_order_item_id_idx").on(
      table.orderItemId,
    ),
  }),
);

// =============================================================================
// TABLE 7: ORDER_TIMELINE
// =============================================================================

export const orderTimeline = pgTable(
  "order_timeline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull(),
    changedByStaffId: uuid("changed_by_staff_id").references(() => staff.id),
    changedByUserId: text("changed_by_user_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("order_timeline_order_id_idx").on(table.orderId),
  }),
);

// =============================================================================
// TABLE 8: PAYMENTS
// =============================================================================

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "cascade",
    }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }), // legacy / optional
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    tipAmount: decimal("tip_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    method: paymentMethodEnum("method").notNull(),
    status: paymentTransactionStatusEnum("status")
      .notNull()
      .default("pending"),
    provider: varchar("provider", { length: 50 }), // e.g., 'stripe', 'mollie'
    providerTransactionId: varchar("provider_transaction_id", { length: 255 }),
    providerResponse: jsonb("provider_response"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index("payments_session_id_idx").on(table.sessionId),
    paymentsSessionIdStatusIdx: index("payments_session_id_status_idx").on(
      table.sessionId,
      table.status,
    ),
    orderIdIdx: index("payments_order_id_idx").on(table.orderId),
    statusIdx: index("payments_status_idx").on(table.status),
  }),
);

// =============================================================================
// TABLE 9: ORDER_DELIVERY
// =============================================================================

export const orderDelivery = pgTable(
  "order_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    addressLine1: varchar("address_line1", { length: 255 }).notNull(),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    deliveryInstructions: text("delivery_instructions"),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", {
      withTimezone: true,
    }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("order_delivery_order_id_idx").on(table.orderId),
    orderIdUnique: uniqueIndex("order_delivery_order_id_unique").on(
      table.orderId,
    ),
  }),
);

// =============================================================================
// RELATIONS
// =============================================================================

export const servicePeriodsRelations = relations(servicePeriods, ({ one, many }) => ({
  location: one(merchantLocations, {
    fields: [servicePeriods.locationId],
    references: [merchantLocations.id],
  }),
  sessions: many(sessions),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  location: one(merchantLocations, {
    fields: [tables.locationId],
    references: [merchantLocations.id],
  }),
  reservations: many(reservations),
  sessions: many(sessions),
  orders: many(orders),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  location: one(merchantLocations, {
    fields: [sessions.locationId],
    references: [merchantLocations.id],
  }),
  table: one(tables, {
    fields: [sessions.tableId],
    references: [tables.id],
  }),
  server: one(staff, {
    fields: [sessions.serverId],
    references: [staff.id],
  }),
  reservation: one(reservations, {
    fields: [sessions.reservationId],
    references: [reservations.id],
  }),
  servicePeriod: one(servicePeriods, {
    fields: [sessions.servicePeriodId],
    references: [servicePeriods.id],
  }),
  orders: many(orders),
  payments: many(payments),
  events: many(sessionEvents),
  seats: many(seats),
}));

export const seatsRelations = relations(seats, ({ one, many }) => ({
  session: one(sessions, {
    fields: [seats.sessionId],
    references: [sessions.id],
  }),
  orderItems: many(orderItems),
}));

export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionEvents.sessionId],
    references: [sessions.id],
  }),
}));

export const customerNotesRelations = relations(customerNotes, ({ one }) => ({
  customer: one(customers, {
    fields: [customerNotes.customerId],
    references: [customers.id],
  }),
  staff: one(staff, {
    fields: [customerNotes.staffId],
    references: [staff.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  location: one(merchantLocations, {
    fields: [customers.locationId],
    references: [merchantLocations.id],
  }),
  reservations: many(reservations),
  orders: many(orders),
  notes: many(customerNotes),
}));

export const reservationsRelations = relations(
  reservations,
  ({ one, many }) => ({
    location: one(merchantLocations, {
      fields: [reservations.locationId],
      references: [merchantLocations.id],
    }),
    customer: one(customers, {
      fields: [reservations.customerId],
      references: [customers.id],
    }),
    table: one(tables, {
      fields: [reservations.tableId],
      references: [tables.id],
    }),
    session: one(sessions, {
      fields: [reservations.sessionId],
      references: [sessions.id],
    }),
    orders: many(orders),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  session: one(sessions, {
    fields: [orders.sessionId],
    references: [sessions.id],
  }),
  location: one(merchantLocations, {
    fields: [orders.locationId],
    references: [merchantLocations.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  reservation: one(reservations, {
    fields: [orders.reservationId],
    references: [reservations.id],
  }),
  assignedStaff: one(staff, {
    fields: [orders.assignedStaffId],
    references: [staff.id],
  }),
  orderItems: many(orderItems),
  timeline: many(orderTimeline),
  payments: many(payments),
  delivery: one(orderDelivery, {
    fields: [orders.id],
    references: [orderDelivery.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  seat: one(seats, {
    fields: [orderItems.seatId],
    references: [seats.id],
  }),
  item: one(items, {
    fields: [orderItems.itemId],
    references: [items.id],
  }),
  customizations: many(orderItemCustomizations),
}));

export const orderItemCustomizationsRelations = relations(
  orderItemCustomizations,
  ({ one }) => ({
    orderItem: one(orderItems, {
      fields: [orderItemCustomizations.orderItemId],
      references: [orderItems.id],
    }),
    group: one(customizationGroups, {
      fields: [orderItemCustomizations.groupId],
      references: [customizationGroups.id],
    }),
    option: one(customizationOptions, {
      fields: [orderItemCustomizations.optionId],
      references: [customizationOptions.id],
    }),
  }),
);

export const orderTimelineRelations = relations(orderTimeline, ({ one }) => ({
  order: one(orders, {
    fields: [orderTimeline.orderId],
    references: [orders.id],
  }),
  changedByStaff: one(staff, {
    fields: [orderTimeline.changedByStaffId],
    references: [staff.id],
  }),
  changedByUser: one(users, {
    fields: [orderTimeline.changedByUserId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  session: one(sessions, {
    fields: [payments.sessionId],
    references: [sessions.id],
  }),
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const orderDeliveryRelations = relations(orderDelivery, ({ one }) => ({
  order: one(orders, {
    fields: [orderDelivery.orderId],
    references: [orders.id],
  }),
}));

export const waitlistRelations = relations(waitlist, ({ one }) => ({
  location: one(merchantLocations, {
    fields: [waitlist.locationId],
    references: [merchantLocations.id],
  }),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Seat = typeof seats.$inferSelect;
export type NewSeat = typeof seats.$inferInsert;

export type SessionEvent = typeof sessionEvents.$inferSelect;
export type NewSessionEvent = typeof sessionEvents.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type OrderItemCustomization =
  typeof orderItemCustomizations.$inferSelect;
export type NewOrderItemCustomization =
  typeof orderItemCustomizations.$inferInsert;

export type OrderTimeline = typeof orderTimeline.$inferSelect;
export type NewOrderTimeline = typeof orderTimeline.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type OrderDelivery = typeof orderDelivery.$inferSelect;
export type NewOrderDelivery = typeof orderDelivery.$inferInsert;

export type Waitlist = typeof waitlist.$inferSelect;
export type NewWaitlist = typeof waitlist.$inferInsert;
