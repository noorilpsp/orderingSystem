-- Future guest pickup target time. Orders stay hidden from the live /orders
-- incoming queue until releaseAt = scheduled_pickup_at - prep buffer.
-- Apply with: npm run db:migrate:0015

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "scheduled_pickup_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "orders_location_scheduled_pickup_at_idx"
  ON "orders" ("location_id", "scheduled_pickup_at");
