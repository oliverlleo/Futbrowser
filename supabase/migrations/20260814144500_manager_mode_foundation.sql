BEGIN;

CREATE TABLE IF NOT EXISTS public.manager_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 40),
  nationality text NOT NULL CHECK (char_length(trim(nationality)) BETWEEN 2 AND 60),
  profile_type text NOT NULL CHECK (profile_type IN ('estrategico','gestor','desenvolvedor','disciplinador')),
  reputation integer NOT NULL DEFAULT 10 CHECK (reputation BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manager_careers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_profile_id uuid NOT NULL UNIQUE REFERENCES public.manager_profiles(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding','active','fired','resigned')),
  career_date date NOT NULL DEFAULT current_date,
  board_confidence integer NOT NULL DEFAULT 55 CHECK (board_confidence BETWEEN 0 AND 100),
  locker_room_support integer NOT NULL DEFAULT 50 CHECK (locker_room_support BETWEEN 0 AND 100),
  fan_approval integer NOT NULL DEFAULT 50 CHECK (fan_approval BETWEEN 0 AND 100),
  media_pressure integer NOT NULL DEFAULT 25 CHECK (media_pressure BETWEEN 0 AND 100),
  transfer_budget bigint NOT NULL DEFAULT 0 CHECK (transfer_budget >= 0),
  wage_budget bigint NOT NULL DEFAULT 0 CHECK (wage_budget >= 0),
  wage_committed bigint NOT NULL DEFAULT 0 CHECK (wage_committed >= 0),
  formation text NOT NULL DEFAULT '4-3-3',
  play_style text NOT NULL DEFAULT 'Equilibrado',
  training_focus text NOT NULL DEFAULT 'Equilibrado',
  training_intensity text NOT NULL DEFAULT 'Normal' CHECK (training_intensity IN ('Leve','Normal','Alta')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_manager_careers_club ON public.manager_careers(club_id);

CREATE TABLE IF NOT EXISTS public.manager_squad_state (
  career_id uuid NOT NULL REFERENCES public.manager_careers(id) ON DELETE CASCADE,
  base_player_id uuid NOT NULL REFERENCES public.base_ai_players(id) ON DELETE RESTRICT,
  club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  age integer NOT NULL CHECK (age BETWEEN 15 AND 45),
  primary_position text NOT NULL,
  secondary_position text,
  ovr integer NOT NULL CHECK (ovr BETWEEN 1 AND 99),
  archetype text,
  squad_role text NOT NULL,
  is_starter boolean NOT NULL DEFAULT false,
  squad_number integer,
  morale integer NOT NULL DEFAULT 60 CHECK (morale BETWEEN 0 AND 100),
  fitness integer NOT NULL DEFAULT 100 CHECK (fitness BETWEEN 0 AND 100),
  form integer NOT NULL DEFAULT 50 CHECK (form BETWEEN 0 AND 100),
  monthly_wage bigint NOT NULL DEFAULT 0 CHECK (monthly_wage >= 0),
  contract_seasons integer NOT NULL DEFAULT 2 CHECK (contract_seasons BETWEEN 0 AND 8),
  transfer_status text NOT NULL DEFAULT 'available' CHECK (transfer_status IN ('available','listed','loan_listed','injured')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (career_id, base_player_id)
);
CREATE INDEX IF NOT EXISTS idx_manager_squad_career_club ON public.manager_squad_state(career_id, club_id);
CREATE INDEX IF NOT EXISTS idx_manager_squad_starter ON public.manager_squad_state(career_id, is_starter);

ALTER TABLE public.manager_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_careers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_squad_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.manager_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.manager_careers FROM anon, authenticated;
REVOKE ALL ON TABLE public.manager_squad_state FROM anon, authenticated;
GRANT SELECT ON TABLE public.manager_profiles TO authenticated;
GRANT SELECT ON TABLE public.manager_careers TO authenticated;
GRANT SELECT ON TABLE public.manager_squad_state TO authenticated;

DROP POLICY IF EXISTS manager_profiles_owner_select ON public.manager_profiles;
CREATE POLICY manager_profiles_owner_select ON public.manager_profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS manager_careers_owner_select ON public.manager_careers;
CREATE POLICY manager_careers_owner_select ON public.manager_careers
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS manager_squad_owner_select ON public.manager_squad_state;
CREATE POLICY manager_squad_owner_select ON public.manager_squad_state
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.manager_careers c
      WHERE c.id = manager_squad_state.career_id
        AND c.user_id = (select auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.get_manager_onboarding()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_career jsonb;
  v_offers jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;

  SELECT to_jsonb(p) - 'user_id' INTO v_profile
  FROM public.manager_profiles p
  WHERE p.user_id = v_uid;

  SELECT jsonb_build_object(
    'id', c.id,
    'status', c.status,
    'club_id', c.club_id,
    'career_date', c.career_date
  ) INTO v_career
  FROM public.manager_careers c
  WHERE c.user_id = v_uid;

  SELECT coalesce(jsonb_agg(x.payload ORDER BY x.ord), '[]'::jsonb)
  INTO v_offers
  FROM (
    SELECT row_number() OVER () AS ord,
      jsonb_build_object(
        'club_id', c.id,
        'name', c.name,
        'short_name', c.short_name,
        'city', c.city,
        'shield_url', c.shield_url,
        'reputation', c.reputation,
        'division_level', c.division_level,
        'formation', c.formation,
        'play_style', c.play_style,
        'primary_color', c.primary_color,
        'secondary_color', c.secondary_color,
        'squad_size', (SELECT count(*) FROM public.base_ai_players ai WHERE ai.club_id = c.id),
        'average_ovr', (SELECT round(avg(ai.ovr))::int FROM public.base_ai_players ai WHERE ai.club_id = c.id),
        'project', CASE coalesce(c.division_level,4)
          WHEN 3 THEN 'Buscar acesso e consolidar um elenco competitivo.'
          ELSE 'Construir identidade, desenvolver o elenco e brigar pelo acesso.'
        END
      ) AS payload
    FROM public.base_clubs c
    WHERE c.is_active IS TRUE
      AND c.club_level = 'professional'
      AND coalesce(c.division_level, 4) >= 3
    ORDER BY md5(c.id::text || ':' || v_uid::text)
    LIMIT 5
  ) x;

  RETURN jsonb_build_object('profile', v_profile, 'career', v_career, 'offers', v_offers);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manager_profile(
  p_display_name text,
  p_nationality text,
  p_profile_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_display_name,''));
  v_nationality text := trim(coalesce(p_nationality,''));
  v_type text := lower(trim(coalesce(p_profile_type,'')));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 40 THEN RAISE EXCEPTION 'Nome do Manager inválido.'; END IF;
  IF char_length(v_nationality) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Nacionalidade inválida.'; END IF;
  IF v_type NOT IN ('estrategico','gestor','desenvolvedor','disciplinador') THEN RAISE EXCEPTION 'Perfil de Manager inválido.'; END IF;

  INSERT INTO public.manager_profiles(user_id, display_name, nationality, profile_type)
  VALUES(v_uid, v_name, v_nationality, v_type)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = excluded.display_name,
    nationality = excluded.nationality,
    profile_type = excluded.profile_type,
    updated_at = now();

  UPDATE public.usuarios SET caminho = 'manager' WHERE id = v_uid;
  RETURN public.get_manager_onboarding();
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_manager_job(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_existing_status text;
  v_club public.base_clubs%ROWTYPE;
  v_career_id uuid;
  v_transfer bigint;
  v_wage bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;

  SELECT id INTO v_profile_id FROM public.manager_profiles WHERE user_id = v_uid;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Crie seu perfil de Manager antes de escolher um clube.'; END IF;

  SELECT status INTO v_existing_status FROM public.manager_careers WHERE user_id = v_uid;
  IF v_existing_status = 'active' THEN RAISE EXCEPTION 'Sua carreira Manager já está em andamento.'; END IF;

  SELECT c.* INTO v_club
  FROM public.base_clubs c
  WHERE c.id = p_club_id
    AND c.is_active IS TRUE
    AND c.club_level = 'professional'
    AND coalesce(c.division_level,4) >= 3
    AND c.id IN (
      SELECT y.id FROM (
        SELECT c2.id
        FROM public.base_clubs c2
        WHERE c2.is_active IS TRUE
          AND c2.club_level = 'professional'
          AND coalesce(c2.division_level,4) >= 3
        ORDER BY md5(c2.id::text || ':' || v_uid::text)
        LIMIT 5
      ) y
    );
  IF v_club.id IS NULL THEN RAISE EXCEPTION 'Esta proposta não está disponível para sua carreira.'; END IF;

  v_transfer := CASE coalesce(v_club.division_level,4) WHEN 3 THEN 6000000 ELSE 3000000 END;
  v_wage := CASE coalesce(v_club.division_level,4) WHEN 3 THEN 900000 ELSE 550000 END;

  INSERT INTO public.manager_careers(
    user_id, manager_profile_id, club_id, status, career_date,
    transfer_budget, wage_budget, formation, play_style
  ) VALUES(
    v_uid, v_profile_id, v_club.id, 'active', current_date,
    v_transfer, v_wage, coalesce(v_club.formation,'4-3-3'), coalesce(v_club.play_style,'Equilibrado')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    manager_profile_id = excluded.manager_profile_id,
    club_id = excluded.club_id,
    status = 'active',
    career_date = excluded.career_date,
    board_confidence = 55,
    locker_room_support = 50,
    fan_approval = 50,
    media_pressure = 25,
    transfer_budget = excluded.transfer_budget,
    wage_budget = excluded.wage_budget,
    wage_committed = 0,
    formation = excluded.formation,
    play_style = excluded.play_style,
    training_focus = 'Equilibrado',
    training_intensity = 'Normal',
    updated_at = now()
  RETURNING id INTO v_career_id;

  DELETE FROM public.manager_squad_state WHERE career_id = v_career_id;

  INSERT INTO public.manager_squad_state(
    career_id, base_player_id, club_id, display_name, age,
    primary_position, secondary_position, ovr, archetype, squad_role,
    is_starter, squad_number, morale, fitness, form, monthly_wage, contract_seasons
  )
  SELECT
    v_career_id, ai.id, v_club.id, ai.name, ai.age,
    ai.primary_position, ai.secondary_position, ai.ovr, ai.archetype, ai.squad_role,
    ai.is_starter, coalesce(ai.squad_number, row_number() OVER (ORDER BY ai.is_starter DESC, ai.ovr DESC)::int),
    60, 100, 50,
    greatest(1800, ai.ovr * CASE coalesce(v_club.division_level,4) WHEN 3 THEN 210 ELSE 150 END),
    2
  FROM public.base_ai_players ai
  WHERE ai.club_id = v_club.id;

  UPDATE public.manager_careers c
  SET wage_committed = coalesce((SELECT sum(s.monthly_wage) FROM public.manager_squad_state s WHERE s.career_id = v_career_id),0),
      updated_at = now()
  WHERE c.id = v_career_id;

  RETURN public.get_manager_hub();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_hub()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_career public.manager_careers%ROWTYPE;
  v_profile jsonb;
  v_club jsonb;
  v_squad jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  SELECT * INTO v_career FROM public.manager_careers WHERE user_id = v_uid AND status = 'active';
  IF v_career.id IS NULL THEN RAISE EXCEPTION 'Nenhuma carreira Manager ativa.'; END IF;

  SELECT jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'nationality', p.nationality,
    'profile_type', p.profile_type, 'reputation', p.reputation
  ) INTO v_profile
  FROM public.manager_profiles p WHERE p.id = v_career.manager_profile_id;

  SELECT jsonb_build_object(
    'id', c.id, 'name', c.name, 'short_name', c.short_name, 'city', c.city,
    'shield_url', c.shield_url, 'reputation', c.reputation, 'division_level', c.division_level,
    'formation', v_career.formation, 'play_style', v_career.play_style,
    'primary_color', c.primary_color, 'secondary_color', c.secondary_color
  ) INTO v_club FROM public.base_clubs c WHERE c.id = v_career.club_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.base_player_id, 'name', s.display_name, 'age', s.age,
    'primary_position', s.primary_position, 'secondary_position', s.secondary_position,
    'ovr', s.ovr, 'archetype', s.archetype, 'squad_role', s.squad_role,
    'is_starter', s.is_starter, 'squad_number', s.squad_number,
    'morale', s.morale, 'fitness', s.fitness, 'form', s.form,
    'monthly_wage', s.monthly_wage, 'contract_seasons', s.contract_seasons,
    'transfer_status', s.transfer_status
  ) ORDER BY s.is_starter DESC, s.ovr DESC, s.display_name), '[]'::jsonb)
  INTO v_squad
  FROM public.manager_squad_state s
  WHERE s.career_id = v_career.id AND s.club_id = v_career.club_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'career', jsonb_build_object(
      'id', v_career.id, 'status', v_career.status, 'career_date', v_career.career_date,
      'board_confidence', v_career.board_confidence,
      'locker_room_support', v_career.locker_room_support,
      'fan_approval', v_career.fan_approval,
      'media_pressure', v_career.media_pressure,
      'transfer_budget', v_career.transfer_budget,
      'wage_budget', v_career.wage_budget,
      'wage_committed', v_career.wage_committed,
      'formation', v_career.formation,
      'play_style', v_career.play_style,
      'training_focus', v_career.training_focus,
      'training_intensity', v_career.training_intensity
    ),
    'club', v_club,
    'squad', v_squad
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_manager_tactics(p_formation text, p_play_style text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_formation text := trim(coalesce(p_formation,'')); v_style text := trim(coalesce(p_play_style,''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  IF v_formation NOT IN ('4-3-3','4-2-3-1','4-4-2','4-1-4-1','3-5-2','3-4-3','5-3-2') THEN RAISE EXCEPTION 'Formação inválida.'; END IF;
  IF v_style NOT IN ('Recuado','Ofensivo','Contra-ataque','Equilibrado','Pelas alas','Posse de bola') THEN RAISE EXCEPTION 'Estilo de jogo inválido.'; END IF;
  UPDATE public.manager_careers SET formation=v_formation, play_style=v_style, updated_at=now()
  WHERE user_id=v_uid AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma carreira Manager ativa.'; END IF;
  RETURN public.get_manager_hub();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_manager_training_plan(p_focus text, p_intensity text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_focus text := trim(coalesce(p_focus,'')); v_intensity text := trim(coalesce(p_intensity,''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  IF v_focus NOT IN ('Equilibrado','Organização defensiva','Pressão pós-perda','Posse e circulação','Transição ofensiva','Finalização','Bola parada','Recuperação') THEN RAISE EXCEPTION 'Foco de treino inválido.'; END IF;
  IF v_intensity NOT IN ('Leve','Normal','Alta') THEN RAISE EXCEPTION 'Intensidade inválida.'; END IF;
  UPDATE public.manager_careers SET training_focus=v_focus, training_intensity=v_intensity, updated_at=now()
  WHERE user_id=v_uid AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma carreira Manager ativa.'; END IF;
  RETURN public.get_manager_hub();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_manager_lineup(p_starters uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_career_id uuid; v_distinct integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  SELECT id INTO v_career_id FROM public.manager_careers WHERE user_id=v_uid AND status='active';
  IF v_career_id IS NULL THEN RAISE EXCEPTION 'Nenhuma carreira Manager ativa.'; END IF;
  SELECT count(DISTINCT x) INTO v_distinct FROM unnest(coalesce(p_starters, ARRAY[]::uuid[])) AS t(x);
  IF coalesce(array_length(p_starters,1),0) <> 11 OR v_distinct <> 11 THEN RAISE EXCEPTION 'A escalação deve ter exatamente 11 jogadores distintos.'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_starters) AS t(x)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.manager_squad_state s
      WHERE s.career_id=v_career_id AND s.base_player_id=t.x
    )
  ) THEN RAISE EXCEPTION 'A escalação contém jogador fora do seu elenco.'; END IF;
  UPDATE public.manager_squad_state SET is_starter=false, updated_at=now() WHERE career_id=v_career_id;
  UPDATE public.manager_squad_state SET is_starter=true, updated_at=now()
  WHERE career_id=v_career_id AND base_player_id=ANY(p_starters);
  RETURN public.get_manager_hub();
END;
$$;

REVOKE ALL ON FUNCTION public.get_manager_onboarding() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_manager_profile(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_manager_job(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_manager_hub() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_manager_tactics(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_manager_training_plan(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_manager_lineup(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_manager_profile(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_manager_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_hub() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_manager_tactics(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_manager_training_plan(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_manager_lineup(uuid[]) TO authenticated;

UPDATE public.usuarios SET caminho='manager' WHERE caminho IN ('tecnico','presidente');

COMMIT;
