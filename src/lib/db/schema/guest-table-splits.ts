import { jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sessions } from "./orders";

/** One seat’s relative share of a line (equal weight unless shares differ). */
export type GuestSplitShare = {
  seatId: string;
  seatNumber: number | null;
  shares: number;
};

/**
 * Line assignment on the shared table split board.
 * - One share → sole assignee (Claim / S1 / S2)
 * - Multiple shares → Split among seats
 * Legacy rows may only have seatId/seatNumber; normalize on read.
 */
export type GuestSplitClaimRecord = {
  lineId: string;
  shares: GuestSplitShare[];
  updatedByDeviceId: string;
  updatedAt: string;
  /** @deprecated legacy sole-claim fields - still accepted when reading old JSON */
  seatId?: string;
  seatNumber?: number | null;
  deviceId?: string;
  claimedAt?: string;
};

export type GuestSplitProposalAmount = {
  seatId: string | null;
  seatNumber: number | null;
  amount: number;
};

export type GuestSplitProposalRecord = {
  id: string;
  mode: "one-bill" | "by-seat" | "equal" | "item";
  fromSeatId: string;
  fromSeatNumber: number | null;
  createdAt: string;
  equalCount?: number;
  amounts: GuestSplitProposalAmount[];
  unassignedAmount?: number;
};

export type GuestSplitClaimsMap = Record<string, GuestSplitClaimRecord>;

/** Virtual + Payer seats shared across devices for Item split. */
export type GuestSplitExtraPayer = {
  id: string;
  seatNumber: number;
};

export const EXTRA_PAYER_PREFIX = "extra-payer:";

export function isExtraPayerId(seatId: string): boolean {
  return (
    seatId.startsWith(EXTRA_PAYER_PREFIX) || seatId.startsWith("local-payer:")
  );
}

export const guestTableSplits = pgTable(
  "guest_table_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    claims: jsonb("claims").$type<GuestSplitClaimsMap>().notNull().default({}),
    proposal: jsonb("proposal").$type<GuestSplitProposalRecord | null>(),
    extraPayers: jsonb("extra_payers")
      .$type<GuestSplitExtraPayer[]>()
      .notNull()
      .default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionUnique: uniqueIndex("guest_table_splits_session_key").on(table.sessionId),
  }),
);

export type GuestTableSplit = typeof guestTableSplits.$inferSelect;
export type NewGuestTableSplit = typeof guestTableSplits.$inferInsert;
