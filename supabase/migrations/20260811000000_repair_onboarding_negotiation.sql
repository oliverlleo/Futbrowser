-- Futbrowser — reparo definitivo do onboarding/negociação
-- Data: 2026-08-11
-- Objetivos:
-- 1) alinhar schema com o frontend (posicao_secundaria);
-- 2) eliminar duplicidade legada de jogadores e impedir recorrência;
-- 3) recuperar ofertas marcadas como aceitas sem contrato;
-- 4) impedir quarta rodada e entradas inválidas na negociação;
-- 5) impedir que negociar marque contrato como assinado;
-- 6) garantir oferta emergencial mesmo antes de existir player_career_state.

BEGIN;

ALTER TABLE public.jogadores
  ADD COLUMN IF NOT EXISTS posicao_secundaria TEXT;

DO $$
DECLARE
  v_user_id UUID;
  v_keep_player_id UUID;
BEGIN
  FOR v_user_id IN
    SELECT user_id
    FROM public.jogadores
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT j.id
      INTO v_keep_player_id
    FROM public.jogadores j
    WHERE j.user_id = v_user_id
    ORDER BY
      EXISTS (
        SELECT 1
        FROM public.player_contracts pc
        WHERE pc.player_id = j.id AND pc.status = 'active'
      ) DESC,
      EXISTS (
        SELECT 1
        FROM public.player_career_state pcs
        WHERE pcs.player_id = j.id AND pcs.onboarding_completed = true
      ) DESC,
      (
        SELECT COUNT(*)
        FROM public.player_offers po
        WHERE po.player_id = j.id
      ) DESC,
      j.created_at ASC NULLS LAST,
      j.id
    LIMIT 1;

    DELETE FROM public.jogadores
    WHERE user_id = v_user_id
      AND id <> v_keep_player_id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jogadores_unique_user_id
  ON public.jogadores(user_id);

UPDATE public.player_offers po
SET status = 'countered'
WHERE po.status = 'accepted'
  AND NOT EXISTS (
    SELECT 1
    FROM public.player_contracts pc
    WHERE pc.player_id = po.player_id
      AND pc.status = 'active'
  );

UPDATE public.player_offers
SET internal_tolerance = 1
WHERE is_emergency = true
  AND internal_tolerance <= 0
  AND status IN ('new', 'reviewed', 'negotiating', 'countered');

DROP FUNCTION IF EXISTS public.negotiate_offer(UUID, JSONB);
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
  v_req_bonus INT;
  v_role_diff INT;

  v_response_action TEXT;
  v_club_stance TEXT;
  v_response_terms JSONB;
  v_message TEXT;
  v_role_levels JSONB := '{"Promessa":1,"Reserva":2,"Rotação":3,"Titular":4,"Estrela":5}'::JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT po.*
    INTO v_offer
  FROM public.player_offers po
  JOIN public.jogadores j ON j.id = po.player_id
  WHERE po.id = p_offer_id
    AND j.user_id = v_user_id
  FOR UPDATE OF po;

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN
    RAISE EXCEPTION 'A negociação para este clube já foi encerrada.';
  END IF;

  IF v_offer.round >= 3 THEN
    RAISE EXCEPTION 'Número máximo de rodadas de negociação atingido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_contracts pc
    WHERE pc.player_id = v_offer.player_id
      AND pc.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Jogador já possui contrato ativo.';
  END IF;

  IF p_requested_terms IS NULL OR jsonb_typeof(p_requested_terms) <> 'object' THEN
    RAISE EXCEPTION 'Termos de negociação inválidos.';
  END IF;

  IF (SELECT COUNT(*) FROM jsonb_object_keys(p_requested_terms)) <> 5
     OR NOT p_requested_terms ? 'monthly_wage'
     OR NOT p_requested_terms ? 'duration_seasons'
     OR NOT p_requested_terms ? 'release_clause'
     OR NOT p_requested_terms ? 'squad_role'
     OR NOT p_requested_terms ? 'signing_bonus' THEN
    RAISE EXCEPTION 'O JSON deve conter exatamente as 5 chaves de negociação.';
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
    v_curr_bonus := (v_offer.current_terms->>'signing_bonus')::INT;
    v_req_bonus := (p_requested_terms->>'signing_bonus')::INT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Os valores numéricos da negociação são inválidos.';
  END;

  IF v_curr_wage IS NULL OR v_curr_wage <= 0
     OR v_curr_release IS NULL OR v_curr_release <= 0 THEN
    RAISE EXCEPTION 'A oferta atual possui valores inválidos e precisa ser revisada.';
  END IF;

  IF v_req_wage IS NULL OR v_req_wage <= 0 THEN
    RAISE EXCEPTION 'Salário deve ser maior que zero.';
  END IF;

  IF v_req_release IS NULL OR v_req_release <= 0 THEN
    RAISE EXCEPTION 'Multa rescisória deve ser maior que zero.';
  END IF;

  IF v_req_dur IS NULL OR v_req_dur < 1 OR v_req_dur > 3 THEN
    RAISE EXCEPTION 'Duração deve ser de 1 a 3 temporadas.';
  END IF;

  IF v_req_bonus IS NULL OR v_req_bonus < 0 THEN
    RAISE EXCEPTION 'Bônus de assinatura inválido.';
  END IF;

  IF v_req_bonus <> COALESCE(v_curr_bonus, 0) THEN
    RAISE EXCEPTION 'O bônus de assinatura não é negociável nesta etapa.';
  END IF;

  IF NOT (v_role_levels ? v_req_role) OR NOT (v_role_levels ? v_curr_role) THEN
    RAISE EXCEPTION 'Função no elenco inválida.';
  END IF;

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

  v_cost := GREATEST(0, v_cost);

  SELECT COALESCE(
    (
      SELECT poh.remaining_flexibility
      FROM public.player_offer_history poh
      WHERE poh.offer_id = p_offer_id
      ORDER BY poh.round DESC
      LIMIT 1
    ),
    v_offer.internal_tolerance
  )
  INTO v_flex_rem;

  v_flex_rem := GREATEST(0, COALESCE(v_flex_rem, 0));

  IF v_cost = 0 THEN
    v_response_action := 'accepted';
    v_club_stance := 'flexível';
    v_response_terms := p_requested_terms;
    v_message := 'O clube aceitou seus termos. Revise e assine o contrato para concluir.';
  ELSIF v_cost <= v_flex_rem THEN
    v_response_action := 'countered';
    v_club_stance := 'cauteloso';
    v_response_terms := jsonb_build_object(
      'monthly_wage', (v_curr_wage::NUMERIC + ((v_req_wage::NUMERIC - v_curr_wage::NUMERIC) / 2))::INT,
      'duration_seasons', v_curr_dur,
      'release_clause', v_curr_release,
      'squad_role', v_curr_role,
      'signing_bonus', COALESCE(v_curr_bonus, 0)
    );
    v_flex_rem := GREATEST(0, v_flex_rem - v_cost);
    v_message := 'O clube fez uma contraproposta.';
  ELSE
    v_response_action := 'withdrawn';
    v_club_stance := 'intransigente';
    v_response_terms := v_offer.current_terms;
    v_flex_rem := 0;
    v_message := 'O clube encerrou as negociações após considerar as exigências excessivas.';
  END IF;

  v_round := v_offer.round + 1;

  INSERT INTO public.player_offer_history (
    offer_id,
    round,
    requested_terms,
    response_action,
    club_response_terms,
    previous_terms,
    negotiation_cost,
    remaining_flexibility,
    before_stance,
    after_stance
  ) VALUES (
    p_offer_id,
    v_round,
    p_requested_terms,
    v_response_action,
    v_response_terms,
    v_offer.current_terms,
    v_cost,
    v_flex_rem,
    CASE
      WHEN v_offer.status = 'countered' THEN 'cauteloso'
      ELSE 'interessado'
    END,
    v_club_stance
  );

  IF v_response_action = 'withdrawn' THEN
    UPDATE public.player_offers
    SET status = 'withdrawn',
        round = v_round
    WHERE id = p_offer_id;
  ELSE
    UPDATE public.player_offers
    SET status = 'countered',
        current_terms = v_response_terms,
        round = v_round
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

DROP FUNCTION IF EXISTS public.reject_offer(UUID);
CREATE OR REPLACE FUNCTION public.reject_offer(
  p_offer_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_offer RECORD;
  v_active_count INT;
  v_worst_club RECORD;
  v_emergency_created BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT po.*
    INTO v_offer
  FROM public.player_offers po
  JOIN public.jogadores j ON j.id = po.player_id
  WHERE po.id = p_offer_id
    AND j.user_id = v_user_id
  FOR UPDATE OF po;

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered') THEN
    RAISE EXCEPTION 'Apenas ofertas ativas podem ser recusadas.';
  END IF;

  UPDATE public.player_offers
  SET status = 'rejected'
  WHERE id = p_offer_id;

  SELECT COUNT(*)
    INTO v_active_count
  FROM public.player_offers
  WHERE player_id = v_offer.player_id
    AND status IN ('new', 'reviewed', 'negotiating', 'countered');

  IF v_active_count = 0
     AND NOT EXISTS (
       SELECT 1
       FROM public.player_offers
       WHERE player_id = v_offer.player_id
         AND is_emergency = true
     ) THEN

    SELECT *
      INTO v_worst_club
    FROM public.base_clubs
    WHERE is_active = true
    ORDER BY reputation ASC, name ASC
    LIMIT 1;

    IF v_worst_club.id IS NULL THEN
      RAISE EXCEPTION 'Nenhum clube ativo disponível para oferta emergencial.';
    END IF;

    INSERT INTO public.player_offers (
      player_id,
      club_id,
      initial_terms,
      current_terms,
      status,
      internal_tolerance,
      compatibility_breakdown,
      snapshot_data,
      is_emergency
    ) VALUES (
      v_offer.player_id,
      v_worst_club.id,
      jsonb_build_object(
        'duration_seasons', 3,
        'monthly_wage', GREATEST(1, ROUND((v_worst_club.base_terms->>'monthly_wage')::NUMERIC * 0.8)::INT),
        'signing_bonus', 0,
        'release_clause', 10000,
        'squad_role', 'Promessa'
      ),
      jsonb_build_object(
        'duration_seasons', 3,
        'monthly_wage', GREATEST(1, ROUND((v_worst_club.base_terms->>'monthly_wage')::NUMERIC * 0.8)::INT),
        'signing_bonus', 0,
        'release_clause', 10000,
        'squad_role', 'Promessa'
      ),
      'new',
      1,
      '{}'::JSONB,
      jsonb_build_object('emergency', true, 'club_reputation', v_worst_club.reputation),
      true
    );

    v_emergency_created := true;

    UPDATE public.player_career_state
    SET emergency_offer_generated = true,
        updated_at = NOW()
    WHERE player_id = v_offer.player_id;
  END IF;

  SELECT COUNT(*)
    INTO v_active_count
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

COMMIT;
