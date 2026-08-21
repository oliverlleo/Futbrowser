CREATE OR REPLACE FUNCTION public.get_career_onboarding_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_player_count INT := 0;
  v_player_id UUID;
  v_has_player BOOLEAN := false;
  v_offers_generated BOOLEAN := false;
  v_active_offers INT := 0;
  v_contract_signed BOOLEAN := false;
  v_onboarding_completed BOOLEAN := false;
  v_expected_clubs INT := 0;
  v_generated_offer_clubs INT := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

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
      AND status IN ('new', 'reviewed', 'negotiating', 'countered');

    SELECT EXISTS (
      SELECT 1 FROM public.player_contracts
      WHERE player_id = v_player_id AND status = 'active'
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

REVOKE EXECUTE ON FUNCTION public.get_career_onboarding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_onboarding_state() TO authenticated;
