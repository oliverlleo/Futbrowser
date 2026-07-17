-- SEGURANÇA, RLS E RPC

-- 1. Ativação do RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogadores ENABLE ROW LEVEL SECURITY;

-- 2. Revogar acessos diretos não seguros
REVOKE ALL ON public.usuarios FROM PUBLIC;
REVOKE ALL ON public.usuarios FROM anon;
REVOKE ALL ON public.jogadores FROM PUBLIC;
REVOKE ALL ON public.jogadores FROM anon;

-- Conceder SELECT para authenticated (cada um vê o seu ou de outros de forma limitada)
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.jogadores TO authenticated;

-- Para UPDATE e INSERT, o frontend usará RPCs ou UPDATE limitado no RLS
GRANT UPDATE ON public.usuarios TO authenticated;
-- Não damos permissão direta de INSERT em jogadores para evitar manipulação de atributos
-- Usuário só pode dar UPDATE em jogadores criados, e apenas colunas não restritas.
GRANT UPDATE (avatar, apelido) ON public.jogadores TO authenticated;

-- 3. Políticas RLS
-- Usuarios
CREATE POLICY "Usuarios podem ver todos os perfis" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Usuario pode atualizar apenas seu proprio caminho" ON public.usuarios 
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Jogadores
CREATE POLICY "Jogadores sao visiveis para todos" ON public.jogadores FOR SELECT USING (true);
CREATE POLICY "Usuario atualiza seu proprio jogador (campos permitidos)" ON public.jogadores 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_jogadores_user_id ON public.jogadores(user_id);

-- 4. Constraints
ALTER TABLE public.jogadores ADD CONSTRAINT unique_user_jogador UNIQUE (user_id);

-- 5. RPC create_player
CREATE OR REPLACE FUNCTION public.create_player(
    p_nome TEXT,
    p_apelido TEXT,
    p_idade INT,
    p_naturalidade TEXT,
    p_nacionalidade TEXT,
    p_pe_dominante TEXT,
    p_altura NUMERIC,
    p_peso INT,
    p_posicao TEXT,
    p_arquetipo TEXT,
    p_avatar TEXT
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_atributos_base JSONB;
    v_modificadores JSONB;
    v_atributos_finais JSONB;
    v_jogador_id UUID;
BEGIN
    -- Validar autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    -- Garantir que o usuário não possui jogador ainda
    IF EXISTS (SELECT 1 FROM public.jogadores WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'Usuário já possui um jogador';
    END IF;

    -- O cálculo real dos atributos deve ocorrer aqui ou usar a lógica interna existente
    -- Simulação de atributos com base na posicao/arquetipo
    -- Aqui, integramos com a possível função 'calculate_player_attributes' que já existia no banco
    -- Ou implementamos a lógica final.
    v_atributos_finais := '{"Finalização": 60, "Físico": 50, "Passe": 50, "Marcação": 30, "Velocidade": 60, "Visão de jogo": 50}'::JSONB;

    INSERT INTO public.jogadores (
        user_id, avatar, nome, apelido, idade, naturalidade, nacionalidade, 
        pe_dominante, altura, peso, posicao, arquetipo, 
        atributos_base, modificadores_corpo, atributos
    ) VALUES (
        v_user_id, p_avatar, p_nome, p_apelido, p_idade, p_naturalidade, p_nacionalidade,
        p_pe_dominante, p_altura, p_peso, p_posicao, p_arquetipo,
        '{}'::JSONB, '{}'::JSONB, v_atributos_finais
    ) RETURNING id INTO v_jogador_id;

    -- Atualizar o caminho do usuário
    UPDATE public.usuarios SET caminho = 'jogador' WHERE id = v_user_id;

    RETURN v_jogador_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Garantir que apenas usuários autenticados chamam a função
REVOKE EXECUTE ON FUNCTION public.create_player FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_player FROM anon;
GRANT EXECUTE ON FUNCTION public.create_player TO authenticated;
