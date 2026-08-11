-- Optional Arabic overrides for modifiers and tags (guest catalog).

ALTER TABLE customization_groups
  ADD COLUMN IF NOT EXISTS i18n jsonb;

ALTER TABLE customization_options
  ADD COLUMN IF NOT EXISTS i18n jsonb;

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS i18n jsonb;
