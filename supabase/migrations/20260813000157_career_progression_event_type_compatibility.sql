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
  SELECT v_player,COALESCE(career_date,CURRENT_DATE),'gain',p_attribute,12,
    jsonb_build_object(
      'source','career_evolution_point',
      'before_value',v_before_value,'after_value',v_after_value,
      'before_progress',COALESCE(v_before_progress,0),'after_progress',COALESCE(v_after_progress,0)
    )
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
  VALUES(p_player_id,p_match_date,'gain',ROUND(v_total,2),jsonb_build_object(
    'source','match_gameplay',
    'minutes',p_minutes,'goals',COALESCE(p_goals,0),'assists',COALESCE(p_assists,0),
    'decisions',jsonb_array_length(v_history),'reason','A experiência real da partida alimentou as habilidades usadas em campo.'
  ));
END;
$$;