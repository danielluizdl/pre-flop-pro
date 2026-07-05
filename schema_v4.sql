CREATE TABLE IF NOT EXISTS range_build_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  range_id INTEGER NOT NULL,
  range_name TEXT NOT NULL DEFAULT '',
  stack_range TEXT,
  score REAL NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  rounds_total INTEGER,
  session_uuid TEXT,
  client_event_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_range_build_events_user ON range_build_events(user_id);
CREATE INDEX IF NOT EXISTS idx_range_build_events_range ON range_build_events(range_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_range_build_events_dedupe ON range_build_events(user_id, client_event_id);
