# Arena BT - Sistema de Ranking

Sistema de gestão de ranking e estatísticas para torneios de Beach Tennis (Arena BT).

## 🚀 Tecnologias

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React (Ícones)
- Motion (Animações)
- Supabase (Backend/Database)
- jsPDF (Exportação de relatórios)

## 🛠 Configuração Inicial

### 1. Clonar o Repositório
```bash
git clone <seu-repositorio>
cd <pasta-do-projeto>
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
```env
VITE_SUPABASE_URL=https://sua-url.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key
```

### 4. Estrutura do Banco de Dados (Supabase)
Crie as seguintes tabelas no seu projeto Supabase:

#### Tabela `players`
- `id`: UUID (Primary Key, Default: auth.uid() or gen_random_uuid())
- `name`: Text
- `username`: Text (Unique)
- `avatar`: Text (Optional)
- `password`: Text (Simples PIN para login interno)
- `matches_played`: Int (Default: 0)
- `wins`: Int (Default: 0)
- `losses`: Int (Default: 0)
- `points`: Int (Default: 0)
- `role`: Text (Default: 'player')
- `created_at`: Timestamp with time zone (Default: now())

#### Tabela `matches`
- `id`: UUID (Primary Key, Default: gen_random_uuid())
- `player1_id`: UUID (Foreign Key -> players.id)
- `player2_id`: UUID (Foreign Key -> players.id)
- `sets`: JSONB (Ex: `[{"player1": 6, "player2": 4}]`)
- `winner_id`: UUID (Foreign Key -> players.id)
- `date`: Timestamp with time zone (Default: now())
- `status`: Text (Ex: 'completed')

## 🚀 Deploy no Vercel

1. Suba o código no seu GitHub.
2. Conecte o repositório no dashboard do Vercel.
3. Nas configurações de **Environment Variables** do Vercel, adicione as chaves:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. O Vercel detectará automaticamente o Vite e fará o build usando `npm run build`.

## 📄 Licença
Distribuído sob a licença Apache-2.0.
