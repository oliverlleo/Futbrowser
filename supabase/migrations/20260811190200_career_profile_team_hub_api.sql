BEGIN;

CREATE OR REPLACE FUNCTION public.get_career_team_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid:=auth.uid(); v_player record; v_state record; v_contract record; v_club record; v_coach record;
  v_proj jsonb; v_locked jsonb; v_roster jsonb; v_replace uuid; v_user_starter boolean; v_club_ovr int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_career_initialized(v_player.id);
  PERFORM private.ensure_teammate_relations(v_player.id);
  PERFORM private.ensure_match_selection_if_due(v_player.id);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player.id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  SELECT * INTO v_club FROM public.base_clubs WHERE id=v_contract.club_id;
  SELECT * INTO v_coach FROM public.base_coaches WHERE id=v_club.coach_id;
  SELECT ROUND(AVG(ovr))::int INTO v_club_ovr FROM public.base_ai_players WHERE club_id=v_club.id;
  v_proj:=private.calculate_selection_projection(v_player.id);
  SELECT jsonb_build_object('status',selection_status,'score',score,'reason',reason,'locked',true,'match_date',match_date,'is_debut',is_debut,'shirt_number',shirt_number)
  INTO v_locked FROM public.player_match_selections WHERE player_id=v_player.id AND match_date=v_state.next_match_date;
  v_user_starter:=COALESCE(v_locked->>'status',v_proj->>'status')='starter';

  IF v_user_starter THEN
    SELECT ai.id INTO v_replace FROM public.base_ai_players ai
    WHERE ai.club_id=v_club.id AND ai.is_starter AND ai.primary_position=v_player.posicao
      AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability av WHERE av.player_id=v_player.id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date AND av.status='out')
    ORDER BY ai.ovr ASC LIMIT 1;
    IF v_replace IS NULL THEN
      SELECT ai.id INTO v_replace FROM public.base_ai_players ai
      WHERE ai.club_id=v_club.id AND ai.is_starter
        AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability av WHERE av.player_id=v_player.id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date AND av.status='out')
      ORDER BY ai.ovr ASC LIMIT 1;
    END IF;
  END IF;

  WITH roster_base AS (
    SELECT ai.*,COALESCE(av.status,'available') AS availability_status,av.reason AS availability_reason,
           COALESCE(r.relation,50) AS relation_score,COALESCE(r.chemistry,50) AS chemistry,COALESCE(r.rivalry,false) AS rivalry
    FROM public.base_ai_players ai
    LEFT JOIN private.career_squad_availability av ON av.player_id=v_player.id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date
    LEFT JOIN public.player_teammate_relations r ON r.teammate_id=ai.id AND r.player_id=v_player.id
    WHERE ai.club_id=v_club.id
  ), promoted AS (
    SELECT rb.id FROM roster_base rb
    WHERE NOT rb.is_starter AND rb.availability_status<>'out'
      AND EXISTS(SELECT 1 FROM roster_base missing WHERE missing.is_starter AND missing.availability_status='out' AND missing.primary_position=rb.primary_position AND NOT(v_user_starter AND missing.primary_position=v_player.posicao))
      AND rb.id=(SELECT cand.id FROM roster_base cand WHERE NOT cand.is_starter AND cand.availability_status<>'out' AND cand.primary_position=rb.primary_position ORDER BY cand.ovr DESC,cand.age ASC LIMIT 1)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',rb.id,'name',rb.name,'age',rb.age,'position',rb.primary_position,'secondary_position',rb.secondary_position,
    'ovr',rb.ovr,'archetype',rb.archetype,'squad_role',rb.squad_role,'number',rb.squad_number,
    'base_starter',rb.is_starter,'availability_status',rb.availability_status,'availability_reason',rb.availability_reason,
    'probable_starter',((rb.is_starter AND rb.availability_status<>'out' AND rb.id IS DISTINCT FROM v_replace) OR EXISTS(SELECT 1 FROM promoted pr WHERE pr.id=rb.id)),
    'relation_score',rb.relation_score,'relation',private.career_relation_label(rb.relation_score),'chemistry',rb.chemistry,'rivalry',rb.rivalry
  ) ORDER BY((rb.is_starter AND rb.availability_status<>'out' AND rb.id IS DISTINCT FROM v_replace) OR EXISTS(SELECT 1 FROM promoted pr WHERE pr.id=rb.id)) DESC,rb.primary_position,rb.ovr DESC),'[]'::jsonb)
  INTO v_roster FROM roster_base rb;

  RETURN jsonb_build_object(
    'club',jsonb_build_object('id',v_club.id,'name',v_club.name,'city',v_club.city,'formation',v_club.formation,'play_style',v_club.play_style,'reputation',v_club.reputation,'ovr',v_club_ovr,'shield_url',v_club.shield_url),
    'coach',jsonb_build_object('id',v_coach.id,'name',v_coach.name,'profile',v_coach.profile,'impacts',v_coach.impacts,'relation_score',v_state.trust,'relation',private.career_relation_label(v_state.trust)),
    'player_projection',COALESCE(v_locked,v_proj||jsonb_build_object('locked',false,'match_date',v_state.next_match_date)),
    'roster',v_roster,
    'player',jsonb_build_object('id',v_player.id,'name',v_player.apelido,'position',v_player.posicao,'ovr',public.calculate_player_ovr(v_player.atributos),'shirt_number',(SELECT number FROM public.player_squad_numbers WHERE player_id=v_player.id AND active LIMIT 1))
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_career_team_profile() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_career_team_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_career_hub()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid:=auth.uid(); v_player record; v_state record; v_contract record; v_club record; v_coach record;
  v_session jsonb; v_readiness int; v_actions jsonb; v_skills jsonb; v_event jsonb; v_recent jsonb; v_week jsonb; v_unread int; v_match_locked boolean;
  v_shirt int; v_available_numbers integer[]; v_shirt_required boolean; v_selection jsonb; v_projection jsonb; v_sponsor jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_career_initialized(v_player.id);
  PERFORM private.ensure_teammate_relations(v_player.id);
  PERFORM private.ensure_shirt_request(v_player.id);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id;
  PERFORM private.ensure_match_selection_if_due(v_player.id);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player.id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  SELECT * INTO v_club FROM public.base_clubs WHERE id=v_contract.club_id;
  SELECT * INTO v_coach FROM public.base_coaches WHERE id=v_club.coach_id;
  SELECT number INTO v_shirt FROM public.player_squad_numbers WHERE player_id=v_player.id AND active ORDER BY assigned_at DESC LIMIT 1;
  v_available_numbers:=CASE WHEN v_shirt IS NULL THEN private.available_squad_numbers(v_player.id) ELSE ARRAY[]::integer[] END;
  v_shirt_required:=v_shirt IS NULL AND v_state.next_match_date IS NOT NULL AND v_state.career_date>=v_state.next_match_date-1;
  v_session:=private.team_session_for_period(v_state.career_date,v_state.day_period,v_coach.profile);
  v_match_locked:=v_state.career_date>=v_state.next_match_date AND v_state.day_period>=1;
  v_readiness:=private.career_clamp(ROUND((v_state.energy*0.45)+((100-v_state.fatigue)*0.28)+(v_state.morale*0.14)+(v_state.form*0.13)-CASE WHEN v_state.injury_days>0 THEN 25 ELSE 0 END)::int);
  v_projection:=private.calculate_selection_projection(v_player.id);
  SELECT jsonb_build_object('status',selection_status,'score',score,'reason',reason,'locked',true,'match_date',match_date,'is_debut',is_debut,'shirt_number',shirt_number)
  INTO v_selection FROM public.player_match_selections WHERE player_id=v_player.id AND match_date=v_state.next_match_date;
  IF v_selection IS NULL THEN v_selection:=v_projection||jsonb_build_object('locked',false,'match_date',v_state.next_match_date); END IF;
  SELECT jsonb_build_object('id',id,'brand',brand,'title',title,'reward',reward,'expires_on',expires_on)
  INTO v_sponsor FROM public.player_sponsor_opportunities WHERE player_id=v_player.id AND status='available' AND available_from<=v_state.career_date AND expires_on>=v_state.career_date ORDER BY created_at LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key',a.activity_key,'category',a.category,'title',a.title,
    'description',CASE WHEN a.activity_key='sponsor_event' AND v_sponsor IS NOT NULL THEN COALESCE(v_sponsor->>'title',a.description)||' · recompensa R$ '||(v_sponsor->>'reward') ELSE a.description END,
    'icon',a.icon,'load',a.load_label,'supports_intensity',a.supports_intensity,'supports_duration',a.supports_duration,'base_duration',a.base_duration,
    'cash_cost',GREATEST(0,-a.cash_delta),'cash_reward',CASE WHEN a.activity_key='sponsor_event' AND v_sponsor IS NOT NULL THEN(v_sponsor->>'reward')::int ELSE GREATEST(0,a.cash_delta) END,
    'sponsor_brand',CASE WHEN a.activity_key='sponsor_event' THEN v_sponsor->>'brand' ELSE NULL END,
    'disabled_reason',CASE
      WHEN v_shirt_required THEN 'Escolha seu número de camisa antes de continuar.'
      WHEN v_state.injury_days>0 AND a.activity_key IN('sprint','strength','endurance','heading_session','defensive_session','teammate_extra','dribble_session','finishing') THEN 'Você está em recuperação e este trabalho físico não está liberado.'
      WHEN a.cash_delta<0 AND v_state.cash_balance<ABS(a.cash_delta) THEN 'Saldo insuficiente para esta atividade.'
      ELSE NULL END
  ) ORDER BY a.category,a.title),'[]'::jsonb)
  INTO v_actions FROM private.career_activity_catalog a WHERE a.activity_key<>'sponsor_event' OR v_sponsor IS NOT NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('key',skill_key,'label',label,'category',category,'parent_attribute',parent_attribute,'level',level,'progress',ROUND(progress,0)) ORDER BY category,label),'[]'::jsonb)
  INTO v_skills FROM public.player_skill_development WHERE player_id=v_player.id;
  SELECT to_jsonb(e) INTO v_event FROM(SELECT id,event_key,source,title,body,choices,status,metadata,created_at FROM public.player_career_events WHERE player_id=v_player.id AND status='pending' ORDER BY created_at ASC LIMIT 1)e;
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC),'[]'::jsonb) INTO v_recent FROM(SELECT id,career_date,day_period,activity_key,category,title,intensity,duration_minutes,result_summary,created_at FROM public.player_career_actions WHERE player_id=v_player.id ORDER BY created_at DESC LIMIT 6)a;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date',d::date,'label',to_char(d,'DD/MM'),'dow',EXTRACT(DOW FROM d)::int,'morning',private.team_session_for_period(d::date,0::smallint,v_coach.profile),'is_match_day',(d::date=v_state.next_match_date)) ORDER BY d),'[]'::jsonb)
  INTO v_week FROM generate_series(v_state.career_date::timestamp,(v_state.career_date+6)::timestamp,interval '1 day')d;
  SELECT COUNT(*) INTO v_unread FROM public.player_messages WHERE player_id=v_player.id AND is_read=false;

  RETURN jsonb_build_object(
    'player',jsonb_build_object('id',v_player.id,'name',v_player.nome,'nickname',v_player.apelido,'avatar',v_player.avatar,'age',v_player.idade,'position',v_player.posicao,'archetype',v_player.arquetipo,'attributes',v_player.atributos,'ovr',public.calculate_player_ovr(v_player.atributos),'shirt_number',v_shirt),
    'club',jsonb_build_object('id',v_club.id,'name',v_club.name,'shield_url',v_club.shield_url,'formation',v_club.formation,'play_style',v_club.play_style),
    'coach',jsonb_build_object('id',v_coach.id,'name',v_coach.name,'profile',v_coach.profile,'relation_score',v_state.trust,'relation',private.career_relation_label(v_state.trust)),
    'contract',jsonb_build_object('monthly_wage',v_contract.monthly_wage,'squad_role',v_contract.squad_role,'duration_seasons',v_contract.duration_seasons),
    'state',jsonb_build_object(
      'date',v_state.career_date,'period',v_state.day_period,'next_match_date',v_state.next_match_date,'energy',v_state.energy,'fatigue',v_state.fatigue,'readiness',v_readiness,
      'injury_risk',private.career_risk_label(v_state.energy,v_state.fatigue,v_state.injury_days),'injury_status',v_state.injury_status,'injury_label',v_state.injury_label,'injury_days',v_state.injury_days,
      'morale',private.career_relation_label(v_state.morale),'trust',private.career_relation_label(v_state.trust),'coach_relation_score',v_state.trust,'form',private.career_relation_label(v_state.form),
      'pressure',CASE WHEN v_state.pressure>=75 THEN 'Muito alta' WHEN v_state.pressure>=55 THEN 'Alta' WHEN v_state.pressure>=35 THEN 'Moderada' ELSE 'Baixa' END,
      'cash',v_state.cash_balance,'hierarchy',v_state.hierarchy,'weekly_objective',v_state.weekly_objective,'fame',v_state.fame,'fanbase',v_state.fanbase,
      'environment',jsonb_build_object('coach',private.career_relation_label(v_state.trust),'locker_room',private.career_relation_label(v_state.locker_room_relation),'fans',private.career_relation_label(v_state.fan_relation),'media',private.career_relation_label(v_state.media_relation),'board',private.career_relation_label(v_state.board_relation),'agent',private.career_relation_label(v_state.agent_relation),'public_image',private.career_relation_label(v_state.public_image),'personal_life',private.career_relation_label(v_state.personal_life))
    ),
    'shirt',jsonb_build_object('number',v_shirt,'available_numbers',to_jsonb(v_available_numbers),'required',v_shirt_required),
    'selection',v_selection,'sponsor_opportunity',v_sponsor,'current_session',v_session,'match_locked',v_match_locked,'activities',v_actions,'skills',v_skills,
    'pending_event',v_event,'recent_actions',v_recent,'week',v_week,'unread_messages',v_unread
  );
END; $$;

CREATE OR REPLACE FUNCTION private.advance_career_clock(p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record; v_new_date date; v_new_period smallint; v_contract record; v_recovery integer; v_energy_gain integer; v_fatigue_drop integer;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;
  v_new_date:=v_state.career_date; v_new_period:=v_state.day_period+1;
  IF v_new_period>2 THEN
    v_new_period:=0; v_new_date:=v_state.career_date+1;
    v_recovery:=COALESCE(v_state.recovery_modifier,0); v_energy_gain:=GREATEST(7,12+ROUND(v_recovery*0.40)::int); v_fatigue_drop:=GREATEST(2,4+ROUND(v_recovery*0.25)::int);
    UPDATE public.player_career_state SET energy=private.career_clamp(energy+v_energy_gain),fatigue=private.career_clamp(fatigue-v_fatigue_drop),pressure=private.career_clamp(pressure-2),injury_days=GREATEST(0,injury_days-1),injury_status=CASE WHEN injury_days-1<=0 THEN 'healthy' ELSE injury_status END,injury_label=CASE WHEN injury_days-1<=0 THEN NULL ELSE injury_label END WHERE player_id=p_player_id;
    SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
    IF v_state.last_salary_date IS NOT NULL AND v_new_date>=v_state.last_salary_date+30 THEN
      UPDATE public.player_career_state SET cash_balance=cash_balance+COALESCE(v_contract.monthly_wage,0),last_salary_date=v_new_date WHERE player_id=p_player_id;
      INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(p_player_id,v_contract.club_id,'career','Salário recebido','O pagamento mensal do seu contrato foi depositado na sua conta.',jsonb_build_object('kind','salary','amount',COALESCE(v_contract.monthly_wage,0)));
    END IF;
  END IF;
  UPDATE public.player_career_state SET career_date=v_new_date,day_period=v_new_period,updated_at=now() WHERE player_id=p_player_id;
  IF v_new_date<>v_state.career_date THEN
    PERFORM private.ensure_shirt_request(p_player_id);
    PERFORM private.maybe_send_development_reports(p_player_id,v_new_date);
    PERFORM private.maybe_generate_sponsor_opportunity(p_player_id);
    PERFORM private.roll_squad_week_event(p_player_id,v_new_date);
  END IF;
  PERFORM private.ensure_match_selection_if_due(p_player_id);
END; $$;

COMMIT;
