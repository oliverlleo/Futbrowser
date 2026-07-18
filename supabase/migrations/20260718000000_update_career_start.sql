-- Remove a função antiga que recebia a idade
DROP FUNCTION IF EXISTS public.create_player(text, text, integer, text, text, text, text, text, text, text, text);

-- Cria a nova função sem o parâmetro p_idade
CREATE OR REPLACE FUNCTION public.create_player(
    p_nome TEXT,
    p_apelido TEXT,
    p_naturalidade TEXT,
    p_nacionalidade TEXT,
    p_pe_dominante TEXT,
    p_altura TEXT,
    p_peso TEXT,
    p_posicao TEXT,
    p_arquetipo TEXT,
    p_avatar TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_jogador_id UUID;
    v_lock_key BIGINT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Cria uma chave determinística baseada no UUID
    v_lock_key := ('x' || substr(md5(v_user_id::text), 1, 16))::bit(64)::bigint;

    -- Tenta adquirir o lock exclusivo para este usuário.
    PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);

    -- Verifica se o usuário já tem um jogador (agora seguro devido ao lock)
    IF EXISTS (
        SELECT 1 FROM public.jogadores WHERE user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Usuário já possui um jogador cadastrado.';
    END IF;

    -- Validações básicas
    IF p_nome IS NULL OR char_length(trim(p_nome)) < 3 THEN
        RAISE EXCEPTION 'Nome do jogador inválido.';
    END IF;
    IF char_length(p_nome) > 100 THEN
        RAISE EXCEPTION 'Nome muito longo.';
    END IF;

    IF p_posicao NOT IN ('Atacante', 'Meia', 'Zagueiro', 'Goleiro') THEN
        RAISE EXCEPTION 'Posição inválida.';
    END IF;

    IF p_arquetipo NOT IN ('Finalizador', 'Driblador', 'Criador', 'Raçudo') THEN
        RAISE EXCEPTION 'Arquétipo inválido.';
    END IF;

    IF p_pe_dominante NOT IN ('Esquerdo', 'Direito', 'Ambidestro') THEN
        RAISE EXCEPTION 'Pé dominante inválido.';
    END IF;

    IF p_altura IS NULL OR trim(p_altura) = '' THEN
        RAISE EXCEPTION 'Altura inválida.';
    END IF;

    IF p_peso IS NULL OR trim(p_peso) = '' THEN
        RAISE EXCEPTION 'Peso inválido.';
    END IF;

    -- Inserir o jogador na tabela. 
    -- Idade agora é fixa: 16
    INSERT INTO public.jogadores (
        user_id,
        avatar,
        nome,
        apelido,
        idade,
        naturalidade,
        nacionalidade,
        pe_dominante,
        altura,
        peso,
        posicao,
        arquetipo
    ) VALUES (
        v_user_id,
        p_avatar,
        trim(p_nome),
        trim(p_apelido),
        16,
        p_naturalidade,
        p_nacionalidade,
        p_pe_dominante,
        p_altura,
        p_peso,
        p_posicao,
        p_arquetipo
    ) RETURNING id INTO v_jogador_id;

    RETURN v_jogador_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_player(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_player(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
