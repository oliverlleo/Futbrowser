-- ==========================================
-- SEGURANÇA, RLS E RPC
-- ==========================================

-- 1. Ativação do RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogadores ENABLE ROW LEVEL SECURITY;

-- 2. Revogar acessos diretos não seguros
REVOKE ALL ON public.usuarios FROM PUBLIC;
REVOKE ALL ON public.usuarios FROM anon;
REVOKE ALL ON public.jogadores FROM PUBLIC;
REVOKE ALL ON public.jogadores FROM anon;

-- Conceder SELECT e UPDATE apenas para authenticated nas colunas permitidas
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.jogadores TO authenticated;

-- Usuários só podem atualizar seu próprio caminho
GRANT UPDATE (caminho) ON public.usuarios TO authenticated;

-- 3. Políticas RLS - Isolamento estrito (Visualiza apenas o próprio perfil)
DROP POLICY IF EXISTS "Usuarios podem ver todos os perfis" ON public.usuarios;
CREATE POLICY "Usuario ve apenas seu proprio perfil" ON public.usuarios 
FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Usuario pode atualizar apenas seu proprio caminho" ON public.usuarios 
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Jogadores sao visiveis para todos" ON public.jogadores;
CREATE POLICY "Usuario ve apenas seu proprio jogador" ON public.jogadores 
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- IMPORTANTE: Não há GRANT UPDATE, INSERT ou DELETE em jogadores para o user comum.
-- Toda alteração de jogador deverá ser feita via RPC específica.

-- 4. Função RPC create_player segura
-- Usa SECURITY DEFINER para que a função tenha permissão de INSERT na tabela jogadores,
-- já que o usuário final (authenticated) NÃO TEM permissão direta de INSERT.
-- O proprietário (postgres) definidor da função concede o acesso internamente.
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
    v_atributos_finais JSONB;
    v_jogador_id UUID;
BEGIN
    -- 1. Identificar o proprietário de forma inviolável
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso Negado: Usuário não autenticado.';
    END IF;

    -- 2. Impedir jogador duplicado
    IF EXISTS (SELECT 1 FROM public.jogadores WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'Acesso Negado: Você já possui um jogador criado.';
    END IF;

    -- 3. Validação de Parâmetros (Limites e Segurança)
    IF length(trim(p_nome)) < 3 THEN
        RAISE EXCEPTION 'Validação Falhou: O nome deve ter no mínimo 3 caracteres.';
    END IF;
    IF p_idade < 15 OR p_idade > 45 THEN
        RAISE EXCEPTION 'Validação Falhou: Idade inválida (15-45).';
    END IF;
    IF p_altura < 1.40 OR p_altura > 2.30 THEN
        RAISE EXCEPTION 'Validação Falhou: Altura inválida (1.40-2.30m).';
    END IF;
    IF p_peso < 40 OR p_peso > 150 THEN
        RAISE EXCEPTION 'Validação Falhou: Peso inválido (40-150kg).';
    END IF;
    IF p_posicao NOT IN ('Atacante', 'Meia', 'Zagueiro', 'Goleiro') THEN
        RAISE EXCEPTION 'Validação Falhou: Posição inválida.';
    END IF;
    IF p_arquetipo NOT IN ('Driblador', 'Finalizador', 'Criador', 'Raçudo') THEN
        RAISE EXCEPTION 'Validação Falhou: Arquétipo inválido.';
    END IF;

    -- 4. Normalizar dados e calcular atributos
    -- Cálculo interno simplificado. Futuramente chamar public.calculate_player_attributes.
    v_atributos_finais := '{"Finalização": 50, "Físico": 50, "Passe": 50}'::JSONB;

    -- 5. Transação atômica de criação
    INSERT INTO public.jogadores (
        user_id, avatar, nome, apelido, idade, naturalidade, nacionalidade, 
        pe_dominante, altura, peso, posicao, arquetipo, 
        atributos_base, modificadores_corpo, atributos
    ) VALUES (
        v_user_id, trim(p_avatar), trim(p_nome), trim(p_apelido), p_idade, 
        trim(p_naturalidade), trim(p_nacionalidade), p_pe_dominante, 
        p_altura, p_peso, p_posicao, p_arquetipo,
        '{}'::JSONB, '{}'::JSONB, v_atributos_finais
    ) RETURNING id INTO v_jogador_id;

    -- 6. Atualizar o caminho do usuário
    UPDATE public.usuarios SET caminho = 'jogador' WHERE id = v_user_id;

    -- 7. Não retornar a linha inteira para não vazar nada além do ID
    RETURN v_jogador_id;
END;
$$ LANGUAGE plpgsql 
-- O search_path restrito garante que não há spoofing de schemas (ex: pg_temp)
SECURITY DEFINER SET search_path = public, pg_temp;

-- Revogar permissões explícitas da RPC e conceder a authenticated
REVOKE EXECUTE ON FUNCTION public.create_player(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_player(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, INT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_player(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, INT, TEXT, TEXT, TEXT) TO authenticated;
