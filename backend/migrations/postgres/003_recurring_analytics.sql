ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS next_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;

ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status IN (
    'active', 'canceling', 'canceled', 'cancelled', 'expired', 'pending',
    'approved', 'authorized', 'paused', 'past_due', 'rejected', 'refunded',
    'charged_back', 'failed', 'review_required'
  ));

ALTER TABLE subscription_checkouts DROP CONSTRAINT IF EXISTS subscription_checkouts_status_check;
ALTER TABLE subscription_checkouts ADD CONSTRAINT subscription_checkouts_status_check
  CHECK (status IN (
    'pending', 'authorized', 'paused', 'approved', 'failed', 'rejected',
    'canceled', 'cancelled', 'refunded', 'charged_back', 'review_required'
  ));

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_subscription_id
  ON user_subscriptions(provider_subscription_id);

CREATE TABLE IF NOT EXISTS product_events (
  id TEXT PRIMARY KEY,
  anonymous_id TEXT NOT NULL,
  user_hash TEXT,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(properties) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_events_name_occurred_at
  ON product_events(event_name, occurred_at);

CREATE INDEX IF NOT EXISTS idx_product_events_user_hash
  ON product_events(user_hash);
