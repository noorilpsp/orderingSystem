-- Loyalty points expiration: FIFO lots + expire ledger kind
-- Apply with: npm run db:migrate:0019

ALTER TYPE "loyalty_ledger_kind" ADD VALUE IF NOT EXISTS 'expire';

ALTER TABLE "loyalty_ledger_entries"
  ALTER COLUMN "order_id" DROP NOT NULL;

DROP INDEX IF EXISTS "loyalty_ledger_entries_order_kind_uidx";

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_ledger_entries_order_kind_uidx"
  ON "loyalty_ledger_entries" ("order_id", "kind")
  WHERE "order_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "loyalty_point_lots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "loyalty_accounts"("id") ON DELETE cascade,
  "earn_ledger_entry_id" uuid REFERENCES "loyalty_ledger_entries"("id") ON DELETE set null,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE set null,
  "location_id" uuid NOT NULL REFERENCES "merchant_locations"("id") ON DELETE cascade,
  "points_initial" integer NOT NULL,
  "points_remaining" integer NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_point_lots_earn_ledger_uidx"
  ON "loyalty_point_lots" ("earn_ledger_entry_id")
  WHERE "earn_ledger_entry_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "loyalty_point_lots_account_expires_idx"
  ON "loyalty_point_lots" ("account_id", "expires_at");

CREATE INDEX IF NOT EXISTS "loyalty_point_lots_account_remaining_idx"
  ON "loyalty_point_lots" ("account_id", "points_remaining");

-- Backfill lots from historical earn ledger rows (no expiry on legacy points).
INSERT INTO "loyalty_point_lots" (
  "account_id",
  "earn_ledger_entry_id",
  "order_id",
  "location_id",
  "points_initial",
  "points_remaining",
  "expires_at",
  "created_at"
)
SELECT
  le."account_id",
  le."id",
  le."order_id",
  le."location_id",
  le."points",
  le."points",
  NULL,
  le."created_at"
FROM "loyalty_ledger_entries" le
WHERE le."kind" = 'earn'
  AND le."points" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "loyalty_point_lots" l
    WHERE l."earn_ledger_entry_id" = le."id"
  );
