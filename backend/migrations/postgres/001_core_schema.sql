CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resume_analyses (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_url TEXT,
  resume_text TEXT,
  account_email TEXT,
  email TEXT,
  phone TEXT,
  area TEXT,
  target_job_title TEXT,
  target_job_description TEXT,
  job_match_score INTEGER NOT NULL DEFAULT 0 CHECK (job_match_score BETWEEN 0 AND 100),
  matched_keywords JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(matched_keywords) = 'array'),
  summary TEXT,
  main_area TEXT,
  seniority TEXT,
  english_level TEXT,
  ats_score INTEGER NOT NULL DEFAULT 0 CHECK (ats_score BETWEEN 0 AND 100),
  clarity_score INTEGER NOT NULL DEFAULT 0 CHECK (clarity_score BETWEEN 0 AND 100),
  market_compatibility INTEGER NOT NULL DEFAULT 0 CHECK (market_compatibility BETWEEN 0 AND 100),
  detected_skills JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(detected_skills) = 'array'),
  missing_keywords JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(missing_keywords) = 'array'),
  weak_words JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(weak_words) = 'array'),
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(strengths) = 'array'),
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(suggestions) = 'array'),
  recommended_jobs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(recommended_jobs) = 'array'),
  job_search_status TEXT NOT NULL DEFAULT 'pending',
  job_search_checked_at TIMESTAMPTZ,
  job_search_provider TEXT,
  job_search_error TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_analyses_account_email_created_at
  ON resume_analyses(account_email, created_at DESC);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_mimetype TEXT,
  file_size INTEGER NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  request_body JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_body) = 'object'),
  analysis_id TEXT REFERENCES resume_analyses(id) ON DELETE SET NULL,
  notification_id TEXT,
  analysis_result JSONB,
  notification_result JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_account_email
  ON analysis_jobs(account_email);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_updated_at
  ON analysis_jobs(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id_created_at
  ON analysis_jobs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT,
  location TEXT,
  headline TEXT,
  target_role TEXT,
  experience_level TEXT,
  linkedin TEXT,
  portfolio TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'Gratis' CHECK (plan IN ('Gratis', 'Pro', 'Premium')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'canceling',
        'canceled',
        'cancelled',
        'expired',
        'pending',
        'approved',
        'rejected',
        'refunded',
        'charged_back',
        'failed',
        'review_required'
      )
    ),
  source TEXT NOT NULL DEFAULT 'demo',
  current_period_start_at TIMESTAMPTZ,
  current_period_end_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_checkouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('Pro', 'Premium')),
  provider TEXT NOT NULL,
  provider_checkout_id TEXT,
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'approved',
        'failed',
        'rejected',
        'cancelled',
        'refunded',
        'charged_back',
        'review_required'
      )
    ),
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  checkout_url TEXT,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_checkouts_user_id
  ON subscription_checkouts(user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_checkouts_provider_payment_id
  ON subscription_checkouts(provider_payment_id);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  event_type TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  request_id TEXT,
  checkout_id TEXT REFERENCES subscription_checkouts(id) ON DELETE SET NULL,
  provider_payment_id TEXT,
  payment_status TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'failed', 'ignored', 'review_required')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_event
  ON payment_webhook_events(provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_resource
  ON payment_webhook_events(provider, resource_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_checkout_id
  ON payment_webhook_events(checkout_id);

CREATE TABLE IF NOT EXISTS ai_events (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'fallback', 'skipped')),
  account_email TEXT,
  message TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_events_status_created_at
  ON ai_events(status, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_events_account_email
  ON ai_events(account_email);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email_expires_at
  ON email_verification_codes(email, expires_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email_expires_at
  ON password_reset_codes(email, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id_expires_at
  ON auth_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS oauth_exchange_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_exchange_codes_user_id_expires_at
  ON oauth_exchange_codes(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS analysis_tasks (
  analysis_id TEXT PRIMARY KEY REFERENCES resume_analyses(id) ON DELETE CASCADE,
  account_email TEXT NOT NULL,
  checked JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checked) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_tasks_account_email
  ON analysis_tasks(account_email);

CREATE TABLE IF NOT EXISTS job_notifications (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES resume_analyses(id) ON DELETE CASCADE,
  account_email TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  job_count INTEGER NOT NULL DEFAULT 0 CHECK (job_count >= 0),
  top_match INTEGER NOT NULL DEFAULT 0 CHECK (top_match BETWEEN 0 AND 100),
  jobs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(jobs) = 'array'),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_notifications_account_email_created_at
  ON job_notifications(account_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_notifications_analysis_id
  ON job_notifications(analysis_id);
