-- BASELINE: Estrutura inicial do banco baseada no uso do frontend
-- NOTA: Esta migration é uma inferência do estado atual, pois o `supabase CLI` não estava disponível para um `db pull`.
-- Recomenda-se comparar com o banco real antes de aplicar.

CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_de_usuario TEXT NOT NULL UNIQUE,
    caminho TEXT CHECK (caminho IN ('jogador', 'tecnico', 'presidente')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jogadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    avatar TEXT,
    nome TEXT NOT NULL,
    apelido TEXT,
    idade INT NOT NULL,
    naturalidade TEXT,
    nacionalidade TEXT,
    pe_dominante TEXT,
    altura NUMERIC,
    peso INT,
    posicao TEXT NOT NULL,
    arquetipo TEXT NOT NULL,
    atributos_base JSONB,
    modificadores_corpo JSONB,
    atributos JSONB,
    dinheiro NUMERIC DEFAULT 0,
    experiencia INT DEFAULT 0,
    reputacao INT DEFAULT 0,
    potencial INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fim da baseline
