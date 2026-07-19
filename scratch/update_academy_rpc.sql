DROP FUNCTION IF EXISTS public.get_offer_details(UUID);
CREATE OR REPLACE FUNCTION public.get_offer_details(
    p_offer_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_offer RECORD;
    v_club RECORD;
    v_coach RECORD;
    v_academy RECORD;
    v_history JSONB;
    v_contract JSONB;
    v_roster JSONB;
    v_competitors JSONB;
    v_player_pos TEXT;
    v_duplicate_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT COUNT(*) INTO v_duplicate_count FROM public.jogadores WHERE user_id = v_user_id;
    IF v_duplicate_count > 1 THEN RAISE EXCEPTION 'Erro: Duplicidade legada detectada'; END IF;

    SELECT * INTO v_offer FROM public.player_offers WHERE id = p_offer_id AND player_id = (SELECT id FROM public.jogadores WHERE user_id = v_user_id LIMIT 1);
    IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;

    SELECT * INTO v_club FROM public.base_clubs WHERE id = v_offer.club_id;
    SELECT * INTO v_coach FROM public.base_coaches WHERE id = v_club.coach_id;
    SELECT * INTO v_academy FROM public.base_academy_profiles WHERE club_id = v_club.id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'round', h.round,
            'requested_terms', h.requested_terms,
            'response_action', h.response_action,
            'club_response_terms', h.club_response_terms,
            'after_stance', h.after_stance,
            'player_proposal', jsonb_build_object(
                'monthly_wage', (h.requested_terms->>'monthly_wage')::INT,
                'squad_role', h.requested_terms->>'squad_role'
            )
        ) ORDER BY h.round ASC
    ) INTO v_history
    FROM public.player_offer_history h WHERE h.offer_id = p_offer_id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'name', name,
            'age', age,
            'primary_position', primary_position,
            'ovr', ovr,
            'is_starter', is_starter
        )
    ) INTO v_roster
    FROM public.base_ai_players WHERE club_id = v_offer.club_id;
    
    SELECT posicao INTO v_player_pos FROM public.jogadores WHERE id = v_offer.player_id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'name', name,
            'age', age,
            'primary_position', primary_position,
            'ovr', ovr,
            'is_starter', is_starter
        )
    ) INTO v_competitors FROM public.base_ai_players WHERE club_id = v_offer.club_id AND (primary_position = v_player_pos OR secondary_position = v_player_pos);
    

    SELECT jsonb_build_object(
        'duration_seasons', duration_seasons,
        'monthly_wage', monthly_wage,
        'release_clause', release_clause,
        'squad_role', squad_role
    ) INTO v_contract
    FROM public.player_contracts WHERE player_id = v_offer.player_id AND status = 'active';

    RETURN jsonb_build_object(
        'offer', jsonb_build_object(
            'id', v_offer.id,
            'status', v_offer.status,
            'initial_terms', v_offer.initial_terms,
            'current_terms', v_offer.current_terms,
            'round', v_offer.round,
            'is_emergency', v_offer.is_emergency,
            'internal_tolerance', v_offer.internal_tolerance
        ),
        'compatibility_breakdown', v_offer.compatibility_breakdown,
        'snapshot', v_offer.snapshot_data,
        'club', jsonb_build_object(
            'id', v_club.id,
            'name', v_club.name,
            'ovr', (SELECT COALESCE(AVG(ovr)::INT, 50) FROM public.base_ai_players WHERE club_id = v_club.id),
            'formation', v_club.formation,
            'style', v_club.play_style
        ),
        'coach', jsonb_build_object(
            'name', v_coach.name,
            'impacts', v_coach.impacts
        ),
        'academy', jsonb_build_object(
            'name', v_club.name || ' Academy',
            'physical', v_academy.physical,
            'tactical', v_academy.tactical,
            'technical', v_academy.technical,
            'speed', v_academy.speed,
            'recovery', v_academy.recovery
        ),
        'history', COALESCE(v_history, '[]'::JSONB),
        'contract', v_contract,
        'roster', COALESCE(v_roster, '[]'::JSONB),
        'competitors', COALESCE(v_competitors, '[]'::JSONB)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.get_offer_details(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_offer_details(UUID) TO authenticated;
