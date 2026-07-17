-- ==========================================
-- AVISO: MIGRATION PROVISÓRIA / NÃO CONFIRMADA
-- ==========================================
-- NÃO APLIQUE ESTA MIGRATION NO SUPABASE ATUAL SEM ANTES COMPARAR COM O BANCO.
-- Esta é apenas uma reconstrução teórica baseada no código frontend antigo.
-- Aguarde o resultado do script `audit.sql` para criar uma baseline real.

CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_de_usuario TEXT NOT NULL UNIQUE,
    caminho TEXT CHECK (caminho IN ('jogador', 'tecnico', 'presidente', '')),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints Reais no Banco
    CONSTRAINT fk_jogadores_user FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_jogador UNIQUE (user_id),
    CONSTRAINT ck_jogadores_idade CHECK (idade >= 15 AND idade <= 45),
    CONSTRAINT ck_jogadores_altura CHECK (altura >= 1.40 AND altura <= 2.30),
    CONSTRAINT ck_jogadores_peso CHECK (peso >= 40 AND peso <= 150),
    CONSTRAINT ck_jogadores_posicao CHECK (posicao IN ('Atacante', 'Meia', 'Zagueiro', 'Goleiro')),
    CONSTRAINT ck_jogadores_arquetipo CHECK (arquetipo IN ('Driblador', 'Finalizador', 'Criador', 'Raçudo')),
    CONSTRAINT ck_jogadores_pe CHECK (pe_dominante IN ('Direito', 'Esquerdo', 'Ambidestro'))
);

-- Fim da baseline teórica
