import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { seats, sessions } from "./orders";

export const guestSeatClaims = pgTable(
  "guest_seat_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    seatId: uuid("seat_id")
      .notNull()
      .references(() => seats.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionDeviceUnique: uniqueIndex("guest_seat_claims_session_device_key").on(
      table.sessionId,
      table.deviceId,
    ),
    sessionSeatUnique: uniqueIndex("guest_seat_claims_session_seat_key").on(
      table.sessionId,
      table.seatId,
    ),
  }),
);

export type GuestSeatClaim = typeof guestSeatClaims.$inferSelect;
export type NewGuestSeatClaim = typeof guestSeatClaims.$inferInsert;
