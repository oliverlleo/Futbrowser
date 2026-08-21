BEGIN;

DO $$
DECLARE o record;bid_id uuid;
BEGIN
  FOR o IN
    SELECT * FROM public.player_offers
    WHERE offer_type IN('academy_transfer','professional_transfer')
      AND status IN('new','reviewed','negotiating','countered')
      AND coalesce(snapshot_data->>'club_to_club_agreed','false')<>'true'
  LOOP
    INSERT INTO public.player_transfer_bids(player_id,source_club_id,target_club_id,target_squad_level,bid_kind,current_fee,asking_fee,round,status,interest_score,effective_on,expires_on,generated_reason,metadata)
    VALUES(o.player_id,o.source_club_id,o.club_id,coalesce(o.target_squad_level,'first_team'),o.offer_type,greatest(0,coalesce(o.transfer_fee,0)),greatest(0,coalesce(o.transfer_fee,0)),0,'accepted',greatest(0,least(100,coalesce((o.snapshot_data->>'market_interest')::int,65))),o.effective_on,coalesce(o.career_expires_on,current_date+10),coalesce(o.generated_reason,'Oferta existente regularizada na implantação do mercado entre clubes.'),jsonb_build_object('legacy_offer_id',o.id,'migration_regularized',true))
    RETURNING id INTO bid_id;
    UPDATE public.player_offers SET snapshot_data=coalesce(snapshot_data,'{}'::jsonb)||jsonb_build_object('transfer_bid_id',bid_id,'club_to_club_agreed',true,'agreed_transfer_fee',greatest(0,coalesce(transfer_fee,0))) WHERE id=o.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.assert_career_transfer_offer_agreed(p_offer_id uuid,p_player_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE o record;b record;bid_text text;
BEGIN
  SELECT * INTO o FROM public.player_offers WHERE id=p_offer_id AND player_id=p_player_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada.';END IF;
  IF o.offer_type NOT IN('academy_transfer','professional_transfer') THEN RETURN;END IF;
  IF coalesce(o.snapshot_data->>'club_to_club_agreed','false')<>'true' THEN RAISE EXCEPTION 'A transferência ainda não foi aprovada pelo clube atual.';END IF;
  bid_text:=o.snapshot_data->>'transfer_bid_id';IF bid_text IS NULL OR bid_text='' THEN RAISE EXCEPTION 'A negociação entre os clubes não foi localizada.';END IF;
  BEGIN SELECT * INTO b FROM public.player_transfer_bids WHERE id=bid_text::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'A negociação entre os clubes é inválida.';END;
  IF b.id IS NULL OR b.status<>'accepted' OR b.player_id<>p_player_id OR b.target_club_id<>o.club_id OR b.source_club_id IS DISTINCT FROM o.source_club_id THEN RAISE EXCEPTION 'A transferência não possui acordo válido entre os clubes.';END IF;
END $$;

CREATE OR REPLACE FUNCTION public.accept_career_market_offer(p_offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_offer record;v_player uuid;v_date date;v_effective date;v_pending uuid;
BEGIN
  SELECT po.*,j.id player_key INTO v_offer FROM public.player_offers po JOIN public.jogadores j ON j.id=po.player_id WHERE po.id=p_offer_id AND j.user_id=auth.uid() AND po.offer_type<>'initial' FOR UPDATE OF po;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada.';END IF;IF v_offer.status NOT IN('new','reviewed','negotiating','countered') THEN RAISE EXCEPTION 'Proposta indisponível.';END IF;v_player:=v_offer.player_key;
  IF v_offer.offer_type IN('academy_transfer','professional_transfer') THEN PERFORM private.assert_career_transfer_offer_agreed(v_offer.id,v_player);END IF;
  SELECT career_date INTO v_date FROM public.player_career_state WHERE player_id=v_player;
  IF v_offer.offer_type IN('academy_transfer','professional_transfer') THEN
    v_effective:=greatest(v_date,coalesce(v_offer.effective_on,private.career_next_registration_date(v_date)));
    IF v_effective>v_date THEN
      INSERT INTO public.player_transfer_agreements(player_id,offer_id,source_club_id,target_contract_club_id,target_squad_level,agreed_on,effective_on,transfer_fee,status,metadata)
      VALUES(v_player,v_offer.id,v_offer.source_club_id,v_offer.club_id,coalesce(v_offer.target_squad_level,'first_team'),v_date,v_effective,coalesce(v_offer.transfer_fee,0),'pending',jsonb_build_object('offer_type',v_offer.offer_type,'transfer_bid_id',v_offer.snapshot_data->>'transfer_bid_id')) RETURNING id INTO v_pending;
      UPDATE public.player_offers SET status='accepted' WHERE id=v_offer.id;
      UPDATE public.player_offers SET status='withdrawn' WHERE player_id=v_player AND id<>v_offer.id AND offer_type<>'initial' AND status IN('new','reviewed','negotiating','countered');
      INSERT INTO public.player_messages(player_id,club_id,offer_id,message_type,subject,body,metadata)VALUES(v_player,v_offer.club_id,v_offer.id,'career','Acordo assinado — aguardando registro','Você acertou com o novo clube. Até a data de registro, sua rotina e seus jogos continuam normalmente na equipe atual.',jsonb_build_object('kind','market_move_pending','effective_on',v_effective,'offer_id',v_offer.id));
      RETURN jsonb_build_object('status','pending_registration','effective_on',v_effective,'agreement_id',v_pending);
    END IF;
  END IF;
  PERFORM private.career_apply_market_offer(v_player,v_offer.id,v_date);RETURN jsonb_build_object('status','completed','effective_on',v_date);
END $$;

CREATE OR REPLACE FUNCTION public.negotiate_offer(p_offer_id uuid,p_requested_terms jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user_id uuid;v_offer record;v_round int;v_flex_rem int;v_cost int:=0;v_curr_wage int;v_req_wage int;v_curr_dur int;v_req_dur int;v_curr_release int;v_req_release int;v_curr_role text;v_req_role text;v_curr_bonus int;v_requested_terms jsonb;v_role_diff int;v_response_action text;v_club_stance text;v_response_terms jsonb;v_message text;v_latest_action text;v_role_levels jsonb:='{"Promessa":1,"Reserva":2,"Rotação":3,"Titular":4,"Estrela":5}'::jsonb;
BEGIN
  v_user_id:=auth.uid();IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;
  SELECT po.* INTO v_offer FROM public.player_offers po JOIN public.jogadores j ON j.id=po.player_id WHERE po.id=p_offer_id AND j.user_id=v_user_id FOR UPDATE OF po;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.';END IF;IF v_offer.status NOT IN('new','reviewed','negotiating','countered') THEN RAISE EXCEPTION 'A negociação para este clube já foi encerrada.';END IF;IF v_offer.round>=3 THEN RAISE EXCEPTION 'Número máximo de rodadas de negociação atingido.';END IF;
  IF v_offer.offer_type='initial' AND EXISTS(SELECT 1 FROM public.player_contracts pc WHERE pc.player_id=v_offer.player_id AND pc.status='active') THEN RAISE EXCEPTION 'Jogador já possui contrato ativo.';END IF;
  IF v_offer.offer_type NOT IN('initial','academy_transfer','professional_transfer','professional_promotion') THEN RAISE EXCEPTION 'Tipo de proposta não negociável.';END IF;
  IF v_offer.offer_type IN('academy_transfer','professional_transfer') THEN PERFORM private.assert_career_transfer_offer_agreed(v_offer.id,v_offer.player_id);END IF;
  SELECT poh.response_action INTO v_latest_action FROM public.player_offer_history poh WHERE poh.offer_id=p_offer_id ORDER BY poh.round DESC LIMIT 1;IF v_latest_action='accepted' THEN RAISE EXCEPTION 'O clube já aceitou os termos atuais. Assine o contrato ou recuse a proposta.';END IF;
  IF p_requested_terms IS NULL OR jsonb_typeof(p_requested_terms)<>'object' THEN RAISE EXCEPTION 'Termos de negociação inválidos.';END IF;
  IF NOT p_requested_terms?'monthly_wage' OR NOT p_requested_terms?'duration_seasons' OR NOT p_requested_terms?'release_clause' OR NOT p_requested_terms?'squad_role' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_requested_terms)k(key)WHERE k.key NOT IN('monthly_wage','duration_seasons','release_clause','squad_role','signing_bonus'))THEN RAISE EXCEPTION 'A contraproposta contém campos inválidos.';END IF;
  BEGIN v_curr_wage:=(v_offer.current_terms->>'monthly_wage')::int;v_req_wage:=(p_requested_terms->>'monthly_wage')::int;v_curr_dur:=(v_offer.current_terms->>'duration_seasons')::int;v_req_dur:=(p_requested_terms->>'duration_seasons')::int;v_curr_release:=(v_offer.current_terms->>'release_clause')::int;v_req_release:=(p_requested_terms->>'release_clause')::int;v_curr_role:=v_offer.current_terms->>'squad_role';v_req_role:=p_requested_terms->>'squad_role';v_curr_bonus:=coalesce((v_offer.current_terms->>'signing_bonus')::int,0);EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Os valores numéricos da negociação são inválidos.';END;
  IF v_req_wage IS NULL OR v_req_wage<=0 THEN RAISE EXCEPTION 'Salário deve ser maior que zero.';END IF;IF v_req_release IS NULL OR v_req_release<=0 THEN RAISE EXCEPTION 'Multa rescisória deve ser maior que zero.';END IF;IF v_req_dur IS NULL OR v_req_dur<1 OR v_req_dur>3 THEN RAISE EXCEPTION 'Duração deve ser de 1 a 3 temporadas.';END IF;IF NOT(v_role_levels?v_req_role)OR NOT(v_role_levels?v_curr_role)THEN RAISE EXCEPTION 'Função no elenco inválida.';END IF;
  v_requested_terms:=jsonb_build_object('monthly_wage',v_req_wage,'duration_seasons',v_req_dur,'release_clause',v_req_release,'squad_role',v_req_role,'signing_bonus',v_curr_bonus);
  IF v_req_wage>v_curr_wage THEN v_cost:=v_cost+round(((v_req_wage::numeric/v_curr_wage::numeric)-1.0)*80)::int;ELSIF v_req_wage<v_curr_wage THEN v_cost:=v_cost-round(((v_curr_wage::numeric/v_req_wage::numeric)-1.0)*40)::int;END IF;
  IF v_req_release<v_curr_release THEN v_cost:=v_cost+round(((v_curr_release::numeric/v_req_release::numeric)-1.0)*60)::int;ELSIF v_req_release>v_curr_release THEN v_cost:=v_cost-round(((v_req_release::numeric/v_curr_release::numeric)-1.0)*30)::int;END IF;
  v_role_diff:=(v_role_levels->>v_req_role)::int-(v_role_levels->>v_curr_role)::int;IF v_role_diff>0 THEN v_cost:=v_cost+(v_role_diff*25);ELSIF v_role_diff<0 THEN v_cost:=v_cost+(v_role_diff*15);END IF;IF v_req_dur<v_curr_dur THEN v_cost:=v_cost+((v_curr_dur-v_req_dur)*5);ELSIF v_req_dur>v_curr_dur THEN v_cost:=v_cost-((v_req_dur-v_curr_dur)*5);END IF;
  v_cost:=greatest(0,v_cost);v_flex_rem:=greatest(0,coalesce(v_offer.internal_tolerance,0));
  IF v_cost=0 THEN v_response_action:='accepted';v_club_stance:='flexível';v_response_terms:=v_requested_terms;v_message:='O clube aceitou seus termos. Revise e assine o contrato para concluir.';ELSIF v_cost<=v_flex_rem THEN v_response_action:='countered';v_club_stance:='cauteloso';v_response_terms:=jsonb_build_object('monthly_wage',(v_curr_wage::numeric+((v_req_wage::numeric-v_curr_wage::numeric)/2))::int,'duration_seasons',v_curr_dur,'release_clause',v_curr_release,'squad_role',v_curr_role,'signing_bonus',v_curr_bonus);v_flex_rem:=greatest(0,v_flex_rem-v_cost);v_message:='O clube fez uma contraproposta.';ELSIF v_offer.is_emergency THEN v_response_action:='countered';v_club_stance:='intransigente';v_response_terms:=v_offer.current_terms;v_flex_rem:=0;v_message:='O clube não aceitou suas exigências e manteve a oferta emergencial como condição final.';ELSE v_response_action:='withdrawn';v_club_stance:='intransigente';v_response_terms:=v_offer.current_terms;v_flex_rem:=0;v_message:='O clube encerrou as negociações após considerar as exigências excessivas.';END IF;
  v_round:=v_offer.round+1;INSERT INTO public.player_offer_history(offer_id,round,requested_terms,response_action,club_response_terms,previous_terms,negotiation_cost,remaining_flexibility,before_stance,after_stance)VALUES(p_offer_id,v_round,v_requested_terms,v_response_action,v_response_terms,v_offer.current_terms,v_cost,v_flex_rem,CASE WHEN v_offer.status='countered' THEN 'cauteloso' ELSE 'interessado' END,v_club_stance);
  IF v_response_action='withdrawn' THEN UPDATE public.player_offers SET status='withdrawn',round=v_round,internal_tolerance=v_flex_rem WHERE id=p_offer_id;ELSE UPDATE public.player_offers SET status='countered',current_terms=v_response_terms,round=v_round,internal_tolerance=v_flex_rem WHERE id=p_offer_id;END IF;
  RETURN jsonb_build_object('status',v_response_action,'message',v_message,'round',v_round,'remaining_flexibility',v_flex_rem,'terms',v_response_terms);
END $$;

COMMIT;
