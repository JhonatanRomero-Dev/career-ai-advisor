CREATE TABLE IF NOT EXISTS professional_profiles (
  user_id TEXT PRIMARY KEY, public_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, filters TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE TABLE IF NOT EXISTS search_history (
  user_id TEXT NOT NULL, term TEXT NOT NULL, searched_at TEXT NOT NULL, PRIMARY KEY(user_id, term)
);
CREATE TABLE IF NOT EXISTS product_feedback (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_feedback_user ON product_feedback(user_id);
CREATE TABLE IF NOT EXISTS support_interactions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, fallback INTEGER NOT NULL, duration_ms INTEGER NOT NULL,
  helpful INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_interactions_user ON support_interactions(user_id);
