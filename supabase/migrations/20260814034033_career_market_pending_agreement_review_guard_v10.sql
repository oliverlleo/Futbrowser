CREATE OR REPLACE FUNCTION public.review_career_market_interest_core()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pid uuid; career_day date; age_now int; ovr_now int; form_now int; fame_now int; club_now uuid; stage_now text;
  current_club record; last_check date; active_offers int; recent_rating numeric; created_offers int:=0; created_bids int:=0; checked int:=0;
  cand record; target_squad text; target_team uuid; target_avg numeric; interest int; effective_day date; fee int; bid_id uuid; bid_result jsonb;
BEGIN
  SELECT j.id,st.career_date,j.idade,public.calculate_player_ovr(j.atributos),coalesce(st.form,50),coalesce(st.fame,0),st.club_id,st.career_stage
  INTO pid,career_day,age_now,ovr_now,form_now,fame_now,club_now,stage_now
  FROM public.jogadores j JOIN public.player_career_state st ON st.player_id=j.id
  WHERE j.user_id=auth.uid();
  IF pid IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  SELECT * INTO current_club FROM public.base_clubs WHERE id=club_now;

  INSERT INTO public.player_market_state(player_id) VALUES(pid) ON CONFLICT DO NOTHING;

  IF EXISTS(
    SELECT 1 FROM public.player_transfer_agreements a
    WHERE a.player_id=pid AND a.status='pending'
  ) THEN
    UPDATE public.player_transfer_bids
    SET status='expired',updated_at=now(),
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_reason','signed_transfer_pending_registration')
    WHERE player_id=pid AND status IN('pending','countered');

    UPDATE public.player_offers
    SET status='withdrawn'
    WHERE player_id=pid
      AND offer_type IN('academy_transfer','professional_transfer')
      AND status IN('new','reviewed','negotiating','countered');

    UPDATE public.player_market_state
    SET last_interest_check=career_day,updated_at=now()
    WHERE player_id=pid;

    RETURN jsonb_build_object('created',0,'new_bids',0,'blocked_by_pending_transfer',true);
  END IF;

  FOR bid_id IN
    SELECT id FROM public.player_transfer_bids
    WHERE player_id=pid AND status IN('pending','countered') AND expires_on>=career_day
    ORDER BY created_at
  LOOP
    bid_result:=private.settle_career_transfer_bid(bid_id);
    IF bid_result->>'offer_id' IS NOT NULL THEN created_offers:=created_offers+1; END IF;
  END LOOP;
  UPDATE public.player_transfer_bids SET status='expired',updated_at=now()
  WHERE player_id=pid AND status IN('pending','countered') AND expires_on<career_day;

  SELECT last_interest_check INTO last_check FROM public.player_market_state WHERE player_id=pid;
  IF last_check IS NOT NULL AND career_day-last_check<7 THEN
    RETURN jsonb_build_object('created',created_offers,'new_bids',0,'cooldown_until',last_check+7);
  END IF;

  SELECT count(*) INTO active_offers FROM public.player_offers
  WHERE player_id=pid AND offer_type IN('academy_transfer','professional_transfer') AND status IN('new','reviewed','negotiating','countered');
  IF active_offers>=3 THEN
    UPDATE public.player_market_state SET last_interest_check=career_day,updated_at=now() WHERE player_id=pid;
    RETURN jsonb_build_object('created',created_offers,'new_bids',0,'active_offers',active_offers);
  END IF;

  SELECT coalesce(avg(rating),6.5) INTO recent_rating FROM (
    SELECT rating FROM public.player_match_history WHERE player_id=pid AND context='club' AND appeared ORDER BY match_date DESC LIMIT 5
  ) q;

  FOR cand IN
    SELECT c.* FROM public.base_clubs c
    WHERE c.is_active
      AND c.family_code IS DISTINCT FROM current_club.family_code
      AND (
        (stage_now<>'professional' AND c.club_level='academy' AND c.squad_level='base')
        OR (age_now>=16 AND c.club_level='professional' AND c.squad_level='first_team')
      )
    ORDER BY random()
  LOOP
    EXIT WHEN active_offers+created_offers+created_bids>=3 OR checked>=18;
    checked:=checked+1;

    IF EXISTS(
      SELECT 1 FROM public.player_transfer_bids pb JOIN public.base_clubs tc ON tc.id=pb.target_club_id
      WHERE pb.player_id=pid AND tc.family_code=cand.family_code AND pb.created_at>now()-interval '45 days'
    ) THEN CONTINUE; END IF;

    IF cand.club_level='professional' THEN
      target_squad:='first_team'; target_team:=cand.id; effective_day:=private.career_next_registration_date(career_day);
    ELSE
      target_squad:=CASE WHEN age_now<=15 THEN 'u15' WHEN age_now<=17 THEN 'u17' WHEN age_now=18 THEN 'u18' ELSE 'u20' END;
      IF current_club.squad_level='u18' AND target_squad IN('u15','u17') THEN target_squad:='u18'; END IF;
      IF current_club.squad_level='u20' THEN target_squad:='u20'; END IF;
      SELECT id INTO target_team FROM public.base_clubs WHERE family_code=cand.family_code AND squad_level=target_squad AND is_active LIMIT 1;
      IF target_team IS NULL THEN CONTINUE; END IF;
      effective_day:=career_day;
    END IF;

    SELECT coalesce(avg(ovr),50) INTO target_avg FROM public.base_ai_players WHERE club_id=target_team;
    IF cand.club_level='professional' AND ovr_now<target_avg-9 THEN CONTINUE; END IF;
    interest:=greatest(0,least(100,round(58+((ovr_now-target_avg)*4)+((recent_rating-6.5)*15)+((form_now-50)*.18)+(fame_now*.10)-greatest(0,(coalesce(cand.reputation,2)-coalesce(current_club.reputation,2))*5))::int));
    IF cand.club_level='professional' THEN interest:=interest-8; END IF;
    IF cand.club_level='academy' AND coalesce(cand.reputation,2)-coalesce(current_club.reputation,2)>=3 AND NOT(recent_rating>=7.5 AND ovr_now>=target_avg-2) THEN CONTINUE; END IF;
    IF interest<63 THEN CONTINUE; END IF;
    IF random()>least(.72,greatest(.12,(interest-52)/70.0)) THEN CONTINUE; END IF;

    fee:=round(private.career_player_market_value(pid)*CASE WHEN cand.club_level='professional' THEN 1.0+(interest-60)/100.0 ELSE .35+(interest-60)/160.0 END)::int;
    INSERT INTO public.player_transfer_bids(player_id,source_club_id,target_club_id,target_squad_level,bid_kind,current_fee,asking_fee,round,status,interest_score,effective_on,expires_on,generated_reason,metadata)
    VALUES(pid,current_club.id,cand.id,target_squad,CASE WHEN cand.club_level='professional' THEN 'professional_transfer' ELSE 'academy_transfer' END,fee,0,0,'pending',interest,effective_day,career_day+10,CASE WHEN interest>=82 THEN 'O clube acompanha você de perto e considera seu momento esportivo muito interessante.' WHEN interest>=72 THEN 'Seu desempenho recente chamou a atenção do departamento de futebol.' ELSE 'O clube vê potencial e espaço para seu desenvolvimento.' END,jsonb_build_object('career_date',career_day,'player_ovr',ovr_now,'recent_rating',recent_rating,'target_squad_avg',round(target_avg)::int))
    RETURNING id INTO bid_id;
    created_bids:=created_bids+1;
    bid_result:=private.settle_career_transfer_bid(bid_id);
    IF bid_result->>'offer_id' IS NOT NULL THEN created_offers:=created_offers+1; END IF;
  END LOOP;

  UPDATE public.player_market_state SET last_interest_check=career_day,last_offer_date=CASE WHEN created_offers>0 THEN career_day ELSE last_offer_date END,updated_at=now() WHERE player_id=pid;
  RETURN jsonb_build_object('created',created_offers,'new_bids',created_bids,'active_offers',active_offers+created_offers);
END
$function$;
