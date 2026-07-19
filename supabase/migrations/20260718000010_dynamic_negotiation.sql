DROP FUNCTION IF EXISTS public.negotiate_offer(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.negotiate_offer(
    p_offer_id UUID,
    p_requested_terms JSONB
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_player_id UUID;
    v_offer RECORD;
    v_has_contract BOOLEAN;
    v_round INT;
    v_flex_rem INT;
    v_cost INT := 0;
    
    v_curr_wage INT;
    v_req_wage INT;
    v_curr_dur INT;
    v_req_dur INT;
    v_curr_release INT;
    v_req_release INT;
    v_curr_role TEXT;
    v_req_role TEXT;
    v_curr_bonus INT;
    v_req_bonus INT;
    
    v_role_diff INT;
    
    v_response_action TEXT;
    v_club_stance TEXT;
    v_response_terms JSONB;
    v_message TEXT;
    v_role_levels JSONB := '{"Promessa": 1, "Reserva": 2, "Rotação": 3, "Titular": 4, "Estrela": 5}';
    
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT id INTO v_player_id FROM public.jogadores WHERE user_id = v_user_id LIMIT 1;
    IF v_player_id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;

    -- Trava transacional estrita
    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id FOR UPDATE;
    IF v_offer.player_id != v_player_id THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
    
    IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN RAISE EXCEPTION 'A negociação para este clube já foi encerrada.'; END IF;

    SELECT EXISTS (SELECT 1 FROM public.player_contracts WHERE player_id = v_player_id AND status = 'active') INTO v_has_contract;
    IF v_has_contract THEN RAISE EXCEPTION 'Jogador já possui contrato ativo'; END IF;

    -- Validação das Chaves
    IF (SELECT count(*) FROM jsonb_object_keys(p_requested_terms)) <> 5 THEN
        RAISE EXCEPTION 'O JSON deve conter exatamente as 5 chaves de negociação.';
    END IF;

    v_curr_wage := (v_offer.current_terms->>'monthly_wage')::INT;
    v_req_wage := (p_requested_terms->>'monthly_wage')::INT;
    v_curr_dur := (v_offer.current_terms->>'duration_seasons')::INT;
    v_req_dur := (p_requested_terms->>'duration_seasons')::INT;
    v_curr_release := (v_offer.current_terms->>'release_clause')::INT;
    v_req_release := (p_requested_terms->>'release_clause')::INT;
    v_curr_role := v_offer.current_terms->>'squad_role';
    v_req_role := p_requested_terms->>'squad_role';
    v_curr_bonus := (v_offer.current_terms->>'signing_bonus')::INT;
    v_req_bonus := (p_requested_terms->>'signing_bonus')::INT;

    -- Cálculo Dinâmico de Tensão (Sem Hardcaps)
    IF v_req_wage > v_curr_wage THEN
        v_cost := v_cost + (((v_req_wage::NUMERIC / v_curr_wage::NUMERIC) - 1.0) * 80)::INT;
    ELSIF v_req_wage < v_curr_wage THEN
        v_cost := v_cost - (((v_curr_wage::NUMERIC / v_req_wage::NUMERIC) - 1.0) * 40)::INT;
    END IF;

    IF v_req_release < v_curr_release THEN
        v_cost := v_cost + (((v_curr_release::NUMERIC / v_req_release::NUMERIC) - 1.0) * 60)::INT;
    ELSIF v_req_release > v_curr_release THEN
        v_cost := v_cost - (((v_req_release::NUMERIC / v_curr_release::NUMERIC) - 1.0) * 30)::INT;
    END IF;

    v_role_diff := COALESCE((v_role_levels->>v_req_role)::INT, 1) - COALESCE((v_role_levels->>v_curr_role)::INT, 1);
    IF v_role_diff > 0 THEN
        v_cost := v_cost + (v_role_diff * 25);
    ELSIF v_role_diff < 0 THEN
        v_cost := v_cost + (v_role_diff * 15);
    END IF;

    IF v_req_dur < v_curr_dur THEN
        v_cost := v_cost + ((v_curr_dur - v_req_dur) * 5);
    ELSIF v_req_dur > v_curr_dur THEN
        v_cost := v_cost - ((v_req_dur - v_curr_dur) * 5);
    END IF;

    IF v_req_bonus > v_curr_bonus THEN
        v_cost := v_cost + (((v_req_bonus::NUMERIC / v_curr_bonus::NUMERIC) - 1.0) * 50)::INT;
    END IF;

    IF v_cost < 0 THEN v_cost := 0; END IF;

    SELECT COALESCE((SELECT remaining_flexibility FROM public.player_offer_history WHERE offer_id = p_offer_id ORDER BY round DESC LIMIT 1), v_offer.internal_tolerance) INTO v_flex_rem;

    IF v_cost = 0 THEN
        v_response_action := 'accepted';
        v_club_stance := 'flexível';
        v_response_terms := p_requested_terms;
        v_flex_rem := v_flex_rem;
        v_message := 'O clube aceitou todas as suas exigências de imediato!';
    ELSIF v_cost <= v_flex_rem THEN
        v_response_action := 'countered';
        v_club_stance := 'cauteloso';
        
        v_response_terms := jsonb_build_object(
            'monthly_wage', (v_curr_wage::NUMERIC + ((v_req_wage::NUMERIC - v_curr_wage::NUMERIC) / 2))::INT,
            'duration_seasons', v_curr_dur,
            'release_clause', v_curr_release,
            'squad_role', v_curr_role,
            'signing_bonus', v_curr_bonus
        );
        v_flex_rem := v_flex_rem - v_cost;
        v_message := 'O clube fez uma contraproposta. A pedida afetou a relação, fique de olho na barra de paciência!';
    ELSE
        v_response_action := 'withdrawn';
        v_club_stance := 'intransigente';
        v_response_terms := v_offer.current_terms;
        v_flex_rem := 0;
        v_message := 'A diretoria do clube achou as suas exigências um absurdo, perdeu a paciência e encerrou as negociações.';
    END IF;

    v_round := v_offer.round + 1;
    
    INSERT INTO public.player_offer_history (
        offer_id, round, requested_terms, response_action, club_response_terms, previous_terms, negotiation_cost, remaining_flexibility, after_stance
    ) VALUES (
        p_offer_id, v_round, p_requested_terms, v_response_action, v_response_terms, v_offer.current_terms, v_cost, v_flex_rem, v_club_stance
    );

    IF v_response_action = 'accepted' THEN
        UPDATE public.player_offers SET 
            status = 'accepted', current_terms = v_response_terms, round = v_round
        WHERE id = p_offer_id;
    ELSIF v_response_action = 'withdrawn' THEN
        UPDATE public.player_offers SET 
            status = 'withdrawn', round = v_round
        WHERE id = p_offer_id;
    ELSE
        UPDATE public.player_offers SET 
            status = 'countered', current_terms = v_response_terms, round = v_round
        WHERE id = p_offer_id;
    END IF;

    RETURN jsonb_build_object('status', v_response_action, 'message', v_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.negotiate_offer(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.negotiate_offer(UUID, JSONB) TO authenticated;
