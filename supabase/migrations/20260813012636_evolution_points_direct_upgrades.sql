CREATE OR REPLACE FUNCTION private.career_evolution_upgrade_cost(p_value integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN COALESCE(p_value,0) < 50 THEN 1
    WHEN p_value < 65 THEN 2
    WHEN p_value < 75 THEN 3
    WHEN p_value < 85 THEN 4
    WHEN p_value < 90 THEN 5
    WHEN p_value < 95 THEN 8
    ELSE 10
  END;
$function$;

CREATE OR REPLACE FUNCTION private.career_level_evolution_points(p_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN COALESCE(p_level,0) < 2 THEN 0
    WHEN MOD(p_level,10)=0 THEN 6
    WHEN MOD(p_level,10)=5 THEN 3
    ELSE 2
  END;
$function$;

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
AS $function$
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
    v_points:=v_points+private.career_level_evolution_points(v_row.level);
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
      'evolution_points_after',v_row.evolution_points,
      'evolution_economy','direct_upgrade_v2'
    )
  );

  v_payload:=private.career_progression_payload(p_player_id);
  RETURN v_payload||jsonb_build_object(
    'awarded_xp',p_amount,'duplicate',false,
    'levels_gained',v_levels,'evolution_points_gained',v_points
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.career_progression_payload(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
    'evolution_system','direct_level',
    'next_level_points',CASE WHEN v_row.level>=100 THEN 0 ELSE private.career_level_evolution_points(v_row.level+1) END,
    'point_awards',jsonb_build_object('normal',2,'mid_decade',3,'decade',6),
    'upgrade_cost_curve',jsonb_build_array(
      jsonb_build_object('min',0,'max',49,'cost',1),
      jsonb_build_object('min',50,'max',64,'cost',2),
      jsonb_build_object('min',65,'max',74,'cost',3),
      jsonb_build_object('min',75,'max',84,'cost',4),
      jsonb_build_object('min',85,'max',89,'cost',5),
      jsonb_build_object('min',90,'max',94,'cost',8),
      jsonb_build_object('min',95,'max',98,'cost',10)
    ),
    'max_level',100
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_career_development_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_player uuid;
  v_date date;
  v_skills jsonb:='[]'::jsonb;
  v_attrs jsonb:='{}'::jsonb;
  v_skill record;
  v_attr record;
  v_status jsonb;
  v_weights jsonb;
  v_severity integer;
  v_focus_score integer:=-1;
  v_focus jsonb:=NULL;
  v_q_physical numeric;
  v_q_technical numeric;
  v_q_tactical numeric;
  v_q_speed numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_career_initialized(v_player);
  PERFORM private.sync_development_baselines(v_player);
  SELECT COALESCE(career_date,CURRENT_DATE) INTO v_date FROM public.player_career_state WHERE player_id=v_player;

  FOR v_skill IN
    SELECT * FROM public.player_skill_development
    WHERE player_id=v_player
    ORDER BY category,label
  LOOP
    v_status:=private.skill_status_payload(v_player,v_skill.skill_key,v_date);
    v_weights:=private.skill_attribute_weights(v_player,v_skill.skill_key);
    v_skills:=v_skills||jsonb_build_array(jsonb_build_object(
      'key',v_skill.skill_key,
      'label',v_skill.label,
      'category',v_skill.category,
      'level',v_skill.level,
      'progress',ROUND(v_skill.progress,0),
      'baseline_level',v_skill.baseline_level,
      'parent_attribute',v_skill.parent_attribute,
      'attribute_impacts',v_weights,
      'upgrade_cost',CASE WHEN v_skill.level>=99 THEN NULL ELSE private.career_evolution_upgrade_cost(v_skill.level) END,
      'status',v_status
    ));

    v_severity:=CASE v_status->>'code'
      WHEN 'losing_rhythm' THEN 5
      WHEN 'low_stimulus' THEN 4
      WHEN 'recovering' THEN 3
      WHEN 'maintained' THEN 2
      ELSE 1 END;
    v_severity:=v_severity*100+COALESCE((v_status->>'days_since_stimulus')::integer,0);
    IF v_severity>v_focus_score AND v_skill.level<99 THEN
      v_focus_score:=v_severity;
      v_focus:=jsonb_build_object('key',v_skill.skill_key,'label',v_skill.label,'status',v_status->>'label');
    END IF;
  END LOOP;

  FOR v_attr IN
    SELECT ad.attribute_key,ad.progress,ad.baseline_value,(j.atributos->>ad.attribute_key)::integer AS value
    FROM public.player_attribute_development ad
    JOIN public.jogadores j ON j.id=ad.player_id
    WHERE ad.player_id=v_player
    ORDER BY ad.attribute_key
  LOOP
    v_attrs:=v_attrs||jsonb_build_object(v_attr.attribute_key,jsonb_build_object(
      'value',v_attr.value,
      'progress',ROUND(v_attr.progress,0),
      'baseline_value',v_attr.baseline_value,
      'upgrade_cost',CASE WHEN v_attr.value>=99 THEN NULL ELSE private.career_evolution_upgrade_cost(v_attr.value) END
    ));
  END LOOP;

  v_q_physical:=private.training_absorption_multiplier(v_player,'stamina');
  v_q_technical:=private.training_absorption_multiplier(v_player,'short_pass');
  v_q_tactical:=private.training_absorption_multiplier(v_player,'tactical_awareness');
  v_q_speed:=private.training_absorption_multiplier(v_player,'sprint');

  RETURN jsonb_build_object(
    'date',v_date,
    'skills',v_skills,
    'attributes',v_attrs,
    'recommended_focus',v_focus,
    'training_quality',jsonb_build_object(
      'physical',jsonb_build_object('label',private.development_quality_label(v_q_physical),'recent_load',private.recent_development_group_load(v_player,'physical')),
      'technical',jsonb_build_object('label',private.development_quality_label(v_q_technical),'recent_load',private.recent_development_group_load(v_player,'technical')),
      'tactical',jsonb_build_object('label',private.development_quality_label(v_q_tactical),'recent_load',private.recent_development_group_load(v_player,'tactical')),
      'speed',jsonb_build_object('label',private.development_quality_label(v_q_speed),'recent_load',private.recent_development_group_load(v_player,'physical'))
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.spend_career_evolution_upgrade(p_target_type text, p_target_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_player uuid;
  v_prog record;
  v_type text:=lower(trim(COALESCE(p_target_type,'')));
  v_before_value integer;
  v_after_value integer;
  v_before_progress numeric:=0;
  v_after_progress numeric:=0;
  v_cost integer;
  v_label text;
  v_date date;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF v_type NOT IN ('attribute','skill') THEN RAISE EXCEPTION 'Tipo de evolução inválido.'; END IF;
  IF COALESCE(NULLIF(trim(p_target_key),''),'')='' THEN RAISE EXCEPTION 'Evolução inválida.'; END IF;

  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;

  PERFORM private.ensure_career_progression(v_player);
  PERFORM private.sync_development_baselines(v_player);
  SELECT COALESCE(career_date,CURRENT_DATE) INTO v_date FROM public.player_career_state WHERE player_id=v_player;
  SELECT * INTO v_prog FROM private.player_career_progression WHERE player_id=v_player FOR UPDATE;

  IF v_type='attribute' THEN
    IF p_target_key NOT IN ('Físico','Marcação','Finalização','Velocidade','Passe','Visão de jogo') THEN
      RAISE EXCEPTION 'Atributo inválido.';
    END IF;
    SELECT (atributos->>p_target_key)::integer INTO v_before_value FROM public.jogadores WHERE id=v_player FOR UPDATE;
    SELECT COALESCE(progress,0) INTO v_before_progress
      FROM public.player_attribute_development
      WHERE player_id=v_player AND attribute_key=p_target_key;
    v_label:=p_target_key;
  ELSE
    SELECT level,COALESCE(progress,0),label
      INTO v_before_value,v_before_progress,v_label
      FROM public.player_skill_development
      WHERE player_id=v_player AND skill_key=p_target_key
      FOR UPDATE;
    IF v_before_value IS NULL THEN RAISE EXCEPTION 'Especialidade inválida.'; END IF;
  END IF;

  IF COALESCE(v_before_value,99)>=99 THEN RAISE EXCEPTION 'Esta evolução já está no limite.'; END IF;
  v_cost:=private.career_evolution_upgrade_cost(v_before_value);
  IF v_prog.evolution_points<v_cost THEN
    RAISE EXCEPTION 'Pontos insuficientes. Esta evolução custa % ponto(s) e você possui %.',v_cost,v_prog.evolution_points;
  END IF;

  v_after_value:=v_before_value+1;
  v_after_progress:=CASE WHEN v_after_value>=99 THEN 0 ELSE v_before_progress END;

  IF v_type='attribute' THEN
    UPDATE public.jogadores
      SET atributos=jsonb_set(atributos,ARRAY[p_target_key],to_jsonb(v_after_value),true),updated_at=now()
      WHERE id=v_player;
    UPDATE public.player_attribute_development
      SET progress=v_after_progress,updated_at=now()
      WHERE player_id=v_player AND attribute_key=p_target_key;

    INSERT INTO public.player_development_events(player_id,career_date,event_type,attribute_key,amount,metadata)
    VALUES(v_player,v_date,'level_up',p_target_key,1,jsonb_build_object(
      'source','career_evolution_points','cost',v_cost,
      'before_value',v_before_value,'after_value',v_after_value,
      'before_progress',v_before_progress,'after_progress',v_after_progress,
      'progress_preserved',v_after_value<99
    ));
  ELSE
    UPDATE public.player_skill_development
      SET level=v_after_value,progress=v_after_progress,last_stimulated_on=v_date,updated_at=now()
      WHERE player_id=v_player AND skill_key=p_target_key;

    INSERT INTO public.player_development_events(player_id,career_date,event_type,skill_key,amount,metadata)
    VALUES(v_player,v_date,'level_up',p_target_key,1,jsonb_build_object(
      'source','career_evolution_points','cost',v_cost,'label',v_label,
      'before_level',v_before_value,'after_level',v_after_value,
      'before_progress',v_before_progress,'after_progress',v_after_progress,
      'progress_preserved',v_after_value<99
    ));
  END IF;

  UPDATE private.player_career_progression
    SET evolution_points=evolution_points-v_cost,updated_at=now()
    WHERE player_id=v_player;

  RETURN jsonb_build_object(
    'progression',private.career_progression_payload(v_player),
    'target',jsonb_build_object(
      'type',v_type,'key',p_target_key,'label',v_label,'cost',v_cost,
      'before_value',v_before_value,'after_value',v_after_value,
      'before_progress',ROUND(COALESCE(v_before_progress,0),1),
      'after_progress',ROUND(COALESCE(v_after_progress,0),1),
      'ovr_after',(SELECT public.calculate_player_ovr(atributos) FROM public.jogadores WHERE id=v_player)
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.spend_career_evolution_point(p_attribute text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN public.spend_career_evolution_upgrade('attribute',p_attribute);
END;
$function$;

WITH rebalance AS (
  SELECT
    id,
    player_id,
    COALESCE((metadata->>'evolution_points_gained')::integer,0) AS old_points,
    COALESCE((metadata->>'level_before')::integer,
             COALESCE((metadata->>'level_after')::integer,1)-COALESCE((metadata->>'levels_gained')::integer,0)) AS level_before,
    COALESCE((metadata->>'level_after')::integer,1) AS level_after
  FROM private.career_xp_events
  WHERE COALESCE((metadata->>'levels_gained')::integer,0)>0
), calculated AS (
  SELECT r.*,
    COALESCE((SELECT SUM(private.career_level_evolution_points(g))
              FROM generate_series(r.level_before+1,r.level_after) AS g),0)::integer AS new_points
  FROM rebalance r
), player_delta AS (
  SELECT player_id,SUM(GREATEST(0,new_points-old_points))::integer AS delta
  FROM calculated
  GROUP BY player_id
)
UPDATE private.player_career_progression p
SET evolution_points=p.evolution_points+d.delta,updated_at=now()
FROM player_delta d
WHERE p.player_id=d.player_id AND d.delta>0;

WITH rebalance AS (
  SELECT
    id,
    COALESCE((metadata->>'evolution_points_gained')::integer,0) AS old_points,
    COALESCE((metadata->>'level_before')::integer,
             COALESCE((metadata->>'level_after')::integer,1)-COALESCE((metadata->>'levels_gained')::integer,0)) AS level_before,
    COALESCE((metadata->>'level_after')::integer,1) AS level_after
  FROM private.career_xp_events
  WHERE COALESCE((metadata->>'levels_gained')::integer,0)>0
), calculated AS (
  SELECT r.*,
    COALESCE((SELECT SUM(private.career_level_evolution_points(g))
              FROM generate_series(r.level_before+1,r.level_after) AS g),0)::integer AS new_points
  FROM rebalance r
)
UPDATE private.career_xp_events e
SET metadata=e.metadata||jsonb_build_object(
  'legacy_evolution_points_gained',c.old_points,
  'evolution_points_gained',c.new_points,
  'evolution_economy','direct_upgrade_v2'
)
FROM calculated c
WHERE e.id=c.id;