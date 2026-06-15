CREATE TABLE IF NOT EXISTS team_ranges (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS team_ranges_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO team_ranges_meta (id, version) VALUES (1, 0);
CREATE INDEX IF NOT EXISTS idx_team_ranges_version ON team_ranges(version);
