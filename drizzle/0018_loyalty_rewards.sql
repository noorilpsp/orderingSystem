-- Loyalty rewards catalog + redemptions.

CREATE TYPE loyalty_reward_kind AS ENUM ('fixed_off', 'percent_off', 'free_item');
CREATE TYPE loyalty_reward_status AS ENUM ('active', 'inactive');

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  location_id uuid REFERENCES merchant_locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status loyalty_reward_status NOT NULL DEFAULT 'active',
  kind loyalty_reward_kind NOT NULL,
  points_cost integer NOT NULL,
  discount_amount numeric(10, 2),
  percent_off integer,
  max_discount_amount numeric(10, 2),
  menu_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_rewards_points_cost_positive CHECK (points_cost > 0)
);

CREATE INDEX IF NOT EXISTS loyalty_rewards_merchant_id_idx
  ON loyalty_rewards (merchant_id);

CREATE INDEX IF NOT EXISTS loyalty_rewards_merchant_status_idx
  ON loyalty_rewards (merchant_id, status);

CREATE TABLE IF NOT EXISTS loyalty_reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES loyalty_rewards(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_reward_redemptions_order_id_uidx
  ON loyalty_reward_redemptions (order_id);

CREATE INDEX IF NOT EXISTS loyalty_reward_redemptions_reward_id_idx
  ON loyalty_reward_redemptions (reward_id);
