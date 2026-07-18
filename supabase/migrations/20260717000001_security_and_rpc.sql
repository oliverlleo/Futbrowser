-- 1. Remover TODAS as políticas de jogadores
DROP POLICY IF EXISTS "Usuários podem criar seus próprios jogadores" ON public.jogadores;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios jogadores" ON public.jogadores;
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios jogadores" ON public.jogadores;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios jogadores" ON public.jogadores;

-- 2. Recriar apenas a de LEITURA
CREATE POLICY "Usuários podem ver seus próprios jogadores" 
    ON public.jogadores FOR SELECT 
    USING (auth.uid() = user_id);

-- 3. Revogar privilégios para forçar RPC
REVOKE INSERT, UPDATE, DELETE ON TABLE public.jogadores FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.jogadores FROM anon;
GRANT SELECT ON TABLE public.jogadores TO authenticated;

-- 4. Modificar o trigger e sua função para rodar sempre no INSERT, mas apenas em alterações específicas no UPDATE
CREATE OR REPLACE FUNCTION public.secure_player_attributes()
RETURNS TRIGGER AS $$
DECLARE
    v_calc JSONB;
BEGIN
    -- Calcula os atributos com base nos dados seguros
    v_calc := public.calculate_player_attributes(NEW.posicao, NEW.arquetipo, NEW.altura, NEW.peso);
    
    -- Força a sobrescrita dos atributos com os valores calculados no backend
    NEW.atributos_base := v_calc->'base';
    NEW.modificadores_corpo := v_calc->'modifiers';
    NEW.atributos := v_calc->'final';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

DROP TRIGGER IF EXISTS ensure_secure_attributes ON public.jogadores;
CREATE TRIGGER ensure_secure_attributes
BEFORE INSERT OR UPDATE OF posicao, arquetipo, altura, peso 
ON public.jogadores
FOR EACH ROW
EXECUTE FUNCTION public.secure_player_attributes();

-- 5. Função RPC `create_player` blindada com Advisory Lock
CREATE OR REPLACE FUNCTION public.create_player(
    p_nome TEXT,
    p_apelido TEXT,
    p_idade INT,
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
    -- Se outro processo estiver criando para o mesmo usuário, ele vai bloquear e esperar.
    PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);

    -- Verifica se o usuário já tem um jogador (agora seguro devido ao lock)
    IF EXISTS (
        SELECT 1 FROM public.jogadores WHERE user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Usuário já possui um jogador cadastrado.';
    END IF;

    -- Validações básicas (nomes, posições)
    IF p_nome IS NULL OR char_length(trim(p_nome)) < 3 THEN
        RAISE EXCEPTION 'Nome do jogador inválido.';
    END IF;
    IF char_length(p_nome) > 100 THEN
        RAISE EXCEPTION 'Nome muito longo.';
    END IF;

    IF p_idade < 15 OR p_idade > 50 THEN
        RAISE EXCEPTION 'Idade inválida.';
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
    -- O trigger `ensure_secure_attributes` cuidará dos atributos!
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
        p_idade,
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

-- Restringe a execução do create_player e calculate_player_attributes apenas para authenticated
REVOKE EXECUTE ON FUNCTION public.create_player FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_player TO authenticated;

REVOKE EXECUTE ON FUNCTION public.calculate_player_attributes FROM public, anon;
GRANT EXECUTE ON FUNCTION public.calculate_player_attributes TO authenticated;
