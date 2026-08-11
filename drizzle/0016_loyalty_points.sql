-- Loyalty points v1: merchant settings + accounts + earn ledger
-- Apply with: npm run db:migrate:0016

ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "loyalty_settings" jsonb;

CREATE TYPE "loyalty_ledger_kind" AS ENUM ('earn', 'adjust');

CREATE TABLE IF NOT EXISTS "loyalty_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid NOT NULL REFERENCES "merchants"("id") ON DELETE cascade,
  "location_id" uuid REFERENCES "merchant_locations"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "balance" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_accounts_merchant_user_uidx"
  ON "loyalty_accounts" ("merchant_id", "user_id")
  WHERE "location_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_accounts_merchant_location_user_uidx"
  ON "loyalty_accounts" ("merchant_id", "location_id", "user_id")
  WHERE "location_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "loyalty_accounts_user_id_idx"
  ON "loyalty_accounts" ("user_id");

CREATE INDEX IF NOT EXISTS "loyalty_accounts_merchant_id_idx"
  ON "loyalty_accounts" ("merchant_id");

CREATE TABLE IF NOT EXISTS "loyalty_ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "loyalty_accounts"("id") ON DELETE cascade,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
  "location_id" uuid NOT NULL REFERENCES "merchant_locations"("id") ON DELETE cascade,
  "points" integer NOT NULL,
  "kind" "loyalty_ledger_kind" DEFAULT 'earn' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_ledger_entries_order_id_uidx"
  ON "loyalty_ledger_entries" ("order_id");

CREATE INDEX IF NOT EXISTS "loyalty_ledger_entries_account_id_idx"
  ON "loyalty_ledger_entries" ("account_id");
