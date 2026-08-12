BEGIN;

ALTER TABLE public.player_career_state
  ADD COLUMN IF NOT EXISTS next_day_energy_boost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_day_fatigue_recovery integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS injury_prevention_until date,
  ADD COLUMN IF NOT EXISTS mental_stability_until date,
  ADD COLUMN IF NOT EXISTS nutrition_boost_until date;

CREATE OR REPLACE FUNCTION private.position_group(p_position text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path=''
AS $$
  SELECT CASE
    WHEN p_position='Goleiro' THEN 'goalkeeper'
    WHEN p_position IN ('Zagueiro','Lateral Direito','Lateral Esquerdo','Volante') THEN 'defender'
    WHEN p_position IN ('Meio-Campo','Meia Direita','Meia Esquerda') THEN 'midfielder'
    WHEN p_position IN ('Ponta Direita','Ponta Esquerda') THEN 'winger'
    WHEN p_position='Atacante' THEN 'attacker'
    ELSE 'midfielder' END
$$;

CREATE OR REPLACE FUNCTION private.position_skill_development_multiplier(p_player_id uuid,p_skill_key text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_group text;
BEGIN
  SELECT private.position_group(posicao) INTO v_group FROM public.jogadores WHERE id=p_player_id;
  RETURN CASE v_group
    WHEN 'goalkeeper' THEN CASE p_skill_key WHEN 'positioning' THEN 1.10 WHEN 'tactical_awareness' THEN 1.08 WHEN 'strength' THEN 1.03 WHEN 'stamina' THEN 1.00 ELSE 0.92 END
    WHEN 'defender' THEN CASE p_skill_key WHEN 'marking' THEN 1.10 WHEN 'tactical_awareness' THEN 1.08 WHEN 'strength' THEN 1.06 WHEN 'heading' THEN 1.06 WHEN 'stamina' THEN 1.03 WHEN 'short_pass' THEN 1.01 ELSE 0.96 END
    WHEN 'midfielder' THEN CASE p_skill_key WHEN 'short_pass' THEN 1.10 WHEN 'long_pass' THEN 1.08 WHEN 'tactical_awareness' THEN 1.07 WHEN 'positioning' THEN 1.06 WHEN 'stamina' THEN 1.03 WHEN 'dribbling' THEN 1.02 ELSE 0.97 END
    WHEN 'winger' THEN CASE p_skill_key WHEN 'sprint' THEN 1.10 WHEN 'dribbling' THEN 1.10 WHEN 'crossing' THEN 1.08 WHEN 'stamina' THEN 1.03 WHEN 'finishing_touch' THEN 1.02 WHEN 'positioning' THEN 1.02 ELSE 0.96 END
    WHEN 'attacker' THEN CASE p_skill_key WHEN 'finishing_touch' THEN 1.10 WHEN 'positioning' THEN 1.08 WHEN 'heading' THEN 1.06 WHEN 'sprint' THEN 1.05 WHEN 'dribbling' THEN 1.03 WHEN 'penalties' THEN 1.03 ELSE 0.96 END
    ELSE 1.00 END;
END;
$$;

CREATE OR REPLACE FUNCTION private.skill_attribute_weights(p_player_id uuid,p_skill_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_group text;
BEGIN
  SELECT private.position_group(posicao) INTO v_group FROM public.jogadores WHERE id=p_player_id;
  RETURN CASE p_skill_key
    WHEN 'dribbling' THEN CASE v_group
      WHEN 'attacker' THEN '{"Velocidade":0.12,"Passe":0.08,"Finalização":0.08}'::jsonb
      WHEN 'winger' THEN '{"Velocidade":0.14,"Passe":0.10,"Finalização":0.04}'::jsonb
      WHEN 'midfielder' THEN '{"Passe":0.14,"Visão de jogo":0.08,"Velocidade":0.06}'::jsonb
      ELSE '{"Velocidade":0.10,"Passe":0.10,"Físico":0.08}'::jsonb END
    WHEN 'free_kicks' THEN '{"Passe":0.12,"Finalização":0.10,"Visão de jogo":0.06}'::jsonb
    WHEN 'penalties' THEN '{"Finalização":0.28}'::jsonb
    WHEN 'short_pass' THEN '{"Passe":0.18,"Visão de jogo":0.10}'::jsonb
    WHEN 'long_pass' THEN '{"Passe":0.16,"Visão de jogo":0.12}'::jsonb
    WHEN 'crossing' THEN CASE WHEN v_group IN ('winger','attacker') THEN '{"Passe":0.16,"Visão de jogo":0.06,"Finalização":0.06}'::jsonb ELSE '{"Passe":0.18,"Visão de jogo":0.10}'::jsonb END
    WHEN 'positioning' THEN CASE
      WHEN v_group IN ('goalkeeper','defender') THEN '{"Visão de jogo":0.14,"Marcação":0.14}'::jsonb
      WHEN v_group='attacker' THEN '{"Visão de jogo":0.12,"Finalização":0.16}'::jsonb
      WHEN v_group='winger' THEN '{"Visão de jogo":0.14,"Finalização":0.08,"Velocidade":0.06}'::jsonb
      ELSE '{"Visão de jogo":0.20,"Passe":0.08}'::jsonb END
    WHEN 'tactical_awareness' THEN CASE
      WHEN v_group IN ('goalkeeper','defender') THEN '{"Visão de jogo":0.14,"Marcação":0.14}'::jsonb
      WHEN v_group='attacker' THEN '{"Visão de jogo":0.18,"Finalização":0.10}'::jsonb
      ELSE '{"Visão de jogo":0.20,"Marcação":0.08}'::jsonb END
    WHEN 'sprint' THEN '{"Velocidade":0.22,"Físico":0.06}'::jsonb
    WHEN 'stamina' THEN '{"Físico":0.22,"Velocidade":0.06}'::jsonb
    WHEN 'strength' THEN CASE WHEN v_group='defender' THEN '{"Físico":0.24,"Marcação":0.04}'::jsonb WHEN v_group='attacker' THEN '{"Físico":0.24,"Finalização":0.04}'::jsonb ELSE '{"Físico":0.28}'::jsonb END
    WHEN 'heading' THEN CASE WHEN v_group='defender' THEN '{"Físico":0.16,"Marcação":0.12}'::jsonb ELSE '{"Físico":0.14,"Finalização":0.14}'::jsonb END
    WHEN 'finishing_touch' THEN '{"Finalização":0.28}'::jsonb
    WHEN 'marking' THEN '{"Marcação":0.22,"Visão de jogo":0.06}'::jsonb
    ELSE '{}'::jsonb END;
END;
$$;

CREATE OR REPLACE FUNCTION private.add_skill_progress(p_player_id uuid,p_skill_key text,p_points numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_row record; v_state record; v_total numeric; v_gain integer; v_bonus numeric:=0; v_quality numeric:=1;
  v_position_mult numeric:=1; v_adjusted numeric; v_weights jsonb; v_pair record; v_modifier_key text; v_old_level integer;
BEGIN
  IF p_points<=0 THEN RETURN; END IF;
  PERFORM private.sync_development_baselines(p_player_id);
  SELECT * INTO v_row FROM public.player_skill_development WHERE player_id=p_player_id AND skill_key=p_skill_key FOR UPDATE;
  IF v_row.player_id IS NULL OR v_row.level>=99 THEN RETURN; END IF;
  SELECT career_date,evolution_modifiers INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  v_modifier_key:=CASE WHEN p_skill_key='sprint' THEN 'speed_pct' WHEN p_skill_key IN ('stamina','strength','heading') THEN 'physical_pct' WHEN p_skill_key IN ('positioning','tactical_awareness','marking') THEN 'tactical_pct' ELSE 'technical_pct' END;
  v_bonus:=COALESCE((v_state.evolution_modifiers->>v_modifier_key)::numeric,0);
  v_quality:=private.training_absorption_multiplier(p_player_id,p_skill_key);
  v_position_mult:=private.position_skill_development_multiplier(p_player_id,p_skill_key);
  v_adjusted:=GREATEST(0.10,p_points*(1+(v_bonus/100.0))*v_quality*v_position_mult);
  v_old_level:=v_row.level;
  v_total:=v_row.progress+v_adjusted;
  v_gain:=FLOOR(v_total/100)::integer;
  v_row.level:=LEAST(99,v_row.level+v_gain);
  v_row.progress:=CASE WHEN v_row.level>=99 THEN 0 ELSE MOD(v_total,100) END;
  UPDATE public.player_skill_development SET level=v_row.level,progress=v_row.progress,last_stimulated_on=COALESCE(v_state.career_date,CURRENT_DATE),updated_at=now() WHERE player_id=p_player_id AND skill_key=p_skill_key;
  v_weights:=private.skill_attribute_weights(p_player_id,p_skill_key);
  FOR v_pair IN SELECT key,value FROM jsonb_each_text(v_weights) LOOP
    PERFORM private.add_attribute_progress(p_player_id,v_pair.key,v_adjusted*v_pair.value::numeric);
  END LOOP;
  INSERT INTO public.player_development_events(player_id,career_date,event_type,skill_key,amount,metadata)
  VALUES(p_player_id,COALESCE(v_state.career_date,CURRENT_DATE),CASE WHEN v_row.level>v_old_level THEN 'level_up' ELSE 'gain' END,p_skill_key,v_adjusted,
    jsonb_build_object('quality',v_quality,'position_multiplier',v_position_mult,'evolution_bonus_pct',v_bonus,'raw_points',p_points,'from_level',v_old_level,'to_level',v_row.level));
END;
$$;

CREATE OR REPLACE FUNCTION private.career_injury_risk_multiplier(p_player_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v record; v_mult numeric:=1;
BEGIN
  SELECT career_date,injury_prevention_until INTO v FROM public.player_career_state WHERE player_id=p_player_id;
  IF v.injury_prevention_until IS NOT NULL AND v.injury_prevention_until>=v.career_date THEN v_mult:=v_mult*0.78; END IF;
  IF EXISTS(SELECT 1 FROM public.player_career_actions WHERE player_id=p_player_id AND activity_key='mobility' AND career_date>=v.career_date-1) THEN v_mult:=v_mult*0.90; END IF;
  IF EXISTS(SELECT 1 FROM public.player_career_actions WHERE player_id=p_player_id AND activity_key='sauna' AND career_date>=v.career_date-1) THEN v_mult:=v_mult*0.95; END IF;
  RETURN GREATEST(0.55,LEAST(1.00,v_mult));
END;
$$;

CREATE OR REPLACE FUNCTION private.career_readiness_score(p_player_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v record; v_bonus integer:=0;
BEGIN
  SELECT * INTO v FROM public.player_career_state WHERE player_id=p_player_id;
  IF v.mental_stability_until IS NOT NULL AND v.mental_stability_until>=v.career_date THEN v_bonus:=4; END IF;
  RETURN private.career_clamp(ROUND(
    v.energy*0.42 + (100-v.fatigue)*0.27 + v.morale*0.11 + v.form*0.10 + (100-v.pressure)*0.10 + v_bonus
    - CASE WHEN v.injury_days>0 THEN 25 ELSE 0 END
  )::integer);
END;
$$;

CREATE OR REPLACE FUNCTION private.current_performance_context(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_state record; v_attrs jsonb; v_strength numeric:=0; v_heading numeric:=0; v_dribble numeric:=0; v_stamina numeric:=0;
  v_tactical numeric:=0; v_freshness numeric; v_mental numeric; v_duel numeric; v_shield numeric; v_aerial numeric; v_prep numeric;
  v_night_penalty integer:=0; v_psych integer:=0;
BEGIN
  SELECT s.*,j.atributos INTO v_state FROM public.player_career_state s JOIN public.jogadores j ON j.id=s.player_id WHERE s.player_id=p_player_id;
  v_attrs:=COALESCE(v_state.atributos,'{}'::jsonb);
  SELECT COALESCE(MAX(level) FILTER(WHERE skill_key='strength'),0),COALESCE(MAX(level) FILTER(WHERE skill_key='heading'),0),
         COALESCE(MAX(level) FILTER(WHERE skill_key='dribbling'),0),COALESCE(MAX(level) FILTER(WHERE skill_key='stamina'),0),
         COALESCE(MAX(level) FILTER(WHERE skill_key='tactical_awareness'),0)
  INTO v_strength,v_heading,v_dribble,v_stamina,v_tactical
  FROM public.player_skill_development WHERE player_id=p_player_id;
  IF v_state.mental_stability_until IS NOT NULL AND v_state.mental_stability_until>=v_state.career_date THEN v_psych:=8; END IF;
  SELECT COUNT(*)*7 INTO v_night_penalty FROM public.player_career_actions WHERE player_id=p_player_id AND activity_key='night_out' AND career_date>=v_state.career_date-2;
  v_freshness:=LEAST(100,GREATEST(0,v_state.energy*0.55+(100-v_state.fatigue)*0.45));
  v_mental:=LEAST(100,GREATEST(0,v_state.morale*0.45+(100-v_state.pressure)*0.35+v_state.trust*0.20+v_psych));
  v_duel:=LEAST(99,GREATEST(1,v_strength*0.55+COALESCE((v_attrs->>'Físico')::numeric,50)*0.45));
  v_shield:=LEAST(99,GREATEST(1,v_strength*0.40+v_dribble*0.35+COALESCE((v_attrs->>'Físico')::numeric,50)*0.25));
  v_aerial:=LEAST(99,GREATEST(1,v_heading*0.50+v_strength*0.25+COALESCE((v_attrs->>'Físico')::numeric,50)*0.25));
  v_prep:=LEAST(100,GREATEST(0,v_freshness*0.45+v_mental*0.25+v_state.form*0.20+v_state.trust*0.10-v_night_penalty));
  RETURN jsonb_build_object(
    'readiness',private.career_readiness_score(p_player_id),'freshness',ROUND(v_freshness),'mental_stability',ROUND(v_mental),
    'duel_power',ROUND(v_duel),'ball_shielding',ROUND(v_shield),'aerial_power',ROUND(v_aerial),'stamina_level',ROUND(v_stamina),'tactical_level',ROUND(v_tactical),
    'preparation_score',ROUND(v_prep),'injury_risk_multiplier',private.career_injury_risk_multiplier(p_player_id),
    'hooks_ready',true
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.after_contextual_activity_tradeoffs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v record; v_to_match integer:=99; v_extra_fans integer:=0;
BEGIN
  SELECT * INTO v FROM public.player_career_state WHERE player_id=NEW.player_id FOR UPDATE;
  IF v.next_match_date IS NOT NULL THEN v_to_match:=v.next_match_date-v.career_date; END IF;

  IF NEW.activity_key='rest_home' AND v.fatigue>=45 THEN
    UPDATE public.player_career_state SET energy=private.career_clamp(energy+2),fatigue=private.career_clamp(fatigue-2) WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='early_sleep' THEN
    UPDATE public.player_career_state SET next_day_energy_boost=GREATEST(next_day_energy_boost,8),next_day_fatigue_recovery=GREATEST(next_day_fatigue_recovery,4) WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='sauna' AND v.fatigue>=45 THEN
    UPDATE public.player_career_state SET fatigue=private.career_clamp(fatigue-3) WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='physio' THEN
    UPDATE public.player_career_state SET injury_prevention_until=GREATEST(COALESCE(injury_prevention_until,v.career_date),v.career_date+2) WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='nutrition_session' THEN
    UPDATE public.player_career_state SET next_day_energy_boost=GREATEST(next_day_energy_boost,3),next_day_fatigue_recovery=GREATEST(next_day_fatigue_recovery,2),nutrition_boost_until=GREATEST(COALESCE(nutrition_boost_until,v.career_date),v.career_date+1) WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='sports_psychologist' THEN
    UPDATE public.player_career_state SET mental_stability_until=GREATEST(COALESCE(mental_stability_until,v.career_date),v.career_date+3) WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='family_time' AND v.pressure>=50 THEN
    UPDATE public.player_career_state SET morale=private.career_clamp(morale+2),pressure=private.career_clamp(pressure-3) WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='gaming_friends' THEN
    IF v_to_match<=1 AND NEW.day_period=2 THEN
      UPDATE public.player_career_state SET energy=private.career_clamp(energy-2),fatigue=private.career_clamp(fatigue+1) WHERE player_id=NEW.player_id;
    ELSIF v.pressure>=50 THEN
      UPDATE public.player_career_state SET pressure=private.career_clamp(pressure-2) WHERE player_id=NEW.player_id;
    END IF;
  ELSIF NEW.activity_key='team_hangout' THEN
    IF v_to_match<=1 AND NEW.day_period=2 THEN
      UPDATE public.player_career_state SET energy=private.career_clamp(energy-2) WHERE player_id=NEW.player_id;
    ELSIF v_to_match>1 THEN
      UPDATE public.player_career_state SET locker_room_relation=private.career_clamp(locker_room_relation+1) WHERE player_id=NEW.player_id;
    END IF;
  END IF;

  IF NEW.activity_key IN ('media_interview','social_media_post','fan_meet','community_action') THEN
    v_extra_fans:=CASE NEW.activity_key
      WHEN 'social_media_post' THEN ROUND(COALESCE(v.fame,0)*2.0)::integer
      WHEN 'fan_meet' THEN ROUND(COALESCE(v.fame,0)*2.5)::integer
      WHEN 'community_action' THEN ROUND(COALESCE(v.fame,0)*1.5)::integer
      ELSE ROUND(COALESCE(v.fame,0)*1.2)::integer END;
    UPDATE public.player_career_state SET fanbase=GREATEST(0,fanbase+v_extra_fans),pressure=private.career_clamp(pressure+CASE WHEN fame>=40 AND NEW.activity_key IN ('media_interview','social_media_post') THEN 1 ELSE 0 END) WHERE player_id=NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_zz_contextual_activity_tradeoffs ON public.player_career_actions;
CREATE TRIGGER trg_zz_contextual_activity_tradeoffs AFTER INSERT ON public.player_career_actions FOR EACH ROW EXECUTE FUNCTION private.after_contextual_activity_tradeoffs();

CREATE OR REPLACE FUNCTION private.after_career_date_recovery_boost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF NEW.career_date IS DISTINCT FROM OLD.career_date THEN
    UPDATE public.player_career_state
    SET energy=private.career_clamp(energy+next_day_energy_boost),
        fatigue=private.career_clamp(fatigue-next_day_fatigue_recovery),
        next_day_energy_boost=0,
        next_day_fatigue_recovery=0
    WHERE player_id=NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_career_date_recovery_boost ON public.player_career_state;
CREATE TRIGGER trg_career_date_recovery_boost AFTER UPDATE OF career_date ON public.player_career_state FOR EACH ROW WHEN (OLD.career_date IS DISTINCT FROM NEW.career_date) EXECUTE FUNCTION private.after_career_date_recovery_boost();

DO $$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef('public.perform_career_activity(text,text,integer)'::regprocedure) INTO v_def;
  IF position('private.career_injury_risk_multiplier' IN v_def)=0 THEN
    v_new:=regexp_replace(v_def,'PERFORM private\.apply_career_effects\(v_player\.id,\s*v_effects\);',E'v_risk := v_risk * private.career_injury_risk_multiplier(v_player.id);\n  PERFORM private.apply_career_effects(v_player.id,v_effects);');
    IF v_new=v_def THEN RAISE EXCEPTION 'Não foi possível ligar prevenção ao risco de lesão.'; END IF;
    EXECUTE v_new;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.calculate_selection_projection(p_player_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record; v_player record; v_contract record; v_ovr int; v_comp int; v_score numeric; v_status text; v_reason text; v_team_normal int:=0; v_team_intense int:=0; v_team_light int:=0; v_skips int:=0; v_individual int:=0; v_pregame_nights int:=0; v_readiness int; v_role_base int; v_starter_threshold int; v_bench_threshold int; v_severe boolean:=false; v_hard_out boolean:=false;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO v_player FROM public.jogadores WHERE id=p_player_id;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  IF v_contract.id IS NULL THEN RETURN jsonb_build_object('status','out','score',0,'reason','Sem contrato ativo.'); END IF;
  v_ovr:=public.calculate_player_ovr(v_player.atributos);
  SELECT COALESCE(MAX(ai.ovr),(SELECT ROUND(AVG(ai2.ovr))::int FROM public.base_ai_players ai2 WHERE ai2.club_id=v_contract.club_id)) INTO v_comp FROM public.base_ai_players ai WHERE ai.club_id=v_contract.club_id AND ai.primary_position=v_player.posicao AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability av WHERE av.player_id=p_player_id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date AND av.status='out');
  SELECT COUNT(*) FILTER(WHERE activity_key='team_training_normal'),COUNT(*) FILTER(WHERE activity_key='team_training_intense'),COUNT(*) FILTER(WHERE activity_key='team_training_light'),COUNT(*) FILTER(WHERE activity_key='team_training_skip'),COUNT(*) FILTER(WHERE category='training'),COUNT(*) FILTER(WHERE activity_key='night_out' AND career_date>=v_state.next_match_date-2)
  INTO v_team_normal,v_team_intense,v_team_light,v_skips,v_individual,v_pregame_nights FROM public.player_career_actions WHERE player_id=p_player_id AND career_date>=v_state.career_date-6;
  v_readiness:=private.career_readiness_score(p_player_id);
  v_role_base:=CASE v_contract.squad_role WHEN 'Estrela' THEN 80 WHEN 'Titular' THEN 73 WHEN 'Rotação' THEN 58 WHEN 'Reserva' THEN 45 WHEN 'Promessa' THEN 38 ELSE 48 END;
  v_starter_threshold:=CASE v_contract.squad_role WHEN 'Estrela' THEN 59 WHEN 'Titular' THEN 63 WHEN 'Rotação' THEN 70 WHEN 'Reserva' THEN 77 WHEN 'Promessa' THEN 82 ELSE 72 END;
  v_bench_threshold:=CASE v_contract.squad_role WHEN 'Estrela' THEN 30 WHEN 'Titular' THEN 34 WHEN 'Rotação' THEN 45 WHEN 'Reserva' THEN 42 WHEN 'Promessa' THEN 38 ELSE 44 END;
  v_score:=v_role_base+(v_state.trust-50)*0.34+(v_state.form-50)*0.24+(v_state.locker_room_relation-50)*0.08+(v_readiness-70)*0.16+(v_ovr-COALESCE(v_comp,v_ovr))*1.35+v_team_normal*3+v_team_intense*4+v_team_light*1.5+LEAST(5,v_individual)-v_skips*14-v_pregame_nights*14;
  v_severe:=v_state.injury_days>0 OR v_skips>=2 OR v_state.trust<20 OR(v_pregame_nights>=1 AND v_state.trust<35 AND v_state.form<40);
  v_hard_out:=v_state.injury_days>0 OR v_readiness<22 OR(v_state.trust<15 AND v_state.form<30) OR(v_skips>=2 AND v_state.trust<35) OR(v_pregame_nights>=2 AND v_state.trust<30);
  IF v_state.injury_days>0 THEN v_status:='out'; v_reason:='O departamento médico não liberou você para a partida.';
  ELSIF v_contract.squad_role IN('Titular','Estrela') AND v_hard_out THEN v_status:='out'; v_reason:='Sua condição, preparação ou relação com a comissão deteriorou a ponto de tirar você da relação.';
  ELSIF v_score>=v_starter_threshold THEN v_status:='starter'; v_reason:='Sua semana, condição, concorrência disponível e relação com a comissão sustentam uma vaga no time inicial.';
  ELSIF v_contract.squad_role IN('Titular','Estrela') AND NOT v_severe THEN v_status:='bench'; v_reason:='Você perdeu força para começar jogando, mas seu status no elenco ainda mantém você entre os relacionados.';
  ELSIF v_score>=v_bench_threshold THEN v_status:='bench'; v_reason:='Você está entre os relacionados, mas a disputa e sua semana ainda não garantem a titularidade.';
  ELSE v_status:='out'; v_reason:=CASE WHEN v_skips>=2 THEN 'As ausências em treino pesaram demais na decisão do treinador.' WHEN v_pregame_nights>0 THEN 'A preparação fora de campo pesou contra sua convocação.' WHEN v_state.trust<30 THEN 'A relação com o treinador está baixa demais para garantir lugar no banco.' ELSE 'A combinação de forma, concorrência e semana deixou você fora da relação.' END; END IF;
  RETURN jsonb_build_object('status',v_status,'score',ROUND(v_score,1),'reason',v_reason,'player_ovr',v_ovr,'competitor_ovr',v_comp,'readiness',v_readiness,'team_sessions',v_team_normal+v_team_intense+v_team_light,'missed_sessions',v_skips,'extra_training',v_individual,'pregame_nights',v_pregame_nights,'performance_context',private.current_performance_context(p_player_id));
END; $$;

DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
  SELECT pg_get_functiondef('public.get_career_hub()'::regprocedure) INTO v_def;
  IF position('private.career_readiness_score(v_player.id)' IN v_def)=0 THEN
    v_old:='v_readiness:=private.career_clamp(ROUND((v_state.energy*0.45)+((100-v_state.fatigue)*0.28)+(v_state.morale*0.14)+(v_state.form*0.13)-CASE WHEN v_state.injury_days>0 THEN 25 ELSE 0 END)::int);';
    v_new:='v_readiness:=private.career_readiness_score(v_player.id);';
    IF position(v_old IN v_def)=0 THEN RAISE EXCEPTION 'Ponto de readiness do Career Hub não encontrado.'; END IF;
    EXECUTE replace(v_def,v_old,v_new);
  END IF;
END $$;

COMMIT;
