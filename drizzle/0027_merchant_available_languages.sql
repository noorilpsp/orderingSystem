-- Available guest menu languages (e.g. ["en","ar"]).

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS available_languages jsonb
  DEFAULT '["en","ar"]'::jsonb;
