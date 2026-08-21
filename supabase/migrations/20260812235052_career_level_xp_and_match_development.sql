CREATE TABLE IF NOT EXISTS private.player_career_progression (
  player_id uuid PRIMARY KEY REFERENCES public.jogadores(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  lifetime_xp bigint NOT NULL DEFAULT 0 CHECK (lifetime_xp >= 0),
  evolution_points integer NOT NULL DEFAULT 0 CHECK (evolution_points >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.career_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_key text NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, source_type, source_key)
);

CREATE INDEX IF NOT EXISTS idx_career_xp_events_player_created
  ON private.career_xp_events(player_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.career_xp_to_next(p_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT LEAST(2200, 400 + GREATEST(COALESCE(p_level,1)-1,0)*70)::integer;
$$;

CREATE OR REPLACE FUNCTION private.ensure_career_progression(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO private.player_career_progression(player_id)
  VALUES(p_player_id)
  ON CONFLICT(player_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION private.career_progression_payload(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row record;
  v_need integer;
BEGIN
  PERFORM private.ensure_career_progression(p_player_id);
  SELECT * INTO v_row FROM private.player_career_progression WHERE player_id=p_player_id;
  v_need:=private.career_xp_to_next(v_row.level);
  RETURN jsonb_build_object(
    'level',v_row.level,
    'xp',v_row.xp,
    'xp_to_next',v_need,
    'xp_percent',CASE WHEN v_row.level>=100 THEN 100 ELSE ROUND((v_row.xp::numeric/GREATEST(v_need,1))*100,1) END,
    'lifetime_xp',v_row.lifetime_xp,
    'evolution_points',v_row.evolution_points,
    'evolution_point_percent',12,
    'max_level',100
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.award_career_xp(
  p_player_id uuid,
  p_amount integer,
  p_source_type text,
  p_source_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row record;
  v_existing record;
  v_level_before integer;
  v_points_before integer;
  v_need integer;
  v_levels integer:=0;
  v_points integer:=0;
  v_payload jsonb;
BEGIN
  IF p_player_id IS NULL OR COALESCE(p_amount,0)<=0 OR COALESCE(NULLIF(trim(p_source_type),''),'')='' OR COALESCE(NULLIF(trim(p_source_key),''),'')='' THEN
    RETURN private.career_progression_payload(p_player_id)||jsonb_build_object('awarded_xp',0,'duplicate',false,'levels_gained',0,'evolution_points_gained',0);
  END IF;

  SELECT * INTO v_existing
  FROM private.career_xp_events
  WHERE player_id=p_player_id AND source_type=p_source_type AND source_key=p_source_key;
  IF v_existing.id IS NOT NULL THEN
    RETURN private.career_progression_payload(p_player_id)||jsonb_build_object(
      'awarded_xp',0,'duplicate',true,
      'levels_gained',COALESCE((v_existing.metadata->>'levels_gained')::integer,0),
      'evolution_points_gained',COALESCE((v_existing.metadata->>'evolution_points_gained')::integer,0)
    );
  END IF;

  PERFORM private.ensure_career_progression(p_player_id);
  SELECT * INTO v_row FROM private.player_career_progression WHERE player_id=p_player_id FOR UPDATE;
  v_level_before:=v_row.level;
  v_points_before:=v_row.evolution_points;
  v_row.xp:=v_row.xp+p_amount;
  v_row.lifetime_xp:=v_row.lifetime_xp+p_amount;

  WHILE v_row.level<100 LOOP
    v_need:=private.career_xp_to_next(v_row.level);
    EXIT WHEN v_row.xp<v_need;
    v_row.xp:=v_row.xp-v_need;
    v_row.level:=v_row.level+1;
    v_levels:=v_levels+1;
    v_points:=v_points+1+CASE WHEN MOD(v_row.level,5)=0 THEN 1 ELSE 0 END;
  END LOOP;

  IF v_row.level>=100 THEN v_row.xp:=0; END IF;
  v_row.evolution_points:=v_row.evolution_points+v_points;

  UPDATE private.player_career_progression
  SET level=v_row.level,xp=v_row.xp,lifetime_xp=v_row.lifetime_xp,
      evolution_points=v_row.evolution_points,updated_at=now()
  WHERE player_id=p_player_id;

  INSERT INTO private.career_xp_events(player_id,source_type,source_key,amount,metadata)
  VALUES(
    p_player_id,left(p_source_type,40),left(p_source_key,120),p_amount,
    COALESCE(p_metadata,'{}'::jsonb)||jsonb_build_object(
      'level_before',v_level_before,'level_after',v_row.level,
      'levels_gained',v_levels,
      'evolution_points_before',v_points_before,
      'evolution_points_gained',v_points,
      'evolution_points_after',v_row.evolution_points
    )
  );

  v_payload:=private.career_progression_payload(p_player_id);
  RETURN v_payload||jsonb_build_object(
    'awarded_xp',p_amount,'duplicate',false,
    'levels_gained',v_levels,'evolution_points_gained',v_points
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_career_progression()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_player uuid;
  v_payload jsonb;
  v_last jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  v_payload:=private.career_progression_payload(v_player);
  SELECT jsonb_build_object(
    'source_type',source_type,'amount',amount,'created_at',created_at,
    'levels_gained',COALESCE((metadata->>'levels_gained')::integer,0),
    'evolution_points_gained',COALESCE((metadata->>'evolution_points_gained')::integer,0),
    'level_after',COALESCE((metadata->>'level_after')::integer,(v_payload->>'level')::integer)
  ) INTO v_last
  FROM private.career_xp_events
  WHERE player_id=v_player
  ORDER BY created_at DESC,id DESC
  LIMIT 1;
  RETURN v_payload||jsonb_build_object('last_award',v_last);
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_career_evolution_point(p_attribute text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_player uuid;
  v_prog record;
  v_before_value integer;
  v_after_value integer;
  v_before_progress numeric;
  v_after_progress numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF p_attribute NOT IN ('Físico','Marcação','Finalização','Velocidade','Passe','Visão de jogo') THEN
    RAISE EXCEPTION 'Atributo inválido.';
  END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_career_progression(v_player);
  PERFORM private.sync_development_baselines(v_player);
  SELECT * INTO v_prog FROM private.player_career_progression WHERE player_id=v_player FOR UPDATE;
  IF v_prog.evolution_points<=0 THEN RAISE EXCEPTION 'Você não possui pontos de evolução disponíveis.'; END IF;

  SELECT (atributos->>p_attribute)::integer INTO v_before_value FROM public.jogadores WHERE id=v_player;
  SELECT progress INTO v_before_progress FROM public.player_attribute_development WHERE player_id=v_player AND attribute_key=p_attribute;
  IF COALESCE(v_before_value,99)>=99 THEN RAISE EXCEPTION 'Este atributo já está no limite.'; END IF;

  PERFORM private.add_attribute_progress(v_player,p_attribute,12);
  UPDATE private.player_career_progression
  SET evolution_points=evolution_points-1,updated_at=now()
  WHERE player_id=v_player;

  SELECT (atributos->>p_attribute)::integer INTO v_after_value FROM public.jogadores WHERE id=v_player;
  SELECT progress INTO v_after_progress FROM public.player_attribute_development WHERE player_id=v_player AND attribute_key=p_attribute;

  INSERT INTO public.player_development_events(player_id,career_date,event_type,attribute_key,amount,metadata)
  SELECT v_player,COALESCE(career_date,CURRENT_DATE),'evolution_point',p_attribute,12,
    jsonb_build_object('before_value',v_before_value,'after_value',v_after_value,'before_progress',COALESCE(v_before_progress,0),'after_progress',COALESCE(v_after_progress,0))
  FROM public.player_career_state WHERE player_id=v_player;

  RETURN jsonb_build_object(
    'progression',private.career_progression_payload(v_player),
    'attribute',jsonb_build_object(
      'key',p_attribute,'before_value',v_before_value,'after_value',v_after_value,
      'before_progress',ROUND(COALESCE(v_before_progress,0),1),'after_progress',ROUND(COALESCE(v_after_progress,0),1),
      'ovr_after',(SELECT public.calculate_player_ovr(atributos) FROM public.jogadores WHERE id=v_player)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.after_activity_career_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_base numeric;
  v_duration integer:=COALESCE(NEW.duration_minutes,45);
  v_skill_total numeric:=0;
  v_mult numeric:=1;
  v_amount integer;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN value ~ '^-?[0-9]+([.][0-9]+)?$' THEN value::numeric ELSE 0 END),0)
  INTO v_skill_total
  FROM jsonb_each_text(COALESCE(NEW.hidden_effects->'skills','{}'::jsonb));

  v_base:=CASE NEW.category
    WHEN 'training' THEN 12
    WHEN 'team_training' THEN 14
    WHEN 'recovery' THEN 5
    WHEN 'professional' THEN 8
    WHEN 'social' THEN 7
    ELSE 6 END;
  v_mult:=CASE NEW.intensity WHEN 'light' THEN .85 WHEN 'intense' THEN 1.18 ELSE 1 END;
  v_amount:=GREATEST(4,ROUND((v_base+LEAST(10,v_duration/12.0)+LEAST(10,v_skill_total/4.0))*v_mult)::integer);
  IF NEW.activity_key='rest_home' THEN v_amount:=6; END IF;

  PERFORM private.award_career_xp(
    NEW.player_id,v_amount,'activity',NEW.id::text,
    jsonb_build_object('activity_key',NEW.activity_key,'category',NEW.category,'intensity',NEW.intensity,'duration_minutes',NEW.duration_minutes)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_activity_career_xp ON public.player_career_actions;
CREATE TRIGGER trg_after_activity_career_xp
AFTER INSERT ON public.player_career_actions
FOR EACH ROW EXECUTE FUNCTION private.after_activity_career_xp();

CREATE OR REPLACE FUNCTION private.match_action_skill(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
SELECT CASE
  WHEN p_key IN ('pen_place','pen_power','pen_wait','pen_low','sp_panenka') THEN 'penalties'
  WHEN p_key IN ('fk_curve','fk_power','sp_knuckle','sp_underwall') THEN 'free_kicks'
  WHEN p_key IN ('fk_cross','box_low_cross','wide_early_cross','wide_low_cross','sp_rabona_cross','sp_trivela_cross') THEN 'crossing'
  WHEN p_key IN ('box_finish','box_set','central_shot','sp_volley','sp_chip','sp_heel_finish','sp_trivela_finish','sp_long_knuckle','sp_bicycle_cross','sp_scissor','sp_chest_volley','sp_first_time_volley','sp_bicycle') THEN 'finishing_touch'
  WHEN p_key IN ('sp_diving_header','def_aerial','sp_aerial_bicycle_clear') THEN 'heading'
  WHEN p_key IN ('box_feint','box_open','wide_line','wide_inside','build_turn','central_carry','sp_elastico','sp_nutmeg','sp_sombrero','sp_roulette','sp_roulette_mid') THEN 'dribbling'
  WHEN p_key IN ('build_diagonal','build_clear','central_switch','sp_trivela_pass') THEN 'long_pass'
  WHEN p_key IN ('fk_short','box_layoff','box_square','wide_wall','wide_recycle','build_one_touch','build_draw','central_vertical','central_wall','central_killer','central_hold','sp_heel_escape','sp_no_look','sp_backheel_link') THEN 'short_pass'
  WHEN p_key IN ('wide_burst','rec_sprint') THEN 'sprint'
  WHEN p_key IN ('build_shield') THEN 'strength'
  WHEN p_key IN ('def_tackle','def_press','def_track','rec_track','rec_foul','sp_slide_hook') THEN 'marking'
  WHEN p_key IN ('def_contain','def_lane','rec_center','rec_lane','sp_intercept_launch') THEN 'tactical_awareness'
  WHEN p_key LIKE 'off_%' OR p_key LIKE 'sup_%' OR p_key IN ('rec_high') THEN 'positioning'
  ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION private.apply_match_gameplay_development(
  p_player_id uuid,
  p_match_date date,
  p_minutes integer,
  p_goals integer,
  p_assists integer,
  p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_history jsonb;
  v_rec record;
  v_total numeric:=0;
  v_bonus numeric;
BEGIN
  IF COALESCE(p_minutes,0)<=0 THEN RETURN; END IF;
  v_history:=CASE
    WHEN jsonb_typeof(COALESCE(p_metadata #> '{player_stats,decision_history}','[]'::jsonb))='array'
      THEN COALESCE(p_metadata #> '{player_stats,decision_history}','[]'::jsonb)
    ELSE '[]'::jsonb END;

  FOR v_rec IN
    SELECT skill_key,LEAST(8,SUM(amount)) AS amount
    FROM (
      SELECT private.match_action_skill(item->>'key') AS skill_key,
             LEAST(1.35,
               CASE WHEN lower(COALESCE(item->>'success','false'))='true' THEN .95 ELSE .55 END
               + CASE WHEN COALESCE(item->>'key','') LIKE 'sp_%' THEN .25 ELSE 0 END
             ) AS amount
      FROM jsonb_array_elements(v_history) WITH ORDINALITY AS h(item,ord)
      WHERE ord<=40
    ) q
    WHERE skill_key IS NOT NULL
    GROUP BY skill_key
  LOOP
    IF v_rec.amount>0 THEN
      PERFORM private.add_skill_progress(p_player_id,v_rec.skill_key,v_rec.amount);
      v_total:=v_total+v_rec.amount;
    END IF;
  END LOOP;

  IF COALESCE(p_goals,0)>0 THEN
    v_bonus:=LEAST(p_goals,3)*2.4;
    PERFORM private.add_skill_progress(p_player_id,'finishing_touch',v_bonus);
    PERFORM private.add_skill_progress(p_player_id,'positioning',LEAST(p_goals,3)*1.1);
    v_total:=v_total+v_bonus+LEAST(p_goals,3)*1.1;
  END IF;
  IF COALESCE(p_assists,0)>0 THEN
    PERFORM private.add_skill_progress(p_player_id,'short_pass',LEAST(p_assists,3)*1.7);
    PERFORM private.add_skill_progress(p_player_id,'positioning',LEAST(p_assists,3)*.8);
    v_total:=v_total+LEAST(p_assists,3)*2.5;
  END IF;

  INSERT INTO public.player_development_events(player_id,career_date,event_type,amount,metadata)
  VALUES(p_player_id,p_match_date,'match_gameplay',ROUND(v_total,2),jsonb_build_object(
    'minutes',p_minutes,'goals',COALESCE(p_goals,0),'assists',COALESCE(p_assists,0),
    'decisions',jsonb_array_length(v_history),'reason','A experiência real da partida alimentou as habilidades usadas em campo.'
  ));
END;
$$;

CREATE OR REPLACE FUNCTION private.after_match_career_progression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_history jsonb;
  v_decisions integer:=0;
  v_rating_bonus integer:=0;
  v_result_bonus integer:=0;
  v_amount integer;
  v_award jsonb;
BEGIN
  IF COALESCE(NEW.appeared,false)=false OR COALESCE(NEW.minutes,0)<=0 THEN RETURN NEW; END IF;
  IF COALESCE(NEW.metadata->>'engine','')<>'career-match-v5' THEN RETURN NEW; END IF;

  v_history:=CASE
    WHEN jsonb_typeof(COALESCE(NEW.metadata #> '{player_stats,decision_history}','[]'::jsonb))='array'
      THEN COALESCE(NEW.metadata #> '{player_stats,decision_history}','[]'::jsonb)
    ELSE '[]'::jsonb END;
  v_decisions:=LEAST(24,jsonb_array_length(v_history));
  v_rating_bonus:=GREATEST(-5,LEAST(28,ROUND((COALESCE(NEW.rating,6)-6)*12)::integer));
  v_result_bonus:=CASE NEW.result WHEN 'W' THEN 12 WHEN 'D' THEN 6 ELSE 0 END;
  v_amount:=GREATEST(20,
    35+ROUND(LEAST(COALESCE(NEW.minutes,0),90)*.55)::integer
    +CASE WHEN COALESCE(NEW.started,false) THEN 8 ELSE 0 END
    +LEAST(COALESCE(NEW.goals,0),5)*22
    +LEAST(COALESCE(NEW.assists,0),5)*16
    +v_rating_bonus+v_result_bonus+v_decisions
  );

  v_award:=private.award_career_xp(
    NEW.player_id,v_amount,'match',NEW.id::text,
    jsonb_build_object('match_date',NEW.match_date,'opponent',NEW.opponent,'rating',NEW.rating,'result',NEW.result,'minutes',NEW.minutes,'goals',NEW.goals,'assists',NEW.assists,'decision_count',v_decisions)
  );

  IF COALESCE((v_award->>'duplicate')::boolean,false)=false THEN
    PERFORM private.apply_match_gameplay_development(NEW.player_id,NEW.match_date,NEW.minutes,NEW.goals,NEW.assists,NEW.metadata);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_match_career_progression ON public.player_match_history;
CREATE TRIGGER trg_after_match_career_progression
AFTER UPDATE OF metadata ON public.player_match_history
FOR EACH ROW
WHEN (OLD.metadata IS DISTINCT FROM NEW.metadata)
EXECUTE FUNCTION private.after_match_career_progression();

INSERT INTO private.player_career_progression(player_id)
SELECT player_id FROM public.player_career_state
ON CONFLICT(player_id) DO NOTHING;

DO $$
DECLARE
  v_player record;
  v_bootstrap integer;
BEGIN
  FOR v_player IN SELECT player_id FROM public.player_career_state LOOP
    SELECT LEAST(900,GREATEST(0,
      COALESCE((SELECT COUNT(*)*6 FROM public.player_career_actions a WHERE a.player_id=v_player.player_id),0)
      +COALESCE((SELECT ROUND(SUM(LEAST(minutes,90))*.60)::integer FROM public.player_match_history m WHERE m.player_id=v_player.player_id AND m.appeared),0)
      +COALESCE((SELECT SUM(goals)*20+SUM(assists)*15 FROM public.player_match_history m WHERE m.player_id=v_player.player_id AND m.appeared),0)
    )) INTO v_bootstrap;
    IF COALESCE(v_bootstrap,0)>0 THEN
      PERFORM private.award_career_xp(v_player.player_id,v_bootstrap,'bootstrap','career_progression_v1',jsonb_build_object('reason','Crédito inicial proporcional ao histórico já disputado antes da criação do sistema de nível.'));
    END IF;
  END LOOP;
END;
$$;