CREATE TABLE IF NOT EXISTS range_build_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_uuid TEXT,
  rounds_total INTEGER NOT NULL DEFAULT 0,
  rounds_played INTEGER NOT NULL DEFAULT 0,
  avg_score REAL NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_range_build_sessions_user ON range_build_sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_range_build_sessions_dedupe ON range_build_sessions(user_id, session_uuid);

-- Rodar apenas uma vez: ALTER TABLE falha se a coluna já existir.
ALTER TABLE range_build_events ADD COLUMN wrong_hands TEXT;
