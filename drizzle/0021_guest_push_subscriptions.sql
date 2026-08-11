-- Guest Web Push subscriptions + idempotent lifecycle events for order-confirmation.
CREATE TABLE IF NOT EXISTS guest_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_slug varchar(255) NOT NULL,
  confirmation_url text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_push_subscriptions_order_endpoint_uidx
  ON guest_push_subscriptions (order_id, endpoint);

CREATE INDEX IF NOT EXISTS guest_push_subscriptions_order_idx
  ON guest_push_subscriptions (order_id);

CREATE INDEX IF NOT EXISTS guest_push_subscriptions_endpoint_idx
  ON guest_push_subscriptions (endpoint);

CREATE TABLE IF NOT EXISTS guest_order_push_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type varchar(40) NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_order_push_events_order_event_uidx
  ON guest_order_push_events (order_id, event_type);

CREATE INDEX IF NOT EXISTS guest_order_push_events_order_idx
  ON guest_order_push_events (order_id);
