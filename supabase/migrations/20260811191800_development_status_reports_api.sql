BEGIN;

CREATE OR REPLACE FUNCTION private.development_quality_label(p_value numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path=''
AS $$
  SELECT CASE
    WHEN p_value>=1.05 THEN 'Excelente'
    WHEN p_value>=0.90 THEN 'Boa'
    WHEN p_value>=0.75 THEN 'Reduzida'
    ELSE 'Baixa' END
$$;

CREATE OR REPLACE FUNCTION private.recent_development_group_load(p_player_id uuid,p_group text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT COUNT(*)::integer
  FROM public.player_career_actions a
  JOIN public.player_career_state s ON s.player_id=a.player_id
  WHERE a.player_id=p_player_id
    AND a.career_date>=COALESCE(s.career_date,CURRENT_DATE)-2
    AND a.category IN ('training','team_training')
    AND EXISTS (
      SELECT 1
      FROM jsonb_object_keys(COALESCE(a.hidden_effects->'skills','{}'::jsonb)) AS k(skill_key)
      WHERE private.skill_load_group(k.skill_key)=p_group
    )
$$;

CREATE OR REPLACE FUNCTION private.skill_status_payload(p_player_id uuid,p_skill_key text,p_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_skill record;
  v_policy jsonb;
  v_days integer;
  v_grace integer;
  v_trend numeric:=0;
  v_recent_gain numeric:=0;
  v_had_decay boolean:=false;
  v_code text;
  v_label text;
BEGIN
  SELECT * INTO v_skill
  FROM public.player_skill_development
  WHERE player_id=p_player_id AND skill_key=p_skill_key;
  IF v_skill.player_id IS NULL THEN RETURN '{}'::jsonb; END IF;

  v_policy:=private.skill_decay_policy(p_skill_key);
  v_grace:=(v_policy->>'grace_days')::integer;
  v_days:=GREATEST(0,COALESCE(p_date,CURRENT_DATE)-COALESCE(v_skill.last_stimulated_on,COALESCE(p_date,CURRENT_DATE)));

  SELECT COALESCE(SUM(amount),0) INTO v_trend
  FROM public.player_development_events
  WHERE player_id=p_player_id AND skill_key=p_skill_key
    AND career_date>=COALESCE(p_date,CURRENT_DATE)-6;

  SELECT COALESCE(SUM(amount),0) INTO v_recent_gain
  FROM public.player_development_events
  WHERE player_id=p_player_id AND skill_key=p_skill_key
    AND amount>0 AND career_date>=COALESCE(p_date,CURRENT_DATE)-2;

  SELECT EXISTS(
    SELECT 1 FROM public.player_development_events
    WHERE player_id=p_player_id AND skill_key=p_skill_key
      AND amount<0 AND career_date>=COALESCE(p_date,CURRENT_DATE)-13
  ) INTO v_had_decay;

  IF v_had_decay AND v_recent_gain>0 THEN v_code:='recovering';v_label:='Recuperando ritmo';
  ELSIF v_trend>=8 THEN v_code:='evolving';v_label:='Em evolução';
  ELSIF v_days<=v_grace THEN v_code:='maintained';v_label:='Mantida';
  ELSIF v_days<=v_grace+5 THEN v_code:='low_stimulus';v_label:='Pouco estimulada';
  ELSE v_code:='losing_rhythm';v_label:='Perdendo ritmo';
  END IF;

  RETURN jsonb_build_object(
    'code',v_code,
    'label',v_label,
    'days_since_stimulus',v_days,
    'trend_7d',ROUND(v_trend,1),
    'grace_days',v_grace,
    'last_stimulated_on',v_skill.last_stimulated_on
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_career_development_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
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
      'baseline_value',v_attr.baseline_value
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
$$;
REVOKE ALL ON FUNCTION public.get_career_development_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_career_development_status() TO authenticated;

CREATE OR REPLACE FUNCTION private.build_development_snapshot(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_attrs jsonb;
  v_skills jsonb:='{}'::jsonb;
  v_state jsonb;
  v_date date;
  v_skill record;
  v_status jsonb;
BEGIN
  SELECT atributos INTO v_attrs FROM public.jogadores WHERE id=p_player_id;
  SELECT COALESCE(career_date,CURRENT_DATE) INTO v_date FROM public.player_career_state WHERE player_id=p_player_id;
  FOR v_skill IN SELECT * FROM public.player_skill_development WHERE player_id=p_player_id LOOP
    v_status:=private.skill_status_payload(p_player_id,v_skill.skill_key,v_date);
    v_skills:=v_skills||jsonb_build_object(v_skill.skill_key,jsonb_build_object(
      'label',v_skill.label,
      'level',v_skill.level,
      'progress',ROUND(v_skill.progress,0),
      'status',v_status->>'code',
      'status_label',v_status->>'label',
      'last_stimulated_on',v_skill.last_stimulated_on
    ));
  END LOOP;
  SELECT jsonb_build_object(
    'form',form,'trust',trust,'energy',energy,'fatigue',fatigue,'pressure',pressure,
    'fame',fame,'fanbase',fanbase,'public_image',public_image,'locker_room',locker_room_relation
  ) INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  RETURN jsonb_build_object('attributes',COALESCE(v_attrs,'{}'::jsonb),'skills',v_skills,'state',COALESCE(v_state,'{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION private.development_report_body(p_old jsonb,p_new jsonb,p_period text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path=''
AS $$
DECLARE
  v_key text;
  v_old_n numeric;
  v_new_n numeric;
  v_up text[]:=ARRAY[]::text[];
  v_down text[]:=ARRAY[]::text[];
  v_skill_up text[]:=ARRAY[]::text[];
  v_skill_down text[]:=ARRAY[]::text[];
  v_attention text[]:=ARRAY[]::text[];
  v_text text;
  v_old_s jsonb;
  v_new_s jsonb;
  v_delta numeric;
  v_label text;
BEGIN
  FOR v_key IN SELECT key FROM jsonb_object_keys(COALESCE(p_new->'attributes','{}'::jsonb)) key LOOP
    v_old_n:=COALESCE((p_old->'attributes'->>v_key)::numeric,0);
    v_new_n:=COALESCE((p_new->'attributes'->>v_key)::numeric,0);
    IF v_new_n>v_old_n THEN v_up:=array_append(v_up,v_key||' +'||(v_new_n-v_old_n)::integer);
    ELSIF v_new_n<v_old_n THEN v_down:=array_append(v_down,v_key||' '||(v_new_n-v_old_n)::integer);
    END IF;
  END LOOP;

  FOR v_key IN SELECT key FROM jsonb_object_keys(COALESCE(p_new->'skills','{}'::jsonb)) key LOOP
    v_old_s:=COALESCE(p_old->'skills'->v_key,'{}'::jsonb);
    v_new_s:=COALESCE(p_new->'skills'->v_key,'{}'::jsonb);
    v_label:=COALESCE(v_new_s->>'label',replace(initcap(replace(v_key,'_',' ')),'Tactical Awareness','Leitura tática'));
    v_delta:=COALESCE((v_new_s->>'level')::numeric,0)*100+COALESCE((v_new_s->>'progress')::numeric,0)
      -COALESCE((v_old_s->>'level')::numeric,0)*100-COALESCE((v_old_s->>'progress')::numeric,0);
    IF v_delta>=8 THEN v_skill_up:=array_append(v_skill_up,v_label||' +'||ROUND(v_delta)::integer||' pts');
    ELSIF v_delta<=-4 THEN v_skill_down:=array_append(v_skill_down,v_label||' '||ROUND(v_delta)::integer||' pts');
    END IF;
    IF v_new_s->>'status' IN ('low_stimulus','losing_rhythm') THEN
      v_attention:=array_append(v_attention,v_label||' · '||COALESCE(v_new_s->>'status_label','pouco estímulo'));
    END IF;
  END LOOP;

  IF COALESCE((p_new->'state'->>'form')::integer,50)<COALESCE((p_old->'state'->>'form')::integer,50) THEN v_down:=array_append(v_down,'Forma'); END IF;
  IF COALESCE((p_new->'state'->>'trust')::integer,50)<COALESCE((p_old->'state'->>'trust')::integer,50) THEN v_down:=array_append(v_down,'Relação com o treinador'); END IF;
  IF COALESCE((p_new->'state'->>'energy')::integer,100)+8<COALESCE((p_old->'state'->>'energy')::integer,100) THEN v_down:=array_append(v_down,'Energia'); END IF;
  IF COALESCE((p_new->'state'->>'fatigue')::integer,0)>COALESCE((p_old->'state'->>'fatigue')::integer,0)+8 THEN v_down:=array_append(v_down,'Estafa'); END IF;

  v_text:='Relatório de desenvolvimento — '||p_period||E'\n\nAtributos que subiram: '||CASE WHEN cardinality(v_up)>0 THEN array_to_string(v_up,', ') ELSE 'nenhum atributo principal ganhou ponto neste período' END||'.';
  v_text:=v_text||E'\nEspecialidades que avançaram: '||CASE WHEN cardinality(v_skill_up)>0 THEN array_to_string(v_skill_up[1:LEAST(6,cardinality(v_skill_up))],', ') ELSE 'nenhum avanço relevante isolado' END||'.';
  v_text:=v_text||E'\nEspecialidades que regrediram: '||CASE WHEN cardinality(v_skill_down)>0 THEN array_to_string(v_skill_down[1:LEAST(6,cardinality(v_skill_down))],', ') ELSE 'nenhuma' END||'.';
  v_text:=v_text||E'\nPouco estímulo / ritmo: '||CASE WHEN cardinality(v_attention)>0 THEN array_to_string(v_attention[1:LEAST(6,cardinality(v_attention))],', ') ELSE 'todas as áreas importantes estão recebendo manutenção suficiente' END||'.';
  v_text:=v_text||E'\nOutros pontos que pioraram ou exigem atenção: '||CASE WHEN cardinality(v_down)>0 THEN array_to_string(v_down,', ') ELSE 'nenhum indicador importante piorou' END||'.';
  v_text:=v_text||E'\nFama: '||COALESCE(p_new->'state'->>'fame','0')||' · Torcedores acompanhando: '||COALESCE(p_new->'state'->>'fanbase','0')||'.';
  RETURN v_text;
END;
$$;

COMMIT;
