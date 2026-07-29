-- Duração (segundos) de cada round do Range Check — cronômetro por round,
-- alimenta "quanto tempo levou" no histórico e nas análises.
ALTER TABLE range_build_events ADD COLUMN duration_seconds INTEGER;
