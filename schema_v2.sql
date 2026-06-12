ALTER TABLE hand_events ADD COLUMN session_uuid TEXT;
ALTER TABLE consult_events ADD COLUMN session_uuid TEXT;
ALTER TABLE training_sessions ADD COLUMN session_uuid TEXT;
ALTER TABLE hand_events ADD COLUMN client_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hand_events_dedupe ON hand_events(user_id, client_event_id);
CREATE INDEX IF NOT EXISTS idx_hand_events_session ON hand_events(session_uuid);
CREATE INDEX IF NOT EXISTS idx_hand_events_range ON hand_events(range_id);
CREATE INDEX IF NOT EXISTS idx_consult_events_range ON consult_events(range_id);
