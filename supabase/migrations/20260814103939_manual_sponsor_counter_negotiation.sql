CREATE OR REPLACE FUNCTION private.sponsor_opportunity_terms_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  agent int:=50;
  penalty_policy jsonb;
  bonus_policy jsonb;
  manual_counter boolean:=false;
BEGIN
  penalty_policy:=coalesce(NEW.terms->'penalty_policy',jsonb_build_object(
    'first_miss_percent',25,'repeat_step_percent',25,'max_miss_percent',75,
    'termination_strikes',3,'termination_trust',30,'termination_fee_rule','half_month_or_two_actions'));
  bonus_policy:=coalesce(NEW.terms->'bonus_policy',jsonb_build_object(
    'appearance',true,'goals',true,'assists',true,'rating_threshold',8,
    'national_team',true,'title_bonus',true,'multiplier',1.0));
  manual_counter:=coalesce((NEW.terms->>'manual_counter')::boolean,false);

  IF TG_OP='UPDATE' AND NEW.negotiation_round>OLD.negotiation_round AND NOT manual_counter THEN
    SELECT coalesce(st.agent_relation,50) INTO agent
    FROM public.player_career_state st WHERE st.player_id=NEW.player_id;

    NEW.contract_days:=CASE WHEN NEW.offer_kind='main'
      THEN greatest(60,NEW.contract_days-greatest(5,round(greatest(0,agent-45)/3.0)::int))
      ELSE greatest(7,NEW.contract_days-greatest(1,round(greatest(0,agent-50)/15.0)::int)) END;
    IF agent>=62 AND NEW.max_weekly_deliveries>1 THEN
      NEW.max_weekly_deliveries:=NEW.max_weekly_deliveries-1;
    END IF;
    IF NEW.exclusivity_category IS NOT NULL AND agent>=68 AND (NEW.negotiation_round>=2 OR random()<.45) THEN
      NEW.exclusivity_category:=NULL;
    END IF;

    penalty_policy:=penalty_policy||jsonb_build_object(
      'first_miss_percent',greatest(15,coalesce((penalty_policy->>'first_miss_percent')::int,25)-CASE WHEN agent>=60 THEN 5 ELSE 0 END),
      'repeat_step_percent',greatest(15,coalesce((penalty_policy->>'repeat_step_percent')::int,25)-CASE WHEN agent>=70 THEN 5 ELSE 0 END),
      'max_miss_percent',greatest(50,coalesce((penalty_policy->>'max_miss_percent')::int,75)-CASE WHEN agent>=65 THEN 10 ELSE 0 END),
      'termination_strikes',coalesce((penalty_policy->>'termination_strikes')::int,3)+CASE WHEN agent>=75 AND NEW.offer_kind='main' THEN 1 ELSE 0 END,
      'negotiated_by_agent',true);
    bonus_policy:=bonus_policy||jsonb_build_object(
      'multiplier',round((coalesce((bonus_policy->>'multiplier')::numeric,1.0)+CASE WHEN agent>=60 THEN .08 ELSE .04 END)::numeric,2),
      'negotiated_by_agent',true);
  END IF;

  NEW.terms:=coalesce(NEW.terms,'{}'::jsonb)||jsonb_build_object(
    'monthly_fee',NEW.monthly_fee,'signing_bonus',NEW.signing_bonus,'per_delivery_fee',NEW.per_delivery_fee,
    'contract_days',NEW.contract_days,'max_weekly_deliveries',NEW.max_weekly_deliveries,
    'exclusivity',NEW.exclusivity_category IS NOT NULL,'category',coalesce(NEW.exclusivity_category,NEW.terms->>'category','general'),
    'brand_tier',NEW.brand_tier,'penalty_policy',penalty_policy,'bonus_policy',bonus_policy);
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.negotiate_career_sponsor_proposal(
  p_opportunity_id uuid,
  p_message_id uuid,
  p_counter_terms jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  uid uuid:=auth.uid();
  pid uuid;
  o record;
  st record;
  mid uuid;
  requested jsonb:=coalesce(p_counter_terms,'{}'::jsonb);
  req_monthly int;
  req_signing int;
  req_per_delivery int;
  req_days int;
  req_weekly int;
  req_exclusive boolean;
  req_first_penalty int;
  req_bonus numeric;
  old_first_penalty int;
  old_bonus numeric;
  demand numeric:=0;
  tolerance numeric:=0;
  result text;
  final_monthly int;
  final_signing int;
  final_per_delivery int;
  final_days int;
  final_weekly int;
  final_exclusive boolean;
  final_first_penalty int;
  final_bonus numeric;
  category text;
  new_terms jsonb;
  history jsonb;
  round_no int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT j.id INTO pid FROM public.jogadores j WHERE j.user_id=uid;
  SELECT * INTO o FROM public.player_sponsor_opportunities WHERE id=p_opportunity_id AND player_id=pid FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada.'; END IF;
  IF o.status<>'proposed' THEN RAISE EXCEPTION 'Esta proposta não está mais disponível.'; END IF;
  SELECT * INTO st FROM public.player_career_state WHERE player_id=pid;
  IF coalesce(o.response_deadline,o.expires_on)<st.career_date THEN
    UPDATE public.player_sponsor_opportunities SET status='expired' WHERE id=o.id;
    RAISE EXCEPTION 'A proposta expirou.';
  END IF;
  IF o.message_id IS DISTINCT FROM p_message_id OR NOT EXISTS(
    SELECT 1 FROM public.player_messages m WHERE m.id=p_message_id AND m.player_id=pid
  ) THEN RAISE EXCEPTION 'Abra a versão atual da proposta na Caixa de Entrada.'; END IF;
  IF o.negotiation_round>=2 THEN RAISE EXCEPTION 'As duas rodadas de negociação já foram usadas.'; END IF;

  req_monthly:=greatest(0,coalesce((requested->>'monthly_fee')::int,o.monthly_fee));
  req_signing:=greatest(0,coalesce((requested->>'signing_bonus')::int,o.signing_bonus));
  req_per_delivery:=greatest(0,coalesce((requested->>'per_delivery_fee')::int,o.per_delivery_fee));
  req_days:=greatest(7,least(720,coalesce((requested->>'contract_days')::int,o.contract_days)));
  req_weekly:=greatest(1,least(3,coalesce((requested->>'max_weekly_deliveries')::int,o.max_weekly_deliveries)));
  req_exclusive:=coalesce((requested->>'exclusivity')::boolean,o.exclusivity_category IS NOT NULL);
  old_first_penalty:=coalesce((o.terms->'penalty_policy'->>'first_miss_percent')::int,25);
  old_bonus:=coalesce((o.terms->'bonus_policy'->>'multiplier')::numeric,1.0);
  req_first_penalty:=greatest(0,least(100,coalesce((requested->>'first_miss_percent')::int,old_first_penalty)));
  req_bonus:=greatest(.50,least(3.00,coalesce((requested->>'bonus_multiplier')::numeric,old_bonus)));
  category:=coalesce(o.exclusivity_category,o.terms->>'category',o.brand_profile,'general');

  IF o.monthly_fee>0 THEN demand:=demand+greatest(0,(req_monthly-o.monthly_fee)::numeric/greatest(1,o.monthly_fee))*.85; END IF;
  IF o.signing_bonus>0 THEN demand:=demand+greatest(0,(req_signing-o.signing_bonus)::numeric/greatest(1,o.signing_bonus))*.35; END IF;
  IF o.per_delivery_fee>0 THEN demand:=demand+greatest(0,(req_per_delivery-o.per_delivery_fee)::numeric/greatest(1,o.per_delivery_fee))*.65; END IF;
  demand:=demand+greatest(0,(o.contract_days-req_days)::numeric/greatest(1,o.contract_days))*.35;
  demand:=demand+greatest(0,(o.max_weekly_deliveries-req_weekly)::numeric)*.22;
  IF o.exclusivity_category IS NOT NULL AND NOT req_exclusive THEN demand:=demand+.28; END IF;
  demand:=demand+greatest(0,(old_first_penalty-req_first_penalty)::numeric/100)*.30;
  demand:=demand+greatest(0,req_bonus-old_bonus)*.35;

  tolerance:=.22+coalesce(st.agent_relation,50)/260.0+coalesce(o.fit_score,50)/500.0-greatest(0,o.brand_tier-2)*.035;
  round_no:=o.negotiation_round+1;

  IF demand<=tolerance THEN
    result:='accepted';
    final_monthly:=req_monthly; final_signing:=req_signing; final_per_delivery:=req_per_delivery;
    final_days:=req_days; final_weekly:=req_weekly; final_exclusive:=req_exclusive;
    final_first_penalty:=req_first_penalty; final_bonus:=req_bonus;
  ELSIF demand<=tolerance+.42 THEN
    result:='countered';
    final_monthly:=round(o.monthly_fee+(req_monthly-o.monthly_fee)*(.45+least(.25,coalesce(st.agent_relation,50)/400.0)))::int;
    final_signing:=round(o.signing_bonus+(req_signing-o.signing_bonus)*(.45+least(.25,coalesce(st.agent_relation,50)/400.0)))::int;
    final_per_delivery:=round(o.per_delivery_fee+(req_per_delivery-o.per_delivery_fee)*(.45+least(.25,coalesce(st.agent_relation,50)/400.0)))::int;
    final_days:=round(o.contract_days+(req_days-o.contract_days)*.55)::int;
    final_weekly:=CASE WHEN req_weekly<o.max_weekly_deliveries AND coalesce(st.agent_relation,50)>=60 THEN greatest(req_weekly,o.max_weekly_deliveries-1) ELSE o.max_weekly_deliveries END;
    final_exclusive:=CASE WHEN o.exclusivity_category IS NULL THEN false WHEN NOT req_exclusive AND coalesce(st.agent_relation,50)>=70 THEN false ELSE true END;
    final_first_penalty:=round(old_first_penalty+(req_first_penalty-old_first_penalty)*.55)::int;
    final_bonus:=round((old_bonus+(req_bonus-old_bonus)*.55)::numeric,2);
  ELSE
    result:='rejected';
    final_monthly:=o.monthly_fee; final_signing:=o.signing_bonus; final_per_delivery:=o.per_delivery_fee;
    final_days:=o.contract_days; final_weekly:=o.max_weekly_deliveries; final_exclusive:=o.exclusivity_category IS NOT NULL;
    final_first_penalty:=old_first_penalty; final_bonus:=old_bonus;
  END IF;

  history:=coalesce(o.terms->'negotiation_history','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'round',round_no,'requested',jsonb_build_object(
      'monthly_fee',req_monthly,'signing_bonus',req_signing,'per_delivery_fee',req_per_delivery,
      'contract_days',req_days,'max_weekly_deliveries',req_weekly,'exclusivity',req_exclusive,
      'first_miss_percent',req_first_penalty,'bonus_multiplier',req_bonus),
    'result',result,'career_date',st.career_date));

  new_terms:=coalesce(o.terms,'{}'::jsonb)||jsonb_build_object(
    'manual_counter',true,
    'negotiation_history',history,
    'last_negotiation_result',result,
    'penalty_policy',coalesce(o.terms->'penalty_policy','{}'::jsonb)||jsonb_build_object('first_miss_percent',final_first_penalty),
    'bonus_policy',coalesce(o.terms->'bonus_policy','{}'::jsonb)||jsonb_build_object('multiplier',final_bonus));

  UPDATE public.player_sponsor_opportunities
  SET negotiation_round=round_no,
      monthly_fee=final_monthly,
      signing_bonus=final_signing,
      per_delivery_fee=final_per_delivery,
      contract_days=final_days,
      max_weekly_deliveries=final_weekly,
      exclusivity_category=CASE WHEN final_exclusive THEN category ELSE NULL END,
      terms=new_terms
  WHERE id=o.id;

  INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
  VALUES(
    pid,st.club_id,'career',
    CASE result WHEN 'accepted' THEN 'Marca aceitou sua contraproposta — ' WHEN 'countered' THEN 'Nova contraproposta da marca — ' ELSE 'Marca recusou sua contraproposta — ' END||o.brand,
    CASE result
      WHEN 'accepted' THEN 'Seu empresário conseguiu os termos que você pediu. Esta é a nova versão válida da proposta.'
      WHEN 'countered' THEN 'A marca não aceitou tudo que você pediu e devolveu novos termos. Esta é a nova versão válida da proposta.'
      ELSE 'A marca não aceitou os termos pedidos. A proposta anterior continua disponível nesta nova mensagem.'
    END,
    jsonb_build_object('kind','sponsor_contract_proposal','opportunity_id',o.id,'brand',o.brand,'negotiated',true,'round',round_no,'negotiation_result',result,'response_deadline',o.response_deadline)
  ) RETURNING id INTO mid;

  UPDATE public.player_sponsor_opportunities SET message_id=mid WHERE id=o.id;
  RETURN jsonb_build_object('status',result,'message_id',mid,'round',round_no,'terms',jsonb_build_object(
    'monthly_fee',final_monthly,'signing_bonus',final_signing,'per_delivery_fee',final_per_delivery,
    'contract_days',final_days,'max_weekly_deliveries',final_weekly,'exclusivity',final_exclusive,
    'first_miss_percent',final_first_penalty,'bonus_multiplier',final_bonus));
END
$function$;

REVOKE EXECUTE ON FUNCTION public.negotiate_career_sponsor_proposal(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.negotiate_career_sponsor_proposal(uuid,uuid,jsonb) TO authenticated;
