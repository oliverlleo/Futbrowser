CREATE OR REPLACE FUNCTION public.generate_initial_offers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_player_id UUID;
  v_club RECORD;
  v_context JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT j.id INTO v_player_id
  FROM public.jogadores j
  WHERE j.user_id = v_user_id;

  IF v_player_id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_contracts pc
    WHERE pc.player_id = v_player_id AND pc.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Jogador já possui contrato';
  END IF;

  FOR v_club IN
    SELECT c.*
    FROM public.base_clubs c
    WHERE c.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.player_offers po
        WHERE po.player_id = v_player_id
          AND po.club_id = c.id
      )
    ORDER BY c.reputation DESC, c.name
  LOOP
    v_context := private.build_offer_context(v_player_id, v_club.id);

    INSERT INTO public.player_offers(
      player_id, club_id, initial_terms, current_terms, status,
      internal_tolerance, compatibility_breakdown, snapshot_data, is_emergency
    ) VALUES (
      v_player_id,
      v_club.id,
      v_club.base_terms,
      v_club.base_terms,
      'new',
      (v_context->>'internal_tolerance')::INT,
      v_context->'compatibility_breakdown',
      v_context->'snapshot_data',
      false
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_initial_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_initial_offers() TO authenticated;
