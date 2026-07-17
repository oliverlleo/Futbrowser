-- ==========================================
-- SEGURANÇA, RLS E RPC
-- ==========================================

-- 1. Ativação do RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogadores ENABLE ROW LEVEL SECURITY;

-- 2. Revogar privilégios preexistentes e não seguros
REVOKE ALL ON TABLE public.usuarios FROM PUBLIC;
REVOKE ALL ON TABLE public.usuarios FROM anon;
REVOKE ALL ON TABLE public.usuarios FROM authenticated;

REVOKE ALL ON TABLE public.jogadores FROM PUBLIC;
REVOKE ALL ON TABLE public.jogadores FROM anon;
REVOKE ALL ON TABLE public.jogadores FROM authenticated;

-- 3. Conceder apenas os acessos estritamente necessários
GRANT SELECT ON TABLE public.usuarios TO authenticated;
GRANT UPDATE (caminho) ON TABLE public.usuarios TO authenticated;

GRANT SELECT ON TABLE public.jogadores TO authenticated;
-- UPDATE em jogadores revogado/retirado para authenticated. Só via RPC.

-- 4. Políticas RLS - Isolamento estrito
DROP POLICY IF EXISTS "Usuarios podem ver todos os perfis" ON public.usuarios;
CREATE POLICY "Usuario ve apenas seu proprio perfil" ON public.usuarios 
FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Usuario pode atualizar apenas seu proprio caminho" ON public.usuarios 
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Jogadores sao visiveis para todos" ON public.jogadores;
CREATE POLICY "Usuario ve apenas seu proprio jogador" ON public.jogadores 
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 5. Função RPC create_player totalmente qualificada e com search_path vazio
CREATE OR REPLACE FUNCTION public.create_player(
    p_nome pg_catalog.text,
    p_apelido pg_catalog.text,
    p_idade pg_catalog.int4,
    p_naturalidade pg_catalog.text,
    p_nacionalidade pg_catalog.text,
    p_pe_dominante pg_catalog.text,
    p_altura pg_catalog.numeric,
    p_peso pg_catalog.int4,
    p_posicao pg_catalog.text,
    p_arquetipo pg_catalog.text,
    p_avatar pg_catalog.text
) RETURNS pg_catalog.uuid AS $$
DECLARE
    v_user_id pg_catalog.uuid;
    v_atributos_finais pg_catalog.jsonb;
    v_jogador_id pg_catalog.uuid;
BEGIN
    -- Identificar o proprietário de forma inviolável via token
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso Negado: Usuário não autenticado.';
    END IF;

    -- Impedir jogador duplicado referenciando public.jogadores
    IF EXISTS (SELECT 1 FROM public.jogadores WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'Acesso Negado: Você já possui um jogador criado.';
    END IF;

    -- Validação de Parâmetros
    IF pg_catalog.length(pg_catalog.trim(p_nome)) < 3 THEN
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

    -- Normalizar dados e calcular atributos
    v_atributos_finais := '{"Finalização": 50, "Físico": 50, "Passe": 50}'::pg_catalog.jsonb;

    -- Transação atômica
    INSERT INTO public.jogadores (
        user_id, avatar, nome, apelido, idade, naturalidade, nacionalidade, 
        pe_dominante, altura, peso, posicao, arquetipo, 
        atributos_base, modificadores_corpo, atributos
    ) VALUES (
        v_user_id, pg_catalog.trim(p_avatar), pg_catalog.trim(p_nome), pg_catalog.trim(p_apelido), p_idade, 
        pg_catalog.trim(p_naturalidade), pg_catalog.trim(p_nacionalidade), p_pe_dominante, 
        p_altura, p_peso, p_posicao, p_arquetipo,
        '{}'::pg_catalog.jsonb, '{}'::pg_catalog.jsonb, v_atributos_finais
    ) RETURNING id INTO v_jogador_id;

    -- Atualizar o caminho do usuário
    UPDATE public.usuarios SET caminho = 'jogador' WHERE id = v_user_id;

    RETURN v_jogador_id;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '';

-- Revogar permissões e conceder apenas a authenticated
REVOKE EXECUTE ON FUNCTION public.create_player(pg_catalog.text, pg_catalog.text, pg_catalog.int4, pg_catalog.text, pg_catalog.text, pg_catalog.text, pg_catalog.numeric, pg_catalog.int4, pg_catalog.text, pg_catalog.text, pg_catalog.text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_player(pg_catalog.text, pg_catalog.text, pg_catalog.int4, pg_catalog.text, pg_catalog.text, pg_catalog.text, pg_catalog.numeric, pg_catalog.int4, pg_catalog.text, pg_catalog.text, pg_catalog.text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_player(pg_catalog.text, pg_catalog.text, pg_catalog.int4, pg_catalog.text, pg_catalog.text, pg_catalog.text, pg_catalog.numeric, pg_catalog.int4, pg_catalog.text, pg_catalog.text, pg_catalog.text) TO authenticated;
