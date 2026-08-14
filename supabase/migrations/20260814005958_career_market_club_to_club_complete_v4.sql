-- Canonical reproducible state for the live club-to-club career market.
BEGIN;

CREATE TABLE IF NOT EXISTS public.player_transfer_bids(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  source_club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,
  target_club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE CASCADE,
  target_squad_level text NOT NULL CHECK(target_squad_level IN('base','u15','u17','u18','u20','first_team')),
  bid_kind text NOT NULL CHECK(bid_kind IN('academy_transfer','professional_transfer')),
  current_fee integer NOT NULL DEFAULT 0 CHECK(current_fee>=0),
  asking_fee integer NOT NULL DEFAULT 0 CHECK(asking_fee>=0),
  round smallint NOT NULL DEFAULT 0 CHECK(round BETWEEN 0 AND 3),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','countered','accepted','rejected','expired')),
  interest_score integer NOT NULL DEFAULT 0 CHECK(interest_score BETWEEN 0 AND 100),
  effective_on date,
  expires_on date NOT NULL,
  generated_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_bids_player_status ON public.player_transfer_bids(player_id,status,expires_on);
CREATE INDEX IF NOT EXISTS idx_transfer_bids_target ON public.player_transfer_bids(target_club_id,status);

CREATE OR REPLACE FUNCTION private.career_source_sale_floor(p_player_id uuid,p_source_club_id uuid,p_target_club_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_contract record;v_state record;v_source record;v_target record;v_market integer;v_mult numeric:=1;v_floor integer;
BEGIN
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO v_source FROM public.base_clubs WHERE id=p_source_club_id;
  SELECT * INTO v_target FROM public.base_clubs WHERE id=p_target_club_id;
  v_market:=private.career_player_market_value(p_player_id);
  v_mult:=CASE coalesce(v_contract.squad_role,v_state.hierarchy,'Rotação') WHEN 'Estrela' THEN 1.30 WHEN 'Titular' THEN 1.18 WHEN 'Rotação' THEN 1.05 WHEN 'Reserva' THEN .95 ELSE .88 END;
  IF v_target.club_level='academy' THEN v_mult:=v_mult*.38;END IF;
  v_floor:=round(greatest(1000,v_market)*v_mult*(1+coalesce(v_source.reputation,2)::numeric/45))::int;
  IF v_contract.release_clause IS NOT NULL AND v_contract.release_clause>0 AND v_target.club_level='professional' THEN v_floor:=least(v_floor,v_contract.release_clause);END IF;
  RETURN greatest(0,v_floor);
END $$;

CREATE OR REPLACE FUNCTION private.resolve_career_transfer_bid(p_bid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_bid record;v_floor integer;v_contract record;v_counter integer;v_status text;
BEGIN
  SELECT * INTO v_bid FROM public.player_transfer_bids WHERE id=p_bid_id FOR UPDATE;
  IF v_bid.id IS NULL THEN RAISE EXCEPTION 'Abordagem não encontrada.';END IF;
  IF v_bid.status NOT IN('pending','countered') THEN RETURN jsonb_build_object('status',v_bid.status);END IF;
  v_floor:=private.career_source_sale_floor(v_bid.player_id,v_bid.source_club_id,v_bid.target_club_id);
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_bid.player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  IF v_contract.id IS NULL THEN v_floor:=0;END IF;
  IF v_contract.release_clause IS NOT NULL AND v_bid.current_fee>=v_contract.release_clause THEN v_floor:=v_bid.current_fee;END IF;
  IF v_bid.current_fee>=v_floor OR(v_bid.round>=2 AND v_bid.current_fee>=round(v_floor*.92))THEN
    UPDATE public.player_transfer_bids SET status='accepted',asking_fee=v_floor,updated_at=now() WHERE id=v_bid.id;v_status:='accepted';
  ELSIF v_bid.round>=3 OR v_bid.current_fee<round(v_floor*.55)THEN
    UPDATE public.player_transfer_bids SET status='rejected',asking_fee=v_floor,updated_at=now() WHERE id=v_bid.id;v_status:='rejected';
  ELSE
    v_counter:=greatest(v_bid.current_fee+1,round((v_bid.current_fee+v_floor)/2.0)::int);
    UPDATE public.player_transfer_bids SET status='countered',round=round+1,current_fee=v_counter,asking_fee=v_floor,updated_at=now() WHERE id=v_bid.id;v_status:='countered';
  END IF;
  RETURN jsonb_build_object('status',v_status,'current_fee',(SELECT current_fee FROM public.player_transfer_bids WHERE id=v_bid.id),'asking_fee',v_floor,'round',(SELECT round FROM public.player_transfer_bids WHERE id=v_bid.id));
END $$;

CREATE OR REPLACE FUNCTION private.create_career_market_offer_from_bid(p_bid_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record;existing_offer uuid;terms jsonb;ctx jsonb;offer_id uuid;target record;career_day date;
BEGIN
  SELECT pb.*,bc.name AS target_name,bc.club_level AS target_level INTO b FROM public.player_transfer_bids pb JOIN public.base_clubs bc ON bc.id=pb.target_club_id WHERE pb.id=p_bid_id FOR UPDATE OF pb;
  IF b.id IS NULL OR b.status<>'accepted' THEN RETURN NULL;END IF;
  SELECT po.id INTO existing_offer FROM public.player_offers po WHERE po.player_id=b.player_id AND po.offer_type IN('academy_transfer','professional_transfer') AND po.snapshot_data->>'transfer_bid_id'=b.id::text ORDER BY po.created_at DESC LIMIT 1;
  IF existing_offer IS NOT NULL THEN RETURN existing_offer;END IF;
  SELECT * INTO target FROM public.base_clubs WHERE id=b.target_club_id;SELECT career_date INTO career_day FROM public.player_career_state WHERE player_id=b.player_id;
  terms:=private.career_contract_terms(b.player_id,b.target_club_id,b.target_squad_level);ctx:=private.build_offer_context(b.player_id,b.target_club_id);
  INSERT INTO public.player_offers(player_id,club_id,initial_terms,current_terms,status,round,internal_tolerance,compatibility_breakdown,snapshot_data,is_emergency,offer_type,source_club_id,target_squad_level,effective_on,transfer_fee,generated_reason,window_code,expires_at,career_expires_on)
  VALUES(b.player_id,b.target_club_id,terms,terms,'new',0,greatest(20,least(90,coalesce((ctx->>'internal_tolerance')::int,45))),coalesce(ctx->'compatibility_breakdown','{}'::jsonb),coalesce(ctx->'snapshot_data','{}'::jsonb)||jsonb_build_object('transfer_bid_id',b.id,'market_interest',b.interest_score,'club_to_club_agreed',true,'agreed_transfer_fee',b.current_fee),false,CASE WHEN target.club_level='professional' THEN 'professional_transfer' ELSE 'academy_transfer' END,b.source_club_id,b.target_squad_level,b.effective_on,b.current_fee,coalesce(b.generated_reason,'Os clubes chegaram a um acordo e agora o projeto contratual depende de você.'),coalesce((private.career_transfer_window_status(career_day))->>'code','CLOSED'),now()+interval '12 days',least(b.expires_on,career_day+12))RETURNING id INTO offer_id;
  UPDATE public.player_transfer_bids SET metadata=metadata||jsonb_build_object('offer_id',offer_id,'player_offer_created',true),updated_at=now() WHERE id=b.id;
  INSERT INTO public.player_messages(player_id,club_id,offer_id,message_type,subject,body,metadata)VALUES(b.player_id,b.target_club_id,offer_id,'offer','Proposta oficial de transferência',b.target_name||' chegou a um acordo com seu clube atual. Agora você pode analisar salário, duração, papel no elenco e cláusula, negociar ou recusar.',jsonb_build_object('kind','career_market_offer','offer_id',offer_id,'transfer_bid_id',b.id,'target_squad',b.target_squad_level,'effective_on',b.effective_on,'transfer_fee',b.current_fee,'club_to_club_agreed',true));
  RETURN offer_id;
END $$;

CREATE OR REPLACE FUNCTION private.settle_career_transfer_bid(p_bid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;status_text text;offer_id uuid;
BEGIN
  result:=private.resolve_career_transfer_bid(p_bid_id);status_text:=result->>'status';
  IF status_text='accepted' THEN offer_id:=private.create_career_market_offer_from_bid(p_bid_id);END IF;
  RETURN coalesce(result,'{}'::jsonb)||jsonb_build_object('offer_id',offer_id);
END $$;

CREATE OR REPLACE FUNCTION public.negotiate_offer(p_offer_id uuid,p_requested_terms jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user_id uuid;v_offer record;v_round int;v_flex_rem int;v_cost int:=0;
  v_curr_wage int;v_req_wage int;v_curr_dur int;v_req_dur int;v_curr_release int;v_req_release int;
  v_curr_role text;v_req_role text;v_curr_bonus int;v_requested_terms jsonb;v_role_diff int;
  v_response_action text;v_club_stance text;v_response_terms jsonb;v_message text;v_latest_action text;
  v_role_levels jsonb:='{"Promessa":1,"Reserva":2,"Rotação":3,"Titular":4,"Estrela":5}'::jsonb;
BEGIN
  v_user_id:=auth.uid();IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;
  SELECT po.* INTO v_offer FROM public.player_offers po JOIN public.jogadores j ON j.id=po.player_id WHERE po.id=p_offer_id AND j.user_id=v_user_id FOR UPDATE OF po;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.';END IF;
  IF v_offer.status NOT IN('new','reviewed','negotiating','countered') THEN RAISE EXCEPTION 'A negociação para este clube já foi encerrada.';END IF;
  IF v_offer.round>=3 THEN RAISE EXCEPTION 'Número máximo de rodadas de negociação atingido.';END IF;
  IF v_offer.offer_type='initial' AND EXISTS(SELECT 1 FROM public.player_contracts pc WHERE pc.player_id=v_offer.player_id AND pc.status='active')THEN RAISE EXCEPTION 'Jogador já possui contrato ativo.';END IF;
  IF v_offer.offer_type NOT IN('initial','academy_transfer','professional_transfer','professional_promotion') THEN RAISE EXCEPTION 'Tipo de proposta não negociável.';END IF;
  SELECT poh.response_action INTO v_latest_action FROM public.player_offer_history poh WHERE poh.offer_id=p_offer_id ORDER BY poh.round DESC LIMIT 1;
  IF v_latest_action='accepted' THEN RAISE EXCEPTION 'O clube já aceitou os termos atuais. Assine o contrato ou recuse a proposta.';END IF;
  IF p_requested_terms IS NULL OR jsonb_typeof(p_requested_terms)<>'object' THEN RAISE EXCEPTION 'Termos de negociação inválidos.';END IF;
  IF NOT p_requested_terms?'monthly_wage' OR NOT p_requested_terms?'duration_seasons' OR NOT p_requested_terms?'release_clause' OR NOT p_requested_terms?'squad_role' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_requested_terms)k(key)WHERE k.key NOT IN('monthly_wage','duration_seasons','release_clause','squad_role','signing_bonus'))THEN RAISE EXCEPTION 'A contraproposta contém campos inválidos.';END IF;
  BEGIN
    v_curr_wage:=(v_offer.current_terms->>'monthly_wage')::int;v_req_wage:=(p_requested_terms->>'monthly_wage')::int;v_curr_dur:=(v_offer.current_terms->>'duration_seasons')::int;v_req_dur:=(p_requested_terms->>'duration_seasons')::int;v_curr_release:=(v_offer.current_terms->>'release_clause')::int;v_req_release:=(p_requested_terms->>'release_clause')::int;v_curr_role:=v_offer.current_terms->>'squad_role';v_req_role:=p_requested_terms->>'squad_role';v_curr_bonus:=coalesce((v_offer.current_terms->>'signing_bonus')::int,0);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Os valores numéricos da negociação são inválidos.';END;
  IF v_req_wage IS NULL OR v_req_wage<=0 THEN RAISE EXCEPTION 'Salário deve ser maior que zero.';END IF;IF v_req_release IS NULL OR v_req_release<=0 THEN RAISE EXCEPTION 'Multa rescisória deve ser maior que zero.';END IF;IF v_req_dur IS NULL OR v_req_dur<1 OR v_req_dur>3 THEN RAISE EXCEPTION 'Duração deve ser de 1 a 3 temporadas.';END IF;IF NOT(v_role_levels?v_req_role)OR NOT(v_role_levels?v_curr_role)THEN RAISE EXCEPTION 'Função no elenco inválida.';END IF;
  v_requested_terms:=jsonb_build_object('monthly_wage',v_req_wage,'duration_seasons',v_req_dur,'release_clause',v_req_release,'squad_role',v_req_role,'signing_bonus',v_curr_bonus);
  IF v_req_wage>v_curr_wage THEN v_cost:=v_cost+round(((v_req_wage::numeric/v_curr_wage::numeric)-1.0)*80)::int;ELSIF v_req_wage<v_curr_wage THEN v_cost:=v_cost-round(((v_curr_wage::numeric/v_req_wage::numeric)-1.0)*40)::int;END IF;
  IF v_req_release<v_curr_release THEN v_cost:=v_cost+round(((v_curr_release::numeric/v_req_release::numeric)-1.0)*60)::int;ELSIF v_req_release>v_curr_release THEN v_cost:=v_cost-round(((v_req_release::numeric/v_curr_release::numeric)-1.0)*30)::int;END IF;
  v_role_diff:=(v_role_levels->>v_req_role)::int-(v_role_levels->>v_curr_role)::int;IF v_role_diff>0 THEN v_cost:=v_cost+(v_role_diff*25);ELSIF v_role_diff<0 THEN v_cost:=v_cost+(v_role_diff*15);END IF;IF v_req_dur<v_curr_dur THEN v_cost:=v_cost+((v_curr_dur-v_req_dur)*5);ELSIF v_req_dur>v_curr_dur THEN v_cost:=v_cost-((v_req_dur-v_curr_dur)*5);END IF;
  v_cost:=greatest(0,v_cost);v_flex_rem:=greatest(0,coalesce(v_offer.internal_tolerance,0));
  IF v_cost=0 THEN v_response_action:='accepted';v_club_stance:='flexível';v_response_terms:=v_requested_terms;v_message:='O clube aceitou seus termos. Revise e assine o contrato para concluir.';
  ELSIF v_cost<=v_flex_rem THEN v_response_action:='countered';v_club_stance:='cauteloso';v_response_terms:=jsonb_build_object('monthly_wage',(v_curr_wage::numeric+((v_req_wage::numeric-v_curr_wage::numeric)/2))::int,'duration_seasons',v_curr_dur,'release_clause',v_curr_release,'squad_role',v_curr_role,'signing_bonus',v_curr_bonus);v_flex_rem:=greatest(0,v_flex_rem-v_cost);v_message:='O clube fez uma contraproposta.';
  ELSIF v_offer.is_emergency THEN v_response_action:='countered';v_club_stance:='intransigente';v_response_terms:=v_offer.current_terms;v_flex_rem:=0;v_message:='O clube não aceitou suas exigências e manteve a oferta emergencial como condição final.';
  ELSE v_response_action:='withdrawn';v_club_stance:='intransigente';v_response_terms:=v_offer.current_terms;v_flex_rem:=0;v_message:='O clube encerrou as negociações após considerar as exigências excessivas.';END IF;
  v_round:=v_offer.round+1;
  INSERT INTO public.player_offer_history(offer_id,round,requested_terms,response_action,club_response_terms,previous_terms,negotiation_cost,remaining_flexibility,before_stance,after_stance)VALUES(p_offer_id,v_round,v_requested_terms,v_response_action,v_response_terms,v_offer.current_terms,v_cost,v_flex_rem,CASE WHEN v_offer.status='countered' THEN 'cauteloso' ELSE 'interessado' END,v_club_stance);
  IF v_response_action='withdrawn' THEN UPDATE public.player_offers SET status='withdrawn',round=v_round,internal_tolerance=v_flex_rem WHERE id=p_offer_id;ELSE UPDATE public.player_offers SET status='countered',current_terms=v_response_terms,round=v_round,internal_tolerance=v_flex_rem WHERE id=p_offer_id;END IF;
  RETURN jsonb_build_object('status',v_response_action,'message',v_message,'round',v_round,'remaining_flexibility',v_flex_rem,'terms',v_response_terms);
END $$;

CREATE OR REPLACE FUNCTION public.review_career_market_interest_core()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  pid uuid;career_day date;age_now int;ovr_now int;form_now int;fame_now int;club_now uuid;stage_now text;current_club record;last_check date;active_offers int;recent_rating numeric;created_offers int:=0;created_bids int:=0;checked int:=0;cand record;target_squad text;target_team uuid;target_avg numeric;interest int;effective_day date;fee int;bid_id uuid;bid_result jsonb;
BEGIN
  SELECT j.id,st.career_date,j.idade,public.calculate_player_ovr(j.atributos),coalesce(st.form,50),coalesce(st.fame,0),st.club_id,st.career_stage INTO pid,career_day,age_now,ovr_now,form_now,fame_now,club_now,stage_now FROM public.jogadores j JOIN public.player_career_state st ON st.player_id=j.id WHERE j.user_id=auth.uid();IF pid IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
  SELECT * INTO current_club FROM public.base_clubs WHERE id=club_now;INSERT INTO public.player_market_state(player_id)VALUES(pid)ON CONFLICT DO NOTHING;
  FOR bid_id IN SELECT id FROM public.player_transfer_bids WHERE player_id=pid AND status IN('pending','countered')AND expires_on>=career_day ORDER BY created_at LOOP bid_result:=private.settle_career_transfer_bid(bid_id);IF bid_result->>'offer_id' IS NOT NULL THEN created_offers:=created_offers+1;END IF;END LOOP;
  UPDATE public.player_transfer_bids SET status='expired',updated_at=now() WHERE player_id=pid AND status IN('pending','countered')AND expires_on<career_day;
  SELECT last_interest_check INTO last_check FROM public.player_market_state WHERE player_id=pid;IF last_check IS NOT NULL AND career_day-last_check<7 THEN RETURN jsonb_build_object('created',created_offers,'new_bids',0,'cooldown_until',last_check+7);END IF;
  SELECT count(*)INTO active_offers FROM public.player_offers WHERE player_id=pid AND offer_type IN('academy_transfer','professional_transfer')AND status IN('new','reviewed','negotiating','countered');IF active_offers>=3 THEN UPDATE public.player_market_state SET last_interest_check=career_day,updated_at=now()WHERE player_id=pid;RETURN jsonb_build_object('created',created_offers,'new_bids',0,'active_offers',active_offers);END IF;
  SELECT coalesce(avg(rating),6.5)INTO recent_rating FROM(SELECT rating FROM public.player_match_history WHERE player_id=pid AND context='club' AND appeared ORDER BY match_date DESC LIMIT 5)q;
  FOR cand IN SELECT c.* FROM public.base_clubs c WHERE c.is_active AND c.family_code IS DISTINCT FROM current_club.family_code AND((stage_now<>'professional' AND c.club_level='academy' AND c.squad_level='base')OR(age_now>=16 AND c.club_level='professional' AND c.squad_level='first_team'))ORDER BY random() LOOP
    EXIT WHEN active_offers+created_offers+created_bids>=3 OR checked>=18;checked:=checked+1;
    IF EXISTS(SELECT 1 FROM public.player_transfer_bids pb JOIN public.base_clubs tc ON tc.id=pb.target_club_id WHERE pb.player_id=pid AND tc.family_code=cand.family_code AND pb.created_at>now()-interval '45 days')THEN CONTINUE;END IF;
    IF cand.club_level='professional' THEN target_squad:='first_team';target_team:=cand.id;effective_day:=private.career_next_registration_date(career_day);ELSE target_squad:=CASE WHEN age_now<=15 THEN 'u15' WHEN age_now<=17 THEN 'u17' WHEN age_now=18 THEN 'u18' ELSE 'u20' END;IF current_club.squad_level='u18' AND target_squad IN('u15','u17')THEN target_squad:='u18';END IF;IF current_club.squad_level='u20' THEN target_squad:='u20';END IF;SELECT id INTO target_team FROM public.base_clubs WHERE family_code=cand.family_code AND squad_level=target_squad AND is_active LIMIT 1;IF target_team IS NULL THEN CONTINUE;END IF;effective_day:=career_day;END IF;
    SELECT coalesce(avg(ovr),50)INTO target_avg FROM public.base_ai_players WHERE club_id=target_team;IF cand.club_level='professional' AND ovr_now<target_avg-9 THEN CONTINUE;END IF;
    interest:=greatest(0,least(100,round(58+((ovr_now-target_avg)*4)+((recent_rating-6.5)*15)+((form_now-50)*.18)+(fame_now*.10)-greatest(0,(coalesce(cand.reputation,2)-coalesce(current_club.reputation,2))*5))::int));IF cand.club_level='professional' THEN interest:=interest-8;END IF;IF cand.club_level='academy' AND coalesce(cand.reputation,2)-coalesce(current_club.reputation,2)>=3 AND NOT(recent_rating>=7.5 AND ovr_now>=target_avg-2)THEN CONTINUE;END IF;IF interest<63 THEN CONTINUE;END IF;IF random()>least(.72,greatest(.12,(interest-52)/70.0))THEN CONTINUE;END IF;
    fee:=round(private.career_player_market_value(pid)*CASE WHEN cand.club_level='professional' THEN 1.0+(interest-60)/100.0 ELSE .35+(interest-60)/160.0 END)::int;
    INSERT INTO public.player_transfer_bids(player_id,source_club_id,target_club_id,target_squad_level,bid_kind,current_fee,asking_fee,round,status,interest_score,effective_on,expires_on,generated_reason,metadata)VALUES(pid,current_club.id,cand.id,target_squad,CASE WHEN cand.club_level='professional' THEN 'professional_transfer' ELSE 'academy_transfer' END,fee,0,0,'pending',interest,effective_day,career_day+10,CASE WHEN interest>=82 THEN 'O clube acompanha você de perto e considera seu momento esportivo muito interessante.' WHEN interest>=72 THEN 'Seu desempenho recente chamou a atenção do departamento de futebol.' ELSE 'O clube vê potencial e espaço para seu desenvolvimento.' END,jsonb_build_object('career_date',career_day,'player_ovr',ovr_now,'recent_rating',recent_rating,'target_squad_avg',round(target_avg)::int))RETURNING id INTO bid_id;created_bids:=created_bids+1;bid_result:=private.settle_career_transfer_bid(bid_id);IF bid_result->>'offer_id' IS NOT NULL THEN created_offers:=created_offers+1;END IF;
  END LOOP;
  UPDATE public.player_market_state SET last_interest_check=career_day,last_offer_date=CASE WHEN created_offers>0 THEN career_day ELSE last_offer_date END,updated_at=now()WHERE player_id=pid;
  RETURN jsonb_build_object('created',created_offers,'new_bids',created_bids,'active_offers',active_offers+created_offers);
END $$;

CREATE OR REPLACE FUNCTION public.review_career_market_interest()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_player uuid;v_stage text;v_result jsonb;v_visible int;
BEGIN
  SELECT j.id,st.career_stage INTO v_player,v_stage FROM public.jogadores j JOIN public.player_career_state st ON st.player_id=j.id WHERE j.user_id=auth.uid();IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
  IF EXISTS(SELECT 1 FROM public.player_transfer_agreements WHERE player_id=v_player AND status='pending')THEN RETURN jsonb_build_object('created',0,'pending_agreement',true);END IF;
  v_result:=public.review_career_market_interest_core();
  IF v_stage='professional' THEN DELETE FROM public.player_messages pm USING public.player_offers po WHERE pm.offer_id=po.id AND po.player_id=v_player AND po.offer_type='academy_transfer' AND po.status IN('new','reviewed','negotiating','countered')AND pm.metadata->>'kind'='career_market_offer';UPDATE public.player_offers SET status='withdrawn' WHERE player_id=v_player AND offer_type='academy_transfer' AND status IN('new','reviewed','negotiating','countered');END IF;
  SELECT count(*)INTO v_visible FROM public.player_offers WHERE player_id=v_player AND offer_type IN('academy_transfer','professional_transfer')AND status IN('new','reviewed','negotiating','countered');
  RETURN coalesce(v_result,'{}'::jsonb)||jsonb_build_object('active_offers',v_visible);
END $$;

COMMIT;
