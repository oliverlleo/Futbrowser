-- Testes de Auditoria (Migration 09)
BEGIN;

DO $$
DECLARE
    v_user_id UUID;
    v_player_id UUID;
    v_user_id_2 UUID;
    v_player_id_2 UUID;
    
    v_offer_id UUID;
    v_details JSONB;
    v_contract_count INT;
    v_career_count INT;
    v_offer_count_1 INT;
    v_offer_count_2 INT;
BEGIN
    SELECT id INTO v_user_id FROM auth.users ORDER BY id ASC LIMIT 1;
    SELECT id INTO v_user_id_2 FROM auth.users ORDER BY id DESC LIMIT 1;

    IF v_user_id IS NULL OR v_user_id_2 IS NULL THEN 
        RAISE EXCEPTION 'Usuários insuficientes para testes.';
    END IF;

    -- Limpar tudo do usuário 1
    DELETE FROM public.player_contracts WHERE player_id IN (SELECT id FROM public.jogadores WHERE user_id = v_user_id);
    DELETE FROM public.player_career_state WHERE player_id IN (SELECT id FROM public.jogadores WHERE user_id = v_user_id);
    DELETE FROM public.player_offers WHERE player_id IN (SELECT id FROM public.jogadores WHERE user_id = v_user_id);
    DELETE FROM public.jogadores WHERE user_id = v_user_id;

    -- Limpar tudo do usuário 2
    DELETE FROM public.player_contracts WHERE player_id IN (SELECT id FROM public.jogadores WHERE user_id = v_user_id_2);
    DELETE FROM public.player_career_state WHERE player_id IN (SELECT id FROM public.jogadores WHERE user_id = v_user_id_2);
    DELETE FROM public.player_offers WHERE player_id IN (SELECT id FROM public.jogadores WHERE user_id = v_user_id_2);
    DELETE FROM public.jogadores WHERE user_id = v_user_id_2;

    -- Criar Jogador 1 (como admin)
    INSERT INTO public.jogadores (user_id, nome, posicao, arquetipo, atributos) 
    VALUES (v_user_id, 'Teste 1', 'Atacante', 'Finalizador', '{"Físico":50,"Marcação":50,"Finalização":50,"Velocidade":50,"Passe":50,"Visão de jogo":50}')
    RETURNING id INTO v_player_id;

    -- Configuração do Jogador 1
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_user_id), true);
    PERFORM set_config('role', 'authenticated', true);

    -- Gerar ofertas iniciais
    PERFORM public.generate_initial_offers();
    
    -- Idempotência: rodar de novo não pode duplicar ofertas
    SELECT COUNT(*) INTO v_offer_count_1 FROM public.player_offers WHERE player_id = v_player_id;
    PERFORM public.generate_initial_offers();
    SELECT COUNT(*) INTO v_offer_count_2 FROM public.player_offers WHERE player_id = v_player_id;
    
    IF v_offer_count_1 <> v_offer_count_2 THEN
        RAISE EXCEPTION 'Erro de Idempotência: As ofertas foram duplicadas ou recriadas.';
    END IF;

    SELECT id INTO v_offer_id FROM public.player_offers WHERE player_id = v_player_id LIMIT 1;

    -- Executar get_offer_details sem erros
    v_details := public.get_offer_details(v_offer_id);
    
    IF jsonb_array_length(v_details->'squad') = 0 THEN
        RAISE EXCEPTION 'Erro: O elenco está vazio.';
    END IF;
    
    IF jsonb_array_length(v_details->'competitors') = 0 THEN
        RAISE EXCEPTION 'Erro: A concorrência está vazia.';
    END IF;
    
    IF (v_details->'snapshot'->>'club_ovr') IS NULL THEN
        RAISE EXCEPTION 'Erro: club_ovr não presente no snapshot.';
    END IF;
    
    IF (v_details->'snapshot'->>'club_ovr')::INT = 0 THEN
        RAISE EXCEPTION 'Erro: club_ovr é 0 (possivelmente nulo).';
    END IF;

    -- Verificando os pesos matemáticos no snapshot
    IF NOT (v_details->'compatibility_breakdown' ? 'total') OR 
       NOT (v_details->'compatibility_breakdown' ? 'competition_score') OR
       NOT (v_details->'compatibility_breakdown' ? 'position_score') OR
       NOT (v_details->'compatibility_breakdown' ? 'archetype_score') OR
       NOT (v_details->'compatibility_breakdown' ? 'coach_score') OR
       NOT (v_details->'compatibility_breakdown' ? 'style_score') THEN
       RAISE EXCEPTION 'Erro: O cálculo de compatibilidade não contém todos os scores.';
    END IF;

    -- Testar bloqueio de acesso à oferta de outro usuário
    PERFORM set_config('role', 'postgres', true);
    INSERT INTO public.jogadores (user_id, nome, posicao, arquetipo, atributos) 
    VALUES (v_user_id_2, 'Teste 2', 'Atacante', 'Finalizador', '{"Físico":50,"Marcação":50,"Finalização":50,"Velocidade":50,"Passe":50,"Visão de jogo":50}')
    RETURNING id INTO v_player_id_2;
    
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_user_id_2), true);
    PERFORM set_config('role', 'authenticated', true);
    
    BEGIN
        PERFORM public.negotiate_offer(v_offer_id, jsonb_build_object(
            'monthly_wage', 1000, 'duration_seasons', 2, 'release_clause', 100000, 'squad_role', 'Reserva', 'signing_bonus', 4000
        ));
        RAISE EXCEPTION 'Erro Crítico: Conseguiu negociar a oferta de outro usuário.';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Acesso negado%' THEN
            RAISE EXCEPTION 'Erro ao testar acesso negado: %', SQLERRM;
        END IF;
    END;

    -- Voltar para o Usuário 1
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_user_id), true);

    -- Assinar o contrato
    PERFORM public.accept_offer(v_offer_id);
    
    SELECT COUNT(*) INTO v_contract_count FROM public.player_contracts WHERE player_id = v_player_id;
    IF v_contract_count = 0 THEN
        RAISE EXCEPTION 'Erro: Contrato não foi criado.';
    END IF;
    
    SELECT COUNT(*) INTO v_career_count FROM public.player_career_state WHERE player_id = v_player_id;
    IF v_career_count = 0 THEN
        RAISE EXCEPTION 'Erro: Career state não foi criado.';
    END IF;
    
    RAISE NOTICE 'Todos os testes da Auditoria (Migration 09) passaram com sucesso.';
END $$;
ROLLBACK;
