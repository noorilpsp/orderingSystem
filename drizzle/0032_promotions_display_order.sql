-- Guest Promotions category order, matching dashboard drag-and-drop.

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

UPDATE promotions AS p
SET display_order = n.ord
FROM (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY created_at ASC, id ASC) - 1)::integer AS ord
  FROM promotions
) AS n
WHERE p.id = n.id
  AND p.display_order = 0;
