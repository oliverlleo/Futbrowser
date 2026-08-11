BEGIN;

UPDATE private.career_event_templates
SET source='Companheiro',
    title='O padrão do grupo',
    body='Um dos jogadores mais experientes do elenco comenta que atitudes pequenas no dia a dia definem quem o grupo passa a confiar quando a pressão aumenta.'
WHERE event_key='mate_captain_standard';

CREATE OR REPLACE FUNCTION private.pick_teammate_dialogue_event(p_player_id uuid,p_teammate_id uuid,p_activity_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_relation int:=50;
  v_rival boolean:=false;
  v_same_position boolean:=false;
  v_form int:=50;
  v_pressure int:=25;
  v_games int:=0;
  v_fame int:=0;
  v_candidates text[];
  v_recent text[];
  v_available text[];
  v_key text;
BEGIN
  SELECT coalesce(r.relation,50),coalesce(r.rivalry,false),(ai.primary_position=j.posicao),
         coalesce(pcs.form,50),coalesce(pcs.pressure,25),coalesce(pcs.fame,0)
  INTO v_relation,v_rival,v_same_position,v_form,v_pressure,v_fame
  FROM public.player_teammate_relations r
  JOIN public.base_ai_players ai ON ai.id=r.teammate_id
  JOIN public.jogadores j ON j.id=r.player_id
  JOIN public.player_career_state pcs ON pcs.player_id=r.player_id
  WHERE r.player_id=p_player_id AND r.teammate_id=p_teammate_id;

  SELECT count(*) FILTER (WHERE appeared)
  INTO v_games
  FROM public.player_match_history
  WHERE player_id=p_player_id AND context='club';
  v_games:=coalesce(v_games,0);

  IF v_rival OR v_relation<=34 THEN
    v_candidates:=CASE WHEN v_games=0
      THEN ARRAY['mate_rival_challenge','mate_rival_contact','mate_tactical_disagreement','mate_training_tip','mate_extra_session_invite']
      ELSE ARRAY['mate_rival_challenge','mate_rival_respect','mate_rival_contact','mate_rival_media','mate_pass_complaint','mate_defensive_effort']
    END;
  ELSIF v_same_position THEN
    v_candidates:=CASE WHEN v_games=0
      THEN ARRAY['mate_rival_challenge','mate_penalty_talker','mate_tactical_disagreement','mate_training_tip','mate_extra_session_invite','mate_first_big_game']
      ELSE ARRAY['mate_rival_challenge','mate_penalty_talker','mate_tactical_disagreement','mate_training_tip','mate_extra_session_invite','mate_media_jealousy','mate_pass_complaint']
    END;
  ELSIF (v_pressure>=55 OR v_form<=42) AND v_games>=2 THEN
    v_candidates:=ARRAY['mate_support_bad_week','mate_goal_drought_support','mate_private_confidence','mate_mentor_advice','mate_recovery_warning','mate_routine_question'];
  ELSIF p_activity_key IN ('team_training_intense','team_training_normal','team_training_light','teammate_extra','watch_match_analysis') THEN
    v_candidates:=ARRAY['mate_training_tip','mate_extra_session_invite','mate_tactical_disagreement','mate_defensive_effort','mate_recovery_warning','mate_routine_question','mate_ask_help'];
  ELSIF v_relation>=70 THEN
    v_candidates:=ARRAY['mate_social_invite','mate_prank','mate_social_post','mate_private_confidence','mate_ask_help','mate_music_room','mate_contract_money','mate_mentor_advice'];
  ELSIF v_games=0 THEN
    v_candidates:=ARRAY['mate_training_tip','mate_social_invite','mate_prank','mate_mentor_advice','mate_ask_help','mate_music_room','mate_captain_standard','mate_routine_question','mate_first_big_game','mate_contract_money'];
  ELSE
    v_candidates:=ARRAY['mate_training_tip','mate_social_invite','mate_prank','mate_media_jealousy','mate_agent_rumor','mate_mentor_advice','mate_ask_help','mate_music_room','mate_social_post','mate_captain_standard','mate_leadership_test','mate_routine_question','mate_contract_money','mate_first_big_game','mate_defensive_effort'];
  END IF;

  -- Sem fama real, não cria uma conversa baseada em comparação forte da imprensa.
  IF v_fame<12 THEN
    SELECT coalesce(array_agg(c),'{}'::text[]) INTO v_candidates
    FROM unnest(v_candidates)c
    WHERE c NOT IN ('mate_rival_media','mate_media_jealousy','mate_agent_rumor');
  END IF;

  SELECT coalesce(array_agg(event_key),'{}'::text[]) INTO v_recent
  FROM (
    SELECT event_key
    FROM public.player_career_events
    WHERE player_id=p_player_id AND status='resolved' AND event_key LIKE 'mate_%'
    ORDER BY resolved_at DESC NULLS LAST,created_at DESC
    LIMIT 8
  ) x;

  SELECT coalesce(array_agg(c),'{}'::text[]) INTO v_available
  FROM unnest(v_candidates)c
  WHERE NOT (c=ANY(v_recent));

  IF cardinality(v_available)=0 THEN v_available:=v_candidates; END IF;
  IF cardinality(v_available)=0 THEN RETURN 'mate_training_tip'; END IF;
  v_key:=v_available[1+floor(random()*cardinality(v_available))::int];
  RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION private.rewrite_generic_teammate_dialogue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_event record; v_teammate uuid; v_key text; v_template record; v_name text; v_source text; v_public_choices jsonb;
BEGIN
  SELECT e.* INTO v_event
  FROM public.player_career_events e
  WHERE e.player_id=NEW.player_id AND e.status='pending'
    AND e.event_key IN ('teammate_locker_room','rival_training_tension')
    AND e.metadata->>'kind'='teammate_interaction'
  ORDER BY e.created_at DESC LIMIT 1;
  IF v_event.id IS NULL THEN RETURN NEW; END IF;

  v_teammate:=nullif(v_event.metadata->>'teammate_id','')::uuid;
  IF v_teammate IS NULL THEN RETURN NEW; END IF;
  v_key:=private.pick_teammate_dialogue_event(NEW.player_id,v_teammate,NEW.activity_key);
  SELECT * INTO v_template FROM private.career_event_templates WHERE event_key=v_key;
  SELECT name INTO v_name FROM public.base_ai_players WHERE id=v_teammate;
  IF v_template.event_key IS NULL THEN RETURN NEW; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('key',e->>'key','label',e->>'label')),'[]'::jsonb)
  INTO v_public_choices
  FROM jsonb_array_elements(v_template.choices)e;

  v_source:=CASE
    WHEN v_key='mate_captain_standard' THEN 'Companheiro experiente · '||coalesce(v_name,'Jogador do elenco')
    WHEN v_key LIKE 'mate_rival_%' THEN 'Rival · '||coalesce(v_name,'Companheiro')
    ELSE 'Companheiro · '||coalesce(v_name,'Jogador do elenco')
  END;

  UPDATE public.player_career_events
  SET event_key=v_key,
      source=v_source,
      title=v_template.title,
      body=v_template.body,
      choices=v_public_choices,
      metadata=metadata||jsonb_build_object('dialogue_engine','v3','activity',NEW.activity_key,'teammate_name',v_name)
  WHERE id=v_event.id;
  RETURN NEW;
END;
$$;

COMMIT;
