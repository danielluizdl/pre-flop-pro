-- Guarda o suficiente pra reconstruir o replay de verdade (naipes das cartas
-- e tamanho do raise no Drill; o grid pintado pelo jogador e o gabarito no
-- Range Check), pra sessões de treino ficarem permanentes na nuvem em vez de
-- depender só de localStorage.
ALTER TABLE hand_events ADD COLUMN suits TEXT;
ALTER TABLE hand_events ADD COLUMN raise_size TEXT;
ALTER TABLE range_build_events ADD COLUMN user_grid TEXT;
ALTER TABLE range_build_events ADD COLUMN answer_grid TEXT;
ALTER TABLE training_sessions ADD COLUMN table_size INTEGER;
