-- Staff Web Push subscriptions for incoming-order alerts when /orders is closed.
CREATE TABLE IF NOT EXISTS staff_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES merchant_locations(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_push_subscriptions_endpoint_uidx
  ON staff_push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS staff_push_subscriptions_location_idx
  ON staff_push_subscriptions (location_id);

CREATE INDEX IF NOT EXISTS staff_push_subscriptions_user_idx
  ON staff_push_subscriptions (user_id);
