-- POS idempotency keys for mutation replay (guest + staff APIs).
-- Apply with: npm run db:migrate:0013

CREATE TABLE IF NOT EXISTS "pos_idempotency_keys" (
  "key" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "route" text NOT NULL,
  "request_hash" text NOT NULL,
  "response_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pos_idempotency_keys_created_at_idx"
  ON "pos_idempotency_keys" ("created_at");
