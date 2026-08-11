-- Merchant platform modules (KDS, etc.). Default off until enabled in /admin/merchants.
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "features" jsonb;
