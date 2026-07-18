-- Migration: 20260718000004_career_start_step2_rpcs_part2.sql
-- RPCs: get_offer_details, negotiate_offer, accept_offer, reject_offer

-- ==============================================================================
-- 3. get_offer_details
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_offer_details(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_offer RECORD;
    v_club RECORD;
    v_history JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    -- Validar a posse da oferta baseada no is_player_owner
    SELECT o.* INTO v_offer FROM public.player_offers o WHERE o.id = p_offer_id AND public.is_player_owner(o.player_id);
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada ou acesso negado.'; END IF;

    -- Pegar detalhes completos do clube
    SELECT c.*, co.name as coach_name, co.profile as coach_profile, 
           a.physical, a.speed, a.technical, a.recovery, a.tactical
    INTO v_club 
    FROM public.base_clubs c 
    JOIN public.base_coaches co ON c.coach_id = co.id 
    JOIN public.base_academy_profiles a ON c.id = a.club_id
    WHERE c.id = v_offer.club_id;

    -- Pegar histórico da negociação
    SELECT jsonb_agg(h.*) INTO v_history FROM public.player_offer_history h WHERE h.offer_id = p_offer_id;
    IF v_history IS NULL THEN v_history := '[]'::jsonb; END IF;

    -- Retornar dossiê unificado
    RETURN jsonb_build_object(
        'offer', jsonb_build_object(
            'id', v_offer.id,
            'status', v_offer.status,
            'round', v_offer.round,
            'current_terms', v_offer.current_terms,
            'compatibility_breakdown', v_offer.compatibility_breakdown
        ),
        'club', jsonb_build_object(
            'name', v_club.name,
            'city', v_club.city,
            'shield_url', v_club.shield_url,
            'formation', v_club.formation,
            'play_style', v_club.play_style,
            'reputation', v_club.reputation
        ),
        'coach', jsonb_build_object(
            'name', v_club.coach_name,
            'profile', v_club.coach_profile
        ),
        'academy', jsonb_build_object(
            'physical', v_club.physical,
            'speed', v_club.speed,
            'technical', v_club.technical,
            'recovery', v_club.recovery,
            'tactical', v_club.tactical
        ),
        'history', v_history
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_offer_details(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_offer_details(UUID) TO authenticated;

-- ==============================================================================
-- 4. negotiate_offer
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
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id AND public.is_player_owner(player_id);
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN RAISE EXCEPTION 'Oferta não está ativa.'; END IF;
    IF v_offer.round >= 3 THEN RAISE EXCEPTION 'Número máximo de rodadas de negociação atingido.'; END IF;

    -- SIMULAÇÃO BÁSICA DE CUSTO (deve ser refinado de acordo com a regra exata)
    -- Exemplo: Aumentar salário em 10% custa 10 pts, etc.
    -- Aqui faremos uma estimativa de custo baseada numa flag enviada para demonstração ou calculada.
    -- Neste script, consideramos v_cost recebendo um peso empírico de 15 para testar.
    v_cost := 15; -- TODO: Implementar lógica de delta entre current_terms e requested_terms
    
    IF v_cost <= v_offer.internal_tolerance THEN
        v_response_action := 'accepted';
        v_after_stance := 'interessado';
        v_new_terms := p_requested_terms;
    ELSIF v_cost <= v_offer.internal_tolerance + 15 THEN
        v_response_action := 'countered';
        v_after_stance := 'cauteloso';
        -- O clube cede metade:
        v_new_terms := v_offer.current_terms; -- Simplificação: manter termos anteriores em contraproposta base.
    ELSE
        v_response_action := 'withdrawn';
        v_after_stance := 'pronto para abandonar';
        v_new_terms := p_requested_terms; -- Termos que quebraram o negócio
    END IF;

    -- Update da oferta
    UPDATE public.player_offers 
    SET current_terms = v_new_terms, 
        round = round + 1, 
        status = CASE WHEN v_response_action = 'withdrawn' THEN 'withdrawn' ELSE 'countered' END
    WHERE id = p_offer_id;

    -- Histórico
    INSERT INTO public.player_offer_history (
        offer_id, round, previous_terms, requested_terms, club_response_terms, negotiation_cost, remaining_flexibility, response_action, before_stance, after_stance
    ) VALUES (
        p_offer_id, v_offer.round + 1, v_offer.current_terms, p_requested_terms, v_new_terms, v_cost, (v_offer.internal_tolerance - v_cost), v_response_action, 'interessado', v_after_stance
    );

    RETURN jsonb_build_object('result', v_response_action, 'new_terms', v_new_terms, 'stance', v_after_stance);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.negotiate_offer(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.negotiate_offer(UUID, JSONB) TO authenticated;

-- ==============================================================================
-- 5. accept_offer
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
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id AND public.is_player_owner(player_id);
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN RAISE EXCEPTION 'Oferta indisponível para assinatura.'; END IF;

    IF EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_offer.player_id AND status = 'active') THEN
        RAISE EXCEPTION 'O jogador já possui um contrato ativo.';
    END IF;

    -- Parseia termos
    v_wage := (v_offer.current_terms->>'monthly_wage')::INT;
    v_bonus := (v_offer.current_terms->>'signing_bonus')::INT;
    v_duration := (v_offer.current_terms->>'duration_seasons')::INT;
    v_release := (v_offer.current_terms->>'release_clause')::INT;
    v_role := v_offer.current_terms->>'squad_role';

    -- Cria contrato
    INSERT INTO public.player_contracts (player_id, club_id, duration_seasons, monthly_wage, signing_bonus, release_clause, squad_role, status)
    VALUES (v_offer.player_id, v_offer.club_id, v_duration, v_wage, v_bonus, v_release, v_role, 'active');

    -- Atualiza ofertas
    UPDATE public.player_offers SET status = 'accepted' WHERE id = p_offer_id;
    UPDATE public.player_offers SET status = 'withdrawn' WHERE player_id = v_offer.player_id AND id != p_offer_id AND status NOT IN ('expired', 'rejected', 'withdrawn', 'accepted');

    -- Define confiança base
    IF v_role = 'Promessa' THEN v_trust := 40;
    ELSIF v_role = 'Reserva' THEN v_trust := 48;
    ELSIF v_role = 'Rotação' THEN v_trust := 58;
    ELSIF v_role = 'Titular' THEN v_trust := 70;
    ELSE v_trust := 50; END IF;

    -- Pega dados do clube para compor estado
    SELECT * INTO v_club FROM public.base_clubs WHERE id = v_offer.club_id;
    SELECT * INTO v_academy FROM public.base_academy_profiles WHERE club_id = v_offer.club_id;

    -- Preenche estado de carreira e bônus futuro pendente
    INSERT INTO public.player_career_state (
        player_id, club_id, coach_id, trust, morale, energy, hierarchy, compatibility, 
        pending_initial_balance, financial_credit_applied, onboarding_completed, evolution_modifiers, recovery_modifier
    ) VALUES (
        v_offer.player_id, v_offer.club_id, v_club.coach_id, v_trust, 50, 100, v_role, 
        (v_offer.compatibility_breakdown->>'compatibility_total')::INT, 
        v_bonus, false, true, 
        jsonb_build_object('physical', v_academy.physical, 'technical', v_academy.technical), v_academy.recovery
    ) ON CONFLICT (player_id) DO UPDATE 
    SET club_id = EXCLUDED.club_id, coach_id = EXCLUDED.coach_id, trust = EXCLUDED.trust, hierarchy = EXCLUDED.hierarchy, 
        pending_initial_balance = EXCLUDED.pending_initial_balance, onboarding_completed = EXCLUDED.onboarding_completed;

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_offer(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(UUID) TO authenticated;

-- ==============================================================================
-- 6. reject_offer
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
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id AND public.is_player_owner(player_id);
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;

    UPDATE public.player_offers SET status = 'rejected' WHERE id = p_offer_id;

    -- Lógica de oferta emergencial: se zerou, cria emergencial (não faremos a geração inteira no script, mas a validação)
    SELECT count(*) INTO v_active_count FROM public.player_offers WHERE player_id = v_offer.player_id AND status IN ('new', 'reviewed', 'negotiating', 'countered');
    IF v_active_count = 0 THEN
        -- TODO: Criar lógica real da oferta emergencial
        NULL;
    END IF;

    RETURN jsonb_build_object('success', true, 'remaining_offers', v_active_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_offer(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reject_offer(UUID) TO authenticated;
