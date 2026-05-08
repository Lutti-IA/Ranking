-- SCRIPT DE CONFIGURAÇÃO COMPLETO (SUPABASE)
-- Copie este código e cole no SQL Editor do seu projeto Supabase.

-- 1. Criação da Tabela de Jogadores
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    avatar TEXT,
    password TEXT,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role TEXT DEFAULT 'player',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criação da Tabela de Partidas
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    player_1_id UUID REFERENCES players(id),
    player_2_id UUID REFERENCES players(id),
    player_1_name TEXT,
    player_2_name TEXT,
    winner_id UUID REFERENCES players(id),
    sets JSONB DEFAULT '[]'::jsonb,
    type TEXT DEFAULT 'competitive',
    status TEXT DEFAULT 'approved',
    reported_by UUID REFERENCES players(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Resetar e Habilitar RLS (Segurança)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Permitir tudo em jogadores" ON players;
DROP POLICY IF EXISTS "Permitir tudo em partidas" ON matches;
DROP POLICY IF EXISTS "Leitura pública de jogadores" ON players;
DROP POLICY IF EXISTS "Cadastro de novos jogadores" ON players;
DROP POLICY IF EXISTS "Apenas admin altera jogadores" ON players;
DROP POLICY IF EXISTS "Apenas admin exclui jogadores" ON players;
DROP POLICY IF EXISTS "Leitura pública de partidas" ON matches;
DROP POLICY IF EXISTS "Registro de partidas" ON matches;
DROP POLICY IF EXISTS "Apenas admin altera partidas" ON matches;
DROP POLICY IF EXISTS "Apenas admin exclui partidas" ON matches;

-- 5. Criar novas políticas de acesso restrito (Segurança Total)

-- Políticas para Jogadores (Players)
CREATE POLICY "Leitura pública de jogadores" ON players 
    FOR SELECT USING (true);

CREATE POLICY "Cadastro de novos jogadores" ON players 
    FOR INSERT WITH CHECK (true);

-- Apenas o próprio usuário ou Admin pode alterar dados de jogadores
CREATE POLICY "Usuário altera próprio perfil ou admin" ON players 
    FOR UPDATE 
    USING (id = auth.uid() OR EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Apenas admin exclui jogadores" ON players 
    FOR DELETE 
    USING (EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'admin'));

-- Políticas para Partidas (Matches)
CREATE POLICY "Leitura pública de partidas" ON matches 
    FOR SELECT USING (true);

CREATE POLICY "Registro de próprias partidas ou admin" ON matches 
    FOR INSERT 
    WITH CHECK (
        player_1_id = auth.uid() OR 
        player_2_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'admin')
    );

-- Apenas Admin pode modificar ou remover partidas
CREATE POLICY "Apenas admin altera partidas" ON matches 
    FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Apenas admin exclui partidas" ON matches 
    FOR DELETE 
    USING (EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'admin'));

-- 6. Trigger Automático para Ranking (O Sistema cuida dos pontos)
CREATE OR REPLACE FUNCTION handle_ranking_update()
RETURNS TRIGGER AS $$
DECLARE
    w_pts INTEGER;
    l_pts INTEGER;
    points_to_add INTEGER;
    loser_id UUID;
    is_new_approval BOOLEAN;
BEGIN
    -- Verificar se a partida está sendo aprovada agora (ou se já foi inserida aprovada)
    is_new_approval := (TG_OP = 'INSERT' AND NEW.status = 'approved') 
                    OR (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'approved');

    IF is_new_approval THEN
        -- Identificar IDs
        loser_id := CASE WHEN NEW.winner_id = NEW.player_1_id THEN NEW.player_2_id ELSE NEW.player_1_id END;

        -- Pegar pontos atuais para cálculo de "underdog"
        SELECT points INTO w_pts FROM players WHERE id = NEW.winner_id;
        SELECT points INTO l_pts FROM players WHERE id = loser_id;

        -- Regra: Ganhar de quem está acima = 20 pts. Ganhar de quem está abaixo = 10 pts.
        IF w_pts < l_pts THEN
            points_to_add := 20;
        ELSE
            points_to_add := 10;
        END IF;

        -- Atualizar ganhador
        UPDATE players 
        SET wins = wins + 1, 
            points = points + points_to_add, 
            matches_played = matches_played + 1, 
            last_active = NOW()
        WHERE id = NEW.winner_id;

        -- Atualizar perdedor
        UPDATE players 
        SET losses = losses + 1, 
            matches_played = matches_played + 1, 
            last_active = NOW()
        WHERE id = loser_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_ranking_update ON matches;
CREATE TRIGGER tr_ranking_update
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW EXECUTE FUNCTION handle_ranking_update();

-- 7. Índices para Performance
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
