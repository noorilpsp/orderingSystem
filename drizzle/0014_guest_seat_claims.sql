-- Guest QR device-to-seat claims for per-phone checks at a table.
-- Apply with: npm run db:migrate:0014

CREATE TABLE IF NOT EXISTS "guest_seat_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "device_id" text NOT NULL,
  "seat_id" uuid NOT NULL REFERENCES "seats"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_seat_claims_session_device_key"
  ON "guest_seat_claims" ("session_id", "device_id");

CREATE UNIQUE INDEX IF NOT EXISTS "guest_seat_claims_session_seat_key"
  ON "guest_seat_claims" ("session_id", "seat_id");
