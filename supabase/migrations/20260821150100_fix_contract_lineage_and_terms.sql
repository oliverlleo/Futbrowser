BEGIN;

CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_player_id uuid;
  v_offer public.player_offers%ROWTYPE;
  v_club public.base_clubs%ROWTYPE;
  v_coach public.base_coaches%ROWTYPE;
  v_academy public.base_academy_profiles%ROWTYPE;
  v_impacts jsonb;
  v_general int := 0;
  v_physical_pct int := 0;
  v_speed_pct int := 0;
  v_technical_pct int := 0;
  v_tactical_pct int := 0;
  v_recovery_pct int := 0;
  v_initial_morale int := 50;
  v_initial_trust int := 50;
  v_compatibility int := 0;
  v_signing_bonus int := 0;
  v_role text;
  v_evolution_modifiers jsonb;
  v_start_date date;
  v_end_date date;
  v_contract_kind text;
  v_duration_seasons int;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  SELECT j.id INTO v_player_id
  FROM public.jogadores j
  WHERE j.user_id = v_user_id;
  IF v_player_id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;

  SELECT po.* INTO v_offer
  FROM public.player_offers po
  WHERE po.id = p_offer_id
    AND po.player_id = v_player_id
  FOR UPDATE;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
  IF v_offer.status NOT IN ('new', 'reviewed', 'negotiating', 'countered', 'accepted') THEN
    RAISE EXCEPTION 'Oferta indisponível para assinatura.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_contracts pc
    WHERE pc.player_id = v_player_id
      AND pc.status = 'active'
  ) THEN
    RAISE EXCEPTION 'O jogador já possui um contrato ativo.';
  END IF;

  IF COALESCE((v_offer.current_terms->>'monthly_wage')::int, 0) <= 0
     OR COALESCE((v_offer.current_terms->>'duration_seasons')::int, 0) NOT BETWEEN 1 AND 3
     OR COALESCE((v_offer.current_terms->>'release_clause')::int, 0) <= 0
     OR COALESCE((v_offer.current_terms->>'signing_bonus')::int, -1) < 0
     OR COALESCE(v_offer.current_terms->>'squad_role', '') = '' THEN
    RAISE EXCEPTION 'A oferta atual possui termos inválidos.';
  END IF;

  v_duration_seasons := (v_offer.current_terms->>'duration_seasons')::int;
  v_signing_bonus := (v_offer.current_terms->>'signing_bonus')::int;
  v_role := v_offer.current_terms->>'squad_role';
  v_initial_trust := CASE v_role
    WHEN 'Promessa' THEN 40
    WHEN 'Reserva' THEN 48
    WHEN 'Rotação' THEN 58
    WHEN 'Titular' THEN 70
    WHEN 'Estrela' THEN 80
    ELSE 50
  END;

  SELECT * INTO v_club
  FROM public.base_clubs
  WHERE id = v_offer.club_id;
  IF v_club.id IS NULL THEN RAISE EXCEPTION 'Clube da oferta não encontrado.'; END IF;

  SELECT * INTO v_coach
  FROM public.base_coaches
  WHERE id = v_club.coach_id;
  IF v_coach.id IS NULL THEN RAISE EXCEPTION 'Treinador do clube não encontrado.'; END IF;

  SELECT * INTO v_academy
  FROM public.base_academy_profiles
  WHERE club_id = v_club.id;
  IF v_academy.id IS NULL THEN RAISE EXCEPTION 'Academia do clube não encontrada.'; END IF;

  v_start_date := COALESCE(
    v_offer.effective_on,
    (SELECT pcs.career_date FROM public.player_career_state pcs WHERE pcs.player_id = v_player_id),
    current_date
  );
  v_end_date := (v_start_date + make_interval(years => v_duration_seasons))::date;
  v_contract_kind := CASE WHEN v_club.club_level = 'professional' THEN 'professional' ELSE 'academy' END;

  v_impacts := COALESCE(v_coach.impacts, '{}'::jsonb);
  v_general := COALESCE((v_impacts->>'general_evolution_bonus')::int, 0);
  v_physical_pct := CASE v_academy.physical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 WHEN 5 THEN 12 ELSE 0 END
    + v_general
    + COALESCE((v_impacts->>'physical_evolution_bonus')::int, 0)
    + COALESCE((v_impacts->>'physical_evolution_penalty')::int, 0);
  v_speed_pct := CASE v_academy.speed WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 WHEN 5 THEN 12 ELSE 0 END + v_general;
  v_technical_pct := CASE v_academy.technical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 WHEN 5 THEN 12 ELSE 0 END
    + v_general + COALESCE((v_impacts->>'technical_evolution_bonus')::int, 0);
  v_tactical_pct := CASE v_academy.tactical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 WHEN 5 THEN 12 ELSE 0 END
    + v_general + COALESCE((v_impacts->>'tactical_evolution_bonus')::int, 0);
  v_recovery_pct := CASE v_academy.recovery WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 5 WHEN 4 THEN 10 WHEN 5 THEN 15 ELSE 0 END
    + COALESCE((v_impacts->>'recovery_pct_bonus')::int, 0);
  v_initial_morale := GREATEST(0, LEAST(100, 50 + COALESCE((v_impacts->>'morale_initial_bonus')::int, 0)));
  v_compatibility := GREATEST(0, LEAST(100, COALESCE(
    (v_offer.compatibility_breakdown->>'total')::int,
    (v_offer.compatibility_breakdown->>'compatibility_total')::int,
    0
  )));

  v_evolution_modifiers := jsonb_build_object(
    'Físico', v_physical_pct,
    'Velocidade', v_speed_pct,
    'Passe', v_technical_pct,
    'Finalização', v_technical_pct,
    'Marcação', v_tactical_pct,
    'Visão de jogo', v_tactical_pct,
    'physical_pct', v_physical_pct,
    'speed_pct', v_speed_pct,
    'technical_pct', v_technical_pct,
    'tactical_pct', v_tactical_pct,
    'academy', jsonb_build_object(
      'physical', v_academy.physical,
      'speed', v_academy.speed,
      'technical', v_academy.technical,
      'recovery', v_academy.recovery,
      'tactical', v_academy.tactical
    ),
    'coach_impacts', v_impacts
  );

  UPDATE public.player_offers
  SET status = 'withdrawn'
  WHERE player_id = v_player_id
    AND id <> p_offer_id
    AND status IN ('new', 'reviewed', 'negotiating', 'countered');

  UPDATE public.player_offers
  SET status = 'accepted'
  WHERE id = p_offer_id;

  INSERT INTO public.player_contracts (
    player_id,
    club_id,
    duration_seasons,
    monthly_wage,
    signing_bonus,
    release_clause,
    squad_role,
    source_offer_id,
    contract_kind,
    starts_on,
    ends_on,
    status
  ) VALUES (
    v_player_id,
    v_offer.club_id,
    v_duration_seasons,
    (v_offer.current_terms->>'monthly_wage')::int,
    v_signing_bonus,
    (v_offer.current_terms->>'release_clause')::int,
    v_role,
    v_offer.id,
    v_contract_kind,
    v_start_date,
    v_end_date,
    'active'
  );

  INSERT INTO public.player_career_state (
    player_id, club_id, coach_id, trust, morale, energy, hierarchy,
    compatibility, evolution_modifiers, recovery_modifier,
    onboarding_completed, pending_initial_balance,
    financial_credit_applied, emergency_offer_generated, updated_at
  ) VALUES (
    v_player_id, v_offer.club_id, v_club.coach_id,
    v_initial_trust, v_initial_morale, 100,
    v_role, v_compatibility, v_evolution_modifiers, v_recovery_pct,
    true, v_signing_bonus, false, false, now()
  )
  ON CONFLICT (player_id) DO UPDATE SET
    club_id = EXCLUDED.club_id,
    coach_id = EXCLUDED.coach_id,
    trust = EXCLUDED.trust,
    morale = EXCLUDED.morale,
    energy = EXCLUDED.energy,
    hierarchy = EXCLUDED.hierarchy,
    compatibility = EXCLUDED.compatibility,
    evolution_modifiers = EXCLUDED.evolution_modifiers,
    recovery_modifier = EXCLUDED.recovery_modifier,
    onboarding_completed = true,
    pending_initial_balance = EXCLUDED.pending_initial_balance,
    financial_credit_applied = false,
    emergency_offer_generated = false,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.accept_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(uuid) TO authenticated;

WITH candidates AS (
  SELECT
    pc.id AS contract_id,
    po.id AS offer_id,
    row_number() OVER (
      PARTITION BY pc.id
      ORDER BY po.created_at DESC, po.id
    ) AS rn
  FROM public.player_contracts pc
  JOIN public.player_offers po
    ON po.player_id = pc.player_id
   AND po.club_id = pc.club_id
   AND po.status = 'accepted'
   AND (po.current_terms->>'monthly_wage')::int = pc.monthly_wage
   AND (po.current_terms->>'duration_seasons')::int = pc.duration_seasons
   AND (po.current_terms->>'release_clause')::int = pc.release_clause
   AND (po.current_terms->>'squad_role') = pc.squad_role
  WHERE pc.status = 'active'
    AND pc.source_offer_id IS NULL
)
UPDATE public.player_contracts pc
SET source_offer_id = candidates.offer_id
FROM candidates
WHERE candidates.rn = 1
  AND pc.id = candidates.contract_id;

COMMIT;
