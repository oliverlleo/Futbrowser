-- Migration: 20260718000003_career_start_step2_rpcs_part1.sql
-- RPCs: get_career_onboarding_state e generate_initial_offers

-- ==============================================================================
-- 1. get_career_onboarding_state
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_career_onboarding_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_player_count INT;
    v_player_id UUID;
    
    v_has_player BOOLEAN := false;
    v_offers_generated BOOLEAN := false;
    v_active_offers INT := 0;
    v_contract_signed BOOLEAN := false;
    v_onboarding_completed BOOLEAN := false;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    -- Tratamento de duplicidade legado (Usuário 3cd...)
    SELECT count(*) INTO v_player_count FROM public.jogadores WHERE user_id = v_user_id;
    
    IF v_player_count > 1 THEN
        RAISE EXCEPTION 'Duplicidade legada: Este usuário possui mais de um jogador ativo.';
    ELSIF v_player_count = 1 THEN
        v_has_player := true;
        SELECT id INTO v_player_id FROM public.jogadores WHERE user_id = v_user_id;
    END IF;

    IF v_has_player THEN
        -- Verifica se já há propostas geradas (qualquer status)
        SELECT EXISTS (SELECT 1 FROM public.player_offers WHERE player_id = v_player_id) INTO v_offers_generated;
        
        -- Conta propostas ativas (new, reviewed, negotiating, countered)
        SELECT count(*) INTO v_active_offers FROM public.player_offers 
        WHERE player_id = v_player_id AND status IN ('new', 'reviewed', 'negotiating', 'countered');
        
        -- Verifica contrato e onboarding
        SELECT EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_player_id AND status = 'active') INTO v_contract_signed;
        SELECT onboarding_completed INTO v_onboarding_completed FROM public.player_career_state WHERE player_id = v_player_id;
        IF v_onboarding_completed IS NULL THEN v_onboarding_completed := false; END IF;
    END IF;

    RETURN jsonb_build_object(
        'has_player', v_has_player,
        'offers_generated', v_offers_generated,
        'active_offers', v_active_offers,
        'contract_signed', v_contract_signed,
        'onboarding_completed', v_onboarding_completed
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_career_onboarding_state() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_career_onboarding_state() TO authenticated;

-- ==============================================================================
-- 2. generate_initial_offers
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.generate_initial_offers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_player_id UUID;
    v_player_age INT;
    v_player_pos VARCHAR;
    v_player_arq VARCHAR;
    v_has_contract BOOLEAN;
    v_has_offers BOOLEAN;
    v_club RECORD;
    v_comp_score INT;
    v_pos_score INT;
    v_style_score INT;
    v_arq_score INT;
    v_ovr_score INT;
    v_coach_score INT;
    v_snapshot JSONB;
    v_comp_breakdown JSONB;
    v_player_ovr INT := 50; -- Arbitrário base para start 16 anos. (será calc real futuramente)
    v_internal_tolerance INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    -- Pega o player garantindo que só há 1
    SELECT id, idade, posicao, arquetipo INTO v_player_id, v_player_age, v_player_pos, v_player_arq 
    FROM public.jogadores WHERE user_id = v_user_id;

    IF v_player_id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
    IF v_player_age != 16 THEN RAISE EXCEPTION 'Jogador não tem 16 anos'; END IF;

    -- Verifica contratos ativos ou ofertas já geradas
    SELECT EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_player_id AND status = 'active') INTO v_has_contract;
    IF v_has_contract THEN RAISE EXCEPTION 'Jogador já possui contrato'; END IF;

    SELECT EXISTS (SELECT 1 FROM public.player_offers WHERE player_id = v_player_id) INTO v_has_offers;
    IF v_has_offers THEN 
        -- Idempotente: se já tem, apenas retorna as ofertas atuais.
        RETURN (SELECT jsonb_agg(jsonb_build_object('id', id, 'club_id', club_id, 'status', status)) FROM public.player_offers WHERE player_id = v_player_id AND status NOT IN ('expired', 'rejected', 'withdrawn', 'accepted'));
    END IF;

    -- Gera ofertas para os 5 clubes
    FOR v_club IN SELECT c.*, co.profile as coach_profile, a.physical, a.speed, a.technical, a.recovery, a.tactical 
                  FROM public.base_clubs c 
                  JOIN public.base_coaches co ON c.coach_id = co.id 
                  JOIN public.base_academy_profiles a ON c.id = a.club_id
                  WHERE c.is_active = true
    LOOP
        -- Cálculo de compatibilidade (Mock refinado usando regras)
        -- 30% Necessidade Posição (Simulada baseada se o time usa ou não a pos)
        v_pos_score := 70; -- placeholder base
        -- 25% Estilo
        v_style_score := 50; 
        IF v_club.play_style = 'Ofensivo' AND v_player_arq IN ('Finalizador', 'Driblador') THEN v_style_score := 90; END IF;
        IF v_club.play_style = 'Recuado' AND v_player_arq IN ('Raçudo') THEN v_style_score := 90; END IF;
        -- 20% Arquetipo
        v_arq_score := 60;
        -- 15% OVR (Se o OVR do jogador for mt menor q a rep do time)
        v_ovr_score := 100 - (v_club.reputation * 10);
        -- 10% Treinador
        v_coach_score := 50;
        
        v_comp_score := (v_pos_score * 0.30) + (v_style_score * 0.25) + (v_arq_score * 0.20) + (v_ovr_score * 0.15) + (v_coach_score * 0.10);
        
        v_comp_breakdown := jsonb_build_object(
            'position_need_score', v_pos_score,
            'play_style_score', v_style_score,
            'archetype_score', v_arq_score,
            'competition_score', v_ovr_score,
            'coach_score', v_coach_score,
            'compatibility_total', v_comp_score
        );

        v_snapshot := jsonb_build_object(
            'club_reputation', v_club.reputation,
            'coach_profile', v_club.coach_profile,
            'academy', jsonb_build_object('physical', v_club.physical, 'speed', v_club.speed, 'technical', v_club.technical, 'recovery', v_club.recovery, 'tactical', v_club.tactical)
        );

        -- Tolerância interna varia de 10 a 50 (depende da compatibilidade e rep)
        v_internal_tolerance := (v_comp_score / 2) + v_club.flexibility;

        INSERT INTO public.player_offers (
            player_id, club_id, initial_terms, current_terms, status, internal_tolerance, compatibility_breakdown, snapshot_data
        ) VALUES (
            v_player_id, v_club.id, v_club.base_terms, v_club.base_terms, 'new', v_internal_tolerance, v_comp_breakdown, v_snapshot
        );
    END LOOP;

    RETURN (SELECT jsonb_agg(jsonb_build_object('id', id, 'club_id', club_id, 'status', status)) FROM public.player_offers WHERE player_id = v_player_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_initial_offers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_initial_offers() TO authenticated;
