-- Add emoji column to tags and allergens tables
ALTER TABLE tags ADD COLUMN IF NOT EXISTS emoji varchar(10);
ALTER TABLE allergens ADD COLUMN IF NOT EXISTS emoji varchar(10);
