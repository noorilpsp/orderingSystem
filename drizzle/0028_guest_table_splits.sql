-- Shared guest split claims + proposals per open table session.
-- Apply with: npm run db:migrate:0028

CREATE TABLE IF NOT EXISTS "guest_table_splits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "claims" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "proposal" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_table_splits_session_key"
  ON "guest_table_splits" ("session_id");
