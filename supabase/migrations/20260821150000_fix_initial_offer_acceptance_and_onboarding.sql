BEGIN;

CREATE OR REPLACE FUNCTION public.get_career_onboarding_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_player_count int := 0;
  v_player_id uuid;
  v_has_player boolean := false;
  v_offers_generated boolean := false;
  v_active_offers int := 0;
  v_contract_signed boolean := false;
  v_onboarding_completed boolean := false;
  v_expected_clubs int := 0;
  v_generated_offer_clubs int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT count(*) INTO v_player_count
  FROM public.jogadores
  WHERE user_id = v_user_id;

  IF v_player_count > 1 THEN
    RAISE EXCEPTION 'Duplicidade de jogador detectada para este usuário.';
  ELSIF v_player_count = 1 THEN
    v_has_player := true;
    SELECT j.id INTO v_player_id
    FROM public.jogadores j
    WHERE j.user_id = v_user_id;
  END IF;

  IF v_has_player THEN
    SELECT count(*) INTO v_expected_clubs
    FROM public.base_clubs
    WHERE is_active = true;

    SELECT count(DISTINCT po.club_id) INTO v_generated_offer_clubs
    FROM public.player_offers po
    WHERE po.player_id = v_player_id
      AND po.is_emergency = false;

    v_offers_generated := v_expected_clubs > 0
      AND v_generated_offer_clubs >= v_expected_clubs;

    SELECT count(*) INTO v_active_offers
    FROM public.player_offers
    WHERE player_id = v_player_id
      AND status IN ('new', 'reviewed', 'negotiating', 'countered', 'accepted');

    SELECT EXISTS (
      SELECT 1
      FROM public.player_contracts
      WHERE player_id = v_player_id
        AND status = 'active'
    ) INTO v_contract_signed;

    SELECT COALESCE(pcs.onboarding_completed, false)
    INTO v_onboarding_completed
    FROM public.player_career_state pcs
    WHERE pcs.player_id = v_player_id;

    v_onboarding_completed := COALESCE(v_onboarding_completed, false);
  END IF;

  RETURN jsonb_build_object(
    'has_player', v_has_player,
    'offers_generated', v_offers_generated,
    'generated_offer_clubs', v_generated_offer_clubs,
    'expected_offer_clubs', v_expected_clubs,
    'active_offers', v_active_offers,
    'contract_signed', v_contract_signed,
    'onboarding_completed', v_onboarding_completed
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.negotiate_offer(
  p_offer_id uuid,
  p_requested_terms jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_offer record;
  v_round int;
  v_flex_rem int;
  v_cost int := 0;
  v_curr_wage int;
  v_req_wage int;
  v_curr_dur int;
  v_req_dur int;
  v_curr_release int;
  v_req_release int;
  v_curr_role text;
  v_req_role text;
  v_curr_bonus int;
  v_requested_terms jsonb;
  v_role_diff int;
  v_response_action text;
  v_club_stance text;
  v_response_terms jsonb;
  v_message text;
  v_latest_action text;
  v_role_levels jsonb := '{"Promessa":1,"Reserva":2,"Rotação":3,"Titular":4,"Estrela":5}'::jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  SELECT po.* INTO v_offer
  FROM public.player_offers po
  JOIN public.jogadores j ON j.id = po.player_id
  WHERE po.id = p_offer_id
    AND j.user_id = v_user_id
  FOR UPDATE OF po;

  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
  IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN
    RAISE EXCEPTION 'A negociação para este clube já foi encerrada.';
  END IF;
  IF v_offer.round >= 3 THEN RAISE EXCEPTION 'Número máximo de rodadas de negociação atingido.'; END IF;
  IF v_offer.offer_type = 'initial' AND EXISTS (
    SELECT 1 FROM public.player_contracts pc
    WHERE pc.player_id = v_offer.player_id AND pc.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Jogador já possui contrato ativo.';
  END IF;
  IF v_offer.offer_type NOT IN ('initial', 'academy_transfer', 'professional_transfer', 'professional_promotion') THEN
    RAISE EXCEPTION 'Tipo de proposta não negociável.';
  END IF;

  SELECT poh.response_action INTO v_latest_action
  FROM public.player_offer_history poh
  WHERE poh.offer_id = p_offer_id
  ORDER BY poh.round DESC
  LIMIT 1;
  IF v_latest_action = 'accepted' THEN
    RAISE EXCEPTION 'O clube já aceitou os termos atuais. Assine o contrato ou recuse a proposta.';
  END IF;

  IF p_requested_terms IS NULL OR jsonb_typeof(p_requested_terms) <> 'object' THEN
    RAISE EXCEPTION 'Termos de negociação inválidos.';
  END IF;
  IF NOT (p_requested_terms ? 'monthly_wage')
     OR NOT (p_requested_terms ? 'duration_seasons')
     OR NOT (p_requested_terms ? 'release_clause')
     OR NOT (p_requested_terms ? 'squad_role')
     OR EXISTS (
       SELECT 1
       FROM jsonb_object_keys(p_requested_terms) k(key)
       WHERE k.key NOT IN ('monthly_wage', 'duration_seasons', 'release_clause', 'squad_role', 'signing_bonus')
     ) THEN
    RAISE EXCEPTION 'A contraproposta contém campos inválidos.';
  END IF;

  BEGIN
    v_curr_wage := (v_offer.current_terms->>'monthly_wage')::int;
    v_req_wage := (p_requested_terms->>'monthly_wage')::int;
    v_curr_dur := (v_offer.current_terms->>'duration_seasons')::int;
    v_req_dur := (p_requested_terms->>'duration_seasons')::int;
    v_curr_release := (v_offer.current_terms->>'release_clause')::int;
    v_req_release := (p_requested_terms->>'release_clause')::int;
    v_curr_role := v_offer.current_terms->>'squad_role';
    v_req_role := p_requested_terms->>'squad_role';
    v_curr_bonus := coalesce((v_offer.current_terms->>'signing_bonus')::int, 0);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Os valores numéricos da negociação são inválidos.';
  END;

  IF v_req_wage IS NULL OR v_req_wage <= 0 THEN RAISE EXCEPTION 'Salário deve ser maior que zero.'; END IF;
  IF v_req_release IS NULL OR v_req_release <= 0 THEN RAISE EXCEPTION 'Multa rescisória deve ser maior que zero.'; END IF;
  IF v_req_dur IS NULL OR v_req_dur < 1 OR v_req_dur > 3 THEN RAISE EXCEPTION 'Duração deve ser de 1 a 3 temporadas.'; END IF;
  IF NOT (v_role_levels ? v_req_role) OR NOT (v_role_levels ? v_curr_role) THEN RAISE EXCEPTION 'Função no elenco inválida.'; END IF;

  v_requested_terms := jsonb_build_object(
    'monthly_wage', v_req_wage,
    'duration_seasons', v_req_dur,
    'release_clause', v_req_release,
    'squad_role', v_req_role,
    'signing_bonus', v_curr_bonus
  );

  IF v_req_wage > v_curr_wage THEN
    v_cost := v_cost + round(((v_req_wage::numeric / v_curr_wage::numeric) - 1.0) * 80)::int;
  ELSIF v_req_wage < v_curr_wage THEN
    v_cost := v_cost - round(((v_curr_wage::numeric / v_req_wage::numeric) - 1.0) * 40)::int;
  END IF;
  IF v_req_release < v_curr_release THEN
    v_cost := v_cost + round(((v_curr_release::numeric / v_req_release::numeric) - 1.0) * 60)::int;
  ELSIF v_req_release > v_curr_release THEN
    v_cost := v_cost - round(((v_req_release::numeric / v_curr_release::numeric) - 1.0) * 30)::int;
  END IF;

  v_role_diff := (v_role_levels->>v_req_role)::int - (v_role_levels->>v_curr_role)::int;
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

  v_cost := greatest(0, v_cost);
  v_flex_rem := greatest(0, coalesce(v_offer.internal_tolerance, 0));

  IF v_cost = 0 THEN
    v_response_action := 'accepted';
    v_club_stance := 'flexível';
    v_response_terms := v_requested_terms;
    v_message := 'O clube aceitou seus termos. Revise e assine o contrato para concluir.';
  ELSIF v_cost <= v_flex_rem THEN
    v_response_action := 'countered';
    v_club_stance := 'cauteloso';
    v_response_terms := jsonb_build_object(
      'monthly_wage', (v_curr_wage::numeric + ((v_req_wage::numeric - v_curr_wage::numeric) / 2))::int,
      'duration_seasons', v_curr_dur,
      'release_clause', v_curr_release,
      'squad_role', v_curr_role,
      'signing_bonus', v_curr_bonus
    );
    v_flex_rem := greatest(0, v_flex_rem - v_cost);
    v_message := 'O clube fez uma contraproposta.';
  ELSIF v_offer.is_emergency THEN
    v_response_action := 'countered';
    v_club_stance := 'intransigente';
    v_response_terms := v_offer.current_terms;
    v_flex_rem := 0;
    v_message := 'O clube não aceitou suas exigências e manteve a oferta emergencial como condição final.';
  ELSE
    v_response_action := 'withdrawn';
    v_club_stance := 'intransigente';
    v_response_terms := v_offer.current_terms;
    v_flex_rem := 0;
    v_message := 'O clube encerrou as negociações após considerar as exigências excessivas.';
  END IF;

  v_round := v_offer.round + 1;
  INSERT INTO public.player_offer_history(
    offer_id, round, requested_terms, response_action, club_response_terms,
    previous_terms, negotiation_cost, remaining_flexibility, before_stance, after_stance
  ) VALUES (
    p_offer_id, v_round, v_requested_terms, v_response_action, v_response_terms,
    v_offer.current_terms, v_cost, v_flex_rem,
    CASE WHEN v_offer.status = 'countered' THEN 'cauteloso' ELSE 'interessado' END,
    v_club_stance
  );

  IF v_response_action = 'withdrawn' THEN
    UPDATE public.player_offers
    SET status = 'withdrawn', round = v_round, internal_tolerance = v_flex_rem
    WHERE id = p_offer_id;
  ELSIF v_response_action = 'accepted' THEN
    UPDATE public.player_offers
    SET status = 'accepted', current_terms = v_response_terms,
        round = v_round, internal_tolerance = v_flex_rem
    WHERE id = p_offer_id;
  ELSE
    UPDATE public.player_offers
    SET status = 'countered', current_terms = v_response_terms,
        round = v_round, internal_tolerance = v_flex_rem
    WHERE id = p_offer_id;
  END IF;

  RETURN jsonb_build_object(
    'status', v_response_action,
    'message', v_message,
    'round', v_round,
    'remaining_flexibility', v_flex_rem,
    'terms', v_response_terms
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_career_onboarding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_onboarding_state() TO authenticated;
REVOKE ALL ON FUNCTION public.negotiate_offer(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.negotiate_offer(uuid, jsonb) TO authenticated;

COMMIT;
