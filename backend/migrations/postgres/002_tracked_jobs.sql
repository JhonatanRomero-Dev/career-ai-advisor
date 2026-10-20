CREATE TABLE IF NOT EXISTS tracked_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_email TEXT NOT NULL,
  analysis_id TEXT REFERENCES resume_analyses(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved', 'applied', 'interview', 'offer', 'rejected', 'archived')),
  job_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(job_snapshot) = 'object'),
  notes TEXT NOT NULL DEFAULT '',
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_tracked_jobs_user_id_updated_at
  ON tracked_jobs(user_id, updated_at DESC);
