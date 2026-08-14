CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_user_id uuid:=auth.uid();v_player_id uuid;v_offer public.player_offers%rowtype;v_org public.base_clubs%rowtype;v_sport public.base_clubs%rowtype;v_coach public.base_coaches%rowtype;v_academy public.base_academy_profiles%rowtype;
 v_impacts jsonb;v_general int:=0;v_physical_pct int:=0;v_speed_pct int:=0;v_technical_pct int:=0;v_tactical_pct int:=0;v_recovery_pct int:=0;v_initial_morale int:=50;v_initial_trust int:=50;v_compatibility int:=0;v_signing_bonus int:=0;v_role text;v_evolution_modifiers jsonb;v_target_level text;v_start date;v_period smallint:=0;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;
 SELECT j.id INTO v_player_id FROM public.jogadores j WHERE j.user_id=v_user_id;IF v_player_id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
 SELECT po.* INTO v_offer FROM public.player_offers po WHERE po.id=p_offer_id AND po.player_id=v_player_id FOR UPDATE;IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Oferta não encontrada.';END IF;
 IF v_offer.offer_type<>'initial' THEN RAISE EXCEPTION 'Esta proposta não pertence ao início da carreira.';END IF;
 IF v_offer.status NOT IN('new','reviewed','negotiating','countered','accepted') THEN RAISE EXCEPTION 'Oferta indisponível para assinatura.';END IF;
 IF EXISTS(SELECT 1 FROM public.player_contracts pc WHERE pc.player_id=v_player_id AND pc.status='active') THEN RAISE EXCEPTION 'O jogador já possui um contrato ativo.';END IF;
 IF coalesce((v_offer.current_terms->>'monthly_wage')::int,0)<=0 OR coalesce((v_offer.current_terms->>'duration_seasons')::int,0) NOT BETWEEN 1 AND 3 OR coalesce((v_offer.current_terms->>'release_clause')::int,0)<=0 OR coalesce((v_offer.current_terms->>'signing_bonus')::int,-1)<0 OR coalesce(v_offer.current_terms->>'squad_role','')='' THEN RAISE EXCEPTION 'A oferta atual possui termos inválidos.';END IF;

 SELECT coalesce(st.career_date,current_date),coalesce(st.day_period,0)::smallint INTO v_start,v_period FROM public.player_career_state st WHERE st.player_id=v_player_id;
 v_start:=coalesce(v_start,current_date);v_period:=coalesce(v_period,0);

 SELECT * INTO v_org FROM public.base_clubs WHERE id=v_offer.club_id AND club_level='academy' AND squad_level='base';IF v_org.id IS NULL THEN RAISE EXCEPTION 'Organização da base da oferta não encontrada.';END IF;
 SELECT coalesce(nullif(v_offer.target_squad_level,''),private.career_youth_squad_for_age(j.idade)) INTO v_target_level FROM public.jogadores j WHERE j.id=v_player_id;
 SELECT * INTO v_sport FROM public.base_clubs WHERE academy_base_id=v_org.id AND squad_level=v_target_level AND is_active LIMIT 1;IF v_sport.id IS NULL THEN RAISE EXCEPTION 'Equipe esportiva % não encontrada.',upper(v_target_level);END IF;
 v_signing_bonus:=(v_offer.current_terms->>'signing_bonus')::int;v_role:=v_offer.current_terms->>'squad_role';v_initial_trust:=CASE v_role WHEN 'Promessa' THEN 40 WHEN 'Reserva' THEN 48 WHEN 'Rotação' THEN 58 WHEN 'Titular' THEN 70 WHEN 'Estrela' THEN 80 ELSE 50 END;
 SELECT * INTO v_coach FROM public.base_coaches WHERE id=v_sport.coach_id;IF v_coach.id IS NULL THEN RAISE EXCEPTION 'Treinador da equipe não encontrado.';END IF;
 SELECT * INTO v_academy FROM public.base_academy_profiles WHERE club_id=v_org.id;IF v_academy.id IS NULL THEN RAISE EXCEPTION 'Academia do clube não encontrada.';END IF;
 v_impacts:=coalesce(v_coach.impacts,'{}'::jsonb);v_general:=coalesce((v_impacts->>'general_evolution_bonus')::int,0);
 v_physical_pct:=CASE v_academy.physical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 WHEN 5 THEN 12 ELSE 0 END+v_general+coalesce((v_impacts->>'physical_evolution_bonus')::int,0)+coalesce((v_impacts->>'physical_evolution_penalty')::int,0);
 v_speed_pct:=CASE v_academy.speed WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 WHEN 5 THEN 12 ELSE 0 END+v_general;
 v_technical_pct:=CASE v_academy.technical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 WHEN 5 THEN 12 ELSE 0 END+v_general+coalesce((v_impacts->>'technical_evolution_bonus')::int,0);
 v_tactical_pct:=CASE v_academy.tactical WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 4 WHEN 4 THEN 8 WHEN 5 THEN 12 ELSE 0 END+v_general+coalesce((v_impacts->>'tactical_evolution_bonus')::int,0);
 v_recovery_pct:=CASE v_academy.recovery WHEN 1 THEN -5 WHEN 2 THEN 0 WHEN 3 THEN 5 WHEN 4 THEN 10 WHEN 5 THEN 15 ELSE 0 END+coalesce((v_impacts->>'recovery_pct_bonus')::int,0);
 v_initial_morale:=greatest(0,least(100,50+coalesce((v_impacts->>'morale_initial_bonus')::int,0)));v_compatibility:=greatest(0,least(100,coalesce((v_offer.compatibility_breakdown->>'total')::int,(v_offer.compatibility_breakdown->>'compatibility_total')::int,0)));
 v_evolution_modifiers:=jsonb_build_object('Físico',v_physical_pct,'Velocidade',v_speed_pct,'Passe',v_technical_pct,'Finalização',v_technical_pct,'Marcação',v_tactical_pct,'Visão de jogo',v_tactical_pct,'physical_pct',v_physical_pct,'speed_pct',v_speed_pct,'technical_pct',v_technical_pct,'tactical_pct',v_tactical_pct,'recovery_pct',v_recovery_pct,'academy',jsonb_build_object('physical',v_academy.physical,'speed',v_academy.speed,'technical',v_academy.technical,'recovery',v_academy.recovery,'tactical',v_academy.tactical),'coach_impacts',v_impacts);
 UPDATE public.player_offers SET status='withdrawn' WHERE player_id=v_player_id AND id<>p_offer_id AND status IN('new','reviewed','negotiating','countered');UPDATE public.player_offers SET status='accepted',target_squad_level=v_target_level WHERE id=p_offer_id;
 INSERT INTO public.player_contracts(player_id,club_id,duration_seasons,monthly_wage,signing_bonus,release_clause,squad_role,status,contract_kind,starts_on,ends_on,source_offer_id)
 VALUES(v_player_id,v_org.id,(v_offer.current_terms->>'duration_seasons')::int,(v_offer.current_terms->>'monthly_wage')::int,v_signing_bonus,(v_offer.current_terms->>'release_clause')::int,v_role,'active','academy',v_start,(v_start+((v_offer.current_terms->>'duration_seasons')||' years')::interval)::date,p_offer_id);
 INSERT INTO public.player_career_state(player_id,club_id,coach_id,trust,morale,energy,hierarchy,compatibility,evolution_modifiers,recovery_modifier,onboarding_completed,pending_initial_balance,financial_credit_applied,emergency_offer_generated,career_stage,career_date,day_period,updated_at)
 VALUES(v_player_id,v_sport.id,v_sport.coach_id,v_initial_trust,v_initial_morale,100,v_role,v_compatibility,v_evolution_modifiers,v_recovery_pct,true,v_signing_bonus,false,false,'academy',v_start,v_period,now())
 ON CONFLICT(player_id) DO UPDATE SET club_id=excluded.club_id,coach_id=excluded.coach_id,trust=excluded.trust,morale=excluded.morale,energy=excluded.energy,hierarchy=excluded.hierarchy,compatibility=excluded.compatibility,evolution_modifiers=excluded.evolution_modifiers,recovery_modifier=excluded.recovery_modifier,onboarding_completed=true,pending_initial_balance=excluded.pending_initial_balance,financial_credit_applied=false,emergency_offer_generated=false,career_stage='academy',career_date=coalesce(public.player_career_state.career_date,excluded.career_date),day_period=coalesce(public.player_career_state.day_period,excluded.day_period,0),next_match_date=null,updated_at=now();
 UPDATE public.player_squad_assignments SET ended_on=greatest(started_on,v_start-1) WHERE player_id=v_player_id AND ended_on IS NULL;
 INSERT INTO public.player_squad_assignments(player_id,club_id,squad_level,started_on,reason,metadata) VALUES(v_player_id,v_sport.id,v_sport.squad_level,v_start,'contract_start',jsonb_build_object('contract_club_id',v_org.id,'offer_id',p_offer_id));
 PERFORM private.ensure_competition_world(v_player_id);PERFORM private.sync_competition_next_match(v_player_id);PERFORM private.ensure_teammate_relations(v_player_id);PERFORM private.ensure_shirt_request(v_player_id);
END
$function$;
