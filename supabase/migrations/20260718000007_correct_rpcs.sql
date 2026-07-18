-- Migration: 20260718000007_correct_rpcs.sql

-- ==============================================================================
-- 1. calculate_player_ovr
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.calculate_player_ovr(p_atributos JSONB)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_total INT := 0;
BEGIN
    v_total := (p_atributos->>'Físico')::INT 
             + (p_atributos->>'Marcação')::INT 
             + (p_atributos->>'Finalização')::INT 
             + (p_atributos->>'Velocidade')::INT 
             + (p_atributos->>'Passe')::INT 
             + (p_atributos->>'Visão de jogo')::INT;
    
    RETURN v_total / 6;
END;
$$;

-- ==============================================================================
-- 2. generate_initial_offers (CORREÇÃO)
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
    v_player_attrs JSONB;
    v_player_ovr INT;
    v_has_contract BOOLEAN;
    v_has_offers BOOLEAN;
    
    v_club RECORD;
    v_coach RECORD;
    
    v_squad_total INT;
    v_squad_pos_count INT;
    v_squad_titulares_count INT;
    v_lowest_starter_ovr INT;
    v_best_sub_ovr INT;
    
    v_club_ovr INT;
    v_comp_score INT;
    v_pos_score INT;
    v_style_score INT;
    v_arq_score INT;
    v_ovr_score INT;
    v_coach_score INT;
    v_snapshot JSONB;
    v_comp_breakdown JSONB;
    v_internal_tolerance INT;
    
    -- Vagas ideais por formação (placeholder simplificado; idealmente buscaríamos num jsonb ou struct)
    v_ideal_slots INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT id, idade, posicao, arquetipo, atributos INTO v_player_id, v_player_age, v_player_pos, v_player_arq, v_player_attrs
    FROM public.jogadores WHERE user_id = v_user_id;

    IF v_player_id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
    
    -- Calculando o OVR real do jogador
    v_player_ovr := public.calculate_player_ovr(v_player_attrs);

    SELECT EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_player_id AND status = 'active') INTO v_has_contract;
    IF v_has_contract THEN RAISE EXCEPTION 'Jogador já possui contrato'; END IF;

    SELECT EXISTS (SELECT 1 FROM public.player_offers WHERE player_id = v_player_id) INTO v_has_offers;
    IF v_has_offers THEN 
        RETURN (SELECT jsonb_agg(jsonb_build_object('id', id, 'club_id', club_id, 'status', status)) FROM public.player_offers WHERE player_id = v_player_id AND status NOT IN ('expired', 'rejected', 'withdrawn', 'accepted'));
    END IF;

    FOR v_club IN SELECT c.*, a.physical, a.speed, a.technical, a.recovery, a.tactical 
                  FROM public.base_clubs c 
                  JOIN public.base_academy_profiles a ON c.id = a.club_id
                  WHERE c.is_active = true
    LOOP
        SELECT * INTO v_coach FROM public.base_coaches WHERE id = v_club.coach_id;
        
        -- Conta jogadores totais no clube
        SELECT COUNT(*) INTO v_squad_total FROM public.base_ai_players WHERE club_id = v_club.id;
        
        -- Calcula OVR do clube (média dos 11 titulares)
        SELECT COALESCE(AVG(ovr)::INT, 0) INTO v_club_ovr FROM public.base_ai_players WHERE club_id = v_club.id AND is_starter = true;

        -- Concorrência e Vagas
        SELECT COUNT(*) INTO v_squad_pos_count FROM public.base_ai_players WHERE club_id = v_club.id AND (primary_position = v_player_pos OR secondary_position = v_player_pos);
        SELECT COUNT(*) INTO v_squad_titulares_count FROM public.base_ai_players WHERE club_id = v_club.id AND (primary_position = v_player_pos OR secondary_position = v_player_pos) AND is_starter = true;
        
        SELECT COALESCE(MIN(ovr), 0) INTO v_lowest_starter_ovr FROM public.base_ai_players WHERE club_id = v_club.id AND (primary_position = v_player_pos OR secondary_position = v_player_pos) AND is_starter = true;
        SELECT COALESCE(MAX(ovr), 0) INTO v_best_sub_ovr FROM public.base_ai_players WHERE club_id = v_club.id AND (primary_position = v_player_pos OR secondary_position = v_player_pos) AND is_starter = false;

        -- Simulação Vagas Ideais por Formação
        IF v_player_pos IN ('Goleiro') THEN v_ideal_slots := 2;
        ELSIF v_player_pos IN ('Zagueiro') THEN v_ideal_slots := 4;
        ELSIF v_player_pos IN ('Lateral Direito', 'Lateral Esquerdo') THEN v_ideal_slots := 2;
        ELSIF v_player_pos IN ('Volante', 'Meia Central', 'Meia Ofensivo', 'Meia Esquerda', 'Meia Direita') THEN v_ideal_slots := 3;
        ELSE v_ideal_slots := 2; END IF;

        -- 30% Necessidade Posição
        IF v_squad_pos_count = 0 THEN v_pos_score := 100;
        ELSE v_pos_score := GREATEST(0, LEAST(100, 100 - ((v_squad_pos_count::FLOAT / v_ideal_slots) * 50)::INT)); END IF;
        
        -- 25%% Estilo de Jogo
        v_style_score := 50; 
        IF v_club.play_style = 'Ofensivo' AND v_player_arq IN ('Finalizador', 'Driblador') THEN v_style_score := 90; END IF;
        IF v_club.play_style = 'Recuado' AND v_player_arq IN ('Raçudo', 'Zagueiro Defensivo') THEN v_style_score := 90; END IF;
        IF v_club.play_style = 'Posse de bola' AND v_player_arq IN ('Criador', 'Meia Ofensivo') THEN v_style_score := 90; END IF;
        
        -- 20%% Arquetipo vs Treinador
        v_arq_score := 50;
        IF v_coach.profile = 'Técnico' AND v_player_arq IN ('Criador', 'Driblador') THEN v_arq_score := 90; END IF;
        IF v_coach.profile = 'Rígido' AND v_player_arq IN ('Raçudo', 'Zagueiro Defensivo') THEN v_arq_score := 90; END IF;

        -- 15% Concorrência OVR
        IF v_squad_titulares_count = 0 THEN v_ovr_score := 100;
        ELSE v_ovr_score := GREATEST(0, LEAST(100, 100 - (v_lowest_starter_ovr - v_player_ovr) * 5)); END IF;

        -- 10%% Treinador
        v_coach_score := 100 - (ABS(COALESCE((v_coach.impacts->>'morale_initial_bonus')::INT, (v_coach.impacts->>'morale_penalty_on_failure')::INT, 0)) * 2);
        
        v_comp_score := (v_pos_score * 0.30) + (v_style_score * 0.25) + (v_arq_score * 0.20) + (v_ovr_score * 0.15) + (v_coach_score * 0.10);
        
        v_comp_breakdown := jsonb_build_object(
            'position_need_score', v_pos_score,
            'play_style_score', v_style_score,
            'archetype_score', v_arq_score,
            'competition_score', v_ovr_score,
            'coach_score', v_coach_score,
            'compatibility_total', v_comp_score,
            'position_slots_filled', v_squad_pos_count,
            'position_slots_ideal', v_ideal_slots,
            'lowest_starter_ovr', v_lowest_starter_ovr,
            'player_ovr', v_player_ovr,
            'club_ovr', v_club_ovr
        );

        v_snapshot := jsonb_build_object(
            'club_reputation', v_club.reputation,
            'club_ovr', v_club_ovr,
            'coach_profile', v_coach.profile,
            'academy', jsonb_build_object('physical', v_club.physical, 'speed', v_club.speed, 'technical', v_club.technical, 'recovery', v_club.recovery, 'tactical', v_club.tactical)
        );

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

-- ==============================================================================
-- 3. negotiate_offer (CORREÇÃO)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.negotiate_offer(p_offer_id UUID, p_requested_terms JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_offer RECORD;
    v_cost INT := 0;
    v_response_action VARCHAR;
    v_after_stance VARCHAR;
    v_new_terms JSONB;
    
    -- Termos correntes
    v_curr_wage INT;
    v_curr_bonus INT;
    v_curr_release INT;
    v_curr_dur INT;
    v_curr_role VARCHAR;
    
    -- Termos solicitados
    v_req_wage INT;
    v_req_bonus INT;
    v_req_release INT;
    v_req_dur INT;
    v_req_role VARCHAR;
    
    -- Cálculos
    v_wage_diff_pct FLOAT;
    v_release_diff_pct FLOAT;
    v_role_levels JSONB := '{"Promessa": 1, "Reserva": 2, "Rotação": 3, "Titular": 4}';
    v_role_diff INT;
    
    -- Flexibilidade
    v_flex_rem INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id AND public.is_player_owner(player_id);
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN RAISE EXCEPTION 'Oferta não está ativa.'; END IF;
    IF v_offer.round >= 3 THEN RAISE EXCEPTION 'Número máximo de rodadas atingido.'; END IF;

    -- Validando JSON (evitar lixo ou ataques)
    IF NOT p_requested_terms ? 'monthly_wage' OR NOT p_requested_terms ? 'duration_seasons' OR NOT p_requested_terms ? 'release_clause' OR NOT p_requested_terms ? 'squad_role' THEN
        RAISE EXCEPTION 'JSON inválido ou incompleto.';
    END IF;

    v_curr_wage := (v_offer.current_terms->>'monthly_wage')::INT;
    v_curr_release := (v_offer.current_terms->>'release_clause')::INT;
    v_curr_dur := (v_offer.current_terms->>'duration_seasons')::INT;
    v_curr_role := v_offer.current_terms->>'squad_role';
    v_curr_bonus := (v_offer.current_terms->>'signing_bonus')::INT;

    v_req_wage := (p_requested_terms->>'monthly_wage')::INT;
    v_req_release := (p_requested_terms->>'release_clause')::INT;
    v_req_dur := (p_requested_terms->>'duration_seasons')::INT;
    v_req_role := p_requested_terms->>'squad_role';
    v_req_bonus := (p_requested_terms->>'signing_bonus')::INT; -- Preservado, embora o plano não mensurou custo de bônus, deixaremos igual ao current

    IF v_req_wage < 0 OR v_req_release < 0 OR v_req_dur < 1 OR v_req_dur > 3 OR NOT (v_role_levels ? v_req_role) THEN
        RAISE EXCEPTION 'Valores de negociação inválidos.';
    END IF;

    -- CÁLCULO DE CUSTO ESTABELECIDO EM TABELA (SEM FÓRMULA LINEAR)
    -- Salário (+10%% = 10pts, +20%% = 22pts, rejeitar intermediários)
    v_wage_diff_pct := ROUND(((v_req_wage::FLOAT / v_curr_wage::FLOAT) - 1.0) * 100.0);
    IF v_wage_diff_pct = 0 THEN
        -- Sem custo
    ELSIF v_wage_diff_pct = 10 THEN
        v_cost := v_cost + 10;
    ELSIF v_wage_diff_pct = 20 THEN
        v_cost := v_cost + 22;
    ELSIF v_wage_diff_pct < 0 THEN
        RAISE EXCEPTION 'Não é permitido solicitar redução salarial.';
    ELSE
        RAISE EXCEPTION 'O aumento salarial deve ser em faixas pré-definidas (10%% ou 20%%).';
    END IF;

    -- Multa (-25%% = 15pts, -50%% = 35pts, Aumentar = recupera 10pts)
    v_release_diff_pct := ROUND(((v_curr_release::FLOAT - v_req_release::FLOAT) / v_curr_release::FLOAT) * 100.0);
    IF v_release_diff_pct = 0 THEN
        -- Sem custo
    ELSIF v_release_diff_pct = 25 THEN
        v_cost := v_cost + 15;
    ELSIF v_release_diff_pct = 50 THEN
        v_cost := v_cost + 35;
    ELSIF v_release_diff_pct < 0 THEN
        -- Aumentou a multa para ceder ao clube
        v_cost := v_cost - 10;
    ELSE
        RAISE EXCEPTION 'A alteração na multa rescisória deve ser em faixas exatas (-25%%, -50%% ou aumento livre).';
    END IF;

    -- Role (Subir 1 = 20pts, Subir 2 = 45pts)
    v_role_diff := (v_role_levels->>v_req_role)::INT - (v_role_levels->>v_curr_role)::INT;
    IF v_role_diff = 0 THEN
        -- Sem custo
    ELSIF v_role_diff = 1 THEN 
        v_cost := v_cost + 20; 
    ELSIF v_role_diff = 2 THEN 
        v_cost := v_cost + 45; 
    ELSIF v_role_diff > 2 THEN 
        RAISE EXCEPTION 'Não é possível saltar mais de duas funções na hierarquia de uma vez.';
    END IF;

    -- Duração (Reduzir = 12pts, Aumentar = recupera 8pts)
    IF v_req_dur < v_curr_dur THEN 
        v_cost := v_cost + 12;
    ELSIF v_req_dur > v_curr_dur THEN 
        v_cost := v_cost - 8; 
    END IF;

    -- Verifica histórico para achar a flexibilidade restante atual
    SELECT COALESCE((SELECT remaining_flexibility FROM public.player_offer_history WHERE offer_id = p_offer_id ORDER BY round DESC LIMIT 1), v_offer.internal_tolerance) INTO v_flex_rem;

    IF v_cost <= v_flex_rem THEN
        v_response_action := 'accepted';
        v_after_stance := 'interessado';
        v_new_terms := p_requested_terms;
    ELSIF v_cost <= v_flex_rem + 15 THEN
        v_response_action := 'countered';
        v_after_stance := 'cauteloso';
        -- Contraproposta Intermediária
        v_new_terms := jsonb_build_object(
            'monthly_wage', v_curr_wage + ((v_req_wage - v_curr_wage) / 2),
            'release_clause', v_curr_release, -- Clube recusa baixar a multa
            'duration_seasons', v_req_dur,    -- Clube aceita a duração pedida
            'squad_role', v_curr_role,        -- Clube recusa promessa maior
            'signing_bonus', v_curr_bonus
        );
        -- Consome flexibilidade extra usada na concessão
        v_cost := v_flex_rem; 
    ELSE
        v_response_action := 'withdrawn';
        v_after_stance := 'pronto para abandonar';
        v_new_terms := p_requested_terms; 
    END IF;

    v_flex_rem := v_flex_rem - v_cost;

    UPDATE public.player_offers 
    SET current_terms = CASE WHEN v_response_action = 'withdrawn' THEN current_terms ELSE v_new_terms END, 
        round = round + 1, 
        status = CASE WHEN v_response_action = 'withdrawn' THEN 'withdrawn' ELSE 'countered' END
    WHERE id = p_offer_id;

    INSERT INTO public.player_offer_history (
        offer_id, round, previous_terms, requested_terms, club_response_terms, negotiation_cost, remaining_flexibility, response_action, before_stance, after_stance
    ) VALUES (
        p_offer_id, v_offer.round + 1, v_offer.current_terms, p_requested_terms, v_new_terms, v_cost, v_flex_rem, v_response_action, 'interessado', v_after_stance
    );

    RETURN jsonb_build_object('result', v_response_action, 'new_terms', v_new_terms, 'stance', v_after_stance, 'cost', v_cost);
END;
$$;

-- ==============================================================================
-- 4. reject_offer (OFERTA EMERGENCIAL CORRIGIDA)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reject_offer(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_offer RECORD;
    v_active_count INT;
    
    v_career_state RECORD;
    v_worst_club RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id AND public.is_player_owner(player_id);
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN RAISE EXCEPTION 'Apenas ofertas ativas podem ser recusadas.'; END IF;

    UPDATE public.player_offers SET status = 'rejected' WHERE id = p_offer_id;

    SELECT count(*) INTO v_active_count FROM public.player_offers WHERE player_id = v_offer.player_id AND status IN ('new', 'reviewed', 'negotiating', 'countered');
    
    IF v_active_count = 0 THEN
        SELECT * INTO v_career_state FROM public.player_career_state WHERE player_id = v_offer.player_id;
        IF v_career_state.emergency_offer_generated = false THEN
            -- Seleciona o clube ativo de pior reputação e gera a pior oferta possível
            SELECT * INTO v_worst_club FROM public.base_clubs WHERE is_active = true ORDER BY reputation ASC LIMIT 1;
            
            INSERT INTO public.player_offers (
                player_id, club_id, initial_terms, current_terms, status, internal_tolerance, compatibility_breakdown, snapshot_data, is_emergency
            ) VALUES (
                v_offer.player_id, v_worst_club.id, 
                jsonb_build_object('duration_seasons', 3, 'monthly_wage', (v_worst_club.base_terms->>'monthly_wage')::INT * 0.8, 'signing_bonus', 0, 'release_clause', 10000, 'squad_role', 'Promessa'),
                jsonb_build_object('duration_seasons', 3, 'monthly_wage', (v_worst_club.base_terms->>'monthly_wage')::INT * 0.8, 'signing_bonus', 0, 'release_clause', 10000, 'squad_role', 'Promessa'),
                'new', 0, '{}', '{}', true
            );
            
            UPDATE public.player_career_state SET emergency_offer_generated = true WHERE player_id = v_offer.player_id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'remaining_offers', v_active_count);
END;
$$;

-- ==============================================================================
-- 5. accept_offer (CORREÇÃO ESTADO CARREIRA)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_offer RECORD;
    v_club RECORD;
    v_coach RECORD;
    v_academy RECORD;
    
    v_wage INT;
    v_bonus INT;
    v_duration INT;
    v_release INT;
    v_role VARCHAR;
    v_trust INT;
    
    v_morale_start INT := 50;
    
    -- Academy mods
    v_mod_phys INT;
    v_mod_speed INT;
    v_mod_tech INT;
    v_mod_rec INT;
    v_mod_tact INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id AND public.is_player_owner(player_id) FOR UPDATE;
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN RAISE EXCEPTION 'Oferta indisponível para assinatura.'; END IF;

    IF EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_offer.player_id AND status = 'active') THEN
        RAISE EXCEPTION 'O jogador já possui um contrato ativo.';
    END IF;

    v_wage := (v_offer.current_terms->>'monthly_wage')::INT;
    v_bonus := (v_offer.current_terms->>'signing_bonus')::INT;
    v_duration := (v_offer.current_terms->>'duration_seasons')::INT;
    v_release := (v_offer.current_terms->>'release_clause')::INT;
    v_role := v_offer.current_terms->>'squad_role';

    INSERT INTO public.player_contracts (player_id, club_id, duration_seasons, monthly_wage, signing_bonus, release_clause, squad_role, status)
    VALUES (v_offer.player_id, v_offer.club_id, v_duration, v_wage, v_bonus, v_release, v_role, 'active');

    UPDATE public.player_offers SET status = 'accepted' WHERE id = p_offer_id;
    UPDATE public.player_offers SET status = 'withdrawn' WHERE player_id = v_offer.player_id AND id != p_offer_id AND status NOT IN ('expired', 'rejected', 'withdrawn', 'accepted');

    IF v_role = 'Promessa' THEN v_trust := 40;
    ELSIF v_role = 'Reserva' THEN v_trust := 48;
    ELSIF v_role = 'Rotação' THEN v_trust := 58;
    ELSIF v_role = 'Titular' THEN v_trust := 70;
    ELSE v_trust := 50; END IF;

    SELECT * INTO v_club FROM public.base_clubs WHERE id = v_offer.club_id;
    SELECT * INTO v_coach FROM public.base_coaches WHERE id = v_club.coach_id;
    SELECT * INTO v_academy FROM public.base_academy_profiles WHERE club_id = v_offer.club_id;

    IF v_coach.impacts ? 'morale_initial_bonus' THEN
        v_morale_start := v_morale_start + (v_coach.impacts->>'morale_initial_bonus')::INT;
    END IF;

    -- Converte estrelas (1-5) para %: 1=-5, 2=0, 3=4, 4=8, 5=12.  E pra recovery: 1=-5, 2=0, 3=5, 4=10, 5=15
    v_mod_phys := CASE v_academy.physical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 ELSE 12 END;
    v_mod_speed := CASE v_academy.speed WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 ELSE 12 END;
    v_mod_tech := CASE v_academy.technical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 ELSE 12 END;
    v_mod_tact := CASE v_academy.tactical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 ELSE 12 END;
    v_mod_rec := CASE v_academy.recovery WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 5 WHEN 4 THEN 10 ELSE 15 END;

    INSERT INTO public.player_career_state (
        player_id, club_id, coach_id, trust, morale, energy, hierarchy, compatibility, 
        pending_initial_balance, financial_credit_applied, onboarding_completed, evolution_modifiers, recovery_modifier
    ) VALUES (
        v_offer.player_id, v_offer.club_id, v_club.coach_id, v_trust, v_morale_start, 100, v_role, 
        (v_offer.compatibility_breakdown->>'compatibility_total')::INT, 
        v_bonus, false, true, 
        jsonb_build_object('physical_pct', v_mod_phys, 'speed_pct', v_mod_speed, 'technical_pct', v_mod_tech, 'tactical_pct', v_mod_tact), v_mod_rec
    ) ON CONFLICT (player_id) DO UPDATE 
    SET club_id = EXCLUDED.club_id, coach_id = EXCLUDED.coach_id, trust = EXCLUDED.trust, morale = EXCLUDED.morale, energy = EXCLUDED.energy, hierarchy = EXCLUDED.hierarchy, 
        compatibility = EXCLUDED.compatibility, evolution_modifiers = EXCLUDED.evolution_modifiers, recovery_modifier = EXCLUDED.recovery_modifier,
        pending_initial_balance = EXCLUDED.pending_initial_balance, onboarding_completed = EXCLUDED.onboarding_completed;

    RETURN jsonb_build_object('success', true);
END;
$$;
