-- Shared + Payer (extra payers) on guest table split board.
-- Apply with: npm run db:migrate:0029

ALTER TABLE "guest_table_splits"
  ADD COLUMN IF NOT EXISTS "extra_payers" jsonb NOT NULL DEFAULT '[]'::jsonb;
