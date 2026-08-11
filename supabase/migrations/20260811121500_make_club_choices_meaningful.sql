-- Futbrowser — tornar escolhas de clube/treinador realmente diferentes
-- Mantém a interface atual e corrige apenas dados/cálculos que alimentam a tela de ofertas.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.formation_slots(
  p_formation TEXT,
  p_position TEXT
) RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_formation
    WHEN '4-3-3' THEN CASE p_position
      WHEN 'Goleiro' THEN 1
      WHEN 'Zagueiro' THEN 2
      WHEN 'Lateral Direito' THEN 1
      WHEN 'Lateral Esquerdo' THEN 1
      WHEN 'Volante' THEN 1
      WHEN 'Meio-Campo' THEN 2
      WHEN 'Meia' THEN 2
      WHEN 'Ponta Direita' THEN 1
      WHEN 'Ponta Esquerda' THEN 1
      WHEN 'Atacante' THEN 1
      ELSE 0 END
    WHEN '4-2-3-1' THEN CASE p_position
      WHEN 'Goleiro' THEN 1
      WHEN 'Zagueiro' THEN 2
      WHEN 'Lateral Direito' THEN 1
      WHEN 'Lateral Esquerdo' THEN 1
      WHEN 'Volante' THEN 2
      WHEN 'Meio-Campo' THEN 1
      WHEN 'Meia' THEN 1
      WHEN 'Ponta Direita' THEN 1
      WHEN 'Ponta Esquerda' THEN 1
      WHEN 'Atacante' THEN 1
      ELSE 0 END
    WHEN '4-4-2' THEN CASE p_position
      WHEN 'Goleiro' THEN 1
      WHEN 'Zagueiro' THEN 2
      WHEN 'Lateral Direito' THEN 1
      WHEN 'Lateral Esquerdo' THEN 1
      WHEN 'Meio-Campo' THEN 2
      WHEN 'Meia' THEN 2
      WHEN 'Meia Esquerda' THEN 1
      WHEN 'Meia Direita' THEN 1
      WHEN 'Atacante' THEN 2
      ELSE 0 END
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION private.formation_slots(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Perfis com bônus, ônus e tolerância legíveis pela interface que já existe.
UPDATE public.base_coaches
SET impacts = CASE name
  WHEN 'Henrique Paiva' THEN jsonb_build_object(
    'preferred_style', 'Posse de bola',
    'preferred_archetype', 'Criador',
    'preferred_formation', '4-3-3',
    'tolerance_to_bad_games', 'low',
    'technical_evolution_bonus', 12,
    'tactical_evolution_bonus', 8,
    'physical_evolution_penalty', -5
  )
  WHEN 'Marcelo Ferraz' THEN jsonb_build_object(
    'preferred_style', 'Ofensivo',
    'preferred_archetype', 'Finalizador',
    'preferred_formation', '4-3-3',
    'tolerance_to_bad_games', 'low',
    'physical_evolution_bonus', 10,
    'general_evolution_bonus', 8,
    'morale_penalty_on_failure', -12
  )
  WHEN 'Sérgio Almeida' THEN jsonb_build_object(
    'preferred_style', 'Equilibrado',
    'preferred_archetype', 'Raçudo',
    'preferred_formation', '4-4-2',
    'tolerance_to_bad_games', 'medium',
    'tactical_evolution_bonus', 15,
    'positioning_vision_decision_bonus', 12,
    'creative_freedom_penalty', -8
  )
  WHEN 'Eduardo Braga' THEN jsonb_build_object(
    'preferred_style', 'Pelas alas',
    'preferred_archetype', 'Driblador',
    'preferred_formation', '4-2-3-1',
    'tolerance_to_bad_games', 'medium',
    'general_evolution_bonus', 6,
    'morale_initial_bonus', 3,
    'recovery_pct_bonus', 5,
    'physical_evolution_penalty', -2
  )
  WHEN 'Bruno Salles' THEN jsonb_build_object(
    'preferred_style', 'Contra-ataque',
    'preferred_archetype', 'Driblador',
    'preferred_formation', '4-2-3-1',
    'tolerance_to_bad_games', 'high',
    'morale_initial_bonus', 8,
    'recovery_pct_bonus', 10,
    'general_evolution_bonus', 4,
    'technical_evolution_bonus', -3
  )
  ELSE impacts
END;

-- Faz o status de titular do elenco IA obedecer à formação de cada clube.
WITH ranked AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.club_id, p.primary_position
      ORDER BY p.ovr DESC, p.id
    ) AS rn,
    private.formation_slots(c.formation, p.primary_position) AS slots
  FROM public.base_ai_players p
  JOIN public.base_clubs c ON c.id = p.club_id
)
UPDATE public.base_ai_players p
SET is_starter = (ranked.slots > 0 AND ranked.rn <= ranked.slots)
FROM ranked
WHERE ranked.id = p.id;

CREATE OR REPLACE FUNCTION private.build_offer_context(
  p_player_id UUID,
  p_club_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player RECORD;
  v_club RECORD;
  v_coach RECORD;
  v_player_ovr INT;
  v_club_ovr INT;
  v_position TEXT;
  v_slots INT;
  v_competitor_count INT;
  v_starters_competing INT;
  v_subs_competing INT;
  v_lowest_starter_ovr INT;
  v_comp_score INT;
  v_position_score INT;
  v_coach_score INT;
  v_style_score INT;
  v_archetype_score INT;
  v_level_fit INT;
  v_interest INT;
  v_tolerance_modifier INT;
  v_internal_tolerance INT;
  v_chance TEXT;
  v_hierarchy TEXT;
  v_competition_level TEXT;
  v_positive JSONB := '[]'::JSONB;
  v_negative JSONB := '[]'::JSONB;
BEGIN
  SELECT j.* INTO v_player
  FROM public.jogadores j
  WHERE j.id = p_player_id;

  IF v_player.id IS NULL THEN
    RAISE EXCEPTION 'Jogador não encontrado.';
  END IF;

  SELECT c.* INTO v_club
  FROM public.base_clubs c
  WHERE c.id = p_club_id AND c.is_active = true;

  IF v_club.id IS NULL THEN
    RAISE EXCEPTION 'Clube não encontrado.';
  END IF;

  SELECT bc.* INTO v_coach
  FROM public.base_coaches bc
  WHERE bc.id = v_club.coach_id;

  v_player_ovr := public.calculate_player_ovr(v_player.atributos);
  SELECT COALESCE(ROUND(AVG(p.ovr))::INT, 50)
    INTO v_club_ovr
  FROM public.base_ai_players p
  WHERE p.club_id = v_club.id;

  v_position := v_player.posicao;
  v_slots := private.formation_slots(v_club.formation, v_position);

  IF v_slots = 0 AND v_player.posicao_secundaria IS NOT NULL THEN
    IF private.formation_slots(v_club.formation, v_player.posicao_secundaria) > 0 THEN
      v_position := v_player.posicao_secundaria;
      v_slots := private.formation_slots(v_club.formation, v_position);
      v_positive := v_positive || to_jsonb('Sua posição secundária encaixa na formação'::TEXT);
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_competitor_count
  FROM public.base_ai_players p
  WHERE p.club_id = v_club.id
    AND (p.primary_position = v_position OR p.secondary_position = v_position);

  IF v_slots > 0 THEN
    SELECT MIN(x.ovr)
      INTO v_lowest_starter_ovr
    FROM (
      SELECT p.ovr
      FROM public.base_ai_players p
      WHERE p.club_id = v_club.id
        AND (p.primary_position = v_position OR p.secondary_position = v_position)
      ORDER BY p.ovr DESC, p.id
      LIMIT v_slots
    ) x;
  END IF;

  v_starters_competing := LEAST(GREATEST(v_slots, 0), v_competitor_count);
  v_subs_competing := GREATEST(0, v_competitor_count - v_starters_competing);
  v_lowest_starter_ovr := COALESCE(v_lowest_starter_ovr, v_player_ovr);

  IF v_slots = 0 THEN
    v_comp_score := 10;
    v_position_score := 10;
    v_negative := v_negative || to_jsonb('Sua posição não tem vaga natural no esquema'::TEXT);
  ELSE
    v_comp_score := GREATEST(10, LEAST(100,
      100 - (GREATEST(0, v_lowest_starter_ovr - v_player_ovr) * 4)
    ));

    v_position_score := CASE
      WHEN v_competitor_count < v_slots THEN 100
      WHEN v_competitor_count = v_slots THEN 80
      WHEN v_competitor_count = v_slots + 1 THEN 65
      ELSE 45
    END;
  END IF;

  v_coach_score := 45;
  IF v_coach.impacts->>'preferred_archetype' = v_player.arquetipo THEN
    v_coach_score := v_coach_score + 35;
    v_positive := v_positive || to_jsonb('Arquétipo preferido do treinador'::TEXT);
  ELSE
    v_negative := v_negative || to_jsonb('Arquétipo fora da preferência do treinador'::TEXT);
  END IF;

  IF v_coach.impacts->>'preferred_style' = v_club.play_style THEN
    v_coach_score := v_coach_score + 10;
  END IF;
  IF v_coach.impacts->>'preferred_formation' = v_club.formation THEN
    v_coach_score := v_coach_score + 10;
  END IF;
  v_coach_score := LEAST(100, v_coach_score);

  v_style_score := CASE v_player.arquetipo
    WHEN 'Driblador' THEN CASE v_club.play_style
      WHEN 'Pelas alas' THEN 95
      WHEN 'Posse de bola' THEN 90
      WHEN 'Ofensivo' THEN 85
      WHEN 'Contra-ataque' THEN 80
      WHEN 'Equilibrado' THEN 70
      ELSE 60 END
    WHEN 'Finalizador' THEN CASE v_club.play_style
      WHEN 'Ofensivo' THEN 100
      WHEN 'Contra-ataque' THEN 90
      WHEN 'Equilibrado' THEN 80
      WHEN 'Pelas alas' THEN 75
      WHEN 'Posse de bola' THEN 70
      ELSE 60 END
    WHEN 'Criador' THEN CASE v_club.play_style
      WHEN 'Posse de bola' THEN 100
      WHEN 'Equilibrado' THEN 90
      WHEN 'Pelas alas' THEN 85
      WHEN 'Ofensivo' THEN 80
      WHEN 'Contra-ataque' THEN 65
      ELSE 60 END
    WHEN 'Raçudo' THEN CASE v_club.play_style
      WHEN 'Equilibrado' THEN 95
      WHEN 'Contra-ataque' THEN 85
      WHEN 'Ofensivo' THEN 85
      WHEN 'Pelas alas' THEN 75
      WHEN 'Posse de bola' THEN 70
      ELSE 60 END
    ELSE 60
  END;

  IF v_position LIKE 'Ponta%' OR v_position LIKE 'Lateral%' THEN
    IF v_club.play_style = 'Pelas alas' THEN v_style_score := LEAST(100, v_style_score + 5); END IF;
  ELSIF v_position = 'Atacante' THEN
    IF v_club.play_style IN ('Ofensivo', 'Contra-ataque') THEN v_style_score := LEAST(100, v_style_score + 5); END IF;
  ELSIF v_position IN ('Meia', 'Meio-Campo') THEN
    IF v_club.play_style = 'Posse de bola' THEN v_style_score := LEAST(100, v_style_score + 5); END IF;
  END IF;

  IF v_style_score >= 85 THEN
    v_positive := v_positive || to_jsonb('Estilo de jogo favorece seu perfil'::TEXT);
  ELSIF v_style_score <= 70 THEN
    v_negative := v_negative || to_jsonb('Estilo de jogo pouco favorável ao seu perfil'::TEXT);
  END IF;

  v_archetype_score := ROUND((v_coach_score + v_style_score) / 2.0)::INT;
  v_level_fit := GREATEST(20, LEAST(100, 100 - (ABS(v_club_ovr - v_player_ovr) * 5)));

  v_interest := ROUND(
    (v_comp_score * 0.25) +
    (v_position_score * 0.20) +
    (v_coach_score * 0.20) +
    (v_style_score * 0.20) +
    (v_level_fit * 0.15) +
    ((6 - LEAST(5, GREATEST(1, v_club.reputation))) * 4)
  )::INT;
  v_interest := GREATEST(20, LEAST(100, v_interest));

  IF v_slots = 0 THEN
    v_chance := 'Baixa';
  ELSIF v_player_ovr >= v_lowest_starter_ovr THEN
    v_chance := 'Alta';
  ELSIF v_player_ovr >= v_lowest_starter_ovr - 8 THEN
    v_chance := 'Média';
  ELSE
    v_chance := 'Baixa';
  END IF;

  v_hierarchy := CASE v_chance
    WHEN 'Alta' THEN CASE WHEN v_interest >= 75 THEN 'Titular' ELSE 'Rotação' END
    WHEN 'Média' THEN 'Rotação'
    ELSE 'Reserva'
  END;

  v_competition_level := CASE
    WHEN v_slots = 0 THEN 'Alta'
    WHEN v_competitor_count >= v_slots + 2 THEN 'Alta'
    WHEN v_competitor_count = v_slots + 1 THEN 'Média'
    ELSE 'Baixa'
  END;

  IF v_chance = 'Alta' THEN
    v_positive := v_positive || to_jsonb('Chance imediata de disputar titularidade'::TEXT);
  ELSIF v_chance = 'Baixa' THEN
    v_negative := v_negative || to_jsonb('Concorrência inicial acima do seu nível'::TEXT);
  END IF;

  v_tolerance_modifier := CASE v_coach.impacts->>'tolerance_to_bad_games'
    WHEN 'high' THEN 15
    WHEN 'medium' THEN 5
    WHEN 'low' THEN -10
    ELSE 0
  END;

  v_internal_tolerance := ROUND(
    (v_interest * 0.45) +
    (v_club.flexibility * 0.70) +
    v_tolerance_modifier
  )::INT;
  v_internal_tolerance := GREATEST(15, LEAST(90, v_internal_tolerance));

  RETURN jsonb_build_object(
    'internal_tolerance', v_internal_tolerance,
    'compatibility_breakdown', jsonb_build_object(
      'total', v_interest,
      'compatibility_total', v_interest,
      'interest_score', v_interest,
      'competition_score', v_comp_score,
      'position_score', v_position_score,
      'archetype_score', v_archetype_score,
      'coach_score', v_coach_score,
      'style_score', v_style_score,
      'level_fit_score', v_level_fit,
      'positive_factors', v_positive,
      'negative_factors', v_negative
    ),
    'snapshot_data', jsonb_build_object(
      'club_overall', v_club_ovr,
      'club_ovr', v_club_ovr,
      'player_ovr', v_player_ovr,
      'formation', v_club.formation,
      'effective_position', v_position,
      'slots_needed', v_slots,
      'starters_competing', v_starters_competing,
      'subs_competing', v_subs_competing,
      'lowest_starter_ovr', v_lowest_starter_ovr,
      'estimated_hierarchy', v_hierarchy,
      'chance_of_play', v_chance,
      'competition_level', v_competition_level,
      'interest_score', v_interest
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.build_offer_context(UUID, UUID) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.generate_initial_offers();
CREATE OR REPLACE FUNCTION public.generate_initial_offers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_player_id UUID;
  v_club RECORD;
  v_context JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT j.id INTO v_player_id
  FROM public.jogadores j
  WHERE j.user_id = v_user_id;

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Jogador não encontrado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_contracts pc
    WHERE pc.player_id = v_player_id AND pc.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Jogador já possui contrato';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_offers po
    WHERE po.player_id = v_player_id
  ) THEN
    RETURN;
  END IF;

  FOR v_club IN
    SELECT * FROM public.base_clubs WHERE is_active = true ORDER BY reputation DESC, name
  LOOP
    v_context := private.build_offer_context(v_player_id, v_club.id);

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

-- Atualiza imediatamente as ofertas que já estão abertas, sem alterar contrato,
-- rodada, proposta atual ou histórico de negociação.
DO $$
DECLARE
  v_offer RECORD;
  v_context JSONB;
BEGIN
  FOR v_offer IN
    SELECT po.id, po.player_id, po.club_id
    FROM public.player_offers po
    WHERE po.status IN ('new', 'reviewed', 'negotiating', 'countered')
      AND po.is_emergency = false
  LOOP
    v_context := private.build_offer_context(v_offer.player_id, v_offer.club_id);

    UPDATE public.player_offers
    SET compatibility_breakdown = v_context->'compatibility_breakdown',
        snapshot_data = v_context->'snapshot_data',
        internal_tolerance = CASE
          WHEN round = 0 THEN (v_context->>'internal_tolerance')::INT
          ELSE internal_tolerance
        END
    WHERE id = v_offer.id;
  END LOOP;
END;
$$;
