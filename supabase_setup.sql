-- COPIE E COLE ESTE CÓDIGO NO SQL EDITOR DO SUPABASE (https://supabase.com/dashboard/project/_/sql)
-- Clique em "New Query", cole o código abaixo e clique em "Run".

-- 1. LIMPEZA TOTAL (OPCIONAL: REMOVA SE NÃO QUISER PERDER OS DADOS ATUAIS)
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- 2. CRIAÇÃO DA TABELA DE JOGADORES (PLAYERS)
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar TEXT,
  password TEXT, -- O sistema usa PIN de 6 dígitos
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CRIAÇÃO DA TABELA DE PARTIDAS (MATCHES)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  player_1_id UUID REFERENCES players(id) ON DELETE CASCADE,
  player_2_id UUID REFERENCES players(id) ON DELETE CASCADE,
  player_1_name TEXT,
  player_2_name TEXT,
  winner_id UUID REFERENCES players(id) ON DELETE CASCADE,
  sets JSONB, -- Armazena o placar dos sets: [{"player1": 6, "player2": 4}, ...] 
  type TEXT DEFAULT 'competitive',
  status TEXT DEFAULT 'approved',
  reported_by UUID REFERENCES players(id) ON DELETE SET NULL
);

-- 4. HABILITAR SEGURANÇA (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACESSO (PERMITE TUDO PARA QUEM TEM A ANON KEY)
-- Nota: Para produção, você deve restringir estas políticas.
CREATE POLICY "Leitura Pública Players" ON players FOR SELECT USING (true);
CREATE POLICY "Inserção Pública Players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Update Público Players" ON players FOR UPDATE USING (true);

CREATE POLICY "Leitura Pública Matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Inserção Pública Matches" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Update Público Matches" ON matches FOR UPDATE USING (true);

-- 6. INDEXAÇÃO PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
