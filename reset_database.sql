-- SCRIPT PARA ZERAR DADOS (RESET)
-- Copie e cole no SQL Editor do Supabase para limpar o ranking e as partidas.

-- 1. Apagar todas as partidas registradas
DELETE FROM matches;

-- 2. Zerar as estatísticas de todos os jogadores (Ranking)
UPDATE players 
SET 
    matches_played = 0, 
    wins = 0, 
    losses = 0, 
    points = 0,
    last_active = NOW();

-- Opcional: Se quiser apagar todos os jogadores também, use:
-- DELETE FROM players;
