-- Store TikTok handle for guest menu / social links.

ALTER TABLE merchant_locations
  ADD COLUMN IF NOT EXISTS tiktok_handle varchar(100);
