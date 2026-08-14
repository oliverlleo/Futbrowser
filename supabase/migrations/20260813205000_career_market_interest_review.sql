CREATE OR REPLACE FUNCTION public.review_career_market_interest()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_player uuid;v_date date;v_age int;v_ovr int;v_form int;v_fame int;v_club_id uuid;v_current record;v_last date;v_active int;v_rating numeric;v_created int:=0;
  v_candidate record;v_target_squad text;v_target_team uuid;v_target_avg numeric;v_interest int;v_terms jsonb;v_context jsonb;v_effective date;v_fee int;v_offer uuid;
BEGIN
  SELECT j.id,st.career_date,j.idade,public.calculate_player_ovr(j.atributos),COALESCE(st.form,50),COALESCE(st.fame,0),st.club_id
  INTO v_player,v_date,v_age,v_ovr,v_form,v_fame,v_club_id
  FROM public.jogadores j JOIN public.player_career_state st ON st.player_id=j.id WHERE j.user_id=auth.uid();
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
  SELECT * INTO v_current FROM public.base_clubs WHERE id=v_club_id;

  INSERT INTO public.player_market_state(player_id) VALUES(v_player) ON CONFLICT DO NOTHING;
  SELECT last_interest_check INTO v_last FROM public.player_market_state WHERE player_id=v_player;
  IF v_last IS NOT NULL AND v_date-v_last<7 THEN RETURN jsonb_build_object('created',0,'cooldown_until',v_last+7);END IF;

  SELECT count(*) INTO v_active FROM public.player_offers WHERE player_id=v_player AND offer_type IN('academy_transfer','professional_transfer') AND status IN('new','reviewed','negotiating','countered');
  IF v_active>=3 THEN UPDATE public.player_market_state SET last_interest_check=v_date,updated_at=now() WHERE player_id=v_player;RETURN jsonb_build_object('created',0,'active_offers',v_active);END IF;

  SELECT COALESCE(avg(rating),6.5) INTO v_rating FROM (SELECT rating FROM public.player_match_history WHERE player_id=v_player AND context='club' AND appeared ORDER BY match_date DESC LIMIT 5) q;
  v_effective:=private.career_next_registration_date(v_date);

  FOR v_candidate IN
    SELECT c.* FROM public.base_clubs c
    WHERE c.is_active AND c.family_code IS DISTINCT FROM v_current.family_code
      AND ((c.club_level='academy' AND c.squad_level='base') OR (v_age>=16 AND c.club_level='professional' AND c.squad_level='first_team'))
    ORDER BY random()
  LOOP
    EXIT WHEN v_active+v_created>=3;
    IF EXISTS(SELECT 1 FROM public.player_offers po JOIN public.base_clubs oc ON oc.id=po.club_id WHERE po.player_id=v_player AND oc.family_code=v_candidate.family_code AND po.offer_type IN('academy_transfer','professional_transfer') AND po.created_at>now()-interval '45 days') THEN CONTINUE;END IF;

    IF v_candidate.club_level='professional' THEN v_target_squad:='first_team';v_target_team:=v_candidate.id;
    ELSE
      v_target_squad:=CASE WHEN v_age<=15 THEN 'u15' WHEN v_age<=17 THEN 'u17' WHEN v_age=18 THEN 'u18' ELSE 'u20' END;
      IF v_current.squad_level='u18' AND v_target_squad IN('u15','u17') THEN v_target_squad:='u18';END IF;
      IF v_current.squad_level='u20' THEN v_target_squad:='u20';END IF;
      SELECT id INTO v_target_team FROM public.base_clubs WHERE family_code=v_candidate.family_code AND squad_level=v_target_squad AND is_active LIMIT 1;
    END IF;

    SELECT COALESCE(avg(ovr),50) INTO v_target_avg FROM public.base_ai_players WHERE club_id=v_target_team;
    IF v_candidate.club_level='professional' AND v_ovr<v_target_avg-9 THEN CONTINUE;END IF;
    v_interest:=GREATEST(0,LEAST(100,round(58+((v_ovr-v_target_avg)*4)+((v_rating-6.5)*15)+((v_form-50)*.18)+(v_fame*.10)-GREATEST(0,(COALESCE(v_candidate.reputation,2)-COALESCE(v_current.reputation,2))*5))::int));
    IF v_candidate.club_level='professional' THEN v_interest:=v_interest-8;END IF;
    IF v_candidate.club_level='academy' AND COALESCE(v_candidate.reputation,2)-COALESCE(v_current.reputation,2)>=3 AND NOT(v_rating>=7.5 AND v_ovr>=v_target_avg-2) THEN CONTINUE;END IF;
    IF v_interest<63 THEN CONTINUE;END IF;
    IF random()>LEAST(.72,GREATEST(.12,(v_interest-52)/70.0)) THEN CONTINUE;END IF;

    v_terms:=private.career_contract_terms(v_player,v_candidate.id,v_target_squad);
    v_context:=private.build_offer_context(v_player,v_candidate.id);
    v_fee:=round(private.career_player_market_value(v_player)*CASE WHEN v_candidate.club_level='professional' THEN 1.0+(v_interest-60)/100.0 ELSE .35+(v_interest-60)/160.0 END)::int;

    INSERT INTO public.player_offers(player_id,club_id,initial_terms,current_terms,status,internal_tolerance,compatibility_breakdown,snapshot_data,is_emergency,offer_type,source_club_id,target_squad_level,effective_on,transfer_fee,generated_reason,window_code,expires_at)
    VALUES(v_player,v_candidate.id,v_terms,v_terms,'new',GREATEST(20,LEAST(90,COALESCE((v_context->>'internal_tolerance')::int,45))),COALESCE(v_context->'compatibility_breakdown','{}'::jsonb),COALESCE(v_context->'snapshot_data','{}'::jsonb)||jsonb_build_object('market_interest',v_interest,'recent_rating',v_rating,'target_squad_avg',round(v_target_avg)::int),false,CASE WHEN v_candidate.club_level='professional' THEN 'professional_transfer' ELSE 'academy_transfer' END,v_current.id,v_target_squad,v_effective,v_fee,CASE WHEN v_interest>=82 THEN 'O clube acompanha você de perto e considera seu momento esportivo muito interessante.' WHEN v_interest>=72 THEN 'Seu desempenho recente chamou a atenção do departamento de futebol.' ELSE 'O clube vê potencial e espaço para seu desenvolvimento.' END,COALESCE((private.career_transfer_window_status(v_date))->>'code','CLOSED'),now()+interval '12 days') RETURNING id INTO v_offer;

    INSERT INTO public.player_messages(player_id,club_id,offer_id,message_type,subject,body,metadata)
    VALUES(v_player,v_candidate.id,v_offer,'offer','Novo interesse no mercado',v_candidate.name||' procurou seu empresário com uma proposta para '||CASE WHEN v_target_squad='first_team' THEN 'o profissional.' ELSE 'a categoria '||upper(v_target_squad)||'.' END||' Você pode analisar os termos sem interromper sua rotina.',jsonb_build_object('kind','career_market_offer','offer_id',v_offer,'target_squad',v_target_squad,'effective_on',v_effective));
    v_created:=v_created+1;
  END LOOP;

  UPDATE public.player_market_state SET last_interest_check=v_date,last_offer_date=CASE WHEN v_created>0 THEN v_date ELSE last_offer_date END,updated_at=now() WHERE player_id=v_player;
  RETURN jsonb_build_object('created',v_created,'active_offers',v_active+v_created);
END $$;

GRANT EXECUTE ON FUNCTION public.review_career_market_interest() TO authenticated;
