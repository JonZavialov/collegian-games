CREATE TABLE IF NOT EXISTS quiz_configs (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quiz_configs_slug_idx ON quiz_configs (slug);

CREATE TABLE IF NOT EXISTS quiz_admin_attempts (
  ip_address TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS quiz_admin_attempts_locked_idx
  ON quiz_admin_attempts (locked_until);

CREATE TABLE IF NOT EXISTS quiz_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS quiz_admin_sessions_expires_idx
  ON quiz_admin_sessions (expires_at);
