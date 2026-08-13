-- Futbrowser: fictional sponsor proposals, negotiation and email-bound acceptance.
BEGIN;

CREATE OR REPLACE FUNCTION private.maybe_generate_sponsor_opportunity(p_player_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_club record;v_brand record;v_tier integer;v_kind text;v_chance numeric;v_agent_recent boolean;v_base integer;v_monthly integer;v_signing integer;v_delivery integer;v_days integer;v_weekly integer;v_miss integer;v_term integer;v_fit integer;v_id uuid;v_msg uuid;v_deadline date;v_bonus jsonb;v_excl text;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;IF v_state.player_id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO v_club FROM public.base_clubs WHERE id=v_state.club_id;
 UPDATE public.player_sponsor_opportunities SET status='expired' WHERE player_id=p_player_id AND status='proposed' AND COALESCE(response_deadline,expires_on)<v_state.career_date;
 IF EXISTS(SELECT 1 FROM public.player_sponsor_opportunities WHERE player_id=p_player_id AND status='proposed' AND COALESCE(response_deadline,expires_on)>=v_state.career_date) THEN RETURN NULL;END IF;
 v_tier:=private.sponsor_market_tier(p_player_id);
 v_agent_recent:=EXISTS(SELECT 1 FROM public.player_career_actions WHERE player_id=p_player_id AND activity_key='agent_meeting' AND career_date>=v_state.career_date-7);
 v_chance:=LEAST(.34,.025+COALESCE(v_state.fame,0)*.002+COALESCE(v_state.fanbase,0)/65000.0+GREATEST(0,COALESCE(v_state.public_image,50)-50)*.001+CASE WHEN v_agent_recent THEN .04 ELSE 0 END);
 IF random()>=v_chance THEN RETURN NULL;END IF;
 SELECT * INTO v_brand FROM private.career_sponsor_brand_catalog b
 WHERE b.tier<=v_tier AND COALESCE(v_club.reputation,0)>=b.min_club_reputation AND COALESCE(v_state.fame,0)>=b.min_fame AND COALESCE(v_state.fanbase,0)>=b.min_fanbase AND COALESCE(v_state.public_image,50)>=b.min_image AND COALESCE(v_state.form,50)>=b.min_form AND COALESCE((v_state.personality->>'discipline')::int,50)>=b.min_discipline
   AND NOT EXISTS(SELECT 1 FROM public.player_sponsor_contracts c WHERE c.player_id=p_player_id AND c.status='active' AND c.brand=b.brand)
 ORDER BY b.tier DESC,CASE WHEN EXISTS(SELECT 1 FROM public.player_sponsor_contracts old WHERE old.player_id=p_player_id AND old.brand=b.brand AND old.status='completed' AND old.trust>=75) THEN 0 ELSE 1 END,random() LIMIT 1;
 IF v_brand.brand IS NULL THEN RETURN NULL;END IF;
 v_kind:=CASE WHEN v_tier=1 THEN CASE WHEN random()<.82 THEN 'campaign' ELSE 'main' END WHEN v_tier=2 THEN CASE WHEN random()<.58 THEN 'campaign' ELSE 'main' END ELSE CASE WHEN random()<.30 THEN 'campaign' ELSE 'main' END END;
 v_fit:=LEAST(100,GREATEST(35,48+(COALESCE(v_state.public_image,50)-v_brand.min_image)/2+(COALESCE(v_state.form,50)-v_brand.min_form)/3+LEAST(18,GREATEST(0,COALESCE(v_state.fanbase,0)-v_brand.min_fanbase)/250)+CASE WHEN v_agent_recent THEN 5 ELSE 0 END));
 v_base:=ROUND(v_brand.base_reward*v_brand.reward_multiplier*(.70+v_fit/100.0))::int;
 IF v_kind='campaign' THEN
   v_days:=CASE v_brand.tier WHEN 1 THEN 7 WHEN 2 THEN 14 ELSE 21 END;v_monthly:=0;v_signing:=0;v_delivery:=GREATEST(120,ROUND(v_base*(.80+v_brand.tier*.18))::int);v_weekly:=1;
 ELSE
   v_days:=CASE v_brand.tier WHEN 1 THEN 60 WHEN 2 THEN 90 WHEN 3 THEN 120 WHEN 4 THEN 180 ELSE 240 END;
   v_monthly:=GREATEST(450,ROUND(v_base*(2.2+v_brand.tier*.75))::int);v_signing:=ROUND(v_monthly*(.35+v_brand.tier*.08))::int;v_delivery:=CASE WHEN v_brand.tier>=3 THEN ROUND(v_base*.35)::int ELSE 0 END;v_weekly:=LEAST(3,GREATEST(1,v_brand.max_weekly_deliveries));
 END IF;
 v_miss:=GREATEST(90,ROUND(GREATEST(v_delivery,v_monthly/4.0)*(.45+v_brand.tier*.10))::int);v_term:=GREATEST(v_miss*3,ROUND((v_monthly+v_signing)*(1.15+v_brand.tier*.20))::int);
 v_deadline:=v_state.career_date+CASE WHEN v_kind='campaign' THEN 3 ELSE 5 END;v_excl:=CASE WHEN v_brand.exclusivity_default AND v_kind='main' THEN v_brand.category ELSE NULL END;
 v_bonus:=jsonb_build_object('appearance',GREATEST(0,ROUND(v_brand.tier*18)::int),'goal',GREATEST(0,ROUND(v_brand.tier*45)::int),'assist',GREATEST(0,ROUND(v_brand.tier*28)::int),'rating8',GREATEST(0,ROUND(v_brand.tier*35)::int),'title',GREATEST(100,ROUND(v_brand.tier*350)::int),'callup',GREATEST(80,ROUND(v_brand.tier*250)::int));
 INSERT INTO public.player_sponsor_opportunities(player_id,brand,title,reward,status,available_from,expires_on,brand_profile,requirements,profile_data,fit_score,risk_level,offer_kind,brand_tier,contract_days,monthly_fee,signing_bonus,per_delivery_fee,max_weekly_deliveries,exclusivity_category,termination_penalty,missed_delivery_penalty,response_deadline,terms)
 VALUES(p_player_id,v_brand.brand,CASE WHEN v_kind='main' THEN 'Proposta de patrocínio · '||v_brand.brand ELSE 'Campanha publicitária · '||v_brand.brand END,CASE WHEN v_kind='main' THEN v_monthly ELSE v_delivery END,'proposed',v_state.career_date,v_deadline,v_brand.profile,jsonb_build_object('market_tier',v_tier,'min_fame',v_brand.min_fame,'min_fanbase',v_brand.min_fanbase,'min_club_reputation',v_brand.min_club_reputation),jsonb_build_object('label',v_brand.profile_label,'description',v_brand.description,'category',v_brand.category),v_fit,v_brand.exposure_risk,v_kind,v_brand.tier,v_days,v_monthly,v_signing,v_delivery,v_weekly,v_excl,v_term,v_miss,v_deadline,jsonb_build_object('bonus_terms',v_bonus,'market_label',private.sponsor_market_label(v_tier),'agent_recent',v_agent_recent)) RETURNING id INTO v_id;
 v_msg:=private.create_sponsor_email(p_player_id,v_state.club_id,CASE WHEN v_kind='main' THEN 'Proposta de patrocínio — '||v_brand.brand ELSE 'Proposta de publicidade — '||v_brand.brand END,
   CASE WHEN v_kind='main' THEN 'Seu empresário recebeu uma proposta de contrato da '||v_brand.brand||'. Leia os termos abaixo antes de decidir. O contrato só passa a existir se você aceitar esta proposta pela Caixa de Entrada.' ELSE v_brand.brand||' quer contratar você para uma campanha curta. Se aceitar, as entregas passam a fazer parte da sua agenda; se recusar ou deixar expirar, não existe multa.' END,
   jsonb_build_object('kind','sponsor_opportunity','proposal_id',v_id,'brand',v_brand.brand,'offer_kind',v_kind,'reward',CASE WHEN v_kind='main' THEN v_monthly ELSE v_delivery END,'expires_on',v_deadline,'market_tier',v_brand.tier));
 UPDATE public.player_sponsor_opportunities SET message_id=v_msg WHERE id=v_id;RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION private.maybe_offer_sponsor_renewal(p_contract_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record;s record;v_id uuid;v_msg uuid;v_deadline date;v_monthly integer;v_delivery integer;
BEGIN
 SELECT * INTO c FROM public.player_sponsor_contracts WHERE id=p_contract_id;IF c.id IS NULL OR c.trust<65 OR c.strikes>1 THEN RETURN NULL;END IF;
 SELECT * INTO s FROM public.player_career_state WHERE player_id=c.player_id;IF private.sponsor_market_tier(c.player_id)<c.brand_tier THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM public.player_sponsor_opportunities o WHERE o.player_id=c.player_id AND o.brand=c.brand AND o.status='proposed') THEN RETURN NULL;END IF;
 v_deadline:=s.career_date+5;v_monthly:=ROUND(c.monthly_fee*(1.05+LEAST(10,c.trust-65)/100.0))::int;v_delivery:=ROUND(c.per_delivery_fee*1.08)::int;
 INSERT INTO public.player_sponsor_opportunities(player_id,brand,title,reward,status,available_from,expires_on,brand_profile,requirements,profile_data,fit_score,risk_level,offer_kind,brand_tier,contract_days,monthly_fee,signing_bonus,per_delivery_fee,max_weekly_deliveries,exclusivity_category,termination_penalty,missed_delivery_penalty,response_deadline,terms)
 VALUES(c.player_id,c.brand,'Renovação · '||c.brand,CASE WHEN c.contract_kind='main' THEN v_monthly ELSE v_delivery END,'proposed',s.career_date,v_deadline,c.brand_profile,'{}','{"renewal":true}',c.trust,1,c.contract_kind,c.brand_tier,(c.ends_on-c.started_on),v_monthly,ROUND(c.signing_bonus*.35)::int,v_delivery,c.max_weekly_deliveries,c.exclusivity_category,c.termination_penalty,c.missed_delivery_penalty,v_deadline,c.metadata||jsonb_build_object('renewal_of',c.id)) RETURNING id INTO v_id;
 v_msg:=private.create_sponsor_email(c.player_id,s.club_id,'Renovação de patrocínio — '||c.brand,'A marca avaliou bem a parceria e enviou uma proposta de renovação. Você continua livre para aceitar, negociar ou recusar pela Caixa de Entrada.',jsonb_build_object('kind','sponsor_opportunity','proposal_id',v_id,'brand',c.brand,'offer_kind',c.contract_kind,'reward',CASE WHEN c.contract_kind='main' THEN v_monthly ELSE v_delivery END,'expires_on',v_deadline,'renewal',true));
 UPDATE public.player_sponsor_opportunities SET message_id=v_msg WHERE id=v_id;RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.respond_career_sponsor_proposal(p_proposal_id uuid,p_action text,p_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_player record;o record;s record;b record;v_contract uuid;v_gain numeric;v_exclusive boolean;v_new_message uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user;IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
 SELECT * INTO o FROM public.player_sponsor_opportunities WHERE id=p_proposal_id AND player_id=v_player.id FOR UPDATE;IF o.id IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada.';END IF;
 SELECT * INTO s FROM public.player_career_state WHERE player_id=v_player.id FOR UPDATE;
 IF o.status<>'proposed' THEN RAISE EXCEPTION 'Esta proposta já não está disponível.';END IF;
 IF o.message_id IS DISTINCT FROM p_message_id OR NOT EXISTS(SELECT 1 FROM public.player_messages m WHERE m.id=p_message_id AND m.player_id=v_player.id) THEN RAISE EXCEPTION 'Abra o e-mail atual da proposta para responder.';END IF;
 IF COALESCE(o.response_deadline,o.expires_on)<s.career_date THEN UPDATE public.player_sponsor_opportunities SET status='expired' WHERE id=o.id;RAISE EXCEPTION 'O prazo desta proposta já terminou.';END IF;
 IF p_action='decline' THEN UPDATE public.player_sponsor_opportunities SET status='rejected' WHERE id=o.id;RETURN jsonb_build_object('success',true,'status','rejected','message','Proposta recusada. Nenhum contrato ou multa foi criado.');END IF;
 IF p_action='negotiate' THEN
   IF o.negotiation_round>=2 THEN RAISE EXCEPTION 'O empresário já chegou ao limite desta negociação.';END IF;
   v_gain:=CASE WHEN COALESCE(s.agent_relation,50)>=80 THEN 1.11 WHEN COALESCE(s.agent_relation,50)>=65 THEN 1.08 ELSE 1.05 END;
   UPDATE public.player_sponsor_opportunities SET monthly_fee=ROUND(monthly_fee*v_gain)::int,signing_bonus=ROUND(signing_bonus*(1+(v_gain-1)*.75))::int,per_delivery_fee=ROUND(per_delivery_fee*v_gain)::int,termination_penalty=CASE WHEN COALESCE(s.agent_relation,50)>=75 THEN ROUND(termination_penalty*.90)::int ELSE termination_penalty END,missed_delivery_penalty=CASE WHEN COALESCE(s.agent_relation,50)>=85 THEN ROUND(missed_delivery_penalty*.92)::int ELSE missed_delivery_penalty END,negotiation_round=negotiation_round+1,response_deadline=LEAST(expires_on+2,COALESCE(response_deadline,expires_on)+1),terms=terms||jsonb_build_object('last_negotiated_on',s.career_date) WHERE id=o.id RETURNING * INTO o;
   v_new_message:=private.create_sponsor_email(v_player.id,s.club_id,'Contraproposta negociada — '||o.brand,'Seu empresário voltou da negociação com termos melhores. Esta mensagem substitui a anterior: aceite, negocie novamente se ainda houver margem, ou recuse por aqui.',jsonb_build_object('kind','sponsor_opportunity','proposal_id',o.id,'brand',o.brand,'offer_kind',o.offer_kind,'reward',CASE WHEN o.offer_kind='main' THEN o.monthly_fee ELSE o.per_delivery_fee END,'expires_on',o.response_deadline,'negotiation_round',o.negotiation_round));
   UPDATE public.player_sponsor_opportunities SET message_id=v_new_message WHERE id=o.id;RETURN jsonb_build_object('success',true,'status','proposed','message','Seu empresário conseguiu melhorar a proposta. Um novo e-mail chegou com os termos atualizados.','message_id',v_new_message);
 END IF;
 IF p_action<>'accept' THEN RAISE EXCEPTION 'Resposta inválida.';END IF;
 IF private.sponsor_market_tier(v_player.id)<o.brand_tier THEN RAISE EXCEPTION 'Sua situação esportiva atual já não atende ao nível desta proposta.';END IF;
 SELECT * INTO b FROM private.career_sponsor_brand_catalog WHERE brand=o.brand;v_exclusive:=o.exclusivity_category IS NOT NULL;
 IF EXISTS(SELECT 1 FROM public.player_sponsor_contracts c WHERE c.player_id=v_player.id AND c.status='active' AND c.category=COALESCE(b.category,o.exclusivity_category) AND (c.exclusivity OR v_exclusive) AND c.brand<>o.brand) THEN RAISE EXCEPTION 'Já existe um contrato com exclusividade incompatível nesta categoria.';END IF;
 INSERT INTO public.player_sponsor_contracts(player_id,proposal_id,brand,brand_tier,brand_profile,category,contract_kind,started_on,ends_on,monthly_fee,per_delivery_fee,signing_bonus,max_weekly_deliveries,exclusivity,exclusivity_category,termination_penalty,missed_delivery_penalty,last_payment_on,metadata)
 VALUES(v_player.id,o.id,o.brand,o.brand_tier,o.brand_profile,COALESCE(b.category,o.exclusivity_category,'commercial'),o.offer_kind,s.career_date,s.career_date+o.contract_days,o.monthly_fee,o.per_delivery_fee,o.signing_bonus,o.max_weekly_deliveries,v_exclusive,o.exclusivity_category,o.termination_penalty,o.missed_delivery_penalty,s.career_date,o.terms||jsonb_build_object('fit_score',o.fit_score)) RETURNING id INTO v_contract;
 UPDATE public.player_sponsor_opportunities SET status='accepted' WHERE id=o.id;
 IF o.signing_bonus>0 THEN PERFORM private.sponsor_post_transaction(v_player.id,v_contract,NULL,'signing',o.signing_bonus,s.career_date,'Bônus de assinatura · '||o.brand,jsonb_build_object('brand',o.brand));END IF;
 PERFORM private.ensure_sponsor_deliverables(v_player.id,s.career_date);
 PERFORM private.create_sponsor_email(v_player.id,s.club_id,'Contrato assinado — '||o.brand,'Contrato confirmado. A partir de agora as entregas publicitárias podem aparecer na sua agenda. O jogo nunca vai bloquear o avanço por causa delas: cumprir ou aceitar as consequências é uma decisão sua.',jsonb_build_object('kind','sponsor_contract_signed','contract_id',v_contract,'brand',o.brand,'ends_on',s.career_date+o.contract_days,'max_weekly_deliveries',o.max_weekly_deliveries));
 RETURN jsonb_build_object('success',true,'status','accepted','contract_id',v_contract,'message','Contrato assinado. As obrigações passam a valer a partir de agora.');
END $$;

REVOKE ALL ON FUNCTION public.respond_career_sponsor_proposal(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_career_sponsor_proposal(uuid,text,uuid) TO authenticated;

COMMIT;
