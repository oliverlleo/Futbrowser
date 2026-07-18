-- Preparação
BEGIN;

-- Vamos criar um usuário fake temporário para testar
DO $$
DECLARE
    v_user_a UUID := gen_random_uuid();
    v_user_b UUID := gen_random_uuid();
    v_player_a UUID;
BEGIN
    -- Testa chamada da prévia como authenticated
    SET LOCAL ROLE authenticated;
    PERFORM public.calculate_player_attributes('Atacante', 'Finalizador', '1.80', '80');

    -- Tenta executar RPC create_player sem uid (vai falhar e ser capturado, mas aqui vamos simular o uid)
    -- Simulando User A
    EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_a::text);

    -- 1. Inserção direta bloqueada
    BEGIN
        INSERT INTO public.jogadores (user_id, nome, posicao, arquetipo) VALUES (v_user_a, 'Teste', 'Atacante', 'Criador');
        RAISE EXCEPTION 'FALHA: Inserção direta deveria ser bloqueada.';
    EXCEPTION WHEN insufficient_privilege THEN
        -- Esperado
    END;

    -- 2. Criação Válida
    v_player_a := public.create_player('Player A', 'PA', 20, 'BR', 'BR', 'Direito', '1.80', '80', 'Atacante', 'Finalizador', 'avatar1.webp');

    -- 3. Trigger calculou atributos
    IF NOT EXISTS (SELECT 1 FROM public.jogadores WHERE id = v_player_a AND atributos IS NOT NULL) THEN
        RAISE EXCEPTION 'FALHA: Trigger não calculou atributos.';
    END IF;

    -- 4. Tentativa de segunda criação
    BEGIN
        PERFORM public.create_player('Player A2', 'PA', 20, 'BR', 'BR', 'Direito', '1.80', '80', 'Atacante', 'Finalizador', 'avatar1.webp');
        RAISE EXCEPTION 'FALHA: Segunda criação deveria falhar.';
    EXCEPTION WHEN raise_exception THEN
        -- Esperado: Usuário já possui um jogador cadastrado.
    END;

    -- 5. Atualização direta bloqueada
    BEGIN
        UPDATE public.jogadores SET altura = '2.00' WHERE id = v_player_a;
        RAISE EXCEPTION 'FALHA: Atualização direta deveria ser bloqueada.';
    EXCEPTION WHEN insufficient_privilege THEN
        -- Esperado
    END;

    -- 6. Exclusão direta bloqueada
    BEGIN
        DELETE FROM public.jogadores WHERE id = v_player_a;
        RAISE EXCEPTION 'FALHA: Exclusão direta deveria ser bloqueada.';
    EXCEPTION WHEN insufficient_privilege THEN
        -- Esperado
    END;

    -- 7. Leitura do próprio jogador
    IF NOT EXISTS (SELECT 1 FROM public.jogadores WHERE id = v_player_a) THEN
        RAISE EXCEPTION 'FALHA: Não consegue ler próprio jogador.';
    END IF;

    -- Simulando User B
    EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_b::text);

    -- 8. Bloqueio de leitura de outro usuário
    IF EXISTS (SELECT 1 FROM public.jogadores WHERE id = v_player_a) THEN
        RAISE EXCEPTION 'FALHA: Consegue ler jogador de outro usuário.';
    END IF;

    RAISE NOTICE 'TODOS OS TESTES DE SEGURANÇA PASSARAM COM SUCESSO!';
END $$;

ROLLBACK;
