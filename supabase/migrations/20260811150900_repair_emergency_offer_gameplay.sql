CREATE OR REPLACE FUNCTION public.reject_offer(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_offer public.player_offers%ROWTYPE;
  v_active_count INT;
  v_worst_club public.base_clubs%ROWTYPE;
  v_context JSONB;
  v_terms JSONB;
  v_emergency_created BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  SELECT po.* INTO v_offer
  FROM public.player_offers po
  JOIN public.jogadores j ON j.id = po.player_id
  WHERE po.id = p_offer_id AND j.user_id = v_user_id
  FOR UPDATE OF po;

  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
  IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN
    RAISE EXCEPTION 'Apenas ofertas ativas podem ser recusadas.';
  END IF;

  IF v_offer.is_emergency = true
     AND NOT EXISTS (
       SELECT 1 FROM public.player_offers other_offer
       WHERE other_offer.player_id = v_offer.player_id
         AND other_offer.id <> v_offer.id
         AND other_offer.status IN ('new', 'reviewed', 'negotiating', 'countered')
     ) THEN
    RAISE EXCEPTION 'A oferta emergencial é sua última oportunidade e não pode ser recusada.';
  END IF;

  UPDATE public.player_offers SET status = 'rejected' WHERE id = p_offer_id;

  SELECT COUNT(*) INTO v_active_count
  FROM public.player_offers
  WHERE player_id = v_offer.player_id
    AND status IN ('new', 'reviewed', 'negotiating', 'countered');

  IF v_active_count = 0 THEN
    SELECT * INTO v_worst_club
    FROM public.base_clubs
    WHERE is_active = true
    ORDER BY reputation ASC, name ASC
    LIMIT 1;

    IF v_worst_club.id IS NULL THEN
      RAISE EXCEPTION 'Nenhum clube ativo disponível para oferta emergencial.';
    END IF;

    v_context := private.build_offer_context(v_offer.player_id, v_worst_club.id);
    v_terms := jsonb_build_object(
      'duration_seasons', 3,
      'monthly_wage', GREATEST(1, ROUND((v_worst_club.base_terms->>'monthly_wage')::NUMERIC * 0.8)::INT),
      'signing_bonus', 0,
      'release_clause', GREATEST(10000, COALESCE((v_worst_club.base_terms->>'release_clause')::INT, 10000)),
      'squad_role', 'Promessa'
    );

    INSERT INTO public.player_offers (
      player_id, club_id, initial_terms, current_terms, status,
      internal_tolerance, compatibility_breakdown, snapshot_data, is_emergency
    ) VALUES (
      v_offer.player_id,
      v_worst_club.id,
      v_terms,
      v_terms,
      'new',
      GREATEST(5, LEAST(25, ROUND(COALESCE((v_context->>'internal_tolerance')::NUMERIC, 15) / 3.0)::INT)),
      COALESCE(v_context->'compatibility_breakdown', '{}'::JSONB),
      COALESCE(v_context->'snapshot_data', '{}'::JSONB) || jsonb_build_object('emergency', true),
      true
    );

    v_emergency_created := true;

    UPDATE public.player_career_state
    SET emergency_offer_generated = true, updated_at = NOW()
    WHERE player_id = v_offer.player_id;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.player_offers
  WHERE player_id = v_offer.player_id
    AND status IN ('new', 'reviewed', 'negotiating', 'countered');

  RETURN jsonb_build_object(
    'success', true,
    'remaining_offers', v_active_count,
    'emergency_offer_created', v_emergency_created
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_offer(UUID) TO authenticated;

-- Versão final da negociação: bônus fixo, estado único de paciência,
-- bloqueio após acordo e proteção da última oferta emergencial.
CREATE OR REPLACE FUNCTION public.negotiate_offer(
  p_offer_id UUID,
  p_requested_terms JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_offer RECORD;
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
  v_requested_terms JSONB;
  v_role_diff INT;
  v_response_action TEXT;
  v_club_stance TEXT;
  v_response_terms JSONB;
  v_message TEXT;
  v_latest_action TEXT;
  v_role_levels JSONB := '{"Promessa":1,"Reserva":2,"Rotação":3,"Titular":4,"Estrela":5}'::JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  SELECT po.* INTO v_offer
  FROM public.player_offers po
  JOIN public.jogadores j ON j.id = po.player_id
  WHERE po.id = p_offer_id AND j.user_id = v_user_id
  FOR UPDATE OF po;

  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
  IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN
    RAISE EXCEPTION 'A negociação para este clube já foi encerrada.';
  END IF;
  IF v_offer.round >= 3 THEN RAISE EXCEPTION 'Número máximo de rodadas de negociação atingido.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.player_contracts pc
    WHERE pc.player_id = v_offer.player_id AND pc.status = 'active'
  ) THEN RAISE EXCEPTION 'Jogador já possui contrato ativo.'; END IF;

  SELECT poh.response_action INTO v_latest_action
  FROM public.player_offer_history poh
  WHERE poh.offer_id = p_offer_id
  ORDER BY poh.round DESC LIMIT 1;

  IF v_latest_action = 'accepted' THEN
    RAISE EXCEPTION 'O clube já aceitou os termos atuais. Assine o contrato ou recuse a proposta.';
  END IF;

  IF p_requested_terms IS NULL OR jsonb_typeof(p_requested_terms) <> 'object' THEN
    RAISE EXCEPTION 'Termos de negociação inválidos.';
  END IF;

  IF NOT p_requested_terms ? 'monthly_wage'
     OR NOT p_requested_terms ? 'duration_seasons'
     OR NOT p_requested_terms ? 'release_clause'
     OR NOT p_requested_terms ? 'squad_role'
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_requested_terms) AS k(key)
       WHERE k.key NOT IN ('monthly_wage', 'duration_seasons', 'release_clause', 'squad_role', 'signing_bonus')
     ) THEN
    RAISE EXCEPTION 'A contraproposta contém campos inválidos.';
  END IF;

  BEGIN
    v_curr_wage := (v_offer.current_terms->>'monthly_wage')::INT;
    v_req_wage := (p_requested_terms->>'monthly_wage')::INT;
    v_curr_dur := (v_offer.current_terms->>'duration_seasons')::INT;
    v_req_dur := (p_requested_terms->>'duration_seasons')::INT;
    v_curr_release := (v_offer.current_terms->>'release_clause')::INT;
    v_req_release := (p_requested_terms->>'release_clause')::INT;
    v_curr_role := v_offer.current_terms->>'squad_role';
    v_req_role := p_requested_terms->>'squad_role';
    v_curr_bonus := COALESCE((v_offer.current_terms->>'signing_bonus')::INT, 0);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Os valores numéricos da negociação são inválidos.';
  END;

  IF v_curr_wage IS NULL OR v_curr_wage <= 0 OR v_curr_release IS NULL OR v_curr_release <= 0 THEN
    RAISE EXCEPTION 'A oferta atual possui valores inválidos e precisa ser revisada.';
  END IF;
  IF v_req_wage IS NULL OR v_req_wage <= 0 THEN RAISE EXCEPTION 'Salário deve ser maior que zero.'; END IF;
  IF v_req_release IS NULL OR v_req_release <= 0 THEN RAISE EXCEPTION 'Multa rescisória deve ser maior que zero.'; END IF;
  IF v_req_dur IS NULL OR v_req_dur < 1 OR v_req_dur > 3 THEN RAISE EXCEPTION 'Duração deve ser de 1 a 3 temporadas.'; END IF;
  IF v_curr_bonus < 0 THEN RAISE EXCEPTION 'A oferta atual possui bônus de assinatura inválido.'; END IF;
  IF NOT (v_role_levels ? v_req_role) OR NOT (v_role_levels ? v_curr_role) THEN RAISE EXCEPTION 'Função no elenco inválida.'; END IF;

  v_requested_terms := jsonb_build_object(
    'monthly_wage', v_req_wage,
    'duration_seasons', v_req_dur,
    'release_clause', v_req_release,
    'squad_role', v_req_role,
    'signing_bonus', v_curr_bonus
  );

  IF v_req_wage > v_curr_wage THEN
    v_cost := v_cost + ROUND(((v_req_wage::NUMERIC / v_curr_wage::NUMERIC) - 1.0) * 80)::INT;
  ELSIF v_req_wage < v_curr_wage THEN
    v_cost := v_cost - ROUND(((v_curr_wage::NUMERIC / v_req_wage::NUMERIC) - 1.0) * 40)::INT;
  END IF;

  IF v_req_release < v_curr_release THEN
    v_cost := v_cost + ROUND(((v_curr_release::NUMERIC / v_req_release::NUMERIC) - 1.0) * 60)::INT;
  ELSIF v_req_release > v_curr_release THEN
    v_cost := v_cost - ROUND(((v_req_release::NUMERIC / v_curr_release::NUMERIC) - 1.0) * 30)::INT;
  END IF;

  v_role_diff := (v_role_levels->>v_req_role)::INT - (v_role_levels->>v_curr_role)::INT;
  IF v_role_diff > 0 THEN v_cost := v_cost + (v_role_diff * 25);
  ELSIF v_role_diff < 0 THEN v_cost := v_cost + (v_role_diff * 15); END IF;

  IF v_req_dur < v_curr_dur THEN v_cost := v_cost + ((v_curr_dur - v_req_dur) * 5);
  ELSIF v_req_dur > v_curr_dur THEN v_cost := v_cost - ((v_req_dur - v_curr_dur) * 5); END IF;

  v_cost := GREATEST(0, v_cost);
  v_flex_rem := GREATEST(0, COALESCE(v_offer.internal_tolerance, 0));

  IF v_cost = 0 THEN
    v_response_action := 'accepted';
    v_club_stance := 'flexível';
    v_response_terms := v_requested_terms;
    v_message := 'O clube aceitou seus termos. Revise e assine o contrato para concluir.';
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
    v_flex_rem := GREATEST(0, v_flex_rem - v_cost);
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

  INSERT INTO public.player_offer_history (
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

REVOKE EXECUTE ON FUNCTION public.negotiate_offer(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.negotiate_offer(UUID, JSONB) TO authenticated;
