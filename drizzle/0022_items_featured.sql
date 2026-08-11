-- Merchant-controlled Featured flag for guest menu strip.
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_items_location_featured
  ON items (location_id, featured)
  WHERE featured = true;
