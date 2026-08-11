-- Optional Arabic (and future locale) overrides for guest catalog copy.
-- Canonical name/description columns remain the store's primary language (English).

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS i18n jsonb;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS i18n jsonb;
