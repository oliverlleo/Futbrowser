CREATE OR REPLACE FUNCTION private.pick_interaction_teammate(p_player_id uuid)
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT r.teammate_id
  FROM public.player_teammate_relations r
  JOIN public.base_ai_players ai ON ai.id=r.teammate_id
  JOIN public.jogadores j ON j.id=r.player_id
  JOIN public.player_career_state pcs ON pcs.player_id=r.player_id
  WHERE r.player_id=p_player_id
    AND ai.club_id=pcs.club_id
  ORDER BY
    (CASE WHEN r.rivalry THEN 0.42 ELSE 0 END
      + CASE WHEN ai.primary_position=j.posicao THEN 0.28
             WHEN private.position_group(ai.primary_position::text)=private.position_group(j.posicao::text) THEN 0.14
             ELSE 0 END
      + greatest(0,55-r.relation)/180.0
      + random()*0.72) DESC
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION private.pick_teammate_dialogue_event(p_player_id uuid, p_teammate_id uuid, p_activity_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_relation int:=50; v_rival boolean:=false; v_same_position boolean:=false;
  v_form int:=50; v_pressure int:=25; v_games int:=0; v_fame int:=0;
  v_candidates text[]; v_recent text[]; v_available text[]; v_key text;
BEGIN
  SELECT coalesce(r.relation,50),coalesce(r.rivalry,false),(ai.primary_position=j.posicao),
         coalesce(pcs.form,50),coalesce(pcs.pressure,25),coalesce(pcs.fame,0)
  INTO v_relation,v_rival,v_same_position,v_form,v_pressure,v_fame
  FROM public.player_teammate_relations r
  JOIN public.base_ai_players ai ON ai.id=r.teammate_id
  JOIN public.jogadores j ON j.id=r.player_id
  JOIN public.player_career_state pcs ON pcs.player_id=r.player_id
  WHERE r.player_id=p_player_id AND r.teammate_id=p_teammate_id AND ai.club_id=pcs.club_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*) FILTER (WHERE appeared) INTO v_games
  FROM public.player_match_history WHERE player_id=p_player_id AND context='club';
  v_games:=coalesce(v_games,0);

  IF v_rival OR v_relation<=34 THEN
    v_candidates:=CASE WHEN v_games=0
      THEN ARRAY['mate_rival_challenge','mate_rival_contact','mate_tactical_disagreement','mate_training_tip','mate_extra_session_invite']
      ELSE ARRAY['mate_rival_challenge','mate_rival_respect','mate_rival_contact','mate_rival_media','mate_pass_complaint','mate_defensive_effort'] END;
  ELSIF v_same_position THEN
    v_candidates:=CASE WHEN v_games=0
      THEN ARRAY['mate_rival_challenge','mate_penalty_talker','mate_tactical_disagreement','mate_training_tip','mate_extra_session_invite','mate_first_big_game']
      ELSE ARRAY['mate_rival_challenge','mate_penalty_talker','mate_tactical_disagreement','mate_training_tip','mate_extra_session_invite','mate_media_jealousy','mate_pass_complaint'] END;
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

  IF v_fame<12 THEN
    SELECT coalesce(array_agg(c),'{}'::text[]) INTO v_candidates
    FROM unnest(v_candidates)c WHERE c NOT IN ('mate_rival_media','mate_media_jealousy','mate_agent_rumor');
  END IF;

  SELECT coalesce(array_agg(event_key),'{}'::text[]) INTO v_recent
  FROM (SELECT event_key FROM public.player_career_events
        WHERE player_id=p_player_id AND status='resolved' AND event_key LIKE 'mate_%'
        ORDER BY resolved_at DESC NULLS LAST,created_at DESC LIMIT 8) x;

  SELECT coalesce(array_agg(c),'{}'::text[]) INTO v_available
  FROM unnest(v_candidates)c JOIN private.career_event_templates t ON t.event_key=c
  WHERE NOT (c=ANY(v_recent));
  IF cardinality(v_available)=0 THEN
    SELECT coalesce(array_agg(c),'{}'::text[]) INTO v_available
    FROM unnest(v_candidates)c JOIN private.career_event_templates t ON t.event_key=c;
  END IF;
  IF cardinality(v_available)=0 THEN RETURN NULL; END IF;
  v_key:=v_available[1+floor(random()*cardinality(v_available))::int];
  RETURN v_key;
END;
$function$;

CREATE OR REPLACE FUNCTION private.after_career_action_engine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_state record; v_prob numeric; v_event uuid; v_teammate uuid; v_name text; v_relation int; v_rival boolean;
  v_opp record; v_reward int; v_training_prob numeric;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=NEW.player_id FOR UPDATE;
  IF NEW.activity_key='sponsor_event' THEN
    SELECT * INTO v_opp FROM public.player_sponsor_opportunities
    WHERE player_id=NEW.player_id AND status='available' AND available_from<=v_state.career_date AND expires_on>=v_state.career_date
    ORDER BY created_at LIMIT 1 FOR UPDATE;
    IF v_opp.id IS NOT NULL THEN
      v_reward:=v_opp.reward;
      UPDATE public.player_sponsor_opportunities SET status='completed',completed_at=now() WHERE id=v_opp.id;
      UPDATE public.player_career_state SET cash_balance=cash_balance+v_reward,fame=LEAST(100,fame+2),fanbase=fanbase+30 WHERE player_id=NEW.player_id;
    END IF;
  ELSIF NEW.activity_key='fan_meet' THEN UPDATE public.player_career_state SET fame=LEAST(100,fame+1),fanbase=fanbase+45 WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='community_action' THEN UPDATE public.player_career_state SET fame=LEAST(100,fame+1),fanbase=fanbase+25 WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='media_interview' THEN UPDATE public.player_career_state SET fame=LEAST(100,fame+1),fanbase=fanbase+10 WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='social_media_post' THEN UPDATE public.player_career_state SET fanbase=fanbase+12 WHERE player_id=NEW.player_id;
  END IF;

  IF EXISTS(SELECT 1 FROM public.player_career_events WHERE player_id=NEW.player_id AND status='pending') THEN
    PERFORM private.maybe_generate_sponsor_opportunity(NEW.player_id); RETURN NEW;
  END IF;

  IF NEW.activity_key='night_out' THEN
    v_prob:=private.context_event_probability(NEW.player_id,0.08,0.20);
    IF random()<v_prob THEN
      IF v_state.next_match_date IS NOT NULL AND v_state.next_match_date-v_state.career_date<=1 THEN
        v_event:=private.spawn_context_event(NEW.player_id,'night_out_pregame_buzz',jsonb_build_object('activity_date',NEW.career_date));
      ELSE v_event:=private.spawn_context_event(NEW.player_id,'night_out_headline',jsonb_build_object('activity_date',NEW.career_date)); END IF;
    END IF;
  ELSIF NEW.activity_key='team_training_skip' THEN
    v_prob:=private.context_event_probability(NEW.player_id,0.38,0.18);
    IF random()<v_prob THEN v_event:=private.spawn_context_event(NEW.player_id,'missed_training_confrontation',jsonb_build_object('activity_date',NEW.career_date)); END IF;
  ELSIF NEW.activity_key='team_training_intense' THEN
    IF random()<0.09 THEN v_event:=private.spawn_context_event(NEW.player_id,'coach_load_conversation',jsonb_build_object('activity_date',NEW.career_date)); END IF;
  ELSIF NEW.category='training' THEN
    v_training_prob:=CASE WHEN NEW.activity_key='teammate_extra' THEN 0.28 ELSE 0.07 END;
    IF random()<v_training_prob THEN v_event:=private.spawn_context_event(NEW.player_id,'coach_extra_training',jsonb_build_object('activity',NEW.activity_key)); END IF;
  ELSIF NEW.category='social' AND v_state.fame>=15 THEN
    v_prob:=private.context_event_probability(NEW.player_id,0.025,0.02);
    IF random()<v_prob THEN v_event:=private.spawn_context_event(NEW.player_id,'fans_spot_player_off_pitch',jsonb_build_object('activity',NEW.activity_key)); END IF;
  END IF;

  IF v_event IS NULL AND (v_state.last_interaction_date IS NULL OR v_state.last_interaction_date<NEW.career_date) AND random()<0.10 THEN
    IF random()<0.50 THEN
      v_event:=private.spawn_context_event(NEW.player_id,'coach_weekly_checkin',jsonb_build_object('kind','coach_interaction'));
    ELSE
      PERFORM private.ensure_teammate_relations(NEW.player_id);
      v_teammate:=private.pick_interaction_teammate(NEW.player_id);
      IF v_teammate IS NOT NULL THEN
        SELECT ai.name,r.relation,r.rivalry INTO v_name,v_relation,v_rival
        FROM public.base_ai_players ai
        JOIN public.player_teammate_relations r ON r.teammate_id=ai.id AND r.player_id=NEW.player_id
        JOIN public.player_career_state pcs ON pcs.player_id=r.player_id
        WHERE ai.id=v_teammate AND ai.club_id=pcs.club_id;
        IF FOUND THEN
          IF v_rival OR v_relation<=32 THEN
            v_event:=private.spawn_context_event(NEW.player_id,'rival_training_tension',jsonb_build_object('teammate_id',v_teammate,'kind','teammate_interaction'),v_name,NULL);
          ELSE
            v_event:=private.spawn_context_event(NEW.player_id,'teammate_locker_room',jsonb_build_object('teammate_id',v_teammate,'kind','teammate_interaction'),v_name,NULL);
          END IF;
        END IF;
      END IF;
    END IF;
    IF v_event IS NOT NULL THEN UPDATE public.player_career_state SET last_interaction_date=NEW.career_date WHERE player_id=NEW.player_id; END IF;
  END IF;
  PERFORM private.maybe_generate_sponsor_opportunity(NEW.player_id); RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_zzzz_rewrite_teammate_dialogue ON public.player_career_actions;
CREATE TRIGGER trg_zzzz_rewrite_teammate_dialogue AFTER INSERT ON public.player_career_actions
FOR EACH ROW EXECUTE FUNCTION private.rewrite_generic_teammate_dialogue();

CREATE OR REPLACE FUNCTION private.calculate_selection_projection(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_state record;v_player record;v_contract record;v_role text;v_ovr int;v_comp int;v_score numeric;v_status text;v_reason text;v_team_normal int:=0;v_team_intense int:=0;v_team_light int:=0;v_skips int:=0;v_individual int:=0;v_pregame_nights int:=0;v_readiness int;v_role_base int;v_starter_threshold int;v_bench_threshold int;v_severe boolean:=false;v_hard_out boolean:=false;
DECLARE v_rival_name text;v_rival_ovr int;v_rival_relation int;v_rival_modifier numeric:=0;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
 SELECT * INTO v_player FROM public.jogadores WHERE id=p_player_id;
 SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
 IF v_contract.id IS NULL THEN RETURN jsonb_build_object('status','out','score',0,'reason','Sem contrato ativo.');END IF;
 v_role:=coalesce(v_state.hierarchy,v_contract.squad_role);v_ovr:=public.calculate_player_ovr(v_player.atributos);
 SELECT coalesce(max(ai.ovr),(SELECT round(avg(ai2.ovr))::int FROM public.base_ai_players ai2 WHERE ai2.club_id=v_state.club_id)) INTO v_comp
 FROM public.base_ai_players ai
 WHERE ai.club_id=v_state.club_id AND ai.primary_position=v_player.posicao
   AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability av WHERE av.player_id=p_player_id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date AND av.status='out');
 SELECT ai.name,ai.ovr,r.relation INTO v_rival_name,v_rival_ovr,v_rival_relation
 FROM public.player_teammate_relations r JOIN public.base_ai_players ai ON ai.id=r.teammate_id
 WHERE r.player_id=p_player_id AND r.rivalry=true AND ai.club_id=v_state.club_id AND ai.primary_position=v_player.posicao
   AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability av WHERE av.player_id=p_player_id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date AND av.status='out')
 ORDER BY ai.ovr DESC,r.relation ASC LIMIT 1;
 IF v_rival_name IS NOT NULL THEN
   v_rival_modifier:=CASE WHEN v_state.form>=60 THEN 2.5 WHEN v_state.form>=50 THEN 1.0 WHEN v_state.form<40 THEN -2.5 ELSE -1.0 END;
 END IF;
 SELECT count(*) FILTER(WHERE activity_key='team_training_normal'),count(*) FILTER(WHERE activity_key='team_training_intense'),count(*) FILTER(WHERE activity_key='team_training_light'),count(*) FILTER(WHERE activity_key='team_training_skip'),count(*) FILTER(WHERE category='training'),count(*) FILTER(WHERE activity_key='night_out' AND career_date>=v_state.next_match_date-2)
 INTO v_team_normal,v_team_intense,v_team_light,v_skips,v_individual,v_pregame_nights
 FROM public.player_career_actions WHERE player_id=p_player_id AND career_date>=v_state.career_date-6;
 v_readiness:=private.career_readiness_score(p_player_id);
 v_role_base:=CASE v_role WHEN 'Estrela' THEN 80 WHEN 'Titular' THEN 73 WHEN 'Rotação' THEN 58 WHEN 'Reserva' THEN 45 WHEN 'Promessa' THEN 38 ELSE 48 END;
 v_starter_threshold:=CASE v_role WHEN 'Estrela' THEN 59 WHEN 'Titular' THEN 63 WHEN 'Rotação' THEN 70 WHEN 'Reserva' THEN 77 WHEN 'Promessa' THEN 82 ELSE 72 END;
 v_bench_threshold:=CASE v_role WHEN 'Estrela' THEN 30 WHEN 'Titular' THEN 34 WHEN 'Rotação' THEN 45 WHEN 'Reserva' THEN 42 WHEN 'Promessa' THEN 38 ELSE 44 END;
 v_score:=v_role_base+(v_state.trust-50)*0.34+(v_state.form-50)*0.24+(v_state.locker_room_relation-50)*0.08+(v_readiness-70)*0.16+(v_ovr-coalesce(v_comp,v_ovr))*1.35+v_team_normal*3+v_team_intense*4+v_team_light*1.5+least(5,v_individual)-v_skips*14-v_pregame_nights*14+v_rival_modifier;
 v_severe:=v_state.injury_days>0 OR v_skips>=2 OR v_state.trust<20 OR(v_pregame_nights>=1 AND v_state.trust<35 AND v_state.form<40);
 v_hard_out:=v_state.injury_days>0 OR v_readiness<22 OR(v_state.trust<15 AND v_state.form<30) OR(v_skips>=2 AND v_state.trust<35) OR(v_pregame_nights>=2 AND v_state.trust<30);
 IF v_state.injury_days>0 THEN v_status:='out';v_reason:='O departamento médico não liberou você para a partida.';
 ELSIF v_role IN('Titular','Estrela') AND v_hard_out THEN v_status:='out';v_reason:='Sua condição, preparação ou relação com a comissão tirou você da relação.';
 ELSIF v_score>=v_starter_threshold THEN v_status:='starter';v_reason:='Sua semana, condição e concorrência sustentam uma vaga no time inicial.';
 ELSIF v_role IN('Titular','Estrela') AND NOT v_severe THEN v_status:='bench';v_reason:='Você perdeu força para começar jogando, mas segue relacionado.';
 ELSIF v_score>=v_bench_threshold THEN v_status:='bench';v_reason:='Você está entre os relacionados, mas ainda não garantiu a titularidade.';
 ELSE v_status:='out';v_reason:='A combinação de forma, concorrência e semana deixou você fora da relação.';END IF;
 RETURN jsonb_build_object('status',v_status,'score',round(v_score,1),'reason',v_reason,'player_ovr',v_ovr,'competitor_ovr',v_comp,'readiness',v_readiness,'team_sessions',v_team_normal+v_team_intense+v_team_light,'missed_sessions',v_skips,'extra_training',v_individual,'pregame_nights',v_pregame_nights,'performance_context',private.current_performance_context(p_player_id),'rivalry',jsonb_build_object('active',v_rival_name IS NOT NULL,'name',v_rival_name,'ovr',v_rival_ovr,'relation',v_rival_relation,'selection_modifier',v_rival_modifier));
END $function$;