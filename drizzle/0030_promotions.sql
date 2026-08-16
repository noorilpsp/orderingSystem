-- Menu promotions: sale price + buy-one-get-one, optional hours.

CREATE TYPE promotion_kind AS ENUM ('sale_price', 'bogo');
CREATE TYPE promotion_status AS ENUM ('active', 'paused');

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES merchant_locations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  kind promotion_kind NOT NULL,
  status promotion_status NOT NULL DEFAULT 'active',
  starts_on date,
  ends_on date,
  start_time varchar(5),
  end_time varchar(5),
  active_days text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotions_location_status_idx
  ON promotions (location_id, status);

CREATE INDEX IF NOT EXISTS promotions_merchant_id_idx
  ON promotions (merchant_id);

CREATE TABLE IF NOT EXISTS promotion_items (
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  sale_price numeric(10, 2),
  PRIMARY KEY (promotion_id, item_id)
);

CREATE INDEX IF NOT EXISTS promotion_items_item_id_idx
  ON promotion_items (item_id);
